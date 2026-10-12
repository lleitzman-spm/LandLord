/**
 * OWNER: ui-art agent. Panel dressing as CSS: `ll-illum` paints corner
 * ornaments and a thin double rule round a panel; `ll-vine-l` / `ll-vine-r`
 * run a vine down a margin. Both are drawn here by the pen and shipped as
 * data-URI SVG, so they cost no requests.
 *
 * `ll-illum` uses border-image, which leaves the panel's own background,
 * padding and positioning alone; the ornament keeps to the outer 14px
 * along the edges (36px at the corners), clear of padded content.
 */
import { Pen, type PenStyle, rng, n1 } from './ink';
import { C, ivy, leaf, tendril, bezant } from './paint';

const FRAME_PEN: PenStyle = { w: 1.05, nibA: -0.72, nibMin: 0.45, jit: 0.08, wob: 0.06, step: 0.8, t0: 0.4, t1: 0.25, noise: 0.06, shift: [0.3, 0.25], eps: 0.06, chord: 4, hair: 0.62 };
const STIFF: PenStyle = { ...FRAME_PEN, jit: 0, wob: 0, noise: 0, hair: undefined };

/** SVG as a CSS url(): single quotes inside, and only the characters that must be escaped. */
const enc = (svg: string) => `url("data:image/svg+xml,${svg.replace(/"/g, "'").replace(/[%#<>{}\n]/g, c => encodeURIComponent(c))}")`;

/** One corner ornament for the top-left, in a 36px square: a gilded boss with a vine running off along each rule. */
function corner(seed: number): string {
  const edge = (salt: number, cols: [string, string]) => {
    const p = new Pen(rng(seed + salt), FRAME_PEN);
    p.color = C.ink2;
    p.s('M10.6 11C15 12.4 19 10.2 23 11.2C26.6 12 29.6 10.8 33.6 10.4', 0.7);
    ivy(p, 15.8, 11.4, 38, 6.6, cols[0], 0.82, 0.48);
    leaf(p, 22.6, 11.2, 118, 5.8, cols[1], 0.78, 0.45);
    ivy(p, 28.6, 11.2, 64, 5.4, C.verd, 0.8, 0.45);
    tendril(p, 19, 10.8, -70, 5.4, 1.6, 0.36);
    tendril(p, 33.4, 10.4, 10, 6, 1.6, 0.36);
    bezant(p, 25.6, 15.6, 1.35, 0.32);
    return p.out();
  };
  const top = edge(1, [C.lapis, C.rubric]), side = edge(2, [C.rubric, C.lapis]);
  const b = new Pen(rng(seed + 3), FRAME_PEN);
  b.color = C.ink2;
  b.shape('M2 2.2L10.6 2L10.8 10.6L2.2 10.8Z', C.gold, 0.6);
  for (const [x, y] of [[6.4, 4.4], [8.4, 6.4], [6.4, 8.4], [4.4, 6.4]] as const) b.dot(x, y, 1.15, C.rubric);
  b.dot(6.4, 6.4, 0.9, C.lapis);
  b.dot(12.6, 12.6, 1.1, C.rubric); b.dot(15.2, 13.4, 0.75, C.lapis); b.dot(13.4, 15.2, 0.75, C.lapis);
  return `${top}<g transform="matrix(0 1 1 0 0 0)">${side}</g>${b.out()}`;
}

function illumSvg(): string {
  const S = 96;
  const rules = `<rect x=".5" y=".5" width="${S - 1}" height="${S - 1}" fill="none" stroke="#b89f6c" stroke-width="1"/>`
    + `<rect x="4.5" y="4.5" width="${S - 9}" height="${S - 9}" fill="none" stroke="${C.ink2}" stroke-opacity=".8" stroke-width="1"/>`
    + `<rect x="7.25" y="7.25" width="${S - 14.5}" height="${S - 14.5}" fill="none" stroke="${C.rubric}" stroke-opacity=".85" stroke-width=".7"/>`;
  const at = (t: string) => `<use href="#k" xlink:href="#k" transform="${t}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><defs><g id="k">${corner(4242)}</g></defs>${rules}${at('translate(0 0)')}${at(`translate(${S} 0) scale(-1 1)`)}${at(`translate(0 ${S}) scale(1 -1)`)}${at(`translate(${S} ${S}) scale(-1 -1)`)}</svg>`;
}

