/**
 * OWNER: sim-decide agent. Interprets data-driven Effect lists by calling the
 * owning modules. Every Effect variant in data/schema.ts is handled here.
 *
 * Rules of the house:
 *  - Household effects (happiness scope 'tenant', arrears, memory, rent, trait,
 *    pet...) land on the incident's household. When the incident targets a
 *    building they land on whoever lives there, and do nothing if it is empty.
 *  - An applicant who signs becomes a tenant with the same household id, so
 *    effects listed after `lease` follow them through the door.
 *  - Unknown or impossible effects are skipped silently. Nothing here throws:
 *    a bad effect in one incident must never stop the world.
 */
import type {
  GameState, Id, Tenant, Building, DecisionOption, ExpenseCat, IncomeCat, MoveOutReason, Applicant,
} from './types';
import type { Effect } from '../data/schema';
import type { Species, TradeId, PetKind, TraitId } from '../data/ids';
import { PET_KINDS } from '../data/ids';
import { fill, herald, rand, newId } from './core';
import { earn, spend } from './economy';
import { changeRenown, changeFavor } from './renown';
import {
  changeHappiness, addMemory, revealTrait, moveOut, moveIn, rollHousehold, spawnApplicant,
  tenantsOf, neighborsOf, housed,
} from './tenants';
import * as tenantsApi from './tenants';
import {
  applyLateOption, applyDeposit, applyLease, screen, addArrears, forgiveArrears, changeLeaseRent, evict,
} from './rent';
import { damageBuilding, repairBuilding, addVisual, removeVisual, setSquatters, vacancies } from './buildings';
import { swear } from './oaths';
import { changeLoyalty } from './staff';

export interface EffectCtx {
  buildingId?: Id | null; unit?: number | null; tenantId?: Id | null; applicantId?: Id | null;
  incidentId?: Id | null; vars?: Record<string, string | number>;
  /** what this is about, for ledger memos and reasons ("The Unauthorized Griffin") */
  title?: string;
  /** the decision option that was chosen, when there was one */
  option?: DecisionOption | null;
  /** multiplies repairs (positive `condition`): the hand that did the work */
  quality?: number;
}

export const TUNE = {
  /** radius, in tiles, of scope 'neighbors' */
  neighborRadius: 4,
  /** squatters who sign pay this share of the asking rent */
  squatterLeasePct: 80,
  /** effects that failed (another module threw). Kept for tests and bots; capped. */
  errors: [] as { effect: string; error: string }[],
};

// ───────────── words ─────────────

const VOWEL = /^[aeiou]/i;
const CONSONANT_SOUND = /^(?:uni|use|usu|eu|ewe|one\b|once\b)/i;

