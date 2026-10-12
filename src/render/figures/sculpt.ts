/**
 * Sculpt: carve one figurine part out of many primitives and bake it into a
 * single vertex-coloured geometry (one draw call, one shared material).
 *
 * Turned parts (peg bodies, heads, mittens) keep smooth normals so they read
 * as lathe work; carved parts (hats, hair, tools) get face normals so they
 * read as whittled. Colour is per face, so paint has crisp edges.
 *
 * Only used when a figure is built, never per frame.
 */
import * as THREE from 'three';

/** colour picked per face from its centroid in the primitive's own space */
export type ColorFn = (x: number, y: number, z: number) => number;
export type Paint = number | ColorFn;

const _m = new THREE.Matrix4(), _fm = new THREE.Matrix4(), _nm = new THREE.Matrix3();
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _t = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _na = new THREE.Vector3(), _nb = new THREE.Vector3(), _nc = new THREE.Vector3();
const _ab = new THREE.Vector3(), _ac = new THREE.Vector3(), _col = new THREE.Color();

const linCache = new Map<number, [number, number, number]>();
function linear(hex: number): [number, number, number] {
  let v = linCache.get(hex);
  if (!v) { _col.setHex(hex); v = [_col.r, _col.g, _col.b]; linCache.set(hex, v); }
  return v;
}

const prims = new Map<string, THREE.BufferGeometry>();
function prim(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = prims.get(key);
  if (!g) { g = make(); prims.set(key, g); }
  return g;
}
const icoGeo = (detail: number) => prim('ico' + detail, () => new THREE.IcosahedronGeometry(1, detail));
const boxGeo = () => prim('box', () => new THREE.BoxGeometry(1, 1, 1));

/** one ring of a lathe profile */
export interface Ring { r: number; y: number; /** hard edge here (a turned groove) */ crease?: boolean }

