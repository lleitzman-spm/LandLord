/**
 * Things every building shares: the bank of candle-lit window materials, the one
 * snow material whose depth is a single uniform, the seasonal grass and leaf
 * paints, and the helpers that read a body's surfaces (for snow, moss and holes).
 * All of it is driven once per frame by `tickShared(env)`, so a building's own
 * `update` stays nearly free.
 */
import * as THREE from 'three';
import { PAL, mat } from '../palette';
import type { Env } from '../api';
import type { Rng } from './parts';

// ───────────────────────── lit windows ─────────────────────────

/** how many differently-flickering candle materials the town shares (per pane colour) */
export const LIT_BANK = 6;
/** one bank of LIT_BANK materials per unlit pane colour: plain panes, the apothecary's green glass... */
const banks = new Map<number, { dark: THREE.Color; mats: THREE.MeshStandardMaterial[] }>();
const bankList: { dark: THREE.Color; mats: THREE.MeshStandardMaterial[] }[] = [];
let ghost: THREE.MeshStandardMaterial | null = null;
let dim: THREE.MeshStandardMaterial | null = null;
const cLit = new THREE.Color(PAL.windowLit);
/** the last night level the banks were driven to, so a bank made mid-evening is born lit */
let nightNow = 0, timeNow = 0;

function flicker(m: THREE.MeshStandardMaterial, dark: THREE.Color, i: number, t: number, n: number): void {
  // two slow sines and a fast one: a candle, not a strobe
  const f = 0.86 + 0.07 * Math.sin(t * (2.1 + i * 0.37) + i * 1.9) + 0.05 * Math.sin(t * (5.3 + i * 0.61) + i * 4.1) + 0.03 * Math.sin(t * 13.7 + i * 2.3);
  const g = Math.min(1, n * 1.6);
  m.color.copy(dark).lerp(cLit, g * 0.55);
  m.emissiveIntensity = g * f * 1.55;
}
// (lit panes stay flat-shaded like everything else: carved geometry carries no normals to shade smoothly with)
function bank(base: number): THREE.MeshStandardMaterial[] {
  let b = banks.get(base);
  if (!b) {
    b = { dark: new THREE.Color(base), mats: [] };
    for (let i = 0; i < LIT_BANK; i++) {
      const m = mat(base, { rough: 0.5, emissive: PAL.windowLit, emissiveIntensity: 0 }, true);
      flicker(m, b.dark, i, timeNow, nightNow);
      b.mats.push(m);
    }
    banks.set(base, b); bankList.push(b);
  }
  return b.mats;
}
/**
 * A window with a candle behind it: one of LIT_BANK shared materials that flicker out of step.
 * `base` is the pane's unlit colour (defaults to the ordinary dark pane).
 */
export function litMat(k: number, base: number = PAL.window): THREE.MeshStandardMaterial { return bank(base)[((k % LIT_BANK) + LIT_BANK) % LIT_BANK]; }
/** a window with something other than a candle behind it (the 'haunted' flag) */
export function ghostMat(): THREE.MeshStandardMaterial {
  return (ghost ??= mat(PAL.window, { rough: 0.5, emissive: PAL.ghost, emissiveIntensity: 0 }, true));
}
/** a window with one mean rushlight behind it (squatters) */
export function dimMat(): THREE.MeshStandardMaterial {
  return (dim ??= mat(PAL.window, { rough: 0.5, emissive: PAL.fire, emissiveIntensity: 0 }, true));
}

// ───────────────────────── snow ─────────────────────────

/** 0..1, shared by every snow cap on the table */
export const snowLevel = { value: 0 };
let snow: THREE.MeshStandardMaterial | null = null;
/**
 * The snow material. Its geometry keeps the roof's own surface as `position` and a per-vertex
 * push in `normal`; the shader lifts each vertex by push × snow. One uniform moves every roof.
 */
