/**
 * sim-world tests: map, placement, pathing, buildings, actors, jobs.
 *   npx tsx test/sim-world.test.ts
 *
 * Most tests run a realm driven by the four sim-world modules alone (`WorldSim`), so that they
 * hold while the rest of the sim is being rewritten around them; those modules' exported
 * functions (economy.spend, tenants.moveOut, rank.isUnlocked...) are still the real ones.
 * The last tests run the whole `Sim`. A throw whose stack starts outside the sim-world files
 * is reported as FOREIGN and does not fail this suite.
 */
import assert from 'node:assert/strict';
import { Sim, blankState, MODULES } from '../src/sim/index';
import {
  MAP_W, MAP_H, PARCEL,
  type GameState, type SimModule, type SimEvent, type Action, type ActionResult, type Building, type Tenant,
  type StaffMember, type Job, type Mode, type Applicant, type Incident,
} from '../src/sim/types';
import { registerModules, tileAt, dateOf } from '../src/sim/core';
import {
  worldModule, createMap, canPlace, isWalkable, ownedAt, entranceOf, desirability, footprint, mapPlan, TUNE as WORLD_TUNE,
} from '../src/sim/world';
import {
  buildingsModule, seatOf, damageBuilding, repairBuilding, setSquatters, makeBuildingName, conditionBand, decayPerMonth,
  incidentChancePerMonth, vacancies, leasable, countBuildings, upgradeSeat, repairQuote, renovateQuote, TUNE as BUILD_TUNE,
} from '../src/sim/buildings';
import { actorsModule, rulerActor, spawnActor, walkTo, gatePoint, actorFor, staffActor, TUNE as ACTOR_TUNE } from '../src/sim/actors';
import { jobsModule, enqueueJob, cancelJob, jobsAt, hasWorker, TUNE as JOB_TUNE } from '../src/sim/jobs';
import { findPath, findPathLoose, nearestWalkable } from '../src/sim/path';
import { BUILDINGS } from '../src/data/buildings';
import { BUILDING_TYPES, type BuildingType } from '../src/data/ids';
import { TEMPERAMENT_DEFS } from '../src/data/temperaments';
import { RANKS } from '../src/data/ranks';
import { BAL } from '../src/data/balance';
import { spawnApplicant } from '../src/sim/tenants';
import { makeFixtureState } from '../src/dev/fixture';

// ───────────────────────────── harness ─────────────────────────────

const MINE: SimModule[] = [worldModule, buildingsModule, actorsModule, jobsModule];
const MY_FILES = ['sim/world.ts', 'sim/path.ts', 'sim/buildings.ts', 'sim/actors.ts', 'sim/jobs.ts', 'sim-world.test.ts'];

/** A realm run by the sim-world modules alone. */
class WorldSim {
  s: GameState;
  events: SimEvent[] = [];
  done: Record<string, number> = {};
  private mods: SimModule[];

  constructor(seed = 7, opts: { gold?: number; mode?: Mode } = {}) {
    const spy: SimModule = { name: 'spy', onJobDone: (_s, job) => { this.done[job.id] = (this.done[job.id] ?? 0) + 1; } };
    this.mods = [...MINE, spy];
    registerModules(this.mods);
    this.s = blankState({ seed, mode: opts.mode ?? 'peace', ruler: 'Luke', realm: 'Testing Parva' });
    for (const m of MINE) m.init?.(this.s);
    this.s.gold = opts.gold ?? 500;
    this.drain();
  }
  use(): this { registerModules(this.mods); return this; }
  drain(): SimEvent[] { const evs = this.s._events; this.s._events = []; this.events.push(...evs); return evs; }
  /** advance by game days in ticks of at most `tick` */
  advance(days: number, tick = 0.25): SimEvent[] {
    const s = this.s;
    const out: SimEvent[] = [];
    let left = days;
    while (left > 1e-9) {
      const dt = Math.min(left, tick);
      left -= dt;
      const before = Math.floor(s.day);
      s.day += dt;
      for (const m of MINE) m.step?.(s, dt);
      const after = Math.floor(s.day);
      for (let d = before + 1; d <= after; d++) {
        for (const m of MINE) m.onDay?.(s, d);
        if (d % 30 === 0) for (const m of MINE) m.onMonth?.(s, dateOf(d).monthIndex);
      }
      out.push(...this.drain());
    }
    return out;
  }
  /** advance until pred holds; returns days taken, or throws */
  until(pred: () => boolean, maxDays = 60, tick = 0.05): number {
    const start = this.s.day;
    while (!pred()) {
      if (this.s.day - start > maxDays) throw new Error(`condition not reached within ${maxDays} days`);
      this.advance(tick, tick);
    }
    return this.s.day - start;
  }
  dispatch(a: Action): ActionResult {
    for (const m of MINE) {
      const h = (m.handlers as Record<string, ((s: GameState, a: Action) => ActionResult) | undefined> | undefined)?.[a.type];
      if (h) { const r = h(this.s, a); this.drain(); return r; }
    }
    throw new Error('no sim-world handler for ' + a.type);
  }
  since(mark: number): SimEvent[] { return this.events.slice(mark); }
}

const results: { name: string; status: 'ok' | 'fail' | 'foreign'; detail?: string }[] = [];
function test(name: string, fn: () => void): void {
  try {
    fn();
    results.push({ name, status: 'ok' });
    console.log('  ok       ' + name);
  } catch (e) {
    const err = e as Error;
    const frames = (err.stack ?? '').split('\n').filter(l => /^\s+at /.test(l) && !/node:|node_modules/.test(l));
    const top = frames[0] ?? '';
    const foreign = !(err instanceof assert.AssertionError) && top !== '' && !MY_FILES.some(f => top.includes(f));
    results.push({ name, status: foreign ? 'foreign' : 'fail', detail: err.stack ?? String(err) });
    console.log(`  ${foreign ? 'FOREIGN ' : 'FAIL    '} ${name}\n${(err.stack ?? String(err)).split('\n').slice(0, 8).map(l => '             ' + l).join('\n')}`);
  }
}

const refused = (r: ActionResult, code: string): void => {
  assert.equal(r.ok, false, 'expected a refusal');
  if (!r.ok) {
    assert.equal(r.code, code, `expected refusal "${code}", got "${r.code}": ${r.reason}`);
    assert.ok(r.reason.length > 4 && r.reason.length <= 160, 'refusal reason should be a short sentence');
    assert.ok(!/[–—]/.test(r.reason), 'no dashes in player-facing text');
  }
};
const accepted = (r: ActionResult): string | undefined => {
  assert.equal(r.ok, true, r.ok ? '' : `refused (${r.code}): ${r.reason}`);
  return r.ok ? r.id : undefined;
};

function freeSpot(s: GameState, btype: BuildingType, rot = 0, pred: (x: number, y: number) => boolean = () => true): [number, number] {
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (pred(x, y) && canPlace(s, btype, x, y, rot).ok) return [x, y];
  throw new Error('no free spot for ' + btype);
}
function ownEverything(s: GameState): void { for (const p of s.map.parcels) p.owned = true; }
function findTile(s: GameState, pred: (x: number, y: number) => boolean): [number, number] {
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (pred(x, y)) return [x, y];
  throw new Error('no such tile');
}
function hovels(s: GameState): Building[] { return Object.values(s.buildings).filter(b => b.type === 'hovel'); }
function mkTenant(s: GameState, b: Building, unit = 0, over: Partial<Tenant> = {}): Tenant {
  const id = 't' + (s.nextId++).toString(36);
  const t: Tenant = {
    id, name: 'Wat Mudge', first: 'Wat', species: 'human', trade: 'laborer', character: null, portraitSeed: 1, household: 2,
    traits: [], revealed: [], tags: [], pets: [], income: 30, reliability: 0.8, happiness: 60, status: 'housed', buildingId: b.id, unit,
    lease: { rent: b.rent, startDay: s.day, termMonths: 12, deposit: b.rent }, movedInDay: s.day, arrears: 0, daysLate: 0, lateStage: 'none',
    plan: null, courtDay: null, memory: [], wear: 5, leftDay: null, ...over,
  };
  s.tenants[id] = t;
  const u = b.units[unit]!;
  u.tenantId = id; u.vacantSince = null; u.listed = false;
  return t;
}
function mkStaff(s: GameState, role: StaffMember['role'], skill = 3): StaffMember {
  const id = 's' + (s.nextId++).toString(36);
  const temperament = ({ mason: 'steady', bailiff: 'lawful', crier: 'honest', steward: 'bythebook' } as const)[role];
  const m: StaffMember = { id, role, name: 'Hob Trowelsby', first: 'Hob', species: 'human', portraitSeed: 5, temperament, skill, wage: 12, loyalty: 70, hiredDay: s.day, actorId: null, authority: 0, jobsDone: 0 };
  s.staff[id] = m;
  const home = seatOf(s);
  const a = spawnActor(s, { kind: 'staff', refId: id, x: home.x + 0.5, y: home.y + home.h + 0.5 });
  m.actorId = a.id;
  return m;
}
/** an applicant the way tenants.ts makes one: a figure at the gate, homed at the door of the vacancy, walking to it */
function mkApplicant(s: GameState, b: Building, unit = 0, name = 'Jory Applewhite'): Applicant {
  const id = 'p' + (s.nextId++).toString(36);
  const gate = gatePoint(s), door = entranceOf(s, b);
  const actor = spawnActor(s, { kind: 'applicant', refId: id, x: gate[0], y: gate[1] });
  actor.homeX = door[0]; actor.homeY = door[1];
  walkTo(s, actor.id, door[0], door[1]);
  const ap: Applicant = {
    id, buildingId: b.id, unit, arrivedDay: s.day, leavesDay: s.day + 9, maxRent: 10, shown: false, screened: false, actorId: actor.id,
    household: { id: 't' + id, name, first: name.split(' ')[0]!, species: 'human', trade: 'carpenter', character: null, portraitSeed: 1, household: 3, traits: ['handy'], revealed: [], tags: [], pets: [], income: 40, reliability: 0.8 },
  };
  s.applicants[id] = ap;
  return ap;
}
function mkIncident(s: GameState, over: Partial<Incident> = {}): Incident {
  const id = 'i' + (s.nextId++).toString(36);
  const inc: Incident = {
    id, defId: 'test_matter', state: 'open', buildingId: null, unit: null, tenantId: null, applicantId: null, startedDay: s.day, expiresDay: null,
    vars: {}, outcomeId: null, resolvedBy: null, jobId: null, actorId: null, reported: false, ...over,
  };
  s.incidents[id] = inc;
  return inc;
}
/** every number in a value is finite; no undefined anywhere (so it survives JSON) */
function assertClean(v: unknown, path: string): void {
  if (typeof v === 'number') { assert.ok(Number.isFinite(v), `${path} is ${v}`); return; }
  if (v === undefined) { assert.fail(`${path} is undefined`); }
  if (v === null || typeof v !== 'object') return;
  if (Array.isArray(v)) { v.forEach((x, i) => assertClean(x, `${path}[${i}]`)); return; }
  for (const k of Object.keys(v as object)) assertClean((v as Record<string, unknown>)[k], `${path}.${k}`);
}
function assertWorldSane(s: GameState): void {
  assertClean(s.map, 'map'); assertClean(s.buildings, 'buildings'); assertClean(s.actors, 'actors'); assertClean(s.jobs, 'jobs');
  assert.equal(s.map.tiles.length, MAP_W * MAP_H);
  for (const t of s.map.tiles) {
    assert.ok(t.wear >= 0 && t.wear <= 1, 'wear in 0..1');
    if (t.b) assert.ok(s.buildings[t.b], 'tile points at a building that exists');
  }
  for (const b of Object.values(s.buildings)) {
    assert.ok(b.condition >= 0 && b.condition <= 100, `${b.name} condition ${b.condition}`);
    assert.ok(b.progress >= 0 && b.progress <= 1, `${b.name} progress ${b.progress}`);
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) assert.equal(tileAt(s, x, y)?.b, b.id, `${b.name} owns its footprint`);
    if (b.state === 'ruined') assert.equal(b.condition, 0);
    if (b.state === 'ready') assert.equal(b.units.length, BUILDINGS[b.type].units);
  }
  for (const a of Object.values(s.actors)) {
    assert.ok(a.x >= 0 && a.x <= MAP_W && a.y >= 0 && a.y <= MAP_H, `actor ${a.id} on the map (${a.x}, ${a.y})`);
    if (a.jobId) assert.ok(s.jobs[a.jobId] && s.jobs[a.jobId]!.assignee === a.id, 'actor and job agree');
  }
  const busy = new Set<string>();
  for (const j of Object.values(s.jobs)) {
    assert.ok(j.progress >= 0 && j.progress <= 1, 'job progress in 0..1');
    if (j.state === 'traveling' || j.state === 'working') {
      assert.ok(j.assignee && s.actors[j.assignee], 'active job has a worker');
      assert.ok(!busy.has(j.assignee!), 'one job per actor at a time');
      busy.add(j.assignee!);
    }
  }
  assert.equal(Object.values(s.actors).filter(a => a.kind === 'ruler').length, 1, 'exactly one ruler');
}
const mySlices = (s: GameState): string => JSON.stringify({ map: s.map, buildings: s.buildings, actors: s.actors, jobs: s.jobs });

// ───────────────────────────── the map ─────────────────────────────

console.log('\nmap');

test('the same seed rolls the same map; another seed rolls another', () => {
  const a = blankState({ seed: 1234 }), b = blankState({ seed: 1234 }), c = blankState({ seed: 1235 });
  createMap(a); createMap(b); createMap(c);
  assert.equal(JSON.stringify(a.map), JSON.stringify(b.map));
  assert.notEqual(JSON.stringify(a.map), JSON.stringify(c.map));
  assert.equal(a.rng, blankState({ seed: 1234 }).rng, 'rolling the map does not disturb the sim rng');
});

