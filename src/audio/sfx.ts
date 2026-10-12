/**
 * Every SfxId as a small designed sound: modal strikes, plucked strings,
 * shaped noise and formant voices. Each recipe schedules onto `out` at time
 * `t`, with pitch multiplied by `r`, and returns its end time.
 */
import type { SfxId } from '../data/ids';
import { Engine, ahr, midiHz, perc, segs } from './engine';
import {
  BELL, BOARD, HANDBELL, brass, chimeAt, clink, drum, lute, luteBody, vowel, wood,
} from './instruments';

export interface SfxCtx { e: Engine; out: AudioNode; t: number; r: number }
type Recipe = (s: SfxCtx) => number;

const rr = (e: Engine, a: number, b: number): number => a + e.rand() * (b - a);
const pickOf = <T>(e: Engine, arr: readonly T[]): T => arr[Math.floor(e.rand() * arr.length)]!;

/** D Dorian, the house mode, for the little plucked UI sounds */
const DORIAN_D = [62, 64, 65, 67, 69, 71, 72, 74];

/** horn and trumpet calls ride the natural harmonic series */
const harm = (fund: number, n: number): number => fund * n;

export const RECIPES: Record<SfxId, Recipe> = {
  coin({ e, out, t, r }) {
    let end = clink(e, out, t, rr(e, 2250, 2450) * r, 1);
    end = Math.max(end, clink(e, out, t + rr(e, 0.06, 0.09), rr(e, 2850, 3050) * r, 0.72));
    return end;
  },

  coins({ e, out, t, r }) {
    let end = t, tt = t;
    const n = 15 + Math.floor(e.rand() * 7);
    for (let i = 0; i < n; i++) {
      tt += 0.018 + e.rand() * 0.035 * (1 + i / 7);
      const vel = (0.25 + e.rand() * 0.55) * (1 - i / (n * 1.4));
      end = Math.max(end, clink(e, out, tt, rr(e, 1700, 3300) * r, vel, 0.55));
    }
    // the rustle of coin on coin
    const g = e.gain(0, out);
    perc(g.gain, t, 0.07, 0.03, 0.75);
    e.noise('white', t, tt + 0.2, e.filter('bandpass', 5200, 0.8, g));
    return Math.max(end, tt + 0.2);
  },

  hammer({ e, out, t, r }) {
    let end = e.thump(out, t, 150 * r, 72 * r, 0.05, 0.5, 0.14);
    end = Math.max(end, wood(e, out, t, rr(e, 400, 440) * r, 0.9, 0.9, BOARD));
    end = Math.max(end, e.modal(out, t, 2600 * r, [[1, 1, 0.12], [2.71, 0.45, 0.06]], 0.09));
    e.burst(out, t, 'white', 'bandpass', 2500, 0.7, 0.3, 0.0008, 0.03);
    return end;
  },

  saw({ e, out, t, r }) {
    let tt = t;
    for (let i = 0; i < 3; i++) {
      const push = i % 2 === 0;
      const d = rr(e, 0.2, 0.27);
      const g = e.gain(0, out);
      ahr(g.gain, tt, push ? 0.32 : 0.22, 0.04, d - 0.09, 0.05);
      // the teeth: a fast amplitude ripple
      const teeth = e.gain(0.55, g);
      const [tm] = e.lfo(rr(e, 95, 135) * r, tt, tt + d, 0.45, 'sawtooth');
      tm.connect(teeth.gain);
      const bp = e.filter('bandpass', (push ? 2200 : 1800) * r, 2.2, teeth);
      bp.frequency.setValueAtTime((push ? 2200 : 1800) * r, tt);
      bp.frequency.linearRampToValueAtTime((push ? 3200 : 2500) * r, tt + d);
      e.noise('white', tt, tt + d, bp);
      e.burst(out, tt, 'white', 'bandpass', 5600, 4, 0.05, 0.02, d);
      tt += d + 0.035;
    }
    return tt;
  },

  bell({ e, out, t, r }) {
    const p = 330 * r;
    let end = e.modal(out, t, p, BELL, 0.42, 0.0015, 0.004);
    e.burst(out, t, 'white', 'bandpass', 3200, 0.8, 0.14, 0.0006, 0.03);
    end = Math.max(end, e.modal(out, t, 4700 * r, [[1, 1, 0.05], [1.62, 0.6, 0.03]], 0.05));
    return end;
  },

  horn({ e, out, t, r }) {
    const F = 116.5 * r; // a natural horn in B flat
    return brass(e, out, t, [
      { f: harm(F, 3), d: 0.14, v: 0.85 }, { f: harm(F, 4), d: 0.15, v: 0.9 }, { f: harm(F, 4), d: 0.62, v: 1 },
    ], { bright: 3.0, formant: 820, gain: 0.55 });
  },

  herald({ e, out, t, r }) {
    const F = 174.6 * r; // a bright little trumpet in F
    return brass(e, out, t, [
      { f: harm(F, 4), d: 0.075, v: 0.75 }, { f: harm(F, 4), d: 0.075, v: 0.8 }, { f: harm(F, 5), d: 0.08, v: 0.85 }, { f: harm(F, 6), d: 0.36, v: 1 },
    ], { bright: 4.2, formant: 1300, gain: 0.38 });
  },

  fanfare({ e, out, t, r }) {
    const F = 130.8 * r;
    const top = [4, 4, 5, 6], low = [3, 3, 4, 4], dur = [0.15, 0.15, 0.15, 0.85];
    let end = brass(e, out, t, top.map((h, i) => ({ f: harm(F, h), d: dur[i]!, v: i === 3 ? 1 : 0.85 })), { bright: 4.0, formant: 1250, gain: 0.36 });
    end = Math.max(end, brass(e, out, t + 0.004, low.map((h, i) => ({ f: harm(F, h) * 1.002, d: dur[i]!, v: 0.8 })), { bright: 3.2, formant: 900, gain: 0.25 }));
    drum(e, out, t, 't', 0.5); drum(e, out, t + 0.15, 't', 0.5); drum(e, out, t + 0.3, 't', 0.55);
    drum(e, out, t + 0.45, 'D', 0.8);
    return end;
  },

  door({ e, out, t, r }) {
    // the creak: stick-slip friction, a buzzing source with a wandering pitch through the door's resonances
    const cd = 0.55;
    const amp = e.gain(0, out);
    segs(amp.gain, t, [[0.05, 0.5], [0.2, 0.34], [0.32, 0.52], [cd - 0.05, 0.25], [cd, 0]]);
    const sum = e.gain(1);
    for (const [f, q, a] of [[620, 6, 1], [1450, 8, 0.7], [2800, 10, 0.35]] as const) sum.connect(e.filter('bandpass', f * r, q, e.gain(a, amp)));
    const src = e.osc('sawtooth', 40, t, t + cd, sum);
    let tt = t, f = 38;
    while (tt < t + cd) {
      f = Math.min(95, f * rr(e, 0.86, 1.22) + 1.2);
      src.frequency.setValueAtTime(f * r, tt);
      tt += rr(e, 0.012, 0.03);
    }
    // the close
    const tc = t + cd + 0.06;
    let end = e.thump(out, tc, 95, 55, 0.08, 0.42, 0.26);
    end = Math.max(end, wood(e, out, tc, 180 * r, 0.9, 1.4, BOARD));
    end = Math.max(end, e.modal(out, tc + 0.022, 2200 * r, [[1, 1, 0.03], [1.8, 0.6, 0.02]], 0.12));
    e.burst(out, tc, 'brown', 'lowpass', 400, 0.7, 0.4, 0.002, 0.12);
    return end;
  },

  knock({ e, out, t, r }) {
    let end = t;
    const times = [0, rr(e, 0.15, 0.17), rr(e, 0.29, 0.32)];
    const vels = [1, 0.82, 0.95];
    times.forEach((dt, i) => {
      const tt = t + dt;
      const f = 210 * r * rr(e, 0.97, 1.03);
      end = Math.max(end, wood(e, out, tt, f, vels[i]!, 1, [[1, 1, 0.09], [1.9, 0.55, 0.06], [3.1, 0.3, 0.04], [4.4, 0.12, 0.025]]));
      e.thump(out, tt, 120, 95, 0.02, 0.28 * vels[i]!, 0.07);
      e.burst(out, tt, 'white', 'bandpass', 1300, 1, 0.22 * vels[i]!, 0.0006, 0.016);
    });
    return end;
  },

  page({ e, out, t, r }) {
    // lift: a soft rustle
    e.burst(out, t, 'white', 'bandpass', 2500 * r, 0.9, 0.08, 0.05, 0.12);
    // flip: a fluttering sweep
    const tf = t + 0.08;
    const g = e.gain(0, out);
    segs(g.gain, tf, [[0.04, 0.22], [0.12, 0.16], [0.26, 0]]);
    const flutter = e.gain(0.5, g);
    const [fl] = e.lfo(rr(e, 24, 36), tf, tf + 0.3, 0.5, 'triangle');
    fl.connect(flutter.gain);
    const bp = e.filter('bandpass', 1500 * r, 1.1, flutter);
    bp.frequency.setValueAtTime(1500 * r, tf);
    bp.frequency.linearRampToValueAtTime(5200 * r, tf + 0.12);
    bp.frequency.linearRampToValueAtTime(2200 * r, tf + 0.28);
    e.noise('white', tf, tf + 0.3, bp);
    // the air it moves
    e.burst(out, tf + 0.1, 'brown', 'lowpass', 300, 0.7, 0.18, 0.01, 0.12);
    return tf + 0.32;
  },

  quill({ e, out, t, r }) {
    let tt = t;
    const strokes = 4 + Math.floor(e.rand() * 2);
    for (let i = 0; i < strokes; i++) {
      const d = rr(e, 0.06, 0.12);
      const g = e.gain(0, out);
      ahr(g.gain, tt, rr(e, 0.1, 0.17), 0.01, d - 0.03, 0.02);
      const grain = e.gain(0.45, g);
      const [gr] = e.lfo(rr(e, 170, 260), tt, tt + d, 0.55, 'sawtooth');
      gr.connect(grain.gain);
      const f = rr(e, 3800, 6400) * r;
      const bp = e.filter('bandpass', f, 3, e.filter('highpass', 2000, 0.7, grain));
      bp.frequency.setValueAtTime(f, tt);
      bp.frequency.linearRampToValueAtTime(f * rr(e, 0.8, 1.2), tt + d);
      e.noise('white', tt, tt + d, bp);
      tt += d + rr(e, 0.03, 0.06);
    }
    return tt;
  },

  stamp({ e, out, t, r }) {
    let end = e.thump(out, t, 85 * r, 42 * r, 0.09, 0.62, 0.24);
    end = Math.max(end, e.burst(out, t, 'brown', 'lowpass', 500, 0.7, 0.36, 0.003, 0.13));
    // the squish of warm wax
    const g = e.gain(0, out);
    perc(g.gain, t + 0.01, 0.12, 0.02, 0.14);
    const bp = e.filter('bandpass', 1200 * r, 1.5, g);
    bp.frequency.setValueAtTime(1200 * r, t + 0.01);
    bp.frequency.exponentialRampToValueAtTime(600 * r, t + 0.15);
    e.noise('pink', t, t + 0.2, bp);
    e.modal(out, t, 1400 * r, [[1, 1, 0.03], [2.2, 0.55, 0.02]], 0.12);
    return Math.max(end, t + 0.2);
  },

  thud({ e, out, t, r }) {
    let end = e.thump(out, t, 70 * r, 38 * r, 0.15, 0.72, 0.36);
    end = Math.max(end, e.burst(out, t, 'brown', 'lowpass', 250, 0.7, 0.42, 0.003, 0.26));
    end = Math.max(end, e.modal(out, t, 120 * r, [[1, 1, 0.2], [2.1, 0.5, 0.1]], 0.28));
    return end;
  },

  pop({ e, out, t, r }) {
    const g = e.gain(0, out);
    const end = perc(g.gain, t, 0.36, 0.001, 0.07);
    const o = e.osc('sine', 380 * r, t, end, g);
    o.frequency.setValueAtTime(380 * r, t);
    o.frequency.exponentialRampToValueAtTime(1250 * r, t + 0.035);
    const o2 = e.osc('triangle', 760 * r, t, end, e.gain(0.15, g));
    o2.frequency.setValueAtTime(760 * r, t);
    o2.frequency.exponentialRampToValueAtTime(2500 * r, t + 0.035);
    e.burst(out, t, 'white', 'bandpass', 1200, 1, 0.12, 0.0005, 0.012);
    return end;
  },

  whoosh({ e, out, t, r }) {
    const pan = e.panner(-0.45, out);
    pan.pan.setValueAtTime(-0.45, t);
    pan.pan.linearRampToValueAtTime(0.45, t + 0.5);
    const g = e.gain(0, pan);
    segs(g.gain, t, [[0.2, 0.36], [0.5, 0]]);
    const bp = e.filter('bandpass', 350 * r, 1.2, g);
    bp.frequency.setValueAtTime(350 * r, t);
    bp.frequency.exponentialRampToValueAtTime(2200 * r, t + 0.22);
    bp.frequency.exponentialRampToValueAtTime(500 * r, t + 0.5);
    e.noise('pink', t, t + 0.52, bp);
    return t + 0.52;
  },

  error({ e, out, t, r }) {
    let end = wood(e, out, t, 233 * r, 0.75, 1.3, [[1, 1, 0.12], [2.6, 0.42, 0.06], [4.1, 0.2, 0.03]]);
    e.thump(out, t, 117 * r, 92 * r, 0.05, 0.3, 0.12);
    const t2 = t + 0.12;
    end = Math.max(end, wood(e, out, t2, 175 * r, 0.9, 1.5, [[1, 1, 0.14], [2.6, 0.42, 0.07], [4.1, 0.2, 0.035]]));
    end = Math.max(end, e.thump(out, t2, 98 * r, 70 * r, 0.06, 0.42, 0.16));
    return end;
  },

  success({ e, out, t, r }) {
    const body = luteBody(e, out);
    let end = t;
    [[62, 0.5], [69, 0.45], [74, 0.55]].forEach(([m, v], i) => {
      end = Math.max(end, lute(e, body, t + i * 0.07, m! + 12 * Math.log2(r), v!, 1.3));
    });
    end = Math.max(end, chimeAt(e, out, t + 0.14, midiHz(86) * r, 0.25));
    return end;
  },

  growl({ e, out, t, r }) {
    const dur = rr(e, 0.85, 1.05);
    const amp = e.gain(0, out);
    segs(amp.gain, t, [[0.16, 0.42], [0.45, 0.36], [dur - 0.15, 0.3], [dur, 0]]);
    // rough amplitude: the throat flapping
    const rough = e.gain(0.6, amp);
    const [rg] = e.lfo(rr(e, 24, 32), t, t + dur, 0.4, 'square');
    rg.connect(rough.gain);
    const sum = e.gain(1);
    sum.connect(e.filter('bandpass', 380 * r, 3, rough));
    sum.connect(e.filter('bandpass', 850 * r, 4, e.gain(0.6, rough)));
    const lp = e.filter('lowpass', 1200, 0.7, sum);
    const src = e.osc('sawtooth', 65 * r, t, t + dur, lp);
    src.frequency.setValueAtTime(62 * r, t);
    src.frequency.linearRampToValueAtTime(74 * r, t + dur * 0.4);
    src.frequency.linearRampToValueAtTime(56 * r, t + dur);
    const [j1] = e.lfo(7.3, t, t + dur, 5 * r); j1.connect(src.frequency);
    const [j2] = e.lfo(12.9, t, t + dur, 3 * r); j2.connect(src.frequency);
    e.noise('brown', t, t + dur, e.filter('bandpass', 500, 1.2, e.gain(0.5, amp)));
    return t + dur;
  },

  squawk({ e, out, t, r }) {
    const call = (t0: number, d: number, fa: number, fb: number, fc: number, peak: number) => {
      const amp = e.gain(0, out);
      segs(amp.gain, t0, [[0.02, peak], [d * 0.6, peak * 0.85], [d, 0]]);
      const sum = e.gain(1);
      sum.connect(e.filter('bandpass', 1800 * r, 4, amp));
      sum.connect(e.filter('bandpass', 3200 * r, 5, e.gain(0.55, amp)));
      sum.connect(e.filter('lowpass', 1200, 0.7, e.gain(0.35, amp)));
      const s1 = e.osc('sawtooth', fa * r, t0, t0 + d, sum);
      const s2 = e.osc('square', fa * 2 * r, t0, t0 + d, e.gain(0.25, sum), 14);
      for (const o of [s1, s2]) {
        const m = o === s2 ? 2 : 1;
        o.frequency.setValueAtTime(fa * r * m, t0);
        o.frequency.linearRampToValueAtTime(fb * r * m, t0 + d * 0.4);
        o.frequency.linearRampToValueAtTime(fc * r * m, t0 + d);
      }
      // the rasp: fast vibrato
      const [ra] = e.lfo(rr(e, 32, 40), t0, t0 + d, 45 * r); ra.connect(s1.frequency);
      e.noise('white', t0, t0 + d, e.filter('bandpass', 2500, 2, e.gain(peak * 0.25, amp)));
      return t0 + d;
    };
    call(t, 0.3, 700, 1250, 950, 0.36);
    return call(t + 0.34, 0.13, 920, 980, 610, 0.3);
  },

  squeak({ e, out, t, r }) {
    const chirp = (t0: number, a: number, b: number, c: number, peak: number) => {
      const g = e.gain(0, out);
      const end = perc(g.gain, t0, peak, 0.006, 0.08);
      const o = e.osc('sine', a * r, t0, end, g);
      o.frequency.setValueAtTime(a * r, t0);
      o.frequency.linearRampToValueAtTime(b * r, t0 + 0.03);
      o.frequency.linearRampToValueAtTime(c * r, t0 + 0.07);
      e.osc('triangle', a * 2 * r, t0, end, e.gain(0.08, g)).frequency.setValueAtTime(b * 2 * r, t0 + 0.03);
      return end;
    };
    chirp(t, 2600, 3400, 2900, 0.2);
    return chirp(t + rr(e, 0.1, 0.13), 3000, 3800, 3200, 0.16);
  },

  splash({ e, out, t, r }) {
    const g = e.gain(0, out);
    perc(g.gain, t, 0.45, 0.005, 0.42);
    const lp = e.filter('lowpass', 6000, 0.8, g);
    lp.frequency.setValueAtTime(6000, t);
    lp.frequency.exponentialRampToValueAtTime(700, t + 0.35);
    e.noise('white', t, t + 0.5, lp);
    e.burst(out, t, 'pink', 'bandpass', 1200 * r, 0.8, 0.22, 0.003, 0.12);
    let end = t + 0.5;
    const drops = 6 + Math.floor(e.rand() * 5);
    for (let i = 0; i < drops; i++) {
      const td = t + 0.05 + e.rand() * 0.65;
      const f = rr(e, 700, 1400) * r;
      const dg = e.gain(0, out);
      const de = perc(dg.gain, td, rr(e, 0.05, 0.12), 0.001, 0.05);
      const o = e.osc('sine', f, td, de, dg);
      o.frequency.setValueAtTime(f, td);
      o.frequency.exponentialRampToValueAtTime(f * 1.8, td + rr(e, 0.02, 0.04));
      end = Math.max(end, de);
    }
    return end;
  },

  fire({ e, out, t, r }) {
    const dur = 1.5;
    const body = e.gain(0, out);
    segs(body.gain, t, [[0.2, 0.26], [1.1, 0.22], [dur, 0]]);
    e.noise('brown', t, t + dur, e.filter('lowpass', 700, 0.7, body));
    const hiss = e.gain(0, out);
    segs(hiss.gain, t, [[0.2, 0.05], [1.1, 0.04], [dur, 0]]);
    e.noise('white', t, t + dur, e.filter('highpass', 3000, 0.7, hiss));
    const n = 18 + Math.floor(e.rand() * 12);
    for (let i = 0; i < n; i++) {
      const tc = t + e.rand() * (dur - 0.1);
      e.burst(out, tc, 'white', 'bandpass', rr(e, 1500, 6000) * r, 1, rr(e, 0.1, 0.38), 0.0004, rr(e, 0.004, 0.02));
    }
    return t + dur;
  },

  thunder({ e, out, t, r }) {
    const near = e.rand();
    // the crack (closer storms crack harder)
    e.burst(out, t, 'white', 'bandpass', 1800 * r, 0.5, 0.2 + near * 0.2, 0.005, 0.35);
    // the rolling rumble: a handful of overlapping swells
    const rum = e.gain(0, out);
    rum.gain.setValueAtTime(0, t);
    let tt = t + 0.04;
    const rolls = 4 + Math.floor(e.rand() * 3);
    for (let i = 0; i < rolls; i++) {
      const a = rr(e, 0.1, 0.3), pk = rr(e, 0.6, 1) * (1 - i / (rolls + 1));
      rum.gain.linearRampToValueAtTime(pk, tt + a);
      rum.gain.setTargetAtTime(pk * 0.35, tt + a, rr(e, 0.15, 0.35));
      tt += a + rr(e, 0.25, 0.65);
    }
    rum.gain.setTargetAtTime(0, tt, 0.5);
    const end = tt + 2.2;
    e.noise('brown', t, end, e.filter('lowpass', 150 * r, 0.7, e.gain(1.6, rum)));
    e.noise('pink', t, end, e.filter('lowpass', 520 * r, 0.7, e.gain(0.35, rum)));
    return end;
  },

  gavel({ e, out, t, r }) {
    let end = t;
    for (const [dt, v] of [[0, 0.9], [0.22, 1]] as const) {
      const tt = t + dt;
      end = Math.max(end, wood(e, out, tt, 520 * r, v, 0.8, [[1, 1, 0.06], [2.2, 0.62, 0.04], [3.6, 0.36, 0.025], [5.3, 0.15, 0.015]]));
      e.thump(out, tt, 165 * r, 140 * r, 0.02, 0.32 * v, 0.09);
      e.burst(out, tt, 'white', 'highpass', 2200, 0.7, 0.18 * v, 0.0005, 0.01);
    }
    return end;
  },

  cheer({ e, out, t, r }) {
    let end = t + 1.8;
    const voices = 7;
    for (let i = 0; i < voices; i++) {
      const t0 = t + e.rand() * 0.32;
      const f = (e.rand() < 0.5 ? rr(e, 140, 190) : rr(e, 230, 320)) * r;
      const v = pickOf(e, ['a', 'a', 'e', 'o']);
      const hold = rr(e, 0.18, 0.45);
      end = Math.max(end, vowel(e, out, t0, { f, f2: f * rr(e, 1.18, 1.35), glide: 0.22, v, a: rr(e, 0.04, 0.09), hold, r: 0.3, peak: 0.075, vib: 0.012, breath: 0.25 }));
      if (e.rand() < 0.5) {
        // a second syllable: "hur-RAH"
        const t1 = t0 + hold + 0.2;
        end = Math.max(end, vowel(e, out, t1, { f: f * 1.25, f2: f * 1.1, glide: 0.3, v: 'a', a: 0.05, hold: rr(e, 0.2, 0.35), r: 0.35, peak: 0.08, vib: 0.015, breath: 0.2 }));
      }
    }
    // hands
    const claps = 14 + Math.floor(e.rand() * 10);
    for (let i = 0; i < claps; i++) e.burst(out, t + 0.2 + e.rand() * 1.4, 'white', 'bandpass', rr(e, 1300, 2000), 0.9, rr(e, 0.08, 0.18), 0.0005, 0.03);
    // the murmur under it
    const m = e.gain(0, out);
    segs(m.gain, t, [[0.15, 0.08], [1.3, 0.06], [end - t, 0]]);
    e.noise('pink', t, end, e.filter('bandpass', 900, 0.7, m));
    return end;
  },

  boo({ e, out, t, r }) {
    let end = t;
    for (let i = 0; i < 5; i++) {
      const f = rr(e, 110, 190) * r;
      end = Math.max(end, vowel(e, out, t + e.rand() * 0.2, { f, f2: f * 0.75, glide: 1.0, v: 'u', a: 0.15, hold: rr(e, 0.5, 0.7), r: 0.4, peak: 0.1, vib: 0.02, breath: 0.15 }));
    }
    const m = e.gain(0, out);
    segs(m.gain, t, [[0.2, 0.05], [1.0, 0.04], [end - t, 0]]);
    e.noise('pink', t, end, e.filter('lowpass', 500, 0.7, m));
    return end;
  },

  pluck({ e, out, t, r }) {
    const body = luteBody(e, out);
    return lute(e, body, t, pickOf(e, DORIAN_D) + 12 * Math.log2(r), 0.62, 1.1);
  },

  chime({ e, out, t, r }) {
    const f = 1046.5 * pickOf(e, [1, 9 / 8, 4 / 3, 3 / 2]) * r;
    return chimeAt(e, out, t, f, 0.85);
  },

  click({ e, out, t, r }) {
    const end = e.modal(out, t, 1900 * r, [[1, 1, 0.02], [2.3, 0.55, 0.012], [3.8, 0.3, 0.008]], 0.3, 0.0005);
    e.burst(out, t, 'white', 'bandpass', 4000, 1, 0.08, 0.0004, 0.006);
    return end;
  },

  build_done({ e, out, t, r }) {
    wood(e, out, t, 420 * r, 0.6, 1, BOARD);
    wood(e, out, t + 0.13, 440 * r, 0.7, 1, BOARD);
    const t2 = t + 0.3;
    let end = e.modal(out, t2, 784 * r, HANDBELL, 0.26, 0.002);
    end = Math.max(end, e.modal(out, t2 + 0.012, 1175 * r, HANDBELL, 0.14, 0.002));
    const body = luteBody(e, out);
    end = Math.max(end, lute(e, body, t2, 55 + 12 * Math.log2(r), 0.5, 1.4));
    end = Math.max(end, lute(e, body, t2 + 0.025, 62 + 12 * Math.log2(r), 0.45, 1.4));
    return end;
  },

  place({ e, out, t, r }) {
    let end = wood(e, out, t, 300 * r, 0.85, 0.8, [[1, 1, 0.06], [2.1, 0.55, 0.04], [3.4, 0.28, 0.02]]);
    e.thump(out, t, 140 * r, 110 * r, 0.02, 0.32, 0.07);
    // the little wobble as it settles
    end = Math.max(end, wood(e, out, t + 0.05, 330 * r, 0.25, 0.6));
    end = Math.max(end, wood(e, out, t + 0.085, 345 * r, 0.12, 0.5));
    e.burst(out, t, 'pink', 'lowpass', 1200, 0.7, 0.06, 0.01, 0.2);
    return Math.max(end, t + 0.22);
  },

  crumble({ e, out, t, r }) {
    const dur = 1.3;
    const rum = e.gain(0, out);
    perc(rum.gain, t, 0.45, 0.05, dur);
    e.noise('brown', t, t + dur, e.filter('lowpass', 350, 0.7, rum));
    const n = 22 + Math.floor(e.rand() * 12);
    let end = t + dur;
    for (let i = 0; i < n; i++) {
      const k = Math.pow(e.rand(), 1.8);
      const ts = t + k * 1.2;
      const f = rr(e, 250, 1200) * r;
      end = Math.max(end, e.modal(out, ts, f, [[1, 1, rr(e, 0.04, 0.08)], [2.3, 0.5, 0.03]], rr(e, 0.08, 0.3) * (1 - k * 0.7)));
    }
    const dust = e.gain(0, out);
    perc(dust.gain, t, 0.06, 0.05, 0.9);
    e.noise('pink', t, t + 1, e.filter('bandpass', 2500, 0.8, dust));
    return end;
  },

  magic({ e, out, t, r }) {
    const notes = [587.3, 659.3, 880, 987.8, 1174.7, 1318.5];
    let end = t;
    const [trem] = e.lfo(6, t, t + 2, 0.3);
    notes.forEach((f, i) => {
      const tt = t + i * 0.045;
      const pan = e.panner(i % 2 ? 0.35 : -0.35, out);
      const g = e.gain(0.7, pan);
      trem.connect(g.gain);
      end = Math.max(end, e.modal(g, tt, f * r, [[1, 1, 1.25], [2, 0.3, 0.7], [3, 0.08, 0.4]], 0.16, 0.015));
    });
    const sp = e.gain(0, out);
    perc(sp.gain, t, 0.035, 0.05, 0.8);
    const bp = e.filter('bandpass', 5000, 2, e.filter('highpass', 6000, 0.7, sp));
    bp.frequency.setValueAtTime(5000, t);
    bp.frequency.exponentialRampToValueAtTime(9000, t + 0.6);
    e.noise('white', t, t + 0.9, bp);
    return end;
  },

  sigh({ e, out, t, r }) {
    const dur = 0.95;
    const amp = e.gain(0, out);
    segs(amp.gain, t, [[0.18, 0.15], [0.3, 0.2], [dur, 0]]);
    const sum = e.gain(1);
    const f1 = e.filter('bandpass', 700 * r, 4, amp);
    const f2 = e.filter('bandpass', 1200 * r, 5, e.gain(0.7, amp));
    sum.connect(f1); sum.connect(f2);
    sum.connect(e.filter('lowpass', 2000, 0.7, e.gain(0.25, amp)));
    for (const [fl, a, b] of [[f1, 700, 450], [f2, 1200, 900]] as const) {
      fl.frequency.setValueAtTime(a * r, t);
      fl.frequency.linearRampToValueAtTime(b * r, t + dur);
    }
    e.noise('pink', t, t + dur, e.gain(1.4, sum));
    // a faint voiced "mm" at the start
    const vg = e.gain(0, sum);
    segs(vg.gain, t, [[0.08, 0.05], [0.4, 0]]);
    const vo = e.osc('sawtooth', 140 * r, t, t + 0.4, vg);
    vo.frequency.linearRampToValueAtTime(112 * r, t + 0.4);
    return t + dur;
  },

  laugh({ e, out, t, r }) {
    const base = pickOf(e, [175, 210, 250]) * r;
    const n = 4 + Math.floor(e.rand() * 2);
    const amp = e.gain(0, out);
    const sum = e.gain(1);
    sum.connect(e.filter('bandpass', 750, 5, amp));
    sum.connect(e.filter('bandpass', 1200, 6, e.gain(0.6, amp)));
    sum.connect(e.filter('lowpass', 900, 0.7, e.gain(0.3, amp)));
    let tt = t;
    const total = n * 0.12 + 0.12;
    const src = e.osc('sawtooth', base, t, t + total, sum);
    const breath = e.gain(0, sum);
    e.noise('pink', t, t + total, breath);
    const [vb] = e.lfo(6, t, t + total, base * 0.015); vb.connect(src.frequency);
    amp.gain.setValueAtTime(0, t);
    for (let i = 0; i < n; i++) {
      const step = 0.125 - i * 0.006;
      const p = base * (1 - i * 0.06);
      src.frequency.setValueAtTime(p * 1.06, tt);
      src.frequency.linearRampToValueAtTime(p, tt + step * 0.7);
      // the "h" then the "a"
      breath.gain.setValueAtTime(0.6, tt);
      breath.gain.linearRampToValueAtTime(0.1, tt + 0.03);
      amp.gain.setValueAtTime(0, tt);
      amp.gain.linearRampToValueAtTime(0.28 * (1 - i * 0.1), tt + 0.022);
      amp.gain.setValueAtTime(0.26 * (1 - i * 0.1), tt + step * 0.6);
      amp.gain.linearRampToValueAtTime(0, tt + step * 0.85);
      tt += step;
    }
    return t + total;
  },
};

