/** OWNER: sim-world agent. The work queue: who walks where to do what, and for how long.
 *
 *  Who takes a job
 *   - role 'ruler': the ruler's own figure.
 *   - a staff role: that delegate. If nobody holds the post, the ruler does it (at Reeve rank the ruler
 *     does everything: a 'mason' job is the Reeve with a hammer).
 *   - 'any': the delegate whose trade it is, if there is one and they are free; else the ruler.
 *  One job per figure at a time. Each figure's queue runs: the ruler's explicit orders (`byRuler`) first,
 *  then higher `priority`, then oldest. A job that outranks a long piece of labour (building, renovating,
 *  repairing, demolishing, clearing) sets that labour down until it is done: nothing is lost, the walls
 *  wait, and the purse on the doorstep does not. Purses of equal standing are fetched as a round: the
 *  nearest door next, unless one is about to be spent. A showing whose applicant is still walking in from
 *  the gate is not pressing: it goes to a figure with nothing else to do, and anything else may call them
 *  away from the door until the applicant is nearly there.
 *
 *  Life of a job: queued → traveling ('start') → working ('arrive'; the cost is charged here, once) →
 *  done ('done', then core.notifyJobDone exactly once). Finished and cancelled jobs stay in `s.jobs`
 *  for a day or two so listeners can still read them, then are swept.
 */
import type {
  GameState, SimModule, Job, JobRole, JobKind, JobState, Id, StaffRole, Actor, ActionOf, ActionResult, ExpenseCat,
  DecisionType, StaffMember, Tenant, Applicant,
} from './types';
import { STAFF_ROLES } from './types';
import type { EmoteId } from '../data/ids';
import { TEMPERAMENT_DEFS } from '../data/temperaments';
import { INCIDENT_BY_ID } from '../data/incidents/index';
import { RANKS } from '../data/ranks';
import { BAL } from '../data/balance';
import { newId, emit, clamp, tileAt, notifyJobDone } from './core';
import { rulerActor, staffActor, walkTo, isFree, gatePoint, advanceActor } from './actors';
import { entranceOf, orderClear, nearestClearable } from './world';
import { pathLength } from './path';
import { orderRepair, orderRenovate, orderDemolish, demolitionCalledOff } from './buildings';
import { spend } from './economy';

export const TUNE = {
  /** used when the caller gives no priority (higher goes first) */
  defaultPriority: {
    incident: 3, collect: 3, evict: 3, serve_notice: 3, show: 3,
    repair: 2, screen: 2, inspect: 2, visit: 2,
    build: 1, renovate: 1, demolish: 1, clear_land: 0,
  } as Record<JobKind, number>,
  /** labour in days for jobs this module creates itself */
  work: { collect: 0.1, show: 0.3, visit: 0.25, serve_notice: 0.5, evict: 1, inspect: 0.5, screen: 1 },
  cost: { screen: 4, serve_notice: 2, evict: 5 },
  /** a purse this close (in days) to being spent by its household is fetched before nearer ones */
  purseHurryDays: 2,
  /** long labour is only set down for something else if at least this many days of it remain */
  preemptMinDays: 0.75,
  /** a showing is not pressing until the household to be shown round is within this many days' walk more than the worker is */
  showLeadDays: 0.1,
  /** how many jobs in a row one figure may begin within a single tick (short errands at coarse time steps) */
  passesPerTick: 8,
  /** swept jobs are marked with this priority on the first dawn after they finish, removed on the next */
  tombstone: -9999,
} as const;

/** labour that may be set down and picked up again */
const LONG: readonly JobKind[] = ['build', 'renovate', 'repair', 'demolish', 'clear_land'];

export type JobSpec = Pick<Job, 'kind' | 'role'> & Partial<Omit<Job, 'id' | 'kind' | 'role' | 'state' | 'assignee' | 'progress' | 'createdDay'>>;

const isActive = (j: Job): boolean => j.state === 'queued' || j.state === 'traveling' || j.state === 'working';
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
function address(s: GameState): string { return RANKS[s.realm.rank]?.address ?? 'Reeve'; }

// ───────────────────────────── queueing ─────────────────────────────

function defaultSite(s: GameState, spec: JobSpec): [number, number] {
  let buildingId = spec.buildingId ?? null;
  if (!buildingId && spec.tenantId) buildingId = s.tenants[spec.tenantId]?.buildingId ?? null;
  if (!buildingId && spec.applicantId) buildingId = s.applicants[spec.applicantId]?.buildingId ?? null;
  if (!buildingId && spec.incidentId) buildingId = s.incidents[spec.incidentId]?.buildingId ?? null;
  const b = buildingId ? s.buildings[buildingId] : null;
  if (b) return entranceOf(s, b);
  const r = rulerActor(s);
  return [r.homeX, r.homeY];
}

/** Queue work. Location defaults to the building's entrance. Cost is charged (economy.spend) when work starts.
 *  When it finishes the job system sets state 'done', emits {type:'job', phase:'done'} and calls core.notifyJobDone once. */
