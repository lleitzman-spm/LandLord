/**
 * Wear: what neglect does to any body, read only through its `walls`, `roofs`,
 * `windows` and `anchors`. Four tiers by condition, then ruin:
 *   under 75  patchy roof and moss
 *   under 50  a visible lean, a boarded window, grimy walls
 *   under 25  holes in the roof, a prop holding a wall, weeds
 *   ruined    roof fallen in, walls broken down, rubble, crows
 * Paint changes are done by rewriting vertex colours (or swapping to a cached
 * tinted material for plain meshes); the rest is one small overlay mesh.
 */
import * as THREE from 'three';
import type { BuildingLook } from '../api';
import type { BuiltBody } from './types';
import { PAL, mat } from '../palette';
import { Sculpt, hash3, paintMat, type V3, type WindowInfo, type Rng } from './parts';
import { soupOf, scatterOn, type Soup, type SurfacePoint } from './shared';

export type Tier = 0 | 1 | 2 | 3 | 4;
export function tierOf(look: BuildingLook): Tier {
  if (look.state === 'ruined') return 4;
  if (look.state === 'building') return 0;
  const c = look.condition;
  return c < 25 ? 3 : c < 50 ? 2 : c < 75 ? 1 : 0;
}

// ───────────────────────── paint ─────────────────────────

export interface PaintSpec { tier: Tier; purple: boolean; haunted: boolean }
export const samePaint = (a: PaintSpec, b: PaintSpec): boolean => a.tier === b.tier && a.purple === b.purple && a.haunted === b.haunted;

const GRIME = [0, 0.14, 0.34, 0.55, 0.5] as const;
const DULL = [0, 0.3, 0.5, 0.65, 0.8] as const;
const cPurpleWall = new THREE.Color(0x8a45b8), cPurpleRoof = new THREE.Color(0x5a2a86);
const cGrime = new THREE.Color(0x6a5a44), cDamp = new THREE.Color(0x5f6f48), cOld = new THREE.Color(0x8f8468);
const out: [number, number, number] = [0, 0, 0];

function wallTone(r: number, g: number, b: number, y: number, noise: number, sp: PaintSpec): void {
  if (sp.purple) {
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b, f = 0.5 + lum * 1.1;
    r += (cPurpleWall.r * f - r) * 0.88; g += (cPurpleWall.g * f - g) * 0.88; b += (cPurpleWall.b * f - b) * 0.88;
  }
  if (sp.haunted) {
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r += (lum * 0.62 - r) * 0.55; g += (lum * 0.8 - g) * 0.55; b += (lum * 0.95 - b) * 0.55;
  }
  const gr = GRIME[sp.tier];
  if (gr > 0) {
    // dirtier toward the ground, where the splash and the damp live
    const low = 1 - Math.min(1, Math.max(0, y / 0.55)), k = Math.min(0.85, gr * (0.5 + 0.5 * low) * (0.75 + noise * 0.5));
    r += (r * cGrime.r * 1.6 - r) * k; g += (g * cGrime.g * 1.6 - g) * k; b += (b * cGrime.b * 1.6 - b) * k;
    if (sp.tier >= 2) { const d = k * 0.3 * low; r += (cDamp.r * 0.6 - r) * d; g += (cDamp.g * 0.6 - g) * d; b += (cDamp.b * 0.6 - b) * d; }
  }
  out[0] = r; out[1] = g; out[2] = b;
}
function roofTone(r: number, g: number, b: number, noise: number, sp: PaintSpec): void {
  if (sp.purple) {
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b, f = 0.55 + lum * 2.2;
    r += (cPurpleRoof.r * f - r) * 0.88; g += (cPurpleRoof.g * f - g) * 0.88; b += (cPurpleRoof.b * f - b) * 0.88;
  }
  if (sp.haunted) {
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r += (lum * 0.6 - r) * 0.5; g += (lum * 0.78 - g) * 0.5; b += (lum * 0.95 - b) * 0.5;
  }
  const share = DULL[sp.tier];
  if (share > 0) {
    // some courses have gone grey and thin; all of it has lost its shine
    const all = 0.05 * sp.tier;
    r *= 1 - all; g *= 1 - all; b *= 1 - all;
    if (noise < share) { const k = 0.35 + 0.4 * (noise / share); const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b; r += (cOld.r * (0.4 + lum) - r) * k; g += (cOld.g * (0.4 + lum) - g) * k; b += (cOld.b * (0.4 + lum) - b) * k; }
  }
  out[0] = r; out[1] = g; out[2] = b;
}

