/**
 * Tests for the crown modules: oaths, rank, rival, modes, save.
 *   npx tsx test/sim-crown.test.ts
 *
 * Most tests drive the crown modules' own hooks on a hand-built state (the dev
 * fixture), so they do not depend on how the rest of the sim behaves this week.
 * The save and determinism tests run the whole Sim.
 */
import assert from 'node:assert/strict';
import { Sim } from '../src/sim/index';
import {
  DAYS_PER_MONTH, SAVE_VERSION,
  type GameState, type SimEvent, type Oath, type Tenant, type Building, type Job, type GoalMetric,
  type Action, type ActionResult,
} from '../src/sim/types';
import { makeFixtureState } from '../src/dev/fixture';
import { oathsModule, swear, wouldBreak, wouldRelease, inferBuildingType, paidToward, TUNE as OATH_TUNE } from '../src/sim/oaths';
import { rankModule, METRICS, measure, refreshCharter, nextRank, isUnlocked, rolesUnlocked, speciesUnlocked, TUNE as RANK_TUNE } from '../src/sim/rank';
import { rivalModule, nextMoveDay, poachChance, TUNE as RIVAL_TUNE } from '../src/sim/rival';
import {
  modesModule, debtOf, loanCap, creditLeft, bankruptcyLine, monthlyInterest, nextTribute, lastDemotion, writeEpitaph,
  spanText, numWord, crowns, crownsOf, clipLine, overhear, heirloomOf, reignRecord, pronounsFor, heirloomBoon, TUNE as MODES_TUNE,
} from '../src/sim/modes';
import { serialize, deserialize } from '../src/sim/save';
import { spend, lastFeastDay } from '../src/sim/economy';
import { householdCount, housed } from '../src/sim/tenants';
import { seatOf, countBuildings } from '../src/sim/buildings';
import { fill, baseVars } from '../src/sim/core';
import { RANKS } from '../src/data/ranks';
import { BAL } from '../src/data/balance';
import { REALM_NAMES, RIVAL_NAMES, NPC_DEFS } from '../src/data/characters';
import { INCIDENT_BY_ID } from '../src/data/incidents/index';

// ───────────────────────────── harness ─────────────────────────────

let passed = 0;
const failures: string[] = [];
const notes: string[] = [];
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log('  ok    ' + name); }
  catch (e) {
    failures.push(name);
    console.log('  FAIL  ' + name);
    console.log('        ' + String((e as Error).stack ?? e).split('\n').slice(0, 6).join('\n        '));
  }
}
function note(text: string): void { notes.push(text); console.log('  note  ' + text); }

/** every line the crown modules send, for the wording checks at the end */
const allHeralds: string[] = [];
overhear(h => { allHeralds.push(h.text); });
/** Take the events raised so far. */
function drain(s: GameState): SimEvent[] {
  const evs = s._events;
  s._events = [];
  return evs;
}
const ofType = <T extends SimEvent['type']>(evs: SimEvent[], type: T): Extract<SimEvent, { type: T }>[] =>
  evs.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);

/** Run only the crown modules for one day (and their monthly hooks on the 1st). */
function crownDay(s: GameState): void {
  if (s.ended) return;
  for (let i = 0; i < 4; i++) { s.day += 0.25; oathsModule.step!(s, 0.25); }
  s.day = Math.round(s.day);
  const day = s.day;
  for (const m of [oathsModule, rankModule, rivalModule, modesModule]) m.onDay?.(s, day);
  if (day % DAYS_PER_MONTH === 0) for (const m of [oathsModule, rankModule, rivalModule, modesModule]) m.onMonth?.(s, day / DAYS_PER_MONTH);
}
const tick = (s: GameState): void => { oathsModule.step!(s, 0.25); };

function fixture(rank: 'reeve' | 'knight' | 'baron' = 'knight'): GameState {
  const s = makeFixtureState(rank, 34);
  s.oaths = [];
  return s;
}
const byName = (s: GameState, name: string): Tenant => {
  const t = Object.values(s.tenants).find(x => x.name === name);
  assert.ok(t, 'fixture tenant ' + name);
  return t;
};
const homeOf = (s: GameState, t: Tenant): Building => s.buildings[t.buildingId!]!;
const dispatch = (s: GameState, a: Action): ActionResult => new Sim(s).dispatch(a);
/** read `ended` without the compiler remembering an earlier assertion about it */
const endOf = (s: GameState): GameState['ended'] => s.ended;
const oathSpec = (over: Partial<Omit<Oath, 'id' | 'madeDay' | 'state' | 'settledDay'>>): Omit<Oath, 'id' | 'madeDay' | 'state' | 'settledDay'> => ({
  kind: 'word', text: 'You have my word.', toTenantId: null, toName: '', buildingId: null, buildingType: null, amount: null, dueDay: 0, ...over,
});
function fakeJob(kind: Job['kind'], buildingId: string | null): Job {
  return {
    id: 'jx', kind, role: 'mason', state: 'done', assignee: null, buildingId, unit: null, tenantId: null, applicantId: null,
    incidentId: null, outcomeId: null, x: 0, y: 0, workDays: 1, progress: 1, cost: 0, priority: 0, createdDay: 0, byRuler: true,
  };
}
/** Stand in for a charter metric for the length of `fn`. */
function withMetrics(forced: Partial<Record<GoalMetric, number>>, fn: () => void): void {
  const saved = { ...METRICS };
  for (const k of Object.keys(forced) as GoalMetric[]) METRICS[k] = () => forced[k]!;
  try { fn(); } finally { Object.assign(METRICS, saved); }
}
/** What a rank's charter asks, by metric, read from the data so that a balance pass does not break the tests. */
function targetsOf(rank: keyof typeof RANKS): Partial<Record<GoalMetric, number>> {
  const out: Partial<Record<GoalMetric, number>> = {};
  for (const g of RANKS[rank].goals) out[g.metric] = Math.max(out[g.metric] ?? 0, g.target);
  return out;
}

// ───────────────────────────── oaths ─────────────────────────────

console.log('\noaths');

test('repair: kept when the building is brought to good condition', () => {
  const s = fixture(); const marta = byName(s, 'Old Marta Thistlewick'); const home = homeOf(s, marta);
  const renown = s.renown, happy = marta.happiness, kept = s.stats.oathsKept;
  const o = swear(s, oathSpec({ kind: 'repair', text: 'I will have that roof mended before the frost.', toTenantId: marta.id, dueDay: s.day + 60 }));
  assert.equal(o.buildingId, home.id, 'a repair oath to a household is about their home');
  assert.equal(o.toName, marta.name);
  tick(s); assert.equal(o.state, 'open');
  home.condition = 85; tick(s);
  assert.equal(o.state, 'kept'); assert.equal(o.settledDay, s.day);
  assert.equal(s.stats.oathsKept, kept + 1);
  assert.ok(s.renown > renown, 'renown rises');
  assert.ok(marta.happiness > happy, 'the household is pleased');
  assert.ok(marta.memory.some(m => m.valence === 2 && /mend/.test(m.text)), 'a fond memory');
  const evs = drain(s);
  assert.deepEqual(ofType(evs, 'oath').map(e => e.state), ['open', 'kept']);
  assert.ok(ofType(evs, 'herald').some(e => e.herald.kind === 'oath' && e.herald.tenantId === marta.id));
});

test('repair: kept when a repair job on the building completes', () => {
  const s = fixture(); const marta = byName(s, 'Old Marta Thistlewick'); const home = homeOf(s, marta);
  const o = swear(s, oathSpec({ kind: 'repair', text: 'The roof will be seen to.', toTenantId: marta.id, buildingId: home.id, dueDay: s.day + 60 }));
  home.condition = 60;                                   // a patch: better, but short of 80
  oathsModule.onJobDone!(s, fakeJob('repair', home.id));
  assert.equal(o.state, 'kept'); drain(s);
});

test('repair: broken when the due day comes first', () => {
  const s = fixture(); const marta = byName(s, 'Old Marta Thistlewick'); const home = homeOf(s, marta);
  const neighbours = housed(s).filter(t => t.id !== marta.id).map(t => [t, t.happiness] as const);
  const renown = s.renown, happy = marta.happiness, broken = s.stats.oathsBroken;
  const o = swear(s, oathSpec({ kind: 'repair', text: 'A roof before the frost.', toTenantId: marta.id, dueDay: s.day + 20 }));
  home.condition = 38;
  s.day += 19; tick(s); assert.equal(o.state, 'open');
  s.day += 1; tick(s);
  assert.equal(o.state, 'broken');
  assert.equal(s.stats.oathsBroken, broken + 1);
  assert.ok(s.renown <= renown + OATH_TUNE.brokenRenown + 1e-9, 'renown falls hard');
  assert.ok(marta.happiness <= happy + OATH_TUNE.brokenHappiness + 1e-9, 'happiness falls hard');
  assert.ok(marta.memory.some(m => m.valence === -2), 'a bitter memory');
  assert.ok(neighbours.some(([t, was]) => t.happiness < was), 'the neighbours hear of it');
  const line = ofType(drain(s), 'herald').map(e => e.herald).filter(h => h.kind === 'oath').pop()!;
  assert.match(line.text, /promised|mended|broken/i);
});

test('no_rent_raise: kept at the due day, broken the moment the rent rises', () => {
  const s = fixture(); const wat = byName(s, 'Wat Mudge'); const rent = wat.lease!.rent;
  const o = swear(s, oathSpec({ kind: 'no_rent_raise', text: 'Your rent will not move this year.', toTenantId: wat.id, dueDay: s.day + 90 }));
  assert.equal(o.amount, rent, 'the rent on the day is the line');
  wat.lease!.rent = rent - 1; tick(s); assert.equal(o.state, 'open', 'a cut is not a breach');
  wat.lease!.rent = rent; s.day += 89; tick(s); assert.equal(o.state, 'open');
  s.day += 1; tick(s); assert.equal(o.state, 'kept');

  const s2 = fixture(); const wat2 = byName(s2, 'Wat Mudge');
  const o2 = swear(s2, oathSpec({ kind: 'no_rent_raise', text: 'Your rent will not move this year.', toTenantId: wat2.id, dueDay: s2.day + 90 }));
  wat2.lease!.rent += 1; tick(s2);
  assert.equal(o2.state, 'broken'); drain(s); drain(s2);
});

test('no_rent_raise: an oath on file with no line noted takes today\'s rent as the line', () => {
  const s = makeFixtureState('knight', 34);            // carries w2: no_rent_raise, amount null
  const w2 = s.oaths.find(o => o.id === 'w2')!; const t = s.tenants[w2.toTenantId!]!;
  tick(s); assert.equal(w2.amount, t.lease!.rent); assert.equal(w2.state, 'open');
  t.lease!.rent += 2; tick(s); assert.equal(w2.state, 'broken'); drain(s);
});

test('rent_cap: a rise under the cap is fine, a rise over it breaks, and it is kept at the due day', () => {
  const s = fixture(); const wat = byName(s, 'Wat Mudge'); const rent = wat.lease!.rent;
  const o = swear(s, oathSpec({ kind: 'rent_cap', text: 'Never more than this.', toTenantId: wat.id, amount: rent + 3, dueDay: s.day + 60 }));
  wat.lease!.rent = rent + 3; tick(s); assert.equal(o.state, 'open');
  s.day += 60; tick(s); assert.equal(o.state, 'kept');

  const s2 = fixture(); const wat2 = byName(s2, 'Wat Mudge');
  const o2 = swear(s2, oathSpec({ kind: 'rent_cap', text: 'Never more than this.', toTenantId: wat2.id, amount: wat2.lease!.rent + 3, dueDay: s2.day + 60 }));
  wat2.lease!.rent += 4; tick(s2); assert.equal(o2.state, 'broken');
  drain(s); drain(s2);
});

