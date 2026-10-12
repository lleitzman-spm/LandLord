/** OWNER: sim-rule agent. The household of delegates: candidates, hiring, wages, loyalty, authority. */
import type { GameState, SimModule, StaffMember, StaffRole } from './types';
import type { TemperamentDef } from '../data/schema';
import { notImplemented } from './core';
const W = 'sim-rule';
export function staffOf(s: GameState, role: StaffRole): StaffMember | null { return notImplemented(W, 'staffOf'); }
export function temperamentOf(s: GameState, role: StaffRole): TemperamentDef | null { return notImplemented(W, 'temperamentOf'); }
export function changeLoyalty(s: GameState, role: StaffRole, amount: number): void { notImplemented(W, 'changeLoyalty'); }
export const staffModule: SimModule = { name: 'staff' };
