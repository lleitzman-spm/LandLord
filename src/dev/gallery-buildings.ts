/**
 * OWNER: render-buildings. Dev gallery for housing, the seat and the wrapper
 * every building passes through. No dependency on render/index.
 *
 * A sheet of little turntables: one column per building, one row per state.
 * Every cell has its own camera, its own light and its own Env, so the same
 * cottage can stand pristine, wrecked, half built, at night and under snow
 * side by side in one frame.
 *
 *   node tools/shot.mjs src/dev/gallery-buildings.ts .tmp/render-buildings-a.png --w 1600 --h 1000 --wait 6000
 *   ... --eval "__dev.show({ types: ['hovel','cottage'], rows: ['pristine','wrecked','ruined'], fit: true })"
 *
 * __dev.show({ types, rows, variant, fit })   which cells. types: building ids, or 'seat1' | 'seat2' | 'seat3'; 'housing', 'seats', 'civic' expand.
 * __dev.show({ cells: ['cottage/wrecked', 'hovel/ruined/7'], cols: 4, fit: true })   a free list of 'type/row/variant' cells
 * __dev.cam({ yaw, pitch, zoom, spin })       the turntable (spin in radians per second; 0 holds still)
 * __dev.look({ ... })                         force look fields on every cell (flags, condition, progress ...); null clears
 * __dev.env({ ... })                          force Env fields on every cell (wind, season ...); null clears
 * __dev.outline(on)                           footprint outline on the turntable
 * __dev.set(i, row, patch)                     push a new look into cell i through set() (finish a building, wreck it ...)
 * __dev.settle(n)                             draw n frames at once (use at the end of an --eval)
 * __dev.stats()                               draw calls and triangles per cell
 * __dev.stress()                              walk every type through every state via set(); returns what broke
 * Rows: pristine worn poor wrecked ruined building b05 b20 b40 b80 night snow tolet purple haunted gargoyles hearth squat
 */
import * as THREE from 'three';
import { createBuildingVisual } from '../render/buildings/index';
import { BUILDINGS, BUILDING_LIST } from '../data/buildings';
import type { BuildingType } from '../data/ids';
import type { BuildingLook, BuildingVisual, Env, RenderCtx } from '../render/api';
import { PAL } from '../render/palette';

// ───────────── what can be shown ─────────────

const HOUSING: BuildingType[] = ['hovel', 'cottage', 'burrow', 'longhouse', 'stonehall', 'townhouse', 'treehouse', 'wizard_tower'];
const SEATS = ['seat1', 'seat2', 'seat3'];
const CIVIC = BUILDING_LIST.map(d => d.id).filter(id => !HOUSING.includes(id) && id !== 'seat');

interface RowDef { look?: Partial<BuildingLook>; env?: Partial<Env>; vacant?: boolean }
const ROWS: Record<string, RowDef> = {
  pristine: {},
  worn: { look: { condition: 62 } },
  poor: { look: { condition: 40, toLet: true }, vacant: true },
  wrecked: { look: { condition: 14, toLet: true }, vacant: true },
  ruined: { look: { state: 'ruined', condition: 0 }, vacant: true },
  building: { look: { state: 'building', progress: 0.55 }, vacant: true },
  b05: { look: { state: 'building', progress: 0.05 }, vacant: true },
  b20: { look: { state: 'building', progress: 0.2 }, vacant: true },
  b40: { look: { state: 'building', progress: 0.4 }, vacant: true },
  b80: { look: { state: 'building', progress: 0.8 }, vacant: true },
  night: { env: { night: 1, monthPhase: 0.9 } },
  snow: { env: { snow: 1, season: 'winter', seasonT: 0.5 } },
  snownight: { env: { snow: 1, season: 'winter', seasonT: 0.5, night: 1, monthPhase: 0.9 } },
  autumn: { env: { season: 'autumn', seasonT: 0.4 } },
  spring: { env: { season: 'spring', seasonT: 0.2 } },
  tolet: { look: { toLet: true }, vacant: true },
  purple: { look: { flags: ['purple'] } },
  haunted: { look: { flags: ['haunted'] }, env: { night: 1, monthPhase: 0.9 }, vacant: true },
  gargoyles: { look: { flags: ['gargoyles'] } },
  hearth: { look: { flags: ['hearth_right'], condition: 70 } },
  squat: { look: { squatters: 'goblins', condition: 45 }, env: { night: 1, monthPhase: 0.9 }, vacant: true },
};

