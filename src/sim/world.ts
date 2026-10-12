/** OWNER: sim-world agent. Terrain, parcels, placement, desirability.
 *  Bodies below are thin PLACEHOLDERS so other modules can run; replace them. Keep the signatures. */
import { MAP_W, MAP_H, PARCEL, type GameState, type SimModule, type ActionResult, type Building } from './types';
import type { BuildingType } from '../data/ids';
import { BUILDINGS } from '../data/buildings';
import { tileAt, frontDir, inBounds } from './core';

/** Generate terrain + parcels into s.map from s.seed (init). Parcel 5 starts owned. */
export function createMap(s: GameState): void {
  s.map.w = MAP_W; s.map.h = MAP_H; s.map.tiles = [];
  for (let i = 0; i < MAP_W * MAP_H; i++) s.map.tiles.push({ t: 'grass', b: null, wear: 0, v: i % 256 });
  s.map.parcels = Array.from({ length: 12 }, (_, i) => ({ id: i, x: (i % 4) * PARCEL, y: Math.floor(i / 4) * PARCEL, owned: i === 5, price: 60 + i * 30, minRank: 'reeve' as const, name: 'Parcel ' + (i + 1) }));
}
/** Footprint of a building type after rotation. */
export function footprint(btype: BuildingType, rot: number): { w: number; h: number } {
  const d = BUILDINGS[btype]; return rot % 2 ? { w: d.h, h: d.w } : { w: d.w, h: d.h };
}
/** May this be placed here now? Checks bounds, ownership, terrain, overlap, rank unlock, uniqueness, gold. */
export function canPlace(s: GameState, btype: BuildingType, x: number, y: number, rot: number): ActionResult {
  const f = footprint(btype, rot);
  for (let yy = y; yy < y + f.h; yy++) for (let xx = x; xx < x + f.w; xx++) {
    const t = tileAt(s, xx, yy);
    if (!t || t.b || !ownedAt(s, xx, yy) || t.t === 'water' || t.t === 'rock' || t.t === 'forest') return { ok: false, code: 'blocked', reason: 'That ground will not take a building.' };
  }
  return { ok: true };
}
/** Can figures walk on this tile (not water/rock/forest, not under a building)? */
export function isWalkable(s: GameState, x: number, y: number): boolean {
  const t = tileAt(s, Math.floor(x), Math.floor(y)); return !!t && !t.b && t.t !== 'water' && t.t !== 'rock' && t.t !== 'forest';
}
/** Is this tile inside an owned parcel? */
export function ownedAt(s: GameState, x: number, y: number): boolean {
  if (!inBounds(x, y)) return false;
  const p = s.map.parcels[Math.floor(y / PARCEL) * 4 + Math.floor(x / PARCEL)]; return !!p && p.owned;
}
/** Centre of the walkable tile in front of the building's door (nearest walkable if blocked). */
export function entranceOf(s: GameState, b: Building): [number, number] {
  const [dx, dy] = frontDir(b.rot);
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  return [Math.floor(cx + dx * (b.w / 2 + 0.5)) + 0.5, Math.floor(cy + dy * (b.h / 2 + 0.5)) + 0.5];
}
/** 0..100 — how nice it is to live in this building: auras, condition, roads, neighbours, nuisances. */
export function desirability(_s: GameState, _b: Building): number { return 50; }

export const worldModule: SimModule = { name: 'world' };
