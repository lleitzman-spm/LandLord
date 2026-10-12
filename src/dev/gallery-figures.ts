/**
 * Dev gallery for the living figurines (render-figures). Its own lit scene; no
 * dependency on render/index.
 *
 *   node tools/shot.mjs src/dev/gallery-figures.ts .tmp/render-figures-x.png --w 1600 --h 1000 \
 *        --eval "__dev.sheet(['lineup','faces','anims','crowd'])" --shots 3 --every 500
 *
 * window.__dev:
 *   view(name)            one camera: lineup | faces | rulers | trades | trades2 | npcs | anims | anims2 | emotes | crowd | crowdNear | far
 *   sheet([names])        several views tiled in one frame (a contact sheet)
 *   setPhase(p)           month phase 0..1 for the crowd (0 dawn, 0.75 dusk, 0.9 night)
 *   setSpeed(s)           game speed for the crowd
 *   event(e)              push a SimEvent at both layers
 *   emoteAll(), feast(), griffin(on), rain(on), select(i), evict(), arrive(), stats()
 */
import * as THREE from 'three';
import { createLivingFigure, type LivingFigure } from '../render/figures';
import { createTownLife, type LayerHelpers, type FigureLayer } from '../render/townlife';
import { createActorLayer } from '../render/actors';
import type { Env, RenderCtx } from '../render/api';
import { PAL, mat } from '../render/palette';
import { SPECIES, TRADES, NPCS, ANIMS, EMOTES, type AnimId } from '../data/ids';
import { MAP_W, MAP_H, type GameState, type SimEvent, type Actor } from '../sim/types';
import { makeFixtureState } from './fixture';
import { BUILDINGS } from '../data/buildings';
import type { PropId } from '../render/figures';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color(PAL.room);
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 200);

const env: Env = { time: 0, dt: 1 / 60, monthPhase: 0.3, night: 0, season: 'spring', seasonT: 0.5, snow: 0, wind: 0.2, weather: 'clear', speed: 1 };
const ctx: RenderCtx = { scene, camera, renderer, env, quality: 'high' };

// ───────────── light: a candle key against a cool fill ─────────────
const key = new THREE.DirectionalLight(0xffd2a0, 2.6);
key.position.set(-7, 11, 9); key.castShadow = true;
key.shadow.mapSize.set(4096, 4096); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
const sc = key.shadow.camera; sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 60;
scene.add(key, key.target);
const hemi = new THREE.HemisphereLight(0x8fa6d8, 0x3a2a1c, 0.75); scene.add(hemi);
const rim = new THREE.DirectionalLight(0x9db4ff, 0.5); rim.position.set(8, 6, -10); scene.add(rim);

// ───────────── the stage: an oak table and a strip of green baize ─────────────
const table = new THREE.Mesh(new THREE.BoxGeometry(80, 0.4, 60), mat(PAL.oak, { rough: 0.7 })); table.position.set(0, -0.26, 0); table.receiveShadow = true; scene.add(table);
function strip(x: number, z: number, w: number, d: number, c: number = PAL.grassSpring): void {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), mat(c)); m.position.set(x, -0.03, z); m.receiveShadow = true; scene.add(m);
}