test('no_evict: kept at the due day; broken by a notice; broken by an eviction', () => {
  const s = fixture(); const marta = byName(s, 'Old Marta Thistlewick');
  const o = swear(s, oathSpec({ kind: 'no_evict', text: 'Nobody is putting you out this winter.', toTenantId: marta.id, dueDay: s.day + 90 }));
  s.day += 90; tick(s); assert.equal(o.state, 'kept');

  const s2 = fixture(); const m2 = byName(s2, 'Old Marta Thistlewick');
  const o2 = swear(s2, oathSpec({ kind: 'no_evict', text: 'Nobody is putting you out.', toTenantId: m2.id, dueDay: s2.day + 90 }));
  m2.lateStage = 'late'; tick(s2); assert.equal(o2.state, 'open', 'being late is not being put out');
  m2.lateStage = 'noticed'; tick(s2); assert.equal(o2.state, 'broken');

  const s3 = fixture(); const m3 = byName(s3, 'Old Marta Thistlewick');
  const o3 = swear(s3, oathSpec({ kind: 'no_evict', text: 'Nobody is putting you out.', toTenantId: m3.id, dueDay: s3.day + 90 }));
  m3.status = 'evicted'; m3.leftDay = s3.day; tick(s3);
  assert.equal(o3.state, 'broken');
  assert.ok(m3.memory.some(m => /Bailiff/.test(m.text)));
  drain(s); drain(s2); drain(s3);
});

test('no_evict: a notice already on the door does not break it; leaving of their own accord lapses it', () => {
  const s = fixture(); const marta = byName(s, 'Old Marta Thistlewick');
  marta.lateStage = 'noticed';
  const o = swear(s, oathSpec({ kind: 'no_evict', text: 'I will not see you out.', toTenantId: marta.id, dueDay: s.day + 90 }));
  tick(s); assert.equal(o.state, 'open');
  marta.lateStage = 'none'; tick(s);                    // the notice came down
  marta.lateStage = 'noticed'; tick(s);                 // a new one is a breach
  assert.equal(o.state, 'broken');

  const s2 = fixture(); const m2 = byName(s2, 'Old Marta Thistlewick'); const before = { kept: s2.stats.oathsKept, broken: s2.stats.oathsBroken, renown: s2.renown };
  const o2 = swear(s2, oathSpec({ kind: 'no_evict', text: 'I will not see you out.', toTenantId: m2.id, dueDay: s2.day + 90 }));
  m2.status = 'left'; m2.leftDay = s2.day; tick(s2);
  assert.equal(o2.state, 'released');
  assert.deepEqual({ kept: s2.stats.oathsKept, broken: s2.stats.oathsBroken, renown: s2.renown }, before, 'no one is the worse for it');
  drain(s); drain(s2);
});

test('build: kept when one is finished after the oath; one already standing does not count; broken at the due day', () => {
  const s = fixture(); const marta = byName(s, 'Old Marta Thistlewick');
  const had = countBuildings(s, 'well'); assert.ok(had >= 1, 'the fixture has a well');
  const o = swear(s, oathSpec({ kind: 'build', text: 'There will be a well at your end of the lane.', toTenantId: marta.id, buildingType: 'well', dueDay: s.day + 90 }));
  tick(s); assert.equal(o.state, 'open', 'the old well is not the promised one');
  const old = Object.values(s.buildings).find(b => b.type === 'well')!;
  s.buildings['bnew'] = { ...old, id: 'bnew', x: 2, y: 2, name: 'New Well', builtDay: s.day, units: [], visuals: [], flags: {} };
  tick(s); assert.equal(o.state, 'kept');

  const s2 = fixture();
  const o2 = swear(s2, oathSpec({ kind: 'build', text: 'A shrine, by Harvestmoon.', toName: 'the parish', dueDay: s2.day + 30 }));
  assert.equal(o2.buildingType, 'shrine', 'the type is read from the words');
  s2.day += 30; tick(s2); assert.equal(o2.state, 'broken');

  const s3 = fixture();
  const o3 = swear(s3, oathSpec({ kind: 'build', text: 'A garden for the lane.', dueDay: s3.day + 30 }));
  const garden = Object.values(s3.buildings).find(b => b.type === 'garden')!;
  oathsModule.onJobDone!(s3, fakeJob('build', garden.id));
  assert.equal(o3.state, 'kept', 'a finished build job of that type keeps it');

  // the old one comes down and a new one goes up: the count is the same, and the promise is kept all the same
  const s4 = fixture();
  const o4 = swear(s4, oathSpec({ kind: 'build', text: 'A new well, a proper one.', buildingType: 'well', dueDay: s4.day + 60 }));
  s4.day += 10; tick(s4); assert.equal(o4.state, 'open');
  Object.values(s4.buildings).find(b => b.type === 'well')!.builtDay = s4.day;
  tick(s4); assert.equal(o4.state, 'kept');

  // a promise that names no kind of building is kept by any that is finished afterwards
  const s5 = fixture();
  const o5 = swear(s5, oathSpec({ kind: 'build', text: 'I will build you something. You will like it.', dueDay: s5.day + 60 }));
  assert.equal(o5.buildingType, null);
  tick(s5); assert.equal(o5.state, 'open');
  s5.day += 3; Object.values(s5.buildings).find(b => b.type === 'garden')!.builtDay = s5.day;
  tick(s5); assert.equal(o5.state, 'kept');
  drain(s); drain(s2); drain(s3); drain(s4); drain(s5);
});

test('build: the type named in a promise is read sensibly', () => {
  assert.equal(inferBuildingType('A well by the Long Row before summer'), 'well');
  assert.equal(inferBuildingType('I will treat you well'), null);
  assert.equal(inferBuildingType('You shall have a notice board'), 'notice_board');
  assert.equal(inferBuildingType('a stone hall, and soon'), 'stonehall');
  assert.equal(inferBuildingType('two more cottages by spring'), 'cottage');
  assert.equal(inferBuildingType('I will think about it'), null);
});

test('pay: kept by a gift of the amount made after the oath; broken at the due day', () => {
  const s = fixture(); const wat = byName(s, 'Wat Mudge');
  spend(s, 50, 'gifts', 'An earlier gift', { tenantId: wat.id });      // before the promise: does not count
  const o = swear(s, oathSpec({ kind: 'pay', text: 'Twelve crowns for the cow, by month end.', toTenantId: wat.id, amount: 12, dueDay: s.day + 20 }));
  tick(s); assert.equal(o.state, 'open', 'coin given before the promise does not count');
  spend(s, 5, 'gifts', 'Part of it', { tenantId: wat.id }); tick(s);
  assert.equal(o.state, 'open', 'five is not twelve');
  spend(s, 12, 'gifts', 'For the cow', { tenantId: wat.id }); tick(s);
  assert.equal(o.state, 'kept');

  const s2 = fixture(); const wat2 = byName(s2, 'Wat Mudge');
  const o2 = swear(s2, oathSpec({ kind: 'pay', text: 'You will have 12 crowns for the cow.', toTenantId: wat2.id, dueDay: s2.day + 20 }));
  assert.equal(o2.amount, 12, 'the sum is read from the words');
  s2.day += 20; tick(s2); assert.equal(o2.state, 'broken');
  drain(s); drain(s2);
});

test('pay: part payments add up, even after the ledger has turned the page; coin to someone else does not count', () => {
  const s = fixture(); const wat = byName(s, 'Wat Mudge'); const marta = byName(s, 'Old Marta Thistlewick');
  const o = swear(s, oathSpec({ kind: 'pay', text: 'Thirty crowns for the fence.', toTenantId: wat.id, amount: 30, dueDay: s.day + 80 }));
  spend(s, 10, 'gifts', 'On account', { tenantId: wat.id });
  spend(s, 40, 'gifts', 'For Marta', { tenantId: marta.id });
  tick(s);
  assert.equal(paidToward(s, o), 10); assert.equal(o.state, 'open');
  s.day += 5;
  for (let i = 0; i < 400; i++) spend(s, 1, 'upkeep', 'Sundries');       // far more entries than the ledger keeps
  assert.ok(!s.ledger.txns.some(x => x.cat === 'gifts'), 'the first gift has gone from the log');
  tick(s); assert.equal(paidToward(s, o), 10, 'but not from the tally');
  s.day += 5; spend(s, 20, 'gifts', 'The rest', { tenantId: wat.id }); tick(s);
  assert.equal(o.state, 'kept');
  // and the tally survives a save
  const s2 = fixture(); const wat2 = byName(s2, 'Wat Mudge');
  const o2 = swear(s2, oathSpec({ kind: 'pay', text: 'Thirty crowns for the fence.', toTenantId: wat2.id, amount: 30, dueDay: s2.day + 80 }));
  spend(s2, 25, 'gifts', 'On account', { tenantId: wat2.id }); tick(s2);
  const back = deserialize(serialize(s2)); const ob = back.oaths.find(x => x.id === o2.id)!;
  for (let i = 0; i < 400; i++) spend(back, 1, 'upkeep', 'Sundries');
  back.day += 1; spend(back, 5, 'gifts', 'The rest', { tenantId: wat2.id }); oathsModule.step!(back, 0.25);
  assert.equal(ob.state, 'kept');
  drain(s); drain(s2);
});

test('word: kept at the due day; asking an unhappy promisee to forget it breaks it', () => {
  const s = fixture(); const marta = byName(s, 'Old Marta Thistlewick');
  const o = swear(s, oathSpec({ kind: 'word', text: 'I will speak to the miller about the noise.', toTenantId: marta.id, dueDay: s.day + 45 }));
  s.day += 44; tick(s); assert.equal(o.state, 'open');
  s.day += 1; tick(s); assert.equal(o.state, 'kept');

  const s2 = fixture(); const m2 = byName(s2, 'Old Marta Thistlewick'); m2.happiness = 30;
  const o2 = swear(s2, oathSpec({ kind: 'word', text: 'I will speak to the miller about the noise.', toTenantId: m2.id, dueDay: s2.day + 45 }));
  assert.equal(wouldRelease(s2, o2.id), false);
  const broken = s2.stats.oathsBroken;
  assert.deepEqual(dispatch(s2, { type: 'release_oath', oathId: o2.id }), { ok: true, id: o2.id });
  assert.equal(o2.state, 'broken'); assert.equal(s2.stats.oathsBroken, broken + 1);
  assert.ok(m2.memory.some(m => /asked to have it back/.test(m.text)));
  drain(s); drain(s2);
});

test('a promise to a household that has left lapses with them, whatever it was', () => {
  for (const kind of ['repair', 'build', 'pay', 'word', 'rent_cap'] as const) {
    const s = fixture(); const marta = byName(s, 'Old Marta Thistlewick'); homeOf(s, marta).condition = 40;
    const before = { kept: s.stats.oathsKept, broken: s.stats.oathsBroken, renown: s.renown };
    const o = swear(s, oathSpec({ kind, text: 'You have my word on it.', toTenantId: marta.id, buildingType: kind === 'build' ? 'well' : null, amount: kind === 'pay' ? 10 : null, dueDay: s.day + 40 }));
    marta.status = 'left'; marta.leftDay = s.day; homeOf(s, marta).units[marta.unit]!.tenantId = null;
    s.day += 60; tick(s);
    assert.equal(o.state, 'released', kind);
    assert.deepEqual({ kept: s.stats.oathsKept, broken: s.stats.oathsBroken, renown: s.renown }, before, kind);
    const line = ofType(drain(s), 'herald').map(e => e.herald).filter(h => h.kind === 'oath').pop()!;
    assert.match(line.text, /left|gone/);
  }
});

