/**
 * The ruler's seat (3×3), by level: 1 the Reeve's hut, 2 a manor, 3 a keep.
 * Where you sit, and where they come to complain. The door anchor is where
 * petitioners wait: the porch, the yard gate, the foot of the gatehouse.
 */
import * as THREE from 'three';
import type { Env } from '../api';
import type { BodyBuilder } from './types';
import { PAL, mix } from '../palette';
import {
  Sculpt, gableRoof, coneRoof, gableFace, frameFace, frameGable, stones, ashlar, door, win, chimney,
  bucket, barrel, fence, woodpile, crate, bench, groundPatch, finishBody, makeCloth, flutter, slope, ROOF,
  type V3, type RoofStyle,
} from './parts';
import { seedFor, dormer, pyramidRoof, lantern, lining } from './housing';

const STONES = [PAL.stone, PAL.stoneWarm, PAL.stoneDark, PAL.rock, 0xa39d90] as const;
const BUSH = 0x5b8a45;

/** a banner pole with a flying cloth; returns the cloth so `animate` can wave it */
function bannerPole(s: Sculpt, x: number, y: number, z: number, h: number, mirrored: boolean, o: { w?: number; ch?: number; swallow?: boolean; toward?: number } = {}): THREE.Mesh {
  s.cyl('trim', PAL.timberLight, x, y, z, 0.03, 0.02, h, 6);
  s.blob('trim', PAL.gold, x, y + h + 0.03, z, 0.04, 0.04, 0.04, { detail: 0, jit: 0 });
  const cloth = makeCloth(o.w ?? 0.46, o.ch ?? 0.3, PAL.crimson, { device: PAL.gold, swallow: o.swallow });
  cloth.position.copy(s.point(x, y + h - 0.03, z));
  // fly toward the middle of the plot so the cloth never leaves the footprint
  const toward = o.toward ?? -1;
  cloth.rotation.y = (toward < 0) !== mirrored ? Math.PI : 0;
  return cloth;
}

/** a hanging wall banner: a long crimson strip with a gold lozenge and a swallowtail */
function wallBanner(s: Sculpt, x: number, yTop: number, z: number, w: number, len: number): void {
  const h = w / 2;
  s.block('trim', PAL.timber, x, yTop, z + 0.012, w + 0.06, 0.025, 0.03, { bottom: true });
  s.quad('trim', PAL.crimson, [x - h, yTop - len, z + 0.012], [x + h, yTop - len, z + 0.012], [x + h, yTop, z + 0.012], [x - h, yTop, z + 0.012], 0.02);
  s.tri('trim', PAL.crimson, [x - h, yTop - len - h * 0.9, z + 0.012], [x, yTop - len, z + 0.012], [x - h, yTop - len, z + 0.012], 0.02);
  s.tri('trim', PAL.crimson, [x + h, yTop - len - h * 0.9, z + 0.012], [x + h, yTop - len, z + 0.012], [x, yTop - len, z + 0.012], 0.02);
  const cy = yTop - len * 0.42, d = h * 0.6;
  s.quad('trim', PAL.gold, [x, cy - d * 1.3, z + 0.016], [x + d, cy, z + 0.016], [x, cy + d * 1.3, z + 0.016], [x - d, cy, z + 0.016], 0);
}

/** crenellations round a rectangle: a low parapet and merlons, on top of y */
function battlements(s: Sculpt, cx: number, y: number, cz: number, w: number, d: number, hex: number, o: { every?: number; mh?: number; skipBack?: boolean } = {}): void {
  const every = o.every ?? 0.3, mh = o.mh ?? 0.17, t = 0.1, low = 0.07;
  const run = (len: number, place: (u: number, m: boolean) => void) => {
    const n = Math.max(2, Math.round(len / every));
    for (let i = 0; i <= n; i++) place(-len / 2 + (len * i) / n, true);
    place(0, false);
  };
  for (const sg of [-1, 1]) {
    if (o.skipBack && sg < 0) continue;
    run(w, (u, m) => m ? s.block('wall', hex, cx + u, y, cz + sg * (d / 2 - t / 2), 0.15, mh, t, { bottom: true }) : s.block('wall', hex, cx, y, cz + sg * (d / 2 - t / 2), w, low, t * 0.8, { bottom: true }));
  }
  for (const sg of [-1, 1]) {
    run(d - 0.3, (u, m) => m ? s.block('wall', hex, cx + sg * (w / 2 - t / 2), y, cz + u, t, mh, 0.15, { bottom: true }) : s.block('wall', hex, cx + sg * (w / 2 - t / 2), y, cz, t * 0.8, low, d, { bottom: true }));
  }
}

// ───────────────────────── level 1: the Reeve's hut ─────────────────────────

