/** Small things the two figure layers (town life, sim actors) both need. No allocation. */
import * as THREE from 'three';
import type { LivingFigure } from './figure';

const _v = new THREE.Vector3();

/**
 * Does the ray touch this figure? Returns the distance along the ray, or Infinity.
 * Figures are small, so the test is generous: two fat balls, body and head.
 */
export function pickFigure(ray: THREE.Ray, fig: LivingFigure): number {
  const g = fig.group.position, hgt = fig.height;
  const r = Math.max(fig.radius * 1.3, 0.15);
  let best = Infinity;
  for (let k = 0; k < 2; k++) {
    _v.set(g.x, g.y + hgt * (k ? 0.74 : 0.3), g.z);
    if (ray.distanceSqToPoint(_v) > r * r) continue;
    const along = _v.sub(ray.origin).dot(ray.direction);
    if (along > 0 && along < best) best = along;
  }
  return best;
}

/** scale for a figure popping onto (or off) the table: 0 → 1 with a small overshoot */
export function popScale(pop: number): number {
  if (pop <= 0) return 0.001;
  if (pop >= 1) return 1;
  const u = pop - 1;
  return Math.max(0.001, 1 + u * u * (2.2 * u + 1.2));
}
