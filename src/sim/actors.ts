/** OWNER: sim-world agent. Gameplay figures: the ruler, staff, applicants, petitioners.
 *
 *  How figures behave (other modules may rely on this):
 *   - `walkTo` always finds a way (see path.findPathLoose) and sets state 'walking'.
 *   - On arrival the ruler and staff become 'idle' (the ruler 'waiting' if `go_to` sent him somewhere
 *     that is not home, so he stays where he was put until there is work).
 *   - Applicants, petitioners and visitors become 'waiting' wherever they arrive. A guest is "held" on
 *     the table while a record points at it: an entry in `s.applicants`, or an open incident whose
 *     `actorId` it is. A guest who is NOT held and walks to its home point (`homeX/homeY`: where it was
 *     spawned, unless its owner moved it) has left: the actor is removed on arrival. So to send someone
 *     away, drop the record, set their home to wherever they should leave by, and `walkTo` it; or just
 *     drop the record, and they turn for home at the next dawn. A held guest may stand at its own home
 *     point for as long as it is held (an applicant waiting at the door of the vacancy).
 *   - A delegate who is the `actorId` of an open incident waits where they arrive (and still takes work);
 *     when the matter closes they go back to their post at dawn.
 *   - Each dawn the ruler's home is set to the seat's door and each delegate's to their staff building's
 *     door (the seat's door when they have none). Hired staff with no figure are given one.
 *   - No two figures come to rest on the same spot: whoever gets there second stops a step to one side.
 *   - Walking wears desire paths into the grass.
 */
import { MAP_W, MAP_H, type GameState, type SimModule, type Actor, type ActorKind, type Id, type StaffRole, type ActionOf, type ActionResult, type Building } from './types';
import { BAL } from '../data/balance';
import { BUILDINGS } from '../data/buildings';
import { newId, emit, clamp, tileAt } from './core';
import { findPathLoose } from './path';
import { entranceOf, isWalkable, mapPlan } from './world';
import { pauseJob } from './jobs';

export const TUNE = {
  /** wear added to a grass tile each time a figure steps onto it (1 = bare earth) */
  wearPerStep: 0.035,
  /** pace through things figures should not really be walking on (loose paths only) */
  roughPace: { forest: 0.45, rock: 0.4, water: 0.3, building: 0.6 },
  /** within this of the home point counts as home */
  homeRadius: 0.6,
  /** the ruler stands this far to the side of the seat's door, leaving the step free for petitioners */
  rulerAside: 0.28,
  /** two figures may not come to rest closer than this; the later one stops `stepAside` to one side instead */
  personalSpace: 0.24,
  stepAside: 0.3,
} as const;

const STAFF_BUILDING: Record<StaffRole, string> = { mason: 'masons_yard', bailiff: 'bailiffs_post', crier: 'criers_stand', steward: 'counting_house' };
for (const def of Object.values(BUILDINGS)) if (def.staffRole) STAFF_BUILDING[def.staffRole] = def.id;
const ROLE_SLOT: Record<StaffRole, number> = { mason: 0, bailiff: 1, crier: 2, steward: 3 };

function paceOf(kind: ActorKind): number {
  return kind === 'ruler' ? BAL.walkSpeed.ruler : kind === 'staff' ? BAL.walkSpeed.staff : BAL.walkSpeed.visitor;
}
const isGuest = (a: Actor): boolean => a.kind === 'applicant' || a.kind === 'petitioner' || a.kind === 'visitor';
const atHome = (a: Actor): boolean => Math.hypot(a.x - a.homeX, a.y - a.homeY) <= TUNE.homeRadius;

export function spawnActor(s: GameState, spec: { kind: ActorKind; refId: Id | null; x: number; y: number; speed?: number }): Actor {
  const x = clamp(Number.isFinite(spec.x) ? spec.x : MAP_W / 2, 0.01, MAP_W - 0.01);
  const y = clamp(Number.isFinite(spec.y) ? spec.y : MAP_H / 2, 0.01, MAP_H - 0.01);
  const speed = spec.speed !== undefined && Number.isFinite(spec.speed) && spec.speed > 0 ? spec.speed : paceOf(spec.kind);
  const a: Actor = { id: newId(s, 'a'), kind: spec.kind, refId: spec.refId, x, y, path: [], speed, state: 'idle', jobId: null, homeX: x, homeY: y, facing: 0 };
  s.actors[a.id] = a;
  emit(s, { type: 'actor_spawn', actorId: a.id });
  return a;
}

export function removeActor(s: GameState, actorId: Id): void {
  const a = s.actors[actorId];
  if (!a) return;
  if (a.jobId) pauseJob(s, a.jobId);            // whatever they were doing goes back on the list
  delete s.actors[actorId];
  emit(s, { type: 'actor_gone', actorId });
}