// ───────────── renderer, one scene, one turntable ─────────────

const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;
renderer.setScissorTest(true);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 120);

const env: Env = { time: 0, dt: 0, monthPhase: 0.4, night: 0, season: 'summer', seasonT: 0.5, snow: 0, wind: 0.4, weather: 'clear', speed: 1 };
const ctx: RenderCtx = { scene, camera, renderer, env, quality: 'high' };
const BASE_ENV: Env = { ...env };

const hemi = new THREE.HemisphereLight(0xb9cdf0, 0x76553a, 0.66);
const key = new THREE.DirectionalLight(0xfff0d6, 3.4);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.bias = -0.00035; key.shadow.normalBias = 0.028;
const sc = key.shadow.camera; sc.left = -3.4; sc.right = 3.4; sc.top = 3.6; sc.bottom = -3.4; sc.near = 1; sc.far = 40;
const fill = new THREE.DirectionalLight(0x8fa9dc, 0.42);
fill.position.set(8, 6, -6);
// the table's candles, which do most of the work at night
const candle = new THREE.PointLight(PAL.flame, 0, 0, 2);
candle.position.set(5.5, 3.2, 6.5);
scene.add(hemi, key, key.target, fill, candle);

// the turntable: a disc of the board, turfed
const discMat = new THREE.MeshStandardMaterial({ color: PAL.grassSummer, roughness: 0.95, flatShading: true });
const rimMat = new THREE.MeshStandardMaterial({ color: PAL.boardEdge, roughness: 0.8, flatShading: true });
const disc = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.12, 40), [rimMat, discMat, rimMat]);
disc.position.y = -0.06; disc.receiveShadow = true;
scene.add(disc);
const outlineMat = new THREE.LineBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0.45 });
const outlineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 0, -0.5), new THREE.Vector3(0.5, 0, 0.5), new THREE.Vector3(-0.5, 0, 0.5)]);
const outline = new THREE.LineLoop(outlineGeo, outlineMat);
outline.position.y = 0.004;
scene.add(outline);
let showOutline = true;

const GRASS = { spring: PAL.grassSpring, summer: PAL.grassSummer, autumn: PAL.grassAutumn, winter: 0xb9c2b0 } as const;
const cA = new THREE.Color(), cB = new THREE.Color();

interface Cell { type: string; row: string; look: BuildingLook; visual: BuildingVisual; holder: THREE.Group; env: Partial<Env>; calls: number; tris: number; error: string }
let cells: Cell[] = [];
let cols = 1, rows = 1;
let fit = false;
let lookForce: Partial<BuildingLook> | null = null;
let envForce: Partial<Env> | null = null;
const camOpts = { yaw: 0.5, pitch: 0.6, zoom: 1, spin: navigator.webdriver ? 0 : 0.2 };
let current: { types: string[]; rows: string[]; variant: number; cells?: string[]; cols?: number } = { types: [...HOUSING, ...SEATS], rows: ['pristine', 'worn', 'wrecked', 'building', 'night', 'snow'], variant: 3 };

function expand(types: string[]): string[] {
  const out: string[] = [];
  for (const t of types) {
    if (t === 'housing') out.push(...HOUSING);
    else if (t === 'seats') out.push(...SEATS);
    else if (t === 'civic') out.push(...CIVIC);
    else out.push(t);
  }
  return out;
}