// ───────────── zone A: the line-up ─────────────
const GX = -30;       // galleries sit well to the west of the crowd board
const figs: LivingFigure[] = [];
function put(f: LivingFigure, x: number, z: number, heading = 0): LivingFigure {
  f.group.position.set(x, 0, z); f.setHeading(heading, true); scene.add(f.group); figs.push(f); return f;
}
strip(GX, 0, 13, 1.6);
{
  let x = GX - 5.6;
  const step = 0.56;
  for (const sp of SPECIES) { put(createLivingFigure({ species: sp, seed: 11 + SPECIES.indexOf(sp) * 7 }, ctx), x, 0); x += sp === 'ogre' ? step * 1.2 : step; }
  put(createLivingFigure({ species: 'human', seed: 301, child: true }, ctx), x, 0.1); x += step * 0.7;
  put(createLivingFigure({ species: 'halfling', seed: 302, child: true }, ctx), x, 0.1); x += step * 0.7;
  put(createLivingFigure({ species: 'dwarf', seed: 303, child: true }, ctx), x, 0.1); x += step * 0.7;
  put(createLivingFigure({ species: 'goblin', seed: 304, child: true }, ctx), x, 0.1); x += step * 0.9;
  for (const role of ['mason', 'bailiff', 'crier', 'steward'] as const) { put(createLivingFigure({ species: role === 'bailiff' ? 'dwarf' : role === 'crier' ? 'halfling' : 'human', role, seed: 500 + role.length * 13 }, ctx), x, 0); x += step; }
  x += 0.2;
  for (const rank of ['reeve', 'knight', 'baron', 'duke', 'king'] as const) { put(createLivingFigure({ species: 'human', role: 'ruler', rank, seed: 4711 }, ctx), x, 0); x += step * 1.08; }
}
// zone B: every trade (two rows), with a spread of species
strip(GX, 2.2, 13, 2.2);
TRADES.forEach((tr, i) => {
  const sp = SPECIES[[0, 0, 1, 0, 2, 0, 3, 0, 4, 0, 5, 0, 1, 2][i % 14]!]!;
  put(createLivingFigure({ species: sp, trade: tr, seed: 700 + i * 31 }, ctx), GX - 5.6 + (i % 14) * 0.84, 1.7 + Math.floor(i / 14) * 0.95);
});
// zone C: the court visitors
strip(GX, 4.6, 13, 1.4);
NPCS.forEach((id, i) => put(createLivingFigure({ species: 'human', npc: id, seed: 900 + i * 17 }, ctx), GX - 5.6 + i * 0.8, 4.6));
// zone D: every animation
strip(GX, 6.6, 13, 1.6);
const ANIM_PROP: Partial<Record<AnimId, PropId>> = { hammer: 'hammer', sweep: 'broom', carry: 'sack', read: 'scroll', count: 'purse', knock: 'none', point: 'none', talk: 'none', wave: 'none', dance: 'lute', shake_fist: 'pitchfork' };
const animFigs: LivingFigure[] = [];
ANIMS.forEach((a, i) => {
  const sp = SPECIES[[0, 0, 1, 2, 0, 3, 1, 0, 3, 0, 5, 4, 1, 2, 0, 3, 0, 1, 4, 0][i]!]!;
  const f = put(createLivingFigure({ species: sp, seed: 1200 + i * 53 }, ctx), GX - 5.6 + i * 0.59, 6.6);
  f.setProp(ANIM_PROP[a] ?? 'none'); f.setAnim(a);
  if (a === 'walk' || a === 'carry') f.setGait(0.8); else if (a === 'run') f.setGait(2.4);
  if (a === 'walk') f.setMood(0.6);
  animFigs.push(f);
});
// zone D2: walks by mood, the sitter, the waiter, emotes
strip(GX, 8.4, 13, 1.4);
const emoteFigs: LivingFigure[] = [];
{
  const moods = [0.05, 0.3, 0.6, 0.95];
  moods.forEach((m, i) => { const f = put(createLivingFigure({ species: 'human', trade: 'farmer', seed: 1500 + i }, ctx), GX - 5.6 + i * 0.6, 8.4); f.setAnim('walk'); f.setGait(0.75); f.setMood(m); });
  const s1 = put(createLivingFigure({ species: 'halfling', trade: 'weaver', seed: 1510 }, ctx), GX - 2.9, 8.4); s1.setSit(true);
  const s2 = put(createLivingFigure({ species: 'goblin', trade: 'scribe', seed: 1511 }, ctx), GX - 2.3, 8.4); s2.setRestless(1);
  EMOTES.forEach((e, i) => { const f = put(createLivingFigure({ species: SPECIES[i % 6]!, seed: 1600 + i * 3 }, ctx), GX - 1.5 + i * 0.52, 8.4); emoteFigs.push(f); void e; });
}
function emoteAll(): void { emoteFigs.forEach((f, i) => f.emote(EMOTES[i]!)); }

