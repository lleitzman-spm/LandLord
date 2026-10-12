/**
 * OWNER: render-civic. Bodies for the staff buildings: mason's yard,
 * bailiff's post, crier's stand, counting house.
 */
import * as THREE from 'three';
import { PAL, tint, mix } from '../palette';
import type { BodyBuilder } from './types';
import { Kit, GEO, C, pick, wallP, roofP, barrel, bench, logs, valance, flowers, noticeAtlas, NOTICE_CELLS, roofCourses, tradeSignAtlas, tradeSignCell } from './civic-parts';

const PI = Math.PI;

// ───────────── mason's yard (2x2) ─────────────

export const masonsYard: BodyBuilder = (look) => {
  const K = Kit.of(look), r = K.r;
  const wood = tint(PAL.timberLight, look.variant, 0.05);
  const roofC = pick(r, [PAL.timberLight, PAL.tile, PAL.slate]);
  const T = PAL.timber;
  const stones = [PAL.stone, PAL.stoneWarm, PAL.plasterGrey, PAL.stone, PAL.rock];

  K.slab(mix(PAL.dirt, PAL.stone, 0.45), 1.64, 0.012, 1.64, 0, 0, 0);
  // the open shed
  K.slab(wallP(wood), 1.6, 0.8, 0.05, 0, 0, -0.82);
  for (let i = 1; i < 10; i++) K.box(T, 0.008, 0.78, 0.006, -0.8 + i * 0.16, 0.4, -0.793);
  K.slab(wallP(wood), 0.05, 0.72, 0.6, -0.78, 0, -0.52);
  for (const x of [-0.76, 0, 0.76]) { K.slab(T, 0.06, 0.62, 0.06, x, 0, -0.22); K.beam(T, x, 0.62, -0.22, x, 0.8, -0.8, 0.04); }
  K.box(T, 1.62, 0.05, 0.05, 0, 0.62, -0.22);
  K.box(T, 1.62, 0.05, 0.05, 0, 0.8, -0.82);
  const ang = Math.atan2(0.18, 0.6);
  K.box(roofP(roofC), 1.76, 0.04, 0.84, 0, 0.76, -0.52, [ang, 0, 0]);
  for (let i = 0; i < 3; i++) {
    const f = (i + 0.6) / 3.4, z = -0.14 - f * 0.76, y = 0.645 + f * 0.235 + 0.025;
    K.box(roofP(roofC === PAL.tile ? PAL.tileDark : roofC === PAL.slate ? PAL.slateDark : PAL.timber), 1.74, 0.014, 0.04, 0, y, z, [ang, 0, 0]);
  }

  for (let i = 1; i < 10; i++) K.box(T, 0.008, 0.78, 0.006, -0.8 + i * 0.16, 0.4, -0.847);
  for (const lx of [-0.5, 0.3]) K.box(T, 0.02, 0.02, 0.05, lx, 0.62, -0.86);
  for (const ly of [0.55, 0.69]) K.box(PAL.timberLight, 1.0, 0.025, 0.02, -0.1, ly, -0.865);
  for (let i = 0; i < 9; i++) K.box(PAL.timberLight, 0.02, 0.16, 0.016, -0.56 + i * 0.115, 0.62, -0.866);
  // timber stacked on bearers, poles leaning in the corner
  for (const bx of [-0.62, -0.12]) K.slab(T, 0.06, 0.05, 0.42, bx, 0, -0.56);
  for (let l = 0; l < 4; l++) for (let i = 0; i < (l === 3 ? 2 : 4); i++) {
    K.box(pick(r, [PAL.timberLight, wood, PAL.oakLight]), 0.86, 0.036, 0.075, -0.36 + K.j(0.03), 0.068 + l * 0.039, -0.69 + i * 0.086 + (l === 3 ? 0.08 : 0));
  }
  for (let i = 0; i < 3; i++) K.rod(PAL.timberLight, -0.71 + i * 0.03, 0, -0.28 - i * 0.03, -0.73, 0.7, -0.62 - i * 0.04, 0.016, 5);
  // tools on the back wall, a bench beneath
  const zw = -0.79;
  K.box(PAL.iron, 0.22, 0.06, 0.006, 0.3, 0.52, zw, [0, 0, 0.05]);
  K.box(T, 0.05, 0.05, 0.014, 0.17, 0.52, zw);
  K.box(PAL.iron, 0.16, 0.02, 0.008, 0.54, 0.6, zw); K.box(PAL.iron, 0.02, 0.12, 0.008, 0.61, 0.55, zw);
  K.box(PAL.timberLight, 0.2, 0.03, 0.016, 0.42, 0.68, zw);
  K.box(C.potionGreen, 0.03, 0.012, 0.004, 0.42, 0.68, zw + 0.01);
  K.rod(T, 0.7, 0.62, zw + 0.01, 0.7, 0.46, zw + 0.01, 0.008); K.cyl(T, 0.03, 0.06, 0.7, 0.44, zw + 0.03, 7, [0, 0, PI / 2]);
  K.slab(T, 0.5, 0.04, 0.22, 0.45, 0.25, -0.6);
  for (const [lx, lz] of [[-0.22, -0.08], [0.22, -0.08], [-0.22, 0.08], [0.22, 0.08]] as const) K.slab(T, 0.035, 0.25, 0.035, 0.45 + lx, 0, -0.6 + lz);
  for (let i = 0; i < 3; i++) K.rod(PAL.iron, 0.3 + i * 0.05, 0.295, -0.62, 0.32 + i * 0.05, 0.295, -0.54, 0.006);

  // a neat stack of dressed stone
  const blk = (x: number, y: number, z: number) => K.box(pick(r, stones), 0.2, 0.12, 0.14, x, y, z, K.j(0.05));
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) blk(-0.68 + i * 0.205, 0.06, -0.06 + j * 0.145);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) blk(-0.58 + i * 0.205, 0.18, -0.06 + j * 0.145);
  blk(-0.48, 0.3, 0.01);

  // the banker, with a gargoyle half out of its block
  const bx = -0.3, bz = 0.5;
  K.slab(T, 0.3, 0.2, 0.24, bx, 0, bz);
  K.slab(PAL.timberLight, 0.34, 0.03, 0.28, bx, 0.2, bz);
  const gs = PAL.stoneWarm, gy = 0.23;
  K.box(gs, 0.2, 0.17, 0.17, bx, gy + 0.085, bz - 0.03);
  for (let i = 0; i < 4; i++) K.blob(gs, 0.06, 0.03, 0.05, bx + K.j(0.06), gy + 0.175, bz - 0.03 + K.j(0.05), r() * 3);
  K.ball(gs, 0.075, bx, gy + 0.085, bz + 0.07, 0);
  for (const sx of [-1, 1]) {
    K.cone(gs, 0.016, 0.055, bx + sx * 0.04, gy + 0.16, bz + 0.08, 4, [0, 0, -sx * 0.45]);
    K.cone(gs, 0.014, 0.04, bx + sx * 0.075, gy + 0.11, bz + 0.07, 4, [0, 0, -sx * 1.2]);
    K.box(C.shadow, 0.02, 0.014, 0.006, bx + sx * 0.026, gy + 0.1, bz + 0.142);
  }
  K.blob(gs, 0.065, 0.042, 0.05, bx, gy + 0.06, bz + 0.13);
  K.box(C.shadow, 0.05, 0.008, 0.006, bx, gy + 0.043, bz + 0.155);
  K.cyl(PAL.timber, 0.025, 0.06, bx + 0.13, 0.25, bz + 0.07, 7, [0, 0, PI / 2]);
  K.rod(PAL.timberLight, bx + 0.13, 0.25, bz + 0.07, bx + 0.13, 0.25, bz - 0.06, 0.008, 4);
  K.rod(PAL.iron, bx - 0.14, 0.235, bz + 0.06, bx - 0.12, 0.235, bz - 0.04, 0.006, 4);
  for (let i = 0; i < 8; i++) K.box(gs, 0.025, 0.012, 0.02, bx + K.j(0.2), 0.006, bz + 0.15 + K.j(0.08), r() * 3);

  // shear-legs hoist with a block on the hook
  const hx = 0.42, hz = 0.38, ay = 1.22;
  const legs: [number, number][] = [];
  for (let k = 0; k < 3; k++) {
    const a = k * 2 * PI / 3 + 0.3, lx = hx + Math.sin(a) * 0.38, lz = hz + Math.cos(a) * 0.38;
    K.rod(T, lx, 0, lz, hx, ay + 0.04, hz, 0.022, 6);
    legs.push([lx, lz]);
  }
  K.box(T, 0.07, 0.07, 0.07, hx, ay, hz);
  K.cyl(C.rope, 0.045, 0.05, hx, ay - 0.04, hz, 8);
  K.rod(PAL.iron, hx, ay - 0.03, hz, hx, ay - 0.09, hz, 0.008);
  K.cyl(PAL.timberLight, 0.042, 0.022, hx, ay - 0.1, hz, 10, [PI / 2, 0, 0]);
  const tl = 0.32 / (ay + 0.04), [l0x, l0z] = legs[0];
  K.rope(C.rope, hx + 0.04, ay - 0.1, hz, l0x + (hx - l0x) * tl, 0.32, l0z + (hz - l0z) * tl, 0.03, 0.006, 4);
  K.cyl(C.rope, 0.03, 0.04, l0x + (hx - l0x) * tl, 0.32, l0z + (hz - l0z) * tl, 6);
  const L = K.sub();
  L.rod(C.rope, 0, 0, 0, 0, -0.6, 0, 0.006, 4);
  L.add(PAL.iron, GEO.torus(0.2, 8, 3, PI * 1.5), 0.05, 0.05, 0.05, 0, -0.62, 0, [PI / 2, 0, 0]);
  for (const sx of [-0.06, 0.06]) L.rod(C.rope, 0, -0.64, 0, sx, -0.72, 0, 0.005, 3);
  L.box(PAL.stoneWarm, 0.17, 0.12, 0.13, 0, -0.78, 0, 0.3);
  const lg = K.attach(L.build(), hx - 0.04, ay - 0.1, hz);
  const ph = r() * 10;
  K.anim(env => {
    lg.rotation.x = Math.sin(env.time * 1.1 + ph) * (0.02 + env.wind * 0.06);
    lg.rotation.z = Math.sin(env.time * 0.83 + ph * 1.7) * (0.015 + env.wind * 0.05);
    lg.rotation.y = Math.sin(env.time * 0.4 + ph) * 0.3;
  });

  // a wheelbarrow and a heap of rubble
  const wx = -0.02, wz = 0.74, wr = 0.35, wc = Math.cos(wr), ws = Math.sin(wr);
  const at = (u: number): [number, number] => [wx + u * wc, wz - u * ws];
  K.box(PAL.timberLight, 0.24, 0.08, 0.18, wx, 0.17, wz, [0, wr, 0.08]);
  { const [qx, qz] = at(0.17); K.cyl(T, 0.06, 0.025, qx, 0.06, qz, 9, [PI / 2, wr, 0]); }
  for (const v of [-0.06, 0.06]) {
    const [ax, az] = at(-0.12), [bx2, bz2] = at(-0.32);
    K.rod(T, ax + v * ws, 0.15, az + v * wc, bx2 + v * ws, 0.18, bz2 + v * wc, 0.01, 4);
    K.rod(T, ax + v * ws, 0.13, az + v * wc, ax + v * ws, 0, az + v * wc, 0.01, 4);
  }
  K.box(PAL.stone, 0.12, 0.08, 0.1, wx, 0.24, wz, wr + 0.4);
  for (let i = 0; i < 9; i++) K.blob(pick(r, stones), 0.07 + r() * 0.05, 0.05 + r() * 0.04, 0.07 + r() * 0.05, 0.68 + K.j(0.1), 0.02 + (i > 5 ? 0.04 : 0), -0.06 + K.j(0.1), r() * 3);

  K.door.set(0, 0, 0.95);
  K.perch.set(0, 0.86, -0.6);
  return K.finish();
};