/** A vine tile 30 wide that repeats every 120 down the page. */
function vineTile(mirror: boolean): string {
  const W = 30, Hh = 120;
  const stem = new Pen(rng(7), STIFF);
  stem.color = C.ink2;
  const pts: [number, number][] = [];
  for (let y = -16; y <= Hh + 16; y += 2) pts.push([15 + Math.sin(y / Hh * Math.PI * 2) * 5, y]);
  stem.line(pts, 0.95, 1, 1);
  const p = new Pen(rng(11), FRAME_PEN);
  p.color = C.ink2;
  const xAt = (y: number) => 15 + Math.sin(y / Hh * Math.PI * 2) * 5;
  ivy(p, xAt(16), 16, -150, 9.4, C.verd, 0.75, 0.5);
  leaf(p, xAt(36), 36, 30, 8.4, C.green, 0.7, 0.5);
  tendril(p, xAt(48), 48, 200, 8, 1.5, 0.38);
  ivy(p, xAt(64), 64, 25, 9.4, C.verd, 0.75, 0.5);
  leaf(p, xAt(84), 84, -155, 8.4, C.green, 0.7, 0.5);
  ivy(p, xAt(100), 100, -160, 8.6, C.rubric, 0.7, 0.5);
  tendril(p, xAt(108), 108, -20, 8, -1.5, 0.38);
  p.s(`M${n1(xAt(28))} 28L${n1(xAt(28) - 6)} 25`, 0.4); bezant(p, xAt(28) - 7.4, 24.4, 1.7, 0.35);
  p.s(`M${n1(xAt(76))} 76L${n1(xAt(76) + 6)} 73`, 0.4); bezant(p, xAt(76) + 7.4, 72.4, 1.7, 0.35);
  const body = stem.out() + p.out();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}">${mirror ? `<g transform="translate(${W} 0) scale(-1 1)">${body}</g>` : body}</svg>`;
}

const PARCH_LAYERS = 'radial-gradient(120% 90% at 20% 0%,rgba(255,250,230,.55),transparent 60%),radial-gradient(90% 80% at 100% 100%,rgba(150,110,60,.22),transparent 65%),linear-gradient(180deg,var(--parch),var(--parch-2))';

let css = '';
/** Built on first use (it draws). */
export function illumCss(): string {
  if (css) return css;
  const illum = enc(illumSvg());
  const vl = enc(vineTile(false)), vr = enc(vineTile(true));
  css = `
.ll-illum{border-style:solid;border-image-source:${illum};border-image-slice:36;border-image-width:36px;border-image-repeat:stretch;border-image-outset:0}
.ll-vine-l{background-image:${vl};background-repeat:repeat-y;background-position:3px 0;padding-left:36px}
.ll-vine-r{background-image:${vr};background-repeat:repeat-y;background-position:right 3px top 0;padding-right:36px}
.ll-parch.ll-vine-l,.ll-panel.ll-vine-l{background:${vl} 3px 0/30px 120px repeat-y,${PARCH_LAYERS}}
.ll-parch.ll-vine-r,.ll-panel.ll-vine-r{background:${vr} right 3px top 0/30px 120px repeat-y,${PARCH_LAYERS}}
.ll-doodle,.ll-initial,.ll-crest,.ll-flourish{display:inline-block;vertical-align:middle;max-width:100%;height:auto;overflow:visible}
`;
  return css;
}

export const ILLUM_CSS: string = illumCss();
