/**
 * Things wrong with the building itself: leak, hole_roof, cracked_wall,
 * boarded, flood, mud, snowed_in, frozen, quarantine and graffiti.
 */
import * as THREE from 'three';
import { PAL, mat, mix } from '../palette';
import {
  aim, ball, beat, billboard, blade, bone, box, bump, canvasTex, glowDisc, glowSprite, clamp, Cloth, cyl, damp, disc, gem, glowMat, grp, hash, lerp, lieOn, live, noise, presence, pyr, quad, ring, smooth, span, spike, SHAPE, Swarm, TAU,
  slopeSpot, type Build, type Frame, type LoopPt,
} from './kit';
import { barrel, basket, bucket, pole, rope, strut, IRON, WOOD, WOOD_D } from './props';

const fract = (v: number): number => v - Math.floor(v);
const wet = (w: string): boolean => w === 'rain' || w === 'storm';
const WATER = (): THREE.Material => mat(PAL.water, { rough: 0.2, emissive: PAL.waterDeep, emissiveIntensity: 0.35 });
const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

// ───────────────────────── leak ─────────────────────────

/**
 * leak: a dark patch on the roof, a slipped tile or two, and water coming off
 * the eave by the door in slow fat drops. Someone has put a bucket under one
 * drip and a cooking pot under the other. It drips faster in the rain.
 */
export const leak: Build = (s) => {
  const rnd = s.rnd;
  const df = s.doorSpot.face, dn = s.doorSpot.n, doorU = s.lateral(df, s.door), L = s.lat(df);
  const side = doorU > 0 ? -1 : 1;
  const u1 = clamp(doorU + side * (s.doorW / 2 + 0.2), -L + 0.1, L - 0.1), u2 = clamp(doorU - side * (s.doorW / 2 + 0.34), -L + 0.1, L - 0.1);
  const e1 = s.eaveAt(df, u1), e2 = s.eaveAt(df, u2);
  const tips = [V(e1.x + dn.x * 0.035, e1.y - 0.015, e1.z + dn.z * 0.035), V(e2.x + dn.x * 0.035, e2.y - 0.015, e2.z + dn.z * 0.035)];
  const land = [0.1, 0.062];
  const W = WATER(), WETM = mat(mix(PAL.waterDeep, PAL.soot, 0.5), { transparent: true, opacity: 0.5, rough: 0.35 });

  // the bad patch, up the slope from the first drip
  const R = s.holder();
  const r = s.roofAt(e1.x - dn.x * s.ext[df] * 0.5, e1.z - dn.z * s.ext[df] * 0.5);
  if (r.n.y < 0.35) r.n.set(dn.x * 0.5, 1, dn.z * 0.5).normalize();
  R.add(aim(disc(WETM, 0.17, 0.2, r.p.x + r.n.x * 0.014, r.p.y + r.n.y * 0.014, r.p.z + r.n.z * 0.014, 0, 7), r.n.x, r.n.y, r.n.z));
  R.add(aim(disc(WETM, 0.085, 0.11, r.p.x + r.n.x * 0.018, r.p.y + r.n.y * 0.018, r.p.z + r.n.z * 0.018, 0.6, 6), r.n.x, r.n.y, r.n.z));
  for (let i = 0; i < 3; i++) {
    const j = (rnd() - 0.5) * 0.26, dd = 0.05 + i * 0.07;
    const q = s.roofAt(r.p.x + dn.x * dd + dn.z * j, r.p.z + dn.z * dd - dn.x * j);
    if (q.n.y < 0.35) continue;
    const o = box(mat(i % 2 ? PAL.thatchOld : PAL.slateDark), 0.09, 0.014, 0.07, q.p.x + q.n.x * 0.014, q.p.y + q.n.y * 0.014, q.p.z + q.n.z * 0.014);
    aim(o, q.n.x, q.n.y, q.n.z).rotateY(rnd() * 3); R.add(o);
  }
  // the run down the wall
  const ws = s.wall(df, u1, s.eave * 0.55);
  const Wl = s.holder(ws.p.x + ws.n.x * 0.01, 0, ws.p.z + ws.n.z * 0.01, ws.yaw);
  Wl.add(quad(WETM, 0.085, s.eave * 0.62, 0, s.eave * 0.67, 0), quad(WETM, 0.04, s.eave * 0.9, 0.03, s.eave * 0.5, 0.002), quad(WETM, 0.03, s.eave * 0.5, -0.04, s.eave * 0.7, 0.002));
  // what has been put underneath
  const B1 = s.holder(tips[0].x, 0, tips[0].z, rnd() * 3); B1.add(bucket(W));
  B1.add(ball(W, 0.14, 0.004, 0.11, 0.03, 0.003, 0.02));
  const B2 = s.holder(tips[1].x, 0, tips[1].z, rnd() * 3);
  B2.add(cyl(IRON(), 0.075, 0.06, 0.055, 0, 0.0275, 0, 0, 0, 0, 8), cyl(W, 0.066, 0.066, 0.008, 0, 0.055, 0, 0, 0, 0, 8), box(IRON(), 0.1, 0.012, 0.016, 0.11, 0.05, 0));

  const D = s.holder();
  const drops = new Swarm(SHAPE.flame(), W, 8, s.own), rip = new Swarm(SHAPE.hoop(), mat(mix(PAL.water, 0xffffff, 0.6), { rough: 0.3 }), 4, s.own);
  D.add(drops.mesh, rip.mesh);

  return {
    update(f: Frame): void {
      const { env, t } = f;
      const rate = wet(env.weather) ? 1.5 : 0.62;
      for (let j = 0; j < 2; j++) {
        const tip = tips[j], top = tip.y, bot = land[j];
        for (let i = 0; i < 3; i++) {
          const p = fract(t * rate * (j ? 0.83 : 1) + i / 3 + j * 0.4);
          // swell on the eave, let go, fall
          const hang = span(p, 0, 0.3), fall = span(p, 0.3, 1);
          const y = top - 0.02 * hang - (top - bot) * fall * fall;
          const sc = 0.008 + 0.014 * smooth(hang);
          drops.put(j * 3 + i, tip.x, y - 0.04, tip.z, sc, 0.044 + 0.026 * fall, sc);
          if (i < 2) {                                     // each drop's ring starts as the one before it lands
            const rr = 0.012 + 0.04 * p;
            rip.put(j * 2 + i, tip.x, bot + 0.004 - smooth(span(p, 0.6, 1)) * 0.012, tip.z, rr, rr * 0.4, rr);
          }
        }
      }
      drops.hide(6); drops.hide(7);
      drops.commit(); rip.commit();
    },
  };
};

