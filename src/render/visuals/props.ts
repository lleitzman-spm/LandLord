/** Small carved props shared between incident visuals. All static: add them to a bone or holder. */
import * as THREE from 'three';
import { PAL, mat, mix } from '../palette';
import { aim, ball, blade, bone, box, cyl, grp, ring, spike, canvasTex, quad } from './kit';

export const WOOD = (): THREE.Material => mat(PAL.timberLight);
export const WOOD_D = (): THREE.Material => mat(PAL.timber);
export const IRON = (): THREE.Material => mat(PAL.iron);
export const ROPE = (): THREE.Material => mat(mix(PAL.thatchOld, PAL.clothBrown, 0.4));

/** a wooden pail standing on the ground, about 0.11 tall */
export function bucket(fill?: THREE.Material): THREE.Group {
  const g = grp();
  g.add(
    cyl(WOOD(), 0.058, 0.045, 0.1, 0, 0.05, 0, 0, 0, 0, 8),
    cyl(IRON(), 0.06, 0.058, 0.014, 0, 0.085, 0, 0, 0, 0, 8), cyl(IRON(), 0.05, 0.048, 0.014, 0, 0.025, 0, 0, 0, 0, 8),
  );
  if (fill) g.add(cyl(fill, 0.05, 0.05, 0.01, 0, 0.094, 0, 0, 0, 0, 8));
  const h = ring(IRON(), 0.055, 0.006, 0, 0.1, 0, Math.PI / 2 - 0.5, 0, 0, 8); h.scale.z *= 0.9; g.add(h);
  return g;
}

/** a barrel lying or standing; axis along y, about 0.26 tall */
export function barrel(): THREE.Group {
  const g = grp(), W = mat(PAL.timberLight), W2 = mat(mix(PAL.timberLight, PAL.thatch, 0.25));
  g.add(
    cyl(W, 0.085, 0.105, 0.09, 0, 0.085, 0, 0, 0, 0, 9), cyl(W2, 0.105, 0.105, 0.08, 0, 0, 0, 0, 0, 0, 9), cyl(W, 0.105, 0.085, 0.09, 0, -0.085, 0, 0, 0, 0, 9),
    cyl(IRON(), 0.1, 0.104, 0.018, 0, 0.055, 0, 0, 0, 0, 9), cyl(IRON(), 0.104, 0.1, 0.018, 0, -0.055, 0, 0, 0, 0, 9),
    cyl(WOOD_D(), 0.075, 0.075, 0.006, 0, 0.131, 0, 0, 0, 0, 9),
  );
  return g;
}

