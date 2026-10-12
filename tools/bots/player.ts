/**
 * A competent (or careless) player, playing only through actions.
 * Reads state the way a player reads the screen; never mutates it.
 */
import { Sim } from '../../src/sim/index';
import type { GameState, Building, Incident, DecisionOption, Action, RankId } from '../../src/sim/types';
import { MAP_W, MAP_H, RANK_ORDER } from '../../src/sim/types';
import type { BuildingType } from '../../src/data/ids';
import { BUILDINGS, BUILDING_LIST } from '../../src/data/buildings';
import { RANKS } from '../../src/data/ranks';
import { BAL } from '../../src/data/balance';
import { canPlace } from '../../src/sim/world';
import { marketRent, feastCost, feastWaitDays } from '../../src/sim/economy';
import { defOf } from '../../src/sim/incidents';
import { nextTribute, debtOf } from '../../src/sim/modes';

export interface BotOpts { careless?: boolean }
export interface BotMemo { rng: number; lastBuildDay: number; noRoom: number; stalls: Record<string, number> }

export function newMemo(seed: number): BotMemo { return { rng: (seed * 2654435761) >>> 0 || 1, lastBuildDay: -99, noRoom: 0, stalls: {} }; }

function roll(m: BotMemo): number {
  m.rng = (m.rng + 0x6d2b79f5) >>> 0;
  let t = m.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** stable coin toss per thing: the careless player ignores the same half for good */
function skips(key: string): boolean {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100) < 50;
}

const rankIdx = (r: RankId): number => RANK_ORDER.indexOf(r);
function unlocked(s: GameState, bt: BuildingType): boolean {
  for (let i = 0; i <= rankIdx(s.realm.rank); i++) if (RANKS[RANK_ORDER[i]!].buildings.includes(bt)) return true;
  return false;
}
function note(m: BotMemo, why: string): void { m.stalls[why] = (m.stalls[why] ?? 0) + 1; }

const PREFER: Partial<Record<string, DecisionOption[]>> = {
  applicant: ['accept'],
  eviction_ready: ['evict', 'cash_for_keys'],
  repair: ['fix', 'patch'],
  move_out_deposit: ['fair', 'return_all'],
  squatters: ['oust', 'bribe'],
  pet: ['pet_rent', 'allow'],
  rent_renewal: ['hold'],
};

function resolve(sim: Sim, inc: Incident): boolean {
  const s = sim.state;
  const def = defOf(inc);
  if (!def) return false;
  let prefer: DecisionOption[] = PREFER[def.decision] ?? [];
  if (def.decision === 'late_rent') {
    const t = inc.tenantId ? s.tenants[inc.tenantId] : null;
    const rent = t?.lease?.rent ?? 10;
    prefer = t && t.arrears > rent * 3.5 && s.renown >= 50 ? ['notice', 'payment_plan'] : t && t.daysLate > 12 ? ['payment_plan', 'wait'] : ['late_fee', 'wait'];
  }
  if (def.decision === 'eviction_ready' && s.renown < 48) prefer = ['cash_for_keys', 'mercy', 'evict'];
  if (def.decision === 'rent_renewal') {
    const t = inc.tenantId ? s.tenants[inc.tenantId] : null;
    const home = t?.buildingId ? s.buildings[t.buildingId] : null;
    const mr = home ? marketRent(s, home) : 0;
    const cur = t?.lease?.rent ?? 0;
    prefer = mr > 0 && cur < mr * 0.93 && (t?.happiness ?? 0) >= 50 ? ['raise', 'hold'] : mr > 0 && cur > mr * 1.15 ? ['lower', 'hold'] : ['hold'];
  }
  const order = [
    ...prefer.map(o => def.outcomes.find(x => x.option === o)),
    def.outcomes.find(o => o.default),
    ...def.outcomes,
  ];
  for (const o of order) {
    if (!o) continue;
    if ((o.job?.cost ?? 0) > s.gold) continue;
    if (sim.dispatch({ type: 'resolve_incident', incidentId: inc.id, outcomeId: o.id }).ok) return true;
  }
  return false;
}

function findSpot(s: GameState, bt: BuildingType, near: [number, number]): { x: number; y: number; rot: 0 | 1 | 2 | 3 } | null {
  let best: { x: number; y: number; rot: 0 | 1 | 2 | 3 } | null = null;
  let bestD = 1e9;
  const def = BUILDINGS[bt];
  for (const p of s.map.parcels) {
    if (!p.owned) continue;
    for (let y = p.y; y < p.y + 8 && y < MAP_H; y++) for (let x = p.x; x < p.x + 8 && x < MAP_W; x++) {
      for (const rot of (def.w === def.h ? [0] : [0, 1]) as (0 | 1)[]) {
        const d = Math.abs(x + def.w / 2 - near[0]) + Math.abs(y + def.h / 2 - near[1]) + ((x + y) % 3 === 0 ? 0 : 0.6);
        if (d >= bestD) continue;
        if (!canPlace(s, bt, x, y, rot).ok) continue;
        best = { x, y, rot }; bestD = d;
      }
    }
  }
  return best;
}

