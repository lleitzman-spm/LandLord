/**
 * Portraits: rolling a person. Everything here is deterministic in the seed.
 * Order of authority: species archetype, then the seed's rolls, then the
 * costume for a trade / delegate / ruler / court visitor (cast.ts), then any
 * `look` hints from the content, which always win.
 */
import type { Species, TradeId, NpcId } from '../../data/ids';
import type { StaffRole, RankId } from '../../sim/types';
import { makeRand, hashStr, clamp, mixc, shadeOf, dye, type Rand } from './util';
import { PIG, SKIN, HAIR, IRIS, cloth, type HairName } from './pigments';
import type {
  Genome, HeadShape, HairStyle, BeardStyle, StacheStyle, NoseKind, BrowStyle, HatKind, Expr, Kind, Marks,
} from './types';
import { dressCommoner, dressTrade, dressRole, dressRuler, dressNpc, NPC_SEEDS } from './cast';

export interface GenomeInput {
  species: Species;
  seed: number;
  trade?: TradeId;
  role?: StaffRole | 'ruler';
  rank?: RankId;
  npc?: NpcId;
  look?: { hair?: string; beard?: boolean; hat?: string; feature?: string };
  name?: string;
}

// ───────────── heads ─────────────

type HeadRow = [skull: number, cheekTop: number, cheek: number, jaw: number, chinW: number, H: number, jawY: number, chinFlat: number];
const HUMAN_HEADS: Record<string, HeadRow> = {
  oval: [33, 33.5, 31.5, 25, 12, 92, 0.82, 0.35],
  round: [35, 37.5, 37.5, 31, 15, 86, 0.82, 0.5],
  square: [34, 34.5, 34.5, 32.5, 19, 88, 0.84, 0.85],
  long: [30, 30, 28.5, 23, 12, 99, 0.83, 0.4],
  heart: [36, 34.5, 30, 21, 9, 90, 0.8, 0.15],
  pear: [30.5, 33.5, 37.5, 35.5, 17, 90, 0.83, 0.6],
  lantern: [31.5, 31.5, 31.5, 30, 20, 97, 0.86, 0.9],
  weak: [33, 33.5, 31, 22, 8, 84, 0.78, 0.2],
  gaunt: [31, 29, 26, 21.5, 11, 96, 0.82, 0.3],
  moon: [36, 39, 40, 35, 18, 88, 0.84, 0.6],
};
function head(row: HeadRow, top: number, r: Rand, j = 0.05): HeadShape {
  const v = (x: number) => x * (1 + r.jit(j));
  return { cx: 100, top, skull: v(row[0]), cheekTop: v(row[1]), cheek: v(row[2]), jaw: v(row[3]), chinW: v(row[4]), H: v(row[5]), jawY: row[6], chinFlat: clamp(row[7] + r.jit(0.12), 0, 1) };
}

const NO_MARKS: Marks = {
  freckles: 0, wrinkles: 0, scar: 'none', mole: false, patch: false, specs: 'none', earring: 'none',
  soot: false, flour: false, inkstain: false, mud: false, quill: false, pipe: false, stalk: false, flower: false, doubleChin: false,
};

function greyed(color: string, grey: number, r: Rand): string {
  if (grey <= 0) return color;
  const target = grey > 0.8 ? HAIR.white : r.chance(0.5) ? HAIR.grey : HAIR.silver;
  return mixc(color, target, clamp(grey, 0, 1));
}

// ───────────── the roll ─────────────

export function makeGenome(inp: GenomeInput): Genome {
  let kind: Kind = inp.species;
  let seed = inp.seed | 0;
  if (inp.npc) {
    if (inp.npc === 'goblin_chief') kind = 'goblin';
    if (inp.npc === 'dragon_adjuster') kind = 'dragon';
    // court visitors are the same person every time; only the rival is rolled per reign
    if (inp.npc !== 'rival_lord') seed = NPC_SEEDS[inp.npc];
  }
  const R = makeRand(seed ^ hashStr(kind));
  const rH = R.fork('head'), rE = R.fork('eyes'), rN = R.fork('nose'), rM = R.fork('mouth'), rHair = R.fork('hair'), rS = R.fork('skin'), rK = R.fork('marks');

  const nameFem = guessFem(inp.name);
  const fem = nameFem !== 0 ? nameFem * 0.8 : R.chance(0.5) ? R.range(0.25, 1) : -R.range(0.25, 1);
  const age = Math.pow(R.range(0.04, 0.98), 1.2);
  const dir: 1 | -1 = R.chance(0.5) ? 1 : -1;
  const skin = dye(rS.pick(SKIN[kind]), rS, 0.03);

  const g: Genome = {
    kind, seed, dir, turn: R.range(0.25, 1), age, fem,
    skin, skinShade: shadeOf(skin, 0.2), blushC: mixc(skin, '#c8402f', 0.6), ink: PIG.ink,
    head: head(HUMAN_HEADS.oval, 40, rH), fscale: 1,
    ears: { kind: 'round', size: 1, y: 0 },
    eyes: { y: 0, gap: 16, w: 8.4, h: 5.6, low: 0.55, tilt: 0.5, apex: 0, iris: IRIS.brown, white: PIG.white, irisR: 4.1, pupil: 'round', lash: false, lidRest: 1, bag: 0 },
    brows: { gapY: 4.5, len: 1.1, thick: 3, arch: 1.8, slope: 0.4, style: 'taper', color: HAIR.dark, uni: false, singed: false },
    nose: { kind: 'straight', len: 17, out: 6, tip: 3.4, wide: 5.5, red: 0 }, noseY: 0,
    mouth: { y: 0, w: 11, lipU: 0.8, lipL: 1.4, teeth: 'plain', lip: '#b0604f', goldTooth: false },
    hair: { style: 'crop', color: HAIR.brown, vol: 1, part: 0, line: 0.24, grey: 0 },
    beard: { style: 'none', stache: 'none', color: HAIR.brown, len: 1, rings: false },
    marks: { ...NO_MARKS },
    hat: { kind: 'none', c: PIG.russet, c2: PIG.cream, extras: [], tilt: 0, tiny: false, variant: 0 },
    garb: { kind: 'tunic', c: PIG.russet, c2: PIG.cream, trim: PIG.cream, extras: [], shW: 74, shY: 0, neckW: 15, neckLen: 15 },
    tool: 'none', toolSide: dir === 1 ? -1 : 1,
    blush: 0.34, rest: {}, ground: 'lapis', shadowed: false,
  };

  // species archetype (sets the head, the ranges, the ears)
  SPECIES_ROLL[kind](g, { rH, rE, rN, rM, rHair, rS, rK, R });

  // layout down the face
  const hd = g.head;
  if (!g.eyes.y) g.eyes.y = hd.top + hd.H * (0.5 + rE.jit(0.02));
  g.noseY = g.eyes.y + g.nose.len;
  const chin = hd.top + hd.H;
  if (!g.mouth.y) g.mouth.y = Math.min(g.noseY + rM.range(6.5, 9.5), chin - Math.max(10.5, hd.H * 0.115));
  g.ears.y = g.ears.y || (g.eyes.y + g.noseY) / 2;

  // costume
  const rC = R.fork('cast');
  g.garb.c = cloth(rC, true); g.garb.c2 = cloth(rC); g.garb.trim = dye(PIG.cream, rC);
  if (inp.npc) dressNpc(inp.npc, g, rC);
  else if (inp.role === 'ruler') dressRuler(inp.rank ?? 'reeve', g, rC);
  else if (inp.role) dressRole(inp.role, g, rC);
  else if (inp.trade) dressTrade(inp.trade, g, rC);
  else dressCommoner(g, rC);

  if (inp.look) applyLook(g, inp.look, R.fork('look'), !!inp.npc);
  settle(g, R.fork('settle'), inp);
  return g;
}

