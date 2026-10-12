/**
 * OWNER: render-civic. Bodies for the amenities: well, garden, notice board,
 * wayside shrine, stocks, statue of yourself, watchtower, chapel.
 */
import * as THREE from 'three';
import { PAL, mat, tint, mix } from '../palette';
import type { BodyBuilder } from './types';
import { Kit, GEO, C, pick, wallP, roofP, flowers, noticeAtlas, NOTICE_CELLS, roofCourses, flameGlow } from './civic-parts';
import type { Paint } from './civic-parts';

const PI = Math.PI;
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ───────────── well (1x1) ─────────────

export const well: BodyBuilder = (look) => {
  const K = Kit.of(look), r = K.r;
  const roofC = pick(r, [PAL.thatch, PAL.slate, PAL.timberLight, PAL.thatchOld]);
  const stone = tint(pick(r, [PAL.stone, PAL.stoneWarm]), look.variant, 0.05);
  const T = PAL.timber;

  K.cyl(PAL.cobble, 0.37, 0.03, 0, 0.015, 0, 8, PI / 8);
  K.cyl(wallP(stone), 0.25, 0.31, 0, 0.185, 0, 10);
  for (let i = 0; i < 12; i++) {
    const a = i * 0.524 + (i % 2) * 0.26, y = 0.08 + (i % 3) * 0.085;
    K.box(i % 2 ? PAL.stoneDark : PAL.stoneWarm, 0.11, 0.065, 0.03, Math.sin(a) * 0.245, y, Math.cos(a) * 0.245, a);
  }
  K.ring(PAL.stoneDark, 0.235, 0.05, 0, 0.34, 0, undefined, 10);
  K.cyl(PAL.waterDeep, 0.2, 0.01, 0, 0.27, 0, 10);
  for (let i = 0; i < 3; i++) { const a = r() * PI * 2; K.blob(PAL.moss, 0.06, 0.02, 0.04, Math.sin(a) * 0.26, 0.37, Math.cos(a) * 0.26, a); }

  // posts, beams, roof
  for (const sx of [-1, 1]) {
    K.slab(T, 0.05, 0.56, 0.05, sx * 0.29, 0.3, 0);
    K.beam(T, sx * 0.29, 0.68, 0, sx * 0.29, 0.84, 0.13, 0.025);
    K.beam(T, sx * 0.29, 0.68, 0, sx * 0.29, 0.84, -0.13, 0.025);
  }
  K.box(T, 0.66, 0.045, 0.05, 0, 0.84, 0);
  for (const sz of [-0.13, 0.13]) K.box(T, 0.66, 0.03, 0.03, 0, 0.845, sz);
  const thatch = roofC === PAL.thatch || roofC === PAL.thatchOld;
  const ro = { x: 0, y: 0.86, z: 0, span: 0.3, len: 0.6, rise: 0.2, t: thatch ? 0.06 : 0.035, over: 0.1, ends: 0.05, axis: 'x' as const };
  const rf = K.gable(roofP(roofC), ro);
  if (thatch) K.cyl(roofP(PAL.thatchOld), 0.035, 0.74, 0, rf.ridge - 0.015, 0, 6, [0, 0, PI / 2]);
  else roofCourses(K, roofP(roofC === PAL.slate ? PAL.slateDark : PAL.timber), { ...ro, n: 2 });

  // windlass, rope, crank
  K.cyl(PAL.timberLight, 0.035, 0.56, 0, 0.6, 0, 6, [0, 0, PI / 2]);
  K.cyl(C.rope, 0.047, 0.12, 0, 0.6, 0, 8, [0, 0, PI / 2]);
  K.box(PAL.iron, 0.012, 0.1, 0.012, 0.335, 0.555, 0);
  K.rod(T, 0.335, 0.51, 0, 0.4, 0.51, 0, 0.012);
  if (look.variant % 2) {
    K.cylT(PAL.timberLight, 0.05, 0.042, 0.07, 0.25, 0.065, 0.24, 8);
    K.cyl(PAL.iron, 0.051, 0.008, 0.25, 0.08, 0.24, 8);
  } else {
    K.blob(PAL.stone, 0.08, 0.05, 0.06, -0.26, 0.04, 0.25, 0.4);
  }

  // the bucket on its rope
  const B = K.sub();
  B.rod(C.rope, 0, 0, 0, 0, -0.15, 0, 0.006, 4);
  B.cylT(PAL.timberLight, 0.055, 0.045, 0.075, 0, -0.19, 0, 8);
  for (const y of [-0.168, -0.212]) B.cyl(PAL.iron, 0.054, 0.008, 0, y, 0, 8);
  B.add(PAL.iron, GEO.torus(0.12, 8, 3, PI), 0.11, 0.11, 0.11, 0, -0.152, 0, [-PI / 2, 0, 0]);
  B.cyl(PAL.water, 0.047, 0.004, 0, -0.157, 0, 8);
  const bg = K.attach(B.build(), 0, 0.6, 0.045);
  const ph = r() * 10;
  K.anim(env => {
    bg.rotation.x = Math.sin(env.time * 1.4 + ph) * (0.03 + env.wind * 0.22);
    bg.rotation.z = Math.sin(env.time * 1.07 + ph * 1.3) * (0.02 + env.wind * 0.12);
  });

  K.door.set(0, 0, 0.5);
  K.perch.set(0, rf.ridge + 0.01, 0);
  return K.finish();
};

// ───────────── garden (2x2) ─────────────