const hut: BodyBuilder = look => {
  const s = new Sculpt(seedFor(look, 131)), r = s.rand;
  const mirrored = r.chance(0.5);
  if (mirrored) s.scale(-1, 1, 1);
  s.rotY(r.range(-0.02, 0.02));
  const zc = -0.25, W = 2.0, D = 1.3, base = 0.1, H = 0.72, top = base + H, front = zc + D / 2, back = zc - D / 2;
  const plaster = PAL.plaster, rise = 0.74, ov = 0.18;

  s.block('wall', PAL.stone, 0, 0, zc, W + 0.08, base + 0.012, D + 0.08);
  for (const [x, z, ry, w] of [[0, front + 0.04, 0, W], [0, back - 0.04, Math.PI, W], [W / 2 + 0.04, zc, Math.PI / 2, D], [-W / 2 - 0.04, zc, -Math.PI / 2, D]] as const) {
    s.at(x, 0, z, ry, () => stones(s, w, base, 7, STONES));
  }
  s.block('wall', plaster, 0, base, zc, W, H, D);
  s.at(0, base, front, 0, () => frameFace(s, W, H, { posts: 6, sill: false }));
  s.at(0, base, back, Math.PI, () => frameFace(s, W, H, { posts: 6, sill: false, rails: [0.5], brace: 'cross' }));
  for (const sg of [-1, 1]) {
    s.at(sg * W / 2, base, zc, sg * Math.PI / 2, () => frameFace(s, D, H, { posts: 4, sill: false, brace: 'corner' }));
    s.at(sg * W / 2, top, zc, sg * Math.PI / 2, () => { gableFace(s, D, rise, plaster); frameGable(s, D, rise, { collar: true }); });
  }
  s.at(-W / 2, top + 0.26, zc, -Math.PI / 2, () => win(s, { style: 'round', w: 0.15 }));
  // door under a porch with the Reeve's badge on it
  s.at(0, base, front, 0, () => door(s, { w: 0.32, h: 0.54, hex: PAL.doorRed, style: 'banded', step: false }));
  s.block('trim', PAL.stoneWarm, 0, 0, front + 0.22, 0.62, base, 0.44);
  for (const sg of [-1, 1]) s.block('trim', PAL.timber, sg * 0.27, base, front + 0.4, 0.06, 0.58, 0.06, { sx: r.range(-0.01, 0.01) });
  s.beam('trim', PAL.timber, [-0.31, 0.7, front + 0.4], [0.31, 0.7, front + 0.4], 0.06, 0.06);
  s.at(0, 0, front + 0.2, Math.PI / 2, () => gableRoof(s, { len: 0.58, half: 0.31, wallTop: 0.7, rise: 0.22, ov: 0.07, kind: 'thatch' }));
  s.at(0, 0.72, front + 0.43, 0, () => {
    gableFace(s, 0.62, 0.21, plaster);
    s.quad('trim', PAL.crimson, [-0.055, 0.035, 0.008], [0.055, 0.035, 0.008], [0.055, 0.13, 0.008], [-0.055, 0.13, 0.008], 0);
    s.tri('trim', PAL.crimson, [-0.055, 0.035, 0.008], [0, -0.01, 0.008], [0.055, 0.035, 0.008], 0);
    s.quad('trim', PAL.gold, [0, 0.045, 0.012], [0.03, 0.08, 0.012], [0, 0.115, 0.012], [-0.03, 0.08, 0.012], 0);
  });
  // windows either side
  for (const sg of [-1, 1]) s.at(sg * 0.77, base + 0.4, front, 0, () => win(s, { w: 0.2, h: 0.22, shutters: PAL.crimson, box: sg < 0 ? PAL.timberLight : null }));
  s.at(-0.4, base + 0.42, back, Math.PI, () => win(s, { w: 0.18, h: 0.18, shutters: null }));
  s.at(0.5, base + 0.42, back, Math.PI, () => win(s, { w: 0.18, h: 0.18, shutters: null }));
  // thatch with two dormers
  let ridgeY = 0;
  s.at(0, 0, zc, 0, () => { ridgeY = gableRoof(s, { len: W + 0.26, half: D / 2, wallTop: top, rise, ov, kind: 'thatch', sag: 0.025 }); });
  const eaveZ = D / 2 + ov, drop = rise * (1 + ov / (D / 2));
  for (const sg of [-1, 1]) dormer(s, sg * 0.62, zc, ridgeY, eaveZ, drop, plaster, 'thatch');
  // chimney up the gable
  const cx = W / 2 + 0.1;
  s.block('trim', PAL.stone, cx, 0, zc, 0.22, 0.6, 0.5, { td: 0.3 });
  const smoke = chimney(s, cx, 0.6, zc, ridgeY + 0.32, { w: 0.22, d: 0.3, lean: r.range(-0.015, 0.015) });
  // the woodshed leaning on the other end
  const lx = -W / 2 - 0.14;
  s.block('wall', PAL.timberLight, lx, 0, zc - 0.1, 0.26, 0.46, 0.8);
  slope(s, [-W / 2, 0.82, zc - 0.56], [-W / 2, 0.82, zc + 0.36], [-W / 2 - 0.33, 0.44, zc - 0.56], [-W / 2 - 0.33, 0.44, zc + 0.36], ROOF.shingle as RoofStyle);
  s.at(lx, 0, zc + 0.301, 0, () => s.quad('trim', PAL.soot, [-0.1, 0.02, 0], [0.1, 0.02, 0], [0.1, 0.38, 0], [-0.1, 0.38, 0], 0));
  woodpile(s, lx, zc + 0.45, 0);
  // the bench where the Reeve hears grievances, weather permitting
  bench(s, 0.44, front + 0.1, 0, 0.4);
  barrel(s, 0.86, front + 0.14);
  // yard: a path, a fence, the banner
  groundPatch(s, 0, front + 0.72, 0.26, 0.32, PAL.dirt, 0.006, 8);
  fence(s, -1.3, 0.98, -0.42, 1.0, { h: 0.2, pickets: true });
  fence(s, -1.3, 0.98, -1.3, 0.45, { h: 0.2, pickets: true });
  bucket(s, -0.6, front + 0.22);
  const cloth = bannerPole(s, 1.08, 0, 0.92, 1.85, mirrored);
  s.blob('trim', PAL.rock, 1.08, 0, 0.92, 0.08, 0.05, 0.08, { detail: 0, floor: 0 });
  const ph = r.range(0, 6);
  return finishBody(s, {
    door: s.point(0, 0, front + 0.78), roof: s.point(-0.2, ridgeY + 0.07, zc), chimney: smoke, top: 1.98,
    extras: [cloth], animate: (env: Env) => flutter(cloth, env.time, env.wind, ph),
  });
};

