/**
 * Dev gallery for the incident visuals (render-creatures). Not shipped.
 *
 *   node tools/shot.mjs src/dev/gallery-visuals.ts .tmp/render-creatures-all.png --w 1600 --h 1000
 *   ... --eval "__dev.view(['griffin_roof','small_dragon','ghost','fire','tax_cart','goblins_windows'])" --shots 2 --every 900
 *
 * Its own lit scene, no dependency on render/index: a grid of stand-in houses
 * with honest anchors, one visual each, and a label on the ground.
 * `window.__dev`:
 *   view(ids | null, { yaw, pitch, dist, lift })  close-up tiles of the named visuals (null: the whole grid)
 *   night(0..1)  wind(0..1)  weather(kind)  snow(0..1)
 *   leave(ids?)  play the exit, then bring them back after a pause
 *   step(seconds)  run the clock forward at once
 *   kinds('canon' | 'mixed' | 'cottage' | ... | 'real')  rebuild on other bodies; 'real' uses the game's own
 *     building models (render/buildings), each visual on a type that suits it
 *   stats()  draw calls and triangles of the last frame
 */
import * as THREE from 'three';
import type { BuildingLook, BuildingVisual, Env, RenderCtx, VisualHandle, VisualHost } from '../render/api';
import { PAL, mat, shadows, tint } from '../render/palette';
import { VISUALS, type VisualId, type BuildingType } from '../data/ids';
import type { WeatherKind } from '../sim/types';
import { createVisual } from '../render/visuals';
import { createBuildingVisual } from '../render/buildings';
import { BUILDINGS } from '../data/buildings';

// ───────────────────────── stand-in houses with honest anchors ─────────────────────────

export type HouseKind = 'cottage' | 'long' | 'tall' | 'tower' | 'big' | 'small';

