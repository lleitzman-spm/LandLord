/**
 * The kit every incident visual is built from.
 *
 *  - maths, hashing and noise for procedural motion
 *  - shared unit geometries and one-line mesh makers (everything is scaled
 *    from a handful of cached shapes, with `palette.mat` materials)
 *  - "bones": only groups made with `bone()` (or meshes flagged with `live()`)
 *    may be animated. When a visual is finished, every other mesh under a bone
 *    is merged into one vertex-coloured mesh, so a creature made of sixty
 *    carved pieces draws in a dozen calls.
 *  - `Site`: what a visual knows about the building it sits on. It reads the
 *    host's anchors and footprint and, where it can, probes the real building
 *    mesh (ray casts, once, at creation) so tarpaulins lie on the actual roof
 *    slope and planks sit on the actual wall.
 *  - `runVisual`: the VisualHandle wrapper (pop-in, update clock, exit, dispose).
 */
import * as THREE from 'three';
import type { Env, RenderCtx, VisualHandle, VisualHost } from '../api';
import { mat } from '../palette';

// ───────────────────────── maths ─────────────────────────

export const TAU = Math.PI * 2;
export const clamp = (v: number, a = 0, b = 1): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smooth = (t: number): number => { t = clamp(t); return t * t * (3 - 2 * t); };
/** 0..1 → 0..1 with an overshoot at the end (things that pop into place) */
export const outBack = (t: number): number => { t = clamp(t) - 1; return 1 + 2.70158 * t * t * t + 1.70158 * t * t; };
export const inBack = (t: number): number => { t = clamp(t); return 2.70158 * t * t * t - 1.70158 * t * t; };
/** remap v from [a,b] to 0..1, clamped */
export const span = (v: number, a: number, b: number): number => clamp((v - a) / (b - a));
/** 0 → 1 → 0 over the window [a,b] */
export const bump = (v: number, a: number, b: number): number => { const k = span(v, a, b); return Math.sin(k * Math.PI); };

/** integer hash → 0..1 */
export function hash(n: number): number {
  let t = (Math.imul(n | 0, 0x9e3779b1) + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/** smooth value noise in -1..1 */
export function noise(t: number, seed = 0): number {
  const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f), k = (seed | 0) * 7919;
  const a = hash(i + k), b = hash(i + 1 + k);
  return (a + (b - a) * u) * 2 - 1;
}
export function rng(seed: number): () => number {
  let n = (seed | 0) || 1;
  return () => hash(n++);
}
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** a pulse 0→1→0 lasting `len` seconds, once every `period` seconds */
export function beat(t: number, period: number, len: number, off = 0): number {
  const p = (((t + off) % period) + period) % period;
  return p < len ? Math.sin((p / len) * Math.PI) : 0;
}
/** critically damped approach of `cur` to `target`; rate ~ 1/seconds */
export const damp = (cur: number, target: number, rate: number, dt: number): number => cur + (target - cur) * (1 - Math.exp(-rate * dt));

// ───────────────────────── shared geometry ─────────────────────────

const geos = new Map<string, THREE.BufferGeometry>();
export function geo<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geos.get(key);
  if (!g) { g = make(); geos.set(key, g); }
  return g as T;
}

function place<T extends THREE.Object3D>(o: T, x: number, y: number, z: number, rx: number, ry: number, rz: number): T {
  o.position.set(x, y, z); if (rx || ry || rz) o.rotation.set(rx, ry, rz); return o;
}

/** a box, centred */
export function box(m: THREE.Material, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): THREE.Mesh {
  const o = new THREE.Mesh(geo('box', () => new THREE.BoxGeometry(1, 1, 1)), m);
  o.scale.set(sx, sy, sz); return place(o, x, y, z, rx, ry, rz);
}
/** a cylinder or frustum along y, centred */
export function cyl(m: THREE.Material, rTop: number, rBot: number, h: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 7): THREE.Mesh {
  const big = Math.max(rTop, rBot, 1e-5), flip = rTop > rBot;
  const ratio = Math.round((Math.min(rTop, rBot) / big) * 20) / 20;
  const g = geo(`cyl${flip ? 'f' : ''}${ratio}|${seg}`, () => new THREE.CylinderGeometry(flip ? 1 : ratio, flip ? ratio : 1, 1, seg));
  const o = new THREE.Mesh(g, m); o.scale.set(big, h, big); return place(o, x, y, z, rx, ry, rz);
}
/** a cone along +y, centred (tip at +h/2) */
export function cone(m: THREE.Material, r: number, h: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 6): THREE.Mesh {
  return cyl(m, 0, r, h, x, y, z, rx, ry, rz, seg);
}
/** a cone with its BASE at the origin, pointing along +y (spikes, ears, feathers) */
export function spike(m: THREE.Material, r: number, h: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 5): THREE.Mesh {
  const g = geo(`spike${seg}`, () => new THREE.ConeGeometry(1, 1, seg).translate(0, 0.5, 0));
  const o = new THREE.Mesh(g, m); o.scale.set(r, h, r); return place(o, x, y, z, rx, ry, rz);
}
/** a flat blade (feather, leaf, plank end): base at the origin, pointing along +y, `w` wide (x), `t` thick (z) */
export function blade(m: THREE.Material, w: number, h: number, t: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): THREE.Mesh {
  const g = geo('blade', () => {
    // a kite: narrow at the root, widest a third of the way up, pointed tip
    const s = new THREE.Shape(); s.moveTo(-0.22, 0); s.lineTo(0.22, 0); s.lineTo(0.5, 0.42); s.lineTo(0, 1); s.lineTo(-0.5, 0.42); s.closePath();
    const e = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); e.translate(0, 0, -0.5); return e;
  });
  const o = new THREE.Mesh(g, m); o.scale.set(w, h, t); return place(o, x, y, z, rx, ry, rz);
}
/** a broad wing feather: base at the origin, pointing along +y, `w` wide (x), `t` thick (z), rounded tip */
export function feather(m: THREE.Material, w: number, h: number, t: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): THREE.Mesh {
  const g = geo('feather', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.3, 0); s.lineTo(0.3, 0); s.lineTo(0.5, 0.3); s.lineTo(0.47, 0.7); s.lineTo(0.22, 0.94); s.lineTo(0, 1);
    s.lineTo(-0.22, 0.94); s.lineTo(-0.47, 0.7); s.lineTo(-0.5, 0.3); s.closePath();
    const e = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); e.translate(0, 0, -0.5); return e;
  });
  const o = new THREE.Mesh(g, m); o.scale.set(w, h, t); return place(o, x, y, z, rx, ry, rz);
}
/** a faceted blob (icosphere), radii per axis */
export function ball(m: THREE.Material, rx: number, ry: number, rz: number, x = 0, y = 0, z = 0, ax = 0, ay = 0, az = 0, detail = 1): THREE.Mesh {
  const o = new THREE.Mesh(geo(`ico${detail}`, () => new THREE.IcosahedronGeometry(1, detail)), m);
  o.scale.set(rx, ry, rz); return place(o, x, y, z, ax, ay, az);
}
/** an octahedron: gems, embers, little rough stones */
export function gem(m: THREE.Material, rx: number, ry: number, rz: number, x = 0, y = 0, z = 0, ax = 0, ay = 0, az = 0): THREE.Mesh {
  const o = new THREE.Mesh(geo('oct', () => new THREE.OctahedronGeometry(1, 0)), m);
  o.scale.set(rx, ry, rz); return place(o, x, y, z, ax, ay, az);
}
/** a square pyramid, base centred at the origin, w × d base, tip at +h */
export function pyr(m: THREE.Material, w: number, h: number, d: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): THREE.Mesh {
  const g = geo('pyr', () => new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0));
  const o = new THREE.Mesh(g, m); o.scale.set(w, h, d); return place(o, x, y, z, rx, ry, rz);
}
/** a flat disc lying on the ground (normal +y) */
export function disc(m: THREE.Material, rx: number, rz: number, x = 0, y = 0, z = 0, ry = 0, seg = 9): THREE.Mesh {
  const o = new THREE.Mesh(geo(`disc${seg}`, () => new THREE.CircleGeometry(1, seg).rotateX(-Math.PI / 2)), m);
  o.scale.set(rx, 1, rz); return place(o, x, y, z, 0, ry, 0);
}
/** an upright quad facing +z, centred */
export function quad(m: THREE.Material, w: number, h: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): THREE.Mesh {
  const o = new THREE.Mesh(geo('quad', () => new THREE.PlaneGeometry(1, 1)), m);
  o.scale.set(w, h, 1); return place(o, x, y, z, rx, ry, rz);
}
/** a ring (torus) lying flat, radius R, tube r */
export function ring(m: THREE.Material, R: number, r: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 10): THREE.Mesh {
  const ratio = Math.round((r / R) * 20) / 20;
  const g = geo(`tor${ratio}|${seg}`, () => new THREE.TorusGeometry(1, ratio, 5, seg).rotateX(Math.PI / 2));
  const o = new THREE.Mesh(g, m); o.scale.set(R, R, R); return place(o, x, y, z, rx, ry, rz);
}
/** a thin rod from a to b */
const _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
export function rod(m: THREE.Material, a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 5): THREE.Mesh {
  _d.subVectors(b, a); const len = _d.length() || 1e-4;
  const o = cyl(m, r, r, len, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, 0, 0, 0, seg);
  o.quaternion.setFromUnitVectors(_up, _d.multiplyScalar(1 / len)); return o;
}

