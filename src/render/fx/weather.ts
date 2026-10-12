/**
 * Weather over the realm board (never over the rest of the table): rain,
 * storm with lightning, snow, hail, fog, heat shimmer, clear. Each kind has
 * an intensity that eases toward its target, so changes cross-fade: the rain
 * thins while the snow arrives. Spawning runs on world time (paused, the
 * weather hangs almost still); the lightning flash decays on real time.
 */
import type { WeatherKind } from '../../sim/types';
import { PAL, mix } from '../palette';
import { F_STREAK, F_RING, F_DROPS, F_DOT, F_FLAKE, F_HAIL, F_FOG, F_MOTE, F_BOLT, F_GLOW } from './atlas';
import {
  type SpriteLayer, K_GENERIC, K_RAIN, M_FACE, M_STREAK, M_FLAT, S_CONST, S_GROW, G_DIE, G_SETTLE, G_BOUNCE,
} from './sprites';
import { type FxFrame, BOARD_HX, BOARD_HZ, TAU, rand, lin, linList, clamp01 } from './util';

const KINDS: WeatherKind[] = ['clear', 'rain', 'storm', 'snow', 'heat', 'fog', 'hail'];
const W_RAIN = 1, W_STORM = 2, W_SNOW = 3, W_HEAT = 4, W_FOG = 5, W_HAIL = 6;

const RAIN_COL = linList([mix(PAL.snow, PAL.water, 0.32)]);
const SNOW_COL = linList([PAL.snow]);
const HAIL_COL = linList([mix(PAL.snow, PAL.slate, 0.1)]);
const FOG_ARR = new Float32Array(lin(mix(PAL.snow, PAL.slate, 0.16)));
const HEAT_COL = linList([mix(PAL.parchment, PAL.flameCore, 0.5)]);
const HAZE_ARR = new Float32Array(lin(mix(PAL.parchment, PAL.flameCore, 0.35)));
const BOLT_CORE: [number, number, number] = [2.4, 2.6, 3.2];
const BOLT_HALO: [number, number, number] = [0.55, 0.68, 1.0];

const MAX_BOLT = 18, MAX_BRANCH = 7;

export class Weather {
  /** current intensity per kind, 0..1 (index into KINDS) */
  readonly w = new Float32Array(KINDS.length);
  private target = 0;
  private acc = new Float32Array(10);
  flash = 0;
  // lightning
  private nextStrike = 4;
  private pulseT = new Float32Array(3);
  private pulseA = new Float32Array(3);
  private sinceStrike = 99;
  private bolt = new Float32Array((MAX_BOLT + 1) * 3);
  private boltN = 0;
  private branch = new Float32Array((MAX_BRANCH + 1) * 3);
  private branchN = 0;
  private strikeX = 0; private strikeZ = 0; private boltTopY = 8.5;
  private forced = false;

  constructor(private soft: SpriteLayer, private crisp: SpriteLayer, private glow: SpriteLayer) {
    crisp.onSplash = (x, z) => this.splash(x, z);
  }

  get kind(): WeatherKind { return KINDS[this.target]; }

  set(kind: WeatherKind, instant: boolean, f: FxFrame | null): void {
    const k = Math.max(0, KINDS.indexOf(kind));
    this.target = k;
    if (instant) {
      for (let j = 0; j < this.w.length; j++) this.w[j] = j === k ? 1 : 0;
      if (f) this.prewarm(f);
    }
  }

  /** a grey, cool cast for the light while the sky is busy, 0..1 */
  overcast(): number {
    const w = this.w;
    return clamp01(w[W_RAIN] * 0.8 + w[W_STORM] + w[W_SNOW] * 0.5 + w[W_HAIL] * 0.8 + w[W_FOG] * 0.55);
  }
  /** how wet / wild it is (birds and fireflies stay home) */
  wet(): number {
    const w = this.w;
    return clamp01(w[W_RAIN] + w[W_STORM] + w[W_SNOW] * 0.7 + w[W_HAIL]);
  }
  stormy(): number { return this.w[W_STORM]; }

  /** strike now (dev and tests) */
  strike(): void { this.forced = true; }

  // ───────────── spawners ─────────────

