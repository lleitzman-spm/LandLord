/** OWNER: sim-crown agent. Serialise / restore GameState (JSON string, versioned, tolerant of older saves). PLACEHOLDER. */
import type { GameState } from './types';
export function serialize(s: GameState): string { return JSON.stringify({ ...s, _events: [] }); }
/** Throws on unreadable input. Fills any missing fields with defaults; always returns _events: []. */
export function deserialize(json: string): GameState { const s = JSON.parse(json) as GameState; s._events = []; return s; }
