/** OWNER: render-creatures agent. Particles and weather. Placeholder no-ops. */
import type { Fx, RenderCtx } from './api';
export function createFx(_ctx: RenderCtx): Fx {
  return { coins() {}, puff() {}, sparkle() {}, hearts() {}, confetti() {}, smoke() { return { stop() {}, move() {} }; }, setWeather() {}, update() {}, dispose() {} };
}
