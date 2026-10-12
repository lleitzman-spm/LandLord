/**
 * OWNER: render-core agent. createRenderer: the stage everything else performs on.
 * A dark room, an oak table, the realm board and its props; the month as a day
 * of light; an orbit camera; tilt-shift and bloom; and the reconcile that keeps
 * the miniature in step with the sim. The pieces live in ./core.
 */
import * as THREE from 'three';
import type {
  Renderer, RendererDeps, RenderCtx, Quality, Tool, SceneMode, AnchorRef, Anchor, PickResult, RendererEvents, Fx, Env, TableProp,
} from './api';
import type { GameState, SimEvent, Id } from '../sim/types';
import { MAP_W, MAP_H, PARCEL } from '../sim/types';
import { PAL } from './palette';
import { createFx } from './fx';
import { createActorLayer } from './actors';
import { createTownLife, type FigureLayer, type LayerHelpers } from './townlife';
import { EnvModel, type Sky } from './core/env';
import { LightRig } from './core/lights';
import { createTable, makeRoomEnv } from './core/table';
import { createProps } from './core/props';
import { createTerrain } from './core/terrain';
import { Post } from './core/post';
import { CameraRig, OVERVIEW_PITCH, type Pose } from './core/camera';
import { createTown, createGhost } from './core/town';
import { createInput } from './core/input';
import { HALF_W, HALF_D } from './core/layout';
import { clamp, damp, lerp, smoothstep, DEG } from './core/util';

export type * from './api';

/** The renderer plus a few handles for dev pages and tests (not part of the contract). */
export interface CoreRenderer extends Renderer {
  debug: {
    env(): Env;
    sky(): Sky;
    pose(): Pose;
    /** jump every eased thing (camera, snow, coin pile) to where it is heading */
    settle(): void;
    /** set the orbit directly: yaw and pitch in degrees */
    view(v: Partial<{ tx: number; tz: number; dist: number; yaw: number; pitch: number }>): void;
    pick(cssX: number, cssY: number): PickResult;
  };
}

const NOOP_LAYER: FigureLayer = { reset() {}, sync() {}, handleEvents() {}, update() {}, positionOf() { return null; }, pick() { return null; }, setSelected() {}, dispose() {} };
const NOOP_FX: Fx = { coins() {}, puff() {}, sparkle() {}, hearts() {}, confetti() {}, smoke() { return { stop() {}, move() {} }; }, setWeather() {}, flash: 0, update() {}, dispose() {} };

const warned = new Set<string>();
function guard<T>(label: string, fn: () => T, fallback: T): T {
  try { return fn(); }
  catch (err) {
    if (!warned.has(label)) { warned.add(label); console.warn('[render] ' + label + ' failed', err); }
    return fallback;
  }
}

