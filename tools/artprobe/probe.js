/* Two pipelines, one holding, one camera.
 *
 *   ?mode=3d      a live three.js scene — real contact shadows, real AA, real
 *                 lighting. What "the 3D render almost looked better" meant,
 *                 with assets we did not author.
 *   ?mode=sprite  each model BAKED once through that same renderer to a PNG,
 *                 then composited flat on a 2D canvas — the pipeline the board
 *                 uses today, but fed real art instead of hand-drawn SVG.
 *
 * The camera, the light and the layout are shared. Only the drawing differs,
 * which is the whole point: any difference in the two frames is the pipeline,
 * not the scene.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HOLDING, placements, scenery } from './holding.js';

const mode = new URLSearchParams(location.search).get('mode') ?? '3d';
const stage = document.getElementById('stage');
document.getElementById('label').textContent =
  mode === '3d' ? 'A live 3D scene' : 'Baked sprites, composited flat';

const W = window.innerWidth;
const H = window.innerHeight;

// ── The shared camera ──────────────────────────────────────────────────────
// Orthographic, not perspective: a board is read from above and a vanishing
// point makes far doors smaller than near ones for no informational reason.
const SPAN = 30;
const aspect = W / H;
const camera = new THREE.OrthographicCamera(
  (-SPAN * aspect) / 2, (SPAN * aspect) / 2, SPAN / 2, -SPAN / 2, 0.1, 200,
);
camera.position.set(26, 26, 26);
camera.lookAt(0, 0, 0);
// Both matrices, by hand. The live pipeline gets these free from the renderer,
// but the baked pipeline only ever PROJECTS through this camera and never
// draws with it — so without this its matrixWorldInverse stays at the identity
// and every point folds onto the same spot. That is exactly what a blank first
// frame looked like.
camera.updateProjectionMatrix();
camera.updateMatrixWorld(true);

const loader = new GLTFLoader();
const cache = new Map();
async function model(name) {
  if (!cache.has(name)) {
    cache.set(
      name,
      loader.loadAsync(`./kit/${name}.glb`).then((g) => {
        const root = g.scene;
        // Normalise: the kits are authored around a 1-unit tile, but not every
        // pack agrees. Measure and scale so a door is always ~2.2 units wide.
        const box = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3();
        box.getSize(size);
        root.userData.wide = Math.max(size.x, size.z) || 1;
        root.userData.height = size.y;
        return root;
      }),
    );
  }
  return (await cache.get(name)).clone(true);
}

function lightRig(scene) {
  // One warm key with a real shadow camera, and a cool sky fill. The blind
  // critic's first fault against the old 3D board was that NOTHING cast a
  // shadow onto anything; this is that fault's whole fix, and it is free.
  const key = new THREE.DirectionalLight(0xffe9c4, 2.6);
  key.position.set(14, 22, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const d = 22;
  Object.assign(key.shadow.camera, { left: -d, right: d, top: d, bottom: -d, near: 1, far: 70 });
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  scene.add(new THREE.HemisphereLight(0x9fc4ff, 0x4a3b23, 0.85));
}

function ground(scene) {
  const g = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshStandardMaterial({ color: 0x6f8f4a, roughness: 1 }),
  );
  g.rotation.x = -Math.PI / 2;
  g.receiveShadow = true;
  scene.add(g);

  // The two fiefs read as tended ground against the wild.
  for (const f of HOLDING.fiefs) {
    const plot = new THREE.Mesh(
      new THREE.PlaneGeometry(f.cols * 2.6 + 1.6, f.rows * 2.8 + 1.6),
      new THREE.MeshStandardMaterial({ color: 0x7ba054, roughness: 1 }),
    );
    plot.rotation.x = -Math.PI / 2;
    plot.position.set(f.x, 0.012, f.z);
    plot.receiveShadow = true;
    scene.add(plot);
  }
}

function renderer(alpha = false) {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha, preserveDrawingBuffer: true });
  r.setPixelRatio(2);
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.05;
  return r;
}

function dress(obj, crisis) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    if (crisis && o.material) {
      o.material = o.material.clone();
      // The hue law: red means distress and nothing else.
      o.material.color = new THREE.Color(0x8d3326);
    }
  });
  return obj;
}

/** Everything that stands on the board, both pipelines alike. */
async function build(scene) {
  ground(scene);

  for (const p of placements()) {
    const m = await model(p.model);
    m.scale.setScalar(2.2 / m.userData.wide);
    m.position.set(p.x, 0, p.z);
    m.rotation.y = p.rot;
    scene.add(dress(m, p.crisis));
  }

  // The capital keep — a tower, stacked from the castle kit's own pieces.
  let y = 0;
  for (const [part, times] of [['base', 1], ['mid', 1], ['roof', 1]]) {
    for (let i = 0; i < times; i++) {
      const t = await model(`castle-tower-square-${part}`);
      const s = 3.0;
      t.scale.setScalar(s);
      t.position.set(HOLDING.capital.x, y, HOLDING.capital.z);
      scene.add(dress(t, false));
      y += (t.userData.height || 1) * s;
    }
  }

  for (const t of scenery()) {
    const tree = await model(t.model);
    tree.scale.setScalar((1.5 / tree.userData.wide) * t.s);
    tree.position.set(t.x, 0, t.z);
    scene.add(dress(tree, false));
  }
}

