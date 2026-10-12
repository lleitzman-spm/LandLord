/**
 * Portraits: wardrobe. Who wears what: a hat, hood, coif or tool at the
 * shoulder for each of the 28 trades, the four delegates' liveries, the ruler
 * by rank, and a fixed look for each of the fifteen visitors to court.
 * Each trade keeps one unmistakable sign (flour, soot, the pointed hat) and
 * varies the rest by seed, so two farmers side by side are still two people.
 */
import type { TradeId, NpcId } from '../../data/ids';
import type { StaffRole, RankId } from '../../sim/types';
import { NPCS } from '../../data/ids';
import { hashStr, dye, mixc, shadeOf, type Rand } from './util';
import { PIG, HAIR, IRIS, cloth } from './pigments';
import type { Genome, HatKind, HatExtra, GarbKind, GarbExtra, ToolKind, HeadShape, NoseKind } from './types';

function hat(g: Genome, kind: HatKind, c: string, c2: string = PIG.cream, extras: HatExtra[] = [], tilt = 0): void {
  g.hat = { kind, c, c2, extras, tilt, tiny: false, variant: g.hat.variant };
}
function garb(g: Genome, kind: GarbKind, c?: string, c2?: string, extras: GarbExtra[] = []): void {
  g.garb.kind = kind;
  if (c) g.garb.c = c;
  if (c2) g.garb.c2 = c2;
  g.garb.extras = extras;
}
function tool(g: Genome, kind: ToolKind): void { g.tool = kind; }
const fem = (g: Genome) => g.fem > 0.15;

/** Nobody in particular: what people wear when they have no trade on record. */
export function dressCommoner(g: Genome, r: Rand): void {
  g.hat.variant = r.int(0, 3);
  const c = cloth(r, true);
  if (g.kind === 'goblin') {
    garb(g, 'tunic', cloth(r), PIG.linen, r.chance(0.5) ? ['bowtie'] : ['badge']);
    if (r.chance(0.4)) hat(g, r.pick(['cap', 'beret', 'skullcap'] as const), cloth(r), PIG.cream, []);
    return;
  }
  if (g.kind === 'elf') { garb(g, r.pick(['mantle', 'robe', 'highcollar'] as const), dye(r.pick([PIG.forest, PIG.sky, PIG.slate, PIG.plum, PIG.cream, PIG.teal]), r), PIG.linen, ['brooch']); return; }
  if (g.kind === 'dwarf') {
    garb(g, r.pick(['tunic', 'jerkin', 'cowl'] as const), dye(r.pick([PIG.russet, PIG.wine, PIG.forest, PIG.slate, PIG.ochre]), r), PIG.leather, r.chance(0.4) ? ['chain'] : []);
    if (r.chance(0.5)) hat(g, r.pick(['cap', 'skullcap', 'hood', 'kettle'] as const), dye(r.pick([PIG.russet, PIG.leather, PIG.wine, PIG.forest]), r), PIG.ochre);
    return;
  }
  garb(g, fem(g) ? r.pick(['kirtle', 'kirtle', 'tunic', 'shawl'] as const) : r.pick(['tunic', 'tunic', 'cowl', 'jerkin'] as const), c, cloth(r), r.chance(0.3) ? ['lacing'] : []);
  const roll = r();
  if (roll < 0.5) return;
  if (fem(g)) hat(g, r.wpick<HatKind>([['wimple', g.age > 0.45 ? 4 : 1], ['kerchief', 4], ['coif', 2], ['straw', 1], ['hood', 1]]), r.chance(0.5) ? PIG.linen : cloth(r), cloth(r));
  else hat(g, r.wpick<HatKind>([['hood', 3], ['coif', 3], ['cap', 4], ['straw', 2], ['widebrim', 1], ['beret', 1]]), cloth(r, true), cloth(r));
  if (g.hat.kind === 'coif' || g.hat.kind === 'wimple') g.hat.c = dye(PIG.linen, r, 0.03);
}

