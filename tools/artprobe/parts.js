/* THE PARTS SHEET — look at the kit before building with it.
 *
 * A modular kit is only usable if you know each piece's SIZE, its PIVOT and
 * which way it faces. Guessing those is how you get a house with its walls
 * inside out. So this renders every staged piece on its own labelled tile, with
 * a 1-unit reference grid beneath it, and prints the measured bounding boxes.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const PARTS = [
  'ft-wall', 'ft-wall-corner', 'ft-wall-half', 'ft-wall-window-round',
  'ft-roof', 'ft-roof-gable', 'ft-roof-gable-end', 'ft-roof-corner',
  'ft-roof-flat', 'ft-chimney', 'ft-banner-red', 'ft-fence',
];

const COLS = 4;
const CELL = 260;
const loader = new GLTFLoader();
const stage = document.getElementById('stage');
document.getElementById('label').textContent = 'The kit, piece by piece';

const wrap = document.createElement('div');
wrap.style.cssText = `display:grid;grid-template-columns:repeat(${COLS},${CELL}px);gap:8px;padding:12px;`;
stage.appendChild(wrap);

function rig(scene) {
  const key = new THREE.DirectionalLight(0xffe9c4, 2.6);
  key.position.set(6, 10, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 30 });
  scene.add(key);
  scene.add(new THREE.HemisphereLight(0x9fc4ff, 0x4a3b23, 0.9));
}

const out = [];
for (const name of PARTS) {
  const cell = document.createElement('div');
  cell.style.cssText = 'position:relative;background:#241a10;border-radius:6px;overflow:hidden;';
  wrap.appendChild(cell);

  const g = await loader.loadAsync(`./kit/${name}.glb`);
  const scene = new THREE.Scene();
  rig(scene);

  // A 1-unit grid, so a piece's footprint can be READ, not guessed.
  const grid = new THREE.GridHelper(6, 6, 0x7a6a4a, 0x4a3f2a);
  scene.add(grid);

  const box = new THREE.Box3().setFromObject(g.scene);
  const size = new THREE.Vector3();
  const centre = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(centre);
  g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(g.scene);

  // A marker at the model's ORIGIN — the pivot is what assembly maths uses.
  const pin = new THREE.Mesh(
    new THREE.SphereGeometry(0.07),
    new THREE.MeshBasicMaterial({ color: 0xff4444 }),
  );
  scene.add(pin);

  const span = 3.4;
  const cam = new THREE.OrthographicCamera(-span / 2, span / 2, span / 2, -span / 2, 0.1, 100);
  cam.position.set(4, 4, 4);
  cam.lookAt(0, 0.4, 0);

  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  r.setPixelRatio(2);
  r.setSize(CELL, CELL - 34);
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.render(scene, cam);
  cell.appendChild(r.domElement);

  const cap = document.createElement('div');
  cap.style.cssText =
    'font:600 10px/1.3 ui-monospace,monospace;color:#eadfc6;padding:4px 6px;background:#0006;';
  const f = (n) => n.toFixed(2);
  cap.textContent = `${name.replace('ft-', '')}  ${f(size.x)}×${f(size.y)}×${f(size.z)}  origin@${f(centre.x)},${f(centre.z)}`;
  cell.appendChild(cap);

  out.push({ name, size: [+f(size.x), +f(size.y), +f(size.z)], centre: [+f(centre.x), +f(centre.y), +f(centre.z)], min: [+f(box.min.x), +f(box.min.y), +f(box.min.z)] });
}

window.PARTS_REPORT = out;
console.log(JSON.stringify(out, null, 1));
document.body.dataset.ready = '1';
