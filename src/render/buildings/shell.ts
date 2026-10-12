/**
 * Shells: cut copies of a body, taken straight off its meshes whatever built
 * them. A building under construction is its own body sliced at a height that
 * rises with progress; a ruin is the same body cut along two broken planes.
 * The copy is two-sided, so a half-built wall has an inside.
 *
 * A snapshot is taken once (positions baked into body space); cutting writes
 * into buffers allocated once, so a scaffolded house re-cuts itself every step
 * of progress without making garbage.
 */
import * as THREE from 'three';
import type { BuiltBody } from './types';
import { mat } from '../palette';

// ───────────────────────── two-sided twins of shared materials ─────────────────────────

const twins = new Map<THREE.Material, THREE.Material>();
/** the same paint, visible from behind as well (cached, shared by every shell on the table) */
export function twoSided(m: THREE.Material): THREE.Material {
  if (m.side === THREE.DoubleSide) return m;
  let t = twins.get(m);
  if (!t) {
    const s = m as THREE.MeshStandardMaterial;
    if (s.isMeshStandardMaterial && !s.map && !s.emissiveMap) {
      t = mat(s.color.getHex(), {
        rough: s.roughness, metal: s.metalness, flat: s.flatShading, emissive: s.emissive.getHex(), emissiveIntensity: s.emissiveIntensity,
        transparent: s.transparent, opacity: s.opacity, side: THREE.DoubleSide, vertexColors: s.vertexColors,
      });
    } else { t = m.clone(); t.side = THREE.DoubleSide; }
    twins.set(m, t);
  }
  return t;
}

// ───────────────────────── snapshots ─────────────────────────

/** one mesh of a body, flattened: 9 floats per triangle in body space, plus whatever else its material reads */
export interface Snap {
  n: number;
  pos: Float32Array;
  col: Float32Array | null;
  uv: Float32Array | null;
  nor: Float32Array | null;
  material: THREE.Material;
  cast: boolean;
  maxY: number;
  sphere: THREE.Sphere;
}

const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _n3 = new THREE.Matrix3(), _v = new THREE.Vector3();

function snapOne(m: THREE.Mesh, skip?: (m: THREE.Mesh) => boolean): Snap | null {
  const g = m.geometry, P = g?.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!P || Array.isArray(m.material)) return null;
  if (m.name === 'snow' || m.name === 'cloth' || m.userData.lifeUnit !== undefined) return null;
  const material = m.material as THREE.MeshStandardMaterial;
  // things that burn or glow do not belong on a building site or in a ruin
  if (material.isMeshStandardMaterial && material.emissiveIntensity > 0.3 && material.emissive.r + material.emissive.g + material.emissive.b > 0.05) return null;
  if (skip && skip(m)) return null;
  _m.multiplyMatrices(_inv, m.matrixWorld);
  const flip = _m.determinant() < 0;
  const idx = g.getIndex(), count = idx ? idx.count : P.count, n = Math.floor(count / 3);
  if (!n) return null;
  const C = material.vertexColors ? g.getAttribute('color') as THREE.BufferAttribute | undefined : undefined;
  const U = material.map ? g.getAttribute('uv') as THREE.BufferAttribute | undefined : undefined;
  const N = material.flatShading === false ? g.getAttribute('normal') as THREE.BufferAttribute | undefined : undefined;
  const pos = new Float32Array(n * 9), col = C ? new Float32Array(n * 9) : null, uv = U ? new Float32Array(n * 6) : null, nor = N ? new Float32Array(n * 9) : null;
  if (N) _n3.getNormalMatrix(_m);
  let maxY = -Infinity;
  const box = new THREE.Box3();
  for (let t = 0; t < n; t++) {
    for (let j = 0; j < 3; j++) {
      const k = flip && j ? 3 - j : j, vi = idx ? idx.getX(t * 3 + k) : t * 3 + k, o = t * 9 + j * 3;
      _v.fromBufferAttribute(P, vi).applyMatrix4(_m);
      pos[o] = _v.x; pos[o + 1] = _v.y; pos[o + 2] = _v.z;
      if (_v.y > maxY) maxY = _v.y;
      box.expandByPoint(_v);
      if (col && C) { col[o] = C.getX(vi); col[o + 1] = C.getY(vi); col[o + 2] = C.getZ(vi); }
      if (uv && U) { uv[t * 6 + j * 2] = U.getX(vi); uv[t * 6 + j * 2 + 1] = U.getY(vi); }
      if (nor && N) { _v.fromBufferAttribute(N, vi).applyMatrix3(_n3).normalize(); nor[o] = _v.x; nor[o + 1] = _v.y; nor[o + 2] = _v.z; }
    }
  }
  return { n, pos, col, uv, nor, material, cast: m.castShadow, maxY, sphere: box.getBoundingSphere(new THREE.Sphere()) };
}

