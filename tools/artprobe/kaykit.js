/* KAYKIT — the rival kit, on the same holding and the same camera.
 *
 * Edwin, 2026-07-30: "get kaykit down and compare first."
 *
 * KayKit's Medieval Builder Pack is modular in a DIFFERENT sense from Kenney's
 * fantasy-town-kit, and the difference is the whole comparison:
 *
 *   Kenney fantasy-town  — a kit of WALLS and ROOFS. You assemble each dwelling
 *                          piece by piece, so a door's fabric can express its
 *                          state, but every building costs an assembly step and
 *                          a roof you have to get right.
 *   KayKit medieval      — a kit of TERRAIN TILES and whole BUILDINGS. You lay a
 *                          grid and drop a house, a mill, a market, a castle on
 *                          it. Nothing to assemble; variety comes from which
 *                          building and which tile, not from how it is built.
 *
 * A realm map is a board of territories, so a tile kit may fit LandLord better
 * than a house kit — but it buys that by making a door's STATE harder to show in
 * geometry. That is the trade this frame is here to let Edwin see.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HOLDING, placements, scenery } from './holding.js';

const stage = document.getElementById('stage');
document.getElementById('label').textContent = 'KayKit — terrain tiles + whole buildings';

const W = window.innerWidth;
const H = window.innerHeight;
const SPAN = 46;
const camera = new THREE.OrthographicCamera(
  (-SPAN * (W / H)) / 2, (SPAN * (W / H)) / 2, SPAN / 2, -SPAN / 2, 0.1, 300,
);
camera.position.set(28, 28, 28);
camera.lookAt(0, 0, 0);
camera.updateProjectionMatrix();
camera.updateMatrixWorld(true);

const loader = new GLTFLoader();
const cache = new Map();
async function part(name) {
  if (!cache.has(name)) {
    cache.set(name, loader.loadAsync(`./kit/${name}.glb`).then((g) => {
      const b = new THREE.Box3().setFromObject(g.scene);
      const s = new THREE.Vector3();
      b.getSize(s);
      g.scene.userData.size = s;
      return g.scene;
    }));
  }
  const src = await cache.get(name);
  const c = src.clone(true);
  c.userData.size = src.userData.size;
  return c;
}

function shade(o) {
  o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return o;
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a1c0f);

const key = new THREE.DirectionalLight(0xffe9c4, 2.7);
key.position.set(16, 24, 10);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 120 });
key.shadow.bias = -0.0008;
key.shadow.normalBias = 0.02;
scene.add(key);
scene.add(new THREE.HemisphereLight(0x9fc4ff, 0x4a3b23, 0.85));

// Measure the tile once — the whole grid's spacing follows from it, so nothing
// here has a magic number in it.
const probeTile = await part('kk-square_forest');
const T = Math.max(probeTile.userData.size.x, probeTile.userData.size.z);

/** Lay a field of terrain tiles, with roads threaded through it. */
async function terrain(cols, rows, ox, oz) {
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      // A road runs down the middle row of each fief, so the holding reads as
      // settled ground rather than a lawn.
      const mid = r === Math.floor(rows / 2);
      const name = mid
        ? 'kk-square_forest_roadA'
        : (c + r) % 4 === 0
          ? 'kk-square_forest_detail'
          : 'kk-square_forest';
      const t = await part(name);
      t.position.set(ox + (c - (cols - 1) / 2) * T, 0, oz + (r - (rows - 1) / 2) * T);
      if (mid) t.rotation.y = Math.PI / 2;
      scene.add(shade(t));
    }
  }
}

// ONE DOOR, ONE TILE. This is the correction that matters when comparing the
// two kinds of modular: a tile kit is addressed in TILES, not in the free
// coordinates a wall-and-roof kit uses. The first pass placed buildings with
// the house-kit's spacing and they scattered across the slabs at a fraction of
// tile size — a kit misread, not a kit fault.
const FIEF_COLS = 4;
const FIEF_ROWS = 2;