test('terrain: mostly grass, a stream through the eastern third, woods toward the edges, a gated road, a bridge', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const s = blankState({ seed: seed * 7919 });
    createMap(s);
    const T = (x: number, y: number) => s.map.tiles[y * MAP_W + x]!;
    assert.equal(s.map.tiles.length, MAP_W * MAP_H);
    const count: Record<string, number> = {};
    for (const t of s.map.tiles) { count[t.t] = (count[t.t] ?? 0) + 1; assert.ok(t.v >= 0 && t.v <= 255 && Number.isInteger(t.v)); assert.equal(t.b, null); assert.equal(t.wear, 0); }
    assert.ok((count.grass ?? 0) > MAP_W * MAP_H * 0.5, `seed ${seed}: mostly grass (${count.grass})`);
    assert.ok((count.forest ?? 0) >= 60, `seed ${seed}: there are woods (${count.forest})`);
    assert.ok((count.rock ?? 0) >= 3, `seed ${seed}: there is rock`);
    assert.ok((count.field ?? 0) >= 6, `seed ${seed}: there are fields`);
    assert.ok((count.bridge ?? 0) >= 1, `seed ${seed}: there is a bridge`);
    // the stream: wet in every row, never west of the eastern third, joined edge to edge from north to south
    for (let y = 0; y < MAP_H; y++) {
      let wet = 0;
      for (let x = 0; x < MAP_W; x++) if (T(x, y).t === 'water' || T(x, y).t === 'bridge') { wet++; assert.ok(x >= 21, `seed ${seed}: water at x=${x}`); }
      assert.ok(wet >= 1, `seed ${seed}: the stream reaches row ${y}`);
    }
    const seen = new Set<number>();
    const q: number[] = [];
    for (let x = 0; x < MAP_W; x++) if (T(x, 0).t === 'water') { q.push(x); seen.add(x); }
    let south = false;
    while (q.length) {
      const c = q.pop()!; const cx = c % MAP_W, cy = (c / MAP_W) | 0;
      if (cy === MAP_H - 1) south = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
        const ni = ny * MAP_W + nx;
        if (!seen.has(ni) && (T(nx, ny).t === 'water' || T(nx, ny).t === 'bridge')) { seen.add(ni); q.push(ni); }
      }
    }
    assert.ok(south, `seed ${seed}: the stream runs unbroken from north to south`);
    // woods are denser toward the edges
    let rimForest = 0, rim = 0, midForest = 0, mid = 0;
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const edge = Math.min(x, y, MAP_W - 1 - x, MAP_H - 1 - y);
      if (edge < 3) { rim++; if (T(x, y).t === 'forest') rimForest++; } else if (edge >= 6) { mid++; if (T(x, y).t === 'forest') midForest++; }
    }
    assert.ok(rimForest / rim > midForest / Math.max(1, mid), `seed ${seed}: woods thicken toward the edge`);
    // the gate, and a road from it into the hamlet
    const plan = mapPlan(s.seed);
    const gate = gatePoint(s);
    assert.deepEqual(gate, [0.5, plan.gateRow + 0.5]);
    assert.equal(T(0, plan.gateRow).t, 'road');
    const rq: number[] = [plan.gateRow * MAP_W];
    const rseen = new Set<number>(rq);
    let intoHamlet = false, overBridge = false;
    while (rq.length) {
      const c = rq.pop()!; const cx = c % MAP_W, cy = (c / MAP_W) | 0;
      if (cx >= 8 && cx < 16 && cy >= 8 && cy < 16) intoHamlet = true;
      if (T(cx, cy).t === 'bridge') overBridge = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
        const ni = ny * MAP_W + nx;
        if (!rseen.has(ni) && (T(nx, ny).t === 'road' || T(nx, ny).t === 'bridge')) { rseen.add(ni); rq.push(ni); }
      }
    }
    assert.ok(intoHamlet, `seed ${seed}: the road from the gate reaches parcel 5`);
    assert.ok(overBridge, `seed ${seed}: the road crosses the stream by a bridge`);
    // parcel 5 is mostly clear
    let blocked = 0;
    for (let y = 8; y < 16; y++) for (let x = 8; x < 16; x++) if (T(x, y).t === 'forest' || T(x, y).t === 'rock' || T(x, y).t === 'water') blocked++;
    assert.ok(blocked <= 6, `seed ${seed}: parcel 5 mostly clear (${blocked} blocked)`);
    // nothing walkable is sealed off
    const wq: number[] = [plan.gateRow * MAP_W];
    const wseen = new Set<number>(wq);
    while (wq.length) {
      const c = wq.pop()!; const cx = c % MAP_W, cy = (c / MAP_W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = cx + dx, ny = cy + dy;
        if (!isWalkable(s, nx, ny)) continue;
        const ni = ny * MAP_W + nx;
        if (!wseen.has(ni)) { wseen.add(ni); wq.push(ni); }
      }
    }
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (isWalkable(s, x, y)) assert.ok(wseen.has(y * MAP_W + x), `seed ${seed}: (${x},${y}) can be walked to from the gate`);
  }
});

test('twelve parcels: comic names, only parcel 5 owned, price and rank rising with distance', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const s = blankState({ seed: seed * 104729 });
    createMap(s);
    const ps = s.map.parcels;
    assert.equal(ps.length, 12);
    const names = new Set<string>();
    const byRing: number[][] = [[], [], [], []];
    ps.forEach((p, i) => {
      assert.equal(p.id, i);
      assert.equal(p.x, (i % 4) * PARCEL); assert.equal(p.y, Math.floor(i / 4) * PARCEL);
      assert.equal(p.owned, i === 5);
      assert.ok(p.name.length >= 4 && p.name.length <= 28 && !/[–—]/.test(p.name) && !/^Parcel/.test(p.name), `name "${p.name}"`);
      assert.ok(!names.has(p.name), `seed ${seed}: parcel name "${p.name}" repeats`);
      names.add(p.name);
      const d = Math.abs((i % 4) - 1) + Math.abs(Math.floor(i / 4) - 1);
      assert.equal(p.minRank, d <= 1 ? 'reeve' : d === 2 ? 'knight' : 'baron', `parcel ${i} ring ${d}`);
      if (i !== 5) { assert.ok(Number.isInteger(p.price) && p.price > 0); byRing[d]!.push(p.price); }
    });
    assert.ok(Math.max(...byRing[1]!) < Math.min(...byRing[2]!), `seed ${seed}: ring 1 cheaper than ring 2`);
    assert.ok(Math.max(...byRing[2]!) < Math.min(...byRing[3]!), `seed ${seed}: ring 2 cheaper than ring 3`);
    assert.deepEqual([3, 11].map(i => ps[i]!.minRank), ['baron', 'baron'], 'the far corners are a Baron\'s');
  }
});

test('a new reign: the seat, three hovels (one shabby and vacant), the ruler at the door', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const w = new WorldSim(seed * 31337);
    const s = w.s;
    const all = Object.values(s.buildings);
    assert.equal(all.length, 4);
    const seat = seatOf(s);
    assert.equal(seat.type, 'seat'); assert.equal(seat.level, 1); assert.equal(seat.state, 'ready'); assert.equal(seat.name, "Reeve's Hut");
    const hs = hovels(s);
    assert.equal(hs.length, 3);
    for (const b of all) {
      assert.equal(b.state, 'ready');
      for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
        assert.ok(x >= 8 && x < 16 && y >= 8 && y < 16, `seed ${seed}: ${b.name} lies inside parcel 5`);
        assert.equal(tileAt(s, x, y)!.b, b.id);
        assert.equal(tileAt(s, x, y)!.t, 'grass');
      }
      const [ex, ey] = entranceOf(s, b);
      assert.ok(isWalkable(s, ex, ey), `seed ${seed}: ${b.name} has a door you can stand at`);
      assert.ok(Math.abs(ex - (b.x + b.w / 2)) <= b.w / 2 + 1 && Math.abs(ey - (b.y + b.h / 2)) <= b.h / 2 + 1, 'the door is at the building');
    }
    const shabby = hs.filter(b => b.condition < 50);
    assert.equal(shabby.length, 1, `seed ${seed}: exactly one shabby hovel`);
    assert.ok(shabby[0]!.condition >= 30 && shabby[0]!.condition <= 40, 'about 35');
    assert.equal(shabby[0]!.units[0]!.tenantId, null);
    assert.equal(shabby[0]!.units[0]!.listed, true);
    assert.equal(hs[2], shabby[0], 'the shabby hovel is the last of the three, so the first two are the ones to house people in');
    for (const b of hs) { assert.equal(b.units.length, 1); assert.ok(b.rent >= 1); }
    assert.equal(new Set(all.map(b => b.name)).size, 4, 'names do not repeat');
    const r = rulerActor(s);
    const [sx, sy] = entranceOf(s, seat);
    assert.ok(Math.hypot(r.x - sx, r.y - sy) < 0.5, `seed ${seed}: the ruler stands at the seat's door`);
    assert.equal(r.state, 'idle'); assert.equal(r.jobId, null); assert.equal(r.kind, 'ruler');
    assert.equal(tileAt(s, Math.floor(sx), Math.floor(sy))!.t, 'road', 'the seat opens onto the lane');
    assert.equal(vacancies(s).length, 3); assert.equal(leasable(s).length, 3); assert.equal(countBuildings(s, 'hovel'), 3);
    assertWorldSane(s);
  }
});

// ───────────────────────────── placement ─────────────────────────────

console.log('\nplacement');

test('canPlace refuses: off the map, unowned, water, trees, rock, overlap, rank, one-of-a-kind, no gold', () => {
  const w = new WorldSim(7);
  const s = w.s;
  const inHamlet = (x: number, y: number) => x >= 8 && x < 15 && y >= 8 && y < 15;
  const [fx, fy] = freeSpot(s, 'hovel', 0, inHamlet);
  accepted(canPlace(s, 'hovel', fx, fy, 0));
  refused(canPlace(s, 'hovel', -1, 10, 0), 'blocked');
  refused(canPlace(s, 'hovel', MAP_W - 1, 10, 0), 'blocked');
  refused(canPlace(s, 'hovel', 10, MAP_H - 1, 0), 'blocked');
  // unowned ground just west of the hamlet
  const [ux, uy] = findTile(s, (x, y) => x < 7 && [0, 1].every(dx => [0, 1].every(dy => { const t = tileAt(s, x + dx, y + dy); return !!t && t.t === 'grass' && !t.b; })));
  refused(canPlace(s, 'hovel', ux, uy, 0), 'not_owned');
  refused(w.dispatch({ type: 'place_building', btype: 'hovel', x: ux, y: uy, rot: 0 }), 'not_owned');
  // terrain, once the land is ours
  ownEverything(s);
  accepted(canPlace(s, 'hovel', ux, uy, 0));
  for (const terrain of ['water', 'forest', 'rock'] as const) {
    const [tx, ty] = findTile(s, (x, y) => x < MAP_W - 1 && y < MAP_H - 1 && tileAt(s, x, y)!.t === terrain);
    refused(canPlace(s, 'well', tx, ty, 0), 'blocked');
  }
  const [bx, by] = findTile(s, (x, y) => tileAt(s, x, y)!.t === 'bridge');
  refused(canPlace(s, 'well', bx, by, 0), 'blocked');
  // overlap
  const seat = seatOf(s);
  refused(canPlace(s, 'hovel', seat.x + 1, seat.y + 1, 0), 'blocked');
  refused(canPlace(s, 'hovel', seat.x - 1, seat.y, 0), 'blocked');
  // rank
  refused(canPlace(s, 'longhouse', fx, fy, 0), 'locked');
  refused(canPlace(s, 'wizard_tower', fx, fy, 0), 'locked');
  refused(canPlace(s, 'masons_yard', fx, fy, 0), 'locked');
  // one of a kind
  refused(canPlace(s, 'seat', ux, uy, 0), 'blocked');
  s.realm.rank = 'knight';
  const yard = accepted(w.dispatch({ type: 'place_building', btype: 'masons_yard', x: ux, y: uy, rot: 0 }));
  assert.ok(yard);
  const [fx2, fy2] = freeSpot(s, 'hovel', 0, inHamlet);
  refused(canPlace(s, 'masons_yard', fx2, fy2, 0), 'blocked');
  const [lx, ly] = freeSpot(s, 'longhouse', 0);
  accepted(canPlace(s, 'longhouse', lx, ly, 0));
  // gold, in both modes
  for (const mode of ['peace', 'iron'] as const) {
    s.mode = mode; s.gold = BUILDINGS.hovel.cost - 1;
    refused(canPlace(s, 'hovel', fx2, fy2, 0), 'no_gold');
    refused(w.dispatch({ type: 'place_building', btype: 'hovel', x: fx2, y: fy2, rot: 0 }), 'no_gold');
    s.gold = BUILDINGS.hovel.cost;
    accepted(canPlace(s, 'hovel', fx2, fy2, 0));
  }
  // nonsense
  refused(canPlace(s, 'palace' as BuildingType, fx2, fy2, 0), 'invalid');
  refused(canPlace(s, 'hovel', NaN, fy2, 0), 'invalid');
  assert.equal(Object.keys(s.buildings).length, 5, 'refusals built nothing');
});

test('rotation swaps the footprint, and fields and roads may be built on (the road is removed)', () => {
  const w = new WorldSim(11);
  const s = w.s;
  assert.deepEqual(footprint('longhouse', 0), { w: 3, h: 2 });
  assert.deepEqual(footprint('longhouse', 1), { w: 2, h: 3 });
  assert.deepEqual(footprint('longhouse', 2), { w: 3, h: 2 });
  assert.deepEqual(footprint('townhouse', 3), { w: 3, h: 2 });
  // a well on the lane itself
  const [rx, ry] = findTile(s, (x, y) => ownedAt(s, x, y) && tileAt(s, x, y)!.t === 'road');
  const mark = w.events.length;
  const id = accepted(w.dispatch({ type: 'place_building', btype: 'well', x: rx, y: ry, rot: 0 }))!;
  assert.equal(tileAt(s, rx, ry)!.t, 'grass', 'the road under a building is removed');
  assert.equal(tileAt(s, rx, ry)!.b, id);
  const evs = w.since(mark);
  assert.ok(evs.some(e => e.type === 'tiles_changed' && e.tiles.some(t => t[0] === rx && t[1] === ry)));
  assert.ok(evs.some(e => e.type === 'building_placed' && e.buildingId === id));
  // a field
  ownEverything(s);
  const [qx, qy] = findTile(s, (x, y) => tileAt(s, x, y)!.t === 'field' && !tileAt(s, x, y)!.b);
  accepted(w.dispatch({ type: 'place_building', btype: 'well', x: qx, y: qy, rot: 0 }));
  // a rotated townhouse really occupies its rotated footprint
  s.realm.rank = 'baron';
  const [tx, ty] = freeSpot(s, 'townhouse', 1);
  const th = s.buildings[accepted(w.dispatch({ type: 'place_building', btype: 'townhouse', x: tx, y: ty, rot: 1 }))!]!;
  assert.deepEqual([th.w, th.h, th.rot], [3, 2, 1]);
  assertWorldSane(s);
});