  private rain(f: FxFrame, y0: number, heavy: number): void {
    const L = this.crisp;
    const i = L.spawn(K_RAIN, F_STREAK, M_STREAK, true);
    if (i < 0) return;
    const sp = rand(11.5, 13.5) + heavy * 3.5;
    const slant = (0.6 + 2.2 * f.env.wind) * (1 + heavy * 0.7);
    const T = y0 / sp;
    // pick where it lands, then start it upwind so it lands on the board
    const lx = rand(-BOARD_HX, BOARD_HX), lz = rand(-BOARD_HZ, BOARD_HZ);
    L.pos(i, lx - f.windX * slant * T, y0, lz - f.windZ * slant * T);
    L.vel(i, f.windX * slant, -sp, f.windZ * slant);
    L.size(i, rand(0.03, 0.044), 0, 1);
    L.smode[i] = S_CONST;
    L.len[i] = 0.05 + heavy * 0.015;
    L.col(i, RAIN_COL, 0, rand(0.4, 0.54) + heavy * 0.06, 1);
    L.fade(i, T + 0.2, Math.min(0.5, 0.1 / (T + 0.2)), 0);
    L.ground[i] = G_DIE;
  }

  private splash(x: number, z: number): void {
    const L = this.crisp;
    if (Math.random() < 0.5) {
      const i = L.spawn(K_GENERIC, F_RING, M_FLAT, true);
      if (i >= 0) {
        L.pos(i, x, 0.02, z);
        L.size(i, 0.03, rand(0.16, 0.26), 1);
        L.smode[i] = S_GROW;
        L.col(i, RAIN_COL, 0, 0.42, 1);
        L.fade(i, rand(0.25, 0.35), 0, 0.7);
      }
    }
    if (Math.random() < 0.28) {
      const i = L.spawn(K_GENERIC, F_DROPS, M_FACE, true);
      if (i >= 0) {
        L.pos(i, x, 0.04, z);
        L.vel(i, 0, 0.35, 0);
        L.grav[i] = -2.5;
        L.size(i, 0.07, 0.13, 0.8);
        L.col(i, RAIN_COL, 0, 0.5, 1);
        L.fade(i, 0.2, 0, 0.6);
      }
    }
  }

  private snow(f: FxFrame, y0: number): void {
    const L = this.crisp;
    const big = Math.random() < 0.18;
    const i = L.spawn(K_GENERIC, big ? F_FLAKE : F_DOT, M_FACE, true);
    if (i < 0) return;
    const sp = rand(0.45, 0.85);
    const T = y0 / sp;
    const drift = f.windS * 0.5 * T;
    L.pos(i, rand(-BOARD_HX, BOARD_HX) - f.windX * drift, y0, rand(-BOARD_HZ, BOARD_HZ) - f.windZ * drift);
    L.vel(i, 0, -sp, 0);
    const s = big ? rand(0.13, 0.19) : rand(0.06, 0.115);
    L.size(i, s, s, 1);
    L.smode[i] = S_CONST;
    L.rot[i] = Math.random() * TAU; L.rotV[i] = rand(-0.8, 0.8);
    L.col(i, SNOW_COL, 0, rand(0.7, 0.95), 0.92);
    L.fade(i, T + 2, 0.08, 0);
    L.swayA[i] = rand(0.2, 0.42); L.swayF[i] = rand(0.9, 1.8);
    L.wind[i] = 0.5;
    L.ground[i] = G_SETTLE; L.linger[i] = rand(1.4, 2.6);
    L.bound[i] = 1;
  }

  private hail(f: FxFrame, y0: number): void {
    const L = this.crisp;
    const i = L.spawn(K_GENERIC, F_HAIL, M_STREAK, true);
    if (i < 0) return;
    const sp = rand(8, 10.5);
    const slant = 0.4 + 1.2 * f.env.wind;
    const T = y0 / sp;
    L.pos(i, rand(-BOARD_HX, BOARD_HX) - f.windX * slant * T, y0, rand(-BOARD_HZ, BOARD_HZ) - f.windZ * slant * T);
    L.vel(i, f.windX * slant, -sp, f.windZ * slant);
    L.grav[i] = -9;
    const s = rand(0.05, 0.075);
    L.size(i, s, s, 1);
    L.smode[i] = S_CONST;
    L.len[i] = 0.022;
    L.col(i, HAIL_COL, 0, 0.95, 0.85);
    L.fade(i, 8, 0.02, 0);
    L.ground[i] = G_BOUNCE; L.linger[i] = rand(0.6, 1.2);
  }

