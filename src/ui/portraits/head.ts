/**
 * Portraits: the still parts of a head. Outline, ears, neck, nose, and the
 * marks a life leaves (wrinkles, freckles, scars, soot), plus spectacles and
 * the odd quill behind the ear.
 */
import { clamp, lerp, f, curve, mirror, sample, arc, ellipse, rot, mixc, shadeOf, type Pt } from './util';
import { PIG } from './pigments';
import type { Genome } from './types';
import type { Pen } from './pen';
import { faceX, eyeBox, patchSide } from './features';

export interface Geo {
  cx: number; top: number; chin: number; H: number;
  /** control points of the head outline */
  outline: Pt[];
  /** half-width of the head at height y */
  hw(y: number): number;
  /** feature column x */
  fx: number;
  eyeY: number; noseY: number; mouthY: number;
  /** where a hat band sits on the forehead */
  band: number;
  /** base of the neck (where the collar closes) */
  nb: number;
  earY: number;
}

export function headPts(g: Genome): Pt[] {
  const h = g.head, { cx, top, H } = h;
  const y7 = top + H * lerp(0.945, 0.985, h.chinFlat);
  const right: Pt[] = [
    [cx + h.skull * 0.5, top + H * 0.03],
    [cx + h.skull * 0.9, top + H * 0.14],
    [cx + h.skull, top + H * 0.31],
    [cx + h.cheekTop, top + H * 0.5],
    [cx + h.cheek, top + H * 0.66],
    [cx + h.jaw, top + H * h.jawY],
    [cx + h.chinW, y7],
  ];
  return [[cx, top] as Pt, ...right, [cx, top + H] as Pt, ...mirror(right, cx).reverse()];
}

export function geometry(g: Genome): Geo {
  const h = g.head;
  const outline = headPts(g);
  const dense = sample(outline, true, 8).filter(p => p[0] >= h.cx - 0.01).sort((a, b) => a[1] - b[1]);
  const hw = (y: number): number => {
    if (y <= dense[0][1]) return 0;
    for (let i = 1; i < dense.length; i++) {
      if (dense[i][1] >= y) {
        const a = dense[i - 1], b = dense[i];
        const t = b[1] === a[1] ? 0 : (y - a[1]) / (b[1] - a[1]);
        return lerp(a[0], b[0], t) - h.cx;
      }
    }
    return 0;
  };
  const chin = h.top + h.H;
  return {
    cx: h.cx, top: h.top, chin, H: h.H, outline, hw, fx: faceX(g),
    eyeY: g.eyes.y, noseY: g.noseY, mouthY: g.mouth.y,
    band: Math.min(h.top + h.H * 0.2, g.eyes.y - g.eyes.h - g.brows.gapY - 9),
    nb: chin + g.garb.neckLen * 0.55, earY: g.ears.y,
  };
}

// ───────────── ears ─────────────