/** Lay a fief's tiles and return the world centre of each, in order. */
async function fiefField(cx, cz, cols, rows) {
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = cx + (c - (cols - 1) / 2) * T;
      const z = cz + (r - (rows - 1) / 2) * T;
      const name = (c + r) % 5 === 0 ? 'kk-square_forest_detail' : 'kk-square_forest';
      const t = await part(name);
      t.position.set(x, 0, z);
      scene.add(shade(t));
      cells.push({ x, z, top: t.userData.size.y });
    }
  }
  return cells;
}

// The fiefs, spaced by their own tile size so neighbours never overlap.
const SPREAD = T * (FIEF_COLS + 1);
const fields = [];
for (const [i, f] of HOLDING.fiefs.entries()) {
  fields.push(await fiefField((i === 0 ? -1 : 1) * SPREAD * 0.55, i === 0 ? T : -T * 0.6, FIEF_COLS, FIEF_ROWS));
}

// The keep sits on its own ground, north of both.
const seat = await fiefField(0, -T * 3.2, 2, 2);
const castle = await part('kk-castle');
castle.position.set((seat[0].x + seat[3].x) / 2, seat[0].top, (seat[0].z + seat[3].z) / 2);
scene.add(shade(castle));

// The doors — a whole building standing ON its tile.
const HOUSES = ['kk-house', 'kk-mill', 'kk-market', 'kk-barracks', 'kk-house', 'kk-well'];
const all = placements();
let n = 0;
for (const [fi, cells] of fields.entries()) {
  for (const cell of cells) {
    const p = all[fi * FIEF_COLS * FIEF_ROWS + (n % (FIEF_COLS * FIEF_ROWS))] ?? all[0];
    const b = await part(HOUSES[n % HOUSES.length]);
    b.position.set(cell.x, cell.top, cell.z);
    b.rotation.y = (n % 4) * (Math.PI / 2);
    // A whole-building kit ships no distressed variant, so the only lever left
    // for a door's STATE is tint — exactly the expressiveness the
    // wall-and-roof kit buys back with a red banner and a broken wall.
    if (p.crisis) {
      b.traverse((m) => {
        if (m.isMesh && m.material) {
          m.material = m.material.clone();
          m.material.color = new THREE.Color(0x8d3326);
        }
      });
    }
    scene.add(shade(b));
    n++;
  }
}

for (const [i, t] of scenery().entries()) {
  const tree = await part(i % 3 === 0 ? 'kk-detail_treeB' : 'kk-detail_treeA');
  tree.position.set(t.x * T * 0.42, 0, t.z * T * 0.42);
  tree.scale.setScalar(1.6);
  scene.add(shade(tree));
}

// FIT THE CAMERA TO WHAT IS ACTUALLY THERE, rather than guessing a span — the
// same lesson the app's own map is owed (its fit blows a 16-door holding up to
// 5.1x and shows a third of the world). Measure the scene, project its corners
// through the camera's own basis, and frame that.
{
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  const mid = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(mid);
  camera.position.copy(mid).add(new THREE.Vector3(60, 60, 60));
  camera.lookAt(mid);
  camera.updateMatrixWorld(true);
  // The half-extent needed, measured on the camera's own axes.
  let hx = 0;
  let hy = 0;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const c = new THREE.Vector3(
      mid.x + (sx * size.x) / 2, mid.y + (sy * size.y) / 2, mid.z + (sz * size.z) / 2,
    ).applyMatrix4(camera.matrixWorldInverse);
    hx = Math.max(hx, Math.abs(c.x));
    hy = Math.max(hy, Math.abs(c.y));
  }
  const pad = 1.06;
  const aspect = W / H;
  const halfH = Math.max(hy, hx / aspect) * pad;
  camera.top = halfH;
  camera.bottom = -halfH;
  camera.left = -halfH * aspect;
  camera.right = halfH * aspect;
  camera.near = 0.1;
  camera.far = 400;
  camera.updateProjectionMatrix();
}

const r = new THREE.WebGLRenderer({ antialias: true });
r.setPixelRatio(2);
r.setSize(W, H);
r.shadowMap.enabled = true;
r.shadowMap.type = THREE.PCFSoftShadowMap;
r.toneMapping = THREE.ACESFilmicToneMapping;
r.toneMappingExposure = 1.05;
stage.appendChild(r.domElement);
r.render(scene, camera);
document.body.dataset.ready = '1';
