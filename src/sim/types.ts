/**
 * LandLord — canonical simulation types.
 *
 * THE CONTRACT. Every module (sim, render, ui, word, audio, bots) builds
 * against this file. GameState is plain JSON (no classes, Maps, Sets, Dates,
 * functions, undefined-in-arrays) so it can be saved, diffed and fed to bots.
 *
 * Conventions
 *  - Time unit is the DAY (float). 30 days per month, 12 months per year.
 *    At 1x speed one day lasts SECONDS_PER_DAY real seconds (one month = 90 s).
 *  - Map is MAP_W x MAP_H tiles. Tile (x, y): x grows east, y grows south
 *    (toward the default camera). Actor positions are floats in tile space;
 *    the centre of tile (3, 4) is (3.5, 4.5).
 *  - World space (three.js): wx = x - MAP_W / 2, wz = y - MAP_H / 2, y up.
 *  - `rot` turns a building k * 90deg clockwise seen from above. Its front
 *    (door) faces: 0 south (+y), 1 west (-x), 2 north (-y), 3 east (+x).
 *    Odd rotations swap the footprint's w and h.
 *  - Money is whole gold "crowns". Renown, favor, happiness, condition are 0..100.
 *  - Only the owning sim module mutates a field (see docs/ARCHITECTURE.md);
 *    everyone else calls the owner's functions or dispatches an Action.
 */

import type {
  BuildingType, Species, TradeId, TraitId, TenantTag, TemperamentId, VisualId,
  IconId, EmoteId, SfxId, PetKind, SquatterKind, NpcId,
} from '../data/ids';

export type Id = string;

// ───────────────────────────── constants ─────────────────────────────

export const MAP_W = 32;
export const MAP_H = 24;
export const PARCEL = 8;                 // parcels are 8x8 tiles → 4 x 3 = 12 parcels
export const DAYS_PER_MONTH = 30;
export const MONTHS_PER_YEAR = 12;
export const DAYS_PER_YEAR = 360;
export const SECONDS_PER_DAY = 3;        // real seconds per game day at 1x
export const SAVE_VERSION = 1;

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Mode = 'peace' | 'iron';     // Steward's Peace (forgiving) | Iron Crown (permadeath)
export type RankId = 'reeve' | 'knight' | 'baron' | 'duke' | 'king';
export const RANK_ORDER: RankId[] = ['reeve', 'knight', 'baron', 'duke', 'king'];
export type StaffRole = 'mason' | 'bailiff' | 'crier' | 'steward';
export const STAFF_ROLES: StaffRole[] = ['mason', 'bailiff', 'crier', 'steward'];
/** 0 paused, 0.1 "crawl" (while the ruler is speaking), then 1x / 2x / 4x. */
export type Speed = 0 | 0.1 | 1 | 2 | 4;

export type BuildingCategory = 'housing' | 'commercial' | 'amenity' | 'staff' | 'seat';

// ───────────────────────────── map ─────────────────────────────

export type Terrain = 'grass' | 'forest' | 'rock' | 'water' | 'road' | 'bridge' | 'field';

export interface Tile {
  t: Terrain;
  /** building id occupying this tile, or null */
  b: Id | null;
  /** 0..1 footfall wear — cosmetic desire paths; sim increments as actors walk */
  wear: number;
  /** small cosmetic variant seed 0..255 (tree shape, rock shape) */
  v: number;
}

export interface Parcel {
  id: number;            // 0..11, index = py * 4 + px
  x: number; y: number;  // top-left tile
  owned: boolean;
  price: number;
  minRank: RankId;
  name: string;          // "Mudlark Bottom", "The Gallows Acre"
}

export interface MapState {
  w: number; h: number;
  tiles: Tile[];         // row-major, index = y * w + x
  parcels: Parcel[];
}

// ───────────────────────────── buildings ─────────────────────────────

export interface Unit {
  tenantId: Id | null;
  /** day the unit became vacant (null while occupied) */
  vacantSince: number | null;
  /** advertised to applicants */
  listed: boolean;
  /** uncollected rent sitting in a purse at the door (0 = none) */
  purse: number;
  /** day the purse appeared */
  purseDay: number;
}

export type BuildingState = 'building' | 'ready' | 'ruined';

