/**
 * The carving kit. Every building body is whittled out of these primitives into
 * a handful of vertex-coloured meshes (walls, roof, trim, one pane-set per unit),
 * so a whole house costs four or five draw calls instead of sixty.
 *
 * Local space as in render/api.ts: footprint centred on the origin, w along +x,
 * h along +z, door on the +z side, ground at y = 0. Features (doors, windows,
 * frames) are authored on the plane z = 0 facing +z and placed with `s.at()`.
 */
import * as THREE from 'three';
import { PAL, mat } from '../palette';
import type { BuildingVisual, Env } from '../api';
import type { BuiltBody } from './types';

// ───────────────────────── seeded randomness ─────────────────────────

export interface Rng {
  (): number;
  range(a: number, b: number): number;
  int(a: number, b: number): number;
  pick<T>(a: readonly T[]): T;
  chance(p: number): boolean;
  sign(): number;
}
export function makeRng(seed: number): Rng {
  let t = ((seed | 0) ^ 0x9e3779b9) | 0;
  const f = (() => {
    t = (t + 0x6d2b79f5) | 0;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }) as Rng;
  f.range = (a, b) => a + (b - a) * f();
  f.int = (a, b) => a + Math.floor(f() * (b - a + 1));
  f.pick = a => a[Math.floor(f() * a.length) % a.length];
  f.chance = p => f() < p;
  f.sign = () => (f() < 0.5 ? -1 : 1);
  // warm it up so nearby seeds diverge at once
  f(); f();
  return f;
}
/** stateless hash → 0..1 (for jitter that must agree between duplicated vertices) */
export function hash3(x: number, y: number, z: number, seed = 0): number {
  let h = (Math.round(x * 997) * 374761393 + Math.round(y * 997) * 668265263 + Math.round(z * 997) * 2147483647 + seed * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ───────────────────────── shared materials ─────────────────────────

/** The one material nearly everything wears: white, flat, tinted per vertex. */
export const paintMat = (): THREE.MeshStandardMaterial => mat(0xffffff, { vertexColors: true });
/** An unlit pane: dark, a little glossy. */
export const paneMat = (): THREE.MeshStandardMaterial => mat(PAL.window, { rough: 0.35 });

export type V3 = readonly [number, number, number];
export interface WindowInfo { pos: THREE.Vector3; normal: THREE.Vector3; w: number; h: number; unit: number }

interface Buf { p: number[]; c: number[]; cells: number[] }

const _c = new THREE.Color();
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _t = new THREE.Vector3();

let icoCache: Map<number, Float32Array> | null = null;
function icoPositions(detail: number): Float32Array {
  icoCache ??= new Map();
  let p = icoCache.get(detail);
  if (!p) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    p = (g.getAttribute('position').array as Float32Array).slice();
    g.dispose();
    icoCache.set(detail, p);
  }
  return p;
}

/**
 * Accumulates coloured triangles into named buckets under a transform stack,
 * then bakes each bucket into one BufferGeometry.
 */
export class Sculpt {
  readonly rand: Rng;
  /** per-part lightness wobble: the hand that painted it was not a machine */
  jit = 0.05;
  windows: WindowInfo[] = [];
  private bufs = new Map<string, Buf>();
  private m = new THREE.Matrix4();
  private stack: THREE.Matrix4[] = [];
  private neg = false;
  private rgb: [number, number, number] = [1, 1, 1];

  constructor(seed: number) { this.rand = makeRng(seed); }

  // ── transforms ──
  push(): this { this.stack.push(this.m.clone()); return this; }
  pop(): this { const m = this.stack.pop(); if (m) { this.m.copy(m); this.neg = this.m.determinant() < 0; } return this; }
  private mul(o: THREE.Matrix4): this { this.m.multiply(o); this.neg = this.m.determinant() < 0; return this; }
  translate(x: number, y: number, z: number): this { return this.mul(_m.makeTranslation(x, y, z)); }
  rotY(a: number): this { return this.mul(_m.makeRotationY(a)); }
  rotX(a: number): this { return this.mul(_m.makeRotationX(a)); }
  rotZ(a: number): this { return this.mul(_m.makeRotationZ(a)); }
  scale(x: number, y: number, z: number): this { return this.mul(_m.makeScale(x, y, z)); }
  /** shear: x += kx * y, z += kz * y (a wall that has settled) */
  shear(kx: number, kz: number): this { _m.identity(); _m.elements[4] = kx; _m.elements[6] = kz; return this.mul(_m); }
  /** run `fn` in a frame moved to (x, y, z) and turned ry about y (then rx, rz) */
  at(x: number, y: number, z: number, ry: number, fn: () => void, rx = 0, rz = 0): this {
    this.push();
    _e.set(rx, ry, rz, 'YXZ');
    _m.compose(_t.set(x, y, z), _q.setFromEuler(_e), _s.set(1, 1, 1));
    this.mul(_m);
    fn();
    return this.pop();
  }
  /** a local point in body space */
  point(x: number, y: number, z: number): THREE.Vector3 { return new THREE.Vector3(x, y, z).applyMatrix4(this.m); }
  /** a local direction in body space */
  dir(x: number, y: number, z: number): THREE.Vector3 { return new THREE.Vector3(x, y, z).transformDirection(this.m); }

  // ── colour ──
  private buf(b: string): Buf {
    let o = this.bufs.get(b);
    if (!o) { o = { p: [], c: [], cells: [] }; this.bufs.set(b, o); }
    return o;
  }
  /** set the working colour (linear), with a small painted wobble */
  private ink(hex: number, jit = this.jit): void {
    _c.setHex(hex);
    const d = jit > 0 ? (this.rand() - 0.5) * 2 * jit : 0;
    const w = jit > 0 ? (this.rand() - 0.5) * jit * 0.5 : 0;
    this.rgb[0] = Math.min(1, Math.max(0, _c.r * (1 + d + w)));
    this.rgb[1] = Math.min(1, Math.max(0, _c.g * (1 + d)));
    this.rgb[2] = Math.min(1, Math.max(0, _c.b * (1 + d - w)));
  }
  private vtx(o: Buf, x: number, y: number, z: number): void {
    _v.set(x, y, z).applyMatrix4(this.m);
    o.p.push(_v.x, _v.y, _v.z);
    o.c.push(this.rgb[0], this.rgb[1], this.rgb[2]);
  }
  private rawTri(o: Buf, a: V3, b: V3, c: V3): void {
    if (this.neg) { const t = b; b = c; c = t; }
    this.vtx(o, a[0], a[1], a[2]); this.vtx(o, b[0], b[1], b[2]); this.vtx(o, c[0], c[1], c[2]);
  }

  // ── raw faces ──
  /** one triangle, counter-clockwise seen from outside */
  tri(b: string, hex: number, p0: V3, p1: V3, p2: V3, jit?: number): this {
    const o = this.buf(b); this.ink(hex, jit);
    this.rawTri(o, p0, p1, p2); o.cells.push(o.p.length / 3);
    return this;
  }
  /** one quad, counter-clockwise seen from outside */
  quad(b: string, hex: number, p0: V3, p1: V3, p2: V3, p3: V3, jit?: number): this {
    const o = this.buf(b); this.ink(hex, jit);
    this.rawTri(o, p0, p1, p2); this.rawTri(o, p0, p2, p3); o.cells.push(o.p.length / 3);
    return this;
  }
  /** a quad wound so that it faces the direction (ox, oy, oz), whatever order the corners came in */
  quadTo(b: string, hex: number, p0: V3, p1: V3, p2: V3, p3: V3, ox: number, oy: number, oz: number, jit?: number): this {
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    const vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    return nx * ox + ny * oy + nz * oz >= 0 ? this.quad(b, hex, p0, p1, p2, p3, jit) : this.quad(b, hex, p0, p3, p2, p1, jit);
  }
  triTo(b: string, hex: number, p0: V3, p1: V3, p2: V3, ox: number, oy: number, oz: number, jit?: number): this {
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    const vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    return nx * ox + ny * oy + nz * oz >= 0 ? this.tri(b, hex, p0, p1, p2, jit) : this.tri(b, hex, p0, p2, p1, jit);
  }
  /** a convex polygon as a fan (one colour, one cell) */
  poly(b: string, hex: number, pts: readonly V3[], jit?: number): this {
    const o = this.buf(b); this.ink(hex, jit);
    for (let i = 1; i < pts.length - 1; i++) this.rawTri(o, pts[0], pts[i], pts[i + 1]);
    o.cells.push(o.p.length / 3);
    return this;
  }

  // ── solids ──
  /**
   * A block standing on y: bottom w × d centred on (x, z), top tw × td shifted by (sx, sz).
   * One colour, one cell. `ry` turns it about its own vertical axis.
   */
  block(b: string, hex: number, x: number, y: number, z: number, w: number, h: number, d: number,
    o: { tw?: number; td?: number; sx?: number; sz?: number; ry?: number; bottom?: boolean; jit?: number } = {}): this {
    const tw = (o.tw ?? w) / 2, td = (o.td ?? d) / 2, sx = o.sx ?? 0, sz = o.sz ?? 0, hw = w / 2, hd = d / 2;
    const run = () => {
      const buf = this.buf(b); this.ink(hex, o.jit);
      const a0: V3 = [-hw, 0, hd], a1: V3 = [hw, 0, hd], a2: V3 = [hw, 0, -hd], a3: V3 = [-hw, 0, -hd];
      const t0: V3 = [sx - tw, h, sz + td], t1: V3 = [sx + tw, h, sz + td], t2: V3 = [sx + tw, h, sz - td], t3: V3 = [sx - tw, h, sz - td];
      const q = (p0: V3, p1: V3, p2: V3, p3: V3) => { this.rawTri(buf, p0, p1, p2); this.rawTri(buf, p0, p2, p3); };
      q(a0, a1, t1, t0); q(a1, a2, t2, t1); q(a2, a3, t3, t2); q(a3, a0, t0, t3); q(t0, t1, t2, t3);
      if (o.bottom ?? y > 0.002) q(a3, a2, a1, a0);
      buf.cells.push(buf.p.length / 3);
    };
    return this.at(x, y, z, o.ry ?? 0, run);
  }
  /**
   * A squared timber from A to B. `t` is its thickness along the horizontal perpendicular (for a
   * beam lying on a wall, that is the depth out of the wall); `d` is its other thickness (the
   * width you see on the wall). d defaults to t.
   */
  beam(b: string, hex: number, A: V3, B: V3, t: number, d = t, jit?: number): this {
    const dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2];
    const len = Math.hypot(dx, dy, dz) || 1e-6;
    const ax = dx / len, ay = dy / len, az = dz / len;
    // side = dir × up (or × x when the beam is vertical)
    let sx: number, sy: number, sz: number;
    if (Math.abs(ay) > 0.98) { sx = 0; sy = az; sz = -ay; } else { sx = -az; sy = 0; sz = ax; }
    const sl = Math.hypot(sx, sy, sz); sx /= sl; sy /= sl; sz /= sl;
    const ux = sy * az - sz * ay, uy = sz * ax - sx * az, uz = sx * ay - sy * ax;
    const hs = t / 2, hu = d / 2;
    const c = (P: V3, i: number, j: number): V3 => [P[0] + sx * hs * i + ux * hu * j, P[1] + sy * hs * i + uy * hu * j, P[2] + sz * hs * i + uz * hu * j];
    const a = [c(A, -1, -1), c(A, 1, -1), c(A, 1, 1), c(A, -1, 1)], e = [c(B, -1, -1), c(B, 1, -1), c(B, 1, 1), c(B, -1, 1)];
    const buf = this.buf(b); this.ink(hex, jit);
    const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, mz = (A[2] + B[2]) / 2;
    const q = (p0: V3, p1: V3, p2: V3, p3: V3) => {
      // wind away from the beam's middle
      const cx = (p0[0] + p2[0]) / 2 - mx, cy = (p0[1] + p2[1]) / 2 - my, cz = (p0[2] + p2[2]) / 2 - mz;
      const u0 = p1[0] - p0[0], u1 = p1[1] - p0[1], u2 = p1[2] - p0[2], v0 = p3[0] - p0[0], v1 = p3[1] - p0[1], v2 = p3[2] - p0[2];
      const n0 = u1 * v2 - u2 * v1, n1 = u2 * v0 - u0 * v2, n2 = u0 * v1 - u1 * v0;
      if (n0 * cx + n1 * cy + n2 * cz >= 0) { this.rawTri(buf, p0, p1, p2); this.rawTri(buf, p0, p2, p3); }
      else { this.rawTri(buf, p0, p3, p2); this.rawTri(buf, p0, p2, p1); }
    };
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; q(a[i], a[j], e[j], e[i]); }
    q(a[0], a[1], a[2], a[3]); q(e[0], e[1], e[2], e[3]);
    buf.cells.push(buf.p.length / 3);
    return this;
  }
  /** an upright frustum: radius rb at y, rt at y + h, n sides; the top may be shifted (a bent tower) */
  cyl(b: string, hex: number, x: number, y: number, z: number, rb: number, rt: number, h: number, n: number,
    o: { sx?: number; sz?: number; cap?: boolean; bottom?: boolean; facets?: number; phase?: number; capHex?: number; jit?: number } = {}): this {
    const sx = o.sx ?? 0, sz = o.sz ?? 0, ph = o.phase ?? 0;
    const bot: V3[] = [], top: V3[] = [];
    for (let i = 0; i < n; i++) {
      const a = ph + (i / n) * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a);
      bot.push([x + cs * rb, y, z + sn * rb]); top.push([x + sx + cs * rt, y + h, z + sz + sn * rt]);
    }
    const buf = this.buf(b);
    if (o.facets) {
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; this.quad(b, hex, bot[j], bot[i], top[i], top[j], o.facets); }
    } else {
      this.ink(hex, o.jit);
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; this.rawTri(buf, bot[j], bot[i], top[i]); this.rawTri(buf, bot[j], top[i], top[j]); }
      buf.cells.push(buf.p.length / 3);
    }
    if (o.cap ?? true) this.poly(b, o.capHex ?? hex, top.slice().reverse(), o.jit);
    if (o.bottom) this.poly(b, hex, bot, o.jit);
    return this;
  }
  /** a cone: base radius r at y, tip at y + h (shifted by sx, sz) */
  cone(b: string, hex: number, x: number, y: number, z: number, r: number, h: number, n: number,
    o: { sx?: number; sz?: number; bottom?: boolean; facets?: number; phase?: number; jit?: number } = {}): this {
    const tip: V3 = [x + (o.sx ?? 0), y + h, z + (o.sz ?? 0)], ph = o.phase ?? 0;
    const ring: V3[] = [];
    for (let i = 0; i < n; i++) { const a = ph + (i / n) * Math.PI * 2; ring.push([x + Math.cos(a) * r, y, z + Math.sin(a) * r]); }
    const buf = this.buf(b);
    if (o.facets) for (let i = 0; i < n; i++) this.tri(b, hex, ring[(i + 1) % n], ring[i], tip, o.facets);
    else {
      this.ink(hex, o.jit);
      for (let i = 0; i < n; i++) this.rawTri(buf, ring[(i + 1) % n], ring[i], tip);
      buf.cells.push(buf.p.length / 3);
    }
    if (o.bottom) this.poly(b, hex, ring, o.jit);
    return this;
  }
  /**
   * A lumpy ball (icosahedron, detail 0..2) with radii (rx, ry, rz). `lump` wobbles each vertex,
   * `facets` wobbles each face's colour, `floor` flattens everything below that local height.
   */
  blob(b: string, hex: number, x: number, y: number, z: number, rx: number, ry: number, rz: number,
    o: { detail?: number; lump?: number; facets?: number; floor?: number; maxZ?: number; seed?: number; jit?: number } = {}): this {
    const src = icoPositions(o.detail ?? 1), lump = o.lump ?? 0, seed = o.seed ?? this.rand.int(0, 9999);
    const buf = this.buf(b); this.ink(hex, o.jit);
    const base: [number, number, number] = [this.rgb[0], this.rgb[1], this.rgb[2]];
    const P = (i: number): V3 => {
      const ux = src[i], uy = src[i + 1], uz = src[i + 2];
      const k = 1 + (hash3(ux, uy, uz, seed) - 0.5) * 2 * lump;
      let py = uy * ry * k;
      if (o.floor !== undefined && py < o.floor) py = o.floor;
      let pz = uz * rz * k;
      if (o.maxZ !== undefined && pz > o.maxZ) pz = o.maxZ;
      return [x + ux * rx * k, y + py, z + pz];
    };
    for (let i = 0; i < src.length; i += 9) {
      if (o.facets) {
        const f = 1 + (this.rand() - 0.5) * 2 * o.facets;
        this.rgb[0] = Math.min(1, base[0] * f); this.rgb[1] = Math.min(1, base[1] * f); this.rgb[2] = Math.min(1, base[2] * f);
      }
      this.rawTri(buf, P(i), P(i + 3), P(i + 6));
      if (o.facets) buf.cells.push(buf.p.length / 3);
    }
    if (!o.facets) buf.cells.push(buf.p.length / 3);
    return this;
  }

  // ── output ──
  has(b: string): boolean { const o = this.bufs.get(b); return !!o && o.p.length > 0; }
  buckets(): string[] { return [...this.bufs.keys()].filter(k => this.has(k)); }
  triangles(): number { let n = 0; for (const o of this.bufs.values()) n += o.p.length / 9; return n; }
  /** bake one bucket: position (float) + colour (16-bit, linear). `geometry.userData.cells` lists where each painted part ends. */
  bake(b: string): THREE.BufferGeometry | null {
    const o = this.bufs.get(b);
    if (!o || !o.p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(o.p), 3));
    const col = new Uint16Array(o.c.length);
    for (let i = 0; i < col.length; i++) col[i] = Math.round(Math.min(1, Math.max(0, o.c[i])) * 65535);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
    g.userData.cells = Uint32Array.from(o.cells);
    g.userData.owned = true;
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
  /** bake a bucket into a mesh wearing the shared paint (or a given material) */
  mesh(b: string, material?: THREE.Material): THREE.Mesh | null {
    const g = this.bake(b);
    if (!g) return null;
    const m = new THREE.Mesh(g, material ?? paintMat());
    m.name = b; m.castShadow = true; m.receiveShadow = true;
    return m;
  }
}

