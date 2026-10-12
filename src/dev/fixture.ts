/**
 * Hand-built GameStates for developing render / UI / word modules before
 * (and independent of) the real sim. NOT used by the shipped game.
 *
 *   const s = makeFixtureState('knight');     // 'reeve' | 'knight' | 'baron'
 *   const sim = fakeSim(s);                   // SimLike: dispatch() logs and returns ok
 *
 * The fixture is deterministic and deliberately busy: every building type
 * unlocked at that rank appears, with tenants of several species, an open
 * audience incident (the griffin), a leak, goblin squatters, an applicant
 * waiting, purses at doors, staff, an oath and a standing order.
 */
import {
  MAP_W, MAP_H, PARCEL, SAVE_VERSION, RANK_ORDER,
  type GameState, type Building, type Tenant, type Tile, type Terrain, type RankId, type Actor,
  type Action, type ActionResult, type Speed, type Applicant, type StaffMember, type Incident, type Unit,
} from '../sim/types';
import { BUILDINGS, RANKS } from '../data';
import type { BuildingType, Species, TradeId, TraitId, TenantTag, PetKind, TemperamentId } from '../data/ids';
import type { SimLike } from '../ui/api';

function h01(n: number): number { let t = (n + 0x6d2b79f5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }

export function makeFixtureState(rank: 'reeve' | 'knight' | 'baron' = 'knight', day = 34.4): GameState {
  let nid = 1;
  const id = (p: string) => p + (nid++).toString(36);
  const rankIdx = RANK_ORDER.indexOf(rank);

  // ── terrain: a stream down the east side, woods to the north-west, rocks scattered
  const tiles: Tile[] = [];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    let t: Terrain = 'grass';
    const streamX = 23 + Math.round(Math.sin(y * 0.55) * 1.6);
    if (x === streamX) t = 'water';
    else if (h01(x * 131 + y * 977) < 0.2 && (x < 7 || y < 4 || x > 27 || y > 19)) t = 'forest';
    else if (h01(x * 71 + y * 313 + 5) < 0.03) t = 'rock';
    tiles.push({ t, b: null, wear: 0, v: Math.floor(h01(x * 17 + y * 29) * 256) });
  }
  const T = (x: number, y: number) => tiles[y * MAP_W + x]!;
  const owned = rank === 'reeve' ? [5] : rank === 'knight' ? [5, 6, 9, 1] : [5, 6, 9, 1, 4, 10, 2, 8];
  const parcelNames = ['Crow Acre', 'Upper Dripping', 'The Stumps', 'Far Stumps', 'Mudlark Bottom', 'The Green', 'Millside', 'Beyond-the-Water', 'Gallows Acre', 'Lower Dripping', 'Goose Common', 'World\'s End'];
  const parcels = Array.from({ length: 12 }, (_, i) => ({
    id: i, x: (i % 4) * PARCEL, y: Math.floor(i / 4) * PARCEL, owned: owned.includes(i),
    price: 60 + i * 35, minRank: (i === 3 || i === 7 || i === 11 ? 'baron' : 'reeve') as RankId, name: parcelNames[i]!,
  }));
  // roads: a lane through the owned middle and a bridge
  const road = (x: number, y: number) => { const t = T(x, y); if (t.t === 'water') t.t = 'bridge'; else if (!t.b) t.t = 'road'; };
  for (let x = 2; x <= 26; x++) road(x, 12);
  for (let y = 8; y <= 16; y++) road(12, y);
  if (rankIdx >= 1) for (let y = 3; y <= 20; y++) road(18, y);
  // fields south
  for (let y = 18; y <= 20; y++) for (let x = 9; x <= 14; x++) if (T(x, y).t === 'grass') T(x, y).t = 'field';

  const buildings: Record<string, Building> = {};
  const tenants: Record<string, Tenant> = {};
  const NAMES: [string, string, Species, TradeId][] = [
    ['Old Marta Thistlewick', 'Marta', 'human', 'farmer'], ['Wat Mudge', 'Wat', 'human', 'laborer'], ['Pim Underbough', 'Pim', 'halfling', 'baker'],
    ['Edith Fenn', 'Edith', 'human', 'weaver'], ['Borin Caskhammer', 'Borin', 'dwarf', 'blacksmith'], ['Snik of the Good Pen', 'Snik', 'goblin', 'scribe'],
    ['Osric Harrow', 'Osric', 'human', 'shepherd'], ['Lobelia Greenhill', 'Lobelia', 'halfling', 'cheesemonger'], ['Durga Stonesill', 'Durga', 'dwarf', 'brewer'],
    ['Ffion Alderlight', 'Ffion', 'elf', 'bard'], ['Grub', 'Grub', 'ogre', 'gravedigger'], ['Magister Quill Vantablack', 'Quill', 'human', 'wizard'],
    ['Hilde Rushlight', 'Hilde', 'human', 'candlemaker'], ['Tam Reedy', 'Tam', 'human', 'fishmonger'], ['Bettony Wort', 'Bettony', 'human', 'hedge_witch'],
    ['Cuthbert Ploughwright', 'Cuthbert', 'human', 'miller'], ['Rosamund Tapper', 'Rosamund', 'human', 'innkeeper'], ['Nib', 'Nib', 'goblin', 'ratcatcher'],
  ];
  let nameI = 0;
  const TRAITS: TraitId[] = ['punctual', 'forgetful', 'complainer', 'handy', 'litigious', 'gossip', 'pet_lover', 'messy', 'loyal', 'musician', 'proud', 'haggler'];
  const TAGS: (TenantTag | null)[] = ['widow', null, 'large_family', null, 'veteran', null, 'elder', null, 'newlyweds', 'scholar', null, null];

  function put(type: BuildingType, x: number, y: number, rot: 0 | 1 | 2 | 3 = 0, opts: Partial<Building> & { empty?: boolean; level?: number } = {}): Building {
    const def = BUILDINGS[type];
    const w = rot % 2 ? def.h : def.w, hh = rot % 2 ? def.w : def.h;
    const b: Building = {
      id: id('b'), type, x, y, w, h: hh, rot, variant: Math.floor(h01(x * 7 + y * 13) * 1000),
      name: opts.name ?? def.name, level: opts.level ?? 1, state: 'ready', progress: 1, condition: 55 + Math.floor(h01(x + y * 3) * 45),
      units: [], rent: def.baseRent, builtDay: 0, visuals: [], squatters: null, flags: {}, ...opts,
    };
    for (let u = 0; u < def.units; u++) {
      const unit: Unit = { tenantId: null, vacantSince: 0, listed: true, purse: 0, purseDay: 0 };
      if (!opts.empty && b.state === 'ready') {
        const n = NAMES[nameI % NAMES.length]!; const k = nameI++;
        const commercial = def.category === 'commercial';
        const t: Tenant = {
          id: id('t'), name: n[0], first: n[1], species: n[2], trade: commercial && def.trades ? def.trades[0]! : n[3], character: null,
          portraitSeed: 1000 + k * 37, household: 1 + (k % 5), traits: [TRAITS[k % TRAITS.length]!, TRAITS[(k + 5) % TRAITS.length]!], revealed: k % 2 ? [TRAITS[k % TRAITS.length]!] : [],
          tags: TAGS[k % TAGS.length] ? [TAGS[k % TAGS.length]!] : [], pets: k % 4 === 2 ? (['cat'] as PetKind[]) : [],
          income: 30 + k * 4, reliability: 0.6 + (k % 4) * 0.1, happiness: 35 + ((k * 23) % 60), status: 'housed', buildingId: b.id, unit: u,
          lease: { rent: def.baseRent + (k % 3) - 1, startDay: -20 * k, termMonths: 12, deposit: def.baseRent }, movedInDay: -20 * k,
          arrears: k % 6 === 1 ? def.baseRent : 0, daysLate: k % 6 === 1 ? 5 : 0, lateStage: k % 6 === 1 ? 'late' : 'none', plan: null, courtDay: null,
          memory: k % 3 === 0 ? [{ day: 3, text: 'You mended the roof the same day they asked.', valence: 1 }] : [], wear: 5 + (k % 5) * 6, leftDay: null,
        };
        tenants[t.id] = t; unit.tenantId = t.id; unit.vacantSince = null; unit.listed = false;
        if (k % 3 === 0) { unit.purse = t.lease!.rent; unit.purseDay = 30; }
      }
      b.units.push(unit);
    }
    for (let yy = y; yy < y + hh; yy++) for (let xx = x; xx < x + w; xx++) { const t = T(xx, yy); t.b = b.id; if (t.t !== 'grass') t.t = 'grass'; }
    buildings[b.id] = b;
    return b;
  }

  // ── the hamlet (parcel 5: tiles 8..15 x 8..15)
  const seat = put('seat', 9, 8, 0, { level: RANKS[rank].seatLevel, name: BUILDINGS.seat.levelNames![RANKS[rank].seatLevel - 1]! });
  const hov1 = put('hovel', 13, 9, 0, { name: 'The Leaning Hovel', condition: 38 });
  const hov2 = put('hovel', 13, 13, 2, { name: 'Mudlark Hovel' });
  const hov3 = put('hovel', 9, 14, 2, { name: 'Damp End', empty: true, condition: 24 });
  put('cottage', 15, 13, 2, { name: 'Thistle Cottage' });
  put('burrow', 9, 12, 3, { name: 'Underbough' });
  put('well', 11, 13);
  put('garden', 11, 15, 0);
  put('notice_board', 11, 11);
  put('market_stall', 14, 11, 0, { name: 'The Cheese Plank' });
  put('shrine', 8, 12);
  if (rankIdx >= 1) {
    put('longhouse', 19, 9, 1, { name: 'The Long Row' });
    put('stonehall', 19, 13, 1, { name: 'Caskhammer Hall' });
    put('bakery', 16, 9, 0);
    put('smithy', 19, 17, 1);
    put('mill', 14, 3, 0, { name: 'Ploughwright Mill' });
    put('tavern', 8, 3, 0, { name: 'The Late Payment' });
    put('masons_yard', 16, 16, 0);
    put('bailiffs_post', 12, 5, 0);
    put('criers_stand', 12, 13, 0);
    put('stocks', 8, 11);
    put('statue', 12, 11);
    put('watchtower', 21, 12);
    put('cottage', 15, 6, 0, { name: 'New Cottage', state: 'building', progress: 0.45, empty: true });
  }
  if (rankIdx >= 2) {
    put('townhouse', 3, 9, 3, { name: 'Three-Stack' });
    put('treehouse', 2, 14, 0, { name: 'Alderlight' });
    put('wizard_tower', 5, 14, 0, { name: 'Vantablack Tower' });
    put('apothecary', 5, 9, 0);
    put('chapel', 16, 18, 1, { name: 'St Osyth the Solvent' });
    put('counting_house', 6, 5, 0);
    put('cottage', 3, 5, 0, { name: 'The Ruin', state: 'ruined', condition: 0, empty: true });
  }

  // ── incidents on show
  const tOf = (b: Building) => tenants[b.units[0]!.tenantId!]!;
  hov2.visuals.push('griffin_roof'); tOf(hov2).pets.push('griffin');
  hov1.visuals.push('leak');
  hov3.squatters = { kind: 'goblins', sinceDay: 12 }; hov3.visuals.push('goblins_windows');
  const incidents: Record<string, Incident> = {};
  const mkInc = (defId: string, b: Building, tenantId: string | null, vars: Record<string, string | number>): Incident => {
    const inc: Incident = { id: id('i'), defId, state: 'open', buildingId: b.id, unit: 0, tenantId, applicantId: null, startedDay: day - 3, expiresDay: day + 9, vars, outcomeId: null, resolvedBy: null, jobId: null, actorId: null, reported: false };
    incidents[inc.id] = inc; return inc;
  };
  const griffin = mkInc('unauthorized_griffin', hov2, tOf(hov2).id, { tenant: tOf(hov2).name, first: tOf(hov2).first, building: hov2.name, btype: 'hovel', pet: 'griffin' });
  mkInc('sys_repair_leak', hov1, tOf(hov1).id, { tenant: tOf(hov1).name, building: hov1.name, btype: 'hovel' });
  mkInc('sys_squatters_goblins', hov3, null, { building: hov3.name, btype: 'hovel' });

  // ── actors
  const actors: Record<string, Actor> = {};
  const mkActor = (kind: Actor['kind'], refId: string | null, x: number, y: number, state: Actor['state'] = 'idle', path: [number, number][] = []): Actor => {
    const a: Actor = { id: id('a'), kind, refId, x, y, path, speed: 6, state, jobId: null, homeX: x, homeY: y, facing: 0 };
    actors[a.id] = a; return a;
  };
  mkActor('ruler', null, 10.5, 11.4);
  const petitioner = mkActor('petitioner', tOf(hov2).id, 9.5, 11.5, 'waiting'); griffin.actorId = petitioner.id;
  const staff: Record<string, StaffMember> = {};
  const mkStaff = (role: StaffMember['role'], name: string, first: string, species: Species, temperament: TemperamentId, x: number, y: number) => {
    const sid = id('s'); const a = mkActor('staff', sid, x, y, role === 'mason' ? 'working' : 'walking', role === 'mason' ? [] : [[x + 3.0, y], [x + 3.0, y + 2.0]]);
    staff[sid] = { id: sid, role, name, first, species, portraitSeed: 500 + nid, temperament, skill: 2 + (nid % 3), wage: 14, loyalty: 70, hiredDay: 0, actorId: a.id, authority: rankIdx >= 2 ? 1 : 0, jobsDone: 7 };
  };
  if (rankIdx >= 1) {
    mkStaff('mason', 'Hob Trowelsby', 'Hob', 'human', 'bodger', 14.5, 11.5);
    mkStaff('bailiff', 'Agnes Ironknock', 'Agnes', 'dwarf', 'iron', 12.5, 7.5);
    mkStaff('crier', 'Pip Bellweather', 'Pip', 'halfling', 'bellower', 12.5, 14.5);
  }
  if (rankIdx >= 2) mkStaff('steward', 'Ansel Quillfeather', 'Ansel', 'human', 'pennypincher', 7.5, 7.5);

  // ── an applicant at the vacant unit of the longhouse / else the ruinous hovel
  const applicants: Record<string, Applicant> = {};
  const vacant = Object.values(buildings).find(b => b.state === 'ready' && b.units.some(u => !u.tenantId) && !b.squatters);
  if (vacant) {
    const aid = id('p');
    const act = mkActor('applicant', aid, vacant.x + vacant.w / 2, vacant.y + vacant.h + 0.5, 'waiting');
    applicants[aid] = {
      id: aid, buildingId: vacant.id, unit: vacant.units.findIndex(u => !u.tenantId), arrivedDay: day - 1, leavesDay: day + 7, maxRent: vacant.rent + 3, shown: false, screened: false, actorId: act.id,
      household: { id: id('t'), name: 'Jory Applewhite', first: 'Jory', species: 'human', trade: 'carpenter', character: null, portraitSeed: 4242, household: 3, traits: ['handy', 'haggler'], revealed: [], tags: ['newlyweds'], pets: [], income: 44, reliability: 0.8 },
    };
  }

  const s: GameState = {
    version: SAVE_VERSION, seed: 12345, rng: 999, mode: 'peace', nextId: 100000,
    day, speed: 1, weather: 'clear',
    realm: { name: 'Mudlark Hollow', ruler: 'Luke', rank, crest: 4711, heirloom: null, reign: 1 },
    gold: rank === 'reeve' ? 86 : rank === 'knight' ? 412 : 1830, loans: [], renown: 58, favor: 52,
    map: { w: MAP_W, h: MAP_H, tiles, parcels },
    buildings, tenants, applicants, staff,
    candidates: [
      { id: 'c1', role: 'mason', name: 'Gwen Plumbline', first: 'Gwen', species: 'human', portraitSeed: 71, temperament: 'perfectionist', skill: 3, wage: 17, temperamentKnown: false, pitch: 'I measure twice, cut once, and then measure again in case the wood moved.' },
      { id: 'c2', role: 'bailiff', name: 'Soft Tom Lamb', first: 'Tom', species: 'human', portraitSeed: 72, temperament: 'soft', skill: 2, wage: 12, temperamentKnown: true, pitch: 'I find most people pay if you ask about their mother first.' },
      { id: 'c3', role: 'crier', name: 'Lady Pru Farthingale', first: 'Pru', species: 'elf', portraitSeed: 73, temperament: 'snob', skill: 4, wage: 23, temperamentKnown: false, pitch: 'I announce only vacancies of quality. To persons of quality.' },
    ],
    actors, jobs: {}, incidents, incidentLog: {}, pending: [],
    orders: [
      { id: 'o1', to: 'bailiff', text: 'Never evict a widow in winter.', gist: 'No widows out in winter. Aye.', decision: 'eviction_ready', incidentDef: null, when: [{ field: 'tenant.tags', op: 'includes', value: 'widow' }, { field: 'season', op: '==', value: 'winter' }], rule: 'never', option: 'evict', outcomeId: null, createdDay: 5, uses: 0 },
      { id: 'o2', to: 'mason', text: 'Always mend leaks properly, no patch jobs.', gist: 'Proper mending, no straw and prayers.', decision: 'repair', incidentDef: null, when: [], rule: 'choose', option: 'fix', outcomeId: null, createdDay: 9, uses: 3 },
    ],
    policies: { graceDays: 3, lateFeePct: 10, depositMonths: 1, askPct: 100, renewalCapPct: 10, pets: 'pet_rent', screening: 'never' },
    oaths: [
      { id: 'w1', kind: 'repair', text: 'I will have that roof mended before the first frost.', toTenantId: tOf(hov1).id, toName: tOf(hov1).name, buildingId: hov1.id, buildingType: null, amount: null, madeDay: 20, dueDay: 270, state: 'open', settledDay: null },
      { id: 'w2', kind: 'no_rent_raise', text: 'Your rent will not move this year.', toTenantId: tOf(hov2).id, toName: tOf(hov2).name, buildingId: null, buildingType: null, amount: null, madeDay: 2, dueDay: 362, state: 'open', settledDay: null },
    ],
    ledger: {
      months: [{ index: 0, income: { rent: 46, fees: 2, deposits_kept: 0, windfall: 5, loan: 0 }, expense: { construction: 40, repairs: 9, wages: 0, upkeep: 4, tribute: 15, interest: 0, deposits_returned: 0, bribes: 0, gifts: 0, court: 0, land: 0, loan_repaid: 0, other: 0 }, closing: 105, rentDue: 54, rentCollected: 46 }],
      txns: [{ day: 30.2, amount: 8, cat: 'rent', memo: 'Rent, The Leaning Hovel' }, { day: 31, amount: -9, cat: 'repairs', memo: 'Thatch, Mudlark Hovel' }],
    },
    charter: { goals: RANKS[rank].goals.map((g, i) => ({ id: g.id, value: Math.round(g.target * (0.45 + i * 0.2)), target: g.target, done: i === 2 })), ready: false, sinceDay: 0 },
    rival: { name: 'Baron Aldous Vane', seat: 'Greywater', renown: 55, temperament: 'grasping', portraitSeed: 666, poached: 1, lastMoveDay: 10 },
    heralds: [
      { id: 'h1', day: day - 4, kind: 'crown', text: 'By grace of the Crown, Luke is named Reeve of Mudlark Hollow: three hovels, some mud, and the right to collect what rent can be got.' },
      { id: 'h2', day: day - 3, kind: 'urgent', text: 'There is a griffin on the roof of Mudlark Hovel. It has eaten a weathervane.', buildingId: hov2.id, incidentId: griffin.id },
      { id: 'h3', day: day - 2, kind: 'bad', text: 'The roof of The Leaning Hovel is leaking. It has chosen a spot directly over the bed.', buildingId: hov1.id },
      { id: 'h4', day: day - 1, kind: 'good', text: 'Pim Underbough paid in full, and left a seed cake on the sill.' },
      { id: 'h5', day: day - 0.5, kind: 'rival', text: 'Baron Aldous Vane has been seen measuring your tenants for his own cottages.' },
    ],
    stats: { rentCollected: 46, evictions: 0, oathsKept: 1, oathsBroken: 0, incidentsResolved: 4, incidentsIgnored: 1, tenantsHoused: 6, wordsSpoken: 3, peakRentRoll: 60, daysInDebt: 0 },
    flags: {}, seen: {}, ended: null, _events: [],
  };
  void seat;
  return s;
}

/** A SimLike that accepts everything and logs it. Mutates speed only. */
export function fakeSim(state: GameState): SimLike & { log: Action[] } {
  const log: Action[] = [];
  return {
    state, log,
    dispatch(a: Action): ActionResult {
      log.push(a);
      if (a.type === 'set_speed') state.speed = a.speed;
      console.log('[fakeSim]', JSON.stringify(a));
      return { ok: true };
    },
    setSpeed(sp: Speed) { state.speed = sp; },
  };
}
