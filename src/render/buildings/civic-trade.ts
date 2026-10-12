/**
 * OWNER: render-civic. Bodies for the trade premises: market stall, bakery,
 * smithy, windmill, apothecary, tavern. Local space: footprint centred on the
 * origin, door on +z, ground at y = 0, about 0.15 margin inside the footprint.
 */
import * as THREE from 'three';
import { PAL, mat, tint } from '../palette';
import type { BodyBuilder } from './types';
import type { Env } from '../api';
import {
  Kit, GEO, C, pick, wallP, roofP, winP, barrel, crate, sack, logs, bench, valance, flowers,
  tavernSignAtlas, tavernCell, roofCourses, glowPool,
} from './civic-parts';

const PI = Math.PI;

/** a little iron bracket sticking out of a wall along +z, ending at (x, y, z1 + len) */
function bracket(K: Kit, x: number, y: number, zWall: number, len: number): void {
  K.box(PAL.iron, 0.018, 0.018, len, x, y, zWall + len / 2);
  K.beam(PAL.iron, x, y - 0.13, zWall, x, y - 0.01, zWall + len * 0.7, 0.012);
  K.ring(PAL.iron, 0.025, 0.006, x, y + 0.025, zWall + len - 0.01, [PI / 2, PI / 2, 0], 8);
}

/** a swinging part on the kit: returns nothing; the group swings about x with the wind */
function swingX(K: Kit, g: THREE.Object3D, base: number, gust: number, freq: number): void {
  const ph = K.r() * 10;
  K.anim((env: Env) => { g.rotation.x = Math.sin(env.time * freq + ph) * (base + env.wind * gust) + Math.sin(env.time * freq * 2.7 + ph) * env.wind * gust * 0.25; });
}

// ───────────── market stall (2x1) ─────────────

export const marketStall: BodyBuilder = (look) => {
  const K = Kit.of(look), r = K.r;
  const awn = pick(r, [PAL.crimson, PAL.lapis, PAL.clothOchre, PAL.verdigris, PAL.clothPlum]);
  const cream = PAL.clothCream;
  const goods = look.variant % 3;
  const wood = tint(PAL.timberLight, look.variant, 0.05);
  const T = PAL.timber;

  K.slab(PAL.dirt, 1.62, 0.012, 0.66, 0, 0, 0);
  const fx = 0.76, fz = 0.25, bz = -0.28, hf = 0.98, hb = 1.14;
  for (const sx of [-1, 1]) {
    K.beam(T, sx * fx, 0, fz, sx * fx + K.j(0.012), hf, fz, 0.05);
    K.beam(T, sx * fx, 0, bz, sx * fx, hb, bz, 0.05);
    K.beam(T, sx * fx, hb - 0.02, bz, sx * fx, hf - 0.02, fz, 0.04);
  }
  K.box(T, 1.6, 0.045, 0.045, 0, hf - 0.02, fz);
  K.box(T, 1.6, 0.045, 0.045, 0, hb - 0.02, bz);

  // the striped awning, high enough that the goods show beneath it, with a pennant valance
  const n = 7, W = 1.72, sw = W / n, k = (hb - hf) / (fz - bz), ang = Math.atan(k);
  const za = bz - 0.07, zb2 = fz + 0.15, ya = hb + 0.012 - (za - bz) * k, yb = hb + 0.012 - (zb2 - bz) * k;
  const len = Math.hypot(zb2 - za, ya - yb);
  for (let i = 0; i < n; i++) K.box(roofP(i % 2 ? cream : awn), sw + 0.002, 0.022, len, -W / 2 + sw * (i + 0.5), (ya + yb) / 2, (za + zb2) / 2, [ang, 0, 0]);
  valance(K, -W / 2, W / 2, yb - 0.01, zb2 + 0.004, [awn, awn, cream, cream], 14, 0.065);
  // back cloth
  K.box(awn, 1.48, 0.56, 0.015, 0, 0.8, bz - 0.01);
  K.box(T, 1.5, 0.03, 0.03, 0, 0.52, bz - 0.01);

  // counter
  const cz = 0.2;
  K.slab(wallP(wood), 1.5, 0.27, 0.035, 0, 0, cz);
  for (let i = 1; i < 6; i++) K.box(T, 0.008, 0.25, 0.006, -0.75 + i * 0.25, 0.135, cz + 0.02);
  for (const sx of [-1, 1]) K.slab(wallP(wood), 0.035, 0.27, 0.3, sx * 0.735, 0, cz - 0.15);
  K.slab(T, 1.58, 0.03, 0.27, 0, 0.27, cz - 0.1);
  const top = 0.3;

  if (goods === 0) {
    // apples, pears and a basket of cabbages
    crate(K, -0.48, top, 0.08, 0.3, 0.07, 0.2, 0.06);
    for (let i = 0; i < 11; i++) K.ball(i % 4 === 0 ? C.appleGreen : C.apple, 0.034, -0.48 + K.j(0.11), top + 0.08 + (i > 6 ? 0.03 : 0), 0.08 + K.j(0.07), 0);
    crate(K, -0.12, top, 0.08, 0.28, 0.07, 0.2, -0.05);
    for (let i = 0; i < 9; i++) K.blob(C.pear, 0.06, 0.075, 0.06, -0.12 + K.j(0.1), top + 0.085 + (i > 5 ? 0.025 : 0), 0.08 + K.j(0.06));
    K.cylT(C.wattleLight, 0.1, 0.075, 0.08, 0.3, top + 0.04, 0.06, 9);
    K.ring(C.wattle, 0.1, 0.012, 0.3, top + 0.08, 0.06, 0, 9);
    for (let i = 0; i < 3; i++) K.ball(C.cabbage, 0.05, 0.3 + K.j(0.04), top + 0.1, 0.06 + K.j(0.04), 0, 0.85);
    crate(K, -0.62, 0, -0.1, 0.24, 0.16, 0.2, 0.25);
    for (let i = 0; i < 5; i++) { K.ball(C.turnip, 0.032, -0.62 + K.j(0.08), 0.18, -0.1 + K.j(0.06)); K.cone(C.turnipTop, 0.02, 0.05, -0.62 + K.j(0.08), 0.22, -0.1 + K.j(0.06), 4); }
  } else if (goods === 1) {
    // cheeses: a stack of wheels, a broached wheel, wedges, a wax round
    for (let k = 0; k < 3; k++) {
      const wx = -0.5 + K.j(0.01), y = top + 0.03 + k * 0.057;
      K.cyl(C.rind, 0.085, 0.055, wx, y, 0.07, 11);
      K.cyl(C.cheese, 0.077, 0.004, wx, y + 0.028, 0.07, 11);
    }
    K.slab(T, 0.26, 0.015, 0.2, -0.12, top, 0.07);
    K.add(C.rind, GEO.cylArc(11, 0, PI), 0.2, 0.06, 0.2, -0.12, top + 0.045, 0.07, 0.4);
    K.box(C.cheese, 0.2, 0.06, 0.004, -0.12, top + 0.045, 0.07, 0.4);
    for (const [wx, wz, ry] of [[0.14, 0.12, 0.3], [0.24, 0.04, -0.6], [0.36, 0.12, 1.1]] as const) {
      K.add(C.cheese, GEO.tri(), 0.045, 0.1, 0.07, wx, top + 0.022, wz, [0, ry, -PI / 2]);
    }
    K.ball(C.wax, 0.05, 0.5, top + 0.04, 0.08, 1, 0.75);
    K.ball(C.wax, 0.04, 0.58, top + 0.035, 0.0, 1, 0.75);
    K.box(PAL.parchment, 0.06, 0.04, 0.004, 0.5, top + 0.1, 0.14, [0, 0, 0.1]);
    crate(K, -0.62, 0, -0.1, 0.24, 0.14, 0.2, 0.25);
    for (let i = 0; i < 2; i++) K.cyl(C.rind, 0.08, 0.05, -0.62, 0.17 + i * 0.052, -0.1, 11);
  } else {
    // fish laid on a tilted tray of ice, and one big one hung up by the tail
    K.box(T, 1.0, 0.03, 0.25, -0.1, top + 0.04, 0.07, [0.28, 0, 0]);
    for (let i = 0; i < 18; i++) K.box(C.ice, 0.04, 0.02, 0.04, -0.1 + K.j(0.47), top + 0.065 + K.j(0.005), 0.07 + K.j(0.1), [0.28, K.j(1), 0]);
    for (let i = 0; i < 7; i++) {
      const fxx = -0.52 + i * 0.13, rr = K.j(0.25);
      K.blob(i % 3 === 1 ? C.fishDark : C.fish, 0.05, 0.03, 0.17, fxx, top + 0.075, 0.07, [0.28, rr, 0]);
      K.cone(C.fishDark, 0.03, 0.05, fxx - Math.sin(rr) * 0.1, top + 0.098, 0.07 - Math.cos(rr) * 0.1 + 0.005, 4, [-PI / 2 + 0.28, rr, 0]);
      K.ball(PAL.ink, 0.008, fxx + Math.sin(rr) * 0.06 + 0.018, top + 0.072, 0.07 + Math.cos(rr) * 0.06 - 0.01);
    }
    K.rod(PAL.iron, -0.62, hf - 0.03, fz, -0.62, hf - 0.1, fz, 0.006);
    K.blob(C.fish, 0.07, 0.24, 0.05, -0.62, hf - 0.24, fz, [0, 0, 0.05]);
    K.cone(C.fishDark, 0.045, 0.06, -0.62, hf - 0.1, fz, 4, [0, PI / 2, 0]);
    barrel(K, -0.62, 0, -0.08, 0.9, false, 0, PAL.timber);
    for (let i = 0; i < 4; i++) K.blob(C.fishDark, 0.03, 0.1, 0.03, -0.62 + K.j(0.03), 0.2, -0.08 + K.j(0.03), [K.j(0.4), 0, K.j(0.4)]);
  }
  // the stallholder's stool and a spare crate
  K.cyl(T, 0.06, 0.025, 0.05, 0.2, -0.12, 8);
  for (let i = 0; i < 3; i++) { const a = i * 2.1; K.beam(T, 0.05 + Math.sin(a) * 0.05, 0, -0.12 + Math.cos(a) * 0.05, 0.05 + Math.sin(a) * 0.03, 0.19, -0.12 + Math.cos(a) * 0.03, 0.015); }
  crate(K, 0.6, 0, -0.12, 0.22, 0.16, 0.18, -0.2);
  crate(K, 0.6, 0.16, -0.12, 0.18, 0.12, 0.15, 0.15);

  // hanging scale, on a longer chain now the beam is higher
  const S = K.sub();
  S.rod(PAL.iron, 0, 0, 0, 0, -0.2, 0, 0.006);
  S.box(PAL.brass, 0.2, 0.012, 0.012, 0, -0.2, 0);
  S.cone(PAL.brass, 0.012, 0.03, 0, -0.18, 0, 4);
  for (const sx of [-0.09, 0.09]) { S.rod(PAL.iron, sx, -0.2, 0, sx, -0.28, 0, 0.004, 3); S.cyl(PAL.brass, 0.04, 0.012, sx, -0.286, 0, 8); }
  const sg = K.attach(S.build(), 0.5, hf - 0.04, fz);
  const ph = r() * 6;
  K.anim(env => { sg.rotation.z = Math.sin(env.time * 1.3 + ph) * (0.03 + env.wind * 0.14); sg.rotation.x = Math.sin(env.time * 0.9 + ph * 2) * (0.02 + env.wind * 0.08); });

  K.door.set(0, 0, 0.5);
  K.perch.set(0, hb + 0.04, -0.26);
  K.winPts.push(new THREE.Vector3(0, 0.42, -0.06));
  return K.finish();
};

