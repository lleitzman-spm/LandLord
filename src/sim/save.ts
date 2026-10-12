/**
 * OWNER: sim-crown agent.
 * Saving and loading a reign.
 *
 * A save is the GameState as one JSON object with `version` on it, minus the
 * transient `_events`. Both directions go through the same cleaner, which walks
 * a description of GameState (below, checked by the compiler against types.ts):
 *
 *  - a missing or mistyped field gets its new-game default,
 *  - a field the description does not know is dropped (the one exception: an
 *    entity's `aux`, see below),
 *  - keys come out in one fixed order.
 *
 * So loading is tolerant of older and damaged saves, and the round trip is exact:
 * serialize(deserialize(serialize(s))) === serialize(s).
 *
 * A save from a NEWER version is refused with a plain message. When SAVE_VERSION
 * rises, add a step to MIGRATIONS that reshapes the raw object from the previous
 * version; steps run in order before the cleaner.
 */
import {
  SAVE_VERSION, RANK_ORDER, STAFF_ROLES, DECISION_OPTIONS,
  type GameState, type Tile, type Parcel, type MapState, type Unit, type Building, type MemoryEntry, type Lease,
  type Tenant, type Applicant, type StaffMember, type Candidate, type Actor, type Job, type Incident, type Condition,
  type StandingOrder, type Policies, type Oath, type MonthBook, type Txn, type Ledger, type GoalProgress,
  type CharterProgress, type RivalState, type Herald, type Stats, type Loan, type EndState,
  type Terrain, type BuildingState, type LateStage, type TenantStatus, type ActorKind, type ActorState, type JobKind,
  type JobRole, type JobState, type DecisionType, type DecisionOption, type IncidentState, type ResolvedBy,
  type CondField, type CondOp, type OathKind, type OathState, type IncomeCat, type ExpenseCat, type HeraldKind,
  type WeatherKind, type Mode, type Speed, type RankId, type StaffRole,
} from './types';
import {
  BUILDING_TYPES, SPECIES, TRADES, TRAITS, TENANT_TAGS, TEMPERAMENTS, PET_KINDS, SQUATTER_KINDS, VISUALS,
} from '../data/ids';

// ───────────────────────────── cleaners ─────────────────────────────

/** Turns anything into a clean, JSON-safe value of type T (falling back to a default). */
type Clean<T> = (v: unknown) => T;
type Scalar = string | number | boolean;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const num = (d = 0): Clean<number> => v => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const str = (d = ''): Clean<string> => v => (typeof v === 'string' ? v : d);
const bool = (d = false): Clean<boolean> => v => (typeof v === 'boolean' ? v : d);
const oneOf = <T extends Scalar>(values: readonly T[], d: T): Clean<T> =>
  v => ((values as readonly unknown[]).includes(v) ? (v as T) : d);
const nullable = <T>(c: Clean<T>): Clean<T | null> => v => (v === null || v === undefined ? null : c(v));
/** an optional id-like string: kept only when it is one */
const maybeStr: Clean<string | null> = v => (typeof v === 'string' ? v : null);
const maybeNum: Clean<number | null> = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** array of objects: entries that are not objects are dropped */
const objects = <T>(c: Clean<T>): Clean<T[]> => v => (Array.isArray(v) ? v.filter(isObj).map(c) : []);
/** array drawn from a fixed id list: unknown ids are dropped */
const idsFrom = <T extends string>(values: readonly T[]): Clean<T[]> =>
  v => (Array.isArray(v) ? v.filter((x): x is T => (values as readonly unknown[]).includes(x)) : []);