test('release_oath: a contented promisee lets the ruler off, at no cost', () => {
  const s = fixture(); const marta = byName(s, 'Old Marta Thistlewick'); marta.happiness = 80;
  const o = swear(s, oathSpec({ kind: 'no_evict', text: 'You stay.', toTenantId: marta.id, dueDay: s.day + 90 }));
  const before = { renown: s.renown, kept: s.stats.oathsKept, broken: s.stats.oathsBroken };
  assert.equal(wouldRelease(s, o.id), true);
  assert.equal(dispatch(s, { type: 'release_oath', oathId: o.id }).ok, true);
  assert.equal(o.state, 'released');
  assert.deepEqual({ renown: s.renown, kept: s.stats.oathsKept, broken: s.stats.oathsBroken }, before);
  assert.equal(dispatch(s, { type: 'release_oath', oathId: o.id }).ok, false, 'already settled');
  assert.equal(dispatch(s, { type: 'release_oath', oathId: 'nope' }).ok, false);
  drain(s);
});

test('wouldBreak warns before an eviction or a rise', () => {
  const s = fixture(); const marta = byName(s, 'Old Marta Thistlewick'); const wat = byName(s, 'Wat Mudge');
  const a = swear(s, oathSpec({ kind: 'no_evict', text: 'You stay.', toTenantId: marta.id, dueDay: s.day + 90 }));
  const b = swear(s, oathSpec({ kind: 'no_rent_raise', text: 'No rise.', toTenantId: wat.id, dueDay: s.day + 90 }));
  assert.equal(wouldBreak(s, { evict: marta.id }), a);
  assert.equal(wouldBreak(s, { evict: wat.id }), null);
  assert.equal(wouldBreak(s, { raiseRent: wat.id }), b);
  assert.equal(wouldBreak(s, { raiseRent: wat.id, newRent: wat.lease!.rent }), null);
  assert.equal(wouldBreak(s, { raiseRent: wat.id, newRent: wat.lease!.rent + 1 }), b);
  assert.equal(wouldBreak(s, { raiseRent: marta.id, newRent: 99 }), null);
  const c = swear(s, oathSpec({ kind: 'rent_cap', text: 'Not over twenty.', toTenantId: marta.id, amount: 20, dueDay: s.day + 90 }));
  assert.equal(wouldBreak(s, { raiseRent: marta.id, newRent: 20 }), null);
  assert.equal(wouldBreak(s, { raiseRent: marta.id, newRent: 21 }), c);
  drain(s);
});

test('swear_oath: validates, refuses the same oath twice, and the ledger has a limit', () => {
  const s = fixture(); const marta = byName(s, 'Old Marta Thistlewick');
  const base = oathSpec({ kind: 'no_evict', text: 'You stay.', toTenantId: marta.id, toName: marta.name, dueDay: s.day + 90 });
  assert.equal(dispatch(s, { type: 'swear_oath', oath: { ...base, text: '  ' } }).ok, false);
  assert.equal(dispatch(s, { type: 'swear_oath', oath: { ...base, toTenantId: 'nobody' } }).ok, false);
  assert.equal(dispatch(s, { type: 'swear_oath', oath: { ...base, kind: 'smile' as never } }).ok, false);
  const r = dispatch(s, { type: 'swear_oath', oath: base });
  assert.equal(r.ok, true); assert.ok(r.ok && r.id && s.oaths.some(o => o.id === r.id));
  const again = dispatch(s, { type: 'swear_oath', oath: base });
  assert.equal(again.ok, false); assert.ok(!again.ok && /already sworn/.test(again.reason));
  assert.equal(swear(s, base), s.oaths[0], 'swearing it again through an effect returns the first oath');
  assert.equal(s.oaths.length, 1);
  // a waiting oath cannot be made to fall due tomorrow
  const quick = swear(s, oathSpec({ kind: 'word', text: 'Trust me.', toTenantId: marta.id, dueDay: s.day + 1 }));
  assert.ok(quick.dueDay >= s.day + OATH_TUNE.minTermDays);
  for (let i = 0; s.oaths.filter(o => o.state === 'open').length < OATH_TUNE.maxOpen; i++) {
    assert.equal(dispatch(s, { type: 'swear_oath', oath: oathSpec({ kind: 'word', text: 'Promise number ' + i, toTenantId: marta.id, dueDay: s.day + 60 }) }).ok, true);
  }
  const full = dispatch(s, { type: 'swear_oath', oath: oathSpec({ kind: 'word', text: 'One more.', toTenantId: marta.id, dueDay: s.day + 60 }) });
  assert.ok(!full.ok && /no room/.test(full.reason));
  drain(s);
});

test('a promise of a deed is called to mind before it falls due, once', () => {
  const s = fixture(); const marta = byName(s, 'Old Marta Thistlewick'); homeOf(s, marta).condition = 40;
  swear(s, oathSpec({ kind: 'repair', text: 'A roof before the frost.', toTenantId: marta.id, dueDay: s.day + 40 }));
  drain(s);
  s.day += 31; oathsModule.onDay!(s, s.day); oathsModule.onDay!(s, s.day + 1);
  const lines = ofType(drain(s), 'herald').filter(e => e.herald.kind === 'oath');
  assert.equal(lines.length, 1); assert.match(lines[0]!.herald.text, /falls due|counting the days/);
});

// ───────────────────────────── rank ─────────────────────────────

console.log('\nrank');

test('a new reign: realm named, Reeve charter, the Crown\'s proclamation, a rival next door', () => {
  const sim = Sim.create({ seed: 77, ruler: 'Luke' }); const s = sim.state;
  assert.ok(REALM_NAMES.includes(s.realm.name), 'realm named from REALM_NAMES');
  assert.equal(Sim.create({ seed: 77, ruler: 'Luke' }).state.realm.name, s.realm.name, 'by seed');
  assert.equal(Sim.create({ seed: 77, realm: 'Fenwick Parva' }).state.realm.name, 'Fenwick Parva');
  assert.equal(s.realm.rank, 'reeve');
  assert.deepEqual(s.charter.goals.map(g => [g.id, g.target, g.done]), RANKS.reeve.goals.map(g => [g.id, g.target, false]));
  assert.equal(s.charter.ready, false);
  const proclamation = fill(RANKS.reeve.proclamation, baseVars(s));
  assert.ok(s.heralds.some(h => h.kind === 'crown' && h.text === proclamation), 'the proclamation is in the feed');
  assert.ok(RIVAL_NAMES.some(r => r.name === s.rival.name && r.seat === s.rival.seat && r.temperament === s.rival.temperament));
  const no = sim.dispatch({ type: 'accept_promotion' });
  assert.ok(!no.ok && no.code === 'not_ready');
  sim.drain();
});

test('charter metrics read the state', () => {
  const s = fixture('knight');
  const tenants = housed(s);
  assert.equal(measure(s, { id: 'x', text: '', metric: 'households', target: 1 }), tenants.length);
  assert.equal(measure(s, { id: 'x', text: '', metric: 'rentRoll', target: 1 }), tenants.reduce((a, t) => a + (t.lease?.rent ?? 0), 0));
  assert.equal(measure(s, { id: 'x', text: '', metric: 'staff', target: 1 }), 3);
  assert.equal(measure(s, { id: 'x', text: '', metric: 'renown', target: 1 }), 58);
  assert.equal(measure(s, { id: 'x', text: '', metric: 'buildings', target: 1, buildingType: 'well' }), countBuildings(s, 'well'));
  s.stats.oathsKept = 7; assert.equal(measure(s, { id: 'x', text: '', metric: 'oathsKept', target: 1 }), 7);
  const cond = measure(s, { id: 'x', text: '', metric: 'conditionAvg', target: 1 }); assert.ok(cond > 20 && cond <= 100);
  // monthsNoVacancy counts whole months with every unit let
  for (const b of Object.values(s.buildings)) if (b.units.some(u => !u.tenantId)) b.state = 'building';
  for (let i = 0; i < 61; i++) { s.day += 1; rankModule.onDay!(s, s.day); }
  assert.equal(measure(s, { id: 'x', text: '', metric: 'monthsNoVacancy', target: 1 }), 2);
  drain(s);
});

test('promotion from Reeve through Baron (and on to Duke and King) by forcing the metrics', () => {
  const s = fixture('reeve');
  rankModule.init!(s); drain(s);                       // a fresh Reeve charter on a furnished hamlet
  s.renown = 40; s.favor = 52; s.gold = 86;
  const reeve = targetsOf('reeve') as { households: number; rentRoll: number; renown: number };
  // every metric any charter asks for is stood in for from the start (withMetrics reads the keys once)
  const forced: Partial<Record<GoalMetric, number>> = {};
  for (const r of Object.values(RANKS)) for (const g of r.goals) forced[g.metric] = 0;
  Object.assign(forced, { households: reeve.households, rentRoll: reeve.rentRoll - 1, renown: reeve.renown - 1, favor: 52 });
  withMetrics(forced, () => {
    s.day += 1; rankModule.onDay!(s, s.day);
    let evs = drain(s);
    assert.deepEqual(ofType(evs, 'goal').map(e => e.goalId), ['reeve_households']);
    assert.equal(s.charter.ready, false);
    // a goal once met stays met
    forced.households = reeve.households - 1; forced.rentRoll = reeve.rentRoll;
    s.day += 1; rankModule.onDay!(s, s.day); evs = drain(s);
    assert.deepEqual(ofType(evs, 'goal').map(e => e.goalId), ['reeve_rentroll']);
    assert.equal(s.charter.goals.find(g => g.id === 'reeve_households')!.done, true);
    assert.ok(s.charter.goals.find(g => g.id === 'reeve_households')!.value >= reeve.households, 'a sealed goal reads as met');
    assert.equal(dispatch(s, { type: 'accept_promotion' }).ok, false);
    forced.renown = reeve.renown;
    s.day += 1; rankModule.onDay!(s, s.day); evs = drain(s);
    assert.deepEqual(ofType(evs, 'goal').map(e => e.goalId), ['reeve_renown']);
    assert.equal(ofType(evs, 'charter_ready').length, 1);
    assert.equal(s.charter.ready, true);
    s.day += 1; rankModule.onDay!(s, s.day);
    assert.equal(ofType(drain(s), 'charter_ready').length, 0, 'announced once');

    // Reeve → Knight
    const gold = s.gold, favor = s.favor;
    assert.deepEqual(dispatch(s, { type: 'accept_promotion' }), { ok: true });
    evs = drain(s);
    assert.equal(s.realm.rank, 'knight');
    assert.deepEqual(ofType(evs, 'promotion').map(e => e.rank), ['knight']);
    assert.equal(seatOf(s).level, RANKS.knight.seatLevel, 'the seat is raised');
    assert.equal(s.favor, favor + RANK_TUNE.promotionFavor);
    assert.equal(s.gold, gold + RANK_TUNE.promotionGift.knight, 'the Crown sends a gift');
    assert.ok(ofType(evs, 'herald').some(e => e.herald.kind === 'crown' && e.herald.text === fill(RANKS.knight.proclamation, baseVars(s))));
    assert.deepEqual(s.charter.goals.map(g => [g.id, g.done]), RANKS.knight.goals.map(g => [g.id, false]));
    assert.equal(s.charter.ready, false); assert.equal(s.charter.sinceDay, s.day);
    assert.ok(isUnlocked(s, 'longhouse') && !isUnlocked(s, 'townhouse'));
    assert.deepEqual(rolesUnlocked(s), ['mason', 'bailiff', 'crier']);
    assert.ok(speciesUnlocked(s).includes('dwarf') && !speciesUnlocked(s).includes('elf'));
    assert.ok(s.candidates.length > 0, 'candidates are on offer');

    // Knight → Baron
    Object.assign(forced, targetsOf('knight'));
    s.day += 1; rankModule.onDay!(s, s.day); evs = drain(s);
    assert.equal(ofType(evs, 'goal').length, RANKS.knight.goals.length);
    assert.equal(ofType(evs, 'charter_ready').length, 1);
    assert.equal(dispatch(s, { type: 'accept_promotion' }).ok, true); drain(s);
    assert.equal(s.realm.rank, 'baron'); assert.equal(seatOf(s).level, RANKS.baron.seatLevel);
    assert.ok(isUnlocked(s, 'townhouse')); assert.ok(rolesUnlocked(s).includes('steward'));

    // Baron → Duke → King: thin on content, sound in mechanism
    Object.assign(forced, targetsOf('baron'));
    s.day += 1; rankModule.onDay!(s, s.day); drain(s);
    assert.equal(s.charter.ready, true);
    assert.equal(dispatch(s, { type: 'accept_promotion' }).ok, true); drain(s);
    assert.equal(s.realm.rank, 'duke');
    Object.assign(forced, targetsOf('duke'));
    s.day += 1; rankModule.onDay!(s, s.day); drain(s);
    assert.equal(dispatch(s, { type: 'accept_promotion' }).ok, true); drain(s);
    assert.equal(s.realm.rank, 'king'); assert.equal(nextRank(s), null);
    assert.deepEqual(s.charter.goals, []);
    s.day += 1; rankModule.onDay!(s, s.day);
    assert.equal(s.charter.ready, false, 'a King has no one to promote him');
    const no = dispatch(s, { type: 'accept_promotion' });
    assert.ok(!no.ok && no.code === 'locked'); drain(s);
  });
});