export interface Building {
  id: Id;
  type: BuildingType;
  x: number; y: number;          // top-left tile of the rotated footprint
  w: number; h: number;          // rotated footprint
  rot: 0 | 1 | 2 | 3;
  variant: number;               // cosmetic variant seed
  name: string;                  // "Mudlark Cottage"
  level: number;                 // 1.. (seat: 1 hut, 2 manor, 3 keep)
  state: BuildingState;
  /** construction progress 0..1 while state === 'building' */
  progress: number;
  condition: number;             // 0..100
  units: Unit[];                 // empty for amenities
  /** asking rent per unit per month (new leases sign at this) */
  rent: number;
  builtDay: number;
  /** active incident visuals (griffin on roof, purple paint...) */
  visuals: VisualId[];
  squatters: { kind: SquatterKind; sinceDay: number } | null;
  flags: Record<string, number | string | boolean>;
}

// ───────────────────────────── people ─────────────────────────────

export interface MemoryEntry {
  day: number;
  text: string;                  // "You waived the winter rent when the roof fell in."
  valence: -2 | -1 | 1 | 2;
}

export type LateStage = 'none' | 'grace' | 'late' | 'plan' | 'noticed' | 'court' | 'writ';
export type TenantStatus = 'housed' | 'left' | 'evicted';
export type MoveOutReason = 'lease_end' | 'unhappy' | 'rent_too_high' | 'evicted' | 'poached' | 'cash_for_keys' | 'event' | 'ruin';

export interface Lease {
  rent: number;                  // per month
  startDay: number;
  termMonths: number;
  deposit: number;               // held by the ruler
}

/** A household. One head of household speaks for it. */
export interface Tenant {
  id: Id;
  name: string;                  // head of household, e.g. "Old Marta Thistlewick"
  first: string;                 // "Marta"
  species: Species;
  trade: TradeId;
  /** id of a named character in data/characters, if this is one */
  character: string | null;
  portraitSeed: number;
  household: number;             // heads under the roof, 1..7
  traits: TraitId[];             // all traits, including hidden ones
  revealed: TraitId[];           // traits the ruler has discovered
  tags: TenantTag[];
  pets: PetKind[];
  income: number;                // crowns per month
  reliability: number;           // 0..1 base chance of paying on time
  happiness: number;             // 0..100
  status: TenantStatus;
  buildingId: Id | null;
  unit: number;
  lease: Lease | null;
  movedInDay: number;
  arrears: number;               // unpaid rent + fees
  daysLate: number;
  lateStage: LateStage;
  /** payment plan: remaining instalments and amount each */
  plan: { left: number; each: number } | null;
  /** court clock: day the Reeve's court will rule */
  courtDay: number | null;
  memory: MemoryEntry[];         // newest last, capped
  /** damage they will leave behind at move-out, 0..100 condition points */
  wear: number;
  leftDay: number | null;
}

/** A prospective household looking at a vacancy. */
export interface Applicant {
  id: Id;
  household: Omit<Tenant, 'status' | 'buildingId' | 'unit' | 'lease' | 'movedInDay' | 'arrears' | 'daysLate' | 'lateStage' | 'plan' | 'courtDay' | 'memory' | 'wear' | 'leftDay' | 'happiness'>;
  buildingId: Id;
  unit: number;
  arrivedDay: number;
  leavesDay: number;             // gives up waiting on this day
  maxRent: number;               // will not sign above this
  shown: boolean;                // someone has shown them the place
  screened: boolean;             // references checked → hidden traits revealed
  actorId: Id | null;
}

export interface StaffMember {
  id: Id;
  role: StaffRole;
  name: string;
  first: string;
  species: Species;
  portraitSeed: number;
  temperament: TemperamentId;
  skill: number;                 // 1..5
  wage: number;                  // per month
  loyalty: number;               // 0..100
  hiredDay: number;
  actorId: Id | null;
  /** 0: routine only · 1: may rule on dilemmas in their domain · 2: full judgment */
  authority: 0 | 1 | 2;
  jobsDone: number;
}

export interface Candidate {
  id: Id;
  role: StaffRole;
  name: string; first: string;
  species: Species;
  portraitSeed: number;
  temperament: TemperamentId;
  skill: number;
  wage: number;
  /** hidden until hired or interviewed */
  temperamentKnown: boolean;
  pitch: string;                 // one comic line of self-recommendation
}