const _col = new THREE.Color();
function tintedMaterial(orig: THREE.MeshStandardMaterial, kind: 'wall' | 'roof', sp: PaintSpec): THREE.MeshStandardMaterial {
  if (orig.map || orig.emissiveMap) return orig; // painted signs keep their paint
  const c = orig.color;
  if (kind === 'wall') wallTone(c.r, c.g, c.b, 0.3, 0.5, sp); else roofTone(c.r, c.g, c.b, DULL[sp.tier] * 0.5, sp);
  _col.setRGB(Math.min(1, out[0]), Math.min(1, out[1]), Math.min(1, out[2]));
  return mat(_col.getHex(), {
    rough: orig.roughness, metal: orig.metalness, flat: orig.flatShading, emissive: orig.emissive.getHex(), emissiveIntensity: orig.emissiveIntensity,
    transparent: orig.transparent, opacity: orig.opacity, side: orig.side, vertexColors: orig.vertexColors,
  });
}

/**
 * Repaint one wall or roof mesh for a paint spec. `orig` is the material the body gave the mesh.
 * Returns the material the mesh should now wear (the same one, for vertex-painted meshes).
 */
export function repaint(mesh: THREE.Mesh, orig: THREE.Material, kind: 'wall' | 'roof', sp: PaintSpec, seed: number): THREE.Material {
  const m = orig as THREE.MeshStandardMaterial;
  if (!m.isMeshStandardMaterial) return orig;
  const plain = sp.tier === 0 && !sp.purple && !sp.haunted;
  let g = mesh.geometry;
  const col = g.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!m.vertexColors || !col) return plain ? orig : tintedMaterial(m, kind, sp);
  if (plain && !g.userData.base) return orig;
  if (!g.userData.owned) {
    // someone else's shared geometry: take a private copy before repainting it
    g = g.clone(); g.userData = { owned: true }; mesh.geometry = g;
  }
  const attr = g.getAttribute('color') as THREE.BufferAttribute, pos = g.getAttribute('position') as THREE.BufferAttribute;
  const arr = attr.array as Uint16Array | Float32Array | Uint8Array;
  const base = (g.userData.base ??= arr.slice()) as typeof arr;
  if (plain) { arr.set(base); attr.needsUpdate = true; return orig; }
  const scale = attr.normalized ? (arr instanceof Uint16Array ? 65535 : arr instanceof Uint8Array ? 255 : 1) : 1;
  // a mesh that multiplies vertex colour by a living material colour (seasonal turf): fold that colour in when the paint must be absolute
  const absolute = sp.purple && m !== paintMat();
  const mr = absolute ? m.color.r : 1, mg = absolute ? m.color.g : 1, mb = absolute ? m.color.b : 1;
  const cells = g.userData.cells as Uint32Array | undefined, n = attr.count;
  const P = pos.array as Float32Array;
  let cell = 0, cellNoise = 0, cellStart = -1;
  for (let i = 0; i < n; i++) {
    const o = i * 3;
    if (kind === 'roof') {
      // one decision per painted part (a tile, a course of thatch), so wear follows the courses
      if (cells) { while (cell < cells.length && i >= cells[cell]) cell++; if (cell !== cellStart) { cellStart = cell; const s0 = (cell ? cells[cell - 1] : 0) * 3; cellNoise = hash3(P[s0], P[s0 + 1], P[s0 + 2], seed); } }
      else if (i % 6 === 0) cellNoise = hash3(P[o], P[o + 1], P[o + 2], seed);
      roofTone((base[o] / scale) * mr, (base[o + 1] / scale) * mg, (base[o + 2] / scale) * mb, cellNoise, sp);
    } else wallTone((base[o] / scale) * mr, (base[o + 1] / scale) * mg, (base[o + 2] / scale) * mb, P[o + 1], hash3(Math.round(P[o] * 3), 0, Math.round(P[o + 2] * 3), seed), sp);
    arr[o] = Math.min(1, Math.max(0, out[0])) * scale; arr[o + 1] = Math.min(1, Math.max(0, out[1])) * scale; arr[o + 2] = Math.min(1, Math.max(0, out[2])) * scale;
  }
  attr.needsUpdate = true;
  return absolute ? paintMat() : orig;
}

// ───────────────────────── reading the body ─────────────────────────

