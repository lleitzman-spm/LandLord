/**
 * The consort: instruments shared by sound effects and music. Every function
 * schedules nodes on an Engine at an absolute time and returns its end time.
 */
import { Engine, type Mode, ahr, holdAt, midiHz, stopAt } from './engine';

// ───────────── struck wood and metal ─────────────

/** a hardwood block: knuckles, gavels, game pieces */
export const WOOD: readonly Mode[] = [[1, 1, 0.09], [1.93, 0.5, 0.06], [3.07, 0.28, 0.04], [4.36, 0.12, 0.025]];
/** a softer, hollower board: doors, crates */
export const BOARD: readonly Mode[] = [[1, 1, 0.14], [2.31, 0.45, 0.08], [3.72, 0.2, 0.05]];
/** a small metal disc: a coin */
export const COIN: readonly Mode[] = [[1, 1, 0.42], [1.47, 0.62, 0.3], [2.09, 0.45, 0.22], [2.56, 0.3, 0.16], [3.42, 0.2, 0.1], [4.21, 0.1, 0.07]];
/** a free bar: tubular chime, glockenspiel */
export const BAR: readonly Mode[] = [[1, 1, 2.2], [2.756, 0.42, 1.0], [5.404, 0.18, 0.5], [8.933, 0.07, 0.25]];
/** a small handbell */
export const HANDBELL: readonly Mode[] = [[1, 1, 1.5], [2.0, 0.32, 0.9], [2.92, 0.22, 0.55], [4.08, 0.1, 0.32], [5.3, 0.05, 0.2]];
/**
 * A tuned church bell relative to its prime: hum, prime, tierce (the minor
 * third that makes a bell a bell), quint, nominal and the upper partials.
 * The doubled hum and prime are a hair apart, so they beat slowly the way
 * a real casting does.
 */
export const BELL: readonly Mode[] = [
  [0.5, 0.55, 5.6], [0.5017, 0.25, 6.2], [1.0, 0.5, 3.8], [1.0024, 0.22, 3.3], [1.183, 0.42, 3.1], [1.506, 0.2, 2.1],
  [2.0, 0.6, 2.5], [2.514, 0.24, 1.7], [2.662, 0.22, 1.5], [3.011, 0.17, 1.15], [4.166, 0.11, 0.8], [5.433, 0.07, 0.52], [6.796, 0.04, 0.34],
];

export function wood(e: Engine, dest: AudioNode, t: number, f0: number, vel: number, decayMul = 1, modes: readonly Mode[] = WOOD): number {
  const m = modes.map(([r, a, d]) => [r, a, d * decayMul] as const);
  const end = e.modal(dest, t, f0, m, vel * 0.42, 0.0008, 0.02);
  e.burst(dest, t, 'white', 'bandpass', Math.min(f0 * 5.5, 9000), 0.9, vel * 0.16, 0.0005, 0.012);
  return end;
}

export function clink(e: Engine, dest: AudioNode, t: number, f0: number, vel: number, short = 1, modes: readonly Mode[] = COIN): number {
  const m = modes.map(([r, a, d]) => [r, a, d * short] as const);
  const end = e.modal(dest, t, f0, m, vel * 0.22, 0.0005, 0.03);
  e.burst(dest, t, 'white', 'highpass', 5200, 0.7, vel * 0.06, 0.0004, 0.006);
  return end;
}

// ───────────── plucked strings ─────────────

/**
 * A lute's body: a bowl resonance and a soft top. Plucks connect into the
 * returned node. Lutes are double-strung; the bass courses carry an octave string.
 */
export function luteBody(e: Engine, dest: AudioNode): AudioNode {
  const lp = e.filter('lowpass', 3800, 0.6, dest);
  const p2 = e.filter('peaking', 520, 1.1, lp, 2);
  return e.filter('peaking', 245, 1.2, p2, 3.5);
}

export function lute(e: Engine, body: AudioNode, t: number, midi: number, vel: number, decay?: number): number {
  const m = Math.round(midi);
  const f = midiHz(m) * Math.pow(2, (midi - m) / 12);
  const d = decay ?? Math.max(0.9, 2.6 - (m - 45) * 0.045);
  // the two strings of a course, a hair apart in pitch and time
  let end = e.pluck(body, t, f, { gain: vel * 0.55, decay: d, bright: 0.38, pick: 0.17, detune: (e.rand() - 0.5) * 4, variant: 0 });
  end = Math.max(end, e.pluck(body, t + 0.003 + e.rand() * 0.004, f, { gain: vel * 0.42, decay: d, bright: 0.38, pick: 0.17, detune: 2.5 + e.rand() * 2, variant: 1 }));
  // the bass courses carry an octave string
  if (m < 52) end = Math.max(end, e.pluck(body, t + 0.002, f * 2, { gain: vel * 0.22, decay: Math.max(0.9, d * 0.6), bright: 0.45, pick: 0.25, variant: 0 }));
  return end;
}

