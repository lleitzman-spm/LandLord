/**
 * The carving: a Look becomes two baked meshes, the turned peg body and the
 * head (with hair, ears, beard and hat), plus an optional gilded crown.
 * Everything here is authored once per figure and never touched per frame.
 *
 * Head space: the head is a unit ball at the origin, face toward +z, crown at
 * y = 1. Faces are designed to be read from above (the game camera looks down
 * at 25 to 70 degrees), so hats sit pushed back and brims stay short.
 */
import * as THREE from 'three';
import { PAL } from '../palette';
import { Sculpt, blend, shade, type Ring } from './sculpt';
import { radiusAt, type Look, type HatId } from './look';
import { Rng, hash01 } from './util';

const PI = Math.PI;
const LEATHER = 0x8a5f38, LEATHER_DARK = 0x4a3222, IRON = 0x6f7378, IRON_DARK = 0x4a4d52, LINEN = 0xe9e0c8, ERMINE = 0xf4f0e6, BRASS = 0xb08a3c;

// ───────────────────────── body ─────────────────────────

const BODY_V = [0, 0.04, 0.09, 0.14, 0.25, 0.36, 0.44, 0.5, 0.6, 0.7, 0.8, 0.87, 0.93, 1];
const SEGS = 16;

export function cloakColor(L: Look): number {
  return L.extras.includes('ermine') || L.base ? L.apron : L.hat === 'deephood' ? 0x1c1c24 : L.outfit === 'armor' ? L.apron : shade(L.cloth, -0.42);
}