function lookFor(type: string, row: string, variant: number): BuildingLook {
  const level = type.startsWith('seat') ? +(type.slice(4) || 1) : 1;
  const id = (type.startsWith('seat') ? 'seat' : type) as BuildingType;
  const d = BUILDINGS[id], def = ROWS[row] ?? {};
  const look: BuildingLook = {
    type: id, level, variant, w: d ? d.w : 2, h: d ? d.h : 2, state: 'ready', progress: 1, condition: 100,
    occupied: new Array<boolean>(d ? d.units : 1).fill(!def.vacant), toLet: false, squatters: null, flags: [],
  };
  // a multi-unit house with one unit to let still has neighbours at home
  if (def.vacant && look.occupied.length > 1 && def.look?.state === undefined) look.occupied[look.occupied.length - 1] = true;
  Object.assign(look, def.look);
  if (lookForce) Object.assign(look, lookForce);
  return look;
}

function setEnvFor(cell: Cell | null, time: number, dt: number): void {
  Object.assign(env, BASE_ENV, cell ? cell.env : null, envForce);
  env.time = time; env.dt = dt;
}

function show(o: Partial<typeof current> & { fit?: boolean } = {}): string {
  if (o.fit !== undefined) fit = o.fit;
  current = { types: o.types ? expand(o.types) : current.types, rows: o.rows ?? current.rows, variant: o.variant ?? current.variant, cells: o.cells ?? (o.types || o.rows ? undefined : current.cells), cols: o.cols ?? current.cols };
  for (const c of cells) { scene.remove(c.holder); try { c.visual.dispose(); } catch (e) { console.error(e); } }
  cells = [];
  // either a grid of types by rows, or a free list of 'type/row' or 'type/row/variant' cells flowed into `cols` columns
  const list: [string, string, number][] = [];
  if (current.cells) {
    for (const c of current.cells) { const [t, r, v] = c.split('/'); list.push([t, r || 'pristine', v ? +v : current.variant]); }
    cols = Math.max(1, Math.min(list.length, current.cols ?? Math.ceil(Math.sqrt(list.length * 1.5)))); rows = Math.ceil(list.length / cols);
  } else {
    for (const row of current.rows) for (const type of current.types) list.push([type, row, current.variant]);
    cols = current.types.length; rows = current.rows.length;
  }
  const errors: string[] = [];
  {
    for (const [type, row, variant] of list) {
      const look = lookFor(type, row, variant);
      const holder = new THREE.Group(); holder.visible = false; scene.add(holder);
      const cell: Cell = { type, row, look, visual: null as unknown as BuildingVisual, holder, env: ROWS[row]?.env ?? {}, calls: 0, tris: 0, error: '' };
      setEnvFor(cell, env.time, 0);
      try { cell.visual = createBuildingVisual(look, ctx); holder.add(cell.visual.group); }
      catch (e) { cell.error = String((e as Error)?.stack ?? e); errors.push(`${type}/${row}: ${cell.error.slice(0, 300)}`); console.error(e); }
      cells.push(cell);
    }
  }
  labels();
  frames = 0;
  return errors.length ? errors.join('\n') : `ok: ${cells.length} cells`;
}

// ───────────── labels ─────────────

const labelBox = document.createElement('div');
labelBox.style.cssText = 'position:fixed;inset:0;pointer-events:none;font:11px/1.2 ui-monospace,monospace;color:#f2e6c8;';
document.body.appendChild(labelBox);
function labels(): void {
  labelBox.innerHTML = '';
  const cw = innerWidth / cols, ch = innerHeight / rows;
  if (current.cells) {
    cells.forEach((c, i) => {
      const d = document.createElement('div');
      d.textContent = `${c.type} / ${c.row} v${c.look.variant}`;
      d.style.cssText = `position:absolute;left:${(i % cols) * cw + 4}px;top:${Math.floor(i / cols) * ch + 3}px;text-shadow:0 1px 2px #000`;
      labelBox.appendChild(d);
    });
    return;
  }
  current.types.forEach((t, i) => {
    const d = document.createElement('div');
    d.textContent = t;
    d.style.cssText = `position:absolute;left:${i * cw + 4}px;top:3px;text-shadow:0 1px 2px #000`;
    labelBox.appendChild(d);
  });
  current.rows.forEach((r, j) => {
    const d = document.createElement('div');
    d.textContent = r;
    d.style.cssText = `position:absolute;left:4px;top:${j * ch + (j ? 3 : 16)}px;color:#e3b23c;text-shadow:0 1px 2px #000`;
    labelBox.appendChild(d);
  });
}

