/**
 * Speech blips: a run of short pitched syllables whose count and rhythm
 * follow the text (pauses at punctuation, a lift on questions), through two
 * vowel formants. The seed picks the speaker: pitch, pace, vocal-tract size,
 * timbre, breathiness and how sing-song they are. The same line from the
 * same speaker always sounds the same.
 */
import { Engine, clamp, holdAt, stopAt } from './engine';
import { VOWELS } from './instruments';

export interface VoiceProfile {
  base: number;       // Hz
  syl: number;        // seconds per syllable
  range: number;      // semitones of intonation
  formant: number;    // vocal tract scale
  breath: number;     // 0..0.3
  timbre: 0 | 1 | 2;
}

const TIMBRES: readonly (readonly number[])[] = [
  [1, 0.5, 0.24, 0.11, 0.05, 0.02],                  // round
  [1, 0.68, 0.48, 0.34, 0.22, 0.14, 0.08, 0.05],     // bright
  [1, 0.18, 0.55, 0.1, 0.32, 0.05, 0.18, 0.03],      // reedy
];

function h01(n: number): number {
  let t = (n + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function strHash(s: string, seed: number): number {
  let x = seed | 0;
  for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 0x5bd1e995) + 0x27d4eb2d;
  return h01(x);
}

export function profileOf(seed: number): VoiceProfile {
  const a = h01(seed * 7 + 1), b = h01(seed * 13 + 2), c = h01(seed * 17 + 3), d = h01(seed * 19 + 4), f = h01(seed * 23 + 5);
  const base = 95 * Math.pow(2, a * 1.75);              // 95..320 Hz
  const lowness = 1 - a;
  return {
    base,
    syl: 0.058 + b * 0.04,
    range: 3 + c * 4.5,
    formant: 0.86 + 0.32 * (0.55 * (1 - lowness) + 0.45 * d),
    breath: 0.04 + f * 0.24,
    timbre: Math.floor(h01(seed * 29 + 6) * 3) as 0 | 1 | 2,
  };
}

interface Syl { vowel: string; key: string; last: boolean; pauseAfter: number; q: boolean; ex: boolean }

/** split text into syllables (vowel groups) with the pauses that follow them */
export function syllables(text: string): Syl[] {
  const out: Syl[] = [];
  const tokens = text.replace(/…/g, '...').split(/\s+/).filter(Boolean);
  for (let ti = 0; ti < tokens.length; ti++) {
    const tok = tokens[ti]!;
    const letters = tok.replace(/[^A-Za-z0-9']/g, '');
    const trail = tok.slice(tok.search(/[^A-Za-z0-9']*$/));
    let groups: string[] = letters.toLowerCase().match(/[aeiouy]+|[0-9]{1,2}/g) ?? [];
    if (!groups.length && letters) groups = ['u'];
    if (groups.length > 4) groups = groups.slice(0, 4);
    // the rest of the sentence decides the lift
    let q = false, ex = false;
    for (let k = ti; k < tokens.length; k++) {
      const m = tokens[k]!.match(/[.!?]+$/);
      if (m) { q = m[0].includes('?'); ex = m[0].includes('!'); break; }
    }
    let pause = 0.035;
    if (/\.\.\./.test(trail)) pause = 0.4;
    else if (/[.!?]/.test(trail)) pause = 0.3;
    else if (/[,;:]/.test(trail)) pause = 0.17;
    groups.forEach((g, i) => {
      const last = i === groups.length - 1;
      const v = /[0-9]/.test(g) ? 'e' : g[0]!;
      out.push({ vowel: v, key: letters.toLowerCase() + i, last, pauseAfter: last ? pause : 0.008, q: q && /[?]/.test(trail) && last, ex });
    });
  }
  return out;
}

export interface Speech { end: number; stop(at: number): void }

export function speak(e: Engine, dest: AudioNode, t0: number, seed: number, text: string, o: { pitch?: number; rate?: number } = {}): Speech {
  const p = profileOf(seed);
  const rate = clamp(o.rate ?? 1, 0.4, 3);
  const base = p.base * clamp(o.pitch ?? 1, 0.4, 3);
  const syls = syllables(text).slice(0, 48);
  if (!syls.length) return { end: t0, stop() { /* nothing to stop */ } };

  // lay out the timeline first, so the nodes live exactly as long as the line
  const plan: { t: number; d: number; f0: number; f1: number; v: string; amp: number }[] = [];
  let t = t0 + 0.02;
  syls.forEach((s, i) => {
    if (t - t0 > 6.5) return;
    const hh = strHash(s.key, seed);
    const deg = [0, 2, 4, 5, 7][Math.floor(hh * 5)]!;
    const decl = -2 * (i / Math.max(1, syls.length - 1));
    let semi = deg * p.range / 7 + decl;
    if (s.q) semi += 4;
    if (s.ex) semi += 1.5;
    const d = p.syl * (0.8 + 0.4 * strHash(s.key + 'd', seed)) * (s.last ? 1.2 : 1) / rate;
    const f0 = base * Math.pow(2, semi / 12);
    const f1 = f0 * (s.q ? 1.08 : s.last ? 0.95 : 0.985);
    plan.push({ t, d, f0, f1, v: s.vowel, amp: s.ex ? 1.15 : 1 });
    t += d + s.pauseAfter / rate;
  });
  const end = plan[plan.length - 1]!.t + plan[plan.length - 1]!.d + 0.05;

  const out = e.filter('lowpass', 3200, 0.6, dest);
  const amp = e.gain(0, out);
  const sum = e.gain(1);
  const F1 = e.filter('bandpass', 600, 4.5, amp);
  const F2 = e.filter('bandpass', 1500, 6, e.gain(0.55, amp));
  sum.connect(F1); sum.connect(F2);
  sum.connect(e.filter('lowpass', 900, 0.7, e.gain(0.35, amp)));
  const src = e.waveOsc('voice' + p.timbre, TIMBRES[p.timbre]!, base, t0, end, sum);
  const noise = e.noise('pink', t0, end, e.gain(p.breath * 2.2, sum));

  const A = amp.gain;
  A.setValueAtTime(0, t0);
  for (const s of plan) {
    const [v1, v2] = VOWELS[s.v] ?? VOWELS.a!;
    src.frequency.setValueAtTime(s.f0, s.t);
    src.frequency.linearRampToValueAtTime(s.f1, s.t + s.d);
    F1.frequency.setTargetAtTime(v1 * p.formant, s.t, 0.01);
    F2.frequency.setTargetAtTime(v2 * p.formant, s.t, 0.01);
    const pk = 0.2 * s.amp;
    A.setValueAtTime(0, s.t);
    A.linearRampToValueAtTime(pk, s.t + 0.012);
    A.setValueAtTime(pk * 0.85, s.t + Math.max(0.013, s.d - 0.022));
    A.linearRampToValueAtTime(0, s.t + s.d);
  }

  let stopped = false;
  return {
    end,
    stop(at: number) {
      if (stopped || at >= end) return;
      stopped = true;
      holdAt(A, at);
      A.setTargetAtTime(0, at, 0.015);
      stopAt(src, at + 0.12);
      stopAt(noise, at + 0.12);
    },
  };
}
