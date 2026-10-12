/**
 * sim-people tests: economy, households, applicants, Rent Day, the late pipeline, sureties, renown.
 * Run: npx tsx test/sim-people.test.ts
 *
 * Most tests drive ONLY the four sim-people modules over a small hand-built hamlet, and play the
 * part of the job system themselves (finishJobs), so they hold whether the neighbouring modules are
 * still placeholders or the real thing. The last tests run the whole Sim.
 */
import assert from 'node:assert/strict';
import {
  MAP_W, MAP_H, PARCEL,
  type GameState, type Building, type Tenant, type SimEvent, type Job, type Unit, type StaffMember, type StaffRole,
} from '../src/sim/types';
import { Sim, blankState } from '../src/sim/index';
import { BUILDINGS } from '../src/data/buildings';
import { BAL } from '../src/data/balance';
import { RANKS } from '../src/data/ranks';
import { CHARACTERS } from '../src/data/characters';
import { TRAITS, SPECIES, type BuildingType, type TraitId } from '../src/data/ids';
import { TRADE_DEFS } from '../src/data/trades';
import * as economy from '../src/sim/economy';
import * as tenants from '../src/sim/tenants';
import * as rent from '../src/sim/rent';
import * as renown from '../src/sim/renown';
import { entranceOf } from '../src/sim/world';
import { TUNE as EFFECTS } from '../src/sim/effects';
import { INCIDENT_BY_ID } from '../src/data/incidents/index';
import { makeFixtureState } from '../src/dev/fixture';

const MINE = [economy.economyModule, tenants.tenantsModule, rent.rentModule, renown.renownModule];

/** Roll every test with different dice: SIM_PEOPLE_SEED_SHIFT=7 npx tsx test/sim-people.test.ts */
const SHIFT = Number(process.env.SIM_PEOPLE_SEED_SHIFT ?? 0) | 0;
function newSim(seed: number): Sim { return Sim.create({ seed: seed + SHIFT * 1000, ruler: 'Tester' }); }

// ───────────── harness ─────────────

let events: SimEvent[] = [];
function drain(s: GameState): SimEvent[] { const e = s._events; s._events = []; events.push(...e); return e; }
function eventsOf<T extends SimEvent['type']>(type: T): Extract<SimEvent, { type: T }>[] {
  return events.filter(e => e.type === type) as Extract<SimEvent, { type: T }>[];
}

/** A blank, fully owned, all-grass realm with economy initialised. */
function realm(seed = 7, rank: GameState['realm']['rank'] = 'reeve'): GameState {
  const s = blankState({ seed: seed + SHIFT * 1000, ruler: 'Tester', realm: 'Test Hollow' });
  s.realm.rank = rank;
  s.map.w = MAP_W; s.map.h = MAP_H;
  for (let i = 0; i < MAP_W * MAP_H; i++) s.map.tiles.push({ t: 'grass', b: null, wear: 0, v: i % 256 });
  s.map.parcels = Array.from({ length: 12 }, (_, i) => ({ id: i, x: (i % 4) * PARCEL, y: Math.floor(i / 4) * PARCEL, owned: true, price: 50, minRank: 'reeve' as const, name: 'P' + i }));
  s.rival.name = 'Baron Test';
  economy.economyModule.init!(s);
  events = [];
  s._events = [];
  return s;
}

let bx = 0;
function addBuilding(s: GameState, type: BuildingType, over: Partial<Building> = {}): Building {
  const def = BUILDINGS[type];
  const x = 2 + (bx % 7) * 4, y = 2 + Math.floor(bx / 7) * 4; bx++;
  const b: Building = {
    id: 'b' + (s.nextId++).toString(36), type, x, y, w: def.w, h: def.h, rot: 0, variant: 0, name: `${def.name} ${bx}`,
    level: 1, state: 'ready', progress: 1, condition: 90, units: [], rent: def.baseRent, builtDay: 0, visuals: [], squatters: null, flags: {},
    ...over,
  };
  for (let u = 0; u < def.units; u++) {
    const unit: Unit = { tenantId: null, vacantSince: 0, listed: true, purse: 0, purseDay: 0 };
    b.units.push(unit);
  }
  for (let yy = y; yy < y + b.h; yy++) for (let xx = x; xx < x + b.w; xx++) s.map.tiles[yy * MAP_W + xx]!.b = b.id;
  s.buildings[b.id] = b;
  return b;
}

function addStaff(s: GameState, role: StaffRole, skill = 3): StaffMember {
  const m: StaffMember = {
    id: 's' + (s.nextId++).toString(36), role, name: `Test ${role}`, first: 'Test', species: 'human', portraitSeed: 1,
    temperament: role === 'mason' ? 'steady' : role === 'bailiff' ? 'lawful' : role === 'crier' ? 'honest' : 'bythebook',
    skill, wage: BAL.wageBySkill[skill]!, loyalty: 70, hiredDay: 0, actorId: null, authority: 0, jobsDone: 0,
  };
  s.staff[m.id] = m;
  return m;
}

/** A reliability no arrears, winter or ill humour can dent: this household pays on the day, every time. (Real ones stop at 0.98.) */
const SURE = 9;

/** House a plain, dependable household in the first free unit of a building. */
function settle(s: GameState, b: Building, over: Partial<Tenant> = {}, rentAmount?: number): Tenant {
  const unit = b.units.findIndex(u => !u.tenantId);
  assert.ok(unit >= 0, 'no free unit');
  const hh = tenants.rollHousehold(s, { species: 'human', trade: 'farmer', forBuilding: b.id });
  hh.traits = []; hh.revealed = []; hh.pets = []; hh.character = null; hh.reliability = 1; hh.income = 60;
  const t = tenants.houseDirectly(s, hh, b.id, unit, rentAmount ?? b.rent, { happiness: 70 });
  assert.ok(t, 'houseDirectly failed');
  Object.assign(t, over);
  return t;
}

/** Advance whole days running only the sim-people modules, as Sim.advance would. */
function days(s: GameState, n: number): void {
  for (let i = 0; i < n; i++) {
    for (let q = 0; q < 4; q++) { s.day += 0.25; for (const m of MINE) m.step?.(s, 0.25); }
    s.day = Math.round(s.day);
    const d = s.day;
    for (const m of MINE) m.onDay?.(s, d);
    if (d % 30 === 0) for (const m of MINE) m.onMonth?.(s, d / 30);
    drain(s);
  }
}
function untilDay(s: GameState, day: number): void { days(s, day - Math.round(s.day)); }

/** Play the job system: finish every queued job of these kinds on the spot. Returns how many. */
function finishJobs(s: GameState, kinds: Job['kind'][]): number {
  let n = 0;
  for (const j of Object.values(s.jobs)) {
    if (!kinds.includes(j.kind) || j.state === 'done' || j.state === 'cancelled') continue;
    j.state = 'done'; j.progress = 1;
    for (const m of MINE) m.onJobDone?.(s, j);
    delete s.jobs[j.id];
    n++;
  }
  drain(s);
  return n;
}
function queued(s: GameState, kind: Job['kind']): Job[] {
  return Object.values(s.jobs).filter(j => j.kind === kind && j.state !== 'done' && j.state !== 'cancelled');
}
/** The test rules by calling the options itself; any incident the real engine opened for it is set aside. */
function setAsideIncidents(s: GameState): void {
  for (const inc of Object.values(s.incidents)) if (inc.state === 'open' || inc.state === 'in_progress') inc.state = 'resolved';
  s.pending = [];
}
function doJob(s: GameState, kind: Job['kind'], over: Partial<Job>): void {
  const j: Job = {
    id: 'jt' + (s.nextId++), kind, role: 'ruler', state: 'done', assignee: null, buildingId: null, unit: null, tenantId: null, applicantId: null,
    incidentId: null, outcomeId: null, x: 0, y: 0, workDays: 0.1, progress: 1, cost: 0, priority: 0, createdDay: s.day, byRuler: true, ...over,
  };
  for (const m of MINE) m.onJobDone?.(s, j);
  drain(s);
}

function assertFinite(v: unknown, path: string, seen = new Set<unknown>()): void {
  if (typeof v === 'number') { assert.ok(Number.isFinite(v), `not finite at ${path}: ${v}`); return; }
  if (!v || typeof v !== 'object' || seen.has(v)) return;
  seen.add(v);
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) assertFinite(x, `${path}.${k}`, seen);
}

/** Every unit and its household agree about who lives where; money and moods are sane. */
function assertConsistent(s: GameState, label: string): void {
  assertFinite({ ...s, _events: [] }, label);
  for (const b of Object.values(s.buildings)) {
    b.units.forEach((u, i) => {
      if (u.tenantId) {
        const t = s.tenants[u.tenantId];
        assert.ok(t, `${label}: unit ${b.id}/${i} names a missing household`);
        assert.equal(t.status, 'housed', `${label}: unit holds a departed household`);
        assert.equal(t.buildingId, b.id); assert.equal(t.unit, i);
        assert.equal(u.vacantSince, null);
      } else {
        assert.notEqual(u.vacantSince, null, `${label}: empty unit ${b.id}/${i} has no vacantSince`);
      }
      assert.ok(u.purse >= 0);
    });
  }
  for (const t of Object.values(s.tenants)) {
    assert.ok(t.arrears >= 0, `${label}: negative arrears for ${t.name}`);
    assert.ok(t.happiness >= 0 && t.happiness <= 100);
    assert.ok(Number.isInteger(t.arrears), `${label}: fractional arrears ${t.arrears}`);
    if (t.status === 'housed') {
      assert.ok(t.buildingId && s.buildings[t.buildingId]?.units[t.unit]?.tenantId === t.id, `${label}: ${t.name} is housed nowhere`);
      assert.ok(t.lease && Number.isInteger(t.lease.rent) && t.lease.rent >= 1);
    } else {
      assert.equal(t.buildingId, null);
    }
  }
  for (const a of Object.values(s.applicants)) assert.ok(s.buildings[a.buildingId], `${label}: applicant for a missing building`);
  assert.ok(s.renown >= 0 && s.renown <= 100 && s.favor >= 0 && s.favor <= 100);
  assert.ok(Number.isInteger(s.gold), `${label}: fractional gold ${s.gold}`);
}

function bookNet(s: GameState): number {
  let net = 0;
  for (const m of s.ledger.months) {
    for (const v of Object.values(m.income)) net += v;
    for (const v of Object.values(m.expense)) net -= v;
  }
  return net;
}

const tests: [string, () => void][] = [];
function test(name: string, fn: () => void): void { tests.push([name, fn]); }

// ───────────── economy ─────────────

test('earn and spend book by category, log the transaction, and announce it', () => {
  const s = realm();
  const g0 = s.gold;
  assert.equal(g0, BAL.startGold);
  economy.earn(s, 12, 'rent', 'Rent, Test', { tenantId: 't1', buildingId: 'b1' });
  economy.spend(s, 5, 'repairs', 'Thatch', { buildingId: 'b1' });
  economy.earn(s, 0, 'rent'); economy.spend(s, -3, 'other'); economy.earn(s, NaN, 'windfall');
  drain(s);
  assert.equal(s.gold, g0 + 7);
  const book = economy.currentBook(s);
  assert.equal(book.income.rent, 12); assert.equal(book.expense.repairs, 5);
  assert.equal(book.rentCollected, 12); assert.equal(s.stats.rentCollected, 12);
  assert.equal(book.closing, s.gold);
  assert.equal(s.ledger.txns.length, 2);
  assert.deepEqual(s.ledger.txns[0], { day: 0, amount: 12, cat: 'rent', memo: 'Rent, Test', tenantId: 't1', buildingId: 'b1' });
  assert.equal(s.ledger.txns[1]!.amount, -5);
  const gold = eventsOf('gold');
  assert.equal(gold.length, 2);
  assert.deepEqual(gold[0], { type: 'gold', amount: 12, cat: 'rent', buildingId: 'b1', tenantId: 't1' });
  assert.equal(gold[1]!.amount, -5);
  for (let i = 0; i < 400; i++) economy.earn(s, 1, 'windfall');
  assert.ok(s.ledger.txns.length <= economy.TUNE.txnsKept);
});

test('the month closes, wages and upkeep are charged, the peak rent roll is tracked', () => {
  const s = realm(3, 'knight');
  const h = addBuilding(s, 'hovel'); addBuilding(s, 'cottage'); addBuilding(s, 'well');
  addBuilding(s, 'cottage', { state: 'building', progress: 0.2 });
  addStaff(s, 'mason', 2); addStaff(s, 'bailiff', 3);
  const t = settle(s, h); t.reliability = 0;       // keeps the books quiet: no rent arrives
  const before = s.gold;
  untilDay(s, 30);
  const wages = BAL.wageBySkill[2]! + BAL.wageBySkill[3]!;
  const upkeep = BUILDINGS.hovel.upkeep + BUILDINGS.cottage.upkeep + BUILDINGS.well.upkeep;   // the unfinished cottage costs nothing yet
  assert.equal(s.ledger.months.length, 2);
  assert.equal(s.ledger.months[0]!.index, 0);
  assert.equal(s.ledger.months[0]!.closing, before, 'month 0 closes on the coffers before the new charges');
  const m1 = s.ledger.months[1]!;
  assert.equal(m1.index, 1); assert.equal(m1.expense.wages, wages); assert.equal(m1.expense.upkeep, upkeep);
  assert.equal(s.gold, before - wages - upkeep);
  assert.equal(m1.rentDue, t.lease!.rent);
  assert.equal(s.stats.peakRentRoll, economy.rentRoll(s));
  assert.equal(economy.monthlyOutgoings(s), Math.round(wages + upkeep + RANKS.knight.tribute / 3));
});

