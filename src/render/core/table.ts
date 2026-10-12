/**
 * The room, the oak table and the realm board's wooden frame.
 * Everything here is drawn in code: canvas wood grain, a swept frame profile,
 * iron studs, brass corners and a small engraved plaque with the realm's name.
 */
import * as THREE from 'three';
import type { RenderCtx } from '../api';
import { PAL } from '../palette';
import { HALF_W, HALF_D, TABLE_Y, FRAME_OUT, FRAME_LIP, TABLE_W, TABLE_D } from './layout';
import { Geo, TRS, makeCanvas, canvasTex, css, cssMix, rng, smoothstep, lerp } from './util';

export interface Table {
  group: THREE.Group;
  setRealmName(name: string): void;
  dispose(): void;
}

/** A dim image of the room for polished metal and water to reflect: four candles, a cool wall, the warm table. */
export function makeRoomEnv(renderer: THREE.WebGLRenderer): THREE.Texture {
  const s = new THREE.Scene();
  const trash: { dispose(): void }[] = [];
  const add = (geo: THREE.BufferGeometry, hex: number, k: number, x: number, y: number, z: number, back = false) => {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: back ? THREE.BackSide : THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (!back) m.lookAt(0, 0, 0);
    s.add(m); trash.push(geo, mat);
  };
  add(new THREE.BoxGeometry(60, 60, 60), 0x0c0907, 1, 0, 0, 0, true);
  for (const [x, z] of [[-17, -15], [17, -15], [-19, 13], [19, 13]] as const) add(new THREE.PlaneGeometry(2.6, 5), PAL.flame, 16, x, 6, z);
  add(new THREE.PlaneGeometry(30, 12), 0x6f86c0, 1.5, 0, 20, -16);
  add(new THREE.PlaneGeometry(26, 10), 0xffd9a8, 0.9, 6, 22, 14);
  add(new THREE.PlaneGeometry(44, 44), PAL.oak, 0.9, 0, -20, 0);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0.03);
  pm.dispose();
  for (const t of trash) t.dispose();
  return rt.texture;
}

/** Tileable oak boards: colour and a matching height map (seams and grain catch the candlelight). */
function oakCanvases(seed: number, size: number, boards: number, base: number, dark: number, light: number): { color: HTMLCanvasElement; bump: HTMLCanvasElement } {
  const r = rng(seed);
  const strokes: { y: number; amp: number; k: number; ph: number; w: number; a: number; lightish: boolean }[] = [];
  const bh = size / boards;
  const tones: number[] = [];
  const joints: number[] = [];
  const knots: { x: number; y: number; s: number }[] = [];
  for (let b = 0; b < boards; b++) {
    tones.push((r() - 0.5) * 0.3);
    joints.push(r() * size);
    const n = 22 + Math.floor(r() * 14);
    for (let i = 0; i < n; i++) strokes.push({ y: b * bh + r() * bh, amp: 0.6 + r() * 3.2, k: 1 + Math.floor(r() * 3), ph: r() * Math.PI * 2, w: 0.6 + r() * 1.9, a: 0.07 + r() * 0.17, lightish: r() < 0.28 });
    if (r() < 0.6) knots.push({ x: r() * size, y: b * bh + bh * (0.25 + r() * 0.5), s: 0.7 + r() * 0.9 });
  }
  const paint = (g: CanvasRenderingContext2D, bump: boolean) => {
    g.fillStyle = bump ? '#8a8a8a' : css(base);
    g.fillRect(0, 0, size, size);
    if (!bump) for (let b = 0; b < boards; b++) {
      g.fillStyle = tones[b]! > 0 ? cssMix(base, light, tones[b]!) : cssMix(base, dark, -tones[b]!);
      g.fillRect(0, b * bh, size, bh);
    }
    for (const st of strokes) {
      g.strokeStyle = bump ? (st.lightish ? '#9c9c9c' : '#6e6e6e') : css(st.lightish ? light : dark);
      g.globalAlpha = bump ? st.a * 1.6 : st.a;
      g.lineWidth = st.w;
      g.beginPath();
      for (let x = 0; x <= size; x += 12) {
        const yy = st.y + Math.sin((x / size) * Math.PI * 2 * st.k + st.ph) * st.amp + Math.sin((x / size) * Math.PI * 2 * (st.k + 2) + st.ph * 1.7) * st.amp * 0.35;
        if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
      }
      g.stroke();
    }
    for (const k of knots) for (let i = 5; i > 0; i--) {
      g.globalAlpha = bump ? 0.35 : 0.3;
      g.strokeStyle = bump ? '#5a5a5a' : css(dark);
      g.lineWidth = 1.3;
      g.beginPath(); g.ellipse(k.x, k.y, i * 3.4 * k.s, i * 1.7 * k.s, 0.15, 0, Math.PI * 2); g.stroke();
    }
    g.globalAlpha = 1;
    for (let b = 0; b < boards; b++) {
      // the seam between boards, and one butt joint along each
      g.fillStyle = bump ? '#1c1c1c' : cssMix(dark, 0x000000, 0.45);
      g.globalAlpha = bump ? 1 : 0.8;
      g.fillRect(0, (b + 1) * bh - 1.6, size, 3.2);
      g.fillRect(joints[b]!, b * bh, 2.6, bh);
      if (!bump) { g.globalAlpha = 0.18; g.fillStyle = css(light); g.fillRect(0, b * bh + 1.8, size, 1.4); }
    }
    g.globalAlpha = 1;
  };
  return { color: makeCanvas(size, size, g => paint(g, false)), bump: makeCanvas(size, size, g => paint(g, true)) };
}