const SIDESTEPS: readonly (readonly [number, number])[] = [[0, 0], [-1, 0], [1, 0], [0, 1], [0, -1], [-1, 1], [1, 1], [-1, -1], [1, -1]];

/** Somewhere to stand at (x, y), or a step to one side of it on open ground, that no other figure is
 *  standing on or walking to. Two figures never have to stand inside one another at a door. */
function standingRoom(s: GameState, a: Actor, x: number, y: number): [number, number] {
  const taken: [number, number][] = [];
  for (const id in s.actors) {
    const o = s.actors[id]!;
    if (o.id === a.id) continue;
    const p = o.path.length ? o.path[o.path.length - 1]! : [o.x, o.y] as [number, number];
    if (Math.abs(p[0] - x) < 1 && Math.abs(p[1] - y) < 1) taken.push(p);
  }
  if (!taken.length) return [x, y];
  for (const [dx, dy] of SIDESTEPS) {
    const px = x + dx * TUNE.stepAside, py = y + dy * TUNE.stepAside;
    if ((dx !== 0 || dy !== 0) && !isWalkable(s, px, py)) continue;
    if (taken.every(p => Math.hypot(p[0] - px, p[1] - py) >= TUNE.personalSpace)) return [px, py];
  }
  return [x, y];
}

/** Path the actor to (x, y). False if unreachable. (Figures are resourceful: in practice only a missing actor fails.)
 *  The walk ends on the exact spot asked for when that is open ground, else in the middle of the nearest ground
 *  to it; and if another figure has that spot, a step to one side of it. */
