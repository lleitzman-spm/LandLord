/**
 * Portraits: small pure helpers. Seeded randomness, pigment mixing, and the
 * curve maths behind the "hand-inked" line. No DOM in here (the whole drawing
 * side runs in node as well, which is how it gets tested).
 */

export type Pt = [number, number];

// ───────────── seeded randomness ─────────────

export interface Rand {
  /** 0..1 */
  (): number;
  range(a: number, b: number): number;
  int(a: number, b: number): number;
  pick<T>(a: readonly T[]): T;
  /** weighted pick from [item, weight] pairs */
  wpick<T>(a: readonly (readonly [T, number])[]): T;
  chance(p: number): boolean;
  /** -amp..amp */
  jit(amp: number): number;
  /** an independent stream, so one part's rolls never shift another's */
  fork(salt: string): Rand;
}

export function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function scramble(n: number): number {
  let t = (n + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}
export function makeRand(seed: number): Rand {
  let a = scramble((seed | 0) ^ 0x9e3779b9);
  const base = a;
  const r = (() => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }) as Rand;
  r.range = (lo, hi) => lo + (hi - lo) * r();
  r.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * r());
  r.pick = arr => arr[Math.min(arr.length - 1, Math.floor(r() * arr.length))];
  r.wpick = arr => {
    let total = 0;
    for (const [, w] of arr) total += w;
    let x = r() * total;
    for (const [v, w] of arr) { x -= w; if (x <= 0) return v; }
    return arr[arr.length - 1][0];
  };
  r.chance = p => r() < p;
  r.jit = amp => (r() * 2 - 1) * amp;
  r.fork = salt => makeRand(base ^ hashStr(salt));
  return r;
}

// ───────────── numbers ─────────────

export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const ease = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** one decimal, no trailing zero: keeps the path strings small */
export const f = (n: number): string => {
  const v = Math.round(n * 10) / 10;
  return (Object.is(v, -0) ? 0 : v).toString();
};

// ───────────── pigments ─────────────

