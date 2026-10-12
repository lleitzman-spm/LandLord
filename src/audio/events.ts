/**
 * Sim events to sound: coins on rent (rate-limited into a shower), the bell
 * on Rent Day, the horn for the Crown, hammering at work sites, the seal on
 * every settled matter, the gavel for the court, and the music's mood read
 * from the state of the realm.
 */
import { MAP_W, type GameState, type Herald, type SimEvent } from '../sim/types';
import type { SfxId, VisualId } from '../data/ids';
import { dateOf } from '../sim/core';
import { BAL } from '../data/balance';
import { INCIDENT_BY_ID } from '../data/incidents/index';
import type { MusicMood } from './api';
import type { Ambience, PlayOpts, Site } from './ambience';
import { clamp } from './engine';

export interface RouterHost {
  now(): number;
  rand(): number;
  play(id: SfxId, opts?: PlayOpts, at?: number): number;
  readonly amb: Ambience;
  /** a mood the state calls for (the host applies explicit holds and hysteresis) */
  autoMood(m: MusicMood, state: GameState): void;
  /** a mood an event calls for, held for `secs` */
  eventMood(m: MusicMood, secs: number): void;
  tempo(target: number, drums: number): void;
}

const WORK_KINDS = new Set(['build', 'repair', 'renovate', 'demolish', 'clear_land']);

/** what a building sounds like when a visual appears on it */
const VISUAL_SFX: Partial<Record<VisualId, [SfxId, number]>> = {
  griffin_roof: ['squawk', 0.6], fire: ['fire', 0.55], flood: ['splash', 0.5], rats: ['squeak', 0.45],
  small_dragon: ['growl', 0.5], purple_paint: ['magic', 0.4], sparkles: ['magic', 0.35], curse_cloud: ['magic', 0.4],
  toadstool_ring: ['magic', 0.3], ghost: ['whoosh', 0.4], goblins_windows: ['pop', 0.4], party: ['pluck', 0.5],
  bunting: ['pluck', 0.4], black_smoke: ['fire', 0.35], cracked_wall: ['crumble', 0.3], hole_roof: ['crumble', 0.3],
  leak: ['splash', 0.2], bats: ['squeak', 0.3], cauldron: ['magic', 0.25],
};

const panOfX = (x: number): number => clamp((x - MAP_W / 2) / (MAP_W / 2), -1, 1) * 0.6;

/** a sound the sim asked for by name that the router already played within this window (seconds) is not played twice */
const ECHO_BEFORE = 0.35, ECHO_AFTER = 1.5;

export class EventRouter {
  private readonly last = new Map<string, number>();
  /** when the router last scheduled each sound, so the sim's own `sfx` events never double it */
  private readonly played = new Map<SfxId, number>();
  private coinBacklog = 0;
  private coinPan = 0;
  private coinNext = 0;
  private lastPour = -9;
  private lastCoin = -9;
  private readonly snap = new Map<string, { vis: string[]; state: string }>();
  private snapped = false;
  private lastScan = -9;

  constructor(private readonly host: RouterHost) {}

  private ok(key: string, gap: number): boolean {
    const now = this.host.now();
    const l = this.last.get(key) ?? -99;
    if (now - l < gap) return false;
    this.last.set(key, now);
    return true;
  }

  private panB(state: GameState, id: string | undefined | null): number {
    const b = id ? state.buildings[id] : undefined;
    return b ? panOfX(b.x + b.w / 2) : 0;
  }

  /** play through the host and remember when */
  private play(id: SfxId, opts?: PlayOpts, at?: number): number {
    const end = this.host.play(id, opts, at);
    if (end >= 0) this.played.set(id, Math.max(at ?? 0, this.host.now()));
    return end;
  }

  private echoes(id: SfxId, now: number): boolean {
    const t = this.played.get(id);
    return t !== undefined && t > now - ECHO_BEFORE && t < now + ECHO_AFTER;
  }

