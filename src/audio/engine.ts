/**
 * The audio engine: one shared mixing graph plus the synthesis primitives
 * every sound is built from. It runs on any BaseAudioContext, so the live
 * game (AudioContext) and the offline check (OfflineAudioContext) play
 * exactly the same code.
 *
 *   sfxIn  (sfx vol) ──┬────────────────────────────► mix
 *                      └─ send ──► reverb
 *   sfxWet (sfx vol) ─────────────► reverb            (per-sound extra room)
 *   ambIn  (sfx vol) ──┬────────────────────────────► mix
 *                      └─ send ──► reverb
 *   musicIn (duck) ─► music vol ─► tone ──┬─────────► mix
 *                                         └─ send ──► reverb
 *   voiceIn (voice vol) ──┬─────────────────────────► mix
 *                         └─ send ──► reverb
 *   reverb (a small wooden room) ───────────────────► mix
 *   mix ─► warmth EQ ─► master vol ─► compressor ─► soft limiter ─► out
 */

export type Rand = () => number;
/** [frequency ratio, amplitude, seconds to -60 dB] */
export type Mode = readonly [number, number, number];
export type NoiseKind = 'white' | 'pink' | 'brown';

/** sample rate for pre-rendered plucked strings */
const KS_RATE = 22050;

export const midiHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
/** slider 0..1 to gain (perceptual square law) */
export const volGain = (v: number): number => { const c = clamp(v, 0, 1); return c * c; };