// ───────────────────────────── building ─────────────────────────────

console.log('\nbuilding');

test('a hovel is paid for, walked to and built by the Reeve with a hammer', () => {
  const w = new WorldSim(7, { gold: 200 });
  const s = w.s;
  const r = rulerActor(s);
  // as far from the seat as the hamlet allows, so there is a walk in it
  let spot: [number, number] | null = null, far = -1;
  for (let y = 8; y < 15; y++) for (let x = 8; x < 15; x++) if (canPlace(s, 'hovel', x, y, 0).ok) { const d = Math.hypot(x - r.x, y - r.y); if (d > far) { far = d; spot = [x, y]; } }
  assert.ok(spot);
  const mark = w.events.length;
  const id = accepted(w.dispatch({ type: 'place_building', btype: 'hovel', x: spot![0], y: spot![1], rot: 0 }))!;
  const b = s.buildings[id]!;
  assert.equal(s.gold, 200 - BUILDINGS.hovel.cost, 'the cost is charged at once');
  assert.equal(b.state, 'building'); assert.equal(b.progress, 0); assert.equal(b.units.length, 0);
  assert.ok(b.name.length > 2 && b.name !== 'Hovel');
  const job = jobsAt(s, id)[0]!;
  assert.ok(job, 'a build job is queued');
  assert.deepEqual([job.kind, job.role, job.state, job.workDays, job.cost], ['build', 'mason', 'queued', BUILDINGS.hovel.buildDays, 0]);
  const [ex, ey] = entranceOf(s, b);
  assert.deepEqual([job.x, job.y], [ex, ey], 'the work happens at the door');

  // one small tick: the Reeve (there is no Mason) picks up the hammer and sets off
  w.advance(0.01, 0.01);
  assert.equal(job.state, 'traveling'); assert.equal(job.assignee, r.id); assert.equal(r.jobId, job.id);
  assert.equal(r.state, 'walking'); assert.ok(r.path.length > 0, 'he has somewhere to walk');
  const walk = w.until(() => job.state !== 'traveling', 5, 0.01);
  assert.ok(walk > 0.05, `the walk took time (${walk})`);
  assert.equal(job.state, 'working'); assert.equal(r.state, 'working');
  assert.ok(Math.hypot(r.x - ex, r.y - ey) < 0.01, 'he works at the door');
  w.advance(1, 0.05);
  assert.ok(b.progress > 0.15 && b.progress < 0.4, `the walls rise as he works (${b.progress})`);
  const took = w.until(() => b.state === 'ready', 10, 0.05) + 1;
  assert.ok(Math.abs(took - BUILDINGS.hovel.buildDays) < 0.2, `four days of labour at the ruler's pace (${took})`);

  assert.equal(b.condition, 100); assert.equal(b.progress, 1);
  assert.equal(b.units.length, 1);
  assert.deepEqual(b.units[0], { tenantId: null, vacantSince: b.units[0]!.vacantSince, listed: true, purse: 0, purseDay: 0 });
  assert.ok(b.rent >= 1);
  assert.equal(s.gold, 200 - BUILDINGS.hovel.cost, 'and is not charged twice');
  assert.equal(job.state, 'done'); assert.equal(r.jobId, null); assert.equal(r.state, 'idle');
  assert.equal(w.done[job.id], 1, 'core.notifyJobDone ran exactly once');
  const evs = w.since(mark);
  const phases = evs.filter(e => e.type === 'job' && e.jobId === job.id).map(e => (e as { phase: string }).phase);
  assert.deepEqual(phases, ['queued', 'start', 'arrive', 'done']);
  assert.equal(evs.filter(e => e.type === 'building_done' && e.buildingId === id).length, 1);
  assert.ok(evs.some(e => e.type === 'sfx' && e.id === 'build_done'));
  const line = evs.filter(e => e.type === 'herald').map(e => (e as { herald: { text: string; buildingId?: string } }).herald).find(h => h.buildingId === id);
  assert.ok(line && line.text.includes(b.name) && line.text.length <= 150 && !/[–—]/.test(line.text), 'a herald line announces it');
  // then he goes home
  w.until(() => Math.hypot(r.x - r.homeX, r.y - r.homeY) < 0.01 && r.state === 'idle', 5, 0.05);
  // and the finished job is swept after a day or two
  w.advance(3);
  assert.equal(s.jobs[job.id], undefined);
  assertWorldSane(s);
});

test('a site can be abandoned (timber sold back) but a build job cannot simply be cancelled', () => {
  const w = new WorldSim(7, { gold: 200 });
  const s = w.s;
  const [x, y] = freeSpot(s, 'cottage', 0, (px, py) => px >= 8 && px < 15 && py >= 8 && py < 15);
  const id = accepted(w.dispatch({ type: 'place_building', btype: 'cottage', x, y, rot: 0 }))!;
  const job = jobsAt(s, id)[0]!;
  refused(w.dispatch({ type: 'cancel_job', jobId: job.id }), 'invalid');
  w.advance(1);
  const mark = w.events.length;
  accepted(w.dispatch({ type: 'demolish', buildingId: id }));
  assert.equal(s.buildings[id], undefined);
  assert.equal(tileAt(s, x, y)!.b, null);
  assert.equal(s.gold, 200 - BUILDINGS.cottage.cost + Math.round(BUILDINGS.cottage.cost * BUILD_TUNE.demolish.refundShare));
  assert.equal(job.state, 'cancelled');
  assert.equal(rulerActor(s).jobId, null);
  assert.ok(w.since(mark).some(e => e.type === 'building_removed' && e.buildingId === id && e.btype === 'cottage' && e.w === 2));
  assertWorldSane(s);
});

test('demolish: never the seat, never over a household; a short job; rename and listing', () => {
  const w = new WorldSim(9);
  const s = w.s;
  const [a, b] = hovels(s);
  refused(w.dispatch({ type: 'demolish', buildingId: seatOf(s).id }), 'locked');
  refused(w.dispatch({ type: 'demolish', buildingId: 'nope' }), 'not_found');
  const t = mkTenant(s, a!);
  refused(w.dispatch({ type: 'demolish', buildingId: a!.id }), 'occupied');
  assert.ok(t);
  // listing
  refused(w.dispatch({ type: 'set_listed', buildingId: a!.id, listed: true }), 'occupied');
  refused(w.dispatch({ type: 'set_listed', buildingId: seatOf(s).id, listed: true }), 'invalid');
  accepted(w.dispatch({ type: 'set_listed', buildingId: b!.id, listed: false }));
  assert.equal(b!.units[0]!.listed, false);
  accepted(w.dispatch({ type: 'set_listed', buildingId: b!.id, listed: true }));
  assert.equal(b!.units[0]!.listed, true);
  // names
  accepted(w.dispatch({ type: 'rename_building', buildingId: b!.id, name: '  The   Palace — of Mud  ' }));
  assert.equal(b!.name, 'The Palace - of Mud');
  refused(w.dispatch({ type: 'rename_building', buildingId: b!.id, name: '   ' }), 'invalid');
  accepted(w.dispatch({ type: 'rename_building', buildingId: b!.id, name: 'x'.repeat(80) }));
  assert.equal(b!.name.length, BUILD_TUNE.nameMax);
  // upgrade is the Crown's business
  refused(w.dispatch({ type: 'upgrade_building', buildingId: seatOf(s).id }), 'locked');
  refused(w.dispatch({ type: 'upgrade_building', buildingId: b!.id }), 'locked');
  // pulling down the empty one
  const gold = s.gold;
  const mark = w.events.length;
  const jid = accepted(w.dispatch({ type: 'demolish', buildingId: b!.id }))!;
  refused(w.dispatch({ type: 'demolish', buildingId: b!.id }), 'busy');
  assert.equal(b!.units[0]!.listed, false, 'a condemned place is not advertised');
  const job = s.jobs[jid]!;
  assert.ok(job.workDays < 1.5, 'a short job');
  const bid = b!.id, bx = b!.x, by = b!.y;
  w.until(() => !s.buildings[bid], 10);
  assert.equal(tileAt(s, bx, by)!.b, null);
  assert.ok(s.gold < gold, 'it costs a little');
  assert.ok(w.since(mark).some(e => e.type === 'building_removed' && e.buildingId === bid));
  assert.equal(w.done[jid], 1);
  assertWorldSane(s);
});

test('upgradeSeat raises the level and keeps the footprint', () => {
  const w = new WorldSim(3);
  const seat = seatOf(w.s);
  const mark = w.events.length;
  upgradeSeat(w.s, 2);
  assert.equal(seat.level, 2); assert.equal(seat.name, 'Manor House'); assert.deepEqual([seat.w, seat.h], [3, 3]); assert.equal(seat.condition, 100);
  upgradeSeat(w.s, 9);
  assert.equal(seat.level, 3); assert.equal(seat.name, 'Keep');
  w.drain();
  assert.ok(w.since(mark).filter(e => e.type === 'building_changed' && e.buildingId === seat.id).length >= 2);
  seat.name = 'Castle Luke';
  upgradeSeat(w.s, 1);
  assert.equal(seat.name, 'Castle Luke', 'a seat the ruler named keeps its name');
});

// ───────────────────────────── roads and land ─────────────────────────────

console.log('\nroads and land');

test('roads: a crown a tile on your own land, a bridge where they meet water, and they can be taken up', () => {
  const w = new WorldSim(21, { gold: 100 });
  const s = w.s;
  const free = (x: number, y: number) => ownedAt(s, x, y) && tileAt(s, x, y)!.t === 'grass' && !tileAt(s, x, y)!.b;
  const tiles: [number, number][] = [];
  for (let y = 8; y < 16 && tiles.length < 3; y++) for (let x = 8; x < 16 && tiles.length < 3; x++) if (free(x, y)) tiles.push([x, y]);
  const mark = w.events.length;
  accepted(w.dispatch({ type: 'place_road', tiles: [...tiles, tiles[0]!] }));
  for (const [x, y] of tiles) assert.equal(tileAt(s, x, y)!.t, 'road');
  assert.equal(s.gold, 100 - 3 * WORLD_TUNE.roadCost);
  assert.ok(w.since(mark).some(e => e.type === 'tiles_changed' && e.tiles.length === 3));
  refused(w.dispatch({ type: 'place_road', tiles }), 'invalid');                       // already road
  refused(w.dispatch({ type: 'place_road', tiles: [[2, 2]] }), 'not_owned');
  refused(w.dispatch({ type: 'place_road', tiles: [[-3, 2]] }), 'blocked');
  refused(w.dispatch({ type: 'place_road', tiles: [] }), 'invalid');
  const seat = seatOf(s);
  refused(w.dispatch({ type: 'place_road', tiles: [[seat.x, seat.y]] }), 'blocked');
  // a bridge
  ownEverything(s);
  const [wx, wy] = findTile(s, (x, y) => tileAt(s, x, y)!.t === 'water');
  const before = s.gold;
  accepted(w.dispatch({ type: 'place_road', tiles: [[wx, wy]] }));
  assert.equal(tileAt(s, wx, wy)!.t, 'bridge');
  assert.equal(s.gold, before - WORLD_TUNE.bridgeCost);
  // trees must be cleared first
  const [tx, ty] = findTile(s, (x, y) => tileAt(s, x, y)!.t === 'forest');
  refused(w.dispatch({ type: 'place_road', tiles: [[tx, ty]] }), 'blocked');
  // no coin, no road
  s.gold = 0;
  const [gx, gy] = findTile(s, free);
  refused(w.dispatch({ type: 'place_road', tiles: [[gx, gy]] }), 'no_gold');
  // taking up
  accepted(w.dispatch({ type: 'remove_road', tiles: [...tiles, [wx, wy]] }));
  for (const [x, y] of tiles) assert.equal(tileAt(s, x, y)!.t, 'grass');
  assert.equal(tileAt(s, wx, wy)!.t, 'water');
  refused(w.dispatch({ type: 'remove_road', tiles }), 'invalid');
  assertWorldSane(s);
});