// ───────────────────────── hole_roof ─────────────────────────

/**
 * hole_roof: a hole you could put a goat through, broken laths, torn thatch,
 * and a patched tarpaulin weighted down over most of it. The tarpaulin has
 * one corner loose and it flaps. When the roof is mended it blows away.
 */
export const holeRoof: Build = (s) => {
  const rnd = s.rnd;
  const r = slopeSpot(s, 0.5, (rnd() - 0.5) * 0.9);
  const H = s.holder(r.p.x, r.p.y, r.p.z); lieOn(H, r.n);       // x across the slope, y up it, z out of the roof
  const SOOT = mat(PAL.soot), LATH = mat(PAL.timberLight), THATCH = [mat(PAL.thatchOld), mat(mix(PAL.thatch, PAL.thatchOld, 0.5))];
  H.add(ball(SOOT, 0.2, 0.15, 0.004, 0.04, 0, 0.008, 0, 0, 0.3), ball(SOOT, 0.11, 0.1, 0.004, 0.16, -0.06, 0.008));
  for (let i = 0; i < 5; i++) H.add(box(LATH, 0.014, 0.1 + rnd() * 0.14, 0.014, 0.0 + (i - 2) * 0.055 + 0.03, (i % 2 ? 0.08 : -0.07) + (rnd() - 0.5) * 0.04, 0.016, 0, 0, (rnd() - 0.5) * 0.9));
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * TAU + rnd() * 0.3, rx = 0.21 + rnd() * 0.03, ry = 0.16 + rnd() * 0.03;
    H.add(aim(spike(THATCH[i % 2], 0.026, 0.07 + rnd() * 0.06, 0.05 + Math.cos(a) * rx, Math.sin(a) * ry, 0.004, 0, 0, 0, 4), Math.cos(a), Math.sin(a), 0.55));
  }
  // the tarpaulin
  const TW = 0.44, TH = 0.42;
  const tarpM = mat(0xffffff, { vertexColors: true, side: THREE.DoubleSide });
  const base = mix(PAL.clothBrown, PAL.clothGrey, 0.55), patch = mix(PAL.clothOchre, PAL.clothCream, 0.3);
  const tarp = new Cloth(TW, TH, tarpM, 'top', s.own, 6, 6, 0, (u, v) => (u > 0.55 && u < 0.9 && v > 0.45 && v < 0.8 ? patch : (v < 0.08 || u < 0.06 || u > 0.94) ? mix(base, PAL.timber, 0.45) : base));
  const T = bone(H, -0.15, 0.22, 0.03, 0, 0, 0.08);
  tarp.mesh.castShadow = true; T.add(tarp.mesh);
  const pins = bone(H, -0.15, 0.22, 0.03, 0, 0, 0.08);
  pins.add(
    box(LATH, TW + 0.06, 0.03, 0.016, 0, -0.012, 0.012), ball(mat(PAL.iron), 0.007, 0.007, 0.007, -0.15, -0.012, 0.022), ball(mat(PAL.iron), 0.007, 0.007, 0.007, 0.15, -0.012, 0.022),
    gem(mat(PAL.stone), 0.04, 0.03, 0.035, -TW / 2 + 0.03, -TH + 0.05, 0.035, 0.3, 0.5, 0), gem(mat(PAL.stoneDark), 0.03, 0.025, 0.03, -0.02, -TH * 0.55, 0.032, 0.2, 1.2, 0),
  );
  const EXIT = 1.0;
  return {
    exitDur: EXIT,
    update(f: Frame): void {
      const { env, t, out } = f;
      const gust = 0.55 + 0.45 * noise(t * 0.9, 3) + beat(t, 6.3, 1.2) * 0.8;
      tarp.wave(t, (0.006 + 0.03 * env.wind * gust) * (out >= 0 ? 1 + out * 3 : 1), 4.2, 4 + 5 * env.wind, 1);
      if (out >= 0) {
        const u = out * out;
        T.position.set(-0.15 + u * 1.6, 0.22 + u * 0.5, 0.03 + u * 1.5 + Math.sin(out * 9) * 0.05);
        T.rotation.set(-u * 2.2, u * 1.4, 0.08 + u * 2.5);
        T.scale.setScalar(Math.max(0.001, 1 - smooth(span(out, 0.6, 1))));
      }
    },
  };
};

// ───────────────────────── cracked_wall ─────────────────────────

/**
 * cracked_wall: a jagged crack from the ground to the eave, plaster off round
 * the worst of it, and two raking timbers wedged against the wall to keep it
 * where it is. Now and then it settles: a creak, and a trickle of dust.
 */
