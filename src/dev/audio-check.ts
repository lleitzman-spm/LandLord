/**
 * Structural check for the audio module (we cannot listen here, so we measure).
 * Renders every sfx, every mood for ten seconds, voice lines, weather beds and
 * a few event scenarios through an OfflineAudioContext, using the very same
 * AudioCore the game uses, and reports per sound: duration, peak, RMS, the
 * peak before the dynamics stage, DC offset, spectral centroid, and whether
 * anything clipped, was silent, rang on, ran away or contained NaN.
 *
 *   node tools/shot.mjs src/dev/audio-check.ts .tmp/audio-check.png --h 1700 --eval "window.__audioCheck"
 *
 * Results are printed with console.warn (the shot tool echoes warnings) and
 * drawn as a table with a waveform per sound.
 */
import { AudioCore } from '../audio/core';
import { createAudio } from '../audio/index';
import { mulberry } from '../audio/engine';
import { MOOD_NAMES } from '../audio/music';
import { SFX, type SfxId } from '../data/ids';
import type { GameState, Job, SimEvent, WeatherKind } from '../sim/types';
import type { MusicMood } from '../audio/api';
import { makeFixtureState } from './fixture';

const SR = 44100;

interface Result {
  group: string; name: string; secs: number;
  dur: number; peak: number; rms: number; pre: number; dc: number; centroid: number;
  clipped: number; nan: number; plays: number; env: Float32Array; problems: string[]; ms: number;
  /** music: RMS over 1.5-4.5 s (accompaniment, before the first phrase) and 6-10 s */
  early: number; late: number;
}

const db = (v: number): string => (v <= 1e-9 ? '-inf' : (20 * Math.log10(v)).toFixed(1));
function strSeed(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }

function centroidOf(x: Float32Array, start: number): number {
  const N = 4096;
  if (x.length < N) return 0;
  const s0 = Math.max(0, Math.min(start, x.length - N));
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = x[s0 + i]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j]!, re[i]!]; [im[i], im[j]] = [im[j]!, im[i]!]; }
  }
  for (let len = 2; len <= N; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < N; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const ar = re[i + k + len / 2]!, ai = im[i + k + len / 2]!;
        const tr = ar * wr - ai * wi, ti = ar * wi + ai * wr;
        re[i + k + len / 2] = re[i + k]! - tr; im[i + k + len / 2] = im[i + k]! - ti;
        re[i + k] = re[i + k]! + tr; im[i + k] = im[i + k]! + ti;
      }
    }
  }
  let num = 0, den = 0;
  for (let k = 1; k < N / 2; k++) { const m = Math.hypot(re[k]!, im[k]!); num += m * (k * SR / N); den += m; }
  return den > 0 ? num / den : 0;
}

type Kind = 'sfx' | 'music' | 'voice' | 'bed' | 'scene' | 'silent';

async function render(group: string, name: string, secs: number, kind: Kind, setup: (core: AudioCore) => void): Promise<Result> {
  const ctx = new OfflineAudioContext({ numberOfChannels: 4, length: Math.ceil(secs * SR), sampleRate: SR });
  const core = new AudioCore(ctx, { realtime: false, rand: mulberry(strSeed(name)) });
  const e = core.e;
  // post-dynamics output to channels 0-1, the pre-dynamics master to 2-3
  e.out.disconnect();
  const merger = ctx.createChannelMerger(4);
  const a = ctx.createChannelSplitter(2); e.out.connect(a); a.connect(merger, 0, 0); a.connect(merger, 1, 1);
  const b = ctx.createChannelSplitter(2); e.pre.connect(b); b.connect(merger, 0, 2); b.connect(merger, 1, 3);
  ctx.destination.channelInterpretation = 'discrete';
  merger.connect(ctx.destination);
  let plays = 0;
  const realPlay = core.play.bind(core);
  core.play = (id, opts, at) => { const r = realPlay(id, opts, at); if (r >= 0) plays++; return r; };
  core.setVirtualTime(0);
  setup(core);
  const t0 = performance.now();
  const buf = await ctx.startRendering();
  const ms = performance.now() - t0;
  return analyse(group, name, secs, kind, buf, plays, ms);
}

