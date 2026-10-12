/**
 * The real objects that sit round the board and mean things: the coffer whose
 * coin pile follows the treasury, the ledger, the charter with its wax seal,
 * inkwell and quill, a seal-stamp, a rolled map, the Rent Day bell, and four
 * candles in brass holders that burn down across the month.
 */
import * as THREE from 'three';
import type { RenderCtx, TableProp, Quality, Env } from '../api';
import { PAL, tint, mix } from '../palette';
import type { Sky } from './env';
import { TABLE_Y, PROP_AT, CANDLES } from './layout';
import { Geo, TRS, lathe, jitter, makeCanvas, canvasTex, blobTexture, css, rng, clamp01, lerp, damp, vnoise, smoothstep, TAU, composeInto } from './util';

export interface Props {
  group: THREE.Group;
  lights: THREE.PointLight[];
  /** world-space anchor of a prop (its top; for the coffer, the top of the coin pile) */
  pos(prop: TableProp, out?: THREE.Vector3): THREE.Vector3;
  setGold(gold: number, instant?: boolean): void;
  setCharterReady(on: boolean): void;
  ringBell(): void;
  setHover(prop: TableProp | null): void;
  pick(ray: THREE.Ray): { prop: TableProp; distance: number } | null;
  update(env: Env, sky: Sky): void;
  setQuality(q: Quality): void;
  dispose(): void;
}

interface PropEntry { id: TableProp; group: THREE.Group; box: THREE.Box3; top: THREE.Vector3; lift: number; halo: THREE.Mesh | null }
interface Candle { entry: PropEntry; body: THREE.Mesh; cap: THREE.Group; flame: THREE.Mesh; core: THREE.Mesh; halo: THREE.Sprite; light: THREE.PointLight; seed: number; full: number; h: number }

const WOOD_DARK = 0x3d2819;
const LEATHER = 0x5a2a20;
const PEWTER = 0x4a4a52;
const PAGE = 0xe6d7b0;
const _m = new THREE.Matrix4(), _col = new THREE.Color(), _box = new THREE.Box3();

// ───────────── little drawing helpers for parchment ─────────────

function scribble(g: CanvasRenderingContext2D, x: number, y: number, w: number, size: number, r: () => number): void {
  g.beginPath();
  let cx = x;
  g.moveTo(cx, y);
  while (cx < x + w) {
    const step = size * (0.28 + r() * 0.34);
    cx += step;
    g.lineTo(cx - step * 0.5, y - size * (0.3 + r() * 0.6) * (r() < 0.18 ? 1.7 : 1));
    g.lineTo(cx, y + (r() - 0.5) * size * 0.3);
  }
  g.stroke();
}
function scribbleLine(g: CanvasRenderingContext2D, x: number, y: number, w: number, size: number, r: () => number): void {
  let cx = x;
  while (cx < x + w - size) {
    const ww = Math.min(x + w - cx, size * (1.4 + r() * 4));
    scribble(g, cx, y, ww, size, r);
    cx += ww + size * 0.9;
  }
}
function parchment(g: CanvasRenderingContext2D, w: number, h: number, r: () => number): void {
  g.fillStyle = css(PAL.parchment); g.fillRect(0, 0, w, h);
  for (let i = 0; i < 46; i++) {
    const x = r() * w, y = r() * h, rad = 20 + r() * 90;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${r() < 0.5 ? '150,110,60' : '255,246,220'},${0.03 + r() * 0.05})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  const edge = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  edge.addColorStop(0, 'rgba(120,80,30,0)'); edge.addColorStop(1, 'rgba(110,70,28,0.34)');
  g.fillStyle = edge; g.fillRect(0, 0, w, h);
}

function ledgerCanvas(): HTMLCanvasElement {
  return makeCanvas(1024, 640, (g, w, h) => {
    const r = rng(1201);
    parchment(g, w, h, r);
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let page = 0; page < 2; page++) {
      const x0 = page * (w / 2) + (page ? 36 : 58), pw = w / 2 - 94;
      // rubric frame and heading
      g.strokeStyle = 'rgba(158,43,37,0.75)'; g.lineWidth = 1.6;
      g.strokeRect(x0 - 12, 34, pw + 24, h - 68);
      g.beginPath(); g.moveTo(x0 + pw * 0.66, 34); g.lineTo(x0 + pw * 0.66, h - 34); g.moveTo(x0 + pw * 0.84, 34); g.lineTo(x0 + pw * 0.84, h - 34); g.stroke();
      g.strokeStyle = css(PAL.crimson); g.lineWidth = 3.2;
      scribbleLine(g, x0 + 4, 78, pw * 0.56, 22, r);
      // a gold initial on the left page
      if (page === 0) { g.fillStyle = css(PAL.gold); g.fillRect(x0 - 2, 98, 44, 44); g.strokeStyle = css(PAL.lapis); g.lineWidth = 3; g.strokeRect(x0 + 4, 104, 32, 32); g.strokeStyle = css(PAL.crimson); scribble(g, x0 + 10, 128, 20, 18, r); }
      for (let row = 0; row < 15; row++) {
        const y = 128 + row * 31;
        g.strokeStyle = 'rgba(42,29,20,0.86)'; g.lineWidth = 2;
        scribbleLine(g, x0 + (page === 0 && row < 1 ? 52 : 4), y, pw * (0.34 + r() * 0.28), 12, r);
        g.strokeStyle = row % 6 === 4 ? 'rgba(158,43,37,0.9)' : 'rgba(42,29,20,0.86)';
        scribble(g, x0 + pw * 0.69, y, pw * (0.05 + r() * 0.08), 11, r);
        if (r() < 0.6) scribble(g, x0 + pw * 0.87, y, pw * (0.05 + r() * 0.07), 11, r);
        g.strokeStyle = 'rgba(90,60,30,0.2)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x0 - 6, y + 8); g.lineTo(x0 + pw + 6, y + 8); g.stroke();
      }
      g.strokeStyle = 'rgba(42,29,20,0.9)'; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(x0 + pw * 0.66, h - 62); g.lineTo(x0 + pw + 8, h - 62); g.moveTo(x0 + pw * 0.66, h - 57); g.lineTo(x0 + pw + 8, h - 57); g.stroke();
    }
    // the gutter
    const gut = g.createLinearGradient(w / 2 - 46, 0, w / 2 + 46, 0);
    gut.addColorStop(0, 'rgba(60,40,20,0)'); gut.addColorStop(0.5, 'rgba(60,40,20,0.5)'); gut.addColorStop(1, 'rgba(60,40,20,0)');
    g.fillStyle = gut; g.fillRect(w / 2 - 46, 0, 92, h);
  });
}