/** Small deterministic PRNG (mulberry32). Used for cached buffers and the offline check. */
export function mulberry(seed: number): Rand {
  let s = seed | 0;
  return () => {
    let t = (s = (s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Percussive envelope on a gain param: 0 → peak in `a` s, then exponential fall reaching -60 dB at `d` s. Returns the end time. */
export function perc(p: AudioParam, t: number, peak: number, a: number, d: number): number {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + a);
  p.setTargetAtTime(0, t + a, d / 6.9);
  return t + a + d;
}

/** Freeze a param at its value at time t, dropping later automation (never a jump). */
export function holdAt(p: AudioParam, t: number): void {
  const q = p as AudioParam & { cancelAndHoldAtTime?: (t: number) => AudioParam };
  if (typeof q.cancelAndHoldAtTime === 'function') q.cancelAndHoldAtTime(t);
  else { const v = p.value; p.cancelScheduledValues(t); p.setValueAtTime(v, t); }
}

/**
 * Stop a source that was already given a stop time. The spec lets a later
 * stop() replace an earlier one; some older engines throw instead, and a
 * throw mid-schedule must never strand a phrase.
 */
export function stopAt(n: AudioScheduledSourceNode, t: number): void {
  try { n.stop(t); } catch { /* keeps its first stop time */ }
}

/** Attack, hold, release (linear), for sustained sounds. Returns the end time. */
export function ahr(p: AudioParam, t: number, peak: number, a: number, hold: number, r: number): number {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + a);
  p.setValueAtTime(peak, t + a + hold);
  p.linearRampToValueAtTime(0, t + a + hold + r);
  return t + a + hold + r;
}

/** Linear segments from 0: [[dt, value], ...] relative to t. Returns the end time. */
export function segs(p: AudioParam, t: number, pts: readonly (readonly [number, number])[]): number {
  p.setValueAtTime(0, t);
  let end = t;
  for (const [dt, v] of pts) { end = t + dt; p.linearRampToValueAtTime(v, end); }
  return end;
}

export class Engine {
  readonly ctx: BaseAudioContext;
  readonly sr: number;
  rand: Rand;

  readonly sfxIn: GainNode;
  readonly sfxWet: GainNode;
  readonly ambIn: GainNode;
  readonly musicIn: GainNode;
  readonly voiceIn: GainNode;
  private readonly musicVol: GainNode;
  readonly reverbIn: GainNode;
  /** master volume node: the signal before dynamics (tap point for the check) */
  readonly pre: GainNode;
  readonly comp: DynamicsCompressorNode;
  /** final node, connected to the destination */
  readonly out: AudioNode;

  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly waves = new Map<string, PeriodicWave>();
  private bufferOrder: string[] = [];

  constructor(ctx: BaseAudioContext, rand: Rand = Math.random) {
    this.ctx = ctx;
    this.sr = ctx.sampleRate;
    this.rand = rand;

    const mix = this.gain(1);
    const low = this.filter('lowshelf', 190, 0.7, undefined, 1.5);
    const high = this.filter('highshelf', 6500, 0.7, undefined, -2.5);
    mix.connect(low); low.connect(high);
    this.pre = this.gain(volGain(0.8));
    high.connect(this.pre);

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    this.comp = comp;
    this.pre.connect(comp);

    // transparent below 0.75, soft knee into 0.985 above: catches what the compressor lets through
    const limIn = this.gain(0.5);
    const lim = ctx.createWaveShaper();
    lim.curve = limiterCurve();
    lim.oversample = '2x';
    comp.connect(limIn); limIn.connect(lim);
    lim.connect(ctx.destination);
    this.out = lim;

    // the room
    this.reverbIn = this.gain(1);
    const conv = ctx.createConvolver();
    conv.normalize = true;
    conv.buffer = this.roomIR();
    const revOut = this.gain(0.6);
    this.reverbIn.connect(conv); conv.connect(revOut); revOut.connect(mix);

    const send = (from: AudioNode, amt: number) => { const g = this.gain(amt); from.connect(g); g.connect(this.reverbIn); };

    this.sfxIn = this.gain(volGain(0.8));
    this.sfxIn.connect(mix); send(this.sfxIn, 0.16);
    this.sfxWet = this.gain(volGain(0.8));
    this.sfxWet.connect(this.reverbIn);
    this.ambIn = this.gain(volGain(0.8));
    this.ambIn.connect(mix); send(this.ambIn, 0.12);

    this.musicIn = this.gain(1);
    this.musicVol = this.gain(volGain(0.5));
    const tone = this.filter('lowpass', 7200, 0.6);
    this.musicIn.connect(this.musicVol); this.musicVol.connect(tone);
    tone.connect(mix); send(tone, 0.42);

    this.voiceIn = this.gain(volGain(0.7));
    this.voiceIn.connect(mix); send(this.voiceIn, 0.1);
  }

  now(): number { return this.ctx.currentTime; }

  setVolume(which: 'master' | 'music' | 'sfx' | 'voice', v: number, at: number): void {
    const g = volGain(v);
    const ramp = (p: AudioParam) => { holdAt(p, at); p.setTargetAtTime(g, at, 0.06); };
    if (which === 'master') ramp(this.pre.gain);
    else if (which === 'music') ramp(this.musicVol.gain);
    else if (which === 'voice') ramp(this.voiceIn.gain);
    else { ramp(this.sfxIn.gain); ramp(this.sfxWet.gain); ramp(this.ambIn.gain); }
  }

  // ───────────── node helpers ─────────────

  gain(v = 0, dest?: AudioNode): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = v;
    if (dest) g.connect(dest);
    return g;
  }

  filter(type: BiquadFilterType, f: number, Q = 0.707, dest?: AudioNode, gainDb = 0): BiquadFilterNode {
    const b = this.ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = clamp(f, 10, this.sr * 0.45);
    b.Q.value = Q;
    b.gain.value = gainDb;
    if (dest) b.connect(dest);
    return b;
  }

  panner(pan: number, dest?: AudioNode): StereoPannerNode {
    const p = this.ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    if (dest) p.connect(dest);
    return p;
  }

  osc(type: OscillatorType, f: number, t: number, end: number, dest: AudioNode, detune = 0): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    o.connect(dest);
    o.start(t);
    o.stop(end + 0.02);
    return o;
  }

  /** an oscillator with a custom harmonic recipe (cached PeriodicWave) */
  waveOsc(key: string, harmonics: readonly number[], f: number, t: number, end: number, dest: AudioNode): OscillatorNode {
    let w = this.waves.get(key);
    if (!w) {
      const real = new Float32Array(harmonics.length + 1);
      const imag = new Float32Array(harmonics.length + 1);
      harmonics.forEach((a, i) => { imag[i + 1] = a; });
      w = this.ctx.createPeriodicWave(real, imag, { disableNormalization: false });
      this.waves.set(key, w);
    }
    const o = this.ctx.createOscillator();
    o.setPeriodicWave(w);
    o.frequency.value = f;
    o.connect(dest);
    o.start(t);
    o.stop(end + 0.02);
    return o;
  }

  /** an LFO: returns its output gain (the depth; automate .gain) and the oscillator (to stop it) */
  lfo(f: number, t: number, end: number, depth: number, type: OscillatorType = 'sine'): [GainNode, OscillatorNode] {
    const g = this.gain(depth);
    const o = this.osc(type, f, t, end, g);
    return [g, o];
  }

  /** a looping noise source starting at a random point of a 4 s buffer */
  noise(kind: NoiseKind, t: number, end: number, dest: AudioNode, rate = 1): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    const buf = this.noiseBuffer(kind);
    s.buffer = buf;
    s.loop = true;
    s.playbackRate.value = rate;
    s.connect(dest);
    s.start(t, this.rand() * buf.duration * 0.95);
    s.stop(end + 0.02);
    return s;
  }

  /** a decaying sine (pitch glide f1 → f2 over `glide` s): kicks, thumps, membranes */
  thump(dest: AudioNode, t: number, f1: number, f2: number, glide: number, peak: number, d: number, type: OscillatorType = 'sine'): number {
    const g = this.gain(0, dest);
    const end = perc(g.gain, t, peak, 0.002, d);
    const o = this.osc(type, f1, t, end, g);
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + glide);
    return end;
  }

  /** a filtered noise burst with a percussive envelope */
  burst(dest: AudioNode, t: number, kind: NoiseKind, ftype: BiquadFilterType, f: number, Q: number, peak: number, a: number, d: number): number {
    const g = this.gain(0, dest);
    const end = perc(g.gain, t, peak, a, d);
    const flt = this.filter(ftype, f, Q, g);
    this.noise(kind, t, end, flt);
    return end;
  }

  /** modal synthesis: a sum of decaying sines. The heart of every struck object. */
  modal(dest: AudioNode, t: number, f0: number, modes: readonly Mode[], peak: number, attack = 0.0015, spread = 0): number {
    let end = t;
    const nyq = this.sr * 0.45;
    for (const [r, a, d] of modes) {
      const f = f0 * r * (spread ? 1 + (this.rand() - 0.5) * spread : 1);
      if (f > nyq || f < 20 || a <= 0) continue;
      const g = this.gain(0, dest);
      const e = perc(g.gain, t, a * peak, attack, d);
      this.osc('sine', f, t, e, g);
      if (e > end) end = e;
    }
    return end;
  }

  /**
   * Plucked string (Karplus-Strong, pre-rendered and cached). Velocity is
   * gain only, so one buffer serves every dynamic; `variant` (0 or 1) picks
   * one of two excitations, which is how a double course gets its second string.
   */
  pluck(dest: AudioNode, t: number, f: number, o: { gain: number; decay?: number; bright?: number; pick?: number; detune?: number; rate?: number; variant?: number }): number {
    const buf = this.pluckBuffer(f, o.decay ?? 1.6, o.bright ?? 0.4, o.pick ?? 0.18, o.variant ?? (this.rand() < 0.5 ? 0 : 1));
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = (o.rate ?? 1) * Math.pow(2, (o.detune ?? 0) / 1200);
    const g = this.gain(o.gain, dest);
    s.connect(g);
    s.start(t);
    return t + buf.duration / s.playbackRate.value;
  }

  // ───────────── buffers ─────────────

  noiseBuffer(kind: NoiseKind): AudioBuffer {
    const key = 'noise:' + kind;
    const hit = this.buffers.get(key);
    if (hit) return hit;
    const fade = Math.floor(0.05 * this.sr);
    const n = Math.floor(4 * this.sr) + fade;
    const raw = new Float32Array(n);
    const r = mulberry(kind === 'white' ? 11 : kind === 'pink' ? 23 : 37);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const w = r() * 2 - 1;
      if (kind === 'white') raw[i] = w;
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        raw[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
        b6 = w * 0.115926;
      } else {
        last = (last + 0.02 * w) / 1.02;
        raw[i] = last;
      }
    }
    // seamless loop: crossfade the tail into the head
    const len = n - fade;
    for (let i = 0; i < fade; i++) {
      const k = i / fade;
      raw[i] = raw[i]! * k + raw[len + i]! * (1 - k);
    }
    let mean = 0;
    for (let i = 0; i < len; i++) mean += raw[i]!;
    mean /= len;
    let sq = 0;
    for (let i = 0; i < len; i++) { const v = raw[i]! - mean; sq += v * v; }
    const scale = 0.25 / Math.sqrt(sq / len || 1);
    const buf = this.ctx.createBuffer(1, len, this.sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (raw[i]! - mean) * scale;
    this.buffers.set(key, buf);
    return buf;
  }

  /**
   * Extended Karplus-Strong: a noise burst shaped by brightness and pick
   * position circulates in a tuned delay loop with a two-point average and
   * a fractional allpass. `decay` is the fundamental's time to -60 dB.
   */
  pluckBuffer(f: number, decay0: number, bright0: number, pick0: number, variant: number): AudioBuffer {
    // quantised so a whole piece needs only a few dozen buffers
    const decay = Math.round(decay0 * 10) / 10, bright = Math.round(bright0 * 20) / 20, pick = Math.round(pick0 * 20) / 20;
    const key = `ks:${Math.round(f * 10)}:${decay}:${bright}:${pick}:${variant}`;
    const hit = this.buffers.get(key);
    if (hit) return hit;
    // strings are rendered at half rate: everything above 5 kHz is shaved off by the bodies anyway
    const sr = KS_RATE;
    const dur = Math.min(decay * 0.9 + 0.05, 4.5);
    const n = Math.ceil(dur * sr);
    const out = new Float32Array(n);
    const L = sr / f - 0.5;
    let D = Math.floor(L);
    let frac = L - D;
    if (frac < 0.25) { D -= 1; frac += 1; }
    D = Math.max(2, D);
    const C = (1 - frac) / (1 + frac);
    const G = Math.pow(0.001, 1 / (decay * f));
    const rho = Math.min(0.99995, G / Math.max(0.5, Math.cos(Math.PI * f / sr)));

    // excitation: lowpassed noise, pick-position comb, zero mean
    const r = mulberry(Math.round(f * 7) + variant * 7919);
    const exc = new Float32Array(D);
    const k = 0.12 + 0.8 * clamp(bright, 0, 1);
    let lp = 0;
    for (let i = 0; i < D; i++) { lp += k * ((r() * 2 - 1) - lp); exc[i] = lp; }
    const P = Math.max(1, Math.round(clamp(pick, 0.02, 0.5) * D));
    const combed = new Float32Array(D);
    for (let i = 0; i < D; i++) combed[i] = exc[i]! - (i >= P ? exc[i - P]! : 0);
    let m = 0;
    for (let i = 0; i < D; i++) m += combed[i]!;
    m /= D;
    for (let i = 0; i < D; i++) combed[i] = combed[i]! - m;

    const dl = new Float32Array(D);
    let idx = 0, prev = 0, apx = 0, apy = 0;
    let dcx = 0, dcy = 0, peak = 0;
    for (let i = 0; i < n; i++) {
      const a = dl[idx]!;
      const h = rho * 0.5 * (a + prev);
      prev = a;
      const ap = C * h + apx - C * apy;
      apx = h; apy = ap;
      const y = ap + (i < D ? combed[i]! : 0);
      dl[idx] = y;
      idx = idx + 1 === D ? 0 : idx + 1;
      // DC blocker
      const o = y - dcx + 0.995 * dcy;
      dcx = y; dcy = o;
      out[i] = o;
      const ab = o < 0 ? -o : o;
      if (ab > peak) peak = ab;
    }
    const norm = peak > 0 ? 0.6 / peak : 1;
    const fadeN = Math.min(n, Math.floor(0.03 * sr));
    for (let i = 0; i < n; i++) {
      let v = out[i]! * norm;
      if (i >= n - fadeN) v *= (n - i) / fadeN;
      out[i] = v;
    }
    const buf = this.ctx.createBuffer(1, n, sr);
    buf.getChannelData(0).set(out);
    this.cache(key, buf);
    return buf;
  }

  private cache(key: string, buf: AudioBuffer): void {
    this.buffers.set(key, buf);
    this.bufferOrder.push(key);
    if (this.bufferOrder.length > 120) {
      const old = this.bufferOrder.shift()!;
      this.buffers.delete(old);
    }
  }

  /** a small wood-panelled room with a low ceiling: short pre-delay, early reflections, darkening 1.3 s tail */
  private roomIR(): AudioBuffer {
    const sr = this.sr;
    const secs = 1.6, t60 = 1.25, pre = 0.009;
    const n = Math.floor(secs * sr);
    const ir = this.ctx.createBuffer(2, n, sr);
    const early = [0.007, 0.0115, 0.017, 0.0235, 0.031, 0.0405, 0.052];
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      const r = mulberry(101 + ch * 17);
      let lp = 0;
      const p0 = Math.floor(pre * sr);
      for (let i = p0; i < n; i++) {
        const t = (i - p0) / sr;
        const env = Math.exp(-6.9 * t / t60);
        const k = 0.55 - 0.47 * Math.min(1, t / t60);
        lp += k * ((r() * 2 - 1) - lp);
        const fadeIn = t < 0.006 ? t / 0.006 : 1;
        d[i] = lp * env * fadeIn * 0.9;
      }
      early.forEach((et, j) => {
        const i = Math.floor((et + (ch ? 0.0013 * (j % 3) : 0.0009 * (j % 2))) * sr);
        if (i < n) d[i] = d[i]! + (j % 2 ? -1 : 1) * 0.55 * Math.pow(0.78, j);
      });
    }
    return ir;
  }
}

function limiterCurve(n = 4096): Float32Array<ArrayBuffer> {
  const c = new Float32Array(new ArrayBuffer(n * 4));
  const knee = 0.75, ceil = 0.985;
  for (let i = 0; i < n; i++) {
    const s = ((i / (n - 1)) * 2 - 1) * 2; // the shaper sees the signal at half scale
    const a = Math.abs(s);
    const y = a < knee ? a : knee + (ceil - knee) * Math.tanh((a - knee) / (ceil - knee));
    c[i] = Math.sign(s) * y;
  }
  return c;
}
