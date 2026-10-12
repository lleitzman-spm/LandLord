/** OWNER: sim-world agent. Terrain, parcels, placement rules, roads, land, desirability.
 *
 *  The map is rolled from `s.seed` alone (its own generator, so it never disturbs `s.rng`):
 *  a stream wandering north to south through the eastern third, woods thickening toward the
 *  edges, scattered rock, a few tilled fields, and the old road that comes in at the west
 *  gate, runs through the hamlet (parcel 5) and leaves east over a bridge.
 */
import {
  MAP_W, MAP_H, PARCEL,
  type GameState, type SimModule, type ActionResult, type Building, type Tile, type Terrain, type Parcel,
  type RankId, type ActionOf, type Id,
} from './types';
import type { BuildingType, VisualId } from '../data/ids';
import { RANK_TITLES } from '../data/ids';
import { BUILDINGS } from '../data/buildings';
import { RANKS } from '../data/ranks';
import { tileAt, frontDir, inBounds, emit, herald, hash01, clamp, rankIndex } from './core';
import { nearestWalkable } from './path';
import { isUnlocked, maxParcels } from './rank';
import { canAfford, spend } from './economy';
import { enqueueJob } from './jobs';

export const TUNE = {
  roadCost: 1,               // crowns per tile of road
  bridgeCost: 5,             // crowns per tile of bridge (a road laid on water)
  clearForest: { cost: 2, days: 0.6 },
  clearRock: { cost: 5, days: 1.2 },
  /** tile wear lost per day everywhere (desire paths heal slowly) */
  wearDecayPerDay: 0.003,
  /** parcel price bands by distance from the hamlet (Manhattan, in parcels) */
  parcelPrice: [0, 85, 195, 430],
  desirability: {
    base: 50,
    roadBonus: 4,
    /** aura strength left at the very edge of its radius (linear falloff from 1 at the centre) */
    edgeShare: 0.25,
    /** each further amenity of the same type counts for this much of the one before */
    repeatShare: 0.5,
    nuisanceRadius: 4.5,
    squattersHere: 15, squattersNear: 8, ruinNear: 6, nastyHere: 5, nastyNear: 4,
  },
} as const;

// ───────────────────────────── seeded helpers ─────────────────────────────

