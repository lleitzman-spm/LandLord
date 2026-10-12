/** Small maths shared by the figurines and the two figure layers. No allocation in any of these. */

export const TAU = Math.PI * 2;

/** stateless hash → 0..1 (mulberry32 step). Cosmetic seeds only. */
export function hash01(n: number): number {
  let t = (n + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** FNV-1a of a string → uint32 (ids to seeds). */
export function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** A tiny seeded generator. One per figure / townsperson; never shared with the sim. */
export class Rng {
  private s: number;
  constructor(seed: number) { this.s = (seed | 0) || 1; }
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number { return a + this.next() * (b - a); }
  int(a: number, b: number): number { return a + Math.floor(this.next() * (b - a + 1)); }
  chance(p: number): boolean { return this.next() < p; }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.next() * arr.length)]!; }
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** smoothstep on 0..1 */
export const ease = (t: number): number => { const x = clamp01(t); return x * x * (3 - 2 * x); };
export const smoothstep = (a: number, b: number, v: number): number => ease((v - a) / (b - a));
/** quick out, soft settle */
export const easeOut = (t: number): number => { const x = 1 - clamp01(t); return 1 - x * x * x; };
/** overshoot then settle (for pops) */
export const easeBack = (t: number): number => { const x = clamp01(t) - 1; return 1 + x * x * (2.6 * x + 1.6); };
export const frac = (v: number): number => v - Math.floor(v);

/** frame-rate independent approach: cur → target at rate lambda (1/s) */
export function damp(cur: number, target: number, lambda: number, dt: number): number {
  return cur + (target - cur) * (1 - Math.exp(-lambda * dt));
}
export function wrapPi(a: number): number {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}
export function dampAngle(cur: number, target: number, lambda: number, dt: number): number {
  return cur + wrapPi(target - cur) * (1 - Math.exp(-lambda * dt));
}
/** a bump: 0 outside [a, b], rising to 1 in the middle (sine) */
export function bump(v: number, a: number, b: number): number {
  if (v <= a || v >= b) return 0;
  return Math.sin(((v - a) / (b - a)) * Math.PI);
}
