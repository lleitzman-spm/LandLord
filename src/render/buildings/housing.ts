/**
 * The eight dwellings. Each builder returns the pristine body in local space
 * (footprint centred, door on +z); the wrapper in index.ts adds scaffolds, wear,
 * candlelight, snow and the TO LET shingle. `look.variant` seeds colour, door,
 * props, mirroring and a little crookedness, so no two are stamped.
 */
import * as THREE from 'three';
import type { BuildingLook, Env } from '../api';
import type { BodyBuilder } from './types';
import { PAL, mat, mix } from '../palette';
import {
  Sculpt, gableRoof, coneRoof, gableFace, frameFace, frameGable, stones, patches, ashlar, door, win, chimney,
  bucket, barrel, fence, woodpile, crate, bench, steppingStones, groundPatch, finishBody, paintMat, slope, ROOF,
  type V3, type RoofKind, type RoofStyle,
} from './parts';
import { grassMat, leafMat, canopy, soupOf, snowShell, snowMesh } from './shared';

export function seedFor(look: BuildingLook, salt: number): number {
  const v = Math.round((look.variant || 0) * 1000) | 0;
  return (Math.imul(v ^ 0x5bd1e995, 0x9e3779b1) ^ Math.imul(salt + (look.level | 0) * 31, 0x85ebca6b)) | 0;
}

export const DOOR_HEX = [PAL.door, PAL.doorRed, PAL.doorGreen, PAL.doorBlue, 0x7a5a2a] as const;
export const PLASTER_HEX = [PAL.plaster, PAL.plasterWarm, PAL.plasterGrey, 0xe6d3ae, 0xdccfb0] as const;
const ROPE = 0xbfa67a;
const BUSH = 0x5b8a45;

/** a tapered round timber from A to B (tree limbs, poles at an angle) */
export function limb(s: Sculpt, b: string, hex: number, A: V3, B: V3, r0: number, r1: number, n = 5, facets = 0.06): void {
  const dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2], len = Math.hypot(dx, dy, dz) || 1e-6;
  s.at(A[0], A[1], A[2], Math.atan2(dx, dz), () => s.cyl(b, hex, 0, 0, 0, r0, r1, len, n, { facets }), Math.acos(Math.max(-1, Math.min(1, dy / len))));
}

/**
 * A wall slab standing across the building at x (thickness t along x) whose top follows a gable:
 * shoulders at (zc ± halfZ, eaveY), apex at (zc, apexY). Party walls, stone parapets.
 */
export function gableSlab(s: Sculpt, b: string, hex: number, x: number, zc: number, halfZ: number, baseY: number, eaveY: number, apexY: number, t: number): void {
  const x0 = x - t / 2, x1 = x + t / 2, zf = zc + halfZ, zb = zc - halfZ;
  for (const [xx, sg] of [[x0, -1], [x1, 1]] as const) {
    s.quadTo(b, hex, [xx, baseY, zb], [xx, baseY, zf], [xx, eaveY, zf], [xx, eaveY, zb], sg, 0, 0);
    s.triTo(b, hex, [xx, eaveY, zb], [xx, eaveY, zf], [xx, apexY, zc], sg, 0, 0);
  }
  s.quadTo(b, hex, [x0, eaveY, zf], [x1, eaveY, zf], [x1, apexY, zc], [x0, apexY, zc], 0, 1, 1);
  s.quadTo(b, hex, [x0, eaveY, zb], [x1, eaveY, zb], [x1, apexY, zc], [x0, apexY, zc], 0, 1, -1);
  s.quadTo(b, hex, [x0, baseY, zf], [x1, baseY, zf], [x1, eaveY, zf], [x0, eaveY, zf], 0, 0, 1);
  s.quadTo(b, hex, [x0, baseY, zb], [x1, baseY, zb], [x1, eaveY, zb], [x0, eaveY, zb], 0, 0, -1);
}

/**
 * A dormer poking out of a roof slope whose ridge runs along x at (zc, ridgeY) and whose eave is
 * `eaveZ` out and `drop` down. `side` +1 puts it on the front (+z) slope.
 */
export function dormer(s: Sculpt, x: number, zc: number, ridgeY: number, eaveZ: number, drop: number, hex: number, kind: RoofKind, unit = 0, side = 1, w = 0.3): void {
  const zf = eaveZ * 0.6, top = ridgeY - (zf / eaveZ) * drop + 0.22, ry = side > 0 ? 0 : Math.PI;
  s.block('wall', hex, x, top - 0.27, zc + side * (zf - 0.15), w, 0.27, 0.3, { bottom: true });
  s.at(x, top - 0.125, zc + side * zf, ry, () => win(s, { w: w * 0.43, h: 0.13, unit, sill: false, shutters: null }));
  s.at(x, top, zc + side * zf, ry, () => gableFace(s, w, 0.15, hex));
  s.at(x, 0, zc + side * (zf - 0.2), side * Math.PI / 2, () => gableRoof(s, { len: 0.5, half: w / 2, wallTop: top, rise: 0.15, ov: 0.06, kind, cap: false }));
}

/**
 * The inside of a masonry shell: four pale faces looking inward, a little way in from the outer
 * wall. Nobody sees them while the roof is on; a half-built or fallen hall shows limewash, not a void.
 */
export function lining(s: Sculpt, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, hex: number, inset = 0.04): void {
  const a = x0 + inset, b = x1 - inset, c = z0 + inset, d = z1 - inset;
  s.quadTo('wall', hex, [a, y0, d], [b, y0, d], [b, y1, d], [a, y1, d], 0, 0, -1, 0.03);
  s.quadTo('wall', hex, [a, y0, c], [b, y0, c], [b, y1, c], [a, y1, c], 0, 0, 1, 0.03);
  s.quadTo('wall', hex, [b, y0, c], [b, y0, d], [b, y1, d], [b, y1, c], -1, 0, 0, 0.03);
  s.quadTo('wall', hex, [a, y0, c], [a, y0, d], [a, y1, d], [a, y1, c], 1, 0, 0, 0.03);
}

/** a four-sided pointed roof: base half-width `half` at y, apex h above */
export function pyramidRoof(s: Sculpt, x: number, y: number, z: number, half: number, h: number, kind: RoofKind): void {
  const a: V3 = [x, y + h, z], c: V3[] = [[x - half, y, z + half], [x + half, y, z + half], [x + half, y, z - half], [x - half, y, z - half]];
  for (let i = 0; i < 4; i++) slope(s, a, a, c[i], c[(i + 1) % 4], ROOF[kind] as RoofStyle, { verge0: false, verge1: false });
}

/** a small hanging lantern whose pane lights with the unit's windows */
export function lantern(s: Sculpt, x: number, yTop: number, z: number, unit = 0, drop = 0.07): void {
  if (drop > 0) s.beam('trim', PAL.iron, [x, yTop, z], [x, yTop - drop, z], 0.012, 0.012, 0);
  const y = yTop - drop;
  s.block('trim', PAL.brass, x, y - 0.02, z, 0.07, 0.02, 0.07, { bottom: true, tw: 0.03, td: 0.03 });
  s.block('glass' + unit, PAL.window, x, y - 0.09, z, 0.05, 0.07, 0.05, { bottom: true });
  s.block('trim', PAL.brass, x, y - 0.105, z, 0.065, 0.015, 0.065, { bottom: true });
}

// ───────────────────────── hovel ─────────────────────────