/** A private generator for map rolling: the map depends on the seed and nothing else. */
function mulberry(seed: number): () => number {
  let a = seed | 0;
  return () => {
    let t = (a = (a + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const MAP_SALT = 0x5bd1e995;

/** The bones of a map, knowable from the seed alone. */
export interface MapPlan {
  /** row of the lane where it runs through parcel 5 (11 or 12) */
  roadRow: number;
  /** row where the road meets the west edge: the gate */
  gateRow: number;
  /** row where the road leaves east, crossing the stream by the bridge */
  eastRow: number;
  /** columns where the road jogs between those rows */
  jogWestX: number; jogEastX: number;
  /** the starting hamlet is laid out mirrored east to west */
  mirror: boolean;
}

function rollPlan(rnd: () => number): MapPlan {
  const roadRow = 11 + (rnd() < 0.5 ? 0 : 1);
  const jw = Math.floor(rnd() * 3) - 1, je = Math.floor(rnd() * 3) - 1;
  const jogWestX = 3 + Math.floor(rnd() * 4);
  const jogEastX = 17 + Math.floor(rnd() * 4);
  const mirror = rnd() < 0.5;
  return { roadRow, gateRow: roadRow + jw, eastRow: roadRow + je, jogWestX, jogEastX, mirror };
}
export function mapPlan(seed: number): MapPlan { return rollPlan(mulberry(seed ^ MAP_SALT)); }

/** smooth value noise in 0..1 on a lattice hashed from the seed */
function vnoise(x: number, y: number, salt: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const h = (px: number, py: number) => hash01((Math.imul(px, 374761393) + Math.imul(py, 668265263) + salt) | 0);
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

const inHamlet = (x: number, y: number): boolean => x >= PARCEL && x < 2 * PARCEL && y >= PARCEL && y < 2 * PARCEL;
const HAMLET = 5;

// ───────────────────────────── parcel names ─────────────────────────────

const PARCEL_NAMES = {
  water: ['Lower Dripping', 'Eel Reach', 'Beyond-the-Water', 'Millside', 'Wetfoot Meadow', 'The Sluice', 'Frogmarch', 'Leech Water',
    'Ducking Green', "Otter's Loss", 'Upper Dripping', 'Heron Stand', 'The Long Squelch', 'Bulrush Piece', 'Damp Furlong'],
  forest: ['The Stumps', 'Crow Wood', "Hangman's Copse", "Poacher's Thicket", "Wolf's Apology", 'Bramble Deep', 'The Kindling',
    'Owlpellet Wood', 'Lost Axe', 'Far Stumps', 'Tinder Hanger', 'The Tangle', 'Acorn Tithe', 'Squirrel Court'],
  rock: ['Stony Sorrow', 'Ploughbreaker', 'The Shins', 'Barren Tor', 'Flint Regret', 'Hard Acre', 'Stubtoe Field', 'Cobble Piece'],
  plain: ['Goose Common', 'Gallows Acre', 'Mudlark Bottom', 'Crow Acre', 'Tithe Meadow', 'Cowslip Pasture', 'Nettlebed', "Widow's Acre",
    'Turnip Reach', 'Thistle Piece', "Beggar's Rest", 'No Man\'s Close', 'Pigwhistle', "Sheep's Regret", 'Dock Leaf Common',
    'The Glebe', 'Ragwort Leys', 'Cuckoo Pen', 'Hogshead Field', 'Mare\'s Tail'],
  far: ["World's End", 'Back of Beyond', 'Nowhere in Particular', 'The Outer Mud', 'Lands Unvisited', 'Furthest Furlong'],
} as const;

// ───────────────────────────── map generation ─────────────────────────────

/** Generate terrain + parcels into s.map from s.seed (init). Parcel 5 starts owned. */
export function createMap(s: GameState): void {
  const rnd = mulberry(s.seed ^ MAP_SALT);
  const plan = rollPlan(rnd);
  const saltA = (s.seed * 31 + 17) | 0, saltB = (s.seed * 131 + 71) | 0;

  const tiles: Tile[] = [];
  for (let i = 0; i < MAP_W * MAP_H; i++) tiles.push({ t: 'grass', b: null, wear: 0, v: Math.floor(rnd() * 256) });
  const T = (x: number, y: number): Tile => tiles[y * MAP_W + x]!;
  const set = (x: number, y: number, t: Terrain): void => { if (inBounds(x, y)) T(x, y).t = t; };

  // ── the stream: north to south through the eastern third, wandering a tile at a time
  let sx = 23 + Math.floor(rnd() * 4);
  const streamAt: number[] = [];
  for (let y = 0; y < MAP_H; y++) {
    set(sx, y, 'water');
    streamAt.push(sx);
    if (y !== plan.eastRow && y < MAP_H - 1 && rnd() < 0.42) {
      const dir = rnd() < 0.5 ? -1 : 1;
      let nx = sx + dir;
      if (nx < 22 || nx > 28) nx = sx - dir;
      set(nx, y, 'water');          // both tiles wet on the turn, so the water stays joined edge to edge
      sx = nx;
    }
  }
  // a pool or two where it widens
  const pools = 1 + (rnd() < 0.55 ? 1 : 0);
  for (let k = 0; k < pools; k++) {
    const py = 2 + Math.floor(rnd() * (MAP_H - 5));
    const side = rnd() < 0.5 ? -1 : 1;
    if (Math.abs(py - plan.eastRow) <= 1 || Math.abs(py + 1 - plan.eastRow) <= 1) continue;
    for (let dy = 0; dy < 2; dy++) {
      const px = streamAt[py + dy]! + side;
      if (px >= 22 && px <= 29) set(px, py + dy, 'water');
    }
  }

  // ── the old road: west gate → the hamlet → east over the bridge
  const road = (x: number, y: number): void => { if (inBounds(x, y)) { const t = T(x, y); t.t = t.t === 'water' || t.t === 'bridge' ? 'bridge' : 'road'; } };
  const run = (a: number, b: number, f: (v: number) => void): void => { for (let v = Math.min(a, b); v <= Math.max(a, b); v++) f(v); };
  run(0, plan.jogWestX, x => road(x, plan.gateRow));
  run(plan.gateRow, plan.roadRow, y => road(plan.jogWestX, y));
  run(plan.jogWestX, plan.jogEastX, x => road(x, plan.roadRow));
  run(plan.roadRow, plan.eastRow, y => road(plan.jogEastX, y));
  run(plan.jogEastX, MAP_W - 1, x => road(x, plan.eastRow));

  // ── a few tilled fields near the hamlet
  const field = (x0: number, y0: number, w: number, h: number): void => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (inBounds(x, y) && !inHamlet(x, y) && T(x, y).t === 'grass') T(x, y).t = 'field';
  };
  field(9 + Math.floor(rnd() * 3), 17 + Math.floor(rnd() * 2), 3 + Math.floor(rnd() * 2), 2 + Math.floor(rnd() * 2));
  field(2 + Math.floor(rnd() * 3), plan.gateRow <= 11 ? plan.gateRow + 2 : plan.gateRow - 3, 3 + Math.floor(rnd() * 2), 2);
  field(10 + Math.floor(rnd() * 4), 3 + Math.floor(rnd() * 3), 3, 2);
  if (rnd() < 0.6) field(17 + Math.floor(rnd() * 3), plan.eastRow + (rnd() < 0.5 ? 2 : -3), 3, 2);

  // ── woods: clumps from noise, denser toward the edges of the board
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = T(x, y);
    if (t.t !== 'grass' || inHamlet(x, y)) continue;
    if (x <= 1 && Math.abs(y - plan.gateRow) <= 1) continue;            // keep the gate open and readable
    const ex = Math.abs(x - (MAP_W - 1) / 2) / ((MAP_W - 1) / 2), ey = Math.abs(y - (MAP_H - 1) / 2) / ((MAP_H - 1) / 2);
    const edge = Math.max(ex, ey);
    const n = 0.62 * vnoise(x / 3.4, y / 3.4, saltA) + 0.38 * vnoise(x / 1.6, y / 1.6, saltB);
    if (n + 0.42 * Math.pow(edge, 3.2) > 0.845) t.t = 'forest';
  }

  // ── rock: singles, and an outcrop or two
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = T(x, y);
    if (t.t === 'grass' && !inHamlet(x, y) && rnd() < 0.02) t.t = 'rock';
  }
  for (let k = 0; k < 2; k++) {
    const ox = 1 + Math.floor(rnd() * (MAP_W - 2)), oy = 1 + Math.floor(rnd() * (MAP_H - 2));
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
      const x = ox + dx, y = oy + dy;
      if (!inBounds(x, y) || inHamlet(x, y)) continue;
      const t = T(x, y);
      if ((t.t === 'grass' || t.t === 'forest') && (dx === 0 && dy === 0 || rnd() < 0.55)) t.t = 'rock';
    }
  }

  // ── the hamlet itself is mostly clear: a few trees and one stone on its rim, something to clear
  let rimTrees = 0, rimRock = false;
  for (let y = PARCEL; y < 2 * PARCEL; y++) for (let x = PARCEL; x < 2 * PARCEL; x++) {
    const rim = x === PARCEL || x === 2 * PARCEL - 1 || y === PARCEL || y === 2 * PARCEL - 1;
    const t = T(x, y);
    if (!rim || t.t !== 'grass') continue;
    const r = rnd();
    if (r < 0.13 && rimTrees < 4) { t.t = 'forest'; rimTrees++; }
    else if (r > 0.97 && !rimRock) { t.t = 'rock'; rimRock = true; }
  }

  // ── nothing walkable may be sealed off by trees or stone: cut a way through where it is
  s.map.w = MAP_W; s.map.h = MAP_H; s.map.tiles = tiles;
  openSealedGround(s, 0, plan.gateRow);

  // ── parcels
  const stats = Array.from({ length: 12 }, () => ({ water: 0, forest: 0, rock: 0, field: 0 }));
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const st = stats[Math.floor(y / PARCEL) * 4 + Math.floor(x / PARCEL)]!;
    const t = T(x, y).t;
    if (t === 'water' || t === 'bridge') st.water++;
    else if (t === 'forest') st.forest++;
    else if (t === 'rock') st.rock++;
    else if (t === 'field') st.field++;
  }
  const used = new Set<string>();
  const take = (pool: readonly string[]): string => {
    const free = pool.filter(n => !used.has(n));
    const from = free.length ? free : PARCEL_NAMES.plain.filter(n => !used.has(n));
    const name = from[Math.floor(rnd() * from.length)] ?? 'The Unnamed Acre';
    used.add(name);
    return name;
  };
  const parcels: Parcel[] = [];
  for (let i = 0; i < 12; i++) {
    const px = i % 4, py = Math.floor(i / 4);
    const d = Math.abs(px - 1) + Math.abs(py - 1);
    const st = stats[i]!;
    let name: string;
    if (i === HAMLET) { name = 'The Green'; used.add(name); }
    else if (d >= 3) name = take(PARCEL_NAMES.far);
    else if (st.water >= 7) name = take(PARCEL_NAMES.water);
    else if (st.forest >= 16) name = take(PARCEL_NAMES.forest);
    else if (st.rock >= 4) name = take(PARCEL_NAMES.rock);
    else name = take(PARCEL_NAMES.plain);
    // further out costs more; good tilled ground a little more, water and woods a little less
    const usable = 1 + st.field * 0.006 - st.water * 0.004 - st.forest * 0.003 - st.rock * 0.004;
    const raw = (TUNE.parcelPrice[Math.min(3, d)] ?? 430) * clamp(usable, 0.85, 1.1) + rnd() * 30 * Math.max(1, d);
    const minRank: RankId = d <= 1 ? 'reeve' : d === 2 ? 'knight' : 'baron';
    parcels.push({ id: i, x: px * PARCEL, y: py * PARCEL, owned: i === HAMLET, price: i === HAMLET ? 0 : Math.round(raw / 5) * 5, minRank, name });
  }
  s.map.parcels = parcels;
  invalidateDesirability(s);
}

