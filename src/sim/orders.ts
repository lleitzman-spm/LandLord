/**
 * OWNER: sim-decide agent. Standing orders, policies, and how a matter is
 * settled when the ruler is not asked.
 *
 * decide(), in order:
 *   1. Standing orders that match the incident (its decision type and/or its
 *      def, every `when` condition true). `never` rules strike options.
 *   2. The most specific `choose` rule whose option survives picks it.
 *   3. House policy (screening: always).
 *   4. The delegate whose domain it is, if they have the authority: routine
 *      dispatch at authority 0 (map pins: temperament bias, else the default
 *      outcome); from authority 1 the pipeline's own audiences in their domain
 *      (system decisions: late rent, the writ, applicants, sureties, renewals,
 *      undeclared animals, squatters) by temperament bias; at authority 2 also
 *      the stories the scheduler brings to court, in their line of work (bias,
 *      then judgment). Set pieces (`once`, or urgency 3) are always the
 *      ruler's. A delegate never spends more than the coffers hold.
 *   5. Otherwise null: it waits for the ruler.
 *
 * A delegate acting on their own judgment sometimes adds the comedy of
 * delegation (quirk): strictly within their temperament, and never against a
 * `never` order.
 */
import {
  DECISION_OPTIONS, STAFF_ROLES,
  type GameState, type SimModule, type Incident, type ResolvedBy, type Id, type StandingOrder,
  type Condition, type CondField, type CondOp, type DecisionType, type DecisionOption, type StaffRole,
  type ActionResult, type RefusalCode, type StaffMember, type Policies, type ActionOf, type Season,
} from './types';
import type { IncidentDef, OutcomeDef, IncidentCategory, TemperamentDef } from '../data/schema';
import type { TemperamentId } from '../data/ids';
import { MONTH_NAMES, ROLE_TITLES } from '../data/ids';
import { INCIDENT_BY_ID } from '../data/incidents/index';
import { TEMPERAMENT_DEFS } from '../data/temperaments';
import { BUILDINGS } from '../data/buildings';
import { emit, herald, fill, newId, dateOf, hash01, rulerTitle, clamp } from './core';
import { staffOf, reportTail, changeLoyalty } from './staff';
import { resolveBy, householdOf, outcomeBlocked, type HouseholdView } from './incidents';
import { addArrears } from './rent';
import { changeHappiness, addMemory, neighborsOf } from './tenants';
import { changeFavor, changeRenown } from './renown';
import { earn, spend } from './economy';
import { addVisual } from './buildings';

export const TUNE = {
  maxOrders: 40,
  maxConditions: 6,
  /** a delegate who has been handed a matter back this many times in one sitting stops guessing */
  maxRounds: 2,
  grace: [0, 14], lateFee: [0, 50], deposit: [0, 3], ask: [50, 200], renewalCap: [0, 50],
};

/** Whose line of work each system decision is. */
const DOMAIN: Record<DecisionType, StaffRole | null> = {
  custom: null, repair: 'mason', late_rent: 'bailiff', eviction_ready: 'bailiff', squatters: 'bailiff',
  applicant: 'crier', move_out_deposit: 'steward', rent_renewal: 'steward', pet: 'steward',
};

/** Whose line of work a custom incident is, for a delegate trusted with full judgment. Court business stays with the ruler. */
const CATEGORY_ROLE: Partial<Record<IncidentCategory, StaffRole>> = {
  maintenance: 'mason', weather: 'mason',
  payment: 'bailiff', legal: 'bailiff', squatter: 'bailiff', pest: 'bailiff',
  lease: 'steward', commerce: 'steward', pet: 'steward', neighbor: 'steward', windfall: 'steward', festival: 'steward',
};

/** What each temperament weighs when left to full judgment: coin, contentment, name, the Crown, the fabric, and keeping the household. */
const LEANING: Record<TemperamentId, { gold: number; happy: number; renown: number; favor: number; fabric: number; keep: number }> = {
  perfectionist: { gold: 0.3, happy: 0.6, renown: 0.6, favor: 0.4, fabric: 2.0, keep: 1 },
  bodger: { gold: 1.2, happy: 0.4, renown: 0.3, favor: 0.2, fabric: 0.4, keep: 1 },
  dreamer: { gold: -0.2, happy: 1.0, renown: 0.8, favor: 0.2, fabric: 1.2, keep: 1 },
  steady: { gold: 1, happy: 1, renown: 1, favor: 1, fabric: 1, keep: 1 },
  iron: { gold: 1.2, happy: 0.1, renown: 0.3, favor: 0.8, fabric: 0.5, keep: -0.5 },
  soft: { gold: 0.2, happy: 1.6, renown: 0.8, favor: 0.2, fabric: 0.5, keep: 2 },
  grasping: { gold: 2.0, happy: 0.1, renown: 0.1, favor: 0.3, fabric: 0.3, keep: 0.5 },
  lawful: { gold: 0.7, happy: 0.5, renown: 0.6, favor: 1.5, fabric: 0.6, keep: 0.5 },
  honeytongue: { gold: 1.2, happy: 0.8, renown: 0.5, favor: 0.3, fabric: 0.3, keep: 1.5 },
  honest: { gold: 0.5, happy: 1.0, renown: 1.5, favor: 0.6, fabric: 0.8, keep: 1 },
  snob: { gold: 1.0, happy: 0.3, renown: 0.8, favor: 0.8, fabric: 0.8, keep: 0.3 },
  bellower: { gold: 0.9, happy: 0.9, renown: 1.1, favor: 0.5, fabric: 0.6, keep: 1 },
  pennypincher: { gold: 2.0, happy: 0.3, renown: 0.3, favor: 0.5, fabric: 0.3, keep: 0.8 },
  openhanded: { gold: -0.3, happy: 1.8, renown: 1.0, favor: 0.3, fabric: 0.8, keep: 1.5 },
  bythebook: { gold: 0.8, happy: 0.6, renown: 0.8, favor: 1.2, fabric: 0.8, keep: 1 },
  schemer: { gold: 1.4, happy: 0.4, renown: 1.0, favor: 0.9, fabric: 0.4, keep: 0.8 },
};

