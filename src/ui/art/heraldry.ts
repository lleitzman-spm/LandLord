/**
 * OWNER: ui-art agent. Arms from a seed: a heater shield, its field divided
 * or plain, an ordinary now and then, one charge, and sometimes a motto.
 * The rule of tinctures is kept: metal is never laid on metal nor colour on
 * colour. On a divided field the charge is counterchanged, as a herald would.
 */
import { Pen, type PenStyle, rng, mix, pick } from './ink';
import { C, crownedHead } from './paint';

const HERALD_PEN: PenStyle = { w: 2.3, nibA: -0.7, nibMin: 0.62, jit: 0.1, wob: 0.08, step: 1.6, t0: 0.65, t1: 0.55, noise: 0.06, shift: [0, 0], eps: 0.14, chord: 5, hair: 1.05 };

const T = {
  or: '#d3a82c', argent: '#f4eedf',
  gules: '#b2322b', azure: '#2f5597', vert: '#3f7a4c', sable: '#2e2824', purpure: '#6d3f78',
} as const;
type Tinc = keyof typeof T;
const METALS: Tinc[] = ['or', 'argent'];
const COLOURS: Tinc[] = ['gules', 'azure', 'vert', 'sable', 'gules', 'azure', 'purpure'];
const isMetal = (t: Tinc | 'ermine') => t === 'or' || t === 'argent';

const SHIELD = 'M8 6L92 6L92 44C92 74 73 94 50 104C27 94 8 74 8 44Z';

/** Field divisions: [region of the second tincture, region of the first]. */
const PARTY: Record<string, [string, string]> = {
  pale: ['M50 0H100V110H50Z', 'M0 0H50V110H0Z'],
  fess: ['M0 46H100V110H0Z', 'M0 0H100V46H0Z'],
  bend: ['M2 0L98 96L98 110L0 110L0 0Z', 'M2 0L100 0L100 98Z'],
  sinister: ['M98 0L2 96L2 110L100 110L100 0Z', 'M98 0L0 0L0 98Z'],
  quarterly: ['M50 0H100V46H50Z M0 46H50V110H0Z', 'M0 0H50V46H0Z M50 46H100V110H50Z'],
  chevron: ['M0 90L50 40L100 90L100 110L0 110Z', 'M0 0H100V90L50 40L0 90Z'],
  saltire: ['M0 0L50 48L0 96Z M100 0L50 48L100 96Z', 'M0 0L100 0L50 48Z M0 96L50 48L100 96L100 110L0 110Z'],
};

type Charge = (p: Pen, f: string) => void;
const H = 0.42; // hairline weight for inner detail

