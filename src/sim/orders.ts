/** OWNER: sim-decide agent. Standing orders, policies, and how a delegate decides when you are not asked. PLACEHOLDER bodies. */
import type { GameState, SimModule, Incident, ResolvedBy, Id, StandingOrder } from './types';
/** Who settles this incident without the ruler, and how? An order first, then a delegate with authority
 *  following temperament, else null (it waits for the ruler). */
export function decide(_s: GameState, _inc: Incident): { outcomeId: string; by: ResolvedBy; orderId?: Id } | null { return null; }
/** Orders that apply to this incident right now (conditions evaluated). */
export function ordersFor(_s: GameState, _inc: Incident): StandingOrder[] { return []; }
export const ordersModule: SimModule = { name: 'orders' };
