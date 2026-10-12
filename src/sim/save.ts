/** OWNER: sim-rule agent. Serialise / restore GameState (JSON string, versioned, tolerant of older saves). */
import type { GameState } from './types';
import { notImplemented } from './core';
export function serialize(s: GameState): string { return notImplemented('sim-rule', 'serialize'); }
/** Throws on unreadable input. Fills any missing fields with defaults; always returns _events: []. */
export function deserialize(json: string): GameState { return notImplemented('sim-rule', 'deserialize'); }