/** point an object's +y axis along a direction (spikes, feathers, rods) */
const _a = new THREE.Vector3();
export function aim<T extends THREE.Object3D>(o: T, dx: number, dy: number, dz: number): T {
  _a.set(dx, dy, dz); const l = _a.length(); if (l < 1e-6) return o;
  o.quaternion.setFromUnitVectors(_up, _a.multiplyScalar(1 / l)); return o;
}

/** turn `o` so its +z is `n` (a surface normal) and its +y points as far up the slope as it can */
const _bx = new THREE.Vector3(), _by = new THREE.Vector3(), _bz = new THREE.Vector3(), _bm = new THREE.Matrix4();
export function lieOn<T extends THREE.Object3D>(o: T, n: THREE.Vector3): T {
  _bz.copy(n).normalize();
  _by.set(0, 1, 0).addScaledVector(_bz, -_bz.y);
  if (_by.lengthSq() < 1e-4) _by.set(0, 0, -1);
  _by.normalize(); _bx.crossVectors(_by, _bz).normalize();
  o.quaternion.setFromRotationMatrix(_bm.makeBasis(_bx, _by, _bz)); return o;
}

/** a static grouping (its meshes get merged into the nearest bone) */
export function grp(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, ...kids: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group(); place(g, x, y, z, rx, ry, rz); if (kids.length) g.add(...kids); return g;
}
/** an animated joint: the only kind of group a visual may move after it is built */
export function bone(parent: THREE.Object3D | null, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): THREE.Group {
  const g = new THREE.Group(); g.userData.bone = true; place(g, x, y, z, rx, ry, rz); if (parent) parent.add(g); return g;
}
/** mark a mesh as individually animated (it is left out of merging) */
export function live<T extends THREE.Object3D>(o: T): T { o.userData.live = true; return o; }
/** mark a subtree as never casting shadows (tiny or fast things) */
export function noShadow<T extends THREE.Object3D>(o: T): T { o.userData.noCast = true; return o; }

// ───────────────────────── glow, textures, cloth, swarms ─────────────────────────

const glowMats = new Map<string, THREE.MeshBasicMaterial>();
/** additive, unlit, no depth write: halos and pools of light (no real lights are used) */
export function glowMat(color: number, opacity = 1, unique = false, soft = true): THREE.MeshBasicMaterial {
  const key = `${color}|${opacity}|${soft}`;
  if (!unique) { const hit = glowMats.get(key); if (hit) return hit; }
  // `soft` materials read the per-vertex falloff baked into glowDisc; use soft = false on any other shape
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: soft, fog: false, side: THREE.DoubleSide });
  if (!unique) glowMats.set(key, m);
  return m;
}
/** a soft-edged disc (bright centre, fading to nothing) lying flat; use with glowMat */
export function glowDisc(m: THREE.Material, r: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const g = geo('glowdisc', () => {
    const N = 14, pos: number[] = [], col: number[] = [], idx: number[] = [];
    pos.push(0, 0, 0); col.push(1, 1, 1);
    for (let ringI = 1; ringI <= 2; ringI++) for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU, rr = ringI === 1 ? 0.45 : 1, v = ringI === 1 ? 0.42 : 0;
      pos.push(Math.cos(a) * rr, 0, Math.sin(a) * rr); col.push(v, v, v);
    }
    for (let i = 0; i < N; i++) {
      const a = 1 + i, b = 1 + ((i + 1) % N), c = 1 + N + i, d = 1 + N + ((i + 1) % N);
      idx.push(0, b, a, a, b, d, a, d, c);
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    bg.setIndex(idx); bg.computeVertexNormals(); return bg;
  });
  const o = new THREE.Mesh(g, m); o.scale.set(r, 1, r); o.position.set(x, y, z); o.userData.live = true; o.renderOrder = 2; return o;
}

/**
 * A soft round glow that faces the camera: call billboard(sprite, camera) each frame. Give it its own
 * (unique, soft) glowMat: the material stops depth-testing, so the halo lies over the scene like bloom
 * instead of being sliced by the roof it sits behind.
 */
export function glowSprite(m: THREE.Material, r: number, x = 0, y = 0, z = 0): THREE.Group {
  const g = new THREE.Group(); g.userData.bone = true; g.position.set(x, y, z);
  m.depthTest = false;
  const d = glowDisc(m, r); d.rotation.x = Math.PI / 2; d.renderOrder = 5; g.add(d);
  return g;
}

