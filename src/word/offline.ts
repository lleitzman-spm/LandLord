/**
 * The Word, with no one at court to interpret free speech.
 *
 * A pattern parser for plain commands ("mend the Leaning Hovel", "collect the
 * rents", "Agnes, never evict a widow in winter"), fuzzy matching of building
 * and household names, and read-backs drawn from the listener's temperament
 * (`acks` / `grumbles`) with the order restated.
 *
 * This file is also the word layer's shared knowledge of the court: who
 * handles what, how an Action reads aloud, which actions are weighty. The
 * model path (interpret.ts, prompts.ts, digest.ts) leans on the same helpers
 * so that both paths behave alike.
 *
 * Nothing here mutates GameState. It only reads it and proposes Actions.
 */
import {
  DECISION_OPTIONS,
  type Action, type GameState, type StaffRole, type Building, type Tenant, type StaffMember,
  type Applicant, type Candidate, type Incident, type DecisionType, type DecisionOption,
  type Condition, type Policies, type OathKind, type Id, type StandingOrder, type Oath, type Season,
} from '../sim/types';
import {
  BUILDINGS, TEMPERAMENT_DEFS, INCIDENT_BY_ID, TRADE_DEFS, BAL, RANKS, CHARACTERS, MONTH_NAMES,
  TRADES, BUILDING_TYPES, ROLE_TITLES,
} from '../data';
import type { BuildingType, Species, TenantTag, TemperamentId } from '../data/ids';
import type { IncidentDef, OutcomeDef, TemperamentDef } from '../data/schema';
import { fmtDate, dateOf } from '../sim/core';
import type { SpeakTarget, Mood } from './api';

// ───────────────────────── the court: shared lookups ─────────────────────────

/** How people address the ruler at this rank: "Reeve", "Sir", "my lord". */
export function titleOf(s: GameState): string { return RANKS[s.realm.rank]?.address ?? 'my lord'; }

export function staffByRole(s: GameState, role: StaffRole): StaffMember | null {
  for (const m of Object.values(s.staff)) if (m.role === role) return m;
  return null;
}
export function temperamentOf(m: StaffMember | null): TemperamentDef | null {
  return m ? TEMPERAMENT_DEFS[m.temperament] ?? null : null;
}
export function defOf(inc: Incident): IncidentDef | null { return INCIDENT_BY_ID[inc.defId] ?? null; }
export function openIncidents(s: GameState): Incident[] {
  return Object.values(s.incidents).filter(i => i.state === 'open');
}
export function housedTenants(s: GameState): Tenant[] {
  return Object.values(s.tenants).filter(t => t.status === 'housed');
}
export function tenantsIn(s: GameState, b: Building): Tenant[] {
  const out: Tenant[] = [];
  for (const u of b.units) { const t = u.tenantId ? s.tenants[u.tenantId] : null; if (t) out.push(t); }
  return out;
}
export function isLeasable(b: Building): boolean { return b.units.length > 0; }

/** Whose trade a decision belongs to. */
export const DECISION_ROLE: Record<DecisionType, StaffRole | null> = {
  custom: null, late_rent: 'bailiff', eviction_ready: 'bailiff', squatters: 'bailiff', repair: 'mason',
  applicant: 'crier', move_out_deposit: 'steward', pet: 'steward', rent_renewal: 'steward',
};

/** Used only when a temperament's own `bias` says nothing about a decision. Mirrors docs/STYLE.md. */
const FALLBACK_BIAS: Partial<Record<TemperamentId, Partial<Record<DecisionType, DecisionOption[]>>>> = {
  perfectionist: { repair: ['fix'] }, bodger: { repair: ['patch', 'fix'] }, dreamer: { repair: ['fix'] }, steady: { repair: ['fix'] },
  iron: { late_rent: ['notice', 'late_fee'], eviction_ready: ['evict'], squatters: ['oust'] },
  soft: { late_rent: ['payment_plan', 'wait', 'forgive'], eviction_ready: ['mercy', 'cash_for_keys'], squatters: ['lease', 'bribe'] },
  grasping: { late_rent: ['late_fee', 'notice'], eviction_ready: ['evict'], squatters: ['oust'] },
  lawful: { late_rent: ['late_fee', 'notice'], eviction_ready: ['evict'], squatters: ['oust'] },
  honeytongue: { applicant: ['accept'] }, honest: { applicant: ['screen', 'accept'] }, snob: { applicant: ['screen', 'reject'] }, bellower: { applicant: ['accept'] },
  pennypincher: { move_out_deposit: ['fair', 'keep_all'], pet: ['pet_rent'], rent_renewal: ['raise', 'hold'], late_rent: ['late_fee'] },
  openhanded: { move_out_deposit: ['return_all'], pet: ['allow'], rent_renewal: ['hold'], late_rent: ['wait'] },
  bythebook: { move_out_deposit: ['fair'], pet: ['pet_rent'], rent_renewal: ['hold'], late_rent: ['late_fee'] },
  schemer: { move_out_deposit: ['fair'], pet: ['pet_rent'], rent_renewal: ['raise'], late_rent: ['payment_plan'] },
};

/** A delegate's ordered preference for a decision, from their temperament. Empty when there is no one to lean. */
export function leaning(s: GameState, role: StaffRole | null, decision: DecisionType): DecisionOption[] {
  if (!role) return [];
  const m = staffByRole(s, role);
  if (!m) return [];
  const own = temperamentOf(m)?.bias?.[decision];
  if (own && own.length) return own;
  return FALLBACK_BIAS[m.temperament]?.[decision] ?? [];
}

/** Stable pick: the same seed always yields the same line. */
export function pickStable<T>(arr: readonly T[], seed: string): T {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return arr[(h >>> 0) % arr.length]!;
}

let plainNames: Set<string> | null = null;
/**
 * A building's name for use inside a sentence: "The Leaning Hovel" → "the
 * Leaning Hovel", and one that still carries its pattern-book name gets its
 * article ("Well" → "the Well", "Statue of Yourself" → "the Statue of Yourself").
 */
export function mid(name: string): string {
  if (!plainNames) plainNames = new Set(Object.values(BUILDINGS).flatMap(d => [d.name, ...(d.levelNames ?? [])]));
  return plainNames.has(name) && !/^(The|A|An)\s/.test(name) ? `the ${name}` : name.replace(/^The\s/, 'the ');
}
function cap(text: string): string { return text ? text[0]!.toUpperCase() + text.slice(1) : text; }
function lower1(text: string): string { return text ? text[0]!.toLowerCase() + text.slice(1) : text; }
function plural(n: number, one: string, many = one + 's'): string { return n === 1 ? `1 ${one}` : `${n} ${many}`; }
function listNames(names: string[], conj = 'or'): string {
  const u = [...new Set(names)];
  if (u.length <= 1) return u[0] ?? '';
  const head = u.slice(0, Math.min(u.length, 4) - 1), last = u[Math.min(u.length, 4) - 1]!;
  return `${head.join(', ')} ${conj} ${last}`;
}
function spoken(id: string): string { return id.replace(/_/g, ' '); }

/** Player-facing text hygiene: no dashes, no line breaks, tidy spaces. */
export function tidy(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ', ').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1').replace(/,\s*,/g, ',').replace(/\.{2}(?!\.)/g, '.').replace(/([!?])\./g, '$1').trim();
}

/** Fit `text` in `max` characters, cutting at a sentence end when one exists, else at a word. */
export function clip(text: string, max: number): string {
  const t = tidy(text);
  if (t.length <= max) return t;
  const head = t.slice(0, max);
  const stop = Math.max(head.lastIndexOf('. '), head.lastIndexOf('? '), head.lastIndexOf('! '));
  if (stop >= max * 0.45) return head.slice(0, stop + 1);
  const sp = head.lastIndexOf(' ');
  return (sp > 0 ? head.slice(0, sp) : head).replace(/[,;:]$/, '') + '.';
}

// ───────────────────────── saying an Action aloud ─────────────────────────

const TAG_NOUN: Record<TenantTag, string> = {
  widow: 'a widow', elder: 'an elder', veteran: 'a veteran', newlyweds: 'newlywed', large_family: 'a large family',
  scholar: 'a scholar', noble_born: 'noble born', stranger: 'a stranger', apprentice: 'an apprentice', pilgrim: 'a pilgrim',
};
const OP_WORD: Record<string, string> = { '<': 'under', '<=': 'at most', '>': 'over', '>=': 'at least', '==': 'exactly', '!=': 'not' };
const an = (w: string) => (/^[aeiou]/i.test(w) ? 'an ' : 'a ') + w;

/** One condition of a standing order in plain words: "the tenant is a widow", "it is winter". */
export function describeCondition(c: Condition, s: GameState): string {
  const v = c.value, neg = c.op === '!=' || c.op === 'excludes';
  const cmp = `${OP_WORD[c.op] ?? ''} ${v}`.trim();
  switch (c.field) {
    case 'season': return `it is ${neg ? 'not ' : ''}${v}`;
    case 'month': return `it is ${neg ? 'not ' : ''}${typeof v === 'number' ? MONTH_NAMES[v] ?? v : v}`;
    case 'gold': return `the coffers hold ${cmp} crowns`;
    case 'renown': return `renown stands ${cmp}`;
    case 'cost': return `the cost is ${cmp} crowns`;
    case 'tenant.species': return `the tenant is ${neg ? 'not ' : ''}${an(String(v))}`;
    case 'tenant.trade': return `the tenant is ${neg ? 'not ' : ''}${an(spoken(String(v)))}`;
    case 'tenant.tags': return `the tenant is ${neg ? 'not ' : ''}${TAG_NOUN[v as TenantTag] ?? spoken(String(v))}`;
    case 'tenant.traits': return `the tenant is ${neg ? 'not ' : ''}known to be ${spoken(String(v))}`;
    case 'tenant.monthsHoused': return `they have been housed ${cmp} months`;
    case 'tenant.daysLate': return `they are ${cmp} days late`;
    case 'tenant.arrears': return `they owe ${cmp} crowns`;
    case 'tenant.happiness': return `their contentment is ${cmp}`;
    case 'tenant.household': return `the household numbers ${cmp}`;
    case 'tenant.hasPets': return (v === true) !== neg ? 'they keep animals' : 'they keep no animals';
    case 'tenant.name': return `the tenant is ${neg ? 'not ' : ''}${v}`;
    case 'building.type': return `the building is ${neg ? 'not ' : ''}${an(spoken(String(v)))}`;
    case 'building.condition': return `its condition is ${cmp}`;
    case 'building.id': return `it is ${neg ? 'not ' : ''}at ${mid(s.buildings[String(v)]?.name ?? String(v))}`;
    case 'building.rent': return `its rent is ${cmp} crowns`;
    default: return '';
  }
}

const OPTION_PHRASE: Record<DecisionOption, string> = {
  wait: 'give late payers a week', late_fee: 'charge the late fee', payment_plan: 'offer a payment plan', forgive: 'forgive the debt',
  notice: 'serve Notice to Quit', cash_for_keys: 'offer coin for keys', evict: 'evict', mercy: 'tear up the writ',
  fix: 'mend properly', patch: 'patch on the cheap', defer: 'put repairs off', bill_tenant: 'bill the tenant for repairs',
  accept: 'welcome applicants', reject: 'turn applicants away', screen: 'ask after applicants first', counter: 'ask applicants for more',
  return_all: 'return the surety whole', fair: 'keep only the cost of damage', keep_all: 'keep the whole surety',
  oust: 'oust squatters', bribe: 'pay squatters to go', lease: 'offer squatters a lease', ignore: 'leave squatters be',
  allow: 'allow the animal', pet_rent: 'charge pet rent', ban: 'send the animal away',
  hold: 'renew at the same rent', raise: 'raise the rent at renewal', lower: 'lower the rent at renewal',
};

/** A plain-words gist for a standing order (used when no one supplied a better one). */
export function orderGist(o: Pick<StandingOrder, 'rule' | 'decision' | 'option' | 'incidentDef' | 'outcomeId' | 'when'>, s: GameState): string {
  let what = o.option ? OPTION_PHRASE[o.option] : '';
  if (!what && o.incidentDef) {
    const def = INCIDENT_BY_ID[o.incidentDef];
    const out = def?.outcomes.find(x => x.id === o.outcomeId);
    what = out ? `${lower1(out.label)} (${def!.title})` : 'do that';
  }
  let when = o.when.map(c => describeCondition(c, s)).filter(Boolean);
  if (o.decision === 'applicant') when = when.map(w => w.replace(/^the tenant\b/, 'the applicant'));
  return clip(`${o.rule === 'never' ? 'Never' : 'Always'} ${what || 'do that'}${when.length ? ' when ' + when.join(' and ') : ''}.`, 120);
}

function policyPhrases(p: Partial<Policies>): string[] {
  const out: string[] = [];
  if (p.graceDays !== undefined) out.push(p.graceDays === 0 ? 'No grace days' : `Grace: ${plural(p.graceDays, 'day')}`);
  if (p.lateFeePct !== undefined) out.push(p.lateFeePct === 0 ? 'No late fee' : `Late fee: ${p.lateFeePct} percent of the rent`);
  if (p.depositMonths !== undefined) out.push(p.depositMonths === 0 ? 'No surety asked' : `Surety: ${p.depositMonths === 1 ? "one month's" : p.depositMonths + " months'"} rent`);
  if (p.askPct !== undefined) out.push(`Vacancies priced at ${p.askPct} percent of market`);
  if (p.renewalCapPct !== undefined) out.push(`Rises at renewal capped at ${p.renewalCapPct} percent`);
  if (p.pets !== undefined) out.push(p.pets === 'ban' ? 'No animals' : p.pets === 'allow' ? 'Animals allowed, no charge' : 'Animals allowed, at pet rent');
  if (p.screening !== undefined) out.push(p.screening === 'always' ? 'Every applicant asked after with their last landlord' : 'No asking after applicants');
  return out;
}

/** A short restatement of one Action, capitalised, with no final stop: "Mend the Leaning Hovel". */
export function describeAction(a: Action, s: GameState): string {
  const bn = (id?: Id) => mid((id && s.buildings[id]?.name) || 'that house');
  const tn = (id?: Id) => (id && s.tenants[id]?.name) || 'that household';
  switch (a.type) {
    case 'order_job': {
      const ap = a.applicantId ? s.applicants[a.applicantId] : null;
      const home = a.tenantId ? s.tenants[a.tenantId]?.buildingId ?? undefined : undefined;
      switch (a.kind) {
        case 'repair': return `Mend ${bn(a.buildingId)}`;
        case 'renovate': return `Restore ${bn(a.buildingId)} from the ground up`;
        case 'show': return `Show ${ap?.household.name ?? 'the applicant'} round ${bn(a.buildingId ?? ap?.buildingId)}`;
        case 'screen': return `Ask after ${ap?.household.name ?? tn(a.tenantId)} with their last landlord`;
        case 'serve_notice': return `Notice to Quit on the door of ${tn(a.tenantId)}`;
        case 'evict': return `Put ${tn(a.tenantId)} out of ${bn(a.buildingId ?? home)}`;
        case 'inspect': return `Look over ${bn(a.buildingId)}`;
        case 'visit': return `A call on ${tn(a.tenantId)}`;
        default: return `${cap(spoken(a.kind))} at ${bn(a.buildingId)}`;
      }
    }
    case 'resolve_incident': {
      const inc = s.incidents[a.incidentId];
      const def = inc ? defOf(inc) : null;
      const out = def?.outcomes.find(o => o.id === a.outcomeId);
      if (!inc || !def || !out) return 'Settle that matter';
      const place = inc.buildingId && s.buildings[inc.buildingId] ? mid(s.buildings[inc.buildingId]!.name) : '';
      const person = (inc.applicantId ? s.applicants[inc.applicantId]?.household.name : undefined) ?? (inc.tenantId ? s.tenants[inc.tenantId]?.name : undefined) ?? '';
      const aboutPlace = def.decision === 'repair' || def.decision === 'squatters' || (def.target !== 'tenant' && !inc.applicantId) || !person;
      if (aboutPlace && place) return `${out.label}, at ${place}`;
      return person ? `${out.label}: ${person}` : out.label;
    }
    case 'set_rent': {
      const b = s.buildings[a.buildingId];
      const dir = b && a.rent !== b.rent ? `, ${a.rent > b.rent ? 'up' : 'down'} from ${b.rent}` : '';
      return `Asking rent at ${bn(a.buildingId)}: ${plural(a.rent, 'crown')}${dir}`;
    }
    case 'set_listed': return a.listed ? `Cry ${bn(a.buildingId)} as to let` : `Take ${bn(a.buildingId)} off the board`;
    case 'collect_all': return 'Collect every purse';
    case 'collect_purse': return `Collect the purse at ${bn(a.buildingId)}`;
    case 'add_order': return `Standing order: ${lower1(a.order.gist || orderGist(a.order, s)).replace(/[.!?]+$/, '')}`;
    case 'revoke_order': { const o = s.orders.find(x => x.id === a.orderId); return `Strike the standing order "${(o?.gist || o?.text || 'that one').replace(/[.!?]+$/, '')}"`; }
    case 'set_policy': return policyPhrases(a.policy).map((x, i) => (i ? lower1(x) : x)).join('; ') || 'No change to policy';
    case 'swear_oath': {
      const o = a.oath, by = `by the ${fmtDate(o.dueDay)}`, till = `until the ${fmtDate(o.dueDay)}`;
      const to = o.toName && o.toName !== 'the realm' ? ` to ${o.toName}` : '';
      switch (o.kind) {
        case 'repair': return `Sworn${to}: ${bn(o.buildingId ?? undefined)} mended ${by}`;
        case 'no_rent_raise': return `Sworn${to}: no rise in rent ${till}`;
        case 'no_evict': return `Sworn${to}: no notice and no eviction ${till}`;
        case 'build': return `Sworn${to}: ${an(spoken(o.buildingType ?? 'building'))} built ${by}`;
        case 'pay': return `Sworn${to}: ${plural(o.amount ?? 0, 'crown')} paid ${by}`;
        case 'rent_cap': return `Sworn${to}: rent at or under ${o.amount ?? 0} ${till}`;
        default: return `Sworn${to}: "${clip(o.text, 80).replace(/[.!?]+$/, '')}", ${till}`;
      }
    }
    case 'gift': return `${cap(plural(a.amount, 'crown'))} from the coffers to ${tn(a.tenantId)}`;
    case 'hold_feast': return `A feast for the realm, at ${BAL.feastCost[s.realm.rank]} crowns`;
    case 'hire': { const c = s.candidates.find(x => x.id === a.candidateId); return c ? `Send for ${c.name} as ${ROLE_TITLES[c.role]}, at ${c.wage} crowns a month` : 'Send for the new hand'; }
    case 'dismiss_staff': { const m = s.staff[a.staffId]; return m ? `Dismiss ${m.name}, ${ROLE_TITLES[m.role]}` : 'Dismiss them'; }
    case 'set_wage': { const m = s.staff[a.staffId]; return `${m ? m.first + "'s" : 'Their'} wage: ${a.wage} crowns a month${m && m.wage !== a.wage ? `, ${a.wage > m.wage ? 'up' : 'down'} from ${m.wage}` : ''}`; }
    case 'rename_building': return `${cap(bn(a.buildingId))} is to be called ${a.name}`;
    default: return cap(spoken(a.type));
  }
}

