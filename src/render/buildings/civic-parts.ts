/**
 * OWNER: render-civic. The workbench the civic bodies are carved on.
 *
 * A `Kit` collects primitive parts (boxes, cylinders, roofs, doors, windows)
 * authored in a building's local space, then merges them so a whole building
 * costs a handful of draw calls:
 *   - every plain-coloured detail goes into ONE vertex-coloured mesh;
 *   - walls, roofs and window panes are merged per colour into separate meshes
 *     (the wrapper tints walls, caps roofs and lights windows through these);
 *   - parts with their own material (glow, canvas signs) merge per material.
 * Unit geometries are shared module-wide; only the merged result is per building.
 * `look.variant` mirrors the whole body (geometry and anchors) for half the seeds.
 */
import * as THREE from 'three';
import { PAL, mat } from '../palette';
import type { MatOpts } from '../palette';
import type { BuildingLook, Env } from '../api';
import type { BuiltBody } from './types';

// ───────────── colours that the palette does not name (kept within its tone) ─────────────

export const C = {
  apple: 0xb5452a, appleGreen: 0x9aae4a, pear: 0xcdb54e, turnip: 0xd9c8d0, turnipTop: 0x6f9a4a,
  cabbage: 0xa6c487, cabbageDark: 0x6f9a55, leaf: 0x5f8a45, leafDark: 0x4a7038,
  marigold: 0xe0862a, marigoldY: 0xe8b83a, rose: 0xc0485a, lavender: 0x8a78b5,
  cheese: 0xe6c25a, rind: 0xcf9a3a, wax: 0xb53a2a,
  fish: 0xaab9c0, fishDark: 0x5d6f7a, ice: 0xdfeef2,
  bread: 0xc4893f, crust: 0x93602e, flour: 0xeee6d2, sack: 0xd6c59c, sackDark: 0xb8a57a,
  rope: 0xb89a6a, straw: 0xd9b860, wattle: 0x8a6a40, wattleLight: 0xa3824f,
  glassGreen: 0x2c5a40, potionRed: 0xc04a4a, potionBlue: 0x4a7ac0, potionGreen: 0x6abf5a, potionPurple: 0x9a6ac5,
  herb: 0x6f8f4a, herbDry: 0x9a8a4a,
  ember: 0xff8a3a, coal: 0x2a2623, ash: 0x5a5550, leather: 0x6a4a2e,
  bronze: 0x8c7a4c, bronzeDark: 0x6a5c38, verd: 0x6f9f88,
  pigeon: 0x8e939e, pigeonDark: 0x5c616c, crow: 0x2a2a30, beak: 0xd9962f,
  bell: 0xc9a040, stained: 0x2f3f6a,
  mortar: 0xd8cfbf, shadow: 0x1c1714, splat: 0xf2efe6,
} as const;

// ───────────── tiny seeded random ─────────────

export type Rng = () => number;
export function rng(seed: number): Rng {
  let a = (Math.imul(seed | 0, 2654435761) ^ 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pick<T>(r: Rng, list: readonly T[]): T { return list[Math.floor(r() * list.length) % list.length]; }

// ───────────── shared unit geometry ─────────────

const geoCache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) {
    const made = make();
    g = made.index ? made.toNonIndexed() : made;
    if (made !== g) made.dispose();
    if (!g.attributes.normal) g.computeVertexNormals();
    geoCache.set(key, g);
  }
  return g;
}
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Unit-sized primitives. Radius 0.5 everywhere, so a scale is a diameter. All centred, except where noted. */
export const GEO = {
  box: () => cached('box', () => new THREE.BoxGeometry(1, 1, 1)),
  cyl: (seg = 8, rt = 0.5, rb = 0.5) => cached(`cyl:${seg}:${rt}:${rb}`, () => new THREE.CylinderGeometry(rt, rb, 1, seg)),
  /** a slice of a cylinder (theta from +z towards +x) */
  cylArc: (seg: number, start: number, len: number) => cached(`cylArc:${seg}:${r3(start)}:${r3(len)}`, () => new THREE.CylinderGeometry(0.5, 0.5, 1, seg, 1, false, start, len)),
  cone: (seg = 8) => cached(`cone:${seg}`, () => new THREE.ConeGeometry(0.5, 1, seg)),
  coneArc: (seg: number, start: number, len: number) => cached(`coneArc:${seg}:${r3(start)}:${r3(len)}`, () => new THREE.ConeGeometry(0.5, 1, seg, 1, false, start, len)),
  ico: (d = 0) => cached(`ico:${d}`, () => new THREE.IcosahedronGeometry(0.5, d)),
  /** hemisphere, flat side down at y = 0 */
  dome: (seg = 10, rings = 4) => cached(`dome:${seg}:${rings}`, () => new THREE.SphereGeometry(0.5, seg, rings, 0, Math.PI * 2, 0, Math.PI / 2)),
  /** ring lying flat (in xz), radius 0.5 */
  torus: (tube = 0.18, seg = 12, radial = 4, arc = Math.PI * 2) => cached(`torus:${r3(tube)}:${seg}:${radial}:${r3(arc)}`, () => {
    const g = new THREE.TorusGeometry(0.5, tube, radial, seg, arc); g.rotateX(Math.PI / 2); return g;
  }),
  /** triangular prism: triangle spans z -0.5..0.5, apex at y = 1, base y = 0, thickness along x -0.5..0.5 */
  tri: () => cached('tri', () => {
    const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.lineTo(-0.5, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, steps: 1, curveSegments: 1 });
    g.rotateY(-Math.PI / 2); g.translate(0.5, 0, 0); return g;
  }),
  /** square pyramid, base -0.5..0.5 in x and z at y = 0, apex y = 1 */
  pyr: () => cached('pyr', () => { const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4); g.rotateY(Math.PI / 4); g.translate(0, 0.5, 0); return g; }),
  /** hipped roof, base -0.5..0.5 at y = 0, ridge at y = 1 running along x for `ridge` (0..1) of the length */
  hip: (ridge: number) => cached(`hip:${r3(ridge)}`, () => {
    const h = ridge / 2;
    const v = [
      -0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5, // base 0..3
      -h, 1, 0, h, 1, 0,                                       // ridge 4, 5
    ];
    const f = [3, 2, 5, 3, 5, 4, /* front */ 1, 0, 4, 1, 4, 5, /* back */ 2, 1, 5, /* right */ 0, 3, 4, /* left */ 0, 1, 2, 0, 2, 3 /* bottom */];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(f); g.computeVertexNormals(); return g;
  }),
  /** barrel: height 1, belly radius 0.5, ends radius 0.4 */
  barrel: () => cached('barrel', () => new THREE.LatheGeometry([
    new THREE.Vector2(0, -0.5), new THREE.Vector2(0.4, -0.5), new THREE.Vector2(0.47, -0.27), new THREE.Vector2(0.5, 0),
    new THREE.Vector2(0.47, 0.27), new THREE.Vector2(0.4, 0.5), new THREE.Vector2(0, 0.5)], 9)),
  /** bell: mouth radius 0.5 at y = 0, crown at y = 1 */
  bell: () => cached('bell', () => new THREE.LatheGeometry([
    new THREE.Vector2(0, 1), new THREE.Vector2(0.2, 0.98), new THREE.Vector2(0.27, 0.85), new THREE.Vector2(0.3, 0.55),
    new THREE.Vector2(0.38, 0.2), new THREE.Vector2(0.5, 0.04), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 0.06)].reverse(), 10)),
  /** a curve swept into a tube, cached by key */
  tube: (key: string, pts: [number, number, number][], radius: number, closed = false, segs = 48) =>
    cached(`tube:${key}`, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])), closed), segs, radius, 5, closed)),
  /** a gable roof shell: ridge along z, underside meets the wall top (y = 0) at |x| = span/2. */
  gable: (span: number, rise: number, t: number, over: number, len: number) => cached(`gable:${r3(span)}:${r3(rise)}:${r3(t)}:${r3(over)}:${r3(len)}`, () => {
    const hs = span / 2 + over, k = rise / (span / 2), tv = t * Math.sqrt(1 + k * k), yl = -k * over;
    const s = new THREE.Shape();
    s.moveTo(-hs, yl); s.lineTo(0, rise); s.lineTo(hs, yl); s.lineTo(hs, yl + tv); s.lineTo(0, rise + tv); s.lineTo(-hs, yl + tv); s.lineTo(-hs, yl);
    const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, steps: 1, curveSegments: 1 });
    g.translate(0, 0, -len / 2); return g;
  }),
  /** a 1x1 plane facing +z showing one cell of a canvas atlas */
  quad: (u0: number, v0: number, u1: number, v1: number) => cached(`quad:${u0}:${v0}:${u1}:${v1}`, () => {
    const g = new THREE.PlaneGeometry(1, 1);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0);
    return g;
  }),
};