export function snowMat(): THREE.MeshStandardMaterial {
  if (!snow) {
    snow = mat(PAL.snow, { rough: 0.95 }, true);
    // a thin fall must not fight the roof it lies on (and a copy of this material without the
    // shader hook, as the placement ghost makes, then reads as a clean white roof)
    snow.polygonOffset = true; snow.polygonOffsetFactor = -1; snow.polygonOffsetUnits = -2;
    snow.onBeforeCompile = shader => {
      shader.uniforms.uSnow = snowLevel;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uSnow;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normal * uSnow;');
    };
    snow.customProgramCacheKey = () => 'landlord-snow-cap';
  }
  return snow;
}

// ───────────────────────── seasons ─────────────────────────

let grass: THREE.MeshStandardMaterial | null = null;
let leaf: THREE.MeshStandardMaterial | null = null;
/** turf that follows the season (the burrow's mound). Multiplies vertex colour. */
export function grassMat(): THREE.MeshStandardMaterial { return (grass ??= mat(PAL.grassSummer, { vertexColors: true }, true)); }
/** foliage that follows the season (the treehouse's oak). Multiplies vertex colour. */
export function leafMat(): THREE.MeshStandardMaterial { return (leaf ??= mat(PAL.leafSummer, { vertexColors: true }, true)); }

const GRASS = { spring: PAL.grassSpring, summer: PAL.grassSummer, autumn: PAL.grassAutumn, winter: 0xb9c2b0 } as const;
const LEAF = { spring: PAL.leafSpring, summer: PAL.leafSummer, autumn: PAL.leafAutumn, winter: PAL.leafWinter } as const;
const NEXT = { spring: 'summer', summer: 'autumn', autumn: 'winter', winter: 'spring' } as const;
const cA = new THREE.Color(), cB = new THREE.Color(), cSnow = new THREE.Color(PAL.snow);

/** how full the oak's crown is: 1 in summer, thin in winter. Read by the treehouse. */
export const canopy = { fullness: 1, blossom: 0 };
const FULL = { spring: 0.9, summer: 1, autumn: 0.94, winter: 0.6 } as const;

let lastKey = NaN;
/** Drive every shared material from the frame's Env. Cheap, idempotent, call as often as you like. */
export function tickShared(env: Env): void {
  // one number that changes whenever anything we read changes
  const sIdx = env.season === 'spring' ? 0 : env.season === 'summer' ? 1 : env.season === 'autumn' ? 2 : 3;
  const key = env.time * 1.0001 + env.night * 31.7 + env.snow * 517.3 + sIdx * 7919 + env.seasonT * 131.1;
  if (key === lastKey) return;
  lastKey = key;
  const t = env.time, n = Math.min(1, Math.max(0, env.night));
  timeNow = t; nightNow = n;
  for (let k = 0; k < bankList.length; k++) { const b = bankList[k]; for (let i = 0; i < LIT_BANK; i++) flicker(b.mats[i], b.dark, i, t, n); }
  if (ghost) { ghost.emissiveIntensity = n * (0.55 + 0.35 * Math.sin(t * 0.9) * Math.sin(t * 0.37 + 1.3)); }
  if (dim) { dim.emissiveIntensity = n * (0.35 + 0.12 * Math.sin(t * 6.1) * Math.sin(t * 2.3)); }
  snowLevel.value = Math.min(1, Math.max(0, env.snow));
  // seasons: hold the season's colour, then ease into the next over its last third
  const k = Math.min(1, Math.max(0, (env.seasonT - 0.66) / 0.34)), e = k * k * (3 - 2 * k), nx = NEXT[env.season];
  const sn = snowLevel.value;
  if (grass) grass.color.copy(cA.setHex(GRASS[env.season])).lerp(cB.setHex(GRASS[nx]), e).lerp(cSnow, sn * 0.8);
  if (leaf) leaf.color.copy(cA.setHex(LEAF[env.season])).lerp(cB.setHex(LEAF[nx]), e).lerp(cSnow, sn * 0.25);
  canopy.fullness = FULL[env.season] + (FULL[nx] - FULL[env.season]) * e;
  canopy.blossom = env.season === 'spring' ? 1 - e : env.season === 'winter' ? e : 0;
}

// ───────────────────────── reading a body's surfaces ─────────────────────────

const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3(), _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3();