export const crackedWall: Build = (s) => {
  const rnd = s.rnd;
  const fw = s.freeWall(0.26), sp = s.wall(fw.face, fw.u, Math.min(0.3, s.eave * 0.5));
  const H = s.holder(sp.p.x + sp.n.x * 0.012, 0, sp.p.z + sp.n.z * 0.012, sp.yaw);     // x along the wall, y up, z out
  const top = Math.max(0.35, s.eave * 0.96);
  const DARK = mat(mix(PAL.ink, PAL.soot, 0.5)), DAUB = mat(PAL.daub), LATH = mat(PAL.timberLight);
  const seg = (ax: number, ay: number, bx: number, by: number, w: number): void => {
    const len = Math.hypot(bx - ax, by - ay);
    H.add(box(DARK, w, len + w * 0.6, 0.006, (ax + bx) / 2, (ay + by) / 2, 0.004, 0, 0, Math.atan2(-(bx - ax), by - ay)));
  };
  const N = 8; let px = (rnd() - 0.5) * 0.06, py = 0.0;
  const nodes: [number, number][] = [[px, py]];
  for (let i = 1; i <= N; i++) {
    const nx = (i % 2 ? 1 : -1) * (0.025 + rnd() * 0.05) + (rnd() - 0.5) * 0.02, ny = (i / N) * top;
    seg(px, py, nx, ny, 0.046 * (1 - 0.6 * (i / N)) + 0.012); px = nx; py = ny; nodes.push([px, py]);
  }
  for (const [k, dir] of [[2, 1], [4, -1], [5, 1]] as [number, number][]) {
    const [ax, ay] = nodes[k]; let bx = ax + dir * (0.05 + rnd() * 0.04), by = ay + 0.04 + rnd() * 0.03;
    seg(ax, ay, bx, by, 0.016); const cx = bx + dir * (0.03 + rnd() * 0.04), cy = by + 0.05; seg(bx, by, cx, cy, 0.01); bx = cx; by = cy;
  }
  // plaster gone, daub and laths showing
  const [mx, my] = nodes[3];
  H.add(ball(DAUB, 0.09, 0.1, 0.003, mx + 0.015, my + 0.02, 0.001, 0, 0, 0.4), ball(DAUB, 0.05, 0.06, 0.003, mx - 0.05, my - 0.08, 0.001));
  for (let i = 0; i < 3; i++) H.add(box(LATH, 0.12 - i * 0.02, 0.012, 0.004, mx + 0.015, my - 0.03 + i * 0.045, 0.003));
  for (let i = 0; i < 6; i++) H.add(gem(mat(i % 2 ? PAL.plaster : PAL.plasterGrey), 0.016 + rnd() * 0.02, 0.012, 0.014 + rnd() * 0.015, (rnd() - 0.5) * 0.3, 0.01, 0.04 + rnd() * 0.14, rnd(), rnd() * 3, 0));
  // the shoring
  const P = bone(H);
  const TIM = mat(PAL.timberLight), TIM_D = mat(PAL.timber);
  const h1 = top * 0.82;
  P.add(
    strut(TIM, V(-0.2, 0.03, 0.5), V(-0.2, h1, 0.04), 0.05), strut(TIM, V(0.2, 0.03, 0.5), V(0.2, h1, 0.04), 0.05),
    box(TIM_D, 0.52, 0.07, 0.03, 0, h1 - 0.01, 0.02),
    box(TIM_D, 0.52, 0.035, 0.14, 0, 0.018, 0.5),
    strut(TIM_D, V(-0.2, h1 * 0.3, 0.36), V(0.2, h1 * 0.3, 0.36), 0.03, 0.022),
    pyr(TIM, 0.05, 0.05, 0.08, -0.2, 0.03, 0.59, -1.1), pyr(TIM, 0.05, 0.05, 0.08, 0.2, 0.03, 0.59, -1.1),
  );
  const dust = new Swarm(SHAPE.oct(), mat(PAL.plaster), 7, s.own); H.add(dust.mesh);

  return {
    update(f: Frame): void {
      const { t } = f;
      const per = 6.5, ph = (t % per) / per, creak = bump(ph, 0, 0.07);
      P.rotation.x = creak * 0.012 * Math.sin(t * 60); P.position.y = -creak * 0.004;
      for (let i = 0; i < 7; i++) {
        const p = span(ph, 0.01 + i * 0.012, 0.17 + i * 0.02);
        if (p <= 0 || p >= 1) { dust.hide(i); continue; }
        const sc = 0.011 * (1 - p * 0.5);
        dust.put(i, mx + Math.sin(i * 2.1) * 0.04 + 0.01, my + 0.1 - (my + 0.08) * p * p, 0.02 + p * 0.05 + (i % 3) * 0.012, sc, sc, sc, p * 5, i, 0);
      }
      dust.commit();
    },
  };
};

// ───────────────────────── boarded ─────────────────────────

/**
 * boarded: planks nailed over the door and every window, not by a carpenter.
 * A notice is fixed to the door. One plank has lost a nail and swings.
 */
export const boarded: Build = (s) => {
  const rnd = s.rnd;
  const WD = [mat(PAL.timberLight), mat(mix(PAL.timberLight, PAL.thatchOld, 0.4)), mat(mix(PAL.timber, PAL.timberLight, 0.45))];
  const NAIL = mat(PAL.iron);
  let pi = 0;
  const plank = (len: number, x: number, y: number, z: number, rz: number, pivot = 0): THREE.Group => {
    const g = grp(x, y, z, 0, 0, rz), ox = pivot * (len / 2 - 0.03);
    g.add(box(WD[pi++ % 3], len, 0.054, 0.016, ox, 0, 0), ball(NAIL, 0.008, 0.008, 0.006, ox - len / 2 + 0.03, 0.004, 0.01));
    if (!pivot) g.add(ball(NAIL, 0.008, 0.008, 0.006, len / 2 - 0.03, -0.004, 0.01));
    return g;
  };
  const dw = s.doorW, dh = s.doorH;
  const D = s.holderOn(s.doorSpot, 0.03);
  D.add(
    plank(dw + 0.2, 0, dh * 0.27, 0, 0.1), plank(dw + 0.24, 0.01, -dh * 0.02, 0, -0.16), plank(dw + 0.18, -0.01, -dh * 0.3, 0, 0.06),
    plank(Math.hypot(dw, dh) * 0.98, 0, 0, 0.017, Math.atan2(dh, dw) * 0.95),
  );
  // the notice
  D.add(
    quad(mat(PAL.parchment), 0.1, 0.12, dw * 0.12, dh * 0.12, 0.03, 0, 0, -0.07), ball(mat(PAL.crimson), 0.012, 0.012, 0.005, dw * 0.12 + 0.02, dh * 0.12 - 0.04, 0.033), ball(NAIL, 0.006, 0.006, 0.005, dw * 0.12 - 0.003, dh * 0.12 + 0.05, 0.033),
  );
  for (let i = 0; i < 3; i++) D.add(box(mat(PAL.ink), 0.06 - (i % 2) * 0.015, 0.006, 0.002, dw * 0.12 - 0.006 + (i % 2) * 0.006, dh * 0.12 + 0.03 - i * 0.02, 0.032, 0, 0, -0.07));
  const hang: { plank: THREE.Group | null } = { plank: null };
  s.windows.slice(0, 6).forEach((w, i) => {
    const Wn = s.holderOn(w, 0.03);
    Wn.add(plank(0.34 + rnd() * 0.04, (rnd() - 0.5) * 0.02, 0.065, 0, 0.08 + (rnd() - 0.5) * 0.1));
    if (i === 0) { hang.plank = bone(Wn, -0.15, -0.05, 0.004); hang.plank.add(plank(0.34, 0, 0, 0, 0, 1)); }
    else Wn.add(plank(0.36, 0, -0.06, 0.002, -0.12 + (rnd() - 0.5) * 0.1));
    if (i % 2 === 0) Wn.add(plank(0.3, 0.01, 0.0, 0.016, 0.9 + rnd() * 0.3));
  });
  return {
    update(f: Frame): void {
      const { env, t } = f;
      if (hang.plank) hang.plank.rotation.z = -1.25 + Math.sin(t * 2.6) * (0.06 + 0.22 * env.wind) + beat(t, 5.1, 0.8) * Math.sin(t * 9) * 0.12;
    },
  };
};

// ───────────────────────── flood ─────────────────────────

/**
 * flood: the yard is under a few inches of water that laps at the walls. A
 * barrel has floated off and is touring the garden. A duck has moved in and
 * considers the matter closed. Drains away when it is dealt with.
 */
