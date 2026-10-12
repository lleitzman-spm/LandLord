/**
 * OWNER: render-figures agent. Town life: the cosmetic figures of housed
 * households, living a day across the month.
 *
 * Dawn brings them to the door (a purse out on Rent Day keeps the head of the
 * house beside it until the collector has been). Through the day they run
 * errands with somewhere to go and something to do there: the well, a stall,
 * the tavern, the fields, their own shop if they lease one. They stop in pairs
 * to gossip, sit, sweep, pray, read the board and have opinions about the
 * statue. Dusk sends them home and night keeps them in. They scatter from
 * griffins and fires, cheer feasts, shake a fist at the bailiff, bow to the
 * ruler if they feel like it, and look up when chosen. New households walk in
 * from the gate with a sack; the departing walk out.
 *
 * None of this is known to the sim. Movement keeps the sim's clock (env.speed),
 * feelings run in real time. Nothing here allocates per frame.
 */
import * as THREE from 'three';
import type { RenderCtx, Env, FigureSpec } from './api';
import { MAP_W, type GameState, type SimEvent, type Id, type Tenant, type MoveOutReason } from '../sim/types';
import type { AnimId, BuildingType, EmoteId, TradeId, VisualId } from '../data/ids';
import { BUILDINGS } from '../data/buildings';
import { createLivingFigure, defaultProp, type LivingFigure, type PropId } from './figures';
import { Nav, HALF_W, HALF_H, frontOf } from './figures/nav';
import { pickFigure, popScale } from './figures/crowd';
import { Rng, clamp, hashStr } from './figures/util';

export interface LayerHelpers {
  /** world-space point just outside a building's door (null if unknown) */
  doorOf(buildingId: Id): THREE.Vector3 | null;
  /** world-space top-centre of a building (for perching, looking at) */
  topOf(buildingId: Id): THREE.Vector3 | null;
  /** world-space position of a table prop (the coffer...) */
  propPos(prop: 'coffer' | 'ledger' | 'charter'): THREE.Vector3;
}
export interface FigureLayer {
  reset(state: GameState): void;
  sync(state: GameState): void;
  handleEvents(events: SimEvent[], state: GameState): void;
  update(env: Env): void;
  /** world position of the figure's head top, for pins and bubbles (null if not on the table) */
  positionOf(id: Id): THREE.Vector3 | null;
  /** nearest figure hit by the ray, as its id (tenant id for townsfolk, actor id for actors) */
  pick(raycaster: THREE.Raycaster): Id | null;
  setSelected(id: Id | null): void;
  dispose(): void;
}

// ───────────── tuning ─────────────

/** how many townsfolk the table carries, by quality (sim actors are on top of this) */
const CAP = { low: 48, medium: 76, high: 100 } as const;
/** the clock used here: 0 at first light, so a day never straddles the wrap. c = (monthPhase + DAWN) mod 1 */
const DAWN = 0.015;
const C_PURSE_END = 0.14, C_HURRY = 0.79, C_DEEP_NIGHT = 0.87, C_LOCKUP = 0.9;
const PATH_MAX = 48;

const ST_INSIDE = 0, ST_EMERGE = 1, ST_ENTER = 2, ST_WALK = 3, ST_DWELL = 4, ST_GOSSIP = 5, ST_REACT = 6, ST_FOLLOW = 7, ST_VANISH = 8;
/** what a walk leads to */
const NX_DWELL = 0, NX_HOME_IN = 1, NX_HOME_STEP = 2, NX_VANISH = 3, NX_COWER = 4;
/** what a dwell leads to */
const TH_HOME_IN = 0, TH_HOME_STEP = 1, TH_CHOOSE = 2, TH_ENTER = 3;

const E_STEP = 0, E_WELL = 1, E_SHOP = 2, E_TAVERN = 3, E_GARDEN = 4, E_HOLY = 5, E_BOARD = 6, E_STATUE = 7, E_STOCKS = 8, E_FIELD = 9,
  E_STROLL = 10, E_VISIT = 11, E_PATROL = 12, E_WOODS = 13, E_PERFORM = 14, E_OWNSHOP = 15, E_PLAY = 16, E_SEAT = 17, E_N = 18;

const P_WELL = 0, P_SHOP = 1, P_TAVERN = 2, P_GARDEN = 3, P_HOLY = 4, P_BOARD = 5, P_STATUE = 6, P_STOCKS = 7, P_TOWER = 8, P_SEAT = 9, P_N = 10;
const POI_CAT: Partial<Record<BuildingType, number>> = {
  well: P_WELL, market_stall: P_SHOP, bakery: P_SHOP, smithy: P_SHOP, mill: P_SHOP, apothecary: P_SHOP, tavern: P_TAVERN, garden: P_GARDEN,
  chapel: P_HOLY, shrine: P_HOLY, notice_board: P_BOARD, statue: P_STATUE, stocks: P_STOCKS, watchtower: P_TOWER, seat: P_SEAT,
};
/** things on a building that send people running, and how near is too near (tiles) */
const THREAT: Partial<Record<VisualId, number>> = { fire: 3.3, griffin_roof: 2.5, small_dragon: 2.3, bees: 1.9, curse_cloud: 2.0 };
const WARES: Partial<Record<TradeId, PropId>> = { fishmonger: 'fish', cheesemonger: 'cheese', candlemaker: 'candle', baker: 'loaf', miller: 'sack', alchemist: 'flask', hedge_witch: 'flask', brewer: 'mug', innkeeper: 'mug' };

interface Poi {
  id: Id; type: BuildingType; cat: number;
  cx: number; cy: number; fx: number; fy: number; ex: number; ey: number; x0: number; y0: number; w: number; h: number; top: number;
  keeper: Id | null; keeperTrade: TradeId | null;
}
interface Threat { id: Id; kind: VisualId; x: number; y: number; top: number; r: number }

interface Person {
  key: string; tenantId: Id; role: number; idx: number;
  fig: LivingFigure; rng: Rng; baseProp: PropId; trade: TradeId | null; child: boolean;
  buildingId: Id; unit: number; keeper: boolean; shopType: BuildingType | null;
  doorX: number; doorY: number; inX: number; inY: number; face: number; stepX: number; stepY: number;
  x: number; y: number; heading: number;
  /** a small shuffle still to make, so two people do not stand in one another */
  nx: number; ny: number;
  path: Float32Array; pathN: number; pathI: number; laneX: number; laneY: number;
  pace: number; hurry: number; moodK: number; mood: number; owing: boolean;
  st: number; prevSt: number; t: number; rT: number; pop: number; next: number;
  eKind: number; eAnim: AnimId; eAnim2: AnimId | null; eAlt: number; eProp: PropId | null; eTake: PropId | null; eSit: boolean; eChat: boolean; ePerf: boolean;
  eLook: boolean; eLookX: number; eLookY: number; eLookH: number; eThen: number; eStage: number;
  carry: PropId | null; sleepwalk: boolean;
  partner: Person | null; talking: boolean; talkT: number;
  leader: Person | null; gap: number;
  cdGossip: number; cdGreet: number; cdFist: number; cdGlance: number; glanceT: number; aware: number; cdWave: number; cdWatch: number;
  /** dangers already run from (a griffin is only a shock once); fire is never got used to */
  calm: Id[]; calmDay: number;
  wakeC: number; stepC: number; homeC: number; nightDone: number;
  leaving: number; reason: MoveOutReason | null; walked: number; lookBack: number;
  arriving: boolean; away: boolean; awayMark: boolean; selected: boolean; born: number; dead: boolean;
  nocturnal: boolean; sleeper: boolean; pious: boolean; gossipy: boolean; musician: boolean; elder: boolean;
}

/** The town-life layer, with a window for dev pages and tests (not part of the contract). */
export interface TownLifeLayer extends FigureLayer {
  debug: {
    /** how many are doing what: inside, emerge, enter, walk, dwell, gossip, react, follow, vanish, total, households */
    census(): Record<string, number>;
    /** every figure on the table: key, state name, tile position, current animation */
    each(cb: (key: string, st: string, x: number, y: number, anim: string, shown: boolean) => void): void;
  };
}
const ST_NAMES = ['inside', 'emerge', 'enter', 'walk', 'dwell', 'gossip', 'react', 'follow', 'vanish'];

