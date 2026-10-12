/**
 * Behaviour, as arithmetic. Every animation is a small pure function that
 * writes a pose (a flat array of numbers) from a clock. No keyframes, no
 * allocation. The figure blends between poses, then lays its own life on top
 * (blinks, glances, breath, mood, look-at, one-shot reactions).
 *
 * Hands are placed in body units so one animation fits an ogre and a goblin:
 *   x: outward from the centre line (1 = hanging at the side, 0 = on the chest, negative = across)
 *   y: height in body heights (0 = ground, 1 = neck; c.yHead = middle of the head, c.yTop = its crown)
 *   z: forward in body radii
 */
import type { AnimId } from '../../data/ids';
import { TAU, bump, clamp01, ease, easeOut, frac } from './util';

export const Y = 0, SQ = 1, ROLL = 2, PITCH = 3, YAW = 4, FWD = 5, HYAW = 6, HPITCH = 7, HROLL = 8,
  LX = 9, LY = 10, LZ = 11, RX = 12, RY = 13, RZ = 14, LROT = 15, RROT = 16, PROP = 17, PROPR = 18,
  BLINK = 19, LID = 20, SMILE = 21, MOUTH = 22, CURVE = 23, WIDE = 24, BROW = 25, TILT = 26, SKEW = 27, GAZEX = 28, GAZEY = 29;
export const POSE_N = 30;
export type Pose = Float32Array;

export interface AnimCtx {
  /** the figure's own clock, seconds */
  T: number;
  /** a personal phase, 0..2π, so a crowd never moves in step */
  ph: number;
  /** 0 miserable .. 1 delighted (smoothed) */
  mood: number;
  /** walk cycle, radians, driven by distance actually covered */
  wp: number;
  /** 0..1 how much it is really moving */
  ga: number;
  /** world units per second */
  speed: number;
  restless: number;
  sit: boolean;
  yHead: number; yTop: number;
  /** holding a long tool upright in the right hand */
  long: boolean;
  /** what is in the hand hangs below it */
  hangs: boolean;
  /** prop pitch that puts a long tool's working end on the ground from the sweeping grip */
  tilt: number;
  /** +1 or −1: which way this one leans when it has the choice */
  side: number;
}

const HEAD_UP = -0.12;   // figures look a little up, toward whoever is leaning over the table

export function rest(o: Pose): void {
  o.fill(0);
  o[HPITCH] = HEAD_UP;
  o[LX] = 1; o[LY] = 0.5; o[LZ] = 0.22;
  o[RX] = 1; o[RY] = 0.5; o[RZ] = 0.22;
}

/** the waddle: rock from edge to edge, a small hop on each step, hands swinging */
function loco(o: Pose, c: AnimCtx, roll: number, hop: number, swing: number): void {
  const g = c.ga;
  if (g < 0.002) return;
  const s = Math.sin(c.wp), cs = Math.cos(c.wp);
  o[ROLL]! += s * roll * g;
  o[Y]! += Math.abs(s) * hop * g;
  o[YAW]! += s * 0.1 * g;
  o[HROLL]! -= s * roll * 0.5 * g;
  o[HYAW]! -= s * 0.06 * g;
  o[PITCH]! += (0.04 + Math.min(c.speed, 3) * 0.03) * g;
  o[LZ]! += cs * swing * g; o[RZ]! -= cs * swing * g;
  o[LY]! += Math.abs(cs) * 0.05 * swing * g; o[RY]! += Math.abs(cs) * 0.05 * swing * g;
}

type Fn = (o: Pose, t: number, c: AnimCtx) => void;