test('refreshCharter is quiet when asked, and tolerates a charter that does not match the rank', () => {
  const s = fixture('knight');
  s.charter.goals = [{ id: 'old_goal', value: 3, target: 9, done: true }, { id: 'knight_staff', value: 3, target: 3, done: true }];
  refreshCharter(s, true);
  assert.deepEqual(s.charter.goals.map(g => g.id), RANKS.knight.goals.map(g => g.id));
  assert.equal(s.charter.goals.find(g => g.id === 'knight_staff')!.done, true, 'a seal already won is kept');
  assert.equal(drain(s).length, 0);
});

// ───────────────────────────── modes ─────────────────────────────

console.log('\nmodes');

test('tribute: paid on the 1st of a quarter when the coffers allow, favor +2', () => {
  const s = fixture('reeve'); s.gold = 86; s.favor = 40;
  modesModule.onMonth!(s, 3);
  const evs = drain(s);
  assert.deepEqual(ofType(evs, 'tribute'), [{ type: 'tribute', amount: RANKS.reeve.tribute, paid: true }]);
  assert.equal(s.gold, 86 - RANKS.reeve.tribute);
  assert.equal(s.favor, 40 + MODES_TUNE.tributePaidFavor + MODES_TUNE.favorDriftUp);
  assert.equal(debtOf(s), 0);
  modesModule.onMonth!(s, 4);
  assert.equal(ofType(drain(s), 'tribute').length, 0, 'not every month');
  assert.deepEqual(nextTribute(s), { day: 90, amount: RANKS.reeve.tribute }, 'from month 1 the next tribute month is month 3');
});

test('tribute: unpaid costs favor and lands on the moneylender\'s page', () => {
  const s = fixture('reeve'); s.gold = 5; s.favor = 60;
  modesModule.onMonth!(s, 6);
  const evs = drain(s);
  assert.deepEqual(ofType(evs, 'tribute'), [{ type: 'tribute', amount: RANKS.reeve.tribute, paid: false }]);
  assert.equal(s.favor, 60 + MODES_TUNE.tributeUnpaidFavor + MODES_TUNE.favorDriftUp);    // 48, then drift lifts it by one
  assert.equal(debtOf(s), RANKS.reeve.tribute, 'the tribute is added to the debt');
  assert.equal(s.gold, 5);
  assert.ok(ofType(evs, 'herald').some(e => /moneylender/i.test(e.herald.text)));
});

test('the coffers never stay below zero: the shortfall becomes a loan', () => {
  const s = fixture('reeve'); s.gold = -40;
  modesModule.onDay!(s, Math.floor(s.day) + 1);
  assert.equal(s.gold, 0); assert.equal(debtOf(s), 40); assert.equal(s.stats.daysInDebt, 1);
  assert.equal(s.loans[0]!.ratePctMonth, BAL.loan.ratePctMonth);
  const evs = drain(s);
  assert.ok(ofType(evs, 'herald').some(e => e.herald.kind === 'bad' && /moneylender/i.test(e.herald.text)));
  // past the cap he still covers it, at the hard rate
  s.gold = -200; modesModule.onDay!(s, Math.floor(s.day) + 2);
  assert.equal(s.gold, 0); assert.equal(debtOf(s), 240);
  assert.equal(s.loans.find(l => l.ratePctMonth === BAL.loan.ratePctMonth)!.principal, loanCap(s));
  assert.equal(s.loans.find(l => l.ratePctMonth === MODES_TUNE.hardRatePctMonth)!.principal, 240 - loanCap(s));
  drain(s);
});

test('interest: paid monthly from the coffers, or compounded when they are empty', () => {
  const s = fixture('reeve'); s.gold = 100; s.loans = [{ principal: 100, ratePctMonth: 6, takenDay: 0 }];
  assert.equal(monthlyInterest(s), 6);
  modesModule.onMonth!(s, 1);
  assert.equal(s.gold, 94); assert.equal(debtOf(s), 100);
  s.gold = 2;
  modesModule.onMonth!(s, 2);
  assert.equal(debtOf(s), 106, 'unpaid interest joins the debt'); assert.equal(s.gold, 2);
  drain(s);
});

test('interest on a standing debt is not news every month; one crown is one crown', () => {
  const s = fixture('reeve'); s.gold = 500; s.loans = [{ principal: 10, ratePctMonth: 6, takenDay: 0 }];
  const said = (): string[] => ofType(drain(s), 'herald').map(e => e.herald.text).filter(t => /interest/i.test(t));
  s.day = 30; modesModule.onMonth!(s, 1);
  const first = said(); assert.equal(first.length, 1);
  assert.match(first[0]!, /\b(1|[Oo]ne) crown\b/); assert.doesNotMatch(first[0]!, /\b(1|[Oo]ne) crowns\b/);
  s.day = 60; modesModule.onMonth!(s, 2); assert.equal(said().length, 0, 'the same sum a month later: paid, and not announced');
  s.day = 90; modesModule.onMonth!(s, 4); assert.equal(said().length, 0);
  assert.equal(s.gold, 500 - 3, 'it was charged all the same');
  s.day = 120; modesModule.onMonth!(s, 5); assert.equal(said().length, 1, 'once a quarter he is heard from');
  s.loans[0]!.principal = 100; s.day = 150; modesModule.onMonth!(s, 7);
  const more = said(); assert.equal(more.length, 1, 'and whenever the sum changes'); assert.match(more[0]!, /\b(6|[Ss]ix) crowns\b/);
  assert.equal(crownsOf(1), '1 crown'); assert.equal(crownsOf(1240), '1,240 crowns'); assert.equal(crownsOf(0), '0 crowns');
  s.gold = -1; s.loans = []; modesModule.onDay!(s, 151);
  assert.match(ofType(drain(s), 'herald').map(e => e.herald.text).join(' '), /\b1 crown\b(?!s)/);
});

test('take_loan and repay_loan', () => {
  const s = fixture('reeve'); s.gold = 10;
  assert.equal(creditLeft(s), loanCap(s));
  assert.equal(dispatch(s, { type: 'take_loan', amount: 100 }).ok, true);
  assert.equal(s.gold, 110); assert.equal(debtOf(s), 100);
  const over = dispatch(s, { type: 'take_loan', amount: 60 });
  assert.ok(!over.ok && over.code === 'blocked' && /50 crowns more/.test(over.reason), JSON.stringify(over));
  assert.equal(dispatch(s, { type: 'take_loan', amount: 0 }).ok, false);
  assert.equal(dispatch(s, { type: 'take_loan', amount: Number.NaN }).ok, false);
  assert.equal(dispatch(s, { type: 'repay_loan', amount: 30 }).ok, true);
  assert.equal(s.gold, 80); assert.equal(debtOf(s), 70);
  const poor = dispatch(s, { type: 'repay_loan', amount: 9999 });   // asks for more than is owed: pays what is owed
  assert.equal(poor.ok, true); assert.equal(debtOf(s), 0); assert.equal(s.gold, 10); assert.deepEqual(s.loans, []);
  const none = dispatch(s, { type: 'repay_loan', amount: 5 });
  assert.ok(!none.ok && /owe/.test(none.reason));
  s.loans = [{ principal: 90, ratePctMonth: 6, takenDay: 0 }]; s.gold = 4;
  const broke = dispatch(s, { type: 'repay_loan', amount: 50 });
  assert.ok(!broke.ok && broke.code === 'no_gold');
  drain(s);
});

test('Steward\'s Peace: three months past the cap costs a rank and wipes the debt', () => {
  const s = fixture('knight'); s.mode = 'peace'; s.gold = 0; s.favor = 52;
  s.loans = [{ principal: 700, ratePctMonth: 6, takenDay: 0 }];
  assert.ok(debtOf(s) > loanCap(s));
  modesModule.onMonth!(s, 1); modesModule.onMonth!(s, 2);
  let evs = drain(s);
  assert.equal(ofType(evs, 'demotion').length, 0); assert.equal(s.realm.rank, 'knight');
  const warnings = ofType(evs, 'herald').filter(e => e.herald.kind === 'urgent').map(e => e.herald.text);
  assert.equal(warnings.length, 2, 'he warns, twice');
  assert.match(warnings[0]!, /three months/); assert.match(warnings[0]!, /Crown/, 'and says what follows');
  assert.match(warnings[1]!, /[Oo]ne month/); assert.match(warnings[1]!, /title|rank/);
  modesModule.onMonth!(s, 4);
  evs = drain(s);
  assert.deepEqual(ofType(evs, 'demotion'), [{ type: 'demotion', rank: 'reeve' }]);
  assert.equal(s.realm.rank, 'reeve'); assert.deepEqual(s.loans, []); assert.equal(s.ended, null, 'the reign goes on');
  assert.deepEqual(s.charter.goals.map(g => g.id), RANKS.reeve.goals.map(g => g.id));
  const d = lastDemotion(s)!;
  assert.equal(d.from, 'knight'); assert.equal(d.to, 'reeve'); assert.equal(d.cause, 'debt');
  assert.match(d.epitaph, /Knight Luke of Mudlark Hollow is a Reeve again/);
  assert.match(d.epitaph, /forgave [\d,]+ crowns/);
  assert.equal(seatOf(s).level, RANKS.knight.seatLevel, 'the manor is not pulled down');
  // the Crown will not hear of promotion for a while, however well things go
  withMetrics(targetsOf('reeve'), () => {
    s.day += 1; rankModule.onDay!(s, s.day);
    assert.equal(s.charter.ready, false);
    s.day += RANK_TUNE.probationDays; rankModule.onDay!(s, s.day);
    assert.equal(s.charter.ready, true);
    const gold = s.gold;
    assert.equal(dispatch(s, { type: 'accept_promotion' }).ok, true);
    assert.equal(s.gold, gold, 'the Crown\'s gift comes once per title');
  });
  drain(s);
});

