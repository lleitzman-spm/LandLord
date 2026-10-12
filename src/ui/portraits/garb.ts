/**
 * Portraits: what is worn below the chin. Tunics, kirtles, robes, cowls,
 * fur collars, aprons, tabards, mail, mantles and shawls, each a flat wash
 * with a second tone and a few ink folds, plus chains, brooches and badges.
 */
import { lerp, mirror, ellipse, arc, mixc, shadeOf, liteOf, f, curve, type Pt } from './util';
import { PIG } from './pigments';
import type { Genome, GarbExtra } from './types';
import type { Pen } from './pen';
import type { Geo } from './head';

export interface GarbOut { back: string; front: string }

export function drawGarb(g: Genome, geo: Geo, pen: Pen): GarbOut {
  // necklines are cut for the garment, not the neck: an ogre's collar is still a collar
  const G = g.garb, cx = geo.cx, nb = geo.nb, nw = Math.min(G.neckW, 25), sw = G.shW;
  const r = pen.r.fork('garb');
  const C = G.c, C2 = G.c2;
  const has = (e: GarbExtra) => G.extras.includes(e);
  const LN: Pt = [cx - nw * 1.25, nb - 1], RN: Pt = [cx + nw * 1.25, nb - 1];
  const sidesL: Pt[] = [[cx - sw - 6, 218], [cx - sw, nb + 20], [cx - sw * 0.62, nb + 7]];
  const sidesR: Pt[] = mirror(sidesL, cx).reverse();
  const neckRound: Pt[] = [[cx - nw * 0.7, nb + 5], [cx, nb + 8], [cx + nw * 0.7, nb + 5]];
  const neckVee = (d: number): Pt[] => [[cx - nw * 0.62, nb + d * 0.42], [cx, nb + d], [cx + nw * 0.62, nb + d * 0.42]];
  const body = (neck: Pt[], ln: Pt = LN, rn: Pt = RN): Pt[] => [...sidesL, ln, ...neck, rn, ...sidesR, [cx, 222]];
  const wash = (pts: Pt[], c: string, w = 1.6) => pen.blob(pts, c, { w, shade: true, sx: 5, sy: 4 });
  const bodyD = (neck: Pt[]) => curve(body(neck), true);
  const trim = (pts: Pt[], c: string, w = 4.2) => pen.line(pts.map(p => [p[0], p[1] + w * 0.42] as Pt), w, { c, tp: 'flat', wob: 0.15 }) + (pen.fine ? pen.line(pts.map(p => [p[0], p[1] + w * 0.92] as Pt), 0.7, { tp: 'flat', op: 0.7, wob: 0.15 }) : '');
  const folds = (): string => {
    if (!pen.fine) return pen.mid ? pen.line([[cx - sw * 0.7, nb + 15], [cx - sw * 0.66, 204]], 1, { op: 0.4 }) + pen.line([[cx + sw * 0.7, nb + 15], [cx + sw * 0.66, 204]], 1, { op: 0.4 }) : '';
    let s = '';
    for (const sd of [-1, 1]) {
      s += pen.line([[cx + sd * sw * 0.72, nb + 14], [cx + sd * sw * 0.69, nb + 34], [cx + sd * sw * 0.66, 206]], 1.1, { op: 0.5 });
      s += pen.line([[cx + sd * sw * 0.42, nb + 22], [cx + sd * sw * 0.4, nb + 44]], 0.85, { op: 0.35 });
    }
    return s;
  };
  let back = '', front = '';

  switch (G.kind) {
    case 'tunic':
    case 'jerkin': {
      if (G.kind === 'jerkin') {
        // a shirt, and over it a leather vest open down the front
        front += wash(body(neckRound), C2) + folds();
        const vest = (sd: number): Pt[] => [[cx + sd * (sw + 6), 218], [cx + sd * sw, nb + 20], [cx + sd * sw * 0.62, nb + 7], [cx + sd * nw * 1.3, nb - 1], [cx + sd * nw * 0.9, nb + 12], [cx + sd * 7, nb + 34], [cx + sd * 9, 220]];
        front += wash(vest(-1), C, 1.4) + wash(vest(1), C, 1.4);
        if (pen.mid) for (let i = 0; i < 3; i++) front += pen.line([[cx - 8, nb + 30 + i * 9], [cx + 8, nb + 33 + i * 9]], 1, { c: PIG.leatherDark, tp: 'flat' });
      } else {
        front += wash(body(neckRound), C) + folds();
        front += trim([LN, ...neckRound, RN], G.trim === C ? C2 : G.trim, 3.6);
        if (pen.mid) front += pen.line([[cx, nb + 10], [cx + 0.6, nb + 22]], 1.1, { tp: 'out' });
      }
      break;
    }
    case 'kirtle': {
      const ln: Pt = [cx - nw * 1.9, nb + 2], rn: Pt = [cx + nw * 1.9, nb + 2];
      const neck: Pt[] = [[cx - nw * 1.35, nb + 11], [cx, nb + 15], [cx + nw * 1.35, nb + 11]];
      front += pen.blob([[cx - nw * 2.1, nb + 2], [cx - nw * 1.2, nb - 1], [cx + nw * 1.2, nb - 1], [cx + nw * 2.1, nb + 2], [cx + nw * 1.6, nb + 16], [cx, nb + 19], [cx - nw * 1.6, nb + 16]], PIG.linen, { w: 1.1 });
      front += wash(body(neck, ln, rn), C) + folds();
      front += trim([ln, ...neck, rn], C2, 3);
      break;
    }
    case 'robe':
    case 'highcollar': {
      const neck = neckVee(24);
      front += pen.blob([[cx - nw * 1.3, nb - 2], [cx + nw * 1.3, nb - 2], [cx + nw * 1.1, nb + 22], [cx, nb + 28], [cx - nw * 1.1, nb + 22]], C2, { w: 1.1 });
      if (pen.mid) front += pen.line([[cx - nw * 0.8, nb + 3], [cx, nb + 6.5], [cx + nw * 0.8, nb + 3]], 1, { op: 0.6 });
      front += wash(body(neck), C) + folds();
      front += trim([LN, ...neck, RN], mixc(C, PIG.cream, 0.45), 3.4);
      if (pen.mid) front += pen.line([[cx, nb + 25], [cx + 5, nb + 44], [cx + 7, 210]], 1.2, { op: 0.7, tp: 'out' });
      if (G.kind === 'highcollar') {
        // a standing collar behind the neck, its lining showing at the edge
        const hi = Math.min(30, g.garb.neckLen + 16), wd = nw * 1.5 + 13;
        const fan: Pt[] = [[cx - nw * 1.15, nb + 9], [cx - wd + 3, nb - 2], [cx - wd - 3, nb - hi + 6], [cx - wd + 5, nb - hi - 2], [cx, nb - hi - 4], [cx + wd - 5, nb - hi - 2], [cx + wd + 3, nb - hi + 6], [cx + wd - 3, nb - 2], [cx + nw * 1.15, nb + 9], [cx, nb + 12]];
        back += pen.blob(fan, C, { w: 1.5, shade: true, sx: 4, sy: 3 });
        if (pen.mid) back += pen.fill([[cx - wd + 6.5, nb - 1], [cx - wd + 1.6, nb - hi + 7], [cx - wd + 7, nb - hi + 1.6], [cx, nb - hi - 0.6], [cx + wd - 7, nb - hi + 1.6], [cx + wd - 1.6, nb - hi + 7], [cx + wd - 6.5, nb - 1], [cx, nb + 4]], C2 === PIG.linen || C2 === PIG.cream ? shadeOf(C, 0.34) : C2, 0.92);
      }
      break;
    }
    case 'cowl': {
      front += wash(body(neckRound), C2) + folds();
      // the shoulder cape of a hood, with a dagged edge
      const w0 = Math.min(sw * 0.86, nw * 2 + 30);
      const edge: Pt[] = [];
      const n = pen.mid ? 7 : 3;
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = cx + lerp(-w0, w0, t), y = nb + 16 + Math.sin(Math.PI * t) * 20;
        edge.push([x, y + (pen.mid && i % 2 ? 4.5 : 0)]);
      }
      const cape: Pt[] = [[cx - w0 - 2, nb + 9], [cx - nw * 1.9, nb + 1], LN, ...neckRound, RN, [cx + nw * 1.9, nb + 1], [cx + w0 + 2, nb + 9], ...edge.reverse()];
      front += wash(cape, C, 1.5);
      if (g.hat.kind !== 'hood' && g.hat.kind !== 'deephood') {
        // hood thrown back: a soft roll behind the neck
        back += pen.blob([[cx - nw * 2.3, nb + 4], [cx - nw * 2.1, nb - 10], [cx, nb - 15], [cx + nw * 2.1, nb - 10], [cx + nw * 2.3, nb + 4]], shadeOf(C, 0.2), { w: 1.4 });
        front += pen.line([[cx - nw * 1.5, nb + 1], [cx - nw * 0.6, nb + 9], [cx, nb + 11], [cx + nw * 0.6, nb + 9], [cx + nw * 1.5, nb + 1]], 4.6, { c: liteOf(C, 0.12), tp: 'both' });
      }
      break;
    }
    case 'fur':
    case 'ermine': {
      const neck = neckVee(20);
      front += pen.blob([[cx - nw * 1.3, nb - 2], [cx + nw * 1.3, nb - 2], [cx + nw, nb + 20], [cx, nb + 25], [cx - nw, nb + 20]], PIG.linen, { w: 1.1 });
      front += wash(body(neck), C) + folds();
      if (G.kind === 'ermine') {
        // a whole cape of it, with the black tails
        const w0 = Math.min(sw * 0.94, 78);
        const cape: Pt[] = [[cx - w0, nb + 12], [cx - nw * 1.9, nb], LN, ...neckVee(13), RN, [cx + nw * 1.9, nb], [cx + w0, nb + 12], [cx + w0 - 6, nb + 34], [cx + w0 * 0.5, nb + 44], [cx, nb + 40], [cx - w0 * 0.5, nb + 44], [cx - w0 + 6, nb + 34]];
        front += pen.blob(cape, PIG.linen, { w: 1.5, shade: '#d6cbb0', sx: 5, sy: 4 });
        if (pen.mid) {
          const spots: [number, number][] = [[-0.6, 22], [-0.32, 30], [0, 26], [0.32, 30], [0.6, 22], [-0.75, 12], [0.75, 12], [-0.16, 15], [0.16, 15]];
          for (const [u, v] of spots) front += pen.fill([[cx + u * w0 - 1.2, nb + v], [cx + u * w0 + 1.2, nb + v], [cx + u * w0, nb + v + 5]], PIG.ink);
        }
      } else {
        for (const sd of [-1, 1]) {
          const lap: Pt[] = [];
          const inner: Pt[] = [[cx + sd * nw * 1.15, nb - 3], [cx + sd * nw * 0.6, nb + 10], [cx + sd * 2.5, nb + 26], [cx + sd * 5, 214]];
          const outer: Pt[] = [[cx + sd * 19, 214], [cx + sd * (nw * 0.9 + 12), nb + 30], [cx + sd * (nw * 1.4 + 11), nb + 12], [cx + sd * (nw * 1.9 + 5), nb - 1]];
          const bumpy: Pt[] = [];
          outer.forEach((p, i) => { bumpy.push(p); if (pen.mid && i < outer.length - 1) bumpy.push([lerp(p[0], outer[i + 1][0], 0.5) + sd * 2.6, lerp(p[1], outer[i + 1][1], 0.5)]); });
          lap.push(...inner, ...bumpy);
          front += pen.blob(lap, C2, { w: 1.4, shade: shadeOf(C2, 0.18), sx: 3, sy: 3 });
          if (pen.fine) for (let i = 0; i < 5; i++) { const y = nb + 6 + i * 9, x = cx + sd * (nw * 0.9 + 6 - i * 0.6); front += pen.line([[x, y], [x + sd * 2.6, y + 3.4]], 0.7, { c: shadeOf(C2, 0.5), tp: 'out' }); }
        }
      }
      break;
    }
    case 'apron': {
      front += wash(body(neckRound), C) + folds();
      front += trim([LN, ...neckRound, RN], mixc(C, PIG.ink, 0.25), 2.6);
      const bw = Math.min(nw * 1.7 + 6, sw * 0.5);
      for (const sd of [-1, 1]) front += pen.bar([cx + sd * (bw - 2), nb + 21], [cx + sd * nw * 1.5, nb + 2], 4.2, C2, { w: 1 });
      front += pen.blob([[cx - bw, nb + 19], [cx, nb + 21.5], [cx + bw, nb + 19], [cx + bw + 3, 220], [cx - bw - 3, 220]], C2, { w: 1.4, shade: true, sx: 4, sy: 3 });
      if (pen.fine) front += pen.line([[cx - bw + 3, nb + 24], [cx, nb + 26], [cx + bw - 3, nb + 24]], 0.7, { op: 0.5, tp: 'flat' });
      break;
    }
    case 'tabard':
    case 'livery': {
      // parted down the middle in two colours
      const neck = neckRound;
      const d = bodyD(neck);
      const under = G.kind === 'tabard' ? PIG.steel : C;
      front += wash(body(neck), G.kind === 'tabard' ? under : C);
      if (G.kind === 'tabard') {
        const pw = Math.min(sw * 0.66, nw * 1.6 + 24);
        const panel: Pt[] = [[cx - pw - 3, 220], [cx - pw, nb + 12], [cx - nw * 1.2, nb], ...neck, [cx + nw * 1.2, nb], [cx + pw, nb + 12], [cx + pw + 3, 220]];
        if (pen.mid) for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) front += pen.line(arc(cx + sd * (pw + 8 + i * 7), nb + 30 + i * 4, 4, 3, 180, 360, 3), 0.8, { c: PIG.steelDark, tp: 'flat', wob: 0 });
        front += pen.blob(panel, C, { w: 1.4 });
        front += pen.inside(curve(panel, true), `<rect x="${f(cx)}" y="0" width="120" height="${f(nb + 38)}" fill="${C2}"/><rect x="${f(cx - 120)}" y="${f(nb + 38)}" width="120" height="100" fill="${C2}"/>`
          + `<path d="M${f(cx)} ${f(nb)}V220M${f(cx - 80)} ${f(nb + 38)}H${f(cx + 80)}" stroke="${PIG.gold}" stroke-width="${f(1.6 * pen.k)}" fill="none"/>`);
        front += pen.line(panel, 1.4, { closed: true });
      } else {
        front += pen.inside(d, `<rect x="${f(cx)}" y="0" width="140" height="240" fill="${C2}"/>` + (pen.mid ? `<path d="M${f(cx)} ${f(nb)}V222" stroke="${pen.ink}" stroke-width="${f(0.9 * pen.k)}" opacity=".7"/>` : ''));
        front += pen.line(body(neck), 1.6, { closed: true }) + folds();
        // dagged collar in the two colours, swapped
        const n = 6;
        for (let i = 0; i < n; i++) {
          const a0 = Math.PI * (i / n), a1 = Math.PI * ((i + 1) / n), am = (a0 + a1) / 2;
          const R0 = nw * 1.28, R1 = nw * 1.28 + 11;
          front += pen.blob([[cx - Math.cos(a0) * R0, nb + 2 + Math.sin(a0) * 6.5], [cx - Math.cos(am) * R1, nb + 5 + Math.sin(am) * 15], [cx - Math.cos(a1) * R0, nb + 2 + Math.sin(a1) * 6.5]], i < n / 2 ? C2 : C, { w: 1.1 });
        }
      }
      break;
    }
    case 'mail': {
      front += wash(body(neckRound), C2);
      if (pen.mid) {
        // ring mail as rows of small arcs
        const rows = pen.fine ? 8 : 5;
        let rings = '';
        for (let j = 0; j < rows; j++) {
          const y = nb + 6 + j * (pen.fine ? 5.2 : 8);
          for (let x = cx - sw - 4 + (j % 2) * 3.5; x < cx + sw + 4; x += pen.fine ? 7 : 10) rings += `M${f(x)} ${f(y)}a3.2 3 0 0 0 6.4 0`;
        }
        front += pen.inside(bodyD(neckRound), `<path d="${rings}" fill="none" stroke="${PIG.steelDark}" stroke-width="${f(0.75 * pen.k)}" opacity=".75"/>`);
      }
      const pw = Math.min(sw * 0.7, nw * 1.6 + 26);
      const sur: Pt[] = [[cx - pw - 4, 220], [cx - pw, nb + 16], [cx - nw * 1.5, nb + 6], [cx - nw * 0.8, nb + 14], [cx, nb + 17], [cx + nw * 0.8, nb + 14], [cx + nw * 1.5, nb + 6], [cx + pw, nb + 16], [cx + pw + 4, 220]];
      front += wash(sur, C, 1.5);
      front += trim([sur[2], sur[3], sur[4], sur[5], sur[6]], mixc(C, PIG.gold, 0.6), 2.4);
      break;
    }
    case 'mantle': {
      // a cloak closed at the throat; the robe shows in the opening
      front += wash(body(neckRound), G.c2 === PIG.cream || G.c2 === PIG.linen ? mixc(C, PIG.cream, 0.5) : C2);
      for (const sd of [-1, 1]) {
        const half: Pt[] = [[cx + sd * (sw + 6), 220], [cx + sd * sw, nb + 20], [cx + sd * sw * 0.62, nb + 7], [cx + sd * nw * 1.3, nb - 2], [cx + sd * nw * 0.5, nb + 6], [cx + sd * 1.2, nb + 10], [cx + sd * 8, nb + 36], [cx + sd * 22, 220]];
        front += wash(half, C, 1.5);
        front += pen.line([half[4], half[5], half[6], half[7]].map(p => [p[0] + sd * 2.6, p[1]] as Pt), 3.2, { c: G.trim === PIG.cream ? mixc(C, PIG.gold, 0.55) : G.trim, tp: 'flat' });
      }
      front += folds();
      break;
    }
    case 'shawl': {
      front += wash(body(neckRound), C2) + folds();
      for (const sd of [1, -1]) {
        const half: Pt[] = [[cx + sd * (sw + 4), nb + 44], [cx + sd * sw, nb + 20], [cx + sd * sw * 0.62, nb + 6], [cx + sd * nw * 1.35, nb - 3], [cx + sd * nw * 0.4, nb + 9], [cx - sd * 5, nb + 25], [cx - sd * 2, nb + 34], [cx + sd * sw * 0.5, nb + 52]];
        front += wash(half, C, 1.5);
        if (pen.fine) for (let i = 0; i < 6; i++) { const t = i / 5, x = lerp(cx - sd * 2, cx + sd * (sw + 4), t), y = lerp(nb + 34, nb + 46, t) + Math.sin(t * Math.PI) * 9; front += pen.line([[x, y], [x + sd * 0.8, y + 4.6]], 0.8, { c: shadeOf(C, 0.4), tp: 'out' }); }
      }
      front += pen.blob(ellipse(cx, nb + 27, 4.2, 4.6, 7), shadeOf(C, 0.12), { w: 1.2 });
      break;
    }
    case 'scales':
      break; // the dragon draws its own
  }

  // ── trimmings
  const chest = (u: number, v: number): Pt => [cx + u * nw * 2, nb + v];
  if (has('patches') && pen.mid) {
    for (const [u, v, c] of [[-1.5, 30, mixc(C, PIG.cream, 0.4)], [1.2, 40, mixc(C, PIG.ink, 0.25)]] as [number, number, string][]) {
      const p = chest(u, v);
      front += pen.blobPoly([[p[0] - 5, p[1] - 4], [p[0] + 5.5, p[1] - 5], [p[0] + 6, p[1] + 5], [p[0] - 4.5, p[1] + 5.5]], c, { w: 0.9 });
      if (pen.fine) for (const [dx, dy] of [[-5, 0], [0, -5], [6, 0], [0, 6]]) front += pen.line([[p[0] + dx - 1, p[1] + dy - 1], [p[0] + dx + 1, p[1] + dy + 1]], 0.6, { tp: 'flat', wob: 0 });
    }
  }
  if (has('stars') && pen.mid) {
    const n = pen.fine ? 7 : 4;
    for (let i = 0; i < n; i++) {
      const sd = i % 2 ? 1 : -1, x = cx + sd * r.range(nw + 6, Math.min(sw * 0.8, 62)), y = nb + r.range(16, 52);
      front += pen.star(x, y, r.range(2.2, 3.6), PIG.gold2, i % 3 ? 5 : 4);
    }
  }
  if (has('dust')) for (let i = 0; i < (pen.mid ? 12 : 5); i++) front += pen.dot(cx + r.jit(Math.min(sw * 0.8, 66)), nb + r.range(10, 34), r.range(0.8, 1.9) * (pen.mid ? 1 : 1.8), PIG.flour, 0.85);
  if (has('wax') && pen.mid) for (let i = 0; i < 5; i++) { const x = cx + r.jit(Math.min(sw * 0.7, 55)), y = nb + r.range(12, 30); front += pen.fill([[x - 1.5, y], [x + 1.5, y], [x + 1, y + 5], [x, y + 6.5], [x - 1, y + 5]], PIG.wax, 0.95); }
  if (has('soot') && pen.mid) for (let i = 0; i < 3; i++) { const x = cx + r.jit(Math.min(sw * 0.7, 55)), y = nb + r.range(16, 40); front += pen.fill(ellipse(x, y, r.range(4, 7), r.range(2, 3.5), 7), PIG.soot, 0.3); }
  if (has('sash')) {
    front += pen.inside(bodyD(neckRound), pen.bar([cx - sw * 0.7, nb + 6], [cx + sw * 0.55, 214], 11, C2, { w: 1.1 }));
    if (pen.mid) { const p: Pt = [cx - nw * 0.9, nb + 24]; front += pen.bead(p[0], p[1], 5, PIG.gold2, 1) + pen.bead(p[0], p[1], 2.2, PIG.madder, 0.7); }
  }
  if (has('baldric')) front += pen.inside(bodyD(neckRound), pen.bar([cx + g.toolSide * sw * 0.7, nb + 6], [cx - g.toolSide * sw * 0.5, 214], 6.5, PIG.leatherDark, { w: 1 }) + (pen.mid ? pen.bead(cx + g.toolSide * nw * 0.5, nb + 30, 2.4, PIG.gold, 0.8) : ''));
  if (has('scarf')) {
    front += pen.blob([[cx - nw * 1.5, nb - 3], [cx, nb + 3], [cx + nw * 1.5, nb - 3], [cx + nw * 1.5, nb + 5], [cx, nb + 12], [cx - nw * 1.5, nb + 5]], C2, { w: 1.3 });
    front += pen.blob([[cx - g.dir * 4, nb + 8], [cx - g.dir * 10, nb + 12], [cx - g.dir * 13, nb + 32], [cx - g.dir * 6, nb + 34], [cx - g.dir * 3, nb + 14]], C2, { w: 1.2 });
  }
  if (has('towel') && pen.mid) {
    const sd = -g.toolSide, x = cx + sd * Math.min(sw * 0.62, 50);
    front += pen.blob([[x - 9, nb + 6], [x + 8, nb + 4], [x + 10, nb + 44], [x + 2, nb + 46], [x - 8, nb + 43]], PIG.linen, { w: 1.3, shade: '#d5cbb0', sx: 3, sy: 2 });
    if (pen.fine) front += pen.line([[x - 7, nb + 37], [x + 9, nb + 38]], 1.4, { c: PIG.madder, tp: 'flat', op: 0.8 });
  }
  if (has('lacing') && pen.mid && (G.kind === 'tunic' || G.kind === 'kirtle' || G.kind === 'livery')) {
    const y0 = nb + (G.kind === 'kirtle' ? 17 : 10);
    for (let i = 0; i < 3; i++) front += pen.line([[cx - 2.6, y0 + i * 4.4], [cx + 2.6, y0 + 2.4 + i * 4.4]], 0.9, { c: PIG.linen, tp: 'flat', wob: 0 }) + pen.line([[cx + 2.6, y0 + i * 4.4], [cx - 2.6, y0 + 2.4 + i * 4.4]], 0.9, { c: PIG.linen, tp: 'flat', wob: 0 });
  }
  if (has('chain') || has('seals')) {
    const w0 = Math.min(nw * 1.6 + 16, sw * 0.6), dip = 30;
    const pts: Pt[] = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([cx + lerp(-w0, w0, t), nb + 5 + Math.sin(Math.PI * t) * dip]); }
    if (has('seals')) {
      // the goblin chief's chain of office is made of wax seals and rubber-stamp handles
      front += pen.line(pts, 1.2, { c: PIG.leatherDark, tp: 'flat' });
      pts.forEach((p, i) => { if (i > 0 && i < 8) front += pen.bead(p[0], p[1] + 1, i === 4 ? 5 : 3.3, i % 2 ? PIG.rubric : PIG.gold, 0.9) + (pen.fine ? pen.dot(p[0], p[1] + 1, i === 4 ? 2 : 1.2, i % 2 ? PIG.redDeep : PIG.goldInk) : ''); });
    } else {
      front += pen.line(pts, 3.4, { c: PIG.goldInk, tp: 'flat', wob: 0.1 }) + pen.line(pts, 2.2, { c: PIG.gold2, tp: 'flat', wob: 0.1 });
      if (pen.fine) pts.forEach(p => { front += pen.dot(p[0], p[1], 0.7, PIG.goldInk); });
      if (has('pendant') || has('keys')) {
        const p = pts[4];
        if (has('keys')) {
          front += pen.line([[p[0], p[1] + 2], [p[0] + 1, p[1] + 16]], 1.8, { c: PIG.goldInk, tp: 'flat', wob: 0 }) + `<circle cx="${f(p[0])}" cy="${f(p[1] + 4)}" r="3.3" fill="none" stroke="${PIG.goldInk}" stroke-width="${f(1.7 * pen.k)}"/>`;
          front += pen.line([[p[0] + 1, p[1] + 12], [p[0] + 4.5, p[1] + 12]], 1.5, { c: PIG.goldInk, tp: 'flat', wob: 0 }) + pen.line([[p[0] + 1, p[1] + 15.5], [p[0] + 4, p[1] + 15.5]], 1.5, { c: PIG.goldInk, tp: 'flat', wob: 0 });
        } else front += pen.bead(p[0], p[1] + 5, 5, PIG.gold2, 1.1) + pen.bead(p[0], p[1] + 5, 2.2, G.kind === 'highcollar' ? PIG.lapis : PIG.madder, 0.8);
      }
    }
  } else if (has('pendant') && pen.mid) {
    front += pen.line([[cx - nw * 1.1, nb + 1], [cx, nb + 22], [cx + nw * 1.1, nb + 1]], 0.9, { c: PIG.leatherDark, tp: 'flat' }) + pen.bead(cx, nb + 23, 3.6, PIG.silver, 1);
  }
  if (has('brooch')) {
    const y = G.kind === 'mantle' ? nb + 9 : G.kind === 'shawl' ? nb + 27 : nb + 12;
    front += pen.bead(cx, y, 4.6, PIG.gold2, 1.1) + (pen.mid ? pen.bead(cx, y, 2, G.kind === 'mantle' ? PIG.madder : PIG.lapis, 0.7) : '');
  }
  if (has('badge') && pen.mid) {
    const p: Pt = G.kind === 'tabard' ? [cx - nw * 0.95 - 6, nb + 24] : [cx - g.toolSide * (nw + 12), nb + 28];
    if (G.kind === 'tabard' || G.kind === 'mail') {
      // a small crown: the Crown's badge
      front += pen.blobPoly([[p[0] - 6, p[1] + 4], [p[0] - 6.5, p[1] - 4], [p[0] - 3, p[1] - 0.5], [p[0], p[1] - 5.5], [p[0] + 3, p[1] - 0.5], [p[0] + 6.5, p[1] - 4], [p[0] + 6, p[1] + 4]], PIG.gold2, { w: 0.9 });
    } else front += pen.blob([[p[0] - 4.5, p[1] - 5], [p[0] + 4.5, p[1] - 5], [p[0] + 4.5, p[1] + 1], [p[0], p[1] + 6], [p[0] - 4.5, p[1] + 1]], PIG.gold2, { w: 1 });
  }
  if (has('bowtie')) {
    const y = nb + 9, z = pen.mid ? 1 : 1.3;
    front += pen.blob([[cx, y], [cx - 8 * z, y - 4.5 * z], [cx - 8.5 * z, y + 4.5 * z]], C2 === PIG.linen ? PIG.madder : C2, { w: 1.1 }) + pen.blob([[cx, y], [cx + 8 * z, y - 4.5 * z], [cx + 8.5 * z, y + 4.5 * z]], C2 === PIG.linen ? PIG.madder : C2, { w: 1.1 }) + pen.bead(cx, y, 1.9 * z, PIG.gold, 0.8);
  }
  return { back, front };
}