export interface Bounds { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }
export function boundsOf(soup: Soup): Bounds | null {
  const T = soup.tris;
  if (!T.length) return null;
  const b: Bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (let i = 0; i < T.length; i += 3) {
    if (T[i] < b.minX) b.minX = T[i]; if (T[i] > b.maxX) b.maxX = T[i];
    if (T[i + 1] < b.minY) b.minY = T[i + 1]; if (T[i + 1] > b.maxY) b.maxY = T[i + 1];
    if (T[i + 2] < b.minZ) b.minZ = T[i + 2]; if (T[i + 2] > b.maxZ) b.maxZ = T[i + 2];
  }
  return b;
}
/** the box the walls stand in (falls back to the whole body, then to the footprint) */
export function wallBounds(body: BuiltBody, look: BuildingLook): Bounds {
  let b = boundsOf(soupOf(body.walls, body.group, -2));
  if (!b || b.minY > 0.5) {
    const all: THREE.Mesh[] = [];
    body.group.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && m.visible && m.name !== 'snow' && m.name !== 'cloth') all.push(m); });
    const whole = boundsOf(soupOf(all, body.group, -2));
    if (whole) b = b && b.minY <= 0.5 ? b : { ...whole, maxY: b ? b.maxY : whole.maxY };
  }
  const hw = look.w / 2, hh = look.h / 2;
  if (b && (b.maxX - b.minX) * (b.maxZ - b.minZ) < look.w * look.h * 0.3) {
    // walls that are only a face (a burrow's front): the roof is the rest of the house
    const r = boundsOf(soupOf(body.roofs, body.group, -2));
    if (r) b = { minX: Math.min(b.minX, r.minX), maxX: Math.max(b.maxX, r.maxX), minY: Math.min(b.minY, r.minY), maxY: Math.max(b.maxY, r.maxY), minZ: Math.min(b.minZ, r.minZ), maxZ: Math.max(b.maxZ, r.maxZ) };
  }
  b ??= { minX: -hw + 0.3, maxX: hw - 0.3, minY: 0, maxY: 0.8, minZ: -hh + 0.3, maxZ: hh - 0.3 };
  // never trust a body past its own plot
  b.minX = Math.max(b.minX, -hw + 0.05); b.maxX = Math.min(b.maxX, hw - 0.05); b.minZ = Math.max(b.minZ, -hh + 0.05); b.maxZ = Math.min(b.maxZ, hh - 0.05);
  return b;
}
/** an average painted colour of a mesh (linear), for debris that should match what fell */
export function sampleColor(mesh: THREE.Mesh | undefined, fallback: number): number {
  if (!mesh) return fallback;
  const m = mesh.userData.orig as THREE.MeshStandardMaterial | undefined ?? (mesh.material as THREE.MeshStandardMaterial);
  if (!m || !m.color) return fallback;
  const col = mesh.geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!m.vertexColors || !col) return m.color.getHex();
  const arr = (mesh.geometry.userData.base ?? col.array) as Uint16Array | Float32Array | Uint8Array;
  const scale = col.normalized ? (arr instanceof Uint16Array ? 65535 : arr instanceof Uint8Array ? 255 : 1) : 1;
  let r = 0, g = 0, b = 0, n = 0;
  const step = Math.max(3, Math.floor(arr.length / 60 / 3) * 3);
  for (let i = 0; i + 2 < arr.length; i += step) { r += arr[i]; g += arr[i + 1]; b += arr[i + 2]; n++; }
  _col.setRGB((r / n / scale) * m.color.r, (g / n / scale) * m.color.g, (b / n / scale) * m.color.b);
  return _col.getHex();
}
function mixHex(a: number, b: number, t: number): number { return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex(); }

/** window facts: the body's own if it kept them, otherwise guessed from the anchors */
export function windowInfos(body: BuiltBody, look: BuildingLook): WindowInfo[] {
  const wi = body.group.userData.windowInfo as WindowInfo[] | undefined;
  if (wi && wi.length) return wi;
  return body.anchors.windows.map(p => {
    const ax = Math.abs(p.x) / (look.w / 2), az = Math.abs(p.z) / (look.h / 2);
    const normal = ax > az ? new THREE.Vector3(Math.sign(p.x) || 1, 0, 0) : new THREE.Vector3(0, 0, Math.sign(p.z) || 1);
    return { pos: p.clone().addScaledVector(normal, -0.03), normal, w: 0.2, h: 0.2, unit: 0 };
  });
}

// ───────────────────────── the overlay ─────────────────────────

