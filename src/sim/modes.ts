/** OWNER: sim-crown agent. Debt, the moneylender, tribute, demotion (Steward's Peace) and the end (Iron Crown). PLACEHOLDER. */
import type { GameState, SimModule } from './types';
/** Total owed to the moneylender. */
export function debtOf(s: GameState): number { return s.loans.reduce((a, l) => a + l.principal, 0); }
export const modesModule: SimModule = { name: 'modes' };
