/**
 * OWNER: ui-art agent. The scriptorium's paint box and small stock motifs
 * shared by the marginalia: pigments, a twisting banderole, coins, notes,
 * sleep, grass, and a seeded vine. All drawn through the Pen.
 */
import { Pen, type P, type PenStyle, TAU, n1 } from './ink';

/** Pigments: period-ish and a little muted, to sit on vellum. */
export const C = {
  ink: '#2a1d14', ink2: '#5a4633',
  rubric: '#a3302a', rubricD: '#7c1f1b',
  lapis: '#2f5596', lapisL: '#6787c2',
  verd: '#4f7a5a', green: '#6f9348',
  gold: '#c9a227', goldL: '#e8c860', goldD: '#8a6a14',
  ochre: '#c27a2e', brown: '#8a5a32', wood: '#a5773f',
  rose: '#d38b7b', flesh: '#c4a888', grey: '#8b8780', steel: '#98a1aa',
  white: '#fbf4e2', parch: '#efe3c4',
} as const;

/** The marginal hand: looser than the icon pen, more swell, more wobble. */
export const DOODLE_PEN: PenStyle = { w: 1.55, nibA: -0.72, nibMin: 0.4, jit: 0.28, wob: 0.22, step: 1.4, t0: 0.32, t1: 0.22, noise: 0.12, shift: [0.85, 0.75], eps: 0.16, chord: 6, hair: 1.1 };

/** Catmull-Rom through points, sampled to roughly `step` units. */
export function curve(pts: P[], step = 1.2): P[] {
  const out: P[] = [];
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[Math.min(n - 1, i + 2)]!;
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const k = Math.max(2, Math.ceil(len / step));
    for (let j = 0; j < k; j++) {
      const t = j / k, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[n - 1]!);
  return out;
}

/** Mix a #rrggbb pigment toward vellum by t (0 = pure pigment). */
export function tint(hex: string, t: number, base: string = C.parch): string {
  const a = parseInt(hex.slice(1), 16), b = parseInt(base.slice(1), 16);
  const ch = (v: number, s: number) => (v >> s) & 255;
  const m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return '#' + ((m(16) << 16) | (m(8) << 8) | m(0)).toString(16).padStart(6, '0');
}

export const dpath = (pts: P[]) => 'M' + pts.map(q => `${n1(q[0])} ${n1(q[1])}`).join('L') + 'Z';

/**
 * A banderole: a strip of paper or cloth following `pts`, with signed width
 * `w(t)` (t from 0 to 1). Where the width changes sign the strip twists and
 * shows its back, washed darker. Edges are inked; ends are cut square.
 */
export function ribbon(p: Pen, pts: P[], w: (t: number) => number, front: string, back: string, o: { op?: number; wm?: number; ends?: boolean } = {}): { left: P[]; right: P[]; mid: P[]; ws: number[] } {
  const c = curve(pts, 1);
  const n = c.length, cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1]! + Math.hypot(c[i]![0] - c[i - 1]![0], c[i]![1] - c[i - 1]![1]));
  const L = cum[n - 1]!;
  const left: P[] = [], right: P[] = [], ws: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = c[Math.max(0, i - 1)]!, b = c[Math.min(n - 1, i + 1)]!;
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l, hw = w(cum[i]! / L) / 2;
    ws.push(hw);
    left.push([c[i]![0] + nx * hw, c[i]![1] + ny * hw]);
    right.push([c[i]![0] - nx * hw, c[i]![1] - ny * hw]);
  }
  const op = o.op ?? 0.55, wm = o.wm ?? 0.8;
  // washes, one per run of constant sign
  let s0 = 0;
  for (let i = 1; i <= n; i++) {
    if (i === n || Math.sign(ws[i]!) !== Math.sign(ws[s0]!) && Math.abs(ws[i]!) > 1e-6) {
      const run = left.slice(s0, i).concat(right.slice(s0, i).reverse());
      if (run.length > 3) p.wash(dpath(run), ws[s0]! >= 0 ? front : back, op);
      s0 = i;
    }
  }
  p.line(left, wm, 0.8, 0.8);
  p.line(right, wm, 0.8, 0.8);
  if (o.ends !== false) { p.line([left[0]!, right[0]!], wm * 0.9, 0.8, 0.8); p.line([left[n - 1]!, right[n - 1]!], wm * 0.9, 0.8, 0.8); }
  return { left, right, mid: c, ws };
}