// ───────────── bailiff's post (2x2) ─────────────

export const bailiffsPost: BodyBuilder = (look) => {
  const K = Kit.of(look), r = K.r;
  const stone = tint(pick(r, [PAL.stoneDark, PAL.stone]), look.variant, 0.04);
  const plaster = pick(r, [PAL.plasterGrey, PAL.plaster]);
  const roofC = pick(r, [PAL.slateDark, PAL.slate]);
  const shut = pick(r, [PAL.doorGreen, PAL.doorBlue, PAL.doorRed]);
  const T = PAL.timber;
  const x0 = -0.62, x1 = 0.62, z0 = -0.55, z1 = 0.48, cz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0, H1 = 0.62, H2 = 0.98;

  K.slab(PAL.stoneDark, W + 0.07, 0.07, D + 0.07, 0, 0, cz);
  K.slab(wallP(stone), W, H1, D, 0, 0, cz);
  for (let i = 0; i < 18; i++) {
    const front = i < 11, u = front ? -0.55 + (i % 6) * 0.22 + K.j(0.03) : z0 + 0.1 + (i % 4) * 0.25;
    const y = 0.1 + Math.floor(i / 6) % 3 * 0.17 + K.j(0.03), c = i % 3 ? PAL.stone : PAL.rockDark;
    if (front) { if (Math.abs(u + 0.18) > 0.22 && Math.abs(u - 0.32) > 0.16) K.box(c, 0.16, 0.09, 0.016, u, y, z1 + 0.005); }
    else K.box(c, 0.016, 0.09, 0.16, x1 + 0.005, y, u);
  }
  K.box(T, W + 0.08, 0.075, D + 0.08, 0, H1 + 0.035, cz);
  K.slab(wallP(plaster), W, H2 - H1 - 0.07, D, 0, H1 + 0.07, cz);
  for (const px of [x0, -0.2, 0.2, x1]) K.box(T, 0.06, H2 - H1 - 0.07, 0.03, px, (H1 + 0.07 + H2) / 2, z1 + 0.012);
  K.beam(T, -0.2, H1 + 0.08, z1 + 0.014, 0.2, H2 - 0.02, z1 + 0.014, 0.045, 0.03);
  K.beam(T, 0.2, H1 + 0.08, z1 + 0.014, -0.2, H2 - 0.02, z1 + 0.014, 0.045, 0.03);
  K.box(T, W + 0.04, 0.05, 0.03, 0, H2 - 0.025, z1 + 0.012);
  for (const sx of [x0, x1]) K.box(T, 0.03, H2 - H1, D, sx + (sx < 0 ? -0.006 : 0.006), (H1 + H2) / 2, cz + 0, undefined);
  for (const px of [x0, -0.2, 0.2, x1]) K.box(T, 0.06, H2 - H1 - 0.07, 0.03, px, (H1 + 0.07 + H2) / 2, z0 - 0.012);
  K.box(T, W + 0.04, 0.05, 0.03, 0, H2 - 0.025, z0 - 0.012);
  K.window({ x: 0, y: 0.83, z: z0, w: 0.15, h: 0.13, face: 'b', frame: T, shutters: shut, mull: 'v', peek: false });
  K.window({ x: -0.3, y: 0.34, z: z0, w: 0.16, h: 0.12, face: 'b', frame: PAL.stone, bars: true, mull: 'none', peek: false });
  K.window({ x: x0, y: 0.83, z: cz, w: 0.14, h: 0.13, face: 'l', frame: T, shutters: shut, mull: 'v', peek: false });
  logs(K, -0.3, 0, z0 - 0.14, 3, 0.4, 0.035, 0);
  K.add(roofP(roofC), GEO.hip(0.32), W + 0.22, 0.52, D + 0.22, 0, H2, cz);
  K.box(roofP(PAL.slateDark), (W + 0.22) * 0.32 + 0.04, 0.05, 0.05, 0, H2 + 0.51, cz, [PI / 4, 0, 0]);
  K.slab(PAL.stone, 0.18, 0.78, 0.18, 0.36, 1.0, -0.3);
  K.slab(PAL.stoneDark, 0.23, 0.04, 0.23, 0.36, 1.78, -0.3);
  K.cylT(PAL.tileDark, 0.04, 0.05, 0.08, 0.36, 1.86, -0.3, 7);
  K.chimney = new THREE.Vector3(0.36, 1.92, -0.3);

  // iron-banded door under a stone lintel, studded
  K.doorway({ x: -0.18, z: z1, w: 0.3, h: 0.5, color: 0x4a3020, iron: true, ring: true, frame: PAL.stone, step: PAL.stoneDark });
  K.box(PAL.stone, 0.46, 0.08, 0.06, -0.18, 0.55, z1 + 0.02);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) K.ball(PAL.iron, 0.009, -0.25 + j * 0.14, 0.12 + i * 0.13, z1 + 0.035);
  K.window({ x: 0.32, y: 0.38, z: z1, w: 0.22, h: 0.18, frame: PAL.stone, bars: true, mull: 'none' });
  K.window({ x: x1, y: 0.36, z: 0.0, w: 0.16, h: 0.15, face: 'r', frame: PAL.stone, bars: true, mull: 'none' });
  for (const ux of [-0.38, 0.38]) K.window({ x: ux, y: 0.83, z: z1, w: 0.15, h: 0.13, frame: T, shutters: shut, mull: 'v' });
  K.box(PAL.iron, 0.012, 0.012, 0.12, -0.18, 0.66, z1 + 0.06);
  K.lantern(-0.18, 0.66, z1 + 0.12, 1);

  // the board of keys
  const kx = -0.48;
  K.box(PAL.timberLight, 0.17, 0.21, 0.02, kx, 0.4, z1 + 0.01);
  K.box(T, 0.19, 0.02, 0.026, kx, 0.51, z1 + 0.012);
  for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) {
    const ix = kx - 0.05 + j * 0.05, iy = 0.47 - i * 0.1, gold = (i + j + look.variant) % 3 === 0;
    const kc = gold ? PAL.gold : PAL.iron;
    K.ball(PAL.iron, 0.005, ix, iy, z1 + 0.024);
    K.ring(kc, 0.011, 0.004, ix, iy - 0.014, z1 + 0.026, [PI / 2, 0, 0], 6);
    K.box(kc, 0.006, 0.04, 0.005, ix, iy - 0.045, z1 + 0.026);
    K.box(kc, 0.014, 0.008, 0.005, ix + 0.008, iy - 0.06, z1 + 0.026);
  }

  // the post: crossed keys on crimson hung from its arm, and a decree that will not lie flat
  const nx = 0.6, nz = 0.74;
  K.slab(T, 0.055, 1.06, 0.055, nx, 0, nz);
  K.box(T, 0.08, 0.025, 0.08, nx, 1.07, nz);
  K.blob(PAL.stone, 0.11, 0.05, 0.1, nx, 0.015, nz, 0.4);
  K.box(T, 0.36, 0.04, 0.045, nx - 0.16, 1.0, nz);
  K.beam(T, nx, 0.82, nz, nx - 0.14, 0.99, nz, 0.03);
  const Kg = K.sub(), signMat = tradeSignAtlas();
  for (const sx of [-0.075, 0.075]) Kg.rod(PAL.iron, 0, 0, 0, sx, -0.05, 0, 0.004, 3);
  Kg.box(T, 0.24, 0.24, 0.026, 0, -0.17, 0);
  Kg.plane(signMat, tradeSignCell(0), 0.21, 0.21, 0, -0.17, 0.0142);
  Kg.plane(signMat, tradeSignCell(0), 0.21, 0.21, 0, -0.17, -0.0142, PI);
  const kg = K.attach(Kg.build(), nx - 0.22, 0.98, nz);
  const P = K.sub();
  P.plane(noticeAtlas(), NOTICE_CELLS.decree(), 0.14, 0.18, 0, -0.09, 0, [0, 0, 0.04]);
  const pg = K.attach(P.build(), nx, 0.6, nz + 0.03);
  K.ball(PAL.ink, 0.008, nx, 0.588, nz + 0.036);
  const ph = r() * 10;
  K.anim(env => {
    pg.rotation.x = -(0.03 + env.wind * 0.35) * (0.5 + 0.5 * Math.sin(env.time * (1.9 + env.wind) + ph));
    kg.rotation.x = Math.sin(env.time * 1.15 + ph) * (0.03 + env.wind * 0.26);
  });

  bench(K, 0.3, z1 + 0.09, 0.4, 0, T);
  barrel(K, -0.73, 0, 0.22, 1.05, false, 0, PAL.timberLight);
  K.cyl(PAL.waterDeep, 0.06, 0.004, -0.73, 0.212, 0.22, 8);

  K.perch.set(0, H2 + 0.53, cz);
  return K.finish();
};