/** Four walls, most of a roof. */
export const hovel: BodyBuilder = look => {
  const s = new Sculpt(seedFor(look, 11)), r = s.rand;
  if (r.chance(0.5)) s.scale(-1, 1, 1);
  s.rotY(r.range(-0.07, 0.07));
  const zc = -0.06, W = 1.2, D = 0.98, H = r.range(0.55, 0.61), front = zc + D / 2;
  const daub = mix(PAL.daub, r.pick([PAL.plasterWarm, PAL.dirt, PAL.daub]), r.range(0.1, 0.3));
  const kx = r.range(-0.07, 0.07), kz = r.range(-0.03, 0.05);
  const rise = r.range(0.5, 0.58), ov = 0.11, sag = r.range(0.04, 0.08), tilt = r.range(-0.07, 0.07);
  const doorX = -0.22;
  const thatch = r.pick([ROOF.shag.colors, [PAL.thatchOld, 0xa39459, 0x9a8a55, 0xb0984f, 0x8f8250], [PAL.thatch, 0xc2a04e, 0xb89648, PAL.thatchOld, 0xcfa850], [0xa8985a, 0x9c9060, PAL.thatchOld, 0xb5a468, 0x8e8a5a]] as const);
  const doorHex = mix(r.pick([PAL.door, PAL.door, PAL.doorGreen, PAL.doorBlue, PAL.timberLight]), PAL.daub, r.range(0.25, 0.5));

  s.push(); s.shear(kx, kz);
  s.block('wall', daub, 0, 0, zc, W, H, D);
  const shades = [mix(daub, PAL.dirt, 0.3), mix(daub, PAL.plaster, 0.25), mix(daub, PAL.dirtDark, 0.2)];
  s.at(0, 0, front, 0, () => patches(s, W, H, 4, shades));
  s.at(0, 0, zc - D / 2, Math.PI, () => patches(s, W, H, 3, shades));
  s.at(-W / 2, 0, zc, -Math.PI / 2, () => patches(s, D, H, 3, shades));
  // the daub has fallen off one side and the wattle shows
  s.at(W / 2, 0, zc, Math.PI / 2, () => {
    s.quad('wall', 0x4f3d28, [-0.22, 0.1, 0.004], [0.08, 0.08, 0.004], [0.1, 0.36, 0.004], [-0.2, 0.33, 0.004], 0.03);
    for (let i = 0; i < 4; i++) { const x = -0.18 + i * 0.075; s.beam('trim', 0x8a6f48, [x, 0.09, 0.012], [x + 0.01, 0.35, 0.012], 0.014, 0.018); }
    for (let i = 0; i < 3; i++) { const y = 0.14 + i * 0.08; s.beam('trim', 0x9a7d52, [-0.21, y, 0.02], [0.09, y + 0.012, 0.02], 0.012, 0.022); }
  });
  // crooked corner posts
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    s.block('trim', PAL.timber, sx * (W / 2 - 0.01), 0, zc + sz * (D / 2 - 0.01), 0.085, H + 0.02, 0.085, { sx: r.range(-0.025, 0.025), sz: r.range(-0.025, 0.025), tw: 0.07, td: 0.07 });
  }
  s.at(doorX, 0, front, 0, () => door(s, { w: 0.27, h: 0.4, hex: doorHex, ajar: r.range(0.08, 0.45), step: false }));
  s.at(0.3, 0.3, front, 0, () => win(s, { w: 0.13, h: 0.12, unit: 0, shutters: null }));
  s.at(W / 2, H, zc, Math.PI / 2, () => { gableFace(s, D, rise, daub); frameGable(s, D, rise, { t: 0.05, king: true }); });
  s.at(-W / 2, H, zc, -Math.PI / 2, () => { gableFace(s, D, rise, daub); frameGable(s, D, rise, { t: 0.05, king: true }); });
  s.pop();

  const rx0 = kx * H * 0.8, rz0 = zc + kz * H * 0.8, len = W + 0.3, eaveZ = D / 2 + ov, drop = rise * (1 + ov / (D / 2));
  let ridgeY = 0;
  s.at(rx0, 0, rz0, 0, () => { ridgeY = gableRoof(s, { len, half: D / 2, wallTop: H, rise, ov, kind: 'shag', sag, tilt, colors: thatch }); });
  const roofY = (x: number, zl: number) => ridgeY + (x / len) * tilt - (Math.abs(zl) / eaveZ) * drop - sag * Math.sin(Math.PI * (x / len + 0.5));
  // spars crossed over each gable end, holding the thatch down
  for (const sg of [-1, 1]) {
    const x = rx0 + sg * (len / 2 - 0.04), y = ridgeY + (sg * tilt) / 2;
    s.beam('trim', PAL.timberLight, [x, y - 0.3, rz0 + 0.26], [x, y + 0.13, rz0 - 0.09], 0.03, 0.035);
    s.beam('trim', PAL.timberLight, [x, y - 0.3, rz0 - 0.26], [x, y + 0.13, rz0 + 0.09], 0.03, 0.035);
  }
  // the smoke hole: a soot-black wicker hood through the back slope
  const hx = 0.26, hz = -0.13, hy = roofY(hx, hz);
  s.cyl('trim', mix(PAL.daub, PAL.soot, 0.45), rx0 + hx, hy - 0.02, rz0 + hz, 0.08, 0.06, 0.13, 7, { capHex: PAL.soot, facets: 0.06 });
  const smoke = s.point(rx0 + hx, hy + 0.13, rz0 + hz);
  // stones on the thatch against the wind
  for (let i = 0; i < 3; i++) {
    const x = r.range(-0.45, 0.45), zl = r.sign() * r.range(0.2, 0.5);
    s.blob('trim', r.pick([PAL.rock, PAL.stone, PAL.rockDark]), rx0 + x, roofY(x, zl) + 0.05, rz0 + zl, 0.055, 0.035, 0.05, { detail: 0, lump: 0.2 });
  }
  // the yard, such as it is
  groundPatch(s, 0.4, front + 0.3, 0.27, 0.15, PAL.dirtDark);
  groundPatch(s, doorX, front + 0.14, 0.2, 0.12, PAL.dirt, 0.008);
  bucket(s, 0.54, front + 0.2);
  const extra = r.int(0, 2);
  if (extra === 0) woodpile(s, -W / 2 - 0.13, zc + 0.1, Math.PI / 2);
  else if (extra === 1) barrel(s, -W / 2 - 0.12, zc + 0.25);
  else fence(s, 0.34, front + 0.36, 0.8, front + 0.33, { h: 0.18 });
  s.beam('trim', PAL.timberLight, [-0.52, 0, front + 0.07], [-0.5, 0.5, front + 0.012], 0.022, 0.022);

  return finishBody(s, {
    door: s.point(doorX, 0, front + 0.27), roof: s.point(rx0 - 0.1, ridgeY - sag + 0.1, rz0), chimney: smoke, top: ridgeY + 0.16,
  });
};

// ───────────────────────── cottage ─────────────────────────

/** A proper chimney and a door that shuts. */
export const cottage: BodyBuilder = look => {
  const s = new Sculpt(seedFor(look, 23)), r = s.rand;
  if (r.chance(0.5)) s.scale(-1, 1, 1);
  s.rotY(r.range(-0.035, 0.035));
  const zc = -0.08, W = 1.3, D = 1.0, base = 0.09, H = 0.62, top = base + H, front = zc + D / 2, back = zc - D / 2;
  const plaster = r.pick(PLASTER_HEX), doorHex = r.pick(DOOR_HEX), trimHex = r.pick([doorHex, PAL.doorGreen, PAL.doorBlue, PAL.crimson]);
  const rise = r.range(0.56, 0.64), ov = 0.16;
  const doorBay = r.chance(0.5) ? 1 : 2, doorX = doorBay === 1 ? 0 : 0.41, winXs = doorBay === 1 ? [-0.41, 0.41] : [-0.41, 0];

  // stone plinth
  s.block('wall', PAL.stone, 0, 0, zc, W + 0.07, base + 0.012, D + 0.07);
  for (const [x, z, ry, w] of [[0, front + 0.035, 0, W], [0, back - 0.035, Math.PI, W], [W / 2 + 0.035, zc, Math.PI / 2, D], [-W / 2 - 0.035, zc, -Math.PI / 2, D]] as const) {
    s.at(x, 0, z, ry, () => stones(s, w, base, 5, [PAL.stoneDark, PAL.stoneWarm, PAL.rock]));
  }
  s.block('wall', plaster, 0, base, zc, W, H, D, { sx: r.range(-0.012, 0.012) });
  // front: posts, plate, short rails under the windows
  s.at(0, base, front, 0, () => {
    frameFace(s, W, H, { posts: 4, sill: false });
    for (const wx of winXs) s.beam('trim', PAL.timber, [wx - 0.17, 0.17, 0.008], [wx + 0.17, 0.17, 0.008], 0.05, 0.055);
  });
  s.at(doorX, base, front, 0, () => door(s, { w: 0.28, h: 0.5, hex: doorHex, step: false }));
  s.block('trim', PAL.stoneWarm, doorX, 0, front + 0.11, 0.42, base, 0.2);
  winXs.forEach((wx, i) => s.at(wx, base + 0.36, front, 0, () => win(s, { w: 0.2, h: 0.2, unit: 0, shutters: trimHex, box: i === 0 ? PAL.timberLight : null })));
  // sides and back
  s.at(W / 2, base, zc, Math.PI / 2, () => frameFace(s, D, H, { posts: 3, brace: 'corner', sill: false }));
  s.at(-W / 2, base, zc, -Math.PI / 2, () => frameFace(s, D, H, { posts: 3, brace: 'none', sill: false, rails: [0.3] }));
  s.at(-W / 2, base + 0.38, zc + 0.24, -Math.PI / 2, () => win(s, { w: 0.18, h: 0.18, unit: 0, shutters: null }));
  s.at(0, base, back, Math.PI, () => frameFace(s, W, H, { posts: 4, rails: [0.5], brace: 'cross', sill: false }));
  s.at(0, base + 0.42, back, Math.PI, () => win(s, { w: 0.16, h: 0.14, unit: 0, shutters: null, sill: false }));
  // gables
  s.at(W / 2, top, zc, Math.PI / 2, () => { gableFace(s, D, rise, plaster); frameGable(s, D, rise, { collar: true }); });
  s.at(-W / 2, top, zc, -Math.PI / 2, () => { gableFace(s, D, rise, plaster); frameGable(s, D, rise, { collar: true }); });
  // thatch
  let ridgeY = 0;
  const thatch = r.pick([ROOF.thatch.colors, [0xd4b057, 0xcfa850, 0xdab65c, 0xc49d48], [0xbf9c4c, 0xb89648, 0xc6a352, 0xb08e44], [PAL.thatch, 0xc0a556, 0xb8a05a, 0xcaa750]] as const);
  s.at(0, 0, zc, 0, () => { ridgeY = gableRoof(s, { len: W + 0.24, half: D / 2, wallTop: top, rise, ov, kind: 'thatch', sag: 0.02, tilt: r.range(-0.02, 0.02), colors: thatch }); });
  // dormer on the front slope
  dormer(s, -0.3, zc, ridgeY, D / 2 + ov, rise * (1 + ov / (D / 2)), plaster, 'thatch');
  // stone chimney up the gable end
  const cx = W / 2 + 0.09;
  s.block('trim', PAL.stone, cx, 0, zc, 0.2, 0.5, 0.42, { td: 0.27 });
  s.at(cx + 0.1, 0, zc, Math.PI / 2, () => stones(s, 0.36, 0.46, 7, [PAL.stoneDark, PAL.stoneWarm, PAL.rock], 'trim'));
  const smoke = chimney(s, cx, 0.5, zc, ridgeY + 0.3, { w: 0.2, d: 0.27, lean: r.range(-0.02, 0.02) });
  // yard
  fence(s, -0.82, front + 0.34, -0.38, front + 0.36, { h: 0.2, pickets: true });
  fence(s, -0.82, front + 0.34, -0.82, front + 0.04, { h: 0.2, pickets: true });
  s.blob('trim', BUSH, 0.62, 0.09, front + 0.13, 0.13, 0.13, 0.11, { lump: 0.2, facets: 0.1 });
  if (r.chance(0.5)) barrel(s, -W / 2 - 0.1, back + 0.22); else woodpile(s, -W / 2 - 0.11, zc - 0.1, Math.PI / 2);
  steppingStones(s, doorX, front + 0.3, doorX + 0.05, front + 0.44, 2);

  return finishBody(s, { door: s.point(doorX, 0, front + 0.3), roof: s.point(0.12, ridgeY + 0.07, zc), chimney: smoke, top: ridgeY + 0.45 });
};