/** Flood from the gate; wherever open ground is walled in by trees or rock, clear the shortest way to it. */
function openSealedGround(s: GameState, gx: number, gy: number): void {
  const tiles = s.map.tiles;
  const open = (i: number): boolean => { const t = tiles[i]!.t; return t === 'grass' || t === 'field' || t === 'road' || t === 'bridge'; };
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  for (let guard = 0; guard < 64; guard++) {
    const seen = new Uint8Array(MAP_W * MAP_H);
    const q: number[] = [gy * MAP_W + gx];
    seen[q[0]!] = 1;
    for (let h = 0; h < q.length; h++) {
      const c = q[h]!, cx = c % MAP_W, cy = (c / MAP_W) | 0;
      for (const [dx, dy] of N4) {
        const nx = cx + dx, ny = cy + dy;
        if (!inBounds(nx, ny)) continue;
        const ni = ny * MAP_W + nx;
        if (!seen[ni] && open(ni)) { seen[ni] = 1; q.push(ni); }
      }
    }
    let lost = -1;
    for (let i = 0; i < tiles.length; i++) if (open(i) && !seen[i]) { lost = i; break; }
    if (lost < 0) return;
    // breadth-first from the lost tile through anything but water until we touch reached ground
    const prev = new Int32Array(MAP_W * MAP_H).fill(-2);
    const bq: number[] = [lost];
    prev[lost] = -1;
    let hit = -1;
    for (let h = 0; h < bq.length && hit < 0; h++) {
      const c = bq[h]!, cx = c % MAP_W, cy = (c / MAP_W) | 0;
      for (const [dx, dy] of N4) {
        const nx = cx + dx, ny = cy + dy;
        if (!inBounds(nx, ny)) continue;
        const ni = ny * MAP_W + nx;
        if (prev[ni] !== -2 || tiles[ni]!.t === 'water') continue;
        prev[ni] = c;
        if (seen[ni]) { hit = ni; break; }
        bq.push(ni);
      }
    }
    if (hit < 0) { tiles[lost]!.t = 'forest'; continue; }   // an islet in the stream: let it grow over
    for (let n = prev[hit]!; n >= 0; n = prev[n]!) { const t = tiles[n]!; if (t.t === 'forest' || t.t === 'rock') t.t = 'grass'; }
  }
}