function gable(len: number, depth: number, rise: number): THREE.BufferGeometry {
  // ridge along x; eaves at y = 0, ridge at y = rise
  const L = len / 2, D = depth / 2;
  const v = [
    -L, 0, D, L, 0, D, L, rise, 0, -L, 0, D, L, rise, 0, -L, rise, 0,       // front slope
    L, 0, -D, -L, 0, -D, -L, rise, 0, L, 0, -D, -L, rise, 0, L, rise, 0,     // back slope
    -L, 0, -D, -L, 0, D, -L, rise, 0,                                        // gable ends
    L, 0, D, L, 0, -D, L, rise, 0,
    -L, 0, -D, L, 0, -D, L, 0, D, -L, 0, -D, L, 0, D, -L, 0, D,              // underside
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
  return g;
}

const DIMS: Record<HouseKind, { w: number; h: number }> = {
  cottage: { w: 2, h: 2 }, long: { w: 3, h: 2 }, tall: { w: 2, h: 3 }, tower: { w: 2, h: 2 }, big: { w: 3, h: 3 }, small: { w: 1, h: 1 },
};

/** A plain but honest house: a door on +z, windows, a chimney, a roof with a ridge, and true anchors. */
export function makeHouse(kind: HouseKind, variant: number): BuildingVisual {
  const group = new THREE.Group();
  const roofCol = [PAL.thatch, PAL.tile, PAL.slate, PAL.thatchOld][variant % 4];
  const wallM = mat(tint(kind === 'tower' || kind === 'big' ? PAL.stone : PAL.plaster, variant, 0.05));
  const timber = mat(PAL.timber), roofM = mat(tint(roofCol, variant + 3, 0.05));
  const paneDark = mat(PAL.window), paneLit = mat(PAL.windowLit, { emissive: PAL.windowLit, emissiveIntensity: 1.2 });
  const panes: THREE.Mesh[] = [];
  const windows: THREE.Vector3[] = [];
  const add = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, ry = 0): THREE.Mesh => {
    const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.y = ry; group.add(o); return o;
  };
  const pane = (x: number, y: number, z: number, ry: number, s = 0.2): void => {
    const nx = Math.sin(ry), nz = Math.cos(ry);
    add(new THREE.BoxGeometry(s + 0.05, s + 0.05, 0.03), timber, x + nx * 0.008, y, z + nz * 0.008, ry);
    panes.push(add(new THREE.BoxGeometry(s, s, 0.03), paneDark, x + nx * 0.016, y, z + nz * 0.016, ry));
    windows.push(new THREE.Vector3(x + nx * 0.03, y, z + nz * 0.03));
  };
  let door = new THREE.Vector3(), roof = new THREE.Vector3(), chimney: THREE.Vector3 | null = null, top = 1;

  if (kind === 'tower') {
    const r = 0.56, ht = 1.75;
    add(new THREE.CylinderGeometry(r * 0.94, r, ht, 10), wallM, 0, ht / 2, 0);
    add(new THREE.ConeGeometry(r * 1.25, 0.8, 10), roofM, 0, ht + 0.4, 0);
    add(new THREE.BoxGeometry(0.28, 0.5, 0.05), mat(PAL.door), 0, 0.25, r - 0.005);
    pane(0, 1.3, r * 0.95, 0, 0.18); pane(r * 0.96, 0.8, 0, Math.PI / 2, 0.16);
    door.set(0, 0, r + 0.2); roof.set(0, ht + 0.8, 0); top = ht + 0.8;
  } else if (kind === 'small') {
    add(new THREE.BoxGeometry(0.66, 0.5, 0.66), wallM, 0, 0.25, 0);
    add(new THREE.ConeGeometry(0.6, 0.42, 4).rotateY(Math.PI / 4), roofM, 0, 0.71, 0);
    add(new THREE.BoxGeometry(0.2, 0.36, 0.04), mat(PAL.door), 0, 0.18, 0.335);
    door.set(0, 0, 0.5); roof.set(0, 0.92, 0); top = 0.92;
  } else {
    const bw = DIMS[kind].w - 0.5, bd = DIMS[kind].h - 0.6;
    const wallH = kind === 'tall' ? 1.35 : kind === 'big' ? 0.95 : 0.72;
    const rise = kind === 'tall' ? 0.62 : kind === 'big' ? 0.8 : 0.6;
    add(new THREE.BoxGeometry(bw, wallH, bd), wallM, 0, wallH / 2, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.07, wallH, 0.07), timber, sx * (bw / 2 - 0.02), wallH / 2, sz * (bd / 2 - 0.02));
    if (kind === 'big') {
      add(new THREE.ConeGeometry((bw / 2 + 0.16) * Math.SQRT2, rise, 4).rotateY(Math.PI / 4), roofM, 0, wallH + rise / 2, 0);
    } else if (kind === 'tall') {
      const r = add(gable(bd + 0.24, bw + 0.24, rise), roofM, 0, wallH, 0); r.rotation.y = Math.PI / 2;
    } else {
      add(gable(bw + 0.24, bd + 0.24, rise), roofM, 0, wallH, 0);
    }
    add(new THREE.BoxGeometry(0.28, 0.5, 0.05), mat(variant % 2 ? PAL.doorGreen : PAL.door), 0, 0.25, bd / 2 + 0.005);
    add(new THREE.BoxGeometry(0.36, 0.05, 0.14), mat(PAL.stone), 0, 0.02, bd / 2 + 0.07);
    const wy = 0.44;
    pane(-bw * 0.3, wy, bd / 2, 0); pane(bw * 0.3, wy, bd / 2, 0);
    pane(bw / 2, wy, 0, Math.PI / 2); pane(-bw / 2, wy, 0, -Math.PI / 2);
    if (kind === 'tall') { pane(-bw * 0.25, 1.05, bd / 2, 0); pane(bw * 0.25, 1.05, bd / 2, 0); }
    const cx = bw * 0.28, cz = kind === 'tall' ? -bd * 0.2 : -bd * 0.16, cTop = wallH + rise + 0.2;
    add(new THREE.BoxGeometry(0.22, cTop - wallH, 0.22), mat(PAL.stoneDark), cx, (cTop + wallH) / 2, cz);
    add(new THREE.BoxGeometry(0.27, 0.05, 0.27), mat(PAL.stone), cx, cTop, cz);
    chimney = new THREE.Vector3(cx, cTop + 0.025, cz);
    door.set(0, 0, bd / 2 + 0.22); roof.set(0, wallH + rise, 0); top = cTop + 0.03;
  }
  shadows(group);
  let lit = false;
  return {
    group,
    set(_l: BuildingLook) { /* a stand-in has one look */ },
    update(env: Env) {
      const want = env.night > 0.5;
      if (want !== lit) { lit = want; for (const p of panes) p.material = lit ? paneLit : paneDark; }
    },
    anchors: { door, roof, chimney, top, windows },
    dispose() { group.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); }); },
  };
}