/** a gothic harp: single strings, brighter and longer */
export function harpBody(e: Engine, dest: AudioNode): AudioNode {
  const hs = e.filter('highshelf', 3200, 0.7, dest, -5);
  return e.filter('peaking', 380, 0.9, hs, 2);
}

export function harp(e: Engine, body: AudioNode, t: number, midi: number, vel: number): number {
  const f = midiHz(midi);
  const d = Math.max(1.4, 3.8 - (midi - 50) * 0.06);
  return e.pluck(body, t, f, { gain: vel * 0.6, decay: d, bright: 0.42, pick: 0.3, detune: (e.rand() - 0.5) * 3 });
}

// ───────────── the recorder (one breath per phrase) ─────────────

const RECORDER_HARMONICS = [1, 0.21, 0.085, 0.035, 0.014, 0.006];

/**
 * A recorder held for a whole phrase: one oscillator, one breath. Notes are
 * tongued (a short dip) or slurred; long notes grow a late vibrato. Each
 * note says whether the next follows without a gap (`legatoNext`), so the
 * envelope is decided when the note is scheduled and never revised.
 * Call note() in time order, then close().
 */
export class RecorderVoice {
  private readonly e: Engine;
  private readonly osc: OscillatorNode;
  private readonly lfo: OscillatorNode;
  private readonly amp: GainNode;
  private readonly vib: GainNode;
  private readonly breathBp: BiquadFilterNode;
  private readonly noiseSrc: AudioBufferSourceNode;
  private readonly chiff: AudioNode;
  private held = false;
  private lastEnd = 0;
  closed = false;

  constructor(e: Engine, dest: AudioNode, t: number, private readonly level: number, centreHz: number) {
    this.e = e;
    const lp = e.filter('lowpass', 3600, 0.5, dest);
    this.amp = e.gain(0, lp);
    this.osc = e.waveOsc('recorder', RECORDER_HARMONICS, centreHz, t, t + 600, this.amp);
    const [vib, lfo] = e.lfo(4.8 + e.rand() * 0.8, t, t + 600, 0);
    this.vib = vib; this.lfo = lfo;
    vib.connect(this.osc.frequency);
    // breath: noise around the second harmonic, riding the same envelope
    this.breathBp = e.filter('bandpass', centreHz * 2, 1.4, e.gain(0.07, this.amp));
    this.noiseSrc = e.noise('white', t, t + 600, this.breathBp);
    // the tongue's "t": a tiny high noise tick per articulated note
    this.chiff = e.filter('highpass', 2400, 0.7, lp);
  }

  note(t: number, dur: number, f: number, o: { slur?: boolean; grace?: number; legatoNext?: boolean } = {}): void {
    if (this.closed) return;
    const a = this.amp.gain, fr = this.osc.frequency, L = this.level;
    const gStart = o.grace ? (this.held ? t - 0.065 : t) : t;
    const gEnd = o.grace ? (this.held ? t : t + 0.06) : t;
    if (!this.held) {
      a.setValueAtTime(0, gStart);
      a.linearRampToValueAtTime(L, gStart + 0.045);
    } else if (!o.slur) {
      a.setValueAtTime(L, gStart - 0.022);
      a.linearRampToValueAtTime(L * 0.3, gStart - 0.004);
      a.linearRampToValueAtTime(L, gStart + 0.028);
    }
    if (!o.slur || !this.held) this.e.burst(this.chiff, gStart, 'white', 'bandpass', 5200, 0.8, L * 0.12, 0.002, 0.03);
    if (o.grace) {
      fr.setValueAtTime(o.grace, gStart);
      fr.setValueAtTime(f, gEnd);
    } else if (o.slur && this.held) {
      fr.setTargetAtTime(f, t, 0.008);
    } else {
      fr.setValueAtTime(f, t);
    }
    this.breathBp.frequency.setValueAtTime(f * 2, t);
    // late vibrato on long notes
    const v = this.vib.gain;
    v.setValueAtTime(0, t);
    if (dur > 0.42) {
      v.setValueAtTime(0, t + 0.22);
      v.linearRampToValueAtTime(f * 0.0055, t + Math.min(dur * 0.8, 0.6));
    }
    v.linearRampToValueAtTime(0, t + dur);
    if (o.legatoNext) {
      this.held = true;
    } else {
      a.setValueAtTime(L, t + Math.max(0.05, dur - 0.04));
      a.linearRampToValueAtTime(0, t + dur + 0.03);
      this.held = false;
    }
    this.lastEnd = t + dur;
  }

