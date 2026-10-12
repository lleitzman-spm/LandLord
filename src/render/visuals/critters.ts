/**
 * Livestock, vermin and visitors with wings: rats, chickens, sheep, bees, bats
 * and the stork. Chunky, like the figures: board-game animals that hop.
 */
import * as THREE from 'three';
import { PAL, mat, mix } from '../palette';
import {
  aim, ball, beat, blade, bone, box, bump, clamp, cyl, damp, gem, hash, lerp, noise, presence, quad, ring, smooth, span, spike, SHAPE, Swarm, TAU,
  type Build, type Frame, type LoopPt,
} from './kit';

// ───────────────────────── rats ─────────────────────────

/**
 * rats: five of them, doing laps of the house in single file, close to the
 * wall. Every few seconds one stops, sits up and sniffs, and is overtaken.
 * There is a new hole at the foot of the wall. Seen off, they scatter.
 */
export const rats: Build = (s) => {
  const rnd = s.rnd;
  const FUR = [mat(mix(PAL.stoneDark, PAL.clothBrown, 0.45)), mat(mix(PAL.stoneDark, PAL.ink, 0.4)), mat(mix(PAL.clothBrown, PAL.timber, 0.35))];
  const PINK = mat(mix(PAL.skinA, PAL.clothRed, 0.3)), INK = mat(PAL.ink);
  interface Rat { root: THREE.Group; body: THREE.Group; tail: THREE.Group; lane: number; off: number; v: number; cyc: number; sit: number; dist: number }
  const list: Rat[] = [];
  const N = 5;
  for (let i = 0; i < N; i++) {
    const root = bone(s.group); root.rotation.order = 'YXZ'; root.visible = false;
    const body = bone(root, 0, 0.012, -0.045);              // pivots at the haunches when it sits up
    const m = FUR[i % 3];
    body.add(
      ball(m, 0.05, 0.046, 0.08, 0, 0.04, 0.035),
      ball(m, 0.036, 0.034, 0.046, 0, 0.045, 0.112),
      aim(spike(m, 0.025, 0.058, 0, 0.04, 0.14, 0, 0, 0, 5), 0, -0.1, 1),
      ball(PINK, 0.0095, 0.0095, 0.0095, 0, 0.035, 0.197),
    );
    for (const sx of [-1, 1]) {
      body.add(
        ball(PINK, 0.021, 0.023, 0.008, sx * 0.028, 0.08, 0.1, 0, sx * 0.5, 0),
        ball(INK, 0.0075, 0.0075, 0.0075, sx * 0.021, 0.058, 0.143),
        ball(PINK, 0.012, 0.008, 0.02, sx * 0.036, 0.0, 0.1),
      );
      body.add(ball(PINK, 0.014, 0.009, 0.022, sx * 0.042, -0.003, 0.0));
    }
    const tail = bone(body, 0, 0.03, -0.035);
    tail.add(cyl(PINK, 0.0085, 0.006, 0.075, 0, 0.004, -0.036, Math.PI / 2, 0, 0, 4), cyl(PINK, 0.006, 0.003, 0.075, 0.012, 0.012, -0.105, Math.PI / 2 - 0.2, 0.35, 0, 4));
    const sc = 0.92 + (i % 3) * 0.1; body.scale.setScalar(sc);
    list.push({ root, body, tail, lane: 0.13 + (i % 3) * 0.075, off: i * 0.19 + rnd() * 0.05, v: 0.62 + rnd() * 0.16, cyc: 3.6 + rnd() * 2.2, sit: 0, dist: 0 });
  }
  // the way in
  const fw = s.freeWall(0.12);
  const H = s.holderOn(s.wall(fw.face, fw.u, 0.06), 0.012);
  H.add(ball(mat(PAL.soot), 0.062, 0.07, 0.006, 0, 0.0, 0), quad(mat(PAL.soot), 0.124, 0.06, 0, -0.03, 0.001));
  for (let i = 0; i < 6; i++) H.add(gem(mat(i % 2 ? PAL.plaster : PAL.daub), 0.012 + rnd() * 0.012, 0.008, 0.012 + rnd() * 0.01, (rnd() - 0.5) * 0.24, -0.052, 0.03 + rnd() * 0.1, 0, rnd() * 3, 0));
  const pt: LoopPt = { x: 0, z: 0, yaw: 0 };
  const dir = s.seed & 1 ? 1 : -1;

  return {
    exitDur: 1.1,
    update(f: Frame): void {
      const { t, dt, age, out } = f;
      const leaving = out >= 0;
      for (let i = 0; i < N; i++) {
        const r = list[i];
        const ph = (t + r.off * 11) % r.cyc, run = r.cyc - 1.15;
        const sitting = !leaving && ph > run;
        r.sit = damp(r.sit, sitting ? 1 : 0, 12, dt);
        r.dist += dt * r.v * (leaving ? 2.6 : 1 + 0.35 * f.env.night) * (1 - r.sit);
        const flee = leaving ? out * out * 2.2 : 0, rush = 1 - smooth(span(age, i * 0.12, 0.7 + i * 0.12));
        const lane = r.lane + flee + rush * 1.0;
        const u = dir * (r.dist / s.aroundLen(r.lane) + r.off);
        s.around(lane, u, pt);
        const k = presence(f, 0.3) * (age > i * 0.12 ? 1 : 0);
        r.root.visible = k > 0.01;
        if (!r.root.visible) continue;
        const stride = r.dist * 46 + i;
        r.root.position.set(pt.x, Math.abs(Math.sin(stride)) * 0.012 * (1 - r.sit), pt.z);
        r.root.rotation.set(0, pt.yaw + (dir < 0 ? Math.PI : 0) + (leaving ? dir * out * 1.1 : 0), 0);
        r.root.scale.setScalar(Math.max(0.001, k));
        r.body.rotation.x = -0.95 * r.sit + Math.sin(stride) * 0.07 * (1 - r.sit) + r.sit * Math.sin(t * 13 + i) * 0.04;
        r.body.rotation.y = r.sit * noise(t * 1.6 + i * 5, 3) * 0.5;
        r.tail.rotation.set(0.75 * r.sit, Math.sin(stride * 0.8) * 0.45 * (1 - r.sit) + r.sit * Math.sin(t * 2.4 + i) * 0.5, 0);
      }
    },
  };
};