export function buildBody(L: Look): THREE.BufferGeometry {
  const s = new Sculpt();
  const H = L.bodyH, R = L.bodyR;
  const ex = (id: string) => L.extras.includes(id as never);
  const rings: Ring[] = [{ r: radiusAt(L, 0) * 0.9, y: 0 }, { r: radiusAt(L, 0.012), y: H * 0.014, crease: true }];
  for (let i = 1; i < BODY_V.length; i++) rings.push({ r: radiusAt(L, BODY_V[i]!), y: H * BODY_V[i]! });
  rings.push({ r: 0, y: H * 1.02 });

  const cloth = L.cloth, trim = L.trim, apron = L.apron;
  const belt = L.outfit === 'robe' || L.outfit === 'vestment' ? shade(trim, -0.1) : LEATHER_DARK;
  const second = cloth === PAL.clothOchre ? PAL.clothTeal : PAL.clothOchre;
  const patchC = shade(blend(cloth, 0x6a5a40, 0.5), -0.1);
  const lapel = shade(cloth, -0.28);
  const span = H * 1.02;
  const paint = (v0: number, a: number, i: number): number => {
    const v = v0 * span / H;                        // back to 0..1 over the body proper
    const aa = Math.abs(a);
    let c = cloth;
    switch (L.outfit) {
      case 'tunic':
        if (v < 0.09) c = trim; else if (v > 0.44 && v < 0.5) c = belt; else if (v > 0.93) c = shade(cloth, 0.2);
        if (ex('trim') && aa < 0.22 && v > 0.09) c = v > 0.44 && v < 0.5 ? BRASS : trim;
        break;
      case 'dress':
        if (v < 0.09) c = trim; else if (v < 0.47) c = aa < 0.62 ? LINEN : shade(cloth, -0.12); else if (v < 0.53) c = shade(trim, 0.05); else if (v > 0.93) c = LINEN;
        break;
      case 'apron':
        if (v < 0.09) c = shade(cloth, -0.25); else if (v > 0.93) c = shade(cloth, 0.2);
        if (v > 0.09 && v < 0.6 && aa < 0.98) c = apron; else if (v >= 0.6 && v < 0.86 && aa < 0.6) c = apron;
        else if (v > 0.44 && v < 0.5) c = shade(apron, -0.25);
        break;
      case 'robe':
        if (v < 0.09) c = trim; else if (aa < 0.22) c = trim; else if (v > 0.5 && v < 0.56) c = belt; else if (v > 0.93) c = trim;
        break;
      case 'coat':
        if (aa < 0.22) c = lapel; else if (v < 0.07) c = lapel; else if (v > 0.87) c = trim;
        break;
      case 'tabard': {
        const front = aa < 1.08, back = aa > PI - 1.08;
        if (v < 0.07) c = L.trim; else if (v > 0.93) c = L.trim;
        else if (front || back) c = ((a > 0) === (v > 0.5)) !== back ? apron : cloth; else c = v > 0.44 && v < 0.5 ? LEATHER_DARK : shade(L.trim, -0.15);
        break;
      }
      case 'motley': {
        const q = (a > 0) === (v > 0.47);
        c = q ? cloth : second;
        if (v < 0.07) c = q ? second : cloth; else if (v > 0.44 && v < 0.5) c = LEATHER_DARK; else if (v > 0.93) c = LINEN;
        break;
      }
      case 'armor': {
        const col = Math.floor((a + PI) / (PI * 2 / SEGS) + 0.5) % 2;
        if (v < 0.36) c = col ? shade(cloth, -0.16) : shade(cloth, -0.04); else if (v > 0.44 && v < 0.5) c = LEATHER_DARK; else if (v > 0.87) c = shade(cloth, -0.2); else c = shade(cloth, 0.12);
        if (v > 0.5 && v < 0.87 && aa < 0.62) c = apron;
        break;
      }
      case 'vestment':
        if (v < 0.09) c = trim; else if (aa > 0.22 && aa < 0.62 && v > 0.12) c = v < 0.2 ? trim : apron; else if (v > 0.93) c = trim;
        break;
    }
    if (ex('patches') && v > 0.1 && v < 0.85 && hash01(L.seed * 31 + i * 17 + Math.round(a * 5)) < 0.075) c = patchC;
    if (ex('soot') && v < 0.3 && hash01(L.seed * 13 + i * 7 + Math.round(a * 4)) < 0.3) c = blend(c, PAL.soot, 0.45);
    return c;
  };
  s.lathe(rings, SEGS, paint, true, 0, 0, 0, -PI, PI, L.outfit === 'motley' || L.outfit === 'tabard' ? 0 : 0.5);

  const rv = (v: number) => radiusAt(L, v);
  // belt buckle
  if (L.outfit === 'tunic' || L.outfit === 'motley') s.box(R * 0.2, H * 0.07, R * 0.06, BRASS, 0, H * 0.47, rv(0.47) * 0.99);
  if (ex('buttons')) for (const v of [0.56, 0.68, 0.8]) s.ball(R * 0.085, L.trim === 0x16141a || L.cloth < 0x404040 ? BRASS : shade(L.cloth, -0.45), 0, H * v, rv(v) * 1.0, 1, 1, 0.6, true, 0);
  if (ex('collar')) s.cyl(rv(0.96) * 1.12, rv(0.9) * 1.36, H * 0.065, LINEN, 0, H * 0.885, 0, 0, 0, 0, 10);
  if (ex('cowl')) s.cyl(rv(0.97) * 1.08, rv(0.78) * 1.24, H * 0.2, L.hatColor, 0, H * 0.77, 0, 0, 0, 0, 10);
  if (ex('shawl')) {
    const c = blend(L.cloth, 0xf0e2c4, 0.5);
    s.cyl(rv(0.97) * 1.1, rv(0.74) * 1.2, H * 0.22, c, 0, H * 0.73, 0, 0, 0, 0, 9);
    s.cone(rv(0.7) * 0.75, H * 0.22, c, 0, H * 0.75, -rv(0.7) * 0.72, PI - 0.25, 0, 0, 4, 0.5);
    s.ball(R * 0.1, shade(c, -0.25), 0, H * 0.8, rv(0.8) * 1.2, 1, 1, 0.7, true, 0);
  }
  if (ex('cloak')) {
    const cc = cloakColor(L), erm = ex('ermine');
    const top = 0.9, cr: Ring[] = [];
    const cv = [0.05, 0.11, 0.3, 0.55, 0.78, top];
    for (const v of cv) cr.push({ r: rv(v) * (1.1 + (top - v) * 0.2) + R * 0.035, y: H * v });
    s.lathe(cr, 12, (v, a) => (erm && v < 0.14) ? (hash01(Math.round(a * 9) + 3) < 0.3 ? 0x2a2623 : ERMINE) : (Math.abs(a) < 0.95 && erm ? ERMINE : cc), true, 0, 0, 0, 0.78, PI * 2 - 0.78);
    // inside of the cloak, so it does not vanish seen from the front
    const ci: Ring[] = cr.map(q => ({ r: q.r - R * 0.012, y: q.y })).reverse();
    s.lathe(ci, 12, shade(cc, -0.3), true, 0, 0, 0, 0.78, PI * 2 - 0.78);
    s.ball(R * 0.11, PAL.gold, 0, H * 0.9, rv(0.9) * 1.08, 1, 1, 0.7, true, 0);
  }
  if (ex('ermine')) {
    s.cyl(rv(0.98) * 1.15, rv(0.78) * 1.33, H * 0.19, ERMINE, 0, H * 0.77, 0, 0, 0, 0, 12, false);
    for (let k = 0; k < 7; k++) { const a = (k + 0.5) / 7 * PI * 2, rr = rv(0.84) * 1.3; s.ball(R * 0.055, 0x2a2623, Math.sin(a) * rr, H * (0.82 + (k % 2) * 0.05), Math.cos(a) * rr, 1, 1.5, 1, true, 0); }
  }
  if (ex('chain')) {
    const rr = rv(0.86) * 1.12 + (ex('ermine') ? R * 0.16 : 0);
    s.torus(rr, R * 0.035, PAL.gold, 0, H * 0.8, rr * 0.2, 0.42, 0, 0, 4, 12);
    s.ball(R * 0.1, L.base ? PAL.crimson : PAL.gold, 0, H * 0.7, rr * 1.16, 1, 1, 0.6, true, 0);
  }
  if (ex('satchel')) {
    const x = rv(0.4) * 0.92;
    s.box(R * 0.2, H * 0.2, R * 0.42, LEATHER, x, H * 0.4, R * 0.05, 0, 0, -0.12);
    s.box(R * 0.22, H * 0.08, R * 0.44, LEATHER_DARK, x, H * 0.48, R * 0.05, 0, 0, -0.12);
  }
  if (ex('towel')) s.box(R * 0.28, H * 0.3, R * 0.12, 0xf0ead8, -rv(0.86) * 0.82, H * 0.82, R * 0.12, 0.2, 0, 0.35);
  if (ex('quiver')) {
    s.cyl(R * 0.2, R * 0.16, H * 0.6, LEATHER, R * 0.3, H * 0.42, -rv(0.6) * 0.95, -0.2, 0, -0.45, 6);
    for (let k = 0; k < 3; k++) s.cone(R * 0.07, H * 0.14, k === 1 ? PAL.clothRed : PAL.clothCream, R * 0.3 - H * 0.6 * Math.sin(-0.45) * 0.98 + (k - 1) * R * 0.1, H * 0.42 + H * 0.56, -rv(0.6) * 0.95 - 0.02 - k * 0.004, -0.2, 0, -0.45, 4);
  }
  if (ex('pack')) {
    s.box(R * 1.0, H * 0.4, R * 0.5, LEATHER, 0, H * 0.58, -rv(0.6) * 1.05, 0.12, 0, 0);
    s.cyl(R * 0.2, R * 0.2, R * 1.2, shade(L.cloth, 0.15), -R * 0.6, H * 0.84, -rv(0.7) * 1.0, 0, 0, -PI / 2, 7);
  }
  if (L.feet) {
    for (const sx of [-1, 1]) {
      const fx = sx * R * 0.44, fz = R * 0.8;
      s.ball(R * 0.36, L.skin, fx, R * 0.16, fz, 1, 0.5, 1.5, false, 1);
      for (let k = -1; k <= 1; k++) s.ball(R * 0.11, L.skin, fx + k * R * 0.2, R * 0.13, fz + R * 0.5 - Math.abs(k) * R * 0.06, 1, 0.9, 1, false, 0);
      s.ball(R * 0.14, L.hair, fx, R * 0.33, fz - R * 0.05, 1.2, 0.5, 1.2, true, 0);
    }
  }
  return s.build();
}