export function dressTrade(t: TradeId, g: Genome, r: Rand): void {
  g.hat.variant = r.int(0, 3);
  const humble = cloth(r, true);
  const linen = dye(PIG.linen, r, 0.03);
  switch (t) {
    case 'farmer':
      if (r.chance(0.7)) hat(g, 'straw', dye(PIG.straw, r), dye(r.pick([PIG.russet, PIG.madder, PIG.green]), r), [], r.jit(7)); else hat(g, 'hood', dye(r.pick([PIG.russet, PIG.olive, PIG.brown]), r), PIG.cream);
      garb(g, fem(g) ? 'kirtle' : 'tunic', humble, PIG.cream, r.chance(0.4) ? ['lacing'] : []);
      tool(g, r.chance(0.6) ? 'pitchfork' : 'wheat'); g.marks.stalk = r.chance(0.45); if (r.chance(0.35)) g.marks.freckles = 0.8;
      break;
    case 'shepherd':
      if (r.chance(0.65)) hat(g, 'hood', dye(r.pick([PIG.grey, PIG.brown, PIG.olive, PIG.cream]), r), PIG.cream, ['liripipe']); else hat(g, 'widebrim', dye(PIG.brown, r), PIG.russet, [], r.jit(5));
      garb(g, 'cowl', g.hat.kind === 'hood' ? g.hat.c : humble, dye(PIG.cream, r)); tool(g, 'crook');
      break;
    case 'laborer':
      if (r.chance(0.55)) hat(g, 'coif', linen); else hat(g, 'cap', dye(r.pick([PIG.brown, PIG.grey, PIG.olive, PIG.russet]), r), PIG.cream, r.chance(0.4) ? ['tip'] : []);
      garb(g, 'tunic', dye(r.pick([PIG.grey, PIG.brown, PIG.olive, PIG.cream]), r), PIG.cream, r.chance(0.5) ? ['patches'] : []); tool(g, 'shovel');
      g.marks.mud = r.chance(0.5); if (g.beard.style === 'none' && g.fem < 0 && r.chance(0.5)) g.beard.style = 'stubble';
      break;
    case 'miller':
      hat(g, 'cap', dye(PIG.cream, r), PIG.linen, ['dust', 'tip'], r.jit(5)); garb(g, 'apron', dye(r.pick([PIG.cream, PIG.grey, PIG.sky]), r), linen, ['dust']); tool(g, 'sack'); g.marks.flour = true;
      break;
    case 'baker':
      hat(g, 'toque', PIG.flour, PIG.linen, [], r.jit(6)); garb(g, 'apron', dye(r.pick([PIG.russet, PIG.sky, PIG.rose, PIG.ochre]), r), PIG.flour, ['dust']); tool(g, 'rollingpin'); g.marks.flour = true; g.blush = Math.max(g.blush, 0.5);
      break;
    case 'blacksmith':
      if (r.chance(0.6)) hat(g, 'cap', dye(PIG.leather, r), PIG.leatherDark, ['dust']); else hat(g, 'headband', dye(PIG.madder, r), PIG.cream);
      garb(g, 'apron', dye(r.pick([PIG.grey, PIG.russet, PIG.cream]), r), dye(PIG.leather, r), ['soot']); tool(g, 'hammer'); g.marks.soot = true; g.garb.shW *= 1.1;
      break;
    case 'carpenter':
      hat(g, 'cap', dye(r.pick([PIG.green, PIG.russet, PIG.ochre, PIG.woad]), r), PIG.cream, r.chance(0.5) ? ['tip'] : [], r.jit(5)); garb(g, 'apron', humble, dye(PIG.leather, r)); tool(g, 'saw'); g.marks.quill = false; g.marks.pipe = false;
      break;
    case 'weaver':
      if (fem(g)) hat(g, r.chance(0.7) ? 'kerchief' : 'wimple', r.chance(0.7) ? cloth(r) : linen, cloth(r)); else hat(g, 'cap', cloth(r), cloth(r), ['tip']);
      garb(g, fem(g) ? 'kirtle' : 'tunic', cloth(r), cloth(r), ['scarf']); tool(g, 'distaff');
      break;
    case 'brewer':
      if (r.chance(0.6)) hat(g, 'cap', dye(r.pick([PIG.brown, PIG.ochre, PIG.green]), r), PIG.cream, [], r.jit(6)); else hat(g, 'kerchief', dye(r.pick([PIG.madder, PIG.ochre, PIG.cream]), r), PIG.cream);
      garb(g, 'apron', humble, dye(PIG.ochre, r)); tool(g, 'tankard'); g.nose.red = r.chance(0.6) ? 0.7 : 0; g.blush = Math.max(g.blush, 0.5);
      break;
    case 'innkeeper':
      if (r.chance(0.45)) hat(g, 'kerchief', dye(r.pick([PIG.madder, PIG.cream, PIG.woad]), r), PIG.cream); else if (r.chance(0.5)) hat(g, 'cap', dye(PIG.russet, r), PIG.cream);
      garb(g, 'apron', cloth(r), linen, ['towel']); tool(g, 'tankard'); g.blush = Math.max(g.blush, 0.5); if (g.fem < 0 && g.beard.stache === 'none' && r.chance(0.5)) g.beard.stache = 'walrus';
      break;
    case 'merchant':
      hat(g, 'chaperon', dye(r.pick([PIG.wine, PIG.woad, PIG.forest, PIG.plum, PIG.madder]), r), PIG.gold, ['badge']); garb(g, 'fur', dye(r.pick([PIG.wine, PIG.woad, PIG.forest, PIG.plum]), r), dye('#c9b08a', r), ['chain']); tool(g, 'purse');
      break;
    case 'bard':
      hat(g, 'bycocket', dye(r.pick([PIG.madder, PIG.green, PIG.woad, PIG.plum, PIG.weld]), r), PIG.cream, ['feather']); garb(g, 'livery', dye(r.pick([PIG.madder, PIG.weld, PIG.green]), r), dye(r.pick([PIG.woad, PIG.cream, PIG.plum]), r), ['lacing']); tool(g, 'lute');
      break;
    case 'alchemist':
      if (r.chance(0.55)) hat(g, 'skullcap', dye(r.pick([PIG.plum, PIG.black, PIG.forest]), r), PIG.gold); else g.hair.style = g.hair.style === 'bald' ? 'horseshoe' : 'wild';
      garb(g, 'robe', dye(r.pick([PIG.plum, PIG.forest, PIG.slate, PIG.wine]), r), PIG.cream, ['soot']); tool(g, 'flask'); g.marks.soot = true; g.brows.singed = true; if (r.chance(0.5)) g.marks.specs = 'round';
      break;
    case 'wizard': {
      const c = dye(r.pick([PIG.indigo, PIG.violet, PIG.lapis, PIG.plum, PIG.forest]), r);
      hat(g, 'pointed', c, PIG.gold, ['stars'], r.jit(4)); garb(g, 'robe', c, mixc(c, PIG.cream, 0.6), ['stars']); tool(g, 'staff');
      if (g.fem < 0.15 && g.kind !== 'halfling' && g.kind !== 'elf' && g.kind !== 'goblin' && g.kind !== 'ogre') { g.beard.style = r.pick(['long', 'long', 'forked'] as const); g.beard.stache = 'droop'; g.beard.len = r.range(1.1, 1.4); }
      if (r.chance(0.5)) g.brows.style = 'wing';
      break;
    }
    case 'hedge_witch':
      if (r.chance(0.7)) hat(g, 'witch', dye(r.pick([PIG.moss, PIG.black, PIG.brown, PIG.plum]), r), PIG.ochre, ['sprig'], r.jit(6)); else hat(g, 'kerchief', dye(PIG.moss, r), PIG.cream, ['sprig']);
      garb(g, 'shawl', dye(r.pick([PIG.forest, PIG.moss, PIG.brown, PIG.plum]), r), cloth(r)); tool(g, r.chance(0.4) ? 'cat' : 'broom'); g.marks.mole = r.chance(0.6); if (r.chance(0.3)) g.mouth.teeth = 'snag';
      break;
    case 'scribe':
      if (r.chance(0.65)) hat(g, 'beret', dye(r.pick([PIG.black, PIG.woad, PIG.wine]), r), PIG.cream); else if (g.fem < 0.15 && r.chance(0.6)) g.hair.style = 'tonsure';
      garb(g, 'robe', dye(r.pick([PIG.black, PIG.grey, PIG.brown, PIG.woad]), r), linen); tool(g, 'scroll'); g.marks.quill = true; g.marks.inkstain = true; if (r.chance(0.35)) g.marks.specs = r.pick(['round', 'pince'] as const);
      break;
    case 'guard':
      hat(g, 'kettle', PIG.steel, r.chance(0.6) ? PIG.steelDark : PIG.cream); g.hat.variant = r.chance(0.6) ? 1 : 0;
      garb(g, 'mail', dye(r.pick([PIG.madder, PIG.woad, PIG.forest, PIG.weld]), r), PIG.steel, ['badge']); tool(g, 'spear');
      break;
    case 'hunter':
      if (r.chance(0.55)) hat(g, 'bycocket', dye(r.pick([PIG.forest, PIG.green, PIG.moss]), r), PIG.cream, ['feather']); else hat(g, 'hood', dye(r.pick([PIG.forest, PIG.moss, PIG.brown]), r), PIG.cream);
      garb(g, 'cowl', dye(r.pick([PIG.forest, PIG.moss, PIG.brown]), r), dye(PIG.leather, r), ['baldric']); tool(g, 'bow'); if (r.chance(0.3)) g.marks.scar = 'cheek';
      break;
    case 'fishmonger':
      hat(g, 'knit', dye(r.pick([PIG.woad, PIG.madder, PIG.teal, PIG.grey]), r), dye(PIG.cream, r), ['tip']); garb(g, 'apron', dye(r.pick([PIG.sky, PIG.teal, PIG.grey]), r), dye(PIG.slate, r)); tool(g, 'fish');
      break;
    case 'beekeeper':
      hat(g, 'skep', dye(PIG.straw, r), PIG.strawDark); garb(g, 'tunic', dye(r.pick([PIG.cream, PIG.ochre, PIG.weld]), r), PIG.cream); tool(g, 'bees');
      break;
    case 'gravedigger':
      if (r.chance(0.6)) hat(g, 'widebrim', dye(PIG.black, r), PIG.slate, [], r.jit(5)); else hat(g, 'hood', dye(PIG.black, r), PIG.slate);
      garb(g, 'cowl', dye(r.pick([PIG.black, PIG.slate, PIG.brown]), r), PIG.slate); tool(g, 'shovel'); g.blush *= 0.3; g.eyes.bag = Math.max(g.eyes.bag, 0.6); g.rest = { ...g.rest, smile: Math.min(g.rest.smile ?? 0, -0.05) };
      break;
    case 'adventurer':
      if (r.chance(0.45)) hat(g, 'headband', dye(r.pick([PIG.madder, PIG.woad, PIG.weld]), r), PIG.cream); else if (r.chance(0.5)) hat(g, 'cap', dye(PIG.leather, r), PIG.leatherDark, ['patch'], r.jit(6));
      garb(g, 'jerkin', dye(PIG.leather, r), cloth(r), ['baldric']); tool(g, 'sword'); g.marks.scar = r.chance(0.7) ? r.pick(['cheek', 'brow'] as const) : g.marks.scar; g.marks.patch = r.chance(0.2);
      if (g.beard.style === 'none' && g.fem < 0 && r.chance(0.6)) g.beard.style = 'stubble';
      break;
    case 'cheesemonger':
      if (r.chance(0.6)) hat(g, 'beret', dye(r.pick([PIG.weld, PIG.cream, PIG.mustard]), r), PIG.russet, [], r.jit(4)); else hat(g, 'coif', linen);
      garb(g, 'apron', cloth(r), linen); tool(g, 'cheese');
      break;
    case 'candlemaker':
      hat(g, 'cap', dye(r.pick([PIG.russet, PIG.woad, PIG.green, PIG.plum]), r), PIG.cream, ['candle']); garb(g, 'tunic', humble, PIG.cream, ['wax']); tool(g, 'candles');
      break;
    case 'ratcatcher':
      hat(g, 'widebrim', dye(r.pick([PIG.brown, PIG.olive, PIG.grey]), r), PIG.russet, ['rat', 'patch'], r.jit(8)); garb(g, 'cowl', dye(r.pick([PIG.brown, PIG.olive, PIG.grey]), r), humble, ['patches']); tool(g, r.chance(0.45) ? 'rat' : 'none');
      if (r.chance(0.3)) g.mouth.teeth = 'snag'; if (g.beard.style === 'none' && g.fem < 0 && r.chance(0.6)) g.beard.style = 'stubble';
      break;
    case 'fortune_teller':
      hat(g, 'kerchief', dye(r.pick([PIG.plum, PIG.indigo, PIG.wine, PIG.teal]), r), PIG.gold, ['stars', 'coins']); garb(g, 'shawl', dye(r.pick([PIG.wine, PIG.plum, PIG.indigo]), r), cloth(r), ['stars']); tool(g, 'orb'); g.marks.earring = 'hoops'; g.marks.mole = r.chance(0.5);
      break;
    case 'tax_clerk':
      if (r.chance(0.6)) hat(g, 'beret', dye(PIG.black, r), PIG.cream, ['badge']); else hat(g, 'skullcap', dye(PIG.black, r), PIG.cream);
      garb(g, 'robe', dye(r.pick([PIG.black, PIG.slate]), r), linen); tool(g, 'abacus'); g.marks.quill = true; if (r.chance(0.7)) g.marks.specs = r.pick(['pince', 'tiny'] as const);
      break;
    case 'herbalist':
      if (r.chance(0.6)) hat(g, 'wreath', dye(PIG.green, r), PIG.cream, ['flowers']); else if (r.chance(0.5)) hat(g, 'kerchief', dye(r.pick([PIG.green, PIG.cream, PIG.rose]), r), PIG.cream, ['sprig']); else hat(g, 'straw', dye(PIG.straw, r), PIG.green, ['flowers'], r.jit(6));
      garb(g, 'apron', dye(r.pick([PIG.green, PIG.cream, PIG.rose, PIG.olive]), r), linen); tool(g, 'herbs'); if (r.chance(0.4)) g.marks.freckles = 0.8;
      break;
  }
}

