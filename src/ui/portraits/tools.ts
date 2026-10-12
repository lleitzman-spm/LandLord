/**
 * Portraits: the thing at the shoulder. A pitchfork, a ledger, a cat: one
 * sign of the trade, either rising behind the shoulder (long-handled things)
 * or held up in a mitten of a hand (everything else), or simply sitting there
 * (cats, ravens, a rat, bees). Drawn on the side the face is turned from.
 */
import { clamp, lerp, ellipse, arc, rot, curve, mixc, shadeOf, liteOf, f, type Pt } from './util';
import { PIG } from './pigments';
import type { Genome, ToolKind } from './types';
import type { Pen, BlobOpts } from './pen';
import type { Geo } from './head';
import { tubePts, cw } from './headwear';

export interface ToolOut { back: string; front: string }

const HELD = new Set<ToolKind>(['rollingpin', 'tankard', 'goblet', 'purse', 'flask', 'orb', 'cheese', 'candles', 'fish', 'herbs', 'trowel', 'gavel', 'spoon', 'bell', 'writ', 'scroll', 'ledger', 'tablet', 'strongbox', 'scales', 'hourglass', 'abacus']);
/** things in the hand are drawn a little over life size, as a miniaturist would */
const HELD_SCALE = 1.24;

/** Where the hand holds things: out along the shoulder, at the collarbone. */
export function heldAt(g: Genome, geo: Geo): { u: number; y: number; k: number } {
  return { u: clamp(Math.min(g.garb.shW * 0.72, 60) * 0.8, 36, 47), y: geo.nb + 17, k: HELD_SCALE };
}