  /** end the breath; with `t` earlier than the last note, cut it short there */
  close(t?: number): void {
    if (this.closed) return;
    this.closed = true;
    let end = this.lastEnd + 0.3;
    if (t !== undefined && t < this.lastEnd) {
      holdAt(this.amp.gain, t);
      this.amp.gain.setTargetAtTime(0, t, 0.05);
      end = t + 0.5;
    } else if (this.held) {
      this.amp.gain.linearRampToValueAtTime(0, this.lastEnd + 0.05);
    }
    for (const n of [this.osc, this.lfo, this.noiseSrc]) stopAt(n, end);
  }
}

// ───────────── brass (natural horn and trumpet) ─────────────

export interface BrassNote { f: number; d: number; v?: number; slur?: boolean }

/**
 * A natural brass instrument: two sawtooths and a sub-octave square through
 * a lowpass that opens with each attack (the "blat"), a body formant, a lip
 * scoop into each note, a puff of breath, and a late vibrato on held notes.
 */
export function brass(e: Engine, dest: AudioNode, t0: number, notes: readonly BrassNote[], o: { bright: number; formant: number; gain: number }): number {
  const total = notes.reduce((s, n) => s + n.d, 0);
  const end = t0 + total + 0.14;
  const out = e.gain(o.gain, dest);
  const body = e.filter('peaking', o.formant, 1.3, out, 5);
  const lp = e.filter('lowpass', 800, 1.1, body);
  const amp = e.gain(0, lp);
  const f0 = notes[0]!.f;
  const o1 = e.osc('sawtooth', f0, t0, end, amp);
  const o2 = e.osc('sawtooth', f0, t0, end, amp, 6);
  const o3 = e.osc('square', f0 / 2, t0, end, e.gain(0.18, amp));
  const [vib] = e.lfo(5.4, t0, end, 0);
  vib.connect(o1.frequency); vib.connect(o2.frequency);
  const breath = e.gain(0, lp);
  e.noise('pink', t0, end, e.filter('bandpass', o.formant * 1.5, 0.8, breath));
  const A = amp.gain, C = lp.frequency;
  let t = t0, prevHold = 0;
  notes.forEach((n, i) => {
    const v = (n.v ?? 1) * 0.5;
    for (const p of [o1.frequency, o2.frequency]) {
      if (n.slur) p.setTargetAtTime(n.f, t, 0.012);
      else { p.setValueAtTime(n.f * 0.977, t); p.exponentialRampToValueAtTime(n.f, t + 0.035); }
    }
    o3.frequency.setValueAtTime(n.f / 2, t);
    if (i === 0) { A.setValueAtTime(0, t); A.linearRampToValueAtTime(v, t + 0.03); }
    else if (n.slur) A.linearRampToValueAtTime(v, t + 0.03);
    else { A.setValueAtTime(prevHold, t - 0.025); A.linearRampToValueAtTime(v * 0.12, t - 0.004); A.linearRampToValueAtTime(v, t + 0.03); }
    const hold = n.d > 0.3 ? v * 0.84 : v;
    A.linearRampToValueAtTime(hold, t + Math.max(0.031, n.d - 0.03));
    prevHold = hold;
    C.setValueAtTime(n.f * 1.1, t);
    C.linearRampToValueAtTime(n.f * o.bright * 1.7, t + 0.04);
    C.setTargetAtTime(n.f * o.bright, t + 0.04, 0.09);
    if (!n.slur) {
      breath.gain.setValueAtTime(0, t);
      breath.gain.linearRampToValueAtTime(0.05 * v * 2, t + 0.015);
      breath.gain.setTargetAtTime(0.012 * v * 2, t + 0.03, 0.05);
    }
    vib.gain.setValueAtTime(0, t);
    if (n.d > 0.3) { vib.gain.setValueAtTime(0, t + 0.16); vib.gain.linearRampToValueAtTime(n.f * 0.006, t + Math.min(n.d * 0.8, 0.45)); }
    t += n.d;
    vib.gain.linearRampToValueAtTime(0, t);
  });
  A.linearRampToValueAtTime(0, t + 0.09);
  breath.gain.setTargetAtTime(0, t, 0.03);
  return end;
}

// ───────────── frame drum ─────────────

