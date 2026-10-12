/**
 * Portraits: assembly. Rolls the person, draws every layer back to front and
 * hands back strings: the ground, the bust and the ring are separate so the
 * live version can let the bust breathe between a still ground and ring.
 * Pure: no DOM, runs in node.
 */
import { makeRand, f, clamp, curve, ribbon, taper, ellipse, mixc, shadeOf, type Pt } from './util';
import { PIG } from './pigments';
import { makeGenome, moodExpr, type GenomeInput } from './genome';
import { Pen } from './pen';
import { faceFrame, faceMarkup, withRest } from './features';
import { geometry, drawEar, drawNeck, drawNose, drawBlush, drawMarks, drawMoodOverlays, drawSpecs, drawPatch, drawQuill, drawMouthProps, drawHoodShadow, type Geo } from './head';
import { drawHair, drawBeard } from './hair';
import { drawHat } from './headwear';
import { drawGarb } from './garb';
import { drawTool } from './tools';
import { drawDragon } from './dragon';
import type { Genome, Lod, FrameAttrs } from './types';

export interface BuildInput extends GenomeInput { size: number; frame?: boolean }
export interface Built {
  g: Genome; lod: Lod; uid: string; framed: boolean;
  /** markup for three stacked 200-unit boxes */
  ground: string; bust: string; ring: string;
  /** the first frame (neutral unless a mood was given) */
  frame: FrameAttrs;
}

let counter = 0;
export function lodFor(size: number): Lod { return size < 64 ? 0 : size < 160 ? 1 : 2; }

export function buildPortrait(inp: BuildInput, mood = 'neutral'): Built {
  const g = makeGenome(inp);
  const lod = lodFor(inp.size);
  const uid = 'llp' + (counter++).toString(36) + '-';
  const pen = new Pen(lod, uid, g.ink, makeRand(g.seed ^ 0x51ed).fork('pen'));
  const geo = geometry(g);
  const fr = faceFrame(g, lod, withRest(g.rest, moodExpr(mood)), { blink: 0, gx: 0, gy: 0 });
  const framed = inp.frame !== false;

  let inner: string, top: number, maxHalf: number;
  if (g.kind === 'dragon') {
    const d = drawDragon(g, geo, pen, fr);
    inner = d.markup; top = d.top; maxHalf = 60;
  } else {
    const hat = drawHat(g, geo, pen);
    const hair = drawHair(g, geo, pen, hat.covers, hat.clipY);
    const beard = drawBeard(g, geo, pen);
    const garb = drawGarb(g, geo, pen);
    const tool = pen.lod === 0 ? { back: '', front: '' } : drawTool(g, geo, pen);
    const face = faceMarkup(g, pen, fr);
    const ov = drawMoodOverlays(g, geo, pen, fr);
    const earsOver = g.ears.kind === 'goblin' && hat.hidesEars;
    const ears = hat.hidesEars && !earsOver ? '' : drawEar(g, geo, pen, -1) + drawEar(g, geo, pen, 1);
    const headBlob = pen.blob(geo.outline, g.skin, { w: 1.75, shade: g.skinShade, shadeLod: 1, sx: 5.5, sy: 3.5, wob: lod === 2 ? 0.4 : 0.2 });

    const back = `<g data-k="hb"${attr(fr, 'hb.transform', 'transform')}>${hair.back}${hat.back}${hat.hidesEars ? '' : drawQuill(g, geo, pen)}</g>`;
    const head = `<g data-k="hd"${attr(fr, 'hd.transform', 'transform')}>`
      + (earsOver ? '' : ears) + headBlob + ov.under + drawBlush(g, geo, pen, fr['blush.opacity'] ?? '0.3')
      + drawMarks(g, geo, pen) + beard.under + drawNose(g, geo, pen) + drawHoodShadow(g, geo, pen)
      + face.eyes + face.brows + face.mouth + face.special + beard.over
      + drawSpecs(g, geo, pen) + drawPatch(g, geo, pen)
      + hair.front + hair.over + hat.front + (earsOver ? ears : '') + hoops(g, geo, pen)
      + drawMouthProps(g, geo, pen) + ov.over + '</g>';
    inner = garb.back + back + tool.back + drawNeck(g, geo, pen) + garb.front + head + tool.front;
    top = Math.min(hat.top, hairTop(g, geo, hat.covers));
    maxHalf = Math.max(g.head.cheek, g.head.skull) + (g.ears.kind === 'goblin' ? 30 * g.ears.size : 6);
  }

  // fit the bust in the roundel: tall hats shrink it a little; list sizes zoom in on the head
  let fit: string;
  if (lod === 0) {
    const span = clamp(geo.chin + 13 - (top - 3), 104, 200);
    const k = Math.min(176 / span, 92 / (maxHalf * 0.8));
    fit = `translate(${f(100 - 100 * k)} ${f(12 - (top - 3) * k)}) scale(${k.toFixed(3)})`;
  } else if (top < 13) {
    const k = clamp((204 - 13) / (204 - top), 0.7, 1);
    fit = `translate(${f(100 - 100 * k)} ${f(204 - 204 * k)}) scale(${k.toFixed(3)})`;
  } else fit = '';

  const bust = `<defs>${pen.defs}</defs><g${fit ? ` transform="${fit}"` : ''}>${inner}</g>`;
  return { g, lod, uid, framed, ground: framed ? drawGround(g, lod, uid) : '', bust, ring: framed ? drawRing(g, lod) : '', frame: fr };
}

