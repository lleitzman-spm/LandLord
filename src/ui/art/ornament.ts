/**
 * OWNER: ui-art agent. Ornamental dividers: a rule with a lozenge, a running
 * vine, an interlace knot, a manuscript line-filler and a hedera leaf. Lines
 * are drawn in currentColor so they take the panel's ink; accents are painted.
 */
import { Pen, type PenStyle, type P, rng, mix } from './ink';
import { C, ivy, leaf, tendril, bezant, flower } from './paint';

const ORN_PEN: PenStyle = { w: 1.5, nibA: -0.72, nibMin: 0.42, jit: 0.12, wob: 0.14, step: 1.2, t0: 0.15, t1: 0.15, noise: 0.08, shift: [0.4, 0.35], eps: 0.12, chord: 6, hair: 0.85 };
const HGT = 24, CY = 12;

type Style = (p: Pen, r: () => number, W: number) => void;

/** A rule from x0 to x1 that thins to nothing at its far end. */
const rule = (p: Pen, x0: number, x1: number, wm = 0.9) => p.s(`M${x0} ${CY}L${x1} ${CY}`, wm, { t0: x0 < x1 ? 0.9 : 0.12, t1: x0 < x1 ? 0.12 : 0.9 });

const STYLES: Style[] = [
  // 0: a rule with a lozenge
  (p, r, W) => {
    const c = W / 2, acc = r() < 0.5 ? C.rubric : C.lapis;
    rule(p, c - 16, 6, 0.85); rule(p, c + 16, W - 6, 0.85);
    p.shape(`M${c} ${CY - 9}L${c + 9.4} ${CY}L${c} ${CY + 9}L${c - 9.4} ${CY}Z`, acc, 0.85);
    p.shape(`M${c} ${CY - 4.2}L${c + 4.4} ${CY}L${c} ${CY + 4.2}L${c - 4.4} ${CY}Z`, C.gold, 0.45);
    p.dot(c, CY, 0.9, C.white);
    for (const s of [-1, 1]) { bezant(p, c + s * 14, CY, 2.1, 0.4); p.dot(c + s * 19.2, CY, 1.05); p.dot(c + s * 23, CY, 0.7); }
    if (W > 140) for (const s of [-1, 1]) tendril(p, c + s * (W / 2 - 10), CY, s < 0 ? 160 : 20, 9, s < 0 ? 1.4 : -1.4, 0.45);
  },
  // 1: a running vine with a rose at its heart
  (p, r, W) => {
    const c = W / 2, amp = 3.2, waves = Math.max(2, Math.round(W / 70));
    const at = (t: number): P => [8 + t * (W - 16), CY + Math.sin(t * Math.PI * 2 * waves) * amp];
    const L: P[] = [], R: P[] = [];
    for (let i = 0; i <= 80; i++) { const q = at(i / 80); if (q[0] < c - 7) L.push(q); else if (q[0] > c + 7) R.push(q); }
    p.line(L, 0.85, 0.2, 0.7); p.line(R, 0.85, 0.7, 0.2);
    const n = Math.min(18, Math.max(4, Math.floor(W / 30)));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n; const q = at(t);
      if (Math.abs(q[0] - c) < 14) continue;
      const up = k % 2 === 0, a = up ? -60 - r() * 30 : 60 + r() * 30;
      const col = r() < 0.75 ? C.verd : (r() < 0.5 ? C.rubric : C.lapis);
      if (r() < 0.55) ivy(p, q[0], q[1], (q[0] < c ? 180 : 0) + (q[0] < c ? -a : a), 9, col, 0.78, 0.55);
      else leaf(p, q[0], q[1], (q[0] < c ? 180 : 0) + (q[0] < c ? -a : a), 9.4, col, 0.72, 0.55);
      if (r() < 0.4) tendril(p, q[0], q[1], up ? 90 : -90, 6, up ? 1.3 : -1.3, 0.35);
    }
    flower(p, c, CY, 0, 17, r() < 0.5 ? C.rubric : C.lapis);
  },
  // 2: an interlace knot between two ruled lines
  (p, r, W) => {
    const c = W / 2, band = r() < 0.5 ? C.rubric : C.lapis;
    rule(p, c - 19, 6, 0.75); rule(p, c + 19, W - 6, 0.75);
    p.s(`M${c - 19} ${CY - 3.4}L${c - 19} ${CY + 3.4}`, 0.65); p.s(`M${c + 19} ${CY - 3.4}L${c + 19} ${CY + 3.4}`, 0.65);
    for (const [dx, dy] of [[-5.6, 0], [5.6, 0], [0, -5.6], [0, 5.6]] as const) {
      const cx = c + dx, cy = CY + dy;
      p.dual(`M${cx - 5.2} ${cy}C${cx - 5.2} ${cy - 7} ${cx + 5.2} ${cy - 7} ${cx + 5.2} ${cy}C${cx + 5.2} ${cy + 7} ${cx - 5.2} ${cy + 7} ${cx - 5.2} ${cy}Z`, 3, C.goldL, 0.46, band);
    }
    p.dot(c, CY, 1.1, C.gold);
    if (W > 120) for (const s of [-1, 1]) { p.dot(c + s * (W / 2 - 14), CY, 1.2); bezant(p, c + s * (W / 2 - 8), CY, 1.9, 0.4); }
  },
  // 3: a line-filler, rubric and lapis turns about, picked out in white
  (p, r, W) => {
    const x0 = 10, x1 = W - 10, seg = Math.max(18, (x1 - x0) / Math.max(3, Math.round((x1 - x0) / 34)));
    let i = r() < 0.5 ? 0 : 1;
    for (let x = x0; x < x1 - 2; x += seg, i++) {
      const xe = Math.min(x1, x + seg - 1.2), col = i % 2 ? C.lapis : C.rubric;
      p.dual(`M${x} ${CY}L${xe} ${CY}`, 3.6, col, 0.62);
      for (let d = x + 4; d < xe - 2; d += 5) p.dot(d, CY, 0.42, C.white);
      p.ink(i % 2 ? C.rubric : C.lapis, () => {
        const m = (x + xe) / 2;
        p.s(`M${m - 6} ${CY - 3}C${m - 3} ${CY - 7} ${m + 3} ${CY - 7} ${m + 6} ${CY - 3}`, 0.4);
        p.s(`M${m - 6} ${CY + 3}C${m - 3} ${CY + 7} ${m + 3} ${CY + 7} ${m + 6} ${CY + 3}`, 0.4);
      });
    }
    for (const x of [x0 - 4.4, x1 + 4.4]) p.shape(`M${x} ${CY - 3}L${x + 2.8} ${CY}L${x} ${CY + 3}L${x - 2.8} ${CY}Z`, C.gold, 0.45);
  },
  // 4: a hedera, the printer's ivy leaf, with dotted rules
  (p, r, W) => {
    const c = W / 2, col = r() < 0.6 ? C.rubric : C.verd;
    p.at({ x: c, y: CY, s: 1.35 }, () => {
      p.shape('M7 0C4 -6 -3 -6.6 -4.6 -2.4C-6 1 -3 4.6 -6.4 7C-1 6.4 4 5 7 0Z', col, 0.75, 0.88);
      p.s('M-4.6 -2.4C-9 -6 -13 -2 -11 1', 0.6);
      p.s('M1.4 -0.4L5.6 0', 0.4);
    });
    rule(p, c - 20, 8, 0.7); rule(p, c + 15, W - 8, 0.7);
    for (const s of [-1, 1]) for (let k = 1; k <= 3; k++) p.dot(c + s * (16 + k * 5) + (s < 0 ? -4 : 0), CY - 4.2, 0.62);
  },
];

const cache = new Map<string, string>();

/** An ornamental divider `width` pixels wide (height 24). */
export function flourishSvg(width = 240, seed = 0): string {
  const W = Math.max(48, Math.round(width));
  const st = (((seed | 0) % STYLES.length) + STYLES.length) % STYLES.length;
  const key = W + ':' + (seed | 0);
  let body = cache.get(key);
  if (!body) {
    const p = new Pen(rng(mix(seed, 'flourish-pen')), ORN_PEN);
    STYLES[st]!(p, rng(mix(seed, 'flourish')), W);
    body = p.out();
    if (cache.size > 80) cache.delete(cache.keys().next().value as string);
    cache.set(key, body);
  }
  return `<svg class="ll-flourish" viewBox="0 0 ${W} ${HGT}" width="${W}" height="${HGT}" aria-hidden="true" focusable="false">${body}</svg>`;
}
