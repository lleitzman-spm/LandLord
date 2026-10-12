/**
 * OWNER: render-civic. Dev gallery for the civic bodies (no dependency on render/index).
 *   node tools/shot.mjs src/dev/gallery-civic.ts .tmp/render-civic-x.png --eval "__dev.view('sheet')"
 * __dev.show('all' | type | [[type, variant], ...], variant?)  all eighteen types, eighteen variants of one, or a list
 * __dev.view('overview' | 'sheet', { yaw, pitch, zoom })  whole grid, or one close-up cell per building
 * __dev.view('focus', { only: ['smithy', 'statue'], yaw, pitch, zoom })  a few buildings, large
 * __dev.light('day' | 'dusk' | 'night'), __dev.env (wind, monthPhase...), __dev.stats()
 */
import * as THREE from 'three';
import { CIVIC_BUILDERS } from '../render/buildings/civic';
import { BUILDINGS } from '../data/buildings';
import type { BuildingType } from '../data/ids';
import type { BuildingLook, Env, RenderCtx } from '../render/api';
import type { BuiltBody } from '../render/buildings/types';
import { PAL } from '../render/palette';

const ORDER: BuildingType[] = [
  'tavern', 'mill', 'chapel', 'bakery', 'smithy', 'apothecary',
  'market_stall', 'counting_house', 'bailiffs_post', 'masons_yard', 'garden', 'watchtower',
  'well', 'notice_board', 'shrine', 'stocks', 'statue', 'criers_stand',
];
const COLS = 6, ROWS = 3, CELL = 4;

const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(PAL.room);
const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 200);

const env: Env = { time: 0, dt: 0, monthPhase: 0.4, night: 0, season: 'summer', seasonT: 0.5, snow: 0, wind: 0.45, weather: 'clear', speed: 1 };
const ctx: RenderCtx = { scene, camera, renderer, env, quality: 'high' };

// board and lights
const gw = COLS * CELL, gh = ROWS * CELL;
const board = new THREE.Mesh(new THREE.BoxGeometry(gw + 2, 0.3, gh + 2), new THREE.MeshStandardMaterial({ color: PAL.grassSummer, roughness: 0.95, flatShading: true }));
board.position.y = -0.15; board.receiveShadow = true; scene.add(board);
const edge = new THREE.Mesh(new THREE.BoxGeometry(gw + 2.6, 0.32, gh + 2.6), new THREE.MeshStandardMaterial({ color: PAL.boardEdge, roughness: 0.8 }));
edge.position.y = -0.17; scene.add(edge);
const grid = new THREE.GridHelper(Math.max(gw, gh) + 2, Math.max(gw, gh) + 2, 0x51702c, 0x5f8034);
grid.position.y = 0.002; (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.35; scene.add(grid);
const hemi = new THREE.HemisphereLight(0xa9bce0, 0x4a3420, 0.75); scene.add(hemi);
const key = new THREE.DirectionalLight(0xffd6a6, 2.6);
key.position.set(-9, 14, 10); key.target.position.set(0, 0, 0);
key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
const sc = key.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 50;
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
scene.add(key, key.target);
const fill = new THREE.DirectionalLight(0x8fa6d8, 0.45); fill.position.set(8, 6, -6); scene.add(fill);

interface Placed { type: BuildingType; variant: number; body: BuiltBody; cx: number; cz: number; w: number; h: number }
let placed: Placed[] = [];
const holder = new THREE.Group(); scene.add(holder);

function lookFor(type: BuildingType, variant: number): BuildingLook {
  const d = BUILDINGS[type];
  return { type, level: 1, variant, w: d.w, h: d.h, state: 'ready', progress: 1, condition: 100, occupied: [true], toLet: false, squatters: null, flags: [] };
}
function outline(w: number, h: number, inset: number, color: number, opacity: number): THREE.LineLoop {
  const hw = w / 2 - inset, hh = h / 2 - inset;
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-hw, 0, -hh), new THREE.Vector3(hw, 0, -hh), new THREE.Vector3(hw, 0, hh), new THREE.Vector3(-hw, 0, hh)]);
  const l = new THREE.LineLoop(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  l.position.y = 0.006; return l;
}