interface Rolls { rH: Rand; rE: Rand; rN: Rand; rM: Rand; rHair: Rand; rS: Rand; rK: Rand; R: Rand }

function rollHairColor(g: Genome, r: Rand, table: readonly (readonly [HairName, number])[]): void {
  const base = dye(HAIR[r.wpick(table)], r, 0.05);
  g.hair.grey = clamp((g.age - 0.5) * 2.3 + r.jit(0.15), 0, 1);
  g.hair.color = greyed(base, g.hair.grey, r);
  g.beard.color = greyed(base, clamp(g.hair.grey * 1.15, 0, 1), r);
  g.brows.color = mixc(greyed(base, g.hair.grey * 0.6, r), PIG.ink, 0.35);
}
function rollCommon(g: Genome, x: Rolls): void {
  const { rE, rN, rM, rK } = x;
  g.eyes.gap = g.head.cheekTop * rE.range(0.43, 0.53);
  g.eyes.w = rE.range(7.2, 9.6); g.eyes.h = rE.range(4.5, 7);
  g.eyes.low = rE.range(0.42, 0.7); g.eyes.tilt = rE.range(-1.6, 2.4); g.eyes.apex = rE.range(-0.3, 0.3);
  g.eyes.irisR = g.eyes.h * rE.range(0.66, 0.8);
  g.eyes.iris = IRIS[rE.wpick([['brown', 5], ['dark', 3], ['hazel', 2], ['green', 1.5], ['blue', 2.5], ['grey', 1.5], ['amber', 0.7]] as const)];
  g.eyes.lash = g.fem > 0.3 && rE.chance(0.7);
  g.eyes.lidRest = rE.range(0.8, 1.05);
  g.eyes.bag = g.age > 0.5 ? rE.range(0, 1) * (g.age - 0.3) : rE.chance(0.12) ? 0.4 : 0;
  g.brows.gapY = rE.range(2.6, 6.5); g.brows.len = rE.range(0.95, 1.28); g.brows.arch = rE.range(0.4, 3.4);
  g.brows.slope = rE.range(-1.4, 2); g.brows.thick = rE.range(2, 4.6) * (g.fem > 0.3 ? 0.78 : 1);
  g.brows.style = rE.wpick<BrowStyle>([['taper', 5], ['arch', 3], ['flat', 2], ['thin', g.fem > 0 ? 3 : 1], ['bushy', g.fem > 0.3 ? 0.4 : 2 + g.age * 3], ['wing', g.age > 0.6 && g.fem < 0.3 ? 1.5 : 0.1]]);
  g.brows.uni = g.fem < 0 && rE.chance(0.07);
  const nk = rN.wpick<NoseKind>([['button', 2], ['snub', 3], ['straight', 4], ['roman', 3], ['bulb', 2.5], ['potato', 2], ['pointed', 2], ['broken', 1], ['broad', 1.5], ['droop', 0.6 + g.age * 2]]);
  setNose(g, nk, rN);
  g.mouth.w = rM.range(8.5, 13.5);
  g.mouth.lipU = Math.max(0, rM.range(-0.4, 1.8) + (g.fem > 0.3 ? 0.6 : 0)); g.mouth.lipL = Math.max(0, rM.range(0.2, 2.6) + (g.fem > 0.3 ? 0.6 : 0));
  g.mouth.lip = mixc(g.skin, '#a8402f', rM.range(0.3, 0.5));
  g.mouth.teeth = rM.wpick([['plain', 8], ['gap', 1.4], ['buck', 0.8], ['snag', 0.3]] as const);
  g.marks.wrinkles = clamp((g.age - 0.42) * 2 + rK.jit(0.15), 0, 1);
  g.marks.freckles = rK.chance(0.16) ? rK.range(0.4, 1) : 0;
  g.marks.mole = rK.chance(0.1);
  g.marks.scar = rK.chance(0.05) ? rK.pick(['cheek', 'brow', 'lip'] as const) : 'none';
  g.marks.doubleChin = g.head.cheek > 36.5 && rK.chance(0.6);
  g.rest = { smile: rK.range(-0.25, 0.3), browIn: rK.jit(0.8), skew: rK.chance(0.2) ? rK.jit(0.35) : 0 };
  g.blush = rK.range(0.22, 0.5);
}
export function setNose(g: Genome, kind: NoseKind, r: Rand): void {
  const T: Record<NoseKind, [len: [number, number], out: [number, number], tip: [number, number], wide: [number, number]]> = {
    button: [[9.5, 12], [1.5, 3.5], [2.6, 3.6], [4, 5.2]],
    snub: [[11, 14.5], [3, 5.5], [2.8, 3.8], [4.4, 5.8]],
    straight: [[15, 21], [4.5, 7.5], [2.8, 3.8], [4.6, 6]],
    roman: [[17, 23], [6.5, 10.5], [3, 4.2], [5, 6.5]],
    bulb: [[13, 17], [3.5, 6], [4.8, 6.8], [5.5, 7.5]],
    potato: [[14, 18.5], [3, 5.5], [4.4, 6], [7, 9]],
    pointed: [[16, 24], [7, 12], [2, 2.8], [4.2, 5.4]],
    broken: [[15, 20], [4.5, 7.5], [3.2, 4.2], [5.2, 6.8]],
    broad: [[12, 16], [2, 4], [3.6, 4.8], [7.5, 9.5]],
    droop: [[18, 25], [5.5, 9], [3.6, 5], [5, 6.5]],
    snout: [[12, 14], [0, 0], [3, 3], [8, 9]],
  };
  const t = T[kind];
  g.nose = { kind, len: r.range(t[0][0], t[0][1]), out: r.range(t[1][0], t[1][1]), tip: r.range(t[2][0], t[2][1]), wide: r.range(t[3][0], t[3][1]), red: g.nose.red };
}
function rollBeard(g: Genome, r: Rand, p: number): void {
  if (g.fem > 0.15 || !r.chance(p)) { g.beard.style = 'none'; g.beard.stache = 'none'; return; }
  g.beard.style = r.wpick<BeardStyle>([['none', 2.2], ['stubble', 2], ['goatee', 1.4], ['chinstrap', 0.8], ['short', 3], ['long', 1 + g.age * 2], ['forked', 0.5], ['chops', 0.9], ['spade', 0.8]]);
  const full = g.beard.style === 'short' || g.beard.style === 'long' || g.beard.style === 'forked' || g.beard.style === 'spade';
  g.beard.stache = full ? r.wpick<StacheStyle>([['walrus', 2], ['chevron', 3], ['handlebar', 1]]) : g.beard.style === 'none'
    ? r.wpick<StacheStyle>([['walrus', 2], ['handlebar', 2], ['pencil', 1.5], ['chevron', 2], ['droop', 1.5]])
    : r.wpick<StacheStyle>([['none', 3], ['chevron', 2], ['pencil', 1], ['handlebar', 1], ['droop', 0.8]]);
  g.beard.len = r.range(0.75, 1.3);
}