// ───────────────────────────── queries ─────────────────────────────

/** Footprint of a building type after rotation. */
export function footprint(btype: BuildingType, rot: number): { w: number; h: number } {
  const d = BUILDINGS[btype];
  if (!d) return { w: 1, h: 1 };
  return (((rot % 2) + 2) % 2) ? { w: d.h, h: d.w } : { w: d.w, h: d.h };
}

/** Can figures walk on this tile (not water/rock/forest, not under a building)? */
export function isWalkable(s: GameState, x: number, y: number): boolean {
  const t = tileAt(s, Math.floor(x), Math.floor(y));
  return !!t && !t.b && t.t !== 'water' && t.t !== 'rock' && t.t !== 'forest';
}

/** The parcel under this tile, if any. */
export function parcelAt(s: GameState, x: number, y: number): Parcel | null {
  if (!inBounds(Math.floor(x), Math.floor(y))) return null;
  return s.map.parcels[Math.floor(y / PARCEL) * 4 + Math.floor(x / PARCEL)] ?? null;
}

/** Is this tile inside an owned parcel? */
export function ownedAt(s: GameState, x: number, y: number): boolean {
  const p = parcelAt(s, x, y);
  return !!p && p.owned;
}

/** Where a figure stands to be "at the door": straight out from the middle of the front wall, half a tile clear
 *  of it (the centre of the walkable tile in front of the door; nearest walkable if blocked). A front an even
 *  number of tiles wide puts that point on the line between two tiles: figures stand on the line when both are
 *  open ground, so that they face the door and not the window beside it. */
