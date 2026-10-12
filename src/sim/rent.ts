/** OWNER: sim-people agent. Rent Day, purses, the late-rent pipeline, court, eviction, renewals, deposits.
 *  Bodies below are thin PLACEHOLDERS so other modules can run; replace them. Keep the signatures. */
import type { GameState, SimModule, Id, DecisionOption } from './types';

/** Carry out a late-rent option on a household: wait | late_fee | payment_plan | forgive | notice | cash_for_keys | evict | mercy. */
export function applyLateOption(_s: GameState, _tenantId: Id, _option: DecisionOption): void {}
/** Settle a departed household's deposit, keeping keepPct (0..100) of it; -1 = keep exactly the cost of the damage. */
export function applyDeposit(_s: GameState, _tenantId: Id, _keepPct: number): void {}
/** Accept (sign at asking rent * rentPct/100, default 100) or turn away an applicant. */
export function applyLease(_s: GameState, _applicantId: Id, _accept: boolean, _rentPct?: number): void {}
/** Check references: reveal hidden traits of an applicant (or housed tenant). */
export function screen(_s: GameState, _id: Id): void {}
export function addArrears(s: GameState, tenantId: Id, amount: number): void { const t = s.tenants[tenantId]; if (t) t.arrears += amount; }
export function forgiveArrears(s: GameState, tenantId: Id): void { const t = s.tenants[tenantId]; if (t) { t.arrears = 0; t.daysLate = 0; t.lateStage = 'none'; } }
/** Change a household's lease rent by pct (e.g. +10, -15). Reactions included. */
export function changeLeaseRent(s: GameState, tenantId: Id, pct: number): void { const t = s.tenants[tenantId]; if (t?.lease) t.lease.rent = Math.max(1, Math.round(t.lease.rent * (1 + pct / 100))); }
/** Remove the household now (the Bailiff has done the deed). */
export function evict(_s: GameState, _tenantId: Id): void {}

export const rentModule: SimModule = { name: 'rent' };
