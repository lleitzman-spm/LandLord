/** OWNER: sim-decide agent. Interprets data-driven Effect lists by calling the owning modules. PLACEHOLDER body. */
import type { GameState, Id } from './types';
import type { Effect } from '../data/schema';
export interface EffectCtx { buildingId?: Id | null; unit?: number | null; tenantId?: Id | null; applicantId?: Id | null; incidentId?: Id | null; vars?: Record<string, string | number> }
export function applyEffects(_s: GameState, _effects: Effect[], _ctx: EffectCtx): void {}