/** The household's liveries: each delegate is recognisable by silhouette and colour before the face. */
export function dressRole(role: StaffRole, g: Genome, r: Rand): void {
  g.hat.variant = r.int(0, 3);
  switch (role) {
    case 'mason':
      if (r.chance(0.6)) hat(g, 'cap', dye(PIG.leather, r), PIG.leatherDark, ['dust']); else hat(g, 'coif', dye(PIG.linen, r, 0.03), PIG.cream, ['dust']);
      garb(g, 'apron', dye(PIG.ochre, r), dye(PIG.leather, r), ['dust']); tool(g, 'trowel'); g.marks.flour = true; g.garb.shW *= 1.06;
      if (g.beard.style === 'none' && g.fem < 0 && r.chance(0.5)) g.beard.style = 'stubble';
      g.ground = 'lapis';
      break;
    case 'bailiff':
      if (r.chance(0.55)) hat(g, 'beret', dye(PIG.black, r), PIG.silver, ['badge']); else hat(g, 'hood', dye(PIG.black, r), PIG.redDeep);
      garb(g, 'livery', dye(PIG.madder, r, 0.03), dye(PIG.black, r, 0.03), ['chain', 'keys']); tool(g, 'writ');
      g.ground = 'lapis';
      break;
    case 'crier':
      hat(g, 'beret', dye(PIG.madder, r, 0.03), PIG.weld, ['plumes'], r.jit(5));
      garb(g, 'livery', dye(PIG.madder, r, 0.03), dye(PIG.weld, r, 0.03), ['lacing']); tool(g, 'bell');
      g.ground = 'lapis';
      break;
    case 'steward':
      if (r.chance(0.6)) hat(g, 'skullcap', dye(PIG.lapis, r, 0.03), PIG.gold); else hat(g, 'chaperon', dye(PIG.lapis, r, 0.03), PIG.gold);
      garb(g, 'fur', dye(PIG.lapis, r, 0.03), dye('#d6c29a', r), ['chain', 'keys']); tool(g, 'ledger'); g.marks.quill = true; if (r.chance(0.4)) g.marks.specs = r.pick(['pince', 'round', 'tiny'] as const);
      g.ground = 'red';
      break;
  }
}

