/** OWNER: render-figures agent. Ambient townsfolk: cosmetic figures for housed households. Placeholder. */
import type * as THREE from 'three';
import type { RenderCtx, Env } from './api';
import type { GameState, SimEvent, Id } from '../sim/types';

export interface LayerHelpers {
  /** world-space point just outside a building's door (null if unknown) */
  doorOf(buildingId: Id): THREE.Vector3 | null;
  /** world-space top-centre of a building (for perching, looking at) */
  topOf(buildingId: Id): THREE.Vector3 | null;
  /** world-space position of a table prop (the coffer...) */
  propPos(prop: 'coffer' | 'ledger' | 'charter'): THREE.Vector3;
}
export interface FigureLayer {
  reset(state: GameState): void;
  sync(state: GameState): void;
  handleEvents(events: SimEvent[], state: GameState): void;
  update(env: Env): void;
  /** world position of the figure's head top, for pins and bubbles (null if not on the table) */
  positionOf(id: Id): THREE.Vector3 | null;
  /** nearest figure hit by the ray, as its id (tenant id for townsfolk, actor id for actors) */
  pick(raycaster: THREE.Raycaster): Id | null;
  setSelected(id: Id | null): void;
  dispose(): void;
}
export function createTownLife(_ctx: RenderCtx, _h: LayerHelpers): FigureLayer {
  return { reset() {}, sync() {}, handleEvents() {}, update() {}, positionOf() { return null; }, pick() { return null; }, setSelected() {}, dispose() {} };
}