const texes = new Map<string, THREE.Texture>();
/** a small canvas-drawn texture (banners, chalk). Null where there is no DOM (node tests). */
export function canvasTex(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const hit = texes.get(key); if (hit) return hit;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d'); if (!c) return null;
  draw(c, w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  texes.set(key, t); return t;
}

const _q = new THREE.Quaternion();
/** turn `o` to face the camera whatever the building's rotation */
export function billboard(o: THREE.Object3D, cam: THREE.Camera): void {
  if (!o.parent) return;
  o.parent.getWorldQuaternion(_q).invert();
  o.quaternion.copy(_q).multiply(cam.quaternion);
}

export interface Disposable { dispose(): void }

/**
 * A small rectangle of cloth that ripples. Authored hanging: the pinned edge
 * is the top (y = 0) for `pin: 'top'`, or the hoist (x = 0) for `pin: 'side'`.
 */
export class Cloth {
  mesh: THREE.Mesh;
  private base: Float32Array; private pos: THREE.BufferAttribute;
  private fall: Float32Array;
  /**
   * `paint(u, v)` (u across 0..1, v from the pinned edge 0 to the free edge 1) gives each vertex a colour;
   * use it with a white `vertexColors` material for stripes and borders.
   */
  constructor(public w: number, public h: number, m: THREE.Material, pin: 'top' | 'side', own: Disposable[], segW = 5, segH = 5, taper = 0, paint?: (u: number, v: number) => number) {
    const g = new THREE.PlaneGeometry(w, h, segW, segH);
    if (paint) {
      const p0 = g.attributes.position, col = new Float32Array(p0.count * 3), c = new THREE.Color();
      for (let i = 0; i < p0.count; i++) {
        const u = p0.getX(i) / w + 0.5, v = 0.5 - p0.getY(i) / h;
        c.set(pin === 'top' ? paint(u, v) : paint(v, u)); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    }
    if (pin === 'top') g.translate(0, -h / 2, 0); else g.translate(w / 2, 0, 0);
    this.pos = g.attributes.position as THREE.BufferAttribute;
    const n = this.pos.count; this.fall = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = this.pos.getX(i), y = this.pos.getY(i);
      const k = pin === 'top' ? -y / h : x / w;      // 0 at the pinned edge → 1 at the free edge
      this.fall[i] = k;
      if (taper) {                                    // swallowtail / pennant: narrow toward the free edge
        if (pin === 'top') this.pos.setX(i, x * (1 - taper * k)); else this.pos.setY(i, y * (1 - taper * k));
      }
    }
    this.base = (this.pos.array as Float32Array).slice();
    this.mesh = new THREE.Mesh(g, m); this.mesh.userData.live = true;
    g.computeBoundingSphere(); if (g.boundingSphere) g.boundingSphere.radius *= 1.4;
    own.push(g);
  }
  /** ripple: amp at the free edge, waves running away from the pin. `bias` 1 keeps it on the +z side (cloth lying on a surface). */
  wave(t: number, amp: number, freq = 5, speed = 5, bias = 0): void {
    const p = this.pos.array as Float32Array, b = this.base, n = this.pos.count;
    for (let i = 0; i < n; i++) {
      const k = this.fall[i], j = i * 3;
      const ph = k * freq - t * speed;
      p[j + 2] = b[j + 2] + amp * k * (Math.sin(ph + b[j] * 3.1) + 0.45 * Math.sin(ph * 2.3 + b[j + 1] * 5.7) + bias * 1.45);
    }
    this.pos.needsUpdate = true;
  }
}

const _sv = new THREE.Vector3();
/** Many copies of one small shape in a single draw call (bees, drips, embers, pennants). */
export class Swarm {
  mesh: THREE.InstancedMesh;
  private o = new THREE.Object3D();
  private c = new THREE.Color();
  /** Euler order used by put(): 'YXZ' turns a thing to a heading first, then tips it */
  set order(v: THREE.EulerOrder) { this.o.rotation.order = v; }
  constructor(g: THREE.BufferGeometry, m: THREE.Material, public n: number, own: Disposable[]) {
    this.mesh = new THREE.InstancedMesh(g, m, n);
    this.mesh.frustumCulled = false; this.mesh.userData.live = true; this.mesh.userData.noCast = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < n; i++) this.hide(i);
    own.push(this.mesh);
  }
  put(i: number, x: number, y: number, z: number, sx: number, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0): void {
    const o = this.o; o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); o.updateMatrix();
    this.mesh.setMatrixAt(i, o.matrix);
  }
  /** stretch a unit shape (centred, 1 long in y) from a to b: stems, rain streaks, ropes */
  span(i: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, w: number, d = w): void {
    const o = this.o, dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz) || 1e-5;
    o.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    o.quaternion.setFromUnitVectors(_up, _sv.set(dx / len, dy / len, dz / len));
    o.scale.set(w, len, d); o.updateMatrix();
    this.mesh.setMatrixAt(i, o.matrix);
  }
  hide(i: number): void { this.put(i, 0, -9, 0, 0.00001); }
  tint(i: number, color: number): void { this.mesh.setColorAt(i, this.c.set(color)); if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; }
  commit(): void { this.mesh.instanceMatrix.needsUpdate = true; }
}