// ───────────── crier's stand (1x1) ─────────────

export const criersStand: BodyBuilder = (look) => {
  const K = Kit.of(look), r = K.r;
  const schemes: [number, number, number][] = [[PAL.crimson, PAL.gold, PAL.clothCream], [PAL.lapis, PAL.clothCream, PAL.gold], [PAL.clothOchre, PAL.crimson, PAL.clothCream], [PAL.verdigris, PAL.clothCream, PAL.gold]];
  const [base, stripe, cloth] = schemes[look.variant % schemes.length];
  const T = PAL.timber;

  // the painted box, with a step
  K.slab(wallP(base), 0.34, 0.2, 0.28, 0, 0, -0.02);
  for (let i = -1; i <= 1; i++) {
    K.box(stripe, 0.035, 0.17, 0.004, i * 0.11, 0.1, 0.122);
    K.box(stripe, 0.004, 0.17, 0.035, -0.172, 0.1, -0.02 + i * 0.09);
    K.box(stripe, 0.004, 0.17, 0.035, 0.172, 0.1, -0.02 + i * 0.09);
  }
  K.box(PAL.gold, 0.36, 0.022, 0.3, 0, 0.2, -0.02);
  K.box(T, 0.36, 0.02, 0.3, 0, 0.01, -0.02);
  K.slab(T, 0.22, 0.09, 0.1, 0, 0, 0.17);
  // canopy on four thin poles, striped, with a scalloped edge
  for (const [px, pz, h] of [[-0.18, -0.15, 1.0], [0.18, -0.15, 1.0], [-0.18, 0.15, 0.85], [0.18, 0.15, 0.85]] as const) K.rod(T, px, 0, pz, px, h, pz, 0.012, 5);
  const ang = Math.atan2(0.16, 0.38);
  for (let i = 0; i < 4; i++) K.box(roofP(i % 2 ? cloth : base), 0.11, 0.016, 0.44, -0.165 + i * 0.11, 0.935, 0.0, [ang, 0, 0]);
  valance(K, -0.22, 0.22, 0.85, 0.2, [base, cloth], 6, 0.06);
  K.ball(PAL.gold, 0.02, -0.18, 1.01, -0.15); K.ball(PAL.gold, 0.02, 0.18, 1.01, -0.15);
  // the bell on its post
  K.rod(T, 0.29, 0, 0.24, 0.29, 0.96, 0.24, 0.014, 5);
  K.box(T, 0.12, 0.022, 0.022, 0.24, 0.94, 0.24);
  K.beam(T, 0.29, 0.86, 0.24, 0.22, 0.94, 0.24, 0.014);
  const Bl = K.sub();
  Bl.add(C.bell, GEO.bell(), 0.075, 0.07, 0.075, 0, -0.085, 0);
  Bl.ball(PAL.iron, 0.012, 0, -0.09, 0);
  Bl.rod(C.rope, 0, -0.09, 0, 0, -0.3, 0, 0.004, 3);
  Bl.box(T, 0.02, 0.02, 0.02, 0, -0.008, 0);
  const bg = K.attach(Bl.build(), 0.2, 0.93, 0.24);
  const ph = r() * 10;
  K.anim(env => {
    bg.rotation.z = Math.sin(env.time * 1.7 + ph) * (0.03 + env.wind * 0.18);
    bg.rotation.x = Math.sin(env.time * 1.3 + ph) * (0.02 + env.wind * 0.1);
  });
  // a speaking horn and a stack of handbills
  K.cylT(PAL.brass, 0.05, 0.012, 0.22, -0.22, 0.1, 0.2, 9, [0.5, 0.4, -0.2]);
  K.box(PAL.parchment, 0.1, 0.03, 0.08, 0.06, 0.226, -0.06, 0.3);
  K.box(PAL.parchment, 0.08, 0.004, 0.06, -0.08, 0.214, 0.02, -0.4);
  K.box(PAL.parchment, 0.08, 0.004, 0.06, 0.08, 0.004, 0.3, 0.9);

  K.door.set(0, 0, 0.45);
  K.perch.set(0, 1.0, -0.12);
  return K.finish();
};

