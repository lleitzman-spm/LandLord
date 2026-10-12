/**
 * OWNER: sim-decide agent. The incident engine: everything that "comes up".
 * Data-driven: it knows nothing about griffins, only about IncidentDefs.
 *
 * Life of an incident
 *   spawn      vars filled once, timer set, the def's visual goes on the building.
 *              orders.decide is asked first: if a standing order or a delegate
 *              settles it, the feed carries one line, in the delegate's voice,
 *              instead of the alarm. Otherwise the herald announces it and, for
 *              an audience, a petitioner walks to the seat and waits.
 *   resolve    an outcome is chosen (ruler, order or delegate). With a `job`
 *              the incident is 'in_progress' until the work is done; the
 *              effects land then. Without one they land at once.
 *   expire     the timer ran out (or the ruler waved it away): `onExpire` lands.
 *
 * What is kept where (all inside state this module owns):
 *   s.incidentLog   defId -> day it last spawned. Keys starting '~' are engine
 *                   memory (never def ids, which are snake_case):
 *                   '~pet.<household>.<animal>' an animal already ruled on,
 *                   '~staff.*' the staff module's few counters.
 *   s.pending       scheduled spawns. defIds starting '*' are engine slots: the
 *                   month's random draws, the scripted first beats, and the
 *                   clean-up of petitioners who have left the table.
 */
import {
  DAYS_PER_MONTH, STAFF_ROLES,
  type GameState, type SimModule, type Incident, type Id, type DecisionType, type ResolvedBy,
  type ActionResult, type RefusalCode, type Building, type Tenant, type Applicant, type Job,
  type WeatherKind, type Season, type RankId, type StaffRole, type HeraldKind, type StaffMember,
} from './types';
import type { IncidentDef, OutcomeDef, Requires, Effect } from '../data/schema';
import type { Species, TradeId, TraitId, TenantTag, PetKind, SquatterKind, VisualId } from '../data/ids';
import { ROLE_TITLES, SQUATTER_KINDS } from '../data/ids';
import { INCIDENTS, INCIDENT_BY_ID } from '../data/incidents/index';
import { BUILDINGS } from '../data/buildings';
import { TRAIT_DEFS } from '../data/traits';
import { TEMPERAMENT_DEFS } from '../data/temperaments';
import { BAL } from '../data/balance';
import {
  emit, herald, baseVars, newId, rand, chance, pick, weighted, rankIndex, seasonOf, dateOf,
  frontDir, dist, clamp, monthsBetween,
} from './core';
import { applyEffects, fillText, type EffectCtx } from './effects';
import { decide, report, quirk, reportCovers, domainRole } from './orders';
import { staffOf, staffByActor, countermand } from './staff';
import { enqueueJob, hasWorker, type JobSpec } from './jobs';
import { spawnActor, removeActor, walkTo, gatePoint } from './actors';
import { seatOf, addVisual, removeVisual, setSquatters, vacancies, countBuildings } from './buildings';
import { entranceOf, isWalkable } from './world';
import { housed, tenantsOf, neighborsOf, householdCount, spawnApplicant, moveOut } from './tenants';

export interface IncidentTarget { buildingId?: Id; unit?: number; tenantId?: Id; applicantId?: Id }

export const TUNE = {
  /** most incidents open at once, by rank; urgency 3 may exceed by one */
  caps: { reeve: 3, knight: 5, baron: 7, duke: 8, king: 9 } as Record<RankId, number>,
  /** petitioners who can wait at the seat at once */
  courtRoom: 3,
  /** the scheduler aims for about this share of audiences among random incidents */
  audienceShare: 0.25,
  /** a slot that found the realm full tries again after this many days, within its month */
  retryDays: 2,
  chainRetries: 4,
  /** scripted first beats of a new reign */
  firstLeakDay: 2, firstApplicantDay: 12, firstAudienceDay: 33, firstAudienceUntil: 80,
  /** chance per day that the weather turns */
  weatherTurn: 0.38, stormTurn: 0.75,
  /** closed incidents kept for the record */
  keepClosed: 40,
  /** days a dismissed petitioner has to get off the table before being lifted off it */
  exitDays: 6,
  /** an incident handed back to the ruler keeps at least this long on its timer */
  reopenDays: 3,
};

/** Test and bot instrumentation. Never set in the shipped game. */
export const HOOKS: {
  /** called as each incident is created; `openBefore` counts those open or in progress before it */
  onSpawn: null | ((s: GameState, inc: Incident, def: IncidentDef, openBefore: number, source: SpawnSource) => void);
} = { onSpawn: null };
export type SpawnSource = 'random' | 'chain' | 'system' | 'direct';

const SLOT_RANDOM = '*random';
const SLOT_LEAK = '*first_leak';
const SLOT_APPLICANT = '*first_applicant';
const SLOT_AUDIENCE = '*first_audience';
const SLOT_GONE = '*petitioner_gone';

const WEATHER: Record<Season, [WeatherKind, number][]> = {
  spring: [['clear', 5], ['rain', 4], ['fog', 1.2], ['storm', 0.5], ['hail', 0.3]],
  summer: [['clear', 6], ['heat', 3], ['storm', 1.4], ['rain', 0.8]],
  autumn: [['clear', 4], ['rain', 4], ['fog', 2.4], ['storm', 0.9]],
  winter: [['clear', 3.5], ['snow', 5], ['fog', 1.4], ['hail', 0.5]],
};

/** A visual that belongs to a creature stays for as long as the creature does. */
const PET_VISUAL: Partial<Record<VisualId, PetKind>> = { griffin_roof: 'griffin', small_dragon: 'small_dragon' };
const SQUATTER_VISUAL: Partial<Record<VisualId, SquatterKind>> = { goblins_windows: 'goblins' };

// ───────────── reading ─────────────

export function defOf(inc: Incident): IncidentDef { return INCIDENT_BY_ID[inc.defId]!; }
export function openIncidents(s: GameState): Incident[] {
  return Object.values(s.incidents).filter(i => i.state === 'open' || i.state === 'in_progress');
}
export function incidentsAt(s: GameState, buildingId: Id): Incident[] {
  return openIncidents(s).filter(i => i.buildingId === buildingId);
}
/** Most incidents the realm will carry at once at this rank. */
export function openCap(s: GameState): number { return TUNE.caps[s.realm.rank] ?? 7; }

/** The household an incident is about, housed or still at the door, as orders and requirements see it. */
export interface HouseholdView {
  id: Id; name: string; first: string; species: Species; trade: TradeId;
  traits: TraitId[]; revealed: TraitId[]; tags: TenantTag[]; pets: PetKind[];
  household: number; happiness: number; monthsHoused: number; daysLate: number; arrears: number;
  rent: number | null; isTenant: boolean;
}
function viewOfTenant(s: GameState, t: Tenant): HouseholdView {
  return {
    id: t.id, name: t.name, first: t.first, species: t.species, trade: t.trade, traits: t.traits, revealed: t.revealed,
    tags: t.tags, pets: t.pets, household: t.household, happiness: t.happiness,
    monthsHoused: Math.max(0, monthsBetween(t.movedInDay, t.leftDay ?? s.day)), daysLate: t.daysLate, arrears: t.arrears,
    rent: t.lease ? t.lease.rent : null, isTenant: true,
  };
}
function viewOfApplicant(a: Applicant): HouseholdView {
  const h = a.household;
  return {
    id: h.id, name: h.name, first: h.first, species: h.species, trade: h.trade, traits: h.traits, revealed: h.revealed,
    tags: h.tags, pets: h.pets, household: h.household, happiness: 50, monthsHoused: 0, daysLate: 0, arrears: 0,
    rent: null, isTenant: false,
  };
}
export function householdOf(s: GameState, inc: { tenantId: Id | null; applicantId: Id | null }): HouseholdView | null {
  const t = inc.tenantId ? s.tenants[inc.tenantId] : null;
  if (t) return viewOfTenant(s, t);
  const a = inc.applicantId ? s.applicants[inc.applicantId] : null;
  return a ? viewOfApplicant(a) : null;
}