/** A small coin lying or standing: gold wash with an inked rim. */
export function coin(p: Pen, x: number, y: number, rx: number, ry: number, rot = 0, wm = 0.6): void {
  p.shapeE(x, y, rx, ry, rot, C.gold, wm, 0.9);
  if (rx > 2.2 && ry > 1.2) p.e(x, y, rx * 0.6, ry * 0.6, rot, wm * 0.45, 0.62);
}

/** A crowned head in profile, facing left, for coins (local 24-unit frame centred on 12,12). */
export function crownedHead(p: Pen, color: string): void {
  p.solid('M14 14.3C14.8 13.4 14.9 11.8 14.1 10.9C13.2 10.1 11.5 10.1 10.8 10.9C10.3 11.5 10.4 12 10.1 12.5L9.5 13.2L10.1 13.5L10 14.1C10.5 14.6 11.1 14.6 11.5 14.8L11.4 15.6Z', color);
  p.solid('M9.3 17.3C10 16.2 11.1 15.8 12.3 15.8C13.6 15.8 14.6 16.2 15.2 17.3C13.3 17.9 11.1 17.9 9.3 17.3Z', color);
  p.ink(color, () => p.s('M10.7 10.5L10.6 8.4L11.6 9.4L12.4 7.9L13.2 9.4L14.1 8.5L14.1 10.6', 0.45));
}

/** A music note. */
export function note(p: Pen, x: number, y: number, s = 1, flag = true): void {
  p.solidE(x, y, 1.9 * s, 1.35 * s, -22);
  p.s(`M${x + 1.7 * s} ${y - 0.4 * s}L${x + 1.9 * s} ${y - 7.4 * s}`, 0.5);
  if (flag) p.s(`M${x + 1.9 * s} ${y - 7.4 * s}C${x + 3.6 * s} ${y - 6 * s} ${x + 5 * s} ${y - 5.2 * s} ${x + 4.4 * s} ${y - 2.8 * s}`, 0.42);
}

/** Three sleepy Zs climbing to the right. */
export function zzz(p: Pen, x: number, y: number, s = 1): void {
  for (let i = 0; i < 3; i++) {
    const k = s * (1 - i * 0.2), xx = x + i * s * 5.2, yy = y - i * s * 6.4;
    p.s(`M${xx} ${yy}L${xx + 4.2 * k} ${yy}L${xx} ${yy + 4.2 * k}L${xx + 4.2 * k} ${yy + 4.2 * k}`, 0.52);
  }
}

/** A tuft of grass rooted at x,y. */
export function tuft(p: Pen, x: number, y: number, s = 1): void {
  p.s(`M${x} ${y}C${x - 0.6 * s} ${y - 2.4 * s} ${x - 1.8 * s} ${y - 3.6 * s} ${x - 2.8 * s} ${y - 4.2 * s}`, 0.42);
  p.s(`M${x + 0.4 * s} ${y}C${x + 0.4 * s} ${y - 2.8 * s} ${x + 0.8 * s} ${y - 4.4 * s} ${x + 1.4 * s} ${y - 5.4 * s}`, 0.42);
  p.s(`M${x + 0.8 * s} ${y}C${x + 1.6 * s} ${y - 1.8 * s} ${x + 2.8 * s} ${y - 2.8 * s} ${x + 3.8 * s} ${y - 3.2 * s}`, 0.42);
}

