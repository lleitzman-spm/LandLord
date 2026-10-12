/**
 * The room outside the window: weather beds (rain, wind, the storm's low
 * rumble and its thunder), the hammering of whatever is being built or
 * mended, and the occasional opinion of a griffin.
 */
import type { Season, WeatherKind } from '../sim/types';
import type { SfxId } from '../data/ids';
import { Engine, type Rand, holdAt, perc, stopAt } from './engine';

export interface PlayOpts { volume?: number; pan?: number; rate?: number }
export type PlayFn = (id: SfxId, opts: PlayOpts, at: number) => number;

/** an active work site: job id, job kind, stereo position */
export interface Site { id: string; kind: string; pan: number }

type BedId = 'rain' | 'wind' | 'rumble';
interface Bed {
  out: GainNode;
  srcs: AudioScheduledSourceNode[];
  level: number;
  zeroSince: number;
  /** wind: the gust controls, one band per side */
  bands?: { f: BiquadFilterNode; g: GainNode }[];
  rainLp?: BiquadFilterNode;
}

export class Ambience {
  private readonly beds = new Map<BedId, Bed>();
  private readonly target: Record<BedId, number> = { rain: 0, wind: 0, rumble: 0 };
  private heavy = 0;
  private hail = false;
  private weatherKey = '';
  private nextDrop = 0;
  private nextGust = 0;
  private nextThunder = Infinity;
  private sites: Site[] = [];
  private readonly siteNext = new Map<string, number>();
  private griffinPan: number | null = null;
  private nextSquawk = Infinity;

  constructor(private readonly e: Engine, private readonly play: PlayFn, private readonly rnd: Rand, private readonly realtime = true) {}

  setWeather(kind: WeatherKind, season: Season, now: number): void {
    const key = kind + ':' + season;
    if (key === this.weatherKey) return;
    this.weatherKey = key;
    let rain = 0, wind = 0, rumble = 0, thunder = false;
    this.hail = false;
    switch (kind) {
      case 'rain': rain = 0.15; wind = season === 'winter' ? 0.1 : 0.04; this.heavy = 0.35; break;
      case 'storm': rain = 0.22; wind = 0.2; rumble = 0.18; thunder = true; this.heavy = 1; break;
      case 'hail': rain = 0.13; wind = 0.14; this.heavy = 0.6; this.hail = true; break;
      case 'snow': wind = 0.26; break;
      case 'fog': wind = 0.1; break;
      case 'heat': break;
      default: wind = season === 'winter' ? 0.16 : 0;
    }
    this.target.rain = rain; this.target.wind = wind; this.target.rumble = rumble;
    if (thunder) { if (this.nextThunder === Infinity) this.nextThunder = now + 2.5 + this.rnd() * 5; }
    else this.nextThunder = Infinity;
    const lp = this.beds.get('rain')?.rainLp;
    if (lp) lp.frequency.setTargetAtTime(2600 + this.heavy * 2400, now, 1);
  }

  setSites(sites: Site[]): void {
    this.sites = sites.slice(0, 3);
    const live = new Set(this.sites.map(s => s.id));
    for (const k of [...this.siteNext.keys()]) if (!live.has(k)) this.siteNext.delete(k);
  }

  setGriffin(pan: number | null): void {
    this.griffinPan = pan;
    if (pan === null) this.nextSquawk = Infinity;
  }

  schedule(now: number, until: number): void {
    const e = this.e, rnd = this.rnd;
    // ── beds: fade toward their targets, build lazily, tear down after a quiet spell
    for (const id of ['rain', 'wind', 'rumble'] as const) {
      const tgt = this.target[id];
      let bed = this.beds.get(id);
      if (!bed && tgt > 0) { bed = this.makeBed(id, now); this.beds.set(id, bed); }
      if (!bed) continue;
      if (bed.level !== tgt) {
        holdAt(bed.out.gain, now);
        bed.out.gain.setTargetAtTime(tgt, now, 1.2);
        bed.level = tgt;
        bed.zeroSince = tgt === 0 ? now : Infinity;
      }
      if (tgt === 0 && now - bed.zeroSince > 7) {
        for (const s of bed.srcs) stopAt(s, now + 0.05);
        if (this.realtime) bed.out.disconnect();
        this.beds.delete(id);
      }
    }
    // ── gusts
    const wind = this.beds.get('wind');
    if (wind?.bands && now >= this.nextGust) {
      for (const b of wind.bands) {
        b.f.frequency.setTargetAtTime(240 + rnd() * 720, now, 0.9);
        b.g.gain.setTargetAtTime(0.35 + rnd() * 0.65, now, 0.7);
      }
      const rumble = this.beds.get('rumble');
      rumble?.bands?.[0]?.g.gain.setTargetAtTime(0.5 + rnd() * 0.5, now, 1.1);
      this.nextGust = now + 1.2 + rnd() * 2;
    }
    // ── rain on the thatch: drops and the odd drip
    if (this.target.rain > 0) {
      if (this.nextDrop < now - 0.5) this.nextDrop = now;
      const rate = 3 + this.heavy * 7 + (this.hail ? 6 : 0);
      while (this.nextDrop < until) {
        try { this.drop(this.nextDrop); } catch { /* one lost raindrop */ }
        this.nextDrop += (-Math.log(1 - rnd() * 0.999) / rate);
      }
    }
    // ── thunder
    if (this.nextThunder < until) {
      this.play('thunder', { volume: 0.45 + rnd() * 0.45, pan: rnd() * 1.2 - 0.6 }, Math.max(now, this.nextThunder));
      this.nextThunder = Math.max(now, this.nextThunder) + 7 + rnd() * 15;
    }
    // ── work sites
    for (const s of this.sites) {
      let nx = this.siteNext.get(s.id) ?? now + rnd() * 0.6;
      if (nx < now - 0.5) nx = now + rnd() * 0.3;
      while (nx < until) nx = this.workBurst(s, nx);
      this.siteNext.set(s.id, nx);
    }
    // ── the griffin, keeping its opinions to roughly once a minute
    if (this.griffinPan !== null) {
      if (this.nextSquawk === Infinity) this.nextSquawk = now + 12 + rnd() * 20;
      if (this.nextSquawk < until) {
        this.play('squawk', { volume: 0.2, pan: this.griffinPan, rate: 0.92 + rnd() * 0.16 }, Math.max(now, this.nextSquawk));
        this.nextSquawk = Math.max(now, this.nextSquawk) + 28 + rnd() * 35;
      }
    }
  }