// ───────────────────────── roofs ─────────────────────────

export interface RoofStyle {
  rows: number; colEvery: number; step: number; thick: number; jag: number; bulge: number; wobble: number;
  colors: readonly number[]; rowDark: number; under: number; cap: number; capHex: number;
}
export const ROOF = {
  /** neat combed thatch */
  thatch: { rows: 3, colEvery: 0.2, step: 0.03, thick: 0.09, jag: 0.035, bulge: 0.035, wobble: 0.012, colors: [PAL.thatch, PAL.thatch, 0xd2ad55, 0xbd9644], rowDark: 0.07, under: 0x6f5a2c, cap: 0.07, capHex: 0xb38d3e },
  /** a hovel's shaggy heap */
  shag: { rows: 3, colEvery: 0.17, step: 0.04, thick: 0.11, jag: 0.085, bulge: 0.05, wobble: 0.028, colors: [PAL.thatch, PAL.thatchOld, 0xb0984f, 0xa88d48, 0xbfa050], rowDark: 0.1, under: 0x5f5030, cap: 0.06, capHex: PAL.thatchOld },
  tile: { rows: 6, colEvery: 0.15, step: 0.02, thick: 0.045, jag: 0, bulge: 0, wobble: 0, colors: [PAL.tile, PAL.tile, PAL.tileDark, 0xb24f34, 0x9c3f2a], rowDark: 0.03, under: 0x5a2a1e, cap: 0.045, capHex: PAL.tileDark },
  slate: { rows: 6, colEvery: 0.17, step: 0.014, thick: 0.035, jag: 0, bulge: 0, wobble: 0, colors: [PAL.slate, PAL.slate, PAL.slateDark, 0x65707d, 0x525b66], rowDark: 0.03, under: 0x30363d, cap: 0.035, capHex: PAL.slateDark },
  /** split wooden shingles (the treehouse, porches) */
  shingle: { rows: 4, colEvery: 0.13, step: 0.018, thick: 0.035, jag: 0.012, bulge: 0, wobble: 0.004, colors: [0x8a6a45, 0x7a5c3a, 0x96764e, PAL.timberLight], rowDark: 0.05, under: 0x3f2c1c, cap: 0.035, capHex: PAL.timber },
} satisfies Record<string, RoofStyle>;
export type RoofKind = keyof typeof ROOF;