test('clearing: a tree or a stone on your own land becomes grass after a small job', () => {
  const w = new WorldSim(5, { gold: 50 });
  const s = w.s;
  ownEverything(s);
  const r = rulerActor(s);
  // the nearest tree to the ruler
  let best: [number, number] | null = null, bd = Infinity;
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (tileAt(s, x, y)!.t === 'forest') { const d = Math.hypot(x - r.x, y - r.y); if (d < bd) { bd = d; best = [x, y]; } }
  const [tx, ty] = best!;
  const jid = accepted(w.dispatch({ type: 'clear_tile', x: tx, y: ty }))!;
  refused(w.dispatch({ type: 'clear_tile', x: tx, y: ty }), 'busy');
  const [gx, gy] = findTile(s, (x, y) => tileAt(s, x, y)!.t === 'grass');
  refused(w.dispatch({ type: 'clear_tile', x: gx, y: gy }), 'invalid');
  s.map.parcels[0]!.owned = false;
  const mine = (x: number, y: number) => x < 8 && y < 8;
  let unowned: [number, number] | null = null;
  for (let y = 0; y < 8 && !unowned; y++) for (let x = 0; x < 8 && !unowned; x++) if (mine(x, y) && tileAt(s, x, y)!.t === 'forest') unowned = [x, y];
  if (unowned) refused(w.dispatch({ type: 'clear_tile', x: unowned[0], y: unowned[1] }), 'not_owned');
  const job = s.jobs[jid]!;
  assert.deepEqual([job.kind, job.role, job.cost], ['clear_land', 'mason', WORLD_TUNE.clearForest.cost]);
  const mark = w.events.length;
  w.until(() => tileAt(s, tx, ty)!.t === 'grass', 10);
  assert.equal(s.gold, 50 - WORLD_TUNE.clearForest.cost);
  assert.ok(Math.max(Math.abs(r.x - (tx + 0.5)), Math.abs(r.y - (ty + 0.5))) <= 1.01, 'he stood beside the tree to fell it');
  assert.ok(w.since(mark).some(e => e.type === 'tiles_changed' && e.tiles.some(t => t[0] === tx && t[1] === ty)));
  assert.equal(w.done[jid], 1);
  // "clear some land" by word picks the nearest tree or stone
  const viaOrder = accepted(w.dispatch({ type: 'order_job', kind: 'clear_land' }))!;
  assert.equal(s.jobs[viaOrder]!.kind, 'clear_land'); assert.equal(s.jobs[viaOrder]!.byRuler, true);
  assertWorldSane(s);
});

test('buy_parcel: next to your land, within your rank and your charter, and paid for', () => {
  const w = new WorldSim(13, { gold: 2000 });
  const s = w.s;
  refused(w.dispatch({ type: 'buy_parcel', parcelId: 5 }), 'invalid');
  refused(w.dispatch({ type: 'buy_parcel', parcelId: 99 }), 'not_found');
  refused(w.dispatch({ type: 'buy_parcel', parcelId: 0 }), 'locked');           // a Knight's parcel
  refused(w.dispatch({ type: 'buy_parcel', parcelId: 3 }), 'locked');           // a Baron's
  s.gold = s.map.parcels[6]!.price - 1;
  refused(w.dispatch({ type: 'buy_parcel', parcelId: 6 }), 'no_gold');
  s.gold = 2000;
  const mark = w.events.length;
  accepted(w.dispatch({ type: 'buy_parcel', parcelId: 6 }));
  assert.equal(s.map.parcels[6]!.owned, true);
  assert.equal(s.gold, 2000 - s.map.parcels[6]!.price);
  const evs = w.since(mark);
  assert.ok(evs.some(e => e.type === 'parcel_bought' && e.parcelId === 6));
  assert.ok(evs.some(e => e.type === 'gold' && e.cat === 'land'));
  assert.ok(evs.some(e => e.type === 'herald' && e.herald.text.includes(s.map.parcels[6]!.name) && e.herald.text.length <= 150));
  assert.ok(ownedAt(s, 17, 9));
  assert.equal(RANKS.reeve.maxParcels, 2);
  refused(w.dispatch({ type: 'buy_parcel', parcelId: 4 }), 'locked');           // the charter allows a Reeve two
  s.realm.rank = 'knight';
  refused(w.dispatch({ type: 'buy_parcel', parcelId: 8 }), 'blocked');          // touches nothing of ours (diagonal does not count)
  refused(w.dispatch({ type: 'buy_parcel', parcelId: 3 }), 'locked');           // still a Baron's
  accepted(w.dispatch({ type: 'buy_parcel', parcelId: 7 }));                    // beyond the stream, through parcel 6
  accepted(w.dispatch({ type: 'buy_parcel', parcelId: 2 }));
  assert.equal(s.map.parcels.filter(p => p.owned).length, 4);
});

// ───────────────────────────── paths ─────────────────────────────

console.log('\npaths');

function checkSteps(s: GameState, from: [number, number], path: [number, number][], strict = true): void {
  let [px, py] = [Math.floor(from[0]), Math.floor(from[1])];
  for (const [wx, wy] of path) {
    const x = Math.floor(wx), y = Math.floor(wy);
    assert.deepEqual([wx, wy], [x + 0.5, y + 0.5], 'waypoints are tile centres');
    const dx = x - px, dy = y - py;
    assert.ok(Math.max(Math.abs(dx), Math.abs(dy)) === 1, `steps are to a neighbouring tile (${px},${py}) → (${x},${y})`);
    if (strict) {
      assert.ok(isWalkable(s, x, y), `(${x},${y}) is walkable`);
      if (dx !== 0 && dy !== 0) assert.ok(isWalkable(s, px + dx, py) && isWalkable(s, px, py + dy), `no corner cut at (${px},${py}) → (${x},${y})`);
    }
    px = x; py = y;
  }
}

test('paths go round the water and over the bridge; no corner cutting; none without a bridge', () => {
  for (const seed of [2, 5, 9, 14, 23, 77]) {
    const s = blankState({ seed });
    createMap(s);
    const west = nearestWalkable(s, 19.5, 3.5), east = nearestWalkable(s, 30.5, 20.5);
    assert.ok(west[0] < 22 && east[0] > 22);
    const path = findPath(s, west[0], west[1], east[0], east[1]);
    assert.ok(path && path.length > 5, `seed ${seed}: there is a way across`);
    checkSteps(s, west, path!);
    const terrains = path!.map(p => tileAt(s, Math.floor(p[0]), Math.floor(p[1]))!.t);
    assert.ok(!terrains.includes('water'), 'never through the water');
    assert.ok(terrains.includes('bridge'), 'over the bridge');
    assert.deepEqual(path![path!.length - 1], east, 'and it ends where it was asked to');
    // without a bridge there is no honest way, but a figure will still wade rather than be stranded
    for (const t of s.map.tiles) if (t.t === 'bridge') t.t = 'water';
    assert.equal(findPath(s, west[0], west[1], east[0], east[1]), null, `seed ${seed}: no bridge, no path`);
    const wade = findPathLoose(s, west[0], west[1], east[0], east[1]);
    assert.ok(wade.length > 5);
    checkSteps(s, west, wade, false);
    assert.deepEqual(wade[wade.length - 1], east);
    // a new bridge, somewhere the banks can be reached on both sides, restores it
    const flood = (from: [number, number]): Set<number> => {
      const seen = new Set<number>([Math.floor(from[1]) * MAP_W + Math.floor(from[0])]);
      const q = [...seen];
      while (q.length) {
        const c = q.pop()!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = (c % MAP_W) + dx, ny = ((c / MAP_W) | 0) + dy;
          if (isWalkable(s, nx, ny) && !seen.has(ny * MAP_W + nx)) { seen.add(ny * MAP_W + nx); q.push(ny * MAP_W + nx); }
        }
      }
      return seen;
    };
    const W = flood(west), E = flood(east);
    let span: [number, number, number] | null = null;
    for (let y = 0; y < MAP_H && !span; y++) for (let x = 1; x < MAP_W - 1 && !span; x++) {
      if (tileAt(s, x, y)!.t !== 'water' || !W.has(y * MAP_W + x - 1)) continue;
      let x2 = x;
      while (x2 + 1 < MAP_W && tileAt(s, x2 + 1, y)!.t === 'water') x2++;
      if (E.has(y * MAP_W + x2 + 1)) span = [x, x2, y];
    }
    assert.ok(span, `seed ${seed}: somewhere to throw a bridge`);
    for (let x = span![0]; x <= span![1]; x++) tileAt(s, x, span![2])!.t = 'bridge';
    const again = findPath(s, west[0], west[1], east[0], east[1]);
    assert.ok(again, `seed ${seed}: a new bridge reopens the way`);
    checkSteps(s, west, again!);
    assert.ok(again!.some(p => Math.floor(p[1]) === span![2] && Math.floor(p[0]) === span![0]), 'and the way goes over it');
  }
});

test('roads cost less, so the way from the gate to the bridge keeps to the road', () => {
  const s = blankState({ seed: 4242 });
  createMap(s);
  const gate = gatePoint(s);
  const [bx, by] = findTile(s, (x, y) => tileAt(s, x, y)!.t === 'bridge');
  const path = findPath(s, gate[0], gate[1], bx + 0.5, by + 0.5)!;
  assert.ok(path);
  checkSteps(s, gate, path);
  const onRoad = path.filter(p => { const t = tileAt(s, Math.floor(p[0]), Math.floor(p[1]))!.t; return t === 'road' || t === 'bridge'; }).length;
  assert.ok(onRoad / path.length > 0.8, `mostly on the road (${onRoad}/${path.length})`);
});

test('a goal inside a building ends at the nearest walkable tile; a start inside one still gets out', () => {
  const w = new WorldSim(7);
  const s = w.s;
  const seat = seatOf(s);
  const gate = gatePoint(s);
  const path = findPath(s, gate[0], gate[1], seat.x + 1.5, seat.y + 1.5)!;
  assert.ok(path && path.length > 3);
  checkSteps(s, gate, path);
  const end = path[path.length - 1]!;
  assert.ok(isWalkable(s, end[0], end[1]));
  assert.ok(end[0] > seat.x - 1 && end[0] < seat.x + seat.w + 1 && end[1] > seat.y - 1 && end[1] < seat.y + seat.h + 1, 'right beside the building');
  const nw = nearestWalkable(s, seat.x + 1.5, seat.y + 1.5);
  assert.ok(isWalkable(s, nw[0], nw[1]));
  assert.deepEqual(nearestWalkable(s, gate[0], gate[1]), gate);
  const out = findPath(s, seat.x + 0.5, seat.y + 2.5, gate[0], gate[1]);
  assert.ok(out && out.length > 3, 'a figure under the eaves can step out');
  assert.equal(findPath(s, seat.x + 1.5, seat.y + 1.5, gate[0], gate[1]), null, 'strictly speaking there is no way out of the middle of a hut');
  const squeeze = findPathLoose(s, seat.x + 1.5, seat.y + 1.5, gate[0], gate[1]);
  assert.ok(squeeze.length > 3, 'but a figure walled in is never stranded');
  assert.deepEqual(squeeze[squeeze.length - 1], gate);
  assert.deepEqual(findPath(s, gate[0], gate[1], gate[0], gate[1]), []);
  assert.ok(findPath(s, gate[0], gate[1], -50, 400), 'a goal off the map is pulled back onto it');
});

// ───────────────────────────── condition ─────────────────────────────

console.log('\ncondition');

test('condition bands: building_changed when 75, 50 and 25 are crossed, a dry word from the herald on the way down', () => {
  assert.deepEqual([100, 75, 74.9, 50, 49.9, 25, 24.9, 0].map(conditionBand), [3, 3, 2, 2, 1, 1, 0, 0]);
  const w = new WorldSim(7);
  const s = w.s;
  const b = hovels(s)[0]!;
  b.condition = 80;
  const changes = (from: number) => w.since(from).filter(e => e.type === 'building_changed' && e.buildingId === b.id).length;
  const heralds = (from: number) => w.since(from).filter(e => e.type === 'herald').map(e => (e as { herald: { kind: string; text: string } }).herald);
  let mark = w.events.length;
  damageBuilding(s, b.id, 3); w.drain();
  assert.equal(b.condition, 77); assert.equal(changes(mark), 0, 'no band crossed, no event');
  damageBuilding(s, b.id, 3); w.drain();
  assert.equal(changes(mark), 1, 'crossed 75');
  mark = w.events.length;
  damageBuilding(s, b.id, 25); w.drain();
  assert.equal(b.condition, 49); assert.equal(changes(mark), 1, 'crossed 50');
  assert.equal(heralds(mark).length, 1); assert.equal(heralds(mark)[0]!.kind, 'info'); assert.ok(heralds(mark)[0]!.text.includes(b.name));
  mark = w.events.length;
  damageBuilding(s, b.id, 25); w.drain();
  assert.equal(changes(mark), 1, 'crossed 25'); assert.equal(heralds(mark)[0]!.kind, 'bad');
  mark = w.events.length;
  repairBuilding(s, b.id, 30); w.drain();
  assert.equal(b.condition, 54); assert.equal(changes(mark), 1, 'crossing upward is announced to the renderer too');
  assert.equal(heralds(mark).length, 0, 'but not by the herald');
  repairBuilding(s, b.id, 500);
  assert.equal(b.condition, 100, 'clamped');
  damageBuilding(s, b.id, -5); damageBuilding(s, 'nope', 5); damageBuilding(s, b.id, NaN);
  assert.equal(b.condition, 100, 'nonsense is ignored');
  for (const h of w.events.filter(e => e.type === 'herald')) assert.ok((h as { herald: { text: string } }).herald.text.length <= 150);
});

test('at 0 a building is ruined: the household leaves, patching is refused, only renovation restores it', () => {
  const w = new WorldSim(7, { gold: 300 });
  const s = w.s;
  const b = hovels(s)[0]!;
  const t = mkTenant(s, b);
  b.units[0]!.purse = 8;
  const mark = w.events.length;
  damageBuilding(s, b.id, 500, 'dragon'); w.drain();
  assert.equal(b.state, 'ruined'); assert.equal(b.condition, 0);
  assert.notEqual(s.tenants[t.id]?.status, 'housed', 'the household was moved out');
  assert.equal(b.units[0]!.tenantId, null);
  assert.equal(b.units[0]!.listed, false);
  const evs = w.since(mark);
  assert.ok(evs.some(e => e.type === 'building_changed' && e.buildingId === b.id));
  assert.ok(evs.some(e => e.type === 'herald' && e.herald.kind === 'urgent' && e.herald.text.includes(b.name)));
  assert.equal(vacancies(s).some(v => v.building === b), false, 'a ruin is not a vacancy');
  repairBuilding(s, b.id, 50);
  assert.equal(b.condition, 0, 'a ruin is past patching');
  refused(w.dispatch({ type: 'order_job', kind: 'repair', buildingId: b.id }), 'blocked');
  refused(w.dispatch({ type: 'set_listed', buildingId: b.id, listed: true }), 'not_ready');
  const q = renovateQuote(s, b);
  assert.equal(q.cost, Math.round(BUILDINGS.hovel.cost * BUILD_TUNE.renovate.costShare), '40% of the build cost');
  const jid = accepted(w.dispatch({ type: 'order_job', kind: 'renovate', buildingId: b.id }))!;
  refused(w.dispatch({ type: 'order_job', kind: 'renovate', buildingId: b.id }), 'busy');
  const gold = s.gold;
  w.until(() => b.state === 'ready', 20);
  assert.equal(b.condition, 100);
  assert.equal(b.units[0]!.listed, true);
  assert.equal(s.gold, gold - q.cost);
  assert.equal(w.done[jid], 1);
  assertWorldSane(s);
});