/** unit shapes for swarms */
export const SHAPE = {
  oct: (): THREE.BufferGeometry => geo('oct', () => new THREE.OctahedronGeometry(1, 0)),
  ico: (): THREE.BufferGeometry => geo('ico0', () => new THREE.IcosahedronGeometry(1, 0)),
  ico1: (): THREE.BufferGeometry => geo('ico1', () => new THREE.IcosahedronGeometry(1, 1)),
  box: (): THREE.BufferGeometry => geo('box', () => new THREE.BoxGeometry(1, 1, 1)),
  /** a cone with its base at the origin, tip at +1 (icicles, thorns) */
  spike: (): THREE.BufferGeometry => geo('spike5', () => new THREE.ConeGeometry(1, 1, 5).translate(0, 0.5, 0)),
  /** a leaf: a kite flat in XY, root at the origin, tip at +1 */
  leaf: (): THREE.BufferGeometry => geo('leaf', () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.5, 0.42, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, -0.5, 0.42, 0], 3)); g.computeVertexNormals(); return g;
  }),
  /** teardrop / flame tongue: base at the origin, tip at +1 */
  flame: (): THREE.BufferGeometry => geo('flame', () => new THREE.LatheGeometry([new THREE.Vector2(0.001, 0), new THREE.Vector2(0.5, 0.26), new THREE.Vector2(0.34, 0.6), new THREE.Vector2(0.001, 1)], 5)),
  /** a pennant: triangle hanging down from y = 0, 1 wide, 1 long */
  pennant: (): THREE.BufferGeometry => geo('pennant', () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0, -1, 0], 3)); g.computeVertexNormals(); return g;
  }),
  /** a sparkle that reads as a star from any side: three crossed needles */
  spark: (): THREE.BufferGeometry => geo('spark', () => {
    const p: number[] = [], k = 0.13;
    for (const [sx, sy, sz] of [[1, k, k], [k, 1, k], [k, k, 1]]) {
      const o = new THREE.OctahedronGeometry(1, 0).scale(sx, sy, sz).toNonIndexed();
      p.push(...(o.attributes.position.array as Float32Array)); o.dispose();
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); return g;
  }),
  /** a thin flat ring, radius 1 (ripples) */
  hoop: (): THREE.BufferGeometry => geo('hoop', () => new THREE.TorusGeometry(1, 0.05, 4, 14).rotateX(Math.PI / 2)),
  /** a bat's wing: flat in XZ, root at the origin, tip at +x */
  batwing: (): THREE.BufferGeometry => geo('batwing', () => {
    const pts: [number, number][] = [[0, 0.3], [1, 0.22], [0.82, -0.08], [0.62, -0.42], [0.36, -0.22], [0.12, -0.4], [0, -0.3]];
    const p: number[] = [];
    for (let i = 1; i + 1 < pts.length; i++) p.push(pts[0][0], 0, pts[0][1], pts[i + 1][0], 0, pts[i + 1][1], pts[i][0], 0, pts[i][1]);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); return g;
  }),
  /** a four-point star, flat in XY */
  star: (): THREE.BufferGeometry => geo('star', () => {
    const p: number[] = [], k = 0.16;
    const pts: [number, number][] = [[0, 1], [k, k], [1, 0], [k, -k], [0, -1], [-k, -k], [-1, 0], [-k, k]];
    for (let i = 0; i < 8; i++) { const a = pts[i], b = pts[(i + 1) % 8]; p.push(0, 0, 0, b[0], b[1], 0, a[0], a[1], 0); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); return g;
  }),
};

// ───────────────────────── merging static pieces ─────────────────────────

function isPlain(m: THREE.Material): m is THREE.MeshStandardMaterial {
  const s = m as THREE.MeshStandardMaterial;
  if (!s.isMeshStandardMaterial || s.map || s.transparent || s.side !== THREE.FrontSide || s.vertexColors || !s.flatShading) return false;
  if (s.metalness > 0.05) return false;
  return s.emissiveIntensity * (s.emissive.r + s.emissive.g + s.emissive.b) < 1e-4;
}

const _c = new THREE.Color();
function mergeBone(b: THREE.Object3D, own: Disposable[]): void {
  type Item = { mesh: THREE.Mesh; mx: THREE.Matrix4 };
  const found: Item[] = [];
  const walk = (o: THREE.Object3D, mx: THREE.Matrix4): void => {
    for (const c of o.children) {
      if (c.userData.bone || c.userData.live) continue;
      c.updateMatrix();
      const cm = new THREE.Matrix4().multiplyMatrices(mx, c.matrix);
      const me = c as THREE.Mesh;
      if (me.isMesh && !(c as THREE.InstancedMesh).isInstancedMesh && !Array.isArray(me.material) && me.children.length === 0) found.push({ mesh: me, mx: cm });
      walk(c, cm);
    }
  };
  walk(b, new THREE.Matrix4());
  const buckets = new Map<string, { m: THREE.Material; plain: boolean; items: Item[] }>();
  for (const f of found) {
    const m = f.mesh.material as THREE.Material;
    if ((m as THREE.MeshStandardMaterial).map) continue;
    const plain = isPlain(m);
    const key = plain ? 'p' + (m as THREE.MeshStandardMaterial).roughness.toFixed(2) : m.uuid;
    let bk = buckets.get(key); if (!bk) { bk = { m, plain, items: [] }; buckets.set(key, bk); }
    bk.items.push(f);
  }
  for (const bk of buckets.values()) {
    if (bk.items.length < 2) continue;
    let total = 0;
    const parts: { p: Float32Array; n: Float32Array; col: THREE.Color }[] = [];
    for (const it of bk.items) {
      const src = it.mesh.geometry;
      const g = src.index ? src.toNonIndexed() : src.clone();
      g.applyMatrix4(it.mx);
      const p = g.attributes.position.array as Float32Array;
      const nAttr = g.attributes.normal;
      const n = nAttr ? (nAttr.array as Float32Array) : new Float32Array(p.length);
      if (it.mx.determinant() < 0) {                    // mirrored: restore the winding
        for (let i = 0; i + 8 < p.length; i += 9) for (let k = 0; k < 3; k++) {
          const a = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = a;
          const c = n[i + 3 + k]; n[i + 3 + k] = n[i + 6 + k]; n[i + 6 + k] = c;
        }
      }
      parts.push({ p, n, col: (it.mesh.material as THREE.MeshStandardMaterial).color });
      total += p.length; g.dispose();
    }
    const P = new Float32Array(total), N = new Float32Array(total), C = bk.plain ? new Float32Array(total) : null;
    let off = 0;
    for (const part of parts) {
      P.set(part.p, off); N.set(part.n, off);
      if (C) { _c.copy(part.col); for (let i = 0; i < part.p.length; i += 3) { C[off + i] = _c.r; C[off + i + 1] = _c.g; C[off + i + 2] = _c.b; } }
      off += part.p.length;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    if (C) g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    own.push(g);
    const merged = new THREE.Mesh(g, bk.plain ? mat(0xffffff, { vertexColors: true, rough: (bk.m as THREE.MeshStandardMaterial).roughness }) : bk.m);
    merged.userData.live = true;
    for (const it of bk.items) it.mesh.removeFromParent();
    b.add(merged);
  }
}

/** merge static meshes bone by bone, drop emptied groups, set shadow flags */
export function finishTree(root: THREE.Object3D, own: Disposable[]): void {
  const bones: THREE.Object3D[] = [];
  root.traverse(o => { if (o === root || o.userData.bone) bones.push(o); });
  for (const b of bones) mergeBone(b, own);
  // prune static groups that merging emptied
  const prune = (o: THREE.Object3D): void => {
    for (const c of [...o.children]) { prune(c); if (!(c as THREE.Mesh).isMesh && !c.userData.bone && !c.userData.live && c.children.length === 0 && (c as THREE.Group).isGroup) o.remove(c); }
  };
  prune(root);
  const sph = new THREE.Sphere();
  const flag = (o: THREE.Object3D, noCast: boolean): void => {
    noCast = noCast || !!o.userData.noCast;
    const me = o as THREE.Mesh;
    if (me.isMesh) {
      const m = me.material as THREE.MeshStandardMaterial;
      const glow = !!m.transparent || !m.isMeshStandardMaterial || (m.emissiveIntensity ?? 0) * (m.emissive ? m.emissive.r + m.emissive.g + m.emissive.b : 0) > 0.15;
      let big = true;
      if (!(me as unknown as THREE.InstancedMesh).isInstancedMesh) {
        if (!me.geometry.boundingSphere) me.geometry.computeBoundingSphere();
        sph.copy(me.geometry.boundingSphere!);
        big = sph.radius * Math.max(Math.abs(me.scale.x), Math.abs(me.scale.y), Math.abs(me.scale.z)) > 0.035;
      }
      me.castShadow = !glow && !noCast && big;
      me.receiveShadow = !glow;
    }
    for (const c of o.children) flag(c, noCast);
  };
  flag(root, false);
}

// ───────────────────────── the site: what we know about the building ─────────────────────────

/** A point on the walk round a building, with its heading. */
export interface LoopPt { x: number; z: number; yaw: number }
/** A point on a wall (or roof) with the direction it faces. */
export interface Spot { p: THREE.Vector3; n: THREE.Vector3; yaw: number; face: number }

const FACE_N: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];   // outward normals (x, z): front, +x, back, -x
const _o = new THREE.Vector3(), _dir = new THREE.Vector3(), _n3 = new THREE.Matrix3();