const lerp3 = (a: V3, b: V3, t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const add3 = (a: V3, n: V3, k: number): [number, number, number] => [a[0] + n[0] * k, a[1] + n[1] * k, a[2] + n[2] * k];

/**
 * One roof slope laid in stepped courses between a ridge line (A → B) and an eave line (C → D),
 * C under A and D under B. Closed underneath so it throws a shadow.
 */
export function slope(s: Sculpt, A: V3, B: V3, C: V3, D: V3, st: RoofStyle,
  o: { bucket?: string; sag?: number; verge0?: boolean; verge1?: boolean; cols?: number; rows?: number; colors?: readonly number[]; under?: boolean } = {}): void {
  const b = o.bucket ?? 'roof';
  // outward normal must point up: swap the ends if not
  // (summing both edges keeps this sound when the ridge shrinks to a point, as on a hip end)
  let ux = B[0] - A[0] + D[0] - C[0], uy = B[1] - A[1] + D[1] - C[1], uz = B[2] - A[2] + D[2] - C[2];
  const vx = C[0] - A[0] + D[0] - B[0], vy = C[1] - A[1] + D[1] - B[1], vz = C[2] - A[2] + D[2] - B[2];
  let nx = vy * uz - vz * uy, ny = vz * ux - vx * uz, nz = vx * uy - vy * ux;
  if (ny < 0) { slope(s, B, A, D, C, st, { ...o, verge0: o.verge1, verge1: o.verge0 }); return; }
  const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
  const n: V3 = [nx, ny, nz];
  const ridgeLen = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), eaveLen = Math.hypot(D[0] - C[0], D[1] - C[1], D[2] - C[2]);
  const len = Math.max(ridgeLen, eaveLen);
  const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
  const run = Math.hypot(vx, vy, vz) / 2 || 1;
  const down: V3 = [vx / (2 * run), vy / (2 * run), vz / (2 * run)];
  const N = o.cols ?? Math.max(1, Math.round(len / st.colEvery));
  const K = o.rows ?? Math.max(1, Math.min(st.rows, Math.round(run / 0.13)));
  const sag = o.sag ?? 0;
  const colors = o.colors ?? st.colors;
  // grid of base points
  const G: [number, number, number][][] = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, col: [number, number, number][] = [];
    const jitU = i > 0 && i < N ? (s.rand() - 0.5) * st.wobble * 2 : 0;
    for (let k = 0; k <= K; k++) {
      const v = k / K;
      const p = lerp3(lerp3(A, B, u), lerp3(C, D, u), v);
      const bulge = st.bulge * Math.sin(Math.PI * v) + (k > 0 && k < K ? (s.rand() - 0.5) * st.wobble : 0);
      p[0] += n[0] * bulge + ux * jitU; p[1] += n[1] * bulge - sag * Math.sin(Math.PI * u) + uy * jitU; p[2] += n[2] * bulge + uz * jitU;
      if (k === K && st.jag > 0) { const e = s.rand() * st.jag; p[0] += down[0] * e; p[1] += down[1] * e - s.rand() * st.jag * 0.3; p[2] += down[2] * e; }
      col.push(p);
    }
    G.push(col);
  }
  const shade = (hex: number, k: number): number => {
    if (!st.rowDark) return hex;
    _c.setHex(hex).multiplyScalar(1 - st.rowDark * (k / Math.max(1, K - 1)));
    return _c.getHex();
  };
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < K; k++) {
      const U0 = G[i][k], U1 = G[i + 1][k];
      const L0 = add3(G[i][k + 1], n, st.step), L1 = add3(G[i + 1][k + 1], n, st.step);
      const hex = shade(colors[Math.floor(s.rand() * colors.length) % colors.length], k);
      s.quadTo(b, hex, L0, L1, U1, U0, nx, ny, nz, 0.05);
      if (k < K - 1) s.quadTo(b, st.under, G[i][k + 1], G[i + 1][k + 1], L1, L0, down[0], down[1], down[2], 0.04);
      else {
        const E0 = add3(G[i][K], n, -st.thick), E1 = add3(G[i + 1][K], n, -st.thick);
        s.quadTo(b, shade(hex, K + 1), E0, E1, L1, L0, down[0], down[1], down[2], 0.04);
      }
    }
  }
  // verges (the thick cut edge at each gable end)
  for (const [i, on, sgn] of [[0, o.verge0 ?? true, -1], [N, o.verge1 ?? true, 1]] as const) {
    if (!on) continue;
    for (let k = 0; k < K; k++) {
      const T0 = G[i][k], T1 = add3(G[i][k + 1], n, st.step);
      const B0 = add3(G[i][k], n, -st.thick), B1 = add3(G[i][k + 1], n, -st.thick);
      s.quadTo(b, shade(colors[0], k + 1), T0, T1, B1, B0, ux * sgn, uy * sgn, uz * sgn, 0.04);
    }
  }
  if (o.under ?? true) {
    const a0 = add3(G[0][0], n, -st.thick), a1 = add3(G[N][0], n, -st.thick), a2 = add3(G[N][K], n, -st.thick), a3 = add3(G[0][K], n, -st.thick);
    s.quadTo(b, st.under, a0, a1, a2, a3, -nx, -ny, -nz, 0);
  }
}