// ───────────────────────── chickens ─────────────────────────

/**
 * chickens: three hens and a rooster with opinions, pecking about the yard.
 * They walk a few steps with their heads going, peck, look at you sideways,
 * and sometimes have a flap about nothing. One hen has chicks in tow.
 * Shooed, they leave at a run, wings out.
 */
export const chickens: Build = (s) => {
  const rnd = s.rnd;
  const df = s.doorSpot.face;
  const RED = mat(PAL.crimson), BEAK = mat(PAL.gold), INK = mat(PAL.ink), LEG = mat(PAL.goldDark);
  const coats: [number, number][] = [[PAL.hairWhite, PAL.clothCream], [mix(PAL.hairRed, PAL.clothBrown, 0.5), PAL.hairBrown], [PAL.plasterGrey, PAL.stoneDark], [mix(PAL.clothTeal, PAL.ink, 0.55), PAL.clothOchre]];
  interface Hen { root: THREE.Group; tilt: THREE.Group; wings: THREE.Group[]; x: number; z: number; tx: number; tz: number; yaw: number; st: number; tm: number; pecks: number; walk: number; side: number; sleep: number }
  const hens: Hen[] = [];
  const R = s.lat(df) + 0.3;
  const spot = (): [number, number] => { const p = s.out(df, (rnd() * 2 - 1) * R, 0.16 + rnd() * 0.72); return [p.x, p.z]; };
  for (let i = 0; i < 4; i++) {
    const cock = i === 3;
    const A = mat(coats[i][0]), B = mat(coats[i][1]);
    const root = bone(s.group); root.visible = false;
    const k = cock ? 1.16 : 0.94 + i * 0.05; root.scale.setScalar(k);
    for (const sx of [-1, 1]) root.add(cyl(LEG, 0.007, 0.007, 0.07, sx * 0.026, 0.035, 0, 0, 0, 0, 4), box(LEG, 0.026, 0.006, 0.04, sx * 0.026, 0.004, 0.01));
    const tilt = bone(root, 0, 0.085, 0);
    tilt.add(
      ball(A, 0.058, 0.055, 0.078, 0, 0.022, -0.005, -0.25),
      ball(A, 0.036, 0.05, 0.036, 0, 0.065, 0.058, 0.3),
      ball(A, 0.031, 0.031, 0.031, 0, 0.112, 0.07),
      aim(spike(BEAK, 0.012, 0.03, 0, 0.108, 0.097, 0, 0, 0, 4), 0, -0.15, 1),
      ball(RED, 0.01, 0.016, 0.01, 0, 0.088, 0.093),
      ball(INK, 0.006, 0.006, 0.006, -0.026, 0.118, 0.083), ball(INK, 0.006, 0.006, 0.006, 0.026, 0.118, 0.083),
    );
    for (let c = 0; c < 3; c++) tilt.add(spike(RED, 0.011, (cock ? 0.034 : 0.02) - c * 0.004, 0, 0.138, 0.085 - c * 0.02, -0.25 * c, 0, 0, 4));
    for (let c = 0; c < (cock ? 5 : 3); c++) {
      const a = (c - (cock ? 2 : 1)) * 0.3;
      tilt.add(aim(blade(c % 2 ? B : A, 0.04, cock ? 0.15 : 0.085, 0.008, 0, 0.045, -0.07), Math.sin(a) * 0.5, 1, -0.75 - (cock ? 0.35 : 0)));
    }
    const wings: THREE.Group[] = [];
    for (const sx of [-1, 1]) {
      const wb = bone(tilt, sx * 0.052, 0.045, 0.0);
      wb.add(ball(B, 0.014, 0.04, 0.06, sx * 0.004, -0.022, -0.012, -0.3));
      wings.push(wb);
    }
    const [x, z] = spot();
    hens.push({ root, tilt, wings, x, z, tx: x, tz: z, yaw: rnd() * TAU, st: 2, tm: 0.3 + rnd() * 1.5, pecks: 0, walk: 0, side: rnd() < 0.5 ? 1 : -1, sleep: 0 });
  }
  // grain, and the chicks
  const G = s.holder();
  for (let i = 0; i < 16; i++) { const p = s.out(df, (rnd() * 2 - 1) * R, 0.15 + rnd() * 0.75); G.add(gem(mat(PAL.field), 0.008, 0.004, 0.008, p.x, 0.004, p.z, 0, rnd() * 3, 0)); }
  const CH = 4;
  const chicks = new Swarm(SHAPE.ico(), mat(mix(PAL.gold, PAL.hairWhite, 0.35)), CH * 2, s.own); s.group.add(chicks.mesh);
  const cp = Array.from({ length: CH }, (_, i) => ({ x: hens[0].x, z: hens[0].z, ox: Math.sin(i * 2.3) * 0.13, oz: Math.cos(i * 1.7) * 0.11 - 0.04, mv: 0 }));
  const dn = s.doorSpot.n;

  return {
    exitDur: 1.3,
    update(f: Frame): void {
      const { t, dt, age, out } = f;
      const leaving = out >= 0, k = smooth(age / 0.35);
      for (let i = 0; i < 4; i++) {
        const h = hens[i];
        let peck = 0, flap = 0, hop = 0, speed = 0;
        const roost = !leaving && f.env.night > 0.6;
        if (roost) {                                         // heads down till morning
          if (h.st !== 2) { h.st = 2; h.tm = 0.4; }
          h.tm = Math.max(h.tm, 0.4);
        } else if (leaving) {
          if (h.st !== 9) { h.st = 9; const lat = (i - 1.5) * 0.9; h.tx = h.x + (dn.x + dn.z * lat) * 3; h.tz = h.z + (dn.z - dn.x * lat) * 3; }
          speed = 1.5; flap = 1;
        } else {
          h.tm -= dt;
          if (h.st === 0) {                                    // walking
            speed = 0.34;
            if (Math.hypot(h.tx - h.x, h.tz - h.z) < 0.03) { h.st = 1; h.pecks = 2 + Math.floor(rnd() * 3); h.tm = 0.34; }
          } else if (h.st === 1) {                             // pecking
            peck = Math.sin(clamp(1 - h.tm / 0.34) * Math.PI);
            if (h.tm <= 0) { h.pecks--; h.tm = 0.34; if (h.pecks <= 0) { h.st = 2; h.tm = 0.6 + rnd() * 1.6; h.side = -h.side; } }
          } else if (h.st === 2) {                             // a hard sideways look
            if (h.tm <= 0) { if (rnd() < 0.16) { h.st = 3; h.tm = 0.7; } else { h.st = 0;[h.tx, h.tz] = spot(); } }
          } else {                                             // a flap about nothing
            flap = 1; hop = bump(h.tm, 0, 0.7) * 0.05;
            if (h.tm <= 0) { h.st = 0;[h.tx, h.tz] = spot(); }
          }
        }
        const dx = h.tx - h.x, dz = h.tz - h.z, d = Math.hypot(dx, dz);
        if (speed > 0 && d > 1e-3) {
          const step = Math.min(d, speed * dt); h.x += (dx / d) * step; h.z += (dz / d) * step; h.walk += step;
          let dy = Math.atan2(dx, dz) - h.yaw; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU;
          h.yaw += dy * (1 - Math.exp(-10 * dt));
        }
        const stride = h.walk * 55;
        h.root.visible = k > 0.01;
        const gone = leaving ? 1 - smooth(span(out, 0.7, 1)) : 1;
        h.root.position.set(h.x, hop + (speed > 0 ? Math.abs(Math.sin(stride)) * (leaving ? 0.03 : 0.01) : 0), h.z);
        h.root.rotation.y = h.yaw;
        const base = i === 3 ? 1.16 : 0.94 + i * 0.05;
        h.root.scale.setScalar(Math.max(0.001, base * k * gone));
        h.sleep = damp(h.sleep, roost ? 1 : 0, 4, dt);
        h.tilt.rotation.set(peck * 1.0 + (leaving ? 0.25 : 0) + h.sleep * 0.35, h.st === 2 ? h.side * (0.5 + h.sleep * 1.6) * smooth(span(h.tm, 0, 0.3)) : 0, h.st === 2 ? h.side * 0.22 * (1 - h.sleep) : 0);
        h.tilt.position.set(0, 0.085 - h.sleep * 0.04 + h.sleep * Math.sin(t * 1.4 + i) * 0.003, speed > 0 ? Math.sin(stride) * 0.012 : 0);
        const fl = flap ? Math.sin(t * 34 + i) * 0.9 + 0.7 : 0;
        h.wings[0].rotation.z = -fl; h.wings[1].rotation.z = fl;
      }
      // chicks trail hen 0, a beat behind
      const m = hens[0];
      for (let i = 0; i < CH; i++) {
        const c = cp[i];
        const bx = m.x - Math.sin(m.yaw) * 0.13 + c.ox, bz = m.z - Math.cos(m.yaw) * 0.13 + c.oz;
        const px = c.x, pz = c.z;
        c.x = damp(c.x, bx, 2.2 + i * 0.5, dt); c.z = damp(c.z, bz, 2.2 + i * 0.5, dt);
        c.mv = damp(c.mv, clamp(Math.hypot(c.x - px, c.z - pz) / Math.max(dt, 1e-4) * 6), 8, dt);
        const y = Math.abs(Math.sin(t * 11 + i * 1.7)) * 0.014 * c.mv, sc = 0.024 * k * (age > 0.3 ? 1 : 0) * (leaving ? 1 - smooth(span(out, 0.6, 1)) : 1);
        const hy = Math.atan2(bx - c.x, bz - c.z);
        chicks.put(i * 2, c.x, 0.024 + y, c.z, sc, sc * 0.95, sc * 1.15);
        chicks.put(i * 2 + 1, c.x + Math.sin(hy) * 0.02, 0.05 + y - 0.012 * beat(t, 1.7 + i * 0.4, 0.3, i), c.z + Math.cos(hy) * 0.02, sc * 0.68);
      }
      chicks.commit();
    },
  };
};