// ───────────── where an incident lands ─────────────

interface Where { b: Building | null; unit: number | null; t: Tenant | null; a: Applicant | null }

function locate(s: GameState, target: IncidentTarget, def: IncidentDef): Where {
  const a = target.applicantId ? (s.applicants[target.applicantId] ?? null) : null;
  let t = target.tenantId ? (s.tenants[target.tenantId] ?? null) : null;
  let b: Building | null = target.buildingId ? (s.buildings[target.buildingId] ?? null) : null;
  if (!b && t?.buildingId) b = s.buildings[t.buildingId] ?? null;
  if (!b && t && !t.buildingId) {
    // a household that has left: tenants.ts notes where they lived, when it remembers to
    const was = (t as { aux?: { home?: unknown } }).aux?.home;
    if (typeof was === 'string') b = s.buildings[was] ?? null;
  }
  if (!b && a) b = s.buildings[a.buildingId] ?? null;
  let unit: number | null = target.unit ?? null;
  if (unit === null && t && b && t.buildingId === b.id) unit = t.unit;
  if (unit === null && a) unit = a.unit;
  // a building-targeted incident on an occupied building carries the occupant
  if (!t && !a && b && def.target === 'building') {
    const tid = unit !== null ? (b.units[unit]?.tenantId ?? null) : (b.units.find(u => u.tenantId)?.tenantId ?? null);
    if (tid && s.tenants[tid]) { t = s.tenants[tid]!; if (unit === null) unit = t.unit; }
  }
  return { b, unit, t, a };
}

function rankFits(s: GameState, def: IncidentDef): boolean {
  const r = rankIndex(s.realm.rank);
  return r >= rankIndex(def.minRank) && (!def.maxRank || r <= rankIndex(def.maxRank));
}
function seasonFits(s: GameState, def: IncidentDef): boolean {
  return !def.seasons || !def.seasons.length || def.seasons.includes(seasonOf(s.day));
}
function offCooldown(s: GameState, def: IncidentDef): boolean {
  const last = s.incidentLog[def.id];
  if (last === undefined) return true;
  if (def.once) return false;
  return s.day - last >= def.cooldownMonths * DAYS_PER_MONTH;
}

/** The parts of `requires` that concern the whole realm. */
function realmFits(s: GameState, r: Requires | undefined): boolean {
  if (!r) return true;
  if (r.hasStaff && !r.hasStaff.every(role => staffOf(s, role))) return false;
  if (r.lacksStaff && r.lacksStaff.some(role => staffOf(s, role))) return false;
  if (r.hasBuilding && !r.hasBuilding.every(bt => countBuildings(s, bt) > 0)) return false;
  if (r.lacksBuilding && r.lacksBuilding.some(bt => countBuildings(s, bt) > 0)) return false;
  if (r.goldAbove !== undefined && !(s.gold > r.goldAbove)) return false;
  if (r.goldBelow !== undefined && !(s.gold < r.goldBelow)) return false;
  if (r.renownAbove !== undefined && !(s.renown > r.renownAbove)) return false;
  if (r.renownBelow !== undefined && !(s.renown < r.renownBelow)) return false;
  if (r.favorAbove !== undefined && !(s.favor > r.favorAbove)) return false;
  if (r.favorBelow !== undefined && !(s.favor < r.favorBelow)) return false;
  if (r.householdsAbove !== undefined && !(householdCount(s) > r.householdsAbove)) return false;
  if (r.flag && !r.flag.every(k => !!s.flags[k])) return false;
  if (r.notFlag && r.notFlag.some(k => !!s.flags[k])) return false;
  if (r.policyPets && !r.policyPets.includes(s.policies.pets)) return false;
  if (r.yearAbove !== undefined && !(dateOf(s.day).year > r.yearAbove)) return false;
  return true;
}

/** The parts of `requires` that concern the chosen building, unit and household. */
function targetFits(s: GameState, r: Requires | undefined, w: Where): boolean {
  if (!r) return true;
  const b = w.b;
  if (r.buildingType && !(b && r.buildingType.includes(b.type))) return false;
  if (r.buildingCategory && !(b && r.buildingCategory.includes(BUILDINGS[b.type].category))) return false;
  if (r.conditionBelow !== undefined && !(b && b.condition < r.conditionBelow)) return false;
  if (r.conditionAbove !== undefined && !(b && b.condition > r.conditionAbove)) return false;
  if (r.buildingFlag && !(b && r.buildingFlag.every(k => !!b.flags[k]))) return false;
  if (r.notBuildingFlag && b && r.notBuildingFlag.some(k => !!b.flags[k])) return false;
  if (r.vacantDaysAbove !== undefined) {
    const u = b && w.unit !== null ? b.units[w.unit] : null;
    if (!u || u.tenantId || u.vacantSince === null || !(s.day - u.vacantSince > r.vacantDaysAbove)) return false;
  }
  const needsHousehold = r.species || r.trade || r.trait || r.tag || r.hasPet !== undefined || r.pet
    || r.happinessBelow !== undefined || r.happinessAbove !== undefined || r.monthsHousedAbove !== undefined;
  if (!needsHousehold) return true;
  // whose household? Someone at the door of an empty unit is asked about as themselves (an applicant variant on
  // target 'vacant' names the species, trade, tag or trait of the APPLICANT); otherwise it is whoever lives there.
  const h = w.a && !(w.t && w.b && w.unit !== null && w.b.units[w.unit]?.tenantId === w.t.id) ? viewOfApplicant(w.a)
    : w.t ? viewOfTenant(s, w.t) : null;
  if (!h) return false;
  if (r.species && !r.species.includes(h.species)) return false;
  if (r.trade && !r.trade.includes(h.trade)) return false;
  if (r.trait && !r.trait.some(x => h.traits.includes(x))) return false;      // hidden ones count
  if (r.tag && !r.tag.some(x => h.tags.includes(x))) return false;
  if (r.hasPet !== undefined && (h.pets.length > 0) !== r.hasPet) return false;
  if (r.pet && !r.pet.some(x => h.pets.includes(x))) return false;
  if (r.happinessBelow !== undefined && !(h.happiness < r.happinessBelow)) return false;
  if (r.happinessAbove !== undefined && !(h.happiness > r.happinessAbove)) return false;
  if (r.monthsHousedAbove !== undefined && !(h.isTenant && h.monthsHoused > r.monthsHousedAbove)) return false;
  return true;
}

/** Would this def be at home on this target right now? (Rank, season and cooldown are the scheduler's business.) */
export function fitsTarget(s: GameState, def: IncidentDef, target: IncidentTarget): boolean {
  const w = locate(s, target, def);
  if (def.target === 'tenant' && !w.t && !w.a) return false;
  if ((def.target === 'building' || def.target === 'vacant') && !w.b) return false;
  return realmFits(s, def.requires) && targetFits(s, def.requires, w);
}