// ───────────── paints ─────────────

export type Role = 'wall' | 'roof' | 'win' | 'detail';
/** a palette colour (merged into the vertex-coloured detail mesh), a role-tagged colour, or a material of its own */
export type Paint = number | THREE.Material | { c: number; role: Role; o?: MatOpts; unique?: THREE.Material };
export const wallP = (c: number, o?: MatOpts): Paint => ({ c, role: 'wall', o });
export const roofP = (c: number, o?: MatOpts): Paint => ({ c, role: 'roof', o });
export const winP = (c: number = PAL.window, o?: MatOpts): Paint => ({ c, role: 'win', o: o ?? { rough: 0.4 } });

/** Shared night-glow glass for lanterns: one material, its intensity set from env each frame. */
let lanternMat: THREE.MeshStandardMaterial | null = null;
export function lanternGlass(): THREE.MeshStandardMaterial {
  if (!lanternMat) lanternMat = mat(0xffe2b0, { emissive: PAL.windowLit, emissiveIntensity: 0.25, rough: 0.5 }, true);
  return lanternMat;
}
let flameMat: THREE.MeshStandardMaterial | null = null;
/** candle flame: always lit */
export function flameGlow(): THREE.MeshStandardMaterial {
  if (!flameMat) flameMat = mat(PAL.flameCore, { emissive: PAL.flame, emissiveIntensity: 2.2, rough: 1 }, true);
  return flameMat;
}

type Rot = number | readonly [number, number, number];
interface Part { g: THREE.BufferGeometry; m: THREE.Matrix4; c: THREE.Color | null }
interface Bucket { role: Role; material: THREE.Material; vc: boolean; uv: boolean; parts: Part[] }