function rgb(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hexOf(r: number, g: number, b: number): string {
  const h = (x: number) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}
export function mixc(a: string, b: string, t: number): string {
  const A = rgb(a), B = rgb(b);
  return hexOf(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}
/** The second tone of a wash: darker, a little warmer, never grey. */
export function shadeOf(c: string, t = 0.26): string {
  const [r, g, b] = rgb(c);
  const m = mixc(c, '#3b2216', t);
  const [mr, mg, mb] = rgb(m);
  // keep some of the hue's own saturation so shadows do not go muddy
  const lum = (r + g + b) / 3 || 1;
  const k = 0.12 * t / 0.26;
  return hexOf(mr + (r - lum) * k, mg + (g - lum) * k, mb + (b - lum) * k);
}
export function liteOf(c: string, t = 0.3): string { return mixc(c, '#fbf3dc', t); }
/** Nudge a pigment by a seed so no two cloaks are quite the same dye lot. */
export function dye(c: string, r: Rand, amt = 0.07): string {
  const [R, G, B] = rgb(c);
  const l = 1 + r.jit(amt);
  const w = r.jit(amt * 14);
  return hexOf(R * l + w, G * l, B * l - w);
}

// ───────────── curves ─────────────

/** Smooth path through points (Catmull-Rom as cubic Béziers). */
export function curve(pts: readonly Pt[], closed = false, tension = 1): string {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const at = (i: number): Pt => (closed ? pts[((i % n) + n) % n] : pts[clamp(i, 0, n - 1)]);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  const segs = closed ? n : n - 1;
  const k = tension / 6;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    d += `C${f(p1[0] + (p2[0] - p0[0]) * k)} ${f(p1[1] + (p2[1] - p0[1]) * k)} ${f(p2[0] - (p3[0] - p1[0]) * k)} ${f(p2[1] - (p3[1] - p1[1]) * k)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return closed ? d + 'Z' : d;
}
/** The same curve continued from wherever the pen is (no leading M). */
function curveOn(pts: readonly Pt[]): string {
  const d = curve(pts, false);
  const i = d.indexOf('C');
  return `L${f(pts[0][0])} ${f(pts[0][1])}` + (i >= 0 ? d.slice(i) : '');
}
export function poly(pts: readonly Pt[], closed = false): string {
  let d = '';
  for (let i = 0; i < pts.length; i++) d += (i ? 'L' : 'M') + f(pts[i][0]) + ' ' + f(pts[i][1]);
  return closed ? d + 'Z' : d;
}
/** Dense samples along the smooth curve through pts. */
export function sample(pts: readonly Pt[], closed = false, per = 4): Pt[] {
  const n = pts.length;
  if (n < 2) return pts.slice();
  const at = (i: number): Pt => (closed ? pts[((i % n) + n) % n] : pts[clamp(i, 0, n - 1)]);
  const out: Pt[] = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let j = 0; j < per; j++) {
      const t = j / per, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

export type Width = number | ((t: number, nx: number, ny: number) => number);
/**
 * A pen stroke as a filled ribbon, so the line can swell and taper the way a
 * quill does. `w` is the full width; as a function it gets t (0..1 along the
 * stroke) and the outward normal at that point.
 */
export function ribbon(pts: readonly Pt[], w: Width, closed = false): string {
  const n = pts.length;
  if (n < 2) return '';
  const L: Pt[] = [], R: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = closed ? pts[(i - 1 + n) % n] : pts[Math.max(0, i - 1)];
    const b = closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len; ty /= len;
    const nx = ty, ny = -tx;
    const t = closed ? i / n : i / (n - 1);
    const hw = (typeof w === 'number' ? w : w(t, nx, ny)) / 2;
    L.push([pts[i][0] + nx * hw, pts[i][1] + ny * hw]);
    R.push([pts[i][0] - nx * hw, pts[i][1] - ny * hw]);
  }
  if (closed) return curve(L, true) + curve(R.reverse(), true);
  return curve(L) + curveOn(R.reverse()) + 'Z';
}
/** Quill profiles for open strokes. */
export const taper = {
  both: (w: number) => (t: number) => w * (0.22 + 0.78 * Math.sin(Math.PI * clamp(t, 0, 1)) ** 0.7),
  /** heavy start, fine end */
  out: (w: number) => (t: number) => w * (1 - 0.82 * t ** 1.3),
  /** fine start, heavy end */
  in: (w: number) => (t: number) => w * (0.18 + 0.82 * t ** 1.3),
  /** closed outlines: heavier on the side away from the light (light is up and to the left) */
  loop: (w: number) => (_t: number, nx: number, ny: number) => w * (0.72 + 0.5 * Math.max(0, nx * 0.6 + ny * 0.8)),
};

export function wobble(pts: readonly Pt[], r: Rand, amp: number): Pt[] {
  return pts.map(p => [p[0] + r.jit(amp), p[1] + r.jit(amp)] as Pt);
}
export function mirror(pts: readonly Pt[], cx: number): Pt[] {
  return pts.map(p => [2 * cx - p[0], p[1]] as Pt);
}
export function shift(pts: readonly Pt[], dx: number, dy: number): Pt[] {
  return pts.map(p => [p[0] + dx, p[1] + dy] as Pt);
}
export function rot(pts: readonly Pt[], deg: number, ox: number, oy: number): Pt[] {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return pts.map(p => [ox + (p[0] - ox) * c - (p[1] - oy) * s, oy + (p[0] - ox) * s + (p[1] - oy) * c] as Pt);
}
export function scalePts(pts: readonly Pt[], k: number, ox: number, oy: number, ky = k): Pt[] {
  return pts.map(p => [ox + (p[0] - ox) * k, oy + (p[1] - oy) * ky] as Pt);
}
/** Points on an ellipse arc, angles in degrees (0 = east, 90 = south). */
export function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 8): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}
export function ellipse(cx: number, cy: number, rx: number, ry: number, n = 10): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}