/** Every target the scheduler may pick for this def: fits `requires`, and has nothing else going on. */
function targetsFor(s: GameState, def: IncidentDef, busyB: Set<Id>, busyT: Set<Id>): IncidentTarget[] {
  const r = def.requires;
  if (!realmFits(s, r)) return [];
  const out: IncidentTarget[] = [];
  switch (def.target) {
    case 'realm': out.push({}); break;
    case 'tenant':
      for (const t of housed(s)) {
        const b = t.buildingId ? s.buildings[t.buildingId] : null;
        if (!b || b.state !== 'ready' || busyT.has(t.id) || busyB.has(b.id)) continue;
        if (targetFits(s, r, { b, unit: t.unit, t, a: null })) out.push({ tenantId: t.id, buildingId: b.id, unit: t.unit });
      }
      break;
    case 'building': {
      const named = !!(r?.buildingType || r?.buildingCategory);
      for (const b of Object.values(s.buildings)) {
        if (b.state !== 'ready' || busyB.has(b.id)) continue;
        const cat = BUILDINGS[b.type].category;
        // a def that names no kind of building means somewhere people live or trade: a chimney fire wants a chimney.
        // Wells, statues, the staff's yards and the ruler's own roof are left alone unless a def asks for them.
        if (!named && cat !== 'housing' && cat !== 'commercial') continue;
        const occupied = b.units.map((u, i) => (u.tenantId ? i : -1)).filter(i => i >= 0);
        const unit = occupied.length ? occupied[Math.floor(rand(s) * occupied.length)]! : null;
        const target: IncidentTarget = unit !== null ? { buildingId: b.id, unit } : { buildingId: b.id };
        const w = locate(s, target, def);
        if (w.t && busyT.has(w.t.id)) continue;
        if (targetFits(s, r, w)) out.push(target);
      }
      break;
    }
    case 'vacant': {
      const waiting = new Set(Object.values(s.applicants).map(a => a.buildingId + ':' + a.unit));
      // An applicant variant drawn at random sends word for its own household (spawn() asks for the species and trade it
      // names), so those two are not held against an empty doorway. A tag or a trait cannot be sent for: such a variant
      // waits for the lettings pipeline to bring someone who has it (spawnDecision).
      let rv = r;
      if (r && def.decision === 'applicant' && (r.species || r.trade)) { rv = { ...r }; delete rv.species; delete rv.trade; }
      for (const v of vacancies(s)) {
        const b = v.building;
        if (busyB.has(b.id) || b.squatters || waiting.has(b.id + ':' + v.unit)) continue;
        if (targetFits(s, rv, { b, unit: v.unit, t: null, a: null })) out.push({ buildingId: b.id, unit: v.unit });
      }
      break;
    }
  }
  return out;
}

// ───────────── vars ─────────────

const isStaffRole = (x: unknown): x is StaffRole => typeof x === 'string' && (STAFF_ROLES as string[]).includes(x);

function door(s: GameState, b: Building): [number, number] {
  try { return entranceOf(s, b); } catch { return [b.x + b.w / 2, b.y + b.h / 2]; }
}

/** The delegate an incident is "about" (for {staff} and for petitioner 'staff'). */
function staffFor(s: GameState, def: IncidentDef): { role: StaffRole; m: StaffMember | null } {
  const roles: StaffRole[] = [...(def.requires?.hasStaff ?? [])];
  const dr = domainRole(def); if (dr) roles.push(dr);
  const jobs = [def.outcomes.find(o => o.default), ...def.outcomes].map(o => o?.job?.role).filter(isStaffRole);
  roles.push(...jobs);
  for (const o of def.outcomes) for (const e of o.effects) if (e.t === 'loyalty') roles.push(e.role);
  for (const role of roles) { const m = staffOf(s, role); if (m) return { role, m }; }
  if (!roles.length) { const any = Object.values(s.staff)[0]; if (any) return { role: any.role, m: any }; }
  return { role: roles[0] ?? 'steward', m: null };
}

function petFor(def: IncidentDef, w: Where): string {
  const pets = w.t?.pets ?? w.a?.household.pets ?? [];
  const wanted = def.requires?.pet?.find(p => pets.includes(p));
  if (wanted) return wanted;
  for (const o of def.outcomes) for (const e of o.effects) if (e.t === 'pet' && e.add) return e.add;
  for (const e of def.onExpire) if (e.t === 'pet' && e.add) return e.add;
  return pets[0] ?? def.requires?.pet?.[0] ?? 'animal';
}

function amountFor(def: IncidentDef, w: Where): number {
  const t = w.t;
  switch (def.decision) {
    case 'late_rent': case 'eviction_ready':
      if (t) return Math.round(t.arrears > 0 ? t.arrears : (t.lease?.rent ?? 0));
      break;
    case 'move_out_deposit': if (t?.lease && t.lease.deposit > 0) return Math.round(t.lease.deposit); break;
    case 'rent_renewal': if (t?.lease) return t.lease.rent; break;
    case 'applicant': if (w.b) return w.b.rent; break;
    default: break;
  }
  let coin = 0;
  for (const o of def.outcomes) for (const e of o.effects) if (e.t === 'gold') coin = Math.max(coin, Math.abs(e.amount));
  if (coin) return Math.round(coin);
  const work = (def.outcomes.find(o => o.default) ?? def.outcomes.find(o => o.job))?.job?.cost;
  if (work) return work;
  if (t && t.arrears > 0) return Math.round(t.arrears);
  if (t?.lease) return t.lease.rent;
  return w.b ? w.b.rent : 0;
}

function buildVars(s: GameState, def: IncidentDef, w: Where, extra?: Record<string, string | number>): Record<string, string | number> {
  const v = baseVars(s, w.b, w.t);
  if (w.a && !w.t) {
    const h = w.a.household;
    v.tenant = h.name; v.first = h.first; v.trade = h.trade.replace(/_/g, ' '); v.species = h.species;
  }
  if (def.target === 'tenant' && !w.b) { v.building = 'the old lodging'; v.btype = 'lodging'; }
  v.pet = petFor(def, w).replace(/_/g, ' ');
  v.amount = amountFor(def, w);
  const st = staffFor(s, def);
  v.staff = st.m ? st.m.first : `the ${ROLE_TITLES[st.role]}`;
  if (extra) for (const k of Object.keys(extra)) { const x = extra[k]; if (x !== undefined && x !== null) v[k] = x; }
  return v;
}

function appearKind(def: IncidentDef): HeraldKind {
  if (def.category === 'windfall' || def.category === 'festival') return 'good';
  if (def.category === 'crown') return 'crown';
  if (def.category === 'rival') return 'rival';
  if (def.urgency >= 3 || (def.audience && def.urgency >= 2)) return 'urgent';
  return def.urgency >= 2 ? 'bad' : 'info';
}

/** A rough reading of a list of effects: is this good news, bad news, or just news? */
function tone(effects: Effect[]): HeraldKind {
  let n = 0;
  for (const e of effects) {
    if (e.t === 'gold') n += Math.sign(e.amount);
    else if (e.t === 'renown' || e.t === 'favor') n += Math.sign(e.amount) * 2;
    else if (e.t === 'happiness') n += Math.sign(e.amount) * (e.scope === 'all' ? 2 : 1);
    else if (e.t === 'condition') n += Math.sign(e.amount);
    else if (e.t === 'evict' || e.t === 'leave') n -= 2;
  }
  return n > 1 ? 'good' : n < -1 ? 'bad' : 'info';
}

function refsOf(s: GameState, inc: Incident): { buildingId?: Id; tenantId?: Id; incidentId: Id } {
  return {
    incidentId: inc.id,
    ...(inc.buildingId && s.buildings[inc.buildingId] ? { buildingId: inc.buildingId } : {}),
    ...(inc.tenantId && s.tenants[inc.tenantId] ? { tenantId: inc.tenantId } : {}),
  };
}

function squatterKindOf(def: IncidentDef): SquatterKind {
  const hay = (def.id + ' ' + def.title).toLowerCase();
  for (const k of SQUATTER_KINDS) if (hay.includes(k.replace(/s$/, '').replace(/_.*/, ''))) return k;
  return 'goblins';
}

// ───────────── the court: petitioners ─────────────

/** Standing room before the seat: a short queue a step out from the door, so nobody stands on the ruler.
 *  Best places first. Where the forecourt is built up, they stand wherever there is ground nearby. */