test('market rent follows the formula; set_rent takes 1 to 5 times base and touches no lease', () => {
  const s = realm();
  const b = addBuilding(s, 'cottage', { condition: 100 });
  const base = BUILDINGS.cottage.baseRent;
  const des = 50;   // an empty all-grass realm: nothing nearby (real desirability may differ; recompute below)
  void des;
  const expected = (cond: number, d: number) => Math.max(1, Math.round(base * (0.6 + 0.8 * d / 100) * (0.7 + 0.3 * cond / 100)));
  // read the desirability back out of the result at full condition, then check the condition term against it
  const full = economy.marketRent(s, b);
  const d = ((full / base) - 0.6) / 0.8 * 100;
  assert.ok(d > 20 && d < 100, 'implausible desirability ' + d);
  b.condition = 0;
  assert.ok(Math.abs(economy.marketRent(s, b) - expected(0, d)) <= 1);
  assert.ok(economy.marketRent(s, b) < full);
  b.condition = 100;
  const t = settle(s, b);
  const sim = new Sim(s);
  assert.equal(sim.dispatch({ type: 'set_rent', buildingId: b.id, rent: base + 5 }).ok, true);
  assert.equal(b.rent, base + 5);
  assert.equal(t.lease!.rent, base, 'existing leases keep their rent');
  const tooHigh = sim.dispatch({ type: 'set_rent', buildingId: b.id, rent: base * 5 + 1 });
  assert.equal(tooHigh.ok, false);
  assert.equal(sim.dispatch({ type: 'set_rent', buildingId: b.id, rent: 0 }).ok, false);
  assert.equal(sim.dispatch({ type: 'set_rent', buildingId: b.id, rent: base * 5 }).ok, true);
  const well = addBuilding(s, 'well');
  assert.equal(sim.dispatch({ type: 'set_rent', buildingId: well.id, rent: 4 }).ok, false);
  assert.equal(sim.dispatch({ type: 'set_rent', buildingId: 'nope', rent: 4 }).ok, false);
  // a busier realm fetches a little more
  const quiet = economy.marketRent(s, b);
  for (let i = 0; i < 12; i++) settle(s, addBuilding(s, 'hovel'));
  assert.ok(economy.marketRent(s, b) >= quiet);
});

test('a gift costs gold, lifts the household, and is remembered; a feast lifts everyone once per half year', () => {
  const s = realm();
  const a = settle(s, addBuilding(s, 'hovel'), { happiness: 50 });
  const b = settle(s, addBuilding(s, 'hovel'), { happiness: 50 });
  const sim = new Sim(s);
  const g0 = s.gold, r0 = s.renown;
  const month = a.lease!.rent;                      // a month of their rent, whatever a hovel fetches these days
  assert.equal(sim.dispatch({ type: 'gift', tenantId: a.id, amount: month }).ok, true);
  assert.equal(s.gold, g0 - month);
  assert.equal(economy.currentBook(s).expense.gifts, month);
  assert.ok(a.happiness >= 60, 'a month of rent as a gift should lift a good deal, got ' + a.happiness);
  assert.equal(a.memory.at(-1)!.valence, 2);
  assert.ok(s.renown > r0);
  assert.equal(s.ledger.txns.at(-1)!.tenantId, a.id);
  const small0 = b.happiness;
  sim.dispatch({ type: 'gift', tenantId: b.id, amount: 1 });
  const smallLift = b.happiness - small0;
  assert.ok(smallLift >= 3 && smallLift < a.happiness - 50, 'happiness scales with the size of the gift');
  assert.equal(sim.dispatch({ type: 'gift', tenantId: a.id, amount: 99999 }).ok, false);
  assert.equal(sim.dispatch({ type: 'gift', tenantId: 'nobody', amount: 2 }).ok, false);

  const before = { a: a.happiness, b: b.happiness, gold: s.gold, renown: s.renown };
  events = [];
  assert.equal(sim.dispatch({ type: 'hold_feast' }).ok, true);
  drain(s);
  assert.equal(s.gold, before.gold - BAL.feastCost.reeve);
  assert.equal(a.happiness, Math.min(100, before.a + 8)); assert.equal(b.happiness, before.b + 8);
  assert.equal(s.renown, Math.min(100, before.renown + 3));
  assert.ok(eventsOf('sfx').some(e => e.id === 'cheer'));
  assert.ok(eventsOf('herald').length >= 1);
  const again = sim.dispatch({ type: 'hold_feast' });
  assert.equal(again.ok, false);
  if (!again.ok) assert.equal(again.code, 'busy');
  s.day += 181;
  assert.equal(sim.dispatch({ type: 'hold_feast' }).ok, true);
  s.gold = 3; s.day += 200;
  const poor = sim.dispatch({ type: 'hold_feast' });
  assert.equal(poor.ok, false);
  if (!poor.ok) assert.equal(poor.code, 'no_gold');
});

// ───────────── households ─────────────

const CLASHES: TraitId[][] = [['punctual', 'forgetful', 'deadbeat', 'ghost'], ['messy', 'tidy', 'hoarder'], ['stoic', 'complainer'], ['loyal', 'flighty']];

test('rolled households fit the rank, the building and the schema', () => {
  const s = realm(11, 'reeve');
  const hovel = addBuilding(s, 'hovel');
  const stall = addBuilding(s, 'market_stall');
  const burrow = addBuilding(s, 'burrow');
  const speciesSeen = new Set<string>();
  let halflingsInBurrow = 0, halflingsInHovel = 0;
  for (let i = 0; i < 300; i++) {
    const b = [hovel, stall, burrow][i % 3]!;
    const h = tenants.rollHousehold(s, { forBuilding: b.id });
    speciesSeen.add(h.species);
    assert.ok(['human', 'halfling'].includes(h.species), `a ${h.species} at Reeve rank`);
    assert.ok(h.name.length > 0 && h.first.length > 0 && h.name.includes(h.first));
    if (!h.character) assert.ok(h.traits.length >= 1 && h.traits.length <= 3, 'one to three quirks: ' + h.traits);
    assert.equal(new Set(h.traits).size, h.traits.length);
    for (const tr of h.traits) assert.ok(TRAITS.includes(tr));
    if (!h.character) {
      for (const g of CLASHES) assert.ok(h.traits.filter(tr => g.includes(tr)).length <= 1, 'clashing quirks: ' + h.traits);
      assert.deepEqual(h.revealed, [], 'quirks start hidden');
      assert.ok(h.household >= 1 && h.household <= Math.min(7, BUILDINGS[b.type].capacity));
      if (h.pets.length) assert.ok(h.traits.includes('pet_lover'));
    }
    assert.ok(h.reliability >= 0.2 && h.reliability <= 0.98);
    assert.ok(Number.isInteger(h.income) && h.income > 0);
    if (b === stall) assert.ok(BUILDINGS.market_stall.trades!.includes(h.trade), `a ${h.trade} leasing a market stall`);
    if (h.tags.includes('newlyweds') && !h.character) assert.equal(h.household, 2);
    if (b === burrow && h.species === 'halfling') halflingsInBurrow++;
    if (b === hovel && h.species === 'halfling') halflingsInHovel++;
  }
  assert.equal(speciesSeen.size, 2);
  assert.ok(halflingsInBurrow > halflingsInHovel, `burrows should draw halflings (${halflingsInBurrow} vs ${halflingsInHovel})`);

  // at Baron everyone may come; an explicit species or trade is honoured
  const s2 = realm(12, 'baron');
  const seen = new Set<string>();
  for (let i = 0; i < 400; i++) seen.add(tenants.rollHousehold(s2).species);
  assert.equal(seen.size, SPECIES.length, 'all six peoples at Baron: ' + [...seen]);
  const g = tenants.rollHousehold(s2, { species: 'goblin', trade: 'scribe' });
  if (!g.character) { assert.equal(g.species, 'goblin'); assert.equal(g.trade, 'scribe'); }
  // reliability is 0.78 plus the quirks
  assert.ok(Math.abs(tenants.reliabilityFor([]) - 0.78) < 1e-9);
  assert.ok(tenants.reliabilityFor(['deadbeat']) < 0.78);
  assert.ok(tenants.reliabilityFor(['punctual']) > 0.78);
});

test('income follows the trade; named characters appear about a third of the time and never twice', () => {
  const added: typeof CHARACTERS = [];
  if (CHARACTERS.length < 6) {
    for (let i = 0; i < 6; i++) {
      const c = {
        id: 'test_char_' + i, name: `Testy McTest ${i}`, first: 'Testy', species: 'human' as const, trade: 'farmer' as const, household: 2,
        traits: ['stoic' as const], tags: [], pets: [], minRank: 'reeve' as const, bio: '', voice: '',
        lines: { greet: 'Good day, {title}.', pay: 'Here.', late: 'Soon.', complain: 'Hm.', thanks: 'Ta.', leave: 'Bye.' }, look: {},
      };
      CHARACTERS.push(c); added.push(c);
    }
  }
  try {
    const s = realm(21, 'baron');
    const b = addBuilding(s, 'cottage');
    const ids: string[] = [];
    let n = 0;
    // those who could plausibly take a cottage at Baron: in the realm by now, no shop to keep, room enough, means enough
    const eligible = CHARACTERS.filter(c => ['reeve', 'knight', 'baron'].includes(c.minRank) && !TRADE_DEFS[c.trade]?.shop
      && c.household <= BUILDINGS.cottage.capacity && (TRADE_DEFS[c.trade]?.income ?? 30) * 0.6 >= b.rent
      && (!BUILDINGS.cottage.only || BUILDINGS.cottage.only.includes(c.species))).length;
    for (let i = 0; i < 60; i++) { n++; const h = tenants.rollHousehold(s, { forBuilding: b.id }); if (h.character) ids.push(h.character); }
    assert.equal(new Set(ids).size, ids.length, 'a named character was used twice');
    assert.ok(ids.length >= Math.min(eligible, 6), `expected named characters among ${n} rolls, got ${ids.length} of ${eligible} eligible`);
    if (eligible > 30) assert.ok(ids.length <= 35, 'about a third, not all of them: ' + ids.length);
    // once the cast is used up, nobody repeats
    for (let i = 0; i < 400; i++) { const h = tenants.rollHousehold(s, { forBuilding: b.id }); if (h.character) ids.push(h.character); }
    assert.equal(new Set(ids).size, ids.length, 'a named character was used twice');
    // asking for a used character by id falls back to a fresh household
    const again = tenants.rollHousehold(s, { character: ids[0]! });
    assert.notEqual(again.character, ids[0]);
    // incomes sit near the trade's
    const s2 = realm(22);
    for (const trade of ['laborer', 'merchant', 'wizard'] as const) {
      for (let i = 0; i < 20; i++) {
        const h = tenants.rollHousehold(s2, { trade, species: 'human' });
        if (h.character) continue;
        const base = TRADE_DEFS[trade].income;
        assert.ok(h.income >= base * 0.55 && h.income <= base * 1.7, `${trade} income ${h.income} vs ${base}`);
      }
    }
  } finally {
    for (const c of added) CHARACTERS.splice(CHARACTERS.indexOf(c), 1);
  }
});

test('a new reign starts with two households in two of the three hovels, the shabby one empty', () => {
  const s = realm(5);
  const a = addBuilding(s, 'hovel', { condition: 82 });
  const shabby = addBuilding(s, 'hovel', { condition: 35 });
  const c = addBuilding(s, 'hovel', { condition: 74 });
  addBuilding(s, 'seat');
  const gold = s.gold;
  tenants.tenantsModule.init!(s);
  const hs = tenants.housed(s);
  assert.equal(hs.length, 2);
  assert.equal(shabby.units[0]!.tenantId, null, 'the shabby hovel stays vacant');
  assert.ok(a.units[0]!.tenantId && c.units[0]!.tenantId);
  for (const t of hs) {
    assert.ok(t.lease && t.lease.rent === BUILDINGS.hovel.baseRent && t.lease.deposit === t.lease.rent * s.policies.depositMonths);
    assert.ok(t.lease.startDay < 0 && t.movedInDay < 0, 'they were here before you');
    assert.ok(['human', 'halfling'].includes(t.species));
    assert.equal(t.lateStage, 'none'); assert.equal(t.arrears, 0);
    assert.ok(t.memory.length === 1);
  }
  assert.equal(s.gold, gold, 'old sureties are already in the starting coffers');
  assert.equal(s.stats.tenantsHoused, 2);
  assert.equal(economy.suretiesHeld(s), 2 * BUILDINGS.hovel.baseRent);
  assertConsistent(s, 'init');
  // and with nothing built (a placeholder world) it simply does nothing
  const empty = realm(6);
  tenants.tenantsModule.init!(empty);
  assert.equal(tenants.housed(empty).length, 0);
});

// ───────────── Rent Day ─────────────