// ───────────────────────── burrow ─────────────────────────

/** A round door in a small hill. */
export const burrow: BodyBuilder = look => {
  const s = new Sculpt(seedFor(look, 37)), r = s.rand;
  if (r.chance(0.5)) s.scale(-1, 1, 1);
  s.rotY(r.range(-0.04, 0.04));
  const zc = -0.1, RX = 0.8, RY = r.range(0.58, 0.66), RZ = 0.72, cut = 0.5, fz = zc + cut, faceZ = fz + 0.19;
  const doorHex = r.pick([PAL.doorGreen, 0xc9962f, PAL.doorRed, PAL.doorBlue]), doorX = -0.1;
  // the hill
  s.blob('mound', 0xf6f6f6, 0, 0, zc, RX, RY, RZ, { detail: 2, lump: 0.045, facets: 0.1, floor: 0, maxZ: cut, jit: 0 });
  const surfY = (x: number, zl: number) => RY * Math.sqrt(Math.max(0, 1 - (x / RX) ** 2 - (zl / RZ) ** 2));
  // the front: a stone arch with a plastered face
  s.at(0, 0.03, fz - 0.04, 0, () => {
    s.cyl('trim', PAL.stoneWarm, 0, 0, 0, 0.5, 0.5, 0.2, 14, { facets: 0.08, capHex: PAL.stone });
    s.cyl('wall', PAL.plasterWarm, 0, 0.2, 0, 0.42, 0.42, 0.03, 14, { jit: 0.02 });
  }, Math.PI / 2);
  // voussoirs picked out round the arch
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.08 + (0.84 * i) / 6), cx = Math.cos(a) * 0.46, cy = 0.03 + Math.sin(a) * 0.46;
    s.at(cx, cy, fz + 0.161, 0, () => s.quad('trim', i % 2 ? PAL.stone : PAL.stoneDark, [-0.045, -0.035, 0], [0.045, -0.035, 0], [0.045, 0.035, 0], [-0.045, 0.035, 0], 0.05), 0, a - Math.PI / 2);
  }
  s.at(doorX, 0, faceZ, 0, () => door(s, { style: 'round', w: 0.34, hex: doorHex, knob: PAL.brass }));
  s.at(0.26, 0.2, faceZ, 0, () => win(s, { style: 'round', w: 0.14, unit: 0 }));
  // a porthole set in the hillside
  {
    const a = 0.35, e = 0.56, ux = Math.cos(e) * Math.cos(a), uy = Math.sin(e), uz = Math.cos(e) * Math.sin(a);
    let nx = ux / RX, ny = uy / RY, nz = uz / RZ; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    s.at(RX * ux - nx * 0.035, RY * uy - ny * 0.035, zc + RZ * uz - nz * 0.035, Math.atan2(nx, nz), () => win(s, { style: 'round', w: 0.15, unit: 0, frame: PAL.stoneWarm }), -Math.asin(ny));
  }
  // stovepipe with a rain hat
  const px = 0.2, pzl = -0.3, py = surfY(px, pzl);
  s.cyl('trim', PAL.stoneDark, px, py - 0.04, zc + pzl, 0.065, 0.055, 0.07, 6);
  s.cyl('trim', PAL.iron, px, py, zc + pzl, 0.04, 0.036, 0.3, 6, { sx: 0.03, capHex: PAL.soot });
  s.cone('trim', PAL.iron, px + 0.03, py + 0.33, zc + pzl, 0.08, 0.05, 6, { bottom: true });
  s.beam('trim', PAL.iron, [px + 0.03, py + 0.29, zc + pzl], [px + 0.03, py + 0.34, zc + pzl], 0.012, 0.012, 0);
  const smoke = s.point(px + 0.03, py + 0.32, zc + pzl);
  // garden: stepping stones, shrubs flanking the arch, a lantern on a post
  steppingStones(s, doorX, faceZ + 0.12, doorX + 0.07, 0.84, 3);
  s.blob('trim', BUSH, -0.6, 0.07, fz + 0.1, 0.13, 0.12, 0.12, { lump: 0.2, facets: 0.1 });
  s.blob('trim', 0x4f7a3a, 0.6, 0.06, fz + 0.08, 0.11, 0.1, 0.11, { lump: 0.2, facets: 0.1 });
  s.block('trim', PAL.timber, -0.43, 0, faceZ + 0.14, 0.03, 0.3, 0.03);
  lantern(s, -0.43, 0.42, faceZ + 0.14, 0, 0);
  if (r.chance(0.5)) bench(s, 0.56, faceZ + 0.2, -0.35, 0.3);
  else { groundPatch(s, 0.56, faceZ + 0.2, 0.17, 0.11, PAL.dirtDark); for (let i = 0; i < 3; i++) s.blob('trim', 0x7fae5a, 0.45 + i * 0.1, 0.035, faceZ + 0.2 + (i % 2) * 0.03, 0.04, 0.04, 0.04, { detail: 0, lump: 0.15 }); }
  // wild flowers on the hill when someone is home to plant them
  for (let i = 0; i < 9; i++) {
    const x = r.range(-0.6, 0.6), zl = r.range(-0.2, 0.42), y = surfY(x, zl);
    if (y < 0.12) continue;
    s.blob('life0', r.pick([PAL.crimson, PAL.gold, 0xe9e2d0, 0xd77a9a, 0xb58cff]), x, y + 0.03, zc + zl, 0.028, 0.025, 0.028, { detail: 0, jit: 0.05 });
  }

  const mound = s.mesh('mound', grassMat())!;
  const body = finishBody(s, {
    door: s.point(doorX, 0, faceZ + 0.27), roof: s.point(0, RY + 0.02, zc - 0.05), chimney: smoke, top: RY + 0.45,
    extras: [mound], extraRoofs: [mound],
  });
  body.group.userData.drifts = [];
  return body;
};

// ───────────────────────── longhouse ─────────────────────────