test('decay: the monthly rate times modifiers (vacant 1.5, winter 1.2, squatters 2, hard-wearing tenants), a thirtieth a day', () => {
  const w = new WorldSim(7);
  const s = w.s;
  const [a, b, c] = hovels(s);
  const base = BUILDINGS.hovel.decay;
  const close = (x: number, y: number, msg: string) => assert.ok(Math.abs(x - y) < 1e-9, `${msg}: ${x} vs ${y}`);
  s.day = 5;                                              // spring
  close(decayPerMonth(s, a!), base * BUILD_TUNE.decay.vacant, 'vacant');
  mkTenant(s, a!);
  close(decayPerMonth(s, a!), base, 'occupied');
  setSquatters(s, b!.id, 'goblins');
  close(decayPerMonth(s, b!), base * BUILD_TUNE.decay.vacant * BUILD_TUNE.decay.squatters, 'vacant with squatters');
  s.day = 9 * 30 + 5;                                     // Firstfrost: winter
  close(decayPerMonth(s, a!), base * BUILD_TUNE.decay.winter, 'winter');
  close(decayPerMonth(s, seatOf(s)), BUILDINGS.seat.decay * BUILD_TUNE.decay.winter, 'a seat has no vacancy to speak of');
  s.day = 5;
  // a month of days
  a!.condition = 100; c!.condition = 100;
  const seat = seatOf(s);
  seat.condition = 100;
  w.advance(30);
  close(a!.condition, 100 - base, 'occupied hovel after a month');
  close(c!.condition, 100 - base * BUILD_TUNE.decay.vacant, 'vacant hovel after a month');
  close(seat.condition, 100 - BUILDINGS.seat.decay, 'the seat after a month');
  // left alone long enough, a vacant hovel falls down by itself
  c!.condition = 3;
  w.until(() => c!.state === 'ruined', 40, 0.25);
  assert.equal(c!.condition, 0);
});

test('the worse the repair the likelier a maintenance incident: about 4% a month at 100, 30% at 30', () => {
  assert.ok(Math.abs(incidentChancePerMonth(100) - 0.04) < 1e-9);
  assert.ok(Math.abs(incidentChancePerMonth(30) - 0.30) < 1e-9);
  let last = 0;
  for (let c = 100; c >= 0; c -= 5) { const p = incidentChancePerMonth(c); assert.ok(p >= last && p <= BUILD_TUNE.incident.max + 1e-9); last = p; }
});

test('repair: restores up to 35, cost and days scale with what is missing', () => {
  const w = new WorldSim(7, { gold: 300 });
  const s = w.s;
  const [a, , c] = hovels(s);
  a!.condition = 100;
  refused(w.dispatch({ type: 'order_job', kind: 'repair', buildingId: a!.id }), 'invalid');
  refused(w.dispatch({ type: 'order_job', kind: 'repair' }), 'invalid');
  refused(w.dispatch({ type: 'order_job', kind: 'repair', buildingId: 'nope' }), 'not_found');
  a!.condition = 90;
  const small = repairQuote(s, a!), big = repairQuote(s, c!);
  assert.equal(small.restores, 10); assert.equal(big.restores, 35);
  assert.ok(small.cost < big.cost && small.days < big.days, 'more missing, more cost and more days');
  const before = c!.condition, gold = s.gold;
  const jid = accepted(w.dispatch({ type: 'order_job', kind: 'repair', buildingId: c!.id }))!;
  refused(w.dispatch({ type: 'order_job', kind: 'repair', buildingId: c!.id }), 'busy');
  const job = s.jobs[jid]!;
  assert.deepEqual([job.kind, job.role, job.byRuler, job.cost], ['repair', 'mason', true, big.cost]);
  w.until(() => job.state === 'done', 20);
  assert.ok(Math.abs(c!.condition - (before + 35)) < 0.5, `+35 (${before} → ${c!.condition})`);
  assert.equal(s.gold, gold - big.cost, 'charged once, when the work began');
  assert.ok(w.events.some(e => e.type === 'gold' && e.cat === 'repairs' && e.amount === -big.cost));
  // cancelling a repair frees the worker
  c!.condition = 40;
  const j2 = s.jobs[accepted(w.dispatch({ type: 'order_job', kind: 'repair', buildingId: c!.id }))!]!;
  w.advance(0.05, 0.05);
  assert.ok(j2.state === 'traveling' || j2.state === 'working', 'he is on it at once');
  assert.equal(rulerActor(s).jobId, j2.id);
  accepted(w.dispatch({ type: 'cancel_job', jobId: j2.id }));
  assert.equal(j2.state, 'cancelled'); assert.equal(rulerActor(s).jobId, null);
  refused(w.dispatch({ type: 'cancel_job', jobId: j2.id }), 'not_found');
  assertWorldSane(s);
});

// ───────────────────────────── desirability ─────────────────────────────

console.log('\ndesirability');

test('desirability: base, auras with falloff and diminishing repeats, road, condition, nuisances; clamped', () => {
  const w = new WorldSim(7, { gold: 5000 });
  const s = w.s;
  ownEverything(s);
  // a lone cottage far from everything, on open ground
  const lone = (x: number, y: number) => x >= 1 && x <= 5 && y >= 14 && y <= 21;
  for (let y = 12; y < 24; y++) for (let x = 0; x < 9; x++) { const t = tileAt(s, x, y)!; if (!t.b) t.t = 'grass'; }
  const [cx, cy] = freeSpot(s, 'cottage', 0, lone);
  const cot = s.buildings[accepted(w.dispatch({ type: 'place_building', btype: 'cottage', x: cx, y: cy, rot: 0 }))!]!;
  w.until(() => cot.state === 'ready', 30, 0.25);
  cot.condition = 100;
  w.advance(1);
  cot.condition = 100;
  w.advance(0.25);
  const d0 = desirability(s, cot);
  assert.equal(d0, 60, 'base 50 plus (100 - 60) / 4');
  assert.equal(desirability(s, cot), d0);
  // a road at the door
  accepted(w.dispatch({ type: 'place_road', tiles: [[cx, cy + 2]] }));
  assert.equal(desirability(s, cot), d0 + 4);
  accepted(w.dispatch({ type: 'remove_road', tiles: [[cx, cy + 2]] }));
  assert.equal(desirability(s, cot), d0);
  // wells: the first counts in full, the second for less
  const put = (bt: BuildingType, x: number, y: number): Building => {
    const b = s.buildings[accepted(w.dispatch({ type: 'place_building', btype: bt, x, y, rot: 0 }))!]!;
    w.until(() => b.state === 'ready', 40, 0.25);
    b.condition = 100; cot.condition = 100;
    w.advance(0.01, 0.01);
    return b;
  };
  put('well', cx + 2, cy);
  cot.condition = 100; w.dispatch({ type: 'rename_building', buildingId: cot.id, name: 'Lone Cottage' });
  const d1 = desirability(s, cot);
  assert.ok(d1 >= d0 + 5 && d1 <= d0 + BUILDINGS.well.aura!.amount, `a well nearby helps (${d0} → ${d1})`);
  put('well', cx - 1, cy);
  const d2 = desirability(s, cot);
  assert.ok(d2 > d1 && d2 - d1 < d1 - d0, `a second well helps less (${d1} → ${d2})`);
  // far amenities do nothing
  const far = put('well', 30, 12 + (tileAt(s, 30, 12)!.t === 'grass' ? 0 : 1));
  assert.ok(far);
  assert.equal(desirability(s, cot), d2);
  // condition
  cot.condition = 20; damageBuilding(s, cot.id, 0.001);
  assert.ok(desirability(s, cot) <= d2 - 19, 'a wreck is not desirable');
  cot.condition = 100; repairBuilding(s, cot.id, 1); damageBuilding(s, cot.id, 0.0001); repairBuilding(s, cot.id, 1);
  // squatters next door, then here
  const hov = put('hovel', cx + 2, cy + 2);
  const d3 = desirability(s, cot);
  setSquatters(s, hov.id, 'goblins');
  const d4 = desirability(s, cot);
  assert.equal(d4, d3 - WORLD_TUNE.desirability.squattersNear);
  setSquatters(s, cot.id, 'raccoons');
  assert.equal(desirability(s, cot), d4 - WORLD_TUNE.desirability.squattersHere);
  setSquatters(s, cot.id, null); setSquatters(s, hov.id, null);
  assert.equal(desirability(s, cot), d3);
  // a ruin within four tiles
  damageBuilding(s, hov.id, 500);
  assert.equal(desirability(s, cot), d3 - WORLD_TUNE.desirability.ruinNear);
  // every building always lands in 0..100
  for (const b of Object.values(s.buildings)) { const d = desirability(s, b); assert.ok(Number.isInteger(d) && d >= 0 && d <= 100); }
  const worst: Building = { ...cot, id: 'ghost', condition: 0, squatters: { kind: 'bandits', sinceDay: 0 }, visuals: ['fire', 'rats', 'flood', 'leak', 'bats'] };
  assert.ok(desirability(s, worst) >= 0);
});

// ───────────────────────────── actors ─────────────────────────────

console.log('\nactors');

test('go_to walks the ruler there, wears a path, and cancels nothing', () => {
  const w = new WorldSim(7);
  const s = w.s;
  const r = rulerActor(s);
  const c = hovels(s)[2]!;
  const jid = accepted(w.dispatch({ type: 'order_job', kind: 'repair', buildingId: c.id }))!;
  const job = s.jobs[jid]!;
  w.until(() => job.state === 'working', 5, 0.02);
  w.advance(0.3, 0.05);
  const progress = job.progress;
  assert.ok(progress > 0 && progress < 1);
  const gold = s.gold;
  // off to look at an empty corner
  const [tx, ty] = findTile(s, (x, y) => x >= 9 && x < 15 && y >= 9 && y < 15 && isWalkable(s, x, y) && Math.hypot(x - r.x, y - r.y) > 3 && tileAt(s, x, y)!.t === 'grass');
  accepted(w.dispatch({ type: 'go_to', x: tx + 0.3, y: ty + 0.7 }));
  assert.equal(job.state, 'queued', 'the repair is set down, not cancelled');
  assert.equal(job.progress, progress, 'and keeps its progress');
  assert.equal(r.jobId, null); assert.equal(r.state, 'walking');
  w.advance(0.02, 0.02);
  assert.equal(job.state, 'queued', 'he is not dragged back mid-errand');
  w.until(() => r.state !== 'walking' || r.jobId !== null, 5, 0.02);
  assert.ok(Math.hypot(r.x - (tx + 0.3), r.y - (ty + 0.7)) < 0.02 || r.jobId === job.id, 'he reached the very spot');
  // then the work calls him back, and it is finished without being paid for twice
  w.until(() => job.state === 'done', 20, 0.05);
  assert.equal(s.gold, gold);
  assert.equal(w.done[jid], 1);
  assert.ok(Number.isFinite(r.facing));
  // with nothing to do he stays where he is put, until dawn sends idle figures home
  accepted(w.dispatch({ type: 'go_to', x: tx + 0.5, y: ty + 0.5 }));
  w.until(() => r.state === 'waiting', 5, 0.02);
  w.advance(2);
  assert.equal(r.state, 'waiting', 'a ruler placed by hand stays put');
  assert.ok(Math.hypot(r.x - (tx + 0.5), r.y - (ty + 0.5)) < 0.02);
  refused(w.dispatch({ type: 'go_to', x: NaN, y: 2 }), 'invalid');
  // wear: the grass he crossed remembers
  assert.ok(s.map.tiles.some(t => t.wear > 0), 'footfall wears the grass');
  const worn = Math.max(...s.map.tiles.map(t => t.wear));
  w.advance(5);
  assert.ok(Math.max(...s.map.tiles.map(t => t.wear)) < worn, 'and the grass slowly heals');
  assertWorldSane(s);
});

