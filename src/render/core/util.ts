/**
 * render-core helpers: small maths, deterministic noise, a vertex-colour
 * geometry baker and canvas-texture utilities. Internal to src/render/core.
 */
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;
export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** frame-rate independent approach: cur moves toward goal with rate lambda (1/s) */
export const damp = (cur: number, goal: number, lambda: number, dt: number): number => goal + (cur - goal) * Math.exp(-lambda * dt);
export const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t: number, s = 1.70158): number => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);

/** stateless hash → 0..1 (same family as sim/core hash01, cosmetic only) */
export function hash01(n: number): number {
  let t = (n + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function hash2(x: number, y: number): number {
  return hash01(Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263));
}
/** smooth value noise, 0..1 */
export function vnoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number, oct = 3): number {
  let s = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) { s += vnoise(x, y) * a; n += a; x = x * 2.03 + 17.1; y = y * 2.03 + 9.7; a *= 0.5; }
  return s / n;
}
/** seeded stream */
export function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    let t = (s = (s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const css = (hex: number): string => '#' + (hex & 0xffffff).toString(16).padStart(6, '0');
export function cssMix(a: number, b: number, t: number): string {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return `rgb(${Math.round(lerp(ar, br, t))},${Math.round(lerp(ag, bg, t))},${Math.round(lerp(ab, bb, t))})`;
}

// ───────────── transforms ─────────────

const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
/** translate · rotate (XYZ euler) · scale */
export function TRS(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx): THREE.Matrix4 {
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
}
export function composeInto(m: THREE.Matrix4, x: number, y: number, z: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number): THREE.Matrix4 {
  return m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
}

// ───────────── vertex-colour geometry baker ─────────────

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3();
const _ab = new THREE.Vector3(), _ac = new THREE.Vector3(), _col = new THREE.Color(), _nm = new THREE.Matrix3();

/**
 * Bakes many small primitives into one non-indexed, vertex-coloured geometry
 * so a whole prop is one draw call. Colours are given as sRGB hex.
 */
export class Geo {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];
  private uvs: number[] = [];
  /** number of vertices so far */
  get count(): number { return this.pos.length / 3; }

  /**
   * Add `g` transformed by `m`, painted `color`. `flat` recomputes face normals
   * (carved look); otherwise the source normals are kept (turned metal, wax).
   * The source geometry is disposed unless `keep`. Pass a negative colour to
   * keep the source's own vertex colours.
   */
  add(g: THREE.BufferGeometry, m: THREE.Matrix4 | null, color: number, flat = true, keep = false): this {
    const src = g.index ? g.toNonIndexed() : g;
    const p = src.getAttribute('position') as THREE.BufferAttribute;
    const n = src.getAttribute('normal') as THREE.BufferAttribute | undefined;
    const u = src.getAttribute('uv') as THREE.BufferAttribute | undefined;
    // a negative colour keeps the source's own vertex colours (for nesting baked parts)
    const own = color < 0 ? (src.getAttribute('color') as THREE.BufferAttribute | undefined) : undefined;
    _col.setHex(color < 0 ? 0xffffff : color);
    const mirrored = m ? m.determinant() < 0 : false;
    if (m) _nm.getNormalMatrix(m);
    for (let i = 0; i + 2 < p.count; i += 3) {
      const i0 = i, i1 = mirrored ? i + 2 : i + 1, i2 = mirrored ? i + 1 : i + 2;
      _a.fromBufferAttribute(p, i0); _b.fromBufferAttribute(p, i1); _c.fromBufferAttribute(p, i2);
      if (m) { _a.applyMatrix4(m); _b.applyMatrix4(m); _c.applyMatrix4(m); }
      this.pos.push(_a.x, _a.y, _a.z, _b.x, _b.y, _b.z, _c.x, _c.y, _c.z);
      if (flat || !n) {
        _n.crossVectors(_ab.subVectors(_b, _a), _ac.subVectors(_c, _a));
        if (_n.lengthSq() < 1e-14) _n.set(0, 1, 0); else _n.normalize();
        this.nor.push(_n.x, _n.y, _n.z, _n.x, _n.y, _n.z, _n.x, _n.y, _n.z);
      } else {
        for (const k of [i0, i1, i2]) {
          _n.fromBufferAttribute(n, k);
          if (m) _n.applyMatrix3(_nm).normalize();
          this.nor.push(_n.x, _n.y, _n.z);
        }
      }
      for (const k of [i0, i1, i2]) {
        if (own) this.col.push(own.getX(k), own.getY(k), own.getZ(k)); else this.col.push(_col.r, _col.g, _col.b);
        if (u) this.uvs.push(u.getX(k), u.getY(k)); else this.uvs.push(0, 0);
      }
    }
    if (src !== g) src.dispose();
    if (!keep) g.dispose();
    return this;
  }

  /** a single flat quad a-b-c-d (counter-clockwise seen from the lit side) */
  quad(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, dx: number, dy: number, dz: number, color: number): this {
    _col.setHex(color);
    _a.set(ax, ay, az); _b.set(bx, by, bz); _c.set(cx, cy, cz);
    _n.crossVectors(_ab.subVectors(_b, _a), _ac.subVectors(_c, _a)).normalize();
    this.pos.push(ax, ay, az, bx, by, bz, cx, cy, cz, ax, ay, az, cx, cy, cz, dx, dy, dz);
    for (let i = 0; i < 6; i++) { this.nor.push(_n.x, _n.y, _n.z); this.col.push(_col.r, _col.g, _col.b); }
    this.uvs.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
    return this;
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** jitter an (indexed or not) geometry's vertices consistently, for hand-carved lumps */
export function jitter(g: THREE.BufferGeometry, amount: number, seed: number): THREE.BufferGeometry {
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    // hash on the quantised position so duplicated verts move together
    const k = Math.round(x * 97) * 73856093 ^ Math.round(y * 97) * 19349663 ^ Math.round(z * 97) * 83492791 ^ seed;
    p.setXYZ(i, x + (hash01(k) - 0.5) * amount, y + (hash01(k + 1) - 0.5) * amount, z + (hash01(k + 2) - 0.5) * amount);
  }
  p.needsUpdate = true;
  return g;
}

export function lathe(points: [number, number][], segments = 12): THREE.LatheGeometry {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), segments);
}

// ───────────── canvases ─────────────

export function makeCanvas(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  draw(g, w, h);
  return c;
}
export function canvasTex(c: HTMLCanvasElement, opts: { repeat?: boolean; srgb?: boolean; aniso?: number; mip?: boolean } = {}): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = opts.aniso ?? 4;
  if (opts.mip === false) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }
  return t;
}
/** soft round blob, white centre fading to transparent: halos, contact shadows */
export function blobTexture(size = 128, inner = 0.0, power = 1.6): THREE.CanvasTexture {
  const c = makeCanvas(size, size, (g, w) => {
    const img = g.createImageData(w, w);
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
      const dx = (x + 0.5) / w * 2 - 1, dy = (y + 0.5) / w * 2 - 1;
      const d = Math.sqrt(dx * dx + dy * dy);
      const a = Math.pow(1 - smoothstep(inner, 1, d), power);
      const i = (y * w + x) * 4;
      img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255; img.data[i + 3] = Math.round(a * 255);
    }
    g.putImageData(img, 0, 0);
  });
  return canvasTex(c, { srgb: false });
}

export function disposeTree(o: THREE.Object3D): void {
  o.traverse(c => {
    const m = c as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
  });
}