export function enqueueJob(s: GameState, spec: JobSpec): Job {
  const site = Number.isFinite(spec.x) && Number.isFinite(spec.y) ? [spec.x as number, spec.y as number] : defaultSite(s, spec);
  const j: Job = {
    id: newId(s, 'j'), kind: spec.kind, role: spec.role ?? 'any', state: 'queued', assignee: null,
    buildingId: spec.buildingId ?? null, unit: spec.unit ?? null, tenantId: spec.tenantId ?? null,
    applicantId: spec.applicantId ?? null, incidentId: spec.incidentId ?? null, outcomeId: spec.outcomeId ?? null,
    x: site[0]!, y: site[1]!,
    workDays: Math.max(0, num(spec.workDays, 1)), progress: 0, cost: Math.max(0, Math.round(num(spec.cost, 0))),
    priority: num(spec.priority, TUNE.defaultPriority[spec.kind] ?? 0), createdDay: s.day, byRuler: !!spec.byRuler,
  };
  s.jobs[j.id] = j;
  emit(s, { type: 'job', jobId: j.id, phase: 'queued' });
  return j;
}

function release(s: GameState, j: Job): void {
  const w = j.assignee ? s.actors[j.assignee] : null;
  if (w && w.jobId === j.id) { w.jobId = null; w.path = []; w.state = 'idle'; }
  j.assignee = null;
}

export function cancelJob(s: GameState, jobId: Id): void {
  const j = s.jobs[jobId];
  if (!j || !isActive(j)) return;
  release(s, j);
  j.state = 'cancelled';
  emit(s, { type: 'job', jobId, phase: 'cancel' });
  if (j.kind === 'demolish' && j.buildingId) demolitionCalledOff(s, j.buildingId);
}

/** Set a job down without cancelling it: it returns to the queue with its progress (and its paid cost) intact. */
export function pauseJob(s: GameState, jobId: Id): void {
  const j = s.jobs[jobId];
  if (!j || (j.state !== 'traveling' && j.state !== 'working')) return;
  release(s, j);
  j.state = 'queued';
  emit(s, { type: 'job', jobId, phase: 'queued' });
}

/** Work under way or waiting at this building. */
export function jobsAt(s: GameState, buildingId: Id): Job[] { return Object.values(s.jobs).filter(j => j.buildingId === buildingId && isActive(j)); }

/** Is there anyone who can take jobs of this role? (At Reeve rank the ruler does everything, so: yes.) */
export function hasWorker(s: GameState, role: JobRole): boolean {
  if (role !== 'ruler' && role !== 'any' && staffActor(s, role)) return true;
  return !!rulerActor(s);
}

// ───────────────────────────── who does what ─────────────────────────────

const DOMAIN: Partial<Record<DecisionType, StaffRole>> = {
  repair: 'mason', late_rent: 'bailiff', eviction_ready: 'bailiff', squatters: 'bailiff', applicant: 'crier',
  move_out_deposit: 'steward', rent_renewal: 'steward', pet: 'steward',
};
const CATEGORY_DOMAIN: Record<string, StaffRole> = {
  maintenance: 'mason', weather: 'mason', payment: 'bailiff', legal: 'bailiff', squatter: 'bailiff', pest: 'bailiff',
  lease: 'steward', commerce: 'steward',
};

/** whose trade this job is, for role 'any' */
function tradeOf(s: GameState, j: Job): StaffRole | null {
  switch (j.kind) {
    case 'build': case 'repair': case 'renovate': case 'demolish': case 'clear_land': return 'mason';
    case 'collect': case 'serve_notice': case 'evict': return 'bailiff';
    case 'show': return 'crier';
    case 'screen': case 'inspect': return 'steward';
    case 'incident': {
      const inc = j.incidentId ? s.incidents[j.incidentId] : null;
      const def = inc ? INCIDENT_BY_ID[inc.defId] : null;
      if (!def) return null;
      return DOMAIN[def.decision] ?? CATEGORY_DOMAIN[def.category] ?? null;
    }
    default: return null;
  }
}

function designated(s: GameState, j: Job, ruler: Actor): { primary: Actor; fallback: Actor | null } {
  if (j.role === 'ruler') return { primary: ruler, fallback: null };
  if (j.role === 'any') {
    const trade = tradeOf(s, j);
    const d = trade ? staffActor(s, trade) : null;
    return d ? { primary: d, fallback: ruler } : { primary: ruler, fallback: null };
  }
  const d = (STAFF_ROLES as readonly string[]).includes(j.role) ? staffActor(s, j.role) : null;
  return { primary: d ?? ruler, fallback: null };
}

function memberOf(s: GameState, w: Actor): StaffMember | null {
  return w.kind === 'staff' && w.refId ? s.staff[w.refId] ?? null : null;
}

