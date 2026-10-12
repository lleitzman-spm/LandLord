/** OWNER: sim-people agent. Coffers, ledger, market rent, wages, upkeep.
 *  Bodies below are thin PLACEHOLDERS so other modules can run; replace them. Keep the signatures. */
import type { GameState, SimModule, Building, IncomeCat, ExpenseCat, MonthBook, Id } from './types';
import { BUILDINGS } from '../data/buildings';
import { emit, monthIndexOf } from './core';

/** Add to the coffers, book it, emit {type:'gold'}. */
export function earn(s: GameState, amount: number, cat: IncomeCat, _memo?: string, refs?: { buildingId?: Id; tenantId?: Id }): void {
  if (amount <= 0) return; s.gold += amount; emit(s, { type: 'gold', amount, cat, ...refs });
}
/** Take from the coffers (may go negative; modes.ts deals with debt), book it, emit {type:'gold'} (negative amount). */
export function spend(s: GameState, amount: number, cat: ExpenseCat, _memo?: string, refs?: { buildingId?: Id; tenantId?: Id }): void {
  if (amount <= 0) return; s.gold -= amount; emit(s, { type: 'gold', amount: -amount, cat, ...refs });
}
export function canAfford(s: GameState, amount: number): boolean { return s.gold >= amount; }
/** What a unit in this building would fetch from a typical applicant right now. */
export function marketRent(_s: GameState, b: Building): number { return BUILDINGS[b.type].baseRent; }
/** Sum of all current lease rents per month. */
export function rentRoll(s: GameState): number { let r = 0; for (const t of Object.values(s.tenants)) if (t.status === 'housed' && t.lease) r += t.lease.rent; return r; }
/** Wages + upkeep + tribute share + loan interest per month. */
export function monthlyOutgoings(_s: GameState): number { return 0; }
/** This month's (open) book. */
export function currentBook(s: GameState): MonthBook {
  const idx = monthIndexOf(s.day); let b = s.ledger.months[s.ledger.months.length - 1];
  if (!b || b.index !== idx) {
    b = { index: idx, income: { rent: 0, fees: 0, deposits_kept: 0, windfall: 0, loan: 0 }, expense: { construction: 0, repairs: 0, wages: 0, upkeep: 0, tribute: 0, interest: 0, deposits_returned: 0, bribes: 0, gifts: 0, court: 0, land: 0, loan_repaid: 0, other: 0 }, closing: s.gold, rentDue: 0, rentCollected: 0 };
    s.ledger.months.push(b);
  }
  return b;
}

export const economyModule: SimModule = { name: 'economy' };
