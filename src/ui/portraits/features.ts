/**
 * Portraits: the parts of a face that move. `faceFrame` is a pure function
 * from (person, expression, blink, gaze) to the attributes of a handful of
 * SVG elements; `faceMarkup` writes those elements once. The animator calls
 * faceFrame again whenever something changes and patches only what differs.
 */
import { clamp, lerp, f, curve, ribbon, poly, taper, type Pt } from './util';
import { PIG } from './pigments';
import type { Genome, Expr, Lod, FrameAttrs } from './types';
import type { Pen } from './pen';

const kOf = (lod: Lod): number => (lod === 0 ? 2.5 : lod === 1 ? 1.5 : 1);
/** features are drawn a little larger in list-sized portraits so they survive */
const fsOf = (lod: Lod): number => (lod === 0 ? 1.24 : lod === 1 ? 1.06 : 1);

/** x of the column the features sit on (the head is turned a touch toward `dir`) */
export function faceX(g: Genome): number { return g.head.cx + g.dir * g.turn * 3; }
export function patchSide(g: Genome): number { return g.marks.patch ? -g.dir : 0; }

function quad(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}

export interface EyeBox { ex: number; ey: number; w: number; h: number; low: number; ix: number; iy: number; ox: number; oy: number }
export function eyeBox(g: Genome, lod: Lod, s: -1 | 1): EyeBox {
  const E = g.eyes, fs = fsOf(lod);
  const far = s === g.dir ? 1 - 0.07 * g.turn : 1;
  const w = E.w * fs * far, h = E.h * fs;
  const ex = faceX(g) + s * E.gap * (s === g.dir ? 1 - 0.05 * g.turn : 1) * (lod === 0 ? 1.04 : 1), ey = E.y;
  return { ex, ey, w, h, low: h * E.low, ix: ex - s * w, iy: ey + E.tilt * 0.3, ox: ex + s * w, oy: ey - E.tilt * 0.7 };
}

/** Combine the face at rest with a mood. Openness-like values multiply; the rest add. */
export function withRest(rest: Partial<Expr>, e: Expr): Expr {
  const o = { ...e };
  for (const key of Object.keys(rest) as (keyof Expr)[]) {
    const v = rest[key];
    if (v === undefined) continue;
    if (key === 'lid' || key === 'wide' || key === 'pupil' || key === 'blush') o[key] = e[key] * v;
    else if (key === 'smile') o.smile = clamp(e.smile + v * (1 - Math.min(1, Math.abs(e.smile))), -1, 1);
    else if (key === 'open' || key === 'teeth') o[key] = Math.max(e[key], v);
    else o[key] = e[key] + v;
  }
  return o;
}

export interface Pose { blink: number; gx: number; gy: number; jx?: number; jy?: number; nod?: number }