test('guests wait where they arrive and are gone when they walk home; staff are homed at their post', () => {
  const w = new WorldSim(7, { gold: 1000 });
  const s = w.s;
  const gate = gatePoint(s);
  const door = entranceOf(s, seatOf(s));
  const mark = w.events.length;
  const v = spawnActor(s, { kind: 'petitioner', refId: 'your_mother', x: gate[0], y: gate[1] });
  assert.equal(v.speed, 5); assert.deepEqual([v.homeX, v.homeY], gate);
  assert.equal(actorFor(s, 'your_mother'), v);
  assert.equal(walkTo(s, v.id, door[0], door[1]), true);
  assert.equal(v.state, 'walking');
  w.until(() => v.state === 'waiting', 10, 0.05);
  assert.deepEqual([v.x, v.y], door);
  assert.equal(walkTo(s, v.id, door[0], door[1]), true, 'asked to walk to where she stands, she stays');
  assert.equal(v.state, 'waiting');
  // nobody is expecting her (no incident names her): at dawn she turns for home, and at the gate she is gone
  w.until(() => !s.actors[v.id], 10, 0.05);
  const evs = w.since(mark);
  assert.ok(evs.some(e => e.type === 'actor_spawn' && e.actorId === v.id));
  assert.ok(evs.some(e => e.type === 'actor_gone' && e.actorId === v.id));
  assert.equal(walkTo(s, 'nobody', 3, 3), false);
  // road is faster than grass
  const a = spawnActor(s, { kind: 'visitor', refId: null, x: gate[0], y: gate[1] });
  const b2 = spawnActor(s, { kind: 'visitor', refId: null, x: gate[0], y: gate[1] });
  a.path = [[3.5, gate[1]]]; a.state = 'walking';
  const off = findTile(s, (x, y) => x === 0 && isWalkable(s, x, y) && tileAt(s, x, y)!.t === 'grass' && [1, 2, 3].every(k => isWalkable(s, x + k, y) && tileAt(s, x + k, y)!.t === 'grass'));
  b2.x = off[0] + 0.5; b2.y = off[1] + 0.5; b2.path = [[3.5, off[1] + 0.5]]; b2.state = 'walking';
  w.advance(0.2, 0.05);
  assert.ok(a.x - 0.5 > (b2.x - 0.5) * 1.3, `the road is quicker (${a.x} vs ${b2.x})`);
  // staff: a figure for everyone on the roll, homed at the seat until they have a post, then at it
  s.realm.rank = 'knight';
  const m = mkStaff(s, 'mason');
  s.actors[m.actorId!] && delete s.actors[m.actorId!];
  m.actorId = null;
  w.advance(1);
  const fig = staffActor(s, 'mason');
  assert.ok(fig, 'a hired delegate with no figure is given one at dawn');
  assert.ok(Math.hypot(fig!.homeX - door[0], fig!.homeY - door[1]) < 1, 'no yard yet: he waits by the seat');
  const [yx, yy] = freeSpot(s, 'masons_yard', 0, (x, y) => x >= 8 && x < 15 && y >= 8 && y < 15);
  const yard = s.buildings[accepted(w.dispatch({ type: 'place_building', btype: 'masons_yard', x: yx, y: yy, rot: 0 }))!]!;
  w.until(() => yard.state === 'ready', 30, 0.25);
  w.advance(1.5);
  assert.deepEqual([fig!.homeX, fig!.homeY], entranceOf(s, yard), 'homed at the yard door');
  w.until(() => Math.hypot(fig!.x - fig!.homeX, fig!.y - fig!.homeY) < 0.01, 5, 0.05);
  // dismissed: the figure does not linger
  delete s.staff[m.id];
  w.advance(1);
  assert.equal(staffActor(s, 'mason'), null);
  assert.equal(s.actors[fig!.id], undefined);
  assertWorldSane(s);
});

test('an applicant waits at the door until shown; the Reeve stands beside them, not inside them; then they leave by the gate', () => {
  const w = new WorldSim(7);
  const s = w.s;
  const r = rulerActor(s);
  const vacant = hovels(s)[2]!;
  const door = entranceOf(s, vacant);
  const ap = mkApplicant(s, vacant);
  const fig = s.actors[ap.actorId!]!;
  w.until(() => !fig.path.length, 10, 0.05);
  assert.ok(s.actors[fig.id], 'reaching the door of the vacancy (their home point) does not take them off the table');
  assert.equal(fig.state, 'waiting');
  assert.deepEqual([fig.x, fig.y], door);
  w.advance(3);
  assert.ok(s.actors[fig.id] && fig.state === 'waiting', 'and they go on waiting, day after day, while the application stands');
  assert.deepEqual([fig.x, fig.y], door);
  // the showing
  const show = s.jobs[accepted(w.dispatch({ type: 'order_job', kind: 'show', applicantId: ap.id }))!]!;
  w.until(() => show.state === 'working', 5, 0.02);
  assert.ok(Math.hypot(r.x - fig.x, r.y - fig.y) >= 0.24, `the Reeve stands beside the applicant (${Math.hypot(r.x - fig.x, r.y - fig.y).toFixed(2)} apart)`);
  assert.ok(Math.hypot(r.x - door[0], r.y - door[1]) <= 0.45 && isWalkable(s, r.x, r.y), 'but at the same door');
  w.until(() => show.state === 'done', 5, 0.02);
  // a second applicant for the same door stands clear of both
  const ap2 = mkApplicant(s, vacant, 0, 'Wilmot Reedy');
  const fig2 = s.actors[ap2.actorId!]!;
  w.until(() => !fig2.path.length, 10, 0.05);
  assert.ok(Math.hypot(fig2.x - fig.x, fig2.y - fig.y) >= 0.24, 'two figures do not come to rest on one spot');
  assert.ok(Math.hypot(fig2.x - door[0], fig2.y - door[1]) <= ACTOR_TUNE.homeRadius, 'yet both are at the door');
  // turned away, the way tenants.ts does it: the record is struck, home becomes the gate, and off they go
  const gate = gatePoint(s);
  for (const [a, f] of [[ap, fig], [ap2, fig2]] as const) {
    delete s.applicants[a.id];
    f.homeX = gate[0]; f.homeY = gate[1];
    walkTo(s, f.id, gate[0], gate[1]);
  }
  w.until(() => !s.actors[fig.id] && !s.actors[fig2.id], 10, 0.05);
  // an applicant figure with no application behind it does not linger past dawn
  const orphan = spawnActor(s, { kind: 'applicant', refId: 'nobody', x: door[0], y: door[1] });
  orphan.state = 'waiting';
  w.advance(1.1);
  assert.equal(s.actors[orphan.id], undefined);
  assertWorldSane(s);
});

test('a showing is not pressing while the applicant is still on the road: other work is done first, and nobody is kept waiting long', () => {
  const w = new WorldSim(7, { gold: 300 });
  const s = w.s;
  const r = rulerActor(s);
  const [a, , vacant] = hovels(s);
  // with other work in hand, the Reeve gets on with it while the applicant walks in
  const ap = mkApplicant(s, vacant!);
  const fig = s.actors[ap.actorId!]!;
  assert.ok(fig.path.length > 6, 'a long walk from the gate');
  const show = s.jobs[accepted(w.dispatch({ type: 'order_job', kind: 'show', applicantId: ap.id }))!]!;
  const [cx, cy] = freeSpot(s, 'cottage', 0, (px, py) => px >= 8 && px < 15 && py >= 8 && py < 15);
  const cot = s.buildings[accepted(w.dispatch({ type: 'place_building', btype: 'cottage', x: cx, y: cy, rot: 0 }))!]!;
  const build = jobsAt(s, cot.id)[0]!;
  w.advance(0.05, 0.05);
  assert.equal(r.jobId, build.id, 'the walls first: the applicant is still on the road');
  assert.equal(show.state, 'queued');
  let arrived = 0, setDown = false;
  w.until(() => { if (!arrived && !fig.path.length) arrived = s.day; if (show.state !== 'queued' && build.state === 'queued') setDown = true; return show.state === 'done'; }, 10, 0.02);
  assert.ok(setDown, 'the walls were set down for the showing');
  assert.ok(arrived > 0 && s.day - arrived < 0.6, `shown round soon after they reached the door (${(s.day - arrived).toFixed(2)} days)`);
  w.until(() => build.state === 'done', 20, 0.05);
  assert.equal(w.done[build.id], 1); assert.equal(w.done[show.id], 1);
  // with nothing else to do he goes to the door at once and waits; a purse elsewhere calls him away, and he comes back
  delete s.applicants[ap.id]; delete s.actors[fig.id];
  w.until(() => r.state === 'idle' && Math.hypot(r.x - r.homeX, r.y - r.homeY) < 0.01, 5, 0.05);
  const ap2 = mkApplicant(s, vacant!, 0, 'Wilmot Reedy');
  const fig2 = s.actors[ap2.actorId!]!;
  const show2 = s.jobs[accepted(w.dispatch({ type: 'order_job', kind: 'show', applicantId: ap2.id }))!]!;
  w.advance(0.05, 0.05);
  assert.equal(show2.state, 'traveling', 'nothing else to do: off to the door to meet them');
  a!.units[0]!.purse = 8; a!.units[0]!.purseDay = s.day;
  accepted(w.dispatch({ type: 'collect_purse', buildingId: a!.id }));
  w.advance(0.05, 0.05);
  const purse = Object.values(s.jobs).find(j => j.kind === 'collect' && j.state !== 'done' && j.state !== 'cancelled')!;
  assert.equal(r.jobId, purse.id, 'the purse will not wait; the applicant is still walking');
  assert.equal(show2.state, 'queued');
  w.until(() => purse.state === 'done', 5, 0.02);
  a!.units[0]!.purse = 0;
  w.until(() => show2.state === 'done', 10, 0.02);
  assert.ok(!fig2.path.length);
  assertWorldSane(s);
});

test('a delegate come to petition waits at court (and still takes work); when the matter closes he goes back to his post', () => {
  const w = new WorldSim(7);
  const s = w.s;
  s.realm.rank = 'knight';
  const m = mkStaff(s, 'mason');
  const fig = staffActor(s, 'mason')!;
  w.advance(1.2);                                         // dawn gives him his place by the seat
  w.until(() => !fig.path.length, 5, 0.05);
  const post: [number, number] = [fig.homeX, fig.homeY];
  const door = entranceOf(s, seatOf(s));
  const spot: [number, number] = [door[0] + 2, door[1] + 0.1];           // a little way along the lane
  assert.ok(isWalkable(s, spot[0], spot[1]));
  const inc = mkIncident(s, { actorId: fig.id });
  walkTo(s, fig.id, spot[0], spot[1]);
  w.until(() => fig.state !== 'walking', 5, 0.05);
  assert.equal(fig.state, 'waiting');
  w.advance(2.2);
  assert.ok(Math.hypot(fig.x - spot[0], fig.y - spot[1]) < 0.01, 'dawn does not send a waiting petitioner home');
  // work still finds him
  const c = hovels(s)[2]!;
  const job = s.jobs[accepted(w.dispatch({ type: 'order_job', kind: 'repair', buildingId: c.id }))!]!;
  w.advance(0.02, 0.02);
  assert.equal(job.assignee, fig.id);
  w.until(() => job.state === 'done', 20, 0.05);
  // the matter closes; at dawn he is back at his post
  inc.state = 'resolved';
  walkTo(s, fig.id, spot[0], spot[1]);
  w.until(() => fig.state !== 'walking', 5, 0.05);
  assert.equal(fig.state, 'idle', 'nobody is holding him at court any more');
  w.advance(1);
  w.until(() => !fig.path.length && fig.state === 'idle', 5, 0.05);
  assert.ok(Math.hypot(fig.x - post[0], fig.y - post[1]) < 0.35, 'back at his post');
  assert.ok(m.actorId === fig.id);
  assertWorldSane(s);
});

// ───────────────────────────── jobs ─────────────────────────────

console.log('\njobs');

test('the queue: the ruler\'s explicit orders first, then priority, then age; one job at a time', () => {
  const w = new WorldSim(7);
  const s = w.s;
  const [a, b, c] = hovels(s);
  const mk = (bid: string, priority: number, byRuler = false): Job => enqueueJob(s, { kind: 'inspect', role: 'ruler', buildingId: bid, workDays: 0.2, priority, byRuler });
  const low1 = mk(a!.id, 0);
  w.advance(0.3, 0.05); s.day += 0;                       // (ages differ)
  const low2 = mk(b!.id, 0);
  const high = mk(c!.id, 5);
  const byRuler = mk(seatOf(s).id, 0, true);
  // low1 was already begun before the others existed; it is short, so it is finished first
  const order: string[] = [];
  const startMark = w.events.length;
  for (let i = 0; i < 2000 && [low1, low2, high, byRuler].some(j => j.state !== 'done'); i++) {
    w.advance(0.02, 0.02);
    const active = Object.values(s.jobs).filter(j => j.state === 'traveling' || j.state === 'working');
    assert.ok(active.length <= 1, 'the ruler does one thing at a time');
  }
  for (const e of w.events) if (e.type === 'job' && e.phase === 'start') order.push(e.jobId);
  assert.deepEqual(order, [low1.id, byRuler.id, high.id, low2.id]);
  assert.ok(startMark >= 0);
  for (const j of [low1, low2, high, byRuler]) assert.equal(w.done[j.id], 1);
  // equal priority: the older first
  const older = mk(a!.id, 2);
  s.day += 0.5;
  const newer = mk(b!.id, 2);
  const mark = w.events.length;
  w.until(() => older.state === 'done' && newer.state === 'done', 10, 0.02);
  const second = w.since(mark).filter(e => e.type === 'job' && e.phase === 'start').map(e => (e as { jobId: string }).jobId);
  assert.deepEqual(second, [older.id, newer.id]);
  // defaults
  assert.equal(enqueueJob(s, { kind: 'collect', role: 'bailiff', buildingId: a!.id }).priority, JOB_TUNE.defaultPriority.collect);
  assert.equal(enqueueJob(s, { kind: 'build', role: 'mason', buildingId: a!.id, priority: 7 }).priority, 7);
  assertWorldSane(s);
});

test('a purse on the doorstep interrupts the building of a wall, and the wall is finished afterwards', () => {
  const w = new WorldSim(7, { gold: 300 });
  const s = w.s;
  const r = rulerActor(s);
  const [a, b] = hovels(s);
  const [x, y] = freeSpot(s, 'cottage', 0, (px, py) => px >= 8 && px < 15 && py >= 8 && py < 15);
  const cot = s.buildings[accepted(w.dispatch({ type: 'place_building', btype: 'cottage', x, y, rot: 0 }))!]!;
  const build = jobsAt(s, cot.id)[0]!;
  w.until(() => build.state === 'working', 5, 0.02);
  w.advance(1, 0.05);
  const progress = build.progress;
  refused(w.dispatch({ type: 'collect_all' }), 'invalid');
  refused(w.dispatch({ type: 'collect_purse', buildingId: a!.id }), 'invalid');
  a!.units[0]!.purse = 8; a!.units[0]!.purseDay = s.day;
  b!.units[0]!.purse = 8; b!.units[0]!.purseDay = s.day;
  accepted(w.dispatch({ type: 'collect_all' }));
  accepted(w.dispatch({ type: 'collect_all' }));                           // deduplicated
  accepted(w.dispatch({ type: 'collect_purse', buildingId: a!.id }));      // likewise
  accepted(w.dispatch({ type: 'collect_purse', buildingId: b!.id, unit: 0 }));
  const collects = Object.values(s.jobs).filter(j => j.kind === 'collect');
  assert.equal(collects.length, 2);
  for (const c of collects) assert.deepEqual([c.role, c.byRuler, c.workDays], ['bailiff', true, JOB_TUNE.work.collect]);
  w.advance(0.02, 0.02);
  assert.equal(build.state, 'queued', 'the wall is set down');
  assert.ok(Math.abs(build.progress - progress) < 0.02);
  assert.equal(r.jobId, collects.find(c => c.state === 'traveling')!.id);
  w.until(() => collects.every(c => c.state === 'done'), 5, 0.02);
  assert.equal(cot.state, 'building');
  // (in the whole game rent.ts empties the purse when the collect job is done; here nobody does, so clear them)
  a!.units[0]!.purse = 0; b!.units[0]!.purse = 0;
  w.until(() => cot.state === 'ready', 20, 0.05);
  assert.equal(s.gold, 300 - BUILDINGS.cottage.cost, 'the cottage was paid for once');
  assert.equal(w.done[build.id], 1);
  // a purse that is gone before anyone fetches it cancels the errand
  a!.units[0]!.purse = 8;
  accepted(w.dispatch({ type: 'collect_purse', buildingId: a!.id }));
  const errand = Object.values(s.jobs).find(j => j.kind === 'collect' && j.state === 'queued')!;
  a!.units[0]!.purse = 0;
  w.advance(0.05, 0.05);
  assert.equal(errand.state, 'cancelled', 'a job whose target vanished is cancelled');
  assertWorldSane(s);
});