export function makeLook(kind: HouseKind, variant: number, type: BuildingType = 'cottage'): BuildingLook {
  return { type, level: 1, variant, w: DIMS[kind].w, h: DIMS[kind].h, state: 'ready', progress: 1, condition: 90, occupied: [true], toLet: false, squatters: null, flags: [] };
}

export function makeEnv(): Env {
  return { time: 0, dt: 0, monthPhase: 0.4, night: 0, season: 'summer', seasonT: 0.5, snow: 0, wind: 0.35, weather: 'clear', speed: 1 };
}

/** which stand-in suits which visual when the gallery is asked for a mix */
const MIXED: Partial<Record<VisualId, HouseKind>> = {
  purple_paint: 'tower', curse_cloud: 'tower', bats: 'tall', fire: 'long', flood: 'long', crown_banner: 'big', party: 'big',
  stork_nest: 'tall', sparkles: 'tower', gargoyle: 'big', quarantine: 'small', laundry: 'long', boarded: 'tall', sheep: 'long',
};

// ───────────────────────── the gallery scene ─────────────────────────

interface Cell { id: VisualId; kind: HouseKind; root: THREE.Group; house: BuildingVisual; host: VisualHost; handle: VisualHandle | null; reviveAt: number }
type HouseFactory = (look: BuildingLook, ctx: RenderCtx) => BuildingVisual;