/** One ear's outline (right side when s = 1). */
export function earPts(g: Genome, geo: Geo, s: 1 | -1): Pt[] {
  const z = g.ears.size, ey = geo.earY;
  const hx = geo.cx + geo.hw(ey) - 1.5;
  let p: Pt[];
  switch (g.ears.kind) {
    case 'elf':
      p = [[hx - 2, ey - 6], [hx + 5 * z, ey - 14 * z], [hx + 13 * z, ey - 27 * z], [hx + 9.5 * z, ey - 9 * z], [hx + 6, ey + 4], [hx + 2.5, ey + 9], [hx - 2, ey + 7]];
      break;
    case 'goblin': {
      const d = (g.seed % 7) - 3;
      p = [[hx - 3, ey - 9], [hx + 11 * z, ey - 15 * z], [hx + 25 * z, ey - 15 * z + d * 0.6], [hx + 39 * z, ey - 11 * z + d * 1.6], [hx + 27 * z, ey - 2 * z + d], [hx + 19 * z, ey + 6 * z], [hx + 9 * z, ey + 10], [hx - 3, ey + 9]];
      break;
    }
    case 'small':
      p = ellipse(hx + 2.5 * z, ey + 2, 4.6 * z, 6.2 * z, 8);
      break;
    case 'leaf':
      p = [[hx - 2, ey - 6], [hx + 3.5 * z, ey - 10.5 * z], [hx + 8 * z, ey - 12.5 * z], [hx + 7.4 * z, ey - 3], [hx + 5.2 * z, ey + 5], [hx + 1.5, ey + 8.5], [hx - 2, ey + 6]];
      break;
    default:
      p = [[hx - 2, ey - 6.5 * z], [hx + 3.2 * z, ey - 9.5 * z], [hx + 6.8 * z, ey - 6 * z], [hx + 6.6 * z, ey + 1], [hx + 4 * z, ey + 7.5 * z], [hx + 0.5, ey + 8.5 * z], [hx - 2, ey + 6]];
  }
  return s === 1 ? p : mirror(p, geo.cx);
}
export function drawEar(g: Genome, geo: Geo, pen: Pen, s: 1 | -1): string {
  if (g.ears.kind === 'none') return '';
  const p = earPts(g, geo, s);
  const key = s < 0 ? 'earL' : 'earR';
  let out = pen.blob(p, g.skin, { w: 1.5, shade: g.skinShade, shadeLod: 2, sx: 2.5 * (s < 0 ? -0.4 : 1), sy: 2 });
  if (pen.mid) {
    const z = g.ears.size, ey = geo.earY, hx = geo.cx + geo.hw(ey) - 1.5;
    let inner: Pt[];
    if (g.ears.kind === 'goblin') inner = [[hx + 3, ey - 5], [hx + 14 * z, ey - 9 * z], [hx + 27 * z, ey - 9 * z], [hx + 17 * z, ey - 1], [hx + 7 * z, ey + 4]];
    else if (g.ears.kind === 'elf') inner = [[hx + 1.5, ey - 3], [hx + 6 * z, ey - 12 * z], [hx + 9.5 * z, ey - 19 * z], [hx + 6 * z, ey - 4], [hx + 3, ey + 4]];
    else inner = [[hx + 1.5, ey - 3.5 * z], [hx + 4.2 * z, ey - 4.5 * z], [hx + 3.4 * z, ey + 1], [hx + 1.8, ey + 3.5 * z]];
    if (s < 0) inner = mirror(inner, geo.cx);
    if (g.ears.kind === 'goblin' || g.ears.kind === 'elf') out += pen.fill(inner, mixc(g.skin, g.blushC, 0.45), 0.55);
    else out += pen.line(inner, 1, { op: 0.6 });
  }
  const m = g.marks.earring;
  if (m === 'ring' && pen.mid) {
    const lobe = g.ears.kind === 'goblin' ? p[5] : p[p.length - 2];
    out += `<circle cx="${f(lobe[0])}" cy="${f(lobe[1] + 2.4)}" r="${f(2.6)}" fill="none" stroke="${PIG.gold}" stroke-width="${f(1.3 * pen.k)}"/>`;
    if (pen.fine) out += `<circle cx="${f(lobe[0])}" cy="${f(lobe[1] + 2.4)}" r="3.3" fill="none" stroke="${pen.ink}" stroke-width=".5"/>`;
  }
  return `<g data-k="${key}">${out}</g>`;
}

// ───────────── neck ─────────────

export function drawNeck(g: Genome, geo: Geo, pen: Pen): string {
  const nw = g.garb.neckW, top = geo.chin - geo.H * 0.2, bot = geo.nb + 26;
  const neckC = mixc(g.skin, g.skinShade, 0.55);
  const p: Pt[] = [[geo.cx - nw, top], [geo.cx - nw * 1.04, (top + bot) / 2], [geo.cx - nw * 1.3, bot], [geo.cx + nw * 1.3, bot], [geo.cx + nw * 1.04, (top + bot) / 2], [geo.cx + nw, top]];
  let out = pen.blob(p, neckC, { w: 1.4, wob: 0.2 });
  if (pen.mid) out += pen.fill([[geo.cx - nw, top], [geo.cx + nw, top], [geo.cx + nw * 0.9, geo.chin + 5], [geo.cx, geo.chin + 8], [geo.cx - nw * 0.9, geo.chin + 5]], g.skinShade, 0.7);
  return out;
}

// ───────────── nose ─────────────

