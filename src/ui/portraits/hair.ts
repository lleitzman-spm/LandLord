/**
 * Portraits: hair, beards and moustaches. Each style is a handful of points
 * hung on the skull, so the same bowl cut sits properly on a halfling and on
 * a lantern-jawed bailiff.
 */
import { lerp, mirror, ellipse, mixc, shadeOf, liteOf, f, type Pt } from './util';
import { PIG } from './pigments';
import type { Genome } from './types';
import type { Pen } from './pen';
import type { Geo } from './head';

/** Points hugging the skull from the left at height yFrom, over the crown, to the right. */
export function skullArc(geo: Geo, off: number, yFrom: number, n = 4, bump: (i: number, total: number) => number = () => 0): Pt[] {
  const ys: number[] = [];
  const yTop = geo.top + geo.H * 0.035;
  for (let i = 0; i <= n; i++) ys.push(lerp(yFrom, yTop, Math.pow(i / n, 0.85)));
  const total = 2 * (n + 1) + 1;
  const left: Pt[] = ys.map((y, i) => {
    const t = i / n, o = off + bump(i, total);
    return [geo.cx - geo.hw(y) - o * (1 - 0.5 * t * t), y - o * t * t * 0.75] as Pt;
  });
  const right: Pt[] = ys.map((y, i) => {
    const t = i / n, o = off + bump(total - 1 - i, total);
    return [geo.cx + geo.hw(y) + o * (1 - 0.5 * t * t), y - o * t * t * 0.75] as Pt;
  });
  return [...left, [geo.cx, geo.top - off - bump(n + 1, total)] as Pt, ...right.reverse()];
}

export interface HairOut { back: string; front: string; over: string }