const idle: Fn = (o, _t, c) => {
  const T = c.T, r = c.restless;
  o[ROLL] = Math.sin(T * 0.6 + c.ph) * 0.02;
  o[HYAW] = Math.sin(T * 0.37 + c.ph * 3) * 0.22 + Math.sin(T * 0.83 + c.ph) * 0.08;
  o[HROLL] = Math.sin(T * 0.23 + c.ph * 2) * 0.05;
  o[LZ]! += Math.sin(T * 0.9 + c.ph) * 0.06; o[RZ]! += Math.sin(T * 0.9 + c.ph + 2) * 0.06;
  if (r > 0) {
    // waiting: weight from one side to the other, a tap of impatience
    const w = Math.sin(T * 1.25 + c.ph * 2);
    o[ROLL]! += w * w * w * 0.085 * r;
    o[Y]! += Math.pow(Math.max(0, Math.sin(T * 2.5 + c.ph)), 10) * 0.014 * r;
    o[HROLL]! += w * 0.05 * r;
    o[LY]! += r * 0.06; o[LX]! -= r * 0.1; o[LZ]! += r * 0.35;
  }
  if (c.sit) { o[LX] = 0.42; o[RX] = 0.42; o[LY] = 0.36; o[RY] = 0.36; o[LZ] = 0.95; o[RZ] = 0.95; }
};

const walk: Fn = (o, _t, c) => {
  const m = c.mood;
  const skip = ease((m - 0.78) / 0.14), drag = ease((0.3 - m) / 0.2);
  loco(o, c, 0.15 - drag * 0.06 - skip * 0.04, 0.012 + skip * 0.045 - drag * 0.008, 0.95 - drag * 0.6 + skip * 0.3);
  if (skip > 0) {
    const s = Math.sin(c.wp);
    o[SQ]! += (Math.abs(s) - 0.5) * 0.07 * skip * c.ga;
    o[LY]! += 0.2 * skip * c.ga; o[RY]! += 0.2 * skip * c.ga;
    o[HROLL]! += s * 0.1 * skip * c.ga;
    o[SMILE] = skip * 0.6 * Math.abs(s) * c.ga;
  }
  o[HYAW]! += Math.sin(c.T * 0.5 + c.ph) * 0.12;
};

const run: Fn = (o, _t, c) => {
  const g = c.ga, s = Math.sin(c.wp), cs = Math.cos(c.wp);
  o[PITCH] = 0.27 * g;
  o[HPITCH] = HEAD_UP - 0.2 * g;
  o[ROLL] = s * 0.1 * g;
  o[Y] = Math.abs(s) * 0.035 * g;
  o[SQ] = (Math.abs(s) - 0.5) * 0.06 * g;
  o[YAW] = s * 0.12 * g;
  o[LX] = 1.05; o[RX] = 1.05;
  o[LY] = 0.5 + 0.22 * g + Math.abs(cs) * 0.08 * g; o[RY] = o[LY]!;
  o[LZ] = 0.22 + cs * 1.2 * g; o[RZ] = 0.22 - cs * 1.2 * g;
  o[BROW] = 0.3 * g; o[MOUTH] = 0.25 * g; o[WIDE] = -0.3 * g;
};

const hammer: Fn = (o, t, c) => {
  const u = frac(t / 0.74);
  // wind up, strike, rebound
  let k: number;                       // 0 = raised, 1 = struck
  if (u < 0.52) k = 1 - ease(u / 0.52);
  else if (u < 0.66) { const q = (u - 0.52) / 0.14; k = q * q; }
  else k = 1 - bump(u, 0.66, 1.0) * 0.12;
  const hit = bump(u, 0.63, 0.82);
  o[RX] = 0.62; o[RY] = c.yTop * 0.98 - k * (c.yTop * 0.98 - 0.62); o[RZ] = 0.1 + k * 1.5;
  o[PROP] = -0.95 + k * 2.5;
  o[LX] = 0.5; o[LY] = 0.58; o[LZ] = 1.25;
  o[PITCH] = -0.08 + k * 0.26;
  o[SQ] = -hit * 0.05;
  o[HPITCH] = 0.12 + k * 0.06;
  o[BLINK] = hit > 0.4 ? 1 : 0;
  o[BROW] = -0.3; o[TILT] = -0.35; o[GAZEY] = -0.6;
  o[MOUTH] = hit * 0.2;
};

const sweep: Fn = (o, t, c) => {
  const s = Math.sin(t * TAU / 1.25), cs = Math.cos(t * TAU / 1.25);
  o[RX] = 0.15 - s * 0.55; o[RY] = 0.98 + cs * 0.04; o[RZ] = 0.85 - Math.abs(s) * 0.1;
  o[LX] = -o[RX]! + 0.05; o[LY] = 0.6; o[LZ] = 1.55;
  o[PROP] = c.tilt; o[PROPR] = -s * 0.3;
  o[ROLL] = -s * 0.07; o[YAW] = -s * 0.2; o[PITCH] = 0.13;
  o[HPITCH] = 0.14; o[HYAW] = s * 0.12; o[GAZEY] = -0.5;
  o[Y] = Math.abs(cs) * 0.004;
};

