/** OWNER: sim-world agent. Grid pathfinding (A*, 8-neighbour, roads cheaper). Pure. */
import type { GameState } from './types';
import { notImplemented } from './core';
const W = 'sim-world';
/** Path of tile centres from (fx,fy) to (tx,ty), excluding the start; null if unreachable.
 *  The goal may be a non-walkable tile (a building): path ends at the nearest walkable tile to it. */
export function findPath(s: GameState, fx: number, fy: number, tx: number, ty: number): [number, number][] | null { return notImplemented(W, 'findPath'); }
/** Centre of the nearest walkable tile to (x, y). */
export function nearestWalkable(s: GameState, x: number, y: number): [number, number] { return notImplemented(W, 'nearestWalkable'); }
