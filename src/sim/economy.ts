/** OWNER: sim-people agent. Coffers, ledger, market rent, wages, upkeep. */
import type { GameState, SimModule, Building, IncomeCat, ExpenseCat, MonthBook, Id } from './types';
import { notImplemented } from './core';
const W = 'sim-people';

/** Add to the coffers, book it, emit {type:'gold'}. */
export function earn(s: GameState, amount: number, cat: IncomeCat, memo?: string, refs?: { buildingId?: Id; tenantId?: Id }): void { notImplemented(W, 'earn'); }
/** Take from the coffers (may go negative — modes.ts deals with debt), book it, emit {type:'gold'} (negative amount). */
export function spend(s: GameState, amount: number, cat: ExpenseCat, memo?: string, refs?: { buildingId?: Id; tenantId?: Id }): void { notImplemented(W, 'spend'); }
export function canAfford(s: GameState, amount: number): boolean { return notImplemented(W, 'canAfford'); }
/** What a unit in this building would fetch from a typical applicant right now. */
export function marketRent(s: GameState, b: Building): number { return notImplemented(W, 'marketRent'); }
/** Sum of all current lease rents per month. */
export function rentRoll(s: GameState): number { return notImplemented(W, 'rentRoll'); }
/** Wages + upkeep + tribute share + loan interest per month. */
export function monthlyOutgoings(s: GameState): number { return notImplemented(W, 'monthlyOutgoings'); }
/** This month's (open) book. */
export function currentBook(s: GameState): MonthBook { return notImplemented(W, 'currentBook'); }

export const economyModule: SimModule = { name: 'economy' };
