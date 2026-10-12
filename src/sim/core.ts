/**
 * Sim core utilities — shared by every sim module. Owned by the integrator.
 * Pure functions over GameState; deterministic given the seed.
 */
import {
  DAYS_PER_MONTH, DAYS_PER_YEAR, MAP_W, MAP_H, RANK_ORDER,
  type GameState, type SimEvent, type Herald, type HeraldKind, type DateParts, type Season,
  type Id, type RankId, type Job, type SimModule, type Tile, type Building, type Tenant,
} from './types';
import { MONTH_NAMES, RANK_TITLES, REALM_NOUNS } from '../data/ids';

// ───────────── events ─────────────

export function emit(s: GameState, ev: SimEvent): void {
  s._events.push(ev);
}

// ───────────── rng (mulberry32, state in s.rng) ─────────────

export function rand(s: GameState): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/** integer in [a, b] inclusive */
export function randInt(s: GameState, a: number, b: number): number {
  return a + Math.floor(rand(s) * (b - a + 1));
}
export function randRange(s: GameState, a: number, b: number): number {
  return a + rand(s) * (b - a);
}
export function chance(s: GameState, p: number): boolean {
  return rand(s) < p;
}
export function pick<T>(s: GameState, arr: readonly T[]): T {
  return arr[Math.floor(rand(s) * arr.length)]!;
}
export function weighted<T>(s: GameState, items: readonly T[], weight: (t: T) => number): T | null {
  let total = 0;
  for (const it of items) total += Math.max(0, weight(it));
  if (total <= 0) return null;
  let r = rand(s) * total;
  for (const it of items) {
    r -= Math.max(0, weight(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1] ?? null;
}
export function shuffle<T>(s: GameState, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
/** stateless hash rng for cosmetic seeds (does not advance s.rng) */
export function hash01(n: number): number {
  let t = (n + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ───────────── ids ─────────────

export function newId(s: GameState, prefix: string): Id {
  return prefix + (s.nextId++).toString(36);
}

// ───────────── maths ─────────────

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const clamp100 = (v: number): number => clamp(v, 0, 100);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const round = (v: number): number => Math.round(v);

// ───────────── calendar ─────────────

const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];

export function dateOf(day: number): DateParts {
  const d = Math.max(0, day);
  const whole = Math.floor(d);
  const year = Math.floor(whole / DAYS_PER_YEAR) + 1;
  const doy = whole % DAYS_PER_YEAR;
  const month = Math.floor(doy / DAYS_PER_MONTH);
  const dom = (doy % DAYS_PER_MONTH) + 1;
  const dayOfMonthFloat = d % DAYS_PER_MONTH;
  return {
    year, month, dom,
    season: SEASONS[Math.floor(month / 3)]!,
    monthIndex: Math.floor(whole / DAYS_PER_MONTH),
    dayOfMonthFloat,
    monthPhase: dayOfMonthFloat / DAYS_PER_MONTH,
  };
}
export function seasonOf(day: number): Season { return dateOf(day).season; }
export function monthIndexOf(day: number): number { return Math.floor(Math.max(0, day) / DAYS_PER_MONTH); }
export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return n + 'th';
  return n + (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
}
/** "3rd of Harvestmoon, Year 2" */
export function fmtDate(day: number): string {
  const d = dateOf(day);
  return `${ordinal(d.dom)} of ${MONTH_NAMES[d.month]}, Year ${d.year}`;
}
export function monthName(day: number): string { return MONTH_NAMES[dateOf(day).month]!; }
/** whole months between two days */
export function monthsBetween(fromDay: number, toDay: number): number {
  return Math.floor((toDay - fromDay) / DAYS_PER_MONTH);
}

// ───────────── ranks ─────────────

export function rankIndex(r: RankId): number { return RANK_ORDER.indexOf(r); }
export function rankAtLeast(s: GameState, r: RankId): boolean { return rankIndex(s.realm.rank) >= rankIndex(r); }
export function rulerTitle(s: GameState): string { return RANK_TITLES[s.realm.rank]; }
export function realmNoun(s: GameState): string { return REALM_NOUNS[s.realm.rank]; }

// ───────────── map helpers ─────────────

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
}
export function tileIndex(x: number, y: number): number { return y * MAP_W + x; }
export function tileAt(s: GameState, x: number, y: number): Tile | null {
  return inBounds(x, y) ? s.map.tiles[y * MAP_W + x]! : null;
}
/** unit vector the building's front (door) faces, in tile space */
export function frontDir(rot: number): [number, number] {
  return ([[0, 1], [-1, 0], [0, -1], [1, 0]] as [number, number][])[((rot % 4) + 4) % 4]!;
}
export function buildingCentre(b: Building): [number, number] {
  return [b.x + b.w / 2, b.y + b.h / 2];
}
/** tile coords → three.js world x/z */
export function toWorld(x: number, y: number): [number, number] {
  return [x - MAP_W / 2, y - MAP_H / 2];
}
export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

// ───────────── heralds ─────────────

const HERALD_CAP = 120;

export function herald(
  s: GameState, kind: HeraldKind, text: string,
  refs: { buildingId?: Id; tenantId?: Id; incidentId?: Id; staffId?: Id } = {},
): Herald {
  const h: Herald = { id: newId(s, 'h'), day: s.day, kind, text, ...refs };
  s.heralds.push(h);
  if (s.heralds.length > HERALD_CAP) s.heralds.splice(0, s.heralds.length - HERALD_CAP);
  emit(s, { type: 'herald', herald: h });
  return h;
}

// ───────────── text templates ─────────────

/** Replace {placeholders}; unknown ones are left out rather than shown raw. */
export function fill(template: string, vars: Record<string, string | number | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = vars[k];
    return v === undefined || v === null ? '' : String(v);
  }).replace(/\s{2,}/g, ' ').replace(/\s+([,.;!?])/g, '$1').trim();
}

/** Standard placeholder set for a state + optional building/tenant. Modules add their own on top. */
export function baseVars(
  s: GameState, b?: Building | null, t?: Tenant | null,
): Record<string, string | number> {
  const d = dateOf(s.day);
  const v: Record<string, string | number> = {
    ruler: s.realm.ruler, title: rulerTitle(s), realm: s.realm.name, rival: s.rival.name,
    season: d.season, month: MONTH_NAMES[d.month]!,
  };
  if (b) { v.building = b.name; v.btype = b.type.replace(/_/g, ' '); v.rent = b.rent; }
  if (t) {
    v.tenant = t.name; v.first = t.first; v.trade = t.trade.replace(/_/g, ' '); v.species = t.species;
    if (t.lease) v.rent = t.lease.rent;
    if (t.pets.length) v.pet = t.pets[0]!.replace(/_/g, ' ');
  }
  return v;
}

// ───────────── job completion fan-out ─────────────

let modulesRef: SimModule[] = [];
/** index.ts registers the module list so jobs.ts can announce completions without importing index. */
export function registerModules(mods: SimModule[]): void { modulesRef = mods; }
/** Called by jobs.ts exactly once when a job reaches state 'done'. */
export function notifyJobDone(s: GameState, job: Job): void {
  for (const m of modulesRef) m.onJobDone?.(s, job);
}

export function notImplemented(who: string, what: string): never {
  throw new Error(`[sim] ${what} is not implemented yet (owner: ${who})`);
}
