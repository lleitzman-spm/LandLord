/**
 * Cloth and occasions: bunting, party, crown_banner, laundry and the scarecrow.
 * Everything here answers to the wind.
 */
import * as THREE from 'three';
import { PAL, mat, mix } from '../palette';
import {
  aim, ball, beat, billboard, blade, bone, box, bump, clamp, Cloth, cyl, damp, gem, glowDisc, glowMat, grp, lerp, noise, presence, quad, ring, smooth, span, spike, SHAPE, Swarm, TAU,
  type Build, type Frame, type Site,
} from './kit';
import { barrel, basket, crownBadge, crownTexture, garment, note, pole, rope, IRON, ROPE, WOOD, WOOD_D, type GarmentKind } from './props';

const fract = (v: number): number => v - Math.floor(v);
const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const GAY = [PAL.crimson, PAL.gold, PAL.lapis, PAL.clothCream, PAL.verdigris, PAL.clothPlum];

interface Line { at: (u: number, target?: THREE.Vector3) => THREE.Vector3; n: number; yaw: number; i0: number }
/** strings of pennants: ropes go into `H` (static), pennants into one swarm that flutters */
function pennants(s: Site, H: THREE.Group, runs: [THREE.Vector3, THREE.Vector3, number][], gap = 0.115): { flutter: (t: number, wind: number) => void } {
  const lines: Line[] = []; let total = 0;
  for (const [a, b, sag] of runs) {
    const r = rope(a, b, sag, ROPE(), 0.005, 7); H.add(r.g);
    const n = Math.max(2, Math.round(a.distanceTo(b) / gap));
    lines.push({ at: r.at, n, yaw: Math.atan2(-(b.z - a.z), b.x - a.x), i0: total }); total += n;
  }
  const sw = new Swarm(SHAPE.pennant(), mat(0xffffff, { side: THREE.DoubleSide }), total, s.own); sw.order = 'YXZ'; H.add(sw.mesh);
  for (let i = 0; i < total; i++) sw.tint(i, GAY[(i * 5 + (s.seed % 6)) % 6]);
  const p = new THREE.Vector3();
  return {
    flutter(t: number, wind: number): void {
      for (const l of lines) for (let i = 0; i < l.n; i++) {
        l.at((i + 0.5) / l.n, p);
        const k = l.i0 + i;
        sw.put(k, p.x, p.y - 0.004, p.z, 0.085, 0.1, 1, Math.sin(t * (3.1 + (k % 3) * 0.6) + k * 1.3) * (0.12 + 0.5 * wind) + 0.25 * wind, l.yaw, Math.sin(t * 2.3 + k) * 0.06);
      }
      sw.commit();
    },
  };
}

/** a yard pole with a gilt knob, standing at the origin */
function gayPole(h: number): THREE.Group {
  const g = grp();
  g.add(pole(h, 0.016), ball(mat(PAL.gold), 0.022, 0.022, 0.022, 0, h + 0.012, 0), cyl(mat(PAL.crimson), 0.019, 0.019, 0.05, 0, h * 0.5, 0, 0, 0, 0, 6));
  return g;
}

// ───────────────────────── bunting ─────────────────────────

/**
 * bunting: strings of little flags along the eaves and out from the roof to
 * two poles in the yard, in every colour the dyer had. They flutter, and in
 * a wind they stream.
 */