export const garden: BodyBuilder = (look) => {
  const K = Kit.of(look), r = K.r;
  const T = PAL.timber, F = 0.8, gate = 0.16;
  const hive = look.variant % 2 === 1;
  const wattle = wallP(tint(C.wattle, look.variant, 0.05));

  // wattle fence: posts, and two woven bands that weave in and out
  const side = (ax: 'x' | 'z', fixed: number, from: number, to: number, out: number) => {
    const n = Math.max(1, Math.round((to - from) / 0.2)), step = (to - from) / n;
    for (let i = 0; i <= n; i++) {
      const u = from + i * step;
      ax === 'x' ? K.cyl(T, 0.016, 0.3, u, 0.15, fixed, 5) : K.cyl(T, 0.016, 0.3, fixed, 0.15, u, 5);
    }
    for (let i = 0; i < n; i++) {
      const u = from + (i + 0.5) * step;
      for (const [y, ph] of [[0.09, 0], [0.19, 1]] as const) {
        const off = ((i + ph) % 2 ? 0.009 : -0.009) * out;
        ax === 'x' ? K.box(wattle, step + 0.01, 0.055, 0.026, u, y, fixed + off) : K.box(wattle, 0.026, 0.055, step + 0.01, fixed + off, y, u);
      }
    }
  };
  side('x', -F, -F, F, -1);
  side('z', -F, -F, F, -1);
  side('z', F, -F, F, 1);
  side('x', F, -F, -gate, 1);
  side('x', F, gate, F, 1);
  // the gate, left open
  const ga = 1.92;
  const gcx = gate + Math.cos(ga) * 0.15, gcz = F - Math.sin(ga) * 0.15;
  for (const y of [0.07, 0.19]) K.box(PAL.timberLight, 0.3, 0.03, 0.02, gcx, y, gcz, ga);
  for (const u of [-0.12, 0, 0.12]) K.box(PAL.timberLight, 0.025, 0.2, 0.02, gcx + Math.cos(ga) * u, 0.13, gcz - Math.sin(ga) * u, ga);

  // raised beds with board edges, a stepping-stone path
  for (const bx of [-0.44, 0.44]) {
    K.slab(PAL.dirtDark, 0.56, 0.05, 1.3, bx, 0, -0.04);
    for (const sx of [-0.29, 0.29]) K.slab(T, 0.025, 0.07, 1.32, bx + sx, 0, -0.04);
    for (const sz of [-0.7, 0.62]) K.slab(T, 0.6, 0.07, 0.025, bx, 0, sz);
    for (let i = 0; i < 6; i++) K.box(PAL.dirt, 0.5, 0.01, 0.03, bx, 0.052, -0.6 + i * 0.22);
  }
  for (let i = 0; i < 6; i++) K.cyl(PAL.cobble, 0.065, 0.025, K.j(0.025), 0.012, 0.72 - i * 0.26, 7, r() * 3);

  const cabbage = (x: number, z: number, s = 1) => {
    K.ball(C.cabbage, 0.058 * s, x, 0.1, z, 0, 0.85);
    for (let k = 0; k < 4; k++) {
      const a = k * PI / 2 + r();
      K.blob(k % 2 ? C.cabbageDark : C.leaf, 0.1 * s, 0.026 * s, 0.065 * s, x + Math.cos(a) * 0.04 * s, 0.075, z + Math.sin(a) * 0.04 * s, [0.25, -a, 0]);
    }
  };
  // left bed: cabbages in two rows
  for (const bx of [-0.57, -0.31]) for (let i = 0; i < 5; i++) cabbage(bx + K.j(0.012), -0.52 + i * 0.25, 0.9 + r() * 0.25);
  // right bed: beans up canes at the back, cabbages or leeks at the front
  for (const [tx, tz] of [[0.31, -0.46], [0.57, -0.46]] as const) {
    for (let k = 0; k < 4; k++) { const a = k * PI / 2 + 0.4; K.rod(PAL.timberLight, tx + Math.cos(a) * 0.09, 0.05, tz + Math.sin(a) * 0.09, tx, 0.5, tz, 0.006, 4); }
    for (let k = 0; k < 10; k++) { const h = 0.1 + r() * 0.34, a = r() * PI * 2, rr = 0.09 * (1 - (h - 0.05) / 0.45); K.ball(k % 3 ? C.leaf : C.leafDark, 0.03, tx + Math.cos(a) * rr, h, tz + Math.sin(a) * rr, 0); }
    K.ball(PAL.parchment, 0.012, tx + 0.04, 0.3, tz + 0.05);
  }
  if (look.variant % 4 < 2) for (const bx of [0.31, 0.57]) for (let i = 0; i < 3; i++) cabbage(bx, 0.0 + i * 0.25, 0.95);
  else for (const bx of [0.31, 0.44, 0.57]) for (let i = 0; i < 4; i++) {
    K.cylT(PAL.parchment, 0.012, 0.016, 0.07, bx, 0.085, -0.02 + i * 0.18, 5);
    K.cone(C.leaf, 0.03, 0.16, bx + 0.01, 0.19, -0.02 + i * 0.18, 4, [0, 0, 0.12]);
    K.cone(C.leafDark, 0.025, 0.13, bx - 0.01, 0.18, -0.02 + i * 0.18, 4, [0, 0, -0.15]);
  }
  // marigolds along the back fence and the path
  flowers(K, -0.4, 0.0, -0.75, 7, 0.3, [C.marigold, C.marigoldY]);
  flowers(K, 0.4, 0.0, -0.75, 4, 0.12, [C.marigold, C.marigoldY]);
  for (let i = 0; i < 6; i++) {
    const z = 0.6 - i * 0.24;
    K.ball(C.leaf, 0.022, -0.11, 0.07, z, 0, 0.7); K.ball(i % 2 ? C.marigold : C.marigoldY, 0.017, -0.11, 0.095, z);
    K.ball(C.leaf, 0.022, 0.11, 0.07, z + 0.1, 0, 0.7); K.ball(i % 2 ? C.marigoldY : C.marigold, 0.017, 0.11, 0.095, z + 0.1);
  }
  // a watering can by the gate
  K.cylT(PAL.verdigris, 0.04, 0.045, 0.08, 0.3, 0.04, 0.7, 8);
  K.rod(PAL.verdigris, 0.33, 0.04, 0.7, 0.42, 0.11, 0.7, 0.008, 4);
  K.add(PAL.verdigris, GEO.torus(0.14, 8, 3, PI), 0.07, 0.07, 0.07, 0.3, 0.08, 0.7, [-PI / 2, PI / 2, 0]);

  if (!hive) {
    // a scarecrow, ignored by a crow
    const S = K.sub();
    S.rod(T, 0, 0, 0, 0, 0.62, 0, 0.014);
    S.rod(T, -0.19, 0.44, 0, 0.19, 0.44, 0, 0.011);
    const coat = pick(r, [PAL.clothBlue, PAL.clothRed, PAL.clothGreen, PAL.clothBrown]);
    S.box(coat, 0.15, 0.2, 0.08, 0, 0.38, 0);
    S.box(pick(r, [PAL.clothOchre, PAL.clothCream, PAL.clothPlum]), 0.05, 0.05, 0.004, 0.035, 0.34, 0.042);
    for (const sx of [-1, 1]) {
      S.box(coat, 0.12, 0.055, 0.055, sx * 0.13, 0.44, 0);
      S.cone(C.straw, 0.03, 0.07, sx * 0.215, 0.44, 0, 5, [0, 0, -sx * PI / 2]);
    }
    S.cone(C.straw, 0.05, 0.06, 0, 0.26, 0, 5, [PI, 0, 0]);
    S.ball(C.sack, 0.068, 0, 0.57, 0, 1);
    for (const sx of [-0.024, 0.024]) S.box(PAL.ink, 0.016, 0.016, 0.01, sx, 0.585, 0.062, [0, 0, PI / 4]);
    S.box(PAL.ink, 0.04, 0.006, 0.01, 0, 0.55, 0.064);
    const hat = pick(r, [PAL.clothBrown, PAL.clothBlack, PAL.thatchOld]);
    S.cyl(hat, 0.11, 0.012, 0, 0.625, 0, 10, [0.1, 0, 0.08]);
    S.cylT(hat, 0.05, 0.062, 0.08, 0, 0.67, 0, 8, [0.1, 0, 0.08]);
    const sg = K.attach(S.build(), 0.44, 0.05, -0.12);
    const W = K.sub();
    W.blob(C.crow, 0.04, 0.04, 0.07, 0, 0.03, 0, [-0.2, 0, 0]);
    W.box(C.crow, 0.03, 0.01, 0.05, 0, 0.03, -0.05, [-0.4, 0, 0]);
    W.ball(C.crow, 0.024, 0, 0.065, 0.03);
    W.cone(C.beak, 0.008, 0.025, 0, 0.065, 0.06, 4, [PI / 2, 0, 0]);
    const crow = W.build();
    crow.position.set(-0.17 * K.m, 0.47, 0);
    sg.add(crow);
    const ph = r() * 10;
    K.anim(env => {
      sg.rotation.z = Math.sin(env.time * 1.2 + ph) * (0.01 + env.wind * 0.05);
      const k = Math.floor((env.time + ph) / 3.3);
      crow.rotation.y = (hash(k + ph) - 0.5) * 2.6;
      const u = (env.time + ph) / 3.3 - k;
      crow.position.y = 0.47 + (u < 0.12 ? Math.sin(u / 0.12 * PI) * 0.03 : 0);
    });
    K.perch.set(0.44, 0.78, -0.12);
  } else {
    // a straw skep on a stand, and its bees
    const hx = -0.56, hz = -0.55;
    K.slab(PAL.timberLight, 0.22, 0.02, 0.22, hx, 0.2, hz);
    for (const [lx, lz] of [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]] as const) K.slab(T, 0.025, 0.2, 0.025, hx + lx, 0, hz + lz);
    const skep = roofP(C.straw);
    const rings = [0.1, 0.098, 0.09, 0.077, 0.058];
    for (let i = 0; i < rings.length; i++) {
      K.cylT(skep, rings[i] * 0.97, rings[i], 0.045, hx, 0.245 + i * 0.042, hz, 10);
      K.ring(C.wattleLight, rings[i] * 0.98, 0.01, hx, 0.224 + i * 0.042, hz, undefined, 10);
    }
    K.dome(skep, 0.05, 0.04, hx, 0.43, hz);
    K.box(C.shadow, 0.04, 0.025, 0.01, hx, 0.235, hz + 0.1);
    const bees: THREE.Mesh[] = [];
    const beeMat = mat(PAL.clothOchre, {});
    for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(GEO.ico(0), beeMat); b.scale.setScalar(0.014); K.group.add(b); bees.push(b); }
    flowers(K, -0.3, 0.05, -0.5, 4, 0.08, [C.lavender, C.marigoldY]);
    const ph = r() * 10, bx = hx * K.m;
    K.anim(env => {
      for (let i = 0; i < bees.length; i++) {
        const t = env.time * (1.3 + i * 0.37) + ph + i * 2;
        bees[i].position.set(bx + Math.cos(t) * (0.12 + 0.05 * Math.sin(t * 2.3)), 0.3 + 0.08 * Math.sin(t * 1.7 + i), hz + Math.sin(t) * (0.14 + 0.05 * Math.cos(t * 1.9)));
      }
    });
    K.perch.set(hx, 0.48, hz);
  }

  K.door.set(0, 0, 0.98);
  return K.finish();
};