export function walkTo(s: GameState, actorId: Id, x: number, y: number): boolean {
  const a = s.actors[actorId];
  if (!a || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const tx = clamp(x, 0.01, MAP_W - 0.01), ty = clamp(y, 0.01, MAP_H - 0.01);
  const path = Math.hypot(tx - a.x, ty - a.y) < 0.05 ? [] : findPathLoose(s, a.x, a.y, tx, ty);
  const end = path.length ? path[path.length - 1]! : [a.x, a.y] as [number, number];
  const exact = Math.floor(end[0]) === Math.floor(tx) && Math.floor(end[1]) === Math.floor(ty) && isWalkable(s, tx, ty);
  const spot = standingRoom(s, a, exact ? tx : end[0], exact ? ty : end[1]);
  if (path.length) path[path.length - 1] = spot;
  else if (Math.hypot(spot[0] - a.x, spot[1] - a.y) >= 0.05) path.push(spot);
  if (!path.length) {                             // already there, or as near as anyone can get: not a journey
    a.path = [];
    if (a.state === 'walking') a.state = 'idle';
    return true;
  }
  a.path = path;
  a.state = 'walking';
  return true;
}

function seatDoor(s: GameState): [number, number] {
  let seat: Building | null = null;
  for (const id in s.buildings) { if (s.buildings[id]!.type === 'seat') { seat = s.buildings[id]!; break; } }
  if (seat) return entranceOf(s, seat);
  return [MAP_W / 2 + 0.5, MAP_H / 2 + 0.5];
}

/** where a figure should stand near a door so that two figures do not stand inside each other */
function beside(s: GameState, door: [number, number], slot: number): [number, number] {
  const k = TUNE.rulerAside;
  const off = ([[-k, 0], [k, 0], [-k, k + 0.04], [k, k + 0.04], [0, k + 0.1]] as const)[slot] ?? [0, 0];
  const p: [number, number] = [door[0] + off[0], door[1] + off[1]];
  return isWalkable(s, p[0], p[1]) ? p : door;
}

/** The ruler's own figure (always exists after init; idles at the seat's door). */
export function rulerActor(s: GameState): Actor {
  for (const id in s.actors) if (s.actors[id]!.kind === 'ruler') return s.actors[id]!;
  const [x, y] = beside(s, seatDoor(s), 0);
  return spawnActor(s, { kind: 'ruler', refId: null, x, y });
}

/** A point at the map edge where newcomers appear and the departed leave (where the road comes in). */
export function gatePoint(s: GameState): [number, number] {
  const want = clamp(mapPlan(s.seed).gateRow, 0, MAP_H - 1);
  const isRoad = (y: number): boolean => { const t = tileAt(s, 0, y); return !!t && !t.b && (t.t === 'road' || t.t === 'bridge'); };
  if (isRoad(want)) return [0.5, want + 0.5];
  // a hand-made or altered map: the road tile on the west edge nearest to where the gate should be
  let best = -1;
  for (let y = 0; y < MAP_H; y++) if (isRoad(y) && (best < 0 || Math.abs(y - want) < Math.abs(best - want))) best = y;
  if (best >= 0) return [0.5, best + 0.5];
  for (let d = 0; d < MAP_H; d++) {
    for (const y of [want - d, want + d]) if (y >= 0 && y < MAP_H && isWalkable(s, 0, y)) return [0.5, y + 0.5];
  }
  return [0.5, want + 0.5];
}

/** The actor embodying this staff / applicant / tenant / npc id, if on the table. */
export function actorFor(s: GameState, refId: Id): Actor | null {
  for (const id in s.actors) if (s.actors[id]!.refId === refId) return s.actors[id]!;
  return null;
}

/** The figure of the delegate holding this post, if there is one on the table. */
export function staffActor(s: GameState, role: StaffRole): Actor | null {
  for (const id in s.staff) {
    const m = s.staff[id]!;
    if (m.role !== role) continue;
    const a = (m.actorId ? s.actors[m.actorId] : null) ?? actorFor(s, m.id);
    if (a) return a;
  }
  return null;
}

/** Free to be given work: no job, and not on an errand the ruler sent them on by hand. */
export function isFree(a: Actor): boolean {
  if (a.jobId) return false;
  if (a.state === 'idle' || a.state === 'waiting') return true;
  if (a.state !== 'walking') return false;
  const end = a.path[a.path.length - 1];
  return !end || Math.hypot(end[0] - a.homeX, end[1] - a.homeY) <= TUNE.homeRadius;   // only strolling home
}

// ───────────────────────────── movement ─────────────────────────────

function paceAt(s: GameState, x: number, y: number): number {
  const t = tileAt(s, Math.floor(x), Math.floor(y));
  if (!t) return 1;
  if (t.b) return TUNE.roughPace.building;
  switch (t.t) {
    case 'road': case 'bridge': return BAL.roadSpeedBonus;
    case 'forest': return TUNE.roughPace.forest;
    case 'rock': return TUNE.roughPace.rock;
    case 'water': return TUNE.roughPace.water;
    default: return 1;
  }
}

function tread(s: GameState, x: number, y: number, worn: [number, number][]): void {
  const tx = Math.floor(x), ty = Math.floor(y);
  const t = tileAt(s, tx, ty);
  if (!t || t.b || (t.t !== 'grass' && t.t !== 'field')) return;
  const next = Math.min(1, (t.wear > 0 ? t.wear : 0) + TUNE.wearPerStep);
  if (Math.floor(next * 8) !== Math.floor(t.wear * 8)) worn.push([tx, ty]);
  t.wear = next;
}

/** Is some record still keeping this figure on the table: an applicant's entry, or an open matter they came about? */
function heldOnTable(s: GameState, a: Actor): boolean {
  if (a.refId && s.applicants[a.refId]) return true;
  for (const id in s.applicants) if (s.applicants[id]!.actorId === a.id) return true;
  for (const id in s.incidents) {
    const inc = s.incidents[id]!;
    if (inc.actorId === a.id && (inc.state === 'open' || inc.state === 'in_progress')) return true;
  }
  return false;
}

function arrive(s: GameState, a: Actor): void {
  if (a.jobId || a.state !== 'walking') return;      // the job system notices its own arrivals
  if (a.kind === 'ruler') a.state = atHome(a) ? 'idle' : 'waiting';
  else if (a.kind === 'staff') a.state = heldOnTable(s, a) ? 'waiting' : 'idle';   // a delegate come to petition stands and waits
  else if (atHome(a) && !heldOnTable(s, a)) removeActor(s, a.id);                  // a guest who walks home has left
  else a.state = 'waiting';
}

/** Walk the figure along its path for up to `dtDays`. Returns the time left over if it reached the end of the
 *  path sooner (0 if it is still walking). Tiles whose wear visibly changed are added to `worn`.
 *  jobs.ts moves figures that have a job in hand (so that walking and working share one clock); this module
 *  moves everyone else. */
export function advanceActor(s: GameState, a: Actor, dtDays: number, worn: [number, number][]): number {
  if (!a.path.length) return Math.max(0, dtDays);
  const speed = Number.isFinite(a.speed) && a.speed > 0 ? a.speed : paceOf(a.kind);
  let budget = Number.isFinite(dtDays) ? dtDays : 0;
  let guard = 0;
  while (a.path.length && budget > 1e-9 && guard++ < 256) {
    const next = a.path[0]!;
    const dx = next[0] - a.x, dy = next[1] - a.y;
    const d = Math.hypot(dx, dy);
    if (!(d > 1e-6)) { a.path.shift(); continue; }
    const v = speed * paceAt(s, a.x, a.y);
    const reach = v * budget;
    a.facing = Math.atan2(dx, dy);
    if (reach >= d) {
      a.x = next[0]; a.y = next[1];
      a.path.shift();
      budget -= d / v;
      tread(s, a.x, a.y, worn);
    } else {
      a.x += (dx / d) * reach; a.y += (dy / d) * reach;
      budget = 0;
    }
  }
  if (a.path.length) return 0;
  arrive(s, a);
  return Math.max(0, budget);
}

// ───────────────────────────── daily housekeeping ─────────────────────────────

function staffHome(s: GameState, role: StaffRole): [number, number] {
  const type = STAFF_BUILDING[role];
  for (const id in s.buildings) {
    const b = s.buildings[id]!;
    if (b.type === type && b.state === 'ready') return entranceOf(s, b);
  }
  const door = seatDoor(s);
  // no post of their own yet: they wait by the seat, a little apart from one another
  return beside(s, door, 1 + ROLE_SLOT[role]);
}

function setHome(a: Actor, p: [number, number]): void { a.homeX = p[0]; a.homeY = p[1]; }

function dawn(s: GameState): void {
  // the ruler belongs at the seat's door
  const ruler = rulerActor(s);
  setHome(ruler, beside(s, seatDoor(s), 0));

  // delegates: a figure for everyone on the roll, a home at their post; nobody lingers after dismissal
  const onRoll = new Set<Id>();
  for (const id of Object.keys(s.staff)) {
    const m = s.staff[id]!;
    let a = (m.actorId ? s.actors[m.actorId] : null) ?? actorFor(s, m.id);
    const home = staffHome(s, m.role);
    if (!a) a = spawnActor(s, { kind: 'staff', refId: m.id, x: home[0], y: home[1] });
    onRoll.add(a.id);
    setHome(a, home);
  }
  for (const id of Object.keys(s.actors)) {
    const a = s.actors[id];
    if (!a) continue;
    if (a.kind === 'staff' && !onRoll.has(a.id)) { removeActor(s, a.id); continue; }
    if (a.jobId || a.path.length || a.state === 'walking' || a.state === 'working') continue;
    // standing about. Is anybody still expecting them?
    if (a.kind === 'staff') {
      if (a.state === 'waiting' && !heldOnTable(s, a)) a.state = 'idle';     // the audience is over: back to the yard
    } else if ((a.kind === 'applicant' || a.kind === 'petitioner') && !heldOnTable(s, a)) {
      // nobody is: an applicant slips away, a petitioner walks home and is gone when they get there
      if (a.kind === 'applicant' || atHome(a)) { removeActor(s, a.id); continue; }
      a.state = 'idle';
    }
    // idle figures drift home (the household to its exact post; a guest back to where it belongs)
    if (a.state === 'idle') {
      const far = Math.hypot(a.x - a.homeX, a.y - a.homeY);
      if (isGuest(a) ? far > TUNE.homeRadius : far > 0.05) {
        walkTo(s, a.id, a.homeX, a.homeY);
        // a guest with no way home and nobody expecting them is simply taken off the table
        if (!a.path.length && a.kind !== 'visitor' && isGuest(a) && !heldOnTable(s, a)) removeActor(s, a.id);
      }
    }
  }
}

function goTo(s: GameState, act: ActionOf<'go_to'>): ActionResult {
  const x = Number(act.x), y = Number(act.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, code: 'invalid', reason: 'Go where, exactly?' };
  const r = rulerActor(s);
  if (r.jobId) pauseJob(s, r.jobId);                  // set down, not cancelled: it goes back on the list
  r.state = 'idle';
  r.path = [];
  if (!walkTo(s, r.id, x, y)) return { ok: false, code: 'blocked', reason: 'There is no way there on foot.' };
  if (!r.path.length) r.state = atHome(r) ? 'idle' : 'waiting';
  return { ok: true, id: r.id };
}

export const actorsModule: SimModule = {
  name: 'actors',
  init(s) {
    const r = rulerActor(s);
    setHome(r, beside(s, seatDoor(s), 0));
    r.x = r.homeX; r.y = r.homeY;
  },
  step(s, dtDays) {
    const worn: [number, number][] = [];
    for (const id of Object.keys(s.actors)) {
      const a = s.actors[id];
      if (a && a.path.length && !a.jobId) advanceActor(s, a, dtDays, worn);     // (workers walk on the job system's clock)
    }
    if (worn.length) emit(s, { type: 'tiles_changed', tiles: worn });
  },
  onDay(s) { dawn(s); },
  handlers: { go_to: goTo },
};