// ───────────── bakery (2x2) ─────────────

/** a pretzel drawn as one rope: belly, two arms, a twist */
function pretzelGeo(): THREE.BufferGeometry {
  return GEO.tube('pretzel', [
    [-0.36, -0.22, 0], [-0.16, 0.0, 0.02], [0.02, 0.18, 0.05], [0.14, 0.33, 0.03], [0.28, 0.43, 0], [0.43, 0.36, 0], [0.5, 0.14, 0],
    [0.43, -0.14, 0], [0.24, -0.35, 0], [0, -0.42, 0], [-0.24, -0.35, 0], [-0.43, -0.14, 0], [-0.5, 0.14, 0], [-0.43, 0.36, 0],
    [-0.28, 0.43, 0], [-0.14, 0.33, -0.03], [-0.02, 0.18, -0.05], [0.16, 0.0, -0.02], [0.36, -0.22, 0],
  ], 0.075, false, 64);
}

export const bakery: BodyBuilder = (look) => {
  const K = Kit.of(look), r = K.r;
  const plaster = tint(pick(r, [PAL.plaster, PAL.plasterWarm, PAL.plaster]), look.variant, 0.04);
  const doorC = pick(r, [PAL.doorRed, PAL.doorGreen, PAL.doorBlue, PAL.door]);
  const roofC = pick(r, [PAL.tile, PAL.tileDark, PAL.tile]);
  const T = PAL.timber, t = 0.06;
  const x0 = -0.36, x1 = 0.78, z0 = -0.6, z1 = 0.48, H = 0.84;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0;

  K.slab(PAL.stoneDark, W + 0.06, 0.08, D + 0.06, cx, 0, cz);
  K.slab(wallP(plaster), W, H, D, cx, 0, cz);
  for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]] as const) K.box(T, t, H, t, px, H / 2, pz);
  K.box(T, W + t, t, t, cx, 0.1, z1 + 0.006);
  K.box(T, W + t, t, t, cx, H - t / 2, z1 + 0.006);
  K.box(T, W + t, t, t, cx, H - t / 2, z0 - 0.006);
  K.box(T, t, t, D, x0 - 0.006, H - t / 2, cz);
  K.box(T, t, t, D, x1 + 0.006, H - t / 2, cz);
  K.box(T, t * 0.8, t * 0.8, D, x1 + 0.008, 0.46, cz);
  K.beam(T, x1 + 0.008, 0.1, z1 - 0.04, x1 + 0.008, 0.46, cz + 0.12, 0.045);
  K.beam(T, x1 + 0.008, 0.46, cz - 0.1, x1 + 0.008, H - 0.04, z0 + 0.06, 0.045);
  K.box(T, 0.045, H - 0.12, 0.03, 0.3, H / 2 + 0.02, z1 + 0.008);
  K.beam(T, x0 + 0.04, 0.12, z1 + 0.008, x0 + 0.2, 0.62, z1 + 0.008, 0.045, 0.03);

  // the back: sill beam, a stud, a brace, a shuttered window and a small one
  K.box(T, W + t, t, t, cx, 0.1, z0 - 0.006);
  K.box(T, 0.045, H - 0.12, 0.03, 0.12, H / 2 + 0.02, z0 - 0.008);
  K.beam(T, x1 - 0.04, 0.12, z0 - 0.008, x1 - 0.22, 0.62, z0 - 0.008, 0.045, 0.03);
  K.beam(T, x0 + 0.04, 0.12, z0 - 0.008, x0 + 0.2, 0.62, z0 - 0.008, 0.045, 0.03);
  K.window({ x: 0.45, y: 0.5, z: z0, w: 0.2, h: 0.18, face: 'b', shutters: doorC, mull: 'cross' });
  K.window({ x: -0.06, y: 0.52, z: z0, w: 0.13, h: 0.15, face: 'b', mull: 'v' });
  // roof
  const ro = { x: cx, y: H, z: cz, span: D, len: W, rise: 0.56, t: 0.07, over: 0.14, ends: 0.1, axis: 'x' as const };
  const rf = K.gable(roofP(roofC), ro);
  roofCourses(K, roofP(roofC), { ...ro, n: 3 });
  K.box(roofP(PAL.tileDark), W + 0.22, 0.06, 0.06, cx, rf.ridge - 0.012, cz, [PI / 4, 0, 0]);
  for (const gx of [x0 + 0.025, x1 - 0.025]) K.tri(wallP(plaster), D, 0.56, 0.05, gx, H, cz);
  K.box(T, 0.03, 0.5, 0.05, x1 + 0.004, H + 0.25, cz);
  K.beam(T, x1 + 0.004, H + 0.02, z1 - 0.05, x1 + 0.004, H + 0.45, cz, 0.04);
  K.beam(T, x1 + 0.004, H + 0.02, z0 + 0.05, x1 + 0.004, H + 0.45, cz, 0.04);
  K.window({ x: x1, y: H + 0.2, z: cz, w: 0.13, h: 0.14, face: 'r', shutters: doorC, mull: 'v' });

  // front: door, open shop window with folded-down counter, loaves
  K.doorway({ x: 0.52, z: z1, w: 0.28, h: 0.5, color: doorC });
  const wx = -0.12;
  K.window({ x: wx, y: 0.5, z: z1, w: 0.44, h: 0.28, mull: 'v', sill: false });
  K.box(PAL.timberLight, 0.5, 0.03, 0.17, wx, 0.345, z1 + 0.09);
  for (const sx of [-0.2, 0.2]) K.beam(T, wx + sx, 0.24, z1 + 0.01, wx + sx, 0.335, z1 + 0.15, 0.022);
  K.box(PAL.timberLight, 0.5, 0.025, 0.17, wx, 0.685, z1 + 0.075, [-0.42, 0, 0]);
  for (const sx of [-0.22, 0.22]) K.rod(T, wx + sx, 0.36, z1 + 0.15, wx + sx, 0.7, z1 + 0.15, 0.007);
  K.blob(C.bread, 0.15, 0.06, 0.07, wx - 0.12, 0.39, z1 + 0.09, 0.15);
  for (let i = 0; i < 3; i++) K.box(C.flour, 0.008, 0.012, 0.05, wx - 0.17 + i * 0.05, 0.418, z1 + 0.09, 0.6);
  K.blob(C.crust, 0.1, 0.075, 0.1, wx + 0.04, 0.395, z1 + 0.09);
  K.box(C.flour, 0.05, 0.01, 0.01, wx + 0.04, 0.433, z1 + 0.09, 0.7);
  K.blob(C.bread, 0.08, 0.055, 0.08, wx + 0.15, 0.388, z1 + 0.1);
  K.blob(C.bread, 0.07, 0.05, 0.07, wx + 0.18, 0.39, z1 + 0.04);

  // the oven: a brick dome bulging from the side, and its chimney
  const ox = x0 - 0.2, oz = -0.1;
  K.cyl(PAL.stoneDark, 0.32, 0.12, ox, 0.06, oz, 10);
  K.dome(wallP(PAL.brick), 0.3, 0.42, ox, 0.12, oz);
  K.ring(PAL.stoneDark, 0.3, 0.025, ox, 0.13, oz, 0, 12);
  K.box(PAL.iron, 0.11, 0.1, 0.03, ox - 0.04, 0.24, oz + 0.25, -0.25);
  K.ball(PAL.brass, 0.012, ox - 0.02, 0.24, oz + 0.27);
  const chx = ox + 0.03, chz = oz - 0.14;
  K.slab(PAL.brick, 0.2, 1.5, 0.2, chx, 0.3, chz);
  K.slab(PAL.stoneDark, 0.26, 0.045, 0.26, chx, 1.8, chz);
  K.cylT(PAL.tileDark, 0.045, 0.06, 0.09, chx, 1.89, chz, 7);
  K.chimney = new THREE.Vector3(chx, 1.95, chz);
  logs(K, ox - 0.02, 0, oz + 0.38, 3, 0.34, 0.034, 0.05);

  // flour sacks, a bread peel, a basket of rolls
  sack(K, 0.72, 0, z1 + 0.16, 1, 0.3, C.flour);
  sack(K, 0.75, 0, z1 + 0.0, 0.9, -0.4, C.sack);
  K.blob(C.flour, 0.16, 0.08, 0.1, 0.62, 0.04, z1 + 0.28, 0.9);
  K.beam(PAL.timberLight, x0 + 0.1, 0.02, z1 + 0.13, x0 + 0.13, 0.66, z1 + 0.03, 0.02);
  K.box(PAL.timberLight, 0.12, 0.15, 0.012, x0 + 0.1, 0.09, z1 + 0.13, [0.15, 0, 0]);
  K.cylT(C.wattleLight, 0.07, 0.055, 0.06, 0.25, 0.03, z1 + 0.2, 8);
  for (let i = 0; i < 4; i++) K.ball(C.bread, 0.03, 0.25 + K.j(0.03), 0.07, z1 + 0.2 + K.j(0.03));

  // the pretzel sign
  bracket(K, 0.24, 0.8, z1, 0.24);
  const P = K.sub();
  for (const sx of [-0.05, 0.05]) P.rod(PAL.iron, 0, 0, 0, sx, -0.06, 0, 0.004, 3);
  P.add(C.bread, pretzelGeo(), 0.24, 0.24, 0.24, 0, -0.175, 0);
  const pg = K.attach(P.build(), 0.24, 0.79, z1 + 0.22);
  swingX(K, pg, 0.04, 0.28, 1.1);

  K.perch.set(cx, rf.ridge + 0.02, cz);
  return K.finish();
};