function charterCanvas(): HTMLCanvasElement {
  return makeCanvas(512, 768, (g, w, h) => {
    const r = rng(733);
    parchment(g, w, h, r);
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = css(PAL.lapis); g.lineWidth = 3; g.strokeRect(34, 96, w - 68, h - 196);
    g.strokeStyle = css(PAL.gold); g.lineWidth = 2; g.strokeRect(40, 102, w - 80, h - 208);
    g.fillStyle = css(PAL.ink); g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '64px "UnifrakturMaguntia", "IM Fell English SC", Georgia, serif';
    g.fillText('Charter', w / 2, 158);
    g.fillStyle = css(PAL.crimson); g.fillRect(64, 208, 62, 62);
    g.fillStyle = css(PAL.gold); g.fillRect(70, 214, 50, 50);
    g.strokeStyle = css(PAL.lapis); g.lineWidth = 5; scribble(g, 78, 252, 32, 30, r);
    g.strokeStyle = 'rgba(42,29,20,0.88)'; g.lineWidth = 2.4;
    for (let row = 0; row < 13; row++) {
      const y = 232 + row * 30;
      scribbleLine(g, row < 2 ? 140 : 64, y, (w - 128) * (row === 12 ? 0.5 : 1) - (row < 2 ? 76 : 0), 13, r);
    }
    g.lineWidth = 3; g.beginPath(); g.moveTo(70, h - 150);
    for (let i = 0; i < 9; i++) g.quadraticCurveTo(84 + i * 16, h - 190 + (i % 2) * 70, 98 + i * 16, h - 150);
    g.stroke();
  });
}

function cobwebTexture(): THREE.CanvasTexture {
  return canvasTex(makeCanvas(256, 256, (g, w) => {
    g.strokeStyle = 'rgba(235,235,230,0.85)'; g.lineWidth = 1.3;
    const rays = 7;
    for (let i = 0; i <= rays; i++) { const a = (i / rays) * Math.PI / 2; g.beginPath(); g.moveTo(4, 4); g.lineTo(4 + Math.cos(a) * (w - 10), 4 + Math.sin(a) * (w - 10)); g.stroke(); }
    for (let k = 1; k <= 6; k++) {
      const rad = k * 38 + (k % 2) * 6;
      g.beginPath();
      for (let i = 0; i <= rays; i++) {
        const a = (i / rays) * Math.PI / 2, sag = i === 0 ? 0 : 0.9;
        const px = 4 + Math.cos(a) * rad, py = 4 + Math.sin(a) * rad;
        if (i === 0) g.moveTo(px, py);
        else { const am = ((i - 0.5) / rays) * Math.PI / 2; g.quadraticCurveTo(4 + Math.cos(am) * rad * (1 - 0.12 * sag), 4 + Math.sin(am) * rad * (1 - 0.12 * sag), px, py); }
      }
      g.stroke();
    }
  }), { srgb: false });
}

// ───────────── the props ─────────────