/** A loose, broken ground line. */
export function ground(p: Pen, r: () => number, x0: number, x1: number, y: number): void {
  let x = x0;
  while (x < x1 - 3) {
    const xe = Math.min(x1, x + 9 + r() * 16);
    p.s(`M${n1(x)} ${n1(y + (r() - 0.5) * 0.8)}L${n1(xe)} ${n1(y + (r() - 0.5) * 0.8)}`, 0.48);
    x = xe + 2 + r() * 5;
  }
}

/** A drop of sweat flung from a brow, pointing along angle a (deg). */
export function sweat(p: Pen, x: number, y: number, a: number, s = 1): void {
  p.around(x, y, { r: a, s }, () => {
    const d = `M${x - 2.6} ${y}C${x - 0.6} ${y - 1.6} ${x + 1.8} ${y - 1.5} ${x + 1.8} ${y}C${x + 1.8} ${y + 1.5} ${x - 0.6} ${y + 1.6} ${x - 2.6} ${y}Z`;
    p.wash(d, C.lapisL, 0.6);
    p.s(d, 0.4);
  });
}

/** Little motion or sound lines fanning out from a point. */
export function burst(p: Pen, x: number, y: number, a0: number, a1: number, n: number, r0: number, r1: number, wm = 0.45): void {
  for (let i = 0; i < n; i++) {
    const a = (a0 + (a1 - a0) * (n === 1 ? 0.5 : i / (n - 1))) * Math.PI / 180;
    p.s(`M${n1(x + Math.cos(a) * r0)} ${n1(y + Math.sin(a) * r0)}L${n1(x + Math.cos(a) * r1)} ${n1(y + Math.sin(a) * r1)}`, wm);
  }
}

/** An ivy leaf (three lobes) at x,y pointing along angle a (deg), length s. */
export function ivy(p: Pen, x: number, y: number, a: number, s: number, fill: string, op = 0.7, wm = 0.6): void {
  p.at({ x, y, r: a, s: s / 10 }, () => {
    const d = 'M0 0C1.4 -1.6 3 -3.4 4.4 -3.2C5 -4.8 7.4 -5 8 -3.4C9.4 -3 10.6 -1.4 10 0C10.6 1.4 9.4 3 8 3.4C7.4 5 5 4.8 4.4 3.2C3 3.4 1.4 1.6 0 0Z';
    p.wash(d, fill, op);
    p.s(d, wm);
    p.s('M0.6 0L7.6 0', wm * 0.55);
  });
}

/** A plain pointed leaf. */
export function leaf(p: Pen, x: number, y: number, a: number, s: number, fill: string, op = 0.65, wm = 0.6): void {
  p.at({ x, y, r: a, s: s / 10 }, () => {
    const d = 'M0 0C2.4 -3.2 6.4 -3.4 10 0C6.4 3.4 2.4 3.2 0 0Z';
    p.wash(d, fill, op);
    p.s(d, wm);
    p.s('M0.8 0L7.4 0', wm * 0.5);
  });
}

/** A bezant: a gold dot with an inked rim. */
export function bezant(p: Pen, x: number, y: number, rad: number, wm = 0.45): void {
  p.shapeE(x, y, rad, rad, 0, C.gold, wm, 1);
}

/** A tendril: a hairline that winds into a small spiral. */
export function tendril(p: Pen, x: number, y: number, a: number, len: number, curl: number, wm = 0.4): void {
  const pts: P[] = [];
  const N = 26, dirn = curl >= 0 ? 1 : -1;
  let px = x, py = y, ang = a * Math.PI / 180;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push([px, py]);
    const seg = len / N * (1 - t * 0.55);
    ang += dirn * (0.05 + Math.pow(t, 1.6) * Math.abs(curl) * 0.55);
    px += Math.cos(ang) * seg; py += Math.sin(ang) * seg;
  }
  p.line(pts, wm, 0.7, 0.3);
}

