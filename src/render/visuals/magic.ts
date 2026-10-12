/**
 * The uncanny: purple_paint, sparkles, curse_cloud, cauldron, toadstool_ring,
 * mushrooms, vines and gargoyle. Glows are emissive paint and additive discs;
 * they come into their own at night.
 */
import * as THREE from 'three';
import { PAL, mat, mix } from '../palette';
import {
  aim, ball, beat, billboard, blade, bone, box, bump, clamp, cyl, damp, gem, geo, glowDisc, glowMat, glowSprite, grp, hash, lerp, lieOn, live, noise, presence, pyr, ring, slopeSpot, smooth, span, spike, SHAPE, Swarm, TAU,
  type Build, type Frame, type LoopPt,
} from './kit';
import { bucket, strut, IRON, WOOD, WOOD_D } from './props';

const fract = (v: number): number => v - Math.floor(v);
const wet = (w: string): boolean => w === 'rain' || w === 'storm';
const V = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

// ───────────────────────── purple_paint ─────────────────────────

/**
 * purple_paint: a wizard has been decorating. Great wet splashes of purple
 * down the walls and across the roof, runs still creeping, a ladder left where
 * it stood, one pail upright with the brush in it and one on its side in a
 * spreading pool. The paint is not entirely ordinary: motes come off it.
 */
export const purplePaint: Build = (s) => {
  const rnd = s.rnd;
  const P = mat(PAL.purple, { rough: 0.4 }), P_L = mat(mix(PAL.purple, PAL.magic, 0.45), { rough: 0.4 }), P_D = mat(mix(PAL.purple, PAL.wizardRoof, 0.5), { rough: 0.4 });
  const df = s.doorSpot.face, dn = s.doorSpot.n, doorU = s.lateral(df, s.door), L = s.lat(df);
  const side = doorU > 0.05 ? -1 : doorU < -0.05 ? 1 : rnd() < 0.5 ? 1 : -1;
  const tips: THREE.Vector3[] = [];
  const splat = (f: number, u: number, y: number, size: number): void => {
    const w = s.wall(f, clamp(u, -s.lat(f) + size * 0.6, s.lat(f) - size * 0.6), y);
    const H = s.holderOn(w, 0.012);
    H.add(ball(P, size, size * 0.78, 0.004, 0, 0, 0, 0, 0, rnd() * 3), ball(P_L, size * 0.5, size * 0.42, 0.004, size * 0.25, size * 0.22, 0.003), ball(P, size * 0.55, size * 0.45, 0.004, -size * 0.62, -size * 0.15, 0.001), ball(P_D, size * 0.3, size * 0.26, 0.004, size * 0.7, -size * 0.35, 0.001));
    for (let i = 0; i < 6; i++) { const a = rnd() * TAU, r = size * (1.05 + rnd() * 0.5), q = 0.012 + rnd() * 0.02; H.add(ball(P, q, q, 0.004, Math.cos(a) * r, Math.sin(a) * r * 0.8, 0)); }
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * size * 0.44 + (rnd() - 0.5) * 0.02, y0 = -size * 0.45, y1 = Math.max(0.02 - y, y0 - size * (0.5 + rnd() * 1.5)), wd = 0.02 + rnd() * 0.012;
      H.add(box(P, wd, y0 - y1, 0.004, x, (y0 + y1) / 2, 0.001), ball(P, wd * 0.8, wd, 0.006, x, y1, 0.002));
      if (i === 1 && tips.length < 3 && y1 + y > 0.12) tips.push(V(H.position.x + Math.cos(w.yaw) * x + w.n.x * 0.012, y + y1 - 0.02, H.position.z - Math.sin(w.yaw) * x + w.n.z * 0.012));
    }
  };
  const hi = s.eave * 0.62;
  splat(df, doorU - side * (s.doorW / 2 + 0.3), hi, 0.16);
  splat((df + 1) % 4, (rnd() - 0.5) * 0.3, hi * 1.05, 0.19);
  splat((df + 3) % 4, (rnd() - 0.5) * 0.3, hi * 0.95, 0.17);
  splat(df, doorU + side * (s.doorW / 2 + 0.34), hi * 0.6, 0.1);
  // across the roof, and running for the eave
  for (const [v, u, sz] of [[0.42, -0.45, 0.24], [0.62, 0.55, 0.17]] as [number, number, number][]) {
    const r = slopeSpot(s, v, u), H = s.holder(r.p.x + r.n.x * 0.012, r.p.y + r.n.y * 0.012, r.p.z + r.n.z * 0.012); lieOn(H, r.n);
    H.add(ball(P, sz, sz * 0.75, 0.004, 0, 0, 0, 0, 0, rnd() * 3), ball(P_L, sz * 0.45, sz * 0.4, 0.004, sz * 0.2, sz * 0.2, 0.003), ball(P, sz * 0.5, sz * 0.5, 0.004, -sz * 0.6, sz * 0.1, 0.001));
    for (let i = 0; i < 4; i++) { const x = (i - 1.5) * sz * 0.42, len = sz * (0.5 + rnd() * 1.0); H.add(box(P, 0.03, len, 0.004, x, -sz * 0.4 - len / 2, 0.001), ball(P, 0.022, 0.026, 0.006, x, -sz * 0.4 - len, 0.002)); }
  }
  // the pails
  const p1 = s.yard(side * (s.doorW / 2 + 0.2), 0.3);
  const A = s.holder(p1.x, 0, p1.z, rnd() * 3);
  A.add(bucket(P), cyl(WOOD(), 0.008, 0.008, 0.17, 0.02, 0.15, 0, 0, 0, -0.45, 5), box(P, 0.035, 0.05, 0.016, 0.062, 0.228, 0, 0, 0, -0.45), ball(P, 0.05, 0.004, 0.035, 0.1, 0.003, 0.05));
  const p2 = s.yard(side * (s.doorW / 2 + 0.36), 0.62);
  const B = s.holder(p2.x, 0, p2.z, s.doorSpot.yaw + side * 0.9);
  const tipped = bucket(P); tipped.rotation.x = Math.PI / 2 - 0.12; tipped.position.set(0, 0.055, 0); B.add(tipped);
  B.add(ball(P, 0.15, 0.007, 0.2, 0.01, 0.004, 0.24, 0, 0.2, 0), ball(P_L, 0.07, 0.008, 0.1, 0.0, 0.004, 0.2), ball(P, 0.08, 0.006, 0.07, -0.12, 0.004, 0.36), ball(P, 0.03, 0.005, 0.03, 0.14, 0.004, 0.44));
  // the ladder, with one more pail up it
  const lu = clamp(doorU - side * Math.max(s.doorW / 2 + 0.5, L * 0.72), -L + 0.12, L - 0.12);
  const lw = s.wall(df, lu, s.eave * 0.5), top = s.eave * 0.97;
  const Ld = s.holder(lw.p.x, 0, lw.p.z, lw.yaw);
  for (const sx of [-1, 1]) Ld.add(strut(WOOD(), V(sx * 0.075, 0, 0.3), V(sx * 0.075, top, 0.035), 0.022));
  for (let i = 1; i <= 5; i++) { const k = i / 5.6; Ld.add(box(WOOD_D(), 0.17, 0.016, 0.016, 0, top * k, lerp(0.3, 0.035, k))); }
  const up = bucket(P); up.scale.setScalar(0.8); up.position.set(0.03, top * (4 / 5.6) + 0.008, lerp(0.3, 0.035, 4 / 5.6) + 0.01); up.rotation.x = 0.1; Ld.add(up);
  Ld.add(box(P, 0.02, top * 0.3, 0.004, 0.08, top * 0.56, lerp(0.3, 0.035, 0.6) + 0.014, -0.27), ball(P, 0.06, 0.004, 0.05, 0.08, 0.003, 0.24));
  tips.push(V(lw.p.x + Math.cos(lw.yaw) * 0.085 + dn.x * 0.2, top * 0.62, lw.p.z - Math.sin(lw.yaw) * 0.085 + dn.z * 0.2));

  const D = s.holder();
  const drops = new Swarm(SHAPE.flame(), P, tips.length * 2, s.own); D.add(drops.mesh);
  const N = 14;
  const motes = new Swarm(SHAPE.spark(), mat(mix(PAL.magic, 0xffffff, 0.3), { emissive: PAL.magic, emissiveIntensity: 1.5 }), N, s.own); s.group.add(motes.mesh);
  const pt: LoopPt = { x: 0, z: 0, yaw: 0 };
  const M = Array.from({ length: N }, () => ({ u: rnd(), lane: 0.04 + rnd() * 0.28, sp: 0.1 + rnd() * 0.12, ph: rnd() * TAU, off: rnd() }));
  const H = s.top + 0.35;

  return {
    exitDur: 0.8,
    update(f: Frame): void {
      const { env, t, out } = f;
      const k = presence(f, 0.8);
      for (let j = 0; j < tips.length; j++) for (let i = 0; i < 2; i++) {
        const p = fract(t * 0.45 + i * 0.5 + j * 0.31), tip = tips[j], hang = span(p, 0, 0.45), fall = span(p, 0.45, 1), sc = 0.006 + 0.012 * smooth(hang);
        drops.put(j * 2 + i, tip.x, tip.y - 0.03 - 0.02 * hang - (tip.y - 0.04) * fall * fall, tip.z, sc, 0.04 + 0.02 * fall, sc);
      }
      drops.commit();
      for (let i = 0; i < N; i++) {
        const m = M[i], p = fract(t * m.sp * 0.5 + m.off);
        s.around(m.lane + 0.1 * Math.sin(t * 0.7 + m.ph), m.u + t * 0.012 + 0.03 * Math.sin(t * 0.5 + m.ph), pt);
        const tw = (0.55 + 0.45 * Math.sin(t * 3.1 + m.ph)) * Math.sin(p * Math.PI), sc = 0.045 * tw * k * (0.8 + 0.5 * env.night);
        motes.put(i, pt.x, 0.08 + p * H + (out >= 0 ? out * 0.6 : 0), pt.z, sc, sc, sc, t * 0.8 + i, t * 1.1, 0);
      }
      motes.commit();
    },
  };
};