// ───────────── counting house (2x2) ─────────────

export const countingHouse: BodyBuilder = (look) => {
  const K = Kit.of(look), r = K.r;
  const brick = tint(PAL.brick, look.variant, 0.04);
  const plaster = pick(r, [PAL.plaster, PAL.plasterWarm]);
  const roofC = pick(r, [PAL.tileDark, PAL.tile, PAL.slate]);
  const doorC = pick(r, [PAL.doorBlue, PAL.doorGreen, PAL.lapis]);
  const T = PAL.timber, SW = PAL.stoneWarm;
  const x0 = -0.64, x1 = 0.64, z0 = -0.55, z1 = 0.45, cz = (z0 + z1) / 2, W = x1 - x0, D = z1 - z0, H1 = 0.6, H2 = 1.06;

  K.slab(PAL.stone, W + 0.06, 0.07, D + 0.06, 0, 0, cz);
  K.slab(wallP(brick), W, H1, D, 0, 0, cz);
  for (const qx of [x0, x1]) for (let k = 0; k < 5; k++) K.box(SW, k % 2 ? 0.08 : 0.13, 0.1, 0.03, qx + (qx < 0 ? 1 : -1) * (k % 2 ? 0.035 : 0.06), 0.12 + k * 0.11, z1 + 0.006);
  K.box(SW, W + 0.06, 0.05, D + 0.06, 0, H1 + 0.025, cz);
  K.slab(wallP(plaster), W, H2 - H1 - 0.05, D, 0, H1 + 0.05, cz);
  for (let i = 0; i <= 10; i++) { const u = x0 + i * W / 10; if (Math.abs(u - 0.32) > 0.12 && Math.abs(u + 0.32) > 0.12) K.box(T, 0.035, H2 - H1 - 0.05, 0.02, u, (H1 + 0.05 + H2) / 2, z1 + 0.008); }
  K.box(T, W + 0.03, 0.04, 0.025, 0, H1 + 0.07, z1 + 0.01);
  K.box(T, W + 0.03, 0.045, 0.025, 0, H2 - 0.02, z1 + 0.01);
  for (const sx of [x0, x1]) for (let i = 0; i <= 6; i++) K.box(T, 0.02, H2 - H1 - 0.05, 0.035, sx + (sx < 0 ? -0.006 : 0.006), (H1 + 0.05 + H2) / 2, z0 + 0.06 + i * (D - 0.12) / 6);
  for (let i = 0; i <= 10; i++) { const u = x0 + i * W / 10; if (Math.abs(u) > 0.1) K.box(T, 0.035, H2 - H1 - 0.05, 0.02, u, (H1 + 0.05 + H2) / 2, z0 - 0.008); }
  K.box(T, W + 0.03, 0.04, 0.025, 0, H1 + 0.07, z0 - 0.01);
  K.box(T, W + 0.03, 0.045, 0.025, 0, H2 - 0.02, z0 - 0.01);
  K.window({ x: 0, y: 0.84, z: z0, w: 0.15, h: 0.15, face: 'b', frame: T, shutters: doorC, mull: 'cross', peek: false });
  K.window({ x: 0.32, y: 0.36, z: z0, w: 0.15, h: 0.17, face: 'b', frame: SW, mull: 'cross', bars: true, peek: false });
  for (const qx of [x0, x1]) for (let k = 0; k < 5; k++) K.box(SW, k % 2 ? 0.08 : 0.13, 0.1, 0.03, qx + (qx < 0 ? 1 : -1) * (k % 2 ? 0.035 : 0.06), 0.12 + k * 0.11, z0 - 0.006);
  // hipped roof with finials, the chimney
  K.add(roofP(roofC), GEO.hip(0.3), W + 0.2, 0.56, D + 0.2, 0, H2, cz);
  K.box(roofP(roofC === PAL.slate ? PAL.slateDark : PAL.tileDark), (W + 0.2) * 0.3 + 0.04, 0.05, 0.05, 0, H2 + 0.55, cz, [PI / 4, 0, 0]);
  for (const sx of [-1, 1]) K.ball(PAL.gold, 0.025, sx * (W + 0.2) * 0.15, H2 + 0.6, cz);
  K.slab(brick, 0.2, 0.78, 0.16, -0.32, 1.02, -0.15);
  K.slab(SW, 0.25, 0.04, 0.2, -0.32, 1.8, -0.15);
  for (const px of [-0.05, 0.05]) K.cylT(PAL.tileDark, 0.032, 0.04, 0.08, -0.32 + px, 1.88, -0.15, 7);
  K.chimney = new THREE.Vector3(-0.32, 1.94, -0.15);

  // door under a little pediment; the counter window with its shutters
  K.doorway({ x: -0.22, z: z1, w: 0.28, h: 0.5, color: doorC, frame: SW, step: PAL.stone });
  K.add(SW, GEO.tri(), 0.05, 0.1, 0.4, -0.22, 0.54, z1 + 0.02, PI / 2);
  const wx = 0.3;
  K.window({ x: wx, y: 0.42, z: z1, w: 0.42, h: 0.26, mull: 'v', frame: T, sill: false });
  K.box(PAL.timberLight, 0.46, 0.03, 0.16, wx, 0.275, z1 + 0.08);
  for (const sx of [-0.18, 0.18]) K.beam(T, wx + sx, 0.17, z1 + 0.01, wx + sx, 0.265, z1 + 0.14, 0.022);
  K.box(PAL.timberLight, 0.46, 0.025, 0.16, wx, 0.59, z1 + 0.072, [-0.42, 0, 0]);
  for (const sx of [-0.2, 0.2]) K.rod(T, wx + sx, 0.29, z1 + 0.14, wx + sx, 0.6, z1 + 0.14, 0.007);
  for (let s = 0; s < 3; s++) for (let k = 0; k < 2 + s; k++) K.cyl(PAL.gold, 0.018, 0.009, wx - 0.17 + s * 0.04, 0.296 + k * 0.01, z1 + 0.09 + (s % 2) * 0.02, 8);
  K.box(PAL.crimson, 0.13, 0.012, 0.09, wx + 0.05, 0.296, z1 + 0.085, 0.1);
  K.box(PAL.parchment, 0.06, 0.008, 0.08, wx + 0.02, 0.305, z1 + 0.085, [0, 0.1, 0.08]);
  K.box(PAL.parchment, 0.06, 0.008, 0.08, wx + 0.08, 0.305, z1 + 0.085, [0, 0.1, -0.08]);
  K.cyl(PAL.ink, 0.015, 0.025, wx + 0.16, 0.302, z1 + 0.09, 7);
  K.rod(PAL.parchment, wx + 0.16, 0.31, z1 + 0.09, wx + 0.19, 0.38, z1 + 0.07, 0.006, 4);
  for (const ux of [-0.32, 0.32]) K.window({ x: ux, y: 0.84, z: z1, w: 0.17, h: 0.16, frame: T, shutters: doorC, mull: 'cross' });

  // the strongbox, chained to the wall in case it is homesick
  const sx = -0.52, sz = z1 + 0.13;
  K.slab(PAL.stone, 0.22, 0.04, 0.15, sx, 0, sz);
  K.slab(0x4a3020, 0.18, 0.1, 0.12, sx, 0.04, sz);
  K.box(0x4a3020, 0.19, 0.03, 0.13, sx, 0.155, sz);
  for (const u of [-0.06, 0.06]) K.box(PAL.iron, 0.016, 0.14, 0.13, sx + u, 0.11, sz);
  K.box(PAL.gold, 0.03, 0.035, 0.012, sx, 0.11, sz + 0.065);
  K.add(PAL.gold, GEO.torus(0.2, 8, 3, PI), 0.024, 0.024, 0.024, sx, 0.128, sz + 0.065, [-PI / 2, 0, 0]);
  K.ring(PAL.iron, 0.022, 0.006, -0.6, 0.3, z1 + 0.01, [PI / 2, 0, 0], 8);
  K.rope(PAL.iron, sx - 0.09, 0.1, sz - 0.03, -0.6, 0.28, z1 + 0.01, 0.05, 0.006, 5);

  // the sign: a pair of scales in gold on lapis, hung out from the upper floor
  const brx = 0.55, bry = 0.99;
  K.box(PAL.iron, 0.018, 0.018, 0.28, brx, bry, z1 + 0.14);
  K.beam(PAL.iron, brx, bry - 0.13, z1 + 0.005, brx, bry - 0.01, z1 + 0.2, 0.012);
  K.ring(PAL.iron, 0.022, 0.006, brx, bry + 0.022, z1 + 0.27, [PI / 2, PI / 2, 0], 8);
  const Sg = K.sub(), signMat = tradeSignAtlas();
  for (const sx of [-0.08, 0.08]) Sg.rod(PAL.iron, 0, 0, 0, sx, -0.05, 0, 0.004, 3);
  Sg.box(T, 0.25, 0.25, 0.026, 0, -0.18, 0);
  Sg.plane(signMat, tradeSignCell(1), 0.22, 0.22, 0, -0.18, 0.0142);
  Sg.plane(signMat, tradeSignCell(1), 0.22, 0.22, 0, -0.18, -0.0142, PI);
  const sign = K.attach(Sg.build(), brx, bry - 0.005, z1 + 0.24);
  const ph = r() * 10;
  K.anim(env => { sign.rotation.x = Math.sin(env.time * 1.05 + ph) * (0.03 + env.wind * 0.26) + Math.sin(env.time * 2.8 + ph) * env.wind * 0.06; });

  // a queue rail before the counter, and one clipped bay tree
  for (const qx of [0.06, 0.58]) { K.slab(T, 0.035, 0.22, 0.035, qx, 0, 0.78); K.ball(PAL.brass, 0.022, qx, 0.235, 0.78); }
  K.rope(PAL.crimson, 0.06, 0.205, 0.78, 0.58, 0.205, 0.78, 0.05, 0.011, 5);
  K.cylT(PAL.tile, 0.045, 0.034, 0.07, 0.015, 0.035, z1 + 0.06, 8);
  K.rod(PAL.timber, 0.015, 0.07, z1 + 0.06, 0.015, 0.18, z1 + 0.06, 0.006, 4);
  K.ball(mix(PAL.leafSummer, PAL.pine, 0.4), 0.06, 0.015, 0.22, z1 + 0.06, 1);
  flowers(K, 0.015, 0.05, z1 + 0.06, 2, 0.02, [PAL.parchment]);

  K.perch.set(0, H2 + 0.58, cz);
  return K.finish();
};