  handle(events: readonly SimEvent[], state: GameState): void {
    const h = this.host, now = h.now();
    const P = (id: SfxId, opts?: PlayOpts, at?: number) => this.play(id, opts, at);
    let major = false, dirty = false, brassy = false, cheers = 0;
    const heralds: Herald[] = [];
    // the sim also names sounds itself; those wait for the end of the batch so the richer cue above wins
    const asked: Extract<SimEvent, { type: 'sfx' }>[] = [];
    for (const ev of events) {
      switch (ev.type) {
        case 'rent_paid':
        case 'purse_collected':
          this.coin(this.panB(state, ev.buildingId));
          break;
        case 'rent_day':
          // the town bell: three strokes at dawn
          P('bell', { volume: 0.75 }); P('bell', { volume: 0.62 }, now + 1.6); P('bell', { volume: 0.55 }, now + 3.2);
          major = true; brassy = true;
          break;
        case 'herald': heralds.push(ev.herald); break;
        case 'job': this.job(ev.jobId, ev.phase, state); break;
        case 'building_placed': P('place', { pan: this.panB(state, ev.buildingId) }); dirty = true; break;
        case 'building_done': P('build_done', { pan: this.panB(state, ev.buildingId) }); major = true; break;
        case 'building_removed': P('crumble', { volume: 0.7, pan: panOfX(ev.x + ev.w / 2) }); break;
        case 'building_changed': case 'incident': dirty = true; break;
        case 'incident_resolved': this.resolved(ev.incidentId, ev.outcomeId, ev.by, state); dirty = true; break;
        case 'incident_expired': P('thud', { volume: 0.32 }); dirty = true; break;
        case 'promotion': P('fanfare'); h.eventMood('triumph', 22); major = true; brassy = true; break;
        case 'demotion': P('error', { volume: 0.8 }); P('sigh', { volume: 0.5 }, now + 0.35); h.eventMood('defeat', 15); major = true; break;
        case 'charter_ready': P('herald'); major = true; brassy = true; break;
        case 'game_over': P('bell', { volume: 0.8, rate: 0.75 }); P('bell', { volume: 0.6, rate: 0.75 }, now + 2.4); h.eventMood('defeat', 3600); major = true; brassy = true; break;
        case 'tenant_in': P('door', { volume: 0.5, pan: this.panB(state, ev.buildingId) }); break;
        case 'tenant_out':
          if (ev.reason === 'evicted') { P('door', { volume: 0.6, pan: this.panB(state, ev.buildingId) }); P('thud', { volume: 0.45 }, now + 0.7); }
          else if (ev.reason !== 'ruin') P('door', { volume: 0.42, pan: this.panB(state, ev.buildingId) });
          break;
        case 'applicant': if (this.ok('applicant', 2)) P('knock', { volume: 0.38, pan: this.panB(state, ev.buildingId) }); break;
        case 'rent_late': if (this.ok('late', 1.5)) P('error', { volume: 0.38, pan: this.panB(state, ev.buildingId) }); break;
        case 'staff_hired': P('success', { volume: 0.7 }); break;
        case 'staff_left': P('door', { volume: 0.5 }); break;
        case 'order_added': P('quill', { volume: 0.7 }); break;
        case 'order_revoked': P('page', { volume: 0.7 }); break;
        case 'oath':
          if (ev.state === 'open') { P('quill', { volume: 0.6 }); P('stamp', { volume: 0.6 }, now + 0.55); }
          else if (ev.state === 'kept') { P('success', { volume: 0.6 }); P('chime', { volume: 0.4 }, now + 0.2); }
          else if (ev.state === 'broken') { P('error', { volume: 0.6 }); P('boo', { volume: 0.3 }, now + 0.25); }
          else P('page', { volume: 0.5 });
          break;
        case 'tribute': if (ev.paid) P('coins', { volume: 0.5 }); else P('error', { volume: 0.6 }); break;
        case 'parcel_bought': P('coins', { volume: 0.6 }); P('stamp', { volume: 0.7 }, now + 0.4); break;
        case 'goal': if (this.ok('goal', 1)) P('chime', { volume: 0.5, rate: 1.5 }); break;
        case 'emote': if (ev.emote === 'cheer') cheers++; break;
        case 'gold':
          if (ev.cat === 'gifts' && ev.amount <= -0.9 * BAL.feastCost[state.realm.rank]) { if (this.cheer(0.7)) major = true; }
          else if (ev.cat === 'windfall' && ev.amount > 0 && this.ok('windfall', 0.6)) this.coin(this.panB(state, ev.buildingId));
          break;
        case 'weather':
          h.amb.setWeather(ev.kind, dateOf(state.day).season, now);
          break;
        case 'sfx': asked.push(ev); break;
        default: break;
      }
    }
    // one tenant cheering is a face on the table; three at once is a crowd
    if (cheers >= 3 && this.cheer(0.45)) major = true;
    const said = new Set<SfxId>();
    for (const ev of asked) {
      if (said.has(ev.id)) continue;
      said.add(ev.id);
      const pan = this.panB(state, ev.buildingId);
      if (ev.id === 'cheer') { if (this.cheer(0.7, pan)) major = true; continue; }
      if (this.echoes(ev.id, now)) continue;
      // a purse tipped into the coffer: the pour stands in for the shower's own
      if (ev.id === 'coins') this.lastPour = now;
      P(ev.id, { pan });
    }
    if (dirty) this.diff(state, true);
    // heralds last: the horn for the Crown and for alarms; otherwise a soft chime, unless something bigger already spoke
    for (const hd of heralds) {
      if (/\bfeast/i.test(hd.text) && this.cheer(0.6)) major = true;
      if (hd.kind === 'crown') { if (!brassy && this.ok('horn', 2.5)) P('horn'); }
      else if (hd.kind === 'urgent') { if (!brassy && this.ok('horn', 2.5)) P('horn', { volume: 0.7 }); }
      else if (!major && this.ok('chime', 0.9)) P('chime', hd.kind === 'bad' ? { volume: 0.28, rate: 0.75 } : { volume: 0.36 });
    }
  }