/** [x, y] waypoints */
const points: Clean<[number, number][]> = v => {
  const out: [number, number][] = [];
  if (Array.isArray(v)) {
    for (const p of v) {
      if (Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number' && Number.isFinite(p[0]) && Number.isFinite(p[1])) out.push([p[0], p[1]]);
    }
  }
  return out;
};
/** Record<string, scalar>: entries of any other type are dropped */
const scalars = <T extends Scalar>(allow: readonly ('string' | 'number' | 'boolean')[]): Clean<Record<string, T>> => v => {
  const out: Record<string, T> = {};
  if (!isObj(v)) return out;
  for (const k of Object.keys(v)) {
    const x = v[k];
    const t = typeof x;
    if ((t === 'string' || t === 'boolean' || (t === 'number' && Number.isFinite(x))) && (allow as readonly string[]).includes(t)) out[k] = x as T;
  }
  return out;
};
/** Any JSON-safe value, deep: non-finite numbers become 0; functions, undefined and symbols are left out. */
function jsonSafe(v: unknown, depth = 0): unknown {
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (depth > 8) return null;
  if (Array.isArray(v)) return v.map(x => { const c = jsonSafe(x, depth + 1); return c === undefined ? null : c; });
  if (isObj(v)) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v)) { const c = jsonSafe(v[k], depth + 1); if (c !== undefined) out[k] = c; }
    return out;
  }
  return undefined;
}
/**
 * The one field an entity may carry beyond its interface: `aux`, a sim module's
 * private bookkeeping for that entity (tenants.ts keeps a household's rent
 * clock there). It is saved as it stands so a loaded reign carries on exactly.
 */
const AUX = 'aux';
/** Record<id, entity>: entries that are not objects are dropped; each entity's `id` is its key */
const entities = <T extends { id: string }>(c: Clean<T>): Clean<Record<string, T>> => v => {
  const out: Record<string, T> = {};
  if (!isObj(v)) return out;
  for (const k of Object.keys(v)) {
    const x = v[k];
    if (!isObj(x)) continue;
    const e = c(x);
    e.id = k;
    if (isObj(x[AUX])) (e as Record<string, unknown>)[AUX] = jsonSafe(x[AUX]);
    out[k] = e;
  }
  return out;
};

type Fields<T> = { [K in keyof T]-?: Clean<Exclude<T[K], undefined>> };
/**
 * An object with exactly these fields, in this order. The mapped type makes the
 * compiler insist the list matches the interface in types.ts: add a field there
 * and this file stops compiling until it is described here. Fields named in
 * `optional` are left out when absent.
 */
const shape = <T>(fields: Fields<T>, optional: readonly (keyof T)[] = []): Clean<T> => {
  const keys = Object.keys(fields) as (keyof T & string)[];
  return v => {
    const src: Record<string, unknown> = isObj(v) ? v : {};
    const out = {} as Record<string, unknown>;
    for (const k of keys) {
      const raw = src[k];
      if ((raw === undefined || raw === null) && optional.includes(k)) continue;
      out[k] = (fields[k] as Clean<unknown>)(raw);
    }
    return out as T;
  };
};

// ───────────────────────────── vocabularies ─────────────────────────────
// Written as Record<Union, 1> so the compiler checks each list is complete.

const keys = <K extends string>(o: Record<K, 1>): K[] => Object.keys(o) as K[];