const SPECIES_ROLL: Record<Kind, (g: Genome, x: Rolls) => void> = {
  human(g, x) {
    const { rH, rHair, R } = x;
    const shape = rH.wpick([['oval', 4], ['round', 3], ['square', 2.6], ['long', 2.6], ['heart', 2], ['pear', 2], ['lantern', 1.4], ['weak', 1.4], ['gaunt', 1.2 + g.age], ['moon', 1.2]] as const);
    g.head = head(HUMAN_HEADS[shape], 40 + rH.jit(2), rH);
    if (g.fem > 0.3) { g.head.jaw *= 0.94; g.head.chinW *= 0.9; }
    rollCommon(g, x);
    rollHairColor(g, rHair, [['black', 2], ['dark', 4], ['brown', 4], ['chestnut', 2], ['auburn', 1.2], ['red', 1], ['ginger', 0.8], ['blond', 1.6], ['straw', 1], ['dun', 1.5]]);
    const old = g.age > 0.6 ? 1 : 0;
    g.hair.style = g.fem > 0.15
      ? rHair.wpick<HairStyle>([['long', 4], ['wavy', 3.5], ['braids', 4], ['bun', 3 + old * 2], ['crownbraid', 2.5], ['curly', 2], ['bowl', 0.6], ['shaggy', 1.2], ['crop', 0.6], ['wispy', old * 1.5]])
      : rHair.wpick<HairStyle>([['crop', 3.5], ['bowl', 3], ['pageboy', 2.5], ['shaggy', 3], ['curly', 2], ['long', 1.4], ['bald', 0.8 + g.age * 3], ['horseshoe', g.age * 4], ['tonsure', 0.4], ['wispy', old * 2], ['widow', 0.9], ['wild', 0.6]]);
    g.hair.vol = rHair.range(0.8, 1.25); g.hair.part = rHair.pick([-1, 0, 1] as const); g.hair.line = rHair.range(0.19, 0.3) + (g.fem < 0 ? g.age * 0.05 : 0);
    rollBeard(g, rHair, 0.6);
    g.garb.shW = R.range(66, 84) * (g.fem > 0.3 ? 0.93 : 1); g.garb.neckW = g.head.jaw * R.range(0.5, 0.62); g.garb.neckLen = R.range(12, 18);
  },
  halfling(g, x) {
    const { rH, rE, rN, rHair, rK, R } = x;
    const row = rH.pick([[34.5, 37.5, 38.5, 31.5, 15, 79, 0.82, 0.5], [33, 36, 36.5, 28, 13, 80, 0.81, 0.35], [35.5, 38.5, 40, 34, 16, 77, 0.83, 0.55], [32.5, 35, 36, 30, 16, 82, 0.83, 0.6]] as HeadRow[]);
    g.head = head(row, 54 + rH.jit(2), rH, 0.04);
    rollCommon(g, x);
    g.eyes.w = rE.range(8.4, 10.4); g.eyes.h = rE.range(6.2, 8); g.eyes.irisR = g.eyes.h * 0.76; g.eyes.lidRest = rE.range(0.92, 1.08);
    g.eyes.gap = g.head.cheekTop * rE.range(0.44, 0.5);
    setNose(g, rN.wpick<NoseKind>([['button', 4], ['snub', 3], ['bulb', 2], ['potato', 1]]), rN);
    g.nose.len *= 0.92;
    g.brows.thick *= 0.9; g.brows.gapY = rE.range(3.5, 6.5);
    rollHairColor(g, rHair, [['dark', 2], ['brown', 4], ['chestnut', 4], ['auburn', 2], ['red', 1.5], ['ginger', 2], ['blond', 2], ['straw', 2], ['dun', 1]]);
    g.hair.style = g.fem > 0.15
      ? rHair.wpick<HairStyle>([['curly', 6], ['bun', 2], ['braids', 2.5], ['wavy', 2], ['crownbraid', 1.5]])
      : rHair.wpick<HairStyle>([['curly', 7], ['shaggy', 2], ['bowl', 1], ['horseshoe', g.age * 2]]);
    g.hair.vol = rHair.range(1, 1.35); g.hair.line = rHair.range(0.2, 0.27);
    g.beard.style = g.fem < -0.2 && rHair.chance(0.28) ? 'chops' : 'none'; g.beard.stache = 'none';
    g.ears = { kind: 'leaf', size: rH.range(1.05, 1.3), y: 0 };
    g.marks.freckles = rK.chance(0.45) ? rK.range(0.4, 1) : 0;
    g.blush = rK.range(0.5, 0.72);
    g.rest = { smile: rK.range(0.05, 0.4), browIn: rK.range(0, 0.8) };
    g.garb.shW = R.range(54, 62); g.garb.neckW = g.head.jaw * 0.5; g.garb.neckLen = R.range(8, 11);
  },
  dwarf(g, x) {
    const { rH, rE, rN, rHair, rK, R } = x;
    const row = rH.pick([[37, 39, 40, 38, 24, 84, 0.85, 0.9], [36, 38.5, 39, 35, 22, 86, 0.84, 0.8], [38.5, 40.5, 42, 40, 25, 82, 0.86, 0.9], [35, 37, 39.5, 37.5, 22, 88, 0.85, 0.85]] as HeadRow[]);
    g.head = head(row, 47 + rH.jit(2), rH, 0.04);
    rollCommon(g, x);
    g.eyes.w = rE.range(6.8, 8.2); g.eyes.h = rE.range(4, 5.4); g.eyes.irisR = g.eyes.h * 0.78; g.eyes.gap = g.head.cheekTop * rE.range(0.4, 0.47);
    g.eyes.bag = Math.max(g.eyes.bag, rE.range(0.2, 0.7)); g.eyes.lidRest = rE.range(0.78, 0.95);
    g.eyes.y = g.head.top + g.head.H * 0.47;
    g.brows.style = rE.wpick<BrowStyle>([['bushy', 6], ['taper', 2], ['wing', 1.5], ['flat', 1.5]]);
    g.brows.thick = rE.range(4.2, 6); g.brows.gapY = rE.range(1.2, 3); g.brows.len = rE.range(1.15, 1.35); g.brows.arch = rE.range(0.2, 1.6);
    g.brows.uni = rE.chance(0.2);
    setNose(g, rN.wpick<NoseKind>([['bulb', 3], ['potato', 3], ['broad', 2], ['roman', 2], ['broken', 1.2]]), rN);
    g.nose.tip *= 1.15; g.nose.wide *= 1.1;
    rollHairColor(g, rHair, [['black', 2.5], ['dark', 3], ['brown', 2], ['chestnut', 2], ['auburn', 2], ['red', 3], ['ginger', 3], ['dun', 1], ['blond', 1]]);
    g.hair.style = rHair.wpick<HairStyle>([['braids', 4], ['long', 3], ['bald', 2 + g.age * 2], ['topknot', 2], ['horseshoe', 1 + g.age * 2], ['shaggy', 2], ['crownbraid', 1.5]]);
    g.hair.vol = rHair.range(1, 1.3); g.hair.line = rHair.range(0.2, 0.28);
    g.beard.style = rHair.wpick<BeardStyle>([['braided', 5], ['long', 3], ['forked', 2.5], ['spade', 2.5]]);
    g.beard.stache = rHair.wpick<StacheStyle>([['walrus', 4], ['handlebar', 2], ['droop', 2]]);
    g.beard.len = rHair.range(1, 1.35); g.beard.rings = rHair.chance(0.7);
    g.marks.wrinkles = Math.max(g.marks.wrinkles, 0.25); g.marks.freckles = 0; g.marks.doubleChin = false;
    g.blush = rK.range(0.35, 0.55);
    g.rest = { smile: rK.range(-0.3, 0.05), browIn: rK.range(-1.3, -0.2) };
    g.garb.shW = R.range(88, 100); g.garb.neckW = g.head.jaw * 0.74; g.garb.neckLen = R.range(4, 7);
  },
  goblin(g, x) {
    const { rH, rE, rN, rM, rHair, rK, R } = x;
    const row = rH.pick([[38, 38, 31, 20.5, 8, 78, 0.8, 0.15], [36, 37, 32, 23, 10, 80, 0.8, 0.25], [40, 39.5, 31, 19, 7.5, 75, 0.79, 0.1], [36.5, 36, 30, 22, 11, 82, 0.81, 0.3]] as HeadRow[]);
    g.head = head(row, 52 + rH.jit(2), rH, 0.04);
    rollCommon(g, x);
    g.fscale = 1.08;
    g.eyes.w = rE.range(9.4, 11.6); g.eyes.h = rE.range(7, 9); g.eyes.gap = g.head.cheekTop * rE.range(0.44, 0.5);
    g.eyes.white = rE.pick(['#f6e06a', '#fbe58a', '#f2d24e', '#eef0a0', '#ffd98a']);
    g.eyes.iris = rE.pick([IRIS.amber, IRIS.red, IRIS.dark, '#d2691e', '#4a5d23']);
    g.eyes.irisR = g.eyes.h * rE.range(0.4, 0.52); g.eyes.pupil = rE.chance(0.4) ? 'slit' : 'dot';
    g.eyes.lidRest = rE.range(0.95, 1.12); g.eyes.tilt = rE.range(0.5, 3); g.eyes.lash = false; g.eyes.bag = 0;
    g.eyes.y = g.head.top + g.head.H * 0.5;
    g.brows.style = rE.wpick<BrowStyle>([['thin', 4], ['taper', 2], ['arch', 2], ['ridge', 2]]);
    g.brows.thick = rE.range(1.8, 3); g.brows.gapY = rE.range(2.5, 5); g.brows.color = mixc(g.skin, PIG.ink, 0.7); g.brows.uni = false;
    setNose(g, rN.wpick<NoseKind>([['pointed', 4], ['button', 2], ['droop', 2], ['snub', 1.5], ['roman', 1]]), rN);
    g.nose.len = rN.range(9, 15); g.nose.wide *= 0.85;
    g.mouth.w = rM.range(16, 21); g.mouth.teeth = 'goblin'; g.mouth.lipU = 0; g.mouth.lipL = 0;
    g.mouth.lip = mixc(g.skin, '#4b5a2a', 0.5);
    g.hair.color = dye(rHair.pick([HAIR.black, HAIR.dark, HAIR.white, HAIR.grey, '#3d4a2a']), rHair);
    g.beard.color = g.hair.color;
    g.hair.style = rHair.wpick<HairStyle>([['bald', 5], ['tuft', 3], ['wispy', 2], ['topknot', 1.5], ['horseshoe', g.age * 2]]);
    g.beard.style = g.age > 0.6 && rHair.chance(0.25) ? 'goatee' : 'none'; g.beard.stache = 'none';
    g.ears = { kind: 'goblin', size: rH.range(0.85, 1.25), y: 0 };
    g.marks.freckles = rK.chance(0.2) ? 0.6 : 0; g.marks.wrinkles *= 0.6; g.marks.doubleChin = false;
    g.marks.specs = rK.chance(0.3) ? rK.pick(['round', 'pince', 'tiny'] as const) : 'none';
    g.marks.quill = rK.chance(0.25); g.marks.earring = rK.chance(0.3) ? 'ring' : 'none';
    g.blushC = mixc(g.skin, '#d98a4a', 0.5); g.blush = rK.range(0.2, 0.4); g.skinShade = shadeOf(mixc(g.skin, '#3f6a3a', 0.25), 0.2);
    g.rest = { smile: rK.range(0.15, 0.45), open: rK.range(0.1, 0.2), teeth: 1, browIn: rK.range(-0.6, 0.6) };
    g.garb.shW = R.range(50, 58); g.garb.neckW = g.head.jaw * 0.55; g.garb.neckLen = R.range(9, 13);
  },
  elf(g, x) {
    const { rH, rE, rN, rM, rHair, rK, R } = x;
    const row = rH.pick([[30, 29, 26.5, 19, 9, 100, 0.81, 0.2], [31, 30, 27, 20.5, 10, 97, 0.82, 0.3], [29, 28.5, 25.5, 18.5, 8.5, 103, 0.81, 0.15], [30.5, 30, 28, 22, 11, 99, 0.83, 0.35]] as HeadRow[]);
    g.head = head(row, 33 + rH.jit(1.5), rH, 0.03);
    rollCommon(g, x);
    g.age = Math.min(g.age, 0.5); g.marks.wrinkles = 0; g.marks.freckles = rK.chance(0.1) ? 0.4 : 0; g.marks.doubleChin = false; g.marks.scar = 'none';
    g.eyes.w = rE.range(8.4, 9.8); g.eyes.h = rE.range(5.2, 6.4); g.eyes.tilt = rE.range(1.8, 3.6); g.eyes.lidRest = rE.range(0.58, 0.72);
    g.eyes.iris = rE.pick([IRIS.violet, IRIS.silverI, IRIS.ice, IRIS.goldI, IRIS.green, IRIS.grey]); g.eyes.irisR = g.eyes.h * 0.8;
    g.eyes.lash = rE.chance(0.6); g.eyes.bag = 0; g.eyes.gap = g.head.cheekTop * rE.range(0.47, 0.54);
    g.brows.style = rE.wpick<BrowStyle>([['thin', 5], ['arch', 3]]); g.brows.thick = rE.range(1.6, 2.4); g.brows.arch = rE.range(2.2, 4); g.brows.gapY = rE.range(4.5, 7.5); g.brows.slope = rE.range(-2.4, -0.6); g.brows.uni = false;
    setNose(g, rN.wpick<NoseKind>([['straight', 5], ['pointed', 2], ['roman', 1.5], ['snub', 1]]), rN);
    g.nose.wide *= 0.8; g.nose.tip *= 0.85;
    g.mouth.w = rM.range(8, 10.5); g.mouth.teeth = 'plain';
    rollHairColor(g, rHair, [['silver', 4], ['white', 2], ['straw', 3], ['blond', 2], ['black', 2.5], ['auburn', 1.5], ['dark', 1]]);
    g.hair.grey = 0;
    g.hair.style = rHair.wpick<HairStyle>([['long', 6], ['wavy', 2.5], ['braids', 2.5], ['crownbraid', 1.5], ['widow', 1.5]]);
    g.hair.vol = rHair.range(0.8, 1); g.hair.line = rHair.range(0.17, 0.23);
    g.beard.style = 'none'; g.beard.stache = 'none';
    g.ears = { kind: 'elf', size: rH.range(0.9, 1.25), y: 0 };
    g.blush = rK.range(0.1, 0.24);
    g.rest = { smile: rK.range(-0.08, 0.16), browIn: rK.range(0.2, 1), browOut: rK.range(0, 0.8), tilt: -1.2 };
    g.garb.shW = R.range(62, 72); g.garb.neckW = g.head.jaw * 0.62; g.garb.neckLen = R.range(20, 25);
  },
  ogre(g, x) {
    const { rH, rE, rN, rM, rHair, rK, R } = x;
    const row = rH.pick([[50, 54, 56, 50, 30, 96, 0.84, 0.8], [47, 52, 55, 51, 31, 99, 0.85, 0.85], [52, 55, 55, 47, 27, 94, 0.83, 0.7], [48, 53, 57.5, 53, 32, 97, 0.85, 0.9]] as HeadRow[]);
    g.head = head(row, 44 + rH.jit(2), rH, 0.03);
    rollCommon(g, x);
    g.fscale = 0.9;
    g.eyes.w = rE.range(5.4, 6.8); g.eyes.h = rE.range(4.4, 5.6); g.eyes.gap = rE.range(12.5, 16); g.eyes.irisR = g.eyes.h * 0.84;
    g.eyes.iris = rE.pick([IRIS.dark, IRIS.brown, '#4a4a3a']); g.eyes.lidRest = rE.range(0.9, 1.05); g.eyes.tilt = rE.range(-1.8, -0.4); g.eyes.lash = false; g.eyes.bag = 0;
    g.eyes.y = g.head.top + g.head.H * rE.range(0.44, 0.49);
    g.brows.style = rE.wpick<BrowStyle>([['flat', 3], ['taper', 2], ['bushy', 2]]); g.brows.thick = rE.range(2.6, 4); g.brows.len = rE.range(1.2, 1.5); g.brows.gapY = rE.range(3, 5.5); g.brows.arch = rE.range(0.2, 1.2); g.brows.slope = rE.range(0.8, 2.4);
    g.brows.color = mixc(g.skin, PIG.ink, 0.72); g.brows.uni = false;
    setNose(g, rN.wpick<NoseKind>([['broad', 4], ['button', 3], ['potato', 2]]), rN);
    g.nose.len = rN.range(9, 12.5);
    g.mouth.w = rM.range(13, 18); g.mouth.teeth = 'tusks'; g.mouth.lipU = 0; g.mouth.lipL = rM.range(1.6, 2.6); g.mouth.lip = mixc(g.skin, '#6b5a5a', 0.45);
    g.hair.color = dye(rHair.pick([HAIR.black, HAIR.dark, HAIR.grey, '#5a5a4a']), rHair); g.beard.color = g.hair.color;
    g.hair.style = rHair.wpick<HairStyle>([['bald', 5], ['tuft', 3], ['wispy', 2], ['topknot', 1]]);
    g.beard.style = rHair.chance(0.15) ? 'stubble' : 'none'; g.beard.stache = 'none';
    g.ears = { kind: 'small', size: rH.range(0.9, 1.2), y: 0 };
    g.marks.freckles = 0; g.marks.wrinkles *= 0.4; g.marks.doubleChin = rK.chance(0.4); g.marks.mole = rK.chance(0.25);
    g.blushC = mixc(g.skin, '#c98a8a', 0.55); g.blush = rK.range(0.3, 0.5); g.skinShade = shadeOf(mixc(g.skin, '#4a6a6a', 0.2), 0.2);
    g.rest = { smile: rK.range(0, 0.3), browIn: rK.range(1, 2.2), browOut: rK.range(-0.8, 0) };
    g.garb.shW = R.range(118, 132); g.garb.neckW = g.head.jaw * 0.86; g.garb.neckLen = 2;
  },
  dragon(g, x) {
    const { rE } = x;
    // a small dragon: the drawing is its own (dragon.ts); these numbers place the shared eyes, brows and mouth on it
    g.dir = 1; g.turn = 0; g.age = 0.3; g.fem = 0;
    g.head = { cx: 100, top: 56, H: 78, skull: 31, cheekTop: 35, cheek: 37, jaw: 30, chinW: 20, jawY: 0.84, chinFlat: 0.9 };
    g.skin = '#b9502e'; g.skinShade = '#8f3a24'; g.blushC = '#d9774a'; g.blush = 0.3;
    g.eyes = { y: 88, gap: 17.5, w: 9.6, h: 7.6, low: 0.5, tilt: 2.2, apex: 0.1, iris: '#c9871f', white: '#f6e07a', irisR: 4.4, pupil: 'slit', lash: false, lidRest: 0.92, bag: 0 };
    g.brows = { gapY: 2.4, len: 1.15, thick: 3.6, arch: 1.4, slope: -1, style: 'ridge', color: '#7a2f1e', uni: false, singed: false };
    g.nose = { kind: 'snout', len: 13, out: 0, tip: 3, wide: 8.5, red: 0 }; g.noseY = 108;
    g.mouth = { y: 122, w: 15.5, lipU: 0, lipL: 0, teeth: 'fangs', lip: '#8f3a24', goldTooth: false };
    g.hair.style = 'bald'; g.beard.style = 'none'; g.beard.stache = 'none'; g.ears = { kind: 'none', size: 1, y: 0 };
    g.marks.specs = 'halfmoon';
    g.rest = { browIn: 1.6, browOut: -0.6, smile: -0.05, lid: 0.95 };
    g.garb.shW = 46; g.garb.neckW = 15; g.garb.neckLen = 12;
    void rE;
  },
};