/** Sweep a 2D profile (outward offset, height) round the board's rectangle with mitred corners. */
function frameGeometry(profile: [number, number][]): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [];
  const corner = (k: number, o: number): [number, number] => {
    const sx = k === 0 || k === 3 ? -1 : 1, sz = k < 2 ? 1 : -1;      // 0 SW, 1 SE, 2 NE, 3 NW
    return [sx * (HALF_W + o), sz * (HALF_D + o)];
  };
  const out: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];   // outward for sides S, E, N, W
  let v0 = 0;
  for (let i = 0; i < profile.length - 1; i++) {
    const [o0, y0] = profile[i]!, [o1, y1] = profile[i + 1]!;
    const seg = Math.hypot(o1 - o0, y1 - y0);
    const nO = -(y1 - y0) / seg, nY = (o1 - o0) / seg;
    for (let k = 0; k < 4; k++) {
      const a0 = corner(k, o0), b0 = corner((k + 1) % 4, o0), a1 = corner(k, o1), b1 = corner((k + 1) % 4, o1);
      const P = [[a0[0], y0, a0[1]], [b0[0], y0, b0[1]], [b1[0], y1, b1[1]], [a1[0], y1, a1[1]]] as const;
      const len = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]);
      const U = [0, len / 5, len / 5, 0], V = [v0, v0, v0 + seg / 1.6, v0 + seg / 1.6];
      // face normal wanted: outward * nO + up * nY
      const ux = P[1][0] - P[0][0], uy = P[1][1] - P[0][1], uz = P[1][2] - P[0][2];
      const wx = P[3][0] - P[0][0], wy = P[3][1] - P[0][1], wz = P[3][2] - P[0][2];
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      const want = nx * out[k]![0] * nO + ny * nY + nz * out[k]![1] * nO;
      const order = want >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
      for (const j of order) { pos.push(P[j]![0], P[j]![1], P[j]![2]); uv.push(U[j]!, V[j]!); }
    }
    v0 += seg / 1.6;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