export function drawNose(g: Genome, geo: Geo, pen: Pen): string {
  const N = g.nose, d = g.dir, ox = geo.fx + d * g.turn * 1.2, oy = geo.eyeY;
  const P = (u: number, v: number): Pt => [ox + d * u, oy + v];
  const L = N.len, o = N.out, t = N.tip, w = N.wide;
  let line: Pt[] = [], wing: Pt[] = [], out = '';
  const extra: string[] = [];
  switch (N.kind) {
    case 'button':
      line = [P(-t + o * 0.4, L - t * 0.9), P(-t * 0.5 + o * 0.5, L + t * 0.25), P(o * 0.5 + t * 0.4, L + t * 0.3), P(o * 0.5 + t, L - t * 0.8)];
      break;
    case 'snub':
      line = [P(1.2, -1), P(0.6, L * 0.45), P(o * 0.75, L - t * 1.25), P(o + t * 0.3, L - t * 0.7), P(o * 0.7, L + t * 0.1), P(-0.4, L + t * 0.2)];
      wing = [P(-w * 0.3, L + t * 0.3), P(-w * 0.95, L - t * 0.2), P(-w * 0.8, L - t * 1.1)];
      break;
    case 'roman':
      line = [P(1.4, -3), P(o * 0.55 + 2.2, L * 0.34), P(o * 0.85 + 1.2, L * 0.62), P(o, L - t * 0.5), P(o * 0.72, L + t * 0.75), P(o * 0.1, L + t * 0.25)];
      wing = [P(-w * 0.3, L + t * 0.35), P(-w * 0.95, L - t * 0.1), P(-w * 0.8, L - t * 1.1)];
      break;
    case 'bulb':
      line = [P(1.3, L * 0.3), P(o * 0.4 + 1.5, L - t * 1.5), P(o * 0.6 + t, L - t * 0.5), P(o * 0.6 + t * 0.6, L + t * 0.7), P(o * 0.6 - t * 0.6, L + t * 0.75), P(o * 0.6 - t * 1.05, L)];
      wing = [P(-w * 0.45, L + t * 0.4), P(-w, L - t * 0.1), P(-w * 0.8, L - t * 0.9)];
      break;
    case 'potato':
      line = [P(1.6, L * 0.25), P(o * 0.5 + 2.4, L - t * 1.4), P(o * 0.5 + t * 1.05, L - t * 0.3), P(o * 0.5 + t * 0.5, L + t * 0.7), P(o * 0.5 - t * 0.7, L + t * 0.75), P(o * 0.5 - t * 1.1, L + 0.2)];
      wing = [P(-w * 0.4, L + t * 0.5), P(-w * 1.05, L + 0.2), P(-w, L - t * 0.9), P(-w * 0.55, L - t * 1.1)];
      extra.push(pen.line([P(o * 0.5 + t * 1.15, L - t * 0.2), P(w * 0.9 + o * 0.4, L + t * 0.3), P(w * 0.75 + o * 0.3, L + t * 0.8)], 1.1));
      break;
    case 'pointed':
      line = [P(1.2, -3), P(o * 0.5 + 1, L * 0.5), P(o + 0.6, L - 0.8), P(o * 0.55, L + 1.6), P(0, L + 0.8)];
      wing = [P(-w * 0.3, L + 1), P(-w * 0.9, L - 0.2), P(-w * 0.75, L - 2.6)];
      break;
    case 'broken':
      line = [P(1.4, -3), P(3.8, L * 0.28), P(1, L * 0.5), P(o * 0.9, L - t * 0.6), P(o * 0.7, L + t * 0.5), P(0, L + t * 0.3)];
      wing = [P(-w * 0.3, L + t * 0.4), P(-w * 0.95, L - 0.1), P(-w * 0.8, L - t)];
      break;
    case 'broad':
      line = [P(-w * 0.55 + o * 0.3, L + t * 0.1), P(-w * 0.2 + o * 0.3, L + t * 0.55), P(o * 0.3 + w * 0.2, L + t * 0.55), P(o * 0.3 + w * 0.55, L + t * 0.1)];
      wing = [P(-w * 0.5 + o * 0.3, L + t * 0.35), P(-w * 1.02 + o * 0.3, L - 0.2), P(-w * 0.85 + o * 0.3, L - t)];
      extra.push(pen.line([P(w * 0.5 + o * 0.3, L + t * 0.35), P(w * 1.02 + o * 0.3, L - 0.2), P(w * 0.85 + o * 0.3, L - t)], 1.4));
      break;
    case 'droop':
      line = [P(1.3, -3), P(o * 0.5 + 1.8, L * 0.45), P(o * 0.95, L - t * 0.6), P(o * 0.85, L + t * 0.7), P(o * 0.35, L + t * 0.5), P(o * 0.1, L - t * 0.4)];
      wing = [P(-w * 0.2, L - t * 0.2), P(-w * 0.9, L - t * 0.6), P(-w * 0.75, L - t * 1.6)];
      break;
    default: // straight
      line = [P(1.3, -3), P(o * 0.42 + 1.2, L * 0.5), P(o, L - t * 0.7), P(o + t * 0.2, L - t * 0.1), P(o * 0.6, L + t * 0.55), P(-0.2, L + t * 0.3)];
      wing = [P(-w * 0.3, L + t * 0.4), P(-w * 0.95, L - 0.1), P(-w * 0.8, L - t)];
  }
  if (pen.mid && N.kind !== 'button' && N.kind !== 'broad') {
    // wash down the far side of the bridge
    out += pen.fill([P(1, L * 0.1), P(o * 0.35, L * 0.55), P(o * 0.4, L + t * 0.3), P(-w * 0.75, L + t * 0.2), P(-w * 0.5, L * 0.55), P(-1.6, L * 0.2)], g.skinShade, 0.5);
  }
  if (pen.mid) out += `<ellipse cx="${f(ox + d * o * 0.2)}" cy="${f(oy + L + t * 1.05)}" rx="${f(w * 0.85)}" ry="${f(1.5)}" fill="${g.skinShade}" opacity=".55"/>`;
  if (N.red > 0) {
    const c = P(N.kind === 'button' ? o * 0.5 : o * 0.62, L - t * 0.2);
    out += `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(t * 1.25 + 0.6)}" fill="#c8402f" opacity="${(0.34 * N.red).toFixed(2)}"/>`;
  }
  out += pen.line(line, 1.75, { tp: 'both' });
  if (wing.length && pen.lod > 0) out += pen.line(wing, 1.35, { tp: 'out' });
  if (pen.lod > 0) out += extra.join('');
  if (pen.fine && (N.kind === 'snub' || N.kind === 'button' || N.kind === 'broad')) {
    const a = P(o * 0.5 - w * 0.34, L - t * 0.05), b = P(o * 0.5 + w * 0.34, L - t * 0.05);
    out += `<ellipse cx="${f(a[0])}" cy="${f(a[1])}" rx="1.1" ry=".8" fill="${pen.ink}" opacity=".75"/><ellipse cx="${f(b[0])}" cy="${f(b[1])}" rx="1.1" ry=".8" fill="${pen.ink}" opacity=".75"/>`;
  }
  return out;
}