// ───────────────────────── sparkles ─────────────────────────

/**
 * sparkles: the house is under a blessing, or an enchantment, or has simply
 * been cleaned. Small stars drift up round it and wink, a few settle on the
 * ridge and the sills, and at night the ground beneath is faintly gold.
 */
export const sparkles: Build = (s) => {
  const rnd = s.rnd;
  const NA = 20, NB = 12;
  const a = new Swarm(SHAPE.spark(), mat(PAL.flameCore, { emissive: PAL.gold, emissiveIntensity: 1.7 }), NA + 5, s.own);
  const b = new Swarm(SHAPE.spark(), mat(mix(PAL.magic, 0xffffff, 0.45), { emissive: PAL.magic, emissiveIntensity: 1.5 }), NB, s.own);
  s.group.add(a.mesh, b.mesh);
  const P = Array.from({ length: NA + NB }, () => ({ u: rnd(), lane: 0.03 + rnd() * 0.3, sp: 0.07 + rnd() * 0.09, ph: rnd() * TAU, off: rnd(), w: 2 + rnd() * 2.5, size: 0.075 + rnd() * 0.06 }));
  // the ones that have settled
  const rest: THREE.Vector3[] = [s.perch.clone().setY(s.perch.y + 0.07)];
  if (s.chimney) rest.push(s.chimney.clone().setY(s.chimney.y + 0.07));
  for (const w of s.windows.slice(0, 2)) rest.push(V(w.p.x + w.n.x * 0.06, w.p.y + 0.11, w.p.z + w.n.z * 0.06));
  rest.push(V(s.doorSpot.p.x + s.doorSpot.n.x * 0.07, s.doorH + 0.06, s.doorSpot.p.z + s.doorSpot.n.z * 0.07));
  const poolM = glowMat(PAL.gold, 0.2, true); s.own.push(poolM);
  const pool = glowDisc(poolM, Math.max(s.w, s.h) * 0.62 + 0.5, 0, 0.025, 0); s.group.add(pool);
  const pt: LoopPt = { x: 0, z: 0, yaw: 0 };
  const H = s.top + 0.3;

  return {
    exitDur: 0.9,
    update(f: Frame): void {
      const { env, t, out } = f;
      const k = presence(f, 0.7), lift = out >= 0 ? out * out * 1.4 : 0;
      for (let i = 0; i < NA + NB; i++) {
        const m = P[i], p = fract(t * m.sp + m.off);
        s.around(m.lane, m.u + t * 0.01 * (i % 2 ? 1 : -1), pt);
        const tw = (0.25 + 0.75 * Math.max(0, Math.sin(t * m.w + m.ph)) ** 2) * Math.sin(p * Math.PI), sc = m.size * tw * k;
        (i < NA ? a : b).put(i < NA ? i : i - NA, pt.x + Math.sin(t * 0.9 + m.ph) * 0.05, 0.06 + p * H + lift, pt.z + Math.cos(t * 0.8 + m.ph) * 0.05, sc, sc, sc, 0, t * 0.9 + i, 0);
      }
      for (let i = 0; i < 5; i++) {
        const r = rest[i % rest.length], on = i < rest.length ? beat(t, 3.1 + i * 0.83, 0.9, i * 1.9) : 0, sc = 0.14 * on * k;
        a.put(NA + i, r.x, r.y + lift, r.z, sc, sc, sc, 0, t * 2 + i, Math.PI / 4 * on);
      }
      a.commit(); b.commit();
      poolM.opacity = k * (0.05 + 0.3 * env.night) * (0.85 + 0.15 * Math.sin(t * 2.1));
    },
  };
};

