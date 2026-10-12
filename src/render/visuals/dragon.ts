/**
 * small_dragon: a cat-sized dragon asleep on the chimney, because it is warm.
 * Curled nose to tail, breathing, one eye opening now and then. It puffs smoke
 * rings, twitches the end of its tail like a cat that is not really asleep,
 * and occasionally hiccups a small flame and looks embarrassed.
 * Leaves in a tight spiral on wings that are slightly too small.
 */
import * as THREE from 'three';
import { PAL, mat, mix } from '../palette';
import {
  aim, ball, beat, blade, bone, box, bump, clamp, cyl, damp, grp, live, noise, ring, smooth, span, spike, SHAPE, TAU,
  type Build, type Frame,
} from './kit';

const EXIT = 2.2;

export const smallDragon: Build = (s) => {
  const rnd = s.rnd;
  const BODY = mat(mix(PAL.clothTeal, PAL.good, 0.35)), BODY_D = mat(mix(PAL.clothTeal, PAL.lapis, 0.35));
  const BELLY = mat(mix(PAL.clothOchre, PAL.clothCream, 0.45)), FIN = mat(PAL.crimson), HORN = mat(PAL.clothCream), INK = mat(PAL.ink);
  const at = s.stack();
  const onChimney = !!s.chimney;
  const H = s.holder(at.x, at.y - (onChimney ? 0 : 0.03), at.z, s.doorSpot.yaw + (rnd() - 0.5) * 0.8);
  const sizer = grp(); sizer.scale.setScalar(1.22); H.add(sizer);
  const F = bone(sizer);                               // lifts off on exit
  const C = bone(F);                                   // the curl: breathes

  const R = 0.105, A0 = -2.25, A1 = 1.95, N = 8;
  for (let i = 0; i < N; i++) {
    const k = i / (N - 1), a = A0 + (A1 - A0) * k;
    const fat = 0.036 + 0.03 * Math.sin(Math.min(1, k * 1.25) * Math.PI) + (k > 0.8 ? 0.006 : 0);
    const x = Math.sin(a) * R, z = Math.cos(a) * R;
    C.add(ball(i % 2 ? BODY : BODY_D, fat * 1.05, fat, fat * 1.25, x, fat * 0.92, z, 0, a + Math.PI / 2, 0));
    C.add(ball(BELLY, fat * 0.8, fat * 0.6, fat * 1.1, Math.sin(a) * (R - 0.018), fat * 0.55, Math.cos(a) * (R - 0.018), 0, a + Math.PI / 2, 0));
    if (i > 0 && i < N - 1) C.add(aim(spike(FIN, 0.012, 0.026, x * 1.06, fat * 1.8, z * 1.06, 0, 0, 0, 4), Math.sin(a) * 0.3, 1, Math.cos(a) * 0.3));
  }
  // haunch and a folded hind foot
  C.add(ball(BODY, 0.05, 0.045, 0.06, Math.sin(-1.2) * (R + 0.03), 0.045, Math.cos(-1.2) * (R + 0.03)), ball(BODY_D, 0.022, 0.014, 0.035, Math.sin(-0.75) * (R + 0.055), 0.016, Math.cos(-0.75) * (R + 0.055), 0, -0.75 + 1.3, 0));

  // head, resting on the rim at the end of the curl
  const AH = A1 + 0.42;
  const head = bone(C, Math.sin(AH) * (R + 0.03), 0.05, Math.cos(AH) * (R + 0.03)); head.rotation.order = 'YXZ';
  const headYaw = AH - 0.55;                           // chin over the edge, looking out
  head.add(
    ball(BODY, 0.058, 0.048, 0.06, 0, 0.008, 0), ball(BODY, 0.04, 0.03, 0.058, 0, -0.004, 0.07),
    ball(BELLY, 0.036, 0.018, 0.06, 0, -0.03, 0.05),
    ball(BODY_D, 0.011, 0.008, 0.011, -0.016, 0.02, 0.112), ball(BODY_D, 0.011, 0.008, 0.011, 0.016, 0.02, 0.112),
    box(BODY_D, 0.045, 0.014, 0.034, -0.036, 0.044, 0.026, 0.15, 0, 0.35), box(BODY_D, 0.045, 0.014, 0.034, 0.036, 0.044, 0.026, 0.15, 0, -0.35),
  );
  for (const sx of [-1, 1]) {
    head.add(
      aim(spike(HORN, 0.014, 0.085, sx * 0.03, 0.036, -0.03, 0, 0, 0, 4), sx * 0.4, 0.75, -1),
      aim(blade(FIN, 0.05, 0.07, 0.008, sx * 0.052, 0.0, -0.012), sx * 1, 0.3, -0.7),
      ball(BODY, 0.02, 0.014, 0.03, sx * 0.075, -0.04, 0.045),               // a forepaw tucked under the chin
    );
  }
  const eyes = bone(head, 0, 0.024, 0.032);
  const EYE = mat(PAL.gold, { emissive: PAL.warn, emissiveIntensity: 0.9 });
  eyes.add(ball(EYE, 0.014, 0.016, 0.016, -0.05, 0, 0), ball(EYE, 0.014, 0.016, 0.016, 0.05, 0, 0), ball(INK, 0.006, 0.014, 0.008, -0.061, 0, 0.004), ball(INK, 0.006, 0.014, 0.008, 0.061, 0, 0.004));
  const emberM = mat(PAL.fire, { emissive: PAL.fire, emissiveIntensity: 0.4 }, true); s.own.push(emberM);
  const ember = live(box(emberM, 0.04, 0.008, 0.012, 0, 0.022, 0.118)); head.add(ember);
  const flame = live(new THREE.Mesh(SHAPE.flame(), mat(PAL.fire, { emissive: PAL.fire, emissiveIntensity: 1.6 })));
  flame.rotation.x = Math.PI / 2 - 0.2; flame.position.set(0, -0.006, 0.12); flame.visible = false; head.add(flame);

  // little wings, folded along the back
  const AM = -0.35;
  const spine = grp(Math.sin(AM) * R, 0.085, Math.cos(AM) * R, 0, AM + Math.PI / 2, 0); C.add(spine);
  const wings: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const wb = bone(spine, sx * 0.03, 0, 0);
    wb.add(
      aim(cyl(BODY_D, 0.006, 0.009, 0.11, sx * 0.02, 0.045, -0.03, 0, 0, 0, 4), sx * 0.4, 0.8, -0.55),
      aim(blade(FIN, 0.075, 0.13, 0.006, sx * 0.01, 0.01, 0), sx * 0.45, 0.6, -0.85),
      aim(blade(mat(mix(PAL.crimson, PAL.warn, 0.4)), 0.06, 0.1, 0.007, sx * 0.012, 0.012, 0.005), sx * 0.7, 0.25, -0.9),
    );
    wings.push(wb);
  }

  // tail: off the back of the curl, over the edge and down, with a spade on the end
  const tail: THREE.Group[] = [];
  const psi = Math.atan2(-Math.cos(A0), Math.sin(A0));
  let tp: THREE.Object3D = C;
  for (let i = 0; i < 5; i++) {
    const tb = bone(tp, i === 0 ? Math.sin(A0) * R : 0, i === 0 ? 0.03 : 0.058, i === 0 ? Math.cos(A0) * R : 0);
    if (i === 0) { tb.rotation.order = 'YXZ'; tb.rotation.set(Math.PI / 2 - 0.25, psi + 0.5, 0); }
    tb.add(cyl(i % 2 ? BODY : BODY_D, 0.012 - i * 0.0016, 0.017 - i * 0.002, 0.066, 0, 0.03, 0, 0, 0, 0, 5));
    tail.push(tb); tp = tb;
  }
  tp.add(aim(blade(FIN, 0.055, 0.065, 0.01, 0, 0.055, 0), 0, 1, 0));

  // smoke rings
  const rings: { m: THREE.Mesh; mt: THREE.MeshStandardMaterial; age: number; ox: number; oy: number; oz: number; dx: number; dz: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const mt = mat(PAL.plasterGrey, { transparent: true, opacity: 0, rough: 1 }, true); s.own.push(mt);
    const m = live(ring(mt, 1, 0.24, 0, 0, 0, 0, 0, 0, 9)); m.visible = false; m.renderOrder = 3; H.add(m);
    rings.push({ m, mt, age: 99, ox: 0, oy: 0, oz: 0, dx: 0, dz: 0 });
  }
  const nose = new THREE.Vector3(), fwdV = new THREE.Vector3();
  let nextPuff = 1.2 + rnd(), ringI = 0, lid = 0.18, lidT = 3 + rnd() * 4, lidHold = 0, yawC = headYaw, hic = -1, nextHic = 7 + rnd() * 8, emberGlow = 0.4;

  const puff = (): void => {
    const r = rings[ringI++ % 3];
    head.updateWorldMatrix(true, false);
    nose.set(0, 0.022, 0.13); head.localToWorld(nose); H.worldToLocal(nose);
    fwdV.set(0, 0.022, 0.33); head.localToWorld(fwdV); H.worldToLocal(fwdV).sub(nose);
    r.age = 0; r.ox = nose.x; r.oy = nose.y; r.oz = nose.z;
    const l = Math.hypot(fwdV.x, fwdV.z) || 1; r.dx = fwdV.x / l; r.dz = fwdV.z / l;
    r.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(r.dx * 0.55, 0.83, r.dz * 0.55).normalize());
  };

  return {
    exitDur: EXIT,
    update(f: Frame): void {
      const { env, t, dt, out, age } = f;
      const leaving = out >= 0, tau = out * EXIT;
      const breath = Math.sin(t * 1.5);
      C.scale.set(1 + breath * 0.02, 1 + breath * 0.055, 1 + breath * 0.02);
      for (let i = 0; i < 2; i++) wings[i].rotation.set(0.06 * breath + 0.5 * beat(t, 13, 1.6, 4) + (leaving ? 0.3 : 0), 0, (i ? -1 : 1) * (leaving ? -0.5 + Math.sin(tau * 38) * 0.9 : -0.1 * beat(t, 13, 1.6, 4)));

      // an eye opens; the head lifts a little to see who is looking
      lidT -= dt;
      if (lidT <= 0 && lidHold <= 0) { lidHold = 1.2 + rnd() * 1.6; lidT = 4 + rnd() * 7; }
      lidHold -= dt;
      const awake = lidHold > 0 || leaving || hic >= 0;
      lid = damp(lid, awake ? 1 : 0.16, awake ? 14 : 4, dt);
      eyes.scale.y = lid; eyes.scale.x = 1;
      yawC = damp(yawC, headYaw + (lidHold > 0 ? 0.35 * Math.sin(t * 1.3) : 0), 5, dt);

      // hiccup
      nextHic -= dt;
      if (nextHic <= 0 && !leaving) { hic = 0; nextHic = 9 + rnd() * 12; }
      let jerk = 0;
      if (hic >= 0) { hic += dt; jerk = bump(hic, 0, 0.3); flame.visible = hic < 0.4; flame.scale.set(0.03 + 0.02 * jerk, 0.16 * jerk + 0.01, 0.03 + 0.02 * jerk); if (hic > 1.3) hic = -1; } else flame.visible = false;
      head.rotation.set(-0.12 * (lid - 0.16) - 0.5 * jerk + 0.03 * breath, yawC, 0.1);
      head.position.y = 0.05 + 0.03 * (lid - 0.16) + 0.02 * jerk;

      // smoke rings on the out-breath
      nextPuff -= dt;
      if (nextPuff <= 0 && !leaving && age > 0.6) { puff(); nextPuff = 2.6 + rnd() * 1.8; emberGlow = 2.4; }
      if (leaving && tau > 0.3 && tau - dt * 1.01 <= 0.3) { puff(); emberGlow = 2.4; }
      emberGlow = damp(emberGlow, 0.35 + 0.25 * env.night, 2.5, dt);
      emberM.emissiveIntensity = emberGlow;
      for (const r of rings) {
        if (r.age > 3) { r.m.visible = false; continue; }
        r.age += dt;
        const a = r.age, travel = 0.42 * (1 - Math.exp(-1.5 * a));
        r.m.visible = true;
        r.m.position.set(r.ox + r.dx * travel * 0.6 + env.wind * 0.12 * a * a, r.oy + travel * 0.95 + 0.05 * a, r.oz + r.dz * travel * 0.6);
        r.m.scale.setScalar(0.022 + 0.075 * (1 - Math.exp(-1.3 * a)));
        r.mt.opacity = clamp(0.85 * (1 - a / 3)) * smooth(a * 6);
      }

      // tail: mostly still, then a flick at the tip
      const flick = beat(t, 3.4, 0.5) + beat(t, 7.9, 0.9, 2.2);
      for (let i = 1; i < 5; i++) {
        tail[i].rotation.x = 0.36 + (i === 1 ? 0.25 : 0) + 0.04 * Math.sin(t * 0.9 + i) - (leaving ? 0.3 : 0);
        tail[i].rotation.z = (i > 1 ? Math.sin(t * 15 - i * 0.9) * 0.4 * flick : 0) + noise(t * 0.5 + i, 3) * 0.08;
      }

      // leaving: up, round and away
      if (leaving) {
        const u = smooth(span(tau, 0.35, EXIT)), hop = bump(tau, 0.05, 0.4) * 0.06;
        F.position.set(Math.sin(u * 7) * 0.5 * u, hop + 2.4 * u * u + 0.25 * u, Math.cos(u * 7) * 0.5 * u - 0.0);
        F.rotation.y = u * 7;
        F.rotation.z = 0.3 * Math.sin(u * 7);
        F.scale.setScalar(Math.max(0.001, 1 - smooth(span(u, 0.6, 1))));
      }
    },
  };
};