export function createRenderer(deps: RendererDeps): CoreRenderer {
  const canvas = deps.canvas;
  let quality: Quality = deps.quality ?? 'high';

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, stencil: false, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.info.autoReset = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAL.room);
  const fog = new THREE.Fog(PAL.room, 90, 240);
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(30, 1.6, 0.5, 420);

  const envModel = new EnvModel();
  const env = envModel.env, sky = envModel.sky;
  const ctx: RenderCtx = { scene, camera, renderer, env, quality };

  // ── the stage ──────────────────────────────────────────────────────────
  const roomEnv = makeRoomEnv(renderer);
  const table = createTable(ctx, roomEnv);
  const props = createProps(ctx, roomEnv);
  const terrain = createTerrain(ctx, roomEnv);
  scene.add(table.group, props.group, terrain.group);
  const lights = new LightRig(scene, quality);
  const rig = new CameraRig(camera);
  const post = new Post(renderer, quality);
  props.setQuality(quality);

  // ── the players (other modules; a failure in one must not darken the table) ──
  const fx: Fx = guard('createFx', () => createFx(ctx), NOOP_FX);
  const town = createTown(ctx, fx);
  const ghost = createGhost(ctx);
  scene.add(town.group, ghost.group);
  const helpers: LayerHelpers = {
    doorOf: id => town.doorOf(id),
    topOf: id => town.topOf(id),
    propPos: prop => props.pos(prop),
  };
  const actorLayer: FigureLayer = guard('createActorLayer', () => createActorLayer(ctx, helpers), NOOP_LAYER);
  const townLayer: FigureLayer = guard('createTownLife', () => createTownLife(ctx, helpers), NOOP_LAYER);

  let state: GameState | null = null;
  let didReset = false;
  let time = 0;
  let cssW = 1, cssH = 1;
  let mode: SceneMode = 'play';
  let disposed = false;
  const coinAt = new Map<Id, number>();
  const size = new THREE.Vector2();
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _ndc = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const raycaster = new THREE.Raycaster();

  // ── events out ─────────────────────────────────────────────────────────
  const listeners: { [K in keyof RendererEvents]: RendererEvents[K][] } = { pick: [], hover: [], place: [], paint: [], clear: [], demolish: [], cancel: [] };
  function emit<K extends keyof RendererEvents>(type: K, ...args: Parameters<RendererEvents[K]>): void {
    for (const cb of listeners[type]) {
      try { (cb as (...a: Parameters<RendererEvents[K]>) => void)(...args); }
      catch (err) { console.error('[render] listener for "' + type + '" threw', err); }
    }
  }

  // ── picking ────────────────────────────────────────────────────────────
  function pickNdc(ndcX: number, ndcY: number): PickResult {
    raycaster.setFromCamera(_ndc.set(ndcX, ndcY), camera);
    const ray = raycaster.ray;
    const bHit = town.pick(raycaster);
    // figures first, unless a building stands in front of them
    let fig: PickResult | null = null, figD = Infinity;
    const aId = guard('actor pick', () => actorLayer.pick(raycaster), null);
    if (aId) {
      const p = guard('actor positionOf', () => actorLayer.positionOf(aId), null);
      figD = p ? Math.max(0, _a.copy(p).sub(ray.origin).dot(ray.direction)) : 0;
      fig = { kind: 'actor', actorId: aId };
    }
    const tId = guard('town pick', () => townLayer.pick(raycaster), null);
    if (tId) {
      const p = guard('town positionOf', () => townLayer.positionOf(tId), null);
      const d = p ? Math.max(0, _a.copy(p).sub(ray.origin).dot(ray.direction)) : 0;
      if (d < figD) { figD = d; fig = { kind: 'townsperson', tenantId: tId }; }
    }
    if (fig && (!bHit || figD <= bHit.distance + 0.4)) return fig;
    if (bHit) return { kind: 'building', buildingId: bHit.id };
    const pHit = props.pick(ray);
    const g = ray.intersectPlane(ground, _b);
    if (g) {
      const tx = Math.floor(g.x + HALF_W), ty = Math.floor(g.z + HALF_D);
      if (tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H) {
        if (pHit && pHit.distance < g.distanceTo(ray.origin)) return { kind: 'prop', prop: pHit.prop };
        const tile = state ? state.map.tiles[ty * MAP_W + tx] : null;
        if (tile && tile.b && town.has(tile.b)) return { kind: 'building', buildingId: tile.b };
        return { kind: 'tile', x: tx, y: ty };
      }
    }
    if (pHit) return { kind: 'prop', prop: pHit.prop };
    return { kind: 'none' };
  }

  const input = createInput(canvas, {
    rig,
    pick: pickNdc,
    emit,
    canPlace: (btype, x, y, rot) => guard('canPlace', () => deps.canPlace(btype, x, y, rot), false),
    state: () => state,
    setMarks: (tiles, color) => terrain.setMarks(tiles, color),
    setGrid: (amount, wx, wz) => terrain.setGrid(amount, wx, wz),
    showHover(hit, style) {
      town.setHover(hit.kind === 'building' ? hit.buildingId : null, style);
      props.setHover(hit.kind === 'prop' ? hit.prop : null);
    },
    ghostShow: (btype, rot, tx, ty, ok) => ghost.show(btype, rot, tx, ty, ok),
    ghostHide: () => ghost.hide(),
    ghostRefuse: () => ghost.refuse(),
  });

  // ── helpers ────────────────────────────────────────────────────────────
  function homeOf(s: GameState): [number, number] {
    const seat = town.seat();
    if (seat) return [seat.x + 0.5, seat.z + 2];
    let x = 0, z = 0, n = 0;
    for (const p of s.map.parcels) if (p.owned) { x += p.x + PARCEL / 2 - HALF_W; z += p.y + PARCEL / 2 - HALF_D; n++; }
    return n ? [x / n, z / n] : [0, 0];
  }
  function coinsFrom(buildingId: Id, amount: number): void {
    const last = coinAt.get(buildingId);
    if (last !== undefined && time - last < 0.5) return;      // one burst per payment, however many events announce it
    coinAt.set(buildingId, time);
    const from = town.roofOf(buildingId, _a);
    if (!from) return;
    const n = clamp(Math.round(2 + Math.sqrt(Math.max(1, amount)) * 1.15), 3, 16);
    guard('fx.coins', () => fx.coins(from.clone(), props.pos('coffer').clone(), n), undefined);
  }
  function worldOf(ref: AnchorRef, out: THREE.Vector3): THREE.Vector3 | null {
    if ('buildingId' in ref) {
      if (ref.at === 'door') { const p = town.doorOf(ref.buildingId, out, ref.unit); if (p) p.y = 0.45; return p; }
      const p = town.topOf(ref.buildingId, out);
      if (p) { p.y += 0.28; return p; }
      const b = state?.buildings[ref.buildingId];
      return b ? out.set(b.x + b.w / 2 - HALF_W, 1.6, b.y + b.h / 2 - HALF_D) : null;
    }
    if ('actorId' in ref) {
      const p = guard('actor positionOf', () => actorLayer.positionOf(ref.actorId), null);
      if (p) return out.copy(p);
      const a = state?.actors[ref.actorId];
      return a ? out.set(a.x - HALF_W, 0.6, a.y - HALF_D) : null;
    }
    if ('tenantId' in ref) {
      const p = guard('town positionOf', () => townLayer.positionOf(ref.tenantId), null);
      if (p) return out.copy(p);
      const t = state?.tenants[ref.tenantId];
      if (!t || !t.buildingId) return null;
      const d = town.doorOf(t.buildingId, out, t.unit);
      if (d) d.y = 0.6;
      return d;
    }
    if ('tile' in ref) return out.set(ref.tile[0] + 0.5 - HALF_W, 0.06, ref.tile[1] + 0.5 - HALF_D);
    if ('prop' in ref) return props.pos(ref.prop as TableProp, out);
    return null;
  }

  // post look, eased so mode changes breathe
  const look = { blur: 1, band: 0.18, vignette: 0.44 };

  function resize(): void {
    const w = Math.max(1, canvas.clientWidth || window.innerWidth || 1), h = Math.max(1, canvas.clientHeight || window.innerHeight || 1);
    cssW = w; cssH = h;
    const cap = quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1.25;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap) * resScale);
    renderer.setSize(w, h, false);
    rig.setAspect(w / h);
    renderer.getDrawingBufferSize(size);
    post.setSize(size.x, size.y);
    rig.apply();
  }

  let fps = 60, lastNow = 0, calls = 0, tris = 0;

  // Holding the frame rate: when the machine cannot keep up, render fewer pixels rather than
  // fewer frames (the tilt-shift forgives a softer image; nothing forgives a stutter).
  let resScale = 1, slowFor = 0, fastFor = 0, climbAfter = 6;
  const governed = typeof navigator === 'undefined' || !navigator.webdriver;   // not under automation: screenshots stay full size
  function govern(real: number): void {
    if (!governed || real > 0.25 || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) { slowFor = 0; fastFor = 0; return; }
    if (fps < 50) { slowFor += real; fastFor = 0; }
    else if (fps > 57) { fastFor += real; slowFor = 0; }
    else { slowFor = Math.max(0, slowFor - real); fastFor = 0; }
    if (slowFor > 2.5 && resScale > 0.55) {
      resScale = Math.max(0.55, resScale - 0.1);
      slowFor = 0; fastFor = 0;
      climbAfter = Math.min(90, climbAfter * 1.6);       // each retreat makes the next advance more cautious
      fps = 60;                                          // judge the new size on its own frames
      resize();
    } else if (fastFor > climbAfter && resScale < 1) {
      resScale = Math.min(1, resScale + 0.05);
      slowFor = 0; fastFor = 0; fps = 60;
      resize();
    }
  }

  const api: CoreRenderer = {
    reset(s) {
      state = s; didReset = true;
      coinAt.clear();
      input.cancel();
      town.reset(s);
      terrain.reset(s);
      guard('actors.reset', () => actorLayer.reset(s), undefined);
      guard('townlife.reset', () => townLayer.reset(s), undefined);
      guard('fx.setWeather', () => fx.setWeather(s.weather), undefined);
      props.setGold(s.gold, true);
      props.setCharterReady(s.charter.ready);
      table.setRealmName(s.realm.name);
      const seat = town.seat();
      if (seat) rig.setSeat(seat.x, seat.z, seat.yaw);
      const [hx, hz] = homeOf(s);
      rig.reset(hx, hz);
      envModel.update(s, 0, time);
    },
    sync(s) {
      if (!didReset || !state) { api.reset(s); return; }
      state = s;
      town.sync(s);
      terrain.sync(s);
      guard('actors.sync', () => actorLayer.sync(s), undefined);
      guard('townlife.sync', () => townLayer.sync(s), undefined);
      props.setGold(s.gold);
      props.setCharterReady(s.charter.ready);
      table.setRealmName(s.realm.name);
      const seat = town.seat();
      if (seat) rig.setSeat(seat.x, seat.z, seat.yaw);
    },
    handleEvents(events, s) {
      if (!events.length) return;
      state = s;
      for (const ev of events) {
        switch (ev.type) {
          case 'gold': if (ev.amount > 0 && ev.buildingId) coinsFrom(ev.buildingId, ev.amount); break;
          case 'purse_collected': coinsFrom(ev.buildingId, ev.amount); break;
          case 'weather': guard('fx.setWeather', () => fx.setWeather(ev.kind), undefined); break;
          case 'rent_day': props.ringBell(); break;
          case 'promotion': {
            const seat = town.seat();
            const top = seat ? _a.set(seat.x, 3.4, seat.z) : _a.set(0, 3, 0);
            guard('fx.confetti', () => { fx.confetti(top.clone()); fx.confetti(top.clone().add(_c.set(1.2, 0.6, 0.4))); fx.confetti(top.clone().add(_c.set(-1.1, 0.4, -0.3))); }, undefined);
            break;
          }
          case 'parcel_bought': {
            const p = s.map.parcels[ev.parcelId];
            if (p) guard('fx.sparkle', () => { for (const [dx, dy] of [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]] as const) fx.sparkle(new THREE.Vector3(p.x + dx - HALF_W, 0.5, p.y + dy - HALF_D), PAL.gold); }, undefined);
            break;
          }
          default: break;
        }
      }
      town.handleEvents(events, s);
      guard('actors.handleEvents', () => actorLayer.handleEvents(events, s), undefined);
      guard('townlife.handleEvents', () => townLayer.handleEvents(events, s), undefined);
    },
    frame(dtSeconds) {
      if (disposed) return;
      const now = performance.now();
      if (lastNow) { const real = Math.min(1, (now - lastNow) / 1000); if (real > 0) { fps = lerp(fps, 1 / real, 0.06); govern(real); } }
      lastNow = now;
      const dt = clamp(Number.isFinite(dtSeconds) ? dtSeconds : 0, 0, 0.1);
      time += dt;
      if ((canvas.clientWidth || cssW) !== cssW || (canvas.clientHeight || cssH) !== cssH) resize();

      rig.update(dt);
      envModel.update(state, dt, time);
      const flash = clamp(fx.flash || 0, 0, 1);
      lights.apply(sky, flash);
      // fit the key's shadow to what the camera is looking at
      const tv = Math.tan((camera.fov * DEG) / 2);
      const low = 1 - smoothstep(25 * DEG, 65 * DEG, rig.pitchNow);
      const radius = rig.cur.dist * tv * Math.max(1, camera.aspect) * 1.12 + 3;
      _a.set(clamp(rig.cur.tx - Math.sin(rig.cur.yaw) * radius * 0.3 * low, -HALF_W, HALF_W), 0, clamp(rig.cur.tz - Math.cos(rig.cur.yaw) * radius * 0.3 * low, -HALF_D, HALF_D));
      lights.every = quality === 'high' && resScale >= 1 ? 1 : 2;
      lights.fit(sky, _a, radius);
      renderer.toneMappingExposure = sky.exposure;
      fog.near = rig.cur.dist + 40; fog.far = rig.cur.dist + 190;

      props.update(env, sky);
      terrain.update(env, sky);
      town.update(env);
      ghost.update(env);
      guard('actors.update', () => actorLayer.update(env), undefined);
      guard('townlife.update', () => townLayer.update(env), undefined);
      guard('fx.update', () => fx.update(env), undefined);
      input.update(dt);

      renderer.info.reset();
      if (quality !== 'low' && post.supported) {
        const zt = rig.zoomT;
        const boost = mode === 'audience' ? 1.9 : mode === 'ceremony' ? 1.45 : mode === 'title' ? 1.3 : 1;
        look.blur = damp(look.blur, boost, 2, dt);
        look.band = damp(look.band, mode === 'audience' ? 0.11 : lerp(0.17, 0.21, zt), 2, dt);
        look.vignette = damp(look.vignette, (mode === 'title' ? 0.56 : mode === 'play' ? 0.42 : 0.52) + env.night * 0.12, 2, dt);
        _b.set(rig.cur.tx, 0.35, rig.cur.tz).project(camera);
        post.render(scene, camera, {
          focusY: clamp(_b.y * 0.5 + 0.5, 0.2, 0.8),
          band: look.band, feather: 0.3,
          blur: 0.0105 * look.blur * (0.8 + 0.5 * (1 - zt)) * (0.78 + 0.5 * low),
          bloom: 0.5 + 0.4 * env.night,
          threshold: lerp(1.15, 0.5, Math.max(env.night, 1 - sky.day)),
          vignette: look.vignette, grain: 0.03, time,
        });
      } else {
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
      }
      calls = renderer.info.render.calls; tris = renderer.info.render.triangles;
    },
    resize,
    setTool(tool: Tool) { input.setTool(tool); },
    setMode(m) {
      if (m === mode) return;
      mode = m;
      rig.setMode(m);
      input.cancel();
    },
    focus(target, opts = {}) {
      let x: number | null = null, z: number | null = null, dist: number | null = null, pitch: number | null = null;
      if (target.overview) { x = 0; z = -0.4; dist = rig.overviewDist(); pitch = OVERVIEW_PITCH; }
      if (target.buildingId && state?.buildings[target.buildingId]) {
        const b = state.buildings[target.buildingId]!;
        x = b.x + b.w / 2 - HALF_W; z = b.y + b.h / 2 - HALF_D;
        if (!target.overview && opts.zoom == null && rig.goal.dist > rig.refDist * 0.8) dist = rig.refDist * 0.6;
      } else if (target.actorId) {
        const p = worldOf({ actorId: target.actorId }, _a);
        if (p) { x = p.x; z = p.z; if (opts.zoom == null && rig.goal.dist > rig.refDist * 0.8) dist = rig.refDist * 0.6; }
      } else if (target.tile) { x = target.tile[0] + 0.5 - HALF_W; z = target.tile[1] + 0.5 - HALF_D; }
      if (opts.zoom != null && opts.zoom > 0) dist = rig.refDist / opts.zoom;
      rig.focus(x, z, dist, opts.ms ?? 900, pitch);
    },
    anchor(ref): Anchor {
      const p = worldOf(ref, _a);
      if (!p) return { x: -9999, y: -9999, visible: false, scale: 1 };
      const dist = p.distanceTo(camera.position);
      const front = _b.copy(p).applyMatrix4(camera.matrixWorldInverse).z < -camera.near;
      p.project(camera);
      const x = (p.x * 0.5 + 0.5) * cssW, y = (1 - (p.y * 0.5 + 0.5)) * cssH;
      const visible = front && x > -48 && y > -48 && x < cssW + 48 && y < cssH + 48;
      return { x, y, visible, scale: clamp(rig.refDist / Math.max(1, dist), 0.42, 1.8) };
    },
    setSelection(sel) {
      town.setSelected(sel?.buildingId ?? null);
      guard('actors.setSelected', () => actorLayer.setSelected(sel?.actorId ?? null), undefined);
      const tenantId = (sel as { tenantId?: Id } | null)?.tenantId ?? null;
      guard('townlife.setSelected', () => townLayer.setSelected(tenantId), undefined);
    },
    setHighlight(tiles, color) { terrain.setHighlight(tiles, color); },
    on(type, cb) { (listeners[type] as RendererEvents[typeof type][]).push(cb); },
    setQuality(q) {
      if (q === quality) return;
      quality = q; ctx.quality = q;
      lights.setQuality(q); post.setQuality(q); props.setQuality(q);
      resScale = 1; slowFor = 0; fastFor = 0; climbAfter = 6;
      resize();
    },
    stats() { return { fps: Math.round(fps * 10) / 10, calls, tris }; },
    dispose() {
      if (disposed) return;
      disposed = true;
      input.dispose();
      guard('actors.dispose', () => actorLayer.dispose(), undefined);
      guard('townlife.dispose', () => townLayer.dispose(), undefined);
      guard('fx.dispose', () => fx.dispose(), undefined);
      town.dispose(); ghost.dispose(); terrain.dispose(); props.dispose(); table.dispose();
      lights.dispose(); post.dispose(); roomEnv.dispose();
      renderer.dispose();
    },
    debug: {
      env: () => env,
      sky: () => sky,
      pose: () => rig.cur,
      settle() {
        rig.update(0);                       // let a scripted mode aim first
        Object.assign(rig.cur, rig.goal); rig.apply();
        if (state) { props.setGold(state.gold, true); envModel.jump(); envModel.update(state, 0, time); }
      },
      view(v) {
        const g = rig.goal;
        if (v.tx != null) g.tx = v.tx; if (v.tz != null) g.tz = v.tz; if (v.dist != null) g.dist = v.dist;
        if (v.yaw != null) g.yaw = v.yaw * DEG; if (v.pitch != null) g.pitch = v.pitch * DEG;
        Object.assign(rig.cur, g); rig.apply();
      },
      pick(cssX, cssY) { return pickNdc((cssX / cssW) * 2 - 1, -((cssY / cssH) * 2 - 1)); },
    },
  };

  resize();
  return api;
}