// ───────────────────────── curse_cloud ─────────────────────────

/**
 * curse_cloud: a small storm cloud, the property of this address alone. It
 * sits over the roof, rains on it and nowhere else, and at intervals strikes
 * the ridge with a lightning bolt the length of a broom handle.
 */
export const curseCloud: Build = (s) => {
  const rnd = s.rnd;
  const CL = [mat(mix(PAL.slateDark, PAL.clothPlum, 0.3)), mat(mix(PAL.slate, PAL.clothPlum, 0.2)), mat(mix(PAL.slateDark, PAL.ink, 0.4))];
  const R = clamp(Math.max(s.ext[0], s.ext[1]) * 0.7 + 0.12, 0.5, 0.95);
  const base = V(s.perch.x, Math.max(s.perch.y + 0.5, s.top + 0.26), s.perch.z);
  const C = bone(s.group, base.x, base.y, base.z); C.visible = false;
  C.add(ball(CL[0], R * 0.6, 0.17, R * 0.46, 0, 0.03, 0), ball(CL[2], R * 0.86, 0.06, R * 0.64, 0, -0.07, 0));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + rnd() * 0.3;
    C.add(ball(CL[i % 2], R * (0.3 + rnd() * 0.12), 0.11 + rnd() * 0.06, R * (0.26 + rnd() * 0.1), Math.cos(a) * R * 0.56, (rnd() - 0.5) * 0.05 + 0.01, Math.sin(a) * R * 0.4));
  }
  C.add(ball(CL[1], R * 0.32, 0.13, R * 0.28, -R * 0.15, 0.14, 0.02), ball(CL[1], R * 0.24, 0.1, R * 0.22, R * 0.25, 0.11, -0.04));
  // rain, on this house only
  const NR = 26;
  const rain = new Swarm(SHAPE.box(), mat(mix(PAL.water, 0xffffff, 0.35), { emissive: PAL.water, emissiveIntensity: 0.35 }), NR, s.own); s.group.add(rain.mesh);
  const drops = Array.from({ length: NR }, () => {
    const a = rnd() * TAU, r = Math.sqrt(rnd()), x = base.x + Math.cos(a) * r * R * 0.75, z = base.z + Math.sin(a) * r * R * 0.56;
    const inside = Math.abs(x) < Math.max(s.ext[1], s.ext[3]) + 0.12 && Math.abs(z) < Math.max(s.ext[0], s.ext[2]) + 0.12;
    return { x, z, y: inside ? s.roofAt(x, z).p.y : 0, off: rnd() };
  });
  // the bolt
  const boltM = mat(PAL.flameCore, { emissive: 0xfff2b0, emissiveIntensity: 3 });
  const bolt = bone(C, 0, -0.1, 0); bolt.visible = false;
  const drop = base.y - 0.1 - s.perch.y;
  const zig: [number, number][] = [[0.03, 0], [-0.07, -0.32], [0.05, -0.38], [-0.04, -0.72], [0.03, -0.78], [0, -1]];
  for (let i = 0; i + 1 < zig.length; i++) bolt.add(strut(boltM, V(zig[i][0], zig[i][1] * drop, 0), V(zig[i + 1][0], zig[i + 1][1] * drop, 0), 0.028 - i * 0.003, 0.012));
  const flashM = glowMat(0xcfd8ff, 0.5, true); s.own.push(flashM);
  const flash = glowSprite(flashM, R * 1.5); C.add(flash);
  const hitM = glowMat(0xfff2c0, 0.5, true); s.own.push(hitM);
  const hit = glowSprite(hitM, 0.26, s.perch.x, s.perch.y + 0.24, s.perch.z); s.group.add(hit);
  let glow = 0;

  return {
    exitDur: 1.1,
    update(f: Frame): void {
      const { env, t, dt, age, out } = f;
      const k = smooth(age / 0.9) * (out >= 0 ? 1 - smooth(out) : 1);
      C.visible = k > 0.01;
      const per = 3.7, ph = (t % per) / per, strike = out < 0 && age > 1 && (ph < 0.03 || (ph > 0.06 && ph < 0.085));
      glow = strike ? 1 : damp(glow, 0, 9, dt);
      C.position.set(base.x + Math.sin(t * 0.5) * 0.07, base.y + Math.sin(t * 0.9) * 0.03 + (out >= 0 ? out * 0.5 : 0), base.z + Math.cos(t * 0.4) * 0.05);
      const puff = 1 + 0.025 * Math.sin(t * 1.3) + glow * 0.04;
      C.scale.set(k * puff, k * (2 - puff), k * puff);
      bolt.visible = strike; bolt.scale.x = Math.floor(t / per) % 2 ? 1 : -1; bolt.rotation.y = Math.floor(t / per) * 1.3;
      flashM.opacity = glow * 0.55; flash.visible = glow > 0.02; billboard(flash, s.ctx.camera);
      hitM.opacity = glow * (0.5 + 0.4 * env.night); hit.visible = glow > 0.02; billboard(hit, s.ctx.camera);
      const topY = C.position.y - 0.09;
      for (let i = 0; i < NR; i++) {
        const d = drops[i], p = fract(t * 1.5 + d.off);
        const y = lerp(topY, d.y, p * p * 0.6 + p * 0.4), ox = C.position.x - base.x + env.wind * 0.1 * p;
        if (k < 0.5 || y < d.y + 0.03) rain.hide(i); else rain.put(i, d.x + ox, y, d.z, 0.009, 0.1, 0.009, 0, 0, -env.wind * 0.2);
      }
      rain.commit();
    },
  };
};

// ───────────────────────── cauldron ─────────────────────────

/**
 * cauldron: an iron pot on a small fire in the yard, full of something green
 * that bubbles, steams, lights up the wall behind it and is being stirred by
 * a spoon that nobody is holding.
 */
