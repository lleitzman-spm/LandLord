/**
 * Portraits: the shapes that describe one person. A Genome is plain data
 * rolled deterministically from the seed (plus trade, role, rank, npc and
 * look hints); the drawing code turns it into SVG and the animator reads it
 * to move the face.
 *
 * Coordinates: a 200 x 200 box, the roundel centred on (100,100), the head
 * centred on x = 100. Light comes from the upper left.
 */
import type { Species } from '../../data/ids';
import type { Pt } from './util';

/** 0: under 64px (lists). 1: up to 160px (cards). 2: audiences. */
export type Lod = 0 | 1 | 2;
export type Kind = Species | 'dragon';

export type NoseKind = 'button' | 'snub' | 'straight' | 'roman' | 'bulb' | 'potato' | 'pointed' | 'broken' | 'broad' | 'droop' | 'snout';
export type HairStyle =
  | 'bald' | 'horseshoe' | 'tonsure' | 'crop' | 'bowl' | 'pageboy' | 'shaggy' | 'curly' | 'long' | 'wavy'
  | 'braids' | 'bun' | 'wild' | 'widow' | 'wispy' | 'tuft' | 'topknot' | 'crownbraid';
export type BeardStyle = 'none' | 'stubble' | 'goatee' | 'chinstrap' | 'short' | 'long' | 'forked' | 'braided' | 'chops' | 'spade';
export type StacheStyle = 'none' | 'walrus' | 'handlebar' | 'pencil' | 'chevron' | 'droop';
export type BrowStyle = 'taper' | 'arch' | 'flat' | 'thin' | 'bushy' | 'wing' | 'ridge';
export type TeethKind = 'plain' | 'gap' | 'buck' | 'goblin' | 'tusks' | 'snag' | 'fangs';
export type EarKind = 'round' | 'leaf' | 'goblin' | 'elf' | 'small' | 'none';

export type HatKind =
  | 'none' | 'cap' | 'coif' | 'hood' | 'wimple' | 'kerchief' | 'straw' | 'widebrim' | 'pointed' | 'witch'
  | 'beret' | 'chaperon' | 'bycocket' | 'kettle' | 'bascinet' | 'mailcoif' | 'toque' | 'skullcap'
  | 'circlet' | 'coronet' | 'ducal' | 'crown' | 'mitre' | 'wreath' | 'skep' | 'knit' | 'headband'
  | 'paperhat' | 'deephood' | 'leafband' | 'judgecap';
export type HatExtra = 'feather' | 'plumes' | 'stars' | 'candle' | 'rat' | 'badge' | 'liripipe' | 'sprig' | 'flowers' | 'coins' | 'dust' | 'patch' | 'tip' | 'bow';
export type GarbKind = 'tunic' | 'kirtle' | 'robe' | 'cowl' | 'fur' | 'apron' | 'tabard' | 'mail' | 'mantle' | 'highcollar' | 'shawl' | 'livery' | 'ermine' | 'jerkin' | 'scales';
export type GarbExtra = 'chain' | 'keys' | 'lacing' | 'brooch' | 'stars' | 'patches' | 'badge' | 'sash' | 'bowtie' | 'towel' | 'scarf' | 'wax' | 'dust' | 'soot' | 'baldric' | 'seals' | 'pendant';
export type ToolKind =
  | 'none' | 'pitchfork' | 'crook' | 'shovel' | 'sack' | 'rollingpin' | 'hammer' | 'saw' | 'distaff' | 'tankard'
  | 'purse' | 'lute' | 'flask' | 'staff' | 'broom' | 'cat' | 'scroll' | 'spear' | 'bow' | 'fish' | 'bees'
  | 'sword' | 'cheese' | 'candles' | 'rat' | 'orb' | 'abacus' | 'herbs' | 'trowel' | 'writ' | 'bell'
  | 'ledger' | 'trumpet' | 'tablet' | 'strongbox' | 'scales' | 'crozier' | 'rod' | 'gavel' | 'hourglass'
  | 'lance' | 'raven' | 'spoon' | 'wheat' | 'goblet';

