/**
 * AudioCore: everything that makes sound, on one BaseAudioContext. The live
 * game wraps it with a lazily created AudioContext (index.ts); the offline
 * check (src/dev/audio-check.ts) drives the very same object on an
 * OfflineAudioContext with a virtual clock.
 */
import type { GameState, SimEvent } from '../sim/types';
import type { SfxId } from '../data/ids';
import type { MusicMood } from './api';
import { Engine, type Rand, clamp, holdAt } from './engine';
import { PER_ID_CAP, RECIPES, STEADY, TRIM, WET } from './sfx';
import { Music } from './music';
import { Ambience, type PlayOpts } from './ambience';
import { EventRouter, type RouterHost } from './events';
import { speak } from './voice';

/** sounds that take the place of an older copy rather than being dropped when at their cap */
const STEAL = new Set<SfxId>(['bell', 'horn', 'fanfare', 'herald', 'thunder']);
const MAX_VOICES = 30;
/** at most this many people talking at once; a fourth politely cuts off the oldest */
const MAX_SPEAKERS = 3;
/** seconds an explicit setMood() outranks the realm's own mood */
const EXPLICIT_HOLD = 8;

interface Active { id: SfxId; start: number; end: number; out: GainNode; pan: StereoPannerNode }

export interface CoreOptions { realtime: boolean; rand?: Rand }

export class AudioCore implements RouterHost {
  readonly e: Engine;
  readonly music: Music;
  readonly amb: Ambience;
  readonly router: EventRouter;
  readonly realtime: boolean;
  private active: Active[] = [];
  private readonly lastAt = new Map<SfxId, number>();
  private virtual: number | null = null;
  private speeches: { end: number; start: number; cut(at: number): void }[] = [];
  private explicit: { mood: MusicMood; at: number; day: number | null } | null = null;
  private held: { mood: MusicMood; until: number } | null = null;
  private candidate: MusicMood | null = null;
  private candidateSince = 0;
  private lastSwitch = -99;

  constructor(ctx: BaseAudioContext, o: CoreOptions) {
    this.realtime = o.realtime;
    this.e = new Engine(ctx, o.rand ?? Math.random);
    this.music = new Music(this.e, () => this.e.rand(), o.realtime);
    this.amb = new Ambience(this.e, (id, opts, at) => this.play(id, opts, at), () => this.e.rand(), o.realtime);
    this.router = new EventRouter(this);
  }

  now(): number { return this.virtual ?? this.e.ctx.currentTime; }
  rand(): number { return this.e.rand(); }
  /** offline rendering: pretend the clock reads `t` (null returns to the context clock) */
  setVirtualTime(t: number | null): void { this.virtual = t; }

  // ───────────── sound effects ─────────────

  play(id: SfxId, opts: PlayOpts = {}, at?: number): number {
    const recipe = RECIPES[id];
    if (!recipe) return -1;
    const now = this.now();
    const e = this.e;
    let t = Math.max(at ?? now, now) + 0.004 + e.rand() * 0.008;
    // repeats of one sound never land on top of each other
    const last = this.lastAt.get(id) ?? -99;
    if (t - last < 0.022) t = last + 0.025 + e.rand() * 0.035;
    this.lastAt.set(id, t);
    this.sweep(now);
    const cap = PER_ID_CAP[id] ?? 3;
    const same = this.active.filter(a => a.id === id && a.end > t);
    if (same.length >= cap) {
      if (!STEAL.has(id)) return -1;
      this.fade(same[0]!, now);
    }
    const ringing = this.active.filter(a => a.end > now);
    if (ringing.length >= MAX_VOICES) this.fade(ringing[0]!, now);
    const vol = clamp(opts.volume ?? 1, 0, 2) * (TRIM[id] ?? 1);
    if (vol <= 0) return -1;
    const pan = e.panner(opts.pan ?? 0, e.sfxIn);
    const wet = WET[id];
    if (wet) pan.connect(e.gain(wet, e.sfxWet));
    const out = e.gain(vol, pan);
    const rate = clamp(opts.rate ?? 1, 0.25, 4) * (1 + (e.rand() - 0.5) * (STEADY.has(id) ? 0.008 : 0.05));
    let end: number;
    try {
      end = recipe({ e, out, t, r: rate });
    } catch (err) {
      console.warn('[audio] sfx ' + id + ' failed: ' + String(err));
      if (this.realtime) pan.disconnect();
      return -1;
    }
    this.active.push({ id, start: t, end, out, pan });
    return end;
  }

  private fade(a: Active, now: number): void {
    holdAt(a.out.gain, now);
    a.out.gain.setTargetAtTime(0, now, 0.015);
    a.end = Math.min(a.end, now + 0.1);
  }

  /** drop finished sounds; live, also disconnect them so the graph stays small */
  private sweep(now: number): void {
    if (!this.active.length) return;
    const keep: Active[] = [];
    for (const a of this.active) {
      if (a.end + 0.4 < now) { if (this.realtime) a.pan.disconnect(); }
      else keep.push(a);
    }
    this.active = keep;
  }

  activeCount(): number { return this.active.filter(a => a.end > this.now()).length; }

  // ───────────── voices ─────────────

