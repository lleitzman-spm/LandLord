/** OWNER: render-figures agent. Figures for sim actors (ruler, staff, applicants, petitioners). Placeholder. */
import type { RenderCtx } from './api';
import type { FigureLayer, LayerHelpers } from './townlife';
export function createActorLayer(_ctx: RenderCtx, _h: LayerHelpers): FigureLayer {
  return { reset() {}, sync() {}, handleEvents() {}, update() {}, positionOf() { return null; }, pick() { return null; }, setSelected() {}, dispose() {} };
}