function courtSpots(s: GameState): [number, number][] {
  const seat = seatOf(s);
  if (!seat) return [];
  const e = door(s, seat);
  const [fx, fy] = frontDir(seat.rot);
  const px = -fy, py = fx;
  const out: [number, number][] = [];
  const offer = (x: number, y: number): void => {
    if (isWalkable(s, x, y) && dist(x, y, e[0], e[1]) >= 0.55 && !out.some(o => dist(o[0], o[1], x, y) < 0.45)) out.push([x, y]);
  };
  // (steps out from the door, steps along the wall)
  for (const [df, dp] of [[0.9, 0], [0.9, 0.62], [0.9, -0.62], [1.6, 0.31], [1.6, -0.31], [1.6, 0.93], [1.6, -0.93]] as [number, number][]) {
    offer(e[0] + fx * df + px * dp, e[1] + fy * df + py * dp);
  }
  if (out.length < TUNE.courtRoom + 1) {
    const ring: [number, number][] = [];
    for (let dy = -2.5; dy <= 2.5; dy += 0.62) for (let dx = -2.5; dx <= 2.5; dx += 0.62) ring.push([e[0] + dx, e[1] + dy]);
    const fxp = e[0] + fx * 0.9, fyp = e[1] + fy * 0.9;
    ring.sort((a, b) => dist(a[0], a[1], fxp, fyp) - dist(b[0], b[1], fxp, fyp));
    for (const [x, y] of ring) { if (out.length >= TUNE.courtRoom + 3) break; offer(x, y); }
  }
  if (!out.length) out.push(e);
  return out;
}

/** Actors at (or on their way to) the seat on account of an open incident. */
function courtActors(s: GameState): Id[] {
  const ids: Id[] = [];
  for (const inc of Object.values(s.incidents)) {
    if (inc.state !== 'open' || !inc.actorId) continue;
    const a = s.actors[inc.actorId];
    if (a && (a.kind === 'petitioner' || a.kind === 'applicant') && !ids.includes(a.id)) ids.push(a.id);
  }
  return ids;
}
function courtFull(s: GameState): boolean { return courtActors(s).length >= TUNE.courtRoom; }

function freeSpot(s: GameState, forActor?: Id): [number, number] | null {
  const spots = courtSpots(s);
  if (!spots.length) return null;
  // where each figure already at court stands, or is headed (a delegate come to petition takes up a place too)
  const taken: [number, number][] = [];
  for (const inc of Object.values(s.incidents)) {
    const a = inc.state === 'open' && inc.actorId && inc.actorId !== forActor ? s.actors[inc.actorId] : null;
    if (a) taken.push(a.path.length ? a.path[a.path.length - 1]! : [a.x, a.y]);
  }
  return spots.find(sp => !taken.some(t => dist(t[0], t[1], sp[0], sp[1]) < 0.45)) ?? spots[0]!;
}

/** A delegate with a petition of their own comes to the seat as soon as their hands are free, and waits there. */
function attend(s: GameState, inc: Incident): void {
  const a = inc.actorId ? s.actors[inc.actorId] : null;
  if (!a || a.kind !== 'staff' || a.jobId || a.state === 'working') return;
  const spots = courtSpots(s);
  const end: [number, number] = a.path.length ? a.path[a.path.length - 1]! : [a.x, a.y];
  if (spots.some(sp => dist(sp[0], sp[1], end[0], end[1]) < 0.45)) return;      // there already, or on the way
  const spot = freeSpot(s, a.id);
  if (spot) walkTo(s, a.id, spot[0], spot[1]);
}

/** Bring the petitioner to the seat, if there is one to bring and room for them. */
function summon(s: GameState, inc: Incident, def: IncidentDef): void {
  if (!def.audience || !def.petitioner || inc.state !== 'open') return;
  if (inc.actorId && s.actors[inc.actorId]) return;
  inc.actorId = null;
  const spec = def.petitioner;

  if (spec === 'staff') {
    // a delegate petitions in person, between jobs, on their own two feet
    const m = staffFor(s, def).m;
    const a = m?.actorId ? s.actors[m.actorId] : null;
    if (!a) return;
    inc.actorId = a.id;
    attend(s, inc);
    return;
  }

  if (courtFull(s)) return;            // no room at court: they wait at home and are sent for later
  const spot = freeSpot(s);
  if (!spot) return;

  const applicant = inc.applicantId ? s.applicants[inc.applicantId] : null;
  if (spec === 'applicant' || applicant) {
    const a = applicant?.actorId ? s.actors[applicant.actorId] : null;
    if (!a) return;
    inc.actorId = a.id;
    walkTo(s, a.id, spot[0], spot[1]);
    return;
  }

  let refId: Id; let from: [number, number] = gatePoint(s);
  if (spec === 'tenant') {
    const t = inc.tenantId ? s.tenants[inc.tenantId] : null;
    if (!t) return;
    refId = t.id;
    const b = t.status === 'housed' && t.buildingId ? s.buildings[t.buildingId] : null;
    if (b) from = door(s, b);
  } else if (spec === 'neighbor') {
    const near = inc.buildingId ? neighborsOf(s, inc.buildingId, 4).filter(n => n.id !== inc.tenantId) : [];
    const pool = near.length ? near : housed(s).filter(n => n.id !== inc.tenantId);
    if (!pool.length) return;
    const n = pick(s, pool);
    refId = n.id;
    const b = n.buildingId ? s.buildings[n.buildingId] : null;
    if (b) from = door(s, b);
  } else {
    refId = spec.npc;
  }
  // home is where they set out from: actors.ts lifts a guest off the table when they walk back to it
  const a = spawnActor(s, { kind: 'petitioner', refId, x: from[0], y: from[1], speed: BAL.walkSpeed.visitor });
  if (!a) return;
  walkTo(s, a.id, spot[0], spot[1]);
  inc.actorId = a.id;
}

/** The petitioner has their answer (or has given up): home they go, or out by the gate. */
function release(s: GameState, inc: Incident): void {
  const id = inc.actorId;
  inc.actorId = null;
  const a = id ? s.actors[id] : null;
  if (!a || a.kind !== 'petitioner') return;        // applicants and delegates see themselves out
  // back to their own door if they still have one, else out by the gate. Either way that is now "home",
  // and a guest who reaches home has left the table.
  let dest = gatePoint(s);
  const t = a.refId ? s.tenants[a.refId] : null;
  const b = t && t.status === 'housed' && t.buildingId ? s.buildings[t.buildingId] : null;
  if (b) dest = door(s, b);
  a.homeX = dest[0]; a.homeY = dest[1];
  if (a.state === 'waiting') a.state = 'idle';
  if (!walkTo(s, a.id, dest[0], dest[1]) || (!a.path.length && dist(a.x, a.y, dest[0], dest[1]) < 0.6)) { removeActor(s, a.id); return; }
  s.pending.push({ defId: SLOT_GONE, day: s.day + TUNE.exitDays, buildingId: a.id, tenantId: null, vars: {} });
}

/** Lift departed petitioners off the table once they are home, and stand arrivals in the queue. */
function tidyCourt(s: GameState): void {
  let live: Set<Id> | null = null;
  for (const a of Object.values(s.actors)) {
    if (a.kind !== 'petitioner') continue;
    if (!live) { live = new Set(); for (const inc of Object.values(s.incidents)) if (inc.state === 'open' && inc.actorId) live.add(inc.actorId); }
    const arrived = a.path.length === 0 && a.state !== 'walking';
    if (live.has(a.id)) { if (arrived && a.state === 'idle') a.state = 'waiting'; continue; }
    if (arrived || dist(a.x, a.y, a.homeX, a.homeY) < 0.6) removeActor(s, a.id);
  }
}

// ───────────── spawning ─────────────

interface SpawnOpts { quiet?: boolean; expiresDay?: number | null; source?: SpawnSource }