export function drawTool(g: Genome, geo: Geo, pen0: Pen): ToolOut {
  const kind = g.tool;
  if (kind === 'none') return { back: '', front: '' };
  const held = HELD.has(kind);
  const pen = held ? pen0.sub(HELD_SCALE) : pen0;
  const s = g.toolSide, cx = geo.cx, nb = geo.nb, T = geo.top;
  const r = pen.r.fork('tool');
  const half = Math.max(g.head.cheek, g.head.cheekTop, g.head.skull);
  /** how far out the shoulder is, and the clear column beside the head */
  const { u: hu, y: hy } = heldAt(g, geo);
  const colU = clamp(half + 17, 50, 72);
  const yTop = 24 + Math.max(0, colU - 54) * 0.8;
  const P = (u: number, y: number): Pt => [cx + s * u, y];
  const flat = (pts: readonly Pt[], c: string, o: BlobOpts = {}): string => pen.blob(cw(pts), c, { w: 1.25, ...o });
  const wash = (pts: readonly Pt[], c: string, o: BlobOpts = {}): string => pen.blob(cw(pts), c, { w: 1.4, shade: true, sx: 3, sy: 2.5, ...o });
  const poly = (pts: readonly Pt[], c: string, w = 1.2): string => pen.blobPoly(cw(pts), c, { w });

  // a long handle from behind the shoulder up past the ear
  const base: Pt = P(hu + 6, 214), tip: Pt = P(colU + 1, yTop);
  const len = Math.hypot(tip[0] - base[0], tip[1] - base[1]);
  const ax = (tip[0] - base[0]) / len, ay = (tip[1] - base[1]) / len;
  /** unit normal pointing away from the head */
  const nx = -ay * s, ny = ax * s;
  const at = (t: number, off = 0): Pt => [lerp(base[0], tip[0], t) + nx * off, lerp(base[1], tip[1], t) + ny * off];
  /** a point `a` units further along the handle from fraction t0, `n` units out from it */
  const Q = (t0: number, a: number, n: number): Pt => { const o = at(t0); return [o[0] + ax * a + nx * n, o[1] + ay * a + ny * n]; };
  const shaft = (t0: number, t1: number, w: number, c: string): string => pen.bar(at(t0), at(t1), w, c, { w: 1.1 });

  /** the mitten that holds things */
  const fist = (p: Pt, z = 1): string => {
    let o = pen.blob(ellipse(p[0], p[1], 6 * z, 5 * z, 8), g.skin, { w: 1.25, shade: g.skinShade, sx: 1.6, sy: 1.6 });
    o += pen.blob(ellipse(p[0] - s * 3.6 * z, p[1] - 3.4 * z, 2.7 * z, 2.2 * z, 6), g.skin, { w: 1 });
    if (pen.fine) o += pen.line([[p[0] - 1, p[1] + 1.6 * z], [p[0] + s * 3.4 * z, p[1] + 1.2 * z]], 0.7, { op: 0.5 });
    return o;
  };
  const H: Pt = P(hu, hy);
  /** the same stuff from a slightly different batch */
  const dressed = (c: string, amt: number): string => {
    const n = parseInt(c.slice(1), 16), k = 1 + r.jit(amt);
    const ch = (v: number) => clamp(Math.round(v * k), 0, 255).toString(16).padStart(2, '0');
    return '#' + ch((n >> 16) & 255) + ch((n >> 8) & 255) + ch(n & 255);
  };

  let back = '', front = '';
  switch (kind) {
    // ───────────── over the shoulder ─────────────
    case 'pitchfork': {
      back += shaft(0, 0.8, 3.4, PIG.wood);
      const iron = PIG.iron;
      back += pen.line([Q(0.8, 4, -8), Q(0.8, 0, -6), Q(0.8, -1.6, 0), Q(0.8, 0, 6), Q(0.8, 4, 8)], 2.2, { c: iron, tp: 'flat' });
      for (const n of [-8, 0, 8]) back += pen.line([Q(0.8, n ? 3 : -1, n), Q(0.8, 14, n * 0.95), Q(0.8, 25, n * 0.82)], 2.1, { c: iron, tp: 'out' });
      break;
    }
    case 'crook': {
      back += shaft(0, 0.84, 3.6, PIG.wood);
      const hook: Pt[] = [Q(0.84, -1, 0), Q(0.84, 9, 0.4), Q(0.84, 16, -4), Q(0.84, 16.5, -11), Q(0.84, 10, -14.5), Q(0.84, 4.5, -11.5)];
      back += pen.line(hook, 5, { tp: 'flat', wob: 0.2 }) + pen.line(hook, 3.2, { c: PIG.wood, tp: 'flat', wob: 0.2 });
      break;
    }
    case 'shovel': {
      back += shaft(0, 0.74, 3.6, PIG.wood);
      back += wash([Q(0.72, 0, -6.5), Q(0.72, 4, -8), Q(0.72, 20, -7), Q(0.72, 27, 0), Q(0.72, 20, 7), Q(0.72, 4, 8), Q(0.72, 0, 6.5)], PIG.steelDark);
      if (pen.mid) back += pen.line([Q(0.72, 3, 0), Q(0.72, 20, 0)], 1, { c: PIG.steel, op: 0.8, tp: 'out' }) + pen.fill([Q(0.72, 18, -6), Q(0.72, 26, 0), Q(0.72, 19, 6.5), Q(0.72, 21, 0)], '#6b4a2c', 0.75);
      break;
    }
    case 'staff': {
      const wood = '#7a5632';
      back += pen.line([at(0), at(0.3, 1.4), at(0.55, -1.2), at(0.8, 0.8), at(0.92)], 6.2, { tp: 'flat', wob: 0.4 }) + pen.line([at(0), at(0.3, 1.4), at(0.55, -1.2), at(0.8, 0.8), at(0.92)], 4.2, { c: wood, tp: 'flat', wob: 0.4 });
      const o = at(1.0);
      back += `<circle class="llp-glow" cx="${f(o[0])}" cy="${f(o[1])}" r="12" fill="${PIG.flameCore}" opacity=".3"/>`;
      for (const n of [-1, 1]) back += pen.line([Q(0.92, -1, n * 1.5), Q(0.92, 5, n * 7.5), Q(0.92, 13, n * 7), Q(0.92, 17, n * 2.5)], 2.6, { c: wood, tp: 'out' });
      back += pen.bead(o[0], o[1], 5.6, '#bfe3ee', 1.1) + pen.dot(o[0] - 1.8, o[1] - 2, 1.7, '#fffdf2');
      break;
    }
    case 'broom': {
      back += shaft(0, 0.72, 3.4, PIG.wood);
      back += wash([Q(0.7, 0, -3.6), Q(0.7, 7, -6), Q(0.7, 27, -11), Q(0.7, 31, 0), Q(0.7, 27, 11), Q(0.7, 7, 6), Q(0.7, 0, 3.6)], PIG.strawDark);
      if (pen.mid) for (const n of [-6, -2, 2, 6]) back += pen.line([Q(0.7, 8, n * 0.6), Q(0.7, 28, n * 1.5)], 0.8, { c: mixc(PIG.strawDark, PIG.ink, 0.5), op: 0.7, tp: 'out' });
      back += pen.line([Q(0.7, 5, -5.6), Q(0.7, 5, 5.6)], 2.4, { c: PIG.madder, tp: 'flat', wob: 0 });
      break;
    }
    case 'spear':
    case 'lance': {
      const lance = kind === 'lance';
      if (lance) {
        back += shaft(0, 0.96, 5.4, PIG.linen);
        if (pen.mid) for (let i = 0; i < 9; i++) { const t = 0.1 + i * 0.1; back += pen.line([at(t, -2.7), at(t + 0.045, 2.7)], 2.6, { c: PIG.madder, tp: 'flat', wob: 0 }); }
        back += poly([Q(0.96, 0, -3.4), Q(0.96, 8, 0), Q(0.96, 0, 3.4)], PIG.steel);
        // pennon
        back += flat([Q(0.86, 0, 2.5), Q(0.86, -1, 24), Q(0.86, -6, 16), Q(0.86, -11, 25), Q(0.86, -12, 2.5)], PIG.weld, { w: 1.2 });
        if (pen.mid) back += pen.line([Q(0.86, -6, 3), Q(0.86, -6, 13)], 2, { c: PIG.madder, tp: 'flat', wob: 0 });
      } else {
        back += shaft(0, 0.86, 3.2, PIG.wood);
        back += wash([Q(0.86, -1, -2), Q(0.86, 5, -5.4), Q(0.86, 20, 0), Q(0.86, 5, 5.4), Q(0.86, -1, 2)], PIG.steel);
        if (pen.mid) back += pen.line([Q(0.86, 2, 0), Q(0.86, 17, 0)], 0.8, { op: 0.5, tp: 'out' });
        back += flat([Q(0.84, -2, 1.8), Q(0.84, -3, 15), Q(0.84, -8.5, 9), Q(0.84, -13, 14), Q(0.84, -13, 1.8)], g.garb.c, { w: 1.1 });
      }
      break;
    }
    case 'crozier': {
      back += pen.line([at(0), at(0.8)], 5, { tp: 'flat', wob: 0.1 }) + pen.line([at(0), at(0.8)], 3.2, { c: PIG.gold, tp: 'flat', wob: 0.1 });
      const sp: Pt[] = [Q(0.8, -1, 0), Q(0.8, 10, 0.6), Q(0.8, 19, -3), Q(0.8, 22, -10), Q(0.8, 17, -16), Q(0.8, 9.5, -15), Q(0.8, 7, -9.5), Q(0.8, 11, -6.5), Q(0.8, 14.5, -9.5)];
      back += pen.line(sp, 5, { tp: 'flat', wob: 0.15 }) + pen.line(sp, 3.2, { c: PIG.gold, tp: 'flat', wob: 0.15 });
      back += pen.bead(at(0.8)[0], at(0.8)[1], 3.6, PIG.gold2, 1) + (pen.mid ? pen.bead(Q(0.8, 14.5, -9.5)[0], Q(0.8, 14.5, -9.5)[1], 2, PIG.madder, 0.7) : '');
      break;
    }
    case 'rod': {
      // the guild's measure: everything is found short against it
      back += shaft(0, 0.97, 4.8, PIG.linen);
      const n = 10;
      for (let i = 0; i < n; i += 2) back += pen.bar(at(0.12 + i * 0.085), at(0.12 + (i + 1) * 0.085), 4.8, PIG.black, { w: 0.6, wob: 0 });
      back += poly([Q(0.97, 0, -3.4), Q(0.97, 5, -3.4), Q(0.97, 5, 3.4), Q(0.97, 0, 3.4)], PIG.gold);
      break;
    }
    case 'distaff': {
      back += shaft(0, 1, 3, PIG.wood);
      const wool = mixc(PIG.bone, g.garb.c2, 0.12);
      back += wash([Q(0.66, 0, -3), Q(0.66, 6, -9), Q(0.66, 18, -10.5), Q(0.66, 29, -6), Q(0.66, 33, 0), Q(0.66, 29, 6), Q(0.66, 18, 10.5), Q(0.66, 6, 9), Q(0.66, 0, 3)], wool);
      if (pen.mid) {
        back += pen.line([Q(0.66, 6, -8.5), Q(0.66, 15, 0), Q(0.66, 24, 9)], 1.8, { c: g.garb.c, tp: 'flat' }) + pen.line([Q(0.66, 6, 8.5), Q(0.66, 15, 0), Q(0.66, 24, -9)], 1.8, { c: g.garb.c, tp: 'flat' });
        back += pen.line([Q(0.66, 2, 3), Q(0.6, -8, 9), Q(0.5, -8, 4)], 0.8, { c: wool, tp: 'flat' });
      }
      break;
    }
    case 'bow': {
      const a: Pt = P(hu + 1, 212), m: Pt = P(colU + 9, lerp(212, yTop, 0.5)), b: Pt = P(colU - 3, yTop + 2);
      back += pen.line([a, b], 0.8, { c: PIG.linen, tp: 'flat', wob: 0 });
      back += pen.line([a, P(colU + 5, lerp(212, yTop, 0.25)), m, P(colU + 5, lerp(212, yTop, 0.78)), b], 4.6, { tp: 'both', wob: 0.2 }) + pen.line([a, P(colU + 5, lerp(212, yTop, 0.25)), m, P(colU + 5, lerp(212, yTop, 0.78)), b], 2.8, { c: '#8a5a2c', tp: 'both', wob: 0.2 });
      if (pen.mid) back += pen.line([[m[0] - s * 2, m[1] - 5], [m[0] - s * 2, m[1] + 5]], 3.4, { c: PIG.leatherDark, tp: 'flat', wob: 0 });
      // fletchings over the shoulder
      for (let i = 0; i < 3; i++) {
        const x = hu - 15 + i * 6, y = nb - 9 - (i % 2) * 5;
        back += pen.line([P(x, nb + 14), P(x + 0.6, y)], 1.1, { c: PIG.wood, tp: 'flat', wob: 0 });
        back += flat([P(x, y + 10), P(x - 3, y + 4), P(x - 2.4, y - 3), P(x + 0.4, y - 1), P(x + 3.2, y - 3), P(x + 3.6, y + 4)], [PIG.madder, PIG.linen, PIG.green][i], { w: 0.8 });
      }
      break;
    }
    case 'sword': {
      const gd = at(0.3);
      back += wash([Q(0.3, 0, -4), Q(0.3, len * 0.56, -3.2), Q(0.3, len * 0.66, 0), Q(0.3, len * 0.56, 3.2), Q(0.3, 0, 4)], PIG.steel, { sx: 1.6, sy: 0 });
      if (pen.mid) back += pen.line([Q(0.3, 3, 0), Q(0.3, len * 0.52, 0)], 0.8, { c: PIG.steelDark, tp: 'out', op: 0.8 });
      back += pen.bar(at(0.06), gd, 3.6, PIG.leatherDark, { w: 1 });
      back += pen.line([Q(0.3, 0, -12), Q(0.3, 1.4, 0), Q(0.3, 0, 12)], 5.4, { tp: 'flat', wob: 0.1 }) + pen.line([Q(0.3, 0, -12), Q(0.3, 1.4, 0), Q(0.3, 0, 12)], 3.6, { c: PIG.gold, tp: 'flat', wob: 0.1 });
      break;
    }
    case 'trumpet': {
      // long, straight, and hung with the Crown's colours
      const tube: Pt[] = [at(0.1), at(0.82)];
      back += flat([Q(0.6, 0, 1.6), Q(0.6, -2, 27), Q(0.6, -15, 22), Q(0.6, -28, 27), Q(0.6, -30, 1.6)], PIG.madder, { w: 1.3 });
      if (pen.mid) {
        back += pen.line([Q(0.6, -4, 6), Q(0.6, -4, 20)], 1.6, { c: PIG.gold2, tp: 'flat', wob: 0 }) + pen.line([Q(0.6, -26, 6), Q(0.6, -26, 20)], 1.6, { c: PIG.gold2, tp: 'flat', wob: 0 });
        const c = Q(0.6, -15, 12);
        back += poly([[c[0] - 5, c[1] + 3.6], [c[0] - 5.4, c[1] - 3.4], [c[0] - 2.4, c[1] - 0.4], [c[0], c[1] - 4.6], [c[0] + 2.4, c[1] - 0.4], [c[0] + 5.4, c[1] - 3.4], [c[0] + 5, c[1] + 3.6]], PIG.gold2, 0.8);
      }
      back += pen.line(tube, 5.6, { tp: 'flat', wob: 0.1 }) + pen.line(tube, 3.8, { c: PIG.gold, tp: 'flat', wob: 0.1 });
      back += wash([Q(0.8, -1, -2.6), Q(0.8, 9, -4.6), Q(0.8, 19, -13.6), Q(0.8, 22.6, 0), Q(0.8, 19, 13.6), Q(0.8, 9, 4.6), Q(0.8, -1, 2.6)], PIG.gold, { shade: PIG.goldInk });
      if (pen.mid) back += pen.fill([Q(0.8, 18.6, -11), Q(0.8, 21, 0), Q(0.8, 18.6, 11), Q(0.8, 16.6, 0)], PIG.goldInk, 0.8) + pen.bead(at(0.5)[0], at(0.5)[1], 3, PIG.gold2, 0.8) + pen.bead(at(0.28)[0], at(0.28)[1], 3, PIG.gold2, 0.8);
      break;
    }
    case 'wheat': {
      for (const [n, t1] of [[-9, 0.86], [0, 0.98], [8, 0.9]] as [number, number][]) {
        const top = at(t1, n);
        back += pen.line([at(0.05, n * 0.2), at(0.5, n * 0.6), top], 1.3, { c: PIG.strawDark, tp: 'flat' });
        const kn = pen.mid ? 5 : 3;
        for (let i = 0; i < kn; i++) for (const sd of [-1, 1]) {
          const t = t1 - 0.02 - i * 0.034, o = at(t, n + sd * 2.6);
          back += flat(rot(ellipse(o[0], o[1], 2, 4.2, 6), sd * s * 24, o[0], o[1]), PIG.straw, { w: 0.7, wob: 0.1 });
        }
        if (pen.mid) back += pen.line([top, at(t1 + 0.05, n - 3)], 0.6, { c: PIG.strawDark, tp: 'out' }) + pen.line([top, at(t1 + 0.055, n + 3)], 0.6, { c: PIG.strawDark, tp: 'out' });
      }
      break;
    }
    case 'hammer': {
      const b0: Pt = P(hu + 10, 212), t0: Pt = P(clamp(half + 15, 46, 66), nb - 30);
      const dl = Math.hypot(t0[0] - b0[0], t0[1] - b0[1]), hx = (t0[0] - b0[0]) / dl, hyy = (t0[1] - b0[1]) / dl;
      const R = (a: number, n: number): Pt => [t0[0] + hx * a - hyy * n, t0[1] + hyy * a + hx * n];
      back += pen.bar(b0, t0, 4.4, PIG.wood, { w: 1.1 });
      back += pen.blobPoly(cw([R(-2, -13), R(11, -13), R(11, 13), R(-2, 13)]), PIG.iron, { w: 1.4 });
      if (pen.mid) back += pen.line([R(0.5, -11), R(0.5, 11)], 1.2, { c: PIG.steel, tp: 'flat', op: 0.7, wob: 0 }) + pen.line([R(-2, -8.6), R(11, -8.6)], 0.7, { tp: 'flat', op: 0.5, wob: 0 });
      break;
    }
    case 'saw': {
      const hb: Pt = P(hu + 2, nb + 6);
      const dx = tip[0] - hb[0], dy = tip[1] + 6 - hb[1], dl = Math.hypot(dx, dy), ux = dx / dl, uy = dy / dl;
      const R = (a: number, n: number): Pt => [hb[0] + ux * a + nx * n, hb[1] + uy * a + ny * n];
      back += poly([R(4, -7), R(dl, -2.4), R(dl, 3), R(4, 8)], PIG.steel, 1.2);
      if (pen.mid) {
        let teeth = '';
        const n = pen.fine ? 16 : 9;
        for (let i = 0; i < n; i++) { const a0 = 6 + ((dl - 8) * i) / n, a1 = 6 + ((dl - 8) * (i + 1)) / n, w0 = lerp(8, 3, i / n), w1 = lerp(8, 3, (i + 1) / n); const p0 = R(a0, w0), pm = R((a0 + a1) / 2, (w0 + w1) / 2 + 2.6), p1 = R(a1, w1); teeth += `M${f(p0[0])} ${f(p0[1])}L${f(pm[0])} ${f(pm[1])}L${f(p1[0])} ${f(p1[1])}Z`; }
        back += `<path d="${teeth}" fill="${PIG.steel}" stroke="${pen.ink}" stroke-width="${f(0.6 * pen.k)}" stroke-linejoin="round"/>`;
      }
      back += flat([R(-10, -7), R(5, -9), R(7, 10), R(-9, 11), R(-13, 2)], PIG.wood, { w: 1.2 });
      if (pen.mid) back += flat(ellipse(R(-3, 1)[0], R(-3, 1)[1], 3.6, 2.6, 6), shadeOf(g.garb.c, 0.3), { w: 0.8 });
      break;
    }
    case 'lute': {
      const bx = hu + 16, byy = nb + 22;
      const nk0: Pt = P(bx - 3, byy - 20), nk1: Pt = P(colU + 3, yTop + 18);
      // the bowl rides behind the shoulder
      back += wash(ellipse(cx + s * bx, byy, 21, 27, 10), '#c08a45', { sx: 4, sy: 3 });
      if (pen.mid) back += pen.bead(cx + s * (bx - 1), byy - 8, 5.4, '#4a2f1c', 0.9) + (pen.fine ? `<circle cx="${f(cx + s * (bx - 1))}" cy="${f(byy - 8)}" r="7.4" fill="none" stroke="${PIG.woodDark}" stroke-width=".7" opacity=".7"/>` : '');
      back += pen.bar(nk0, nk1, 7.4, '#5e3d22', { w: 1.2 });
      if (pen.mid) {
        for (const o of [-1.8, 0, 1.8]) back += pen.line([[nk0[0] + o, nk0[1]], [nk1[0] + o, nk1[1]]], 0.45, { c: PIG.linen, tp: 'flat', wob: 0, op: 0.85 });
        for (const t of [0.25, 0.45, 0.62, 0.76]) { const x = lerp(nk0[0], nk1[0], t), y = lerp(nk0[1], nk1[1], t); back += pen.line([[x - 3.6, y - 0.6], [x + 3.6, y + 0.6]], 0.7, { c: PIG.gold, tp: 'flat', wob: 0 }); }
      }
      // pegbox, bent back
      const pb: Pt = [nk1[0] - s * 7, nk1[1] - 12];
      for (let i = 0; i < 3; i++) { const t = 0.25 + i * 0.3, x = lerp(nk1[0], pb[0], t), y = lerp(nk1[1], pb[1], t); back += pen.line([[x - 8, y - 3.2], [x + 8, y + 3.2]], 2, { c: PIG.bone, tp: 'flat', wob: 0 }); }
      back += pen.bar(nk1, pb, 7, '#4a2f1c', { w: 1.2 });
      break;
    }
    case 'sack': {
      const c = dressed(PIG.cream, 0.04);
      const o: Pt = P(hu + 9, nb - 6);
      back += wash([[o[0] - 19, o[1] + 20], [o[0] - 22, o[1]], [o[0] - 16, o[1] - 19], [o[0] - 2, o[1] - 27], [o[0] + 14, o[1] - 22], [o[0] + 22, o[1] - 4], [o[0] + 20, o[1] + 22], [o[0], o[1] + 30]], c, { sx: 4, sy: 4 });
      if (pen.mid) {
        back += pen.line([[o[0] - 12, o[1] - 12], [o[0] - 6, o[1] + 2], [o[0] - 10, o[1] + 16]], 0.9, { op: 0.45 }) + pen.line([[o[0] + 8, o[1] - 14], [o[0] + 11, o[1] + 4]], 0.9, { op: 0.4 });
        back += pen.fill(ellipse(o[0] + 3, o[1] - 6, 6, 4, 7), PIG.flour, 0.8);
      }
      // the gathered neck, in the fist
      const n0: Pt = P(hu - 9, nb + 16);
      front += flat([[n0[0] + s * 12, n0[1] - 16], [n0[0] + s * 3, n0[1] - 5], [n0[0] - s * 5, n0[1] + 4], [n0[0] - s * 9, n0[1] - 2], [n0[0] - s * 2, n0[1] - 9], [n0[0] + s * 7, n0[1] - 20]], c, { w: 1.2 });
      front += fist(n0);
      break;
    }

    // ───────────── in the hand ─────────────
    case 'rollingpin': {
      const a: Pt = [H[0] - s * 13, H[1] + 13], b: Pt = [H[0] + s * 11, H[1] - 30];
      const p = (t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
      front += pen.bar(p(-0.04), p(1.08), 3.2, PIG.woodDark, { w: 1 });
      front += pen.bar(p(0.2), p(0.9), 9.6, '#c69a62', { w: 1.3 });
      if (pen.mid) front += pen.line([p(0.26), p(0.84)].map(q => [q[0] - 2.4, q[1] - 1] as Pt), 1.4, { c: '#e3c08a', tp: 'both', op: 0.9 }) + pen.fill(ellipse(p(0.62)[0], p(0.62)[1], 4, 2.6, 6), PIG.flour, 0.85);
      front += fist(p(0.08));
      break;
    }
    case 'tankard': {
      const x = H[0], y = H[1] - 8, wd = pen.r.fork('tk')() < 0.5;
      const c = wd ? '#a97c48' : PIG.steel;
      front += pen.line([[x + s * 7.5, y - 5], [x + s * 15, y - 3], [x + s * 15, y + 6], [x + s * 7.5, y + 7]], 3.4, { tp: 'flat', wob: 0.1 }) + pen.line([[x + s * 7.5, y - 5], [x + s * 15, y - 3], [x + s * 15, y + 6], [x + s * 7.5, y + 7]], 1.8, { c, tp: 'flat', wob: 0.1 });
      front += pen.blob(cw([[x - 8.4, y - 9], [x + 8.4, y - 9], [x + 9.4, y + 10], [x, y + 11.6], [x - 9.4, y + 10]]), c, { w: 1.4, shade: true, sx: 2.5, sy: 0 });
      if (pen.mid) {
        if (wd) for (const o of [-4.4, 0, 4.4]) front += pen.line([[x + o, y - 8], [x + o * 1.06, y + 10]], 0.7, { op: 0.4, tp: 'flat', wob: 0.1 });
        for (const yy of [y - 5, y + 6.4]) front += pen.line([[x - 9, yy], [x, yy + 1.4], [x + 9, yy]], 1.8, { c: wd ? PIG.iron : PIG.steelDark, tp: 'flat', wob: 0 });
      }
      // a head on it
      front += flat([[x - 9.4, y - 9], [x - 8, y - 14], [x - 2.6, y - 15.6], [x + 3, y - 14.4], [x + 8.4, y - 15], [x + 9.8, y - 9.6], [x + 6.4, y - 6.4], [x + 4.6, y - 1.6], [x + 2.4, y - 7], [x - 4, y - 7.4]], PIG.linen, { w: 1.1 });
      front += fist([x + s * 12.5, y + 2.4], 0.9);
      break;
    }
    case 'goblet': {
      const x = H[0], y = H[1] - 10;
      const c = PIG.silver;
      front += flat(ellipse(x, y + 20, 7.4, 2.6, 8), c, { w: 1.1 });
      front += pen.bar([x, y + 6], [x, y + 19], 2.8, c, { w: 1 });
      front += pen.blob(cw([[x - 8.6, y - 9], [x + 8.6, y - 9], [x + 7, y + 3], [x, y + 8], [x - 7, y + 3]]), c, { w: 1.3, shade: PIG.steelDark, sx: 2.4, sy: 0 });
      front += flat(ellipse(x, y - 9, 8.4, 2.6, 8), PIG.wine, { w: 1 });
      if (pen.mid) front += pen.bead(x, y + 0.4, 1.9, PIG.madder, 0.7);
      front += fist([x + s * 0.6, y + 13], 0.86);
      break;
    }
    case 'purse': {
      const x = H[0], y = H[1] - 2;
      const c = dressed(PIG.leather, 0.05);
      front += pen.bead(x - s * 2, y - 16, 3.6, PIG.gold2, 0.9) + pen.bead(x + s * 5, y - 13.6, 3.2, PIG.gold, 0.9);
      front += wash([[x - 4.6, y - 9], [x + 4.6, y - 9], [x + 12.6, y + 2], [x + 12, y + 12], [x, y + 16.6], [x - 12, y + 12], [x - 12.6, y + 2]], c);
      front += flat([[x - 7.6, y - 15], [x, y - 11.6], [x + 7.6, y - 15], [x + 5, y - 8], [x - 5, y - 8]], c, { w: 1.1 });
      front += pen.line([[x - 5.6, y - 9], [x, y - 7.6], [x + 5.6, y - 9]], 1.6, { c: PIG.gold, tp: 'flat', wob: 0 });
      if (pen.fine) front += pen.line([[x - 4, y - 4], [x - 6.6, y + 8]], 0.8, { op: 0.4 }) + pen.line([[x + 3, y - 4], [x + 5.6, y + 9]], 0.8, { op: 0.4 });
      front += fist([x + s * 9, y + 13], 0.9);
      break;
    }
    case 'flask': {
      const x = H[0], y = H[1] - 4, liquid = ['#6fb04c', '#b05acb', '#3fa7a0', '#d9813a'][g.seed & 3];
      const glass: Pt[] = [[x - 3.2, y - 22], [x + 3.2, y - 22], [x + 3.4, y - 10.6], [x + 11, y - 3], [x + 11.6, y + 6], [x + 6, y + 12.4], [x - 6, y + 12.4], [x - 11.6, y + 6], [x - 11, y - 3], [x - 3.4, y - 10.6]];
      front += pen.blob(cw(glass), '#dfeee6', { w: 0, wob: 0, op: 0.82 });
      front += pen.inside(curve(cw(glass), true), `<rect x="${f(x - 14)}" y="${f(y + 0.6)}" width="28" height="16" fill="${liquid}"/><ellipse cx="${f(x)}" cy="${f(y + 0.6)}" rx="11.4" ry="2" fill="${liteOf(liquid, 0.35)}"/>`);
      front += pen.line(cw(glass), 1.3, { closed: true, wob: 0 });
      front += poly([[x - 3, y - 26.6], [x + 3, y - 26.6], [x + 2.6, y - 21.6], [x - 2.6, y - 21.6]], '#a9824c', 1);
      if (pen.mid) {
        front += pen.line([[x - 7.6, y - 0.6], [x - 8.6, y + 5]], 1.3, { c: '#ffffff', op: 0.7, tp: 'both' });
        front += `<g class="llp-bub"><circle cx="${f(x + 2.6)}" cy="${f(y + 6)}" r="1.5" fill="${liteOf(liquid, 0.6)}"/><circle cx="${f(x - 3)}" cy="${f(y + 9)}" r="1.1" fill="${liteOf(liquid, 0.6)}"/><circle cx="${f(x + 5.4)}" cy="${f(y + 9.6)}" r="0.9" fill="${liteOf(liquid, 0.6)}"/></g>`;
        front += `<g class="llp-smoke">${pen.line([[x, y - 28], [x - 2.6, y - 33], [x + 2, y - 38], [x - 1, y - 44]], 1.4, { c: liteOf(liquid, 0.5), op: 0.7, tp: 'in' })}</g>`;
      }
      front += fist([x + s * 1.6, y + 14.6], 0.92);
      break;
    }
    case 'orb': {
      const x = H[0], y = H[1] - 9;
      front += `<circle class="llp-glow" cx="${f(x)}" cy="${f(y)}" r="17" fill="#cfe3f2" opacity=".28"/>`;
      front += pen.blob(ellipse(x, y, 12, 12, 12), '#cddff0', { w: 1.3, shade: '#9db9d9', sx: 3.4, sy: 3, shadeLod: 1, wob: 0.15 });
      if (pen.mid) front += pen.line([[x - 2, y + 4], [x + 3, y + 0.6], [x - 0.6, y - 3.4], [x - 5, y - 1.6], [x - 4.6, y + 5.6], [x + 3.6, y + 6.6]], 0.9, { c: PIG.violet, op: 0.55, tp: 'in' });
      front += pen.line(arc(x, y, 8.6, 8.6, 196, 262, 4), 1.9, { c: '#ffffff', op: 0.85, tp: 'both' });
      front += fist([x, y + 14.6], 1.02);
      break;
    }
    case 'cheese': {
      const x = H[0], y = H[1] - 6;
      front += fist([x - s * 1, y + 12.6], 1);
      front += poly([[x - 15, y + 5.6], [x + 14, y + 8.6], [x + 14, y - 3.4], [x - 15, y - 2.4]], '#d9a640', 1.2);
      front += poly([[x - 15, y - 2.4], [x + 14, y - 3.4], [x + 7, y - 13.6]], PIG.mustard, 1.2);
      if (pen.mid) for (const [dx, dy, rr] of [[-6, 2.6, 1.9], [3, 3.6, 2.5], [9.6, 1, 1.5], [4.6, -7, 1.7]] as [number, number, number][]) front += pen.bead(x + dx, y + dy, rr, '#b9882c', 0.6);
      break;
    }
    case 'candles': {
      // a day's dipping, hung by the wicks
      const x = H[0], y = H[1] - 24;
      for (let i = 0; i < 4; i++) {
        const cxn = x + (i - 1.5) * 6.2, l = 25 + (i % 2) * 5;
        front += pen.line([[x, y + 1], [cxn, y + 8]], 0.7, { tp: 'flat', wob: 0 });
        front += flat([[cxn - 1.8, y + 8], [cxn + 1.8, y + 8], [cxn + 2.6, y + 8 + l], [cxn, y + 10 + l], [cxn - 2.6, y + 8 + l]], i % 2 ? PIG.wax : '#e2cf9a', { w: 1, wob: 0.15 });
      }
      front += fist([x, y], 0.9);
      break;
    }
    case 'fish': {
      const x = H[0], y = H[1] - 26;
      const c = '#9db4bf';
      front += flat([[x - 6.6, y - 2], [x, y + 4], [x + 6.6, y - 2], [x + 3, y + 8], [x - 3, y + 8]], shadeOf(c, 0.2), { w: 1.1 });
      front += wash([[x - 3, y + 7], [x + 3, y + 7], [x + 8, y + 20], [x + 7, y + 33], [x, y + 41], [x - 7, y + 33], [x - 8, y + 20]], c, { sx: 2.6, sy: 0 });
      front += pen.fill([[x - 6, y + 22], [x + 6, y + 22], [x + 5.6, y + 33], [x, y + 39.6], [x - 5.6, y + 33]], '#e8eee6', 0.55);
      front += flat([[x + s * 7.6, y + 17], [x + s * 13, y + 22], [x + s * 8, y + 25]], shadeOf(c, 0.2), { w: 0.9 });
      front += pen.bead(x - s * 2.6, y + 33.4, 1.9, PIG.weld, 0.7) + pen.dot(x - s * 2.6, y + 33.4, 0.9, pen.ink);
      if (pen.mid) front += pen.line([[x - 5.6, y + 28.6], [x, y + 30.6], [x + 5.6, y + 28.6]], 0.8, { op: 0.6 });
      if (pen.fine) for (let j = 0; j < 3; j++) for (let i = -1; i <= 1; i++) front += pen.line(arc(x + i * 4 + (j % 2) * 2, y + 12 + j * 4, 2, 1.8, 20, 160, 3), 0.5, { op: 0.4, tp: 'flat', wob: 0 });
      front += fist([x, y + 1], 0.86);
      break;
    }
    case 'herbs': {
      const x = H[0], y = H[1];
      const stems: [number, number, string][] = [[-13, -30, PIG.green], [-5, -37, PIG.forest], [4, -39, PIG.green], [12, -31, PIG.moss], [18, -22, PIG.forest]];
      for (const [dx, dy, c] of stems) {
        front += pen.line([[x, y], [x + dx * 0.5, y + dy * 0.55], [x + dx, y + dy]], 1.1, { c: PIG.forest, tp: 'flat' });
        for (let i = 0; i < (pen.mid ? 3 : 2); i++) {
          const t = 0.45 + i * 0.22, px = x + dx * t, py = y + dy * t, sd = i % 2 ? 1 : -1;
          front += flat(rot([[px, py], [px + 3.6, py - 2.6], [px + 8.6, py], [px + 3.6, py + 2.4]], sd > 0 ? -35 : 215, px, py), c, { w: 0.8 });
        }
      }
      const fl = [PIG.violet, PIG.weld, PIG.linen];
      stems.forEach(([dx, dy], i) => { if (i % 2 === 0 || pen.fine) front += pen.bead(x + dx, y + dy - 1, i % 2 ? 2.2 : 3, fl[i % 3], 0.8); });
      front += pen.line([[x - 3.6, y - 6], [x + 3.6, y - 5]], 2, { c: PIG.madder, tp: 'flat', wob: 0 });
      front += fist([x, y + 1.6]);
      break;
    }
    case 'trowel': {
      const x = H[0], y = H[1] + 2;
      const a: Pt = [x, y], b: Pt = [x + s * 4, y - 13];
      front += pen.bar(a, b, 4.4, PIG.wood, { w: 1.1 });
      front += pen.line([b, [b[0] + s * 1, b[1] - 6]], 2.2, { c: PIG.iron, tp: 'flat', wob: 0 });
      const o: Pt = [b[0] + s * 1, b[1] - 6];
      front += wash([[o[0] - 9.4, o[1] - 2], [o[0] + s * 2, o[1] - 26], [o[0] + 9.4, o[1] - 3.6], [o[0], o[1] + 2.6]], PIG.steel, { sx: 2, sy: 0 });
      if (pen.mid) front += pen.fill([[o[0] - 5, o[1] - 6], [o[0] + s * 1.6, o[1] - 17], [o[0] + 5.6, o[1] - 7], [o[0] + 1, o[1] - 3.6]], '#b9ad9a', 0.9);
      front += fist([x + s * 1, y - 3]);
      break;
    }
    case 'gavel':
    case 'spoon': {
      const x = H[0], y = H[1] + 4;
      const a: Pt = [x - s * 2, y], b: Pt = kind === 'spoon' ? [x + s * 5, y - 47] : [x + s * 6, y - 31];
      const dl = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / dl, uy = (b[1] - a[1]) / dl;
      const R = (al: number, n: number): Pt => [b[0] + ux * al - uy * n, b[1] + uy * al + ux * n];
      if (kind === 'spoon') {
        // long enough to stir a cauldron, or make a point
        front += pen.bar(a, b, 3.2, '#b98a52', { w: 1.1 });
        front += wash([R(-2, -2.4), R(3, -6.6), R(11, -7.4), R(17, 0), R(11, 7.4), R(3, 6.6), R(-2, 2.4)], '#c2955c', { sx: 2, sy: 1.6 });
        if (pen.mid) front += pen.fill([R(4, -3.6), R(10, -4.4), R(14, 0), R(10, 4.4), R(4, 3.6)], '#8a5f34', 0.5);
      } else {
        front += pen.bar(a, b, 3.6, PIG.wood, { w: 1.1 });
        front += pen.blobPoly(cw([R(-5.4, -11.6), R(5.4, -11.6), R(5.4, 11.6), R(-5.4, 11.6)]), '#8a5a2c', { w: 1.4 });
        if (pen.mid) for (const n of [-8.4, 8.4]) front += pen.line([R(-5.4, n), R(5.4, n)], 1.6, { c: PIG.gold, tp: 'flat', wob: 0 });
      }
      front += fist([x - s * 1, y - 4]);
      break;
    }
    case 'bell': {
      const x = H[0], y = H[1] - 26;
      front += `<g class="llp-ring" style="transform-origin:${f(x)}px ${f(y)}px">`;
      front += pen.bar([x, y + 2], [x, y + 13], 3.6, PIG.wood, { w: 1 });
      front += pen.bead(x, y + 37.4, 2.6, PIG.iron, 0.9);
      front += wash([[x - 4, y + 12], [x + 4, y + 12], [x + 8, y + 22], [x + 13.6, y + 33], [x + 11, y + 36], [x, y + 34.6], [x - 11, y + 36], [x - 13.6, y + 33], [x - 8, y + 22]], PIG.gold, { shade: PIG.goldInk, sx: 2.6, sy: 1 });
      if (pen.mid) front += pen.line([[x - 5, y + 16], [x - 8.6, y + 27]], 1.4, { c: PIG.gold2, tp: 'both' });
      front += '</g>';
      if (pen.mid) for (const sd of [-1, 1]) front += pen.line(arc(x + sd * 15, y + 28, 4.6, 9, sd > 0 ? -50 : 130, sd > 0 ? 50 : 230, 4), 0.9, { op: 0.55, tp: 'both' }) + (pen.fine ? pen.line(arc(x + sd * 19.6, y + 28, 5, 12, sd > 0 ? -44 : 136, sd > 0 ? 44 : 224, 4), 0.8, { op: 0.4, tp: 'both' }) : '');
      front += fist([x, y + 3], 0.9);
      break;
    }
    case 'writ': {
      // rolled, sealed, and about to be nailed to something
      const x = H[0], y = H[1] - 6;
      const a: Pt = [x - s * 10, y + 13], b: Pt = [x + s * 9, y - 24];
      front += pen.bar(a, b, 9, PIG.parch, { w: 1.3 });
      front += flat(ellipse(b[0], b[1], 4.6, 2.6, 7).map(p => rot([p], s * 26, b[0], b[1])[0]), PIG.cream, { w: 1 });
      if (pen.mid) front += pen.line([[lerp(a[0], b[0], 0.3) - 4, lerp(a[1], b[1], 0.3) - 2], [lerp(a[0], b[0], 0.3) + 4, lerp(a[1], b[1], 0.3) + 2]], 2, { c: PIG.madder, tp: 'flat', wob: 0 });
      const sl: Pt = [lerp(a[0], b[0], 0.5) + s * 5, lerp(a[1], b[1], 0.5) + 15];
      front += pen.line([[lerp(a[0], b[0], 0.5), lerp(a[1], b[1], 0.5)], [sl[0] - s * 1, sl[1] - 5]], 1.6, { c: PIG.madder, tp: 'flat' });
      front += pen.bead(sl[0], sl[1], 5, PIG.rubric, 1) + (pen.mid ? pen.dot(sl[0], sl[1], 2.2, PIG.redDeep) : '');
      front += fist([lerp(a[0], b[0], 0.14), lerp(a[1], b[1], 0.14)]);
      break;
    }
    case 'scroll': {
      const x = H[0], y = H[1] - 12;
      front += pen.blobPoly(cw([[x - 11, y - 15], [x + 11, y - 15], [x + 11.6, y + 16], [x - 11.6, y + 16]]), PIG.parch, { w: 1.2 });
      if (pen.mid) {
        front += poly([[x - 8, y - 10.6], [x - 3.6, y - 10.6], [x - 3.6, y - 5], [x - 8, y - 5]], PIG.rubric, 0.6);
        const n = pen.fine ? 6 : 4;
        for (let i = 0; i < n; i++) { const yy = y - 9 + i * (pen.fine ? 4 : 6); front += pen.line([[i < 2 ? x - 1.6 : x - 8, yy], [x + 8 - (i === n - 1 ? 6 : r.range(0, 3)), yy + 0.3]], 0.75, { op: 0.6, tp: 'flat', wob: 0.25 }); }
      }
      for (const yy of [y - 16, y + 17]) front += flat([[x - 13.6, yy - 2.6], [x + 13.6, yy - 2.6], [x + 13.6, yy + 2.6], [x - 13.6, yy + 2.6]], PIG.cream, { w: 1.1, wob: 0.15 });
      front += fist([x + s * 11, y + 5], 0.9);
      break;
    }
    case 'ledger': {
      const x = H[0], y = H[1] - 6, c = g.kind === 'dragon' ? PIG.forest : shadeOf(mixc(g.garb.c, PIG.leather, 0.6), 0.1);
      const bk = (pts: Pt[]) => rot(pts, s * -8, x, y);
      front += pen.blobPoly(cw(bk([[x - 12.6, y - 15], [x + 15, y - 15], [x + 15, y + 17.6], [x - 12.6, y + 17.6]])), PIG.cream, { w: 1.1 });
      front += pen.blobPoly(cw(bk([[x - 15, y - 17], [x + 12.6, y - 17], [x + 12.6, y + 16], [x - 15, y + 16]])), c, { w: 1.4 });
      if (pen.mid) {
        front += pen.blobPoly(cw(bk([[x - 8.6, y - 10], [x + 6.6, y - 10], [x + 6.6, y - 2], [x - 8.6, y - 2]])), PIG.parch, { w: 0.8 });
        front += pen.line(bk([[x - 6, y - 7.4], [x + 4, y - 7.4]]), 0.7, { op: 0.6, tp: 'flat', wob: 0.2 }) + pen.line(bk([[x - 6, y - 4.6], [x + 1, y - 4.6]]), 0.7, { op: 0.6, tp: 'flat', wob: 0.2 });
        for (const [dx, dy] of [[-12, -14], [9.6, -14], [-12, 13], [9.6, 13]]) { const q = bk([[x + dx, y + dy]])[0]; front += pen.dot(q[0], q[1], 1.5, PIG.gold2); }
        front += pen.line(bk([[x - 15, y - 17], [x - 15, y + 16]]).map(q => [q[0] + s * 2.4, q[1]] as Pt), 1, { c: shadeOf(c, 0.35), tp: 'flat', wob: 0 });
      }
      if (g.kind !== 'dragon') front += fist([x - s * 2, y + 17.6]);
      break;
    }
    case 'tablet': {
      // wax, in a wooden frame; the stylus does the damage
      const x = H[0], y = H[1] - 8;
      const tb = (pts: Pt[]) => rot(pts, s * 6, x, y);
      front += pen.blobPoly(cw(tb([[x - 12.6, y - 16], [x + 12.6, y - 16], [x + 12.6, y + 16], [x - 12.6, y + 16]])), PIG.wood, { w: 1.4 });
      front += pen.blobPoly(cw(tb([[x - 9.6, y - 13], [x + 9.6, y - 13], [x + 9.6, y + 13], [x - 9.6, y + 13]])), '#3d3a36', { w: 0.9 });
      if (pen.mid) for (let i = 0; i < 4; i++) { const yy = y - 9 + i * 5.6; front += pen.line(tb([[x - 7, yy], [x + 7 - (i === 3 ? 7 : (i * 37 % 5)), yy + 0.4]]), 0.75, { c: '#c9bfa6', op: 0.75, tp: 'flat', wob: 0.3 }); }
      if (pen.mid) front += pen.line(tb([[x - 6, y + 11], [x + 5.6, y - 12]]), 1.6, { c: PIG.rubric, op: 0.85, tp: 'flat', wob: 0.2 });
      front += pen.line([[x + s * 13, y + 14], [x + s * 4, y - 2]], 1.8, { c: PIG.bone, tp: 'in', wob: 0 });
      front += fist([x + s * 12, y + 14.6], 0.9);
      break;
    }
    case 'strongbox': {
      const x = H[0], y = H[1] - 4;
      front += fist([x - s * 4, y + 15.6], 1.05);
      front += wash([[x - 15, y - 5], [x - 13.6, y - 12.6], [x, y - 15.6], [x + 13.6, y - 12.6], [x + 15, y - 5]], '#7a5632', { sx: 2, sy: 2 });
      front += pen.blobPoly(cw([[x - 15, y - 5], [x + 15, y - 5], [x + 14.6, y + 12], [x - 14.6, y + 12]]), '#8a6238', { w: 1.4 });
      for (const o of [-9.4, 9.4]) front += pen.line([[x + o, y - 13.6], [x + o, y + 12]], 2.6, { c: PIG.iron, tp: 'flat', wob: 0 });
      front += pen.line([[x - 15, y - 5], [x + 15, y - 5]], 1.5, { c: PIG.iron, tp: 'flat', wob: 0 });
      front += pen.blobPoly(cw([[x - 3.6, y - 4.4], [x + 3.6, y - 4.4], [x + 3.6, y + 3.6], [x - 3.6, y + 3.6]]), PIG.gold, { w: 1 }) + pen.line(arc(x, y - 4.4, 2.6, 3.6, 180, 360, 4), 1.3, { c: PIG.goldInk, tp: 'flat', wob: 0 });
      if (pen.mid) front += pen.dot(x, y - 0.6, 1.1, pen.ink);
      break;
    }
    case 'scales': {
      const x = H[0], y = H[1] - 28;
      const l: Pt = [x - 15, y + 9], rr: Pt = [x + 15, y + 5];
      front += pen.line([[x, y + 2], [x, y + 8]], 1.6, { c: PIG.goldInk, tp: 'flat', wob: 0 });
      front += pen.line([l, [x, y + 6.6], rr], 3.4, { tp: 'flat', wob: 0 }) + pen.line([l, [x, y + 6.6], rr], 1.9, { c: PIG.gold, tp: 'flat', wob: 0 });
      const pan = (p: Pt, drop: number, coins: boolean): string => {
        let o = '';
        for (const dx of [-7, 7]) o += pen.line([p, [p[0] + dx, p[1] + drop]], 0.6, { tp: 'flat', wob: 0, op: 0.85 });
        if (coins) o += pen.bead(p[0] - 2.6, p[1] + drop - 1.6, 2.4, PIG.gold2, 0.7) + pen.bead(p[0] + 2.4, p[1] + drop - 2, 2.4, PIG.gold, 0.7);
        o += flat([[p[0] - 8.6, p[1] + drop], [p[0] + 8.6, p[1] + drop], [p[0] + 5.6, p[1] + drop + 4.6], [p[0] - 5.6, p[1] + drop + 4.6]], PIG.gold, { w: 1 });
        return o;
      };
      front += pan(l, 20, true) + pan(rr, 16, false);
      if (pen.mid) front += flat(ellipse(rr[0], rr[1] + 13.6, 3.4, 2.6, 6), PIG.linen, { w: 0.7 });
      front += fist([x, y], 0.86);
      break;
    }
    case 'hourglass': {
      const x = H[0], y = H[1] - 9;
      front += fist([x, y + 19], 1);
      const glass = `M${f(x - 7)} ${f(y - 12)}L${f(x + 7)} ${f(y - 12)}Q${f(x + 7)} ${f(y - 3)} ${f(x + 1.3)} ${f(y)}Q${f(x + 7)} ${f(y + 3)} ${f(x + 7)} ${f(y + 12)}L${f(x - 7)} ${f(y + 12)}Q${f(x - 7)} ${f(y + 3)} ${f(x - 1.3)} ${f(y)}Q${f(x - 7)} ${f(y - 3)} ${f(x - 7)} ${f(y - 12)}Z`;
      front += `<path d="${glass}" fill="#dfeee6" opacity=".85"/>`;
      front += pen.inside(glass, `<rect x="${f(x - 8)}" y="${f(y + 6.4)}" width="16" height="7" fill="${PIG.ochre}"/><path d="M${f(x - 5)} ${f(y - 6.6)}L${f(x + 5)} ${f(y - 6.6)}L${f(x)} ${f(y)}Z" fill="${PIG.ochre}"/><path class="llp-sand" d="M${f(x)} ${f(y)}V${f(y + 7)}" stroke="${PIG.ochre}" stroke-width="1"/>`);
      front += `<path d="${glass}" fill="none" stroke="${pen.ink}" stroke-width="${f(1.1 * pen.k)}" stroke-linejoin="round"/>`;
      for (const yy of [y - 13.6, y + 13.6]) front += pen.blobPoly(cw([[x - 10, yy - 2], [x + 10, yy - 2], [x + 10, yy + 2], [x - 10, yy + 2]]), PIG.wood, { w: 1.1 });
      if (pen.mid) for (const o of [-8.6, 8.6]) front += pen.line([[x + o, y - 12], [x + o, y + 12]], 1.6, { c: PIG.woodDark, tp: 'flat', wob: 0 });
      break;
    }
    case 'abacus': {
      const x = H[0], y = H[1] - 8;
      const ab = (pts: Pt[]) => rot(pts, s * -7, x, y);
      front += pen.blobPoly(cw(ab([[x - 15, y - 13], [x + 15, y - 13], [x + 15, y + 13], [x - 15, y + 13]])), PIG.parch, { w: 0.8, op: 0.55 });
      const cols = [PIG.madder, PIG.woad, PIG.weld];
      for (let j = 0; j < 3; j++) {
        const yy = y - 7.6 + j * 7.6;
        front += pen.line(ab([[x - 14, yy], [x + 14, yy]]), 0.9, { tp: 'flat', wob: 0 });
        const k = [2, 3, 1][(j + (g.seed & 3)) % 3];
        for (let i = 0; i < 4; i++) { const px = i < k ? x - 11.6 + i * 4.8 : x + 11.6 - (3 - i) * 4.8, q = ab([[px, yy]])[0]; front += pen.bead(q[0], q[1], 2.5, cols[j], 0.7); }
      }
      const fr = ab([[x - 15, y - 13], [x + 15, y - 13], [x + 15, y + 13], [x - 15, y + 13]]);
      for (let i = 0; i < 4; i++) front += pen.line([fr[i], fr[(i + 1) % 4]], 5, { tp: 'flat', wob: 0 }) + pen.line([fr[i], fr[(i + 1) % 4]], 3.2, { c: PIG.wood, tp: 'flat', wob: 0 });
      front += fist([x - s * 3, y + 17], 0.95);
      break;
    }

    // ───────────── company ─────────────
    case 'cat': {
      const x = cx + s * (hu + 1), y = nb + 3;
      const fur = ['#2f2a2a', '#c98344', '#8f8a84', '#e9e0cf'][g.seed & 3], dk = shadeOf(fur, 0.3);
      front += `<g class="llp-tail" style="transform-origin:${f(x + s * 7)}px ${f(y + 14)}px">` + flat(tubePts([[x + s * 7, y + 14], [x + s * 14, y + 24], [x + s * 10, y + 37], [x + s * 15, y + 45]], [3.2, 3.2, 2.8, 1.6]), fur, { w: 1.1 }) + '</g>';
      front += wash([[x - 10.6, y + 21], [x - 11.6, y + 6], [x - 6, y - 4], [x + 6, y - 4], [x + 11.6, y + 6], [x + 10.6, y + 21], [x, y + 23.6]], fur, { shade: dk });
      const hx = x - s * 1.6, hy2 = y - 9;
      for (const sd of [-1, 1]) front += flat([[hx + sd * 3, hy2 - 6], [hx + sd * 8.6, hy2 - 15], [hx + sd * 10.6, hy2 - 3]], fur, { w: 1.1 }) + (pen.mid ? pen.fill([[hx + sd * 5.6, hy2 - 7], [hx + sd * 8.2, hy2 - 11.6], [hx + sd * 9, hy2 - 5.6]], '#d79a9a', 0.8) : '');
      front += wash(ellipse(hx, hy2, 10.6, 8.6, 10), fur, { shade: dk, sx: 2.4, sy: 2 });
      for (const sd of [-1, 1]) {
        front += `<ellipse cx="${f(hx + sd * 4.4)}" cy="${f(hy2 - 1)}" rx="2.6" ry="${pen.mid ? 2.2 : 2.6}" fill="#d9c84a" stroke="${pen.ink}" stroke-width="${f(0.6 * pen.k)}"/><ellipse cx="${f(hx + sd * 4.4)}" cy="${f(hy2 - 1)}" rx=".8" ry="1.9" fill="${pen.ink}"/>`;
        if (pen.fine) for (const dy of [-0.6, 1.6]) front += pen.line([[hx + sd * 5, hy2 + 3.4 + dy * 0.4], [hx + sd * 14, hy2 + 2.4 + dy * 1.6]], 0.4, { c: fur === '#2f2a2a' ? '#cfc8bb' : pen.ink, tp: 'flat', wob: 0, op: 0.8 });
      }
      front += poly([[hx - 1.6, hy2 + 2.2], [hx + 1.6, hy2 + 2.2], [hx, hy2 + 4.2]], '#d79a9a', 0.6);
      if (pen.mid) front += pen.line([[hx - 3, hy2 + 6], [hx, hy2 + 4.6], [hx + 3, hy2 + 6]], 0.7, { c: fur === '#2f2a2a' ? '#cfc8bb' : pen.ink, op: 0.8 });
      break;
    }
    case 'raven': {
      const x = cx + s * (hu + 3), y = nb + 2;
      const c = '#2a2630', hi = '#4b4760';
      front += flat([[x + s * 6, y + 12], [x + s * 15, y + 27], [x + s * 9, y + 31], [x + s * 2, y + 17]], c, { w: 1.1 });
      front += wash([[x - s * 7, y - 10], [x + s * 3, y - 14], [x + s * 10.6, y - 4], [x + s * 11, y + 10], [x + s * 4, y + 19], [x - s * 6.6, y + 15], [x - s * 10, y + 2]], c, { shade: '#17141c', sx: 2.4, sy: 2.4 });
      if (pen.mid) front += pen.line([[x + s * 2, y - 2], [x + s * 7, y + 6], [x + s * 5, y + 15]], 1.3, { c: hi, tp: 'both', op: 0.9 }) + pen.line([[x - s * 1.6, y + 2], [x + s * 2.6, y + 9], [x + s * 1, y + 15]], 1.1, { c: hi, tp: 'both', op: 0.7 });
      // head turned to the ear it whispers in
      front += flat([[x - s * 7.6, y - 12], [x - s * 19, y - 9], [x - s * 8, y - 6.4]], '#3a3530', { w: 1.1 });
      front += wash(ellipse(x - s * 3.6, y - 12.6, 7.4, 6.6, 9), c, { shade: '#17141c', sx: 2, sy: 2 });
      front += pen.bead(x - s * 5.4, y - 13.6, 1.9, PIG.weld, 0.6) + pen.dot(x - s * 5.6, y - 13.6, 0.9, pen.ink);
      if (pen.mid) for (const dx of [-2.6, 2.4]) front += pen.line([[x + dx, y + 18], [x + dx - s * 1, y + 23]], 1.1, { c: '#3a3530', tp: 'flat', wob: 0 });
      break;
    }
    case 'rat': {
      const x = cx + s * (hu + 2), y = nb + 8;
      const fur = '#8d7f72';
      front += pen.line([[x + s * 8, y + 4], [x + s * 15, y + 12], [x + s * 10, y + 22], [x + s * 15, y + 30]], 1.6, { c: '#c79a8c', tp: 'out' });
      front += wash([[x + s * 9.6, y + 8], [x + s * 9, y - 5], [x + s * 1, y - 10], [x - s * 8, y - 6], [x - s * 13.6, y + 1], [x - s * 8, y + 6], [x, y + 9.6]], fur);
      for (const o of [-1, 5.6]) front += pen.bead(x + s * o, y - 9.6, 3.4, '#b9a092', 0.8) + (pen.mid ? pen.dot(x + s * o, y - 9.6, 1.6, '#d7a7a7') : '');
      front += pen.dot(x - s * 6.4, y - 3, 1.2, pen.ink) + pen.dot(x - s * 13.6, y + 0.8, 1.4, '#c98a8c');
      if (pen.fine) for (const dy of [-1.6, 0.6, 2.6]) front += pen.line([[x - s * 11.6, y + 1], [x - s * 18, y - 1 + dy * 1.5]], 0.4, { tp: 'flat', wob: 0, op: 0.7 });
      if (pen.mid) front += flat(ellipse(x - s * 6.6, y + 7.6, 2.6, 1.8, 6), '#c79a8c', { w: 0.7 });
      break;
    }
    case 'bees': {
      const spots: [number, number, number][] = [[colU + 3, T + 10, -18], [colU - 4, nb - 8, 14], [-(half + 14), T + 2, 22]];
      spots.forEach(([u, y, ang], i) => {
        const x = cx + s * u;
        let b = '';
        if (pen.mid) b += `<path d="M${f(x - s * 19)} ${f(y + 11)}Q${f(x - s * 13)} ${f(y - 1)} ${f(x - s * 6)} ${f(y + 3)}" fill="none" stroke="${pen.ink}" stroke-width="${f(0.7 * pen.k)}" stroke-dasharray="1.6 2.6" stroke-linecap="round" opacity=".55"/>`;
        let bee = '';
        for (const sd of [-1, 1]) bee += `<ellipse cx="${f(x + sd * 2.6)}" cy="${f(y - 4)}" rx="2.6" ry="3.8" fill="#eef4f2" fill-opacity=".85" stroke="${pen.ink}" stroke-width="${f(0.5 * pen.k)}" transform="rotate(${sd * 28} ${f(x)} ${f(y - 2)})"/>`;
        bee += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="5.2" ry="3.7" fill="${PIG.weld}" stroke="${pen.ink}" stroke-width="${f(0.9 * pen.k)}"/>`;
        for (const dx of [-1.4, 1.6]) bee += `<path d="M${f(x + dx)} ${f(y - 3.5)}V${f(y + 3.5)}" stroke="${pen.ink}" stroke-width="${f(1.3)}"/>`;
        bee += pen.dot(x + s * -4.4, y - 0.4, 1.4, pen.ink);
        b += `<g transform="rotate(${ang * s} ${f(x)} ${f(y)})">${bee}</g>`;
        const part = `<g class="llp-bee" style="animation-delay:${(-i * 0.7).toFixed(1)}s">${b}</g>`;
        if (i === 2) back += part; else front += part;
      });
      break;
    }
    default:
      break;
  }
  if (held) {
    pen0.defs += pen.defs;
    front = `<g transform="translate(${f(H[0])} ${f(H[1])}) scale(${HELD_SCALE}) translate(${f(-H[0])} ${f(-H[1])})">${front}</g>`;
  }
  return { back, front };
}