function analyse(group: string, name: string, secs: number, kind: Kind, buf: AudioBuffer, plays: number, ms: number): Result {
  const L = buf.getChannelData(0), R = buf.getChannelData(1), PL = buf.getChannelData(2), PR = buf.getChannelData(3);
  const n = L.length;
  let peak = 0, pre = 0, sum = 0, nan = 0, clipped = 0, first = -1, last = -1;
  for (let i = 0; i < n; i++) {
    const l = L[i]!, r = R[i]!;
    if (!Number.isFinite(l) || !Number.isFinite(r)) { nan++; continue; }
    const m = Math.max(Math.abs(l), Math.abs(r));
    if (m > peak) peak = m;
    if (m >= 1) clipped++;
    if (m > 0.001) { if (first < 0) first = i; last = i; }
    sum += l + r;
    const p = Math.max(Math.abs(PL[i]!), Math.abs(PR[i]!));
    if (p > pre) pre = p;
  }
  const dc = sum / (2 * n);
  // RMS over the sounding part (music: after the fade-in)
  const steady = kind === 'music' || kind === 'bed';
  const s0 = steady ? Math.min(n - 1, Math.floor(2 * SR)) : Math.max(0, first);
  const s1 = steady ? n : Math.max(s0 + 1, last + 1);
  let sq = 0, loudest = 0, loudAt = s0;
  const win = 2048;
  let acc = 0;
  for (let i = s0; i < s1; i++) {
    const v = (L[i]! + R[i]!) * 0.5;
    sq += L[i]! * L[i]! + R[i]! * R[i]!;
    acc += v * v;
    if ((i - s0) % win === win - 1) { if (acc > loudest) { loudest = acc; loudAt = i - win; } acc = 0; }
  }
  const rms = Math.sqrt(sq / (2 * Math.max(1, s1 - s0)));
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) mono[i] = (L[i]! + R[i]!) * 0.5;
  const centroid = centroidOf(mono, loudAt - 1024);
  // tail behaviour
  const tailN = Math.floor(0.5 * SR);
  let tq = 0; for (let i = n - tailN; i < n; i++) tq += mono[i]! * mono[i]!;
  const tailRms = Math.sqrt(tq / tailN);
  let mq = 0; const mid0 = Math.floor(n * 0.3), mid1 = Math.floor(n * 0.6);
  for (let i = mid0; i < mid1; i++) mq += mono[i]! * mono[i]!;
  const midRms = Math.sqrt(mq / Math.max(1, mid1 - mid0));
  // envelope for the picture
  const env = new Float32Array(200);
  for (let i = 0; i < n; i++) { const k = Math.floor((i / n) * 200); const v = Math.abs(mono[i]!); if (v > env[k]!) env[k] = v; }
  const dur = last >= 0 ? (last - Math.max(0, first)) / SR : 0;
  const win2 = (a: number, b: number) => { const i0 = Math.floor(a * SR), i1 = Math.min(n, Math.floor(b * SR)); let q = 0; for (let i = i0; i < i1; i++) q += mono[i]! * mono[i]!; return i1 > i0 ? Math.sqrt(q / (i1 - i0)) : 0; };
  const early = win2(1.5, 4.5), late = win2(6, 10);
  const problems: string[] = [];
  if (nan) problems.push('NaN');
  if (clipped || peak >= 0.999) problems.push('CLIP');
  if (kind === 'silent') { if (peak > 0.0005) problems.push('NOT SILENT'); }
  else if (peak < 0.0005) problems.push('SILENT');
  if (Math.abs(dc) > 0.004) problems.push('DC');
  if (kind === 'sfx' && last >= n - Math.floor(0.05 * SR)) problems.push('RINGS ON');
  if ((kind === 'music' || kind === 'bed') && midRms > 0 && tailRms > midRms * 4) problems.push('RUNAWAY');
  if (kind === 'music' && rms < 0.003) problems.push('TOO QUIET');
  if (kind === 'sfx' && pre > 1.6) problems.push('HOT');
  return { group, name, secs, dur, peak, rms, pre, dc, centroid, clipped, nan, plays, env, problems, ms, early, late };
}