/** Whose trade an Action is, for choosing who reads it back. Null: the ruler's own business. */
export function domainRole(a: Action, s: GameState): StaffRole | null {
  switch (a.type) {
    case 'order_job':
      if (a.role && a.role !== 'ruler' && a.role !== 'any') return a.role;
      return a.kind === 'repair' || a.kind === 'renovate' || a.kind === 'inspect' ? 'mason'
        : a.kind === 'serve_notice' || a.kind === 'evict' ? 'bailiff'
        : a.kind === 'show' ? 'crier' : a.kind === 'screen' ? 'steward' : null;
    case 'resolve_incident': {
      const inc = s.incidents[a.incidentId]; const def = inc ? defOf(inc) : null;
      if (!def) return null;
      const r = DECISION_ROLE[def.decision];
      if (r) return r;
      const j = def.outcomes.find(o => o.id === a.outcomeId)?.job?.role;
      return j && j !== 'ruler' && j !== 'any' ? j : null;
    }
    case 'collect_all': case 'collect_purse': return 'bailiff';
    case 'set_listed': return 'crier';
    case 'set_rent': case 'set_policy': case 'gift': case 'hold_feast': case 'hire': case 'dismiss_staff': case 'set_wage': return 'steward';
    case 'add_order': return a.order.to === 'all' ? null : a.order.to;
    case 'revoke_order': { const o = s.orders.find(x => x.id === a.orderId); return o && o.to !== 'all' ? o.to : null; }
    default: return null;
  }
}

// ───────────────────────── weight: what waits for the ruler's "aye" ─────────────────────────

function oathsBarring(s: GameState, tenantId: Id | null | undefined, kinds: OathKind[]): Oath | null {
  if (!tenantId) return null;
  return s.oaths.find(o => o.state === 'open' && o.toTenantId === tenantId && kinds.includes(o.kind)) ?? null;
}

/** Crowns an Action will plainly cost, as far as the word layer can know. */
export function costOf(a: Action, s: GameState): number {
  switch (a.type) {
    case 'gift': return a.amount;
    case 'hold_feast': return BAL.feastCost[s.realm.rank] ?? 0;
    case 'resolve_incident': {
      const inc = s.incidents[a.incidentId]; const out = inc ? defOf(inc)?.outcomes.find(o => o.id === a.outcomeId) : null;
      if (!out) return 0;
      let c = out.job?.cost ?? 0;
      for (const e of out.effects) if (e.t === 'gold' && e.amount < 0) c += -e.amount;
      return c;
    }
    case 'order_job': {
      const b = a.buildingId ? s.buildings[a.buildingId] : null;
      return a.kind === 'renovate' && b ? Math.round(BUILDINGS[b.type].cost * 0.4) : 0;
    }
    default: return 0;
  }
}

export interface Weight { confirm: boolean; warnings: string[]; oaths: Oath[] }

/** What the listener says when an order runs against the ruler's own oath. */
export function oathWarning(o: Oath, short = false): string {
  return short ? `Mind your oath to ${o.toName}.` : `You swore otherwise to ${o.toName}: "${clip(o.text, 90)}"`;
}

/**
 * Is this weighty enough to wait for the ruler's assent? Standing orders,
 * evictions and notices, dismissals, spending over a tenth of the coffers, and
 * anything that would break an open oath. The model may ask for confirmation
 * too; it can never waive this.
 */
export function weigh(actions: Action[], s: GameState): Weight {
  let confirm = false;
  const oaths: Oath[] = [];
  let spend = 0;
  const warn = (o: Oath | null) => {
    if (!o) return;
    confirm = true;
    if (!oaths.includes(o)) oaths.push(o);
  };
  for (const a of actions) {
    spend += costOf(a, s);
    switch (a.type) {
      case 'add_order': case 'dismiss_staff': confirm = true; break;
      case 'order_job':
        if (a.kind === 'evict' || a.kind === 'serve_notice') {
          confirm = true;
          warn(oathsBarring(s, a.tenantId, ['no_evict']));
        }
        break;
      case 'resolve_incident': {
        const inc = s.incidents[a.incidentId]; const out = inc ? defOf(inc)?.outcomes.find(o => o.id === a.outcomeId) : null;
        if (!inc || !out) break;
        const harsh = out.option === 'evict' || out.option === 'notice' || out.effects.some(e => e.t === 'evict' || (e.t === 'late' && (e.option === 'notice' || e.option === 'evict')));
        if (harsh) { confirm = true; warn(oathsBarring(s, inc.tenantId, ['no_evict'])); }
        if (out.option === 'raise' || out.option === 'counter' || out.effects.some(e => e.t === 'rent' && e.pct > 0)) {
          if (inc.tenantId && s.tenants[inc.tenantId]?.status === 'housed') warn(oathsBarring(s, inc.tenantId, ['no_rent_raise', 'rent_cap']));
        }
        break;
      }
      case 'set_rent': {
        const b = s.buildings[a.buildingId];
        if (!b) break;
        for (const t of tenantsIn(s, b)) {
          const lease = t.lease?.rent ?? b.rent;
          if (a.rent <= lease) continue;
          const o = s.oaths.find(x => x.state === 'open' && x.toTenantId === t.id && (x.kind === 'no_rent_raise' || (x.kind === 'rent_cap' && a.rent > (x.amount ?? Infinity))));
          warn(o ?? null);
        }
        break;
      }
      default: break;
    }
  }
  if (spend > Math.max(10, Math.max(0, s.gold) / 10)) confirm = true;
  return { confirm, warnings: oaths.map(o => oathWarning(o)), oaths };
}

// ───────────────────────── words: normalising, numbers ─────────────────────────

/** Tables keyed by what the ruler said carry no inherited keys ("constructor" is a word). */
const table = <T>(o: Record<string, T>): Record<string, T> => Object.assign(Object.create(null) as Record<string, T>, o);
const SMALL = table<number>({
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
});
const FRACTION = table<number>({ tenth: 10, fifth: 20, quarter: 25, third: 33 });
const UNIT_RX = /^(crowns?|coins?|gold|days?|weeks?|months?|years?|percent|hundred|thousand|households?)$/;
const ABBREV = new Set(['st', 'mr', 'mrs', 'dr']);

interface Prep { words: string[]; toks: string[]; ends: boolean[] }

/** Raw speech → aligned raw words and lowercase tokens (one token per word), plus sentence-end marks. */
export function prep(raw: string): Prep {
  const text = raw.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/(\d),(\d{3})\b/g, '$1$2')
    .replace(/(\d)\s*%/g, '$1 percent').replace(/per cent/gi, 'percent').replace(/[—–/]/g, ' ').replace(/(\D)-(\D)/g, '$1 $2');
  const words: string[] = [], toks: string[] = [], ends: boolean[] = [];
  for (const w of text.split(/\s+/)) {
    let t = w.toLowerCase().replace(/'s\b/g, '').replace(/s'(?=\W|$)/g, 's');
    t = t.replace(/[^a-z0-9.]/g, '').replace(/^\.+|\.+$/g, '');
    if (!/\d\.\d/.test(t)) t = t.replace(/\./g, '');
    if (!t) { if (ends.length && /[.;!?]/.test(w)) ends[ends.length - 1] = true; continue; }
    words.push(w); toks.push(t);
    ends.push(/[.;!?:]["')]*$/.test(w) && !ABBREV.has(t));
  }
  return { words, toks, ends };
}

/** Tokens → one string with number words as digits ("twenty five" → "25", "a tenth" → "10 percent"). */
export function numberize(toks: string[]): string {
  const out: string[] = [];
  let fromWord = false;
  const lastNum = () => { const l = out[out.length - 1]; return l !== undefined && /^\d+$/.test(l) ? Number(l) : null; };
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]!, next = toks[i + 1] ?? '', prev = toks[i - 1] ?? '';
    if (t === 'half') {
      if ((next === 'a' || next === 'an') && /^(month|year|week|day)s?$/.test(toks[i + 2] ?? '')) { out.push('0.5'); i++; fromWord = false; continue; }
      if (out[out.length - 1] === 'a' || out[out.length - 1] === 'one') out.pop();
      out.push('50', 'percent'); fromWord = false; continue;
    }
    if (FRACTION[t] !== undefined && (prev === 'a' || prev === 'one' || prev === 'by')) {
      if (out[out.length - 1] === 'a' || out[out.length - 1] === '1' || out[out.length - 1] === 'one') out.pop();
      out.push(String(FRACTION[t]), 'percent'); fromWord = false; continue;
    }
    if ((t === 'dozen' || t === 'score' || t === 'couple') && (prev === 'a' || lastNum() !== null)) {
      const unit = t === 'dozen' ? 12 : t === 'score' ? 20 : 2;
      const n = lastNum();
      if (n !== null) out[out.length - 1] = String(n * unit); else { out.pop(); out.push(String(unit)); }
      if (next === 'of') i++;
      fromWord = true; continue;
    }
    if (t === 'hundred' || t === 'thousand') {
      const mult = t === 'hundred' ? 100 : 1000, n = lastNum();
      if (n !== null && n < 100) out[out.length - 1] = String(n * mult);
      else { if (out[out.length - 1] === 'a') out.pop(); out.push(String(mult)); }
      if (next === 'and' && SMALL[toks[i + 2] ?? ''] !== undefined) i++;
      fromWord = true; continue;
    }
    if (SMALL[t] !== undefined && (t !== 'one' || UNIT_RX.test(next) || prev === 'to' || prev === 'by')) {
      const v = SMALL[t]!, n = lastNum();
      if (fromWord && n !== null && ((n >= 20 && n < 100 && n % 10 === 0 && v < 10) || (n >= 100 && n % 100 === 0 && v < 100) || (n >= 100 && n % 10 === 0 && n % 100 !== 0 && v < 10))) out[out.length - 1] = String(n + v);
      else out.push(String(v));
      fromWord = true; continue;
    }
    out.push(t); fromWord = false;
  }
  return out.join(' ');
}

function lev(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v); if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length]!;
}
function stem(t: string): string {
  if (t.length >= 4 && t.endsWith('oes')) return t.slice(0, -2);   // goes, does
  if (t.length > 4 && t.endsWith('ies')) return t.slice(0, -3) + 'y';
  if (t.length > 4 && t.endsWith('ves')) return t.slice(0, -3) + 'f';
  if (t.length > 4 && /(s|x|z|ch|sh)es$/.test(t)) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}
/** 0 no match; otherwise a quality 1..3 (3 exact). `many` when the spoken word was a plural of the alias. */
function tokMatch(text: string, alias: string, fuzzy: boolean): { q: number; many: boolean } | null {
  if (text === alias) return { q: 3, many: false };
  if (stem(text) === stem(alias)) return { q: 2, many: text.length > alias.length };
  if (!fuzzy) return null;
  const n = Math.min(text.length, alias.length);
  if (n >= 5 && text[0] === alias[0] && lev(text, alias, n >= 9 ? 2 : 1) <= (n >= 9 ? 2 : 1)) return { q: 1, many: false };
  return null;
}

// ───────────────────────── the lexicon: who and what can be named ─────────────────────────

interface Alias { toks: string[]; w: 1 | 2 | 3; fuzzy: boolean }
interface Cand<T> { item: T; aliases: Alias[] }
interface Hit<T> { item: T; w: number; at: number; len: number; many: boolean; quality: number; kind: string }

const HONORIFICS = new Set(['old', 'young', 'magister', 'dame', 'sir', 'widow', 'goodwife', 'goodman', 'mother', 'father', 'brother', 'sister', 'master', 'mistress', 'lady', 'lord', 'little', 'big', 'soft', 'mad', 'granny', 'gaffer', 'captain', 'doctor', 'the']);
const GENERIC_NAME = new Set(['the', 'of', 'and', 'a', 'an', 'in', 'at', 'on', 'under', 'hovel', 'cottage', 'hall', 'house', 'tower', 'mill', 'end', 'row', 'new', 'old', 'long', 'late', 'saint', 'manor', 'stall', 'plank', 'yard', 'stand', 'garden', 'shrine', 'board', 'notice', 'statue', 'stocks', 'chapel', 'tavern', 'bakery', 'smithy', 'burrow', 'treehouse', 'townhouse', 'longhouse', 'stone', 'market', 'wizard', 'counting', 'great', 'little', 'upper', 'lower', 'payment', 'three', 'stack', 'cheese']);
/** Names that are also plain words: matched only when written as a name (capitalised, or called out with a comma). */
const COMMON_WORDS = new Set(['will', 'may', 'rose', 'grace', 'hope', 'faith', 'mark', 'bill', 'penny', 'rich', 'pat', 'art', 'dot', 'herb', 'don', 'sue', 'rob', 'bob', 'jack', 'lance', 'miles', 'grub', 'pip', 'nib', 'tom', 'wat', 'tam', 'hob', 'quill', 'pen', 'well', 'moss', 'ash', 'fern', 'reed', 'page', 'earl', 'dean', 'rusty', 'sandy', 'ruin', 'patience', 'prudence', 'mercy', 'charity', 'ern', 'bud', 'peg', 'ned', 'kit']);
const DETERMINERS = new Set(['the', 'that', 'this', 'my', 'our', 'a', 'an', 'every', 'each', 'all', 'both', 'old', 'new', 'any', 'your', 'his', 'her', 'their']);

const TYPE_ALIASES: Partial<Record<BuildingType, string[][]>> = {
  seat: [['seat'], ['manor'], ['hut'], ['great', 'hall']], mill: [['mill'], ['windmill']], stonehall: [['stone', 'hall'], ['stonehall']],
  market_stall: [['market', 'stall'], ['stall']], wizard_tower: [['wizard', 'tower'], ['tower']], notice_board: [['notice', 'board']],
  masons_yard: [['mason', 'yard'], ['masons', 'yard']], bailiffs_post: [['bailiff', 'post'], ['bailiffs', 'post']], criers_stand: [['crier', 'stand'], ['criers', 'stand']],
  counting_house: [['counting', 'house']], tavern: [['tavern'], ['inn'], ['alehouse']], smithy: [['smithy'], ['forge']], chapel: [['chapel'], ['church']],
  shrine: [['shrine']], longhouse: [['longhouse'], ['long', 'house']], townhouse: [['townhouse'], ['town', 'house']], treehouse: [['treehouse'], ['tree', 'house']],
};
function typeAliases(type: BuildingType): string[][] {
  const base = [type.split('_'), toks(BUILDINGS[type].name)];
  const extra = TYPE_ALIASES[type] ?? [];
  const seen = new Set<string>(); const out: string[][] = [];
  for (const a of [...base, ...extra]) { const k = a.join(' '); if (a.length && !seen.has(k)) { seen.add(k); out.push(a); } }
  return out;
}
function toks(text: string): string[] { return prep(text).toks; }
function nameToks(name: string): string[] { const t = toks(name); return t[0] === 'the' && t.length > 1 ? t.slice(1) : t; }

interface Lex {
  buildings: Cand<Building>[]; tenants: Cand<Tenant>[]; staff: Cand<StaffMember>[];
  applicants: Cand<Applicant>[]; candidates: Cand<Candidate>[];
}

function personAliases(name: string, first: string): Alias[] {
  const full = toks(name);
  const out: Alias[] = [{ toks: full, w: 3, fuzzy: true }];
  let bare = full; while (bare.length > 1 && HONORIFICS.has(bare[0]!)) bare = bare.slice(1);
  if (bare.length !== full.length) out.push({ toks: bare, w: 3, fuzzy: true });
  const f = toks(first); if (f.length && f.join(' ') !== full.join(' ')) out.push({ toks: f, w: 2, fuzzy: true });
  const last = bare[bare.length - 1];
  if (bare.length >= 2 && last && last.length >= 4 && !bare.includes('of') && !GENERIC_NAME.has(last)) out.push({ toks: [last], w: 2, fuzzy: true });
  return out;
}
function householdGenerics(h: { species: Species; trade: string; tags: TenantTag[] }): Alias[] {
  const out: Alias[] = [{ toks: h.trade.split('_'), w: 1, fuzzy: false }];
  const tn = toks(TRADE_DEFS[h.trade as keyof typeof TRADE_DEFS]?.name ?? '');
  if (tn.length && tn.join(' ') !== h.trade.split('_').join(' ')) out.push({ toks: tn, w: 1, fuzzy: false });
  if (h.species !== 'human') out.push({ toks: [h.species], w: 1, fuzzy: false });
  for (const tag of h.tags) out.push({ toks: tag === 'large_family' ? ['large', 'family'] : tag === 'noble_born' ? ['noble'] : [tag], w: 1, fuzzy: false });
  return out;
}

function buildLex(s: GameState): Lex {
  const bs = Object.values(s.buildings);
  const count = new Map<string, number>();
  for (const b of bs) for (const t of new Set(nameToks(b.name))) count.set(t, (count.get(t) ?? 0) + 1);
  const buildings: Cand<Building>[] = bs.map(b => {
    const full = nameToks(b.name);
    const types = typeAliases(b.type);
    const plain = types.some(a => a.join(' ') === full.join(' '));   // the name is just "Well", "Bakery"
    const aliases: Alias[] = [];
    if (!plain && full.length) {
      aliases.push({ toks: full, w: 3, fuzzy: true });
      if (full.length >= 2) for (const t of full) if (t.length >= 5 && !GENERIC_NAME.has(t) && count.get(t) === 1) aliases.push({ toks: [t], w: 2, fuzzy: true });
    }
    for (const a of types) aliases.push({ toks: a, w: 1, fuzzy: false });
    return { item: b, aliases };
  });
  const withMatter = new Set<Id>();
  for (const i of openIncidents(s)) if (i.tenantId) withMatter.add(i.tenantId);
  const tenants: Cand<Tenant>[] = Object.values(s.tenants).filter(t => t.status === 'housed' || withMatter.has(t.id))
    .map(t => ({ item: t, aliases: [...personAliases(t.name, t.first), ...householdGenerics(t)] }));
  const staff: Cand<StaffMember>[] = Object.values(s.staff).map(m => ({ item: m, aliases: [...personAliases(m.name, m.first), { toks: [m.role], w: 1 as const, fuzzy: false }] }));
  const applicants: Cand<Applicant>[] = Object.values(s.applicants).map(a => ({
    item: a, aliases: [...personAliases(a.household.name, a.household.first), { toks: ['applicant'], w: 1 as const, fuzzy: false }, ...householdGenerics(a.household)],
  }));
  const candidates: Cand<Candidate>[] = s.candidates.map(c => ({ item: c, aliases: [...personAliases(c.name, c.first), { toks: [c.role], w: 1 as const, fuzzy: false }] }));
  return { buildings, tenants, staff, applicants, candidates };
}

