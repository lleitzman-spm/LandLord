/**
 * Dev gallery for render/fx: a small lit stand-in of the war table (oak top,
 * the realm board, box houses with chimneys, a coffer) with hooks to fire
 * every effect and switch weather, season and time of day.
 *
 *   node tools/shot.mjs src/dev/gallery-fx.ts .tmp/render-fx-x.png --eval "__dev.scene('rent')"
 *
 * window.__dev: rentDay(n), puff(i), sparkle(i), hearts(i), confetti(i), weather(kind, now),
 * season(s, t), phase(p), wind(w), speed(s), cam(name), advance(seconds), hold(on),
 * strike(), birds(reach), stats(), fxCalls(), scene(name), sheet([names], cols)
 *
 * sheet() renders several canned scenes into one frame (a contact sheet), so a
 * single screenshot checks many effects:
 *   node tools/shot.mjs src/dev/gallery-fx.ts .tmp/render-fx-sheet.png --w 1600 --h 1000 \
 *     --eval "__dev.sheet(['rain','snow','hail','fog'])"
 */
import * as THREE from 'three';
import { createFxDev } from '../render/fx';
import type { Env, RenderCtx } from '../render/api';
import type { WeatherKind, Season } from '../sim/types';
import { MAP_W, MAP_H } from '../sim/types';
import { PAL, mat } from '../render/palette';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(PAL.room);
// the game's own camera: fov 30 at a laptop aspect, about 30 units out, pitched 50 degrees
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 300);

// ── the table and the board ──
const TABLE_TOP = -0.6;
const table = new THREE.Mesh(new THREE.BoxGeometry(64, 1, 50), mat(PAL.oak));
table.position.y = TABLE_TOP - 0.5; table.receiveShadow = true; scene.add(table);
const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(MAP_W + 1.2, 0.66, MAP_H + 1.2), mat(PAL.boardEdge));
frameMesh.position.y = -0.33 - 0.01; frameMesh.receiveShadow = true; frameMesh.castShadow = true; scene.add(frameMesh);
const boardMat = mat(PAL.grassSpring, {}, true);
const board = new THREE.Mesh(new THREE.BoxGeometry(MAP_W, 0.6, MAP_H), boardMat);
board.position.y = -0.3; board.receiveShadow = true; scene.add(board);
// a dirt road across the board for something to look at
const road = new THREE.Mesh(new THREE.BoxGeometry(MAP_W, 0.02, 1.4), mat(PAL.road));
road.position.set(0, 0.0, 3.6); road.receiveShadow = true; scene.add(road);

