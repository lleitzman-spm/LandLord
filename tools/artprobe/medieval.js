/* THE MODULAR MEDIEVAL BOARD.
 *
 * Edwin, 2026-07-30: *"find a repo or file assets somewhere that allows us to do
 * modularity and keep our medieval theme."* This is that, built from Kenney's
 * fantasy-town-kit — CC0, GLB, and the pack I had set aside one message earlier
 * for being modular, which turned out to be the requirement rather than the
 * cost.
 *
 * WHAT THE PARTS SHEET TAUGHT (tools/artprobe/parts.js — run it before changing
 * any of this maths):
 *   · The kit is a 1-UNIT TILE GRID.
 *   · A `wall` is a thin panel, 0.10 x 1.00 x 1.00, whose pivot is the TILE's
 *     centre while the panel itself stands at x ≈ +0.45 — the tile's +X edge.
 *     So a wall is placed at its tile and ROTATED to choose which side it
 *     closes: 0 = +X, 90° = -Z, 180° = -X, 270° = +Z.
 *   · A `roof` spans one tile and stands 0.65 tall; walls are exactly 1.00, so
 *     a roof sits at y = storeys.
 *   · `banner-red` / `banner-green` mount on a wall face at x ≈ 0.4 — which is
 *     the hue law expressed as geometry: a door in crisis flies a red banner.
 *
 * Because every door is ASSEMBLED rather than picked from a list of 21 finished
 * houses, no two need look alike, and a door's state can change its fabric —
 * a boarded window, a broken wall, a banner — instead of only its colour.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HOLDING, placements, scenery } from './holding.js';

const stage = document.getElementById('stage');
document.getElementById('label').textContent = 'Modular medieval — assembled from parts';

const W = window.innerWidth;
const H = window.innerHeight;
const SPAN = 58;
const camera = new THREE.OrthographicCamera(
  (-SPAN * (W / H)) / 2, (SPAN * (W / H)) / 2, SPAN / 2, -SPAN / 2, 0.1, 300,
);
camera.position.set(30, 30, 30);
camera.lookAt(0, 0, 0);
camera.updateProjectionMatrix();
camera.updateMatrixWorld(true);

const loader = new GLTFLoader();
const cache = new Map();
async function part(name) {
  if (!cache.has(name)) cache.set(name, loader.loadAsync(`./kit/${name}.glb`).then((g) => g.scene));
  return (await cache.get(name)).clone(true);
}

const R = { PX: 0, NZ: Math.PI / 2, NX: Math.PI, PZ: -Math.PI / 2 };

/** Deterministic per-door variation — a seeded pick, never Math.random, so two
 *  runs of this probe deal the same town and a comparison stays honest. */
function pick(seed, list) {
  return list[Math.abs(Math.sin(seed * 127.1) * 43758.5453) % 1 * list.length | 0];
}

/**
 * One dwelling: a w×d footprint of walls, a gabled roof, and its dressing.
 * Returns a Group whose origin is the building's centre at ground level.
 */
