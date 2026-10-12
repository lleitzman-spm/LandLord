/**
 * The building site: survey stakes and string, a sawhorse and a pile of timber,
 * and the scaffold the house rises inside. Sized from the body's own bounds, so
 * it fits a well as readily as a keep. Each piece is one mesh.
 */
import * as THREE from 'three';
import type { BuildingLook } from '../api';
import { PAL } from '../palette';
import { Sculpt } from './parts';
import type { Bounds } from './wear';

const POLE = 0x9a7a52, PLANK = 0xb89868, STRING = 0xe8dcc0;

/** split a span into bays no wider than `max`: the positions of the poles along it */
function bays(a: number, b: number, max: number): number[] {
  const n = Math.max(1, Math.ceil((b - a) / max - 0.15)), out: number[] = [];
  for (let i = 0; i <= n; i++) out.push(a + ((b - a) * i) / n);
  return out;
}

/** Stakes at the corners of the plot with string between, and the carpenter's leavings. */
export function buildStakes(look: BuildingLook, b: Bounds, door: THREE.Vector3, seed: number): THREE.Mesh | null {
  const s = new Sculpt(seed ^ 0x57a6), r = s.rand;
  const hw = look.w / 2 - 0.09, hh = look.h / 2 - 0.09, y = 0.13;
  const xs = bays(-hw, hw, 1.6), zs = bays(-hh, hh, 1.6);
  const pts: [number, number][] = [];
  for (const x of xs) pts.push([x, hh]);
  for (let i = zs.length - 2; i >= 1; i--) pts.push([hw, zs[i]]);
  for (let i = xs.length - 1; i >= 0; i--) pts.push([xs[i], -hh]);
  for (let i = 1; i < zs.length - 1; i++) pts.push([-hw, zs[i]]);
  for (const [x, z] of pts) {
    const lx = r.range(-0.02, 0.02), lz = r.range(-0.02, 0.02);
    s.block('site', PAL.timberLight, x, 0, z, 0.04, 0.2, 0.04, { sx: lx, sz: lz, tw: 0.03, td: 0.03 });
    s.block('site', PAL.crimson, x + lx, 0.2, z + lz, 0.032, 0.025, 0.032, { bottom: true, jit: 0.02 });
  }
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    // the string is left open across the doorway: the carpenters have to get in somehow
    if (p[1] === hh && q[1] === hh && Math.min(p[0], q[0]) < door.x && Math.max(p[0], q[0]) > door.x && Math.abs(q[0] - p[0]) < 0.7) continue;
    s.beam('site', STRING, [p[0], y + r.range(-0.012, 0.012), p[1]], [q[0], y + r.range(-0.012, 0.012), q[1]], 0.009, 0.009, 0.02);
  }
  // where is there room to work? the front yard for preference, then the sides
  const spots: [number, number, number][] = [];
  const front = look.h / 2 - b.maxZ, side = look.w / 2 - b.maxX, sideL = b.minX + look.w / 2;
  if (front > 0.3) { spots.push([hw - 0.28, hh - 0.14, 0]); spots.push([-hw + 0.28, hh - 0.14, 0]); }
  if (side > 0.3) spots.push([hw - 0.12, Math.min(0, b.maxZ - 0.3), Math.PI / 2]);
  if (sideL > 0.3) spots.push([-hw + 0.12, Math.min(0, b.maxZ - 0.3), Math.PI / 2]);
  const free = spots.filter(p => Math.hypot(p[0] - door.x, p[1] - door.z) > 0.42);
  free.sort((p, q) => Math.abs(q[0] - door.x) - Math.abs(p[0] - door.x));
  const pile = free[0], horse = free[1];
  if (pile) {
    s.at(pile[0], 0, pile[1], pile[2] + r.range(-0.12, 0.12), () => {
      // squared timbers, the top course not quite straight
      for (let i = 0; i < 4; i++) s.beam('site', i % 2 ? PAL.timberLight : PLANK, [-0.24 + r.range(-0.03, 0.03), 0.03, -0.09 + i * 0.058], [0.24 + r.range(-0.03, 0.03), 0.03, -0.09 + i * 0.058], 0.05, 0.05);
      for (let i = 0; i < 3; i++) s.beam('site', i % 2 ? PLANK : PAL.timberLight, [-0.22 + r.range(-0.04, 0.04), 0.082, -0.06 + i * 0.06], [0.22 + r.range(-0.04, 0.04), 0.082, -0.06 + i * 0.06 + r.range(-0.02, 0.02)], 0.05, 0.05);
      s.beam('site', PLANK, [-0.2, 0.134, -0.04], [0.23, 0.134, 0.05], 0.05, 0.05);
    });
  }
  if (horse && look.w >= 2) {
    s.at(horse[0], 0, horse[1], horse[2] + r.range(-0.2, 0.2), () => {
      s.beam('site', PAL.timber, [-0.17, 0.19, 0], [0.17, 0.19, 0], 0.04, 0.04);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.beam('site', PAL.timberLight, [sx * 0.13, 0.19, 0], [sx * 0.16, 0, sz * 0.08], 0.022, 0.022);
      // a plank across it, half sawn, and the saw left in the cut
      s.beam('site', PLANK, [-0.02, 0.225, -0.2], [0.03, 0.225, 0.22], 0.085, 0.022);
      s.beam('site', PAL.iron, [0.07, 0.24, 0.02], [0.02, 0.36, 0.07], 0.05, 0.006, 0);
      s.block('site', PAL.timber, 0.012, 0.35, 0.078, 0.022, 0.045, 0.04, { bottom: true });
    });
    // sawdust
    const pts2: [number, number, number][] = [];
    for (let i = 0; i < 6; i++) { const a = -(i / 6) * Math.PI * 2; pts2.push([horse[0] + Math.cos(a) * 0.13 * r.range(0.7, 1.1), 0.005, horse[1] + Math.sin(a) * 0.09 * r.range(0.7, 1.1)]); }
    s.poly('site', 0xd9c08a, pts2, 0.03);
  }
  const m = s.mesh('site');
  if (m) m.name = 'stakes';
  return m;
}