const MIRROR = new THREE.Matrix4().makeScale(-1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const colCache = new Map<number, THREE.Color>();
function col(hex: number): THREE.Color { let c = colCache.get(hex); if (!c) { c = new THREE.Color(hex); colCache.set(hex, c); } return c; }

export type Face = 'f' | 'b' | 'l' | 'r';
const FACE_RY: Record<Face, number> = { f: 0, r: Math.PI / 2, b: Math.PI, l: -Math.PI / 2 };
const faceRy = (f: Face | number) => typeof f === 'number' ? f : FACE_RY[f];

export interface WindowOpts {
  x: number; y: number; z: number; w: number; h: number;
  face?: Face | number;
  glass?: Paint;
  frame?: number | null;
  sill?: boolean;
  shutters?: number | null;
  mull?: 'cross' | 'v' | 'h' | 'none' | 'lead';
  bars?: boolean;
  arch?: 'round' | 'point' | null;
  /** register a peek point (default true) */
  peek?: boolean;
}
export interface DoorOpts {
  x: number; z: number; w: number; h: number;
  face?: Face | number;
  color: number;
  frame?: number | null;
  arch?: boolean;
  step?: number | null;
  iron?: boolean;
  ring?: boolean;
  double?: boolean;
  /** register as the building's door anchor (default true) */
  main?: boolean;
}

export class Kit {
  readonly m: 1 | -1;
  readonly r: Rng;
  readonly root: Kit;
  readonly group = new THREE.Group();
  readonly walls: THREE.Mesh[] = [];
  readonly roofs: THREE.Mesh[] = [];
  readonly windows: THREE.Mesh[] = [];
  readonly winPts: THREE.Vector3[] = [];
  door = new THREE.Vector3(0, 0, 0.5);
  perch = new THREE.Vector3(0, 1, 0);
  chimney: THREE.Vector3 | null = null;
  top: number | null = null;
  private buckets = new Map<string, Bucket>();
  private ups: Array<(env: Env) => void> = [];
  private usesLantern = false;

  constructor(seed: number, mirror: boolean | 1 | -1 = true, root?: Kit, r?: Rng) {
    this.r = r ?? rng(seed);
    this.m = typeof mirror === 'number' ? mirror : (mirror && this.r() < 0.5 ? -1 : 1);
    this.root = root ?? this;
  }
  static of(look: BuildingLook, canMirror = true): Kit { return new Kit(look.variant * 131 + 7, canMirror); }

  /** a child kit for a moving part: same mirror and random stream; build() it and attach() the group */
  sub(): Kit { return new Kit(0, this.m, this.root, this.r); }
  /** symmetric random in [-a, a] */
  j(a: number): number { return (this.r() - 0.5) * 2 * a; }
  /** register per-frame motion */
  anim(fn: (env: Env) => void): void { this.root.ups.push(fn); }

  // ── low level ──
  private bucket(p: Paint): { b: Bucket; c: THREE.Color | null } {
    let key: string, make: () => Bucket, c: THREE.Color | null = null;
    if (typeof p === 'number') {
      key = 'vc'; c = col(p);
      make = () => ({ role: 'detail', material: mat(0xffffff, { vertexColors: true }), vc: true, uv: false, parts: [] });
    } else if (p instanceof THREE.Material) {
      key = 'm:' + p.uuid;
      const hasMap = !!(p as THREE.MeshStandardMaterial).map;
      make = () => ({ role: 'detail', material: p, vc: false, uv: hasMap, parts: [] });
    } else {
      const u = p.unique;
      key = u ? `${p.role}:u:${u.uuid}` : `${p.role}:${p.c}:${p.o ? JSON.stringify(p.o) : ''}`;
      make = () => ({ role: p.role, material: u ?? mat(p.c, p.o ?? {}), vc: false, uv: false, parts: [] });
    }
    let b = this.buckets.get(key);
    if (!b) { b = make(); this.buckets.set(key, b); }
    return { b, c };
  }
  private push(p: Paint, g: THREE.BufferGeometry, m: THREE.Matrix4): this {
    if (this.m < 0) m.premultiply(MIRROR);
    const { b, c } = this.bucket(p);
    b.parts.push({ g, m, c });
    return this;
  }
  /** add a geometry with scale, position and rotation (number = yaw; tuple = [pitch, yaw, roll], applied roll→pitch→yaw) */
  add(p: Paint, g: THREE.BufferGeometry, sx: number, sy: number, sz: number, x: number, y: number, z: number, rot?: Rot): this {
    if (rot === undefined) _q.identity();
    else if (typeof rot === 'number') _q.setFromAxisAngle(UP, rot);
    else _q.setFromEuler(_e.set(rot[0], rot[1], rot[2], 'YXZ'));
    return this.push(p, g, new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)));
  }
  addM(p: Paint, g: THREE.BufferGeometry, m: THREE.Matrix4): this { return this.push(p, g, m.clone()); }

  // ── primitives (all centred on x,y,z) ──
  box(p: Paint, w: number, h: number, d: number, x: number, y: number, z: number, rot?: Rot): this { return this.add(p, GEO.box(), w, h, d, x, y, z, rot); }
  /** box whose bottom sits at y */
  slab(p: Paint, w: number, h: number, d: number, x: number, y: number, z: number, rot?: Rot): this { return this.add(p, GEO.box(), w, h, d, x, y + h / 2, z, rot); }
  cyl(p: Paint, r: number, h: number, x: number, y: number, z: number, seg = 8, rot?: Rot): this { return this.add(p, GEO.cyl(seg), r * 2, h, r * 2, x, y, z, rot); }
  cylT(p: Paint, rt: number, rb: number, h: number, x: number, y: number, z: number, seg = 8, rot?: Rot): this {
    const m = Math.max(rt, rb);
    return this.add(p, GEO.cyl(seg, r3(rt / m / 2), r3(rb / m / 2)), m * 2, h, m * 2, x, y, z, rot);
  }
  cone(p: Paint, r: number, h: number, x: number, y: number, z: number, seg = 8, rot?: Rot): this { return this.add(p, GEO.cone(seg), r * 2, h, r * 2, x, y, z, rot); }
  ball(p: Paint, r: number, x: number, y: number, z: number, detail = 0, squash = 1, rot?: Rot): this { return this.add(p, GEO.ico(detail), r * 2, r * 2 * squash, r * 2, x, y, z, rot); }
  blob(p: Paint, sx: number, sy: number, sz: number, x: number, y: number, z: number, rot?: Rot, detail = 0): this { return this.add(p, GEO.ico(detail), sx, sy, sz, x, y, z, rot); }
  dome(p: Paint, r: number, h: number, x: number, y: number, z: number, rot?: Rot): this { return this.add(p, GEO.dome(), r * 2, h * 2, r * 2, x, y, z, rot); }
  ring(p: Paint, r: number, tube: number, x: number, y: number, z: number, rot?: Rot, seg = 12): this {
    return this.add(p, GEO.torus(r3(tube / r * 0.5), seg), r * 2, r * 2, r * 2, x, y, z, rot);
  }
  /** a square-section beam between two points */
  beam(p: Paint, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, t: number, t2 = t): this {
    _a.set(x2 - x1, y2 - y1, z2 - z1); const len = _a.length(); _a.normalize();
    _q.setFromUnitVectors(UP, _a);
    return this.push(p, GEO.box(), new THREE.Matrix4().compose(_p.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2), _q, _s.set(t, len, t2)));
  }
  /** a round rod between two points */
  rod(p: Paint, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, r: number, seg = 5): this {
    _a.set(x2 - x1, y2 - y1, z2 - z1); const len = _a.length(); _a.normalize();
    _q.setFromUnitVectors(UP, _a);
    return this.push(p, GEO.cyl(seg), new THREE.Matrix4().compose(_p.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2), _q, _s.set(r * 2, len, r * 2)));
  }
  /** a sagging rope through n segments */
  rope(p: Paint, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, sag: number, r = 0.006, n = 4): this {
    let px = x1, py = y1, pz = z1;
    for (let i = 1; i <= n; i++) {
      const t = i / n, x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t, y = y1 + (y2 - y1) * t - Math.sin(t * Math.PI) * sag;
      this.rod(p, px, py, pz, x, y, z, r, 4); px = x; py = y; pz = z;
    }
    return this;
  }
  /** gable infill triangle: base `span` wide at y, apex `rise` above it, `t` thick, ridge along `axis` */
  tri(p: Paint, span: number, rise: number, t: number, x: number, y: number, z: number, axis: 'x' | 'z' = 'x'): this {
    return axis === 'x' ? this.add(p, GEO.tri(), t, rise, span, x, y, z) : this.add(p, GEO.tri(), t, rise, span, x, y, z, Math.PI / 2);
  }

  /**
   * A roof shell. `span` is the wall depth across the ridge, `len` the wall length along it.
   * The underside meets the wall top `y` at the wall line. Returns heights.
   */
  gable(p: Paint, o: { x?: number; y: number; z?: number; span: number; len: number; rise: number; t?: number; over?: number; ends?: number; axis?: 'x' | 'z'; roll?: number }): { ridge: number; eave: number } {
    const t = o.t ?? 0.06, over = o.over ?? 0.12, ends = o.ends ?? 0.1;
    const g = GEO.gable(o.span, o.rise, t, over, o.len + ends * 2);
    const ry = (o.axis ?? 'x') === 'x' ? Math.PI / 2 : 0;
    this.add(p, g, 1, 1, 1, o.x ?? 0, o.y, o.z ?? 0, [0, ry, o.roll ?? 0]);
    const k = o.rise / (o.span / 2);
    return { ridge: o.y + o.rise + t * Math.sqrt(1 + k * k), eave: o.y - k * over };
  }

  // ── faces: u along the wall (to the right seen from outside), v up, n outward ──
  faceAdd(p: Paint, g: THREE.BufferGeometry, sx: number, sy: number, sz: number, face: Face | number, cx: number, cy: number, cz: number, u: number, v: number, n: number, rx = 0, rz = 0): this {
    const ry = faceRy(face), c = Math.cos(ry), s = Math.sin(ry);
    return this.add(p, g, sx, sy, sz, cx + u * c + n * s, cy + v, cz - u * s + n * c, [rx, ry, rz]);
  }
  facePoint(face: Face | number, cx: number, cy: number, cz: number, u: number, v: number, n: number): THREE.Vector3 {
    const ry = faceRy(face), c = Math.cos(ry), s = Math.sin(ry);
    return new THREE.Vector3(cx + u * c + n * s, cy + v, cz - u * s + n * c);
  }

  /** a window on a wall face; x,y,z is the centre of the opening on the wall surface */
  window(o: WindowOpts): this {
    const f = o.face ?? 'f', B = GEO.box(), w = o.w, h = o.h;
    const frame = o.frame === undefined ? PAL.timber : o.frame;
    const glass = o.glass ?? winP();
    this.faceAdd(glass, B, w, h, 0.02, f, o.x, o.y, o.z, 0, 0, 0.006);
    if (o.arch === 'round') this.faceAdd(glass, GEO.cyl(10), w, 0.02, w, f, o.x, o.y, o.z, 0, h / 2, 0.006, Math.PI / 2);
    if (o.arch === 'point') this.faceAdd(glass, B, w * 0.7071, w * 0.7071, 0.02, f, o.x, o.y, o.z, 0, h / 2, 0.006, 0, Math.PI / 4);
    if (frame !== null) {
      const ft = Math.min(0.035, w * 0.16);
      this.faceAdd(frame, B, ft, h + ft, 0.03, f, o.x, o.y, o.z, -w / 2 - ft / 2 + 0.004, 0, 0.012);
      this.faceAdd(frame, B, ft, h + ft, 0.03, f, o.x, o.y, o.z, w / 2 + ft / 2 - 0.004, 0, 0.012);
      if (!o.arch) this.faceAdd(frame, B, w + ft * 2, ft, 0.03, f, o.x, o.y, o.z, 0, h / 2 + ft / 2 - 0.004, 0.012);
      this.faceAdd(frame, B, w + ft * 2, ft, 0.03, f, o.x, o.y, o.z, 0, -h / 2 - ft / 2 + 0.004, 0.012);
    }
    const lead = PAL.soot, mt = Math.max(0.008, Math.min(0.016, w * 0.06));
    const mull = o.mull ?? (w > 0.22 ? 'cross' : 'v');
    if (mull === 'cross' || mull === 'v') this.faceAdd(frame ?? lead, B, mt, h, 0.026, f, o.x, o.y, o.z, 0, 0, 0.012);
    if (mull === 'cross' || mull === 'h') this.faceAdd(frame ?? lead, B, w, mt, 0.026, f, o.x, o.y, o.z, 0, h * 0.08, 0.012);
    if (mull === 'lead') {
      // diamond leading: two sets of thin diagonals clipped roughly to the pane
      const n = Math.max(2, Math.round(w / 0.07));
      for (let i = 0; i < n; i++) {
        const u = -w / 2 + (i + 0.5) * (w / n);
        this.faceAdd(lead, B, 0.006, h * 0.98, 0.022, f, o.x, o.y, o.z, u, 0, 0.012, 0, 0.35);
        this.faceAdd(lead, B, 0.006, h * 0.98, 0.022, f, o.x, o.y, o.z, u, 0, 0.012, 0, -0.35);
      }
    }
    if (o.bars) {
      const n = Math.max(2, Math.round(w / 0.06));
      for (let i = 0; i < n; i++) this.faceAdd(PAL.iron, GEO.cyl(5), 0.016, h, 0.016, f, o.x, o.y, o.z, -w / 2 + (i + 0.5) * (w / n), 0, 0.03);
      this.faceAdd(PAL.iron, B, w, 0.016, 0.016, f, o.x, o.y, o.z, 0, 0, 0.03);
    }
    if (o.sill !== false && frame !== null) this.faceAdd(frame, B, w + 0.08, 0.025, 0.06, f, o.x, o.y, o.z, 0, -h / 2 - 0.02, 0.03);
    if (o.shutters != null) {
      const sw = w * 0.5 + 0.01;
      for (const sgn of [-1, 1]) {
        this.faceAdd(o.shutters, B, sw, h + 0.02, 0.02, f, o.x, o.y, o.z, sgn * (w / 2 + sw / 2 + 0.03), 0, 0.012);
        this.faceAdd(PAL.timber, B, sw * 0.9, 0.015, 0.024, f, o.x, o.y, o.z, sgn * (w / 2 + sw / 2 + 0.03), h * 0.25, 0.014);
        this.faceAdd(PAL.timber, B, sw * 0.9, 0.015, 0.024, f, o.x, o.y, o.z, sgn * (w / 2 + sw / 2 + 0.03), -h * 0.25, 0.014);
      }
    }
    if (o.peek !== false && this.root === this) this.winPts.push(this.facePoint(f, o.x, o.y, o.z, 0, -h * 0.15, 0.05));
    return this;
  }

  /** a door on a wall face; x,z is the bottom centre on the wall surface */
  doorway(o: DoorOpts): this {
    const f = o.face ?? 'f', B = GEO.box(), w = o.w, h = o.h;
    const frame = o.frame === undefined ? PAL.timber : o.frame;
    const leafH = o.arch ? h - w / 2 : h;
    this.faceAdd(o.color, B, w, leafH, 0.03, f, o.x, leafH / 2, o.z, 0, 0, 0.01);
    if (o.arch) this.faceAdd(o.color, GEO.cyl(10), w, 0.03, w, f, o.x, leafH, o.z, 0, 0, 0.01, Math.PI / 2);
    const dark = new THREE.Color(o.color).multiplyScalar(0.72).getHex();
    if (o.double) this.faceAdd(dark, B, 0.012, h * 0.96, 0.034, f, o.x, h * 0.48, o.z, 0, 0, 0.012);
    else for (const u of [-w / 6, w / 6]) this.faceAdd(dark, B, 0.008, leafH * 0.94, 0.034, f, o.x, leafH * 0.48, o.z, u, 0, 0.012);
    if (o.iron) for (const v of [0.22, 0.72]) this.faceAdd(PAL.iron, B, w * 0.92, 0.024, 0.036, f, o.x, leafH * v, o.z, 0, 0, 0.014);
    if (o.ring) this.faceAdd(PAL.brass, GEO.torus(0.2, 8, 3), 0.05, 0.05, 0.05, f, o.x, leafH * 0.5, o.z, w * 0.22 * (o.double ? 0.5 : 1), 0, 0.04, Math.PI / 2);
    else this.faceAdd(PAL.brass, GEO.ico(0), 0.025, 0.025, 0.025, f, o.x, leafH * 0.5, o.z, w * 0.3, 0, 0.035);
    if (frame !== null) {
      const ft = 0.045;
      this.faceAdd(frame, B, ft, leafH + 0.02, 0.05, f, o.x, (leafH + 0.02) / 2, o.z, -w / 2 - ft / 2 + 0.01, 0, 0.012);
      this.faceAdd(frame, B, ft, leafH + 0.02, 0.05, f, o.x, (leafH + 0.02) / 2, o.z, w / 2 + ft / 2 - 0.01, 0, 0.012);
      if (!o.arch) this.faceAdd(frame, B, w + ft * 2 + 0.03, ft * 1.2, 0.06, f, o.x, h + ft * 0.5, o.z, 0, 0, 0.014);
      else this.faceAdd(frame, GEO.torus(0.09, 12, 4, Math.PI), w + ft * 1.6, w + ft * 1.6, w + ft * 1.6, f, o.x, leafH, o.z, 0, 0, 0.014, -Math.PI / 2);
    }
    const step = o.step === undefined ? PAL.stone : o.step;
    if (step !== null) this.faceAdd(step, B, w + 0.1, 0.04, 0.12, f, o.x, 0.02, o.z, 0, 0, 0.06);
    if (o.main !== false && this.root === this) this.door.copy(this.facePoint(f, o.x, 0, o.z, 0, 0, (step !== null ? 0.12 : 0) + 0.14));
    return this;
  }

  /** a lantern (glows from dusk); x,y,z = top hook point */
  lantern(x: number, y: number, z: number, s = 1): this {
    const g = lanternGlass();
    this.box(PAL.iron, 0.07 * s, 0.012 * s, 0.07 * s, x, y - 0.02 * s, z);
    this.box(g, 0.05 * s, 0.07 * s, 0.05 * s, x, y - 0.065 * s, z);
    this.cone(PAL.iron, 0.05 * s, 0.04 * s, x, y - 0.006 * s, z, 4, Math.PI / 4);
    this.box(PAL.iron, 0.06 * s, 0.01 * s, 0.06 * s, x, y - 0.104 * s, z);
    this.root.usesLantern = true;
    return this;
  }

  /** a plane with its own (usually textured) material; mirrors with the kit */
  plane(material: THREE.Material, g: THREE.BufferGeometry, w: number, h: number, x: number, y: number, z: number, rot?: Rot): this {
    return this.add(material, g, w, h, 1, x, y, z, rot);
  }

  /** attach a built part at a (mirrored) position */
  attach<T extends THREE.Object3D>(o: T, x: number, y: number, z: number, ry = 0): T {
    o.position.set(x * this.m, y, z); o.rotation.y = ry * this.m; this.group.add(o); return o;
  }

  /** a point in an attached part's local space, in root space before mirroring (for anchors and brackets) */
  toRoot(o: THREE.Object3D, x: number, y: number, z: number): THREE.Vector3 {
    o.updateMatrix();
    const v = new THREE.Vector3(x * this.m, y, z).applyMatrix4(o.matrix);
    v.x *= this.m;
    return v;
  }

  /** merge everything collected so far into meshes inside `target` */
  build(target: THREE.Group = new THREE.Group()): THREE.Group {
    for (const b of this.buckets.values()) {
      if (!b.parts.length) continue;
      const mesh = new THREE.Mesh(merge(b.parts, b.vc, b.uv), b.material);
      const lit = !b.material.userData.noShadow;
      mesh.castShadow = lit; mesh.receiveShadow = lit;
      target.add(mesh);
      if (b.role === 'wall') this.root.walls.push(mesh);
      else if (b.role === 'roof') this.root.roofs.push(mesh);
      else if (b.role === 'win') { mesh.castShadow = false; this.root.windows.push(mesh); }
    }
    this.buckets.clear();
    return target;
  }

  /** finish the root kit: merge, mirror the anchors, wire motion */
  finish(): BuiltBody {
    this.build(this.group);
    const mx = (v: THREE.Vector3) => new THREE.Vector3(v.x * this.m, v.y, v.z);
    let top = this.top;
    if (top === null) top = new THREE.Box3().setFromObject(this.group).max.y;
    const ups = this.ups.slice();
    if (this.usesLantern) {
      const g = lanternGlass();
      ups.push(env => { g.emissiveIntensity = 0.12 + env.night * 2.4 + Math.sin(env.time * 9.1) * 0.06 * env.night; });
    }
    return {
      group: this.group,
      anchors: { door: mx(this.door), roof: mx(this.perch), chimney: this.chimney ? mx(this.chimney) : null, top, windows: this.winPts.map(mx) },
      walls: this.walls, roofs: this.roofs, windows: this.windows,
      animate: ups.length ? (env: Env) => { for (let i = 0; i < ups.length; i++) ups[i](env); } : undefined,
    };
  }
}

