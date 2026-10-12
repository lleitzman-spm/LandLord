/** OWNER: sim-world agent. Gameplay figures: the ruler, staff, applicants, petitioners. */
import type { GameState, SimModule, Actor, ActorKind, Id } from './types';
import { notImplemented } from './core';
const W = 'sim-world';

export function spawnActor(s: GameState, spec: { kind: ActorKind; refId: Id | null; x: number; y: number; speed?: number }): Actor { return notImplemented(W, 'spawnActor'); }
export function removeActor(s: GameState, actorId: Id): void { notImplemented(W, 'removeActor'); }
/** Path the actor to (x, y). False if unreachable. */
export function walkTo(s: GameState, actorId: Id, x: number, y: number): boolean { return notImplemented(W, 'walkTo'); }
/** The ruler's own figure (always exists; idles at the seat's door). */
export function rulerActor(s: GameState): Actor { return notImplemented(W, 'rulerActor'); }
/** A point just outside the map edge where newcomers appear and the departed leave (the road in). */
export function gatePoint(s: GameState): [number, number] { return notImplemented(W, 'gatePoint'); }

export const actorsModule: SimModule = { name: 'actors' };
