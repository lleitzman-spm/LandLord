/**
 * LandLord: the app shell. Boots audio, the word layer, the renderer and the
 * interface; owns the one frame loop; keeps the saves, the settings and the
 * Dynasty Hall (src/app/store.ts). Nothing here changes GameState except
 * through `Sim.dispatch`.
 *
 * Two kinds of sim pass through here:
 *   the title diorama  a real reign from a fixed seed, run forward a few
 *                      months and left ticking behind the title page;
 *   the reign          what the player started or resumed (`inGame()`).
 */
import { Sim } from './sim/index';
import type { GameState, SimEvent, Mode } from './sim/types';
import { canPlace } from './sim/world';
import { lastDemotion } from './sim/modes';
import { createRenderer } from './render/index';
import type { Renderer } from './render/api';
import { createUI } from './ui/index';
import type { AppAPI, DynastyEntry, Settings, UI } from './ui/api';
import { createWord } from './word/index';
import type { WordAPI } from './word/api';
import { createAudio } from './audio/index';
import type { AudioAPI } from './audio/api';
import {
  writeSave, readSave, deleteSave, latestSave, loadSettings, storeSettings, cleanSettings,
  loadDynasty, recordReign, inheritance,
} from './app/store';
import { showError, hideVeil } from './app/overlay';
import { hotHandover, hotRegister } from './app/hot';

const TITLE_SEED = 1066;
const TITLE_DAYS = 100;
const AUTOSAVE_DAYS = 30;
const MAX_DT = 0.1;