/** labour multiplier: a delegate's skill and temperament; the ruler works at 1.0 */
function speedOf(s: GameState, w: Actor): number {
  const m = memberOf(s, w);
  if (!m) return 1;
  const skill = clamp(num(m.skill, 1), 1, 5);
  const temper = num(TEMPERAMENT_DEFS[m.temperament]?.speed, 1);
  return clamp((1 + (skill - 1) * 0.2) * (temper > 0 ? temper : 1), 0.25, 4);
}

const outranks = (q: Job, c: Job): boolean => (q.byRuler && !c.byRuler) || (q.byRuler === c.byRuler && q.priority > c.priority);

/** A showing whose household is still some way down the road: there is no hurry to go and stand at the door.
 *  It becomes pressing when the walk they have left is about as long as the walk the worker has to get there. */
function early(s: GameState, j: Job, w: Actor | null): boolean {
  if (j.kind !== 'show' || !j.applicantId) return false;
  const ap = s.applicants[j.applicantId];
  const guest = ap?.actorId ? s.actors[ap.actorId] : null;
  if (!guest || !guest.path.length) return false;
  const theirs = pathLength(guest.x, guest.y, guest.path) / (Math.max(1, num(guest.speed, BAL.walkSpeed.visitor)) * 1.25);
  const ours = w ? Math.hypot(j.x - w.x, j.y - w.y) / Math.max(1, num(w.speed, BAL.walkSpeed.staff)) : 0;
  return theirs > ours + TUNE.showLeadDays;
}

function canSetDown(s: GameState, q: Job, w: Actor): boolean {
  const c = w.jobId ? s.jobs[w.jobId] : null;
  if (!c || !isActive(c)) return false;
  if (c.state === 'traveling' && early(s, c, w)) return true;   // only waiting about for someone still on the road
  if (!LONG.includes(c.kind) || !outranks(q, c)) return false;
  if (c.state === 'working') {
    const left = (c.workDays * (1 - c.progress)) / speedOf(s, w);
    if (left < TUNE.preemptMinDays) return false;            // nearly done: finish it first
  }
  return true;
}

function begin(s: GameState, j: Job, w: Actor): void {
  j.state = 'traveling';
  j.assignee = w.id;
  w.jobId = j.id;
  w.path = [];
  walkTo(s, w.id, j.x, j.y);
  w.state = 'walking';
  emit(s, { type: 'job', jobId: j.id, phase: 'start' });
}

/** Purses of equal standing are fetched as a sensible round, not in the order they were set out: the nearest
 *  door next, except that a purse about to be taken back indoors and spent is fetched before any other. */
function walkTheRound(s: GameState, queued: Job[], ruler: Actor): void {
  for (let i = 0; i < queued.length;) {
    const head = queued[i]!;
    let k = i + 1;
    if (head.kind === 'collect') {
      while (k < queued.length && queued[k]!.kind === 'collect' && queued[k]!.byRuler === head.byRuler && queued[k]!.priority === head.priority) k++;
      if (k - i > 1) {
        const w = designated(s, head, ruler).primary;
        const key = (j: Job): number => {
          const u = j.buildingId ? s.buildings[j.buildingId]?.units[j.unit ?? 0] : null;
          const age = u && u.purse > 0 ? s.day - num(u.purseDay, s.day) : 0;
          return age >= BAL.purseDays - TUNE.purseHurryDays ? -1e6 - age : Math.hypot(j.x - w.x, j.y - w.y);
        };
        const run = queued.slice(i, k).map(j => ({ j, key: key(j) })).sort((a, b) => a.key - b.key);
        for (let n = 0; n < run.length; n++) queued[i + n] = run[n]!.j;
      }
    }
    i = k;
  }
}

/** Hand queued work to whoever may take it and is free. Returns what was begun, and whether the worker had
 *  been standing free until now (so had not yet spent any of this tick). */
function assign(s: GameState): { j: Job; w: Actor; fresh: boolean }[] {
  const begun: { j: Job; w: Actor; fresh: boolean }[] = [];
  const queued: Job[] = [];
  for (const id in s.jobs) { const j = s.jobs[id]!; if (j.state === 'queued') queued.push(j); }
  if (!queued.length) return begun;
  // insertion order is creation order, and the sort is stable: explicit orders, then priority, then age
  queued.sort((a, b) => (Number(b.byRuler) - Number(a.byRuler)) || (b.priority - a.priority) || (a.createdDay - b.createdDay));
  const ruler = rulerActor(s);
  walkTheRound(s, queued, ruler);
  const later: Job[] = [];
  for (const j of queued) {
    if (j.state !== 'queued') continue;
    const { primary, fallback } = designated(s, j, ruler);
    if (early(s, j, primary)) { later.push(j); continue; }
    let w: Actor | null = null;
    let fresh = false;
    if (isFree(primary)) { w = primary; fresh = !primary.path.length; }
    else if (fallback && isFree(fallback)) { w = fallback; fresh = !fallback.path.length; }
    else if (canSetDown(s, j, primary)) { pauseJob(s, primary.jobId!); w = primary; }
    if (w) { begin(s, j, w); begun.push({ j, w, fresh }); }
  }
  // a showing whose household is still walking in goes to whoever has nothing better to do meanwhile
  for (const j of later) {
    if (j.state !== 'queued') continue;
    const { primary, fallback } = designated(s, j, ruler);
    const w = isFree(primary) ? primary : fallback && isFree(fallback) ? fallback : null;
    if (w) { const fresh = !w.path.length; begin(s, j, w); begun.push({ j, w, fresh }); }
  }
  return begun;
}

