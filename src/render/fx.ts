/**
 * OWNER: render-fx agent. Every particle on the table: Rent Day coins, dust
 * puffs, sparkles, hearts, confetti, chimney smoke, weather over the board,
 * and the always-on atmosphere (motes, leaves, petals, fireflies, birds).
 *
 * Draw calls: at most six, and only those with something in them are drawn:
 *   soft sprites (smoke, dust, fog)        normal blend
 *   crisp sprites (rain, snow, hail, hearts) normal blend
 *   glow sprites (sparkles, glints, motes, fireflies, lightning) additive
 *   coins (lit gold discs)                 instanced mesh
 *   tumblers (confetti, leaves, petals)    instanced mesh, lit
 *   birds                                  instanced mesh, lit (+ shadow pass)
 * Everything is pooled; update() allocates nothing.
 */
import * as THREE from 'three';
import type { Fx, RenderCtx, Env } from './api';
import type { WeatherKind } from '../sim/types';
import { PAL, mix } from './palette';
import { makeSpriteAtlas, makeTumblerAtlas, makeCoinEnv, F_SMOKE0, F_SMOKE1, F_PUFF, F_GLOW, F_STAR, F_STAR8, F_MOTE, F_HEART, T_PAPER, T_SEQUIN } from './fx/atlas';
import { SpriteLayer, K_GENERIC, K_SMOKE, M_FACE, S_PULSE, S_POP, S_GROW, A_THIN } from './fx/sprites';
import { Coins } from './fx/coins';
import { Tumblers, TB_CONFETTI } from './fx/tumblers';
import { Birds } from './fx/birds';
import { Weather } from './fx/weather';
import { Atmos } from './fx/atmos';
import { type FxFrame, TAU, rand, lin, linList, lightTint, densityOf, worldRateOf } from './fx/util';

export interface FxStats {
  soft: number; crisp: number; glow: number; coins: number; tumblers: number; birds: number;
  emitters: number; weather: WeatherKind; flash: number; worldRate: number;
}
/** The Fx contract plus a few handles for the dev gallery and tests. */
export interface FxDev extends Fx {
  stats(): FxStats;
  /** switch weather with no cross-fade and fill the sky at once */
  setWeatherNow(kind: WeatherKind): void;
  /** force a lightning strike now (any weather) */
  strike(): void;
  /** send a flock of birds across now; a short reach brings them into view sooner */
  birds(reach?: number): void;
  /** drop every particle, then refill the sky and the motes as if just loaded */
  reset(): void;
}

const DUST = mix(PAL.dirt, PAL.parchment, 0.45);
const SMOKE_COLS = linList([mix(PAL.wax, PAL.plasterGrey, 0.45), mix(PAL.wax, PAL.plasterGrey, 0.75), mix(PAL.plaster, PAL.slate, 0.12)]);
const SOOT_COLS = linList([mix(PAL.soot, PAL.iron, 0.4), mix(PAL.soot, PAL.slateDark, 0.5)]);
const HEART_COLS = linList([PAL.crimson, mix(PAL.crimson, PAL.parchment, 0.22), mix(PAL.crimson, PAL.parchment, 0.4)]);
const CONFETTI_COLS = linList([PAL.crimson, PAL.gold, PAL.lapis, PAL.verdigris, PAL.parchment, PAL.clothPlum, PAL.clothTeal, PAL.clothOchre]);
const GOLD_HOT = (() => { const g = lin(PAL.gold); return new Float32Array([g[0] * 1.9, g[1] * 1.75, g[2] * 1.4]); })();

interface Emitter { x: number; y: number; z: number; rate: number; dark: boolean; acc: number; alive: boolean }

export function createFx(ctx: RenderCtx): Fx {
  return createFxDev(ctx);
}