function boot(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('canvas#c');
  const root = document.querySelector<HTMLElement>('#ui');
  if (!canvas || !root) throw new Error('The page is missing canvas#c or #ui.');

  let settings: Settings = loadSettings();
  let inGame = false;
  let lastSavedDay = 0;
  /** reigns already written into the Dynasty Hall (never twice) */
  const recorded = new WeakSet<GameState>();

  // ── the title diorama ──
  const makeDiorama = (): Sim => {
    const d = Sim.create({ seed: TITLE_SEED, mode: 'peace', ruler: 'Aldous', realm: 'Mudlark Hollow' });
    d.advanceDays(TITLE_DAYS);
    d.setSpeed(1);
    return d;
  };
  let sim: Sim = makeDiorama();

  // ── audio and the word layer: the game plays without either ──
  const audio: AudioAPI = attempt('audio', () => createAudio(), inert<AudioAPI>());
  const word: WordAPI = attempt('word', () => createWord({
    getState: () => sim.state,
    dispatch: a => sim.dispatch(a),
  }), inert<WordAPI>());
  quiet(() => audio.setVolumes({ master: settings.master, music: settings.music, sfx: settings.sfx, voice: settings.voice }));
  quiet(() => word.setWit(settings.wit));

  // ── the table and the manuscript: without these there is no game ──
  const renderer: Renderer = createRenderer({
    canvas,
    canPlace: (btype, x, y, rot) => { try { return canPlace(sim.state, btype, x, y, rot).ok; } catch { return false; } },
    quality: settings.quality,
  });
  renderer.reset(sim.state);
  renderer.setMode('title');

  // ── saves ──
  const saveNow = (): void => {
    if (!inGame || sim.state.ended) return;
    try {
      if (writeSave(sim.state, sim.save())) lastSavedDay = sim.state.day;
    } catch (err) { console.warn('[app] the save did not take', err); }
  };

  /** The reign is over: into the hall with it, and the slot is cleared. */
  const closeReign = (): void => {
    const s = sim.state;
    if (recorded.has(s)) return;
    recorded.add(s);
    try { recordReign(s); } catch (err) { console.warn('[app] the Dynasty Hall would not take the entry', err); }
    deleteSave(s.mode);
  };

  const enter = (next: Sim, playing: boolean): void => {
    sim = next;
    inGame = playing;
    lastSavedDay = next.state.day;
    renderer.reset(next.state);
    renderer.setTool({ kind: 'select' });
    renderer.setSelection(null);
    renderer.setHighlight(null);
    renderer.setMode(playing ? 'play' : 'title');
    ui.rebind(next);
    if (playing) quiet(() => ui.close());
    else quiet(() => audio.setMood('title'));
  };

  /** The heir's boon is paid by the engine at init (`heirloomBoon` in src/sim/modes.ts). Nothing is added here. */
  const applyBoon = (_heirloom: string | null): void => {};

  const app: AppAPI = {
    newGame(opts) {
      saveNow();
      const mode: Mode = opts.mode === 'iron' ? 'iron' : 'peace';
      const heir = mode === 'iron' ? inheritance() : { heirloom: null, reign: 1 };
      const next = Sim.create({
        seed: opts.seed, mode,
        ruler: (opts.ruler || '').trim().slice(0, 40) || 'You',
        realm: (opts.realm || '').trim().slice(0, 48),
        heirloom: heir.heirloom, reign: heir.reign,
      });
      enter(next, true);
      applyBoon(heir.heirloom);
      saveNow();
    },
    hasSave: () => latestSave() !== null,
    saveInfo() {
      const m = latestSave();
      return m ? { realm: m.realm, ruler: m.ruler, rank: m.rank, mode: m.mode } : null;
    },
    continueGame() {
      const m = latestSave();
      if (!m) return false;
      const json = readSave(m.mode);
      if (!json) return false;
      try {
        const next = Sim.load(json);
        if (next.state.ended) { deleteSave(m.mode); return false; }
        enter(next, true);
        return true;
      } catch (err) {
        console.warn('[app] that save could not be read', err);
        return false;
      }
    },
    saveNow,
    toTitle() {
      saveNow();
      if (inGame && sim.state.ended) closeReign();
      enter(makeDiorama(), false);
      quiet(() => ui.close());
      quiet(() => ui.open('title'));
    },
    dynasty: (): DynastyEntry[] => loadDynasty(),
    settings: () => ({ ...settings }),
    setSettings(patch) {
      const before = settings;
      settings = cleanSettings({ ...settings, ...patch }, settings);
      storeSettings(settings);
      if (settings.quality !== before.quality) quiet(() => renderer.setQuality(settings.quality));
      quiet(() => audio.setVolumes({ master: settings.master, music: settings.music, sfx: settings.sfx, voice: settings.voice }));
      if (settings.wit !== before.wit) quiet(() => word.setWit(settings.wit));
    },
    inGame: () => inGame,
  };

  const ui: UI = createUI({ root, sim, renderer, word, audio, app });

  // ── what the shell itself does about events ──
  const onEvents = (events: SimEvent[]): void => {
    if (!inGame) return;
    for (const ev of events) {
      if (ev.type === 'game_over') {
        closeReign();
        ui.open('gameover', sim.state.ended ?? ev);
      } else if (ev.type === 'demotion') {
        saveNow();
        ui.open('gameover', { demotion: true, rank: ev.rank, epitaph: lastDemotion(sim.state)?.epitaph ?? '' });
      } else if (ev.type === 'promotion') {
        saveNow();
      }
    }
    if (sim.state.day - lastSavedDay >= AUTOSAVE_DAYS) saveNow();
  };

  // ── the frame loop ──
  let last = performance.now();
  let lit = false;
  let strikes = 0;
  let stopped = false;

  const frame = (now: number): void => {
    if (stopped) return;
    requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    const dt = Math.min(MAX_DT, Math.max(0, (now - last) / 1000));
    last = now;
    try {
      const state = sim.state;
      const events = sim.step(dt);
      if (events.length) renderer.handleEvents(events, state);
      renderer.sync(state);
      renderer.frame(dt);
      if (inGame) {
        if (events.length) {
          // the hall is written before any screen can go looking for the heirloom
          if (events.some(ev => ev.type === 'game_over')) closeReign();
          ui.handleEvents(events, state);
          audio.handleEvents(events, state);
        }
      } else {
        audio.setMood('title');
      }
      ui.update(sim.state, dt);
      audio.update(sim.state, dt);
      if (events.length) onEvents(events);
      strikes = 0;
      if (!lit) { lit = true; hideVeil(); }
    } catch (err) {
      console.error('[app] a frame went wrong', err);
      if (++strikes >= 3) {
        stopped = true;
        if (inGame) saveNow();
        showError(err, 'frame');
      }
    }
  };

  // ── the page around it ──
  window.addEventListener('resize', () => quiet(() => renderer.resize()));
  window.addEventListener('orientationchange', () => quiet(() => renderer.resize()));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveNow();
    else last = performance.now();
  });
  window.addEventListener('pagehide', saveNow);

  const unlock = (): void => { quiet(() => audio.unlock()); };
  for (const type of ['pointerdown', 'keydown', 'touchend'] as const) {
    window.addEventListener(type, unlock, { capture: true, passive: true });
  }

  // ── hot updates (see src/app/hot.ts) ──
  const handed = hotHandover();
  if (handed) {
    try {
      const next = Sim.load(handed);
      if (!next.state.ended) enter(next, true);
    } catch (err) { console.warn('[app] the handed-over reign could not be read', err); }
  }
  hotRegister(() => { saveNow(); return inGame && !sim.state.ended ? sim.save() : null; });

  // debugging and automated play
  (window as unknown as { __ll: unknown }).__ll = {
    get sim() { return sim; },
    renderer, ui, app, word, audio,
  };

  if (!inGame) quiet(() => audio.setMood('title'));
  requestAnimationFrame(frame);
}

/** Run a factory; if it throws, say so loudly and carry on with the stand-in. */
function attempt<T>(label: string, make: () => T, fallback: T): T {
  try { return make(); }
  catch (err) { console.warn(`[app] ${label} is unavailable; playing without it`, err); return fallback; }
}

function quiet(fn: () => void): void {
  try { fn(); } catch (err) { console.warn('[app]', err); }
}

/** A stand-in that accepts any call and does nothing (a module that failed to start). */
function inert<T extends object>(): T {
  const noop = (): undefined => undefined;
  return new Proxy({}, { get: (_t, key) => (key === 'then' ? undefined : key === 'ready' ? Promise.resolve() : noop) }) as T;
}

window.addEventListener('error', ev => { if (!document.getElementById('ll-error')) console.error('[app] uncaught', ev.error ?? ev.message); });

try {
  boot();
} catch (err) {
  console.error('[app] boot failed', err);
  showError(err, 'boot');
}