async function house(w, d, seed, { crisis = false } = {}) {
  const g = new THREE.Group();
  const storeys = seed % 3 === 0 ? 2 : 1;

  for (let s = 0; s < storeys; s++) {
    for (let x = 0; x < w; x++) {
      for (let z = 0; z < d; z++) {
        // Only the perimeter is walled — an interior tile is inside the house.
        const sides = [];
        if (x === w - 1) sides.push(R.PX);
        if (x === 0) sides.push(R.NX);
        if (z === 0) sides.push(R.NZ);
        if (z === d - 1) sides.push(R.PZ);
        for (const rot of sides) {
          // A window on the upper storey and on the sunward face reads as a
          // dwelling; a blank box reads as a crate.
          const kind =
            s === storeys - 1 && (rot === R.PX || rot === R.PZ) && (x + z + seed) % 2 === 0
              ? 'ft-wall-window-round'
              : 'ft-wall';
          const p = await part(kind);
          p.position.set(x - (w - 1) / 2, s, z - (d - 1) / 2);
          p.rotation.y = rot;
          g.add(p);
        }
      }
    }
  }

  // THE ROOF — two slopes meeting at a ridge that runs along Z.
  //
  // The first attempt put a `roof-gable` on every tile and capped z=0 and
  // z=d-1 with `roof-gable-end`. On a 2-deep house that makes EVERY tile an
  // end, so there was no ridge anywhere and sixteen houses read as one lumpy
  // green mass. A gable is not a per-tile decoration: it is one ridge with a
  // slope falling away on each side, so the slope pieces are placed by which
  // side of the ridge their column is on.
  for (let x = 0; x < w; x++) {
    for (let z = 0; z < d; z++) {
      const west = x < w / 2;
      const p = await part('ft-roof');
      p.position.set(x - (w - 1) / 2, storeys, z - (d - 1) / 2);
      p.rotation.y = west ? R.NX : R.PX;
      g.add(p);
    }
  }

  const chimney = await part('ft-chimney');
  chimney.position.set((w - 1) / 2 - 0.2, storeys + 0.2, -(d - 1) / 2 + 0.3);
  g.add(chimney);

  // The standing of the door, flown rather than painted.
  const banner = await part(crisis ? 'ft-banner-red' : 'ft-banner-green');
  banner.position.set((w - 1) / 2, storeys - 0.9, -(d - 1) / 2);
  g.add(banner);

  g.traverse((o) => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  return g;
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a1c0f);

const key = new THREE.DirectionalLight(0xffe9c4, 2.7);
key.position.set(16, 24, 10);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -44, right: 44, top: 44, bottom: -44, near: 1, far: 130 });
key.shadow.bias = -0.0008;
key.shadow.normalBias = 0.02;
scene.add(key);
scene.add(new THREE.HemisphereLight(0x9fc4ff, 0x4a3b23, 0.85));

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(120, 120),
  new THREE.MeshStandardMaterial({ color: 0x6f8f4a, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

for (const f of HOLDING.fiefs) {
  const plot = new THREE.Mesh(
    new THREE.PlaneGeometry(f.cols * 5.6 + 3, f.rows * 6 + 3),
    new THREE.MeshStandardMaterial({ color: 0x7ba054, roughness: 1 }),
  );
  plot.rotation.x = -Math.PI / 2;
  plot.position.set(f.x * 2.15, 0.012, f.z * 2.15);
  plot.receiveShadow = true;
  scene.add(plot);
}

// Every door, assembled. Footprints vary so a fief reads as a settlement.
let seed = 0;
for (const p of placements()) {
  seed++;
  const w = pick(seed, [2, 2, 2, 3]);
  const d = pick(seed + 7, [2, 2, 3]);
  const h = await house(w, d, seed, { crisis: p.crisis });
  h.position.set(p.x * 2.15, 0, p.z * 2.15);
  h.rotation.y = (seed % 4) * (Math.PI / 2);
  scene.add(h);
}

// The keep, from the castle kit — the one thing that should not be a cottage.
let y = 0;
for (const nm of ['castle-tower-square-base', 'castle-tower-square-mid', 'castle-tower-square-roof']) {
  const t = await part(nm);
  const box = new THREE.Box3().setFromObject(t);
  const size = new THREE.Vector3();
  box.getSize(size);
  const s = 2.6;
  t.scale.setScalar(s);
  t.position.set(HOLDING.capital.x, y, HOLDING.capital.z * 2.15);
  t.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(t);
  y += size.y * s;
}

for (const t of scenery()) {
  const tree = await part(t.model);
  const box = new THREE.Box3().setFromObject(tree);
  const size = new THREE.Vector3();
  box.getSize(size);
  tree.scale.setScalar((1.6 / Math.max(size.x, size.z)) * t.s);
  tree.position.set(t.x * 2.2, 0, t.z * 2.2);
  tree.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(tree);
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