/** 'D' doum (open low), 'd' soft doum, 't' tek (rim), 'g' ghost, 'j' tek with jingles */
export function drum(e: Engine, dest: AudioNode, t: number, kind: string, level: number): number {
  if (kind === 'D' || kind === 'd') {
    const v = (kind === 'D' ? 1 : 0.55) * level;
    const end = e.thump(dest, t, 96, 58, 0.09, v * 0.75, 0.42);
    return Math.max(end, e.burst(dest, t, 'pink', 'lowpass', 750, 0.7, v * 0.22, 0.002, 0.07));
  }
  const v = (kind === 'g' ? 0.35 : 0.7) * level;
  let end = e.burst(dest, t, 'white', 'bandpass', 2100, 1.3, v * 0.32, 0.0008, 0.055);
  end = Math.max(end, e.thump(dest, t, 420, 380, 0.03, v * 0.2, 0.06, 'triangle'));
  if (kind === 'j') {
    for (let i = 0; i < 3; i++) end = Math.max(end, clink(e, dest, t + i * 0.012 + e.rand() * 0.006, 4800 + e.rand() * 1800, v * 0.35, 0.35));
  }
  return end;
}

// ───────────── drones ─────────────

export class Drone {
  readonly out: GainNode;
  private readonly oscs: OscillatorNode[] = [];
  private stopped = false;
  constructor(e: Engine, dest: AudioNode, t: number, rootMidi: number, kind: 'low' | 'high', level: number) {
    this.out = e.gain(0, dest);
    this.out.gain.setValueAtTime(0, t);
    this.out.gain.linearRampToValueAtTime(level, t + 3);
    const far = t + 3600;
    const f = midiHz(rootMidi);
    if (kind === 'low') {
      const lp = e.filter('lowpass', 620, 0.8, this.out);
      const [lfo, lo] = e.lfo(0.055 + e.rand() * 0.02, t, far, 140);
      lfo.connect(lp.frequency);
      this.oscs.push(lo);
      this.oscs.push(e.osc('sawtooth', f, t, far, e.gain(0.32, lp), -3));
      this.oscs.push(e.osc('sawtooth', f * 1.5, t, far, e.gain(0.2, lp), 4));
      this.oscs.push(e.osc('sine', f / 2, t, far, e.gain(0.45, lp)));
    } else {
      const trem = e.gain(0.7, this.out);
      const [lfo, lo] = e.lfo(0.17, t, far, 0.3);
      lfo.connect(trem.gain);
      this.oscs.push(lo);
      for (const [mul, a, cents] of [[4, 0.3, 0], [4, 0.2, 7], [6, 0.18, -4], [8, 0.08, 3]] as const) {
        this.oscs.push(e.osc('sine', f * mul, t, far, e.gain(a, trem), cents));
      }
    }
  }
  setLevel(t: number, v: number, tau = 1.2): void {
    if (this.stopped) return;
    this.out.gain.setTargetAtTime(v, t, tau);
  }
  stop(t: number): void {
    if (this.stopped) return;
    this.stopped = true;
    holdAt(this.out.gain, t);
    this.out.gain.setTargetAtTime(0, t, 0.5);
    for (const o of this.oscs) stopAt(o, t + 3);
  }
}

// ───────────── voices for crowds and creatures ─────────────

export const VOWELS: Record<string, readonly [number, number]> = {
  a: [780, 1220], e: [480, 1880], i: [320, 2250], o: [520, 880], u: [340, 760], y: [400, 2000],
};

/** a sawtooth through two vowel formants, with an optional pitch glide, vibrato and breath */
export function vowel(e: Engine, dest: AudioNode, t: number, o: {
  f: number; f2?: number; glide?: number; v: string; a: number; hold: number; r: number; peak: number; vib?: number; breath?: number;
}): number {
  const [F1, F2] = VOWELS[o.v] ?? VOWELS.a!;
  const amp = e.gain(0, dest);
  const end = ahr(amp.gain, t, o.peak, o.a, o.hold, o.r);
  const sum = e.gain(1);
  sum.connect(e.filter('bandpass', F1, 6, amp));
  sum.connect(e.filter('bandpass', F2, 8, e.gain(0.6, amp)));
  const lp = e.filter('lowpass', 3000, 0.7, sum);
  const src = e.osc('sawtooth', o.f, t, end, lp);
  if (o.f2 !== undefined) {
    src.frequency.setValueAtTime(o.f, t);
    src.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide ?? o.a + o.hold));
  }
  if (o.vib) {
    const [amt] = e.lfo(5 + e.rand() * 1.5, t, end, o.f * o.vib);
    amt.connect(src.frequency);
  }
  if (o.breath) e.noise('pink', t, end, e.gain(o.breath, sum));
  return end;
}

/** a soft struck chime at f (bar modes) */
export function chimeAt(e: Engine, dest: AudioNode, t: number, f: number, vel: number): number {
  return e.modal(dest, t, f, BAR, vel * 0.3, 0.002);
}