  private fogSheet(ageFrac: number): void {
    const L = this.soft;
    const i = L.spawn(K_GENERIC, F_FOG, M_FLAT, true);
    if (i < 0) return;
    const life = rand(16, 26);
    const lowBias = Math.random() * Math.random();
    L.pos(i, rand(-BOARD_HX + 2, BOARD_HX - 2), 0.12 + lowBias * 1.3, rand(-BOARD_HZ + 1.5, BOARD_HZ - 1.5));
    const w = rand(5, 9);
    L.size(i, w, w, rand(0.5, 0.8));
    L.smode[i] = S_CONST;
    L.rot[i] = Math.random() * TAU; L.rotV[i] = rand(-0.02, 0.02);
    L.col(i, FOG_ARR, 0, rand(0.16, 0.24), 1);
    L.fade(i, life, 0.3, 0.35);
    L.wind[i] = rand(0.12, 0.22);
    L.age[i] = ageFrac * life;
  }

  private fogWisp(ageFrac: number): void {
    const L = this.soft;
    const i = L.spawn(K_GENERIC, F_FOG, M_FACE, true);
    if (i < 0) return;
    const life = rand(10, 18);
    L.pos(i, rand(-BOARD_HX + 1, BOARD_HX - 1), rand(0.25, 0.9), rand(-BOARD_HZ + 1, BOARD_HZ - 1));
    const w = rand(1.6, 3.2);
    L.size(i, w, w, rand(0.4, 0.6));
    L.smode[i] = S_CONST;
    L.rot[i] = rand(-0.2, 0.2);
    L.col(i, FOG_ARR, 0, rand(0.08, 0.14), 1);
    L.fade(i, life, 0.3, 0.35);
    L.wind[i] = rand(0.15, 0.3);
    L.age[i] = ageFrac * life;
  }

  /** a pale wavering mote rising off the baked ground */
  private heat(ageFrac: number): void {
    const L = this.glow;
    const i = L.spawn(K_GENERIC, F_MOTE, M_STREAK, true);
    if (i < 0) return;
    const life = rand(3.5, 6);
    const vy = rand(0.3, 0.6);
    const age = ageFrac * life;
    L.pos(i, rand(-BOARD_HX, BOARD_HX), rand(0.02, 0.25) + vy * age, rand(-BOARD_HZ, BOARD_HZ));
    L.vel(i, 0, vy, 0);
    L.size(i, rand(0.06, 0.09), 0, 1);
    L.smode[i] = S_CONST;
    L.len[i] = 0.55;
    L.col(i, HEAT_COL, 0, rand(0.5, 0.8), 0);
    L.fade(i, life, 0.25, 0.45);
    L.twA[i] = 0.55; L.twF[i] = rand(4, 8);
    L.swayA[i] = rand(0.35, 0.6); L.swayF[i] = rand(3, 5);
    L.bound[i] = 1;
    L.age[i] = age;
  }

  /** a thin sun-bleached haze lying just over the board */
  private haze(ageFrac: number): void {
    const L = this.soft;
    const i = L.spawn(K_GENERIC, F_FOG, M_FLAT, true);
    if (i < 0) return;
    const life = rand(12, 20);
    L.pos(i, rand(-BOARD_HX + 2, BOARD_HX - 2), rand(0.05, 0.4), rand(-BOARD_HZ + 1.5, BOARD_HZ - 1.5));
    const w = rand(5, 8);
    L.size(i, w, w, rand(0.55, 0.85));
    L.smode[i] = S_CONST;
    L.rot[i] = Math.random() * TAU; L.rotV[i] = rand(-0.03, 0.03);
    L.col(i, HAZE_ARR, 0, rand(0.08, 0.13), 0.6);
    L.fade(i, life, 0.3, 0.35);
    L.wind[i] = rand(0.05, 0.12);
    L.swayA[i] = rand(0.08, 0.15); L.swayF[i] = rand(0.4, 0.8);
    L.age[i] = ageFrac * life;
  }