/** step the virtual clock like the realtime timer would (100 ms), calling `each` before every pump */
function drive(core: AudioCore, secs: number, each?: (t: number) => void): void {
  for (let t = 0; t <= secs - 0.3; t += 0.1) {
    core.setVirtualTime(t);
    each?.(t);
    core.pump();
  }
}

function fixture(weather: WeatherKind = 'clear', day = 34.4): GameState {
  const s = makeFixtureState('knight', day);
  s.weather = weather;
  return s;
}

function addJob(s: GameState, kind: Job['kind'], x: number): Job {
  const id = 'jcheck' + Object.keys(s.jobs).length;
  const j: Job = {
    id, kind, role: 'mason', state: 'working', assignee: null, buildingId: null, unit: null, tenantId: null, applicantId: null,
    incidentId: null, outcomeId: null, x, y: 10, workDays: 3, progress: 0.3, cost: 0, priority: 1, createdDay: s.day, byRuler: false,
  };
  s.jobs[id] = j;
  return j;
}

async function apiSmoke(): Promise<string[]> {
  const errs: string[] = [];
  const tryIt = (what: string, fn: () => void) => { try { fn(); } catch (err) { errs.push(what + ': ' + String(err)); } };
  const api = createAudio();
  const s = fixture();
  tryIt('pre-unlock calls', () => { api.sfx('coin'); api.setMood('title'); api.update(s, 0.016); api.handleEvents([{ type: 'rent_day' }], s); api.voice(3, 'Hello.').stop(); });
  tryIt('unlock', () => { api.unlock(); api.unlock(); });
  tryIt('sfx all', () => { for (const id of SFX) api.sfx(id, { volume: 0.5, pan: 0.3, rate: 1.1 }); });
  tryIt('moods', () => { for (const m of MOOD_NAMES) api.setMood(m); });
  tryIt('update', () => { for (let i = 0; i < 20; i++) api.update(s, 0.016); });
  tryIt('events', () => api.handleEvents([{ type: 'rent_day' }, { type: 'promotion', rank: 'baron' }, { type: 'weather', kind: 'storm' }], s));
  tryIt('voice', () => { const v = api.voice(42, 'My lord, the goblins have filed a grievance. In triplicate!'); v.stop(); v.stop(); });
  tryIt('volumes', () => { api.setVolumes({ master: 0.5, music: 0.2, sfx: 1, voice: Number.NaN }); const v = api.volumes(); if (v.voice !== 0.7 || v.master !== 0.5) throw new Error('volumes not kept: ' + JSON.stringify(v)); });
  tryIt('dispose', () => { api.dispose(); api.sfx('coin'); api.unlock(); api.voice(1, 'after').stop(); });
  return errs;
}

// ───────────── decisions (no rendering): moods, holds, echoes, speakers ─────────────

/** a core on a context that is never rendered: for testing what it decides to play, not how it sounds */
function logicCore(name: string): { core: AudioCore; ids: SfxId[] } {
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: SR, sampleRate: SR });
  const core = new AudioCore(ctx, { realtime: false, rand: mulberry(strSeed(name)) });
  const ids: SfxId[] = [];
  const realPlay = core.play.bind(core);
  core.play = (id, opts, at) => { const r = realPlay(id, opts, at); if (r >= 0) ids.push(id); return r; };
  core.setVirtualTime(0);
  return { core, ids };
}

/** a quiet, solvent realm on a given day: no incidents, no debt */
function calmRealm(day: number): GameState {
  const s = fixture('clear', day);
  s.incidents = {}; s.loans = []; s.gold = 500; s.favor = 60; s.ended = null; s.speed = 1;
  return s;
}

/** advance the virtual clock from `from` to `to`, calling update() the way the frame loop would */
function live(core: AudioCore, s: GameState, from: number, to: number): number {
  for (let t = from; t < to - 1e-6; t += 0.1) { core.setVirtualTime(t); core.update(s); }
  return to;
}