export function entranceOf(s: GameState, b: Building): [number, number] {
  const [dx, dy] = frontDir(b.rot);
  const px = clamp(b.x + b.w / 2 + dx * (b.w / 2 + 0.5), 0.01, MAP_W - 0.01);
  const py = clamp(b.y + b.h / 2 + dy * (b.h / 2 + 0.5), 0.01, MAP_H - 0.01);
  const ax = dx === 0 ? 1 : 0, ay = dx === 0 ? 0 : 1;                    // along the wall
  const onLine = dx === 0 ? Number.isInteger(px) : Number.isInteger(py);
  if (!onLine) return isWalkable(s, px, py) ? [px, py] : nearestWalkable(s, px, py);
  const far = isWalkable(s, px, py), near = isWalkable(s, px - ax * 0.5, py - ay * 0.5);
  if (far && near) return [px, py];
  if (far) return [px + ax * 0.3, py + ay * 0.3];
  if (near) return [px - ax * 0.3, py - ay * 0.3];
  return nearestWalkable(s, px, py);
}

function address(s: GameState): string { return RANKS[s.realm.rank]?.address ?? 'Reeve'; }

/** May this be placed here now? Checks bounds, ownership, terrain, overlap, rank unlock, uniqueness, gold. */
export function canPlace(s: GameState, btype: BuildingType, x: number, y: number, rot: number): ActionResult {
  const def = BUILDINGS[btype];
  if (!def) return { ok: false, code: 'invalid', reason: 'No such building is in the pattern book.' };
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(rot)) {
    return { ok: false, code: 'invalid', reason: 'The surveyor cannot find that spot.' };
  }
  x = Math.floor(x); y = Math.floor(y);
  if (!isUnlocked(s, btype)) {
    return { ok: false, code: 'locked', reason: `A ${def.name} wants a ${RANK_TITLES[def.minRank]}'s charter, ${address(s)}.` };
  }
  if (def.category === 'seat' || def.category === 'staff') {
    for (const id in s.buildings) {
      if (s.buildings[id]!.type !== btype) continue;
      return def.category === 'seat'
        ? { ok: false, code: 'blocked', reason: 'You have a seat already. One is the customary number.' }
        : { ok: false, code: 'blocked', reason: `The realm has a ${def.name} already. One is plenty.` };
    }
  }
  const f = footprint(btype, rot);
  if (x < 0 || y < 0 || x + f.w > MAP_W || y + f.h > MAP_H) {
    return { ok: false, code: 'blocked', reason: `That is off the edge of the map, ${address(s)}.` };
  }
  for (let yy = y; yy < y + f.h; yy++) for (let xx = x; xx < x + f.w; xx++) {
    const t = tileAt(s, xx, yy);
    if (!t) return { ok: false, code: 'blocked', reason: `That is off the edge of the map, ${address(s)}.` };
    if (!ownedAt(s, xx, yy)) return { ok: false, code: 'not_owned', reason: 'That ground is not yours to build on. Not yet.' };
    if (t.b) {
      const other = s.buildings[t.b];
      return { ok: false, code: 'blocked', reason: other ? `${other.name} is standing there already.` : 'Something is standing there already.' };
    }
    if (t.t === 'water') return { ok: false, code: 'blocked', reason: `That is the stream. It would be a very damp ${def.name}.` };
    if (t.t === 'bridge') return { ok: false, code: 'blocked', reason: 'That is the bridge, and people are using it.' };
    if (t.t === 'forest') return { ok: false, code: 'blocked', reason: 'There are trees in the way. Clear them first.' };
    if (t.t === 'rock') return { ok: false, code: 'blocked', reason: 'There is rock in the way. Clear it first.' };
  }
  if (!canAfford(s, def.cost)) {
    return { ok: false, code: 'no_gold', reason: `A ${def.name} costs ${def.cost} crowns. The coffers hold ${Math.max(0, Math.floor(s.gold))}.` };
  }
  return { ok: true };
}

// ───────────────────────────── desirability ─────────────────────────────

const NASTY_NEAR: readonly VisualId[] = ['fire', 'rats', 'black_smoke', 'flood', 'curse_cloud', 'quarantine', 'bats', 'graffiti'];
const NASTY_HERE: readonly VisualId[] = [...NASTY_NEAR, 'leak', 'hole_roof', 'cracked_wall', 'mud', 'boarded', 'frozen', 'snowed_in', 'mushrooms'];

const desirCache = new WeakMap<GameState, { day: number; vals: Record<Id, number> }>();

/** Forget cached desirability. Every change to buildings, roads or nuisances in this module family calls it,
 *  so the cache is never stale with respect to state the sim owns. */
export function invalidateDesirability(s: GameState): void { desirCache.delete(s); }

