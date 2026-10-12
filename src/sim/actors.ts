/** OWNER: sim-world agent. Gameplay figures: the ruler, staff, applicants, petitioners.
 *  Bodies below are thin PLACEHOLDERS so other modules can run; replace them. Keep the signatures. */
import type { GameState, SimModule, Actor, ActorKind, Id } from './types';
import { newId, emit } from './core';

export function spawnActor(s: GameState, spec: { kind: ActorKind; refId: Id | null; x: number; y: number; speed?: number }): Actor {
  const a: Actor = { id: newId(s, 'a'), kind: spec.kind, refId: spec.refId, x: spec.x, y: spec.y, path: [], speed: spec.speed ?? 6, state: 'idle', jobId: null, homeX: spec.x, homeY: spec.y, facing: 0 };
  s.actors[a.id] = a; emit(s, { type: 'actor_spawn', actorId: a.id }); return a;
}
export function removeActor(s: GameState, actorId: Id): void { if (s.actors[actorId]) { delete s.actors[actorId]; emit(s, { type: 'actor_gone', actorId }); } }
/** Path the actor to (x, y). False if unreachable. */
export function walkTo(s: GameState, actorId: Id, x: number, y: number): boolean { const a = s.actors[actorId]; if (!a) return false; a.path = [[x, y]]; a.state = 'walking'; return true; }
/** The ruler's own figure (always exists after init; idles at the seat's door). */
export function rulerActor(s: GameState): Actor { return Object.values(s.actors).find(a => a.kind === 'ruler')!; }
/** A point at the map edge where newcomers appear and the departed leave (where the road comes in). */
export function gatePoint(_s: GameState): [number, number] { return [0.5, 12.5]; }
/** The actor embodying this staff / applicant / tenant / npc id, if on the table. */
export function actorFor(s: GameState, refId: Id): Actor | null { return Object.values(s.actors).find(a => a.refId === refId) ?? null; }

export const actorsModule: SimModule = { name: 'actors' };
