/**
 * griffin_roof: Gerald. "More of a large cat."
 *
 * He sits along the roof ridge like a cat on a fence: lion behind, eagle in
 * front, wings folded. He watches the street in quick bird-like glances,
 * tilts his head, blinks, preens, stretches his wings, shakes himself out,
 * yawns, and now and then leans down to nibble what is left of the
 * weathervane. At night he tucks his head under a wing and sleeps.
 * He arrives by landing and leaves by flying off, shedding a feather or two.
 */
import * as THREE from 'three';
import { PAL, mat, mix } from '../palette';
import {
  aim, ball, beat, blade, bone, feather, box, bump, clamp, cyl, damp, grp, lerp, live, noise, pyr, smooth, span, spike, TAU,
  type Build, type Frame,
} from './kit';

const FOLD_ROLL = 1.28, FOLD_PITCH = -0.3;
const ENTER = 1.05, EXIT = 3.0;
const FAN = [0, 0.3, 0.52, 0.71, 0.87, 1];

export const griffinRoof: Build = (s) => {
  const rnd = s.rnd;
  const LION = mat(mix(PAL.hairRed, PAL.thatch, 0.42)), LION_D = mat(mix(PAL.hairRed, PAL.timber, 0.45));
  const WHITE = mat(PAL.hairWhite), CREAM = mat(PAL.clothCream), BROW = mat(PAL.hairBrown), WING_C = mat(mix(PAL.hairBrown, PAL.thatch, 0.5));
  const GOLD = mat(PAL.gold), GOLD_D = mat(PAL.goldDark), INK = mat(PAL.ink), IRIS = mat(PAL.warn);
  const WING = mat(PAL.hairBrown), WING_D = mat(PAL.timber), WING_L = mat(mix(PAL.hairBrown, PAL.clothCream, 0.6));
  const IRON = mat(PAL.iron), BRASS = mat(PAL.brass);

  // where and which way: along the ridge, head turned to the street
  const side = rnd() < 0.5 ? 1 : -1;
  const fwd = s.ridge.clone().multiplyScalar(side);
  const yaw = Math.atan2(fwd.x, fwd.z);
  const gs = clamp(0.94 + 0.05 * Math.max(s.w, s.h), 1, 1.18);
  let home = s.doorSpot.yaw - yaw;
  while (home > Math.PI) home -= TAU; while (home < -Math.PI) home += TAU;
  home = clamp(home, -1.15, 1.15);

  const perch = s.perch.clone(); if (s.peaked) perch.y -= 0.05;
  const rel = (fz: number, fx: number, lim: number): number => {      // roof height under a point of his body, relative to the perch
    const x = perch.x + (fwd.x * fz + fwd.z * fx) * gs, z = perch.z + (fwd.z * fz - fwd.x * fx) * gs;
    return clamp((s.roofAt(x, z).p.y - perch.y) / gs, lim, 0.03);
  };
  const dropF = rel(0.18, 0, -0.15), dropR = rel(0.075, 0.15, -0.085), dropL = rel(0.075, -0.15, -0.085);

  const H = s.holderAt(perch, yaw);
  const sizer = grp(); sizer.scale.setScalar(gs); H.add(sizer);
  const F = bone(sizer);                    // flight: landing and leaving
  const B = bone(F);                        // body: breath, lean, shake

  // ── lion half and eagle chest ──
  B.add(
    ball(LION, 0.17, 0.15, 0.2, 0, 0.15, -0.14),
    ball(LION, 0.145, 0.2, 0.15, 0, 0.3, 0.02, 0.3),
    ball(CREAM, 0.125, 0.15, 0.11, 0, 0.35, 0.115),
  );
  for (const sx of [-1, 1]) {
    const dh = sx > 0 ? dropR : dropL;
    B.add(
      ball(LION, 0.082, 0.135, 0.145, sx * 0.145, 0.12 + dh * 0.5, -0.05),
      ball(LION, 0.056, 0.044, 0.09, sx * 0.15, 0.035 + dh, 0.075),
      ball(LION_D, 0.05, 0.03, 0.04, sx * 0.15, 0.026 + dh, 0.135),
      ball(LION, 0.065, 0.075, 0.08, sx * 0.115, 0.385, 0.02),
      cyl(CREAM, 0.052, 0.036, 0.2, sx * 0.085, 0.235, 0.165, 0.12),
      cyl(GOLD, 0.02, 0.023, 0.14 - dropF, sx * 0.085, 0.08 + dropF / 2, 0.18),
      aim(spike(GOLD, 0.014, 0.045, sx * 0.085, 0.02 + dropF, 0.172), 0, -0.2, -1),
    );
    for (const a of [-0.55, 0, 0.55]) {
      B.add(aim(spike(GOLD, 0.017, 0.078, sx * 0.085, 0.02 + dropF, 0.185), Math.sin(a), -0.1, Math.cos(a)));
      B.add(aim(spike(INK, 0.009, 0.03, sx * 0.085 + Math.sin(a) * 0.07, 0.016 + dropF, 0.185 + Math.cos(a) * 0.07), Math.sin(a), -1.1, Math.cos(a)));
    }
  }
  for (let i = 0; i < 9; i++) {             // the ruff where feathers give way to fur
    const a = (i / 9) * TAU;
    B.add(aim(spike(i % 2 ? WHITE : CREAM, 0.052, 0.115, Math.sin(a) * 0.066, 0.452, 0.112 + Math.cos(a) * 0.06), Math.sin(a) * 0.72, -0.8, Math.cos(a) * 0.72 + 0.12));
  }

  // ── head ──
  const N = bone(B, 0, 0.455, 0.125); N.rotation.order = 'YXZ';
  N.add(
    cyl(WHITE, 0.06, 0.078, 0.11, 0, 0.035, 0),
    ball(WHITE, 0.09, 0.086, 0.1, 0, 0.125, 0.02),
    aim(spike(GOLD, 0.047, 0.128, 0, 0.116, 0.092), 0, -0.3, 1),
    aim(spike(GOLD_D, 0.021, 0.052, 0, 0.09, 0.2), 0, -1, 0.12),
    ball(GOLD_D, 0.03, 0.02, 0.03, 0, 0.13, 0.105),
  );
  for (const sx of [-1, 1]) {
    N.add(
      box(BROW, 0.064, 0.015, 0.05, sx * 0.055, 0.166, 0.072, 0.3, sx * 0.25, sx * 0.48),   // the stern brow
      aim(spike(CREAM, 0.034, 0.075, sx * 0.074, 0.095, -0.005), sx * 0.6, -0.55, -0.6),
    );
  }
  for (const cx of [-0.028, 0.028]) N.add(aim(spike(CREAM, 0.026, 0.06, cx, 0.185, -0.055), cx * 3, 0.35, -1));
  const J = bone(N, 0, 0.097, 0.1);
  J.add(aim(spike(GOLD_D, 0.032, 0.088, 0, 0, 0), 0, -0.1, 1));
  const eyes: THREE.Group[] = [], ears: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const e = bone(N, sx * 0.064, 0.137, 0.076);
    e.add(ball(IRIS, 0.023, 0.023, 0.023), ball(INK, 0.0125, 0.0135, 0.0125, sx * 0.011, 0.001, 0.0135));
    eyes.push(e);
    const ear = bone(N, sx * 0.055, 0.195, -0.012, -0.35, 0, -sx * 0.42);
    ear.add(spike(WHITE, 0.03, 0.105), spike(LION, 0.018, 0.055, 0, 0.068, 0));
    ears.push(ear);
  }

  // ── wings: a fan of six feathers each, closed along the flank or opened wide ──
  const wings: { root: THREE.Group; f: THREE.Group[] }[] = [];
  for (const sx of [1, -1]) {
    const mirror = grp(); mirror.scale.x = sx; B.add(mirror);
    const root = bone(mirror, 0.138, 0.405, -0.01);
    const fs: THREE.Group[] = [];
    for (let i = 0; i < 6; i++) {
      const fb = bone(root, 0, i * 0.005, 0);
      const L = 0.17 + i * 0.05;
      fb.add(
        feather(i < 2 ? WING_D : WING, 0.15, L, 0.012, 0, 0, -0.02, -Math.PI / 2),
        feather(WING_L, 0.1, L * 0.34, 0.016, 0, 0, -0.02 - L * 0.69, -Math.PI / 2),
        feather(WING_C, 0.15, 0.13, 0.019, 0, 0, 0.02, -Math.PI / 2),
      );
      if (i === 5) fb.add(cyl(WING_C, 0.02, 0.034, 0.22, 0.05, 0.004, -0.09, Math.PI / 2), ball(WING_C, 0.05, 0.04, 0.06, 0.02, 0.004, 0.0));
      fs.push(fb);
    }
    wings.push({ root, f: fs });
  }
  const setWing = (wi: number, spread: number, roll: number, pitch: number, ruffle: number): void => {
    const wg = wings[wi]; wg.root.rotation.set(pitch, 0, roll);
    const fold = 1 - clamp(spread * 1.6);
    for (let i = 0; i < 6; i++) wg.f[i].rotation.y = -(-0.065 * i * fold + spread * FAN[i] * 1.8 + ruffle * (i & 1 ? 1 : -1));
  };

  // ── tail ──
  const tail: THREE.Group[] = [];
  let tp: THREE.Object3D = B;
  for (let i = 0; i < 5; i++) {
    const tb = bone(tp, 0, i === 0 ? 0.13 : 0.085, i === 0 ? -0.31 : 0);
    tb.add(cyl(LION, 0.019, 0.023, 0.096, 0, 0.042, 0));
    tail.push(tb); tp = tb;
  }
  tp.add(ball(LION_D, 0.042, 0.062, 0.042, 0, 0.12, 0), spike(LION_D, 0.032, 0.075, 0, 0.15, 0));

  // ── what is left of the weathervane, on the ridge in front of him ──
  const reach = (s.ridgeLen >= 0.3 ? 0.43 : 0.36) * gs;
  const vp = s.roofAt(perch.x + fwd.x * reach, perch.z + fwd.z * reach).p;
  if (vp.y < perch.y - 0.4) vp.y = perch.y - 0.4;
  const poleH = clamp(perch.y + 0.2 * gs - vp.y, 0.16, 0.62);
  const Hv = s.holder(vp.x, vp.y - 0.01, vp.z, yaw);
  Hv.add(
    cyl(IRON, 0.011, 0.014, poleH, 0, poleH / 2, 0), ball(IRON, 0.03, 0.022, 0.03, 0, 0.012, 0),
    box(IRON, 0.17, 0.01, 0.01, 0, poleH * 0.6, 0), box(IRON, 0.01, 0.01, 0.17, 0, poleH * 0.6, 0),
    ball(BRASS, 0.014, 0.014, 0.014, 0.09, poleH * 0.6, 0), ball(BRASS, 0.014, 0.014, 0.014, -0.09, poleH * 0.6, 0),
  );
  const VB = bone(Hv, 0, poleH, 0);
  VB.add(
    cyl(IRON, 0.01, 0.011, 0.13, 0, 0.065, 0),
    box(BRASS, 0.23, 0.013, 0.013, 0, 0.13, 0),
    aim(pyr(BRASS, 0.05, 0.065, 0.016, 0.115, 0.13, 0), 1, 0, 0),
    aim(blade(BRASS, 0.05, 0.06, 0.008, -0.1, 0.13, 0), -1, 0.45, 0), aim(blade(BRASS, 0.04, 0.045, 0.008, -0.1, 0.13, 0), -1, -0.6, 0),
    ball(BRASS, 0.04, 0.03, 0.012, 0.005, 0.168, 0), ball(BRASS, 0.018, 0.018, 0.011, 0.045, 0.2, 0),
    aim(spike(BRASS, 0.008, 0.022, 0.06, 0.2, 0), 1, -0.2, 0), spike(mat(PAL.crimson), 0.01, 0.022, 0.043, 0.214, 0),
    aim(blade(BRASS, 0.03, 0.065, 0.008, -0.025, 0.175, 0), -0.75, 0.7, 0), aim(blade(BRASS, 0.026, 0.05, 0.008, -0.03, 0.17, 0), -1, 0.2, 0),
  );

  // ── feathers he leaves behind ──
  const drop = bone(s.group, perch.x, perch.y, perch.z);
  const loose: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) { const fm = live(blade(i === 1 ? WING_L : WING, 0.05, 0.16, 0.006)); fm.visible = false; drop.add(fm); loose.push(fm); }

  // ── state ──
  let act = 0, actT = 0, actDur = 1, nextAct = 1.6 + rnd() * 2.5, preenSide = rnd() < 0.5 ? 1 : -1;
  let hy = home, hp = 0.3, hr = 0, ly = home, lp = 0, lr = 0, lookT = 0.4;
  let blinkT = 1 + rnd() * 2, blink = 0;
  let wsL = 1, wsR = 1, wRoll = 0.6, wPitch = 0;
  const veer = side * (rnd() < 0.5 ? 1 : -1);

  return {
    exitDur: EXIT,
    update(f: Frame): void {
      const { env, t, dt, age, out } = f;
      const leaving = out >= 0, tau = out * EXIT;
      const landing = !leaving && age < ENTER;
      const asleep = env.night > 0.6 && !leaving && !landing;

      // idle glances: hold, then snap somewhere new, the way birds do
      lookT -= dt;
      if (lookT <= 0) {
        ly = clamp(home + (rnd() - 0.5) * 2.3, -1.5, 1.5); lp = (rnd() - 0.45) * 0.5; lr = rnd() < 0.3 ? (rnd() < 0.5 ? 0.38 : -0.38) : 0;
        lookT = 0.7 + rnd() * 2.6;
      }
      if (!leaving && !landing && !asleep) {
        if (act === 0) {
          nextAct -= dt;
          if (nextAct <= 0) {
            const r = rnd();
            act = r < 0.28 ? 1 : r < 0.52 ? 2 : r < 0.78 ? 3 : r < 0.9 ? 4 : 5;
            actDur = [0, 3.6, 3.4, 3.2, 1.0, 1.9][act]; actT = 0; preenSide = -preenSide;
          }
        } else { actT += dt; if (actT >= actDur) { act = 0; nextAct = 2.2 + rnd() * 4; } }
      } else if (act !== 0 && (leaving || asleep)) act = 0;

      let ty = ly, tpch = lp, tr = lr, rate = 15;
      let sL = 0.03, sR = 0.03, roll = FOLD_ROLL, pitch = FOLD_PITCH, wRate = 8;
      let jaw = 0, lean = 0, rise = 0, shake = 0, lid = 1, vane = 0, reachZ = 0, tailUp = 0, puff = 0;
      const k = act ? actT / actDur : 0;
      const env01 = act ? smooth(span(k, 0, 0.18)) * (1 - smooth(span(k, 0.84, 1))) : 0;
      if (act === 1) {                        // preen
        ty = preenSide * 2.35; tpch = 0.7 + 0.1 * Math.sin(t * 17) * env01; tr = preenSide * 0.2; rate = 7;
        if (preenSide > 0) sR = 0.3 * env01; else sL = 0.3 * env01;
        jaw = 0.22 * Math.abs(Math.sin(t * 17)) * env01;
      } else if (act === 2) {                 // the stretch
        const flap = bump(k, 0.36, 0.76) > 0 ? Math.sin(span(k, 0.36, 0.76) * TAU * 2) : 0;
        sL = sR = env01; roll = lerp(FOLD_ROLL, 0.4 - flap * 0.36 + noise(t * 9, 3) * 0.03, env01); pitch = lerp(FOLD_PITCH, 0.1, env01);
        rise = 0.035 * env01; tpch = -0.38 * env01; ty = lerp(ly, 0, env01); tr = 0; rate = 6; tailUp = env01; puff = env01; wRate = 10;
      } else if (act === 3) {                 // the weathervane
        ty = 0; tpch = 0.92 * env01 + 0.06 * Math.sin(t * 15) * env01; tr = 0.15 * Math.sin(t * 2.2) * env01; rate = 7;
        lean = 0.17 * env01; reachZ = 0.035 * env01;
        jaw = 0.4 * Math.abs(Math.sin(t * 15)) * env01; vane = Math.sin(t * 15 + 0.6) * 0.1 * env01;
      } else if (act === 4) {                 // shake it all out
        shake = Math.sin(t * 40) * 0.085 * env01; tr = Math.sin(t * 40 + 1) * 0.3 * env01; sL = sR = 0.22 * env01; puff = env01; lid = 1 - env01;
      } else if (act === 5) {                 // yawn
        tpch = -0.5 * env01; jaw = 0.85 * env01; lid = 1 - env01; rate = 6; tr = 0.12 * env01;
      }
      if (asleep) {
        ty = preenSide * 2.5; tpch = 0.95; tr = preenSide * 0.25; rate = 3; lid = 0;
        if (preenSide > 0) sR = 0.14; else sL = 0.14;
      }

      // landing and leaving
      F.position.set(0, 0, 0); F.rotation.set(0, 0, 0); F.scale.setScalar(1);
      let crouch = 0, fly = 0, tailCurl = 0.42;
      if (landing) {
        const kk = age / ENTER, e = 1 - (1 - kk) * (1 - kk) * (1 - kk);
        F.position.set(veer * 0.5 * (1 - e), 1.5 * (1 - e), -1.2 * (1 - e));
        F.rotation.x = -0.42 * (1 - e);
        sL = sR = 1; roll = 0.55 + 0.6 * Math.sin(age * 17); pitch = 0.05; wRate = 60; tpch = 0.45; ty = 0; fly = 1 - e;
      } else if (!leaving && age < ENTER + 0.3) {
        F.scale.y = 1 - 0.17 * bump(age, ENTER, ENTER + 0.3);
      }
      if (leaving) {
        lid = 1;
        if (tau < 0.45) {
          const kk = smooth(tau / 0.45);
          crouch = -0.05 * kk; sL = sR = 0.75 * kk; roll = 1.05; pitch = -0.1; ty = 0; tpch = -0.45 * kk; rate = 10; wRate = 14;
          F.scale.y = 1 - 0.1 * kk;
        } else {
          const u = (tau - 0.45) / (EXIT - 0.45), flap = Math.sin((tau - 0.45) * 12.5);
          F.position.set(veer * 1.4 * u * u, 2.2 * u * (0.55 + 0.45 * u) + 0.3 * Math.sin(Math.min(1, u * 3) * Math.PI * 0.5) - 0.05 * flap, 0.3 * u + 3.1 * u * u);
          F.rotation.set(-0.45 + 1.1 * smooth(span(u, 0, 0.3)), veer * 0.55 * u, -veer * 0.2 * u);
          sL = sR = 1; roll = 0.32 + 0.82 * flap; pitch = 0.06; wRate = 80; ty = 0; tpch = -0.55; rate = 10;
          F.scale.setScalar(Math.max(0.001, 1 - smooth(span(u, 0.62, 1))));
          fly = 1; tailCurl = 0.1;
        }
        for (let i = 0; i < 3; i++) {
          const a = tau - 0.55 - i * 0.16, fm = loose[i];
          fm.visible = a > 0 && a < 2.3;
          if (fm.visible) {
            const sw = Math.sin(a * 3.1 + i * 2.1);
            fm.position.set(sw * 0.15 + (i - 1) * 0.1, 0.42 + i * 0.08 - 0.3 * a - 0.03 * Math.abs(sw), Math.cos(a * 2 + i) * 0.1);
            fm.rotation.set(Math.PI / 2 + sw * 0.3, i * 1.3 + a, sw * 0.9);
            fm.scale.set(0.05, 0.16 * (1 - span(a, 1.8, 2.3)), 0.006);
          }
        }
      }

      // head
      hy = damp(hy, ty, rate, dt); hp = damp(hp, tpch, rate, dt); hr = damp(hr, tr, rate * 0.8, dt);
      N.rotation.set(hp, hy, hr); N.position.z = 0.125 + reachZ;
      J.rotation.x = jaw;
      blinkT -= dt; if (blinkT <= 0) { blink = 0.15; blinkT = rnd() < 0.2 ? 0.3 : 1.6 + rnd() * 3.6; }
      blink -= dt;
      const lidNow = blink > 0 ? 0.1 : Math.max(0.1, lid);
      eyes[0].scale.y = eyes[1].scale.y = lidNow;
      const flick = beat(t, 3.7, 0.2), flick2 = beat(t, 5.3, 0.2, 1.9);
      ears[0].rotation.z = 0.42 + flick * 0.4; ears[1].rotation.z = -0.42 - flick2 * 0.4;
      ears[0].rotation.x = ears[1].rotation.x = -0.35 - 0.3 * fly;

      // body
      const br = asleep ? 0.03 * Math.sin(t * 1.25) : 0.016 * Math.sin(t * 2.2);
      B.position.y = rise + crouch;
      B.rotation.set(lean, 0, shake + noise(t * 0.4, 5) * 0.015);
      B.scale.set(1 + br * 0.5 + puff * 0.03, 1 + br, 1 + br * 0.5 + puff * 0.03);

      // wings
      wsL = damp(wsL, sL, wRate, dt); wsR = damp(wsR, sR, wRate, dt); wRoll = damp(wRoll, roll, wRate, dt); wPitch = damp(wPitch, pitch, wRate, dt);
      const ruf = (0.012 + 0.03 * env.wind) * noise(t * 5, 9) + shake * 0.5;
      setWing(0, wsR, wRoll, wPitch, ruf); setWing(1, wsL, wRoll, wPitch, -ruf);

      // tail: a lazy swish, a flick at the tip
      const sw = 0.2 + 0.2 * tailUp + 0.1 * env.wind, tipFlick = beat(t, 4.3, 0.4) * Math.sin(t * 26) * 0.5;
      tail[0].rotation.set(-1.25 + 0.35 * tailUp - 0.2 * fly, 0, Math.sin(t * 1.7) * 0.2);
      for (let i = 1; i < 5; i++) {
        tail[i].rotation.x = tailCurl + 0.06 * Math.sin(t * 1.3 - i);
        tail[i].rotation.z = Math.sin(t * 1.7 - i * 0.75) * sw + (i > 2 ? tipFlick : 0);
      }

      // the vane leans his way and shudders when chewed
      VB.rotation.set(-1.0 + vane, 0.25 + noise(t * 0.7, 2) * 0.08 * env.wind, vane * 0.6);
    },
  };
};
