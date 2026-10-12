/**
 * Portraits: headwear. Caps, coifs, hoods, wimples, straw hats, helms, the
 * wizard's point, the baker's cloud, crowns by rank and the goblin chief's
 * hat of office (folded from a form). Each hat is hung on the skull the way
 * hair is, so it sits properly on a halfling and on a lantern jaw, and each
 * says what the hair underneath should do. Ogres get theirs at under half
 * size, perched.
 */
import { lerp, mirror, ellipse, arc, rot, curve, mixc, shadeOf, liteOf, f, type Pt } from './util';
import { PIG } from './pigments';
import type { Genome, HatExtra } from './types';
import type { Pen, BlobOpts } from './pen';
import type { Geo } from './head';
import { skullArc } from './hair';

export interface HatOut { back: string; front: string; top: number; covers: 'none' | 'top' | 'all'; clipY: number; hidesEars: boolean }

/** how much of a hat an ogre can find in his size */
const TINY = 0.5;

/** Outline of a tapering tube around a centreline (tails, feathers, cones). Clockwise for a line drawn upward. */
export function tubePts(c: readonly Pt[], hw: readonly number[] | ((t: number) => number)): Pt[] {
  const L: Pt[] = [], R: Pt[] = [];
  const n = c.length;
  for (let i = 0; i < n; i++) {
    const a = c[Math.max(0, i - 1)], b = c[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len; ty /= len;
    const w = typeof hw === 'function' ? hw(n > 1 ? i / (n - 1) : 0) : hw[Math.min(i, hw.length - 1)];
    L.push([c[i][0] + ty * w, c[i][1] - tx * w]);
    R.push([c[i][0] - ty * w, c[i][1] + tx * w]);
  }
  return [...L, ...R.reverse()];
}
/** Put a closed outline clockwise on screen, so the pen's heavier side falls away from the light. */
export function cw(p: readonly Pt[]): Pt[] {
  let a = 0;
  for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; }
  return a < 0 ? p.slice().reverse() : p.slice();
}

interface Anchors {
  apex: Pt;
  /** front centre of the band */
  front: Pt;
  sideW: number; sideY: number;
  /** a clear patch of crown for stars, dust and patches */
  crown: { x: number; y: number; rx: number; ry: number };
}

export function drawHat(g: Genome, geo: Geo, pen0: Pen): HatOut {
  const H = g.hat;
  if (H.kind === 'none') return { back: '', front: '', top: geo.top, covers: 'none', clipY: 0, hidesEars: false };
  const tiny = H.tiny;
  const pen = tiny ? pen0.sub(TINY) : pen0;
  const out = hatBody(g, geo, pen);
  if (tiny) {
    pen0.defs += pen.defs;
    const B = geo.band, cx = geo.cx, d = g.dir;
    const sit = geo.top + 3.5;
    const tr = `translate(${f(cx - d * 4)} ${f(sit)}) rotate(${f(H.tilt - d * 8)}) scale(${TINY}) translate(${f(-cx)} ${f(-B)})`;
    return { back: '', front: `<g transform="${tr}">${out.back}${out.front}</g>`, top: sit - (B - out.top) * TINY - 2, covers: 'none', clipY: 0, hidesEars: false };
  }
  if (H.tilt && out.tiltable) {
    const tr = ` transform="rotate(${f(H.tilt)} ${f(geo.cx)} ${f(geo.band + 6)})"`;
    if (out.back) out.back = `<g${tr}>${out.back}</g>`;
    out.front = `<g${tr}>${out.front}</g>`;
    out.top -= Math.abs(H.tilt) * 0.35;
  }
  return { back: out.back, front: out.front, top: out.top, covers: out.covers, clipY: out.clipY, hidesEars: out.hidesEars };
}

interface Body extends HatOut { tiltable: boolean }