const CHARGES: Record<string, Charge> = {
  key(p, f) {
    p.dual('M50 18C42 18 37.6 24 37.6 30C37.6 36.4 43 41.6 50 41.6C57 41.6 62.4 36.4 62.4 30C62.4 24 58 18 50 18Z', 7.6, f, 0.6);
    p.dual('M50 41.6L50 82', 8, f, 0.6);
    p.dual('M43.4 47L56.6 47', 5.6, f, 0.58);
    p.shape('M53.6 63L65 63L65 69L60 69L60 73.4L65 73.4L65 81.6L53.6 81.6Z', f, 1);
  },
  tower(p, f) {
    p.shape('M34 84L36 41L64 41L66 84Z', f, 1);
    p.shape('M32.6 41.4L32.6 29.6L39 29.6L39 35L45 35L45 29.6L55 29.6L55 35L61 35L61 29.6L67.4 29.6L67.4 41.4Z', f, 1);
    p.solid('M44.6 84L44.6 71C44.6 64.6 55.4 64.6 55.4 71L55.4 84Z', C.ink);
    p.solid('M48.6 49.6L51.4 49.6L51.4 57.6L48.6 57.6Z', C.ink);
    for (const [x, y] of [[37, 50], [57.6, 48], [38, 62], [58, 60.6], [41, 74], [60.4, 74]] as const) p.s(`M${x} ${y}L${x + 5} ${y}`, H);
  },
  wheatsheaf(p, f) {
    p.shape('M43 58L33 84L67 84L57 58Z', f, 1);
    for (const x of [39, 45, 50, 55, 61]) p.s(`M${50 + (x - 50) * 0.35} 60L${x} 82`, H);
    const ears: [number, number, number][] = [[50, 24, 0], [40.6, 28, -24], [59.4, 28, 24], [33.6, 37.6, -48], [66.4, 37.6, 48], [44, 41, -12], [56, 41, 12], [50, 36, 0]];
    for (const [x, y, a] of ears) { p.shapeE(x, y, 4.6, 8.6, a, f, 0.85); p.s(`M${x} ${y - 5}L${x} ${y + 5}`, H); }
    p.shape('M40 55.6C46 58.6 54 58.6 60 55.6L60.4 61.4C54 64 46 64 39.6 61.4Z', f, 1);
  },
  coin(p, f) {
    p.shapeE(50, 51, 28, 28, 0, f, 1.15);
    p.e(50, 51, 23, 23, 0, 0.5, 0.96);
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; p.dot(50 + Math.cos(a) * 25.4, 51 + Math.sin(a) * 25.4, 0.6, C.ink); }
    p.at({ x: 50 - 12 * 2.3, y: 51 - 12 * 2.3, s: 2.3 }, () => crownedHead(p, C.ink));
  },
  griffin(p, f) {
    // a griffin's head, erased
    p.shape('M44 78L42 58C40.6 52 38.6 48.4 37.4 46.4L28 48.4C24 49.4 21.4 47.2 22 44C23 40 28 36 36 33C40 28 46 22 54 21C64 20 72 26 72 36C72 46 68 56 70 66L72 78L67.4 73.4L64 80L60 73.6L56 80L52 73.6L48 80Z', f, 1);
    p.shape('M61 22.6L65.6 11.6L68.4 25Z', f, 0.9);
    p.dot(51, 30, 1.6, C.ink);
    p.s('M47.6 26.4C50 25.2 53 25.4 55 27', 0.6);
    p.s('M37.4 40.6L25.4 44.2', H);
    for (const [x, y] of [[50, 48], [56, 54], [50, 60], [57, 64], [52, 68]] as const) p.s(`M${x} ${y}C${x + 2} ${y - 2} ${x + 4} ${y - 2} ${x + 5} ${y}`, H);
  },
  hovel(p, f) {
    p.at({ x: 50, y: 84, kx: -0.08 }, () => p.at({ x: -50, y: -84 }, () => {
      p.shape('M30 84L31 54L69 54L70 84Z', f, 1);
      p.shape('M60.4 42L60.4 28.4L66 28.4L66 47Z', f, 0.9);
      p.shape('M22.6 57L50 30L77.4 57Z', f, 1);
      for (const [x0, x1] of [[34, 40], [44, 49], [53, 58], [62, 67]] as const) p.s(`M${x0} 52L${x1} 42`, H);
      p.solid('M44.6 84L44.6 70C44.6 64.4 54 64.4 54 70L54 84Z', C.ink);
      p.s('M58 62L65 62L65 69L58 69Z', 0.6); p.s('M61.5 62L61.5 69', H);
    }));
  },
  snail(p, f) {
    p.shape('M14 80C24 75.6 44 75.6 66 75.4L71 66C73.6 60 80 58.6 83 62.6C85.6 66.4 83 72 80 80Z', f, 1);
    p.shapeE(44, 54, 21, 20, -6, f, 1.1);
    p.spiral(45.4, 55.6, 2, 16.6, 2.1, 200, 0.75, 1);
    p.s('M77 61.6C76 56 74 52 71.6 48.6', 0.7); p.dot(71.2, 48, 1.8, C.ink);
    p.s('M80.6 62C81.6 56.6 83.6 52.6 86.4 50', 0.7); p.dot(86.8, 49.6, 1.8, C.ink);
  },
  crown(p, f) {
    p.shape('M24 70L19.4 36L36 52L50 27L64 52L80.6 36L76 70Z', f, 1);
    p.shape('M23.6 69.4C40 66.6 60 66.6 76.4 69.4L76.4 79.4C60 76.8 40 76.8 23.6 79.4Z', f, 1);
    p.dot(19.4, 34, 2.6, C.ink); p.dot(50, 24.6, 2.6, C.ink); p.dot(80.6, 34, 2.6, C.ink);
    p.dot(36, 73.4, 2, C.ink); p.solid('M50 70.6L53 73.4L50 76.2L47 73.4Z', C.ink); p.dot(64, 73.4, 2, C.ink);
  },
  mallet(p, f) {
    p.around(50, 52, { r: 32 }, () => {
      p.dual('M50 44L50 86', 7.4, f, 0.58);
      p.shape('M29 22.6C42 20.6 58 20.6 71 22.6C72.6 28 72.6 38 71 43.4C58 45.4 42 45.4 29 43.4C27.4 38 27.4 28 29 22.6Z', f, 1);
      p.s('M36.4 22L36.4 44', H); p.s('M63.6 22L63.6 44', H);
    });
  },
  bell(p, f) {
    p.dual('M45 25C45 18 55 18 55 25', 4.4, f, 0.55);
    p.shape('M32 72C34 56 34 40 42 33.6C46 30.6 54 30.6 58 33.6C66 40 66 56 68 72Z', f, 1);
    p.shape('M24.6 72L75.4 72L73 79L27 79Z', f, 1);
    p.dot(50, 83.4, 4, C.ink);
    p.s('M40 42C38.6 50 38 58 37.6 66', H);
  },
  goose(p, f) {
    p.shape('M22 46C21 40 25 34.4 31 35C35 35.4 37 38.6 36.6 42.6C36 48 33.6 52 36 57C42 54 52 53.6 62 54C70 54.4 76 52 82 46C83 54 80 62 74 68C66 74 54 76 44 74C34 72 28 64 28 58C28.4 53 30 49 29 45.6L22 47.4Z', f, 1);
    p.shape('M22.6 39.8L12.4 42.4L22 46Z', T.or === f ? T.gules : T.or, 0.8);
    p.dot(30, 39.6, 1.4, C.ink);
    p.s('M48 60C56 58.6 64 59 72 61.4', 0.6); p.s('M52 64C58 63 64 63.4 69 64.6', H);
    p.dual('M46 74L44.6 86', 3, f, 0.5); p.dual('M58 74.6L60 86', 3, f, 0.5);
    p.s('M39.6 87L49.6 87', 0.8); p.s('M55 87L65 87', 0.8);
  },
  mullet(p, f) {
    let d = '';
    for (let i = 0; i < 10; i++) { const a = (-90 + i * 36) * Math.PI / 180, r = i % 2 ? 13.4 : 30; d += (i ? 'L' : 'M') + (50 + Math.cos(a) * r).toFixed(1) + ' ' + (54 + Math.sin(a) * r).toFixed(1); }
    p.shape(d + 'Z', f, 1);
  },
  tree(p, f) {
    p.shape('M46 84L47.4 60L52.6 60L54 84Z', f, 1);
    p.shape('M30 50C24 48 22.4 40 27.4 36C26 28 32.4 22.6 39.4 24.6C42 18 54 17 58 23.4C65 21.6 72.4 26.4 70.6 33.6C77 36 77.4 45.6 70.4 48C68 54 60 56 55 53.4C51.6 57.6 44 58 40.6 54C36 55.4 31 53.6 30 50Z', f, 1);
    p.s('M38 84L62 84', 0.8);
    p.s('M44.4 40C46.6 42.6 48.6 46 50 50', H); p.s('M57 36C55.4 40 53.4 44.6 51.4 49', H);
  },
};
const CHARGE_KEYS = Object.keys(CHARGES);