/** a flat irregular patch lying on a surface point */
function patch(s: Sculpt, sp: SurfacePoint, rad: number, hex: number, lift: number, sides = 6, squash = 1): [THREE.Vector3, THREE.Vector3] {
  const n = sp.n, t1 = new THREE.Vector3(), t2 = new THREE.Vector3();
  // t1 runs along the roof (horizontal), t2 runs up the slope
  if (Math.abs(n.y) > 0.98) t1.set(1, 0, 0); else t1.set(n.z, 0, -n.x).normalize();
  t2.crossVectors(n, t1).normalize();
  const pts: V3[] = [], ph = s.rand() * 6;
  for (let i = 0; i < sides; i++) {
    const a = ph + (i / sides) * Math.PI * 2, k = rad * s.rand.range(0.7, 1.15), c = Math.cos(a) * k, d = Math.sin(a) * k * squash;
    pts.push([sp.p.x + t1.x * c + t2.x * d + n.x * lift, sp.p.y + t1.y * c + t2.y * d + n.y * lift, sp.p.z + t1.z * c + t2.z * d + n.z * lift]);
  }
  s.poly('wear', hex, pts, 0.07);
  return [t1, t2];
}
function tuft(s: Sculpt, x: number, z: number, h: number): void {
  const cols = [0x6f8f4a, 0x86ad55, 0xa39a48, 0x5f7a3f] as const;
  for (let i = 0; i < 4; i++) {
    const a = s.rand() * Math.PI * 2, lean = s.rand.range(0.02, 0.07), w = 0.018, hh = h * s.rand.range(0.6, 1.1);
    const bx = x + Math.cos(a) * 0.02, bz = z + Math.sin(a) * 0.02, tx = bx + Math.cos(a) * lean, tz = bz + Math.sin(a) * lean, px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    const hex = s.rand.pick(cols);
    s.tri('wear', hex, [bx - px, 0, bz - pz], [bx + px, 0, bz + pz], [tx, hh, tz], 0.08);
    s.tri('wear', hex, [bx + px, 0, bz + pz], [bx - px, 0, bz - pz], [tx, hh, tz], 0.08);
  }
}
/** scatter weeds round the foot of the walls, keeping the doorstep clear */
function weeds(s: Sculpt, b: Bounds, body: BuiltBody, look: BuildingLook, n: number): void {
  const r = s.rand, hw = look.w / 2 - 0.06, hh = look.h / 2 - 0.06, d = body.anchors.door;
  for (let i = 0, tries = 0; i < n && tries < n * 6; tries++) {
    const side = r.int(0, 3), off = r.range(0.03, 0.12);
    let x: number, z: number;
    if (side === 0) { x = r.range(b.minX, b.maxX); z = b.maxZ + off; }
    else if (side === 1) { x = r.range(b.minX, b.maxX); z = b.minZ - off; }
    else if (side === 2) { x = b.maxX + off; z = r.range(b.minZ, b.maxZ); }
    else { x = b.minX - off; z = r.range(b.minZ, b.maxZ); }
    x = Math.min(hw, Math.max(-hw, x)); z = Math.min(hh, Math.max(-hh, z));
    if (Math.hypot(x - d.x, z - d.z) < 0.3) continue;
    tuft(s, x, z, r.range(0.09, 0.19)); i++;
  }
}

/**
 * Where the solid actually is: the outermost coordinate (along axis 0 = x or 2 = z, in direction
 * `dir`) of any face that crosses height `y` within `near` of `at` on the other axis. Null if nothing is there.
 */
function faceOf(soup: Soup, axis: 0 | 2, dir: number, y: number, at: number, near = 0.3): number | null {
  const T = soup.tris, other = axis === 0 ? 2 : 0;
  let best: number | null = null;
  for (let t = 0; t < T.length; t += 9) {
    const y0 = T[t + 1], y1 = T[t + 4], y2 = T[t + 7];
    if (Math.min(y0, y1, y2) > y + 0.05 || Math.max(y0, y1, y2) < y - 0.05) continue;
    for (let j = 0; j < 9; j += 3) {
      if (Math.abs(T[t + j + other] - at) > near || Math.abs(T[t + j + 1] - y) > 0.45) continue;
      const v = T[t + j + axis];
      if (best === null || v * dir > best * dir) best = v;
    }
  }
  return best;
}

export interface WearResult { mesh: THREE.Mesh | null; /** which way the body leans: -1 or +1 along x */ leanDir: number }