const TERRAINS = keys<Terrain>({ grass: 1, forest: 1, rock: 1, water: 1, road: 1, bridge: 1, field: 1 });
const BUILDING_STATES = keys<BuildingState>({ building: 1, ready: 1, ruined: 1 });
const LATE_STAGES = keys<LateStage>({ none: 1, grace: 1, late: 1, plan: 1, noticed: 1, court: 1, writ: 1 });
const TENANT_STATUSES = keys<TenantStatus>({ housed: 1, left: 1, evicted: 1 });
const ACTOR_KINDS = keys<ActorKind>({ ruler: 1, staff: 1, applicant: 1, petitioner: 1, visitor: 1 });
const ACTOR_STATES = keys<ActorState>({ idle: 1, walking: 1, working: 1, waiting: 1 });
const JOB_KINDS = keys<JobKind>({
  build: 1, repair: 1, renovate: 1, demolish: 1, clear_land: 1, collect: 1, show: 1, screen: 1, serve_notice: 1,
  evict: 1, inspect: 1, incident: 1, visit: 1,
});
const JOB_ROLES = keys<JobRole>({ mason: 1, bailiff: 1, crier: 1, steward: 1, ruler: 1, any: 1 });
const JOB_STATES = keys<JobState>({ queued: 1, traveling: 1, working: 1, done: 1, cancelled: 1 });
const DECISION_TYPES = Object.keys(DECISION_OPTIONS) as DecisionType[];
const DECISION_OPTS = keys<DecisionOption>({
  wait: 1, late_fee: 1, payment_plan: 1, forgive: 1, notice: 1, cash_for_keys: 1, evict: 1, mercy: 1, fix: 1, patch: 1,
  defer: 1, bill_tenant: 1, accept: 1, reject: 1, screen: 1, counter: 1, return_all: 1, fair: 1, keep_all: 1, oust: 1,
  bribe: 1, lease: 1, ignore: 1, allow: 1, pet_rent: 1, ban: 1, hold: 1, raise: 1, lower: 1,
});
const INCIDENT_STATES = keys<IncidentState>({ open: 1, in_progress: 1, resolved: 1, expired: 1 });
const RESOLVERS = keys<ResolvedBy>({ ruler: 1, order: 1, mason: 1, bailiff: 1, crier: 1, steward: 1 });
const COND_FIELDS = keys<CondField>({
  season: 1, month: 1, gold: 1, renown: 1, cost: 1, 'tenant.species': 1, 'tenant.trade': 1, 'tenant.tags': 1,
  'tenant.traits': 1, 'tenant.monthsHoused': 1, 'tenant.daysLate': 1, 'tenant.arrears': 1, 'tenant.happiness': 1,
  'tenant.household': 1, 'tenant.hasPets': 1, 'tenant.name': 1, 'building.type': 1, 'building.condition': 1,
  'building.id': 1, 'building.rent': 1,
});
const COND_OPS = keys<CondOp>({ '==': 1, '!=': 1, '<': 1, '<=': 1, '>': 1, '>=': 1, includes: 1, excludes: 1 });
const OATH_KINDS = keys<OathKind>({ repair: 1, no_rent_raise: 1, no_evict: 1, build: 1, pay: 1, rent_cap: 1, word: 1 });
const OATH_STATES = keys<OathState>({ open: 1, kept: 1, broken: 1, released: 1 });
const HERALD_KINDS = keys<HeraldKind>({ info: 1, good: 1, bad: 1, urgent: 1, crown: 1, staff: 1, rival: 1, oath: 1 });
const WEATHERS = keys<WeatherKind>({ clear: 1, rain: 1, storm: 1, snow: 1, heat: 1, fog: 1, hail: 1 });
const MODES = keys<Mode>({ peace: 1, iron: 1 });
const END_REASONS = keys<EndState['reason']>({ bankrupt: 1, charter_revoked: 1, abdicated: 1 });
const RIVAL_TEMPERS = keys<RivalState['temperament']>({ grasping: 1, charming: 1, ruthless: 1 });
const INCOME_CATS = keys<IncomeCat>({ rent: 1, fees: 1, deposits_kept: 1, windfall: 1, loan: 1 });
const EXPENSE_CATS = keys<ExpenseCat>({
  construction: 1, repairs: 1, wages: 1, upkeep: 1, tribute: 1, interest: 1, deposits_returned: 1, bribes: 1, gifts: 1,
  court: 1, land: 1, loan_repaid: 1, other: 1,
});
const SPEEDS: readonly Speed[] = [0, 0.1, 1, 2, 4];
const ROLES: readonly StaffRole[] = STAFF_ROLES;
const RANKS: readonly RankId[] = RANK_ORDER;

const rank = oneOf<RankId>(RANKS, 'reeve');
const role = oneOf<StaffRole>(ROLES, 'mason');
const species = oneOf(SPECIES, 'human');
const temperament = oneOf(TEMPERAMENTS, 'steady');
const valence = oneOf<-2 | -1 | 1 | 2>([-2, -1, 1, 2], 1);
const vars = scalars<string | number>(['string', 'number']);
const flags = scalars<Scalar>(['string', 'number', 'boolean']);

