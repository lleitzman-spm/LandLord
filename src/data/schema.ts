/**
 * Content schemas. Content files are plain typed data — no logic — so that
 * writers, bots and the model can all read them.
 *
 * Text templates may use these placeholders (filled by sim/core `fill`):
 *   {tenant} full name · {first} first name · {building} building name ·
 *   {btype} "cottage" · {trade} · {species} · {rent} · {amount} · {pet} ·
 *   {ruler} ruler's name · {title} "Reeve" · {realm} · {rival} · {staff} name of
 *   the relevant delegate · {season} · {month}
 * Effects that need a household (happiness scope 'tenant', arrears, memory, rent, trait, pet...)
 * apply to the building's occupant(s) when the target is 'building', and do nothing if it is empty.
 * Use only placeholders that are guaranteed by the incident's `target`
 * (tenant placeholders need target 'tenant'; building ones need a building).
 */

import type {
  BuildingType, Species, TradeId, TraitId, TenantTag, TemperamentId, VisualId, IconId, PetKind,
  SquatterKind, NpcId,
} from './ids';
import type {
  BuildingCategory, RankId, StaffRole, Season, DecisionType, DecisionOption, OathKind, HeraldKind,
  GoalMetric,
} from '../sim/types';

// ───────────── buildings ─────────────

export interface BuildingDef {
  id: BuildingType;
  name: string;                    // "Hovel"
  plural: string;
  category: BuildingCategory;
  w: number; h: number;            // footprint in tiles before rotation
  units: number;                   // leasable units (0 for amenity/staff/seat)
  capacity: number;                // largest household a unit fits
  cost: number;                    // crowns to build
  buildDays: number;               // mason-days of labour
  upkeep: number;                  // crowns per month
  baseRent: number;                // market rent per unit at desirability 50, condition 100
  decay: number;                   // condition points lost per month, baseline
  minRank: RankId;
  /** species that especially want to live here (others still may, unless `only`) */
  prefers?: Species[];
  /** if set, only these species will apply */
  only?: Species[];
  /** commercial: trades that will lease it */
  trades?: TradeId[];
  /** aura: desirability added to housing within `radius` tiles */
  aura?: { radius: number; amount: number };
  staffRole?: StaffRole;
  maxLevel: number;
  /** names for levels above 1 (seat: ['Reeve\'s Hut','Manor','Keep']) */
  levelNames?: string[];
  blurb: string;                   // one comic line for the pattern book
}

export interface TradeDef {
  id: TradeId;
  name: string;                    // "Blacksmith"
  income: number;                  // crowns per month, typical
  /** commercial building this trade wants, if any */
  shop?: BuildingType;
  minRank: RankId;
  blurb: string;
}

export interface SpeciesDef {
  id: Species;
  name: string; plural: string; adjective: string;   // "Dwarf", "Dwarves", "dwarven"
  minRank: RankId;
  /** relative frequency among applicants once unlocked */
  weight: number;
  householdRange: [number, number];
  /** typical trait leanings (weights added when rolling traits) */
  traitBias: Partial<Record<TraitId, number>>;
  /** what they notice about a home, for comic complaints */
  cares: string;
  blurb: string;
  firstNames: string[];            // 30+
  surnames: string[];              // 30+
}

export interface TraitDef {
  id: TraitId;
  name: string;                    // "Litigious"
  /** shown once revealed: "Quotes the Reeve's Charter from memory." */
  blurb: string;
  good: boolean;                   // for UI tint only
  /** sim modifiers (all optional) */
  reliability?: number;            // added to base pay-on-time chance (e.g. -0.25)
  happiness?: number;              // monthly happiness drift
  wear?: number;                   // multiplier on damage left at move-out (1 = normal)
  patience?: number;               // multiplier on complaint timers
  stay?: number;                   // multiplier on chance to renew
}

export interface TagDef { id: TenantTag; name: string; blurb: string }

export interface TemperamentDef {
  id: TemperamentId;
  role: StaffRole;
  name: string;                    // "Iron"
  epithet: string;                 // "the Unyielding"
  blurb: string;
  /** ordered preference per decision type when no order covers it */
  bias: Partial<Record<DecisionType, DecisionOption[]>>;
  speed: number;                   // work speed multiplier
  cost: number;                    // job cost multiplier
  quality: number;                 // result quality multiplier (repairs last longer, tenants better matched...)
  /** how they talk — fed to the model: diction, verbal tics, what they care about */
  voice: string;
  /** offline read-backs: {order} is a short restatement */
  acks: string[];
  /** offline refusals / grumbles */
  grumbles: string[];
  /** side effect flavour the sim may fire now and then */
  quirk: string;
}