export const bunting: Build = (s) => {
  const df = s.doorSpot.face, L = s.lat(df);
  const H = s.holder();
  const runs: [THREE.Vector3, THREE.Vector3, number][] = [];
  const e0 = s.eaveAt(df, -L), e1 = s.eaveAt(df, L);
  e0.y -= 0.02; e1.y -= 0.02;
  runs.push([e0, e1, 0.06]);
  for (const f of [(df + 1) % 4, (df + 3) % 4]) { const a = s.eaveAt(f, -s.lat(f)), b = s.eaveAt(f, s.lat(f)); a.y -= 0.02; b.y -= 0.02; runs.push([a, b, 0.05]); }
  const top = s.peaked ? s.perch.clone() : null;
  const PH = 0.78;
  [-1, 1].forEach((sg) => {
    const pp = s.out(df, sg * (L + 0.12), 0.78);
    const P = gayPole(PH); P.position.set(pp.x, 0, pp.z); H.add(P);
    const al = s.ridge.x * s.doorSpot.n.z - s.ridge.z * s.doorSpot.n.x;      // does the ridge run along the street?
    const from = top || s.ridgeAt(Math.abs(al) > 0.5 ? sg * Math.sign(al) * s.ridgeLen : 0);
    runs.push([from, V(pp.x, PH, pp.z), 0.16]);
  });
  const pn = pennants(s, H, runs);
  return { update(f: Frame): void { pn.flutter(f.t, f.env.wind); } };
};

// ───────────────────────── party ─────────────────────────

/**
 * party: a string of paper lanterns across the yard, bunting on the eave, a
 * barrel broached by the door, and music coming out of the house in visible
 * quantities. After dark the lanterns do the work.
 */
