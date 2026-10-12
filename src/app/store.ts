/**
 * Everything the app keeps between visits: saves (one slot per mode), the
 * settings, and the Dynasty Hall. All of it lives in localStorage and every
 * touch is wrapped: a browser with storage switched off still plays, it just
 * forgets.
 */
import type { Mode, GameState } from '../sim/types';
import type { DynastyEntry, Settings } from '../ui/api';
import { reignRecord } from '../sim/modes';

const K = {
  save: (mode: Mode) => `ll.save.${mode}`,
  meta: (mode: Mode) => `ll.save.${mode}.meta`,
  last: 'll.save.last',
  settings: 'll.settings',
  courtKey: 'll.courtKey',
  dynasty: 'll.dynasty',
} as const;

export const DYNASTY_CAP = 50;
const MODES: Mode[] = ['peace', 'iron'];

export interface SaveMeta { realm: string; ruler: string; rank: string; mode: Mode; day: number; at: number }

function ls(): Storage | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
function read(key: string): string | null {
  try { return ls()?.getItem(key) ?? null; } catch { return null; }
}
function write(key: string, value: string): boolean {
  try { const s = ls(); if (!s) return false; s.setItem(key, value); return true; } catch { return false; }
}
function drop(key: string): void {
  try { ls()?.removeItem(key); } catch { /* nothing to forget */ }
}
function readJson<T>(key: string): T | null {
  const raw = read(key);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

// ───────────────────────────── saves ─────────────────────────────

/** Write the reign to its mode's slot. `json` is `Sim.save()`. Returns false when storage refused. */
export function writeSave(state: GameState, json: string): boolean {
  const meta: SaveMeta = {
    realm: state.realm.name, ruler: state.realm.ruler, rank: state.realm.rank, mode: state.mode,
    day: Math.floor(state.day), at: Date.now(),
  };
  if (!write(K.save(state.mode), json)) return false;
  write(K.meta(state.mode), JSON.stringify(meta));
  write(K.last, state.mode);
  return true;
}

function metaOf(mode: Mode): SaveMeta | null {
  if (!read(K.save(mode))) return null;
  const m = readJson<Partial<SaveMeta>>(K.meta(mode));
  return {
    realm: typeof m?.realm === 'string' ? m.realm : 'the realm',
    ruler: typeof m?.ruler === 'string' ? m.ruler : 'You',
    rank: typeof m?.rank === 'string' ? m.rank : 'reeve',
    mode,
    day: typeof m?.day === 'number' ? m.day : 0,
    at: typeof m?.at === 'number' ? m.at : 0,
  };
}

/** The slot Continue would resume: the one last written, else whichever exists. */
export function latestSave(): SaveMeta | null {
  const last = read(K.last);
  const first = last === 'peace' || last === 'iron' ? metaOf(last) : null;
  if (first) return first;
  const all = MODES.map(metaOf).filter((m): m is SaveMeta => !!m).sort((a, b) => b.at - a.at);
  return all[0] ?? null;
}

export function readSave(mode: Mode): string | null { return read(K.save(mode)); }

export function deleteSave(mode: Mode): void {
  drop(K.save(mode));
  drop(K.meta(mode));
  if (read(K.last) === mode) drop(K.last);
}

// ───────────────────────────── settings ─────────────────────────────

function defaultQuality(): Settings['quality'] {
  try {
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    if (cores <= 2) return 'low';
    return coarse || cores <= 4 ? 'medium' : 'high';
  } catch { return 'medium'; }
}

export function defaultSettings(): Settings {
  return { quality: defaultQuality(), master: 0.8, music: 0.5, sfx: 0.8, voice: 0.7, wit: 'quick', courtKey: '', hints: true };
}

const unit = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d);

/** Whatever was stored, made safe: unknown values fall back to the defaults. */
export function cleanSettings(raw: Partial<Settings> | null | undefined, base: Settings = defaultSettings()): Settings {
  const r = raw ?? {};
  return {
    quality: r.quality === 'low' || r.quality === 'medium' || r.quality === 'high' ? r.quality : base.quality,
    master: unit(r.master, base.master),
    music: unit(r.music, base.music),
    sfx: unit(r.sfx, base.sfx),
    voice: unit(r.voice, base.voice),
    wit: r.wit === 'quick' || r.wit === 'default' ? r.wit : base.wit,
    courtKey: typeof r.courtKey === 'string' ? r.courtKey.slice(0, 200) : base.courtKey,
    hints: typeof r.hints === 'boolean' ? r.hints : base.hints,
  };
}

export function loadSettings(): Settings {
  const s = cleanSettings(readJson<Partial<Settings>>(K.settings));
  // the court key has its own drawer, which the word layer reads directly
  s.courtKey = (read(K.courtKey) ?? '').slice(0, 200);
  return s;
}

export function storeSettings(s: Settings): void {
  const { courtKey, ...rest } = s;
  write(K.settings, JSON.stringify(rest));
  if (courtKey) write(K.courtKey, courtKey); else drop(K.courtKey);
}

// ───────────────────────────── the Dynasty Hall ─────────────────────────────

function cleanEntry(e: Partial<DynastyEntry> | null): DynastyEntry | null {
  if (!e || typeof e !== 'object' || typeof e.ruler !== 'string' || typeof e.realm !== 'string') return null;
  const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    ruler: e.ruler, realm: e.realm,
    rank: typeof e.rank === 'string' ? e.rank : 'reeve',
    mode: e.mode === 'iron' ? 'iron' : 'peace',
    years: n(e.years), households: n(e.households), peakRentRoll: n(e.peakRentRoll),
    epitaph: typeof e.epitaph === 'string' ? e.epitaph : '',
    endedAt: typeof e.endedAt === 'string' ? e.endedAt : '',
    heirloom: typeof e.heirloom === 'string' && e.heirloom ? e.heirloom : null,
  };
}

/** Newest first. */
export function loadDynasty(): DynastyEntry[] {
  const raw = readJson<unknown>(K.dynasty);
  if (!Array.isArray(raw)) return [];
  return raw.map(e => cleanEntry(e as Partial<DynastyEntry>)).filter((e): e is DynastyEntry => !!e).slice(0, DYNASTY_CAP);
}

/**
 * Write a finished reign into the hall (newest first, capped). Only an Iron
 * Crown reign passes an heirloom on; a reign under Steward's Peace is
 * remembered without one.
 */
export function recordReign(state: GameState, now: Date = new Date()): DynastyEntry {
  const r = reignRecord(state);
  const entry: DynastyEntry = {
    ruler: r.ruler, realm: r.realm, rank: r.rank, mode: r.mode, years: r.years, households: r.households,
    peakRentRoll: r.peakRentRoll, epitaph: r.epitaph, endedAt: now.toISOString(),
    heirloom: r.mode === 'iron' ? r.heirloom : null,
  };
  const list = [entry, ...loadDynasty()].slice(0, DYNASTY_CAP);
  write(K.dynasty, JSON.stringify(list));
  return entry;
}

/** What the next Iron Crown reign inherits: the last Iron heirloom and which reign this will be. */
export function inheritance(): { heirloom: string | null; reign: number } {
  const iron = loadDynasty().filter(e => e.mode === 'iron');
  return { heirloom: iron.find(e => e.heirloom)?.heirloom ?? null, reign: iron.length + 1 };
}