const attr = (fr: FrameAttrs, key: string, name: string): string => (fr[key] ? ` ${name}="${fr[key]}"` : '');

function hairTop(g: Genome, geo: Geo, covered: string): number {
  if (covered !== 'none') return geo.top;
  const s = g.hair.style, v = g.hair.vol;
  return geo.top - (s === 'bun' ? 15 * v : s === 'topknot' ? 16 * v : s === 'tuft' ? 19 * v : s === 'wild' ? 15 * v : s === 'curly' ? 12 * v : s === 'bald' ? 0 : 6 * v);
}

/** Big hoop earrings hang below whatever is on the head. */
function hoops(g: Genome, geo: Geo, pen: Pen): string {
  if (g.marks.earring !== 'hoops' && g.marks.earring !== 'drop') return '';
  if (pen.lod === 0) return '';
  let s = '';
  for (const sd of [-1, 1]) {
    const x = geo.cx + sd * (geo.hw(geo.earY + 8) + 1.5), y = geo.earY + 12;
    if (g.marks.earring === 'hoops') s += `<circle cx="${f(x)}" cy="${f(y + 3)}" r="5" fill="none" stroke="${PIG.gold}" stroke-width="${f(1.5 * pen.k)}"/>` + (pen.fine ? `<circle cx="${f(x)}" cy="${f(y + 3)}" r="5.9" fill="none" stroke="${pen.ink}" stroke-width=".6"/>` : '');
    else s += pen.bead(x, y + 4, 2.2, PIG.sky, 0.8);
  }
  return s;
}

// ───────────── the roundel ─────────────