/** Two households, one wall between them. */
export const longhouse: BodyBuilder = look => {
  const s = new Sculpt(seedFor(look, 41)), r = s.rand;
  if (r.chance(0.5)) s.scale(-1, 1, 1);
  s.rotY(r.range(-0.025, 0.025));
  const zc = -0.06, W = 2.46, D = 1.1, base = 0.07, H = 0.6, top = base + H, front = zc + D / 2, back = zc - D / 2;
  const wallA = mix(PAL.plasterWarm, PAL.daub, 0.35), wallB = mix(PAL.plaster, PAL.daub, 0.22);
  const doorA = r.pick(DOOR_HEX), doorB = r.pick(DOOR_HEX.filter(d => d !== doorA));
  const rise = 0.6, ov = 0.12, eaveZ = D / 2 + ov, k = rise / (D / 2);

  s.block('wall', PAL.stoneDark, 0, 0, zc, W + 0.06, base + 0.012, D + 0.06);
  s.block('wall', wallA, -W / 4, base, zc, W / 2, H, D);
  s.block('wall', wallB, W / 4, base, zc, W / 2, H, D);
  s.at(0, base, front, 0, () => frameFace(s, W, H, { posts: 9, sill: false, t: 0.055 }));
  s.at(0, base, back, Math.PI, () => frameFace(s, W, H, { posts: 9, sill: false, t: 0.055 }));
  for (const sg of [-1, 1]) {
    s.at(sg * W / 2, base, zc, sg * Math.PI / 2, () => frameFace(s, D, H, { posts: 3, sill: false, brace: 'corner', t: 0.06 }));
    s.at(sg * W / 2, top, zc, sg * Math.PI / 2, () => { gableFace(s, D, rise, sg < 0 ? wallA : wallB); frameGable(s, D, rise, { collar: true }); });
  }
  // doors side by side, windows at the far ends
  for (const [sg, hex, unit] of [[-1, doorA, 0], [1, doorB, 1]] as const) {
    s.at(sg * 0.45, base, front, 0, () => door(s, { w: 0.27, h: 0.44, hex, step: false }));
    s.block('trim', PAL.stone, sg * 0.45, 0, front + 0.09, 0.36, base, 0.17);
    s.at(sg * 1.02, base + 0.33, front, 0, () => win(s, { w: 0.17, h: 0.17, unit, shutters: hex, box: PAL.timberLight, flowers: unit ? [PAL.gold, 0xe9e2d0] : [PAL.crimson, 0xd77a9a] }));
    s.at(sg * 0.72, base + 0.34, back, Math.PI, () => win(s, { w: 0.15, h: 0.15, unit, shutters: null }));
  }
  // thatch: each household keeps its own half, and it shows
  const thatchB = [PAL.thatchOld, 0xa8985a, 0xb0a060, 0x9f8f58] as const;
  let ridgeY = 0;
  s.at(-0.675, 0, zc, 0, () => { ridgeY = gableRoof(s, { len: 1.35, half: D / 2, wallTop: top, rise, ov, kind: 'thatch', tilt: -0.07 }); });
  s.at(0.675, 0, zc, 0, () => gableRoof(s, { len: 1.35, half: D / 2, wallTop: top, rise, ov, kind: 'thatch', tilt: 0.07, colors: thatchB }));
  // the wall they share, standing proud of the thatch
  const eaveY = top - ov * k;
  gableSlab(s, 'trim', PAL.stone, 0, zc, eaveZ - 0.03, 0, eaveY + 0.12, ridgeY + 0.09, 0.13);
  s.at(0, 0, zc + eaveZ - 0.029, 0, () => stones(s, 0.13, eaveY + 0.1, 4, [PAL.stoneDark, PAL.stoneWarm], 'trim'));
  s.block('trim', PAL.stone, 0, ridgeY + 0.04, zc, 0.3, 0.24, 0.2, { tw: 0.26, td: 0.17 });
  s.block('trim', PAL.stoneDark, 0, ridgeY + 0.28, zc, 0.32, 0.03, 0.2, { bottom: true });
  for (const sg of [-1, 1]) s.cyl('trim', PAL.brick, sg * 0.075, ridgeY + 0.31, zc, 0.05, 0.04, 0.07 + (sg > 0 ? 0.02 : 0), 6, { capHex: PAL.soot });
  const smoke = s.point(0, ridgeY + 0.42, zc);
  // crossed finials at the ridge ends
  for (const sg of [-1, 1]) {
    const x = sg * 1.335, y = ridgeY + 0.035;
    s.beam('trim', PAL.timber, [x, y - 0.3, zc + 0.29], [x, y + 0.19, zc - 0.11], 0.04, 0.05);
    s.beam('trim', PAL.timber, [x, y - 0.3, zc - 0.29], [x, y + 0.19, zc + 0.11], 0.04, 0.05);
  }
  // each side's clutter
  bench(s, -0.76, front + 0.1, 0, 0.3);
  bucket(s, -1.2, front + 0.22);
  woodpile(s, 0.76, front + 0.1, 0);
  barrel(s, 1.22, front + 0.17);
  groundPatch(s, -0.45, front + 0.3, 0.2, 0.12, PAL.dirt, 0.007);
  groundPatch(s, 0.45, front + 0.3, 0.2, 0.12, PAL.dirt, 0.007);

  return finishBody(s, { door: s.point(0, 0, front + 0.42), roof: s.point(-0.55, ridgeY + 0.06, zc), chimney: smoke, top: ridgeY + 0.45 });
};

// ───────────────────────── stone hall ─────────────────────────

/** Built to outlast its landlord. */
export const stonehall: BodyBuilder = look => {
  const s = new Sculpt(seedFor(look, 53)), r = s.rand;
  if (r.chance(0.5)) s.scale(-1, 1, 1);
  s.rotY(r.range(-0.01, 0.01)); // dwarves build square
  const zc = -0.05, W = 2.5, D = 1.36, H = 0.76, batter = 0.06, TW = W - batter * 2, TD = D - batter * 2;
  const front = zc + D / 2, back = zc - D / 2, kz = batter / H;
  const cols = [PAL.stone, PAL.stoneWarm, PAL.stoneDark, PAL.rock, 0xa39d90] as const;
  const doorHex = mix(PAL.door, PAL.soot, 0.3);

  s.block('wall', PAL.rockDark, 0, 0, zc, W, H, D, { tw: TW, td: TD });
  lining(s, -W / 2, W / 2, back, front, 0.01, H - 0.01, mix(PAL.stoneWarm, PAL.plasterGrey, 0.35), batter + 0.03);
  s.at(0, 0, front, 0, () => ashlar(s, W - 0.34, H, { colors: cols, slopeZ: kz, rowH: 0.15 }));
  s.at(0, 0, back, Math.PI, () => ashlar(s, W - 0.34, H, { colors: cols, slopeZ: kz, rowH: 0.15 }));
  s.at(W / 2, 0, zc, Math.PI / 2, () => ashlar(s, D - 0.34, H, { colors: cols, slopeZ: kz, rowH: 0.15 }));
  s.at(-W / 2, 0, zc, -Math.PI / 2, () => ashlar(s, D - 0.34, H, { colors: cols, slopeZ: kz, rowH: 0.15 }));
  // corner buttresses
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    s.block('wall', PAL.stoneWarm, sx * (W / 2 - 0.1), 0, zc + sz * (D / 2 - 0.1), 0.27, H * 0.94, 0.27, { tw: 0.17, td: 0.17, sx: -sx * 0.05, sz: -sz * 0.05 });
  }
  // slate roof between stone gables
  let ridgeY = 0;
  s.at(0, 0, zc, 0, () => { ridgeY = gableRoof(s, { len: TW + 0.06, half: TD / 2, wallTop: H, rise: 0.4, ov: 0.09, kind: 'slate' }); });
  for (const sg of [-1, 1]) {
    gableSlab(s, 'wall', PAL.stone, sg * (TW / 2 - 0.02), zc, TD / 2 + 0.03, H - 0.03, H + 0.05, ridgeY + 0.1, 0.15);
    s.block('trim', PAL.stoneWarm, sg * (TW / 2 - 0.02), ridgeY + 0.08, zc, 0.12, 0.12, 0.12, { tw: 0.05, td: 0.05, bottom: true });
    s.at(sg * (TW / 2 + 0.056), H, zc, sg * Math.PI / 2, () => stones(s, TD * 0.5, 0.2, 4, cols));
  }
  // the portal: two iron-banded doors under one carved lintel
  const pz = front + 0.04;
  s.block('wall', PAL.stoneWarm, 0, 0, front - 0.03, 1.34, 0.52, 0.14);
  for (const sg of [-1, 1]) s.at(sg * 0.36, 0, pz, 0, () => door(s, { w: 0.3, h: 0.43, hex: doorHex, style: 'banded', frame: PAL.stoneDark, step: false }));
  s.block('trim', PAL.stoneDark, 0, 0, pz + 0.01, 0.15, 0.5, 0.07);
  s.block('trim', PAL.stoneWarm, 0, 0.5, front + 0.03, 1.4, 0.16, 0.18, { bottom: true });
  s.at(0, 0.5, front + 0.122, 0, () => {
    for (let i = 0; i < 9; i++) {
      const x = -0.6 + i * 0.15;
      if (i === 4) { s.quad('trim', PAL.brass, [x, 0.025, 0.002], [x + 0.055, 0.08, 0.002], [x, 0.135, 0.002], [x - 0.055, 0.08, 0.002], 0); continue; }
      if (i % 2) s.tri('trim', PAL.rockDark, [x - 0.055, 0.035, 0], [x + 0.055, 0.035, 0], [x, 0.125, 0], 0.03);
      else s.tri('trim', PAL.rockDark, [x - 0.055, 0.125, 0], [x, 0.035, 0], [x + 0.055, 0.125, 0], 0.03);
    }
  });
  s.block('trim', PAL.stone, 0, 0, pz + 0.12, 1.24, 0.04, 0.2);
  lantern(s, 0, 0.5, pz + 0.07, 0, 0.02);
  // deep-set windows
  for (const [sg, unit] of [[-1, 0], [1, 1]] as const) {
    s.at(sg * 0.88, 0.42, front - kz * 0.42, 0, () => win(s, { w: 0.16, h: 0.17, unit, frame: PAL.stoneWarm, shutters: null }));
    s.at(sg * 0.62, 0.44, back + kz * 0.44, Math.PI, () => win(s, { w: 0.16, h: 0.16, unit, frame: PAL.stoneWarm, shutters: null }));
    s.at(sg * (W / 2 - kz * 0.44), 0.44, zc, sg * Math.PI / 2, () => win(s, { w: 0.16, h: 0.18, unit, frame: PAL.stoneWarm, shutters: null }));
  }
  // two stout chimneys, one per hearth
  let smoke: THREE.Vector3 | null = null;
  for (const sg of [-1, 1]) {
    const p = chimney(s, sg * 0.68, ridgeY - 0.2, zc, ridgeY + 0.28, { w: 0.24, d: 0.24, pot: false, taper: 0.9 });
    if (sg < 0) smoke = p;
  }
  // a stack of dressed stone, because they are never finished
  s.block('trim', PAL.stoneWarm, 1.0, 0, front + 0.17, 0.2, 0.1, 0.14, { ry: 0.1 });
  s.block('trim', PAL.stone, 1.16, 0, front + 0.2, 0.14, 0.09, 0.14, { ry: -0.3 });
  s.block('trim', PAL.rock, 1.03, 0.1, front + 0.17, 0.16, 0.09, 0.12, { ry: 0.4, bottom: true });
  // and the cellar nobody gave them leave to dig
  if (r.chance(0.6)) {
    const hx = -0.86, hz = front + 0.01;
    s.at(hx, 0, hz, 0, () => {
      s.quad('trim', PAL.timberLight, [-0.15, 0.02, 0.26], [0.15, 0.02, 0.26], [0.15, 0.15, 0], [-0.15, 0.15, 0]);
      s.tri('trim', PAL.stoneDark, [0.15, 0, 0.26], [0.15, 0, 0], [0.15, 0.15, 0]);
      s.tri('trim', PAL.stoneDark, [-0.15, 0, 0], [-0.15, 0, 0.26], [-0.15, 0.15, 0]);
      s.quad('trim', PAL.stoneDark, [-0.15, 0, 0.26], [0.15, 0, 0.26], [0.15, 0.02, 0.26], [-0.15, 0.02, 0.26]);
      s.beam('trim', PAL.iron, [0, 0.03, 0.262], [0, 0.152, 0.004], 0.014, 0.012, 0);
      // the spoil heap, and the shovel that made it
      s.blob('trim', PAL.dirt, -0.32, 0, 0.16, 0.13, 0.1, 0.12, { detail: 1, lump: 0.2, floor: 0 });
      s.beam('trim', PAL.timberLight, [-0.3, 0.08, 0.2], [-0.2, 0.36, 0.12], 0.02, 0.02);
      s.block('trim', PAL.iron, -0.3, 0.02, 0.2, 0.07, 0.08, 0.015, { bottom: true });
    });
  }
  return finishBody(s, { door: s.point(0, 0, front + 0.29), roof: s.point(0, ridgeY + 0.06, zc), chimney: smoke, top: ridgeY + 0.36 });
};