/**
 * Flatten every visible mesh of a body into body space. Flowers, cloth, snow and anything
 * glowing are left out; `skip` leaves out more (a ruin has no roof).
 */
export function snapshot(body: BuiltBody, skip?: (m: THREE.Mesh) => boolean): Snap[] {
  const root = body.group;
  root.updateWorldMatrix(true, true);
  _inv.copy(root.matrixWorld).invert();
  const out: Snap[] = [];
  const walk = (o: THREE.Object3D): void => {
    for (const c of o.children) {
      if (!c.visible) continue;
      const m = c as THREE.Mesh;
      if (m.isMesh) { const s = snapOne(m, skip); if (s) out.push(s); }
      walk(c);
    }
  };
  walk(root);
  return out;
}

// ───────────────────────── cutting ─────────────────────────

/** an empty shell for a snapshot, with room for (1 + `extra`) times its triangles */
export function makeShell(sn: Snap, extra: number): THREE.Mesh {
  const cap = sn.n * 3 * (1 + extra);
  const g = new THREE.BufferGeometry();
  const attr = (size: number) => { const a = new THREE.BufferAttribute(new Float32Array(cap * size), size); a.setUsage(THREE.DynamicDrawUsage); return a; };
  g.setAttribute('position', attr(3));
  if (sn.col) g.setAttribute('color', attr(3));
  if (sn.uv) g.setAttribute('uv', attr(2));
  if (sn.nor) g.setAttribute('normal', attr(3));
  g.boundingSphere = sn.sphere.clone();
  g.setDrawRange(0, 0);
  g.userData.owned = true;
  const mesh = new THREE.Mesh(g, twoSided(sn.material));
  mesh.name = 'shell'; mesh.castShadow = sn.cast; mesh.receiveShadow = true;
  mesh.userData.snap = sn;
  return mesh;
}

// one vertex on the cutting bench: x y z, r g b, u v, nx ny nz
const S = 11, MAXV = 10;
const benchA = new Float32Array(MAXV * S), benchB = new Float32Array(MAXV * S);

/**
 * Cut a shell: keep what lies on the positive side of every plane (body space).
 * With `append` the result is added to what the shell already holds, so a shape that is a
 * union of convex pieces can be cut one piece at a time. Returns the number of vertices
 * now drawn. No allocation.
 */