export const flood: Build = (s) => {
  const df = s.doorSpot.face, dn = s.doorSpot.n;
  const WW = Math.min(s.w + 1.15, s.ext[1] + s.ext[3] + 2), DD = Math.min(s.h + 1.15, s.ext[0] + s.ext[2] + 2), SEG = 12;
  const g = new THREE.PlaneGeometry(WW, DD, SEG, SEG).rotateX(-Math.PI / 2); s.own.push(g);
  const pos = g.attributes.position as THREE.BufferAttribute, n = pos.count;
  const edge = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let x = pos.getX(i), z = pos.getZ(i);
    const nx = Math.abs(x / (WW / 2)), nz = Math.abs(z / (DD / 2)), r = Math.pow(nx ** 4 + nz ** 4, 0.25);
    if (r > 0.999) { x /= r; z /= r; edge[i] = 1; } else edge[i] = smooth(span(r, 0.72, 1));
    pos.setXYZ(i, x, 0, z);
  }
  const base = (pos.array as Float32Array).slice();
  const waterM = mat(PAL.water, { transparent: true, opacity: 0.82, rough: 0.12 });
  const sheet = live(new THREE.Mesh(g, waterM)); sheet.receiveShadow = true; sheet.renderOrder = 1; s.group.add(sheet);
  g.computeBoundingSphere();
  const rip = new Swarm(SHAPE.hoop(), mat(mix(PAL.water, 0xffffff, 0.6), { rough: 0.3 }), 7, s.own); s.group.add(rip.mesh);
  // flotsam
  const Bb = bone(s.group); const br = bone(Bb, 0, 0, 0, 0, 0, Math.PI / 2); br.add(barrel());
  const duck = bone(s.group);
  const DK = mat(mix(PAL.clothBrown, PAL.stone, 0.5)), HEAD = mat(PAL.verdigris);
  duck.add(
    ball(DK, 0.045, 0.036, 0.07, 0, 0.022, 0), ball(mat(PAL.clothCream), 0.03, 0.02, 0.03, 0, 0.03, -0.055, -0.5), aim(spike(DK, 0.018, 0.04, 0, 0.035, -0.07, 0, 0, 0, 4), 0, 0.8, -1),
    cyl(HEAD, 0.016, 0.02, 0.04, 0, 0.06, 0.045, 0.2, 0, 0, 5), ball(HEAD, 0.024, 0.023, 0.027, 0, 0.088, 0.052), box(mat(PAL.hairWhite), 0.036, 0.006, 0.036, 0, 0.068, 0.048),
    box(mat(PAL.gold), 0.022, 0.008, 0.034, 0, 0.082, 0.085), ball(mat(PAL.ink), 0.005, 0.005, 0.005, -0.019, 0.094, 0.063), ball(mat(PAL.ink), 0.005, 0.005, 0.005, 0.019, 0.094, 0.063),
  );
  const pt: LoopPt = { x: 0, z: 0, yaw: 0 };
  const spots = [s.out(df, s.lat(df) * 0.7, 0.08), s.out((df + 1) % 4, 0, 0.08), s.out((df + 3) % 4, -0.2, 0.08), s.out(df, -s.lat(df) * 0.5, 0.1)];
  const dir = s.seed & 1 ? 1 : -1;
  const EXIT = 1.6;

  return {
    exitDur: EXIT,
    update(f: Frame): void {
      const { env, t, age, out } = f;
      const k = smooth(age / 1.6) * (out >= 0 ? 1 - smooth(out) : 1);
      const L = -0.02 + 0.095 * k + 0.006 * Math.sin(t * 0.9);
      const arr = pos.array as Float32Array, amp = 0.007 + 0.006 * env.wind + (wet(env.weather) ? 0.004 : 0);
      for (let i = 0; i < n; i++) {
        const j = i * 3, x = base[j], z = base[j + 2], e = edge[i];
        const lap = 1 + e * 0.035 * Math.sin(t * 1.5 + Math.atan2(z, x) * 3) - (1 - k) * 0.35 * e;
        arr[j] = x * lap; arr[j + 2] = z * lap;
        arr[j + 1] = (L + amp * (Math.sin(x * 4.1 + t * 1.7) + 0.7 * Math.sin(z * 3.3 - t * 1.3 + x * 1.7))) * (1 - e * e) - 0.012 * e * e;
      }
      pos.needsUpdate = true;
      sheet.visible = k > 0.02;
      // the barrel, adrift
      const bu = Math.sin(t * 0.13) * s.lat(df) * 0.9, bd = 0.42 + 0.13 * Math.sin(t * 0.21 + 1);
      const bx = dn.x * (s.ext[df] + bd) + dn.z * bu, bz = dn.z * (s.ext[df] + bd) - dn.x * bu;
      Bb.visible = duck.visible = k > 0.25;
      Bb.position.set(bx, L - 0.035 + Math.sin(t * 1.8) * 0.008, bz);
      Bb.rotation.set(Math.sin(t * 1.1) * 0.08, t * 0.12 + Math.sin(t * 0.4), Math.sin(t * 1.4 + 1) * 0.07);
      br.rotation.x = Math.sin(t * 0.5) * 0.6;
      Bb.scale.setScalar(Math.max(0.001, smooth(span(k, 0.25, 0.7))));
      // the duck, on patrol
      s.around(0.34, dir * t * 0.028 + 0.1, pt);
      duck.position.set(pt.x, L - 0.008 + Math.sin(t * 2.3) * 0.004, pt.z);
      duck.rotation.set(Math.sin(t * 2.3) * 0.05 + beat(t, 9, 1.4) * 0.9, pt.yaw + (dir < 0 ? Math.PI : 0) + Math.sin(t * 0.7) * 0.15, Math.sin(t * 3.1) * 0.04);
      duck.scale.setScalar(Math.max(0.001, smooth(span(k, 0.25, 0.7)) * 1.15));
      for (let i = 0; i < 7; i++) {
        const p = fract(t * 0.33 + i * 0.37), rr = (0.04 + 0.2 * p) * k;
        const cx = i < 4 ? spots[i].x : i === 4 ? bx : pt.x, cz = i < 4 ? spots[i].z : i === 4 ? bz : pt.z;
        rip.put(i, cx, L + 0.006 - smooth(span(p, 0.55, 1)) * 0.03, cz, rr, rr * 0.3, rr);
      }
      rip.commit();
    },
  };
};

// ───────────────────────── mud ─────────────────────────

/**
 * mud: the yard has given up. Pools of it, a plank laid across the worst,
 * footprints up to the door, splashes up the wall, and one boot that stayed
 * behind when its owner went on. It bubbles a little.
 */