export function createTable(ctx: RenderCtx, envMap: THREE.Texture): Table {
  const group = new THREE.Group();
  group.name = 'table';
  const aniso = Math.min(8, ctx.renderer.capabilities.getMaxAnisotropy());
  const owned: { dispose(): void }[] = [];

  // ── the oak table: boards along x, darker toward the edges so the light pools on the board
  const oak = oakCanvases(41, 1024, 7, PAL.oak, PAL.oakDark, PAL.oakLight);
  const oakMap = canvasTex(oak.color, { repeat: true, aniso });
  const oakBump = canvasTex(oak.bump, { repeat: true, srgb: false, aniso });
  oakMap.repeat.set(TABLE_W / 34, TABLE_D / 26); oakBump.repeat.copy(oakMap.repeat);
  const topGeo = new THREE.PlaneGeometry(TABLE_W, TABLE_D, 32, 24);
  topGeo.rotateX(-Math.PI / 2);
  {
    const p = topGeo.getAttribute('position') as THREE.BufferAttribute;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const rr = Math.hypot(p.getX(i) / 47, p.getZ(i) / 37);
      const k = lerp(1, 0.13, smoothstep(0.56, 1.06, rr));
      col[i * 3] = k; col[i * 3 + 1] = k * (0.96 + 0.04 * k); col[i * 3 + 2] = k * (0.9 + 0.1 * k);
    }
    topGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const topMat = new THREE.MeshStandardMaterial({ map: oakMap, bumpMap: oakBump, bumpScale: 1.4, roughness: 0.5, metalness: 0, vertexColors: true, envMap, envMapIntensity: 0.22 });
  const top = new THREE.Mesh(topGeo, topMat);
  top.position.y = TABLE_Y; top.receiveShadow = true;
  group.add(top);
  owned.push(topGeo, topMat, oakMap, oakBump);

  // the table's edge: a dark skirt, an iron strap and studs
  const skirtGeo = new THREE.BoxGeometry(TABLE_W, 3.2, TABLE_D);
  const skirtMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PAL.oakDark).multiplyScalar(0.4), roughness: 0.7 });
  const skirt = new THREE.Mesh(skirtGeo, skirtMat);
  skirt.position.y = TABLE_Y - 1.6 - 0.02;
  group.add(skirt);
  owned.push(skirtGeo, skirtMat);

  const metal = new Geo();
  const studGeo = new THREE.SphereGeometry(1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  const stud = (x: number, y: number, z: number, r: number, hex: number) => metal.add(studGeo, TRS(x, y, z, 0, 0, 0, r, r * 0.7, r), hex, false, true);
  for (const sz of [-1, 1]) {
    metal.add(new THREE.BoxGeometry(TABLE_W, 0.05, 0.9), TRS(0, TABLE_Y + 0.025, sz * (TABLE_D / 2 - 0.45)), PAL.iron);
    for (let x = -TABLE_W / 2 + 1.5; x < TABLE_W / 2; x += 3) stud(x, TABLE_Y + 0.05, sz * (TABLE_D / 2 - 0.45), 0.2, PAL.iron);
  }
  for (const sx of [-1, 1]) {
    metal.add(new THREE.BoxGeometry(0.9, 0.05, TABLE_D - 1.8), TRS(sx * (TABLE_W / 2 - 0.45), TABLE_Y + 0.025, 0), PAL.iron);
    for (let z = -TABLE_D / 2 + 3; z < TABLE_D / 2 - 1.5; z += 3) stud(sx * (TABLE_W / 2 - 0.45), TABLE_Y + 0.05, z, 0.2, PAL.iron);
  }

  // ── the board's frame: lip, flat, bevel, face, foot
  const profile: [number, number][] = [[0, -0.3], [0, FRAME_LIP], [0.62, FRAME_LIP], [0.84, 0.0], [1.0, -0.74], [FRAME_OUT, TABLE_Y]];
  const frameWood = oakCanvases(77, 512, 3, PAL.boardEdge, 0x2c1d12, 0x76522f);
  const frameMap = canvasTex(frameWood.color, { repeat: true, aniso });
  const frameBump = canvasTex(frameWood.bump, { repeat: true, srgb: false, aniso });
  const frameGeo = frameGeometry(profile);
  const frameMat = new THREE.MeshStandardMaterial({ map: frameMap, bumpMap: frameBump, bumpScale: 0.9, roughness: 0.46, metalness: 0, envMap, envMapIntensity: 0.3 });
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.castShadow = true; frame.receiveShadow = true;
  group.add(frame);
  owned.push(frameGeo, frameMat, frameMap, frameBump);

  // iron studs along the frame top, brass plates and studs at the corners
  const mid = 0.31;
  for (let x = -HALF_W + 2; x <= HALF_W - 2 + 0.01; x += 4) for (const sz of [-1, 1]) stud(x, FRAME_LIP, sz * (HALF_D + mid), 0.085, PAL.iron);
  for (let z = -HALF_D + 2; z <= HALF_D - 2 + 0.01; z += 4) for (const sx of [-1, 1]) stud(sx * (HALF_W + mid), FRAME_LIP, z, 0.085, PAL.iron);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const cx = sx * (HALF_W + mid), cz = sz * (HALF_D + mid);
    metal.add(new THREE.BoxGeometry(2.1, 0.035, 0.56), TRS(cx - sx * 0.77, FRAME_LIP + 0.017, cz), PAL.brass);
    metal.add(new THREE.BoxGeometry(0.56, 0.035, 1.54), TRS(cx, FRAME_LIP + 0.017, cz - sz * 1.05), PAL.brass);
    stud(cx, FRAME_LIP + 0.035, cz, 0.11, PAL.brass);
    stud(cx - sx * 1.5, FRAME_LIP + 0.035, cz, 0.07, PAL.iron);
    stud(cx, FRAME_LIP + 0.035, cz - sz * 1.5, 0.07, PAL.iron);
  }
  studGeo.dispose();
  const metalGeo = metal.build();
  const metalMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.88, roughness: 0.36, envMap, envMapIntensity: 1.15 });
  const metalMesh = new THREE.Mesh(metalGeo, metalMat);
  metalMesh.castShadow = true; metalMesh.receiveShadow = true;
  group.add(metalMesh);
  owned.push(metalGeo, metalMat);

  // ── the soft shadow the slab presses into the table
  const aoTex = canvasTex(makeCanvas(256, 192, (g, w, h) => {
    const img = g.createImageData(w, h);
    const ew = (HALF_W + FRAME_OUT) * 2 + 9, ed = (HALF_D + FRAME_OUT) * 2 + 9;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const wx = ((x + 0.5) / w - 0.5) * ew, wz = ((y + 0.5) / h - 0.5) * ed;
      const dx = Math.max(Math.abs(wx) - (HALF_W + FRAME_OUT - 0.2), 0), dz = Math.max(Math.abs(wz) - (HALF_D + FRAME_OUT - 0.2), 0);
      const a = 0.74 * Math.pow(1 - smoothstep(0, 4.2, Math.hypot(dx, dz)), 2.2);
      const i = (y * w + x) * 4;
      img.data[i] = 0; img.data[i + 1] = 0; img.data[i + 2] = 0; img.data[i + 3] = Math.round(a * 255);
    }
    g.putImageData(img, 0, 0);
  }), { srgb: false });
  const aoGeo = new THREE.PlaneGeometry((HALF_W + FRAME_OUT) * 2 + 9, (HALF_D + FRAME_OUT) * 2 + 9);
  aoGeo.rotateX(-Math.PI / 2);
  const aoMat = new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, depthWrite: false, color: 0x000000 });
  const ao = new THREE.Mesh(aoGeo, aoMat);
  ao.position.y = TABLE_Y + 0.012; ao.renderOrder = 1;
  group.add(ao);
  owned.push(aoGeo, aoMat, aoTex);

  // ── the engraved brass plaque on the near face
  const plaqueCanvas = makeCanvas(1024, 80, () => { /* drawn by setRealmName */ });
  const plaqueTex = canvasTex(plaqueCanvas, { aniso });
  const plaqueGeo = new THREE.PlaneGeometry(6.6, 0.52);
  const plaqueMat = new THREE.MeshStandardMaterial({ map: plaqueTex, metalness: 0.82, roughness: 0.4, envMap, envMapIntensity: 1.1 });
  const plaque = new THREE.Mesh(plaqueGeo, plaqueMat);
  const faceTilt = Math.atan2(1.0 - 0.84, 0.74);
  plaque.rotation.x = -faceTilt;
  plaque.position.set(0, -0.37, HALF_D + 0.92 + 0.02);
  plaque.receiveShadow = true;
  group.add(plaque);
  owned.push(plaqueGeo, plaqueMat, plaqueTex);

  let shownName = '\u0000';
  function drawPlaque(name: string): void {
    const g = plaqueCanvas.getContext('2d')!;
    const w = plaqueCanvas.width, h = plaqueCanvas.height;
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#caa24a'); grad.addColorStop(0.5, css(PAL.brass)); grad.addColorStop(1, '#8a6a2c');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(60,40,10,0.7)'; g.lineWidth = 3; g.strokeRect(7, 7, w - 14, h - 14);
    for (const x of [26, w - 26]) { g.fillStyle = '#5c4418'; g.beginPath(); g.arc(x, h / 2, 6, 0, Math.PI * 2); g.fill(); g.fillStyle = '#e2c676'; g.beginPath(); g.arc(x - 1.5, h / 2 - 1.5, 2.2, 0, Math.PI * 2); g.fill(); }
    const text = (name || 'LandLord').toUpperCase().split('').join(' ');
    g.textAlign = 'center'; g.textBaseline = 'middle';
    let px = 46;
    do { g.font = `${px}px "IM Fell English SC", "IM Fell English", Georgia, serif`; px -= 2; } while (g.measureText(text).width > w - 110 && px > 18);
    g.fillStyle = 'rgba(255,236,170,0.55)'; g.fillText(text, w / 2 + 1.2, h / 2 + 3.6);
    g.fillStyle = '#3a2810'; g.fillText(text, w / 2, h / 2 + 2);
    plaqueTex.needsUpdate = true;
  }
  drawPlaque('');
  // the fell type arrives after first paint; engrave again once it has
  try { void document.fonts?.ready.then(() => { if (shownName !== '\u0000') drawPlaque(shownName); }); } catch { /* no font loading API */ }

  return {
    group,
    setRealmName(name: string) { if (name !== shownName) { shownName = name; drawPlaque(name); } },
    dispose() { for (const o of owned) o.dispose(); },
  };
}