function logicChecks(): { name: string; ok: boolean; detail: string }[] {
  const out: { name: string; ok: boolean; detail: string }[] = [];
  const check = (name: string, ok: boolean, detail: string) => out.push({ name, ok, detail });
  const mood = (c: AudioCore) => c.music.current();

  { // the realm picks its own mood at once from silence
    const { core } = logicCore('m-start'); const s = calmRealm(40.2);
    live(core, s, 0, 1.5);
    check('auto mood from silence', mood(core) === 'calm' || mood(core) === 'busy', 'day 40 quiet realm -> ' + mood(core));
  }
  { const { core } = logicCore('m-rent'); const s = calmRealm(30.4); live(core, s, 0, 1.5);
    check('rent day', mood(core) === 'rent_day', '1st of the month -> ' + mood(core)); }
  { const { core } = logicCore('m-debt'); const s = calmRealm(40.2); s.gold = -80; live(core, s, 0, 1.5);
    check('debt is tense', mood(core) === 'tense', 'gold -80 -> ' + mood(core)); }
  { const { core } = logicCore('m-winter'); const s = calmRealm(9 * 30 + 12.5); live(core, s, 0, 1.5);
    check('winter', mood(core) === 'winter', 'Firstfrost 13th -> ' + mood(core)); }
  { const { core } = logicCore('m-end'); const s = calmRealm(40.2); s.ended = { reason: 'bankrupt', day: 40, epitaph: '' }; live(core, s, 0, 1.5);
    check('game over is defeat', mood(core) === 'defeat', 'ended -> ' + mood(core)); }
  { // an audience: court holds while the realm crawls, then lets go once it runs again
    const { core } = logicCore('m-court'); const s = calmRealm(40.2);
    let t = live(core, s, 0, 3);
    core.setVirtualTime(t); core.setMood('court'); s.speed = 0.1;
    t = live(core, s, t, 43);
    const during = mood(core);
    s.speed = 1;
    t = live(core, s, t, 47);
    const shortly = mood(core);
    t = live(core, s, t, 65);
    const after = mood(core);
    check('court holds through an audience', during === 'court' && shortly === 'court' && after !== 'court', `40 s at crawl -> ${during}; 4 s after -> ${shortly}; 22 s after -> ${after}`);
  }
  { // an explicit mood outranks the realm for a few seconds only
    const { core } = logicCore('m-explicit'); const s = calmRealm(40.2);
    let t = live(core, s, 0, 2);
    core.setVirtualTime(t); core.setMood('triumph');
    t = live(core, s, t, 7); const held = mood(core);
    t = live(core, s, t, 30); const after = mood(core);
    check('explicit mood expires', held === 'triumph' && after !== 'triumph', `5 s -> ${held}; 28 s -> ${after}`);
  }
  { // paused: the tune stays put even when the realm would call for another; it follows once time runs
    const { core } = logicCore('m-pause'); const s = calmRealm(40.2);
    let t = live(core, s, 0, 2); const before = mood(core);
    s.speed = 0; s.gold = -80;
    t = live(core, s, t, 25); const paused = mood(core);
    s.speed = 1;
    t = live(core, s, t, 31); const resumed = mood(core);
    check('pause freezes the mood', paused === before && resumed === 'tense', `${before}; paused in debt -> ${paused}; running -> ${resumed}`);
  }
  { // the title tune holds while the realm stands still behind the menu
    const { core } = logicCore('m-title'); const s = calmRealm(40.2);
    core.setMood('title');
    let t = live(core, s, 0, 30); const held = mood(core);
    s.day += 1;
    t = live(core, s, t, 32); const after = mood(core);
    check('title holds until the realm moves', held === 'title' && after !== 'title', `30 s still -> ${held}; day moved -> ${after}`);
  }
  { // the sim names sounds the router already plays: each is heard once
    const { core, ids } = logicCore('echo');
    const s = fixture();
    const b = Object.values(s.buildings)[1]!;
    const j = addJob(s, 'serve_notice', 8);
    const at = (t: number, evs: SimEvent[]) => { core.setVirtualTime(t); core.handleEvents(evs, s); };
    at(0.1, [{ type: 'building_placed', buildingId: b.id }, { type: 'sfx', id: 'place' }]);
    at(3, [{ type: 'sfx', id: 'stamp' }, { type: 'parcel_bought', parcelId: 1 }]);
    at(6, [{ type: 'job', jobId: j.id, phase: 'arrive' }, { type: 'sfx', id: 'knock', buildingId: b.id }]);
    at(9, [{ type: 'oath', oathId: 'o1', state: 'open' }, { type: 'sfx', id: 'quill' }]);
    at(12, [{ type: 'sfx', id: 'saw' }, { type: 'sfx', id: 'saw' }]);
    at(15, [{ type: 'sfx', id: 'coins' }]);
    const n = (id: SfxId) => ids.filter(x => x === id).length;
    const want: [SfxId, number][] = [['place', 1], ['stamp', 2], ['coins', 2], ['knock', 1], ['quill', 1], ['saw', 1]];
    const got = want.map(([id, k]) => `${id} ${n(id)}/${k}`);
    check('sim sfx never doubles a cue', want.every(([id, k]) => n(id) === k), got.join(', '));
  }
  { // five people talk at once: three are heard
    const { core } = logicCore('speakers');
    core.setVirtualTime(0.1);
    for (let i = 0; i < 5; i++) core.voice(100 + i * 37, 'My lord, there is a matter of the fence, and of the goat, and of the fence again.');
    check('speaker limit', core.speakingCount() === 3, core.speakingCount() + ' talking after five lines began');
  }
  return out;
}

