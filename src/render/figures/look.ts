/**
 * From a FigureSpec to a concrete Look: who this little person is, in paint
 * and proportions. Pure data; the carving happens in parts.ts.
 */
import type { FigureSpec, FigureProp } from '../api';
import type { Species, TradeId, NpcId } from '../../data/ids';
import type { RankId, StaffRole } from '../../sim/types';
import { PAL } from '../palette';
import { Rng } from './util';
import { blend, shade } from './sculpt';

export type HatId = 'none' | 'straw' | 'hood' | 'coif' | 'toque' | 'floppy' | 'beret' | 'leathercap' | 'bandana' | 'kerchief'
  | 'feathercap' | 'wizard' | 'skullcap' | 'flatcap' | 'kettle' | 'helm' | 'veil' | 'tallhat' | 'mitre' | 'wig' | 'plumed'
  | 'pot' | 'bowler' | 'bonnet' | 'singed' | 'deephood' | 'circlet' | 'coronet' | 'crown' | 'crown_great';
export type HairId = 'bald' | 'short' | 'bowl' | 'long' | 'bun' | 'braids' | 'curly' | 'tonsure' | 'tufts' | 'ponytail' | 'sleek' | 'topknot' | 'balding';
export type BeardId = 'none' | 'full' | 'long' | 'forked' | 'braided' | 'goatee' | 'moustache' | 'curled';
export type OutfitId = 'tunic' | 'apron' | 'robe' | 'coat' | 'tabard' | 'motley' | 'armor' | 'vestment' | 'dress';
export type ExtraId = 'cloak' | 'ermine' | 'shawl' | 'chain' | 'buttons' | 'satchel' | 'towel' | 'quiver' | 'pack' | 'cowl' | 'collar' | 'trim' | 'patches' | 'soot' | 'goggles' | 'specs' | 'earrings' | 'tusks';
/** everything a hand can hold: the public FigureProp list plus the trade tools that only figures know about */
export type PropId = FigureProp | 'quill' | 'flask' | 'keg' | 'bow' | 'skep' | 'shovel' | 'cheese' | 'candle' | 'ratpole'
  | 'orb' | 'gavel' | 'horn' | 'sceptre' | 'stamp';

export interface FaceLook {
  eyeX: number; eyeY: number; eyeW: number; eyeH: number;
  eyeColor: number; pupil: number | null; glint: number;
  /** resting openness of the upper lid (elves keep theirs serenely low) */
  lid: number;
  browY: number; browT: number; browLen: number; browColor: number; browTilt: number;
  mouthY: number; mouthW: number; curve: number; open: number; mouthColor: number;
  teeth: boolean; blush: number | null;
}

export interface Look {
  species: Species; child: boolean; seed: number;
  /** whole-figure scale (children, the ruler) */
  scale: number;
  bodyH: number; bodyR: number; shape: number[];
  headR: number; headSX: number; headSY: number; headY: number;
  handR: number;
  skin: number; skinDark: number; hair: number; cloth: number; trim: number; apron: number; hatColor: number; hatColor2: number;
  hairStyle: HairId; beard: BeardId; hat: HatId; outfit: OutfitId; extras: ExtraId[];
  nose: number; feet: boolean;
  face: FaceLook;
  prop: PropId; offProp: PropId;
  propScale: number;
  /** the ruler's gilded base */
  base: boolean;
  /** hat is a crown: carved separately in gold leaf */
  gilded: boolean;
  /** hat perched tiny on top (ogres) */
  tinyHat: boolean;
}

const CLOTHS: number[] = [PAL.clothRed, PAL.clothBlue, PAL.clothGreen, PAL.clothOchre, PAL.clothBrown, PAL.clothCream, PAL.clothPlum, PAL.clothTeal, PAL.clothGrey];
const LEATHER: number = 0x8a5f38, LEATHER_DARK: number = 0x4a3222, IRON: number = 0x6f7378, STRAW: number = 0xd2b260, LINEN: number = 0xe9e0c8, WOOL: number = 0xcfc3a4;

