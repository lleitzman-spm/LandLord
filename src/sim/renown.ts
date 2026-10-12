/** OWNER: sim-people agent. Standing with tenants (renown) and with the Crown (favor). */
import type { GameState, SimModule } from './types';
import { notImplemented } from './core';
const W = 'sim-people';
export function changeRenown(s: GameState, amount: number, reason?: string): void { notImplemented(W, 'changeRenown'); }
export function changeFavor(s: GameState, amount: number, reason?: string): void { notImplemented(W, 'changeFavor'); }
export const renownModule: SimModule = { name: 'renown' };