// ───────────── smithy (2x2) ─────────────

/**
 * An open-fronted forge. A stone back wall carries a lean-to roof that rises
 * toward the street, so the hearth, the bellows and the tools show from the
 * front. The hearth stands just inside the open edge under a hood whose stack
 * goes up through the slates, so the forge reads from any side by its glow and
 * its chimney. The yard in front holds the anvil, the quench trough and the work
 * waiting.
 */
/** an iron horseshoe standing upright facing +z, gap down; `nails` adds the nail heads */
function horseshoe(K: Kit, x: number, y: number, z: number, size: number, nails = false): void {
  const arc = PI * 1.6, beta = (arc + (2 * PI - arc) / 2) - PI / 2;
  const m = new THREE.Matrix4().makeTranslation(x, y, z)
    .multiply(new THREE.Matrix4().makeRotationX(PI / 2))
    .multiply(new THREE.Matrix4().makeRotationY(beta))
    .multiply(new THREE.Matrix4().makeScale(size, size, size));
  K.addM(PAL.iron, GEO.torus(0.2, 12, 4, arc), m);
  if (nails) for (let i = 0; i < 6; i++) {
    const psi = 0.25 + i * (arc - 0.5) / 5 - beta;
    K.ball(0x6e6c68, size * 0.05, x + Math.cos(psi) * size * 0.5, y - Math.sin(psi) * size * 0.5, z + size * 0.07);
  }
}