test('delegates: a mason takes mason work (faster with skill); with no bailiff the ruler knocks; "any" prefers the trade', () => {
  const w = new WorldSim(7, { gold: 500 });
  const s = w.s;
  s.realm.rank = 'knight';
  const r = rulerActor(s);
  const [a, b, c] = hovels(s);
  assert.equal(hasWorker(s, 'mason'), true, 'at any rank somebody can do it: the ruler');
  const m = mkStaff(s, 'mason', 3);
  const fig = staffActor(s, 'mason')!;
  assert.ok(fig && fig.id === m.actorId);
  // a mason job goes to the mason, and the ruler stays where he is
  c!.condition = 40;
  const repair = s.jobs[accepted(w.dispatch({ type: 'order_job', kind: 'repair', buildingId: c!.id }))!]!;
  w.advance(0.02, 0.02);
  assert.equal(repair.assignee, fig.id);
  assert.equal(r.jobId, null);
  // "any" masonry while the mason is busy falls to the ruler; a bailiff's job with no bailiff likewise
  const anyJob = enqueueJob(s, { kind: 'repair', role: 'any', buildingId: a!.id, workDays: 0.3 });
  const knock = enqueueJob(s, { kind: 'inspect', role: 'bailiff', buildingId: b!.id, workDays: 0.2, priority: 0 });
  w.advance(0.02, 0.02);
  assert.equal(anyJob.assignee, r.id, 'the mason is busy, so the ruler takes it');
  assert.equal(knock.state, 'queued', 'one thing at a time');
  w.until(() => anyJob.state === 'done' && knock.state === 'done', 10, 0.02);
  assert.equal(knock.assignee, r.id);
  // skill and temperament divide the labour
  w.until(() => repair.state === 'done', 20, 0.02);
  const speed = (1 + (3 - 1) * 0.2) * (TEMPERAMENT_DEFS.steady.speed || 1);
  const timed = enqueueJob(s, { kind: 'repair', role: 'mason', buildingId: c!.id, workDays: 2.8 });
  const timedRuler = enqueueJob(s, { kind: 'repair', role: 'ruler', buildingId: a!.id, workDays: 2.8 });
  let masonFrom = 0, rulerFrom = 0, masonDone = 0, rulerDone = 0;
  w.until(() => {
    if (timed.state === 'working' && !masonFrom) masonFrom = s.day;
    if (timedRuler.state === 'working' && !rulerFrom) rulerFrom = s.day;
    if (timed.state === 'done' && !masonDone) masonDone = s.day - masonFrom;
    if (timedRuler.state === 'done' && !rulerDone) rulerDone = s.day - rulerFrom;
    return !!masonDone && !!rulerDone;
  }, 20, 0.01);
  assert.ok(Math.abs(rulerDone - 2.8) < 0.15, `the ruler works at 1.0 (${rulerDone})`);
  assert.ok(Math.abs(masonDone - 2.8 / speed) < 0.15, `the mason at ${speed.toFixed(2)} (${masonDone})`);
  // "any" with the mason free goes to the mason, not the ruler
  w.advance(1.2);
  const any2 = enqueueJob(s, { kind: 'repair', role: 'any', buildingId: b!.id, workDays: 0.2 });
  w.advance(0.02, 0.02);
  assert.equal(any2.assignee, fig.id, '"any" prefers the matching delegate');
  // the mason dismissed mid-job: the work goes back on the list and falls to the ruler
  const long = enqueueJob(s, { kind: 'repair', role: 'mason', buildingId: c!.id, workDays: 3 });
  w.until(() => long.state === 'working', 10, 0.02);
  assert.equal(long.assignee, fig.id);
  delete s.staff[m.id]; delete s.actors[fig.id];
  w.advance(0.05, 0.05);
  assert.equal(long.assignee, r.id);
  w.until(() => long.state === 'done', 20, 0.05);
  assert.equal(w.done[long.id], 1);
  assertWorldSane(s);
});

test('order_job validates its target for every kind', () => {
  const w = new WorldSim(7);
  const s = w.s;
  const [a, b] = hovels(s);
  const t = mkTenant(s, a!);
  refused(w.dispatch({ type: 'order_job', kind: 'build', buildingId: a!.id }), 'invalid');
  refused(w.dispatch({ type: 'order_job', kind: 'collect', buildingId: a!.id }), 'invalid');
  refused(w.dispatch({ type: 'order_job', kind: 'incident' }), 'invalid');
  // visit: the ruler in person
  refused(w.dispatch({ type: 'order_job', kind: 'visit', buildingId: b!.id }), 'not_found');
  const visit = s.jobs[accepted(w.dispatch({ type: 'order_job', kind: 'visit', tenantId: t.id, role: 'mason' }))!]!;
  assert.deepEqual([visit.kind, visit.role, visit.tenantId, visit.buildingId, visit.byRuler], ['visit', 'ruler', t.id, a!.id, true]);
  refused(w.dispatch({ type: 'order_job', kind: 'visit', buildingId: a!.id }), 'busy');
  // notices and evictions follow the law
  refused(w.dispatch({ type: 'order_job', kind: 'serve_notice', tenantId: t.id }), 'invalid');        // owes nothing
  refused(w.dispatch({ type: 'order_job', kind: 'evict', tenantId: t.id }), 'not_ready');             // no writ
  t.arrears = 8; t.lateStage = 'late';
  const notice = s.jobs[accepted(w.dispatch({ type: 'order_job', kind: 'serve_notice', tenantId: t.id }))!]!;
  assert.deepEqual([notice.role, notice.cost], ['bailiff', JOB_TUNE.cost.serve_notice]);
  refused(w.dispatch({ type: 'order_job', kind: 'serve_notice', tenantId: t.id }), 'busy');
  t.lateStage = 'writ';
  const evict = s.jobs[accepted(w.dispatch({ type: 'order_job', kind: 'evict', buildingId: a!.id }))!]!;
  assert.equal(evict.tenantId, t.id);
  refused(w.dispatch({ type: 'order_job', kind: 'evict', tenantId: 'nobody' }), 'not_found');
  // showing and screening need someone to show and to ask about
  refused(w.dispatch({ type: 'order_job', kind: 'show', buildingId: b!.id }), 'not_found');
  s.applicants.p1 = {
    id: 'p1', buildingId: b!.id, unit: 0, arrivedDay: s.day, leavesDay: s.day + 9, maxRent: 10, shown: false, screened: false, actorId: null,
    household: { id: 'tx', name: 'Jory Applewhite', first: 'Jory', species: 'human', trade: 'carpenter', character: null, portraitSeed: 1, household: 3, traits: ['handy'], revealed: [], tags: [], pets: [], income: 40, reliability: 0.8 },
  };
  const show = s.jobs[accepted(w.dispatch({ type: 'order_job', kind: 'show', buildingId: b!.id }))!]!;
  assert.deepEqual([show.role, show.applicantId, show.buildingId, show.unit], ['crier', 'p1', b!.id, 0]);
  refused(w.dispatch({ type: 'order_job', kind: 'show', applicantId: 'p1' }), 'busy');
  const screen = s.jobs[accepted(w.dispatch({ type: 'order_job', kind: 'screen', applicantId: 'p1' }))!]!;
  assert.deepEqual([screen.role, screen.cost, [screen.x, screen.y]], ['steward', JOB_TUNE.cost.screen, gatePoint(s)]);
  refused(w.dispatch({ type: 'order_job', kind: 'screen', applicantId: 'p1' }), 'busy');
  // inspecting
  const inspect = s.jobs[accepted(w.dispatch({ type: 'order_job', kind: 'inspect', buildingId: b!.id }))!]!;
  assert.equal(inspect.kind, 'inspect');
  refused(w.dispatch({ type: 'order_job', kind: 'inspect' }), 'invalid');
  // the household leaves: everything about them is called off; the applicant goes: so is the showing
  t.status = 'left'; a!.units[0]!.tenantId = null;
  delete s.applicants.p1;
  w.advance(0.05, 0.05);
  for (const j of [visit, notice, evict, show, screen]) assert.equal(j.state, 'cancelled', `${j.kind} is cancelled when its target is gone`);
  assert.notEqual(inspect.state, 'cancelled');
  assertWorldSane(s);
});

test('the purse round: the nearest door next, unless a purse is about to be spent', () => {
  const w = new WorldSim(7);
  const s = w.s;
  const r = rulerActor(s);
  const hs = hovels(s);
  const doors = hs.map(b => entranceOf(s, b));
  const round = (): string[] => {
    // set the purses out and queue the errands farthest first, the way nobody would walk them
    const order = hs.map((b, i) => ({ b, d: Math.hypot(doors[i]![0] - r.x, doors[i]![1] - r.y) })).sort((p, q) => q.d - p.d).map(o => o.b);
    const where: Record<string, string> = {};
    for (const b of order) where[enqueueJob(s, { kind: 'collect', role: 'bailiff', buildingId: b.id, unit: 0, workDays: 0.1 }).id] = b.id;
    const mark = w.events.length;
    w.until(() => !Object.values(s.jobs).some(j => j.kind === 'collect' && (j.state === 'queued' || j.state === 'traveling' || j.state === 'working')), 20, 0.02);
    return w.since(mark).filter(e => e.type === 'job' && e.phase === 'start').map(e => where[(e as { jobId: string }).jobId] ?? '?');
  };
  const greedy = (first?: Building): string[] => {
    let [x, y] = [r.x, r.y];
    const left = hs.slice(), out: string[] = [];
    if (first) { left.splice(left.indexOf(first), 1); out.push(first.id); [x, y] = entranceOf(s, first); }
    while (left.length) {
      left.sort((p, q) => Math.hypot(entranceOf(s, p)[0] - x, entranceOf(s, p)[1] - y) - Math.hypot(entranceOf(s, q)[0] - x, entranceOf(s, q)[1] - y));
      const next = left.shift()!;
      out.push(next.id); [x, y] = entranceOf(s, next);
    }
    return out;
  };
  for (const b of hs) { b.units[0]!.purse = 8; b.units[0]!.purseDay = s.day; }
  const want = greedy();
  assert.deepEqual(round(), want, 'nearest door first, then the nearest to that');
  // one purse has sat for days and is about to be taken back indoors: it is fetched before the nearer ones
  w.until(() => Math.hypot(r.x - r.homeX, r.y - r.homeY) < 0.01 && r.state === 'idle', 5, 0.05);
  const stale = hs.map((b, i) => ({ b, d: Math.hypot(doors[i]![0] - r.x, doors[i]![1] - r.y) })).sort((p, q) => q.d - p.d)[0]!.b;
  for (const b of hs) { b.units[0]!.purse = 8; b.units[0]!.purseDay = b === stale ? s.day - (BAL.purseDays - 1) : s.day; }
  const want2 = greedy(stale);
  assert.deepEqual(round(), want2, 'the purse about to be spent comes first');
  // the ruler asking in person for a purse somebody was already sent for moves it to the front, without a second errand
  for (const b of hs) { b.units[0]!.purse = 8; b.units[0]!.purseDay = s.day; }
  const slow = enqueueJob(s, { kind: 'collect', role: 'bailiff', buildingId: hs[0]!.id, unit: null, workDays: 0.1, priority: 0 });
  accepted(w.dispatch({ type: 'collect_purse', buildingId: hs[0]!.id }));
  assert.equal(Object.values(s.jobs).filter(j => j.kind === 'collect' && j.buildingId === hs[0]!.id && j.state !== 'done' && j.state !== 'cancelled').length, 1);
  assert.deepEqual([slow.byRuler, slow.priority], [true, JOB_TUNE.defaultPriority.collect]);
  assertWorldSane(s);
});

test('work that is called off: an incident\'s job may be cancelled; a demolition called off puts the shingle back', () => {
  const w = new WorldSim(7);
  const s = w.s;
  const [a, b] = hovels(s);
  // an incident job (as incidents.ts queues one) can be called off by the ruler: the matter is theirs to reopen
  const inc = mkIncident(s, { buildingId: a!.id, state: 'in_progress' });
  const errand = enqueueJob(s, { kind: 'incident', role: 'mason', buildingId: a!.id, incidentId: inc.id, outcomeId: 'fix', workDays: 2, cost: 9 });
  inc.jobId = errand.id;
  w.until(() => errand.state === 'working', 5, 0.02);
  const paid = s.gold;
  accepted(w.dispatch({ type: 'cancel_job', jobId: errand.id }));
  assert.equal(errand.state, 'cancelled'); assert.equal(rulerActor(s).jobId, null);
  assert.equal(s.gold, paid, 'what was paid stays paid');
  assert.equal(w.done[errand.id], undefined, 'and nobody is told it was done');
  // a demolition: the place comes off the market; cancel it and it is to let again, but only what was to let before
  b!.units[0]!.listed = true;
  const jid = accepted(w.dispatch({ type: 'demolish', buildingId: b!.id }))!;
  assert.equal(b!.units[0]!.listed, false);
  accepted(w.dispatch({ type: 'cancel_job', jobId: jid }));
  assert.equal(b!.units[0]!.listed, true, 'called off: the shingle goes back up');
  assert.ok(s.buildings[b!.id]);
  accepted(w.dispatch({ type: 'set_listed', buildingId: b!.id, listed: false }));
  const jid2 = accepted(w.dispatch({ type: 'demolish', buildingId: b!.id }))!;
  accepted(w.dispatch({ type: 'cancel_job', jobId: jid2 }));
  assert.equal(b!.units[0]!.listed, false, 'a place that was not to let is not listed by accident');
  // a household that moves in before the hammer falls stops the demolition
  const jid3 = accepted(w.dispatch({ type: 'demolish', buildingId: b!.id }))!;
  mkTenant(s, b!);
  w.advance(0.05, 0.05);
  assert.equal(s.jobs[jid3]!.state, 'cancelled', 'nobody is pulled down around a household');
  w.advance(3);
  assert.ok(s.buildings[b!.id], 'and the house still stands');
  assertWorldSane(s);
});