function spawn(s: GameState, defId: string, target: IncidentTarget, vars?: Record<string, string | number>, opts: SpawnOpts = {}): Incident | null {
  const def = INCIDENT_BY_ID[defId];
  if (!def || !def.outcomes?.length) return null;
  const w = locate(s, target, def);
  if (def.target === 'tenant' && !w.t && !w.a) return null;
  if ((def.target === 'building' || def.target === 'vacant') && !w.b) return null;

  // a decision about an applicant needs an applicant: use the one at the door, or send word for one
  if (def.decision === 'applicant' && !w.a && !w.t) {
    const b = w.b; if (!b || b.state !== 'ready') return null;
    let unit = w.unit;
    if (unit === null || !b.units[unit] || b.units[unit]!.tenantId) unit = b.units.findIndex(u => !u.tenantId);
    if (unit < 0) return null;
    let a = Object.values(s.applicants).find(x => x.buildingId === b.id && x.unit === unit) ?? null;
    if (!a) {
      const want: { species?: Species; trade?: TradeId } = {};
      if (def.requires?.species?.length) want.species = pick(s, def.requires.species);
      if (def.requires?.trade?.length) want.trade = pick(s, def.requires.trade);
      a = spawnApplicant(s, b.id, unit, want) ?? null;
    }
    if (!a) return null;
    w.a = a; w.unit = unit;
  }

  const bid = w.b?.id ?? null, tid = w.t?.id ?? null, aid = w.a?.id ?? null;
  for (const i of Object.values(s.incidents)) {
    if ((i.state === 'open' || i.state === 'in_progress') && i.defId === def.id && i.buildingId === bid && i.tenantId === tid
      && i.applicantId === aid && (def.target !== 'vacant' || i.unit === w.unit)) return null;   // already before the court
  }

  if (def.decision === 'squatters' && w.b && !w.b.squatters) setSquatters(s, w.b.id, squatterKindOf(def));

  let expiresDay: number | null = null;
  if (opts.expiresDay !== undefined) expiresDay = opts.expiresDay;
  else if (def.timerDays > 0) {
    // some households are quicker to lose patience than others
    let patience = 1;
    if (w.t && def.target === 'tenant') for (const tr of w.t.traits) patience *= TRAIT_DEFS[tr]?.patience ?? 1;
    expiresDay = s.day + def.timerDays * clamp(patience, 0.5, 2);
  }

  const inc: Incident = {
    id: newId(s, 'i'), defId: def.id, state: 'open', buildingId: bid, unit: w.unit, tenantId: tid, applicantId: aid,
    startedDay: s.day, expiresDay, vars: buildVars(s, def, w, vars), outcomeId: null, resolvedBy: null, jobId: null,
    actorId: null, reported: false,
  };
  if (HOOKS.onSpawn) HOOKS.onSpawn(s, inc, def, openIncidents(s).length, opts.source ?? 'direct');
  s.incidents[inc.id] = inc;
  s.incidentLog[def.id] = s.day;
  if (def.visual && w.b) addVisual(s, w.b.id, def.visual);

  // does it ever reach the ruler? an order or a delegate may settle it on the spot
  const d = decide(s, inc);
  if (d && resolveBy(s, inc.id, d.outcomeId, d.by, d.orderId).ok) return inc;

  if (!opts.quiet) herald(s, appearKind(def), fillText(def.herald, inc.vars), refsOf(s, inc));
  emit(s, { type: 'incident', incidentId: inc.id });
  if (w.b && !def.audience) emit(s, { type: 'emote', emote: def.urgency >= 2 ? 'alert' : 'question', buildingId: w.b.id });
  summon(s, inc, def);
  return inc;
}

/** Spawn a specific incident on a target (requirements are NOT re-checked). Null if the def is unknown or the target is invalid. */
export function spawnIncident(s: GameState, defId: string, target: IncidentTarget, vars?: Record<string, string | number>): Incident | null {
  return spawn(s, defId, target, vars);
}

/** Spawn a system decision: picks among defs with system:true and this decision type whose `requires` fit the target.
 *  If a standing order / delegate settles it at once (orders.decide), it resolves immediately. */
export function spawnDecision(s: GameState, decision: DecisionType, target: IncidentTarget, vars?: Record<string, string | number>): Incident | null {
  const pool = INCIDENTS.filter(d => d.system && d.decision === decision);
  if (!pool.length) return null;
  // one ruling at a time per subject: asking twice returns the matter already open
  const probe = locate(s, target, pool[0]!);
  const bid = probe.b?.id ?? null;
  for (const i of Object.values(s.incidents)) {
    if (i.state !== 'open' && i.state !== 'in_progress') continue;
    const d = INCIDENT_BY_ID[i.defId];
    if (!d || d.decision !== decision) continue;
    const same = target.applicantId ? i.applicantId === target.applicantId
      : target.tenantId ? i.tenantId === target.tenantId
        : i.buildingId === bid && (target.unit === undefined || i.unit === null || i.unit === target.unit);
    if (same) return i;
  }
  // an animal that has already had its day in court is not discovered a second time
  if (decision === 'pet' && probe.t?.pets.length && s.incidentLog[petKey(probe.t.id, probe.t.pets[0]!)] !== undefined) return null;
  const fitting = pool.filter(d => d.weight > 0 && rankFits(s, d) && seasonFits(s, d) && offCooldown(s, d) && fitsTarget(s, d, target));
  let def = weighted(s, fitting, d => d.weight);
  if (!def) {
    // nothing fits exactly: the plainest variant will do, since the pipeline must have its ruling.
    // But not on the wrong kind of building: a leak "over the bed" is no use to a well.
    const right = (d: IncidentDef): boolean => {
      const r = d.requires, b = probe.b;
      if (r?.buildingType && !(b && r.buildingType.includes(b.type))) return false;
      if (r?.buildingCategory && !(b && r.buildingCategory.includes(BUILDINGS[b.type].category))) return false;
      return true;
    };
    // (weight 0 marks a follow-up that only a chain may bring: not a fallback unless there is nothing else)
    // Nor about the wrong household, while there is a variant that is not: "a dwarf has seen the place" is no use to an elf
    // at the door. Judged on the household this ruling is about, the applicant's own before any tenant's (hidden traits count).
    const who = probe.a ? viewOfApplicant(probe.a) : probe.t ? viewOfTenant(s, probe.t) : null;
    const suits = (d: IncidentDef): boolean => {
      const r = d.requires;
      if (!r || !who) return true;
      if (r.species && !r.species.includes(who.species)) return false;
      if (r.trade && !r.trade.includes(who.trade)) return false;
      if (r.trait && !r.trait.some(x => who.traits.includes(x))) return false;
      if (r.tag && !r.tag.some(x => who.tags.includes(x))) return false;
      return true;
    };
    const there = pool.filter(right);
    const plain = (there.some(suits) ? there.filter(suits) : there).sort((a, b) => (Number(b.weight > 0) - Number(a.weight > 0)) || (Object.keys(a.requires ?? {}).length - Object.keys(b.requires ?? {}).length));
    def = plain.find(d => rankFits(s, d)) ?? plain[0] ?? null;
    if (!def) return null;
  }
  return spawn(s, def.id, target, vars, { source: 'system' });
}

// ───────────── resolving ─────────────

function refuse(code: RefusalCode, reason: string): ActionResult { return { ok: false, code, reason }; }

/** Why this outcome cannot be chosen right now, in words a delegate could say. Null if it can. */
export function outcomeBlocked(s: GameState, inc: Incident, o: OutcomeDef): string | null {
  if (String(inc.vars._done ?? '').split(',').includes(o.id)) return 'That has been done already. It wants a different answer now.';
  if (o.effects.some(e => e.t === 'screen') && inc.applicantId) {
    const a = s.applicants[inc.applicantId];
    if (a?.screened) return 'Their last landlord has already been asked. He was thorough.';
  }
  return null;
}

function ctxOf(inc: Incident, def: IncidentDef, option: OutcomeDef['option'] | null, quality = 1): EffectCtx {
  return {
    buildingId: inc.buildingId, unit: inc.unit, tenantId: inc.tenantId, applicantId: inc.applicantId, incidentId: inc.id,
    vars: inc.vars, title: def.title, option: option ?? null, quality,
  };
}