// ───────────────────────────── doing the work ─────────────────────────────

function categoryOf(s: GameState, j: Job): ExpenseCat {
  switch (j.kind) {
    case 'build': case 'demolish': case 'clear_land': return 'construction';
    case 'repair': case 'renovate': return 'repairs';
    case 'serve_notice': case 'evict': return 'court';
    case 'incident': {
      const inc = j.incidentId ? s.incidents[j.incidentId] : null;
      const def = inc ? INCIDENT_BY_ID[inc.defId] : null;
      if (def && (def.decision === 'repair' || def.category === 'maintenance' || def.category === 'weather')) return 'repairs';
      if (def && (def.category === 'legal' || def.decision === 'late_rent' || def.decision === 'eviction_ready')) return 'court';
      return 'other';
    }
    default: return 'other';
  }
}

function memoOf(s: GameState, j: Job): string {
  const b = j.buildingId ? s.buildings[j.buildingId] : null;
  const t = j.tenantId ? s.tenants[j.tenantId] : null;
  const where = b ? b.name : 'the realm';
  switch (j.kind) {
    case 'build': return `Building ${where}`;
    case 'repair': return `Repairs, ${where}`;
    case 'renovate': return `Renovation, ${where}`;
    case 'demolish': return `Pulling down ${where}`;
    case 'clear_land': return 'Clearing land';
    case 'serve_notice': return t ? `Notice to Quit, ${t.name}` : 'Notice to Quit';
    case 'evict': return t ? `Eviction, ${t.name}` : 'Eviction';
    case 'screen': {
      const ap = j.applicantId ? s.applicants[j.applicantId] : null;
      return `Enquiries about ${t?.name ?? ap?.household.name ?? 'an applicant'}`;
    }
    case 'incident': {
      const inc = j.incidentId ? s.incidents[j.incidentId] : null;
      const def = inc ? INCIDENT_BY_ID[inc.defId] : null;
      return def ? `${def.title}${b ? ', ' + b.name : ''}` : `Work at ${where}`;
    }
    default: return `Work at ${where}`;
  }
}

/** how the worker feels about having done it (the figure shows it) */
const DONE_EMOTE: Partial<Record<JobKind, EmoteId>> = {
  build: 'cheer', renovate: 'cheer', repair: 'happy', demolish: 'sweat', clear_land: 'sweat', collect: 'coin',
};

function finish(s: GameState, j: Job): void {
  const w = j.assignee ? s.actors[j.assignee] : null;
  j.state = 'done';
  j.progress = 1;
  if (w && w.jobId === j.id) { w.jobId = null; w.state = 'idle'; w.path = []; }
  if (j.kind === 'build') { const b = j.buildingId ? s.buildings[j.buildingId] : null; if (b && b.state === 'building') b.progress = 1; }
  emit(s, { type: 'job', jobId: j.id, phase: 'done' });
  const mood = DONE_EMOTE[j.kind];
  if (mood && w) emit(s, { type: 'emote', emote: mood, actorId: w.id });
  notifyJobDone(s, j);
}

function startWork(s: GameState, j: Job, w: Actor): void {
  j.state = 'working';
  w.state = 'working';
  w.path = [];
  const b = j.buildingId ? s.buildings[j.buildingId] : null;
  const fx = b ? b.x + b.w / 2 : j.x, fy = b ? b.y + b.h / 2 : j.y;
  if (Math.hypot(fx - w.x, fy - w.y) > 0.05) w.facing = Math.atan2(fx - w.x, fy - w.y);
  if (!(j.progress > 0)) {
    // first arrival: this is when the money changes hands (a delegate's temperament colours the bill)
    const m = memberOf(s, w);
    const mult = m ? num(TEMPERAMENT_DEFS[m.temperament]?.cost, 1) : 1;
    j.cost = Math.max(0, Math.round(j.cost * clamp(mult > 0 ? mult : 1, 0.4, 2.5)));
    if (j.cost > 0) {
      const refs: { buildingId?: Id; tenantId?: Id } = {};
      if (j.buildingId) refs.buildingId = j.buildingId;
      if (j.tenantId) refs.tenantId = j.tenantId;
      spend(s, j.cost, categoryOf(s, j), memoOf(s, j), refs);
    }
    j.progress = 1e-6;
  }
  emit(s, { type: 'job', jobId: j.id, phase: 'arrive' });
  const sfx = j.kind === 'build' || j.kind === 'repair' || j.kind === 'renovate' || j.kind === 'demolish' ? 'hammer'
    : j.kind === 'clear_land' ? 'saw'
    : j.kind === 'serve_notice' || j.kind === 'evict' || j.kind === 'visit' ? 'knock'
    : j.kind === 'show' ? 'door' : null;
  if (sfx) emit(s, j.buildingId ? { type: 'sfx', id: sfx, buildingId: j.buildingId } : { type: 'sfx', id: sfx });
  if (!(j.workDays > 0)) finish(s, j);
}