function show(what: string | [BuildingType, number][] = 'all', variant = 1): void {
  holder.clear(); placed = [];
  const items: { type: BuildingType; variant: number }[] = Array.isArray(what)
    ? what.slice(0, COLS * ROWS).map(([type, v]) => ({ type, variant: v }))
    : what === 'all'
      ? ORDER.map(t => ({ type: t, variant }))
      : Array.from({ length: COLS * ROWS }, (_, i) => ({ type: what as BuildingType, variant: variant + i }));
  items.forEach((it, i) => {
    const b = CIVIC_BUILDERS[it.type];
    if (!b) return;
    const col = i % COLS, row = Math.floor(i / COLS);
    const cx = (col - (COLS - 1) / 2) * CELL, cz = (row - (ROWS - 1) / 2) * CELL;
    const look = lookFor(it.type, it.variant);
    const body = b(look, ctx);
    body.group.position.set(cx, 0, cz);
    holder.add(body.group);
    const ol = outline(look.w, look.h, 0, PAL.gold, 0.9); ol.position.x = cx; ol.position.z = cz; holder.add(ol);
    const om = outline(look.w, look.h, 0.15, 0xffffff, 0.25); om.position.x = cx; om.position.z = cz; holder.add(om);
    // anchors: red door, blue perch, orange chimney, cyan peek points
    const dot = (p: THREE.Vector3, c: number, s = 0.04) => { const m = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), new THREE.MeshBasicMaterial({ color: c })); m.position.copy(p).add(body.group.position); m.visible = showAnchors; m.userData.anchor = true; holder.add(m); };
    dot(body.anchors.door, 0xff3030); dot(body.anchors.roof, 0x3080ff);
    if (body.anchors.chimney) dot(body.anchors.chimney, 0xff9a20);
    for (const w of body.anchors.windows) dot(w, 0x30ffff, 0.025);
    placed.push({ type: it.type, variant: it.variant, body, cx, cz, w: look.w, h: look.h });
  });
  renderer.shadowMap.needsUpdate = true;
  labels();
}

let showAnchors = false;
function anchors(on: boolean): void { showAnchors = on; holder.traverse(o => { if (o.userData.anchor) o.visible = on; }); }

let mode: 'overview' | 'sheet' | 'focus' = 'overview';
const camOpts = { yaw: 0.55, pitch: 0.82, zoom: 1, only: [] as string[] };
function view(m: 'overview' | 'sheet' | 'focus', o: Partial<typeof camOpts> = {}): void {
  mode = m; Object.assign(camOpts, o); labels();
}
/** the cells drawn in sheet/focus mode, and the grid they sit in */
function cells(): { list: Placed[]; cols: number; rows: number } {
  if (mode !== 'focus') return { list: placed, cols: COLS, rows: ROWS };
  const list = placed.filter(p => camOpts.only.includes(p.type));
  const cols = Math.ceil(Math.sqrt(list.length * 1.6)) || 1;
  return { list, cols, rows: Math.ceil(list.length / cols) || 1 };
}

const labelBox = document.createElement('div');
labelBox.style.cssText = 'position:fixed;inset:0;pointer-events:none;font:12px/1.2 monospace;color:#f2e6c8;';
document.body.appendChild(labelBox);
function labels(): void {
  labelBox.innerHTML = '';
  if (mode === 'overview') return;
  const { list, cols, rows } = cells();
  const cw = innerWidth / cols, ch = innerHeight / rows;
  list.forEach((p, i) => {
    const d = document.createElement('div');
    d.textContent = `${p.type} v${p.variant}`;
    d.style.cssText = `position:absolute;left:${(i % cols) * cw + 4}px;top:${Math.floor(i / cols) * ch + 3}px;text-shadow:0 1px 2px #000`;
    labelBox.appendChild(d);
  });
}

function light(kind: 'day' | 'dusk' | 'night'): void {
  if (kind === 'day') { key.intensity = 2.6; key.color.setHex(0xffd6a6); hemi.intensity = 0.75; env.night = 0; scene.background = new THREE.Color(PAL.room); }
  if (kind === 'dusk') { key.intensity = 1.5; key.color.setHex(0xff9a5a); hemi.intensity = 0.45; env.night = 0.4; }
  if (kind === 'night') { key.intensity = 0.25; key.color.setHex(0x8aa0e0); hemi.intensity = 0.22; env.night = 1; }
  renderer.shadowMap.needsUpdate = true;
}

