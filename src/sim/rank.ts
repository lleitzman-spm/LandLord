/** OWNER: sim-crown agent. Charters, promotion, unlocks. PLACEHOLDER bodies (unlock helpers are real enough). */
import { RANK_ORDER, type GameState, type SimModule, type StaffRole } from './types';
import type { BuildingType, Species } from '../data/ids';
import type { RankDef } from '../data/schema';
import { RANKS } from '../data/ranks';
import { rankIndex } from './core';
const upTo = (s: GameState) => RANK_ORDER.slice(0, rankIndex(s.realm.rank) + 1).map(r => RANKS[r]);
export function rankDef(s: GameState): RankDef { return RANKS[s.realm.rank]; }
export function isUnlocked(s: GameState, btype: BuildingType): boolean { return upTo(s).some(r => r.buildings.includes(btype)); }
export function speciesUnlocked(s: GameState): Species[] { return upTo(s).flatMap(r => r.species); }
export function rolesUnlocked(s: GameState): StaffRole[] { return upTo(s).flatMap(r => r.staff); }
export function maxParcels(s: GameState): number { return RANKS[s.realm.rank].maxParcels; }
export const rankModule: SimModule = { name: 'rank' };