test('Steward\'s Peace: favor at zero costs a rank; a Reeve cannot be made less', () => {
  const s = fixture('baron'); s.mode = 'peace'; s.favor = 0;
  modesModule.onDay!(s, Math.floor(s.day) + 1);
  const evs = drain(s);
  assert.deepEqual(ofType(evs, 'demotion'), [{ type: 'demotion', rank: 'knight' }]);
  assert.equal(lastDemotion(s)!.cause, 'favor'); assert.ok(s.favor >= MODES_TUNE.favorAfterDemotion);

  const r = fixture('reeve'); r.mode = 'peace'; r.gold = 0; r.loans = [{ principal: 400, ratePctMonth: 6, takenDay: 0 }];
  const renown = r.renown;
  modesModule.onMonth!(r, 1); modesModule.onMonth!(r, 2); modesModule.onMonth!(r, 4);
  const evs2 = drain(r);
  assert.equal(r.realm.rank, 'reeve'); assert.equal(ofType(evs2, 'demotion').length, 0); assert.equal(r.ended, null);
  assert.deepEqual(r.loans, [], 'he takes the furniture and calls it square');
  assert.ok(r.renown < renown);
  assert.match(ofType(evs2, 'herald').filter(e => e.herald.kind === 'urgent').map(e => e.herald.text).slice(0, 2).join(' '), /furniture|table/, 'a Reeve is told what he stands to lose');
  const shut = dispatch(r, { type: 'take_loan', amount: 10 });
  assert.ok(!shut.ok && /not lending/.test(shut.reason), 'and will not lend for a year');
  drain(r);
  // a shortfall is still covered, but he does not call it lending
  r.gold = -12; modesModule.onDay!(r, Math.floor(r.day) + 1);
  assert.equal(r.gold, 0); assert.equal(debtOf(r), 12);
  assert.match(ofType(drain(r), 'herald').map(e => e.herald.text).join(' '), /not lending|courtesy/);
});

test('Iron Crown: bankruptcy and a revoked charter end the reign, with an epitaph', () => {
  const s = fixture('knight'); s.mode = 'iron'; s.gold = 0;
  s.loans = [{ principal: bankruptcyLine(s), ratePctMonth: 6, takenDay: 0 }];
  modesModule.onDay!(s, Math.floor(s.day) + 1);
  assert.equal(endOf(s), null, 'at the line is not over it');
  s.loans[0]!.principal += 1;
  modesModule.onDay!(s, Math.floor(s.day) + 2);
  const end = endOf(s)!;
  assert.equal(end.reason, 'bankrupt');
  assert.match(end.epitaph, /Knight Luke of Mudlark Hollow/); assert.match(end.epitaph, /undone by arithmetic/);
  assert.deepEqual(ofType(drain(s), 'game_over'), [{ type: 'game_over', reason: 'bankrupt' }]);
  const after = dispatch(s, { type: 'take_loan', amount: 5 });
  assert.ok(!after.ok && after.code === 'ended');

  const f = fixture('baron'); f.mode = 'iron'; f.favor = 0;
  modesModule.onDay!(f, Math.floor(f.day) + 1);
  assert.equal(f.ended?.reason, 'charter_revoked');
  assert.match(f.ended!.epitaph, /The Crown withdrew the charter/);
  drain(f);
});

function neglect(mode: 'peace' | 'iron'): { s: GameState; evs: SimEvent[] } {
  // a Knight who never has a crown in the coffers: every tribute goes unpaid
  const s = fixture('knight'); s.mode = mode; s.gold = 0; s.day = 30;
  refreshCharter(s, true); s.flags['charter.highest'] = 1;
  const evs: SimEvent[] = [];
  for (let i = 0; i < 360 * 8 && !s.ended && s.realm.rank === 'knight'; i++) {
    s.gold = Math.min(s.gold, 0);
    crownDay(s);
    evs.push(...drain(s));
  }
  return { s, evs };
}

test('tribute unpaid, into debt, into demotion (Steward\'s Peace)', () => {
  const { s, evs } = neglect('peace');
  const tributes = ofType(evs, 'tribute');
  assert.ok(tributes.length >= 2 && tributes.every(t => !t.paid), 'the tributes went unpaid');
  assert.ok(s.stats.daysInDebt > 60, 'there was debt');
  assert.deepEqual(ofType(evs, 'demotion').map(e => e.rank), ['reeve']);
  assert.equal(s.realm.rank, 'reeve'); assert.equal(s.ended, null); assert.equal(debtOf(s), 0);
  assert.equal(ofType(evs, 'game_over').length, 0);
  assert.ok(lastDemotion(s)!.epitaph.length > 60);
  note(`peace: demoted on day ${Math.floor(lastDemotion(s)!.day)} by ${lastDemotion(s)!.cause}: "${lastDemotion(s)!.epitaph}"`);
});

test('tribute unpaid, into debt, into the end (Iron Crown)', () => {
  const { s, evs } = neglect('iron');
  assert.ok(ofType(evs, 'tribute').length >= 2 && ofType(evs, 'tribute').every(t => !t.paid));
  assert.ok(s.ended, 'the reign ended');
  assert.ok(s.ended!.reason === 'bankrupt' || s.ended!.reason === 'charter_revoked');
  assert.deepEqual(ofType(evs, 'game_over').map(e => e.reason), [s.ended!.reason]);
  assert.equal(ofType(evs, 'demotion').length, 0);
  assert.ok(s.ended!.epitaph.includes('Luke') && s.ended!.epitaph.includes('Mudlark Hollow'));
  note(`iron: ended on day ${Math.floor(s.ended!.day)} (${s.ended!.reason}): "${s.ended!.epitaph}"`);
});

test('the moneylender goes by his name once the cast gives him one, and by his trade where the name will not fit', () => {
  const def = NPC_DEFS.moneylender; const was = def.name;
  def.name = 'Master Ambrose Pennyworth-Quillfeather';
  try {
    const s = fixture('knight'); s.mode = 'peace'; s.gold = -40;
    modesModule.onDay!(s, Math.floor(s.day) + 1);
    const cover = ofType(drain(s), 'herald').map(e => e.herald.text).join(' ');
    assert.match(cover, /Master Ambrose Pennyworth-Quillfeather/);
    s.loans = [{ principal: 700, ratePctMonth: 6, takenDay: 0 }]; s.gold = 0;
    modesModule.onMonth!(s, 1);
    const warn = ofType(drain(s), 'herald').filter(e => e.herald.kind === 'urgent').map(e => e.herald.text);
    assert.equal(warn.length, 1); assert.match(warn[0]!, /says the moneylender, gently/); assert.match(warn[0]!, /three months/);
    assert.ok(warn[0]!.length <= MODES_TUNE.heraldCap);
    const no = dispatch(s, { type: 'take_loan', amount: 5 });
    assert.ok(!no.ok && /^Master Ambrose/.test(no.reason) && /\bHe says\b/.test(no.reason), JSON.stringify(no));
    // and is spoken of as the cast describes
    def.name = 'Mistress Prudence Tallow';
    const f = fixture('reeve'); f.gold = -9;
    modesModule.onDay!(f, Math.floor(f.day) + 1); f.gold = -30; f.day += 20; modesModule.onDay!(f, Math.floor(f.day));
    const hers = ofType(drain(f), 'herald').map(e => e.herald.text);
    assert.equal(hers.length, 2);
    for (const line of hers) { assert.match(line, /Mistress Prudence Tallow/); assert.doesNotMatch(line, /\b(he|his|him)\b/i, line); }
    assert.match(hers[0]!, /Mistress Prudence Tallow the moneylender/, 'the line that opens the account says who she is');
    assert.doesNotMatch(hers[1]!, /the moneylender/, 'after that the name will do');
    assert.match(hers.join(' '), /\b(she|her)\b/i);
  } finally { def.name = was; }
  assert.equal(pronounsFor('Baron Aldous Vane').his, 'his'); assert.equal(pronounsFor('Baroness Hale').his, 'her');
  assert.equal(pronounsFor('the Widow Crake').He, 'She'); assert.equal(pronounsFor('Silas Grote').he, 'he');
  assert.equal(pronounsFor('Prudence Tallow', 'She lends at six in the hundred, and she remembers.').him, 'her');
});

test('abdicate, and the small handlers', () => {
  const sim = Sim.create({ seed: 5, ruler: 'Luke' }); const s = sim.state;
  assert.equal(sim.dispatch({ type: 'set_speed', speed: 4 }).ok, true); assert.equal(s.speed, 4);
  assert.equal(sim.dispatch({ type: 'set_speed', speed: 3 as never }).ok, false); assert.equal(s.speed, 4);
  assert.equal(sim.dispatch({ type: 'mark_seen', key: 'hint.rentday' }).ok, true); assert.equal(s.seen['hint.rentday'], true);
  assert.equal(sim.dispatch({ type: 'mark_seen', key: '' }).ok, false);
  assert.equal(sim.dispatch({ type: 'set_flag', key: 'met_the_goose', value: 3 }).ok, true); assert.equal(s.flags['met_the_goose'], 3);
  assert.equal(sim.dispatch({ type: 'set_flag', key: 'bad', value: Number.NaN }).ok, false);
  const kept = sim.dispatch({ type: 'set_flag', key: 'debt.shutUntil', value: 0 });
  assert.ok(!kept.ok && kept.code === 'blocked', 'the engine\'s own books cannot be written from outside');
  assert.equal(sim.dispatch({ type: 'abdicate' }).ok, true);
  assert.equal(s.ended?.reason, 'abdicated');
  assert.match(s.ended!.epitaph, /Reeve Luke laid down the charter/);
  const evs = sim.drain();
  assert.ok(evs.some(e => e.type === 'game_over' && e.reason === 'abdicated'));
  assert.equal(sim.dispatch({ type: 'abdicate' }).ok, false);
  assert.equal(sim.dispatch({ type: 'set_speed', speed: 0 }).ok, true, 'speed can still be set once it is over');
  const day = s.day; sim.advanceDays(5); assert.equal(s.day, day, 'time has stopped');
});