// ───────────────────────── sheep ─────────────────────────

/**
 * sheep: three, grazing where they should not. Two have found the yard. The
 * third has found the roof and is working through the thatch. They graze,
 * look up mid-chew as if interrupted, shuffle on a hop or two, and graze again.
 */
export const sheep: Build = (s) => {
  const rnd = s.rnd;
  const df = s.doorSpot.face;
  const WOOL = mat(mix(PAL.hairWhite, PAL.clothCream, 0.5)), WOOL_D = mat(PAL.clothCream), FACE = mat(mix(PAL.ink, PAL.clothBrown, 0.25)), INK = mat(PAL.ink), EYE = mat(PAL.parchment);
  interface Ewe { root: THREE.Group; body: THREE.Group; head: THREE.Group; tail: THREE.Group; x: number; y: number; z: number; yaw: number; st: number; tm: number; hx: number; hz: number; fx: number; fz: number; look: number; roof: boolean; hp: number; hyaw: number; hops: number }
  const flock: Ewe[] = [];
  const onRoof = !s.peaked && s.ridgeLen > 0.2;
  for (let i = 0; i < 3; i++) {
    const root = bone(s.group); root.visible = false;
    const body = bone(root);
    const sc = [1, 0.86, 1.06][i];
    body.add(
      ball(WOOL, 0.1, 0.088, 0.135, 0, 0.165, 0),
      ball(WOOL_D, 0.07, 0.06, 0.07, 0.035, 0.215, -0.05), ball(WOOL, 0.07, 0.06, 0.075, -0.04, 0.21, 0.03), ball(WOOL_D, 0.075, 0.06, 0.07, 0.02, 0.2, 0.075),
      ball(WOOL, 0.07, 0.07, 0.06, 0, 0.15, -0.11),
    );
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) body.add(cyl(FACE, 0.017, 0.014, 0.1, sx * 0.05, 0.05, sz * 0.075, 0, 0, 0, 5));
    const tail = bone(body, 0, 0.18, -0.14); tail.add(ball(WOOL_D, 0.025, 0.035, 0.022, 0, -0.015, -0.012));
    const head = bone(body, 0, 0.205, 0.125); head.rotation.order = 'YXZ';
    head.add(
      ball(FACE, 0.042, 0.046, 0.058, 0, 0.0, 0.045, 0.35),
      ball(WOOL, 0.046, 0.034, 0.042, 0, 0.04, 0.012),
      ball(EYE, 0.011, 0.012, 0.008, -0.032, 0.014, 0.062), ball(EYE, 0.011, 0.012, 0.008, 0.032, 0.014, 0.062),
      ball(INK, 0.005, 0.007, 0.005, -0.036, 0.013, 0.067), ball(INK, 0.005, 0.007, 0.005, 0.036, 0.013, 0.067),
      aim(blade(FACE, 0.03, 0.06, 0.012, -0.036, 0.02, 0.015), -1, -0.25, -0.1), aim(blade(FACE, 0.03, 0.06, 0.012, 0.036, 0.02, 0.015), 1, -0.25, -0.1),
    );
    const roof = onRoof && i === 2;
    if (roof) for (const a of [-0.5, 0, 0.5]) head.add(aim(spike(mat(PAL.thatch), 0.006, 0.07, 0, -0.03, 0.095, 0, 0, 0, 3), Math.sin(a), -0.5, 0.8));
    let x: number, y = 0, z: number, yaw: number;
    if (roof) {
      const cs = s.chimney ? Math.sign((s.chimney.x - s.perch.x) * s.ridge.x + (s.chimney.z - s.perch.z) * s.ridge.z) : 0;
      const side = cs ? -cs : s.seed & 2 ? 1 : -1, p = s.ridgeAt(side * Math.min(s.ridgeLen * 0.6, 0.5));
      x = p.x; y = p.y - 0.035; z = p.z; yaw = Math.atan2(s.ridge.x * side, s.ridge.z * side) + 0.5;
    } else {
      const p = s.out(df, (i === 0 ? -1 : 1) * (0.25 + rnd() * (s.lat(df) - 0.1)), 0.3 + rnd() * 0.4);
      x = p.x; z = p.z; yaw = rnd() * TAU;
    }
    body.scale.setScalar(sc);
    flock.push({ root, body, head, tail, x, y, z, yaw, st: 0, tm: 1.5 + rnd() * 4, hx: x, hz: z, fx: x, fz: z, look: 0, roof, hp: 1, hyaw: 0, hops: 0 });
  }
  // what the yard sheep have done to the yard
  const G = s.holder();
  for (let i = 0; i < 7; i++) { const p = s.out(df, (rnd() * 2 - 1) * (s.lat(df) + 0.1), 0.2 + rnd() * 0.6); for (let j = 0; j < 3; j++) G.add(spike(mat(j === 1 ? PAL.leafSummer : PAL.grassSummer), 0.012, 0.03 + rnd() * 0.03, p.x + (j - 1) * 0.02, 0, p.z + (rnd() - 0.5) * 0.03, (rnd() - 0.5) * 0.5, 0, (rnd() - 0.5) * 0.5, 3)); }
  const dn = s.doorSpot.n;

  return {
    exitDur: 1.6,
    update(f: Frame): void {
      const { t, dt, out } = f;
      const leaving = out >= 0, k = smooth(f.age / 0.4);
      for (let i = 0; i < 3; i++) {
        const e = flock[i];
        let hop = 0, grazing = 0, lift = 0;
        e.tm -= dt;
        if (leaving) {
          const tau = out * 1.6;
          if (e.st !== 9) { e.st = 9; e.fx = e.x; e.fz = e.z; e.hops = e.y; }
          const lat = (i - 1) * 0.8, u = smooth(span(tau, e.roof ? 0.0 : 0.1 * i, 1.6));
          const yawT = Math.atan2(dn.x + dn.z * lat, dn.z - dn.x * lat);
          let dy = yawT - e.yaw; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU;
          e.yaw += dy * (1 - Math.exp(-9 * dt));
          e.x = e.fx + (dn.x + dn.z * lat) * 2.2 * u; e.z = e.fz + (dn.z - dn.x * lat) * 2.2 * u;
          const fall = e.roof ? smooth(span(tau, 0.05, 0.6)) : 1;
          e.y = e.hops * (1 - fall) + (e.roof ? bump(tau, 0, 0.6) * 0.25 : 0);
          hop = fall >= 1 ? Math.abs(Math.sin(u * 22)) * 0.06 : 0;
          lift = 1;
        } else if (e.st === 0) {                               // grazing (asleep on their feet at night)
          grazing = 1;
          if (e.tm <= 0 && f.env.night < 0.6) { e.st = 1; e.tm = 1.1 + rnd() * 0.9; e.look = (rnd() - 0.5) * 1.6; }
        } else if (e.st === 1) {                               // interrupted
          lift = 1;
          if (e.tm <= 0) {
            if (e.roof || rnd() < 0.35) { e.st = 0; e.tm = 3 + rnd() * 4; }
            else {
              e.st = 2; e.tm = 0.36; e.hops = 1 + Math.floor(rnd() * 2);
              let a = e.yaw + (rnd() - 0.5) * 1.6;
              const c = s.out(df, 0, 0.5);
              if (Math.hypot(e.x - c.x, e.z - c.z) > s.lat(df) + 0.15) a = Math.atan2(c.x - e.x, c.z - e.z) + (rnd() - 0.5) * 0.6;
              e.fx = e.x; e.fz = e.z; e.hx = e.x + Math.sin(a) * 0.13; e.hz = e.z + Math.cos(a) * 0.13; e.look = a;
            }
          }
        } else {                                               // a hop along
          const u = clamp(1 - e.tm / 0.36);
          let dy = e.look - e.yaw; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU;
          e.yaw += dy * (1 - Math.exp(-8 * dt));
          e.x = lerp(e.fx, e.hx, smooth(u)); e.z = lerp(e.fz, e.hz, smooth(u)); hop = Math.sin(u * Math.PI) * 0.045; lift = 0.5;
          if (e.tm <= 0) {
            if (--e.hops > 0) { e.tm = 0.36; e.fx = e.x; e.fz = e.z; e.hx = e.x + Math.sin(e.yaw) * 0.13; e.hz = e.z + Math.cos(e.yaw) * 0.13; }
            else { e.st = 0; e.tm = 3 + rnd() * 4.5; }
          }
        }
        e.root.visible = k > 0.01;
        const gone = leaving ? 1 - smooth(span(out, 0.75, 1)) : 1;
        e.root.position.set(e.x, e.y + hop, e.z); e.root.rotation.y = e.yaw;
        e.root.scale.setScalar(Math.max(0.001, k * gone));
        e.hp = damp(e.hp, grazing ? 1 : 0, 7, dt);
        e.hyaw = damp(e.hyaw, e.st === 1 ? clamp(e.look, -0.9, 0.9) : 0, 6, dt);
        const chew = Math.sin(t * 9 + i * 2) * (1 - smooth(span(f.env.night, 0.5, 0.7)));
        e.head.rotation.set(e.hp * (e.roof ? 1.25 : 1.05) + chew * 0.035 - 0.12 * lift * (1 - e.hp), e.hyaw, e.st === 1 ? 0.12 * Math.sin(t * 9 + i) : 0);
        e.head.position.y = 0.205 - e.hp * 0.05;
        e.body.rotation.x = hop * 2.2 - e.hp * 0.04;
        const br = 1 + 0.015 * Math.sin(t * 2 + i);
        e.body.scale.set([1, 0.86, 1.06][i] * br, [1, 0.86, 1.06][i] * (2 - br), [1, 0.86, 1.06][i]);
        e.tail.rotation.z = Math.sin(t * 14 + i) * 0.5 * beat(t, 4.1 + i, 0.9, i * 1.3);
      }
    },
  };
};