// ── Pipeline one: the live scene ───────────────────────────────────────────
async function live() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a1c0f);
  lightRig(scene);
  await build(scene);

  const r = renderer();
  r.setSize(W, H);
  stage.appendChild(r.domElement);
  r.render(scene, camera);
  document.body.dataset.ready = '1';
}

// ── Pipeline two: bake, then composite flat ────────────────────────────────
// Each distinct model is rendered ONCE, on its own, through the same renderer
// and the same light — then the board is drawn as flat images in depth order.
// This is the current pipeline's shape; only the pictures are different.
async function baked() {
  const bakeR = renderer(true);
  const SPRITE = 512;
  bakeR.setSize(SPRITE, SPRITE);

  const sprites = new Map();
  async function bake(name, crisis, rot) {
    const key = `${name}|${crisis}|${rot.toFixed(2)}`;
    if (sprites.has(key)) return sprites.get(key);

    const s = new THREE.Scene();
    lightRig(s);
    // A shadow catcher, so a baked door still lands ON something.
    const cat = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.ShadowMaterial({ opacity: 0.42 }),
    );
    cat.rotation.x = -Math.PI / 2;
    cat.receiveShadow = true;
    s.add(cat);

    const m = await model(name);
    m.scale.setScalar(2.2 / m.userData.wide);
    m.rotation.y = rot;
    s.add(dress(m, crisis));

    // The same view as the board, framed tight on one piece.
    const span = 5.2;
    const c = new THREE.OrthographicCamera(-span / 2, span / 2, span / 2, -span / 2, 0.1, 200);
    c.position.set(26, 26, 26);
    c.lookAt(0, 0.6, 0);

    bakeR.render(s, c);
    const img = new Image();
    img.src = bakeR.domElement.toDataURL('image/png');
    await img.decode();
    sprites.set(key, img);
    return img;
  }

  // Project a world point through the SHARED camera, so the flat board and the
  // live board put every door in exactly the same place on screen.
  const project = (x, z) => {
    const v = new THREE.Vector3(x, 0, z).project(camera);
    return { sx: ((v.x + 1) / 2) * W, sy: ((1 - v.y) / 2) * H, depth: v.z };
  };

  const cv = document.createElement('canvas');
  cv.width = W * 2;
  cv.height = H * 2;
  cv.style.width = `${W}px`;
  cv.style.height = `${H}px`;
  const g = cv.getContext('2d');
  g.scale(2, 2);
  stage.appendChild(cv);

  // The ground, flat — the same two fiefs, drawn as the compositor would.
  g.fillStyle = '#2a1c0f';
  g.fillRect(0, 0, W, H);
  const groundPts = [[-40, -40], [40, -40], [40, 40], [-40, 40]].map(([x, z]) => project(x, z));
  g.fillStyle = '#6f8f4a';
  g.beginPath();
  groundPts.forEach((p, i) => (i ? g.lineTo(p.sx, p.sy) : g.moveTo(p.sx, p.sy)));
  g.closePath();
  g.fill();
  for (const f of HOLDING.fiefs) {
    const hw = (f.cols * 2.6 + 1.6) / 2;
    const hh = (f.rows * 2.8 + 1.6) / 2;
    const pts = [
      [f.x - hw, f.z - hh], [f.x + hw, f.z - hh], [f.x + hw, f.z + hh], [f.x - hw, f.z + hh],
    ].map(([x, z]) => project(x, z));
    g.fillStyle = '#7ba054';
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p.sx, p.sy) : g.moveTo(p.sx, p.sy)));
    g.closePath();
    g.fill();
  }

  // Everything that stands, painter's algorithm: far things first.
  const items = [
    ...scenery().map((t) => ({ ...t, name: t.model, crisis: false, rot: 0, scale: t.s * 0.8 })),
    ...placements().map((p) => ({ ...p, name: p.model, scale: 1 })),
    { x: HOLDING.capital.x, z: HOLDING.capital.z, name: 'castle-tower-square-mid', crisis: false, rot: 0, scale: 2.4 },
  ].sort((a, b) => project(a.x, a.z).depth - project(b.x, b.z).depth);

  // On-screen size of one world unit, so a sprite lands at the right scale.
  const o = project(0, 0);
  const unit = Math.abs(project(1, 0).sx - o.sx);

  for (const it of items) {
    const img = await bake(it.name, it.crisis, it.rot);
    const p = project(it.x, it.z);
    const w = 5.2 * unit * it.scale;
    // The sprite is square and its subject sits on the plane's centre.
    g.drawImage(img, p.sx - w / 2, p.sy - w / 2, w, w);
  }
  document.body.dataset.ready = '1';
}

(mode === '3d' ? live() : baked()).catch((e) => {
  document.getElementById('label').textContent = `FAILED: ${e.message}`;
  document.body.dataset.ready = 'error';
  console.error(e);
});
