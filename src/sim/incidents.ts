/** OWNER: sim-rule agent. The incident engine: scheduling, spawning, timers, resolution. Data-driven. */
import type { GameState, SimModule, Incident, Id, DecisionType, ResolvedBy, ActionResult } from './types';
import type { IncidentDef } from '../data/schema';
import { notImplemented } from './core';
const W = 'sim-rule';

export interface IncidentTarget { buildingId?: Id; unit?: number; tenantId?: Id; applicantId?: Id }

export function defOf(inc: Incident): IncidentDef { return notImplemented(W, 'defOf'); }
/** Spawn a specific incident on a target (requirements are NOT re-checked). Null if the def is unknown or target invalid. */
export function spawnIncident(s: GameState, defId: string, target: IncidentTarget, vars?: Record<string, string | number>): Incident | null { return notImplemented(W, 'spawnIncident'); }
/** Spawn a system decision: picks among defs with system:true and this decision type whose `requires` fit the target.
 *  If a standing order / delegate settles it at once (orders.decide), it resolves immediately and quietly. */
export function spawnDecision(s: GameState, decision: DecisionType, target: IncidentTarget, vars?: Record<string, string | number>): Incident | null { return notImplemented(W, 'spawnDecision'); }
/** Choose an outcome. Starts its job if it has one (effects land when the job is done), else applies effects now. */
export function resolveIncident(s: GameState, incidentId: Id, outcomeId: string, by: ResolvedBy): ActionResult { return notImplemented(W, 'resolveIncident'); }
export function openIncidents(s: GameState): Incident[] { return notImplemented(W, 'openIncidents'); }
export function incidentsAt(s: GameState, buildingId: Id): Incident[] { return notImplemented(W, 'incidentsAt'); }

export const incidentsModule: SimModule = { name: 'incidents' };