// ───────────────────────── bees ─────────────────────────

/**
 * bees: a hive has been built under the eave, and its owners hang in a loose
 * cloud by the door, with a steady traffic back and forth. At night they go
 * home. Driven off, the whole swarm lifts and streams away.
 */
export const bees: Build = (s) => {
  const rnd = s.rnd;
  const df = s.doorSpot.face, dn = s.doorSpot.n;
  const doorU = s.lateral(df, s.door), side = doorU > 0 ? -1 : 1;
  const e = s.eaveAt(df, side * (s.lat(df) - 0.09));
  const hx = e.x + dn.x * 0.07, hy = e.y - 0.02, hz = e.z + dn.z * 0.07;
  const H = s.holder(hx, hy, hz, s.doorSpot.yaw);
  const sway = bone(H);
  const COMB = [mat(mix(PAL.thatch, PAL.gold, 0.4)), mat(mix(PAL.thatch, PAL.clothBrown, 0.3))];
  const rows: [number, number][] = [[0.045, 0.0], [0.075, -0.045], [0.092, -0.1], [0.086, -0.158], [0.066, -0.208], [0.038, -0.248]];
  rows.forEach(([r, y], i) => sway.add(ball(COMB[i % 2], r, 0.036, r, 0, y, 0, 0, i * 0.7, 0)));
  sway.add(cyl(mat(PAL.timber), 0.012, 0.012, 0.05, 0, 0.03, 0, 0, 0, 0, 4), ball(mat(PAL.ink), 0.022, 0.026, 0.012, 0, -0.165, 0.082));
  const honey = mat(PAL.gold, { emissive: PAL.warn, emissiveIntensity: 0.5, rough: 0.3 });
  sway.add(aim(spike(honey, 0.012, 0.05, 0.03, -0.25, 0.01, 0, 0, 0, 4), 0, -1, 0), ball(honey, 0.014, 0.014, 0.014, 0.03, -0.305, 0.01));

  const N = 20;
  const sw = new Swarm(SHAPE.oct(), mat(0xffffff, { emissive: 0x332200, emissiveIntensity: 0.6 }), N * 2, s.own); s.group.add(sw.mesh);
  for (let i = 0; i < N; i++) { sw.tint(i * 2, PAL.gold); sw.tint(i * 2 + 1, PAL.ink); }
  // the cloud hangs in front of the door, at head height for a figure
  const c0 = s.yard(0, 0.42, 0.42);
  const P = Array.from({ length: N }, () => ({ a: 1.6 + rnd() * 2.4, b: 1.3 + rnd() * 2.6, c: 1.9 + rnd() * 2.2, p: rnd() * TAU, q: rnd() * TAU, r: 0.1 + rnd() * 0.2, trip: rnd() }));
  let home = 0;

  return {
    exitDur: 1.5,
    update(f: Frame): void {
      const { env, t, dt, out } = f;
      const k = presence(f, 0.5), leaving = out >= 0;
      home = damp(home, env.night > 0.55 ? 1 : 0, 1.2, dt);
      const cx = c0.x + noise(t * 0.23, 1) * 0.35 * dn.z + noise(t * 0.19, 2) * 0.12 * dn.x;
      const cz = c0.z - noise(t * 0.23, 1) * 0.35 * dn.x + noise(t * 0.19, 2) * 0.12 * dn.z;
      const cy = c0.y + noise(t * 0.31, 3) * 0.1;
      const up = leaving ? out * out * 2.6 : 0;
      for (let i = 0; i < N; i++) {
        const b = P[i];
        // commuters go to the hive and back; the rest keep to the cloud
        let w = home;
        if (i % 4 === 0) { const ph = (t * 0.16 + b.trip) % 1; w = Math.max(w, smooth(span(ph, 0.0, 0.25)) * (1 - smooth(span(ph, 0.5, 0.75)))); }
        const R = b.r * (1 - 0.72 * w) * (1 + up * 0.8);
        const ox = Math.sin(t * b.a + b.p) * R, oy = Math.sin(t * b.b + b.q) * R * 0.75, oz = Math.cos(t * b.c + b.p * 2) * R;
        const x = lerp(cx, hx + dn.x * 0.1, w) + ox + up * (0.5 + 0.2 * Math.sin(i)), y = lerp(cy, hy - 0.17, w) + oy + up * 0.9, z = lerp(cz, hz + dn.z * 0.1, w) + oz;
        // heading from the orbit's velocity
        const vx = Math.cos(t * b.a + b.p) * b.a, vz = -Math.sin(t * b.c + b.p * 2) * b.c, ry = Math.atan2(vx, vz);
        const sc = 0.026 * k;
        sw.put(i * 2, x, y, z, sc * 0.8, sc * 0.8, sc * 1.2, 0, ry, 0);
        sw.put(i * 2 + 1, x - Math.sin(ry) * sc * 0.8, y, z - Math.cos(ry) * sc * 0.8, sc * 0.7, sc * 0.7, sc * 0.8, 0, ry, 0);
      }
      sw.commit();
      sway.rotation.set(Math.sin(t * 1.3) * 0.04 * (0.4 + env.wind), 0, Math.sin(t * 1.1 + 1) * 0.05 * (0.4 + env.wind));
    },
  };
};