  voice(seed: number, text: string, opts: { pitch?: number; rate?: number } = {}): { stop(): void } {
    const now = this.now();
    // a crowded table: the longest-talking speaker yields the floor
    const talking = this.speeches.filter(s => s.end > now).sort((a, b) => a.start - b.start);
    for (let i = 0; i <= talking.length - MAX_SPEAKERS; i++) talking[i]!.cut(now);
    const sp = speak(this.e, this.e.voiceIn, now + 0.02, seed, text, opts);
    if (sp.end <= now + 0.03) return { stop() { /* silent line */ } };
    const rec: { end: number; start: number; cut(at: number): void } = {
      end: sp.end, start: now,
      cut(at: number) { sp.stop(at); this.end = Math.min(this.end, at); },
    };
    this.speeches.push(rec);
    this.duck(now);
    return {
      stop: () => {
        const n = this.now();
        rec.cut(n);
        this.duck(n);
      },
    };
  }

  /** how many voices are talking right now */
  speakingCount(): number { const n = this.now(); return this.speeches.filter(s => s.end > n).length; }

  /** the music leans back while someone is talking */
  private duck(now: number): void {
    this.speeches = this.speeches.filter(s => s.end > now - 0.5);
    const until = this.speeches.reduce((m, s) => Math.max(m, s.end), 0);
    const g = this.e.musicIn.gain;
    holdAt(g, now);
    if (until > now) {
      g.setTargetAtTime(0.55, now, 0.08);
      g.setTargetAtTime(1, until + 0.1, 0.35);
    } else {
      g.setTargetAtTime(1, now, 0.35);
    }
  }

  // ───────────── music moods ─────────────

  setMood(m: MusicMood): void {
    const now = this.now();
    if (this.explicit && this.explicit.mood === m) { this.explicit.at = now; return; }
    this.explicit = { mood: m, at: now, day: null };
    this.held = null;
    this.switchTo(m, now);
  }

  eventMood(m: MusicMood, secs: number): void {
    const now = this.now();
    this.held = { mood: m, until: now + secs };
    this.switchTo(m, now);
  }

  private switchTo(m: MusicMood, now: number): void {
    if (this.music.current() === m) return;
    this.music.setMood(m, now);
    this.lastSwitch = now;
  }

  autoMood(want: MusicMood, state: GameState): void {
    const now = this.now();
    const ex = this.explicit;
    if (ex) {
      if (ex.day === null) ex.day = state.day;
      // an audience keeps the realm at a crawl (or paused): the court stays attentive until it rises
      if (ex.mood === 'court' && state.speed <= 0.1 && !state.ended) ex.at = now;
      // 'off' holds until told otherwise; 'title' while the realm stands still; any mood for a few seconds after the last call
      const hold = ex.mood === 'off' || now - ex.at < EXPLICIT_HOLD || (ex.mood === 'title' && Math.abs(state.day - ex.day) < 0.3);
      if (hold) return;
      this.explicit = null;
    }
    if (this.held) {
      if (now < this.held.until && !(state.ended && this.held.mood !== 'defeat')) return;
      this.held = null;
    }
    const cur = this.music.current();
    // a paused realm keeps the tune it had: nothing on the table is changing, so neither does the music
    if (state.speed === 0 && cur !== 'off' && cur !== 'title' && !state.ended) { this.candidate = null; return; }
    if (want === cur) { this.candidate = null; return; }
    if (want !== this.candidate) { this.candidate = want; this.candidateSince = now; }
    const urgent = want === 'rent_day' || want === 'defeat' || cur === 'off' || cur === 'title';
    const settle = urgent ? 0 : (cur === 'busy' && want === 'calm') ? 10 : 4;
    const dwell = urgent ? 0 : 12;
    if (now - this.candidateSince >= settle && now - this.lastSwitch >= dwell) this.switchTo(want, now);
  }

  tempo(target: number, drums: number): void {
    this.music.targetTempo = target;
    this.music.drumMul = drums;
  }

  // ───────────── the game's calls ─────────────

  handleEvents(events: readonly SimEvent[], state: GameState): void {
    if (events.length) this.router.handle(events, state);
    this.pump();
  }

  update(state: GameState): void {
    this.router.update(state);
    this.pump();
  }

  /** schedule music, ambience and the coin shower a little way ahead */
  pump(): void {
    const now = this.now();
    const hidden = this.realtime && typeof document !== 'undefined' && document.hidden;
    const horizon = hidden ? 2.5 : 0.6;
    // each part on its own, so a fault in one never silences the others
    this.safely('music', () => this.music.schedule(now, horizon));
    this.safely('ambience', () => this.amb.schedule(now, now + horizon));
    this.safely('coins', () => this.router.tick(now, now + horizon));
    if (this.realtime) this.sweep(now);
  }

  private readonly faults = new Set<string>();
  private safely(part: string, fn: () => void): void {
    try { fn(); } catch (err) {
      if (this.faults.has(part)) return;
      this.faults.add(part);
      console.warn('[audio] ' + part + ': ' + String(err));
    }
  }

  setVolumes(v: { master?: number; music?: number; sfx?: number; voice?: number }): void {
    const now = this.now();
    for (const k of ['master', 'music', 'sfx', 'voice'] as const) {
      const x = v[k];
      if (typeof x === 'number' && Number.isFinite(x)) this.e.setVolume(k, x, now);
    }
  }

  dispose(): void {
    const now = this.now();
    this.music.dispose();
    this.amb.dispose(now);
    for (const a of this.active) a.pan.disconnect();
    this.active = [];
  }
}