// ───────────────────────────── the shape of a reign ─────────────────────────────

const tile = shape<Tile>({ t: oneOf<Terrain>(TERRAINS, 'grass'), b: maybeStr, wear: num(), v: num() });
const parcel = shape<Parcel>({ id: num(), x: num(), y: num(), owned: bool(), price: num(), minRank: rank, name: str() });
const mapState = shape<MapState>({ w: num(), h: num(), tiles: objects(tile), parcels: objects(parcel) });

const unit = shape<Unit>({ tenantId: maybeStr, vacantSince: maybeNum, listed: bool(), purse: num(), purseDay: num() });
const building = shape<Building>({
  id: str(), type: oneOf(BUILDING_TYPES, 'hovel'), x: num(), y: num(), w: num(1), h: num(1),
  rot: oneOf<0 | 1 | 2 | 3>([0, 1, 2, 3], 0), variant: num(), name: str(), level: num(1),
  state: oneOf<BuildingState>(BUILDING_STATES, 'ready'), progress: num(1), condition: num(100), units: objects(unit),
  rent: num(), builtDay: num(), visuals: idsFrom(VISUALS),
  squatters: nullable(shape<NonNullable<Building['squatters']>>({ kind: oneOf(SQUATTER_KINDS, 'goblins'), sinceDay: num() })),
  flags,
});

const memory = shape<MemoryEntry>({ day: num(), text: str(), valence });
const lease = shape<Lease>({ rent: num(), startDay: num(), termMonths: num(12), deposit: num() });
const tenant = shape<Tenant>({
  id: str(), name: str(), first: str(), species, trade: oneOf(TRADES, 'laborer'), character: maybeStr, portraitSeed: num(),
  household: num(1), traits: idsFrom(TRAITS), revealed: idsFrom(TRAITS), tags: idsFrom(TENANT_TAGS), pets: idsFrom(PET_KINDS),
  income: num(), reliability: num(0.8), happiness: num(50), status: oneOf<TenantStatus>(TENANT_STATUSES, 'left'),
  buildingId: maybeStr, unit: num(), lease: nullable(lease), movedInDay: num(), arrears: num(), daysLate: num(),
  lateStage: oneOf<LateStage>(LATE_STAGES, 'none'),
  plan: nullable(shape<NonNullable<Tenant['plan']>>({ left: num(), each: num() })),
  courtDay: maybeNum, memory: objects(memory), wear: num(), leftDay: maybeNum,
});
const applicant = shape<Applicant>({
  id: str(),
  household: shape<Applicant['household']>({
    id: str(), name: str(), first: str(), species, trade: oneOf(TRADES, 'laborer'), character: maybeStr, portraitSeed: num(),
    household: num(1), traits: idsFrom(TRAITS), revealed: idsFrom(TRAITS), tags: idsFrom(TENANT_TAGS), pets: idsFrom(PET_KINDS),
    income: num(), reliability: num(0.8),
  }),
  buildingId: str(), unit: num(), arrivedDay: num(), leavesDay: num(), maxRent: num(), shown: bool(), screened: bool(),
  actorId: maybeStr,
});
const staffMember = shape<StaffMember>({
  id: str(), role, name: str(), first: str(), species, portraitSeed: num(), temperament, skill: num(1), wage: num(),
  loyalty: num(50), hiredDay: num(), actorId: maybeStr, authority: oneOf<0 | 1 | 2>([0, 1, 2], 0), jobsDone: num(),
});
const candidate = shape<Candidate>({
  id: str(), role, name: str(), first: str(), species, portraitSeed: num(), temperament, skill: num(1), wage: num(),
  temperamentKnown: bool(), pitch: str(),
});
const actor = shape<Actor>({
  id: str(), kind: oneOf<ActorKind>(ACTOR_KINDS, 'visitor'), refId: maybeStr, x: num(), y: num(), path: points,
  speed: num(6), state: oneOf<ActorState>(ACTOR_STATES, 'idle'), jobId: maybeStr, homeX: num(), homeY: num(), facing: num(),
});
const job = shape<Job>({
  id: str(), kind: oneOf<JobKind>(JOB_KINDS, 'visit'), role: oneOf<JobRole>(JOB_ROLES, 'any'),
  state: oneOf<JobState>(JOB_STATES, 'queued'), assignee: maybeStr, buildingId: maybeStr, unit: maybeNum, tenantId: maybeStr,
  applicantId: maybeStr, incidentId: maybeStr, outcomeId: maybeStr, x: num(), y: num(), workDays: num(1), progress: num(),
  cost: num(), priority: num(), createdDay: num(), byRuler: bool(),
});
const incident = shape<Incident>({
  id: str(), defId: str(), state: oneOf<IncidentState>(INCIDENT_STATES, 'open'), buildingId: maybeStr, unit: maybeNum,
  tenantId: maybeStr, applicantId: maybeStr, startedDay: num(), expiresDay: maybeNum, vars, outcomeId: maybeStr,
  resolvedBy: nullable(oneOf<ResolvedBy>(RESOLVERS, 'ruler')), jobId: maybeStr, actorId: maybeStr, reported: bool(),
});
const pending = shape<GameState['pending'][number]>({ defId: str(), day: num(), buildingId: maybeStr, tenantId: maybeStr, vars });

