/**
 * sim-decide tests: incidents, effects, orders, staff.
 *   npx tsx test/sim-decide.test.ts
 *
 * Plain asserts. Most tests run on the hand-built fixture realm so they do not
 * depend on how far the other sim modules have got; the last one runs a full
 * Sim.create() reign for three years.
 */
import assert from 'node:assert/strict';
import { Sim } from '../src/sim/index';
import {
  DAYS_PER_MONTH, RANK_ORDER,
  type GameState, type Building, type Tenant, type Incident, type RankId, type StandingOrder, type Job,
  type SimEvent, type Unit, type Season, type Action, type ActionResult, type StaffRole, type Applicant, type Actor,
} from '../src/sim/types';
import { makeFixtureState } from '../src/dev/fixture';
import { INCIDENTS, INCIDENT_BY_ID } from '../src/data/incidents/index';
import { TEMPERAMENT_DEFS } from '../src/data/temperaments';
import { TRAIT_DEFS } from '../src/data/traits';
import { BUILDINGS } from '../src/data/buildings';
import { BAL } from '../src/data/balance';
import type { IncidentDef, OutcomeDef, Effect } from '../src/data/schema';
import { NPCS, VISUALS, PET_KINDS, SQUATTER_KINDS, TRAITS, TENANT_TAGS, SPECIES, TRADES, type BuildingType } from '../src/data/ids';
import { fill, seasonOf, rankIndex } from '../src/sim/core';
import {
  incidentsModule, spawnIncident, spawnDecision, resolveIncident, openIncidents, incidentsAt, fitsTarget, openCap,
  HOOKS, TUNE as INC_TUNE, type IncidentTarget, type SpawnSource,
} from '../src/sim/incidents';
import { applyEffects, fillText, TUNE as FX, expenseCatFor, incomeCatFor } from '../src/sim/effects';
import { ordersModule, decide, ordersFor, settle, TUNE as ORD_TUNE } from '../src/sim/orders';
import { staffModule, staffOf, temperamentOf, changeLoyalty, rollCandidates, fairWage, experienceOf, TUNE as STAFF_TUNE } from '../src/sim/staff';

// ───────────── harness ─────────────

let failed = 0, passed = 0;
const notes: string[] = [];
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log('ok    ' + name); }
  catch (e) { failed++; console.log('FAIL  ' + name); console.log(e instanceof Error ? (e.stack ?? e.message) : e); }
  finally { setVariantsAside(); HOOKS.onSpawn = null; }                      // whatever a test borrowed is put back before the next
}
function note(text: string): void { notes.push(text); }

// The tests pin the temperaments they lean on, so they hold whatever the content says tonight.
TEMPERAMENT_DEFS.bodger.bias = { repair: ['patch', 'fix'] };
TEMPERAMENT_DEFS.perfectionist.bias = { repair: ['fix'] };
TEMPERAMENT_DEFS.steady.bias = {};
TEMPERAMENT_DEFS.iron.bias = { late_rent: ['notice', 'late_fee'], eviction_ready: ['evict', 'cash_for_keys', 'mercy'], squatters: ['oust'] };
TEMPERAMENT_DEFS.soft.bias = { late_rent: ['payment_plan', 'wait'], eviction_ready: ['mercy'], squatters: ['lease', 'bribe'] };
TEMPERAMENT_DEFS.grasping.bias = { late_rent: ['wait', 'notice'], eviction_ready: ['evict'], squatters: ['oust'] };
TEMPERAMENT_DEFS.snob.bias = { applicant: ['accept'] };
TEMPERAMENT_DEFS.bellower.bias = { applicant: ['accept'] };
TEMPERAMENT_DEFS.pennypincher.bias = { move_out_deposit: ['fair', 'keep_all'], rent_renewal: ['raise', 'hold'], pet: ['pet_rent'], late_rent: ['late_fee'] };
TEMPERAMENT_DEFS.openhanded.bias = { move_out_deposit: ['return_all'], rent_renewal: ['lower', 'hold'], pet: ['allow'] };
for (const t of Object.values(TEMPERAMENT_DEFS)) { t.cost = 1; t.quality = 1; }

// The unit tests speak of the plain system decisions by the ids of their outcomes ('wait', 'notice', 'fix'...).
// Content adds richer variants of the same decisions, with wordings of their own. They are set aside for the
// unit tests (weight 0: never the engine's pick) and put back for the tests that run a whole reign. The first
// test, which spawns every def by name, sees them all either way.
const BASELINE = new Set(['sys_late_rent', 'sys_eviction_ready', 'sys_repair_leak', 'sys_applicant', 'sys_move_out_deposit', 'sys_squatters_goblins', 'sys_rent_renewal', 'sys_pet_found']);
const VARIANT_WEIGHTS = new Map<IncidentDef, number>();
function setVariantsAside(): void { for (const d of INCIDENTS) if (d.system && !BASELINE.has(d.id) && d.weight > 0) { VARIANT_WEIGHTS.set(d, d.weight); d.weight = 0; } }
function putVariantsBack(): void { for (const [d, w] of VARIANT_WEIGHTS) d.weight = w; VARIANT_WEIGHTS.clear(); }
setVariantsAside();

const MODS = [staffModule, incidentsModule, ordersModule];

/** The fixture realm with the table cleared: no incidents, no orders, nothing scheduled. */
function realm(rank: 'reeve' | 'knight' | 'baron' = 'baron', day = 34.4): GameState {
  const s = makeFixtureState(rank, day);
  s.incidents = {}; s.orders = []; s.pending = []; s.incidentLog = {}; s.heralds = []; s._events = []; s.oaths = [];
  for (const b of Object.values(s.buildings)) { b.visuals = []; b.squatters = null; }
  for (const id of Object.keys(s.actors)) if (s.actors[id]!.kind === 'petitioner') delete s.actors[id];
  for (const t of Object.values(s.tenants)) { t.pets = []; t.arrears = 0; t.daysLate = 0; t.lateStage = 'none'; }
  for (const m of Object.values(s.staff)) m.authority = rank === 'baron' ? 1 : 0;
  FX.errors.length = 0;
  return s;
}

function tenantIn(s: GameState, type: BuildingType): Tenant {
  const b = Object.values(s.buildings).find(x => x.type === type && x.state === 'ready' && x.units.some(u => u.tenantId));
  assert.ok(b, 'fixture has an occupied ' + type);
  return s.tenants[b.units.find(u => u.tenantId)!.tenantId!]!;
}
function buildingOf(s: GameState, t: Tenant): Building { return s.buildings[t.buildingId!]!; }
/** A household at the door of the empty hovel, already shown round, with a figure of its own. */
function applicantAt(s: GameState): Applicant {
  const b = Object.values(s.buildings).find(x => x.type === 'hovel' && x.state === 'ready' && !x.units[0]!.tenantId)!;
  const actor: Actor = { id: 'a_test', kind: 'applicant', refId: 'p_test', x: b.x + 0.5, y: b.y + b.h + 0.5, path: [], speed: 5, state: 'waiting', jobId: null, homeX: 0.5, homeY: 12.5, facing: 0 };
  s.actors[actor.id] = actor;
  const a: Applicant = {
    id: 'p_test', buildingId: b.id, unit: 0, arrivedDay: s.day - 1, leavesDay: s.day + 8, maxRent: b.rent + 3, shown: true, screened: false, actorId: actor.id,
    household: { id: 't_test', name: 'Jory Applewhite', first: 'Jory', species: 'human', trade: 'carpenter', character: null, portraitSeed: 4242, household: 3, traits: ['handy', 'haggler'], revealed: [], tags: ['newlyweds'], pets: [], income: 44, reliability: 0.8 },
  };
  s.applicants[a.id] = a;
  return a;
}
function setSeason(s: GameState, season: Season, year = 2): void {
  s.day = (year - 1) * 360 + ['spring', 'summer', 'autumn', 'winter'].indexOf(season) * 90 + 34.4;
}
function heraldText(s: GameState): string { return s.heralds.map(h => h.text).join('\n'); }
function events(s: GameState, type: SimEvent['type']): SimEvent[] { return s._events.filter(e => e.type === type); }

/** Finish the job an in-progress incident is waiting on, as the job system would. */
function finishJob(s: GameState, inc: Incident, by?: StaffRole): void {
  const job = inc.jobId ? s.jobs[inc.jobId] : null;
  assert.ok(job, 'in-progress incident has a job');
  job.state = 'done'; job.progress = 1;
  const worker = by ? staffOf(s, by) : null;
  job.assignee = worker?.actorId ?? Object.values(s.actors).find(a => a.kind === 'ruler')?.id ?? null;
  for (const m of MODS) m.onJobDone?.(s, job as Job);
}

function act(s: GameState, a: Action): ActionResult {
  for (const m of MODS) {
    const h = (m.handlers as Record<string, ((s: GameState, a: Action) => ActionResult) | undefined> | undefined)?.[a.type];
    if (h) return h(s, a);
  }
  throw new Error('no handler in sim-decide modules for ' + a.type);
}

/** Advance only the sim-decide modules, with a stand-in job system that finishes incident jobs on time. */
function drive(s: GameState, days: number, each?: (s: GameState) => void): void {
  const ticks = Math.round(days * 4);
  for (let i = 0; i < ticks; i++) {
    const before = Math.floor(s.day);
    s.day += 0.25;
    for (const m of MODS) m.step?.(s, 0.25);
    for (const j of Object.values(s.jobs)) {
      if (j.kind !== 'incident' || j.state === 'done' || j.state === 'cancelled') continue;
      if (s.day - j.createdDay < j.workDays + 0.5) continue;
      j.state = 'done';
      const role = j.role === 'ruler' || j.role === 'any' ? null : staffOf(s, j.role);
      j.assignee = role?.actorId ?? null;
      for (const m of MODS) m.onJobDone?.(s, j);
      delete s.jobs[j.id];
    }
    const after = Math.floor(s.day);
    for (let d = before + 1; d <= after; d++) {
      for (const m of MODS) m.onDay?.(s, d);
      if (d % DAYS_PER_MONTH === 0) for (const m of MODS) m.onMonth?.(s, d / DAYS_PER_MONTH);
    }
    each?.(s);
    s._events.length = 0;
  }
}

function assertSane(s: GameState, where: string): void {
  assert.ok(Number.isFinite(s.gold), where + ': gold is finite');
  assert.ok(Number.isFinite(s.renown) && s.renown >= 0 && s.renown <= 100, where + ': renown in range');
  assert.ok(Number.isFinite(s.favor) && s.favor >= 0 && s.favor <= 100, where + ': favor in range');
  for (const t of Object.values(s.tenants)) {
    assert.ok(Number.isFinite(t.happiness) && t.happiness >= 0 && t.happiness <= 100, where + ': happiness in range for ' + t.name);
    assert.ok(Number.isFinite(t.arrears), where + ': arrears finite for ' + t.name);
    if (t.lease) assert.ok(Number.isFinite(t.lease.rent) && t.lease.rent >= 0, where + ': rent finite for ' + t.name);
  }
  for (const b of Object.values(s.buildings)) assert.ok(Number.isFinite(b.condition) && b.condition >= 0 && b.condition <= 100, where + ': condition in range for ' + b.name);
  for (const m of Object.values(s.staff)) assert.ok(Number.isFinite(m.loyalty) && m.loyalty >= 0 && m.loyalty <= 100, where + ': loyalty in range for ' + m.name);
}

function order(o: Partial<StandingOrder>): Omit<StandingOrder, 'id' | 'createdDay' | 'uses'> {
  return { to: 'bailiff', text: 'An order.', gist: 'An order. Aye.', decision: null, incidentDef: null, when: [], rule: 'choose', option: null, outcomeId: null, ...o };
}

// ───────────── building a fitting target for any def ─────────────

function addHousehold(s: GameState, b: Building, like: Tenant, n: number): Tenant {
  const id = 'tx' + n;
  const t: Tenant = { ...structuredClone(like), id, name: 'Extra Household ' + n, first: 'Extra', buildingId: b.id, unit: b.units.length };
  const u: Unit = { tenantId: id, vacantSince: null, listed: false, purse: 0, purseDay: 0 };
  b.units.push(u); s.tenants[id] = t;
  return t;
}

/** A realm in which `def.requires` holds, and the target it holds on. */
function fitted(def: IncidentDef): { s: GameState; target: IncidentTarget } {
  const s = realm('baron');
  const r = def.requires ?? {};
  s.realm.rank = def.minRank;
  const year = Math.max(2, (r.yearAbove ?? 0) + 1);
  setSeason(s, def.seasons?.[0] ?? 'spring', year);
  for (const t of Object.values(s.tenants)) { t.movedInDay = s.day - 400; if (t.lease) t.lease.startDay = s.day - 40; }

  if (r.goldAbove !== undefined) s.gold = r.goldAbove + 500;
  if (r.goldBelow !== undefined) s.gold = Math.min(s.gold, r.goldBelow - 5);
  if (r.goldAbove !== undefined && r.goldBelow !== undefined) s.gold = (r.goldAbove + r.goldBelow) / 2;
  if (r.renownAbove !== undefined) s.renown = Math.min(100, r.renownAbove + 5);
  if (r.renownBelow !== undefined) s.renown = Math.max(0, r.renownBelow - 5);
  if (r.favorAbove !== undefined) s.favor = Math.min(100, r.favorAbove + 5);
  if (r.favorBelow !== undefined) s.favor = Math.max(0, r.favorBelow - 5);
  for (const k of r.flag ?? []) s.flags[k] = true;
  for (const k of r.notFlag ?? []) delete s.flags[k];
  if (r.policyPets?.length) s.policies.pets = r.policyPets[0]!;
  for (const role of r.lacksStaff ?? []) for (const m of Object.values(s.staff)) if (m.role === role) { if (m.actorId) delete s.actors[m.actorId]; delete s.staff[m.id]; }
  for (const bt of r.lacksBuilding ?? []) {
    for (const b of Object.values(s.buildings)) {
      if (b.type !== bt) continue;
      for (const u of b.units) if (u.tenantId) { const t = s.tenants[u.tenantId]!; t.status = 'left'; t.buildingId = null; t.leftDay = s.day - 1; }
      for (const tile of s.map.tiles) if (tile.b === b.id) tile.b = null;
      delete s.buildings[b.id];
    }
  }

  const wantsType = (b: Building): boolean => (!r.buildingType || r.buildingType.includes(b.type))
    && (!r.buildingCategory || r.buildingCategory.includes(BUILDINGS[b.type].category));
  const ready = Object.values(s.buildings).filter(b => b.state === 'ready');
  const dress = (b: Building): void => {
    if (r.conditionBelow !== undefined) b.condition = Math.max(1, r.conditionBelow - 5);
    if (r.conditionAbove !== undefined) b.condition = Math.min(100, r.conditionAbove + 5);
    if (r.conditionBelow !== undefined && r.conditionAbove !== undefined) b.condition = (r.conditionBelow + r.conditionAbove) / 2;
    for (const k of r.buildingFlag ?? []) b.flags[k] = true;
    for (const k of r.notBuildingFlag ?? []) delete b.flags[k];
  };

  let target: IncidentTarget = {};
  if (def.target === 'tenant') {
    const homes = ready.filter(b => wantsType(b) && b.units.some(u => u.tenantId));
    const b = homes.find(x => BUILDINGS[x.type].category === 'housing') ?? homes[0];
    if (b) {
      const t = s.tenants[b.units.find(u => u.tenantId)!.tenantId!]!;
      if (r.species?.length) t.species = r.species[0]!;
      if (r.trade?.length) t.trade = r.trade[0]!;
      if (r.trait?.length && !t.traits.includes(r.trait[0]!)) t.traits.push(r.trait[0]!);
      if (r.tag?.length && !t.tags.includes(r.tag[0]!)) t.tags.push(r.tag[0]!);
      if (r.pet?.length) t.pets = [r.pet[0]!];
      else if (r.hasPet === true) t.pets = ['cat'];
      else if (r.hasPet === false) t.pets = [];
      if (r.happinessBelow !== undefined) t.happiness = Math.max(0, r.happinessBelow - 8);
      if (r.happinessAbove !== undefined) t.happiness = Math.min(100, r.happinessAbove + 8);
      if (r.happinessBelow !== undefined && r.happinessAbove !== undefined) t.happiness = (r.happinessBelow + r.happinessAbove) / 2;
      if (r.monthsHousedAbove !== undefined) t.movedInDay = s.day - (r.monthsHousedAbove + 2) * 30;
      if (t.lease) t.lease.deposit = Math.max(t.lease.deposit, 10);
      dress(b);
      target = { tenantId: t.id, buildingId: b.id, unit: t.unit };
    }
  } else if (def.target === 'building') {
    const named = !!(r.buildingType || r.buildingCategory);
    const pool = ready.filter(b => wantsType(b) && (named || BUILDINGS[b.type].category === 'housing'));
    const b = pool.find(x => x.units.some(u => u.tenantId)) ?? pool[0];
    if (b) { dress(b); target = { buildingId: b.id }; }
  } else if (def.target === 'vacant') {
    const named = !!(r.buildingType || r.buildingCategory);
    const pool = ready.filter(b => wantsType(b) && b.units.length > 0 && (named || BUILDINGS[b.type].category === 'housing'));
    const b = pool[0];
    if (b) {
      const u = b.units[0]!;
      if (u.tenantId) { const t = s.tenants[u.tenantId]!; t.status = 'left'; t.buildingId = null; t.leftDay = s.day - 1; u.tenantId = null; }
      u.vacantSince = s.day - (r.vacantDaysAbove ?? 10) - 5; u.listed = true; u.purse = 0;
      for (const a of Object.values(s.applicants)) if (a.buildingId === b.id && a.unit === 0) { if (a.actorId) delete s.actors[a.actorId]; delete s.applicants[a.id]; }
      dress(b);
      target = { buildingId: b.id, unit: 0 };
    }
  }
  // a system applicant decision is always asked about an applicant at the door
  if (def.decision === 'applicant' && def.system) {
    const a = applicantAt(s);
    {
      a.shown = true;
      if (r.species?.length) a.household.species = r.species[0]!;
      if (r.trade?.length) a.household.trade = r.trade[0]!;
      if (r.trait?.length) a.household.traits = [r.trait[0]!];
      if (r.tag?.length) a.household.tags = [r.tag[0]!];
      const b = s.buildings[a.buildingId]!;
      if (r.vacantDaysAbove !== undefined) b.units[a.unit]!.vacantSince = s.day - r.vacantDaysAbove - 5;
      if (wantsType(b)) { dress(b); target = { applicantId: a.id, buildingId: a.buildingId, unit: a.unit }; }
    }
  }
  if (r.householdsAbove !== undefined) {
    const like = tenantIn(s, 'cottage'); const b = buildingOf(s, like);
    let n = 0;
    while (Object.values(s.tenants).filter(t => t.status === 'housed').length <= r.householdsAbove && n < 200) addHousehold(s, b, like, n++);
  }
  return { s, target };
}