export const cauldron: Build = (s) => {
  const rnd = s.rnd;
  const d = s.doorSpot, doorU = s.lateral(d.face, s.door), side = doorU > 0.05 ? -1 : doorU < -0.05 ? 1 : rnd() < 0.5 ? 1 : -1;
  const at = s.yard(side * (s.doorW / 2 + 0.44), 0.52);
  const H = s.holder(at.x, 0, at.z, rnd() * TAU);
  const POT = mat(mix(PAL.iron, PAL.ink, 0.5), { rough: 0.6 });
  const GREEN = mix(PAL.good, 0xb8ff6a, 0.55);
  const GOO = mat(GREEN, { emissive: PAL.good, emissiveIntensity: 1.3, rough: 0.3 });
  const potG = geo('cauldron', () => new THREE.LatheGeometry([[0.001, 0], [0.075, 0.008], [0.13, 0.05], [0.155, 0.115], [0.145, 0.175], [0.12, 0.208], [0.138, 0.228], [0.138, 0.242], [0.114, 0.242]].map(p => new THREE.Vector2(p[0], p[1])), 9));
  const Y0 = 0.075;
  const pot = new THREE.Mesh(potG, POT); pot.position.y = Y0; H.add(pot);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + 0.5; H.add(aim(spike(POT, 0.022, 0.1, Math.cos(a) * 0.1, Y0 + 0.03, Math.sin(a) * 0.1, 0, 0, 0, 4), Math.cos(a) * 0.35, -1, Math.sin(a) * 0.35)); }
  for (const sx of [-1, 1]) H.add(ring(POT, 0.03, 0.007, sx * 0.15, Y0 + 0.185, 0, Math.PI / 2, 0, 0, 7));
  H.add(cyl(GOO, 0.116, 0.116, 0.008, 0, Y0 + 0.226, 0, 0, 0, 0, 9));
  // the fire under it
  for (let i = 0; i < 3; i++) H.add(box(mat(i ? PAL.trunk : PAL.timber), 0.04, 0.035, 0.26, 0, 0.02, 0, 0, (i / 3) * Math.PI + 0.3, 0));
  for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU; H.add(gem(mat(i % 2 ? PAL.stone : PAL.stoneDark), 0.035, 0.028, 0.03, Math.cos(a) * 0.2, 0.02, Math.sin(a) * 0.2, 0, a, 0)); }
  const flames = new Swarm(SHAPE.flame(), mat(PAL.fire, { emissive: PAL.fire, emissiveIntensity: 1.6 }), 4, s.own);
  const bubbles = new Swarm(SHAPE.ico1(), GOO, 6, s.own);
  const steam = new Swarm(SHAPE.ico(), mat(mix(GREEN, 0xffffff, 0.4), { transparent: true, opacity: 0.38, emissive: PAL.good, emissiveIntensity: 0.6, rough: 1 }), 6, s.own); steam.mesh.renderOrder = 3;
  const sparks = new Swarm(SHAPE.spark(), mat(GREEN, { emissive: GREEN, emissiveIntensity: 1.8 }), 3, s.own);
  H.add(flames.mesh, bubbles.mesh, steam.mesh, sparks.mesh);
  // the spoon
  const stir = bone(H, 0, Y0 + 0.23, 0);
  stir.add(aim(box(WOOD(), 0.018, 0.3, 0.018, 0.085, 0.09, 0), 0.38, 1, 0), ball(WOOD_D(), 0.022, 0.012, 0.03, 0.036, -0.03, 0));
  // odds and ends
  H.add(cyl(mat(PAL.verdigris), 0.016, 0.026, 0.07, 0.3, 0.035, 0.1, 0, 0, 0, 6), cyl(mat(PAL.clothBrown), 0.01, 0.01, 0.02, 0.3, 0.08, 0.1, 0, 0, 0, 5), cyl(mat(PAL.clothPlum), 0.022, 0.022, 0.05, 0.34, 0.018, -0.02, Math.PI / 2, 0.6, 0, 6), box(mat(PAL.lapis), 0.11, 0.03, 0.14, -0.3, 0.015, 0.1, 0, 0.4, 0), box(mat(PAL.parchment), 0.1, 0.02, 0.13, -0.3, 0.02, 0.1, 0, 0.4, 0));
  const poolM = glowMat(GREEN, 0.3, true), haloM = glowMat(GREEN, 0.3, true); s.own.push(poolM, haloM);
  const pool = glowDisc(poolM, 0.62, at.x, 0.03, at.z); s.group.add(pool);
  const halo = glowSprite(haloM, 0.34, at.x, Y0 + 0.3, at.z); s.group.add(halo);
  const bp = Array.from({ length: 6 }, () => ({ a: rnd() * TAU, r: 0.02 + rnd() * 0.075, sp: 0.5 + rnd() * 0.5, off: rnd(), size: 0.022 + rnd() * 0.022 }));

  return {
    update(f: Frame): void {
      const { env, t } = f;
      const k = presence(f, 0.6);
      stir.rotation.y = t * 1.5 + Math.sin(t * 0.7) * 0.4; stir.position.y = Y0 + 0.23 + Math.sin(t * 3) * 0.006;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + 0.4, fl = 0.75 + 0.3 * noise(t * 7 + i * 5, 2);
        flames.put(i, Math.cos(a) * 0.085, 0.03, Math.sin(a) * 0.085, 0.04, 0.1 * fl, 0.04, Math.sin(a) * -0.5, t * 2 + i, Math.cos(a) * 0.5 - env.wind * 0.2);
      }
      for (let i = 0; i < 6; i++) {
        const b = bp[i], p = fract(t * b.sp + b.off), sc = p < 0.85 ? b.size * Math.sin((p / 0.85) * Math.PI / 2) : 0;
        if (sc <= 0) bubbles.hide(i); else bubbles.put(i, Math.cos(b.a + Math.floor(t * b.sp + b.off)) * b.r, Y0 + 0.228, Math.sin(b.a + Math.floor(t * b.sp + b.off) * 1.7) * b.r, sc, sc * 0.8, sc);
        const q = fract(t * 0.3 + i / 6), ss = (0.035 + 0.08 * q) * Math.sin(Math.min(1, q * 5) * Math.PI / 2) * (1 - smooth(span(q, 0.65, 1)));
        steam.put(i, Math.sin(i * 2.4 + q * 4) * 0.05 + env.wind * q * 0.35, Y0 + 0.27 + q * 0.62, Math.cos(i * 1.7 + q * 3) * 0.05, ss, ss, ss, q * 2, i, 0);
      }
      for (let i = 0; i < 3; i++) {
        const q = fract(t * 0.27 + i * 0.41), up = span(q, 0, 0.22), a = i * 2.2 + Math.floor(t * 0.27 + i * 0.41) * 2.4;
        if (up >= 1) sparks.hide(i); else { const sc = 0.035 * (1 - up); sparks.put(i, Math.cos(a) * (0.05 + up * 0.22), Y0 + 0.24 + Math.sin(up * Math.PI) * 0.26, Math.sin(a) * (0.05 + up * 0.22), sc, sc, sc, t * 5, i, 0); }
      }
      flames.commit(); bubbles.commit(); steam.commit(); sparks.commit();
      const pulse = 0.82 + 0.18 * noise(t * 3.3, 6);
      poolM.opacity = k * (0.14 + 0.5 * env.night) * pulse; haloM.opacity = k * (0.1 + 0.3 * env.night) * pulse;
      billboard(halo, s.ctx.camera);
    },
  };
};