// ───────────────────────── townhouse ─────────────────────────

/** Three households stacked like firewood. */
export const townhouse: BodyBuilder = look => {
  const s = new Sculpt(seedFor(look, 67)), r = s.rand;
  if (r.chance(0.5)) s.scale(-1, 1, 1);
  s.rotY(r.range(-0.02, 0.02));
  const back = -1.18;
  const plaster = r.pick([...PLASTER_HEX, 0xd9c7a0, 0xcdd2c4, 0xe0c2a8]);
  const doorHex = r.pick(DOOR_HEX), trimHex = r.pick([PAL.doorGreen, PAL.doorBlue, PAL.crimson, doorHex]);
  const floors = [
    { y: 0, h: 0.62, w: 1.18, front: 0.92 },
    { y: 0.62, h: 0.56, w: 1.3, front: 1.03 },
    { y: 1.18, h: 0.5, w: 1.42, front: 1.13 },
  ];
  const doorX = -0.27;
  floors.forEach((f, i) => {
    const depth = f.front - back, zc = (f.front + back) / 2;
    s.push(); s.rotY(i ? r.range(-0.014, 0.014) : 0);
    if (i === 0) {
      // a stone ground floor
      s.block('wall', PAL.stoneWarm, 0, 0, zc, f.w, f.h, depth);
      s.at(0, 0, f.front, 0, () => stones(s, f.w, f.h, 9, [PAL.stone, PAL.stoneDark, PAL.rock]));
      for (const sg of [-1, 1]) s.at(sg * f.w / 2, 0, zc, sg * Math.PI / 2, () => stones(s, depth, f.h, 16, [PAL.stone, PAL.stoneDark, PAL.rock]));
      s.at(doorX, 0, f.front, 0, () => door(s, { w: 0.28, h: 0.5, hex: doorHex }));
      s.at(0.25, 0.34, f.front, 0, () => win(s, { w: 0.24, h: 0.22, unit: 0, shutters: trimHex }));
    } else {
      const lower = floors[i - 1];
      s.block('wall', plaster, 0, f.y, zc, f.w, f.h, depth, { bottom: true });
      // the jetty: a bressummer all round, joist ends under the overhang, brackets at the corners
      s.block('trim', PAL.timber, 0, f.y - 0.04, zc, f.w + 0.03, 0.075, depth + 0.03, { bottom: true });
      for (let j = 0; j < 5; j++) s.block('trim', PAL.timberLight, -f.w / 2 + 0.1 + (j * (f.w - 0.2)) / 4, f.y - 0.095, f.front - 0.06, 0.05, 0.06, 0.11, { bottom: true });
      for (const sg of [-1, 1]) s.beam('trim', PAL.timber, [sg * (lower.w / 2 - 0.03), f.y - 0.24, lower.front + 0.01], [sg * (lower.w / 2 - 0.03), f.y - 0.05, f.front - 0.02], 0.05, 0.05);
      s.at(0, f.y, f.front, 0, () => frameFace(s, f.w, f.h, { posts: 4, brace: 'corner', sill: false }));
      for (const sg of [-1, 1]) s.at(sg * f.w / 2, f.y, zc, sg * Math.PI / 2, () => frameFace(s, depth, f.h, { posts: 5, brace: i === 1 ? 'corner' : 'chevron', sill: false }));
      s.at(0, f.y, back, Math.PI, () => frameFace(s, f.w, f.h, { posts: 3, brace: 'cross', sill: false }));
      const ww = i === 1 ? 0.25 : 0.2;
      s.at(0, f.y + f.h * 0.52, f.front, 0, () => win(s, { w: ww, h: 0.22, unit: i, shutters: i === 2 ? trimHex : null, box: i === 1 ? PAL.timberLight : null }));
    }
    // side and back windows, staggered so the wall is not a ledger
    const zs = i === 1 ? [0.28, -0.3] : i === 2 ? [-0.26, 0.24] : [-0.02, 0.5];
    s.at(f.w / 2, f.y + f.h * 0.55, zc + zs[0] * depth * 0.5, Math.PI / 2, () => win(s, { w: 0.17, h: 0.19, unit: i, shutters: null }));
    s.at(-f.w / 2, f.y + f.h * 0.55, zc + zs[1] * depth * 0.5, -Math.PI / 2, () => win(s, { w: 0.17, h: 0.19, unit: i, shutters: null }));
    s.at(i === 1 ? -0.2 : 0.2, f.y + f.h * 0.55, back, Math.PI, () => win(s, { w: 0.16, h: 0.18, unit: i, shutters: null, sill: false }));
    s.pop();
  });
  // tile roof, gable to the street
  const tf = floors[2], depth2 = tf.front - back, zc2 = (tf.front + back) / 2, wallTop = tf.y + tf.h, rise = 0.66, ov = 0.1;
  let ridgeY = 0;
  s.at(0, 0, zc2, Math.PI / 2, () => { ridgeY = gableRoof(s, { len: depth2 + 0.16, half: tf.w / 2, wallTop, rise, ov, kind: 'tile', tilt: r.range(-0.03, 0.03) }); });
  s.at(0, wallTop, tf.front, 0, () => { gableFace(s, tf.w, rise, plaster); frameGable(s, tf.w, rise, { collar: true }); });
  s.at(0, wallTop + 0.2, tf.front, 0, () => win(s, { style: 'round', w: 0.13, unit: 2 }));
  s.at(0, wallTop, back, Math.PI, () => { gableFace(s, tf.w, rise, plaster); frameGable(s, tf.w, rise, { collar: true }); });
  // one stack, three pots: a hearth for each floor
  const cx = -0.38, cz = zc2 - 0.28, drop = rise * (1 + ov / (tf.w / 2));
  const cy = ridgeY - (0.38 / (tf.w / 2 + ov)) * drop;
  s.block('trim', PAL.brick, cx, cy - 0.2, cz, 0.22, 0.2 + ridgeY - cy + 0.22, 0.44, { bottom: true });
  for (let j = 0; j < 6; j++) s.block('trim', mix(PAL.brick, PAL.soot, 0.3), cx + r.sign() * 0.112, cy + r.range(0, 0.4), cz + r.range(-0.16, 0.16), 0.01, 0.045, 0.1, { bottom: true });
  s.block('trim', PAL.stoneDark, cx, ridgeY + 0.22, cz, 0.27, 0.035, 0.49, { bottom: true });
  for (let j = -1; j <= 1; j++) s.cyl('trim', j ? PAL.brick : 0xb86a48, cx, ridgeY + 0.255, cz + j * 0.14, 0.05, 0.04, 0.08 + (j === 0 ? 0.03 : 0), 6, { capHex: PAL.soot });
  const smoke = s.point(cx, ridgeY + 0.4, cz);
  // street furniture under the jetty
  lantern(s, doorX - 0.24, 0.56, floors[0].front + 0.07, 0, 0.05);
  s.beam('trim', PAL.iron, [doorX - 0.24, 0.56, floors[0].front], [doorX - 0.24, 0.56, floors[0].front + 0.09], 0.014, 0.014, 0);
  barrel(s, 0.47, floors[0].front + 0.11);
  if (r.chance(0.5)) crate(s, 0.3, floors[0].front + 0.1, 0.12, 0.2);
  return finishBody(s, { door: s.point(doorX, 0, floors[0].front + 0.3), roof: s.point(0, ridgeY + 0.06, zc2), chimney: smoke, top: ridgeY + 0.45 });
};

