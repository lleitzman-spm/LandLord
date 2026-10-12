/**
 * Generative medieval ambience: a small consort (lute or harp, recorder, a
 * drone and a frame drum) playing modal phrases from a little grammar.
 *
 * Harmony moves in four-bar progressions built from open fifths over the
 * modal degrees (the Dorian major IV, the Mixolydian flat VII, the Phrygian
 * flat II), never a leading-tone cadence. Melody is a contour-guided walk
 * that prefers steps, fills its leaps, leans on chord tones at the beats,
 * and lands phrases on the final, the fifth or the third, approached by
 * step. Motifs are remembered and come back varied (moved, turned upside
 * down), so it hangs together without ever looping.
 *
 * Each mood is a Layer; changing mood starts a new layer and fades the old.
 */
import type { MusicMood } from './api';
import { Engine, type Rand, holdAt, midiHz } from './engine';
import { Drone, RecorderVoice, drum, harp, harpBody, lute, luteBody } from './instruments';

const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10];
const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];

type Meter = 'compound' | 'duple' | 'triple'; // 6/8, 4/4, 3/4
type Accomp = 'arp6' | 'arp8' | 'strum6' | 'strum8' | 'harp' | 'sparse' | 'low';

const BAR_LEN: Record<Meter, number> = { compound: 6, duple: 8, triple: 6 };
const BEAT: Record<Meter, number> = { compound: 3, duple: 2, triple: 2 };

interface MoodSpec {
  final: number;              // midi of the final, in the lute's bass register
  mode: readonly number[];
  meter: Meter;
  eighth: number;             // seconds per eighth note at 1x
  accomp: Accomp;
  acc: number;                // accompaniment level
  melody: 'recorder' | 'harp' | 'lute' | 'none';
  mel: number;                // melody level
  melOct: number;             // melody register: octaves above the final
  range: readonly [number, number]; // melody degrees
  density: number;            // chance a phrase starts when the melody is free
  rest: readonly [number, number];  // bars of rest after a phrase
  busy: number;               // rhythmic activity 0..1
  leap: number;
  ornament: number;
  slur: number;
  drone: number;
  highDrone: number;
  drumLvl: number;
  drums: readonly string[];
  progs: readonly (readonly number[])[];
  finalW: number;             // how often a phrase may come home to the final
  gain: number;               // overall level of the mood
}