/** Has the thing this job is about gone away? */
function vanished(s: GameState, j: Job): boolean {
  const b = j.buildingId ? s.buildings[j.buildingId] : null;
  if (j.buildingId && !b) return true;
  switch (j.kind) {
    case 'build': return !b || b.state !== 'building';
    case 'repair': return !b || b.state !== 'ready';
    case 'renovate': return !b || b.state === 'building';
    case 'demolish': return !b || b.units.some(u => !!u.tenantId);     // nobody is pulled down around a household
    case 'clear_land': { const t = tileAt(s, Math.floor(j.x), Math.floor(j.y)); return !t || (t.t !== 'forest' && t.t !== 'rock'); }
    case 'collect': {
      if (!b) return true;
      return j.unit === null ? !b.units.some(u => u.purse > 0) : !(b.units[j.unit] && b.units[j.unit]!.purse > 0);
    }
    case 'show': {
      if (!j.applicantId) return false;
      const a = s.applicants[j.applicantId];
      return !a || a.shown;
    }
    case 'screen': {
      if (j.applicantId) return !s.applicants[j.applicantId];
      if (j.tenantId) { const t = s.tenants[j.tenantId]; return !t || t.status !== 'housed'; }
      return false;
    }
    case 'serve_notice': case 'evict': case 'visit': {
      if (!j.tenantId) return false;
      const t = s.tenants[j.tenantId];
      return !t || t.status !== 'housed';
    }
    case 'incident': {
      if (!j.incidentId) return false;
      const inc = s.incidents[j.incidentId];
      return !inc || inc.state === 'expired';
    }
    default: return false;
  }
}

/** A showing cannot begin until the household being shown round has actually reached the door. */
function waitingForCompany(s: GameState, j: Job): boolean {
  if (j.kind !== 'show' || !j.applicantId) return false;
  const ap = s.applicants[j.applicantId];
  const actor = ap?.actorId ? s.actors[ap.actorId] : null;
  return !!actor && actor.path.length > 0;
}

/** Call off work whose object is gone, put back work whose worker is gone, and free any figure holding a job
 *  that no longer holds them (an old save, a hand-made state). */
function tidy(s: GameState): void {
  for (const id of Object.keys(s.jobs)) {
    const j = s.jobs[id];
    if (!j || !isActive(j)) continue;
    if (vanished(s, j)) { cancelJob(s, j.id); continue; }
    if (j.state === 'queued') { if (j.assignee) j.assignee = null; continue; }
    const w = j.assignee ? s.actors[j.assignee] : null;
    if (!w || w.jobId !== j.id) {                       // the worker is gone (dismissed, or called away)
      j.assignee = null; j.state = 'queued';
      emit(s, { type: 'job', jobId: j.id, phase: 'queued' });
    }
  }
  for (const id in s.actors) {
    const w = s.actors[id]!;
    if (!w.jobId) { if (w.state === 'working') w.state = 'idle'; continue; }     // (nobody works at nothing)
    const j = s.jobs[w.jobId];
    if (j && j.assignee === w.id && (j.state === 'traveling' || j.state === 'working')) continue;
    w.jobId = null;
    if (w.state === 'working' || (w.state === 'walking' && !w.path.length)) w.state = 'idle';
  }
}

/** Put `days` of labour into a job. Returns the time not needed if that finished it, else 0. */
function work(s: GameState, j: Job, w: Actor, days: number): number {
  if (w.state !== 'working') w.state = 'working';
  const rate = speedOf(s, w) / Math.max(j.workDays, 1e-3);            // progress per day
  const need = Math.max(0, 1 - j.progress) / rate;
  if (days >= need) { finish(s, j); return days - need; }
  j.progress = Math.min(1, j.progress + days * rate);
  if (j.kind === 'build') { const b = j.buildingId ? s.buildings[j.buildingId] : null; if (b && b.state === 'building') b.progress = Math.min(0.999, j.progress); }
  return 0;
}

/** A worker gets on with the job in hand for up to `days`: walks, then works. Returns the time left over if the
 *  job was finished within it (so the next job can begin in the same breath), else 0. Because of this the pace
 *  of work does not depend on how finely time is sliced: a bot stepping a quarter-day at a time and a browser
 *  stepping sixty times a second see the same rounds walked. */
