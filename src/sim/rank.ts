/** OWNER: sim-rule agent. Charters, promotion, unlocks. */
import type { GameState, SimModule, StaffRole } from './types';
import type { BuildingType, Species } from '../data/ids';
import type { RankDef } from '../data/schema';
import { notImplemented } from './core';
const W = 'sim-rule';
export function rankDef(s: GameState): RankDef { return notImplemented(W, 'rankDef'); }
export function isUnlocked(s: GameState, btype: BuildingType): boolean { return notImplemented(W, 'isUnlocked'); }
export function speciesUnlocked(s: GameState): Species[] { return notImplemented(W, 'speciesUnlocked'); }
export function rolesUnlocked(s: GameState): StaffRole[] { return notImplemented(W, 'rolesUnlocked'); }
export function maxParcels(s: GameState): number { return notImplemented(W, 'maxParcels'); }
export const rankModule: SimModule = { name: 'rank' };