export const smithy: BodyBuilder = (look) => {
  const K = Kit.of(look), r = K.r;
  const stone = tint(pick(r, [PAL.stone, PAL.stoneDark, PAL.stoneWarm]), look.variant, 0.04);
  const roofC = pick(r, [PAL.slate, PAL.slateDark, PAL.tileDark]);
  const T = PAL.timber, IRON = PAL.iron, STEEL = 0x6e6c68;
  // the shed: back wall at zb, front beam at zf, the roof climbing from Hb to Hf
  const zb = -0.72, zf = -0.1, Hb = 0.74, Hf = 1.06, xs = 0.78;
  const k = (Hf - Hb) / (zf - zb), roofY = (z: number) => Hb + (z - zb) * k;

  K.slab(PAL.dirt, 1.66, 0.012, 1.66, 0, 0, 0);
  K.slab(PAL.dirtDark, 1.58, 0.014, 0.7, 0, 0, -0.42);
  for (let i = 0; i < 10; i++) K.box(i % 3 ? C.ash : C.coal, 0.014 + r() * 0.016, 0.006, 0.014 + r() * 0.016, -0.25 + K.j(0.4), 0.014, 0.06 + K.j(0.22), r() * 3);

  // back wall and the left cheek, coursed stone
  K.slab(wallP(stone), 1.6, Hb, 0.12, 0, 0, zb);
  K.slab(PAL.stoneDark, 1.66, 0.06, 0.16, 0, 0, zb);
  const winX = 0.36;
  for (let i = 0; i < 18; i++) {
    const bx = -0.72 + (i % 9) * 0.18 + K.j(0.03), by = 0.12 + Math.floor(i / 9) * 0.28 + K.j(0.04);
    if (Math.abs(bx - winX) < 0.2 && by > 0.25) continue;
    K.box(i % 3 ? PAL.stoneDark : PAL.stoneWarm, 0.13 + K.j(0.03), 0.075, 0.012, bx, by, zb - 0.064);
  }
  K.window({ x: winX, y: 0.44, z: zb - 0.06, w: 0.15, h: 0.14, face: 'b', frame: T, shutters: T, mull: 'v' });
  // posts, front beam, rafters, braces
  for (const px of [-xs, 0.12, xs]) {
    K.slab(T, 0.07, Hf - 0.03, 0.07, px, 0, zf);
    K.blob(PAL.stone, 0.11, 0.05, 0.11, px, 0.012, zf, r() * 2);
  }
  K.box(T, 1.68, 0.07, 0.07, 0, Hf - 0.035, zf);
  K.beam(T, xs, Hf - 0.28, zf, xs, roofY(zb + 0.12) - 0.04, zb + 0.12, 0.04);
  for (const px of [-xs, xs]) K.beam(T, px, Hf - 0.06, zf, px - Math.sign(px) * 0.24, Hf - 0.3, zf, 0.04);
  for (let i = 0; i < 6; i++) {
    const x = -0.75 + i * 0.3;
    K.beam(T, x, roofY(zb) - 0.02, zb, x, roofY(zf + 0.06) - 0.02, zf + 0.06, 0.035, 0.05);
  }
  // the lean-to roof itself, with courses and a capping board at the high edge
  const ang = Math.atan(k), za = zb - 0.14, zz = zf + 0.1, len = Math.hypot(zz - za, (zz - za) * k);
  K.box(roofP(roofC), 1.8, 0.05, len, 0, (roofY(za) + roofY(zz)) / 2 + 0.025, (za + zz) / 2, [-ang, 0, 0]);
  const course = roofC === PAL.tileDark ? PAL.tile : PAL.slateDark;
  for (let i = 0; i < 4; i++) {
    const z = za + (i + 0.7) * (zz - za) / 4.4;
    K.box(roofP(course), 1.78, 0.014, 0.045, 0, roofY(z) + 0.056, z, [-ang, 0, 0]);
  }
  K.box(T, 1.84, 0.06, 0.05, 0, roofY(zz) + 0.04, zz + 0.01);

  // the hearth: a stone block at the roof's edge, coals on top, a glowing ash-mouth below
  const hx = -0.3, hz = -0.25, hw = 0.54, hd = 0.44, hh = 0.36;
  K.slab(wallP(stone), hw, hh, hd, hx, 0, hz);
  K.slab(PAL.stoneDark, hw + 0.04, 0.04, hd + 0.04, hx, hh, hz);
  K.slab(C.coal, hw - 0.12, 0.02, hd - 0.14, hx, hh + 0.03, hz);
  const ember = mat(C.ember, { emissive: PAL.fire, emissiveIntensity: 1.4, rough: 1 }, true);
  K.box(ember, hw - 0.2, 0.03, hd - 0.2, hx, hh + 0.05, hz);
  for (let i = 0; i < 9; i++) K.ball(i % 3 ? C.coal : C.ash, 0.028, hx + K.j(0.17), hh + 0.065, hz + K.j(0.12), 0, 0.7);
  K.box(C.shadow, 0.2, 0.12, 0.01, hx, 0.11, hz + hd / 2 + 0.002);
  K.box(ember, 0.15, 0.06, 0.012, hx, 0.08, hz + hd / 2 + 0.004);
  K.add(PAL.stoneDark, GEO.torus(0.14, 10, 3, PI), 0.21, 0.21, 0.21, hx, 0.17, hz + hd / 2 + 0.01, [-PI / 2, 0, 0]);
  // hood and stack, up through the roof
  K.add(stone, GEO.cyl(4, 0.22, 0.5), 0.74, 0.34, 0.74, hx, hh + 0.42, hz - 0.03, PI / 4);
  K.box(PAL.soot, 0.5, 0.04, 0.03, hx, hh + 0.27, hz + 0.23);
  K.slab(stone, 0.26, 1.2, 0.26, hx, hh + 0.58, hz - 0.03);
  K.slab(PAL.soot, 0.27, 0.12, 0.27, hx, hh + 1.66, hz - 0.03);
  K.slab(PAL.stoneDark, 0.32, 0.05, 0.32, hx, hh + 1.78, hz - 0.03);
  K.chimney = new THREE.Vector3(hx, hh + 1.86, hz - 0.03);
  // firelight on the floor in front of the hearth
  const pool = glowPool(0xff8a3a);
  K.plane(pool, GEO.quad(0, 0, 1, 1), 1.1, 0.9, hx + 0.05, 0.02, hz + 0.42, [-PI / 2, 0, 0]);

  // the bellows on their frame, nozzle into the hearth; the top board pumps
  const bx = -0.7, bz = -0.42;
  K.slab(T, 0.05, 0.22, 0.05, bx - 0.06, 0, bz - 0.12); K.slab(T, 0.05, 0.22, 0.05, bx + 0.06, 0, bz - 0.12);
  K.slab(T, 0.05, 0.18, 0.05, bx - 0.06, 0, bz + 0.14); K.slab(T, 0.05, 0.18, 0.05, bx + 0.06, 0, bz + 0.14);
  K.box(T, 0.2, 0.025, 0.4, bx, 0.22, bz, [-0.12, 0, 0]);
  K.cone(IRON, 0.026, 0.14, bx + 0.12, 0.25, bz + 0.05, 5, [0, 0, -PI / 2]);
  const Bw = K.sub();
  Bw.box(C.leather, 0.17, 0.05, 0.32, 0, 0, -0.17);
  const leather = K.attach(Bw.build(), bx, 0.25, bz + 0.17);
  const Bt = K.sub();
  Bt.box(T, 0.2, 0.022, 0.38, 0, 0, -0.19);
  Bt.rod(PAL.timberLight, 0, 0.01, -0.36, 0, 0.3, -0.5, 0.012, 5);
  const lid = K.attach(Bt.build(), bx, 0.27, bz + 0.17);

  // tools on a rail along the back wall
  const rz = zb + 0.075;
  K.box(T, 0.78, 0.03, 0.03, 0.4, 0.6, rz);
  for (let i = 0; i < 6; i++) {
    const tx = 0.08 + i * 0.13, kind = (i + look.variant) % 4;
    if (kind === 0) { K.rod(IRON, tx, 0.6, rz + 0.01, tx - 0.03, 0.36, rz + 0.01, 0.006); K.rod(IRON, tx, 0.6, rz + 0.01, tx + 0.03, 0.36, rz + 0.01, 0.006); }
    else if (kind === 1) { K.rod(PAL.timberLight, tx, 0.6, rz + 0.01, tx, 0.4, rz + 0.01, 0.009); K.box(IRON, 0.08, 0.035, 0.035, tx, 0.39, rz + 0.012); }
    else if (kind === 2) { K.rod(IRON, tx, 0.6, rz + 0.01, tx, 0.56, rz + 0.01, 0.004, 3); horseshoe(K, tx, 0.5, rz + 0.016, 0.1); }
    else { K.rod(IRON, tx, 0.6, rz + 0.01, tx, 0.42, rz + 0.01, 0.006); K.box(IRON, 0.012, 0.09, 0.03, tx, 0.38, rz + 0.012); }
  }
  // iron bar stock leaning in the corner, the coal heap, a water butt
  for (let i = 0; i < 5; i++) K.rod(i % 2 ? IRON : STEEL, 0.62 + i * 0.03, 0, zb + 0.1, 0.6 + i * 0.035, 0.66, zb + 0.07, 0.008, 4);
  K.blob(C.coal, 0.34, 0.16, 0.26, 0.18, 0.04, zb + 0.22);
  for (let i = 0; i < 6; i++) K.ball(C.coal, 0.035, 0.18 + K.j(0.14), 0.1 + r() * 0.05, zb + 0.22 + K.j(0.1));
  K.rod(PAL.timberLight, 0.3, 0.02, zb + 0.32, 0.36, 0.42, zb + 0.18, 0.009, 4);
  K.box(IRON, 0.08, 0.012, 0.09, 0.29, 0.03, zb + 0.35, [0.3, 0, 0]);
  barrel(K, 0.66, 0, -0.28, 1.05, false, 0, PAL.timber);
  K.cyl(PAL.waterDeep, 0.065, 0.004, 0.66, 0.21, -0.28, 8);

  // the anvil on its stump, a touch oversized so it reads across the table
  const ax = 0.16, az = 0.32;
  K.cyl(PAL.trunk, 0.11, 0.2, ax, 0.1, az, 7);
  K.cyl(C.wattleLight, 0.095, 0.004, ax, 0.201, az, 7);
  K.box(IRON, 0.15, 0.035, 0.12, ax, 0.22, az);
  K.box(IRON, 0.09, 0.06, 0.075, ax, 0.265, az);
  K.box(IRON, 0.23, 0.06, 0.1, ax - 0.01, 0.325, az);
  K.box(STEEL, 0.2, 0.008, 0.085, ax - 0.02, 0.358, az);
  K.cone(IRON, 0.045, 0.13, ax + 0.165, 0.33, az, 6, [0, 0, -PI / 2]);
  K.box(IRON, 0.03, 0.04, 0.03, ax - 0.135, 0.32, az);
  K.rod(PAL.timberLight, ax - 0.04, 0.37, az + 0.03, ax + 0.06, 0.37, az + 0.15, 0.008);
  K.box(IRON, 0.06, 0.03, 0.03, ax - 0.05, 0.375, az + 0.02, 0.8);
  K.rod(IRON, ax + 0.05, 0.365, az - 0.02, ax + 0.2, 0.2, az - 0.1, 0.006);
  K.add(IRON, GEO.torus(0.22, 10, 3, PI * 1.6), 0.08, 0.08, 0.08, ax + 0.02, 0.008, az + 0.2, [0, 0.5, 0]);

  // the quench trough, stone, with a pair of tongs in it
  K.slab(PAL.stoneDark, 0.44, 0.16, 0.2, 0.55, 0, 0.16, -0.06);
  K.box(PAL.waterDeep, 0.38, 0.01, 0.14, 0.55, 0.155, 0.16, -0.06);
  K.rod(IRON, 0.46, 0.16, 0.15, 0.38, 0.3, 0.2, 0.007);
  K.rod(IRON, 0.47, 0.16, 0.18, 0.39, 0.3, 0.23, 0.007);

  // grindstone, a wheel waiting for its tyre, the tyre
  const gx = -0.52, gz = 0.46;
  K.slab(T, 0.04, 0.22, 0.04, gx - 0.08, 0, gz); K.slab(T, 0.04, 0.22, 0.04, gx + 0.08, 0, gz);
  K.cyl(PAL.stone, 0.13, 0.05, gx, 0.22, gz, 10, [0, 0, PI / 2]);
  K.rod(IRON, gx - 0.12, 0.22, gz, gx + 0.12, 0.22, gz, 0.008);
  K.rod(IRON, gx + 0.12, 0.22, gz, gx + 0.12, 0.15, gz + 0.06, 0.007);
  K.slab(T, 0.18, 0.05, 0.1, gx, 0, gz);
  const wx = 0.66, wz = 0.62, wa = -0.35;
  K.add(PAL.timberLight, GEO.torus(0.09, 14, 4), 0.34, 0.34, 0.34, wx, 0.17, wz, [PI / 2 - 0.2, wa, 0]);
  {
    // spokes in the wheel's own (leaning) plane
    const sl = Math.sin(0.2), cl = Math.cos(0.2), cw = Math.cos(wa), sw = Math.sin(wa);
    const rt = [cw, 0, -sw], up = [-sl * sw, cl, -sl * cw];
    for (let i = 0; i < 4; i++) {
      const a = i * PI / 4, dx = Math.cos(a) * 0.15, dy = Math.sin(a) * 0.15;
      const ox = dx * rt[0] + dy * up[0], oy = dx * rt[1] + dy * up[1], oz = dx * rt[2] + dy * up[2];
      K.rod(PAL.timberLight, wx - ox, 0.17 - oy, wz - oz, wx + ox, 0.17 + oy, wz + oz, 0.008, 4);
    }
  }
  K.cyl(T, 0.035, 0.07, wx, 0.17, wz, 7, [PI / 2 - 0.2, wa, 0]);
  K.add(IRON, GEO.torus(0.05, 14, 3), 0.33, 0.33, 0.33, xs + 0.045, 0.52, zf + 0.02, [PI / 2 - 0.08, PI / 2, 0]);

  // the sign: a great iron horseshoe and a hammer, hung from the corner post
  K.box(IRON, 0.018, 0.018, 0.26, -xs, 0.9, zf + 0.15);
  K.beam(IRON, -xs, 0.77, zf + 0.03, -xs, 0.89, zf + 0.2, 0.012);
  const Sg = K.sub();
  for (const sx of [-0.035, 0.035]) Sg.rod(IRON, 0, 0, 0, sx, -0.05, 0, 0.004, 3);
  horseshoe(Sg, 0, -0.14, 0, 0.18, true);
  Sg.rod(PAL.timberLight, -0.02, -0.21, 0.016, 0.03, -0.07, 0.016, 0.008, 4);
  Sg.box(IRON, 0.07, 0.03, 0.03, 0.03, -0.075, 0.016, [0, 0, 0.35]);
  const sign = K.attach(Sg.build(), -xs, 0.895, zf + 0.25);
  swingX(K, sign, 0.04, 0.28, 1.2);

  // the forge breathes: every few seconds the bellows give two pulls, the coals flare,
  // the light on the floor swells and a few embers go up
  const ph = r() * 10, cycle = 4.6;
  const sparkMat = mat(PAL.flameCore, { emissive: PAL.fire, emissiveIntensity: 2.6 }, false);
  const sparks: { m: THREE.Mesh; a: number; d: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(GEO.box(), sparkMat);
    s.visible = false; s.castShadow = false;
    K.group.add(s); sparks.push({ m: s, a: i * 2.4 + r(), d: 0.4 + r() * 0.3 });
  }
  const hxm = hx * K.m;
  K.anim(env => {
    const t = env.time + ph, c = t / cycle, u = c - Math.floor(c);
    // two pulls in the first 1.6 s of each cycle
    const pull = u < 0.35 ? Math.max(0, Math.sin(u / 0.35 * PI * 2)) : 0;
    lid.rotation.x = 0.04 + 0.2 * (1 - pull);
    leather.rotation.x = lid.rotation.x * 0.5;
    leather.scale.y = 0.6 + 2.6 * lid.rotation.x;
    const flare = u < 0.55 ? Math.sin(Math.min(1, u / 0.55) * PI) : 0;
    const base = 1.15 + 0.22 * Math.sin(t * 2.3) + 0.12 * Math.sin(t * 6.7 + 1.3);
    ember.emissiveIntensity = base + flare * 1.1 + env.night * 0.5;
    pool.opacity = 0.16 + 0.05 * Math.sin(t * 2.3) + flare * 0.14 + env.night * 0.32;
    for (let i = 0; i < sparks.length; i++) {
      const s = sparks[i], v = (u - 0.08 - i * 0.05) / 0.5;
      s.m.visible = v > 0 && v < 1;
      if (!s.m.visible) continue;
      const a = s.a + Math.floor(c) * 1.3;
      s.m.position.set(hxm + Math.cos(a) * 0.08 * v + (env.wind * 0.12 * v) * K.m, hh + 0.08 + v * s.d, hz + Math.sin(a) * 0.07 * v);
      s.m.scale.setScalar(0.018 * (1 - v * 0.75));
    }
  });

  K.door.set(0.2, 0, 0.9);
  K.perch.set(0.32, roofY(zz) + 0.08, zz);
  K.top = hh + 2.1;
  return K.finish();
};