// ───────────── skin: blush, moods' overlays, marks ─────────────

export function cheekPos(g: Genome, geo: Geo): { x: number; y: number; rx: number; ry: number } {
  const k = g.head.cheek / 34;
  return { x: g.eyes.gap + 4.5 * k, y: lerp(geo.noseY, geo.mouthY, 0.35) - 1, rx: 8.2 * k * g.fscale, ry: 5.6 * k * g.fscale };
}
export function drawBlush(g: Genome, geo: Geo, pen: Pen, opacity: string): string {
  const c = cheekPos(g, geo);
  let s = '';
  for (const side of [-1, 1]) {
    const x = geo.fx + side * c.x * (side === g.dir ? 1 - 0.06 * g.turn : 1);
    s += `<ellipse cx="${f(x)}" cy="${f(c.y)}" rx="${f(c.rx)}" ry="${f(c.ry)}" fill="${g.blushC}" opacity=".55"/>`;
    if (pen.mid) s += `<ellipse cx="${f(x)}" cy="${f(c.y + 0.3)}" rx="${f(c.rx * 0.62)}" ry="${f(c.ry * 0.6)}" fill="${g.blushC}" opacity=".6"/>`;
  }
  return `<g data-k="blush" opacity="${opacity}">${s}</g>`;
}