// ── houses (stand-ins with honest roof and chimney anchors) ──
interface House { roof: THREE.Vector3; chimney: THREE.Vector3; top: THREE.Vector3 }
const houses: House[] = [];
const wallGeo = new THREE.BoxGeometry(1.5, 1.0, 1.3);
const roofGeo = new THREE.ConeGeometry(1.2, 0.85, 4);
const chimGeo = new THREE.BoxGeometry(0.22, 0.6, 0.22);
const roofCols = [PAL.thatch, PAL.tile, PAL.slate, PAL.thatchOld];
let hseed = 7;
const hr = () => { hseed = (hseed * 16807) % 2147483647; return hseed / 2147483647; };
for (let row = 0; row < 4; row++) {
  for (let col = 0; col < 5; col++) {
    const x = -3 + col * 3.3 + (hr() - 0.5) * 0.8;
    const z = -8.5 + row * 3.9 + (hr() - 0.5) * 0.6 + (row >= 3 ? 1.6 : 0);
    const g = new THREE.Group();
    const walls = new THREE.Mesh(wallGeo, mat(row % 2 ? PAL.plaster : PAL.plasterWarm)); walls.position.y = 0.5;
    const roof = new THREE.Mesh(roofGeo, mat(roofCols[(row + col) % 4])); roof.position.y = 1.42; roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.9);
    const chim = new THREE.Mesh(chimGeo, mat(PAL.stone)); chim.position.set(0.42, 1.55, -0.2);
    g.add(walls, roof, chim);
    g.position.set(x, 0, z);
    g.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    scene.add(g);
    houses.push({ roof: new THREE.Vector3(x, 1.75, z), chimney: new THREE.Vector3(x + 0.42, 1.88, z - 0.2), top: new THREE.Vector3(x, 2.0, z) });
  }
}
// a few cone trees to the west
for (let k = 0; k < 14; k++) {
  const tx = -14 + hr() * 9, tz = -10 + hr() * 20;
  const t = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.6, 6), mat(PAL.pine));
  t.position.set(tx, 1.0, tz); t.castShadow = true; t.receiveShadow = true;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.3, 5), mat(PAL.trunk));
  trunk.position.set(tx, 0.15, tz);
  scene.add(t, trunk);
}
// ── the coffer, on the table beside the board ──
const COFFER = new THREE.Vector3(18.4, TABLE_TOP, 1.5);
const cofferBox = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.85, 1.2), mat(PAL.oakDark));
cofferBox.position.set(COFFER.x, TABLE_TOP + 0.425, COFFER.z); cofferBox.castShadow = true; cofferBox.receiveShadow = true; scene.add(cofferBox);
const pile = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(PAL.gold, { metal: 0.6, rough: 0.35 }));
pile.scale.set(1.1, 0.35, 0.7); pile.position.set(COFFER.x, TABLE_TOP + 0.85, COFFER.z); scene.add(pile);
const lid = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 1.2), mat(PAL.oakDark));
lid.position.set(COFFER.x, TABLE_TOP + 1.25, COFFER.z - 0.75); lid.rotation.x = -1.1; lid.castShadow = true; scene.add(lid);
const COIN_TARGET = new THREE.Vector3(COFFER.x, TABLE_TOP + 1.0, COFFER.z);

// ── light (a stand-in for render-core's month light) ──
const key = new THREE.DirectionalLight(0xffe2b8, 2.6);
key.position.set(-14, 22, 12); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
const sc = key.shadow.camera; sc.left = -24; sc.right = 24; sc.top = 20; sc.bottom = -20; sc.near = 1; sc.far = 80;
key.shadow.bias = -0.0005;
scene.add(key, key.target);
const fill = new THREE.DirectionalLight(0x8fa8ff, 0.3);
fill.position.set(12, 14, -10); scene.add(fill, fill.target);
const hemi = new THREE.HemisphereLight(0x9fb0d8, 0x3a2615, 0.55);
scene.add(hemi);
const candles: THREE.PointLight[] = [];
for (const [cx, cz] of [[-19, -14], [21, -12], [-20, 14], [23, 13]]) {
  const c = new THREE.PointLight(PAL.flame, 40, 30, 1.6);
  c.position.set(cx, 2.4, cz); scene.add(c); candles.push(c);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 2.2, 10), mat(PAL.wax));
  stick.position.set(cx, TABLE_TOP + 1.1, cz); stick.castShadow = true; scene.add(stick);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), mat(PAL.flameCore, { emissive: PAL.flame, emissiveIntensity: 3 }));
  flame.position.set(cx, TABLE_TOP + 2.35, cz); flame.scale.y = 1.7; scene.add(flame);
}

// ── env and fx ──
const env: Env = {
  time: 0, dt: 0, monthPhase: 0.35, night: 0, season: 'spring', seasonT: 0.4, snow: 0, wind: 0.35, weather: 'clear', speed: 1,
};
const ctx: RenderCtx = { scene, camera, renderer, env, quality: 'high' };
const fx = createFxDev(ctx);