/** the live path: a real AudioContext running the core for two seconds, listened to by an analyser */
async function realtimeSmoke(): Promise<string> {
  const ctx = new AudioContext();
  try { await Promise.race([ctx.resume(), new Promise(r => setTimeout(r, 500))]); } catch { /* reported below */ }
  if (ctx.state !== 'running') { await ctx.close(); return 'skipped (context ' + ctx.state + ' without a gesture)'; }
  const core = new AudioCore(ctx, { realtime: true });
  const an = ctx.createAnalyser();
  an.fftSize = 2048;
  core.e.out.connect(an);
  const buf = new Float32Array(an.fftSize);
  let peak = 0, nan = 0;
  const t0 = ctx.currentTime;
  core.setMood('busy');
  const s = fixture();
  addJob(s, 'build', 8);
  const timer = setInterval(() => {
    core.update(s);
    an.getFloatTimeDomainData(buf);
    for (const v of buf) { if (!Number.isFinite(v)) nan++; else peak = Math.max(peak, Math.abs(v)); }
  }, 100);
  core.play('coin'); core.play('bell', { volume: 0.5 });
  setTimeout(() => core.voice(5, 'The roof, my lord. It has opinions about rain.'), 400);
  setTimeout(() => core.handleEvents([{ type: 'rent_day' }], s), 800);
  await new Promise(r => setTimeout(r, 2200));
  clearInterval(timer);
  const ran = ctx.currentTime - t0;
  const active = core.activeCount();
  core.dispose();
  await ctx.close();
  return `clock ran ${ran.toFixed(2)}s, output peak ${db(peak)} dBFS, ${active} sounds ringing at the end, ${nan} NaN samples`;
}