/** Take the def's visual off the building, unless what just happened says it stays. */
function settleVisual(s: GameState, inc: Incident, def: IncidentDef, effects: Effect[]): void {
  const v = def.visual;
  const b = inc.buildingId ? s.buildings[inc.buildingId] : null;
  if (!v || !b) return;
  if (effects.some(e => e.t === 'visual' && e.add === v)) return;
  const pet = PET_VISUAL[v];
  if (pet && tenantsOf(s, b.id).some(t => t.pets.includes(pet))) return;
  const sq = SQUATTER_VISUAL[v];
  if (sq && b.squatters?.kind === sq) return;
  if (incidentsAt(s, b.id).some(i => i.id !== inc.id && INCIDENT_BY_ID[i.defId]?.visual === v)) return;
  removeVisual(s, b.id, v);
}

const petKey = (tenantId: Id, pet: string): string => `~pet.${tenantId}.${pet}`;

/** A matter about an animal has closed: whatever the household still keeps has had its ruling, and is not "found" again. */
function notePets(s: GameState, inc: Incident, def: IncidentDef): void {
  if (def.decision !== 'pet' || !inc.tenantId) return;
  const t = s.tenants[inc.tenantId];
  if (t) for (const pet of t.pets) s.incidentLog[petKey(t.id, pet)] = s.day;
}

/** A household whose leaving was the whole point of the audience does, in the end, leave. */
function seeOut(s: GameState, inc: Incident, def: IncidentDef): void {
  if (def.decision !== 'move_out_deposit' || def.system || !inc.tenantId) return;
  const t = s.tenants[inc.tenantId];
  if (t && t.status === 'housed') moveOut(s, t.id, 'lease_end');
}

function finish(s: GameState, inc: Incident, def: IncidentDef, outcome: OutcomeDef, job: Job | null): void {
  const applicant = inc.applicantId ? s.applicants[inc.applicantId] : null;
  const householdId = inc.tenantId ?? applicant?.household.id ?? null;
  const doer = job ? staffByActor(s, job.assignee) : null;
  const quality = doer ? (TEMPERAMENT_DEFS[doer.temperament]?.quality ?? 1) : 1;
  inc.state = 'resolved';
  inc.outcomeId = outcome.id;
  const by: ResolvedBy = inc.resolvedBy ?? 'ruler';
  inc.resolvedBy = by;

  applyEffects(s, outcome.effects, ctxOf(inc, def, outcome.option, quality));
  seeOut(s, inc, def);
  settleVisual(s, inc, def, outcome.effects);

  // one line for how it ended. A delegate's own report already covers the plain system rulings,
  // and a lease that was offered is told by what the household did about it.
  let told = by === 'ruler' || !!outcome.job || !reportCovers(def, outcome);
  if (applicant && outcome.effects.some(e => e.t === 'lease' && e.accept)) {
    const signed = !!householdId && s.tenants[householdId]?.status === 'housed';
    if (!signed) told = false;                                       // they did not sign after all; the feed has already said why
    else if (def.system && outcome.option === 'accept') told = false; // the signing was announced in full, rent and surety
  }
  if (def.system && applicant && outcome.effects.some(e => e.t === 'screen')) told = false;   // what the last landlord said is the news
  notePets(s, inc, def);
  if (told) {
    const text = fillText(outcome.result, inc.vars);
    if (text) herald(s, tone(outcome.effects), text, refsOf(s, inc));
  }
  if (isStaffRole(by)) quirk(s, inc, def, outcome, householdId);

  s.stats.incidentsResolved++;
  emit(s, { type: 'incident_resolved', incidentId: inc.id, outcomeId: outcome.id, by });

  // an applicant who was neither signed nor sent away is still standing there, waiting on a real answer
  if (def.decision === 'applicant' && inc.applicantId && s.applicants[inc.applicantId] && !outcome.effects.some(e => e.t === 'lease')) {
    const done = [...String(inc.vars._done ?? '').split(',').filter(Boolean), outcome.id].join(',');
    const again = spawn(s, def.id, { applicantId: inc.applicantId, ...(inc.buildingId ? { buildingId: inc.buildingId } : {}), ...(inc.unit !== null ? { unit: inc.unit } : {}) },
      { _done: done, _round: Number(inc.vars._round ?? 0) + 1 }, { quiet: true, expiresDay: Math.max(inc.expiresDay ?? 0, s.day + TUNE.reopenDays), source: 'system' });
    if (again && again.state === 'open') emit(s, { type: 'incident', incidentId: again.id });
  }
}

/** Choose an outcome on someone's authority. `orderId` names the standing order that chose, when one did. */
export function resolveBy(s: GameState, incidentId: Id, outcomeId: string, by: ResolvedBy, orderId?: Id): ActionResult {
  const inc = s.incidents[incidentId];
  const def = inc ? INCIDENT_BY_ID[inc.defId] : undefined;
  if (!inc || !def) return refuse('not_found', 'That matter is not before the court.');
  if (inc.state === 'in_progress') return refuse('busy', 'That is already in hand. Someone has been sent.');
  if (inc.state !== 'open') return refuse('invalid', 'That matter is closed, and the ink is dry.');
  const outcome = def.outcomes.find(o => o.id === outcomeId);
  if (!outcome) return refuse('invalid', 'That is not among the remedies on offer.');
  const blocked = outcomeBlocked(s, inc, outcome);
  if (blocked) return refuse('invalid', blocked);
  if (outcome.job && !hasWorker(s, outcome.job.role)) return refuse('no_staff', 'There is no one free to send.');

  inc.outcomeId = outcome.id;
  inc.resolvedBy = by;
  if (by !== 'ruler') report(s, inc, def, outcome, by, orderId);

  // the petitioner has their answer and goes; a pin's reply is the worker's remark
  const petitioner = inc.actorId ? s.actors[inc.actorId] : null;
  if (petitioner && def.audience) {
    const mood = tone(outcome.effects.filter(e => e.t !== 'happiness' || (e.scope ?? 'tenant') === 'tenant'));
    emit(s, { type: 'emote', emote: mood === 'good' ? 'happy' : mood === 'bad' ? 'angry' : 'question', actorId: petitioner.id });
  }
  release(s, inc);
  if (!def.audience && by === 'ruler') {
    const role = outcome.job?.role;
    const m = isStaffRole(role) ? staffOf(s, role) : null;
    const text = fillText(outcome.reply, inc.vars);
    if (text && m) emit(s, { type: 'say', text, staffId: m.id, ...(m.actorId ? { actorId: m.actorId } : {}), ...(inc.buildingId ? { buildingId: inc.buildingId } : {}) });
  }

  if (outcome.job) {
    const role = outcome.job.role;
    const seat = seatOf(s);            // (jobs.ts scales the cost by the worker's temperament when the work starts)
    const spec: JobSpec = {
      kind: 'incident', role, buildingId: inc.buildingId ?? seat?.id ?? null, unit: inc.unit, tenantId: inc.tenantId,
      applicantId: inc.applicantId, incidentId: inc.id, outcomeId: outcome.id, workDays: Math.max(0.05, outcome.job.days),
      cost: Math.max(0, Math.round(outcome.job.cost)), priority: def.urgency >= 3 ? 4 : 3, byRuler: by === 'ruler',
    };
    const job = enqueueJob(s, spec);
    inc.state = 'in_progress';
    inc.jobId = job.id;
    return { ok: true, id: inc.id };
  }
  finish(s, inc, def, outcome, null);
  return { ok: true, id: inc.id };
}

/** Choose an outcome. Starts its job if it has one (effects land when the job is done), else applies effects now. */
export function resolveIncident(s: GameState, incidentId: Id, outcomeId: string, by: ResolvedBy): ActionResult {
  return resolveBy(s, incidentId, outcomeId, by);
}