// ───────────── zone E: a little town, driven by the real layers ─────────────
let state: GameState = makeFixtureState('knight', 34.4);
const board = new THREE.Group(); scene.add(board);
const toWX = (x: number) => x - MAP_W / 2, toWZ = (y: number) => y - MAP_H / 2;
const houseMats: Record<string, number> = { housing: PAL.plaster, commercial: PAL.plasterWarm, amenity: PAL.stone, staff: PAL.plasterGrey, seat: PAL.stoneWarm };
function buildBoard(): void {
  board.clear();
  const g = new THREE.Mesh(new THREE.BoxGeometry(MAP_W, 0.2, MAP_H), mat(PAL.grassSpring)); g.position.y = -0.1; g.receiveShadow = true; board.add(g);
  const tileGeo = new THREE.BoxGeometry(1, 0.02, 1);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = state.map.tiles[y * MAP_W + x]!;
    const c = t.t === 'road' ? PAL.road : t.t === 'bridge' ? PAL.timberLight : t.t === 'water' ? PAL.water : t.t === 'field' ? PAL.field : t.t === 'rock' ? PAL.rock : t.t === 'forest' ? PAL.pine : 0;
    if (!c) continue;
    const m = new THREE.Mesh(tileGeo, mat(c)); m.position.set(toWX(x) + 0.5, 0.005, toWZ(y) + 0.5); m.receiveShadow = true; board.add(m);
    if (t.t === 'forest') { const tr = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.1, 6), mat(PAL.pine)); tr.position.set(toWX(x) + 0.5, 0.6, toWZ(y) + 0.5); tr.castShadow = true; board.add(tr); }
    if (t.t === 'rock') { const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3, 0), mat(PAL.rock)); rk.position.set(toWX(x) + 0.5, 0.15, toWZ(y) + 0.5); rk.castShadow = true; board.add(rk); }
  }
  for (const b of Object.values(state.buildings)) {
    const def = BUILDINGS[b.type];
    const small = def.category === 'amenity';
    // stand-ins only, kept low so the people in front of them can be seen
    const hgt = small ? (b.type === 'watchtower' ? 1.2 : b.type === 'garden' ? 0.08 : 0.36) : 0.44 + (b.type === 'seat' ? 0.3 : 0);
    const grp = new THREE.Group(); grp.position.set(toWX(b.x + b.w / 2), 0, toWZ(b.y + b.h / 2));
    const inset = small ? 0.46 : 0.74;
    const body = new THREE.Mesh(new THREE.BoxGeometry(b.w * inset, hgt, b.h * inset), mat(b.type === 'garden' ? PAL.leafSummer : houseMats[def.category] ?? PAL.plaster));
    body.position.y = hgt / 2; body.castShadow = true; body.receiveShadow = true; grp.add(body);
    if (!small) {
      const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w * inset + 0.12, 0.1, b.h * inset + 0.12), mat(def.category === 'housing' ? PAL.thatch : def.category === 'seat' ? PAL.slate : PAL.tile)); roof.position.y = hgt + 0.05; roof.castShadow = true; grp.add(roof);
      // a door, so the front can be told
      const d = doorTile(b.id)!;
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.46, 0.06), mat(PAL.door));
      door.position.set(toWX(d[0]) - grp.position.x, 0.23, toWZ(d[1]) - grp.position.z);
      const fx = Math.sign(Math.round((d[0] - (b.x + b.w / 2)) * 10)), fz = Math.sign(Math.round((d[1] - (b.y + b.h / 2)) * 10));
      door.position.x -= (Math.abs(d[0] - (b.x + b.w / 2)) > b.w / 2 ? fx : 0) * (0.3 + b.w * (1 - inset) / 2 - 0.02);
      door.position.z -= (Math.abs(d[1] - (b.y + b.h / 2)) > b.h / 2 ? fz : 0) * (0.3 + b.h * (1 - inset) / 2 - 0.02);
      if (b.rot % 2) door.rotation.y = Math.PI / 2;
      grp.add(door);
    }
    if (b.visuals.includes('griffin_roof')) { const gr = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), mat(PAL.gold)); gr.position.y = hgt + 0.8; gr.castShadow = true; grp.add(gr); }
    if (b.visuals.includes('fire')) { const fr = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.9, 5), mat(PAL.fire, { emissive: PAL.fire })); fr.position.y = hgt + 0.9; grp.add(fr); }
    board.add(grp);
  }
}
/** tile-space point just outside a building's door */
function doorTile(id: string): [number, number] | null {
  const b = state.buildings[id]; if (!b) return null;
  const f = ([[0, 1], [-1, 0], [0, -1], [1, 0]] as const)[b.rot]!;
  return [b.x + b.w / 2 + f[0] * (b.w / 2 + 0.3), b.y + b.h / 2 + f[1] * (b.h / 2 + 0.3)];
}
const helpers: LayerHelpers = {
  doorOf(id) { const d = doorTile(id); return d ? new THREE.Vector3(toWX(d[0]), 0, toWZ(d[1])) : null; },
  topOf(id) { const b = state.buildings[id]; return b ? new THREE.Vector3(toWX(b.x + b.w / 2), 1.6, toWZ(b.y + b.h / 2)) : null; },
  propPos() { return new THREE.Vector3(MAP_W / 2 + 2, 0.4, 0); },
};
buildBoard();
const town = createTownLife(ctx, helpers);
const actors: FigureLayer = createActorLayer(ctx, helpers);
town.reset(state); actors.reset(state);