export interface GableOpts {
  /** ridge length including the overhang at both gable ends */
  len: number;
  /** half the wall depth the roof sits on */
  half: number;
  /** height of the wall top (the eave line passes through the wall's outer top edge) */
  wallTop: number;
  rise: number;
  /** horizontal eave overhang beyond the wall */
  ov: number;
  kind: RoofKind;
  sag?: number;
  /** ridge height difference between the two ends (a roof that has settled) */
  tilt?: number;
  colors?: readonly number[];
  /** back slope colours, when the two halves have been thatched by different hands */
  cap?: boolean;
  bucket?: string;
  /** skip the back slope (dormers, lean-tos) */
  frontOnly?: boolean;
}
/** A gable roof with its ridge along local x, centred on the origin. Returns the ridge height. */
export function gableRoof(s: Sculpt, g: GableOpts): number {
  const st = ROOF[g.kind] as RoofStyle, b = g.bucket ?? 'roof';
  const ridgeY = g.wallTop + g.rise, k = g.rise / g.half;
  const eaveY = g.wallTop - g.ov * k, eaveZ = g.half + g.ov, hl = g.len / 2, tl = (g.tilt ?? 0) / 2;
  const A: V3 = [-hl, ridgeY - tl, 0], B: V3 = [hl, ridgeY + tl, 0];
  slope(s, A, B, [-hl, eaveY - tl, eaveZ], [hl, eaveY + tl, eaveZ], st, { bucket: b, sag: g.sag, colors: g.colors });
  if (!g.frontOnly) slope(s, A, B, [-hl, eaveY - tl, -eaveZ], [hl, eaveY + tl, -eaveZ], st, { bucket: b, sag: g.sag, colors: g.colors });
  if (g.cap ?? true) {
    // ridge roll: a short inverted V riding the ridge
    const N = Math.max(2, Math.round(g.len / (st.colEvery * 1.3))), capV = Math.min(0.3, 0.16 / Math.hypot(eaveZ, ridgeY - eaveY));
    const sag = g.sag ?? 0, lift = st.step + 0.012;
    const nl = Math.hypot(eaveZ, ridgeY - eaveY), ny = eaveZ / nl, nz = (ridgeY - eaveY) / nl;
    const at = (u: number, side: number, v: number, up: number): V3 => {
      const x = -hl + g.len * u, y0 = ridgeY + (u - 0.5) * 2 * tl - sag * Math.sin(Math.PI * u);
      return [x, y0 - v * (ridgeY - eaveY) + ny * up, side * (v * eaveZ + nz * up)];
    };
    for (let i = 0; i < N; i++) {
      const u0 = i / N, u1 = (i + 1) / N;
      const long = g.kind === 'thatch' || g.kind === 'shag' ? (i % 2 ? 1.25 : 0.85) : 1;
      const p0 = at(u0, 1, 0, st.cap), p1 = at(u1, 1, 0, st.cap);
      for (const side of [1, -1]) {
        if (g.frontOnly && side < 0) continue;
        const q0 = at(u0, side, capV * long, lift), q1 = at(u1, side, capV * long, lift);
        s.quadTo(b, st.capHex, q0, q1, [p1[0], p1[1], 0], [p0[0], p0[1], 0], 0, ny, nz * side, 0.05);
        s.quadTo(b, st.under, at(u0, side, capV * long, 0), at(u1, side, capV * long, 0), q1, q0, 0, -nz, ny * side, 0.03);
      }
    }
    // end stops
    for (const [u, sg] of [[0, -1], [1, 1]] as const) {
      const p = at(u, 1, 0, st.cap), qa = at(u, 1, capV, lift), qb = at(u, -1, capV, lift), base = at(u, 1, 0, -0.01);
      s.triTo(b, st.capHex, [p[0], p[1], 0], qa, [base[0], base[1], 0], sg, 0, 0, 0.03);
      if (!g.frontOnly) s.triTo(b, st.capHex, [p[0], p[1], 0], qb, [base[0], base[1], 0], sg, 0, 0, 0.03);
    }
  }
  return ridgeY;
}