/** What was done, said plainly, after the delegate's first name. Placeholders are the incident's vars. */
const PHRASES: Record<DecisionOption, string> = {
  wait: 'gave {tenant} another week to find the rent',
  late_fee: 'charged {tenant} the late fee',
  payment_plan: 'put {tenant} on a payment plan',
  forgive: 'forgave {tenant} the debt',
  notice: 'served notice on {tenant}',
  cash_for_keys: 'paid {tenant} to hand back the keys',
  evict: 'put {tenant} out of {building}',
  mercy: 'tore up the writ against {tenant}',
  fix: 'set about mending {building} properly',
  patch: 'patched up {building} with what was to hand',
  defer: 'looked at {building} and decided it could wait',
  bill_tenant: "mended {building} and put it on the tenant's slate",
  accept: 'welcomed {tenant} to {building}',
  reject: 'turned {tenant} away from {building}',
  screen: 'went to ask the last landlord about {tenant}',
  counter: 'offered {tenant} the place at a higher rent',
  return_all: "returned the whole of {tenant}'s surety",
  fair: "kept the cost of the damage from {tenant}'s surety",
  keep_all: "kept every crown of {tenant}'s surety",
  oust: 'went to turn the squatters out of {building}',
  bribe: 'paid the squatters at {building} to leave',
  lease: 'offered the squatters at {building} a lease',
  ignore: 'left the squatters at {building} to it',
  allow: 'let {tenant} keep the {pet}',
  pet_rent: 'put the {pet} at {building} on pet rent',
  ban: 'told {tenant} the {pet} must go',
  hold: "renewed {tenant}'s lease at the same rent",
  raise: "renewed {tenant}'s lease at a higher rent",
  lower: "renewed {tenant}'s lease at a lower rent",
};

const COND_FIELDS: CondField[] = [
  'season', 'month', 'gold', 'renown', 'cost',
  'tenant.species', 'tenant.trade', 'tenant.tags', 'tenant.traits', 'tenant.monthsHoused', 'tenant.daysLate',
  'tenant.arrears', 'tenant.happiness', 'tenant.household', 'tenant.hasPets', 'tenant.name',
  'building.type', 'building.condition', 'building.id', 'building.rent',
];
const COND_OPS: CondOp[] = ['==', '!=', '<', '<=', '>', '>=', 'includes', 'excludes'];
const NUMERIC_FIELDS: CondField[] = ['gold', 'renown', 'cost', 'tenant.monthsHoused', 'tenant.daysLate', 'tenant.arrears', 'tenant.happiness', 'tenant.household', 'building.condition', 'building.rent'];
const ALL_DECISIONS = Object.keys(DECISION_OPTIONS) as DecisionType[];
const ALL_OPTIONS = Object.keys(PHRASES) as DecisionOption[];

const isStaffRole = (x: unknown): x is StaffRole => typeof x === 'string' && (STAFF_ROLES as string[]).includes(x);

/** The delegate whose line of work a system decision is (null for custom incidents). */
export function domainRole(def: IncidentDef): StaffRole | null { return DOMAIN[def.decision] ?? null; }

// ───────────── conditions ─────────────

interface Ctx { s: GameState; h: HouseholdView | null; inc: Incident; def: IncidentDef; season: Season; month: number }