/** The player's own face, dressed by rank: a cap for the Reeve, then circlet, coronet and crown. */
export function dressRuler(rank: RankId, g: Genome, r: Rand): void {
  g.ground = 'red';
  switch (rank) {
    case 'reeve':
      hat(g, 'cap', dye(r.pick([PIG.forest, PIG.woad, PIG.russet]), r), PIG.cream, ['badge', 'feather'], r.jit(4)); garb(g, 'cowl', dye(r.pick([PIG.forest, PIG.russet, PIG.woad]), r), PIG.cream, ['pendant']);
      break;
    case 'knight':
      hat(g, 'circlet', PIG.gold, PIG.madder); garb(g, 'tabard', dye(r.pick([PIG.madder, PIG.woad, PIG.forest]), r), PIG.weld, ['badge']); g.garb.c2 = PIG.steel;
      g.ground = 'lapis';
      break;
    case 'baron':
      hat(g, 'coronet', PIG.gold, PIG.madder); garb(g, 'fur', dye(r.pick([PIG.wine, PIG.woad, PIG.forest]), r), dye('#d9c8a4', r), ['chain']);
      g.ground = 'lapis';
      break;
    case 'duke':
      hat(g, 'ducal', PIG.gold, PIG.madder); garb(g, 'ermine', dye(PIG.wine, r), PIG.linen, ['chain']);
      g.ground = 'lapis';
      break;
    case 'king':
      hat(g, 'crown', PIG.gold, PIG.madder); garb(g, 'ermine', dye(PIG.madder, r, 0.03), PIG.linen, ['chain', 'brooch']);
      g.ground = 'lapis';
      break;
  }
}