function scan<T>(p: Prep, cands: Cand<T>[], kind: string, asName = false): Hit<T>[] {
  const hits: Hit<T>[] = [];
  for (const c of cands) {
    let best: Hit<T> | null = null;
    for (const al of c.aliases) {
      const n = al.toks.length;
      for (let i = 0; i + n <= p.toks.length; i++) {
        let q = 0, many = false, ok = true;
        for (let k = 0; k < n; k++) {
          const e = tokMatch(p.toks[i + k]!, al.toks[k]!, al.fuzzy);
          if (!e) { ok = false; break; }
          q += e.q; if (e.many) many = true;
        }
        if (!ok) continue;
        if (n === 1) {
          const tok = al.toks[0]!, word = p.words[i] ?? '';
          // a name that is also a plain word must look like a name
          if (!asName && al.w >= 2 && (COMMON_WORDS.has(tok) || tok.length <= 2)) {
            const named = /^[^a-zA-Z]*[A-Z]/.test(word);
            const called = i === 0 && /,$/.test(word);
            const afterVerb = i > 0 && !DETERMINERS.has(p.toks[i - 1]!) && tok.length >= 3 && !['will', 'may', 'well', 'grace', 'mark', 'bill', 'hope', 'page', 'mercy', 'charity', 'patience', 'ruin', 'pen'].includes(tok);
            const itsName = al.w === 3 && kind === 'b' && p.toks[i - 1] === 'the';   // a house called "The Ruin", said as "the ruin"
            if (!((named && i > 0) || called || afterVerb || itsName)) continue;
          }
          if (al.w === 1 && tok === 'well' && !['the', 'that', 'this', 'my', 'our', 'a'].includes(p.toks[i - 1] ?? '')) continue;
        }
        const h: Hit<T> = { item: c.item, w: al.w, at: i, len: n, many, quality: al.w * 100 + n * 10 + q / n, kind };
        if (!best || h.quality > best.quality) best = h;
      }
    }
    if (best) hits.push(best);
  }
  return hits;
}
const overlap = (a: { at: number; len: number }, b: { at: number; len: number }) => a.at < b.at + b.len && b.at < a.at + a.len;

/** Everything nameable that `text` mentions (used by the digest to decide what the model must see in full). */
export function mentioned(s: GameState, text: string): { buildings: Id[]; tenants: Id[]; staff: Id[]; applicants: Id[]; candidates: Id[] } {
  const lex = buildLex(s), p = prep(text);
  const strong = <T extends { id: Id }>(c: Cand<T>[], k: string) => scan(p, c, k).filter(h => h.w >= 2 || !h.many).sort((a, b) => b.quality - a.quality).slice(0, 8).map(h => h.item.id);
  return {
    buildings: strong(lex.buildings, 'b'), tenants: strong(lex.tenants, 't'), staff: strong(lex.staff, 's'),
    applicants: strong(lex.applicants, 'a'), candidates: strong(lex.candidates, 'c'),
  };
}

/**
 * Resolve a loose reference to exactly one thing. A model is asked for ids
 * and mostly gives them, but also "#b7", "B7", "b7 (The Leaning Hovel)" or
 * just the name. A name is taken only when it can mean one thing.
 */