function carryOn(s: GameState, w: Actor, days: number, worn: [number, number][]): number {
  const j = w.jobId ? s.jobs[w.jobId] : null;
  if (!j || j.assignee !== w.id) return 0;
  let left = days;
  if (j.state === 'traveling') {
    if (w.path.length) {
      if (w.state !== 'walking') w.state = 'walking';
      left = advanceActor(s, w, left, worn);
      if (w.path.length) return 0;
    }
    if (waitingForCompany(s, j)) { w.state = 'waiting'; return 0; }
    startWork(s, j, w);
  }
  const now: JobState = j.state;                 // (startWork may have finished it outright: no labour in it)
  return now === 'working' ? work(s, j, w, left) : now === 'done' ? left : 0;
}

function step(s: GameState, dtDays: number): void {
  tidy(s);
  const worn: [number, number][] = [];
  const spare: Record<Id, number> = {};          // time each worker still has this tick
  for (const id of Object.keys(s.actors)) {
    const w = s.actors[id];
    if (!w || !w.jobId) continue;
    spare[w.id] = carryOn(s, w, dtDays, worn);
  }
  // hand out what is waiting; whoever still has time this tick starts on it at once (and may finish it, and take another)
  for (let pass = 0; pass < TUNE.passesPerTick; pass++) {
    const begun = assign(s);
    if (!begun.length) break;
    let more = false;
    for (const { w, fresh } of begun) {
      const have = spare[w.id] ?? (fresh ? dtDays : 0);
      spare[w.id] = 0;
      if (!(have > 1e-9)) continue;
      const left = carryOn(s, w, have, worn);
      if (left > 1e-9 && !w.jobId) { spare[w.id] = left; more = true; }
    }
    if (!more) break;
  }
  if (worn.length) emit(s, { type: 'tiles_changed', tiles: worn });
}

function sweep(s: GameState): void {
  for (const id of Object.keys(s.jobs)) {
    const j = s.jobs[id]!;
    if (isActive(j)) continue;
    if (j.priority === TUNE.tombstone) delete s.jobs[id];
    else j.priority = TUNE.tombstone;
  }
}

// ───────────────────────────── actions ─────────────────────────────

function findActive(s: GameState, pred: (j: Job) => boolean): Job | null {
  for (const id in s.jobs) { const j = s.jobs[id]!; if (isActive(j) && pred(j)) return j; }
  return null;
}

function tenantFor(s: GameState, a: { tenantId?: Id; buildingId?: Id }): Tenant | null {
  if (a.tenantId) { const t = s.tenants[a.tenantId]; return t && t.status === 'housed' ? t : null; }
  const b = a.buildingId ? s.buildings[a.buildingId] : null;
  if (!b) return null;
  for (const u of b.units) { const t = u.tenantId ? s.tenants[u.tenantId] : null; if (t && t.status === 'housed') return t; }
  return null;
}

function applicantFor(s: GameState, a: { applicantId?: Id; buildingId?: Id }, unshownOnly: boolean): Applicant | null {
  if (a.applicantId) return s.applicants[a.applicantId] ?? null;
  if (!a.buildingId) return null;
  let found: Applicant | null = null;
  for (const id in s.applicants) {
    const ap = s.applicants[id]!;
    if (ap.buildingId !== a.buildingId) continue;
    if (unshownOnly && ap.shown) { found ??= ap; continue; }
    return ap;
  }
  return found;
}

function asRole(v: unknown): JobRole | null {
  return v === 'ruler' || v === 'any' || (typeof v === 'string' && (STAFF_ROLES as readonly string[]).includes(v)) ? (v as JobRole) : null;
}