// ───────────── notice board (1x1) ─────────────

export const noticeBoard: BodyBuilder = (look) => {
  const K = Kit.of(look), r = K.r;
  const roofC = pick(r, [PAL.slate, PAL.tileDark, PAL.timber, PAL.thatchOld]);
  const T = PAL.timber, atlas = noticeAtlas();

  for (const sx of [-0.27, 0.27]) { K.slab(T, 0.05, 0.98, 0.05, sx, 0, 0); K.blob(PAL.stone, 0.1, 0.05, 0.08, sx + K.j(0.02), 0.015, 0.01, r() * 3); }
  K.box(wallP(PAL.timberLight), 0.56, 0.42, 0.035, 0, 0.6, 0);
  for (const y of [0.46, 0.6, 0.74]) K.box(T, 0.55, 0.008, 0.039, 0, y + 0.07, 0);
  for (const y of [0.385, 0.815]) K.box(T, 0.6, 0.03, 0.045, 0, y, 0);
  K.box(T, 0.64, 0.04, 0.07, 0, 0.88, 0);
  const ro = { x: 0, y: 0.9, z: 0, span: 0.16, len: 0.6, rise: 0.09, t: 0.03, over: 0.06, ends: 0.05, axis: 'x' as const };
  const rf = K.gable(roofP(roofC), ro);
  K.box(roofP(roofC === PAL.thatchOld ? PAL.thatch : PAL.slateDark), 0.72, 0.035, 0.035, 0, rf.ridge - 0.008, 0, [PI / 4, 0, 0]);

  // pinned notices: two that flutter, two that stay put
  const zf = 0.0175 + 0.003;
  K.plane(atlas, NOTICE_CELLS.cat(), 0.14, 0.14, 0.135, 0.7, zf, [0, 0, -0.07]);
  K.plane(atlas, NOTICE_CELLS.note(), 0.18, 0.22, 0, 0.6, -zf, [0, PI, 0.04]);
  K.ball(PAL.ink, 0.008, 0.13, 0.765, zf + 0.004);
  const flap = (cell: THREE.BufferGeometry, w: number, h: number, x: number, yTop: number, roll: number) => {
    const P = K.sub();
    P.plane(atlas, cell, w, h, 0, -h / 2, 0, [0, 0, roll]);
    const g = K.attach(P.build(), x, yTop, zf + 0.002);
    K.ball(PAL.ink, 0.008, x, yTop - 0.012, zf + 0.006);
    const ph = r() * 10;
    K.anim(env => {
      const g0 = 0.5 + 0.5 * Math.sin(env.time * (1.7 + env.wind) + ph);
      g.rotation.x = -(0.03 + env.wind * 0.35) * g0 * (0.7 + 0.3 * Math.sin(env.time * 7.1 + ph));
    });
  };
  flap(NOTICE_CELLS.decree(), 0.2, 0.26, -0.125, 0.765, 0.03);
  flap(NOTICE_CELLS.tolet(), 0.15, 0.15, 0.14, 0.6, 0.05);

  // a pot of paste with its brush
  K.cylT(PAL.timberLight, 0.04, 0.035, 0.06, 0.16, 0.03, 0.18, 7);
  K.cyl(PAL.parchment, 0.036, 0.004, 0.16, 0.058, 0.18, 7);
  K.rod(PAL.timber, 0.15, 0.05, 0.18, 0.2, 0.13, 0.15, 0.007, 4);

  K.door.set(0, 0, 0.45);
  K.perch.set(0, rf.ridge + 0.01, 0);
  return K.finish();
};