async function main(): Promise<void> {
  const out: Result[] = [];
  const log = (r: Result) => {
    out.push(r);
    console.warn(`[audio] ${r.group.padEnd(6)} ${r.name.padEnd(18)} dur ${r.dur.toFixed(2).padStart(5)}s  peak ${db(r.peak).padStart(6)}  rms ${db(r.rms).padStart(6)}  pre ${db(r.pre).padStart(6)}  dc ${r.dc.toFixed(4)}  cen ${Math.round(r.centroid).toString().padStart(5)}Hz  plays ${r.plays}${r.group === 'music' ? `  early ${db(r.early)} late ${db(r.late)}` : ''}  ${r.ms.toFixed(0)}ms  ${r.problems.length ? 'PROBLEM: ' + r.problems.join(',') : 'ok'}`);
  };
  const longOnes: SfxId[] = ['bell', 'thunder', 'chime'];

  // every sound effect, alone, at full volume
  for (const id of SFX) {
    log(await render('sfx', id, longOnes.includes(id) ? 7.5 : 4.5, 'sfx', core => { core.setVirtualTime(0.05); core.play(id, { volume: 1 }); }));
  }
  // every mood for ten seconds
  for (const m of MOOD_NAMES) {
    log(await render('music', m, 10, m === 'off' ? 'silent' : 'music', core => { core.setMood(m); drive(core, 10); }));
  }
  // a crossfade
  log(await render('music', 'calm>rent_day', 12, 'music', core => {
    core.setMood('calm');
    drive(core, 12, t => { if (Math.abs(t - 5) < 0.05) core.setMood('rent_day'); });
  }));
  // voices
  const lines: [number, string][] = [
    [7, 'The committee has met. The committee has concerns. Fourteen of them, in triplicate!'],
    [1234, 'My husband built that chimney, my lord, and it has never once leaned until this winter.'],
    [99, 'Is it true you mean to raise the rent?'],
  ];
  for (const [seed, text] of lines) log(await render('voice', 'seed ' + seed, 7, 'sfx', core => { core.setVirtualTime(0.05); core.voice(seed, text); }));
  // weather beds
  for (const w of ['rain', 'storm', 'snow', 'hail'] as WeatherKind[]) {
    log(await render('bed', w, 9, 'bed', core => { core.amb.setWeather(w, w === 'snow' ? 'winter' : 'autumn', 0); drive(core, 9); }));
  }
  // scenes through the event router
  log(await render('scene', 'rent shower x20', 6, 'scene', core => {
    const s = fixture();
    const b = Object.values(s.buildings)[1]!;
    const evs: SimEvent[] = Array.from({ length: 20 }, () => ({ type: 'rent_paid', tenantId: 't', buildingId: b.id, amount: 6 }));
    drive(core, 6, t => { if (Math.abs(t - 0.2) < 0.05) core.handleEvents(evs, s); });
  }));
  log(await render('scene', 'single rent', 3, 'sfx', core => {
    const s = fixture();
    const b = Object.values(s.buildings)[1]!;
    drive(core, 3, t => { if (Math.abs(t - 0.1) < 0.05) core.handleEvents([{ type: 'purse_collected', buildingId: b.id, unit: 0, amount: 6, byActor: null }], s); });
  }));
  log(await render('scene', 'rent day', 9, 'scene', core => {
    const s = fixture('clear', 30.2);
    drive(core, 9, t => {
      if (Math.abs(t - 0.1) < 0.05) core.handleEvents([{ type: 'rent_day' }, { type: 'herald', herald: { id: 'h', day: 30, kind: 'good', text: 'Rent Day.' } }], s);
      core.update(s);
    });
  }));
  log(await render('scene', 'promotion', 9, 'scene', core => {
    const s = fixture();
    drive(core, 9, t => {
      if (Math.abs(t - 0.1) < 0.05) core.handleEvents([{ type: 'promotion', rank: 'baron' }, { type: 'herald', herald: { id: 'h', day: 34, kind: 'crown', text: 'By grace of the Crown.' } }], s);
      core.update(s);
    });
  }));
  log(await render('scene', 'work sites', 9, 'scene', core => {
    const s = fixture();
    addJob(s, 'build', 6); addJob(s, 'repair', 22); addJob(s, 'clear_land', 14);
    drive(core, 9, () => core.update(s));
  }));
  log(await render('scene', 'griffin lands', 4, 'scene', core => {
    const s = fixture();
    const b = Object.values(s.buildings).find(x => !x.visuals.includes('griffin_roof') && x.type !== 'seat')!;
    drive(core, 4, t => {
      core.update(s);
      if (Math.abs(t - 0.5) < 0.05) { b.visuals = [...b.visuals, 'griffin_roof']; core.handleEvents([{ type: 'building_changed', buildingId: b.id }], s); }
    });
  }));
  log(await render('scene', 'everything at once', 8, 'scene', core => {
    core.setMood('busy');
    drive(core, 8, t => { if (Math.abs(t - 1) < 0.05) for (const id of SFX) core.play(id, { volume: 1 }); });
  }));

  const logic = logicChecks();
  for (const l of logic) console.warn(`[audio] logic  ${l.name.padEnd(34)} ${l.ok ? 'ok  ' : 'FAIL'}  ${l.detail}`);
  const logicBad = logic.filter(l => !l.ok).map(l => l.name);

  console.warn('[audio] realtime: ' + await realtimeSmoke());
  const apiErrs = await apiSmoke();
  console.warn('[audio] api smoke: ' + (apiErrs.length ? 'ERRORS ' + apiErrs.join(' | ') : 'ok (every call safe before unlock, after unlock and after dispose)'));

  const bad = out.filter(r => r.problems.length);
  const totalMs = out.reduce((s, r) => s + r.ms, 0);
  console.warn(`[audio] SUMMARY ${out.length} renders, ${bad.length} with problems${bad.length ? ': ' + bad.map(r => r.name + ' (' + r.problems.join(',') + ')').join('; ') : ''}. ${logic.length - logicBad.length}/${logic.length} logic checks pass${logicBad.length ? ' (failed: ' + logicBad.join('; ') + ')' : ''}. render time ${(totalMs / 1000).toFixed(1)}s`);
  draw(out, apiErrs, logic);
  (window as unknown as { __audioResult: unknown }).__audioResult = { renders: out.length, problems: bad.map(r => r.name + ':' + r.problems.join(',')), logicFailed: logicBad, api: apiErrs };
}

