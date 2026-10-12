/**
 * Portraits: the pen. One object per drawing that knows the level of detail
 * and turns points into SVG the way the scribe would: a flat wash, a second
 * tone on the side away from the light, and an ink outline that swells and
 * thins. At list sizes the same calls come out as plain heavy strokes.
 */
import { curve, ribbon, taper, wobble, f, shadeOf, type Pt, type Rand, type Width } from './util';
import type { Lod } from './types';

export interface LineOpts {
  c?: string;
  closed?: boolean;
  /** quill profile for open strokes */
  tp?: 'both' | 'out' | 'in' | 'flat';
  op?: number;
  /** hand wobble in units (default small) */
  wob?: number;
  /** extra attributes, e.g. data-k */
  attr?: string;
}
export interface BlobOpts {
  /** outline weight, 0 for none */
  w?: number;
  line?: string;
  /** second-tone crescent: true = derived from the fill */
  shade?: string | boolean;
  /** how far the light pushes the crescent */
  sx?: number; sy?: number;
  wob?: number;
  op?: number;
  attr?: string;
  /** minimum lod at which the crescent is drawn (default 2) */
  shadeLod?: Lod;
}

export class Pen {
  readonly lod: Lod;
  /** line weight multiplier: lines must stay near a pixel wide at any size */
  readonly k: number;
  ink: string;
  defs = '';
  private n = 0;
  constructor(lod: Lod, readonly uid: string, ink: string, readonly r: Rand, kMul = 1) {
    this.lod = lod;
    this.k = (lod === 0 ? 2.5 : lod === 1 ? 1.5 : 1) * kMul;
    this.ink = ink;
  }
  /** A pen for something drawn inside a scaled group (a hat too small): lines keep their weight. */
  sub(scale: number): Pen { return new Pen(this.lod, this.uid + 's' + (this.n++).toString(36) + '-', this.ink, this.r.fork('sub'), 1 / scale); }
  id(): string { return this.uid + (this.n++).toString(36); }

