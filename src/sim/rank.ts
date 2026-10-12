/**
 * OWNER: sim-crown agent.
 * Charters, promotion, demotion, and what each rank unlocks.
 *
 * Each rank holds a charter: a short list of goals (RANKS[rank].goals) to earn
 * the next one. Progress is recomputed every day. A goal that has been met stays
 * met for that charter, so a bad week does not unseal it. When every goal is met
 * the charter is `ready` and the Crown's herald waits for `accept_promotion`.
 */
import {
  DAYS_PER_MONTH, RANK_ORDER,
  type GameState, type SimModule, type StaffRole, type GoalMetric, type GoalProgress, type RankId, type ActionResult,
} from './types';
import type { BuildingType, Species } from '../data/ids';
import type { RankDef, GoalDef } from '../data/schema';
import { RANKS } from '../data/ranks';
import { REALM_NAMES } from '../data/characters';
import { SPECIES_DEFS } from '../data/species';
import { ROLE_TITLES } from '../data/ids';
import { rankIndex, emit, herald, fill, baseVars, hash01, fmtDate } from './core';
import { householdCount, avgHappiness } from './tenants';
import { rentRoll, earn } from './economy';
import { changeFavor } from './renown';
import { countBuildings, vacancies, leasable, upgradeSeat } from './buildings';
import { rollCandidates } from './staff';
import { proclaim, numWord, crowns, capFirst } from './modes';

export const TUNE = {
  /** favor granted with a new rank */
  promotionFavor: 10,
  /** crowns the Crown sends with the new title, by the rank attained */
  promotionGift: { reeve: 0, knight: 150, baron: 300, duke: 800, king: 2000 } as Record<RankId, number>,
  /** days the herald waits at the gate before he is heard rehearsing */
  readyNagDays: 15,
  /** after a demotion: days before the Crown will consider promoting again */
  probationDays: 180,
} as const;

/** Keys this module keeps in `state.flags`. */
export const FLAGS = {
  /** consecutive days with every leasable unit let (feeds the `monthsNoVacancy` metric) */
  fullDays: 'charter.fullDays',
  readyDay: 'charter.readyDay',
  nagged: 'charter.nagged',
  /** after a demotion the Crown will not hear of promotion before this day */
  probationUntil: 'charter.probationUntil',
  /** index of the highest rank ever held this reign (the Crown's gift comes once per title) */
  highest: 'charter.highest',
} as const;

const upTo = (s: GameState) => RANK_ORDER.slice(0, rankIndex(s.realm.rank) + 1).map(r => RANKS[r]);
export function rankDef(s: GameState): RankDef { return RANKS[s.realm.rank]; }
export function isUnlocked(s: GameState, btype: BuildingType): boolean { return upTo(s).some(r => r.buildings.includes(btype)); }
export function speciesUnlocked(s: GameState): Species[] { return upTo(s).flatMap(r => r.species); }
export function rolesUnlocked(s: GameState): StaffRole[] { return upTo(s).flatMap(r => r.staff); }
export function maxParcels(s: GameState): number { return RANKS[s.realm.rank].maxParcels; }
/** The rank above this one, or null for a King. */
export function nextRank(s: GameState): RankId | null { return RANK_ORDER[rankIndex(s.realm.rank) + 1] ?? null; }

// ───────────────────────────── metrics ─────────────────────────────

const numFlag = (s: GameState, key: string): number => {
  const v = s.flags[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
};

/**
 * How each charter metric is measured. A plain table so that bots and tests can
 * read (or stand in for) a measurement without reaching into the sim.
 */
export const METRICS: Record<GoalMetric, (s: GameState, goal: GoalDef) => number> = {
  households: s => householdCount(s),
  rentRoll: s => rentRoll(s),
  renown: s => s.renown,
  favor: s => s.favor,
  gold: s => s.gold,
  happinessAvg: s => avgHappiness(s),
  staff: s => Object.keys(s.staff).length,
  oathsKept: s => s.stats.oathsKept,
  buildings: (s, goal) => goal.buildingType
    ? countBuildings(s, goal.buildingType)
    : Object.values(s.buildings).filter(b => b.state === 'ready' && b.type !== 'seat').length,
  monthsNoVacancy: s => Math.floor(numFlag(s, FLAGS.fullDays) / DAYS_PER_MONTH),
  conditionAvg: s => {
    const ready = Object.values(s.buildings).filter(b => b.state === 'ready');
    return ready.length ? ready.reduce((a, b) => a + b.condition, 0) / ready.length : 0;
  },
};

/** Today's reading of a goal's metric, as the whole number the charter page shows. */
export function measure(s: GameState, goal: GoalDef): number {
  const raw = METRICS[goal.metric]?.(s, goal);
  return typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw + 1e-9) : 0;
}

function freshGoals(rank: RankId): GoalProgress[] {
  return RANKS[rank].goals.map(g => ({ id: g.id, value: 0, target: g.target, done: false }));
}

