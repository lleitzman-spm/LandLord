/** OWNER: sim-world agent. Construction, decay, repair, upgrades, demolition, visuals, squatters. */
import type { GameState, SimModule, Building, Id } from './types';
import type { BuildingType, VisualId, SquatterKind } from '../data/ids';
import { notImplemented } from './core';
const W = 'sim-world';

export function buildingsOf(s: GameState, btype: BuildingType): Building[] { return notImplemented(W, 'buildingsOf'); }
/** Ready (built) buildings of that type. */
export function countBuildings(s: GameState, btype: BuildingType): number { return notImplemented(W, 'countBuildings'); }
/** Ready housing + commercial buildings. */
export function leasable(s: GameState): Building[] { return notImplemented(W, 'leasable'); }
/** Every empty unit in a ready leasable building. */
export function vacancies(s: GameState): { building: Building; unit: number }[] { return notImplemented(W, 'vacancies'); }
/** The ruler's seat (always exists). */
export function seatOf(s: GameState): Building { return notImplemented(W, 'seatOf'); }
/** Lower condition (clamped); emits building_changed when the visible band changes; 0 → 'ruined'. */
export function damageBuilding(s: GameState, buildingId: Id, amount: number, cause?: string): void { notImplemented(W, 'damageBuilding'); }
/** Raise condition (clamped to 100). */
export function repairBuilding(s: GameState, buildingId: Id, amount: number): void { notImplemented(W, 'repairBuilding'); }
export function addVisual(s: GameState, buildingId: Id, v: VisualId): void { notImplemented(W, 'addVisual'); }
export function removeVisual(s: GameState, buildingId: Id, v: VisualId): void { notImplemented(W, 'removeVisual'); }
export function setSquatters(s: GameState, buildingId: Id, kind: SquatterKind | null): void { notImplemented(W, 'setSquatters'); }
/** A fresh comic name for a new building: "Mudlark Cottage", "The Leaning Hovel". */
export function makeBuildingName(s: GameState, btype: BuildingType): string { return notImplemented(W, 'makeBuildingName'); }

export const buildingsModule: SimModule = { name: 'buildings' };