/** extra reverb per sound (the room around it), added to the bus send */
export const WET: Partial<Record<SfxId, number>> = {
  bell: 0.35, horn: 0.3, herald: 0.25, fanfare: 0.3, chime: 0.3, magic: 0.4, build_done: 0.2, success: 0.15,
  gavel: 0.3, knock: 0.1, thunder: 0.15, cheer: 0.2, boo: 0.2, pluck: 0.15, sigh: 0.1, laugh: 0.1, squawk: 0.25, growl: 0.15,
};

/** how many of one sound may ring at once */
export const PER_ID_CAP: Partial<Record<SfxId, number>> = {
  coin: 8, coins: 2, hammer: 4, saw: 2, bell: 3, horn: 2, herald: 2, fanfare: 1, thunder: 2, cheer: 2, boo: 2,
  fire: 2, crumble: 3, click: 4, pop: 4, place: 3, chime: 4, pluck: 5,
};

/** sounds whose pitch should barely wander (tuned instruments) */
export const STEADY: ReadonlySet<SfxId> = new Set<SfxId>(['bell', 'horn', 'herald', 'fanfare', 'success', 'build_done', 'magic', 'chime']);

/** rough loudness trims so every sound sits at a similar level */
export const TRIM: Partial<Record<SfxId, number>> = {
  saw: 2.8, page: 2, quill: 3.5, whoosh: 2, error: 0.6, success: 1.5, door: 0.75, knock: 0.85, squawk: 1.6, squeak: 1.3,
  splash: 2, fire: 1.3, cheer: 2.8, boo: 2, sigh: 2.4, laugh: 1.9, click: 0.8, fanfare: 0.85, pluck: 1.2,
};