export const party: Build = (s) => {
  const rnd = s.rnd;
  const d = s.doorSpot, df = d.face, L = s.lat(df), doorU = s.lateral(df, s.door);
  const H = s.holder();
  const e0 = s.eaveAt(df, -L), e1 = s.eaveAt(df, L); e0.y -= 0.02; e1.y -= 0.02;
  const pn = pennants(s, H, [[e0, e1, 0.07]]);
  // the lanterns
  const PH = 0.8;
  const a = s.out(df, -(L + 0.1), 0.8), b = s.out(df, L + 0.1, 0.8);
  const pa = V(a.x, PH, a.z), pb = V(b.x, PH, b.z);
  const A = gayPole(PH); A.position.set(a.x, 0, a.z); const B = gayPole(PH); B.position.set(b.x, 0, b.z);
  const line = rope(pa, pb, 0.13, ROPE(), 0.005, 8);
  H.add(A, B, line.g);
  const cols = [PAL.fire, PAL.gold, PAL.crimson, mix(PAL.verdigris, PAL.good, 0.5), PAL.gold, PAL.fire];
  const lampM = cols.map(c => { const m = mat(mix(c, PAL.flameCore, 0.25), { emissive: c, emissiveIntensity: 0.5 }, true); s.own.push(m); return m; });
  const lamps: THREE.Group[] = [];
  const NL = 6;
  for (let i = 0; i < NL; i++) {
    const p = line.at((i + 0.5) / NL), lb = bone(H, p.x, p.y, p.z, 0, d.yaw, 0); lb.rotation.order = 'YXZ';
    lb.add(cyl(mat(PAL.timber), 0.003, 0.003, 0.03, 0, -0.015, 0, 0, 0, 0, 3), cyl(mat(PAL.timber), 0.022, 0.022, 0.012, 0, -0.034, 0, 0, 0, 0, 6), ball(lampM[i], 0.045, 0.05, 0.045, 0, -0.085, 0), cyl(mat(PAL.timber), 0.02, 0.02, 0.012, 0, -0.136, 0, 0, 0, 0, 6), aim(spike(mat(PAL.crimson), 0.008, 0.035, 0, -0.14, 0, 0, 0, 0, 3), 0, -1, 0));
    lamps.push(lb);
  }
  const glowM = glowMat(PAL.flame, 0.3, true); s.own.push(glowM);
  const mid = line.at(0.5);
  const glow = glowDisc(glowM, L + 0.75, mid.x, 0.03, mid.z); s.group.add(glow);
  // the barrel, on a stand, tapped
  const side = doorU > 0.05 ? -1 : doorU < -0.05 ? 1 : rnd() < 0.5 ? 1 : -1;
  const kp = s.yard(side * (s.doorW / 2 + 0.34), 0.26);
  const K = s.holder(kp.x, 0, kp.z, d.yaw);
  const keg = barrel(); keg.rotation.x = Math.PI / 2; keg.position.set(0, 0.2, 0); K.add(keg);
  K.add(box(WOOD_D(), 0.2, 0.09, 0.03, 0, 0.045, 0.07), box(WOOD_D(), 0.2, 0.09, 0.03, 0, 0.045, -0.07), cyl(mat(PAL.brass), 0.01, 0.01, 0.05, 0, 0.15, 0.155, Math.PI / 2, 0, 0, 5), box(mat(PAL.brass), 0.012, 0.03, 0.012, 0, 0.17, 0.165));
  for (const [mx, mz] of [[0.2, 0.12], [-0.19, 0.16], [0.24, -0.02]]) K.add(cyl(WOOD(), 0.026, 0.022, 0.05, mx, 0.025, mz, 0, 0, 0, 7), cyl(mat(PAL.clothCream), 0.024, 0.024, 0.008, mx, 0.052, mz, 0, 0, 0, 7), ring(IRON(), 0.018, 0.004, mx + 0.03, 0.025, mz, Math.PI / 2, 0, 0, 6));
  // the music
  const NN = 6;
  const INKS = [mat(PAL.ink), mat(PAL.crimson), mat(PAL.lapis)];
  const notes: { g: THREE.Group; sx: number; sy: number; sz: number; off: number; dx: number; dz: number }[] = [];
  const srcs = [V(d.p.x + d.n.x * 0.1, s.doorH * 0.8, d.p.z + d.n.z * 0.1), ...s.windows.slice(0, 2).map(w => V(w.p.x + w.n.x * 0.08, w.p.y + 0.05, w.p.z + w.n.z * 0.08)), s.stack().setY(s.stack().y + 0.05)];
  for (let i = 0; i < NN; i++) {
    const g = bone(s.group); g.add(note(INKS[i % 3], i % 2 === 0)); g.visible = false;
    const src = srcs[i % srcs.length];
    notes.push({ g, sx: src.x, sy: src.y, sz: src.z, off: i / NN + rnd() * 0.05, dx: d.n.x * 0.25 + (rnd() - 0.5) * 0.3, dz: d.n.z * 0.25 + (rnd() - 0.5) * 0.3 });
  }
  const conf = new Swarm(SHAPE.box(), mat(0xffffff, { side: THREE.DoubleSide }), 18, s.own); H.add(conf.mesh);
  for (let i = 0; i < 18; i++) conf.tint(i, GAY[i % 6]);
  const cc = s.yard(0, 0.45);

  return {
    update(f: Frame): void {
      const { env, t } = f;
      const k = presence(f, 0.5);
      pn.flutter(t, env.wind);
      for (let i = 0; i < NL; i++) {
        lamps[i].rotation.set(Math.sin(t * 1.9 + i * 1.3) * (0.08 + 0.3 * env.wind), d.yaw, Math.sin(t * 1.5 + i * 2.1) * (0.06 + 0.2 * env.wind));
        lampM[i].emissiveIntensity = 0.45 + env.night * (1.5 + 0.25 * Math.sin(t * 5 + i * 2));
      }
      glowM.opacity = k * (0.03 + 0.42 * env.night) * (0.92 + 0.08 * Math.sin(t * 4.3));
      for (let i = 0; i < NN; i++) {
        const n = notes[i], p = fract(t * 0.3 + n.off), sc = Math.sin(Math.min(1, p * 4) * Math.PI / 2) * (1 - smooth(span(p, 0.7, 1))) * k * 1.25;
        n.g.visible = sc > 0.01;
        if (!n.g.visible) continue;
        n.g.position.set(n.sx + n.dx * p + Math.sin(t * 2.4 + i * 2) * 0.06 * p, n.sy + p * 0.75, n.sz + n.dz * p);
        n.g.scale.setScalar(sc);
        billboard(n.g, s.ctx.camera); n.g.rotateZ(Math.sin(t * 3 + i * 1.7) * 0.35);
      }
      for (let i = 0; i < 18; i++) {
        const p = fract(t * (0.2 + (i % 4) * 0.03) + i * 0.618), a = i * 2.4;
        conf.put(i, cc.x + Math.cos(a) * (0.2 + (i % 5) * 0.12) + Math.sin(t * 1.3 + i) * 0.06 + env.wind * 0.2 * p, 1.05 * (1 - p) + 0.01, cc.z + Math.sin(a) * (0.15 + (i % 3) * 0.14), 0.026, 0.002, 0.018, t * 3 + i, i, t * 2.2 + i * 2);
      }
      conf.commit();
    },
  };
};

