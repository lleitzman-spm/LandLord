/**
 * tax_cart: the Crown's cart, drawn up by the door for as long as it takes.
 * Crimson boards, a gold crown on the side, an iron-bound chest with the lid
 * not quite shut, a pennant, and a mule who has been to every door in the
 * realm and found them all the same. The mule nods off, snaps awake, flicks an
 * ear, sighs, and stamps. When the matter is settled it all trundles away.
 */
import * as THREE from 'three';
import { PAL, mat, mix } from '../palette';
import {
  aim, ball, beat, blade, bone, box, bump, Cloth, cyl, damp, grp, noise, ring, smooth, spike,
  type Build, type Frame,
} from './kit';
import { crownBadge, IRON, WOOD, WOOD_D } from './props';

const EXIT = 2.6;

export const taxCart: Build = (s) => {
  const rnd = s.rnd;
  const CRIM = mat(PAL.crimson), GOLD = mat(PAL.gold), INK = mat(PAL.ink);
  const MULE = mat(mix(PAL.clothBrown, PAL.stone, 0.45)), MULE_D = mat(mix(PAL.clothBrown, PAL.timber, 0.5)), MUZ = mat(PAL.clothCream);
  const coin = mat(PAL.gold, { emissive: PAL.goldDark, emissiveIntensity: 0.5 });

  // beside the door, along the wall, the mule pointing away from the door
  const f0 = s.doorSpot.face, dn = s.doorSpot.n;
  const doorU = s.lateral(f0, s.door);
  const side = doorU > 0.05 ? -1 : doorU < -0.05 ? 1 : (rnd() < 0.5 ? 1 : -1);
  const tx = dn.z * side, tz = -dn.x * side;
  const base = s.yard(side * (s.doorW * 0.5 + 0.42), 0.46);
  const H = s.holder(base.x, 0, base.z, Math.atan2(tx, tz));
  const roll = bone(H);                              // everything that drives away

  // ── the cart ──
  const cart = bone(roll, 0, 0, -0.12);
  cart.add(
    box(WOOD(), 0.34, 0.035, 0.48, 0, 0.165, 0), box(WOOD_D(), 0.34, 0.1, 0.022, 0, 0.232, 0.229), box(WOOD_D(), 0.34, 0.1, 0.022, 0, 0.232, -0.229),
    box(WOOD_D(), 0.03, 0.03, 0.4, 0, 0.135, 0),
    box(WOOD(), 0.018, 0.018, 0.5, -0.115, 0.168, 0.47), box(WOOD(), 0.018, 0.018, 0.5, 0.115, 0.168, 0.47),
    cyl(IRON(), 0.012, 0.012, 0.44, 0, 0.112, 0, 0, 0, Math.PI / 2, 5),
  );
  for (const sx of [-1, 1]) {
    cart.add(box(CRIM, 0.022, 0.105, 0.48, sx * 0.17, 0.235, 0), box(GOLD, 0.028, 0.014, 0.49, sx * 0.17, 0.292, 0));
    const badge = crownBadge(); badge.position.set(sx * 0.184, 0.225, 0); badge.rotation.y = sx * Math.PI / 2; cart.add(badge);
  }
  const wheels: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const wb = bone(cart, sx * 0.205, 0.112, 0);
    wb.add(cyl(WOOD_D(), 0.112, 0.112, 0.026, 0, 0, 0, 0, 0, Math.PI / 2, 10), cyl(IRON(), 0.03, 0.03, 0.05, 0, 0, 0, 0, 0, Math.PI / 2, 6));
    for (let k = 0; k < 4; k++) wb.add(box(WOOD(), 0.034, 0.2, 0.016, 0, 0, 0, (k * Math.PI) / 4, 0, 0));
    wheels.push(wb);
  }
  // the chest, the sacks, the takings
  cart.add(
    box(WOOD_D(), 0.2, 0.1, 0.15, 0, 0.232, -0.11), box(IRON(), 0.206, 0.014, 0.156, 0, 0.2, -0.11), box(IRON(), 0.03, 0.102, 0.156, -0.06, 0.232, -0.11), box(IRON(), 0.03, 0.102, 0.156, 0.06, 0.232, -0.11),
    box(IRON(), 0.03, 0.04, 0.012, 0, 0.262, -0.03),
    ball(MUZ, 0.07, 0.065, 0.06, -0.06, 0.24, 0.1), ball(MUZ, 0.06, 0.06, 0.055, 0.07, 0.235, 0.12), box(CRIM, 0.03, 0.014, 0.03, -0.06, 0.305, 0.1), box(CRIM, 0.03, 0.014, 0.03, 0.07, 0.295, 0.12),
  );
  for (let i = 0; i < 5; i++) cart.add(cyl(coin, 0.016, 0.016, 0.007, -0.07 + i * 0.035, 0.287 + (i % 2) * 0.004, -0.06 - (i % 3) * 0.02, 0.3 * (i % 2), i, 0.2, 7));
  const lid = bone(cart, 0, 0.282, -0.185);
  lid.add(box(WOOD_D(), 0.2, 0.03, 0.15, 0, 0.012, 0.075), box(IRON(), 0.03, 0.034, 0.156, -0.06, 0.012, 0.075), box(IRON(), 0.03, 0.034, 0.156, 0.06, 0.012, 0.075));
  // the pennant
  cart.add(cyl(WOOD(), 0.007, 0.009, 0.42, -0.155, 0.47, -0.215, 0, 0, 0, 5), ball(GOLD, 0.014, 0.014, 0.014, -0.155, 0.685, -0.215));
  const flag = new Cloth(0.2, 0.11, mat(0xffffff, { vertexColors: true, side: THREE.DoubleSide }), 'side', s.own, 5, 2, 0.45, (_u, v) => (v > 0.7 ? PAL.gold : PAL.crimson));
  flag.mesh.position.set(-0.155, 0.61, -0.215); flag.mesh.rotation.y = Math.PI / 2; cart.add(flag.mesh);

  // ── the mule ──
  const M = bone(roll, 0, 0, 0.52);
  const mb = bone(M, 0, 0.215, 0);
  mb.add(
    ball(MULE, 0.086, 0.088, 0.165, 0, 0, 0), ball(MUZ, 0.07, 0.05, 0.12, 0, -0.05, 0),
    box(CRIM, 0.185, 0.014, 0.13, 0, 0.082, -0.01), box(GOLD, 0.19, 0.016, 0.02, 0, 0.082, 0.05), box(GOLD, 0.19, 0.016, 0.02, 0, 0.082, -0.07),
    ring(mat(PAL.clothBrown), 0.07, 0.016, 0, 0.03, 0.115, 1.15, 0, 0, 8),
  );
  const legs: THREE.Group[] = [];
  for (const [lx, lz] of [[-0.05, 0.1], [0.05, 0.1], [-0.05, -0.1], [0.05, -0.1]]) {
    const lg = bone(M, lx, 0.17, lz);
    lg.add(cyl(MULE_D, 0.02, 0.017, 0.15, 0, -0.085, 0, 0, 0, 0, 5), cyl(INK, 0.021, 0.024, 0.026, 0, -0.157, 0, 0, 0, 0, 5));
    legs.push(lg);
  }
  const neck = bone(mb, 0, 0.035, 0.12);
  neck.add(cyl(MULE, 0.04, 0.058, 0.15, 0, 0.055, 0.035, 0.55, 0, 0, 6), box(mat(PAL.hairDark), 0.016, 0.03, 0.13, 0, 0.09, -0.005, 0.55));
  const head = bone(neck, 0, 0.12, 0.085);
  head.add(
    ball(MULE, 0.042, 0.042, 0.07, 0, 0, 0.03, 0.4), ball(MUZ, 0.032, 0.03, 0.036, 0, -0.03, 0.082),
    ball(INK, 0.006, 0.006, 0.006, -0.014, -0.028, 0.113), ball(INK, 0.006, 0.006, 0.006, 0.014, -0.028, 0.113),
    box(CRIM, 0.09, 0.012, 0.012, 0, 0.006, 0.055), box(CRIM, 0.012, 0.07, 0.012, -0.043, -0.01, 0.045), box(CRIM, 0.012, 0.07, 0.012, 0.043, -0.01, 0.045),
    aim(spike(mat(PAL.hairDark), 0.016, 0.04, 0, 0.035, 0.0, 0, 0, 0, 4), 0, 0.6, 1),
  );
  for (const sx of [-1, 1]) head.add(ball(INK, 0.011, 0.011, 0.011, sx * 0.036, 0.012, 0.03), box(MULE_D, 0.022, 0.012, 0.03, sx * 0.038, 0.022, 0.03, 0, 0, -sx * 0.5));   // heavy lids
  const ears: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const e = bone(head, sx * 0.026, 0.035, -0.015);
    e.add(blade(MULE_D, 0.04, 0.125, 0.014), blade(mat(PAL.skinB), 0.022, 0.085, 0.016, 0, 0.012, 0.002));
    ears.push(e);
  }
  const tail = bone(mb, 0, 0.03, -0.158);
  tail.add(cyl(MULE_D, 0.01, 0.014, 0.1, 0, -0.05, 0, 0, 0, 0, 4), aim(spike(mat(PAL.hairDark), 0.022, 0.09, 0, -0.09, 0, 0, 0, 0, 4), 0, -1, 0));

  let droop = 0, stamp = -1, nextStamp = 4 + rnd() * 6, ey0 = 0, ey1 = 0;

  return {
    exitDur: EXIT,
    update(f: Frame): void {
      const { env, t, dt, out } = f;
      const leaving = out >= 0;
      // nodding off: the head sinks for seven seconds, then jerks up as if nothing happened
      const cyc = (t % 8.5) / 8.5;
      const sink = leaving ? 0 : cyc < 0.82 ? smooth(cyc / 0.82) : 1 - smooth((cyc - 0.82) / 0.07);
      droop = damp(droop, Math.max(0, sink), 9, dt);
      const sigh = bump(cyc, 0.86, 1);
      neck.rotation.x = 0.1 + 0.5 * droop - 0.1 * sigh;
      head.rotation.set(0.25 + 0.35 * droop + 0.04 * Math.sin(t * 6) * (1 - droop), noise(t * 0.35, 4) * 0.35 * (1 - droop), 0.06 * Math.sin(t * 0.8));
      mb.scale.set(1 + 0.03 * sigh + 0.008 * Math.sin(t * 1.6), 1 + 0.05 * sigh + 0.012 * Math.sin(t * 1.6), 1);
      mb.rotation.z = noise(t * 0.25, 8) * 0.04;
      const fl0 = beat(t, 3.1, 0.22), fl1 = beat(t, 4.7, 0.22, 1.3);
      ey0 = 0.75 + 0.5 * droop - fl0 * 0.9; ey1 = -0.75 - 0.5 * droop + fl1 * 0.9;
      ears[0].rotation.set(-0.3, 0, ey0); ears[1].rotation.set(-0.3, 0, ey1);
      tail.rotation.set(0.15, 0, Math.sin(t * 5.5) * 0.7 * beat(t, 5.2, 1.3, 2) + 0.05 * Math.sin(t * 1.1));
      nextStamp -= dt; if (nextStamp <= 0 && !leaving) { stamp = 0; nextStamp = 6 + rnd() * 8; }
      let lift = 0; if (stamp >= 0) { stamp += dt; lift = bump(stamp, 0, 0.5); if (stamp > 0.5) stamp = -1; }
      legs[0].rotation.x = -0.9 * lift; legs[0].position.y = 0.17 + 0.03 * lift;
      lid.rotation.x = -0.32 + 0.03 * Math.sin(t * 1.3);
      flag.wave(t, 0.01 + 0.025 * env.wind, 6, 5 + 5 * env.wind);

      if (leaving) {
        const tau = out * EXIT, d = 2.3 * smooth(Math.min(1, tau / EXIT)) * (tau / EXIT);
        roll.position.z = d;
        for (const w of wheels) w.rotation.x = d / 0.112;
        for (let i = 0; i < 4; i++) legs[i].rotation.x = Math.sin(d * 16 + (i % 3 ? 0 : Math.PI)) * 0.5;
        M.position.y = Math.abs(Math.sin(d * 16)) * 0.012;
        cart.rotation.x = Math.sin(d * 9) * 0.02;
        roll.scale.setScalar(Math.max(0.001, 1 - smooth((tau / EXIT - 0.75) / 0.25)));
      }
    },
  };
};