export function clipShell(mesh: THREE.Mesh, planes: readonly THREE.Plane[], append = false): number {
  const sn = mesh.userData.snap as Snap, g = mesh.geometry;
  const PA = g.getAttribute('position') as THREE.BufferAttribute, CA = g.getAttribute('color') as THREE.BufferAttribute | undefined;
  const UA = g.getAttribute('uv') as THREE.BufferAttribute | undefined, NA = g.getAttribute('normal') as THREE.BufferAttribute | undefined;
  const op = PA.array as Float32Array, oc = CA ? CA.array as Float32Array : null, ou = UA ? UA.array as Float32Array : null, on = NA ? NA.array as Float32Array : null;
  const pos = sn.pos, col = sn.col, uv = sn.uv, nor = sn.nor, np = planes.length;
  const cap = PA.count - 3 * (np + 1);
  let w = append ? g.drawRange.count : 0; // vertices written
  for (let t = 0; t < sn.n && w <= cap; t++) {
    const b = t * 9;
    let inside = true, gone = false;
    for (let p = 0; p < np; p++) {
      const pl = planes[p], nx = pl.normal.x, ny = pl.normal.y, nz = pl.normal.z, d = pl.constant;
      const d0 = nx * pos[b] + ny * pos[b + 1] + nz * pos[b + 2] + d, d1 = nx * pos[b + 3] + ny * pos[b + 4] + nz * pos[b + 5] + d, d2 = nx * pos[b + 6] + ny * pos[b + 7] + nz * pos[b + 8] + d;
      if (d0 < 0 && d1 < 0 && d2 < 0) { gone = true; break; }
      if (d0 < 0 || d1 < 0 || d2 < 0) inside = false;
    }
    if (gone) continue;
    if (inside) {
      const o = w * 3;
      for (let i = 0; i < 9; i++) op[o + i] = pos[b + i];
      if (oc && col) for (let i = 0; i < 9; i++) oc[o + i] = col[b + i];
      if (on && nor) for (let i = 0; i < 9; i++) on[o + i] = nor[b + i];
      if (ou && uv) for (let i = 0; i < 6; i++) ou[w * 2 + i] = uv[t * 6 + i];
      w += 3;
      continue;
    }
    // the slow road: the triangle straddles a cut
    let A = benchA, B = benchB, cnt = 3;
    for (let j = 0; j < 3; j++) {
      const o = j * S, q = b + j * 3;
      A[o] = pos[q]; A[o + 1] = pos[q + 1]; A[o + 2] = pos[q + 2];
      if (col) { A[o + 3] = col[q]; A[o + 4] = col[q + 1]; A[o + 5] = col[q + 2]; }
      if (uv) { A[o + 6] = uv[t * 6 + j * 2]; A[o + 7] = uv[t * 6 + j * 2 + 1]; }
      if (nor) { A[o + 8] = nor[q]; A[o + 9] = nor[q + 1]; A[o + 10] = nor[q + 2]; }
    }
    for (let p = 0; p < np && cnt >= 3; p++) {
      const pl = planes[p], nx = pl.normal.x, ny = pl.normal.y, nz = pl.normal.z, d = pl.constant;
      let out = 0;
      for (let i = 0; i < cnt; i++) {
        const a = i * S, c = ((i + 1) % cnt) * S;
        const da = nx * A[a] + ny * A[a + 1] + nz * A[a + 2] + d, dc = nx * A[c] + ny * A[c + 1] + nz * A[c + 2] + d;
        if (da >= 0) { const o = out * S; for (let k = 0; k < S; k++) B[o + k] = A[a + k]; out++; }
        if ((da >= 0) !== (dc >= 0)) { const f = da / (da - dc), o = out * S; for (let k = 0; k < S; k++) B[o + k] = A[a + k] + (A[c + k] - A[a + k]) * f; out++; }
      }
      cnt = out;
      const sw = A; A = B; B = sw;
    }
    for (let i = 1; i + 1 < cnt; i++) {
      for (let j = 0; j < 3; j++) {
        const a = (j === 0 ? 0 : i + j - 1) * S, o = w * 3;
        op[o] = A[a]; op[o + 1] = A[a + 1]; op[o + 2] = A[a + 2];
        if (oc) { oc[o] = A[a + 3]; oc[o + 1] = A[a + 4]; oc[o + 2] = A[a + 5]; }
        if (ou) { ou[w * 2] = A[a + 6]; ou[w * 2 + 1] = A[a + 7]; }
        if (on) { on[o] = A[a + 8]; on[o + 1] = A[a + 9]; on[o + 2] = A[a + 10]; }
        w++;
      }
    }
  }
  g.setDrawRange(0, w);
  PA.needsUpdate = true;
  if (CA) CA.needsUpdate = true;
  if (UA) UA.needsUpdate = true;
  if (NA) NA.needsUpdate = true;
  return w;
}

/**
 * The highest point still drawn on a set of cut shells that has something under it all the way
 * to the ground (a cut can leave a lantern hanging in the air: a crow would not trust it).
 * With `from`, the highest such point at least `clear` away from it on the ground plan.
 */
export function highPoint(shells: readonly THREE.Mesh[], from: THREE.Vector3 | null, clear: number): THREE.Vector3 | null {
  // lowest drawn vertex over each patch of ground
  const G = 0.12, floor = new Map<number, number>();
  const key = (x: number, z: number) => (Math.round(x / G) + 512) * 1024 + Math.round(z / G) + 512;
  for (const sh of shells) {
    const a = (sh.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array, n = sh.geometry.drawRange.count;
    for (let i = 0; i < n; i++) { const k = key(a[i * 3], a[i * 3 + 2]), y = a[i * 3 + 1], f = floor.get(k); if (f === undefined || y < f) floor.set(k, y); }
  }
  let best = -Infinity, bx = 0, bz = 0;
  for (const sh of shells) {
    const a = (sh.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array, n = sh.geometry.drawRange.count;
    for (let i = 0; i < n; i++) {
      const x = a[i * 3], y = a[i * 3 + 1], z = a[i * 3 + 2];
      if (y <= best) continue;
      if (from && Math.hypot(x - from.x, z - from.z) < clear) continue;
      if ((floor.get(key(x, z)) ?? 9) > 0.22) continue;
      best = y; bx = x; bz = z;
    }
  }
  return best > -Infinity ? new THREE.Vector3(bx, best, bz) : null;
}

/** give back the room a finished shell did not use */
export function trimShell(mesh: THREE.Mesh): void {
  const g = mesh.geometry, n = g.drawRange.count;
  for (const name of ['position', 'color', 'uv', 'normal'] as const) {
    const a = g.getAttribute(name) as THREE.BufferAttribute | undefined;
    if (a) g.setAttribute(name, new THREE.BufferAttribute((a.array as Float32Array).slice(0, n * a.itemSize), a.itemSize));
  }
}