// ───────────────────────── level 2: the manor ─────────────────────────

const manor: BodyBuilder = look => {
  const s = new Sculpt(seedFor(look, 149)), r = s.rand;
  const mirrored = r.chance(0.5);
  if (mirrored) s.scale(-1, 1, 1);
  s.rotY(r.range(-0.008, 0.008));
  const plaster = r.pick([PAL.plaster, PAL.plasterWarm, 0xe6d3ae]);
  const g = 0.56, u = 0.5, wallTop = g + u;
  const brickCols = [mix(PAL.brick, PAL.soot, 0.25), PAL.tileDark, 0xa9664a] as const;

  // ── the hall, across the back ──
  const hz = -0.75, HW = 2.4, HD = 0.9, hf = hz + HD / 2, hb = hz - HD / 2;
  s.block('wall', PAL.stoneWarm, 0, 0, hz, HW, g, HD);
  s.at(0, 0, hf, 0, () => stones(s, HW, g, 16, STONES));
  s.at(0, 0, hb, Math.PI, () => stones(s, HW, g, 16, STONES));
  s.block('wall', plaster, 0, g, hz, HW + 0.04, u, HD + 0.04, { bottom: true });
  s.block('trim', PAL.timber, 0, g - 0.035, hz, HW + 0.07, 0.07, HD + 0.07, { bottom: true });
  s.at(0, g, hf + 0.02, 0, () => frameFace(s, HW + 0.04, u, { posts: 9, sill: false, brace: 'corner' }));
  s.at(0, g, hb - 0.02, Math.PI, () => frameFace(s, HW + 0.04, u, { posts: 9, sill: false, brace: 'cross' }));
  let hallRidge = 0;
  s.at(0, 0, hz, 0, () => { hallRidge = gableRoof(s, { len: HW + 0.12, half: HD / 2 + 0.02, wallTop, rise: 0.56, ov: 0.1, kind: 'tile' }); });
  for (const sg of [-1, 1]) {
    s.at(sg * (HW / 2 + 0.02), g, hz, sg * Math.PI / 2, () => frameFace(s, HD + 0.04, u, { posts: 3, sill: false, brace: 'corner' }));
    s.at(sg * (HW / 2 + 0.02), wallTop, hz, sg * Math.PI / 2, () => { gableFace(s, HD + 0.04, 0.56, plaster); frameGable(s, HD + 0.04, 0.56, { collar: true }); });
    s.at(sg * HW / 2, 0, hz, sg * Math.PI / 2, () => stones(s, HD, g, 6, STONES));
  }
  // hall door in the courtyard, under a little tiled hood
  const doorX = -0.12;
  s.at(doorX, 0.06, hf, 0, () => door(s, { w: 0.32, h: 0.5, hex: r.pick([PAL.doorRed, PAL.doorGreen, PAL.doorBlue]), style: 'banded', step: false }));
  s.block('trim', PAL.stone, doorX, 0, hf + 0.14, 0.56, 0.03, 0.28);
  s.block('trim', PAL.stoneWarm, doorX, 0.03, hf + 0.09, 0.46, 0.03, 0.18, { bottom: true });
  slope(s, [doorX - 0.28, 0.78, hf + 0.02], [doorX + 0.28, 0.78, hf + 0.02], [doorX - 0.28, 0.66, hf + 0.26], [doorX + 0.28, 0.66, hf + 0.26], ROOF.tile as RoofStyle, { rows: 2 });
  for (const sg of [-1, 1]) s.beam('trim', PAL.timber, [doorX + sg * 0.24, 0.5, hf + 0.02], [doorX + sg * 0.24, 0.66, hf + 0.22], 0.04, 0.04);
  s.at(0.18, g + 0.26, hf + 0.02, 0, () => win(s, { w: 0.2, h: 0.2, shutters: null }));
  s.at(-0.4, g + 0.26, hf + 0.02, 0, () => win(s, { w: 0.2, h: 0.2, shutters: null }));
  for (const x of [-0.85, -0.25, 0.4, 0.95]) s.at(x, g + 0.26, hb - 0.02, Math.PI, () => win(s, { w: 0.18, h: 0.2, shutters: null }));
  for (const x of [-0.7, 0.6]) s.at(x, 0.3, hb, Math.PI, () => win(s, { w: 0.16, h: 0.18, shutters: null, frame: PAL.stoneDark }));

  // ── the east wing: a gabled cross-wing reaching toward the street ──
  const ex = 0.8, EW = 0.9, ezf = 0.5, ezb = -1.2, ED = ezf - ezb, ez = (ezf + ezb) / 2;
  s.block('wall', PAL.stoneWarm, ex, 0, ez, EW, g, ED);
  s.at(ex, 0, ezf, 0, () => stones(s, EW, g, 7, STONES));
  s.at(ex + EW / 2, 0, ez, Math.PI / 2, () => stones(s, ED, g, 12, STONES));
  s.block('wall', plaster, ex, g, ez + 0.03, EW + 0.06, u, ED + 0.06, { bottom: true });
  s.block('trim', PAL.timber, ex, g - 0.035, ez + 0.03, EW + 0.09, 0.07, ED + 0.09, { bottom: true });
  const ef = ezf + 0.06;
  s.at(ex, g, ef, 0, () => frameFace(s, EW + 0.06, u, { posts: 4, sill: false, brace: 'corner' }));
  s.at(ex + EW / 2 + 0.03, g, ez + 0.03, Math.PI / 2, () => frameFace(s, ED + 0.06, u, { posts: 6, sill: false, brace: 'chevron' }));
  s.at(ex - EW / 2 - 0.03, g, ez + 0.5, -Math.PI / 2, () => frameFace(s, 0.8, u, { posts: 3, sill: false }));
  let wingRidge = 0;
  s.at(ex, 0, ez + 0.03, Math.PI / 2, () => { wingRidge = gableRoof(s, { len: ED + 0.2, half: EW / 2 + 0.03, wallTop, rise: 0.66, ov: 0.09, kind: 'tile' }); });
  s.at(ex, wallTop, ef, 0, () => { gableFace(s, EW + 0.06, 0.66, plaster); frameGable(s, EW + 0.06, 0.66, { collar: true }); });
  s.at(ex, wallTop, ezb - 0.03, Math.PI, () => { gableFace(s, EW + 0.06, 0.66, plaster); frameGable(s, EW + 0.06, 0.66); });
  // an oriel on the gable: the lord's chamber
  s.block('wall', plaster, ex, g + 0.08, ef + 0.05, 0.5, 0.36, 0.1, { bottom: true });
  s.block('trim', PAL.timber, ex, g + 0.03, ef + 0.04, 0.54, 0.05, 0.12, { bottom: true, tw: 0.4 });
  for (const sg of [-1, 1]) s.at(ex + sg * 0.11, g + 0.27, ef + 0.1, 0, () => win(s, { w: 0.15, h: 0.2, shutters: null, sill: false }));
  slope(s, [ex - 0.27, g + 0.56, ef], [ex + 0.27, g + 0.56, ef], [ex - 0.29, g + 0.43, ef + 0.14], [ex + 0.29, g + 0.43, ef + 0.14], ROOF.tile as RoofStyle, { rows: 2 });
  s.at(ex, wallTop + 0.26, ef, 0, () => win(s, { style: 'round', w: 0.13 }));
  s.at(ex, 0.3, ezf, 0, () => win(s, { w: 0.22, h: 0.22, style: 'arch', frame: PAL.stoneDark, shutters: null }));
  for (const z of [-0.75, -0.15]) s.at(ex + EW / 2 + 0.03, g + 0.26, z, Math.PI / 2, () => win(s, { w: 0.17, h: 0.2, shutters: null }));
  s.at(ex + EW / 2, 0.3, -0.4, Math.PI / 2, () => win(s, { w: 0.16, h: 0.18, shutters: null, frame: PAL.stoneDark }));

  // ── the west wing: kitchens and stable, lower, all stone ──
  const wx = -0.925, WW = 0.65, wzf = 0.15, WD = wzf - ezb, wz = (wzf + ezb) / 2, wh = 0.8;
  s.block('wall', PAL.stone, wx, 0, wz, WW, wh, WD);
  s.at(wx, 0, wzf, 0, () => stones(s, WW, wh, 8, STONES));
  s.at(wx - WW / 2, 0, wz, -Math.PI / 2, () => stones(s, WD, wh, 14, STONES));
  s.at(wx + WW / 2, 0, wz + 0.45, Math.PI / 2, () => stones(s, 0.45, wh, 4, STONES));
  s.at(wx, 0, wz, Math.PI / 2, () => gableRoof(s, { len: WD + 0.16, half: WW / 2, wallTop: wh, rise: 0.46, ov: 0.09, kind: 'tile' }));
  s.at(wx, wh, wzf, 0, () => gableFace(s, WW, 0.46, PAL.stone));
  s.at(wx, wh, ezb, Math.PI, () => gableFace(s, WW, 0.46, PAL.stone));
  // the stable door: wide, arched, two leaves
  s.at(wx, 0, wzf, 0, () => {
    s.block('trim', PAL.stoneDark, 0, 0, 0.012, 0.5, 0.56, 0.04, { tw: 0.36 });
    for (const sg of [-1, 1]) s.block('trim', PAL.door, sg * 0.1, 0, 0.03, 0.19, 0.46, 0.03);
    for (const sg of [-1, 1]) s.beam('trim', PAL.iron, [sg * 0.02, 0.36, 0.05], [sg * 0.18, 0.36, 0.05], 0.012, 0.03, 0);
    s.block('trim', PAL.soot, 0, 0.6, 0.004, 0.14, 0.12, 0.01, { bottom: true, jit: 0 });
  });
  s.at(wx - WW / 2, 0.42, wz, -Math.PI / 2, () => win(s, { w: 0.16, h: 0.18, shutters: null, frame: PAL.stoneDark }));

  // ── chimneys ──
  const smoke = chimney(s, -0.5, hallRidge - 0.3, hz - 0.14, hallRidge + 0.4, { w: 0.2, d: 0.2, hex: PAL.brick, colors: brickCols });
  chimney(s, 0.2, hallRidge - 0.3, hz - 0.14, hallRidge + 0.34, { w: 0.2, d: 0.2, hex: PAL.brick, colors: brickCols });
  chimney(s, ex + 0.2, wingRidge - 0.35, -0.3, wingRidge + 0.3, { w: 0.2, d: 0.22, hex: PAL.brick, colors: brickCols });
  chimney(s, wx - 0.1, 1.0, wz - 0.2, 1.52, { w: 0.18, d: 0.2, hex: PAL.stone, pot: false });
  // weathervane on the hall
  s.beam('trim', PAL.iron, [-0.95, hallRidge, hz], [-0.95, hallRidge + 0.3, hz], 0.014, 0.014, 0);
  s.beam('trim', PAL.goldDark, [-1.07, hallRidge + 0.27, hz], [-0.83, hallRidge + 0.27, hz], 0.014, 0.02, 0);
  s.tri('trim', PAL.gold, [-0.83, hallRidge + 0.32, hz], [-0.83, hallRidge + 0.22, hz], [-0.75, hallRidge + 0.27, hz], 0);
  s.tri('trim', PAL.gold, [-0.83, hallRidge + 0.32, hz], [-0.75, hallRidge + 0.27, hz], [-0.83, hallRidge + 0.22, hz], 0);

  // ── the yard ──
  groundPatch(s, -0.12, 0.3, 0.46, 0.62, PAL.cobble, 0.006, 10);
  for (let i = 0; i < 12; i++) groundPatch(s, -0.12 + r.range(-0.36, 0.36), 0.3 + r.range(-0.52, 0.52), 0.05, 0.045, r.pick([PAL.stone, PAL.stoneDark, PAL.rock]), 0.009, 6);
  const wall = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(-(z1 - z0), x1 - x0);
    s.at((x0 + x1) / 2, 0, (z0 + z1) / 2, ry, () => {
      s.block('trim', PAL.stone, 0, 0, 0, len, 0.22, 0.1);
      s.block('trim', PAL.stoneDark, 0, 0.22, 0, len + 0.02, 0.03, 0.13, { bottom: true });
      s.at(0, 0, 0.05, 0, () => stones(s, len, 0.22, Math.round(len * 6), STONES, 'trim'));
    });
  };
  const gateL = -0.36, gateR = 0.12, yz = 0.98;
  wall(-1.28, yz, gateL, yz); wall(gateR, yz, 1.28, yz); wall(-1.28, yz, -1.28, wzf + 0.05); wall(1.28, yz, 1.28, ezf + 0.1);
  for (const x of [gateL, gateR]) {
    s.block('trim', PAL.stoneWarm, x, 0, yz, 0.16, 0.42, 0.16);
    s.block('trim', PAL.stoneDark, x, 0.42, yz, 0.2, 0.035, 0.2, { bottom: true });
    s.blob('trim', PAL.stone, x, 0.5, yz, 0.055, 0.055, 0.055, { detail: 1, jit: 0.02 });
  }
  // clipped bushes, a bed of flowers, the usual barrels
  for (const [x, z] of [[0.55, 0.74], [1.05, 0.74]] as const) {
    s.cyl('trim', PAL.timberLight, x, 0, z, 0.07, 0.085, 0.09, 7);
    s.blob('trim', BUSH, x, 0.24, z, 0.11, 0.15, 0.11, { detail: 1, lump: 0.08, facets: 0.1 });
  }
  groundPatch(s, -0.85, 0.6, 0.3, 0.2, PAL.dirtDark, 0.007, 8);
  for (let i = 0; i < 8; i++) {
    const x = -0.85 + r.range(-0.24, 0.24), z = 0.6 + r.range(-0.14, 0.14);
    s.blob('trim', 0x4f7a3a, x, 0.04, z, 0.04, 0.045, 0.04, { detail: 0, lump: 0.15 });
    s.blob('trim', r.pick([PAL.crimson, PAL.gold, 0xe9e2d0, 0xd77a9a]), x, 0.085, z, 0.025, 0.022, 0.025, { detail: 0, jit: 0.04 });
  }
  barrel(s, 0.24, hf + 0.14); crate(s, 0.22, hf + 0.36, 0.13, 0.3);
  bench(s, -0.47, 0.05, Math.PI / 2, 0.36);
  lantern(s, doorX + 0.3, 0.6, hf + 0.08, 0, 0.04);
  // the banner on the lord's gable
  const cloth = bannerPole(s, ex, wingRidge - 0.02, ef - 0.06, 0.6, mirrored, { w: 0.42, ch: 0.28 });
  const ph = r.range(0, 6);
  return finishBody(s, {
    door: s.point((gateL + gateR) / 2, 0, yz + 0.24), roof: s.point(-0.2, hallRidge + 0.06, hz), chimney: smoke, top: wingRidge + 0.7,
    extras: [cloth], animate: (env: Env) => flutter(cloth, env.time, env.wind, ph),
  });
};