// ───────────── look hints ─────────────

const HAIR_WORDS: [RegExp, HairName][] = [
  [/black|raven|jet/, 'black'], [/dark/, 'dark'], [/chestnut/, 'chestnut'], [/auburn/, 'auburn'], [/ginger|copper|carrot|orange/, 'ginger'],
  [/\bred\b|russet|fiery|flame/, 'red'], [/blond|fair|golden|yellow|flaxen/, 'blond'], [/straw|sandy|tow/, 'straw'], [/mous|dun/, 'dun'],
  [/silver/, 'silver'], [/white|snow/, 'white'], [/gr[ae]y|iron|salt/, 'grey'], [/brown/, 'brown'],
  [/green|moss/, 'green'], [/blue/, 'blue'], [/pink/, 'pink'], [/purple|violet/, 'purple'],
];
const STYLE_WORDS: [RegExp, HairStyle][] = [
  [/balding|receding|horseshoe|thinning/, 'horseshoe'], [/bald|shaven|shaved|hairless|no hair/, 'bald'], [/tonsure/, 'tonsure'],
  [/bowl|pudding/, 'bowl'], [/page ?boy|bob/, 'pageboy'], [/crop|short|close/, 'crop'], [/crown braid|coiled|coronet of/, 'crownbraid'],
  [/braid|plait|pigtail/, 'braids'], [/curl|ringlet|frizz/, 'curly'], [/bun|pinned|tied back|knot at/, 'bun'], [/top ?knot/, 'topknot'],
  [/wild|mad|untidy|unkempt|birds? ?nest|explod|singed|haystack/, 'wild'], [/wisp|thin|sparse|strand/, 'wispy'], [/tuft|mohawk|crest/, 'tuft'],
  [/shag|messy|tousl|mop/, 'shaggy'], [/widow|slick|oiled|swept/, 'widow'], [/wav/, 'wavy'], [/long|flowing|waist|straight/, 'long'],
];
const HAT_WORDS: [RegExp, HatKind][] = [
  [/none|bare|hatless|no hat/, 'none'], [/straw/, 'straw'], [/wimple|veil/, 'wimple'], [/judge|bench/, 'judgecap'], [/coif|bonnet|nightcap|linen cap/, 'coif'],
  [/kerchief|scarf|headscarf|bandana|headcloth|rag/, 'kerchief'], [/deep hood|cowl(ed)? low|shadow/, 'deephood'], [/hood|cowl/, 'hood'],
  [/witch/, 'witch'], [/pointed|pointy|wizard|conical|steeple/, 'pointed'], [/chaperon|rolled|turban/, 'chaperon'],
  [/feather|plume|bycocket|archer/, 'bycocket'], [/beret|flat cap|floppy|scholar|velvet cap/, 'beret'], [/kettle|iron hat|helmet|helm/, 'kettle'],
  [/visor|bascinet/, 'bascinet'], [/mail/, 'mailcoif'], [/ducal|strawberry/, 'ducal'], [/crown/, 'crown'], [/coronet/, 'coronet'], [/leaf ?band|elven band|silver band/, 'leafband'], [/circlet|diadem|tiara/, 'circlet'],
  [/mitre|miter/, 'mitre'], [/wreath|garland|flowers|daisy|leaves/, 'wreath'], [/skull ?cap|calotte/, 'skullcap'], [/toque|baker/, 'toque'],
  [/knit|wool(len|ly)? (cap|hat)|bobble/, 'knit'], [/head ?band|bandeau/, 'headband'], [/wide|brim|slouch|felt hat|pilgrim/, 'widebrim'],
  [/paper|parchment|folded/, 'paperhat'], [/skep|beehive/, 'skep'], [/cap|hat/, 'cap'],
];