// ───────────── the court's visitors ─────────────

export const NPC_SEEDS = Object.fromEntries(NPCS.map(id => [id, hashStr('court:' + id)])) as Record<NpcId, number>;

function shape(g: Genome, skull: number, cheekTop: number, cheek: number, jaw: number, chinW: number, H: number, chinFlat: number): void {
  const k: Record<string, number> = { human: 1, halfling: 1.04, dwarf: 1.1, goblin: 1, elf: 0.9, ogre: 1.5, dragon: 1 };
  const s = k[g.kind] ?? 1;
  const hd: HeadShape = g.head;
  // keep the species' scale and crown height; take the visitor's proportions
  const scaleH = hd.H / 92;
  g.head = { ...hd, skull: skull * s, cheekTop: cheekTop * s, cheek: cheek * s, jaw: jaw * s, chinW: chinW * s, H: g.kind === 'human' ? H : H * scaleH * (g.kind === 'elf' ? 0.92 : 1), chinFlat };
  const chin = g.head.top + g.head.H;
  g.eyes.y = g.head.top + g.head.H * 0.5; g.noseY = g.eyes.y + g.nose.len; g.mouth.y = Math.min(g.noseY + 8, chin - 11); g.ears.y = (g.eyes.y + g.noseY) / 2;
  g.eyes.gap = g.head.cheekTop * 0.48;
}
function nose(g: Genome, kind: NoseKind, len: number, out: number, tip: number, wide: number): void {
  g.nose = { kind, len, out, tip, wide, red: 0 };
  const chin = g.head.top + g.head.H;
  g.noseY = g.eyes.y + len; g.mouth.y = Math.min(g.noseY + 8, chin - 11);
}
function hairc(g: Genome, c: string, browMix = 0.35): void { g.hair.color = c; g.beard.color = c; g.brows.color = mixc(c, PIG.ink, browMix); }
function cleanFace(g: Genome): void {
  g.marks.scar = 'none'; g.marks.patch = false; g.marks.freckles = 0; g.marks.mole = false; g.marks.soot = false; g.marks.flour = false;
  g.marks.specs = 'none'; g.marks.earring = 'none'; g.marks.quill = false; g.mouth.teeth = g.kind === 'goblin' ? 'goblin' : g.kind === 'ogre' ? 'tusks' : 'plain';
  g.beard.style = g.kind === 'dwarf' ? g.beard.style : 'none'; g.beard.stache = g.kind === 'dwarf' ? g.beard.stache : 'none'; g.brows.uni = false; g.brows.singed = false;
}