export function drawHair(g: Genome, geo: Geo, pen: Pen, covered: 'none' | 'top' | 'all', clipY: number): HairOut {
  const H = g.hair, out: HairOut = { back: '', front: '', over: '' };
  if (covered === 'all' || g.kind === 'dragon') return out;
  const r = pen.r.fork('hair');
  const c = H.color, sh = shadeOf(c, 0.3), ink = mixc(c, PIG.ink, 0.72);
  const cx = geo.cx, v = H.vol;
  const hl = geo.top + geo.H * H.line;
  const yE = geo.eyeY, skull = g.head.skull;
  const blob = (pts: Pt[], o: { shade?: boolean; w?: number; wob?: number } = {}) => pen.blob(pts, c, { w: o.w ?? 1.4, line: ink, shade: o.shade === false ? false : sh, sx: 4, sy: 3, wob: o.wob });
  const strand = (pts: Pt[], w = 0.8, op = 0.55) => pen.line(pts, w, { c: ink, op, tp: 'both' });
  const hairline = (kind: 'round' | 'peak' | 'fringe' | 'part' | 'jag', yT: number, low = 0): Pt[] => {
    // from the right temple back to the left temple, across the forehead
    const tx = geo.hw(yT) - 1.5;
    switch (kind) {
      case 'peak': return [[cx + tx, yT], [cx + skull * 0.66, hl - 3], [cx + skull * 0.3, hl + 1], [cx, hl + 8], [cx - skull * 0.3, hl + 1], [cx - skull * 0.66, hl - 3], [cx - tx, yT]];
      case 'fringe': return [[cx + tx + 1, yT], [cx + skull * 0.8, hl + low + 1], [cx + skull * 0.35, hl + low + 2.2], [cx, hl + low + 1.2], [cx - skull * 0.35, hl + low + 2.2], [cx - skull * 0.8, hl + low + 1], [cx - tx - 1, yT]];
      case 'part': { const px = H.part * skull * 0.42; return [[cx + tx, yT], [cx + skull * 0.78, hl + 7], [cx + (px + skull * 0.78) / 2 + 2, hl + 2.5], [cx + px, hl - 2], [cx + (px - skull * 0.78) / 2 - 2, hl + 2.5], [cx - skull * 0.78, hl + 7], [cx - tx, yT]]; }
      case 'jag': { const p: Pt[] = [[cx + tx + 1, yT]]; for (let i = 0; i <= 6; i++) { const t = i / 6; p.push([cx + skull * 0.82 * (1 - 2 * t), hl + low + (i % 2 ? 4.5 : -1) + r.jit(1.2)]); } p.push([cx - tx - 1, yT]); return p; }
      default: return [[cx + tx, yT], [cx + skull * 0.74, hl + 3], [cx + skull * 0.36, hl - 0.5], [cx, hl - 1.2], [cx - skull * 0.36, hl - 0.5], [cx - skull * 0.74, hl + 3], [cx - tx, yT]];
    }
  };
  const cap = (off: number, yFrom: number, line: Pt[], n = 4, bump?: (i: number, t: number) => number) => blob([...skullArc(geo, off, yFrom, n, bump), ...line]);
  const sideLock = (s: number, y0: number, y1: number, wd: number, wave = 0): Pt[] => {
    const xo = (y: number) => cx + s * (geo.hw(Math.min(y, geo.chin - 6)) + 1.5);
    const ym = (y0 + y1) / 2;
    return [[xo(y0) - s * 3, y0], [xo(y0) + s * wd * 0.6, y0 + 3], [xo(ym) + s * (wd + wave), ym], [xo(y1) + s * (wd * 0.8 - wave), y1 - 4], [xo(y1) + s * wd * 0.2, y1 + 1], [xo(y1) - s * 2.2, y1 - 6], [xo(ym) - s * 1.6, ym]];
  };
  const braid = (x: number, y0: number, y1: number, wd: number): string => {
    let s = '';
    const n = Math.max(3, Math.round((y1 - y0) / (wd * 0.95)));
    for (let i = 0; i < n; i++) {
      const y = lerp(y0, y1, (i + 0.5) / n), dx = (i % 2 ? 1 : -1) * wd * 0.14, z = 1 - i * 0.045;
      s += pen.blob(ellipse(x + dx, y, wd * 0.56 * z, (y1 - y0) / n * 0.68, 8), c, { w: 1.1, line: ink, wob: 0.25 });
    }
    s += pen.blob([[x - wd * 0.4, y1 - 1], [x + wd * 0.4, y1 - 1], [x + wd * 0.45, y1 + 3], [x - wd * 0.45, y1 + 3]], g.beard.rings || g.kind === 'dwarf' ? PIG.gold : PIG.madder, { w: 0.9, wob: 0 });
    s += pen.blob([[x - wd * 0.3, y1 + 3], [x + wd * 0.3, y1 + 3], [x + wd * 0.42, y1 + 9], [x, y1 + 11], [x - wd * 0.42, y1 + 9]], c, { w: 1, line: ink });
    return s;
  };
  const backLong = (wave: number, len: number): string => {
    const yB = Math.min(geo.nb + len, 204), w0 = skull + 5 + 4 * v;
    const pts: Pt[] = [...skullArc(geo, 3 + 3 * v, yE - 4, 3),
      [cx + w0 + 3 + wave, lerp(yE, yB, 0.3)], [cx + w0 + 6 - wave, lerp(yE, yB, 0.62)], [cx + w0 + 2 + wave, yB - 3], [cx + w0 - 9, yB + 2],
      [cx, yB - 2],
      [cx - w0 + 9, yB + 2], [cx - w0 - 2 - wave, yB - 3], [cx - w0 - 6 + wave, lerp(yE, yB, 0.62)], [cx - w0 - 3 - wave, lerp(yE, yB, 0.3)]];
    let s = blob(pts);
    if (pen.fine) for (const sd of [-1, 1]) for (const k of [0.35, 0.7]) s += strand([[cx + sd * (w0 * k + 12), yE + 8], [cx + sd * (w0 * k + 14 + wave), lerp(yE, yB, 0.5)], [cx + sd * (w0 * k + 11), yB - 6]], 0.8, 0.4);
    return s;
  };

  switch (H.style) {
    case 'bald':
      if (pen.fine && covered === 'none') out.front = pen.line([[cx - skull * 0.5, geo.top + 9], [cx - skull * 0.2, geo.top + 5], [cx + skull * 0.05, geo.top + 4.4]], 1.6, { c: liteOf(g.skin, 0.55), op: 0.7 });
      break;
    case 'horseshoe':
    case 'wispy': {
      for (const s of [-1, 1]) {
        const y0 = yE + 1, y1 = geo.top + geo.H * 0.24;
        const xo = (y: number) => cx + s * geo.hw(y);
        const puff = H.style === 'wispy' ? 3 : 5.5 * v;
        out.back += blob([[xo(y0) - s * 3, y0 + 2], [xo(y0) + s * puff, y0 - 1], [xo(lerp(y0, y1, 0.5)) + s * (puff + 2), lerp(y0, y1, 0.5)], [xo(y1) + s * puff * 0.7, y1 - 2], [xo(y1) - s * 4, y1 - 1], [xo(lerp(y0, y1, 0.5)) - s * 4, lerp(y0, y1, 0.5)]], { shade: false, w: 1.2 });
        out.front += blob([[xo(y0) - s * 1.5, y0 - 3], [xo(y0 - 8) - s * 0.5, y0 - 12], [xo(y1) - s * 2, y1 + 1], [xo(y1) - s * 7, y1 + 6], [xo(y0 - 8) - s * 5.5, y0 - 9]], { shade: false, w: 1 });
      }
      if (H.style === 'wispy' && pen.mid && covered === 'none') {
        for (let i = 0; i < 4; i++) {
          const y = geo.top + 3 + i * 3.4;
          out.front += pen.line([[cx - skull * 0.6 + i * 2, y + 5], [cx - skull * 0.1, y - 1 + r.jit(1)], [cx + skull * 0.45 - i * 3, y + 2 + r.jit(1)]], 1, { c: mixc(c, PIG.ink, 0.25), op: 0.8 });
        }
      } else if (pen.fine && covered === 'none') out.front += pen.line([[cx - skull * 0.45, geo.top + 9], [cx - skull * 0.15, geo.top + 5]], 1.5, { c: liteOf(g.skin, 0.55), op: 0.7 });
      break;
    }
    case 'tuft': {
      const p: Pt[] = [[cx - 7, geo.top + 3]];
      const n = 3 + (g.seed & 1);
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; p.push([cx - 7 + 14 * t + r.jit(2), geo.top - 13 * v - r.range(0, 5)], [cx - 7 + 14 * (i + 1) / n, geo.top + (i === n - 1 ? 3 : -2)]); }
      out.front = blob(p, { shade: false, w: 1.1 });
      break;
    }
    case 'topknot': {
      out.over = pen.blob(ellipse(cx + H.part * 3, geo.top - 7 * v, 7.5 * v, 8 * v, 9), c, { w: 1.3, line: ink, shade: sh, sx: 2, sy: 2 })
        + pen.blob([[cx + H.part * 3 - 5, geo.top - 1.5], [cx + H.part * 3 + 5, geo.top - 1.5], [cx + H.part * 3 + 5.5, geo.top + 2], [cx + H.part * 3 - 5.5, geo.top + 2]], g.kind === 'dwarf' ? PIG.gold : PIG.madder, { w: 0.9, wob: 0 });
      if (g.kind === 'dwarf') out.front = cap(2.2, yE - 6, hairline('round', yE - 12));
      break;
    }
    case 'crop':
      out.front = cap(2.4 * v, yE - 7, hairline(H.part ? 'part' : 'round', yE - 13));
      if (pen.fine) for (const t of [-0.5, 0, 0.5]) out.front += strand([[cx + t * skull, geo.top + 4 - Math.abs(t) * 2], [cx + t * skull * 1.2, hl - 4]], 0.7, 0.4);
      break;
    case 'widow':
      out.front = cap(1.8 * v, yE - 8, hairline('peak', yE - 15));
      if (pen.mid) for (const t of [-0.55, -0.2, 0.2, 0.55]) out.front += strand([[cx + t * skull * 0.6, hl + 3 - Math.abs(t) * 6], [cx + t * skull * 1.15, geo.top + 3]], 0.75, 0.45);
      out.back = blob([[cx - skull - 2, yE - 6], [cx - skull - 4, yE + 10], [cx - skull + 2, yE + 16], [cx + skull - 2, yE + 16], [cx + skull + 4, yE + 10], [cx + skull + 2, yE - 6]], { shade: false });
      break;
    case 'bowl':
    case 'tonsure': {
      const low = Math.min(9, geo.eyeY - g.eyes.h - g.brows.gapY - 5 - hl);
      out.front = cap(4.2 * v, yE + 1, hairline('fringe', yE + 1, Math.max(2, low)));
      if (pen.fine) for (let i = -3; i <= 3; i++) out.front += strand([[cx + i * skull * 0.24, hl + low - 7], [cx + i * skull * 0.26, hl + low + 1]], 0.7, 0.4);
      if (H.style === 'tonsure' && covered === 'none') out.over = pen.blob(ellipse(cx, geo.top + 4.5, skull * 0.58, geo.H * 0.085, 10), g.skin, { w: 1.2, shade: g.skinShade, sx: 3, sy: 2 });
      break;
    }
    case 'pageboy': {
      const low = Math.min(8, geo.eyeY - g.eyes.h - g.brows.gapY - 5 - hl);
      const yB = geo.noseY + 5, w0 = skull + 6 * v;
      out.back = blob([...skullArc(geo, 4 * v, yE - 2, 3), [cx + w0 + 2, yE + 8], [cx + w0 + 4, yB - 4], [cx + w0 - 1, yB + 3], [cx + w0 - 9, yB + 1], [cx, yB - 6], [cx - w0 + 9, yB + 1], [cx - w0 + 1, yB + 3], [cx - w0 - 4, yB - 4], [cx - w0 - 2, yE + 8]]);
      out.front = cap(4.4 * v, yE - 3, hairline('fringe', yE - 3, Math.max(2, low)));
      for (const s of [-1, 1]) out.front += blob(sideLock(s, yE - 6, yB + 2, 6 * v), { shade: false, w: 1.2 });
      break;
    }
    case 'shaggy':
      out.front = cap(4 * v, yE + 2, hairline('jag', yE - 2, 3), 6, i => (i % 2 ? 3.6 : -0.6) + r.jit(1));
      break;
    case 'wild':
      out.back = blob(skullArc(geo, 9 * v, geo.noseY, 7, i => (i % 2 ? 8 : 0) + r.jit(2.5)).concat([[cx + skull - 4, geo.noseY + 4], [cx - skull + 4, geo.noseY + 4]]), { shade: false });
      out.front = cap(6 * v, yE - 4, hairline('jag', yE - 10, 0), 6, i => (i % 2 ? 7 : -1) + r.jit(2));
      break;
    case 'curly': {
      const bump = (i: number) => (i % 2 ? 4.2 : 0.4) + r.jit(0.8);
      out.back = blob(skullArc(geo, 7.5 * v, yE + 10, 7, bump).concat([[cx + skull - 5, yE + 14], [cx - skull + 5, yE + 14]]), { wob: 0.2 });
      const line: Pt[] = [[cx + geo.hw(yE - 2) + 1, yE - 2]];
      for (let i = 0; i <= 8; i++) { const t = i / 8; line.push([cx + skull * 0.86 * (1 - 2 * t), hl + 3 + (i % 2 ? 3.4 : -1.2) + Math.abs(t - 0.5) * 6]); }
      line.push([cx - geo.hw(yE - 2) - 1, yE - 2]);
      out.front = blob([...skullArc(geo, 6.5 * v, yE - 2, 6, bump), ...line], { wob: 0.2 });
      if (pen.mid) {
        const n = pen.fine ? 9 : 4;
        for (let i = 0; i < n; i++) {
          const a = Math.PI * (1.08 + (0.84 * (i + 0.5)) / n), rr = skull * (0.72 + (i % 2) * 0.22);
          const x = cx + Math.cos(a) * rr, y = geo.top + geo.H * 0.2 + Math.sin(a) * geo.H * 0.19;
          out.front += strand([[x - 2.6, y + 1], [x - 1, y - 2.4], [x + 2, y - 1.4], [x + 1.6, y + 1.6], [x - 0.4, y + 1.2]], 0.85, 0.5);
        }
      }
      break;
    }
    case 'long':
    case 'wavy': {
      const wave = H.style === 'wavy' ? 3.5 : 0.6;
      out.back = backLong(wave, g.kind === 'elf' ? 46 : 34);
      out.front = cap(3.2 * v, yE - 3, hairline('part', yE - 6));
      if (g.ears.kind !== 'elf' && g.ears.kind !== 'goblin') for (const s of [-1, 1]) out.front += blob(sideLock(s, yE - 8, geo.chin + (g.kind === 'elf' ? 16 : 6), 4.5 * v, wave), { shade: false, w: 1.2 });
      break;
    }
    case 'braids': {
      const big = g.kind === 'dwarf' ? 1.3 : 1;
      out.back = blob([...skullArc(geo, 3 * v, yE, 3), [cx + skull + 5, yE + 10], [cx + skull, geo.noseY + 6], [cx - skull, geo.noseY + 6], [cx - skull - 5, yE + 10]]);
      out.front = cap(3 * v, yE - 2, hairline('part', yE - 6));
      for (const s of [-1, 1]) {
        const x = cx + s * (geo.hw(geo.noseY) + 5.5 * big);
        out.over += braid(x, geo.earY + 2, Math.min(geo.nb + 30, 186), 7.4 * big);
      }
      break;
    }
    case 'bun':
      out.over = pen.blob(ellipse(cx + H.part * 5, geo.top - 5 * v, 11 * v, 9 * v, 10), c, { w: 1.4, line: ink, shade: sh, sx: 3, sy: 2 });
      if (pen.fine) out.over += strand([[cx + H.part * 5 - 6, geo.top - 6], [cx + H.part * 5, geo.top - 10], [cx + H.part * 5 + 6, geo.top - 5]], 0.8, 0.5);
      out.front = cap(2.6 * v, yE - 4, hairline(H.part ? 'part' : 'round', yE - 8));
      break;
    case 'crownbraid': {
      out.front = cap(3 * v, yE - 3, hairline('round', yE - 8));
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a = Math.PI * (1.12 + (0.76 * (i + 0.5)) / n);
        const x = cx + Math.cos(a) * (skull * 0.98), y = geo.top + geo.H * 0.2 + Math.sin(a) * geo.H * 0.2;
        out.over += pen.blob(ellipse(x, y, 5.4, 4, 7), c, { w: 1.05, line: ink, wob: 0.25 });
      }
      out.back = blob([[cx - skull - 3, yE - 4], [cx - skull - 2, yE + 12], [cx + skull + 2, yE + 12], [cx + skull + 3, yE - 4], [cx, geo.top]], { shade: false });
      break;
    }
  }
  if (covered === 'top') {
    // a hat sits on it: keep only what hangs below the band
    const id = pen.id();
    pen.defs += `<clipPath id="${id}"><rect x="-40" y="${f(clipY)}" width="280" height="300"/></clipPath>`;
    const wrap = (s: string) => (s ? `<g clip-path="url(#${id})">${s}</g>` : '');
    const keepOver = H.style === 'braids';
    out.back = wrap(out.back); out.front = wrap(out.front); out.over = keepOver ? wrap(out.over) : '';
  }
  return out;
}