// ───────────── wayside shrine (1x1) ─────────────

export const shrine: BodyBuilder = (look) => {
  const K = Kit.of(look), r = K.r;
  const body = tint(pick(r, [PAL.stoneWarm, PAL.stone, PAL.plaster]), look.variant, 0.04);
  const roofC = pick(r, [PAL.slate, PAL.tile, PAL.slateDark]);
  const robe = pick(r, [PAL.lapis, PAL.clothBrown, PAL.clothCream, PAL.clothTeal]);

  K.slab(PAL.stoneDark, 0.5, 0.06, 0.46, 0, 0, 0);
  K.slab(PAL.stone, 0.42, 0.06, 0.38, 0, 0.06, 0);
  K.slab(wallP(body), 0.32, 0.46, 0.26, 0, 0.12, -0.02);
  const zf = 0.11;
  K.box(C.shadow, 0.18, 0.2, 0.012, 0, 0.32, zf + 0.004);
  K.cyl(C.shadow, 0.09, 0.012, 0, 0.42, zf + 0.004, 12, [PI / 2, 0, 0]);
  K.box(PAL.stoneDark, 0.03, 0.22, 0.03, -0.105, 0.32, zf + 0.01);
  K.box(PAL.stoneDark, 0.03, 0.22, 0.03, 0.105, 0.32, zf + 0.01);
  K.add(PAL.stoneDark, GEO.torus(0.15, 12, 3, PI), 0.21, 0.21, 0.21, 0, 0.42, zf + 0.01, [-PI / 2, 0, 0]);
  K.box(PAL.stoneDark, 0.24, 0.025, 0.05, 0, 0.215, zf + 0.015);

  // the little saint
  K.cylT(robe, 0.03, 0.045, 0.14, 0, 0.3, zf + 0.025, 7);
  K.ball(PAL.skinA, 0.032, 0, 0.395, zf + 0.025, 1);
  K.cyl(PAL.gold, 0.05, 0.006, 0, 0.405, zf + 0.008, 12, [PI / 2, 0, 0]);
  K.ball(PAL.skinA, 0.013, -0.008, 0.31, zf + 0.06);
  K.ball(PAL.skinA, 0.013, 0.008, 0.31, zf + 0.06);
  K.box(PAL.ink, 0.008, 0.004, 0.004, -0.01, 0.4, zf + 0.056);
  K.box(PAL.ink, 0.008, 0.004, 0.004, 0.01, 0.4, zf + 0.056);

  const ro = { x: 0, y: 0.58, z: -0.02, span: 0.32, len: 0.26, rise: 0.17, t: 0.04, over: 0.05, ends: 0.05, axis: 'z' as const };
  const rf = K.gable(roofP(roofC), ro);
  for (const gz of [0.1, -0.14]) K.tri(wallP(body), 0.32, 0.17, 0.03, 0, 0.58, gz, 'z');
  K.ball(PAL.gold, 0.022, 0, rf.ridge + 0.015, 0.14);

  // candles, a pot of flowers, a few coins left for luck
  const lit: THREE.Group[] = [];
  for (const [cx, h] of [[0.09, 0.075], [-0.07, 0.04]] as const) {
    K.cyl(PAL.wax, 0.017, h, cx, 0.12 + h / 2, 0.15, 7);
    const Fl = K.sub();
    Fl.cone(flameGlow(), 0.013, 0.042, 0, 0.021, 0, 5);
    lit.push(K.attach(Fl.build(), cx, 0.12 + h + 0.004, 0.15));
  }
  K.cylT(PAL.tile, 0.035, 0.026, 0.045, -0.15, 0.142, 0.13, 7);
  flowers(K, -0.15, 0.15, 0.13, 3, 0.02, [C.rose, PAL.parchment, C.lavender]);
  for (let i = 0; i < 3; i++) K.cyl(PAL.gold, 0.012, 0.004, 0.02 + i * 0.022, 0.122, 0.16 + K.j(0.01), 7);
  const ph = r() * 10;
  K.anim(env => {
    for (let i = 0; i < lit.length; i++) {
      const t = env.time * 11 + ph + i * 3;
      lit[i].scale.set(1 - 0.12 * Math.sin(t * 0.7), 1 + 0.22 * Math.sin(t) + 0.12 * Math.sin(t * 2.3), 1 - 0.12 * Math.sin(t * 0.7));
      lit[i].rotation.z = Math.sin(t * 0.37) * (0.08 + env.wind * 0.25);
    }
  });

  K.door.set(0, 0, 0.42);
  K.perch.set(0, rf.ridge + 0.01, -0.02);
  return K.finish();
};

// ───────────── stocks (1x1) ─────────────

export const stocks: BodyBuilder = (look) => {
  const K = Kit.of(look), r = K.r;
  const wood = wallP(tint(PAL.timberLight, look.variant, 0.05));
  const T = PAL.timber;

  K.slab(PAL.timberLight, 0.62, 0.08, 0.48, 0, 0, -0.02);
  for (let i = 1; i < 5; i++) K.box(T, 0.6, 0.004, 0.008, 0, 0.081, -0.26 + i * 0.096);
  K.slab(T, 0.28, 0.04, 0.1, 0, 0, 0.27);
  for (const sx of [-0.24, 0.24]) {
    K.slab(wallP(T), 0.055, 0.5, 0.055, sx, 0.08, -0.06);
    K.beam(T, sx, 0.08, 0.06, sx, 0.25, -0.03, 0.03);
  }
  K.box(wood, 0.54, 0.075, 0.05, 0, 0.375, -0.06);
  K.box(wood, 0.54, 0.075, 0.05, 0, 0.452, -0.06);
  const zf = -0.06 + 0.026;
  K.cyl(C.shadow, 0.04, 0.006, 0, 0.414, zf, 10, [PI / 2, 0, 0]);
  for (const sx of [-0.15, 0.15]) K.cyl(C.shadow, 0.024, 0.006, sx, 0.414, zf, 8, [PI / 2, 0, 0]);
  K.box(PAL.iron, 0.04, 0.15, 0.056, -0.21, 0.414, -0.06);
  K.box(PAL.iron, 0.03, 0.035, 0.02, 0.21, 0.405, zf + 0.008);
  K.add(PAL.iron, GEO.torus(0.18, 8, 3, PI), 0.024, 0.024, 0.024, 0.21, 0.422, zf + 0.008, [-PI / 2, 0, 0]);
  K.box(T, 0.6, 0.03, 0.09, 0, 0.6, -0.06);
  K.blob(0xa8442e, 0.045, 0.036, 0.008, 0.08, 0.47, zf + 0.002, [0, 0, 0.5]);
  K.blob(0xa8442e, 0.012, 0.03, 0.006, 0.09, 0.44, zf + 0.002);

  // a cabbage that has been thrown and has opinions about it
  const rot = 0x8c8a4e, rotDark = 0x5e5232;
  K.ball(rot, 0.05, 0.25, 0.045, 0.32, 0, 0.85);
  for (let i = 0; i < 4; i++) { const a = r() * PI * 2; K.box(rotDark, 0.02, 0.012, 0.02, 0.25 + Math.cos(a) * 0.04, 0.06 + K.j(0.02), 0.32 + Math.sin(a) * 0.04, a); }
  K.blob(0x7a7a40, 0.07, 0.012, 0.045, 0.33, 0.008, 0.38, 0.6);
  K.blob(rotDark, 0.05, 0.01, 0.03, 0.17, 0.006, 0.4, -0.4);

  K.door.set(0, 0, 0.45);
  K.perch.set(0.24, 0.62, -0.06);
  K.winPts.push(new THREE.Vector3(0, 0.414, -0.02));
  return K.finish();
};