// ───────────────────────────── actors & jobs ─────────────────────────────

export type ActorKind = 'ruler' | 'staff' | 'applicant' | 'petitioner' | 'visitor';
export type ActorState = 'idle' | 'walking' | 'working' | 'waiting';

/** A figure whose position matters to gameplay. Ambient townsfolk are render-side only. */
export interface Actor {
  id: Id;
  kind: ActorKind;
  /** staff id / applicant id / tenant id / npc id this actor embodies */
  refId: Id | null;
  x: number; y: number;          // float tile coords
  /** remaining waypoints (tile centres), next first */
  path: [number, number][];
  speed: number;                 // tiles per day
  state: ActorState;
  jobId: Id | null;
  /** where it idles */
  homeX: number; homeY: number;
  /** facing in radians, 0 = south (+y), for the renderer */
  facing: number;
}

export type JobKind =
  | 'build' | 'repair' | 'renovate' | 'demolish' | 'clear_land'
  | 'collect' | 'show' | 'screen' | 'serve_notice' | 'evict' | 'inspect'
  | 'incident' | 'visit';
export type JobRole = StaffRole | 'ruler' | 'any';
export type JobState = 'queued' | 'traveling' | 'working' | 'done' | 'cancelled';

export interface Job {
  id: Id;
  kind: JobKind;
  role: JobRole;                 // who may take it ('any' = whoever is free, ruler included)
  state: JobState;
  assignee: Id | null;           // actor id
  buildingId: Id | null;
  unit: number | null;
  tenantId: Id | null;
  applicantId: Id | null;
  incidentId: Id | null;
  outcomeId: string | null;      // for incident jobs
  x: number; y: number;          // where the work happens (tile centre)
  workDays: number;              // labour needed once there
  progress: number;              // 0..1
  cost: number;                  // crowns, charged when work starts
  priority: number;              // higher first
  createdDay: number;
  /** the ruler explicitly asked for this (never auto-cancel) */
  byRuler: boolean;
}

// ───────────────────────────── decisions, incidents ─────────────────────────────

/**
 * Every dilemma in the game is an Incident with outcomes. System decisions
 * (late rent, applicants, deposits...) use these types so that standing
 * orders and staff temperaments can pick an option across all variants.
 */
export type DecisionType =
  | 'custom'
  | 'late_rent'          // options: wait | late_fee | payment_plan | forgive | notice | cash_for_keys
  | 'eviction_ready'     // options: evict | cash_for_keys | mercy
  | 'repair'             // options: fix | patch | defer | bill_tenant
  | 'applicant'          // options: accept | reject | screen | counter
  | 'move_out_deposit'   // options: return_all | fair | keep_all
  | 'squatters'          // options: oust | bribe | lease | ignore
  | 'pet'                // options: allow | pet_rent | ban
  | 'rent_renewal';      // options: hold | raise | lower

export type DecisionOption =
  | 'wait' | 'late_fee' | 'payment_plan' | 'forgive' | 'notice' | 'cash_for_keys'
  | 'evict' | 'mercy'
  | 'fix' | 'patch' | 'defer' | 'bill_tenant'
  | 'accept' | 'reject' | 'screen' | 'counter'
  | 'return_all' | 'fair' | 'keep_all'
  | 'oust' | 'bribe' | 'lease' | 'ignore'
  | 'allow' | 'pet_rent' | 'ban'
  | 'hold' | 'raise' | 'lower';

export const DECISION_OPTIONS: Record<DecisionType, DecisionOption[]> = {
  custom: [],
  late_rent: ['wait', 'late_fee', 'payment_plan', 'forgive', 'notice', 'cash_for_keys'],
  eviction_ready: ['evict', 'cash_for_keys', 'mercy'],
  repair: ['fix', 'patch', 'defer', 'bill_tenant'],
  applicant: ['accept', 'reject', 'screen', 'counter'],
  move_out_deposit: ['return_all', 'fair', 'keep_all'],
  squatters: ['oust', 'bribe', 'lease', 'ignore'],
  pet: ['allow', 'pet_rent', 'ban'],
  rent_renewal: ['hold', 'raise', 'lower'],
};