function expire(s: GameState, inc: Incident, def: IncidentDef): void {
  inc.state = 'expired';
  applyEffects(s, def.onExpire ?? [], ctxOf(inc, def, null));
  notePets(s, inc, def);
  seeOut(s, inc, def);
  settleVisual(s, inc, def, def.onExpire ?? []);
  release(s, inc);
  const text = fillText(def.expireText ?? `Nobody ruled on the matter of ${def.title}. It has settled itself, as neglected things do.`, inc.vars);
  const kind = tone(def.onExpire ?? []);
  if (text) herald(s, kind === 'good' ? 'info' : kind, text, refsOf(s, inc));
  s.stats.incidentsIgnored++;
  emit(s, { type: 'incident_expired', incidentId: inc.id });
}

/** The thing this incident was about is gone (the building fell, the household left). It closes without ceremony. */
function lapse(s: GameState, inc: Incident, def: IncidentDef | undefined): void {
  inc.state = 'expired';
  if (def) settleVisual(s, inc, def, []);
  release(s, inc);
  emit(s, { type: 'incident_expired', incidentId: inc.id });
}

function orphaned(s: GameState, inc: Incident, def: IncidentDef): boolean {
  if (inc.buildingId) {
    const b = s.buildings[inc.buildingId];
    if (!b) return true;
    if (b.state === 'ruined' && def.target !== 'tenant') return true;
  }
  if (inc.applicantId) return !s.applicants[inc.applicantId];
  if (def.target === 'tenant') {
    const t = inc.tenantId ? s.tenants[inc.tenantId] : null;
    if (!t) return true;
    // a household that left after this began has taken the matter with it (unless leaving is the matter)
    if (t.status !== 'housed' && def.decision !== 'move_out_deposit' && (t.leftDay === null || t.leftDay > inc.startedDay)) return true;
  }
  if (def.target === 'vacant' && inc.buildingId && inc.unit !== null) {
    if (s.buildings[inc.buildingId]?.units[inc.unit]?.tenantId) return true;
  }
  return false;
}

/** The work was called off before it was done: the matter is the ruler's again. */
function reopen(s: GameState, inc: Incident, def: IncidentDef): void {
  const by = inc.resolvedBy;
  const outcome = def.outcomes.find(o => o.id === inc.outcomeId);
  const role = outcome?.job?.role;
  if (by !== 'ruler' && isStaffRole(role)) countermand(s, role);
  else if (isStaffRole(by)) countermand(s, by);
  inc.state = 'open'; inc.jobId = null; inc.outcomeId = null; inc.resolvedBy = null; inc.reported = false;
  inc.vars._ruler = 1;             // delegates leave it alone from here on
  if (inc.expiresDay !== null) inc.expiresDay = Math.max(inc.expiresDay, s.day + TUNE.reopenDays);
  emit(s, { type: 'incident', incidentId: inc.id });
  summon(s, inc, def);
}

// ───────────── the scheduler ─────────────

type Pending = GameState['pending'][number];

function liveSets(s: GameState): { busyB: Set<Id>; busyT: Set<Id> } {
  const busyB = new Set<Id>(), busyT = new Set<Id>();
  for (const i of Object.values(s.incidents)) {
    if (i.state !== 'open' && i.state !== 'in_progress') continue;
    if (i.buildingId) busyB.add(i.buildingId);
    if (i.tenantId) busyT.add(i.tenantId);
  }
  return { busyB, busyT };
}

/** Draw one random incident. `audienceOnly` is the scripted first audience. Returns false if nothing could be drawn. */
function drawRandom(s: GameState, audienceOnly: boolean): boolean {
  const open = openIncidents(s).length;
  const cap = openCap(s);
  if (open > cap) return false;
  const onlyUrgent = open >= cap;       // full: only the urgent may squeeze in, and only one
  const full = courtFull(s);
  if (audienceOnly && (full || onlyUrgent)) return false;
  const { busyB, busyT } = liveSets(s);
  const cands: { def: IncidentDef; targets: IncidentTarget[] }[] = [];
  for (const def of INCIDENTS) {
    if (def.system || !(def.weight > 0)) continue;
    if (audienceOnly && !def.audience) continue;
    if (def.audience && full) continue;
    if (onlyUrgent && def.urgency < 3) continue;
    if (!rankFits(s, def) || !seasonFits(s, def) || !offCooldown(s, def)) continue;
    const targets = targetsFor(s, def, busyB, busyT);
    if (targets.length) cands.push({ def, targets });
  }
  if (!cands.length) return false;
  // lean the draw toward about one audience in four, whatever the mix of what is written
  let wa = 0, wp = 0;
  for (const c of cands) { if (c.def.audience) wa += c.def.weight; else wp += c.def.weight; }
  const share = TUNE.audienceShare;
  const k = wa > 0 && wp > 0 ? clamp((share * wp) / ((1 - share) * wa), 0.35, 1.8) : 1;
  const c = weighted(s, cands, x => x.def.weight * (x.def.audience ? k : 1));
  if (!c) return false;
  return !!spawn(s, c.def.id, pick(s, c.targets), undefined, { source: 'random' });
}

function planMonth(s: GameState, monthIndex: number): void {
  if (monthIndex < BAL.quietMonths) return;
  const r = BAL.incidentRate;
  const rate = clamp(r.base + r.perHousehold * householdCount(s), 0, r.max);
  const count = Math.floor(rate) + (chance(s, rate - Math.floor(rate)) ? 1 : 0);
  const start = monthIndex * DAYS_PER_MONTH;
  const until = start + DAYS_PER_MONTH - 0.5;
  const span = 26.5 / Math.max(1, count);
  for (let i = 0; i < count; i++) {
    s.pending.push({ defId: SLOT_RANDOM, day: start + 1.5 + span * (i + rand(s)), buildingId: null, tenantId: null, vars: { _until: until } });
  }
}

function firstLeak(s: GameState): void {
  const occupied = Object.values(s.buildings).filter(b => b.state === 'ready' && b.units.some(u => u.tenantId) && BUILDINGS[b.type].category === 'housing');
  const b = occupied.find(x => x.type === 'hovel') ?? occupied[0];
  if (!b || incidentsAt(s, b.id).length) return;
  if (!(INCIDENT_BY_ID['sys_repair_leak'] && spawn(s, 'sys_repair_leak', { buildingId: b.id }))) spawnDecision(s, 'repair', { buildingId: b.id });
}

function firstApplicant(s: GameState): void {
  const waiting = new Set(Object.values(s.applicants).map(a => a.buildingId + ':' + a.unit));
  const open = vacancies(s).filter(v => v.building.units[v.unit]!.listed && !v.building.squatters && !waiting.has(v.building.id + ':' + v.unit));
  const v = open.find(x => x.building.type === 'hovel') ?? open[0];
  if (v) spawnApplicant(s, v.building.id, v.unit);
}

function strip(vars: Record<string, string | number>): Record<string, string | number> | undefined {
  const out: Record<string, string | number> = {};
  let n = 0;
  for (const k of Object.keys(vars)) if (!k.startsWith('_')) { out[k] = vars[k]!; n++; }
  return n ? out : undefined;
}

function again(s: GameState, p: Pending, days: number): void {
  s.pending.push({ ...p, day: s.day + days, vars: { ...p.vars, _tries: Number(p.vars._tries ?? 0) + 1 } });
}