const carry: Fn = (o, _t, c) => {
  const b = Math.sin(c.T * 3.1 + c.ph);
  o[LX] = 0.45; o[RX] = 0.45;
  o[LY] = c.yTop + 0.12 + b * 0.015; o[RY] = o[LY]!;
  o[LZ] = 0.1; o[RZ] = 0.1;
  o[PROP] = c.hangs ? Math.PI : 0;
  o[HPITCH] = HEAD_UP - 0.08;
  o[CURVE] = 0.3; o[BROW] = 0.2;
  loco(o, c, 0.13, 0.012, 0);
};

const wave: Fn = (o, t, c) => {
  const w = Math.sin(t * 9.5);
  const hand = c.long ? 0 : 1;      // do not wave the pitchfork
  const X = hand ? RX : LX, Yh = hand ? RY : LY, Z = hand ? RZ : LZ, R = hand ? RROT : LROT;
  o[X] = 1.25 + w * 0.2; o[Yh] = c.yHead + 0.22 + Math.abs(w) * 0.03; o[Z] = 0.3; o[R] = w * 0.55;
  o[ROLL] = (hand ? 1 : -1) * 0.05 + w * 0.012;
  o[HROLL] = (hand ? -1 : 1) * 0.1;
  o[Y] = Math.abs(Math.sin(t * 4.75)) * 0.008;
  o[MOUTH] = 0.35; o[CURVE] = 0.45; o[BROW] = 0.45; o[SMILE] = 0.25;
};

const shakeFist: Fn = (o, t, c) => {
  const s = Math.sin(t * 15), s2 = Math.sin(t * 7.5);
  o[RX] = 0.85 + Math.cos(t * 15) * 0.06; o[RY] = c.yHead + 0.12 + s * 0.09; o[RZ] = 0.95;
  o[PROPR] = s * 0.2;
  o[LX] = 0.92; o[LY] = 0.56; o[LZ] = 0.05;
  o[PITCH] = 0.13; o[ROLL] = s2 * 0.035; o[Y] = Math.abs(s2) * 0.012;
  o[HPITCH] = -0.02; o[HROLL] = s2 * 0.04;
  o[TILT] = -1.0; o[BROW] = -0.3; o[CURVE] = -0.85; o[MOUTH] = 0.5 + Math.sin(t * 11) * 0.3; o[LID] = -0.15;
};

const cheer: Fn = (o, t, c) => {
  const u = frac(t / 0.64 + c.ph * 0.16);
  const air = u < 0.72 ? Math.sin(u / 0.72 * Math.PI) : 0;
  const land = bump(u, 0.72, 1.0);
  o[Y] = air * 0.085;
  o[SQ] = (u < 0.12 ? 0.07 : 0) + air * 0.04 - land * 0.1;
  o[LX] = 1.1; o[RX] = 1.1; o[LY] = c.yTop + 0.05 + air * 0.16; o[RY] = o[LY]!;
  o[LZ] = 0.15; o[RZ] = 0.15; o[LROT] = Math.sin(t * 13) * 0.4; o[RROT] = -Math.sin(t * 13) * 0.4;
  o[PROPR] = Math.sin(t * 13) * 0.25;
  o[HPITCH] = HEAD_UP - 0.14;
  o[MOUTH] = 0.75; o[CURVE] = 0.8; o[BROW] = 0.5; o[SMILE] = air > 0.3 ? 1 : 0.3;
};

const bow: Fn = (o, t, c) => {
  const u = t % 2.7;
  const k = u < 0.5 ? ease(u / 0.5) : u < 1.35 ? 1 : u < 1.85 ? 1 - ease((u - 1.35) / 0.5) : 0;
  o[PITCH] = k * 0.82; o[FWD] = -k * 0.3;
  o[HPITCH] = HEAD_UP + k * 0.42;
  o[RX] = 1 - k * 1.25; o[RY] = 0.5 + k * 0.12; o[RZ] = 0.22 + k * 1.0;
  o[LX] = 1 - k * 0.3; o[LY] = 0.5 + k * 0.1; o[LZ] = 0.22 - k * 1.1;
  o[BLINK] = k > 0.6 ? 1 : 0; o[CURVE] = 0.2;
  void c;
};

