/** OWNER: sim-people agent. Households: rolling them, applicants, moving in and out, mood, memory. */
import type {
  GameState, SimModule, Tenant, Applicant, Id, MoveOutReason, Building, DecisionType, ActionResult, Job, RankId,
} from './types';
import type { Species, TradeId, TraitId, TenantTag, PetKind, BuildingType } from '../data/ids';
import type { CharacterDef, BarkKey } from '../data/schema';
import { BUILDINGS } from '../data/buildings';
import { BAL } from '../data/balance';
import { SPECIES_DEFS } from '../data/species';
import { TRADE_DEFS } from '../data/trades';
import { TRAIT_DEFS } from '../data/traits';
import { CHARACTERS } from '../data/characters';
import { BARKS } from '../data/barks';
import { INCIDENT_BY_ID } from '../data/incidents/index';
import { TRADES, TRAITS, SPECIES } from '../data/ids';
import {
  clamp, clamp100, emit, newId, dist, rand, randInt, randRange, chance, pick, weighted, herald, rankIndex,
  seasonOf, fill, baseVars, hash01, rulerTitle,
} from './core';
import { earn, marketRent, ASK_BY_HAND } from './economy';
import { changeRenown } from './renown';
import { desirability, entranceOf } from './world';
import { spawnActor, removeActor, walkTo, gatePoint } from './actors';
import { enqueueJob } from './jobs';
import { staffOf } from './staff';
import { speciesUnlocked } from './rank';
import { spawnDecision } from './incidents';
import { settleDeparture } from './rent';

export const TUNE = {
  /** share of rolled households that are a named character from data, when one fits */
  characterShare: 0.34,
  baseReliability: 0.78,
  memoryCap: 12,
  /** days a departed household stays on the rolls */
  keepDepartedDays: 60,
  /** monthly move of happiness toward its target */
  moodRate: 1 / 3,
  unhappyBelow: 25,
  unhappyMonths: 2,
  revealChancePerMonth: 0.12,
  visitLift: 6,
  visitRevealChance: 0.35,
  /** happiness a newly signed household starts with */
  startHappiness: 62,
  /** condition points of wear a typical household adds each month */
  wearPerMonth: 0.6,
  /** wear nobody may be billed for */
  honestWear: 4,
  noticeBoardBoost: 1.25,
  secretPetChancePerMonth: 0.15,
  /** renown lost when an applicant waits this many days and is then ignored or refused */
  longWaitDays: 5,
  /** nobody asks after a home whose rent would take more than this share of what they earn */
  maxRentShare: 0.5,
};

// ───────────── private bookkeeping ─────────────

/**
 * Bookkeeping the sim needs per household that the Tenant contract has no field for
 * (see the final report: CONTRACT REQUESTS). Plain JSON, lives on the tenant as `aux`,
 * always read through auxOf() so households built elsewhere simply get the defaults.
 */
export interface TenantAux {
  /** this month's rent, fallen due but neither paid nor yet counted as arrears */
  due: number;
  /** the day they mean to pay it (-1: nothing scheduled) */
  payDay: number;
  /** how much of `arrears` is late fees rather than rent */
  fees: number;
  /** how much of the purse on their step is late fees */
  purseFees: number;
  /** consecutive months spent below TUNE.unhappyBelow */
  low: number;
  /** next day the ruler should be asked to rule on them (late rent, the writ) */
  askDay: number;
  /** until this day they are trying hard to find the money */
  urgeUntil: number;
  /** daily chance of paying while that lasts */
  urgeP: number;
  /** day a Notice to Quit went up (-1: none) */
  noticeDay: number;
  /** 1: the notice was served over money owed (paying it all closes the case); 0: for other cause, or no case */
  cause: 0 | 1;
  /** day their purse was left so long they took it back (-1: never) */
  noFaultDay: number;
  /** percent the rent has already risen this lease term */
  raised: number;
  /** day they were asked about renewing (-1: not asked) */
  renewDay: number;
  /** where they lived, once they have left */
  home: Id | null;
  homeUnit: number;
  /** the surety: 0 nothing to settle, 1 awaiting inspection, 2 awaiting a ruling, 3 settled */
  dep: 0 | 1 | 2 | 3;
  depDay: number;
  depTries: number;
  /** crowns of real damage found at move-out */
  damage: number;
  lastVisit: number;
}

export function auxOf(t: Tenant): TenantAux {
  const o = t as Tenant & { aux?: Partial<TenantAux> };
  const a = (o.aux ??= {}) as Partial<TenantAux>;
  a.due ??= 0; a.payDay ??= -1; a.fees ??= 0; a.purseFees ??= 0; a.low ??= 0; a.askDay ??= 0;
  a.urgeUntil ??= -1; a.urgeP ??= 0; a.noticeDay ??= -1; a.cause ??= 0; a.noFaultDay ??= -1; a.raised ??= 0; a.renewDay ??= -1;
  a.home ??= null; a.homeUnit ??= 0; a.dep ??= 0; a.depDay ??= 0; a.depTries ??= 0; a.damage ??= 0; a.lastVisit ??= -999;
  return a as TenantAux;
}

function csvFlag(s: GameState, key: string): string[] {
  const v = s.flags[key];
  return typeof v === 'string' && v.length ? v.split(',') : [];
}
function setCsvFlag(s: GameState, key: string, list: string[]): void {
  if (list.length) s.flags[key] = list.join(','); else delete s.flags[key];
}

// ───────────── trait numbers ─────────────

type TraitNum = 'reliability' | 'happiness' | 'wear' | 'patience' | 'stay';
/** Used only where the content leaves a modifier undefined. */
const TRAIT_FALLBACK: Partial<Record<TraitId, Partial<Record<TraitNum, number>>>> = {
  punctual: { reliability: 0.12 }, forgetful: { reliability: -0.12 }, deadbeat: { reliability: -0.3, stay: 1.2 },
  ghost: { reliability: -0.05 }, saint: { reliability: 0.15, happiness: 1, wear: 0.6 },
  complainer: { happiness: -1.5, patience: 0.7 }, stoic: { happiness: 1, patience: 1.5 },
  handy: { wear: 0.6 }, messy: { wear: 1.6 }, tidy: { wear: 0.5 }, hoarder: { wear: 1.4 },
  pyromaniac: { wear: 1.5 }, brawler: { wear: 1.4 }, loyal: { happiness: 1, stay: 1.5 }, flighty: { stay: 0.6 },
  lucky: { reliability: 0.05 }, cursed: { reliability: -0.05, happiness: -0.5 }, gardener: { wear: 0.85 },
};
const TRAIT_NEUTRAL: Record<TraitNum, number> = { reliability: 0, happiness: 0, wear: 1, patience: 1, stay: 1 };