const norm = (v: unknown): string => String(v).trim().toLowerCase().replace(/[\s-]+/g, '_');
/** "widows" is "widow", "dwarves" is "dwarf", "families" is "family": orders are spoken, not typed */
const single = (w: string): string => (w.length > 4 && w.endsWith('ves') ? w.slice(0, -3) + 'f' : w.length > 4 && w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const alike = (a: string, e: string): boolean => a === e || single(a) === single(e);

/** What the matter would cost if handled the usual way: the default remedy's work and any coin it pays out
 *  (with no default, the first remedy that needs work). "If mending costs more than twenty, patch it" is
 *  about the price of the mending, not of the patch. */
function costFor(def: IncidentDef): number {
  const o = def.outcomes.find(x => x.default) ?? def.outcomes.find(x => x.job);
  return o ? costOf(o, undefined) : 0;
}

function fieldValue(c: Condition, x: Ctx): string | number | boolean | string[] | undefined {
  const b = x.inc.buildingId ? x.s.buildings[x.inc.buildingId] : null;
  const h = x.h;
  switch (c.field) {
    case 'season': return x.season;
    case 'month': return Number.isFinite(Number(c.value)) && c.value !== '' && typeof c.value !== 'boolean' ? x.month : MONTH_NAMES[x.month];
    case 'gold': return x.s.gold;
    case 'renown': return x.s.renown;
    case 'cost': return costFor(x.def);
    case 'tenant.species': return h?.species;
    case 'tenant.trade': return h?.trade;
    case 'tenant.tags': return h?.tags;
    case 'tenant.traits': return h?.revealed;               // only what the ruler has found out
    case 'tenant.monthsHoused': return h?.monthsHoused;
    case 'tenant.daysLate': return h?.daysLate;
    case 'tenant.arrears': return h?.arrears;
    case 'tenant.happiness': return h?.happiness;
    case 'tenant.household': return h?.household;
    case 'tenant.hasPets': return h ? h.pets.length > 0 : undefined;
    case 'tenant.name': return h?.name;
    case 'building.type': return b?.type;
    case 'building.condition': return b?.condition;
    case 'building.id': return b?.id;
    case 'building.rent': return b?.rent;
    default: return undefined;
  }
}

function holds(c: Condition, x: Ctx): boolean {
  const actual = fieldValue(c, x);
  if (actual === undefined || actual === null) return false;   // an order about tenants says nothing where there is none
  const op = c.op;
  const yes = op === '==' || op === 'includes', no = op === '!=' || op === 'excludes';
  if (Array.isArray(actual)) {
    const e = norm(c.value);
    const has = actual.some(a => alike(norm(a), e));
    return yes ? has : no ? !has : false;
  }
  if (typeof actual === 'boolean') {
    const want = c.value === true || c.value === 1 || ['true', 'yes', '1'].includes(norm(c.value));
    return yes ? actual === want : no ? actual !== want : false;
  }
  if (typeof actual === 'number') {
    const n = Number(c.value);
    if (!Number.isFinite(n) || typeof c.value === 'boolean') return false;
    switch (op) {
      case '==': case 'includes': return actual === n;
      case '!=': case 'excludes': return actual !== n;
      case '<': return actual < n;
      case '<=': return actual <= n;
      case '>': return actual > n;
      case '>=': return actual >= n;
      default: return false;
    }
  }
  const a = norm(actual), e = norm(c.value);
  if (!e) return false;
  let eq = alike(a, e);
  if (c.field === 'tenant.name' && !eq && x.h) eq = norm(x.h.first) === e || (e.length >= 3 && a.includes(e));
  switch (op) {
    case '==': return eq;
    case '!=': return !eq;
    case 'includes': return eq || a.includes(e);
    case 'excludes': return !(eq || a.includes(e));
    default: return false;
  }
}

function contextOf(s: GameState, inc: Incident, def: IncidentDef): Ctx {
  const d = dateOf(s.day);
  return { s, h: householdOf(s, inc), inc, def, season: d.season, month: d.month };
}

function outcomeMatches(o: StandingOrder, out: OutcomeDef): boolean {
  if (o.outcomeId) return out.id === o.outcomeId;
  return !!o.option && out.option === o.option;
}

function governs(o: StandingOrder, def: IncidentDef): boolean {
  if (!o.decision && !o.incidentDef) return false;
  if (o.incidentDef && o.incidentDef !== def.id) return false;
  if (o.decision && o.decision !== def.decision) return false;
  return !!(o.option || o.outcomeId);
}

/** Orders that apply to this incident right now (conditions evaluated). */
export function ordersFor(s: GameState, inc: Incident): StandingOrder[] {
  const def = INCIDENT_BY_ID[inc.defId];
  if (!def || !s.orders.length) return [];
  const x = contextOf(s, inc, def);
  return s.orders.filter(o => governs(o, def) && (o.when ?? []).every(c => holds(c, x)));
}

function specificity(o: StandingOrder): number {
  return (o.incidentDef ? 100 : 0) + (o.outcomeId ? 10 : 0) + (o.when?.length ?? 0) * 2 + (o.to !== 'all' ? 1 : 0);
}

function struckBy(def: IncidentDef, matching: StandingOrder[]): Set<string> {
  const struck = new Set<string>();
  for (const o of matching) if (o.rule === 'never') for (const out of def.outcomes) if (outcomeMatches(o, out)) struck.add(out.id);
  return struck;
}

// ───────────── deciding ─────────────

/** A number in 0..1 that is always the same for this incident, this delegate and this question. */
function stable(inc: Incident, m: StaffMember, salt: number): number {
  let h = 2166136261;
  for (let i = 0; i < inc.id.length; i++) h = Math.imul(h ^ inc.id.charCodeAt(i), 16777619);
  return hash01((h ^ (m.portraitSeed * 31)) + salt * 7919);
}

function delegateFor(s: GameState, def: IncidentDef): StaffMember | null {
  if (def.decision !== 'custom') {
    const role = DOMAIN[def.decision];
    const m = role ? staffOf(s, role) : null;
    if (m) return m;
    // the post is empty: a Steward with a view on such things takes it up
    const st = role !== 'steward' ? staffOf(s, 'steward') : null;
    if (st && TEMPERAMENT_DEFS[st.temperament]?.bias?.[def.decision]?.length) return st;
    return null;
  }
  if (!def.audience) {
    // routine dispatch: whoever the default remedy would send
    const role = def.outcomes.find(o => o.default)?.job?.role;
    const m = isStaffRole(role) ? staffOf(s, role) : null;
    if (m) return m;
  }
  const role = CATEGORY_ROLE[def.category];
  const m = role ? staffOf(s, role) : null;
  return m && m.authority >= 2 ? m : null;
}

function costOf(o: OutcomeDef, t: TemperamentDef | undefined): number {
  let c = (o.job?.cost ?? 0) * (t?.cost ?? 1);
  for (const e of o.effects) if (e.t === 'gold' && e.amount < 0) c -= e.amount;
  return c;
}

/** How an outcome looks to a temperament left to its own judgment. */
function appeal(o: OutcomeDef, t: TemperamentId): number {
  const w = LEANING[t] ?? LEANING.steady;
  let score = -(o.job?.cost ?? 0) / 10 * w.gold;
  for (const e of o.effects) {
    switch (e.t) {
      case 'gold': score += (e.amount / 10) * w.gold; break;
      case 'happiness': score += (e.amount / 10) * (e.scope === 'all' ? 3 : e.scope === 'neighbors' ? 1.5 : 1) * w.happy; break;
      case 'renown': score += e.amount * w.renown; break;
      case 'favor': score += e.amount * 0.5 * w.favor; break;
      case 'condition': score += (e.amount / 10) * w.fabric; break;
      case 'evict': case 'leave': score -= 2 * w.keep; break;
      case 'rent': score += (e.pct / 10) * w.gold * 0.6; break;
      default: break;
    }
  }
  return score;
}

/** Who settles this incident without the ruler, and how? An order first, then a delegate with authority
 *  following temperament, else null (it waits for the ruler). `orderId` is the `choose` order that settled
 *  it (by 'order'), or the `never` order that turned a delegate from what they would rather have done. */
export function decide(s: GameState, inc: Incident): { outcomeId: string; by: ResolvedBy; orderId?: Id } | null {
  const def = INCIDENT_BY_ID[inc.defId];
  if (!def || inc.state !== 'open') return null;
  if (inc.vars._ruler) return null;                                   // the ruler took this one back
  const matching = ordersFor(s, inc);
  const struck = struckBy(def, matching);
  const usable = (o: OutcomeDef | undefined): o is OutcomeDef => !!o && !struck.has(o.id) && !outcomeBlocked(s, inc, o);

  const chooses = matching.map((o, i) => ({ o, i })).filter(x => x.o.rule === 'choose')
    .sort((a, b) => specificity(b.o) - specificity(a.o) || b.o.createdDay - a.o.createdDay || b.i - a.i);
  for (const { o } of chooses) {
    const out = def.outcomes.find(x => outcomeMatches(o, x));
    if (usable(out)) return { outcomeId: out.id, by: 'order', orderId: o.id };
  }

  if (def.decision === 'applicant' && s.policies.screening === 'always') {
    const out = def.outcomes.find(o => o.effects.some(e => e.t === 'screen'));
    if (usable(out)) return { outcomeId: out.id, by: 'order' };
  }

  const m = delegateFor(s, def);
  if (!m) return null;
  if (Number(inc.vars._round ?? 0) >= TUNE.maxRounds) return null;
  const custom = def.decision === 'custom';
  if (def.audience && m.authority < 1) return null;
  // The pipeline's own audiences (late rent, the writ, applicants, sureties...) are day-to-day work for a
  // delegate with authority. A petitioner with a story of their own is the ruler's court: a delegate hears
  // those only once trusted with full judgment, and never a set piece.
  if (def.audience && !def.system && (m.authority < 2 || def.once || def.urgency >= 3)) return null;

  const tdef = TEMPERAMENT_DEFS[m.temperament];
  const picks: OutcomeDef[] = [];
  const want = (o: OutcomeDef | undefined) => { if (o && !picks.includes(o)) picks.push(o); };
  if (!custom) {
    const options: DecisionOption[] = [...(tdef?.bias?.[def.decision] ?? [])];
    if (def.decision === 'pet') options.unshift(s.policies.pets);     // house policy before habit
    const h = householdOf(s, inc);
    if (m.temperament === 'snob' && def.decision === 'applicant' && h && (h.species === 'goblin' || h.species === 'ogre') && stable(inc, m, 1) < 0.7) {
      options.unshift('reject');                                      // not "persons of quality"
    }
    for (const opt of options) want(def.outcomes.find(o => o.option === opt));
  }
  if (!def.audience) want(def.outcomes.find(o => o.default));
  if (m.authority >= 2) {
    const ranked = def.outcomes.map((o, i) => ({ o, i, v: appeal(o, m.temperament) })).sort((a, b) => b.v - a.v || a.i - b.i);
    for (const r of ranked) want(r.o);
  }
  let held: StandingOrder | undefined;                                // the `never` rule that turned them from their first choice
  for (const o of picks) {
    if (struck.has(o.id)) { held ??= matching.find(r => r.rule === 'never' && outcomeMatches(r, o)); continue; }
    if (outcomeBlocked(s, inc, o)) continue;
    const cost = costOf(o, tdef);
    if (cost > 0 && s.gold < cost) continue;                          // not with an empty coffer
    return { outcomeId: o.id, by: m.role, ...(held ? { orderId: held.id } : {}) };
  }
  return null;
}

/** Ask whether anyone will settle this open incident, and if so let them. True if it was settled. */
export function settle(s: GameState, inc: Incident): boolean {
  if (inc.state !== 'open') return false;
  const d = decide(s, inc);
  return !!d && resolveBy(s, inc.id, d.outcomeId, d.by, d.orderId).ok;
}

/** Go through everything open again: a new order, a new hand, or a fuller coffer may have changed the answer. */
export function resettleOpen(s: GameState): void {
  for (const inc of Object.values(s.incidents)) if (inc.state === 'open') settle(s, inc);
}

// ───────────── reporting ─────────────

/** True when a delegate's one-line report says everything the result line would. */
export function reportCovers(def: IncidentDef, outcome: OutcomeDef): boolean {
  return !!def.system && def.decision !== 'custom' && !!outcome.option && !!PHRASES[outcome.option];
}

/** Someone other than the ruler settled this: note the order used, mark it reported, and say so in the feed. */
export function report(s: GameState, inc: Incident, def: IncidentDef, outcome: OutcomeDef, by: ResolvedBy, orderId?: Id): void {
  inc.reported = true;
  const order = orderId ? s.orders.find(o => o.id === orderId) : undefined;
  if (order) {
    order.uses++;
    emit(s, { type: 'order_used', orderId: order.id, incidentId: inc.id });
  }
  let m: StaffMember | null = null;
  if (isStaffRole(by)) m = staffOf(s, by);
  else {
    const role = order && order.to !== 'all' ? order.to : (DOMAIN[def.decision] ?? outcome.job?.role);
    m = isStaffRole(role) ? staffOf(s, role) : null;
  }
  const vars: Record<string, string | number> = { tenant: 'the tenant', building: 'the place', pet: 'animal', ...inc.vars };
  const who = m ? m.first : 'your household';
  const where = inc.buildingId && s.buildings[inc.buildingId] ? ` at ${s.buildings[inc.buildingId]!.name}` : '';
  const covered = def.decision !== 'custom' && outcome.option && PHRASES[outcome.option];
  let text: string;
  if (by === 'order') {
    const lead = order ? 'By your standing order' : 'As house policy requires';
    text = covered ? `${lead}, ${who} ${fill(PHRASES[outcome.option!], vars)}.` : `${lead}, ${who} dealt with ${def.title}${where}.`;
  } else if (order) {
    // their own judgment, within a line the ruler drew: the order did its work, and the ruler should see that it did
    text = covered ? `Held to your standing order, ${who} ${fill(PHRASES[outcome.option!], vars)}.` : `Held to your standing order, ${who} has taken ${def.title} in hand${where}.`;
  } else {
    const tail = m ? reportTail(m, s.nextId + Math.floor(inc.startedDay)) : '.';
    text = covered ? `${who} ${fill(PHRASES[outcome.option!], vars)}${tail}` : `${who} has taken ${def.title} in hand${where}${tail}`;
  }
  herald(s, 'staff', text, {
    incidentId: inc.id, ...(m ? { staffId: m.id } : {}),
    ...(inc.buildingId && s.buildings[inc.buildingId] ? { buildingId: inc.buildingId } : {}),
    ...(inc.tenantId && s.tenants[inc.tenantId] ? { tenantId: inc.tenantId } : {}),
  });
  // and a word from the delegate, over their figure on the table
  const acks = m ? TEMPERAMENT_DEFS[m.temperament]?.acks : undefined;
  if (m && acks?.length) {
    const line = acks[Math.floor(stable(inc, m, 3) * acks.length)] ?? acks[0]!;
    const said = fill(line, { ...vars, order: outcome.label.replace(/[.!]+$/, ''), title: rulerTitle(s), ruler: s.realm.ruler });
    if (said) emit(s, { type: 'say', text: said, staffId: m.id, ...(m.actorId ? { actorId: m.actorId } : {}), ...(inc.buildingId ? { buildingId: inc.buildingId } : {}) });
  }
}

/**
 * The comedy of delegation. Called once the effects of a ruling have landed,
 * and only when a delegate chose it on their own judgment (never under an
 * order). Each habit stays inside its temperament, fires now and then (stable
 * per incident), and respects `never` orders.
 */
export function quirk(s: GameState, inc: Incident, def: IncidentDef, outcome: OutcomeDef, householdId: Id | null): void {
  const by = inc.resolvedBy;
  if (!isStaffRole(by)) return;
  const m = staffOf(s, by);
  if (!m) return;
  const roll = stable(inc, m, 2);
  // one of several ways of putting it, the same one every time for this incident, and never longer than the feed allows
  const vary = <T extends string | { line: string }>(all: T[]): T => {
    const len = (x: T): number => (typeof x === 'string' ? x.length : x.line.length);
    const fits = all.filter(x => len(x) <= 150);
    const lines = fits.length ? fits : [all.slice().sort((a, b) => len(a) - len(b))[0]!];
    return lines[Math.floor(stable(inc, m, 5) * lines.length)] ?? lines[0]!;
  };
  const t = householdId ? (s.tenants[householdId] ?? null) : null;
  const b = inc.buildingId ? (s.buildings[inc.buildingId] ?? null) : null;
  const refs = { incidentId: inc.id, staffId: m.id, ...(b ? { buildingId: b.id } : {}), ...(t ? { tenantId: t.id } : {}) };
  const opt = outcome.option;
  switch (m.temperament) {
    case 'grasping': {
      if (def.decision !== 'late_rent' || !t || t.status !== 'housed' || !t.lease) return;
      if (opt === 'late_fee' || opt === 'forgive' || opt === 'mercy' || roll > 0.45) return;
      // not where the ruler has forbidden fees
      const feeOutcome = def.outcomes.find(o => o.option === 'late_fee');
      const forbidden = s.orders.some(o => o.rule === 'never' && o.option === 'late_fee' && (!o.decision || o.decision === 'late_rent'));
      if (forbidden || (feeOutcome && struckBy(def, ordersFor(s, { ...inc, state: 'open' })).has(feeOutcome.id))) return;
      const fee = Math.max(2, Math.round(t.lease.rent * 0.15));
      const kept = Math.max(1, Math.floor(fee / 3));
      addArrears(s, t.id, fee - kept);
      changeHappiness(s, t.id, -4, 'A fee nobody ordered');
      addMemory(s, t.id, 'Your Bailiff charged a "door fee" that nobody had ordered.', -1);
      herald(s, 'staff', vary([
        `${m.first} also charged ${t.name} a "door fee" of ${fee} crowns. You did not ask for one. Not all of it reached the ledger.`,
        `${m.first} added a "door fee" of ${fee} crowns to what ${t.name} owes. Nobody ordered one. The ledger shows ${fee - kept} of it.`,
        `A "door fee" of ${fee} crowns has appeared on ${t.name}'s slate, in ${m.first}'s hand. ${fee - kept} of them have appeared in the coffers.`,
      ]), refs);
      return;
    }
    case 'soft': {
      if ((def.decision === 'late_rent' || def.decision === 'eviction_ready') && t && t.status === 'housed' && roll < 0.6) changeHappiness(s, t.id, 2, 'Asked after the family');
      return;
    }
    case 'snob': {
      const species = String(inc.vars.species ?? '');
      if (def.decision !== 'applicant' || opt !== 'reject' || (species !== 'goblin' && species !== 'ogre')) return;
      changeFavor(s, -2, 'The Fair Hearth Edict');
      changeRenown(s, -1, 'The Fair Hearth Edict');
      const kind = species === 'ogre' ? 'an ogre' : 'a goblin';
      herald(s, 'bad', vary([
        `${m.first}'s reason was that ${inc.vars.tenant ?? 'the applicant'} is ${kind}. The Fair Hearth Edict has a view on that. So, shortly, will the Crown.`,
        `${m.first} wrote the reason down: "${kind}". The Fair Hearth Edict forbids exactly that, and the Crown's clerks read everything.`,
        `Asked why, ${m.first} said "persons of quality" and looked at ${inc.vars.tenant ?? 'the applicant'}, who is ${kind}. The Fair Hearth Edict has heard.`,
      ]), refs);
      return;
    }
    case 'honeytongue': {
      if (def.decision !== 'applicant' || (opt !== 'accept' && opt !== 'counter') || !t || t.status !== 'housed' || roll > 0.35) return;
      const place = b?.name ?? 'the place';
      const told = vary([
        { memory: 'Your Crier promised a river view. There is a ditch.', line: `${m.first} let ${place} to ${t.name} on the strength of its "river views". The river is a ditch. This will come up.` },
        { memory: 'Your Crier called the place "newly thatched". It was thatched once, and that was new at the time.', line: `${m.first} let ${place} to ${t.name} as "newly thatched". It was thatched once, which was new then. This will come up.` },
        { memory: 'Your Crier promised "a short walk to the well". It is short if one runs.', line: `${m.first} told ${t.name} that ${place} is "a short walk to the well". It is short if one runs. This will come up.` },
      ]);
      changeHappiness(s, t.id, -3, 'Not as the Crier described');
      addMemory(s, t.id, told.memory, -1);
      herald(s, 'staff', told.line, refs);
      return;
    }
    case 'bellower': {
      if (def.decision !== 'applicant' || opt !== 'accept' || !b || roll > 0.3) return;
      const near = neighborsOf(s, b.id, 4);
      if (!near.length) return;
      for (const n of near) changeHappiness(s, n.id, -1, 'The Crier, at volume');
      herald(s, 'staff', vary([
        `${m.first} announced the new household at ${b.name} from a rooftop. The neighbours would like it known that they heard.`,
        `${m.first} cried the letting of ${b.name} at dawn, twice, in case of doubt. The street is awake now, and of one mind.`,
        `${m.first} proclaimed the new tenancy at ${b.name} with the big bell. A baby three doors down has given its reply.`,
      ]), refs);
      return;
    }
    case 'dreamer': {
      if (def.decision !== 'repair' || !outcome.job || !b || roll > 0.3) return;
      const cat = BUILDINGS[b.type].category;
      if ((cat !== 'housing' && cat !== 'commercial') || b.visuals.includes('gargoyle')) return;
      addVisual(s, b.id, 'gargoyle');
      spend(s, 3, 'repairs', 'A gargoyle, unrequested', { buildingId: b.id });
      herald(s, 'staff', vary([
        `${m.first} has added a gargoyle to ${b.name}. Nobody asked for a gargoyle. It is on the bill.`,
        `There is now a gargoyle on ${b.name}. ${m.first} says the roof "wanted one". It is on the bill, under "sundries, winged".`,
      ]), refs);
      return;
    }
    case 'openhanded': {
      const giving = (def.decision === 'move_out_deposit' && (opt === 'return_all' || opt === 'fair')) || (def.decision === 'rent_renewal' && (opt === 'hold' || opt === 'lower'));
      if (!giving || !t || roll > 0.25) return;
      const gift = Math.max(2, Math.round((t.lease?.rent ?? 10) * 0.2));
      if (s.gold < gift) return;
      spend(s, gift, 'gifts', 'A little something, with your compliments', { tenantId: t.id });
      if (t.status === 'housed') changeHappiness(s, t.id, 3, 'A little something from the Steward');
      herald(s, 'staff', vary([
        `${m.first} also gave ${t.name} ${gift} crowns from the coffers "with your compliments". You have been very generous.`,
        `${m.first} sent ${t.name} off with ${gift} crowns of yours "for the children". There may not be children. It was kindly meant.`,
        `${t.name} has ${gift} crowns from the coffers, by way of ${m.first}, "as the ${rulerTitle(s)} would wish". You are informed that you wished it.`,
      ]), refs);
      return;
    }
    case 'pennypincher': {
      if (def.decision !== 'move_out_deposit' || opt !== 'fair' || !t || roll > 0.3) return;
      earn(s, 1, 'fees', 'Candle ends, itemised', { tenantId: t.id });
      herald(s, 'staff', vary([
        `${m.first} also billed ${t.name} one crown for candle ends, itemised. It was paid in silence.`,
        `${m.first} found one more crown owing from ${t.name}: "wear to the door latch, by use". It was paid, with a look.`,
      ]), refs);
      return;
    }
    default: return;
  }
}

// ───────────── actions ─────────────

function refuse(code: RefusalCode, reason: string): ActionResult { return { ok: false, code, reason }; }
const short = (text: string, n: number): string => (text.length > n ? text.slice(0, n - 3).trimEnd() + '...' : text);

function cleanCondition(raw: unknown): Condition | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Partial<Condition>;
  if (!COND_FIELDS.includes(c.field as CondField) || !COND_OPS.includes(c.op as CondOp)) return null;
  let value = c.value;
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return null;
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  if (NUMERIC_FIELDS.includes(c.field as CondField)) {
    const n = Number(value);
    if (!Number.isFinite(n) || typeof value === 'boolean' || value === '') return null;
    value = n;
  }
  if (typeof value === 'string') value = value.trim().slice(0, 60);
  return { field: c.field as CondField, op: c.op as CondOp, value };
}