// body silhouettes: radius (fraction of bodyR) at height fractions 0, .04, .14, .36, .6, .8, .92, 1
const SHAPE: Record<Species, number[]> = {
  human:    [0.93, 1.0, 0.99, 0.9, 0.78, 0.66, 0.52, 0.38],
  halfling: [0.94, 1.0, 1.03, 1.0, 0.9, 0.75, 0.58, 0.42],
  dwarf:    [0.92, 1.0, 1.04, 1.06, 1.0, 0.86, 0.66, 0.46],
  goblin:   [0.9, 1.0, 1.0, 0.9, 0.77, 0.63, 0.5, 0.38],
  elf:      [0.9, 1.0, 0.96, 0.8, 0.68, 0.6, 0.5, 0.37],
  ogre:     [0.9, 1.0, 1.05, 1.1, 1.08, 0.98, 0.78, 0.5],
};
export const SHAPE_V = [0, 0.04, 0.14, 0.36, 0.6, 0.8, 0.92, 1];

interface Build { bodyH: number; bodyR: number; headR: number; sx: number; sy: number; hand: number; neck: number }
const BUILD: Record<Species, Build> = {
  human:    { bodyH: 0.235, bodyR: 0.112, headR: 0.098, sx: 1, sy: 1, hand: 0.034, neck: 0.066 },
  halfling: { bodyH: 0.165, bodyR: 0.112, headR: 0.095, sx: 1.04, sy: 0.98, hand: 0.031, neck: 0.062 },
  dwarf:    { bodyH: 0.172, bodyR: 0.138, headR: 0.102, sx: 1.06, sy: 0.98, hand: 0.038, neck: 0.06 },
  goblin:   { bodyH: 0.145, bodyR: 0.098, headR: 0.09, sx: 1.12, sy: 0.94, hand: 0.03, neck: 0.058 },
  elf:      { bodyH: 0.31, bodyR: 0.094, headR: 0.088, sx: 0.96, sy: 1.08, hand: 0.03, neck: 0.066 },
  ogre:     { bodyH: 0.4, bodyR: 0.19, headR: 0.135, sx: 1.08, sy: 0.96, hand: 0.056, neck: 0.085 },
};