  /** fill the sky at once (a loaded game, a sudden change of scene) */
  prewarm(f: FxFrame): void {
    const d = f.density, w = this.w;
    const rainN = Math.round(900 * d * (w[W_RAIN] + 1.7 * w[W_STORM]));
    const heavy = w[W_STORM] / Math.max(0.001, w[W_RAIN] + w[W_STORM]);
    for (let k = 0; k < rainN; k++) this.rain(f, rand(0.2, 7.2), heavy);
    const snowN = Math.round(900 * d * w[W_SNOW]);
    for (let k = 0; k < snowN; k++) this.snow(f, rand(0.1, 6.5));
    const hailN = Math.round(420 * d * w[W_HAIL]);
    for (let k = 0; k < hailN; k++) this.hail(f, rand(0.3, 7));
    const fogN = Math.round(34 * Math.sqrt(d) * w[W_FOG]);
    for (let k = 0; k < fogN; k++) this.fogSheet(Math.random());
    for (let k = 0; k < fogN * 0.5; k++) this.fogWisp(Math.random());
    const heatN = Math.round(300 * d * w[W_HEAT]);
    for (let k = 0; k < heatN; k++) this.heat(Math.random());
    const hazeN = Math.round(20 * Math.sqrt(d) * w[W_HEAT]);
    for (let k = 0; k < hazeN; k++) this.haze(Math.random());
  }

  // ───────────── lightning ─────────────

