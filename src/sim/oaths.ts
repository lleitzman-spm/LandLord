/**
 * OWNER: sim-crown agent.
 * The Ledger of Oaths: the ruler's word binds.
 *
 * Anything promised in conversation is recorded here and judged by the engine:
 *
 *   repair         kept when the building reaches condition 80+, or a repair /
 *                  renovate job on it completes, before the due day
 *   no_rent_raise  broken the moment the household's lease rent rises; kept at the due day
 *   rent_cap       broken the moment the lease rent rises above the cap; kept at the due day
 *   no_evict       broken if the household is served notice or evicted; kept at the due day
 *   build          kept when a building of that type is finished after the oath was sworn
 *   pay            kept by gifts to the household of at least the amount
 *   word           kept at the due day
 *
 * Kept: renown, that household's happiness, a fond memory, `stats.oathsKept`.
 * Broken: renown and happiness fall hard, a bitter memory, the neighbours hear.
 * A promisee who is content may release the ruler (`release_oath`); asking one
 * who is not counts as breaking it. A promise to a household that has since
 * left lapses with them (`released`), unless it was a promise not to put them
 * out and they were put out.
 */
import {
  DAYS_PER_MONTH, DAYS_PER_YEAR,
  type GameState, type SimModule, type Oath, type OathKind, type Id, type Tenant, type Building, type ActionResult,
} from './types';
import { newId, emit, fmtDate, monthName, rulerTitle, realmNoun } from './core';
import { changeHappiness, addMemory, neighborsOf } from './tenants';
import { changeRenown } from './renown';
import { countBuildings } from './buildings';
import { proclaim, crowns, crownsOf } from './modes';
import { BUILDINGS } from '../data/buildings';
import { BUILDING_TYPES, type BuildingType } from '../data/ids';

export const TUNE = {
  /** renown for a kept oath, by how much the keeping cost */
  keptRenown: { repair: 3, build: 3, pay: 2, no_evict: 2, no_rent_raise: 2, rent_cap: 2, word: 1 } as Record<OathKind, number>,
  /** a promise of coin earns its full renown only at this sum; a token payment earns 1 */
  payFullRenownAt: 20,
  /** kept oaths beyond this many in thirty days add no further renown: the well stops being impressed */
  keptRenownPerMonth: 3,
  keptHappiness: 10,
  brokenRenown: -6,
  brokenHappiness: -22,
  /** the neighbours hear of a broken oath */
  neighbourHappiness: -4,
  neighbourRadius: 5,
  /** how many neighbours will remember it */
  neighbourMemories: 3,
  /** a promisee at or above this happiness will let the ruler off; below it, asking is breaking */
  releaseHappiness: 60,
  /** with no household to ask, the realm's renown decides */
  releaseRenown: 50,
  /** a building counts as mended at this condition */
  repairedCondition: 80,
  /** shortest term for oaths that are kept by waiting (so they cannot be farmed) / by doing */
  minTermDays: DAYS_PER_MONTH,
  minDeedDays: 1,
  maxTermDays: DAYS_PER_YEAR * 5,
  defaultTermDays: DAYS_PER_MONTH * 3,
  /** the ruler may hold this many open oaths at once (`swear_oath` refuses more) */
  maxOpen: 12,
  /** settled oaths kept on the record */
  keepSettled: 60,
  /** days before the due day at which an unkept promise of a deed is called to mind */
  warnDays: 10,
  maxTextLength: 200,
} as const;

const KINDS: readonly OathKind[] = ['repair', 'no_rent_raise', 'no_evict', 'build', 'pay', 'rent_cap', 'word'];
/** kinds kept by doing something (the rest are kept by not doing something until the due day) */
const DEEDS: readonly OathKind[] = ['repair', 'build', 'pay'];
const UNDER_NOTICE: readonly string[] = ['noticed', 'court', 'writ'];

type OathSpec = Omit<Oath, 'id' | 'madeDay' | 'state' | 'settledDay'>;

// ───────────────────────────── private notes ─────────────────────────────
// A few oaths need to remember something that has no field of its own (the rent
// last seen, how many wells stood when a well was promised). Those notes live in
// `state.flags` under `oath.<id>.<note>` and are cleared when the oath settles.