// ───────────── beards ─────────────

export function drawBeard(g: Genome, geo: Geo, pen: Pen): { under: string; over: string } {
  const B = g.beard;
  const res = { under: '', over: '' };
  if (g.kind === 'dragon') return res;
  const r = pen.r.fork('beard');
  const c = B.color, sh = shadeOf(c, 0.3), ink = mixc(c, PIG.ink, 0.72);
  const cx = geo.cx, mx = geo.fx, my = geo.mouthY, mw = g.mouth.w, chin = geo.chin, L = B.len;
  const noseB = geo.noseY + g.nose.tip * 0.75 + 1.2;
  const blob = (pts: Pt[], o: { shade?: boolean; w?: number } = {}) => pen.blob(pts, c, { w: o.w ?? 1.4, line: ink, shade: o.shade === false ? false : sh, sx: 3.5, sy: 3 });
  const strand = (pts: Pt[], w = 0.8, op = 0.5) => pen.line(pts, w, { c: ink, op, tp: 'both' });
  const y0 = geo.noseY - 4;                       // where the beard leaves the ear
  const jawX = (y: number) => geo.hw(Math.min(y, chin - 1));
  const top = (): Pt[] => [[cx - jawX(y0) - 1.5, y0], [cx - jawX(my - 3) * 0.74, my - 6], [mx - mw * 0.6, my - 3.4], [mx, my - 2.6], [mx + mw * 0.6, my - 3.4], [cx + jawX(my - 3) * 0.74, my - 6], [cx + jawX(y0) + 1.5, y0]];
  const side = (s: number, off: number): Pt[] => [[cx + s * (jawX(lerp(y0, chin, 0.4)) + off), lerp(y0, chin, 0.4)], [cx + s * (jawX(lerp(y0, chin, 0.75)) + off + 1), lerp(y0, chin, 0.75)]];

  switch (B.style) {
    case 'none': break;
    case 'stubble': {
      if (pen.lod === 0) { res.under = pen.fill([[cx - jawX(my - 4) * 0.9, my - 6], [cx, my - 9], [cx + jawX(my - 4) * 0.9, my - 6], [cx + g.head.chinW + 4, chin - 2], [cx - g.head.chinW - 4, chin - 2]], ink, 0.14); break; }
      const n = pen.fine ? 46 : 16;
      for (let i = 0; i < n; i++) {
        const y = r.range(geo.noseY + 2, chin - 2.5), x = cx + r.jit(jawX(y) * 0.9);
        if (Math.abs(x - mx) < mw + 1 && Math.abs(y - my) < 4.5) continue;
        if (y < my - 5 && Math.abs(x - mx) > g.nose.wide + 5 && Math.abs(x - cx) < jawX(y) * 0.62) continue;
        res.under += pen.dot(x, y, pen.fine ? 0.55 : 0.9, ink, 0.5);
      }
      break;
    }
    case 'goatee':
      res.under = blob([[mx - 5.5, my + 4.5], [mx, my + 3.2], [mx + 5.5, my + 4.5], [mx + 5, chin + 2], [mx + 1.5, chin + 10 * L], [mx - 1.5, chin + 10 * L], [mx - 5, chin + 2]], { shade: false });
      break;
    case 'chinstrap': {
      const o: Pt[] = [], i: Pt[] = [];
      for (let k = 0; k <= 4; k++) { const y = lerp(y0, chin - 2, k / 4); o.push([cx - jawX(y) - 2.5, y]); i.push([cx - jawX(y) + 4.5 + k * 0.6, y - 1]); }
      const outer = [...o, [cx, chin + 4.5] as Pt, ...mirror(o, cx).reverse()];
      const innerBack = [...mirror(i, cx), [cx, chin - 6.5] as Pt, ...i.slice().reverse()];
      res.under = blob([...outer, ...innerBack], { shade: false, w: 1.2 });
      break;
    }
    case 'chops':
      for (const s of [-1, 1]) res.under += blob([[cx + s * (jawX(y0 - 6) + 1.5), y0 - 8], [cx + s * (jawX(y0 + 8) + 4), y0 + 6], [cx + s * (jawX(my) + 3.5), my + 2], [cx + s * (mw + 5), my + 5], [cx + s * (mw + 5.5), my - 3], [cx + s * (jawX(y0) - 5), y0 - 2], [cx + s * (jawX(y0 - 6) - 3.5), y0 - 9]], { shade: false, w: 1.2 });
      break;
    case 'short': {
      const [a, b] = side(1, 3), [al, bl] = side(-1, 3);
      res.under = blob([...top(), a, b, [cx + g.head.chinW + 5, chin + 2.5], [cx, chin + 6.5 * L], [cx - g.head.chinW - 5, chin + 2.5], bl, al]);
      if (pen.fine) for (const t of [-0.6, -0.2, 0.2, 0.6]) res.under += strand([[mx + t * mw * 1.6, my + 6], [mx + t * mw * 1.5, chin + 2.5]], 0.7, 0.4);
      break;
    }
    case 'spade': {
      const [a, b] = side(1, 4), [al, bl] = side(-1, 4), yB = chin + 17 * L, wB = g.head.jaw * 0.8;
      res.under = blob([...top(), a, b, [cx + wB + 3, chin + 6], [cx + wB, yB - 3], [cx + wB * 0.5, yB + 1.5], [cx - wB * 0.5, yB + 1.5], [cx - wB, yB - 3], [cx - wB - 3, chin + 6], bl, al]);
      if (pen.mid) for (const t of [-0.6, -0.2, 0.2, 0.6]) res.under += strand([[mx + t * mw * 1.5, my + 7], [cx + t * wB * 1.2, yB - 4]], 0.85, 0.45);
      break;
    }
    case 'long':
    case 'forked':
    case 'braided': {
      const [a, b] = side(1, 4.5), [al, bl] = side(-1, 4.5);
      const yB = Math.min(chin + (B.style === 'braided' ? 22 : 34) * L, 199), wB = g.head.jaw * 0.74 + 4;
      const bottom: Pt[] = B.style === 'forked'
        ? [[cx + wB + 3, chin + 8], [cx + wB * 0.75, yB - 10], [cx + wB * 0.42, yB + 2], [cx + 2.5, yB - 13], [cx - 2.5, yB - 13], [cx - wB * 0.42, yB + 2], [cx - wB * 0.75, yB - 10], [cx - wB - 3, chin + 8]]
        : B.style === 'braided'
          ? [[cx + wB + 4, chin + 8], [cx + wB * 0.9, yB - 3], [cx + wB * 0.4, yB + 2], [cx - wB * 0.4, yB + 2], [cx - wB * 0.9, yB - 3], [cx - wB - 4, chin + 8]]
          : [[cx + wB + 3, chin + 8], [cx + wB * 0.8, yB - 14], [cx + wB * 0.3, yB - 2], [cx, yB + 2], [cx - wB * 0.3, yB - 2], [cx - wB * 0.8, yB - 14], [cx - wB - 3, chin + 8]];
      res.under = blob([...top(), a, b, ...bottom, bl, al]);
      if (pen.mid) {
        const n = pen.fine ? 5 : 3;
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n * 2 - 1;
          res.under += strand([[mx + t * mw * 1.5, my + 7], [cx + t * wB * 1.05 + r.jit(1.5), lerp(my, yB, 0.55)], [cx + t * wB * (B.style === 'forked' ? 0.6 : 0.5), yB - (B.style === 'forked' ? 14 - Math.abs(t) * 12 : 8)]], 0.9, 0.45);
        }
      }
      if (B.style === 'braided') {
        const n = g.seed % 3 === 0 ? 1 : 2;
        const wd = n === 1 ? 9.5 : 7.5;
        for (let i = 0; i < n; i++) {
          const x = cx + (n === 1 ? 0 : (i ? 1 : -1) * wB * 0.5);
          res.over += drawBraid(pen, x, yB - 3, Math.min(yB + 22 * L, 204), wd, c, ink, B.rings ? PIG.gold : PIG.madder);
        }
      } else if (B.rings && pen.mid) {
        res.over += pen.blob([[cx - 4.5, yB - 9], [cx + 4.5, yB - 9], [cx + 4, yB - 5], [cx - 4, yB - 5]], PIG.gold, { w: 0.9, wob: 0 });
      }
      break;
    }
  }

  // moustache: sits on top of the mouth's upper edge
  const S = B.stache;
  if (S !== 'none') {
    const yT = noseB, wdt = mw + 2.5;
    let pts: Pt[] = [];
    switch (S) {
      case 'chevron': pts = [[mx, yT], [mx + wdt * 0.6, yT + 1.4], [mx + wdt + 1, my + 0.8], [mx + wdt * 0.55, my - 0.6], [mx, my - 2.6], [mx - wdt * 0.55, my - 0.6], [mx - wdt - 1, my + 0.8], [mx - wdt * 0.6, yT + 1.4]]; break;
      case 'walrus': pts = [[mx, yT - 0.5], [mx + wdt * 0.7, yT + 1], [mx + wdt + 3, my + 2], [mx + wdt + 1.5, my + 6.5], [mx + wdt * 0.5, my + 4], [mx, my + 0.5], [mx - wdt * 0.5, my + 4], [mx - wdt - 1.5, my + 6.5], [mx - wdt - 3, my + 2], [mx - wdt * 0.7, yT + 1]]; break;
      case 'handlebar': pts = [[mx, yT + 0.4], [mx + wdt * 0.6, yT + 1], [mx + wdt + 4, my - 0.5], [mx + wdt + 9, my - 6.5], [mx + wdt + 5.5, my + 1.8], [mx + wdt * 0.5, my - 0.4], [mx, my - 2.8], [mx - wdt * 0.5, my - 0.4], [mx - wdt - 5.5, my + 1.8], [mx - wdt - 9, my - 6.5], [mx - wdt - 4, my - 0.5], [mx - wdt * 0.6, yT + 1]]; break;
      case 'pencil': pts = [[mx, yT + 1.6], [mx + wdt * 0.6, yT + 2.2], [mx + wdt + 1.5, my - 0.4], [mx + wdt * 0.5, my - 1.6], [mx, my - 3], [mx - wdt * 0.5, my - 1.6], [mx - wdt - 1.5, my - 0.4], [mx - wdt * 0.6, yT + 2.2]]; break;
      case 'droop': pts = [[mx, yT + 0.3], [mx + wdt * 0.7, yT + 1.4], [mx + wdt + 2.5, my + 3], [mx + wdt + 2, chin + 3 * L], [mx + wdt - 0.8, my + 5], [mx + wdt * 0.45, my - 0.4], [mx, my - 2.8], [mx - wdt * 0.45, my - 0.4], [mx - wdt + 0.8, my + 5], [mx - wdt - 2, chin + 3 * L], [mx - wdt - 2.5, my + 3], [mx - wdt * 0.7, yT + 1.4]]; break;
    }
    res.over = pen.blob(pts, c, { w: 1.2, line: ink, shade: S === 'walrus' ? sh : false, sx: 2, sy: 2, wob: 0.3 }) + res.over;
    if (pen.fine && S !== 'pencil') res.over += pen.line([[mx, yT + 0.8], [mx, my - 2.2]], 0.7, { c: ink, op: 0.6 });
  }
  return res;
}

function drawBraid(pen: Pen, x: number, y0: number, y1: number, wd: number, c: string, ink: string, tie: string): string {
  let s = '';
  const n = Math.max(2, Math.round((y1 - y0) / (wd * 0.9)));
  for (let i = 0; i < n; i++) {
    const y = lerp(y0, y1, (i + 0.5) / n), dx = (i % 2 ? 1 : -1) * wd * 0.13;
    s += pen.blob(ellipse(x + dx, y, wd * 0.56, ((y1 - y0) / n) * 0.7, 8), c, { w: 1.1, line: ink, wob: 0.25 });
  }
  s += pen.blob([[x - wd * 0.42, y1 - 1], [x + wd * 0.42, y1 - 1], [x + wd * 0.46, y1 + 3], [x - wd * 0.46, y1 + 3]], tie, { w: 0.9, wob: 0 });
  s += pen.blob([[x - wd * 0.3, y1 + 3], [x + wd * 0.3, y1 + 3], [x + wd * 0.4, y1 + 8], [x, y1 + 10], [x - wd * 0.4, y1 + 8]], c, { w: 1, line: ink });
  return s;
}