function stats(): unknown {
  return placed.map(p => {
    let meshes = 0, tris = 0;
    p.body.group.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { meshes++; const g = m.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
    return `${p.type}: ${meshes} meshes, ${Math.round(tris)} tris, walls ${p.body.walls.length} roofs ${p.body.roofs.length} windows ${p.body.windows.length}, top ${p.body.anchors.top.toFixed(2)}`;
  });
}


/** build every type over many variants and seasons, animate each a few frames; returns failures and footprint overhangs */
function robust(): string[] {
  const out: string[] = [];
  const box = new THREE.Box3();
  const seasons: Env['season'][] = ['spring', 'summer', 'autumn', 'winter'];
  for (const type of ORDER) {
    const b = CIVIC_BUILDERS[type];
    if (!b) { out.push(`${type}: no builder`); continue; }
    let worst = 0;
    for (let v = 0; v < 24; v++) {
      try {
        const look = lookFor(type, v);
        const e: Env = { ...env, season: seasons[v % 4], night: (v % 3) / 2, wind: (v % 5) / 4, monthPhase: (v % 7) / 7 };
        const body = b(look, { ...ctx, env: e });
        for (let f = 0; f < 4; f++) { e.time += 0.37; e.dt = 0.05; body.animate?.(e); }
        box.setFromObject(body.group);
        const over = Math.max(box.max.x - look.w / 2, -look.w / 2 - box.min.x, box.max.z - look.h / 2, -look.h / 2 - box.min.z);
        worst = Math.max(worst, over);
        if (!isFinite(body.anchors.top) || body.walls.length + body.roofs.length === 0) out.push(`${type} v${v}: anchors/top or walls/roofs empty`);
      } catch (err) { out.push(`${type} v${v}: THREW ${String((err as Error)?.stack || err).slice(0, 300)}`); }
    }
    out.push(`${type}: worst overhang ${worst.toFixed(3)} (footprint edge = 0, margin target -0.15)`);
  }
  return out;
}

function resize(): void { renderer.setSize(innerWidth, innerHeight, false); labels(); }
addEventListener('resize', resize);
resize();

function placeCam(target: THREE.Vector3, dist: number, aspect: number): void {
  camera.aspect = aspect; camera.updateProjectionMatrix();
  const cp = Math.cos(camOpts.pitch), d = dist / camOpts.zoom;
  camera.position.set(target.x + Math.sin(camOpts.yaw) * cp * d, target.y + Math.sin(camOpts.pitch) * d, target.z + Math.cos(camOpts.yaw) * cp * d);
  camera.lookAt(target);
}

const clock = new THREE.Clock();
const tgt = new THREE.Vector3();
function frame(): void {
  const dt = Math.min(0.05, clock.getDelta());
  env.time += dt; env.dt = dt;
  for (const p of placed) p.body.animate?.(env);
  renderer.shadowMap.needsUpdate = true;
  const W = innerWidth, H = innerHeight;
  if (mode === 'overview') {
    renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
    placeCam(tgt.set(0, 0.3, 0.6), 30, W / H);
    renderer.render(scene, camera);
  } else {
    const { list, cols, rows } = cells();
    const cw = W / cols, ch = H / rows;
    renderer.setScissorTest(true);
    list.forEach((p, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      renderer.setViewport(col * cw, H - (row + 1) * ch, cw, ch);
      renderer.setScissor(col * cw, H - (row + 1) * ch, cw, ch);
      const size = Math.max(p.w, p.h, p.body.anchors.top * 0.8);
      placeCam(tgt.set(p.cx, Math.min(p.body.anchors.top * 0.38, 1.1), p.cz), 1.6 + size * 1.55, cw / ch);
      renderer.render(scene, camera);
    });
  }
  requestAnimationFrame(frame);
}

show('all', 1);
frame();
(window as unknown as { __dev: unknown }).__dev = { show, view, light, env, stats, anchors, camOpts, robust };