const sleep: Fn = (o, _t, c) => {
  const br = Math.sin(c.T * 1.15 + c.ph);
  // every so often the chin drops too far and jerks back up
  const j = frac((c.T + c.ph * 3) / 7.3), jerk = j > 0.9 ? bump(j, 0.9, 1.0) : 0;
  o[PITCH] = 0.17 - jerk * 0.08; o[SQ] = -0.045 + br * 0.028;
  o[HPITCH] = 0.52 - jerk * 0.5; o[HROLL] = 0.26 * c.side * (1 - jerk);
  o[BLINK] = jerk > 0.7 ? 0.3 : 1;
  o[MOUTH] = 0.14 + Math.max(0, br) * 0.12; o[WIDE] = -0.55; o[CURVE] = -0.2; o[BROW] = jerk * 0.6;
  o[LY] = 0.4; o[RY] = 0.4; o[LZ] = 0.5; o[RZ] = 0.5;
  if (c.ga > 0.01) {
    // walking in their sleep, arms out
    const g = c.ga;
    o[LX] = 1 - 0.5 * g; o[RX] = 1 - 0.5 * g; o[LY] = 0.4 + 0.58 * g; o[RY] = 0.4 + 0.58 * g; o[LZ] = 0.5 + 1.3 * g; o[RZ] = 0.5 + 1.3 * g;
    o[HPITCH] = 0.52 - 0.4 * g; o[PITCH] = 0.17 - 0.1 * g;
    loco(o, c, 0.1, 0.006, 0);
  }
};

const talk: Fn = (o, t, c) => {
  const syl = Math.abs(Math.sin(t * 8.5 + Math.sin(t * 2.7 + c.ph) * 1.8));
  const gate = Math.sin(t * 1.15 + c.ph) > -0.75 ? 1 : 0.12;
  o[MOUTH] = 0.12 + syl * 0.6 * gate;
  o[HPITCH] = HEAD_UP + Math.sin(t * 4.3) * 0.05 * gate;
  o[HROLL] = Math.sin(t * 1.9 + c.ph) * 0.07;
  o[ROLL] = Math.sin(t * 1.9 + c.ph) * 0.028;
  o[BROW] = Math.sin(t * 2.3 + c.ph) * 0.3; o[CURVE] = 0.1;
  // one hand at a time makes the point
  const w = ease(0.5 + Math.sin(t * 1.3 + c.ph) * 1.6), wl = 1 - w;
  const gx = Math.cos(t * 5.2) * 0.14, gy = Math.sin(t * 5.2) * 0.09;
  const wr = c.long ? 0 : w;
  o[RX] = 1 - wr * (0.15 - gx); o[RY] = 0.5 + wr * (0.48 + gy); o[RZ] = 0.22 + wr * 0.85;
  o[LX] = 1 - wl * (0.15 + gx); o[LY] = 0.5 + wl * (0.48 - gy); o[LZ] = 0.22 + wl * 0.85;
  o[RROT] = wr * 0.4; o[LROT] = wl * 0.4;
  if (c.sit) { o[LY]! -= 0.12; o[RY]! -= 0.12; }
};

const cower: Fn = (o, t, c) => {
  const peek = frac((t + c.ph) / 2.4) > 0.78 ? 1 : 0;
  o[SQ] = -0.17; o[PITCH] = 0.2; o[ROLL] = Math.sin(t * 31) * 0.017;
  o[LX] = 0.5; o[RX] = 0.5; o[LY] = c.yTop * 0.9; o[RY] = c.yTop * 0.9; o[LZ] = 0.6; o[RZ] = 0.6;
  o[HPITCH] = 0.3 - peek * 0.3;
  o[BLINK] = 1 - peek; o[LID] = peek * 0.25; o[GAZEY] = peek * 0.6;
  o[TILT] = 1.0; o[BROW] = 0.3 + peek * 0.3;
  o[MOUTH] = 0.24 + Math.sin(t * 19) * 0.07; o[CURVE] = -0.7;
};