// ───────────── windmill (3x3) ─────────────

export const mill: BodyBuilder = (look) => {
  const K = Kit.of(look), r = K.r;
  const towerC = tint(pick(r, [PAL.plaster, PAL.plasterWarm, PAL.stoneWarm]), look.variant, 0.04);
  const capC = pick(r, [PAL.thatch, PAL.timberLight, PAL.thatchOld]);
  const clothed = look.variant % 3 === 0 ? 2 : 4;
  const tz = -0.15, T = PAL.timber;
  const rAt = (y: number) => 0.7 - 0.18 * (y - 0.48) / 1.64;

  K.cyl(PAL.stoneDark, 0.84, 0.12, 0, 0.06, tz, 8, PI / 8);
  K.cylT(wallP(PAL.stone), 0.7, 0.75, 0.36, 0, 0.3, tz, 8, PI / 8);
  K.cylT(wallP(towerC), 0.52, 0.7, 1.64, 0, 0.48 + 0.82, tz, 8, PI / 8);
  K.cyl(PAL.stoneDark, 0.715, 0.04, 0, 0.48, tz, 8, PI / 8);
  // entrance block with its own little roof
  K.slab(wallP(PAL.stone), 0.42, 0.66, 0.16, 0, 0.12, tz + 0.66);
  K.add(roofP(capC === PAL.thatch ? PAL.thatchOld : PAL.slate), GEO.tri(), 0.24, 0.16, 0.5, 0, 0.78, tz + 0.66, PI / 2);
  K.doorway({ x: 0, z: tz + 0.74, w: 0.26, h: 0.48, color: pick(r, [PAL.door, PAL.doorGreen, PAL.doorRed]), step: PAL.stone });
  // windows climbing the tower
  for (const [y, a] of [[1.15, 0], [1.6, -PI / 2], [0.95, PI / 2], [1.75, PI * 0.75]] as const) {
    const rr = rAt(y) * Math.cos(PI / 8);
    K.window({ x: Math.sin(a) * rr, y, z: tz + Math.cos(a) * rr, w: 0.11, h: 0.15, face: a, frame: T, mull: 'v', sill: true });
  }
  // cap and windshaft
  K.cyl(T, 0.56, 0.07, 0, 2.11, tz, 8, PI / 8);
  K.cone(roofP(capC), 0.66, 0.66, 0, 2.11 + 0.33, tz, 8, PI / 8);
  K.ball(PAL.timber, 0.05, 0, 2.8, tz);
  K.rod(T, 0, 2.24, tz + 0.2, 0, 2.24, tz + 0.82, 0.04, 6);
  K.box(T, 0.12, 0.12, 0.1, 0, 2.24, tz + 0.82);

  // sails, turning with the wind
  const S = K.sub();
  const R0 = 0.24, R1 = 1.24, SW = 0.24;
  for (let k = 0; k < 4; k++) {
    const a = k * PI / 2 + 0.25, dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx;
    S.beam(T, dx * 0.05, dy * 0.05, 0, dx * (R1 + 0.02), dy * (R1 + 0.02), 0, 0.045);
    S.beam(PAL.timberLight, dx * R0 + px * SW, dy * R0 + py * SW, 0.025, dx * R1 + px * SW, dy * R1 + py * SW, 0.025, 0.02);
    for (let i = 0; i <= 7; i++) {
      const rr = R0 + (R1 - R0) * i / 7;
      S.beam(PAL.timberLight, dx * rr, dy * rr, 0.025, dx * rr + px * SW, dy * rr + py * SW, 0.025, 0.015);
    }
    if (k < clothed) {
      const rm = (R0 + R1) / 2 + 0.02;
      S.box(PAL.clothCream, SW - 0.02, R1 - R0 - 0.06, 0.008, dx * rm + px * SW / 2, dy * rm + py * SW / 2, 0.035, [0, 0, a - PI / 2]);
    }
  }
  S.box(PAL.iron, 0.14, 0.14, 0.05, 0, 0, 0.02, [0, 0, PI / 4]);
  const sails = K.attach(S.build(), 0, 2.24, tz + 0.9);
  let ang = r() * PI;
  K.anim(env => {
    const sp = env.speed === 0 ? 0.2 : Math.min(1.8, 0.6 + 0.4 * env.speed);
    ang -= env.dt * (0.3 + 1.7 * env.wind) * sp;
    sails.rotation.z = ang;
  });

  // a grain store against the tower
  const sx = 0.86, sz = -0.6;
  K.slab(wallP(PAL.plaster), 0.6, 0.48, 0.62, sx, 0, sz);
  for (const [px, pz] of [[sx - 0.3, sz + 0.31], [sx + 0.3, sz + 0.31], [sx + 0.3, sz - 0.31]] as const) K.slab(T, 0.05, 0.48, 0.05, px, 0, pz);
  K.box(roofP(PAL.thatchOld), 0.76, 0.06, 0.78, sx + 0.03, 0.56, sz, [0, 0, -0.32]);
  K.doorway({ x: sx, z: sz + 0.31, w: 0.2, h: 0.36, color: PAL.timberLight, main: false, step: null });

  // sacks by the door, a handcart, a spare millstone
  sack(K, 0.5, 0, 0.66, 1.1, 0.4);
  sack(K, 0.66, 0, 0.5, 1.05, -0.3, C.sackDark);
  sack(K, 0.62, 0, 0.74, 1.0, 1.2);
  K.blob(C.sack, 0.24, 0.1, 0.13, 0.78, 0.05, 0.82, 0.5);
  sack(K, 0.57, 0.15, 0.6, 0.9, 0.2, C.sackDark);
  const cxp = -0.72, czp = 0.72, cr = 0.5, cc = Math.cos(cr), cs = Math.sin(cr);
  const at = (u: number, v: number): [number, number] => [cxp + u * cc + v * cs, czp - u * cs + v * cc];
  K.box(PAL.timberLight, 0.5, 0.04, 0.32, cxp, 0.22, czp, cr);
  for (const v of [-0.15, 0.15]) { const [qx, qz] = at(0, v); K.box(PAL.timberLight, 0.5, 0.08, 0.02, qx, 0.28, qz, cr); }
  for (const v of [-0.19, 0.19]) { const [qx, qz] = at(0.04, v); K.cyl(T, 0.15, 0.03, qx, 0.15, qz, 10, [PI / 2, cr, 0]); K.cyl(PAL.iron, 0.03, 0.04, qx, 0.15, qz, 6, [PI / 2, cr, 0]); }
  for (const v of [-0.12, 0.12]) { const [qa, qb] = at(-0.25, v), [qc, qd] = at(-0.55, v); K.rod(T, qa, 0.22, qb, qc, 0.12, qd, 0.014); }
  { const [qx, qz] = at(0.05, 0); sack(K, qx, 0.24, qz, 1, cr + 1.4, C.sack, 0.6); }
  K.cyl(PAL.stone, 0.22, 0.06, -0.86, 0.23, tz + 0.1, 12, [0, 0.3, PI / 2 - 0.25]);
  K.cyl(PAL.stoneDark, 0.05, 0.065, -0.86, 0.23, tz + 0.1, 8, [0, 0.3, PI / 2 - 0.25]);
  for (let i = 0; i < 6; i++) K.blob(C.straw, 0.05, 0.012, 0.03, 0.2 + K.j(0.4), 0.006, 0.7 + K.j(0.15), K.j(3));

  K.perch.set(0, 2.8, tz);
  K.top = 2.24 + R1 + 0.04;
  return K.finish();
};