export function faceFrame(g: Genome, lod: Lod, e: Expr, pose: Pose): FrameAttrs {
  const out: FrameAttrs = {};
  const k = kOf(lod), fs = fsOf(lod), sc = g.fscale, u1 = sc * fs;
  const cx = faceX(g);
  const E = g.eyes, B = g.brows, M = g.mouth;
  const patch = patchSide(g);

  // ── eyes and brows
  for (const s of [-1, 1] as const) {
    const K = s < 0 ? 'L' : 'R';
    const b = eyeBox(g, lod, s);
    const { ex, ey, w, h, low, ix, iy, ox, oy } = b;
    if (s !== patch) {
      const L = clamp(e.lid * E.lidRest * (1 - pose.blink), 0, 1.42);
      const lowA = low * (1 - 1.7 * e.squint);
      const upA = L <= 1 ? lerp(lowA, -h, L) : -h * (1 + (L - 1) * 0.8);
      const mx = (ix + ox) / 2, my = (iy + oy) / 2;
      const ax = mx + s * E.apex * w * 0.5, lx = mx - s * E.apex * w * 0.2;
      const I: Pt = [ix, iy], O: Pt = [ox, oy], CU: Pt = [ax, my + 2 * upA], CL: Pt = [lx, my + 2 * lowA];
      const shut = L < 0.05;
      const white = shut ? '' : `M${f(ix)} ${f(iy)}Q${f(CU[0])} ${f(CU[1])} ${f(ox)} ${f(oy)}Q${f(CL[0])} ${f(CL[1])} ${f(ix)} ${f(iy)}Z`;
      out['ew' + K + '.d'] = white;
      if (lod > 0) out['ec' + K + '.d'] = white || 'M0 0';
      // upper lid: the heaviest line on the face
      const lidPts: Pt[] = [];
      for (let i = 0; i <= 6; i++) lidPts.push(quad(I, CU, O, i / 6));
      lidPts.push([ox + s * 1.7 * fs, oy + (0.9 - 1.6 * e.squint) * fs]);
      const lidW = (E.lash ? 2.3 : 1.8) * k * (lod === 1 ? 0.8 : 1);
      if (lod === 0) out['el' + K + '.d'] = curve(lidPts.slice(0, 7));
      else {
        let d = ribbon(lidPts, t => lidW * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, t * 1.12) ** 0.8) + (t > 0.5 ? 0.18 : 0)));
        if (E.lash) {
          for (const t of [0.72, 0.9]) {
            const p = quad(I, CU, O, t);
            d += `M${f(p[0])} ${f(p[1] + 0.3)}L${f(p[0] + s * 2.6 * fs)} ${f(p[1] - 2.4 * fs)}L${f(p[0] + s * 1.3)} ${f(p[1] + 0.5)}Z`;
          }
        }
        out['el' + K + '.d'] = d;
        // lid skin shows when the eye is less than fully open
        out['es' + K + '.d'] = upA > -h + 0.25 && !shut
          ? `M${f(ix)} ${f(iy)}Q${f(ax)} ${f(my - 2 * h)} ${f(ox)} ${f(oy)}Q${f(CU[0])} ${f(CU[1])} ${f(ix)} ${f(iy)}Z`
          : shut ? `M${f(ix)} ${f(iy)}Q${f(ax)} ${f(my - 2 * h)} ${f(ox)} ${f(oy)}Q${f(CL[0])} ${f(CL[1])} ${f(ix)} ${f(iy)}Z` : '';
        const lowPts: Pt[] = [];
        for (let i = 0; i <= 4; i++) lowPts.push(quad(I, CL, O, 0.2 + (i / 4) * 0.66));
        out['eo' + K + '.d'] = shut ? '' : ribbon(lowPts, taper.both(0.95 * k));
      }
      // iris and pupil ride on the gaze
      const gx = clamp(pose.gx + e.gazeX * g.dir, -1, 1), gy = clamp(pose.gy + e.gazeY, -1, 1);
      out['ir' + K + '.transform'] = `translate(${f(ex + gx * w * 0.4)} ${f(ey + (low - h) * 0.22 + gy * h * 0.34)})`;
      if (lod === 0) {
        out['ir' + K + '.opacity'] = L < 0.28 ? '0' : '1';
        out['pp' + K + '.r'] = f(Math.max(h * 0.6, 3) * Math.sqrt(clamp(e.pupil, 0.4, 1.2)));
      } else if (E.pupil === 'slit') out['pp' + K + '.rx'] = f(E.irisR * fs * 0.24 * e.pupil);
      else out['pp' + K + '.r'] = f(E.irisR * fs * (E.pupil === 'dot' ? 0.62 : 0.5) * e.pupil);
    }
    // brow
    const skew = s === g.dir ? e.browSkew : -e.browSkew * 0.25;
    const by = ey - h - B.gapY * fs;
    let inX = ex - s * (w * 0.9 + 1.5), outX = ex + s * (w * B.len + 1);
    const midX = ex + s * w * 0.15;
    let inY = by - B.slope * 0.5 - (e.browIn + skew) * u1;
    let outY = by + B.slope * 0.5 + 1.2 - (e.browOut + skew) * u1;
    const midY = by - B.arch * fs - (e.browArch + (e.browIn + e.browOut) * 0.5 + skew) * u1;
    inX -= s * Math.max(0, -e.browIn) * 0.4 * u1;
    inY = Math.min(inY, ey - h * 0.15);
    if (B.uni) inX = cx + s * 0.4;
    let thick = B.thick * fs * (lod === 0 ? 1.15 : 1);
    if (B.singed && s === -g.dir) { outX = lerp(inX, outX, 0.42); outY = lerp(inY, outY, 0.42); thick *= 0.75; }
    const a: Pt = [inX, inY], c: Pt = [2 * midX - (inX + outX) / 2, 2 * midY - (inY + outY) / 2], z: Pt = [outX, outY];
    const bp: Pt[] = [0, 0.25, 0.5, 0.75, 1].map(t => quad(a, c, z, t));
    if (B.style === 'wing') bp.push([outX + s * 4.5 * fs, outY - 3.2 * fs], [outX + s * 8 * fs, outY - 7.5 * fs]);
    if (lod === 0) out['b' + K + '.d'] = curve(bp.slice(0, 5));
    else {
      const T = thick * (lod === 1 ? 1.12 : 1);
      const wf = B.style === 'arch' ? (t: number) => T * (0.4 + 0.65 * Math.sin(Math.PI * t))
        : B.style === 'ridge' ? (t: number) => T * (0.5 + 0.6 * Math.sin(Math.PI * t))
        : B.style === 'flat' ? (t: number) => T * 0.85 * (0.55 + 0.45 * Math.sin(Math.PI * t) ** 0.4)
        : B.style === 'thin' ? (t: number) => T * 0.62 * (1 - 0.55 * t)
        : B.style === 'wing' ? (t: number) => T * (t < 0.7 ? 0.5 + 0.75 * t : 1.03 * (1 - (t - 0.7) / 0.3) + 0.12)
        : B.style === 'bushy' ? (t: number) => T * 1.12 * (1 - 0.6 * t ** 1.4) * (t < 0.08 ? 0.75 : 1)
        : (t: number) => T * (1 - 0.74 * t ** 1.2) * (t < 0.08 ? 0.8 : 1);
      let d = ribbon(bp, wf);
      if (B.style === 'bushy' || B.style === 'wing') {
        for (const t of [0.12, 0.34, 0.56, 0.78]) {
          const p = quad(a, c, z, t), q = quad(a, c, z, t + 0.1);
          const hgt = T * (B.style === 'wing' ? 0.75 : 0.95) * (1 - t * 0.35);
          d += `M${f(p[0])} ${f(p[1])}L${f((p[0] + q[0]) / 2 + s * 1.4)} ${f(Math.min(p[1], q[1]) - hgt)}L${f(q[0])} ${f(q[1])}Z`;
        }
      }
      out['b' + K + '.d'] = d;
    }
  }

  // ── mouth
  const mxc = cx + g.dir * g.turn * 0.8 + e.skew * g.dir * 1.5 * fs;
  const W = M.w * fs * e.wide;
  const lift = W * 0.34;
  const sk = e.skew * g.dir * 0.75;
  const cl = M.y - (e.smile - sk) * lift, cr = M.y - (e.smile + sk) * lift;
  const sag = e.smile * W * 0.2;
  const yMid = (u: number) => lerp(cl, cr, (u + 1) / 2) + sag * (1 - u * u) + e.wob * 1.5 * fs * Math.sin(u * Math.PI * 1.5) * (1 - u * u * 0.4);
  const Hm = Math.max(W * 0.78, 7 * fs);
  const open = clamp(e.open, 0, 1.1);
  const yU = (u: number) => yMid(u) - open * Hm * 0.26 * Math.pow(1 - u * u, 0.8);
  const yL = (u: number) => yMid(u) + open * Hm * 0.84 * Math.pow(1 - u * u, 0.65);
  const N = lod === 0 ? 4 : 8;
  const us: number[] = [];
  for (let i = 0; i <= N; i++) us.push(-1 + (2 * i) / N);
  const X = (u: number) => mxc + u * W;
  const isOpen = open >= 0.07;
  const mouthW = (1.9 + Math.min(1, (M.lipU + M.lipL) * 0.2) * 0.5) * k * (lod === 1 ? 0.85 : 1);
  let ml = '', mi = '', mt = '', mg = '', mp = '', mk = '', mo = '';
  const midPts: Pt[] = us.map(u => [X(u), yMid(u)] as Pt);
  const upPts: Pt[] = us.map(u => [X(u), yU(u)] as Pt);
  const loPts: Pt[] = us.map(u => [X(u), yL(u)] as Pt);
  if (!isOpen) {
    ml = lod === 0 ? curve(midPts) : ribbon(midPts, taper.both(mouthW));
  } else {
    const loop = upPts.concat(loPts.slice(1, -1).reverse());
    mi = curve(loop, true);
    ml = lod === 0 ? mi : ribbon(loop, (_t, _nx, ny) => mouthW * (ny < 0 ? 0.95 : 0.6), true);
    // teeth
    const tf = clamp(e.teeth, 0, 1);
    if (M.teeth === 'goblin') {
      const n = lod === 0 ? 4 : 7;
      const zig = (yf: (u: number) => number, dirY: number) => {
        let d = '';
        for (let i = 0; i < n; i++) {
          const u0 = -0.88 + (1.76 * i) / n, u1b = -0.88 + (1.76 * (i + 1)) / n, um = (u0 + u1b) / 2;
          const gap = yL(um) - yU(um);
          const len = Math.min(gap * 0.56, 3.6 * fs) * (dirY > 0 ? 1 : 0.8);
          d += `M${f(X(u0))} ${f(yf(u0))}L${f(X(um))} ${f(yf(um) + dirY * len)}L${f(X(u1b))} ${f(yf(u1b))}Z`;
        }
        return d;
      };
      mt = zig(yU, 1) + (open > 0.3 ? zig(yL, -1) : '');
    } else if (tf > 0.05 && M.teeth !== 'tusks') {
      const full = tf >= 0.95;
      const th = full ? 99 : tf * Hm * 0.5;
      const strip = (ua: number, ub: number) => {
        const top: Pt[] = [], bot: Pt[] = [];
        for (let i = 0; i <= 5; i++) {
          const u = lerp(ua, ub, i / 5);
          const gap = yL(u) - yU(u);
          top.push([X(u), yU(u) + 0.2]); bot.push([X(u), yU(u) + Math.min(gap * (full ? 0.94 : 0.8), th)]);
        }
        return poly(top.concat(bot.reverse()), true);
      };
      mt = M.teeth === 'gap' ? strip(-0.84, -0.07) + strip(0.07, 0.84) : strip(-0.84, 0.84);
      if (M.goldTooth) mo = strip(0.24 * g.dir, 0.46 * g.dir);
      if (full && lod > 0 && open > 0.14) {
        // gritted: the line where the teeth meet, and the gaps between them
        const cm: Pt[] = us.filter(u => Math.abs(u) < 0.8).map(u => [X(u), (yU(u) + yL(u)) / 2] as Pt);
        ml += ribbon(cm, 0.7 * k);
        for (const u of [-0.45, -0.15, 0.15, 0.45]) ml += `M${f(X(u) - 0.3 * k)} ${f(yU(u))}L${f(X(u) + 0.3 * k)} ${f(yU(u))}L${f(X(u) + 0.3 * k)} ${f(yL(u))}L${f(X(u) - 0.3 * k)} ${f(yL(u))}Z`;
      }
    }
    if (open > 0.3 && tf < 0.95 && lod > 0) {
      const top: Pt[] = [], bot: Pt[] = [];
      for (let i = 0; i <= 6; i++) {
        const u = lerp(-0.62, 0.62, i / 6);
        const gap = yL(u) - yU(u);
        bot.push([X(u), yL(u) - 0.3]); top.push([X(u), yL(u) - Math.min(gap * 0.45, Hm * 0.34) * Math.sqrt(1 - (u / 0.62) ** 2)]);
      }
      mg = poly(bot.concat(top.reverse()), true);
    }
  }
  if (lod > 0) {
    // the little tucks at the corners of a smile or a scowl
    if (Math.abs(e.smile) > 0.25 || isOpen) {
      for (const s of [-1, 1]) {
        const cxn = X(s), cyn = s < 0 ? cl : cr;
        const up = e.smile >= 0 ? -1 : 1;
        ml += ribbon([[cxn - s * 0.6, cyn - up * 0.2], [cxn + s * 1.6 * fs, cyn + up * 0.9 * fs], [cxn + s * 2.4 * fs, cyn + up * 2.6 * fs * Math.min(1, Math.abs(e.smile) + 0.3)]], taper.out(mouthW * 0.8));
      }
    }
    if (lod === 2 && !g.shadowed) {
      const yb = (u: number) => yL(u) + (2.6 + M.lipL * 1.3) * fs;
      ml += ribbon([[X(-0.36), yb(-0.36) - 0.5], [X(0), yb(0)], [X(0.36), yb(0.36) - 0.5]], taper.both(0.85));
    }
    if (M.lipU > 0.3 || M.lipL > 0.3) {
      const upTop: Pt[] = [], loBot: Pt[] = [];
      const yTop = isOpen ? yU : yMid, yBot = isOpen ? yL : yMid;
      for (let i = 0; i <= 8; i++) {
        const u = -0.92 + (1.84 * i) / 8, a = 1 - (u / 0.92) ** 2;
        const bow = 1 - 0.28 * Math.exp(-(u * u) / 0.02);
        upTop.push([X(u), yTop(u) - M.lipU * 1.5 * fs * Math.pow(a, 0.6) * bow]);
        loBot.push([X(u), yBot(u) + M.lipL * 1.6 * fs * Math.pow(a, 0.55)]);
      }
      const edgeU: Pt[] = [], edgeL: Pt[] = [];
      for (let i = 8; i >= 0; i--) { const u = -0.92 + (1.84 * i) / 8; edgeU.push([X(u), yTop(u)]); edgeL.push([X(u), yBot(u)]); }
      if (M.lipU > 0.3) mp += poly(upTop.concat(edgeU), true);
      if (M.lipL > 0.3) mp += poly(loBot.concat(edgeL), true);
    }
  }
  // teeth that show whatever the mouth is doing
  const T = M.teeth;
  if (T === 'tusks') {
    for (const s of [-1, 1]) {
      const u = s * 0.56, x = X(u), y = yL(u) + 0.8 * fs, bw = 2.5 * fs * sc, hh = 7.4 * fs * sc;
      mk += `M${f(x - bw)} ${f(y)}Q${f(x - bw * 0.9)} ${f(y - hh * 0.7)} ${f(x + s * 0.8)} ${f(y - hh)}Q${f(x + bw * 1.05)} ${f(y - hh * 0.5)} ${f(x + bw)} ${f(y)}Z`;
    }
  } else if (T === 'buck') {
    const y = yU(0) - 0.2, hh = 3.5 * fs, bw = 2.1 * fs;
    mk = `M${f(mxc - bw - 0.2)} ${f(y)}L${f(mxc - bw - 0.1)} ${f(y + hh)}L${f(mxc - 0.2)} ${f(y + hh + 0.3)}L${f(mxc - 0.2)} ${f(y)}ZM${f(mxc + 0.2)} ${f(y)}L${f(mxc + 0.2)} ${f(y + hh + 0.3)}L${f(mxc + bw + 0.1)} ${f(y + hh)}L${f(mxc + bw + 0.2)} ${f(y)}Z`;
  } else if (T === 'snag') {
    const u = 0.34 * g.dir, x = X(u), y = yL(u) + 0.5;
    mk = `M${f(x - 1.5 * fs)} ${f(y)}L${f(x - 0.4)} ${f(y - 3.8 * fs)}L${f(x + 1.6 * fs)} ${f(y)}Z`;
  } else if (T === 'fangs') {
    for (const s of [-1, 1]) {
      const u = s * 0.66, x = X(u), y = yU(u) - 0.3;
      mk += `M${f(x - 1.5 * fs)} ${f(y)}L${f(x + s * 0.3)} ${f(y + 4.4 * fs)}L${f(x + 1.5 * fs)} ${f(y)}Z`;
    }
  }
  out['ml.d'] = ml; out['mi.d'] = mi; out['mt.d'] = mt;
  if (lod > 0) { out['mg.d'] = mg; out['mp.d'] = mp; }
  if (T === 'tusks' || T === 'buck' || T === 'snag' || T === 'fangs') out['mk.d'] = mk;
  if (M.goldTooth) out['mo.d'] = mo;

  // ── everything else a mood touches
  out['blush.opacity'] = f2(clamp(g.blush * e.blush, 0, 0.85));
  out['flush.opacity'] = f2(clamp(e.flush, 0, 1) * 0.2);
  out['pale.opacity'] = f2(clamp(e.pale, 0, 1) * 0.34);
  if (lod > 0) {
    out['sweat.opacity'] = f2(clamp(e.sweat, 0, 1));
    out['tear.opacity'] = f2(clamp(e.tear, 0, 1));
    out['furrow.opacity'] = f2(clamp(e.furrow, 0, 1));
  }
  const pivY = g.head.top + g.head.H + 4;
  const tr = `translate(${f(e.dx + (pose.jx ?? 0))} ${f(e.dy + (pose.jy ?? 0) + (pose.nod ?? 0))}) rotate(${f(e.tilt * g.dir * -1)} ${f(g.head.cx)} ${f(pivY)})`;
  out['hd.transform'] = tr; out['hb.transform'] = tr;
  if (g.ears.kind === 'goblin' || g.ears.kind === 'elf' || g.kind === 'dragon') {
    const droop = clamp(-e.smile * 0.55 + e.pale * 0.7 + e.tear * 0.5 - e.open * 0.15 - e.browSkew * 0.05, -0.7, 1) * (g.ears.kind === 'elf' ? 0.35 : 1);
    const ey2 = g.ears.y, hw = g.head.cheekTop;
    out['earL.transform'] = `rotate(${f(-droop * 15)} ${f(g.head.cx - hw)} ${f(ey2)})`;
    out['earR.transform'] = `rotate(${f(droop * 15)} ${f(g.head.cx + hw)} ${f(ey2)})`;
  }
  return out;
}
const f2 = (n: number): string => (Math.round(n * 100) / 100).toString();