/** hats of one family are near enough that a designed look should not be traded for a guessed one */
const HAT_FAMILY: Record<HatKind, number> = {
  none: 0, hood: 1, deephood: 1, coif: 1, wimple: 1, kerchief: 1, mailcoif: 2, kettle: 2, bascinet: 2,
  circlet: 3, coronet: 3, ducal: 3, crown: 3, leafband: 3, headband: 3, straw: 4, widebrim: 4, bycocket: 4, pointed: 5, witch: 5,
  cap: 6, beret: 6, chaperon: 6, skullcap: 6, knit: 6, toque: 6, judgecap: 6, mitre: 7, wreath: 8, skep: 9, paperhat: 10,
};

export function applyLook(g: Genome, look: NonNullable<GenomeInput['look']>, r: Rand, fixed = false): void {
  if (g.kind === 'dragon') return;
  const hair = (look.hair ?? '').toLowerCase();
  const feat = (look.feature ?? '').toLowerCase();
  const hat = (look.hat ?? '').toLowerCase();
  const all = hair + ' ' + feat;
  if (hair) {
    for (const [re, name] of HAIR_WORDS) if (re.test(hair)) {
      g.hair.color = dye(HAIR[name], r, 0.03); g.hair.grey = name === 'grey' || name === 'silver' || name === 'white' ? 1 : 0;
      g.beard.color = g.hair.color; g.brows.color = mixc(g.hair.color, PIG.ink, name === 'white' || name === 'silver' ? 0.2 : 0.35);
      break;
    }
    for (const [re, style] of STYLE_WORDS) if (re.test(hair)) { g.hair.style = style; break; }
    if (/streak|greying|graying|flecked/.test(hair)) g.hair.color = mixc(g.hair.color, HAIR.grey, 0.4);
  }
  if (hat) {
    for (const [re, kind] of HAT_WORDS) if (re.test(hat)) {
      // a visitor to court keeps the hat they are known by unless the hint names a different sort altogether
      if (fixed && g.hat.kind !== 'none' && (kind === 'cap' || HAT_FAMILY[kind] === HAT_FAMILY[g.hat.kind])) break;
      if (kind !== g.hat.kind) {
        g.hat.kind = kind; g.hat.extras = g.hat.extras.filter(e => e === 'dust' || e === 'badge');
        // the stuff such a hat is usually made of
        const stuff: Partial<Record<HatKind, [string, string]>> = {
          coif: [PIG.linen, PIG.cream], wimple: [PIG.linen, cloth(r)], judgecap: [PIG.linen, PIG.madder], toque: [PIG.flour, PIG.linen],
          kettle: [PIG.steel, PIG.steelDark], bascinet: [PIG.steel, PIG.madder], mailcoif: [PIG.steel, PIG.steelDark],
          circlet: [PIG.gold, PIG.madder], coronet: [PIG.gold, PIG.madder], ducal: [PIG.gold, PIG.madder], crown: [PIG.gold, PIG.madder],
          straw: [PIG.straw, PIG.russet], skep: [PIG.straw, PIG.strawDark], mitre: [PIG.linen, PIG.gold], paperhat: [PIG.parch, PIG.rubric],
          leafband: [PIG.silver, PIG.cream], wreath: [PIG.green, PIG.cream], deephood: ['#2f2c35', '#1f1d25'],
        };
        const st = stuff[kind];
        if (st) { g.hat.c = dye(st[0], r, 0.02); g.hat.c2 = st[1]; }
        else if (kind !== 'none') { g.hat.c = cloth(r, kind === 'hood' || kind === 'cap' || kind === 'knit' || kind === 'widebrim'); g.hat.c2 = PIG.cream; }
      }
      break;
    }
    if (/feather|plume/.test(hat) && !g.hat.extras.includes('feather')) g.hat.extras.push('feather');
    if (/flower|daisy/.test(hat) && !g.hat.extras.includes('flowers')) g.hat.extras.push('flowers');
    if (/star|moon/.test(hat) && !g.hat.extras.includes('stars')) g.hat.extras.push('stars');
    if (/tiny|too small|small/.test(hat)) g.hat.tiny = true;
    if (/patch|mended|darned/.test(hat) && !g.hat.extras.includes('patch')) g.hat.extras.push('patch');
    if (/ribbon|\bbow\b/.test(hat) && !g.hat.extras.includes('bow')) g.hat.extras.push('bow');
    for (const [re, name] of [[/red|scarlet|crimson/, PIG.madder], [/blue/, PIG.woad], [/green/, PIG.green], [/black/, PIG.black], [/white/, PIG.linen], [/yellow|gold/, PIG.weld], [/purple|plum/, PIG.plum], [/brown/, PIG.brown], [/grey|gray/, PIG.grey]] as [RegExp, string][]) {
      if (re.test(hat)) { g.hat.c = dye(name, r, 0.03); break; }
    }
  }
  if (look.beard === true) {
    if (g.beard.style === 'none' || g.beard.style === 'stubble') {
      g.beard.style = /braid/.test(all) ? 'braided' : /fork/.test(all) ? 'forked' : /long|great|vast|magnificent|enormous/.test(all) ? 'long' : /goatee|pointed|tuft/.test(all) ? 'goatee' : r.wpick<BeardStyle>([['short', 3], ['long', 2], ['spade', 1.5], ['forked', 0.6]]);
      if (g.beard.stache === 'none') g.beard.stache = r.pick(['chevron', 'walrus'] as const);
    }
  } else if (look.beard === false) { g.beard.style = 'none'; g.beard.stache = 'none'; }
  if (/moustache|mustache|whisker/.test(all) && g.beard.stache === 'none') g.beard.stache = /handlebar|waxed|curl/.test(all) ? 'handlebar' : /droop|long/.test(all) ? 'droop' : /thin|pencil/.test(all) ? 'pencil' : 'walrus';
  if (/stubble|unshaven/.test(all) && g.beard.style === 'none') g.beard.style = 'stubble';
  if (/sideburn|mutton|chops/.test(all)) g.beard.style = 'chops';
  if (/goatee/.test(all)) g.beard.style = 'goatee';
  if (!feat) return;
  const m = g.marks;
  if (/eye ?patch|one eye|one-eyed/.test(feat)) m.patch = true;
  if (/scar/.test(feat)) m.scar = /brow|eye/.test(feat) ? 'brow' : /lip|mouth/.test(feat) ? 'lip' : 'cheek';
  if (/freckle/.test(feat)) m.freckles = 1;
  if (/monocle/.test(feat)) m.specs = 'monocle';
  else if (/pince|half.?moon|nose.?glass|tiny spec|small spec|tiny glass/.test(feat)) m.specs = /half/.test(feat) ? 'halfmoon' : /tiny|small/.test(feat) ? 'tiny' : 'pince';
  else if (/spectacle|glasses|lenses/.test(feat)) m.specs = 'round';
  if (/mole|wart|beauty spot/.test(feat)) m.mole = true;
  if (/earring|ear ring|hoop/.test(feat)) m.earring = /hoop/.test(feat) ? 'hoops' : 'ring';
  if (/soot|ash|smudge|singed|scorch/.test(feat)) m.soot = true;
  if (/singed|scorch|missing eyebrow|one eyebrow|no eyebrow/.test(feat)) g.brows.singed = true;
  if (/flour|dust/.test(feat)) m.flour = true;
  if (/ink/.test(feat)) m.inkstain = true;
  if (/mud|grime|dirt/.test(feat)) m.mud = true;
  if (/quill|pen behind/.test(feat)) m.quill = true;
  if (/pipe/.test(feat)) m.pipe = true;
  if (/straw|stalk|chewing/.test(feat)) m.stalk = true;
  if (/flower|daisy|blossom/.test(feat)) m.flower = true;
  if (/double chin|jowl|chins/.test(feat)) m.doubleChin = true;
  if (/wrinkl|lined|ancient|elderly|\bold\b|weather|crow.?s feet|wizened/.test(feat)) m.wrinkles = Math.max(m.wrinkles, 0.8);
  if (/young|smooth|boyish|girlish|fresh/.test(feat)) m.wrinkles = 0;
  if (/rosy|ruddy|red.?cheek|apple|flushed/.test(feat)) g.blush = 0.7;
  if (/pale|pallid|wan|ashen/.test(feat)) { g.blush = 0.08; g.skin = mixc(g.skin, '#efe6d6', 0.3); g.skinShade = shadeOf(g.skin, 0.2); }
  if (/nose/.test(feat)) {
    const kind: NoseKind | null = /hook|beak|roman|aquiline|hawk/.test(feat) ? 'roman' : /broken|crooked|bent/.test(feat) ? 'broken' : /button|small|tiny/.test(feat) ? 'button'
      : /snub|upturn|turned.?up/.test(feat) ? 'snub' : /point|sharp|long|thin/.test(feat) ? 'pointed' : /red|bulb|round|big|large|huge|enormous|great/.test(feat) ? 'bulb' : /flat|broad|wide/.test(feat) ? 'broad' : null;
    if (kind) setNose(g, kind, r);
    if (/big|large|huge|enormous|great|magnificent|vast/.test(feat)) { g.nose.len *= 1.15; g.nose.tip *= 1.25; g.nose.out *= 1.2; }
    if (/red|drinker/.test(feat)) g.nose.red = 0.8;
    g.noseY = g.eyes.y + g.nose.len;
    g.mouth.y = Math.min(Math.max(g.mouth.y, g.noseY + 6.5), g.head.top + g.head.H - 10.5);
  }
  if (/brow/.test(feat)) {
    if (/bush|shaggy|thick|heavy|great|magnificent|enormous|wild|beetl/.test(feat)) { g.brows.style = /magnificent|enormous|wild|great/.test(feat) ? 'wing' : 'bushy'; g.brows.thick = Math.max(g.brows.thick, 4.6); }
    if (/thin|plucked|fine|pencil/.test(feat)) { g.brows.style = 'thin'; g.brows.thick = 1.8; }
    if (/unibrow|monobrow|single|one long/.test(feat)) g.brows.uni = true;
    if (/raised|arched|cocked|quizzical|sceptic|skeptic/.test(feat)) g.rest = { ...g.rest, browSkew: 1.8 };
  }
  if (/unibrow|monobrow/.test(feat)) g.brows.uni = true;
  if (/gap.?tooth|gap in/.test(feat)) g.mouth.teeth = 'gap';
  if (/buck|rabbit|front teeth/.test(feat)) g.mouth.teeth = 'buck';
  if (/snaggle|one tooth|single tooth/.test(feat)) g.mouth.teeth = 'snag';
  if (/gold tooth|golden tooth/.test(feat)) g.mouth.goldTooth = true;
  if (/squint|narrow eye|hooded|heavy.?lid|sleepy|half.?closed|droop/.test(feat)) g.eyes.lidRest = Math.min(g.eyes.lidRest, 0.62);
  if (/wide.?eye|big eye|large eye|staring|owlish|bulging/.test(feat)) { g.eyes.lidRest = 1.12; g.eyes.h *= 1.12; g.eyes.w *= 1.06; }
  if (/big ear|large ear|jug|sticking.?out ear/.test(feat)) g.ears.size *= 1.35;
  if (/lantern|square jaw|strong jaw|big chin|jutting/.test(feat)) { g.head.jaw = Math.max(g.head.jaw, g.head.cheek * 0.95); g.head.chinW = Math.max(g.head.chinW, 19); g.head.chinFlat = 0.9; }
  if (/weak chin|no chin|chinless|receding chin/.test(feat)) { g.head.chinW = 8; g.head.jaw = Math.min(g.head.jaw, 23); g.head.chinFlat = 0.2; m.doubleChin = true; }
  if (/gaunt|thin face|hollow|bony|haggard/.test(feat)) { g.head.cheek *= 0.88; g.head.jaw *= 0.88; }
  if (/round face|plump|chubby|moon|apple.?cheek|fat/.test(feat)) { g.head.cheek *= 1.1; g.head.jaw *= 1.12; g.head.cheekTop *= 1.05; }
  if (/smil|grin|beam|cheer|twinkl|jolly|merry/.test(feat)) g.rest = { ...g.rest, smile: 0.45 };
  if (/scowl|frown|glower|stern|grim|dour|sour/.test(feat)) g.rest = { ...g.rest, smile: -0.4, browIn: -1.4 };
  if (/smirk|sneer|sly/.test(feat)) g.rest = { ...g.rest, smile: 0.2, skew: 0.6 };
  if (/worr|anxious|nervous|fret/.test(feat)) g.rest = { ...g.rest, browIn: 1.8, smile: -0.15 };
}