export const MOODS: Record<Exclude<MusicMood, 'off'>, MoodSpec> = {
  title: {
    final: 50, mode: DORIAN, meter: 'triple', eighth: 0.44, accomp: 'harp', acc: 0.5,
    melody: 'harp', mel: 0.5, melOct: 1, range: [0, 9], density: 0.5, rest: [1, 3], busy: 0.2, leap: 0.6, ornament: 0, slur: 0,
    drone: 0, highDrone: 0, drumLvl: 0, drums: [], progs: [[0, 0, 6, 0], [0, 0, 3, 0], [0, 4, 0, 0], [0, 6, 6, 0]], finalW: 0.35, gain: 2.2,
  },
  calm: {
    final: 50, mode: DORIAN, meter: 'compound', eighth: 0.34, accomp: 'arp6', acc: 0.42,
    melody: 'recorder', mel: 0.085, melOct: 2, range: [-3, 5], density: 0.62, rest: [1, 2], busy: 0.35, leap: 0.5, ornament: 0.12, slur: 0.25,
    drone: 0.09, highDrone: 0, drumLvl: 0.22, drums: ['D.....', 'D..t..', 'D.....', 'D..t.g'],
    progs: [[0, 0, 6, 0], [0, 3, 0, 0], [0, 0, 4, 0], [0, 6, 3, 0]], finalW: 0.4, gain: 1,
  },
  busy: {
    final: 43, mode: MIXOLYDIAN, meter: 'duple', eighth: 0.29, accomp: 'arp8', acc: 0.42,
    melody: 'recorder', mel: 0.09, melOct: 2, range: [-1, 8], density: 0.8, rest: [0, 1], busy: 0.6, leap: 0.6, ornament: 0.15, slur: 0.3,
    drone: 0.07, highDrone: 0, drumLvl: 0.3, drums: ['D.t.D.t.', 'D.tgD.t.', 'D.t.Dtt.', 'D...D.t.'],
    progs: [[0, 0, 6, 0], [0, 3, 0, 6], [0, 0, 3, 0], [0, 6, 4, 0]], finalW: 0.4, gain: 1,
  },
  rent_day: {
    final: 43, mode: MIXOLYDIAN, meter: 'compound', eighth: 0.25, accomp: 'strum6', acc: 0.42,
    melody: 'recorder', mel: 0.1, melOct: 2, range: [0, 8], density: 0.9, rest: [0, 1], busy: 0.75, leap: 0.55, ornament: 0.25, slur: 0.2,
    drone: 0.12, highDrone: 0, drumLvl: 0.36, drums: ['D.tDt.', 'D.tD.j', 'D.tDtt', 'DgtDtj'],
    progs: [[0, 0, 6, 0], [0, 3, 0, 0], [0, 6, 0, 6], [3, 0, 6, 0]], finalW: 0.45, gain: 1,
  },
  tense: {
    final: 40, mode: PHRYGIAN, meter: 'duple', eighth: 0.36, accomp: 'low', acc: 0.44,
    melody: 'recorder', mel: 0.065, melOct: 2, range: [-2, 5], density: 0.35, rest: [2, 4], busy: 0.25, leap: 0.3, ornament: 0, slur: 0.4,
    drone: 0.14, highDrone: 0, drumLvl: 0.28, drums: ['D.d.....', 'D.d.....', 'D.d...g.', 'D.......'],
    progs: [[0, 0, 1, 0], [0, 6, 0, 0], [0, 0, 1, 1], [0, 5, 6, 0]], finalW: 0.3, gain: 1,
  },
  court: {
    final: 45, mode: DORIAN, meter: 'duple', eighth: 0.36, accomp: 'sparse', acc: 0.62,
    melody: 'lute', mel: 0.5, melOct: 1, range: [0, 9], density: 0.6, rest: [1, 2], busy: 0.15, leap: 0.4, ornament: 0, slur: 0,
    drone: 0.035, highDrone: 0, drumLvl: 0.12, drums: ['........', '....t...', '........', 't.......'],
    progs: [[0, 0, 6, 0], [0, 3, 0, 0], [0, 4, 0, 0]], finalW: 0.3, gain: 2.2,
  },
  winter: {
    final: 50, mode: DORIAN, meter: 'triple', eighth: 0.46, accomp: 'harp', acc: 0.38,
    melody: 'recorder', mel: 0.075, melOct: 1, range: [0, 8], density: 0.5, rest: [1, 3], busy: 0.15, leap: 0.4, ornament: 0, slur: 0.45,
    drone: 0.05, highDrone: 0.06, drumLvl: 0, drums: [],
    progs: [[0, 0, 6, 0], [0, 4, 0, 0], [0, 3, 3, 0]], finalW: 0.35, gain: 1.9,
  },
  triumph: {
    final: 50, mode: MIXOLYDIAN, meter: 'duple', eighth: 0.27, accomp: 'strum8', acc: 0.44,
    melody: 'recorder', mel: 0.11, melOct: 2, range: [-2, 6], density: 0.95, rest: [0, 1], busy: 0.7, leap: 0.85, ornament: 0.2, slur: 0.15,
    drone: 0.1, highDrone: 0, drumLvl: 0.38, drums: ['D.tDD.t.', 'D.t.Dttt', 'D.tDD.tg', 'DtDtD.tj'],
    progs: [[0, 0, 6, 0], [0, 3, 6, 0], [0, 0, 3, 0]], finalW: 0.5, gain: 0.85,
  },
  defeat: {
    final: 50, mode: AEOLIAN, meter: 'triple', eighth: 0.5, accomp: 'sparse', acc: 0.42,
    melody: 'lute', mel: 0.36, melOct: 1, range: [-2, 6], density: 0.6, rest: [1, 2], busy: 0.2, leap: 0.3, ornament: 0, slur: 0,
    drone: 0.07, highDrone: 0, drumLvl: 0, drums: [],
    progs: [[0, 0, 5, 0], [0, 6, 0, 0], [0, 3, 0, 0], [0, 5, 6, 0]], finalW: 0.2, gain: 1.4,
  },
};

