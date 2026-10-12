/** OWNER: sim-rule agent. Debt, the moneylender, tribute, demotion (Steward's Peace) and the end (Iron Crown). */
import type { GameState, SimModule } from './types';
import { notImplemented } from './core';
/** Total owed to the moneylender. */
export function debtOf(s: GameState): number { return notImplemented('sim-rule', 'debtOf'); }
export const modesModule: SimModule = { name: 'modes' };