export type IncidentState =
  | 'open'               // waiting for a ruling / dispatch
  | 'in_progress'        // an outcome was chosen and a job is carrying it out
  | 'resolved' | 'expired';

export type ResolvedBy = 'ruler' | 'order' | StaffRole;

export interface Incident {
  id: Id;
  defId: string;
  state: IncidentState;
  buildingId: Id | null;
  unit: number | null;
  tenantId: Id | null;
  applicantId: Id | null;
  startedDay: number;
  /** day onExpire fires; null = never */
  expiresDay: number | null;
  /** filled placeholders: tenant, building, amount, pet, ... */
  vars: Record<string, string | number>;
  outcomeId: string | null;
  resolvedBy: ResolvedBy | null;
  jobId: Id | null;
  /** petitioner actor walking to / waiting at the seat (audience incidents) */
  actorId: Id | null;
  /** set when staff handled it on their own judgment and should report */
  reported: boolean;
}

// ───────────────────────────── the ruler's word ─────────────────────────────

export type CondField =
  | 'season' | 'month' | 'gold' | 'renown' | 'cost'
  | 'tenant.species' | 'tenant.trade' | 'tenant.tags' | 'tenant.traits'   // traits = revealed only
  | 'tenant.monthsHoused' | 'tenant.daysLate' | 'tenant.arrears' | 'tenant.happiness'
  | 'tenant.household' | 'tenant.hasPets' | 'tenant.name'
  | 'building.type' | 'building.condition' | 'building.id' | 'building.rent';
export type CondOp = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'includes' | 'excludes';
export interface Condition { field: CondField; op: CondOp; value: string | number | boolean }

/**
 * A standing order: said once, holds until revoked. This is the automation
 * system. `text` is the ruler's verbatim words; `gist` is the delegate's
 * read-back ("No evicting widows in winter. Aye.").
 */
export interface StandingOrder {
  id: Id;
  to: StaffRole | 'all';
  text: string;
  gist: string;
  /** what it governs — a decision type, and/or one specific incident def */
  decision: DecisionType | null;
  incidentDef: string | null;
  when: Condition[];             // all must hold (empty = always)
  /** 'choose' picks an option/outcome; 'never' forbids one */
  rule: 'choose' | 'never';
  option: DecisionOption | null; // for system decisions
  outcomeId: string | null;      // for a specific incident def
  createdDay: number;
  uses: number;
}

/** Realm-wide numeric knobs. Set by word ("three days' grace, no more") or in the ledger. */
export interface Policies {
  graceDays: number;             // days after the 1st before rent counts as late
  lateFeePct: number;            // late fee as % of rent
  depositMonths: number;         // deposit asked at signing, in months of rent
  /** asking rent for new leases as % of market when a Steward prices vacancies */
  askPct: number;
  /** yearly rent increase cap at renewal, % */
  renewalCapPct: number;
  pets: 'allow' | 'pet_rent' | 'ban';
  screening: 'never' | 'always';
}

export type OathKind =
  | 'repair'          // fix {building} by due day
  | 'no_rent_raise'   // do not raise {tenant}'s rent before due day
  | 'no_evict'        // do not evict / serve notice on {tenant} before due day
  | 'build'           // build a {buildingType} by due day
  | 'pay'             // pay {tenant} {amount} by due day
  | 'rent_cap'        // keep {tenant}'s rent at or under {amount} until due day
  | 'word';           // anything else — recorded, judged kept unless clearly broken
export type OathState = 'open' | 'kept' | 'broken' | 'released';

export interface Oath {
  id: Id;
  kind: OathKind;
  text: string;                  // the ruler's promise in plain words
  toTenantId: Id | null;
  toName: string;
  buildingId: Id | null;
  buildingType: BuildingType | null;
  amount: number | null;
  madeDay: number;
  dueDay: number;
  state: OathState;
  settledDay: number | null;
}

// ───────────────────────────── realm, money, progress ─────────────────────────────

export type IncomeCat = 'rent' | 'fees' | 'deposits_kept' | 'windfall' | 'loan';
export type ExpenseCat = 'construction' | 'repairs' | 'wages' | 'upkeep' | 'tribute' | 'interest'
  | 'deposits_returned' | 'bribes' | 'gifts' | 'court' | 'land' | 'loan_repaid' | 'other';