// ───────────────────────── bats ─────────────────────────

/**
 * bats: a colony in the roof. Most of it is out, wheeling round the ridge in
 * untidy loops; a few hang under the eave by the door, wrapped up, swaying.
 * Smoked out, they scatter in every direction at once.
 */
export const bats: Build = (s) => {
  const rnd = s.rnd;
  const N = 9;
  const DARK = mat(mix(PAL.soot, PAL.clothPlum, 0.25)), WING = mat(mix(PAL.soot, PAL.clothPlum, 0.4), { side: THREE.DoubleSide });
  const bodies = new Swarm(SHAPE.oct(), DARK, N, s.own), wings = new Swarm(SHAPE.batwing(), WING, N * 2, s.own);
  wings.order = 'YXZ'; bodies.order = 'YXZ';
  s.group.add(bodies.mesh, wings.mesh);
  const c = s.perch.clone(); c.y = s.perch.y + 0.22;
  const R0 = Math.max(s.ext[0], s.ext[1]) * 0.75 + 0.2;
  const P = Array.from({ length: N }, (_, i) => ({ r: R0 * (0.55 + rnd() * 0.75), w: (0.9 + rnd() * 0.8) * (i % 3 === 0 ? -1 : 1), p: rnd() * TAU, h: rnd() * 0.5, e: 0.2 + rnd() * 0.5, fl: 13 + rnd() * 6 }));
  const pos = (i: number, t: number, o: THREE.Vector3): THREE.Vector3 => {
    const b = P[i], a = t * b.w + b.p;
    return o.set(c.x + Math.cos(a) * b.r * (1 + b.e * Math.sin(a * 2 + i)), c.y + b.h + Math.sin(a * 1.7 + i) * 0.22 + Math.sin(t * 2.3 + i * 4) * 0.05, c.z + Math.sin(a) * b.r * (1 - b.e * 0.5 * Math.cos(a * 3)));
  };
  // the ones that stayed in
  const df = s.doorSpot.face, dn = s.doorSpot.n;
  const hang: THREE.Group[] = [];
  const EYE = mat(PAL.warn, { emissive: PAL.warn, emissiveIntensity: 1.4 });
  for (let i = 0; i < 3; i++) {
    const p = s.eaveAt(df, (i - 1) * 0.16 + (s.seed % 5 - 2) * 0.08 + s.lat(df) * 0.45);
    const H = s.holder(p.x + dn.x * 0.03, p.y - 0.005, p.z + dn.z * 0.03, s.doorSpot.yaw);
    const b = bone(H);
    b.add(
      aim(spike(DARK, 0.03, 0.1, 0, 0, 0, 0, 0, 0, 5), 0, -1, 0), ball(DARK, 0.022, 0.022, 0.022, 0, -0.105, 0.004),
      aim(spike(DARK, 0.009, 0.03, -0.014, -0.115, 0, 0, 0, 0, 3), -0.3, -1, 0), aim(spike(DARK, 0.009, 0.03, 0.014, -0.115, 0, 0, 0, 0, 3), 0.3, -1, 0),
      aim(blade(WING, 0.045, 0.1, 0.006, -0.014, -0.005, 0.012), -0.12, -1, 0.1), aim(blade(WING, 0.045, 0.1, 0.006, 0.014, -0.005, 0.012), 0.12, -1, 0.1),
      ball(EYE, 0.0045, 0.0045, 0.0045, -0.009, -0.107, 0.022), ball(EYE, 0.0045, 0.0045, 0.0045, 0.009, -0.107, 0.022),
    );
    hang.push(b);
  }
  const a = new THREE.Vector3(), b2 = new THREE.Vector3();

  return {
    exitDur: 1.4,
    update(f: Frame): void {
      const { env, t, out } = f;
      const k = presence(f, 0.7), leaving = out >= 0;
      const tt = t * (0.85 + 0.3 * env.night);
      for (let i = 0; i < N; i++) {
        pos(i, tt, a); pos(i, tt + 0.06, b2);
        if (leaving) { const dx = a.x - c.x, dz = a.z - c.z, l = Math.hypot(dx, dz) || 1, g = out * out * 3.2; a.x += (dx / l) * g; a.z += (dz / l) * g; a.y += out * 0.9; b2.x += (dx / l) * g; b2.z += (dz / l) * g; }
        const ry = Math.atan2(b2.x - a.x, b2.z - a.z), bank = clamp((b2.y - a.y) * 6, -0.5, 0.5);
        const flap = Math.sin(t * P[i].fl + i * 2) * 0.85, sc = (0.115 + (i % 3) * 0.014) * k;
        const dip = -flap * 0.012;
        bodies.put(i, a.x, a.y + dip, a.z, sc * 0.2, sc * 0.2, sc * 0.42, -bank, ry, 0);
        // geometry has the wing along +x; the body flies along +z
        wings.put(i * 2, a.x, a.y + dip, a.z, sc, sc, sc, -bank, ry, flap);
        wings.put(i * 2 + 1, a.x, a.y + dip, a.z, -sc, sc, sc, -bank, ry, -flap);
      }
      bodies.commit(); wings.commit();
      for (let i = 0; i < 3; i++) hang[i].rotation.set(Math.sin(t * 1.4 + i * 2) * 0.1 * (0.5 + env.wind), 0, Math.sin(t * 1.1 + i) * 0.14 * (0.5 + env.wind) + beat(t, 6 + i * 2.3, 0.5, i) * Math.sin(t * 30) * 0.12);
    },
  };
};