test('Rent Day at Reeve: purses appear over days 1 to 3, collecting them books the rent', () => {
  const s = realm(31);
  const homes = [addBuilding(s, 'hovel'), addBuilding(s, 'hovel'), addBuilding(s, 'cottage')];
  const ts = homes.map(b => settle(s, b));
  addBuilding(s, 'hovel');                         // one vacancy, unlisted so nobody wanders in
  for (const b of Object.values(s.buildings)) for (const u of b.units) if (!u.tenantId) u.listed = false;
  const total = ts.reduce((a, t) => a + t.lease!.rent, 0);
  untilDay(s, 29);
  assert.equal(homes.every(b => b.units[0]!.purse === 0), true);
  const gold = s.gold;
  events = [];
  untilDay(s, 30);
  assert.equal(economy.currentBook(s).rentDue, total, 'rent falls due on the 1st');
  untilDay(s, 32);                                 // the 3rd: everyone dependable has put a purse out
  for (let i = 0; i < 3; i++) {
    const u = homes[i]!.units[0]!;
    assert.equal(u.purse, ts[i]!.lease!.rent, `purse at ${homes[i]!.name}`);
    assert.ok(u.purseDay >= 30 && u.purseDay <= 32);
    assert.equal(ts[i]!.lateStage, 'none');
  }
  assert.equal(eventsOf('purse').length, 3);
  assert.equal(s.gold, gold - (BUILDINGS.hovel.upkeep * 3 + BUILDINGS.cottage.upkeep), 'nothing is in the coffers until someone fetches it');
  assert.equal(queued(s, 'collect').length, 0, 'no Bailiff: nobody is sent automatically');
  assert.equal(economy.currentBook(s).rentCollected, 0);

  // the Reeve walks the round (the job system finishing three collect jobs)
  events = [];
  const before = s.gold;
  for (const b of homes) doJob(s, 'collect', { buildingId: b.id, unit: 0, assignee: 'ruler-actor' });
  assert.equal(s.gold, before + total);
  assert.equal(economy.currentBook(s).income.rent, total);
  assert.equal(economy.currentBook(s).rentCollected, total);
  assert.equal(s.stats.rentCollected, total);
  assert.equal(homes.every(b => b.units[0]!.purse === 0), true);
  const collected = eventsOf('purse_collected');
  assert.equal(collected.length, 3);
  assert.equal(collected[0]!.byActor, 'ruler-actor');
  assert.equal(eventsOf('rent_paid').length, 3);
  assert.equal(s.ledger.txns.filter(x => x.cat === 'rent' && x.tenantId).length, 3);
  // collecting an empty step does nothing
  doJob(s, 'collect', { buildingId: homes[0]!.id, unit: 0 });
  assert.equal(s.gold, before + total);
  untilDay(s, 34);
  assert.ok(s.heralds.some(h => /Rent Day is done/.test(h.text) && /[Aa]ll 3/.test(h.text)), 'a summary herald: ' + s.heralds.map(h => h.text).join(' | '));
  assert.equal(bookNet(s), s.gold - BAL.startGold, 'books reconcile with the coffers');
  assertConsistent(s, 'rent day');
});

test('a purse left too long is spent: it becomes arrears without fault, and a fee on it stings', () => {
  const s = realm(32);
  const b = addBuilding(s, 'hovel');
  const t = settle(s, b);
  untilDay(s, 33);
  assert.equal(b.units[0]!.purse, t.lease!.rent);
  const put = b.units[0]!.purseDay;
  untilDay(s, put + BAL.purseDays - 1);
  assert.equal(b.units[0]!.purse, t.lease!.rent, 'still there the day before');
  untilDay(s, put + BAL.purseDays);
  assert.equal(b.units[0]!.purse, 0);
  assert.equal(t.arrears, t.lease!.rent);
  assert.equal(t.lateStage, 'none', 'not their fault: no late case is opened');
  assert.equal(t.memory.at(-1)!.valence, -1);
  assert.ok(s.heralds.some(h => /the purse at/i.test(h.text) && /owed again/.test(h.text)));
  assert.equal(economy.currentBook(s).income.rent, 0);
  // a fee charged on that debt costs extra goodwill
  const happy = t.happiness;
  rent.applyLateOption(s, t.id, 'late_fee');
  assert.ok(t.happiness <= happy - 8);
  assert.equal(t.arrears, t.lease!.rent + Math.max(1, Math.round(t.lease!.rent * s.policies.lateFeePct / 100)));
  // next Rent Day they pay the rent and put something toward the old debt, arrears first
  const owed = t.arrears;
  setAsideIncidents(s);
  t.lateStage = 'none'; t.happiness = 70; t.reliability = SURE;
  untilDay(s, 63);
  assert.ok(t.arrears < owed, 'arrears are paid down when they pay');
  assert.ok(b.units[0]!.purse > t.lease!.rent, 'the purse holds rent plus the catch-up');
  const fees0 = economy.currentBook(s).income.fees;
  doJob(s, 'collect', { buildingId: b.id, unit: 0 });
  assert.ok(economy.currentBook(s).income.fees > fees0, 'the fee part is booked as fees');
  assertConsistent(s, 'stale purse');
});

test('with a Bailiff the round is queued for you; with a Steward and a Counting House rent comes straight in', () => {
  const s = realm(33, 'knight');
  const b = addBuilding(s, 'cottage');
  const t = settle(s, b);
  addStaff(s, 'bailiff');
  untilDay(s, 33);
  assert.equal(b.units[0]!.purse, t.lease!.rent);
  const jobs = queued(s, 'collect');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]!.role, 'bailiff'); assert.equal(jobs[0]!.buildingId, b.id); assert.equal(jobs[0]!.unit, 0);
  const g = s.gold;
  assert.equal(finishJobs(s, ['collect']), 1);
  assert.equal(s.gold, g + t.lease!.rent);

  const s2 = realm(34, 'baron');
  const b2 = addBuilding(s2, 'cottage');
  const t2 = settle(s2, b2);
  addStaff(s2, 'steward');
  assert.equal(rent.paysDirect(s2), false, 'a Steward alone is not enough');
  addBuilding(s2, 'counting_house');
  assert.equal(rent.paysDirect(s2), true);
  events = [];
  untilDay(s2, 33);
  assert.equal(b2.units[0]!.purse, 0, 'no purse');
  assert.equal(eventsOf('purse').length, 0);
  assert.equal(eventsOf('rent_paid').length, 1);
  assert.equal(economy.currentBook(s2).income.rent, t2.lease!.rent);
});

test('paying on time depends on reliability, happiness, the rent against income, and the stocks', () => {
  const s = realm(35, 'knight');
  const b = addBuilding(s, 'cottage');
  const t = settle(s, b, { reliability: 0.78, happiness: 50, income: 80 });
  const base = rent.payChance(s, t);
  assert.ok(Math.abs(base - 0.78) < 0.02, 'base ' + base);
  t.happiness = 90; const happy = rent.payChance(s, t);
  t.happiness = 10; const sad = rent.payChance(s, t);
  assert.ok(happy > base && sad < base);
  t.happiness = 50; t.income = 20; const squeezed = rent.payChance(s, t);
  assert.ok(squeezed < base - 0.2, 'rent at most of their income hurts: ' + squeezed);
  t.income = 80;
  addBuilding(s, 'stocks', { x: b.x + 2, y: b.y });
  assert.ok(rent.payChance(s, t) > base, 'the stocks concentrate the mind');
  t.traits = ['ghost'];
  assert.equal(rent.payChance(s, t), 0, 'the ghost is never home on Rent Day');
  // over many households and months, most pay and the unreliable pay less
  const s2 = realm(36);
  const good: Tenant[] = [], bad: Tenant[] = [];
  for (let i = 0; i < 10; i++) good.push(settle(s2, addBuilding(s2, 'hovel'), { reliability: 0.9 }));
  for (let i = 0; i < 10; i++) bad.push(settle(s2, addBuilding(s2, 'hovel'), { reliability: 0.35 }));
  for (const bb of Object.values(s2.buildings)) for (const u of bb.units) u.listed = false;
  let gp = 0, bp = 0;
  for (let m = 1; m <= 6; m++) {
    untilDay(s2, m * 30 + 3);
    for (const g of good) if (s2.buildings[g.buildingId!]!.units[0]!.purse > 0) gp++;
    for (const d of bad) if (d.status === 'housed' && s2.buildings[d.buildingId!]!.units[0]!.purse > 0) bp++;
    for (const bb of Object.values(s2.buildings)) doJob(s2, 'collect', { buildingId: bb.id, unit: 0 });
    for (const tt of [...good, ...bad]) { if (tt.status === 'housed') rent.forgiveArrears(s2, tt.id); tt.happiness = 70; }
    setAsideIncidents(s2);
  }
  assert.ok(gp >= 48, `dependable households paid ${gp}/60`);
  assert.ok(bp < gp - 12, `unreliable households paid ${bp}/60 against ${gp}/60`);
});

// ───────────── the late pipeline ─────────────