// ───────────── apothecary (2x2) ─────────────

export const apothecary: BodyBuilder = (look) => {
  const K = Kit.of(look), r = K.r;
  const plaster = tint(pick(r, [PAL.plaster, PAL.plasterWarm, PAL.plasterGrey]), look.variant, 0.05);
  const doorC = pick(r, [PAL.clothPlum, PAL.doorGreen, PAL.clothTeal]);
  const roofC = pick(r, [PAL.slateDark, PAL.slate]);
  const T = PAL.timber;
  const glass = winP(C.glassGreen, { rough: 0.35 });
  const H1 = 0.66, z1 = 0.4, gcz = -0.05;

  K.slab(PAL.stoneDark, 1.06, 0.06, 0.96, 0, 0, gcz);
  K.slab(wallP(plaster), 1.0, H1, 0.9, 0, 0, gcz);
  for (const px of [-0.5, 0.5]) for (const pz of [gcz - 0.45, z1]) K.slab(T, 0.06, H1, 0.06, px, 0, pz);
  K.box(T, 1.04, 0.05, 0.05, 0, 0.08, z1 + 0.005);
  K.beam(T, -0.47, 0.1, gcz - 0.45 - 0.004, -0.1, H1 - 0.05, gcz - 0.45 - 0.004, 0.04, 0.03);

  K.window({ x: 0.24, y: 0.36, z: gcz - 0.45, w: 0.16, h: 0.18, face: 'b', glass, mull: 'lead', frame: T });
  K.window({ x: -0.5, y: 0.34, z: gcz + 0.05, w: 0.12, h: 0.16, face: 'l', glass, mull: 'lead', frame: T, peek: false });
  // bulging bay of bottle-green glass
  const bx = -0.17;
  K.slab(wallP(plaster), 0.48, 0.16, 0.15, bx, 0, z1 + 0.06);
  K.box(wallP(plaster), 0.46, 0.3, 0.12, bx, 0.31, z1 + 0.06);
  K.window({ x: bx, y: 0.31, z: z1 + 0.12, w: 0.42, h: 0.28, glass, mull: 'lead', sill: false, frame: T });
  for (const [sxx, f] of [[bx - 0.23, 'l'], [bx + 0.23, 'r']] as const) K.window({ x: sxx, y: 0.31, z: z1 + 0.06, w: 0.1, h: 0.28, face: f, glass, mull: 'lead', sill: false, frame: T, peek: false });
  K.box(T, 0.5, 0.03, 0.17, bx, 0.165, z1 + 0.065);
  K.box(roofP(PAL.slateDark), 0.54, 0.03, 0.17, bx, 0.49, z1 + 0.075, [0.35, 0, 0]);
  K.doorway({ x: 0.27, z: z1, w: 0.24, h: 0.48, color: doorC });

  // the crooked upper storey and its steep roof, all of a piece
  const U = K.sub();
  const uw = 1.08, ud = 0.98, uh = 0.56, ucz = 0.04;
  U.box(T, uw + 0.04, 0.06, ud + 0.04, 0, 0.03, ucz);
  for (let i = 0; i < 6; i++) U.box(T, 0.04, 0.04, 0.05, -0.45 + i * 0.18, -0.02, ucz + ud / 2 - 0.02);
  U.slab(wallP(plaster), uw, uh, ud, 0, 0.06, ucz);
  const uf = ucz + ud / 2;
  for (const px of [-uw / 2, uw / 2]) { U.slab(T, 0.05, uh, 0.05, px, 0.06, uf); U.slab(T, 0.05, uh, 0.05, px, 0.06, ucz - ud / 2); }
  U.box(T, uw, 0.05, 0.05, 0, 0.06 + uh - 0.025, uf + 0.004);
  U.box(T, uw, 0.04, 0.04, 0, 0.36, uf + 0.006);
  U.beam(T, -uw / 2 + 0.03, 0.08, uf + 0.006, -uw / 2 + 0.2, 0.36, uf + 0.006, 0.035, 0.03);
  U.beam(T, uw / 2 - 0.03, 0.08, uf + 0.006, uw / 2 - 0.22, 0.36, uf + 0.006, 0.035, 0.03);
  U.window({ x: -0.2, y: 0.25, z: uf, w: 0.24, h: 0.16, glass, mull: 'lead', frame: T });
  U.window({ x: 0.26, y: 0.24, z: uf, w: 0.13, h: 0.15, glass, mull: 'lead', frame: T });
  U.window({ x: uw / 2, y: 0.28, z: ucz, w: 0.13, h: 0.16, glass, face: 'r', mull: 'lead', frame: T });
  const ub = ucz - ud / 2;
  U.box(T, uw, 0.05, 0.05, 0, 0.06 + uh - 0.025, ub - 0.004);
  U.box(T, uw, 0.04, 0.04, 0, 0.36, ub - 0.006);
  for (const px of [-0.2, 0.22]) U.box(T, 0.04, uh - 0.04, 0.03, px, 0.06 + uh / 2, ub - 0.008);
  U.window({ x: 0.0, y: 0.25, z: ub, w: 0.15, h: 0.15, glass, face: 'b', mull: 'lead', frame: T, peek: false });
  U.window({ x: -uw / 2, y: 0.26, z: ucz + 0.1, w: 0.12, h: 0.15, glass, face: 'l', mull: 'lead', frame: T, peek: false });
  U.window({ x: 0, y: 0.06 + uh + 0.2, z: ub, w: 0.09, h: 0.09, glass, face: 'b', arch: 'round', mull: 'v', frame: T, sill: false, peek: false });
  const bottles = [C.potionRed, C.potionBlue, C.potionGreen, C.potionPurple, C.potionGreen];
  for (let i = 0; i < 5; i++) {
    const h = 0.04 + (i % 3) * 0.012, bxx = -0.3 + i * 0.05;
    U.cyl(bottles[i], 0.014, h, bxx, 0.16 + h / 2 + 0.012, uf + 0.03, 6);
    U.cyl(PAL.timberLight, 0.006, 0.012, bxx, 0.16 + h + 0.018, uf + 0.03, 4);
  }
  const ro = { x: 0, y: 0.06 + uh, z: ucz, span: uw, len: ud, rise: 0.74, t: 0.05, over: 0.08, ends: 0.1, axis: 'z' as const, roll: 0.035 };
  const rf = U.gable(roofP(roofC), ro);
  roofCourses(U, roofP(roofC === PAL.slate ? PAL.slateDark : PAL.slate), { ...ro, n: 4 });
  for (const gz of [ucz + ud / 2 - 0.025, ucz - ud / 2 + 0.025]) U.tri(wallP(plaster), uw, 0.74, 0.05, 0, 0.06 + uh, gz, 'z');
  U.box(T, 0.04, 0.6, 0.03, 0, 0.06 + uh + 0.3, uf + 0.004);
  U.window({ x: 0, y: 0.06 + uh + 0.22, z: uf, w: 0.11, h: 0.11, glass, arch: 'round', mull: 'cross', frame: T, sill: false });
  // the thin, crooked flue
  const f0: [number, number, number] = [0.3, 1.0, -0.26], f1: [number, number, number] = [0.34, 1.5, -0.28], f2: [number, number, number] = [0.29, 1.7, -0.25];
  U.rod(PAL.soot, f0[0], f0[1], f0[2], f1[0], f1[1], f1[2], 0.028, 6);
  U.rod(PAL.soot, f1[0], f1[1], f1[2], f2[0], f2[1], f2[2], 0.026, 6);
  U.cyl(PAL.iron, 0.04, 0.03, f1[0], f1[1], f1[2], 6);
  U.cone(PAL.iron, 0.065, 0.05, f2[0], f2[1] + 0.07, f2[2], 6);
  U.rod(PAL.iron, f2[0] - 0.03, f2[1], f2[2], f2[0] - 0.03, f2[1] + 0.05, f2[2], 0.004, 3);
  U.rod(PAL.iron, f2[0] + 0.03, f2[1], f2[2], f2[0] + 0.03, f2[1] + 0.05, f2[2], 0.004, 3);
  const ug = K.attach(U.build(), 0, H1, gcz);
  ug.rotation.set(0, 0.05 * K.m, -0.03 * K.m);
  const chim = K.toRoot(ug, f2[0], f2[1] + 0.03, f2[2]);
  K.chimney = chim;
  K.perch.copy(K.toRoot(ug, 0, rf.ridge + 0.01, ucz - 0.15));
  for (const [x, y, f] of [[-0.2, 0.25, 0], [0.26, 0.24, 0]] as const) K.winPts.push(K.toRoot(ug, x, y - 0.03, uf + 0.05 + f));

  // herbs hung to dry under the jetty, in two loose bunches that sway apart
  const herbs = [C.herb, C.lavender, C.herbDry, C.herb, C.lavender];
  const hx = [-0.38, -0.22, -0.06, 0.12, 0.44];
  for (let gI = 0; gI < 2; gI++) {
    const Hh = K.sub();
    for (let i = gI; i < hx.length; i += 2) {
      const lx = hx[i] - (gI ? 0.05 : -0.05);
      Hh.rod(C.rope, lx, 0, 0, lx, -0.03, 0, 0.004, 3);
      Hh.cone(herbs[i], 0.034, 0.1, lx, -0.08, 0, 6);
      Hh.cyl(C.rope, 0.016, 0.012, lx, -0.035, 0, 6);
    }
    const g = K.attach(Hh.build(), gI ? 0.05 : -0.05, H1 - 0.01, z1 + 0.05);
    const ph = r() * 10;
    K.anim(env => { g.rotation.x = Math.sin(env.time * 1.6 + ph) * (0.03 + env.wind * 0.16); });
  }
  K.box(T, 0.98, 0.012, 0.012, 0, H1 - 0.01, z1 + 0.05);

  // the mortar sign on a bracket from the upper floor
  const mp = K.toRoot(ug, -0.44, 0.48, uf);
  bracket(K, mp.x, mp.y, mp.z, 0.2);
  const M = K.sub();
  for (const sx of [-0.04, 0.04]) M.rod(PAL.iron, 0, 0, 0, sx, -0.05, 0, 0.004, 3);
  M.cyl(PAL.doorGreen, 0.1, 0.02, 0, -0.15, -0.012, 12, [PI / 2, 0, 0]);
  M.ring(PAL.gold, 0.1, 0.008, 0, -0.15, -0.002, [PI / 2, 0, 0], 12);
  M.cylT(C.mortar, 0.065, 0.045, 0.07, 0, -0.18, 0.02, 9);
  M.cyl(PAL.stoneDark, 0.055, 0.004, 0, -0.144, 0.02, 9);
  M.rod(PAL.timberLight, -0.02, -0.16, 0.02, 0.05, -0.08, 0.03, 0.012, 5);
  M.ball(PAL.timberLight, 0.018, 0.055, -0.075, 0.03);
  const mg = K.attach(M.build(), mp.x, mp.y - 0.01, mp.z + 0.19);
  swingX(K, mg, 0.035, 0.25, 1.3);

  // a barrel of growing herbs, a broom
  barrel(K, 0.47, 0, z1 + 0.16, 0.9, false, 0, PAL.timber);
  for (let i = 0; i < 5; i++) K.ball(i % 2 ? C.leaf : C.leafDark, 0.05, 0.47 + K.j(0.04), 0.2 + K.j(0.02), z1 + 0.16 + K.j(0.04));
  flowers(K, 0.47, 0.21, z1 + 0.16, 4, 0.05, [C.lavender, C.lavender, PAL.parchment]);
  K.rod(PAL.timberLight, 0.08, 0.0, z1 + 0.1, 0.12, 0.5, z1 + 0.03, 0.009);
  K.cone(C.straw, 0.05, 0.14, 0.08, 0.06, z1 + 0.1, 6, [-0.08, 0, -0.08]);

  // coloured smoke: a cough of green or violet from the flue every few seconds
  const puffCols = [PAL.magic, C.potionGreen, 0xd77ab0, C.potionBlue];
  const puffs: { m: THREE.Mesh; mt: THREE.MeshStandardMaterial }[] = [];
  for (let i = 0; i < 4; i++) {
    const mt = mat(puffCols[i], { transparent: true, opacity: 0, emissive: puffCols[i], emissiveIntensity: 0.35, rough: 1 }, true);
    mt.depthWrite = false;
    const m = new THREE.Mesh(GEO.ico(1), mt);
    m.castShadow = false; m.receiveShadow = false;
    K.group.add(m); puffs.push({ m, mt });
  }
  const cx = chim.x * K.m, cy = chim.y + 0.05, czz = chim.z, life = 3.4, ph = r() * life;
  K.anim(env => {
    for (let i = 0; i < puffs.length; i++) {
      const p = puffs[i], tt = (env.time + ph + i * life / puffs.length) / life, u = tt - Math.floor(tt);
      const cyc = Math.floor(tt);
      const c = puffCols[(cyc + i) % puffCols.length];
      p.mt.color.setHex(c); p.mt.emissive.setHex(c);
      const drift = u * (0.1 + env.wind * 0.4);
      p.m.position.set(cx + drift * K.m + Math.sin(u * 6 + i) * 0.02, cy + u * 0.62, czz + Math.cos(u * 5 + i) * 0.02);
      p.m.scale.setScalar(0.05 + u * 0.13);
      p.mt.opacity = u < 0.15 ? u / 0.15 * 0.7 : 0.7 * (1 - (u - 0.15) / 0.85);
    }
  });

  return K.finish();
};

