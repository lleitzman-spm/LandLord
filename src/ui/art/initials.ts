/**
 * OWNER: ui-art agent. Illuminated initials: a blackletter capital (the
 * UnifrakturMaguntia face) on a square of gold leaf, with lapis and rubric
 * vine-scrolls in the corners and white penwork. Lapis letters get rubric
 * vines and the other way about. A few letters have a tenant.
 */
import { Pen, type PenStyle, type P, rng, mix, DEG } from './ink';
import { C, ivy, leaf } from './paint';

const CAP_PEN: PenStyle = { w: 1.7, nibA: -0.7, nibMin: 0.5, jit: 0.14, wob: 0.12, step: 1.2, t0: 0.5, t1: 0.35, noise: 0.08, shift: [0.35, 0.3], eps: 0.12, chord: 5, hair: 0.95 };

const GOLD = '#cfa52c', GOLD_HI = '#f3d777', GOLD_LO = '#8a6a14', HALO = '#f7eed6';

/** A vine-scroll: a stem winding inward from radius `rad`, leaves on its outer turn. */
function scroll(p: Pen, r: () => number, cx: number, cy: number, rad: number, a0: number, dir: 1 | -1, stem: string, leaves: string[]): void {
  const pts: P[] = [], N = 44, turns = 1.15;
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = (a0 + dir * turns * 360 * t) * DEG, rr = rad * (1 - 0.74 * Math.pow(t, 0.9));
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  p.ink(stem, () => p.line(pts, 1.25, 0.55, 0.35));
  for (const t of [0.1, 0.34, 0.58]) {
    const i = Math.round(t * N), q = pts[i]!, q2 = pts[Math.min(N, i + 1)]!;
    const ta = Math.atan2(q2[1] - q[1], q2[0] - q[0]) / DEG;
    const out = ta - dir * 90 + (r() - 0.5) * 30;
    const col = leaves[Math.floor(r() * leaves.length) % leaves.length]!;
    if (r() < 0.6) ivy(p, q[0], q[1], out, rad * (0.62 - t * 0.3), col, 0.92, 0.5);
    else leaf(p, q[0], q[1], out, rad * (0.66 - t * 0.3), col, 0.92, 0.5);
  }
  const e = pts[N]!;
  p.dot(e[0], e[1], rad * 0.13, C.white);
}

type Tenant = (p: Pen) => void;
/** Small residents, each drawn in a corner of its letter. */
const TENANTS: Record<string, Tenant> = {
  // A: a snail making its way along the bottom edge
  A: p => {
    p.shape('M62 92C68 90.4 80 90.2 88 90.4L90.4 86.6C91.4 84.4 93.8 84 94.6 85.6C95.2 87.6 94 89.6 93 92Z', '#e6d3b0', 0.7);
    p.shapeE(76, 84, 7.4, 7, 0, '#d98a4e', 0.75);
    p.spiral(76.6, 84.6, 0.8, 5.8, 1.7, 200, 0.5, 1);
    p.s('M92 85.8L90.6 81', 0.5); p.dot(90.4, 80.6, 0.9);
    p.s('M93.6 85.6L94.6 81.2', 0.5); p.dot(94.8, 80.8, 0.9);
  },
  // C: a cat asleep in the corner, as cats are
  C: p => {
    p.shape('M70 92C68 86 72 80.6 79 80.4C85.6 80.2 91 84 92 92Z', '#b8b2a6', 0.7);
    p.shape('M70.6 91.6C69 88 70 85 73 84C76 83.4 78 85 78 87.6C78 90 76 91.6 73.6 91.8Z', '#c9c3b6', 0.6);
    p.s('M70.6 84.6L70.2 81.4L72.6 83.4', 0.5); p.s('M74.6 83.4L76.4 81.2L76.8 84.4', 0.5);
    p.s('M71.6 87.4C72.2 88 73 88 73.6 87.4', 0.35); p.s('M75 87.4C75.6 88 76.4 88 77 87.4', 0.35);
    p.s('M92 91.6C94.6 90 95 86.4 92.6 85.4', 0.6);
  },
  // G: a goose who has come to see what the letter is about
  G: p => {
    p.shape('M74 93C73 88 76 85 80 84.6C84 84.2 90 85.6 94 82.6C94.4 87.4 92.4 92 88 93Z', '#f1ead8', 0.7);
    p.shape('M80 85C79.4 80 77.6 76.4 78.4 72C79 69 82.4 68 84.2 70.4C85.4 72.2 84 74.4 83 77C82.4 79.4 83 82 84 84.8Z', '#f1ead8', 0.7);
    p.shape('M78.6 70.8L73.6 72.2L78.4 73.6Z', C.ochre, 0.45);
    p.dot(81.6, 70.8, 0.6);
  },
  // M: a mouse with a coin it has no intention of returning
  M: p => {
    p.shape('M8 92C8.6 87 12 84 16.6 84C20.6 84 23 86.6 23.4 92Z', '#a9a29a', 0.7);
    p.shape('M18.6 85.6C19.6 82.8 22.4 81.6 25 82.6L28.4 84.2C29 84.6 28.6 85.6 27.8 85.6C26 86.4 23 87 20.6 87Z', '#a9a29a', 0.6);
    p.shapeE(20.6, 81.6, 2.2, 2.4, 0, C.rose, 0.5);
    p.dot(24.4, 83.6, 0.5);
    p.s('M8.4 91C5.6 90.4 4.4 87.4 6 85.6', 0.45);
    p.shapeE(13, 84.4, 4, 4, 0, GOLD_HI, 0.6);
  },
  // O: an owl keeping an eye on the counter
  O: p => {
    p.shape('M77 25C73 25 70.6 21 70.6 16C70.6 11 73.4 7.4 77.6 7.4C81.8 7.4 84.6 11 84.6 16C84.6 21 82 25 77 25Z', '#b9925f', 0.7);
    p.s('M71.6 9.4L71 6L73.6 8', 0.5); p.s('M83.6 9.4L84.2 6L81.6 8', 0.5);
    p.shapeE(74.8, 13.6, 2.2, 2.2, 0, GOLD_HI, 0.45); p.shapeE(80.4, 13.6, 2.2, 2.2, 0, GOLD_HI, 0.45);
    p.dot(74.8, 13.8, 0.9); p.dot(80.4, 13.8, 0.9);
    p.solid('M77.6 15.6L78.6 17L77.6 18.4L76.6 17Z', C.ochre);
    p.s('M72 26L84 26', 0.6);
  },
  // R: a rabbit, ears first
  R: p => {
    p.shape('M74 92C73 86.6 76 83 80.6 83C85.4 83 88 86.6 87.6 92Z', '#cdb79a', 0.7);
    p.shape('M77 84C75.6 79 75.6 74 77 71C78.6 73.6 79.4 78.6 79.4 83.6Z', '#cdb79a', 0.6);
    p.shape('M81.6 83.4C82 78.4 83.6 74 85.6 72C86.4 75.4 85 80 83.6 84Z', '#cdb79a', 0.6);
    p.dot(78.6, 86.6, 0.55); p.dot(83, 86.6, 0.55); p.dot(80.8, 88.4, 0.5, C.rose);
  },
};
/** Which corner each tenant occupies (it displaces that corner's scroll). */
const TENANT_CORNER: Record<string, number> = { A: 3, C: 3, G: 3, M: 2, O: 1, R: 3 };