const noteKey = (o: Oath, note: string): string => `oath.${o.id}.${note}`;
function note(s: GameState, o: Oath, name: string): number | null {
  const v = s.flags[noteKey(o, name)];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function setNote(s: GameState, o: Oath, name: string, value: number): void { s.flags[noteKey(o, name)] = value; }
function clearNotes(s: GameState, o: Oath): void {
  const prefix = `oath.${o.id}.`;
  for (const k of Object.keys(s.flags)) if (k.startsWith(prefix)) delete s.flags[k];
}

// ───────────────────────────── reading the promise ─────────────────────────────

const escapeRe = (t: string): string => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Which building a spoken promise means, if it names one ("a well by the Long Row before summer"). */
export function inferBuildingType(text: string): BuildingType | null {
  const lower = ' ' + text.toLowerCase().replace(/[^a-z' ]+/g, ' ') + ' ';
  let best: BuildingType | null = null;
  let bestLen = 0;
  for (const type of BUILDING_TYPES) {
    if (type === 'seat') continue;
    const def = BUILDINGS[type];
    const words = new Set<string>([def.name.toLowerCase(), type.replace(/_/g, ' ')]);
    if (type === 'market_stall') words.add('stall');
    if (type === 'stonehall') words.add('stone hall');
    if (type === 'mill') words.add('windmill');
    for (const w of words) {
      // "well" is also an adverb: only count it when it is plainly a thing
      const re = w === 'well'
        ? /\b(a|the|new|another|second|that|this|your|our|proper|public)\s+well\b/
        : new RegExp(`\\b${escapeRe(w)}s?\\b`);
      if (re.test(lower) && w.length > bestLen) { best = type; bestLen = w.length; }
    }
  }
  return best;
}

function firstNumber(text: string): number | null {
  const m = /(\d[\d,]*)/.exec(text);
  if (!m) return null;
  const n = Number(m[1]!.replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

const validAmount = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : null);

function defaultText(kind: OathKind): string {
  switch (kind) {
    case 'repair': return 'I will have it mended.';
    case 'no_rent_raise': return 'Your rent will not rise.';
    case 'no_evict': return 'You will not be put out.';
    case 'build': return 'I will have it built.';
    case 'pay': return 'You will be paid.';
    case 'rent_cap': return 'Your rent will go no higher.';
    default: return 'You have my word.';
  }
}

function sameMatter(a: Oath, kind: OathKind, toTenantId: Id | null, buildingId: Id | null, buildingType: BuildingType | null, text: string): boolean {
  if (a.state !== 'open' || a.kind !== kind || a.toTenantId !== toTenantId) return false;
  if (kind === 'repair') return a.buildingId === buildingId;
  if (kind === 'build') return a.buildingType === buildingType && (buildingType !== null || a.text === text);
  if (kind === 'word') return a.text.toLowerCase() === text.toLowerCase();
  return true;
}

/** Fill the gaps in a promise as spoken: who, which building, how much, by when. */
function readSpec(s: GameState, spec: OathSpec): OathSpec {
  const kind: OathKind = KINDS.includes(spec.kind) ? spec.kind : 'word';
  const t = spec.toTenantId ? s.tenants[spec.toTenantId] ?? null : null;
  const toTenantId = t ? t.id : null;
  const rawText = typeof spec.text === 'string' ? spec.text.replace(/\s*[\u2013\u2014]\s*/g, ', ').replace(/\s+/g, ' ').trim() : '';
  const text = (rawText || defaultText(kind)).slice(0, TUNE.maxTextLength);
  const toName = (typeof spec.toName === 'string' && spec.toName.trim()) || t?.name || `the whole ${realmNoun(s).toLowerCase()}`;

  let buildingId = spec.buildingId && s.buildings[spec.buildingId] ? spec.buildingId : null;
  if (!buildingId && kind === 'repair' && t?.buildingId && s.buildings[t.buildingId]) buildingId = t.buildingId;

  let buildingType: BuildingType | null = spec.buildingType && (BUILDING_TYPES as readonly string[]).includes(spec.buildingType) ? spec.buildingType : null;
  if (kind === 'build' && !buildingType) buildingType = inferBuildingType(text);
  if (kind !== 'build') buildingType = null;

  let amount = validAmount(spec.amount);
  if (kind === 'pay' && amount === null) amount = firstNumber(text);
  if (kind === 'rent_cap' && amount === null) amount = t?.lease ? t.lease.rent : null;
  // a promise not to raise the rent is measured against the rent on the day it was made
  if (kind === 'no_rent_raise') amount = t?.lease ? t.lease.rent : null;
  if (kind !== 'pay' && kind !== 'rent_cap' && kind !== 'no_rent_raise') amount = null;

  const minTerm = DEEDS.includes(kind) ? TUNE.minDeedDays : TUNE.minTermDays;
  let dueDay = typeof spec.dueDay === 'number' && Number.isFinite(spec.dueDay) ? spec.dueDay : s.day + TUNE.defaultTermDays;
  dueDay = Math.min(Math.max(dueDay, s.day + minTerm), s.day + TUNE.maxTermDays);

  return { kind, text, toTenantId, toName, buildingId, buildingType, amount, dueDay };
}

// ───────────────────────────── swearing ─────────────────────────────

/**
 * Record a promise. Gaps are filled from what is known (the household's home for
 * a repair, the building named in the words, today's rent as the line not to
 * cross). Swearing the same thing twice to the same household does not make a
 * second oath: the first is returned, with the later of the two due days.
 */
export function swear(s: GameState, spec: OathSpec): Oath {
  const r = readSpec(s, spec);
  const twin = s.oaths.find(o => sameMatter(o, r.kind, r.toTenantId, r.buildingId, r.buildingType, r.text));
  if (twin) {
    if (r.dueDay > twin.dueDay) twin.dueDay = r.dueDay;
    return twin;
  }
  const o: Oath = { ...r, id: newId(s, 'w'), madeDay: s.day, state: 'open', settledDay: null };
  s.oaths.push(o);

  const t = o.toTenantId ? s.tenants[o.toTenantId] ?? null : null;
  if (o.kind === 'rent_cap' && t?.lease) setNote(s, o, 'rent', t.lease.rent);
  // a notice already on the door when the promise was made does not break it; only what follows can
  if (o.kind === 'no_evict' && t && UNDER_NOTICE.includes(t.lateStage)) setNote(s, o, 'noticed', 1);
  if (o.kind === 'build' && o.buildingType) setNote(s, o, 'count', countBuildings(s, o.buildingType));
  // a promise to mend what is not broken is kept by keeping it sound until the due day, not on the spot
  if (o.kind === 'repair' && o.buildingId) {
    const b = s.buildings[o.buildingId];
    if (b && b.state === 'ready' && b.condition >= TUNE.repairedCondition) {
      setNote(s, o, 'sound', 1);
      o.dueDay = Math.max(o.dueDay, s.day + TUNE.minTermDays);
    }
  }
  // only coin given after the promise counts toward it: mark where the ledger stands today
  if (o.kind === 'pay' && o.toTenantId) {
    let today = 0;
    for (const x of s.ledger.txns) if (x.day === s.day && x.cat === 'gifts' && x.tenantId === o.toTenantId) today++;
    setNote(s, o, 'seenDay', s.day);
    setNote(s, o, 'seenN', today);
  }

  emit(s, { type: 'oath', oathId: o.id, state: 'open' });
  emit(s, { type: 'sfx', id: 'quill' });
  proclaim(s, 'oath', [
    'Entered in the Ledger of Oaths, to {name}: "{text}"',
    'A new oath to {name} is entered in the ledger, to be kept by the {date}.',
  ], { name: o.toName, text: o.text, date: fmtDate(o.dueDay) }, refsOf(s, o));
  trim(s);
  return o;
}

export function oathsTo(s: GameState, tenantId: Id): Oath[] { return s.oaths.filter(o => o.toTenantId === tenantId); }
export function openOaths(s: GameState): Oath[] { return s.oaths.filter(o => o.state === 'open'); }

/** Would doing this break an open oath? Used to warn before an action. Returns the oath or null. */
export function wouldBreak(s: GameState, what: { evict?: Id; raiseRent?: Id; newRent?: number }): Oath | null {
  if (what.evict) {
    const o = s.oaths.find(x => x.state === 'open' && x.kind === 'no_evict' && x.toTenantId === what.evict);
    if (o) return o;
  }
  if (what.raiseRent) {
    const t = s.tenants[what.raiseRent];
    const rent = t?.lease?.rent ?? 0;
    const next = typeof what.newRent === 'number' && Number.isFinite(what.newRent) ? what.newRent : rent + 1;
    for (const o of s.oaths) {
      if (o.state !== 'open' || o.toTenantId !== what.raiseRent) continue;
      if (o.kind === 'no_rent_raise' && next > (o.amount ?? rent)) return o;
      if (o.kind === 'rent_cap' && next > rent && next > (o.amount ?? rent)) return o;
    }
  }
  return null;
}

/** Would the promisee let the ruler off this oath if asked today? (If not, asking breaks it.) */
export function wouldRelease(s: GameState, oathId: Id): boolean {
  const o = s.oaths.find(x => x.id === oathId);
  if (!o || o.state !== 'open') return false;
  const t = o.toTenantId ? s.tenants[o.toTenantId] ?? null : null;
  if (t && t.status === 'housed') return t.happiness >= TUNE.releaseHappiness;
  if (t) return true;                       // they have gone; there is no one to hold you to it
  return s.renown >= TUNE.releaseRenown;    // sworn to no household: the realm's opinion decides
}

// ───────────────────────────── settling ─────────────────────────────

function refsOf(s: GameState, o: Oath): { buildingId?: Id; tenantId?: Id } {
  const t = o.toTenantId ? s.tenants[o.toTenantId] ?? null : null;
  const refs: { buildingId?: Id; tenantId?: Id } = {};
  if (t) refs.tenantId = t.id;
  const bid = o.buildingId && s.buildings[o.buildingId] ? o.buildingId : t?.buildingId ?? null;
  if (bid && s.buildings[bid]) refs.buildingId = bid;
  return refs;
}

function textVars(s: GameState, o: Oath): Record<string, string | number> {
  const t = o.toTenantId ? s.tenants[o.toTenantId] ?? null : null;
  const b: Building | null = (o.buildingId ? s.buildings[o.buildingId] : null) ?? (t?.buildingId ? s.buildings[t.buildingId] ?? null : null);
  const btype = o.buildingType ? BUILDINGS[o.buildingType].name.toLowerCase() : 'building';
  return {
    name: o.toName,
    first: t?.first ?? o.toName,
    name_short: t?.first ?? o.toName,
    building: b?.name ?? 'the place',
    btype,
    abtype: (/^[aeiou]/.test(btype) ? 'an ' : 'a ') + btype,
    amount: crowns(o.amount ?? 0),
    sum: o.amount !== null ? crownsOf(o.amount) : 'coin',
    thesum: o.amount !== null ? `the ${crownsOf(o.amount)}` : 'the coin',
    rent: t?.lease ? crowns(t.lease.rent) : '',
    due: monthName(o.dueDay),
    title: rulerTitle(s),
    realm: s.realm.name,
  };
}

function settle(s: GameState, o: Oath, state: 'kept' | 'broken' | 'released'): void {
  o.state = state;
  o.settledDay = s.day;
  clearNotes(s, o);
  emit(s, { type: 'oath', oathId: o.id, state });
  trim(s);
}

/** Keep only the most recent settled oaths on the record; open ones are never dropped. */
function trim(s: GameState): void {
  const settled = s.oaths.filter(o => o.state !== 'open');
  if (settled.length <= TUNE.keepSettled) return;
  const drop = new Set(settled.slice(0, settled.length - TUNE.keepSettled).map(o => o.id));
  s.oaths = s.oaths.filter(o => !drop.has(o.id));
}

const KEPT_LINES: Record<OathKind, { personal: string[]; plain: string[]; memory: string }> = {
  repair: {
    personal: [
      '{building} is mended, as you swore to {name} it would be. {first} has inspected the work twice and found nothing to say.',
      'You promised {name} repairs at {building}, and they are done before {due}. {first} keeps tapping the wall and nodding.',
    ],
    plain: ['An oath kept: {building} no longer leaks, leans or whistles, as {name} was promised.'],
    memory: 'You promised to mend {building}, and did.',
  },
  no_rent_raise: {
    personal: [
      'No rise in the rent, as you swore to {name}. {first} had been checking the lease monthly and now admits it.',
      'Your oath to {name} is kept: the rent stayed where you left it. {first} has told the well, and the well approves.',
    ],
    plain: ['An oath kept: the rent of {name} did not rise, exactly as sworn.'],
    memory: 'You swore the rent would not rise, and it did not.',
  },
  rent_cap: {
    personal: [
      'The rent of {name} stayed at or under {amount} crowns, as sworn. {first} is almost sorry to have no grievance.',
    ],
    plain: ['An oath kept: the rent of {name} never passed {amount} crowns.'],
    memory: 'You swore to hold the rent down, and held it.',
  },
  no_evict: {
    personal: [
      'You swore not to put {name} out, and did not. {first} has unpacked the last crate.',
      'Your oath to {name} is kept. The door of {building} has no notice on it. {first} checks it most mornings, out of habit.',
    ],
    plain: ['An oath kept: {name} was not put out, as sworn.'],
    memory: 'You swore not to put them out, and kept to it.',
  },
  build: {
    personal: [
      'The {btype} you promised {name} stands finished. {first} claims to have doubted it only slightly.',
      'You promised {name} {abtype}, and there it is. {first} walked round it twice and could find no fault, and tried.',
    ],
    plain: [
      'An oath kept: there is {abtype} where you told {name} there would be one.',
      'The {btype} you promised {name} is built. It was promised, and then it happened, which has caused some comment.',
    ],
    memory: 'You promised {abtype} and built it.',
  },
  pay: {
    personal: [
      'You paid {name} {thesum} you promised. {first} counted it twice, out of habit, not distrust.',
    ],
    plain: ['An oath kept: {name} was promised {sum}, and was paid.'],
    memory: 'You paid {thesum} you promised.',
  },
  word: {
    personal: [
      'Your word to {name} held. The ledger records it without comment, which is the ledger\'s highest praise.',
      'An oath kept: {name} was told a thing and the thing was so. {first} mentions it more often than you would expect.',
    ],
    plain: [
      'Your word to {name} held. The ledger records it without comment, which is the ledger\'s highest praise.',
      'An oath kept: {name} was told a thing, and the thing was so.',
    ],
    memory: 'You gave your word and kept it.',
  },
};

const BROKEN_LINES: Record<OathKind, { personal: string[]; plain: string[]; memory: string }> = {
  repair: {
    personal: [
      'You promised {name} repairs at {building} before {due}. {due} came. The repairs did not.',
      '{building} was to be mended by now. {first} has stopped asking and started telling people.',
      'An oath broken: {building} stands as it stood. {first} has moved the bucket again and remembers who promised.',
    ],
    plain: ['You promised {name} repairs at {building} before {due}. {due} came. The repairs did not.'],
    memory: 'You promised to mend {building}. You did not.',
  },
  no_rent_raise: {
    personal: [
      'You swore the rent of {name} would not rise. It rose. {first} has kept the old lease and shows it to visitors.',
      'An oath broken: the rent went up after you told {name} it would not. The well has heard all about it.',
    ],
    plain: ['An oath broken: the rent went up after you told {name} it would not. The well has heard all about it.'],
    memory: 'You swore the rent would not rise. Then you raised it.',
  },
  rent_cap: {
    personal: [
      'You swore the rent of {name} would not pass {amount} crowns. It is now {rent}. {first} can count, and has.',
    ],
    plain: ['An oath broken: the rent of {name} was not to pass {amount} crowns. It did.'],
    memory: 'You swore to hold the rent down. Then you raised it.',
  },
  no_evict: {
    personal: [
      'You swore {name} would not be put out. There is now a Notice to Quit on the door. {first} has read both.',
      'An oath broken: a notice hangs on the door of {building}, where you told {name} none would.',
    ],
    plain: ['An oath broken: you told {name} they would not be put out, and then they were.'],
    memory: 'You swore not to put them out. Then came the notice.',
  },
  build: {
    personal: [
      'You promised {name} {abtype} by {due}. There is a patch of ground where it would have gone. {first} waters it, pointedly.',
      'No {btype} was built. {first} has taken to pointing at the empty spot when you pass.',
    ],
    plain: [
      'You promised {name} {abtype} by {due}. {due} came. There is a patch of ground where it would have gone.',
      'An oath broken: no {btype} was built, and {name} had been told otherwise.',
    ],
    memory: 'You promised {abtype}. It was never built.',
  },
  pay: {
    personal: [
      'You promised {name} {sum} by {due}. {due} came. The crowns stayed where they were.',
      'An oath broken: {first} was promised {sum} and has received an apology instead. Apologies do not spend.',
    ],
    plain: ['You promised {name} {sum} by {due}. {due} came. The crowns stayed where they were.'],
    memory: 'You promised {sum}. It never came.',
  },
  word: {
    personal: [
      'You gave {name} your word and have not kept it. {first} is telling the story at the well, with gestures.',
    ],
    plain: ['An oath broken: your word to {name} did not hold. The ledger has underlined it.'],
    memory: 'You gave your word and did not keep it.',
  },
};

/** The oath was honoured: renown, the household's regard, a fond memory. */
export function keepOath(s: GameState, o: Oath): void {
  if (o.state !== 'open') return;
  const t = o.toTenantId ? s.tenants[o.toTenantId] ?? null : null;
  const vars = textVars(s, o);
  const refs = refsOf(s, o);
  const lines = KEPT_LINES[o.kind];
  const keptLately = s.oaths.filter(x => x.state === 'kept' && (x.settledDay ?? -Infinity) > s.day - DAYS_PER_MONTH).length;
  let renown = TUNE.keptRenown[o.kind];
  if (o.kind === 'pay' && (o.amount ?? 0) < TUNE.payFullRenownAt) renown = 1;
  if (keptLately >= TUNE.keptRenownPerMonth) renown = 0;
  settle(s, o, 'kept');
  s.stats.oathsKept += 1;
  changeRenown(s, renown, 'oath kept');
  if (t && t.status === 'housed') {
    changeHappiness(s, t.id, TUNE.keptHappiness, 'oath kept');
    addMemory(s, t.id, fillLine(lines.memory, vars), 2);
    emit(s, { type: 'emote', emote: 'love', tenantId: t.id, ...(refs.buildingId ? { buildingId: refs.buildingId } : {}) });
  }
  emit(s, { type: 'sfx', id: 'success' });
  proclaim(s, 'oath', t ? lines.personal.concat(lines.plain) : lines.plain, vars, refs);
}

/**
 * The oath was broken: renown and the household's regard fall hard, a bitter
 * memory, and the neighbours hear of it. `how` picks the wording for the two
 * special cases (an eviction carried out; a release asked of someone unwilling).
 */
export function breakOath(s: GameState, o: Oath, how: 'default' | 'evicted' | 'asked' = 'default'): void {
  if (o.state !== 'open') return;
  const t = o.toTenantId ? s.tenants[o.toTenantId] ?? null : null;
  const vars = textVars(s, o);
  const refs = refsOf(s, o);
  const lines = BROKEN_LINES[o.kind];
  settle(s, o, 'broken');
  s.stats.oathsBroken += 1;
  changeRenown(s, TUNE.brokenRenown, 'oath broken');
  if (t) {
    const memory = how === 'asked' ? 'You gave your word, then asked to have it back.'
      : how === 'evicted' ? 'You swore they would keep their roof. Then the Bailiff came.'
      : fillLine(lines.memory, vars);
    if (t.status === 'housed') changeHappiness(s, t.id, TUNE.brokenHappiness, 'oath broken');
    addMemory(s, t.id, memory, -2);
    emit(s, { type: 'emote', emote: 'angry', tenantId: t.id, ...(refs.buildingId ? { buildingId: refs.buildingId } : {}) });
  }
  // word spreads from the door outward
  if (refs.buildingId) {
    const near = neighborsOf(s, refs.buildingId, TUNE.neighbourRadius).filter(n => n.id !== t?.id);
    near.forEach((n, i) => {
      changeHappiness(s, n.id, TUNE.neighbourHappiness, 'oath broken nearby');
      if (i < TUNE.neighbourMemories) addMemory(s, n.id, `You broke your word to ${o.toName}.`, -1);
    });
  }
  emit(s, { type: 'sfx', id: 'boo' });
  if (how === 'asked') {
    proclaim(s, 'oath', t ? [
      'You asked {name} to forget your promise. {first} has an excellent memory, and so, now, does the well.',
      'You asked to be let off your oath to {name}. {first} declined, at some length, with the window open.',
    ] : [
      'You asked to be let off your oath to {name}. The answer was no, and it was not said quietly.',
    ], vars, refs);
  } else if (how === 'evicted') {
    proclaim(s, 'oath', [
      'You swore {name} would keep their roof. The Bailiff has since carried out the bed. People noticed the order of events.',
      'An oath broken: {name} was promised a roof and shown the road. The ledger has it in red.',
    ], vars, refs);
  } else {
    proclaim(s, 'oath', t ? lines.personal.concat(lines.plain) : lines.plain, vars, refs);
  }
}

/** The promise no longer binds and nobody is the worse for it (let off by the promisee, or overtaken by events). */
function releaseOath(s: GameState, o: Oath, why: 'let_off' | 'gone' | 'moot'): void {
  if (o.state !== 'open') return;
  const t = o.toTenantId ? s.tenants[o.toTenantId] ?? null : null;
  const vars = textVars(s, o);
  const refs = refsOf(s, o);
  settle(s, o, 'released');
  if (why === 'let_off') {
    proclaim(s, 'oath', t ? [
      '{name} releases you from your word, and was gracious about it. It is somehow worse.',
      '{name} has let the matter drop. The ledger strikes the oath through, neatly. {first} says to think nothing of it.',
    ] : [
      'Nobody in {realm} minds if that promise is forgotten. The ledger strikes it through, neatly.',
    ], vars, refs);
  } else if (why === 'gone') {
    proclaim(s, 'oath', [
      '{name} has left {realm}. Your promise leaves with them, neither kept nor broken.',
      '{name} is gone, and the oath you swore them with it. The ledger notes it as unfinished business, and closes the page.',
    ], vars, refs);
  } else {
    proclaim(s, 'oath', [
      'The building you swore to {name} you would mend no longer stands. The ledger records the oath as moot, with a small sigh.',
    ], vars, refs);
  }
}

const fillLine = (template: string, vars: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

// ───────────────────────────── judging ─────────────────────────────

/**
 * Crowns given to this household since the oath was sworn. The ledger's log is
 * capped, so the sum is kept as a running tally (notes `given`, `seenDay`,
 * `seenN`) and each look adds only the entries that are new since the last.
 */
export function paidToward(s: GameState, o: Oath): number {
  const given = note(s, o, 'given') ?? 0;
  if (o.state !== 'open' || !o.toTenantId) return given;
  const seenDay = note(s, o, 'seenDay') ?? o.madeDay;
  const seenN = note(s, o, 'seenN') ?? 0;
  const txns = s.ledger.txns;
  let start = txns.length;
  while (start > 0 && txns[start - 1]!.day >= seenDay) start--;
  let atSeenDay = 0, fresh = 0, lastDay = seenDay, lastN = seenN;
  for (let i = start; i < txns.length; i++) {
    const x = txns[i]!;
    if (x.cat !== 'gifts' || x.tenantId !== o.toTenantId) continue;
    if (x.day === seenDay && ++atSeenDay <= seenN) continue;         // counted on an earlier look
    fresh += Math.abs(x.amount);
    if (x.day === lastDay) lastN++; else { lastDay = x.day; lastN = 1; }
  }
  if (fresh <= 0) return given;
  setNote(s, o, 'given', given + fresh);
  setNote(s, o, 'seenDay', lastDay);
  setNote(s, o, 'seenN', lastN);
  return given + fresh;
}

function builtSince(s: GameState, o: Oath): boolean {
  if (o.buildingType) {
    const base = note(s, o, 'count');
    if (base !== null && countBuildings(s, o.buildingType) > base) return true;
  }
  // or one finished since the promise, whatever else has come down in the meantime
  // (a promise that named no kind of building is kept by any)
  for (const b of Object.values(s.buildings)) {
    if (b.state !== 'ready' || b.type === 'seat' || b.builtDay <= o.madeDay) continue;
    if (!o.buildingType || b.type === o.buildingType) return true;
  }
  return false;
}

/** Judge one open oath against the world as it stands now. */
function judge(s: GameState, o: Oath): void {
  const t: Tenant | null = o.toTenantId ? s.tenants[o.toTenantId] ?? null : null;
  const housed = !!t && t.status === 'housed';
  const promisedToHousehold = o.toTenantId !== null;
  const due = s.day >= o.dueDay;

  // The promisee is no longer here: put out (which breaks a promise not to), or gone, and the promise with them.
  if (promisedToHousehold && !housed) {
    if (o.kind === 'no_evict' && t?.status === 'evicted') breakOath(s, o, 'evicted');
    else releaseOath(s, o, 'gone');
    return;
  }

  switch (o.kind) {
    case 'repair': {
      if (!o.buildingId) { if (due) keepOath(s, o); return; }          // nothing to measure: judged as a plain word
      const b = s.buildings[o.buildingId];
      if (!b) { releaseOath(s, o, 'moot'); return; }
      const mended = b.state === 'ready' && b.condition >= TUNE.repairedCondition;
      const wasSound = note(s, o, 'sound') !== null;
      if (mended && (!wasSound || due)) { keepOath(s, o); return; }
      if (due) breakOath(s, o);
      return;
    }
    case 'no_rent_raise':
    case 'rent_cap': {
      if (!t || !t.lease) { if (due) keepOath(s, o); return; }          // no lease to measure against: a plain word
      const rent = t.lease.rent;
      if (o.amount === null) o.amount = rent;                            // an oath written before the line was noted
      if (o.kind === 'no_rent_raise') {
        if (rent > o.amount) { breakOath(s, o); return; }
      } else {
        const last = note(s, o, 'rent') ?? rent;
        if (rent > o.amount && rent > last) { breakOath(s, o); return; }
        if (rent !== last || note(s, o, 'rent') === null) setNote(s, o, 'rent', rent);
        if (due && rent > o.amount) { breakOath(s, o); return; }         // it was above the cap and never came down
      }
      if (due) keepOath(s, o);
      return;
    }
    case 'no_evict': {
      if (!t) { if (due) keepOath(s, o); return; }
      if (UNDER_NOTICE.includes(t.lateStage)) {
        if (note(s, o, 'noticed') === null) { breakOath(s, o); return; }
      } else if (note(s, o, 'noticed') !== null) {
        // the old notice came down; a new one would be a breach
        delete s.flags[noteKey(o, 'noticed')];
      }
      if (due) keepOath(s, o);
      return;
    }
    case 'build': {
      if (builtSince(s, o)) { keepOath(s, o); return; }
      if (due) breakOath(s, o);
      return;
    }
    case 'pay': {
      if (!t) { if (due) keepOath(s, o); return; }
      if (paidToward(s, o) >= (o.amount ?? 1)) { keepOath(s, o); return; }
      if (due) breakOath(s, o);
      return;
    }
    default:
      if (due) keepOath(s, o);
  }
}

/** Judge every open oath now. Runs each tick, so a breach is felt at once. */
export function judgeOaths(s: GameState): void {
  if (s.ended) return;
  let anyOpen = false;
  for (const o of s.oaths) if (o.state === 'open') { anyOpen = true; break; }
  if (!anyOpen) return;
  for (const o of [...s.oaths]) if (o.state === 'open') judge(s, o);
}

function remind(s: GameState): void {
  for (const o of s.oaths) {
    if (o.state !== 'open' || !DEEDS.includes(o.kind)) continue;
    const left = o.dueDay - s.day;
    if (left > TUNE.warnDays || left <= 0 || o.dueDay - o.madeDay <= TUNE.warnDays) continue;
    if (note(s, o, 'warned') !== null) continue;
    setNote(s, o, 'warned', 1);
    const what = o.kind === 'repair' ? 'the mending of {building}' : o.kind === 'build' ? '{abtype}' : '{sum}';
    proclaim(s, 'oath', [
      `Your oath to {name} falls due on the {date}: ${what}. The ledger has put a ribbon in the page.`,
      `{name} is counting the days to the {date}. You promised ${what}.`,
    ], { ...textVars(s, o), date: fmtDate(o.dueDay) }, refsOf(s, o));
  }
}

// ───────────────────────────── module ─────────────────────────────

const refuse = (code: Extract<ActionResult, { ok: false }>['code'], reason: string): ActionResult => ({ ok: false, code, reason });

export const oathsModule: SimModule = {
  name: 'oaths',

  step(s) { judgeOaths(s); },

  onDay(s) {
    if (s.ended) return;
    remind(s);
  },

  onJobDone(s, job) {
    // a repair or renovation finished on a building the ruler swore to mend: that is the oath kept
    if ((job.kind === 'repair' || job.kind === 'renovate') && job.buildingId) {
      for (const o of [...s.oaths]) {
        if (o.state === 'open' && o.kind === 'repair' && o.buildingId === job.buildingId && s.day <= o.dueDay + 1e-6) keepOath(s, o);
      }
    }
    // a promised building finished (a promise that named no type is kept by any finished building)
    if (job.kind === 'build' && job.buildingId) {
      const b = s.buildings[job.buildingId];
      for (const o of [...s.oaths]) {
        if (o.state !== 'open' || o.kind !== 'build') continue;
        if (b && (o.buildingType === null || o.buildingType === b.type)) keepOath(s, o);
      }
    }
    // evictions, notices and rulings land through jobs: judge at once rather than at the next tick
    if (job.kind === 'evict' || job.kind === 'serve_notice' || job.kind === 'incident') judgeOaths(s);
  },

  handlers: {
    swear_oath(s, a) {
      const spec = a.oath;
      if (!spec || typeof spec !== 'object') return refuse('invalid', `An oath wants words, ${rulerTitle(s)}.`);
      if (!KINDS.includes(spec.kind)) return refuse('invalid', 'The ledger has no column for a promise of that kind.');
      if (typeof spec.text !== 'string' || !spec.text.trim()) return refuse('invalid', `An oath wants words, ${rulerTitle(s)}.`);
      if (spec.toTenantId) {
        const t = s.tenants[spec.toTenantId];
        if (!t || t.status !== 'housed') return refuse('not_found', 'No such household is on the rolls to be promised anything.');
      }
      if (spec.buildingId && !s.buildings[spec.buildingId]) return refuse('not_found', 'No such building stands to be sworn over.');
      const r = readSpec(s, spec);
      const twin = s.oaths.find(o => sameMatter(o, r.kind, r.toTenantId, r.buildingId, r.buildingType, r.text));
      if (twin) return refuse('blocked', `You have already sworn as much to ${twin.toName}. Swearing it twice does not make it truer.`);
      if (openOaths(s).length >= TUNE.maxOpen) {
        return refuse('blocked', `The Ledger of Oaths has no room, ${rulerTitle(s)}. Keep some of the promises you have made.`);
      }
      const o = swear(s, spec);
      return { ok: true, id: o.id };
    },

    release_oath(s, a) {
      const o = s.oaths.find(x => x.id === a.oathId);
      if (!o) return refuse('not_found', 'The ledger holds no such oath.');
      if (o.state !== 'open') return refuse('invalid', 'That oath is already settled, one way or the other.');
      if (wouldRelease(s, o.id)) releaseOath(s, o, 'let_off');
      else breakOath(s, o, 'asked');
      return { ok: true, id: o.id };
    },
  },
};