function orderJob(s: GameState, a: ActionOf<'order_job'>): ActionResult {
  const role = asRole(a.role);
  const needBuilding: ActionResult = { ok: false, code: 'invalid', reason: `Which building, ${address(s)}?` };
  switch (a.kind) {
    case 'repair': return a.buildingId ? orderRepair(s, a.buildingId, true, role ?? 'mason') : needBuilding;
    case 'renovate': return a.buildingId ? orderRenovate(s, a.buildingId, true, role ?? 'mason') : needBuilding;
    case 'demolish': return a.buildingId ? orderDemolish(s, a.buildingId, true, role ?? 'mason') : needBuilding;
    case 'clear_land': {
      const b = a.buildingId ? s.buildings[a.buildingId] : null;
      const r = rulerActor(s);
      const spot = nearestClearable(s, b ? b.x + b.w / 2 : r.homeX, b ? b.y + b.h / 2 : r.homeY);
      if (!spot) return { ok: false, code: 'invalid', reason: 'There is nothing left on your land to clear.' };
      return orderClear(s, spot[0], spot[1], true);
    }
    case 'show': {
      const ap = applicantFor(s, a, true);
      if (!ap) return { ok: false, code: 'not_found', reason: 'Nobody is waiting to be shown that place.' };
      if (ap.shown) return { ok: false, code: 'invalid', reason: `${ap.household.name} has seen it already and is thinking it over.` };
      if (!s.buildings[ap.buildingId]) return { ok: false, code: 'not_found', reason: 'The place they came to see is no longer there.' };
      if (findActive(s, j => j.kind === 'show' && j.applicantId === ap.id)) return { ok: false, code: 'busy', reason: 'Someone is already on the way to show it.' };
      const job = enqueueJob(s, { kind: 'show', role: role ?? 'crier', buildingId: ap.buildingId, unit: ap.unit, applicantId: ap.id, workDays: TUNE.work.show, byRuler: true });
      return { ok: true, id: job.id };
    }
    case 'screen': {
      const ap = a.applicantId || !a.tenantId ? applicantFor(s, a, false) : null;
      const gate = gatePoint(s);
      if (ap) {
        if (ap.screened) return { ok: false, code: 'invalid', reason: `${ap.household.name}'s last landlord has been asked already. It is all in the record.` };
        if (findActive(s, j => j.kind === 'screen' && j.applicantId === ap.id)) return { ok: false, code: 'busy', reason: 'Enquiries are already being made.' };
        const job = enqueueJob(s, { kind: 'screen', role: role ?? 'steward', buildingId: ap.buildingId, unit: ap.unit, applicantId: ap.id, x: gate[0], y: gate[1], workDays: TUNE.work.screen, cost: TUNE.cost.screen, byRuler: true });
        return { ok: true, id: job.id };
      }
      const t = tenantFor(s, a);
      if (!t) return { ok: false, code: 'not_found', reason: 'There is nobody there to ask about.' };
      if (t.traits.every(tr => t.revealed.includes(tr))) return { ok: false, code: 'invalid', reason: `There is nothing more to learn about ${t.name} that the well has not already said.` };
      if (findActive(s, j => j.kind === 'screen' && j.tenantId === t.id)) return { ok: false, code: 'busy', reason: 'Enquiries are already being made.' };
      const job = enqueueJob(s, { kind: 'screen', role: role ?? 'steward', buildingId: t.buildingId, unit: t.unit, tenantId: t.id, x: gate[0], y: gate[1], workDays: TUNE.work.screen, cost: TUNE.cost.screen, byRuler: true });
      return { ok: true, id: job.id };
    }
    case 'serve_notice': {
      const t = tenantFor(s, a);
      if (!t) return { ok: false, code: 'not_found', reason: 'There is no household there to serve.' };
      if (t.lateStage === 'noticed' || t.lateStage === 'court' || t.lateStage === 'writ') {
        return { ok: false, code: 'invalid', reason: `${t.name} has been served already. The Reeve's Court has it in hand, slowly.` };
      }
      if (!(t.arrears > 0) && t.lateStage !== 'late' && t.lateStage !== 'plan') {
        return { ok: false, code: 'invalid', reason: `${t.name} owes nothing. The Reeve's Court would laugh, and it does not laugh often.` };
      }
      if (findActive(s, j => j.kind === 'serve_notice' && j.tenantId === t.id)) return { ok: false, code: 'busy', reason: 'The notice is already on its way to the door.' };
      const job = enqueueJob(s, { kind: 'serve_notice', role: role ?? 'bailiff', buildingId: t.buildingId, unit: t.unit, tenantId: t.id, workDays: TUNE.work.serve_notice, cost: TUNE.cost.serve_notice, byRuler: true });
      return { ok: true, id: job.id };
    }
    case 'evict': {
      const t = tenantFor(s, a);
      if (!t) return { ok: false, code: 'not_found', reason: 'There is no household there to put out.' };
      const ruled = t.lateStage === 'writ' || (t.courtDay !== null && s.day >= t.courtDay);
      if (!ruled) return { ok: false, code: 'not_ready', reason: `The Reeve's Court has not ruled on ${t.name}. No writ, no eviction.` };
      if (findActive(s, j => j.kind === 'evict' && j.tenantId === t.id)) return { ok: false, code: 'busy', reason: 'That is already in hand. The knock is coming.' };
      const job = enqueueJob(s, { kind: 'evict', role: role ?? 'bailiff', buildingId: t.buildingId, unit: t.unit, tenantId: t.id, workDays: TUNE.work.evict, cost: TUNE.cost.evict, byRuler: true });
      return { ok: true, id: job.id };
    }
    case 'inspect': {
      const home = a.buildingId ?? tenantFor(s, a)?.buildingId ?? null;
      const b = home ? s.buildings[home] : null;
      if (!b) return needBuilding;
      if (b.state === 'building') return { ok: false, code: 'not_ready', reason: `${b.name} is not built yet. There is little to inspect but intentions.` };
      if (findActive(s, j => j.kind === 'inspect' && j.buildingId === b.id)) return { ok: false, code: 'busy', reason: `${b.name} is already due a looking-over.` };
      const job = enqueueJob(s, { kind: 'inspect', role: role ?? 'steward', buildingId: b.id, workDays: TUNE.work.inspect, byRuler: true });
      return { ok: true, id: job.id };
    }
    case 'visit': {
      const t = tenantFor(s, a);
      if (!t) return { ok: false, code: 'not_found', reason: 'There is nobody at home to call on.' };
      if (findActive(s, j => j.kind === 'visit' && j.tenantId === t.id)) return { ok: false, code: 'busy', reason: `${t.first} is expecting you already, and has hidden the good chair.` };
      const job = enqueueJob(s, { kind: 'visit', role: 'ruler', buildingId: t.buildingId, unit: t.unit, tenantId: t.id, workDays: TUNE.work.visit, byRuler: true });
      return { ok: true, id: job.id };
    }
    default:
      return { ok: false, code: 'invalid', reason: 'That is not work that can simply be ordered.' };
  }
}