/** The overlay for tiers 1..3: moss, bald patches, holes, boards, a prop, weeds. One mesh. */
export function buildWear(body: BuiltBody, look: BuildingLook, tier: Tier, seed: number): WearResult {
  const s = new Sculpt(seed ^ 0x51ed), r = s.rand;
  const leanDir = r.sign();
  if (tier === 0 || tier === 4) return { mesh: null, leanDir };
  const soup = soupOf(body.roofs.filter(m => m.visible), body.group, 0.3), A = soup.total;
  const roofHex = sampleColor(body.roofs[0], PAL.thatch);
  // the draws below are made in a fixed order so that a worse tier only ever adds to a better one
  const moss = scatterOn(soup, r, Math.min(14, Math.ceil(A * 3))), bald = scatterOn(soup, r, Math.min(10, Math.ceil(A * 2))), holes = scatterOn(soup, r, Math.min(4, Math.max(2, Math.round(A * 0.8))));
  const nMoss = Math.ceil(moss.length * [0, 0.5, 0.8, 1][tier]), nBald = Math.ceil(bald.length * [0, 0.5, 0.8, 1][tier]);
  const MOSS = [PAL.moss, 0x5f7f42, 0x7a9a50] as const;
  for (let i = 0; i < nMoss; i++) {
    // a clump: one cushion and a smaller one grown out of its side
    const rad = r.range(0.07, 0.12), [t1, t2] = patch(s, moss[i], rad, MOSS[i % 3], 0.03, 7, 0.8);
    const side: SurfacePoint = { p: moss[i].p.clone().addScaledVector(t1, rad * r.range(0.5, 0.8) * r.sign()).addScaledVector(t2, rad * r.range(-0.5, 0.5)), n: moss[i].n };
    patch(s, side, rad * r.range(0.45, 0.65), MOSS[(i + 1) % 3], 0.036, 5, 0.85);
  }
  for (let i = 0; i < nBald; i++) patch(s, bald[i], r.range(0.08, 0.14), mixHex(roofHex, 0x4a3a28, 0.55), 0.026, 5, 0.75);
  if (tier >= 3) {
    for (const h of holes) {
      const rad = r.range(0.11, 0.17);
      const [t1, t2] = patch(s, h, rad, 0x1c1714, 0.036, 7, 0.85);
      // the rafters, which were not meant to be seen
      for (const k of [-0.35, 0.3]) {
        const c = h.p.clone().addScaledVector(t1, rad * k).addScaledVector(h.n, 0.04);
        const a = c.clone().addScaledVector(t2, rad * 0.8), b = c.clone().addScaledVector(t2, -rad * 0.8);
        s.beam('wear', PAL.timber, [a.x, a.y, a.z], [b.x, b.y, b.z], 0.024, 0.012, 0.04);
      }
    }
  }
  const b = wallBounds(body, look);
  if (tier >= 2) {
    // board up a window or two: the ones the street can see, for preference
    const wins = windowInfos(body, look).filter(w => w.w >= 0.1 && Math.abs(w.normal.y) < 0.5).sort((a, c) => c.normal.z - a.normal.z || a.pos.x - c.pos.x);
    const want = Math.min(wins.length > 1 ? wins.length - 1 : wins.length, tier >= 3 ? 2 : 1), start = wins.length ? r.int(0, Math.min(1, wins.length - 1)) : 0;
    for (let i = 0; i < want; i++) {
      const w = wins[(start + i) % wins.length];
      s.at(w.pos.x, w.pos.y, w.pos.z, Math.atan2(w.normal.x, w.normal.z), () => {
        const hw = w.w / 2 + 0.07, n = w.h > 0.19 ? 3 : 2;
        for (let j = 0; j < n; j++) {
          const y = (j / (n - 1) - 0.5) * w.h * 0.72;
          s.beam('wear', j % 2 ? 0x8a7a62 : 0x7a6a52, [-hw, y + r.range(-0.03, 0.03), 0.03], [hw, y + r.range(-0.03, 0.03), 0.03], 0.016, 0.05, 0.06);
        }
      });
    }
    weeds(s, b, body, look, tier >= 3 ? 8 : 3);
  }
  if (tier >= 3) {
    // a raking shore against the wall it is leaning toward: found on the wall itself, so it props something
    const top = Math.min(1.0, Math.max(0.3, (b.maxY - b.minY) * 0.6));
    const z = b.minZ + (b.maxZ - b.minZ) * r.range(0.3, 0.6), x = b.minX + (b.maxX - b.minX) * r.range(0.3, 0.7);
    let solid = soupOf(body.walls.filter(m => m.visible), body.group, -2);
    if (!solid.tris.length) { const all: THREE.Mesh[] = []; body.group.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && m.visible && m.name !== 'snow' && m.name !== 'cloth' && !Array.isArray(m.material)) all.push(m); }); solid = soupOf(all, body.group, -2); }
    const wallX = faceOf(solid, 0, leanDir, top, z), wallZ = faceOf(solid, 2, -1, top, x);
    const reach = wallX === null ? 0 : Math.min(0.34, look.w / 2 - 0.04 - Math.abs(wallX));
    const reach2 = wallZ === null ? 0 : Math.min(0.34, look.h / 2 - 0.04 - Math.abs(wallZ));
    if (wallX !== null && reach > 0.1) {
      s.beam('wear', PAL.timberLight, [wallX + leanDir * reach, 0, z], [wallX + leanDir * 0.012, top, z], 0.05, 0.05, 0.05);
      s.block('wear', PAL.timber, wallX + leanDir * reach, 0, z, 0.12, 0.03, 0.16);
      s.block('wear', PAL.timber, wallX + leanDir * 0.02, top - 0.07, z, 0.03, 0.12, 0.16, { bottom: true });
    } else if (wallZ !== null && reach2 > 0.1) {
      s.beam('wear', PAL.timberLight, [x, 0, wallZ - reach2], [x, top, wallZ - 0.012], 0.05, 0.05, 0.05);
      s.block('wear', PAL.timber, x, 0, wallZ - reach2, 0.16, 0.03, 0.12);
      s.block('wear', PAL.timber, x, top - 0.07, wallZ - 0.02, 0.16, 0.12, 0.03, { bottom: true });
    }
  }
  const mesh = s.mesh('wear');
  if (mesh) mesh.castShadow = false;
  return { mesh, leanDir };
}