const TEXT_BAD = /\{|\}|undefined|NaN|\[object|  /;

// ═════════════ 1. every incident def ═════════════

test('every incident def spawns on a fitting target; every outcome resolves; every one can expire', () => {
  let outcomes = 0, expiries = 0;
  const unfit: string[] = [];
  const problems: string[] = [];                                             // every def is tried; all that fail are named together
  const runDef = (def: IncidentDef): void => {
    const probe = fitted(def);
    if (!fitsTarget(probe.s, def, probe.target)) unfit.push(def.id);

    for (const o of def.outcomes) {
      const { s, target } = fitted(def);
      const inc = spawnIncident(s, def.id, target, { _ruler: 1 });       // _ruler: keep the household's hands off it
      assert.ok(inc, `spawns on its fitted target`);
      assert.equal(inc.state, 'open', `waits for the ruler`);
      const line = fillText(def.herald, inc.vars);
      assert.ok(line.length > 0 && !TEXT_BAD.test(line), `herald reads cleanly: "${line}"`);
      assert.ok(s.heralds.some(h => h.text === line), `the herald line was sent`);
      for (const op of def.opening ?? []) assert.ok(!TEXT_BAD.test(fill(op, inc.vars)), `opening reads cleanly: "${fill(op, inc.vars)}"`);
      for (const text of [o.label, o.say, o.reply, o.result]) assert.ok(!TEXT_BAD.test(fill(text, inc.vars)), `${o.id}: text reads cleanly: "${fill(text, inc.vars)}"`);
      if (def.visual && inc.buildingId) assert.ok(s.buildings[inc.buildingId]!.visuals.includes(def.visual), `its visual is on the building`);
      if (def.audience && def.petitioner && def.petitioner !== 'staff' && inc.actorId) {
        const a = s.actors[inc.actorId]!;
        assert.ok(a.kind === 'petitioner' || a.kind === 'applicant', 'a petitioner came');
      }

      const r = resolveIncident(s, inc.id, o.id, 'ruler');
      assert.ok(r.ok, `${o.id}: resolves (${r.ok ? '' : r.reason})`);
      if (o.job) {
        assert.equal(inc.state, 'in_progress', `${o.id}: a job is under way`);
        finishJob(s, inc);
      }
      assert.equal(inc.state, 'resolved', `${o.id}: is resolved`);
      assert.equal(inc.outcomeId, o.id);
      assert.equal(inc.resolvedBy, 'ruler');
      assert.equal(inc.actorId, null, `${o.id}: the petitioner was released`);
      assertSane(s, `${def.id}.${o.id}`);
      const again = resolveIncident(s, inc.id, o.id, 'ruler');
      assert.ok(!again.ok && again.reason.length > 0, `${o.id}: cannot be resolved twice, and says why`);
      drive(s, 3);                                                           // the days after: follow-ups, sweeping, nobody left standing at court
      assertSane(s, `${def.id}.${o.id}, three days on`);
      outcomes++;
    }

    // and the road not taken: nobody rules
    const { s, target } = fitted(def);
    const inc = spawnIncident(s, def.id, target, { _ruler: 1 });
    assert.ok(inc, `spawns for the expiry run`);
    const ignoredBefore = s.stats.incidentsIgnored;
    inc.expiresDay = s.day - 0.01;
    incidentsModule.step!(s, 0.01);
    assert.equal(inc.state, 'expired', `expires`);
    assert.equal(s.stats.incidentsIgnored, ignoredBefore + 1);
    if (def.expireText) assert.ok(!TEXT_BAD.test(fill(def.expireText, inc.vars)), `expire text reads cleanly`);
    assertSane(s, `${def.id} expiry`);
    expiries++;
  };
  for (const def of INCIDENTS) {
    try { runDef(def); }
    catch (e) { problems.push(`${def.id}: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`); }
  }
  assert.deepEqual(problems.slice(0, 15), [], `${problems.length} incident def(s) did not go through cleanly`);
  for (const id of ['sys_late_rent', 'sys_eviction_ready', 'sys_repair_leak', 'sys_applicant', 'sys_move_out_deposit', 'sys_squatters_goblins', 'sys_rent_renewal', 'sys_pet_found', 'unauthorized_griffin', 'purple_tower']) {
    assert.ok(INCIDENT_BY_ID[id], `${id} exists`);
    assert.ok(!unfit.includes(id), `${id}: the fitted target satisfies its requires`);
  }
  console.log(`      ${INCIDENTS.length} defs, ${outcomes} outcomes resolved, ${expiries} expiries`);
  if (unfit.length) note(`${unfit.length} def(s) whose requires the test could not satisfy by hand (still spawned and resolved): ${unfit.slice(0, 12).join(', ')}`);
  if (FX.errors.length) {
    const mine = FX.errors.filter(e => /src\/sim\/(effects|incidents|orders|staff)\.ts/.test(e.error.split('\n')[1] ?? ''));
    note(`${FX.errors.length} effect(s) threw inside an owning module and were skipped. First: ${FX.errors[0]!.effect}: ${FX.errors[0]!.error.split('\n').slice(0, 3).join(' | ')}`);
    assert.equal(mine.length, 0, 'no effect throws from inside sim-decide code: ' + (mine[0]?.error ?? ''));
  }
});

test('follow-ups in the real book: a spawn effect brings the same household and the same roof forward', () => {
  type SpawnFx = Extract<Effect, { t: 'spawn' }>;
  let links = 0, arrived = 0;
  const unknown: string[] = [], wrong: string[] = [], lost: string[] = [];
  for (const def of INCIDENTS.slice()) {
    const runs = [...def.outcomes.map(o => ({ id: o.id, effects: o.effects, outcome: o as OutcomeDef | null })), { id: '(ignored)', effects: def.onExpire, outcome: null }];
    for (const run of runs) {
      for (const e of run.effects.filter((x): x is SpawnFx => x.t === 'spawn')) {
        const name = `${def.id}.${run.id} -> ${e.id}`;
        const dst = INCIDENT_BY_ID[e.id];
        if (!dst) { unknown.push(name); continue; }
        links++;
        let rolled = false;
        for (let attempt = 0; attempt < 60 && !rolled; attempt++) {                // a follow-up with a `chance` is rolled for
          const { s, target } = fitted(def);
          s.rng = (s.rng + attempt * 7919) >>> 0;
          const inc = spawnIncident(s, def.id, target, { _ruler: 1 });
          if (!inc) break;
          const before = new Set(Object.keys(s.incidents));
          if (run.outcome) { if (!resolveIncident(s, inc.id, run.outcome.id, 'ruler').ok) break; if (run.outcome.job) finishJob(s, inc); }
          else { inc.expiresDay = s.day - 0.01; incidentsModule.step!(s, 0.01); }
          const p = s.pending.find(x => x.defId === e.id);
          if (!p) continue;
          rolled = true;
          if (inc.tenantId && p.tenantId !== inc.tenantId) wrong.push(`${name}: promised to ${p.tenantId}, not ${inc.tenantId}`);
          if (inc.buildingId && p.buildingId !== inc.buildingId) wrong.push(`${name}: promised at ${p.buildingId}, not ${inc.buildingId}`);
          const t = inc.tenantId ? s.tenants[inc.tenantId]! : null;
          const stayed = !!t && t.status === 'housed';
          s.day = p.day + 0.01; incidentsModule.step!(s, 0.01);                  // the day comes
          const next = Object.values(s.incidents).find(i => i.defId === e.id && !before.has(i.id));
          if (!next) {
            // the one honest reason: it was about a household, and they have gone (or there never was one)
            if (!(dst.target === 'tenant' && !stayed)) lost.push(name);
            continue;
          }
          arrived++;
          if (dst.target === 'realm') continue;
          if (inc.buildingId && next.buildingId !== inc.buildingId) wrong.push(`${name}: landed at ${next.buildingId}, not ${inc.buildingId}`);
          if (dst.target === 'tenant' && next.tenantId !== inc.tenantId) wrong.push(`${name}: landed on ${next.tenantId}, not ${inc.tenantId}`);
          if (dst.target === 'building' && stayed && t!.buildingId === inc.buildingId && next.tenantId !== inc.tenantId) wrong.push(`${name}: the roof is right but the household is ${next.tenantId}, not ${inc.tenantId}`);
          if (dst.target !== 'vacant' && next.tenantId) assert.equal(next.vars.tenant, s.tenants[next.tenantId]!.name, `${name}: and it names them`);
          if (def.id === 'unauthorized_griffin' && e.id === 'griffin_sheep_claim') {
            assert.equal(next.tenantId, inc.tenantId, 'the sheep are claimed against the household with the griffin');
            assert.ok(s.tenants[next.tenantId!]!.pets.includes('griffin'), `${name}: who do keep a griffin`);
          }
        }
        if (!rolled) lost.push(name + ' (never rolled in 60 tries)');
      }
    }
  }
  console.log(`      ${links} follow-up links in the book, ${arrived} arrived on the same household and roof`);
  if (unknown.length) note(`${unknown.length} spawn effect(s) name an incident that is not in the book (the engine skips them): ${unknown.slice(0, 8).join(', ')}`);
  assert.deepEqual(wrong.slice(0, 10), [], 'every follow-up lands where it was promised');
  assert.deepEqual(lost.slice(0, 10), [], 'and none is lost on the way');
  assert.ok(INCIDENT_BY_ID['griffin_sheep_claim'] && arrived > 0);

  // a household that leaves before the day takes a matter about them with it; a matter about the roof falls to whoever is under it
  const s = realm('baron');
  const t = tenantIn(s, 'cottage'); const b = buildingOf(s, t);
  applyEffects(s, [{ t: 'spawn', id: 'griffin_sheep_claim', delayDays: 5 }, { t: 'spawn', id: 'sys_repair_leak', delayDays: 5 }], { buildingId: b.id, tenantId: t.id });
  assert.equal(s.pending.filter(p => p.tenantId === t.id && p.buildingId === b.id).length, 2);
  s.day += 2; t.status = 'left'; t.leftDay = s.day; t.buildingId = null;
  for (const u of b.units) if (u.tenantId === t.id) { u.tenantId = null; u.vacantSince = s.day; }
  s.day += 4; incidentsModule.step!(s, 0.01);
  assert.equal(Object.values(s.incidents).filter(i => i.defId === 'griffin_sheep_claim').length, 0, 'no sheep claim against a household that has gone');
  const leak = Object.values(s.incidents).find(i => i.defId === 'sys_repair_leak');
  assert.ok(leak && leak.buildingId === b.id && leak.tenantId !== t.id, 'the roof still leaks, on whoever is there now');
});

// ═════════════ 2. standing orders ═════════════

test('"never evict a widow in winter" strikes evict, and only then', () => {
  const mk = (season: Season, widow: boolean): { s: GameState; t: Tenant } => {
    const s = realm('baron'); setSeason(s, season);
    const t = tenantIn(s, 'cottage');
    t.tags = widow ? ['widow'] : ['veteran'];
    t.arrears = 30; t.daysLate = 50; t.lateStage = 'writ';
    const r = act(s, { type: 'add_order', order: order({
      to: 'bailiff', text: 'Never evict a widow in winter.', gist: 'No widows out in winter. Aye.', decision: 'eviction_ready', rule: 'never', option: 'evict',
      when: [{ field: 'tenant.tags', op: 'includes', value: 'widow' }, { field: 'season', op: '==', value: 'winter' }],
    }) });
    assert.ok(r.ok);
    return { s, t };
  };
  // Agnes is Iron: left to herself she evicts. She has authority (Baron).
  {
    const { s, t } = mk('winter', true);
    assert.equal(staffOf(s, 'bailiff')!.temperament, 'iron');
    const inc = spawnDecision(s, 'eviction_ready', { tenantId: t.id })!;
    assert.ok(inc);
    assert.equal(ordersFor(s, { ...inc, state: 'open' }).length, 1, 'the order applies');
    assert.notEqual(inc.outcomeId, 'evict', 'evict was struck');
    assert.equal(inc.outcomeId, 'cash_for_keys', 'the Iron bailiff fell to her next preference');
    assert.equal(inc.resolvedBy, 'bailiff');
    assert.ok(inc.reported);
    // the order did its work, and the ruler can see that it did
    assert.equal(s.orders[0]!.uses, 1);
    assert.deepEqual(events(s, 'order_used'), [{ type: 'order_used', orderId: s.orders[0]!.id, incidentId: inc.id }]);
    assert.match(heraldText(s), new RegExp(`^Held to your standing order, Agnes paid ${t.name} to hand back the keys\\.$`, 'm'));
  }
  {
    const { s, t } = mk('summer', true);
    const inc = spawnDecision(s, 'eviction_ready', { tenantId: t.id })!;
    assert.equal(ordersFor(s, { ...inc, state: 'open' }).length, 0, 'not in summer');
    assert.equal(inc.outcomeId, 'evict');
    assert.equal(inc.state, 'in_progress', 'the eviction is a job');
    assert.equal(s.orders[0]!.uses, 0, 'an order that did not apply was not used');
    assert.ok(!/Held to/.test(heraldText(s)));
  }
  {
    const { s, t } = mk('winter', false);
    const inc = spawnDecision(s, 'eviction_ready', { tenantId: t.id })!;
    assert.equal(inc.outcomeId, 'evict', 'a veteran is not a widow');
  }
  {
    // with every option struck, nobody decides: it waits for the ruler
    const { s, t } = mk('winter', true);
    act(s, { type: 'add_order', order: order({ decision: 'eviction_ready', rule: 'never', option: 'cash_for_keys' }) });
    act(s, { type: 'add_order', order: order({ decision: 'eviction_ready', rule: 'never', option: 'mercy' }) });
    const inc = spawnDecision(s, 'eviction_ready', { tenantId: t.id })!;
    assert.equal(inc.state, 'open');
    assert.equal(decide(s, inc), null);
    // the ruler may still do what the order forbids the household
    assert.ok(resolveIncident(s, inc.id, 'evict', 'ruler').ok);
  }
});

test('a choose order settles it: most specific first, then newest; uses, events, one staff herald', () => {
  const s = realm('knight');
  const t = tenantIn(s, 'hovel'); const b = buildingOf(s, t);
  act(s, { type: 'add_order', order: order({ to: 'mason', text: 'Patch everything.', gist: 'Patch the lot.', decision: 'repair', rule: 'choose', option: 'patch' }) });
  const general = s.orders[0]!;
  act(s, { type: 'add_order', order: order({ to: 'mason', text: 'Mend hovels properly.', gist: 'Hovels get proper work.', decision: 'repair', rule: 'choose', option: 'fix', when: [{ field: 'building.type', op: '==', value: 'hovel' }] }) });
  const specific = s.orders[1]!;
  s.heralds = []; s._events = [];
  const inc = spawnDecision(s, 'repair', { buildingId: b.id })!;
  assert.equal(inc.outcomeId, 'fix', 'the order with a condition beats the general one');
  assert.equal(inc.resolvedBy, 'order');
  assert.equal(inc.state, 'in_progress');
  assert.ok(inc.reported);
  assert.equal(specific.uses, 1); assert.equal(general.uses, 0);
  assert.equal(events(s, 'order_used').length, 1);
  assert.equal(events(s, 'incident').length, 0, 'the ruler is not rung for it');
  const staffLines = s.heralds.filter(h => h.kind === 'staff');
  assert.equal(staffLines.length, 1, 'one line in the feed');
  assert.match(staffLines[0]!.text, /^By your standing order, Hob set about mending /);
  assert.ok(!s.heralds.some(h => h.text.includes('is leaking')), 'the alarm was not raised for a thing already handled');
  assert.equal(inc.tenantId, t.id, 'a building incident carries its occupant');
  finishJob(s, inc, 'mason');
  assert.equal(inc.state, 'resolved');
  assert.ok(s.heralds.some(h => h.text.includes('was mended and holds')), 'the result is reported when the work is done');

  // elsewhere the general order rules
  const other = tenantIn(s, 'cottage');
  const inc2 = spawnDecision(s, 'repair', { buildingId: other.buildingId! })!;
  assert.equal(inc2.outcomeId, 'patch');
  assert.equal(general.uses, 1);

  // newest wins between equals
  act(s, { type: 'add_order', order: order({ to: 'mason', text: 'On second thought, leave things.', gist: 'Leave it.', decision: 'repair', rule: 'choose', option: 'defer' }) });
  const third = tenantIn(s, 'burrow');
  const inc3 = spawnDecision(s, 'repair', { buildingId: third.buildingId! })!;
  assert.equal(inc3.outcomeId, 'defer');

  // an order naming one incident and one outcome beats a decision-wide order
  const s2 = realm('reeve');
  const g = tenantIn(s2, 'hovel');
  act(s2, { type: 'add_order', order: order({ to: 'all', decision: 'pet', rule: 'choose', option: 'ban' }) });
  act(s2, { type: 'add_order', order: order({ to: 'all', incidentDef: 'unauthorized_griffin', rule: 'choose', outcomeId: 'allow' }) });
  const gi = spawnIncident(s2, 'unauthorized_griffin', { tenantId: g.id })!;
  assert.equal(gi.outcomeId, 'allow');
  assert.equal(gi.resolvedBy, 'order');
  assert.match(heraldText(s2), /By your standing order, your household let .* keep the griffin\./, 'with no delegate the household is credited');
  assert.ok(g.pets.includes('griffin'));
  assert.ok(buildingOf(s2, g).visuals.includes('griffin_roof'), 'Gerald stays on the roof for as long as Gerald stays');
});

test('conditions: every field and operator', () => {
  const s = realm('baron'); setSeason(s, 'winter');
  const t = tenantIn(s, 'cottage'); const b = buildingOf(s, t);
  Object.assign(t, { species: 'dwarf', trade: 'hedge_witch', tags: ['widow', 'elder'], traits: ['litigious', 'deadbeat'], revealed: ['litigious'], pets: ['cat'], household: 4, happiness: 40, arrears: 12, daysLate: 9, name: 'Old Marta Thistlewick', first: 'Marta' });
  t.movedInDay = s.day - 95;
  b.condition = 44; b.rent = 16; s.gold = 300; s.renown = 61;
  const inc = spawnIncident(s, 'sys_late_rent', { tenantId: t.id }, { _ruler: 1 })!;
  const yes = (field: string, op: string, value: string | number | boolean): void => {
    s.orders = [{ id: 'x', createdDay: 0, uses: 0, ...order({ decision: 'late_rent', option: 'wait', when: [{ field, op, value } as StandingOrder['when'][number]] }) }];
    assert.equal(ordersFor(s, inc).length, 1, `expected true: ${field} ${op} ${value}`);
  };
  const no = (field: string, op: string, value: string | number | boolean): void => {
    s.orders = [{ id: 'x', createdDay: 0, uses: 0, ...order({ decision: 'late_rent', option: 'wait', when: [{ field, op, value } as StandingOrder['when'][number]] }) }];
    assert.equal(ordersFor(s, inc).length, 0, `expected false: ${field} ${op} ${value}`);
  };
  yes('season', '==', 'winter'); no('season', '==', 'summer'); yes('season', '!=', 'summer'); yes('season', '==', 'Winter');
  yes('month', '==', 'Deepwinter'); yes('month', '==', 'deepwinter'); no('month', '==', 'Highsun'); yes('month', '>=', 9); yes('month', '==', 10); no('month', '<', 9);
  yes('gold', '>', 299); no('gold', '<', 100); yes('renown', '>=', 61); no('renown', '>', 61);
  yes('cost', '<', 5); no('cost', '>', 2);                                   // the usual way with late rent is the Bailiff's notice: 2 crowns
  yes('tenant.species', '==', 'dwarf'); yes('tenant.species', '==', 'Dwarves'); no('tenant.species', '==', 'goblin'); yes('tenant.species', '!=', 'goblin');
  yes('tenant.trade', '==', 'hedge witch'); yes('tenant.trade', 'includes', 'witch'); no('tenant.trade', 'excludes', 'witch');
  yes('tenant.tags', 'includes', 'widow'); yes('tenant.tags', '==', 'widows'); no('tenant.tags', 'includes', 'veteran'); yes('tenant.tags', 'excludes', 'veteran'); no('tenant.tags', 'excludes', 'elder');
  yes('tenant.traits', 'includes', 'litigious'); no('tenant.traits', 'includes', 'deadbeat');   // hidden traits are not grounds for an order
  yes('tenant.monthsHoused', '>=', 3); no('tenant.monthsHoused', '>', 3);
  yes('tenant.daysLate', '>', 5); yes('tenant.arrears', '>=', 12); no('tenant.arrears', '>', 12);
  yes('tenant.happiness', '<', 50); yes('tenant.household', '==', 4); yes('tenant.household', '>', '3');
  yes('tenant.hasPets', '==', true); no('tenant.hasPets', '==', false); yes('tenant.hasPets', '==', 'true'); yes('tenant.hasPets', '!=', false);
  yes('tenant.name', '==', 'Marta'); yes('tenant.name', '==', 'old marta thistlewick'); yes('tenant.name', 'includes', 'Thistle'); no('tenant.name', '==', 'Wat');
  yes('building.type', '==', 'cottage'); no('building.type', '==', 'hovel'); yes('building.condition', '<', 50); yes('building.id', '==', b.id); yes('building.rent', '<=', 16);
  no('tenant.happiness', '==', 'cheerful');                                  // nonsense is false, not a throw

  // an order about tenants does not apply where there is no tenant
  const empty = Object.values(s.buildings).find(x => x.type === 'hovel' && !x.units[0]!.tenantId)!;
  const leak = spawnIncident(s, 'sys_repair_leak', { buildingId: empty.id }, { _ruler: 1 })!;
  s.orders = [{ id: 'y', createdDay: 0, uses: 0, ...order({ decision: 'repair', option: 'fix', when: [{ field: 'tenant.species', op: '!=', value: 'goblin' }] }) }];
  assert.equal(ordersFor(s, leak).length, 0);
  // cost is the price of the usual remedy (the proper mend: 9), whatever the rule would do instead:
  // "if mending costs more than five, patch it" is about the mending
  s.orders = [{ id: 'z', createdDay: 0, uses: 0, ...order({ decision: 'repair', option: 'patch', when: [{ field: 'cost', op: '>', value: 5 }] }) }];
  assert.equal(ordersFor(s, leak).length, 1, 'the proper mend costs 9, which is more than 5');
  s.orders = [{ id: 'z', createdDay: 0, uses: 0, ...order({ decision: 'repair', option: 'patch', when: [{ field: 'cost', op: '<=', value: 3 }] }) }];
  assert.equal(ordersFor(s, leak).length, 0, 'it is not the price of the patch that is asked about');
  s.orders = [{ id: 'z', createdDay: 0, uses: 0, ...order({ decision: 'repair', option: 'fix', when: [{ field: 'cost', op: '<=', value: 9 }] }) }];
  assert.equal(ordersFor(s, leak).length, 1);
});

test('add_order validates its shape, is idempotent, caps at 40; revoke; set_policy clamps', () => {
  const s = realm('knight');
  const bad = (o: unknown): void => { const r = act(s, { type: 'add_order', order: o as never }); assert.ok(!r.ok, 'refused: ' + JSON.stringify(o)); assert.ok(r.reason.length > 5 && !/undefined/.test(r.reason)); };
  bad(undefined);
  bad(order({ to: 'gardener' as never, decision: 'repair', option: 'fix' }));
  bad(order({ text: '   ', decision: 'repair', option: 'fix' }));
  bad(order({ decision: null, incidentDef: null, option: 'fix' }));                    // governs nothing
  bad(order({ decision: 'repair', option: 'evict' }));                                 // not a repair option
  bad(order({ decision: 'repair', option: null, outcomeId: null }));                   // says nothing
  bad(order({ decision: 'weddings' as never, option: 'fix' }));
  bad(order({ incidentDef: 'no_such_incident', outcomeId: 'x' }));
  bad(order({ incidentDef: 'unauthorized_griffin', outcomeId: 'no_such_outcome' }));
  bad(order({ incidentDef: 'unauthorized_griffin', decision: 'repair', option: 'fix' }));
  bad(order({ decision: 'repair', option: 'fix', rule: 'sometimes' as never }));
  bad(order({ decision: 'repair', option: 'fix', when: [{ field: 'tenant.shoe_size' as never, op: '==', value: 9 }] }));
  bad(order({ decision: 'repair', option: 'fix', when: [{ field: 'gold', op: '~' as never, value: 9 }] }));
  bad(order({ decision: 'repair', option: 'fix', when: [{ field: 'gold', op: '>', value: 'lots' }] }));
  bad(order({ decision: 'repair', option: 'fix', when: new Array(7).fill({ field: 'gold', op: '>', value: 1 }) }));
  assert.equal(s.orders.length, 0);

  s._events = [];
  const ok = act(s, { type: 'add_order', order: order({ to: 'mason', text: 'Mend leaks properly when we can afford it.', gist: 'Proper mending when the coffers allow.', decision: 'repair', option: 'fix', when: [{ field: 'gold', op: '>', value: '50' }] }) });
  assert.ok(ok.ok && ok.id);
  assert.equal(s.orders.length, 1);
  assert.equal(s.orders[0]!.when[0]!.value, 50, 'numeric conditions are stored as numbers');
  assert.equal(s.orders[0]!.uses, 0); assert.equal(s.orders[0]!.createdDay, s.day);
  assert.equal(events(s, 'order_added').length, 1);
  const twice = act(s, { type: 'add_order', order: order({ to: 'mason', text: 'Again.', gist: 'Again.', decision: 'repair', option: 'fix', when: [{ field: 'gold', op: '>', value: 50 }] }) });
  assert.ok(twice.ok && twice.id === ok.id, 'saying it twice changes nothing');
  assert.equal(s.orders.length, 1);

  for (let i = 0; s.orders.length < ORD_TUNE.maxOrders; i++) {
    assert.ok(act(s, { type: 'add_order', order: order({ decision: 'late_rent', option: 'wait', when: [{ field: 'tenant.arrears', op: '>', value: i }] }) }).ok);
  }
  const full = act(s, { type: 'add_order', order: order({ decision: 'late_rent', option: 'forgive' }) });
  assert.ok(!full.ok && full.code === 'blocked');
  assert.match(full.reason, /full/);

  s._events = [];
  assert.ok(!act(s, { type: 'revoke_order', orderId: 'nope' }).ok);
  assert.ok(act(s, { type: 'revoke_order', orderId: ok.id! }).ok);
  assert.equal(s.orders.length, ORD_TUNE.maxOrders - 1);
  assert.equal(events(s, 'order_revoked').length, 1);

  assert.ok(!act(s, { type: 'set_policy', policy: {} }).ok);
  assert.ok(!act(s, { type: 'set_policy', policy: { pets: 'sometimes' as never } }).ok);
  assert.ok(act(s, { type: 'set_policy', policy: { graceDays: 99, lateFeePct: -4, depositMonths: 1.74, askPct: 10, renewalCapPct: 500, pets: 'ban', screening: 'always' } }).ok);
  assert.deepEqual(s.policies, { graceDays: 14, lateFeePct: 0, depositMonths: 1.5, askPct: 50, renewalCapPct: 50, pets: 'ban', screening: 'always' });
  assert.ok(act(s, { type: 'set_policy', policy: { graceDays: 2.6 } }).ok);
  assert.equal(s.policies.graceDays, 3);
  assert.ok(s.heralds.some(h => /Let it be known/.test(h.text) && /3 days of grace/.test(h.text)));
});

// ═════════════ 3. temperament and authority ═════════════

test('temperament picks: routine dispatch at authority 0, audiences from authority 1, never past the coffers', () => {
  // Knight: Hob the Bodger patches. Nobody asked him to.
  const s = realm('knight');
  const hob = staffOf(s, 'mason')!;
  assert.equal(hob.temperament, 'bodger'); assert.equal(hob.authority, 0);
  assert.equal(temperamentOf(s, 'mason')!.id, 'bodger');
  const t = tenantIn(s, 'hovel');
  const leak = spawnDecision(s, 'repair', { buildingId: t.buildingId! })!;
  assert.equal(leak.outcomeId, 'patch'); assert.equal(leak.resolvedBy, 'mason'); assert.equal(leak.state, 'in_progress');
  assert.equal(s.jobs[leak.jobId!]!.role, 'mason'); assert.equal(s.jobs[leak.jobId!]!.kind, 'incident');
  assert.match(heraldText(s), /^Hob patched up .* with what was to hand/m);
  assert.ok(leak.reported);

  // a Steady mason has no habits: the default remedy
  const s2 = realm('knight'); staffOf(s2, 'mason')!.temperament = 'steady';
  const leak2 = spawnDecision(s2, 'repair', { buildingId: tenantIn(s2, 'hovel').buildingId! })!;
  assert.equal(leak2.outcomeId, 'fix');

  // an order outranks the habit
  const s3 = realm('knight');
  act(s3, { type: 'add_order', order: order({ to: 'mason', text: 'No patch jobs.', gist: 'No straw and prayers.', decision: 'repair', rule: 'never', option: 'patch' }) });
  const leak3 = spawnDecision(s3, 'repair', { buildingId: tenantIn(s3, 'hovel').buildingId! })!;
  assert.equal(leak3.outcomeId, 'fix', 'patch struck: the Bodger falls back to the next thing he would do');
  assert.equal(leak3.resolvedBy, 'mason');

  // authority 0 does not rule on audiences: late rent waits for the Knight
  const s4 = realm('knight');
  const late = tenantIn(s4, 'cottage'); late.arrears = 16; late.daysLate = 6; late.lateStage = 'late';
  const li = spawnDecision(s4, 'late_rent', { tenantId: late.id })!;
  assert.equal(li.state, 'open'); assert.equal(decide(s4, li), null);
  assert.ok(events(s4, 'incident').length === 1 && s4.heralds.some(h => h.kind === 'urgent'), 'the ruler is told');
  // ...until the ruler is a Baron
  s4.realm.rank = 'baron';
  staffModule.onDay!(s4, Math.floor(s4.day) + 1);
  assert.equal(staffOf(s4, 'bailiff')!.authority, 1);
  assert.equal(li.outcomeId, 'notice', 'Agnes went through the pile the day she got the authority');
  assert.equal(li.resolvedBy, 'bailiff');
  assert.match(heraldText(s4), /^Agnes served notice on /m);
  assert.match(heraldText(s4), /may now rule on matters in their own domains/);

  // Soft Tom does it his way
  const s5 = realm('baron'); staffOf(s5, 'bailiff')!.temperament = 'soft';
  const l5 = tenantIn(s5, 'cottage'); l5.arrears = 16;
  assert.equal(spawnDecision(s5, 'late_rent', { tenantId: l5.id })!.outcomeId, 'payment_plan');

  // no delegate spends what the coffers do not hold; the morning after they do, the work is taken up
  const s6 = realm('knight'); s6.gold = 1;
  const l6 = spawnDecision(s6, 'repair', { buildingId: tenantIn(s6, 'hovel').buildingId! })!;
  assert.equal(l6.state, 'open', 'patch costs 3, fix 9, the coffers hold 1');
  s6.gold = 5;
  ordersModule.onDay!(s6, Math.floor(s6.day) + 1);
  assert.equal(l6.outcomeId, 'patch');

  // house policy on animals guides the Steward before habit does
  const s7 = realm('baron'); s7.policies.pets = 'ban';
  const p7 = tenantIn(s7, 'cottage'); p7.pets = ['goat'];
  const pi = spawnDecision(s7, 'pet', { tenantId: p7.id })!;
  assert.equal(pi.outcomeId, 'ban'); assert.equal(pi.resolvedBy, 'steward');
  assert.match(heraldText(s7), /^Ansel told .* the goat must go/m);
  assert.deepEqual(p7.pets, []);

  // with the Bailiff's post empty, a Steward with a view on late rent takes it up
  const s8 = realm('baron');
  const ag = staffOf(s8, 'bailiff')!; delete s8.staff[ag.id];
  const l8 = tenantIn(s8, 'cottage'); l8.arrears = 16;
  const i8 = spawnDecision(s8, 'late_rent', { tenantId: l8.id })!;
  assert.equal(i8.outcomeId, 'late_fee'); assert.equal(i8.resolvedBy, 'steward');

  // policy: screening always
  const s9 = realm('knight'); s9.policies.screening = 'always';
  const ap = applicantAt(s9);
  const i9 = spawnDecision(s9, 'applicant', { applicantId: ap.id, buildingId: ap.buildingId, unit: ap.unit })!;
  assert.equal(i9.outcomeId, 'screen'); assert.equal(i9.resolvedBy, 'order');
  assert.match(heraldText(s9), /^As house policy requires, /m);
});

test('the comedy of delegation: a Snob crier and a Grasping bailiff, within their habits and your orders', () => {
  let rejected = 0, accepted = 0, edict = 0;
  for (let i = 0; i < 40; i++) {
    const s = realm('baron'); s.nextId = 100000 + i * 7;
    const pip = staffOf(s, 'crier')!; pip.temperament = 'snob';
    const ap = applicantAt(s); ap.household.species = 'goblin'; ap.household.name = 'Snik of the Good Pen';
    const favor = s.favor;
    const inc = spawnDecision(s, 'applicant', { applicantId: ap.id, buildingId: ap.buildingId, unit: ap.unit })!;
    assert.equal(inc.resolvedBy, 'crier');
    if (inc.outcomeId === 'reject') {
      rejected++;
      if (s.favor < favor && /Fair Hearth Edict/.test(heraldText(s))) edict++;
    } else { assert.equal(inc.outcomeId, 'accept'); accepted++; }
  }
  assert.ok(rejected >= 15 && accepted >= 3, `a Snob turns most goblins away, not all (${rejected} rejected, ${accepted} accepted)`);
  assert.equal(edict, rejected, 'and every time, the Fair Hearth Edict hears of it');
  // humans are quality enough
  { const s = realm('baron'); staffOf(s, 'crier')!.temperament = 'snob'; const ap = applicantAt(s);
    assert.equal(spawnDecision(s, 'applicant', { applicantId: ap.id, buildingId: ap.buildingId, unit: ap.unit })!.outcomeId, 'accept'); }
  // "never turn anyone away" holds even a Snob
  { const s = realm('baron'); staffOf(s, 'crier')!.temperament = 'snob'; const ap = applicantAt(s); ap.household.species = 'goblin';
    act(s, { type: 'add_order', order: order({ to: 'crier', decision: 'applicant', rule: 'never', option: 'reject' }) });
    for (let i = 0; i < 12; i++) { s.incidents = {}; s.nextId += 13; ap.shown = true;
      if (!s.applicants[ap.id]) s.applicants[ap.id] = ap;
      const inc = spawnDecision(s, 'applicant', { applicantId: ap.id, buildingId: ap.buildingId, unit: ap.unit })!;
      assert.notEqual(inc.outcomeId, 'reject'); } }

  let fees = 0;
  for (let i = 0; i < 40; i++) {
    const s = realm('baron'); s.nextId = 200000 + i * 11;
    staffOf(s, 'bailiff')!.temperament = 'grasping';
    const t = tenantIn(s, 'cottage'); t.arrears = 16; t.daysLate = 6; t.lateStage = 'late';
    const inc = spawnDecision(s, 'late_rent', { tenantId: t.id })!;
    assert.equal(inc.outcomeId, 'wait');
    if (/door fee/.test(heraldText(s))) { fees++; assert.ok(t.arrears > 16, 'the fee is on the slate'); assert.ok(t.memory.some(m => /door fee/.test(m.text))); }
    else assert.equal(t.arrears, 16);
  }
  assert.ok(fees >= 8 && fees <= 30, `a Grasping bailiff adds a fee now and then (${fees} of 40)`);
  // forbidden to charge fees, he charges none
  for (let i = 0; i < 20; i++) {
    const s = realm('baron'); s.nextId = 200000 + i * 11;
    staffOf(s, 'bailiff')!.temperament = 'grasping';
    act(s, { type: 'add_order', order: order({ decision: 'late_rent', rule: 'never', option: 'late_fee' }) });
    const t = tenantIn(s, 'cottage'); t.arrears = 16;
    spawnDecision(s, 'late_rent', { tenantId: t.id });
    assert.ok(!/door fee/.test(heraldText(s)));
  }
  // and under a direct order there is no improvising at all
  for (let i = 0; i < 20; i++) {
    const s = realm('baron'); s.nextId = 200000 + i * 11;
    staffOf(s, 'bailiff')!.temperament = 'grasping';
    act(s, { type: 'add_order', order: order({ decision: 'late_rent', rule: 'choose', option: 'wait' }) });
    const t = tenantIn(s, 'cottage'); t.arrears = 16;
    const inc = spawnDecision(s, 'late_rent', { tenantId: t.id })!;
    assert.equal(inc.resolvedBy, 'order');
    assert.ok(!/door fee/.test(heraldText(s)));
  }
});

test('full judgment (authority 2) settles custom matters in a delegate\'s line of work, but never a set piece', () => {
  const pin: IncidentDef = {
    id: 'zz_judgment_pin', title: 'A Test Of Judgment', category: 'payment', decision: 'custom', target: 'tenant', minRank: 'reeve',
    weight: 0, cooldownMonths: 0, icon: 'coin', urgency: 1, timerDays: 5, audience: true, petitioner: 'tenant',
    herald: '{tenant} has a proposal.', opening: ['Hear me out.', 'It is about money.'], stance: 'Wants something reasonable, or at least defensible.',
    outcomes: [
      { id: 'kind', label: 'Be kind', say: 'Very well.', intent: 'The ruler is generous.', effects: [{ t: 'happiness', amount: 12 }, { t: 'gold', amount: -6 }], reply: 'Bless you.', result: '{tenant} was treated kindly.' },
      { id: 'firm', label: 'Be firm', say: 'No.', intent: 'The ruler holds the line.', effects: [{ t: 'gold', amount: 8, memo: 'A fee' }, { t: 'happiness', amount: -6 }], reply: 'I see.', result: '{tenant} paid up.' },
    ],
    onExpire: [],
  };
  INCIDENTS.push(pin); INCIDENT_BY_ID[pin.id] = pin;
  try {
    const run = (temper: 'grasping' | 'soft', authority: 0 | 1 | 2, once = false): Incident => {
      const s = realm('baron'); const ag = staffOf(s, 'bailiff')!; ag.temperament = temper; ag.authority = authority;
      pin.once = once;
      return spawnIncident(s, pin.id, { tenantId: tenantIn(s, 'cottage').id })!;
    };
    assert.equal(run('grasping', 1).state, 'open', 'authority 1 leaves custom audiences to the ruler');
    assert.equal(run('grasping', 2).outcomeId, 'firm');
    assert.equal(run('soft', 2).outcomeId, 'kind');
    assert.equal(run('soft', 2, true).state, 'open', 'a once-only set piece is always the ruler\'s');
  } finally {
    INCIDENTS.splice(INCIDENTS.indexOf(pin), 1); delete INCIDENT_BY_ID[pin.id];
  }

  // A story with a decision type (the griffin is a `pet` matter) still comes to court while the Steward is new:
  // the routine pipeline is his at authority 1, a petitioner with a tale of their own is the ruler's.
  const s = realm('baron');
  const ansel = staffOf(s, 'steward')!; assert.equal(ansel.authority, 1);
  const t = tenantIn(s, 'cottage');
  const griffin = spawnIncident(s, 'unauthorized_griffin', { tenantId: t.id })!;
  assert.equal(griffin.state, 'open', 'the griffin gets its audience');
  assert.ok(griffin.actorId, 'and its owner walks to the seat');
  assert.equal(decide(s, griffin), null);
  // ...unless the ruler has said what to do about such things
  act(s, { type: 'add_order', order: order({ to: 'steward', text: 'Beasts pay pet rent.', gist: 'Anything with a tail pays.', decision: 'pet', rule: 'choose', option: 'pet_rent' }) });
  assert.equal(griffin.outcomeId, 'pet_rent', 'a standing order settles what is already on the table');
  assert.equal(griffin.resolvedBy, 'order'); assert.equal(griffin.actorId, null);
  assert.match(heraldText(s), /^By your standing order, Ansel put the griffin at .* on pet rent\.$/m);
  assert.match(heraldText(s), /Gerald the griffin now pays pet rent/, 'a story keeps its own ending in the feed');
  // after a year of loyal service he hears such things himself, by house policy first
  const s2 = realm('baron'); s2.policies.pets = 'allow';
  staffOf(s2, 'steward')!.authority = 2;
  const g2 = spawnIncident(s2, 'unauthorized_griffin', { tenantId: tenantIn(s2, 'cottage').id })!;
  assert.equal(g2.outcomeId, 'allow'); assert.equal(g2.resolvedBy, 'steward'); assert.ok(g2.reported);
  assert.match(heraldText(s2), /^Ansel let .* keep the griffin/m);
  assert.match(heraldText(s2), /You did not see a griffin/);
  for (const st of [s, s2]) for (const h of st.heralds) if (h.kind === 'staff') assert.ok(h.text.length <= 150, h.text);
});

// ═════════════ 4. timers, expiry, the pipeline's follow-ups ═════════════

test('expiry: effects land, the visual comes off, the herald says so; dismissing does the same at once', () => {
  const s = realm('reeve');
  const t = tenantIn(s, 'hovel'); const b = buildingOf(s, t);
  b.condition = 50; t.happiness = 50; s.renown = 50;
  const ignored0 = s.stats.incidentsIgnored;
  const inc = spawnIncident(s, 'sys_repair_leak', { buildingId: b.id })!;
  assert.equal(inc.state, 'open', 'a Reeve has no one to send but himself');
  assert.equal(inc.expiresDay, s.day + 14);
  assert.ok(b.visuals.includes('leak'));
  assert.equal(incidentsAt(s, b.id).length, 1);
  drive(s, 13.5);
  assert.equal(inc.state, 'open', 'not yet');
  drive(s, 1);
  assert.equal(inc.state, 'expired');
  assert.equal(b.condition, 38, 'condition -12');
  assert.equal(t.happiness, 40, 'the household is 10 less happy');
  assert.equal(s.renown, 49);
  assert.equal(s.stats.incidentsIgnored, ignored0 + 1);
  assert.ok(!b.visuals.includes('leak'));
  assert.ok(s.heralds.some(h => h.text === `The leak at ${b.name} was ignored until it became a feature.`));
  assert.equal(openIncidents(s).length, 0);

  // the patch that comes back: a `spawn` effect goes through pending
  const s2 = realm('reeve');
  const b2 = buildingOf(s2, tenantIn(s2, 'hovel'));
  const i2 = spawnIncident(s2, 'sys_repair_leak', { buildingId: b2.id })!;
  assert.ok(resolveIncident(s2, i2.id, 'defer', 'ruler').ok);
  assert.equal(i2.state, 'resolved');
  assert.equal(s2.pending.filter(p => p.defId === 'sys_repair_leak').length, 1);
  assert.equal(s2.pending.find(p => p.defId === 'sys_repair_leak')!.buildingId, b2.id);
  drive(s2, 19.5);
  assert.equal(incidentsAt(s2, b2.id).length, 0);
  drive(s2, 1);
  assert.equal(incidentsAt(s2, b2.id).length, 1, 'twenty days later the bucket is full again');

  // dismiss
  const s3 = realm('reeve');
  const t3 = tenantIn(s3, 'hovel');
  const i3 = spawnIncident(s3, 'unauthorized_griffin', { tenantId: t3.id })!;
  assert.ok(!act(s3, { type: 'dismiss_incident', incidentId: 'nope' }).ok);
  assert.ok(act(s3, { type: 'dismiss_incident', incidentId: i3.id }).ok);
  assert.equal(i3.state, 'expired');
  assert.ok(t3.pets.includes('griffin'), 'by custom it now lives there');
  assert.ok(buildingOf(s3, t3).visuals.includes('griffin_roof'), 'and so it stays on the roof');
  assert.ok(s3.pending.some(p => p.defId === 'griffin_sheep_claim'), 'the sheep claim is on its way, whether or not anyone has written it yet');
  assert.ok(!act(s3, { type: 'dismiss_incident', incidentId: i3.id }).ok, 'only once');
  drive(s3, 30);                                                           // a follow-up that does not exist is dropped without a sound
  assert.ok(!s3.pending.some(p => p.defId === 'griffin_sheep_claim'));
  // when the griffin's household goes, the griffin goes
  t3.status = 'left'; t3.buildingId = null;
  const roof = Object.values(s3.buildings).find(x => x.visuals.includes('griffin_roof'))!;
  roof.units[0]!.tenantId = null;
  drive(s3, 1.25);
  assert.ok(!roof.visuals.includes('griffin_roof'));
});

test('resolve_incident refuses politely; jobs carry the outcome; a quarrelsome household runs a shorter clock', () => {
  const s = realm('reeve');
  const t = tenantIn(s, 'hovel'); const b = buildingOf(s, t);
  const inc = spawnIncident(s, 'sys_repair_leak', { buildingId: b.id })!;
  const r1 = act(s, { type: 'resolve_incident', incidentId: 'nope', outcomeId: 'fix' });
  assert.ok(!r1.ok && r1.code === 'not_found');
  const r2 = act(s, { type: 'resolve_incident', incidentId: inc.id, outcomeId: 'burn_it_down' });
  assert.ok(!r2.ok && r2.code === 'invalid');
  const before = b.condition;
  s._events = [];
  assert.ok(act(s, { type: 'resolve_incident', incidentId: inc.id, outcomeId: 'fix' }).ok);
  assert.equal(inc.state, 'in_progress');
  const job = s.jobs[inc.jobId!]!;
  assert.deepEqual([job.kind, job.role, job.incidentId, job.outcomeId, job.buildingId, job.cost, job.byRuler], ['incident', 'mason', inc.id, 'fix', b.id, 9, true]);
  assert.equal(b.condition, before, 'nothing is mended until the work is done');
  const r3 = act(s, { type: 'resolve_incident', incidentId: inc.id, outcomeId: 'patch' });
  assert.ok(!r3.ok && r3.code === 'busy');
  assert.ok(!act(s, { type: 'dismiss_incident', incidentId: inc.id }).ok);
  inc.expiresDay = s.day - 1; incidentsModule.step!(s, 0.01);
  assert.equal(inc.state, 'in_progress', 'work under way does not expire');
  finishJob(s, inc);
  assert.equal(inc.state, 'resolved');
  assert.equal(b.condition, Math.min(100, before + 14));
  assert.equal(events(s, 'incident_resolved').length, 1);
  assert.ok(!b.visuals.includes('leak'));

  // patience: trait multipliers shorten or lengthen a tenant's timer
  const s2 = realm('reeve');
  const t2 = tenantIn(s2, 'hovel'); t2.traits = [];
  const base = spawnIncident(s2, 'sys_late_rent', { tenantId: t2.id })!;
  const s3 = realm('reeve');
  const t3 = tenantIn(s3, 'hovel');
  const old = TRAIT_DEFS.complainer.patience;
  TRAIT_DEFS.complainer.patience = 0.5;
  t3.traits = ['complainer'];
  const quick = spawnIncident(s3, 'sys_late_rent', { tenantId: t3.id })!;
  TRAIT_DEFS.complainer.patience = old;
  assert.ok(quick.expiresDay! - s3.day < base.expiresDay! - s2.day);
});

test('system decisions: one ruling per subject, variants by fit, the plainest as a fallback', () => {
  const s = realm('reeve');
  const t = tenantIn(s, 'hovel');
  const a = spawnDecision(s, 'late_rent', { tenantId: t.id })!;
  const b = spawnDecision(s, 'late_rent', { tenantId: t.id })!;
  assert.equal(a.id, b.id, 'asking twice returns the matter already open');
  assert.equal(Object.keys(s.incidents).length, 1);
  assert.equal(a.vars.amount, t.lease!.rent, 'amount is what is owed (a month, if no arrears are booked yet)');
  assert.equal(a.vars.tenant, t.name); assert.equal(a.vars.building, buildingOf(s, t).name);

  // the squatters decision puts squatters in the house if nobody has yet
  const empty = Object.values(s.buildings).find(x => x.type === 'hovel' && !x.units[0]!.tenantId)!;
  empty.units[0]!.vacantSince = s.day - 3;                                 // not 40 days: nothing fits, the plain variant is used anyway
  const sq = spawnDecision(s, 'squatters', { buildingId: empty.id, unit: 0 })!;
  assert.ok(sq, 'the pipeline gets its ruling');
  assert.equal(empty.squatters?.kind, 'goblins');
  assert.ok(empty.visuals.includes('goblins_windows'));
  assert.equal(sq.tenantId, null);
  // ignore: they stay, and so do the faces at the window
  assert.ok(resolveIncident(s, sq.id, 'ignore', 'ruler').ok);
  assert.ok(empty.squatters && empty.visuals.includes('goblins_windows'));
  // lease: a goblin household at 80% of asking
  const sq2 = spawnDecision(s, 'squatters', { buildingId: empty.id, unit: 0 })!;
  empty.rent = 10;
  const housedBefore = Object.values(s.tenants).filter(x => x.status === 'housed').length;
  assert.ok(resolveIncident(s, sq2.id, 'lease', 'ruler').ok);
  const newcomer = s.tenants[empty.units[0]!.tenantId!];
  assert.ok(newcomer, 'the unit is let');
  assert.equal(newcomer.species, 'goblin');
  assert.equal(newcomer.lease!.rent, 8);
  assert.equal(empty.squatters, null);
  assert.ok(!empty.visuals.includes('goblins_windows'));
  assert.equal(Object.values(s.tenants).filter(x => x.status === 'housed').length, housedBefore + 1);
  assert.equal(Object.values(s.applicants).filter(x => x.buildingId === empty.id).length, 0, 'no stray applicant record');

  // the plain variant is not forced onto the wrong kind of building: no leak "over the bed" of a well, or of the ruler
  const well = Object.values(s.buildings).find(x => x.type === 'well')!;
  const seat = Object.values(s.buildings).find(x => x.type === 'seat')!;
  // (unless content has written a repair for wells: then that is what comes up, never the leak)
  for (const b of [well, seat]) {
    const got = spawnDecision(s, 'repair', { buildingId: b.id });
    assert.ok(got === null || (got.defId !== 'sys_repair_leak' && fitsTarget(s, INCIDENT_BY_ID[got.defId]!, { buildingId: b.id })), `no roof leak at the ${b.type}`);
  }
  assert.ok(spawnDecision(s, 'repair', { buildingId: Object.values(s.buildings).find(x => x.type === 'market_stall')!.id }), 'a stall is a roof somebody rents');

  // unknown decision content, unknown def, bad targets: null, never a throw
  assert.equal(spawnIncident(s, 'no_such_def', {}), null);
  assert.equal(spawnIncident(s, 'sys_late_rent', {}), null);
  assert.equal(spawnIncident(s, 'sys_repair_leak', { buildingId: 'nope' }), null);
  assert.equal(spawnDecision(s, 'late_rent', { tenantId: 'nope' }), null);
});

test('applicant variants are chosen for the household at the door: species, trade, tag, trait', () => {
  const base = INCIDENT_BY_ID['sys_applicant']!;
  const HEAVY = 1e9;                                                         // if a variant fits at all, it is the one drawn
  const variant = (id: string, requires: NonNullable<IncidentDef['requires']>): IncidentDef => ({ ...base, id, weight: HEAVY, cooldownMonths: 1, minRank: 'reeve', requires });
  const extra = [
    variant('zz_app_dwarf', { species: ['dwarf', 'ogre'] }),
    variant('zz_app_baker', { trade: ['baker'] }),
    variant('zz_app_widow', { tag: ['widow'] }),
    variant('zz_app_brawler', { trait: ['brawler'] }),
  ];
  const book = INCIDENTS.slice();
  for (const d of extra) { INCIDENTS.push(d); INCIDENT_BY_ID[d.id] = d; }
  const ask = (dress: (a: Applicant) => void, before?: (s: GameState) => void): string => {
    const s = realm('reeve');
    const a = applicantAt(s); dress(a);
    // the household next door is everything the variants ask for, and lives in the realm: the question is not about them
    const t = tenantIn(s, 'hovel'); t.species = 'dwarf'; t.trade = 'baker'; t.tags = ['widow']; t.traits = ['brawler'];
    before?.(s);
    const inc = spawnDecision(s, 'applicant', { applicantId: a.id, buildingId: a.buildingId, unit: a.unit });
    assert.ok(inc, 'the pipeline gets its ruling');
    assert.equal(inc.applicantId, a.id); assert.equal(inc.tenantId, null);
    assert.equal(inc.vars.tenant, a.household.name); assert.equal(inc.vars.species, a.household.species);
    assert.equal(fitsTarget(s, INCIDENT_BY_ID[inc.defId]!, { applicantId: a.id, buildingId: a.buildingId, unit: a.unit }), true);
    return inc.defId;
  };
  try {
    assert.ok(!ask(() => {}).startsWith('zz_app_'), 'a human carpenter, newly wed and handy: none of the variants is about them');
    assert.equal(ask(a => { a.household.species = 'dwarf'; }), 'zz_app_dwarf');
    assert.equal(ask(a => { a.household.species = 'ogre'; }), 'zz_app_dwarf', 'any one of the species named');
    assert.equal(ask(a => { a.household.trade = 'baker'; }), 'zz_app_baker');
    assert.equal(ask(a => { a.household.tags = ['elder', 'widow']; }), 'zz_app_widow');
    assert.equal(ask(a => { a.household.traits = ['tidy', 'brawler']; a.household.revealed = []; }), 'zz_app_brawler', 'a trait counts before anyone has found it out');
    assert.ok(!ask(a => { a.household.species = 'elf'; a.household.trade = 'bard'; a.household.tags = ['elder']; a.household.traits = ['tidy']; }).startsWith('zz_app_'));

    // the fallback (nothing fits exactly: here the plain variants are struck from the book and the rest were all used this
    // month) still minds who is at the door, and still gives the pipeline its ruling when nobody written suits
    for (const d of book) if (d.system && d.decision === 'applicant') INCIDENTS.splice(INCIDENTS.indexOf(d), 1);
    const used = (s: GameState): void => { for (const d of extra) s.incidentLog[d.id] = s.day - 1; };
    assert.equal(ask(a => { a.household.trade = 'baker'; }, used), 'zz_app_baker', 'the one that suits, not the first in the book');
    assert.equal(ask(a => { a.household.tags = ['widow']; }, used), 'zz_app_widow');
    const s = realm('reeve'); const a = applicantAt(s); used(s);
    assert.ok(spawnDecision(s, 'applicant', { applicantId: a.id, buildingId: a.buildingId, unit: a.unit }), 'and when nobody written suits, a ruling all the same');
  } finally {
    INCIDENTS.length = 0; INCIDENTS.push(...book);
    for (const d of extra) delete INCIDENT_BY_ID[d.id];
  }
});

test('an applicant who is asked about stays at the door for a real answer', () => {
  const s = realm('reeve');
  const ap = applicantAt(s);
  const inc = spawnDecision(s, 'applicant', { applicantId: ap.id, buildingId: ap.buildingId, unit: ap.unit })!;
  assert.equal(inc.vars.tenant, ap.household.name); assert.equal(inc.vars.species, 'human'); assert.equal(inc.vars.trade, 'carpenter');
  assert.equal(inc.actorId, ap.actorId, 'the applicant\'s own figure is the petitioner');
  s.heralds = [];
  assert.ok(resolveIncident(s, inc.id, 'screen', 'ruler').ok);
  finishJob(s, inc);
  assert.equal(inc.state, 'resolved');
  if (/Asked after Jory Applewhite/.test(heraldText(s))) assert.ok(!/Enquiries were made/.test(heraldText(s)), 'what the last landlord said is the news; it is not announced twice');
  if (s.applicants[ap.id]) {
    const next = openIncidents(s).find(i => i.applicantId === ap.id);
    assert.ok(next, 'the question is put again');
    assert.notEqual(next.id, inc.id);
    const r = resolveIncident(s, next.id, 'screen', 'ruler');
    assert.ok(!r.ok, 'but not the same enquiry twice');
    assert.ok(resolveIncident(s, next.id, 'accept', 'ruler').ok);
    assert.equal(openIncidents(s).filter(i => i.applicantId === ap.id).length, 0, 'a lease, or a refusal, ends it');
  } else note('rent.screen removed the applicant in this build; re-asking not exercised');
});

// ═════════════ 5. effects ═════════════

test('effects: every variant does its one thing, on the right household', () => {
  const s = realm('baron');
  const t = tenantIn(s, 'cottage'); const b = buildingOf(s, t);
  const far = tenantIn(s, 'wizard_tower');
  const ctx = { tenantId: t.id, buildingId: b.id, unit: t.unit, title: 'A Test', vars: { tenant: t.name, building: b.name, amount: 7, pet: 'goat' } };
  const fx = (e: Effect[]): void => applyEffects(s, e, ctx);
  t.happiness = 50; far.happiness = 50; b.condition = 50; s.gold = 100; s.renown = 50; s.favor = 50; t.arrears = 0; t.lease!.rent = 20;

  s._events = [];
  fx([{ t: 'gold', amount: 15, memo: 'Griffin surety' }]); assert.equal(s.gold, 115);
  fx([{ t: 'gold', amount: -10, memo: 'Goblin relocation' }]); assert.equal(s.gold, 105);
  assert.equal(events(s, 'gold').length, 2);
  assert.equal(incomeCatFor('Griffin surety'), 'fees'); assert.equal(incomeCatFor('A hoard under the floor'), 'windfall');
  assert.equal(expenseCatFor('Goblin relocation'), 'bribes'); assert.equal(expenseCatFor('Coin for keys'), 'bribes');
  assert.equal(expenseCatFor('A fine from the Reeve\'s Court'), 'court'); assert.equal(expenseCatFor('New thatch'), 'repairs');
  assert.equal(expenseCatFor('A wedding gift'), 'gifts'); assert.equal(expenseCatFor('Sundries'), 'other');
  fx([{ t: 'renown', amount: 3 }, { t: 'favor', amount: -4 }]); assert.equal(s.renown, 53); assert.equal(s.favor, 46);
  fx([{ t: 'happiness', amount: 5 }]); assert.equal(t.happiness, 55); assert.equal(far.happiness, 50);
  fx([{ t: 'happiness', amount: -5, scope: 'building' }]); assert.equal(t.happiness, 50);
  fx([{ t: 'happiness', amount: 2, scope: 'all' }]); assert.equal(t.happiness, 52); assert.equal(far.happiness, 52);
  const near = Object.values(s.tenants).filter(x => x.status === 'housed' && x.buildingId !== b.id).map(x => [x, x.happiness] as const);
  fx([{ t: 'happiness', amount: -3, scope: 'neighbors' }]);
  assert.equal(t.happiness, 52, 'not the household itself');
  const moved = near.filter(([x, h]) => x.happiness !== h);
  assert.ok(moved.length > 0 && moved.length < near.length, 'some neighbours, not the whole realm');
  for (const [x] of moved) { const o = s.buildings[x.buildingId!]!; assert.ok(Math.hypot(o.x + o.w / 2 - b.x - b.w / 2, o.y + o.h / 2 - b.y - b.h / 2) <= FX.neighborRadius + 0.01); }
  fx([{ t: 'condition', amount: 10 }]); assert.equal(b.condition, 60);
  fx([{ t: 'condition', amount: -25 }]); assert.equal(b.condition, 35);
  applyEffects(s, [{ t: 'condition', amount: 10 }], { ...ctx, quality: 1.5 }); assert.equal(b.condition, 50, 'a better hand mends more');
  fx([{ t: 'rent', pct: 10 }]); assert.equal(t.lease!.rent, 22);
  fx([{ t: 'arrears', amount: 9 }]); assert.equal(t.arrears, 9);
  fx([{ t: 'arrears', amount: 'forgive' }]); assert.equal(t.arrears, 0);
  fx([{ t: 'memory', text: 'You did a thing for {tenant}.', valence: 1 }]); assert.equal(t.memory[t.memory.length - 1]!.text, `You did a thing for ${t.name}.`);
  t.traits = ['handy']; t.revealed = [];
  fx([{ t: 'trait', add: 'litigious' }]); assert.ok(t.traits.includes('litigious') && !t.revealed.includes('litigious'), 'a new habit is not known at once');
  fx([{ t: 'trait', reveal: 'litigious' }]); assert.ok(t.revealed.includes('litigious'));
  fx([{ t: 'trait', reveal: 'proud' }]); assert.ok(t.traits.includes('proud') && t.revealed.includes('proud'));
  fx([{ t: 'trait', remove: 'litigious' }]); assert.ok(!t.traits.includes('litigious') && !t.revealed.includes('litigious'));
  t.pets = ['cat', 'goat'];
  fx([{ t: 'pet', add: 'griffin' }]); assert.deepEqual(t.pets, ['cat', 'goat', 'griffin']);
  fx([{ t: 'pet', remove: true }]); assert.deepEqual(t.pets, ['cat', 'griffin'], 'the goat the matter was about');
  applyEffects(s, [{ t: 'pet', remove: true }], { ...ctx, vars: {} }); assert.deepEqual(t.pets, []);
  fx([{ t: 'flag', key: 'feast_promised' }, { t: 'flag', key: 'purple', value: true, scope: 'building' }, { t: 'flag', key: 'count', value: 3 }]);
  assert.equal(s.flags.feast_promised, true); assert.equal(b.flags.purple, true); assert.equal(s.flags.count, 3);
  fx([{ t: 'visual', add: 'bunting' }]); assert.ok(b.visuals.includes('bunting'));
  fx([{ t: 'visual', remove: 'bunting' }]); assert.ok(!b.visuals.includes('bunting'));
  fx([{ t: 'squatters', set: 'bandits' }]); assert.equal(b.squatters?.kind, 'bandits');
  fx([{ t: 'squatters', set: null }]); assert.equal(b.squatters, null);
  fx([{ t: 'spawn', id: 'sys_repair_leak', delayDays: 5, chance: 0 }]); assert.equal(s.pending.length, 0);
  fx([{ t: 'spawn', id: 'sys_repair_leak', delayDays: 5, chance: 1 }, { t: 'spawn', id: 'sys_pet_found', delayDays: 2 }]);
  assert.deepEqual(s.pending.map(p => [p.defId, p.day, p.buildingId, p.tenantId]), [['sys_repair_leak', s.day + 5, b.id, t.id], ['sys_pet_found', s.day + 2, b.id, t.id]]);
  s.pending = [];
  fx([{ t: 'oath', kind: 'no_rent_raise', months: 6, text: 'The rent of {tenant} will not move.' }]);
  const oath = s.oaths[s.oaths.length - 1]!;
  assert.deepEqual([oath.kind, oath.text, oath.toTenantId, oath.toName, oath.dueDay, oath.state], ['no_rent_raise', `The rent of ${t.name} will not move.`, t.id, t.name, s.day + 180, 'open']);
  const loyal = staffOf(s, 'mason')!.loyalty;
  fx([{ t: 'loyalty', role: 'mason', amount: -7 }]); assert.equal(staffOf(s, 'mason')!.loyalty, loyal - 7);
  s.heralds = [];
  fx([{ t: 'herald', text: 'A thing happened to {tenant}.', kind: 'good' }]);
  assert.deepEqual([s.heralds[0]!.kind, s.heralds[0]!.text, s.heralds[0]!.tenantId], ['good', `A thing happened to ${t.name}.`, t.id]);
  fx([{ t: 'late', option: 'wait' }, { t: 'deposit', keepPct: -1 }, { t: 'screen' }]);                 // the owners' business; must not throw
  fx([{ t: 'no_such_effect' } as unknown as Effect, null as unknown as Effect]);                        // nor this
  fx([{ t: 'leave' }]);
  if (t.status !== 'housed') assert.equal(b.units[t.unit]?.tenantId ?? null, null);

  // a building incident lands household effects on whoever lives there, and on nobody if nobody does
  const s2 = realm('baron');
  const t2 = tenantIn(s2, 'cottage'); t2.happiness = 50;
  applyEffects(s2, [{ t: 'happiness', amount: 4 }, { t: 'arrears', amount: 5 }], { buildingId: t2.buildingId });
  assert.equal(t2.happiness, 54); assert.equal(t2.arrears, 5);
  const empty = Object.values(s2.buildings).find(x => x.type === 'hovel' && !x.units[0]!.tenantId)!;
  applyEffects(s2, [{ t: 'happiness', amount: 4 }, { t: 'arrears', amount: 5 }, { t: 'evict' }, { t: 'leave' }, { t: 'memory', text: 'x', valence: 1 }], { buildingId: empty.id });
  applyEffects(s2, [{ t: 'happiness', amount: 4 }, { t: 'condition', amount: 4 }, { t: 'visual', add: 'rats' }, { t: 'lease', accept: true }], {});
  assert.equal(FX.errors.length, 0, 'nothing threw: ' + (FX.errors[0]?.error ?? ''));
});

// ═════════════ 6. the court ═════════════

test('petitioners: from their door to the seat, three at most, and home again', () => {
  const s = realm('reeve');
  const seat = Object.values(s.buildings).find(b => b.type === 'seat')!;
  const tenants = Object.values(s.tenants).filter(t => t.status === 'housed').slice(0, 5);
  s._events = [];
  const incs = tenants.map(t => spawnDecision(s, 'late_rent', { tenantId: t.id })!);
  assert.equal(incs.length, 5, 'the pipeline is never refused a ruling');
  const withActor = incs.filter(i => i.actorId);
  assert.equal(withActor.length, INC_TUNE.courtRoom, 'three wait at court; the rest wait at home');
  const spots = new Set<string>();
  for (const i of withActor) {
    const a = s.actors[i.actorId!]!;
    assert.equal(a.kind, 'petitioner'); assert.equal(a.refId, i.tenantId);
    const home = s.buildings[s.tenants[i.tenantId!]!.buildingId!]!;
    assert.ok(Math.hypot(a.homeX - (home.x + home.w / 2), a.homeY - (home.y + home.h / 2)) < 3, 'they set out from their own door');
    const end = a.path.length ? a.path[a.path.length - 1]! : [a.x, a.y];
    assert.ok(Math.hypot(end[0]! - (seat.x + seat.w / 2), end[1]! - (seat.y + seat.h / 2)) < 5, 'and are bound for the seat');
    spots.add(end[0]!.toFixed(2) + ',' + end[1]!.toFixed(2));
  }
  assert.equal(spots.size, 3, 'each has a place of their own in the queue');
  assert.equal(events(s, 'actor_spawn').length, 3);

  // one is answered: they go, and the next is sent for at dawn
  const first = withActor[0]!; const firstActor = first.actorId!;
  assert.ok(resolveIncident(s, first.id, 'wait', 'ruler').ok);
  assert.equal(first.actorId, null);
  const gone = s.actors[firstActor];
  if (gone) { assert.ok(Math.hypot((gone.path[gone.path.length - 1] ?? [gone.x, gone.y])[0]! - gone.homeX, (gone.path[gone.path.length - 1] ?? [gone.x, gone.y])[1]! - gone.homeY) < 0.01, 'walking home'); }
  incidentsModule.onDay!(s, Math.floor(s.day) + 1);
  assert.equal(incs.filter(i => i.state === 'open' && i.actorId).length, 3, 'the fourth has been sent for');
  // a departed figure is always lifted off the table in the end
  drive(s, INC_TUNE.exitDays + 1);
  assert.equal(s.actors[firstActor], undefined);

  // an npc comes in by the gate
  const s2 = realm('reeve');
  const empty = Object.values(s2.buildings).find(x => x.type === 'hovel' && !x.units[0]!.tenantId)!;
  empty.units[0]!.vacantSince = s2.day - 50;
  const sq = spawnDecision(s2, 'squatters', { buildingId: empty.id, unit: 0 })!;
  const chief = s2.actors[sq.actorId!]!;
  assert.equal(chief.refId, 'goblin_chief'); assert.equal(chief.kind, 'petitioner');
  assert.ok(chief.homeX < 2, 'from the gate at the map edge');

  // the household leaves mid-matter: the matter closes quietly and the petitioner goes
  const s3 = realm('reeve');
  const t3 = tenantIn(s3, 'hovel');
  const i3 = spawnIncident(s3, 'unauthorized_griffin', { tenantId: t3.id })!;
  const u = buildingOf(s3, t3).units[t3.unit]!;
  t3.status = 'left'; t3.leftDay = s3.day + 0.1; t3.buildingId = null; u.tenantId = null;
  const ignored = s3.stats.incidentsIgnored;
  drive(s3, 1.25);
  assert.equal(i3.state, 'expired'); assert.equal(i3.actorId, null);
  assert.equal(s3.stats.incidentsIgnored, ignored, 'nobody was ignored; they simply left');
  assert.ok(!t3.pets.includes('griffin'), 'no expiry effects for a matter that walked away');
});

// ═════════════ 7. staff ═════════════

test('candidates: three per role on offer, distinct, skill by renown, wage by skill', () => {
  const s = realm('reeve'); s.candidates = [];
  rollCandidates(s);
  const by = (role: StaffRole) => s.candidates.filter(c => c.role === role);
  assert.equal(by('mason').length, 3); assert.equal(by('bailiff').length, 3); assert.equal(by('crier').length, 3);
  assert.equal(by('steward').length, 0, 'a Steward is two ranks away');
  assert.equal(new Set(s.candidates.map(c => c.id)).size, 9); assert.equal(new Set(s.candidates.map(c => c.name)).size, 9, 'no two share a name');
  for (const c of s.candidates) {
    assert.ok(c.skill >= 1 && c.skill <= 4 && Number.isInteger(c.skill));
    assert.ok(c.wage >= Math.floor(fairWage(c.skill) * 0.9) && c.wage <= Math.ceil(fairWage(c.skill) * 1.15), `wage ${c.wage} suits skill ${c.skill}`);
    assert.equal(TEMPERAMENT_DEFS[c.temperament].role, c.role);
    assert.ok(c.pitch.length > 5 && c.name.length > 2 && c.first.length > 0);
  }
  for (const role of ['mason', 'bailiff', 'crier'] as StaffRole[]) assert.equal(new Set(by(role).map(c => c.temperament)).size, 3, 'three temperaments to choose between');
  const meanSkill = (renown: number): number => { let n = 0, sum = 0; for (let i = 0; i < 60; i++) { const x = realm('knight'); x.rng = i * 977; x.renown = renown; x.candidates = []; rollCandidates(x); for (const c of x.candidates) { n++; sum += c.skill; } } return sum / n; };
  const low = meanSkill(10), high = meanSkill(95);
  assert.ok(high > low + 0.6, `a good name draws better hands (${low.toFixed(2)} at renown 10, ${high.toFixed(2)} at 95)`);
  const hidden = (() => { let h = 0, n = 0; for (let i = 0; i < 40; i++) { const x = realm('knight'); x.rng = i * 31; x.candidates = []; rollCandidates(x); for (const c of x.candidates) { n++; if (!c.temperamentKnown) h++; } } return h / n; })();
  assert.ok(hidden > 0.35 && hidden < 0.65, `temperament hidden about half the time (${hidden.toFixed(2)})`);
  // at Knight the Steward's candidates wait at the gate; at Baron they can be hired
  const k = realm('knight'); k.candidates = []; staffModule.onDay!(k, 35);
  assert.equal(k.candidates.filter(c => c.role === 'steward').length, 3);
  const r = act(k, { type: 'hire', candidateId: k.candidates.find(c => c.role === 'steward')!.id });
  assert.ok(!r.ok && r.code === 'locked'); assert.match(r.reason, /Steward serves no one below a Baron/);
});

test('hire, wage, dismiss, call for candidates', () => {
  const s = realm('reeve');
  const c = s.candidates.find(x => x.role === 'mason')!;
  const locked = act(s, { type: 'hire', candidateId: c.id });
  assert.ok(!locked.ok && locked.code === 'locked'); assert.match(locked.reason, /Mason serves no one below a Knight, Reeve/);
  assert.ok(!act(s, { type: 'hire', candidateId: 'nope' }).ok);

  const k = realm('knight');
  const ck = k.candidates.find(x => x.role === 'mason')!;
  const occupied = act(k, { type: 'hire', candidateId: ck.id });
  assert.ok(!occupied.ok && occupied.code === 'occupied'); assert.match(occupied.reason, /Hob already holds the post of Mason/);
  const hob = staffOf(k, 'mason')!;
  k._events = []; k.heralds = [];
  assert.ok(act(k, { type: 'dismiss_staff', staffId: hob.id }).ok);
  assert.equal(staffOf(k, 'mason'), null); assert.equal(k.actors[hob.actorId!], undefined);
  assert.deepEqual(events(k, 'staff_left'), [{ type: 'staff_left', staffId: hob.id, name: hob.name, role: 'mason' }]);
  assert.match(heraldText(k), /Hob Trowelsby is no longer your Mason/);
  assert.ok(!act(k, { type: 'dismiss_staff', staffId: hob.id }).ok);
  // no yard, no mason
  const yard = Object.values(k.buildings).find(b => b.type === 'masons_yard')!;
  yard.state = 'building';
  const noYard = act(k, { type: 'hire', candidateId: ck.id });
  assert.ok(!noYard.ok && noYard.code === 'not_ready'); assert.match(noYard.reason, /not finished/);
  yard.state = 'ready';
  k._events = [];
  // a leak is waiting; the new mason should take it up the moment she is hired
  const leak = spawnDecision(k, 'repair', { buildingId: tenantIn(k, 'hovel').buildingId! })!;
  assert.equal(leak.state, 'open');
  const hired = act(k, { type: 'hire', candidateId: ck.id });
  assert.ok(hired.ok && hired.id);
  const gwen = staffOf(k, 'mason')!;
  assert.deepEqual([gwen.id, gwen.name, gwen.temperament, gwen.skill, gwen.wage, gwen.authority, gwen.jobsDone, gwen.hiredDay], [hired.id, ck.name, ck.temperament, ck.skill, ck.wage, 0, 0, k.day]);
  assert.ok(gwen.actorId && k.actors[gwen.actorId]!.kind === 'staff' && k.actors[gwen.actorId]!.refId === gwen.id);
  assert.equal(events(k, 'staff_hired').length, 1);
  assert.ok(!k.candidates.some(x => x.id === ck.id));
  assert.match(heraldText(k), new RegExp(`${ck.name} is now your Mason, at ${ck.wage} crowns a month`));
  assert.equal(leak.state, 'in_progress', 'a new hand takes up the routine work lying about');
  assert.equal(leak.resolvedBy, 'mason');

  // wages
  const fair = fairWage(gwen.skill);
  const l0 = gwen.loyalty;
  assert.ok(act(k, { type: 'set_wage', staffId: gwen.id, wage: gwen.wage + fair }).ok);
  assert.equal(gwen.loyalty, Math.min(100, l0 + STAFF_TUNE.raiseCheer), 'doubling a fair wage is cheering');
  const l1 = gwen.loyalty;
  assert.ok(act(k, { type: 'set_wage', staffId: gwen.id, wage: gwen.wage - fair }).ok);
  assert.equal(gwen.loyalty, Math.max(0, l1 - STAFF_TUNE.cutSting), 'taking it back stings twice as much');
  assert.ok(!act(k, { type: 'set_wage', staffId: gwen.id, wage: 0 }).ok);
  assert.ok(!act(k, { type: 'set_wage', staffId: gwen.id, wage: Number.NaN }).ok);
  assert.ok(!act(k, { type: 'set_wage', staffId: 'nope', wage: 10 }).ok);
  changeLoyalty(k, 'mason', 500); assert.equal(gwen.loyalty, 100);
  changeLoyalty(k, 'steward', 5);                                          // nobody holds the post: nothing happens

  // calling for candidates: free once a month, then a fee
  const before = k.candidates.map(x => x.id).join();
  k.gold = 100;
  assert.ok(act(k, { type: 'refresh_candidates' }).ok);
  assert.equal(k.gold, 100, 'the first call each month is free');
  assert.notEqual(k.candidates.map(x => x.id).join(), before);
  assert.ok(act(k, { type: 'refresh_candidates' }).ok);
  assert.equal(k.gold, 100 - STAFF_TUNE.refreshFee.knight);
  k.gold = 2;
  const poor = act(k, { type: 'refresh_candidates' });
  assert.ok(!poor.ok && poor.code === 'no_gold');
  k.day += 30;
  assert.ok(act(k, { type: 'refresh_candidates' }).ok, 'free again next month');
  assert.equal(k.gold, 2);
});

test('loyalty follows the wage, the oaths and the countermands; the disloyal quit; skill and authority grow', () => {
  const s = realm('knight');
  const hob = staffOf(s, 'mason')!; const agnes = staffOf(s, 'bailiff')!;
  hob.skill = 3; hob.wage = Math.round(fairWage(3) * 0.5); hob.loyalty = 70;
  agnes.skill = 2; agnes.wage = Math.round(fairWage(2) * 1.5); agnes.loyalty = 50;
  s.incidentLog['~staff.oathsBroken'] = s.stats.oathsBroken; s.incidentLog['~staff.oathsKept'] = s.stats.oathsKept;
  for (let m = 0; m < 8; m++) staffModule.onMonth!(s, m + 2);
  assert.ok(hob.loyalty < 40, `half pay wears loyalty down (${hob.loyalty})`);
  assert.ok(agnes.loyalty > 70, `generous pay builds it (${agnes.loyalty})`);
  assert.match(heraldText(s), /Hob has been heard pricing carts/);

  // Hob is held clear of the quitting line for this part: two broken oaths would take him under it, and whether he then
  // walks out on day 40 or 41 is a roll of the die (which costs everyone else 2 as well). Quitting has its own part below.
  hob.loyalty = STAFF_TUNE.quitBelow + 2 * STAFF_TUNE.oathBroken + 5;
  const a0 = agnes.loyalty, h0 = hob.loyalty;
  s.stats.oathsBroken += 2;
  staffModule.onDay!(s, 40);
  assert.equal(agnes.loyalty, a0 - 2 * STAFF_TUNE.oathBroken, 'a broken oath is heard in the servants\' hall');
  assert.equal(hob.loyalty, h0 - 2 * STAFF_TUNE.oathBroken, 'by everyone in it');
  staffModule.onDay!(s, 41);
  assert.equal(agnes.loyalty, a0 - 2 * STAFF_TUNE.oathBroken, 'once');
  assert.ok(staffOf(s, 'mason'), 'and nobody has left over it yet');

  // skill
  assert.equal(experienceOf(s, hob), STAFF_TUNE.skillAt[2]! + 8 * STAFF_TUNE.xpPerMonth, 'eight months in the post taught a little');
  s.incidentLog['~staff.xp.' + hob.id] = STAFF_TUNE.skillAt[3]! - 1.1;
  const done0 = hob.jobsDone;
  staffModule.onJobDone!(s, { assignee: hob.actorId, workDays: 0.1 } as Job);          // a purse fetched: a job, but not much of a lesson
  assert.equal(hob.jobsDone, done0 + 1); assert.equal(hob.skill, 3);
  staffModule.onJobDone!(s, { assignee: hob.actorId, workDays: 6 } as Job);            // a wall built: a full lesson, and no more than one
  assert.equal(hob.jobsDone, done0 + 2); assert.equal(hob.skill, 4);
  assert.ok(Math.abs(experienceOf(s, hob) - (STAFF_TUNE.skillAt[3]! + 0.1)) < 1e-9, 'a job teaches between 0.2 and 1');
  assert.ok(heraldText(s).includes(`Hob has got better at the work, and knows it. A Mason of that skill is usually paid ${fairWage(4)} crowns.`), 'the hint names the going wage, whatever the balance sheet says it is this week');
  staffModule.onJobDone!(s, { assignee: 'someone_else' } as Job);

  // quitting
  hob.loyalty = 2; s._events = []; s.heralds = [];
  let day = 50;
  const hall = agnes.loyalty;
  while (staffOf(s, 'mason') && day < 120) staffModule.onDay!(s, day++);
  assert.equal(staffOf(s, 'mason'), null, 'he quit');
  assert.equal(agnes.loyalty, hall - 2, 'and those who stayed thought a little less of the post');
  assert.equal(s.incidentLog['~staff.xp.' + hob.id], undefined, 'and took what he had learned with him');
  assert.ok(day < 90, 'within weeks, not months');
  assert.match(heraldText(s), /Hob Trowelsby has quit as your Mason\. "/);
  assert.equal(events(s, 'staff_left').length, 1);

  // authority
  const b = realm('knight');
  for (const m of Object.values(b.staff)) { assert.equal(m.authority, 0); m.hiredDay = b.day - 10; m.loyalty = 80; }
  b.realm.rank = 'baron'; staffModule.onDay!(b, 35);
  for (const m of Object.values(b.staff)) assert.equal(m.authority, 1, 'authority 1 when the ruler is a Baron');
  b.day += 365; staffOf(b, 'crier')!.loyalty = 60;
  staffModule.onDay!(b, Math.floor(b.day));
  assert.equal(staffOf(b, 'mason')!.authority, 2, 'a year of service at loyalty 70+');
  assert.equal(staffOf(b, 'crier')!.authority, 1, 'not at loyalty 60');
  assert.match(heraldText(b), /now uses full judgment/);
  b.realm.rank = 'knight'; staffModule.onDay!(b, Math.floor(b.day) + 1);
  for (const m of Object.values(b.staff)) assert.equal(m.authority, 0, 'a demoted ruler\'s household loses its latitude');
});

// ═════════════ 8. weather ═════════════

test('weather: turns every few days, in season', () => {
  const s = realm('reeve', 0.4);
  const allowed: Record<Season, string[]> = { spring: ['clear', 'rain', 'fog', 'storm', 'hail'], summer: ['clear', 'heat', 'storm', 'rain'], autumn: ['clear', 'rain', 'fog', 'storm'], winter: ['clear', 'snow', 'fog', 'hail'] };
  const seen: Record<Season, Set<string>> = { spring: new Set(), summer: new Set(), autumn: new Set(), winter: new Set() };
  let changes = 0, last = s.weather;
  for (let d = 1; d <= 720; d++) {
    s.day = d + 0.1; s._events = [];
    const before = s.weather;
    incidentsModule.onDay!(s, d);
    if (s.weather !== before) { changes++; assert.deepEqual(events(s, 'weather'), [{ type: 'weather', kind: s.weather }]); assert.ok(allowed[seasonOf(d)].includes(s.weather), `${s.weather} in ${seasonOf(d)}`); }
    else assert.equal(events(s, 'weather').length, 0);
    seen[seasonOf(d)].add(s.weather); last = s.weather;
  }
  void last;
  assert.ok(changes > 120 && changes < 330, `the weather turns every few days (${changes} turns in two years)`);
  assert.ok(seen.winter.has('snow') && seen.summer.has('heat') && seen.spring.has('rain') && seen.autumn.has('rain'));
  assert.ok(!seen.summer.has('snow') && !seen.winter.has('heat'));
});

// ═════════════ 9. the scheduler ═════════════

function synth(id: string, over: Partial<IncidentDef>): IncidentDef {
  const outcomes: OutcomeDef[] = [
    { id: 'do', label: 'See to it', say: 'See to it.', intent: 'The ruler has it dealt with.', default: true, effects: [{ t: 'happiness', amount: 2, scope: 'building' }], reply: 'Aye.', result: 'It was seen to.' },
    { id: 'leave', label: 'Leave it', say: 'Leave it.', intent: 'The ruler does nothing about it.', effects: [{ t: 'renown', amount: -1 }], reply: 'As you like.', result: 'It was left.' },
  ];
  return {
    id, title: 'Synthetic ' + id, category: 'neighbor', decision: 'custom', target: 'building', minRank: 'reeve', weight: 1, cooldownMonths: 3,
    icon: 'bell', urgency: 1, timerDays: 7, audience: false, herald: 'Something has come up (' + id + ').', outcomes, onExpire: [{ t: 'renown', amount: -1 }],
    ...over,
  };
}

test('the scheduler over three years: caps, cooldowns, seasons, ranks, once, quiet months, court room', () => {
  const extra: IncidentDef[] = [
    synth('zz_pin_a', { cooldownMonths: 2 }),
    synth('zz_pin_b', { target: 'tenant', cooldownMonths: 4, urgency: 2 }),
    synth('zz_pin_job', { cooldownMonths: 3, outcomes: synth('x', {}).outcomes.map(o => (o.id === 'do' ? { ...o, job: { role: 'mason' as const, days: 1, cost: 2 } } : o)) }),
    synth('zz_aud_a', { target: 'tenant', audience: true, petitioner: 'tenant', opening: ['A word.', 'If I may.'], stance: 'Has a small and reasonable grievance to air.', cooldownMonths: 3, timerDays: 9 }),
    synth('zz_aud_b', { target: 'tenant', audience: true, petitioner: 'neighbor', opening: ['About next door.', 'It is the noise.'], stance: 'Complains about the neighbours at some length.', cooldownMonths: 5, timerDays: 9 }),
    synth('zz_once', { target: 'realm', audience: true, petitioner: { npc: 'crown_herald' }, opening: ['Hear ye.', 'By order.'], stance: 'Reads a proclamation and expects an answer.', once: true, weight: 3, cooldownMonths: 0 }),
    synth('zz_winter', { seasons: ['winter'], cooldownMonths: 1, weight: 2 }),
    synth('zz_urgent', { urgency: 3, cooldownMonths: 2, weight: 3, timerDays: 4 }),
    synth('zz_knight', { minRank: 'knight', cooldownMonths: 2 }),
    synth('zz_reeve_only', { maxRank: 'reeve', cooldownMonths: 2 }),
    synth('zz_vacant', { target: 'vacant', cooldownMonths: 4 }),
    synth('zz_chain_src', { cooldownMonths: 3, weight: 2, outcomes: synth('x', {}).outcomes.map(o => ({ ...o, effects: [{ t: 'spawn' as const, id: 'zz_chain_dst', delayDays: 5 }] })) }),
    synth('zz_chain_dst', { weight: 0, cooldownMonths: 0 }),
    synth('zz_needs_gold', { requires: { goldAbove: 1e9 }, cooldownMonths: 0 }),
    synth('zz_statue', { requires: { buildingType: ['statue'] }, cooldownMonths: 4 }),
  ];
  // The pins must keep their share of the draw however much is written: against a few examples a weight of 2 was one draw in
  // ten, against the real book it is one in fifty, and "came at least twice in three winters" would be a matter of luck.
  // So they are weighed against the book as it stands today, to make up about half of what the scheduler has to choose from.
  const written = INCIDENTS.reduce((n, d) => n + (!d.system && d.weight > 0 ? d.weight : 0), 0);
  const pinned = extra.reduce((n, d) => n + d.weight, 0);
  const scale = Math.max(1, written / pinned);
  for (const d of extra) d.weight *= scale;
  for (const d of extra) { INCIDENTS.push(d); INCIDENT_BY_ID[d.id] = d; }
  const chainTargets = new Set<string>();
  for (const d of INCIDENTS) for (const o of d.outcomes) for (const e of [...o.effects, ...d.onExpire]) if (e.t === 'spawn') chainTargets.add(e.id);

  try {
    for (const rank of ['reeve', 'knight', 'baron'] as const) {
      const s = realm(rank, 0.2);
      s.seed = 99; s.rng = 4242 + rankIndex(rank);
      for (const t of Object.values(s.tenants)) { t.movedInDay = -30; if (t.lease) t.lease.startDay = 0; }
      for (const id of Object.keys(s.staff)) { const m = s.staff[id]!; if (m.actorId) delete s.actors[m.actorId]; delete s.staff[id]; }   // nobody to take things off the ruler's desk
      // the fixture's applicant would stand at the empty hovel for three years (nothing here sends him home), and a door with someone at it is not "vacant"
      for (const id of Object.keys(s.applicants)) { const a = s.applicants[id]!; if (a.actorId) delete s.actors[a.actorId]; delete s.applicants[id]; }
      incidentsModule.init!(s);
      const lastSpawn: Record<string, number> = {};
      const count: Record<string, number> = {};
      const bySource: Record<SpawnSource, number> = { random: 0, chain: 0, system: 0, direct: 0 };
      const perMonth: number[] = [];
      const budget: number[] = [];                                           // what each month was planned at, from the households it began with
      const bad: string[] = [];
      let audiences = 0, maxOpen = 0, maxCourt = 0, winters = 0, seasonal = 0;
      HOOKS.onSpawn = (st, inc, def, openBefore, source) => {
        bySource[source]++;
        const cap = openCap(st);
        if (source === 'random') {
          const m = Math.floor(st.day / 30); perMonth[m] = (perMonth[m] ?? 0) + 1;
          if (def.audience) audiences++;
          if (def.seasons?.length) { seasonal++; if (def.seasons.every(x => x === 'winter')) winters++; }   // the real book's as well as the pin
          if (def.system) bad.push(`${def.id}: a system def was drawn at random`);
          if (!(def.weight > 0)) bad.push(`${def.id}: weight 0 was drawn`);
          if (m < BAL.quietMonths) bad.push(`${def.id}: drawn in the quiet first month`);
          if (rankIndex(st.realm.rank) < rankIndex(def.minRank) || (def.maxRank && rankIndex(st.realm.rank) > rankIndex(def.maxRank))) bad.push(`${def.id}: wrong rank`);
          if (def.seasons && !def.seasons.includes(seasonOf(st.day))) bad.push(`${def.id}: out of season on day ${st.day}`);
          const last = lastSpawn[def.id];
          if (last !== undefined && st.day - last < def.cooldownMonths * 30 - 1e-6) bad.push(`${def.id}: cooldown ${def.cooldownMonths}mo broken (${(st.day - last).toFixed(1)} days)`);
          if (last !== undefined && def.once) bad.push(`${def.id}: once, twice`);
          if (openBefore >= cap + 1 || (openBefore >= cap && def.urgency < 3)) bad.push(`${def.id}: drawn with ${openBefore} already open (cap ${cap}, urgency ${def.urgency})`);
          if (!fitsTarget(st, def, { ...(inc.buildingId ? { buildingId: inc.buildingId } : {}), ...(inc.tenantId ? { tenantId: inc.tenantId } : {}), ...(inc.applicantId ? { applicantId: inc.applicantId } : {}), ...(inc.unit !== null ? { unit: inc.unit } : {}) })) bad.push(`${def.id}: drawn on a target that does not fit`);
          if (inc.buildingId && openIncidents(st).some(i => i.buildingId === inc.buildingId)) bad.push(`${def.id}: two matters at one door`);
          const cat = inc.buildingId ? BUILDINGS[st.buildings[inc.buildingId]!.type].category : null;
          if (def.target === 'building' && !def.requires?.buildingType && !def.requires?.buildingCategory && cat !== 'housing' && cat !== 'commercial') bad.push(`${def.id}: an unnamed building incident landed on ${st.buildings[inc.buildingId!]!.type}`);
        }
        if (source === 'chain' && !def.system && (openBefore >= cap + 1 || (openBefore >= cap && def.urgency < 3))) bad.push(`${def.id}: chained in over the cap`);
        lastSpawn[def.id] = st.day; count[def.id] = (count[def.id] ?? 0) + 1;
      };
      // the ruler: answers about half of what is open each day, at random, and lets the rest run
      let pick = 12345, answeredOn = -1, answered = 0;
      const rnd = (): number => { pick = (pick * 1103515245 + 12345) & 0x7fffffff; return pick / 0x7fffffff; };
      drive(s, 1080, st => {
        const open = Object.values(st.incidents).filter(i => i.state === 'open');
        const live = openIncidents(st).length;
        maxOpen = Math.max(maxOpen, live);
        const mi = Math.floor(st.day / 30);
        if (budget[mi] === undefined) budget[mi] = Math.min(BAL.incidentRate.max, BAL.incidentRate.base + BAL.incidentRate.perHousehold * Object.values(st.tenants).filter(t => t.status === 'housed').length);
        const court = open.filter(i => i.actorId && st.actors[i.actorId]?.kind === 'petitioner').length;
        maxCourt = Math.max(maxCourt, court);
        const today = Math.floor(st.day);
        if (today === answeredOn) return;                                    // once a day, whatever hour the reign began
        answeredOn = today;
        // standing in for tenants.ts: an applicant nobody shows round gives up and goes
        for (const a of Object.values(st.applicants)) if (st.day > a.leavesDay) { if (a.actorId) delete st.actors[a.actorId]; delete st.applicants[a.id]; }
        for (const inc of open) {
          if (rnd() > 0.5) continue;
          const def = INCIDENT_BY_ID[inc.defId]!;
          const o = def.outcomes[Math.floor(rnd() * def.outcomes.length)]!;
          if (resolveIncident(st, inc.id, o.id, 'ruler').ok) answered++;
        }
      });
      assert.ok(answered > 20, `${rank}: the ruler in this test really did answer things (${answered})`);
      HOOKS.onSpawn = null;
      assert.deepEqual(bad.slice(0, 8), [], `${rank}: the scheduler kept its rules`);
      const cap = openCap(s);
      assert.ok(maxOpen <= cap + 1, `${rank}: never more than cap + 1 open (saw ${maxOpen}, cap ${cap})`);
      assert.ok(maxCourt <= INC_TUNE.courtRoom, `${rank}: never more than ${INC_TUNE.courtRoom} petitioners at court (saw ${maxCourt})`);
      // What must never happen is asked of these three years. What must happen (a winter incident does come, a vacancy does
      // draw trouble) is asked below, of a book with only that pin in it: here it would hang on the luck of the draw.
      assert.ok((count.zz_once ?? 0) <= 1, `${rank}: the once-only incident never came twice`);
      assert.equal(count.zz_needs_gold ?? 0, 0); assert.equal(count.zz_statue ?? 0, rank === 'reeve' ? 0 : count.zz_statue, 'no statue, no statue incident');
      if (rank === 'reeve') { assert.equal(count.zz_knight ?? 0, 0); assert.equal(count.zz_statue ?? 0, 0); }
      else assert.equal(count.zz_reeve_only ?? 0, 0);
      // (that none came out of season is in `bad` above, for every seasonal def in the book)
      void winters; void seasonal;
      assert.ok((count.zz_chain_dst ?? 0) <= (count.zz_chain_src ?? 0), 'only as follow-ups');
      const span = 36 - BAL.quietMonths;
      const rate = budget.slice(BAL.quietMonths, 36).reduce((a, b) => a + (b ?? 0), 0) / span;
      const months = perMonth.slice(BAL.quietMonths, 36);
      const mean = months.reduce((a, b) => a + (b ?? 0), 0) / span;
      const scripted = Math.floor(INC_TUNE.firstAudienceDay / 30);             // the first audience of a reign is a beat of its own, on top of that month's draws
      for (let m = BAL.quietMonths; m < 36; m++) assert.ok((perMonth[m] ?? 0) <= Math.ceil(budget[m] ?? 0) + (m === scripted ? 1 : 0), `${rank}: month ${m} drew ${perMonth[m]} against a budget of ${(budget[m] ?? 0).toFixed(2)}`);
      assert.ok(mean <= rate + 0.3, `${rank}: no more than the monthly budget (${mean.toFixed(2)} a month against ${rate.toFixed(2)})`);
      assert.ok(mean >= Math.min(rate, cap) * 0.45, `${rank}: and a fair share of it gets through (${mean.toFixed(2)} a month against ${rate.toFixed(2)})`);
      const share = audiences / Math.max(1, bySource.random);
      assert.ok(share > 0.1 && share < 0.45, `${rank}: roughly one in four is an audience (${(share * 100).toFixed(0)}%)`);
      assert.equal(Object.values(s.actors).filter(a => a.kind === 'petitioner').length <= INC_TUNE.courtRoom + 3, true, 'departed petitioners do not pile up');
      assert.ok(Object.keys(s.incidents).length <= INC_TUNE.keepClosed + cap + 2, 'closed incidents are pruned');
      assert.ok(s.pending.length < 30, 'nothing piles up in pending');
      assertSane(s, rank + ' after three years');
      console.log(`      ${rank}: ${bySource.random} random (${mean.toFixed(2)}/month, budget ${rate.toFixed(2)}), ${(share * 100).toFixed(0)}% audiences, ${bySource.chain} chained, peak open ${maxOpen}/${cap}, peak at court ${maxCourt}`);
    }
    // ── and what must happen does: each pin alone in the book (with the pipeline's own), so nothing rests on luck ──
    const book = INCIDENTS.slice();
    const pin = (id: string): IncidentDef => extra.find(d => d.id === id)!;
    const alone = (rank: 'reeve' | 'knight' | 'baron', ids: string[], days = 360): { id: string; day: number; source: SpawnSource }[] => {
      INCIDENTS.length = 0; INCIDENTS.push(...book.filter(d => d.system), ...ids.map(pin));
      const s = realm(rank, 0.2);
      s.seed = 5; s.rng = 777 + rankIndex(rank);
      for (const t of Object.values(s.tenants)) { t.movedInDay = -30; if (t.lease) t.lease.startDay = 0; }
      for (const id of Object.keys(s.applicants)) { const a = s.applicants[id]!; if (a.actorId) delete s.actors[a.actorId]; delete s.applicants[id]; }
      incidentsModule.init!(s);
      const log: { id: string; day: number; source: SpawnSource }[] = [];
      HOOKS.onSpawn = (st, _inc, def, _open, source) => { if (def.id.startsWith('zz_')) log.push({ id: def.id, day: st.day, source }); };
      try {
        drive(s, days, st => {                                               // a ruler who sees to each of them the day it comes
          for (const inc of Object.values(st.incidents)) if (inc.state === 'open' && inc.defId.startsWith('zz_')) resolveIncident(st, inc.id, 'do', 'ruler');
          // standing in for the lettings: nobody comes to look at the empty hovel, and nobody climbs in at the back (a door
          // with someone at it, or with faces at the window, is not "vacant" to the scheduler)
          for (const a of Object.values(st.applicants)) { if (a.actorId) delete st.actors[a.actorId]; delete st.applicants[a.id]; }
          for (const b of Object.values(st.buildings)) if (b.squatters && !incidentsAt(st, b.id).length) b.squatters = null;
        });
      } finally { HOOKS.onSpawn = null; INCIDENTS.length = 0; INCIDENTS.push(...book); }
      return log;
    };
    const n = (log: { id: string }[], id: string): number => log.filter(x => x.id === id).length;
    const winter = alone('reeve', ['zz_winter']);
    assert.ok(n(winter, 'zz_winter') >= 2, `winter incidents came in winter (${n(winter, 'zz_winter')} in one winter)`);
    assert.ok(winter.every(x => seasonOf(x.day) === 'winter'), 'and at no other time of year');
    assert.equal(n(alone('reeve', ['zz_once']), 'zz_once'), 1, 'the once-only incident came exactly once');
    assert.ok(n(alone('reeve', ['zz_reeve_only']), 'zz_reeve_only') > 0, 'a Reeve\'s troubles come to a Reeve');
    assert.equal(n(alone('baron', ['zz_reeve_only']), 'zz_reeve_only'), 0, 'and not to a Baron');
    assert.equal(n(alone('reeve', ['zz_knight', 'zz_statue', 'zz_needs_gold']), 'zz_knight'), 0, 'a Knight\'s do not');
    const baron = alone('baron', ['zz_knight', 'zz_statue', 'zz_needs_gold']);
    assert.ok(n(baron, 'zz_knight') > 0 && n(baron, 'zz_statue') > 0, 'a Baron has a Knight\'s troubles, and a statue to have trouble with');
    assert.equal(n(baron, 'zz_needs_gold'), 0);
    assert.ok(n(alone('reeve', ['zz_vacant']), 'zz_vacant') > 0, 'vacant units draw their own trouble');
    const chain = alone('reeve', ['zz_chain_src', 'zz_chain_dst']);
    assert.ok(n(chain, 'zz_chain_dst') > 0 && chain.filter(x => x.id === 'zz_chain_dst').every(x => x.source === 'chain'), `chained follow-ups arrive, and only as follow-ups (${JSON.stringify(chain.map(x => x.id + ':' + x.source))})`);
    assert.ok(n(chain, 'zz_chain_dst') <= n(chain, 'zz_chain_src'));
  } finally {
    HOOKS.onSpawn = null;
    for (const d of extra) { const i = INCIDENTS.indexOf(d); if (i >= 0) INCIDENTS.splice(i, 1); delete INCIDENT_BY_ID[d.id]; }
  }
});

test('the scheduler never draws a follow-up (weight 0) or one of the pipeline\'s own, even when they are all there is', () => {
  const book = INCIDENTS.slice();
  const followUps = book.filter(d => !d.system && !(d.weight > 0));
  assert.ok(followUps.length > 0 && followUps.some(d => d.id === 'griffin_sheep_claim'), 'the real book has follow-ups that only a chain may bring');
  const year = (rank: 'reeve' | 'baron'): { random: string[]; other: string[] } => {
    const s = realm(rank, 0.2);
    s.seed = 7; s.rng = 99 + rankIndex(rank);
    for (const t of Object.values(s.tenants)) { t.movedInDay = -30; if (t.lease) t.lease.startDay = 0; }
    for (const id of Object.keys(s.applicants)) { const a = s.applicants[id]!; if (a.actorId) delete s.actors[a.actorId]; delete s.applicants[id]; }
    incidentsModule.init!(s);
    const random: string[] = [], other: string[] = [];
    HOOKS.onSpawn = (_st, inc, def, _open, source) => {
      (source === 'random' ? random : other).push(def.id);
      if (source === 'random' && def.decision === 'applicant' && def.requires?.species) {
        const who = inc.applicantId ? _st.applicants[inc.applicantId] : null;
        assert.ok(who && def.requires.species.includes(who.household.species), `${def.id}: the household sent for is one of the species it names`);
        assert.ok(fitsTarget(_st, def, { applicantId: who.id, buildingId: who.buildingId, unit: who.unit }));
      }
    };
    // (standing in for tenants.ts: an applicant nobody shows round gives up and goes)
    try { drive(s, 360, st => { for (const a of Object.values(st.applicants)) if (st.day > a.leavesDay) { if (a.actorId) delete st.actors[a.actorId]; delete st.applicants[a.id]; } }); } finally { HOOKS.onSpawn = null; }
    return { random, other };
  };
  try {
    for (const rank of ['reeve', 'baron'] as const) {
      const full = year(rank);
      assert.ok(full.random.length > 5, `${rank}: with the whole book the scheduler is busy (${full.random.length} drawn)`);
      assert.deepEqual(full.random.filter(id => !(INCIDENT_BY_ID[id]!.weight > 0) || INCIDENT_BY_ID[id]!.system), [], `${rank}: none of them a follow-up or a system variant`);
      INCIDENTS.length = 0; INCIDENTS.push(...book.filter(d => d.system || !(d.weight > 0)));
      const bare = year(rank);
      assert.deepEqual(bare.random, [], `${rank}: with nothing else to draw, it draws nothing`);
      INCIDENTS.length = 0; INCIDENTS.push(...book);
    }
    // an applicant variant of the scheduler's own (not the pipeline's) sends for the household it names
    const call: IncidentDef = { ...INCIDENT_BY_ID['sys_applicant']!, id: 'zz_app_call', system: false, weight: 1, cooldownMonths: 1, minRank: 'reeve', requires: { species: ['dwarf'] } };
    const never: IncidentDef = { ...call, id: 'zz_app_never', requires: { tag: ['widow'] } };       // a tag cannot be sent for
    INCIDENTS.length = 0; INCIDENTS.push(...book.filter(d => d.system), call, never); INCIDENT_BY_ID[call.id] = call; INCIDENT_BY_ID[never.id] = never;
    const got = year('baron');
    assert.ok(!got.random.includes('zz_app_never'), 'a variant that wants a widow waits for the pipeline to bring one');
    if (!got.random.includes('zz_app_call')) note('the fixture has no door a dwarf could be sent to: the made-to-order applicant variant was not observed');
  } finally {
    HOOKS.onSpawn = null;
    INCIDENTS.length = 0; INCIDENTS.push(...book);
    delete INCIDENT_BY_ID['zz_app_call']; delete INCIDENT_BY_ID['zz_app_never'];
  }
});

test('the first beats of a reign: a leak on day 2, an applicant about day 12, an audience in month two', () => {
  const s = realm('reeve', 0);
  for (const id of Object.keys(s.applicants)) { const a = s.applicants[id]!; if (a.actorId) delete s.actors[a.actorId]; delete s.applicants[id]; }
  for (const t of Object.values(s.tenants)) t.movedInDay = -120;
  incidentsModule.init!(s);
  assert.equal(s.pending.length, 3);
  drive(s, 1.75);
  assert.equal(openIncidents(s).length, 0);
  drive(s, 0.5);
  const leak = openIncidents(s)[0]!;
  assert.equal(leak.defId, 'sys_repair_leak');
  const where = s.buildings[leak.buildingId!]!;
  assert.equal(where.type, 'hovel'); assert.ok(where.units[0]!.tenantId, 'an occupied hovel');
  resolveIncident(s, leak.id, 'defer', 'ruler');
  const seen = new Set<string>();
  HOOKS.onSpawn = (_s, _i, def, _n, source) => { if (source === 'random') seen.add((def.audience ? 'audience@' : 'pin@') + Math.floor(_s.day / 30)); };
  try { drive(s, 10.5, st => { for (const i of Object.values(st.incidents)) if (i.state === 'open') resolveIncident(st, i.id, INCIDENT_BY_ID[i.defId]!.outcomes[0]!.id, 'ruler'); }); } finally { /* keep the hook for the next stretch */ }
  const applicants = Object.values(s.applicants);
  if (applicants.length) { assert.equal(applicants.length, 1); assert.equal(s.buildings[applicants[0]!.buildingId]!.type, 'hovel', 'for the vacant hovel'); }
  else note('tenants.spawnApplicant returned nothing on the fixture; the day-12 applicant was not observed here');
  assert.ok(![...seen].some(x => x.endsWith('@0')), 'no random incidents in the quiet first month');
  try { drive(s, 40, st => { for (const i of Object.values(st.incidents)) if (i.state === 'open' && st.day - i.startedDay > 2) resolveIncident(st, i.id, INCIDENT_BY_ID[i.defId]!.outcomes[0]!.id, 'ruler'); }); } finally { HOOKS.onSpawn = null; }
  assert.ok(seen.has('audience@1'), 'the first audience comes in the second month: ' + [...seen].join(' '));
});

test('determinism: the same seed tells the same story', () => {
  const run = (): string => {
    const s = realm('knight', 0.2); s.rng = 777;
    incidentsModule.init!(s); staffModule.init!(s);
    let pick = 99, answeredOn = -1;
    const rnd = (): number => { pick = (pick * 1103515245 + 12345) & 0x7fffffff; return pick / 0x7fffffff; };
    drive(s, 400, st => { const today = Math.floor(st.day); if (today === answeredOn) return; answeredOn = today; for (const i of Object.values(st.incidents)) if (i.state === 'open' && rnd() < 0.4) resolveIncident(st, i.id, INCIDENT_BY_ID[i.defId]!.outcomes[Math.floor(rnd() * INCIDENT_BY_ID[i.defId]!.outcomes.length)]!.id, 'ruler'); });
    return JSON.stringify({ ...s, _events: [] });
  };
  const a = run(), b = run();
  assert.equal(a.length, b.length);
  assert.ok(a === b, 'two runs from one seed are identical');
});

// ═════════════ 10. a whole reign ═════════════

test('Sim.create(): three years with every module running, a ruler who answers some things and ignores others', () => {
  const where = (e: unknown): string => (e instanceof Error ? (e.stack ?? e.message).split('\n').slice(0, 4).join(' | ') : String(e));
  putVariantsBack();                                                        // the whole of the content, as shipped
  let sim: Sim;
  try { sim = Sim.create({ seed: 20261, ruler: 'Tess', mode: 'peace' }); }
  catch (e) { if (/src\/sim\/(effects|incidents|orders|staff)\.ts/.test(where(e))) throw e; note('Sim.create() threw outside sim-decide: ' + where(e)); return; }
  const s = sim.state;
  assert.equal(s.candidates.length, 9, 'candidates wait at the gate from day one');
  assert.equal(s.pending.filter(p => p.defId.startsWith('*first_')).length, 3, 'the first beats are scheduled');
  let pick = 7;
  const rnd = (): number => { pick = (pick * 1103515245 + 12345) & 0x7fffffff; return pick / 0x7fffffff; };
  let resolved = 0, refusals = 0, maxOpen = 0, days = 0;
  const kinds = new Set<string>();
  try {
    for (let d = 0; d < 1080 && !s.ended; d++) {
      sim.advanceDays(1); days++;
      const open = Object.values(s.incidents).filter(i => i.state === 'open');
      maxOpen = Math.max(maxOpen, openIncidents(s).length);
      for (const inc of open) {
        kinds.add(inc.defId);
        if (rnd() > 0.4) continue;
        const def = INCIDENT_BY_ID[inc.defId]!;
        const o = def.outcomes[Math.floor(rnd() * def.outcomes.length)]!;
        const r = sim.dispatch({ type: 'resolve_incident', incidentId: inc.id, outcomeId: o.id });
        if (r.ok) resolved++; else refusals++;
      }
      // a ruler who also hires when he can, and collects
      if (d % 30 === 5) {
        sim.dispatch({ type: 'collect_all' });
        for (const c of s.candidates) if (!staffOf(s, c.role)) sim.dispatch({ type: 'hire', candidateId: c.id });
        if (s.charter.ready) sim.dispatch({ type: 'accept_promotion' });
      }
      assert.ok(Number.isFinite(s.gold) && Number.isFinite(s.renown) && Number.isFinite(s.favor), 'no NaN on day ' + d);
    }
  } catch (e) {
    if (/src\/sim\/(effects|incidents|orders|staff)\.ts/.test(where(e)) || (e instanceof assert.AssertionError)) throw e;
    note(`full reign stopped on day ${days} by a throw outside sim-decide: ${where(e)}`);
  }
  assertSane(s, 'after the reign');
  for (const inc of Object.values(s.incidents)) assert.ok(INCIDENT_BY_ID[inc.defId], 'every incident has a def');
  console.log(`      ${days} days, rank ${s.realm.rank}, ${Object.values(s.tenants).filter(t => t.status === 'housed').length} households, gold ${Math.round(s.gold)}; ${s.stats.incidentsResolved} resolved (${resolved} by this ruler, ${refusals} refused), ${s.stats.incidentsIgnored} ignored, peak open ${maxOpen}; kinds seen: ${[...kinds].slice(0, 14).join(', ')}${kinds.size > 14 ? ', ...' : ''}`);
  if (FX.errors.length) note(`${FX.errors.length} effect(s) threw during the reign and were skipped. First: ${FX.errors[0]!.effect}: ${FX.errors[0]!.error.split('\n').slice(0, 3).join(' | ')}`);
  setVariantsAside();
});

// ═════════════ 11. what the feed says ═════════════

/** Every line this module writes for the feed fits the herald's 150 characters. */
function assertFeedFits(s: GameState, where: string): void {
  for (const h of s.heralds) if (h.kind === 'staff') assert.ok(h.text.length <= 150, `${where}: a staff line of ${h.text.length} characters: "${h.text}"`);
}

test('an offer of a lease is told by what the household did about it', () => {
  // a plain welcome: the signing is announced once, by the people who signed
  const s = realm('reeve'); const ap = applicantAt(s);
  const inc = spawnDecision(s, 'applicant', { applicantId: ap.id, buildingId: ap.buildingId, unit: ap.unit })!;
  s.heralds = [];
  assert.ok(resolveIncident(s, inc.id, 'accept', 'ruler').ok);
  assert.equal(s.tenants[ap.household.id]?.status, 'housed');
  assert.equal(s.heralds.filter(h => h.text.includes('Jory Applewhite')).length, 1, 'one line, not two: ' + heraldText(s));
  assert.ok(!/signed for/.test(heraldText(s)));

  // a higher rent they will pay: the result line is the news
  const s2 = realm('reeve'); const ap2 = applicantAt(s2); ap2.maxRent = 999;
  const asking = s2.buildings[ap2.buildingId]!.rent;
  const i2 = spawnDecision(s2, 'applicant', { applicantId: ap2.id, buildingId: ap2.buildingId, unit: ap2.unit })!;
  assert.ok(resolveIncident(s2, i2.id, 'counter', 'ruler').ok);
  const t2 = s2.tenants[ap2.household.id]!;
  assert.equal(t2.status, 'housed'); assert.equal(t2.lease!.rent, Math.max(1, Math.round(asking * 1.1)));
  assert.match(heraldText(s2), /signed for .* at a rent above the posted one, and noticed/);

  // a higher rent they will not pay: they go, and nobody claims they signed
  const s3 = realm('reeve'); const ap3 = applicantAt(s3); ap3.maxRent = s3.buildings[ap3.buildingId]!.rent;
  s3.buildings[ap3.buildingId]!.rent = 20; ap3.maxRent = 20;
  const i3 = spawnDecision(s3, 'applicant', { applicantId: ap3.id, buildingId: ap3.buildingId, unit: ap3.unit })!;
  s3.heralds = [];
  assert.ok(resolveIncident(s3, i3.id, 'counter', 'ruler').ok);
  assert.equal(i3.state, 'resolved');
  assert.equal(s3.tenants[ap3.household.id], undefined, 'they did not sign');
  assert.equal(s3.applicants[ap3.id], undefined, 'and they did not stay');
  assert.ok(!/signed/.test(heraldText(s3)), 'the feed does not say they signed: ' + heraldText(s3));
  assert.equal(openIncidents(s3).length, 0);
});

test('a delegate with a petition of their own comes to the seat between jobs, and goes back to work after', () => {
  const def = synth('zz_staff_pet', { target: 'realm', audience: true, petitioner: 'staff', requires: { hasStaff: ['mason'] }, opening: ['About my wage.', 'A word, if I may.'], stance: 'Wants a rise and has rehearsed the asking.', herald: '{staff} would like a word about the wage.', timerDays: 12 });
  INCIDENTS.push(def); INCIDENT_BY_ID[def.id] = def;
  try {
    const s = realm('knight');
    const hob = staffOf(s, 'mason')!; const actor = s.actors[hob.actorId!]!;
    const seat = Object.values(s.buildings).find(b => b.type === 'seat')!;
    actor.state = 'working'; actor.path = [];
    const inc = spawnIncident(s, def.id, {})!;
    assert.equal(inc.state, 'open');
    assert.equal(inc.vars.staff, 'Hob'); assert.ok(s.heralds.some(h => h.text === 'Hob would like a word about the wage.'));
    assert.equal(inc.actorId, actor.id, 'the petitioner is the delegate\'s own figure');
    assert.equal(actor.path.length, 0, 'he finishes what he is doing first');
    actor.state = 'idle';
    incidentsModule.onDay!(s, Math.floor(s.day) + 1);
    const end = actor.path[actor.path.length - 1]!;
    assert.ok(end && Math.hypot(end[0] - (seat.x + seat.w / 2), end[1] - (seat.y + seat.h / 2)) < 5, 'then he walks to the seat');
    // other petitioners do not take his place in the queue, nor he theirs
    const late = Object.values(s.tenants).filter(t => t.status === 'housed').slice(0, 3).map(t => spawnDecision(s, 'late_rent', { tenantId: t.id })!);
    const ends = [actor, ...late.map(i => s.actors[i.actorId!]!)].map(a => (a.path[a.path.length - 1] ?? [a.x, a.y]).map(v => v.toFixed(2)).join(','));
    assert.equal(late.filter(i => i.actorId).length, 3, 'a delegate does not count against the room at court');
    assert.equal(new Set(ends).size, 4, 'four figures, four places: ' + ends.join(' '));
    assert.ok(resolveIncident(s, inc.id, 'do', 'ruler').ok);
    assert.equal(inc.actorId, null);
    assert.ok(s.actors[actor.id], 'the delegate is still on the table, and still employed');
    assert.equal(staffOf(s, 'mason')!.id, hob.id);
    // no mason, no petition: the scheduler would never draw it, and a direct spawn names the post instead
    const s2 = realm('reeve');
    const i2 = spawnIncident(s2, def.id, {})!;
    assert.equal(i2.vars.staff, 'the Mason'); assert.equal(i2.actorId, null);
    assert.equal(fitsTarget(s2, def, {}), false);
  } finally {
    INCIDENTS.splice(INCIDENTS.indexOf(def), 1); delete INCIDENT_BY_ID[def.id];
  }
});

test('the feed minds its articles, and an animal is ruled on once', () => {
  assert.equal(fillText('{tenant}, a {species} {trade}, has seen {building}.', { tenant: 'Ffion', species: 'elf', trade: 'bard', building: 'Alderlight' }), 'Ffion, an elf bard, has seen Alderlight.');
  assert.equal(fillText('A {pet} is not livestock. It is a {pet}.', { pet: 'owl' }), 'An owl is not livestock. It is an owl.');
  assert.equal(fillText('An {species} {trade} and a {species} {trade}.', { species: 'human', trade: 'alchemist' }), 'A human alchemist and a human alchemist.');
  assert.equal(fillText('It is a {btype}, a {amount} crown one, a {missing} thing.', { btype: 'apothecary', amount: 8 }), 'It is an apothecary, a 8 crown one, a thing.');
  assert.equal(fillText('a {x} and a {y}', { x: 'unicorn', y: 'usurer' }), 'a unicorn and a usurer');
  // in the feed itself
  const s = realm('baron'); const ap = applicantAt(s); ap.household.species = 'elf'; ap.household.trade = 'alchemist';
  spawnDecision(s, 'applicant', { applicantId: ap.id, buildingId: ap.buildingId, unit: ap.unit }, { _ruler: 1 });
  assert.ok(s.heralds.some(h => /Jory Applewhite, an elf alchemist, has seen /.test(h.text)), heraldText(s));

  // Gerald has had his audience. If his household also turns out to have "a secret pet", it is not Gerald again.
  const r = realm('reeve');
  const t = tenantIn(r, 'hovel');
  const g = spawnIncident(r, 'unauthorized_griffin', { tenantId: t.id })!;
  assert.ok(resolveIncident(r, g.id, 'pet_rent', 'ruler').ok);
  assert.deepEqual(t.pets, ['griffin']);
  assert.equal(spawnDecision(r, 'pet', { tenantId: t.id }), null, 'ruled on once');
  t.pets = ['cat', 'griffin'];
  assert.ok(spawnDecision(r, 'pet', { tenantId: t.id }), 'a cat nobody mentioned is a new matter');
  // and when the household goes, the note goes with it
  assert.ok(Object.keys(r.incidentLog).some(k => k.startsWith('~pet.' + t.id)));
  delete r.tenants[t.id]; for (const b of Object.values(r.buildings)) for (const u of b.units) if (u.tenantId === t.id) u.tenantId = null;
  incidentsModule.onDay!(r, Math.floor(r.day) + 1);
  assert.ok(!Object.keys(r.incidentLog).some(k => k.startsWith('~pet.' + t.id)));
});

// ═════════════ 12. pressure ═════════════

test('under pressure: when everything goes wrong at once the caps hold, and the court takes three', () => {
  const rate = BAL.incidentRate as { base: number; perHousehold: number; max: number };
  const was = { ...rate };
  Object.assign(rate, { base: 16, perHousehold: 0, max: 16 });
  const extra: IncidentDef[] = [
    synth('zz_p_pin_a', { cooldownMonths: 0, timerDays: 24 }),
    synth('zz_p_pin_b', { cooldownMonths: 0, timerDays: 24, target: 'tenant' }),
    synth('zz_p_realm', { cooldownMonths: 0, timerDays: 24, target: 'realm' }),
    synth('zz_p_urgent', { cooldownMonths: 0, timerDays: 24, target: 'realm', urgency: 3 }),
    synth('zz_p_aud_a', { cooldownMonths: 0, timerDays: 24, target: 'tenant', audience: true, petitioner: 'tenant', opening: ['A word.', 'If I may.'], stance: 'Has a grievance and all day to air it.', weight: 2 }),
    synth('zz_p_aud_b', { cooldownMonths: 0, timerDays: 24, target: 'realm', audience: true, petitioner: { npc: 'tax_collector' }, opening: ['The books.', 'Your books.'], stance: 'Wants to see the books and will wait.', weight: 2 }),
    synth('zz_p_aud_urgent', { cooldownMonths: 0, timerDays: 24, target: 'realm', audience: true, urgency: 3, petitioner: { npc: 'royal_assessor' }, opening: ['By order.', 'I am expected.'], stance: 'Is here to assess, and has begun.', weight: 2 }),
  ];
  for (const d of extra) { INCIDENTS.push(d); INCIDENT_BY_ID[d.id] = d; }
  try {
    for (const rank of ['reeve', 'knight', 'baron'] as const) {
      const s = realm(rank, 0.2);
      s.rng = 9000 + rankIndex(rank);
      for (const t of Object.values(s.tenants)) t.movedInDay = -400;
      for (const id of Object.keys(s.staff)) { const m = s.staff[id]!; if (m.actorId) delete s.actors[m.actorId]; delete s.staff[id]; }
      for (const id of Object.keys(s.applicants)) { const a = s.applicants[id]!; if (a.actorId) delete s.actors[a.actorId]; delete s.applicants[id]; }
      incidentsModule.init!(s);
      s.pending = [];                                                       // no scripted beats: only the month's draws
      const cap = openCap(s);
      const bad: string[] = [];
      let maxOpen = 0, maxCourt = 0, urgentOver = 0, draws = 0, daysFull = 0, ticks = 0;
      HOOKS.onSpawn = (st, _inc, def, openBefore, source) => {
        if (source !== 'random') return;
        draws++;
        if (openBefore > cap) bad.push(`${def.id}: drawn with ${openBefore} open, over cap ${cap} + 1`);
        if (openBefore === cap) { if (def.urgency < 3) bad.push(`${def.id}: not urgent, drawn at the cap`); else urgentOver++; }
        const atCourt = Object.values(st.incidents).filter(i => i.state === 'open' && i.actorId && st.actors[i.actorId]?.kind === 'petitioner').length;
        if (def.audience && atCourt >= INC_TUNE.courtRoom) bad.push(`${def.id}: an audience drawn with the court full`);
      };
      // a ruler who answers nothing at all: only the timers clear the table
      drive(s, 360, st => {
        const live = openIncidents(st).length;
        maxOpen = Math.max(maxOpen, live); ticks++; if (live >= cap) daysFull++;
        maxCourt = Math.max(maxCourt, Object.values(st.actors).filter(a => a.kind === 'petitioner' && Object.values(st.incidents).some(i => i.state === 'open' && i.actorId === a.id)).length);
      });
      HOOKS.onSpawn = null;
      assert.deepEqual(bad.slice(0, 6), [], `${rank}: the caps held`);
      assert.equal(maxOpen, cap + 1, `${rank}: the table filled to the cap, and one urgent matter squeezed in (saw ${maxOpen}, cap ${cap})`);
      assert.ok(urgentOver > 0, `${rank}: an urgent matter did exceed the cap by one`);
      // No further than the court's room at any rank. That it does fill is asked of the Baron only: a Reeve's table holds four
      // matters at most, and whether three of those four are ever audiences at once depends on what the book happens to hold.
      assert.ok(maxCourt <= INC_TUNE.courtRoom, `${rank}: the court never took more than ${INC_TUNE.courtRoom} (saw ${maxCourt})`);
      if (rank === 'baron') assert.equal(maxCourt, INC_TUNE.courtRoom, `${rank}: the court filled to ${INC_TUNE.courtRoom} and no further (saw ${maxCourt})`);
      assert.ok(daysFull / ticks > 0.5, `${rank}: this really was pressure (${Math.round(100 * daysFull / ticks)}% of the year at or over the cap)`);
      assert.ok(draws < 16 * 11, `${rank}: slots that find the realm full are dropped at the month's end, not saved up (${draws} draws)`);
      assert.ok(s.pending.length < 40, `${rank}: nothing piles up in pending (${s.pending.length})`);
      assert.ok(Object.values(s.actors).filter(a => a.kind === 'petitioner').length <= INC_TUNE.courtRoom + 3, `${rank}: departed petitioners do not pile up`);
      assertSane(s, rank + ' under pressure');
      console.log(`      ${rank}: ${draws} drawn in a year at 16 a month wanted, peak open ${maxOpen}/${cap}, peak at court ${maxCourt}, ${urgentOver} urgent over the cap, ${s.stats.incidentsIgnored} ran their course`);
    }
  } finally {
    HOOKS.onSpawn = null;
    Object.assign(rate, was);
    for (const d of extra) { INCIDENTS.splice(INCIDENTS.indexOf(d), 1); delete INCIDENT_BY_ID[d.id]; }
  }
});

// ═════════════ 13. any valid def ═════════════

/** A content writer with no taste and a seeded die: every field the schema allows, in combinations nobody would choose. */
function fuzzDefs(count: number, seed: number): IncidentDef[] {
  let x = seed;
  const rnd = (): number => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; };
  const of = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;
  const maybe = (p: number): boolean => rnd() < p;
  const int = (a: number, b: number): number => a + Math.floor(rnd() * (b - a + 1));
  const DECISIONS = ['late_rent', 'eviction_ready', 'repair', 'applicant', 'move_out_deposit', 'squatters', 'pet', 'rent_renewal'] as const;
  const OPTS: Record<string, string[]> = { late_rent: ['wait', 'late_fee', 'payment_plan', 'forgive', 'notice', 'cash_for_keys'], eviction_ready: ['evict', 'cash_for_keys', 'mercy'], repair: ['fix', 'patch', 'defer', 'bill_tenant'], applicant: ['accept', 'reject', 'screen', 'counter'], move_out_deposit: ['return_all', 'fair', 'keep_all'], squatters: ['oust', 'bribe', 'lease', 'ignore'], pet: ['allow', 'pet_rent', 'ban'], rent_renewal: ['hold', 'raise', 'lower'] };
  const ROLES = ['mason', 'bailiff', 'crier', 'steward'] as const;
  const TEXT = 'About {tenant} ({first}), a {species} {trade} at {building}, a {btype}: {amount} crowns, rent {rent}, a {pet}. {title} {ruler} of {realm}, {rival}, {staff}, {season}, {month}, {nonsense}.';
  const effect = (ids: string[]): Effect => {
    switch (int(0, 24)) {
      case 0: return { t: 'gold', amount: of([0, 5, 40, -3, -25, -4000]), ...(maybe(0.6) ? { memo: of(['A bribe for {tenant}', 'Court costs', 'A wedding gift', 'New thatch', 'A fee', 'Sundries {nonsense}']) } : {}) };
      case 1: return { t: 'renown', amount: of([-200, -3, 0, 2, 150]) };
      case 2: return { t: 'favor', amount: of([-200, -3, 0, 2, 150]) };
      case 3: return { t: 'happiness', amount: of([-150, -8, 0, 6, 150]), ...(maybe(0.7) ? { scope: of(['tenant', 'building', 'neighbors', 'all'] as const) } : {}) };
      case 4: return { t: 'condition', amount: of([-150, -12, 0, 9, 150]) };
      case 5: return { t: 'rent', pct: of([-200, -10, 0, 10, 300]) };
      case 6: return { t: 'arrears', amount: of([0, 9, -50, 100000, 'forgive'] as const) };
      case 7: return { t: 'late', option: of(['wait', 'late_fee', 'payment_plan', 'forgive', 'notice', 'cash_for_keys', 'evict', 'mercy', 'fix', 'hold'] as const) };
      case 8: return { t: 'evict' };
      case 9: return { t: 'leave' };
      case 10: return { t: 'deposit', keepPct: of([-1, 0, 50, 100, 250]) };
      case 11: return { t: 'lease', accept: maybe(0.6), ...(maybe(0.5) ? { rentPct: of([0, 80, 110, 900]) } : {}) };
      case 12: return { t: 'screen' };
      case 13: return { t: 'memory', text: of(['You did a thing for {tenant}.', '{nonsense}', 'Plain words.']), valence: of([-2, -1, 1, 2] as const) };
      case 14: return { t: 'trait', ...(maybe(0.5) ? { add: of(TRAITS) } : {}), ...(maybe(0.5) ? { reveal: of(TRAITS) } : {}), ...(maybe(0.3) ? { remove: of(TRAITS) } : {}) };
      case 15: return maybe(0.5) ? { t: 'pet', add: of(PET_KINDS) } : { t: 'pet', remove: true };
      case 16: return { t: 'flag', key: of(['zz_a', 'zz_b']), ...(maybe(0.5) ? { value: of([true, false, 3, 'x']) } : {}), ...(maybe(0.5) ? { scope: of(['realm', 'building'] as const) } : {}) };
      case 17: return maybe(0.5) ? { t: 'visual', add: of(VISUALS) } : { t: 'visual', remove: of(VISUALS) };
      case 18: return { t: 'squatters', set: maybe(0.3) ? null : of(SQUATTER_KINDS) };
      case 19: return { t: 'squatters_sign_lease' };
      case 20: return { t: 'spawn', id: of([...ids, 'sys_repair_leak', 'zz_no_such_incident']), delayDays: of([0, 1, 6]), ...(maybe(0.5) ? { chance: of([0, 0.5, 1]) } : {}) };
      case 21: return { t: 'oath', kind: of(['repair', 'no_rent_raise', 'no_evict', 'build', 'pay', 'rent_cap', 'word'] as const), months: of([0, 1, 6]), text: of(['I will see {tenant} right.', 'The roof of {building} will be mended.']) };
      case 22: return { t: 'applicant', ...(maybe(0.5) ? { species: of(SPECIES) } : {}), ...(maybe(0.5) ? { trade: of(TRADES) } : {}) };
      case 23: return { t: 'loyalty', role: of(ROLES), amount: of([-150, -5, 4, 150]) };
      default: return { t: 'herald', text: of(['Word of {tenant} got about.', '{nonsense}', 'A thing occurred at {building}.']), ...(maybe(0.5) ? { kind: of(['info', 'good', 'bad', 'urgent', 'crown', 'staff', 'rival', 'oath'] as const) } : {}) };
    }
  };
  const ids = Array.from({ length: count }, (_, i) => 'zz_fz_' + i);
  return ids.map((id): IncidentDef => {
    const decision = maybe(0.5) ? 'custom' : of(DECISIONS);
    const target = of(['tenant', 'tenant', 'building', 'building', 'vacant', 'realm'] as const);
    const audience = maybe(0.5);
    const opts = decision === 'custom' ? [] : OPTS[decision]!.slice().sort(() => rnd() - 0.5);
    const n = int(2, 4);
    const defaultAt = maybe(0.7) ? int(0, n - 1) : -1;
    const outcomes: OutcomeDef[] = Array.from({ length: n }, (_, k): OutcomeDef => ({
      id: 'o' + k, ...(opts[k] ? { option: opts[k] as NonNullable<OutcomeDef['option']> } : {}), label: 'Do thing ' + k, say: 'Do {nonsense} thing ' + k + '.', intent: 'The ruler wants thing ' + k + ' done.',
      ...(maybe(0.4) ? { job: { role: of([...ROLES, 'ruler', 'any'] as const), days: of([0, 0.5, 2]), cost: of([0, 4, 30]) } } : {}),
      effects: Array.from({ length: int(0, 5) }, () => effect(ids)), reply: TEXT, result: TEXT, ...(k === defaultAt ? { default: true } : {}),
    }));
    const r: NonNullable<IncidentDef['requires']> = {};
    if (maybe(0.25)) r.buildingType = [of(['hovel', 'cottage', 'burrow', 'wizard_tower', 'statue', 'well', 'market_stall', 'seat', 'masons_yard'] as const)];
    else if (maybe(0.3)) r.buildingCategory = [of(['housing', 'commercial', 'amenity', 'staff', 'seat'] as const)];
    if (maybe(0.15)) r.conditionBelow = of([30, 60]); if (maybe(0.1)) r.conditionAbove = of([20, 50]);
    if (maybe(0.15)) r.species = [of(SPECIES)]; if (maybe(0.15)) r.trade = [of(TRADES)];
    if (maybe(0.15)) r.trait = [of(TRAITS)]; if (maybe(0.15)) r.tag = [of(TENANT_TAGS)];
    if (maybe(0.15)) r.hasPet = maybe(0.7); if (maybe(0.1)) r.pet = [of(PET_KINDS)];
    if (maybe(0.1)) r.happinessBelow = 60; if (maybe(0.1)) r.happinessAbove = 20; if (maybe(0.15)) r.monthsHousedAbove = of([1, 6]);
    if (maybe(0.15)) r.vacantDaysAbove = of([5, 40]);
    if (maybe(0.15)) r.hasStaff = [of(ROLES)]; if (maybe(0.1)) r.lacksStaff = [of(ROLES)];
    if (maybe(0.1)) r.hasBuilding = [of(['well', 'statue', 'tavern'] as const)]; if (maybe(0.1)) r.lacksBuilding = [of(['stocks', 'chapel'] as const)];
    if (maybe(0.1)) r.goldAbove = 50; if (maybe(0.1)) r.goldBelow = 5000; if (maybe(0.1)) r.renownAbove = 30; if (maybe(0.1)) r.renownBelow = 80;
    if (maybe(0.1)) r.favorAbove = 20; if (maybe(0.1)) r.favorBelow = 90; if (maybe(0.1)) r.householdsAbove = of([2, 12]);
    if (maybe(0.1)) r.flag = ['zz_a']; if (maybe(0.1)) r.notFlag = ['zz_b']; if (maybe(0.1)) r.buildingFlag = ['zz_a']; if (maybe(0.1)) r.notBuildingFlag = ['zz_b'];
    if (maybe(0.1)) r.policyPets = [of(['allow', 'pet_rent', 'ban'] as const)]; if (maybe(0.1)) r.yearAbove = of([1, 3]);
    return {
      id, title: 'Fuzz ' + id, category: of(['maintenance', 'payment', 'pest', 'pet', 'neighbor', 'legal', 'crown', 'weather', 'magic', 'squatter', 'rival', 'windfall', 'staff', 'lease', 'festival', 'commerce'] as const),
      decision, ...(maybe(0.25) ? { system: true } : {}), target, minRank: of(['reeve', 'reeve', 'knight', 'baron'] as const), ...(maybe(0.1) ? { maxRank: 'baron' as const } : {}),
      weight: of([0, 0.3, 1, 2]), cooldownMonths: of([0, 1, 6]), ...(maybe(0.15) ? { once: true } : {}), ...(maybe(0.3) ? { seasons: [of(['spring', 'summer', 'autumn', 'winter'] as const)] } : {}),
      ...(maybe(0.6) ? { requires: r } : {}), icon: 'bell', ...(maybe(0.4) ? { visual: of(VISUALS) } : {}), urgency: of([1, 2, 3] as const), timerDays: of([0, 3, 10]),
      audience, ...(audience ? { petitioner: of<NonNullable<IncidentDef['petitioner']>>(['tenant', 'applicant', 'neighbor', 'staff', { npc: of(NPCS) }]), opening: [TEXT, TEXT], stance: 'Wants something, at length.' } : {}),
      herald: TEXT, outcomes, onExpire: Array.from({ length: int(0, 4) }, () => effect(ids)), ...(maybe(0.7) ? { expireText: TEXT } : {}),
    };
  });
}

test('any valid def: four hundred written by a die spawn, resolve, expire, chain and are delegated without a throw', () => {
  const defs = fuzzDefs(400, 20261011);
  for (const d of defs) { INCIDENTS.push(d); INCIDENT_BY_ID[d.id] = d; }
  const throwsFrom = (fn: () => void, what: string): void => { try { fn(); } catch (e) { throw new Error(`${what}: ${e instanceof Error ? (e.stack ?? e.message) : e}`); } };
  let spawned = 0, resolved = 0, expired = 0, delegated = 0, declined = 0;
  const declinedBy: Record<string, number> = {};
  try {
    for (const def of defs) {
      for (const o of def.outcomes) {
        const { s, target } = fitted(def);
        let inc: Incident | null = null;
        throwsFrom(() => { inc = spawnIncident(s, def.id, target, { _ruler: 1 }); }, `${def.id}: spawn`);
        if (!inc) { declined++; const k = `${def.target}/${def.decision}`; declinedBy[k] = (declinedBy[k] ?? 0) + 1; continue; }   // no target of that shape can exist
        const live = inc as Incident;
        spawned++;
        assert.equal(live.state, 'open');
        for (const text of [def.herald, ...(def.opening ?? []), o.label, o.say, o.reply, o.result, def.expireText ?? '']) assert.ok(!TEXT_BAD.test(fill(text, live.vars)), `${def.id}: text reads cleanly: "${fill(text, live.vars)}"`);
        let r: ActionResult = { ok: true };
        throwsFrom(() => { r = resolveIncident(s, live.id, o.id, 'ruler'); }, `${def.id}.${o.id}: resolve`);
        assert.ok(r.ok, `${def.id}.${o.id}: resolves`);
        if (o.job) { assert.equal(live.state, 'in_progress'); throwsFrom(() => finishJob(s, live), `${def.id}.${o.id}: job done`); }
        assert.equal(live.state, 'resolved'); assert.equal(live.actorId, null);
        resolved++;
        throwsFrom(() => drive(s, 8), `${def.id}.${o.id}: the week after`);    // chained spawns come due, visuals are swept, petitioners go home
        assertSane(s, `${def.id}.${o.id}`);
      }
      {
        const { s, target } = fitted(def);
        let inc: Incident | null = null;
        throwsFrom(() => { inc = spawnIncident(s, def.id, target, { _ruler: 1 }); }, `${def.id}: spawn for expiry`);
        if (inc) {
          const live = inc as Incident;
          live.expiresDay = s.day - 0.01;
          throwsFrom(() => incidentsModule.step!(s, 0.01), `${def.id}: expire`);
          assert.equal(live.state, 'expired'); assert.equal(live.actorId, null);
          expired++;
          throwsFrom(() => drive(s, 8), `${def.id}: the week after expiry`);
          assertSane(s, `${def.id} expiry`);
        }
      }
      // and with a full household at full judgment, left to it
      for (const rank of ['knight', 'baron'] as const) {
        const { s, target } = fitted(def);
        s.realm.rank = rank;
        for (const m of Object.values(s.staff)) m.authority = rank === 'baron' ? 2 : 0;
        s.orders = [];
        throwsFrom(() => { act(s, { type: 'add_order', order: order({ to: 'all', incidentDef: def.id, rule: 'never', outcomeId: def.outcomes[0]!.id }) }); }, `${def.id}: an order against its first remedy`);
        let inc: Incident | null = null;
        throwsFrom(() => { inc = spawnIncident(s, def.id, target); }, `${def.id}: spawn before the household`);
        if (!inc) continue;
        const live = inc as Incident;
        if (live.resolvedBy && live.resolvedBy !== 'ruler') { delegated++; assert.notEqual(live.outcomeId, def.outcomes[0]!.id, `${def.id}: the forbidden remedy was not chosen`); assert.ok(live.reported); }
        throwsFrom(() => drive(s, 14, st => { for (const i of Object.values(st.incidents)) if (i.state === 'open' && st.day - i.startedDay > 6) resolveIncident(st, i.id, INCIDENT_BY_ID[i.defId]!.outcomes[0]!.id, 'ruler'); }), `${def.id}: a fortnight with the household (${rank})`);
        assertSane(s, `${def.id} delegated (${rank})`);
        assertFeedFits(s, def.id);
      }
    }
    // then all of them loose in one realm for two years, drawn by the scheduler, with a ruler who answers some
    for (const rank of ['reeve', 'baron'] as const) {
      const s = realm(rank, 0.2); s.rng = 31337;
      for (const t of Object.values(s.tenants)) t.movedInDay = -200;
      incidentsModule.init!(s);
      let x = 5, answeredOn = -1;
      const rnd = (): number => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; };
      throwsFrom(() => drive(s, 720, st => {
        const today = Math.floor(st.day); if (today === answeredOn) return; answeredOn = today;
        for (const a of Object.values(st.applicants)) if (st.day > a.leavesDay + 12) { if (a.actorId) delete st.actors[a.actorId]; delete st.applicants[a.id]; }
        for (const i of Object.values(st.incidents)) if (i.state === 'open' && rnd() < 0.3) { const d = INCIDENT_BY_ID[i.defId]!; resolveIncident(st, i.id, d.outcomes[Math.floor(rnd() * d.outcomes.length)]!.id, 'ruler'); }
      }), `two years of fuzz at ${rank}`);
      assertSane(s, `two years of fuzz at ${rank}`);
      assert.ok(Object.values(s.actors).filter(a => a.kind === 'petitioner').length <= INC_TUNE.courtRoom + 3);
      assert.ok(s.pending.length < 60, `pending stays small (${s.pending.length})`);
    }
  } finally {
    for (const d of defs) { INCIDENTS.splice(INCIDENTS.indexOf(d), 1); delete INCIDENT_BY_ID[d.id]; }
  }
  const mine = FX.errors.filter(e => /src\/sim\/(effects|incidents|orders|staff)\.ts/.test(e.error.split('\n')[1] ?? ''));
  assert.equal(mine.length, 0, 'no effect throws from inside sim-decide code: ' + (mine[0]?.error ?? ''));
  if (FX.errors.length) note(`fuzz: ${FX.errors.length}${FX.errors.length >= 50 ? '+' : ''} effect(s) threw inside an owning module and were skipped. First: ${FX.errors[0]!.effect}: ${FX.errors[0]!.error.split('\n').slice(0, 3).join(' | ')}`);
  assert.ok(spawned > 800 && resolved === spawned && expired > 250 && delegated > 150, `the die's work was really exercised (${spawned} spawned, ${resolved} resolved, ${expired} expired, ${delegated} delegated, ${declined} had no possible target)`);
  console.log(`      400 defs: ${spawned} spawned and resolved outcome by outcome, ${expired} expired, ${delegated} settled by an order-bound household, ${declined} outcome runs had no possible target (${Object.entries(declinedBy).map(([k, n]) => k + ' ' + n).join(', ')})`);
});