export interface HeadShape {
  cx: number; top: number; H: number;
  /** half-widths going down the face */
  skull: number; cheekTop: number; cheek: number; jaw: number; chinW: number;
  /** jaw corner height as a fraction of H */
  jawY: number;
  /** 0 pointed chin .. 1 flat chin */
  chinFlat: number;
}
export interface EyeGenes {
  y: number; gap: number; w: number; h: number;
  /** lower lid depth as a fraction of h */
  low: number;
  /** outer corner lift (+ up) */
  tilt: number;
  /** where the upper lid peaks, -1 inner .. 1 outer */
  apex: number;
  iris: string; white: string; irisR: number;
  pupil: 'round' | 'slit' | 'dot';
  lash: boolean;
  /** resting openness multiplier (elves 0.65, the startled 1.1) */
  lidRest: number;
  bag: number;
}
export interface BrowGenes { gapY: number; len: number; thick: number; arch: number; slope: number; style: BrowStyle; color: string; uni: boolean; singed: boolean }
export interface NoseGenes { kind: NoseKind; len: number; out: number; tip: number; wide: number; red: number }
export interface MouthGenes { y: number; w: number; lipU: number; lipL: number; teeth: TeethKind; lip: string; goldTooth: boolean }
export interface HairGenes { style: HairStyle; color: string; vol: number; part: -1 | 0 | 1; line: number; grey: number }
export interface BeardGenes { style: BeardStyle; stache: StacheStyle; color: string; len: number; rings: boolean }
export interface Marks {
  freckles: number; wrinkles: number;
  scar: 'none' | 'cheek' | 'brow' | 'lip';
  mole: boolean; patch: boolean;
  specs: 'none' | 'round' | 'pince' | 'monocle' | 'tiny' | 'halfmoon';
  earring: 'none' | 'ring' | 'hoops' | 'drop';
  soot: boolean; flour: boolean; inkstain: boolean; mud: boolean;
  quill: boolean; pipe: boolean; stalk: boolean; flower: boolean;
  doubleChin: boolean;
}
export interface HatGenes { kind: HatKind; c: string; c2: string; extras: HatExtra[]; tilt: number; tiny: boolean; variant: number }
export interface GarbGenes { kind: GarbKind; c: string; c2: string; trim: string; extras: GarbExtra[]; shW: number; shY: number; neckW: number; neckLen: number }

/** One frame of expression. Brow and mouth numbers are in drawing units for a human-sized face. */
export interface Expr {
  browIn: number; browOut: number; browArch: number; browSkew: number;
  lid: number; squint: number; pupil: number; gazeX: number; gazeY: number;
  smile: number; open: number; wide: number; skew: number; wob: number; teeth: number;
  blush: number; flush: number; pale: number;
  tilt: number; dx: number; dy: number; shake: number;
  sweat: number; tear: number; furrow: number;
}

export interface Genome {
  kind: Kind;
  seed: number;
  /** which way the nose points: -1 left, 1 right */
  dir: 1 | -1;
  /** how far the features drift that way (a hint of three-quarter view) */
  turn: number;
  /** 0 young .. 1 ancient */
  age: number;
  /** -1 .. 1, only used to choose hair, beards and headwear */
  fem: number;
  skin: string; skinShade: string; blushC: string; ink: string;
  head: HeadShape;
  /** scales feature motion and stroke detail (ogres small, goblins large) */
  fscale: number;
  ears: { kind: EarKind; size: number; y: number };
  eyes: EyeGenes; brows: BrowGenes; nose: NoseGenes; noseY: number; mouth: MouthGenes;
  hair: HairGenes; beard: BeardGenes; marks: Marks;
  hat: HatGenes; garb: GarbGenes; tool: ToolKind;
  /** which side the tool sits: -1 left, 1 right */
  toolSide: 1 | -1;
  blush: number;
  /** the face at rest: added to (or multiplied into) every mood */
  rest: Partial<Expr>;
  ground: 'lapis' | 'red';
  /** hood shadow over the eyes */
  shadowed: boolean;
}

export type FrameAttrs = Record<string, string>;
export type { Pt };