/** a squared timber from a to b */
export function strut(m: THREE.Material, a: THREE.Vector3, b: THREE.Vector3, w: number, d = w): THREE.Mesh {
  const o = box(m, w, a.distanceTo(b), d, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return aim(o, b.x - a.x, b.y - a.y, b.z - a.z);
}

/** a stake or pole standing at the origin */
export function pole(h: number, r = 0.014, m: THREE.Material = WOOD()): THREE.Mesh { return cyl(m, r * 0.8, r, h, 0, h / 2, 0, 0, 0, 0, 5); }

/** a sagging rope between two points, as short straight pieces; returns the group and a sampler */
export function rope(a: THREE.Vector3, b: THREE.Vector3, sag: number, m: THREE.Material = ROPE(), r = 0.006, segs = 6): { g: THREE.Group; at: (u: number, target?: THREE.Vector3) => THREE.Vector3 } {
  const g = grp();
  const at = (u: number, target = new THREE.Vector3()): THREE.Vector3 => target.lerpVectors(a, b, u).setY(a.y + (b.y - a.y) * u - sag * 4 * u * (1 - u));
  const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i < segs; i++) {
    at(i / segs, p0); at((i + 1) / segs, p1); d.subVectors(p1, p0);
    const len = d.length();
    const o = box(m, r * 2, len * 1.04, r * 2, (p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2);
    aim(o, d.x, d.y, d.z); g.add(o);
  }
  return { g, at };
}

export type GarmentKind = 'shirt' | 'hose' | 'sock' | 'sheet' | 'smock';
/** a flat garment hanging from y = 0, facing +z; about 0.13 tall */
export function garment(kind: GarmentKind, color: number): THREE.Group {
  const g = grp(), m = mat(color), t = 0.012;
  if (kind === 'shirt') {
    g.add(box(m, 0.085, 0.1, t, 0, -0.06, 0), box(m, 0.05, 0.03, t, -0.062, -0.03, 0, 0, 0, 0.5), box(m, 0.05, 0.03, t, 0.062, -0.03, 0, 0, 0, -0.5));
  } else if (kind === 'hose') {
    g.add(box(m, 0.08, 0.04, t, 0, -0.02, 0), box(m, 0.034, 0.1, t, -0.023, -0.085, 0), box(m, 0.034, 0.1, t, 0.023, -0.085, 0));
  } else if (kind === 'sock') {
    g.add(box(m, 0.03, 0.08, t, 0, -0.04, 0), box(m, 0.05, 0.028, t, 0.012, -0.09, 0));
  } else if (kind === 'smock') {
    g.add(box(m, 0.07, 0.06, t, 0, -0.03, 0), box(m, 0.11, 0.07, t, 0, -0.09, 0), box(m, 0.04, 0.028, t, -0.055, -0.03, 0, 0, 0, 0.6), box(m, 0.04, 0.028, t, 0.055, -0.03, 0, 0, 0, -0.6));
  } else {
    g.add(box(m, 0.16, 0.13, t, 0, -0.065, 0));
  }
  return g;
}

export interface Goblin { root: THREE.Group; head: THREE.Group; eyes: THREE.Group; ears: THREE.Group }
/**
 * A goblin from the chest up, for peeking: origin at the centre of the head,
 * facing +z. Officious rather than wicked: a clerk's cap and quill, a saucepan,
 * or just hair. `hands` rest on whatever is in front of it.
 */
export function goblin(variant: number, hands = true, body = true): Goblin {
  const GOB = mat(PAL.goblin), GOB_D = mat(PAL.goblinDark), INK = mat(PAL.ink), WHITE = mat(PAL.hairWhite);
  const root = bone(null);
  if (body) root.add(cyl(mat([PAL.clothBrown, PAL.clothGrey, PAL.clothPlum][variant % 3]), 0.045, 0.07, 0.15, 0, -0.14, -0.005, 0, 0, 0, 7));
  if (hands) root.add(ball(GOB, 0.027, 0.022, 0.027, -0.085, -0.085, 0.045), ball(GOB, 0.027, 0.022, 0.027, 0.085, -0.085, 0.045));
  const head = bone(root);
  head.add(
    ball(GOB, 0.085, 0.078, 0.08),
    aim(spike(GOB_D, 0.023, 0.075, 0, -0.008, 0.068), 0, -0.18, 1),
    box(INK, 0.092, 0.024, 0.02, 0, -0.042, 0.062),
  );
  for (let i = 0; i < 4; i++) head.add(spike(WHITE, 0.011, 0.02, -0.03 + i * 0.02, -0.031, 0.071, Math.PI, 0, 0, 4));
  for (const sx of [-1, 1]) head.add(box(GOB_D, 0.04, 0.012, 0.02, sx * 0.036, 0.052, 0.064, 0, 0, sx * 0.25));
  const v = variant % 3;
  if (v === 0) {
    head.add(cyl(mat(PAL.crimson), 0.075, 0.07, 0.03, 0, 0.074, -0.005, 0.12, 0, 0, 8), ball(mat(PAL.crimson), 0.02, 0.012, 0.02, 0, 0.094, -0.005));
    head.add(aim(blade(WHITE, 0.022, 0.12, 0.006, -0.085, 0.03, -0.03), -0.25, 1, -0.5));      // a quill behind the ear
  } else if (v === 1) {
    head.add(cyl(mat(PAL.iron), 0.078, 0.082, 0.055, 0, 0.068, 0, 0, 0, 0, 8), box(mat(PAL.iron), 0.016, 0.012, 0.1, 0, 0.085, -0.12));  // a saucepan
  } else {
    for (const hx of [-0.03, 0, 0.03]) head.add(aim(spike(mat(PAL.hairDark), 0.014, 0.05, hx, 0.07, 0), hx * 4, 1, -0.3));
  }
  const eyes = bone(head, 0, 0.02, 0.064);
  for (const sx of [-1, 1]) eyes.add(ball(mat(PAL.parchment), 0.026, 0.027, 0.018, sx * 0.036, 0, 0), ball(INK, 0.012, 0.013, 0.01, sx * 0.034, -0.002, 0.012));
  const ears = bone(head);
  for (const sx of [-1, 1]) {
    ears.add(aim(blade(GOB, 0.075, 0.17, 0.014, sx * 0.07, 0.005, -0.005), sx * 1, 0.42, -0.12));
    ears.add(aim(blade(GOB_D, 0.04, 0.11, 0.016, sx * 0.08, 0.008, 0), sx * 1, 0.42, -0.12));
  }
  return { root, head, eyes, ears };
}

/** a music note about 0.12 tall, flat in XY */
export function note(m: THREE.Material, double = false): THREE.Group {
  const g = grp();
  g.add(ball(m, 0.026, 0.02, 0.012, 0, 0, 0, 0, 0, 0.4), box(m, 0.008, 0.1, 0.008, 0.022, 0.05, 0));
  if (double) g.add(ball(m, 0.026, 0.02, 0.012, 0.07, 0.012, 0, 0, 0, 0.4), box(m, 0.008, 0.1, 0.008, 0.092, 0.062, 0), box(m, 0.078, 0.016, 0.008, 0.057, 0.105, 0, 0, 0, 0.17));
  else g.add(box(m, 0.035, 0.014, 0.008, 0.038, 0.09, 0, 0, 0, -0.5));
  return g;
}

/** a wicker basket */
export function basket(): THREE.Group {
  const g = grp(), m = mat(mix(PAL.thatch, PAL.clothBrown, 0.5));
  g.add(cyl(m, 0.08, 0.06, 0.07, 0, 0.035, 0, 0, 0, 0, 8), cyl(mat(PAL.clothBrown), 0.085, 0.082, 0.014, 0, 0.07, 0, 0, 0, 0, 8));
  return g;
}

/** the Crown's device for banners and the tax cart: crimson field, gold crown. Null without a DOM. */
export function crownTexture(): THREE.Texture | null {
  return canvasTex('crown-banner', 96, 192, (c, w, h) => {
    c.fillStyle = '#9e2b25'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#e3b23c'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
    c.fillStyle = '#e3b23c';
    const cx = w / 2, cy = h * 0.42, s = 26;
    c.beginPath(); c.moveTo(cx - s, cy + s * 0.6); c.lineTo(cx - s, cy - s * 0.5); c.lineTo(cx - s * 0.5, cy); c.lineTo(cx, cy - s * 0.9);
    c.lineTo(cx + s * 0.5, cy); c.lineTo(cx + s, cy - s * 0.5); c.lineTo(cx + s, cy + s * 0.6); c.closePath(); c.fill();
    c.fillRect(cx - s, cy + s * 0.75, s * 2, s * 0.3);
    for (const dx of [-s, 0, s]) { c.beginPath(); c.arc(cx + dx, cy - (dx ? s * 0.62 : s * 1.02), 5, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#b0842a'; for (let y = h * 0.68; y < h - 20; y += 16) c.fillRect(22, y, w - 44, 4);
  });
}

/** a small gold crown built from pieces (where a texture will not do), about 0.1 wide, facing +z */
export function crownBadge(): THREE.Group {
  const g = grp(), G = mat(PAL.gold);
  g.add(box(G, 0.1, 0.022, 0.012, 0, 0, 0));
  for (const x of [-0.04, 0, 0.04]) g.add(spike(G, 0.016, x ? 0.04 : 0.055, x, 0.01, 0, 0, 0, 0, 4));
  return g;
}

/** a flat chalk-white rectangle helper for marks drawn on walls */
export function chalk(w: number, h: number, x: number, y: number, rz = 0): THREE.Mesh {
  return quad(mat(PAL.hairWhite), w, h, x, y, 0, 0, 0, rz);
}
