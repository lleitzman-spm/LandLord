/** OWNER: sim-people agent. Households: rolling them, applicants, moving in and out, mood, memory.
 *  Bodies below are thin PLACEHOLDERS so other modules can run; replace them. Keep the signatures. */
import type { GameState, SimModule, Tenant, Applicant, Id, MoveOutReason } from './types';
import type { Species, TradeId, TraitId } from '../data/ids';
import { clamp100, emit, newId, dist } from './core';

/** Roll a household (random, or a named character from data when available and fitting). */
export function rollHousehold(s: GameState, opts?: { species?: Species; trade?: TradeId; character?: string; forBuilding?: Id }): Applicant['household'] {
  return { id: newId(s, 't'), name: 'Wat Mudge', first: 'Wat', species: opts?.species ?? 'human', trade: opts?.trade ?? 'laborer', character: null, portraitSeed: s.nextId * 7919, household: 2, traits: [], revealed: [], tags: [], pets: [], income: 30, reliability: 0.8 };
}
/** Create an applicant for a vacant unit; spawns their actor at the gate walking to the door. Null if none fits. */
export function spawnApplicant(_s: GameState, _buildingId: Id, _unit: number, _opts?: { species?: Species; trade?: TradeId; character?: string }): Applicant | null { return null; }
/** Sign the applicant into their unit at `rent` (default: the building's asking rent). Takes the deposit. */
export function moveIn(s: GameState, applicantId: Id, rent?: number): Tenant {
  const a = s.applicants[applicantId]!; const b = s.buildings[a.buildingId]!;
  const t: Tenant = { ...a.household, status: 'housed', buildingId: b.id, unit: a.unit, lease: { rent: rent ?? b.rent, startDay: s.day, termMonths: 12, deposit: 0 }, movedInDay: s.day, arrears: 0, daysLate: 0, lateStage: 'none', plan: null, courtDay: null, memory: [], wear: 0, leftDay: null, happiness: 60 };
  s.tenants[t.id] = t; const u = b.units[a.unit]!; u.tenantId = t.id; u.vacantSince = null; u.listed = false; delete s.applicants[applicantId];
  emit(s, { type: 'tenant_in', tenantId: t.id, buildingId: b.id, unit: a.unit }); return t;
}
/** Household leaves: frees the unit, sets status, emits tenant_out. Deposit handling is rent.ts's business. */
export function moveOut(s: GameState, tenantId: Id, reason: MoveOutReason): void {
  const t = s.tenants[tenantId]; if (!t || t.status !== 'housed' || !t.buildingId) return;
  const b = s.buildings[t.buildingId]; const u = b?.units[t.unit];
  if (u) { u.tenantId = null; u.vacantSince = s.day; u.listed = true; u.purse = 0; }
  emit(s, { type: 'tenant_out', tenantId, buildingId: t.buildingId, unit: t.unit, reason });
  t.status = reason === 'evicted' ? 'evicted' : 'left'; t.leftDay = s.day; t.buildingId = null;
}
export function changeHappiness(s: GameState, tenantId: Id, amount: number, _reason?: string): void { const t = s.tenants[tenantId]; if (t) t.happiness = clamp100(t.happiness + amount); }
/** Something this household will remember about the ruler (shown in their sheet, fed to the model). */
export function addMemory(s: GameState, tenantId: Id, text: string, valence: -2 | -1 | 1 | 2): void { const t = s.tenants[tenantId]; if (t) { t.memory.push({ day: s.day, text, valence }); if (t.memory.length > 12) t.memory.shift(); } }
export function revealTrait(s: GameState, tenantId: Id, trait: TraitId): void { const t = s.tenants[tenantId]; if (t && t.traits.includes(trait) && !t.revealed.includes(trait)) t.revealed.push(trait); }
export function housed(s: GameState): Tenant[] { return Object.values(s.tenants).filter(t => t.status === 'housed'); }
export function tenantsOf(s: GameState, buildingId: Id): Tenant[] { return housed(s).filter(t => t.buildingId === buildingId); }
/** Housed households within `radius` tiles of the building (excluding its own). */
export function neighborsOf(s: GameState, buildingId: Id, radius: number): Tenant[] {
  const b = s.buildings[buildingId]; if (!b) return [];
  return housed(s).filter(t => { const o = t.buildingId ? s.buildings[t.buildingId] : null; return !!o && o.id !== b.id && dist(o.x + o.w / 2, o.y + o.h / 2, b.x + b.w / 2, b.y + b.h / 2) <= radius; });
}
export function householdCount(s: GameState): number { return housed(s).length; }
export function avgHappiness(s: GameState): number { const h = housed(s); return h.length ? h.reduce((a, t) => a + t.happiness, 0) / h.length : 50; }

export const tenantsModule: SimModule = { name: 'tenants' };
