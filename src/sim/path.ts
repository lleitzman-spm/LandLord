/** OWNER: sim-world agent. Grid pathfinding (A*, 8-neighbour, roads cheaper). Pure.
 *  PLACEHOLDER bodies: a straight line. Replace them. Keep the signatures. */
import type { GameState } from './types';
/** Path of tile centres from (fx,fy) to (tx,ty), excluding the start; null if unreachable.
 *  The goal may be a non-walkable tile (a building): the path ends at the nearest walkable tile to it. */
export function findPath(_s: GameState, _fx: number, _fy: number, tx: number, ty: number): [number, number][] | null { return [[Math.floor(tx) + 0.5, Math.floor(ty) + 0.5]]; }
/** Centre of the nearest walkable tile to (x, y). */
export function nearestWalkable(_s: GameState, x: number, y: number): [number, number] { return [Math.floor(x) + 0.5, Math.floor(y) + 0.5]; }