const mod7 = (d: number): number => ((d % 7) + 7) % 7;

function weighted<T>(rnd: Rand, items: readonly T[], w: (t: T) => number): T {
  let total = 0;
  for (const it of items) total += Math.max(0, w(it));
  let r = rnd() * total;
  for (const it of items) { r -= Math.max(0, w(it)); if (r <= 0) return it; }
  return items[items.length - 1]!;
}

// ───────────── the phrase grammar ─────────────

interface MelNote { bar: number; pos: number; dur: number; deg: number; grace: boolean; slur: boolean; last: boolean }
interface Motif { rhythm: number[]; intervals: number[] }

const CELLS2: readonly (readonly [readonly number[], number])[] = [
  [[2], 3], [[1, 1], 4], [[1.5, 0.5], 1.2], [[0.5, 0.5, 1], 0.8], [[1, 0.5, 0.5], 1], [[3, 1], 1], [[4], 0.5],
];
const CELLS3: readonly (readonly [readonly number[], number])[] = [
  [[3], 2], [[2, 1], 4], [[1, 1, 1], 2.5], [[1, 2], 0.8], [[1.5, 0.5, 1], 0.6],
];

export class Melodist {
  private bank: Motif[] = [];
  private lastDeg = 0;
  private lastMotif: Motif | null = null;
  constructor(private readonly S: MoodSpec, private readonly rnd: Rand) {}

  /** semitones of a degree above the final */
  private semis(d: number): number { return 12 * Math.floor(d / 7) + this.S.mode[mod7(d)]!; }

  private barRhythm(last: boolean): number[] {
    const S = this.S, beat = BEAT[S.meter], barLen = BAR_LEN[S.meter];
    const cells = beat === 3 ? CELLS3 : CELLS2;
    const tail = last ? (S.meter === 'duple' ? 4 : S.meter === 'triple' ? 4 : 3) : 0;
    const end = barLen - tail;
    const out: number[] = [];
    let pos = 0;
    while (pos < end) {
      const remain = end - pos;
      const fit = cells.filter(([c]) => {
        const sum = c.reduce((a, b) => a + b, 0);
        if (sum > remain) return false;
        if (sum === beat) return true;
        return sum === beat * 2 && pos % (beat * 2) === 0;
      });
      const [c] = weighted(this.rnd, fit.length ? fit : [[[remain], 1] as const], ([cc, w]) => {
        const n = cc.length;
        return w * (S.busy >= 0.5 ? 1 + (S.busy - 0.4) * 1.6 * (n - 1) : 1 / (1 + (0.6 - S.busy) * 1.4 * (n - 1)));
      });
      for (const d of c) out.push(d);
      pos += c.reduce((a, b) => a + b, 0);
    }
    if (last) {
      const rest = this.rnd() < 0.5 ? 1 : 0;
      out.push(tail - rest);
    }
    return out;
  }

  private clampDeg(d: number): number {
    const [lo, hi] = this.S.range;
    while (d < lo || d > hi) d = d < lo ? lo + (lo - d) : hi - (d - hi);
    return d;
  }

  private cadence(h: number, near: number): number {
    const tones: [number, number][] = h === 0
      ? [[0, this.S.finalW], [4, 0.36], [2, 0.24]]
      : [[h, 0.45], [h + 4, 0.35], [h + 2, 0.2]];
    const pc = weighted(this.rnd, tones, ([, w]) => w)[0];
    // nearest octave placement of that pitch class to `near`, inside the range
    let best = pc, bestD = Infinity;
    for (let k = -2; k <= 2; k++) {
      const d = mod7(pc) + 7 * k;
      if (d < this.S.range[0] || d > this.S.range[1]) continue;
      const dist = Math.abs(d - near);
      if (dist < bestD) { bestD = dist; best = d; }
    }
    return best;
  }