/** A conical roof in stepped bands (towers, turrets). Tip may lean. Returns tip height. */
export function coneRoof(s: Sculpt, x: number, y: number, z: number, r: number, h: number, n: number, kind: RoofKind,
  o: { bands?: number; tipX?: number; tipZ?: number; colors?: readonly number[]; bucket?: string; flare?: number } = {}): number {
  const st = ROOF[kind] as RoofStyle, b = o.bucket ?? 'roof', bands = o.bands ?? 4, colors = o.colors ?? st.colors;
  const tipX = o.tipX ?? 0, tipZ = o.tipZ ?? 0, flare = o.flare ?? 0.12;
  // radius profile: a slight witch-hat flare at the brim
  const R = (t: number) => r * (1 - t) * (1 + flare * (1 - t) * (1 - t));
  const C = (t: number): [number, number] => [x + tipX * t * t, z + tipZ * t * t];
  for (let k = 0; k < bands; k++) {
    const t0 = k / bands, t1 = (k + 1) / bands;
    const [x0, z0] = C(t0), [x1, z1] = C(t1);
    const r0 = R(t0) + (k > 0 ? st.step * 1.6 : 0), r1 = R(t1), y0 = y + h * t0, y1 = y + h * t1;
    const ph = (k % 2) * (Math.PI / n);
    for (let i = 0; i < n; i++) {
      const a0 = ph + (i / n) * Math.PI * 2, a1 = ph + ((i + 1) / n) * Math.PI * 2;
      const hex = colors[Math.floor(s.rand() * colors.length) % colors.length];
      const b0: V3 = [x0 + Math.cos(a0) * r0, y0, z0 + Math.sin(a0) * r0], b1: V3 = [x0 + Math.cos(a1) * r0, y0, z0 + Math.sin(a1) * r0];
      if (k === bands - 1) s.tri(b, hex, b1, b0, [x1, y1, z1], 0.05);
      else {
        const t0p: V3 = [x1 + Math.cos(a0) * r1, y1, z1 + Math.sin(a0) * r1], t1p: V3 = [x1 + Math.cos(a1) * r1, y1, z1 + Math.sin(a1) * r1];
        s.quad(b, hex, b1, b0, t0p, t1p, 0.05);
      }
    }
    // the underside of each band's brim, so the steps read and the cone is closed
    const ring: V3[] = [];
    for (let i = 0; i < n; i++) { const a = ph + (i / n) * Math.PI * 2; ring.push([x0 + Math.cos(a) * r0, y0 - 0.001, z0 + Math.sin(a) * r0]); }
    s.poly(b, st.under, ring, 0);
  }
  return y + h;
}

// ───────────────────────── walls and their furniture ─────────────────────────

/** A triangular gable end on the plane z = 0 facing +z: base w at y = 0, apex at h. */
export function gableFace(s: Sculpt, w: number, h: number, hex: number, bucket = 'wall', apexX = 0): void {
  s.tri(bucket, hex, [-w / 2, 0, 0], [w / 2, 0, 0], [apexX, h, 0]);
}

export interface FrameOpts { t?: number; proud?: number; hex?: number; posts?: number; rails?: readonly number[]; brace?: 'none' | 'corner' | 'cross' | 'chevron'; sill?: boolean; plate?: boolean; bucket?: string }
/** Timber framing on a wall face w × h (plane z = 0, facing +z, base at y = 0). */
export function frameFace(s: Sculpt, w: number, h: number, o: FrameOpts = {}): void {
  const t = o.t ?? 0.07, pr = o.proud ?? 0.022, hex = o.hex ?? PAL.timber, b = o.bucket ?? 'trim';
  const d = pr + 0.03, zc = pr - d / 2, posts = Math.max(2, o.posts ?? 2);
  const bar = (x0: number, y0: number, x1: number, y1: number, tt = t) => s.beam(b, hex, [x0, y0, zc], [x1, y1, zc], d, tt);
  const xs: number[] = [];
  for (let i = 0; i < posts; i++) xs.push(-w / 2 + t / 2 + (w - t) * (i / (posts - 1)));
  for (const x of xs) bar(x, 0, x + (s.rand() - 0.5) * 0.012, h);
  if (o.plate ?? true) bar(-w / 2, h - t / 2, w / 2, h - t / 2);
  if (o.sill ?? true) bar(-w / 2, t / 2, w / 2, t / 2);
  for (const r of o.rails ?? []) bar(-w / 2, h * r, w / 2, h * r + (s.rand() - 0.5) * 0.01, t * 0.85);
  const br = o.brace ?? 'none';
  if (br !== 'none') {
    const top = h - t, bay = xs[1] - xs[0];
    const reach = Math.min(bay - t, top * 0.8);
    if (br === 'corner' || br === 'cross') {
      bar(xs[0] + t / 2, top - reach * 0.9, xs[0] + t / 2 + reach, top, t * 0.75);
      bar(xs[posts - 1] - t / 2, top - reach * 0.9, xs[posts - 1] - t / 2 - reach, top, t * 0.75);
    }
    if (br === 'cross') {
      bar(xs[0] + t / 2, t + reach * 0.9, xs[0] + t / 2 + reach, t, t * 0.75);
      bar(xs[posts - 1] - t / 2, t + reach * 0.9, xs[posts - 1] - t / 2 - reach, t, t * 0.75);
    }
    if (br === 'chevron') for (let i = 0; i < posts - 1; i++) { const m = (xs[i] + xs[i + 1]) / 2; bar(xs[i] + t / 2, t, m, top, t * 0.7); bar(xs[i + 1] - t / 2, t, m, top, t * 0.7); }
  }
}
/** Framing for a gable triangle: rafters along the edges, a king post, a collar. */
export function frameGable(s: Sculpt, w: number, h: number, o: { t?: number; proud?: number; hex?: number; collar?: boolean; king?: boolean; bucket?: string } = {}): void {
  const t = o.t ?? 0.065, pr = o.proud ?? 0.022, hex = o.hex ?? PAL.timber, b = o.bucket ?? 'trim', d = pr + 0.03, zc = pr - d / 2;
  const inset = t * 0.55;
  s.beam(b, hex, [-w / 2 + inset, 0, zc], [0, h - inset, zc], d, t);
  s.beam(b, hex, [w / 2 - inset, 0, zc], [0, h - inset, zc], d, t);
  if (o.king ?? true) s.beam(b, hex, [0, 0, zc], [0, h - inset, zc], d, t * 0.9);
  if (o.collar) s.beam(b, hex, [-w * 0.24, h * 0.5, zc], [w * 0.24, h * 0.5, zc], d, t * 0.8);
}