export function dressNpc(id: NpcId, g: Genome, r: Rand): void {
  if (g.kind === 'dragon') {
    // the adjuster: a clerk's collar, a ledger, and a very small hat between the horns
    hat(g, 'beret', PIG.black, PIG.gold, ['badge']); g.hat.tiny = true;
    garb(g, 'scales', '#b9502e', '#e8c98a', ['bowtie']); tool(g, 'ledger'); g.toolSide = -1; g.ground = 'lapis';
    return;
  }
  const human = g.kind === 'human';
  cleanFace(g);
  g.hat.variant = 0;
  switch (id) {
    case 'crown_herald':
      // tabard, trumpet, and the expression of a man who has been announced
      if (human) shape(g, 34, 36.5, 36, 30, 15, 88, 0.5);
      g.age = 0.3; g.fem = -0.5; g.marks.wrinkles = 0; g.dir = -1; g.toolSide = 1;
      nose(g, 'snub', 14, 5, 3.4, 5); g.mouth.w = 8.5; g.mouth.lipL = 1.6;
      g.hair.style = 'pageboy'; hairc(g, '#d6ad55'); g.hair.vol = 1.1;
      g.brows.style = 'arch'; g.brows.arch = 3.2; g.brows.gapY = 6.5; g.brows.thick = 2.4;
      g.eyes.lidRest = 0.8; g.eyes.iris = IRIS.blue; g.blush = 0.55;
      hat(g, 'beret', PIG.madder, PIG.gold, ['plumes', 'badge'], -5); garb(g, 'tabard', PIG.madder, PIG.lapis, ['badge']); tool(g, 'trumpet');
      g.rest = { browIn: 1.4, browOut: 1.8, smile: -0.05, tilt: -2.4, lid: 0.9 }; g.ground = 'lapis';
      break;
    case 'royal_assessor':
      // has seen your roof. Has seen worse. Is writing it down anyway
      if (human) shape(g, 30, 29.5, 27, 22, 11, 100, 0.3);
      g.age = 0.72; g.fem = -0.4; g.marks.wrinkles = 0.7; g.dir = 1; g.toolSide = -1;
      nose(g, 'droop', 24, 7.5, 4, 5.4); g.mouth.w = 9; g.mouth.lipU = 0; g.mouth.lipL = 0.6;
      g.hair.style = 'wispy'; hairc(g, HAIR.grey, 0.25); g.eyes.lidRest = 0.58; g.eyes.bag = 0.9; g.eyes.tilt = -1.6; g.eyes.iris = IRIS.grey;
      g.brows.style = 'thin'; g.brows.thick = 2; g.brows.slope = 2.2; g.brows.gapY = 5; g.blush = 0.08; g.marks.specs = 'pince';
      hat(g, 'beret', PIG.black, PIG.grey, [], 3); garb(g, 'highcollar', dye(PIG.slate, r, 0.02), PIG.linen, ['pendant']); tool(g, 'tablet');
      g.rest = { browIn: 1.6, browOut: -1, smile: -0.35, lid: 1, gazeY: 0.15 }; g.ground = 'red';
      break;
    case 'tax_collector':
      // stout, cheerful, and already counting
      if (human) shape(g, 31, 35, 39.5, 37, 18, 90, 0.6);
      g.age = 0.5; g.fem = -0.6; g.marks.wrinkles = 0.2; g.marks.doubleChin = true; g.dir = -1; g.toolSide = 1;
      nose(g, 'bulb', 15, 4.5, 5.6, 6.2); g.mouth.w = 9.5; g.eyes.w = 6.6; g.eyes.h = 4.6; g.eyes.irisR = 3.5; g.eyes.gap = 13.5; g.eyes.iris = IRIS.dark;
      g.hair.style = 'horseshoe'; hairc(g, HAIR.black); g.beard.stache = 'pencil'; g.brows.style = 'taper'; g.brows.thick = 3; g.brows.arch = 2.4; g.blush = 0.5;
      hat(g, 'chaperon', '#2f3d33', PIG.gold, ['badge']); garb(g, 'fur', PIG.black, '#b79a6c', ['chain', 'pendant']); tool(g, 'strongbox');
      g.rest = { smile: 0.3, squint: 0.2, browIn: -0.4, lid: 0.85 }; g.ground = 'red';
      break;
    case 'rival_lord':
      // rolled per reign, always dressed the same: the neighbour with the better tailor
      if (human && g.head.cheek > 34) shape(g, 34, 33, 29.5, 22, 10, 95, 0.25);
      g.age = Math.min(g.age, 0.55); g.fem = -0.5; g.marks.wrinkles = Math.min(g.marks.wrinkles, 0.3);
      g.hair.style = 'widow'; hairc(g, r.pick([HAIR.black, HAIR.dark, '#3a2a30', HAIR.auburn])); g.hair.grey = 0;
      g.beard.style = 'goatee'; g.beard.stache = r.pick(['handlebar', 'pencil'] as const); g.beard.len = 1.15;
      g.brows.style = 'arch'; g.brows.arch = 3.4; g.brows.thick = 2.6; g.brows.slope = -1.6; g.eyes.tilt = 2; g.eyes.lidRest = 0.74; g.blush = 0.15;
      if (g.nose.kind === 'button' || g.nose.kind === 'bulb' || g.nose.kind === 'potato') nose(g, 'roman', 20, 8, 3.2, 5.2);
      hat(g, 'coronet', PIG.silver, PIG.wine); garb(g, 'highcollar', dye(r.pick([PIG.black, PIG.wine, '#2f2a44']), r, 0.03), dye(PIG.wine, r), ['chain', 'brooch']); tool(g, 'goblet');
      g.rest = { smile: 0.22, skew: 0.55, browSkew: 1.4, lid: 0.95, tilt: -1.8 }; g.ground = 'red';
      break;
    case 'moneylender':
      // tiny spectacles, a patient smile, all the time in the world
      if (human) shape(g, 35, 38, 38.5, 32, 16, 85, 0.5);
      g.age = 0.62; g.fem = -0.3; g.marks.wrinkles = 0.35; g.dir = 1; g.toolSide = -1;
      nose(g, 'button', 11.5, 2.6, 3.2, 4.6); g.mouth.w = 10.5; g.mouth.lipL = 1.2;
      g.hair.style = 'horseshoe'; hairc(g, HAIR.white, 0.15); g.eyes.w = 7.4; g.eyes.h = 5.2; g.eyes.irisR = 3.9; g.eyes.lidRest = 0.8; g.eyes.iris = IRIS.hazel; g.eyes.tilt = -0.6;
      g.brows.style = 'thin'; g.brows.thick = 2; g.brows.arch = 2.8; g.brows.gapY = 6; g.blush = 0.5; g.marks.specs = 'tiny';
      hat(g, 'skullcap', PIG.plum, PIG.gold); garb(g, 'fur', PIG.plum, '#d9c8a4', ['chain']); tool(g, 'scales');
      g.rest = { smile: 0.5, squint: 0.3, browIn: 1, browOut: 0.6, lid: 0.9 }; g.ground = 'lapis';
      break;
    case 'bishop':
      // gentle parish comedy under a very tall hat
      if (human) shape(g, 31, 34.5, 38.5, 36, 18, 91, 0.6);
      g.age = 0.75; g.fem = -0.4; g.marks.wrinkles = 0.45; g.marks.doubleChin = true; g.dir = -1; g.toolSide = 1;
      nose(g, 'potato', 16, 4.5, 5.2, 7.6); g.nose.red = 0.35; g.mouth.w = 10;
      g.hair.style = 'horseshoe'; hairc(g, HAIR.white, 0.12); g.brows.style = 'bushy'; g.brows.thick = 3.8; g.brows.slope = 1.6; g.eyes.lidRest = 0.82; g.eyes.iris = IRIS.blue; g.blush = 0.62;
      hat(g, 'mitre', PIG.linen, PIG.gold); garb(g, 'mantle', '#e9dcb8', PIG.gold, ['brooch']); g.garb.c2 = PIG.madder; tool(g, 'crozier');
      g.rest = { smile: 0.3, browIn: 1.2, squint: 0.15, lid: 0.95 }; g.ground = 'red';
      break;
    case 'guild_inspector':
      // measures everything, twice, and finds it short
      if (human) shape(g, 34, 34.5, 34.5, 33, 20, 89, 0.9);
      g.age = 0.55; g.fem = -0.7; g.marks.wrinkles = 0.4; g.dir = 1; g.toolSide = -1;
      nose(g, 'roman', 19, 8, 3.8, 6); g.mouth.w = 10;
      g.hair.style = 'crop'; hairc(g, '#7a5a3a'); g.beard.stache = 'walrus'; g.beard.style = g.kind === 'dwarf' ? g.beard.style : 'chops';
      g.brows.style = 'bushy'; g.brows.thick = 4.2; g.brows.gapY = 2.4; g.eyes.lidRest = 0.82; g.marks.specs = 'monocle'; g.blush = 0.3;
      hat(g, 'beret', PIG.wine, PIG.gold, ['badge'], 4); garb(g, 'robe', PIG.forest, PIG.cream, ['chain', 'pendant']); tool(g, 'rod');
      g.rest = { browIn: -1.5, browSkew: 1.2, smile: -0.25, skew: -0.2 }; g.ground = 'lapis';
      break;
    case 'travelling_wizard':
      // patched hat, beard to the belt, staff with something glowing in it
      if (human) shape(g, 30.5, 30.5, 28.5, 23, 12, 97, 0.4);
      g.age = 0.9; g.fem = -0.6; g.marks.wrinkles = 0.75; g.dir = -1; g.toolSide = 1;
      nose(g, 'roman', 22, 10, 4, 5.8); g.mouth.w = 9.5;
      g.hair.style = 'long'; hairc(g, HAIR.white, 0.12); g.beard.style = 'long'; g.beard.stache = 'droop'; g.beard.len = 1.45;
      g.brows.style = 'wing'; g.brows.thick = 4.4; g.brows.len = 1.3; g.eyes.iris = IRIS.ice; g.eyes.lidRest = 0.9; g.blush = 0.35;
      hat(g, 'pointed', '#5a3f7a', PIG.gold, ['stars', 'patch'], -5); g.hat.variant = 2; garb(g, 'mantle', '#566a86', PIG.gold, ['brooch', 'stars', 'patches']); g.garb.c2 = '#5a3f7a'; tool(g, 'staff');
      g.rest = { smile: 0.3, squint: 0.2, browIn: 0.6, browSkew: 0.8 }; g.ground = 'red';
      break;
    case 'goblin_chief':
      // chairs the committee. There are sub-committees
      g.age = 0.6; g.dir = 1; g.toolSide = -1; g.skin = '#86b35c'; g.skinShade = shadeOf(mixc(g.skin, '#3f6a3a', 0.25), 0.2);
      g.head = { ...g.head, skull: 39, cheekTop: 39.5, cheek: 33, jaw: 23, chinW: 10, H: 80, chinFlat: 0.25 };
      g.eyes.y = g.head.top + 40; nose(g, 'droop', 15, 6, 3.4, 4.4); g.mouth.y = Math.min(g.noseY + 7.5, g.head.top + g.head.H - 10); g.mouth.w = 19;
      g.eyes.w = 10.4; g.eyes.h = 8; g.eyes.gap = 18.5; g.eyes.white = '#f6e06a'; g.eyes.iris = '#a83a2a'; g.eyes.irisR = 3.6; g.eyes.pupil = 'dot'; g.eyes.lidRest = 0.84;
      g.brows.style = 'ridge'; g.brows.thick = 3; g.hair.style = 'bald'; g.ears.size = 1.3; g.marks.earring = 'ring'; g.marks.specs = 'pince'; g.marks.wrinkles = 0.4;
      hat(g, 'paperhat', PIG.parch, PIG.rubric); garb(g, 'robe', PIG.wine, PIG.linen, ['seals', 'bowtie']); tool(g, 'gavel');
      g.rest = { smile: 0.3, open: 0.14, teeth: 1, browIn: -1.2, browSkew: 0.8, tilt: -1.5 }; g.ground = 'red';
      break;
    case 'commons_warden':
      // the busybody of busybodies, with a list
      if (human) shape(g, 31, 30, 27.5, 21, 10, 96, 0.25);
      g.age = 0.6; g.fem = 0.8; g.marks.wrinkles = 0.4; g.dir = 1; g.toolSide = -1;
      nose(g, 'pointed', 23, 12, 2.4, 4.6); g.mouth.w = 7.5; g.mouth.lipU = 0.4; g.mouth.lipL = 0.8;
      g.hair.style = 'bun'; hairc(g, '#8f8578'); g.eyes.w = 7.6; g.eyes.h = 5; g.eyes.irisR = 3.6; g.eyes.lidRest = 0.78; g.eyes.tilt = 1.6; g.eyes.iris = IRIS.grey; g.eyes.lash = true;
      g.brows.style = 'thin'; g.brows.thick = 1.9; g.brows.arch = 3.8; g.brows.gapY = 6.5; g.brows.slope = -1.4; g.blush = 0.2; g.marks.specs = 'pince';
      hat(g, 'wimple', PIG.linen, PIG.teal); garb(g, 'highcollar', PIG.teal, PIG.linen, ['sash', 'brooch']); tool(g, 'scroll');
      g.rest = { browIn: 0.4, browOut: 1.6, smile: -0.22, lid: 0.95, tilt: -2.2 }; g.ground = 'red';
      break;
    case 'reeves_court_judge':
      // slow. Has been considering your case since the old king
      if (human) shape(g, 31, 32.5, 34.5, 31, 16, 96, 0.6);
      g.age = 1; g.fem = -0.3; g.marks.wrinkles = 1; g.marks.doubleChin = true; g.dir = -1; g.toolSide = 1;
      nose(g, 'droop', 23, 6.5, 4.6, 6); g.mouth.w = 9; g.mouth.lipU = 0; g.mouth.lipL = 0.5;
      g.hair.style = 'wispy'; hairc(g, HAIR.white, 0.1); g.eyes.lidRest = 0.46; g.eyes.bag = 1; g.eyes.tilt = -2; g.eyes.iris = IRIS.grey;
      g.brows.style = 'wing'; g.brows.thick = 4; g.brows.slope = 2.4; g.brows.gapY = 3.5; g.blush = 0.12;
      hat(g, 'judgecap', PIG.linen, PIG.madder); garb(g, 'ermine', PIG.madder, PIG.linen, []); tool(g, 'hourglass');
      g.rest = { browIn: 0.8, browOut: -1.2, smile: -0.2, lid: 1, gazeY: 0.2, tilt: 2, dy: 1 }; g.ground = 'lapis';
      break;
    case 'wandering_knight':
      // a quest, a moustache, and nowhere to stable the horse
      if (human) shape(g, 33.5, 34, 34, 32.5, 20, 92, 0.9);
      g.age = 0.4; g.fem = -0.8; g.marks.wrinkles = 0.15; g.dir = -1; g.toolSide = 1;
      nose(g, 'broken', 18, 6.5, 3.8, 6); g.mouth.w = 10.5;
      g.hair.style = 'crop'; hairc(g, '#c98a3a'); g.beard.stache = 'handlebar'; g.beard.style = g.kind === 'dwarf' ? g.beard.style : 'none';
      g.brows.style = 'taper'; g.brows.thick = 3.6; g.eyes.iris = IRIS.blue; g.eyes.lidRest = 1.02; g.marks.scar = 'cheek'; g.blush = 0.4;
      hat(g, 'bascinet', PIG.steel, PIG.madder, ['plumes']); garb(g, 'mail', PIG.weld, PIG.steel, ['badge']); tool(g, 'lance');
      g.rest = { browIn: 1.4, browOut: 0.4, smile: 0.2, lid: 1.04 }; g.ground = 'lapis';
      break;
    case 'mysterious_stranger':
      // a hood, a shadow, two eyes. Pays in old coin
      if (human) shape(g, 32, 32, 29.5, 24, 12, 94, 0.4);
      g.age = 0.45; g.fem = -0.2; g.marks.wrinkles = 0.2; g.dir = 1; g.toolSide = -1;
      nose(g, 'straight', 18, 6, 3, 5); g.mouth.w = 9.5;
      g.hair.style = 'shaggy'; hairc(g, HAIR.black); g.beard.style = g.kind === 'dwarf' ? g.beard.style : 'stubble';
      g.brows.style = 'flat'; g.brows.thick = 3; g.eyes.iris = IRIS.goldI; g.eyes.lidRest = 0.7; g.eyes.tilt = 1.5; g.blush = 0.05; g.marks.scar = 'lip';
      hat(g, 'deephood', '#2f2c35', '#1f1d25'); garb(g, 'mantle', '#2f2c35', PIG.silver, ['brooch']); g.garb.c2 = '#3a3340'; tool(g, 'raven');
      g.shadowed = true;
      g.rest = { browIn: -0.8, smile: 0.08, skew: 0.3, lid: 1, gazeX: -0.3 }; g.ground = 'red';
      break;
    case 'your_mother':
      // thinks you should have gone into the church. Brought a spoon
      if (human) shape(g, 33.5, 35.5, 35, 28, 14, 89, 0.45);
      g.age = 0.7; g.fem = 1; g.marks.wrinkles = 0.5; g.dir = -1; g.toolSide = 1;
      nose(g, 'snub', 14.5, 4.5, 3.6, 5.4); g.mouth.w = 9.5; g.mouth.lipU = 0.8; g.mouth.lipL = 1.4;
      g.hair.style = 'bun'; hairc(g, HAIR.grey, 0.3); g.eyes.w = 8.4; g.eyes.h = 5.8; g.eyes.irisR = 4.2; g.eyes.lidRest = 0.86; g.eyes.iris = IRIS.brown; g.eyes.lash = true; g.eyes.bag = 0.3;
      g.brows.style = 'arch'; g.brows.thick = 2.4; g.brows.arch = 3; g.brows.gapY = 5.5; g.blush = 0.6; g.marks.mole = true;
      hat(g, 'wimple', PIG.linen, dye(PIG.woad, r, 0.02)); garb(g, 'shawl', dye(PIG.rose, r, 0.02), PIG.woad, ['brooch']); tool(g, 'spoon');
      g.rest = { browSkew: 2, browIn: 0.6, smile: 0.28, skew: 0.3, lid: 0.95, tilt: 1.6 }; g.ground = 'lapis';
      break;
    case 'dragon_adjuster':
      break;
  }
}
