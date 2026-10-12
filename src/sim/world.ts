/** OWNER: sim-world agent. Terrain, parcels, placement, desirability. */
import type { GameState, SimModule, ActionResult, Building } from './types';
import type { BuildingType } from '../data/ids';
import { notImplemented } from './core';
const W = 'sim-world';

/** Generate terrain + parcels into s.map from s.seed (init). Parcel 5 (centre-left) starts owned. */
export function createMap(s: GameState): void { notImplemented(W, 'createMap'); }
/** Footprint of a building type after rotation. */
export function footprint(btype: BuildingType, rot: number): { w: number; h: number } { return notImplemented(W, 'footprint'); }
/** May this be placed here now? Checks bounds, ownership, terrain, overlap, rank unlock, gold. */
export function canPlace(s: GameState, btype: BuildingType, x: number, y: number, rot: number): ActionResult { return notImplemented(W, 'canPlace'); }
/** Can figures walk on this tile (not water/rock/forest, not under a building)? */
export function isWalkable(s: GameState, x: number, y: number): boolean { return notImplemented(W, 'isWalkable'); }
/** Is this tile inside an owned parcel? */
export function ownedAt(s: GameState, x: number, y: number): boolean { return notImplemented(W, 'ownedAt'); }
/** Centre of the walkable tile in front of the building's door (nearest walkable if blocked). */
export function entranceOf(s: GameState, b: Building): [number, number] { return notImplemented(W, 'entranceOf'); }
/** 0..100 — how nice it is to live in this building: auras, condition, roads, neighbours, nuisances. */
export function desirability(s: GameState, b: Building): number { return notImplemented(W, 'desirability'); }

export const worldModule: SimModule = { name: 'world' };