/** Scattered proud stones on a wall face (rubble work showing through). */
export function stones(s: Sculpt, w: number, h: number, n: number, colors: readonly number[], bucket = 'wall'): void {
  const rowH = 0.1, rows = Math.max(1, Math.floor(h / rowH));
  for (let i = 0; i < n; i++) {
    const r = s.rand.int(0, rows - 1), sw = s.rand.range(0.11, 0.2), sh = rowH * s.rand.range(0.7, 0.92);
    const x = s.rand.range(-w / 2 + sw / 2 + 0.01, w / 2 - sw / 2 - 0.01), y = r * rowH + (rowH - sh) / 2 + 0.005;
    const z = 0.006 + s.rand() * 0.008;
    s.quad(bucket, s.rand.pick(colors), [x - sw / 2, y, z], [x + sw / 2, y, z], [x + sw / 2, y + sh, z], [x - sw / 2, y + sh, z], 0.06);
  }
}
/** Irregular patches a shade off the wall (lumpy daub, old repairs). */
export function patches(s: Sculpt, w: number, h: number, n: number, colors: readonly number[], bucket = 'wall'): void {
  for (let i = 0; i < n; i++) {
    const pw = s.rand.range(0.12, 0.28), ph = s.rand.range(0.08, 0.2);
    const x = s.rand.range(-w / 2 + pw / 2 + 0.02, w / 2 - pw / 2 - 0.02), y = s.rand.range(0.03, Math.max(0.04, h - ph - 0.03)), z = 0.004 + s.rand() * 0.004;
    const j = () => (s.rand() - 0.5) * 0.05;
    s.quad(bucket, s.rand.pick(colors), [x - pw / 2 + j(), y + j() * 0.5, z], [x + pw / 2 + j(), y + j() * 0.5, z], [x + pw / 2 + j(), y + ph + j() * 0.5, z], [x - pw / 2 + j(), y + ph + j() * 0.5, z], 0.04);
  }
}
/** Fitted courses covering a wall face: every block its own tone, dark joints between. */
export function ashlar(s: Sculpt, w: number, h: number, o: { rowH?: number; minW?: number; maxW?: number; colors: readonly number[]; gap?: number; bucket?: string; slopeZ?: number }): void {
  const rowH = o.rowH ?? 0.14, gap = o.gap ?? 0.014, b = o.bucket ?? 'wall', rows = Math.max(1, Math.round(h / rowH)), rh = h / rows;
  const kz = o.slopeZ ?? 0; // wall batter: z recedes by kz per unit of height
  for (let r = 0; r < rows; r++) {
    let x = -w / 2 + gap / 2 - (r % 2 ? s.rand.range(0.05, 0.15) : 0);
    const y0 = r * rh + gap / 2, y1 = (r + 1) * rh - gap / 2;
    while (x < w / 2 - gap) {
      const bw = s.rand.range(o.minW ?? 0.2, o.maxW ?? 0.36), x0 = Math.max(x, -w / 2 + gap / 2), x1 = Math.min(x + bw, w / 2 - gap / 2);
      if (x1 - x0 > 0.04) {
        const z = 0.006 + s.rand() * 0.007;
        s.quad(b, s.rand.pick(o.colors), [x0, y0, z - kz * y0], [x1, y0, z - kz * y0], [x1, y1, z - kz * y1], [x0, y1, z - kz * y1], 0.05);
      }
      x += bw + gap;
    }
  }
}

export interface DoorOpts { w?: number; h?: number; hex: number; style?: 'plank' | 'banded' | 'round' | 'arch'; frame?: number; ajar?: number; step?: boolean; knob?: number }
/** A door on the plane z = 0 facing +z, centred on x = 0, sill at y = 0. */
export function door(s: Sculpt, o: DoorOpts): void {
  const w = o.w ?? 0.3, h = o.h ?? 0.5, style = o.style ?? 'plank', fr = o.frame ?? PAL.timber, t = 0.05;
  if (style === 'round') {
    // a round door: rim, leaf, a brass knob dead centre (as is proper)
    const r = w / 2, n = 12, y = r + 0.02;
    s.at(0, y, 0, 0, () => {
      s.cyl('trim', fr, 0, -0.012, 0, r + 0.05, r + 0.05, 0.05, n, { jit: 0.03 });
      s.cyl('trim', o.hex, 0, 0.02, 0, r, r * 0.96, 0.035, n, { jit: 0.03 });
      s.cyl('trim', o.knob ?? PAL.brass, 0, 0.05, 0, 0.03, 0.022, 0.03, 6, { jit: 0 });
    }, Math.PI / 2);
    if (o.step ?? true) s.block('trim', PAL.stone, 0, 0, 0.07, w * 1.1, 0.03, 0.14);
    return;
  }
  // frame
  s.block('trim', fr, -w / 2 - t / 2, 0, 0.012, t, h + t, 0.05);
  s.block('trim', fr, w / 2 + t / 2, 0, 0.012, t, h + t, 0.05);
  if (style === 'arch') {
    // a shallow arched head: three voussoir blocks
    s.block('trim', fr, 0, h, 0.012, w + t * 2, t * 1.1, 0.05, { tw: w * 0.7 });
  } else s.block('trim', fr, 0, h, 0.014, w + t * 2.3, t, 0.055);
  // leaf (slightly ajar if asked)
  const ajar = o.ajar ?? 0;
  s.at(-w / 2, 0, 0.014, -ajar, () => {
    s.block('trim', o.hex, w / 2, 0.005, 0, w - 0.01, h - 0.005, 0.03);
    const planks = 3;
    for (let i = 1; i < planks; i++) s.block('trim', 0x2a1d14, (w * i) / planks, 0.02, 0.012, 0.008, h - 0.04, 0.012, { jit: 0 });
    if (style === 'banded') {
      for (const y of [h * 0.22, h * 0.74]) s.block('trim', PAL.iron, w / 2, y, 0.014, w - 0.02, 0.035, 0.014, { jit: 0.02 });
      s.block('trim', PAL.iron, w * 0.8, h * 0.46, 0.02, 0.035, 0.035, 0.02, { jit: 0 });
    } else s.block('trim', o.knob ?? PAL.iron, w * 0.8, h * 0.44, 0.016, 0.028, 0.028, 0.02, { jit: 0 });
  });
  if (o.step ?? true) s.block('trim', PAL.stone, 0, 0, 0.08, w + 0.14, 0.03, 0.14);
}

export interface WinOpts { w?: number; h?: number; unit?: number; style?: 'square' | 'round' | 'arch' | 'slit'; frame?: number; shutters?: number | null; box?: number | null; flowers?: readonly number[] | null; bars?: boolean; sill?: boolean }
/**
 * A window on the plane z = 0 facing +z, centred on the origin. The pane goes in bucket
 * `glass<unit>`; flowers (if any) in `life<unit>` so they only show when someone lives there.
 */