// ───────────── statue of yourself (1x1) ─────────────

/**
 * The ruler as a turned-wood figure in bronze (or gilt, or pale stone), one
 * mitten pointing at something far away and important, cloak swept back by a
 * wind that only blows on statues. A pigeon, larger than strictly necessary,
 * sits on the crown. Someone has left a bucket and brush at the foot of it.
 */
export const statue: BodyBuilder = (look) => {
  const K = Kit.of(look), r = K.r;
  const kind = look.variant % 3; // 0 bronze gone green, 1 gilt, 2 pale stone
  const main = kind === 0 ? mix(C.bronze, C.verd, 0.5) : kind === 1 ? mix(PAL.gold, PAL.goldDark, 0.35) : 0xd8d0c0;
  const dark = kind === 0 ? mix(C.bronzeDark, C.verd, 0.35) : kind === 1 ? PAL.goldDark : PAL.stoneWarm;
  const trim = kind === 1 ? 0xf2d47a : PAL.gold;
  const stone = tint(pick(r, [PAL.stone, PAL.stoneWarm, PAL.plasterGrey]), look.variant, 0.04);

  // the plinth: two steps, a die with a brass plaque, a moulded cap
  K.slab(PAL.stoneDark, 0.62, 0.07, 0.62, 0, 0, 0);
  K.slab(stone, 0.54, 0.05, 0.54, 0, 0.07, 0);
  K.slab(PAL.stoneDark, 0.46, 0.03, 0.46, 0, 0.12, 0);
  K.slab(wallP(stone), 0.4, 0.34, 0.4, 0, 0.15, 0);
  K.slab(PAL.stoneDark, 0.46, 0.025, 0.46, 0, 0.49, 0);
  K.slab(stone, 0.5, 0.04, 0.5, 0, 0.515, 0);
  K.box(PAL.brass, 0.24, 0.11, 0.012, 0, 0.32, 0.204);
  K.box(PAL.goldDark, 0.25, 0.012, 0.014, 0, 0.38, 0.204);
  for (const y of [0.345, 0.32, 0.295]) K.box(PAL.ink, 0.15 - (y === 0.295 ? 0.05 : 0), 0.007, 0.004, 0, y, 0.212);
  for (const sx of [-1, 1]) K.ball(PAL.goldDark, 0.012, sx * 0.105, 0.32, 0.212);

  // the figure, authored at 1 and scaled up as a group
  const F = K.sub();
  F.blob(dark, 0.08, 0.045, 0.1, -0.05, 0.02, 0.03);
  F.blob(dark, 0.08, 0.045, 0.1, 0.055, 0.02, 0.045, 0.3);
  F.cylT(main, 0.074, 0.108, 0.31, 0, 0.155, 0, 9);
  F.blob(main, 0.165, 0.12, 0.135, 0, 0.255, 0.03);
  F.cyl(dark, 0.092, 0.028, 0, 0.16, 0.005, 9);
  F.box(trim, 0.034, 0.034, 0.012, 0, 0.16, 0.097);
  // the cloak
  F.add(dark, GEO.cyl(7, 0.3, 0.5), 0.31, 0.38, 0.18, 0, 0.18, -0.065, [0.18, 0, 0]);
  F.blob(dark, 0.13, 0.28, 0.065, 0.09, 0.13, -0.12, [0.28, 0.35, -0.32]);
  F.blob(dark, 0.09, 0.2, 0.05, -0.08, 0.15, -0.115, [0.2, -0.3, 0.2]);
  F.ring(trim, 0.072, 0.016, 0, 0.31, -0.005);
  // the head, chin well up, and a crown
  const hy = 0.395;
  F.ball(main, 0.08, 0, hy, 0.01, 1);
  F.blob(main, 0.028, 0.034, 0.032, 0, hy + 0.004, 0.087, [-0.35, 0, 0]);
  F.blob(main, 0.052, 0.03, 0.04, 0, hy - 0.052, 0.052, [-0.3, 0, 0]);
  for (const sx of [-1, 1]) {
    F.box(dark, 0.034, 0.01, 0.01, sx * 0.03, hy + 0.036, 0.076, [0.3, 0, sx * 0.3]);
    F.box(dark, 0.026, 0.008, 0.01, sx * 0.03, hy + 0.017, 0.08, [0.3, 0, 0]);
  }
  F.box(dark, 0.034, 0.007, 0.01, 0.007, hy - 0.024, 0.081, [0, 0, 0.2]);
  F.ring(trim, 0.068, 0.014, 0, hy + 0.052, 0.004, [-0.25, 0, 0]);
  for (let i = 0; i < 5; i++) { const a = -PI / 2 + (i - 2) * 0.55; F.cone(trim, 0.013, 0.034, Math.cos(a) * 0.066, hy + 0.08, 0.024 - Math.sin(a) * 0.066, 4, [-0.25, 0, 0]); }
  // mitten hands: one points into the distance, one rests on a hip
  F.blob(main, 0.075, 0.068, 0.07, 0.11, 0.36, 0.09, [0.3, 0.6, 0.2]);
  F.ball(main, 0.022, 0.085, 0.385, 0.1);
  F.rod(main, 0.125, 0.37, 0.115, 0.155, 0.395, 0.16, 0.016, 6);
  F.ball(main, 0.017, 0.157, 0.397, 0.163);
  F.blob(main, 0.058, 0.055, 0.05, -0.105, 0.175, 0.02);
  // what the pigeons think of it
  F.blob(C.splat, 0.045, 0.012, 0.04, -0.058, 0.31, 0.03, 0.3);
  F.blob(C.splat, 0.016, 0.055, 0.013, -0.075, 0.275, 0.064);
  F.blob(C.splat, 0.026, 0.04, 0.012, 0.02, hy + 0.01, 0.075);
  const fig = K.attach(F.build(), 0, 0.555, 0);
  fig.scale.setScalar(1.45);
  K.blob(C.splat, 0.04, 0.008, 0.03, 0.14, 0.557, 0.15);
  K.blob(C.splat, 0.03, 0.006, 0.022, -0.17, 0.557, -0.12);

  // the pigeon, which turns and bobs and has no intention of leaving
  const P = K.sub();
  const dove = 0xb4b8c0;
  P.blob(dove, 0.05, 0.042, 0.072, 0, 0.024, 0);
  P.blob(mix(dove, PAL.verdigris, 0.45), 0.04, 0.034, 0.034, 0, 0.036, 0.024);
  P.box(C.pigeonDark, 0.034, 0.012, 0.052, 0, 0.026, -0.052, [-0.35, 0, 0]);
  for (const sx of [-0.026, 0.026]) P.blob(C.pigeonDark, 0.014, 0.026, 0.046, sx, 0.028, -0.006, [0.2, 0, 0]);
  for (const sx of [-0.011, 0.011]) P.box(PAL.warn, 0.007, 0.014, 0.007, sx, 0.001, 0.006);
  const Hd = K.sub();
  Hd.ball(dove, 0.022, 0, 0, 0, 1);
  Hd.cone(C.beak, 0.007, 0.018, 0, -0.002, 0.027, 4, [PI / 2, 0, 0]);
  for (const sx of [-0.014, 0.014]) Hd.box(PAL.ink, 0.005, 0.007, 0.005, sx, 0.005, 0.014);
  const pg = P.build(), hd = Hd.build();
  hd.position.set(0, 0.056, 0.034);
  pg.add(hd);
  fig.add(pg);
  pg.position.set(0.01 * K.m, hy + 0.085, -0.004);
  pg.scale.setScalar(1 / 1.45 * 1.25);
  let yaw = 0;
  const ph = r() * 10;
  K.anim(env => {
    const tt = (env.time + ph) / 2.9, k = Math.floor(tt), u = tt - k;
    const target = (hash(k * 1.37 + ph) - 0.5) * 3.2;
    yaw += (target - yaw) * Math.min(1, env.dt * 7);
    pg.rotation.y = yaw;
    hd.position.z = 0.034 + (u < 0.3 ? Math.sin(u / 0.3 * PI * 3) * 0.009 : 0);
    hd.rotation.x = u > 0.62 && u < 0.72 ? 0.7 : 0;
  });

  // the bucket and brush of whoever is paid to clean it
  const bkx = 0.37, bkz = 0.27;
  K.cylT(PAL.timberLight, 0.05, 0.042, 0.075, bkx, 0.0375, bkz, 8);
  for (const y of [0.018, 0.058]) K.cyl(PAL.iron, 0.049, 0.007, bkx, y, bkz, 8);
  K.cyl(PAL.waterDeep, 0.044, 0.004, bkx, 0.072, bkz, 8);
  K.add(PAL.iron, GEO.torus(0.12, 8, 3, PI), 0.1, 0.1, 0.1, bkx, 0.075, bkz, [-PI / 2, 0.5, 0]);
  K.box(PAL.timberLight, 0.032, 0.016, 0.1, 0.37, 0.034, 0.13, 0.5);
  K.box(C.straw, 0.028, 0.022, 0.08, 0.37, 0.011, 0.13, 0.5);

  K.door.set(0, 0, 0.45);
  K.perch.set(0, 0.555 + (hy + 0.12) * 1.45, 0);
  return K.finish();
};

