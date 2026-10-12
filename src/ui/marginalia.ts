/**
 * OWNER: ui-art agent. Margin doodles, borders, drop caps, seals, heraldry.
 * Everything here is drawn in code by the scribe's pen (src/ui/art/ink.ts),
 * deterministic from its seed, and cached.
 */
import { Pen, rng, mix } from './art/ink';
import { DOODLE_PEN } from './art/paint';
import { DOODLES, CREATURES, type CreatureKind } from './art/doodles';
import { initialSvg } from './art/initials';
import { flourishSvg } from './art/ornament';
import { crestSvg } from './art/heraldry';
import { ILLUM_CSS } from './art/frames';

export type DoodleKind = 'snail_knight' | 'rabbit_joust' | 'goose_bishop' | 'cat_lute' | 'fox_scribe' | 'griffin' | 'goblin_scroll' | 'dragon_small' | 'mouse_coin' | 'owl_ledger' | 'hound_horn' | 'vine' | 'any';

/** A finite number or the fallback (guards sizes and seeds arriving as NaN). */
const fin = (v: number, d: number): number => (Number.isFinite(v) ? v : d);

function memo<K, V>(limit: number): { get(k: K): V | undefined; set(k: K, v: V): V } {
  const m = new Map<K, V>();
  return { get: k => m.get(k), set: (k, v) => { if (m.size >= limit) m.delete(m.keys().next().value as K); m.set(k, v); return v; } };
}

const doodleArt = memo<string, { body: string; w: number; h: number }>(160);
/** A margin doodle as inline SVG (ink line, a touch of colour). `seed` varies pose/colour. */
export function doodle(kind: DoodleKind = 'any', seed = 0, size = 64): string {
  seed = fin(seed, 0); size = fin(size, 64);
  const k: CreatureKind = kind === 'any' ? CREATURES[(mix(seed, 'any') >>> 3) % CREATURES.length]! : (DOODLES[kind as CreatureKind] ? kind as CreatureKind : 'snail_knight');
  const key = k + ':' + (seed | 0);
  let a = doodleArt.get(key);
  if (!a) {
    const def = DOODLES[k];
    const p = new Pen(rng(mix(seed, 'pen:' + k)), DOODLE_PEN);
    def.draw(p, rng(mix(seed, 'pose:' + k)));
    a = doodleArt.set(key, { body: p.out(), w: def.w, h: def.h });
  }
  const s = Math.max(8, size), sc = s / Math.max(a.w, a.h);
  return `<svg class="ll-doodle" viewBox="0 0 ${a.w} ${a.h}" width="${Math.round(a.w * sc)}" height="${Math.round(a.h * sc)}" aria-hidden="true" focusable="false">${a.body}</svg>`;
}

/** An illuminated initial: blackletter capital on a gilded, vined ground. */
export function dropCap(letter: string, size = 56): string { return initialSvg(String(letter ?? ''), Math.max(8, fin(size, 56))); }

/** A horizontal ornamental divider (vines, knots). */
export function flourish(width = 240, seed = 0): string { return flourishSvg(Math.max(24, fin(width, 240)), fin(seed, 0)); }

/** Heraldic shield for the realm from a crest seed (tinctures + one charge). */
export function crest(seed: number, size = 48): string { return crestSvg(fin(seed, 0), Math.max(8, fin(size, 48))); }

/** CSS for corner ornaments / vine borders, to be applied with class "ll-illum". */
export const MARGINALIA_CSS = ILLUM_CSS;