const condition = shape<Condition>({
  field: oneOf<CondField>(COND_FIELDS, 'season'), op: oneOf<CondOp>(COND_OPS, '=='),
  value: v => (typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) ? v : ''),
});
const order = shape<StandingOrder>({
  id: str(), to: oneOf<StaffRole | 'all'>([...ROLES, 'all'], 'all'), text: str(), gist: str(),
  decision: nullable(oneOf<DecisionType>(DECISION_TYPES, 'custom')), incidentDef: maybeStr, when: objects(condition),
  rule: oneOf<'choose' | 'never'>(['choose', 'never'], 'choose'), option: nullable(oneOf<DecisionOption>(DECISION_OPTS, 'wait')),
  outcomeId: maybeStr, createdDay: num(), uses: num(),
});
const policies = shape<Policies>({
  graceDays: num(3), lateFeePct: num(10), depositMonths: num(1), askPct: num(100), renewalCapPct: num(10),
  pets: oneOf<Policies['pets']>(['allow', 'pet_rent', 'ban'], 'pet_rent'),
  screening: oneOf<Policies['screening']>(['never', 'always'], 'never'),
});
const oath = shape<Oath>({
  id: str(), kind: oneOf<OathKind>(OATH_KINDS, 'word'), text: str(), toTenantId: maybeStr, toName: str(), buildingId: maybeStr,
  buildingType: nullable(oneOf(BUILDING_TYPES, 'hovel')), amount: maybeNum, madeDay: num(), dueDay: num(),
  state: oneOf<OathState>(OATH_STATES, 'open'), settledDay: maybeNum,
});

const money = <K extends string>(cats: readonly K[]): Clean<Record<K, number>> => v => {
  const src: Record<string, unknown> = isObj(v) ? v : {};
  const out = {} as Record<K, number>;
  for (const c of cats) out[c] = num()(src[c]);
  return out;
};
const monthBook = shape<MonthBook>({
  index: num(), income: money<IncomeCat>(INCOME_CATS), expense: money<ExpenseCat>(EXPENSE_CATS), closing: num(),
  rentDue: num(), rentCollected: num(),
});
const txn = shape<Txn>({
  day: num(), amount: num(), cat: oneOf<IncomeCat | ExpenseCat>([...INCOME_CATS, ...EXPENSE_CATS], 'other'), memo: str(),
  tenantId: str(), buildingId: str(),
}, ['tenantId', 'buildingId']);
const ledger = shape<Ledger>({ months: objects(monthBook), txns: objects(txn) });