class Prober {
  ok = false;
  private meshes: THREE.Object3D[] = [];
  private M = new THREE.Matrix4(); private Minv = new THREE.Matrix4();
  private ray = new THREE.Raycaster();
  constructor(root: THREE.Object3D | undefined) {
    if (!root) return;
    try {
      root.updateWorldMatrix(true, true);
      this.M.copy(root.matrixWorld);
      const det = this.M.determinant();
      if (!(Math.abs(det) > 1e-9) || !isFinite(det)) return;
      this.Minv.copy(this.M).invert();
      const walk = (o: THREE.Object3D): void => {
        if (!o.visible || o.userData.isVisual) return;
        const me = o as THREE.Mesh;
        if (me.isMesh && me.geometry && me.geometry.attributes.position) {
          const m = (Array.isArray(me.material) ? me.material[0] : me.material) as THREE.Material | undefined;
          if (m && m.visible && m.depthWrite && !(m.transparent && m.opacity < 0.5)) this.meshes.push(me);
        }
        for (const c of o.children) walk(c);
      };
      walk(root);
      this.ok = this.meshes.length > 0;
    } catch { this.ok = false; }
  }
  /** cast a ray in building-local space; returns the first surface hit (local point and normal) */
  cast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, far: number): { p: THREE.Vector3; n: THREE.Vector3; dist: number } | null {
    if (!this.ok) return null;
    try {
      _o.set(ox, oy, oz).applyMatrix4(this.M);
      _dir.set(dx, dy, dz).transformDirection(this.M);
      this.ray.set(_o, _dir); this.ray.near = 0; this.ray.far = far * 4 + 10;
      const hits = this.ray.intersectObjects(this.meshes, false);
      for (const h of hits) {
        const p = h.point.clone().applyMatrix4(this.Minv);
        const dist = Math.hypot(p.x - ox, p.y - oy, p.z - oz);
        if (dist > far) break;
        if (!isFinite(p.x + p.y + p.z)) continue;
        const n = new THREE.Vector3(-dx, -dy, -dz);
        if (h.face) {
          n.copy(h.face.normal).applyMatrix3(_n3.getNormalMatrix(h.object.matrixWorld)).normalize().transformDirection(this.Minv);
          if (!isFinite(n.x + n.y + n.z) || n.lengthSq() < 0.5) n.set(-dx, -dy, -dz);
        }
        return { p, n, dist };
      }
    } catch { /* fall through to the heuristics */ }
    return null;
  }
}

const median = (a: number[]): number => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN; };

export class Site {
  readonly w: number; readonly h: number;
  /** distance from the centre to each wall plane: front (+z), +x, back, -x */
  readonly ext: [number, number, number, number];
  /** y of the roof perch, highest y, estimated eave (wall-top) height */
  readonly ridgeY: number; readonly top: number; readonly eave: number;
  readonly perch: THREE.Vector3;
  readonly chimney: THREE.Vector3 | null;
  /** unit vector along the roof ridge (x or z), and how far it runs either way from the perch */
  readonly ridge: THREE.Vector3; readonly ridgeLen: number;
  /** true when the roof falls away from the perch on all sides (towers, pyramids) */
  readonly peaked: boolean;
  readonly door: THREE.Vector3;
  /** the door: centre of the leaf on the wall, facing out */
  readonly doorSpot: Spot;
  readonly doorW: number; readonly doorH: number;
  readonly windows: Spot[];
  readonly seed: number;
  readonly rnd: () => number;
  /** things to dispose with the visual */
  readonly own: Disposable[] = [];
  readonly holders: { g: THREE.Group; delay: number }[] = [];
  private prober: Prober;

