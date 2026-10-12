/**
 * Small shared helpers for the effects layer: colour conversion into linear
 * working space, the light tint that unlit sprites borrow from the time of
 * day, the prevailing wind, and how loosely effects follow game speed.
 * Nothing here allocates per frame.
 */
import * as THREE from 'three';
import type { Env, Quality } from '../api';
import { MAP_W, MAP_H } from '../../sim/types';

/** Half extents of the realm board in world units (weather stays inside). */
export const BOARD_HX = MAP_W / 2;
export const BOARD_HZ = MAP_H / 2;
/** Generous half extents of the oak table around the board (dust motes). */
export const TABLE_HX = MAP_W / 2 + 8;
export const TABLE_HZ = MAP_H / 2 + 6;

export const TAU = Math.PI * 2;

/** Linear-space RGB triple for an sRGB hex colour (palette colours are sRGB). */
export function lin(hex: number): [number, number, number] {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

/** A flat Float32Array of linear RGB triples, for picking colours in the frame loop. */
export function linList(hexes: number[]): Float32Array {
  const out = new Float32Array(hexes.length * 3);
  hexes.forEach((h, i) => { const c = lin(h); out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2]; });
  return out;
}

export function rand(a: number, b: number): number { return a + Math.random() * (b - a); }
export function clamp01(x: number): number { return x < 0 ? 0 : x > 1 ? 1 : x; }
export function smooth(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}
export function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

/** How much of the full effect density a quality level gets. */
export function densityOf(q: Quality): number { return q === 'low' ? 0.45 : q === 'medium' ? 0.75 : 1; }

/**
 * Game speed, loosely: paused hangs almost still, the speaking crawl is slow,
 * fast-forward is brisker but never frantic.
 */
export function worldRateOf(speed: number): number {
  if (speed <= 0) return 0.04;
  if (speed < 0.5) return 0.3;
  if (speed <= 1) return 1;
  if (speed <= 2) return 1.2;
  return 1.45;
}

/** Mutable per-frame shared state handed to every effect system. */
export interface FxFrame {
  env: Env;
  dtR: number;            // real seconds this frame
  dtW: number;            // world-time seconds this frame (loosely follows game speed)
  density: number;        // 0..1 quality multiplier
  windX: number;          // prevailing wind direction (unit, xz)
  windZ: number;
  windS: number;          // wind strength in world units per second at full lean
  camX: number; camY: number; camZ: number;
  flash: number;          // lightning right now 0..1
  day: number;            // 1 full daylight .. 0 night (convenience: 1 - env.night)
}

/**
 * The colour of the light that unlit sprites (smoke, rain, snow, fog) should
 * be multiplied by, so they sit in the scene: rosy dawn on Rent Day, a long
 * warm afternoon, orange dusk, a short blue night. Writes into `out`.
 */
export function lightTint(env: Env, flash: number, overcast: number, out: THREE.Color): THREE.Color {
  const p = env.monthPhase;
  // day colour across the month (linear values, close to 1 at noon)
  let r = 1.0, g = 0.95, b = 0.88;
  if (p < 0.12) {                       // dawn: rosy gold warming to day
    const t = p / 0.12;
    r = lerp(1.0, 1.0, t); g = lerp(0.74, 0.95, t); b = lerp(0.62, 0.88, t);
  } else if (p > 0.6 && p < 0.86) {      // dusk deepening to orange
    const t = smooth(0.6, 0.82, p);
    r = lerp(1.0, 1.0, t); g = lerp(0.95, 0.62, t); b = lerp(0.88, 0.40, t);
  } else if (p >= 0.86) {
    r = 1.0; g = 0.66; b = 0.46;
  }
  const n = clamp01(env.night);
  // night: candle-lit, mostly cool and dim
  r = lerp(r, 0.20, n); g = lerp(g, 0.23, n); b = lerp(b, 0.36, n);
  // overcast weather greys and cools the light a little
  const o = clamp01(overcast) * 0.28;
  const l = (r + g + b) / 3;
  r = lerp(r, l * 0.86, o); g = lerp(g, l * 0.9, o); b = lerp(b, l * 1.0, o);
  // lightning: a cold lift
  r += flash * 0.55; g += flash * 0.65; b += flash * 0.95;
  out.setRGB(r, g, b);
  return out;
}