function computeDesirability(s: GameState, b: Building): number {
  const D = TUNE.desirability;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  let score: number = D.base;

  // auras of ready neighbours: full strength at the centre, a quarter at the rim; repeats of a type count for less
  const byType: Record<string, number[]> = {};
  let squattersNear = 0, ruinsNear = 0, nastyNear = 0;
  for (const id in s.buildings) {
    const o = s.buildings[id]!;
    if (o.id === b.id) continue;
    const d = Math.hypot(o.x + o.w / 2 - cx, o.y + o.h / 2 - cy);
    if (d <= D.nuisanceRadius) {
      if (o.squatters) squattersNear++;
      if (o.state === 'ruined') ruinsNear++;
      for (const v of o.visuals) if (NASTY_NEAR.includes(v)) nastyNear++;
    }
    if (o.state !== 'ready') continue;
    const aura = BUILDINGS[o.type]?.aura;
    if (!aura || d > aura.radius) continue;
    const falloff = 1 - (1 - D.edgeShare) * (d / Math.max(0.001, aura.radius));
    const upkeep = 0.5 + 0.5 * clamp(o.condition, 0, 100) / 100;       // a crumbling well is less of an amenity
    const grandeur = o.type === 'seat' ? 1 + 0.5 * (Math.max(1, o.level) - 1) : 1;
    (byType[o.type] ??= []).push(aura.amount * falloff * (aura.amount > 0 ? upkeep : 1) * grandeur);
  }
  for (const type in byType) {
    const list = byType[type]!.sort((p, q) => Math.abs(q) - Math.abs(p));
    let share = 1;
    for (const amt of list) { score += amt * share; share *= D.repeatShare; }
  }

  // a road at the door
  let road = false;
  for (let x = b.x - 1; x <= b.x + b.w && !road; x++) for (let y = b.y - 1; y <= b.y + b.h; y++) {
    const onEdgeX = x === b.x - 1 || x === b.x + b.w, onEdgeY = y === b.y - 1 || y === b.y + b.h;
    if (onEdgeX === onEdgeY) continue;                                  // skip the inside and the four corners
    const t = tileAt(s, x, y);
    if (t && (t.t === 'road' || t.t === 'bridge')) { road = true; break; }
  }
  if (road) score += D.roadBonus;

  // its own state of repair
  score += (clamp(b.condition, 0, 100) - 60) / 4;

  // nuisances
  if (b.squatters) score -= D.squattersHere;
  score -= Math.min(2, squattersNear) * D.squattersNear;
  score -= Math.min(2, ruinsNear) * D.ruinNear;
  score -= Math.min(10, nastyNear * D.nastyNear);
  let nastyHere = 0;
  for (const v of b.visuals) if (NASTY_HERE.includes(v)) nastyHere++;
  score -= Math.min(15, nastyHere * D.nastyHere);

  return Math.round(clamp(Number.isFinite(score) ? score : D.base, 0, 100));
}

/** 0..100 — how nice it is to live in this building: auras, condition, roads, neighbours, nuisances. */
export function desirability(s: GameState, b: Building): number {
  const day = Math.floor(s.day);
  let c = desirCache.get(s);
  if (!c || c.day !== day) { c = { day, vals: {} }; desirCache.set(s, c); }
  const hit = c.vals[b.id];
  if (hit !== undefined && s.buildings[b.id] === b) return hit;
  const v = computeDesirability(s, b);
  if (s.buildings[b.id] === b) c.vals[b.id] = v;
  return v;
}

// ───────────────────────────── actions ─────────────────────────────

function cleanTiles(list: unknown): [number, number][] {
  const out: [number, number][] = [];
  if (!Array.isArray(list)) return out;
  const seen = new Set<number>();
  for (const p of list) {
    if (!Array.isArray(p)) continue;
    const x = Math.floor(Number(p[0])), y = Math.floor(Number(p[1]));
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const key = y * 4096 + x;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push([x, y]);
    if (out.length >= MAP_W * MAP_H) break;
  }
  return out;
}