/** Make `charter.goals` line up with the rank's goal list (new game, promotion, an older save), keeping seals already won. */
function alignGoals(s: GameState): void {
  const defs = RANKS[s.realm.rank].goals;
  const have = s.charter.goals;
  const same = have.length === defs.length && defs.every((g, i) => have[i]!.id === g.id && have[i]!.target === g.target);
  if (same) return;
  const old = new Map(have.map(g => [g.id, g]));
  s.charter.goals = defs.map(g => ({ id: g.id, value: old.get(g.id)?.value ?? 0, target: g.target, done: old.get(g.id)?.done ?? false }));
}

/**
 * Recompute the charter. Emits `goal` once for each goal newly met, and when the
 * last one falls: `charter.ready`, a herald, `charter_ready`. Safe to call at any time.
 */
export function refreshCharter(s: GameState, quiet = false): void {
  alignGoals(s);
  const defs = RANKS[s.realm.rank].goals;
  for (let i = 0; i < defs.length; i++) {
    const def = defs[i]!;
    const g = s.charter.goals[i]!;
    const now = measure(s, def);
    if (!g.done && now >= g.target) {
      g.done = true;
      if (!quiet) {
        emit(s, { type: 'goal', goalId: g.id });
        proclaim(s, 'crown', [
          'A clause of the charter is met: {goal}. The Crown\'s clerk has ticked it, without enthusiasm.',
          'The charter is one seal nearer. {goal}: done, witnessed, and filed where no one will find it.',
          'Met: {goal}. Word has been sent to the Crown, which will be pleased at its own pace.',
        ], { goal: def.text });
      }
    }
    // A sealed goal reads as met even if the number has since slipped.
    g.value = g.done ? Math.max(now, g.target) : now;
  }
  const all = defs.length > 0 && s.charter.goals.every(g => g.done) && nextRank(s) !== null;
  if (!all || s.charter.ready) return;
  // After a demotion the Crown wants to see some quiet quarters before it hears of promotion again.
  const probation = numFlag(s, FLAGS.probationUntil);
  if (probation > s.day) {
    if (!quiet && s.flags[FLAGS.nagged] !== true) {
      s.flags[FLAGS.nagged] = true;
      proclaim(s, 'crown', [
        'Every clause of the charter is met, but the Crown will not hear of promotion before the {date}. It is still upset.',
        'The charter is fulfilled. The Crown has noted it and will reply after the {date}, being in no mood before then.',
      ], { date: fmtDate(probation) });
    }
    return;
  }
  s.charter.ready = true;
  s.flags[FLAGS.readyDay] = s.day;
  s.flags[FLAGS.nagged] = false;
  if (quiet) return;
  proclaim(s, 'crown', [
    'Every clause of your charter is met. The Crown\'s herald is at the gate with a scroll, a trumpet and very little patience.',
    'The charter is fulfilled. A herald of the Crown waits at the gate, with a cushion for you to kneel on. It is thin.',
  ]);
  emit(s, { type: 'sfx', id: 'horn' });
  emit(s, { type: 'charter_ready' });
}

function trackVacancy(s: GameState): void {
  const full = leasable(s).length > 0 && vacancies(s).length === 0;
  s.flags[FLAGS.fullDays] = full ? numFlag(s, FLAGS.fullDays) + 1 : 0;
}

function nagIfWaiting(s: GameState): void {
  if (!s.charter.ready || s.flags[FLAGS.nagged] === true) return;
  if (s.day - numFlag(s, FLAGS.readyDay) < TUNE.readyNagDays) return;
  s.flags[FLAGS.nagged] = true;
  proclaim(s, 'crown', [
    'The Crown\'s herald is still at the gate, and has begun rehearsing the proclamation aloud, to the geese.',
    'The herald at the gate asks whether you mean to be promoted this season. There are other gates.',
  ]);
}

// ───────────────────────────── changing rank ─────────────────────────────

/** Give the charter of `rank`, starting today. Nothing is sealed on the day of the grant: goals are earned from tomorrow. */
function grantCharter(s: GameState, rank: RankId): void {
  const defs = RANKS[rank].goals;
  s.realm.rank = rank;
  s.charter = { goals: freshGoals(rank), ready: false, sinceDay: s.day };
  for (let i = 0; i < defs.length; i++) s.charter.goals[i]!.value = measure(s, defs[i]!);
  s.flags[FLAGS.nagged] = false;
}

function listWords(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
}