function smooth(a: number, b: number, x: number): number { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function nightOf(p: number): number { return smooth(0.82, 0.88, p) * (1 - smooth(0.955, 0.995, p)); }

const keyDay = new THREE.Color(0xffe2b8), keyDawn = new THREE.Color(0xffb890), keyDusk = new THREE.Color(0xff9a50), keyNight = new THREE.Color(0x6a7cc0);
function applyLight(): void {
  const p = env.monthPhase;
  env.night = nightOf(p);
  const k = key.color;
  if (p < 0.12) k.copy(keyDawn).lerp(keyDay, p / 0.12);
  else if (p > 0.6) k.copy(keyDay).lerp(keyDusk, smooth(0.6, 0.82, p));
  else k.copy(keyDay);
  k.lerp(keyNight, env.night);
  const dim = p < 0.12 ? 0.6 + 0.4 * (p / 0.12) : p > 0.6 ? 1 - 0.45 * smooth(0.6, 0.84, p) : 1;
  key.intensity = 2.6 * dim * (1 - 0.88 * env.night);
  hemi.intensity = 0.55 * (1 - 0.7 * env.night);
  // render-core adds fx.flash to its fill light; the gallery does the same
  fill.intensity = 0.3 + fx.flash * 3.2;
  const t = env.time;
  candles.forEach((c, i) => { c.intensity = (34 + 16 * env.night) * (0.92 + 0.08 * Math.sin(t * 9 + i * 2) * Math.sin(t * 5.3 + i)); });
  const grass = env.season === 'spring' ? PAL.grassSpring : env.season === 'summer' ? PAL.grassSummer : env.season === 'autumn' ? PAL.grassAutumn : PAL.grassWinter;
  boardMat.color.setHex(env.snow > 0.5 ? PAL.snow : grass);
}

// ── camera ──
const CAMS: Record<string, [number, number, number, number, number, number]> = {
  // target x, y, z, distance, pitch (deg), yaw (deg)
  wide: [1, 0, 0.5, 48, 52, 12],
  game: [3, 0, 0, 30, 50, 0],
  close: [9, 0.6, 1, 18, 40, 22],
  coffer: [9.5, 1.2, -0.5, 25, 40, 16],
  low: [2, 1.0, 0, 27, 27, 10],
  top: [3, 0, 0, 30, 66, 8],
  play: [8.6, 0.8, 1.2, 14, 40, 14],
};
function cam(name: string): void {
  const c = CAMS[name] ?? CAMS.wide;
  const [tx, ty, tz, d, pd, yd] = c;
  const p = (pd * Math.PI) / 180, y = (yd * Math.PI) / 180;
  camera.position.set(tx + Math.sin(y) * Math.cos(p) * d, ty + Math.sin(p) * d, tz + Math.cos(y) * Math.cos(p) * d);
  camera.lookAt(tx, ty, tz);
  camera.updateMatrixWorld();
}
cam('wide');

// ── loop ──
let held = false;
/** a contact sheet is on screen: stop the loop drawing over it */
let frozen = false;
let last = performance.now();
let frames = 0;
function step(dt: number): void {
  env.dt = dt;
  env.time += dt;
  applyLight();
  fx.update(env);
}
function loop(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!held) stepWithTimers(dt);
  if (!frozen) renderer.render(scene, camera);
  frames++;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ── label ──
const label = document.createElement('div');
label.style.cssText = 'position:fixed;left:12px;top:10px;color:#e8dcc0;font:13px monospace;opacity:.8;text-shadow:0 1px 2px #000;pointer-events:none';
document.body.appendChild(label);
function say(s: string): void { label.textContent = s; }

// ── smoke on every chimney (one dark) ──
const stoppers: { stop(): void }[] = [];
function smokeOn(): void {
  if (stoppers.length) return;
  houses.forEach((h, i) => stoppers.push(fx.smoke(h.chimney, { dark: i === 7 })));
}
function smokeOff(): void { stoppers.forEach(s => s.stop()); stoppers.length = 0; }

function rentDay(n = 20): void {
  for (let k = 0; k < Math.min(n, houses.length); k++) {
    // stagger households over a moment, as rent events arrive
    setTimeoutSim(k * 0.09, () => fx.coins(houses[k].roof, COIN_TARGET, 3 + (k % 4)));
  }
}
// timers that follow simulated time (so advance() fires them too)
const timers: { at: number; fn: () => void }[] = [];
function setTimeoutSim(sec: number, fn: () => void): void { timers.push({ at: env.time + sec, fn }); }
function runTimers(): void {
  for (let k = timers.length - 1; k >= 0; k--) if (env.time >= timers[k].at) { const t = timers[k]; timers.splice(k, 1); t.fn(); }
}
function stepWithTimers(dt: number): void { runTimers(); step(dt); }

function advance(sec: number): void {
  const n = Math.round(sec * 60);
  for (let k = 0; k < n; k++) stepWithTimers(1 / 60);
}

function stats() {
  renderer.render(scene, camera);
  const info = renderer.info.render;
  return { calls: info.calls, tris: info.triangles, ...fx.stats(), fps: +(frames / Math.max(0.001, env.time)).toFixed(1) };
}

/** measure how many draw calls the effects add on top of the bare scene */
function fxCalls(): { scene: number; withFx: number; fx: number } {
  const root = scene.getObjectByName('fx');
  if (!root) return { scene: 0, withFx: 0, fx: 0 };
  renderer.render(scene, camera);            // warm-up
  renderer.render(scene, camera);
  const withFx = renderer.info.render.calls;
  root.visible = false;
  renderer.render(scene, camera);
  const bare = renderer.info.render.calls;
  root.visible = true;
  return { scene: bare, withFx, fx: withFx - bare };
}

function setSeason(s: Season, t = 0.5): void { env.season = s; env.seasonT = t; env.snow = s === 'winter' ? 1 : 0; }
function setWeather(k: WeatherKind, now = false): void { env.weather = k; if (now) fx.setWeatherNow(k); else fx.setWeather(k); }

/** back to a known table before each canned scene */
function resetEnv(): void {
  env.speed = 1; env.wind = 0.35; env.monthPhase = 0.35; setSeason('spring', 0.4);
  timers.length = 0;
}
/** set the table, the weather and the light, then clear the air and refill it */
function begin(season: Season, t: number, phase: number, wind: number, w: WeatherKind, camName: string, smoke: boolean): void {
  resetEnv();
  setSeason(season, t); env.monthPhase = phase; env.wind = wind;
  cam(camName);
  if (smoke) smokeOn(); else smokeOff();
  applyLight();
  setWeather(w, true);
  fx.reset();
}

/** canned scenes for screenshots: set up and advance; returns the caption */
function setup(name: string, t?: number): string {
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  switch (name) {
    case 'rent':
      begin('summer', 0.5, 0.04, 0.3, 'clear', 'coffer', true);
      advance(5); rentDay(20); advance(t ?? 1.15);
      return 'Rent Day: 20 households pay at once';
    case 'oneshots':
      begin('spring', 0.3, 0.4, 0.35, 'clear', 'play', true);
      advance(5);
      fx.confetti(V(8.6, 2.4, -0.4));
      advance(0.25);
      fx.hearts(V(5.6, 1.6, 2.6));
      advance(0.35);
      fx.sparkle(V(11.8, 1.5, 2.2));
      fx.puff(V(9.2, 0.05, 3.4), undefined, 14);
      advance(t ?? 0.3);
      return 'confetti, hearts, sparkle, dust puff, smoke (one dark)';
    case 'storm':
      begin('autumn', 0.5, 0.66, 0.7, 'storm', 'game', true);
      advance(5); fx.strike(); advance(t ?? 0.05);
      return 'storm: heavy rain, wind-bent smoke, lightning';
    case 'rain':
      begin('spring', 0.5, 0.3, 0.3, 'rain', 'close', true);
      advance(t ?? 5);
      return 'rain with splashes (close)';
    case 'rainwide':
      begin('spring', 0.5, 0.3, 0.3, 'rain', 'game', true);
      advance(t ?? 5);
      return 'rain at the default zoom';
    case 'snow':
      begin('winter', 0.5, 0.25, 0.25, 'snow', 'close', true);
      advance(t ?? 5);
      return 'snow';
    case 'hail':
      begin('spring', 0.6, 0.45, 0.4, 'hail', 'close', false);
      advance(t ?? 2.5);
      return 'hail';
    case 'fog':
      begin('autumn', 0.7, 0.08, 0.2, 'fog', 'game', true);
      advance(t ?? 5);
      return 'fog at dawn';
    case 'heat':
      begin('summer', 0.5, 0.45, 0.1, 'heat', 'close', false);
      advance(t ?? 3);
      return 'heat shimmer';
    case 'autumn':
      begin('autumn', 0.5, 0.5, 0.55, 'clear', 'close', true);
      advance(t ?? 9);
      return 'autumn leaves';
    case 'birds':
      begin('summer', 0.5, 0.3, 0.3, 'clear', 'game', true);
      advance(3); fx.birds(12); advance(t ?? 4.6);
      return 'a flock crossing by day';
    case 'spring':
      begin('spring', 0.2, 0.3, 0.4, 'clear', 'close', true);
      advance(t ?? 8);
      return 'spring blossom petals';
    case 'night':
      begin('summer', 0.5, 0.9, 0.15, 'clear', 'close', true);
      advance(t ?? 6);
      return 'summer night: fireflies, motes';
    case 'crossfade':
      begin('winter', 0.2, 0.3, 0.3, 'rain', 'game', false);
      advance(3); setWeather('snow'); advance(t ?? 1.4);
      return 'rain cross-fading to snow';
    case 'paused':
      begin('spring', 0.5, 0.3, 0.3, 'rain', 'close', true);
      advance(4); env.speed = 0; advance(t ?? 3);
      return 'paused 3 s: rain and smoke hang';
    default:
      return 'unknown scene ' + name;
  }
}

/** one canned scene, full frame, held still for the screenshot */
function sceneNamed(name: string, t?: number): unknown {
  frozen = false; held = false;
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setViewport(0, 0, innerWidth, innerHeight);
  say(setup(name, t));
  held = true;
  return { ...stats(), ...fxCalls() };
}

/** several canned scenes in one frame: a grid of cells, each with its caption and draw calls */
function sheet(names: string[], cols = 2): unknown {
  frozen = true; held = true;
  const W = innerWidth, H = innerHeight;
  const rows = Math.ceil(names.length / cols);
  const cw = Math.floor(W / cols), ch = Math.floor(H / rows);
  camera.aspect = cw / ch; camera.updateProjectionMatrix();
  document.querySelectorAll('.cell-label').forEach(e => e.remove());
  say('');
  renderer.setScissorTest(true);
  const out: Record<string, unknown> = {};
  names.forEach((nm, k) => {
    const cx = (k % cols) * cw, row = Math.floor(k / cols);
    const gy = H - (row + 1) * ch;             // GL viewport origin is bottom-left
    renderer.setViewport(cx, gy, cw, ch); renderer.setScissor(cx, gy, cw, ch);
    const caption = setup(nm);
    const root = scene.getObjectByName('fx')!;
    renderer.render(scene, camera);            // warm-up: first frame after a set-up can carry one-off passes
    root.visible = false; renderer.render(scene, camera);
    const bare = renderer.info.render.calls;
    root.visible = true; renderer.render(scene, camera);
    const calls = renderer.info.render.calls;
    const st = fx.stats();
    out[nm] = { fxCalls: calls - bare, calls, ...st };
    const el = document.createElement('div');
    el.className = 'cell-label';
    el.style.cssText = `position:fixed;left:${cx + 8}px;top:${row * ch + 6}px;color:#e8dcc0;font:12px monospace;opacity:.85;text-shadow:0 1px 2px #000;pointer-events:none`;
    el.textContent = `${caption}  [fx calls ${calls - bare}]`;
    document.body.appendChild(el);
  });
  renderer.setScissorTest(false);
  return out;
}

(window as unknown as { __dev: unknown }).__dev = {
  fx, env, houses, world: scene, renderer, camera,
  rentDay, smokeOn, smokeOff,
  puff: (i = 0) => fx.puff(new THREE.Vector3(houses[i].roof.x, 0.05, houses[i].roof.z + 1)),
  sparkle: (i = 0) => fx.sparkle(houses[i].top),
  hearts: (i = 0) => fx.hearts(houses[i].top),
  confetti: (i = 0) => fx.confetti(houses[i].top),
  weather: setWeather,
  season: setSeason,
  phase: (p: number) => { env.monthPhase = p; },
  wind: (w: number) => { env.wind = w; },
  speed: (s: number) => { env.speed = s; },
  cam, advance, hold: (on: boolean) => { held = on; },
  strike: () => fx.strike(), birds: (reach?: number) => fx.birds(reach),
  stats, fxCalls, scene: sceneNamed, sheet,
};
