/** OWNER: sim-world agent. Grid pathfinding (A*, 8-neighbour, no corner cutting, roads cheaper). Pure.
 *
 *  Two flavours:
 *   - `findPath`       strict: only walkable tiles (grass, field, road, bridge; nothing under a building).
 *                      Returns null when the goal cannot be reached that way.
 *   - `findPathLoose`  strict first; failing that, a path that scrambles through trees, over rock, wades
 *                      water and (last resort) squeezes past buildings at a heavy cost. Never null in bounds.
 *                      The actor layer uses this so that no figure and no job can ever be stranded by a
 *                      wall of cottages or a missing bridge.
 */
import { MAP_W, MAP_H, type GameState } from './types';
import { BAL } from '../data/balance';

const N = MAP_W * MAP_H;
const SQRT2 = Math.SQRT2;
/** cost of one orthogonal step onto a road or bridge, relative to grass */
const ROAD_COST = 1 / BAL.roadSpeedBonus;
/** loose mode: what it costs to push through things figures should not really walk on */
const ROUGH_COST = { forest: 5, rock: 6, water: 9, building: 16 } as const;

// scratch buffers, reused between calls (pure performance: nothing here outlives a call)
const gScore = new Float64Array(N);
const fScore = new Float64Array(N);
const cameFrom = new Int32Array(N);
const stamp = new Int32Array(N);      // generation the node was last touched
const closed = new Int32Array(N);     // generation the node was closed
const heap: number[] = [];
let generation = 0;

const DIRS: readonly (readonly [number, number])[] = [
  [0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1],
];

function clampTile(v: number, hi: number): number {
  const f = Math.floor(Number.isFinite(v) ? v : 0);
  return f < 0 ? 0 : f >= hi ? hi - 1 : f;
}

/** step-cost factor of entering tile i; Infinity = impassable in this mode */
function tileCost(s: GameState, i: number, loose: boolean): number {
  const t = s.map.tiles[i];
  if (!t) return Infinity;
  if (t.b) return loose ? ROUGH_COST.building : Infinity;
  switch (t.t) {
    case 'road': case 'bridge': return ROAD_COST;
    case 'grass': case 'field': return 1;
    case 'forest': return loose ? ROUGH_COST.forest : Infinity;
    case 'rock': return loose ? ROUGH_COST.rock : Infinity;
    case 'water': return loose ? ROUGH_COST.water : Infinity;
    default: return 1;
  }
}

function strictWalkable(s: GameState, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return false;
  const t = s.map.tiles[y * MAP_W + x];
  return !!t && !t.b && (t.t === 'grass' || t.t === 'field' || t.t === 'road' || t.t === 'bridge');
}

// ───────────── a small binary heap keyed on fScore (ties: lower index first, for determinism) ─────────────

function less(a: number, b: number): boolean {
  const fa = fScore[a]!, fb = fScore[b]!;
  return fa < fb || (fa === fb && a < b);
}
function heapPush(n: number): void {
  let i = heap.length;
  heap.push(n);
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (!less(heap[i]!, heap[p]!)) break;
    const tmp = heap[i]!; heap[i] = heap[p]!; heap[p] = tmp;
    i = p;
  }
}
function heapPop(): number {
  const top = heap[0]!;
  const last = heap.pop()!;
  if (heap.length > 0) {
    heap[0] = last;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let m = i;
      if (l < heap.length && less(heap[l]!, heap[m]!)) m = l;
      if (r < heap.length && less(heap[r]!, heap[m]!)) m = r;
      if (m === i) break;
      const tmp = heap[i]!; heap[i] = heap[m]!; heap[m] = tmp;
      i = m;
    }
  }
  return top;
}

/** A* between two tiles. The start tile may be anything (a figure can find itself under a new wall). */
function search(s: GameState, sx: number, sy: number, gx: number, gy: number, loose: boolean): [number, number][] | null {
  if (s.map.tiles.length < N) return null;
  const start = sy * MAP_W + sx, goal = gy * MAP_W + gx;
  if (start === goal) return [];
  if (tileCost(s, goal, loose) === Infinity) return null;

  generation++;
  heap.length = 0;
  const h = (i: number): number => {
    const dx = Math.abs((i % MAP_W) - gx), dy = Math.abs(((i / MAP_W) | 0) - gy);
    return (Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy)) * ROAD_COST;
  };
  gScore[start] = 0; fScore[start] = h(start); cameFrom[start] = -1; stamp[start] = generation;
  heapPush(start);

  while (heap.length > 0) {
    const cur = heapPop();
    if (closed[cur] === generation) continue;
    closed[cur] = generation;
    if (cur === goal) {
      const out: [number, number][] = [];
      for (let n = cur; n !== start && n >= 0; n = cameFrom[n]!) out.push([(n % MAP_W) + 0.5, ((n / MAP_W) | 0) + 0.5]);
      out.reverse();
      return out;
    }
    const cx = cur % MAP_W, cy = (cur / MAP_W) | 0;
    for (let d = 0; d < 8; d++) {
      const dx = DIRS[d]![0], dy = DIRS[d]![1];
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      const ni = ny * MAP_W + nx;
      if (closed[ni] === generation) continue;
      const c = tileCost(s, ni, loose);
      if (c === Infinity) continue;
      let step = c;
      if (d >= 4) {
        // diagonal: both orthogonal neighbours must be open (no cutting the corner of a wall or the stream)
        const ca = tileCost(s, cy * MAP_W + nx, loose), cb = tileCost(s, ny * MAP_W + cx, loose);
        if (ca === Infinity || cb === Infinity) continue;
        if (!loose || (strictWalkable(s, nx, cy) && strictWalkable(s, cx, ny))) step = c * SQRT2;
        else continue; // loose mode still refuses to cut corners of anything it would have to push through
      }
      const g = gScore[cur]! + step;
      if (stamp[ni] !== generation || g < gScore[ni]!) {
        stamp[ni] = generation;
        gScore[ni] = g; fScore[ni] = g + h(ni); cameFrom[ni] = cur;
        heapPush(ni);
      }
    }
  }
  return null;
}