function announceUnlocks(s: GameState, rank: RankId): void {
  const def = RANKS[rank];
  const parts: string[] = [];
  if (def.species.length) {
    const who = listWords(def.species.map(sp => (SPECIES_DEFS[sp]?.plural ?? sp).toLowerCase()));
    parts.push(`${capFirst(who)} have heard there is ${/^[aeiou]/i.test(def.realm) ? 'an' : 'a'} ${def.realm.toLowerCase()} and are asking about vacancies.`);
  }
  if (def.buildings.length) parts.push(`${capFirst(numWord(def.buildings.length))} new ${def.buildings.length === 1 ? 'pattern is' : 'patterns are'} in the pattern book.`);
  if (def.staff.length) {
    const roles = def.staff.map(r => (/^[aeiou]/i.test(ROLE_TITLES[r]) ? 'an ' : 'a ') + ROLE_TITLES[r]);
    parts.push(`You may now hire ${listWords(roles)}.`);
  }
  if (!parts.length) return;
  // one line if it fits, otherwise two
  const joined = parts.join(' ');
  if (joined.length <= 150) { proclaim(s, 'info', [joined]); return; }
  let line = '';
  for (const p of parts) {
    if (line && (line + ' ' + p).length > 150) { proclaim(s, 'info', [line]); line = p; } else line = line ? line + ' ' + p : p;
  }
  if (line) proclaim(s, 'info', [line]);
}

/** Raise the ruler to the next rank. Returns the new rank, or null for a King. */
export function promote(s: GameState): RankId | null {
  const next = nextRank(s);
  if (!next) return null;
  const def = RANKS[next];
  grantCharter(s, next);
  upgradeSeat(s, def.seatLevel);
  changeFavor(s, TUNE.promotionFavor, 'promotion');
  rollCandidates(s);                       // a fresh slate at the gate: the new title opens new posts
  herald(s, 'crown', fill(def.proclamation, baseVars(s)));
  emit(s, { type: 'sfx', id: 'fanfare' });
  emit(s, { type: 'promotion', rank: next });
  // The Crown's purse opens once per title: a rank regained after a demotion comes without it (and without the tour).
  const first = rankIndex(next) > numFlag(s, FLAGS.highest);
  if (first) { s.flags[FLAGS.highest] = rankIndex(next); announceUnlocks(s, next); }
  const gift = first ? TUNE.promotionGift[next] ?? 0 : 0;
  if (gift > 0) {
    earn(s, gift, 'windfall', 'The Crown\'s gift on your elevation');
    proclaim(s, 'crown', def.tribute > 0 ? [
      'The Crown sends {gift} crowns toward the dignity of your new station. The tribute is now {tribute} a quarter. The two are unrelated.',
      'A gift from the Crown: {gift} crowns. Enclosed with it, the new tribute: {tribute} a quarter. The Crown has two hands and uses both.',
    ] : [
      'The treasury sends {gift} crowns toward the dignity of your new station. It is your treasury. The gesture stands.',
    ], { gift: crowns(gift), tribute: crowns(def.tribute) });
  } else if (def.tribute > 0) {
    proclaim(s, 'crown', [
      'The title is restored. The gift is not: the Crown gives once. The tribute is {tribute} a quarter, as you will recall.',
    ], { tribute: crowns(def.tribute) });
  }
  return next;
}

/**
 * Lower the ruler one rank (modes.ts calls this in Steward's Peace). The seat,
 * the land and the household already built stay as they are; the title, the
 * charter and what may be newly built or hired do not. Returns the new rank, or
 * null if already a Reeve.
 */
export function demote(s: GameState): RankId | null {
  const idx = rankIndex(s.realm.rank);
  if (idx <= 0) return null;
  const to = RANK_ORDER[idx - 1]!;
  if (numFlag(s, FLAGS.highest) < idx) s.flags[FLAGS.highest] = idx;
  grantCharter(s, to);
  s.flags[FLAGS.probationUntil] = Math.floor(s.day) + TUNE.probationDays;
  return to;
}

// ───────────────────────────── module ─────────────────────────────

const refuse = (code: Extract<ActionResult, { ok: false }>['code'], reason: string): ActionResult => ({ ok: false, code, reason });

export const rankModule: SimModule = {
  name: 'rank',

  init(s) {
    if (!s.realm.name.trim()) {
      const names = REALM_NAMES.length ? REALM_NAMES : ['Mudlark Hollow'];
      s.realm.name = names[Math.floor(hash01(s.seed ^ 0x51ed27) * names.length)]!;
    }
    s.realm.rank = 'reeve';
    s.charter = { goals: freshGoals('reeve'), ready: false, sinceDay: s.day };
    for (let i = 0; i < s.charter.goals.length; i++) s.charter.goals[i]!.value = measure(s, RANKS.reeve.goals[i]!);
    herald(s, 'crown', fill(RANKS.reeve.proclamation, baseVars(s)));
  },

  onDay(s) {
    if (s.ended) return;
    trackVacancy(s);
    refreshCharter(s);
    nagIfWaiting(s);
  },

  handlers: {
    accept_promotion(s) {
      if (!nextRank(s)) return refuse('locked', 'There is no one left to promote you, Your Majesty. You have checked.');
      if (!s.charter.ready) {
        const left = s.charter.goals.filter(g => !g.done).length;
        return refuse('not_ready', left === 1
          ? 'The Crown has not sent for you. One clause of the charter is still unmet.'
          : `The Crown has not sent for you. ${capFirst(numWord(left))} clauses of the charter are still unmet.`);
      }
      const rank = promote(s);
      return rank ? { ok: true } : refuse('locked', 'There is no higher title to give.');
    },
  },
};