export function resolveRef(s: GameState, kind: 'building' | 'tenant' | 'staff' | 'applicant' | 'candidate', ref: unknown): Id | null {
  if (typeof ref === 'number' && isFinite(ref)) ref = String(ref);
  if (typeof ref !== 'string') return null;
  const marked = /^[\s"'`([<]*#/.test(ref);
  const id = ref.trim().replace(/^[\s"'`([<#]+|[\s"'`)\]>.,;:]+$/g, '');
  if (!id || id.length > 80) return null;
  const byId: Record<string, unknown> | null = kind === 'building' ? s.buildings : kind === 'tenant' ? s.tenants : kind === 'staff' ? s.staff : kind === 'applicant' ? s.applicants : null;
  const has = (x: string): boolean => (byId ? Object.prototype.hasOwnProperty.call(byId, x) : s.candidates.some(c => c.id === x));
  if (has(id)) return id;
  const first = id.split(/[\s:,(=]+/)[0] ?? '', lower = first.toLowerCase();
  const loose = /\d/.test(first) && has(lower) ? lower : null;                    // "B7": ids hold a digit far more often than names do
  if (first === id && loose) return loose;
  const lead = first === id ? null : has(first) ? first : loose;                  // "b7 The Leaning Hovel", "t5: Wat Mudge"
  if (marked && lead) return lead;
  if (id.length < 3) return null;
  const lex = buildLex(s), p = prep(id);
  if (!p.toks.length) return lead;
  const pool = kind === 'building' ? lex.buildings : kind === 'tenant' ? lex.tenants : kind === 'staff' ? lex.staff : kind === 'applicant' ? lex.applicants : lex.candidates;
  const hits = scan(p, pool as Cand<{ id: Id }>[], kind, true).sort((a, b) => b.quality - a.quality);
  if (!hits.length) return lead;
  const top = hits.filter(h => h.quality === hits[0]!.quality);
  if (top.length === 1) return top[0]!.item.id;
  return lead && top.some(h => h.item.id === lead) ? lead : null;
}

// ───────────────────────── clauses ─────────────────────────

interface Clause {
  p: Prep;
  /** masked + numberized: proper names replaced by _x_ so that verbs inside names do not fire */
  m: string;
  b: Hit<Building>[]; t: Hit<Tenant>[]; st: Hit<StaffMember>[]; ap: Hit<Applicant>[]; cd: Hit<Candidate>[];
}
interface Cx {
  s: GameState; lex: Lex; target: SpeakTarget; title: string; raw: string;
  focusB: Building | null; focusT: Tenant | null;
  addressed: StaffRole | null; addressedTenant: Tenant | null;
}

function makeClause(p: Prep, cx: Cx): Clause {
  let all: Hit<unknown>[] = [
    ...scan(p, cx.lex.buildings, 'b'), ...scan(p, cx.lex.tenants, 't'), ...scan(p, cx.lex.staff, 's'),
    ...scan(p, cx.lex.applicants, 'a'), ...scan(p, cx.lex.candidates, 'c'),
  ] as Hit<unknown>[];
  all.sort((x, y) => y.quality - x.quality);
  // a weaker reading of words already claimed by a stronger reading of another kind is dropped
  const kept: Hit<unknown>[] = [];
  for (const h of all) if (!kept.some(k => k.kind !== h.kind && overlap(k, h) && k.quality > h.quality + 0.5 && k.w > h.w)) kept.push(h);
  all = kept;
  const masked = p.toks.slice();
  for (const h of all) if (h.w >= 2) for (let i = h.at; i < h.at + h.len; i++) masked[i] = i === h.at ? '_x_' : '';
  const of = <T>(k: string) => all.filter(h => h.kind === k) as Hit<T>[];
  return { p, m: numberize(masked.filter(Boolean)), b: of<Building>('b'), t: of<Tenant>('t'), st: of<StaffMember>('s'), ap: of<Applicant>('a'), cd: of<Candidate>('c') };
}

const VERBS = new Set(['fix', 'mend', 'repair', 'patch', 'rethatch', 'renovate', 'restore', 'rebuild', 'collect', 'gather', 'fetch', 'evict', 'serve', 'nail', 'post', 'raise', 'lower', 'set', 'put', 'drop', 'cut', 'increase', 'reduce', 'list', 'unlist', 'advertise', 'show', 'hire', 'engage', 'dismiss', 'sack', 'hold', 'throw', 'give', 'gift', 'grant', 'pay', 'visit', 'inspect', 'screen', 'check', 'forgive', 'waive', 'charge', 'welcome', 'accept', 'reject', 'turn', 'call', 'name', 'rename', 'revoke', 'cancel', 'strike', 'send', 'make', 'double', 'halve', 'tell', 'have', 'let', 'take', 'ask', 'see', 'deal', 'oust', 'bribe', 'cry', 'look']);

function splitClauses(p: Prep): Prep[] {
  const out: Prep[] = [];
  let cur: Prep = { words: [], toks: [], ends: [] };
  const flush = () => { if (cur.toks.length) out.push(cur); cur = { words: [], toks: [], ends: [] }; };
  for (let i = 0; i < p.toks.length; i++) {
    const t = p.toks[i]!, next = p.toks[i + 1] ?? '';
    if (cur.toks.length && (t === 'then' || t === 'also' || (t === 'and' && (VERBS.has(next) || next === 'then' || next === 'also')))) { flush(); continue; }
    cur.words.push(p.words[i]!); cur.toks.push(t); cur.ends.push(false);
    if (p.ends[i]) flush();
  }
  flush();
  return out;
}

// ───────────────────────── choosing among the named ─────────────────────────

interface Chosen<T> { list: T[]; ask?: string }

function settle<T>(hits: Hit<T>[], p: Prep, o: { focus?: T | null; prefer?: (t: T) => boolean; name: (t: T) => string; where?: (t: T) => string; noun: string; title: string }): Chosen<T> {
  const sorted = hits.slice().sort((a, b) => b.quality - a.quality);
  const kept: Hit<T>[] = [];
  for (const h of sorted) {
    const clash = kept.find(k => overlap(k, h) && (k.w > h.w || k.len > h.len));
    if (!clash) kept.push(h);
  }
  const groups = new Map<string, Hit<T>[]>();
  for (const h of kept) { const k = `${h.at}:${h.len}`; const g = groups.get(k); if (g) g.push(h); else groups.set(k, [h]); }
  const list: T[] = [];
  for (const g of groups.values()) {
    if (g.length === 1) { list.push(g[0]!.item); continue; }
    const before = p.toks[g[0]!.at - 1] ?? '', before2 = p.toks[g[0]!.at - 2] ?? '';
    const every = g.some(h => h.many) || ['every', 'each', 'all', 'both'].includes(before) || ((before === 'the' || before === 'of') && ['all', 'both'].includes(before2));
    if (every) { for (const h of g) list.push(h.item); continue; }
    const focused = o.focus ? g.find(h => h.item === o.focus) : undefined;
    if (focused) { list.push(focused.item); continue; }
    if (o.prefer) { const pf = g.filter(h => o.prefer!(h.item)); if (pf.length === 1) { list.push(pf[0]!.item); continue; } }
    // two of one name are told apart by where they are
    const names = g.map(h => o.name(h.item));
    const told = names.map((n, i) => (names.indexOf(n) !== names.lastIndexOf(n) && o.where ? `${n} ${o.where(g[i]!.item)}` : n));
    return { list: [], ask: `Which ${o.noun}, ${o.title}: ${listNames(told)}?` };
  }
  return { list: [...new Set(list)] };
}

const PRONOUN_PLACE = /\b(it|there|here|this|that|this (one|place|house)|that (one|place|house))\b/;
const PRONOUN_PERSON = /\b(them|him|her|they|he|she|you|your|their|his)\b/;
const EVERY = /\b(all|every|each|everything|everywhere|everyone|everybody|whole realm|across the realm)\b/;

const homeOf = (s: GameState, t: Tenant): string => { const b = t.buildingId ? s.buildings[t.buildingId] : null; return b ? `of ${mid(b.name)}` : 'of no fixed roof'; };

/** Buildings a clause means: named ones, else the homes of named households, else the one in hand. */
function buildingsOf(c: Clause, cx: Cx, prefer?: (b: Building) => boolean): Chosen<Building> {
  const direct = settle(c.b, c.p, { focus: cx.focusB, prefer, name: b => b.name, noun: 'house', title: cx.title });
  if (direct.ask || direct.list.length) return direct;
  const strongT = c.t.filter(h => h.w >= 2);
  const viaT = settle(strongT.length ? strongT : c.t, c.p, { focus: cx.focusT, name: t => t.name, where: t => homeOf(cx.s, t), noun: 'household', title: cx.title });
  if (viaT.ask) return { list: [], ask: viaT.ask };
  const homes = viaT.list.map(t => (t.buildingId ? cx.s.buildings[t.buildingId] : null)).filter((b): b is Building => !!b);
  if (homes.length) return { list: [...new Set(homes)] };
  if (cx.focusB && (PRONOUN_PLACE.test(c.m) || 'buildingId' in cx.target || 'tenantId' in cx.target)) return { list: [cx.focusB] };
  return { list: [] };
}
/** Households a clause means: named ones, else those living in named buildings, else the one in hand. */
function householdsOf(c: Clause, cx: Cx, prefer?: (t: Tenant) => boolean): Chosen<Tenant> {
  const direct = settle(c.t, c.p, { focus: cx.focusT, prefer, name: t => t.name, where: t => homeOf(cx.s, t), noun: 'household', title: cx.title });
  if (direct.ask || direct.list.length) return direct;
  const viaB = settle(c.b, c.p, { focus: cx.focusB, name: b => b.name, noun: 'house', title: cx.title });
  if (viaB.ask) return { list: [], ask: viaB.ask };
  const people = viaB.list.flatMap(b => tenantsIn(cx.s, b));
  if (people.length) return { list: [...new Set(people)] };
  if (cx.focusT && (PRONOUN_PERSON.test(c.m) || 'tenantId' in cx.target)) return { list: [cx.focusT] };
  if (cx.focusB && ('buildingId' in cx.target || PRONOUN_PLACE.test(c.m))) return { list: tenantsIn(cx.s, cx.focusB) };
  return { list: [] };
}

// ───────────────────────── intents ─────────────────────────

export interface Move {
  action: Action;
  /** short restatement, capitalised, no final stop */
  say: string;
  role: StaffRole | null;
  /** the listener guessed, or it is weighty: wait for the "aye" */
  confirm?: boolean;
}
type Out = { moves: Move[] } | { ask: string } | { answer: string; mood?: Mood; own?: boolean } | null;

const mv = (cx: Cx, action: Action, confirm?: boolean, say?: string): Move => ({ action, say: say ?? describeAction(action, cx.s), role: domainRole(action, cx.s), confirm });
const num = (m: string, re: RegExp): number | null => { const x = re.exec(m); return x && x[1] !== undefined ? Number(x[1]) : null; };

/** Does one condition of a standing order hold for this matter, as far as the word layer can see? */
function holds(c: Condition, inc: Incident, s: GameState): boolean {
  const t = inc.tenantId ? s.tenants[inc.tenantId] : null;
  const h = t ?? (inc.applicantId ? s.applicants[inc.applicantId]?.household : null) ?? null;
  const b = inc.buildingId ? s.buildings[inc.buildingId] : null;
  const d = dateOf(s.day);
  let have: string | number | boolean | string[] | null;
  switch (c.field) {
    case 'season': have = d.season; break;
    case 'month': have = typeof c.value === 'string' ? MONTH_NAMES[d.month]!.toLowerCase() : d.month; break;
    case 'gold': have = s.gold; break;
    case 'renown': have = s.renown; break;
    case 'cost': { const o = defOf(inc)?.outcomes.find(x => x.default) ?? defOf(inc)?.outcomes[0]; have = o?.job?.cost ?? 0; break; }
    case 'tenant.species': have = h?.species ?? null; break;
    case 'tenant.trade': have = h?.trade ?? null; break;
    case 'tenant.tags': have = h?.tags ?? null; break;
    case 'tenant.traits': have = h?.revealed ?? null; break;
    case 'tenant.monthsHoused': have = t ? Math.floor((s.day - t.movedInDay) / 30) : null; break;
    case 'tenant.daysLate': have = t?.daysLate ?? null; break;
    case 'tenant.arrears': have = t?.arrears ?? null; break;
    case 'tenant.happiness': have = t?.happiness ?? null; break;
    case 'tenant.household': have = h?.household ?? null; break;
    case 'tenant.hasPets': have = h ? h.pets.length > 0 : null; break;
    case 'tenant.name': have = h?.name ?? null; break;
    case 'building.type': have = b?.type ?? null; break;
    case 'building.condition': have = b?.condition ?? null; break;
    case 'building.id': have = b?.id ?? null; break;
    case 'building.rent': have = b?.rent ?? null; break;
    default: have = null;
  }
  if (have === null) return false;
  const want = typeof c.value === 'string' ? c.value.toLowerCase() : c.value;
  if (Array.isArray(have)) return c.op === 'includes' || c.op === '==' ? have.includes(String(want)) : c.op === 'excludes' || c.op === '!=' ? !have.includes(String(want)) : false;
  const mine = typeof have === 'string' ? have.toLowerCase() : have;
  switch (c.op) {
    case '==': case 'includes': return mine === want;
    case '!=': case 'excludes': return mine !== want;
    case '<': return Number(mine) < Number(want);
    case '<=': return Number(mine) <= Number(want);
    case '>': return Number(mine) > Number(want);
    case '>=': return Number(mine) >= Number(want);
    default: return false;
  }
}
/** Standing orders that govern this matter right now. The sim is the judge of record; this is the listener's own reading. */
export function ordersCovering(s: GameState, inc: Incident): StandingOrder[] {
  const def = defOf(inc);
  if (!def) return [];
  return s.orders.filter(o => (o.incidentDef ? o.incidentDef === inc.defId : !!o.decision && o.decision === def.decision) && o.when.every(c => holds(c, inc, s)));
}
function incidentFor(s: GameState, q: { tenantId?: Id; buildingId?: Id; applicantId?: Id; decision?: DecisionType; option?: DecisionOption }): Incident | null {
  let found: Incident | null = null;
  for (const inc of openIncidents(s)) {
    const def = defOf(inc); if (!def) continue;
    if (q.tenantId && inc.tenantId !== q.tenantId) continue;
    if (q.applicantId && inc.applicantId !== q.applicantId) continue;
    if (q.buildingId && inc.buildingId !== q.buildingId) continue;
    if (q.decision && def.decision !== q.decision) continue;
    if (q.option && !def.outcomes.some(o => o.option === q.option)) continue;
    if (!found || inc.startedDay < found.startedDay) found = inc;
  }
  return found;
}
function outcomeByOption(inc: Incident, option: DecisionOption): OutcomeDef | null {
  return defOf(inc)?.outcomes.find(o => o.option === option) ?? null;
}
/** Where words leave room: a standing order decides first, then the delegate's temperament, then the usual course. */
function latitude(cx: Cx, inc: Incident, role: StaffRole | null): { out: OutcomeDef; why: 'order' | 'temper' | 'usual' } | null {
  const def = defOf(inc); if (!def) return null;
  let outs = def.outcomes.slice();
  const orders = ordersCovering(cx.s, inc).sort((a, b) => b.when.length - a.when.length || b.createdDay - a.createdDay);
  for (const o of orders) if (o.rule === 'never') outs = outs.filter(x => !(o.outcomeId ? x.id === o.outcomeId : x.option === o.option));
  for (const o of orders) if (o.rule === 'choose') { const hit = outs.find(x => (o.outcomeId ? x.id === o.outcomeId : x.option === o.option)); if (hit) return { out: hit, why: 'order' }; }
  for (const opt of leaning(cx.s, role, def.decision)) { const hit = outs.find(x => x.option === opt); if (hit) return { out: hit, why: 'temper' }; }
  const usual = outs.find(x => x.default);
  return usual ? { out: usual, why: 'usual' } : null;
}

const EVICT_RX = /\b(evict(ion|ed|s)?|(throw|turn|put|cast|kick|toss|boot|chuck)\b.{0,24}\bout|out (they|he|she) go(es)?|(be|get) rid of|have (them|him|her|_x_) (out|gone|removed))\b/;
const REPAIR_RX = /\b(fix|mend|repair|patch|rethatch|re thatch|thatch|shore up|make good|put right|see to|sort out|sort)\b/;
const RENOVATE_RX = /\b(renovate|restore|rebuild|overhaul|make (it |_x_ )?(new|sound)|do (it |_x_ )?up)\b/;

/** Words a repair order may hold without naming a place: when others turn up, the ruler named something we do not know. */
const REPAIR_WORDS = new Set(('fix mend repair patch rethatch re thatch shore up make good put right see to sort out renovate restore rebuild overhaul do have get send go and then also please now today tomorrow soon first again once at ' +
  'the a an that this it its those these them there here my our your his her their of on in for by with before after until till ere come when while as is are be was ' +
  'roof roofs leak leaks leaking leaky wall walls chimney chimneys door doors window windows damp rot hole holes beam beams floor floors repairs mending work job place house home ' +
  'properly proper cheap cheaply quick quickly full fully right thorough thoroughly well new for temporary temporarily straw nails bodge bodged ' +
  'rains rain winter spring summer autumn fall snow snows frost week month year day days weeks months end rent bill tenant tenants pays pay account cost crowns crown ' +
  'everything everywhere all every each whatever what needs need whole realm across something anything one ones broken worst bad state mason bailiff crier steward hob you i we will shall must should would can could want wish ruin ruins ruined').split(' '));
/** The words of a clause that are neither names we know nor the ordinary furniture of a repair order. */
function strangers(c: Clause): string[] {
  return c.m.split(' ').filter(w => w && w !== '_x_' && !/^\d/.test(w) && !REPAIR_WORDS.has(w) && !REPAIR_WORDS.has(stem(w)));
}

/** "build me a tavern": buildings are placed by hand. */
function forbiddenIntent(c: Clause, cx: Cx): Out {
  const m = c.m;
  if (/\brents?\b|\bwage/.test(m)) return null;
  const typeWord = c.b.length === 0 ? null : c.b.find(h => h.w === 1);
  const anyType = BUILDING_TYPES.some(t => typeAliases(t).some(a => new RegExp(`\\b${a.join(' ')}s?\\b`).test(m)));
  if (/\b(build|construct|erect|found)\b/.test(m) && (anyType || typeWord || /\b(house|houses|home|homes|building|something)\b/.test(m)))
    return { answer: `Buildings are placed by hand, ${cx.title}. The court can only watch, and later complain about the noise.` };
  if (/\b(place|put up|raise)\b (me |us )?(a|an|another|some|more|new|2|3|4|5)\b/.test(m) && anyType && !/\b(notice|rent|fee)\b/.test(m.replace(/notice board/g, '')))
    return { answer: `Buildings are placed by hand, ${cx.title}. Point at the ground and it shall be so.` };
  if (/\b(lay|pave|build|make|cut)\b.*\b(roads?|lanes?|paths?|streets?)\b/.test(m))
    return { answer: `Roads are laid by hand, ${cx.title}. No one at court owns a shovel.` };
  if (/\b(demolish|tear down|pull down|knock down|raze|flatten)\b/.test(m))
    return { answer: `Pulling a house down is done by hand, ${cx.title}, and on purpose.` };
  if (/\b(buy|purchase|acquire)\b.*\b(land|parcel|acre|field|plot)\b/.test(m))
    return { answer: `Land is bought at the map, ${cx.title}, not across a table.` };
  return null;
}

function policyIntent(c: Clause, cx: Cx): Out {
  const m = c.m, p: Partial<Policies> = {};
  // grace
  let g = num(m, /\b(\d+) (?:whole |full )?days?(?: of)? grace\b/) ?? num(m, /\bgrace\b(?: period| days)?(?: of| is| to| at| shall be)? (\d+)\b/);
  if (g === null && /\b(a|1) day(?: of)? grace\b/.test(m)) g = 1;
  if (g === null && /\b(a|1) weeks?(?: of)? grace\b/.test(m)) g = 7;
  if (g === null) { const w = num(m, /\b(\d+) weeks?(?: of)? grace\b/); if (w !== null) g = w * 7; }
  if (g === null && /\bno (more )?grace\b|\bno days? of grace\b/.test(m)) g = 0;
  if (g !== null) p.graceDays = Math.max(0, Math.min(30, Math.round(g)));
  // late fee
  let f = num(m, /\blate fees?\b[^0-9]{0,22}?(\d+)(?: percent)?\b/) ?? num(m, /\b(\d+) percent (?:late )?fees?\b/) ?? num(m, /\bfees? (?:of|at|is|to|shall be) (\d+)\b/);
  if (f === null && /\b(no|abolish|scrap|drop|end) (the |all )?late fees?\b/.test(m)) f = 0;
  if (f !== null) p.lateFeePct = Math.max(0, Math.min(100, Math.round(f)));
  // surety
  let d = num(m, /\b(\d+(?:\.\d+)?) months?(?: of)?(?: rent)?(?: as| in| for)?(?: a| the)? (?:surety|deposit)\b/)
    ?? num(m, /\b(?:surety|deposit)s?\b[^0-9]{0,22}?(\d+(?:\.\d+)?) months?\b/);
  if (d === null && /\b(a|1) months?(?: of)?(?: rent)?(?: as| in| for)?(?: a| the)? (?:surety|deposit)\b|\b(?:surety|deposit)s?\b[^0-9]{0,22}?\ba month\b/.test(m)) d = 1;
  if (d === null && /\b(no|abolish|scrap|waive all) (the )?(surety|sureties|deposits?)\b/.test(m)) d = 0;
  if (d !== null) p.depositMonths = Math.max(0, Math.min(6, Math.round(d * 2) / 2));
  // pets
  if (/\bpet rent\b|\bcharge\b.*\b(for|on) (pets?|animals?|beasts?)\b|\b(pets?|animals?)\b.*\bpay\b/.test(m) && !/\b(no|never|without)\b.{0,12}\bpet rent\b/.test(m)) p.pets = 'pet_rent';
  else if (/\b(no|ban|forbid|bar|prohibit)\b (\w+ ){0,2}(pets?|animals?|beasts?)\b|\b(pets?|animals?|beasts?)\b (\w+ ){0,2}(forbidden|banned|barred|not allowed|prohibited)\b|\bnever allow (pets?|animals?)\b/.test(m)) p.pets = 'ban';
  else if (/\b(allow|permit|welcome)\b (\w+ ){0,2}(pets?|animals?|beasts?)\b|\b(pets?|animals?|beasts?)\b (\w+ ){0,2}(allowed|welcome|permitted|free)\b/.test(m)) p.pets = 'allow';
  // screening
  if (/\b(always|every|all)\b.*\b(references?|last landlords?|screen(ed|ing)?|vet(ted)?|ask(ed)? after)\b|\bscreen (every|all|each)\b/.test(m)) p.screening = 'always';
  else if (/\b(never|no|stop|do not|dont)\b.*\b(references?|last landlords?|screen(ing)?|vetting)\b/.test(m)) p.screening = 'never';
  // asking price against market
  const ask = /\b(?:price|ask|let|list)\b.*\b(?:at |to )?(\d+) percent (?:of |the )?(?:market|going rate)\b/.exec(m);
  if (ask) p.askPct = Number(ask[1]);
  else {
    const rel = /\b(\d+) percent (above|over|below|under|beneath) (?:the )?(?:market|going rate)\b/.exec(m);
    if (rel) p.askPct = 100 + (/(above|over)/.test(rel[2]!) ? 1 : -1) * Number(rel[1]);
    else if (/\b(price|ask|let|list)\b.*\bat (the )?(market|going rate)\b/.test(m)) p.askPct = 100;
  }
  if (p.askPct !== undefined) p.askPct = Math.max(50, Math.min(200, Math.round(p.askPct)));
  // cap on rises at renewal
  const capv = num(m, /\b(?:cap|limit)\b.*\b(?:rises?|raises?|increases?|renewals?)\b[^0-9]{0,16}(\d+)(?: percent)?\b/) ?? num(m, /\b(?:rises?|raises?|increases?)\b.*\bcapped\b[^0-9]{0,16}(\d+)\b/);
  if (capv !== null) p.renewalCapPct = Math.max(0, Math.min(100, Math.round(capv)));
  if (!Object.keys(p).length) return null;
  return { moves: [mv(cx, { type: 'set_policy', policy: p })] };
}

type RuleHit = { decision: DecisionType; option: DecisionOption; rule: 'choose' | 'never' };

function ruleOf(m: string, never: boolean): RuleHit | null {
  const has = (re: RegExp) => re.test(m);
  const R = (decision: DecisionType, option: DecisionOption, rule: 'choose' | 'never' = never ? 'never' : 'choose'): RuleHit => ({ decision, option, rule });
  if (has(/\bsquatters?\b/)) {
    if (has(/\b(oust|throw|drive|clear|evict|remove|turn|run)\b/)) return R('squatters', 'oust');
    if (has(/\b(bribe|pay)\b/)) return R('squatters', 'bribe');
    if (has(/\b(lease|sign|tenants?)\b/)) return R('squatters', 'lease');
    if (has(/\b(ignore|leave|tolerate|suffer)\b/)) return R('squatters', 'ignore');
    return null;
  }
  if (has(/\b(surety|sureties|deposits?)\b/)) {
    if (has(/\b(return|give back|hand back|refund|give \w+ back)\b/)) return R('move_out_deposit', 'return_all');
    if (has(/\b(fair|damage|honest wear|cost)\b/)) return R('move_out_deposit', 'fair');
    if (has(/\b(keep|withhold|hold back)\b/)) return R('move_out_deposit', 'keep_all');
    return null;
  }
  if (has(/\b(turn (\w+ ){0,3}away|reject|refuse|send (\w+ ){0,3}(away|packing))\b/)) return R('applicant', 'reject');
  if (has(/\b(rent to|let to|lease to|take in|welcome|admit|accept)\b/) && !has(/\b(pets?|animals?)\b/)) return never ? R('applicant', 'reject', 'choose') : R('applicant', 'accept');
  if (has(/\b(references?|last landlords?|screen|vet)\b/)) return R('applicant', 'screen');
  if (has(/\b(ask|demand|charge) (\w+ ){0,3}(more|higher|above)\b|\bhaggle\b|\bcounter\b/)) return R('applicant', 'counter');
  if (has(/\b(renewals?|renew(s|ed|ing)?|lease (ends|comes due|is up|runs out|expires))\b/) || has(/\b(raise|increase|put up|lift|hike)\b.*\brents?\b/) || has(/\brents?\b.*\b(raised?|rise|go up|increased?)\b/)) {
    if (has(/\b(raised?|increased?|put up|lift|hike|rise|go up)\b/)) return R('rent_renewal', 'raise');
    if (has(/\b(lower|cut|reduce|drop)\b/)) return R('rent_renewal', 'lower');
    if (has(/\b(hold|same|keep|freeze)\b/)) return R('rent_renewal', 'hold');
    return null;
  }
  if (has(/\b(no|not|never|without)\b (\w+ ){0,2}(patch|bodg)/)) return never && !has(/\balways\b/) ? R('repair', 'patch', 'never') : R('repair', 'fix', 'choose');
  if (has(/\b(patch|bodge)\b|\bcheap(ly|est)?\b/) && has(/\b(patch|bodge|fix|mend|repair|roofs?|leaks?)\b/)) return R('repair', 'patch');
  if (has(/\bbill\b|\btenants? pays?\b|\bcharge (the )?tenants?\b.*\b(repairs?|mending|fix)/)) return R('repair', 'bill_tenant');
  if (has(/\b(put off|defer|delay|postpone|leave)\b.*\b(repairs?|leaks?|roofs?|mending)\b/)) return R('repair', 'defer');
  if (has(/\b(mend|fix|repair)\b|\bproper(ly)?\b.*\b(job|work|mending)\b/)) return R('repair', 'fix');
  if (has(/\b(tear up|burn)\b.*\bwrits?\b|\bmercy\b|\bspare\b/)) return R('eviction_ready', 'mercy');
  if (has(/\b(coin|cash) for keys\b|\bpay (\w+ ){0,3}to (go|leave)\b/)) return R('eviction_ready', 'cash_for_keys');
  if (has(EVICT_RX)) return R('eviction_ready', 'evict');
  if (has(/\bnotices?\b|\bcourt\b/)) return R('late_rent', 'notice');
  if (has(/\b(late )?fees?\b|\bfines?\b|\bpenalt(y|ies)\b/)) return R('late_rent', 'late_fee');
  if (has(/\bpayment plans?\b|\binstal+ments?\b|\bpay (it )?(off|back)\b/)) return R('late_rent', 'payment_plan');
  if (has(/\b(forgive|waive|pardon|write off|let (\w+ ){0,3}off)\b/)) return R('late_rent', 'forgive');
  if (has(/\b(wait|a week|more time|patien(t|ce)|extension)\b/)) return R('late_rent', 'wait');
  return null;
}

const TAG_RX: [RegExp, TenantTag][] = [
  [/\bwidow(?:er)?s?\b/g, 'widow'], [/\b(?:elders?|elderly|the old|old folk|the aged)\b/g, 'elder'], [/\b(?:veterans?|old soldiers?)\b/g, 'veteran'],
  [/\bnewly ?weds?\b/g, 'newlyweds'], [/\b(?:large|big) (?:famil(?:y|ies)|households?)\b/g, 'large_family'], [/\bscholars?\b/g, 'scholar'],
  [/\b(?:nobles?|noble ?born|highborn|gentry)\b/g, 'noble_born'], [/\bstrangers?\b/g, 'stranger'], [/\bapprentices?\b/g, 'apprentice'], [/\bpilgrims?\b/g, 'pilgrim'],
];
const SPECIES_RX: [RegExp, Species][] = [
  [/\bhumans?\b/g, 'human'], [/\bhalflings?\b/g, 'halfling'], [/\bdwar(?:f|fs|ves)\b/g, 'dwarf'], [/\bgoblins?\b/g, 'goblin'], [/\bel(?:f|ves)\b/g, 'elf'], [/\bogres?\b/g, 'ogre'],
];
const CMP: [RegExp, Condition['op']][] = [
  [/(more than|over|above|exceed)/, '>'], [/(at least|or more|no less than)/, '>='], [/(less than|under|below|fewer than)/, '<'], [/(up to|at most|or less|no more than)/, '<='],
];
const cmpOf = (text: string | undefined, fallback: Condition['op']): Condition['op'] => { for (const [re, op] of CMP) if (text && re.test(text)) return op; return fallback; };
const NEGATE: Record<string, Condition['op']> = { '==': '!=', '!=': '==', includes: 'excludes', excludes: 'includes', '<': '>=', '>=': '<', '>': '<=', '<=': '>' };

function conditionsOf(c: Clause, cx: Cx, decision: DecisionType): Condition[] {
  const m = c.m, when: Condition[] = [];
  const negAt = (() => { const x = /\b(except|unless|but not|save for|other than|apart from|excepting)\b/.exec(m); return x ? x.index : Infinity; })();
  const add = (field: Condition['field'], op: Condition['op'], value: Condition['value'], at: number) => {
    const o = at > negAt ? NEGATE[op] ?? op : op;
    if (!when.some(w => w.field === field && w.value === value)) when.push({ field, op: o, value });
  };
  const each = (re: RegExp, f: (x: RegExpExecArray) => void) => { re.lastIndex = 0; let x: RegExpExecArray | null; while ((x = re.exec(m))) { f(x); if (!re.global) break; } };
  for (const [re, tag] of TAG_RX) each(re, x => add('tenant.tags', 'includes', tag, x.index));
  if (decision !== 'squatters') for (const [re, sp] of SPECIES_RX) each(re, x => add('tenant.species', '==', sp, x.index));
  for (const tr of TRADES) {
    const w = tr.replace(/_/g, ' ');
    if (w === 'guard' || w === 'hunter') continue;
    each(new RegExp(`\\b${w}s?\\b`, 'g'), x => add('tenant.trade', '==', tr, x.index));
  }
  each(/\b(winter|spring|summer|autumn|fall)\b/g, x => add('season', '==', (x[1] === 'fall' ? 'autumn' : x[1]) as Season, x.index));
  MONTH_NAMES.forEach((name, i) => each(new RegExp(`\\b${name.toLowerCase().replace(/-/g, ' ?')}\\b`, 'g'), x => add('month', '==', i, x.index)));
  each(/\b(?:owe[sd]?|owing|arrears|debts?|behind)\b[^0-9]{0,30}?(\d+)(?: crowns?)?( or more| or less)?/g, x => add('tenant.arrears', cmpOf(m.slice(x.index, x.index + x[0].length), '>'), Number(x[1]), x.index));
  each(/\b(more than |over |less than |under |at least )?(\d+) days? (?:late|behind|overdue)\b/g, x => add('tenant.daysLate', cmpOf(x[1], '>='), Number(x[2]), x.index));
  each(/\b(?:here|housed|with us|tenants?|lived|living|stayed)\b[^0-9]{0,25}?(more than |over |at least |less than |under )?(\d+(?:\.\d+)?|a) (months?|years?)\b/g,
    x => add('tenant.monthsHoused', cmpOf(x[1], '>='), Math.round((x[2] === 'a' ? 1 : Number(x[2])) * (x[3]!.startsWith('year') ? 12 : 1)), x.index));
  each(/\b(?:with|who keep|keeping|that have|who have|that keep|having) (?:a |an |any )?(?:pets?|animals?|beasts?)\b/g, x => add('tenant.hasPets', '==', true, x.index));
  each(/\b(?:without|with no|who keep no) (?:pets?|animals?|beasts?)\b/g, x => add('tenant.hasPets', '==', false, x.index));
  each(/\b(?:coffers?|treasury|we have|i have|purse)\b[^0-9]{0,30}?(more than|over|above|at least|less than|under|below)\s*(\d+)/g, x => add('gold', cmpOf(x[1], '<'), Number(x[2]), x.index));
  each(/\b(?:cost(?:s|ing)?|repairs?|jobs?|work|anything)\b[^0-9]{0,20}?(more than|over|above|at least|less than|under|below)\s*(\d+)/g, x => add('cost', cmpOf(x[1], '>'), Number(x[2]), x.index));
  each(/\b(?:famil(?:y|ies)|households?) of (more than |over |at least |less than |under )?(\d+)/g, x => add('tenant.household', cmpOf(x[1], '>='), Number(x[2]), x.index));
  each(/\b(unhappy|miserable|discontented)\b/g, x => add('tenant.happiness', '<', 40, x.index));
  for (const type of BUILDING_TYPES) {
    if (BUILDINGS[type].category === 'amenity' || BUILDINGS[type].category === 'staff' || type === 'seat') continue;
    for (const a of typeAliases(type)) each(new RegExp(`\\b(?:in|at|on|for|from) (?:the |a |an |any |all |every )?${a.join(' ')}s?\\b`, 'g'), x => add('building.type', '==', type, x.index));
  }
  for (const h of c.b) {
    if (h.w < 2) continue;
    // the seat's level names are common words ("the Keep"): as a verb ("keep that in mind") they name no building
    if (h.item.type === 'seat') {
      const last = h.item.name.toLowerCase().replace(/[^a-z ]/g, '').trim().split(' ').pop() ?? '';
      if (!last || !new RegExp(`\\b(?:at|in|of|for|from|about|on|by|near|inside|outside|to the) (?:the |my |our )?(?:[a-z]+ )?${last}\\b`).test(m.toLowerCase())) continue;
    }
    add('building.id', '==', h.item.id, 0);
  }
  for (const h of c.t) if (h.w >= 2) add('tenant.name', '==', h.item.name, 0);
  return when;
}

const STANDING_RX = /\b(always|never|from now on|henceforth|from this day|whenever|every time|as a rule|standing order|under no circumstances|at all times|not ever|no more)\b/;

function standingIntent(c: Clause, cx: Cx): Out {
  const m = c.m;
  const never = /\b(never|no more|under no circumstances|not ever)\b/.test(m) || (!/\balways\b/.test(m) && /\b(from now on|henceforth|from this day|as a rule)\b/.test(m) && /\b(no|do not|dont|stop|cease)\b/.test(m));
  const hit = ruleOf(m, never);
  if (!hit) return { ask: `That is a rule I cannot keep a tally of, ${cx.title}. I can hold to rules on evictions, notices, late fees, repairs, sureties, applicants, squatters and renewals.` };
  if (!DECISION_OPTIONS[hit.decision].includes(hit.option)) return null;
  const when = conditionsOf(c, cx, hit.decision);
  const to: StaffRole | 'all' = DECISION_ROLE[hit.decision] ?? 'all';
  const core = { to, decision: hit.decision, incidentDef: null, when, rule: hit.rule, option: hit.option, outcomeId: null };
  const order = { ...core, text: clip(cx.raw, 240), gist: orderGist(core, cx.s) };
  return { moves: [mv(cx, { type: 'add_order', order }, true)] };
}

function revokeIntent(c: Clause, cx: Cx): Out {
  const m = c.m;
  if (!/\b(revoke|rescind|cancel|strike|forget|lift|withdraw|scrap|undo|end)\b.*\b(orders?|rules?|decrees?|instructions?)\b/.test(m)) return null;
  const orders = cx.s.orders;
  if (!orders.length) return { answer: `There are no standing orders to strike, ${cx.title}. The book is clean.` };
  if (/\b(all|every|each)\b/.test(m)) return { moves: orders.map(o => mv(cx, { type: 'revoke_order', orderId: o.id }, orders.length > 1)) };
  const stop = new Set(['the', 'a', 'an', 'my', 'that', 'this', 'order', 'orders', 'rule', 'rules', 'about', 'on', 'for', 'to', 'of', 'standing', 'revoke', 'rescind', 'cancel', 'strike', 'forget', 'lift', 'withdraw', 'scrap', 'undo', 'end', 'in', 'and', 'no', 'never', 'always']);
  const want = new Set(c.p.toks.map(stem).filter(t => !stop.has(t) && t.length > 2));
  let best: StandingOrder | null = null, bestScore = 0, tie = false;
  for (const o of orders) {
    const have = new Set([...toks(o.text), ...toks(o.gist), o.to, ...(o.option ? o.option.split('_') : []), ...(o.decision ? o.decision.split('_') : [])].map(stem));
    let score = 0; for (const w of want) if (have.has(w)) score++;
    if (score > bestScore) { best = o; bestScore = score; tie = false; } else if (score === bestScore && score > 0) tie = true;
  }
  if (!best && orders.length === 1) best = orders[0]!;
  if (!best || tie) return { ask: `Which order, ${cx.title}? You have ${orders.length} standing: ${listNames(orders.slice(0, 4).map(o => `"${o.gist.replace(/[.!?]+$/, '')}"`), 'and')}.` };
  return { moves: [mv(cx, { type: 'revoke_order', orderId: best.id })] };
}

/** forgive, wait, fee, plan, notice, evict, mercy, coin for keys, and "deal with the late payers". */
function lateIntent(c: Clause, cx: Cx): Out {
  const m = c.m, s = cx.s;
  let option: DecisionOption | 'latitude' | null = null;
  if (/\b(tear up|burn|void)\b.*\bwrits?\b|\bshow (\w+ ){0,2}mercy\b|\blet (them|him|her|_x_) stay\b/.test(m)) option = 'mercy';
  else if (/\b(coin|cash|crowns?) for (the |their |his |her )?keys\b|\bpay (them|him|her|_x_) to (go|leave|move)\b/.test(m)) option = 'cash_for_keys';
  else if (/\bnotice to quit\b|\b(serve|nail|post|give|send|issue|pin)\b.*\bnotice\b|\b(take|haul|drag)\b.*\bto court\b/.test(m)) option = 'notice';
  else if (EVICT_RX.test(m) || /\bsend the bailiff\b/.test(m)) option = 'evict';
  else if (/\bpayment plan\b|\binstal+ments?\b|\bpay (it |that |the debt |the arrears )?(off|back) (over|in)\b|\bin (parts|pieces)\b/.test(m)) option = 'payment_plan';
  else if (/\b(forgive|waive|write off|pardon|wipe)\b|\bforget\b.*\b(debt|arrears|rent|fee|month)\b|\blet (them|him|her|_x_) off\b/.test(m)) option = 'forgive';
  else if (/\b(charge|levy|add|apply|put)\b.*\b(late )?fees?\b|\bfine (them|him|her|_x_)\b/.test(m)) option = 'late_fee';
  else if (/\b(give|allow|grant)\b.*\b(a week|another week|more time|a few days|longer|time to pay)\b|\bwait (for|on)\b|\bbe patient with\b|\bextension\b|\b(you|they|he|she|_x_) (have|has|may have|can have|shall have) (a week|another week|more time|a few days|until|till)\b|\btake (a|another) week\b/.test(m)) option = 'wait';
  else if (/\b(deal with|handle|see to|sort out|chase|press|lean on|do something about)\b.*\b(late|arrears|debtors?|non ?payers?|not paid|who owes?|unpaid|behind)\b/.test(m)) option = 'latitude';
  if (!option) return null;

  const group = /\b(late payers?|debtors?|non ?payers?|those who|everyone who|all who|anyone who|whoever|those in arrears|the late ones|all of them)\b/.test(m) || option === 'latitude';
  const picked = householdsOf(c, cx, t => t.arrears > 0 || t.lateStage !== 'none');
  if (picked.ask) return { ask: picked.ask };
  let people = picked.list;
  const late = (t: Tenant) => t.arrears > 0 || t.daysLate > 0 || (t.lateStage !== 'none' && t.lateStage !== 'grace');
  if (!people.length && (group || option !== 'evict')) {
    const decision: DecisionType = option === 'evict' || option === 'mercy' ? 'eviction_ready' : 'late_rent';
    const withMatter = openIncidents(s).filter(i => defOf(i)?.decision === decision && i.tenantId).map(i => s.tenants[i.tenantId!]).filter((t): t is Tenant => !!t);
    people = group ? [...new Set([...withMatter, ...(option === 'latitude' || option === 'notice' ? housedTenants(s).filter(late) : [])])] : withMatter;
    if (!people.length) return { answer: option === 'latitude' || group ? `Nobody is behind with the rent, ${cx.title}. It will not last.` : `Who, ${cx.title}? No one stands before you over late rent just now.` };
  }
  if (!people.length) return { ask: `Evict whom, ${cx.title}? Give me a name.` };

  const moves: Move[] = [];
  const cannot: string[] = [];
  for (const t of people) {
    const want: DecisionOption[] = option === 'latitude' ? [] : [option];
    let inc: Incident | null = null, out: OutcomeDef | null = null;
    if (option === 'latitude') {
      inc = incidentFor(s, { tenantId: t.id, decision: 'late_rent' }) ?? incidentFor(s, { tenantId: t.id, decision: 'eviction_ready' });
      if (inc) {
        const pick = latitude(cx, inc, 'bailiff');
        if (!pick || pick.why === 'usual') return { ask: `Deal with ${people.length > 1 ? 'them' : t.first} how, ${cx.title}? ${listNames((defOf(inc)?.outcomes ?? []).map(o => lower1(o.label)))}?` };
        out = pick.out;
      } else {
        const lean = leaning(s, 'bailiff', 'late_rent')[0];
        if (!lean) return { ask: `Deal with ${people.length > 1 ? 'them' : t.first} how, ${cx.title}? A visit, or a Notice to Quit?` };
        moves.push(lean === 'notice' ? mv(cx, { type: 'order_job', kind: 'serve_notice', tenantId: t.id, buildingId: t.buildingId ?? undefined }, true) : mv(cx, { type: 'order_job', kind: 'visit', tenantId: t.id }));
        continue;
      }
    } else {
      for (const o of want) { inc = incidentFor(s, { tenantId: t.id, option: o }); if (inc) { out = outcomeByOption(inc, o); break; } }
    }
    if (inc && out) { moves.push(mv(cx, { type: 'resolve_incident', incidentId: inc.id, outcomeId: out.id }, option === 'latitude' || undefined)); continue; }
    if (option === 'notice') { moves.push(mv(cx, { type: 'order_job', kind: 'serve_notice', tenantId: t.id, buildingId: t.buildingId ?? undefined }, true)); continue; }
    if (option === 'evict') { moves.push(mv(cx, { type: 'order_job', kind: 'evict', tenantId: t.id, buildingId: t.buildingId ?? undefined }, true)); continue; }
    cannot.push(t.name);
  }
  if (!moves.length) {
    const one = people.length === 1 ? people[0]! : null;
    return { answer: one && one.arrears > 0
      ? `${one.name} owes ${one.arrears}, ${cx.title}, but no ruling on it is called for just now. It will come before you when it is ripe.`
      : `${listNames(cannot, 'and')} ${cannot.length > 1 ? 'are' : 'is'} not before you over the rent just now, ${cx.title}. There is nothing on the books to ${option === 'forgive' ? 'forgive' : 'rule on'}.` };
  }
  cx.focusT = people[0] ?? cx.focusT;
  return { moves };
}

function squatterIntent(c: Clause, cx: Cx): Out {
  const m = c.m, s = cx.s;
  const squatted = Object.values(s.buildings).filter(b => b.squatters);
  if (!squatted.length || !/\b(squatters?|goblins|bandits|cultists|raccoons|troupe|ghosts?|interlopers|trespassers)\b/.test(m)) return null;
  if (c.t.some(h => h.w >= 2)) return null;
  const named = settle(c.b, c.p, { focus: cx.focusB, prefer: b => !!b.squatters, name: b => b.name, noun: 'house', title: cx.title });
  if (named.ask) return { ask: named.ask };
  let places = named.list.filter(b => b.squatters);
  if (!places.length && named.list.length) return null;
  if (!places.length) places = cx.focusB?.squatters ? [cx.focusB] : squatted;
  let option: DecisionOption | null = null;
  if (/\b(lease|sign|tenants?|pay rent|rent to)\b/.test(m)) option = 'lease';
  else if (/\b(ignore|leave|tolerate|stay|remain|let (them|it|\w+ \w+|\w+) be)\b/.test(m) && !/\b(not|no|never|cannot)\b.{0,12}\b(stay|remain)\b/.test(m)) option = 'ignore';
  else if (/\b(bribe|pay|coin)\b/.test(m)) option = 'bribe';
  else if (/\b(oust|throw|drive|clear|evict|remove|turn|run|out|rid|bailiff|go|gone)\b/.test(m)) option = 'oust';
  const moves: Move[] = [];
  for (const b of places) {
    const inc = incidentFor(s, { buildingId: b.id, decision: 'squatters' });
    if (!inc) continue;
    let out = option ? outcomeByOption(inc, option) : null, guess = false;
    if (!option) { const pick = latitude(cx, inc, 'bailiff'); if (pick && pick.why !== 'usual') { out = pick.out; guess = true; } }
    if (!out) return { ask: `What of the squatters at ${mid(b.name)}, ${cx.title}? ${listNames((defOf(inc)?.outcomes ?? []).map(o => lower1(o.label)))}?` };
    moves.push(mv(cx, { type: 'resolve_incident', incidentId: inc.id, outcomeId: out.id }, guess || undefined));
  }
  if (!moves.length) return { answer: `The squatters at ${listNames(places.map(b => mid(b.name)), 'and')} are not yet a matter before the court, ${cx.title}. Give it a day.` };
  cx.focusB = places[0] ?? cx.focusB;
  return { moves };
}

/** A ruling on one particular animal that is already a matter before the court: "the griffin goes", "it may stay, at pet rent". */
function petIntent(c: Clause, cx: Cx): Out {
  const m = c.m, s = cx.s;
  const open = openIncidents(s).filter(i => defOf(i)?.decision === 'pet');
  if (!open.length) return null;
  const animal = (i: Incident) => (typeof i.vars.pet === 'string' && i.vars.pet ? new RegExp(`\\b${i.vars.pet.toLowerCase().replace(/[^a-z ]/g, '')}s?\\b`).test(m) : false);
  const byName = open.filter(animal);
  const generic = /\b(pets?|animals?|beasts?|creatures?)\b/.test(m);
  const near = open.filter(i => (i.tenantId && (cx.focusT?.id === i.tenantId || c.t.some(h => h.w >= 2 && h.item.id === i.tenantId))) || (i.buildingId && (cx.focusB?.id === i.buildingId || c.b.some(h => h.w >= 2 && h.item.id === i.buildingId))));
  const pool = byName.length ? byName : generic ? near : [];
  if (pool.length !== 1) return null;
  const inc = pool[0]!;
  let option: DecisionOption | null = null;
  if (/\bpet rent\b|\b(pays?|charge|surety)\b/.test(m)) option = 'pet_rent';
  else if (/\b(not|no|never|cannot|wont)\b.{0,14}\b(stay|remain|keep|allowed|have)\b|\b(go|goes|gone|out|rid|remove|removed|banish|ban|banned|away|no (pets?|animals?|beasts?))\b/.test(m)) option = 'ban';
  else if (/\b(other way|did not see|never saw|saw no|see no|allow|allowed|permit|permitted|blind eye|say nothing|said nothing)\b/.test(m)) option = 'allow';
  const out = option ? outcomeByOption(inc, option) : null;
  if (out) return { moves: [mv(cx, { type: 'resolve_incident', incidentId: inc.id, outcomeId: out.id })] };
  if (/\b(stays?|keeps?|remains?|may have|can have)\b/.test(m)) return { ask: `On what terms, ${cx.title}? ${cap(listNames((defOf(inc)?.outcomes ?? []).filter(o => o.option !== 'ban').map(o => lower1(o.label))))}?` };
  return null;
}

function collectIntent(c: Clause, cx: Cx): Out {
  const m = c.m, s = cx.s;
  if (!(/\b(collect|gather|fetch|bring in|take up|round up|get in|pick up)\b/.test(m) && (/\b(rents?|purses?|coin|dues|money|what is owed|everything|all|them|it|doors?)\b/.test(m) || c.b.length || c.t.length))) return null;
  const pick = buildingsOf(c, cx, b => b.units.some(u => u.purse > 0));
  if (pick.ask) return { ask: pick.ask };
  const explicit = c.b.length > 0 || c.t.some(h => h.w >= 2);
  if (explicit && pick.list.length) {
    const withPurse = pick.list.filter(b => b.units.some(u => u.purse > 0));
    if (!withPurse.length) return { answer: `No purse waits at ${listNames(pick.list.map(b => mid(b.name)), 'or')}, ${cx.title}.` };
    return { moves: withPurse.map(b => mv(cx, { type: 'collect_purse', buildingId: b.id })) };
  }
  // "collect at the crooked barn": a door was named and it is not one we know
  if (!pick.list.length && /\b(at|from)\b(?! (once|all|every|each|the doors?|every door|each door)\b)/.test(m) && !EVERY.test(m)) return { ask: `Collect at which door, ${cx.title}? I do not know that one.` };
  const waiting = Object.values(s.buildings).reduce((n, b) => n + b.units.filter(u => u.purse > 0).length, 0);
  if (!waiting) return { answer: `No purses wait at any door, ${cx.title}. Rent Day will come round again.` };
  return { moves: [mv(cx, { type: 'collect_all' }, undefined, `Collect every purse, ${waiting === 1 ? 'the one door' : waiting + ' doors'} in all`)] };
}

function rentIntent(c: Clause, cx: Cx): Out {
  const m = c.m, s = cx.s;
  if (!/\brents?\b/.test(m) || /\b(collect|gather|fetch|late rent|rent day|pet rent|forgive|waive|rent roll|rent to)\b/.test(m)) return null;
  if (/^(what|how much|who|which|when|is|are|does|do)\b/.test(m)) return null;
  const up = /\b(raise|increase|lift|hike|bump|put up|push up|up)\b/.test(m), down = /\b(lower|drop|cut|reduce|ease|bring down|knock|trim|down)\b/.test(m);
  const dbl = /\bdouble\b/.test(m), half = /\bhalve\b/.test(m);
  const setv = /\b(set|make|fix|put|charge|ask|shall be|is to be|is now|to)\b/.test(m);
  if (!(up || down || dbl || half || setv)) return null;
  let pick = buildingsOf(c, cx);
  if (pick.ask) return { ask: pick.ask };
  let everywhere = false;
  if (!pick.list.length && (EVERY.test(m) || /\brents\b/.test(m))) { pick = { list: Object.values(s.buildings).filter(b => isLeasable(b) && b.state === 'ready') }; everywhere = true; }
  const places = pick.list.filter(isLeasable);
  if (!places.length) return { ask: pick.list.length ? `${cap(mid(pick.list[0]!.name))} pays no rent, ${cx.title}. Which house did you mean?` : `The rent at which house, ${cx.title}?` };
  const pctM = /\b(?:by )?(\d+(?:\.\d+)?) percent\b/.exec(m);
  const to = num(m, /\bto (\d+)\b(?! percent)/), by = num(m, /\bby (\d+)\b(?! percent)/);
  const bare = num(m, /\b(\d+)\b(?! percent)/);
  const moreLess = /\b\d+ (?:crowns? |coins? )?(?:more|less|extra|higher|lower)\b/.test(m);
  const moves: Move[] = [];
  let guessed = false;
  for (const b of places) {
    const old = b.rent; let next: number;
    if (dbl) next = old * 2;
    else if (half) next = Math.round(old / 2);
    else if (pctM) { const d = Math.max(1, Math.round(old * Number(pctM[1]) / 100)); next = down && !up ? old - d : old + d; }
    else if (to !== null) next = to;
    else if (by !== null) next = down && !up ? old - by : old + by;
    else if (bare !== null) next = (up || down) && moreLess ? (down ? old - bare : old + bare) : bare;
    else if (up || down) { const d = Math.max(1, Math.round(old * 0.1)); next = down ? old - d : old + d; guessed = true; }
    else return { ask: `The rent at ${mid(b.name)} to what, ${cx.title}? It asks ${old} now.` };
    next = Math.max(1, Math.round(next));
    if (next === old) continue;
    moves.push(mv(cx, { type: 'set_rent', buildingId: b.id, rent: next }, guessed || everywhere || undefined));
  }
  if (!moves.length) return { answer: `The rent ${places.length > 1 ? 'there already stands' : `at ${mid(places[0]!.name)} already stands`} at that, ${cx.title}.` };
  cx.focusB = places[0] ?? cx.focusB;
  if (guessed) moves[0]!.say += ', a tenth being my own guess';
  return { moves };
}

function repairIntent(c: Clause, cx: Cx): Out {
  const m = c.m, s = cx.s;
  const renovate = RENOVATE_RX.test(m);
  if (!renovate && !REPAIR_RX.test(m)) return null;
  if (/\b(see to|sort out|sort)\b/.test(m) && !/\b(roofs?|leaks?|thatch|walls?|chimneys?|repairs?|damp|rot|doors?|windows?)\b/.test(m) && !c.b.length) return null;
  const hasRepairMatter = (b: Building) => !!incidentFor(s, { buildingId: b.id, decision: 'repair' });
  const pick = buildingsOf(c, cx, b => hasRepairMatter(b));
  if (pick.ask) {
    // "mend the hovel" with three hovels: the shabbiest of them is what was meant, if one is plainly worst
    const group = c.b.filter(h => h.w === 1).map(h => h.item).sort((a, b) => a.condition - b.condition);
    if (group.length >= 2 && group[1]!.condition - group[0]!.condition >= 15) pick.list = [group[0]!]; else return { ask: pick.ask };
  }
  let places = pick.list.filter(b => b.state !== 'building');
  if (!places.length && pick.list.length) return { answer: `${cap(mid(pick.list[0]!.name))} is not yet built, ${cx.title}. There is nothing to mend but the plan.` };
  let swept = false;
  if (!places.length) {
    const open = openIncidents(s).filter(i => defOf(i)?.decision === 'repair' && i.buildingId).map(i => s.buildings[i.buildingId!]).filter((b): b is Building => !!b);
    if (EVERY.test(m) || /\b(what(ever)? needs|that needs)\b/.test(m)) {
      const shabby = Object.values(s.buildings).filter(b => b.state === 'ready' && b.condition < 60 && !open.includes(b)).sort((a, b) => a.condition - b.condition);
      places = [...new Set([...open, ...shabby])].slice(0, 8); swept = true;
    } else if (/\bruins?\b/.test(m) && Object.values(s.buildings).some(b => b.state === 'ruined')) {
      const ruins = Object.values(s.buildings).filter(b => b.state === 'ruined');
      if (ruins.length > 1 && !/\bruins\b/.test(m)) return { ask: `Which ruin, ${cx.title}: ${listNames(ruins.map(b => mid(b.name)))}?` };
      places = ruins;
    } else if (new Set(open).size === 1 && !strangers(c).length && !c.b.length && !c.t.length) places = [open[0]!];   // "mend the roof", with one roof leaking
    if (!places.length && !swept && strangers(c).length && strangers(c).length <= 4) {
      return { ask: `I know of no ${strangers(c).join(' ')}, ${cx.title}. Name the house as the roll has it.` };
    }
    if (!places.length) {
      const worst = Object.values(s.buildings).filter(b => b.state === 'ready').sort((a, b) => a.condition - b.condition)[0];
      return swept ? { answer: `Nothing wants mending, ${cx.title}. Enjoy it while the weather holds.` }
        : { ask: `Mend what, ${cx.title}?${worst && worst.condition < 70 ? ` ${cap(mid(worst.name))} is the worst of it.` : ''}` };
    }
  }
  const wantPatch = /\b(patch|cheap(ly)?|quick(ly)?|bodge|for now|temporar(y|ily)|straw)\b/.test(m);
  const wantProper = /\b(proper(ly)?|full(y)?|right|thorough(ly)?|new thatch|once and for all|well)\b/.test(m);
  const wantBill = /\bbill\b|\btenants? pays?\b|\bon (their|his|her) (account|slate)\b|\bat (their|his|her) cost\b/.test(m);
  const moves: Move[] = [];
  for (const b of places) {
    const inc = incidentFor(s, { buildingId: b.id, decision: 'repair' });
    if (inc && !renovate) {
      let out = wantBill ? outcomeByOption(inc, 'bill_tenant') : wantPatch ? outcomeByOption(inc, 'patch') : wantProper ? outcomeByOption(inc, 'fix') : null;
      let guess = false;
      if (!out) { const lat = latitude(cx, inc, 'mason'); if (lat) { out = lat.out; guess = lat.why === 'temper' && lat.out.option !== 'fix'; } }
      if (!out) out = outcomeByOption(inc, 'fix') ?? defOf(inc)?.outcomes[0] ?? null;
      if (out) { moves.push(mv(cx, { type: 'resolve_incident', incidentId: inc.id, outcomeId: out.id }, undefined, guess ? `${out.label}, at ${mid(b.name)}, that being my way` : undefined)); continue; }
    }
    if (!renovate) {
      // another open matter at this house that a mason would ordinarily see to
      const other = openIncidents(s).find(i => { const d = defOf(i); const o = d?.outcomes.find(x => x.default); return i.buildingId === b.id && !!d && !d.audience && o?.job?.role === 'mason'; });
      const usual = other ? defOf(other)!.outcomes.find(x => x.default)! : null;
      if (other && usual) { moves.push(mv(cx, { type: 'resolve_incident', incidentId: other.id, outcomeId: usual.id })); continue; }
    }
    if (renovate || b.state === 'ruined') { moves.push(mv(cx, { type: 'order_job', kind: 'renovate', buildingId: b.id })); continue; }
    if (b.condition >= 98 && !swept) return { answer: `${cap(mid(b.name))} wants nothing, ${cx.title}. It is as sound as it will ever be.` };
    if (b.condition < 98) moves.push(mv(cx, { type: 'order_job', kind: 'repair', buildingId: b.id }));
  }
  if (!moves.length) return { answer: `Nothing there wants mending, ${cx.title}.` };
  cx.focusB = places[0] ?? cx.focusB;
  return { moves };
}

function lettingIntent(c: Clause, cx: Cx): Out {
  const m = c.m, s = cx.s;
  const vacant = (b: Building) => b.state === 'ready' && b.units.some(u => !u.tenantId);
  // show
  if (/\bshow\b/.test(m) && !/\bshow (\w+ ){0,2}mercy\b/.test(m)) {
    const apps = Object.values(s.applicants);
    if (!apps.length) return { answer: `Nobody waits to be shown anything, ${cx.title}. The doorstep is empty.` };
    const named = settle(c.ap.filter(h => h.w >= 2), c.p, { name: a => a.household.name, noun: 'applicant', title: cx.title });
    if (named.ask) return { ask: named.ask };
    let list = named.list;
    if (!list.length) { const bs = buildingsOf(c, cx, b => apps.some(a => a.buildingId === b.id)); if (bs.ask) return { ask: bs.ask }; list = apps.filter(a => bs.list.some(b => b.id === a.buildingId)); }
    if (!list.length) list = apps.filter(a => !a.shown);
    if (!list.length) return { answer: `Everyone waiting has seen the place already, ${cx.title}. They await your word, not a tour.` };
    return { moves: list.map(a => mv(cx, { type: 'order_job', kind: 'show', applicantId: a.id, buildingId: a.buildingId })) };
  }
  // references
  if (/\b(references?|last landlords?|screen|vet|ask after|ask about|look into|make enquir|make inquir)\b/.test(m)) {
    const named = settle(c.ap, c.p, { name: a => a.household.name, noun: 'applicant', title: cx.title });
    if (named.ask) return { ask: named.ask };
    const apps = named.list.length ? named.list : Object.values(s.applicants);
    const ts = c.t.filter(h => h.w >= 2).map(h => h.item);
    if (ts.length) return { moves: ts.map(t => mv(cx, { type: 'order_job', kind: 'screen', tenantId: t.id })) };
    if (!apps.length) return { answer: `There is no applicant to ask after, ${cx.title}.` };
    if (apps.length > 1 && !named.list.length) return { ask: `Ask after whom, ${cx.title}: ${listNames(apps.map(a => a.household.name))}?` };
    return { moves: apps.map(a => { const inc = incidentFor(s, { applicantId: a.id, option: 'screen' }); const out = inc ? outcomeByOption(inc, 'screen') : null; return inc && out ? mv(cx, { type: 'resolve_incident', incidentId: inc.id, outcomeId: out.id }) : mv(cx, { type: 'order_job', kind: 'screen', applicantId: a.id }); }) };
  }
  // welcome / turn away / haggle
  const accept = /\b(welcome|accept|admit|sign (them|him|her|_x_)|let (them|him|her|_x_) (in|have it|take it)|give (them|him|her|_x_) the (place|keys?|lease|house|hovel|cottage))\b/.test(m);
  const reject = /\b(turn (them|him|her|_x_) away|reject|refuse|send (them|him|her|_x_) (away|packing|off))\b/.test(m);
  const counter = /\b(ask|demand|want) (for )?(more|a higher rent)\b|\bhaggle\b|\bcounter\b/.test(m);
  if ((accept || reject || counter) && Object.keys(s.applicants).length) {
    const named = settle(c.ap, c.p, { name: a => a.household.name, noun: 'applicant', title: cx.title });
    if (named.ask) return { ask: named.ask };
    const apps = named.list.length ? named.list : Object.values(s.applicants);
    if (apps.length > 1 && !named.list.length && !EVERY.test(m)) return { ask: `Which applicant, ${cx.title}: ${listNames(apps.map(a => a.household.name))}?` };
    const option: DecisionOption = accept ? 'accept' : reject ? 'reject' : 'counter';
    return { moves: apps.map(a => {
      const inc = incidentFor(s, { applicantId: a.id, option }); const out = inc ? outcomeByOption(inc, option) : null;
      return inc && out ? mv(cx, { type: 'resolve_incident', incidentId: inc.id, outcomeId: out.id })
        : mv(cx, { type: 'order_job', kind: 'show', applicantId: a.id, buildingId: a.buildingId }, undefined, `Show ${a.household.name} round ${mid(s.buildings[a.buildingId]?.name ?? 'the place')} first, as they have not seen it`);
    }) };
  }
  // list / unlist
  const un = /\b(unlist|delist|withdraw|take (\w+ ){0,3}(down|off)|stop (showing|listing|advertising|crying|letting)|off the board|not to let|keep (\w+ ){0,2}empty)\b/.test(m);
  const on = /\b(list|advertise|cry|announce|post|put (\w+ ){0,3}(up|on the board)|to let|let out)\b/.test(m);
  if (!un && !on) return null;
  let pick = buildingsOf(c, cx, vacant);
  if (pick.ask) return { ask: pick.ask };
  if (!pick.list.length && (EVERY.test(m) || /\b(vacanc(y|ies)|empty|vacant)\b/.test(m))) pick = { list: Object.values(s.buildings).filter(vacant) };
  const places = pick.list.filter(isLeasable);
  if (!places.length) return on && /\bpost\b/.test(m) ? null : { ask: `${un ? 'Take down' : 'Cry'} which house, ${cx.title}?` };
  const moves = places.filter(b => b.units.some(u => !u.tenantId && u.listed === un) || places.length === 1).map(b => mv(cx, { type: 'set_listed', buildingId: b.id, listed: !un }));
  // "list Damp End at 6 crowns": the price goes up on the board with it
  const price = on && !un ? num(m, /\b(?:at|for) (\d+)(?: crowns?| coins?| a month)?\b(?! percent)/) : null;
  if (price !== null && price >= 1) for (const b of places.slice().reverse()) if (b.rent !== price) moves.unshift(mv(cx, { type: 'set_rent', buildingId: b.id, rent: Math.round(price) }));
  if (!moves.length) return { answer: un ? `None of those is on the board, ${cx.title}.` : `Every empty door is already on the board, ${cx.title}.` };
  cx.focusB = places[0] ?? cx.focusB;
  return { moves };
}

function staffIntent(c: Clause, cx: Cx): Out {
  const m = c.m, s = cx.s;
  const roleWord = (/\b(mason|bailiff|crier|steward)\b/.exec(m)?.[1] ?? null) as StaffRole | null;
  if (/\b(hire|engage|employ|appoint|take on|send for|retain|bring on)\b/.test(m)) {
    if (!s.candidates.length) return { answer: `No one is asking for work just now, ${cx.title}.` };
    const named = c.cd.filter(h => h.w >= 2).sort((a, b) => b.quality - a.quality);
    let pick: Candidate | null = named[0]?.item ?? null, guess = false;
    if (!pick && roleWord) {
      const pool = s.candidates.filter(x => x.role === roleWord).sort((a, b) => b.skill - a.skill || a.wage - b.wage);
      if (!pool.length) return { answer: `There is no ${roleWord} to be had just now, ${cx.title}.` };
      pick = pool[0]!; guess = pool.length > 1;
    }
    if (!pick) return { ask: `Hire whom, ${cx.title}? ${listNames(s.candidates.slice(0, 4).map(x => `${x.name}, ${x.role}`))}?` };
    const say = guess ? `Send for ${pick.name} as ${ROLE_TITLES[pick.role]}, the ablest of those asking, at ${pick.wage} crowns a month` : undefined;
    return { moves: [mv(cx, { type: 'hire', candidateId: pick.id }, guess || undefined, say)] };
  }
  const staffHit = c.st.slice().sort((a, b) => b.quality - a.quality)[0]?.item ?? null;
  if (/\b(dismiss|sack|discharge|let go|turn off|get rid of|be rid of|fire|release)\b/.test(m) && staffHit && !(c.t.some(h => h.w >= 2))) {
    return { moves: [mv(cx, { type: 'dismiss_staff', staffId: staffHit.id }, true)] };
  }
  if (staffHit && (/\b(wages?|salary|stipend|pay)\b/.test(m))) {
    const to = num(m, /\bto (\d+)\b/), by = num(m, /\bby (\d+)\b/), bare = num(m, /\b(\d+)\b/);
    const down = /\b(cut|lower|reduce|dock|trim)\b/.test(m);
    const wage = to ?? (by !== null ? staffHit.wage + (down ? -by : by) : bare);
    if (wage === null) return { ask: `${staffHit.first}'s wage to what, ${cx.title}? It stands at ${staffHit.wage}.` };
    return { moves: [mv(cx, { type: 'set_wage', staffId: staffHit.id, wage: Math.max(0, Math.round(wage)) })] };
  }
  return null;
}

function moneyIntent(c: Clause, cx: Cx): Out {
  const m = c.m, s = cx.s;
  if (/\b(feast|banquet|revel|festival|celebration)\b/.test(m) && (/\b(hold|throw|give|call|declare|have|let there be|time for|order|prepare|lay on)\b/.test(m) || c.p.toks.length <= 3)) {
    return { moves: [mv(cx, { type: 'hold_feast' })] };
  }
  if (/\b(give|gift|grant|send|hand|spare|slip|pay|present)\b/.test(m) && /\b\d+\b/.test(m) && !c.st.length) {
    const pick = householdsOf(c, cx);
    if (pick.ask) return { ask: pick.ask };
    const amount = num(m, /\b(\d+)(?: crowns?| coins?| gold| pieces)?\b/);
    if (!pick.list.length || amount === null) return pick.list.length ? { ask: `How many crowns, ${cx.title}?` } : null;
    if (amount < 1) return { ask: `A gift of nothing, ${cx.title}? Name a sum.` };
    cx.focusT = pick.list[0] ?? cx.focusT;
    return { moves: pick.list.map(t => mv(cx, { type: 'gift', tenantId: t.id, amount: Math.round(amount) })) };
  }
  // said to a household's face: "here, take 5 crowns", "ten crowns for your trouble"
  const facing = 'tenantId' in cx.target ? cx.focusT : cx.addressedTenant;
  if (facing && /\b(take|have|keep|accept|here is|here are|heres|for you|for your)\b/.test(m) && !/\b(rents?|fees?|notice|surety|deposit)\b/.test(m)) {
    const amount = num(m, /\b(\d+) (?:crowns?|coins?|gold|pieces)\b/);
    if (amount !== null && amount >= 1) return { moves: [mv(cx, { type: 'gift', tenantId: facing.id, amount: Math.round(amount) })] };
  }
  if (/\b(give|gift|grant|send|spare)\b.*\b(crowns?|coins?|gold|money|something)\b/.test(m) && householdsOf(c, cx).list.length) return { ask: `How many crowns, ${cx.title}?` };
  return null;
}

function callIntent(c: Clause, cx: Cx): Out {
  const m = c.m;
  if (/\b(visit|call on|look in on|drop in on|go and see|go see|pay (\w+ ){1,3}a (call|visit)|check on)\b/.test(m)) {
    const pick = householdsOf(c, cx);
    if (pick.ask) return { ask: pick.ask };
    if (!pick.list.length) return { ask: `Call on whom, ${cx.title}?` };
    cx.focusT = pick.list[0] ?? cx.focusT;
    return { moves: pick.list.slice(0, 4).map(t => mv(cx, { type: 'order_job', kind: 'visit', tenantId: t.id, role: 'ruler' })) };
  }
  if (/\b(inspect|look over|survey|examine|look at the state of)\b/.test(m)) {
    const pick = buildingsOf(c, cx);
    if (pick.ask) return { ask: pick.ask };
    if (!pick.list.length) return { ask: `Look over which house, ${cx.title}?` };
    return { moves: pick.list.slice(0, 4).map(b => mv(cx, { type: 'order_job', kind: 'inspect', buildingId: b.id })) };
  }
  return null;
}

function renameIntent(c: Clause, cx: Cx): Out {
  if (!/\b(rename|call|name|known as|christen)\b/.test(c.m)) return null;
  const hit = c.b.slice().sort((a, b) => b.quality - a.quality)[0];
  const b = hit?.item ?? cx.focusB;
  if (!b) return null;
  const quoted = /["']([^"']{2,40})["']/.exec(cx.raw.replace(/(\w)'(\w)/g, '$1’$2'));
  let name = quoted?.[1]?.replace(/’/g, "'") ?? '';
  if (!name) {
    const from = hit ? hit.at + hit.len : 0;
    let rest = c.p.words.slice(from);
    const lead = rest.findIndex((w, i) => !/^(to|as|is|be|shall|now|henceforth|called|named|renamed|known|it|,)$/i.test(w.replace(/[^a-zA-Z,]/g, '')) && i >= 0);
    rest = lead >= 0 ? rest.slice(lead) : [];
    if (!hit) { const k = rest.findIndex(w => /^(rename|call|name|christen)$/i.test(w)); if (k >= 0) rest = rest.slice(k + 2); }
    name = rest.join(' ').replace(/^[\s"',.]+|[\s"',.!?]+$/g, '');
  }
  name = tidy(name).slice(0, 40).trim();
  if (name.length < 2 || !/[a-zA-Z]/.test(name)) return null;
  if (name === name.toLowerCase()) name = name.replace(/\b[a-z]/g, ch => ch.toUpperCase()).replace(/\b(Of|The|And|In|On|At|Under)\b/g, w => w.toLowerCase()).replace(/^./, ch => ch.toUpperCase());
  if (name.toLowerCase() === b.name.toLowerCase()) return null;
  return { moves: [mv(cx, { type: 'rename_building', buildingId: b.id, name })] };
}

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'it', 'is', 'be', 'i', 'you', 'he', 'she', 'they', 'them', 'him', 'her', 'his', 'their', 'your', 'my', 'me', 'we', 'us', 'this', 'that', 'with', 'as', 'do', 'not', 'no', 'so', 'if', 'will', 'shall', 'have', 'has', 'are', 'was', 'all', 'but', 'by', 'from', 'then', 'here', 'there', 'what', 'ruler', 'wants', 'want', 'lets', 'let', 'them', 'who', 'one', 'only', 'any', 'out', 'up', 'its', 'did', 'can', 'may', 'now', 'must', 'should', 'would', 'could', 'just', 'please', 'very', 'too', 'then', 'well', 'am', 'oh', 'ah', 'ye', 'ay', 'aye', 'sir', 'lord', 'reeve']);
const content = (text: string): Set<string> => new Set(numberize(toks(text)).split(' ').map(stem).filter(t => (t.length >= 2 || /^\d+$/.test(t)) && !STOP.has(t) && t !== '_x_'));
const fillVars = (line: string, inc: Incident): string => line.replace(/\{(\w+)\}/g, (_, k: string) => String(inc.vars[k] ?? ''));

/** A Steward's whisper said word for word settles its own matter, ahead of any other reading. */
function whisperIntent(c: Clause, cx: Cx): Out {
  const said = content(c.m);
  if (said.size < 2) return null;
  const hits: { inc: Incident; out: OutcomeDef }[] = [];
  for (const inc of openIncidents(cx.s)) {
    const def = defOf(inc); if (!def) continue;
    for (const out of def.outcomes) {
      for (const line of [out.label, out.say]) {
        const want = content(fillVars(line, inc));
        if (want.size < 2) continue;
        let both = 0; for (const w of said) if (want.has(w)) both++;
        if (both / Math.max(said.size, want.size) >= 0.8) { hits.push({ inc, out }); break; }
      }
    }
  }
  if (!hits.length) return null;
  let pool = hits;
  if (hits.length > 1) {
    const mine = new Set<Id>([...c.t.map(h => h.item.id), ...c.b.map(h => h.item.id), ...c.ap.map(h => h.item.id)]);
    if (cx.focusT) mine.add(cx.focusT.id); if (cx.focusB) mine.add(cx.focusB.id);
    const near = hits.filter(h => (h.inc.tenantId && mine.has(h.inc.tenantId)) || (h.inc.buildingId && mine.has(h.inc.buildingId)) || (h.inc.applicantId && mine.has(h.inc.applicantId)));
    if (near.length) pool = near;
  }
  // several matters answer to those words: leave it to the plainer readings, which know how to ask
  if (pool.length !== 1) return null;
  return { moves: [mv(cx, { type: 'resolve_incident', incidentId: pool[0]!.inc.id, outcomeId: pool[0]!.out.id })] };
}

/** Last resort: the words match one outcome of a matter that is open (so a whisper typed in the Word box works). */
function outcomeIntent(c: Clause, cx: Cx): Out {
  const s = cx.s, said = content(c.m);
  if (said.size < 1) return null;
  const mine = new Set<Id>([...c.t.map(h => h.item.id), ...c.b.map(h => h.item.id), ...c.ap.map(h => h.item.id)]);
  if (cx.focusT) mine.add(cx.focusT.id); if (cx.focusB) mine.add(cx.focusB.id);
  let pool = openIncidents(s).filter(i => (i.tenantId && mine.has(i.tenantId)) || (i.buildingId && mine.has(i.buildingId)) || (i.applicantId && mine.has(i.applicantId)));
  const scoped = pool.length > 0;
  if (!scoped) pool = openIncidents(s);
  let best: { inc: Incident; out: OutcomeDef; score: number } | null = null, second = 0;
  for (const inc of pool) {
    const def = defOf(inc); if (!def) continue;
    for (const out of def.outcomes) {
      const strong = content(fillVars(out.label, inc) + ' ' + fillVars(out.say, inc)), weak = content(out.intent + ' ' + def.title);
      let score = 0, matched = 0; for (const w of said) { const pts = strong.has(w) ? 2 : weak.has(w) ? 1 : 0; score += pts; if (pts) matched++; }
      score = matched >= 2 ? score / Math.sqrt(Math.max(3, said.size)) : 0;
      if (!best || score > best.score) { second = best?.score ?? 0; best = { inc, out, score }; } else if (score > second) second = score;
    }
  }
  if (!best || best.score < (scoped ? 1.15 : 1.75) || best.score - second < 0.35) return null;
  return { moves: [mv(cx, { type: 'resolve_incident', incidentId: best.inc.id, outcomeId: best.out.id }, !scoped || undefined)] };
}

// ───────────────────────── oaths ─────────────────────────

const OATH_RX = /\b(i (do )?(solemnly )?(swear|promise|vow|pledge)|you have my word|i give (you )?my (word|oath)|(on|upon) my (word|oath|honou?r)|my word on it|my oath on it|i so swear)\b/;
const FIRST_PERSON_PLEDGE = /\b(i will|i shall|ill|i wont|i will not|i shall not|your rent will not|your rent shall not|you will not be|you shall not be|you may stay|you can stay)\b/;

const SEASON_START: Record<string, number> = { spring: 0, summer: 90, autumn: 180, fall: 180, winter: 270 };

/** A due day from words like "before winter", "within the week", "this year". Null when no time is named. */
export function parseDue(m: string, day: number): number | null {
  const today = Math.floor(day), yearStart = today - (today % 360);
  const nextAt = (dayOfYear: number) => { let d = yearStart + dayOfYear; while (d <= today) d += 360; return d; };
  let x: RegExpExecArray | null;
  if ((x = /\b(?:within|in|inside)\s+(?:the\s+)?(?:next\s+)?(\d+(?:\.\d+)?|a|an|the)\s+(day|week|fortnight|month|season|year)s?\b/.exec(m)) || (x = /\b(\d+(?:\.\d+)?|a|an)\s+(day|week|fortnight|month|season|year)s?\s+(?:from now|hence)\b/.exec(m)) || (x = /\bfor\s+(?:the\s+next\s+|at least\s+)?(\d+(?:\.\d+)?|a|an|1)\s+(day|week|fortnight|month|season|year)s?\b/.exec(m))) {
    const n = /^\d/.test(x[1]!) ? Number(x[1]) : 1;
    const unit = { day: 1, week: 7, fortnight: 14, month: 30, season: 90, year: 360 }[x[2]!] ?? 30;
    return today + Math.max(1, Math.round(n * unit));
  }
  if (/\b(tomorrow|by morning)\b/.test(m)) return today + 1;
  if (/\b(today|tonight|by sundown|by nightfall|this very day|at once)\b/.test(m)) return today + 1;
  if (/\b(this week|within the week|by weeks? end|in a week|a week)\b/.test(m)) return today + 7;
  if (/\bfortnight\b/.test(m)) return today + 14;
  if (/\b(rent day|months? end|end of the month|this month)\b/.test(m)) return today - (today % 30) + 30;
  if (/\bfirst frost\b/.test(m)) return nextAt(270);
  if (/\bharvest\b/.test(m)) return nextAt(180);
  if (/\bthe rains\b/.test(m)) return Math.min(nextAt(0), nextAt(180));
  if (/\bthe snows?\b/.test(m)) return nextAt(270);
  if ((x = /\b(this|all|through(?:out)?|over|for the|during(?: the)?|until the end of|till the end of)\s+(?:the\s+|this\s+)?(winter|spring|summer|autumn|fall)\b/.exec(m))) {
    // the end of that season: the one we are in, or the next to come
    const start = SEASON_START[x[2]!]!; let end = yearStart + start + 90; while (end <= today) end += 360; return end;
  }
  if ((x = /\b(?:by|before|until|till|ere|come)\s+(?:the\s+)?(?:start of\s+|end of\s+)?(?:the\s+)?(?:next\s+)?(winter|spring|summer|autumn|fall)\b/.exec(m))) return nextAt(SEASON_START[x[1]!]!);
  for (let i = 0; i < MONTH_NAMES.length; i++) if (new RegExp(`\\b${MONTH_NAMES[i]!.toLowerCase().replace(/-/g, ' ?')}\\b`).test(m)) return nextAt(i * 30);
  if (/\b(next year)\b/.test(m)) return yearStart + 720;
  if (/\b(this year|years? end|end of the year|the year is out|a year|twelvemonth)\b/.test(m)) return /\ba year\b/.test(m) && !/\bthis year\b/.test(m) ? today + 360 : yearStart + 360;
  if (/\b(ever|never|as long as i (rule|live|reign)|so long as|while i (rule|live|reign)|for good|always)\b/.test(m)) return today + 3600;
  return null;
}

const DEFAULT_DUE: Record<OathKind, number> = { repair: 45, pay: 30, build: 120, no_rent_raise: 360, no_evict: 360, rent_cap: 360, word: 90 };
export function defaultDue(kind: OathKind, day: number): number { return Math.floor(day) + DEFAULT_DUE[kind]; }

function oathIntent(c: Clause, cx: Cx): Out {
  const m = c.m, s = cx.s;
  const tenant = c.t.filter(h => h.w >= 2).sort((a, b) => b.quality - a.quality)[0]?.item ?? cx.focusT ?? cx.addressedTenant;
  const bHit = c.b.slice().sort((a, b) => b.quality - a.quality)[0]?.item ?? null;
  const home = tenant?.buildingId ? s.buildings[tenant.buildingId] ?? null : null;
  let kind: OathKind = 'word', buildingId: Id | null = null, buildingType: BuildingType | null = null, amount: number | null = null;
  const capAt = /\brent\b[^0-9]{0,40}\b(?:at or under|at most|no more than|under|below|not above|above|over|past|beyond|at)\s*(\d+)\b/.exec(m);
  const typeHit = BUILDING_TYPES.find(t => typeAliases(t).some(a => new RegExp(`\\b(?:build|raise|put up|construct|have built|erect|found)\\b.{0,24}\\b${a.join(' ')}\\b`).test(m)));
  if (typeHit) { kind = 'build'; buildingType = typeHit; }
  else if (capAt && tenant && /\b(keep|hold|cap|stay|remain|never|not|no)\b/.test(m)) { kind = 'rent_cap'; amount = Number(capAt[1]); }
  else if (tenant && /\brents?\b/.test(m) && /\b(not|never|no|wont)\b.{0,30}\b(raise|increase|put up|lift|rise|go up|move|change|climb)\b|\b(hold|freeze|keep)\b.{0,20}\brents?\b/.test(m)) kind = 'no_rent_raise';
  else if (tenant && (/\b(not|never|no|wont)\b.{0,30}\b(evict(ed)?|put (\w+ )?out|turned? (\w+ )?out|thrown? (\w+ )?out|notice|court)\b/.test(m) || /\b(may|can|will|shall) (stay|remain|keep (your|the|his|her|their) (home|roof|hearth))\b/.test(m) || /\b(roof|home|hearth) (is|will be|shall be|stays?) (yours|safe)\b/.test(m))) kind = 'no_evict';
  else if ((REPAIR_RX.test(m) || RENOVATE_RX.test(m) || /\b(mended|fixed|repaired|sound|made good|seen to)\b/.test(m)) && (bHit || home || cx.focusB)) { kind = 'repair'; buildingId = (bHit ?? home ?? cx.focusB)!.id; }
  else if (tenant && /\b(pay|give|grant|send|owe|hand)\b/.test(m) && /\b\d+\b/.test(m)) { kind = 'pay'; amount = num(m, /\b(\d+)(?: crowns?| coins?| gold)?\b/); }
  const dueDay = Math.max(Math.floor(s.day) + 1, parseDue(m, s.day) ?? defaultDue(kind, s.day));
  const occupant = !tenant && buildingId ? tenantsIn(s, s.buildings[buildingId]!)[0] ?? null : null;
  const to = tenant ?? occupant;
  const text = clip(cx.raw.replace(/^\s*[A-Z][a-z]+\s*,\s*/, ''), 160);
  const action: Action = { type: 'swear_oath', oath: { kind, text, toTenantId: to?.id ?? null, toName: to?.name ?? 'the realm', buildingId, buildingType, amount, dueDay } };
  return { moves: [mv(cx, action)] };
}

// ───────────────────────── questions, courtesies ─────────────────────────

function happinessWord(h: number): string { return h < 25 ? 'miserable' : h < 45 ? 'unhappy' : h < 70 ? 'content' : h < 88 ? 'happy' : 'delighted'; }

function questionIntent(c: Clause, cx: Cx): Out {
  const m = c.m, s = cx.s, T = cx.title;
  const asks = PURE_QUESTION.test(m) || /^(when|do|list|show me|have|has|can)\b/.test(m) || /\?\s*$/.test(cx.raw);
  if (!asks) return null;
  const roll = housedTenants(s).reduce((n, t) => n + (t.lease?.rent ?? 0), 0);
  if (/\b(gold|coin|crowns|money|coffers?|treasury|rich|afford)\b/.test(m)) return { answer: `The coffers hold ${plural(Math.round(s.gold), 'crown')}, ${T}. The rent roll is ${roll} a month.` };
  if (/\b(late|owes?|behind|arrears|not paid|unpaid|debtors?)\b/.test(m)) {
    const late = housedTenants(s).filter(t => t.arrears > 0).sort((a, b) => b.arrears - a.arrears);
    return { answer: late.length ? `${listNames(late.slice(0, 3).map(t => `${t.name} owes ${t.arrears}`), 'and')}${late.length > 3 ? `, and ${late.length - 3} more besides` : ''}, ${T}.` : `Nobody is behind with the rent, ${T}. It will not last.` };
  }
  if (/\b(mending|fixing|repairs?|broken|worst|falling down|shabb|leak)/.test(m)) {
    const worst = Object.values(s.buildings).filter(b => b.state === 'ready' && b.condition < 70).sort((a, b) => a.condition - b.condition).slice(0, 3);
    return { answer: worst.length ? `${cap(listNames(worst.map(b => `${mid(b.name)} stands at ${Math.round(b.condition)} in a hundred`), 'and'))}, ${T}.` : `Everything is sound, ${T}, by the standards of the parish.` };
  }
  if (/\b(vacan|empty|to let|unlet)/.test(m)) {
    const empty = Object.values(s.buildings).filter(b => b.state === 'ready' && b.units.some(u => !u.tenantId));
    return { answer: empty.length ? `${cap(listNames(empty.slice(0, 4).map(b => mid(b.name)), 'and'))} ${empty.length > 1 ? 'stand' : 'stands'} empty, ${T}.` : `Every door has someone behind it, ${T}.` };
  }
  if (/\b(what day|what date|the date|what month|what season|rent day|what time)\b/.test(m)) {
    const left = 30 - (Math.floor(s.day) % 30);
    return { answer: `It is the ${fmtDate(s.day)}, ${T}. Rent Day is ${left >= 30 ? 'today' : `in ${plural(left, 'day')}`}.` };
  }
  if (/\b(renown|reputation|standing|favou?r|crown think)\b/.test(m)) return { answer: `Your renown stands at ${Math.round(s.renown)} in a hundred, ${T}, and the Crown's favour at ${Math.round(s.favor)}.` };
  if (/\borders?\b/.test(m)) return { answer: s.orders.length ? `${cap(plural(s.orders.length, 'standing order'))}, ${T}: ${clip(s.orders.slice(0, 3).map(o => `"${o.gist.replace(/[.!?]+$/, '')}"`).join(', '), 130)}` : `No standing orders, ${T}. Everyone asks you everything.` };
  if (/\b(oaths?|promises?|sworn|swore)\b/.test(m)) {
    const open = s.oaths.filter(o => o.state === 'open');
    return { answer: open.length ? `${cap(plural(open.length, 'oath'))} open, ${T}. The nearest: "${clip(open.slice().sort((a, b) => a.dueDay - b.dueDay)[0]!.text, 90)}"` : `You have sworn nothing that is still owing, ${T}.` };
  }
  if (/\b(squatters?|goblins|trespassers|interlopers)\b/.test(m)) {
    const held = Object.values(s.buildings).filter(b => b.squatters);
    if (held.length) return { answer: `${cap(listNames(held.slice(0, 3).map(b => `${spoken(b.squatters!.kind)} hold ${mid(b.name)}`), 'and'))}, ${T}. They have not asked for a lease.` };
    if (/\bsquatters?\b/.test(m)) return { answer: `No one is living anywhere unasked, ${T}. As far as the roll knows.` };
  }
  const t = c.t.filter(h => h.w >= 2).sort((a, b) => b.quality - a.quality)[0]?.item;
  if (t) return { answer: `${t.name}: ${t.species} ${spoken(t.trade)}, ${happinessWord(t.happiness)}, pays ${t.lease?.rent ?? 0} a month${t.arrears > 0 ? `, owes ${t.arrears}` : ''}, ${T}.` };
  const st = c.st.slice().sort((a, b) => b.quality - a.quality)[0]?.item;
  if (st && /\b(where|who|busy|free|doing|paid|wages?|working|work|up to|idle)\b/.test(m)) {
    const actor = st.actorId ? s.actors[st.actorId] : null, job = actor?.jobId ? s.jobs[actor.jobId] : null;
    const where = job?.buildingId ? s.buildings[job.buildingId] : null;
    const doing = job ? `at work${where ? ' at ' + mid(where.name) : ''}` : 'at liberty';
    return { answer: `${st.name}, your ${ROLE_TITLES[st.role]}: ${doing}, paid ${st.wage} a month, ${T}.` };
  }
  const b = c.b.slice().sort((a, b2) => b2.quality - a.quality)[0]?.item;
  if (b) {
    const who = tenantsIn(s, b).map(x => x.name);
    return { answer: `${b.name}: condition ${Math.round(b.condition)} in a hundred${isLeasable(b) ? `, asks ${b.rent} a month, ${who.length ? 'home to ' + listNames(who, 'and') : 'standing empty'}` : ''}, ${T}.` };
  }
  return null;
}

function courtesyIntent(c: Clause, cx: Cx): Out {
  const m = c.m, T = cx.title;
  if (/^(help|what can (i|you)|what do you understand|how do i)\b/.test(m)) return { answer: `Plain orders serve best, ${T}: ${hintsFor(cx.s, cx.addressed).join(', ')}.` };
  if (/\b(thank|thanks|well done|good work|good job|bravo|nicely done)\b/.test(m)) return { answer: pickStable([`${cap(T)}.`, `Kind of you to notice, ${T}.`, `It is the work, ${T}. But I will take it.`], cx.raw), mood: 'pleased', own: true };
  if (/\b(fool|idiot|useless|lazy|dolt|oaf|blockhead|numbskull|knave|wretch|clod|dunce|incompetent)\b/.test(m)) return { answer: '__grumble__', mood: 'annoyed', own: true };
  if (/^(hello|hail|good (morrow|morning|day|evening|afternoon)|greetings|well met|hey|hi|ho there|how (are|fare) you|how goes it)\b/.test(m)) return { answer: pickStable([`${cap(T)}. What is to be done?`, `At your service, ${T}. As ever.`, `Good day, ${T}. Nothing is on fire. I checked.`], cx.raw), mood: 'neutral', own: true };
  return null;
}

function hintsFor(s: GameState, role: StaffRole | null): string[] {
  const ready = Object.values(s.buildings).filter(b => b.state === 'ready');
  const worst = ready.slice().sort((a, b) => a.condition - b.condition)[0];
  const late = housedTenants(s).find(t => t.arrears > 0);
  const empty = ready.find(b => b.units.some(u => !u.tenantId));
  const let1 = ready.find(isLeasable);
  const mend = `"mend ${worst ? mid(worst.name) : 'the roof'}"`;
  switch (role) {
    case 'mason': return [mend, '"patch it cheap"'];
    case 'bailiff': return ['"collect the rents"', late ? `"serve notice on ${late.first}"` : '"never evict a widow in winter"'];
    case 'crier': return [empty ? `"cry ${mid(empty.name)} as to let"` : '"list the vacancies"', '"show the applicant round"'];
    case 'steward': return [let1 ? `"set the rent at ${mid(let1.name)} to ${let1.rent + 1}"` : '"hold a feast"', '"three days of grace"'];
    default: return ['"collect the rents"', mend];
  }
}

// ───────────────────────── read-backs ─────────────────────────

const HERALD_ACKS = ['So noted. {order}.', '{order}. It is entered in the roll.', 'The clerk has it: {order}.', '{order}. Duly minuted.', 'Very good. {order}.'];
const HERALD_GRUMBLES = ['The clerk regrets.', 'It cannot be entered.', 'There is a difficulty.', 'The roll will not take it.'];
const REEVE_ACKS = ['{order}. You will be seeing to it yourself, {title}, the household being you.', 'So noted. {order}. The clerk wishes you a pleasant walk.'];
const CONFIRM_TAILS = ['Is that your word, {title}?', 'Do I have it right, {title}?', 'Your aye, {title}?'];
const TENANT_OATH = ['I will hold you to that, {title}.', 'Your word, then. I have a good memory for words, {title}.', 'Sworn, is it. The whole lane will know by supper, {title}.'];
const TENANT_GIFT = ['Crowns. For us. Well. Thank you, {title}.', 'I will not ask why. Thank you, {title}.', 'That is kindly done, {title}. I shall tell them at the well.'];
const TENANT_GREET = ['{title}. To what do we owe it?', 'Good day, {title}. The rent is not due, is it?', '{title}. Mind the step. It is on the list.'];
const TENANT_LOST = ['I did not follow that, {title}. Is it about the rent?', 'You will have to say that plainer, {title}. I am only a tenant.'];

/** Put a restated order into an ack template, minding capitals and full stops. */
export function fillAck(template: string, order: string, title: string): string {
  const o = order.replace(/[.!?]+$/, '');
  // the temperament lines were written with "my lord"; a Knight is "Sir", as the closing question already says
  let t = template.replace(/\{title\}/g, title).replace(/\bmy lord\b/g, title);
  if (!t.includes('{order}')) return tidy(`${t} ${cap(o)}.`);
  const keepCap = KEEP_CAP.test(o);
  // a capital after a full stop, none after a colon or in mid-sentence
  t = t.replace(/([.!?:]\s+)?\{order\}/g, (_m, lead: string | undefined, at: number) => (lead !== undefined && !lead.startsWith(':') ? lead + cap(o) : (lead ?? '') + (at === 0 && lead === undefined ? cap(o) : keepCap ? o : lower1(o))));
  return tidy(/[.!?]$/.test(t) ? t : t + '.');
}

/** The listener's line of complaint, for refusals. */
export function grumbleOf(s: GameState, role: StaffRole | 'herald' | 'tenant', seed: string): string {
  const def = role !== 'herald' && role !== 'tenant' ? temperamentOf(staffByRole(s, role)) : null;
  const pool = def?.grumbles?.length ? def.grumbles : HERALD_GRUMBLES;
  return tidy(pickStable(pool, seed).replace(/\{title\}/g, titleOf(s)).replace(/\bmy lord\b/g, titleOf(s)).replace(/\{order\}/g, 'that'));
}

const KEEP_CAP = /^(Notice to Quit|Sworn\b|\d)/;
const soft = (o: string) => (KEEP_CAP.test(o) ? o : lower1(o));

/** Orders that differ only in a closing name are said once: "A call on Wat Mudge and Tam Reedy". */
function gather(says: string[]): string[] {
  if (says.length < 2) return says;
  const words = says.map(x => x.split(' '));
  let n = 0;
  while (words.every(w => n < w.length - 1 && w[n] === words[0]![n])) n++;
  const rest = words.map(w => w.slice(n).join(' '));
  if (n < 2 || rest.some(r => /[,;:.!?]/.test(r)) || new Set(rest).size !== rest.length) return says;
  const names = rest.length > 4 ? `${rest.slice(0, 3).join(', ')} and ${rest.length - 3} more` : `${rest.slice(0, -1).join(', ')} and ${rest[rest.length - 1]}`;
  return [`${words[0]!.slice(0, n).join(' ')} ${names}`];
}

/**
 * A read-back for moves the listener understood, in their voice: the order
 * restated inside one of their `acks`, then any asides (an oath in the way, a
 * hand-over), then the question that waits for the "aye". Fits 200 characters.
 */
export function readBack(s: GameState, role: StaffRole | 'herald', says: string[], confirm: boolean, seed: string, asides: string[] = [], shortAsides: string[] = asides, legwork = false, plain = false): string {
  const title = titleOf(s);
  says = gather(says);
  const staff = role === 'herald' ? null : staffByRole(s, role);
  const def = temperamentOf(staff);
  let pool = def?.acks?.length ? def.acks : HERALD_ACKS;
  // a Reeve has no household: work that means walking somewhere is the Reeve's own, and the clerk sometimes says so
  if (legwork && !staff && s.realm.rank === 'reeve' && !Object.keys(s.staff).length && !confirm && pickStable([0, 1, 2], seed + 'r') === 0) pool = REEVE_ACKS;
  const ask = confirm ? ' ' + pickStable(CONFIRM_TAILS, seed + 'c').replace(/\{title\}/g, title) : '';
  // `plain`: the work is someone else's, so the speaker restates it without promising how they would go about it
  const template = plain ? '{order}.' : pickStable(pool, seed);
  const join = (xs: string[]) => (xs.length ? ' ' + xs.join(' ') : '');
  // an aside is said in full when there is room, and in brief when there is not
  const tail = (line: string) => (line.length + join(asides).length + ask.length <= 200 ? join(asides) : join(shortAsides)) + ask;
  const fits = (line: string) => line.length + join(shortAsides).length + ask.length <= 200;
  // as many restatements as fit in 200 characters
  let order = says[0] ?? 'As you say';
  for (let i = 1; i < says.length; i++) {
    const more = says.length - i - 1;
    const next = `${order}; ${soft(says[i]!)}`;
    if (!fits(fillAck(template, next + (more ? `; and ${more} more besides` : ''), title))) { order += `; and ${says.length - i} more besides`; break; }
    order = next;
  }
  let line = fillAck(template, order, title);
  if (!fits(line)) line = fillAck('{order}.', order, title);
  if (!fits(line)) line = clip(line, Math.max(60, 200 - join(shortAsides).length - ask.length));
  return tidy(line + tail(line));
}

// ───────────────────────── the parser ─────────────────────────

export interface OfflineResult {
  understood: boolean;
  speaker: StaffRole | 'herald' | 'tenant';
  /** set when the speaker is a household */
  tenantId: Id | null;
  moves: Move[];
  confirm: boolean;
  reply: string;
  mood: Mood;
}

/** A question asks; it never orders. ("Can you mend the roof" is an order with manners, and is not caught here.) */
const PURE_QUESTION = /^(what|how|who|whom|whose|which|where|why|is|are|was|were|does|did|when (is|are|does|do|did|will|was|shall)|do (we|i|they|you|any)|has (anyone|any|the)|have (we|i|they|any)|any|tell me|(should|shall|ought|must|may|might) (i|we)|would it)\b/;

function parseClause(c: Clause, cx: Cx): Out {
  if (PURE_QUESTION.test(c.m)) return whisperIntent(c, cx) ?? questionIntent(c, cx) ?? courtesyIntent(c, cx);
  return whisperIntent(c, cx) ?? forbiddenIntent(c, cx) ?? petIntent(c, cx) ?? policyIntent(c, cx) ?? revokeIntent(c, cx) ?? squatterIntent(c, cx) ?? staffIntent(c, cx)
    ?? collectIntent(c, cx) ?? lateIntent(c, cx) ?? rentIntent(c, cx) ?? repairIntent(c, cx) ?? lettingIntent(c, cx)
    ?? moneyIntent(c, cx) ?? callIntent(c, cx) ?? renameIntent(c, cx) ?? questionIntent(c, cx) ?? outcomeIntent(c, cx) ?? courtesyIntent(c, cx);
}

/**
 * Understand a plain command with no model. Returns the moves, who answers,
 * and their read-back. Never dispatches anything.
 */
export function parseOffline(text: string, target: SpeakTarget, s: GameState, seed = ''): OfflineResult {
  const title = titleOf(s), raw = text.trim();
  const sd = seed || `${raw}|${Math.floor(s.day)}`;
  const targetRole: StaffRole | null = 'to' in target && target.to !== 'court' ? target.to : null;
  const targetTenant = 'tenantId' in target ? s.tenants[target.tenantId] ?? null : null;
  const targetBuilding = 'buildingId' in target ? s.buildings[target.buildingId] ?? null : null;
  const cx: Cx = {
    s, lex: buildLex(s), target, title, raw,
    focusB: targetBuilding ?? (targetTenant?.buildingId ? s.buildings[targetTenant.buildingId] ?? null : null),
    focusT: targetTenant ?? null,
    addressed: targetRole, addressedTenant: null,
  };
  const fallbackSpeaker = (): StaffRole | 'herald' => (cx.addressed && staffByRole(s, cx.addressed) ? cx.addressed : 'herald');
  const lost = (line: string, mood: Mood = 'neutral'): OfflineResult => targetTenant
    ? { understood: false, speaker: 'tenant', tenantId: targetTenant.id, moves: [], confirm: false, reply: clip(line, 200), mood }
    : { understood: false, speaker: fallbackSpeaker(), tenantId: null, moves: [], confirm: false, reply: clip(line, 200), mood };
  if (!raw) return lost(`You said nothing, ${title}. I have written it down all the same.`);

  let p = prep(raw.slice(0, 600));
  if (!p.toks.length) return lost(`You said nothing, ${title}. I have written it down all the same.`);

  // "Hob, ..." / "Bailiff: ..." / "Marta, ..." names who is spoken to
  if (p.toks.length > 1) {
    const lead: Prep = { words: p.words.slice(0, 2), toks: p.toks.slice(0, 2), ends: [false, false] };
    const called = /[,:]$/.test(p.words[0]!) || /[,:]$/.test(p.words[1] ?? '');
    const st = scan(lead, cx.lex.staff, 's').filter(h => h.at === 0).sort((a, b) => b.quality - a.quality)[0];
    const tn = scan(lead, cx.lex.tenants, 't').filter(h => h.at === 0 && h.w >= 2).sort((a, b) => b.quality - a.quality)[0];
    const cut = (n: number) => { p = { words: p.words.slice(n), toks: p.toks.slice(n), ends: p.ends.slice(n) }; };
    if (st && (called || st.w >= 2) && /[,:]$/.test(p.words[st.len - 1] ?? '') ) { if (!targetRole) cx.addressed = st.item.role; cut(st.len); }
    else if (st && st.w >= 2 && !VERBS.has(p.toks[0]!) && VERBS.has(p.toks[st.len] ?? '')) { if (!targetRole) cx.addressed = st.item.role; cut(st.len); }
    else if (tn && /,$/.test(p.words[tn.len - 1] ?? '') && !targetTenant) { cx.addressedTenant = tn.item; cx.focusT = tn.item; cx.focusB = tn.item.buildingId ? s.buildings[tn.item.buildingId] ?? null : cx.focusB; cut(tn.len); }
  }
  if (!p.toks.length) return lost(`Yes, ${title}?`);

  const whole = makeClause(p, cx);
  const speakingToTenant = targetTenant ?? cx.addressedTenant;
  const outs: Out[] = [];
  if (OATH_RX.test(whole.m) || (speakingToTenant && FIRST_PERSON_PLEDGE.test(whole.m) && !/\b(evict|notice|court|raise your rent)\b/.test(whole.m.replace(/\b(not|never|wont)\b.*$/, '')))) outs.push(oathIntent(whole, cx));
  else if (STANDING_RX.test(whole.m) && !/^(what|which|who|how)\b/.test(whole.m)) outs.push(policyIntent(whole, cx) ?? standingIntent(whole, cx));
  else {
    // a whisper said whole (they often run to two or three sentences) is tried before the words are split up
    const whisper = whisperIntent(whole, cx);
    if (whisper) outs.push(whisper);
    else for (const part of splitClauses(p)) outs.push(parseClause(makeClause(part, cx), cx));
  }

  const ask = outs.find((o): o is { ask: string } => !!o && 'ask' in o);
  // a question back to the ruler is the court's to put, whoever was being spoken to
  if (ask) return { understood: false, speaker: fallbackSpeaker(), tenantId: null, moves: [], confirm: false, reply: clip(ask.ask, 200), mood: 'worried' };
  const seen = new Set<string>();
  const moves = outs.flatMap(o => (o && 'moves' in o ? o.moves : [])).filter(x => { const k = JSON.stringify(x.action); if (seen.has(k)) return false; seen.add(k); return true; });
  const answers = outs.filter((o): o is { answer: string; mood?: Mood; own?: boolean } => !!o && 'answer' in o);

  if (!moves.length && answers.length) {
    const a = answers[0]!;
    const namedStaff = whole.st.filter(h => h.w >= 2).sort((x, y) => y.quality - x.quality)[0]?.item;
    if (!cx.addressed && namedStaff) cx.addressed = namedStaff.role;
    // a household answers a courtesy paid to it; facts and figures are the clerk's to give
    const who = speakingToTenant && !targetRole && a.own ? 'tenant' as const : fallbackSpeaker();
    let line = a.answer;
    if (line === '__grumble__') line = who === 'tenant' ? `There is no call for that, ${title}.` : grumbleOf(s, who, sd);
    if (who === 'tenant' && courtesyOnly(whole.m)) line = tenantLine(speakingToTenant!, 'greet', title, sd);
    return { understood: true, speaker: who, tenantId: who === 'tenant' ? speakingToTenant!.id : null, moves: [], confirm: false, reply: clip(line, 200), mood: a.mood ?? 'neutral' };
  }
  if (!moves.length) {
    if (speakingToTenant && !targetRole) return { understood: false, speaker: 'tenant', tenantId: speakingToTenant.id, moves: [], confirm: false, reply: tenantLine(speakingToTenant, 'lost', title, sd), mood: 'worried' };
    if (PURE_QUESTION.test(whole.m)) return lost(`That I cannot tell you, ${title}. Ask who is late, what needs mending, what stands empty, or what the coffers hold.`);
    return lost(`I did not catch an order in that, ${title}. Plain words serve best: ${hintsFor(s, cx.addressed).join(', ')}.`);
  }

  const weight = weigh(moves.map(x => x.action), s);
  const confirm = weight.confirm || moves.some(x => x.confirm);
  // who answers: a household for what was promised or given to its face, else whoever was addressed, else whose trade it is
  const personal = moves.every(x => x.action.type === 'swear_oath' || x.action.type === 'gift');
  if (personal && speakingToTenant && !targetRole) {
    const kind = moves[0]!.action.type === 'gift' ? 'gift' : 'oath';
    return { understood: true, speaker: 'tenant', tenantId: speakingToTenant.id, moves, confirm, reply: clip(`${tenantLine(speakingToTenant, kind, title, sd)}`, 200), mood: 'pleased' };
  }
  let speaker: StaffRole | 'herald' = 'herald';
  if (cx.addressed && staffByRole(s, cx.addressed)) speaker = cx.addressed;
  else { const r = moves.map(x => x.role).find((x): x is StaffRole => !!x && !!staffByRole(s, x)); if (r) speaker = r; }
  // spoken to the wrong delegate: they pass it on
  const owner = moves[0]!.role;
  const handOver = speaker !== 'herald' && owner && owner !== speaker && staffByRole(s, owner) && moves.every(x => x.role === owner)
    ? [`Not my trade. I will tell ${staffByRole(s, owner)!.first}.`] : [];
  const legwork = moves.some(x => x.action.type === 'order_job' || x.action.type === 'collect_all' || x.action.type === 'collect_purse'
    || (x.action.type === 'resolve_incident' && !!defOf(s.incidents[x.action.incidentId] ?? ({ defId: '' } as Incident))?.outcomes.find(o => o.id === (x.action as { outcomeId: string }).outcomeId)?.job));
  const reply = readBack(s, speaker, moves.map(x => x.say), confirm, sd, [...weight.warnings, ...handOver], [...weight.oaths.map(o => oathWarning(o, true)), ...handOver], legwork, handOver.length > 0);
  return { understood: true, speaker, tenantId: null, moves, confirm, reply, mood: confirm ? 'worried' : 'neutral' };
}

function courtesyOnly(m: string): boolean { return /^(hello|hail|good (morrow|morning|day|evening|afternoon)|greetings|well met|hey|hi|ho there|how (are|fare) you|how goes it)\b/.test(m); }

function tenantLine(t: Tenant, kind: 'oath' | 'gift' | 'greet' | 'lost', title: string, seed: string): string {
  const ch = t.character ? CHARACTERS.find(c => c.id === t.character) : undefined;
  let line = '';
  if (ch && kind === 'gift') line = ch.lines.thanks;
  else if (ch && kind === 'greet') line = t.arrears > 0 ? ch.lines.late : t.happiness < 40 ? ch.lines.complain : ch.lines.greet;
  if (!line) {
    if (kind === 'greet' && t.arrears > 0) line = 'Before you say anything, {title}: I know what day it is.';
    else line = pickStable(kind === 'oath' ? TENANT_OATH : kind === 'gift' ? TENANT_GIFT : kind === 'greet' ? TENANT_GREET : TENANT_LOST, seed + t.id);
  }
  return tidy(line.replace(/\{title\}/g, title).replace(/\{first\}/g, t.first).replace(/\{tenant\}/g, t.name).replace(/\{\w+\}/g, ''));
}