// ───────────── drawing a cell ─────────────

const NIGHT_SKY = new THREE.Color(0x2c4285), DAY_SKY = new THREE.Color(0xb9cdf0), DAY_GROUND = new THREE.Color(0x76553a), NIGHT_GROUND = new THREE.Color(0x191624);
const SNOW_GROUND = new THREE.Color(0x8d9bb5), DAY_FILL = new THREE.Color(0x8fa9dc), NIGHT_FILL = new THREE.Color(0x4563b4);
const SUN = new THREE.Color(0xfff0d6), MOON = new THREE.Color(0x86a6ff);
const SUN_DIR = new THREE.Vector3(-0.48, 0.78, 0.4).normalize(), MOON_DIR = new THREE.Vector3(-0.46, 0.78, -0.42).normalize();
const bg = new THREE.Color();

function light(): void {
  const n = env.night, s = env.snow;
  hemi.color.copy(DAY_SKY).lerp(NIGHT_SKY, n);
  hemi.groundColor.copy(DAY_GROUND).lerp(NIGHT_GROUND, n).lerp(SNOW_GROUND, s * 0.6 * (1 - n * 0.5));
  hemi.intensity = (0.66 + (0.5 - 0.66) * n) * (1 + s * 0.12);
  fill.color.copy(DAY_FILL).lerp(NIGHT_FILL, n); fill.intensity = 0.42 + (0.34 - 0.42) * n;
  key.color.copy(SUN).lerp(MOON, n); key.intensity = 3.4 + (0.62 - 3.4) * n;
  key.position.copy(n > 0.5 ? MOON_DIR : SUN_DIR).multiplyScalar(18);
  candle.intensity = 14 + 26 * n;
  renderer.toneMappingExposure = 1 + 0.16 * n;
  cA.setHex(GRASS[env.season]); cB.setHex(PAL.snow);
  discMat.color.copy(cA).lerp(cB, s * 0.85);
}