function placeRoad(s: GameState, a: ActionOf<'place_road'>): ActionResult {
  const want = cleanTiles(a.tiles);
  if (!want.length) return { ok: false, code: 'invalid', reason: 'A road must go somewhere.' };
  const laid: [number, number][] = [];
  let cost = 0, bridges = 0;
  let refusal: ActionResult | null = null;
  for (const [x, y] of want) {
    const t = tileAt(s, x, y);
    if (!t) { refusal ??= { ok: false, code: 'blocked', reason: `That is off the edge of the map, ${address(s)}.` }; continue; }
    if (!ownedAt(s, x, y)) { refusal ??= { ok: false, code: 'not_owned', reason: 'That ground is not yours to pave.' }; continue; }
    if (t.b) { refusal ??= { ok: false, code: 'blocked', reason: 'A road cannot run through a wall. The wall objects.' }; continue; }
    if (t.t === 'road' || t.t === 'bridge') continue;
    if (t.t === 'forest') { refusal ??= { ok: false, code: 'blocked', reason: 'There are trees in the way. Clear them first.' }; continue; }
    if (t.t === 'rock') { refusal ??= { ok: false, code: 'blocked', reason: 'There is rock in the way. Clear it first.' }; continue; }
    const price = t.t === 'water' ? TUNE.bridgeCost : TUNE.roadCost;
    if (!canAfford(s, cost + price)) {
      refusal ??= { ok: false, code: 'no_gold', reason: t.t === 'water'
        ? `A bridge is ${TUNE.bridgeCost} crowns a span. The coffers will not stretch.`
        : 'Even mud costs a crown a length, and the coffers are bare.' };
      break;
    }
    if (t.t === 'water') { t.t = 'bridge'; bridges++; } else t.t = 'road';
    cost += price;
    laid.push([x, y]);
  }
  if (!laid.length) return refusal ?? { ok: false, code: 'invalid', reason: 'There is a road there already.' };
  const lengths = laid.length - bridges;
  const memo = bridges && lengths ? 'Road and bridge' : bridges ? (bridges === 1 ? 'A bridge' : 'Bridging') : (lengths === 1 ? 'A length of road' : `${lengths} lengths of road`);
  spend(s, cost, 'construction', memo);
  invalidateDesirability(s);
  emit(s, { type: 'tiles_changed', tiles: laid });
  emit(s, { type: 'sfx', id: 'place' });
  return { ok: true };
}

function removeRoad(s: GameState, a: ActionOf<'remove_road'>): ActionResult {
  const want = cleanTiles(a.tiles);
  const changed: [number, number][] = [];
  let refusal: ActionResult | null = null;
  for (const [x, y] of want) {
    const t = tileAt(s, x, y);
    if (!t) continue;
    if (t.t !== 'road' && t.t !== 'bridge') continue;
    if (!ownedAt(s, x, y)) { refusal ??= { ok: false, code: 'not_owned', reason: 'That stretch is the Crown\'s road, not yours to dig up.' }; continue; }
    t.t = t.t === 'bridge' ? 'water' : 'grass';
    t.wear = Math.max(t.wear, 0.6);            // the ghost of a road: a worn track remains for a season
    if (t.t === 'water') t.wear = 0;
    changed.push([x, y]);
  }
  if (!changed.length) return refusal ?? { ok: false, code: 'invalid', reason: 'There is no road there to take up.' };
  invalidateDesirability(s);
  emit(s, { type: 'tiles_changed', tiles: changed });
  emit(s, { type: 'sfx', id: 'thud' });
  return { ok: true };
}

/** Queue the clearing of one forest or rock tile. Shared by the clear tool and by spoken orders. */
export function orderClear(s: GameState, x: number, y: number, byRuler = false): ActionResult {
  const tx = Math.floor(x), ty = Math.floor(y);
  const t = tileAt(s, tx, ty);
  if (!t) return { ok: false, code: 'blocked', reason: `That is off the edge of the map, ${address(s)}.` };
  if (t.t !== 'forest' && t.t !== 'rock') return { ok: false, code: 'invalid', reason: 'There is nothing there to clear.' };
  if (!ownedAt(s, tx, ty)) return { ok: false, code: 'not_owned', reason: 'Those are not your trees to fell. Not yet.' };
  for (const id in s.jobs) {
    const j = s.jobs[id]!;
    if (j.kind === 'clear_land' && (j.state === 'queued' || j.state === 'traveling' || j.state === 'working') && Math.floor(j.x) === tx && Math.floor(j.y) === ty) {
      return { ok: false, code: 'busy', reason: 'That is already marked for clearing.' };
    }
  }
  const spec = t.t === 'forest' ? TUNE.clearForest : TUNE.clearRock;
  const job = enqueueJob(s, { kind: 'clear_land', role: 'mason', x: tx + 0.5, y: ty + 0.5, workDays: spec.days, cost: spec.cost, byRuler });
  return { ok: true, id: job.id };
}

/** The nearest forest or rock tile on owned land with no clearing job on it yet (for "clear some land"). */
export function nearestClearable(s: GameState, nearX: number, nearY: number): [number, number] | null {
  const marked = new Set<number>();
  for (const id in s.jobs) {
    const j = s.jobs[id]!;
    if (j.kind === 'clear_land' && j.state !== 'done' && j.state !== 'cancelled') marked.add(Math.floor(j.y) * MAP_W + Math.floor(j.x));
  }
  let best: [number, number] | null = null, bestD = Infinity;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = s.map.tiles[y * MAP_W + x];
    if (!t || (t.t !== 'forest' && t.t !== 'rock') || marked.has(y * MAP_W + x) || !ownedAt(s, x, y)) continue;
    const d = Math.hypot(x + 0.5 - nearX, y + 0.5 - nearY);
    if (d < bestD) { bestD = d; best = [x, y]; }
  }
  return best;
}