export interface VineOpts {
  /** stem centreline as a function of t in [0,1] */
  at: (t: number) => P;
  /** stem length in units (for spacing) */
  len: number;
  leafEvery: number;
  leafSize: number;
  colors: string[];
  stemW?: number;
  bezants?: boolean;
  flower?: string | null;
}

/** A seeded vine along a parametric stem: leaves alternating sides, tendrils, bezants. */
export function vine(p: Pen, r: () => number, o: VineOpts): void {
  const N = Math.max(8, Math.ceil(o.len / 1.2)), pts: P[] = [];
  for (let i = 0; i <= N; i++) pts.push(o.at(i / N));
  p.line(pts, o.stemW ?? 0.85, 0.5, 0.35);
  const tan = (t: number): number => { const a = o.at(Math.max(0, t - 0.01)), b = o.at(Math.min(1, t + 0.01)); return Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; };
  const count = Math.max(1, Math.floor(o.len / o.leafEvery));
  for (let k = 0; k < count; k++) {
    const t = (k + 0.5 + (r() - 0.5) * 0.3) / count;
    const q = o.at(t), a = tan(t), side = k % 2 ? 1 : -1;
    const kind = r();
    const col = o.colors[Math.floor(r() * o.colors.length) % o.colors.length]!;
    const la = a + side * (48 + r() * 22);
    if (kind < 0.55) ivy(p, q[0], q[1], la, o.leafSize * (0.85 + r() * 0.3), col);
    else if (kind < 0.8) leaf(p, q[0], q[1], la, o.leafSize * (0.9 + r() * 0.3), col);
    else tendril(p, q[0], q[1], la, o.leafSize * 1.6, side * (1.2 + r() * 0.6));
    if (o.bezants && r() < 0.45) {
      const ba = (a - side * (60 + r() * 30)) * Math.PI / 180, bd = o.leafSize * 0.55;
      p.s(`M${n1(q[0])} ${n1(q[1])}L${n1(q[0] + Math.cos(ba) * bd)} ${n1(q[1] + Math.sin(ba) * bd)}`, 0.4);
      bezant(p, q[0] + Math.cos(ba) * bd * 1.18, q[1] + Math.sin(ba) * bd * 1.18, o.leafSize * 0.16);
    } else if (r() < 0.5) {
      tendril(p, q[0], q[1], a - side * (40 + r() * 30), o.leafSize * 1.1, -side * (1 + r() * 0.8), 0.36);
    }
  }
  if (o.flower) {
    const q = o.at(1), a = tan(1);
    flower(p, q[0], q[1], a, o.leafSize * 0.9, o.flower);
  }
}

/** A five-petalled flower (a rose, in the margin sense). */
export function flower(p: Pen, x: number, y: number, _a: number, s: number, color: string): void {
  for (let k = 0; k < 5; k++) {
    const a = (k * 72 - 90) * Math.PI / 180;
    const cx = x + Math.cos(a) * s * 0.42, cy = y + Math.sin(a) * s * 0.42;
    p.washE(cx, cy, s * 0.34, s * 0.3, k * 72, color, 0.7);
    p.e(cx, cy, s * 0.34, s * 0.3, k * 72 - 90, 0.45, 0.8);
  }
  p.shapeE(x, y, s * 0.17, s * 0.17, 0, C.gold, 0.4, 1);
}

/** A swirl of smoke rising from x,y. */
export function smoke(p: Pen, x: number, y: number, h: number, sway = 1): void {
  const pts: P[] = [];
  for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push([x + Math.sin(t * TAU * 1.2) * 2.2 * sway * (0.4 + t), y - t * h]); }
  p.line(pts, 0.45, 0.6, 0.15);
  p.e(x + 1.5 * sway, y - h - 2, 2.2, 1.6, 0, 0.4, 0.85);
}