// ───────────────────────── treehouse ─────────────────────────

/** An elegant dwelling in a living oak. The oak was not consulted. */
export const treehouse: BodyBuilder = look => {
  const s = new Sculpt(seedFor(look, 79)), r = s.rand;
  if (r.chance(0.5)) s.scale(-1, 1, 1);
  s.rotY(r.range(-0.1, 0.1));
  const bark = PAL.trunk, wood = mix(PAL.timberLight, PAL.thatch, 0.25), wall = r.pick([PAL.plaster, 0xdfe3d2, 0xe6dcc0]);
  const doorHex = r.pick([PAL.doorGreen, PAL.doorBlue, 0x7a6a9a, PAL.verdigris]);
  // roots and trunk
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r.range(-0.3, 0.3), c = Math.cos(a), sn = Math.sin(a);
    limb(s, 'trim', bark, [c * 0.16, 0.2, sn * 0.16], [c * 0.52, -0.02, sn * 0.52], 0.1, 0.045, 5);
  }
  s.cyl('trim', bark, 0, 0, 0, 0.34, 0.25, 0.3, 7, { facets: 0.08, cap: false });
  s.cyl('trim', bark, 0, 0.3, 0, 0.25, 0.21, 0.76, 7, { facets: 0.08, sx: 0.04, sz: -0.03 });
  const fork: V3 = [0.04, 1.0, -0.03];
  const tips: V3[] = [[-0.48, 1.86, -0.38], [0.5, 1.92, -0.3], [0.02, 2.22, -0.46], [-0.12, 2.3, 0.0]];
  tips.forEach((t, i) => {
    limb(s, 'trim', bark, fork, t, 0.13 - i * 0.012, 0.05, 6);
    // twigs: what shows when the leaves are down
    for (let k = 0; k < 3; k++) {
      const e: V3 = [t[0] + r.range(-0.26, 0.26), t[1] + r.range(0.12, 0.4), t[2] + r.range(-0.24, 0.24)];
      limb(s, 'trim', bark, t, e, 0.04, 0.012, 4);
    }
  });
  limb(s, 'trim', bark, [0.12, 0.8, 0.04], [0.68, 1.02, 0.36], 0.065, 0.03, 5);
  // the deck in the fork
  const dy = 1.02;
  s.block('trim', wood, -0.04, dy, -0.05, 1.05, 0.05, 0.9, { bottom: true });
  for (let i = 0; i < 5; i++) s.block('trim', PAL.timber, -0.52 + i * 0.24, dy + 0.045, -0.05, 0.012, 0.008, 0.9, { bottom: true, jit: 0 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.beam('trim', bark, [sx * 0.15, 0.6, sz * 0.12], [-0.04 + sx * 0.46, dy, -0.05 + sz * 0.38], 0.05, 0.05);
  // railing, with a gap where the ladder comes up
  const rz = 0.37, ry0 = dy + 0.05;
  for (const x of [-0.53, -0.22, 0.1, 0.45]) s.block('trim', wood, x, ry0, rz, 0.035, 0.2, 0.035, { bottom: true });
  s.beam('trim', wood, [-0.53, ry0 + 0.19, rz], [0.1, ry0 + 0.19, rz], 0.025, 0.03);
  for (const x of [-0.53, 0.45]) {
    s.block('trim', wood, x, ry0, -0.05, 0.035, 0.2, 0.035, { bottom: true });
    s.beam('trim', wood, [x, ry0 + 0.19, rz], [x, ry0 + 0.19, -0.3], 0.025, 0.03);
  }
  // the cabin
  const cxc = -0.05, czc = -0.1, cw = 0.72, cd = 0.58, cy = dy + 0.05, ch = 0.46, cf = czc + cd / 2, ctop = cy + ch;
  s.block('wall', wall, cxc, cy, czc, cw, ch, cd, { bottom: true });
  s.at(cxc, cy, cf, 0, () => frameFace(s, cw, ch, { posts: 2, hex: wood, t: 0.05 }));
  s.at(cxc, cy, czc - cd / 2, Math.PI, () => frameFace(s, cw, ch, { posts: 3, hex: wood, t: 0.05 }));
  for (const sg of [-1, 1]) {
    s.at(cxc + sg * cw / 2, cy, czc, sg * Math.PI / 2, () => frameFace(s, cd, ch, { posts: 2, hex: wood, t: 0.05 }));
    s.at(cxc + sg * cw / 2, ctop, czc, sg * Math.PI / 2, () => { gableFace(s, cd, 0.36, wall); frameGable(s, cd, 0.36, { hex: wood, t: 0.045, king: false }); });
  }
  s.at(cxc - 0.16, cy, cf, 0, () => door(s, { w: 0.2, h: 0.34, hex: doorHex, style: 'arch', frame: wood, step: false, knob: PAL.gold }));
  s.at(cxc + 0.17, cy + 0.26, cf, 0, () => win(s, { w: 0.13, h: 0.13, unit: 0, style: 'arch', frame: wood, shutters: null }));
  s.at(cxc + cw / 2, cy + 0.25, czc, Math.PI / 2, () => win(s, { w: 0.15, unit: 0, style: 'round', frame: wood }));
  s.at(cxc - cw / 2, cy + 0.25, czc, -Math.PI / 2, () => win(s, { w: 0.13, unit: 0, style: 'round', frame: wood }));
  let ridgeY = 0;
  s.at(cxc, 0, czc, 0, () => { ridgeY = gableRoof(s, { len: cw + 0.2, half: cd / 2, wallTop: ctop, rise: 0.36, ov: 0.1, kind: 'shingle' }); });
  for (const sg of [-1, 1]) s.beam('trim', wood, [cxc + sg * (cw / 2 + 0.08), ridgeY - 0.02, czc], [cxc + sg * (cw / 2 + 0.2), ridgeY + 0.13, czc], 0.025, 0.035);
  s.cyl('trim', PAL.brass, cxc + 0.2, ridgeY - 0.2, czc - 0.16, 0.028, 0.025, 0.34, 6, { capHex: PAL.soot });
  const smoke = s.point(cxc + 0.2, ridgeY + 0.16, czc - 0.16);
  // rope ladder
  const lx = 0.28, top: V3 = [lx, dy + 0.03, 0.41], foot: V3 = [lx + 0.02, 0, 0.62];
  for (const sg of [-1, 1]) s.beam('trim', ROPE, [top[0] + sg * 0.085, top[1], top[2]], [foot[0] + sg * 0.085, 0, foot[2]], 0.016, 0.016);
  for (let i = 0; i < 6; i++) {
    const t = (i + 0.6) / 6.4, y = top[1] * (1 - t), z = top[2] + (foot[2] - top[2]) * t, x = top[0] + (foot[0] - top[0]) * t;
    s.beam('trim', wood, [x - 0.1, y, z], [x + 0.1, y, z], 0.022, 0.02);
  }
  // lanterns in the branches
  lantern(s, 0.64, 0.99, 0.34, 0, 0.12);
  lantern(s, -0.53, ry0 + 0.31, rz, 0, 0);
  lantern(s, -0.4, 1.52, -0.3, 0, 0.1);
  // a swing? no: a bench at the foot for those who do not climb
  if (r.chance(0.5)) bench(s, -0.5, 0.52, 0.5, 0.28);
  else for (let i = 0; i < 3; i++) s.blob('trim', i ? 0xc9b8a0 : PAL.crimson, -0.5 + i * 0.07, 0.03 + (i ? 0 : 0.03), 0.5 + i * 0.05, 0.03, 0.03, 0.03, { detail: 0 });

  // the crown: its own mesh, so it can thin with the season and sway
  const pivot: V3 = [0, 1.8, -0.25];
  const crown: [number, number, number, number][] = [[-0.42, 1.98, -0.38, 0.4], [0.44, 2.02, -0.3, 0.39], [0.02, 2.3, -0.42, 0.42], [-0.05, 2.5, -0.1, 0.36], [-0.58, 1.72, 0.12, 0.23], [0.64, 1.3, 0.34, 0.2], [0.3, 2.35, 0.05, 0.25]];
  for (const [x, y, z, rad] of crown) s.blob('canopy', 0xf4f4f4, x, y, z, rad, rad * 0.82, rad, { detail: 1, lump: 0.14, facets: 0.16, jit: 0 });
  for (let i = 0; i < 16; i++) {
    const [x, y, z, rad] = crown[i % crown.length], a = r.range(0, Math.PI * 2), e = r.range(0.1, 1.3);
    s.blob('blossom', r.pick([0xf2c9d6, 0xf7e9ee, 0xe9a9c0]), x + Math.cos(a) * Math.cos(e) * rad * 0.95, y + Math.sin(e) * rad * 0.8, z + Math.sin(a) * Math.cos(e) * rad * 0.95, 0.05, 0.04, 0.05, { detail: 0, jit: 0.04 });
  }
  const P = s.point(pivot[0], pivot[1], pivot[2]);
  const canopyMesh = s.mesh('canopy', leafMat())!;
  canopyMesh.geometry.translate(-P.x, -P.y, -P.z); canopyMesh.position.copy(P);
  canopyMesh.geometry.computeBoundingSphere();
  const blossom = s.mesh('blossom', paintMat())!;
  blossom.geometry.translate(-P.x, -P.y, -P.z); blossom.castShadow = false;
  canopyMesh.add(blossom);
  const pos: number[] = [], push: number[] = [];
  snowShell(soupOf([canopyMesh], canopyMesh, 0.25), 0.09, pos, push);
  const cap = snowMesh(pos, push);
  if (cap) { cap.visible = false; canopyMesh.add(cap); }
  const phase = r.range(0, 6);
  let lastFull = -1;
  const animate = (env: Env) => {
    const f = canopy.fullness;
    if (f !== lastFull) { lastFull = f; canopyMesh.scale.setScalar(f); }
    blossom.visible = canopy.blossom > 0.35 && env.season === 'spring';
    if (cap) cap.visible = env.snow > 0.02;
    const w = 0.006 + env.wind * 0.02;
    canopyMesh.rotation.z = Math.sin(env.time * 0.9 + phase) * w;
    canopyMesh.rotation.x = Math.sin(env.time * 0.7 + phase * 1.7) * w * 0.7;
  };
  const body = finishBody(s, {
    door: s.point(foot[0], 0, foot[2] + 0.16), roof: s.point(cxc, ridgeY + 0.05, czc), chimney: smoke, top: 2.9,
    extras: [canopyMesh], animate,
  });
  body.group.userData.drifts = [{ x: 0, z: 0.3, nx: 0, nz: 1, len: 0.3 }, { x: -0.3, z: 0, nx: -1, nz: 0, len: 0.25 }];
  return body;
};

// ───────────────────────── wizard tower ─────────────────────────

let orbGeo: { crystal: THREE.BufferGeometry; moon: THREE.BufferGeometry; star: THREE.BufferGeometry } | null = null;
function orbGeos() {
  if (!orbGeo) {
    orbGeo = { crystal: new THREE.OctahedronGeometry(0.07, 0), moon: new THREE.IcosahedronGeometry(0.045, 0), star: new THREE.TetrahedronGeometry(0.045, 0) };
    for (const g of [orbGeo.crystal, orbGeo.moon, orbGeo.star]) g.userData.shared = true;
  }
  return orbGeo;
}

/** Tall, drafty, and zoned for experiments. */
export const wizardTower: BodyBuilder = look => {
  const s = new Sculpt(seedFor(look, 97)), r = s.rand;
  if (r.chance(0.5)) s.scale(-1, 1, 1);
  const stone = mix(PAL.stone, PAL.wizard, 0.2), stoneDk = mix(PAL.stoneDark, PAL.wizard, 0.28);
  const roofCols = [PAL.wizardRoof, 0x443a78, 0x33295c, 0x4a4384] as const;
  const bendA = r.range(-0.5, 0.5), bx = Math.cos(bendA), bz = Math.sin(bendA) * 0.5;
  const N = 8, PH = Math.PI / 8, APO = Math.cos(Math.PI / N);
  const levels = [{ y: 0.14, r: 0.5 }, { y: 0.75, r: 0.45 }, { y: 1.3, r: 0.41 }, { y: 1.76, r: 0.385 }];
  const off = (y: number) => { const t = Math.max(0, (y - 0.14) / 2.1); return 0.18 * t * t; };
  const radAt = (y: number) => {
    if (y >= 1.88) return 0.49;
    for (let i = 0; i < levels.length - 1; i++) if (y <= levels[i + 1].y) { const t = (y - levels[i].y) / (levels[i + 1].y - levels[i].y); return levels[i].r + (levels[i + 1].r - levels[i].r) * Math.max(0, t); }
    return 0.385;
  };
  /** run fn on the facet `i` at height y (facet 1 faces the street) */
  const onFacet = (y: number, i: number, fn: () => void, proud = 0.006) => {
    const th = PH + (i + 0.5) * (Math.PI * 2 / N), d = radAt(y) * APO + proud, o = off(y);
    s.at(bx * o + Math.cos(th) * d, y, bz * o + Math.sin(th) * d, Math.PI / 2 - th, fn);
  };
  s.cyl('wall', stoneDk, 0, 0, 0, 0.6, 0.55, 0.14, N, { phase: PH, facets: 0.05 });
  for (let i = 0; i < levels.length - 1; i++) {
    const a = levels[i], b = levels[i + 1], oa = off(a.y), ob = off(b.y);
    s.cyl('wall', stone, bx * oa, a.y, bz * oa, a.r, b.r, b.y - a.y, N, { phase: PH, facets: 0.09, sx: bx * (ob - oa), sz: bz * (ob - oa), cap: false });
    s.cyl('wall', stoneDk, bx * ob, b.y - 0.03, bz * ob, b.r + 0.028, b.r + 0.028, 0.06, N, { phase: PH, facets: 0.04, bottom: true });
    // a few stones a different age from their neighbours
    for (let k = 0; k < 5; k++) {
      const y = r.range(a.y + 0.06, b.y - 0.12), f = r.int(0, N - 1);
      onFacet(y, f, () => { const w = r.range(0.1, 0.17), x = r.range(-0.08, 0.08); s.quad('wall', r.pick([PAL.stoneDark, PAL.stoneWarm, stoneDk, PAL.rock]), [x - w / 2, 0, 0], [x + w / 2, 0, 0], [x + w / 2, 0.075, -0.004], [x - w / 2, 0.075, -0.004], 0.05); }, 0.008);
    }
  }
  // the corbel and the study on top
  const oc = off(1.76), os = off(2.24);
  s.cyl('wall', stoneDk, bx * oc, 1.76, bz * oc, 0.385, 0.5, 0.12, N, { phase: PH, facets: 0.05, cap: false });
  s.cyl('wall', mix(stone, PAL.plaster, 0.25), bx * off(1.88), 1.88, bz * off(1.88), 0.5, 0.48, 0.36, N, { phase: PH, facets: 0.07, sx: bx * (os - off(1.88)), sz: bz * (os - off(1.88)) });
  // door and steps
  onFacet(0.14, 1, () => {
    s.block('wall', stoneDk, 0, 0, -0.06, 0.44, 0.6, 0.12, { tw: 0.36 });
    door(s, { w: 0.27, h: 0.46, style: 'arch', hex: r.pick([PAL.wizardRoof, PAL.doorBlue, 0x5a2f6a]), frame: PAL.stoneWarm, knob: PAL.gold, step: false });
  }, 0.02);
  s.block('trim', PAL.stone, 0, 0, 0.6, 0.52, 0.07, 0.24);
  s.block('trim', PAL.stoneWarm, 0, 0.07, 0.55, 0.4, 0.07, 0.14, { bottom: true });
  // slits winding up, and the study's windows
  onFacet(0.98, 0, () => win(s, { style: 'slit', w: 0.05, h: 0.2, unit: 0, frame: stoneDk }));
  onFacet(1.22, 2, () => win(s, { style: 'slit', w: 0.05, h: 0.2, unit: 0, frame: stoneDk }));
  onFacet(1.5, 7, () => win(s, { style: 'slit', w: 0.05, h: 0.18, unit: 0, frame: stoneDk }));
  onFacet(1.1, 5, () => win(s, { style: 'slit', w: 0.05, h: 0.2, unit: 0, frame: stoneDk }));
  onFacet(2.05, 1, () => win(s, { style: 'arch', w: 0.17, h: 0.14, unit: 0, frame: PAL.wizard, shutters: null }));
  // someone is always up: this one burns by day as well, while there is a tenant to burn it
  onFacet(2.05, 1, () => { s.quad('lamp', PAL.windowLit, [-0.085, -0.07, 0.016], [0.085, -0.07, 0.016], [0.085, 0.07, 0.016], [-0.085, 0.07, 0.016], 0); s.tri('lamp', PAL.windowLit, [-0.085, 0.07, 0.016], [0.085, 0.07, 0.016], [0, 0.146, 0.016], 0); });
  onFacet(2.07, 7, () => win(s, { style: 'round', w: 0.15, unit: 0, frame: PAL.wizard }));
  onFacet(2.07, 3, () => win(s, { style: 'round', w: 0.15, unit: 0, frame: PAL.wizard }));
  onFacet(2.05, 5, () => win(s, { style: 'arch', w: 0.15, h: 0.13, unit: 0, frame: PAL.wizard, shutters: null }));
  // a brass telescope out of the corner facet
  onFacet(2.1, 0, () => s.at(0, 0, -0.05, 0, () => { s.cyl('trim', PAL.brass, 0, 0, 0, 0.032, 0.04, 0.3, 6, { capHex: PAL.window }); s.cyl('trim', PAL.goldDark, 0, 0.1, 0, 0.045, 0.045, 0.03, 6, { cap: false }); }, 0.95));
  // the hat
  const tipX = bx * 0.17 + r.range(-0.04, 0.04), tipZ = bz * 0.17, rx = bx * os, rz = bz * os;
  const tipY = coneRoof(s, rx, 2.22, rz, 0.56, 0.82, N, 'slate', { colors: roofCols, bands: 4, tipX, tipZ, flare: 0.14 });
  s.beam('trim', PAL.goldDark, [rx + tipX, tipY - 0.03, rz + tipZ], [rx + tipX, tipY + 0.1, rz + tipZ], 0.014, 0.014, 0);
  s.blob('trim', PAL.gold, rx + tipX, tipY + 0.12, rz + tipZ, 0.04, 0.04, 0.04, { detail: 0, jit: 0 });
  // a chimney that left the roof at an angle and never came back
  const ca = Math.PI * 1.15, cpx = rx + Math.cos(ca) * 0.36, cpz = rz + Math.sin(ca) * 0.36;
  s.cyl('trim', stoneDk, cpx, 2.38, cpz, 0.055, 0.048, 0.2, 6, { sx: Math.cos(ca) * 0.05, sz: Math.sin(ca) * 0.05, cap: false });
  s.cyl('trim', stoneDk, cpx + Math.cos(ca) * 0.05, 2.58, cpz + Math.sin(ca) * 0.05, 0.048, 0.045, 0.16, 6, { sx: -Math.cos(ca) * 0.02, capHex: PAL.soot });
  const smoke = s.point(cpx + Math.cos(ca) * 0.03, 2.76, cpz + Math.sin(ca) * 0.05);
  // things left at the foot of a wizard's stair
  for (let i = 0; i < 3; i++) {
    const a = 0.55 + i * 0.22, d = 0.7 + (i % 2) * 0.06, x = Math.cos(a) * d, z = Math.sin(a) * d, h = 0.05 + i * 0.02;
    s.cyl('trim', 0xe6dcc0, x, 0, z, 0.018, 0.014, h, 5, { cap: false });
    s.cone('trim', i === 1 ? PAL.magic : PAL.crimson, x, h - 0.005, z, 0.045 + i * 0.008, 0.035, 6, { bottom: true });
  }
  crate(s, -0.55, 0.52, 0.13, 0.3);
  s.block('trim', PAL.lapis, -0.55, 0.142, 0.52, 0.09, 0.022, 0.07, { ry: 0.5, bottom: true });
  s.block('trim', PAL.crimson, -0.55, 0.164, 0.52, 0.08, 0.02, 0.065, { ry: 0.1, bottom: true });

  // what orbits it
  const g = orbGeos();
  const glow = mat(PAL.magic, { emissive: PAL.magic, emissiveIntensity: 0.9, flat: true });
  const gilt = mat(PAL.gold, { emissive: PAL.gold, emissiveIntensity: 0.45 });
  const orbit = new THREE.Group(); orbit.name = 'orbit';
  orbit.position.copy(s.point(rx, 2.0, rz));
  const crystal = new THREE.Mesh(g.crystal, glow), moon = new THREE.Mesh(g.moon, gilt), star = new THREE.Mesh(g.star, glow);
  orbit.add(crystal, moon, star);
  const ph = r.range(0, 6), dirn = r.sign();
  const animate = (env: Env) => {
    const t = env.time * dirn;
    const a1 = t * 0.7 + ph; crystal.position.set(Math.cos(a1) * 0.64, Math.sin(a1 * 2 + 1) * 0.07 + 0.05, Math.sin(a1) * 0.64); crystal.rotation.y = t * 2.1; crystal.rotation.x = 0.4;
    const a2 = -t * 1.15 + ph * 2; moon.position.set(Math.cos(a2) * 0.5, Math.sin(a2) * 0.22 - 0.3, Math.sin(a2) * 0.5);
    const a3 = t * 0.45 + ph * 3; star.position.set(Math.cos(a3) * 0.56, 0.62 + Math.sin(a3 * 3) * 0.05, Math.sin(a3) * 0.56); star.rotation.set(t * 1.3, t * 1.7, 0);
  };
  const lamp = s.mesh('lamp', mat(PAL.windowLit, { emissive: PAL.windowLit, emissiveIntensity: 0.85 }))!;
  lamp.castShadow = false; lamp.userData.lifeUnit = 0;
  return finishBody(s, {
    door: s.point(0, 0, 0.94), roof: s.point(rx + tipX, tipY + 0.16, rz + tipZ), chimney: smoke, top: tipY + 0.22,
    extras: [orbit, lamp], animate,
  });
};

// ───────────────────────── the fallback ─────────────────────────

/** A plain, decent building for any type nobody has drawn yet: plaster, timber, thatch, sized to its footprint. */
export const genericBody: BodyBuilder = look => {
  const s = new Sculpt(seedFor(look, 5)), r = s.rand;
  const W = Math.max(0.5, look.w - 0.5), D = Math.max(0.46, look.h - 0.6), small = Math.min(look.w, look.h) < 2;
  const base = small ? 0.05 : 0.08, H = small ? 0.42 : 0.6, top = base + H, zc = -0.04, front = zc + D / 2, rise = Math.min(0.7, D * 0.55), ov = small ? 0.08 : 0.14;
  const plaster = r.pick(PLASTER_HEX);
  s.block('wall', PAL.stone, 0, 0, zc, W + 0.05, base + 0.01, D + 0.05);
  s.block('wall', plaster, 0, base, zc, W, H, D);
  const posts = Math.max(2, Math.round(W / 0.45) + 1);
  s.at(0, base, front, 0, () => frameFace(s, W, H, { posts, sill: false }));
  s.at(0, base, zc - D / 2, Math.PI, () => frameFace(s, W, H, { posts, sill: false, brace: 'cross' }));
  for (const sg of [-1, 1]) {
    s.at(sg * W / 2, base, zc, sg * Math.PI / 2, () => frameFace(s, D, H, { posts: 2, sill: false, brace: small ? 'none' : 'corner' }));
    s.at(sg * W / 2, top, zc, sg * Math.PI / 2, () => { gableFace(s, D, rise, plaster); frameGable(s, D, rise); });
  }
  const doorX = W > 0.9 ? -W * 0.2 : 0, dh = Math.min(0.48, H - 0.04);
  s.at(doorX, base, front, 0, () => door(s, { w: Math.min(0.28, W * 0.5), h: dh, hex: r.pick(DOOR_HEX), step: false }));
  if (W > 0.9) s.at(W * 0.24, base + H * 0.58, front, 0, () => win(s, { w: 0.18, h: 0.18, unit: 0, shutters: null }));
  let ridgeY = 0;
  s.at(0, 0, zc, 0, () => { ridgeY = gableRoof(s, { len: W + ov * 1.5, half: D / 2, wallTop: top, rise, ov, kind: 'thatch', sag: 0.015 }); });
  const smoke = small ? null : chimney(s, W * 0.28, ridgeY - 0.25, zc - D * 0.15, ridgeY + 0.22, { w: 0.18, d: 0.18 });
  return finishBody(s, { door: s.point(doorX, 0, Math.min(look.h / 2 - 0.05, front + 0.28)), roof: s.point(0, ridgeY + 0.06, zc), chimney: smoke, top: ridgeY + (small ? 0.12 : 0.38) });
};
