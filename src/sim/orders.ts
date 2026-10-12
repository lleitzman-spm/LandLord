/** OWNER: sim-rule agent. Standing orders, policies, and how a delegate decides when you are not asked. */
import type { GameState, SimModule, Incident, ResolvedBy, Id, StandingOrder } from './types';
import { notImplemented } from './core';
const W = 'sim-rule';
/** Who settles this incident without the ruler, and how? Order first, then a delegate with authority
 *  following temperament, else null (it waits for the ruler). */
export function decide(s: GameState, inc: Incident): { outcomeId: string; by: ResolvedBy; orderId?: Id } | null { return notImplemented(W, 'decide'); }
/** Orders that apply to this incident right now (conditions evaluated). */
export function ordersFor(s: GameState, inc: Incident): StandingOrder[] { return notImplemented(W, 'ordersFor'); }
export const ordersModule: SimModule = { name: 'orders' };