export interface MonthBook {
  index: number;                 // months since start (0 = first month)
  income: Record<IncomeCat, number>;
  expense: Record<ExpenseCat, number>;
  /** coffers at month end */
  closing: number;
  rentDue: number;               // total rent that fell due this month
  rentCollected: number;
}

export interface Txn { day: number; amount: number; cat: IncomeCat | ExpenseCat; memo: string; tenantId?: Id; buildingId?: Id }

export interface Ledger {
  months: MonthBook[];           // capped history, newest last
  txns: Txn[];                   // capped, newest last
}

export type GoalMetric =
  | 'rentRoll' | 'households' | 'renown' | 'favor' | 'gold' | 'happinessAvg'
  | 'staff' | 'oathsKept' | 'buildings' | 'monthsNoVacancy' | 'conditionAvg';
export interface GoalProgress { id: string; value: number; target: number; done: boolean }
export interface CharterProgress {
  goals: GoalProgress[];
  /** all goals met; the Crown's herald is on the way / waiting */
  ready: boolean;
  /** day the current rank was attained */
  sinceDay: number;
}

export interface RivalState {
  name: string;                  // "Baron Aldous Vane"
  seat: string;                  // "Greywater"
  renown: number;                // 0..100, drifts
  temperament: 'grasping' | 'charming' | 'ruthless';
  portraitSeed: number;
  poached: number;               // households taken from you
  lastMoveDay: number;
}

export type HeraldKind = 'info' | 'good' | 'bad' | 'urgent' | 'crown' | 'staff' | 'rival' | 'oath';
export interface Herald {
  id: Id;
  day: number;
  kind: HeraldKind;
  text: string;
  buildingId?: Id;
  tenantId?: Id;
  incidentId?: Id;
  staffId?: Id;
}

export interface Stats {
  rentCollected: number;
  evictions: number;
  oathsKept: number;
  oathsBroken: number;
  incidentsResolved: number;
  incidentsIgnored: number;
  tenantsHoused: number;         // lifetime
  wordsSpoken: number;           // orders + audiences by voice/typing
  peakRentRoll: number;
  daysInDebt: number;
}

export interface Loan { principal: number; ratePctMonth: number; takenDay: number }

export interface EndState {
  reason: 'bankrupt' | 'charter_revoked' | 'abdicated';
  day: number;
  epitaph: string;
}

export type WeatherKind = 'clear' | 'rain' | 'storm' | 'snow' | 'heat' | 'fog' | 'hail';

export interface GameState {
  version: number;
  seed: number;
  rng: number;                   // rng cursor (mulberry32 state)
  mode: Mode;
  nextId: number;

  day: number;                   // float days since the reign began (day 0 = 1st of Thawmonth, Year 1)
  speed: Speed;
  weather: WeatherKind;

  realm: {
    name: string;                // "Mudlark Hollow"
    ruler: string;               // "Luke"
    rank: RankId;
    crest: number;               // heraldry seed
    heirloom: string | null;     // Iron Crown inheritance
    reign: number;               // 1 = first of the dynasty
  };

  gold: number;                  // may go negative briefly; modes.ts turns it into debt
  loans: Loan[];
  renown: number;                // 0..100 standing with tenants
  favor: number;                 // 0..100 standing with the Crown

  map: MapState;
  buildings: Record<Id, Building>;
  tenants: Record<Id, Tenant>;   // housed + recently departed (pruned)
  applicants: Record<Id, Applicant>;
  staff: Record<Id, StaffMember>;
  candidates: Candidate[];
  actors: Record<Id, Actor>;
  jobs: Record<Id, Job>;
  incidents: Record<Id, Incident>;
  /** defId → day it last spawned (cooldowns, once-only) */
  incidentLog: Record<string, number>;
  /** scheduled spawns */
  pending: { defId: string; day: number; buildingId: Id | null; tenantId: Id | null; vars: Record<string, string | number> }[];

  orders: StandingOrder[];
  policies: Policies;
  oaths: Oath[];

  ledger: Ledger;
  charter: CharterProgress;
  rival: RivalState;
  heralds: Herald[];             // capped log, newest last
  stats: Stats;
  flags: Record<string, number | string | boolean>;
  /** tutorial / first-time hints already shown */
  seen: Record<string, boolean>;
  ended: EndState | null;