const cache = new Map<string, string>();

/** An illuminated initial, `size` pixels square. */
export function initialSvg(letter: string, size = 56): string {
  const ch = (letter || 'A').trim().charAt(0).toUpperCase() || 'A';
  let body = cache.get(ch);
  if (!body) {
    const code = ch.charCodeAt(0);
    const lapisLetter = code % 2 === 1;
    const ink = lapisLetter ? C.lapis : C.rubric, vine = lapisLetter ? C.rubric : C.lapis;
    const r = rng(mix(code, 'initial'));
    const p = new Pen(rng(mix(code, 'initial-pen')), CAP_PEN);
    p.color = C.ink;
    // corner scrolls (0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right)
    const corners: [number, number, number, 1 | -1][] = [[19, 19, 200, 1], [81, 19, 290, 1], [19, 81, 110, 1], [81, 81, 20, 1]];
    const tenantCorner = TENANT_CORNER[ch] ?? -1;
    corners.forEach(([x, y, a0, dir], i) => {
      if (i === tenantCorner) return;
      scroll(p, r, x, y, 12.5, a0 + (r() - 0.5) * 30, dir, vine, [ink, vine, C.verd]);
    });
    // penwork: white dots in threes along the edges
    for (const [x, y] of [[50, 8.6], [50, 91.4], [8.6, 50], [91.4, 50]] as const) {
      p.dot(x, y, 1.1, C.white);
      const hor = y < 12 || y > 88;
      p.dot(x + (hor ? 3.4 : 0), y + (hor ? 0 : 3.4), 0.75, C.white); p.dot(x - (hor ? 3.4 : 0), y - (hor ? 0 : 3.4), 0.75, C.white);
    }
    const tenant = TENANTS[ch];
    p.layer();
    if (tenant) tenant(p);
    // the frame: an inked edge, a rubric hairline inside it
    p.layer();
    p.s('M3.4 3.4L96.6 3.4L96.6 96.6L3.4 96.6Z', 1.05);
    p.ink(C.rubric, () => p.s('M6.2 6.2L93.8 6.2L93.8 93.8L6.2 93.8Z', 0.4));
    const wide = 'MWQ'.includes(ch), narrow = 'IJ'.includes(ch);
    const fs = wide ? 70 : narrow ? 84 : 78;
    const glyph = ch.replace(/[&<>"']/g, '');
    const text = (extra: string) => `<text x="50" y="${wide ? 74 : 77}" text-anchor="middle" font-size="${fs}" style="font-family:'UnifrakturMaguntia','UnifrakturCook','Old English Text MT',serif" ${extra}>${glyph}</text>`;
    body = `<rect x="3.4" y="3.4" width="93.2" height="93.2" fill="${GOLD}"/>`
      + `<path d="M3.4 3.4H96.6L3.4 96.6Z" fill="${GOLD_HI}" fill-opacity=".22"/>`
      + `<rect x="5" y="5" width="90" height="90" fill="none" stroke="${GOLD_LO}" stroke-opacity=".35" stroke-width="2.4"/>`
      + p.out()
      + text(`fill="none" stroke="${HALO}" stroke-width="7" stroke-linejoin="round"`)
      + text(`fill="${ink}" stroke="${C.ink}" stroke-width="1.1" stroke-linejoin="round"`)
      + text(`fill="#ffffff" fill-opacity=".16" transform="translate(-.8 -.9)"`);
    cache.set(ch, body);
  }
  const s = Math.max(16, size);
  return `<svg class="ll-initial" viewBox="0 0 100 100" width="${s}" height="${s}" role="img" aria-label="${ch.replace(/[&<>"']/g, '')}" focusable="false">${body}</svg>`;
}