// ───────────────────────── toadstools and mushrooms ─────────────────────────

/** one mushroom, standing at the origin: stem, gills, a faceted cap; `dots` for the red-and-white kind */
function shroom(h: number, r: number, capM: THREE.Material, stemM: THREE.Material, gillM: THREE.Material, dots: THREE.Material | null, flat = 0.55): THREE.Group {
  const g = grp();
  g.add(
    cyl(stemM, r * 0.26, r * 0.36, h, 0, h / 2, 0, 0, 0, 0, 6),
    cyl(gillM, r * 0.94, r * 0.45, 0.014, 0, h - 0.004, 0, 0, 0, 0, 8),
    cyl(capM, r * 0.34, r, r * flat, 0, h + r * flat / 2, 0, 0, 0, 0, 8), ball(capM, r * 0.36, r * 0.16, r * 0.36, 0, h + r * flat, 0),
  );
  if (dots) for (let i = 0; i < 5; i++) { const a = i * 1.257 + r * 40, rr = i === 4 ? 0 : r * 0.68; g.add(ball(dots, r * 0.15, r * 0.1, r * 0.15, Math.cos(a) * rr, h + r * flat * (i === 4 ? 1.22 : 0.52), Math.sin(a) * rr)); }
  return g;
}

/**
 * toadstool_ring: a ring of red toadstools has come up overnight in the yard,
 * perfectly round, with the grass a darker green inside it. Small lights rise
 * from the middle. After dark the whole ring glows.
 */
export const toadstoolRing: Build = (s) => {
  const rnd = s.rnd;
  const d = s.doorSpot, df = d.face, doorU = s.lateral(df, s.door), side = doorU > 0.05 ? -1 : doorU < -0.05 ? 1 : rnd() < 0.5 ? 1 : -1;
  const c = s.yard(side * Math.min(s.lat(df) * 0.62 + 0.05, 0.75), 0.66), R = 0.34;
  const CAP = [mat(PAL.crimson), mat(mix(PAL.crimson, PAL.fire, 0.3))], STEM = mat(PAL.clothCream), GILL = mat(PAL.plasterWarm), DOT = mat(PAL.hairWhite);
  const N = 10;
  const groups: THREE.Group[] = [];
  for (let gI = 0; gI < 5; gI++) { const h = s.holder(c.x, 0, c.z); groups.push(bone(h)); }
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU + (rnd() - 0.5) * 0.12, big = i % 3 === 0 ? 1.3 : 0.75 + rnd() * 0.4;
    const m = shroom(0.075 * big + 0.02, 0.058 * big, CAP[i % 2], STEM, GILL, DOT);
    m.position.set(Math.cos(a) * R, 0, Math.sin(a) * R); m.rotation.set(Math.sin(a) * 0.16, rnd() * 3, -Math.cos(a) * 0.16);
    groups[i % 5].add(m);
  }
  const G = s.holder(c.x, 0, c.z);
  const turf = ring(mat(mix(PAL.pine, PAL.grassSummer, 0.35)), R, 0.055, 0, 0.003, 0, 0, 0, 0, 14); turf.scale.y = 0.02; G.add(turf);
  G.add(ball(mat(mix(PAL.pine, PAL.grassSummer, 0.6)), R * 0.9, 0.004, R * 0.9, 0, 0.002, 0));
  const lights = new Swarm(SHAPE.spark(), mat(mix(PAL.magic, 0xffffff, 0.4), { emissive: PAL.magic, emissiveIntensity: 1.6 }), 8, s.own);
  const waves = new Swarm(SHAPE.hoop(), mat(PAL.magic, { emissive: PAL.magic, emissiveIntensity: 1.2 }), 2, s.own);
  G.add(lights.mesh, waves.mesh);
  const poolM = glowMat(PAL.magic, 0.3, true); s.own.push(poolM);
  const pool = glowDisc(poolM, R * 1.7, c.x, 0.028, c.z); s.group.add(pool);

  return {
    update(f: Frame): void {
      const { env, t } = f;
      const k = presence(f, 0.6);
      for (let i = 0; i < 5; i++) { const b = 1 + 0.05 * Math.sin(t * 1.6 + i * 1.3); groups[i].scale.set(2 - b, b, 2 - b); }
      for (let i = 0; i < 8; i++) {
        const p = fract(t * 0.2 + i / 8), a = p * TAU * 1.4 + i * 2.1, rr = R * 0.7 * (1 - p * 0.7);
        const sc = 0.05 * Math.sin(p * Math.PI) * (0.6 + 0.4 * Math.sin(t * 4 + i)) * (0.75 + 0.5 * env.night);
        lights.put(i, Math.cos(a) * rr, 0.04 + p * 0.55, Math.sin(a) * rr, sc, sc, sc, 0, t + i, 0);
      }
      for (let i = 0; i < 2; i++) {
        const p = fract(t * 0.22 + i * 0.5), rr = 0.03 + p * R * 0.96;
        waves.put(i, 0, 0.012 - smooth(span(p, 0.8, 1)) * 0.02, 0, rr, rr * 0.25, rr);
      }
      lights.commit(); waves.commit();
      poolM.opacity = k * (0.1 + 0.45 * env.night) * (0.8 + 0.2 * Math.sin(t * 1.6));
    },
  };
};

/**
 * mushrooms: the damp has won. Clusters of brown caps along the foot of the
 * walls, brackets climbing the plaster like shelves, more on the roof where
 * the thatch holds water. They let go a breath of spores now and then, and
 * their gills are faintly luminous after dark.
 */