export function traitNum(trait: TraitId, key: TraitNum): number {
  const v = TRAIT_DEFS[trait]?.[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return TRAIT_FALLBACK[trait]?.[key] ?? TRAIT_NEUTRAL[key];
}
/** Sum (reliability, happiness) or product (wear, patience, stay) of a household's trait modifiers. */
export function traitTotal(traits: readonly TraitId[], key: TraitNum): number {
  if (key === 'reliability' || key === 'happiness') return traits.reduce((a, tr) => a + traitNum(tr, key), 0);
  return traits.reduce((a, tr) => a * traitNum(tr, key), 1);
}
export function reliabilityFor(traits: readonly TraitId[]): number {
  return clamp(TUNE.baseReliability + traitTotal(traits, 'reliability'), 0.2, 0.98);
}

// ───────────── rolling a household ─────────────

/** How common each quirk is before a species' own leanings are added (default 1). */
const TRAIT_RARITY: Partial<Record<TraitId, number>> = {
  deadbeat: 0.45, ghost: 0.4, pyromaniac: 0.2, cursed: 0.3, saint: 0.25, lucky: 0.4, brawler: 0.5,
  subletter: 0.6, secret_pet: 0.6, litigious: 0.6, snitch: 0.5, sleepwalker: 0.5, hoarder: 0.6, nocturnal: 0.7,
};
/** Quirks that cannot share a roof. */
const TRAIT_CLASHES: TraitId[][] = [
  ['punctual', 'forgetful', 'deadbeat', 'ghost'], ['messy', 'tidy', 'hoarder'], ['stoic', 'complainer'],
  ['loyal', 'flighty'], ['saint', 'deadbeat', 'brawler', 'pyromaniac', 'subletter', 'haggler'],
  ['pet_lover', 'secret_pet'], ['lucky', 'cursed'], ['generous', 'haggler'],
];
/** Trades a people drift toward. Flavour only: nobody is barred from anything. */
const SPECIES_TRADES: Record<Species, TradeId[]> = {
  human: ['farmer', 'shepherd', 'laborer', 'weaver', 'fishmonger', 'guard', 'carpenter'],
  halfling: ['baker', 'cheesemonger', 'beekeeper', 'brewer', 'innkeeper', 'farmer', 'herbalist'],
  dwarf: ['blacksmith', 'brewer', 'carpenter', 'miller', 'merchant', 'guard'],
  goblin: ['scribe', 'tax_clerk', 'ratcatcher', 'merchant', 'candlemaker', 'fortune_teller'],
  elf: ['bard', 'herbalist', 'scribe', 'hunter', 'alchemist', 'wizard', 'weaver'],
  ogre: ['laborer', 'gravedigger', 'shepherd', 'guard', 'farmer', 'blacksmith'],
};
const BUILDING_TRADES: Partial<Record<BuildingType, TradeId[]>> = {
  wizard_tower: ['wizard', 'alchemist', 'hedge_witch', 'fortune_teller'],
  treehouse: ['bard', 'hunter', 'herbalist', 'beekeeper'],
  stonehall: ['blacksmith', 'merchant', 'brewer', 'tax_clerk'],
  townhouse: ['merchant', 'scribe', 'tax_clerk', 'candlemaker', 'weaver'],
  hovel: ['laborer', 'farmer', 'shepherd', 'ratcatcher', 'gravedigger'],
};
/** How hard each people is on a house. */
const SPECIES_WEAR: Record<Species, number> = { human: 1, halfling: 0.8, dwarf: 0.9, goblin: 1.3, elf: 0.6, ogre: 1.8 };
const COMMON_PETS: PetKind[] = ['cat', 'dog', 'chicken', 'goat', 'pig', 'cat', 'dog'];
const SPECIES_PETS: Partial<Record<Species, PetKind[]>> = {
  halfling: ['giant_snail', 'chicken', 'pig'], elf: ['owl', 'cat'], ogre: ['goat', 'pig', 'wolf'], goblin: ['pig', 'chicken', 'owl'], dwarf: ['goat', 'dog'],
};

const rankOk = (s: GameState, r: RankId | undefined): boolean => rankIndex(s.realm.rank) >= rankIndex(r ?? 'reeve');

function speciesChoices(s: GameState, def: (typeof BUILDINGS)[BuildingType] | null): Species[] {
  let list = speciesUnlocked(s).filter(sp => SPECIES.includes(sp));
  if (!list.length) list = ['human'];
  if (def?.only?.length) {
    const only = list.filter(sp => def.only!.includes(sp));
    return only;
  }
  return list;
}

function rollSpecies(s: GameState, def: (typeof BUILDINGS)[BuildingType] | null): Species {
  let list = speciesChoices(s, def);
  if (!list.length) list = def?.only?.length ? [...def.only] : ['human'];
  return weighted(s, list, sp => Math.max(0.05, SPECIES_DEFS[sp]?.weight ?? 1) * (def?.prefers?.includes(sp) ? 3 : 1)) ?? 'human';
}

function rollTrade(s: GameState, species: Species, def: (typeof BUILDINGS)[BuildingType] | null, rent: number): TradeId {
  if (def?.category === 'commercial' && def.trades?.length) {
    const open = def.trades.filter(tr => rankOk(s, TRADE_DEFS[tr]?.minRank));
    const list = open.length ? open : def.trades;
    return weighted(s, list, tr => (SPECIES_TRADES[species].includes(tr) ? 2 : 1)
      * ((TRADE_DEFS[tr]?.income ?? 30) * TUNE.maxRentShare < rent ? 0.25 : 1)) ?? list[0]!;
  }
  // a household looks at homes it can afford: rent near three tenths of what the trade brings in
  const target = Math.max(12, rent / 0.3);
  const near = def ? BUILDING_TRADES[def.id] : undefined;
  const list = TRADES.filter(tr => rankOk(s, TRADE_DEFS[tr]?.minRank));
  const t = weighted(s, list.length ? list : TRADES, tr => {
    const income = Math.max(1, TRADE_DEFS[tr]?.income ?? 30);
    const off = Math.log(income / target);
    let w = Math.exp(-(off * off) / 0.72) + 0.04;
    if (income * TUNE.maxRentShare < rent) w *= 0.1;       // that trade could not carry this rent
    if (SPECIES_TRADES[species].includes(tr)) w *= 2.5;
    if (near?.includes(tr)) w *= 4;
    if (TRADE_DEFS[tr]?.shop) w *= 0.6;
    return w;
  });
  return t ?? 'laborer';
}

function nameTaken(s: GameState, name: string): boolean {
  for (const t of Object.values(s.tenants)) if (t.name === name) return true;
  for (const a of Object.values(s.applicants)) if (a.household.name === name) return true;
  for (const m of Object.values(s.staff)) if (m.name === name) return true;
  return false;
}

function rollName(s: GameState, species: Species, tags: TenantTag[]): { name: string; first: string } {
  const sd = SPECIES_DEFS[species];
  const firsts = sd?.firstNames?.length ? sd.firstNames : ['Wat'];
  const lasts = sd?.surnames?.length ? sd.surnames : [''];
  let first = firsts[0]!, name = first;
  for (let i = 0; i < 10; i++) {
    first = pick(s, firsts);
    const last = pick(s, lasts);
    name = last && last !== first ? `${first} ${last}` : first;
    if (!nameTaken(s, name)) break;
  }
  if (tags.includes('elder') && species !== 'elf' && !/^(Old|Little|Big|Young)\b/.test(name) && chance(s, 0.45)) name = `Old ${name}`;
  return { name, first };
}

function rollTraits(s: GameState, species: Species): TraitId[] {
  const n = weighted(s, [1, 2, 3], k => [0, 0.35, 0.45, 0.2][k]!) ?? 2;
  const bias = SPECIES_DEFS[species]?.traitBias ?? {};
  const out: TraitId[] = [];
  for (let i = 0; i < n; i++) {
    const tr = weighted(s, TRAITS, id => {
      if (out.includes(id)) return 0;
      for (const group of TRAIT_CLASHES) if (group.includes(id) && out.some(o => group.includes(o))) return 0;
      return Math.max(0, (TRAIT_RARITY[id] ?? 1) + (bias[id] ?? 0));
    });
    if (tr) out.push(tr);
  }
  return out.length ? out : ['stoic'];
}

function rollTags(s: GameState, species: Species, trade: TradeId, size: number): TenantTag[] {
  const tags: TenantTag[] = [];
  if (size >= 5) tags.push('large_family');
  if (chance(s, 0.5)) {
    const scholarly = trade === 'scribe' || trade === 'wizard' || trade === 'alchemist' || trade === 'tax_clerk';
    const tag = weighted<TenantTag>(s, ['widow', 'elder', 'veteran', 'newlyweds', 'scholar', 'noble_born', 'stranger', 'apprentice', 'pilgrim'], t => {
      switch (t) {
        case 'widow': return size <= 3 ? 1.2 : 0.3;
        case 'elder': return size <= 3 ? 1.1 : 0.4;
        case 'veteran': return trade === 'guard' || trade === 'adventurer' ? 3 : 0.9;
        case 'newlyweds': return size === 2 ? 2.2 : 0;
        case 'scholar': return scholarly ? 2.5 : 0.3;
        case 'noble_born': return species === 'elf' ? 0.8 : 0.25;
        case 'stranger': return 0.8;
        case 'apprentice': return size === 1 ? 1.6 : 0;
        case 'pilgrim': return size <= 2 ? 0.6 : 0.1;
        default: return 0;
      }
    });
    if (tag) tags.push(tag);
    if ((tag === 'widow' || tag === 'veteran') && size <= 2 && chance(s, 0.25)) tags.push('elder');
  }
  return tags;
}

function rollPets(s: GameState, species: Species, traits: TraitId[]): PetKind[] {
  if (!traits.includes('pet_lover')) return [];
  const pool = [...COMMON_PETS, ...(SPECIES_PETS[species] ?? [])];
  const pets: PetKind[] = [pick(s, pool)];
  if (chance(s, 0.3)) { const p = pick(s, pool); if (!pets.includes(p)) pets.push(p); }
  return pets;
}

function rollIncome(s: GameState, trade: TradeId, tags: TenantTag[]): number {
  let income = (TRADE_DEFS[trade]?.income ?? 30) * randRange(s, 0.8, 1.25);
  if (tags.includes('noble_born')) income *= 1.3;
  if (tags.includes('apprentice')) income *= 0.75;
  if (tags.includes('elder') || tags.includes('widow')) income *= 0.9;
  return Math.max(6, Math.round(income));
}

function usedCharacters(s: GameState): string[] { return csvFlag(s, 'pp.chars'); }

/** The named character this household is, if any. */
export function characterOf(t: { character: string | null }): CharacterDef | null {
  if (!t.character) return null;
  return CHARACTERS.find(c => c.id === t.character) ?? null;
}

function fittingCharacter(s: GameState, def: (typeof BUILDINGS)[BuildingType] | null, opts?: { species?: Species; trade?: TradeId }, rent = 0): CharacterDef | null {
  if (!CHARACTERS.length) return null;
  const used = usedCharacters(s);
  const species = speciesChoices(s, def);
  const fits = CHARACTERS.filter(c => {
    if (used.includes(c.id) || !rankOk(s, c.minRank)) return false;
    if (opts?.species ? c.species !== opts.species : !species.includes(c.species)) return false;
    if (opts?.trade && c.trade !== opts.trade) return false;
    if (def) {
      if (def.category === 'commercial') { if (!def.trades?.includes(c.trade)) return false; }
      else if (TRADE_DEFS[c.trade]?.shop && !opts?.trade) return false;   // shopkeepers wait for premises
      if (def.capacity > 0 && c.household > def.capacity) return false;
    }
    if (rent > 0 && (TRADE_DEFS[c.trade]?.income ?? 30) * 0.6 < rent) return false;   // well beyond their means
    return true;
  });
  if (!fits.length) return null;
  return weighted(s, fits, c => (def?.prefers?.includes(c.species) ? 3 : 1));
}

function fromCharacter(s: GameState, c: CharacterDef): Applicant['household'] {
  setCsvFlag(s, 'pp.chars', [...usedCharacters(s), c.id]);
  let seed = 7;
  for (let i = 0; i < c.id.length; i++) seed = (seed * 31 + c.id.charCodeAt(i)) | 0;
  const traits = c.traits.filter(tr => TRAITS.includes(tr));
  return {
    id: newId(s, 't'), name: c.name, first: c.first, species: c.species, trade: c.trade, character: c.id,
    portraitSeed: Math.abs(seed) % 1000000, household: clamp(Math.round(c.household) || 1, 1, 7),
    traits, revealed: [], tags: [...c.tags], pets: c.traits.includes('secret_pet') ? [] : [...c.pets],
    income: rollIncome(s, c.trade, c.tags), reliability: reliabilityFor(traits),
  };
}

/**
 * A household that asks after a place can carry its rent. Where the dice (or thin trade data) say otherwise,
 * they turn out to earn a little more than their trade lets on.
 */
function meansFor(s: GameState, h: Applicant['household'], rent: number): Applicant['household'] {
  if (rent > h.income * TUNE.maxRentShare) h.income = Math.max(h.income, Math.round(rent / randRange(s, 0.36, 0.48)));
  return h;
}

/** Roll a household (random, or a named character from data when available and fitting). */
export function rollHousehold(s: GameState, opts?: { species?: Species; trade?: TradeId; character?: string; forBuilding?: Id }): Applicant['household'] {
  const b = opts?.forBuilding ? s.buildings[opts.forBuilding] : undefined;
  const def = b ? BUILDINGS[b.type] ?? null : null;
  const asking = b ? Math.max(1, Math.round(b.rent) || def?.baseRent || 8) : 0;

  if (opts?.character) {
    const c = CHARACTERS.find(x => x.id === opts.character);
    if (c && !usedCharacters(s).includes(c.id)) return meansFor(s, fromCharacter(s, c), asking);
  } else if (chance(s, TUNE.characterShare)) {
    const c = fittingCharacter(s, def, opts, asking);
    if (c) return meansFor(s, fromCharacter(s, c), asking);
  }

  const species = opts?.species ?? rollSpecies(s, def);
  const rent = b ? asking : 14;
  const trade = opts?.trade ?? rollTrade(s, species, def, rent);
  const range = SPECIES_DEFS[species]?.householdRange ?? [1, 5];
  const cap = def && def.capacity > 0 ? def.capacity : 7;
  const lo = clamp(Math.round(range[0]) || 1, 1, 7), hi = clamp(Math.max(lo, Math.min(Math.round(range[1]) || lo, cap)), lo, 7);
  // two rolls, keep the smaller: most households are modest, a few are a crowd
  const size = Math.min(randInt(s, lo, hi), randInt(s, lo, hi) + (chance(s, 0.35) ? 1 : 0));
  const household = clamp(size, Math.min(lo, cap), hi);
  const traits = rollTraits(s, species);
  const tags = rollTags(s, species, trade, household);
  const { name, first } = rollName(s, species, tags);
  return meansFor(s, {
    id: newId(s, 't'), name, first, species, trade, character: null,
    portraitSeed: Math.floor(rand(s) * 1000000), household, traits, revealed: [], tags,
    pets: rollPets(s, species, traits), income: rollIncome(s, trade, tags), reliability: reliabilityFor(traits),
  }, asking);
}

// ───────────── reading the rolls ─────────────

export function housed(s: GameState): Tenant[] { return Object.values(s.tenants).filter(t => t.status === 'housed'); }
export function tenantsOf(s: GameState, buildingId: Id): Tenant[] { return housed(s).filter(t => t.buildingId === buildingId); }
/** Housed households within `radius` tiles of the building (excluding its own). */
export function neighborsOf(s: GameState, buildingId: Id, radius: number): Tenant[] {
  const b = s.buildings[buildingId];
  if (!b) return [];
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  return housed(s).filter(t => {
    const o = t.buildingId ? s.buildings[t.buildingId] : null;
    return !!o && o.id !== b.id && dist(o.x + o.w / 2, o.y + o.h / 2, cx, cy) <= radius;
  });
}
export function householdCount(s: GameState): number { return housed(s).length; }
export function avgHappiness(s: GameState): number {
  const h = housed(s);
  return h.length ? h.reduce((a, t) => a + t.happiness, 0) / h.length : 50;
}
/** The applicant waiting on this unit, if any. */
export function applicantFor(s: GameState, buildingId: Id, unit: number): Applicant | null {
  for (const a of Object.values(s.applicants)) if (a.buildingId === buildingId && a.unit === unit) return a;
  return null;
}
/** Day the household's lease term runs out (Infinity if they hold no lease). */
export function leaseEndDay(t: Tenant): number {
  return t.lease ? t.lease.startDay + Math.max(1, t.lease.termMonths) * 30 : Infinity;
}

/** Is a ruling of this kind already open (or scheduled) for this household / unit / applicant? */
export function decisionPending(s: GameState, decision: DecisionType, who: { tenantId?: Id; buildingId?: Id; unit?: number; applicantId?: Id }): boolean {
  for (const inc of Object.values(s.incidents)) {
    if (inc.state !== 'open' && inc.state !== 'in_progress') continue;
    if (INCIDENT_BY_ID[inc.defId]?.decision !== decision) continue;
    if (who.applicantId) { if (inc.applicantId === who.applicantId) return true; continue; }
    if (who.tenantId) { if (inc.tenantId === who.tenantId) return true; continue; }
    if (who.buildingId && inc.buildingId === who.buildingId && (who.unit === undefined || inc.unit === null || inc.unit === who.unit)) return true;
  }
  for (const p of s.pending ?? []) {
    if (INCIDENT_BY_ID[p.defId]?.decision !== decision) continue;
    if (who.applicantId) { if (p.vars?.applicantId === who.applicantId) return true; if (who.buildingId && p.buildingId === who.buildingId) return true; continue; }
    if (who.tenantId) { if (p.tenantId === who.tenantId) return true; continue; }
    if (who.buildingId && p.buildingId === who.buildingId) return true;
  }
  return false;
}

// ───────────── voices ─────────────

/**
 * One of several ways the clerk might put it. Chosen by hash, so the feed varies and the realm's dice do not
 * move. A line that would run past the herald's 150 characters loses to the shortest on offer.
 */
export function clerkLine(s: GameState, salt: number, lines: string[]): string {
  const pick = lines[Math.floor(hash01(Math.floor(s.day) * 31 + salt * 7 + (s.seed | 0)) * lines.length)] ?? lines[0]!;
  if (pick.length <= 150) return pick;
  return lines.reduce((a, b) => (b.length < a.length ? b : a));
}

function usable(line: string | undefined): line is string {
  return !!line && line.replace(/[.\s]/g, '').length > 0;
}

/** Let a household say something at a telling moment: a named character's own line, else (sometimes) a bark. */
export function sayLine(s: GameState, t: Tenant, key: keyof CharacterDef['lines'], bark?: BarkKey, barkChance = 0.35): void {
  const where = t.buildingId ?? auxOf(t).home ?? undefined;
  const refs = { tenantId: t.id, ...(where ? { buildingId: where } : {}) };
  const c = characterOf(t);
  const own = c?.lines?.[key];
  if (usable(own)) {
    emit(s, { type: 'say', text: fill(own, baseVars(s, where ? s.buildings[where] : null, t)), ...refs });
    return;
  }
  if (!bark) return;
  const lines = (BARKS[bark] ?? []).filter(usable);
  // cosmetic: picked by hash so chatter never moves the realm's dice
  const h = hash01(Math.floor(s.day * 16) + t.portraitSeed);
  if (!lines.length || h > barkChance) return;
  const line = lines[Math.floor(hash01(t.portraitSeed + Math.floor(s.day)) * lines.length)]!;
  emit(s, { type: 'say', text: fill(line, { title: rulerTitle(s), ruler: s.realm.ruler }), ...refs });
}

// ───────────── memory, happiness, quirks ─────────────

export function changeHappiness(s: GameState, tenantId: Id, amount: number, _reason?: string): void {
  const t = s.tenants[tenantId];
  if (!t || t.status !== 'housed' || !Number.isFinite(amount) || amount === 0) return;
  const before = Number.isFinite(t.happiness) ? t.happiness : 50;
  t.happiness = clamp100(before + amount);
  const d = t.happiness - before;
  if (Math.abs(d) >= 8) {
    emit(s, { type: 'emote', emote: d > 0 ? 'happy' : 'angry', tenantId: t.id, ...(t.buildingId ? { buildingId: t.buildingId } : {}) });
  }
}

/** Something this household will remember about the ruler (shown in their sheet, fed to the model). */
export function addMemory(s: GameState, tenantId: Id, text: string, valence: -2 | -1 | 1 | 2): void {
  const t = s.tenants[tenantId];
  if (!t || typeof text !== 'string') return;
  let clean = text.replace(/\s*[‒-―]\s*/g, ', ').replace(/\s+/g, ' ').trim();
  if (!clean) return;
  if (clean.length > 140) clean = clean.slice(0, 139).trimEnd() + '.';
  const v = (valence === -2 || valence === -1 || valence === 1 || valence === 2) ? valence : 1;
  const last = t.memory[t.memory.length - 1];
  if (last && last.text === clean && s.day - last.day < 30) { last.day = s.day; return; }
  t.memory.push({ day: s.day, text: clean, valence: v });
  while (t.memory.length > TUNE.memoryCap) {
    // small things fade first; the things people bring up years later stay
    let drop = t.memory.findIndex(m => Math.abs(m.valence) === 1);
    if (drop < 0 || drop === t.memory.length - 1) drop = 0;
    t.memory.splice(drop, 1);
  }
}

function findHousehold(s: GameState, id: Id): { traits: TraitId[]; revealed: TraitId[]; pets: PetKind[] } | null {
  const t = s.tenants[id];
  if (t) return t;
  const a = s.applicants[id];
  if (a) return a.household;
  for (const ap of Object.values(s.applicants)) if (ap.household.id === id) return ap.household;
  return null;
}

/** Mark a quirk the household really has as known to the ruler. Works for applicants too. */
export function revealTrait(s: GameState, tenantId: Id, trait: TraitId): void {
  const h = findHousehold(s, tenantId);
  if (h && h.traits.includes(trait) && !h.revealed.includes(trait)) h.revealed.push(trait);
}
export function hiddenTraits(h: { traits: TraitId[]; revealed: TraitId[] }): TraitId[] {
  return h.traits.filter(tr => !h.revealed.includes(tr));
}
/** A household picks up a new quirk (an incident's doing). Reliability follows. */
export function addTrait(s: GameState, tenantId: Id, trait: TraitId, revealed = true): void {
  const t = s.tenants[tenantId];
  if (!t || !TRAITS.includes(trait)) return;
  if (!t.traits.includes(trait)) {
    t.traits.push(trait);
    t.reliability = clamp(t.reliability + traitNum(trait, 'reliability'), 0.2, 0.98);
  }
  if (revealed && !t.revealed.includes(trait)) t.revealed.push(trait);
}
export function removeTrait(s: GameState, tenantId: Id, trait: TraitId): void {
  const t = s.tenants[tenantId];
  if (!t || !t.traits.includes(trait)) return;
  t.traits = t.traits.filter(x => x !== trait);
  t.revealed = t.revealed.filter(x => x !== trait);
  t.reliability = clamp(t.reliability - traitNum(trait, 'reliability'), 0.2, 0.98);
}
export function addPet(s: GameState, tenantId: Id, pet: PetKind): void {
  const t = s.tenants[tenantId];
  if (t && !t.pets.includes(pet)) t.pets.push(pet);
}
export function removePets(s: GameState, tenantId: Id): void {
  const t = s.tenants[tenantId];
  if (t) t.pets = [];
}

// ───────────── moving in ─────────────

const speciesWord = (sp: Species): string => (SPECIES_DEFS[sp]?.adjective || sp).toLowerCase();
const tradeWord = (tr: TradeId): string => (TRADE_DEFS[tr]?.name || tr.replace(/_/g, ' ')).toLowerCase();
const article = (w: string): string => (/^[aeiou]/i.test(w) ? 'an' : 'a');
const crowns = (n: number): string => (n === 1 ? '1 crown' : `${n} crowns`);

export interface HouseOpts {
  /** crowns of surety taken now (default: policy). 0 for none. */
  deposit?: number;
  /** false: the surety was paid before the reign began; do not add it to the coffers */
  bookDeposit?: boolean;
  happiness?: number;
  startDay?: number;
  /** no herald, no events (new game set-up) */
  quiet?: boolean;
}

/** Put a rolled household straight into a vacant unit with a signed lease. Null if the unit cannot take them. */
export function houseDirectly(s: GameState, household: Applicant['household'], buildingId: Id, unit: number, rent?: number, opts: HouseOpts = {}): Tenant | null {
  const b = s.buildings[buildingId];
  const u = b?.units[unit];
  if (!b || !u || u.tenantId) return null;
  const r = Math.max(1, Math.round(rent ?? b.rent ?? BUILDINGS[b.type]?.baseRent ?? 1) || 1);
  const months = Number.isFinite(s.policies.depositMonths) ? Math.max(0, s.policies.depositMonths) : 1;
  const deposit = Math.max(0, Math.round(opts.deposit ?? months * r));
  const market = Math.max(1, marketRent(s, b));
  const def = BUILDINGS[b.type];
  const start = opts.startDay ?? s.day;
  let happy = opts.happiness ?? TUNE.startHappiness + clamp((market - r) / market * 30, -10, 10) + (def?.prefers?.includes(household.species) ? 4 : 0);
  if (!Number.isFinite(happy)) happy = TUNE.startHappiness;
  const t: Tenant = {
    ...household,
    traits: [...household.traits], revealed: [...household.revealed], tags: [...household.tags], pets: [...household.pets],
    status: 'housed', buildingId: b.id, unit,
    lease: { rent: r, startDay: start, termMonths: BAL.leaseTermMonths, deposit },
    movedInDay: start, arrears: 0, daysLate: 0, lateStage: 'none', plan: null, courtDay: null,
    memory: [], wear: 0, leftDay: null, happiness: clamp100(Math.round(happy)),
  };
  s.tenants[t.id] = t;
  auxOf(t);
  u.tenantId = t.id; u.vacantSince = null; u.listed = false; u.purse = 0;
  delete b.flags[ASK_BY_HAND];          // the board has done its work; the next vacancy is priced afresh
  s.stats.tenantsHoused++;
  if (deposit > 0 && opts.bookDeposit !== false) {
    earn(s, deposit, 'deposits_kept', `Surety held for ${t.name}`, { tenantId: t.id, buildingId: b.id });
  }
  if (!opts.quiet) {
    emit(s, { type: 'tenant_in', tenantId: t.id, buildingId: b.id, unit });
    emit(s, { type: 'sfx', id: 'stamp', buildingId: b.id });
  }
  return t;
}

/** Sign the applicant into their unit at `rent` (default: the building's asking rent). Takes the deposit. */
export function moveIn(s: GameState, applicantId: Id, rent?: number): Tenant {
  const a = s.applicants[applicantId];
  if (!a) throw new Error(`[tenants] moveIn: no applicant "${applicantId}"`);
  const b = s.buildings[a.buildingId];
  let unit = a.unit;
  if (b && b.units[unit]?.tenantId) {
    const free = b.units.findIndex(u => !u.tenantId);
    if (free >= 0) unit = free;
  }
  const t = houseDirectly(s, a.household, a.buildingId, unit, rent);
  if (!t) throw new Error(`[tenants] moveIn: ${a.buildingId} unit ${a.unit} cannot take a household`);
  if (a.screened) t.revealed = [...t.traits];
  delete s.applicants[applicantId];
  if (a.actorId) removeActor(s, a.actorId);
  emit(s, { type: 'applicant_gone', applicantId, signed: true });
  addMemory(s, t.id, `You gave them the key to ${b!.name}.`, 1);
  const dep = t.lease!.deposit;
  const rentWords = crowns(t.lease!.rent);
  herald(s, 'good', dep > 0
    ? clerkLine(s, t.portraitSeed, [
      `${t.name} has taken ${b!.name} at ${rentWords} a month. The surety of ${dep} is in the coffers, for now.`,
      `${t.name} has signed for ${b!.name}: ${rentWords} a month, and a surety of ${dep}, counted twice by both sides.`,
      `${b!.name} is let. ${t.name} pays ${rentWords} a month from the first, and has left a surety of ${dep} against the usual.`,
    ])
    : `${t.name} has taken ${b!.name} at ${rentWords} a month, with no surety asked.`,
  { tenantId: t.id, buildingId: b!.id });
  sayLine(s, t, 'greet', 'move_in', 0.8);
  return t;
}

// ───────────── moving out ─────────────

/** Household leaves: frees the unit, sets status, emits tenant_out. Deposit handling is rent.ts's business. */
export function moveOut(s: GameState, tenantId: Id, reason: MoveOutReason): void {
  const t = s.tenants[tenantId];
  if (!t || t.status !== 'housed') return;
  const aux = auxOf(t);
  const homeId = t.buildingId;
  const b = homeId ? s.buildings[homeId] ?? null : null;
  const u = b?.units[t.unit];
  if (u && u.tenantId === t.id) {
    if (u.purse > 0) {
      // a purse nobody fetched leaves with the household that filled it
      t.arrears += u.purse;
      aux.fees += aux.purseFees;
      aux.purseFees = 0;
      u.purse = 0;
    }
    u.tenantId = null;
    u.vacantSince = s.day;
    u.listed = reason !== 'ruin';
  }
  if (aux.due > 0) { t.arrears += aux.due; aux.due = 0; }
  aux.payDay = -1; aux.urgeUntil = -1; aux.noticeDay = -1; aux.cause = 0; aux.renewDay = -1; aux.low = 0;
  aux.home = homeId; aux.homeUnit = t.unit;
  t.status = reason === 'evicted' ? 'evicted' : 'left';
  t.leftDay = s.day;
  t.buildingId = null;
  t.lateStage = 'none'; t.courtDay = null; t.plan = null; t.daysLate = 0;
  if (homeId) emit(s, { type: 'tenant_out', tenantId, buildingId: homeId, unit: t.unit, reason });
  settleDeparture(s, t, b, t.unit, reason);
}

// ───────────── applicants ─────────────

function doorOf(s: GameState, b: Building): [number, number] {
  const e = entranceOf(s, b);
  if (e && Number.isFinite(e[0]) && Number.isFinite(e[1])) return e;
  return [b.x + b.w / 2, b.y + b.h + 0.5];
}
function gateOf(s: GameState): [number, number] {
  const g = gatePoint(s);
  return g && Number.isFinite(g[0]) && Number.isFinite(g[1]) ? g : [0.5, 12.5];
}

/** A figure with nobody behind it any more walks out by the gate and is taken off the table there. */
function leaveByGate(s: GameState, actorId: Id | null): void {
  if (!actorId) return;
  const a = s.actors[actorId];
  if (!a) return;
  const [gx, gy] = gateOf(s);
  a.homeX = gx; a.homeY = gy;
  if (dist(a.x, a.y, gx, gy) < 1 || !walkTo(s, actorId, gx, gy)) { removeActor(s, actorId); return; }
  const walkDays = dist(a.x, a.y, gx, gy) / Math.max(1, a.speed || BAL.walkSpeed.visitor);
  const list = csvFlag(s, 'pp.out');
  list.push(`${actorId}:${(s.day + walkDays * 1.6 + 1).toFixed(2)}`);
  setCsvFlag(s, 'pp.out', list);
}
function sweepLeavers(s: GameState): void {
  const list = csvFlag(s, 'pp.out');
  if (!list.length) return;
  const [gx, gy] = gateOf(s);
  const keep: string[] = [];
  for (const entry of list) {
    const cut = entry.lastIndexOf(':');
    const id = entry.slice(0, cut), until = Number(entry.slice(cut + 1));
    const a = s.actors[id];
    if (!a) continue;
    if (dist(a.x, a.y, gx, gy) < 0.9 || !(s.day < until)) removeActor(s, id);
    else keep.push(entry);
  }
  if (keep.length !== list.length) setCsvFlag(s, 'pp.out', keep);
}

function hasNoticeBoard(s: GameState): boolean {
  for (const b of Object.values(s.buildings)) if (b.type === 'notice_board' && b.state === 'ready') return true;
  return false;
}

/** Chance that a household turns up today asking after this listed vacancy. */
export function applicantChance(s: GameState, b: Building, unit: number): number {
  const u = b.units[unit];
  const def = BUILDINGS[b.type];
  if (!u || !def || b.state !== 'ready' || u.tenantId || !u.listed || b.squatters) return 0;
  if (def.only?.length && !speciesChoices(s, def).length) return 0;
  let p = BAL.applicantRate / 30;
  p *= 0.4 + 1.2 * clamp(s.renown, 0, 100) / 100;
  const ratio = Math.max(1, b.rent) / Math.max(1, marketRent(s, b));
  p *= ratio <= 1 ? 1 + (1 - ratio) * 2 : Math.max(0.04, 1 - (ratio - 1) * 2.5);
  const months = Number.isFinite(s.policies.depositMonths) ? s.policies.depositMonths : 1;
  p *= clamp(1 - 0.15 * (months - 1), 0.4, 1.15);
  const crier = staffOf(s, 'crier');
  if (crier) p *= 1.3 + 0.15 * clamp(crier.skill, 1, 5);
  if (hasNoticeBoard(s)) p *= TUNE.noticeBoardBoost;
  return clamp(p, 0, 0.6);
}

function makeApplicant(s: GameState, b: Building, unit: number, opts?: { species?: Species; trade?: TradeId; character?: string }): Applicant | null {
  const u = b.units[unit];
  const def = BUILDINGS[b.type];
  if (!u || !def || b.state !== 'ready' || u.tenantId || b.squatters) return null;
  if (applicantFor(s, b.id, unit)) return null;
  if (def.only?.length && !opts?.species && !speciesChoices(s, def).length) return null;

  const household = rollHousehold(s, { ...opts, forBuilding: b.id });
  const asking = Math.max(1, Math.round(b.rent) || def.baseRent || 1);
  let willing = marketRent(s, b) * randRange(s, 1.02, 1.3);
  if (household.traits.includes('haggler')) willing *= 0.92;
  if (household.traits.includes('generous')) willing *= 1.06;
  if (def.prefers?.includes(household.species)) willing *= 1.1;
  // they read the board before they walked in: the posted rent is always within reach
  const maxRent = Math.max(asking, Math.round(Math.min(willing, household.income * 0.6)));

  const id = newId(s, 'p');
  const [gx, gy] = gateOf(s);
  const [dx, dy] = doorOf(s, b);
  // Their home point stays the gate they came in by: a guest who walks back to it has left the table
  // (actors.ts). At the door they simply stand and wait.
  const actor = spawnActor(s, { kind: 'applicant', refId: id, x: gx, y: gy, speed: BAL.walkSpeed.visitor });
  if (actor) walkTo(s, actor.id, dx, dy);
  const a: Applicant = {
    id, household, buildingId: b.id, unit, arrivedDay: s.day, leavesDay: s.day + BAL.applicantWaitDays,
    maxRent, shown: false, screened: false, actorId: actor?.id ?? null,
  };
  s.applicants[id] = a;
  emit(s, { type: 'applicant', applicantId: id, buildingId: b.id });

  const sw = speciesWord(household.species), tw = tradeWord(household.trade);
  const crier = staffOf(s, 'crier');
  const who = `${household.name}, ${article(sw)} ${sw} ${tw},`;
  herald(s, 'info', crier
    ? clerkLine(s, household.portraitSeed, [
      `${who} is at the gate asking after ${b.name}. ${crier.first} has gone to show them round.`,
      `${who} has come to see about ${b.name}. ${crier.first} is on the way, rehearsing its good points.`,
    ])
    : clerkLine(s, household.portraitSeed, [
      `${who} is at the gate asking after ${b.name}. Someone should show them the door.`,
      `${who} has come to see about ${b.name} and is waiting to be shown round.`,
      `${who} has walked in by the gate to look at ${b.name}. Nobody has yet told them which door is the door.`,
    ]),
  { buildingId: b.id });
  if (crier) {
    enqueueJob(s, { kind: 'show', role: 'crier', buildingId: b.id, unit, applicantId: id, x: dx, y: dy, workDays: 0.3, priority: 3 });
  }
  return a;
}

/** Create an applicant for a vacant unit; spawns their actor at the gate walking to the door. Null if none fits. */
export function spawnApplicant(s: GameState, buildingId: Id, unit: number, opts?: { species?: Species; trade?: TradeId; character?: string }): Applicant | null {
  const b = s.buildings[buildingId];
  if (!b) return null;
  return makeApplicant(s, b, unit, opts);
}

/** The applicant goes away unsigned: the record is struck and their figure leaves by the gate. */
export function dismissApplicant(s: GameState, applicantId: Id, why: 'rejected' | 'gave_up' | 'refused' | 'gone'): void {
  const a = s.applicants[applicantId];
  if (!a) return;
  delete s.applicants[applicantId];
  emit(s, { type: 'applicant_gone', applicantId, signed: false });
  if (a.actorId && s.actors[a.actorId]) {
    emit(s, { type: 'emote', emote: why === 'refused' ? 'question' : 'sad', actorId: a.actorId });
    leaveByGate(s, a.actorId);
  }
  const waited = s.day - a.arrivedDay;
  if ((why === 'gave_up' || why === 'rejected') && waited >= TUNE.longWaitDays) changeRenown(s, -1, 'applicant kept waiting');
}

function maxApplicantsAtOnce(s: GameState): number { return 2 + rankIndex(s.realm.rank); }

function applicantsDaily(s: GameState): void {
  // those already here: has the vacancy gone, or their patience?
  for (const a of Object.values(s.applicants)) {
    const b = s.buildings[a.buildingId];
    const u = b?.units[a.unit];
    if (!b || !u || b.state !== 'ready' || u.tenantId) { dismissApplicant(s, a.id, 'gone'); continue; }
    if (s.day < a.leavesDay) continue;
    if (!a.shown) {
      herald(s, 'bad', `${a.household.name} waited ${Math.round(s.day - a.arrivedDay)} days at ${b.name} for someone to show them the door. Nobody did. They have gone.`, { buildingId: b.id });
      dismissApplicant(s, a.id, 'gave_up');
    } else if (!decisionPending(s, 'applicant', { applicantId: a.id, buildingId: a.buildingId, unit: a.unit })) {
      herald(s, 'info', `${a.household.name} tired of waiting for an answer about ${b.name} and took a room in the next parish.`, { buildingId: b.id });
      dismissApplicant(s, a.id, 'gave_up');
    }
  }
  // new faces at the gate
  let here = Object.keys(s.applicants).length;
  const cap = maxApplicantsAtOnce(s);
  if (here >= cap) return;
  for (const b of Object.values(s.buildings)) {
    if (b.state !== 'ready' || !b.units.length) continue;
    for (let i = 0; i < b.units.length; i++) {
      if (here >= cap) return;
      const p = applicantChance(s, b, i);
      if (p <= 0 || applicantFor(s, b.id, i)) continue;
      if (chance(s, p) && makeApplicant(s, b, i)) here++;
    }
  }
}

// ───────────── mood ─────────────

export interface MoodPart { label: string; amount: number }

function troublesAt(s: GameState, buildingId: Id): number {
  let n = 0;
  for (const inc of Object.values(s.incidents)) {
    if (inc.buildingId !== buildingId || (inc.state !== 'open' && inc.state !== 'in_progress')) continue;
    const d = INCIDENT_BY_ID[inc.defId]?.decision;
    if (d === 'rent_renewal' || d === 'applicant') continue;
    n += inc.state === 'open' ? 1 : 0.5;
  }
  return n;
}

/** Where this household's happiness is heading, and why. The UI may show the parts as reasons. */
export function happinessBreakdown(s: GameState, t: Tenant): { target: number; parts: MoodPart[] } {
  const parts: MoodPart[] = [];
  const add = (label: string, amount: number) => { if (Number.isFinite(amount) && Math.abs(amount) >= 0.5) parts.push({ label, amount: Math.round(amount) }); };
  const b = t.buildingId ? s.buildings[t.buildingId] : undefined;
  if (b && t.lease) {
    const def = BUILDINGS[b.type];
    const market = Math.max(1, marketRent(s, b));
    add('The rent against what the place is worth', clamp((1 - t.lease.rent / market) * 60, -25, 15));
    const share = t.lease.rent / Math.max(1, t.income);
    if (share > 0.4) add('The rent against their purse', -clamp((share - 0.4) * 50, 0, 10));
    add(b.condition >= 60 ? 'A sound roof' : 'The state of the place', clamp((b.condition - 60) * 0.3, -18, 12));
    const des = desirability(s, b);
    add(des >= 50 ? 'A pleasant corner of the realm' : 'A poor corner of the realm', clamp(((Number.isFinite(des) ? des : 50) - 50) * 0.25, -12.5, 12.5));
    add('Trouble at the door, unattended', -Math.min(15, troublesAt(s, b.id) * 5));
    if (b.squatters) add('Squatters under the same roof', -6);
    if (def?.prefers?.includes(t.species)) add('The house suits them', 4);
    if (def && def.capacity > 0 && t.household > def.capacity) add('Too many under one roof', -6);
    const season = seasonOf(s.day);
    if (season === 'winter' && (b.condition < 50 || b.type === 'hovel')) add('A cold winter in a poor house', -6);
    else if (season === 'spring') add('Spring', 1);
  }
  add('Their own temperament', clamp(traitTotal(t.traits, 'happiness') * 5, -12, 12));
  let mem = 0;
  for (const m of t.memory) if (s.day - m.day <= 90) mem += m.valence * 3;
  add(mem >= 0 ? 'What they remember of you' : 'What they hold against you', clamp(mem, -15, 15));
  if (t.lateStage === 'noticed' || t.lateStage === 'court' || t.lateStage === 'writ') add('A Notice to Quit on the door', -15);
  else if (t.lateStage === 'plan') add('Paying off what they owe', -2);
  const target = clamp100(55 + parts.reduce((a, p) => a + p.amount, 0));
  return { target, parts };
}

/** Reveal a quirk with a clerk's note in the feed. False if there was nothing to reveal. */
export function revealWithHerald(s: GameState, t: Tenant, trait: TraitId): boolean {
  if (!t.traits.includes(trait) || t.revealed.includes(trait)) return false;
  t.revealed.push(trait);
  const def = TRAIT_DEFS[trait];
  const name = def?.name || trait.replace(/_/g, ' ');
  let line = `Learned of ${t.name}: ${name}.`;
  if (def?.blurb && line.length + 1 + def.blurb.length <= 150) line += ` ${def.blurb}`;
  herald(s, def?.good ? 'good' : 'info', line, { tenantId: t.id, ...(t.buildingId ? { buildingId: t.buildingId } : {}) });
  emit(s, { type: 'emote', emote: 'idea', tenantId: t.id, ...(t.buildingId ? { buildingId: t.buildingId } : {}) });
  return true;
}

function discoverSecretPet(s: GameState, t: Tenant, b: Building): void {
  if (!t.pets.length) t.pets.push(pick(s, [...COMMON_PETS, ...(SPECIES_PETS[t.species] ?? [])]));
  if (!t.revealed.includes('secret_pet')) t.revealed.push('secret_pet');
  const pet = t.pets[0]!.replace(/_/g, ' ');
  if (s.policies.pets === 'allow') {
    herald(s, 'info', `It turns out ${t.name} keeps ${article(pet)} ${pet} at ${b.name}. Animals are allowed, so nothing follows, to the ${pet}'s relief.`, { tenantId: t.id, buildingId: b.id });
    return;
  }
  if (!spawnDecision(s, 'pet', { tenantId: t.id, buildingId: b.id, unit: t.unit })) {
    herald(s, 'info', `It turns out ${t.name} keeps ${article(pet)} ${pet} at ${b.name}. The lease does not mention ${article(pet)} ${pet}.`, { tenantId: t.id, buildingId: b.id });
  }
}

function moodMonthly(s: GameState): void {
  for (const t of housed(s)) {
    const b = t.buildingId ? s.buildings[t.buildingId] : undefined;
    if (!b) continue;
    const aux = auxOf(t);
    const { target } = happinessBreakdown(s, t);
    const before = Number.isFinite(t.happiness) ? t.happiness : 50;
    t.happiness = clamp100(before + (target - before) * TUNE.moodRate);

    // the marks a household leaves on a house
    const crowd = 0.7 + 0.15 * t.household + 0.2 * t.pets.length;
    t.wear = clamp(t.wear + TUNE.wearPerMonth * crowd * (SPECIES_WEAR[t.species] ?? 1) * traitTotal(t.traits, 'wear'), 0, 60);

    if (t.happiness < TUNE.unhappyBelow) {
      aux.low++;
      if (aux.low >= TUNE.unhappyMonths) {
        herald(s, 'bad', `${t.name} has given notice at ${b.name} and gone, citing "the general atmosphere".`, { tenantId: t.id, buildingId: b.id });
        sayLine(s, t, 'leave', 'move_out_angry', 1);
        moveOut(s, t.id, 'unhappy');
        changeRenown(s, -1, 'a household left unhappy');
        continue;
      }
      herald(s, 'bad', `${t.name} is deeply unhappy at ${b.name} and has been asking after rents in other parishes.`, { tenantId: t.id, buildingId: b.id });
      sayLine(s, t, 'complain', 'idle_unhappy', 1);
    } else {
      aux.low = 0;
    }

    const hidden = hiddenTraits(t);
    if (hidden.length && chance(s, TUNE.revealChancePerMonth)) {
      const tr = pick(s, hidden);
      if (tr === 'secret_pet') discoverSecretPet(s, t, b); else revealWithHerald(s, t, tr);
    } else if (hidden.includes('secret_pet') && chance(s, TUNE.secretPetChancePerMonth)) {
      discoverSecretPet(s, t, b);
    }
  }
}

function visitDone(s: GameState, job: Job): void {
  let t = job.tenantId ? s.tenants[job.tenantId] : undefined;
  if (!t && job.buildingId) t = tenantsOf(s, job.buildingId)[0];
  if (!t || t.status !== 'housed') return;
  const aux = auxOf(t);
  const recent = s.day - aux.lastVisit < 20;
  aux.lastVisit = s.day;
  changeHappiness(s, t.id, recent ? 2 : TUNE.visitLift, 'visit');
  if (!recent) addMemory(s, t.id, 'You called in person to ask how they were getting on.', 1);
  emit(s, { type: 'emote', emote: 'happy', tenantId: t.id, ...(t.buildingId ? { buildingId: t.buildingId } : {}) });
  sayLine(s, t, t.happiness < 35 ? 'complain' : 'greet', 'see_ruler', 1);
  const hidden = hiddenTraits(t).filter(tr => tr !== 'secret_pet');
  if (hidden.length && chance(s, recent ? TUNE.visitRevealChance / 3 : TUNE.visitRevealChance)) revealWithHerald(s, t, pick(s, hidden));
}

function pruneDeparted(s: GameState): void {
  for (const t of Object.values(s.tenants)) {
    if (t.status === 'housed' || t.leftDay === null) continue;
    const gone = s.day - t.leftDay;
    if (gone < TUNE.keepDepartedDays) continue;
    const aux = auxOf(t);
    if (gone < TUNE.keepDepartedDays * 2) {
      if (aux.dep === 1 || aux.dep === 2) continue;
      let busy = false;
      for (const inc of Object.values(s.incidents)) if (inc.tenantId === t.id && (inc.state === 'open' || inc.state === 'in_progress')) { busy = true; break; }
      if (busy) continue;
    }
    delete s.tenants[t.id];
  }
}

// ───────────── new game ─────────────

function startingHouseholds(s: GameState): void {
  const homes = Object.values(s.buildings)
    .filter(b => b.state === 'ready' && b.units.length > 0 && BUILDINGS[b.type]?.category === 'housing' && b.units.some(u => !u.tenantId))
    .sort((a, b) => (a.type === 'hovel' ? 0 : 1) - (b.type === 'hovel' ? 0 : 1) || b.condition - a.condition);
  // the shabbiest stands empty: that one is the new Reeve's first problem
  const take = homes.slice(0, homes.length ? Math.min(2, Math.max(1, homes.length - 1)) : 0);
  let named = false;
  for (const b of take) {
    const unit = b.units.findIndex(u => !u.tenantId);
    if (unit < 0) continue;
    const def = BUILDINGS[b.type] ?? null;
    const c = named ? null : fittingCharacter(s, def, undefined, b.rent);
    const household = c ? meansFor(s, fromCharacter(s, c), b.rent) : rollHousehold(s, { forBuilding: b.id });
    if (c) named = true;
    const monthsHere = randInt(s, 2, 8);
    const rent = b.rent >= 1 ? Math.round(b.rent) : Math.max(1, marketRent(s, b));
    const t = houseDirectly(s, household, b.id, unit, rent, {
      bookDeposit: false, quiet: true, startDay: -30 * monthsHere, happiness: randInt(s, 54, 66),
    });
    if (!t) continue;
    t.wear = Math.round(monthsHere * TUNE.wearPerMonth * (SPECIES_WEAR[t.species] ?? 1) * 10) / 10;
    if (t.traits.length) t.revealed = [t.traits.find(tr => tr !== 'secret_pet') ?? t.traits[0]!].filter(tr => tr !== 'secret_pet');
    t.memory.push({ day: 0, text: 'You kept them on when the Crown handed you the hamlet.', valence: 1 });
  }
}

// ───────────── handlers ─────────────

function handleReveal(s: GameState, tenantId: Id, trait: TraitId): ActionResult {
  const t = s.tenants[tenantId];
  if (t) {
    if (!t.traits.includes(trait)) return { ok: false, code: 'invalid', reason: 'They are no such thing, as far as anyone can tell.' };
    revealWithHerald(s, t, trait);
    return { ok: true, id: t.id };
  }
  const h = findHousehold(s, tenantId);
  if (!h) return { ok: false, code: 'not_found', reason: 'No such household is known to the clerk.' };
  if (!h.traits.includes(trait)) return { ok: false, code: 'invalid', reason: 'They are no such thing, as far as anyone can tell.' };
  if (!h.revealed.includes(trait)) h.revealed.push(trait);
  return { ok: true };
}

function handleRemember(s: GameState, tenantId: Id, text: string, valence: -2 | -1 | 1 | 2): ActionResult {
  const t = s.tenants[tenantId];
  if (!t) return { ok: false, code: 'not_found', reason: 'No such household is known to the clerk.' };
  if (typeof text !== 'string' || !text.trim()) return { ok: false, code: 'invalid', reason: 'There is nothing there to remember.' };
  if (valence !== -2 && valence !== -1 && valence !== 1 && valence !== 2) return { ok: false, code: 'invalid', reason: 'A memory is fond or it is bitter. That one is neither.' };
  addMemory(s, tenantId, text, valence);
  return { ok: true, id: t.id };
}

// ───────────── module ─────────────

export const tenantsModule: SimModule = {
  name: 'tenants',

  init(s) { startingHouseholds(s); },

  step(s) {
    for (const a of Object.values(s.applicants)) {
      if (!a.actorId) continue;
      const actor = s.actors[a.actorId];
      // arrived at the door and nobody has come: they stand and wait
      if (actor && !a.shown && actor.state === 'idle' && actor.path.length === 0 && !actor.jobId) actor.state = 'waiting';
    }
    sweepLeavers(s);
  },

  onDay(s) {
    applicantsDaily(s);
    pruneDeparted(s);
  },

  onMonth(s) { moodMonthly(s); },

  onJobDone(s, job) { if (job.kind === 'visit') visitDone(s, job); },

  handlers: {
    reveal_trait: (s, a) => handleReveal(s, a.tenantId, a.trait),
    remember: (s, a) => handleRemember(s, a.tenantId, a.text, a.valence),
  },
};