let frames = 0, last = performance.now(), time = 0, yaw = camOpts.yaw;
function frame(): void {
  const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  drawAll(dt);
  requestAnimationFrame(frame);
}
function drawAll(dt: number): void {
  time += dt; yaw += camOpts.spin * dt;
  const W = innerWidth, H = innerHeight;
  if (canvas.width !== W || canvas.height !== H) renderer.setSize(W, H, false);
  renderer.setViewport(0, 0, W, H); renderer.setScissor(0, 0, W, H);
  renderer.setClearColor(bg.setHex(PAL.room), 1); renderer.clear();
  const cw = W / cols, ch = H / rows;
  camera.aspect = cw / ch;
  const vf = (camera.fov * Math.PI) / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect), half = Math.min(vf, hf) / 2;
  cells.forEach((cell, i) => {
    if (!cell.visual) return;
    const col = i % cols, row = Math.floor(i / cols);
    setEnvFor(cell, time, dt);
    try { cell.visual.update(env); } catch (e) { if (!cell.error) { cell.error = String((e as Error)?.stack ?? e); console.error('update failed: ' + cell.type + '/' + cell.row, e); } }
    light();
    cell.holder.visible = true;
    const L = cell.look, top = Math.max(0.6, cell.visual.anchors.top);
    const R = fit ? Math.hypot(L.w, L.h) / 2 : Math.hypot(3, 3) / 2;
    const tall = fit ? top : 2.6;
    const rho = Math.hypot(R, tall * 0.55) * 0.98, dist = (rho / Math.sin(half)) / camOpts.zoom;
    const ty = fit ? top * 0.42 : 0.95;
    camera.position.set(Math.sin(yaw) * Math.cos(camOpts.pitch) * dist, ty + Math.sin(camOpts.pitch) * dist, Math.cos(yaw) * Math.cos(camOpts.pitch) * dist);
    camera.lookAt(0, ty, 0);
    camera.updateProjectionMatrix();
    disc.scale.set(Math.hypot(L.w, L.h) / 2 + 0.35, 1, Math.hypot(L.w, L.h) / 2 + 0.35);
    outline.visible = showOutline; outline.scale.set(L.w, 1, L.h);
    const x = Math.round(col * cw), y = Math.round(H - (row + 1) * ch);
    renderer.setViewport(x, y, Math.round(cw), Math.round(ch)); renderer.setScissor(x, y, Math.round(cw), Math.round(ch));
    renderer.clearDepth();
    renderer.render(scene, camera);
    cell.calls = renderer.info.render.calls; cell.tris = renderer.info.render.triangles;
    cell.holder.visible = false;
  });
  frames++;
}
/** draw the sheet `n` times right now (so a screenshot taken straight after an eval sees the result) */
function settle(n = 3, dt = 0.05): string {
  const t0 = performance.now();
  for (let i = 0; i < n; i++) drawAll(dt);
  // software GL queues whole frames: wait for it, so a screenshot sees finished work
  const gl = renderer.getContext();
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  const errs = cells.filter(c => c.error).map(c => c.type + '/' + c.row + ': ' + c.error.slice(0, 240));
  return errs.length ? errs.join('\n') : `settled ${n} frames in ${Math.round(performance.now() - t0)} ms`;
}

// ───────────── a walk through every state by way of set() ─────────────

function stress(): string {
  const problems: string[] = [];
  const types = [...HOUSING, ...SEATS, ...CIVIC];
  let n = 0;
  for (const type of types) {
    for (const variant of [1, 2]) {
      const mk = (row: string, patch: Partial<BuildingLook> = {}): BuildingLook => ({ ...lookFor(type, row, variant), ...patch });
      let v: BuildingVisual | null = null;
      const step = (name: string, fn: () => void) => { try { fn(); n++; } catch (e) { problems.push(`${type} v${variant} ${name}: ${String((e as Error)?.stack ?? e).slice(0, 400)}`); } };
      Object.assign(env, BASE_ENV);
      step('create building', () => { v = createBuildingVisual(mk('b05'), ctx); });
      if (!v) continue;
      const vis = v as BuildingVisual;
      for (const p of [0.1, 0.2, 0.35, 0.5, 0.7, 0.9, 1]) step('progress ' + p, () => { vis.set(mk('building', { progress: p })); vis.update(env); });
      step('ready', () => { vis.set(mk('pristine')); vis.update(env); });
      for (let i = 0; i < 40; i++) { env.time += 0.02; env.dt = 0.02; step('strike', () => vis.update(env)); }
      for (const c of [90, 74, 60, 49, 30, 24, 10]) step('condition ' + c, () => { vis.set(mk('pristine', { condition: c, toLet: c < 60, occupied: mk('pristine').occupied.map(() => c >= 60) })); vis.update(env); });
      step('flags', () => { vis.set(mk('pristine', { flags: ['gargoyles', 'haunted', 'hearth_right', 'purple'], condition: 40 })); vis.update(env); });
      env.snow = 1; env.night = 1;
      step('snow night', () => { vis.update(env); vis.set(mk('pristine', { squatters: 'goblins', occupied: mk('pristine').occupied.map(() => false) })); vis.update(env); });
      step('ruined', () => { vis.set(mk('ruined')); vis.update(env); });
      step('ruined flags', () => { vis.set(mk('ruined', { flags: ['purple', 'hearth_right'] })); vis.update(env); });
      step('rebuilt', () => { vis.set(mk('building', { progress: 0.3 })); vis.update(env); vis.set(mk('pristine')); vis.update(env); });
      if (type.startsWith('seat')) step('level up', () => { vis.set({ ...mk('pristine'), level: 3 }); vis.update(env); vis.set({ ...mk('pristine'), level: 2 }); vis.update(env); });
      const a = vis.anchors;
      if (!Number.isFinite(a.top) || !Number.isFinite(a.door.x + a.door.z + a.roof.y)) problems.push(`${type} v${variant}: bad anchors`);
      const hw = BUILDINGS[(type.startsWith('seat') ? 'seat' : type) as BuildingType].w / 2, hh = BUILDINGS[(type.startsWith('seat') ? 'seat' : type) as BuildingType].h / 2;
      if (Math.abs(a.door.x) > hw + 0.01 || Math.abs(a.door.z) > hh + 0.01) problems.push(`${type} v${variant}: door anchor outside the plot (${a.door.x.toFixed(2)}, ${a.door.z.toFixed(2)})`);
      step('dispose', () => vis.dispose());
    }
  }
  Object.assign(env, BASE_ENV);
  return problems.length ? problems.join('\n') : `ok: ${n} steps over ${types.length} types`;
}