// ───────────────────────── crown_banner ─────────────────────────

/**
 * crown_banner: the Crown has an interest in this address and wishes it
 * known. Two standards either side of the door, crimson with the crown in
 * gold, a runner on the step and a sealed notice on the door.
 */
export const crownBanner: Build = (s) => {
  const d = s.doorSpot;
  const CRIM = mat(PAL.crimson), GOLD = mat(PAL.gold);
  const tex = crownTexture();
  const BW = 0.27, BH = 0.56, PH = 1.08;
  const flags: Cloth[] = [], arms: THREE.Group[] = [];
  for (const sg of [-1, 1]) {
    const p = s.yard(sg * (s.doorW / 2 + 0.3), 0.26);
    const H = s.holder(p.x, 0, p.z, d.yaw - sg * 0.22);
    const sway = bone(H);
    sway.add(pole(PH, 0.019, WOOD_D()), cyl(GOLD, 0.03, 0.022, 0.03, 0, 0.03, 0, 0, 0, 0, 6), box(WOOD_D(), BW + 0.08, 0.022, 0.022, 0, PH - 0.06, 0.012), ball(GOLD, 0.016, 0.016, 0.016, -(BW / 2 + 0.045), PH - 0.06, 0.012), ball(GOLD, 0.016, 0.016, 0.016, BW / 2 + 0.045, PH - 0.06, 0.012));
    const crown = crownBadge(); crown.position.set(0, PH + 0.012, 0); crown.scale.setScalar(0.85); sway.add(crown, ball(GOLD, 0.02, 0.018, 0.02, 0, PH, 0));
    let m: THREE.Material;
    if (tex) { m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide, flatShading: true }); s.own.push(m); }
    else m = mat(0xffffff, { vertexColors: true, side: THREE.DoubleSide });
    const c = new Cloth(BW, BH, m, 'top', s.own, 4, 7, 0, tex ? undefined : (u, v) => (u < 0.1 || u > 0.9 || v < 0.05 || v > 0.93 || (Math.abs(u - 0.5) < 0.2 && Math.abs(v - 0.42) < 0.09) ? PAL.gold : PAL.crimson));
    c.mesh.position.set(0, PH - 0.07, 0.026); c.mesh.castShadow = true; sway.add(c.mesh);
    for (const tx of [-BW / 2 + 0.02, BW / 2 - 0.02]) sway.add(aim(spike(GOLD, 0.012, 0.04, tx, PH - 0.07 - BH, 0.026, 0, 0, 0, 4), 0, -1, 0));
    flags.push(c); arms.push(sway);
  }
  // the runner, and the notice
  const rp = s.yard(0, 0.36);
  const R = s.holder(rp.x, 0, rp.z, d.yaw);
  R.add(box(CRIM, s.doorW + 0.06, 0.012, 0.66, 0, 0.007, 0), box(GOLD, 0.02, 0.014, 0.66, -(s.doorW / 2 + 0.01), 0.007, 0), box(GOLD, 0.02, 0.014, 0.66, s.doorW / 2 + 0.01, 0.007, 0));
  for (let i = 0; i < 5; i++) R.add(aim(spike(GOLD, 0.012, 0.03, (i - 2) * (s.doorW / 4.4), 0.007, 0.33, 0, 0, 0, 3), 0, 0, 1));
  const N = s.holderOn(d, 0.03);
  N.add(quad(mat(PAL.parchment), 0.13, 0.16, 0, s.doorH * 0.14, 0, 0, 0, 0.04), ball(CRIM, 0.02, 0.02, 0.008, 0.03, s.doorH * 0.14 - 0.055, 0.004), box(CRIM, 0.016, 0.05, 0.003, 0.03, s.doorH * 0.14 - 0.09, 0.002, 0, 0, 0.2));
  for (let i = 0; i < 4; i++) N.add(box(mat(PAL.ink), 0.085 - (i % 2) * 0.02, 0.007, 0.002, -0.006 + (i % 2) * 0.008, s.doorH * 0.14 + 0.05 - i * 0.022, 0.002, 0, 0, 0.04));
  return {
    update(f: Frame): void {
      const { env, t } = f;
      for (let i = 0; i < 2; i++) {
        flags[i].wave(t + i * 1.7, 0.01 + 0.035 * env.wind, 4.5, 3.5 + 4 * env.wind);
        arms[i].rotation.z = Math.sin(t * 1.1 + i * 2) * 0.012 * (0.5 + env.wind);
      }
    },
  };
};