function addOrder(s: GameState, a: ActionOf<'add_order'>): ActionResult {
  const o = a.order as Partial<ActionOf<'add_order'>['order']> | undefined;
  const title = rulerTitle(s);
  if (!o || typeof o !== 'object') return refuse('invalid', `An order needs words, ${title}.`);
  if (o.to !== 'all' && !isStaffRole(o.to)) return refuse('invalid', 'An order must be given to someone: the Mason, the Bailiff, the Crier, the Steward, or all of them.');
  const text = typeof o.text === 'string' ? o.text.trim().slice(0, 240) : '';
  if (!text) return refuse('invalid', `An order needs words, ${title}.`);
  const gist = (typeof o.gist === 'string' && o.gist.trim() ? o.gist.trim() : text).slice(0, 200);
  if (o.rule !== 'choose' && o.rule !== 'never') return refuse('invalid', 'A standing order either chooses a thing or forbids one.');

  const decision = o.decision ?? null;
  if (decision !== null && !ALL_DECISIONS.includes(decision)) return refuse('invalid', 'That is not a kind of matter the court knows.');
  const incidentDef = o.incidentDef ?? null;
  const def = incidentDef ? INCIDENT_BY_ID[incidentDef] : undefined;
  if (incidentDef !== null && !def) return refuse('invalid', 'No such matter has ever come before this court.');
  if (!decision && !def) return refuse('invalid', 'That order governs nothing the court can name.');
  if (decision === 'custom' && !def) return refuse('invalid', 'That order governs nothing the court can name.');
  if (def && decision && def.decision !== decision) return refuse('invalid', 'That matter is not of that kind. The order would never apply.');

  const option = o.option ?? null;
  const outcomeId = o.outcomeId ?? null;
  if (option === null && outcomeId === null) return refuse('invalid', 'The order does not say what is to be done, or not done.');
  if (option !== null) {
    if (!ALL_OPTIONS.includes(option)) return refuse('invalid', 'That is not a thing that can be done about such a matter.');
    const kind = decision && decision !== 'custom' ? decision : def && def.decision !== 'custom' ? def.decision : null;
    if (kind && !DECISION_OPTIONS[kind].includes(option)) return refuse('invalid', 'That is not a thing that can be done about such a matter.');
    if (!kind && def && !def.outcomes.some(x => x.option === option)) return refuse('invalid', 'That is not among the remedies for it.');
  }
  if (outcomeId !== null && !(def && def.outcomes.some(x => x.id === outcomeId))) return refuse('invalid', 'That is not among the remedies for it.');

  const rawWhen = Array.isArray(o.when) ? o.when : [];
  if (rawWhen.length > TUNE.maxConditions) return refuse('invalid', 'That order has more conditions than anyone will remember. Say it more simply.');
  const when: Condition[] = [];
  for (const raw of rawWhen) {
    const c = cleanCondition(raw);
    if (!c) return refuse('invalid', 'The court cannot judge by that. Name a season, a trade, a sum, a kind of tenant.');
    when.push(c);
  }

  const order: StandingOrder = {
    id: '', to: o.to, text, gist, decision, incidentDef, when, rule: o.rule, option, outcomeId, createdDay: s.day, uses: 0,
  };
  const key = (x: StandingOrder) => JSON.stringify([x.to, x.decision, x.incidentDef, x.rule, x.option, x.outcomeId, x.when]);
  const twin = s.orders.find(x => key(x) === key(order));
  if (twin) return { ok: true, id: twin.id };                         // it already stands; saying it twice changes nothing
  if (s.orders.length >= TUNE.maxOrders) return refuse('blocked', `The book of standing orders is full at ${TUNE.maxOrders}, ${title}. Revoke one first.`);
  order.id = newId(s, 'o');
  s.orders.push(order);
  emit(s, { type: 'order_added', orderId: order.id });
  const whom = order.to === 'all' ? 'the household' : `the ${ROLE_TITLES[order.to]}`;
  herald(s, 'staff', `Standing order for ${whom}: "${short(gist, 96)}"`);
  resettleOpen(s);                                                    // it applies to what is already on the table
  return { ok: true, id: order.id };
}