// ───────────────────────── head ─────────────────────────

/** a skull-cap shape pushed back on the head: T = how far down it comes, tilt = how far back */
function skull(s: Sculpt, r: number, c: number, T: number, tilt: number, sx = 1, sy = 1, sz = 1, flat = true): void {
  s.cap(r, c, 0, T, 0, PI * 2, 0, 0, 0, tilt, 0, 0, sx, sy, sz, flat, 12, 5);
}

function buildHair(s: Sculpt, L: Look, r: Rng, hatted: boolean): void {
  const h = L.hair, hd = shade(h, -0.14);
  const style = L.hairStyle;
  const base = () => skull(s, 1.05, h, 0.47 * PI, -0.52);
  switch (style) {
    case 'bald': break;
    case 'short': base(); break;
    case 'bowl': skull(s, 1.075, h, 0.46 * PI, -0.42); break;
    case 'long':
      base();
      s.ball(0.92, hd, 0, -0.55, -0.52, 1.02, 1.25, 0.6, true, 1);
      break;
    case 'bun':
      base();
      if (!hatted) s.ball(0.36, hd, 0, 0.82, -0.66, 1, 0.9, 1, true, 1);
      else s.ball(0.3, hd, 0, -0.1, -1.02, 1, 0.9, 1, true, 1);
      break;
    case 'braids':
      base();
      for (const sx of [-1, 1]) {
        for (let k = 0; k < 3; k++) s.ball(0.17 - k * 0.015, k % 2 ? h : hd, sx * (0.9 - k * 0.03), -0.42 - k * 0.3, 0.12, 1, 1.15, 1, true, 0);
        s.ball(0.09, PAL.clothRed, sx * 0.82, -1.32, 0.12, 1, 1, 1, true, 0);
      }
      break;
    case 'curly': {
      // a mop of whittled curls over the crown and down the back
      const dirs: [number, number, number][] = [[0, 1, -0.1], [0.55, 0.8, 0.15], [-0.55, 0.8, 0.15], [0.85, 0.42, -0.1], [-0.85, 0.42, -0.1], [0.5, 0.6, -0.7], [-0.5, 0.6, -0.7],
        [0, 0.55, -0.85], [0.75, 0.0, -0.62], [-0.75, 0.0, -0.62], [0, 0.0, -0.98], [0.3, 0.86, 0.42], [-0.3, 0.86, 0.42], [0.95, 0.05, -0.05], [-0.95, 0.05, -0.05]];
      for (let i = 0; i < dirs.length; i++) {
        const d = dirs[i]!; const l = Math.hypot(d[0], d[1], d[2]);
        if (hatted && d[1] > 0.5) continue;
        s.ball(r.range(0.27, 0.36), i % 3 ? h : hd, d[0] / l * 0.92 + r.range(-0.05, 0.05), d[1] / l * 0.92, d[2] / l * 0.92, 1, 1, 1, true, 0, r.next() * 3, r.next() * 3, 0);
      }
      break;
    }
    case 'tonsure':
      s.torus(0.86, 0.25, h, 0, 0.3, -0.12, -0.3, 0, 0, 5, 12);
      break;
    case 'tufts':
      if (!hatted) for (let k = -1; k <= 1; k++) s.cone(0.13, 0.5 - Math.abs(k) * 0.14, h, k * 0.2, 0.9, -0.12, -0.25, 0, -k * 0.45, 4);
      break;
    case 'ponytail':
      base();
      s.ball(0.2, hd, 0, 0.25, -1.06, 1, 1, 1, true, 0);
      s.cone(0.2, 0.95, h, 0, 0.2, -1.1, PI - 0.25, 0, 0, 5);
      break;
    case 'sleek':
      skull(s, 1.05, h, 0.44 * PI, -0.5);
      s.ball(0.9, h, 0, -0.75, -0.5, 1.0, 1.7, 0.5, true, 1);
      for (const sx of [-1, 1]) s.ball(0.2, hd, sx * 0.84, -0.55, 0.3, 0.8, 2.6, 0.9, true, 0);
      break;
    case 'topknot':
      if (!hatted) { s.ball(0.2, h, 0, 1.08, -0.1, 1, 1.2, 1, true, 0); s.cyl(0.11, 0.13, 0.12, PAL.clothRed, 0, 0.92, -0.1, 0, 0, 0, 6); }
      break;
    case 'balding':
      // a horseshoe of hair round the back
      s.cap(1.05, h, 0.3 * PI, 0.32 * PI, PI - 0.5, PI + 1.0, 0, 0, 0, -0.1, 0, 0, 1, 1, 1, true, 8, 3);
      break;
  }
}