function draw(rows: Result[], apiErrs: string[], logic: { name: string; ok: boolean; detail: string }[]): void {
  const app = document.getElementById('app')!;
  app.innerHTML = '';
  app.style.cssText = 'position:static;padding:10px 14px;font:11px/1.25 ui-monospace,Menlo,monospace;color:#e8dcc0;background:#14100c;overflow:auto';
  document.body.style.overflow = 'auto';
  const h = document.createElement('div');
  h.style.cssText = 'font-size:14px;margin-bottom:6px;color:#f0c674';
  const bad = rows.filter(r => r.problems.length).length;
  const lbad = logic.filter(l => !l.ok).length;
  h.textContent = `LandLord audio check: ${rows.length} renders, ${bad} with problems. Logic: ${logic.length - lbad}/${logic.length}. API smoke: ${apiErrs.length ? apiErrs.length + ' errors' : 'ok'}. Levels at default volumes (dBFS).`;
  app.appendChild(h);
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;column-gap:18px';
  app.appendChild(grid);
  for (const r of rows) {
    const row = document.createElement('div');
    row.style.cssText = `display:flex;align-items:center;gap:6px;height:19px;border-bottom:1px solid #2a2219;color:${r.problems.length ? '#ff8a7a' : '#e8dcc0'}`;
    const label = document.createElement('span');
    label.style.cssText = 'width:300px;white-space:pre;overflow:hidden';
    label.textContent = `${r.group.padEnd(5)} ${r.name.padEnd(17).slice(0, 17)} ${r.dur.toFixed(2).padStart(5)}s ${db(r.peak).padStart(6)} ${db(r.rms).padStart(6)} ${String(Math.round(r.centroid)).padStart(5)}`;
    const c = document.createElement('canvas');
    c.width = 200; c.height = 16;
    const g = c.getContext('2d')!;
    g.fillStyle = '#1d1712'; g.fillRect(0, 0, 200, 16);
    g.fillStyle = r.problems.length ? '#ff8a7a' : '#c9a35a';
    for (let i = 0; i < 200; i++) { const v = Math.min(1, r.env[i]! / 0.7); const hh = Math.max(0.5, v * 15); g.fillRect(i, 8 - hh / 2, 1, hh); }
    const p = document.createElement('span');
    p.textContent = r.problems.join(',') || 'ok';
    row.append(label, c, p);
    grid.appendChild(row);
  }
  const lg = document.createElement('div');
  lg.style.cssText = 'margin-top:8px;display:grid;grid-template-columns:1fr 1fr;column-gap:18px';
  for (const l of logic) {
    const row = document.createElement('div');
    row.style.cssText = `white-space:pre;height:17px;overflow:hidden;color:${l.ok ? '#e8dcc0' : '#ff8a7a'}`;
    row.textContent = `logic ${l.name.padEnd(32)} ${l.ok ? 'ok  ' : 'FAIL'} ${l.detail}`;
    lg.appendChild(row);
  }
  app.appendChild(lg);
}

(window as unknown as { __audioCheck: Promise<unknown> }).__audioCheck = main()
  .then(() => (window as unknown as { __audioResult: unknown }).__audioResult)
  .catch(err => { console.warn('[audio] CHECK FAILED: ' + String(err && (err as Error).stack || err)); return { error: String(err) }; });