export function drawMarks(g: Genome, geo: Geo, pen: Pen): string {
  const m = g.marks, r = pen.r.fork('marks'), fx = geo.fx;
  const eb = eyeBox(g, pen.lod, 1), ebL = eyeBox(g, pen.lod, -1);
  let s = '';
  const wr = m.wrinkles;
  if (pen.fine && wr > 0.15) {
    // forehead
    const n = Math.round(wr * 3);
    const y0 = geo.eyeY - g.eyes.h - g.brows.gapY - 7;
    for (let i = 0; i < n; i++) {
      const y = y0 - i * 4.2, half = geo.hw(y) * (0.5 - i * 0.07);
      if (y < geo.band + 2) break;
      s += pen.line([[fx - half, y + r.jit(0.8)], [fx - half * 0.3, y - 1 + r.jit(0.8)], [fx + half * 0.3, y + 0.6 + r.jit(0.8)], [fx + half, y - 0.4 + r.jit(0.8)]], 0.9, { op: 0.45 + wr * 0.25 });
    }
    // crow's feet
    if (wr > 0.4) for (const b of [eb, ebL]) {
      const sd = b === eb ? 1 : -1;
      for (const a of [-0.5, 0.1, 0.6]) s += pen.line([[b.ox + sd * 1.8, b.oy + a], [b.ox + sd * (4.6 + wr), b.oy + a * 4.2 - 0.6]], 0.75, { op: 0.5, tp: 'out' });
    }
  }
  if (pen.mid && (wr > 0.5 || (pen.fine && wr > 0.25))) {
    // nose-to-mouth folds
    for (const sd of [-1, 1]) {
      const x0 = fx + sd * (g.nose.wide + 2.2), x1 = fx + sd * (g.mouth.w + 4);
      s += pen.line([[x0, geo.noseY - 1], [x0 + sd * 2.4, (geo.noseY + geo.mouthY) / 2], [x1, geo.mouthY + 1.5]], 0.95, { op: 0.4 + wr * 0.25, tp: 'both' });
    }
  }
  if (pen.fine && wr > 0.85) for (const sd of [-1, 1]) {
    const x = fx + sd * (g.mouth.w + 7);
    s += pen.line([[x, geo.mouthY + 4], [x + sd * 1.5, geo.mouthY + 10], [x - sd * 1.5, geo.mouthY + 14]], 0.8, { op: 0.45 });
  }
  if (pen.mid && g.eyes.bag > 0.3) for (const b of [eb, ebL]) {
    if (patchSide(g) === (b === eb ? 1 : -1)) continue;
    const y = b.ey + b.low + 2.6 + g.eyes.bag;
    s += pen.line([[b.ex - b.w * 0.75, y - 1.2], [b.ex, y + 0.6 + g.eyes.bag], [b.ex + b.w * 0.75, y - 1.2]], 0.85, { op: 0.35 + g.eyes.bag * 0.25 });
  }
  if (m.doubleChin && pen.mid) {
    const y = geo.chin - Math.max(5.5, geo.H * 0.07), half = Math.max(g.head.chinW * 1.25, 12);
    s += pen.line([[geo.cx - half, y - 3], [geo.cx - half * 0.4, y + 0.6], [geo.cx + half * 0.4, y + 0.6], [geo.cx + half, y - 3]], 1.05, { op: 0.6 });
  }
  if (m.freckles > 0 && pen.mid) {
    const n = Math.round((pen.fine ? 18 : 8) * m.freckles), c = mixc(g.skin, '#8a4a2a', 0.55), ch = cheekPos(g, geo);
    for (let i = 0; i < n; i++) {
      const sd = i % 2 ? 1 : -1, onNose = i % 5 === 0;
      const x = onNose ? fx + r.jit(4) : fx + sd * (ch.x + r.jit(ch.rx * 0.9));
      const y = onNose ? geo.noseY - g.nose.len * 0.45 + r.jit(2.5) : ch.y - 2.5 + r.jit(4.2);
      s += pen.dot(x, y, pen.fine ? r.range(0.5, 0.95) : 1.1, c, 0.75);
    }
  }
  if (m.mole && pen.mid) {
    const sd = -g.dir, x = fx + sd * (g.mouth.w + 3.5), y = geo.mouthY - 4.5;
    s += pen.dot(x, y, 1.25 * (pen.fine ? 1 : 1.3), mixc(g.skin, PIG.ink, 0.72));
    if (pen.fine && g.age > 0.6) s += pen.line([[x, y], [x + sd * 2, y - 2.8]], 0.5, { tp: 'out' });
  }
  if (m.scar !== 'none' && pen.mid) {
    const sd = g.dir, c = mixc(g.skin, '#b05a4a', 0.55);
    let a: Pt, b: Pt;
    if (m.scar === 'cheek') { a = [fx + sd * (g.eyes.gap + 3), geo.eyeY + g.eyes.h + 4]; b = [fx + sd * (g.eyes.gap - 3), geo.mouthY - 2]; }
    else if (m.scar === 'brow') { a = [fx + sd * (g.eyes.gap + 2.5), geo.eyeY - g.eyes.h - g.brows.gapY - 6]; b = [fx + sd * (g.eyes.gap + 0.5), geo.eyeY + g.eyes.h + 5]; }
    else { a = [fx + sd * (g.mouth.w * 0.5), geo.mouthY - 6]; b = [fx + sd * (g.mouth.w * 0.62), geo.mouthY + 5.5]; }
    s += pen.line([a, [(a[0] + b[0]) / 2 + 0.8, (a[1] + b[1]) / 2], b], 1.5, { c, tp: 'both' });
    if (pen.fine) for (const t of [0.25, 0.5, 0.75]) {
      const x = lerp(a[0], b[0], t), y = lerp(a[1], b[1], t);
      s += pen.line([[x - 2, y - 0.6], [x + 2, y + 0.6]], 0.8, { c: mixc(c, PIG.ink, 0.3), tp: 'flat', wob: 0 });
    }
  }
  const smudge = (color: string, op: number, n: number, where: 'face' | 'brow') => {
    let o = '';
    for (let i = 0; i < n; i++) {
      const sd = i % 2 ? g.dir : -g.dir;
      const x = where === 'brow' ? fx + r.jit(12) : fx + sd * (g.eyes.gap + r.range(-2, 6));
      const y = where === 'brow' ? geo.eyeY - g.eyes.h - g.brows.gapY - r.range(6, 11) : geo.noseY + r.range(-4, 8);
      o += pen.fill(rot(ellipse(x, y, r.range(3, 5.5), r.range(1.6, 2.8), 7), r.range(-40, 40), x, y).map(p => [p[0] + r.jit(0.7), p[1] + r.jit(0.7)] as Pt), color, op);
    }
    return o;
  };
  if (m.soot) s += smudge(PIG.soot, 0.4, pen.mid ? 3 : 1, 'face') + (pen.mid ? smudge(PIG.soot, 0.3, 1, 'brow') : '');
  if (m.flour) {
    s += smudge(PIG.flour, 0.85, pen.mid ? 2 : 1, 'face');
    if (pen.mid) s += pen.dot(fx + g.dir * (g.nose.out * 0.6), geo.noseY - 1.5, 2.2, PIG.flour, 0.85);
  }
  if (m.mud) s += smudge('#6b4a2c', 0.5, pen.mid ? 2 : 1, 'face');
  if (m.inkstain && pen.mid) {
    const x = fx - g.dir * (g.eyes.gap + 4), y = geo.noseY + 3;
    s += pen.fill(ellipse(x, y, 2.6, 2, 7).map(p => [p[0] + r.jit(0.8), p[1] + r.jit(0.8)] as Pt), '#26304a', 0.8) + pen.dot(x + 3.4, y + 2.6, 0.8, '#26304a', 0.8);
  }
  return s;
}