const goal = shape<GoalProgress>({ id: str(), value: num(), target: num(), done: bool() });
const charter = shape<CharterProgress>({ goals: objects(goal), ready: bool(), sinceDay: num() });
const rival = shape<RivalState>({
  name: str(), seat: str(), renown: num(50), temperament: oneOf<RivalState['temperament']>(RIVAL_TEMPERS, 'grasping'),
  portraitSeed: num(), poached: num(), lastMoveDay: num(),
});
const heraldLine = shape<Herald>({
  id: str(), day: num(), kind: oneOf<HeraldKind>(HERALD_KINDS, 'info'), text: str(),
  buildingId: str(), tenantId: str(), incidentId: str(), staffId: str(),
}, ['buildingId', 'tenantId', 'incidentId', 'staffId']);
const stats = shape<Stats>({
  rentCollected: num(), evictions: num(), oathsKept: num(), oathsBroken: num(), incidentsResolved: num(),
  incidentsIgnored: num(), tenantsHoused: num(), wordsSpoken: num(), peakRentRoll: num(), daysInDebt: num(),
});
const loan = shape<Loan>({ principal: num(), ratePctMonth: num(), takenDay: num() });
const endState = shape<EndState>({ reason: oneOf<EndState['reason']>(END_REASONS, 'abdicated'), day: num(), epitaph: str() });

/** Everything that is saved: GameState without the transient event queue. */
type Saved = Omit<GameState, '_events'>;

const saved = shape<Saved>({
  version: num(SAVE_VERSION), seed: num(), rng: num(), mode: oneOf<Mode>(MODES, 'peace'), nextId: num(1),
  day: num(), speed: oneOf<Speed>(SPEEDS, 1), weather: oneOf<WeatherKind>(WEATHERS, 'clear'),
  realm: shape<GameState['realm']>({ name: str(), ruler: str('You'), rank, crest: num(), heirloom: maybeStr, reign: num(1) }),
  gold: num(), loans: objects(loan), renown: num(50), favor: num(50),
  map: mapState,
  buildings: entities(building), tenants: entities(tenant), applicants: entities(applicant), staff: entities(staffMember),
  candidates: objects(candidate), actors: entities(actor), jobs: entities(job), incidents: entities(incident),
  incidentLog: scalars<number>(['number']), pending: objects(pending),
  orders: objects(order), policies, oaths: objects(oath),
  ledger, charter, rival, heralds: objects(heraldLine), stats,
  flags, seen: scalars<boolean>(['boolean']), ended: nullable(endState),
});

// ───────────────────────────── migrations ─────────────────────────────

/** MIGRATIONS[n] reshapes a raw save of version n into version n + 1, in place. None are needed yet. */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => void> = {};

// ───────────────────────────── api ─────────────────────────────

/** The reign as a JSON string. Never includes `_events`. Does not touch `s`. */
export function serialize(s: GameState): string {
  const out = saved(s);
  out.version = SAVE_VERSION;
  return JSON.stringify(out);
}

/** Throws on unreadable input. Fills any missing fields with defaults; always returns _events: []. */
export function deserialize(json: string): GameState {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('This save cannot be read: it is not a LandLord save, or it has been damaged.');
  }
  if (!isObj(raw)) throw new Error('This save cannot be read: it is not a LandLord save, or it has been damaged.');
  const version = typeof raw.version === 'number' && Number.isFinite(raw.version) ? Math.floor(raw.version) : 0;
  if (version > SAVE_VERSION) {
    throw new Error(`This save was written by a newer LandLord (save version ${version}; this one reads up to version ${SAVE_VERSION}). Update the game to open it.`);
  }
  for (let v = version; v < SAVE_VERSION; v++) MIGRATIONS[v]?.(raw);
  const out = saved(raw);
  out.version = SAVE_VERSION;
  return { ...out, _events: [] };
}
