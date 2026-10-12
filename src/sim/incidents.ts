/** OWNER: sim-decide agent. The incident engine: scheduling, spawning, timers, resolution. Data-driven.
 *  Bodies below are thin PLACEHOLDERS so other modules can run; replace them. Keep the signatures. */
import type { GameState, SimModule, Incident, Id, DecisionType, ResolvedBy, ActionResult } from './types';
import type { IncidentDef } from '../data/schema';
import { INCIDENT_BY_ID } from '../data/incidents/index';

export interface IncidentTarget { buildingId?: Id; unit?: number; tenantId?: Id; applicantId?: Id }

export function defOf(inc: Incident): IncidentDef { return INCIDENT_BY_ID[inc.defId]!; }
/** Spawn a specific incident on a target (requirements are NOT re-checked). Null if the def is unknown or the target is invalid. */
export function spawnIncident(_s: GameState, _defId: string, _target: IncidentTarget, _vars?: Record<string, string | number>): Incident | null { return null; }
/** Spawn a system decision: picks among defs with system:true and this decision type whose `requires` fit the target.
 *  If a standing order / delegate settles it at once (orders.decide), it resolves immediately. */
export function spawnDecision(_s: GameState, _decision: DecisionType, _target: IncidentTarget, _vars?: Record<string, string | number>): Incident | null { return null; }
/** Choose an outcome. Starts its job if it has one (effects land when the job is done), else applies effects now. */
export function resolveIncident(_s: GameState, _incidentId: Id, _outcomeId: string, _by: ResolvedBy): ActionResult { return { ok: false, code: 'invalid', reason: 'Not yet.' }; }
export function openIncidents(s: GameState): Incident[] { return Object.values(s.incidents).filter(i => i.state === 'open' || i.state === 'in_progress'); }
export function incidentsAt(s: GameState, buildingId: Id): Incident[] { return openIncidents(s).filter(i => i.buildingId === buildingId); }

export const incidentsModule: SimModule = { name: 'incidents' };