/** Furrows, sweat, a tear, a flush: drawn once, faded in by the mood. */
export function drawMoodOverlays(g: Genome, geo: Geo, pen: Pen, fr: Record<string, string>): { under: string; over: string } {
  const headD = curve(geo.outline, true);
  let under = `<path data-k="flush" d="${headD}" fill="#b62f1f" opacity="${fr['flush.opacity'] ?? 0}"/>`;
  under += `<path data-k="pale" d="${headD}" fill="${g.kind === 'goblin' || g.kind === 'ogre' || g.kind === 'dragon' ? '#e6ecd8' : '#eef0e6'}" opacity="${fr['pale.opacity'] ?? 0}"/>`;
  let over = '';
  if (pen.mid) {
    const fx = geo.fx, by = geo.eyeY - g.eyes.h - g.brows.gapY;
    over += `<g data-k="furrow" opacity="${fr['furrow.opacity'] ?? 0}">${pen.line([[fx - 2.2, by - 5], [fx - 1.2, by + 2.5]], 1.2, { tp: 'both', wob: 0 })}${pen.line([[fx + 2.4, by - 4.5], [fx + 1.4, by + 2.5]], 1.2, { tp: 'both', wob: 0 })}</g>`;
    const sx = geo.cx - g.dir * (geo.hw(by - 6) - 7), sy = by - 9;
    const drop = (x: number, y: number, z: number, c: string) => `<path d="M${f(x)} ${f(y - 3.6 * z)}C${f(x + 2.6 * z)} ${f(y - 0.6 * z)} ${f(x + 2.4 * z)} ${f(y + 2.6 * z)} ${f(x)} ${f(y + 2.6 * z)}C${f(x - 2.4 * z)} ${f(y + 2.6 * z)} ${f(x - 2.6 * z)} ${f(y - 0.6 * z)} ${f(x)} ${f(y - 3.6 * z)}Z" fill="${c}" stroke="${pen.ink}" stroke-width="${f(0.7 * pen.k)}"/>`;
    over += `<g data-k="sweat" opacity="${fr['sweat.opacity'] ?? 0}">${drop(sx, sy, 1.25, '#cfe6ee')}${pen.fine ? drop(sx - g.dir * 5.5, sy + 9, 0.8, '#cfe6ee') : ''}</g>`;
    const eb = eyeBox(g, pen.lod, (patchSide(g) === g.dir ? -g.dir : g.dir) as 1 | -1);
    over += `<g data-k="tear" opacity="${fr['tear.opacity'] ?? 0}">${drop(eb.ex + (eb.ox - eb.ex) * 0.55, eb.ey + eb.low + 6.5, 1.05, '#cfe6ee')}</g>`;
  }
  return { under, over };
}

// ───────────── things worn on the face ─────────────