export function createTownLife(ctx: RenderCtx, h: LayerHelpers): TownLifeLayer {
  const root = new THREE.Group(); root.name = 'townlife';
  ctx.scene.add(root);
  const nav = new Nav();
  const people: Person[] = [];
  const heads = new Map<Id, Person>();
  const houses = new Map<Id, Person[]>();
  const pois: Poi[] = [];
  const byCat: Poi[][] = []; for (let i = 0; i < P_N; i++) byCat.push([]);
  const threats: Threat[] = [];
  const W = new Float32Array(E_N);
  const _pos = new THREE.Vector3();
  let state: GameState | null = null;
  let navDirty = true, townDirty = true, tick = 0, clockT = 0, feastT = 0, selectedId: Id | null = null;
  let c = 0.3, gs = 1, badWeather = 0, monthNo = 0, speedNow = 1;
  // who is abroad on the sim's business (tile space; NaN = nobody)
  let rulerX = NaN, rulerY = NaN, bailX = NaN, bailY = NaN, colN = 0;
  const colX = new Float32Array(4), colY = new Float32Array(4);
  let disposed = false;

  // ───────────── the lie of the land ─────────────

  function surveyTown(s: GameState): void {
    nav.build(s);
    pois.length = 0; for (const l of byCat) l.length = 0;
    for (const id in s.buildings) {
      const b = s.buildings[id]!;
      const cat = POI_CAT[b.type];
      if (cat === undefined || b.state !== 'ready') continue;
      const f = frontOf(b.rot), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      let ex = Math.floor(cx + f[0] * (b.w / 2 + 0.5)) + 0.5, ey = Math.floor(cy + f[1] * (b.h / 2 + 0.5)) + 0.5;
      if (!nav.walkable(ex, ey)) { const n = nav.nearest(ex, ey); if (n >= 0) { ex = (n % MAP_W) + 0.5; ey = Math.floor(n / MAP_W) + 0.5; } }
      const tenant = b.units[0]?.tenantId ? s.tenants[b.units[0].tenantId] : null;
      const top = h.topOf(b.id);
      const p: Poi = { id: b.id, type: b.type, cat, cx, cy, fx: f[0], fy: f[1], ex, ey, x0: b.x, y0: b.y, w: b.w, h: b.h, top: top ? top.y : 1.2,
        keeper: tenant && tenant.status === 'housed' ? tenant.id : null, keeperTrade: tenant ? tenant.trade : null };
      pois.push(p); byCat[cat]!.push(p);
    }
    surveyThreats(s);
    for (const p of people) if (!p.leaving) homeOf(p, s);
    navDirty = false; townDirty = false;
  }

  function surveyThreats(s: GameState): void {
    threats.length = 0;
    for (const id in s.buildings) {
      const b = s.buildings[id]!;
      if (!b.visuals.length) continue;
      for (const v of b.visuals) {
        const r = THREAT[v];
        if (r === undefined) continue;
        const top = h.topOf(b.id);
        threats.push({ id: b.id, kind: v, x: b.x + b.w / 2, y: b.y + b.h / 2, top: top ? top.y : 1.4, r: r + Math.max(0, Math.max(b.w, b.h) - 2) * 0.5 });
        break;
      }
    }
  }

  /** work out where this person's door is: the spot outside it, the spot inside it, which way it faces */
  function homeOf(p: Person, s: GameState): void {
    const b = s.buildings[p.buildingId];
    if (!b) return;
    const f = frontOf(b.rot), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const half = f[0] !== 0 ? b.w / 2 : b.h / 2;
    let dx = cx + f[0] * (half + 0.3), dy = cy + f[1] * (half + 0.3);
    const d = h.doorOf(b.id);
    if (d) { dx = d.x + HALF_W; dy = d.z + HALF_H; }
    const n = b.units.length;
    const px = f[1], py = -f[0];                       // the wall's own left-to-right
    if (n > 1) { const wide = b.rot % 2 ? b.h : b.w, k = (p.unit - (n - 1) / 2) * Math.min(0.7, (wide - 0.5) / n); dx += px * k; dy += py * k; }
    // never stand in the wall
    const out = (dx - cx) * f[0] + (dy - cy) * f[1];
    if (out < half + 0.26) { dx += f[0] * (half + 0.26 - out); dy += f[1] * (half + 0.26 - out); }
    let ix = dx - f[0] * 0.5, iy = dy - f[1] * 0.5;
    p.face = Math.atan2(f[0], f[1]);
    if (!nav.walkable(dx, dy)) {
      // something has been built across the door: the household uses the nearest free ground, as people do
      const n = nav.nearest(dx, dy);
      if (n >= 0) {
        const ex = (n % MAP_W) + 0.5, ey = Math.floor(n / MAP_W) + 0.5;
        const ux = cx - ex, uy = cy - ey, ul = Math.hypot(ux, uy) || 1;
        dx = ex + ux / ul * 0.2; dy = ey + uy / ul * 0.2;
        ix = ex + ux / ul * 0.62; iy = ey + uy / ul * 0.62;
        p.face = Math.atan2(-ux, -uy);
      }
    }
    p.doorX = dx; p.doorY = dy;
    p.inX = ix; p.inY = iy;
    // each of the household has their own bit of step
    const side = p.idx === 0 ? 0.36 : p.idx === 1 ? -0.36 : p.idx === 2 ? 0.14 : -0.2, fwd = p.idx > 1 ? 0.44 : 0.06;       // the small ones in front
    p.stepX = dx + px * side + f[0] * fwd; p.stepY = dy + py * side + f[1] * fwd;
    if (!nav.walkable(p.stepX, p.stepY)) { p.stepX = dx + f[0] * 0.1; p.stepY = dy + f[1] * 0.1; }
    const def = BUILDINGS[b.type];
    p.keeper = p.role === 0 && def.category === 'commercial';
    p.shopType = p.keeper ? b.type : null;
  }

  // ───────────── the cast ─────────────

  function makePerson(t: Tenant, role: number, idx: number, s: GameState): Person | null {
    const spec: FigureSpec = role === 0 ? { species: t.species, trade: t.trade, seed: t.portraitSeed }
      : role === 1 ? { species: t.species, seed: (t.portraitSeed * 31 + 17 + idx * 7) | 0 }
      : { species: t.species, seed: (t.portraitSeed * 57 + idx * 101) | 0, child: true };
    let fig: LivingFigure;
    try { fig = createLivingFigure(spec, ctx); } catch { return null; }
    const seed = (hashStr(t.id) ^ Math.imul(idx + 1, 0x9e3779b1)) | 0;
    const rng = new Rng(seed);
    const child = role === 2;
    const sp = t.species;
    const pace = (child ? 1.35 : sp === 'elf' ? 1.22 : sp === 'ogre' ? 1.0 : sp === 'human' ? 1.08 : 0.96) * rng.range(0.9, 1.12);
    const has = (id: string) => t.traits.includes(id as never);
    const p: Person = {
      key: t.id + ':' + idx, tenantId: t.id, role, idx, fig, rng, baseProp: role === 0 ? defaultProp({ trade: t.trade }) : 'none', trade: role === 0 ? t.trade : null, child,
      buildingId: t.buildingId!, unit: t.unit, keeper: false, shopType: null,
      doorX: 0, doorY: 0, inX: 0, inY: 0, face: 0, stepX: 0, stepY: 0,
      x: 0, y: 0, heading: 0, nx: 0, ny: 0,
      path: new Float32Array(PATH_MAX * 2), pathN: 0, pathI: 0, laneX: rng.range(-0.2, 0.2), laneY: rng.range(-0.2, 0.2),
      pace, hurry: 1, moodK: 1, mood: 0.6, owing: false,
      st: ST_INSIDE, prevSt: ST_INSIDE, t: 0, rT: 0, pop: 0, next: NX_DWELL,
      eKind: E_STEP, eAnim: 'idle', eAnim2: null, eAlt: 2, eProp: null, eTake: null, eSit: false, eChat: false, ePerf: false,
      eLook: false, eLookX: 0, eLookY: 0, eLookH: NaN, eThen: TH_CHOOSE, eStage: 0,
      carry: null, sleepwalk: false,
      partner: null, talking: false, talkT: 0,
      leader: null, gap: 0.5,
      cdGossip: rng.range(2, 10), cdGreet: rng.range(0, 6), cdFist: 0, cdGlance: rng.range(0, 4), glanceT: 0, aware: rng.next() * 0.3, cdWave: 0, cdWatch: 0,
      calm: [], calmDay: -1e9,
      wakeC: child ? rng.range(0.012, 0.06) : rng.range(0.002, 0.045), stepC: rng.range(0.055, 0.1), homeC: child ? rng.range(0.675, 0.72) : rng.range(0.7, 0.765), nightDone: -1,
      leaving: 0, reason: null, walked: 0, lookBack: 0,
      arriving: false, away: false, awayMark: false, selected: false, born: clockT, dead: false,
      nocturnal: role === 0 && has('nocturnal'), sleeper: role === 0 && has('sleepwalker'), pious: has('pious'), gossipy: has('gossip'), musician: role === 0 && (has('musician') || t.trade === 'bard'),
      elder: role === 0 && t.tags.includes('elder'),
    };
    homeOf(p, s);
    p.x = p.inX; p.y = p.inY; p.heading = p.face;
    fig.group.visible = false; fig.group.scale.setScalar(0.001);
    fig.setHeading(p.face, true);
    root.add(fig.group);
    feel(p, t);
    return p;
  }

  /** happiness into bearing */
  function feel(p: Person, t: Tenant): void {
    let m = clamp(t.happiness / 100, 0, 1);
    if (t.lateStage === 'noticed' || t.lateStage === 'court' || t.lateStage === 'writ') m = Math.min(m, 0.3);
    if (p.child) m = Math.min(1, m * 0.6 + 0.42);          // children take things less to heart
    if (p.leaving === 2) m = 0.06;
    if (Math.abs(m - p.mood) > 0.01 || p.born === clockT) { p.mood = m; p.fig.setMood(m); }
    p.moodK = m < 0.3 ? 0.8 : m > 0.8 ? 1.08 : 1;
    p.owing = t.arrears > 0 || t.lateStage !== 'none';
  }

  function spawnHousehold(t: Tenant, s: GameState, arrive: boolean, initial: boolean): void {
    if (houses.has(t.id) || !t.buildingId || !s.buildings[t.buildingId]) return;
    const cap = CAP[ctx.quality] ?? CAP.high;
    if (people.length >= cap + 12) return;
    const list: Person[] = [];
    const head = makePerson(t, 0, 0, s);
    if (!head) return;
    list.push(head);
    // who else is under the roof
    const n = clamp(t.household | 0, 1, 7);
    const widow = t.tags.includes('widow'), elder = t.tags.includes('elder'), wed = t.tags.includes('newlyweds');
    let partner = n >= 2 && !widow, kids = wed || elder ? 0 : n >= 5 ? 2 : n >= 3 ? 1 : 0;
    if (widow && n >= 2) kids = Math.max(kids, 1);
    if (BUILDINGS[s.buildings[t.buildingId]?.type ?? 'hovel'].category === 'commercial') { kids = Math.min(kids, 1); }
    let idx = 1;
    if (partner && people.length + list.length < cap) { const q = makePerson(t, 1, idx, s); if (q) { list.push(q); idx++; } } else partner = false;
    for (let k = 0; k < kids && people.length + list.length < cap; k++) { const q = makePerson(t, 2, idx, s); if (q) { list.push(q); idx++; } }
    houses.set(t.id, list); heads.set(t.id, head);
    for (const p of list) people.push(p);
    if (t.id === selectedId) { head.selected = true; head.fig.setSelected(true); }
    if (arrive) { beginArrival(list); return; }
    for (const p of list) {
      p.t = initial ? p.rng.range(0, 5) : p.rng.range(0.4, 1.6);
      if (initial && c >= p.stepC && c < p.homeC - 0.05 && badWeather < 2 && p.rng.chance(0.62)) {
        // the reign is already under way: find them somewhere along their morning
        appear(p, p.stepX, p.stepY);
        chooseErrand(p);
        if (p.st === ST_WALK) { advance(p, p.rng.next() * pathLength(p)); if (p.pathI >= p.pathN) onArrive(p); }
      }
    }
  }

  function appear(p: Person, x: number, y: number): void {
    p.x = x; p.y = y; p.pop = 1; p.fig.group.visible = true; p.fig.group.scale.setScalar(1);
  }

  function removePerson(p: Person): void {
    if (p.dead) return;
    p.dead = true;
    if (p.partner) endGossip(p);
    p.fig.dispose();
    const i = people.indexOf(p);
    if (i >= 0) people.splice(i, 1);
    const list = houses.get(p.tenantId);
    if (list) {
      const k = list.indexOf(p);
      if (k >= 0) list.splice(k, 1);
      for (const q of list) if (q.leader === p) q.leader = null;
      if (!list.length) { houses.delete(p.tenantId); heads.delete(p.tenantId); }
      else if (p.role === 0 && heads.get(p.tenantId) === p) heads.delete(p.tenantId);
    }
  }

  // ───────────── getting about ─────────────

  /** false when there is no way there (and `loose` was not asked for) */
  function pathTo(p: Person, x: number, y: number, loose = false): boolean {
    p.pathN = nav.find(p.x, p.y, x, y, p.path, loose); p.pathI = 0;
    return p.pathN > 0;
  }
  function pathHome(p: Person, toStep: boolean): void {
    // to the tile outside the door by the lanes, then straight up to the door itself
    const b = state ? state.buildings[p.buildingId] : null;
    let ex = p.doorX, ey = p.doorY;
    if (b) { const f = frontOf(b.rot); ex = p.doorX + f[0] * 0.35; ey = p.doorY + f[1] * 0.35; }
    p.pathI = 0;
    if (Math.abs(p.x - p.doorX) + Math.abs(p.y - p.doorY) < 1.7) p.pathN = 0;        // on the doorstep as good as: just step up
    else p.pathN = nav.find(p.x, p.y, ex, ey, p.path);
    if (p.pathN < PATH_MAX) { p.path[p.pathN * 2] = toStep ? p.stepX : p.doorX; p.path[p.pathN * 2 + 1] = toStep ? p.stepY : p.doorY; p.pathN++; }
  }
  function pathLength(p: Person): number {
    let len = 0, ax = p.x, ay = p.y;
    for (let i = p.pathI; i < p.pathN; i++) { const bx = p.path[i * 2]!, by = p.path[i * 2 + 1]!; len += Math.hypot(bx - ax, by - ay); ax = bx; ay = by; }
    return len;
  }
  /** move along the path by `step` tiles; true when the end is reached */
  function advance(p: Person, step: number): boolean {
    while (step > 0 && p.pathI < p.pathN) {
      const last = p.pathI === p.pathN - 1;
      const tx = p.path[p.pathI * 2]! + (last ? 0 : p.laneX), ty = p.path[p.pathI * 2 + 1]! + (last ? 0 : p.laneY);
      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
      if (d > 1e-4) p.heading = Math.atan2(dx, dy);
      if (d <= step) { p.x = tx; p.y = ty; p.pathI++; step -= d; }
      else { p.x += dx / d * step; p.y += dy / d * step; p.walked += step; step = 0; }
    }
    return p.pathI >= p.pathN;
  }

  function walk(p: Person, next: number, hurry = 1): void {
    if (p.partner) endGossip(p);
    p.st = ST_WALK; p.next = next; p.hurry = hurry;
    p.fig.setSit(false);
    if (!p.selected) p.fig.lookAt(null);
  }
  function setProp(p: Person, prop: PropId | null): void { p.fig.setProp(prop ?? p.baseProp); }

  function goHome(p: Person, inside: boolean, hurry = 1): void {
    const fire = fireAt(p.buildingId);
    if (fire) {
      // not while it burns: stand off and watch
      dwell(p, 'idle', p.rng.range(1.8, 3), TH_CHOOSE);
      p.eLook = true; p.eLookX = fire.x; p.eLookY = fire.y; p.eLookH = fire.top * 0.7;
      p.heading = Math.atan2(fire.x - p.x, fire.y - p.y); look(p, fire.x, fire.y, p.eLookH);
      if (p.rng.chance(0.3)) p.fig.emote('sweat');
      return;
    }
    pathHome(p, !inside);
    walk(p, inside ? NX_HOME_IN : NX_HOME_STEP, hurry);
  }

  function startEmerge(p: Person): void {
    p.st = ST_EMERGE; p.pop = 0; p.x = p.inX; p.y = p.inY; p.heading = p.face;
    p.fig.group.visible = true; p.fig.setHeading(p.face, true); p.fig.setAnim('idle'); p.fig.setSit(false);
    p.carry = null; p.sleepwalk = false; setProp(p, null);
  }
  function startEnter(p: Person): void {
    if (p.partner) endGossip(p);
    p.st = ST_ENTER; p.fig.setSit(false); p.fig.setAnim('walk'); p.heading = p.face + Math.PI;
  }
  function vanish(p: Person): void {
    if (p.partner) endGossip(p);
    p.st = ST_VANISH;
  }

  // ───────────── things to do ─────────────

  function dwell(p: Person, anim: AnimId, dur: number, then: number): void {
    p.st = ST_DWELL; p.t = dur; p.eAnim = anim; p.eAnim2 = null; p.eAlt = 2.2; p.eProp = null; p.eTake = null; p.eSit = false; p.eChat = false; p.ePerf = false; p.eLook = false; p.eLookH = NaN; p.eThen = then; p.eStage = 0;
    p.fig.setAnim(anim); p.fig.setSit(false);
    if (!p.selected) p.fig.lookAt(null);
  }
  /** fill in the errand; the walk there is started by the caller */
  function plan(p: Person, kind: number, anim: AnimId, anim2: AnimId | null, dur: number, then: number): void {
    p.eKind = kind; p.eAnim = anim; p.eAnim2 = anim2; p.eAlt = p.rng.range(1.7, 2.8); p.t = dur * 1.4; p.eProp = null; p.eTake = null; p.eSit = false; p.eChat = false; p.ePerf = false;
    p.eLook = false; p.eLookH = NaN; p.eThen = then; p.eStage = 0;
  }
  function lookAtPoi(p: Person, q: Poi, up: boolean): void { p.eLook = true; p.eLookX = q.cx; p.eLookY = q.cy; p.eLookH = up ? q.top * 0.85 : NaN; }

  let _sx = 0, _sy = 0;
  /** a place to stand by a building: at its front, or anywhere round it */
  function spotBy(q: Poi, p: Person, front: boolean): void {
    if (!front) {
      for (let k = 0; k < 8; k++) {
        // a tile on the ring round the footprint
        const per = 2 * (q.w + q.h) + 4, at = Math.floor(p.rng.next() * per);
        let tx: number, ty: number;
        if (at < q.w + 2) { tx = q.x0 - 1 + at; ty = q.y0 - 1; }
        else if (at < 2 * (q.w + 2)) { tx = q.x0 - 1 + (at - (q.w + 2)); ty = q.y0 + q.h; }
        else if (at < 2 * (q.w + 2) + q.h) { tx = q.x0 - 1; ty = q.y0 + (at - 2 * (q.w + 2)); }
        else { tx = q.x0 + q.w; ty = q.y0 + (at - 2 * (q.w + 2) - q.h); }
        if (!nav.walkable(tx + 0.5, ty + 0.5)) continue;
        const dx = q.cx - (tx + 0.5), dy = q.cy - (ty + 0.5), d = Math.hypot(dx, dy) || 1;
        _sx = tx + 0.5 + dx / d * 0.24 + p.rng.range(-0.1, 0.1); _sy = ty + 0.5 + dy / d * 0.24 + p.rng.range(-0.1, 0.1);
        return;
      }
    }
    const k = p.rng.range(-0.36, 0.36);
    _sx = q.ex + q.fy * k - q.fx * 0.14; _sy = q.ey - q.fx * k - q.fy * 0.14;
    if (!nav.walkable(_sx, _sy)) { _sx = q.ex; _sy = q.ey; }
  }
  /** one of a kind, leaning toward the nearer */
  function poiNear(p: Person, cat: number, notOwn = false): Poi | null {
    const l = byCat[cat]!;
    if (!l.length) return null;
    let best: Poi | null = null, bd = Infinity;
    for (let k = 0; k < 2; k++) {
      const q = l[Math.floor(p.rng.next() * l.length)]!;
      if (notOwn && q.id === p.buildingId) continue;
      if (dangerAt(p, q.cx, q.cy)) continue;
      const d = Math.abs(q.cx - p.x) + Math.abs(q.cy - p.y);
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  }
  function dangerAt(p: Person, x: number, y: number): boolean {
    for (const th of threats) {
      if (th.id === p.buildingId && th.kind !== 'fire') continue;
      const r = th.r + 0.8;
      if ((x - th.x) * (x - th.x) + (y - th.y) * (y - th.y) < r * r) return true;
    }
    return false;
  }
  /** a walkable tile a little way off in a seeded direction (strolls, play, flight) */
  function spotAway(p: Person, ox: number, oy: number, min: number, max: number, dir = NaN, spread = Math.PI): boolean {
    for (let k = 0; k < 10; k++) {
      const a = dir === dir ? dir + p.rng.range(-spread, spread) * (k < 3 ? 0.35 : 1) : p.rng.next() * Math.PI * 2;
      const r = p.rng.range(min, max) * (k > 6 ? 0.6 : 1);
      const x = ox + Math.sin(a) * r, y = oy + Math.cos(a) * r;
      if (!nav.walkable(x, y) || dangerAt(p, x, y)) continue;
      _sx = Math.floor(x) + 0.5 + p.rng.range(-0.25, 0.25); _sy = Math.floor(y) + 0.5 + p.rng.range(-0.25, 0.25);
      return true;
    }
    return false;
  }

  function doorstep(p: Person): void {
    // a spell on the step: watch the lane, sit, sweep, or mind one's own trade
    const r = p.rng.next();
    dwell(p, 'idle', p.rng.range(2.6, 5.5), TH_CHOOSE);
    p.eKind = E_STEP; p.eChat = true;
    const tr = p.trade;
    if (p.child) { p.t = p.rng.range(0.8, 2); return; }
    if (p.elder && c > 0.3 && r < 0.4) { p.eAnim = 'sleep'; p.eSit = true; p.eChat = false; p.t = p.rng.range(5, 9); p.fig.setSit(true); p.fig.setAnim('sleep'); return; }
    if (r < 0.2) { p.eSit = true; p.fig.setSit(true); p.t = p.rng.range(4, 8); return; }
    if (r < 0.4 && p.mood > 0.25) { p.eAnim = 'sweep'; p.eProp = 'broom'; p.eChat = false; setProp(p, 'broom'); p.fig.setAnim('sweep'); p.t = p.rng.range(3.5, 6.5); return; }
    if (r < 0.75 && tr) {
      if (tr === 'wizard' || tr === 'scribe' || tr === 'tax_clerk' || tr === 'alchemist') {
        p.eAnim = 'read'; p.eChat = false; p.t = p.rng.range(4, 7);
        if (tr !== 'tax_clerk') { p.eProp = 'scroll'; setProp(p, 'scroll'); }
      }
      else if (tr === 'bard') { p.eAnim = 'dance'; p.ePerf = true; p.eChat = false; p.t = p.rng.range(4, 7); }
      else if (tr === 'blacksmith' || tr === 'carpenter') { p.eAnim = 'hammer'; p.eChat = false; p.t = p.rng.range(3.5, 6); }
      else if (tr === 'merchant' || tr === 'fortune_teller') { p.eAnim = 'count'; p.t = p.rng.range(3, 5); }
      p.fig.setAnim(p.eAnim);
    }
  }

  function chooseErrand(p: Person): void {
    if (!state) { doorstep(p); return; }
    p.carry = null; p.sleepwalk = false; p.hurry = 1;
    setProp(p, null);
    const late = c >= p.homeC;
    if (late || badWeather >= 2 || fireAt(p.buildingId)) { goHome(p, true, badWeather ? 1.7 : 1); return; }
    const atHome = Math.abs(p.x - p.doorX) + Math.abs(p.y - p.doorY) < 1.6;
    const w = W; w.fill(0);
    const tr = p.trade, eve = c > 0.5, wet = badWeather > 0;
    if (p.child) {
      w[E_PLAY] = 6; w[E_STEP] = atHome ? 1 : 0; w[E_WELL] = byCat[P_WELL]!.length ? 0.8 : 0; w[E_GARDEN] = byCat[P_GARDEN]!.length ? 1 : 0; w[E_STOCKS] = byCat[P_STOCKS]!.length ? 0.6 : 0;
    } else {
      w[E_STEP] = atHome ? 1.6 : 0.2;
      w[E_WELL] = byCat[P_WELL]!.length ? (state.weather === 'heat' ? 3.4 : 2) : 0;
      w[E_SHOP] = byCat[P_SHOP]!.length ? 2.3 : 0;
      w[E_TAVERN] = byCat[P_TAVERN]!.length ? (eve ? 2.8 : 0.5) : 0;
      w[E_GARDEN] = byCat[P_GARDEN]!.length ? 1.2 : 0;
      w[E_HOLY] = byCat[P_HOLY]!.length ? (p.pious ? 3 : 0.8) : 0;
      w[E_BOARD] = byCat[P_BOARD]!.length ? 0.8 : 0;
      w[E_STATUE] = byCat[P_STATUE]!.length ? 0.55 : 0;
      w[E_STOCKS] = byCat[P_STOCKS]!.length ? 0.4 : 0;
      w[E_STROLL] = 0.9;
      w[E_VISIT] = houses.size > 1 ? (p.gossipy ? 2 : 0.7) : 0;
      // things any household does, shops or no shops: firewood, a turn in the fields, a look down the road, a word at the seat
      w[E_WOODS] = nav.woodside.length ? 0.7 : 0;
      w[E_FIELD] = nav.fields.length ? 0.5 : 0;
      w[E_PATROL] = 0.35;
      w[E_SEAT] = byCat[P_SEAT]!.length ? (p.mood < 0.35 ? 1.1 : 0.45) : 0;
      if (p.musician) w[E_PERFORM] = 2.6;
      const fields = nav.fields.length > 0;
      switch (tr) {
        case 'farmer': w[E_FIELD] = fields ? 6 : 0; if (!fields) w[E_GARDEN]! *= 3; break;
        case 'laborer': w[E_FIELD] = fields ? 3 : 0; w[E_STROLL] = 1.5; break;
        case 'shepherd': w[E_WOODS] = nav.woodside.length ? 3.2 : 0; w[E_FIELD] = fields ? 1.5 : 0; break;
        case 'beekeeper': case 'herbalist': case 'hedge_witch': w[E_WOODS]! *= 3.5; w[E_GARDEN]! *= 2.5; break;
        case 'hunter': w[E_WOODS]! *= 7; break;
        case 'guard': w[E_PATROL] = 6; w[E_SHOP] = 0.6; break;
        case 'ratcatcher': case 'adventurer': w[E_PATROL] = 3; break;
        case 'gravedigger': w[E_HOLY] = byCat[P_HOLY]!.length ? 4 : 0; break;
        case 'bard': w[E_PERFORM] = 5; break;
        case 'wizard': case 'scribe': case 'tax_clerk': case 'alchemist': w[E_STEP] = atHome ? 3 : 0.3; break;
        case 'innkeeper': case 'brewer': w[E_TAVERN]! *= 2.2; break;
        default: break;
      }
      if (p.keeper) { for (let i = 0; i < E_N; i++) w[i] = w[i]! * 0.3; w[E_OWNSHOP] = 7; w[E_FIELD] = 0; w[E_WOODS] = 0; w[E_PATROL] = 0; }
      if (p.mood < 0.25) { w[E_TAVERN]! *= 1.8; w[E_STEP]! *= 1.6; w[E_PERFORM] = 0; }
      if (wet) { w[E_FIELD]! *= 0.2; w[E_STROLL] = 0; w[E_GARDEN]! *= 0.2; w[E_WOODS]! *= 0.2; w[E_TAVERN]! *= 2; w[E_PERFORM] = 0; w[E_PATROL]! *= 0.3; w[E_SEAT] = 0; }
    }
    let sum = 0; for (let i = 0; i < E_N; i++) sum += w[i]!;
    let roll = p.rng.next() * sum, kind = E_STEP;
    for (let i = 0; i < E_N; i++) { roll -= w[i]!; if (roll <= 0 && w[i]! > 0) { kind = i; break; } }
    if (!setErrand(p, kind)) {
      if (atHome) doorstep(p); else goHome(p, p.rng.chance(0.5));
    }
  }

  /** aim the person at an errand of this kind; false if there is nowhere to do it */
  function setErrand(p: Person, kind: number): boolean {
    const r = p.rng;
    const home = r.chance(0.4 * cosy()) ? TH_HOME_IN : r.chance(0.4) ? TH_HOME_STEP : TH_CHOOSE;
    let q: Poi | null = null;
    switch (kind) {
      case E_STEP:
        if (Math.abs(p.x - p.stepX) + Math.abs(p.y - p.stepY) > 0.4) { goHome(p, false); return true; }
        doorstep(p); return true;
      case E_WELL:
        if (!(q = poiNear(p, P_WELL))) return false;
        spotBy(q, p, false); plan(p, kind, 'idle', r.chance(0.4) ? 'talk' : null, r.range(3, 6), home); p.eChat = true; lookAtPoi(p, q, false);
        if (r.chance(0.22)) { p.eSit = true; p.t += 2; }
        break;
      case E_SHOP: {
        if (!(q = poiNear(p, P_SHOP, true))) return false;
        spotBy(q, p, true); plan(p, kind, 'talk', r.chance(0.6) ? 'count' : 'point', r.range(3, 5.5), TH_HOME_IN); p.eChat = true; lookAtPoi(p, q, false);
        const ware = q.type === 'bakery' ? 'loaf' : q.type === 'mill' ? 'sack' : q.type === 'apothecary' ? 'flask' : q.type === 'smithy' ? null : (q.keeperTrade ? WARES[q.keeperTrade] : null) ?? 'basket';
        if (!q.keeper) return false;                 // nobody keeps it: shut
        p.eTake = ware;
        if (!p.eTake) p.eThen = home;
        break;
      }
      case E_TAVERN:
        if (!(q = poiNear(p, P_TAVERN, true))) return false;
        spotBy(q, p, r.chance(0.6)); plan(p, kind, 'talk', p.mood > 0.7 && r.chance(0.5) ? 'dance' : 'idle', r.range(7, 14), r.chance(0.3) ? TH_CHOOSE : TH_HOME_IN);
        p.eProp = 'mug'; p.eChat = true; lookAtPoi(p, q, false);
        break;
      case E_GARDEN:
        if (!(q = poiNear(p, P_GARDEN))) return false;
        spotBy(q, p, false); lookAtPoi(p, q, false);
        if (p.trade === 'farmer' || p.trade === 'herbalist' || p.trade === 'beekeeper' || r.chance(0.25)) { plan(p, kind, 'sweep', 'idle', r.range(5, 9), home); p.eProp = p.trade === 'farmer' ? null : 'shovel'; }
        else { plan(p, kind, 'idle', null, r.range(4, 8), home); p.eSit = r.chance(0.6); p.eChat = true; }
        break;
      case E_HOLY:
        if (!(q = poiNear(p, P_HOLY))) return false;
        spotBy(q, p, q.type === 'chapel'); lookAtPoi(p, q, false);
        if (p.trade === 'gravedigger' && r.chance(0.7)) { plan(p, kind, 'sweep', 'idle', r.range(6, 10), home); }
        else plan(p, kind, 'pray', null, r.range(3.5, 6.5), home);
        break;
      case E_BOARD:
        if (!(q = poiNear(p, P_BOARD))) return false;
        spotBy(q, p, true); plan(p, kind, 'idle', r.chance(0.5) ? 'point' : 'shrug', r.range(3, 5), home); p.eChat = true; lookAtPoi(p, q, false); p.eLookH = 0.55;
        break;
      case E_STATUE:
        if (!(q = poiNear(p, P_STATUE))) return false;
        spotBy(q, p, false); lookAtPoi(p, q, true);
        plan(p, kind, 'idle', p.mood > 0.72 ? 'bow' : p.mood < 0.35 ? 'shake_fist' : 'shrug', r.range(3, 4.6), home); p.eChat = true;
        break;
      case E_SEAT:
        // a look at the seat of power, with whatever feeling that brings up
        if (!(q = poiNear(p, P_SEAT))) return false;
        spotBy(q, p, true); lookAtPoi(p, q, false); p.eLookH = 0.9;
        plan(p, kind, 'idle', p.mood > 0.72 ? 'bow' : p.mood < 0.35 ? (r.chance(0.5) ? 'shake_fist' : 'shrug') : r.chance(0.5) ? 'talk' : null, r.range(2.5, 4), home); p.eChat = true;
        p.eLook = true; p.eLookX = q.cx; p.eLookY = q.cy; p.eLookH = 0.9;
        break;
      case E_STOCKS:
        if (!(q = poiNear(p, P_STOCKS))) return false;
        spotBy(q, p, false); plan(p, kind, 'point', p.child ? 'cheer' : 'talk', r.range(2.5, 4), home); p.eChat = true; lookAtPoi(p, q, false);
        break;
      case E_FIELD: {
        if (!nav.fields.length) return false;
        const i = nav.fields[Math.floor(r.next() * nav.fields.length)]!;
        _sx = (i % MAP_W) + 0.5 + r.range(-0.25, 0.25); _sy = Math.floor(i / MAP_W) + 0.5 + r.range(-0.25, 0.25);
        plan(p, kind, 'sweep', 'idle', r.range(8, 15), r.chance(0.4) ? TH_CHOOSE : TH_HOME_IN);
        if (p.baseProp !== 'pitchfork' && p.baseProp !== 'shovel' && p.baseProp !== 'crook') p.eProp = r.chance(0.5) ? 'pitchfork' : 'shovel';
        if (p.baseProp === 'crook') { p.eAnim = 'idle'; p.eAnim2 = null; }
        break;
      }
      case E_WOODS: {
        const l = nav.woodside.length ? nav.woodside : nav.fields;
        if (!l.length) return false;
        let i = -1, bd = Infinity;
        for (let k = 0; k < 3; k++) { const j = l[Math.floor(r.next() * l.length)]!; const d = Math.abs((j % MAP_W) - p.x) + Math.abs(Math.floor(j / MAP_W) - p.y); if (d < bd) { bd = d; i = j; } }
        _sx = (i % MAP_W) + 0.5; _sy = Math.floor(i / MAP_W) + 0.5;
        if (dangerAt(p, _sx, _sy)) return false;
        plan(p, kind, 'idle', p.trade === 'hunter' ? 'point' : p.trade === 'shepherd' ? null : 'bow', r.range(6, 11), r.chance(0.3) ? TH_CHOOSE : home);
        if (p.eAnim2 === 'bow') {
          // stooping to pick: herbs for those who know them, sticks for everyone else
          p.eAlt = 2.7;
          const herbs = p.trade === 'herbalist' || p.trade === 'hedge_witch' || p.trade === 'beekeeper';
          if (herbs) { if (p.trade !== 'beekeeper') p.eProp = 'basket'; } else { p.eTake = 'sack'; p.eThen = TH_HOME_IN; }
        }
        break;
      }
      case E_STROLL:
        if (!spotAway(p, p.doorX, p.doorY, 2.5, 6)) return false;
        plan(p, kind, 'idle', null, r.range(1.2, 3), r.chance(0.5) ? TH_CHOOSE : TH_HOME_STEP); p.eChat = true;
        break;
      case E_PATROL: {
        if (!nav.roads.length) { if (!spotAway(p, p.doorX, p.doorY, 3, 7)) return false; }
        else { const i = nav.roads[Math.floor(r.next() * nav.roads.length)]!; _sx = (i % MAP_W) + 0.5; _sy = Math.floor(i / MAP_W) + 0.5; if (dangerAt(p, _sx, _sy)) return false; }
        const tower = p.trade === 'guard' && r.chance(0.3) ? poiNear(p, P_TOWER) : null;
        if (tower) { spotBy(tower, p, true); }
        plan(p, kind, 'idle', p.trade === 'ratcatcher' ? 'sweep' : null, r.range(2, 5), r.chance(0.7) ? TH_CHOOSE : home);
        break;
      }
      case E_PERFORM:
        q = poiNear(p, eveNow() ? P_TAVERN : P_WELL) ?? poiNear(p, P_SHOP, true) ?? poiNear(p, P_WELL);
        if (!q) { if (!spotAway(p, p.doorX, p.doorY, 2, 4)) return false; } else spotBy(q, p, false);
        plan(p, kind, 'dance', null, r.range(7, 12), home); p.ePerf = true; p.eProp = 'lute';
        break;
      case E_VISIT: {
        // call on a neighbour: knock, wait, and with luck be answered
        let n = Math.floor(r.next() * people.length), host: Person | null = null;
        for (let k = 0; k < people.length; k++) { const o = people[(n + k) % people.length]!; if (o.role === 0 && o.tenantId !== p.tenantId && !o.leaving && !o.arriving && !o.away && Math.abs(o.doorX - p.x) + Math.abs(o.doorY - p.y) < 14 && !dangerAt(p, o.doorX, o.doorY)) { host = o; break; } }
        if (!host) return false;
        n = host.face;
        _sx = host.doorX + Math.sin(n) * 0.5 + Math.cos(n) * 0.16; _sy = host.doorY + Math.cos(n) * 0.5 - Math.sin(n) * 0.16;
        if (!nav.walkable(_sx, _sy)) return false;
        plan(p, kind, 'knock', 'idle', r.range(4.5, 6.5), home); p.eAlt = 1.9; p.eChat = true; p.eLook = true; p.eLookX = host.inX; p.eLookY = host.inY; p.eLookH = 0.35;
        if (host.st === ST_INSIDE && c > host.wakeC && c < host.homeC - 0.04) { host.t = Math.max(0.1, pathEta(p) + 1.4); host.cdGossip = 0; }
        p.cdGossip = Math.min(p.cdGossip, 2);
        break;
      }
      case E_OWNSHOP: {
        // mind the shop: out front, doing what the trade does
        const t = p.shopType;
        _sx = p.stepX; _sy = p.stepY;
        if (t === 'smithy') { plan(p, kind, 'hammer', 'idle', r.range(7, 12), TH_CHOOSE); p.eProp = 'hammer'; p.eAlt = 4; }
        else if (t === 'bakery') {
          if (r.chance(0.35)) { plan(p, kind, 'sweep', 'idle', r.range(6, 10), TH_CHOOSE); p.eProp = 'broom'; }
          else { plan(p, kind, 'wave', 'idle', r.range(6, 10), TH_CHOOSE); p.eChat = true; }       // a loaf held out to the lane
          p.eAlt = 3;
        }
        else if (t === 'mill') { plan(p, kind, 'carry', 'idle', r.range(5, 9), TH_CHOOSE); p.eProp = 'sack'; p.eAlt = 3; }
        else if (t === 'tavern') { if (r.chance(0.5)) { plan(p, kind, 'sweep', 'idle', r.range(5, 9), TH_CHOOSE); p.eProp = 'broom'; } else { plan(p, kind, 'wave', 'talk', r.range(5, 9), TH_CHOOSE); p.eProp = 'mug'; p.eChat = true; } }
        else if (t === 'apothecary') { plan(p, kind, 'read', 'count', r.range(6, 10), TH_CHOOSE); }
        else { plan(p, kind, 'talk', r.chance(0.5) ? 'wave' : 'point', r.range(6, 11), TH_CHOOSE); p.eChat = true; }    // a stall: hawking
        break;
      }
      case E_PLAY: {
        // somewhere to run to; another child, for choice
        let mate: Person | null = null;
        const n = Math.floor(r.next() * people.length);
        for (let k = 0; k < people.length && k < 24; k++) { const o = people[(n + k) % people.length]!; if (o.child && o !== p && o.st !== ST_INSIDE && !o.leaving && Math.abs(o.x - p.x) + Math.abs(o.y - p.y) < 9) { mate = o; break; } }
        if (mate && r.chance(0.6)) { if (!spotAway(p, mate.x, mate.y, 0.6, 1.4)) return false; }
        else if (!spotAway(p, p.doorX, p.doorY, 1.2, 4)) return false;
        plan(p, kind, r.chance(0.4) ? 'cheer' : 'idle', null, r.range(0.7, 1.8), r.chance(0.8) ? TH_CHOOSE : TH_HOME_STEP); p.eChat = true;
        if (!pathTo(p, _sx, _sy)) return false;
        walk(p, NX_DWELL, 1.75);
        return true;
      }
      default: return false;
    }
    if (dangerAt(p, _sx, _sy) || !pathTo(p, _sx, _sy)) return false;
    walk(p, NX_DWELL);
    return true;
  }
  const eveNow = (): boolean => c > 0.5;
  /** a hamlet of two households should not spend its day indoors: 0.35 (tiny) .. 1 (a town) */
  const cosy = (): number => clamp(people.length / 24, 0.35, 1);
  /** out on purpose after dark (the night owl, the sleepwalker) */
  const abroad = (p: Person): boolean => (p.nocturnal || p.sleeper) && p.nightDone === monthNo;
  function pathEta(p: Person): number { return pathLength(p) / Math.max(0.3, p.pace); }

  /** the end of a walk */
  function onArrive(p: Person): void {
    p.hurry = 1;
    switch (p.next) {
      case NX_DWELL: {
        p.st = ST_DWELL;
        if (p.eLook) { p.heading = Math.atan2(p.eLookX - p.x, p.eLookY - p.y); look(p, p.eLookX, p.eLookY, p.eLookH); }
        if (p.eProp) setProp(p, p.eProp);
        p.fig.setSit(p.eSit);
        p.fig.setAnim(p.eAnim);
        break;
      }
      case NX_HOME_IN:
        if (p.arriving) { p.arriving = false; p.t = p.rng.range(3, 7); }
        else if (c > 0.62 && c < 0.8 && !p.child && p.rng.chance(0.16)) {
          // a sit on the step first, and the eyes close
          dwell(p, 'sleep', p.rng.range(4, 8), TH_ENTER); p.eSit = true; p.fig.setSit(true); p.heading = p.face; setProp(p, null);
          return;
        }
        startEnter(p);
        break;
      case NX_HOME_STEP: p.heading = p.face; doorstep(p); break;
      case NX_VANISH: vanish(p); break;
      case NX_COWER: {
        const lx = p.eLookX, ly = p.eLookY, lh = p.eLookH;
        dwell(p, 'cower', p.rng.range(3, 5.5), TH_CHOOSE);
        p.eLook = true; p.eLookX = lx; p.eLookY = ly; p.eLookH = lh;
        p.heading = Math.atan2(lx - p.x, ly - p.y); look(p, lx, ly, lh);
        break;
      }
    }
  }

  function afterDwell(p: Person): void {
    p.fig.setSit(false);
    if (p.eTake) { p.carry = p.eTake; setProp(p, p.eTake); p.eTake = null; if (p.eKind === E_SHOP && p.rng.chance(0.4)) p.fig.emote('coin'); }
    else if (p.eProp) setProp(p, null);
    if (p.leaving) { leaveWalk(p); return; }
    switch (p.eThen) {
      case TH_HOME_IN: goHome(p, true); break;
      case TH_HOME_STEP: goHome(p, false); break;
      case TH_ENTER: startEnter(p); break;
      default: chooseErrand(p); break;
    }
  }

  // ───────────── feelings ─────────────

  function look(p: Person, tx: number, ty: number, height = NaN): void {
    if (height === height) p.fig.lookAt(tx - HALF_W, ty - HALF_H, height); else p.fig.lookAt(tx - HALF_W, ty - HALF_H);
  }
  function restoreLook(p: Person): void {
    if (p.selected) { const cam = ctx.camera.position; p.fig.lookAt(cam.x, cam.z, cam.y); }
    else if (p.st === ST_GOSSIP && p.partner) look(p, p.partner.x, p.partner.y);
    else if (p.st === ST_DWELL && p.eLook) look(p, p.eLookX, p.eLookY, p.eLookH);
    else p.fig.lookAt(null);
  }
  const free = (p: Person): boolean => (p.st === ST_WALK || p.st === ST_DWELL) && !p.leaving && !p.arriving && p.next !== NX_COWER && p.eAnim !== 'cower';

  /** a short turn of feeling, after which they go back to whatever it was */
  function react(p: Person, anim: AnimId, dur: number, tx = NaN, ty = NaN, height = NaN, turn = false): boolean {
    if (p.st !== ST_WALK && p.st !== ST_DWELL && p.st !== ST_FOLLOW) return false;
    if (p.st === ST_DWELL && (p.eAnim === 'sleep' || p.eAnim === 'cower')) return false;
    p.prevSt = p.st; p.st = ST_REACT; p.rT = dur;
    p.fig.setSit(false); p.fig.setAnim(anim);
    if (tx === tx) { look(p, tx, ty, height); if (turn) p.heading = Math.atan2(tx - p.x, ty - p.y); }
    return true;
  }
  function endReact(p: Person): void {
    p.st = p.prevSt;
    if (p.st === ST_DWELL) { p.fig.setSit(p.eSit); p.fig.setAnim(p.eAnim); if (p.eLook) p.heading = Math.atan2(p.eLookX - p.x, p.eLookY - p.y); }
    restoreLook(p);
  }

  function startGossip(a: Person, b: Person): void {
    const kids = a.child && b.child;
    // a civil distance
    const gx = b.x - a.x, gy = b.y - a.y, gd = Math.hypot(gx, gy) || 1, want = kids ? 0.42 : 0.6;
    if (gd < want) { const k = (want - gd) / 2 / gd; a.nx = -gx * k; a.ny = -gy * k; b.nx = gx * k; b.ny = gy * k; }
    const dur = (kids ? a.rng.range(1.2, 2) : a.rng.range(3.6, 7.5) * (a.gossipy || b.gossipy ? 1.4 : 1)) / (gs > 1 ? 1 + (gs - 1) * 0.5 : 1);
    for (let k = 0; k < 2; k++) {
      const p = k ? b : a, o = k ? a : b;
      p.prevSt = p.st; p.st = ST_GOSSIP; p.rT = dur; p.partner = o; p.talking = k === 0; p.talkT = p.rng.range(1.2, 2.2);
      p.heading = Math.atan2(o.x - p.x, o.y - p.y);
      p.fig.setSit(false);
      look(p, o.x, o.y);
      p.fig.setAnim(kids ? 'cheer' : p.talking ? 'talk' : 'idle');
    }
  }
  function endGossip(p: Person): void {
    const o = p.partner;
    for (let k = 0; k < 2; k++) {
      const q = k ? o : p;
      if (!q) continue;
      q.partner = null;
      if (q.st === ST_GOSSIP) { q.st = q.prevSt; if (q.st === ST_DWELL) { q.fig.setSit(q.eSit); q.fig.setAnim(q.eAnim); } }
      q.cdGossip = q.rng.range(10, 24) * (q.gossipy ? 0.5 : 1) * (gs > 1 ? gs : 1);
      restoreLook(q);
    }
  }

  function flee(p: Person, th: Threat, day: number): void {
    if (p.partner) endGossip(p);
    if (p.st === ST_REACT) p.st = p.prevSt;
    if (th.kind === 'fire') p.calmDay = day + 0.4; else if (p.calm.indexOf(th.id) < 0) { if (p.calm.length > 5) p.calm.shift(); p.calm.push(th.id); }
    p.fig.setSit(false); p.fig.react('startle'); p.fig.emote(th.kind === 'fire' ? 'alert' : 'shock');
    setProp(p, null); p.carry = null;
    const away = Math.atan2(p.x - th.x, p.y - th.y);
    if (!spotAway(p, th.x, th.y, th.r + 1.6, th.r + 3.2, away, 1.3) || !pathTo(p, _sx, _sy)) { p.path[0] = p.x; p.path[1] = p.y; p.pathN = 1; p.pathI = 0; }     // nowhere to run: cower on the spot
    p.eLook = true; p.eLookX = th.x; p.eLookY = th.y; p.eLookH = th.top;
    walk(p, NX_COWER, 2.5);
    p.eLook = true;
  }

  // ───────────── coming and going ─────────────

  function beginArrival(list: Person[]): void {
    const head = list[0]!;
    for (let k = 0; k < list.length; k++) {
      const p = list[k]!;
      p.arriving = true; p.leaving = 0;
      p.x = nav.gateX; p.y = nav.gateY; p.pop = 0; p.fig.group.visible = true;
      p.fig.setSit(false);
      if (k === 0) {
        p.carry = 'sack'; setProp(p, 'sack');
        pathHome(p, false); walk(p, NX_HOME_IN);
        if (p.pathN > 0) p.heading = Math.atan2(p.path[0]! - p.x, p.path[1]! - p.y);
      } else {
        p.leader = head; p.gap = 0.5 * k + 0.1; p.st = ST_FOLLOW;
        if (k === 1 && !p.child) { p.carry = 'basket'; setProp(p, 'basket'); }
        p.heading = head.heading;
      }
      p.fig.setHeading(p.heading, true);
    }
  }

  function beginLeave(tenantId: Id, reason: MoveOutReason): void {
    const list = houses.get(tenantId);
    if (!list || !list.length) return;
    const head = list[0]!;
    if (head.leaving) return;
    const evicted = reason === 'evicted';
    for (let k = 0; k < list.length; k++) {
      const p = list[k]!;
      if (p.partner) endGossip(p);
      if (p.st === ST_REACT) p.st = p.prevSt;
      p.leaving = evicted ? 2 : 1; p.reason = reason; p.arriving = false; p.away = false;
      p.walked = 0; p.lookBack = p.rng.range(1.6, 2.6);
      p.fig.setSit(false);
      if (evicted) { p.mood = 0.06; p.fig.setMood(0.06); p.moodK = 1; }
      else if (reason === 'poached') { p.mood = 0.95; p.fig.setMood(0.95); }
      if (k > 0) { p.leader = head; p.gap = 0.5 * k + 0.1; }
      if (p.st === ST_INSIDE || p.st === ST_ENTER) { startEmerge(p); p.pop = -0.5 * k; }
      else if (p.st === ST_EMERGE) { /* on their way out already */ }
      else if (k === 0) farewell(p);
      else p.st = ST_FOLLOW;
    }
  }
  /** a last word to the place, then off */
  function farewell(p: Person): void {
    p.carry = 'sack'; setProp(p, 'sack');
    const near = Math.abs(p.x - p.doorX) + Math.abs(p.y - p.doorY) < 2.5;
    const seat = byCat[P_SEAT]![0];
    p.st = ST_DWELL; p.eThen = TH_CHOOSE; p.eProp = null; p.eTake = null; p.eSit = false; p.eChat = false; p.ePerf = false; p.eAnim2 = null; p.eLook = false;
    if (p.reason === 'evicted') { p.eAnim = 'idle'; p.t = near ? 1.6 : 0.4; p.eLook = true; p.eLookX = p.inX; p.eLookY = p.inY; p.eLookH = 0.5; p.fig.emote('sad'); }
    else if ((p.reason === 'unhappy' || p.reason === 'rent_too_high') && seat) { p.eAnim = 'shake_fist'; p.t = 1.9; p.eLook = true; p.eLookX = seat.cx; p.eLookY = seat.cy; p.eLookH = 0.8; p.fig.emote('angry'); }
    else if (p.reason === 'poached') { p.eAnim = 'cheer'; p.t = 1.1; }
    else if (near) { p.eAnim = 'wave'; p.t = 1.5; p.eLook = true; p.eLookX = p.inX; p.eLookY = p.inY; p.eLookH = 0.5; }
    else { p.eAnim = 'idle'; p.t = 0.3; }
    if (p.eLook) { p.heading = Math.atan2(p.eLookX - p.x, p.eLookY - p.y); look(p, p.eLookX, p.eLookY, p.eLookH); }
    p.fig.setAnim(p.eAnim);
  }
  function leaveWalk(p: Person): void {
    pathTo(p, nav.gateX, nav.gateY, true);
    walk(p, NX_VANISH, p.leaving === 2 ? 0.7 : p.reason === 'poached' ? 1.15 : 0.95);
  }

  function setAway(p: Person, away: boolean): void {
    p.away = away;
    if (away && p.st !== ST_INSIDE && !p.leaving) {
      // the sim has put this very person on the table as a petitioner: step out of the picture
      if (p.partner) endGossip(p);
      if (p.st === ST_REACT) p.st = p.prevSt;
      p.st = ST_ENTER; p.next = NX_DWELL; p.fig.setSit(false);
    } else if (!away && p.st === ST_INSIDE) p.t = 0.6;
  }

  // ───────────── reconcile with the sim ─────────────

  function reconcile(s: GameState): void {
    for (const [tid, list] of houses) {
      const head = list[0];
      if (!head) continue;
      const t = s.tenants[tid];
      const housed = !!t && t.status === 'housed' && !!t.buildingId && !!s.buildings[t.buildingId];
      if (!housed) { if (!head.leaving) beginLeave(tid, t && t.status === 'evicted' ? 'evicted' : 'lease_end'); continue; }
      if (head.leaving) continue;
      for (const p of list) {
        feel(p, t!);
        if (p.buildingId !== t!.buildingId || p.unit !== t!.unit) { p.buildingId = t!.buildingId!; p.unit = t!.unit; homeOf(p, s); }
      }
    }
    for (const tid in s.tenants) {
      const t = s.tenants[tid]!;
      if (t.status !== 'housed' || !t.buildingId || houses.has(tid)) continue;
      const b = s.buildings[t.buildingId];
      if (!b || b.state === 'building') continue;
      spawnHousehold(t, s, false, false);
    }
    for (const p of people) p.awayMark = false;
    rulerX = NaN; bailX = NaN; colN = 0;
    for (const aid in s.actors) {
      const a = s.actors[aid]!;
      if (a.kind === 'ruler') { rulerX = a.x; rulerY = a.y; }
      else if (a.kind === 'staff') { const m = a.refId ? s.staff[a.refId] : null; if (m && m.role === 'bailiff') { bailX = a.x; bailY = a.y; } }
      else if ((a.kind === 'petitioner' || a.kind === 'visitor') && a.refId) { const p = heads.get(a.refId); if (p) p.awayMark = true; }
      if (a.jobId && colN < 4) { const j = s.jobs[a.jobId]; if (j && j.kind === 'collect') { colX[colN] = a.x; colY[colN] = a.y; colN++; } }
    }
    for (const p of people) if (p.role === 0 && p.away !== p.awayMark && !p.leaving) setAway(p, p.awayMark);
  }

  function purseOut(p: Person): boolean {
    const b = state ? state.buildings[p.buildingId] : null;
    const u = b ? b.units[p.unit] : null;
    return !!u && u.purse > 0;
  }

  // ───────────── noticing things (a few times a second each) ─────────────

  function notice(p: Person): void {
    const s = state;
    if (!s) return;
    const day = s.day;
    // danger first
    for (let i = 0; i < threats.length; i++) {
      const th = threats[i]!;
      const d2 = (p.x - th.x) * (p.x - th.x) + (p.y - th.y) * (p.y - th.y);
      if (d2 > (th.r + 2.6) * (th.r + 2.6)) continue;
      const own = th.id === p.buildingId;
      if (own && th.kind !== 'fire') continue;
      if (p.leaving || p.arriving || p.st === ST_FOLLOW) continue;
      if (d2 < th.r * th.r) {
        if (p.next === NX_COWER && (p.st === ST_WALK || p.st === ST_DWELL)) continue;
        if (p.st === ST_DWELL && p.eAnim === 'cower') continue;
        if (th.kind === 'fire' ? day < p.calmDay && p.next !== NX_COWER && d2 > (th.r - 1) * (th.r - 1) : p.calm.indexOf(th.id) >= 0) continue;
        if (p.st === ST_WALK || p.st === ST_DWELL || p.st === ST_GOSSIP || p.st === ST_REACT) { flee(p, th, day); return; }
      } else if (p.cdGlance <= 0 && (p.st === ST_WALK || p.st === ST_DWELL) && !p.eLook) {
        // keep an eye on it in passing
        look(p, th.x, th.y, th.top); p.glanceT = p.rng.range(0.9, 1.6); p.cdGlance = p.rng.range(3, 6);
      }
    }
    if (!free(p)) return;
    // the collector, the bailiff, the ruler
    if (p.role === 0 && p.cdWave <= 0 && colN > 0 && purseOut(p)) {
      for (let i = 0; i < colN; i++) {
        if (Math.abs(colX[i]! - p.x) + Math.abs(colY[i]! - p.y) < 3.2 && Math.abs(p.x - p.doorX) + Math.abs(p.y - p.doorY) < 2.2) {
          if (react(p, 'wave', 1.7, colX[i]!, colY[i]!, 0.4, true)) { p.cdWave = 4.5; return; }
        }
      }
    }
    if (bailX === bailX && p.cdFist <= 0 && !p.child) {
      const d = Math.abs(bailX - p.x) + Math.abs(bailY - p.y);
      if (d < 2.6) {
        if (p.mood < 0.37) { if (react(p, 'shake_fist', 2.1, bailX, bailY, 0.4, true)) { p.cdFist = p.rng.range(14, 22); if (p.rng.chance(0.5)) p.fig.emote('angry'); return; } }
        else if (p.owing) { p.fig.react('flinch'); p.fig.emote('sweat'); look(p, bailX, bailY, 0.4); p.glanceT = 1.2; p.cdFist = p.rng.range(12, 20); }
      }
    }
    if (rulerX === rulerX && p.cdGreet <= 0) {
      const d = Math.abs(rulerX - p.x) + Math.abs(rulerY - p.y);
      if (d < 2.0) {
        p.cdGreet = p.rng.range(18, 30);
        if (p.mood >= 0.68) { if (react(p, p.child || p.rng.chance(0.5) ? 'wave' : 'bow', 1.7, rulerX, rulerY, 0.5, true)) return; }
        else if (p.mood >= 0.38) { p.fig.react('nod'); look(p, rulerX, rulerY, 0.5); p.glanceT = 1.3; }
        else { p.fig.react('shake'); look(p, rulerX, rulerY, 0.5); p.glanceT = 0.9; }
      }
    }
    // each other
    const chatty = p.st === ST_WALK ? p.hurry <= 1.05 && !p.carry : p.eChat;
    let near: Person | null = null, nd = 2.4;
    for (let i = 0; i < people.length; i++) {
      const o = people[i]!;
      if (o === p || o.st === ST_INSIDE || o.pop < 0.9) continue;
      const d = Math.abs(o.x - p.x) + Math.abs(o.y - p.y);
      if (d >= nd) continue;
      nd = d; near = o;
      if (o.ePerf && o.st === ST_DWELL && p.cdWatch <= 0 && p.st === ST_WALK && p.hurry <= 1.05 && d > 0.7) {
        // someone is playing: stop and listen
        if (react(p, p.mood > 0.6 && p.rng.chance(0.5) ? 'dance' : 'cheer', p.rng.range(2.2, 4), o.x, o.y, NaN, true)) { p.cdWatch = p.rng.range(14, 26); return; }
      }
    }
    if (!near) return;
    const o = near;
    if (nd < 0.4 && p.st === ST_DWELL && o.st !== ST_WALK && p.nx === 0 && p.ny === 0) {
      // too close for comfort: shuffle apart
      let ax = p.x - o.x, ay = p.y - o.y; const al = Math.hypot(ax, ay);
      if (al < 1e-3) { ax = Math.sin(p.idx * 2.4 + 1); ay = Math.cos(p.idx * 2.4 + 1); } else { ax /= al; ay /= al; }
      p.nx = ax * 0.16; p.ny = ay * 0.16;
    }
    if (chatty && nd < 1.25 && nd > 0.3 && p.cdGossip <= 0 && o.cdGossip <= 0 && free(o) && !o.partner && feastT <= 0
      && (o.st === ST_WALK ? o.hurry <= 1.05 && !o.carry : o.eChat) && (p.child === o.child) && p.tenantId !== o.tenantId && c < Math.min(p.homeC, o.homeC) - 0.01) {
      if (p.rng.chance(p.gossipy || o.gossipy ? 0.9 : 0.6)) { startGossip(p, o); return; }
      p.cdGossip = 3;
    }
    if (p.cdGlance <= 0 && !p.eLook && !p.selected && p.st === ST_WALK) { look(p, o.x, o.y); p.glanceT = p.rng.range(0.6, 1.2); p.cdGlance = p.rng.range(2.5, 6); }
  }

  // ───────────── the frame ─────────────

  function place(p: Person): void {
    const g = p.fig.group;
    g.position.set(p.x - HALF_W, 0, p.y - HALF_H);
    p.fig.setHeading(p.heading);
  }
  function walkAnim(p: Person): AnimId {
    if (p.sleepwalk) return 'sleep';
    if (p.pace * p.hurry * p.moodK * speedNow > 2.55) return 'run';
    return p.carry === 'sack' && p.leaving !== 2 ? 'carry' : 'walk';     // the evicted do not hold anything high
  }

  function step(p: Person, env: Env): void {
    const dt = env.dt, gdt = dt * gs;
    switch (p.st) {
      case ST_INSIDE: {
        if (p.away) return;
        if (p.leaving) { startEmerge(p); return; }
        p.t -= gdt;
        if (p.t > 0) return;
        const fire = fireAt(p.buildingId);
        if (fire) { startEmerge(p); return; }
        if (c >= p.wakeC && c < p.homeC - 0.02) {
          if (badWeather && p.rng.chance(badWeather >= 2 ? 0.97 : 0.7)) { p.t = p.rng.range(4, 9); return; }
          startEmerge(p); return;
        }
        if ((p.nocturnal || p.sleeper) && c > C_DEEP_NIGHT - (p.nocturnal ? 0.02 : 0) && c < 0.9 && p.nightDone !== monthNo && !badWeather) { p.nightDone = monthNo; startEmerge(p); return; }
        p.t = 1.2;
        return;
      }
      case ST_EMERGE: {
        p.pop += dt / 0.34;
        const k = clamp(p.pop, 0, 1), e = k * k * (3 - 2 * k);
        const tx = p.leaving || p.arriving ? p.doorX : p.stepX, ty = p.leaving || p.arriving ? p.doorY : p.stepY;
        p.x = p.inX + (tx - p.inX) * e; p.y = p.inY + (ty - p.inY) * e;
        if (p.pop >= 1) afterEmerge(p);
        break;
      }
      case ST_ENTER: {
        p.pop -= dt / 0.3;
        if (Math.abs(p.x - p.inX) + Math.abs(p.y - p.inY) < 1.3) { const k = clamp(1 - p.pop, 0, 1); p.x += (p.inX - p.x) * k * 0.35; p.y += (p.inY - p.y) * k * 0.35; }
        if (p.pop <= 0) {
          p.pop = 0; p.st = ST_INSIDE; p.fig.group.visible = false;
          p.carry = null; p.sleepwalk = false; setProp(p, null); p.fig.setSit(false);
          p.x = p.inX; p.y = p.inY;
          if (c >= p.homeC - 0.02 || c < p.wakeC) p.t = 0; else if (p.t <= 0 || p.t > 12) p.t = p.rng.range(2.5, 7) * cosy();
        }
        break;
      }
      case ST_VANISH: {
        p.pop -= dt / 0.3;
        if (p.pop <= 0) { removePerson(p); return; }
        break;
      }
      case ST_WALK: {
        if (c >= p.homeC && !p.leaving && !p.arriving && p.next !== NX_HOME_IN && p.next !== NX_COWER && !abroad(p)) { goHome(p, true, c > C_HURRY ? 2 : 1.2); if (p.st !== ST_WALK) break; }
        if (c > C_LOCKUP && c < 0.985 && !p.leaving && !p.arriving && !fireAt(p.buildingId)) { p.st = ST_ENTER; break; }
        if (c > C_HURRY && p.next === NX_HOME_IN && p.hurry < 2 && !p.leaving && !p.arriving && !abroad(p)) p.hurry = 2;
        if (p.leaving === 2 && p.walked > p.lookBack && p.role === 0 && p.pathI < p.pathN - 1) {
          // one more look at the old place
          p.lookBack = p.walked + p.rng.range(2.6, 4.2);
          if (react(p, 'idle', 1.7, p.inX, p.inY, 0.5, true)) break;
        }
        p.fig.setAnim(walkAnim(p));
        if (advance(p, p.pace * p.hurry * p.moodK * gdt)) onArrive(p);
        break;
      }
      case ST_DWELL: {
        p.t -= gdt;
        if (c >= p.homeC && !p.leaving && p.eThen !== TH_ENTER && p.eAnim !== 'cower' && !abroad(p) && !(p.t > 0 && fireAt(p.buildingId))) { p.eTake = null; p.fig.setSit(false); setProp(p, null); goHome(p, true, c > C_HURRY ? 2 : 1.2); break; }
        if (p.eThen === TH_ENTER && c > 0.845) p.t = 0;
        if (p.eAnim2) p.fig.setAnim((Math.floor(p.t / p.eAlt) & 1) ? p.eAnim2 : p.eAnim);
        if (p.eAnim === 'cower' && p.t <= 0 && fireNear(p)) p.t = 1.5;     // not while it still burns
        if (p.t <= 0) afterDwell(p);
        break;
      }
      case ST_GOSSIP: {
        p.rT -= dt; p.talkT -= dt;
        const o = p.partner;
        if (!o || o.st !== ST_GOSSIP || p.rT <= 0 || c >= p.homeC) { endGossip(p); break; }
        if (p.talkT <= 0 && !p.child) {
          p.talking = !p.talking; p.talkT = p.rng.range(1.1, 2.4);
          p.fig.setAnim(p.talking ? 'talk' : 'idle');
          if (!p.talking) { const r = p.rng.next(); if (r < 0.45) p.fig.react('nod'); else if (r < 0.6) p.fig.react('shake'); else if (r < 0.68) p.fig.emote(p.mood < 0.35 ? 'angry' : r < 0.64 ? 'question' : 'happy'); }
        }
        break;
      }
      case ST_REACT: {
        p.rT -= dt;
        if (p.rT <= 0) endReact(p);
        break;
      }
      case ST_FOLLOW: {
        const l = p.leader;
        if (!l || l.dead || l.st === ST_VANISH) {
          if (p.leaving) { pathTo(p, nav.gateX, nav.gateY, true); walk(p, NX_VANISH, 1.1); } else goHome(p, true);
          p.leader = null; break;
        }
        if (l.st === ST_INSIDE || l.st === ST_ENTER) {
          if (p.leaving) break;                    // waiting for the head of the house to come out
          p.arriving = false; p.leader = null; goHome(p, true); break;
        }
        if (p.pop < 1) {
          // step onto the table once there is room behind the leader
          if (Math.hypot(l.x - p.x, l.y - p.y) > p.gap * 0.8 || p.pop > 0) p.pop = Math.min(1, Math.max(0, p.pop) + dt / 0.3);
          else break;
        }
        const tx = l.x - Math.sin(l.heading) * p.gap + Math.cos(l.heading) * 0.14 * (p.idx % 2 ? 1 : -1), ty = l.y - Math.cos(l.heading) * p.gap - Math.sin(l.heading) * 0.14 * (p.idx % 2 ? 1 : -1);
        const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
        const moving = l.st === ST_WALK;
        if (d > 2.6) {
          // a long way behind: catch up by the lanes, not through the houses
          p.t -= dt;
          if (p.t <= 0 || p.pathI >= p.pathN) { pathTo(p, l.x, l.y, true); p.t = 0.9; }
          p.hurry = 1.7; p.fig.setAnim(walkAnim(p));
          advance(p, p.pace * 1.7 * gdt);
        } else if (d > 0.1) {
          const v = p.pace * (d > 1.2 ? 1.7 : 1.1) * gdt, m = Math.min(v, d - 0.04);
          p.x += dx / d * m; p.y += dy / d * m; p.heading = Math.atan2(dx, dy);
          p.fig.setAnim(p.carry === 'sack' ? 'carry' : d > 1.2 && speedNow > 0 ? 'run' : 'walk');
        } else if (!moving) {
          p.fig.setAnim('idle');
          if (l.st === ST_REACT || l.st === ST_DWELL) { p.heading = l.heading; if (p.leaving === 2) look(p, p.inX, p.inY, 0.5); }
        } else p.fig.setAnim('walk');
        break;
      }
    }
  }

  function afterEmerge(p: Person): void {
    p.pop = 1;
    if (p.leaving) {
      if (p.role === 0 || !p.leader || p.leader.dead) { p.st = ST_DWELL; farewell(p); } else p.st = ST_FOLLOW;
      return;
    }
    const fire = fireAt(p.buildingId);
    if (fire && state) { p.st = ST_DWELL; flee(p, fire, state.day); return; }
    if (c > C_DEEP_NIGHT - 0.03 && c < 0.985 && (p.nocturnal || p.sleeper)) {
      // abroad at night: one with a lantern, one who will remember none of it
      if (!spotAway(p, p.doorX, p.doorY, 2.5, 5) || !pathTo(p, _sx, _sy)) { startEnter(p); return; }
      plan(p, E_STROLL, p.sleeper ? 'sleep' : 'idle', null, p.rng.range(2, 4), TH_HOME_IN);
      if (p.sleeper) p.sleepwalk = true; else { setProp(p, 'lantern'); p.carry = 'lantern'; }
      walk(p, NX_DWELL, p.sleeper ? 0.5 : 0.8);
      return;
    }
    if (feastT > 0) { p.st = ST_DWELL; dwell(p, 'cheer', Math.min(feastT, p.rng.range(3, 5)), TH_CHOOSE); return; }
    if (c < p.stepC || (p.role === 0 && purseOut(p) && c < C_PURSE_END)) {
      // first light: out on the step to see what sort of day it is
      dwell(p, 'idle', 1.2, TH_CHOOSE);
      p.eKind = E_STEP; p.eChat = true; p.eStage = 1;
      p.fig.react(p.child ? 'hop' : 'nod');
      if (!p.child && p.rng.chance(0.5)) { p.eAnim = 'shrug'; p.fig.setAnim('shrug'); p.t = 1.3; }     // a stretch
      return;
    }
    chooseErrand(p);
  }

  function fireAt(buildingId: Id): Threat | null {
    for (const th of threats) if (th.kind === 'fire' && th.id === buildingId) return th;
    return null;
  }
  function fireNear(p: Person): boolean {
    for (const th of threats) if (th.kind === 'fire' && (p.x - th.x) * (p.x - th.x) + (p.y - th.y) * (p.y - th.y) < (th.r + 4) * (th.r + 4)) return true;
    return false;
  }

  /** dawn on the step: stay while there is a purse to mind, then get on with the day */
  function dawnStep(p: Person): void {
    if (p.st !== ST_DWELL || p.eStage !== 1) return;
    if (p.t > 0.6) return;
    const minding = p.role === 0 && purseOut(p) && c < C_PURSE_END;
    if (c < p.stepC || minding) {
      p.t = 1.4; p.eAnim = 'idle'; p.eAnim2 = null; p.fig.setAnim('idle');
      if (minding && p.rng.chance(0.12)) p.fig.react('nod');
    } else p.eStage = 0;
  }

  function everyone(anim: AnimId, lo: number, hi: number, tx = NaN, ty = NaN): void {
    for (const p of people) {
      if (p.leaving || p.arriving || p.away) continue;
      if (p.st === ST_INSIDE) { if (c >= p.wakeC && c < p.homeC && !badWeather) p.t = p.rng.range(0, 0.8); continue; }
      if (p.partner) endGossip(p);
      react(p, anim, p.rng.range(lo, hi), tx, ty, tx === tx ? 1.5 : NaN, tx === tx);
    }
  }

  function onEvent(ev: SimEvent, s: GameState): void {
    switch (ev.type) {
      case 'tenant_in': {
        const t = s.tenants[ev.tenantId];
        if (!t || t.status !== 'housed') break;
        const list = houses.get(t.id);
        townDirty = true;                         // a shop may have a keeper now
        if (!list) spawnHousehold(t, s, true, false);
        else if (!list[0]!.leaving && clockT - list[0]!.born < 1.5) beginArrival(list);
        break;
      }
      case 'tenant_out': townDirty = true; beginLeave(ev.tenantId, ev.reason); break;
      case 'emote': {
        const p = ev.tenantId ? heads.get(ev.tenantId) : undefined;
        if (!p || p.st === ST_INSIDE || p.pop < 0.5) break;
        p.fig.emote(ev.emote);
        emoteBody(p, ev.emote);
        break;
      }
      case 'say': {
        const p = ev.tenantId ? heads.get(ev.tenantId) : undefined;
        if (p && free(p)) react(p, 'talk', 2.4);
        break;
      }
      case 'sfx':
        if (ev.id === 'cheer') { feastT = 11; everyone('cheer', 3, 5.5); }
        else if (ev.id === 'boo' && !ev.buildingId) everyone('shake_fist', 1.2, 2.2);
        break;
      case 'promotion': { const seat = byCat[P_SEAT]![0]; feastT = 6; everyone('cheer', 2.5, 4.5, seat ? seat.cx : NaN, seat ? seat.cy : NaN); break; }
      case 'demotion': for (const p of people) if (free(p) && p.rng.chance(0.5)) react(p, 'shrug', 2); break;
      case 'weather': {
        const bad = ev.kind === 'storm' || ev.kind === 'hail' ? 2 : ev.kind === 'rain' ? 1 : 0;
        if (bad > badWeather) for (const p of people) {
          if (!free(p) || (p.st === ST_WALK && p.next === NX_HOME_IN)) continue;
          if (bad < 2 && (p.keeper || p.rng.chance(0.35))) continue;
          p.eTake = null; setProp(p, null); goHome(p, true, 1.9);
        }
        badWeather = bad;
        break;
      }
      case 'purse': case 'purse_collected': {
        const b = s.buildings[ev.buildingId];
        const tid = b ? b.units[ev.unit]?.tenantId : null;
        const p = tid ? heads.get(tid) : undefined;
        if (!p) break;
        if (ev.type === 'purse') {
          if (p.st === ST_INSIDE && c < C_PURSE_END && !p.away) p.t = Math.min(p.t, 0.3);
          else if (free(p) && Math.abs(p.x - p.doorX) + Math.abs(p.y - p.doorY) < 1.2) react(p, 'bow', 1.3, p.doorX, p.doorY, 0, false);
        } else if (free(p) && Math.abs(p.x - p.doorX) + Math.abs(p.y - p.doorY) < 2.4) {
          const a = ev.byActor ? s.actors[ev.byActor] : null;
          react(p, p.mood > 0.45 ? 'bow' : 'shrug', 1.4, a ? a.x : rulerX, a ? a.y : rulerY, 0.5, !!a || rulerX === rulerX);
          p.cdGreet = Math.max(p.cdGreet, 8);
        }
        break;
      }
      case 'rent_paid': { const p = heads.get(ev.tenantId); if (p && p.st !== ST_INSIDE && p.pop > 0.5) p.fig.emote('coin'); break; }
      case 'building_done': {
        townDirty = true;
        const b = s.buildings[ev.buildingId];
        if (b) for (const p of people) if (free(p) && Math.abs(p.x - (b.x + b.w / 2)) + Math.abs(p.y - (b.y + b.h / 2)) < 5 && p.rng.chance(0.7)) react(p, 'cheer', p.rng.range(1.3, 2.2), b.x + b.w / 2, b.y + b.h / 2, 0.8, true);
        break;
      }
      case 'building_placed': case 'building_removed': townDirty = true; break;
      case 'tiles_changed': navDirty = true; break;
      case 'building_changed': {
        // a griffin may have landed; a shop may have opened or shut
        surveyThreats(s);
        const b = s.buildings[ev.buildingId];
        let known = false;
        for (const q of pois) if (q.id === ev.buildingId) { known = true; break; }
        if (known !== (!!b && b.state === 'ready' && POI_CAT[b.type] !== undefined)) townDirty = true;
        break;
      }
      default: break;
    }
  }
  function emoteBody(p: Person, e: EmoteId): void {
    switch (e) {
      case 'love': case 'happy': p.fig.react('hop'); break;
      case 'cheer': if (free(p)) react(p, 'cheer', p.rng.range(2.5, 4)); break;
      case 'angry': p.fig.react('shake'); break;
      case 'shock': case 'alert': p.fig.react('startle'); break;
      case 'sweat': p.fig.react('flinch'); break;
      case 'sad': p.fig.react('shake'); break;
      case 'idea': case 'question': p.fig.react('nod'); break;
      default: break;
    }
  }

  function clear(): void {
    for (const p of people) { p.dead = true; p.fig.dispose(); }
    people.length = 0; heads.clear(); houses.clear();
  }

  const layer: TownLifeLayer = {
    debug: {
      census() {
        const out: Record<string, number> = { total: people.length, households: houses.size };
        for (const n of ST_NAMES) out[n] = 0;
        for (const p of people) out[ST_NAMES[p.st]!]!++;
        return out;
      },
      each(cb) { for (const p of people) cb(p.key, ST_NAMES[p.st]!, p.x, p.y, p.fig.anim, p.st !== ST_INSIDE && p.pop > 0.5); },
    },
    reset(s) {
      clear();
      state = s; feastT = 0; tick = 0;
      badWeather = s.weather === 'storm' || s.weather === 'hail' ? 2 : s.weather === 'rain' ? 1 : 0;
      const phase = (((s.day % 30) + 30) % 30) / 30;
      c = (phase + DAWN) % 1; monthNo = Math.floor(s.day / 30); gs = 1;
      surveyTown(s);
      const ids = Object.keys(s.tenants).sort();
      for (const id of ids) {
        const t = s.tenants[id]!;
        if (t.status !== 'housed' || !t.buildingId) continue;
        const b = s.buildings[t.buildingId];
        if (!b || b.state === 'building') continue;
        spawnHousehold(t, s, false, true);
      }
      reconcile(s);
      for (const p of people) {
        // most have seen the griffin before; a few will still take it badly
        for (const th of threats) if (th.kind !== 'fire' && p.rng.chance(0.8)) p.calm.push(th.id);
        if (p.st !== ST_INSIDE) { place(p); p.fig.setHeading(p.heading, true); }
      }
    },
    sync(s) {
      if (disposed) return;
      if (state !== s && !state) { layer.reset(s); return; }
      state = s;
      if (townDirty) surveyTown(s);
      else if (navDirty) { nav.build(s); navDirty = false; }
      if ((tick++ & 15) === 0) reconcile(s);
    },
    handleEvents(events, s) {
      if (disposed) return;
      state = s;
      for (let i = 0; i < events.length; i++) onEvent(events[i]!, s);
    },
    update(env) {
      if (disposed) return;
      const dt = env.dt;
      clockT += dt;
      c = (env.monthPhase + DAWN) % 1;
      gs = env.speed; speedNow = env.speed;
      if (state) monthNo = Math.floor((state.day + DAWN * 30) / 30);
      if (feastT > 0) feastT -= dt;
      for (let i = people.length - 1; i >= 0; i--) {
        const p = people[i]!;
        if (p.st === ST_INSIDE) { step(p, env); continue; }
        if (p.cdGossip > 0) p.cdGossip -= dt; if (p.cdGreet > 0) p.cdGreet -= dt; if (p.cdFist > 0) p.cdFist -= dt;
        if (p.cdGlance > 0) p.cdGlance -= dt; if (p.cdWave > 0) p.cdWave -= dt; if (p.cdWatch > 0) p.cdWatch -= dt;
        if (p.glanceT > 0) { p.glanceT -= dt; if (p.glanceT <= 0) restoreLook(p); }
        step(p, env);
        if (p.dead || p.st === ST_INSIDE) continue;
        if (p.st === ST_DWELL && p.eStage === 1) dawnStep(p);
        if ((p.aware -= dt) <= 0) { p.aware = 0.28 + (i & 3) * 0.02; if (p.selected && p.glanceT <= 0 && p.st !== ST_GOSSIP) restoreLook(p); notice(p); }
        if (p.nx !== 0 || p.ny !== 0) {
          if (p.st === ST_WALK || p.st === ST_FOLLOW) { p.nx = 0; p.ny = 0; }
          else {
            const m = Math.hypot(p.nx, p.ny), k = Math.min(m, 0.9 * dt) / (m || 1), ux = p.nx * k, uy = p.ny * k;
            if (nav.walkable(p.x + ux, p.y + uy)) { p.x += ux; p.y += uy; }
            p.nx -= ux; p.ny -= uy;
            if (m < 0.004) { p.nx = 0; p.ny = 0; }
          }
        }
        place(p);
        p.fig.group.scale.setScalar(popScale(p.pop));
        p.fig.update(env);
      }
    },
    positionOf(id) {
      const p = heads.get(id);
      if (!p || p.dead || p.st === ST_INSIDE || p.pop < 0.3) return null;
      return _pos.set(p.x - HALF_W, p.fig.height * Math.min(1, p.pop) + 0.04, p.y - HALF_H);
    },
    pick(raycaster) {
      let best: Person | null = null, bd = Infinity;
      for (let i = 0; i < people.length; i++) {
        const p = people[i]!;
        if (p.st === ST_INSIDE || p.pop < 0.6) continue;
        const d = pickFigure(raycaster.ray, p.fig);
        if (d < bd) { bd = d; best = p; }
      }
      return best ? best.tenantId : null;
    },
    setSelected(id) {
      if (id === selectedId) return;
      const was = selectedId ? heads.get(selectedId) : undefined;
      if (was) { was.selected = false; was.fig.setSelected(false); restoreLook(was); }
      selectedId = id;
      const p = id ? heads.get(id) : undefined;
      if (!p) return;
      p.selected = true; p.fig.setSelected(true);
      const cam = ctx.camera.position;
      // who, me?
      if (free(p)) { react(p, p.mood >= 0.5 ? 'wave' : p.mood < 0.3 ? 'shrug' : 'idle', 1.8); p.heading = Math.atan2(cam.x - (p.x - HALF_W), cam.z - (p.y - HALF_H)); }
      p.fig.lookAt(cam.x, cam.z, cam.y);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clear();
      root.removeFromParent();
    },
  };
  return layer;
}