export const mushrooms: Build = (s) => {
  const rnd = s.rnd;
  const df = s.doorSpot.face, doorU = s.lateral(df, s.door), L = s.lat(df);
  const CAPS = [mat(mix(PAL.clothOchre, PAL.clothBrown, 0.45)), mat(PAL.daub), mat(mix(PAL.clothBrown, PAL.timber, 0.3)), mat(PAL.plasterWarm)];
  const STEM = mat(PAL.clothCream);
  const GILL = mat(mix(PAL.plasterWarm, PAL.ghost, 0.35), { emissive: PAL.ghost, emissiveIntensity: 0.12 }, true); s.own.push(GILL);
  const pulse: THREE.Group[] = [];
  const puffAt: THREE.Vector3[] = [];
  const cluster = (x: number, y: number, z: number, n: number, sz: number): void => {
    const b = bone(s.holder(x, y, z, rnd() * TAU)); pulse.push(b);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rnd(), r = i ? 0.05 + rnd() * 0.07 : 0, big = (i ? 0.5 + rnd() * 0.5 : 1) * sz;
      const m = shroom(0.05 * big + 0.02, 0.06 * big, CAPS[(i + n) % 4], STEM, GILL, null, i % 2 ? 0.4 : 0.6);
      m.position.set(Math.cos(a) * r * sz, 0, Math.sin(a) * r * sz); m.rotation.set(Math.sin(a) * 0.22, rnd() * 3, -Math.cos(a) * 0.22); b.add(m);
    }
    if (puffAt.length < 3) puffAt.push(V(x, y + 0.09 * sz, z));
  };
  // along the foot of the walls
  const c1 = s.out(df, clamp(doorU - (s.doorW / 2 + 0.24), -L, L), 0.07), c2 = s.out(df, clamp(doorU + (s.doorW / 2 + 0.34), -L, L), 0.06);
  cluster(c1.x, 0, c1.z, 5, 1.6); cluster(c2.x, 0, c2.z, 4, 1.3);
  for (const f of [(df + 1) % 4, (df + 3) % 4]) { const c = s.out(f, (rnd() - 0.5) * s.lat(f), 0.07); cluster(c.x, 0, c.z, 4, 1.4); }
  const cc = s.out(df, -L - 0.02, 0.02); cluster(cc.x, 0, cc.z, 3, 1.15);
  // on the roof
  for (const [v, u] of [[0.72, -0.6], [0.55, 0.5]]) { const r = slopeSpot(s, v, u); cluster(r.p.x, r.p.y - 0.01, r.p.z, 4, 1.25); }
  // brackets up the wall
  const shelf = (f: number, u: number, y0: number, n: number): void => {
    const w = s.wall(f, clamp(u, -s.lat(f) + 0.1, s.lat(f) - 0.1), y0 + 0.1), H = s.holder(w.p.x, 0, w.p.z, w.yaw), b = bone(H); pulse.push(b);
    for (let i = 0; i < n; i++) {
      const r = 0.11 - i * 0.014 + rnd() * 0.02, x = (i % 2 ? 0.06 : -0.05) + (rnd() - 0.5) * 0.03, y = y0 + i * 0.1;
      const c = cyl(CAPS[(i + 1) % 4], r * 0.5, r, 0.03, x, y, 0, 0, 0, 0, 7); c.scale.z = r * 0.62; b.add(c);
      const gl = cyl(GILL, r * 0.92, r * 0.92, 0.008, x, y - 0.018, 0, 0, 0, 0, 7); gl.scale.z = r * 0.58; b.add(gl);
    }
  };
  shelf(df, doorU + (s.doorW / 2 + 0.16), 0.2, 4);
  const fw = s.freeWall(0.12, [(df + 1) % 4, (df + 3) % 4]); shelf(fw.face, fw.u, 0.16, 5);
  const spores = new Swarm(SHAPE.oct(), mat(PAL.plasterWarm, { emissive: PAL.ghost, emissiveIntensity: 0.5 }), 12, s.own); s.group.add(spores.mesh);

  return {
    update(f: Frame): void {
      const { env, t } = f;
      const k = presence(f, 0.6);
      for (let i = 0; i < pulse.length; i++) { const b = 1 + 0.035 * Math.sin(t * 1.1 + i * 1.9) + 0.06 * beat(t, 5.2, 0.5, -i * 5.2 / 3); pulse[i].scale.set(b, 2 - b, b); }
      GILL.emissiveIntensity = 0.1 + 1.3 * env.night;
      for (let i = 0; i < 12; i++) {
        const src = puffAt[i % puffAt.length], p = clamp(((t + (i % puffAt.length) * 5.2 / 3) % 5.2) / 2.6 - 0.1);
        if (p <= 0 || p >= 1) { spores.hide(i); continue; }
        const a = i * 2.4, sc = 0.012 * (1 - p) * k;
        spores.put(i, src.x + Math.cos(a) * 0.1 * p + env.wind * 0.3 * p * p, src.y + 0.02 + (0.2 + (i % 3) * 0.07) * (1 - (1 - p) ** 2), src.z + Math.sin(a) * 0.1 * p, sc, sc, sc, p * 4, i, 0);
      }
      spores.commit();
    },
  };
};

// ───────────────────────── vines ─────────────────────────

/**
 * vines: something is growing up the house faster than it ought to. Stems
 * climb from the ground, feel their way round the door, go over the eave and
 * on up the roof, putting out leaves as they go and a few pale flowers. The
 * leaves stir in the wind. Cut back, it withers the way it came.
 */