  phrase(startBar: number, harm: (b: number) => number): { notes: MelNote[]; bars: number } {
    const S = this.S, rnd = this.rnd, beat = BEAT[S.meter];
    const bars = rnd() < (S.busy > 0.5 ? 0.55 : 0.3) ? 4 : 2;
    const fresh = this.bank.filter(m => m !== this.lastMotif);
    const reuse = fresh.length > 0 && rnd() < 0.35 ? fresh[Math.floor(rnd() * fresh.length)]! : null;
    this.lastMotif = reuse;
    // how it comes back: as it was, moved, upside down, or only its rhythm
    const how = rnd();
    const keepPitches = reuse !== null && how < 0.8;
    const rhythm: { bar: number; pos: number; dur: number }[] = [];
    for (let b = 0; b < bars; b++) {
      const last = b === bars - 1;
      const cells = b === 0 && reuse && !last ? reuse.rhythm : this.barRhythm(last);
      let pos = 0;
      for (const d of cells) { rhythm.push({ bar: startBar + b, pos, dur: d }); pos += d; }
    }
    const n = rhythm.length;
    const degs: number[] = new Array(n).fill(0);
    // start on a chord tone of the opening harmony, near where the last phrase left off
    const h0 = harm(startBar);
    const startCands = [h0, h0 + 2, h0 + 4, h0 - 3, h0 + 7].map(d => this.clampDeg(d));
    degs[0] = startCands.reduce((a, b) => (Math.abs(b - this.lastDeg) < Math.abs(a - this.lastDeg) ? b : a));
    let i0 = 1;
    if (reuse && keepPitches) {
      const shift = how < 0.25 ? 0 : how < 0.55 ? (rnd() < 0.5 ? -1 : 1) * (1 + Math.floor(rnd() * 2)) : 0;
      const invert = how >= 0.55;
      degs[0] = this.clampDeg(degs[0]! + shift);
      for (let i = 1; i < Math.min(reuse.rhythm.length, n - 2) && i <= reuse.intervals.length; i++) {
        degs[i] = this.clampDeg(degs[i - 1]! + (invert ? -1 : 1) * reuse.intervals[i - 1]!);
        i0 = i + 1;
      }
    }
    const contour = rnd();
    let prevStep = i0 > 1 ? degs[i0 - 1]! - degs[i0 - 2]! : 0;
    let repeats = 0;
    for (let i = i0; i < n - 2; i++) {
      const x = i / n;
      const dir = contour < 0.5 ? (x < 0.5 ? 1 : -1) : contour < 0.8 ? -1 : (x < 0.3 ? -1 : 1);
      const strong = rhythm[i]!.pos % beat === 0;
      const h = harm(rhythm[i]!.bar);
      const prev = degs[i - 1]!;
      const steps = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
      const s = weighted(rnd, steps, st => {
        const a = Math.abs(st);
        let w = [0.4, 3, 1.4, 0.6, 0.35][a]! * (a >= 2 ? S.leap + 0.3 : 1);
        if (st !== 0 && Math.sign(st) === dir) w *= 1.6; else if (st !== 0) w *= 0.7;
        if (Math.abs(prevStep) >= 3 && (a > 2 || Math.sign(st) === Math.sign(prevStep))) w *= 0.05; // fill the leap
        if (st === 0 && repeats >= 1) w *= 0.1;
        const d = prev + st;
        if (d < S.range[0] || d > S.range[1]) w *= 0.02;
        if (strong && [0, 2, 4].includes(mod7(d - h))) w *= 2.2;
        if (Math.abs(this.semis(d) - this.semis(prev)) === 6) w *= 0.01; // no tritone leaps
        return w;
      });
      degs[i] = this.clampDeg(prev + s);
      repeats = s === 0 ? repeats + 1 : 0;
      prevStep = s;
    }
    // the cadence: the final note, approached by step
    const hEnd = harm(rhythm[n - 1]!.bar);
    if (n >= 2) {
      const before = n >= 3 ? degs[n - 3]! : degs[0]!;
      const target = this.cadence(hEnd, before);
      degs[n - 1] = target;
      if (n >= 3) {
        const up = this.clampDeg(target + 1), down = this.clampDeg(target - 1);
        degs[n - 2] = Math.abs(up - before) <= Math.abs(down - before) ? up : down;
      }
    }
    this.lastDeg = degs[n - 1]!;
    // remember the opening bar
    const firstBar = rhythm.filter(r => r.bar === startBar);
    if (bars > 1 && firstBar.length >= 2) {
      this.bank.push({ rhythm: firstBar.map(r => r.dur), intervals: firstBar.slice(1).map((_, i) => degs[i + 1]! - degs[i]!) });
      if (this.bank.length > 6) this.bank.shift();
    }
    const notes: MelNote[] = rhythm.map((r, i) => {
      const step = i > 0 ? Math.abs(degs[i]! - degs[i - 1]!) : 9;
      return {
        bar: r.bar, pos: r.pos, dur: r.dur, deg: degs[i]!,
        grace: i > 0 && i < n - 1 && r.dur >= 2 && rnd() < S.ornament,
        slur: i > 0 && step === 1 && r.dur <= 1 && rnd() < S.slur,
        last: i === n - 1,
      };
    });
    return { notes, bars };
  }
}