// ───────────── tavern (3x3) ─────────────

export const tavern: BodyBuilder = (look) => {
  const K = Kit.of(look), r = K.r;
  const plaster = tint(pick(r, [PAL.plaster, PAL.plasterWarm]), look.variant, 0.04);
  const stone = PAL.stoneWarm;
  const roofC = pick(r, [PAL.tile, PAL.tileDark]);
  const wingRoof = pick(r, [PAL.thatch, PAL.thatchOld, PAL.tile]);
  const doorC = pick(r, [PAL.doorRed, PAL.door, PAL.doorGreen]);
  const T = PAL.timber;
  const x0 = -1.2, x1 = 0.5, z0 = -1.2, z1 = -0.05, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0;
  const H1 = 0.72, H2 = 1.42;

  K.slab(PAL.stoneDark, W + 0.06, 0.07, D + 0.06, cx, 0, cz);
  K.slab(wallP(stone), W, H1, D, cx, 0, cz);
  for (const qx of [x0, x1]) for (let k = 0; k < 4; k++) K.box(PAL.stone, 0.08, 0.12, k % 2 ? 0.14 : 0.09, qx + (qx < 0 ? 0.03 : -0.03), 0.12 + k * 0.16, z1 - 0.03);
  // jetty and timber-framed upper floor
  K.box(T, W + 0.1, 0.07, D + 0.16, cx, H1 + 0.035, cz + 0.04);
  for (let i = 0; i < 9; i++) K.box(T, 0.04, 0.04, 0.05, x0 + 0.08 + i * (W - 0.16) / 8, H1 - 0.01, z1 + 0.09);
  const uz1 = z1 + 0.08, ucz = cz + 0.04, UD = D + 0.08;
  K.slab(wallP(plaster), W + 0.02, H2 - H1 - 0.07, UD, cx, H1 + 0.07, ucz);
  for (let i = 0; i <= 6; i++) K.box(T, 0.045, H2 - H1 - 0.07, 0.03, x0 + i * W / 6, (H1 + 0.07 + H2) / 2, uz1 + 0.012);
  K.box(T, W + 0.04, 0.04, 0.03, cx, 1.1, uz1 + 0.014);
  K.box(T, W + 0.04, 0.05, 0.03, cx, H2 - 0.025, uz1 + 0.012);
  for (const [a, b] of [[0, 1], [5, 6]] as const) K.beam(T, x0 + a * W / 6, 1.12, uz1 + 0.016, x0 + b * W / 6, H2 - 0.05, uz1 + 0.016, 0.035, 0.03);
  for (const sx of [x0, x1]) { K.box(T, 0.03, 0.04, UD, sx + (sx < 0 ? -0.012 : 0.012), 1.1, ucz); K.box(T, 0.03, H2 - H1, 0.045, sx + (sx < 0 ? -0.012 : 0.012), (H1 + H2) / 2, ucz); }

  // the back: studs on the upper floor, a window each side, a yard door
  for (let i = 0; i <= 6; i++) K.box(T, 0.045, H2 - H1 - 0.07, 0.03, x0 + i * W / 6, (H1 + 0.07 + H2) / 2, z0 - 0.012);
  K.box(T, W + 0.04, 0.04, 0.03, cx, 1.1, z0 - 0.014);
  K.box(T, W + 0.04, 0.05, 0.03, cx, H2 - 0.025, z0 - 0.012);
  K.box(T, W + 0.04, 0.05, 0.03, cx, H1 + 0.07, z0 - 0.012);
  for (const bxx of [-0.775, 0.075]) K.window({ x: bxx, y: 1.25, z: z0, w: 0.17, h: 0.17, face: 'b', frame: T, mull: 'cross', peek: false });
  K.window({ x: -0.75, y: 0.42, z: z0, w: 0.24, h: 0.2, face: 'b', frame: T, mull: 'cross', shutters: PAL.doorGreen, peek: false });
  K.doorway({ x: 0.15, z: z0, w: 0.26, h: 0.5, face: 'b', color: PAL.timberLight, main: false, iron: true });
  barrel(K, -0.2, 0, z0 - 0.12, 1.1, false, 0.4);
  // roof, courses, ridge, gables, a dormer
  const ro = { x: cx, y: H2, z: ucz, span: UD, len: W + 0.02, rise: 0.74, t: 0.07, over: 0.14, ends: 0.12, axis: 'x' as const };
  const rf = K.gable(roofP(roofC), ro);
  roofCourses(K, roofP(roofC === PAL.tile ? PAL.tileDark : PAL.tile), { ...ro, n: 4 });
  K.box(roofP(PAL.tileDark), W + 0.3, 0.07, 0.07, cx, rf.ridge - 0.015, ucz, [PI / 4, 0, 0]);
  for (const gx of [x0 + 0.03, x1 - 0.03]) K.tri(wallP(plaster), UD, 0.74, 0.05, gx, H2, ucz);
  K.box(T, 0.03, 0.66, 0.05, x1 + 0.003, H2 + 0.33, ucz);
  K.window({ x: x1, y: H2 + 0.24, z: ucz, w: 0.15, h: 0.15, face: 'r', frame: T, mull: 'cross' });
  const dx = cx + 0.25, dz = uz1 - 0.08;
  K.slab(wallP(plaster), 0.32, 0.3, 0.42, dx, H2 - 0.02, dz - 0.15);
  K.gable(roofP(roofC), { x: dx, y: H2 + 0.28, z: dz - 0.15, span: 0.32, len: 0.42, rise: 0.17, t: 0.04, over: 0.05, ends: 0.04, axis: 'z' });
  K.tri(wallP(plaster), 0.32, 0.17, 0.03, dx, H2 + 0.28, dz + 0.05, 'z');
  K.window({ x: dx, y: H2 + 0.13, z: dz + 0.06, w: 0.15, h: 0.15, frame: T, mull: 'cross' });

  // the stack on the far gable
  const chx = x0 - 0.1, chz = cz;
  K.slab(PAL.stone, 0.3, 1.25, 0.42, chx, 0, chz);
  K.box(PAL.stone, 0.3, 0.14, 0.42, chx + 0.02, 1.27, chz, [0, 0, -0.5]);
  K.slab(PAL.stone, 0.22, 1.3, 0.28, chx + 0.02, 1.25, chz);
  K.slab(PAL.stoneDark, 0.28, 0.05, 0.34, chx + 0.02, 2.55, chz);
  for (const pz of [-0.06, 0.06]) K.cylT(PAL.tileDark, 0.04, 0.05, 0.09, chx + 0.02, 2.64, chz + pz, 7);
  K.chimney = new THREE.Vector3(chx + 0.02, 2.72, chz);

  // front: arched double door, lanterns, windows, flower boxes
  K.doorway({ x: -0.15, z: z1, w: 0.36, h: 0.6, color: doorC, arch: true, double: true, iron: true, ring: true, frame: PAL.stone, step: PAL.stone });
  for (const lx of [-0.42, 0.12]) { K.box(PAL.iron, 0.012, 0.012, 0.1, lx, 0.66, z1 + 0.05); K.lantern(lx, 0.66, z1 + 0.1, 1.1); }
  for (const wxx of [-0.86, 0.28]) K.window({ x: wxx, y: 0.4, z: z1, w: 0.36, h: 0.25, mull: 'cross', frame: T, shutters: wxx < 0 ? PAL.doorGreen : null });
  const flowerC = [PAL.crimson, PAL.clothOchre, PAL.parchment, C.rose];
  for (const [ux, box] of [[-1.0, true], [-0.6, false], [-0.15, true], [0.28, true]] as const) {
    K.window({ x: ux, y: 1.12, z: uz1, w: 0.2, h: 0.2, mull: 'cross', frame: T });
    if (box) {
      K.box(PAL.timberLight, 0.26, 0.05, 0.07, ux, 0.98, uz1 + 0.04);
      flowers(K, ux, 1.0, uz1 + 0.05, 5, 0.1, flowerC);
    }
  }

  // the brewhouse wing
  const wx0 = x1, wx1 = 1.24, wz0 = z0, wz1 = 0.5, wcx = (wx0 + wx1) / 2, wcz = (wz0 + wz1) / 2, WH = 0.8;
  K.slab(PAL.stoneDark, wx1 - wx0 + 0.04, 0.06, wz1 - wz0 + 0.04, wcx, 0, wcz);
  K.slab(wallP(plaster), wx1 - wx0, WH, wz1 - wz0, wcx, 0, wcz);
  for (const [px, pz] of [[wx0, wz1], [wx1, wz1], [wx1, wz0], [wx0, 0.0]] as const) K.slab(T, 0.05, WH, 0.05, px, 0, pz);
  K.box(T, wx1 - wx0 + 0.04, 0.05, 0.05, wcx, WH - 0.025, wz1 + 0.005);
  K.box(T, 0.04, 0.05, wz1 - wz0, wx0 - 0.005, WH - 0.025, wcz);
  K.box(T, 0.04, 0.04, wz1 - wz0, wx0 - 0.006, 0.42, wcz);
  const wro = { x: wcx, y: WH, z: wcz, span: wx1 - wx0, len: wz1 - wz0, rise: 0.48, t: wingRoof === PAL.tile ? 0.06 : 0.11, over: 0.1, ends: 0.08, axis: 'z' as const };
  const wrf = K.gable(roofP(wingRoof), wro);
  if (wingRoof === PAL.tile) roofCourses(K, roofP(PAL.tileDark), { ...wro, n: 3 });
  else K.cyl(roofP(PAL.thatchOld), 0.05, wz1 - wz0 + 0.2, wcx, wrf.ridge - 0.02, wcz, 6, [PI / 2, 0, 0]);
  K.tri(wallP(plaster), wx1 - wx0, 0.48, 0.04, wcx, WH, wz1 - 0.02, 'z');
  K.tri(wallP(plaster), wx1 - wx0, 0.48, 0.04, wcx, WH, wz0 + 0.02, 'z');
  K.box(T, 0.03, 0.44, 0.03, wcx, WH + 0.22, wz1 + 0.004);
  K.doorway({ x: wcx, z: wz1, w: 0.34, h: 0.5, color: PAL.timberLight, double: true, main: false, iron: true });
  K.window({ x: wx0, y: 0.45, z: 0.26, w: 0.18, h: 0.18, face: 'l', frame: T, mull: 'cross' });

  // barrels, a stack, a crate
  for (const [bx, bz] of [[0.75, 0.78], [0.93, 0.72], [0.84, 0.92]] as const) barrel(K, bx, 0, bz, 1.25, false, K.j(1));
  barrel(K, 1.12, 0, 0.9, 1.25, true, 0.3);
  barrel(K, 0.6, 0, 1.12, 1.15, true, PI / 2 + 0.1);
  barrel(K, 0.8, 0, 1.12, 1.15, true, PI / 2 - 0.05);
  barrel(K, 0.7, 0.16, 1.12, 1.15, true, PI / 2);
  crate(K, 1.1, 0, 0.62, 0.2, 0.16, 0.2, 0.3);

  // trestle table, benches, mugs
  const tx = -0.32, tz = 0.66;
  K.box(PAL.timberLight, 0.62, 0.03, 0.24, tx, 0.21, tz);
  for (const sx of [-0.24, 0.24]) {
    K.beam(T, tx + sx, 0, tz - 0.09, tx + sx, 0.2, tz + 0.02, 0.025);
    K.beam(T, tx + sx, 0, tz + 0.09, tx + sx, 0.2, tz - 0.02, 0.025);
  }
  bench(K, tx, tz - 0.22, 0.6);
  bench(K, tx, tz + 0.22, 0.6);
  for (const [mx, mz] of [[-0.48, 0.62], [-0.3, 0.7], [-0.14, 0.63]] as const) {
    K.cylT(PAL.clothGrey, 0.022, 0.026, 0.05, mx, 0.25, mz, 7);
    K.ring(PAL.clothGrey, 0.014, 0.004, mx + 0.03, 0.25, mz, [PI / 2, 0, 0], 6);
  }
  K.cyl(PAL.parchment, 0.04, 0.006, tx + 0.05, 0.227, tz - 0.03, 9);

  // the inn sign on its post
  const sx0 = -1.0, sz0 = 0.66;
  K.slab(T, 0.07, 1.32, 0.07, sx0, 0, sz0);
  K.slab(PAL.stoneDark, 0.16, 0.06, 0.16, sx0, 0, sz0);
  K.box(T, 0.5, 0.05, 0.05, sx0 + 0.22, 1.24, sz0);
  K.beam(T, sx0, 0.98, sz0, sx0 + 0.24, 1.22, sz0, 0.035);
  K.lantern(sx0 + 0.08, 1.215, sz0, 1);
  const SG = K.sub();
  for (const sx of [-0.14, 0.14]) SG.rod(PAL.iron, sx, 0, 0, sx, -0.06, 0, 0.005, 3);
  SG.box(T, 0.4, 0.34, 0.03, 0, -0.24, 0);
  const cell = look.variant % 3, signMat = tavernSignAtlas();
  SG.plane(signMat, tavernCell(cell), 0.35, 0.29, 0, -0.24, 0.0165);
  SG.plane(signMat, tavernCell(cell), 0.35, 0.29, 0, -0.24, -0.0165, PI);
  const sgG = K.attach(SG.build(), sx0 + 0.32, 1.215, sz0);
  swingX(K, sgG, 0.03, 0.3, 1.0);

  K.perch.set(cx, rf.ridge + 0.02, ucz);
  return K.finish();
};