export const vines: Build = (s) => {
  const rnd = s.rnd;
  const df = s.doorSpot.face, doorU = s.lateral(df, s.door), L = s.lat(df);
  interface Node { x: number; y: number; z: number; yaw: number; born: number; roof: boolean }
  const season = s.ctx.env.season;
  const GREENS = season === 'autumn' ? [PAL.leafAutumn, PAL.leafAutumn2, PAL.moss, PAL.clothOchre] : season === 'winter' ? [PAL.leafWinter, PAL.moss, PAL.thatchOld, PAL.pine] : [PAL.leafSummer, PAL.pine, PAL.moss, PAL.leafSpring];
  const starts: [number, number][] = [[df, -L + 0.07], [df, L - 0.07], [df, doorU + s.doorW / 2 + 0.1], [(df + 1) % 4, (rnd() - 0.5) * 0.5], [(df + 3) % 4, (rnd() - 0.5) * 0.5], [df, doorU - s.doorW / 2 - 0.16]];
  const stems: { a: Node; b: Node }[] = [];
  const leaves: { n: Node; rz: number; rx: number; len: number; wd: number; col: number; ph: number }[] = [];
  const flowers: Node[] = [];
  let latest = 0;
  starts.forEach(([f, u0], vi) => {
    let u = u0, prev: Node | null = null, k = 0;
    const lim = s.lat(f) - 0.04, yaw = s.yawOf(f);
    const push = (x: number, y: number, z: number, roof: boolean): void => {
      const n: Node = { x, y, z, yaw, born: vi * 0.28 + k * 0.1, roof }; latest = Math.max(latest, n.born);
      if (prev) {
        stems.push({ a: prev, b: n });
        const count = roof || k % 2 ? 3 : 2;
        for (let j = 0; j < count; j++) { const sgn = (j + k) % 2 ? 1 : -1; leaves.push({ n, rz: sgn * (0.5 + rnd() * 1.4), rx: roof ? 1.15 : 0.3 + rnd() * 0.3, len: 0.11 + rnd() * 0.06, wd: 0.095 + rnd() * 0.04, col: GREENS[Math.floor(rnd() * 4)], ph: rnd() * TAU }); }
        if (season !== 'winter' && k > 2 && rnd() < 0.3) flowers.push(n);
      }
      prev = n; k++;
    };
    const top = s.eave * 0.97;
    for (let y = 0.01; y < top; y += 0.085) {
      u = clamp(u + (rnd() - 0.5) * 0.1 + (f === df && Math.abs(u - doorU) < s.doorW / 2 + 0.09 ? Math.sign(u - doorU || 1) * 0.05 : 0), -lim, lim);
      const w = s.wall(f, u, Math.max(y, 0.06));
      push(w.p.x + w.n.x * 0.016, y, w.p.z + w.n.z * 0.016, false);
    }
    if (vi !== 2) {
      const e = s.eaveAt(f, u), n = s.normal(f);
      push(e.x + n.x * 0.01, e.y + 0.005, e.z + n.z * 0.01, true);
      const reach = 2 + Math.floor(rnd() * 3);
      for (let i = 1; i <= reach; i++) {
        u = clamp(u + (rnd() - 0.5) * 0.12, -lim, lim);
        const q = s.roofAt(e.x - n.x * (0.11 * i + 0.04), e.z - n.z * (0.11 * i + 0.04));
        if (q.n.y < 0.3) break;
        push(q.p.x + q.n.x * 0.014 + n.z * (rnd() - 0.5) * 0.06, q.p.y + q.n.y * 0.014, q.p.z + q.n.z * 0.014 - n.x * (rnd() - 0.5) * 0.06, true);
      }
    }
  });
  const stemSw = new Swarm(SHAPE.box(), mat(mix(PAL.pine, PAL.trunk, 0.45)), stems.length, s.own);
  const leafSw = new Swarm(SHAPE.leaf(), mat(0xffffff, { side: THREE.DoubleSide }), leaves.length, s.own); leafSw.order = 'YZX';
  const flSw = new Swarm(SHAPE.oct(), mat(0xffffff, { emissive: PAL.magic, emissiveIntensity: 0.25 }), Math.max(1, flowers.length), s.own);
  leaves.forEach((l, i) => leafSw.tint(i, l.col));
  flowers.forEach((_, i) => flSw.tint(i, i % 3 ? mix(PAL.magic, 0xffffff, 0.55) : PAL.clothCream));
  stemSw.mesh.castShadow = false; leafSw.mesh.receiveShadow = true;
  s.group.add(stemSw.mesh, leafSw.mesh, flSw.mesh);
  const EXIT = 1.0;

  return {
    exitDur: EXIT,
    update(f: Frame): void {
      const { env, t, age, out } = f;
      const clock = out >= 0 ? (1 - out) * (latest + 0.6) : age;
      const g = (n: Node): number => smooth((clock - n.born) / 0.4);
      if (out >= 0 || age < latest + 1.2) {
        for (let i = 0; i < stems.length; i++) {
          const { a, b } = stems[i], k = g(b);
          if (k <= 0) stemSw.hide(i);
          else stemSw.span(i, a.x, a.y, a.z, lerp(a.x, b.x, k), lerp(a.y, b.y, k), lerp(a.z, b.z, k), 0.02 - Math.min(0.008, b.born * 0.002));
        }
        stemSw.commit();
        for (let i = 0; i < flowers.length; i++) { const n = flowers[i], sc = 0.024 * smooth((clock - n.born - 0.5) / 0.4); flSw.put(i, n.x + Math.sin(n.yaw) * 0.02, n.y + 0.015, n.z + Math.cos(n.yaw) * 0.02, sc, sc, sc * 0.6, 0, n.yaw, 0.6); }
        if (!flowers.length) flSw.hide(0);
        flSw.commit();
      }
      const rustle = 0.05 + 0.2 * env.wind, droop = out >= 0 ? out * 0.9 : 0;
      for (let i = 0; i < leaves.length; i++) {
        const l = leaves[i], k = smooth((clock - l.n.born - 0.15) / 0.45);
        if (k <= 0) { leafSw.hide(i); continue; }
        leafSw.put(i, l.n.x, l.n.y, l.n.z, l.wd * k, l.len * k, 1, l.rx + Math.sin(t * 2.3 + l.ph) * rustle + droop, l.n.yaw, l.rz + Math.sin(t * 1.7 + l.ph * 2) * rustle * 0.6 + (l.rz > 0 ? droop : -droop));
      }
      leafSw.commit();
    },
  };
};

// ───────────────────────── gargoyle ─────────────────────────

/**
 * gargoyle: nobody asked for gargoyles. There are now three: one at each end
 * of the ridge and one over the door, looking down at whoever knocks. They do
 * not move while you watch them. They have moved since you last looked. Their
 * eyes show a little at night, in the rain the one over the door spouts, and
 * a pigeon has adopted the largest.
 */