// ───────────── a mood, playing ─────────────

class Layer {
  readonly gain: GainNode;
  readonly mood: MusicMood;
  private readonly S: MoodSpec;
  private readonly rnd: Rand;
  private readonly lute: AudioNode;
  private readonly harp: AudioNode;
  private readonly melBus: GainNode;
  private readonly drumBus: GainNode;
  private readonly drone?: Drone;
  private readonly high?: Drone;
  private readonly mel: Melodist;
  private bar = 0;
  private nextBarT: number;
  private harmony: number[] = [];
  private lastProg = -1;
  private queue: MelNote[] = [];
  private melFreeAt = 1;
  private rec: RecorderVoice | null = null;
  private warned = false;
  endT = Infinity;

  constructor(private readonly e: Engine, dest: AudioNode, mood: Exclude<MusicMood, 'off'>, t0: number, fadeIn: number, rnd: Rand) {
    this.mood = mood;
    this.S = MOODS[mood];
    this.rnd = rnd;
    this.gain = e.gain(0, dest);
    this.gain.gain.setValueAtTime(0.0001, t0);
    this.gain.gain.linearRampToValueAtTime(this.S.gain, t0 + fadeIn);
    this.lute = luteBody(e, this.gain);
    this.harp = harpBody(e, this.gain);
    this.melBus = e.gain(1, this.gain);
    this.drumBus = e.gain(1, this.gain);
    const S = this.S;
    if (S.drone > 0) this.drone = new Drone(e, this.gain, t0, S.final >= 48 ? S.final - 12 : S.final, 'low', S.drone);
    if (S.highDrone > 0) this.high = new Drone(e, this.gain, t0, S.final, 'high', S.highDrone);
    this.mel = new Melodist(S, rnd);
    this.nextBarT = t0;
  }

  get ending(): boolean { return this.endT < Infinity; }

  fadeOut(now: number, dur: number): void {
    if (this.ending) return;
    this.endT = now + dur;
    holdAt(this.gain.gain, now);
    this.gain.gain.setTargetAtTime(0, now, dur / 4);
    this.drone?.stop(this.endT);
    this.high?.stop(this.endT);
    if (this.rec) { this.rec.close(this.endT); this.rec = null; }
  }

  done(now: number): boolean { return now > this.endT + 4; }

  private deg2midi(deg: number): number {
    return this.S.final + 12 * Math.floor(deg / 7) + this.S.mode[mod7(deg)]!;
  }
  private melMidi(deg: number): number {
    return this.deg2midi(deg) + 12 * this.S.melOct;
  }

  private harmonyAt(b: number): number {
    while (this.harmony.length <= b) {
      const progs = this.S.progs;
      let k = Math.floor(this.rnd() * progs.length);
      if (k === this.lastProg && progs.length > 1) k = (k + 1) % progs.length;
      this.lastProg = k;
      // the very first bars always sit on the final
      const p = this.harmony.length === 0 ? progs[k]!.map((d, i) => (i === 0 ? 0 : d)) : progs[k]!;
      this.harmony.push(...p);
    }
    return this.harmony[b]!;
  }