/**
 * The scaffold: poles round the body, ledgers every storey, a plank walk on the street side,
 * braces, and a ladder. `top` is how high it stands.
 */
export function buildScaffold(look: BuildingLook, b: Bounds, top: number, door: THREE.Vector3, seed: number): THREE.Mesh | null {
  const s = new Sculpt(seed ^ 0x5caf), r = s.rand;
  const hw = look.w / 2 - 0.035, hh = look.h / 2 - 0.035;
  const x0 = Math.max(-hw, b.minX - 0.1), x1 = Math.min(hw, b.maxX + 0.1), z0 = Math.max(-hh, b.minZ - 0.1), z1 = Math.min(hh, b.maxZ + 0.1);
  if (x1 - x0 < 0.2 || z1 - z0 < 0.2) return null;
  const H = Math.max(0.4, top);
  // a well or a notice board gets a bare frame: no walks, no ladder, nothing to hide it
  const small = look.w < 2 || look.h < 2, thick = small ? 0.036 : 0.045;
  const xs = bays(x0, x1, 1.15), zs = bays(z0, z1, 1.15);
  // poles: all the way round, none in the doorway
  const pole = (x: number, z: number): void => {
    if (z === z1 && Math.abs(x - door.x) < 0.17) x += x < door.x ? -0.12 : 0.12;
    s.block('site', POLE, x, 0, z, thick, H * r.range(1.0, 1.1), thick, { sx: r.range(-0.02, 0.02), sz: r.range(-0.02, 0.02), tw: thick * 0.72, td: thick * 0.72 });
  };
  for (const x of xs) { pole(x, z1); pole(x, z0); }
  for (let i = 1; i < zs.length - 1; i++) { pole(x0, zs[i]); pole(x1, zs[i]); }
  // ledgers at every lift
  const lifts: number[] = [];
  if (H < 0.62) lifts.push(H - 0.07);
  else for (let y = 0.44; y < H - 0.04; y += 0.44) lifts.push(y);
  const j = () => r.range(-0.012, 0.012);
  for (const y of lifts) {
    s.beam('site', PAL.timberLight, [x0 - 0.05, y + j(), z1 + 0.012], [x1 + 0.05, y + j(), z1 + 0.012], 0.03, 0.035);
    s.beam('site', PAL.timberLight, [x0 - 0.05, y + j(), z0 - 0.012], [x1 + 0.05, y + j(), z0 - 0.012], 0.03, 0.035);
    s.beam('site', PAL.timberLight, [x0 - 0.012, y + 0.03 + j(), z0 - 0.05], [x0 - 0.012, y + 0.03 + j(), z1 + 0.05], 0.03, 0.035);
    s.beam('site', PAL.timberLight, [x1 + 0.012, y + 0.03 + j(), z0 - 0.05], [x1 + 0.012, y + 0.03 + j(), z1 + 0.05], 0.03, 0.035);
  }
  // plank walks: the street side at the first lift, one end at the second
  const walk = (y: number, ax: 'x' | 'z', at: number, from: number, to: number): void => {
    const n = Math.max(1, Math.round((to - from) / 0.55));
    for (let i = 0; i < n; i++) {
      const a = from + ((to - from) * i) / n + 0.01, c = from + ((to - from) * (i + 1)) / n - 0.01, yy = y + 0.034 + (i % 2) * 0.012;
      for (const off of [-0.035, 0.04]) {
        if (ax === 'x') s.beam('site', i % 2 ? PLANK : 0xa88a5c, [a, yy, at + off + j()], [c, yy, at + off + j()], 0.07, 0.016);
        else s.beam('site', i % 2 ? PLANK : 0xa88a5c, [at + off + j(), yy, a], [at + off + j(), yy, c], 0.07, 0.016);
      }
    }
  };
  if (!small && lifts.length && H >= 0.62) walk(lifts[0], 'x', z1 - 0.045, x0, x1);
  if (!small && lifts.length > 1) walk(lifts[1], 'z', (r.chance(0.5) ? x0 + 0.045 : x1 - 0.045), z0, z1);
  if (!small && lifts.length > 2) walk(lifts[2], 'x', z0 + 0.045, x0, x1);
  // braces: one long diagonal each side that is wide enough to need it
  const yb = lifts.length ? lifts[Math.min(1, lifts.length - 1)] : H * 0.8;
  if (z1 - z0 > 0.6) {
    s.beam('site', POLE, [x0 - 0.02, 0.04, z0], [x0 - 0.02, yb, z1], 0.026, 0.03);
    s.beam('site', POLE, [x1 + 0.02, 0.04, z1], [x1 + 0.02, yb, z0], 0.026, 0.03);
  }
  if (x1 - x0 > 0.6) s.beam('site', POLE, [x0, 0.04, z0 - 0.02], [x1, yb, z0 - 0.02], 0.026, 0.03);
  // the ladder to the first lift, off to the side of the door
  if (!small && lifts.length && H >= 0.62) {
    const room = look.h / 2 - 0.04 - z1, out = Math.min(0.2, room);
    if (out > 0.07) {
      let lx = door.x + (door.x > (x0 + x1) / 2 ? -0.42 : 0.42);
      lx = Math.min(x1 - 0.1, Math.max(x0 + 0.1, lx));
      const y1 = lifts[0] + 0.12, zt = z1 + 0.03, zb = z1 + out;
      for (const sg of [-1, 1]) s.beam('site', PAL.timberLight, [lx + sg * 0.06, 0, zb], [lx + sg * 0.06, y1, zt], 0.022, 0.022);
      const rungs = Math.max(3, Math.round(y1 / 0.09));
      for (let i = 1; i < rungs; i++) { const t = i / rungs; s.beam('site', PAL.timber, [lx - 0.065, y1 * t, zb + (zt - zb) * t], [lx + 0.065, y1 * t, zb + (zt - zb) * t], 0.016, 0.016); }
    }
  }
  // a bucket on a rope from the top lift, because there is always one
  if (lifts.length > 1) {
    const bx = x1 + 0.03, bz = z0 + (z1 - z0) * 0.3, ty = lifts[lifts.length - 1] + 0.03;
    s.beam('site', POLE, [bx - 0.03, ty + 0.14, bz], [bx + 0.12, ty + 0.2, bz], 0.026, 0.026);
    if (bx + 0.09 < look.w / 2 - 0.02) {
      s.beam('site', 0xbfa67a, [bx + 0.09, ty + 0.19, bz], [bx + 0.09, ty * 0.45, bz], 0.008, 0.008, 0);
      s.cyl('site', PAL.timberLight, bx + 0.09, ty * 0.45 - 0.07, bz, 0.03, 0.04, 0.07, 6, { capHex: PAL.stone });
    }
  }
  const m = s.mesh('site');
  if (m) m.name = 'scaffold';
  return m;
}