function drawGround(g: Genome, lod: Lod, uid: string): string {
  const base = g.ground === 'red' ? PIG.red : PIG.lapis;
  const deep = g.ground === 'red' ? PIG.redDeep : PIG.lapisDeep;
  const lite = g.ground === 'red' ? PIG.redLite : PIG.lapisLite;
  let s = `<circle cx="100" cy="100" r="98" fill="${deep}"/><circle cx="96" cy="95" r="94" fill="${base}"/>`;
  if (lod === 2) {
    // diaper: the small repeated gilding behind a miniature
    const id = uid + 'dp';
    const v = g.seed % 3;
    const cell = v === 0 ? `<circle cx="9" cy="9" r=".95" fill="${PIG.gold2}" opacity=".5"/><circle cx="0" cy="0" r=".55" fill="${lite}" opacity=".7"/><circle cx="18" cy="0" r=".55" fill="${lite}" opacity=".7"/><circle cx="0" cy="18" r=".55" fill="${lite}" opacity=".7"/><circle cx="18" cy="18" r=".55" fill="${lite}" opacity=".7"/>`
      : v === 1 ? `<path d="M0 9L9 0L18 9L9 18Z" fill="none" stroke="${lite}" stroke-width=".6" opacity=".45"/><circle cx="9" cy="9" r=".9" fill="${PIG.gold2}" opacity=".5"/>`
        : `<path d="M9 5.8L9.8 8.2L12.2 9L9.8 9.8L9 12.2L8.2 9.8L5.8 9L8.2 8.2Z" fill="${PIG.gold2}" opacity=".5"/><circle cx="0" cy="0" r=".6" fill="${lite}" opacity=".6"/><circle cx="18" cy="18" r=".6" fill="${lite}" opacity=".6"/><circle cx="18" cy="0" r=".6" fill="${lite}" opacity=".6"/><circle cx="0" cy="18" r=".6" fill="${lite}" opacity=".6"/>`;
    s = `<defs><pattern id="${id}" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(${v === 1 ? 0 : 45} 100 100)">${cell}</pattern></defs>` + s + `<circle cx="100" cy="100" r="97" fill="url(#${id})"/>`;
  }
  return s;
}

function drawRing(g: Genome, lod: Lod): string {
  const wd = lod === 0 ? 9 : lod === 1 ? 6.6 : 5.4;
  const rm = 99.2 - wd / 2;
  let s = `<circle cx="100" cy="100" r="${f(rm)}" fill="none" stroke="${PIG.gold}" stroke-width="${f(wd)}"/>`;
  if (lod > 0) {
    const r = makeRand(g.seed ^ 0x77).fork('ring');
    const loop = (rad: number): Pt[] => ellipse(100, 100, rad, rad, 22).map(p => [p[0] + r.jit(0.3), p[1] + r.jit(0.3)] as Pt);
    // light catches the upper left of the gold, shadow pools lower right
    s += `<path d="M${f(100 - rm * 0.94)} ${f(100 - rm * 0.34)}A${f(rm)} ${f(rm)} 0 0 1 ${f(100 - rm * 0.2)} ${f(100 - rm * 0.98)}" fill="none" stroke="${PIG.gold2}" stroke-width="${f(wd * 0.5)}" stroke-linecap="round"/>`;
    s += `<path d="M${f(100 + rm * 0.96)} ${f(100 + rm * 0.28)}A${f(rm)} ${f(rm)} 0 0 1 ${f(100 + rm * 0.3)} ${f(100 + rm * 0.954)}" fill="none" stroke="${PIG.goldInk}" stroke-width="${f(wd * 0.42)}" stroke-linecap="round" opacity=".55"/>`;
    if (lod === 2) {
      s += `<path d="${ribbon(loop(99.2 - wd), taper.loop(1.25), true)}" fill="${PIG.ink}" fill-rule="evenodd"/>`;
      s += `<path d="${ribbon(loop(99.1), 1.1, true)}" fill="${PIG.ink}" fill-rule="evenodd"/>`;
    } else {
      s += `<path d="${curve(loop(99.2 - wd), true)}" fill="none" stroke="${PIG.ink}" stroke-width="1.5"/>`;
      s += `<circle cx="100" cy="100" r="99.2" fill="none" stroke="${PIG.ink}" stroke-width="1.3"/>`;
    }
  } else {
    s += `<circle cx="100" cy="100" r="${f(99.2 - wd)}" fill="none" stroke="${PIG.ink}" stroke-width="2.4"/>`;
  }
  return s;
}

/** One self-contained SVG (no animation): for the gallery, for tests, for anywhere a still will do. */
export function composeSvg(b: Built, size: number, title?: string): string {
  const clipId = b.uid + 'rc';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}"${title ? ` role="img" aria-label="${title}"` : ' aria-hidden="true"'}>`
    + `<defs><clipPath id="${clipId}"><circle cx="100" cy="100" r="${b.framed ? 97 : 99}"/></clipPath></defs>`
    + b.ground + `<g clip-path="url(#${clipId})">${b.bust}</g>` + b.ring + '</svg>';
}

export { mixc, shadeOf };
