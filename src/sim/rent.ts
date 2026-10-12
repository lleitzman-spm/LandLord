/** OWNER: sim-people agent. Rent Day, purses, the late-rent pipeline, court, eviction, renewals, deposits. */
import type { GameState, SimModule, Id, DecisionOption } from './types';
import { notImplemented } from './core';
const W = 'sim-people';

/** Carry out a late-rent option on a household: wait | late_fee | payment_plan | forgive | notice | cash_for_keys | evict | mercy. */
export function applyLateOption(s: GameState, tenantId: Id, option: DecisionOption): void { notImplemented(W, 'applyLateOption'); }
/** Settle a departed household's deposit, keeping keepPct (0..100) of it. */
export function applyDeposit(s: GameState, tenantId: Id, keepPct: number): void { notImplemented(W, 'applyDeposit'); }
/** Accept (sign at asking rent * rentPct/100, default 100) or turn away an applicant. */
export function applyLease(s: GameState, applicantId: Id, accept: boolean, rentPct?: number): void { notImplemented(W, 'applyLease'); }
/** Check references: reveal hidden traits of an applicant (or housed tenant). */
export function screen(s: GameState, id: Id): void { notImplemented(W, 'screen'); }
export function addArrears(s: GameState, tenantId: Id, amount: number): void { notImplemented(W, 'addArrears'); }
export function forgiveArrears(s: GameState, tenantId: Id): void { notImplemented(W, 'forgiveArrears'); }
/** Change a household's lease rent by pct (e.g. +10, -15). Reactions included. */
export function changeLeaseRent(s: GameState, tenantId: Id, pct: number): void { notImplemented(W, 'changeLeaseRent'); }
/** Remove the household now (the Bailiff has done the deed). */
export function evict(s: GameState, tenantId: Id): void { notImplemented(W, 'evict'); }

export const rentModule: SimModule = { name: 'rent' };