const knock: Fn = (o, t, _c) => {
  const u = t % 1.95;
  const rap = u < 0.66 ? Math.max(0, Math.sin(u / 0.66 * Math.PI * 3)) : 0;
  const listen = bump(u, 0.75, 1.9);
  o[RX] = 0.5; o[RY] = 1.08; o[RZ] = 1.25 + rap * 0.55;
  o[PROP] = 0.6;
  o[LX] = 0.92; o[LY] = 0.56; o[LZ] = 0.05;
  o[PITCH] = 0.06 + rap * 0.03 + listen * 0.1;
  o[HROLL] = listen * 0.26; o[HYAW] = listen * 0.3; o[HPITCH] = HEAD_UP + listen * 0.12;
  o[BROW] = listen * 0.4; o[GAZEX] = -listen * 0.6;
};

const read: Fn = (o, t, c) => {
  const line = frac(t / 1.5);
  o[LX] = 0.36; o[RX] = 0.36; o[LY] = 0.9; o[RY] = 0.9; o[LZ] = 1.12; o[RZ] = 1.12;
  o[PROP] = -0.4;
  o[HPITCH] = 0.26; o[GAZEY] = -0.5; o[GAZEX] = line * 1.5 - 0.75; o[HYAW] = (line - 0.5) * 0.12;
  o[MOUTH] = Math.abs(Math.sin(t * 6.2)) * 0.09; o[WIDE] = -0.2;
  // something on the page gives them pause
  const hm = bump(frac((t + c.ph) / 5.2), 0.8, 1.0);
  o[BROW] = hm * 0.7; o[SKEW] = hm * 0.5; o[HPITCH]! -= hm * 0.08;
};

const count: Fn = (o, t, _c) => {
  const u = frac(t / 0.58), k = easeOut(u);
  o[LX] = 0.22; o[LY] = 0.7; o[LZ] = 1.1; o[LROT] = 0.2;
  o[RX] = 0.18 + k * 0.6; o[RY] = 0.76 + Math.sin(u * Math.PI) * 0.24; o[RZ] = 1.1;
  o[HPITCH] = 0.24 + bump(u, 0, 0.5) * 0.07; o[GAZEY] = -0.5; o[GAZEX] = k * 0.5 - 0.25;
  o[MOUTH] = u < 0.32 ? 0.26 : 0.04; o[WIDE] = -0.3;
  o[BROW] = -0.15;
};

const shrug: Fn = (o, t, c) => {
  const u = t % 2.5;
  const k = u < 0.32 ? easeOut(u / 0.32) : u < 1.25 ? 1 : u < 1.7 ? 1 - ease((u - 1.25) / 0.45) : 0;
  o[LX] = 1 + k * 0.5; o[RX] = 1 + k * 0.5; o[LY] = 0.5 + k * 0.6; o[RY] = 0.5 + k * 0.6; o[LZ] = 0.22 + k * 0.4; o[RZ] = 0.22 + k * 0.4;
  o[LROT] = k * 0.7; o[RROT] = k * 0.7; o[PROPR] = k * 0.5;
  o[SQ] = k * 0.045; o[HROLL] = k * 0.22 * c.side; o[HPITCH] = HEAD_UP - k * 0.05;
  o[BROW] = k * 0.7; o[SKEW] = k * 0.3 * c.side; o[CURVE] = -k * 0.45; o[WIDE] = k * 0.1;
};

const dance: Fn = (o, t, c) => {
  const b = t / 0.44 + c.ph, s = Math.sin(b * Math.PI);
  const bar = b % 8;
  o[Y] = Math.abs(s) * 0.034; o[SQ] = (Math.abs(s) - 0.55) * 0.07;
  o[ROLL] = s * 0.2; o[HROLL] = -s * 0.1;
  o[YAW] = bar > 6 ? ease((bar - 6) / 2) * TAU : 0;
  o[LX] = 1.2; o[RX] = 1.2;
  o[LY] = 0.85 + Math.max(0, s) * 0.55; o[RY] = 0.85 + Math.max(0, -s) * 0.55;
  o[LZ] = 0.3; o[RZ] = 0.3; o[LROT] = s * 0.4; o[RROT] = s * 0.4; o[PROPR] = s * 0.3;
  o[CURVE] = 0.8; o[MOUTH] = 0.35; o[SMILE] = Math.abs(s) > 0.6 ? 0.9 : 0.2; o[BROW] = 0.4;
};

