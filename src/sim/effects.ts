/** OWNER: sim-rule agent. Interprets data-driven Effect lists by calling the owning modules. */
import type { GameState, Id } from './types';
import type { Effect } from '../data/schema';
import { notImplemented } from './core';
export interface EffectCtx { buildingId?: Id | null; unit?: number | null; tenantId?: Id | null; applicantId?: Id | null; incidentId?: Id | null; vars?: Record<string, string | number> }
export function applyEffects(s: GameState, effects: Effect[], ctx: EffectCtx): void { notImplemented('sim-rule', 'applyEffects'); }