function buildBeard(s: Sculpt, L: Look): void {
  const h = L.hair, hd = shade(h, -0.16);
  const tash = (w = 0.24, lift = 0) => { for (const sx of [-1, 1]) s.ball(0.2, h, sx * w, L.face.mouthY + 0.13, 0.9, 1.35, 0.62, 0.7, true, 0, 0, 0, sx * (0.25 + lift)); };
  const my = L.face.mouthY;
  switch (L.beard) {
    case 'none': return;
    case 'moustache': tash(0.22); return;
    case 'curled':
      for (const sx of [-1, 1]) { s.ball(0.14, h, sx * 0.17, my + 0.12, 0.93, 1.3, 0.6, 0.6, true, 0); s.cone(0.07, 0.34, h, sx * 0.3, my + 0.1, 0.9, 0, 0, -sx * 1.05, 4); }
      s.cone(0.14, 0.4, h, 0, my - 0.2, 0.78, PI - 0.5, 0, 0, 5);
      return;
    case 'goatee':
      tash(0.2);
      s.cone(0.2, 0.5, h, 0, my - 0.16, 0.78, PI - 0.45, 0, 0, 5);
      return;
    case 'full':
      tash();
      s.ball(0.72, h, 0, my - 0.52, 0.34, 1.12, 0.92, 0.82, true, 1);
      s.ball(0.3, hd, 0, my - 0.98, 0.52, 1.1, 1, 0.8, true, 0);
      return;
    case 'long':
      tash(0.26);
      s.ball(0.62, h, 0, my - 0.42, 0.42, 1.15, 0.8, 0.8, true, 1);
      s.cone(0.52, 1.5, h, 0, my - 0.4, 0.5, PI - 0.16, 0, 0, 6, 0.6);
      return;
    case 'forked':
      tash(0.26);
      s.ball(0.6, h, 0, my - 0.42, 0.42, 1.15, 0.8, 0.8, true, 1);
      for (const sx of [-1, 1]) s.cone(0.3, 1.05, sx > 0 ? h : hd, sx * 0.26, my - 0.5, 0.52, PI - 0.18, 0, sx * 0.22, 5, 0.7);
      return;
    case 'braided':
      tash(0.28, 0.2);
      s.ball(0.66, h, 0, my - 0.44, 0.4, 1.15, 0.85, 0.8, true, 1);
      for (const sx of [-1, 1]) {
        for (let k = 0; k < 3; k++) s.ball(0.17 - k * 0.02, k % 2 ? hd : h, sx * 0.3, my - 0.9 - k * 0.26, 0.6 - k * 0.02, 1, 1.1, 1, true, 0);
        s.cyl(0.1, 0.1, 0.1, PAL.gold, sx * 0.3, my - 1.72, 0.56, 0, 0, 0, 6);
      }
      return;
  }
}

function feather(s: Sculpt, c: number, x: number, y: number, z: number, len: number, rx: number, rz: number): void {
  s.cone(0.11, len, c, x, y, z, rx, 0, rz, 4, 0.35);
  s.cone(0.03, len * 0.7, shade(c, -0.3), x, y, z, rx, 0, rz, 3, 0.5);
}