/** A follow-up scheduled by a `spawn` effect has come due. */
function chained(s: GameState, p: Pending): void {
  const def = INCIDENT_BY_ID[p.defId];
  if (!def) return;
  const tries = Number(p.vars._tries ?? 0);
  const open = openIncidents(s).length;
  const tooMany = !def.system && open >= openCap(s) + (def.urgency >= 3 ? 1 : 0);   // the pipeline's own follow-ups never queue
  const noRoom = def.audience && !!def.petitioner && def.petitioner !== 'staff' && courtFull(s);
  if ((tooMany || noRoom) && tries < TUNE.chainRetries) { again(s, p, TUNE.retryDays); return; }
  if (tooMany) return;                 // it has waited long enough; the moment has passed
  const target: IncidentTarget = {};
  if (def.target !== 'realm') {
    if (p.tenantId && s.tenants[p.tenantId] && def.target !== 'vacant') target.tenantId = p.tenantId;
    if (p.buildingId && s.buildings[p.buildingId]) target.buildingId = p.buildingId;
    // The follow-up belongs to the household it was promised to. If they have left since, a matter about them went with
    // them (the sheep are no longer this parish's griffin's doing), and a matter about the roof is about whoever is under
    // it now. A household already gone when it was promised (a quarrel over the deposit) is still the right one.
    const kept = target.tenantId ? s.tenants[target.tenantId]! : null;
    if (kept && kept.status !== 'housed' && kept.leftDay !== null && typeof p.vars._at === 'number' && kept.leftDay > p.vars._at + 1e-6) {
      if (def.target === 'tenant') return;
      delete target.tenantId;
    } else if (kept && def.target === 'building' && target.buildingId && kept.status === 'housed' && kept.buildingId !== target.buildingId) delete target.tenantId;
    if (def.target === 'vacant') {
      const b = target.buildingId ? s.buildings[target.buildingId] : null;
      const unit = b ? b.units.findIndex(u => !u.tenantId) : -1;
      if (!b || unit < 0) return;
      target.unit = unit;
    }
  }
  spawn(s, def.id, target, strip(p.vars), { source: 'chain' });
}

function runPending(s: GameState, p: Pending): void {
  switch (p.defId) {
    case SLOT_RANDOM:
      if (!drawRandom(s, false)) {
        const next = s.day + TUNE.retryDays;
        if (next <= Number(p.vars._until ?? 0)) s.pending.push({ ...p, day: next });
      }
      return;
    case SLOT_LEAK: firstLeak(s); return;
    case SLOT_APPLICANT: firstApplicant(s); return;
    case SLOT_AUDIENCE:
      if (!drawRandom(s, true) && s.day + 3 <= TUNE.firstAudienceUntil) s.pending.push({ ...p, day: s.day + 3 });
      return;
    case SLOT_GONE: {
      const a = p.buildingId ? s.actors[p.buildingId] : null;
      if (a && a.kind === 'petitioner' && !Object.values(s.incidents).some(i => i.state === 'open' && i.actorId === a.id)) removeActor(s, a.id);
      return;
    }
    default:
      if (!p.defId.startsWith('*')) chained(s, p);
  }
}

function duePending(s: GameState): void {
  let due: Pending[] | null = null;
  for (const p of s.pending) if (p.day <= s.day) (due ??= []).push(p);
  if (!due) return;
  s.pending = s.pending.filter(p => p.day > s.day);
  due.sort((a, b) => a.day - b.day);
  for (const p of due) runPending(s, p);
}

// ───────────── weather ─────────────

function rollWeather(s: GameState, day: number): void {
  const turned = day % 90 === 0;                       // a new season came in overnight
  const rough = s.weather === 'storm' || s.weather === 'hail';
  if (!turned && !chance(s, rough ? TUNE.stormTurn : TUNE.weatherTurn)) return;
  const table = WEATHER[seasonOf(day)];
  const next = weighted(s, table, e => (rough && e[0] === s.weather ? 0 : e[1]));
  if (!next || next[0] === s.weather) return;
  s.weather = next[0];
  emit(s, { type: 'weather', kind: s.weather });
}

// ───────────── housekeeping ─────────────

function sweepVisuals(s: GameState): void {
  for (const b of Object.values(s.buildings)) {
    if (!b.visuals.length) continue;
    for (const v of b.visuals.slice()) {
      const pet = PET_VISUAL[v]; const sq = SQUATTER_VISUAL[v];
      if (!pet && !sq) continue;
      if (pet && tenantsOf(s, b.id).some(t => t.pets.includes(pet))) continue;
      if (sq && b.squatters?.kind === sq) continue;
      if (incidentsAt(s, b.id).some(i => INCIDENT_BY_ID[i.defId]?.visual === v)) continue;
      removeVisual(s, b.id, v);
    }
  }
}

function prune(s: GameState): void {
  for (const k of Object.keys(s.incidentLog)) {
    if (k.startsWith('~pet.') && !s.tenants[k.slice(5, k.indexOf('.', 5))]) delete s.incidentLog[k];   // the household is gone, and its animals with it
  }
  const closed = Object.values(s.incidents).filter(i => i.state === 'resolved' || i.state === 'expired');
  if (closed.length <= TUNE.keepClosed) return;
  closed.sort((a, b) => a.startedDay - b.startedDay);
  for (const i of closed.slice(0, closed.length - TUNE.keepClosed)) delete s.incidents[i.id];
}

// ───────────── the module ─────────────

export const incidentsModule: SimModule = {
  name: 'incidents',

  init(s) {
    s.weather = 'clear';
    s.pending.push(
      { defId: SLOT_LEAK, day: TUNE.firstLeakDay, buildingId: null, tenantId: null, vars: {} },
      { defId: SLOT_APPLICANT, day: TUNE.firstApplicantDay, buildingId: null, tenantId: null, vars: {} },
      { defId: SLOT_AUDIENCE, day: TUNE.firstAudienceDay + rand(s) * 3, buildingId: null, tenantId: null, vars: {} },
    );
  },

  step(s) {
    if (s.pending.length) duePending(s);
    for (const inc of Object.values(s.incidents)) {
      if (inc.state !== 'open' || inc.expiresDay === null || s.day < inc.expiresDay) continue;
      const def = INCIDENT_BY_ID[inc.defId];
      if (def) expire(s, inc, def); else lapse(s, inc, undefined);
    }
    tidyCourt(s);
  },

  onDay(s, day) {
    rollWeather(s, day);
    for (const inc of Object.values(s.incidents)) {
      if (inc.state !== 'open' && inc.state !== 'in_progress') continue;
      const def = INCIDENT_BY_ID[inc.defId];
      if (!def) { lapse(s, inc, undefined); continue; }
      if (inc.state === 'in_progress') {
        const job = inc.jobId ? s.jobs[inc.jobId] : null;
        const outcome = def.outcomes.find(o => o.id === inc.outcomeId);
        if (job && job.state === 'done' && outcome) finish(s, inc, def, outcome, job);       // the bell was missed; ring it now
        else if (!job || job.state === 'cancelled' || !outcome) { if (orphaned(s, inc, def)) lapse(s, inc, def); else reopen(s, inc, def); }
        continue;
      }
      if (orphaned(s, inc, def)) { lapse(s, inc, def); continue; }
      if (inc.actorId && !s.actors[inc.actorId]) inc.actorId = null;
      if (def.audience && !inc.actorId) summon(s, inc, def);
      else if (def.audience && def.petitioner === 'staff') attend(s, inc);
    }
    sweepVisuals(s);
    prune(s);
  },

  onMonth(s, monthIndex) {
    planMonth(s, monthIndex);
  },

  onJobDone(s, job) {
    if (job.kind !== 'incident' || !job.incidentId) return;
    const inc = s.incidents[job.incidentId];
    if (!inc || inc.state !== 'in_progress') return;
    if (inc.jobId && inc.jobId !== job.id) return;
    const def = INCIDENT_BY_ID[inc.defId];
    const outcome = def?.outcomes.find(o => o.id === (job.outcomeId ?? inc.outcomeId));
    if (!def || !outcome) { lapse(s, inc, def); return; }
    finish(s, inc, def, outcome, job);
  },

  handlers: {
    resolve_incident(s, a) {
      return resolveBy(s, a.incidentId, a.outcomeId, 'ruler');
    },
    dismiss_incident(s, a) {
      const inc = s.incidents[a.incidentId];
      const def = inc ? INCIDENT_BY_ID[inc.defId] : undefined;
      if (!inc || !def) return refuse('not_found', 'That matter is not before the court.');
      if (inc.state === 'in_progress') return refuse('busy', 'Someone is already seeing to it. Call them off first.');
      if (inc.state !== 'open') return refuse('invalid', 'That matter is closed, and the ink is dry.');
      expire(s, inc, def);
      return { ok: true, id: inc.id };
    },
  },
};