interface TradeLook { hat: HatId; outfit?: OutfitId; cloth?: number[]; apron?: number; hatColor?: number; hatColor2?: number; prop: PropId; extras?: ExtraId[] }
const TRADE: Record<TradeId, TradeLook> = {
  farmer:        { hat: 'straw', cloth: [PAL.clothGreen, PAL.clothOchre, PAL.clothBrown], prop: 'pitchfork', hatColor: STRAW, hatColor2: PAL.clothBrown },
  shepherd:      { hat: 'hood', cloth: [PAL.clothBrown, PAL.clothCream, PAL.clothGrey], hatColor: WOOL, prop: 'crook', extras: ['cowl'] },
  laborer:       { hat: 'coif', cloth: [PAL.clothBrown, PAL.clothGrey, PAL.clothOchre], hatColor: LINEN, prop: 'sack', extras: ['patches'] },
  miller:        { hat: 'floppy', outfit: 'apron', apron: 0xf0ead8, cloth: [PAL.clothGrey, PAL.clothBrown, PAL.clothBlue], hatColor: 0xf0ead8, prop: 'sack' },
  baker:         { hat: 'toque', outfit: 'apron', apron: 0xf4efe2, cloth: [PAL.clothOchre, PAL.clothRed, PAL.clothBrown], hatColor: 0xf4efe2, prop: 'loaf' },
  blacksmith:    { hat: 'bandana', outfit: 'apron', apron: LEATHER_DARK, cloth: [PAL.clothGrey, PAL.clothBrown, PAL.clothRed], hatColor: PAL.clothRed, prop: 'hammer', extras: ['soot'] },
  carpenter:     { hat: 'leathercap', outfit: 'apron', apron: LEATHER, cloth: [PAL.clothGreen, PAL.clothBlue, PAL.clothOchre], hatColor: LEATHER, prop: 'gavel' },
  weaver:        { hat: 'kerchief', cloth: [PAL.clothPlum, PAL.clothTeal, PAL.clothRed], hatColor: PAL.clothCream, prop: 'basket', extras: ['shawl'] },
  brewer:        { hat: 'floppy', outfit: 'apron', apron: 0x6b5a3a, cloth: [PAL.clothOchre, PAL.clothGreen, PAL.clothBrown], hatColor: PAL.clothBrown, prop: 'keg' },
  innkeeper:     { hat: 'none', outfit: 'apron', apron: 0xe2d6b8, cloth: [PAL.clothRed, PAL.clothGreen, PAL.clothBrown], prop: 'mug', extras: ['towel'] },
  merchant:      { hat: 'beret', outfit: 'robe', cloth: [PAL.clothPlum, PAL.clothTeal, PAL.clothBlue], hatColor: PAL.clothRed, hatColor2: PAL.gold, prop: 'purse', extras: ['chain', 'trim'] },
  bard:          { hat: 'feathercap', outfit: 'motley', cloth: [PAL.clothRed, PAL.clothTeal, PAL.clothPlum], hatColor: PAL.clothGreen, hatColor2: PAL.clothRed, prop: 'lute' },
  alchemist:     { hat: 'skullcap', outfit: 'apron', apron: 0x5a6038, cloth: [PAL.clothTeal, PAL.clothPlum, PAL.clothGrey], hatColor: PAL.clothBlack, prop: 'flask', extras: ['goggles', 'soot'] },
  wizard:        { hat: 'wizard', outfit: 'robe', cloth: [PAL.wizard, PAL.lapis, PAL.purple], hatColor: PAL.wizardRoof, hatColor2: PAL.gold, prop: 'staff', extras: ['trim'] },
  hedge_witch:   { hat: 'wizard', cloth: [PAL.clothBlack, PAL.clothPlum, 0x3a4a3a], hatColor: 0x2f3a30, hatColor2: PAL.clothPlum, prop: 'broom', extras: ['shawl'] },
  scribe:        { hat: 'coif', outfit: 'robe', cloth: [PAL.clothGrey, PAL.clothBrown, PAL.clothBlue], hatColor: PAL.clothBlack, prop: 'scroll', extras: ['collar'] },
  guard:         { hat: 'kettle', outfit: 'tabard', cloth: [PAL.clothGrey], apron: PAL.crimson, hatColor: IRON, prop: 'sword' },
  hunter:        { hat: 'hood', cloth: [PAL.clothGreen, PAL.clothBrown], hatColor: 0x3f5a3a, hatColor2: PAL.clothRed, prop: 'bow', extras: ['cowl', 'quiver'] },
  fishmonger:    { hat: 'straw', outfit: 'apron', apron: 0x6a8494, cloth: [PAL.clothBlue, PAL.clothTeal, PAL.clothGrey], hatColor: STRAW, hatColor2: PAL.clothBlue, prop: 'fish' },
  beekeeper:     { hat: 'veil', cloth: [PAL.clothCream, PAL.clothOchre], hatColor: STRAW, hatColor2: LINEN, prop: 'skep' },
  gravedigger:   { hat: 'floppy', cloth: [PAL.clothBlack, PAL.clothGrey, 0x4a4438], hatColor: 0x38322c, prop: 'shovel', extras: ['patches'] },
  adventurer:    { hat: 'bandana', cloth: [PAL.clothRed, PAL.clothBlue, PAL.clothGreen], hatColor: PAL.clothOchre, prop: 'sword', extras: ['cloak', 'pack'] },
  cheesemonger:  { hat: 'coif', outfit: 'apron', apron: PAL.clothOchre, cloth: [PAL.clothCream, PAL.clothBrown, PAL.clothGreen], hatColor: LINEN, prop: 'cheese' },
  candlemaker:   { hat: 'skullcap', outfit: 'apron', apron: 0xe8dcc0, cloth: [PAL.clothRed, PAL.clothPlum, PAL.clothBlue], hatColor: PAL.clothBrown, prop: 'candle' },
  ratcatcher:    { hat: 'floppy', cloth: [PAL.clothBrown, PAL.clothGrey, PAL.clothGreen], hatColor: 0x5a4a32, prop: 'ratpole', extras: ['patches', 'satchel'] },
  fortune_teller:{ hat: 'bandana', cloth: [PAL.clothPlum, PAL.clothTeal, PAL.clothRed], hatColor: PAL.purple, hatColor2: PAL.gold, prop: 'orb', extras: ['shawl', 'earrings'] },
  tax_clerk:     { hat: 'flatcap', outfit: 'coat', cloth: [PAL.clothBlack, 0x3a3a44], hatColor: PAL.clothBlack, prop: 'ledger', extras: ['buttons', 'specs', 'collar'] },
  herbalist:     { hat: 'kerchief', outfit: 'apron', apron: 0x7a9a5a, cloth: [PAL.clothGreen, PAL.clothCream, PAL.clothOchre], hatColor: 0x8aa860, prop: 'basket' },
};