export class Sculpt {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];
  private frames: THREE.Matrix4[] = [];
  private hasFrame = false;

  /** Everything added until popFrame() is scaled, turned and moved as a block (a hat pushed back, a tiny hat on an ogre). */
  pushFrame(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1): this {
    const m = new THREE.Matrix4().compose(_t.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(s, s, s));
    if (this.frames.length) m.premultiply(this.frames[this.frames.length - 1]!);
    this.frames.push(m); this.hasFrame = true;
    return this;
  }
  popFrame(): this { this.frames.pop(); this.hasFrame = this.frames.length > 0; return this; }

  private xf(x: number, y: number, z: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number): THREE.Matrix4 {
    _m.compose(_t.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    if (this.hasFrame) _m.premultiply(this.frames[this.frames.length - 1]!);
    return _m;
  }

  /** Bake any geometry in. `flat`: carved facets; otherwise the geometry's own (smooth) normals. */
  add(g: THREE.BufferGeometry, paint: Paint, flat: boolean, m: THREE.Matrix4): this {
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    const n = g.getAttribute('normal') as THREE.BufferAttribute | undefined;
    const idx = g.getIndex();
    const tris = (idx ? idx.count : p.count) / 3;
    const flip = m.determinant() < 0;
    _nm.getNormalMatrix(m);
    const fn = typeof paint === 'function' ? paint : null;
    let rgb = fn ? null : linear(paint as number);
    for (let i = 0; i < tris; i++) {
      const ia = idx ? idx.getX(i * 3) : i * 3;
      let ib = idx ? idx.getX(i * 3 + 1) : i * 3 + 1;
      let ic = idx ? idx.getX(i * 3 + 2) : i * 3 + 2;
      if (flip) { const k = ib; ib = ic; ic = k; }
      _a.fromBufferAttribute(p, ia); _b.fromBufferAttribute(p, ib); _c.fromBufferAttribute(p, ic);
      if (fn) rgb = linear(fn((_a.x + _b.x + _c.x) / 3, (_a.y + _b.y + _c.y) / 3, (_a.z + _b.z + _c.z) / 3));
      _a.applyMatrix4(m); _b.applyMatrix4(m); _c.applyMatrix4(m);
      if (flat || !n) {
        _ab.subVectors(_b, _a); _ac.subVectors(_c, _a); _na.crossVectors(_ab, _ac);
        if (_na.lengthSq() < 1e-14) continue;
        _na.normalize(); _nb.copy(_na); _nc.copy(_na);
      } else {
        _na.fromBufferAttribute(n, ia).applyMatrix3(_nm).normalize();
        _nb.fromBufferAttribute(n, ib).applyMatrix3(_nm).normalize();
        _nc.fromBufferAttribute(n, ic).applyMatrix3(_nm).normalize();
      }
      this.pos.push(_a.x, _a.y, _a.z, _b.x, _b.y, _b.z, _c.x, _c.y, _c.z);
      this.nor.push(_na.x, _na.y, _na.z, _nb.x, _nb.y, _nb.z, _nc.x, _nc.y, _nc.z);
      const c = rgb!;
      this.col.push(c[0], c[1], c[2], c[0], c[1], c[2], c[0], c[1], c[2]);
    }
    return this;
  }

  /** a ball: detail 0 = 20 faces (beads), 1 = 80, 2 = 320 (heads) */
  ball(r: number, paint: Paint, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, flat = true, detail = 1, rx = 0, ry = 0, rz = 0): this {
    return this.add(icoGeo(detail), paint, flat || detail === 0, this.xf(x, y, z, rx, ry, rz, r * sx, r * sy, r * sz));
  }
  box(w: number, h: number, d: number, paint: Paint, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): this {
    return this.add(boxGeo(), paint, true, this.xf(x, y, z, rx, ry, rz, w, h, d));
  }
  /** a cone standing on (x, y, z): base radius r, height h, point up before rotation */
  cone(r: number, h: number, paint: Paint, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, segs = 8, sz = 1, flat = true): this {
    const g = prim('cone' + segs, () => new THREE.ConeGeometry(1, 1, segs).translate(0, 0.5, 0));
    return this.add(g, paint, flat, this.xf(x, y, z, rx, ry, rz, r, h, r * sz));
  }
  /** a (tapered) cylinder standing on (x, y, z): rTop above, rBot below */
  cyl(rTop: number, rBot: number, h: number, paint: Paint, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, segs = 10, flat = true, sz = 1): this {
    const g = new THREE.CylinderGeometry(rTop, rBot, 1, segs).translate(0, 0.5, 0);
    this.add(g, paint, flat, this.xf(x, y, z, rx, ry, rz, 1, h, sz));
    g.dispose();
    return this;
  }
  /** a ring lying flat (axis up) before rotation; arc < 2π leaves a gap starting at +x going toward +z... see three TorusGeometry */
  torus(R: number, r: number, paint: Paint, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, radial = 5, tubular = 12, arc = Math.PI * 2, flat = true): this {
    const g = new THREE.TorusGeometry(R, r, radial, tubular, arc).rotateX(Math.PI / 2);
    this.add(g, paint, flat, this.xf(x, y, z, rx, ry, rz, 1, 1, 1));
    g.dispose();
    return this;
  }
  /**
   * Part of a sphere shell (caps, hoods, hair). theta runs from the top pole down (0..π);
   * phi runs around: 0.5π is the front (+z), 1.5π the back, 0 the right-hand side (−x), π the left (+x).
   */
  cap(r: number, paint: Paint, thetaStart: number, thetaLen: number, phiStart = 0, phiLen = Math.PI * 2, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, flat = true, wSeg = 10, hSeg = 5): this {
    const g = new THREE.SphereGeometry(1, wSeg, hSeg, phiStart, phiLen, thetaStart, thetaLen);
    this.add(g, paint, flat, this.xf(x, y, z, rx, ry, rz, r * sx, r * sy, r * sz));
    g.dispose();
    return this;
  }

  /**
   * Turned work. `rings` runs bottom to top. Each band between two rings takes one colour from
   * `paint(v, a, i)`: v = height fraction 0..1 at the band's middle, a = angle of the face centre
   * (0 = front, +z; positive toward the figure's left, +x; ±π = back), i = band index.
   * `a0..a1` limits the sweep (a cloak is a partial lathe around the back).
   * `phase`: 0.5 centres a column of faces on the front; 0 puts a seam there.
   */
  lathe(rings: Ring[], segs: number, paint: number | ((v: number, a: number, i: number) => number), smooth = true,
    x = 0, y = 0, z = 0, a0 = -Math.PI, a1 = Math.PI, phase = 0.5, sx = 1, sz = 1): this {
    const m = this.xf(x, y, z, 0, 0, 0, sx, 1, sz);
    _nm.getNormalMatrix(m);
    const full = a1 - a0 >= Math.PI * 2 - 1e-6;
    const step = (a1 - a0) / segs;
    const off = full ? (phase - 0.5) * step + step * 0.5 : 0;
    const yMin = rings[0]!.y, ySpan = (rings[rings.length - 1]!.y - yMin) || 1;
    // slope normals per band (in the profile plane): (nr, ny)
    const nb = rings.length - 1;
    const bnr: number[] = [], bny: number[] = [];
    for (let i = 0; i < nb; i++) {
      const p = rings[i]!, q = rings[i + 1]!;
      let dr = q.r - p.r, dy = q.y - p.y; const l = Math.hypot(dr, dy) || 1; dr /= l; dy /= l;
      bnr.push(dy); bny.push(-dr);
    }
    const ringN = (k: number, band: number): [number, number] => {
      // smooth across a ring unless it is creased or at an end
      const ring = rings[k]!;
      if (!smooth || ring.crease || k === 0 || k === nb) return [bnr[band]!, bny[band]!];
      const o = k === band ? band - 1 : band + 1;
      const nr = bnr[band]! + bnr[o]!, ny = bny[band]! + bny[o]!; const l = Math.hypot(nr, ny) || 1;
      return [nr / l, ny / l];
    };
    for (let i = 0; i < nb; i++) {
      const p = rings[i]!, q = rings[i + 1]!;
      if (p.r < 1e-6 && q.r < 1e-6) continue;
      const v = ((p.y + q.y) / 2 - yMin) / ySpan;
      const [n0r, n0y] = ringN(i, i), [n1r, n1y] = ringN(i + 1, i);
      for (let j = 0; j < segs; j++) {
        const aA = a0 + off + j * step, aB = aA + step, aM = (aA + aB) / 2;
        const hex = typeof paint === 'function' ? paint(v, Math.atan2(Math.sin(aM), Math.cos(aM)), i) : paint;
        const rgb = linear(hex);
        const sA = Math.sin(aA), cA = Math.cos(aA), sB = Math.sin(aB), cB = Math.cos(aB), sM = Math.sin(aM), cM = Math.cos(aM);
        // quad corners: p@A, p@B, q@B, q@A   (x = r sin a, z = r cos a)
        const emit = (r1: number, y1: number, s1: number, c1: number, nr1: number, ny1: number,
          r2: number, y2: number, s2: number, c2: number, nr2: number, ny2: number,
          r3: number, y3: number, s3: number, c3: number, nr3: number, ny3: number) => {
          _a.set(r1 * s1, y1, r1 * c1).applyMatrix4(m); _b.set(r2 * s2, y2, r2 * c2).applyMatrix4(m); _c.set(r3 * s3, y3, r3 * c3).applyMatrix4(m);
          _ab.subVectors(_b, _a); _ac.subVectors(_c, _a);
          if (_na.crossVectors(_ab, _ac).lengthSq() < 1e-14) return;
          if (smooth) {
            _na.set(nr1 * s1, ny1, nr1 * c1).applyMatrix3(_nm).normalize();
            _nb.set(nr2 * s2, ny2, nr2 * c2).applyMatrix3(_nm).normalize();
            _nc.set(nr3 * s3, ny3, nr3 * c3).applyMatrix3(_nm).normalize();
          } else {
            // carved: one normal per column, following the slope
            _na.set(bnr[i]! * sM, bny[i]!, bnr[i]! * cM).applyMatrix3(_nm).normalize(); _nb.copy(_na); _nc.copy(_na);
          }
          this.pos.push(_a.x, _a.y, _a.z, _b.x, _b.y, _b.z, _c.x, _c.y, _c.z);
          this.nor.push(_na.x, _na.y, _na.z, _nb.x, _nb.y, _nb.z, _nc.x, _nc.y, _nc.z);
          this.col.push(rgb[0], rgb[1], rgb[2], rgb[0], rgb[1], rgb[2], rgb[0], rgb[1], rgb[2]);
        };
        emit(p.r, p.y, sA, cA, n0r, n0y, p.r, p.y, sB, cB, n0r, n0y, q.r, q.y, sB, cB, n1r, n1y);
        emit(p.r, p.y, sA, cA, n0r, n0y, q.r, q.y, sB, cB, n1r, n1y, q.r, q.y, sA, cA, n1r, n1y);
      }
    }
    return this;
  }

  get empty(): boolean { return this.pos.length === 0; }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.col), 3));
    g.computeBoundingSphere();
    this.pos = []; this.nor = []; this.col = [];
    return g;
  }
}

/** `mix` two hex colours (0 = a, 1 = b) without touching the palette module's cache. */
export function blend(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}
export function shade(c: number, k: number): number { return k >= 0 ? blend(c, 0xffffff, k) : blend(c, 0x000000, -k); }
