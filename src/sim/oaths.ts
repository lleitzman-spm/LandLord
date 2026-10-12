/** OWNER: sim-rule agent. The ledger of oaths: the ruler's word binds. */
import type { GameState, SimModule, Oath, Id } from './types';
import { notImplemented } from './core';
const W = 'sim-rule';
export function swear(s: GameState, spec: Omit<Oath, 'id' | 'madeDay' | 'state' | 'settledDay'>): Oath { return notImplemented(W, 'swear'); }
export function oathsTo(s: GameState, tenantId: Id): Oath[] { return notImplemented(W, 'oathsTo'); }
/** Would doing this break an open oath? Used to warn before an action. Returns the oath or null. */
export function wouldBreak(s: GameState, what: { evict?: Id; raiseRent?: Id; newRent?: number }): Oath | null { return notImplemented(W, 'wouldBreak'); }
export const oathsModule: SimModule = { name: 'oaths' };
