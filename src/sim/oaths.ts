/** OWNER: sim-crown agent. The ledger of oaths: the ruler's word binds. PLACEHOLDER bodies. */
import type { GameState, SimModule, Oath, Id } from './types';
import { newId, emit } from './core';
export function swear(s: GameState, spec: Omit<Oath, 'id' | 'madeDay' | 'state' | 'settledDay'>): Oath {
  const o: Oath = { ...spec, id: newId(s, 'w'), madeDay: s.day, state: 'open', settledDay: null }; s.oaths.push(o); emit(s, { type: 'oath', oathId: o.id, state: 'open' }); return o;
}
export function oathsTo(s: GameState, tenantId: Id): Oath[] { return s.oaths.filter(o => o.toTenantId === tenantId); }
/** Would doing this break an open oath? Used to warn before an action. Returns the oath or null. */
export function wouldBreak(_s: GameState, _what: { evict?: Id; raiseRent?: Id; newRent?: number }): Oath | null { return null; }
export const oathsModule: SimModule = { name: 'oaths' };