export function createProps(ctx: RenderCtx, envMap: THREE.Texture): Props {
  const group = new THREE.Group();
  group.name = 'props';
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(o: T): T => { owned.push(o); return o; };

  const matte = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84, metalness: 0 }));
  const satin = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0 }));
  const metal = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.33, metalness: 0.92, envMap, envMapIntensity: 1.25 }));
  const blob = keep(blobTexture(128, 0.05, 1.5));
  const shadowMat = keep(new THREE.MeshBasicMaterial({ map: blob, color: 0x000000, transparent: true, opacity: 0.62, depthWrite: false }));
  const haloMat = keep(new THREE.MeshBasicMaterial({ map: blob, color: new THREE.Color(PAL.flame).multiplyScalar(0.9), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  const flatGeo = keep(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));

  const entries: PropEntry[] = [];
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, cast = true): THREE.Mesh => {
    const m = new THREE.Mesh(keep(geo), mat);
    m.castShadow = cast; m.receiveShadow = true;
    return m;
  };
  /** make a prop's root at a table spot, with a contact shadow and a hover glow sized to it */
  function place(id: TableProp, x: number, z: number, turn: number, sw: number, sd: number, topY: number): PropEntry {
    const g = new THREE.Group();
    g.position.set(x, TABLE_Y, z); g.rotation.y = turn;
    const sh = new THREE.Mesh(flatGeo, shadowMat);
    sh.scale.set(sw, 1, sd); sh.position.y = 0.02; sh.renderOrder = 2; sh.userData.skipBox = true;
    g.add(sh);
    const halo = new THREE.Mesh(flatGeo, haloMat.clone());
    owned.push(halo.material as THREE.Material);
    halo.scale.set(sw * 1.5, 1, sd * 1.5); halo.position.y = 0.03; halo.renderOrder = 3; halo.visible = false; halo.userData.skipBox = true;
    g.add(halo);
    group.add(g);
    const e: PropEntry = { id, group: g, box: new THREE.Box3(), top: new THREE.Vector3(0, topY, 0), lift: 0, halo };
    entries.push(e);
    return e;
  }
  /** pick box from the real meshes only (not the contact shadow, glow or sprites) */
  const fitBox = (e: PropEntry) => {
    e.group.updateMatrixWorld(true);
    e.box.makeEmpty();
    e.group.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.userData.skipBox) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      e.box.union(_box.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld));
    });
    e.box.min.y = TABLE_Y;
  };

  // ── candles ────────────────────────────────────────────────────────────
  const holderGeo = new Geo();
  holderGeo.add(lathe([[0, 0.02], [1.5, 0.0], [1.74, 0.1], [1.72, 0.22], [1.46, 0.17], [0.62, 0.14], [0.34, 0.3], [0.3, 0.6], [0.47, 0.78], [0.47, 0.9], [0.3, 1.02], [0.35, 1.2], [0.62, 1.34], [0.68, 1.72], [0.58, 1.72], [0.53, 1.44], [0, 1.42]], 18), null, PAL.brass, false);
  holderGeo.add(new THREE.TorusGeometry(0.42, 0.075, 6, 14), TRS(2.02, 0.38, 0), PAL.brass, false);
  holderGeo.add(new THREE.SphereGeometry(0.11, 8, 6), TRS(1.66, 0.3, 0), PAL.brass, false);
  const holder = keep(holderGeo.build());
  const waxBody = keep(new THREE.CylinderGeometry(0.46, 0.47, 1, 14, 1, true).translate(0, 0.5, 0));
  const capGeoB = new Geo();
  capGeoB.add(lathe([[0.46, -0.16], [0.5, -0.03], [0.475, 0.05], [0.36, 0.03], [0.2, -0.04], [0, -0.06]], 14), null, PAL.wax, false);
  const dr = rng(99);
  for (let i = 0; i < 4; i++) { const a = dr() * TAU, len = 0.25 + dr() * 0.55; capGeoB.add(new THREE.SphereGeometry(1, 6, 5), TRS(Math.cos(a) * 0.47, -0.08 - len * 0.5, Math.sin(a) * 0.47, 0, 0, 0, 0.085, len * 0.6, 0.085), PAL.wax, false); }
  capGeoB.add(new THREE.CylinderGeometry(0.022, 0.03, 0.2, 5), TRS(0, 0.05, 0), PAL.soot);
  const capGeo = keep(capGeoB.build());
  const waxMat = keep(new THREE.MeshStandardMaterial({ color: PAL.wax, roughness: 0.48, emissive: 0xff8a3a, emissiveIntensity: 0.05 }));
  const capMat = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, emissive: 0xff8a3a, emissiveIntensity: 0.42 }));
  const flamePts: [number, number][] = [[0, 0], [0.1, 0.05], [0.175, 0.19], [0.185, 0.36], [0.13, 0.62], [0.055, 0.86], [0, 1.02]];
  const flameGeo = keep(lathe(flamePts, 10));
  const flameMat = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.flame).multiplyScalar(4.6), fog: false }));
  const coreMat = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.flameCore).multiplyScalar(8.5), fog: false }));
  const glowMat = new THREE.SpriteMaterial({ map: blob, color: PAL.flame, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  owned.push(glowMat);
  const dripGeoB = new Geo();
  const dr2 = rng(41);
  for (let i = 0; i < 3; i++) { const a = dr2() * TAU; dripGeoB.add(new THREE.SphereGeometry(1, 6, 5), TRS(Math.cos(a) * 0.66, 1.6 - i * 0.09, Math.sin(a) * 0.66, 0, 0, 0, 0.1, 0.24 + dr2() * 0.2, 0.1), PAL.wax, false); }
  dripGeoB.add(new THREE.SphereGeometry(1, 7, 5), TRS(0.9, 0.2, 0.5, 0, 0, 0, 0.26, 0.07, 0.2), PAL.wax, false);
  const dripGeo = keep(dripGeoB.build());

  const lights: THREE.PointLight[] = [];
  const candles: Candle[] = CANDLES.map(([x, z, seed], i) => {
    const e = place('candle', x, z, seed * 5.1 + i, 5.2, 5.2, 7.4);
    e.group.add(mesh(holder, metal), mesh(dripGeo, satin, false));
    const body = mesh(waxBody, waxMat); body.position.y = 1.44; e.group.add(body);
    const cap = new THREE.Group(); cap.add(mesh(capGeo, capMat));
    const flame = new THREE.Mesh(flameGeo, flameMat); flame.position.y = 0.2; flame.userData.skipBox = true;
    const core = new THREE.Mesh(flameGeo, coreMat); core.position.y = 0.26; core.scale.setScalar(0.52); core.userData.skipBox = true;
    const halo = new THREE.Sprite(glowMat); halo.position.y = 0.62; halo.scale.setScalar(5.4);
    cap.add(flame, core, halo); e.group.add(cap);
    const light = new THREE.PointLight(PAL.flame, 200, 74, 2);
    cap.add(light); light.position.y = 0.75;
    lights.push(light);
    const full = 5.5 * (1 - seed * 0.13);
    return { entry: e, body, cap, flame, core, halo, light, seed: seed * 37.1 + i * 11.3, full, h: -1 };
  });

  // ── the coffer ─────────────────────────────────────────────────────────
  const CW = 5.4, CD = 3.5, CH = 2.3, CT = 0.2;
  const coffer = place('coffer', PROP_AT.coffer[0], PROP_AT.coffer[1], PROP_AT.coffer[2], 8.4, 6.6, CH);
  const cofferWood = new Geo(), cofferMetal = new Geo();
  cofferWood.add(new THREE.BoxGeometry(CW, 0.2, CD), TRS(0, 0.1, 0), WOOD_DARK);
  for (let i = 0; i < 3; i++) {
    const y = (i + 0.5) * (CH / 3), ph = CH / 3 - 0.025;
    for (const s of [-1, 1]) {
      cofferWood.add(new THREE.BoxGeometry(CW, ph, CT), TRS(0, y, s * (CD / 2 - CT / 2)), tint(PAL.timberLight, 31 + i * 7 + s, 0.09));
      cofferWood.add(new THREE.BoxGeometry(CT, ph, CD - CT * 2), TRS(s * (CW / 2 - CT / 2), y, 0), tint(PAL.timberLight, 57 + i * 5 + s, 0.09));
    }
  }
  // felt lining
  const ix = CW / 2 - CT - 0.02, iz = CD / 2 - CT - 0.02, floorY = 0.22;
  cofferWood.add(new THREE.BoxGeometry(ix * 2, 0.03, iz * 2), TRS(0, floorY - 0.015, 0), PAL.felt);
  for (const s of [-1, 1]) {
    cofferWood.add(new THREE.BoxGeometry(ix * 2, CH - 0.34, 0.025), TRS(0, CH / 2 + 0.03, s * (iz - 0.0)), PAL.felt);
    cofferWood.add(new THREE.BoxGeometry(0.025, CH - 0.34, iz * 2), TRS(s * ix, CH / 2 + 0.03, 0), PAL.felt);
  }
  // iron straps, rim, studs, lock, ring handles
  for (const sx of [-1.65, 1.65]) for (const s of [-1, 1]) {
    cofferMetal.add(new THREE.BoxGeometry(0.4, CH + 0.02, 0.05), TRS(sx, CH / 2, s * (CD / 2 + 0.025)), PAL.iron);
    for (const y of [0.3, CH / 2, CH - 0.3]) cofferMetal.add(new THREE.SphereGeometry(0.075, 7, 5), TRS(sx, y, s * (CD / 2 + 0.05)), PAL.iron, false);
  }
  for (const s of [-1, 1]) {
    cofferMetal.add(new THREE.BoxGeometry(CW + 0.08, 0.14, 0.05), TRS(0, CH - 0.07, s * (CD / 2 + 0.025)), PAL.iron);
    cofferMetal.add(new THREE.BoxGeometry(0.05, 0.14, CD + 0.08), TRS(s * (CW / 2 + 0.025), CH - 0.07, 0), PAL.iron);
    cofferMetal.add(new THREE.BoxGeometry(0.05, CH, 0.34), TRS(s * (CW / 2 + 0.025), CH / 2, CD / 2 - 0.17), PAL.iron);
    cofferMetal.add(new THREE.BoxGeometry(0.05, CH, 0.34), TRS(s * (CW / 2 + 0.025), CH / 2, -CD / 2 + 0.17), PAL.iron);
    cofferMetal.add(new THREE.TorusGeometry(0.34, 0.055, 6, 12), TRS(s * (CW / 2 + 0.09), CH * 0.5, 0, 0, Math.PI / 2, 0), PAL.iron, false);
  }
  cofferMetal.add(new THREE.BoxGeometry(0.78, 0.9, 0.06), TRS(0, CH - 0.62, CD / 2 + 0.035), PAL.brass);
  cofferMetal.add(new THREE.BoxGeometry(0.12, 0.3, 0.03), TRS(0, CH - 0.72, CD / 2 + 0.07), PAL.soot);
  coffer.group.add(mesh(cofferWood.build(), matte), mesh(cofferMetal.build(), metal));
  // the lid: a barrel of planks, hinged at the back, thrown open
  const lid = new THREE.Group();
  lid.position.set(0, CH, -CD / 2);
  const lidWood = new Geo(), lidMetal = new Geo();
  const R = CD / 2, squash = 0.56, NP = 7;
  for (let i = 0; i < NP; i++) {
    const a0 = (i / NP) * Math.PI, a1 = ((i + 1) / NP) * Math.PI, am = (a0 + a1) / 2;
    const y0 = R * Math.sin(a0) * squash, z0 = R + R * Math.cos(a0), y1 = R * Math.sin(a1) * squash, z1 = R + R * Math.cos(a1);
    const len = Math.hypot(y1 - y0, z1 - z0), ang = Math.atan2(y1 - y0, z1 - z0);
    const ym = R * Math.sin(am) * squash, zm = R + R * Math.cos(am);
    lidWood.add(new THREE.BoxGeometry(CW, 0.17, len + 0.03), TRS(0, ym, zm, -ang, 0, 0), tint(PAL.timberLight, 90 + i * 13, 0.09));
    // the plank's local +y points into the barrel: felt goes there, iron straps on the far side
    lidWood.add(new THREE.BoxGeometry(CW - 0.5, 0.03, len + 0.01), TRS(0, ym + 0.1 * Math.cos(ang), zm - 0.1 * Math.sin(ang), -ang, 0, 0), PAL.felt);
    for (const sx of [-1.65, 1.65]) lidMetal.add(new THREE.BoxGeometry(0.4, 0.05, len + 0.05), TRS(sx, ym - 0.1 * Math.cos(ang), zm + 0.1 * Math.sin(ang), -ang, 0, 0), PAL.iron);
  }
  for (const s of [-1, 1]) {
    lidWood.add(new THREE.CircleGeometry(R, 10, 0, Math.PI), TRS(s * (CW / 2 - 0.04), 0, R, 0, s * Math.PI / 2, 0, 1, squash, 1), tint(PAL.timberLight, 140 + s, 0.06));
    lidWood.add(new THREE.CircleGeometry(R - 0.1, 10, 0, Math.PI), TRS(s * (CW / 2 - 0.07), 0, R, 0, -s * Math.PI / 2, 0, 1, squash, 1), PAL.felt);
  }
  lidMetal.add(new THREE.BoxGeometry(0.5, 0.42, 0.06), TRS(0, 0.08, CD + 0.03), PAL.brass);
  lid.add(mesh(lidWood.build(), matte), mesh(lidMetal.build(), metal));
  lid.rotation.x = -1.84;
  coffer.group.add(lid);
  // the hoard
  const N_HEAP = 250, N_LOOSE = 16;
  const coinGeo = keep(new THREE.CylinderGeometry(0.27, 0.27, 0.07, 10));
  const goldMat = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.27, metalness: 1, envMap, envMapIntensity: 1.7 }));
  const coins = new THREE.InstancedMesh(coinGeo, goldMat, N_HEAP + N_LOOSE);
  coins.receiveShadow = true; coins.castShadow = false; coins.frustumCulled = false;
  const cr = rng(7711);
  const coinData: { x: number; z: number; rx: number; ry: number; rz: number; j: number }[] = [];
  for (let i = 0; i < N_HEAP; i++) coinData.push({ x: (cr() * 2 - 1) * (ix - 0.3), z: (cr() * 2 - 1) * (iz - 0.3), rx: (cr() - 0.5) * 0.9, ry: cr() * TAU, rz: (cr() - 0.5) * 0.9, j: cr() });
  const looseAt: [number, number, number][] = [];
  for (let i = 0; i < N_LOOSE; i++) {
    if (i < 5) looseAt.push([-1.9 + (cr() - 0.5) * 0.05, 0.035 + i * 0.072, CD / 2 + 1.25 + (cr() - 0.5) * 0.05]);          // a stack
    else if (i < 8) looseAt.push([-0.9 + (cr() - 0.5) * 0.05, 0.035 + (i - 5) * 0.072, CD / 2 + 1.75 + (cr() - 0.5) * 0.05]);
    else looseAt.push([-3.2 + cr() * 4.6, 0.035, CD / 2 + 0.6 + cr() * 2.1]);
  }
  for (let i = 0; i < N_HEAP + N_LOOSE; i++) coins.setColorAt(i, _col.setHex(mix(PAL.gold, i % 5 === 0 ? PAL.goldDark : 0xffd76a, cr() * 0.6)));
  coffer.group.add(coins);
  const moundGeo = keep(new THREE.SphereGeometry(1, 14, 6, 0, TAU, 0, Math.PI / 2));
  const moundMat = keep(new THREE.MeshStandardMaterial({ color: PAL.goldDark, roughness: 0.42, metalness: 1, envMap, envMapIntensity: 1.0 }));
  const mound = new THREE.Mesh(moundGeo, moundMat);
  mound.position.y = floorY; mound.receiveShadow = true;
  coffer.group.add(mound);
  const webTex = keep(cobwebTexture());
  const webMat = keep(new THREE.MeshBasicMaterial({ map: webTex, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false, color: 0xc8c8c0 }));
  const webGeo = keep(new THREE.PlaneGeometry(2.3, 2.3));
  const webs: THREE.Mesh[] = [];
  for (const [x, y, z, ry, rx] of [[-ix + 1.0, CH - 1.05, -iz + 1.0, Math.PI / 4, 0], [ix - 1.15, floorY + 0.06, iz - 1.15, Math.PI, -Math.PI / 2], [ix - 0.9, CH - 1.0, -iz + 0.9, -Math.PI / 4, 0]] as const) {
    const wb = new THREE.Mesh(webGeo, webMat);
    wb.position.set(x, y, z); wb.rotation.set(rx, ry, 0); wb.visible = false; wb.renderOrder = 4;
    coffer.group.add(wb); webs.push(wb);
  }
  let goldGoal = 0, goldShown = -1, debt = false, pileTop = floorY, pulse = 0;
  const levelOf = (gold: number): number => clamp01(Math.log10(1 + Math.max(0, gold) / 20) / Math.log10(1 + 20000 / 20));
  function layoutCoins(level: number): void {
    const n = debt ? 0 : Math.round(4 + (N_HEAP - 4) * Math.pow(level, 1.1));
    const Hm = CH * 1.3 * level;
    const ex = ix * 1.0, ez = iz * 1.0;
    for (let i = 0; i < N_HEAP; i++) {
      const c = coinData[i]!;
      if (i >= n) { coins.setMatrixAt(i, _m.makeScale(0, 0, 0)); continue; }
      const dome = Math.sqrt(Math.max(0, 1 - (c.x / ex) ** 2 - (c.z / ez) ** 2));
      const y = floorY + Hm * 0.95 * dome + 0.04 + c.j * 0.06 * (0.4 + level);
      const tilt = 0.35 + level * 0.65;     // a thin scatter lies flat; a heap tumbles
      coins.setMatrixAt(i, composeInto(_m, c.x, y, c.z, c.rx * tilt, c.ry, c.rz * tilt, 1, 1, 1));
    }
    const loose = debt ? 0 : Math.round(3 + (N_LOOSE - 3) * clamp01(level * 1.6));
    for (let i = 0; i < N_LOOSE; i++) {
      const p = looseAt[i]!;
      if (i >= loose) coins.setMatrixAt(N_HEAP + i, _m.makeScale(0, 0, 0));
      else coins.setMatrixAt(N_HEAP + i, composeInto(_m, p[0], p[1], p[2], 0, i * 1.7, 0, 1, 1, 1));
    }
    coins.instanceMatrix.needsUpdate = true;
    mound.visible = !debt && level > 0.015;
    mound.scale.set(ex * 0.98, Math.max(0.001, Hm * 0.95), ez * 0.98);
    for (const wb of webs) wb.visible = debt;
    pileTop = floorY + Hm * 0.95 + 0.15;
  }

  // ── the ledger, inkwell and quill ──────────────────────────────────────
  const ledger = place('ledger', PROP_AT.ledger[0], PROP_AT.ledger[1], PROP_AT.ledger[2], 10.4, 7.6, 0.9);
  {
    const book = new Geo();
    const BW = 3.5, BD = 4.7;
    book.add(new THREE.BoxGeometry(BW * 2 + 0.5, 0.14, BD + 0.44), TRS(0, 0.07, 0), LEATHER);
    book.add(new THREE.CylinderGeometry(0.2, 0.2, BD + 0.44, 8), TRS(0, 0.12, 0, Math.PI / 2, 0, 0), LEATHER);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) book.add(new THREE.BoxGeometry(0.5, 0.03, 0.5), TRS(sx * (BW + 0.02), 0.15, sz * (BD / 2 + 0.0)), PAL.brass);
    const NS = 7;
    const topY = (u: number) => 0.5 + 0.2 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.12)), 0.9) - 0.13 * u;
    const pagePos: number[] = [], pageUv: number[] = [];
    for (const s of [-1, 1]) {
      for (let i = 0; i < NS; i++) {
        const u0 = i / NS, u1 = (i + 1) / NS;
        const x0 = s * (0.1 + u0 * BW), x1 = s * (0.1 + u1 * BW), y0 = topY(u0), y1 = topY(u1);
        // page top (textured)
        const U = (x: number) => 0.5 + (x / (0.1 + BW)) * 0.5;
        const quad = [[x0, y0, BD / 2], [x1, y1, BD / 2], [x1, y1, -BD / 2], [x0, y0, -BD / 2]] as const;
        const ord = s > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
        for (const j of ord) { const q = quad[j]!; pagePos.push(q[0], q[1], q[2]); pageUv.push(U(q[0]), q[2] > 0 ? 0 : 1); }
        // the block's edges
        const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = s > 0 ? y0 : y1, by = s > 0 ? y1 : y0;
        book.quad(ax, 0.14, BD / 2, bx, 0.14, BD / 2, bx, by, BD / 2, ax, ay, BD / 2, PAGE);
        book.quad(bx, 0.14, -BD / 2, ax, 0.14, -BD / 2, ax, ay, -BD / 2, bx, by, -BD / 2, PAGE);
      }
      const xe = s * (0.1 + BW), ye = topY(1);
      if (s > 0) book.quad(xe, 0.14, BD / 2, xe, 0.14, -BD / 2, xe, ye, -BD / 2, xe, ye, BD / 2, mix(PAGE, PAL.dirt, 0.2));
      else book.quad(xe, 0.14, -BD / 2, xe, 0.14, BD / 2, xe, ye, BD / 2, xe, ye, -BD / 2, mix(PAGE, PAL.dirt, 0.2));
    }
    book.add(new THREE.BoxGeometry(0.2, 0.025, 1.5), TRS(0.5, 0.36, BD / 2 + 0.55, 0.42, 0.1, 0), PAL.crimson);
    ledger.group.add(mesh(book.build(), matte));
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(pagePos, 3));
    pg.setAttribute('uv', new THREE.Float32BufferAttribute(pageUv, 2));
    pg.computeVertexNormals();
    const pageTex = keep(canvasTex(ledgerCanvas(), { aniso: 8 }));
    const pageMat = keep(new THREE.MeshStandardMaterial({ map: pageTex, roughness: 0.9 }));
    ledger.group.add(mesh(pg, pageMat, false));

    // inkwell and quill stand by the ledger and answer to it
    const ink = new THREE.Group();
    ink.position.set(PROP_AT.inkwell[0] - PROP_AT.ledger[0], 0, PROP_AT.inkwell[2] - PROP_AT.ledger[2]);
    ink.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), -PROP_AT.ledger[2]);
    const pot = new Geo();
    pot.add(lathe([[0, 0], [0.56, 0], [0.64, 0.1], [0.64, 0.5], [0.44, 0.72], [0.3, 0.78], [0.3, 0.9], [0.37, 0.96], [0.27, 0.98], [0.25, 0.8], [0, 0.78]], 12), null, PEWTER, false);
    ink.add(mesh(pot.build(), metal));
    const quill = new Geo();
    quill.add(new THREE.CylinderGeometry(0.018, 0.035, 3.3, 5), TRS(0, 1.65, 0), 0xe9e2cf);
    const vane: [number, number][] = [[1.0, 0.0], [1.3, 0.3], [1.8, 0.4], [2.4, 0.36], [2.9, 0.22], [3.3, 0.0]];
    for (let i = 0; i < vane.length - 1; i++) {
      const [ya, wa] = vane[i]!, [yb, wb] = vane[i + 1]!;
      const c = i % 2 ? 0xf1ece0 : 0xe2dccb;
      quill.quad(0, ya, 0, wa, ya + 0.12, 0.05, wb, yb + 0.12, 0.05, 0, yb, 0, c);
      quill.quad(0, ya, 0, 0, yb, 0, -wb * 0.7, yb + 0.1, 0.05, -wa * 0.7, ya + 0.1, 0.05, c);
      quill.quad(0, ya, 0, 0, yb, 0, wb, yb + 0.12, 0.05, wa, ya + 0.12, 0.05, c);
      quill.quad(0, ya, 0, -wa * 0.7, ya + 0.1, 0.05, -wb * 0.7, yb + 0.1, 0.05, 0, yb, 0, c);
    }
    const quillMesh = mesh(quill.build(), matte);
    quillMesh.position.set(0, 0.5, 0); quillMesh.rotation.set(0.25, 0.6, -0.48);
    ink.add(quillMesh);
    const sh = new THREE.Mesh(flatGeo, shadowMat); sh.scale.set(2.4, 1, 2.4); sh.position.y = 0.02; sh.renderOrder = 2;
    ink.add(sh);
    ledger.group.add(ink);
  }

  // ── the charter and its seal ───────────────────────────────────────────
  const charter = place('charter', PROP_AT.charter[0], PROP_AT.charter[1], PROP_AT.charter[2], 6.8, 9.0, 0.8);
  const waxSealMat = keep(new THREE.MeshStandardMaterial({ color: PAL.crimson, roughness: 0.3, metalness: 0, emissive: 0xff4422, emissiveIntensity: 0 }));
  {
    const SW = 4.4, SD = 6.4, NS = 14;
    const pos: number[] = [], uv: number[] = [];
    const yAt = (v: number) => 0.03 + 0.66 * smoothstep(0.1, 0, v) + 0.4 * smoothstep(0.92, 1, v) + 0.03 * Math.sin(v * 9);
    for (let i = 0; i < NS; i++) {
      const v0 = i / NS, v1 = (i + 1) / NS, z0 = -SD / 2 + v0 * SD, z1 = -SD / 2 + v1 * SD;
      const q = [[-SW / 2, yAt(v0), z0, 0, 1 - v0], [-SW / 2, yAt(v1), z1, 0, 1 - v1], [SW / 2, yAt(v1), z1, 1, 1 - v1], [SW / 2, yAt(v0), z0, 1, 1 - v0]] as const;
      for (const j of [0, 1, 2, 0, 2, 3]) { const p = q[j]!; pos.push(p[0], p[1], p[2]); uv.push(p[3], p[4]); }
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    sg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    sg.computeVertexNormals();
    const tex = keep(canvasTex(charterCanvas(), { aniso: 8 }));
    const sheetMat = keep(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.88, side: THREE.DoubleSide }));
    charter.group.add(mesh(sg, sheetMat, true));
    const rolls = new Geo();
    rolls.add(new THREE.CylinderGeometry(0.36, 0.36, SW + 0.16, 12), TRS(0, 0.36, -SD / 2 - 0.05, 0, 0, Math.PI / 2), PAL.parchment, false);
    rolls.add(new THREE.CylinderGeometry(0.21, 0.21, SW + 0.08, 10), TRS(0, 0.22, SD / 2 + 0.02, 0, 0, Math.PI / 2), mix(PAL.parchment, PAL.dirt, 0.12), false);
    for (const s of [-1, 1]) {
      rolls.add(new THREE.CylinderGeometry(0.11, 0.11, 0.5, 8), TRS(s * (SW / 2 + 0.3), 0.36, -SD / 2 - 0.05, 0, 0, Math.PI / 2), WOOD_DARK, false);
      rolls.add(new THREE.SphereGeometry(0.19, 8, 6), TRS(s * (SW / 2 + 0.58), 0.36, -SD / 2 - 0.05), WOOD_DARK, false);
    }
    // ribbon tails under the seal
    rolls.add(new THREE.BoxGeometry(0.34, 0.02, 2.0), TRS(2.05, 0.07, 2.2, 0, 1.25, 0), PAL.lapis);
    rolls.add(new THREE.BoxGeometry(0.34, 0.02, 1.8), TRS(1.95, 0.075, 1.72, 0, 1.75, 0), PAL.lapis);
    charter.group.add(mesh(rolls.build(), satin));
    const sealG = new Geo();
    sealG.add(jitter(new THREE.CylinderGeometry(0.52, 0.56, 0.1, 13), 0.05, 5), TRS(0, 0.05, 0), 0xffffff, false);
    sealG.add(new THREE.TorusGeometry(0.31, 0.05, 5, 14), TRS(0, 0.1, 0, Math.PI / 2, 0, 0), 0xffffff, false);
    sealG.add(new THREE.ConeGeometry(0.16, 0.06, 5), TRS(0, 0.12, 0), 0xffffff, false);
    const sealGeo = sealG.build(); sealGeo.deleteAttribute('color');
    const sealMesh = mesh(sealGeo, waxSealMat);
    sealMesh.position.set(1.22, 0.09, 1.95);
    charter.group.add(sealMesh);
  }

  // ── the seal-stamp and its stick of wax ────────────────────────────────
  const stamp = place('seal', PROP_AT.seal[0], PROP_AT.seal[1], PROP_AT.seal[2], 3.6, 3.4, 1.9);
  {
    const gm = new Geo(), gw = new Geo();
    gm.add(lathe([[0, 0], [0.44, 0], [0.44, 0.13], [0.22, 0.22], [0.17, 0.5], [0, 0.5]], 12), null, PAL.brass, false);
    gw.add(lathe([[0.17, 0.5], [0.3, 0.74], [0.35, 1.08], [0.25, 1.4], [0.31, 1.56], [0.2, 1.74], [0, 1.77]], 12), null, WOOD_DARK, false);
    gw.add(new THREE.BoxGeometry(0.32, 0.3, 2.3), TRS(1.05, 0.15, 0.3, 0, 0.5, 0), PAL.crimson);
    gw.add(new THREE.BoxGeometry(0.34, 0.2, 0.3), TRS(1.6, 0.11, -0.72, 0, 0.5, 0), mix(PAL.crimson, PAL.soot, 0.5));
    for (const [x, z, s] of [[-0.9, 0.7, 0.2], [-0.6, 1.05, 0.12], [-1.15, 1.0, 0.09]] as const) gw.add(new THREE.SphereGeometry(1, 8, 5), TRS(x, 0.02, z, 0, 0, 0, s, s * 0.3, s), PAL.crimson, false);
    stamp.group.add(mesh(gm.build(), metal), mesh(gw.build(), satin));
  }

  // ── the rolled map ─────────────────────────────────────────────────────
  const mapScroll = place('map_scroll', PROP_AT.map_scroll[0], PROP_AT.map_scroll[1], PROP_AT.map_scroll[2], 8.2, 3.4, 1.0);
  {
    const gs = new Geo();
    gs.add(new THREE.CylinderGeometry(0.44, 0.44, 6.2, 12), TRS(0, 0.44, 0, 0, 0, Math.PI / 2), PAL.parchment, false);
    gs.add(new THREE.CylinderGeometry(0.3, 0.3, 6.24, 10), TRS(0, 0.44, 0, 0, 0, Math.PI / 2), mix(PAL.parchment, PAL.dirt, 0.35), false);
    gs.add(new THREE.CylinderGeometry(0.31, 0.31, 4.9, 10), TRS(0.5, 0.31, 0.92, 0, 0.16, Math.PI / 2), mix(PAL.parchment, PAL.dirt, 0.1), false);
    gs.add(new THREE.CylinderGeometry(0.2, 0.2, 4.94, 8), TRS(0.5, 0.31, 0.92, 0, 0.16, Math.PI / 2), mix(PAL.parchment, PAL.dirt, 0.4), false);
    gs.add(new THREE.CylinderGeometry(0.465, 0.465, 0.34, 12), TRS(0.3, 0.44, 0, 0, 0, Math.PI / 2), PAL.crimson, false);
    gs.add(new THREE.BoxGeometry(0.28, 0.02, 0.9), TRS(0.2, 0.9, 0.3, 0.9, 0.3, 0), PAL.crimson);
    gs.add(new THREE.BoxGeometry(0.28, 0.02, 0.8), TRS(0.45, 0.88, -0.28, -0.8, -0.2, 0), PAL.crimson);
    mapScroll.group.add(mesh(gs.build(), satin));
  }

  // ── the bell ───────────────────────────────────────────────────────────
  const bell = place('bell', PROP_AT.bell[0], PROP_AT.bell[1], PROP_AT.bell[2], 3.6, 3.6, 3.0);
  const bellBody = new THREE.Group();
  {
    const gb = new Geo(), gh = new Geo();
    gb.add(lathe([[0.98, 0], [1.02, 0.08], [0.84, 0.3], [0.64, 0.7], [0.52, 1.1], [0.43, 1.4], [0.3, 1.56], [0.12, 1.63], [0, 1.64]], 16), null, PAL.brass, false);
    gb.add(new THREE.CircleGeometry(0.95, 14), TRS(0, 0.04, 0, Math.PI / 2, 0, 0), PAL.soot);
    gh.add(lathe([[0.12, 1.62], [0.2, 1.75], [0.16, 2.0], [0.27, 2.4], [0.21, 2.76], [0.1, 2.92], [0, 2.94]], 10), null, WOOD_DARK, false);
    bellBody.add(mesh(gb.build(), metal), mesh(gh.build(), satin));
    bell.group.add(bellBody);
  }
  let bellT = -1;

  for (const e of entries) fitBox(e);
  for (const c of candles) { const b = c.entry.box, p = c.entry.group.position; b.min.set(p.x - 1.9, TABLE_Y, p.z - 1.9); b.max.set(p.x + 1.9, TABLE_Y + 7, p.z + 1.9); }

  let hover: TableProp | null = null;
  let charterReady = false;
  const hit = new THREE.Vector3();

  const api: Props = {
    group, lights,
    pos(prop, out = new THREE.Vector3()) {
      if (prop === 'coffer') return out.set(0, pileTop + 0.25, 0).applyMatrix4(coffer.group.matrixWorld);
      const e = entries.find(en => en.id === prop) ?? coffer;
      return out.copy(e.top).applyMatrix4(e.group.matrixWorld);
    },
    setGold(gold, instant = false) {
      const nowDebt = gold < 0, goal = levelOf(gold);
      if (!instant && goal > goldGoal + 0.0005) pulse = 1;     // new coin lands: the heap jumps
      goldGoal = goal;
      if (instant || goldShown < 0) goldShown = goal;
      if (instant || nowDebt !== debt) { debt = nowDebt; layoutCoins(goldShown); }
    },
    setCharterReady(on) { charterReady = on; },
    ringBell() { bellT = 0; },
    setHover(prop) { hover = prop; },
    pick(ray) {
      let best: { prop: TableProp; distance: number } | null = null;
      for (const e of entries) {
        if (!ray.intersectBox(e.box, hit)) continue;
        const d = hit.distanceTo(ray.origin);
        if (!best || d < best.distance) best = { prop: e.id, distance: d };
      }
      return best;
    },
    update(env, sky) {
      const t = env.time, dt = env.dt;
      // candles: burn down, flicker, lean with the draught
      for (let i = 0; i < candles.length; i++) {
        const c = candles[i]!;
        const h = lerp(c.full, 1.25, clamp01(sky.burn));
        if (Math.abs(h - c.h) > 0.002) {
          c.h = h;
          c.body.scale.y = h;
          c.cap.position.y = 1.44 + h;
          c.entry.top.y = 1.44 + h + 1.5;
          c.entry.box.max.y = TABLE_Y + 1.44 + h + 1.3;
        }
        const n1 = vnoise(t * 2.3, c.seed), n2 = vnoise(t * 7.1, c.seed + 5.5);
        const gutter = 1 + (n1 - 0.5) * 0.3 + Math.sin(t * 11.3 + c.seed) * 0.05 + (n2 - 0.5) * 0.16 * (0.5 + env.wind);
        const lean = (vnoise(t * 1.4, c.seed + 9.1) - 0.5) * (0.3 + env.wind * 0.9);
        c.flame.scale.set(1 + (1 - gutter) * 0.5, gutter, 1 + (1 - gutter) * 0.5);
        c.flame.rotation.z = lean; c.flame.rotation.x = (n2 - 0.5) * 0.2;
        c.core.scale.set(0.5, 0.52 * (0.85 + gutter * 0.15), 0.5);
        c.core.rotation.z = lean * 0.6;
        c.halo.scale.setScalar(5.2 * (0.9 + gutter * 0.1) * (1 + env.night * 0.25));
        (c.halo.material as THREE.SpriteMaterial).opacity = 0.34 + env.night * 0.16;
        c.light.intensity = 215 * sky.candle * (0.8 + gutter * 0.2);
      }
      // coffer: the pile follows the treasury
      if (goldShown >= 0 && Math.abs(goldShown - goldGoal) > 0.0015) {
        goldShown = Math.abs(goldShown - goldGoal) < 0.004 ? goldGoal : damp(goldShown, goldGoal, 2.2, dt);
        layoutCoins(goldShown);
      }
      if (pulse > 0) { pulse = Math.max(0, pulse - dt * 2.6); const k = 1 + Math.sin(pulse * Math.PI) * 0.045; coins.scale.set(k, 1 + Math.sin(pulse * Math.PI) * 0.09, k); }
      // bell: a damped swing when Rent Day is rung
      if (bellT >= 0) {
        bellT += dt;
        const decay = Math.exp(-bellT * 1.9);
        bellBody.rotation.z = Math.sin(bellT * 15) * 0.34 * decay;
        bellBody.position.y = Math.abs(Math.sin(bellT * 15)) * 0.16 * decay;
        if (bellT > 3.2) { bellT = -1; bellBody.rotation.z = 0; bellBody.position.y = 0; }
      }
      waxSealMat.emissiveIntensity = charterReady ? 0.5 + 0.45 * Math.sin(t * 3.1) : 0;
      // hover: the thing under the cursor lifts a finger's width and glows at its foot
      for (const e of entries) {
        const want = hover === e.id ? 1 : 0;
        if (e.lift === want) continue;
        e.lift = Math.abs(e.lift - want) < 0.01 ? want : damp(e.lift, want, 12, dt);
        e.group.position.y = TABLE_Y + e.lift * 0.09;
        if (e.halo) { e.halo.visible = e.lift > 0.01; (e.halo.material as THREE.MeshBasicMaterial).opacity = e.lift * 0.34; e.halo.position.y = 0.03 - e.lift * 0.09; }
      }
    },
    setQuality(q) {
      // on 'low' only two candles (one far, one near) actually light the scene; all four still burn
      const lit = q === 'low' ? [0, 3] : [0, 1, 2, 3];
      lights.forEach((l, i) => { l.visible = lit.includes(i); });
    },
    dispose() { for (const o of owned) o.dispose(); coins.dispose(); },
  };
  api.setGold(0, true);
  return api;
}