interface NpcLook {
  species?: Species; hat: HatId; outfit: OutfitId; cloth: number; trim?: number; apron?: number; hatColor?: number; hatColor2?: number;
  hair?: HairId; hairColor?: number; beard?: BeardId; prop: PropId; offProp?: PropId; extras?: ExtraId[]; scale?: number;
  skin?: number; mood?: number; browTilt?: number;
}
const NPC: Record<NpcId, NpcLook> = {
  crown_herald:       { hat: 'plumed', outfit: 'tabard', cloth: PAL.gold, apron: PAL.crimson, trim: PAL.gold, hatColor: PAL.crimson, hatColor2: PAL.clothCream, hair: 'bowl', prop: 'horn', scale: 1.04 },
  royal_assessor:     { hat: 'flatcap', outfit: 'robe', cloth: 0x6f6a72, trim: PAL.lapis, hatColor: 0x4a4650, hair: 'balding', hairColor: PAL.hairGrey, prop: 'ledger', offProp: 'quill', extras: ['specs', 'chain', 'trim'], browTilt: -0.25 },
  tax_collector:      { hat: 'tallhat', outfit: 'coat', cloth: 0x26222a, trim: PAL.clothGrey, hatColor: 0x1e1b22, hatColor2: PAL.crimson, hair: 'short', hairColor: PAL.hairDark, beard: 'goatee', prop: 'purse', extras: ['buttons', 'collar', 'satchel'], browTilt: -0.35 },
  rival_lord:         { hat: 'coronet', outfit: 'tunic', cloth: PAL.clothPlum, trim: PAL.gold, hair: 'bowl', hairColor: PAL.hairDark, beard: 'curled', prop: 'none', extras: ['cloak', 'chain', 'trim'], scale: 1.1, browTilt: -0.45 },
  moneylender:        { hat: 'skullcap', outfit: 'robe', cloth: PAL.clothTeal, trim: PAL.gold, hatColor: PAL.clothBlack, hair: 'balding', hairColor: PAL.hairGrey, beard: 'forked', prop: 'purse', extras: ['chain', 'trim'] },
  bishop:             { hat: 'mitre', outfit: 'vestment', cloth: 0xefe6d0, trim: PAL.gold, apron: PAL.clothPlum, hatColor: 0xefe6d0, hatColor2: PAL.gold, hair: 'tonsure', hairColor: PAL.hairWhite, prop: 'crook', scale: 1.05 },
  guild_inspector:    { hat: 'flatcap', outfit: 'coat', cloth: PAL.clothBrown, trim: PAL.clothOchre, hatColor: PAL.clothGreen, hatColor2: PAL.gold, hair: 'short', beard: 'moustache', prop: 'scroll', extras: ['buttons', 'satchel', 'collar'] },
  travelling_wizard:  { hat: 'wizard', outfit: 'robe', cloth: 0x4a5f8a, trim: PAL.clothOchre, hatColor: 0x3d4f78, hatColor2: PAL.gold, hair: 'long', hairColor: PAL.hairWhite, beard: 'long', prop: 'staff', extras: ['patches', 'pack', 'trim'], scale: 1.04 },
  goblin_chief:       { species: 'goblin', hat: 'pot', outfit: 'coat', cloth: 0x5a3a2a, trim: PAL.gold, hatColor: IRON, hatColor2: PAL.crimson, hair: 'bald', prop: 'stamp', offProp: 'scroll', extras: ['chain', 'buttons'], scale: 1.12 },
  commons_warden:     { hat: 'bonnet', outfit: 'dress', cloth: 0x5a7a52, trim: PAL.clothCream, hatColor: PAL.clothCream, hatColor2: PAL.clothRed, hair: 'bun', hairColor: PAL.hairGrey, prop: 'ledger', extras: ['collar', 'specs'], browTilt: -0.3 },
  dragon_adjuster:    { hat: 'singed', outfit: 'coat', cloth: 0x6a5a48, trim: PAL.soot, hatColor: 0x5a4a3a, hatColor2: PAL.soot, hair: 'short', hairColor: PAL.hairRed, beard: 'moustache', prop: 'ledger', offProp: 'quill', extras: ['goggles', 'soot', 'buttons', 'satchel'] },
  reeves_court_judge: { hat: 'wig', outfit: 'robe', cloth: 0x1f1c22, trim: PAL.crimson, hatColor: PAL.hairWhite, hair: 'bald', prop: 'gavel', extras: ['collar', 'trim'], scale: 1.06, browTilt: -0.3 },
  wandering_knight:   { hat: 'helm', outfit: 'armor', cloth: 0x8a9096, trim: PAL.crimson, apron: PAL.crimson, hatColor: 0x8a9096, hatColor2: PAL.crimson, hair: 'short', beard: 'moustache', prop: 'sword', extras: ['cloak'], scale: 1.08 },
  mysterious_stranger:{ hat: 'deephood', outfit: 'robe', cloth: 0x2a2a34, trim: 0x1c1c24, hatColor: 0x22222c, hair: 'bald', prop: 'lantern', extras: ['cloak', 'cowl'], scale: 1.06, skin: 0x8a6a52 },
  your_mother:        { hat: 'none', outfit: 'dress', cloth: 0x7a5a6a, trim: PAL.clothCream, hair: 'bun', hairColor: PAL.hairGrey, prop: 'basket', extras: ['shawl', 'specs', 'collar'], scale: 0.94, browTilt: -0.4 },
};