  constructor(readonly host: VisualHost, readonly ctx: RenderCtx, readonly group: THREE.Group, id: string) {
    const look = host.look, a = host.visual.anchors;
    this.w = Math.max(0.5, look.w); this.h = Math.max(0.5, look.h);
    this.seed = (hashStr(id) ^ Math.imul((look.variant | 0) + 17, 2654435761) ^ Math.imul(Math.round(host.wx * 16) + 331, 40503) ^ Math.imul(Math.round(host.wz * 16) + 97, 9973)) >>> 0;
    this.rnd = rng(this.seed);
    this.prober = new Prober(host.visual.group);
    this.top = Math.max(0.4, a.top || 0, a.roof ? a.roof.y : 0);
    this.perch = a.roof ? a.roof.clone() : new THREE.Vector3(0, this.top, 0);
    this.ridgeY = this.perch.y;
    this.chimney = a.chimney ? a.chimney.clone() : null;

    // wall planes
    const ext: number[] = [];
    for (let f = 0; f < 4; f++) {
      const half = (f % 2 === 0 ? this.h : this.w) / 2, latHalf = (f % 2 === 0 ? this.w : this.h) / 2;
      const [nx, nz] = FACE_N[f]; const tx = nz, tz = -nx;
      const ds: number[] = [];
      for (const u of [-0.24, 0.24]) for (const y of [0.26, 0.42]) {
        const hit = this.prober.cast(nx * (half + 1) + tx * u * 2 * latHalf, y, nz * (half + 1) + tz * u * 2 * latHalf, -nx, 0, -nz, half + 1);
        if (hit) ds.push(half + 1 - hit.dist);
      }
      const m = median(ds);
      ext.push(isFinite(m) ? clamp(m, half * 0.25, half + 0.1) : Math.max(half * 0.5, half - 0.22));
    }
    this.ext = ext as [number, number, number, number];

    // eaves
    const guessEave = clamp(this.ridgeY * 0.56, Math.min(0.4, this.ridgeY * 0.8), Math.max(0.4, this.ridgeY - 0.2));
    const es: number[] = [];
    if (this.prober.ok) for (let f = 0; f < 4; f++) for (const u of [-0.6, 0.6]) {
      const y = this.eaveProbe(f, u * this.lat(f)); if (y > 0) es.push(y);
    }
    this.eave = es.length >= 2 ? clamp(median(es), 0.25, Math.max(0.3, this.top)) : guessEave;

    // ridge direction
    const drop = (dx: number, dz: number): number => {
      const r = 0.22, p = this.perch;
      return p.y - (this.roofY(p.x + dx * r, p.z + dz * r) + this.roofY(p.x - dx * r, p.z - dz * r)) / 2;
    };
    const dX = drop(1, 0), dZ = drop(0, 1);
    const alongX = this.prober.ok ? dX <= dZ : this.w >= this.h;
    this.peaked = this.prober.ok && Math.min(dX, dZ) > 0.09;
    this.ridge = new THREE.Vector3(alongX ? 1 : 0, 0, alongX ? 0 : 1);
    let len = 0;
    const lim = (alongX ? this.w : this.h) / 2;
    if (this.peaked) len = 0.08;
    else if (this.prober.ok) {
      for (let s = 0.12; s <= lim; s += 0.12) {
        const yA = this.roofY(this.perch.x + this.ridge.x * s, this.perch.z + this.ridge.z * s);
        const yB = this.roofY(this.perch.x - this.ridge.x * s, this.perch.z - this.ridge.z * s);
        if (Math.min(yA, yB) < this.perch.y - 0.1) break;
        len = s;
      }
    } else len = Math.max(0.15, this.ext[alongX ? 1 : 0] - 0.2);
    this.ridgeLen = len;

    // the door
    this.door = a.door ? a.door.clone() : new THREE.Vector3(0, 0, this.h / 2 + 0.1);
    this.door.y = 0;
    const df = this.faceOf(this.door);
    const [dnx, dnz] = FACE_N[df];
    const dn = new THREE.Vector3(dnx, 0, dnz);
    this.doorH = clamp(this.eave * 0.72, 0.3, 0.62);
    this.doorW = clamp(this.doorH * 0.56, 0.2, 0.34);
    const dHit = this.prober.cast(this.door.x + dnx * 0.6, this.doorH * 0.5, this.door.z + dnz * 0.6, -dnx, 0, -dnz, 1.4);
    const dp = dHit && dHit.dist < 1.2 ? dHit.p.clone()
      : new THREE.Vector3(dnx ? dnx * this.ext[df] : this.door.x, this.doorH * 0.5, dnz ? dnz * this.ext[df] : this.door.z);
    dp.y = this.doorH * 0.5;
    this.doorSpot = { p: dp, n: dn, yaw: Math.atan2(dnx, dnz), face: df };

    // windows
    const wins: Spot[] = [];
    for (const wp of a.windows || []) {
      if (!wp || !isFinite(wp.x + wp.y + wp.z)) continue;
      const f = this.faceOf(wp); const [nx, nz] = FACE_N[f];
      const n = new THREE.Vector3(nx, 0, nz);
      const p = wp.clone();
      const hit = this.prober.cast(wp.x + nx * 0.5, wp.y, wp.z + nz * 0.5, -nx, 0, -nz, 0.9);
      if (hit && Math.abs(hit.dist - 0.5) < 0.3) {
        p.copy(hit.p);
        const flat = Math.hypot(hit.n.x, hit.n.z);
        if (flat > 0.75 && (hit.n.x * nx + hit.n.z * nz) / flat > 0.6) n.set(hit.n.x / flat, 0, hit.n.z / flat);
      }
      wins.push({ p, n, yaw: Math.atan2(n.x, n.z), face: f });
    }
    if (!wins.length) {
      const y = clamp(this.eave * 0.56, 0.24, 0.8);
      const fr = this.lat(df) > 0.5 ? [-0.56, 0.56] : [0.62];
      for (const u of fr) wins.push(this.wall(df, u * this.lat(df), y));
      wins.push(this.wall((df + 1) % 4, 0, y));
      wins.push(this.wall((df + 3) % 4, 0, y));
    }
    this.windows = wins;
  }

  /** which wall a point belongs to */
  faceOf(p: THREE.Vector3): number {
    let best = 0, bv = -Infinity;
    for (let f = 0; f < 4; f++) { const v = (p.x * FACE_N[f][0] + p.z * FACE_N[f][1]) / this.ext[f]; if (v > bv) { bv = v; best = f; } }
    return best;
  }
  /** half-width of wall `f` (how far you can go sideways along it) */
  lat(f: number): number { return Math.min(this.ext[(f + 1) % 4], this.ext[(f + 3) % 4]); }
  /** sideways coordinate of a point along wall `f` (positive to the right, seen from outside) */
  lateral(f: number, p: THREE.Vector3): number { const [nx, nz] = FACE_N[f]; return p.x * nz - p.z * nx; }
  /** outward normal of wall `f` */
  normal(f: number, target = new THREE.Vector3()): THREE.Vector3 { return target.set(FACE_N[f][0], 0, FACE_N[f][1]); }
  yawOf(f: number): number { return Math.atan2(FACE_N[f][0], FACE_N[f][1]); }

  /** a point on wall `f`: `u` sideways from its centre, at height `y` */
  wall(f: number, u: number, y: number): Spot {
    const [nx, nz] = FACE_N[f]; const tx = nz, tz = -nx; const e = this.ext[f];
    const n = new THREE.Vector3(nx, 0, nz);
    const p = new THREE.Vector3(nx * e + tx * u, y, nz * e + tz * u);
    const hit = this.prober.cast(nx * (e + 0.8) + tx * u, y, nz * (e + 0.8) + tz * u, -nx, 0, -nz, 1.3);
    if (hit) {
      p.copy(hit.p);
      const flat = Math.hypot(hit.n.x, hit.n.z);
      if (flat > 0.75 && (hit.n.x * nx + hit.n.z * nz) / flat > 0.55) n.set(hit.n.x / flat, 0, hit.n.z / flat);
    }
    return { p, n, yaw: Math.atan2(n.x, n.z), face: f };
  }
  /** ground point outside wall `f`: `u` sideways, `d` out from the wall */
  out(f: number, u: number, d: number, y = 0): THREE.Vector3 {
    const [nx, nz] = FACE_N[f]; const e = this.ext[f] + d;
    return new THREE.Vector3(nx * e + nz * u, y, nz * e - nx * u);
  }
  /** ground point in the yard by the door: `u` sideways from the door, `d` out from the door wall */
  yard(u: number, d: number, y = 0): THREE.Vector3 {
    const f = this.doorSpot.face;
    return this.out(f, this.lateral(f, this.door) + u, d, y);
  }