function buildHat(s: Sculpt, hat: HatId, L: Look, r: Rng): void {
  const c1 = L.hatColor, c2 = L.hatColor2;
  switch (hat) {
    case 'none': case 'circlet': case 'coronet': case 'crown': case 'crown_great': return;
    case 'straw':
      s.pushFrame(0, 0, 0, -0.27, 0, r.range(-0.08, 0.08));
      s.cyl(1.32, 1.4, 0.07, shade(c1, -0.1), 0, 0.5, 0, 0, 0, 0, 11);
      s.cyl(0.6, 0.8, 0.46, c1, 0, 0.55, 0, 0, 0, 0, 9);
      s.cyl(0.82, 0.82, 0.1, c2, 0, 0.57, 0, 0, 0, 0, 9);
      if (c2 === 0x7a9a5a) { s.ball(0.13, 0xe8c84a, 0.62, 0.72, 0.5, 1, 1, 1, true, 0); s.ball(0.1, 0xf4efe2, 0.74, 0.68, 0.34, 1, 1, 1, true, 0); }
      s.popFrame();
      return;
    case 'hood':
      skull(s, 1.13, c1, 0.5 * PI, -0.62);
      s.cap(1.14, c1, 0.42 * PI, 0.36 * PI, PI - 0.9, PI + 1.8, 0, 0, 0, 0, 0, 0, 1, 1, 1, true, 8, 3);
      s.cone(0.3, 0.8, shade(c1, -0.1), 0, 0.55, -0.92, -2.2, 0, 0, 5);
      if (c2 !== PAL.clothRed || L.hatColor === 0x3f5a3a) feather(s, c2, 0.72, 0.62, 0.1, 0.8, -0.5, -0.35);
      return;
    case 'deephood':
      // the face is all shadow and two pale glints
      s.cap(1.2, c1, 0, 0.78 * PI, PI * 0.5 + 0.72, PI * 2 - 1.44, 0, 0.02, -0.02, 0, 0, 0, 1, 1.02, 1.05, true, 10, 6);
      s.torus(0.9, 0.2, shade(c1, 0.08), 0, 0.1, 0.52, PI / 2 - 0.16, 0, 0, 5, 12);
      s.cone(0.3, 0.75, c1, 0, 0.72, -0.95, -2.0, 0, 0, 5);
      return;
    case 'coif':
      skull(s, 1.065, c1, 0.5 * PI, -0.58);
      for (const sx of [-1, 1]) s.box(0.08, 0.5, 0.3, c1, sx * 1.0, -0.2, -0.12);
      return;
    case 'toque':
      s.pushFrame(0, 0, 0, -0.2, 0, 0.06);
      s.cyl(0.78, 0.8, 0.34, c1, 0, 0.55, 0, 0, 0, 0, 10);
      s.ball(0.98, c1, 0, 1.18, 0, 1, 0.56, 1, true, 1);
      s.popFrame();
      return;
    case 'floppy':
      skull(s, 1.1, c1, 0.4 * PI, -0.4);
      s.ball(0.56, c1, 0.7, 0.62, -0.25, 1.1, 0.7, 1, true, 1, 0, 0, -0.5);
      s.ball(0.3, shade(c1, -0.1), 1.12, 0.3, -0.3, 1, 1, 1, true, 0);
      return;
    case 'beret':
      s.pushFrame(0, 0, 0, -0.3, 0, 0.3);
      s.cyl(0.84, 0.86, 0.16, shade(c1, -0.15), 0, 0.56, 0, 0, 0, 0, 10);
      s.ball(1.12, c1, 0, 0.82, 0, 1, 0.3, 1, true, 1);
      s.ball(0.12, c2, 0.0, 1.14, 0, 1, 1, 1, true, 0);
      feather(s, 0xf0ead8, -0.8, 0.75, 0.1, 1.0, -0.5, 0.55);
      s.popFrame();
      return;
    case 'leathercap':
      skull(s, 1.085, c1, 0.46 * PI, -0.46);
      for (const sx of [-1, 1]) s.box(0.1, 0.52, 0.44, shade(c1, -0.12), sx * 1.02, -0.12, -0.08, 0, 0, sx * 0.08);
      s.ball(0.1, shade(c1, -0.3), 0, 1.05, -0.3, 1, 1, 1, true, 0);
      return;
    case 'bandana':
      skull(s, 1.07, c1, 0.42 * PI, -0.44);
      for (const sx of [-1, 1]) s.cone(0.16, 0.5, shade(c1, -0.12), sx * 0.12, 0.05, -1.02, -2.2, 0, sx * 0.5, 4, 0.5);
      s.ball(0.14, c1, 0, 0.12, -1.06, 1, 1, 1, true, 0);
      if (c2 === PAL.gold) for (let k = -2; k <= 2; k++) s.ball(0.07, PAL.gold, Math.sin(k * 0.34) * 1.0, 0.56 - Math.abs(k) * 0.04, Math.cos(k * 0.34) * 1.0 - 0.02, 1, 1, 0.5, true, 0);
      return;
    case 'kerchief':
      skull(s, 1.1, c1, 0.5 * PI, -0.6);
      s.cap(1.1, c1, 0.42 * PI, 0.3 * PI, PI - 0.7, PI + 1.4, 0, 0, 0, 0, 0, 0, 1, 1, 1, true, 8, 2);
      s.cone(0.34, 0.6, shade(c1, -0.08), 0, -0.1, -0.98, PI - 0.1, 0, 0, 4, 0.5);
      s.ball(0.1, shade(c1, -0.15), 0, -0.86, 0.5, 1.4, 1, 1, true, 0);
      return;
    case 'feathercap':
      s.pushFrame(0, 0, 0, -0.3, 0, 0.12);
      s.cone(0.98, 0.95, c1, 0, 0.5, -0.1, -0.25, 0, 0, 7, 1.1);
      s.cone(0.52, 0.95, c1, 0, 0.54, 0.4, PI / 2 - 0.12, 0, 0, 5, 0.42);
      s.cyl(1.0, 1.04, 0.12, shade(c1, -0.2), 0, 0.5, -0.1, 0, 0, 0, 7);
      feather(s, c2, 0.75, 0.66, -0.1, 1.5, -0.75, -0.2);
      s.popFrame();
      return;
    case 'wizard': {
      const lean = r.range(-0.2, 0.2);
      s.pushFrame(0, 0, 0, -0.3, 0, lean * 0.5);
      s.cyl(1.26, 1.34, 0.07, c1, 0, 0.5, 0, 0, 0, 0, 11);
      s.cone(0.84, 1.25, c1, 0, 0.55, 0, 0, 0, 0, 8);
      s.cyl(0.86, 0.86, 0.12, c2, 0, 0.56, 0, 0, 0, 0, 8);
      // the crooked top third
      s.cone(0.3, 0.95, c1, 0, 1.36, 0, -0.5, 0, 0.5 + lean, 6);
      for (let k = 0; k < 3; k++) { const a = 0.6 + k * 2.1; s.ball(0.07, c2, Math.sin(a) * (0.62 - k * 0.12), 0.85 + k * 0.22, Math.cos(a) * (0.62 - k * 0.12), 1, 1, 1, true, 0); }
      s.popFrame();
      return;
    }
    case 'skullcap':
      skull(s, 1.06, c1, 0.33 * PI, -0.5);
      return;
    case 'flatcap':
      s.pushFrame(0, 0, 0, -0.34, 0, 0.14);
      s.cyl(0.86, 0.88, 0.16, shade(c1, -0.18), 0, 0.56, 0, 0, 0, 0, 10);
      s.ball(1.14, c1, 0, 0.82, 0, 1, 0.27, 1, true, 1);
      if (c2 === PAL.gold) s.ball(0.11, PAL.gold, 0.5, 0.74, 0.74, 1, 1, 0.6, true, 0);
      s.popFrame();
      return;
    case 'kettle':
      s.pushFrame(0, 0, 0, -0.28, 0, 0);
      s.cap(1.02, c1, 0, 0.4 * PI, 0, PI * 2, 0, 0.1, 0, 0, 0, 0, 1, 1, 1, true, 10, 4);
      s.cyl(1.0, 1.34, 0.2, shade(c1, -0.12), 0, 0.38, 0, 0, 0, 0, 11);
      s.ball(0.09, shade(c1, 0.25), 0, 1.12, 0, 1, 1, 1, true, 0);
      s.popFrame();
      return;
    case 'helm':
      skull(s, 1.1, c1, 0.44 * PI, -0.42);
      s.cap(1.1, shade(c1, -0.1), 0.34 * PI, 0.42 * PI, PI - 0.85, PI + 1.7, 0, 0, 0, 0, 0, 0, 1, 1, 1, true, 8, 3);
      s.box(0.1, 0.6, 0.1, shade(c1, 0.15), 0, 0.42, 1.02, -0.25);
      for (let k = 0; k < 4; k++) s.ball(0.26 - k * 0.03, c2, 0, 1.12 - k * 0.14, -0.2 - k * 0.3, 0.6, 1, 1, true, 0);
      return;
    case 'veil':
      s.pushFrame(0, 0, 0, -0.26, 0, 0);
      s.cyl(1.3, 1.38, 0.07, shade(c1, -0.1), 0, 0.5, 0, 0, 0, 0, 11);
      s.cyl(0.62, 0.8, 0.44, c1, 0, 0.55, 0, 0, 0, 0, 9);
      s.popFrame();
      // the net, thrown back
      s.cap(1.34, c2, 0.36 * PI, 0.5 * PI, PI - 1.15, PI + 2.3, 0, 0.02, -0.06, 0, 0, 0, 1, 1, 1, true, 10, 3);
      return;
    case 'tallhat':
      s.pushFrame(0, 0, 0, -0.24, 0, 0.05);
      s.cyl(1.22, 1.3, 0.07, c1, 0, 0.5, 0, 0, 0, 0, 11);
      s.cyl(0.6, 0.8, 1.12, c1, 0, 0.55, 0, 0, 0, 0, 9);
      s.cyl(0.82, 0.83, 0.16, c2, 0, 0.58, 0, 0, 0, 0, 9);
      s.box(0.22, 0.2, 0.08, BRASS, 0, 0.66, 0.8);
      s.popFrame();
      return;
    case 'mitre':
      s.pushFrame(0, 0, 0, -0.2, 0, 0);
      s.cyl(0.84, 0.86, 0.2, c2, 0, 0.52, 0, 0, 0, 0, 10);
      s.cone(0.84, 1.35, c1, 0, 0.7, 0.22, 0.06, PI / 4, 0, 4, 1);
      s.cone(0.84, 1.35, c1, 0, 0.7, -0.22, -0.06, PI / 4, 0, 4, 1);
      s.box(0.12, 0.9, 0.06, c2, 0, 1.12, 0.6, 0.38);
      s.box(0.42, 0.11, 0.06, c2, 0, 1.2, 0.56, 0.38);
      s.popFrame();
      return;
    case 'wig':
      skull(s, 1.1, c1, 0.46 * PI, -0.5);
      for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) s.cyl(0.24, 0.24, 0.36, k % 2 ? shade(c1, -0.07) : c1, sx * 0.98, 0.18 - k * 0.42, -0.22 + 0.18, PI / 2, 0, 0, 7);
      for (let k = 0; k < 3; k++) s.cyl(0.22, 0.22, 1.3, k % 2 ? c1 : shade(c1, -0.07), -0.65, -0.3 - k * 0.36, -0.9, 0, 0, -PI / 2, 7);
      return;
    case 'plumed':
      s.pushFrame(0, 0, 0, -0.3, 0, 0.22);
      s.cyl(1.34, 1.4, 0.08, c1, 0, 0.5, 0, 0, 0, 0, 11);
      s.ball(0.82, c1, 0, 0.62, 0, 1, 0.55, 1, true, 1);
      s.cyl(0.84, 0.84, 0.1, PAL.gold, 0, 0.56, 0, 0, 0, 0, 9);
      for (let k = 0; k < 4; k++) s.ball(0.32 - k * 0.04, k % 2 ? shade(c2, -0.08) : c2, -0.5 - k * 0.12, 0.95 + k * 0.2 - k * k * 0.03, -0.1 - k * 0.36, 1, 1, 1.2, true, 0);
      s.popFrame();
      return;
    case 'pot':
      // an upturned cooking pot, worn with total conviction
      s.pushFrame(0, 0, 0, -0.26, 0, -0.1);
      s.cyl(0.98, 1.1, 0.86, c1, 0, 0.42, 0, 0, 0, 0, 10);
      s.cyl(1.16, 1.16, 0.09, shade(c1, -0.2), 0, 0.42, 0, 0, 0, 0, 10);
      s.torus(0.26, 0.06, shade(c1, -0.25), 1.1, 0.95, 0, 0, 0, PI / 2, 4, 8);
      s.ball(0.2, c2, 0, 0.9, 1.04, 1, 1, 0.4, true, 0);
      feather(s, 0xf0ead8, -0.5, 1.2, -0.2, 1.1, -0.3, 0.3);
      s.popFrame();
      return;
    case 'bowler':
      s.pushFrame(0, 0, 0, -0.2, 0, 0);
      s.cyl(1.2, 1.26, 0.08, c1, 0, 0.5, 0, 0, 0, 0, 10);
      s.cap(0.86, c1, 0, 0.5 * PI, 0, PI * 2, 0, 0.56, 0, 0, 0, 0, 1, 0.95, 1, true, 9, 4);
      s.cyl(0.88, 0.88, 0.13, c2, 0, 0.57, 0, 0, 0, 0, 9);
      s.popFrame();
      return;
    case 'bonnet':
      skull(s, 1.12, c1, 0.56 * PI, -0.75);
      s.torus(1.06, 0.14, shade(c1, 0.06), 0, 0.2, 0.05, PI / 2 - 0.5, 0, 0, 4, 12, PI * 1.0, true);
      s.ball(0.15, c2, 0.75, 0.86, 0.2, 1, 1, 1, true, 0);
      s.ball(0.1, 0xe8c84a, 0.62, 0.96, 0.3, 1, 1, 1, true, 0);
      s.ball(0.1, shade(c1, -0.2), 0, -0.9, 0.42, 1.6, 0.8, 1, true, 0);
      return;
    case 'singed':
      s.pushFrame(0, 0, 0, -0.32, 0, -0.14);
      s.cyl(1.2, 1.28, 0.07, c1, 0, 0.5, 0, 0, 0, 0, 10);
      s.cyl(0.66, 0.8, 0.4, c1, 0, 0.55, 0, 0, 0, 0, 8);
      // the top has been on fire and nobody has mentioned it
      s.cyl(0.5, 0.68, 0.12, c2, 0, 0.93, 0, 0, 0, 0, 7);
      for (let k = 0; k < 4; k++) { const a = k * 1.7 + 0.4; s.cone(0.12, 0.2 + (k % 2) * 0.12, c2, Math.sin(a) * 0.5, 0.98, Math.cos(a) * 0.5, 0, 0, 0, 4); }
      s.popFrame();
      return;
  }
}