// a toy sim: the clock runs, and fixture actors pace their little beats
let speed = 1;
const pending: SimEvent[] = [];
const beats = new Map<string, { a: [number, number]; b: [number, number]; to: 0 | 1; wait: number }>();
function toySim(dt: number): void {
  const dDays = dt * speed / 3;
  state.day += dDays; state.speed = speed as GameState['speed'];
  for (const a of Object.values(state.actors) as Actor[]) {
    if (a.kind === 'ruler' || a.kind === 'staff') {
      let bt = beats.get(a.id);
      if (!bt) { const far: [number, number] = a.kind === 'ruler' ? [13.5, 12.5] : [a.x + 4 - (a.id.length % 2) * 7, a.y + (a.id.charCodeAt(1) % 3) - 1]; bt = { a: [a.x, a.y], b: far, to: 1, wait: 1 + Math.random() * 2 }; beats.set(a.id, bt); }
      if (a.jobId) continue;
      if (bt.wait > 0) { bt.wait -= dt * speed; a.state = a.kind === 'staff' && bt.to === 0 ? 'working' : 'idle'; continue; }
      const tgt = bt.to ? bt.b : bt.a, dx = tgt[0] - a.x, dy = tgt[1] - a.y, d = Math.hypot(dx, dy), stepLen = a.speed * dDays;
      if (d <= stepLen) { a.x = tgt[0]; a.y = tgt[1]; bt.to = bt.to ? 0 : 1; bt.wait = 3 + Math.random() * 3; a.state = 'idle'; a.path = []; }
      else { a.x += dx / d * stepLen; a.y += dy / d * stepLen; a.facing = Math.atan2(dx, dy); a.state = 'walking'; a.path = [tgt]; }
    }
  }
}
function monthPhaseOf(day: number): number { return (((day % 30) + 30) % 30) / 30; }
function nightOf(p: number): number { const a = (p - 0.8) / 0.06, b = (0.99 - p) / 0.04; return Math.max(0, Math.min(1, Math.min(a, b))); }