  private roofY(x: number, z: number): number {
    const hit = this.prober.cast(x, this.top + 1, z, 0, -1, 0, this.top + 1.2);
    if (hit && hit.p.y > 0.15) return hit.p.y;
    return this.gableY(x, z);
  }
  private gableY(x: number, z: number): number {
    const alongX = this.ridge ? this.ridge.x > 0.5 : this.w >= this.h;
    const off = alongX ? Math.abs(z - this.perch.z) : Math.abs(x - this.perch.x);
    const run = Math.max(0.25, alongX ? this.ext[0] : this.ext[1]);
    const eave = this.eave ?? this.ridgeY * 0.56;
    return Math.max(eave, this.ridgeY - (off / run) * (this.ridgeY - eave));
  }
  /** the roof surface under (x, z): point and upward normal */
  roofAt(x: number, z: number): { p: THREE.Vector3; n: THREE.Vector3 } {
    const hit = this.prober.cast(x, this.top + 1, z, 0, -1, 0, this.top + 1.2);
    if (hit && hit.p.y > 0.15) { if (hit.n.y < 0) hit.n.negate(); return { p: hit.p, n: hit.n }; }
    const alongX = this.ridge.x > 0.5;
    const y = this.gableY(x, z);
    const run = Math.max(0.25, alongX ? this.ext[0] : this.ext[1]);
    const slope = (this.ridgeY - this.eave) / run;
    const side = alongX ? Math.sign(z - this.perch.z) || 1 : Math.sign(x - this.perch.x) || 1;
    const n = alongX ? new THREE.Vector3(0, 1, slope * side) : new THREE.Vector3(slope * side, 1, 0);
    if (y <= this.eave + 1e-4) n.set(0, 1, 0);
    return { p: new THREE.Vector3(x, y, z), n: n.normalize() };
  }
  /** a point on the ridge, `s` along it from the perch */
  ridgeAt(s: number): THREE.Vector3 {
    const k = clamp(s, -this.ridgeLen, this.ridgeLen);
    const x = this.perch.x + this.ridge.x * k, z = this.perch.z + this.ridge.z * k;
    return new THREE.Vector3(x, Math.max(this.roofY(x, z), this.perch.y - 0.12), z);
  }
  private eaveProbe(f: number, u: number, out?: number): number {
    const [nx, nz] = FACE_N[f]; const tx = nz, tz = -nx; const e = this.ext[f];
    for (const d of out !== undefined ? [out] : [0.05, -0.06]) {
      const hit = this.prober.cast(nx * (e + d) + tx * u, this.top + 1, nz * (e + d) + tz * u, 0, -1, 0, this.top + 1.2);
      if (hit && hit.p.y > 0.28) return hit.p.y;
    }
    return -1;
  }
  private overs: (number | undefined)[] = [];
  /** how far the roof oversails wall `f` (measured once, where the wall is a third of the way along) */
  overhang(f: number): number {
    let o = this.overs[f];
    if (o === undefined) {
      o = 0.05;
      if (this.prober.ok) {
        const found: number[] = [];
        for (const u of [-0.35, 0.35]) {
          let far = -1;
          for (let d = 0.03; d <= 0.36; d += 0.03) { if (this.eaveProbe(f, u * this.lat(f), d) > 0) far = d; else if (far >= 0) break; }
          if (far >= 0) found.push(far);
        }
        if (found.length) o = Math.min(...found);
      }
      this.overs[f] = o;
    }
    return o;
  }
  /** the roof's lower edge above wall `f`, `u` sideways: where icicles hang and bunting is tied */
  eaveAt(f: number, u: number): THREE.Vector3 {
    const [nx, nz] = FACE_N[f]; const tx = nz, tz = -nx; const o = this.overhang(f), e = this.ext[f] + o;
    let y = this.eaveProbe(f, u, o - 0.008);
    if (y <= 0) y = this.eaveProbe(f, u);
    return new THREE.Vector3(nx * e + tx * u, y > 0 ? y : this.eave, nz * e + tz * u);
  }
  /** length of the walk round the building, `d` out from the walls */
  aroundLen(d: number): number {
    const hx = (this.ext[1] + this.ext[3]) / 2 + d, hz = (this.ext[0] + this.ext[2]) / 2 + d, r = Math.min(hx, hz, 0.2 + d);
    return 4 * (hx - r) + 4 * (hz - r) + TAU * r;
  }
  /** a point on that walk (a rounded rectangle), `u` in 0..1 going round; yaw is the heading */
  around(d: number, u: number, out: LoopPt): LoopPt {
    const hx = (this.ext[1] + this.ext[3]) / 2 + d, hz = (this.ext[0] + this.ext[2]) / 2 + d, r = Math.min(hx, hz, 0.2 + d);
    const cx = (this.ext[1] - this.ext[3]) / 2, cz = (this.ext[0] - this.ext[2]) / 2;
    const A = 2 * (hx - r), B = 2 * (hz - r), q = (Math.PI / 2) * r, P = 2 * A + 2 * B + 4 * q;
    let k = (((u % 1) + 1) % 1) * P, x = 0, z = 0, dx = 1, dz = 0;
    const arc = (ox: number, oz: number, a0: number): void => { const a = a0 - k / r; x = ox + Math.cos(a) * r; z = oz + Math.sin(a) * r; dx = Math.sin(a); dz = -Math.cos(a); };
    if (k < A) { x = -(hx - r) + k; z = hz; dx = 1; dz = 0; }
    else if ((k -= A) < q) arc(hx - r, hz - r, Math.PI / 2);
    else if ((k -= q) < B) { x = hx; z = hz - r - k; dx = 0; dz = -1; }
    else if ((k -= B) < q) arc(hx - r, -(hz - r), 0);
    else if ((k -= q) < A) { x = hx - r - k; z = -hz; dx = -1; dz = 0; }
    else if ((k -= A) < q) arc(-(hx - r), -(hz - r), -Math.PI / 2);
    else if ((k -= q) < B) { x = -hx; z = -(hz - r) + k; dx = 0; dz = 1; }
    else { k -= B; arc(-(hx - r), hz - r, Math.PI); }
    out.x = cx + x; out.z = cz + z; out.yaw = Math.atan2(dx, dz);
    return out;
  }
  /**
   * The emptiest stretch of wall for something `halfW` wide either side: keeps clear of
   * the door and the windows. Prefers the door wall when it has room.
   */
  freeWall(halfW: number, faces?: number[]): { face: number; u: number; room: number } {
    const df = this.doorSpot.face, doorU = this.lateral(df, this.door);
    let best = { face: (df + 1) % 4, u: 0, room: -Infinity }, bs = -Infinity;
    for (const f of faces || [df, (df + 1) % 4, (df + 3) % 4]) {
      const lim = this.lat(f) - halfW - 0.04;
      for (let u = -Math.max(0, lim); u <= Math.max(0, lim) + 1e-6; u += 0.04) {
        let room = lim < 0 ? lim : 9;
        if (f === df) room = Math.min(room, Math.abs(u - doorU) - this.doorW / 2 - 0.05);
        for (const w of this.windows) if (w.face === f) room = Math.min(room, Math.abs(u - this.lateral(f, w.p)) - 0.15);
        const sc = Math.min(room, halfW * 1.25) + (f === df ? 0.05 : 0) - Math.abs(u) * 0.02;
        if (sc > bs) { bs = sc; best = { face: f, u, room }; }
      }
    }
    return best;
  }
  /** is there open air for `len` straight down from this point? (things that hang need it) */
  hangsFree(p: THREE.Vector3, len: number): boolean {
    return !this.prober.cast(p.x, p.y - 0.03, p.z, 0, -1, 0, len);
  }
  /** where smoke and small dragons go: the chimney top, or the perch when there is no chimney */
  stack(): THREE.Vector3 { return (this.chimney || this.perch).clone(); }