export const gargoyle: Build = (s) => {
  const rnd = s.rnd;
  const STONE = mat(PAL.stone), STONE_D = mat(PAL.stoneDark), MOSS = mat(mix(PAL.stone, PAL.moss, 0.5)), FANG = mat(PAL.plasterGrey);
  const EYE = mat(PAL.warn, { emissive: PAL.warn, emissiveIntensity: 0.2 }, true); s.own.push(EYE);
  interface Garg { head: THREE.Group; yaw: number; pitch: number; ty: number; tp: number; next: number; down: number }
  const list: Garg[] = [];
  const fit = clamp(Math.max(s.w, s.h) / 2, 0.62, 1.1);       // a hovel gets smaller gargoyles; it still gets gargoyles
  const make = (x: number, y: number, z: number, yaw: number, sc: number, down: number): THREE.Group => {
    const H = s.holder(x, y, z, yaw);
    const g = grp(); g.scale.setScalar(sc * fit); H.add(g);
    g.add(
      box(STONE_D, 0.17, 0.045, 0.19, 0, 0.022, 0), box(STONE, 0.14, 0.02, 0.16, 0, 0.052, 0),
      ball(STONE, 0.075, 0.07, 0.085, 0, 0.125, -0.035), ball(STONE, 0.062, 0.075, 0.062, 0, 0.175, 0.03, 0.5), ball(MOSS, 0.04, 0.02, 0.04, -0.03, 0.2, -0.045),
    );
    for (const sx of [-1, 1]) {
      g.add(
        ball(STONE_D, 0.034, 0.05, 0.05, sx * 0.065, 0.105, 0.0), ball(STONE_D, 0.028, 0.02, 0.05, sx * 0.06, 0.075, 0.055),
        cyl(STONE_D, 0.018, 0.022, 0.12, sx * 0.04, 0.115, 0.075, 0.4, 0, 0, 5),
        aim(blade(STONE_D, 0.12, 0.25, 0.016, sx * 0.045, 0.19, -0.05), sx * 0.85, 1, -0.55), aim(blade(STONE, 0.07, 0.17, 0.02, sx * 0.05, 0.19, -0.045), sx * 0.5, 1, -0.75),
      );
      for (const c of [-0.014, 0.014]) g.add(aim(spike(STONE, 0.01, 0.035, sx * 0.04 + c, 0.066, 0.1, 0, 0, 0, 4), 0, -0.6, 1));
    }
    let tp: THREE.Object3D = g;
    for (let i = 0; i < 4; i++) { const tb = grp(i ? 0 : 0.03, i ? 0.05 : 0.09, i ? 0 : -0.11, i ? 0.55 : -1.7, 0, i ? 0.5 : 0.3); tb.add(cyl(STONE_D, 0.012 - i * 0.002, 0.016 - i * 0.002, 0.055, 0, 0.025, 0, 0, 0, 0, 5)); if (i === 3) tb.add(aim(blade(STONE_D, 0.04, 0.05, 0.012, 0, 0.05, 0), 0, 1, 0)); tp.add(tb); tp = tb; }
    const head = bone(g, 0, 0.245, 0.07); head.rotation.order = 'YXZ';
    head.add(
      ball(STONE, 0.055, 0.05, 0.055), box(STONE_D, 0.05, 0.03, 0.055, 0, -0.01, 0.05, 0.1), box(STONE_D, 0.042, 0.012, 0.05, 0, -0.04, 0.042, 0.35),
      box(STONE_D, 0.1, 0.016, 0.024, 0, 0.022, 0.042, 0.25), ball(EYE, 0.01, 0.009, 0.008, -0.024, 0.008, 0.05), ball(EYE, 0.01, 0.009, 0.008, 0.024, 0.008, 0.05),
      spike(FANG, 0.006, 0.016, -0.016, -0.03, 0.068, Math.PI, 0, 0, 3), spike(FANG, 0.006, 0.016, 0.016, -0.03, 0.068, Math.PI, 0, 0, 3),
    );
    for (const sx of [-1, 1]) head.add(aim(spike(STONE_D, 0.016, 0.075, sx * 0.03, 0.035, -0.012, 0, 0, 0, 4), sx * 0.55, 1, -0.35), aim(blade(STONE, 0.035, 0.07, 0.012, sx * 0.05, 0.0, -0.01), sx * 1, 0.25, -0.3));
    list.push({ head, yaw: 0, pitch: down, ty: 0, tp: down, next: 1 + rnd() * 5, down });
    return head;
  };
  const df = s.doorSpot.face, dn = s.doorSpot.n, doorU = s.lateral(df, s.door);
  let first: THREE.Group;
  if (!s.peaked && s.ridgeLen > 0.25) {
    const a = s.ridgeAt(s.ridgeLen), b = s.ridgeAt(-s.ridgeLen);
    first = make(a.x, a.y - 0.03, a.z, Math.atan2(s.ridge.x, s.ridge.z), 1.3, 0.2);
    make(b.x, b.y - 0.03, b.z, Math.atan2(-s.ridge.x, -s.ridge.z), 1.15, 0.2);
  } else {
    const a = s.eaveAt(df, s.lat(df) * 0.8), b = s.eaveAt(df, -s.lat(df) * 0.8);
    first = make(a.x - dn.x * 0.1, a.y, a.z - dn.z * 0.1, s.doorSpot.yaw + 0.4, 1.2, 0.35);
    make(b.x - dn.x * 0.1, b.y, b.z - dn.z * 0.1, s.doorSpot.yaw - 0.4, 1.1, 0.35);
  }
  const e = s.eaveAt(df, doorU);
  make(e.x - dn.x * 0.1, e.y - 0.01, e.z - dn.z * 0.1, s.doorSpot.yaw, 1.05, 0.75);
  // the pigeon
  const PG = mat(mix(PAL.slate, PAL.hairGrey, 0.5)), PG_D = mat(PAL.slateDark);
  const pig = bone(first, 0, 0.05, -0.005);
  pig.add(ball(PG, 0.024, 0.022, 0.034, 0, 0.022, 0), ball(PG_D, 0.014, 0.014, 0.014, 0, 0.045, 0.022), aim(spike(mat(PAL.gold), 0.004, 0.012, 0, 0.044, 0.034, 0, 0, 0, 3), 0, 0, 1), aim(blade(PG_D, 0.022, 0.04, 0.006, 0, 0.024, -0.03), 0, 0.15, -1), ball(mat(PAL.verdigris), 0.015, 0.008, 0.012, 0, 0.036, 0.018));
  const spout = new Swarm(SHAPE.flame(), mat(PAL.water, { rough: 0.2, emissive: PAL.waterDeep, emissiveIntensity: 0.35 }), 6, s.own); s.group.add(spout.mesh);
  const mouth = V(e.x + dn.x * 0.02, e.y + 0.22, e.z + dn.z * 0.02);

  return {
    update(f: Frame): void {
      const { env, t, dt } = f;
      EYE.emissiveIntensity = 0.15 + 2.2 * env.night * (0.8 + 0.2 * Math.sin(t * 1.3));
      for (let i = 0; i < list.length; i++) {
        const g = list[i];
        g.next -= dt;
        if (g.next <= 0) { g.ty = (rnd() - 0.5) * 1.5; g.tp = g.down + (rnd() - 0.5) * 0.3; g.next = 4 + rnd() * 7; }
        // stone turns slowly, and stops dead
        const dy = g.ty - g.yaw, st = Math.sign(dy) * Math.min(Math.abs(dy), 0.5 * dt); g.yaw += st;
        g.pitch += Math.sign(g.tp - g.pitch) * Math.min(Math.abs(g.tp - g.pitch), 0.3 * dt);
        g.head.rotation.set(g.pitch, g.yaw, 0);
      }
      const awake = 1 - smooth(span(env.night, 0.4, 0.7));
      pig.scale.set(1, 0.8 + 0.2 * awake, 1);
      pig.rotation.y = Math.floor(t / 2.7) * 2.1 + smooth(span((t % 2.7) / 2.7, 0.85, 1)) * 2.1;
      pig.position.y = 0.05 + awake * beat(t, 2.7, 0.3, 0.35) * 0.02;
      pig.rotation.x = awake * Math.max(0, Math.sin(t * 9)) * 0.25 * beat(t, 5.4, 1.6);
      const raining = wet(env.weather) ? presence(f, 0.6) : 0;
      for (let i = 0; i < 6; i++) {
        if (raining <= 0) { spout.hide(i); continue; }
        const p = fract(t * 1.3 + i / 6), sc = 0.014 * raining;
        spout.put(i, mouth.x + dn.x * 0.3 * p, mouth.y - 0.03 - (mouth.y - 0.04) * p * p, mouth.z + dn.z * 0.3 * p, sc, 0.05, sc);
      }
      spout.commit();
    },
  };
};