const MOTTOES = ['PAID IN FULL', 'BY THE FIRST', 'MIND THE THATCH', 'HONEST WEAR', 'IT WILL HOLD', 'IN TRIPLICATE', 'NO LIVESTOCK', 'SURETY FIRST', 'RENT DAY COMES', 'WE HAVE A FORM', 'NOTHING OWED', 'KEEP THE ROOF', 'FAIR HEARTH'];

let seq = 0;

function chargeSvg(kind: string, fill: string, seed: number, place: { x: number; y: number; s: number }): string {
  const p = new Pen(rng(seed), HERALD_PEN);
  p.color = C.ink;
  p.at({ x: place.x - 50 * place.s, y: place.y - 50 * place.s, s: place.s }, () => CHARGES[kind]!(p, fill));
  return p.out();
}

function ermineSpots(seed: number): string {
  const p = new Pen(rng(seed), HERALD_PEN);
  p.color = T.sable;
  for (let row = 0; row < 6; row++) for (let col = 0; col < 5; col++) {
    const x = 16 + col * 17 + (row % 2 ? 8.5 : 0), y = 14 + row * 16;
    if (x > 92) continue;
    p.solid(`M${x} ${y}L${x - 2.2} ${y + 6.4}L${x} ${y + 5.2}L${x + 2.2} ${y + 6.4}Z`);
    p.dot(x, y - 1.6, 1.05); p.dot(x - 2.2, y + 0.2, 1.05); p.dot(x + 2.2, y + 0.2, 1.05);
  }
  return p.out();
}