export interface Soup { /** 9 floats per triangle, in `root` space */ tris: number[]; /** unit normal per triangle (3 floats) */ normals: number[]; areas: number[]; total: number }

/**
 * Collect the triangles of `meshes` in the space of `root`, keeping only faces whose normal
 * points up at least `minUp` (1 = flat roofs only, -1 = everything).
 */
export function soupOf(meshes: readonly THREE.Mesh[], root: THREE.Object3D, minUp: number): Soup {
  root.updateWorldMatrix(true, true);
  _inv.copy(root.matrixWorld).invert();
  const out: Soup = { tris: [], normals: [], areas: [], total: 0 };
  for (const mesh of meshes) {
    const g = mesh.geometry, pos = g?.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) continue;
    mesh.updateWorldMatrix(true, false);
    _m.multiplyMatrices(_inv, mesh.matrixWorld);
    // a mirrored mesh (negative scale) has its winding reversed: read it backwards
    const flip = _m.determinant() < 0;
    const idx = g.getIndex(), count = idx ? idx.count : pos.count;
    for (let i = 0; i + 2 < count; i += 3) {
      const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + (flip ? 2 : 1)) : i + (flip ? 2 : 1), i2 = idx ? idx.getX(i + (flip ? 1 : 2)) : i + (flip ? 1 : 2);
      _a.fromBufferAttribute(pos, i0).applyMatrix4(_m); _b.fromBufferAttribute(pos, i1).applyMatrix4(_m); _c.fromBufferAttribute(pos, i2).applyMatrix4(_m);
      _n.crossVectors(_e1.subVectors(_b, _a), _e2.subVectors(_c, _a));
      const len = _n.length();
      if (len < 1e-7) continue;
      _n.multiplyScalar(1 / len);
      if (_n.y < minUp) continue;
      out.tris.push(_a.x, _a.y, _a.z, _b.x, _b.y, _b.z, _c.x, _c.y, _c.z);
      out.normals.push(_n.x, _n.y, _n.z);
      out.areas.push(len / 2); out.total += len / 2;
    }
  }
  return out;
}

export interface SurfacePoint { p: THREE.Vector3; n: THREE.Vector3 }
/** `n` random points on a soup, spread by area. */
export function scatterOn(soup: Soup, rand: Rng, n: number): SurfacePoint[] {
  const out: SurfacePoint[] = [];
  if (!soup.areas.length || soup.total <= 0) return out;
  for (let k = 0; k < n; k++) {
    let r = rand() * soup.total, t = 0;
    for (; t < soup.areas.length - 1; t++) { r -= soup.areas[t]; if (r <= 0) break; }
    let u = rand(), v = rand();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    // keep away from the very edge of the triangle so patches sit on the roof, not off it
    u = 0.15 + u * 0.7; v = 0.15 + v * 0.7; if (u + v > 0.9) { u *= 0.6; v *= 0.6; }
    const o = t * 9, w = 1 - u - v, T = soup.tris;
    out.push({
      p: new THREE.Vector3(T[o] * w + T[o + 3] * u + T[o + 6] * v, T[o + 1] * w + T[o + 4] * u + T[o + 7] * v, T[o + 2] * w + T[o + 5] * u + T[o + 8] * v),
      n: new THREE.Vector3(soup.normals[t * 3], soup.normals[t * 3 + 1], soup.normals[t * 3 + 2]),
    });
  }
  return out;
}

/**
 * A snow shell for the upward faces in `soup`: the same surface, with a push direction per
 * welded vertex stored in `normal`, plus a skirt where the snow ends at an eave or verge.
 * Appends into `pos` / `push` (9 floats per triangle each).
 */
