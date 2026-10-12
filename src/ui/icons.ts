/**
 * OWNER: ui-art agent. Manuscript-style SVG icons, drawn by the pen in
 * src/ui/art (one hand, slightly uneven, currentColor, 24-unit viewBox), and
 * the same icons pressed into irregular wax seals.
 */
import type { IconId } from '../data/ids';
import { Pen, type PenStyle, rng, hash, escXml, n1, TAU } from './art/ink';
import { GLYPHS } from './art/glyphs';

const ICON_STYLE: PenStyle = { w: 1.9, nibA: -0.62, nibMin: 0.66, jit: 0.12, wob: 0.09, step: 0.55, t0: 0.45, t1: 0.38, noise: 0.08, shift: [0.22, 0.18], eps: 0.03 };

const partsCache = new Map<string, { wash: string; ink: string }>();
/** The icon as bare path data (wash and ink). `heavy` thickens the nib for small sizes. */
export function iconParts(id: IconId, heavy = false): { wash: string; ink: string } {
  const key = id + (heavy ? '!' : '');
  let v = partsCache.get(key);
  if (!v) {
    const g = GLYPHS[id];
    const p = new Pen(rng(hash('icon:' + id)), heavy ? { ...ICON_STYLE, w: ICON_STYLE.w * 1.13, nibMin: 0.72 } : ICON_STYLE);
    if (g) g(p); else p.dot(12, 12, 5);
    v = p.parts();
    partsCache.set(key, v);
  }
  return v;
}

const svgCache = new Map<string, string>();
/** Inline SVG markup for an icon, sized by font-size (class ll-icon), drawn in currentColor. */
export function iconSvg(id: IconId, opts: { size?: number; title?: string } = {}): string {
  const key = `${id}|${opts.size ?? ''}|${opts.title ?? ''}`;
  const hit = svgCache.get(key);
  if (hit) return hit;
  const { wash, ink } = iconParts(id, opts.size !== undefined && opts.size <= 18);
  const style = opts.size ? ` style="width:${opts.size}px;height:${opts.size}px"` : '';
  const a11y = opts.title ? ` role="img" aria-label="${escXml(opts.title)}"` : ' aria-hidden="true"';
  const svg = `<svg class="ll-icon" viewBox="0 0 24 24"${style}${a11y} focusable="false">${opts.title ? `<title>${escXml(opts.title)}</title>` : ''}${wash ? `<path fill="currentColor" fill-opacity=".2" d="${wash}"/>` : ''}<path fill="currentColor" d="${ink}"/></svg>`;
  if (svgCache.size > 600) svgCache.clear();
  svgCache.set(key, svg);
  return svg;
}

/** Is a CSS colour light enough that the seal's relief should be dark? */
function lightWax(color: string): boolean {
  const v = color.trim().toLowerCase();
  if (/--(gold|gold-2|parch|parch-2|parch-3|parch-edge|warn)\)/.test(v)) return true;
  if (v.startsWith('var(')) return false;
  if (/^(gold|white|ivory|beige|wheat|khaki|cornsilk|lightyellow|goldenrod)$/.test(v)) return true;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (m) {
    const h = m[1]!.length === 3 ? m[1]!.split('').map(c => c + c).join('') : m[1]!;
    const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.42;
  }
  return false;
}