const cache = new Map<number, { body: string; h: number }>();

/** A heater shield from a seed, as inline SVG `size` pixels wide. */
export function crestSvg(seed: number, size = 48): string {
  const key = seed | 0;
  let a = cache.get(key);
  if (!a) {
    const r = rng(mix(seed, 'arms'));
    const id = 'llc' + (seq++).toString(36);
    const kind = pick(r, CHARGE_KEYS);
    const roll = r();
    const metal = pick(r, METALS), colour = pick(r, COLOURS);
    let field = '', overlay = '', charge = '';
    const cs = mix(seed, 'charge');
    let defs = `<clipPath id="${id}s"><path d="${SHIELD}"/></clipPath>`;
    if (roll < 0.36) {
      // plain field, a single charge of the opposite kind
      const ermine = r() < 0.14;
      const f: Tinc | 'ermine' = ermine ? 'ermine' : (r() < 0.5 ? metal : colour);
      const c = f === 'ermine' ? pick(r, ['gules', 'azure', 'vert', 'sable'] as Tinc[]) : isMetal(f) ? colour : metal;
      field = `<path d="${SHIELD}" fill="${f === 'ermine' ? T.argent : T[f]}"/>` + (f === 'ermine' ? `<g clip-path="url(#${id}s)">${ermineSpots(cs + 7)}</g>` : '');
      charge = chargeSvg(kind, T[c], cs, { x: 50, y: 52, s: f === 'ermine' ? 0.9 : 0.96 });
    } else if (roll < 0.74) {
      // a divided field, metal and colour, the charge counterchanged
      const div = pick(r, Object.keys(PARTY));
      const [b, aPart] = PARTY[div]!;
      const first = r() < 0.5 ? metal : colour, second = first === metal ? colour : metal;
      defs += `<clipPath id="${id}a"><path d="${aPart}"/></clipPath><clipPath id="${id}b"><path d="${b}"/></clipPath>`;
      field = `<path d="${SHIELD}" fill="${T[first]}"/><path d="${b}" fill="${T[second]}" clip-path="url(#${id}s)"/>`;
      const place = { x: 50, y: 52, s: 0.92 };
      charge = `<g clip-path="url(#${id}a)">${chargeSvg(kind, T[second], cs, place)}</g><g clip-path="url(#${id}b)">${chargeSvg(kind, T[first], cs, place)}</g>`;
    } else if (roll < 0.9) {
      // a chief, and the charge below it in the chief's tincture
      const fieldMetal = r() < 0.4;
      const f = fieldMetal ? metal : colour, ch = fieldMetal ? colour : metal;
      field = `<path d="${SHIELD}" fill="${T[f]}"/>`;
      overlay = `<path d="M0 0H100V33H0Z" fill="${T[ch]}" clip-path="url(#${id}s)"/>`;
      const cp = new Pen(rng(cs + 3), HERALD_PEN); cp.color = C.ink;
      cp.s('M8.6 33C30 32.4 70 32.4 91.4 33', 0.7);
      overlay += cp.out();
      charge = chargeSvg(kind, T[ch], cs, { x: 50, y: 66, s: 0.68 });
    } else {
      // a bordure about a charge
      const f = r() < 0.5 ? metal : colour, bd = isMetal(f) ? colour : metal, c = isMetal(f) ? pick(r, COLOURS.filter(x => x !== bd)) : (bd === 'or' ? 'argent' : 'or');
      field = `<path d="${SHIELD}" fill="${T[f]}"/>`;
      overlay = `<path d="${SHIELD}" fill="none" stroke="${T[bd]}" stroke-width="17" clip-path="url(#${id}s)"/>`;
      const bp = new Pen(rng(cs + 5), HERALD_PEN); bp.color = C.ink;
      bp.s('M16.4 13.4L83.6 13.4L83.6 44C83.6 69 68 85.6 50 94.6C32 85.6 16.4 69 16.4 44Z', 0.55);
      overlay += bp.out();
      charge = chargeSvg(kind, T[c], cs, { x: 50, y: 50, s: 0.74 });
    }
    // painted modelling: a lighter dexter half and a shadow at the rim
    const shade = `<g clip-path="url(#${id}s)"><path d="M8 6L50 6L50 104L8 104Z" fill="#fff" fill-opacity=".09"/><path d="${SHIELD}" fill="none" stroke="#1a0f08" stroke-opacity=".16" stroke-width="8"/><path d="M10 8L90 8" stroke="#fff" stroke-opacity=".22" stroke-width="2.4"/></g>`;
    const op = new Pen(rng(cs + 11), HERALD_PEN); op.color = C.ink;
    op.s(SHIELD, 1.25);
    let motto = '', h = 108;
    if (r() < 0.42) {
      h = 126;
      const text = pick(r, MOTTOES);
      const mp = new Pen(rng(cs + 13), HERALD_PEN); mp.color = C.ink;
      mp.shape('M12.6 98.4L3 95.4L6.8 101.6L2.4 107.6L12.6 107Z', '#d9c493', 0.7);
      mp.shape('M87.4 98.4L97 95.4L93.2 101.6L97.6 107.6L87.4 107Z', '#d9c493', 0.7);
      mp.shape('M12 97.6Q50 115.6 88 97.6L88 108.4Q50 126.4 12 108.4Z', '#f5ecd4', 0.75);
      defs += `<path id="${id}m" d="M15 105.4Q50 122.6 85 105.4" fill="none"/>`;
      motto = mp.out() + `<text font-size="${text.length > 12 ? 6.2 : 6.8}" letter-spacing=".5" text-anchor="middle" fill="${C.ink}" style="font-family:'IM Fell English SC','IM Fell English',Georgia,serif"><textPath href="#${id}m" startOffset="50%">${text}</textPath></text>`;
    }
    a = { body: `<defs>${defs}</defs>${field}${overlay}${charge}${shade}${op.out()}${motto}`, h };
    if (cache.size > 120) cache.delete(cache.keys().next().value as number);
    cache.set(key, a);
  }
  const s = Math.max(12, size);
  return `<svg class="ll-crest" viewBox="0 0 100 ${a.h}" width="${s}" height="${Math.round(s * a.h / 100)}" aria-hidden="true" focusable="false">${a.body}</svg>`;
}