// ───────────────────────── laundry ─────────────────────────

/**
 * laundry: a washing line right across the front of the house, at exactly
 * the height of a hat. Shirts, hose, a sheet, one sock. A basket with more
 * to come. It all leans the way the wind does.
 */
export const laundry: Build = (s) => {
  const rnd = s.rnd;
  const d = s.doorSpot, df = d.face, L = s.lat(df);
  const H = s.holder();
  const a = s.out(df, -(L + 0.02), 0.42), b = s.out(df, L + 0.02, 0.42), PH = 0.72;
  const pa = V(a.x, PH, a.z), pb = V(b.x, PH, b.z);
  const line = rope(pa, pb, 0.07, ROPE(), 0.005, 8);
  H.add(line.g);
  for (const p of [a, b]) {
    const P = pole(PH + 0.04, 0.017); P.position.set(p.x, 0, p.z); H.add(P);
    H.add(box(WOOD(), 0.012, 0.012, 0.3, p.x, 0.16, p.z, 0.9, d.yaw, 0));
  }
  const kinds: GarmentKind[] = ['shirt', 'hose', 'sheet', 'sock', 'smock', 'sock', 'shirt'];
  const cols = [PAL.clothCream, PAL.clothRed, PAL.hairWhite, PAL.clothOchre, PAL.clothBlue, PAL.clothCream, PAL.clothGreen];
  const hung: THREE.Group[] = [];
  const NG = 7;
  for (let i = 0; i < NG; i++) {
    const u = (i + 0.6) / (NG + 0.2), p = line.at(u), hb = bone(H, p.x, p.y, p.z, 0, d.yaw, 0); hb.rotation.order = 'YXZ';
    const g = garment(kinds[i], cols[(i + s.seed) % 7]); g.scale.setScalar(kinds[i] === 'sheet' ? 1.9 : 1.75); hb.add(g);
    hb.add(box(WOOD_D(), 0.01, 0.022, 0.016, -0.02, 0.004, 0), box(WOOD_D(), 0.01, 0.022, 0.016, 0.02, 0.004, 0));
    hung.push(hb);
  }
  const bp = s.out(df, L * 0.45, 0.62);
  const Bk = s.holder(bp.x, 0, bp.z, rnd() * 3);
  Bk.add(basket(), ball(mat(PAL.hairWhite), 0.06, 0.035, 0.05, 0, 0.08, 0), ball(mat(PAL.clothBlue), 0.035, 0.03, 0.04, 0.03, 0.095, 0.02), box(mat(PAL.clothCream), 0.05, 0.09, 0.012, -0.075, 0.045, 0.02, 0, 0.3, 0.2));
  return {
    update(f: Frame): void {
      const { env, t } = f;
      const gust = 0.5 + 0.5 * noise(t * 0.7, 4);
      for (let i = 0; i < NG; i++) hung[i].rotation.set(0.5 * env.wind * gust + Math.sin(t * 2.1 + i * 1.7) * (0.07 + 0.22 * env.wind), d.yaw, Math.sin(t * 1.3 + i * 2.3) * 0.05);
    },
  };
};

// ───────────────────────── scarecrow ─────────────────────────