export function snowShell(soup: Soup, thick: number, pos: number[], push: number[]): void {
  const T = soup.tris, nT = soup.areas.length;
  if (!nT) return;
  const ids = new Map<string, number>(), acc: number[] = [], vid = new Int32Array(nT * 3);
  const keyOf = (x: number, y: number, z: number) => Math.round(x * 500) + '_' + Math.round(y * 500) + '_' + Math.round(z * 500);
  for (let t = 0; t < nT; t++) {
    for (let j = 0; j < 3; j++) {
      const o = t * 9 + j * 3, k = keyOf(T[o], T[o + 1], T[o + 2]);
      let id = ids.get(k);
      if (id === undefined) { id = acc.length / 3; ids.set(k, id); acc.push(0, 0, 0); }
      vid[t * 3 + j] = id;
      const a = soup.areas[t];
      acc[id * 3] += soup.normals[t * 3] * a; acc[id * 3 + 1] += soup.normals[t * 3 + 1] * a; acc[id * 3 + 2] += soup.normals[t * 3 + 2] * a;
    }
  }
  // push = mostly along the averaged normal, with a pull straight up so ridges fatten and eaves do not flare
  for (let i = 0; i < acc.length; i += 3) {
    const l = Math.hypot(acc[i], acc[i + 1], acc[i + 2]) || 1;
    const x = (acc[i] / l) * 0.55, y = (acc[i + 1] / l) * 0.55 + 0.45, z = (acc[i + 2] / l) * 0.55;
    const l2 = Math.hypot(x, y, z) || 1;
    acc[i] = (x / l2) * thick; acc[i + 1] = (y / l2) * thick; acc[i + 2] = (z / l2) * thick;
  }
  // count edges to find the open boundary
  const edges = new Map<number, number>();
  const ek = (a: number, b: number) => (a < b ? a * 65536 + b : b * 65536 + a);
  for (let t = 0; t < nT; t++) for (let j = 0; j < 3; j++) { const k = ek(vid[t * 3 + j], vid[t * 3 + (j + 1) % 3]); edges.set(k, (edges.get(k) ?? 0) + 1); }
  for (let t = 0; t < nT; t++) {
    for (let j = 0; j < 3; j++) {
      const o = t * 9 + j * 3, id = vid[t * 3 + j];
      pos.push(T[o], T[o + 1], T[o + 2]); push.push(acc[id * 3], acc[id * 3 + 1], acc[id * 3 + 2]);
    }
    for (let j = 0; j < 3; j++) {
      const ia = vid[t * 3 + j], ib = vid[t * 3 + (j + 1) % 3];
      if (edges.get(ek(ia, ib)) !== 1) continue;
      const oa = t * 9 + j * 3, ob = t * 9 + ((j + 1) % 3) * 3, oc = t * 9 + ((j + 2) % 3) * 3;
      // outward = from the far corner toward this edge; only skirt edges that face down-slope or sideways
      const mx = (T[oa] + T[ob]) / 2 - T[oc], my = (T[oa + 1] + T[ob + 1]) / 2 - T[oc + 1], mz = (T[oa + 2] + T[ob + 2]) / 2 - T[oc + 2];
      const ml = Math.hypot(mx, my, mz) || 1;
      if (my / ml > 0.12) continue;
      // quad: a(top) → b(top) → b(base) → a(base), wound to face outward. The triangle runs a → b
      // counter-clockwise seen from above, so its outside lies to the right of a → b: b, a order.
      pos.push(T[ob], T[ob + 1], T[ob + 2], T[oa], T[oa + 1], T[oa + 2], T[oa], T[oa + 1], T[oa + 2]);
      push.push(acc[ib * 3], acc[ib * 3 + 1], acc[ib * 3 + 2], acc[ia * 3], acc[ia * 3 + 1], acc[ia * 3 + 2], 0, 0, 0);
      pos.push(T[ob], T[ob + 1], T[ob + 2], T[oa], T[oa + 1], T[oa + 2], T[ob], T[ob + 1], T[ob + 2]);
      push.push(acc[ib * 3], acc[ib * 3 + 1], acc[ib * 3 + 2], 0, 0, 0, 0, 0, 0);
    }
  }
}

/** Wrap accumulated shell arrays into a mesh wearing the shared snow. */
export function snowMesh(pos: number[], push: number[]): THREE.Mesh | null {
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(push), 3));
  g.computeBoundingSphere();
  if (g.boundingSphere) g.boundingSphere.radius += 0.25;
  g.userData.owned = true;
  const m = new THREE.Mesh(g, snowMat());
  m.name = 'snow'; m.castShadow = false; m.receiveShadow = true;
  return m;
}