/** Read one attribute of the initial frame (for writing it into the static markup). */
const at = (fr: FrameAttrs, key: string, attr: string): string => {
  const v = fr[key + '.' + attr];
  return v === undefined ? '' : ` ${attr}="${v}"`;
};

export interface FaceParts { eyes: string; brows: string; mouth: string; special: string }

/** The moving elements, written once with their first frame. */
export function faceMarkup(g: Genome, pen: Pen, fr: FrameAttrs): FaceParts {
  const lod = pen.lod, k = pen.k, fs = fsOf(lod);
  const E = g.eyes, B = g.brows, M = g.mouth;
  const patch = patchSide(g);
  let eyes = '', brows = '';
  const lidC = mix2(g.skin, g.skinShade, 0.6);
  for (const s of [-1, 1] as const) {
    const K = s < 0 ? 'L' : 'R';
    if (s !== patch) {
      eyes += `<path data-k="ew${K}"${at(fr, 'ew' + K, 'd')} fill="${E.white}"/>`;
      if (lod === 0) {
        eyes += `<g data-k="ir${K}"${at(fr, 'ir' + K, 'transform')}${at(fr, 'ir' + K, 'opacity')}><circle data-k="pp${K}"${at(fr, 'pp' + K, 'r')} fill="${pen.ink}"/></g>`;
        eyes += `<path data-k="el${K}"${at(fr, 'el' + K, 'd')} fill="none" stroke="${pen.ink}" stroke-width="${f(1.5 * k)}" stroke-linecap="round"/>`;
      } else {
        const id = pen.id();
        pen.defs += `<clipPath id="${id}"><path data-k="ec${K}"${at(fr, 'ec' + K, 'd')}/></clipPath>`;
        const r = E.irisR * fs;
        let iris = `<circle r="${f(r)}" fill="${E.iris}" stroke="${pen.ink}" stroke-width="${f(0.9 * k)}"/>`;
        if (lod === 2 && E.pupil !== 'slit') iris += `<path d="M${f(-r * 0.8)} ${f(r * 0.15)}A${f(r * 0.82)} ${f(r * 0.82)} 0 0 0 ${f(r * 0.8)} ${f(r * 0.15)}" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="${f(r * 0.3)}"/>`;
        iris += E.pupil === 'slit'
          ? `<ellipse data-k="pp${K}"${at(fr, 'pp' + K, 'rx')} ry="${f(r * 0.86)}" fill="${pen.ink}"/>`
          : `<circle data-k="pp${K}"${at(fr, 'pp' + K, 'r')} fill="${pen.ink}"/>`;
        iris += `<circle cx="${f(-r * 0.34)}" cy="${f(-r * 0.4)}" r="${f(Math.max(r * 0.24, 0.9))}" fill="#fffdf2"/>`;
        eyes += `<g clip-path="url(#${id})"><g data-k="ir${K}"${at(fr, 'ir' + K, 'transform')}>${iris}</g></g>`;
        eyes += `<path data-k="es${K}"${at(fr, 'es' + K, 'd')} fill="${lidC}"/>`;
        eyes += `<path data-k="eo${K}"${at(fr, 'eo' + K, 'd')} fill="${pen.ink}" opacity=".5"/>`;
        eyes += `<path data-k="el${K}"${at(fr, 'el' + K, 'd')} fill="${pen.ink}"/>`;
      }
    }
    brows += lod === 0
      ? `<path data-k="b${K}"${at(fr, 'b' + K, 'd')} fill="none" stroke="${B.color}" stroke-width="${f(clamp(B.thick, 2.6, 4.6) * 1.25)}" stroke-linecap="round"/>`
      : `<path data-k="b${K}"${at(fr, 'b' + K, 'd')} fill="${B.color}"/>`;
  }
  let mouth = '';
  const inside = g.kind === 'goblin' ? '#3a2422' : g.kind === 'dragon' ? '#5a1f1a' : '#4a1f1c';
  if (lod > 0) mouth += `<path data-k="mp"${at(fr, 'mp', 'd')} fill="${M.lip}" opacity=".5"/>`;
  mouth += `<path data-k="mi"${at(fr, 'mi', 'd')} fill="${inside}"/>`;
  if (lod > 0) mouth += `<path data-k="mg"${at(fr, 'mg', 'd')} fill="#b9574d"/>`;
  mouth += `<path data-k="mt"${at(fr, 'mt', 'd')} fill="${PIG.bone}"/>`;
  if (M.goldTooth) mouth += `<path data-k="mo"${at(fr, 'mo', 'd')} fill="${PIG.gold2}"/>`;
  mouth += lod === 0
    ? `<path data-k="ml"${at(fr, 'ml', 'd')} fill="none" stroke="${pen.ink}" stroke-width="${f(1.55 * k)}" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path data-k="ml"${at(fr, 'ml', 'd')} fill="${pen.ink}" fill-rule="evenodd"/>`;
  let special = '';
  if (fr['mk.d'] !== undefined) special = `<path data-k="mk"${at(fr, 'mk', 'd')} fill="${PIG.bone}" stroke="${pen.ink}" stroke-width="${f(0.8 * k)}" stroke-linejoin="round"/>`;
  return { eyes, brows, mouth, special };
}

function mix2(a: string, b: string, t: number): string {
  const A = parseInt(a.slice(1), 16), Bn = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(lerp((A >> sh) & 255, (Bn >> sh) & 255, t)).toString(16).padStart(2, '0');
  return '#' + ch(16) + ch(8) + ch(0);
}