export function drawSpecs(g: Genome, geo: Geo, pen: Pen): string {
  const kind = g.marks.specs;
  if (kind === 'none' || pen.lod === 0) return '';
  const L = eyeBox(g, pen.lod, -1), R = eyeBox(g, pen.lod, 1);
  const rim = kind === 'tiny' || kind === 'halfmoon' || kind === 'monocle' ? PIG.goldInk : pen.ink;
  const sw = f((kind === 'round' ? 1.5 : 1.25) * pen.k);
  const lens = (cx: number, cy: number, rx: number, ry: number) =>
    `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="#e9f3ee" fill-opacity=".22" stroke="${rim}" stroke-width="${sw}"/>`
    + (pen.fine ? `<path d="M${f(cx - rx * 0.55)} ${f(cy - ry * 0.25)}L${f(cx - rx * 0.1)} ${f(cy - ry * 0.7)}" stroke="#fff" stroke-opacity=".6" stroke-width="1" stroke-linecap="round"/>` : '');
  let s = '';
  if (kind === 'round') {
    const r = Math.max(L.w, L.h) + 3.4;
    s += lens(L.ex, L.ey + 0.5, r, r * 0.94) + lens(R.ex, R.ey + 0.5, r, r * 0.94);
    s += pen.line([[L.ex + r, L.ey], [(L.ex + R.ex) / 2, L.ey - 2.4], [R.ex - r, R.ey]], 1.3, { c: rim, tp: 'flat', wob: 0 });
    s += pen.line([[L.ex - r, L.ey - 1], [geo.cx - geo.hw(L.ey) - 1, L.ey - 3]], 1.1, { c: rim, tp: 'flat', wob: 0 }) + pen.line([[R.ex + r, R.ey - 1], [geo.cx + geo.hw(R.ey) + 1, R.ey - 3]], 1.1, { c: rim, tp: 'flat', wob: 0 });
  } else if (kind === 'monocle') {
    const E = g.dir === 1 ? R : L, r = Math.max(E.w, E.h) + 2.6;
    s += lens(E.ex, E.ey + 0.6, r, r);
    if (pen.mid) s += pen.line([[E.ex + g.dir * r * 0.7, E.ey + r * 0.75], [E.ex + g.dir * (r + 5), E.ey + 22], [E.ex + g.dir * (r + 2), geo.chin + 14]], 0.8, { c: PIG.goldInk, tp: 'flat' });
  } else {
    // pince-nez, tiny lenses and half-moons all sit low, on the nose
    const drop = kind === 'pince' ? 3.4 : 6.2, rx = kind === 'pince' ? L.w * 0.86 : L.w * 0.7, ry = kind === 'pince' ? rx * 0.92 : rx * 0.66;
    const gap = Math.max(g.nose.wide * 0.5 + rx + 0.6, g.eyes.gap * 0.66);
    const y = geo.eyeY + drop;
    if (kind === 'halfmoon') {
      for (const sd of [-1, 1]) {
        const cx = geo.fx + sd * gap;
        s += `<path d="M${f(cx - rx - 1)} ${f(y)}A${f(rx + 1)} ${f(ry + 2.2)} 0 0 0 ${f(cx + rx + 1)} ${f(y)}Z" fill="#e9f3ee" fill-opacity=".25" stroke="${rim}" stroke-width="${sw}" stroke-linejoin="round"/>`;
      }
    } else s += lens(geo.fx - gap, y, rx, ry) + lens(geo.fx + gap, y, rx, ry);
    s += pen.line(arc(geo.fx, y - 0.4, gap - rx, 2.6, 180, 360, 5), 1.15, { c: rim, tp: 'flat', wob: 0 });
    if (kind === 'pince' && pen.mid) s += pen.line([[geo.fx - g.dir * (gap + rx), y + 1], [geo.fx - g.dir * (gap + rx + 4), y + 16], [geo.fx - g.dir * (gap + rx - 1), geo.chin + 8]], 0.7, { c: pen.ink, tp: 'flat', op: 0.8 });
  }
  return s;
}

export function drawPatch(g: Genome, geo: Geo, pen: Pen): string {
  const side = patchSide(g);
  if (!side) return '';
  const b = eyeBox(g, pen.lod, side as 1 | -1);
  const c = '#2b2424';
  let s = pen.line([[b.ex - side * (b.w + 1), b.ey - b.h - 1], [geo.fx - side * 6, geo.eyeY - g.eyes.h - g.brows.gapY - 12], [geo.cx - side * (geo.hw(geo.band + 4) - 1), geo.band + 5]], 1.7, { c, tp: 'flat', wob: 0 });
  s += pen.line([[b.ex + side * (b.w + 1), b.ey - 1], [geo.cx + side * (geo.hw(b.ey - 4) + 0.5), b.ey - 5]], 1.7, { c, tp: 'flat', wob: 0 });
  s += pen.blob([[b.ex - b.w - 2.5, b.ey - b.h - 2], [b.ex, b.ey - b.h - 3.5], [b.ex + b.w + 2.5, b.ey - b.h - 2], [b.ex + b.w + 1.5, b.ey + b.h * 0.6], [b.ex, b.ey + b.h + 3.5], [b.ex - b.w - 1.5, b.ey + b.h * 0.6]], c, { w: 1.2 });
  return s;
}