/** Centre of the nearest walkable tile to (x, y). If the whole map is blocked, the tile itself. */
export function nearestWalkable(s: GameState, x: number, y: number): [number, number] {
  return nearestWalkableFrom(s, x, y, x, y);
}

/** Nearest walkable tile to (x, y); ties broken toward (px, py) so a walker picks the near side of a building. */
function nearestWalkableFrom(s: GameState, x: number, y: number, px: number, py: number): [number, number] {
  const tx = clampTile(x, MAP_W), ty = clampTile(y, MAP_H);
  if (strictWalkable(s, tx, ty)) return [tx + 0.5, ty + 0.5];
  const fx = Number.isFinite(x) ? x : tx + 0.5, fy = Number.isFinite(y) ? y : ty + 0.5;
  let best: [number, number] | null = null;
  let bestD = Infinity, bestP = Infinity;
  const maxR = Math.max(MAP_W, MAP_H);
  for (let r = 1; r <= maxR; r++) {
    // a tile on ring r is at least r - 1 away, so once the best beats that we can stop
    if (best && bestD <= r - 1) break;
    for (let yy = ty - r; yy <= ty + r; yy++) {
      for (let xx = tx - r; xx <= tx + r; xx++) {
        if (Math.max(Math.abs(xx - tx), Math.abs(yy - ty)) !== r) continue;
        if (!strictWalkable(s, xx, yy)) continue;
        const d = Math.hypot(xx + 0.5 - fx, yy + 0.5 - fy);
        const p = Math.hypot(xx + 0.5 - px, yy + 0.5 - py);
        if (d < bestD - 1e-9 || (Math.abs(d - bestD) <= 1e-9 && p < bestP - 1e-9)) { best = [xx + 0.5, yy + 0.5]; bestD = d; bestP = p; }
      }
    }
  }
  return best ?? [tx + 0.5, ty + 0.5];
}

/** Path of tile centres from (fx,fy) to (tx,ty), excluding the start; null if unreachable.
 *  The goal may be a non-walkable tile (a building): the path ends at the nearest walkable tile to it. */
export function findPath(s: GameState, fx: number, fy: number, tx: number, ty: number): [number, number][] | null {
  if (s.map.tiles.length < N) return null;
  const sx = clampTile(fx, MAP_W), sy = clampTile(fy, MAP_H);
  const [gx, gy] = nearestWalkableFrom(s, tx, ty, fx, fy);
  return search(s, sx, sy, Math.floor(gx), Math.floor(gy), false);
}

/** As findPath, but never gives up: if there is no honest way it scrambles through woods, over rock,
 *  across water and finally past buildings. Used by figures so that nothing can strand them. */
export function findPathLoose(s: GameState, fx: number, fy: number, tx: number, ty: number): [number, number][] {
  const strict = findPath(s, fx, fy, tx, ty);
  if (strict) return strict;
  if (s.map.tiles.length < N) return [[clampTile(tx, MAP_W) + 0.5, clampTile(ty, MAP_H) + 0.5]];
  const sx = clampTile(fx, MAP_W), sy = clampTile(fy, MAP_H);
  const [gx, gy] = nearestWalkableFrom(s, tx, ty, fx, fy);
  const rough = search(s, sx, sy, Math.floor(gx), Math.floor(gy), true);
  return rough ?? [[gx, gy]];
}

/** Walking distance of a path that starts at (fx, fy), in tiles. */
export function pathLength(fx: number, fy: number, path: readonly (readonly [number, number])[]): number {
  let d = 0, x = fx, y = fy;
  for (const p of path) { d += Math.hypot(p[0] - x, p[1] - y); x = p[0]; y = p[1]; }
  return d;
}