// ───────────── cameras ─────────────
interface View { pos: [number, number, number]; at: [number, number, number]; fov?: number }
const VIEWS: Record<string, View> = {
  lineup: { pos: [GX, 3.6, 5.6], at: [GX, 0.25, 0], fov: 50 },
  species: { pos: [GX - 3.6, 1.5, 2.6], at: [GX - 3.6, 0.28, 0], fov: 40 },
  faces: { pos: [GX - 4.2, 1.15, 1.75], at: [GX - 4.2, 0.3, 0], fov: 34 },
  staff: { pos: [GX + 0.55, 1.35, 2.2], at: [GX + 0.55, 0.28, 0], fov: 34 },
  rulers: { pos: [GX + 3.75, 1.4, 2.3], at: [GX + 3.75, 0.3, 0], fov: 36 },
  trades: { pos: [GX - 2.8, 2.6, 5.4], at: [GX - 2.8, 0.25, 2.1], fov: 40 },
  trades2: { pos: [GX + 2.9, 2.6, 5.4], at: [GX + 2.9, 0.25, 2.1], fov: 40 },
  npcs: { pos: [GX - 2.9, 2.0, 7.4], at: [GX - 2.9, 0.3, 4.6], fov: 40 },
  npcs2: { pos: [GX + 2.9, 2.0, 7.4], at: [GX + 2.9, 0.3, 4.6], fov: 40 },
  anims: { pos: [GX - 2.85, 2.3, 9.9], at: [GX - 2.85, 0.3, 6.6], fov: 38 },
  anims2: { pos: [GX + 2.95, 2.3, 9.9], at: [GX + 2.95, 0.3, 6.6], fov: 38 },
  emotes: { pos: [GX + 0.2, 2.2, 12.0], at: [GX + 0.2, 0.35, 8.4], fov: 40 },
  far: { pos: [GX, 13, 17], at: [GX, 0, 4], fov: 35 },
  crowd: { pos: [-2.6, 9.5, 10.5], at: [-2.6, 0, 0.9], fov: 35 },
  crowdNear: { pos: [-3.0, 4.6, 6.6], at: [-3.3, 0.2, 1.3], fov: 32 },
  centre: { pos: [-2.7, 5.6, 7.6], at: [-3.1, 0.2, 1.0], fov: 30 },
  seat: { pos: [-4.4, 3.9, 3.3], at: [-5.7, 0.25, -0.5], fov: 28 },
  east: { pos: [3.4, 4.6, 7.6], at: [2.3, 0.2, 1.4], fov: 32 },
  fields: { pos: [-4.2, 4.2, 13.2], at: [-4.2, 0.2, 7.2], fov: 32 },
  gate: { pos: [-11.5, 4.2, 6.2], at: [-11.5, 0.2, 0.6], fov: 32 },
  game: { pos: [-1.5, 14.5, 13.5], at: [-1.5, 0, 1], fov: 30 },
};
// windows: a closer camera stepped along each row, for contact sheets
for (let i = 0; i < 4; i++) VIEWS['s' + i] = { pos: [GX - 4.5 + i * 2.75, 1.75, 2.75], at: [GX - 4.5 + i * 2.75, 0.3, 0], fov: 36 };
for (let i = 0; i < 3; i++) VIEWS['t' + i] = { pos: [GX - 3.95 + i * 4.2 - (i === 2 ? 0.4 : 0), 2.9, 5.3], at: [GX - 3.95 + i * 4.2 - (i === 2 ? 0.4 : 0), 0.25, 2.15], fov: 36 };
for (let i = 0; i < 3; i++) VIEWS['n' + i] = { pos: [GX - 4.0 + i * 4.0, 1.9, 7.5], at: [GX - 4.0 + i * 4.0, 0.3, 4.6], fov: 38 };
for (let i = 0; i < 4; i++) VIEWS['a' + i] = { pos: [GX - 4.45 + i * 2.95, 1.9, 9.6], at: [GX - 4.45 + i * 2.95, 0.3, 6.6], fov: 36 };
for (let i = 0; i < 2; i++) VIEWS['e' + i] = { pos: [GX - 4.2 + i * 5.1, 2.0, 11.4], at: [GX - 4.2 + i * 5.1 + (i ? 0.6 : 0), 0.35, 8.4], fov: i ? 44 : 36 };
let sheet: string[] = ['lineup'];
function applyView(v: View, aspect: number): void {
  camera.fov = v.fov ?? 35; camera.aspect = aspect; camera.position.set(...v.pos); camera.lookAt(...v.at); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
}

