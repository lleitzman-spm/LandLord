/** OWNER: render-core agent. createRenderer: scene, table, light, camera, post, terrain, picking, reconcile. */
import type { Renderer, RendererDeps } from './api';
export function createRenderer(_deps: RendererDeps): Renderer {
  throw new Error('[render] createRenderer is not implemented yet (owner: render-core)');
}
export type * from './api';