// ───────────────────────── the stork ─────────────────────────

/**
 * stork_nest: a cartwheel of sticks on the chimney and a stork standing in it
 * on one leg. It looks down its bill at the street, preens, and from time to
 * time throws its head back and clatters. Two chicks put their heads up and
 * are fed nothing. Leaves on slow, enormous wingbeats.
 */
export const storkNest: Build = (s) => {
  const rnd = s.rnd;
  const at = s.stack();
  const STICK = [mat(PAL.trunk), mat(PAL.timberLight), mat(mix(PAL.thatchOld, PAL.trunk, 0.4))];
  const WHITE = mat(PAL.hairWhite), BLACK = mat(PAL.ink), RED = mat(mix(PAL.crimson, PAL.fire, 0.35)), GREY = mat(PAL.hairGrey);
  const H = s.holder(at.x, at.y - 0.01, at.z, s.doorSpot.yaw + (rnd() - 0.5) * 0.9);
  H.add(ring(STICK[0], 0.15, 0.04, 0, 0.035, 0, 0, 0, 0, 9), ball(STICK[2], 0.15, 0.03, 0.15, 0, 0.03, 0), ring(STICK[1], 0.175, 0.028, 0, 0.065, 0, 0, 0.4, 0, 9));
  for (let i = 0; i < 22; i++) {
    const a = rnd() * TAU, r = 0.13 + rnd() * 0.07;
    H.add(box(STICK[i % 3], 0.012, 0.012, 0.16 + rnd() * 0.12, Math.cos(a) * r, 0.03 + rnd() * 0.06, Math.sin(a) * r, (rnd() - 0.5) * 0.5, -a + (rnd() - 0.5) * 0.9, 0));
  }
  // chicks
  const chicks: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const cb = bone(H, sx * 0.065, 0.05, -0.05);
    cb.add(ball(GREY, 0.03, 0.03, 0.03, 0, 0.02, 0), cyl(GREY, 0.014, 0.02, 0.05, 0, -0.015, 0, 0, 0, 0, 5), aim(spike(BLACK, 0.01, 0.04, 0, 0.022, 0.022, 0, 0, 0, 4), 0, 0.5, 1), ball(BLACK, 0.005, 0.005, 0.005, -0.016, 0.03, 0.02), ball(BLACK, 0.005, 0.005, 0.005, 0.016, 0.03, 0.02));
    chicks.push(cb);
  }
  // the stork
  const F = bone(H, 0.01, 0.06, 0.035);                    // flight
  const leg = bone(F);
  leg.add(cyl(RED, 0.008, 0.008, 0.2, -0.018, 0.1, 0, 0, 0, 0, 4), box(RED, 0.03, 0.006, 0.045, -0.018, 0.004, 0.012));
  const B = bone(F, 0, 0.215, 0);
  B.add(
    ball(WHITE, 0.058, 0.055, 0.095, 0, 0.02, -0.005, -0.35),
    aim(blade(BLACK, 0.07, 0.13, 0.03, 0, 0.012, -0.05), 0, -0.35, -1),
    cyl(RED, 0.008, 0.008, 0.07, 0.02, -0.035, 0.0, 0.5, 0, 0, 4), cyl(RED, 0.007, 0.007, 0.07, 0.02, -0.04, 0.03, -1.2, 0, 0, 4),   // the tucked leg
  );
  const wingsB: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const wb = bone(B, sx * 0.05, 0.045, 0.01); wb.rotation.order = 'ZYX';
    wb.add(aim(blade(WHITE, 0.09, 0.2, 0.012, 0, 0, 0), sx * 0.08, -0.35, -1), aim(blade(BLACK, 0.075, 0.16, 0.014, sx * 0.005, -0.03, -0.085), sx * 0.08, -0.3, -1));
    wingsB.push(wb);
  }
  const N1 = bone(B, 0, 0.05, 0.07); N1.add(cyl(WHITE, 0.02, 0.03, 0.11, 0, 0.05, 0, 0, 0, 0, 5));
  const N2 = bone(N1, 0, 0.1, 0); N2.add(cyl(WHITE, 0.017, 0.02, 0.09, 0, 0.04, 0, 0, 0, 0, 5));
  const Hd = bone(N2, 0, 0.085, 0); Hd.rotation.order = 'YXZ';
  Hd.add(ball(WHITE, 0.03, 0.028, 0.034, 0, 0.005, 0.006), aim(spike(RED, 0.012, 0.12, 0, 0.004, 0.03, 0, 0, 0, 4), 0, -0.04, 1), ball(BLACK, 0.006, 0.006, 0.006, -0.024, 0.012, 0.02), ball(BLACK, 0.006, 0.006, 0.006, 0.024, 0.012, 0.02));
  const J = bone(Hd, 0, -0.004, 0.03); J.add(aim(spike(RED, 0.009, 0.105, 0, 0, 0, 0, 0, 0, 4), 0, -0.05, 1));

  let act = 0, actT = 0, actDur = 1, next = 2 + rnd() * 3, lookY = 0.4, lookT = 0, n1 = 0, n2 = 0, hp = 0, hy = 0, spread = 0;
  const veer = rnd() < 0.5 ? 1 : -1;
  const EXIT = 2.6;

  return {
    exitDur: EXIT,
    update(f: Frame): void {
      const { env, t, dt, out } = f;
      const leaving = out >= 0, tau = out * EXIT, asleep = env.night > 0.6 && !leaving;
      lookT -= dt; if (lookT <= 0) { lookY = (rnd() - 0.5) * 2.2; lookT = 1.5 + rnd() * 3; }
      if (!leaving && !asleep) {
        if (act === 0) { next -= dt; if (next <= 0) { const r = rnd(); act = r < 0.45 ? 1 : r < 0.75 ? 2 : 3; actDur = [0, 2.6, 2.8, 2.4][act]; actT = 0; } }
        else { actT += dt; if (actT >= actDur) { act = 0; next = 2.5 + rnd() * 4; } }
      } else act = 0;
      const k = act ? actT / actDur : 0, e = act ? smooth(span(k, 0, 0.2)) * (1 - smooth(span(k, 0.82, 1))) : 0;
      let t1 = 0.18, t2 = -0.3, thp = 0.3, thy = lookY, jaw = 0, sp = 0, rate = 5;
      if (act === 1) { t1 = lerp(t1, -0.75, e); t2 = lerp(t2, -0.95, e); thp = lerp(thp, -0.9, e); thy = 0; jaw = e * 0.3 * (0.5 + 0.5 * Math.sin(t * 38)); rate = 9; }   // the clatter
      else if (act === 2) { t1 = lerp(t1, 0.5, e); t2 = lerp(t2, 1.5, e); thp = lerp(thp, 1.3, e) + Math.sin(t * 15) * 0.08 * e; thy = lerp(thy, 0.5, e); rate = 7; }  // preen
      else if (act === 3) { sp = e; thp = 0.1; }                                                                                                   // stretch
      if (asleep) { t1 = 0.6; t2 = 1.6; thp = 1.2; thy = 2.2; rate = 2; }
      F.position.set(0.01, 0.06, 0.035); F.rotation.set(0, 0, 0); F.scale.setScalar(1);
      let flap = 0;
      if (leaving) {
        const u = smooth(span(tau, 0.35, EXIT));
        sp = smooth(span(tau, 0, 0.35)); flap = tau > 0.25 ? 1 : 0;
        t1 = 0.9; t2 = 0.3; thp = -0.9; thy = 0; rate = 8;
        F.position.set(0.01 + veer * 1.3 * u * u, 0.06 + 0.5 * u + 1.6 * u * u + bump(tau, 0.1, 0.5) * 0.1, 0.035 + 0.5 * u + 2.6 * u * u);
        F.rotation.set(0.5 * u, veer * 0.5 * u, 0);
        F.scale.setScalar(Math.max(0.001, 1 - smooth(span(u, 0.65, 1))));
        leg.rotation.x = -1.2 * smooth(span(tau, 0.4, 1));
      } else leg.rotation.x = 0;
      n1 = damp(n1, t1, rate, dt); n2 = damp(n2, t2, rate, dt); hp = damp(hp, thp, rate, dt); hy = damp(hy, thy, rate * 0.7, dt);
      N1.rotation.x = n1; N2.rotation.x = n2; Hd.rotation.set(hp - n1 - n2 + 0.1, hy, 0); J.rotation.x = jaw;
      spread = damp(spread, sp, 7, dt);
      const beatW = flap ? Math.sin(tau * 9.5) : Math.sin(t * 7) * 0.12 * spread;
      for (let i = 0; i < 2; i++) {
        const sx = i ? 1 : -1;
        wingsB[i].rotation.set(spread * 0.3, -sx * spread * 1.35, sx * (spread * 0.15 + beatW * 0.75 * spread));
      }
      B.position.y = 0.215 + Math.sin(t * 1.7) * 0.004 + (flap ? -beatW * 0.02 : 0);
      B.rotation.x = leaving ? 0.5 * smooth(span(tau, 0.3, 1)) : 0;
      B.rotation.z = Math.sin(t * 0.7) * 0.03 * (0.5 + env.wind);
      // the chicks come up when a parent clatters, and at intervals on principle
      for (let i = 0; i < 2; i++) {
        const up = leaving || asleep ? 0 : Math.max(act === 1 ? e : 0, beat(t, 7.3 + i * 2.9, 2.2, i * 3.1));
        chicks[i].position.y = 0.012 + up * 0.075;
        chicks[i].rotation.set(-0.5 * up + Math.sin(t * 16 + i * 2) * 0.12 * up, (i ? -0.5 : 0.5) + Math.sin(t * 2 + i) * 0.3, 0);
      }
    },
  };
};