/** how far the body tips for a tier: an angle about z (sideways) and a smaller one about x */
export function leanFor(tier: Tier, height: number, dir: number, seed: number): [number, number] {
  if (tier < 2 || tier === 4) return [0, 0];
  const shift = tier === 2 ? 0.07 : 0.12, a = Math.atan2(shift, Math.max(0.8, height));
  return [-dir * a, (hash3(seed, 1, 2) - 0.5) * a * 0.8];
}

// ───────────────────────── ruin ─────────────────────────

/** one block of the broken wall line: everything in this column of space above `h` has fallen */
export interface RuinCell { x0: number; x1: number; z0: number; z1: number; h: number }
export interface Ruin {
  mesh: THREE.Mesh | null;
  /** the break, as columns: walls come down in lumps, not along a ruled line */
  cells: RuinCell[];
  /** how high anything still stands at a point */
  heightAt(x: number, z: number): number;
  /** where crows like to sit */
  perches: THREE.Vector3[];
}
/** The ruin: where the walls break off, what lies inside, and where the crows sit. */
export function buildRuin(body: BuiltBody, look: BuildingLook, seed: number): Ruin {
  const s = new Sculpt(seed ^ 0x7a11), r = s.rand;
  const b = wallBounds(body, look);
  const spanX = Math.max(0.3, b.maxX - b.minX), spanZ = Math.max(0.3, b.maxZ - b.minZ);
  // nothing above the wall plate survives a roof coming in: break low enough that no gable or dormer is left hanging
  const h0 = Math.min(1.05, Math.max(0.3, b.maxY * 0.62)), low = Math.max(0.1, h0 * 0.22);
  const cxs = r.sign(), cornerX = cxs > 0 ? b.maxX : b.minX, cornerZ = b.minZ; // the back corner stands longest
  const a1 = (h0 - low) / spanX, a2 = (h0 - low) / spanZ;
  // y <= h0 - a1 * dx  and  y <= h0 - a2 * dz, each with a little twist so the break is not ruled
  const tw = r.range(-0.12, 0.12);
  const p1 = new THREE.Plane(new THREE.Vector3(a1 * cxs, -1, tw), 0), p2 = new THREE.Plane(new THREE.Vector3(-tw * cxs, -1, -a2), 0);
  p1.constant = -(p1.normal.x * cornerX + p1.normal.y * h0 + p1.normal.z * cornerZ);
  p2.constant = -(p2.normal.x * cornerX + p2.normal.y * h0 + p2.normal.z * cornerZ);
  for (const p of [p1, p2]) { const l = p.normal.length(); p.normal.multiplyScalar(1 / l); p.constant /= l; }
  const slopeAt = (x: number, z: number) => Math.max(0, Math.min(-(p1.normal.x * x + p1.normal.z * z + p1.constant) / p1.normal.y, -(p2.normal.x * x + p2.normal.z * z + p2.constant) / p2.normal.y));
  // break that slope into columns of uneven height, so the wall tops are stepped like fallen masonry
  const nX = Math.max(3, Math.min(7, Math.round(spanX / 0.34))), nZ = Math.max(3, Math.min(7, Math.round(spanZ / 0.34)));
  const xe: number[] = [], ze: number[] = [];
  for (let i = 0; i <= nX; i++) xe.push(i === 0 ? -99 : i === nX ? 99 : b.minX + (spanX * (i + r.range(-0.24, 0.24))) / nX);
  for (let j = 0; j <= nZ; j++) ze.push(j === 0 ? -99 : j === nZ ? 99 : b.minZ + (spanZ * (j + r.range(-0.24, 0.24))) / nZ);
  const cells: RuinCell[] = [];
  const iCorner = cxs > 0 ? nX - 1 : 0;
  // one breach in the front wall and one in a side, where it has gone to the ground
  const breachX = r.int(0, nX - 1), breachZ = r.int(1, nZ - 1), breachSide = cxs > 0 ? 0 : nX - 1;
  for (let i = 0; i < nX; i++) for (let j = 0; j < nZ; j++) {
    const cx = b.minX + (spanX * (i + 0.5)) / nX, cz = b.minZ + (spanZ * (j + 0.5)) / nZ;
    let h = slopeAt(cx, cz) + r.range(-0.13, 0.13);
    h = Math.max(low * 0.6, Math.min(h0, h));
    if (i === iCorner && j === 0) h = h0 + 0.06;
    else if ((j === nZ - 1 && i === breachX) || (i === breachSide && j === breachZ)) h = Math.min(h, 0.07);
    cells.push({ x0: xe[i], x1: xe[i + 1], z0: ze[j], z1: ze[j + 1], h: Math.round(h / 0.065) * 0.065 });
  }
  const heightAt = (x: number, z: number): number => {
    for (const c of cells) if (x >= c.x0 && x < c.x1 && z >= c.z0 && z < c.z1) return c.h;
    return 0;
  };

  const wallHex = sampleColor(body.walls[0], PAL.plaster), roofHex = sampleColor(body.roofs[0], PAL.thatch);
  const hw = look.w / 2 - 0.08, hh = look.h / 2 - 0.08;
  const inX = () => r.range(b.minX + 0.08, b.maxX - 0.08), inZ = () => r.range(b.minZ + 0.08, b.maxZ - 0.08);
  // scorched, trodden ground
  const ground: V3[] = [];
  for (let i = 0; i < 9; i++) { const a = -(i / 9) * Math.PI * 2, k = r.range(0.82, 1.08); ground.push([(b.minX + b.maxX) / 2 + Math.cos(a) * spanX * 0.56 * k, 0.005, (b.minZ + b.maxZ) / 2 + Math.sin(a) * spanZ * 0.56 * k]); }
  s.poly('wear', mixHex(PAL.dirtDark, PAL.soot, 0.35), ground, 0.03);
  // what is left of the roof, lying where it landed
  for (let i = 0; i < 3; i++) {
    const w = r.range(0.28, Math.min(0.55, spanX * 0.5)), d = r.range(0.22, Math.min(0.42, spanZ * 0.5));
    s.at(inX() * 0.7, r.range(0.05, 0.16), inZ() * 0.7, r.range(0, Math.PI), () => {
      for (let j = 0; j < 3; j++) s.block('wear', mixHex(roofHex, 0x3a3028, r.range(0.15, 0.45)), (j - 1) * (w / 3), 0, 0, w / 3 - 0.01, 0.035, d, { bottom: true, jit: 0.07 });
    }, r.range(-0.5, 0.5), r.range(-0.4, 0.4));
  }
  // fallen timbers, one still propped against the standing corner
  for (let i = 0; i < 4; i++) {
    const x = inX(), z = inZ(), a = r.range(0, Math.PI), len = r.range(0.4, Math.min(0.9, Math.max(spanX, spanZ) * 0.7)) / 2;
    s.beam('wear', mixHex(PAL.timber, PAL.soot, r.range(0, 0.5)), [x - Math.cos(a) * len, r.range(0.03, 0.1), z - Math.sin(a) * len], [x + Math.cos(a) * len, r.range(0.04, 0.22), z + Math.sin(a) * len], 0.055, 0.055, 0.06);
  }
  const lx = cornerX - cxs * spanX * 0.22, lz = cornerZ + spanZ * 0.2;
  s.beam('wear', PAL.timber, [cornerX - cxs * spanX * 0.6, 0.02, cornerZ + spanZ * 0.62], [lx, heightAt(lx, lz) * 0.9, lz], 0.06, 0.06, 0.05);
  // rubble: inside, and spilled a little way out
  const debris = [wallHex, mixHex(wallHex, PAL.stoneDark, 0.4), PAL.stone, PAL.rock, PAL.stoneDark, mixHex(wallHex, PAL.soot, 0.3)];
  for (let i = 0; i < 16; i++) {
    const outside = i % 4 === 3;
    let x = outside ? (r.chance(0.5) ? b.minX - r.range(0.02, 0.12) : b.maxX + r.range(0.02, 0.12)) : inX(), z = outside ? inZ() : inZ();
    if (i % 8 === 7) { x = inX(); z = b.maxZ + r.range(0.02, 0.1); }
    x = Math.min(hw, Math.max(-hw, x)); z = Math.min(hh, Math.max(-hh, z));
    if (Math.hypot(x - body.anchors.door.x, z - body.anchors.door.z) < 0.2) continue;
    const sz = r.range(0.05, 0.12);
    s.blob('wear', r.pick(debris), x, sz * 0.25, z, sz, sz * r.range(0.55, 0.8), sz * r.range(0.8, 1.1), { detail: 0, lump: 0.25, jit: 0.08 });
  }
  weeds(s, b, body, look, 7);
  for (let i = 0; i < 3; i++) tuft(s, inX(), inZ(), r.range(0.1, 0.2));

  const perches: THREE.Vector3[] = [];
  const px = cornerX - cxs * 0.07, pz = cornerZ + 0.07;
  perches.push(new THREE.Vector3(px, heightAt(px, pz) - 0.01, pz));
  const qx = cornerX - cxs * spanX * 0.55, qz = cornerZ + 0.05;
  perches.push(new THREE.Vector3(qx, Math.max(0.05, heightAt(qx, qz) - 0.01), qz));
  const mesh = s.mesh('wear');
  return { mesh, cells, heightAt, perches };
}