/** core.fill, minding the article: "a {species} {trade}" reads "an elf farmer" when the household is elves. */
export function fillText(template: string, vars: Record<string, string | number | undefined>): string {
  const minded = template.replace(/\b(an?)(\s+)\{(\w+)\}/gi, (whole, article: string, gap: string, key: string) => {
    const v = vars[key];
    if (typeof v !== 'string' || !v) return whole;                    // numbers and blanks are left as written
    const an = VOWEL.test(v) && !CONSONANT_SOUND.test(v);
    return `${article[0]}${an ? 'n' : ''}${gap}{${key}}`;
  });
  // a placeholder that opens a sentence ("{title}", "{mason}" as "my lord", "the Mason") is capitalised there
  const opened = minded.replace(/(^|[.!?]["']?\s+)\{(\w+)\}/g, (whole, pre: string, key: string) => {
    const v = vars[key];
    return typeof v === 'string' && /^[a-z]/.test(v) ? `${pre}${v[0]!.toUpperCase()}${v.slice(1)}` : whole;
  });
  return fill(opened, vars);
}

// ───────────── the owner's hands, where the owner offers them ─────────────
// tenants.ts has grown functions for quirks, pets and housing a household outright. They are not in the
// frozen signatures, so they are looked up by name: used when present, and done by hand when not.

type TenantsExtra = {
  addTrait?: (s: GameState, tenantId: Id, trait: TraitId, revealed?: boolean) => void;
  removeTrait?: (s: GameState, tenantId: Id, trait: TraitId) => void;
  addPet?: (s: GameState, tenantId: Id, pet: PetKind) => void;
  removePets?: (s: GameState, tenantId: Id) => void;
  houseDirectly?: (s: GameState, household: Applicant['household'], buildingId: Id, unit: number, rent?: number, opts?: { deposit?: number }) => Tenant | null;
};
const extra = (): TenantsExtra => tenantsApi as unknown as TenantsExtra;

function giveTrait(s: GameState, t: Tenant, trait: TraitId, revealed: boolean): void {
  const fn = extra().addTrait;
  if (typeof fn === 'function') { fn(s, t.id, trait, revealed); return; }
  if (!t.traits.includes(trait)) t.traits.push(trait);
  if (revealed && !t.revealed.includes(trait)) t.revealed.push(trait);
}
function takeTrait(s: GameState, t: Tenant, trait: TraitId): void {
  const fn = extra().removeTrait;
  if (typeof fn === 'function') { fn(s, t.id, trait); return; }
  t.traits = t.traits.filter(x => x !== trait);
  t.revealed = t.revealed.filter(x => x !== trait);
}
function givePet(s: GameState, t: Tenant, pet: PetKind): void {
  const fn = extra().addPet;
  if (typeof fn === 'function') { fn(s, t.id, pet); return; }
  if (!t.pets.includes(pet)) t.pets.push(pet);
}
function takePets(s: GameState, t: Tenant, only: PetKind | null): void {
  if (only && t.pets.includes(only)) { t.pets = t.pets.filter(p => p !== only); return; }   // the one the matter was about
  const fn = extra().removePets;
  if (typeof fn === 'function') { fn(s, t.id); return; }
  t.pets = [];
}

// ───────────── who and where ─────────────

interface Scope {
  s: GameState;
  ctx: EffectCtx;
  vars: Record<string, string | number>;
  /** id the applicant's household will carry once it is a tenant */
  householdId: Id | null;
}

function primaryTenant(sc: Scope): Tenant | null {
  const { s, ctx } = sc;
  if (ctx.tenantId && s.tenants[ctx.tenantId]) return s.tenants[ctx.tenantId]!;
  if (sc.householdId && s.tenants[sc.householdId]) return s.tenants[sc.householdId]!;
  return null;
}

function buildingOf(sc: Scope): Building | null {
  const { s, ctx } = sc;
  if (ctx.buildingId && s.buildings[ctx.buildingId]) return s.buildings[ctx.buildingId]!;
  const t = primaryTenant(sc);
  if (t?.buildingId && s.buildings[t.buildingId]) return s.buildings[t.buildingId]!;
  const a = ctx.applicantId ? s.applicants[ctx.applicantId] : null;
  if (a && s.buildings[a.buildingId]) return s.buildings[a.buildingId]!;
  return null;
}

/** The household(s) a household effect lands on. */
function households(sc: Scope, scope: 'tenant' | 'building' | 'neighbors' | 'all' = 'tenant'): Tenant[] {
  const { s, ctx } = sc;
  if (scope === 'all') return housed(s);
  const b = buildingOf(sc);
  if (scope === 'neighbors') return b ? neighborsOf(s, b.id, TUNE.neighborRadius) : [];
  if (scope === 'building') {
    if (b) return tenantsOf(s, b.id);
    const t = primaryTenant(sc);
    return t ? [t] : [];
  }
  const t = primaryTenant(sc);
  if (t) return [t];
  // an applicant who has not signed is nobody's tenant yet
  if (ctx.applicantId && s.applicants[ctx.applicantId]) return [];
  if (!b) return [];
  // building-targeted: whoever lives there (the given unit first)
  if (ctx.unit != null) {
    const tid = b.units[ctx.unit]?.tenantId;
    if (tid && s.tenants[tid]) return [s.tenants[tid]!];
  }
  return tenantsOf(s, b.id);
}

// ───────────── gold: which line of the ledger ─────────────

export function expenseCatFor(memo: string): ExpenseCat {
  const m = memo.toLowerCase();
  if (/brib|pay ?off|paid off|hush|sweeten|coin for keys|relocat|persua|grease|to go away|to leave/.test(m)) return 'bribes';
  if (/court|writ|\bfines?\b|judge|legal|lawyer|magistrate|penalt|edict|assessor|damages|settlement/.test(m)) return 'court';
  if (/gift|alms|charit|present|feast|dowry|donat|festival|prize/.test(m)) return 'gifts';
  if (/repair|mend|thatch|mason|roof|timber|paint|glaz|plaster|carpent|rebuil/.test(m)) return 'repairs';
  return 'other';
}

export function incomeCatFor(memo: string): IncomeCat {
  return /\bfees?\b|\bfines?\b|suret|toll|licen[cs]e|levy|pet rent|penalt/.test(memo.toLowerCase()) ? 'fees' : 'windfall';
}

// ───────────── one effect ─────────────

function applyOne(sc: Scope, e: Effect, all: Effect[]): void {
  const { s, ctx, vars } = sc;
  const title = ctx.title ?? 'An incident';
  switch (e.t) {
    case 'gold': {
      const amount = Math.round(e.amount);
      const memo = fillText(e.memo ?? title, vars);
      const t = primaryTenant(sc); const b = buildingOf(sc);
      const refs = { ...(b ? { buildingId: b.id } : {}), ...(t ? { tenantId: t.id } : {}) };
      if (amount > 0) earn(s, amount, incomeCatFor(memo), memo, refs);
      else if (amount < 0) spend(s, -amount, expenseCatFor(memo), memo, refs);
      return;
    }
    case 'renown': changeRenown(s, e.amount, title); return;
    case 'favor': changeFavor(s, e.amount, title); return;
    case 'happiness': {
      for (const t of households(sc, e.scope ?? 'tenant')) changeHappiness(s, t.id, e.amount, title);
      return;
    }
    case 'condition': {
      const b = buildingOf(sc); if (!b) return;
      if (e.amount > 0) repairBuilding(s, b.id, Math.max(1, Math.round(e.amount * (ctx.quality ?? 1))));
      else if (e.amount < 0) damageBuilding(s, b.id, -e.amount, title);
      return;
    }
    case 'rent': {
      for (const t of households(sc)) if (t.lease) changeLeaseRent(s, t.id, e.pct);
      return;
    }
    case 'arrears': {
      for (const t of households(sc)) {
        if (e.amount === 'forgive') forgiveArrears(s, t.id);
        else if (e.amount) addArrears(s, t.id, e.amount);
      }
      return;
    }
    case 'late': {
      for (const t of households(sc)) applyLateOption(s, t.id, e.option);
      return;
    }
    case 'evict': {
      for (const t of households(sc)) if (t.status === 'housed') evict(s, t.id);
      return;
    }
    case 'leave': {
      // coin changed hands in the same breath: they were paid to go
      const paid = ctx.option === 'cash_for_keys' || (ctx.option == null && all.some(x => x.t === 'gold' && x.amount < 0 && /key/i.test(x.memo ?? '')));
      const reason: MoveOutReason = paid ? 'cash_for_keys' : 'event';
      for (const t of households(sc)) if (t.status === 'housed') moveOut(s, t.id, reason);
      return;
    }
    case 'deposit': {
      for (const t of households(sc)) applyDeposit(s, t.id, e.keepPct);
      return;
    }
    case 'lease': {
      if (ctx.applicantId && s.applicants[ctx.applicantId]) applyLease(s, ctx.applicantId, e.accept, e.rentPct);
      return;
    }
    case 'screen': {
      if (ctx.applicantId && s.applicants[ctx.applicantId]) { screen(s, ctx.applicantId); return; }
      for (const t of households(sc)) screen(s, t.id);
      return;
    }
    case 'memory': {
      const text = fillText(e.text, vars); if (!text) return;
      for (const t of households(sc)) addMemory(s, t.id, text, e.valence);
      return;
    }
    case 'trait': {
      for (const t of households(sc)) {
        if (e.add) giveTrait(s, t, e.add, false);          // a new habit, not yet noticed
        if (e.reveal) {
          if (t.traits.includes(e.reveal)) revealTrait(s, t.id, e.reveal);
          else giveTrait(s, t, e.reveal, true);            // it came out in the telling
        }
        if (e.remove) takeTrait(s, t, e.remove);
      }
      return;
    }
    case 'pet': {
      for (const t of households(sc)) {
        if (e.add) givePet(s, t, e.add);
        if (e.remove) {
          const named = String(vars.pet ?? '').replace(/ /g, '_') as PetKind;
          takePets(s, t, PET_KINDS.includes(named) ? named : null);
        }
      }
      return;
    }
    case 'flag': {
      const value = e.value ?? true;
      if (e.scope === 'building') { const b = buildingOf(sc); if (b) b.flags[e.key] = value; }
      else s.flags[e.key] = value;
      return;
    }
    case 'visual': {
      const b = buildingOf(sc); if (!b) return;
      if (e.add) addVisual(s, b.id, e.add);
      if (e.remove) removeVisual(s, b.id, e.remove);
      return;
    }
    case 'squatters': {
      const b = buildingOf(sc); if (b) setSquatters(s, b.id, e.set);
      return;
    }
    case 'squatters_sign_lease': squattersSign(sc); return;
    case 'spawn': {
      if (e.chance !== undefined && rand(s) >= e.chance) return;
      const t = primaryTenant(sc); const b = buildingOf(sc);
      // the follow-up is about the same household under the same roof; `_at` lets incidents.ts tell who has left since
      s.pending.push({ defId: e.id, day: s.day + Math.max(0, e.delayDays), buildingId: b?.id ?? null, tenantId: t?.id ?? null, vars: { _at: s.day } });
      return;
    }
    case 'oath': {
      const t = primaryTenant(sc) ?? households(sc)[0] ?? null; const b = buildingOf(sc);
      const amount = e.kind === 'rent_cap' ? (t?.lease?.rent ?? null)
        : e.kind === 'pay' && typeof vars.amount === 'number' ? vars.amount : null;
      swear(s, {
        kind: e.kind, text: fillText(e.text, vars), toTenantId: t?.id ?? null,
        toName: t?.name ?? (typeof vars.tenant === 'string' && vars.tenant ? vars.tenant : (s.realm.name || 'the realm')),
        buildingId: b?.id ?? null, buildingType: null, amount, dueDay: s.day + Math.max(1, e.months) * 30,
      });
      return;
    }
    case 'applicant': {
      const spot = vacancyFor(sc); if (!spot) return;
      const opts: { species?: Species; trade?: TradeId } = {};
      if (e.species) opts.species = e.species;
      if (e.trade) opts.trade = e.trade;
      spawnApplicant(s, spot.buildingId, spot.unit, opts);
      return;
    }
    case 'loyalty': changeLoyalty(s, e.role, e.amount); return;
    case 'herald': {
      const text = fillText(e.text, vars); if (!text) return;
      const t = primaryTenant(sc); const b = buildingOf(sc);
      herald(s, e.kind ?? 'info', text, {
        ...(b ? { buildingId: b.id } : {}), ...(t ? { tenantId: t.id } : {}), ...(ctx.incidentId ? { incidentId: ctx.incidentId } : {}),
      });
      return;
    }
    default: return;   // an effect this engine has not heard of: skipped, as promised
  }
}

/** A free unit for an `applicant` effect: at the incident's building if it has one, else anywhere. */
function vacancyFor(sc: Scope): { buildingId: Id; unit: number } | null {
  const { s } = sc;
  const taken = new Set(Object.values(s.applicants).map(a => a.buildingId + ':' + a.unit));
  const free = vacancies(s).filter(v => !v.building.squatters && !taken.has(v.building.id + ':' + v.unit));
  if (!free.length) return null;
  const b = buildingOf(sc);
  const here = b ? free.find(v => v.building.id === b.id) : undefined;
  const v = here ?? free[0]!;
  return { buildingId: v.building.id, unit: v.unit };
}

/** The squatters become a paying household: rolled, signed at a discount, and very pleased with the seal. */
function squattersSign(sc: Scope): void {
  const { s, ctx } = sc;
  const b = buildingOf(sc); if (!b || b.state !== 'ready') return;
  let unit = ctx.unit ?? -1;
  if (unit < 0 || !b.units[unit] || b.units[unit]!.tenantId) unit = b.units.findIndex(u => !u.tenantId);
  if (unit < 0) return;
  const kind = b.squatters?.kind ?? 'goblins';
  if (kind === 'raccoons' || kind === 'ghost') return;   // neither can hold a pen
  const opts: { species?: Species; trade?: TradeId; forBuilding?: Id } = { species: kind === 'goblins' ? 'goblin' : 'human', forBuilding: b.id };
  if (kind === 'bard_troupe') opts.trade = 'bard';
  const household = rollHousehold(s, opts);
  if (!household) return;
  const rent = Math.max(1, Math.round((b.rent * TUNE.squatterLeasePct) / 100));
  setSquatters(s, b.id, null);
  let t: Tenant | null = null;
  const house = extra().houseDirectly;
  if (typeof house === 'function') {
    // already indoors: no walk from the gate, and no surety from people who arrived through a window
    t = house(s, household, b.id, unit, rent, { deposit: 0 });
  } else {
    // tenants.moveIn signs an Applicant, so they are one for an instant
    const aid = newId(s, 'p');
    const applicant: Applicant = {
      id: aid, household, buildingId: b.id, unit, arrivedDay: s.day, leavesDay: s.day + 1,
      maxRent: Math.max(rent, 9999), shown: true, screened: false, actorId: null,
    };
    s.applicants[aid] = applicant;
    try { t = moveIn(s, aid, rent) ?? null; } finally { if (s.applicants[aid]) delete s.applicants[aid]; }
  }
  if (!t) return;
  sc.householdId = t.id;
  changeHappiness(s, t.id, 8, 'A lease, with a seal');
  addMemory(s, t.id, 'You offered a lease when you could have sent the Bailiff.', 2);
}

// ───────────── the list ─────────────

export function applyEffects(s: GameState, effects: Effect[], ctx: EffectCtx): void {
  if (!effects || !effects.length) return;
  const applicant = ctx.applicantId ? s.applicants[ctx.applicantId] : null;
  const sc: Scope = { s, ctx, vars: ctx.vars ?? {}, householdId: applicant ? applicant.household.id : null };
  for (const e of effects) {
    try {
      applyOne(sc, e, effects);
    } catch (err) {
      if (TUNE.errors.length < 50) TUNE.errors.push({ effect: (e as { t?: string })?.t ?? '?', error: err instanceof Error ? (err.stack ?? err.message) : String(err) });
    }
  }
}