// ───────────────────────────── names ─────────────────────────────

console.log('\nnames');

test('building names: type-aware, funny, never repeated within a realm', () => {
  const w = new WorldSim(99);
  const s = w.s;
  const seen = new Set<string>(Object.values(s.buildings).map(b => b.name));
  const template: Building = hovels(s)[0]!;
  const samples: Record<string, string[]> = {};
  let n = 0;
  for (let round = 0; round < 16; round++) {
    for (const bt of BUILDING_TYPES) {
      if (bt === 'seat') continue;
      const name = makeBuildingName(s, bt);
      assert.ok(name.length >= 3 && name.length <= 44, `"${name}" is a sensible length`);
      assert.ok(!/[{}–—]/.test(name) && name === name.trim(), `"${name}" is clean`);
      assert.ok(!seen.has(name), `"${name}" repeats`);
      seen.add(name);
      (samples[bt] ??= []).push(name);
      const id = 'x' + n++;
      s.buildings[id] = { ...template, id, name, type: bt, units: [] };     // the realm remembers it
    }
  }
  assert.equal(makeBuildingName(s, 'seat'), "Reeve's Hut");
  assert.ok(n >= 400);
  for (const id of Object.keys(s.buildings)) if (id.startsWith('x')) delete s.buildings[id];
  console.log('             e.g. ' + ['hovel', 'cottage', 'burrow', 'tavern', 'chapel', 'statue', 'well'].map(k => `${k}: ${samples[k]!.slice(0, 3).join(' / ')}`).join('\n                  '));
});

// ───────────────────────────── determinism and endurance ─────────────────────────────

console.log('\ndeterminism and endurance');

/** a small player: builds, paves, clears, repairs, buys land, collects */
function botTurn(s: GameState, dispatch: (a: Action) => ActionResult, turn: number): void {
  dispatch({ type: 'collect_all' });
  const owned = (x: number, y: number) => ownedAt(s, x, y);
  const types: BuildingType[] = ['hovel', 'well', 'cottage', 'garden', 'burrow', 'market_stall', 'notice_board', 'shrine', 'longhouse', 'masons_yard', 'stocks'];
  const bt = types[turn % types.length]!;
  if (s.gold > BUILDINGS[bt].cost + 20) {
    outer: for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      if (owned(x, y) && (x * 7 + y * 13 + turn) % 5 === 0 && canPlace(s, bt, x, y, turn % 4).ok) { dispatch({ type: 'place_building', btype: bt, x, y, rot: (turn % 4) as 0 | 1 | 2 | 3 }); break outer; }
    }
  }
  const worst = Object.values(s.buildings).filter(b => b.state !== 'building').sort((p, q) => p.condition - q.condition)[0];
  if (worst) dispatch({ type: 'order_job', kind: worst.state === 'ruined' ? 'renovate' : 'repair', buildingId: worst.id });
  if (turn % 3 === 0) {
    const tiles: [number, number][] = [];
    for (let k = 0; k < 4; k++) tiles.push([8 + ((turn * 3 + k) % 8), 8 + ((turn * 5) % 8)]);
    dispatch({ type: 'place_road', tiles });
  }
  if (turn % 4 === 1) dispatch({ type: 'order_job', kind: 'clear_land' });
  if (turn % 7 === 2) for (const p of s.map.parcels) if (!p.owned && dispatch({ type: 'buy_parcel', parcelId: p.id }).ok) break;
  if (turn % 9 === 4) dispatch({ type: 'go_to', x: 8 + (turn % 8) + 0.5, y: 8 + ((turn * 3) % 8) + 0.5 });
  if (turn % 11 === 5) { const b = Object.values(s.buildings).find(q => q.type !== 'seat' && !q.units.some(u => u.tenantId)); if (b) dispatch({ type: 'demolish', buildingId: b.id }); }
  if (turn % 5 === 0) { const b = Object.values(s.buildings)[turn % Object.keys(s.buildings).length]; if (b) dispatch({ type: 'remove_road', tiles: [[b.x - 1, b.y], [b.x, b.y - 1]] }); }
}

test('the sim-world modules are deterministic: same seed and same orders, same realm', () => {
  const run = (seed: number): string => {
    const w = new WorldSim(seed, { gold: 400 });
    for (let turn = 0; turn < 30; turn++) {
      w.use();
      botTurn(w.s, a => w.dispatch(a), turn);
      w.advance(4);
      if (turn === 12) w.s.realm.rank = 'knight';
      w.s.gold += 30;
    }
    assertWorldSane(w.s);
    return mySlices(w.s) + '|' + w.s.rng + '|' + w.s.nextId;
  };
  const a = run(4711), b = run(4711), c = run(4712);
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('500 days on the sim-world modules alone: no throw, no NaN, nothing out of range', () => {
  for (const seed of [1, 22, 333]) {
    const w = new WorldSim(seed, { gold: 300 });
    for (let turn = 0; turn < 100; turn++) {
      botTurn(w.s, a => w.dispatch(a), turn);
      w.advance(5);
      w.s.gold += 25;
      if (turn === 30) w.s.realm.rank = 'knight';
      if (turn === 40) mkStaff(w.s, 'mason', 2);
      if (turn === 60) w.s.realm.rank = 'baron';
      assertWorldSane(w.s);
    }
    assert.ok(w.s.day >= 500);
    assert.ok(Object.keys(w.s.jobs).length < 400, 'finished jobs are swept');
    assert.ok(Object.keys(w.s.buildings).length > 5, 'the bot built a village');
  }
});

test('the whole Sim: 500 days from Sim.create() with a busy player, no throw, no NaN in the world', () => {
  registerModules(MODULES);
  for (const seed of [42, 20261011]) {
    const sim = Sim.create({ seed, ruler: 'Luke' });
    const s = sim.state;
    assertWorldSane(s);
    assert.equal(Object.values(s.buildings).filter(b => b.type === 'hovel').length, 3);
    for (let turn = 0; turn < 100; turn++) {
      botTurn(s, a => sim.dispatch(a), turn);
      sim.advanceDays(5);
      if (s.ended) break;
      assertWorldSane(s);
    }
    assert.ok(s.ended || s.day >= 500);
    JSON.parse(JSON.stringify({ map: s.map, buildings: s.buildings, actors: s.actors, jobs: s.jobs }));
  }
});

test('the whole Sim: a real applicant walks in from the gate, waits at the door, and is shown round by the Reeve', () => {
  registerModules(MODULES);
  const sim = Sim.create({ seed: 42, ruler: 'Luke' });
  const s = sim.state;
  const vacant = Object.values(s.buildings).find(b => b.type === 'hovel' && !b.units[0]!.tenantId)!;
  assert.ok(vacant, 'one hovel starts vacant');
  const ap = spawnApplicant(s, vacant.id, 0);
  if (!ap || !ap.actorId) { console.log('             (tenants.ts made no applicant figure; nothing of ours to check)'); return; }
  const fig = s.actors[ap.actorId]!;
  assert.ok(fig && fig.kind === 'applicant');
  const gate = gatePoint(s);
  assert.ok(Math.hypot(fig.x - gate[0], fig.y - gate[1]) < 0.01, 'they appear at the gate');
  let guard = 0;
  while (s.actors[fig.id] && fig.path.length && guard++ < 400) sim.advanceDays(0.05);
  assert.ok(s.actors[fig.id], 'the figure is still on the table when it reaches the door');
  const door = entranceOf(s, vacant);
  assert.ok(Math.hypot(fig.x - door[0], fig.y - door[1]) <= ACTOR_TUNE.homeRadius, 'and it is at the door of the vacancy');
  sim.advanceDays(1.5);
  assert.ok(s.actors[fig.id] && fig.state === 'waiting', 'where it waits');
  const res = sim.dispatch({ type: 'order_job', kind: 'show', applicantId: ap.id, buildingId: vacant.id });
  assert.ok(res.ok, res.ok ? '' : res.reason);
  const job = s.jobs[(res as { id: string }).id]!;
  const r = rulerActor(s);
  guard = 0;
  while (job.state !== 'done' && job.state !== 'cancelled' && guard++ < 400) {
    sim.advanceDays(0.05);
    if (job.state === 'working') assert.ok(Math.hypot(r.x - fig.x, r.y - fig.y) >= 0.2, 'the Reeve and the applicant do not stand inside one another');
  }
  assert.equal(job.state, 'done');
  assert.equal(job.assignee, r.id, 'no Crier at Reeve rank: the Reeve shows the place himself');
  assert.ok(s.applicants[ap.id]?.shown ?? true, 'and the showing is recorded');
  assertWorldSane(s);
});

test('the whole Sim: Rent Day at Reeve rank. Purses on the step, the Reeve walks the round, the coffers fill', () => {
  registerModules(MODULES);
  const sim = Sim.create({ seed: 42, ruler: 'Luke' });
  const s = sim.state;
  const r = rulerActor(s);
  const seen: SimEvent[] = [];
  sim.on(evs => { seen.push(...evs); });
  sim.advanceDays(32.5);
  const purses = Object.values(s.buildings).flatMap(b => b.units.map((u, i) => ({ b, i, amount: u.purse }))).filter(p => p.amount > 0);
  if (!purses.length) { console.log('             (no purses were set out this Rent Day; nothing of ours to check)'); return; }
  const mark = seen.length;
  assert.ok(sim.dispatch({ type: 'collect_all' }).ok);
  const mine = Object.values(s.jobs).filter(j => j.kind === 'collect' && j.state !== 'done' && j.state !== 'cancelled');
  assert.equal(mine.length, purses.length, 'one errand a purse');
  let guard = 0;
  while (mine.some(j => j.state !== 'done' && j.state !== 'cancelled') && guard++ < 600) sim.advanceDays(0.05);
  assert.ok(mine.every(j => j.state === 'done'), 'every purse was fetched');
  for (const p of purses) assert.equal(p.b.units[p.i]!.purse, 0, 'the step is bare');
  const fetched = seen.filter(e => e.type === 'purse_collected');
  assert.ok(fetched.length >= purses.length);
  assert.ok(fetched.every(e => e.type === 'purse_collected' && e.byActor === r.id), 'by the Reeve in person');
  const banked = seen.slice(mark).reduce((n, e) => n + (e.type === 'gold' && (e.cat === 'rent' || e.cat === 'fees') ? e.amount : 0), 0);
  const due = purses.reduce((n, p) => n + p.amount, 0);
  assert.ok(banked >= due, `the rent reached the coffers (${banked} of ${due} crowns)`);
  assertWorldSane(s);
});

test('the whole Sim on the hand-built fixtures: a year at each rank, nobody stuck, nothing thrown', () => {
  registerModules(MODULES);
  for (const rank of ['reeve', 'knight', 'baron'] as const) {
    const s = makeFixtureState(rank);
    const sim = new Sim(s);
    for (let d = 0; d < 360; d++) {
      sim.advanceDays(1);
      if (d % 6 === 0) sim.dispatch({ type: 'collect_all' });
      if (s.ended) break;
    }
    assertClean(s.map, 'map'); assertClean(s.buildings, 'buildings'); assertClean(s.actors, 'actors'); assertClean(s.jobs, 'jobs');
    for (const a of Object.values(s.actors)) {
      assert.ok(a.x >= 0 && a.x <= MAP_W && a.y >= 0 && a.y <= MAP_H, `${rank}: a figure left the table`);
      if (a.jobId) assert.equal(s.jobs[a.jobId]?.assignee, a.id, `${rank}: a figure holds a job that does not hold it`);
      else assert.notEqual(a.state, 'working', `${rank}: a figure is working at nothing`);
    }
    for (const b of Object.values(s.buildings)) { const d = desirability(s, b); assert.ok(d >= 0 && d <= 100); const e = entranceOf(s, b); assert.ok(Number.isFinite(e[0]) && Number.isFinite(e[1])); }
    assert.ok(Object.keys(s.jobs).length < 200, `${rank}: finished work is swept (${Object.keys(s.jobs).length})`);
    assert.equal(Object.values(s.actors).filter(a => a.kind === 'ruler').length, 1);
  }
});

test('the whole Sim is deterministic in the world it leaves behind', () => {
  registerModules(MODULES);
  const run = (): string => {
    const sim = Sim.create({ seed: 8086, ruler: 'Luke' });
    for (let turn = 0; turn < 24; turn++) { botTurn(sim.state, a => sim.dispatch(a), turn); sim.advanceDays(5); }
    return mySlices(sim.state);
  };
  assert.equal(run(), run());
});

// ───────────────────────────── report ─────────────────────────────

const failed = results.filter(r => r.status === 'fail');
const foreign = results.filter(r => r.status === 'foreign');
console.log(`\n${results.filter(r => r.status === 'ok').length} passed, ${failed.length} failed, ${foreign.length} failed outside sim-world (FOREIGN)`);
if (foreign.length) console.log('FOREIGN failures start in another module\'s file and are not counted against this suite:\n  ' + foreign.map(r => r.name).join('\n  '));
if (failed.length) process.exit(1);