// ───────────────────────── crows ─────────────────────────

let crowGeo: THREE.BufferGeometry | null = null;
/** one shared crow, facing +z, feet on the origin */
export function crowGeometry(): THREE.BufferGeometry {
  if (crowGeo) return crowGeo;
  const s = new Sculpt(7); s.jit = 0.02;
  const black = 0x2a2a30, sheen = 0x34343e;
  s.blob('c', black, 0, 0.075, 0, 0.045, 0.04, 0.075, { detail: 1, lump: 0.05 });
  s.blob('c', sheen, 0, 0.125, 0.055, 0.032, 0.03, 0.034, { detail: 1 });
  s.at(0, 0.122, 0.082, 0, () => s.cone('c', 0xd9962f, 0, 0, 0, 0.013, 0.045, 4, { bottom: true, jit: 0 }), Math.PI / 2 + 0.25);
  // tail, and wings folded along the back
  s.tri('c', black, [-0.03, 0.075, -0.05], [0.03, 0.075, -0.05], [0, 0.05, -0.15]); s.tri('c', black, [0.03, 0.075, -0.05], [-0.03, 0.075, -0.05], [0, 0.05, -0.15]);
  for (const sg of [-1, 1]) { s.tri('c', sheen, [sg * 0.046, 0.1, 0.03], [sg * 0.05, 0.06, 0.0], [sg * 0.03, 0.07, -0.11]); s.tri('c', sheen, [sg * 0.05, 0.06, 0.0], [sg * 0.046, 0.1, 0.03], [sg * 0.03, 0.07, -0.11]); }
  for (const sg of [-1, 1]) s.beam('c', 0x3a3028, [sg * 0.018, 0.045, 0.005], [sg * 0.02, 0, 0.012], 0.008, 0.008, 0);
  crowGeo = s.bake('c')!;
  crowGeo.userData.shared = true; crowGeo.userData.owned = false;
  return crowGeo;
}
const fract = (x: number) => x - Math.floor(x);
const h1 = (n: number) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
/** idle, peck, hop and turn. No allocation. `perch` is where the crow stands, `i` tells crows apart. */
export function animateCrow(crow: THREE.Object3D, perch: THREE.Vector3, i: number, time: number): void {
  const T = 2.3 + i * 0.83, q = time / T + i * 0.37, n = Math.floor(q), f = q - n;
  const act = h1(n * 3.1 + i * 17), yaw0 = h1((n - 1) * 5.3 + i * 29) * 4.4 - 2.2, yaw1 = h1(n * 5.3 + i * 29) * 4.4 - 2.2;
  let y = 0, pitch = Math.sin(time * 2.2 + i) * 0.04, yaw = yaw1;
  if (act < 0.3) {
    // peck twice
    const k = f < 0.6 ? Math.abs(Math.sin((f / 0.6) * Math.PI * 2)) : 0;
    pitch = k * 0.75;
  } else if (act < 0.62) {
    // hop round to face somewhere else
    const k = Math.min(1, f / 0.28);
    y = Math.sin(k * Math.PI) * 0.07; yaw = yaw0 + (yaw1 - yaw0) * k;
  } else if (act < 0.72) {
    // a shrug of the wings: it is thinking about leaving and decides against it
    const k = f < 0.4 ? Math.sin((f / 0.4) * Math.PI) : 0;
    y = k * 0.025; pitch = -k * 0.25;
  }
  crow.position.set(perch.x, perch.y + y, perch.z);
  crow.rotation.set(pitch, yaw, 0, 'YXZ');
}