  schedule(now: number, until: number, tempo: number, drumMul: number): void {
    if (this.nextBarT < now - 0.3) this.nextBarT = now + 0.05; // we fell behind (a hidden tab): rejoin, never burst
    while (this.nextBarT < until && this.nextBarT < this.endT) {
      const q = this.S.eighth / tempo;
      // a bar that fails is a bar of silence, never a bar replayed on every pump
      try { this.playBar(this.bar, this.nextBarT, q, drumMul); }
      catch (err) { if (!this.warned) { this.warned = true; console.warn('[audio] music bar failed: ' + String(err)); } }
      this.nextBarT += q * BAR_LEN[this.S.meter];
      this.bar++;
    }
  }

  private playBar(b: number, t: number, q: number, drumMul: number): void {
    const S = this.S, e = this.e, rnd = this.rnd;
    const h = this.harmonyAt(b);
    const hum = () => (rnd() - 0.5) * 0.012;

    // ── accompaniment
    let bass = this.deg2midi(h);
    while (bass > S.final + 7) bass -= 12;
    while (bass < S.final - 5) bass += 12;
    let fifth = this.deg2midi(h + 4);
    while (fifth <= bass) fifth += 12;
    if (fifth - bass === 6) fifth = bass + 12; // never a bare tritone
    const oct = bass + 12;
    let third = this.deg2midi(h + 2);
    while (third < oct) third += 12;
    const A = S.acc;
    const pl = (pos: number, m: number, v: number) => {
      const tt = t + pos * q + hum();
      if (S.accomp === 'harp') harp(e, this.harp, tt, m, v * A * 1.1);
      else lute(e, this.lute, tt, m, v * A);
    };
    const strum = (pos: number, ms: number[], v: number) => ms.forEach((m, i) => pl(pos + (i * 0.018) / q, m, v * (1 - i * 0.08)));
    switch (S.accomp) {
      case 'arp6':
        pl(0, bass, 0.9);
        if (rnd() < 0.85) pl(2, fifth, 0.5);
        pl(3, oct, 0.55);
        if (rnd() < 0.7) pl(5, rnd() < 0.5 ? third : fifth, 0.42);
        break;
      case 'arp8':
        pl(0, bass, 0.85); pl(2, fifth, 0.48); pl(3, oct, 0.5);
        pl(4, rnd() < 0.5 ? bass : oct, 0.55); pl(6, fifth, 0.48);
        if (rnd() < 0.6) pl(7, third, 0.38);
        break;
      case 'strum6':
        strum(0, [bass, fifth, oct], 0.8);
        pl(2, oct, 0.38);
        strum(3, rnd() < 0.5 ? [fifth, oct] : [fifth, oct, third], 0.55);
        if (rnd() < 0.5) pl(5, fifth, 0.38);
        break;
      case 'strum8':
        strum(0, [bass, fifth, oct], 0.8); pl(2, oct, 0.42);
        strum(3, [fifth, oct], 0.5); strum(4, [bass, fifth], 0.6);
        strum(6, [fifth, oct, third], 0.52);
        if (rnd() < 0.5) pl(7, fifth, 0.38);
        break;
      case 'harp':
        if (rnd() < 0.3) {
          // a slow rolled chord, then air
          [bass, fifth, oct, third].forEach((m, i) => pl(i * 0.35, m, 0.7 - i * 0.08));
        } else if (rnd() < 0.25) {
          pl(0, bass, 0.75);
        } else {
          pl(0, bass, 0.75); pl(2, fifth, 0.42); pl(3, oct, 0.42);
          if (rnd() < 0.6) pl(4, third, 0.36);
        }
        break;
      case 'sparse':
        if (rnd() < 0.72) strum(0, [bass, fifth], 0.7);
        if (rnd() < 0.4) pl(BAR_LEN[S.meter] / 2, oct, 0.4);
        break;
      case 'low': {
        let nb = this.deg2midi(h + 1);
        while (nb > bass + 6) nb -= 12;
        while (nb <= bass) nb += 12;
        pl(0, bass, 0.85);
        if (rnd() < 0.6) pl(3, nb, 0.48);
        if (rnd() < 0.5) pl(4, bass, 0.58);
        if (rnd() < 0.35) pl(6, fifth, 0.42);
        break;
      }
    }

    // ── drum
    if (S.drumLvl > 0 && S.drums.length && drumMul > 0) {
      const pat = b % 4 === 3 && rnd() < 0.6
        ? S.drums.reduce((a, p) => (p.replace(/\./g, '').length > a.replace(/\./g, '').length ? p : a))
        : S.drums[rnd() < 0.6 ? b % S.drums.length : Math.floor(rnd() * S.drums.length)]!;
      for (let i = 0; i < pat.length; i++) {
        const c = pat[i]!;
        if (c !== '.') drum(e, this.drumBus, t + i * q + hum(), c, S.drumLvl * drumMul * (0.9 + rnd() * 0.2));
      }
    }

    // ── drone breathes every four bars
    if (b % 4 === 0 && b > 0) {
      const on = rnd() < 0.65;
      this.drone?.setLevel(t, on ? S.drone : S.drone * 0.25, 1.5);
    }

    // ── melody (no new breath once the layer is fading out)
    if (S.melody === 'none' || this.ending) return;
    if (!this.queue.length && b >= this.melFreeAt && b % 2 === 0) {
      if (rnd() < S.density) {
        const ph = this.mel.phrase(b, bb => this.harmonyAt(bb));
        this.queue = ph.notes;
        const [r0, r1] = S.rest;
        this.melFreeAt = b + ph.bars + r0 + Math.floor(rnd() * (r1 - r0 + 1));
      } else {
        this.melFreeAt = b + 2;
      }
    }
    while (this.queue.length && this.queue[0]!.bar === b) {
      const n = this.queue.shift()!;
      const tt = t + n.pos * q;
      const dd = n.dur * q;
      const m = this.melMidi(n.deg);
      if (S.melody === 'recorder') {
        if (!this.rec) this.rec = new RecorderVoice(e, this.melBus, tt - 0.08, S.mel, midiHz(this.melMidi(Math.round((S.range[0] + S.range[1]) / 2))));
        this.rec.note(tt, dd, midiHz(m), { slur: n.slur, grace: n.grace ? midiHz(this.melMidi(n.deg + 1)) : undefined, legatoNext: !n.last });
        if (n.last) { this.rec.close(); this.rec = null; }
      } else if (S.melody === 'harp') {
        harp(e, this.harp, tt + hum(), m, S.mel * (n.pos % BEAT[S.meter] === 0 ? 1 : 0.8));
      } else {
        lute(e, this.lute, tt + hum(), m, S.mel * (n.pos % BEAT[S.meter] === 0 ? 1 : 0.8));
      }
    }
  }
}

