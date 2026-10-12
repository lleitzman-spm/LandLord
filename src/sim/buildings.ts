/** OWNER: sim-world agent. Construction, decay, repair, upgrades, demolition, visuals, squatters.
 *  Bodies below are thin PLACEHOLDERS so other modules can run; replace them. Keep the signatures. */
import type { GameState, SimModule, Building, Id } from './types';
import type { BuildingType, VisualId, SquatterKind } from '../data/ids';
import { BUILDINGS } from '../data/buildings';
import { clamp100, emit } from './core';

export function buildingsOf(s: GameState, btype: BuildingType): Building[] { return Object.values(s.buildings).filter(b => b.type === btype); }
/** Ready (built) buildings of that type. */
export function countBuildings(s: GameState, btype: BuildingType): number { return buildingsOf(s, btype).filter(b => b.state === 'ready').length; }
/** Ready housing + commercial buildings. */
export function leasable(s: GameState): Building[] { return Object.values(s.buildings).filter(b => b.state === 'ready' && b.units.length > 0); }
/** Every empty unit in a ready leasable building. */
export function vacancies(s: GameState): { building: Building; unit: number }[] {
  const out: { building: Building; unit: number }[] = [];
  for (const b of leasable(s)) b.units.forEach((u, i) => { if (!u.tenantId) out.push({ building: b, unit: i }); });
  return out;
}
/** The ruler's seat (always exists after init). */
export function seatOf(s: GameState): Building { return buildingsOf(s, 'seat')[0]!; }
/** Lower condition (clamped); emits building_changed when the visible band changes; 0 → 'ruined'. */
export function damageBuilding(s: GameState, buildingId: Id, amount: number, _cause?: string): void {
  const b = s.buildings[buildingId]; if (!b) return; b.condition = clamp100(b.condition - amount); emit(s, { type: 'building_changed', buildingId });
}
/** Raise condition (clamped to 100). */
export function repairBuilding(s: GameState, buildingId: Id, amount: number): void {
  const b = s.buildings[buildingId]; if (!b) return; b.condition = clamp100(b.condition + amount); emit(s, { type: 'building_changed', buildingId });
}
export function addVisual(s: GameState, buildingId: Id, v: VisualId): void {
  const b = s.buildings[buildingId]; if (!b || b.visuals.includes(v)) return; b.visuals.push(v); emit(s, { type: 'building_changed', buildingId });
}
export function removeVisual(s: GameState, buildingId: Id, v: VisualId): void {
  const b = s.buildings[buildingId]; if (!b || !b.visuals.includes(v)) return; b.visuals = b.visuals.filter(x => x !== v); emit(s, { type: 'building_changed', buildingId });
}
export function setSquatters(s: GameState, buildingId: Id, kind: SquatterKind | null): void {
  const b = s.buildings[buildingId]; if (!b) return; b.squatters = kind ? { kind, sinceDay: s.day } : null; emit(s, { type: 'building_changed', buildingId });
}
/** A fresh comic name for a new building: "Mudlark Cottage", "The Leaning Hovel". */
export function makeBuildingName(_s: GameState, btype: BuildingType): string { return BUILDINGS[btype].name; }
/** Raise the seat to this level (called by rank.ts on promotion). */
export function upgradeSeat(s: GameState, level: number): void { const b = seatOf(s); if (b) { b.level = level; emit(s, { type: 'building_changed', buildingId: b.id }); } }

export const buildingsModule: SimModule = { name: 'buildings' };