export const mud: Build = (s) => {
  const rnd = s.rnd;
  const MUD = mat(mix(PAL.dirtDark, PAL.soot, 0.4), { rough: 0.35 }), MUD_L = mat(mix(PAL.dirtDark, PAL.dirt, 0.25), { rough: 0.35 });
  const c = s.yard(0, 0.42);
  const H = s.holder(c.x, 0, c.z, s.doorSpot.yaw);          // x along the wall, z away from the door
  H.add(
    ball(MUD_L, 0.42, 0.01, 0.3, 0.02, 0.002, 0.03), ball(MUD, 0.3, 0.014, 0.2, 0.0, 0.004, 0.05, 0, 0.3, 0),
    ball(MUD, 0.19, 0.012, 0.15, -0.36, 0.004, 0.13, 0, 0.8, 0), ball(MUD, 0.16, 0.012, 0.2, 0.38, 0.004, -0.06, 0, -0.4, 0), ball(MUD_L, 0.12, 0.01, 0.1, 0.25, 0.003, 0.3), ball(MUD, 0.08, 0.01, 0.07, -0.2, 0.004, -0.2),
  );
  for (let i = 0; i < 6; i++) { const sx = i % 2 ? 1 : -1; H.add(ball(MUD, 0.019, 0.004, 0.032, sx * 0.03 + 0.02 - i * 0.004, 0.004, -0.1 - i * 0.045, 0, sx * 0.2, 0)); }
  // the plank, the boot
  H.add(box(WOOD(), 0.11, 0.018, 0.7, 0.07, 0.022, 0.05, 0.035, 0.3, 0.03), box(WOOD_D(), 0.11, 0.006, 0.02, 0.0, 0.03, -0.12, 0.035, 0.3, 0.03));
  const boot = bone(H, -0.12, 0.0, 0.1, 0.25, 0.6, -0.3);
  const LEATHER = mat(mix(PAL.clothBrown, PAL.timber, 0.4));
  boot.add(cyl(LEATHER, 0.034, 0.03, 0.1, 0, 0.06, 0, 0, 0, 0, 7), cyl(mat(PAL.timber), 0.036, 0.036, 0.016, 0, 0.11, 0, 0, 0, 0, 7), ball(LEATHER, 0.032, 0.025, 0.05, 0, 0.012, 0.03), ball(MUD, 0.06, 0.012, 0.07, 0, 0.004, 0.01));
  // up the wall
  const df = s.doorSpot.face, doorU = s.lateral(df, s.door);
  for (const sgn of [-1, 1]) {
    const u = clamp(doorU + sgn * (s.doorW / 2 + 0.16 + rnd() * 0.1), -s.lat(df) + 0.08, s.lat(df) - 0.08), w = s.wall(df, u, 0.1);
    const Wl = s.holder(w.p.x + w.n.x * 0.01, 0, w.p.z + w.n.z * 0.01, w.yaw);
    for (let i = 0; i < 6; i++) { const r = 0.018 + rnd() * 0.03; Wl.add(ball(MUD, r, r * (0.8 + rnd() * 0.6), 0.004, (rnd() - 0.5) * 0.22, 0.02 + rnd() * rnd() * 0.24, 0)); }
    Wl.add(ball(MUD, 0.14, 0.035, 0.004, 0, 0.012, 0));
  }
  const bub = new Swarm(SHAPE.ico1(), MUD_L, 4, s.own); H.add(bub.mesh);
  const at: [number, number][] = [[0.05, 0.1], [-0.33, 0.14], [0.36, -0.05], [-0.08, -0.02]];
  return {
    update(f: Frame): void {
      const { t } = f;
      for (let i = 0; i < 4; i++) {
        const p = fract(t * (0.22 + i * 0.04) + i * 0.37), sc = p < 0.78 ? 0.034 * Math.sin((p / 0.78) * Math.PI / 2) : 0;
        if (sc <= 0) bub.hide(i); else bub.put(i, at[i][0], 0.006, at[i][1], sc, sc * 0.7, sc);
      }
      bub.commit();
      boot.rotation.z = -0.3 + Math.sin(t * 0.6) * 0.015;
    },
  };
};

// ───────────────────────── snowed_in ─────────────────────────

/**
 * snowed_in: a drift up to the latch, sills and chimney capped, and a shovel
 * standing in it where somebody stopped. Every so often the eave lets go of
 * another load. Melts where it stands.
 */