export class Music {
  private layers: Layer[] = [];
  private mood: MusicMood = 'off';
  private tempo = 1;
  private lastT: number | null = null;
  targetTempo = 1;
  drumMul = 1;

  constructor(private readonly e: Engine, private readonly rnd: Rand, private readonly realtime = true) {}

  current(): MusicMood { return this.mood; }

  setMood(m: MusicMood, now: number): void {
    if (m === this.mood) return;
    this.mood = m;
    const hadAny = this.layers.some(l => !l.ending);
    for (const l of this.layers) l.fadeOut(now, m === 'off' ? 2 : 3.5);
    if (m !== 'off') this.layers.push(new Layer(this.e, this.e.musicIn, m, now + 0.1, hadAny ? 3 : 1.6, this.rnd));
  }

  schedule(now: number, horizon: number): void {
    // tempo eases toward its target over a second or two, however often we are called
    const dt = this.lastT === null ? 0 : Math.min(1, Math.max(0, now - this.lastT));
    this.lastT = now;
    this.tempo += (this.targetTempo - this.tempo) * (1 - Math.exp(-dt / 1.2));
    for (const l of this.layers) l.schedule(now, now + horizon, this.tempo, this.drumMul);
    this.layers = this.layers.filter(l => {
      if (!l.done(now)) return true;
      if (this.realtime) l.gain.disconnect();
      return false;
    });
  }

  dispose(): void {
    for (const l of this.layers) l.gain.disconnect();
    this.layers = [];
  }
}

export const MOOD_NAMES: readonly MusicMood[] = ['title', 'calm', 'busy', 'rent_day', 'tense', 'court', 'winter', 'triumph', 'defeat', 'off'];