function hatBody(g: Genome, geo: Geo, pen: Pen): Body {
  const H = g.hat, d = g.dir;
  const cx = geo.cx, T = geo.top, B = geo.band, hw = geo.hw;
  const wB = hw(B), sk = g.head.skull;
  const C = H.c, C2 = H.c2;
  const dark = shadeOf(C, 0.2), deep = shadeOf(C, 0.36);
  const r = pen.r.fork('hat');
  const has = (e: HatExtra) => H.extras.includes(e);
  const v = H.variant;
  const nb = geo.nb, nw = g.garb.neckW;

  /** x in a frame where +u is the side away from the nose (where things flop and hang) */
  const U = (u: number, y: number): Pt => [cx - d * u, y];
  const wash = (pts: readonly Pt[], c: string = C, o: BlobOpts = {}): string => pen.blob(cw(pts), c, { w: 1.55, shade: true, sx: 4.5, sy: 3.5, ...o });
  const flat = (pts: readonly Pt[], c: string, o: BlobOpts = {}): string => pen.blob(cw(pts), c, { w: 1.3, ...o });
  /** right to left across the forehead at height y, sagging in the middle */
  const band = (y: number, sag: number, ext = 0): Pt[] => {
    const w = hw(y) + ext;
    return [[cx + w, y], [cx + w * 0.55, y + sag * 0.8], [cx, y + sag], [cx - w * 0.55, y + sag * 0.8], [cx - w, y]];
  };
  /** a strip of cloth lying along the band */
  const strip = (y: number, h: number, sag: number, ext: number, c: string, o: BlobOpts = {}): string => flat([...band(y - h, sag, ext).reverse(), ...band(y, sag, ext)], c, o);
  const dome = (off: number, y: number, n = 4, bump?: (i: number, total: number) => number): Pt[] => skullArc(geo, off, y, n, bump);
  /** a hat crown standing on the band: left base, over the top, right base, then back along the sag */
  const crownPts = (wBase: number, wTop: number, yBase: number, yTop: number, dent = 0): Pt[] => [
    [cx - wBase, yBase], [cx - lerp(wBase, wTop, 0.5), lerp(yBase, yTop, 0.62)], [cx - wTop * 0.78, yTop + 1.5], [cx, yTop + dent], [cx + wTop * 0.78, yTop + 1.5],
    [cx + lerp(wBase, wTop, 0.5), lerp(yBase, yTop, 0.62)], [cx + wBase, yBase], [cx + wBase * 0.5, yBase + 2.4], [cx, yBase + 3], [cx - wBase * 0.5, yBase + 2.4],
  ];
  /** brim as two pieces: all of it behind the head, the near half across the forehead */
  const brim = (by: number, rx: number, ry: number, c: string, flop = 0): { back: string; front: string } => {
    const wave = (p: Pt): Pt => [p[0], p[1] + flop * Math.sin(((p[0] - cx) / rx) * Math.PI * 1.5) + Math.abs((p[0] - cx) / rx) ** 2 * flop * 1.4];
    const all = ellipse(cx, by, rx, ry, 14).map(wave);
    const near: Pt[] = [[cx - rx, by] as Pt, [cx - rx * 0.5, by - 1.2] as Pt, [cx, by - 2] as Pt, [cx + rx * 0.5, by - 1.2] as Pt, [cx + rx, by] as Pt, ...arc(cx, by, rx, ry, 18, 162, 6)].map(wave);
    return { back: flat(all, shadeOf(c, 0.3), { w: 1.5 }), front: wash(near, c, { sy: 2.2, sx: 3 }) };
  };
  /** an arch of cloth or steel round the face, open at the bottom: hoods, coifs, helms */
  const archPts = (off: number, yEnd: number, peak: number, inset: number, browY: number, foot: 'jaw' | 'shoulder'): Pt[] => {
    const n = 5;
    const outer = dome(off, yEnd, n, i => (i === n + 1 ? peak : i === n || i === n + 2 ? peak * 0.35 : 0));
    const yE = geo.eyeY;
    const innerR: Pt[] = [
      [cx + hw(yEnd) - inset * 0.6, yEnd], [cx + hw(yE + 6) - inset, yE + 6], [cx + hw(yE - 6) - inset * 1.15, yE - 7],
      [cx + hw(browY + 5) * 0.8 - inset * 0.4, browY + 4.5], [cx + sk * 0.4, browY + 0.6],
    ];
    const inner: Pt[] = [...innerR, [cx, browY - 0.6] as Pt, ...mirror(innerR, cx).reverse()];
    if (foot === 'shoulder') {
      const fo: Pt = [cx - nw * 1.3 - off - 5, nb + 9], fi: Pt = [cx - nw * 1.15, nb + 6];
      return [fo, ...outer, [2 * cx - fo[0], fo[1]] as Pt, [2 * cx - fi[0], fi[1]] as Pt, ...inner, fi];
    }
    return [...outer, ...inner];
  };
  const tube = (c: readonly Pt[], hwf: readonly number[] | ((t: number) => number), col: string, o: BlobOpts = {}): string => flat(tubePts(c, hwf), col, o);

  let back = '', front = '';
  let top = T, covers: Body['covers'] = 'top', clipY = B - 1, hidesEars = false, tiltable = false;
  const an: Anchors = { apex: [cx, T - 4], front: [cx, B - 4], sideW: wB + 3.5, sideY: B - 2, crown: { x: cx, y: (T + B) / 2 - 1, rx: wB * 0.62, ry: Math.max(5, (B - T) * 0.42) } };

  switch (H.kind) {
    case 'cap': {
      tiltable = true;
      if (v === 2) {
        // a soft tall cap, its point fallen over
        const tip = U(wB + 13, T + 10);
        front += wash([U(-wB - 3.6, B), U(-wB - 2.6, B - 13), U(-wB * 0.55, T - 7), U(wB * 0.25, T - 12), U(wB + 4, T - 5), tip, U(wB + 8.5, T + 16), U(wB + 3.2, T + 7), U(wB + 3.6, B), U(wB * 0.55, B + 2.4), U(0, B + 3), U(-wB * 0.55, B + 2.4)]);
        if (pen.mid) front += pen.line([U(wB * 0.5, T - 8), U(wB + 1, T + 1), U(wB + 4, T + 9)], 1, { op: 0.5 });
        front += strip(B + 0.6, 4.6, 3, 4.4, dark);
        if (has('tip')) front += pen.bead(tip[0] - d * 1.5, tip[1] + 4.5, 3.4, C2, 1);
        an.apex = U(wB * 0.25, T - 12); top = T - 14;
      } else if (v === 1) {
        // a muffin cap: more cloth than head
        front += wash([...dome(7.5, B - 3, 5, i => (i % 2 ? 1.6 : 0)), ...band(B - 3, 3, 2)]);
        if (pen.fine) for (const t of [-0.5, 0, 0.5]) front += pen.line([[cx + t * wB * 1.5, B - 6], [cx + t * wB * 0.7, T - 4]], 0.8, { op: 0.4 });
        front += strip(B + 0.4, 4.4, 3, 2.6, dark);
        if (has('tip')) front += flat(ellipse(cx, T - 8.5, 2.4, 3, 7), dark, { w: 1 });
        an.apex = [cx, T - 7.5]; top = T - 10;
      } else {
        front += wash([...dome(3.6, B, 4), ...band(B, 3, 3.6)]);
        if (v === 3) {
          // a workman's cap with a stub of a peak
          front += flat([[cx - wB * 0.82 + d * 3, B + 0.6], [cx + d * 4, B - 2.6], [cx + wB * 0.82 + d * 3, B + 0.6], [cx + wB * 0.55 + d * 4, B + 6.4], [cx + d * 4, B + 8], [cx - wB * 0.55 + d * 4, B + 6.4]], deep, { w: 1.4 });
        } else front += strip(B + 0.6, 5, 3, 4.6, dark);
        if (pen.fine) front += pen.line([[cx - wB * 0.5, T + 2], [cx, T - 1.6], [cx + wB * 0.5, T + 2]], 0.8, { op: 0.4 });
        if (has('tip')) front += flat(ellipse(cx, T - 5, 2.2, 2.8, 7), dark, { w: 1 });
        an.apex = [cx, T - 3.6]; top = T - (has('tip') ? 8 : 5);
      }
      clipY = B - 2;
      break;
    }
    case 'skullcap':
    case 'judgecap': {
      const y0 = T + geo.H * 0.13;
      if (H.kind === 'judgecap') {
        // the white coif of the bench, and a small cap on top of it
        front += wash(archPts(2.2, geo.mouthY - 3, 0, 4.2, B, 'jaw'), C);
        if (pen.mid) front += pen.line([[cx - hw(geo.mouthY - 3) + 1, geo.mouthY - 3], [cx - 3, geo.chin + 4]], 1, { op: 0.8 }) + pen.line([[cx + hw(geo.mouthY - 3) - 1, geo.mouthY - 3], [cx + 3, geo.chin + 4]], 1, { op: 0.8 });
        front += wash([...dome(2.6, y0 + 2, 3), ...band(y0 + 2, 2.6, 2.6)], C2);
        if (pen.fine) front += pen.line(band(y0 + 0.5, 2.6, 2.2), 0.8, { op: 0.5, tp: 'flat' });
        covers = 'all'; hidesEars = true;
      } else {
        front += wash([...dome(2.4, y0, 3), ...band(y0, 2.6, 2.4)]);
        front += pen.line(band(y0 + 0.2, 2.6, 2.2), 2, { c: C2 === PIG.cream ? dark : C2, tp: 'flat', wob: 0.1 });
        front += pen.bead(cx, T - 2.6, 1.9, C2 === PIG.cream ? dark : C2, 0.8);
        clipY = y0 + 1;
      }
      an.front = [cx, y0 - 4]; an.sideY = y0; an.sideW = hw(y0) + 2; an.crown = { x: cx, y: T + 5, rx: sk * 0.5, ry: 4 };
      top = T - 5;
      break;
    }
    case 'coif': {
      front += wash(archPts(2.2, geo.mouthY - 2, 0, 4.4, B + 0.5, 'jaw'));
      if (pen.fine) front += pen.line([[cx, T - 2], [cx + 0.4, B]], 0.8, { op: 0.45 });
      if (pen.mid) {
        const y = geo.mouthY - 2, x = hw(y) - 1.5, ty = geo.chin + 4.5;
        front += pen.line([[cx - x, y], [cx - x * 0.6, geo.chin - 1], [cx - 2, ty]], 1, { tp: 'flat', op: 0.85 }) + pen.line([[cx + x, y], [cx + x * 0.6, geo.chin - 1], [cx + 2, ty]], 1, { tp: 'flat', op: 0.85 });
        if (g.beard.style === 'none' || g.beard.style === 'stubble') front += flat([[cx, ty], [cx - 5, ty - 2.5], [cx - 5.5, ty + 3]], C, { w: 0.9 }) + flat([[cx, ty], [cx + 5, ty - 2.5], [cx + 5.5, ty + 3]], C, { w: 0.9 });
      }
      if (v % 2 && g.hair.style !== 'bald' && pen.mid) front += fringe(g, geo, pen, B + 0.5);
      covers = 'all'; hidesEars = true; top = T - 3;
      break;
    }
    case 'mailcoif':
    case 'bascinet': {
      const steel = H.kind === 'bascinet';
      const bib = g.beard.style === 'none' || g.beard.style === 'stubble' || g.beard.style === 'chops';
      const mail = (pts: Pt[]): string => {
        let s = wash(pts, PIG.steel, { w: 0, wob: 0 });
        if (pen.mid) {
          let rings = '';
          const step = pen.fine ? 5 : 8;
          for (let y = T - 6, j = 0; y < nb + 26; y += step * 0.8, j++) for (let x = cx - sk - 22 + (j % 2) * step * 0.5; x < cx + sk + 22; x += step) rings += `M${f(x)} ${f(y)}a${f(step * 0.46)} ${f(step * 0.42)} 0 0 0 ${f(step * 0.92)} 0`;
          const body = `<path d="${rings}" fill="none" stroke="${PIG.steelDark}" stroke-width="${f(0.7 * pen.k)}" opacity=".7"/>`;
          s += pen.inside(curve(cw(pts), true), body);
        }
        return s + pen.line(cw(pts), 1.5, { closed: true });
      };
      if (bib) front += mail([[cx - hw(geo.mouthY) - 3, geo.mouthY - 4], [cx - hw(geo.mouthY) * 0.7, geo.chin - 3], [cx, geo.chin + 1.5], [cx + hw(geo.mouthY) * 0.7, geo.chin - 3], [cx + hw(geo.mouthY) + 3, geo.mouthY - 4], [cx + nw * 1.6 + 12, nb + 9], [cx + nw, nb + 19], [cx, nb + 22], [cx - nw, nb + 19], [cx - nw * 1.6 - 12, nb + 9]]);
      if (steel) {
        // the helm proper, pointed, with its visor pushed up
        front += wash(archPts(5, geo.mouthY - 6, 9, 3.6, B + 1, 'jaw'), C, { sx: 5, sy: 4 });
        if (pen.mid) front += pen.line([[cx - sk * 0.5, T + 3], [cx - sk * 0.2, T - 6]], 2, { c: liteOf(C, 0.5), op: 0.8 });
        const vy = B - 1;
        const visor: Pt[] = [[cx - wB - 3, vy - 3], [cx - wB * 0.7, vy - 15], [cx, vy - 21], [cx + wB * 0.7, vy - 15], [cx + wB + 3, vy - 3], [cx + wB * 0.5, vy + 3], [cx + d * 2, vy + 6.5], [cx - wB * 0.5, vy + 3]];
        front += wash(visor, liteOf(C, 0.12), { sx: 3, sy: 3 });
        if (pen.mid) {
          for (const sd of [-1, 1]) front += pen.line([[cx + sd * (wB * 0.2 + 2), vy - 4.5], [cx + sd * (wB * 0.2 + 12), vy - 5.5]], 1.5, { tp: 'flat', wob: 0 });
          front += pen.bead(cx - wB - 2, vy - 3, 2, PIG.steelDark, 0.8) + pen.bead(cx + wB + 2, vy - 3, 2, PIG.steelDark, 0.8);
        }
        an.apex = [cx, T - 13]; top = T - 15;
      } else {
        front += mail(archPts(3, geo.mouthY - 4, 0, 4, B + 1, 'jaw'));
        top = T - 4;
      }
      covers = 'all'; hidesEars = true;
      break;
    }
    case 'hood':
    case 'deephood': {
      const deepH = H.kind === 'deephood';
      const off = deepH ? 10 : 6.5, peak = deepH ? 8 : 4.5;
      const browY = deepH ? B + 5 : B + 0.5;
      if (has('liripipe')) {
        // the tail of the hood, long enough to trip on
        const p0 = U(wB * 0.5, T - off - 1);
        back += tube([p0, U(wB + off + 5, T + 6), U(wB + off + 11, geo.eyeY), U(wB + off + 8, geo.chin - 6), U(wB + off + 12, nb + 16)], t => 4.4 * (1 - t * 0.55), C, { w: 1.3 });
      }
      back += flat([[cx - sk - off - 3, geo.eyeY], [cx - nw * 1.4 - off - 8, nb + 12], [cx + nw * 1.4 + off + 8, nb + 12], [cx + sk + off + 3, geo.eyeY], [cx, T]], deep, { w: 1.4 });
      const a = archPts(off, geo.noseY + 2, peak, deepH ? 6.5 : 4.6, browY, 'shoulder');
      front += wash(a, C, { sx: 5.5, sy: 4 });
      if (pen.mid) {
        // the turned-back lining at the edge of the opening
        const yE = geo.eyeY, ins = deepH ? 6.5 : 4.6;
        const edgeR: Pt[] = [[cx + hw(geo.noseY + 2) - ins * 0.6 + 2.6, geo.noseY + 4], [cx + hw(yE + 6) - ins + 2.8, yE + 6], [cx + hw(yE - 6) - ins * 1.15 + 3, yE - 8], [cx + hw(browY + 5) * 0.8 - ins * 0.4 + 2.4, browY + 2], [cx + sk * 0.4, browY - 2.4]];
        front += pen.line([...edgeR, [cx, browY - 3.6] as Pt, ...mirror(edgeR, cx).reverse()], 1.1, { c: deep, tp: 'flat', op: 0.75 });
      }
      if (pen.fine) for (const sd of [-1, 1]) front += pen.line([[cx + sd * (sk + off * 0.4), T + 6], [cx + sd * (sk + off - 1.5), geo.eyeY - 4], [cx + sd * (hw(geo.noseY) + off - 2), geo.noseY]], 0.9, { op: 0.4 });
      if (!deepH && v % 2 && g.hair.style !== 'bald' && pen.mid) front = fringe(g, geo, pen, browY) + front;
      covers = 'all'; hidesEars = true; top = T - off - peak - 1;
      an.apex = [cx, T - off - peak]; an.crown = { x: cx, y: T + 2, rx: sk * 0.5, ry: 5 }; an.sideW = sk + off; an.sideY = geo.eyeY - 14; an.front = [cx, browY - 8];
      break;
    }
    case 'wimple': {
      const veil = C2 === PIG.cream ? mixc(C, '#b9ad90', 0.25) : C2;
      const yE = geo.eyeY;
      back += wash([...dome(6.5, yE, 4), [cx + sk + 13, geo.noseY + 4], [cx + sk + 19, nb + 12], [cx + sk + 10, nb + 34], [cx, nb + 28], [cx - sk - 10, nb + 34], [cx - sk - 19, nb + 12], [cx - sk - 13, geo.noseY + 4]], veil);
      const bearded = g.beard.style !== 'none' && g.beard.style !== 'stubble';
      if (!bearded) {
        // the linen runs under the chin and down over the throat
        const my = geo.mouthY;
        front += wash([[cx - hw(my) - 2, my - 6], [cx - hw(my + 6) * 0.9, geo.chin - 7], [cx - g.head.chinW * 0.7, geo.chin - 1.6], [cx, geo.chin + 0.6], [cx + g.head.chinW * 0.7, geo.chin - 1.6], [cx + hw(my + 6) * 0.9, geo.chin - 7], [cx + hw(my) + 2, my - 6],
          [cx + nw * 1.5 + 5, nb + 4], [cx + nw * 1.1, nb + 15], [cx, nb + 19], [cx - nw * 1.1, nb + 15], [cx - nw * 1.5 - 5, nb + 4]], C, { sy: 2.5 });
        if (pen.fine) for (const sd of [-1, 0, 1]) front += pen.line([[cx + sd * nw * 0.7, geo.chin + 4], [cx + sd * nw * 0.9, nb + 12]], 0.8, { op: 0.4 });
      }
      front += wash(archPts(2.2, geo.mouthY - 4, 0, 4.2, B + 1, 'jaw'), C);
      // the veil's leading edge over the brow
      const innerR: Pt[] = [[cx + hw(yE + 2) + 1.5, yE + 3], [cx + hw(B + 4) + 0.6, B + 5], [cx + sk * 0.62, B - 4.4]];
      front += wash([...dome(6.5, yE + 3, 5), ...innerR, [cx, B - 6.4] as Pt, ...mirror(innerR, cx).reverse()], veil, { sx: 4, sy: 3 });
      covers = 'all'; hidesEars = true; top = T - 8;
      an.crown = { x: cx, y: T + 1, rx: sk * 0.5, ry: 4 }; an.sideW = sk + 6; an.sideY = B; an.front = [cx, B - 9];
      break;
    }
    case 'kerchief': {
      if (v >= 2) {
        // tied on top, with two ears of knot
        front += wash([...dome(3.4, B + 1, 4), ...band(B + 1, 3.2, 3.4)]);
        const ky = T - 3, kx = cx + d * 3;
        front += flat([[kx - 2, ky], [kx - 12, ky - 11], [kx - 15, ky - 3], [kx - 5, ky + 2.5]], C, { w: 1.3 }) + flat([[kx + 2, ky], [kx + 11, ky - 12], [kx + 15, ky - 5], [kx + 5, ky + 2.5]], C, { w: 1.3 });
        front += flat(ellipse(kx, ky, 4, 3.4, 8), dark, { w: 1.2 });
        an.apex = [kx, ky - 4]; top = T - 16;
      } else {
        // tied at the nape: a knot and two tails show behind the ear
        const kx = U(wB + 2, B + 5);
        back += flat([kx, U(wB + 14, B + 14), U(wB + 10, B + 30), U(wB + 5, B + 16)], C, { w: 1.3 }) + flat([kx, U(wB + 9, B + 3), U(wB + 19, B + 13), U(wB + 12, B + 12)], C, { w: 1.3 });
        front += wash([...dome(3.6, B + 3, 4), ...band(B + 3, -3.2, 3.6)]);
        if (pen.mid) front += pen.line([U(-wB * 0.6, T + 4), U(wB * 0.3, B - 6), U(wB + 1, B + 2)], 0.9, { op: 0.45 });
        front += flat(ellipse(kx[0], kx[1], 3.4, 3.2, 7), dark, { w: 1.1 });
        an.front = [cx, B - 6]; top = T - 5;
      }
      if (pen.mid && C2 !== PIG.cream) front += pen.line(band(B - (v >= 2 ? 1.6 : 2.6), v >= 2 ? 3.2 : -3.2, 3), 1.8, { c: C2, tp: 'flat', wob: 0.1 });
      clipY = B - 2;
      break;
    }
    case 'straw':
    case 'widebrim': {
      tiltable = true;
      const straw = H.kind === 'straw';
      const by = B - 2;
      const rx = wB + (straw ? 22 : 27), ry = straw ? 7.5 : 8.5;
      const br = brim(by, rx, ry, C, straw ? 0 : 1.6);
      back += br.back;
      const yTop = T - (straw ? 10 : 7);
      front += wash(crownPts(wB + 2.4, wB * (straw ? 0.74 : 0.62), by, yTop, straw ? 0 : 3.4));
      // band
      front += flat([[cx - wB - 2.2, by - 7.5], [cx, by - 5.6], [cx + wB + 2.2, by - 7.5], [cx + wB + 2.6, by - 0.5], [cx, by + 2], [cx - wB - 2.6, by - 0.5]], C2 === PIG.cream ? dark : C2, { w: 1.1 });
      front += br.front;
      if (straw && pen.mid) {
        const ink = mixc(C, PIG.ink, 0.5);
        const n = pen.fine ? 9 : 5;
        for (let i = 0; i < n; i++) {
          const a = lerp(24, 156, i / (n - 1)) * Math.PI / 180;
          front += pen.line([[cx + Math.cos(a) * rx * 0.6, by + Math.sin(a) * ry * 0.45], [cx + Math.cos(a) * rx * 0.96, by + Math.sin(a) * ry * 0.92]], 0.7, { c: ink, op: 0.55, tp: 'flat' });
        }
        if (pen.fine) {
          for (const t of [0.3, 0.55, 0.8]) { const y = lerp(by - 8, yTop, t), w = lerp(wB + 2, wB * 0.74, t * 0.9) - 3; front += pen.line([[cx - w, y], [cx, y + 1.6], [cx + w, y]], 0.7, { c: ink, op: 0.45 }); }
          for (const sd of [-1, 1]) for (const dy of [-2, 1.5]) front += pen.line([[cx + sd * (rx - 1), by + dy * 0.6], [cx + sd * (rx + 3.4), by + dy]], 0.7, { c: ink, tp: 'out' });
        }
      }
      an.apex = [cx, yTop]; an.front = [cx, by - 4]; an.sideW = wB + 3; an.sideY = by - 4; an.crown = { x: cx, y: lerp(by - 8, yTop, 0.5), rx: wB * 0.6, ry: (by - 8 - yTop) * 0.4 };
      top = yTop - 2; clipY = by - 1;
      break;
    }
    case 'pointed':
    case 'witch': {
      tiltable = true;
      const witch = H.kind === 'witch';
      const by = B - 2, w = wB + 2.6;
      const Hc = witch ? 50 : v === 1 ? 70 : v === 3 ? 54 : 62;
      const bent = witch || v === 2 || v === 3;
      const br = brim(by, wB + (witch ? 25 : 15), witch ? 8 : 6, C, witch ? 1.4 : 0.4);
      back += br.back;
      const line: Pt[] = bent
        ? [U(0, by + 2), U(0, by - Hc * 0.33), U(2.5, by - Hc * 0.62), U(9, by - Hc * 0.84), U(19, by - Hc * 0.9), U(26, by - Hc * 0.78)]
        : [U(0, by + 2), U(0.6, by - Hc * 0.35), U(1.6, by - Hc * 0.7), U(2.6, by - Hc)];
      const wd = bent ? [w, w * 0.7, w * 0.42, w * 0.22, w * 0.1, 0.5] : [w, w * 0.66, w * 0.33, 0.5];
      front += wash(tubePts(line, wd), C, { sx: 5, sy: 3 });
      if (pen.mid) {
        // creases where the felt has given up
        const y1 = by - Hc * (bent ? 0.5 : 0.56);
        front += pen.line([U(-w * 0.5, y1 + 2), U(0, y1 - 1.5), U(w * 0.36, y1 + 1)], 1, { op: 0.5 });
        if (bent) front += pen.line([U(-w * 0.1, by - Hc * 0.7), U(4, by - Hc * 0.75), U(8, by - Hc * 0.7)], 0.9, { op: 0.5 });
      }
      front += flat([[cx - w - 0.4, by - 8], [cx, by - 6], [cx + w + 0.4, by - 8], [cx + w + 0.8, by - 0.5], [cx, by + 2], [cx - w - 0.8, by - 0.5]], C2 === PIG.cream ? deep : C2, { w: 1.1 });
      if (witch && pen.mid) front += `<rect x="${f(cx - 4.5)}" y="${f(by - 8.6)}" width="9" height="8.6" rx="1" fill="none" stroke="${PIG.gold2}" stroke-width="${f(1.9 * pen.k)}"/><rect x="${f(cx - 4.5)}" y="${f(by - 8.6)}" width="9" height="8.6" rx="1" fill="none" stroke="${pen.ink}" stroke-width="${f(0.5 * pen.k)}" opacity=".7"/>`;
      front += br.front;
      const tipP = line[line.length - 1];
      an.apex = tipP; an.front = [cx, by - 12]; an.sideW = w; an.sideY = by - 5; an.crown = { x: cx - d * 1, y: by - Hc * 0.36, rx: w * 0.5, ry: Hc * 0.2 };
      top = by - Hc * (bent ? 0.94 : 1) - 2; clipY = by - 1;
      break;
    }
    case 'beret': {
      tiltable = true;
      front += wash([U(-wB - 4, B - 3), U(-wB - 1, B - 13), U(-wB * 0.3, B - 20), U(wB * 0.5, B - 20.5), U(wB + 8, B - 15), U(wB + 15, B - 5), U(wB + 12, B + 5), U(wB + 2.6, B + 4), U(wB * 0.5, B + 2.6), U(0, B + 3), U(-wB * 0.55, B + 2.2)]);
      if (pen.fine) front += pen.line([U(-wB * 0.5, B - 12), U(wB * 0.4, B - 15), U(wB + 6, B - 9)], 0.8, { op: 0.4 });
      front += strip(B + 0.6, 4.2, 3, 2.8, C2 === PIG.cream || C2 === PIG.gold ? dark : C2);
      if (has('tip') || v === 1) front += flat(ellipse(cx - d * wB * 0.2, B - 22, 1.8, 2.6, 6), dark, { w: 0.9 });
      an.apex = U(wB * 0.2, B - 20.5); an.front = U(-wB * 0.45, B - 7); an.crown = { x: cx - d * wB * 0.3, y: B - 11, rx: wB * 0.7, ry: 5 };
      top = B - 24; clipY = B - 2;
      break;
    }
    case 'toque': {
      tiltable = true;
      const puff: Pt[] = [[cx - wB - 1, B - 11], [cx - wB - 12, B - 20], [cx - wB - 13, B - 33], [cx - wB - 3, B - 45], [cx - wB * 0.45, B - 49], [cx, B - 47.5], [cx + wB * 0.5, B - 51], [cx + wB + 2, B - 46], [cx + wB + 13, B - 34], [cx + wB + 11, B - 20], [cx + wB + 1, B - 11], [cx, B - 9]];
      front += wash(puff, C, { shade: '#d9d0ba', sx: 6, sy: 4 });
      if (pen.mid) for (const t of [-0.66, -0.22, 0.22, 0.66]) front += pen.line([[cx + t * wB, B - 12], [cx + t * (wB + 9), B - 27], [cx + t * (wB + 7), B - 37]], 0.9, { op: 0.42 });
      front += pen.blob(cw([[cx - wB - 1.6, B - 13.5], [cx, B - 11.5], [cx + wB + 1.6, B - 13.5], [cx + wB + 2.6, B + 0.4], [cx, B + 3.4], [cx - wB - 2.6, B + 0.4]]), C, { w: 1.5, shade: '#d9d0ba', sx: 4, sy: 2 });
      an.apex = [cx, B - 48]; an.front = [cx, B - 6]; an.crown = { x: cx, y: B - 31, rx: wB * 0.8, ry: 10 };
      top = B - 53; clipY = B - 2;
      break;
    }
    case 'chaperon': {
      tiltable = true;
      // the tail over the far shoulder
      back += tube([U(-wB - 3, B - 6), U(-wB - 10, B + 12), U(-wB - 8, geo.noseY), U(-wB - 13, geo.chin + 4), U(-wB - 9, nb + 14)], t => 5.5 * (1 - t * 0.45), C, { w: 1.3 });
      // gathered cloth, fallen to one side in a dagged cockscomb
      front += wash([U(-wB - 2, B - 8), U(-wB * 0.7, B - 21), U(-wB * 0.1, B - 26), U(wB * 0.4, B - 26), U(wB + 4, B - 23), U(wB + 13, B - 15), U(wB + 17, B - 7), U(wB + 12.5, B - 5), U(wB + 16, B + 3), U(wB + 10, B + 1.5), U(wB + 10, B + 9), U(wB + 4, B + 3), U(0, B - 4)]);
      if (pen.fine) front += pen.line([U(-wB * 0.3, B - 22), U(wB * 0.4, B - 17), U(wB + 8, B - 12)], 0.8, { op: 0.4 }) + pen.line([U(wB * 0.1, B - 24), U(wB + 2, B - 19), U(wB + 12, B - 10)], 0.8, { op: 0.4 });
      // the padded roll
      front += wash(ellipse(cx, B - 4.5, wB + 9, 9.5, 12), C, { sx: 3, sy: 4 });
      if (pen.mid) {
        const n = pen.fine ? 7 : 5;
        for (let i = 0; i < n; i++) {
          const x = cx + lerp(-wB - 4, wB + 2, i / (n - 1)), k2 = 1 - Math.abs((x - cx) / (wB + 9)) ** 2 * 0.5;
          front += pen.line([[x - 1.5, B - 4.5 - 8.5 * k2], [x + 3.5, B - 4.5 + 8.5 * k2]], 1.5, { c: C2 === PIG.cream ? deep : C2, tp: 'flat', op: 0.9 });
        }
      }
      an.apex = U(wB * 0.2, B - 26); an.front = [cx - d * 2, B - 5]; an.sideW = wB + 8; an.sideY = B - 6; an.crown = { x: cx - d * wB * 0.3, y: B - 18, rx: wB * 0.55, ry: 4 };
      top = B - 29; clipY = B - 2;
      break;
    }
    case 'bycocket': {
      tiltable = true;
      // peaked crown, brim turned up behind and drawn out to a beak in front
      const beak = U(-wB - 25, B + 3);
      front += wash([U(wB + 4, B - 1), U(wB + 5.5, B - 16), U(wB * 0.5, B - 29), U(-wB * 0.2, B - 31), U(-wB * 0.75, B - 18), U(-wB - 6, B - 7), U(-wB - 4, B + 2), U(0, B + 3.4)]);
      front += wash([beak, U(-wB - 9, B - 5), U(-wB * 0.4, B - 9.5), U(wB * 0.5, B - 12), U(wB + 8, B - 17), U(wB + 6.5, B - 3), U(wB + 2, B + 1.5), U(0, B + 3.6), U(-wB - 6, B + 4.6)], C2 === PIG.cream ? dark : C2, { sy: 2.4, sx: 3 });
      if (pen.fine) front += pen.line([U(-wB * 0.1, B - 29), U(wB * 0.3, B - 20), U(wB * 0.2, B - 13)], 0.8, { op: 0.45 });
      an.apex = U(-wB * 0.1, B - 31); an.front = U(-wB * 0.3, B - 3); an.sideW = wB + 6; an.sideY = B - 10; an.crown = { x: cx, y: B - 20, rx: wB * 0.45, ry: 5 };
      top = B - 34; clipY = B - 2;
      break;
    }
    case 'kettle': {
      tiltable = true;
      const by = B - 1;
      const brimPts: Pt[] = [[cx - wB - 3, by - 6], [cx - wB * 0.5, by - 3.4], [cx, by - 2.6], [cx + wB * 0.5, by - 3.4], [cx + wB + 3, by - 6], [cx + wB + 16, by + 2.5], [cx + wB * 0.55, by + 7.4], [cx, by + 8.6], [cx - wB * 0.55, by + 7.4], [cx - wB - 16, by + 2.5]];
      back += flat(ellipse(cx, by, wB + 15, 7, 12), PIG.steelDark, { w: 1.4 });
      front += wash([...dome(4.4, by - 4, 4), ...band(by - 4, 2.4, 4.4)], C, { sx: 5, sy: 4 });
      if (v === 1 && pen.mid) front += pen.line([[cx, T - 4.4], [cx + 0.4, by - 3]], 1.6, { c: PIG.steelDark, tp: 'flat' }) + pen.line([[cx - 1.6, T - 4], [cx - 1.3, by - 4]], 0.8, { c: liteOf(C, 0.6), tp: 'flat', op: 0.8 });
      if (pen.mid) front += pen.line([[cx - sk * 0.62, T + 9], [cx - sk * 0.42, T + 1.5], [cx - sk * 0.16, T - 2]], 2.2, { c: liteOf(C, 0.6), op: 0.85 });
      front += wash(brimPts, liteOf(C, 0.1), { sy: 2.4, sx: 3, shade: PIG.steelDark });
      if (pen.mid) for (let i = 0; i < 5; i++) { const t = (i + 0.5) / 5, x = cx + lerp(-wB - 1, wB + 1, t); front += pen.dot(x, by - 2.4 + (1 - Math.abs(t - 0.5) * 2) * 1.2, 1.1, PIG.iron); }
      if (pen.mid && C2 !== PIG.cream && !H.tiny) {
        // chin strap
        for (const sd of [-1, 1]) front += pen.line([[cx + sd * (wB + 1), by + 5], [cx + sd * (hw(geo.noseY) - 0.5), geo.noseY], [cx + sd * (g.head.chinW + 4), geo.chin - 3]], 1.5, { c: PIG.leatherDark, tp: 'flat', op: 0.9 });
      }
      an.apex = [cx, T - 4.4]; an.front = [cx, by - 10]; an.sideW = wB + 4; an.sideY = by - 6;
      top = T - 6; clipY = by - 1;
      break;
    }
    case 'knit': {
      tiltable = true;
      const flop = has('tip');
      let bob: Pt;
      if (flop) {
        bob = U(wB + 14, T + 15);
        front += wash([U(-wB - 4, B - 4), U(-wB - 3, B - 15), U(-wB * 0.5, T - 7), U(wB * 0.3, T - 11), U(wB + 5, T - 4), U(wB + 13, T + 9), U(wB + 9, T + 14), U(wB + 4, T + 7), U(wB + 4, B - 4), U(0, B - 1)]);
      } else {
        bob = [cx, T - 8];
        front += wash([...dome(4.4, B - 4, 4), ...band(B - 4, 3, 4.4)]);
      }
      if (pen.fine) for (let j = 0; j < 2; j++) for (let i = -2; i <= 2; i++) { const x = cx + i * wB * 0.36 + j * 4, y = T + 3 + j * 6 + Math.abs(i) * 2.5; front += pen.line([[x - 2, y - 2], [x, y + 1], [x + 2, y - 2]], 0.7, { op: 0.35 }); }
      const cuff = C2 === PIG.cream ? liteOf(C, 0.5) : C2;
      front += strip(B + 1, 8.5, 3, 5, cuff, { w: 1.4 });
      if (pen.mid) for (let i = 0; i <= 8; i++) { const t = i / 8, x = cx + lerp(-wB - 3, wB + 3, t), sg = (1 - (2 * t - 1) ** 2) * 3; front += pen.line([[x, B - 6.4 + sg], [x + 0.3, B + sg - 0.4]], 0.8, { op: 0.45, tp: 'flat', wob: 0.1 }); }
      // bobble
      const fuzz: Pt[] = ellipse(bob[0], bob[1], 5.4, 5.4, 9).map((p, i) => [p[0] + (i % 2 ? 1 : -0.6), p[1] + (i % 2 ? -0.8 : 0.6)] as Pt);
      front += flat(fuzz, cuff, { w: 1.1 });
      an.apex = flop ? U(wB * 0.3, T - 11) : [cx, T - 12]; an.front = [cx, B - 4];
      top = T - 14; clipY = B - 3;
      break;
    }
    case 'skep': {
      tiltable = true;
      // a straw hive, worn with conviction
      const yTop = B - 46, w = wB + 6;
      const body: Pt[] = [[cx - w, B + 1], [cx - w - 1, B - 14], [cx - w * 0.8, B - 32], [cx - w * 0.4, yTop + 3], [cx, yTop], [cx + w * 0.4, yTop + 3], [cx + w * 0.8, B - 32], [cx + w + 1, B - 14], [cx + w, B + 1], [cx, B + 4]];
      front += wash(body, C, { sx: 5, sy: 4, w: 0, wob: 0 });
      if (pen.mid) {
        const n = pen.fine ? 6 : 4;
        let rings = '';
        for (let i = 1; i <= n; i++) { const y = lerp(B + 2, yTop, i / (n + 1)); rings += `M${f(cx - w - 4)} ${f(y - 2)}Q${f(cx)} ${f(y + 4.5)} ${f(cx + w + 4)} ${f(y - 2)}`; }
        front += pen.inside(curve(cw(body), true), `<path d="${rings}" fill="none" stroke="${C2}" stroke-width="${f(1.1 * pen.k)}" opacity=".85"/>`);
      }
      front += pen.line(cw(body), 1.55, { closed: true });
      if (pen.mid) front += flat(ellipse(cx + d * 3, B - 6, 3.6, 3, 7), PIG.soot, { w: 0.9 });
      front += pen.bead(cx, yTop - 1, 2.4, C2, 1);
      an.apex = [cx, yTop - 2]; an.front = [cx, B - 14]; an.sideW = w; an.sideY = B - 10; an.crown = { x: cx, y: B - 26, rx: w * 0.5, ry: 8 };
      top = yTop - 5; clipY = B - 1;
      break;
    }
    case 'paperhat': {
      tiltable = true;
      // folded from a form, in triplicate
      const w = wB + 11, hh = 38;
      const sheet = liteOf(C, 0.25);
      front += pen.blobPoly(cw([[cx - w, B + 1], [cx - 1, B - hh], [cx + 1, B - hh], [cx + w, B + 1]]), sheet, { w: 1.5 });
      if (pen.mid) {
        front += pen.line([[cx, B - hh + 1], [cx + 0.5, B - 8]], 0.8, { op: 0.5, tp: 'flat' });
        for (let i = 0; i < (pen.fine ? 5 : 3); i++) {
          const y = B - 12 - i * 4.6, half = (w - 5) * ((y - (B - hh)) / hh) - 3;
          for (const sd of [-1, 1]) front += pen.line([[cx + sd * 3, y], [cx + sd * Math.max(4, half), y + sd * 0.4]], i === 1 ? 1.2 : 0.75, { c: i === 1 ? C2 : pen.ink, op: i === 1 ? 0.9 : 0.5, tp: 'flat', wob: 0.3 });
        }
      }
      front += pen.blobPoly(cw([[cx - w - 2.5, B + 2.5], [cx - w + 4, B - 8], [cx + w - 4, B - 8], [cx + w + 2.5, B + 2.5]]), C, { w: 1.5 });
      if (pen.mid) {
        front += pen.line([[cx - w + 7, B - 4], [cx - 9, B - 3.6]], 0.8, { op: 0.5, tp: 'flat', wob: 0.3 }) + pen.line([[cx + 9, B - 3.6], [cx + w - 12, B - 4]], 0.8, { op: 0.5, tp: 'flat', wob: 0.3 });
        front += pen.bead(cx + d * (w - 9), B - 3, 3.6, C2, 0.9) + (pen.fine ? pen.dot(cx + d * (w - 9), B - 3, 1.5, PIG.redDeep) : '');
      }
      an.apex = [cx, B - hh]; an.front = [cx, B - 3]; an.sideW = w - 4; an.sideY = B - 4; an.crown = { x: cx, y: B - 17, rx: w * 0.3, ry: 5 };
      top = B - hh - 2; clipY = B - 2;
      break;
    }
    case 'mitre': {
      tiltable = true;
      const hh = 58, w = wB + 2.5;
      // lappets behind the ears
      for (const sd of [-1, 1]) {
        const x = cx + sd * (hw(geo.eyeY) + 2.5);
        back += flat([[x - 4, B], [x + 4, B], [x + 5, nb + 8], [x - 5, nb + 8]], C, { w: 1.2 });
        if (pen.mid) back += pen.line([[x - 5, nb + 4], [x + 5, nb + 4]], 2.2, { c: C2, tp: 'flat', wob: 0 });
      }
      const body: Pt[] = [[cx - w, B + 1], [cx - w - 4.5, B - hh * 0.36], [cx - w * 0.72, B - hh * 0.7], [cx - 1.2, B - hh], [cx + 1.2, B - hh], [cx + w * 0.72, B - hh * 0.7], [cx + w + 4.5, B - hh * 0.36], [cx + w, B + 1], [cx, B + 3.6]];
      front += wash(body, C, { shade: '#d6cbb0', sx: 5, sy: 3, w: 0, wob: 0 });
      const gold = `<rect x="${f(cx - 4.6)}" y="${f(B - hh - 4)}" width="9.2" height="${f(hh + 8)}" fill="${C2}"/><path d="M${f(cx - w - 8)} ${f(B - 10)}Q${f(cx)} ${f(B - 5)} ${f(cx + w + 8)} ${f(B - 10)}L${f(cx + w + 8)} ${f(B + 6)}L${f(cx - w - 8)} ${f(B + 6)}Z" fill="${C2}"/>`
        + (pen.mid ? `<path d="M${f(cx - 4.6)} ${f(B - hh)}V${f(B - 8)}M${f(cx + 4.6)} ${f(B - hh)}V${f(B - 8)}M${f(cx - w - 8)} ${f(B - 10)}Q${f(cx)} ${f(B - 5)} ${f(cx + w + 8)} ${f(B - 10)}" fill="none" stroke="${PIG.goldInk}" stroke-width="${f(0.8 * pen.k)}"/>` : '');
      front += pen.inside(curve(cw(body), true), gold);
      front += pen.line(cw(body), 1.55, { closed: true });
      if (pen.mid) {
        front += pen.bead(cx, B - hh * 0.5, 3, PIG.madder, 0.8);
        if (pen.fine) for (const sd of [-1, 1]) front += pen.bead(cx + sd * w * 0.55, B - 3.4, 1.7, PIG.lapisLite, 0.6) + pen.star(cx + sd * w * 0.6, B - hh * 0.38, 3, C2, 4);
      }
      an.apex = [cx, B - hh]; an.front = [cx, B - 4]; an.sideW = w; an.sideY = B - 6;
      top = B - hh - 2; clipY = B - 2;
      break;
    }
    case 'circlet':
    case 'leafband':
    case 'headband': {
      const y = B - 0.5;
      if (H.kind === 'headband') {
        const kn = U(wB + 2.5, y - 1);
        back += flat([kn, U(wB + 13, y + 6), U(wB + 10, y + 21), U(wB + 5, y + 8)], C, { w: 1.2 }) + flat([kn, U(wB + 10, y - 3), U(wB + 20, y + 7), U(wB + 12, y + 5)], C, { w: 1.2 });
        front += strip(y + 2.6, 5.6, 2.8, 2.2, C, { w: 1.4 });
        if (pen.fine) front += pen.line(band(y, 2.8, 1), 0.7, { op: 0.4, tp: 'flat' });
        front += flat(ellipse(kn[0], kn[1], 3.2, 3.4, 7), dark, { w: 1.1 });
      } else if (H.kind === 'leafband') {
        // elvish: a thread of metal and one leaf
        front += pen.line(band(y, 3, 1.4), 2.6, { c: PIG.ink, tp: 'flat', wob: 0.1, op: 0.85 }) + pen.line(band(y, 3, 1.4), 1.5, { c: C, tp: 'flat', wob: 0.1 });
        const ly = y + 3;
        for (const sd of [-1, 1]) front += flat([[cx, ly + 1], [cx + sd * 4.5, ly - 3], [cx + sd * 9.5, ly - 3.6], [cx + sd * 5.5, ly + 1.6]], liteOf(C, 0.2), { w: 0.9 });
        front += pen.bead(cx, ly + 1.4, 2, g.eyes.iris, 0.8);
      } else {
        front += strip(y + 2, 4.6, 3, 2, C, { w: 1.3 });
        if (pen.mid) front += pen.line(band(y - 1.4, 3, 1.4), 0.9, { c: PIG.gold2, tp: 'flat', wob: 0.1 });
        front += flat([[cx, y - 3.6], [cx + 4.6, y + 2], [cx, y + 7], [cx - 4.6, y + 2]], C, { w: 1.2 }) + pen.bead(cx, y + 2, 2.3, C2, 0.8);
        if (pen.mid) for (const sd of [-1, 1]) front += pen.dot(cx + sd * wB * 0.55, y + 1.4, 1.2, PIG.goldInk);
      }
      covers = 'none'; top = Math.min(T, y - 6);
      an.front = [cx, y]; an.sideW = wB + 2; an.sideY = y;
      break;
    }
    case 'coronet':
    case 'ducal':
    case 'crown': {
      const y = B - 0.5, w = wB + 2.6;
      const kind = H.kind;
      const rise = kind === 'crown' ? 17 : kind === 'ducal' ? 13 : 9;
      const sag = (x: number) => 3 * (1 - ((x - cx) / w) ** 2);
      if (kind !== 'coronet') {
        // the cap of estate inside the gold
        front += wash([...dome(4, y - 3, 4, i => (kind === 'crown' && (i === 4 || i === 6) ? 2 : 0)), ...band(y - 3, 3, 4)], C2, { sx: 4, sy: 3 });
        clipY = y - 3;
      } else covers = 'none';
      // points
      const n = 5;
      let pts = '';
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, x = cx + lerp(-w + 2, w - 2, t), pw = (w * 2) / n / 2 - 0.6;
        const yb = y - 3 + sag(x), hgt = rise * (i === 2 ? 1.12 : i % 2 ? 0.86 : 1);
        if (kind === 'coronet') {
          pts += pen.blobPoly([[x - pw, yb], [x, yb - hgt], [x + pw, yb]], C, { w: 1.1 }) + pen.bead(x, yb - hgt - 1.2, 2.3, C === PIG.silver ? PIG.linen : PIG.silver, 0.8);
        } else if (kind === 'ducal') {
          // strawberry leaves
          pts += pen.blobPoly([[x - pw * 0.5, yb], [x - pw * 0.4, yb - hgt * 0.5], [x + pw * 0.4, yb - hgt * 0.5], [x + pw * 0.5, yb]], C, { w: 1 });
          for (const [dx, dy, rr] of [[-pw * 0.62, -hgt * 0.62, 2.7], [pw * 0.62, -hgt * 0.62, 2.7], [0, -hgt, 3.1]] as [number, number, number][]) pts += pen.bead(x + dx, yb + dy, rr, C, 0.9);
        } else {
          // fleurs and crosses, turn about
          if (i % 2 === 0) {
            pts += pen.blobPoly([[x - pw * 0.55, yb], [x - pw * 0.3, yb - hgt * 0.5], [x - pw, yb - hgt * 0.72], [x - pw * 0.4, yb - hgt * 0.86], [x, yb - hgt * 1.12], [x + pw * 0.4, yb - hgt * 0.86], [x + pw, yb - hgt * 0.72], [x + pw * 0.3, yb - hgt * 0.5], [x + pw * 0.55, yb]], C, { w: 1 });
          } else {
            pts += pen.blobPoly([[x - 1.6, yb], [x - 1.6, yb - hgt * 0.5], [x - 4.4, yb - hgt * 0.5], [x - 4.4, yb - hgt * 0.76], [x - 1.6, yb - hgt * 0.76], [x - 1.6, yb - hgt], [x + 1.6, yb - hgt], [x + 1.6, yb - hgt * 0.76], [x + 4.4, yb - hgt * 0.76], [x + 4.4, yb - hgt * 0.5], [x + 1.6, yb - hgt * 0.5], [x + 1.6, yb]], C, { w: 1 });
          }
        }
      }
      if (kind === 'crown') {
        // arches meeting under the orb
        const ay = T - 13;
        front += pen.line([[cx - w + 3, y - 12], [cx - w * 0.5, ay + 6], [cx, ay]], 3.2, { c: PIG.goldInk, tp: 'flat', wob: 0.1 }) + pen.line([[cx + w - 3, y - 12], [cx + w * 0.5, ay + 6], [cx, ay]], 3.2, { c: PIG.goldInk, tp: 'flat', wob: 0.1 });
        front += pen.line([[cx - w + 3, y - 12], [cx - w * 0.5, ay + 6], [cx, ay]], 1.9, { c: C, tp: 'flat', wob: 0.1 }) + pen.line([[cx + w - 3, y - 12], [cx + w * 0.5, ay + 6], [cx, ay]], 1.9, { c: C, tp: 'flat', wob: 0.1 });
        front += pen.bead(cx, ay - 3, 4, C, 1) + pen.line([[cx, ay - 7], [cx, ay - 14]], 1.8, { c: PIG.goldInk, tp: 'flat', wob: 0 }) + pen.line([[cx - 3, ay - 11], [cx + 3, ay - 11]], 1.8, { c: PIG.goldInk, tp: 'flat', wob: 0 });
        top = ay - 16;
      } else top = Math.min(T - (kind === 'ducal' ? 6 : 0), y - 3 - rise * 1.2 - 4);
      front += pts;
      front += strip(y + 2.6, 6.4, 3, 2.6, C, { w: 1.4, shade: PIG.goldInk, sx: 3, sy: 1.6 });
      if (pen.mid) {
        front += pen.line(band(y - 2.6, 3, 2), 0.9, { c: C === PIG.silver ? PIG.linen : PIG.gold2, tp: 'flat', wob: 0.1 });
        const gems = kind === 'coronet' ? [C2] : kind === 'ducal' ? [PIG.lapisLite, C2, PIG.lapisLite] : [PIG.green, PIG.lapisLite, PIG.madder, PIG.lapisLite, PIG.green];
        gems.forEach((gc, i) => { const x = cx + (i - (gems.length - 1) / 2) * (w * 1.5 / Math.max(2, gems.length)); front += pen.bead(x, y + sag(x) * 0.95 - 0.4, i === (gems.length - 1) / 2 ? 2.4 : 1.9, gc, 0.8); });
      }
      an.front = [cx, y]; an.sideW = w; an.sideY = y - 2; an.apex = [cx, top + 2];
      break;
    }
    case 'wreath': {
      // a ring of leaves riding high on the brow
      const n = pen.mid ? 11 : 7;
      const leaf = (x: number, y: number, ang: number, len: number, c: string): string => flat(rot([[x - len, y], [x - len * 0.2, y - len * 0.42], [x + len, y], [x - len * 0.2, y + len * 0.42]], ang, x, y), c, { w: 0.9 });
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), x = cx + lerp(-wB - 3, wB + 3, t), y = B - 1 - Math.sin(Math.PI * t) * 5.5;
        const ang = (t < 0.5 ? lerp(-38, -6, t * 2) : 180 + lerp(6, 38, (t - 0.5) * 2)) + (i % 2 ? 28 : -28);
        front += leaf(x, y, ang, 6.4, i % 3 === 1 ? liteOf(C, 0.2) : i % 3 ? C : shadeOf(C, 0.16));
      }
      if (pen.mid) front += pen.line([[cx - wB - 3, B - 1], [cx - wB * 0.5, B - 5], [cx, B - 6.5], [cx + wB * 0.5, B - 5], [cx + wB + 3, B - 1]], 0.9, { c: shadeOf(C, 0.4), op: 0.7 });
      covers = 'none'; top = Math.min(T - 2, B - 14);
      an.front = [cx, B - 6]; an.sideW = wB + 3; an.sideY = B - 2;
      break;
    }
    default:
      break;
  }

  // ───────────── trimmings ─────────────
  const side = (s: number): Pt => [cx + s * an.sideW, an.sideY];
  const cr = an.crown;
  if (has('dust')) for (let i = 0; i < (pen.mid ? 9 : 4); i++) front += pen.dot(cr.x + r.jit(cr.rx * 1.3), cr.y + r.jit(cr.ry), r.range(0.8, 1.8) * (pen.mid ? 1 : 1.8), g.marks.soot ? PIG.soot : PIG.flour, 0.8);
  if (has('patch') && pen.mid) {
    const x = cr.x + d * cr.rx * 0.5, y = cr.y + cr.ry * 0.3;
    front += pen.blobPoly(rot([[x - 4.5, y - 4], [x + 4.5, y - 4.4], [x + 4.8, y + 4], [x - 4.2, y + 4.4]], d * 12, x, y), mixc(C, PIG.ochre, 0.55), { w: 0.9 });
    if (pen.fine) for (const [dx, dy] of [[-4.6, 0], [0, -4.4], [4.8, 0], [0, 4.4]]) front += pen.line([[x + dx - 1.1, y + dy - 0.9], [x + dx + 1.1, y + dy + 0.9]], 0.6, { tp: 'flat', wob: 0 });
  }
  if (has('stars')) {
    const n = pen.fine ? 6 : pen.mid ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.6, k2 = 0.35 + (i % 3) * 0.3;
      front += pen.star(cr.x + Math.cos(a) * cr.rx * k2 * 1.25, cr.y + Math.sin(a) * cr.ry * k2 * 1.6 - (H.kind === 'pointed' ? i * 3.5 : 0), pen.mid ? 2.3 + (i % 2) * 1.1 : 4, PIG.gold2, i % 3 === 2 ? 4 : 5);
    }
    if (pen.mid && (H.kind === 'pointed' || H.kind === 'witch')) {
      const x = cr.x - d * cr.rx * 0.3, y = cr.y + cr.ry * 0.9;
      front += `<path d="M${f(x)} ${f(y - 4.6)}A4.6 4.6 0 1 0 ${f(x + 4.2)} ${f(y + 1.6)}A3.6 3.6 0 1 1 ${f(x)} ${f(y - 4.6)}Z" fill="${PIG.gold2}" stroke="${pen.ink}" stroke-width=".5"/>`;
    }
  }
  if (has('coins') && pen.mid) {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = cx + lerp(-wB - 1, wB + 1, t), y = an.front[1] + 9 - (1 - (2 * t - 1) ** 2) * 3.4 + (H.kind === 'kerchief' && v < 2 ? -2 : 3);
      front += pen.bead(x, y, 1.9, PIG.gold2, 0.6);
    }
  }
  if (has('badge')) {
    const p: Pt = H.kind === 'beret' || H.kind === 'chaperon' ? an.front : [an.front[0], an.front[1] - 1];
    if (pen.mid) front += flat([[p[0] - 3.6, p[1] - 4], [p[0] + 3.6, p[1] - 4], [p[0] + 3.6, p[1] + 0.6], [p[0], p[1] + 4.8], [p[0] - 3.6, p[1] + 0.6]], PIG.gold2, { w: 0.9 }) + (pen.fine ? pen.dot(p[0], p[1] - 0.6, 1.1, PIG.madder) : '');
    else front += pen.dot(p[0], p[1], 3.4, PIG.gold2);
  }
  if (has('flowers')) {
    const n = pen.mid ? 4 : 2;
    const cols = [PIG.linen, PIG.rose, PIG.weld, PIG.sky];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), x = cx + lerp(-an.sideW * 0.8, an.sideW * 0.8, t) + r.jit(1.5), y = an.sideY + 1 - Math.sin(Math.PI * t) * (H.kind === 'wreath' ? 5 : -2.5);
      const pc = cols[(i + (g.seed & 3)) % cols.length];
      if (pen.mid) for (let j = 0; j < 5; j++) { const a = (j / 5) * Math.PI * 2 + i; front += pen.dot(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2, pc); }
      front += pen.bead(x, y, pen.mid ? 1.7 : 3, pen.mid ? PIG.weld : pc, 0.7);
    }
  }
  if (has('sprig') && pen.mid) {
    const s0 = side(d), tip2: Pt = [s0[0] + d * 9, s0[1] - 19];
    front += pen.line([s0, [s0[0] + d * 3, s0[1] - 10], tip2], 1, { c: PIG.forest, tp: 'flat' });
    for (let i = 0; i < 4; i++) {
      const t = 0.25 + i * 0.22, x = lerp(s0[0], tip2[0], t), y = lerp(s0[1], tip2[1], t), sd2 = i % 2 ? 1 : -1;
      front += flat(rot([[x, y], [x + 3, y - 2.4], [x + 7, y], [x + 3, y + 2.2]], sd2 > 0 ? -30 : 210, x, y), i % 2 ? PIG.green : PIG.forest, { w: 0.7 });
    }
  }
  if (has('bow') && pen.mid) {
    const p = side(-d);
    front += flat([p, [p[0] - 7, p[1] - 5], [p[0] - 7.5, p[1] + 4]], C2, { w: 1 }) + flat([p, [p[0] + 7, p[1] - 5], [p[0] + 7.5, p[1] + 4]], C2, { w: 1 }) + pen.bead(p[0], p[1], 1.8, shadeOf(C2, 0.2), 0.7);
  }
  if (has('feather')) {
    // one long feather, raked back
    const s0 = side(-d), fc = [PIG.madder, PIG.linen, PIG.russet, PIG.green][g.seed & 3];
    const spine: Pt[] = [[s0[0] + d * 3, s0[1] + 1], [s0[0] - d * 3, s0[1] - 14], [s0[0] - d * 11, s0[1] - 27], [s0[0] - d * 22, s0[1] - 36]];
    const fx2 = flat(tubePts(spine, [0.8, 4.4, 4, 0.6]), fc, { w: 1.1 }) + pen.line(spine, 0.8, { tp: 'flat', op: 0.7 });
    let barbs = '';
    if (pen.fine) for (const t of [0.35, 0.5, 0.65, 0.8]) { const x = lerp(spine[0][0], spine[3][0], t) - d * 1.5 * Math.sin(t * 3), y = lerp(spine[0][1], spine[3][1], t) - 3; barbs += pen.line([[x, y], [x - d * 0.5, y - 4.4]], 0.5, { op: 0.5, tp: 'out' }) + pen.line([[x, y], [x - d * 4, y + 1.4]], 0.5, { op: 0.5, tp: 'out' }); }
    front += fx2 + barbs;
    top = Math.min(top, s0[1] - 38);
  }
  if (has('plumes')) {
    // ostrich plumes: more than the wearer needs
    const s0: Pt = H.kind === 'bascinet' ? an.apex : H.kind === 'beret' ? [cx - d * (an.sideW - 4), an.sideY - 8] : side(-d);
    const cols = [C2 === PIG.gold || C2 === PIG.cream ? PIG.linen : C2, C2 === PIG.gold ? PIG.gold2 : C2 === PIG.madder ? PIG.linen : liteOf(C2, 0.4)];
    let s = '';
    for (let i = 1; i >= 0; i--) {
      const lean = (i ? -1 : 0.4) * -d, hgt = i ? 26 : 32;
      const spine: Pt[] = [[s0[0], s0[1] + 2], [s0[0] + lean * 4, s0[1] - hgt * 0.5], [s0[0] + lean * 10 - d * 2, s0[1] - hgt * 0.9], [s0[0] + lean * 19 - d * 5, s0[1] - hgt * 0.95], [s0[0] + lean * 23 - d * 7, s0[1] - hgt * 0.72]];
      const outline = tubePts(spine, [1.2, 5.6, 6.4, 5, 2.4]).map((p, j) => [p[0] + (j % 2 ? 0.9 : -0.7), p[1] + (j % 2 ? -0.7 : 0.8)] as Pt);
      s += flat(outline, cols[i], { w: 1.1 });
      if (pen.mid) s += pen.line(spine, 0.8, { op: 0.5, tp: 'out' });
      top = Math.min(top, s0[1] - hgt - 3);
    }
    if (H.kind === 'bascinet') front += s; else back += s;
  }
  if (has('candle')) {
    // a stub of candle for working late, stuck on with its own wax
    const p: Pt = [an.apex[0] + d * 2, an.apex[1] + 1.5];
    front += flat([[p[0] - 6.5, p[1] + 2.5], [p[0] - 3, p[1] - 1.6], [p[0] + 3.4, p[1] - 1.6], [p[0] + 7, p[1] + 2.8], [p[0] + 2, p[1] + 4.6], [p[0] - 3, p[1] + 4.4]], PIG.wax, { w: 0.9 });
    front += pen.blobPoly([[p[0] - 2.6, p[1]], [p[0] - 2.6, p[1] - 10], [p[0] + 2.6, p[1] - 10], [p[0] + 2.6, p[1]]], PIG.wax, { w: 1 });
    if (pen.mid) front += pen.line([[p[0] + 2.6, p[1] - 9], [p[0] + 3.4, p[1] - 5], [p[0] + 2.8, p[1] - 3]], 1.6, { c: PIG.wax, tp: 'out' }) + pen.line([[p[0], p[1] - 10], [p[0] + 0.3, p[1] - 12.4]], 0.8, { tp: 'flat', wob: 0 });
    front += `<g class="llp-flame"><path d="M${f(p[0])} ${f(p[1] - 21)}C${f(p[0] + 4.4)} ${f(p[1] - 16)} ${f(p[0] + 3.4)} ${f(p[1] - 11.4)} ${f(p[0])} ${f(p[1] - 11.4)}C${f(p[0] - 3.4)} ${f(p[1] - 11.4)} ${f(p[0] - 3.6)} ${f(p[1] - 15)} ${f(p[0])} ${f(p[1] - 21)}Z" fill="${PIG.flame}" stroke="${pen.ink}" stroke-width="${f(0.6 * pen.k)}"/><path d="M${f(p[0])} ${f(p[1] - 17)}C${f(p[0] + 1.8)} ${f(p[1] - 14.4)} ${f(p[0] + 1.6)} ${f(p[1] - 12.4)} ${f(p[0])} ${f(p[1] - 12.4)}C${f(p[0] - 1.6)} ${f(p[1] - 12.4)} ${f(p[0] - 1.6)} ${f(p[1] - 14.4)} ${f(p[0])} ${f(p[1] - 17)}Z" fill="${PIG.flameCore}"/></g>`;
    top = Math.min(top, p[1] - 23);
  }
  if (has('rat') && pen.mid) {
    // a colleague, riding on the brim
    const p: Pt = [cx + d * (an.sideW * 0.55), an.sideY - 5];
    const fur = '#8d7f72';
    front += pen.line([[p[0] - d * 5, p[1] - 1], [p[0] - d * 13, p[1] + 2], [p[0] - d * 18, p[1] - 3], [p[0] - d * 23, p[1] + 1]], 1.3, { c: '#c79a8c', tp: 'out' });
    front += flat([[p[0] - d * 7, p[1] + 1], [p[0] - d * 6, p[1] - 6], [p[0], p[1] - 8.6], [p[0] + d * 6.5, p[1] - 5.6], [p[0] + d * 12, p[1] - 1.6], [p[0] + d * 6, p[1] + 1.4]], fur, { w: 1.1 });
    front += pen.bead(p[0] + d * 1.6, p[1] - 9, 2.6, '#b9a092', 0.8) + pen.dot(p[0] + d * 6.4, p[1] - 4.4, 0.95, pen.ink) + pen.dot(p[0] + d * 12, p[1] - 1.8, 1.1, '#c98a8c');
    if (pen.fine) front += pen.line([[p[0] + d * 10.5, p[1] - 1.5], [p[0] + d * 15, p[1] - 3.4]], 0.4, { tp: 'flat', op: 0.7 }) + pen.line([[p[0] + d * 10.5, p[1] - 1], [p[0] + d * 15, p[1] + 0.4]], 0.4, { tp: 'flat', op: 0.7 });
    top = Math.min(top, p[1] - 13);
  }

  return { back, front, top, covers, clipY, hidesEars, tiltable };
}

/** A sliver of hair showing under the front edge of a hood or coif. */
function fringe(g: Genome, geo: Geo, pen: Pen, browY: number): string {
  const cx = geo.cx, w = g.head.skull * 0.5;
  const c = g.hair.color;
  return pen.blob([[cx - w, browY - 1.6], [cx - w * 0.3, browY - 3], [cx + w * 0.3, browY - 3], [cx + w, browY - 1.6], [cx + w * 0.7, browY + 3.2], [cx + w * 0.2, browY + 1.8], [cx - w * 0.3, browY + 3.6], [cx - w * 0.75, browY + 2]], c, { w: 1, line: mixc(c, PIG.ink, 0.72) });
}