/**
 * scarecrow: a pole, a crosspiece, somebody's old smock stuffed with straw,
 * a sack for a head with a face drawn on by a child, and a hat. A crow sits
 * on its arm, unpersuaded.
 */
export const scarecrow: Build = (s) => {
  const rnd = s.rnd;
  const d = s.doorSpot, df = d.face, doorU = s.lateral(df, s.door), side = doorU > 0.05 ? -1 : doorU < -0.05 ? 1 : rnd() < 0.5 ? 1 : -1;
  const p = s.out(df, side * (s.lat(df) - 0.02), 0.62);
  const H = s.holder(p.x, 0, p.z, d.yaw + side * 0.35);
  const STRAW = mat(PAL.thatch), STRAW_D = mat(PAL.thatchOld), SMOCK = mat(mix(PAL.clothBlue, PAL.clothGrey, 0.35)), SACK = mat(PAL.daub), INK = mat(PAL.ink);
  H.add(pole(0.4, 0.02));
  const U = bone(H, 0, 0.3, 0);                              // everything that sways
  U.add(
    cyl(WOOD(), 0.016, 0.018, 0.5, 0, 0.2, 0, 0, 0, 0, 5), box(WOOD(), 0.62, 0.026, 0.026, 0, 0.3, 0),
    cyl(SMOCK, 0.075, 0.105, 0.26, 0, 0.2, 0, 0, 0, 0, 7), box(SMOCK, 0.5, 0.075, 0.07, 0, 0.3, 0),
    box(mat(PAL.clothOchre), 0.05, 0.05, 0.006, 0.03, 0.2, 0.094, 0.15, 0, 0.2), box(mat(PAL.clothRed), 0.04, 0.035, 0.006, -0.045, 0.13, 0.1, 0.15, 0, -0.1),
    box(mat(PAL.clothBrown), 0.2, 0.02, 0.19, 0, 0.14, 0, 0, 0, 0),
    ball(SACK, 0.075, 0.085, 0.075, 0, 0.43, 0), cyl(mat(PAL.clothBrown), 0.045, 0.05, 0.02, 0, 0.352, 0, 0, 0, 0, 6),
    box(INK, 0.022, 0.006, 0.004, -0.028, 0.45, 0.07, 0, 0, 0.78), box(INK, 0.022, 0.006, 0.004, -0.028, 0.45, 0.07, 0, 0, -0.78), ball(INK, 0.01, 0.01, 0.005, 0.03, 0.45, 0.07),
    aim(spike(mat(PAL.fire), 0.012, 0.05, 0, 0.425, 0.07, 0, 0, 0, 4), 0, -0.1, 1),
    box(INK, 0.05, 0.005, 0.004, 0, 0.395, 0.066, 0, 0, 0.08), box(INK, 0.005, 0.014, 0.004, -0.016, 0.395, 0.067), box(INK, 0.005, 0.014, 0.004, 0.0, 0.396, 0.068), box(INK, 0.005, 0.014, 0.004, 0.016, 0.397, 0.067),
    cyl(mat(PAL.clothBrown), 0.13, 0.13, 0.012, 0, 0.497, 0, 0.08, 0, 0.06, 9), cyl(mat(PAL.clothBrown), 0.02, 0.072, 0.13, 0.008, 0.56, -0.005, 0.1, 0, 0.12, 7), box(mat(PAL.clothRed), 0.15, 0.02, 0.15, 0.002, 0.512, 0, 0.08, 0.78, 0.06),
  );
  for (let i = 0; i < 16; i++) {
    const sx = i % 2 ? 1 : -1, a = (i / 16) * TAU;
    if (i < 10) U.add(aim(spike(i % 3 ? STRAW : STRAW_D, 0.008, 0.07 + rnd() * 0.05, sx * 0.25, 0.3, 0, 0, 0, 0, 3), sx, Math.sin(a * 3) * 0.5 - 0.15, Math.cos(a * 3) * 0.5));
    else U.add(aim(spike(i % 3 ? STRAW : STRAW_D, 0.008, 0.06 + rnd() * 0.04, Math.cos(a) * 0.09, 0.075, Math.sin(a) * 0.09, 0, 0, 0, 3), Math.cos(a) * 0.5, -1, Math.sin(a) * 0.5));
  }
  for (let i = 0; i < 5; i++) U.add(aim(spike(STRAW, 0.007, 0.05, Math.cos(i * 1.3) * 0.05, 0.36, Math.sin(i * 1.3) * 0.05, 0, 0, 0, 3), Math.cos(i * 1.3), -0.3, Math.sin(i * 1.3)));
  // the crow
  const C = bone(U, -side * 0.21, 0.318, 0); C.rotation.order = 'YXZ';
  const BLK = mat(mix(PAL.ink, PAL.lapis, 0.12));
  C.add(ball(BLK, 0.036, 0.034, 0.055, 0, 0.04, 0, -0.3), ball(BLK, 0.024, 0.024, 0.026, 0, 0.078, 0.036), aim(spike(mat(PAL.stoneDark), 0.008, 0.035, 0, 0.076, 0.056, 0, 0, 0, 4), 0, -0.15, 1), aim(blade(BLK, 0.035, 0.07, 0.008, 0, 0.035, -0.045), 0, -0.2, -1), ball(mat(PAL.parchment), 0.005, 0.005, 0.005, -0.016, 0.085, 0.05), ball(mat(PAL.parchment), 0.005, 0.005, 0.005, 0.016, 0.085, 0.05), cyl(mat(PAL.stoneDark), 0.004, 0.004, 0.03, -0.012, 0.012, 0, 0, 0, 0, 3), cyl(mat(PAL.stoneDark), 0.004, 0.004, 0.03, 0.012, 0.012, 0, 0, 0, 0, 3));
  const cw: THREE.Group[] = [];
  for (const sx of [-1, 1]) { const wb = bone(C, sx * 0.03, 0.055, 0); wb.add(aim(blade(BLK, 0.05, 0.09, 0.006, 0, 0, 0), sx * 0.15, -0.25, -1)); cw.push(wb); }
  let cyaw = side * 1.2, ct = 0, cnext = 1.5;
  const EXIT = 1.1;

  return {
    exitDur: EXIT,
    update(f: Frame): void {
      const { env, t, dt, out } = f;
      const gust = noise(t * 0.8, 2);
      U.rotation.set(Math.sin(t * 1.3) * 0.02 + gust * 0.05 * env.wind, Math.sin(t * 0.7) * 0.05 * (0.4 + env.wind), Math.sin(t * 1.1 + 1) * 0.03 + gust * 0.09 * env.wind);
      // the crow looks about in jerks, pecks at the straw, shuffles
      cnext -= dt; if (cnext <= 0) { ct = side * 1.2 + (rnd() - 0.5) * 2.4; cnext = 0.8 + rnd() * 2.2; }
      cyaw = damp(cyaw, ct, 14, dt);
      const peck = beat(t, 6.1, 1.3) * Math.max(0, Math.sin(t * 11));
      let fx = 0, fy = 0, fz = 0, flap = 0, sc = 1;
      if (out >= 0) {
        const u = smooth(out); flap = 1;
        fx = -side * u * 1.2; fy = u * 1.3 + bump(out, 0, 0.3) * 0.1; fz = u * 1.6; sc = 1 - smooth(span(out, 0.65, 1));
      }
      C.position.set(-side * 0.21 + fx, 0.318 + fy + Math.abs(Math.sin(t * 7)) * 0.006 * beat(t, 4.3, 0.6), fz);
      C.rotation.set(peck * 0.9 - flap * 0.3, out >= 0 ? 0 : cyaw, 0);
      C.scale.setScalar(Math.max(0.001, sc));
      const fl = flap ? Math.sin(t * 26) * 0.9 : beat(t, 9.7, 0.5) * Math.sin(t * 30) * 0.5;
      cw[0].rotation.set(0, flap * 1.3, -fl - flap * 0.2); cw[1].rotation.set(0, -flap * 1.3, fl + flap * 0.2);
    },
  };
};
