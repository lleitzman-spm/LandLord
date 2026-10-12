/**
 * The game's audio: everything synthesised with WebAudio, no files.
 * Silent and inert until unlock() is called from a user gesture; a no-op
 * wherever WebAudio is unavailable.
 */
import type { AudioAPI, MusicMood } from './api';
import { AudioCore } from './core';
import { clamp } from './engine';

type Vols = { master: number; music: number; sfx: number; voice: number };

export function createAudio(): AudioAPI {
  const vol: Vols = { master: 0.8, music: 0.5, sfx: 0.8, voice: 0.7 };
  let ctx: AudioContext | null = null;
  let core: AudioCore | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let mood: MusicMood | null = null;
  let disposed = false;
  let unavailable = false;

  const guard = <T>(fn: () => T, fallback: T): T => {
    if (!core) return fallback;
    try { return fn(); } catch (err) { console.warn('[audio] ' + String(err)); return fallback; }
  };

  return {
    unlock() {
      if (disposed || unavailable) return;
      if (!core) {
        const g = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
        const AC = g.AudioContext ?? g.webkitAudioContext;
        if (!AC) { unavailable = true; return; }
        try {
          ctx = new AC({ latencyHint: 'interactive' });
          core = new AudioCore(ctx, { realtime: true });
        } catch (err) {
          console.warn('[audio] unavailable: ' + String(err));
          unavailable = true; ctx = null; core = null;
          return;
        }
        core.setVolumes(vol);
        if (mood) core.setMood(mood);
        timer = setInterval(() => guard(() => core!.pump(), undefined), 100);
        // a silent sample started inside the gesture fully wakes output on some browsers
        try {
          const b = ctx.createBuffer(1, 1, ctx.sampleRate);
          const s = ctx.createBufferSource();
          s.buffer = b; s.connect(ctx.destination); s.start(0);
        } catch { /* not needed everywhere */ }
      }
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => { /* the next gesture will try again */ });
    },
    sfx(id, opts) { guard(() => core!.play(id, opts), -1); },
    handleEvents(events, state) { guard(() => core!.handleEvents(events, state), undefined); },
    update(state) { guard(() => core!.update(state), undefined); },
    setMood(m) {
      mood = m;
      guard(() => core!.setMood(m), undefined);
    },
    voice(seed, text, opts) {
      return guard(() => core!.voice(seed, text, opts), { stop() { /* silent */ } });
    },
    setVolumes(v) {
      for (const k of ['master', 'music', 'sfx', 'voice'] as const) {
        const x = v[k];
        if (typeof x === 'number' && Number.isFinite(x)) vol[k] = clamp(x, 0, 1);
      }
      guard(() => core!.setVolumes(vol), undefined);
    },
    volumes() { return { ...vol }; },
    dispose() {
      disposed = true;
      if (timer) clearInterval(timer);
      timer = null;
      guard(() => core!.dispose(), undefined);
      core = null;
      if (ctx) ctx.close().catch(() => { /* already closed */ });
      ctx = null;
    },
  };
}

export { AudioCore } from './core';
export type * from './api';