/** how far each body strays outside its plot (the brief asks for about 0.15 inside) */
function fitReport(): string {
  const out: string[] = [];
  const box = new THREE.Box3();
  for (const type of [...HOUSING, ...SEATS]) {
    let worst = -Infinity, top = 0;
    for (let variant = 1; variant <= 6; variant++) {
      const look = lookFor(type, 'pristine', variant);
      const v = createBuildingVisual(look, ctx);
      v.group.updateWorldMatrix(true, true);
      box.setFromObject(v.group);
      worst = Math.max(worst, box.max.x - look.w / 2, -box.min.x - look.w / 2, box.max.z - look.h / 2, -box.min.z - look.h / 2);
      top = Math.max(top, box.max.y);
      v.dispose();
    }
    out.push(`${type}: overhang ${worst.toFixed(2)} top ${top.toFixed(2)}`);
  }
  return out.join(' | ');
}

function stats(): { frames: number; cells: { cell: string; calls: number; tris: number }[]; errors: string[]; geometries: number; programs: number } {
  return {
    frames,
    cells: cells.map(c => ({ cell: c.type + '/' + c.row, calls: c.calls, tris: c.tris })),
    errors: cells.filter(c => c.error).map(c => c.type + '/' + c.row + ': ' + c.error.slice(0, 200)),
    geometries: renderer.info.memory.geometries, programs: renderer.info.programs ? renderer.info.programs.length : 0,
  };
}

const dev = {
  show,
  cam(o: Partial<typeof camOpts>): void { Object.assign(camOpts, o); if (o.yaw !== undefined) yaw = o.yaw; },
  look(o: Partial<BuildingLook> | null): string { lookForce = o; return show(); },
  env(o: Partial<Env> | null): void { envForce = o; },
  outline(on: boolean): void { showOutline = on; },
  stats, stress, fitReport, settle,
  /** push a new look into cell i through set(): e.g. finish a building and watch the scaffold come down */
  set(i: number, row: string, patch: Partial<BuildingLook> = {}): string {
    const c = cells[i];
    if (!c || !c.visual) return 'no such cell';
    c.look = { ...lookFor(c.type, row, c.look.variant), ...patch };
    c.env = ROWS[row]?.env ?? {};
    setEnvFor(c, env.time, 0);
    try { c.visual.set(c.look); return 'ok'; } catch (e) { c.error = String((e as Error)?.stack ?? e); return c.error; }
  },
  get frames() { return frames; },
};
(window as unknown as { __dev: typeof dev }).__dev = dev;

addEventListener('resize', labels);
show();
requestAnimationFrame(frame);