export const snowedIn: Build = (s) => {
  const rnd = s.rnd;
  const SNOW = mat(PAL.snow), SNOW_B = mat(mix(PAL.snow, PAL.water, 0.14));
  const d = s.doorSpot, df = d.face, dh = s.doorH;
  const H = s.holder(d.p.x, 0, d.p.z, d.yaw);                // x along the wall, z out from the door
  const M = bone(H);                                         // melts
  const hi = dh * 0.78;
  M.add(
    ball(SNOW, 0.26, hi, 0.2, 0.0, 0.0, 0.07, 0, 0, 0, 1), ball(SNOW_B, 0.2, hi * 0.72, 0.17, -0.22, 0, 0.07), ball(SNOW, 0.21, hi * 0.6, 0.16, 0.24, 0, 0.06),
    ball(SNOW, 0.34, hi * 0.3, 0.2, 0.02, 0, 0.2), ball(SNOW_B, 0.17, hi * 0.34, 0.13, -0.42, 0, 0.05), ball(SNOW, 0.16, hi * 0.28, 0.12, 0.44, 0, 0.05),
    ball(SNOW, 0.12, hi * 0.16, 0.1, -0.56, 0, 0.04), ball(SNOW_B, 0.11, hi * 0.14, 0.1, 0.58, 0, 0.04), ball(SNOW, 0.2, hi * 0.14, 0.14, -0.2, 0, 0.3), ball(SNOW, 0.16, hi * 0.1, 0.1, 0.28, 0, 0.31),
  );
  // the shovel
  const sh = bone(H, 0.2, hi * 0.42, 0.2, -0.3, 0.4, -0.22);
  sh.add(cyl(WOOD(), 0.011, 0.011, 0.34, 0, 0.17, 0, 0, 0, 0, 5), box(WOOD_D(), 0.07, 0.014, 0.014, 0, 0.345, 0), box(IRON(), 0.085, 0.11, 0.01, 0, -0.03, 0));
  // sills, the lintel, the chimney
  const caps = s.holder();
  for (const w of s.windows.slice(0, 5)) caps.add(ball(SNOW, 0.13, 0.03, 0.045, w.p.x + w.n.x * 0.03, w.p.y - 0.115, w.p.z + w.n.z * 0.03, 0, w.yaw, 0));
  const doorU = s.lateral(df, s.door), ev = s.eaveAt(df, doorU);
  caps.add(ball(SNOW, 0.24, 0.035, 0.07, ev.x - d.n.x * 0.05, ev.y + 0.03, ev.z - d.n.z * 0.05, 0, d.yaw, 0));
  if (s.chimney) caps.add(ball(SNOW, 0.13, 0.05, 0.13, s.chimney.x, s.chimney.y + 0.01, s.chimney.z));
  const glints = new Swarm(SHAPE.spark(), mat(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.9 }), 6, s.own); M.add(glints.mesh);
  const gp = Array.from({ length: 6 }, (_, i) => [(rnd() - 0.5) * 0.7, hi * (0.25 + rnd() * 0.5), 0.14 + rnd() * 0.12, i * 1.7]);
  const clump = live(ball(SNOW, 0.07, 0.05, 0.06)); H.add(clump); clump.visible = false;
  const puff = new Swarm(SHAPE.ico(), SNOW, 5, s.own); H.add(puff.mesh);
  const evY = ev.y;
  return {
    exitDur: 1.1,
    update(f: Frame): void {
      const { t, out } = f;
      const melt = out >= 0 ? out : 0;
      M.scale.set(1 + melt * 0.25, Math.max(0.02, 1 - melt * 0.95), 1 + melt * 0.3);
      sh.position.y = hi * 0.42 * (1 - melt) + 0.03 * melt; sh.rotation.z = -0.22 - melt * melt * 1.2;
      // a load comes off the eave
      const per = 7.3, ph = (t % per) / per, fall = span(ph, 0.0, 0.07), land = span(ph, 0.07, 0.2);
      clump.visible = ph < 0.07 && out < 0;
      if (clump.visible) clump.position.set(0.05, lerp(evY, hi * 0.9, fall * fall), 0.1);
      const squash = bump(ph, 0.07, 0.16);
      if (out < 0) M.scale.y = 1 - 0.05 * squash;
      for (let i = 0; i < 5; i++) {
        if (land <= 0 || land >= 1 || out >= 0) { puff.hide(i); continue; }
        const a = i * 1.3, sc = 0.035 * (1 - land);
        puff.put(i, 0.05 + Math.cos(a) * land * 0.2, hi * 0.9 + Math.sin(land * Math.PI) * 0.1 - land * 0.1, 0.12 + Math.abs(Math.sin(a)) * land * 0.16, sc);
      }
      puff.commit();
      for (let i = 0; i < 6; i++) {
        const tw = Math.max(0, Math.sin(t * 1.9 + gp[i][3])) ** 6, sc = 0.03 * tw * (1 - melt);
        glints.put(i, gp[i][0], gp[i][1], gp[i][2], sc, sc, sc, 0, t * 0.5, 0);
      }
      glints.commit();
    },
  };
};

// ───────────────────────── frozen ─────────────────────────

/**
 * frozen: icicles the length of every eave, frost over the panes, the door
 * iced shut, a slick on the step, and a cold blue sheen on the whole house.
 * Glints run along the ice. When it thaws the icicles shorten and go.
 */
export const frozen: Build = (s) => {
  const rnd = s.rnd;
  const ICE = mat(mix(PAL.ghost, 0xffffff, 0.45), { rough: 0.12, emissive: PAL.water, emissiveIntensity: 0.3, transparent: true, opacity: 0.92 });
  const FROST = mat(mix(PAL.ghost, 0xffffff, 0.6), { transparent: true, opacity: 0.6, rough: 0.3, emissive: PAL.water, emissiveIntensity: 0.15 });
  const df = s.doorSpot.face;
  const list: { x: number; y: number; z: number; len: number; r: number; ph: number }[] = [];
  for (const f of [df, (df + 1) % 4, (df + 3) % 4, (df + 2) % 4]) {
    const L = s.lat(f) + 0.06, n = Math.max(2, Math.round((2 * L) / (f === (df + 2) % 4 ? 0.2 : 0.105)));
    for (let i = 0; i <= n; i++) {
      const u = -L + (2 * L * i) / n + (rnd() - 0.5) * 0.03, p = s.eaveAt(f, clamp(u, -L, L));
      const big = hash(i * 7 + f * 31 + s.seed) ** 2;
      if (!s.hangsFree(p, 0.12)) continue;                 // a roof that runs into the ground has nowhere to hang them
      list.push({ x: p.x, y: p.y + 0.012, z: p.z, len: 0.09 + big * 0.24, r: 0.016 + big * 0.016, ph: rnd() * TAU });
    }
  }
  if (!list.length) list.push({ x: 0, y: -1, z: 0, len: 0.001, r: 0.001, ph: 0 });
  const N = Math.min(list.length, 90);
  const H = s.holder();
  const ice = new Swarm(SHAPE.spike(), ICE, N, s.own); H.add(ice.mesh);
  // frost on the panes, ice on the door
  for (const w of s.windows.slice(0, 6)) {
    const Wn = s.holderOn(w, 0.022);
    Wn.add(quad(FROST, 0.23, 0.23, 0, 0, 0), ball(ICE, 0.13, 0.022, 0.03, 0, -0.118, 0.012));
    for (let i = 0; i < 3; i++) Wn.add(spike(ICE, 0.012, 0.04 + rnd() * 0.04, -0.08 + i * 0.08 + (rnd() - 0.5) * 0.03, -0.125, 0.014, Math.PI, 0, 0, 4));
  }
  const D = s.holderOn(s.doorSpot, 0.03);
  D.add(quad(FROST, s.doorW + 0.05, s.doorH, 0, 0, 0), ball(ICE, s.doorW * 0.75, 0.05, 0.07, 0, -s.doorH / 2 + 0.03, 0.02), gem(ICE, 0.05, 0.07, 0.04, -s.doorW * 0.4, -s.doorH / 2 + 0.06, 0.04, 0, 0.5, 0.2), gem(ICE, 0.04, 0.06, 0.04, s.doorW * 0.42, -s.doorH / 2 + 0.05, 0.04, 0, 1.1, -0.2));
  const slick = s.yard(0, 0.3);
  H.add(ball(mat(mix(PAL.ghost, PAL.water, 0.35), { transparent: true, opacity: 0.7, rough: 0.08 }), 0.36, 0.006, 0.27, slick.x, 0.005, slick.z, 0, s.doorSpot.yaw, 0));
  if (s.chimney) H.add(ball(ICE, 0.12, 0.035, 0.12, s.chimney.x, s.chimney.y + 0.005, s.chimney.z), spike(ICE, 0.02, 0.12, s.chimney.x + 0.09, s.chimney.y, s.chimney.z + 0.09, Math.PI, 0, 0, 4));
  // the sheen
  const sheenM = glowMat(mix(PAL.water, PAL.ghost, 0.5), 0.2, true); s.own.push(sheenM);
  const sheen = glowSprite(sheenM, s.top * 0.62, 0, s.top * 0.68, 0); s.group.add(sheen);
  const poolM = glowMat(mix(PAL.water, PAL.ghost, 0.5), 0.2, true); s.own.push(poolM);
  const pool = glowDisc(poolM, Math.max(s.w, s.h) * 0.6 + 0.55, 0, 0.026, 0); s.group.add(pool);
  const glints = new Swarm(SHAPE.spark(), mat(0xffffff, { emissive: PAL.ghost, emissiveIntensity: 1.6 }), 10, s.own); H.add(glints.mesh);
  const drip = new Swarm(SHAPE.flame(), ICE, 3, s.own); H.add(drip.mesh);

  return {
    exitDur: 1.0,
    update(f: Frame): void {
      const { env, t, age, out } = f;
      const k = smooth(age / 1.4) * (out >= 0 ? 1 - smooth(out) : 1);
      for (let i = 0; i < N; i++) {
        const c = list[i], grow = smooth(span(k, 0.1 + 0.4 * hash(i), 1));
        ice.put(i, c.x, c.y, c.z, c.r, c.len * grow, c.r, Math.PI, c.ph, 0);
      }
      ice.commit();
      for (let i = 0; i < 10; i++) {
        const c = list[(i * 7 + Math.floor(t * 0.4 + i * 0.3) * 13) % N], tw = Math.max(0, Math.sin(t * 2.2 + i * 2.4)) ** 5, sc = 0.04 * tw * k;
        glints.put(i, c.x, c.y - c.len * 0.5, c.z, sc, sc, sc, 0, t, 0);
      }
      glints.commit();
      for (let i = 0; i < 3; i++) {
        const c = list[(i * 11 + 3) % N], p = fract(t * 0.21 + i * 0.37), fall = span(p, 0.5, 1), sc = 0.008 * k * smooth(span(p, 0.3, 0.5));
        drip.put(i, c.x, c.y - c.len - 0.02 - fall * fall * (c.y - c.len - 0.03), c.z, sc, 0.026, sc);
      }
      drip.commit();
      sheenM.opacity = k * (0.16 + 0.2 * env.night + 0.04 * Math.sin(t * 1.3)); poolM.opacity = k * (0.18 + 0.2 * env.night);
      sheen.visible = k > 0.01; billboard(sheen, s.ctx.camera);
    },
  };
};