  /** the crowd: one cheer however many of the feast's signals arrive together */
  private cheer(volume: number, pan = 0): boolean {
    if (!this.ok('cheer', 4)) return false;
    this.play('cheer', { volume, pan });
    return true;
  }

  private coin(pan: number): void {
    if (this.coinBacklog >= 14) return;
    this.coinPan = this.coinBacklog ? (this.coinPan * this.coinBacklog + pan) / (this.coinBacklog + 1) : pan;
    this.coinBacklog++;
  }

  private job(jobId: string, phase: string, state: GameState): void {
    const j = state.jobs[jobId];
    if (!j) return;
    const pan = panOfX(j.x);
    const P = (id: SfxId, v: number) => this.play(id, { volume: v, pan });
    if (phase === 'arrive') {
      if (j.kind === 'serve_notice' || j.kind === 'evict') P('knock', 0.6);
      else if (j.kind === 'visit') P('knock', 0.42);
      else if (j.kind === 'show') P('door', 0.38);
      else if (j.kind === 'inspect') P('page', 0.4);
      else if (j.kind === 'screen') P('quill', 0.4);
    } else if (phase === 'done') {
      if (j.kind === 'repair' || j.kind === 'renovate') P('build_done', 0.5);
      else if (j.kind === 'serve_notice') P('hammer', 0.6); // the Notice, nailed to the door
      else if (j.kind === 'clear_land') P('thud', 0.5);
    }
  }

  private resolved(incidentId: string, outcomeId: string, by: string, state: GameState): void {
    const inc = state.incidents[incidentId];
    const def = inc ? INCIDENT_BY_ID[inc.defId] : undefined;
    const out = def?.outcomes.find(o => o.id === outcomeId);
    const pan = this.panB(state, inc?.buildingId);
    this.play('stamp', { volume: by === 'ruler' ? 0.8 : 0.45, pan });
    const court = !!def && (def.decision === 'eviction_ready' || def.category === 'legal'
      || out?.option === 'notice' || out?.option === 'evict' || /court|writ|judge|magistrate/.test(def.id));
    if (court) this.play('gavel', { volume: 0.75 }, this.host.now() + 0.3);
  }