// ───────────── loop ─────────────
let last = performance.now(), frames = 0, fpsT = 0, fps = 0, cpuMs = 0;
let selIdx = -1;
/** one step of everything but the drawing */
function tick(dt: number): void {
  env.dt = dt; env.time += dt; env.speed = speed;
  toySim(dt);
  env.monthPhase = monthPhaseOf(state.day); env.night = nightOf(env.monthPhase);
  key.intensity = 2.6 * (1 - env.night * 0.86); hemi.intensity = 0.75 - env.night * 0.3;
  const c0 = performance.now();
  if (pending.length) { const ev = pending.splice(0); town.handleEvents(ev, state); actors.handleEvents(ev, state); }
  town.sync(state); actors.sync(state);
  town.update(env); actors.update(env);
  for (let i = 0; i < figs.length; i++) figs[i]!.update(env);
  cpuMs = cpuMs * 0.95 + (performance.now() - c0) * 0.05;
}
/** run the scene forward without drawing it (headless Chromium draws slowly; the figures do not need it to) */
function advance(seconds: number): void {
  const n = Math.max(1, Math.round(seconds * 30));
  for (let i = 0; i < n; i++) tick(1 / 30);
}
function frame(): void {
  const now = performance.now();
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  tick(dt);

  const W = renderer.domElement.width, Hh = renderer.domElement.height;
  const n = sheet.length, cols = n <= 1 ? 1 : n <= 4 ? 2 : 3, rows = Math.ceil(n / cols);
  renderer.setScissorTest(true);
  for (let i = 0; i < n; i++) {
    const v = VIEWS[sheet[i]!] ?? VIEWS.lineup!;
    const w = Math.floor(W / cols), h = Math.floor(Hh / rows), x = (i % cols) * w, y = Hh - (Math.floor(i / cols) + 1) * h;
    renderer.setViewport(x, y, w, h); renderer.setScissor(x, y, w, h);
    key.target.position.set(v.at[0], 0, v.at[2]); key.position.set(v.at[0] - 7, 11, v.at[2] + 9); key.target.updateMatrixWorld();
    applyView(v, w / h);
    renderer.render(scene, camera);
  }
  frames++; fpsT += dt; if (fpsT > 1) { fps = frames / fpsT; frames = 0; fpsT = 0; }
  requestAnimationFrame(frame);
}
addEventListener('resize', () => renderer.setSize(innerWidth, innerHeight, false));