function seat(s: GameState): Building | null { return Object.values(s.buildings).find(b => b.type === 'seat') ?? null; }
function count(s: GameState, bt: BuildingType): number { return Object.values(s.buildings).filter(b => b.type === bt).length; }

function place(sim: Sim, m: BotMemo, bt: BuildingType, near?: [number, number]): boolean {
  const s = sim.state;
  const st = seat(s);
  const c: [number, number] = near ?? (st ? [st.x + 1.5, st.y + 1.5] : [MAP_W / 2, MAP_H / 2]);
  const spot = findSpot(s, bt, c);
  if (!spot) { m.noRoom++; return false; }
  const r = sim.dispatch({ type: 'place_building', btype: bt, x: spot.x, y: spot.y, rot: spot.rot });
  if (r.ok) { m.lastBuildDay = s.day; m.noRoom = 0; }
  return r.ok;
}

function housingCentre(s: GameState): [number, number] | undefined {
  const hs = Object.values(s.buildings).filter(b => b.units.length > 0);
  if (!hs.length) return undefined;
  return [hs.reduce((a, b) => a + b.x + b.w / 2, 0) / hs.length, hs.reduce((a, b) => a + b.y + b.h / 2, 0) / hs.length];
}

/** One day's worth of attention. Call once per game day, before advancing. */
export function playDay(sim: Sim, opts: BotOpts, m: BotMemo): void {
  const s = sim.state;
  if (s.ended) return;
  const careless = !!opts.careless;
  const act = (a: Action): boolean => sim.dispatch(a).ok;

  if (s.charter.ready) act({ type: 'accept_promotion' });

  // purses
  const purses = Object.values(s.buildings).some(b => b.units.some(u => u.purse > 0));
  if (purses && !careless) act({ type: 'collect_all' });
  else if (purses) {
    const mon = Math.floor(s.day / 30);
    for (const b of Object.values(s.buildings)) if (b.units.some(u => u.purse > 0) && !skips(b.id + ':' + mon) && roll(m) < 0.5) act({ type: 'collect_purse', buildingId: b.id });
  }

  // incidents
  for (const inc of Object.values(s.incidents)) {
    if (inc.state !== 'open') continue;
    if (careless && skips(inc.id)) continue;
    resolve(sim, inc);
  }

  // applicants at the door
  for (const ap of Object.values(s.applicants)) {
    if (ap.shown) continue;
    if (careless && roll(m) < 0.7) continue;
    act({ type: 'order_job', kind: 'show', applicantId: ap.id, role: 'any' });
  }

  const trib = nextTribute(s);
  const wages = Object.values(s.staff).reduce((a, x) => a + x.wage, 0);
  const reserve = (trib.day - s.day < 40 ? trib.amount : Math.round(trib.amount * 0.6)) + wages + 15;

  // mending
  {
    const mon = Math.floor(s.day / 30);
    const worn = Object.values(s.buildings).filter(b => b.state === 'ready' && b.condition < (careless ? 45 : 68) && !(careless && skips('r' + b.id + ':' + Math.floor(mon / 6)))).sort((a, b) => a.condition - b.condition);
    for (const b of worn) {
      if (Object.values(s.jobs).some(j => (j.kind === 'repair' || j.kind === 'renovate') && j.buildingId === b.id && j.state !== 'done' && j.state !== 'cancelled')) continue;
      if (s.gold < 15) break;
      act({ type: 'order_job', kind: 'repair', buildingId: b.id });
    }
  }

  // asking rents near market on empty units
  const dom = Math.floor(s.day) % 30;
  if (dom === 2 || dom === 16) {
    for (const b of Object.values(s.buildings)) {
      if (b.state !== 'ready' || !b.units.some(u => !u.tenantId)) continue;
      const mr = marketRent(s, b);
      const want = Math.max(1, Math.round(mr));
      if (mr > 0 && Math.abs(b.rent - want) >= 1) act({ type: 'set_rent', buildingId: b.id, rent: want });
      if (b.units.some(u => !u.tenantId && !u.listed)) act({ type: 'set_listed', buildingId: b.id, listed: true });
    }
  }

  // loans: pay down when flush
  const debt = debtOf(s);
  if (debt > 0 && s.gold > reserve + 60) act({ type: 'repay_loan', amount: Math.min(debt, Math.floor(s.gold - reserve - 40)) });

  // staff at Knight and above
  if (rankIdx(s.realm.rank) >= 1 && debt === 0) {
    const roles: [string, BuildingType][] = [['bailiff', 'bailiffs_post'], ['mason', 'masons_yard'], ['crier', 'criers_stand'], ['steward', 'counting_house']];
    for (const [role, bt] of roles) {
      if (!unlocked(s, bt)) continue;
      const have = Object.values(s.staff).some(x => x.role === role);
      if (have) continue;
      if (count(s, bt) === 0) {
        if (s.gold >= BUILDINGS[bt].cost + reserve + 20) { place(sim, m, bt); }
        break;
      }
      const yard = Object.values(s.buildings).find(b => b.type === bt);
      if (!yard || yard.state !== 'ready') continue;
      const cands = s.candidates.filter(c => c.role === role).sort((a, b) => (b.skill * 10 - b.wage) - (a.skill * 10 - a.wage));
      const rollNow = Object.values(s.tenants).reduce((a, t) => a + (t.status === 'housed' ? t.lease?.rent ?? 0 : 0), 0);
      if (cands[0] && wages + cands[0].wage <= rollNow * 0.3 + 6) act({ type: 'hire', candidateId: cands[0].id });
      else if (cands[0]) note(m, 'cannot afford staff');
    }
  }

  // renown: a feast when it is short of the charter and the coffers allow
  const renownGoal = s.charter.goals.find(g => g.id.endsWith('renown'));
  const fc = feastCost(s);
  if (!careless && renownGoal && (s.renown < renownGoal.target + 2 || s.gold > fc * 8) && feastWaitDays(s) <= 0 && s.gold > fc + reserve + 30) act({ type: 'hold_feast' });

  // building
  const building = Object.values(s.buildings).filter(b => b.state === 'building');
  let vacant = 0;
  for (const b of Object.values(s.buildings)) {
    if (b.units.length === 0 || BUILDINGS[b.type].category !== 'housing') continue;
    vacant += b.state === 'building' ? b.units.length : b.units.filter(u => !u.tenantId).length;
  }
  const households = Object.values(s.tenants).filter(t => t.status === 'housed').length;
  const maxBuilds = rankIdx(s.realm.rank) >= 1 ? 2 : 1;
  if (building.length < maxBuilds && debt === 0) {
    const centre = housingCentre(s);
    const budget = s.gold - reserve;
    let want: BuildingType | null = null;
    if (unlocked(s, 'well') && count(s, 'well') < 1 + Math.floor(households / 14) && households >= 4) want = 'well';
    else if (unlocked(s, 'notice_board') && count(s, 'notice_board') === 0 && households >= 3) want = 'notice_board';
    else if (unlocked(s, 'garden') && count(s, 'garden') < 1 + Math.floor(households / 12) && households >= 5) want = 'garden';
    else if (unlocked(s, 'shrine') && count(s, 'shrine') < Math.floor(households / 16) + (households >= 9 ? 1 : 0)) want = 'shrine';
    if (want && budget >= BUILDINGS[want].cost) { place(sim, m, want, centre); return; }

    const roll0 = Object.values(s.tenants).reduce((a, t) => a + (t.status === 'housed' ? t.lease?.rent ?? 0 : 0), 0);
    const slack = rankIdx(s.realm.rank) >= 1 ? Math.max(2, Math.floor(households * 0.07)) : 1;
    if (vacant <= slack) {
      const opts2 = BUILDING_LIST.filter(d => d.category === 'housing' && unlocked(s, d.id) && !d.only?.length)
        .filter(d => d.cost <= Math.max(budget, 70 + roll0 * 2.5))
        .map(d => ({ d, score: d.baseRent * d.units - d.upkeep }))
        .sort((a, b) => b.score - a.score);
      // best payback first; fall back to the best thing the coffers can meet after a wait
      const best = opts2[0]?.d;
      const affordable = opts2.find(o => o.d.cost <= budget)?.d;
      const pickType = best && best.cost <= budget ? best : (s.day - m.lastBuildDay > 75 ? affordable : null);
      if (pickType) {
        if (!place(sim, m, pickType.id, centre)) {
          // out of room: buy the cheapest parcel that marches with the land, else clear
          const ps = s.map.parcels.filter(p => !p.owned).sort((a, b) => a.price - b.price);
          let bought = false;
          for (const p of ps) { if (p.price <= s.gold - reserve && act({ type: 'buy_parcel', parcelId: p.id })) { bought = true; break; } }
          if (!bought) {
            if (!act({ type: 'order_job', kind: 'clear_land' })) note(m, 'no room');
          }
        }
      } else if (best) note(m, 'saving to build');
    }
  }
}
