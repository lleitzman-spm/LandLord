/**
 * OWNER: ui-art agent. The scribe's pen: a seeded, hand-inked SVG renderer.
 *
 * Strokes are not SVG strokes. Each one is sampled, wobbled a little and
 * outlined as a filled shape whose width swells and thins like a broad nib
 * (full on the down-stroke, a hairline on the up-stroke, lifting at the
 * ends). Washes are fills laid slightly off the line, as a painter's colour
 * never quite meets the scribe's ink. Everything is deterministic from a seed,
 * so the same call always draws the same picture.
 *
 * Paths are authored in ordinary SVG path syntax (M L H V C S Q T Z, absolute
 * or relative); corners split a path into separate pen strokes that overlap
 * at the joint, the way a hand lifts the pen at a corner.
 */
export type P = [number, number];
type Mat = [number, number, number, number, number, number];

/** mulberry32: small, fast, good enough for drawing. */
export function rng(seed: number): () => number {
  let a = (seed >>> 0) ^ 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** FNV-1a string hash. */
export function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** murmur3's finaliser: every input bit moves every output bit. */
export function fmix(h: number): number {
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}
/** A well-stirred 32-bit seed from a caller's seed (any integer) and a salt. */
export function mix(seed: number, salt: string): number { return fmix(hash(salt) ^ fmix(((seed | 0) + 0x632be5) >>> 0)); }
/** One decimal, no trailing zero. */
export function n1(v: number): string { const r = Math.round(v * 10) / 10; return r === 0 ? '0' : String(r); }
export function n2(v: number): string { const r = Math.round(v * 100) / 100; return r === 0 ? '0' : String(r); }
export function pick<T>(r: () => number, arr: readonly T[]): T { return arr[Math.floor(r() * arr.length) % arr.length]!; }
export function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export interface PenStyle {
  /** base nib width, user units */
  w: number;
  /** nib angle, radians (strokes parallel to it are hairlines) */
  nibA: number;
  /** thinnest stroke as a fraction of w */
  nibMin: number;
  /** jitter applied to authored vertices */
  jit: number;
  /** low-frequency wobble amplitude along a stroke */
  wob: number;
  /** sampling step along curves */
  step: number;
  /** width fraction at the start / end of a free stroke (pen down / pen lift) */
  t0: number; t1: number;
  /** width noise fraction */
  noise: number;
  /** wash misregistration offset */
  shift: P;
  /** outline simplification tolerance */
  eps: number;
  /** decimals in output (1 or 2) */
  dp?: 1 | 2;
  /** longest outline chord kept by simplification, as a multiple of w (default 2.2) */
  chord?: number;
  /**
   * Strokes thinner than this (user units) are written as plain round-capped
   * SVG strokes along the wobbled centreline instead of nib outlines: the swell
   * is invisible at that weight and the markup is a tenth the size. Only out()
   * includes them, so leave it unset for anything read through parts().
   */
  hair?: number;
}

type Seg =
  | { k: 'L'; a: P; b: P }
  | { k: 'Q'; a: P; c: P; b: P }
  | { k: 'C'; a: P; c: P; d: P; b: P };
interface Sub { segs: Seg[]; closed: boolean }
interface Piece { pts: P[]; ta: number; tb: number }
interface Layer { fills: Map<string, string[]>; inks: Map<string, string[]>; hairs: Map<string, string[]>; raw: string[] }

const CORNER = 0.55;   // radians of tangent change that counts as a corner
const JOIN = 0.82;     // width fraction where strokes meet at a corner
const TOK = /[MmLlHhVvCcSsQqTtZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;

const dist = (a: P, b: P) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const ss = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };
function mul(A: Mat, B: Mat): Mat {
  return [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
}
function segLen(s: Seg): number {
  if (s.k === 'L') return dist(s.a, s.b);
  if (s.k === 'Q') return (dist(s.a, s.c) + dist(s.c, s.b) + dist(s.a, s.b)) / 2;
  return (dist(s.a, s.c) + dist(s.c, s.d) + dist(s.d, s.b) + dist(s.a, s.b)) / 2;
}
function segAt(s: Seg, t: number): P {
  const u = 1 - t;
  if (s.k === 'L') return [s.a[0] * u + s.b[0] * t, s.a[1] * u + s.b[1] * t];
  if (s.k === 'Q') return [u * u * s.a[0] + 2 * u * t * s.c[0] + t * t * s.b[0], u * u * s.a[1] + 2 * u * t * s.c[1] + t * t * s.b[1]];
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * s.a[0] + b * s.c[0] + c * s.d[0] + d * s.b[0], a * s.a[1] + b * s.c[1] + c * s.d[1] + d * s.b[1]];
}
function dir(a: P, b: P): P | null { const dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy); return l < 1e-6 ? null : [dx / l, dy / l]; }
function startTan(s: Seg): P {
  if (s.k === 'L') return dir(s.a, s.b) ?? [1, 0];
  if (s.k === 'Q') return dir(s.a, s.c) ?? dir(s.a, s.b) ?? [1, 0];
  return dir(s.a, s.c) ?? dir(s.a, s.d) ?? dir(s.a, s.b) ?? [1, 0];
}
function endTan(s: Seg): P {
  if (s.k === 'L') return dir(s.a, s.b) ?? [1, 0];
  if (s.k === 'Q') return dir(s.c, s.b) ?? dir(s.a, s.b) ?? [1, 0];
  return dir(s.d, s.b) ?? dir(s.c, s.b) ?? dir(s.a, s.b) ?? [1, 0];
}
function turn(a: P, b: P): number { return Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1]))); }
function tangents(p: P[]): P[] {
  const n = p.length, out: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = p[Math.max(0, i - 1)]!, b = p[Math.min(n - 1, i + 1)]!;
    out.push(dir(a, b) ?? (out.length ? out[out.length - 1]! : [1, 0]));
  }
  return out;
}
function area(p: P[]): number { let s = 0; for (let i = 0, n = p.length; i < n; i++) { const a = p[i]!, b = p[(i + 1) % n]!; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
function simplify(p: P[], eps: number, maxChord: number): P[] {
  if (p.length < 4 || eps <= 0) return p;
  const keep = new Uint8Array(p.length); keep[0] = 1; keep[p.length - 1] = 1;
  const stack: [number, number][] = [[0, p.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const A = p[a]!, B = p[b]!, dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy);
    let md = -1, mi = -1;
    for (let i = a + 1; i < b; i++) {
      const q = p[i]!;
      const d = L < 1e-9 ? Math.hypot(q[0] - A[0], q[1] - A[1]) : Math.abs((q[0] - A[0]) * dy - (q[1] - A[1]) * dx) / L;
      if (d > md) { md = d; mi = i; }
    }
    if (mi > 0 && (md > eps || L > maxChord)) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  return p.filter((_, i) => keep[i]);
}
/**
 * Writes compact path data: absolute move, then relative segments, all in
 * integer steps of 1/scale so relative coordinates never drift.
 */
class PathWriter {
  private s = '';
  private last = '';
  private cx = 0; private cy = 0;
  private cmd = '';
  constructor(private k: number) {}
  private num(i: number): string {
    if (i === 0) return '0';
    const neg = i < 0, a = Math.abs(i), k = this.k;
    const ip = Math.floor(a / k), fp = a % k;
    let t = ip ? String(ip) : '';
    if (fp) { let f = String(fp).padStart(k === 100 ? 2 : 1, '0'); if (k === 100) f = f.replace(/0$/, ''); t += '.' + f; }
    return (neg ? '-' : '') + t;
  }
  private push(t: string): void {
    const sep = this.last && !(t[0] === '-' || (t[0] === '.' && this.last.includes('.')) || /[a-zA-Z]$/.test(this.last)) ? ' ' : '';
    this.s += sep + t; this.last = t;
  }
  private c(letter: string): void { if (this.cmd !== letter) { this.s += letter; this.last = letter; this.cmd = letter; } }
  private rel(p: P): [number, number] { const x = Math.round(p[0] * this.k), y = Math.round(p[1] * this.k); const d: [number, number] = [x - this.cx, y - this.cy]; this.cx = x; this.cy = y; return d; }
  move(p: P): void { this.cx = Math.round(p[0] * this.k); this.cy = Math.round(p[1] * this.k); this.c('M'); this.push(this.num(this.cx)); this.push(this.num(this.cy)); this.cmd = 'M'; }
  line(p: P): void { const [dx, dy] = this.rel(p); if (!dx && !dy) return; this.c('l'); this.push(this.num(dx)); this.push(this.num(dy)); }
  quad(c: P, e: P): void {
    const x0 = this.cx, y0 = this.cy;
    const cx = Math.round(c[0] * this.k) - x0, cy = Math.round(c[1] * this.k) - y0;
    const [dx, dy] = this.rel(e);
    this.c('q'); this.push(this.num(cx)); this.push(this.num(cy)); this.push(this.num(dx)); this.push(this.num(dy));
  }
  close(): string { return this.s + 'z'; }
  open(): string { return this.s; }
}

function dedupe(p: P[]): P[] { const out: P[] = []; for (const q of p) { const l = out[out.length - 1]; if (!l || Math.abs(l[0] - q[0]) + Math.abs(l[1] - q[1]) > 1e-4) out.push(q); } return out; }

export class Pen {
  readonly layers: Layer[] = [];
  /** ink colour for strokes and solids */
  color = 'currentColor';
  /** width scale (scoped by at({ws})) */
  ws = 1;
  private m: Mat = [1, 0, 0, 1, 0, 0];
  constructor(readonly r: () => number, readonly st: PenStyle) { this.layer(); }

  // ───────── structure ─────────
  layer(): this { this.layers.push({ fills: new Map(), inks: new Map(), hairs: new Map(), raw: [] }); return this; }
  private get L(): Layer { return this.layers[this.layers.length - 1]!; }
  /** Raw SVG markup in the current layer (drawn after its ink). */
  raw(svg: string): this { this.L.raw.push(svg); return this; }
  ink(color: string, fn: () => void): this { const c0 = this.color; this.color = color; fn(); this.color = c0; return this; }

  /** Draw in a local frame: translate(x,y) rotate(r deg) scale(s, flip) skewX(kx). */
  at(o: { x?: number; y?: number; r?: number; s?: number; sx?: number; sy?: number; flip?: boolean; kx?: number; ws?: number }, fn: () => void): this {
    const m0 = this.m, ws0 = this.ws;
    const a = (o.r ?? 0) * DEG, c = Math.cos(a), s = Math.sin(a), k = o.s ?? 1;
    const sx = k * (o.sx ?? 1) * (o.flip ? -1 : 1), sy = k * (o.sy ?? 1), kx = o.kx ?? 0;
    // T · R · S · K
    const RS: Mat = [c * sx, s * sx, -s * sy, c * sy, o.x ?? 0, o.y ?? 0];
    this.m = mul(m0, mul(RS, [1, 0, kx, 1, 0, 0]));
    if (o.ws !== undefined) this.ws = ws0 * o.ws;
    try { fn(); } finally { this.m = m0; this.ws = ws0; }
    return this;
  }
  /** Same as at(), but about a pivot point given in the current frame. */
  around(cx: number, cy: number, o: { r?: number; s?: number; sx?: number; sy?: number; flip?: boolean; kx?: number; dx?: number; dy?: number; ws?: number }, fn: () => void): this {
    return this.at({ x: cx + (o.dx ?? 0), y: cy + (o.dy ?? 0) }, () => this.at({ ...o, x: 0, y: 0 }, () => this.at({ x: -cx, y: -cy }, fn)));
  }
  T(x: number, y: number): P { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  private J(x: number, y: number, j: number): P { const r = this.r; return this.T(x + (r() - 0.5) * 2 * j, y + (r() - 0.5) * 2 * j); }

  // ───────── parsing ─────────
  parse(d: string, jit = this.st.jit): Sub[] {
    const t = d.match(TOK) ?? [];
    const subs: Sub[] = [];
    let i = 0, cmd = 'M', sub = null as Sub | null;
    let cx = 0, cy = 0, sx = 0, sy = 0;           // raw current and subpath start
    let cm: P = [0, 0], sm: P = [0, 0];           // mapped current and start
    let lc: P | null = null, lk = '';             // last control (raw) for S/T
    const isNum = (k: number) => k < t.length && !/^[a-zA-Z]$/.test(t[k]!);
    const num = () => parseFloat(t[i++]!);
    const map = (x: number, y: number) => this.J(x, y, jit);
    const ensure = () => { if (!sub) { sub = { segs: [], closed: false }; subs.push(sub); sm = cm; sx = cx; sy = cy; } return sub; };
    while (i < t.length) {
      if (!isNum(i)) {
        cmd = t[i++]!;
        if (cmd === 'Z' || cmd === 'z') {
          if (sub) { const s: Sub = sub; if (dist(cm, sm) > 1e-6) s.segs.push({ k: 'L', a: cm, b: sm }); s.closed = true; }
          cx = sx; cy = sy; cm = sm; sub = null; lc = null; continue;
        }
      }
      if (!isNum(i)) { i++; continue; }
      const rel = cmd >= 'a' && cmd <= 'z', C = cmd.toUpperCase(), ox = rel ? cx : 0, oy = rel ? cy : 0;
      if (C === 'M') {
        cx = sx = num() + ox; cy = sy = num() + oy; cm = sm = map(cx, cy);
        sub = { segs: [], closed: false }; subs.push(sub); cmd = rel ? 'l' : 'L'; lc = null; continue;
      }
      const s = ensure();
      if (C === 'L' || C === 'H' || C === 'V') {
        const x = C === 'V' ? cx : num() + ox, y = C === 'H' ? cy : num() + oy;
        const b = map(x, y); s.segs.push({ k: 'L', a: cm, b }); cx = x; cy = y; cm = b; lc = null; lk = 'L';
      } else if (C === 'C' || C === 'S') {
        let c1: P;
        if (C === 'C') { const x = num() + ox, y = num() + oy; c1 = [x, y]; }
        else c1 = lc && (lk === 'C') ? [2 * cx - lc[0], 2 * cy - lc[1]] : [cx, cy];
        const x2 = num() + ox, y2 = num() + oy, x = num() + ox, y = num() + oy;
        const c = map(c1[0], c1[1]), dd = map(x2, y2), b = map(x, y);
        s.segs.push({ k: 'C', a: cm, c, d: dd, b }); lc = [x2, y2]; lk = 'C'; cx = x; cy = y; cm = b;
      } else if (C === 'Q' || C === 'T') {
        let q: P;
        if (C === 'Q') { const x = num() + ox, y = num() + oy; q = [x, y]; }
        else q = lc && lk === 'Q' ? [2 * cx - lc[0], 2 * cy - lc[1]] : [cx, cy];
        const x = num() + ox, y = num() + oy;
        const c = map(q[0], q[1]), b = map(x, y);
        s.segs.push({ k: 'Q', a: cm, c, b }); lc = q; lk = 'Q'; cx = x; cy = y; cm = b;
      } else { i++; }
    }
    return subs.filter(s => s.segs.length);
  }

  private sample(segs: Seg[], step = this.st.step): P[] {
    const pts: P[] = [segs[0]!.a];
    for (const s of segs) {
      const n = Math.max(1, Math.ceil(segLen(s) / step));
      for (let j = 1; j <= n; j++) pts.push(segAt(s, j / n));
    }
    return dedupe(pts);
  }

  /** Split a subpath into pen strokes at its corners. */
  private pieces(sub: Sub, t0: number, t1: number): Piece[] {
    const segs = sub.segs, n = segs.length, out: Piece[] = [];
    const corner: boolean[] = [];
    for (let k = 0; k < n; k++) {
      if (!sub.closed && k === n - 1) { corner.push(true); continue; }
      corner.push(turn(endTan(segs[k]!), startTan(segs[(k + 1) % n]!)) > CORNER);
    }
    if (!sub.closed) {
      let s0 = 0;
      for (let k = 0; k < n; k++) if (corner[k]) { out.push({ pts: this.sample(segs.slice(s0, k + 1)), ta: s0 === 0 ? t0 : JOIN, tb: k === n - 1 ? t1 : JOIN }); s0 = k + 1; }
      return out;
    }
    const first = corner.indexOf(true);
    if (first < 0) {
      // a smooth loop: start anywhere and overlap the start a little
      const pts = this.sample(segs);
      const ext: P[] = [...pts];
      let acc = 0;
      for (let k = 1; k < pts.length && acc < this.st.w * 2.2; k++) { acc += dist(pts[k - 1]!, pts[k]!); ext.push(pts[k]!); }
      out.push({ pts: ext, ta: 0.6, tb: 0.45 });
      return out;
    }
    const rot = segs.slice(first + 1).concat(segs.slice(0, first + 1));
    const crot = corner.slice(first + 1).concat(corner.slice(0, first + 1));
    let s0 = 0;
    for (let k = 0; k < n; k++) if (crot[k]) { out.push({ pts: this.sample(rot.slice(s0, k + 1)), ta: JOIN, tb: JOIN }); s0 = k + 1; }
    return out;
  }

  // ───────── pen strokes ─────────
  private wobble(pts: P[]): { q: P[]; cum: number[] } {
    const r = this.r, n = pts.length, cum = [0];
    for (let k = 1; k < n; k++) cum.push(cum[k - 1]! + dist(pts[k - 1]!, pts[k]!));
    const A = this.st.wob * this.ws, ph1 = r() * TAU, ph2 = r() * TAU, k1 = 0.22 + r() * 0.22, k2 = 0.7 + r() * 0.5;
    if (A <= 0) return { q: pts, cum };
    const tn = tangents(pts);
    const q = pts.map((p, k): P => { const o = A * (0.65 * Math.sin(cum[k]! * k1 + ph1) + 0.35 * Math.sin(cum[k]! * k2 + ph2)); return [p[0] - tn[k]![1] * o, p[1] + tn[k]![0] * o]; });
    return { q, cum };
  }

  private outline(q: P[], cum: number[], w: number, ta: number, tb: number, ph: [number, number]): P[] {
    const st = this.st, n = q.length, L = cum[n - 1]!;
    const tn = tangents(q);
    const ra = Math.min(L * 0.45, w * 2.2), rb = Math.min(L * 0.45, w * 2.2);
    const left: P[] = [], right: P[] = [], hw: number[] = [];
    for (let k = 0; k < n; k++) {
      const s = cum[k]!;
      let f = 1;
      if (s < ra) f *= ta + (1 - ta) * ss(s / ra);
      if (L - s < rb) f *= tb + (1 - tb) * ss((L - s) / rb);
      const t = tn[k]!, phi = Math.atan2(t[1], t[0]);
      const nib = st.nibMin + (1 - st.nibMin) * Math.abs(Math.sin(phi - st.nibA));
      const nz = 1 + st.noise * (0.6 * Math.sin(s * 0.9 + ph[0]) + 0.4 * Math.sin(s * 2.3 + ph[1]));
      const h = 0.5 * w * f * nib * nz;
      hw.push(h);
      const p = q[k]!;
      left.push([p[0] - t[1] * h, p[1] + t[0] * h]);
      right.push([p[0] + t[1] * h, p[1] - t[0] * h]);
    }
    const poly: P[] = [...left];
    { const p = q[n - 1]!, t = tn[n - 1]!, h = hw[n - 1]!, nx = -t[1], ny = t[0];
      for (let k = 1; k <= 3; k++) { const a = k * Math.PI / 4, c = Math.cos(a), s = Math.sin(a); poly.push([p[0] + h * (nx * c + t[0] * s), p[1] + h * (ny * c + t[1] * s)]); } }
    for (let k = n - 1; k >= 0; k--) poly.push(right[k]!);
    { const p = q[0]!, t = tn[0]!, h = hw[0]!, nx = -t[1], ny = t[0];
      for (let k = 1; k <= 3; k++) { const a = k * Math.PI / 4, c = Math.cos(a), s = Math.sin(a); poly.push([p[0] - h * (nx * c + t[0] * s), p[1] - h * (ny * c + t[1] * s)]); } }
    return poly;
  }

  /** Stroke an already-sampled polyline (screen space) with the nib. */
  private nib(pts0: P[], w: number, ta: number, tb: number, colors: [string, number][] | null = null): void {
    const pts = dedupe(pts0);
    if (pts.length < 2) { if (pts.length) this.blob(pts[0]!, w * 0.5); return; }
    const { q, cum } = this.wobble(pts);
    const L = cum[cum.length - 1]!;
    if (L < w * 0.35) { this.blob(q[Math.floor(q.length / 2)]!, w * 0.5); return; }
    const r = this.r, wv = w * (0.93 + r() * 0.14), ph: [number, number] = [r() * TAU, r() * TAU];
    if (!colors && this.st.hair && wv < this.st.hair) { this.pushHair(q, wv * (0.5 * (1 + this.st.nibMin)) * 1.08, this.color); return; }
    if (!colors) { this.pushInk(this.outline(q, cum, wv, ta, tb, ph), this.color); return; }
    for (const [c, f] of colors) this.pushInk(this.outline(q, cum, wv * f, ta, tb, ph), c);
  }

  private blob(p: P, rad: number, color = this.color): void {
    const r = this.r, n = Math.max(7, Math.round(rad * 7)), a0 = r() * TAU, poly: P[] = [];
    for (let k = 0; k < n; k++) { const a = a0 + k / n * TAU, rr = rad * (1 + (r() - 0.5) * 0.16); poly.push([p[0] + Math.cos(a) * rr, p[1] + Math.sin(a) * rr]); }
    this.pushInk(poly, color);
  }

  private smoothD(p0: P[]): string {
    let p = area(p0) < 0 ? [...p0].reverse() : p0;
    p = simplify(p, this.st.eps, this.st.w * (this.st.chord ?? 2.2));
    const n = p.length; if (n < 3) return '';
    const mid = (k: number): P => { const a = p[k % n]!, b = p[(k + 1) % n]!; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
    const w = new PathWriter(this.st.dp === 2 ? 100 : 10);
    w.move(mid(n - 1));
    for (let k = 0; k < n; k++) w.quad(p[k]!, mid(k));
    return w.close();
  }
  private polyD(p0: P[]): string {
    let p = area(p0) < 0 ? [...p0].reverse() : p0;
    p = simplify(p, this.st.eps * 0.8, this.st.w * (this.st.chord ?? 2.2) * 1.36);
    if (p.length < 3) return '';
    const w = new PathWriter(this.st.dp === 2 ? 100 : 10);
    w.move(p[0]!);
    for (let k = 1; k < p.length; k++) w.line(p[k]!);
    return w.close();
  }
  private pushInk(poly: P[], color: string): void {
    const d = this.smoothD(poly); if (!d) return;
    const g = this.L.inks.get(color); if (g) g.push(d); else this.L.inks.set(color, [d]);
  }
  private pushHair(q: P[], w: number, color: string): void {
    const p = simplify(q, this.st.eps * 0.9, this.st.w * (this.st.chord ?? 2.2) * 1.4);
    if (p.length < 2) return;
    const wr = Math.max(0.1, Math.round(w * 20) / 20);
    const pw = new PathWriter(this.st.dp === 2 ? 100 : 10);
    pw.move(p[0]!);
    if (p.length === 2) pw.line(p[1]!);
    else {
      for (let k = 1; k < p.length - 1; k++) { const a = p[k]!, b = p[k + 1]!; pw.quad(a, k === p.length - 2 ? b : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); }
    }
    const d = pw.open(), key = `${color}|${wr}`;
    const g = this.L.hairs.get(key); if (g) g.push(d); else this.L.hairs.set(key, [d]);
  }
  private pushFill(d: string, key: string): void {
    if (!d) return;
    const g = this.L.fills.get(key); if (g) g.push(d); else this.L.fills.set(key, [d]);
  }

  // ───────── public drawing API ─────────
  /** Ink a path. `wm` multiplies the nib width. */
  s(d: string, wm = 1, o: { t0?: number; t1?: number } = {}): this {
    const w = this.st.w * wm * this.ws;
    for (const sub of this.parse(d)) for (const pc of this.pieces(sub, o.t0 ?? this.st.t0, o.t1 ?? this.st.t1)) this.nib(pc.pts, w, pc.ta, pc.tb);
    return this;
  }
  /** Ink a path twice from the same hand: an outer stroke and an inner one on top (outlined bands). */
  dual(d: string, w: number, inner: string, innerFrac = 0.6, outer = this.color): this {
    const ww = w * this.ws;
    for (const sub of this.parse(d)) for (const pc of this.pieces(sub, 0.9, 0.9)) this.nib(pc.pts, ww, pc.ta, pc.tb, [[outer, 1], [inner, innerFrac]]);
    return this;
  }
  /** Ink an explicit point list (already in local units). */
  line(pts: P[], wm = 1, ta = this.st.t0, tb = this.st.t1): this {
    this.nib(pts.map(p => this.T(p[0], p[1])), this.st.w * wm * this.ws, ta, tb);
    return this;
  }
  /** Ink an ellipse (rot in degrees), drawn as one looping stroke that overlaps itself. */
  e(cx: number, cy: number, rx: number, ry: number, rot = 0, wm = 1, sweep = 1): this {
    const r = this.r, a0 = r() * TAU, ph = r() * TAU, c = Math.cos(rot * DEG), s = Math.sin(rot * DEG);
    const ext = sweep >= 1 ? 0.45 : 0, tot = sweep * TAU + ext, n = Math.max(10, Math.ceil(tot * Math.max(rx, ry) / this.st.step));
    const j = this.st.jit * 0.5, ox = (r() - 0.5) * j, oy = (r() - 0.5) * j, pts: P[] = [];
    for (let k = 0; k <= n; k++) {
      const a = a0 + tot * k / n, f = 1 + 0.035 * Math.sin(2 * a + ph);
      const x = Math.cos(a) * rx * f, y = Math.sin(a) * ry * f;
      pts.push(this.T(cx + ox + x * c - y * s, cy + oy + x * s + y * c));
    }
    this.nib(pts, this.st.w * wm * this.ws, sweep >= 1 ? 0.55 : this.st.t0, sweep >= 1 ? 0.4 : this.st.t1);
    return this;
  }
  o(cx: number, cy: number, rad: number, wm = 1): this { return this.e(cx, cy, rad, rad, 0, wm); }
  /** Ink an arc of a circle, angles in degrees (0 = +x, clockwise on screen). */
  arc(cx: number, cy: number, rad: number, a0: number, a1: number, wm = 1): this {
    const n = Math.max(4, Math.ceil(Math.abs(a1 - a0) * DEG * rad / this.st.step)), pts: P[] = [];
    for (let k = 0; k <= n; k++) { const a = (a0 + (a1 - a0) * k / n) * DEG; pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); }
    return this.line(pts, wm);
  }
  /** Ink a spiral from radius r0 to r1 over `turns`, starting at angle a0 (deg); dirn 1 = clockwise. */
  spiral(cx: number, cy: number, r0: number, r1: number, turns: number, a0 = 0, wm = 1, dirn = 1): this {
    const tot = turns * TAU, n = Math.max(12, Math.ceil(tot * Math.max(r0, r1) / this.st.step)), pts: P[] = [];
    for (let k = 0; k <= n; k++) { const t = k / n, a = a0 * DEG + dirn * tot * t, rr = r0 + (r1 - r0) * Math.pow(t, 0.85); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
    return this.line(pts, wm, 0.7, 0.35);
  }
  /** A filled ink dot. */
  dot(x: number, y: number, rad: number, color = this.color): this {
    const p = this.J(x, y, this.st.jit * 0.3), sc = Math.sqrt(Math.abs(this.m[0] * this.m[3] - this.m[1] * this.m[2]));
    this.blob(p, rad * sc, color);
    return this;
  }
  /** Solid fill in the ink colour (merged with the ink, so it reads as one hand). */
  solid(d: string, color = this.color): this {
    for (const sub of this.parse(d, this.st.jit * 0.6)) { const pts = this.sample(sub.segs); if (pts.length > 2) this.pushInkPoly(pts, color); }
    return this;
  }
  private pushInkPoly(pts: P[], color: string): void {
    const d = this.polyD(pts); if (!d) return;
    const g = this.L.inks.get(color); if (g) g.push(d); else this.L.inks.set(color, [d]);
  }
  /** Solid ellipse in the ink colour. */
  solidE(cx: number, cy: number, rx: number, ry: number, rot = 0, color = this.color): this {
    this.pushInkPoly(this.ellPts(cx, cy, rx, ry, rot, 0.3, false), color);
    return this;
  }
  private ellPts(cx: number, cy: number, rx: number, ry: number, rot: number, wob: number, shift: boolean): P[] {
    const r = this.r, c = Math.cos(rot * DEG), s = Math.sin(rot * DEG), n = Math.max(12, Math.ceil(TAU * Math.max(rx, ry) / this.st.step)), pts: P[] = [];
    const ph = r() * TAU, k = 2 + Math.floor(r() * 2);
    for (let q = 0; q < n; q++) {
      const a = q / n * TAU, f = 1 + wob * 0.06 * Math.sin(k * a + ph);
      const x = Math.cos(a) * rx * f, y = Math.sin(a) * ry * f;
      const p = this.T(cx + x * c - y * s, cy + x * s + y * c);
      pts.push(shift ? [p[0] + this.st.shift[0], p[1] + this.st.shift[1]] : p);
    }
    return pts;
  }
  /** A colour wash: a fill laid a little off the line. `rim` darkens the edge like watercolour. */
  wash(d: string, color = this.color, op = 0.22, rim = 0): this {
    const key = `${color}|${op}|${rim}`;
    for (const sub of this.parse(d, this.st.jit * 0.7)) {
      let pts = this.sample(sub.segs, this.st.step * 1.6);
      if (pts.length < 3) continue;
      const { q } = this.wobble(pts);
      pts = q.map(p => [p[0] + this.st.shift[0], p[1] + this.st.shift[1]] as P);
      this.pushFill(this.polyD(pts), key);
    }
    return this;
  }
  washE(cx: number, cy: number, rx: number, ry: number, rot = 0, color = this.color, op = 0.22, rim = 0): this {
    this.pushFill(this.polyD(this.ellPts(cx, cy, rx, ry, rot, 1, true)), `${color}|${op}|${rim}`);
    return this;
  }
  /** A shape filled in `fill` and outlined in ink from the same geometry (heraldic charges, coins). */
  shape(d: string, fill: string, wm = 1, op = 1): this {
    const key = `${fill}|${op}|0`, w = this.st.w * wm * this.ws;
    for (const sub of this.parse(d)) {
      const all = this.sample(sub.segs);
      if (sub.closed && all.length > 2) this.pushFill(this.polyD(all), key);
      if (wm > 0) for (const pc of this.pieces(sub, this.st.t0, this.st.t1)) this.nib(pc.pts, w, pc.ta, pc.tb);
    }
    return this;
  }
  shapeE(cx: number, cy: number, rx: number, ry: number, rot: number, fill: string, wm = 1, op = 1): this {
    this.pushFill(this.polyD(this.ellPts(cx, cy, rx, ry, rot, 0.3, false)), `${fill}|${op}|0`);
    if (wm > 0) this.e(cx, cy, rx, ry, rot, wm);
    return this;
  }

  // ───────── output ─────────
  /** All layers as SVG markup (fills under ink, layer by layer). */
  out(): string {
    let s = '';
    for (const L of this.layers) {
      for (const [key, ds] of L.fills) {
        const [color, op, rim] = key.split('|');
        const o = Number(op), rm = Number(rim);
        s += `<path d="${ds.join('')}" fill="${color}"${o < 1 ? ` fill-opacity="${op}"` : ''}${rm > 0 ? ` stroke="${color}" stroke-opacity="${Math.min(1, o * 0.9).toFixed(2)}" stroke-width="${rim}" stroke-linejoin="round"` : ''}/>`;
      }
      for (const [color, ds] of L.inks) s += `<path d="${ds.join('')}" fill="${color}"/>`;
      for (const [key, ds] of L.hairs) { const [color, w] = key.split('|'); s += `<path d="${ds.join('')}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`; }
      s += L.raw.join('');
    }
    return s;
  }
  /** The first layer's wash and ink as bare path data (icons and seals). */
  parts(): { wash: string; ink: string } {
    const L = this.layers[0]!;
    let wash = '', ink = '';
    for (const ds of L.fills.values()) wash += ds.join('');
    for (const ds of L.inks.values()) ink += ds.join('');
    return { wash, ink };
  }
}

/** Escape text for SVG/HTML. */
export function escXml(s: string): string { return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)); }

/** An SVG string as a CSS url() value. */
export function svgUrl(svg: string): string { return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`; }
