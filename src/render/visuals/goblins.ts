/**
 * goblins_windows: a hovel that has acquired goblins.
 * Heads pop out of the windows, round the door and over the roof ridge, look
 * left and right, and duck back in. They have hung curtains. The curtains are
 * someone else's laundry. There is a flag. When moved on they file out of the
 * door at a run, the last one carrying the flag.
 */
import * as THREE from 'three';
import { PAL, mat } from '../palette';
import {
  bone, box, clamp, Cloth, cyl, damp, lerp, noise, outBack, smooth, span, ball, grp,
  type Build, type Frame,
} from './kit';
import { garment, goblin, type GarmentKind, type Goblin, ROPE } from './props';

interface Slot {
  g: Goblin; hx: number; hy: number; hz: number; sx: number; sy: number; sz: number; tilt: number;
  st: 0 | 1 | 2 | 3; tm: number; v: number; look: number; lookT: number; yaw: number; blink: number; wave: number;
}
const EXIT = 2.4;

export const goblinsWindows: Build = (s) => {
  const rnd = s.rnd;
  const slots: Slot[] = [];
  const mk = (parent: THREE.Object3D, variant: number, hide: [number, number, number], show: [number, number, number], tilt = 0, body = true): void => {
    const g = goblin(variant, true, body); parent.add(g.root); g.root.visible = false;
    slots.push({ g, hx: hide[0], hy: hide[1], hz: hide[2], sx: show[0], sy: show[1], sz: show[2], tilt, st: 0, tm: 0.3 + rnd() * 3.5, v: 0, look: 0, lookT: 0, yaw: 0, blink: 0, wave: 0 });
  };

  // windows: lean out through the pane
  const wins = [...s.windows].sort((a, b) => (a.face === s.doorSpot.face ? 0 : 1) - (b.face === s.doorSpot.face ? 0 : 1)).slice(0, 3);
  wins.forEach((w, i) => {
    const at = bone(s.group, w.p.x, w.p.y, w.p.z, 0, w.yaw, 0);
    mk(at, i, [0, -0.03, -0.24], [0, 0.0, 0.075], 0, false);
  });
  // the door: round the edge of it, at goblin height
  {
    const d = s.doorSpot, side = rnd() < 0.5 ? 1 : -1;
    const at = bone(s.group, d.p.x, 0, d.p.z, 0, d.yaw, 0);
    mk(at, 3, [side * s.doorW * 0.2, 0.25, -0.24], [side * (s.doorW * 0.5 + 0.03), 0.27, 0.07], -side * 0.45);
  }
  // over the ridge
  const along = Math.max(0.12, Math.min(0.42, s.ridgeLen * 0.7));
  for (const k of s.peaked ? [0] : [-1, 1]) {
    const p = s.ridgeAt(k * along);
    const back = s.doorSpot.n;                      // they hide on the far slope and look at the street
    const at = bone(s.group, p.x - back.x * 0.07, p.y, p.z - back.z * 0.07, 0, s.doorSpot.yaw, 0);
    mk(at, 4 + k, [0, -0.3, 0], [0, 0.065, 0]);
  }

  // curtains: someone else's laundry
  const kinds: GarmentKind[] = ['shirt', 'hose', 'smock', 'sock', 'hose', 'shirt'];
  const cols = [PAL.clothRed, PAL.clothCream, PAL.clothBlue, PAL.clothOchre, PAL.clothCream, PAL.clothGreen];
  const curtains: THREE.Group[] = [];
  wins.forEach((w, i) => {
    const h = s.holder(w.p.x + w.n.x * 0.035, w.p.y, w.p.z + w.n.z * 0.035, w.yaw);
    h.add(box(ROPE(), 0.3, 0.008, 0.008, 0, 0.135, 0), box(mat(PAL.timber), 0.012, 0.03, 0.012, -0.15, 0.13, 0), box(mat(PAL.timber), 0.012, 0.03, 0.012, 0.15, 0.13, 0));
    for (const sx of [-1, 1]) {
      const c = bone(h, sx * 0.105, 0.132, 0.004);
      const gm = garment(kinds[(i * 2 + (sx > 0 ? 1 : 0)) % 6], cols[(i * 2 + (sx > 0 ? 1 : 0) + s.seed) % 6]);
      c.add(gm); curtains.push(c);
    }
  });

  // the flag, planted with conviction and not quite straight
  const fp = s.peaked ? s.perch : s.ridgeAt(0);
  const FH = s.holder(fp.x, fp.y - 0.03, fp.z, s.doorSpot.yaw);
  const mast = bone(FH, 0, 0, 0, 0.08, 0, -0.14);
  mast.add(cyl(mat(PAL.trunk), 0.008, 0.012, 0.36, 0, 0.18, 0, 0, 0, 0, 5), ball(mat(PAL.goblinDark), 0.016, 0.016, 0.016, 0, 0.37, 0));
  const flag = new Cloth(0.2, 0.13, mat(0xffffff, { vertexColors: true, side: THREE.DoubleSide }), 'side', s.own, 5, 3, 0.55,
    (u, v) => (v < 0.34 ? PAL.clothCream : u > 0.5 ? PAL.goblinDark : PAL.clothGreen));
  flag.mesh.position.set(0.008, 0.29, 0); mast.add(flag.mesh);

  // the departure: three whole goblins, kept in the wings until needed
  const dn = s.doorSpot.n, dt_ = new THREE.Vector3(dn.z, 0, -dn.x);
  const runners: { g: Goblin; lane: number }[] = [];
  for (let i = 0; i < 3; i++) {
    const g = goblin(i + 1, true, true); g.root.visible = false; s.group.add(g.root);
    if (i === 0) g.root.add(ball(mat(PAL.clothCream), 0.07, 0.06, 0.06, 0, 0.11, -0.03));            // a bundle of laundry
    if (i === 2) g.root.add(cyl(mat(PAL.trunk), 0.007, 0.008, 0.26, 0.09, 0.05, 0.03, 0, 0, -0.2, 5), box(mat(PAL.clothGreen), 0.11, 0.07, 0.008, 0.16, 0.14, 0.03));
    runners.push({ g, lane: [-0.7, 0.75, 0.05][i] });
  }

  const hideAll = (): void => { for (const sl of slots) if (sl.st === 1 || sl.st === 2) { sl.st = 3; sl.tm = 0; } };

  return {
    exitDur: EXIT,
    update(f: Frame): void {
      const { env, t, dt, out } = f;
      const leaving = out >= 0;
      let outNow = 0; for (const sl of slots) if (sl.st === 1 || sl.st === 2) outNow++;
      if (leaving && out < 0.3) hideAll();

      for (let i = 0; i < slots.length; i++) {
        const sl = slots[i];
        sl.tm -= dt;
        if (sl.st === 0) {
          if (!leaving && sl.tm <= 0 && outNow < 3 && f.age > 0.4) { sl.st = 1; sl.tm = 0.2; sl.look = 0; sl.lookT = 0.35; sl.wave = rnd() < 0.35 ? 1 : 0; outNow++; }
        } else if (sl.st === 1) {
          sl.v = clamp(sl.v + dt / 0.2);
          if (sl.v >= 1) { sl.st = 2; sl.tm = 1.3 + rnd() * 2.6; }
        } else if (sl.st === 2) {
          sl.lookT -= dt;
          if (sl.lookT <= 0) { sl.look = sl.look > 0 ? -0.9 : sl.look < 0 ? (rnd() < 0.4 ? 0 : 0.9) : (rnd() < 0.5 ? 0.9 : -0.9); sl.lookT = 0.35 + rnd() * 0.75; }
          if (sl.tm <= 0) { sl.st = 3; sl.tm = 0; if (rnd() < 0.35) { const o = slots[(i + 1 + Math.floor(rnd() * (slots.length - 1))) % slots.length]; if (o.st === 0) o.tm = Math.min(o.tm, 0.15); } }
        } else {
          sl.v = clamp(sl.v - dt / 0.13);
          if (sl.v <= 0) { sl.st = 0; sl.tm = 1.2 + rnd() * 4.5; }
        }
        const r = sl.g.root;
        r.visible = sl.v > 0.001;
        if (!r.visible) continue;
        const e = sl.st === 3 ? sl.v * sl.v : outBack(sl.v);
        r.position.set(lerp(sl.hx, sl.sx, e), lerp(sl.hy, sl.sy, e), lerp(sl.hz, sl.sz, e));
        r.rotation.z = sl.tilt * e;
        sl.yaw = damp(sl.yaw, sl.look, 16, dt);
        sl.g.head.rotation.set(noise(t * 2 + i, 4) * 0.08, sl.yaw, sl.wave ? Math.sin(t * 9 + i) * 0.12 : 0);
        sl.blink -= dt; if (sl.blink < -2.2 - (i % 3) * 0.6) sl.blink = 0.12;
        sl.g.eyes.scale.y = sl.blink > 0 ? 0.12 : 1;
        sl.g.ears.rotation.x = Math.sin(t * 7 + i * 2) * 0.1 + (sl.st === 1 ? -0.5 * (1 - sl.v) : 0);
        sl.g.ears.scale.y = 1 + Math.sin(t * 11 + i) * 0.06;
      }

      for (let i = 0; i < curtains.length; i++) curtains[i].rotation.set(noise(t * 1.3 + i * 3, 7) * 0.18 * (0.4 + env.wind), 0, Math.sin(t * 1.9 + i * 1.7) * 0.07 * (0.5 + env.wind));
      flag.wave(t, 0.012 + 0.03 * env.wind, 6, 6 + 5 * env.wind);
      mast.rotation.z = -0.14 + Math.sin(t * 1.4) * 0.03 * (0.5 + env.wind);

      if (leaving) {
        const tau = out * EXIT;
        FH.visible = tau < 0.75;                       // the flag leaves with them
        for (let i = 0; i < 3; i++) {
          const rn = runners[i], u = span(tau, 0.45 + i * 0.22, 1.5 + i * 0.22), r = rn.g.root;
          r.visible = u > 0 && u < 1;
          if (!r.visible) continue;
          const d = 0.05 + 1.9 * u, lat = rn.lane * 0.75 * u * u;
          r.position.set(s.door.x + dn.x * d + dt_.x * lat, 0.2 + Math.abs(Math.sin(u * 15)) * 0.07, s.door.z + dn.z * d + dt_.z * lat);
          r.rotation.set(0.22, Math.atan2(dn.x + dt_.x * rn.lane * 0.7 * u, dn.z + dt_.z * rn.lane * 0.7 * u), Math.sin(u * 30) * 0.2);
          r.scale.setScalar(Math.max(0.001, smooth(span(u, 0, 0.12)) * (1 - smooth(span(u, 0.8, 1)))));
          rn.g.head.rotation.y = Math.sin(u * 9 + i) * 0.5;
          rn.g.ears.rotation.x = -0.45;
        }
      }
    },
  };
};