  /**
   * A group that pops in when the visual appears and shrinks away when it
   * leaves. Build props inside holders; the wrapper owns their scale.
   */
  holder(x = 0, y = 0, z = 0, ry = 0): THREE.Group {
    const g = bone(this.group, x, y, z, 0, ry, 0);
    this.holders.push({ g, delay: Math.min(0.5, this.holders.length * 0.07) });
    return g;
  }
  holderAt(p: THREE.Vector3, ry = 0): THREE.Group { return this.holder(p.x, p.y, p.z, ry); }
  /** a holder standing on a wall spot, its +z pointing out of the wall */
  holderOn(s: Spot, lift = 0): THREE.Group { return this.holder(s.p.x + s.n.x * lift, s.p.y, s.p.z + s.n.z * lift, s.yaw); }
}

/**
 * A point on the roof slope that faces the street (or a side slope when it is the gable that
 * faces it): `v` of the way down from the ridge, `u` (-1..1) along it.
 */
export function slopeSpot(s: Site, v: number, u: number): { p: THREE.Vector3; n: THREE.Vector3 } {
  const dn = s.doorSpot.n;
  const facing = s.peaked || Math.abs(dn.x * s.ridge.x + dn.z * s.ridge.z) < 0.5;
  const sd = facing ? dn.clone() : new THREE.Vector3(s.ridge.z, 0, -s.ridge.x).multiplyScalar(s.seed & 4 ? 1 : -1);
  const run = s.ext[s.faceOf(sd)];
  const along = facing ? new THREE.Vector3(dn.z, 0, -dn.x) : s.ridge;
  const lim = s.peaked ? run * 0.3 : Math.max(0.05, s.ridgeLen * 0.8);
  const r = s.roofAt(s.perch.x + sd.x * run * v + along.x * u * lim, s.perch.z + sd.z * run * v + along.z * u * lim);
  if (r.n.y < 0.35) r.n.copy(sd).multiplyScalar(0.6).setY(1).normalize();
  return r;
}

// ───────────────────────── the handle ─────────────────────────

/** What a visual's per-frame code is given. One object, reused. */
export interface Frame {
  env: Env;
  /** seconds, offset per building so neighbours are not in step */
  t: number;
  /** seconds since this visual appeared */
  age: number;
  dt: number;
  /** -1 while the incident lasts; 0..1 through the custom exit once leave() is called */
  out: number;
}
export interface Life {
  update(f: Frame): void;
  /** seconds of custom exit animation before the props shrink away (default none) */
  exitDur?: number;
  /** the custom exit already removes everything: skip the closing shrink */
  keepHolders?: boolean;
  dispose?(): void;
}
export type Build = (s: Site) => Life;

/** 0..1: eases in over `inDur` seconds as a visual appears, and back out through its custom exit */
export function presence(f: Frame, inDur = 0.6): number {
  return smooth(f.age / inDur) * (f.out >= 0 ? 1 - smooth(f.out) : 1);
}

export function runVisual(id: string, host: VisualHost, ctx: RenderCtx, build: Build): VisualHandle {
  const group = new THREE.Group();
  group.name = 'visual:' + id; group.userData.isVisual = true;
  let site: Site | null = null;
  let life: Life;
  try {
    site = new Site(host, ctx, group, id);
    life = build(site);
    finishTree(group, site.own);
  } catch (err) {
    console.warn('[visuals] could not build ' + id, err);
    group.clear();
    life = { update() { /* nothing to show */ } };
  }
  const holders = site ? site.holders : [];
  const frame: Frame = { env: ctx.env, t: site ? hash(site.seed) * 97 : 0, age: 0, dt: 0, out: -1 };
  const exitDur = Math.max(0, life.exitDur ?? 0), shrink = life.keepHolders ? 0 : 0.34;
  let last = NaN, entering = holders.length > 0, leaving = false, exitT = 0, finished = false, disposed = false;
  let done: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  for (const h of holders) { h.g.visible = false; h.g.scale.setScalar(0.001); }

  const finish = (): void => {
    if (finished) return;
    finished = true; group.visible = false;
    if (timer) { clearTimeout(timer); timer = null; }
    const d = done; done = null; if (d) d();
  };

  return {
    group,
    update(env: Env): void {
      if (finished || disposed) return;
      let dt = env.time - last; if (!(dt > 0)) dt = env.dt > 0 ? env.dt : 0;
      last = env.time; dt = dt > 0.1 ? 0.1 : dt;
      frame.env = env; frame.dt = dt; frame.t += dt; frame.age += dt;
      if (entering) {
        let all = true;
        for (const h of holders) {
          const k = (frame.age - h.delay) / 0.4;
          if (k < 1) all = false;
          h.g.visible = k > 0; h.g.scale.setScalar(k <= 0 ? 0.001 : k >= 1 ? 1 : Math.max(0.001, outBack(k)));
        }
        if (all) entering = false;
      }
      if (leaving) {
        exitT += dt;
        frame.out = exitDur > 0 ? clamp(exitT / exitDur) : 1;
        if (shrink > 0 && exitT > exitDur) {
          const k = clamp((exitT - exitDur) / shrink), s = Math.max(0.001, 1 - inBack(k) * 1.0);
          for (const h of holders) { h.g.scale.setScalar(s); if (k >= 1) h.g.visible = false; }
        }
      }
      try { life.update(frame); } catch (err) { if (!finished) { console.warn('[visuals] ' + id + ' update failed', err); life = { update() { /* stopped */ } }; } }
      if (leaving && exitT >= exitDur + shrink) finish();
    },
    leave(cb: () => void): void {
      if (finished || disposed) { cb(); return; }
      if (leaving) { const prev = done; done = () => { if (prev) prev(); cb(); }; return; }
      leaving = true; entering = false; done = cb; exitT = 0; frame.out = 0;
      for (const h of holders) { h.g.visible = true; if (h.g.scale.x < 0.5) h.g.scale.setScalar(1); }
      // if nobody keeps calling update(), still let go
      timer = setTimeout(finish, (exitDur + shrink) * 2500 + 2500);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      if (timer) { clearTimeout(timer); timer = null; }
      try { if (life.dispose) life.dispose(); } catch { /* ignore */ }
      if (site) for (const d of site.own) { try { d.dispose(); } catch { /* ignore */ } }
      group.removeFromParent(); group.clear();
    },
  };
}
