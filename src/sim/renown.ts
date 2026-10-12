/** OWNER: sim-people agent. Standing with tenants (renown) and with the Crown (favor). PLACEHOLDER bodies. */
import type { GameState, SimModule } from './types';
import { clamp100, emit } from './core';
export function changeRenown(s: GameState, amount: number, reason?: string): void { if (!amount) return; s.renown = clamp100(s.renown + amount); emit(s, { type: 'renown', amount, reason }); }
export function changeFavor(s: GameState, amount: number, reason?: string): void { if (!amount) return; s.favor = clamp100(s.favor + amount); emit(s, { type: 'favor', amount, reason }); }
export const renownModule: SimModule = { name: 'renown' };