  /** TRANSIENT — events raised this tick; drained by Sim, never saved. */
  _events: SimEvent[];
}

// ───────────────────────────── events (sim → render / ui / audio) ─────────────────────────────

export type SimEvent =
  | { type: 'herald'; herald: Herald }
  | { type: 'day'; day: number }
  | { type: 'month'; month: number; year: number }          // month 0..11
  | { type: 'season'; season: Season }
  | { type: 'rent_day' }
  | { type: 'weather'; kind: WeatherKind }
  | { type: 'gold'; amount: number; cat: IncomeCat | ExpenseCat; buildingId?: Id; tenantId?: Id }
  | { type: 'building_placed'; buildingId: Id }
  | { type: 'building_done'; buildingId: Id }
  | { type: 'building_removed'; buildingId: Id; btype: BuildingType; x: number; y: number; w: number; h: number }
  | { type: 'building_changed'; buildingId: Id }           // condition band, level, visuals, squatters, name
  | { type: 'tiles_changed'; tiles: [number, number][] }
  | { type: 'parcel_bought'; parcelId: number }
  | { type: 'tenant_in'; tenantId: Id; buildingId: Id; unit: number }
  | { type: 'tenant_out'; tenantId: Id; buildingId: Id; unit: number; reason: MoveOutReason }
  | { type: 'applicant'; applicantId: Id; buildingId: Id }
  | { type: 'applicant_gone'; applicantId: Id; signed: boolean }
  | { type: 'purse'; buildingId: Id; unit: number; amount: number }
  | { type: 'purse_collected'; buildingId: Id; unit: number; amount: number; byActor: Id | null }
  | { type: 'rent_paid'; tenantId: Id; buildingId: Id; amount: number }
  | { type: 'rent_late'; tenantId: Id; buildingId: Id }
  | { type: 'incident'; incidentId: Id }
  | { type: 'incident_resolved'; incidentId: Id; outcomeId: string; by: ResolvedBy }
  | { type: 'incident_expired'; incidentId: Id }
  | { type: 'job'; jobId: Id; phase: 'queued' | 'start' | 'arrive' | 'done' | 'cancel' }
  | { type: 'actor_spawn'; actorId: Id }
  | { type: 'actor_gone'; actorId: Id }
  | { type: 'emote'; emote: EmoteId; actorId?: Id; tenantId?: Id; buildingId?: Id }
  | { type: 'say'; text: string; actorId?: Id; tenantId?: Id; buildingId?: Id; staffId?: Id }
  | { type: 'staff_hired'; staffId: Id }
  | { type: 'staff_left'; staffId: Id; name: string; role: StaffRole }
  | { type: 'order_added'; orderId: Id }
  | { type: 'order_revoked'; orderId: Id }
  | { type: 'order_used'; orderId: Id; incidentId: Id }
  | { type: 'oath'; oathId: Id; state: OathState }
  | { type: 'renown'; amount: number; reason?: string }
  | { type: 'favor'; amount: number; reason?: string }
  | { type: 'goal'; goalId: string }
  | { type: 'charter_ready' }
  | { type: 'promotion'; rank: RankId }
  | { type: 'demotion'; rank: RankId }
  | { type: 'tribute'; amount: number; paid: boolean }
  | { type: 'game_over'; reason: EndState['reason'] }
  | { type: 'sfx'; id: SfxId; buildingId?: Id };

export type SimEventType = SimEvent['type'];

// ───────────────────────────── actions (everything → sim) ─────────────────────────────

/**
 * The ONLY way anything outside the sim changes the world: UI clicks, the
 * word layer (after the model interprets speech), bots. Each is validated;
 * a refusal carries a short in-fiction reason the delegate can say aloud.
 */
