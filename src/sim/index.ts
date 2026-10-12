/**
 * The Sim: owns GameState, runs the modules in a fixed order, validates and
 * applies Actions, and hands out events. No DOM, no three.js — runs in node
 * for bots and tests. Owned by the integrator.
 */
import {
  SAVE_VERSION, SECONDS_PER_DAY, DAYS_PER_MONTH,
  type GameState, type Action, type ActionResult, type SimEvent, type SimModule, type Mode, type Speed,
  type ActionHandlers, type ActionType,
} from './types';
import { emit, registerModules, dateOf, seasonOf } from './core';
import { worldModule } from './world';
import { buildingsModule } from './buildings';
import { actorsModule } from './actors';
import { jobsModule } from './jobs';
import { economyModule } from './economy';
import { tenantsModule } from './tenants';
import { rentModule } from './rent';
import { renownModule } from './renown';
import { staffModule } from './staff';
import { incidentsModule } from './incidents';
import { ordersModule } from './orders';
import { oathsModule } from './oaths';
import { rankModule } from './rank';
import { rivalModule } from './rival';
import { modesModule } from './modes';
import { serialize, deserialize } from './save';

/** Fixed order. init / step / onDay / onMonth / onJobDone all run in this order. */
export const MODULES: SimModule[] = [
  worldModule, buildingsModule, actorsModule, jobsModule,
  economyModule, tenantsModule, rentModule, renownModule,
  staffModule, incidentsModule, ordersModule, oathsModule,
  rankModule, rivalModule, modesModule,
];
registerModules(MODULES);

const HANDLERS: ActionHandlers = {};
for (const m of MODULES) {
  if (!m.handlers) continue;
  for (const k of Object.keys(m.handlers) as ActionType[]) {
    if ((HANDLERS as Record<string, unknown>)[k]) throw new Error(`[sim] two modules handle action "${k}"`);
    (HANDLERS as Record<string, unknown>)[k] = (m.handlers as Record<string, unknown>)[k];
  }
}

export interface NewGameOptions {
  seed?: number;
  mode?: Mode;
  ruler?: string;
  realm?: string;
  /** Iron Crown dynasty carry-over */
  heirloom?: string | null;
  reign?: number;
}

const MAX_TICK_DAYS = 0.25;

export function blankState(opts: NewGameOptions = {}): GameState {
  const seed = (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) | 0;
  return {
    version: SAVE_VERSION, seed, rng: seed ^ 0x9e3779b9, mode: opts.mode ?? 'peace', nextId: 1,
    day: 0, speed: 1, weather: 'clear',
    realm: { name: opts.realm ?? '', ruler: opts.ruler ?? 'You', rank: 'reeve', crest: seed & 0xffff, heirloom: opts.heirloom ?? null, reign: opts.reign ?? 1 },
    gold: 0, loans: [], renown: 50, favor: 50,
    map: { w: 0, h: 0, tiles: [], parcels: [] },
    buildings: {}, tenants: {}, applicants: {}, staff: {}, candidates: [], actors: {}, jobs: {},
    incidents: {}, incidentLog: {}, pending: [],
    orders: [],
    policies: { graceDays: 3, lateFeePct: 10, depositMonths: 1, askPct: 100, renewalCapPct: 10, pets: 'pet_rent', screening: 'never' },
    oaths: [],
    ledger: { months: [], txns: [] },
    charter: { goals: [], ready: false, sinceDay: 0 },
    rival: { name: '', seat: '', renown: 50, temperament: 'grasping', portraitSeed: 0, poached: 0, lastMoveDay: 0 },
    heralds: [],
    stats: { rentCollected: 0, evictions: 0, oathsKept: 0, oathsBroken: 0, incidentsResolved: 0, incidentsIgnored: 0, tenantsHoused: 0, wordsSpoken: 0, peakRentRoll: 0, daysInDebt: 0 },
    flags: {}, seen: {}, ended: null,
    _events: [],
  };
}

export class Sim {
  state: GameState;
  private listeners: ((events: SimEvent[]) => void)[] = [];

  constructor(state: GameState) { this.state = state; }

  static create(opts: NewGameOptions = {}): Sim {
    const s = blankState(opts);
    for (const m of MODULES) m.init?.(s);
    return new Sim(s);
  }
  static load(json: string): Sim { return new Sim(deserialize(json)); }
  save(): string { return serialize(this.state); }

  /** Advance by real seconds at the current speed. Returns the events raised. */
  step(realSeconds: number): SimEvent[] {
    const s = this.state;
    if (!s.ended && s.speed > 0 && realSeconds > 0) {
      this.advance((realSeconds * s.speed) / SECONDS_PER_DAY);
    }
    return this.drain();
  }

  /** Advance by game days regardless of speed (bots, tests, fast-forward). */
  advanceDays(days: number): SimEvent[] {
    this.advance(days);
    return this.drain();
  }

  private advance(days: number): void {
    const s = this.state;
    let left = days;
    while (left > 1e-9 && !s.ended) {
      const dt = Math.min(left, MAX_TICK_DAYS);
      left -= dt;
      const before = Math.floor(s.day);
      const seasonBefore = seasonOf(s.day);
      s.day += dt;
      for (const m of MODULES) m.step?.(s, dt);
      const after = Math.floor(s.day);
      for (let d = before + 1; d <= after; d++) {
        emit(s, { type: 'day', day: d });
        for (const m of MODULES) m.onDay?.(s, d);
        if (d % DAYS_PER_MONTH === 0) {
          const dp = dateOf(d);
          emit(s, { type: 'month', month: dp.month, year: dp.year });
          if (dp.season !== seasonBefore && dp.month % 3 === 0) emit(s, { type: 'season', season: dp.season });
          emit(s, { type: 'rent_day' });
          for (const m of MODULES) m.onMonth?.(s, dp.monthIndex);
        }
      }
    }
  }

  /** Validate + apply. Never throws for a bad action: returns a refusal. */
  dispatch(action: Action): ActionResult {
    const s = this.state;
    if (s.ended && action.type !== 'set_speed' && action.type !== 'mark_seen') {
      return { ok: false, code: 'ended', reason: 'The reign is over.' };
    }
    const h = (HANDLERS as Record<string, ((s: GameState, a: Action) => ActionResult) | undefined>)[action.type];
    if (!h) return { ok: false, code: 'invalid', reason: 'No one at court knows how to do that.' };
    try {
      return h(s, action);
    } catch (e) {
      console.error('[sim] action failed', action, e);
      return { ok: false, code: 'invalid', reason: 'Something went awry in the doing of it.' };
    }
  }

  /** Dry run: would this action be accepted? (Runs on a deep copy; slow — use sparingly, never per frame.) */
  wouldAccept(action: Action): ActionResult {
    const copy = new Sim(deserialize(serialize(this.state)));
    return copy.dispatch(action);
  }

  setSpeed(speed: Speed): void { this.state.speed = speed; }

  on(cb: (events: SimEvent[]) => void): () => void {
    this.listeners.push(cb);
    return () => { this.listeners = this.listeners.filter(l => l !== cb); };
  }

  /** Take the events raised since the last drain (also sent to listeners). */
  drain(): SimEvent[] {
    const s = this.state;
    if (s._events.length === 0) return [];
    const evs = s._events;
    s._events = [];
    for (const l of this.listeners) l(evs);
    return evs;
  }
}

export type { GameState, Action, ActionResult, SimEvent };
export * from './types';