// ───────────── incidents ─────────────

export type IncidentCategory =
  | 'maintenance' | 'payment' | 'pest' | 'pet' | 'neighbor' | 'legal' | 'crown' | 'weather'
  | 'magic' | 'squatter' | 'rival' | 'windfall' | 'staff' | 'lease' | 'festival' | 'commerce';

/** All given fields must hold for the incident to spawn on its chosen target. */
export interface Requires {
  buildingType?: BuildingType[];
  buildingCategory?: BuildingCategory[];
  conditionBelow?: number; conditionAbove?: number;
  species?: Species[]; trade?: TradeId[];
  trait?: TraitId[];               // household has any of these (hidden ones count)
  tag?: TenantTag[];
  hasPet?: boolean; pet?: PetKind[];
  happinessBelow?: number; happinessAbove?: number;
  monthsHousedAbove?: number;
  vacantDaysAbove?: number;        // target 'vacant'
  hasStaff?: StaffRole[]; lacksStaff?: StaffRole[];
  hasBuilding?: BuildingType[]; lacksBuilding?: BuildingType[];   // anywhere in the realm
  goldAbove?: number; goldBelow?: number;
  renownAbove?: number; renownBelow?: number;
  favorAbove?: number; favorBelow?: number;
  householdsAbove?: number;
  flag?: string[]; notFlag?: string[];                 // realm flags
  buildingFlag?: string[]; notBuildingFlag?: string[];
  policyPets?: ('allow' | 'pet_rent' | 'ban')[];
  yearAbove?: number;
}

export type Effect =
  | { t: 'gold'; amount: number; memo?: string }                 // + earn, − spend (never blocked)
  | { t: 'renown'; amount: number }
  | { t: 'favor'; amount: number }
  | { t: 'happiness'; amount: number; scope?: 'tenant' | 'building' | 'neighbors' | 'all' }
  | { t: 'condition'; amount: number }                           // target building
  | { t: 'rent'; pct: number }                                   // change target tenant's lease rent
  | { t: 'arrears'; amount: number | 'forgive' }
  | { t: 'late'; option: DecisionOption }                        // system: drive the late-rent pipeline
  | { t: 'evict' }
  | { t: 'leave' }                                               // household moves out of its own accord
  | { t: 'deposit'; keepPct: number }                            // system: move-out settlement. -1 = fair (keep only the cost of real damage)
  | { t: 'lease'; accept: boolean; rentPct?: number }            // system: applicant decision
  | { t: 'screen' }                                              // system: reveal applicant's / tenant's hidden traits
  | { t: 'memory'; text: string; valence: -2 | -1 | 1 | 2 }
  | { t: 'trait'; add?: TraitId; reveal?: TraitId; remove?: TraitId }
  | { t: 'pet'; add?: PetKind; remove?: true }
  | { t: 'flag'; key: string; value?: boolean | number | string; scope?: 'realm' | 'building' }
  | { t: 'visual'; add?: VisualId; remove?: VisualId }
  | { t: 'squatters'; set: SquatterKind | null }
  | { t: 'squatters_sign_lease' }                                // squatters become a paying household
  | { t: 'spawn'; id: string; delayDays: number; chance?: number }
  | { t: 'oath'; kind: OathKind; months: number; text: string }
  | { t: 'applicant'; species?: Species; trade?: TradeId }
  | { t: 'loyalty'; role: StaffRole; amount: number }
  | { t: 'herald'; text: string; kind?: HeraldKind };

export interface OutcomeDef {
  id: string;                      // unique within the incident, snake_case
  /** tag for system decisions / standing orders (required unless decision is 'custom') */
  option?: DecisionOption;
  /** short imperative, shown as a Steward's whisper and offline button: "Charge pet rent" */
  label: string;
  /** something the ruler might actually say to choose this — first person, in voice */
  say: string;
  /** for the model: when do the ruler's words mean this outcome? one plain sentence */
  intent: string;
  /** work needed before the effects land */
  job?: { role: StaffRole | 'ruler' | 'any'; days: number; cost: number };
  effects: Effect[];
  /** what the petitioner (or the delegate) says back. Comic. Offline fallback and tone guide. */
  reply: string;
  /** herald line once it is done. Past tense, dry. */
  result: string;
  /** the one-click choice for non-audience incidents */
  default?: boolean;
}