test('epitaphs are built from the record', () => {
  const s = fixture('baron'); s.day = 360 * 4 + 75;
  s.stats.tenantsHoused = 31; s.stats.evictions = 9; s.stats.oathsBroken = 4; s.stats.oathsKept = 2;
  s.loans = [{ principal: 2410, ratePctMonth: 6, takenDay: 0 }];
  const e = writeEpitaph(s, 'bankrupt');
  assert.match(e, /^Baron Luke of Mudlark Hollow ruled four years and two months and was undone by arithmetic, owing the moneylender 2,410 crowns\./);
  assert.match(e, / Thirty-one households were housed in that time and nine were put out\./);
  assert.match(e, /Four oaths were broken, and the well kept count\.$/);
  s.stats.evictions = 0; s.stats.oathsBroken = 0; s.stats.oathsKept = 6; s.loans = [];
  const a = writeEpitaph(s, 'abdicated');
  assert.match(a, /owing nothing to anyone/); assert.match(a, /not one was put out/); assert.match(a, /Every oath was kept, all six of them/);
  // what passes to the heir, and what the Dynasty Hall is told
  assert.equal(heirloomOf(s), 'the Ledger of Oaths, every page of it kept');
  s.stats.oathsKept = 1; s.renown = 50; s.ended = { reason: 'bankrupt', day: s.day, epitaph: e };
  for (const b of Object.values(s.buildings)) if (b.type === 'statue') b.state = 'building';
  assert.match(heirloomOf(s), /coffer/);
  const rec = reignRecord(s);
  assert.deepEqual({ ...rec, heirloom: '' }, { ruler: 'Luke', realm: 'Mudlark Hollow', rank: 'baron', mode: s.mode, years: 4.2, households: 31, peakRentRoll: Math.round(s.stats.peakRentRoll), epitaph: e, heirloom: '' });
  assert.ok(!/[.{}]|undefined/.test(rec.heirloom) && rec.heirloom.length <= 60, rec.heirloom);
  s.ended = null;
  assert.equal(spanText(10), 'less than a month'); assert.equal(spanText(360), 'one year'); assert.equal(spanText(395), 'one year and one month');
  assert.equal(numWord(12), 'twelve'); assert.equal(numWord(36), 'thirty-six'); assert.equal(numWord(80), 'eighty'); assert.equal(numWord(0), 'no');
  assert.equal(numWord(100), '100'); assert.equal(numWord(1240), '1,240'); assert.equal(crowns(1234567), '1,234,567');
  for (const text of [e, a, writeEpitaph(s, 'charter_revoked'), writeEpitaph(s, 'demoted_debt', { from: 'baron', to: 'knight', debt: 1800 }), writeEpitaph(s, 'demoted_favor', { from: 'baron', to: 'knight' })]) {
    assert.ok(!/[–—{}]|undefined|NaN/.test(text), text);
    assert.ok(text.length < 330, `${text.length}: ${text}`);
  }
});

test('an heir with an heirloom starts with a modest boon, once; a founder does not', () => {
  const heirloom = 'the ribbon from the charter, the Crown having kept the rest';
  const founder = Sim.create({ seed: 5, ruler: 'Luke', mode: 'iron' }).state;
  const sim = Sim.create({ seed: 5, ruler: 'Luke', mode: 'iron', heirloom, reign: 2 }); const s = sim.state;
  const boon = s.gold - founder.gold;
  assert.ok(boon > 0 && boon <= 40, `a modest sum: ${boon}`);
  assert.equal(boon, Math.min(MODES_TUNE.heirloomBoonCap, Math.round(BAL.startGold * MODES_TUNE.heirloomBoonShare)));
  assert.equal(MODES_TUNE.heirloomBoonCap, 40);
  const entry = s.ledger.txns.filter(x => x.cat === 'windfall');
  assert.deepEqual(entry.map(x => [x.amount, x.memo]), [[boon, 'An heirloom, pawned and redeemed']]);
  const said = s.heralds.filter(h => h.text.includes('the ribbon from the charter'));
  assert.equal(said.length, 1, 'one line, naming it');
  assert.ok(said[0]!.text.includes(heirloom) && said[0]!.text.includes(`${boon} crowns`), said[0]!.text);
  assert.ok(said[0]!.text.length <= MODES_TUNE.heraldCap && !/[–—{}]|undefined/.test(said[0]!.text), said[0]!.text);
  assert.equal(s.heralds.indexOf(said[0]!), s.heralds.length - 1, 'it follows the proclamation');
  note(`heirloom: "${said[0]!.text}"`);
  // never twice: not when asked again, not after a save and a load, not as the days go by
  const gold = s.gold;
  assert.equal(heirloomBoon(s), 0); assert.equal(s.gold, gold);
  const back = deserialize(serialize(s));
  assert.equal(heirloomBoon(back), 0); assert.equal(back.gold, gold);
  sim.advanceDays(45);
  assert.equal(s.ledger.txns.filter(x => x.cat === 'windfall' && /heirloom/.test(x.memo)).length, 1);
  assert.equal(s.heralds.filter(h => h.text.includes('the ribbon from the charter')).length, 1);
  // a founder has nothing to redeem, and neither has an heir who was left nothing
  assert.equal(founder.ledger.txns.filter(x => x.cat === 'windfall').length, 0);
  assert.equal(Sim.create({ seed: 5, ruler: 'Luke', mode: 'iron', heirloom, reign: 1 }).state.gold, founder.gold);
  assert.equal(Sim.create({ seed: 5, ruler: 'Luke', mode: 'iron', heirloom: null, reign: 3 }).state.gold, founder.gold);
  // every heirloom the engine can hand down fits the line, and so does one it did not write
  for (const h of ['the Ledger of Oaths, every page of it kept', 'a coffer with an excellent lock and nothing in it', 'x'.repeat(30) + ', ' + 'y'.repeat(70) + '.']) {
    const f = fixture('reeve'); f.realm.heirloom = h; f.realm.reign = 4; const was = f.gold;
    assert.equal(heirloomBoon(f), boon); assert.equal(f.gold, was + boon);
    const line = f.heralds[f.heralds.length - 1]!;
    assert.equal(line.kind, 'good'); assert.ok(line.text.length <= MODES_TUNE.heraldCap && line.text.includes(h.split(',')[0]!), line.text);
    assert.equal(heirloomBoon(f), 0); drain(f);
  }
});

// ───────────────────────────── rival ─────────────────────────────

console.log('\nrival');

/** A lord with the upper hand, for as long as the test keeps saying so. */
function overbearing(s: GameState, temperament: 'grasping' | 'charming' | 'ruthless'): void {
  s.rival = { ...s.rival, temperament, renown: 92, lastMoveDay: 0, poached: 0 };
  s.renown = 30;
}

test('he moves every month or two, takes at most one household a month, and leaves at least two', () => {
  for (const temperament of ['grasping', 'charming', 'ruthless'] as const) {
    const s = fixture('knight'); s.day = 30; overbearing(s, temperament);
    for (const t of housed(s)) { t.happiness = 35; t.lateStage = 'none'; t.movedInDay = -200; }
    const start = householdCount(s);
    const moveDays: number[] = []; const outDays: number[] = [];
    for (let i = 0; i < 360 * 3; i++) {
      s.rival.renown = 92; s.renown = 30;               // hold the advantage
      const last = s.rival.lastMoveDay;
      const before = householdCount(s);
      s.day += 1; rivalModule.onDay!(s, s.day);
      if (s.rival.lastMoveDay !== last) moveDays.push(s.day);
      if (householdCount(s) < before) { outDays.push(s.day); assert.equal(before - householdCount(s), 1); }
      assert.ok(householdCount(s) >= RIVAL_TUNE.minHouseholdsLeft, 'never below two households');
    }
    const evs = drain(s);
    const gaps = moveDays.slice(1).map((d, i) => d - moveDays[i]!);
    assert.ok(moveDays.length >= 17 && moveDays.length <= 36, `${moveDays.length} moves in three years`);
    assert.ok(gaps.every(g => g >= 30 && g <= 61), 'a month or two between moves: ' + gaps.join(','));
    assert.ok(outDays.slice(1).every((d, i) => d - outDays[i]! >= 30), 'never more than one household a month');
    assert.equal(s.rival.poached, outDays.length);
    assert.ok(outDays.length >= 3, `${temperament}: with the upper hand he does poach (${outDays.length})`);
    assert.ok(householdCount(s) <= start - outDays.length);
    assert.equal(ofType(evs, 'tenant_out').filter(e => e.reason === 'poached').length, outDays.length);
  }
});

test('he stops at two households', () => {
  const s = fixture('reeve'); s.day = 30; overbearing(s, 'ruthless');
  const keep = housed(s).slice(0, 3).map(t => t.id);
  for (const t of housed(s)) { if (!keep.includes(t.id)) { t.status = 'left'; const u = s.buildings[t.buildingId!]!.units[t.unit]!; u.tenantId = null; t.buildingId = null; } else { t.happiness = 20; t.movedInDay = -200; t.lateStage = 'none'; } }
  assert.equal(householdCount(s), 3);
  for (let i = 0; i < 360 * 2; i++) { s.rival.renown = 92; s.renown = 30; s.day += 1; rivalModule.onDay!(s, s.day); }
  assert.equal(householdCount(s), 2); assert.equal(s.rival.poached, 1); drain(s);
});

test('a contented household, a kept oath and a recent feast blunt him', () => {
  const s = fixture('knight'); overbearing(s, 'grasping');
  const t = byName(s, 'Wat Mudge'); t.happiness = 40;
  const base = poachChance(s, t);
  assert.ok(base > 0.3, String(base));
  t.happiness = 75; assert.equal(poachChance(s, t), 0, 'a contented household will not hear of it');
  s.rival.temperament = 'charming'; assert.ok(poachChance(s, t) > 0, 'a charmer can still turn a happy head');
  s.rival.temperament = 'grasping'; t.happiness = 40;
  s.oaths.push({ id: 'wk', kind: 'word', text: 'x', toTenantId: t.id, toName: t.name, buildingId: null, buildingType: null, amount: null, madeDay: 1, dueDay: 31, state: 'kept', settledDay: 31 });
  const withOath = poachChance(s, t);
  assert.ok(withOath < base * 0.5, `${withOath} vs ${base}`);
  s.flags['lastFeastDay'] = s.day - 3;                   // where economy.lastFeastDay keeps it
  assert.equal(lastFeastDay(s), s.day - 3);
  assert.ok(poachChance(s, t) < withOath * 0.6, 'a feast makes his offers look thin');
  s.flags['lastFeastDay'] = s.day - RIVAL_TUNE.feastDays - 1;
  assert.equal(poachChance(s, t), withOath, 'and is forgotten in time');
});

test('when he cannot poach, each temperament does its own mischief, in its own voice', () => {
  const lines: Record<string, string> = {};
  for (const temperament of ['grasping', 'charming', 'ruthless'] as const) {
    const s = fixture('knight'); s.day = 100; s.rival = { ...s.rival, temperament, renown: 40, lastMoveDay: 0 }; s.renown = 50;
    s.flags['rival.met'] = true;
    for (const t of housed(s)) t.lease!.rent = 60;            // everyone is overcharged
    const mood = housed(s).reduce((a, t) => a + t.happiness, 0);
    const hisRenown = s.rival.renown;
    assert.equal(nextMoveDay(s) >= RIVAL_TUNE.firstMoveMin, true);
    s.day += 1; rivalModule.onDay!(s, s.day);
    assert.equal(s.rival.lastMoveDay, s.day, 'he moved');
    const said = ofType(drain(s), 'herald').filter(e => e.herald.kind === 'rival');
    assert.equal(said.length, 1); lines[temperament] = said[0]!.herald.text;
    assert.equal(householdCount(s), housed(s).length);
    if (temperament === 'grasping') assert.ok(housed(s).reduce((a, t) => a + t.happiness, 0) < mood, 'undercut: the overcharged are restless');
    if (temperament === 'charming') assert.ok(s.rival.renown > hisRenown + 1, 'his feast raises his name');
    if (temperament === 'ruthless') assert.equal(s.renown, 50 + RIVAL_TUNE.rumourRenown, 'a rumour costs you renown');
  }
  assert.equal(new Set(Object.values(lines)).size, 3);
  // each in his own register: prices, parties, whispers
  assert.match(lines.grasping!, /rent|cheap|charge|handbill|price/);
  assert.match(lines.charming!, /feast|danc|goose|fiddler|baby|horse|pie/);
  assert.match(lines.ruthless!, /rumour|saying|said|notice|story|chalk|whisper|ballad/);
  for (const line of Object.values(lines)) assert.ok(line.includes('Vane') || line.includes('Greywater'), 'it is plainly his doing: ' + line);
});