  /** An ink line through points. */
  line(pts: readonly Pt[], w = 1.4, o: LineOpts = {}): string {
    if (pts.length < 2) return '';
    const c = o.c ?? this.ink;
    const amp = o.wob ?? (this.lod === 2 ? 0.35 : 0.2);
    const p = amp > 0 ? wobble(pts, this.r, amp) : pts;
    const extra = (o.op !== undefined && o.op < 1 ? ` opacity="${f(o.op * 100) === '100' ? 1 : +(o.op).toFixed(2)}"` : '') + (o.attr ? ' ' + o.attr : '');
    if (this.lod === 2) {
      let width: Width;
      const W = w * this.k;
      if (o.closed) width = taper.loop(W);
      else width = o.tp === 'flat' ? W : o.tp === 'out' ? taper.out(W) : o.tp === 'in' ? taper.in(W) : taper.both(W);
      return `<path d="${ribbon(p, width, !!o.closed)}" fill="${c}"${o.closed ? ' fill-rule="evenodd"' : ''}${extra}/>`;
    }
    return `<path d="${curve(p, !!o.closed)}" fill="none" stroke="${c}" stroke-width="${f(w * this.k * 0.85)}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
  }

  /** A washed shape: flat fill, optional second tone, ink outline. */
  blob(pts: readonly Pt[], fill: string, o: BlobOpts = {}): string {
    const amp = o.wob ?? (this.lod === 2 ? 0.45 : 0.25);
    const p = amp > 0 ? wobble(pts, this.r, amp) : pts.slice();
    const d = curve(p, true);
    const w = o.w ?? 1.5;
    const extra = (o.op !== undefined && o.op < 1 ? ` opacity="${+o.op.toFixed(2)}"` : '') + (o.attr ? ' ' + o.attr : '');
    let s = '';
    const wantShade = o.shade && this.lod >= (o.shadeLod ?? 2);
    if (wantShade) {
      const sc = o.shade === true ? shadeOf(fill) : (o.shade as string);
      const id = this.clip(d);
      s += `<g${extra}><path d="${d}" fill="${sc}"/><g clip-path="url(#${id})"><path d="${d}" fill="${fill}" transform="translate(${f(-(o.sx ?? 5))} ${f(-(o.sy ?? 4))})"/></g>`;
      if (w > 0) s += this.outline(p, w, o.line);
      return s + '</g>';
    }
    if (this.lod === 2 || w <= 0) {
      s += `<path d="${d}" fill="${fill}"${extra}/>`;
      if (w > 0) s += this.outline(p, w, o.line, extra);
      return s;
    }
    return `<path d="${d}" fill="${fill}" stroke="${o.line ?? this.ink}" stroke-width="${f(w * this.k * 0.85)}" stroke-linejoin="round"${extra}/>`;
  }
  private outline(p: readonly Pt[], w: number, c?: string, extra = ''): string {
    if (this.lod === 2) return `<path d="${ribbon(p, taper.loop(w * this.k), true)}" fill="${c ?? this.ink}" fill-rule="evenodd"${extra}/>`;
    return `<path d="${curve(p, true)}" fill="none" stroke="${c ?? this.ink}" stroke-width="${f(w * this.k * 0.85)}" stroke-linejoin="round"${extra}/>`;
  }

  /** A plain filled path with no outline. */
  fill(pts: readonly Pt[], fill: string, op = 1, attr = ''): string {
    return `<path d="${curve(pts, true)}" fill="${fill}"${op < 1 ? ` opacity="${+op.toFixed(2)}"` : ''}${attr ? ' ' + attr : ''}/>`;
  }
  dot(x: number, y: number, r: number, fill: string, op = 1, attr = ''): string {
    return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}"${op < 1 ? ` opacity="${+op.toFixed(2)}"` : ''}${attr ? ' ' + attr : ''}/>`;
  }
  /** A circle with an ink edge (beads, gems, buttons). */
  bead(x: number, y: number, r: number, fill: string, w = 1): string {
    return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${fill}" stroke="${this.ink}" stroke-width="${f(w * this.k * 0.8)}"/>`;
  }
  /** A straight bar (a shaft, a handle, a strap) as a washed shape. */
  bar(a: Pt, b: Pt, w: number, fill: string, o: BlobOpts = {}): string {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * w / 2, ny = (dx / len) * w / 2;
    return this.blobPoly([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]], fill, o);
  }
  /** Like blob but with straight edges (planks, books, crowns). */
  blobPoly(pts: readonly Pt[], fill: string, o: BlobOpts = {}): string {
    const amp = o.wob ?? (this.lod === 2 ? 0.3 : 0.15);
    const p = amp > 0 ? wobble(pts, this.r, amp) : pts;
    let d = '';
    for (let i = 0; i < p.length; i++) d += (i ? 'L' : 'M') + f(p[i][0]) + ' ' + f(p[i][1]);
    d += 'Z';
    const w = o.w ?? 1.3;
    const extra = (o.op !== undefined && o.op < 1 ? ` opacity="${+o.op.toFixed(2)}"` : '') + (o.attr ? ' ' + o.attr : '');
    return `<path d="${d}" fill="${fill}"${w > 0 ? ` stroke="${o.line ?? this.ink}" stroke-width="${f(w * this.k * 0.8)}" stroke-linejoin="round"` : ''}${extra}/>`;
  }
  /** A shape with a hole in it (a hood around a face). */
  ring(outer: readonly Pt[], inner: readonly Pt[], fill: string, o: BlobOpts = {}): string {
    const amp = o.wob ?? (this.lod === 2 ? 0.4 : 0.2);
    const po = amp > 0 ? wobble(outer, this.r, amp) : outer, pi = amp > 0 ? wobble(inner, this.r, amp) : inner;
    const w = o.w ?? 1.5;
    let s = `<path d="${curve(po, true)}${curve(pi, true)}" fill="${fill}" fill-rule="evenodd"/>`;
    if (w > 0) s += this.outline(po, w, o.line) + this.outline(pi, w * 0.9, o.line);
    return s;
  }
  /** A small star (hats, robes, the fortune teller's veil). */
  star(x: number, y: number, r: number, fill: string, pointsN = 5): string {
    let d = '';
    for (let i = 0; i < pointsN * 2; i++) {
      const a = (i / (pointsN * 2)) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.44 : r;
      d += (i ? 'L' : 'M') + f(x + Math.cos(a) * rr) + ' ' + f(y + Math.sin(a) * rr);
    }
    return `<path d="${d}Z" fill="${fill}"${this.lod === 2 ? ` stroke="${this.ink}" stroke-width=".5" stroke-linejoin="round"` : ''}/>`;
  }
  clip(d: string): string {
    const id = this.id();
    this.defs += `<clipPath id="${id}"><path d="${d}"/></clipPath>`;
    return id;
  }
  /** Wrap markup so it only shows inside a shape. */
  inside(d: string, body: string): string { return body ? `<g clip-path="url(#${this.clip(d)})">${body}</g>` : ''; }
  /** true when fine detail (strands, weave, wrinkles) is worth drawing */
  get fine(): boolean { return this.lod === 2; }
  get mid(): boolean { return this.lod >= 1; }
}