export function createFxDev(ctx: RenderCtx): FxDev {
  const root = new THREE.Group();
  root.name = 'fx';
  root.matrixAutoUpdate = false;
  ctx.scene.add(root);

  const light = new THREE.Color(1, 1, 1);
  /** shared by the sprite layers: world units per pixel at unit depth */
  const px = { value: 0.001 };
  const vp = new THREE.Vector4();
  const atlas = makeSpriteAtlas();
  const tAtlas = makeTumblerAtlas();
  const coinEnv = makeCoinEnv();

  const soft = new SpriteLayer(2400, atlas, light, THREE.NormalBlending, 20, 64, px);
  const crisp = new SpriteLayer(4400, atlas, light, THREE.NormalBlending, 21, 64, px);
  const glow = new SpriteLayer(2600, atlas, light, THREE.AdditiveBlending, 22, 1400, px);
  const coins = new Coins(560, coinEnv);
  const tumblers = new Tumblers(640, tAtlas);
  const flock = new Birds(mix(PAL.ink, PAL.slateDark, 0.35));
  const weather = new Weather(soft, crisp, glow);
  const atmos = new Atmos(glow, tumblers, flock, weather);
  root.add(soft.mesh, crisp.mesh, glow.mesh, coins.mesh, tumblers.mesh, flock.mesh);

  const emitters: Emitter[] = [];
  const scratch = new THREE.Color();
  const one = new Float32Array(3);

  const frame: FxFrame = {
    env: ctx.env, dtR: 0, dtW: 0, density: densityOf(ctx.quality), windX: 1, windZ: 0, windS: 0.5,
    camX: 0, camY: 10, camZ: 10, flash: 0, day: 1,
  };
  let started = false;
  let pendingWeather: WeatherKind | null = null;
  let lastEnvWeather: WeatherKind | null = null;
  let worldRate = 1;

  function linOf(hex: number): Float32Array {
    scratch.setHex(hex);
    one[0] = scratch.r; one[1] = scratch.g; one[2] = scratch.b;
    return one;
  }

  // ───────────── one-shots ─────────────

  function coinsFn(from: THREE.Vector3, to: THREE.Vector3, count: number): void {
    coins.add(from, to, Math.max(1, Math.min(40, Math.round(count))));
  }

  function puff(at: THREE.Vector3, color?: number, count?: number): void {
    const n = Math.max(1, Math.min(48, Math.round(count ?? 10)));
    const c = linOf(color ?? DUST);
    const sc = 0.8 + 0.25 * Math.sqrt(n / 10);
    for (let k = 0; k < n; k++) {
      const i = soft.spawn(K_GENERIC, k % 3 === 0 ? F_SMOKE1 : F_PUFF, M_FACE, false);
      if (i < 0) return;
      // most skirt outward along the ground and climb a little, the rest billow
      // up in the middle so it reads as one cloud rather than a wreath
      const core = k % 5 < 2;
      const a = (k / n) * TAU + rand(-0.5, 0.5), sp = core ? rand(0.1, 0.4) : rand(0.6, 1.4);
      soft.pos(i, at.x + Math.cos(a) * 0.12, at.y + rand(0, 0.1), at.z + Math.sin(a) * 0.12);
      soft.vel(i, Math.cos(a) * sp, core ? rand(0.6, 1.0) : rand(0.25, 0.65), Math.sin(a) * sp);
      soft.drag[i] = core ? 2.4 : 3.2; soft.grav[i] = 0.15;
      soft.size(i, rand(0.18, 0.26) * sc, (core ? rand(0.7, 0.95) : rand(0.5, 0.78)) * sc, 1);
      soft.rot[i] = Math.random() * TAU; soft.rotV[i] = rand(-1, 1);
      const v = rand(0.9, 1.08);
      soft.r[i] = c[0] * v; soft.g[i] = c[1] * v; soft.b[i] = c[2] * v; soft.a[i] = rand(0.5, 0.68); soft.tint[i] = 1;
      soft.fade(i, rand(0.75, 1.15), 0.04, 0.6);
    }
  }

  function sparkle(at: THREE.Vector3, color?: number): void {
    const c = linOf(color ?? PAL.gold);
    // additive light lands on green grass: lean the core toward amber so the
    // sum still reads as gold, not lime
    const cr = c[0] * 1.5 + 0.7, cg = c[1] * 1.15 + 0.32, cb = c[2] * 0.9 + 0.1;
    let i = glow.spawn(K_GENERIC, F_GLOW, M_FACE, false);
    if (i >= 0) {
      glow.pos(i, at.x, at.y, at.z);
      glow.size(i, 0, 1.1, 1); glow.smode[i] = S_PULSE;
      glow.r[i] = cr; glow.g[i] = cg; glow.b[i] = cb; glow.a[i] = 0.6; glow.tint[i] = 0;
      glow.fade(i, 0.38, 0, 0);
    }
    for (let k = 0; k < 13; k++) {
      i = glow.spawn(K_GENERIC, k % 3 === 0 ? F_STAR8 : F_STAR, M_FACE, false);
      if (i < 0) return;
      const a = Math.random() * TAU, sp = rand(0.5, 1.3);
      glow.pos(i, at.x + Math.cos(a) * 0.08, at.y + rand(-0.05, 0.1), at.z + Math.sin(a) * 0.08);
      glow.vel(i, Math.cos(a) * sp, rand(0.4, 1.4), Math.sin(a) * sp);
      glow.drag[i] = 2.2; glow.grav[i] = 0.1;
      glow.size(i, 0, rand(0.16, 0.32), 1); glow.smode[i] = S_PULSE;
      glow.rot[i] = Math.random() * TAU; glow.rotV[i] = rand(-3, 3);
      glow.r[i] = cr; glow.g[i] = cg; glow.b[i] = cb; glow.a[i] = 1; glow.tint[i] = 0;
      glow.fade(i, rand(0.7, 1.3), 0, 0.2);
      glow.twA[i] = 0.5; glow.twF[i] = rand(14, 22);
      glow.age[i] = -rand(0, 0.15);
    }
    for (let k = 0; k < 14; k++) {
      i = glow.spawn(K_GENERIC, F_MOTE, M_FACE, false);
      if (i < 0) return;
      glow.pos(i, at.x + rand(-0.25, 0.25), at.y + rand(-0.1, 0.2), at.z + rand(-0.25, 0.25));
      glow.vel(i, rand(-0.3, 0.3), rand(0.3, 0.9), rand(-0.3, 0.3));
      glow.drag[i] = 1;
      glow.size(i, 0.07, 0.02, 1);
      glow.r[i] = cr; glow.g[i] = cg; glow.b[i] = cb; glow.a[i] = 0.9; glow.tint[i] = 0;
      glow.fade(i, rand(0.6, 1.2), 0, 0.5);
      glow.twA[i] = 0.6; glow.twF[i] = rand(20, 34);
    }
  }

  function hearts(at: THREE.Vector3): void {
    for (let k = 0; k < 6; k++) {
      const i = crisp.spawn(K_GENERIC, F_HEART, M_FACE, false);
      if (i < 0) return;
      const a = Math.random() * TAU, r = rand(0.04, 0.18);
      crisp.pos(i, at.x + Math.cos(a) * r, at.y + rand(0, 0.1), at.z + Math.sin(a) * r);
      crisp.vel(i, rand(-0.12, 0.12), rand(0.45, 0.8), rand(-0.12, 0.12));
      crisp.drag[i] = 0.5;
      crisp.swayA[i] = rand(0.25, 0.4); crisp.swayF[i] = rand(2.5, 3.5);
      crisp.size(i, 0, rand(0.2, 0.28), 1); crisp.smode[i] = S_POP;
      crisp.rot[i] = rand(-0.3, 0.3); crisp.rotV[i] = rand(-0.3, 0.3);
      const c = Math.floor(Math.random() * 3) * 3;
      crisp.r[i] = HEART_COLS[c] * 1.35; crisp.g[i] = HEART_COLS[c + 1] * 1.35; crisp.b[i] = HEART_COLS[c + 2] * 1.35;
      crisp.a[i] = 1; crisp.tint[i] = 0.35;
      crisp.fade(i, rand(1.5, 2.1), 0, 0.35);
      crisp.age[i] = -k * rand(0.08, 0.14);
    }
  }

  function confetti(at: THREE.Vector3): void {
    for (let k = 0; k < 80; k++) {
      const seq = Math.random() < 0.2;
      const i = tumblers.spawn(TB_CONFETTI, seq ? T_SEQUIN : T_PAPER, false);
      if (i < 0) break;
      const a = Math.random() * TAU, hs = rand(0.5, 2.2);
      tumblers.x[i] = at.x + rand(-0.1, 0.1); tumblers.y[i] = at.y + rand(0, 0.15); tumblers.z[i] = at.z + rand(-0.1, 0.1);
      tumblers.vx[i] = Math.cos(a) * hs; tumblers.vy[i] = rand(2.6, 4.8); tumblers.vz[i] = Math.sin(a) * hs;
      tumblers.grav[i] = -5.5; tumblers.drag[i] = 0.9; tumblers.term[i] = rand(0.5, 0.8);
      tumblers.swayA[i] = rand(0.3, 0.6); tumblers.swayF[i] = rand(1.5, 3); tumblers.windR[i] = 0.3;
      tumblers.wx[i] = rand(6, 14) * (Math.random() < 0.5 ? -1 : 1); tumblers.wy[i] = rand(-4, 4); tumblers.wz[i] = rand(-8, 8);
      const w = seq ? rand(0.09, 0.11) : rand(0.11, 0.15);
      tumblers.w[i] = w; tumblers.h[i] = seq ? w : w * rand(0.45, 0.7);
      const c = Math.floor(Math.random() * 8) * 3;
      tumblers.r[i] = CONFETTI_COLS[c]; tumblers.g[i] = CONFETTI_COLS[c + 1]; tumblers.b[i] = CONFETTI_COLS[c + 2];
      tumblers.linger[i] = rand(2.5, 4);
    }
    // a pop of gold at the burst
    for (let k = 0; k < 8; k++) {
      const i = glow.spawn(K_GENERIC, F_STAR, M_FACE, false);
      if (i < 0) break;
      const a = Math.random() * TAU, sp = rand(0.8, 1.8);
      glow.pos(i, at.x, at.y + 0.1, at.z);
      glow.vel(i, Math.cos(a) * sp, rand(1, 2.2), Math.sin(a) * sp);
      glow.drag[i] = 2.5;
      glow.size(i, 0, rand(0.18, 0.3), 1); glow.smode[i] = S_PULSE;
      glow.rot[i] = Math.random() * TAU; glow.rotV[i] = rand(-3, 3);
      glow.col(i, GOLD_HOT, 0, 1, 0);
      glow.fade(i, rand(0.6, 0.9), 0, 0.2);
    }
  }

  // ───────────── chimney smoke ─────────────

  function smokePuff(em: Emitter, shred: number): void {
    const i = soft.spawn(K_SMOKE, Math.random() < 0.5 ? F_SMOKE0 : F_SMOKE1, M_FACE, true);
    if (i < 0) return;
    const dark = em.dark;
    soft.pos(i, em.x + rand(-0.03, 0.03), em.y, em.z + rand(-0.03, 0.03));
    soft.vel(i, rand(-0.04, 0.04), dark ? rand(0.5, 0.66) : rand(0.36, 0.48), rand(-0.04, 0.04));
    soft.drag[i] = 0.2;
    soft.wind[i] = dark ? 0.45 : 0.55;
    soft.swayA[i] = rand(0.05, 0.1); soft.swayF[i] = rand(0.8, 1.4);
    if (dark) soft.size(i, rand(0.16, 0.2), rand(0.95, 1.2), 1);
    else soft.size(i, rand(0.1, 0.14), rand(0.6, 0.82), 1);
    soft.smode[i] = S_GROW;
    soft.rot[i] = Math.random() * TAU; soft.rotV[i] = rand(-0.4, 0.4);
    if (dark) soft.col(i, SOOT_COLS, Math.floor(Math.random() * 2) * 3, rand(0.75, 0.9), 1);
    else soft.col(i, SMOKE_COLS, Math.floor(Math.random() * 3) * 3, rand(0.55, 0.7), 1);
    soft.amode[i] = A_THIN;
    // a hard wind shreds smoke sooner instead of dragging it across the town
    soft.fade(i, (dark ? rand(4.2, 5.5) : rand(4, 5.4)) * shred, 0.06, 0);
  }

  function smoke(at: THREE.Vector3, opts?: { dark?: boolean; rate?: number }) {
    const em: Emitter = { x: at.x, y: at.y, z: at.z, rate: Math.max(0, opts?.rate ?? 1), dark: !!opts?.dark, acc: Math.random(), alive: true };
    emitters.push(em);
    return {
      stop(): void {
        if (!em.alive) return;
        em.alive = false;
        const k = emitters.indexOf(em);
        if (k >= 0) { emitters[k] = emitters[emitters.length - 1]; emitters.pop(); }
      },
      move(p: THREE.Vector3): void { em.x = p.x; em.y = p.y; em.z = p.z; },
    };
  }

  // ───────────── frame ─────────────

  function update(env: Env): void {
    frame.env = env;
    const dt = Math.max(0, Math.min(0.1, env.dt || 0));
    frame.dtR = dt;
    const goal = worldRateOf(env.speed);
    worldRate += (goal - worldRate) * Math.min(1, dt * 5);
    frame.dtW = dt * worldRate;
    frame.density = densityOf(ctx.quality);
    const ang = 0.35 + 0.3 * Math.sin(env.time * 0.031) + 0.12 * Math.sin(env.time * 0.11);
    frame.windX = Math.cos(ang); frame.windZ = Math.sin(ang);
    frame.windS = (0.25 + 1.6 * env.wind) * (1 + 0.6 * weather.stormy());
    const cm = ctx.camera.matrixWorld.elements;
    frame.camX = cm[12]; frame.camY = cm[13]; frame.camZ = cm[14];
    frame.day = 1 - env.night;
    const r = ctx.renderer;
    const vh = Math.max(1, r.getViewport(vp).w * r.getPixelRatio());
    px.value = (2 * Math.tan((ctx.camera.fov * Math.PI) / 360)) / (vh * (ctx.camera.zoom || 1));

    if (!started) {
      started = true;
      lastEnvWeather = env.weather;
      weather.set(pendingWeather ?? env.weather ?? 'clear', true, frame);
      atmos.prewarm(frame);
    } else if (env.weather !== lastEnvWeather) {
      lastEnvWeather = env.weather;
      if (env.weather) weather.set(env.weather, false, null);
    }

    weather.update(frame);
    frame.flash = weather.flash;
    api.flash = weather.flash;
    lightTint(env, weather.flash, weather.overcast(), light);

    atmos.update(frame);
    // a strong wind pulls the puffs apart: emit more often so the plume stays one plume
    const smokeScale = (0.55 + 0.45 * frame.density) * (0.75 + 0.55 * frame.windS);
    const shred = 1 / (1 + 0.32 * Math.max(0, frame.windS - 0.7));
    for (let k = 0; k < emitters.length; k++) {
      const em = emitters[k];
      em.acc += (em.dark ? 5 : 2.6) * em.rate * smokeScale * frame.dtW;
      while (em.acc >= 1) { em.acc -= 1; smokePuff(em, shred); }
    }
    coins.update(frame, glow);
    soft.update(frame);
    crisp.update(frame);
    glow.update(frame);
    tumblers.update(frame);
    flock.update(frame);
    flock.mesh.castShadow = ctx.quality !== 'low';
  }

  const api: FxDev = {
    coins: coinsFn, puff, sparkle, hearts, confetti, smoke,
    setWeather(kind: WeatherKind): void {
      if (!started) { pendingWeather = kind; return; }
      weather.set(kind, false, null);
    },
    setWeatherNow(kind: WeatherKind): void {
      if (!started) { pendingWeather = kind; return; }
      weather.set(kind, true, frame);
    },
    strike(): void { weather.strike(); },
    birds(reach = 30): void { flock.launch(5, reach); },
    reset(): void {
      soft.clear(); crisp.clear(); glow.clear(); coins.clear(); tumblers.clear(); flock.clear();
      if (started) { weather.prewarm(frame); atmos.prewarm(frame); }
    },
    flash: 0,
    update,
    stats(): FxStats {
      return {
        soft: soft.n, crisp: crisp.n, glow: glow.n, coins: coins.active, tumblers: tumblers.active, birds: flock.flocks,
        emitters: emitters.length, weather: weather.kind, flash: weather.flash, worldRate,
      };
    },
    dispose(): void {
      soft.dispose(); crisp.dispose(); glow.dispose(); coins.dispose(); tumblers.dispose(); flock.dispose();
      atlas.dispose(); tAtlas.dispose(); coinEnv.dispose();
      root.removeFromParent();
      emitters.length = 0;
    },
  };
  return api;
}