/** The fixture's empty hovel, cleared of goblins and put up to let. */
function openVacancy(s: GameState): Building {
  const b = Object.values(s.buildings).find(x => x.name === 'Damp End')!;
  b.squatters = null; b.visuals = []; b.state = 'ready'; b.condition = 70;
  b.units[0]!.tenantId = null; b.units[0]!.listed = true; b.units[0]!.vacantSince = s.day - 5;
  for (const id of Object.keys(s.incidents)) if (s.incidents[id]!.buildingId === b.id) delete s.incidents[id];
  return b;
}

test('when your renown beats his by 15, one of his households comes asking', () => {
  const s = fixture('knight'); s.day = 50; s.flags['rival.met'] = true;
  s.rival = { ...s.rival, renown: 40, lastMoveDay: 49 }; s.renown = 56;
  const home = openVacancy(s);
  const before = Object.keys(s.applicants).length;
  s.day += 1; rivalModule.onDay!(s, s.day);
  const got = Object.keys(s.applicants).length - before;
  const lines = ofType(drain(s), 'herald').filter(e => e.herald.kind === 'rival');
  if (got === 0) {
    assert.equal(lines.length, 0, 'no line without a household');
    note('tenants.spawnApplicant returned nothing for an open, listed hovel (still a placeholder?): the defection itself could not be observed');
  } else {
    assert.equal(got, 1); assert.equal(lines.length, 1);
    assert.match(lines[0]!.herald.text, /household|family/); assert.ok(lines[0]!.herald.text.includes(home.name));
    assert.equal(lines[0]!.herald.buildingId, home.id);
    assert.ok(s.rival.renown < 40.5, 'it costs him a little');
    for (let i = 0; i < 20; i++) { s.rival.renown = 30; s.day += 1; rivalModule.onDay!(s, s.day); }
    assert.equal(Object.keys(s.applicants).length - before, 1, 'not again for a while');
  }
  // a lead of 14 is not enough
  const s2 = fixture('knight'); s2.day = 50; s2.flags['rival.met'] = true; s2.rival = { ...s2.rival, renown: 40, lastMoveDay: 49 }; s2.renown = 54;
  openVacancy(s2);
  const b2 = Object.keys(s2.applicants).length;
  s2.day += 1; rivalModule.onDay!(s2, s2.day);
  assert.equal(Object.keys(s2.applicants).length, b2);
  assert.equal(ofType(drain(s2), 'herald').filter(e => e.herald.kind === 'rival').length, 0);
  // with nothing to let, they are turned away, and the ruler hears what a vacancy would have been worth
  const s3 = fixture('knight'); s3.day = 50; s3.flags['rival.met'] = true; s3.rival = { ...s3.rival, renown: 40, lastMoveDay: 49 }; s3.renown = 60;
  for (const b of Object.values(s3.buildings)) for (const u of b.units) u.listed = false;
  s3.day += 1; rivalModule.onDay!(s3, s3.day); s3.day += 1; rivalModule.onDay!(s3, s3.day);
  const turned = ofType(drain(s3), 'herald').filter(e => e.herald.kind === 'rival');
  assert.equal(turned.length, 1); assert.match(turned[0]!.herald.text, /anything to let|Every one is taken/);
});

test('he introduces himself early in the reign, once', () => {
  const s = fixture('reeve'); s.day = 0; s.rival.lastMoveDay = 0;
  for (let i = 0; i < 10; i++) { s.day += 1; rivalModule.onDay!(s, s.day); }
  const said = ofType(drain(s), 'herald').filter(e => e.herald.kind === 'rival');
  assert.equal(said.length, 1); assert.ok(said[0]!.herald.text.includes(s.rival.name));
});

// ───────────────────────────── save ─────────────────────────────

console.log('\nsave');

const plain = (s: GameState): unknown => {
  const { _events: _drop, ...rest } = s;
  const copy = JSON.parse(JSON.stringify(rest));
  // the dev fixture leaves its own construction option on some buildings; it is not part of a Building
  for (const b of Object.values(copy.buildings as Record<string, Record<string, unknown>>)) delete b['empty'];
  return copy;
};

/** Paths at which two JSON values differ (first few). */
function diff(a: unknown, b: unknown, path = '', out: string[] = []): string[] {
  if (out.length >= 12) return out;
  if (a === b) return out;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') { out.push(`${path}: ${JSON.stringify(a)?.slice(0, 60)} vs ${JSON.stringify(b)?.slice(0, 60)}`); return out; }
  const ka = Object.keys(a as object), kb = Object.keys(b as object);
  for (const k of new Set([...ka, ...kb])) diff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], path ? path + '.' + k : k, out);
  return out;
}

test('round trip is exact on the fixture states, and loses nothing', () => {
  for (const rank of ['reeve', 'knight', 'baron'] as const) {
    const s = makeFixtureState(rank);
    const before = JSON.stringify(s);
    const one = serialize(s);
    assert.equal(JSON.stringify(s), before, 'serialize does not touch the state');
    assert.ok(!one.includes('"_events"'), '_events is never saved');
    const back = deserialize(one);
    assert.deepEqual(back._events, []);
    assert.equal(serialize(back), one, 'serialize(deserialize(serialize(s))) === serialize(s)');
    assert.deepEqual(diff(plain(back), plain(s)), [], 'every field of the fixture survives');
    assert.equal(back.version, SAVE_VERSION);
  }
});

test('events in flight are not saved', () => {
  const s = makeFixtureState('reeve');
  s._events.push({ type: 'rent_day' }, { type: 'day', day: 3 });
  const back = deserialize(serialize(s));
  assert.deepEqual(back._events, []); assert.equal(s._events.length, 2);
});

test('loading is tolerant: missing fields are filled, unknown ones dropped, wrong types replaced', () => {
  const s = makeFixtureState('knight');
  const raw = JSON.parse(serialize(s)) as Record<string, any>;
  const someTenant = Object.keys(raw.tenants)[0]!;
  delete raw.rival; delete raw.policies.pets; delete raw.stats; delete raw.seen; delete raw.tenants[someTenant].memory;
  delete raw.tenants[someTenant].wear; delete raw.charter.sinceDay; delete raw.weather; delete raw.heralds[0].kind;
  raw.gold = 'lots'; raw.speed = 3; raw.futureField = { a: 1 }; raw.realm.motto = 'Rent is due'; raw.tenants[someTenant].secret = true;
  raw.buildings.bogus = 'not a building'; raw.oaths.push(17); raw.day = null; raw.tenants[someTenant].traits.push('telepathic');
  raw.flags.nested = { no: 1 }; raw._events = [{ type: 'rent_day' }];
  raw.tenants[someTenant].aux = { due: 12, payDay: 3, bad: null, list: [1, 'a'] };
  const back = deserialize(JSON.stringify(raw)) as GameState & Record<string, any>;
  assert.deepEqual(back.rival, { name: '', seat: '', renown: 50, temperament: 'grasping', portraitSeed: 0, poached: 0, lastMoveDay: 0 });
  assert.equal(back.policies.pets, 'pet_rent'); assert.equal(back.policies.graceDays, 3);
  assert.equal(back.stats.oathsKept, 0); assert.deepEqual(back.seen, {});
  assert.deepEqual(back.tenants[someTenant]!.memory, []); assert.equal(back.tenants[someTenant]!.wear, 0);
  assert.equal(back.charter.sinceDay, 0); assert.equal(back.weather, 'clear'); assert.equal(back.heralds[0]!.kind, 'info');
  assert.equal(back.gold, 0); assert.equal(back.speed, 1); assert.equal(back.day, 0);
  assert.equal(back.futureField, undefined); assert.equal((back.realm as any).motto, undefined);
  assert.equal((back.tenants[someTenant] as any).secret, undefined); assert.equal(back.buildings['bogus'], undefined);
  assert.ok(!back.tenants[someTenant]!.traits.includes('telepathic' as never));
  assert.equal(back.oaths.length, s.oaths.length); assert.equal(back.flags['nested'], undefined);
  assert.deepEqual(back._events, []);
  assert.deepEqual((back.tenants[someTenant] as any).aux, { due: 12, payDay: 3, bad: null, list: [1, 'a'] }, 'a module\'s own notes on an entity are kept');
  assert.equal(Object.keys(back.tenants).length, Object.keys(s.tenants).length);
  assert.equal(serialize(deserialize(serialize(back))), serialize(back));
  // an empty object is a (very quiet) reign
  const empty = deserialize('{}');
  assert.equal(empty.version, SAVE_VERSION); assert.equal(empty.realm.rank, 'reeve'); assert.deepEqual(empty.oaths, []);
});

test('a save from a newer version, or one that is not a save, is refused plainly', () => {
  const s = makeFixtureState('reeve');
  const raw = JSON.parse(serialize(s)); raw.version = SAVE_VERSION + 1;
  assert.throws(() => deserialize(JSON.stringify(raw)), /newer LandLord/);
  assert.throws(() => deserialize('not json at all'), /cannot be read/);
  assert.throws(() => deserialize('[1,2,3]'), /cannot be read/);
  assert.throws(() => deserialize('null'), /cannot be read/);
  assert.throws(() => Sim.load('{{'), /cannot be read/);
});

/** A reign played by script: some borrowing, some promising, the odd promotion attempt. */
function playedReign(seed: number, days: number, mode: 'peace' | 'iron' = 'peace'): Sim {
  const sim = Sim.create({ seed, ruler: 'Luke', mode });
  const s = sim.state;
  for (let d = 0; d < days && !s.ended; d++) {
    sim.advanceDays(1);
    const day = Math.floor(s.day);
    if (day === 5) sim.dispatch({ type: 'take_loan', amount: 60 });
    if (day === 9 || day === 130) {
      const t = housed(s)[0];
      if (t) sim.dispatch({ type: 'swear_oath', oath: { kind: day === 9 ? 'repair' : 'no_evict', text: day === 9 ? 'I will see to the roof.' : 'You will not be put out.', toTenantId: t.id, toName: t.name, buildingId: null, buildingType: null, amount: null, dueDay: s.day + 80 } });
    }
    if (day === 40) sim.dispatch({ type: 'set_flag', key: 'test.flag', value: 'x' });
    if (day === 70) sim.dispatch({ type: 'repay_loan', amount: 20 });
    if (day % 45 === 0) sim.dispatch({ type: 'collect_all' });
    if (day % 30 === 3) sim.dispatch({ type: 'accept_promotion' });
    sim.drain();
  }
  return sim;
}

const CROWN_KEYS = ['oaths', 'charter', 'rival', 'loans', 'ended', 'realm'];
/** Did two runs that should match differ in state the crown modules own? */
function crownDiffers(a: GameState, b: GameState): boolean {
  const pa = plain(a) as Record<string, unknown>, pb = plain(b) as Record<string, unknown>;
  return CROWN_KEYS.some(k => JSON.stringify(pa[k]) !== JSON.stringify(pb[k]));
}