// ───────────────────────── level 3: the keep ─────────────────────────

const keep: BodyBuilder = look => {
  const s = new Sculpt(seedFor(look, 167)), r = s.rand;
  const mirrored = r.chance(0.5);
  if (mirrored) s.scale(-1, 1, 1);
  const kx = -0.14, kz = -0.22, KW = 1.86, KD = 1.86, KH = 1.7, PL = 0.5;
  const front = kz + KD / 2, back = kz - KD / 2;

  // ── the great tower ──
  s.block('wall', PAL.stoneDark, kx, 0, kz, KW + 0.16, PL, KD + 0.16, { tw: KW, td: KD });
  s.block('wall', PAL.rockDark, kx, PL, kz, KW, KH - PL, KD);
  lining(s, kx - KW / 2, kx + KW / 2, back, front, 0.01, KH - 0.01, mix(PAL.stoneWarm, PAL.plasterGrey, 0.3), 0.05);
  const faces: [number, number, number, number][] = [[kx, front, 0, KW], [kx, back, Math.PI, KW], [kx + KW / 2, kz, Math.PI / 2, KD], [kx - KW / 2, kz, -Math.PI / 2, KD]];
  for (const [x, z, ry, w] of faces) {
    s.at(x, PL, z, ry, () => ashlar(s, w - 0.02, KH - PL, { colors: STONES, rowH: 0.2, minW: 0.24, maxW: 0.46, gap: 0.016 }));
    s.at(x, 0, z, ry, () => s.at(0, 0, 0.08, 0, () => stones(s, w, PL - 0.06, 10, STONES), -0.16));
  }
  // corbel table, battlements, and the leads
  s.block('wall', PAL.stoneWarm, kx, KH, kz, KW + 0.1, 0.1, KD + 0.1, { bottom: true });
  for (let i = 0; i < 9; i++) s.block('trim', PAL.stoneDark, kx - KW / 2 + 0.08 + i * ((KW - 0.16) / 8), KH - 0.07, front + 0.03, 0.07, 0.07, 0.06, { bottom: true });
  const deck = KH + 0.1;
  battlements(s, kx, deck, kz, KW + 0.1, KD + 0.1, PAL.stone);
  s.block('roof', PAL.slateDark, kx, deck, kz, KW - 0.1, 0.02, KD - 0.1, { bottom: true, jit: 0.02 });
  // the cap-house and the great banner
  const chx = kx - 0.36, chz = kz - 0.34;
  s.block('wall', PAL.stone, chx, deck, chz, 0.72, 0.42, 0.72, { bottom: true });
  s.at(chx, deck, chz + 0.36, 0, () => { ashlar(s, 0.7, 0.42, { colors: STONES, rowH: 0.14, minW: 0.18, maxW: 0.3 }); s.at(0.1, 0.22, 0.01, 0, () => win(s, { w: 0.13, h: 0.14, style: 'arch', frame: PAL.stoneWarm, shutters: null })); });
  s.at(chx + 0.36, deck, chz, Math.PI / 2, () => { ashlar(s, 0.7, 0.42, { colors: STONES, rowH: 0.14, minW: 0.18, maxW: 0.3 }); s.at(-0.1, 0, 0.01, 0, () => door(s, { w: 0.2, h: 0.32, hex: PAL.door, style: 'banded', frame: PAL.stoneDark, step: false })); });
  pyramidRoof(s, chx, deck + 0.42, chz, 0.43, 0.38, 'slate');
  const capTop = deck + 0.8;
  const banner = bannerPole(s, chx, capTop - 0.03, chz, 0.5, mirrored, { w: 0.5, ch: 0.32, toward: 1 });
  // a chimney on the back parapet, for the great hall's fire
  const smoke = chimney(s, kx + 0.55, deck, back + 0.22, deck + 0.62, { w: 0.24, d: 0.24, pot: false, taper: 0.88 });

  // ── windows: slits low, arches high ──
  for (const [x, z, ry, w] of faces) {
    if (ry === 0) continue; // the front wall belongs to the gatehouse, the banners and the turret
    for (const u of [-0.22, 0.22]) {
      s.at(x, 1.34, z, ry, () => s.at(u * w, 0, 0.012, 0, () => win(s, { w: 0.15, h: 0.18, style: 'arch', frame: PAL.stoneWarm, shutters: null })));
      s.at(x, 0.84, z, ry, () => s.at(u * w * 0.8, 0, 0.012, 0, () => win(s, { w: 0.05, h: 0.2, style: 'slit', frame: PAL.stoneDark })));
    }
  }
  // ── the corner turret ──
  const tx = kx + KW / 2, tz = front, TR = 0.36, TN = 10;
  s.cyl('wall', PAL.stoneDark, tx, 0, tz, TR + 0.06, TR, PL, TN, { facets: 0.06, cap: false });
  s.cyl('wall', PAL.stone, tx, PL, tz, TR, TR, 1.72, TN, { facets: 0.1, cap: false });
  for (let k = 0; k < 12; k++) {
    const a = r.range(-0.6, Math.PI * 1.1), y = r.range(0.6, 2.05), d = TR * Math.cos(Math.PI / TN) + 0.012;
    const th = (Math.round(a / (Math.PI * 2 / TN)) + 0.5) * (Math.PI * 2 / TN);
    s.at(tx + Math.cos(th) * d, y, tz + Math.sin(th) * d, Math.PI / 2 - th, () => { const w = r.range(0.1, 0.17); s.quad('wall', r.pick(STONES), [-w / 2, 0, 0], [w / 2, 0, 0], [w / 2, 0.08, 0], [-w / 2, 0.08, 0], 0.05); });
  }
  s.cyl('wall', PAL.stoneWarm, tx, 2.22, tz, TR, TR + 0.08, 0.1, TN, { facets: 0.05, cap: false });
  s.cyl('wall', PAL.stone, tx, 2.32, tz, TR + 0.08, TR + 0.08, 0.18, TN, { facets: 0.07 });
  const onTurret = (y: number, th: number, fn: () => void, rad = TR) => {
    const q = (Math.round(th / (Math.PI * 2 / TN) - 0.5) + 0.5) * (Math.PI * 2 / TN), d = rad * Math.cos(Math.PI / TN) + 0.008;
    s.at(tx + Math.cos(q) * d, y, tz + Math.sin(q) * d, Math.PI / 2 - q, fn);
  };
  onTurret(1.0, Math.PI * 0.5, () => win(s, { w: 0.05, h: 0.2, style: 'slit', frame: PAL.stoneDark }));
  onTurret(1.5, Math.PI * 0.1, () => win(s, { w: 0.05, h: 0.2, style: 'slit', frame: PAL.stoneDark }));
  onTurret(1.95, Math.PI * 0.5, () => win(s, { w: 0.13, h: 0.14, style: 'arch', frame: PAL.stoneWarm, shutters: null }));
  onTurret(1.95, -Math.PI * 0.1, () => win(s, { w: 0.13, h: 0.14, style: 'arch', frame: PAL.stoneWarm, shutters: null }));
  const tipY = coneRoof(s, tx, 2.48, tz, 0.47, 0.68, TN, 'slate', { bands: 4, flare: 0.1 });
  const pennant = bannerPole(s, tx, tipY - 0.04, tz, 0.3, mirrored, { w: 0.3, ch: 0.15, swallow: true });

  // ── the gatehouse ──
  const gx = -0.3, GW = 0.84, GD = 0.39, GH = 1.02, gf = front + GD;
  s.block('wall', PAL.stoneWarm, gx, 0, front + GD / 2, GW, GH, GD);
  s.at(gx, 0, gf, 0, () => ashlar(s, GW - 0.02, GH, { colors: STONES, rowH: 0.17, minW: 0.2, maxW: 0.36 }));
  for (const sg of [-1, 1]) s.at(gx + sg * GW / 2, 0, front + GD / 2, sg * Math.PI / 2, () => ashlar(s, GD - 0.02, GH, { colors: STONES, rowH: 0.17, minW: 0.14, maxW: 0.22 }));
  battlements(s, gx, GH, front + GD / 2, GW + 0.04, GD + 0.04, PAL.stone, { every: 0.26, mh: 0.14, skipBack: true });
  s.block('roof', PAL.slateDark, gx, GH, front + GD / 2, GW - 0.14, 0.015, GD - 0.1, { bottom: true, jit: 0.02 });
  s.at(gx, 0, gf + 0.012, 0, () => {
    // the arch, the dark behind it, and a portcullis drawn most of the way up
    const aw = 0.2, ah = 0.42;
    s.quad('trim', PAL.soot, [-aw, 0, 0], [aw, 0, 0], [aw, ah, 0], [-aw, ah, 0], 0);
    s.poly('trim', PAL.soot, [[-aw, ah, 0], [aw, ah, 0], [aw * 0.72, ah + 0.11, 0], [0, ah + 0.16, 0], [-aw * 0.72, ah + 0.11, 0]], 0);
    for (let i = 0; i < 7; i++) {
      const a0 = Math.PI * (i / 7), a1 = Math.PI * ((i + 1) / 7), R0 = 1, R1 = 1.32;
      const P = (a: number, k: number): V3 => [Math.cos(a) * aw * k, ah + Math.sin(a) * 0.16 * k + (k > 1 ? 0.02 : 0), 0.004];
      s.quad('trim', i % 2 ? PAL.stone : PAL.stoneDark, P(a1, R1), P(a1, R0), P(a0, R0), P(a0, R1), 0.04);
    }
    for (const x of [-0.13, -0.045, 0.045, 0.13]) { s.block('trim', PAL.iron, x, 0.3, 0.012, 0.018, 0.27, 0.014, { bottom: true, jit: 0 }); s.block('trim', PAL.iron, x, 0.255, 0.012, 0.003, 0.045, 0.003, { tw: 0.018, td: 0.014, bottom: true, jit: 0 }); }
    for (const y of [0.36, 0.47]) s.block('trim', PAL.iron, 0, y, 0.014, 0.36, 0.016, 0.012, { bottom: true, jit: 0 });
  });
  // torches either side of the gate (they light with the windows)
  for (const sg of [-1, 1]) {
    const x = gx + sg * 0.32;
    s.beam('trim', PAL.iron, [x, 0.5, gf + 0.01], [x, 0.56, gf + 0.08], 0.016, 0.016, 0);
    s.cyl('trim', PAL.timber, x, 0.54, gf + 0.08, 0.016, 0.022, 0.09, 5);
    s.blob('glass0', PAL.window, x, 0.67, gf + 0.08, 0.03, 0.045, 0.03, { detail: 0, jit: 0 });
  }
  s.block('trim', PAL.stone, gx, 0, gf + 0.1, 0.52, 0.035, 0.2);
  // banners down the wall above the gate, a window between
  wallBanner(s, gx - 0.3, 1.62, front, 0.2, 0.42);
  wallBanner(s, gx + 0.3, 1.62, front, 0.2, 0.42);
  s.at(gx, 1.36, front + 0.012, 0, () => win(s, { w: 0.16, h: 0.2, style: 'arch', frame: PAL.stoneWarm, shutters: null }));

  // ── the bailey's leavings ──
  barrel(s, kx - KW / 2 - 0.05, front + 0.14); barrel(s, kx - KW / 2 + 0.14, front + 0.2);
  crate(s, kx - KW / 2 + 0.02, front + 0.36, 0.13, 0.4);
  // a rack of spears by the gate
  s.at(0.2, 0, gf - 0.1, 0, () => {
    s.beam('trim', PAL.timber, [-0.1, 0.3, 0], [0.1, 0.3, 0], 0.02, 0.025);
    for (const x of [-0.1, 0.1]) s.block('trim', PAL.timber, x, 0, 0, 0.025, 0.32, 0.025);
    for (const x of [-0.05, 0, 0.05]) { s.beam('trim', PAL.timberLight, [x, 0, 0.03], [x * 1.2, 0.62, -0.01], 0.012, 0.012); s.cone('trim', PAL.iron, x * 1.2, 0.62, -0.01, 0.014, 0.06, 4, { jit: 0 }); }
  });

  const p1 = r.range(0, 6), p2 = r.range(0, 6);
  return finishBody(s, {
    door: s.point(gx, 0, gf + 0.3), roof: s.point(kx + 0.35, deck + 0.04, kz + 0.25), chimney: smoke, top: tipY + 0.4,
    extras: [banner, pennant], animate: (env: Env) => { flutter(banner, env.time, env.wind, p1); flutter(pennant, env.time, env.wind, p2); },
  });
};

/** The seat by level: 1 the Reeve's hut, 2 a manor, 3 a keep (anything higher stays a keep). */
export const seat: BodyBuilder = (look, ctx) => (look.level >= 3 ? keep : look.level === 2 ? manor : hut)(look, ctx);
export const SEAT_LEVELS: readonly BodyBuilder[] = [hut, manor, keep];