function start(): void {
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.autoClear = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 200);
  const env = makeEnv();
  const ctx: RenderCtx = { scene, camera, renderer, env, quality: 'high' };

  const COLS = 6, STEP = 4.2;
  const ROWS = Math.ceil(VISUALS.length / COLS);
  const board = new THREE.Mesh(new THREE.BoxGeometry(COLS * STEP + 1, 0.5, ROWS * STEP + 1), mat(PAL.grassSummer));
  board.position.y = -0.25; board.receiveShadow = true; scene.add(board);
  const table = new THREE.Mesh(new THREE.BoxGeometry(COLS * STEP + 9, 0.4, ROWS * STEP + 9), mat(PAL.oak));
  table.position.y = -0.7; table.receiveShadow = true; scene.add(table);

  const key = new THREE.DirectionalLight(0xffd9a8, 2.4);
  key.position.set(-9, 14, 10); key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  const sc = key.shadow.camera; sc.left = -COLS * STEP / 2 - 2; sc.right = COLS * STEP / 2 + 2; sc.top = ROWS * STEP / 2 + 2; sc.bottom = -ROWS * STEP / 2 - 2; sc.near = 1; sc.far = 50;
  key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02;
  scene.add(key);
  const fill = new THREE.HemisphereLight(0x93a7d8, 0x2a1d14, 0.75); scene.add(fill);
  const rim = new THREE.DirectionalLight(0x6f86c9, 0.5); rim.position.set(8, 6, -9); scene.add(rim);

  const label = (text: string): THREE.Mesh => {
    const cv = document.createElement('canvas'); cv.width = 384; cv.height = 64;
    const c = cv.getContext('2d')!; c.fillStyle = '#efe3c4'; c.fillRect(0, 0, 384, 64); c.fillStyle = '#2a1d14';
    c.font = '34px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 192, 34);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.3), new THREE.MeshBasicMaterial({ map: t }));
    m.rotation.x = -Math.PI / 2; return m;
  };

  const cells: Cell[] = [];
  let kindMode: HouseKind | 'mixed' | 'canon' | 'real' = 'canon';
  let clock = 0;
  const factory = (): HouseFactory | null => (kindMode === 'real' ? createBuildingVisual : null);
  const REAL_TYPES: BuildingType[] = ['cottage', 'hovel', 'longhouse', 'townhouse', 'burrow', 'stonehall', 'wizard_tower', 'treehouse', 'seat', 'tavern', 'chapel', 'bakery'];
  /** where each incident would most likely be seen */
  const REAL_FOR: Partial<Record<VisualId, BuildingType>> = {
    griffin_roof: 'cottage', goblins_windows: 'hovel', purple_paint: 'wizard_tower', leak: 'hovel', small_dragon: 'cottage', ghost: 'stonehall',
    fire: 'longhouse', tax_cart: 'townhouse', curse_cloud: 'wizard_tower', sparkles: 'wizard_tower', cauldron: 'wizard_tower', crown_banner: 'seat',
    party: 'tavern', bunting: 'tavern', snowed_in: 'burrow', mushrooms: 'burrow', toadstool_ring: 'treehouse', bats: 'chapel', gargoyle: 'chapel',
  };

  function build(): void {
    for (const c of cells) { if (c.handle) c.handle.dispose(); c.house.dispose(); scene.remove(c.root); }
    cells.length = 0;
    VISUALS.forEach((id, i) => {
      const kind: HouseKind = kindMode === 'canon' || kindMode === 'real' ? 'cottage' : kindMode === 'mixed' ? (MIXED[id] || (['cottage', 'long', 'tall', 'tower', 'big', 'small'] as HouseKind[])[i % 6]) : kindMode;
      const root = new THREE.Group();
      const col = i % COLS, row = Math.floor(i / COLS);
      root.position.set((col - (COLS - 1) / 2) * STEP, 0, (row - (ROWS - 1) / 2) * STEP);
      const f = factory();
      let look = makeLook(kind, i);
      let house: BuildingVisual;
      if (f) {
        const type = REAL_FOR[id] || REAL_TYPES[i % REAL_TYPES.length], def = BUILDINGS[type];
        look = { ...look, type, w: def.w, h: def.h, level: type === 'seat' ? 2 : 1 };
        try { house = f(look, ctx); house.set(look); } catch (err) { console.warn('[gallery] no model for ' + type, err); look = makeLook(kind, i); house = makeHouse(kind, i); }
      } else house = makeHouse(kind, i);
      root.add(house.group);
      const lb = label(id); lb.position.set(0, 0.012, look.h / 2 + 1.25); root.add(lb);
      scene.add(root);
      const host: VisualHost = { look, visual: house, wx: root.position.x, wz: root.position.z, rotY: 0 };
      const cell: Cell = { id, kind, root, house, host, handle: null, reviveAt: -1 };
      spawn(cell); cells.push(cell);
    });
  }
  function spawn(cell: Cell): void {
    cell.handle = createVisual(cell.id, cell.host, ctx);
    cell.house.group.add(cell.handle.group);
    cell.reviveAt = -1;
  }

  // views
  let tiles: Cell[] | null = null;
  const viewOpt = { yaw: 0.5, pitch: 0.6, dist: 6.4, lift: 0 };
  function aim(cell: Cell | null): void {
    if (!cell) {
      camera.position.set(0, ROWS * STEP * 0.95, ROWS * STEP * 0.98); camera.lookAt(0, 0, 0.6); return;
    }
    const p = cell.root.position, d = viewOpt.dist * (0.8 + 0.1 * Math.max(cell.host.look.w, cell.host.look.h));
    const cy = Math.cos(viewOpt.pitch), sy = Math.sin(viewOpt.pitch);
    const ly = 0.62 + cell.host.visual.anchors.top * 0.22 + viewOpt.lift;
    camera.position.set(p.x + Math.sin(viewOpt.yaw) * cy * d, ly + sy * d, p.z + Math.cos(viewOpt.yaw) * cy * d);
    camera.lookAt(p.x, ly, p.z + 0.25);
  }

  function tick(dt: number): void {
    const n = Math.max(1, Math.ceil(dt / (1 / 30)));
    for (let k = 0; k < n; k++) {
      clock += dt / n; env.time = clock; env.dt = dt / n;
      for (const c of cells) {
        if (tiles && !tiles.includes(c)) continue;
        c.house.update(env);
        if (c.handle) c.handle.update(env);
        else if (c.reviveAt >= 0 && clock >= c.reviveAt) spawn(c);
      }
    }
  }

  let info = { calls: 0, tris: 0 };
  function draw(): void {
    const W = renderer.domElement.width, H = renderer.domElement.height;
    renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
    renderer.setClearColor(mix3(PAL.room, 0x10141f, env.night), 1); renderer.clear();
    renderer.shadowMap.needsUpdate = true;
    renderer.info.autoReset = false; renderer.info.reset();
    if (!tiles) {
      for (const c of cells) c.root.visible = true;
      camera.aspect = W / H; camera.updateProjectionMatrix(); aim(null);
      renderer.render(scene, camera);
    } else {
      const n = tiles.length, cols = n <= 1 ? 1 : n <= 4 ? 2 : 3, rows = Math.ceil(n / cols);
      const tw = Math.floor(W / cols), th = Math.floor(H / rows);
      renderer.setScissorTest(true);
      tiles.forEach((cell, i) => {
        for (const c of cells) c.root.visible = c === cell;
        const cx = (i % cols) * tw, cy = H - (Math.floor(i / cols) + 1) * th;
        renderer.setViewport(cx, cy, tw, th); renderer.setScissor(cx + 1, cy + 1, tw - 2, th - 2);
        camera.aspect = tw / th; camera.updateProjectionMatrix(); aim(cell);
        renderer.shadowMap.needsUpdate = true;
        renderer.render(scene, camera);
      });
    }
    info = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  }
  const mix3 = (a: number, b: number, t: number): number => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();

  function setNight(v: number): void {
    env.night = v; env.monthPhase = v > 0.5 ? 0.9 : 0.4;
    key.intensity = 2.4 * (1 - v) + 0.22 * v; key.color.set(mix3(0xffd9a8, 0x6f8fe0, v));
    fill.intensity = 0.75 * (1 - v) + 0.3 * v; rim.intensity = 0.5 * (1 - v) + 0.25 * v;
  }

  build();
  let lastReal = performance.now();
  function loop(): void {
    const now = performance.now(); const dt = Math.min(0.25, (now - lastReal) / 1000); lastReal = now;
    tick(dt); draw(); requestAnimationFrame(loop);
  }
  loop();
  addEventListener('resize', () => renderer.setSize(innerWidth, innerHeight, false));

  (window as unknown as { __dev: unknown }).__dev = {
    view(ids: VisualId[] | null, opts?: Partial<typeof viewOpt>) {
      Object.assign(viewOpt, opts || {});
      tiles = ids && ids.length ? cells.filter(c => ids.includes(c.id)).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)) : null;
      draw(); return tiles ? tiles.length : cells.length;
    },
    night(v: number) { setNight(v); draw(); },
    wind(v: number) { env.wind = v; },
    snow(v: number) { env.snow = v; env.season = v > 0.3 ? 'winter' : 'summer'; },
    weather(k: WeatherKind) { env.weather = k; },
    leave(ids?: VisualId[]) {
      for (const c of cells) {
        if (ids && !ids.includes(c.id)) continue;
        const h = c.handle; if (!h) continue;
        h.leave(() => { h.dispose(); if (c.handle === h) { c.handle = null; c.reviveAt = clock + 2.5; } });
      }
    },
    step(sec: number) { tick(sec); draw(); return clock; },
    kinds(k: HouseKind | 'mixed' | 'canon' | 'real') { kindMode = k; const keep = tiles ? tiles.map(c => c.id) : null; build(); tiles = keep ? cells.filter(c => keep.includes(c.id)) : null; draw(); },
    stats() { return info; },
    cells,
  };
}

if (typeof document !== 'undefined' && document.getElementById('c')) start();