export type Action =
  // building & land
  | { type: 'place_building'; btype: BuildingType; x: number; y: number; rot: 0 | 1 | 2 | 3 }
  | { type: 'demolish'; buildingId: Id }
  | { type: 'upgrade_building'; buildingId: Id }
  | { type: 'rename_building'; buildingId: Id; name: string }
  | { type: 'place_road'; tiles: [number, number][] }
  | { type: 'remove_road'; tiles: [number, number][] }
  | { type: 'clear_tile'; x: number; y: number }
  | { type: 'buy_parcel'; parcelId: number }
  // rent & leasing
  | { type: 'set_rent'; buildingId: Id; rent: number }
  | { type: 'set_listed'; buildingId: Id; listed: boolean }
  | { type: 'collect_purse'; buildingId: Id; unit?: number }          // queue a collect job
  | { type: 'collect_all' }
  // work
  | { type: 'order_job'; kind: JobKind; buildingId?: Id; tenantId?: Id; applicantId?: Id; role?: JobRole }
  | { type: 'cancel_job'; jobId: Id }
  | { type: 'go_to'; x: number; y: number }                            // the ruler walks there
  // incidents & decisions
  | { type: 'resolve_incident'; incidentId: Id; outcomeId: string }
  | { type: 'dismiss_incident'; incidentId: Id }                       // let it run its course
  // staff
  | { type: 'hire'; candidateId: Id }
  | { type: 'dismiss_staff'; staffId: Id }
  | { type: 'set_wage'; staffId: Id; wage: number }
  | { type: 'refresh_candidates' }
  // the word
  | { type: 'add_order'; order: Omit<StandingOrder, 'id' | 'createdDay' | 'uses'> }
  | { type: 'revoke_order'; orderId: Id }
  | { type: 'set_policy'; policy: Partial<Policies> }
  | { type: 'swear_oath'; oath: Omit<Oath, 'id' | 'madeDay' | 'state' | 'settledDay'> }
  | { type: 'release_oath'; oathId: Id }
  // people
  | { type: 'gift'; tenantId: Id; amount: number }
  | { type: 'hold_feast' }                                             // costs gold, lifts the realm
  | { type: 'reveal_trait'; tenantId: Id; trait: TraitId }             // learned in conversation
  | { type: 'remember'; tenantId: Id; text: string; valence: -2 | -1 | 1 | 2 }
  // money & crown
  | { type: 'take_loan'; amount: number }
  | { type: 'repay_loan'; amount: number }
  | { type: 'accept_promotion' }
  | { type: 'abdicate' }
  // meta
  | { type: 'set_speed'; speed: Speed }
  | { type: 'mark_seen'; key: string }
  | { type: 'set_flag'; key: string; value: number | string | boolean };

export type ActionType = Action['type'];
export type ActionOf<T extends ActionType> = Extract<Action, { type: T }>;

export type ActionResult =
  | { ok: true; id?: Id }
  /** `reason` is short, in-world, sayable by a delegate: "The coffers hold but 12 crowns, my lord." */
  | { ok: false; code: RefusalCode; reason: string };

export type RefusalCode =
  | 'no_gold' | 'blocked' | 'not_owned' | 'locked' | 'not_found' | 'invalid'
  | 'busy' | 'no_staff' | 'occupied' | 'not_ready' | 'ended';

export type ActionHandler<T extends ActionType = ActionType> = (s: GameState, a: ActionOf<T>) => ActionResult;
export type ActionHandlers = { [T in ActionType]?: ActionHandler<T> };

/** One simulation system. index.ts runs them in a fixed order. */
export interface SimModule {
  name: string;
  /** new game only (not on load), in module order */
  init?(s: GameState): void;
  /** every tick; dtDays is small (<= 0.25) */
  step?(s: GameState, dtDays: number): void;
  /** once per integer day crossed; `day` is the new whole day number */
  onDay?(s: GameState, day: number): void;
  /** on the 1st of each month, after onDay. monthIndex = months since start */
  onMonth?(s: GameState, monthIndex: number): void;
  /** a job finished (state === 'done'); every module sees every job */
  onJobDone?(s: GameState, job: Job): void;
  handlers?: ActionHandlers;
}

// ───────────────────────────── derived helpers (types only) ─────────────────────────────

export interface DateParts {
  year: number;                  // 1..
  month: number;                 // 0..11
  dom: number;                   // 1..30
  season: Season;
  monthIndex: number;            // months since start
  dayOfMonthFloat: number;       // 0..30
  /** 0..1 through the month — drives the table's light cycle */
  monthPhase: number;
}

export type { BuildingType, Species, TradeId, TraitId, TenantTag, TemperamentId, VisualId, IconId, EmoteId, SfxId, PetKind, SquatterKind, NpcId };