function cancelJobAction(s: GameState, a: ActionOf<'cancel_job'>): ActionResult {
  const j = s.jobs[a.jobId];
  if (!j || !isActive(j)) return { ok: false, code: 'not_found', reason: 'That work is on nobody\'s list.' };
  if (j.kind === 'build') return { ok: false, code: 'invalid', reason: 'The walls are half up. Pull it down if you must, but it cannot simply be left.' };
  // (an incident's job may be called off: incidents.ts puts the matter back before the ruler)
  cancelJob(s, j.id);
  return { ok: true, id: j.id };
}

/** Queue a collect job for each purse given, walking the shortest round from where the collector stands. */
function queueRound(s: GameState, purses: { buildingId: Id; unit: number }[], byRuler: boolean): number {
  const collector = staffActor(s, 'bailiff') ?? rulerActor(s);
  let cx = collector.x, cy = collector.y;
  const stops: { buildingId: Id; unit: number; door: [number, number] }[] = [];
  for (const p of purses) {
    const already = findActive(s, j => j.kind === 'collect' && j.buildingId === p.buildingId && (j.unit === null || j.unit === p.unit));
    if (!already) { stops.push({ ...p, door: entranceOf(s, s.buildings[p.buildingId]!) }); continue; }
    // somebody is fetching it already; if the ruler now asks in person, it goes to the front of the list
    if (byRuler && !already.byRuler) { already.byRuler = true; already.priority = Math.max(already.priority, TUNE.defaultPriority.collect); }
  }
  let queued = 0;
  while (stops.length) {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < stops.length; i++) {
      const d = Math.hypot(stops[i]!.door[0] - cx, stops[i]!.door[1] - cy);
      if (d < bestD) { bestD = d; best = i; }
    }
    const stop = stops.splice(best, 1)[0]!;
    enqueueJob(s, { kind: 'collect', role: 'bailiff', buildingId: stop.buildingId, unit: stop.unit, x: stop.door[0], y: stop.door[1], workDays: TUNE.work.collect, byRuler });
    cx = stop.door[0]; cy = stop.door[1];
    queued++;
  }
  return queued;
}

function collectPurse(s: GameState, a: ActionOf<'collect_purse'>): ActionResult {
  const b = s.buildings[a.buildingId];
  if (!b) return { ok: false, code: 'not_found', reason: 'No such building stands in the realm.' };
  const purses: { buildingId: Id; unit: number }[] = [];
  b.units.forEach((u, i) => { if (u.purse > 0 && (a.unit === undefined || a.unit === i)) purses.push({ buildingId: b.id, unit: i }); });
  if (!purses.length) return { ok: false, code: 'invalid', reason: `There is no purse on the step at ${b.name}.` };
  queueRound(s, purses, true);
  return { ok: true };
}

function collectAll(s: GameState, _a: ActionOf<'collect_all'>): ActionResult {
  const purses: { buildingId: Id; unit: number }[] = [];
  for (const id in s.buildings) s.buildings[id]!.units.forEach((u, i) => { if (u.purse > 0) purses.push({ buildingId: id, unit: i }); });
  if (!purses.length) return { ok: false, code: 'invalid', reason: `No purses are waiting, ${address(s)}. Rent Day is the first.` };
  queueRound(s, purses, true);
  return { ok: true };
}

/** Queue collect jobs for every purse not yet being fetched (rent.ts may call this for the Bailiff's round). Returns how many were queued. */
export function queueCollectRound(s: GameState, byRuler = false): number {
  const purses: { buildingId: Id; unit: number }[] = [];
  for (const id in s.buildings) s.buildings[id]!.units.forEach((u, i) => { if (u.purse > 0) purses.push({ buildingId: id, unit: i }); });
  return purses.length ? queueRound(s, purses, byRuler) : 0;
}

export const jobsModule: SimModule = {
  name: 'jobs',
  step,
  onDay(s) { sweep(s); },
  handlers: {
    order_job: orderJob,
    cancel_job: cancelJobAction,
    collect_purse: collectPurse,
    collect_all: collectAll,
  },
};