const RANK_SCALE: Record<RankId, number> = { reeve: 1.12, knight: 1.15, baron: 1.19, duke: 1.22, king: 1.26 };

function faceFor(species: Species, r: Rng, skin: number, hair: number, child: boolean): FaceLook {
  const ink = 0x231812;
  const f: FaceLook = {
    eyeX: 0.35, eyeY: 0.13, eyeW: 0.105, eyeH: 0.135, eyeColor: ink, pupil: null, glint: 0.034, lid: 1,
    browY: 0.25, browT: 0.034, browLen: 0.13, browColor: shade(hair, -0.35), browTilt: 0,
    mouthY: -0.3, mouthW: 0.19, curve: 0.25, open: 0, mouthColor: 0x5a2420, teeth: false,
    blush: null,
  };
  switch (species) {
    case 'human':
      if (r.chance(0.45)) f.blush = blend(skin, 0xd8705a, 0.42);
      break;
    case 'halfling':
      f.eyeW = 0.118; f.eyeH = 0.15; f.eyeX = 0.36; f.eyeY = 0.12; f.mouthW = 0.21; f.curve = 0.4; f.glint = 0.04;
      f.blush = blend(skin, 0xe0705a, 0.5);
      break;
    case 'dwarf':
      f.eyeX = 0.31; f.eyeY = 0.2; f.eyeW = 0.085; f.eyeH = 0.1; f.browY = 0.19; f.browT = 0.065; f.browLen = 0.16; f.browTilt = -0.25;
      f.mouthY = -0.24; f.mouthW = 0.16; f.curve = 0.05; f.blush = blend(skin, 0xc8604a, 0.4);
      break;
    case 'goblin':
      f.eyeX = 0.4; f.eyeY = 0.17; f.eyeW = 0.155; f.eyeH = 0.175; f.eyeColor = 0xf0d84a; f.pupil = ink; f.glint = 0.03;
      f.browY = 0.27; f.browT = 0.03; f.browLen = 0.15; f.browTilt = -0.45; f.browColor = shade(skin, -0.5);
      f.mouthY = -0.36; f.mouthW = 0.4; f.curve = 0.62; f.open = 0.34; f.teeth = true; f.mouthColor = 0x3a1a1a;
      break;
    case 'elf':
      f.eyeX = 0.33; f.eyeY = 0.12; f.eyeW = 0.122; f.eyeH = 0.1; f.lid = 0.62; f.browY = 0.25; f.browT = 0.022; f.browLen = 0.14; f.browTilt = 0.08;
      f.mouthW = 0.14; f.mouthY = -0.32; f.curve = 0.3; f.glint = 0.03;
      break;
    case 'ogre':
      f.eyeX = 0.34; f.eyeY = 0.22; f.eyeW = 0.078; f.eyeH = 0.098; f.glint = 0.036; f.browY = 0.2; f.browT = 0.06; f.browLen = 0.15; f.browTilt = 0.42;
      f.browColor = shade(skin, -0.45); f.mouthY = -0.22; f.mouthW = 0.3; f.curve = 0.3; f.blush = blend(skin, 0xc88a8a, 0.35);
      break;
  }
  if (child) { f.eyeW *= 1.18; f.eyeH *= 1.18; f.eyeY -= 0.03; f.browT *= 0.8; f.blush = blend(skin, 0xe0705a, 0.5); f.curve += 0.15; f.mouthW *= 0.9; }
  f.eyeX += r.range(-0.02, 0.02); f.eyeW *= r.range(0.93, 1.08); f.eyeH *= r.range(0.93, 1.08); f.mouthW *= r.range(0.9, 1.12);
  return f;
}