const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3();
function merge(parts: Part[], vc: boolean, uv: boolean): THREE.BufferGeometry {
  let count = 0;
  for (const p of parts) count += p.g.attributes.position.count;
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3);
  const colr = vc ? new Float32Array(count * 3) : null, uvs = uv ? new Float32Array(count * 2) : null;
  let o = 0;
  for (const p of parts) {
    const pa = p.g.attributes.position as THREE.BufferAttribute, na = p.g.attributes.normal as THREE.BufferAttribute;
    const ua = p.g.attributes.uv as THREE.BufferAttribute | undefined;
    _nm.getNormalMatrix(p.m);
    const flip = p.m.determinant() < 0, n = pa.count;
    for (let i = 0; i < n; i++) {
      let src = i;
      if (flip) { const k = i % 3; if (k === 1) src = i + 1; else if (k === 2) src = i - 1; }
      _v.fromBufferAttribute(pa, src).applyMatrix4(p.m);
      pos[o * 3] = _v.x; pos[o * 3 + 1] = _v.y; pos[o * 3 + 2] = _v.z;
      _n.fromBufferAttribute(na, src).applyMatrix3(_nm).normalize();
      nor[o * 3] = _n.x; nor[o * 3 + 1] = _n.y; nor[o * 3 + 2] = _n.z;
      if (colr && p.c) { colr[o * 3] = p.c.r; colr[o * 3 + 1] = p.c.g; colr[o * 3 + 2] = p.c.b; }
      if (uvs && ua) { uvs[o * 2] = ua.getX(src); uvs[o * 2 + 1] = ua.getY(src); }
      o++;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (colr) g.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  if (uvs) g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

// ───────────── painted signs (small canvases, cached) ─────────────

const texCache = new Map<string, THREE.MeshStandardMaterial>();
/** a cached material whose map is drawn once on a small canvas. Returns a plain material when there is no DOM. */
export function paintedMat(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.MeshStandardMaterial {
  let m = texCache.get(key);
  if (m) return m;
  if (typeof document === 'undefined') { m = mat(PAL.parchment, {}, true); texCache.set(key, m); return m; }
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  if (g) draw(g, w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.generateMipmaps = true;
  m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0, flatShading: true });
  texCache.set(key, m);
  return m;
}

const css = (hex: number) => '#' + hex.toString(16).padStart(6, '0');

/** Four parchment notices in one atlas (2x2 cells): decree, lost cat, to let, scribbled note. */
export function noticeAtlas(): THREE.MeshStandardMaterial {
  return paintedMat('notices', 256, 256, (g) => {
    const cell = (cx: number, cy: number, body: () => void) => {
      g.save(); g.translate(cx * 128, cy * 128);
      // vellum with darker deckled edge
      g.fillStyle = css(0xd9c9a0); g.fillRect(0, 0, 128, 128);
      g.fillStyle = css(PAL.parchment); g.fillRect(5, 4, 118, 120);
      g.strokeStyle = css(PAL.ink); g.fillStyle = css(PAL.ink); g.lineCap = 'round';
      body(); g.restore();
    };
    const lines = (y0: number, n: number, x0 = 16, x1 = 112, gap = 11) => {
      g.lineWidth = 3;
      for (let i = 0; i < n; i++) {
        const y = y0 + i * gap, end = x1 - ((i * 37) % 23);
        g.beginPath(); g.moveTo(x0, y);
        for (let x = x0; x < end; x += 6) g.lineTo(x + 3, y + ((x * 7 + i) % 3) - 1);
        g.stroke();
      }
    };
    // decree: a red heading, lines, a big wax seal
    cell(0, 0, () => {
      g.fillStyle = css(PAL.crimson); g.fillRect(18, 14, 92, 14);
      g.fillStyle = css(PAL.ink); lines(42, 5);
      g.fillStyle = css(PAL.crimson); g.beginPath(); g.arc(92, 104, 13, 0, Math.PI * 2); g.fill();
      g.fillStyle = css(0x7a1f1a); g.beginPath(); g.arc(92, 104, 7, 0, Math.PI * 2); g.fill();
      g.strokeStyle = css(PAL.crimson); g.lineWidth = 4; g.beginPath(); g.moveTo(86, 114); g.lineTo(80, 126); g.moveTo(98, 114); g.lineTo(104, 126); g.stroke();
    });
    // lost cat: a cat drawn by someone who loves it and cannot draw
    cell(1, 0, () => {
      g.lineWidth = 4;
      g.beginPath(); g.ellipse(58, 58, 26, 18, 0, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(88, 40, 13, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(79, 31); g.lineTo(80, 18); g.lineTo(88, 28); g.lineTo(96, 18); g.lineTo(97, 31); g.stroke();
      g.beginPath(); g.moveTo(33, 56); g.quadraticCurveTo(14, 50, 22, 30); g.stroke();
      for (const lx of [44, 54, 64, 74]) { g.beginPath(); g.moveTo(lx, 74); g.lineTo(lx, 86); g.stroke(); }
      g.fillRect(83, 37, 3, 3); g.fillRect(91, 37, 3, 3);
      g.fillStyle = css(PAL.crimson); g.font = 'bold 22px serif'; g.fillText('?', 104, 70);
      g.fillStyle = css(PAL.ink); lines(100, 2, 18, 110, 12);
    });
    // to let: a little house with a big arrow
    cell(0, 1, () => {
      g.lineWidth = 4;
      g.strokeRect(34, 44, 44, 34);
      g.beginPath(); g.moveTo(28, 46); g.lineTo(56, 20); g.lineTo(84, 46); g.stroke();
      g.fillRect(50, 60, 12, 18);
      g.fillStyle = css(PAL.lapis); g.fillRect(90, 30, 22, 8); g.beginPath(); g.moveTo(112, 22); g.lineTo(124, 34); g.lineTo(112, 46); g.fill();
      g.fillStyle = css(PAL.ink); lines(92, 3, 18, 108, 11);
    });
    // a long scribbled grievance
    cell(1, 1, () => { lines(16, 9, 14, 114, 11.5); g.fillStyle = css(PAL.ink); g.beginPath(); g.arc(100, 116, 4, 0, Math.PI * 2); g.fill(); });
  });
}
export const NOTICE_CELLS = {
  decree: GEO.quad.bind(null, 0, 0.5, 0.5, 1),
  cat: GEO.quad.bind(null, 0.5, 0.5, 1, 1),
  tolet: GEO.quad.bind(null, 0, 0, 0.5, 0.5),
  note: GEO.quad.bind(null, 0.5, 0, 1, 0.5),
} as const;

/** Tavern sign pictures: 0 tankard, 1 goose, 2 sleepy moon. One atlas, three cells across. */
export function tavernSignAtlas(): THREE.MeshStandardMaterial {
  return paintedMat('tavern-signs', 384, 128, (g) => {
    const grounds = [0x6a1f1a, 0x2f4a3a, 0x24345a];
    for (let i = 0; i < 3; i++) {
      g.save(); g.translate(i * 128, 0);
      g.fillStyle = css(grounds[i]); g.fillRect(0, 0, 128, 128);
      g.strokeStyle = css(PAL.gold); g.lineWidth = 7; g.strokeRect(7, 7, 114, 114);
      g.lineWidth = 2; g.strokeRect(15, 15, 98, 98);
      if (i === 0) {
        // tankard with a head of foam
        g.fillStyle = css(PAL.gold); g.fillRect(40, 44, 40, 54);
        g.strokeStyle = css(PAL.gold); g.lineWidth = 9; g.beginPath(); g.arc(82, 70, 14, -Math.PI / 2, Math.PI / 2); g.stroke();
        g.fillStyle = css(0xf2ead8);
        for (const [x, r] of [[44, 9], [56, 11], [69, 10], [78, 8]] as const) { g.beginPath(); g.arc(x, 44, r, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = css(PAL.goldDark); g.fillRect(40, 60, 40, 5); g.fillRect(40, 84, 40, 5);
      } else if (i === 1) {
        // a goose, unimpressed
        g.fillStyle = css(0xf2ead8);
        g.beginPath(); g.ellipse(58, 80, 30, 18, -0.15, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(74, 70); g.quadraticCurveTo(92, 60, 84, 36); g.lineTo(94, 36); g.quadraticCurveTo(104, 66, 82, 82); g.fill();
        g.beginPath(); g.arc(89, 34, 9, 0, Math.PI * 2); g.fill();
        g.fillStyle = css(PAL.warn); g.beginPath(); g.moveTo(96, 31); g.lineTo(110, 35); g.lineTo(96, 39); g.fill();
        g.fillRect(48, 96, 4, 12); g.fillRect(62, 96, 4, 12);
        g.fillStyle = css(PAL.ink); g.fillRect(89, 31, 3, 3);
      } else {
        // a crescent moon with a sleeping face
        g.fillStyle = css(0xf0dfa8); g.beginPath(); g.arc(64, 64, 38, 0, Math.PI * 2); g.fill();
        g.fillStyle = css(grounds[2]); g.beginPath(); g.arc(82, 54, 34, 0, Math.PI * 2); g.fill();
        g.strokeStyle = css(PAL.ink); g.lineWidth = 3; g.beginPath(); g.arc(44, 58, 6, 0.2, Math.PI - 0.2); g.stroke();
        g.fillStyle = css(PAL.gold);
        for (const [x, y] of [[96, 96], [104, 30], [86, 108]] as const) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
        g.font = 'bold 16px serif'; g.fillText('z', 92, 76); g.font = 'bold 12px serif'; g.fillText('z', 102, 64);
      }
      g.restore();
    }
  });
}
export const tavernCell = (i: number) => GEO.quad(i / 3, 0, (i + 1) / 3, 1);

/**
 * Hanging trade signs, two cells across: 0 crossed keys on crimson (the bailiff),
 * 1 a pair of scales on lapis (the counting house). Painted as a signwriter would:
 * a flat ground, a gilt rule, the emblem in gold with a dark keyline.
 */
export function tradeSignAtlas(): THREE.MeshStandardMaterial {
  return paintedMat('trade-signs', 256, 128, (g) => {
    const grounds = [0x7a2420, 0x2a3f6e];
    for (let i = 0; i < 2; i++) {
      g.save(); g.translate(i * 128, 0);
      g.fillStyle = css(grounds[i]); g.fillRect(0, 0, 128, 128);
      g.strokeStyle = css(PAL.gold); g.lineWidth = 6; g.strokeRect(6, 6, 116, 116);
      g.strokeStyle = css(PAL.goldDark); g.lineWidth = 2; g.strokeRect(14, 14, 100, 100);
      g.lineCap = 'round'; g.lineJoin = 'round';
      const stroke = (w: number, draw: () => void) => {
        g.strokeStyle = css(0x2a1d14); g.lineWidth = w + 5; g.beginPath(); draw(); g.stroke();
        g.strokeStyle = css(PAL.gold); g.lineWidth = w; g.beginPath(); draw(); g.stroke();
      };
      if (i === 0) {
        // two keys crossed, bows at the top, bits at the bottom
        for (const s of [-1, 1]) {
          g.save(); g.translate(64, 64); g.rotate(s * 0.62);
          stroke(7, () => { g.moveTo(0, -22); g.lineTo(0, 40); });
          stroke(6, () => { g.arc(0, -33, 11, 0, Math.PI * 2); });
          stroke(6, () => { g.moveTo(0, 28); g.lineTo(12, 28); g.moveTo(0, 38); g.lineTo(14, 38); g.lineTo(14, 30); });
          g.restore();
        }
      } else {
        // a balance: post, beam, two pans on cords, a little finial
        stroke(6, () => { g.moveTo(64, 30); g.lineTo(64, 98); g.moveTo(46, 100); g.lineTo(82, 100); });
        stroke(6, () => { g.moveTo(26, 40); g.lineTo(102, 40); });
        for (const x of [32, 96]) {
          stroke(3, () => { g.moveTo(x - 6, 41); g.lineTo(x - 14, 72); g.moveTo(x + 6, 41); g.lineTo(x + 14, 72); });
          stroke(6, () => { g.moveTo(x - 18, 74); g.quadraticCurveTo(x, 90, x + 18, 74); g.closePath(); });
        }
        g.fillStyle = css(PAL.gold); g.beginPath(); g.arc(64, 26, 6, 0, Math.PI * 2); g.fill();
        g.fillStyle = css(PAL.goldDark);
        for (const [x, y] of [[90, 70], [98, 69], [94, 65]] as const) { g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill(); }
      }
      g.restore();
    }
  });
}
export const tradeSignCell = (i: number) => GEO.quad(i / 2, 0, (i + 1) / 2, 1);

/**
 * A soft pool of firelight: an additive radial gradient on its own material
 * (unique per building so each forge breathes on its own). Never casts or takes shadow.
 */
export function glowPool(color: number): THREE.MeshBasicMaterial {
  let tex = glowTex;
  if (!tex && typeof document !== 'undefined') {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    if (g) {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    }
    tex = glowTex = new THREE.CanvasTexture(cv);
  }
  const m = new THREE.MeshBasicMaterial({ color, map: tex, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  m.userData.noShadow = true;
  return m;
}
let glowTex: THREE.CanvasTexture | null = null;

/** thin strips across a roof slope so tiles and slates read as courses */
export function roofCourses(K: Kit, p: Paint, o: { x?: number; y: number; z?: number; span: number; len: number; rise: number; t?: number; over?: number; ends?: number; axis?: 'x' | 'z'; n?: number }): void {
  const t = o.t ?? 0.06, over = o.over ?? 0.12, ends = o.ends ?? 0.1, n = o.n ?? 3, x = o.x ?? 0, z = o.z ?? 0;
  const hs = o.span / 2, k = o.rise / hs, tv = t * Math.sqrt(1 + k * k), a = Math.atan(k), L = o.len + ends * 2 - 0.02;
  for (let i = 0; i < n; i++) {
    const f = (i + 0.55) / (n + 0.35);
    const s = (hs + over) * (1 - f);
    const y = o.y + o.rise + tv - k * s + 0.006;
    for (const sg of [-1, 1]) {
      if ((o.axis ?? 'x') === 'x') K.box(p, L, 0.016, 0.045, x, y, z + sg * s, [sg * a, 0, 0]);
      else K.box(p, 0.045, 0.016, L, x + sg * s, y, z, [0, 0, -sg * a]);
    }
  }
}

// ───────────── shared yard clutter ─────────────

export function barrel(K: Kit, x: number, y: number, z: number, s = 1, lying = false, ry = 0, c: number = PAL.timberLight): void {
  const h = 0.2 * s, r = 0.075 * s;
  const rot: Rot = lying ? [0, ry, Math.PI / 2] : ry;
  K.add(c, GEO.barrel(), r * 2, h, r * 2, x, y + (lying ? r : h / 2), z, rot);
  for (const v of [-0.3, 0.3]) {
    if (lying) {
      const dx = Math.cos(ry) * v * h, dz = -Math.sin(ry) * v * h;
      K.add(PAL.iron, GEO.cyl(9), r * 1.92, 0.012 * s, r * 1.92, x + dx, y + r, z + dz, [0, ry, Math.PI / 2]);
    } else K.cyl(PAL.iron, r * 0.97, 0.012 * s, x, y + h / 2 + v * h, z, 9);
  }
  if (!lying) K.cyl(PAL.timber, r * 0.78, 0.006, x, y + h + 0.002, z, 9);
}
export function crate(K: Kit, x: number, y: number, z: number, w: number, h: number, d: number, ry = 0, c: number = PAL.timberLight): void {
  K.box(c, w, h, d, x, y + h / 2, z, ry);
  const dark = PAL.timber, cs = Math.cos(ry), sn = Math.sin(ry);
  for (const sgn of [-1, 1]) {
    // a darker band round the rim and down the corners
    K.box(dark, w + 0.008, 0.016, d + 0.008, x, y + (sgn > 0 ? h - 0.008 : 0.008), z, ry);
    const ox = sgn * (w / 2), oz = d / 2;
    K.box(dark, 0.016, h, 0.016, x + ox * cs + oz * sn, y + h / 2, z - ox * sn + oz * cs, ry);
    K.box(dark, 0.016, h, 0.016, x + ox * cs - oz * sn, y + h / 2, z - ox * sn - oz * cs, ry);
  }
}
export function sack(K: Kit, x: number, y: number, z: number, s = 1, ry = 0, c: number = C.sack, lean = 0): void {
  K.cylT(c, 0.05 * s, 0.065 * s, 0.13 * s, x, y + 0.065 * s, z, 7, [lean, ry, 0]);
  K.blob(c, 0.12 * s, 0.07 * s, 0.11 * s, x, y + 0.125 * s, z, ry);
  K.cyl(C.rope, 0.022 * s, 0.02 * s, x, y + 0.16 * s, z, 6);
  K.cone(c, 0.03 * s, 0.05 * s, x, y + 0.19 * s, z, 5);
}
/** a pyramid stack of logs, axis along x before yaw */
export function logs(K: Kit, x: number, y: number, z: number, rows: number, len: number, r: number, ry = 0): void {
  const cs = Math.cos(ry), sn = Math.sin(ry);
  for (let row = 0; row < rows; row++) {
    const n = rows - row;
    for (let i = 0; i < n; i++) {
      const lz = (i - (n - 1) / 2) * r * 2.02, ly = y + r + row * r * 1.75;
      const lx = K.j(0.02);
      K.add(i % 2 ? PAL.trunk : C.leather, GEO.cyl(6), r * 2, len, r * 2, x + lx * cs + lz * sn, ly, z - lx * sn + lz * cs, [0, ry, Math.PI / 2]);
      K.add(C.wattleLight, GEO.cyl(6), r * 1.6, 0.004, r * 1.6, x + (lx + len / 2) * cs + lz * sn, ly, z - (lx + len / 2) * sn + lz * cs, [0, ry, Math.PI / 2]);
    }
  }
}
export function bench(K: Kit, x: number, z: number, len: number, ry = 0, c: number = PAL.timberLight): void {
  const cs = Math.cos(ry), sn = Math.sin(ry);
  K.box(c, len, 0.025, 0.08, x, 0.13, z, ry);
  for (const u of [-len / 2 + 0.05, len / 2 - 0.05]) K.box(PAL.timber, 0.03, 0.12, 0.07, x + u * cs, 0.06, z - u * sn, ry);
}
/** striped pennants hanging along a line (valance); points down from y */
export function valance(K: Kit, x0: number, x1: number, y: number, z: number, colours: readonly number[], n: number, size = 0.07, role: Role = 'roof'): void {
  const step = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const c = colours[i % colours.length];
    const p: Paint = role === 'detail' ? c : { c, role };
    K.add(p, GEO.tri(), 0.012, size, step * 0.98, x0 + step * (i + 0.5), y, z, [Math.PI, Math.PI / 2, 0]);
  }
}
export function flowers(K: Kit, x: number, y: number, z: number, n: number, spread: number, colours: readonly number[]): void {
  for (let i = 0; i < n; i++) {
    const fx = x + K.j(spread), fz = z + K.j(spread * 0.6);
    K.ball(C.leaf, 0.022, fx, y + 0.015, fz, 0, 0.7);
    K.ball(colours[i % colours.length], 0.016, fx + K.j(0.006), y + 0.04, fz, 0);
  }
}