/** a rival's coronet sits at a rakish angle; the ruler's sits straight */
function crownTilt(L: Look): number { return L.hat === 'coronet' && !L.base ? 0.22 : 0; }

/** the crown, carved apart so it can be gold leaf */
export function buildCrown(L: Look): THREE.BufferGeometry | null {
  if (!L.gilded) return null;
  const s = new Sculpt();
  s.pushFrame(0, 0, 0, -0.24, 0, crownTilt(L));
  const Rb = 0.93;
  switch (L.hat) {
    case 'circlet':
      s.torus(Rb, 0.075, PAL.gold, 0, 0.5, 0, 0, 0, 0, 5, 14, PI * 2, false);
      s.cone(0.12, 0.24, PAL.gold, 0, 0.52, Rb, 0, 0, 0, 4);
      break;
    case 'coronet':
      s.cyl(Rb, Rb + 0.02, 0.22, PAL.gold, 0, 0.46, 0, 0, 0, 0, 12, false);
      for (let k = 0; k < 6; k++) { const a = k / 6 * PI * 2; s.cone(0.14, 0.3, PAL.gold, Math.sin(a) * Rb * 0.94, 0.66, Math.cos(a) * Rb * 0.94, 0, 0, 0, 4); }
      break;
    case 'crown':
      s.cyl(Rb + 0.02, Rb + 0.04, 0.3, PAL.gold, 0, 0.44, 0, 0, 0, 0, 12, false);
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * PI * 2, x = Math.sin(a) * Rb * 0.96, z = Math.cos(a) * Rb * 0.96;
        s.cone(0.15, k % 2 ? 0.34 : 0.5, PAL.gold, x, 0.72, z, 0, 0, 0, 4);
        if (k % 2 === 0) s.ball(0.085, PAL.gold, x, 1.24, z, 1, 1, 1, false, 0);
      }
      break;
    case 'crown_great':
      s.cyl(Rb + 0.03, Rb + 0.05, 0.32, PAL.gold, 0, 0.44, 0, 0, 0, 0, 12, false);
      for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2; s.cone(0.15, 0.34, PAL.gold, Math.sin(a) * Rb * 0.97, 0.74, Math.cos(a) * Rb * 0.97, 0, 0, 0, 4); }
      for (let k = 0; k < 2; k++) s.torus(Rb * 0.92, 0.07, PAL.gold, 0, 0.74, 0, 0, k * PI / 2, PI / 2, 4, 10, PI, false);
      s.ball(0.17, PAL.gold, 0, 1.72, 0, 1, 1, 1, false, 1);
      s.box(0.07, 0.3, 0.07, PAL.gold, 0, 1.98, 0); s.box(0.22, 0.07, 0.07, PAL.gold, 0, 2.0, 0);
      break;
    default: break;
  }
  s.popFrame();
  return s.build();
}