// ───────────────────────── quarantine ─────────────────────────

/**
 * quarantine: a yellow flag on a pole by the door, a chalk mark on the door
 * itself, a rope across the step with rags on it, and a basket left by a
 * neighbour at what the neighbour judged to be a safe distance.
 */
export const quarantine: Build = (s) => {
  const rnd = s.rnd;
  const d = s.doorSpot, doorU = s.lateral(d.face, s.door), side = doorU > 0.05 ? -1 : doorU < -0.05 ? 1 : rnd() < 0.5 ? 1 : -1;
  const YEL = mix(PAL.gold, 0xffe36a, 0.45);
  const CHALK = mat(PAL.hairWhite);
  // the mark: a ring and a cross
  const D = s.holderOn(d, 0.032);
  const R = Math.min(s.doorW * 0.42, 0.11), cy = s.doorH * 0.12;
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; D.add(box(CHALK, R * 0.66, 0.017, 0.003, Math.cos(a) * R, cy + Math.sin(a) * R, 0, 0, 0, a + Math.PI / 2 + 0.06)); }
  D.add(box(CHALK, R * 2.5, 0.02, 0.003, 0, cy, 0.001, 0, 0, 0.82), box(CHALK, R * 2.5, 0.02, 0.003, 0, cy, 0.001, 0, 0, -0.74));
  // the flag
  const fp = s.yard(side * (s.doorW / 2 + 0.3), 0.34);
  const F = s.holder(fp.x, 0, fp.z, d.yaw);
  const mast = bone(F, 0, 0, 0, 0, 0, side * 0.06);
  mast.add(pole(1.2, 0.017), ball(mat(PAL.timber), 0.022, 0.022, 0.022, 0, 1.21, 0));
  const flag = new Cloth(0.42, 0.27, mat(0xffffff, { vertexColors: true, side: THREE.DoubleSide }), 'side', s.own, 6, 4, 0.12, (u) => (u < 0.06 ? mix(YEL, PAL.goldDark, 0.6) : YEL));
  flag.mesh.position.set(side * 0.012, 1.04, 0); flag.mesh.rotation.y = (side > 0 ? 0 : Math.PI) - side * 0.5; flag.mesh.castShadow = true; mast.add(flag.mesh);
  // the rope across the step
  const a = s.yard(-(s.doorW / 2 + 0.16), 0.2), b = s.yard(s.doorW / 2 + 0.16, 0.2);
  const Rp = s.holder();
  const pa = V(a.x, 0.3, a.z), pb = V(b.x, 0.3, b.z), rp = rope(pa, pb, 0.05);
  Rp.add(cyl(WOOD(), 0.012, 0.016, 0.34, a.x, 0.17, a.z, 0, 0, 0, 5), cyl(WOOD(), 0.012, 0.016, 0.34, b.x, 0.17, b.z, 0, 0, 0, 5), rp.g);
  const rags: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) { const p = rp.at(0.25 + i * 0.25), rb = bone(Rp, p.x, p.y, p.z, 0, d.yaw, 0); rb.rotation.order = 'YXZ'; rb.add(box(mat(i === 1 ? PAL.clothCream : YEL), 0.045, 0.085, 0.006, 0, -0.045, 0)); rags.push(rb); }
  // the basket
  const bp = s.yard(-side * (s.doorW / 2 + 0.3), 0.5);
  const Bk = s.holder(bp.x, 0, bp.z, rnd() * 3);
  Bk.add(basket(), ball(mat(mix(PAL.clothOchre, PAL.clothBrown, 0.3)), 0.045, 0.03, 0.035, -0.015, 0.085, 0.01), cyl(mat(PAL.verdigris), 0.012, 0.018, 0.07, 0.035, 0.1, -0.015, 0.2, 0, -0.2, 6), box(mat(PAL.clothCream), 0.13, 0.008, 0.1, 0, 0.074, 0, 0, 0.5, 0));
  return {
    update(f: Frame): void {
      const { env, t } = f;
      flag.wave(t, 0.012 + 0.04 * env.wind, 5, 5 + 5 * env.wind);
      mast.rotation.z = side * 0.06 + Math.sin(t * 1.3) * 0.012 * (0.5 + env.wind);
      for (let i = 0; i < 3; i++) rags[i].rotation.x = Math.sin(t * 2.4 + i * 1.9) * 0.25 * (0.4 + env.wind) + 0.1;
    },
  };
};