// ═════════════ 14. a reign worth having ═════════════

test('Sim.create(): five years under a ruler who shows vacancies, mends roofs, builds, hires and is promoted', () => {
  const where = (e: unknown): string => (e instanceof Error ? (e.stack ?? e.message).split('\n').slice(0, 4).join(' | ') : String(e));
  const PREFER = ['fix', 'accept', 'hold', 'payment_plan', 'fair', 'lease', 'pet_rent', 'cash_for_keys'];
  const YARDS: [StaffRole, BuildingType][] = [['mason', 'masons_yard'], ['bailiff', 'bailiffs_post'], ['crier', 'criers_stand'], ['steward', 'counting_house']];
  let reigns = 0, byStaff = 0, hired = 0, promoted = 0;
  putVariantsBack();                                                        // the whole of the content, as shipped
  for (const seed of [11, 23, 20261]) {
    let sim: Sim;
    try { sim = Sim.create({ seed, ruler: 'Tess', mode: 'peace' }); }
    catch (e) { if (/src\/sim\/(effects|incidents|orders|staff)\.ts/.test(where(e))) throw e; note('Sim.create() threw outside sim-decide: ' + where(e)); return; }
    const s = sim.state;
    const by: Record<string, number> = {};
    let maxCourt = 0, days = 0;
    sim.on(evs => { for (const e of evs) { if (e.type === 'incident_resolved') by[e.by] = (by[e.by] ?? 0) + 1; if (e.type === 'staff_hired') hired++; if (e.type === 'promotion') promoted++; } });
    const build = (btype: BuildingType): boolean => {
      if (s.gold < BUILDINGS[btype].cost + 40) return false;
      for (const p of s.map.parcels) { if (!p.owned) continue; for (let y = p.y; y < p.y + 8; y++) for (let x = p.x; x < p.x + 8; x++) for (const rot of [0, 2, 1, 3] as const) if (sim.dispatch({ type: 'place_building', btype, x, y, rot }).ok) return true; }
      return false;
    };
    try {
      for (let d = 0; d < 1800 && !s.ended; d++) {
        sim.advanceDays(1); days++;
        sim.dispatch({ type: 'collect_all' });
        for (const a of Object.values(s.applicants)) if (!a.shown && !Object.values(s.jobs).some(j => j.kind === 'show' && j.applicantId === a.id && j.state !== 'done' && j.state !== 'cancelled')) sim.dispatch({ type: 'order_job', kind: 'show', buildingId: a.buildingId, applicantId: a.id });
        for (const inc of Object.values(s.incidents)) {
          if (inc.state !== 'open' || s.day - inc.startedDay < 1) continue;
          const def = INCIDENT_BY_ID[inc.defId]!;
          const first = PREFER.map(o => def.outcomes.find(x => x.option === o)).find(Boolean) ?? def.outcomes.find(o => o.default) ?? def.outcomes[0]!;
          if (!sim.dispatch({ type: 'resolve_incident', incidentId: inc.id, outcomeId: first.id }).ok) for (const o of def.outcomes) if (sim.dispatch({ type: 'resolve_incident', incidentId: inc.id, outcomeId: o.id }).ok) break;
        }
        maxCourt = Math.max(maxCourt, Object.values(s.incidents).filter(i => i.state === 'open' && i.actorId && s.actors[i.actorId]?.kind === 'petitioner').length);
        if (d % 5 === 0) {
          for (const b of Object.values(s.buildings)) if (b.state === 'ready' && b.condition < 60 && b.units.length) sim.dispatch({ type: 'order_job', kind: 'repair', buildingId: b.id });
          for (const b of Object.values(s.buildings)) if (b.units.some(u => !u.tenantId && !u.listed)) sim.dispatch({ type: 'set_listed', buildingId: b.id, listed: true });
          if (s.charter.ready) sim.dispatch({ type: 'accept_promotion' });
          if (s.realm.rank !== 'reeve') for (const [role, bt] of YARDS) {
            if (staffOf(s, role)) continue;
            if (!Object.values(s.buildings).some(b => b.type === bt)) { build(bt); continue; }
            const c = s.candidates.filter(x => x.role === role).sort((a, b) => b.skill - a.skill)[0];
            if (c) sim.dispatch({ type: 'hire', candidateId: c.id });
          }
          for (const m of Object.values(s.staff)) if (m.wage < fairWage(m.skill) && s.gold > 150) sim.dispatch({ type: 'set_wage', staffId: m.id, wage: fairWage(m.skill) });
          if (!Object.values(s.buildings).some(b => b.units.some(u => !u.tenantId))) build('cottage');
          for (const p of s.map.parcels) if (!p.owned && s.gold > p.price + 200) sim.dispatch({ type: 'buy_parcel', parcelId: p.id });
        }
        assert.ok(Number.isFinite(s.gold) && Number.isFinite(s.renown) && Number.isFinite(s.favor), 'no NaN on day ' + d);
      }
    } catch (e) {
      if (/src\/sim\/(effects|incidents|orders|staff)\.ts/.test(where(e)) || (e instanceof assert.AssertionError)) throw e;
      note(`seed ${seed}: the reign stopped on day ${days} by a throw outside sim-decide: ${where(e)}`);
    }
    reigns++;
    assertSane(s, 'after the reign, seed ' + seed);
    assertFeedFits(s, 'seed ' + seed);
    for (const inc of Object.values(s.incidents)) assert.ok(INCIDENT_BY_ID[inc.defId], 'every incident has a def');
    assert.ok(maxCourt <= INC_TUNE.courtRoom, `seed ${seed}: never more than three petitioners at court (saw ${maxCourt})`);
    assert.ok(Object.values(s.actors).filter(a => a.kind === 'petitioner').length <= INC_TUNE.courtRoom + 3, `seed ${seed}: departed petitioners do not pile up`);
    assert.ok(s.pending.length < 40, `seed ${seed}: pending stays small (${s.pending.length})`);
    assert.ok((by.ruler ?? 0) > 50, `seed ${seed}: matters did come before the ruler (${by.ruler ?? 0})`);
    byStaff += (by.mason ?? 0) + (by.bailiff ?? 0) + (by.crier ?? 0) + (by.steward ?? 0);
    console.log(`      seed ${seed}: ${days} days, ${s.realm.rank}, ${Object.values(s.tenants).filter(t => t.status === 'housed').length} households, gold ${Math.round(s.gold)}; settled by ${JSON.stringify(by)}; ${s.stats.incidentsIgnored} ignored; staff ${Object.values(s.staff).map(m => `${m.first} (${m.role}, ${m.temperament}, skill ${m.skill}, loyalty ${m.loyalty})`).join(', ') || 'none'}`);
  }
  if (FX.errors.length) note(`${FX.errors.length} effect(s) threw during the reigns and were skipped. First: ${FX.errors[0]!.effect}: ${FX.errors[0]!.error.split('\n').slice(0, 3).join(' | ')}`);
  if (reigns && !promoted) note('no reign in this build reached Knight, so no delegate was hired in the full sim; delegation is covered by the fixture tests above');
  else if (hired) assert.ok(byStaff > 0, 'once there was a household, some matters were settled without the ruler');
});

// ───────────── summary ─────────────

void RANK_ORDER; void settle;
console.log('');
for (const n of notes) console.log('note: ' + n);
console.log(`${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