const pray: Fn = (o, t, c) => {
  o[LX] = 0.12; o[RX] = 0.12; o[LY] = 0.98; o[RY] = 0.98; o[LZ] = 1.05; o[RZ] = 1.05;
  o[PROP] = 0.3;
  o[HPITCH] = 0.42; o[BLINK] = 1;
  o[PITCH] = 0.07 + Math.sin(c.T * 0.8 + c.ph) * 0.02;
  o[MOUTH] = Math.abs(Math.sin(t * 3.1)) * 0.06; o[WIDE] = -0.3; o[TILT] = 0.3;
};

const point: Fn = (o, t, c) => {
  const jab = bump(frac(t / 1.3), 0, 0.22);
  o[RX] = 0.5; o[RY] = 1.1; o[RZ] = 1.75 + jab * 0.3; o[PROP] = 1.1;
  o[LX] = 0.92; o[LY] = 0.56; o[LZ] = 0.05;
  o[YAW] = -0.12; o[PITCH] = 0.05 + jab * 0.04;
  o[HYAW] = Math.sin(t * 0.9 + c.ph) * 0.4 + 0.1;
  o[MOUTH] = Math.abs(Math.sin(t * 7.3)) * 0.3 * (Math.sin(t * 0.9 + c.ph) > 0 ? 1 : 0.2);
  o[BROW] = 0.25; o[CURVE] = 0.15;
};

export const ANIM: Record<AnimId, Fn> = {
  idle, walk, run, hammer, sweep, carry, wave, shake_fist: shakeFist, cheer, bow, sleep, talk, cower, knock, read, count, shrug, dance, pray, point,
};

export type ReactKind = 'hop' | 'startle' | 'nod' | 'shake' | 'flinch';
export const REACT_DUR: Record<ReactKind, number> = { hop: 0.5, startle: 0.55, nod: 0.62, shake: 0.72, flinch: 0.5 };

/** one-shots laid over whatever is playing; u runs 0..1 */
export function applyReact(o: Pose, kind: ReactKind, u: number): void {
  switch (kind) {
    case 'hop': {
      const a = Math.min(u / 0.78, 1);
      o[Y]! += Math.sin(a * Math.PI) * 0.085;
      o[SQ]! += u < 0.78 ? Math.cos(a * Math.PI) * 0.06 : -0.06 * (1 - (u - 0.78) / 0.22);
      break;
    }
    case 'startle': {
      const e = Math.sin(clamp01(u) * Math.PI);
      o[Y]! += e * 0.05; o[PITCH]! -= e * 0.2; o[SQ]! += e * 0.05;
      o[LY]! += e * 0.6; o[RY]! += e * 0.6; o[LX]! += e * 0.35; o[RX]! += e * 0.35;
      o[BROW]! += e * 0.9; o[LID]! += e * 0.3; o[BLINK] = 0; o[SMILE] = 0;
      o[MOUTH] = Math.max(o[MOUTH]!, e * 0.6); o[WIDE]! -= e * 0.5;
      break;
    }
    case 'nod': o[HPITCH]! += Math.max(0, Math.sin(u * TAU * 2)) * 0.26 * (1 - u * 0.4); break;
    case 'shake': o[HYAW]! += Math.sin(u * TAU * 2) * 0.42 * (1 - u * 0.5); o[CURVE]! -= 0.3 * Math.sin(u * Math.PI); break;
    case 'flinch': {
      const e = Math.sin(clamp01(u) * Math.PI);
      o[SQ]! -= e * 0.14; o[HPITCH]! += e * 0.3; o[BLINK] = Math.max(o[BLINK]!, e > 0.3 ? 1 : 0);
      o[LY]! += e * 0.45; o[RY]! += e * 0.45; o[LZ]! += e * 0.4; o[RZ]! += e * 0.4; o[TILT]! += e * 0.8;
      break;
    }
  }
}