/** Resolve a spec into paint and proportions. Deterministic in spec.seed. */
export function resolveLook(spec: FigureSpec): Look {
  const npc = spec.npc ? NPC[spec.npc] : null;
  const species: Species = npc?.species ?? spec.species;
  const child = !!spec.child;
  const r = new Rng(Math.imul(spec.seed | 0, 0x9e3779b1) + 97);
  const b = BUILD[species];
  const tall = r.range(0.94, 1.07), wide = r.range(0.95, 1.07);

  // paint
  let skin: number;
  switch (species) {
    case 'goblin': skin = blend(PAL.goblin, PAL.goblinDark, r.next() * 0.8); break;
    case 'ogre': skin = blend(PAL.ogre, 0x86a08e, r.next()); break;
    case 'elf': skin = blend(PAL.elf, PAL.skinB, r.next() * 0.35); break;
    case 'dwarf': skin = blend(r.pick([PAL.skinA, PAL.skinB, PAL.skinB, PAL.skinC]), 0xd08a6a, 0.25); break;
    case 'halfling': skin = blend(r.pick([PAL.skinA, PAL.skinA, PAL.skinB, PAL.skinC]), 0xf0b090, 0.2); break;
    default: skin = r.pick([PAL.skinA, PAL.skinA, PAL.skinB, PAL.skinB, PAL.skinC, PAL.skinD]);
  }
  if (npc?.skin) skin = npc.skin;
  const old = !child && r.chance(0.22);
  let hair: number;
  switch (species) {
    case 'goblin': hair = r.pick([PAL.hairDark, 0x3a3a2a, PAL.hairGrey]); break;
    case 'ogre': hair = r.pick([PAL.hairDark, 0x4a4a44, PAL.hairBrown]); break;
    case 'elf': hair = r.pick([PAL.hairBlond, PAL.hairWhite, 0xc8c8d8, PAL.hairDark, 0xe8d8a0]); break;
    case 'dwarf': hair = r.pick([PAL.hairRed, PAL.hairRed, PAL.hairBrown, PAL.hairDark, PAL.hairBlond, PAL.hairGrey]); break;
    default: hair = old ? r.pick([PAL.hairGrey, PAL.hairWhite]) : r.pick([PAL.hairDark, PAL.hairBrown, PAL.hairBrown, PAL.hairRed, PAL.hairBlond, PAL.hairDark]);
  }
  const fem = r.chance(0.5);
  let hairStyle: HairId;
  switch (species) {
    case 'halfling': hairStyle = 'curly'; break;
    case 'goblin': hairStyle = r.pick<HairId>(['bald', 'tufts', 'tufts', 'bald']); break;
    case 'ogre': hairStyle = r.pick<HairId>(['bald', 'topknot', 'balding']); break;
    case 'elf': hairStyle = r.pick<HairId>(['sleek', 'sleek', 'ponytail', 'long']); break;
    case 'dwarf': hairStyle = fem ? r.pick<HairId>(['braids', 'bun', 'braids']) : r.pick<HairId>(['short', 'balding', 'bald', 'bowl', 'ponytail']); break;
    default: hairStyle = fem ? r.pick<HairId>(['long', 'bun', 'braids', 'ponytail', 'bowl']) : (old ? r.pick<HairId>(['balding', 'short', 'bald']) : r.pick<HairId>(['short', 'bowl', 'short', 'ponytail', 'balding']));
  }
  let beard: BeardId = 'none';
  if (species === 'dwarf') beard = r.pick<BeardId>(['full', 'long', 'forked', 'braided', 'braided', 'full']);
  else if (species === 'human' && !fem && !child) beard = r.pick<BeardId>(['none', 'none', 'none', 'full', 'moustache', 'goatee', old ? 'long' : 'none']);
  if (child) { beard = species === 'dwarf' ? 'goatee' : 'none'; if (species === 'human') hairStyle = r.pick<HairId>(['bowl', 'short', 'braids', 'ponytail']); }

  let cloth: number = r.pick(CLOTHS), trim: number = shade(cloth, -0.3), apron: number = LINEN;
  let hat: HatId = 'none', outfit: OutfitId = 'tunic', hatColor: number = LINEN, hatColor2: number = PAL.clothRed;
  let prop: PropId = 'none', offProp: PropId = 'none';
  const extras: ExtraId[] = [];
  let scale = 1, base = false, browTilt: number | null = null;

  const trade = spec.trade && !child ? TRADE[spec.trade] : null;
  if (trade) {
    hat = trade.hat; outfit = trade.outfit ?? 'tunic';
    if (trade.cloth) cloth = r.pick(trade.cloth);
    trim = shade(cloth, -0.3);
    if (trade.apron !== undefined) apron = trade.apron;
    hatColor = trade.hatColor ?? shade(cloth, -0.2); hatColor2 = trade.hatColor2 ?? PAL.clothRed;
    prop = trade.prop;
    if (trade.extras) extras.push(...trade.extras);
    if (spec.trade === 'wizard' && !fem && species !== 'goblin') { beard = species === 'dwarf' ? 'long' : r.pick<BeardId>(['long', 'long', 'full']); }
    if (spec.trade === 'herbalist' && r.chance(0.5)) { hat = 'straw'; hatColor = STRAW; hatColor2 = 0x7a9a5a; }
    if (spec.trade === 'adventurer' && r.chance(0.4)) { hat = 'feathercap'; hatColor = PAL.clothGreen; hatColor2 = PAL.clothCream; }
    if (fem && outfit === 'tunic' && r.chance(0.5)) outfit = 'dress';
  } else if (!spec.role && !npc) {
    // nobody in particular: a villager
    if (fem) { outfit = r.chance(0.6) ? 'dress' : 'tunic'; if (r.chance(0.35)) { hat = 'kerchief'; hatColor = r.pick([LINEN, PAL.clothCream, PAL.clothRed, PAL.clothBlue]); } }
    else if (r.chance(0.3)) { hat = r.pick<HatId>(['coif', 'floppy', 'straw']); hatColor = hat === 'straw' ? STRAW : r.pick([LINEN, PAL.clothBrown, PAL.clothGreen]); hatColor2 = PAL.clothBrown; }
  }

  if (spec.role === 'mason') { hat = 'leathercap'; hatColor = LEATHER; outfit = 'apron'; apron = LEATHER; cloth = r.pick([PAL.clothOchre, PAL.clothBrown, PAL.clothGreen]); trim = shade(cloth, -0.3); prop = 'hammer'; extras.length = 0; extras.push('soot'); }
  else if (spec.role === 'bailiff') { hat = 'tallhat'; hatColor = 0x221e24; hatColor2 = PAL.crimson; outfit = 'coat'; cloth = 0x2a2630; trim = 0x16141a; prop = 'keys'; extras.length = 0; extras.push('buttons', 'collar'); browTilt = -0.3; }
  else if (spec.role === 'crier') { hat = 'feathercap'; hatColor = PAL.crimson; hatColor2 = PAL.clothCream; outfit = 'tabard'; cloth = PAL.gold; apron = PAL.crimson; trim = PAL.goldDark; prop = 'bell'; extras.length = 0; extras.push('collar'); }
  else if (spec.role === 'steward') { hat = 'flatcap'; hatColor = PAL.lapis; hatColor2 = PAL.gold; outfit = 'robe'; cloth = PAL.lapis; trim = PAL.gold; prop = 'ledger'; offProp = 'quill'; extras.length = 0; extras.push('chain', 'trim', 'collar'); }
  else if (spec.role === 'ruler') {
    const rank: RankId = spec.rank ?? 'reeve';
    scale = RANK_SCALE[rank]; base = true; outfit = 'tunic'; extras.length = 0; prop = 'none';
    cloth = 0xe6dcc0; trim = PAL.gold; hatColor = PAL.gold; hatColor2 = PAL.crimson;
    if (rank === 'reeve') { hat = 'circlet'; cloth = 0xd8ccb0; trim = PAL.clothBrown; extras.push('cloak'); }
    else if (rank === 'knight') { hat = 'coronet'; extras.push('cloak', 'trim', 'chain'); }
    else if (rank === 'baron') { hat = 'crown'; extras.push('cloak', 'ermine', 'trim', 'chain'); }
    else { hat = 'crown_great'; extras.push('cloak', 'ermine', 'trim', 'chain'); cloth = 0xf0e8d0; if (rank === 'king') prop = 'sceptre'; }
    apron = PAL.crimson;                   // the cloak
    if (hairStyle === 'bun' || hairStyle === 'topknot') hairStyle = 'long';
  }

  if (npc) {
    hat = npc.hat; outfit = npc.outfit; cloth = npc.cloth; trim = npc.trim ?? shade(cloth, -0.3); apron = npc.apron ?? PAL.crimson;
    hatColor = npc.hatColor ?? shade(cloth, -0.2); hatColor2 = npc.hatColor2 ?? PAL.gold;
    if (npc.hair) hairStyle = npc.hair; if (npc.hairColor !== undefined) hair = npc.hairColor;
    beard = npc.beard ?? (species === 'dwarf' ? 'full' : 'none');
    prop = npc.prop; offProp = npc.offProp ?? 'none'; extras.length = 0; if (npc.extras) extras.push(...npc.extras);
    scale = npc.scale ?? 1; browTilt = npc.browTilt ?? null;
  }
  if (species === 'ogre') extras.push('tusks');

  let bodyH = b.bodyH * tall, bodyR = b.bodyR * wide, headR = b.headR * r.range(0.97, 1.04), handR = b.hand;
  if (child) { scale *= 0.6; headR *= 1.22; bodyH *= 0.92; handR *= 1.1; hat = r.chance(0.25) ? 'coif' : 'none'; hatColor = LINEN; prop = 'none'; outfit = fem ? 'dress' : 'tunic'; extras.length = 0; if (species === 'ogre') extras.push('tusks'); }
  if (spec.role === 'ruler' || npc) { bodyH = b.bodyH; bodyR = b.bodyR; }
  const tinyHat = species === 'ogre' && hat !== 'deephood';
  if (species === 'ogre' && hat === 'none' && !child) { hat = 'bowler'; hatColor = r.pick([PAL.clothBlack, PAL.clothBrown, PAL.clothPlum]); hatColor2 = PAL.clothRed; }
  if (species === 'goblin' && (hat === 'straw' || hat === 'veil')) hatColor2 = PAL.clothRed;

  const face = faceFor(species, r, skin, hair, child);
  if (browTilt !== null) face.browTilt = browTilt;
  if (hat === 'deephood') { face.eyeColor = 0xf4e8c0; face.glint = 0; face.blush = null; face.browT = 0.001; face.mouthColor = shade(skin, -0.5); }

  const gilded = hat === 'circlet' || hat === 'coronet' || hat === 'crown' || hat === 'crown_great';
  return {
    species, child, seed: spec.seed | 0, scale,
    bodyH, bodyR, shape: SHAPE[species], headR, headSX: b.sx, headSY: b.sy, headY: bodyH + headR * b.sy - b.neck * 0.32, handR,
    skin, skinDark: blend(skin, species === 'goblin' ? 0x3f6a35 : species === 'ogre' ? 0x6a8a7a : 0xb8684a, 0.32), hair, cloth, trim, apron, hatColor, hatColor2,
    hairStyle, beard, hat, outfit, extras, nose: r.range(0.85, 1.2), feet: species === 'halfling',
    face, prop, offProp,
    propScale: species === 'ogre' ? 1.45 : species === 'elf' ? 1.05 : species === 'human' ? 1 : 0.88,
    base, gilded, tinyHat,
  };
}

/** the prop a livery or trade carries by default (layers use this to put it back after a job) */
export function defaultProp(spec: { role?: StaffRole | 'ruler'; trade?: TradeId; npc?: NpcId }): PropId {
  if (spec.npc) return NPC[spec.npc].prop;
  if (spec.role === 'mason') return 'hammer';
  if (spec.role === 'bailiff') return 'keys';
  if (spec.role === 'crier') return 'bell';
  if (spec.role === 'steward') return 'ledger';
  if (spec.role === 'ruler') return 'none';
  return spec.trade ? TRADE[spec.trade].prop : 'none';
}

/** body radius at height fraction v (0 ground .. 1 neck), in world units */
export function radiusAt(L: Look, v: number): number {
  const s = L.shape;
  if (v <= 0) return s[0]! * L.bodyR;
  for (let i = 1; i < SHAPE_V.length; i++) {
    if (v <= SHAPE_V[i]!) {
      const t = (v - SHAPE_V[i - 1]!) / (SHAPE_V[i]! - SHAPE_V[i - 1]!);
      return (s[i - 1]! + (s[i]! - s[i - 1]!) * t) * L.bodyR;
    }
  }
  return s[s.length - 1]! * L.bodyR;
}
