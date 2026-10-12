/** Shared shape between the two building agents. Owned by the integrator. */
import type * as THREE from 'three';
import type { BuildingLook, BuildingVisual, RenderCtx, Env } from '../api';

/** The bare model of one building at full health, in local space (see render/api.ts). */
export interface BuiltBody {
  group: THREE.Group;
  anchors: BuildingVisual['anchors'];
  /** window panes: the wrapper swaps their material to glow at night when the unit is occupied */
  windows: THREE.Mesh[];
  /** roof meshes: the wrapper adds snow caps, moss and missing-thatch wear to these */
  roofs: THREE.Mesh[];
  /** wall meshes: the wrapper tints these for grime, damp and the 'purple' flag */
  walls: THREE.Mesh[];
  /** optional per-frame motion that belongs to the model itself (mill sails, a swinging sign, a flag) */
  animate?: (env: Env) => void;
}
export type BodyBuilder = (look: BuildingLook, ctx: RenderCtx) => BuiltBody;