// ───────────── watchtower (1x1) ─────────────

export const watchtower: BodyBuilder = (look) => {
  const K = Kit.of(look), r = K.r;
  const roofC = pick(r, [PAL.thatch, PAL.timberLight, PAL.slate]);
  const flag = pick(r, [PAL.crimson, PAL.lapis, PAL.clothOchre, PAL.verdigris]);
  const T = PAL.timber, wood = tint(PAL.timberLight, look.variant, 0.05);
  const b = 0.28, tp = 0.215, Hp = 1.6;
  const rr = (y: number) => b + (tp - b) * y / Hp;

  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    K.beam(T, sx * b, 0, sz * b, sx * tp, Hp + 0.02, sz * tp, 0.065);
    K.blob(PAL.stone, 0.12, 0.06, 0.12, sx * b, 0.02, sz * b, r() * 2);
  }
  const corners = (y: number): [number, number][] => { const q = rr(y); return [[-q, -q], [q, -q], [q, q], [-q, q]]; };
  for (const y of [0.12, 0.86, 1.52]) {
    const c = corners(y);
    for (let i = 0; i < 4; i++) { const a = c[i], d = c[(i + 1) % 4]; K.beam(T, a[0], y, a[1], d[0], y, d[1], 0.045); }
  }
  for (const [ya, yb] of [[0.12, 0.86], [0.86, 1.52]] as const) {
    const ca = corners(ya), cb = corners(yb);
    for (let i = 0; i < 4; i++) {
      const j2 = (i + 1) % 4;
      K.beam(T, ca[i][0], ya, ca[i][1], cb[j2][0], yb, cb[j2][1], 0.03);
      K.beam(T, ca[j2][0], ya, ca[j2][1], cb[i][0], yb, cb[i][1], 0.03);
    }
  }
  // platform and parapet, with a gap where the ladder arrives
  K.slab(wood, 0.68, 0.05, 0.68, 0, Hp, 0);
  K.box(T, 0.7, 0.04, 0.05, 0, Hp - 0.02, 0.2); K.box(T, 0.7, 0.04, 0.05, 0, Hp - 0.02, -0.2);
  const pw = wallP(wood), py = Hp + 0.05, ph0 = 0.2;
  K.slab(pw, 0.66, ph0, 0.03, 0, py, -0.325);
  K.slab(pw, 0.03, ph0, 0.66, -0.325, py, 0);
  K.slab(pw, 0.03, ph0, 0.66, 0.325, py, 0);
  K.slab(pw, 0.22, ph0, 0.03, -0.22, py, 0.325);
  K.slab(pw, 0.22, ph0, 0.03, 0.22, py, 0.325);
  for (let i = -2; i <= 2; i++) K.box(T, 0.008, ph0 - 0.02, 0.034, i * 0.13, py + ph0 / 2, -0.325);
  K.box(T, 0.7, 0.03, 0.05, 0, py + ph0, -0.325);
  K.box(T, 0.05, 0.03, 0.7, -0.325, py + ph0, 0); K.box(T, 0.05, 0.03, 0.7, 0.325, py + ph0, 0);
  K.box(T, 0.24, 0.03, 0.05, -0.22, py + ph0, 0.325); K.box(T, 0.24, 0.03, 0.05, 0.22, py + ph0, 0.325);
  // roof on four short posts
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) K.slab(T, 0.045, 0.36, 0.045, sx * 0.3, py, sz * 0.3);
  K.box(T, 0.66, 0.04, 0.04, 0, py + 0.36, 0.3); K.box(T, 0.66, 0.04, 0.04, 0, py + 0.36, -0.3);
  const ry0 = py + 0.37;
  K.add(roofP(roofC), GEO.pyr(), 0.88, 0.44, 0.88, 0, ry0, 0);
  if (roofC === PAL.thatch) K.add(roofP(PAL.thatchOld), GEO.pyr(), 0.9, 0.08, 0.9, 0, ry0 - 0.02, 0);
  K.lantern(0.29, ry0 - 0.01, 0.29, 1);
  // ladder
  for (const sx of [-0.085, 0.085]) K.beam(PAL.timberLight, sx, 0, 0.42, sx, Hp + 0.08, 0.31, 0.03);
  for (let i = 1; i < 13; i++) { const t = i / 13, y = t * (Hp + 0.05), z = 0.42 - 0.11 * t; K.box(PAL.timberLight, 0.17, 0.018, 0.018, 0, y, z); }

  // banner pole and pennant
  const top = ry0 + 0.44;
  K.rod(T, 0, top - 0.1, 0, 0, top + 0.4, 0, 0.013, 5);
  K.ball(PAL.gold, 0.024, 0, top + 0.42, 0);
  const seg = (len: number, h: number, tip: boolean) => {
    const S = K.sub();
    if (tip) S.add(flag, GEO.tri(), 0.008, len, h, 0, 0, 0, [-PI / 2, 0, -PI / 2]);
    else S.box(flag, len, h, 0.008, len / 2, 0, 0);
    return S.build();
  };
  const g1 = seg(0.1, 0.1, false), g2 = seg(0.1, 0.085, false), g3 = seg(0.09, 0.07, true);
  g2.position.x = 0.1 * K.m; g3.position.x = 0.1 * K.m;
  g1.add(g2); g2.add(g3);
  K.attach(g1, 0.012, top + 0.3, 0);
  const ph = r() * 10;
  K.anim(env => {
    const a = 0.15 + env.wind * 0.45, f = 3 + env.wind * 4, t = env.time * f + ph;
    g1.rotation.y = Math.sin(t) * a * 0.6;
    g2.rotation.y = Math.sin(t - 1.1) * a;
    g3.rotation.y = Math.sin(t - 2.2) * a * 1.2;
    g1.rotation.z = -(1 - env.wind) * 0.9 * K.m;
  });

  K.door.set(0, 0, 0.52);
  K.perch.set(0.0, top - 0.08, 0.12);
  K.winPts.push(new THREE.Vector3(0, py + 0.16, 0.34));
  K.top = top + 0.45;
  return K.finish();
};