test('round trip is exact on a simulated reign, and the loaded reign carries on identically', () => {
  const sim = playedReign(2024, 420);
  const s = sim.state;
  const one = sim.save();
  const loaded = Sim.load(one);
  assert.equal(loaded.save(), one, 'exact round trip');
  const lost = diff(plain(loaded.state), plain(s));
  if (lost.length) note('fields outside the GameState contract were dropped by the save (owners should move them into typed state): ' + lost.join(' | '));
  assert.ok(s.heralds.length > 5 && Object.keys(s.buildings).length >= 4, 'a real reign was saved');
  sim.advanceDays(90); loaded.advanceDays(90);
  if (sim.save() !== loaded.save()) {
    assert.ok(!crownDiffers(sim.state, loaded.state), 'crown-owned state diverged after load: ' + diff(plain(sim.state), plain(loaded.state)).join(' | '));
    note('after loading, the reign diverged in state the crown modules do not own (state kept outside GameState by another module?): ' + diff(plain(sim.state), plain(loaded.state)).slice(0, 4).join(' | '));
  }
});

/** A simple steward for a long reign: collects, lists, settles what comes up by its first answer, borrows and repays. */
function stewardDay(sim: Sim): void {
  const s = sim.state; const day = Math.floor(s.day);
  if (day % 3 === 0) sim.dispatch({ type: 'collect_all' });
  for (const inc of Object.values(s.incidents)) {
    const def = INCIDENT_BY_ID[inc.defId];
    if (inc.state === 'open' && !inc.outcomeId && def?.outcomes[0]) sim.dispatch({ type: 'resolve_incident', incidentId: inc.id, outcomeId: def.outcomes[0].id });
  }
  for (const b of Object.values(s.buildings)) if (b.units.some(u => !u.tenantId && !u.listed)) sim.dispatch({ type: 'set_listed', buildingId: b.id, listed: true });
  if (day % 30 === 3) sim.dispatch({ type: 'accept_promotion' });
  if (day === 9 || day % 200 === 130) {
    const t = housed(s)[0];
    if (t) sim.dispatch({ type: 'swear_oath', oath: { kind: day === 9 ? 'repair' : 'no_evict', text: 'You have my word.', toTenantId: t.id, toName: t.name, buildingId: null, buildingType: null, amount: null, dueDay: s.day + 80 } });
  }
  if (day % 170 === 60) sim.dispatch({ type: 'take_loan', amount: 40 });
  if (day % 170 === 120) sim.dispatch({ type: 'repay_loan', amount: 25 });
  if (day % 240 === 100) sim.dispatch({ type: 'hold_feast' });
  sim.drain();
}

test('three years with the real content, saved and loaded every 50 days: exact each time, and the same reign as one never saved', () => {
  const start = (): Sim => Sim.create({ seed: 7, ruler: 'Luke', mode: 'peace', heirloom: 'the keys to the seat, on a piece of string', reign: 2 });
  let sim = start(); const twin = start();
  let saves = 0; const lost = new Set<string>(); let busiest = 0;
  for (let d = 1; d <= 1080 && !sim.state.ended; d++) {
    sim.advanceDays(1); stewardDay(sim); twin.advanceDays(1); stewardDay(twin);
    if (d % 50 !== 0) continue;
    const json = sim.save(); saves++;
    const loaded = Sim.load(json);
    assert.equal(loaded.save(), json, `exact round trip on day ${d}`);
    for (const p of diff(plain(loaded.state), plain(sim.state))) lost.add(p.split(':')[0]!.replace(/\d+/g, '#'));
    busiest = Math.max(busiest, housed(sim.state).length + Object.keys(sim.state.incidents).length + Object.keys(sim.state.jobs).length);
    sim = loaded;                                           // the reign carries on from the save
  }
  assert.equal(saves, 21); assert.ok(busiest >= 3, 'there was something to save');
  assert.deepEqual([...lost], [], 'fields outside the GameState contract were dropped by the save');
  if (sim.save() !== twin.save()) {
    assert.ok(!crownDiffers(sim.state, twin.state), 'crown-owned state diverged across the saves: ' + diff(plain(sim.state), plain(twin.state)).join(' | '));
    note('across 21 saves the reign diverged from its unsaved twin in state the crown modules do not own: ' + diff(plain(sim.state), plain(twin.state)).slice(0, 4).join(' | '));
  }
  note(`three years: ${saves} saves of about ${Math.round(sim.save().length / 1024)} kB, day ${Math.floor(sim.state.day)}, ${sim.state.realm.rank}, ${housed(sim.state).length} households, ${sim.state.heralds.length} herald lines`);
});

// ───────────────────────────── determinism ─────────────────────────────

console.log('\ndeterminism');

test('the crown modules are deterministic on their own', () => {
  const run = (): string => {
    const s = fixture('knight'); s.day = 30; s.gold = 20; overbearing(s, 'charming');
    const t = byName(s, 'Wat Mudge');
    swear(s, oathSpec({ kind: 'no_evict', text: 'You stay.', toTenantId: t.id, dueDay: s.day + 120 }));
    swear(s, oathSpec({ kind: 'build', text: 'A second well.', buildingType: 'well', dueDay: s.day + 200 }));
    for (let i = 0; i < 500; i++) { if (i % 37 === 0) s.gold -= 45; crownDay(s); }
    drain(s);
    return serialize(s);
  };
  assert.equal(run(), run());
});

test('the same seed and the same orders give the same reign', () => {
  const a = playedReign(99, 300), b = playedReign(99, 300);
  if (a.save() !== b.save()) {
    assert.ok(!crownDiffers(a.state, b.state), 'crown-owned state is not deterministic: ' + diff(plain(a.state), plain(b.state)).join(' | '));
    note('two runs of one seed differ in state the crown modules do not own: ' + diff(plain(a.state), plain(b.state)).slice(0, 4).join(' | '));
  }
  const c = playedReign(100, 60);
  assert.notEqual(c.save(), a.save());
  const rivals = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(seed => Sim.create({ seed }).state.rival.name));
  if (RIVAL_NAMES.length > 1) assert.ok(rivals.size > 1, 'different seeds roll different rivals');
});

// ───────────────────────────── wording ─────────────────────────────

console.log('\nwording');

test('long names never push a herald line past the cap', () => {
  const s = fixture('knight');
  s.realm.name = 'Thistle-under-Wold-by-the-Water'; s.realm.ruler = 'Bartholomew the Unready';
  s.rival = { ...s.rival, name: 'Baroness Wilhelmina Crookshank-Vane', seat: 'Upper Greywater-on-Sludge' };
  const t = byName(s, 'Old Marta Thistlewick'); t.name = 'Magister Quillon Vantablack the Younger'; t.first = 'Quillon';
  homeOf(s, t).name = 'The Exceedingly Leaning Hovel';
  for (const x of housed(s)) if (x !== t) { x.name = 'Dame Ottoline Featherstonehaugh-Mudge'; x.first = 'Ottoline'; homeOf(s, x).name = 'The Old Tannery Annexe (North Wing)'; }
  const kinds = ['repair', 'no_rent_raise', 'rent_cap', 'no_evict', 'build', 'pay', 'word'] as const;
  for (let round = 0; round < 6; round++) {
    for (const kind of kinds) {
      for (const end of ['keep', 'break', 'release'] as const) {
        s.oaths = []; t.status = 'housed'; t.lateStage = 'none'; t.happiness = end === 'release' ? 90 : 50; t.lease!.rent = 8;
        homeOf(s, t).condition = 40;
        const o = swear(s, oathSpec({ kind, text: 'I give you my solemn word on this matter, and on several adjacent matters besides, before the whole lane.', toTenantId: t.id, buildingType: kind === 'build' ? 'notice_board' : null, amount: kind === 'pay' ? 1250 : null, dueDay: s.day + 40 }));
        if (end === 'release') { dispatch(s, { type: 'release_oath', oathId: o.id }); continue; }
        if (end === 'break') { if (kind === 'no_evict') t.lateStage = 'noticed'; else if (kind === 'no_rent_raise' || kind === 'rent_cap') t.lease!.rent = 99; else if (kind === 'word') { t.happiness = 10; dispatch(s, { type: 'release_oath', oathId: o.id }); } else s.day += 41; tick(s); assert.equal(o.state, 'broken', kind); continue; }
        if (kind === 'repair') homeOf(s, t).condition = 90; else if (kind === 'pay') spend(s, 1250, 'gifts', 'As promised', { tenantId: t.id }); else if (kind === 'build') oathsModule.onJobDone!(s, fakeJob('build', Object.values(s.buildings).find(b => b.type === 'notice_board')!.id)); else s.day += 41;
        tick(s); assert.equal(o.state, 'kept', kind);
      }
    }
    for (const temperament of ['grasping', 'charming', 'ruthless'] as const) {
      s.rival.temperament = temperament; s.rival.renown = round % 2 ? 95 : 20; s.renown = 50; s.rival.lastMoveDay = Math.floor(s.day) - 70;
      t.movedInDay = s.day;                              // too newly arrived to be approached: the others are fair game
      for (const x of housed(s)) if (x !== t) { x.happiness = 30; x.movedInDay = -500; x.lateStage = 'none'; }
      s.day += 1; rivalModule.onDay!(s, s.day);
    }
    if (round === 2) s.loans.push({ principal: 900, ratePctMonth: 6, takenDay: s.day });
    s.gold = -30 * (round + 1); modesModule.onDay!(s, Math.floor(s.day)); modesModule.onMonth!(s, 3 + round);
  }
  drain(s);
  assert.equal(clipLine('One. Two. ' + 'x'.repeat(200) + '.', 150), 'One. Two.');
  assert.ok(clipLine('y'.repeat(400), 150).length <= 150);
});

test('every line the crown modules sent is in voice: within the cap, no dashes, no stray braces', () => {
  assert.ok(allHeralds.length > 150, `${allHeralds.length} lines collected`);
  const seen = new Set(allHeralds);
  for (const line of seen) {
    assert.ok(line.length <= MODES_TUNE.heraldCap, `${line.length} chars: ${line}`);
    assert.ok(!/[–—]/.test(line), 'dash: ' + line);
    assert.ok(!/[{}]|undefined|NaN|\bnull\b/.test(line), 'unfilled: ' + line);
    assert.ok(!/\s{2,}| [,.;:]/.test(line), 'spacing: ' + line);
    assert.ok(/[.!?"']$/.test(line), 'ends cleanly: ' + line);
    assert.ok(!/\b(1|one) crowns\b/i.test(line), 'one crown, not one crowns: ' + line);
    // a Baroness is not a "he" (lines about her men, criers and errand boys aside)
    if (/Baroness/.test(line) && !/\b(man|men|crier|boy)\b/.test(line)) assert.ok(!/\b(he|his|him)\b/i.test(line), 'pronoun: ' + line);
  }
  note(`${seen.size} distinct herald lines checked`);
  // CROWN_LINES=1 npx tsx test/sim-crown.test.ts  prints them all, for reading
  if (process.env['CROWN_LINES']) for (const line of [...seen].sort()) console.log('        ' + line);
});

// ───────────────────────────── summary ─────────────────────────────

console.log(`\n${passed} passed, ${failures.length} failed${notes.length ? `, ${notes.length} note(s)` : ''}`);
if (failures.length) { console.log('failed: ' + failures.join('; ')); process.exit(1); }
