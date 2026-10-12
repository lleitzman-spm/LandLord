/**
 * The look, as code. Every render module takes colours and materials from
 * here so the miniature reads as one hand-painted set. Owned by the integrator;
 * render agents may ADD entries (append only) but must not change existing ones.
 */
import * as THREE from 'three';

export const PAL = {
  // the room & table
  room: 0x0e0a08, oak: 0x5b3a22, oakDark: 0x3a2415, oakLight: 0x7a5232, iron: 0x3c3a3a, brass: 0xb08a3c,
  felt: 0x2f4a32, wax: 0xe8dcc0, flame: 0xffb25e, flameCore: 0xfff0c0,
  // board & terrain (season tints are blended by terrain code)
  grassSpring: 0x86ad55, grassSummer: 0x6f9a3f, grassAutumn: 0xa39a48, grassWinter: 0xdfe6ea,
  dirt: 0x8a6a45, dirtDark: 0x6b4f33, road: 0xa08a68, cobble: 0x8d8a82, boardEdge: 0x4b3524,
  water: 0x4d86a8, waterDeep: 0x35668a, rock: 0x8f8b83, rockDark: 0x6d6a64,
  leafSpring: 0x7fb24c, leafSummer: 0x4f8a3a, leafAutumn: 0xc8792b, leafAutumn2: 0xb5482a, leafWinter: 0x8a8f86, pine: 0x3f6b45, trunk: 0x5a4028,
  snow: 0xf2f5f7, field: 0xc9b25a,
  // buildings
  plaster: 0xe9dcc0, plasterWarm: 0xe2c9a0, plasterGrey: 0xcfc8b8, timber: 0x4a3423, timberLight: 0x6b4c32,
  thatch: 0xc9a24b, thatchOld: 0x9a8a55, tile: 0xa8452e, tileDark: 0x8a3524, slate: 0x5b6470, slateDark: 0x464e58,
  stone: 0x9a958a, stoneDark: 0x77736a, stoneWarm: 0xa89f8c, brick: 0x9c5a3c, daub: 0xb89a6a,
  door: 0x6a3f24, doorRed: 0x8a2f25, doorGreen: 0x3f6a4a, doorBlue: 0x35557a, window: 0x2a2f3a, windowLit: 0xffc66a,
  wizard: 0x5c4a8a, wizardRoof: 0x3a2f6a, purple: 0x7a3fa0, moss: 0x6a8a4a, soot: 0x2a2623,
  // people (turned wood, painted)
  skinA: 0xf0c9a0, skinB: 0xd9a777, skinC: 0xa9744a, skinD: 0x7a4f30, goblin: 0x7fae5a, goblinDark: 0x5f8a45, ogre: 0x9ab0a0, elf: 0xf3dcc0,
  clothRed: 0x9e2b25, clothBlue: 0x2f4a7a, clothGreen: 0x4f7a5a, clothOchre: 0xc9962f, clothBrown: 0x7a5a3a, clothCream: 0xe6d8b8,
  clothPlum: 0x6a3a5a, clothTeal: 0x3a7a7a, clothGrey: 0x7a7a7a, clothBlack: 0x2a2623, hairDark: 0x2a1d14, hairBrown: 0x6a4424, hairRed: 0xa8522a, hairBlond: 0xd9b25a, hairGrey: 0xbdb8ae, hairWhite: 0xeeeae0,
  // accents
  gold: 0xe3b23c, goldDark: 0xb0842a, crimson: 0x9e2b25, lapis: 0x2f4a7a, verdigris: 0x4f7a5a, ink: 0x2a1d14, parchment: 0xefe3c4,
  good: 0x5f9a4a, warn: 0xd9962f, bad: 0xb53a2a, magic: 0xb58cff, ghost: 0xbfe6e0, fire: 0xff7a2a,
} as const;
export type PalKey = keyof typeof PAL;

export interface MatOpts { rough?: number; metal?: number; flat?: boolean; emissive?: number; emissiveIntensity?: number; transparent?: boolean; opacity?: number; side?: THREE.Side; vertexColors?: boolean }

const cache = new Map<string, THREE.MeshStandardMaterial>();
/**
 * Shared, cached painted-miniature material. Flat-shaded and matte by default
 * so facets read as carved wood. Do NOT mutate what you get back (it is shared);
 * pass `unique` when you need to animate colour/emissive on one object.
 */
export function mat(color: number, opts: MatOpts = {}, unique = false): THREE.MeshStandardMaterial {
  const key = unique ? '' : [color, opts.rough ?? 0.85, opts.metal ?? 0, opts.flat ?? true, opts.emissive ?? 0, opts.emissiveIntensity ?? 0, opts.transparent ?? false, opts.opacity ?? 1, opts.side ?? 0, opts.vertexColors ?? false].join('|');
  const hit = unique ? undefined : cache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshStandardMaterial({
    color, roughness: opts.rough ?? 0.85, metalness: opts.metal ?? 0, flatShading: opts.flat ?? true,
    emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? (opts.emissive ? 1 : 0),
    transparent: opts.transparent ?? false, opacity: opts.opacity ?? 1, side: opts.side ?? THREE.FrontSide,
    vertexColors: opts.vertexColors ?? false,
  });
  if (!unique) cache.set(key, m);
  return m;
}

/** Slightly vary a colour by a seed (hand-painted inconsistency). amount ~0.06 */
export function tint(color: number, seed: number, amount = 0.06): number {
  const c = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const r = (n: number) => { let t = (n + 0x6d2b79f5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  c.setHSL(hsl.h + (r(seed) - 0.5) * amount * 0.4, Math.min(1, Math.max(0, hsl.s + (r(seed + 1) - 0.5) * amount)), Math.min(1, Math.max(0, hsl.l + (r(seed + 2) - 0.5) * amount * 1.4)));
  return c.getHex();
}
export function mix(a: number, b: number, t: number): number {
  return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
}
/** Mark a mesh (and children) as casting/receiving shadow. */
export function shadows<T extends THREE.Object3D>(o: T, cast = true, receive = true): T {
  o.traverse(c => { const m = c as THREE.Mesh; if (m.isMesh) { m.castShadow = cast; m.receiveShadow = receive; } });
  return o;
}