function revokeOrder(s: GameState, a: ActionOf<'revoke_order'>): ActionResult {
  const i = s.orders.findIndex(o => o.id === a.orderId);
  if (i < 0) return refuse('not_found', 'No such order stands.');
  const [o] = s.orders.splice(i, 1);
  emit(s, { type: 'order_revoked', orderId: a.orderId });
  if (o) {
    herald(s, 'staff', `Standing order revoked: "${short(o.gist || o.text, 96)}"`);
    // an order they had been working to, struck out: they will wonder what else was a passing fancy
    if (o.uses > 0 && o.to !== 'all') changeLoyalty(s, o.to, -1);
  }
  return { ok: true };
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

function setPolicy(s: GameState, a: ActionOf<'set_policy'>): ActionResult {
  const p = a.policy as Partial<Record<keyof Policies, unknown>> | undefined;
  if (!p || typeof p !== 'object') return refuse('invalid', 'No such policy is known to the court.');
  const cur = s.policies;
  const said: string[] = [];
  let known = false;
  const num = (v: unknown, lo: number, hi: number, step = 1): number | null => {
    const n = Number(v);
    if (v === null || v === '' || typeof v === 'boolean' || !Number.isFinite(n)) return null;
    return clamp(Math.round(n / step) * step, lo, hi);
  };
  if (p.graceDays !== undefined) {
    const n = num(p.graceDays, TUNE.grace[0]!, TUNE.grace[1]!);
    if (n !== null) { known = true; if (n !== cur.graceDays) { cur.graceDays = n; said.push(n === 0 ? 'no days of grace at all' : `${plural(n, 'day')} of grace`); } }
  }
  if (p.lateFeePct !== undefined) {
    const n = num(p.lateFeePct, TUNE.lateFee[0]!, TUNE.lateFee[1]!);
    if (n !== null) { known = true; if (n !== cur.lateFeePct) { cur.lateFeePct = n; said.push(n === 0 ? 'no late fee' : `a late fee of ${n} in the hundred`); } }
  }
  if (p.depositMonths !== undefined) {
    const n = num(p.depositMonths, TUNE.deposit[0]!, TUNE.deposit[1]!, 0.5);
    if (n !== null) { known = true; if (n !== cur.depositMonths) { cur.depositMonths = n; said.push(n === 0 ? 'no surety asked' : `a surety of ${n === 1 ? "one month's" : n + " months'"} rent`); } }
  }
  if (p.askPct !== undefined) {
    const n = num(p.askPct, TUNE.ask[0]!, TUNE.ask[1]!);
    if (n !== null) { known = true; if (n !== cur.askPct) { cur.askPct = n; said.push(`vacancies priced at ${n} in the hundred of the market`); } }
  }
  if (p.renewalCapPct !== undefined) {
    const n = num(p.renewalCapPct, TUNE.renewalCap[0]!, TUNE.renewalCap[1]!);
    if (n !== null) { known = true; if (n !== cur.renewalCapPct) { cur.renewalCapPct = n; said.push(n === 0 ? 'no rises at renewal' : `rises at renewal capped at ${n} in the hundred`); } }
  }
  if (p.pets !== undefined) {
    if (p.pets === 'allow' || p.pets === 'pet_rent' || p.pets === 'ban') {
      known = true;
      if (p.pets !== cur.pets) { cur.pets = p.pets; said.push(p.pets === 'allow' ? 'animals welcome' : p.pets === 'ban' ? 'no animals' : 'animals to pay pet rent'); }
    }
  }
  if (p.screening !== undefined) {
    if (p.screening === 'always' || p.screening === 'never') {
      known = true;
      if (p.screening !== cur.screening) { cur.screening = p.screening; said.push(p.screening === 'always' ? "every applicant's last landlord to be asked" : 'applicants taken at their word'); }
    }
  }
  if (!known) return refuse('invalid', 'No such policy is known to the court.');
  if (said.length) {
    herald(s, 'info', short(`Let it be known in ${s.realm.name || 'the realm'}: ${said.join('; ')}.`, 150));
    resettleOpen(s);
  }
  return { ok: true };
}

// ───────────── the module ─────────────

export const ordersModule: SimModule = {
  name: 'orders',
  /** Each morning the household goes through what is still open: coffers refill, authority grows. */
  onDay(s) { resettleOpen(s); },
  handlers: { add_order: addOrder, revoke_order: revokeOrder, set_policy: setPolicy },
};