export function win(s: Sculpt, o: WinOpts = {}): void {
  const w = o.w ?? 0.2, h = o.h ?? 0.22, unit = o.unit ?? 0, style = o.style ?? 'square', fr = o.frame ?? PAL.timber;
  const g = 'glass' + unit, t = 0.035;
  s.windows.push({ pos: s.point(0, 0, 0.03), normal: s.dir(0, 0, 1), w, h, unit });
  if (style === 'round') {
    const r = w / 2, n = 10;
    s.at(0, 0, 0, 0, () => {
      s.cyl('trim', fr, 0, -0.01, 0, r + 0.035, r + 0.035, 0.045, n, { jit: 0.03 });
      s.cyl(g, PAL.window, 0, 0.03, 0, r, r, 0.012, n, { jit: 0 });
    }, Math.PI / 2);
    s.beam('trim', fr, [-r, 0, 0.045], [r, 0, 0.045], 0.012, 0.02);
    s.beam('trim', fr, [0, -r, 0.045], [0, r, 0.045], 0.012, 0.02);
  } else {
    // pane
    s.quad(g, PAL.window, [-w / 2, -h / 2, 0.012], [w / 2, -h / 2, 0.012], [w / 2, h / 2, 0.012], [-w / 2, h / 2, 0.012], 0);
    if (style === 'arch') s.tri(g, PAL.window, [-w / 2, h / 2, 0.012], [w / 2, h / 2, 0.012], [0, h / 2 + w * 0.45, 0.012], 0);
    if (style !== 'slit') {
      // frame, mullion, transom
      s.block('trim', fr, -w / 2 - t / 2, -h / 2 - t, 0.012, t, h + t * 2, 0.04);
      s.block('trim', fr, w / 2 + t / 2, -h / 2 - t, 0.012, t, h + t * 2, 0.04);
      if (style === 'arch') {
        s.beam('trim', fr, [-w / 2 - t / 2, h / 2, 0.012], [0, h / 2 + w * 0.5 + t / 2, 0.012], 0.04, t);
        s.beam('trim', fr, [w / 2 + t / 2, h / 2, 0.012], [0, h / 2 + w * 0.5 + t / 2, 0.012], 0.04, t);
      } else s.block('trim', fr, 0, h / 2, 0.012, w + t * 2, t, 0.04);
      if (o.sill ?? true) s.block('trim', fr, 0, -h / 2 - t, 0.02, w + t * 2.6, t, 0.06);
      if (o.bars) { for (const x of [-w / 4, 0, w / 4]) s.block('trim', PAL.iron, x, -h / 2, 0.022, 0.016, h, 0.016, { jit: 0 }); }
      else {
        s.block('trim', fr, 0, -h / 2, 0.02, 0.016, h, 0.014);
        s.block('trim', fr, 0, -0.008, 0.02, w, 0.016, 0.014);
      }
    } else {
      s.block('trim', fr, 0, h / 2, 0.012, w + 0.05, 0.03, 0.03);
      s.block('trim', fr, 0, -h / 2 - 0.03, 0.012, w + 0.05, 0.03, 0.03);
    }
  }
  if (o.shutters != null && style !== 'round') {
    const sw = w * 0.5;
    for (const sg of [-1, 1]) {
      s.at(sg * (w / 2 + t + sw / 2 + 0.005), -h / 2, 0.016, sg * 0.12 * s.rand(), () => {
        s.block('trim', o.shutters as number, 0, 0, 0, sw, h, 0.018);
        s.block('trim', 0x2a1d14, 0, h * 0.5 - 0.006, 0.01, sw * 0.8, 0.012, 0.006, { jit: 0 });
      });
    }
  }
  if (o.box != null) {
    const by = (style === 'round' ? -w / 2 : -h / 2) - t - 0.055;
    s.block('trim', o.box, 0, by, 0.055, w + 0.08, 0.055, 0.07, { bottom: true });
    s.block('trim', 0x3a2a1c, 0, by + 0.05, 0.055, w + 0.05, 0.012, 0.045, { jit: 0 });
    const fl = o.flowers ?? [PAL.crimson, PAL.gold, 0xe9e2d0, 0xd77a9a];
    const life = 'life' + unit;
    for (let i = 0; i < 5; i++) {
      const fx = -w / 2 + (w * (i + 0.5)) / 5 + (s.rand() - 0.5) * 0.02;
      s.blob(life, 0x4f7a3a, fx, by + 0.075, 0.055 + (s.rand() - 0.5) * 0.02, 0.028, 0.03, 0.028, { detail: 0, jit: 0.08 });
      s.blob(life, s.rand.pick(fl), fx + (s.rand() - 0.5) * 0.02, by + 0.105 + s.rand() * 0.015, 0.06 + (s.rand() - 0.5) * 0.03, 0.02, 0.018, 0.02, { detail: 0, jit: 0.05 });
    }
  }
}

/** A masonry chimney stack rising from (x, y0, z) to y1 with a cap and a pot. Returns the smoke point. */
export function chimney(s: Sculpt, x: number, y0: number, z: number, y1: number,
  o: { w?: number; d?: number; hex?: number; colors?: readonly number[]; lean?: number; pot?: boolean; taper?: number } = {}): THREE.Vector3 {
  const w = o.w ?? 0.2, d = o.d ?? 0.18, hex = o.hex ?? PAL.stone, h = y1 - y0, lean = o.lean ?? 0, tp = o.taper ?? 0.82;
  const sx = lean * h;
  s.block('trim', hex, x, y0, z, w, h, d, { tw: w * tp, td: d * tp, sx });
  // a few proud stones so it reads as masonry
  const cols = o.colors ?? [PAL.stoneDark, PAL.stoneWarm, PAL.rock];
  for (let i = 0, n = Math.max(5, Math.round(h * 13)); i < n; i++) {
    const t = s.rand.range(0.06, 0.88), yy = y0 + h * t, ww = (w * (1 - (1 - tp) * t)) / 2 + 0.004, dd = (d * (1 - (1 - tp) * t)) / 2 + 0.004, cx = x + sx * t;
    const face = s.rand.int(0, 3), bw = s.rand.range(0.07, 0.11), bh = s.rand.range(0.05, 0.07);
    const off = s.rand.range(-0.4, 0.4);
    if (face === 0) s.block('trim', s.rand.pick(cols), cx + off * ww, yy, z + dd, bw, bh, 0.012, { bottom: true });
    else if (face === 1) s.block('trim', s.rand.pick(cols), cx + off * ww, yy, z - dd, bw, bh, 0.012, { bottom: true });
    else if (face === 2) s.block('trim', s.rand.pick(cols), cx + ww, yy, z + off * dd, 0.012, bh, bw, { bottom: true });
    else s.block('trim', s.rand.pick(cols), cx - ww, yy, z + off * dd, 0.012, bh, bw, { bottom: true });
  }
  s.block('trim', PAL.stoneDark, x + sx, y1, z, w * tp + 0.05, 0.035, d * tp + 0.05, { bottom: true });
  let top = y1 + 0.035;
  if (o.pot ?? true) {
    s.cyl('trim', PAL.brick, x + sx, top, z, 0.05, 0.04, 0.08, 6, { capHex: PAL.soot });
    top += 0.08;
  } else s.block('trim', PAL.soot, x + sx, top - 0.004, z, w * tp * 0.6, 0.006, d * tp * 0.6, { jit: 0 });
  return s.point(x + sx, top + 0.02, z);
}