/** A guess at how a name presents, for beards and wimples. 1 fem, -1 masc, 0 no idea (the seed decides). */
export function guessFem(name?: string): number {
  if (!name) return 0;
  const words = name.toLowerCase().replace(/[^a-z' -]/g, '').split(/[\s-]+/).filter(Boolean);
  let first = '';
  for (const w of words) {
    if (/^(lady|dame|mistress|goody|goodwife|widow|sister|mother|granny|gran|nan|nanny|baroness|duchess|queen|aunt|auntie|madam|miss|mrs|abbess|countess|princess)$/.test(w)) return 1;
    if (/^(sir|lord|master|brother|father|gaffer|baron|duke|king|uncle|mr|abbot|count|prince|friar|squire|goodman)$/.test(w)) return -1;
    if (/^(old|young|big|little|mad|soft|fat|thin|long|short|red|black|the|magister|doctor|captain|reeve|saint|blind|deaf|honest)$/.test(w)) continue;
    first = w; break;
  }
  if (!first) return 0;
  if (FEM_NAMES.has(first)) return 1;
  if (MASC_NAMES.has(first)) return -1;
  if (/(a|ie|ette|elle|lyn|lynn|wen|wyn|wynne|ith|ild|ine|ess|anne|beth|een)$/.test(first)) return 1;
  if (/(ric|bert|ald|ard|win|mund|fred|olf|ulf|us|o|stan|ock|ob|ek|wulf|helm|grim)$/.test(first)) return -1;
  return 0;
}
const FEM_NAMES = new Set('agnes alice alys edith cecily marta martha maud matilda joan beatrice mabel gwen pru prudence hilda lobelia ffion margery emma isolde rosamund elinor eleanor mary anne ann elspeth bess molly nell tilda tilly winifred hazel ivy rose daisy poppy primrose petunia marigold myrtle bryony clover fern gytha greta helga ingrid sigrid brunhild dagny avis sybil constance mercy patience faith hope joy pearl ruby opal wynn meg peg kit nan beryl enid mildred maudlin gillian jill kate katherine catherine joyce lettice dulcie durga marian marion muriel rohese sabine thea una ursula willow yvonne edda freya gerda gudrun thora dis astrid'.split(' '));
const MASC_NAMES = new Set('wat hob tom ansel osric dunstan bram alder jory pim pip borin grub quill ned will wil hugh giles piers rolf ralf odo gilbert godfrey walter robin simon martin edmund edgar alfred cedric cuthbert bertram barnaby snik aldous jack john jon hal harry dick nick col cole adam bartholomew geoffrey gregory henry humphrey jasper luke mark matthew miles nigel oswald percy peter roger rufus silas stephen thomas tobias toby wilfred balin dain durin gimble thrain fenn garth gorm hrolf ivar knut leif olaf sven tor ulf jem jeb seth amos enoch josiah abel'.split(' '));

/** Last pass: make the parts agree with each other. */
function settle(g: Genome, r: Rand, inp: GenomeInput): void {
  if (g.kind === 'dragon') return;
  if (g.kind === 'dwarf' && g.beard.style === 'none' && inp.look?.beard !== false) { g.beard.style = 'long'; g.beard.stache = 'walrus'; }
  if (inp.look?.beard === undefined && guessFem(inp.name) > 0 && g.kind !== 'dwarf') { g.beard.style = 'none'; g.beard.stache = 'none'; }
  if (g.kind === 'ogre') {
    g.hat.tiny = g.hat.kind !== 'none' && g.hat.kind !== 'circlet' && g.hat.kind !== 'headband' && g.hat.kind !== 'wreath' && g.hat.kind !== 'leafband';
    // an ogre cannot get into a hood. He perches the nearest thing on top instead.
    const swap: Partial<Record<HatKind, HatKind>> = { coif: 'cap', hood: 'cap', wimple: 'cap', kerchief: 'cap', mailcoif: 'kettle', bascinet: 'kettle', deephood: 'cap', judgecap: 'beret', skep: 'straw' };
    const to = swap[g.hat.kind];
    if (to) g.hat.kind = to;
    if (g.hat.kind === 'none' && !inp.look?.hat) { g.hat.kind = r.pick(['cap', 'straw', 'beret'] as const); g.hat.tiny = true; g.hat.c = cloth(r, true); }
  }
  if (g.kind === 'goblin' && g.hat.kind === 'wimple') g.hat.kind = 'kerchief';
  if (g.kind === 'elf' && g.hat.kind === 'none' && r.chance(0.4)) { g.hat.kind = 'leafband'; g.hat.c = r.pick([PIG.silver, PIG.gold2]); }
  // wimples and veils read as women's dress; without a name to go on, keep them to faces rolled that way
  if (g.hat.kind === 'wimple' && g.beard.style !== 'none' && g.beard.style !== 'stubble' && g.kind !== 'dwarf') g.hat.kind = 'hood';
  if (g.marks.patch) g.marks.specs = 'none';
  if (g.hair.style === 'bald' || g.hair.style === 'horseshoe') g.hair.vol = Math.min(g.hair.vol, 1);
  // ground: whichever of lapis and deep red sets the figure off better
  if (!inp.npc && inp.role !== 'ruler') {
    const warm = (c: string) => { const n = parseInt(c.slice(1), 16); return ((n >> 16) & 255) - (n & 255); };
    const w = warm(g.hat.kind !== 'none' ? g.hat.c : g.garb.c) + warm(g.garb.c) * 0.6;
    g.ground = g.kind === 'goblin' ? (r.chance(0.7) ? 'red' : 'lapis') : w > 95 ? 'lapis' : w < 10 ? (r.chance(0.72) ? 'red' : 'lapis') : r.chance(0.6) ? 'lapis' : 'red';
  }
}

export function moodExpr(mood: string): Expr { return { ...ZERO, ...(MOODS[mood] ?? {}) }; }
export const ZERO: Expr = {
  browIn: 0, browOut: 0, browArch: 0, browSkew: 0, lid: 1, squint: 0, pupil: 1, gazeX: 0, gazeY: 0,
  smile: 0, open: 0, wide: 1, skew: 0, wob: 0, teeth: 0, blush: 1, flush: 0, pale: 0,
  tilt: 0, dx: 0, dy: 0, shake: 0, sweat: 0, tear: 0, furrow: 0,
};
/** The nine moods. Each must read at a glance, so they are pushed further than life. */
const MOODS: Record<string, Partial<Expr>> = {
  neutral: {},
  pleased: { smile: 0.6, squint: 0.3, browIn: 0.8, browOut: 0.6, browArch: 0.5, blush: 1.35, lid: 0.96, dy: -0.4 },
  delighted: { smile: 1, open: 0.62, teeth: 0.5, squint: 0.95, lid: 0.5, browIn: 2.4, browOut: 2.6, browArch: 1.4, blush: 1.9, dy: -1.8, tilt: -1.5, wide: 1.12 },
  worried: { browIn: 3.8, browOut: -1.4, browArch: -0.4, lid: 1.1, smile: -0.4, wob: 0.75, sweat: 1, gazeY: 0.12, tilt: 2.2, pupil: 0.9, blush: 0.8, dy: 0.6 },
  annoyed: { browIn: -2.6, browOut: 0.9, browArch: -0.8, lid: 0.6, squint: 0.2, smile: -0.36, skew: -0.75, gazeX: 0.7, gazeY: -0.1, tilt: -1.6, wide: 0.86 },
  angry: { browIn: -5, browOut: 2, browArch: -1, lid: 0.86, squint: 0.42, smile: -0.85, open: 0.34, teeth: 1, flush: 1, furrow: 1, dy: 1.2, pupil: 0.82, wide: 1.1, blush: 1.5 },
  smug: { browSkew: 3.2, browIn: -0.4, browArch: 0.8, lid: 0.52, squint: 0.36, smile: 0.55, skew: 0.9, tilt: -3.6, dy: -1, gazeX: -0.35, blush: 1.1 },
  sad: { browIn: 3.4, browOut: -2.2, browArch: -0.6, lid: 0.68, smile: -0.8, gazeY: 0.6, dy: 2.6, tilt: 3.2, tear: 1, blush: 0.6, wide: 0.9 },
  afraid: { browIn: 3.2, browOut: 1.8, browArch: 1.2, lid: 1.34, pupil: 0.52, smile: -0.35, open: 0.42, wide: 0.74, wob: 1, pale: 1, shake: 1, sweat: 1, dy: 1.6, blush: 0.3 },
};