const tenantIds = () => Object.values(state.tenants).filter(t => t.status === 'housed').map(t => t.id);
(window as unknown as { __dev: unknown }).__dev = {
  view(name: string) { sheet = [name]; },
  sheet(names: string[]) { sheet = names; },
  setPhase(p: number) { state.day = Math.floor(state.day / 30) * 30 + p * 30; },
  setSpeed(s: number) { speed = s; },
  event(e: SimEvent) { pending.push(e); },
  emoteAll,
  feast() { pending.push({ type: 'sfx', id: 'cheer' }); },
  griffin(on: boolean) { const b = Object.values(state.buildings).find(x => x.name === 'Thistle Cottage')!; b.visuals = on ? ['griffin_roof'] : []; pending.push({ type: 'building_changed', buildingId: b.id }); buildBoard(); },
  fire(on: boolean) { const b = Object.values(state.buildings).find(x => x.name === 'The Cheese Plank')!; b.visuals = on ? ['fire'] : []; pending.push({ type: 'building_changed', buildingId: b.id }); buildBoard(); },
  rain(on: boolean) { state.weather = on ? 'rain' : 'clear'; env.weather = state.weather; pending.push({ type: 'weather', kind: state.weather }); },
  select(i: number) { selIdx = i; const ids = tenantIds(); town.setSelected(i < 0 ? null : ids[i % ids.length]!); },
  selectRuler() { const r = Object.values(state.actors).find(a => a.kind === 'ruler'); actors.setSelected(r ? r.id : null); },
  evict(i = 2) {
    const id = tenantIds()[i]!; const t = state.tenants[id]!; const bId = t.buildingId!;
    state.buildings[bId]!.units[t.unit]!.tenantId = null; t.status = 'evicted'; t.buildingId = null;
    pending.push({ type: 'tenant_out', tenantId: id, buildingId: bId, unit: t.unit, reason: 'evicted' });
  },
  arrive() {
    const b = Object.values(state.buildings).find(x => x.name === 'Damp End')!;
    const id = 'tnew' + Math.floor(Math.random() * 1e6);
    state.tenants[id] = { ...Object.values(state.tenants)[0]!, id, name: 'Jory Applewhite', first: 'Jory', species: 'halfling', trade: 'carpenter', household: 3, portraitSeed: 4242, buildingId: b.id, unit: 0, happiness: 80, status: 'housed', arrears: 0, lateStage: 'none' };
    b.units[0]!.tenantId = id; b.squatters = null;
    pending.push({ type: 'tenant_in', tenantId: id, buildingId: b.id, unit: 0 });
  },
  collect() { for (const b of Object.values(state.buildings)) b.units.forEach((u, i) => { if (u.purse > 0) { pending.push({ type: 'purse_collected', buildingId: b.id, unit: i, amount: u.purse, byActor: null }); u.purse = 0; } }); },
  promote() { state.realm.rank = 'baron'; pending.push({ type: 'promotion', rank: 'baron' }); },
  job(kind: string) {
    const r = Object.values(state.actors).find(a => a.kind === 'ruler')!; const b = Object.values(state.buildings).find(x => x.name === 'The Leaning Hovel')!;
    const d = doorTile(b.id)!; r.x = d[0]; r.y = d[1]; r.state = 'working'; r.jobId = 'jx';
    state.jobs.jx = { id: 'jx', kind: kind as never, role: 'ruler', state: 'working', assignee: r.id, buildingId: b.id, unit: 0, tenantId: null, applicantId: null, incidentId: null, outcomeId: null, x: d[0], y: d[1], workDays: 1, progress: 0.3, cost: 0, priority: 0, createdDay: state.day, byRuler: true };
    pending.push({ type: 'job', jobId: 'jx', phase: 'arrive' });
  },
  reset(rank: 'reeve' | 'knight' | 'baron' = 'knight', day = 34.4) { state = makeFixtureState(rank, day); beats.clear(); buildBoard(); town.reset(state); actors.reset(state); },
  advance,
  /** staged moments for screenshots: dawn | day | feast | fire | moving | night | select */
  scene(name: string) {
    const dev = (window as unknown as { __dev: Record<string, (...a: unknown[]) => unknown> }).__dev;
    const until = (ph: number) => { let guard = 0; while (Math.abs(monthPhaseOf(state.day) - ph) > 0.006 && guard++ < 4000) tick(1 / 30); };
    switch (name) {
      case 'dawn': dev.reset!('knight', 59.6); until(0.03); dev.job!('collect'); advance(1.4); break;
      case 'day': advance(12); break;
      case 'feast': advance(9); dev.feast!(); advance(1.7); break;
      case 'fire': advance(9); dev.fire!(true); advance(2.4); break;
      case 'moving': advance(6); dev.evict!(2); dev.arrive!(); advance(5.5); break;
      case 'night': {
        dev.reset!('knight', 52.5);
        const ts = Object.values(state.tenants).filter(t => t.status === 'housed');
        ts[1]!.traits.push('sleepwalker'); ts[4]!.traits.push('nocturnal');
        town.reset(state);
        until(0.9); break;
      }
      case 'select': advance(9); dev.select!(1); dev.selectRuler!(); dev.job!('repair'); advance(1.3); break;
      default: break;
    }
    return JSON.stringify({ phase: +env.monthPhase.toFixed(3), town: town.debug.census() });
  },
  stats() { return { fps: +fps.toFixed(1), cpuMs: +cpuMs.toFixed(2), calls: renderer.info.render.calls, tris: renderer.info.render.triangles, figs: figs.length, phase: +env.monthPhase.toFixed(3), sel: selIdx }; },
  get state() { return state; },
  town, actors,
};
frame();