export type PetitionerSpec = 'tenant' | 'applicant' | 'neighbor' | 'staff' | { npc: NpcId };

export interface IncidentDef {
  id: string;                      // unique snake_case
  title: string;                   // ≤ 48 chars, headline case: "The Unauthorized Griffin"
  category: IncidentCategory;
  decision: DecisionType;          // 'custom' unless a system decision
  /** engine-spawned only (late rent, applicants...). Never picked by the random scheduler. */
  system?: boolean;
  target: 'tenant' | 'building' | 'vacant' | 'realm';
  minRank: RankId; maxRank?: RankId;
  weight: number;                  // 1 = ordinary; 0.3 rare; 2 common
  cooldownMonths: number;
  once?: boolean;
  seasons?: Season[];
  requires?: Requires;
  icon: IconId;
  visual?: VisualId;               // shown on the building while open
  urgency: 1 | 2 | 3;
  timerDays: number;               // 0 = no timer
  /** true: a petitioner walks to the seat and you talk. false: a pin on the map. */
  audience: boolean;
  petitioner?: PetitionerSpec;
  /** feed line when it appears */
  herald: string;
  /** audience: opening lines, 2–3 variants, in the petitioner's voice */
  opening?: string[];
  /** audience: what they want, how they argue, what would satisfy them — for the model */
  stance?: string;
  outcomes: OutcomeDef[];          // 2–4
  onExpire: Effect[];
  expireText?: string;
}

// ───────────── people ─────────────

export interface CharacterDef {
  id: string;                      // snake_case
  name: string; first: string;
  species: Species; trade: TradeId;
  household: number;
  traits: TraitId[]; tags: TenantTag[]; pets: PetKind[];
  minRank: RankId;
  /** two or three sentences: who they are, what they want from a landlord */
  bio: string;
  /** diction and tics for the model */
  voice: string;
  lines: { greet: string; pay: string; late: string; complain: string; thanks: string; leave: string };
  /** portrait hints for the code-drawn face */
  look: { hair?: string; beard?: boolean; hat?: string; feature?: string };
}

export interface NpcDef {
  id: NpcId;
  name: string; title: string;
  species: Species;
  bio: string; voice: string;
  look: { hair?: string; beard?: boolean; hat?: string; feature?: string };
  lines: { greet: string; pleased: string; displeased: string };
}

export interface StaffNameDef { role: StaffRole; names: { name: string; first: string; species: Species; pitch: string }[] }

// ───────────── ranks ─────────────

export interface GoalDef {
  id: string;
  text: string;                    // "Collect 60 crowns of rent in a single month"
  metric: GoalMetric;
  target: number;
  /** for metric 'buildings': which type */
  buildingType?: BuildingType;
}

export interface RankDef {
  id: RankId;
  title: string;                   // "Reeve"
  realm: string;                   // "Hamlet"
  address: string;                 // how people address you: "Reeve", "Sir", "my lord"
  goals: GoalDef[];                // charter to earn the NEXT rank
  buildings: BuildingType[];       // newly unlocked at this rank
  species: Species[];              // newly arriving at this rank
  staff: StaffRole[];              // roles that may be hired from this rank
  maxParcels: number;
  tribute: number;                 // crowns per quarter owed to the Crown
  seatLevel: number;
  /** read by the Crown's herald at the ceremony */
  proclamation: string;
  /** what this rank's new loop is, one line for the charter page */
  duty: string;
}

// ───────────── barks ─────────────

export type BarkKey =
  | 'pay_rent' | 'pay_rent_grudging' | 'late_excuse' | 'move_in' | 'move_out_happy' | 'move_out_angry'
  | 'rent_raised' | 'rent_lowered' | 'repair_thanks' | 'repair_waiting' | 'idle_happy' | 'idle_unhappy'
  | 'idle_winter' | 'idle_summer' | 'see_ruler' | 'see_bailiff' | 'feast' | 'evicted' | 'neighbor_evicted'
  | 'griffin' | 'goblins' | 'rain' | 'snow' | 'new_building' | 'vacancy_gossip' | 'well_gossip'
  | 'tavern' | 'purse_waiting' | 'applicant_waiting' | 'applicant_signed' | 'applicant_rejected';

export type BarkTable = Record<BarkKey, string[]>;