/** Closed smooth path through points (midpoint quadratics). */
function loop(pts: [number, number][]): string {
  const n = pts.length, mid = (i: number) => { const a = pts[i % n]!, b = pts[(i + 1) % n]!; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
  const m0 = mid(n - 1); let s = `M${n1(m0[0]!)} ${n1(m0[1]!)}`;
  for (let i = 0; i < n; i++) { const p = pts[i]!, m = mid(i); s += `Q${n1(p[0])} ${n1(p[1])} ${n1(m[0]!)} ${n1(m[1]!)}`; }
  return s + 'Z';
}
function arcD(cx: number, cy: number, rad: number, a0: number, a1: number): string {
  const p = (a: number) => `${n1(cx + Math.cos(a * Math.PI / 180) * rad)} ${n1(cy + Math.sin(a * Math.PI / 180) * rad)}`;
  return `M${p(a0)}A${rad} ${rad} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} 1 ${p(a1)}`;
}

const sealCache = new Map<string, string>();
/** The icon embossed on an irregular wax seal (map pins, round buttons). `color` is a CSS colour. */
export function sealSvg(id: IconId, color = 'var(--rubric)', size = 34): string {
  const key = `${id}|${color}|${size}`;
  const hit = sealCache.get(key);
  if (hit) return hit;
  const r = rng(hash('seal:' + id + ':' + color));
  const cx = 20, cy = 19.4;
  // the poured wax: a lumpy disc with a drip or two
  const ph = [r() * TAU, r() * TAU, r() * TAU];
  const drips = Array.from({ length: 2 + Math.floor(r() * 2) }, () => ({ a: r() * TAU, h: 0.9 + r() * 1.5, w: 0.18 + r() * 0.16 }));
  const R = (a: number) => {
    let v = 16 + 0.5 * Math.sin(3 * a + ph[0]!) + 0.32 * Math.sin(5 * a + ph[1]!) + 0.22 * Math.sin(8 * a + ph[2]!);
    for (const d of drips) { let da = Math.abs(a - d.a) % TAU; if (da > Math.PI) da = TAU - da; v += d.h * Math.exp(-(da * da) / (2 * d.w * d.w)); }
    return v;
  };
  const N = 44, blob: [number, number][] = [];
  for (let i = 0; i < N; i++) { const a = i / N * TAU; const rr = R(a); blob.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  const blobD = loop(blob);
  const dark = lightWax(color);
  const { wash, ink } = iconParts(id);
  const k = 0.8, t = 20 - 12 * k, ty = cy - 12 * k;
  const icon = (fill: string, op: number, dx: number, dy: number) =>
    `<g transform="translate(${n1(t + dx)} ${n1(ty + dy)}) scale(${k})">${wash ? `<path d="${wash}" fill="${fill}" fill-opacity="${n1(op * 0.3)}"/>` : ''}<path d="${ink}" fill="${fill}" fill-opacity="${op}"/></g>`;
  const relief = dark
    ? icon('#fff7e0', 0.55, 0.45, 0.55) + icon('#2a1d14', 0.78, 0, 0)
    : icon('#1a0d08', 0.42, 0.5, 0.6) + icon('#fff1de', 0.86, 0, 0);
  const svg = `<svg class="ll-sealart" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true" focusable="false">`
    + `<path d="${blobD}" fill="#140a06" fill-opacity=".34" transform="translate(.7 1.5)"/>`
    + `<path d="${blobD}" style="fill:${escXml(color)}"/>`
    + `<path d="${blobD}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width=".9"/>`
    + `<path d="${arcD(cx, cy, 14.6, 15, 150)}" fill="none" stroke="#000" stroke-opacity=".2" stroke-width="2.6" stroke-linecap="round"/>`
    + `<path d="${arcD(cx, cy, 14.4, 196, 282)}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.5" stroke-linecap="round"/>`
    + `<circle cx="${cx}" cy="${cy}" r="11.8" fill="#000" fill-opacity=".08"/>`
    + `<path d="${arcD(cx, cy, 11.8, 185, 315)}" fill="none" stroke="#000" stroke-opacity=".32" stroke-width="1.1" stroke-linecap="round"/>`
    + `<path d="${arcD(cx, cy, 11.8, 10, 130)}" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="1" stroke-linecap="round"/>`
    + relief
    + `<ellipse cx="12.6" cy="10.6" rx="2.6" ry="1.3" transform="rotate(-38 12.6 10.6)" fill="#fff" fill-opacity=".3"/>`
    + `</svg>`;
  if (sealCache.size > 400) sealCache.clear();
  sealCache.set(key, svg);
  return svg;
}