// ───────────────────────── graffiti ─────────────────────────

/** the drawing, as chalk strokes in a 0..1 square (y down): a crowned landlord of generous build, with the takings */
const circle = (cx: number, cy: number, rx: number, ry: number, a0 = 0, a1 = TAU, n = 14): number[][] => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
const LANDLORD: number[][][] = [
  circle(0.5, 0.63, 0.2, 0.22),                                              // the belly
  circle(0.5, 0.31, 0.118, 0.11),                                            // the head
  [[0.39, 0.235], [0.385, 0.115], [0.44, 0.18], [0.5, 0.09], [0.56, 0.18], [0.615, 0.115], [0.61, 0.235]],   // the crown
  [[0.42, 0.25], [0.48, 0.275]], [[0.58, 0.25], [0.52, 0.275]],              // brows
  circle(0.455, 0.295, 0.012, 0.012, 0, TAU, 5), circle(0.545, 0.295, 0.012, 0.012, 0, TAU, 5),
  [[0.5, 0.3], [0.575, 0.36], [0.495, 0.365]],                               // the nose
  circle(0.5, 0.415, 0.05, 0.028, Math.PI * 1.1, Math.PI * 1.9, 6),          // the mouth, unimpressed
  [[0.31, 0.66], [0.69, 0.66]], circle(0.5, 0.66, 0.022, 0.022, 0, TAU, 6),  // belt and buckle
  [[0.32, 0.54], [0.2, 0.43]], circle(0.165, 0.36, 0.062, 0.07),             // an arm, and the bag
  [[0.14, 0.295], [0.19, 0.295]], [[0.15, 0.36], [0.18, 0.36]], [[0.165, 0.34], [0.165, 0.38]],
  [[0.68, 0.54], [0.8, 0.5]], [[0.8, 0.5], [0.85, 0.455]], [[0.8, 0.5], [0.86, 0.505]], [[0.8, 0.5], [0.84, 0.55]],   // the other hand, out
  [[0.42, 0.84], [0.405, 0.94], [0.35, 0.945]], [[0.58, 0.84], [0.595, 0.94], [0.65, 0.945]],                        // small legs
  [[0.9, 0.2], [0.72, 0.26]], [[0.72, 0.26], [0.775, 0.215]], [[0.72, 0.26], [0.785, 0.285]],                        // an arrow, for clarity
];

/**
 * graffiti: somebody has drawn the landlord on the wall, in chalk, from
 * memory and without affection. Scrubbed off, it fades.
 */
export const graffiti: Build = (s) => {
  const rnd = s.rnd;
  const size = clamp(s.eave * 0.86, 0.34, 0.62);
  const fw = s.freeWall(size * 0.4), sp = s.wall(fw.face, fw.u, size * 0.5 + 0.03);
  const H = s.holder(sp.p.x + sp.n.x * 0.014, size * 0.5 + 0.03, sp.p.z + sp.n.z * 0.014, sp.yaw);
  // and again, smaller, wherever else there was room
  const df = s.doorSpot.face, others = [df, (df + 1) % 4, (df + 3) % 4].filter(f => f !== fw.face);
  const fw2 = s.freeWall(size * 0.3, others), sp2 = s.wall(fw2.face, fw2.u, size * 0.4 + 0.03);
  const H2 = fw2.room > -0.04 ? s.holder(sp2.p.x + sp2.n.x * 0.014, size * 0.4 + 0.05, sp2.p.z + sp2.n.z * 0.014, sp2.yaw) : null;
  const tex = canvasTex('graffiti-landlord', 256, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.lineCap = 'round'; c.lineJoin = 'round';
    for (let pass = 0; pass < 3; pass++) {
      c.strokeStyle = pass === 0 ? 'rgba(150,40,34,0.25)' : 'rgba(150,40,34,0.9)'; c.lineWidth = pass === 0 ? 14 : pass === 1 ? 7.5 : 3.5;
      LANDLORD.forEach((line, li) => {
        c.beginPath();
        line.forEach(([x, y], i) => { const j = pass === 2 ? 2.2 : 1.2, px = x * w + Math.sin(i * 12.9 + li * 3.1 + pass * 5) * j, py = y * h + Math.cos(i * 7.3 + li * 1.7 + pass * 2) * j; if (i) c.lineTo(px, py); else c.moveTo(px, py); });
        c.stroke();
      });
    }
  });
  let fadeM: THREE.MeshStandardMaterial | null = null;
  if (tex) {
    fadeM = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1 });
    s.own.push(fadeM);
    const q = live(quad(fadeM, size, size)); q.renderOrder = 1; q.rotation.z = (rnd() - 0.5) * 0.08; H.add(q);
    if (H2) { const q2 = live(quad(fadeM, size * 0.72, size * 0.72)); q2.renderOrder = 1; q2.rotation.z = 0.06; H2.add(q2); }
  } else {
    const CH = mat(PAL.crimson);
    for (const [hh, k] of [[H, 1], [H2, 0.72]] as [THREE.Group | null, number][]) {
      if (hh) for (const line of LANDLORD) for (let i = 0; i + 1 < line.length; i++) {
        const ax = (line[i][0] - 0.5) * size * k, ay = (0.5 - line[i][1]) * size * k, bx = (line[i + 1][0] - 0.5) * size * k, by = (0.5 - line[i + 1][1]) * size * k;
        hh.add(box(CH, 0.014, Math.hypot(bx - ax, by - ay) + 0.008, 0.003, (ax + bx) / 2, (ay + by) / 2, 0, 0, 0, Math.atan2(-(bx - ax), by - ay)));
      }
    }
  }
  // the evidence
  const g = s.holder(sp.p.x + sp.n.x * 0.16, 0, sp.p.z + sp.n.z * 0.16, sp.yaw + rnd());
  g.add(cyl(mat(PAL.crimson), 0.012, 0.012, 0.055, 0, 0.012, 0, 0, 0, Math.PI / 2, 5), cyl(mat(PAL.crimson), 0.01, 0.01, 0.03, 0.06, 0.01, 0.04, 0, 0.8, Math.PI / 2, 5), ball(mat(mix(PAL.crimson, PAL.dirt, 0.5)), 0.05, 0.002, 0.03, 0.02, 0.002, 0.01));
  return {
    exitDur: 0.9,
    update(f: Frame): void {
      if (fadeM) fadeM.opacity = smooth(f.age / 0.5) * (f.out >= 0 ? 1 - f.out : 1);
    },
  };
};