/** A clearing job finished: the tile becomes grass. Called by buildings.onJobDone. */
export function finishClear(s: GameState, x: number, y: number): void {
  const tx = Math.floor(x), ty = Math.floor(y);
  const t = tileAt(s, tx, ty);
  if (!t || (t.t !== 'forest' && t.t !== 'rock')) return;
  const wasRock = t.t === 'rock';
  t.t = 'grass';
  t.wear = 0.5;                                // fresh-turned earth
  invalidateDesirability(s);
  emit(s, { type: 'tiles_changed', tiles: [[tx, ty]] });
  emit(s, { type: 'sfx', id: wasRock ? 'thud' : 'saw' });
}

const PARCEL_LINES = [
  '{parcel} is yours, {address}. The deed describes the drainage as "present".',
  'The Crown has sold you {parcel}. The previous owner was nobody, and is glad to be rid of it.',
  '{parcel} now lies within the realm. So do its nettles.',
  'You have bought {parcel}. The boundary stones have been moved, this time lawfully.',
  '{parcel} is added to the realm. The surveyor counted it twice and got two different sizes.',
];

function buyParcel(s: GameState, a: ActionOf<'buy_parcel'>): ActionResult {
  const p = s.map.parcels[a.parcelId];
  if (!p || p.id !== a.parcelId) return { ok: false, code: 'not_found', reason: 'No such parcel is on the Crown\'s map.' };
  if (p.owned) return { ok: false, code: 'invalid', reason: `${p.name} is yours already.` };
  if (rankIndex(s.realm.rank) < rankIndex(p.minRank)) {
    return { ok: false, code: 'locked', reason: `The Crown sells ${p.name} to no one below a ${RANK_TITLES[p.minRank]}.` };
  }
  const owned = s.map.parcels.filter(q => q.owned).length;
  const cap = maxParcels(s);
  if (owned >= cap) {
    return { ok: false, code: 'locked', reason: `Your charter allows ${cap} ${cap === 1 ? 'parcel' : 'parcels'}, ${address(s)}, and you hold ${owned}.` };
  }
  const px = p.id % 4, py = Math.floor(p.id / 4);
  const touches = s.map.parcels.some(q => q.owned && Math.abs((q.id % 4) - px) + Math.abs(Math.floor(q.id / 4) - py) === 1);
  if (!touches) return { ok: false, code: 'blocked', reason: `${p.name} does not march with your land. Buy what lies between first.` };
  if (!canAfford(s, p.price)) {
    return { ok: false, code: 'no_gold', reason: `${p.name} is ${p.price} crowns. The coffers hold ${Math.max(0, Math.floor(s.gold))}.` };
  }
  spend(s, p.price, 'land', `The deed to ${p.name}`);
  p.owned = true;
  invalidateDesirability(s);
  emit(s, { type: 'parcel_bought', parcelId: p.id });
  emit(s, { type: 'sfx', id: 'stamp' });
  const line = PARCEL_LINES[Math.abs(s.seed + p.id * 7 + owned) % PARCEL_LINES.length] ?? PARCEL_LINES[0]!;
  herald(s, 'good', line.replace('{parcel}', p.name).replace('{address}', address(s)));
  return { ok: true };
}

function clearTile(s: GameState, a: ActionOf<'clear_tile'>): ActionResult {
  return orderClear(s, Number(a.x), Number(a.y), false);
}

// ───────────────────────────── module ─────────────────────────────

export const worldModule: SimModule = {
  name: 'world',
  init(s) { createMap(s); },
  onDay(s) {
    // desire paths heal slowly everywhere; tell the renderer when a tile visibly changes
    const changed: [number, number][] = [];
    const tiles = s.map.tiles;
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i]!;
      if (!(t.wear > 0)) { if (t.wear !== 0) t.wear = 0; continue; }
      const next = Math.max(0, t.wear - TUNE.wearDecayPerDay);
      if (Math.floor(next * 8) !== Math.floor(t.wear * 8)) changed.push([i % MAP_W, (i / MAP_W) | 0]);
      t.wear = next;
    }
    if (changed.length) emit(s, { type: 'tiles_changed', tiles: changed });
    invalidateDesirability(s);
  },
  handlers: {
    place_road: placeRoad,
    remove_road: removeRoad,
    clear_tile: clearTile,
    buy_parcel: buyParcel,
  },
};