// ───────────── chapel (2x3) ─────────────

let chapelGlass: THREE.MeshStandardMaterial[] | null = null;
function chapelMats(): THREE.MeshStandardMaterial[] {
  if (!chapelGlass) chapelGlass = [
    mat(C.stained, { emissive: 0x7a9ae0, emissiveIntensity: 0, rough: 0.35 }, true),
    mat(0x8a2a3a, { emissive: 0xf06a4a, emissiveIntensity: 0, rough: 0.35 }, true),
    mat(0xb08a2a, { emissive: 0xffc860, emissiveIntensity: 0, rough: 0.35 }, true),
  ];
  return chapelGlass;
}

export const chapel: BodyBuilder = (look) => {
  const K = Kit.of(look), r = K.r;
  const stone = tint(pick(r, [PAL.stone, PAL.stoneWarm]), look.variant, 0.04);
  const slate = pick(r, [PAL.slate, PAL.slateDark]);
  const [blue, ruby, amber] = chapelMats();
  const glass: Paint = { c: C.stained, role: 'win', unique: blue };
  const S = PAL.stoneDark;
  const x0 = -0.58, x1 = 0.58, z0 = -0.92, z1 = 0.74, H = 1.0, cz = (z0 + z1) / 2, L = z1 - z0, W = x1 - x0;

  K.slab(S, W + 0.08, 0.1, L + 0.06, 0, 0, cz);
  K.slab(wallP(stone), W, H, L, 0, 0, cz);
  for (const qx of [x0, x1]) for (const qz of [z0, z1]) for (let k = 0; k < 5; k++) {
    const big = k % 2 === 0;
    K.box(PAL.stoneWarm, big ? 0.14 : 0.09, 0.12, big ? 0.09 : 0.14, qx + (qx < 0 ? 1 : -1) * (big ? 0.06 : 0.035), 0.16 + k * 0.17, qz + (qz < 0 ? 1 : -1) * (big ? 0.035 : 0.06));
  }
  K.box(S, W + 0.04, 0.05, L + 0.04, 0, H - 0.04, cz);
  // buttresses between the lancets
  for (const bz of [-0.62, -0.1, 0.42]) for (const sx of [-1, 1]) {
    K.slab(stone, 0.12, 0.62, 0.15, sx * (W / 2 + 0.06), 0, bz);
    K.box(S, 0.13, 0.13, 0.16, sx * (W / 2 + 0.05), 0.66, bz, [0, 0, -sx * 0.6]);
    K.slab(S, 0.14, 0.06, 0.17, sx * (W / 2 + 0.06), 0.0, bz);
  }
  for (const sx of [-1, 1]) K.slab(stone, 0.13, 0.56, 0.12, sx * 0.47, 0, z1 + 0.06);
  for (const wz of [-0.36, 0.16]) for (const f of ['l', 'r'] as const) K.window({ x: f === 'l' ? x0 : x1, y: 0.56, z: wz, w: 0.13, h: 0.32, face: f, glass, arch: 'point', frame: S, mull: 'v', sill: false });

  // steep slate roof, courses, ridge, coped gables
  const ro = { x: 0, y: H, z: cz, span: W, len: L, rise: 0.88, t: 0.07, over: 0.1, ends: 0.06, axis: 'z' as const };
  const rf = K.gable(roofP(slate), ro);
  roofCourses(K, roofP(slate === PAL.slate ? PAL.slateDark : PAL.slate), { ...ro, n: 4 });
  K.box(roofP(PAL.slateDark), 0.07, 0.07, L + 0.12, 0, rf.ridge - 0.012, cz, [0, 0, PI / 4]);
  for (const gz of [z1 - 0.03, z0 + 0.03]) K.tri(wallP(stone), W, 0.88, 0.06, 0, H, gz, 'z');
  for (const sx of [-1, 1]) K.beam(S, sx * (W / 2 + 0.05), H - 0.04, z1 + 0.015, 0, rf.ridge + 0.03, z1 + 0.015, 0.07, 0.08);

  // west front: arched door, steps, rose window
  K.doorway({ x: 0, z: z1, w: 0.34, h: 0.62, color: 0x5a3a24, arch: true, double: true, iron: true, ring: true, frame: S, step: null });
  K.slab(PAL.stone, 0.58, 0.05, 0.18, 0, 0, z1 + 0.09);
  K.slab(PAL.stone, 0.48, 0.05, 0.1, 0, 0.05, z1 + 0.05);
  K.door.set(0, 0, z1 + 0.32);
  const ry = H + 0.37, rz = z1 + 0.008;
  K.add(glass, GEO.cyl(14), 0.32, 0.02, 0.32, 0, ry, rz, [PI / 2, 0, 0]);
  for (let k = 0; k < 6; k++) {
    const a = k * PI / 3 + PI / 6;
    K.add({ c: 0x8a2a3a, role: 'win', unique: k % 2 ? ruby : amber }, GEO.cyl(8), 0.07, 0.02, 0.07, Math.cos(a) * 0.1, ry + Math.sin(a) * 0.1, rz + 0.004, [PI / 2, 0, 0]);
    K.box(S, 0.012, 0.3, 0.02, 0, ry, rz + 0.01, [0, 0, a]);
  }
  K.ring(S, 0.17, 0.022, 0, ry, rz + 0.01, [PI / 2, 0, 0], 14);
  K.cyl(S, 0.03, 0.025, 0, ry, rz + 0.012, 8, [PI / 2, 0, 0]);
  K.winPts.push(new THREE.Vector3(0, ry, rz + 0.05));

  // the bell-cote and its bell
  const bz = z1 - 0.03;
  K.slab(stone, 0.36, 0.1, 0.15, 0, 1.78, bz);
  for (const sx of [-0.13, 0.13]) K.slab(stone, 0.08, 0.36, 0.13, sx, 1.86, bz);
  const bro = { x: 0, y: 2.22, z: bz, span: 0.18, len: 0.36, rise: 0.13, t: 0.035, over: 0.04, ends: 0.04, axis: 'x' as const };
  const brf = K.gable(roofP(slate), bro);
  K.ball(PAL.gold, 0.022, 0, brf.ridge + 0.015, bz);
  K.box(PAL.timber, 0.22, 0.03, 0.04, 0, 2.18, bz);
  const Bl = K.sub();
  Bl.add(C.bell, GEO.bell(), 0.13, 0.12, 0.13, 0, -0.14, 0);
  Bl.ball(PAL.iron, 0.018, 0, -0.15, 0);
  Bl.box(PAL.timber, 0.05, 0.03, 0.05, 0, -0.01, 0);
  const bell = K.attach(Bl.build(), 0, 2.17, bz);
  const ph = r() * 10;
  K.anim(env => {
    const ring = env.monthPhase < 0.035 ? (1 - env.monthPhase / 0.035) : 0;
    bell.rotation.x = Math.sin(env.time * 6.5) * 0.75 * ring + Math.sin(env.time * 1.3 + ph) * env.wind * 0.06;
    const glow = Math.max(0, env.night) * 1.7 + Math.sin(env.time * 7.3 + ph) * 0.06 * env.night;
    blue.emissiveIntensity = glow; ruby.emissiveIntensity = glow; amber.emissiveIntensity = glow;
  });

  // apse at the east end
  K.add(wallP(stone), GEO.cylArc(9, PI / 2, PI), 0.84, 0.82, 0.84, 0, 0.41, z0);
  K.add(S, GEO.cylArc(9, PI / 2, PI), 0.9, 0.1, 0.9, 0, 0.05, z0);
  K.add(roofP(slate), GEO.coneArc(9, PI / 2, PI), 0.98, 0.5, 0.98, 0, 0.82 + 0.25, z0);
  K.window({ x: 0, y: 0.48, z: z0 - 0.415, w: 0.11, h: 0.28, face: 'b', glass, arch: 'point', frame: S, mull: 'v', sill: false, peek: false });

  // lych gate, the churchyard wall, a path, a yew
  const lz = 1.18;
  for (const sx of [-0.22, 0.22]) K.slab(PAL.timber, 0.055, 0.5, 0.055, sx, 0, lz);
  K.box(PAL.timber, 0.54, 0.04, 0.05, 0, 0.5, lz);
  for (const sz of [-0.09, 0.09]) K.box(PAL.timber, 0.54, 0.03, 0.03, 0, 0.51, lz + sz);
  const lro = { x: 0, y: 0.52, z: lz, span: 0.2, len: 0.48, rise: 0.15, t: 0.04, over: 0.09, ends: 0.06, axis: 'x' as const };
  K.gable(roofP(slate), lro);
  K.tri(PAL.timber, 0.2, 0.15, 0.025, 0.22, 0.52, lz);
  K.tri(PAL.timber, 0.2, 0.15, 0.025, -0.22, 0.52, lz);
  for (const [hx, a] of [[-0.2, 0.9], [0.2, PI - 0.9]] as const) {
    const gx = hx + Math.cos(a) * 0.1, gz = lz - Math.sin(a) * 0.1;
    K.box(PAL.timberLight, 0.2, 0.025, 0.018, gx, 0.08, gz, a); K.box(PAL.timberLight, 0.2, 0.025, 0.018, gx, 0.22, gz, a);
    for (const u of [-0.08, 0, 0.08]) K.box(PAL.timberLight, 0.02, 0.17, 0.018, gx + Math.cos(a) * u, 0.15, gz - Math.sin(a) * u, a);
  }
  for (const sx of [-1, 1]) {
    K.slab(S, 0.54, 0.17, 0.09, sx * 0.55, 0, lz);
    K.slab(PAL.stone, 0.56, 0.03, 0.11, sx * 0.55, 0.17, lz);
  }
  for (let i = 0; i < 3; i++) K.slab(PAL.cobble, 0.22 + K.j(0.02), 0.018, 0.12, K.j(0.02), 0, z1 + 0.28 + i * 0.15, K.j(0.1));
  K.blob(PAL.pine, 0.3, 0.32, 0.28, -0.66, 0.16, 1.0, 0, 1);
  K.blob(mix(PAL.pine, PAL.leafSummer, 0.3), 0.18, 0.2, 0.18, 0.7, 0.1, 0.98, 0, 1);

  K.perch.set(0, rf.ridge + 0.02, cz - 0.2);
  return K.finish();
};