test('a deadbeat is walked through grace, fee, notice, court, writ and eviction', () => {
  const s = realm(41);
  const b = addBuilding(s, 'hovel');
  const next = addBuilding(s, 'hovel', { x: b.x + 3, y: b.y });
  const neighbour = settle(s, next, { happiness: 70 });
  const t = settle(s, b, { reliability: 0, traits: ['deadbeat'], income: 20 });
  const R = t.lease!.rent, D = t.lease!.deposit;
  assert.equal(D, R);
  for (const u of [...b.units, ...next.units]) u.listed = false;

  untilDay(s, 30);
  assert.equal(t.lateStage, 'grace'); assert.equal(t.arrears, 0);
  untilDay(s, 32);
  assert.equal(t.lateStage, 'grace', 'inside the three grace days nothing is owed in arrears');
  events = [];
  untilDay(s, 33);
  assert.equal(t.lateStage, 'late'); assert.equal(t.arrears, R); assert.equal(b.units[0]!.purse, 0);
  assert.equal(eventsOf('rent_late').length, 1);
  assert.ok(s.heralds.some(h => h.tenantId === t.id), 'the ruler is told');
  setAsideIncidents(s);

  // the fee
  rent.applyLateOption(s, t.id, 'late_fee');
  const fee = Math.max(1, Math.round(R * s.policies.lateFeePct / 100));
  assert.equal(t.arrears, R + fee);
  assert.equal(t.lateStage, 'late');

  // waiting changes nothing but the date
  rent.applyLateOption(s, t.id, 'wait');
  untilDay(s, 38);
  assert.equal(t.arrears, R + fee); assert.ok(t.daysLate >= 5);
  setAsideIncidents(s);

  // the notice starts the court clock
  rent.applyLateOption(s, t.id, 'notice');
  assert.equal(t.lateStage, 'noticed');
  assert.equal(t.courtDay, 38 + BAL.courtDays);
  rent.applyLateOption(s, t.id, 'notice');
  assert.equal(t.courtDay, 38 + BAL.courtDays, 'a second notice does not restart the clock');
  untilDay(s, 38 + 7);
  assert.equal(t.lateStage, 'court');
  assert.ok(s.heralds.some(h => /Reeve's Court has accepted/.test(h.text)));
  untilDay(s, 38 + BAL.courtDays - 1);
  assert.equal(t.lateStage, 'court', 'the court is slow');
  assert.equal(t.status, 'housed');
  assert.equal(t.arrears, R + fee + R, 'the next month went unpaid too');
  events = [];
  untilDay(s, 38 + BAL.courtDays);
  assert.equal(t.lateStage, 'writ');
  assert.ok(s.heralds.some(h => /ruled against/.test(h.text)) || Object.values(s.incidents).some(i => i.tenantId === t.id), 'the writ is announced');
  setAsideIncidents(s);

  // the eviction: the Bailiff is queued, and it is done when the job is
  const renownBefore = s.renown, nHappy = neighbour.happiness;
  rent.applyLateOption(s, t.id, 'evict');
  const jobs = queued(s, 'evict');
  assert.equal(jobs.length, 1); assert.equal(jobs[0]!.role, 'bailiff'); assert.equal(jobs[0]!.tenantId, t.id);
  rent.applyLateOption(s, t.id, 'evict');
  assert.equal(queued(s, 'evict').length, 1, 'not queued twice');
  assert.equal(t.status, 'housed');
  events = [];
  finishJobs(s, ['evict']);
  assert.equal(t.status, 'evicted'); assert.equal(t.buildingId, null); assert.equal(t.leftDay, s.day);
  assert.equal(b.units[0]!.tenantId, null); assert.equal(b.units[0]!.vacantSince, s.day);
  assert.equal(s.stats.evictions, 1);
  assert.ok(s.renown < renownBefore, 'evictions cost renown');
  assert.ok(neighbour.happiness < nHappy, 'the neighbours noticed');
  const out = eventsOf('tenant_out');
  assert.equal(out.length, 1); assert.equal(out[0]!.reason, 'evicted'); assert.equal(out[0]!.buildingId, b.id);
  assert.equal(t.memory.at(-1)!.valence, -2);
  // the surety went against the debt; nothing is left to argue about, nothing is returned
  assert.equal(t.lease!.deposit, 0);
  assert.equal(t.arrears, R + fee + R - D);
  assert.equal(economy.currentBook(s).expense.deposits_returned, 0);
  assert.equal(queued(s, 'inspect').length, 0);
  assertConsistent(s, 'eviction');
  // sixty days on, the household is off the rolls
  untilDay(s, s.day + 61);
  assert.equal(s.tenants[t.id], undefined);
});

test('the gentler rulings: plan, forgive, mercy, coin for keys; and paying up closes the case', () => {
  const s = realm(42);
  const mk = (over: Partial<Tenant> = {}) => { const b = addBuilding(s, 'cottage'); b.units[0]!.listed = false; return settle(s, b, { reliability: 0, income: 80, ...over }); };
  const plan = mk(), forgiven = mk(), mercy = mk(), keys = mk(), cures = mk(), bystander = mk({ reliability: 0.9 });
  bystander.reliability = 0.9;
  untilDay(s, 33);
  setAsideIncidents(s);
  const R = plan.lease!.rent;
  for (const t of [plan, forgiven, mercy, keys, cures]) { assert.equal(t.lateStage, 'late'); assert.equal(t.arrears, R); }
  for (const b of Object.values(s.buildings)) doJob(s, 'collect', { buildingId: b.id, unit: 0 });

  // payment plan: arrears over three months, reliability up, and each Rent Day pays rent plus an instalment
  rent.applyLateOption(s, plan.id, 'payment_plan');
  assert.equal(plan.lateStage, 'plan');
  assert.deepEqual(plan.plan, { left: 3, each: Math.ceil(R / 3) });
  assert.ok(plan.reliability > 0);
  plan.reliability = SURE;
  untilDay(s, 63);
  setAsideIncidents(s);
  const home = s.buildings[plan.buildingId!]!;
  assert.equal(home.units[0]!.purse, R + Math.ceil(R / 3));
  assert.equal(plan.arrears, R - Math.ceil(R / 3));
  assert.equal(plan.plan!.left, 2);
  doJob(s, 'collect', { buildingId: home.id, unit: 0 });
  for (const d of [93, 123]) { untilDay(s, d); doJob(s, 'collect', { buildingId: home.id, unit: 0 }); setAsideIncidents(s); }
  assert.equal(plan.arrears, 0); assert.equal(plan.plan, null); assert.equal(plan.lateStage, 'none');
  assert.ok(s.heralds.some(h => /paid off the last of the arrears/.test(h.text)));

  // a missed instalment breaks a plan
  rent.applyLateOption(s, cures.id, 'payment_plan');
  cures.reliability = 0;
  untilDay(s, 153);
  setAsideIncidents(s);
  assert.equal(cures.lateStage, 'late'); assert.equal(cures.plan, null);
  assert.ok(cures.arrears > R);
  // ...and finding the money closes the case, even before the court
  rent.applyLateOption(s, cures.id, 'notice');
  assert.equal(cures.lateStage, 'noticed');
  cures.reliability = 1; cures.income = 400;
  rent.TUNE.noticeCure = 1;
  rent.applyLateOption(s, cures.id, 'mercy'); rent.applyLateOption(s, cures.id, 'notice');   // re-arm the urge with the new odds
  days(s, 2);
  rent.TUNE.noticeCure = 0.12;
  assert.equal(cures.arrears, 0); assert.equal(cures.lateStage, 'none'); assert.equal(cures.courtDay, null);
  assert.ok(s.heralds.some(h => /steps of the Reeve's Court/.test(h.text)));

  // forgive: cleared, and word gets round
  const rel = bystander.reliability;
  rent.applyLateOption(s, forgiven.id, 'forgive');
  assert.equal(forgiven.arrears, 0); assert.equal(forgiven.lateStage, 'none'); assert.equal(forgiven.daysLate, 0);
  assert.ok(bystander.reliability < rel && bystander.reliability > rel - 0.02, 'a little drift, realm-wide');

  // mercy: the case is torn up, the debt stays, on a plan
  rent.applyLateOption(s, mercy.id, 'notice');
  const owed = mercy.arrears;
  rent.applyLateOption(s, mercy.id, 'mercy');
  assert.equal(mercy.lateStage, 'plan'); assert.equal(mercy.courtDay, null);
  assert.equal(mercy.arrears, owed);
  assert.equal(mercy.plan!.left, 6);

  // coin for keys: paid, and gone today
  const g = s.gold, bribes = economy.currentBook(s).expense.bribes;
  const keysHome = s.buildings[keys.buildingId!]!;
  rent.applyLateOption(s, keys.id, 'cash_for_keys');
  assert.equal(keys.status, 'left'); assert.equal(keysHome.units[0]!.tenantId, null);
  assert.equal(economy.currentBook(s).expense.bribes - bribes, Math.max(6, Math.round(R * 1.5)));
  assert.ok(s.gold < g);
  assert.equal(s.stats.evictions, 0, 'coin for keys is not an eviction');
  // options on someone who has left do nothing
  rent.applyLateOption(s, keys.id, 'late_fee');
  rent.applyLateOption(s, 'nobody', 'notice');
  assertConsistent(s, 'gentle rulings');
});

test('the account and the pipeline: a bill mid-plan stretches the plan; a debt forgiven leaves a notice for cause up; a writ answered before the knock is not enforced', () => {
  const s = realm(57);
  const mk = (over: Partial<Tenant> = {}) => { const b = addBuilding(s, 'cottage'); b.units[0]!.listed = false; return settle(s, b, { reliability: 0, income: 80, ...over }); };
  const billed = mk(), answered = mk(), cause = mk({ reliability: SURE });
  untilDay(s, 33);
  setAsideIncidents(s);
  const R = billed.lease!.rent;
  assert.equal(billed.lateStage, 'late'); assert.equal(answered.lateStage, 'late'); assert.equal(cause.arrears, 0);
  for (const b of Object.values(s.buildings)) doJob(s, 'collect', { buildingId: b.id, unit: 0 });

  // a notice served for other cause is not about money: an incident that forgives a debt does not take it down
  rent.applyLateOption(s, cause.id, 'notice');
  assert.equal(cause.lateStage, 'noticed');
  rent.addArrears(s, cause.id, 5);
  rent.forgiveArrears(s, cause.id);
  assert.equal(cause.arrears, 0); assert.equal(cause.lateStage, 'noticed'); assert.ok(cause.courtDay !== null);
  rent.applyLateOption(s, cause.id, 'mercy');

  // a writ about money, answered while the Bailiff is on the road: nobody is put out, and no fresh notice goes up
  rent.applyLateOption(s, answered.id, 'notice');
  answered.lateStage = 'writ';
  rent.applyLateOption(s, answered.id, 'evict');
  assert.ok(Object.values(s.jobs).some(j => j.kind === 'evict' && j.tenantId === answered.id), 'the eviction is on its way');
  rent.forgiveArrears(s, answered.id);
  assert.equal(answered.lateStage, 'none');
  assert.equal(finishJobs(s, ['evict']), 1);
  assert.equal(answered.status, 'housed'); assert.equal(answered.lateStage, 'none'); assert.equal(answered.courtDay, null);
  assert.ok(s.heralds.some(h => /had lapsed/.test(h.text)));
  answered.reliability = SURE;

  // a repair billed to a household on a plan: the instalments agreed do not cover it, so the plan runs on until they do
  rent.applyLateOption(s, billed.id, 'payment_plan');
  const each = billed.plan!.each;
  billed.reliability = SURE;
  rent.addArrears(s, billed.id, R * 2);
  const home = s.buildings[billed.buildingId!]!;
  for (const d of [63, 93, 123]) { untilDay(s, d); doJob(s, 'collect', { buildingId: home.id, unit: 0 }); setAsideIncidents(s); }
  assert.ok(billed.arrears > 0, 'three instalments did not cover the bill as well');
  assert.equal(billed.lateStage, 'plan', 'the plan runs on rather than ending with the debt standing and nobody asking');
  assert.ok(billed.plan && billed.plan.each >= each && billed.plan.left * billed.plan.each >= billed.arrears);
  assert.ok(s.heralds.some(h => /the plan runs on/.test(h.text)));
  for (let d = 153; billed.arrears > 0 && d < 600; d += 30) { untilDay(s, d); doJob(s, 'collect', { buildingId: home.id, unit: 0 }); setAsideIncidents(s); }
  assert.equal(billed.arrears, 0); assert.equal(billed.plan, null); assert.equal(billed.lateStage, 'none');
  assertConsistent(s, 'account and pipeline');
});

test('jobs ordered by hand: serve_notice starts the clock; evict without a writ becomes a notice', () => {
  const s = realm(43);
  const b = addBuilding(s, 'hovel'); const t = settle(s, b, { reliability: 0 });
  const b2 = addBuilding(s, 'hovel'); const paid = settle(s, b2);
  untilDay(s, 34);
  setAsideIncidents(s);
  doJob(s, 'serve_notice', { tenantId: t.id, buildingId: b.id });
  assert.equal(t.lateStage, 'noticed'); assert.ok(t.courtDay !== null);
  assert.equal(t.memory.at(-1)!.valence, -2);
  // the Bailiff sent to evict someone the court has not ruled on does not evict them
  doJob(s, 'evict', { tenantId: t.id, buildingId: b.id });
  assert.equal(t.status, 'housed');
  doJob(s, 'evict', { tenantId: paid.id, buildingId: b2.id });
  assert.equal(paid.status, 'housed'); assert.equal(paid.lateStage, 'noticed', 'no writ: a notice goes up instead');
  assert.equal(s.stats.evictions, 0);
  // with the writ in hand, the same job puts them out
  t.lateStage = 'writ';
  doJob(s, 'evict', { tenantId: t.id, buildingId: b.id });
  assert.equal(t.status, 'evicted'); assert.equal(s.stats.evictions, 1);
  // rent.evict is unconditional (an incident's doing)
  rent.evict(s, paid.id);
  assert.equal(paid.status, 'evicted'); assert.equal(s.stats.evictions, 2);
  rent.evict(s, paid.id);
  assert.equal(s.stats.evictions, 2, 'not twice');
});

// ───────────── sureties ─────────────

test('deposit maths: taken at signing, inspected at move-out, kept or returned to the crown', () => {
  const run = (keepPct: number, wear: number, arrears = 0) => {
    const s = realm(51);
    const b = addBuilding(s, 'cottage', { condition: 90 });
    const g0 = s.gold;
    const t = settle(s, b);
    const D = t.lease!.deposit;
    assert.equal(D, BUILDINGS.cottage.baseRent * s.policies.depositMonths);
    assert.equal(s.gold, g0 + D, 'the surety goes into the coffers at signing');
    assert.equal(economy.currentBook(s).income.deposits_kept, D);
    t.wear = wear; t.arrears = arrears;
    tenants.moveOut(s, t.id, 'lease_end');
    drain(s);
    return { s, b, t, D, g: s.gold };
  };
  const perPoint = Math.max(0.15, BUILDINGS.cottage.cost / 250);
  const cost = (wear: number) => Math.round(Math.max(0, wear - 4) * perPoint);

  // fair: keep exactly the damage
  {
    const { s, b, t, D, g } = run(-1, 24);
    assert.equal(t.status, 'left'); assert.equal(b.units[0]!.tenantId, null);
    const jobs = queued(s, 'inspect');
    assert.equal(jobs.length, 1, 'an inspection is queued'); assert.equal(jobs[0]!.buildingId, b.id); assert.equal(jobs[0]!.tenantId, t.id);
    assert.equal(b.condition, 90, 'damage shows once someone has looked');
    finishJobs(s, ['inspect']);
    assert.equal(b.condition, 90 - 24, 'their wear is applied to the building');
    setAsideIncidents(s);
    const damage = cost(24);
    assert.ok(damage > 0 && damage < D, `damage ${damage} of surety ${D}`);
    rent.applyDeposit(s, t.id, -1);
    assert.equal(s.gold, g - (D - damage));
    assert.equal(economy.currentBook(s).expense.deposits_returned, D - damage);
    assert.equal(t.lease!.deposit, 0);
    assert.equal(bookNet(s), s.gold - BAL.startGold, 'books reconcile');
    rent.applyDeposit(s, t.id, -1);
    assert.equal(s.gold, g - (D - damage), 'settled once only');
  }
  // return it all
  {
    const { s, t, D, g } = run(0, 24);
    finishJobs(s, ['inspect']); setAsideIncidents(s);
    const r0 = s.renown;
    rent.applyDeposit(s, t.id, 0);
    assert.equal(s.gold, g - D);
    assert.equal(economy.currentBook(s).expense.deposits_returned, D);
    assert.ok(s.renown >= r0, 'generosity is not punished');
  }
  // keep the lot over honest wear: nothing goes back, and it is remembered
  {
    const { s, t, g } = run(100, 3);
    finishJobs(s, ['inspect']); setAsideIncidents(s);
    const r0 = s.renown;
    rent.applyDeposit(s, t.id, 100);
    assert.equal(s.gold, g);
    assert.equal(economy.currentBook(s).expense.deposits_returned, 0);
    assert.ok(s.renown < r0);
    assert.equal(t.memory.at(-1)!.valence, -2);
  }
  // half
  {
    const { s, t, D, g } = run(50, 10);
    finishJobs(s, ['inspect']); setAsideIncidents(s);
    rent.applyDeposit(s, t.id, 50);
    assert.equal(s.gold, g - (D - Math.round(D / 2)));
  }
  // damage beyond the surety: fair keeps all of it and no more
  {
    const { s, t, g } = run(-1, 60);
    finishJobs(s, ['inspect']); setAsideIncidents(s);
    rent.applyDeposit(s, t.id, -1);
    assert.equal(s.gold, g);
  }
  // what they owed comes out first
  {
    const { s, t, D } = run(-1, 0, 5);
    assert.equal(t.lease!.deposit, D - 5); assert.equal(t.arrears, 0);
    finishJobs(s, ['inspect']); setAsideIncidents(s);
    const g = s.gold;
    rent.applyDeposit(s, t.id, -1);
    assert.equal(s.gold, g - (D - 5));
  }
  // nobody rules and nobody inspects: the clerk settles it fairly in the end
  {
    const { s, t, D, g } = run(-1, 24);
    for (let i = 0; i < 30; i++) { days(s, 1); setAsideIncidents(s); }
    assert.equal(t.lease!.deposit, 0);
    assert.equal(s.gold, g - (D - cost(24)) - BUILDINGS.cottage.upkeep);
  }
  // an incident may settle the surety with the household still inside (the purple tower): they leave now
  {
    const s = realm(52);
    const b = addBuilding(s, 'cottage');
    const t = settle(s, b); const D = t.lease!.deposit; const g = s.gold;
    events = [];
    rent.applyDeposit(s, t.id, 50);
    drain(s);
    assert.equal(t.status, 'left'); assert.equal(eventsOf('tenant_out').length, 1);
    assert.equal(s.gold, g - (D - Math.round(D / 2)));
    assert.equal(queued(s, 'inspect').length, 0);
    assertConsistent(s, 'deposit in place');
  }
});

// ───────────── applicants ─────────────

test('an applicant arrives, is shown the place, and is accepted', () => {
  const s = realm(61);
  const b = addBuilding(s, 'cottage');
  events = [];
  const a = tenants.spawnApplicant(s, b.id, 0);
  drain(s);
  assert.ok(a, 'spawnApplicant returned nothing');
  assert.equal(Object.keys(s.applicants).length, 1);
  assert.equal(a.shown, false); assert.equal(a.buildingId, b.id);
  assert.equal(a.leavesDay, s.day + BAL.applicantWaitDays);
  assert.ok(a.maxRent >= b.rent, 'they read the board before coming');
  assert.equal(eventsOf('applicant').length, 1);
  assert.ok(s.heralds.some(h => h.text.includes(a.household.name)));
  assert.ok(a.actorId && s.actors[a.actorId], 'their figure is on the table');
  assert.equal(s.actors[a.actorId]!.kind, 'applicant'); assert.equal(s.actors[a.actorId]!.refId, a.id);
  assert.equal(tenants.spawnApplicant(s, b.id, 0), null, 'one applicant per unit at a time');
  assert.equal(queued(s, 'show').length, 0, 'no Crier: the ruler must be sent');
  days(s, 2);
  assert.ok(s.applicants[a.id], 'they wait');

  // the showing
  doJob(s, 'show', { applicantId: a.id, buildingId: b.id, unit: 0 });
  assert.equal(a.shown, true);
  assert.ok(a.leavesDay >= s.day + 8, 'they wait for an answer');
  setAsideIncidents(s);

  // the welcome
  const g = s.gold, housedBefore = s.stats.tenantsHoused;
  events = [];
  rent.applyLease(s, a.id, true);
  drain(s);
  const t = s.tenants[a.household.id]!;
  assert.ok(t, 'the household is on the rolls');
  assert.equal(t.status, 'housed'); assert.equal(t.buildingId, b.id); assert.equal(t.unit, 0);
  assert.equal(t.lease!.rent, b.rent); assert.equal(t.lease!.termMonths, BAL.leaseTermMonths); assert.equal(t.lease!.startDay, s.day);
  assert.equal(t.lease!.deposit, b.rent * s.policies.depositMonths);
  assert.equal(s.gold, g + t.lease!.deposit);
  assert.equal(b.units[0]!.tenantId, t.id); assert.equal(b.units[0]!.vacantSince, null); assert.equal(b.units[0]!.listed, false);
  assert.equal(s.applicants[a.id], undefined);
  assert.equal(s.actors[a.actorId!], undefined, 'the figure has gone indoors');
  assert.equal(s.stats.tenantsHoused, housedBefore + 1);
  assert.equal(eventsOf('tenant_in').length, 1);
  assert.deepEqual(eventsOf('applicant_gone')[0], { type: 'applicant_gone', applicantId: a.id, signed: true });
  assert.ok(t.happiness >= 50 && t.happiness <= 80);
  assertConsistent(s, 'accept');
});

test('an applicant is rejected, haggled out of the door, or left waiting', () => {
  const s = realm(62);
  const b = addBuilding(s, 'cottage');
  for (const u of b.units) u.listed = false;      // only the applicants this test sends for
  // rejected
  const a = tenants.spawnApplicant(s, b.id, 0)!;
  doJob(s, 'show', { applicantId: a.id, buildingId: b.id, unit: 0 }); setAsideIncidents(s);
  const g = s.gold;
  events = [];
  rent.applyLease(s, a.id, false);
  drain(s);
  assert.equal(s.applicants[a.id], undefined); assert.equal(b.units[0]!.tenantId, null);
  assert.equal(s.gold, g); assert.equal(tenants.housed(s).length, 0);
  assert.deepEqual(eventsOf('applicant_gone')[0], { type: 'applicant_gone', applicantId: a.id, signed: false });
  days(s, 12);
  assert.equal(Object.values(s.actors).filter(x => x.kind === 'applicant' && x.refId === a.id).length, 0, 'their figure has left by the gate');

  // a counter above what they will pay: they walk
  const c = tenants.spawnApplicant(s, b.id, 0)!;
  c.maxRent = b.rent;      // will pay the board price and not a crown more
  doJob(s, 'show', { applicantId: c.id, buildingId: b.id, unit: 0 }); setAsideIncidents(s);
  rent.applyLease(s, c.id, true, 110);
  assert.equal(s.applicants[c.id], undefined); assert.equal(tenants.housed(s).length, 0);
  assert.ok(s.heralds.some(h => /more than they would pay/.test(h.text)));
  // a counter within their means is signed at the higher rent
  const d = tenants.spawnApplicant(s, b.id, 0)!;
  d.maxRent = b.rent * 2;
  rent.applyLease(s, d.id, true, 110);
  assert.equal(tenants.housed(s).length, 1);
  assert.equal(tenants.housed(s)[0]!.lease!.rent, Math.round(b.rent * 1.1));

  // left waiting: they give up after BAL.applicantWaitDays, and a long wait costs a little renown
  const b2 = addBuilding(s, 'hovel'); b2.units[0]!.listed = false;
  const w = tenants.spawnApplicant(s, b2.id, 0)!;
  const r0 = s.renown;
  days(s, BAL.applicantWaitDays - 1);
  assert.ok(s.applicants[w.id]);
  days(s, 2);
  assert.equal(s.applicants[w.id], undefined);
  assert.ok(s.renown < r0);
  assert.ok(s.heralds.some(h => /Nobody did/.test(h.text)));
  // bad input is ignored
  rent.applyLease(s, 'nobody', true);
  assert.equal(tenants.spawnApplicant(s, 'nowhere', 0), null);
  assert.equal(tenants.spawnApplicant(s, b.id, 0), null, 'an occupied unit takes no applicant');
  assertConsistent(s, 'reject');
});

test('screening reveals hidden quirks; a Crier is sent to show; policy can screen everyone', () => {
  const s = realm(63, 'knight');
  const b = addBuilding(s, 'cottage');
  addStaff(s, 'crier', 3);
  const a = tenants.spawnApplicant(s, b.id, 0)!;
  const jobs = queued(s, 'show');
  assert.equal(jobs.length, 1); assert.equal(jobs[0]!.role, 'crier'); assert.equal(jobs[0]!.applicantId, a.id);
  a.household.traits = ['deadbeat', 'messy']; a.household.revealed = [];
  finishJobs(s, ['show']); setAsideIncidents(s);
  assert.equal(a.shown, true); assert.equal(a.screened, false);
  rent.screen(s, a.id);
  assert.equal(a.screened, true);
  assert.deepEqual(a.household.revealed, ['deadbeat', 'messy']);
  assert.ok(s.heralds.some(h => /Asked after/.test(h.text)));
  rent.applyLease(s, a.id, true);
  const t = s.tenants[a.household.id]!;
  assert.deepEqual(t.revealed, ['deadbeat', 'messy'], 'what was learned stays learned');

  // policy: always ask their last landlord (a small fee each time)
  s.policies.screening = 'always';
  const b2 = addBuilding(s, 'cottage');
  const a2 = tenants.spawnApplicant(s, b2.id, 0)!;
  const other0 = economy.currentBook(s).expense.other;
  finishJobs(s, ['show']);
  assert.equal(a2.screened, true);
  assert.deepEqual([...a2.household.revealed].sort(), [...a2.household.traits].sort());
  assert.ok(economy.currentBook(s).expense.other > other0);
  // a housed household can be looked into as well; the reveal_trait and remember actions work
  const sim = new Sim(s);
  const t3 = settle(s, addBuilding(s, 'hovel'), { traits: ['gossip', 'handy'], revealed: [] });
  assert.equal(sim.dispatch({ type: 'reveal_trait', tenantId: t3.id, trait: 'gossip' }).ok, true);
  assert.deepEqual(t3.revealed, ['gossip']);
  assert.equal(sim.dispatch({ type: 'reveal_trait', tenantId: t3.id, trait: 'saint' }).ok, false);
  rent.screen(s, t3.id);
  assert.deepEqual(t3.revealed, ['gossip', 'handy']);
  assert.equal(sim.dispatch({ type: 'remember', tenantId: t3.id, text: 'You promised a new door — and delivered.', valence: 2 }).ok, true);
  assert.equal(t3.memory.at(-1)!.text, 'You promised a new door, and delivered.');
  assert.equal(sim.dispatch({ type: 'remember', tenantId: 'nobody', text: 'x', valence: 1 }).ok, false);
});

test('listed vacancies draw applicants: more with renown, a bargain, a Crier, a notice board; fewer when dear', () => {
  const s = realm(64, 'knight');
  const b = addBuilding(s, 'cottage');
  const market = economy.marketRent(s, b);
  b.rent = market;
  const base = tenants.applicantChance(s, b, 0);
  assert.ok(Math.abs(base - BAL.applicantRate / 30) < 0.01, 'about BAL.applicantRate a month at renown 50 and fair rent: ' + base * 30);
  s.renown = 90; const famous = tenants.applicantChance(s, b, 0);
  s.renown = 10; const infamous = tenants.applicantChance(s, b, 0);
  s.renown = 50;
  assert.ok(famous > base && infamous < base);
  b.rent = Math.round(market * 1.4); const dear = tenants.applicantChance(s, b, 0);
  b.rent = Math.max(1, Math.round(market * 0.7)); const cheap = tenants.applicantChance(s, b, 0);
  b.rent = market;
  assert.ok(dear < base * 0.3, 'over market: far fewer'); assert.ok(cheap > base * 1.3, 'a bargain: more');
  addBuilding(s, 'notice_board'); const board = tenants.applicantChance(s, b, 0);
  assert.ok(board > base);
  const lowSkill = addStaff(s, 'crier', 1); const crier1 = tenants.applicantChance(s, b, 0);
  lowSkill.skill = 5; const crier5 = tenants.applicantChance(s, b, 0);
  assert.ok(crier1 > board && crier5 > crier1, 'a Crier helps, a good one more');
  b.units[0]!.listed = false;
  assert.equal(tenants.applicantChance(s, b, 0), 0, 'unlisted: nobody comes');
  b.units[0]!.listed = true; b.squatters = { kind: 'goblins', sinceDay: 0 };
  assert.equal(tenants.applicantChance(s, b, 0), 0, 'nobody applies to live with goblins');

  // and in practice: a fairly priced listed cottage sees someone within a few months
  // (squatters are held off here: a place the goblins reach first draws nobody, which is another test's business)
  const s2 = realm(65);
  const c = addBuilding(s2, 'cottage'); c.rent = economy.marketRent(s2, c);
  const goblins = rent.TUNE.squatterChanceListed; rent.TUNE.squatterChanceListed = 0;
  try {
    let seen = 0;
    for (let i = 0; i < 240 && !seen; i++) { days(s2, 1); seen = Object.keys(s2.applicants).length; }
    assert.equal(seen, 1, 'no applicant in 240 days');
    days(s2, 3);
    assert.equal(Object.keys(s2.applicants).length, 1, 'only one at a time per unit');
  } finally { rent.TUNE.squatterChanceListed = goblins; }
});

// ───────────── mood, leases, renown ─────────────

test('mood drifts toward its causes; two months below 25 and they go; a visit helps', () => {
  const s = realm(71);
  const good = addBuilding(s, 'cottage', { condition: 100 });
  const bad = addBuilding(s, 'hovel', { condition: 12 });
  const happy = settle(s, good, { happiness: 50 }, Math.max(1, economy.marketRent(s, good) - 4));
  const sad = settle(s, bad, { happiness: 50, traits: ['complainer'] }, economy.marketRent(s, bad) * 3);
  for (const b of [good, bad]) b.units[0]!.listed = false;
  const up = tenants.happinessBreakdown(s, happy), down = tenants.happinessBreakdown(s, sad);
  assert.ok(up.target > 60 && down.target < 30, `targets ${up.target} / ${down.target}`);
  assert.ok(down.parts.length >= 2 && down.parts.every(p => p.label.length > 0));
  untilDay(s, 30);
  const first = sad.happiness;
  assert.ok(Math.abs(first - (50 + (down.target - 50) / 3)) < 4, 'a third of the way each month: ' + first);
  assert.ok(happy.happiness > 50);
  assert.ok(sad.wear > 0, 'living somewhere wears it');
  // the visit
  const before = sad.happiness;
  doJob(s, 'visit', { tenantId: sad.id, buildingId: bad.id });
  assert.equal(sad.happiness, before + 6);
  assert.equal(sad.memory.at(-1)!.valence, 1);
  doJob(s, 'visit', { tenantId: sad.id, buildingId: bad.id });
  assert.equal(sad.happiness, before + 8, 'a second call so soon is worth less');
  // left to it, they go
  sad.memory = [];
  events = [];
  for (let m = 2; m <= 8 && sad.status === 'housed'; m++) { untilDay(s, m * 30); setAsideIncidents(s); rent.forgiveArrears(s, sad.id); }
  assert.equal(sad.status, 'left', 'still here at happiness ' + sad.happiness);
  assert.equal(eventsOf('tenant_out')[0]!.reason, 'unhappy');
  assert.ok(s.heralds.some(h => /general atmosphere/.test(h.text)));
  assert.equal(happy.status, 'housed');
  assertConsistent(s, 'mood');
});

test('leases: renewal is asked at term end, the Crown caps rises, and a rise too far loses the household', () => {
  const s = realm(72);
  const b = addBuilding(s, 'cottage');
  b.units[0]!.listed = false;
  const t = settle(s, b, { happiness: 70 });
  const R = t.lease!.rent;
  assert.equal(tenants.leaseEndDay(t), 360);
  // mid-lease: a rise is clamped to the cap, and a second one the same year is refused
  rent.changeLeaseRent(s, t.id, 25);
  assert.equal(t.lease!.rent, Math.round(R * 1.1), 'renewalCapPct clamps the rise');
  assert.ok(t.happiness < 70);
  rent.changeLeaseRent(s, t.id, 10);
  assert.equal(t.lease!.rent, Math.round(R * 1.1), 'the cap is yearly');
  rent.changeLeaseRent(s, t.id, -50);
  assert.equal(t.lease!.rent, Math.round(Math.round(R * 1.1) * 0.5), 'cuts are not capped');
  rent.changeLeaseRent(s, t.id, 0);
  assert.equal(t.lease!.startDay, 0, 'no renewal before the term is up');
  t.lease!.rent = R; t.happiness = 70;
  // term end
  for (let m = 1; m <= 12; m++) { untilDay(s, m * 30 + 3); doJob(s, 'collect', { buildingId: b.id, unit: 0 }); setAsideIncidents(s); t.happiness = 70; }
  assert.equal(t.status, 'housed');
  assert.ok(tenants.auxOf(t).renewDay >= 360, 'renewal was asked at term end');
  // the ruling comes back as a rent effect: +10 at renewal renews the term and resets the cap
  rent.changeLeaseRent(s, t.id, 10);
  assert.equal(t.lease!.rent, Math.round(R * 1.1));
  assert.equal(t.lease!.startDay, s.day, 'a new term');
  assert.equal(tenants.auxOf(t).renewDay, -1);
  // nobody rules at all: the lease carries on by itself
  const s2 = realm(73);
  const b2 = addBuilding(s2, 'cottage'); b2.units[0]!.listed = false;
  const t2 = settle(s2, b2);
  for (let m = 1; m <= 13; m++) { untilDay(s2, m * 30 + 3); doJob(s2, 'collect', { buildingId: b2.id, unit: 0 }); setAsideIncidents(s2); t2.happiness = 70; }
  assert.equal(t2.status, 'housed'); assert.ok(t2.lease!.startDay >= 360, 'carried on: ' + t2.lease!.startDay);
  // unhappy at term end: they do not renew
  const s3 = realm(74);
  const b3 = addBuilding(s3, 'cottage'); b3.units[0]!.listed = false;
  const t3 = settle(s3, b3);
  t3.lease!.startDay = -359; t3.happiness = 26;
  days(s3, 2);
  assert.equal(t3.status, 'left');
  // a rise far past what the place is worth, on a household already cool on you: they leave
  const s4 = realm(75);
  const b4 = addBuilding(s4, 'hovel'); const t4 = settle(s4, b4, { happiness: 30, income: 14 }, 20);
  s4.policies.renewalCapPct = 50;
  events = [];
  rent.changeLeaseRent(s4, t4.id, 40);
  drain(s4);
  assert.equal(t4.status, 'left'); assert.equal(eventsOf('tenant_out')[0]!.reason, 'rent_too_high');
  // the loyal put up with more before they pack, the flighty with less
  const s5 = realm(76); s5.policies.renewalCapPct = 50;
  const plain = settle(s5, addBuilding(s5, 'hovel'), { happiness: 52, income: 14 }, 20);
  const loyal = settle(s5, addBuilding(s5, 'hovel'), { happiness: 52, income: 14, traits: ['loyal'] }, 20);
  const flighty = settle(s5, addBuilding(s5, 'hovel'), { happiness: 62, income: 14, traits: ['flighty'] }, 20);
  for (const h of [plain, loyal, flighty]) rent.changeLeaseRent(s5, h.id, 40);
  assert.equal(plain.status, 'left');
  if (tenants.traitTotal(['loyal'], 'stay') >= 1.2) assert.equal(loyal.status, 'housed', 'the loyal household stayed where a plain one went');
  if (tenants.traitTotal(['flighty'], 'stay') <= 0.85) assert.equal(flighty.status, 'left', 'the flighty one went though it was happier');
});

test('a Steward prices vacancies to the policy, and leaves alone a figure the ruler set by hand', () => {
  const s = realm(48, 'baron');
  const a = addBuilding(s, 'cottage'), b = addBuilding(s, 'cottage');
  for (const x of [a, b]) { x.units[0]!.listed = false; x.rent = 3; }
  untilDay(s, 30);
  assert.equal(a.rent, 3, 'no Steward: nobody touches the board');
  addStaff(s, 'steward'); s.policies.askPct = 120;
  const sim = new Sim(s);
  assert.equal(sim.dispatch({ type: 'set_rent', buildingId: b.id, rent: 5 }).ok, true);
  untilDay(s, 60);
  assert.equal(a.rent, Math.round(economy.marketRent(s, a) * 1.2), 'priced at askPct of market');
  assert.equal(b.rent, 5, 'the ruler\'s own number stands');
  // ...until the place is let. The next vacancy is the Steward's to price again.
  const t = settle(s, b, {}, 5);
  tenants.moveOut(s, t.id, 'lease_end');
  b.units[0]!.listed = false;
  untilDay(s, 90);
  assert.equal(b.rent, Math.round(economy.marketRent(s, b) * 1.2));
});

test('the household that is never in on Rent Day turns up with it a day or two later, mostly', () => {
  const s = realm(49);
  const ghosts: Tenant[] = [];
  for (let i = 0; i < 40; i++) { const b = addBuilding(s, 'hovel'); b.units[0]!.listed = false; ghosts.push(settle(s, b, { traits: ['ghost'] })); }
  untilDay(s, 30);
  assert.equal(ghosts.filter(g => s.buildings[g.buildingId!]!.units[0]!.purse > 0).length, 0, 'nobody answers the door on the 1st');
  untilDay(s, 33);
  const paid = ghosts.filter(g => s.buildings[g.buildingId!]!.units[0]!.purse > 0).length;
  assert.ok(paid >= 24 && paid < 40, `most, not all, had paid by the end of grace: ${paid}/40`);
  assert.equal(ghosts.filter(g => g.lateStage === 'late').length, 40 - paid);
});

test('renown and favor clamp and announce; renown drifts toward a blend of 50 and the mood', () => {
  const s = realm(81);
  events = [];
  renown.changeRenown(s, 5, 'test'); renown.changeFavor(s, -7, 'test'); renown.changeRenown(s, 0); renown.changeRenown(s, NaN);
  drain(s);
  assert.equal(s.renown, 55); assert.equal(s.favor, 43);
  assert.deepEqual(eventsOf('renown'), [{ type: 'renown', amount: 5, reason: 'test' }]);
  assert.deepEqual(eventsOf('favor'), [{ type: 'favor', amount: -7, reason: 'test' }]);
  renown.changeRenown(s, 500); renown.changeFavor(s, -500);
  assert.equal(s.renown, 100); assert.equal(s.favor, 0);
  drain(s); events = []; renown.changeRenown(s, 3); drain(s);
  assert.equal(eventsOf('renown').length, 0, 'nothing to announce at the ceiling');
  // drift
  const mk = (h: number, start: number) => {
    const r = realm(82);
    for (let i = 0; i < 4; i++) { const b = addBuilding(r, 'hovel'); settle(r, b, { happiness: h }); }
    r.renown = start;
    return r;
  };
  const glad = mk(90, 50); assert.equal(renown.renownTarget(glad), 70);
  renown.renownModule.onMonth!(glad, 1);
  assert.ok(glad.renown > 50 && glad.renown <= 50 + BAL.renownDrift * 3 + 1e-9, 'a slow pull up: ' + glad.renown);
  const sour = mk(10, 50); renown.renownModule.onMonth!(sour, 1);
  assert.ok(sour.renown < 50);
  const empty = realm(83); empty.renown = 80; renown.renownModule.onMonth!(empty, 1);
  assert.ok(empty.renown < 80 && empty.renown >= 80 - BAL.renownDrift * 3 - 1e-9, 'with nobody housed it settles toward 50, slowly: ' + empty.renown);
});

test('a long-empty unit draws squatters; a fresh or newly shown one does not', () => {
  const s = realm(91);
  const b = addBuilding(s, 'hovel'); b.units[0]!.listed = false; b.units[0]!.vacantSince = 0;
  rent.TUNE.squatterChanceUnlisted = 1;
  try {
    untilDay(s, 39);
    assert.equal(Object.values(s.incidents).length, 0);
    assert.equal(b.squatters, null);
    untilDay(s, 45);     // past forty days the check runs daily; with the real engine an incident opens and goblins move in
    const engine = Object.values(s.incidents).length > 0;
    if (engine) assert.ok(b.squatters, 'the engine opened a squatter incident, so somebody must be in the house');
    else assert.equal(b.squatters, null, 'no incident engine: nothing happens, and nothing throws');
    if (engine) {
      // nobody deals with them: the matter is put to the ruler again a month on, and again after that
      const rulings = () => Object.values(s.incidents).filter(i => i.buildingId === b.id && INCIDENT_BY_ID[i.defId]?.decision === 'squatters').length;
      assert.equal(rulings(), 1);
      setAsideIncidents(s);
      days(s, 10);
      assert.equal(rulings(), 1, 'not asked again inside the month');
      days(s, 25); setAsideIncidents(s);
      assert.equal(rulings(), 2, 'asked again after a month');
      assert.ok(b.squatters, 'and they are still in there');
      assert.equal(tenants.applicantChance(s, b, 0), 0);
    }
  } finally { rent.TUNE.squatterChanceUnlisted = 0.04; }

  // a listed vacancy that somebody was lately shown round has too many eyes on it
  const s2 = realm(92);
  const c = addBuilding(s2, 'hovel'); c.units[0]!.vacantSince = 0; c.units[0]!.listed = false;
  const listed = rent.TUNE.squatterChanceListed; rent.TUNE.squatterChanceListed = 1;
  try {
    untilDay(s2, 39);
    c.units[0]!.listed = true;
    const a = tenants.spawnApplicant(s2, c.id, 0)!;
    doJob(s2, 'show', { applicantId: a.id, buildingId: c.id, unit: 0 }); setAsideIncidents(s2);
    rent.applyLease(s2, a.id, false);
    for (let i = 0; i < 18; i++) { days(s2, 1); assert.equal(c.squatters, null, `squatters on day ${s2.day}, ${s2.day - 39} days after a showing`); }
    assert.equal(Object.values(s2.incidents).filter(i => INCIDENT_BY_ID[i.defId]?.decision === 'squatters').length, 0);
  } finally { rent.TUNE.squatterChanceListed = listed; }
});

test('a notice served for other cause runs its course; one about money ends when the money is found', () => {
  const s = realm(44);
  const b = addBuilding(s, 'cottage'); b.units[0]!.listed = false;
  const t = settle(s, b);                       // paid up, dependable, and about to be served anyway
  rent.applyLateOption(s, t.id, 'notice');
  assert.equal(t.lateStage, 'noticed'); assert.equal(tenants.auxOf(t).cause, 0);
  days(s, 3);
  assert.equal(t.lateStage, 'noticed', 'owing nothing does not make the notice go away');
  // they pay the rent when it falls due, and the notice still stands
  t.happiness = 100;
  for (let i = 0; i < 40 && s.day < 33; i++) { days(s, 1); doJob(s, 'collect', { buildingId: b.id, unit: 0 }); setAsideIncidents(s); t.happiness = 100; }
  assert.ok(['court', 'noticed'].includes(t.lateStage as string), 'stage ' + t.lateStage);
  untilDay(s, BAL.courtDays + 1);
  assert.equal(t.lateStage, 'writ', 'the court rules in the end');
  assert.equal(rent.payChance(s, t), 0, 'with a writ on the door they keep their coin for the cart');
  // by contrast a case about money is over the moment nothing is owed
  const b2 = addBuilding(s, 'cottage'); b2.units[0]!.listed = false;
  const d = settle(s, b2, { reliability: 0 });
  untilDay(s, 93); setAsideIncidents(s);
  assert.equal(d.lateStage, 'late');
  rent.applyLateOption(s, d.id, 'notice');
  assert.equal(tenants.auxOf(d).cause, 1);
  rent.addArrears(s, d.id, -d.arrears);
  assert.equal(d.lateStage, 'none'); assert.equal(d.courtDay, null);
});

test('while a ruling on them is pending a late household waits for it, then acts on it', () => {
  const s = realm(45);
  const b = addBuilding(s, 'cottage'); b.units[0]!.listed = false;
  const t = settle(s, b, { reliability: 0 });
  untilDay(s, 33);
  assert.equal(t.lateStage, 'late');
  const R = t.arrears;
  if (!tenants.decisionPending(s, 'late_rent', { tenantId: t.id })) return;   // no incident engine in this tree: nothing to wait for
  // they could pay tomorrow, and would: but the matter is before the ruler
  t.reliability = 1; t.income = 500;
  const cure = rent.TUNE.lateCure; rent.TUNE.lateCure = 1;
  try {
    for (const inc of Object.values(s.incidents)) inc.expiresDay = null;      // the ruler is taking their time
    days(s, 5);
    assert.equal(t.arrears, R, 'no payment while the ruling is awaited');
    assert.equal(t.lateStage, 'late');
    assert.equal(Object.values(s.incidents).filter(i => i.tenantId === t.id && i.state === 'open').length, 1, 'and they are not asked about twice');
    // the ruling: a week more. Now they find it.
    setAsideIncidents(s);
    rent.applyLateOption(s, t.id, 'wait');
    days(s, 2);
    assert.equal(t.arrears, 0); assert.equal(t.lateStage, 'none');
    assert.equal(b.units[0]!.purse, R, 'what they owed is on the step');
  } finally { rent.TUNE.lateCure = cure; }
});

test('a household that cannot find it all brings what it can, once', () => {
  const s = realm(46);
  const b = addBuilding(s, 'cottage'); b.units[0]!.listed = false;
  const t = settle(s, b, { reliability: 0, income: 30 });
  untilDay(s, 33); setAsideIncidents(s);
  t.arrears = 90;                                // three months of income and more: beyond finding in a week
  t.reliability = 1;
  // (the fee concentrates the mind for the week; nothing else is left to chance here)
  const fee = rent.TUNE.feeCure, idle = rent.TUNE.lateCure; rent.TUNE.feeCure = 1; rent.TUNE.lateCure = 0;
  let owed = 0;
  try {
    rent.applyLateOption(s, t.id, 'late_fee');
    owed = t.arrears;
    for (let i = 0; i < 6; i++) { days(s, 1); setAsideIncidents(s); }
  } finally { rent.TUNE.feeCure = fee; rent.TUNE.lateCure = idle; }
  const part = Math.round(30 * rent.TUNE.catchUpShare);
  assert.equal(t.arrears, owed - part, 'one part payment in the week, not one a day');
  assert.equal(t.lateStage, 'late');
  assert.ok(s.heralds.some(h => /toward the arrears/.test(h.text)));
});

test('nobody asks after a home they could not pay for', () => {
  const s = realm(47, 'baron');
  const dear = addBuilding(s, 'townhouse'); dear.rent = BUILDINGS.townhouse.baseRent * 3;
  const stall = addBuilding(s, 'tavern'); stall.rent = BUILDINGS.tavern.baseRent * 2;
  for (const b of [dear, stall]) {
    for (let i = 0; i < 150; i++) {
      const h = tenants.rollHousehold(s, { forBuilding: b.id });
      assert.ok(b.rent <= h.income * tenants.TUNE.maxRentShare + 1, `${h.trade} earning ${h.income} asked after a place at ${b.rent}`);
    }
  }
  const a = tenants.spawnApplicant(s, dear.id, 0)!;
  assert.ok(a.maxRent >= dear.rent && dear.rent <= a.household.income * 0.5 + 1);
});

// ───────────── the whole Sim ─────────────
// From here the real job system, incident engine and the rest are all running. Rulings are looked up by
// their decision option, never by id, so richer variants written later still pass through these.

/** Run the Sim for whole days in quarter-day ticks, gathering events; `each` runs after every day. */
function play(sim: Sim, n: number, each?: () => void): void {
  for (let d = 0; d < n; d++) {
    for (let q = 0; q < 4; q++) events.push(...sim.advanceDays(0.25));
    each?.();
  }
}
function playUntil(sim: Sim, maxDays: number, done: () => boolean, each?: () => void): boolean {
  for (let q = 0; q < maxDays * 4 && !done(); q++) { events.push(...sim.advanceDays(0.25)); if (q % 4 === 3) each?.(); }
  return done();
}
function openDecision(s: GameState, decision: string, who: { tenantId?: string; applicantId?: string }): GameState['incidents'][string] | undefined {
  return Object.values(s.incidents).find(i => i.state === 'open' && INCIDENT_BY_ID[i.defId]?.decision === decision
    && (who.tenantId ? i.tenantId === who.tenantId : i.applicantId === who.applicantId));
}
function rule(sim: Sim, inc: GameState['incidents'][string], option: string): void {
  const outcome = INCIDENT_BY_ID[inc.defId]!.outcomes.find(o => o.option === option);
  assert.ok(outcome, `${inc.defId} offers no "${option}"`);
  const r = sim.dispatch({ type: 'resolve_incident', incidentId: inc.id, outcomeId: outcome.id });
  assert.ok(r.ok, `could not rule "${option}" on ${inc.defId}: ${r.ok ? '' : r.reason}`);
  events.push(...sim.drain());
}
/** Random incidents are someone else's test: set them aside as they appear so these stories run undisturbed. */
function quietRealm(s: GameState): void {
  for (const inc of Object.values(s.incidents)) {
    if (inc.state === 'open' && !INCIDENT_BY_ID[inc.defId]?.system) inc.state = 'resolved';
  }
  s.rival.renown = 0;                             // and nobody is poached mid-story
}
function withErrorsCounted<T>(fn: () => T): { result: T; errors: string[] } {
  const errors: string[] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => { errors.push(a.map(x => (x instanceof Error ? x.stack ?? x.message : typeof x === 'string' ? x : JSON.stringify(x))).join(' ')); };
  try { return { result: fn(), errors }; } finally { console.error = orig; }
}
function firstDifference(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return `at ${i}: ...${a.slice(Math.max(0, i - 60), i + 60)}... against ...${b.slice(Math.max(0, i - 60), i + 60)}...`;
}
function dependable(t: Tenant): void { t.reliability = SURE; t.traits = []; t.revealed = []; t.happiness = 80; t.income = Math.max(t.income, 60); }

test('the whole Sim: Rent Day at Reeve is walked by the ruler, purse by purse', () => {
  const sim = newSim(101);
  const s = sim.state;
  const hs = tenants.housed(s);
  assert.equal(hs.length, 2, 'two households to begin with');
  assert.equal(Object.values(s.buildings).filter(b => b.type === 'hovel').length, 3);
  hs.forEach(dependable);
  const total = hs.reduce((a, t) => a + t.lease!.rent, 0);
  play(sim, 5, () => quietRealm(s));
  assert.ok(!s.heralds.some(h => /Rent Day is done/.test(h.text)), 'no Rent Day is reported before the first one');
  play(sim, 27, () => { quietRealm(s); hs.forEach(t => { t.happiness = 80; }); });   // to the 3rd of the second month
  assert.equal(eventsOf('rent_day').length, 1);
  assert.equal(economy.currentBook(s).rentDue, total);
  for (const t of hs) assert.equal(s.buildings[t.buildingId!]!.units[t.unit]!.purse, t.lease!.rent, `a purse on ${t.name}'s step`);
  assert.equal(eventsOf('purse').length, 2);
  assert.equal(economy.currentBook(s).income.rent, 0, 'nothing is booked until it is fetched');
  const ruler = Object.values(s.actors).find(a => a.kind === 'ruler')!;
  assert.ok(ruler, 'the ruler has a figure');
  events = [];
  assert.equal(sim.dispatch({ type: 'collect_all' }).ok, true);
  assert.ok(playUntil(sim, 4, () => Object.values(s.buildings).every(b => b.units.every(u => u.purse === 0))), 'the ruler fetched every purse within four days');
  const got = eventsOf('purse_collected');
  assert.equal(got.length, 2);
  assert.ok(got.every(e => e.byActor === ruler.id), 'collected by the ruler in person');
  assert.equal(eventsOf('rent_paid').length, 2);
  assert.equal(economy.currentBook(s).income.rent, total);
  assert.equal(s.stats.rentCollected, total);
  play(sim, 2);
  assert.ok(s.heralds.some(h => /Rent Day is done/.test(h.text) && /[Aa]ll 2/.test(h.text)), 'the clerk sums up on the 4th');
  assertConsistent(s, 'sim rent day');
});

test('the whole Sim: an applicant walks in by the gate, waits at the door, is shown round, and signs', () => {
  const sim = newSim(102);
  const s = sim.state;
  // the scripted first applicant, or failing that one sent for
  playUntil(sim, 16, () => Object.keys(s.applicants).length > 0, () => quietRealm(s));
  let a = Object.values(s.applicants)[0];
  if (!a) {
    const b = Object.values(s.buildings).find(x => x.units.some(u => !u.tenantId) && x.type === 'hovel')!;
    a = tenants.spawnApplicant(s, b.id, 0)!;
  }
  assert.ok(a, 'an applicant');
  const b = s.buildings[a.buildingId]!;
  const actorId = a.actorId!;
  assert.ok(s.actors[actorId] && s.actors[actorId]!.kind === 'applicant');
  const [dx, dy] = entranceOf(s, b);
  const atDoor = (): boolean => { const f = s.actors[actorId]; return !!f && f.path.length === 0 && Math.hypot(f.x - dx, f.y - dy) < 0.8; };
  assert.ok(playUntil(sim, 6, atDoor), 'they walked to the door');
  play(sim, 1);
  assert.ok(s.actors[actorId], 'and they are still standing there a day later');
  assert.equal(s.actors[actorId]!.state, 'waiting');
  assert.equal(a.shown, false);
  assert.equal(openDecision(s, 'applicant', { applicantId: a.id }), undefined, 'nothing to rule on until they have seen it');

  assert.equal(sim.dispatch({ type: 'order_job', kind: 'show', applicantId: a.id }).ok, true);
  assert.ok(playUntil(sim, 5, () => a!.shown), 'the ruler showed them round');
  const inc = openDecision(s, 'applicant', { applicantId: a.id });
  assert.ok(inc, 'the showing puts the decision before the ruler');
  const gold = s.gold, n = tenants.housed(s).length;
  events = [];
  rule(sim, inc, 'accept');
  playUntil(sim, 3, () => !s.applicants[a!.id]);
  const t = s.tenants[a.household.id]!;
  assert.ok(t && t.status === 'housed', 'they are on the rolls');
  assert.equal(t.buildingId, b.id);
  assert.equal(t.lease!.rent, b.rent); assert.equal(t.lease!.deposit, b.rent * s.policies.depositMonths);
  assert.ok(s.gold >= gold + t.lease!.deposit - 20, 'the surety came in');
  assert.equal(tenants.housed(s).length, n + 1);
  assert.equal(s.actors[actorId], undefined, 'their figure has gone indoors');
  assert.equal(eventsOf('tenant_in').length, 1);
  assert.ok(eventsOf('applicant_gone').some(e => e.applicantId === a!.id && e.signed));
  assertConsistent(s, 'sim accept');
});

test('the whole Sim: an applicant turned away leaves by the gate', () => {
  const sim = newSim(103);
  const s = sim.state;
  play(sim, 1);
  const b = Object.values(s.buildings).find(x => x.type === 'hovel' && x.units.some(u => !u.tenantId))!;
  const a = (tenants.applicantFor(s, b.id, 0) ?? tenants.spawnApplicant(s, b.id, 0))!;
  assert.ok(a, 'an applicant for the empty hovel');
  const actorId = a.actorId!;
  assert.equal(sim.dispatch({ type: 'order_job', kind: 'show', applicantId: a.id }).ok, true);
  assert.ok(playUntil(sim, 8, () => a.shown, () => quietRealm(s)), 'shown round');
  const inc = openDecision(s, 'applicant', { applicantId: a.id });
  assert.ok(inc);
  events = [];
  rule(sim, inc, 'reject');
  assert.equal(s.applicants[a.id], undefined);
  assert.ok(eventsOf('applicant_gone').some(e => e.applicantId === a.id && !e.signed));
  assert.equal(b.units[0]!.tenantId, null);
  assert.ok(playUntil(sim, 8, () => !s.actors[actorId]), 'their figure left the table');
  assert.equal(tenants.housed(s).some(t => t.id === a.household.id), false);
});

test('the whole Sim: a household that will not pay goes by way of the court, and the Bailiff\'s knock', () => {
  const sim = newSim(104);
  const s = sim.state;
  const [t, other] = tenants.housed(s) as [Tenant, Tenant];
  dependable(other);
  t.reliability = 0; t.traits = ['deadbeat'];
  const home = s.buildings[t.buildingId!]!;
  const daily = (): void => {
    quietRealm(s);
    if (t.status === 'housed') t.happiness = 70;                 // otherwise they may simply walk out first
    other.happiness = 80;
    if (Object.values(s.buildings).some(b => b.units.some(u => u.purse > 0))) sim.dispatch({ type: 'collect_all' });
  };
  play(sim, 33, daily);
  assert.equal(t.lateStage, 'late'); assert.equal(t.arrears, t.lease!.rent);
  assert.ok(eventsOf('rent_late').some(e => e.tenantId === t.id));
  const late = openDecision(s, 'late_rent', { tenantId: t.id });
  assert.ok(late, 'the ruler is asked what to do');
  if (INCIDENT_BY_ID[late.defId]!.outcomes.some(o => o.option === 'notice')) rule(sim, late, 'notice');
  else {
    // not every excuse comes with a notice among its answers (a harvest, a feast): the ruler lets it lie and sends one by hand
    rule(sim, late, 'wait');
    assert.equal(sim.dispatch({ type: 'order_job', kind: 'serve_notice', tenantId: t.id }).ok, true, 'a notice can always be ordered by hand');
  }
  assert.ok(playUntil(sim, 5, () => t.lateStage === 'noticed', daily), 'the notice was nailed up');
  assert.ok(t.courtDay !== null && t.courtDay > s.day + BAL.courtDays - 6);
  assert.ok(playUntil(sim, 10, () => t.lateStage === 'court', daily), 'the court took the matter up');
  assert.equal(sim.dispatch({ type: 'order_job', kind: 'evict', tenantId: t.id }).ok, false, 'no writ, no eviction');
  assert.ok(playUntil(sim, BAL.courtDays + 20, () => t.lateStage === 'writ', daily), 'the court ruled');
  assert.equal(t.status, 'housed');
  assert.ok(t.arrears >= t.lease!.rent * 2, 'and the debt kept growing meanwhile');
  const writ = openDecision(s, 'eviction_ready', { tenantId: t.id });
  assert.ok(writ, 'the writ is put in the ruler\'s hand');
  const renownBefore = s.renown;
  events = [];
  rule(sim, writ, 'evict');
  assert.equal(t.status, 'housed', 'not until the Bailiff gets there');
  assert.ok(playUntil(sim, 6, () => t.status !== 'housed', daily), 'the eviction was carried out');
  assert.equal(t.status, 'evicted');
  assert.equal(s.stats.evictions, 1);
  assert.equal(home.units[t.unit]!.tenantId, null);
  assert.ok(eventsOf('tenant_out').some(e => e.tenantId === t.id && e.reason === 'evicted'));
  assert.ok(s.renown < renownBefore);
  assert.equal(other.status, 'housed');
  assertConsistent(s, 'sim eviction');
});

test('the whole Sim: a household leaves, the place is looked over, and the surety is settled fairly', () => {
  const sim = newSim(105);
  const s = sim.state;
  play(sim, 2, () => quietRealm(s));
  const t = tenants.housed(s)[0]!;
  const b = s.buildings[t.buildingId!]!;
  const D = t.lease!.deposit;
  assert.ok(D > 0);
  t.wear = 20;
  const cond = b.condition;
  tenants.moveOut(s, t.id, 'lease_end');
  events.push(...sim.drain());
  assert.equal(t.status, 'left');
  assert.ok(Object.values(s.jobs).some(j => j.kind === 'inspect' && j.buildingId === b.id && j.state !== 'cancelled'), 'an inspection is queued');
  assert.ok(playUntil(sim, 5, () => tenants.auxOf(t).dep >= 2, () => quietRealm(s)), 'somebody looked the place over');
  assert.ok(b.condition <= cond - 15 && b.condition > 0, `their wear shows on the house (${cond} to ${b.condition})`);
  const inc = openDecision(s, 'move_out_deposit', { tenantId: t.id });
  assert.ok(inc, 'the surety is put to the ruler');
  const damage = tenants.auxOf(t).damage;
  assert.ok(damage > 0, 'sixteen points past honest wear cost something to put right');
  // Which household this is depends on the dice, and each people has its own way of leaving: the plain
  // ruling keeps exactly the damage, a halfling's keeps the price of a door once the Mason has squared it.
  // So read what "fair" means from the matter actually opened, and wait out any errand it sends someone on.
  const fair = INCIDENT_BY_ID[inc.defId]!.outcomes.find(o => o.option === 'fair');
  assert.ok(fair, `${inc.defId} offers a fair ruling`);
  const eff = fair.effects.find(e => e.t === 'deposit');
  assert.ok(eff && eff.t === 'deposit', `${inc.defId}: the fair ruling settles the surety`);
  const kept = eff.keepPct < 0 ? Math.min(D, damage) : Math.round(D * Math.min(100, eff.keepPct) / 100);
  assert.ok(kept >= 0 && kept < D, 'a fair ruling never keeps the lot');
  const gold = s.gold, returned = economy.currentBook(s).expense.deposits_returned;
  rule(sim, inc, 'fair');
  if (fair.job) assert.ok(playUntil(sim, 8, () => tenants.auxOf(t).dep === 3, () => quietRealm(s)), 'the errand was run and the surety settled');
  assert.equal(t.lease!.deposit, 0);
  assert.equal(tenants.auxOf(t).dep, 3, 'the matter is closed');
  assert.equal(economy.currentBook(s).expense.deposits_returned - returned, D - kept);
  if (!fair.job) assert.equal(gold - s.gold, D - kept, 'exactly the damage was kept, and no more than the surety');
  assert.equal(b.units[t.unit]!.listed, true, 'and the place is to let again');
  assertConsistent(s, 'sim surety');
});

/** A plain player: fetches purses, shows applicants round, takes the first reasonable ruling on everything. */
function playReign(sim: Sim, n: number, act: boolean): void {
  const s = sim.state;
  const has = (role: StaffRole): boolean => Object.values(s.staff).some(m => m.role === role);
  for (let d = 0; d < n && !s.ended; d++) {
    for (let q = 0; q < 4; q++) events.push(...sim.advanceDays(0.25));
    if (!act) continue;
    if (!has('bailiff') && Object.values(s.buildings).some(b => b.units.some(u => u.purse > 0))) sim.dispatch({ type: 'collect_all' });
    if (!has('crier')) for (const a of Object.values(s.applicants)) if (!a.shown) sim.dispatch({ type: 'order_job', kind: 'show', applicantId: a.id });
    for (const inc of Object.values(s.incidents)) {
      if (inc.state !== 'open' || s.day - inc.startedDay < 1) continue;
      const def = INCIDENT_BY_ID[inc.defId];
      if (!def) continue;
      const t = inc.tenantId ? s.tenants[inc.tenantId] : undefined;
      const pick = (option: string) => def.outcomes.find(o => o.option === option);
      const want = (def.decision === 'late_rent' ? pick(t && t.daysLate > 20 ? 'notice' : (d % 3 === 0 ? 'wait' : d % 3 === 1 ? 'late_fee' : 'payment_plan'))
        : def.decision === 'eviction_ready' ? pick(d % 2 ? 'evict' : 'cash_for_keys')
        : def.decision === 'move_out_deposit' ? pick(d % 3 === 0 ? 'keep_all' : 'fair')
        : def.decision === 'rent_renewal' ? pick(d % 2 ? 'raise' : 'hold')
        : def.decision === 'applicant' ? pick(d % 5 === 0 ? 'screen' : d % 7 === 0 ? 'reject' : 'accept')
        : undefined) ?? def.outcomes.find(o => o.default) ?? def.outcomes[d % def.outcomes.length]!;
      sim.dispatch({ type: 'resolve_incident', incidentId: inc.id, outcomeId: want.id });
    }
    if (d % 45 === 20) { const t = tenants.housed(s)[d % Math.max(1, tenants.housed(s).length)]; if (t) { sim.dispatch({ type: 'order_job', kind: 'visit', tenantId: t.id }); sim.dispatch({ type: 'gift', tenantId: t.id, amount: 2 }); } }
    if (d % 200 === 100) sim.dispatch({ type: 'hold_feast' });
  }
  events.push(...sim.drain());
}

test('determinism: the same seed and the same rulings give the same reign, to the last crown', () => {
  const run = (seed: number, n: number): string => { const sim = newSim(seed); playReign(sim, n, true); return sim.save(); };
  const { result: [a, b, c], errors } = withErrorsCounted(() => [run(7, 400), run(7, 400), run(8, 400)]);
  assert.deepEqual(errors, []);
  assert.ok(a === b, 'two runs of seed 7 differ: ' + firstDifference(a!, b!));
  assert.ok(a !== c, 'seeds 7 and 8 gave the same reign');
  // nothing the people modules need lives outside the state: a reign saved and loaded carries on identically
  const first = newSim(9);
  playReign(first, 200, true);
  const second = Sim.load(first.save());
  playReign(first, 160, true); playReign(second, 160, true);
  assert.ok(first.save() === second.save(), 'a loaded reign drifted from the one that was never saved: ' + firstDifference(first.save(), second.save()));
  // and the four modules alone, on a hand-built realm
  const small = (): string => {
    const s = realm(77);
    for (let i = 0; i < 6; i++) { const h = addBuilding(s, i % 2 ? 'cottage' : 'hovel'); if (i < 4) tenants.houseDirectly(s, tenants.rollHousehold(s, { forBuilding: h.id }), h.id, 0); }
    bx = 0;
    for (let i = 0; i < 200; i++) { days(s, 1); for (const j of Object.values(s.jobs)) if (j.kind === 'collect' || j.kind === 'show' || j.kind === 'inspect') { finishJobs(s, [j.kind]); } }
    return JSON.stringify({ ...s, _events: [] });
  };
  const one = small(), two = small();
  assert.ok(one === two, 'the people modules alone are not deterministic: ' + firstDifference(one, two));
});

test('two years of Sim.create(): nothing throws, nothing is NaN, the coffers stay finite', () => {
  for (const [seed, act] of [[1, false], [2, true], [3, true], [4, true]] as [number, boolean][]) {
    const fx0 = EFFECTS.errors.length;
    const sim = newSim(seed);
    const s = sim.state;
    events = [];
    const { errors } = withErrorsCounted(() => {
      for (let m = 0; m < 24; m++) { playReign(sim, 30, act); assertConsistent(s, `seed ${seed} month ${m + 1}`); }
    });
    assert.deepEqual(errors, [], `seed ${seed}: something was caught and logged`);
    assert.deepEqual(EFFECTS.errors.slice(fx0), [], `seed ${seed}: an effect threw`);
    assert.ok(Number.isFinite(s.gold), 'gold ' + s.gold);
    assert.ok(s.day >= 720 || s.ended, 'the reign ran its two years');
    assert.equal(eventsOf('rent_day').length, s.ended ? eventsOf('rent_day').length : 24);
    assert.ok(s.ledger.months.length <= economy.TUNE.monthsKept && s.ledger.txns.length <= economy.TUNE.txnsKept);
    for (const t of Object.values(s.tenants)) {
      assert.ok(t.memory.length <= tenants.TUNE.memoryCap);
      if (t.status !== 'housed') assert.ok(s.day - (t.leftDay ?? s.day) <= tenants.TUNE.keepDepartedDays * 2 + 1, `${t.name} left long ago and is still on the rolls`);
    }
    for (const h of s.heralds) assert.ok(!/[‒-―]/.test(h.text) && !/undefined|NaN|\{|\}/.test(h.text), 'a herald line went wrong: ' + h.text);
    if (act) {
      assert.ok(s.stats.rentCollected > 40, `seed ${seed}: a played reign collects rent (${s.stats.rentCollected})`);
      assert.ok(eventsOf('purse_collected').length > 8, `seed ${seed}: purses were fetched (${eventsOf('purse_collected').length})`);
    }
    if (s.ledger.months.length < economy.TUNE.monthsKept) {
      assert.equal(bookNet(s), s.gold - BAL.startGold, `seed ${seed}: the coffers moved by something that never went through the books`);
    }
  }
});

test('the whole Sim at Knight and Baron: the Bailiff walks the round, the Steward takes rent at the door', () => {
  for (const rank of ['knight', 'baron'] as const) {
    const s = makeFixtureState(rank);
    for (const a of Object.values(s.actors)) if (a.kind === 'staff' || a.kind === 'ruler') { a.state = 'idle'; a.path = []; a.jobId = null; }
    const sim = new Sim(s);
    const fx0 = EFFECTS.errors.length;
    events = [];
    const direct = rent.paysDirect(s);
    assert.equal(direct, rank === 'baron', 'the Baron fixture has a Steward and a Counting House; the Knight one does not');
    assert.ok(Object.values(s.staff).some(m => m.role === 'bailiff'));
    const { errors } = withErrorsCounted(() => { for (let m = 0; m < 12; m++) { playReign(sim, 30, true); assertConsistent(s, `${rank} fixture month ${m + 1}`); } });
    assert.deepEqual(errors, [], `${rank}: something was caught and logged`);
    assert.deepEqual(EFFECTS.errors.slice(fx0), [], `${rank}: an effect threw`);
    assert.ok(eventsOf('rent_paid').length > 40, `${rank}: rent came in (${eventsOf('rent_paid').length})`);
    if (direct) {
      assert.equal(eventsOf('purse').length, 0, 'no purses once rent is taken at the Counting House');
    } else {
      // nobody dispatched collect_all: every one of these was the Bailiff's own round
      assert.ok(eventsOf('purse').length > 40);
      assert.ok(eventsOf('purse_collected').length >= eventsOf('purse').length * 0.8, `the Bailiff fetched them (${eventsOf('purse_collected').length} of ${eventsOf('purse').length})`);
      const bailiff = Object.values(s.staff).find(m => m.role === 'bailiff')!;
      assert.ok(eventsOf('purse_collected').filter(e => e.byActor === bailiff.actorId).length > 20, 'and it was the Bailiff who did');
    }
    assert.ok(tenants.housed(s).length >= 5, `${rank}: the realm did not empty (${tenants.housed(s).length})`);
  }
});

// ───────────── run ─────────────

let failed = 0;
for (const [name, fn] of tests) {
  try { bx = 0; events = []; fn(); console.log('  ok    ' + name); }
  catch (e) { failed++; console.log('  FAIL  ' + name + '\n' + (e instanceof Error ? e.stack : String(e))); }
}
console.log(failed ? `\n${failed} of ${tests.length} failed` : `\nall ${tests.length} sim-people tests passed`);
if (failed) process.exit(1);