// ── small yard things ──
export function bucket(s: Sculpt, x: number, z: number, hex: number = PAL.timberLight): void {
  s.cyl('trim', hex, x, 0, z, 0.045, 0.06, 0.09, 7, { capHex: PAL.water });
  s.cyl('trim', PAL.iron, x, 0.055, z, 0.058, 0.06, 0.012, 7, { cap: false, jit: 0 });
}
export function barrel(s: Sculpt, x: number, z: number, y = 0): void {
  s.cyl('trim', PAL.timberLight, x, y, z, 0.075, 0.09, 0.09, 8, { cap: false });
  s.cyl('trim', PAL.timberLight, x, y + 0.09, z, 0.09, 0.075, 0.09, 8, { capHex: PAL.timber });
  s.cyl('trim', PAL.iron, x, y + 0.08, z, 0.092, 0.092, 0.018, 8, { cap: false, jit: 0 });
}
export function fence(s: Sculpt, x0: number, z0: number, x1: number, z1: number, o: { h?: number; every?: number; hex?: number; pickets?: boolean } = {}): void {
  const h = o.h ?? 0.2, len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / (o.every ?? 0.2))), hex = o.hex ?? PAL.timberLight;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, hh = h * s.rand.range(0.88, 1.12);
    s.block('trim', hex, x, 0, z, 0.035, hh, 0.035, { sx: (s.rand() - 0.5) * 0.03, sz: (s.rand() - 0.5) * 0.03, tw: 0.028, td: 0.028 });
  }
  const sag = () => (s.rand() - 0.5) * 0.02;
  s.beam('trim', hex, [x0, h * 0.72 + sag(), z0], [x1, h * 0.72 + sag(), z1], 0.022, 0.03);
  if (o.pickets ?? false) s.beam('trim', hex, [x0, h * 0.36 + sag(), z0], [x1, h * 0.36 + sag(), z1], 0.022, 0.03);
}
export function woodpile(s: Sculpt, x: number, z: number, ry = 0): void {
  s.at(x, 0, z, ry, () => {
    for (let r = 0; r < 3; r++) for (let i = 0; i < 3 - r; i++) {
      const cx = (i - (2 - r) / 2) * 0.075, cy = 0.035 + r * 0.062;
      s.at(cx, cy, 0, 0, () => s.cyl('trim', r === 2 ? PAL.timber : PAL.timberLight, 0, -0.11, 0, 0.035, 0.035, 0.22, 6, { bottom: true, capHex: 0xc9a875 }), Math.PI / 2);
    }
  });
}
export function crate(s: Sculpt, x: number, z: number, size = 0.13, ry = 0, y = 0): void {
  s.block('trim', PAL.timberLight, x, y, z, size, size, size, { ry, bottom: y > 0 });
  s.block('trim', PAL.timber, x, y + size, z, size * 1.04, 0.012, size * 1.04, { ry, jit: 0.02 });
}
export function bench(s: Sculpt, x: number, z: number, ry = 0, len = 0.42): void {
  s.at(x, 0, z, ry, () => {
    s.block('trim', PAL.timberLight, 0, 0.1, 0, len, 0.025, 0.11, { bottom: true });
    for (const sx of [-len / 2 + 0.05, len / 2 - 0.05]) s.block('trim', PAL.timber, sx, 0, 0, 0.035, 0.1, 0.09);
  });
}
export function steppingStones(s: Sculpt, x0: number, z0: number, x1: number, z1: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1), x = x0 + (x1 - x0) * t + (s.rand() - 0.5) * 0.06, z = z0 + (z1 - z0) * t;
    s.cyl('trim', s.rand.pick([PAL.stone, PAL.stoneWarm, PAL.rock]), x, 0, z, s.rand.range(0.055, 0.075), s.rand.range(0.04, 0.055), 0.022, 6, { phase: s.rand() * 3 });
  }
}
/** a flat irregular patch on the ground (mud, cobbles, a worn doorstep) */
export function groundPatch(s: Sculpt, x: number, z: number, rx: number, rz: number, hex: number, y = 0.006, n = 7): void {
  const pts: V3[] = [];
  const ph = s.rand() * 6;
  for (let i = 0; i < n; i++) { const a = ph - (i / n) * Math.PI * 2, k = s.rand.range(0.72, 1.1); pts.push([x + Math.cos(a) * rx * k, y, z + Math.sin(a) * rz * k]); }
  s.poly('trim', hex, pts, 0.04);
}
/** a pennant or banner cloth as its own double-sided mesh that `flutter` can wave */
export function makeCloth(w: number, h: number, hex: number, o: { device?: number; swallow?: boolean; segs?: number } = {}): THREE.Mesh {
  const segs = o.segs ?? 5, pos: number[] = [], col: number[] = [];
  const c0 = new THREE.Color(hex), c1 = new THREE.Color(o.device ?? hex);
  const P = (i: number, v: number): [number, number, number] => {
    const u = i / segs;
    let y = -v * h;
    if (o.swallow && i === segs) y = v === 0 ? -h * 0.12 : -h * 0.88;
    return [u * w, y, 0];
  };
  for (let i = 0; i < segs; i++) {
    const a = P(i, 0), b = P(i + 1, 0), c = P(i + 1, 1), d = P(i, 1);
    pos.push(...a, ...d, ...c, ...a, ...c, ...b);
    const dev = o.device !== undefined && i >= 1 && i <= 2 ? c1 : c0, k = 1 - 0.06 * (i % 2);
    for (let j = 0; j < 6; j++) col.push(dev.r * k, dev.g * k, dev.b * k);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  g.userData.rest = Float32Array.from(pos);
  g.userData.w = w;
  g.userData.owned = true;
  const m = new THREE.Mesh(g, mat(0xffffff, { vertexColors: true, side: THREE.DoubleSide }));
  m.castShadow = true; m.receiveShadow = false; m.name = 'cloth';
  return m;
}
/** wave a cloth made by makeCloth: the hoist stays put, the fly whips. No allocation. */
export function flutter(m: THREE.Mesh, time: number, wind: number, phase = 0): void {
  const g = m.geometry, rest = g.userData.rest as Float32Array | undefined;
  if (!rest) return;
  const p = g.getAttribute('position') as THREE.BufferAttribute, arr = p.array as Float32Array;
  const amp = 0.02 + wind * 0.07, sp = 3 + wind * 7;
  const w = (g.userData.w as number) || 1;
  for (let i = 0; i < rest.length; i += 3) {
    const u = rest[i] / w;
    arr[i + 2] = Math.sin(time * sp + phase - u * 4.2) * amp * u;
    arr[i + 1] = rest[i + 1] - u * u * (0.1 - wind * 0.08) * w + Math.cos(time * sp * 0.7 + phase - u * 3) * amp * 0.35 * u;
  }
  p.needsUpdate = true;
}

// ───────────────────────── assembling a body ─────────────────────────

export interface BodyExtras {
  door: THREE.Vector3; roof: THREE.Vector3; chimney: THREE.Vector3 | null; top: number;
  animate?: (env: Env) => void;
  /** extra meshes that move or wear their own material (orbs, banners, lanterns) */
  extras?: THREE.Object3D[];
  /** extra meshes that count as roof for snow and wear */
  extraRoofs?: THREE.Mesh[];
}
/** Bake a finished Sculpt into the BuiltBody the wrapper expects. */
export function finishBody(s: Sculpt, x: BodyExtras): BuiltBody {
  const group = new THREE.Group();
  const walls: THREE.Mesh[] = [], roofs: THREE.Mesh[] = [], windows: THREE.Mesh[] = [];
  const wall = s.mesh('wall'); if (wall) { group.add(wall); walls.push(wall); }
  const roof = s.mesh('roof'); if (roof) { group.add(roof); roofs.push(roof); }
  const trim = s.mesh('trim'); if (trim) group.add(trim);
  for (const b of s.buckets()) {
    if (b.startsWith('glass')) {
      const m = s.mesh(b, paneMat());
      if (m) { m.userData.unit = +b.slice(5) || 0; m.castShadow = false; group.add(m); windows.push(m); }
    } else if (b.startsWith('life')) {
      const m = s.mesh(b);
      if (m) { m.userData.lifeUnit = +b.slice(4) || 0; group.add(m); }
    }
  }
  for (const e of x.extras ?? []) group.add(e);
  for (const r of x.extraRoofs ?? []) roofs.push(r);
  const anchors: BuildingVisual['anchors'] = {
    door: x.door, roof: x.roof, chimney: x.chimney, top: x.top,
    windows: s.windows.map(w => w.pos.clone().addScaledVector(w.normal, 0.03)),
  };
  group.userData.windowInfo = s.windows;
  return { group, anchors, windows, roofs, walls, animate: x.animate };
}

/** dispose the geometries a body (or any wrapper layer) owns; shared materials are left alone */
export function disposeOwned(root: THREE.Object3D): void {
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry && m.geometry.userData.owned) m.geometry.dispose();
  });
}