  /** one burst of work at a site; returns when the next burst starts */
  private workBurst(s: Site, t: number): number {
    const rnd = this.rnd, pan = s.pan;
    if (s.kind === 'demolish') {
      this.play('thud', { volume: 0.3, pan }, t);
      if (rnd() < 0.35) this.play('crumble', { volume: 0.2, pan }, t + 0.25);
      return t + 1.4 + rnd() * 1.6;
    }
    if (s.kind === 'clear_land') {
      if (rnd() < 0.5) { this.play('saw', { volume: 0.2, pan }, t); return t + 1.6 + rnd() * 1.5; }
      // axe: a deeper, slower chop
      this.play('hammer', { volume: 0.28, pan, rate: 0.62 }, t);
      this.play('hammer', { volume: 0.3, pan, rate: 0.6 }, t + 0.55 + rnd() * 0.1);
      return t + 1.8 + rnd() * 1.4;
    }
    if ((s.kind === 'build' || s.kind === 'renovate') && rnd() < 0.22) {
      this.play('saw', { volume: 0.18, pan }, t);
      return t + 1.5 + rnd() * 1.3;
    }
    const n = 2 + Math.floor(rnd() * 3);
    const gap = 0.3 + rnd() * 0.12;
    for (let i = 0; i < n; i++) {
      this.play('hammer', { volume: (0.22 + rnd() * 0.06) * (i === n - 1 ? 1.15 : 1), pan, rate: 0.95 + rnd() * 0.12 }, t + i * gap);
    }
    return t + (n - 1) * gap + 0.9 + rnd() * 1.5;
  }

  /** one raindrop (or hailstone) on thatch and wood, straight to the ambience bus */
  private drop(t: number): void {
    const e = this.e, rnd = this.rnd;
    const lvl = this.target.rain;
    const pan = e.panner(rnd() * 1.6 - 0.8, e.ambIn);
    if (this.hail && rnd() < 0.6) {
      e.modal(pan, t, 1400 + rnd() * 1400, [[1, 1, 0.03], [2.3, 0.5, 0.02]], lvl * (0.12 + rnd() * 0.1), 0.0004);
      return;
    }
    if (rnd() < 0.12) {
      // a drip into a puddle: the little upward bubble
      const g = e.gain(0, pan);
      const end = perc(g.gain, t, lvl * 0.09, 0.001, 0.05);
      const f = 800 + rnd() * 700;
      const o = e.osc('sine', f, t, end, g);
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 1.7, t + 0.03);
      return;
    }
    e.burst(pan, t, 'white', 'bandpass', 2200 + rnd() * 3500, 1.4, lvl * (0.05 + rnd() * 0.07), 0.0005, 0.02);
  }

  private makeBed(id: BedId, now: number): Bed {
    const e = this.e;
    const out = e.gain(0, e.ambIn);
    const far = now + 3600;
    const bed: Bed = { out, srcs: [], level: -1, zeroSince: Infinity };
    if (id === 'rain') {
      const lp = e.filter('lowpass', 2600 + this.heavy * 2400, 0.6, out);
      const hp = e.filter('highpass', 350, 0.6, lp);
      for (const p of [-0.6, 0.6]) bed.srcs.push(e.noise('pink', now, far, e.panner(p, hp)));
      bed.srcs.push(e.noise('white', now, far, e.filter('bandpass', 7000, 0.6, e.gain(0.22, out))));
      bed.rainLp = lp;
    } else if (id === 'wind') {
      bed.bands = [];
      for (const [p, kind, f, q] of [[-0.55, 'brown', 420, 2.2], [0.55, 'pink', 700, 3]] as const) {
        const g = e.gain(0.6, e.panner(p, out));
        const bp = e.filter('bandpass', f, q, g);
        bed.srcs.push(e.noise(kind, now, far, bp, kind === 'brown' ? 1 : 0.9));
        bed.bands.push({ f: bp, g });
      }
    } else {
      const g = e.gain(0.7, out);
      bed.srcs.push(e.noise('brown', now, far, e.filter('lowpass', 115, 0.7, g)));
      bed.bands = [{ f: e.filter('allpass', 1000), g }];
    }
    return bed;
  }

  dispose(now: number): void {
    for (const b of this.beds.values()) {
      for (const s of b.srcs) stopAt(s, now + 0.05);
      if (this.realtime) b.out.disconnect();
    }
    this.beds.clear();
  }
}