  private buildBolt(): void {
    const px = rand(-BOARD_HX + 3, BOARD_HX - 3), pz = rand(-BOARD_HZ + 2.5, BOARD_HZ - 2.5);
    this.strikeX = px; this.strikeZ = pz;
    const topY = this.boltTopY = rand(7.5, 9.5);
    const tx = px + rand(-2.2, 2.2), tz = pz + rand(-2.2, 2.2);
    const N = MAX_BOLT;
    let ox = 0, oz = 0;
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      // a random walk that is pinned to the strike point at the bottom
      ox = ox * 0.55 + rand(-0.55, 0.55);
      oz = oz * 0.55 + rand(-0.55, 0.55);
      const pin = k === 0 || k === N ? 0 : Math.sin(Math.PI * t);
      const b = this.bolt, o = k * 3;
      b[o] = tx + (px - tx) * t + ox * pin;
      b[o + 1] = topY * (1 - t);
      b[o + 2] = tz + (pz - tz) * t + oz * pin;
    }
    this.boltN = N + 1;
    // one fork, peeling off part way down
    const from = 4 + Math.floor(Math.random() * 5);
    const b = this.bolt, br = this.branch;
    let bx = b[from * 3], by = b[from * 3 + 1], bz = b[from * 3 + 2];
    const ang = Math.random() * TAU, dxs = Math.cos(ang), dzs = Math.sin(ang);
    br[0] = bx; br[1] = by; br[2] = bz;
    for (let k = 1; k <= MAX_BRANCH; k++) {
      bx += dxs * rand(0.3, 0.6) + rand(-0.25, 0.25);
      bz += dzs * rand(0.3, 0.6) + rand(-0.25, 0.25);
      by -= rand(0.35, 0.6);
      br[k * 3] = bx; br[k * 3 + 1] = Math.max(0.3, by); br[k * 3 + 2] = bz;
    }
    this.branchN = MAX_BRANCH + 1;
  }

  private beginStrike(): void {
    this.buildBolt();
    this.sinceStrike = 0;
    this.pulseT[0] = 0; this.pulseA[0] = 1;
    this.pulseT[1] = rand(0.07, 0.12); this.pulseA[1] = rand(0.5, 0.75);
    this.pulseT[2] = rand(0.18, 0.3); this.pulseA[2] = Math.random() < 0.6 ? rand(0.25, 0.45) : 0;
    // sparks where it lands
    const L = this.glow;
    for (let k = 0; k < 10; k++) {
      const i = L.spawn(K_GENERIC, F_MOTE, M_FACE, false);
      if (i < 0) break;
      const a = Math.random() * TAU, sp = rand(0.8, 2.2);
      L.pos(i, this.strikeX, 0.08, this.strikeZ);
      L.vel(i, Math.cos(a) * sp, rand(1.0, 2.6), Math.sin(a) * sp);
      L.grav[i] = -6;
      L.size(i, 0.08, 0.02, 1);
      L.col(i, BOLT_CORE, 0, 1, 0);
      L.fade(i, rand(0.3, 0.55), 0, 0.5);
    }
  }

  private drawPolyline(pts: Float32Array, n: number, bright: number, core: number, halo: number): void {
    const L = this.glow;
    for (let k = 1; k < n; k++) {
      const a = (k - 1) * 3, b = k * 3;
      const hx = pts[b], hy = pts[b + 1], hz = pts[b + 2];
      const tx = hx - pts[a], ty = hy - pts[a + 1], tz = hz - pts[a + 2];
      L.push(hx, hy, hz, tx, ty, tz, halo, halo * 0.5, 0, BOLT_HALO[0] * bright, BOLT_HALO[1] * bright, BOLT_HALO[2] * bright, 0.5, F_BOLT, M_STREAK, 0);
      L.push(hx, hy, hz, tx, ty, tz, core, core * 0.5, 0, BOLT_CORE[0] * bright, BOLT_CORE[1] * bright, BOLT_CORE[2] * bright, 1, F_BOLT, M_STREAK, 0);
    }
  }

  // ───────────── frame ─────────────

  update(f: FxFrame): void {
    // cross-fade intensities (real time, so a change reads even while paused)
    const w = this.w;
    const step = f.dtR * 0.4;
    for (let k = 0; k < w.length; k++) {
      const goal = k === this.target ? 1 : 0;
      w[k] = w[k] < goal ? Math.min(goal, w[k] + step) : Math.max(goal, w[k] - step);
    }
    const d = f.density, dt = f.dtW, acc = this.acc;

    // rain and storm share the streaks
    const rainAmt = w[W_RAIN] + 1.7 * w[W_STORM];
    if (rainAmt > 0.001) {
      const heavy = w[W_STORM] / Math.max(0.001, w[W_RAIN] + w[W_STORM]);
      const live = 900 * d * rainAmt;
      acc[0] += (live / 0.52) * dt;
      while (acc[0] >= 1) { acc[0] -= 1; this.rain(f, rand(5, 7.5), heavy); }
    }
    if (w[W_SNOW] > 0.001) {
      acc[1] += (900 * d * w[W_SNOW] / 7.5) * dt;
      while (acc[1] >= 1) { acc[1] -= 1; this.snow(f, rand(4.5, 6.5)); }
    }
    if (w[W_HAIL] > 0.001) {
      acc[2] += (420 * d * w[W_HAIL] / 0.75) * dt;
      while (acc[2] >= 1) { acc[2] -= 1; this.hail(f, rand(5, 7.5)); }
    }
    if (w[W_FOG] > 0.001) {
      const n = 34 * Math.sqrt(d) * w[W_FOG];
      acc[3] += (n / 21) * dt;
      while (acc[3] >= 1) { acc[3] -= 1; this.fogSheet(0); }
      acc[4] += (n * 0.5 / 14) * dt;
      while (acc[4] >= 1) { acc[4] -= 1; this.fogWisp(0); }
    }
    if (w[W_HEAT] > 0.001) {
      acc[5] += (300 * d * w[W_HEAT] / 4.75) * dt;
      while (acc[5] >= 1) { acc[5] -= 1; this.heat(0); }
      acc[6] += (20 * Math.sqrt(d) * w[W_HEAT] / 16) * dt;
      while (acc[6] >= 1) { acc[6] -= 1; this.haze(0); }
    }

    // lightning
    if (w[W_STORM] > 0.5 || this.forced) {
      this.nextStrike -= dt;
      if (this.nextStrike <= 0 || this.forced) {
        this.forced = false;
        this.beginStrike();
        this.nextStrike = rand(2.8, 8);
      }
    }
    this.sinceStrike += f.dtR;
    const st = this.sinceStrike;
    let fl = 0;
    for (let k = 0; k < 3; k++) {
      const dtp = st - this.pulseT[k];
      if (dtp >= 0 && this.pulseA[k] > 0) fl += this.pulseA[k] * Math.exp(-dtp * 16);
    }
    this.flash = fl > 1 ? 1 : fl < 0.002 ? 0 : fl;
    if (st < 0.36 && this.flash > 0.04) {
      const br = 0.35 + this.flash;
      this.drawPolyline(this.bolt, this.boltN, br, 0.07, 0.5);
      this.drawPolyline(this.branch, this.branchN, br * 0.6, 0.045, 0.32);
      // the ground lights up where it lands, and the sky above it
      this.glow.push(this.strikeX, 0.3, this.strikeZ, 0, 0, 0, 4, 4, 0, BOLT_HALO[0], BOLT_HALO[1], BOLT_HALO[2], this.flash * 0.7, F_GLOW, M_FACE, 0);
      this.glow.push(this.bolt[0], this.boltTopY, this.bolt[2], 0, 0, 0, 9, 6, 0, BOLT_HALO[0], BOLT_HALO[1], BOLT_HALO[2], this.flash * 0.35, F_GLOW, M_FACE, 0);
    }
  }
}