export function buildHead(L: Look): THREE.BufferGeometry {
  const s = new Sculpt();
  const r = new Rng(Math.imul(L.seed, 7919) + 13);
  const sk = L.skin, ex = (id: string) => L.extras.includes(id as never);
  const hooded = L.hat === 'deephood';
  s.ball(1, hooded ? 0x16131a : sk, 0, 0, 0, 1, 1, 1, false, 2);

  // nose
  const n = L.nose;
  if (!hooded) switch (L.species) {
    case 'human': s.ball(0.105 * n, L.skinDark, 0, -0.06, 0.98, 1, 1, 1, false, 1); break;
    case 'halfling': s.ball(0.115 * n, L.skinDark, 0, -0.07, 0.98, 1, 0.95, 1, false, 1); break;
    case 'dwarf': s.ball(0.2 * n, L.skinDark, 0, 0.0, 0.97, 1.05, 1, 1, false, 1); break;
    case 'goblin': s.cone(0.13, 0.5 * n, sk, 0, 0.0, 0.9, PI / 2 - 0.12, 0, 0, 5, 1, true); break;
    case 'elf': s.ball(0.065, L.skinDark, 0, -0.07, 0.99, 1, 1.3, 1, false, 0); break;
    case 'ogre': s.ball(0.19 * n, L.skinDark, 0, 0.02, 0.96, 1.3, 0.8, 0.9, false, 1); break;
  }
  // ears
  if (!hooded) for (const sx of [-1, 1]) {
    switch (L.species) {
      case 'human': case 'dwarf': case 'halfling': s.ball(0.17, L.skinDark, sx * 0.97, 0.0, -0.02, 0.6, 1, 0.9, false, 1); break;
      case 'elf':
        s.cone(0.16, 0.62, sk, sx * 0.9, -0.08, -0.05, -0.25, 0, -sx * 0.82, 4, 0.45);
        break;
      case 'goblin':
        // the ears do most of the talking
        s.cone(0.36, 1.12, sk, sx * 0.84, -0.16, -0.06, -0.12, 0, -sx * 1.18, 4, 0.3);
        s.cone(0.22, 0.8, L.skinDark, sx * 0.9, -0.12, 0.02, -0.12, 0, -sx * 1.18, 4, 0.2);
        break;
      case 'ogre': s.ball(0.2, L.skinDark, sx * 0.98, 0.08, -0.05, 0.6, 1, 0.9, false, 1); break;
    }
  }
  if (ex('tusks')) for (const sx of [-1, 1]) s.cone(0.065, 0.2, 0xf4efe2, sx * 0.27, L.face.mouthY - 0.07, 0.93, -0.12, 0, 0, 4);
  if (ex('earrings')) for (const sx of [-1, 1]) s.torus(0.12, 0.03, PAL.gold, sx * 1.02, -0.3, 0, 0, 0, PI / 2, 4, 8);
  if (ex('specs')) {
    const f = L.face, y = f.eyeY, z = Math.sqrt(1 - f.eyeX * f.eyeX - y * y) + 0.07;
    for (const sx of [-1, 1]) s.torus(0.2, 0.028, 0x2a2623, sx * f.eyeX, y, z, PI / 2, 0, 0, 4, 10);
    s.box(f.eyeX * 2 - 0.36, 0.035, 0.03, 0x2a2623, 0, y + 0.02, z + 0.03);
  }
  if (ex('goggles')) {
    for (const sx of [-1, 1]) { s.cyl(0.19, 0.21, 0.14, BRASS, sx * 0.3, 0.66, 0.66, 0.95, 0, 0, 7); s.cyl(0.13, 0.13, 0.03, 0x8ab8c8, sx * 0.3, 0.76, 0.78, 0.95, 0, 0, 7); }
    s.torus(1.03, 0.045, LEATHER_DARK, 0, 0.56, 0, -0.42, 0, 0, 4, 12);
  }

  const hatted = L.hat !== 'none' && !L.tinyHat;
  if (!hooded) { buildHair(s, L, r, hatted); buildBeard(s, L); }
  if (L.tinyHat && L.hat !== 'none' && !L.gilded) {
    // any hat on an ogre is a tiny hat
    s.pushFrame(0.16, 0.74, -0.04, 0, 0, -0.14, 0.46);
    buildHat(s, L.hat, L, r);
    s.popFrame();
  } else buildHat(s, L.hat, L, r);
  // a crown wants a velvet cap under it, and stones in it
  if (L.hat === 'crown' || L.hat === 'crown_great') skull(s, 0.96, PAL.crimson, 0.36 * PI, -0.24, 1, L.hat === 'crown_great' ? 1.5 : 1.12, 1);
  if (L.gilded) {
    s.pushFrame(0, 0, 0, -0.24, 0, crownTilt(L));
    const n = L.hat === 'circlet' ? 1 : 4, y = L.hat === 'circlet' ? 0.5 : 0.58;
    for (let k = 0; k < n; k++) { const a = k / n * PI * 2; s.ball(0.095, k % 2 ? PAL.lapis : PAL.crimson, Math.sin(a) * 0.99, y, Math.cos(a) * 0.99, 1, 1, 0.7, true, 0, 0, a, 0); }
    s.popFrame();
  }
  void IRON; void IRON_DARK; void LEATHER;
  return s.build();
}