  /** compare buildings with the last look: new visuals and ruins make their sound */
  private diff(state: GameState, audible: boolean): void {
    const seen = new Set<string>();
    for (const b of Object.values(state.buildings)) {
      seen.add(b.id);
      const prev = this.snap.get(b.id);
      if (audible && prev) {
        const pan = panOfX(b.x + b.w / 2);
        if (prev.state !== 'ruined' && b.state === 'ruined' && this.ok('ruin:' + b.id, 3)) this.play('crumble', { pan });
        for (const v of b.visuals) {
          if (prev.vis.includes(v)) continue;
          const s = VISUAL_SFX[v];
          if (s && this.ok('vis:' + v, 1.5)) this.play(s[0], { volume: s[1], pan });
        }
      }
      if (!prev || prev.state !== b.state || prev.vis.length !== b.visuals.length || prev.vis.some((v, i) => v !== b.visuals[i])) {
        this.snap.set(b.id, { vis: b.visuals.slice(), state: b.state });
      }
    }
    for (const k of [...this.snap.keys()]) if (!seen.has(k)) this.snap.delete(k);
  }

  /** each frame: cheap, and only does real work a few times a second */
  update(state: GameState): void {
    const h = this.host, now = h.now();
    if (!this.snapped) { this.diff(state, false); this.snapped = true; }
    if (now - this.lastScan < 0.3) return;
    this.lastScan = now;
    this.diff(state, true);
    const d = dateOf(state.day);
    h.amb.setWeather(state.weather, d.season, now);
    // work sites (nobody works while the realm is paused)
    const sites: Site[] = [];
    if (state.speed > 0) {
      for (const j of Object.values(state.jobs)) {
        if (j.state === 'working' && WORK_KINDS.has(j.kind)) sites.push({ id: j.id, kind: j.kind, pan: panOfX(j.x) });
        if (sites.length >= 3) break;
      }
    }
    h.amb.setSites(sites);
    let griffin: number | null = null;
    for (const b of Object.values(state.buildings)) if (b.visuals.includes('griffin_roof')) { griffin = panOfX(b.x + b.w / 2); break; }
    h.amb.setGriffin(griffin);
    h.tempo(state.speed === 0 ? 0.82 : state.speed === 0.1 ? 0.9 : 1, state.speed === 0 ? 0.45 : 1);
    h.autoMood(this.moodOf(state), state);
  }

  /** the coin shower: a single rent is a clink; twenty at once is a pour and a sparkle of clinks */
  tick(now: number, until: number): void {
    if (this.coinBacklog <= 0) return;
    const rnd = () => this.host.rand();
    if (this.coinBacklog >= 4 && now - this.lastPour > 1.2) {
      this.play('coins', { volume: Math.min(1, 0.55 + this.coinBacklog * 0.04), pan: this.coinPan });
      this.lastPour = now;
      this.coinBacklog = Math.min(this.coinBacklog - 3, 7);
      this.coinNext = now + 0.15;
    }
    if (this.coinNext < now - 0.2) this.coinNext = now;
    while (this.coinBacklog > 0 && this.coinNext < until) {
      const t = Math.max(this.coinNext, now);
      const alone = this.coinBacklog === 1 && t - this.lastCoin > 0.6;
      this.play('coin', { volume: alone ? 0.7 : 0.38 + rnd() * 0.25, pan: this.coinPan + (rnd() - 0.5) * 0.4 }, t);
      this.lastCoin = t;
      this.coinBacklog--;
      this.coinNext = t + 0.085 + rnd() * 0.09;
    }
  }

  /** the mood the realm calls for */
  moodOf(state: GameState): MusicMood {
    if (state.ended) return 'defeat';
    const d = dateOf(state.day);
    if (d.dom <= 3) return 'rent_day';
    let open = 0, urgent = 0;
    for (const inc of Object.values(state.incidents)) {
      if (inc.state !== 'open' && inc.state !== 'in_progress') continue;
      open++;
      if (inc.state === 'open' && (INCIDENT_BY_ID[inc.defId]?.urgency ?? 1) >= 3) urgent++;
    }
    const debt = state.loans.reduce((s, l) => s + l.principal, 0);
    if (urgent >= 2 || state.gold < 0 || (debt > 0 && debt > Math.max(50, state.gold)) || state.favor < 15) return 'tense';
    if (d.season === 'winter') return 'winter';
    let working = 0, purses = 0;
    for (const j of Object.values(state.jobs)) if (j.state === 'working' || j.state === 'traveling') working++;
    for (const b of Object.values(state.buildings)) for (const u of b.units) if (u.purse > 0) purses++;
    const busy = open + working * 0.5 + Object.keys(state.applicants).length * 0.5 + purses * 0.3;
    return busy >= 4 ? 'busy' : 'calm';
  }
}