/** A quill tucked behind the ear (scribes, clerks, stewards, most goblins). */
export function drawQuill(g: Genome, geo: Geo, pen: Pen): string {
  if (!g.marks.quill) return '';
  const s = -g.dir, ey = geo.earY, x0 = geo.cx + s * (geo.hw(ey) + 1), y0 = ey - 2;
  const x1 = x0 + s * 13, y1 = y0 - 40;
  const vane: Pt[] = [[x0 + s * 3, y0 - 9], [x0 + s * 11.5, y0 - 20], [x1 + s * 3, y1 + 6], [x1, y1], [x1 - s * 5.5, y1 + 12], [x0 + s * 1, y0 - 16]];
  let out = pen.blob(vane, PIG.linen, { w: 1.1, shade: '#cfc5aa', sx: s * 2, sy: 0 });
  out += pen.line([[x0, y0 + 3], [x0 + s * 6.5, y0 - 18], [x1, y1]], 1, { tp: 'flat' });
  if (pen.fine) for (const t of [0.4, 0.55, 0.7, 0.85]) {
    const x = lerp(x0, x1, t) + s * 1.2, y = lerp(y0, y1, t);
    out += pen.line([[x, y], [x + s * 4.2, y - 3.5]], 0.5, { tp: 'out', op: 0.6 }) + pen.line([[x, y], [x - s * 3.6, y - 4]], 0.5, { tp: 'out', op: 0.6 });
  }
  return out;
}

/** Things held in the corner of the mouth, and flowers at the temple. */
export function drawMouthProps(g: Genome, geo: Geo, pen: Pen): string {
  if (pen.lod === 0) return '';
  const m = g.marks, d = g.dir;
  let s = '';
  const mx = geo.fx + d * g.mouth.w * 0.8, my = geo.mouthY + 0.3;
  if (m.stalk) {
    const ex = mx + d * 27, ey = my + 9;
    s += pen.line([[mx, my], [mx + d * 13, my + 2.5], [ex, ey]], 1.2, { c: PIG.strawDark, tp: 'flat' });
    for (let i = 0; i < 4; i++) {
      const x = ex + d * i * 2.6, y = ey + i * 1.3;
      s += pen.blob(rot(ellipse(x, y, 2.3, 1.2, 6), d * 28, x, y), PIG.straw, { w: 0.7, wob: 0 });
    }
  } else if (m.pipe) {
    s += pen.line([[mx, my], [mx + d * 12, my + 5], [mx + d * 17, my + 4]], 1.7, { c: PIG.bone, tp: 'flat' });
    s += pen.blob([[mx + d * 15.5, my - 1], [mx + d * 21, my - 1.4], [mx + d * 20.4, my + 6.5], [mx + d * 16, my + 6.5]], PIG.bone, { w: 1 });
    if (pen.mid) s += `<g class="llp-smoke">${pen.line([[mx + d * 18, my - 4], [mx + d * 16, my - 10], [mx + d * 19.5, my - 16], [mx + d * 17, my - 23]], 1.2, { c: '#efe9dc', op: 0.65, tp: 'in' })}</g>`;
  }
  if (m.flower && g.hat.kind === 'none') {
    const x = geo.cx - d * (geo.hw(geo.band + 8) - 1), y = geo.band + 6;
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; s += pen.dot(x + Math.cos(a) * 3.3, y + Math.sin(a) * 3.3, 2.5, PIG.linen); }
    s += pen.bead(x, y, 2.1, PIG.weld, 0.8);
  }
  return s;
}

/** Shadow thrown by a deep hood over the top of the face. */
export function drawHoodShadow(g: Genome, geo: Geo, pen: Pen): string {
  if (!g.shadowed) return '';
  const headD = curve(geo.outline, true);
  const y = geo.noseY - g.nose.len * 0.1;
  const body = `<path d="M0 0H200V${f(y)}Q${f(geo.cx)} ${f(y + 16)} 0 ${f(y)}Z" fill="#1b1622" opacity=".62"/><path d="M0 ${f(y)}Q${f(geo.cx)} ${f(y + 16)} 200 ${f(y)}V200H0Z" fill="#1b1622" opacity=".26"/>`;
  return pen.inside(headD, body);
}

export { shadeOf, clamp };
