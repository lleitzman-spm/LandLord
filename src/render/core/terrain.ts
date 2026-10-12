/**
 * The board's top: painted ground, the stream, bridges, rocks, furrowed
 * fields, instanced trees, grass and flowers, and the rope-and-stake bounds
 * of land not yet bought. Re-dressed by the season; rebuilt only where the
 * map actually changed.
 */
import * as THREE from 'three';
import type { Env, RenderCtx } from '../api';
import { MAP_W, MAP_H, PARCEL, RANK_ORDER, type GameState, type Terrain as TerrainKind } from '../../sim/types';
import { PAL, mix as mixHex } from '../palette';
import type { Sky } from './env';
import { HALF_W, HALF_D } from './layout';
import { makeTerrainUniforms, patchGround, patchSnow, patchSway, patchWater, type TerrainUniforms } from './shaders';
import { Geo, TRS, jitter, clamp, clamp01, lerp, smoothstep, hash01, hash2, vnoise, fbm, damp, composeInto, TAU } from './util';

export interface Terrain {
  group: THREE.Group;
  uniforms: TerrainUniforms;
  reset(state: GameState): void;
  /** cheap diff against the live map; repaints only what changed */
  sync(state: GameState): void;
  setHighlight(tiles: [number, number][] | null, color?: number): void;
  /** tool feedback (footprints, strokes, hover): a second overlay */
  setMarks(tiles: [number, number][] | null, color?: number): void;
  /** fade the surveyor's grid in round a world point (amount 0 hides it) */
  setGrid(amount: number, wx?: number, wz?: number): void;
  update(env: Env, sky: Sky): void;
  dispose(): void;
}

const S = 5;                                  // ground vertices per tile edge
const NX = MAP_W * S, NZ = MAP_H * S, VX = NX + 1, VZ = NZ + 1;
const NT = MAP_W * MAP_H;
const KIND: Record<TerrainKind, number> = { grass: 0, forest: 1, rock: 2, water: 3, road: 4, bridge: 5, field: 6 };
const WATER_Y = -0.075;

const _m = new THREE.Matrix4(), _c = new THREE.Color(), _c2 = new THREE.Color(), _c3 = new THREE.Color();

// season palettes (index 0 spring .. 3 winter)
const GRASS_A = [PAL.grassSpring, PAL.grassSummer, PAL.grassAutumn, 0x8f8c5c].map(h => new THREE.Color(h));
const GRASS_B = [0xa3bd5c, 0x86a24a, 0xa88c46, 0x7f7556].map(h => new THREE.Color(h));
const LEAF_BUD = new THREE.Color(0xb7cf68), LEAF_SPRING = new THREE.Color(PAL.leafSpring), LEAF_SUMMER = new THREE.Color(PAL.leafSummer);
const LEAF_AUT = [new THREE.Color(PAL.leafAutumn), new THREE.Color(PAL.leafAutumn2), new THREE.Color(0xd9a52f)];
const LEAF_DEAD = new THREE.Color(0x7a5a3a), BLOSSOM = [new THREE.Color(0xf4c6d4), new THREE.Color(0xfbf1e4)];
const FLOWERS = [0xfaf3e0, 0xf2cf4a, 0xe89ab0, 0x8f9fe0, 0xf4f0ea, 0xe8704a].map(h => new THREE.Color(h));
const CROP_GREEN = new THREE.Color(0x8fbf55), CROP_GOLD = new THREE.Color(PAL.field), CROP_STUBBLE = new THREE.Color(0xb39f66);

function seasonBlend(arr: THREE.Color[], seasonF: number, out: THREE.Color): THREE.Color {
  const i = Math.floor(seasonF) % 4, t = seasonF - Math.floor(seasonF);
  return out.copy(arr[i]!).lerp(arr[(i + 1) % 4]!, smoothstep(0.72, 1.0, t));
}
function leafColor(out: THREE.Color, seasonF: number, variant: number, blossom: boolean): THREE.Color {
  const s = Math.floor(seasonF) % 4, t = seasonF - Math.floor(seasonF);
  const aut = LEAF_AUT[variant < 0.42 ? 0 : variant < 0.76 ? 1 : 2]!;
  if (s === 0) {
    out.copy(LEAF_BUD).lerp(LEAF_SPRING, smoothstep(0, 0.35, t));
    if (blossom) out.lerp(BLOSSOM[variant < 0.5 ? 0 : 1]!, smoothstep(0.04, 0.2, t) * (1 - smoothstep(0.55, 0.82, t)) * 0.88);
    out.lerp(LEAF_SUMMER, smoothstep(0.82, 1, t));
  } else if (s === 1) {
    out.copy(LEAF_SUMMER).multiplyScalar(1 - 0.08 * t);
  } else if (s === 2) {
    out.copy(LEAF_SUMMER).multiplyScalar(0.92).lerp(aut, smoothstep(0.02 + variant * 0.16, 0.36 + variant * 0.2, t));
    out.lerp(LEAF_DEAD, smoothstep(0.78, 1, t) * 0.4);
  } else {
    out.copy(aut).lerp(LEAF_DEAD, 0.4 + 0.5 * smoothstep(0, 0.1, t));
    out.lerp(LEAF_BUD, smoothstep(0.93, 1, t));
  }
  return out;
}
function canopyScale(seasonF: number, variant: number): number {
  const s = Math.floor(seasonF) % 4, t = seasonF - Math.floor(seasonF);
  if (s === 0) return lerp(0.45, 1, smoothstep(0, 0.15, t));
  if (s === 1) return 1;
  if (s === 2) return 1 - 0.2 * smoothstep(0.6, 1, t);
  return 0.8 * (1 - smoothstep(0.0, 0.08 + variant * 0.07, t)) + 0.45 * smoothstep(0.94, 1, t);
}

interface TreeInst { x: number; z: number; s: number; ry: number; variant: number; blossom: boolean; dim: number; cy: number }

export function createTerrain(ctx: RenderCtx, envMap: THREE.Texture): Terrain {
  const group = new THREE.Group();
  group.name = 'terrain';
  const U = makeTerrainUniforms();
  const owned: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(o: T): T => { owned.push(o); return o; };

  // ── what we last painted, to diff against ──────────────────────────────
  const kind = new Uint8Array(NT), built = new Uint8Array(NT), seedV = new Uint8Array(NT);
  const wear = new Float32Array(NT);
  const fRoad = new Float32Array(NT), fWater = new Float32Array(NT), fForest = new Float32Array(NT), fRock = new Float32Array(NT), fField = new Float32Array(NT), fBuilt = new Float32Array(NT);
  const parcelOwned = new Uint8Array(12).fill(1);
  const ownedGoal = new Float32Array(12).fill(1);
  let rankIdx = -1;
  let seasonKey = -1;
  let lastSeasonF = 0;

  const samp = (f: Float32Array, px: number, py: number): number => {
    const x = clamp(px - 0.5, 0, MAP_W - 1), y = clamp(py - 0.5, 0, MAP_H - 1);
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(x0 + 1, MAP_W - 1), y1 = Math.min(y0 + 1, MAP_H - 1);
    const fx = x - x0, fy = y - y0;
    const a = f[y0 * MAP_W + x0]!, b = f[y0 * MAP_W + x1]!, c = f[y1 * MAP_W + x0]!, d = f[y1 * MAP_W + x1]!;
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  // the stream as a distance field: 1 on the line through wet tile centres, falling to 0 a tile away.
  // Built from segments between neighbouring wet tiles (diagonals too), so it flows unbroken round every turn.
  const wField = new Float32Array((MAP_W * S + 1) * (MAP_H * S + 1));
  function rebuildWaterField(): void {
    const FX = MAP_W * S + 1, GX = MAP_W * S, GZ = MAP_H * S;
    wField.fill(0);
    const wet = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && fWater[y * MAP_W + x]! > 0;
    const seg = (ax: number, ay: number, bx: number, by: number): void => {
      const x0 = clamp(Math.floor((Math.min(ax, bx) - 1.05) * S), 0, GX), x1 = clamp(Math.ceil((Math.max(ax, bx) + 1.05) * S), 0, GX);
      const z0 = clamp(Math.floor((Math.min(ay, by) - 1.05) * S), 0, GZ), z1 = clamp(Math.ceil((Math.max(ay, by) + 1.05) * S), 0, GZ);
      const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const px = x / S, py = z / S;
        const t = len2 > 0 ? clamp01(((px - ax) * dx + (py - ay) * dy) / len2) : 0;
        const v = 1 - Math.hypot(px - ax - dx * t, py - ay - dy * t);
        const i = z * FX + x;
        if (v > wField[i]!) wField[i] = v;
      }
    };
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      if (!wet(x, y)) continue;
      const cx = x + 0.5, cy = y + 0.5;
      seg(cx, cy, cx, cy);
      if (wet(x + 1, y)) seg(cx, cy, cx + 1, cy);
      if (wet(x, y + 1)) seg(cx, cy, cx, cy + 1);
      if (wet(x + 1, y + 1)) seg(cx, cy, cx + 1, cy + 1);
      if (wet(x - 1, y + 1)) seg(cx, cy, cx - 1, cy + 1);
      // it runs on off the edge of the board
      if (y === 0) seg(cx, cy, cx, -1); if (y === MAP_H - 1) seg(cx, cy, cx, MAP_H + 1);
      if (x === 0) seg(cx, cy, -1, cy); if (x === MAP_W - 1) seg(cx, cy, MAP_W + 1, cy);
    }
  }
  const waterAt = (px: number, py: number): number => {
    const FX = MAP_W * S + 1;
    const x = clamp(px * S, 0, MAP_W * S), y = clamp(py * S, 0, MAP_H * S);
    const x0 = Math.min(Math.floor(x), MAP_W * S - 1), y0 = Math.min(Math.floor(y), MAP_H * S - 1);
    const fx = x - x0, fy = y - y0;
    const a = wField[y0 * FX + x0]!, b = wField[y0 * FX + x0 + 1]!, c = wField[(y0 + 1) * FX + x0]!, d = wField[(y0 + 1) * FX + x0 + 1]!;
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy + (vnoise(px * 1.9 + 7.3, py * 1.9) - 0.5) * 0.2;
  };
  const ownedAt = (tx: number, ty: number): boolean => parcelOwned[clamp(Math.floor(ty / PARCEL), 0, 2) * 4 + clamp(Math.floor(tx / PARCEL), 0, 3)] === 1;

  // ── the ground ─────────────────────────────────────────────────────────
  const gPos = new Float32Array(VX * VZ * 3), gCol = new Float32Array(VX * VZ * 3), gMix = new Float32Array(VX * VZ * 4);
  const gIdx = new Uint16Array(NX * NZ * 6);
  for (let z = 0, k = 0; z < NZ; z++) for (let x = 0; x < NX; x++) {
    const a = z * VX + x, b = a + 1, c = a + VX, d = c + 1;
    // alternate the diagonal so painted edges do not all lean one way
    if ((x + z) & 1) { gIdx[k++] = a; gIdx[k++] = c; gIdx[k++] = b; gIdx[k++] = b; gIdx[k++] = c; gIdx[k++] = d; }
    else { gIdx[k++] = a; gIdx[k++] = c; gIdx[k++] = d; gIdx[k++] = a; gIdx[k++] = d; gIdx[k++] = b; }
  }
  for (let z = 0; z < VZ; z++) for (let x = 0; x < VX; x++) { const i = (z * VX + x) * 3; gPos[i] = x / S - HALF_W; gPos[i + 2] = z / S - HALF_D; }
  const groundGeo = keep(new THREE.BufferGeometry());
  groundGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
  groundGeo.setAttribute('color', new THREE.BufferAttribute(gCol, 3));
  groundGeo.setAttribute('aMix', new THREE.BufferAttribute(gMix, 4));
  groundGeo.setIndex(new THREE.BufferAttribute(gIdx, 1));
  const groundMat = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0 }));
  patchGround(groundMat, U);
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true; ground.frustumCulled = false;
  group.add(ground);

  const C_DIRT = new THREE.Color(PAL.dirt), C_DIRTD = new THREE.Color(PAL.dirtDark), C_ROAD = new THREE.Color(PAL.road);
  const C_FLOOR = new THREE.Color(mixHex(PAL.dirtDark, 0x47552f, 0.55)), C_SCREE = new THREE.Color(mixHex(PAL.rock, PAL.dirt, 0.45));
  const C_SOIL = new THREE.Color(0x77573a), C_BANK = new THREE.Color(0x8a7a58), C_BED = new THREE.Color(0x35504e);

  function paintVertex(ix: number, iz: number): void {
    const px = ix / S, py = iz / S;
    const n1 = fbm(px * 0.33 + 5.1, py * 0.33 + 1.7, 3), n2 = vnoise(px * 1.7 + 3.3, py * 1.7 + 8.1), n3 = vnoise(px * 5.3, py * 5.3 + 2.2);
    const road = smoothstep(0.4, 0.6, samp(fRoad, px, py) + (n2 - 0.5) * 0.2);
    const wv = waterAt(px, py);
    const depth = smoothstep(0.46, 0.72, wv), bank = smoothstep(0.2, 0.46, wv);
    const forest = smoothstep(0.25, 0.7, samp(fForest, px, py) + (n2 - 0.5) * 0.3);
    const rock = smoothstep(0.35, 0.75, samp(fRock, px, py) + (n3 - 0.5) * 0.3);
    const field = smoothstep(0.44, 0.56, samp(fField, px, py) + (n3 - 0.5) * 0.06);
    const yard = samp(fBuilt, px, py);
    const worn = smoothstep(0.06, 0.62, samp(wear, px, py) + (n3 - 0.5) * 0.14);
    let g = 1;
    _c.copy(C_DIRT).lerp(C_DIRTD, n3 * 0.5);
    g *= 1 - 0.5 * forest; _c.lerp(C_FLOOR, forest);
    g *= 1 - 0.62 * rock; _c.lerp(C_SCREE, rock);
    g *= 1 - 0.22 * yard * (0.5 + n3);
    if (worn > 0) { g *= 1 - 0.9 * worn; _c.lerp(_c2.copy(C_DIRT).lerp(C_ROAD, 0.35), worn * 0.8); }
    if (field > 0) { g *= 1 - field; _c.lerp(_c2.copy(C_SOIL).multiplyScalar(0.9 + n3 * 0.2), field); }
    if (road > 0) {
      const edge = 1 - Math.abs(road - 0.5) * 2;      // 1 on the verge, 0 mid-lane and outside
      g *= 1 - road;
      _c.lerp(_c2.copy(C_ROAD).lerp(C_DIRT, 0.25 + n3 * 0.4).multiplyScalar(1 - edge * 0.22), road);
    }
    if (bank > 0) { g *= 1 - bank * 0.92; _c.lerp(_c2.copy(C_BANK).lerp(C_DIRTD, n3 * 0.5), bank); _c.lerp(C_BED, depth); }
    const i3 = (iz * VX + ix) * 3, i4 = (iz * VX + ix) * 4;
    gPos[i3 + 1] = -0.24 * depth - 0.012 * road * (1 - bank);
    gCol[i3] = _c.r; gCol[i3 + 1] = _c.g; gCol[i3 + 2] = _c.b;
    gMix[i4] = g;
    gMix[i4 + 1] = clamp01(n1 * 1.3 - 0.15);
    gMix[i4 + 2] = (1 - bank) * (1 - road * 0.58) * (1 - worn * 0.4);
    gMix[i4 + 3] = field * (1 - road);
  }
  function paintRegion(tx0: number, ty0: number, tx1: number, ty1: number): void {
    const x0 = clamp(Math.floor(tx0 - 1) * S, 0, NX), x1 = clamp(Math.ceil(tx1 + 2) * S, 0, NX);
    const z0 = clamp(Math.floor(ty0 - 1) * S, 0, NZ), z1 = clamp(Math.ceil(ty1 + 2) * S, 0, NZ);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) paintVertex(x, z);
    groundGeo.getAttribute('position').needsUpdate = true;
    groundGeo.getAttribute('color').needsUpdate = true;
    groundGeo.getAttribute('aMix').needsUpdate = true;
    groundGeo.computeVertexNormals();
  }

  // ── the stream ─────────────────────────────────────────────────────────
  const waterMat = keep(new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: 0.14, metalness: 0, envMap, envMapIntensity: 0.9 }));
  patchWater(waterMat, U);
  let water: THREE.Mesh | null = null;
  function rebuildWater(): void {
    if (water) { group.remove(water); water.geometry.dispose(); water = null; }
    const near = new Uint8Array(NT);
    let any = false;
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (fWater[y * MAP_W + x]! > 0) {
      any = true;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < MAP_W && yy < MAP_H) near[yy * MAP_W + xx] = 1; }
    }
    if (!any) return;
    const pos: number[] = [], col: number[] = [];
    const shallow = _c.setHex(0x7fb3c4), deep = _c2.setHex(PAL.waterDeep), midc = _c3.setHex(PAL.water);
    const W = 3;                              // water cells per tile edge
    const vert = (px: number, py: number) => {
      const d = smoothstep(0.34, 0.8, waterAt(px, py));
      pos.push(px - HALF_W, WATER_Y, py - HALF_D);
      const r = d < 0.5 ? lerp(shallow.r, midc.r, d * 2) : lerp(midc.r, deep.r, d * 2 - 1);
      const g = d < 0.5 ? lerp(shallow.g, midc.g, d * 2) : lerp(midc.g, deep.g, d * 2 - 1);
      const b = d < 0.5 ? lerp(shallow.b, midc.b, d * 2) : lerp(midc.b, deep.b, d * 2 - 1);
      col.push(r, g, b, smoothstep(0.0, 0.3, d) * 0.9);
    };
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      if (!near[y * MAP_W + x]) continue;
      for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
        const x0 = x + i / W, x1 = x + (i + 1) / W, y0 = y + j / W, y1 = y + (j + 1) / W;
        if (Math.max(waterAt(x0, y0), waterAt(x1, y0), waterAt(x0, y1), waterAt(x1, y1)) < 0.3) continue;
        vert(x0, y0); vert(x0, y1); vert(x1, y1); vert(x0, y0); vert(x1, y1); vert(x1, y0);
      }
    }
    if (!pos.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    const nor = new Float32Array(pos.length); for (let i = 1; i < nor.length; i += 3) nor[i] = 1;
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    water = new THREE.Mesh(g, waterMat);
    water.receiveShadow = true; water.renderOrder = 1;
    group.add(water);
  }

  // ── scatter: trees, rocks, tufts, flowers, crops ───────────────────────
  const trunkCol = PAL.trunk;
  const oakTrunkG = new Geo(), birchTrunkG = new Geo(), pineG = new Geo(), oakLeafG = new Geo(), birchLeafG = new Geo();
  oakTrunkG.add(new THREE.CylinderGeometry(0.065, 0.115, 0.7, 5), TRS(0, 0.35, 0), trunkCol);
  for (const [ry, rz, len] of [[0.3, 0.75, 0.6], [2.4, -0.7, 0.55], [4.3, 0.6, 0.5], [1.4, -0.35, 0.62]] as const)
    oakTrunkG.add(new THREE.CylinderGeometry(0.022, 0.045, len, 4).translate(0, len / 2, 0), new THREE.Matrix4().makeRotationY(ry).multiply(TRS(0, 0.62, 0, 0, 0, rz)), mixHex(trunkCol, 0x000000, 0.12));
  const blobGeo = (r: number, seed: number) => jitter(new THREE.IcosahedronGeometry(r, 1), r * 0.3, seed);
  oakLeafG.add(blobGeo(0.52, 11), TRS(0, 1.16, 0, 0, 0, 0, 1, 0.86, 1), 0xffffff);
  oakLeafG.add(blobGeo(0.36, 12), TRS(0.32, 0.95, 0.14, 0, 0, 0, 1, 0.85, 1), 0xe9e9e9);
  oakLeafG.add(blobGeo(0.38, 13), TRS(-0.28, 1.0, -0.17, 0, 0, 0, 1, 0.85, 1), 0xdcdcdc);
  birchTrunkG.add(new THREE.CylinderGeometry(0.04, 0.07, 1.0, 5), TRS(0, 0.5, 0), 0xd8d1bf);
  for (const [ry, rz, len] of [[0.9, 0.5, 0.5], [3.6, -0.55, 0.46], [5.2, 0.4, 0.4]] as const)
    birchTrunkG.add(new THREE.CylinderGeometry(0.016, 0.03, len, 4).translate(0, len / 2, 0), new THREE.Matrix4().makeRotationY(ry).multiply(TRS(0, 0.9, 0, 0, 0, rz)), 0xb9b2a2);
  birchLeafG.add(blobGeo(0.5, 21), TRS(0, 1.34, 0, 0, 0, 0, 0.7, 1.5, 0.7), 0xffffff);
  birchLeafG.add(blobGeo(0.3, 22), TRS(0.14, 0.92, 0.1, 0, 0, 0, 0.9, 1, 0.9), 0xe4e4e4);
  pineG.add(new THREE.CylinderGeometry(0.055, 0.09, 0.5, 5), TRS(0, 0.25, 0), trunkCol);
  pineG.add(jitter(new THREE.ConeGeometry(0.52, 0.78, 7), 0.07, 31), TRS(0, 0.74, 0), PAL.pine);
  pineG.add(jitter(new THREE.ConeGeometry(0.41, 0.68, 7), 0.06, 32), TRS(0, 1.14, 0, 0, 0.5, 0), mixHex(PAL.pine, 0x5a8a55, 0.25));
  pineG.add(jitter(new THREE.ConeGeometry(0.29, 0.62, 6), 0.05, 33), TRS(0, 1.52, 0, 0, 1.1, 0), mixHex(PAL.pine, 0x6a9a5a, 0.4));
  const treeGeos = [keep(oakTrunkG.build()), keep(oakLeafG.build()), keep(birchTrunkG.build()), keep(birchLeafG.build()), keep(pineG.build())];
  const leafCentre = [1.08, 1.25];            // canopy pivot heights (oak, birch)
  const woodMat = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  const leafMat = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 }));
  const depthMat = keep(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
  for (const mtl of [woodMat, leafMat]) { patchSnow(mtl, U); patchSway(mtl, U); }
  patchSway(depthMat, U);
  const MAXT = 420;
  const mkInst = (geo: THREE.BufferGeometry, mat: THREE.Material, max: number, cast: boolean, sway = false): THREE.InstancedMesh => {
    const m = new THREE.InstancedMesh(geo, mat, max);
    m.count = 0; m.castShadow = cast; m.receiveShadow = true; m.frustumCulled = false;
    if (cast && sway) m.customDepthMaterial = depthMat;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(m);
    return m;
  };
  const oakTrunks = mkInst(treeGeos[0]!, woodMat, MAXT, true, true), oakLeaves = mkInst(treeGeos[1]!, leafMat, MAXT, true, true);
  const birchTrunks = mkInst(treeGeos[2]!, woodMat, MAXT, true, true), birchLeaves = mkInst(treeGeos[3]!, leafMat, MAXT, true, true);
  const pines = mkInst(treeGeos[4]!, woodMat, MAXT, true, true);
  const oaks: TreeInst[] = [], birches: TreeInst[] = [], pineList: TreeInst[] = [];

  const rockGeo = keep(jitter(new THREE.IcosahedronGeometry(1, 0), 0.42, 5).scale(1, 0.72, 1));
  rockGeo.computeVertexNormals();
  const rockMat = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }));
  patchSnow(rockMat, U);
  const rocks = mkInst(rockGeo, rockMat, 400, true);

  const tuftG = new Geo();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4, lean = 0.05 + (i % 2) * 0.04, h = 0.13 + (i % 3) * 0.035, w = 0.028;
    const bx = Math.cos(a) * 0.03, bz = Math.sin(a) * 0.03, tx = Math.cos(a) * (0.03 + lean), tz = Math.sin(a) * (0.03 + lean);
    const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    tuftG.quad(bx - px, 0, bz - pz, bx + px, 0, bz + pz, tx, h, tz, tx, h, tz, i % 2 ? 0xffffff : 0xd8d8d8);
  }
  const tuftGeo = keep(tuftG.build());
  { const n = tuftGeo.getAttribute('normal') as THREE.BufferAttribute; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); }
  const tuftMat = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }));
  patchSway(tuftMat, U, 14);
  patchSnow(tuftMat, U);
  const MAXTUFT = 1100;
  const tufts = mkInst(tuftGeo, tuftMat, MAXTUFT, false);
  const tuftData: { x: number; z: number; s: number; ry: number; dim: number; dry: number }[] = [];

  const flowerGeo = keep(new THREE.OctahedronGeometry(0.05, 0));
  const flowerMat = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }));
  const MAXFLOWER = 900;
  const flowers = mkInst(flowerGeo, flowerMat, MAXFLOWER, false);
  const flowerData: { x: number; z: number; k: number; ry: number; s: number; dim: number; nearTree: boolean }[] = [];

  const cropGeo = keep(new THREE.BoxGeometry(1, 1, 0.17).translate(0, 0.5, 0));
  { const p = cropGeo.getAttribute('position') as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.5) p.setZ(i, p.getZ(i) * 0.45); cropGeo.computeVertexNormals(); }
  const cropMat = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 }));
  patchSnow(cropMat, U);
  const MAXCROP = 900;
  const crops = mkInst(cropGeo, cropMat, MAXCROP, true);
  const cropData: { x: number; z: number; h: number; dim: number; cut: number }[] = [];

  function setTrees(list: TreeInst[], trunks: THREE.InstancedMesh, leaves: THREE.InstancedMesh | null): void {
    const n = Math.min(list.length, MAXT);
    for (let i = 0; i < n; i++) {
      const t = list[i]!;
      trunks.setMatrixAt(i, composeInto(_m, t.x, 0, t.z, 0, t.ry, 0, t.s, t.s, t.s));
      trunks.setColorAt(i, _c.setScalar(t.dim));
    }
    trunks.count = n; trunks.instanceMatrix.needsUpdate = true;
    if (trunks.instanceColor) trunks.instanceColor.needsUpdate = true;
    if (leaves) leaves.count = n;
  }
  function dressTrees(list: TreeInst[], leaves: THREE.InstancedMesh, seasonF: number): void {
    const n = Math.min(list.length, MAXT);
    for (let i = 0; i < n; i++) {
      const t = list[i]!;
      const k = canopyScale(seasonF, t.variant);
      // scale the canopy about its own middle so it thins on the branch instead of sinking into the trunk
      const s = t.s * k;
      leaves.setMatrixAt(i, composeInto(_m, t.x, t.cy * t.s * (1 - k), t.z, 0, t.ry, 0, s, s, s));
      leaves.setColorAt(i, leafColor(_c, seasonF, t.variant, t.blossom).multiplyScalar(t.dim));
    }
    leaves.instanceMatrix.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  }
  function dressSeason(seasonF: number): void {
    dressTrees(oaks, oakLeaves, seasonF);
    dressTrees(birches, birchLeaves, seasonF);
    const s = Math.floor(seasonF) % 4, t = seasonF - Math.floor(seasonF);
    // tufts: lush, then dry, then gone under winter
    seasonBlend(GRASS_A, seasonF, _c2).multiplyScalar(0.78);
    const tuftK = s === 3 ? 0.55 * (1 - smoothstep(0.05, 0.25, t)) + 0.55 * smoothstep(0.9, 1, t) : s === 2 ? 1 - 0.45 * smoothstep(0.5, 1, t) : s === 0 ? lerp(0.6, 1, smoothstep(0, 0.2, t)) : 1;
    for (let i = 0; i < tuftData.length; i++) {
      const d = tuftData[i]!;
      const sc = d.s * tuftK;
      tufts.setMatrixAt(i, composeInto(_m, d.x, 0, d.z, 0, d.ry, 0, sc, sc * (0.8 + d.dry * 0.5), sc));
      tufts.setColorAt(i, _c.copy(_c2).lerp(_c3.setHex(0xb8a45a), d.dry * (s === 1 ? 0.5 : s === 2 ? 0.7 : 0.15)).multiplyScalar(d.dim));
    }
    tufts.count = tuftData.length; tufts.instanceMatrix.needsUpdate = true;
    if (tufts.instanceColor) tufts.instanceColor.needsUpdate = true;
    // flowers: spring blossom, a summer scattering, autumn's fallen leaves, nothing in winter
    for (let i = 0; i < flowerData.length; i++) {
      const d = flowerData[i]!;
      let sc = 0, flat = false;
      if (s === 0) sc = smoothstep(0.03 + d.s * 0.15, 0.2 + d.s * 0.2, t);
      else if (s === 1) sc = d.s < 0.45 ? 1 - 0.4 * t : 1 - smoothstep(0, 0.3, t);
      else if (s === 2) { flat = true; sc = d.nearTree ? smoothstep(0.1 + d.s * 0.3, 0.45 + d.s * 0.3, t) : (d.s < 0.45 ? (1 - smoothstep(0, 0.2, t)) * 0.6 : 0); if (!d.nearTree) flat = false; }
      else { flat = true; sc = d.nearTree ? 1 - smoothstep(0, 0.12, t) : 0; }
      if (flat) {
        flowers.setMatrixAt(i, composeInto(_m, d.x, 0.012, d.z, 0, d.ry, 0, 1.7 * sc, 0.12 * sc, 1.1 * sc));
        flowers.setColorAt(i, _c.copy(LEAF_AUT[d.k % 3]!).multiplyScalar(d.dim * 0.95));
      } else {
        flowers.setMatrixAt(i, composeInto(_m, d.x, 0.06 + d.s * 0.04, d.z, 0.4, d.ry, 0.3, sc, sc, sc));
        flowers.setColorAt(i, _c.copy(FLOWERS[d.k % FLOWERS.length]!).multiplyScalar(d.dim));
      }
    }
    flowers.count = flowerData.length; flowers.instanceMatrix.needsUpdate = true;
    if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
    // crops: shoots, green, gold, cut field by field, stubble
    for (let i = 0; i < cropData.length; i++) {
      const d = cropData[i]!;
      let h = 0;
      if (s === 0) { h = 0.1 * smoothstep(0.15, 1, t); _c.copy(CROP_GREEN); }
      else if (s === 1) { h = lerp(0.1, 0.24, smoothstep(0, 0.7, t)); _c.copy(CROP_GREEN).lerp(CROP_GOLD, smoothstep(0.35, 0.9, t)); }
      else if (s === 2) { const cut = smoothstep(d.cut, d.cut + 0.04, t); h = lerp(0.24, 0.04, cut); _c.copy(CROP_GOLD).lerp(CROP_STUBBLE, cut); }
      else { h = 0.04 * (1 - smoothstep(0.6, 0.9, t)); _c.copy(CROP_STUBBLE); }
      h *= d.h;
      crops.setMatrixAt(i, composeInto(_m, d.x, 0, d.z, 0, 0, 0, 1, Math.max(h, 0.0001), h > 0.002 ? 1 : 0));
      crops.setColorAt(i, _c.multiplyScalar(d.dim));
    }
    crops.count = cropData.length; crops.instanceMatrix.needsUpdate = true;
    if (crops.instanceColor) crops.instanceColor.needsUpdate = true;
  }

  function rebuildScatter(): void {
    oaks.length = 0; birches.length = 0; pineList.length = 0; tuftData.length = 0; flowerData.length = 0; cropData.length = 0;
    let nRock = 0;
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const i = y * MAP_W + x, k = kind[i]!, v = seedV[i]!;
      const dim = ownedAt(x, y) ? 1 : 0.7;
      const wx = x + 0.5 - HALF_W, wz = y + 0.5 - HALF_D;
      const h = (n: number) => hash01(i * 31 + v * 7 + n);
      if (built[i]) continue;
      if (k === KIND.forest) {
        const grove = vnoise(x * 0.31 + 3.3, y * 0.31 + 7.7);     // woods cluster by kind
        const n = 1 + (h(1) < 0.4 ? 1 : 0);
        for (let j = 0; j < n; j++) {
          const pick = grove + (h(10 + j) - 0.5) * 0.36;
          const t: TreeInst = {
            x: wx + (h(20 + j) - 0.5) * (n > 1 ? 0.62 : 0.4), z: wz + (h(30 + j) - 0.5) * (n > 1 ? 0.62 : 0.4),
            s: (0.82 + h(40 + j) * 0.5) * (j ? 0.8 : 1), ry: h(50 + j) * TAU, variant: h(60 + j), blossom: h(70 + j) < 0.3, dim, cy: 1,
          };
          if (pick < 0.4) { pineList.push(t); }
          else if (pick < 0.62) { t.cy = leafCentre[1]!; birches.push(t); }
          else { t.cy = leafCentre[0]!; oaks.push(t); }
        }
        if (h(2) < 0.5 && flowerData.length < MAXFLOWER) flowerData.push({ x: wx + (h(3) - 0.5) * 0.9, z: wz + (h(4) - 0.5) * 0.9, k: v, ry: h(5) * TAU, s: h(6), dim, nearTree: true });
      } else if (k === KIND.rock) {
        const n = 1 + Math.floor(h(1) * 2.6);
        for (let j = 0; j < n && nRock < 400; j++) {
          const s = j === 0 ? 0.26 + h(11) * 0.2 : 0.1 + h(12 + j) * 0.1;
          const ox = j === 0 ? (h(13) - 0.5) * 0.3 : (h(14 + j) - 0.5) * 0.8, oz = j === 0 ? (h(15) - 0.5) * 0.3 : (h(16 + j) - 0.5) * 0.8;
          rocks.setMatrixAt(nRock, composeInto(_m, wx + ox, s * 0.28, wz + oz, h(17 + j) * 0.5, h(18 + j) * TAU, h(19 + j) * 0.5, s * (0.9 + h(21 + j) * 0.5), s, s));
          rocks.setColorAt(nRock, _c.setHex(PAL.rock).lerp(_c2.setHex(PAL.rockDark), h(22 + j)).multiplyScalar(dim));
          nRock++;
        }
      } else if (k === KIND.field) {
        for (let r = 0; r < 3 && cropData.length < MAXCROP; r++) cropData.push({ x: wx, z: y - HALF_D + (r + 0.25) / 3, h: 0.85 + hash2(x * 3 + r, y) * 0.3, dim, cut: 0.22 + hash2(Math.floor(x / 3), Math.floor(y / 2) + 40) * 0.2 });
      } else if (k === KIND.grass) {
        const worn = wear[i]! > 0.25;
        const meadow = vnoise(x * 0.27 + 9.1, y * 0.27 + 4.2);
        const nt = worn ? 0 : h(1) < 0.42 ? (h(2) < 0.35 ? 2 : 1) : 0;
        for (let j = 0; j < nt && tuftData.length < MAXTUFT; j++) tuftData.push({ x: wx + (h(20 + j) - 0.5) * 0.9, z: wz + (h(30 + j) - 0.5) * 0.9, s: 0.75 + h(40 + j) * 0.7, ry: h(50 + j) * TAU, dim, dry: h(55 + j) });
        const nf = worn ? 0 : meadow > 0.56 ? (h(3) < 0.75 ? 2 : 1) : h(3) < 0.07 ? 1 : 0;
        const nearTree = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const xx = x + dx!, yy = y + dy!; return xx >= 0 && yy >= 0 && xx < MAP_W && yy < MAP_H && kind[yy * MAP_W + xx] === KIND.forest; });
        for (let j = 0; j < nf + (nearTree ? 1 : 0) && flowerData.length < MAXFLOWER; j++)
          flowerData.push({ x: wx + (h(60 + j) - 0.5) * 0.94, z: wz + (h(70 + j) - 0.5) * 0.94, k: Math.floor(meadow * 23 + h(80 + j) * 2.2), ry: h(90 + j) * TAU, s: h(95 + j), dim, nearTree: nearTree && j >= nf });
      }
    }
    rocks.count = nRock; rocks.instanceMatrix.needsUpdate = true;
    if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
    setTrees(oaks, oakTrunks, oakLeaves); setTrees(birches, birchTrunks, birchLeaves); setTrees(pineList, pines, null);
    dressSeason(lastSeasonF);
  }

  // ── fences, signposts, bridges (one baked mesh) ────────────────────────
  const fixMat = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 }));
  patchSnow(fixMat, U, 0.85);
  let fixtures: THREE.Mesh | null = null;
  function rebuildFixtures(state: GameState): void {
    if (fixtures) { group.remove(fixtures); fixtures.geometry.dispose(); fixtures = null; }
    const g = new Geo();
    const isLane = (x: number, y: number): boolean => { if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return false; const k = kind[y * MAP_W + x]!; return k === KIND.road || k === KIND.bridge; };
    const isWet = (x: number, y: number): boolean => { if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return false; const k = kind[y * MAP_W + x]!; return k === KIND.water || k === KIND.bridge; };
    // bridges: an arched deck of planks with rails, along the lane
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      if (kind[y * MAP_W + x] !== KIND.bridge) continue;
      const alongX = isLane(x - 1, y) || isLane(x + 1, y) || !(isLane(x, y - 1) || isLane(x, y + 1));
      const base = TRS(x + 0.5 - HALF_W, 0, y + 0.5 - HALF_D, 0, alongX ? 0 : Math.PI / 2, 0);
      const NPL = 7;
      for (let i = 0; i < NPL; i++) {
        const u = (i + 0.5) / NPL - 0.5, arch = 0.11 * (1 - (u * 2) ** 2);
        g.add(new THREE.BoxGeometry(1.24 / NPL - 0.012, 0.05, 0.8), base.clone().multiply(TRS(u * 1.24, 0.03 + arch, 0, 0, 0, -u * 0.36)), i % 2 ? PAL.timberLight : mixHex(PAL.timberLight, PAL.timber, 0.35));
      }
      for (const s of [-1, 1]) {
        for (const px of [-0.5, 0, 0.5]) g.add(new THREE.BoxGeometry(0.06, 0.34, 0.06), base.clone().multiply(TRS(px, 0.2 + 0.11 * (1 - (px * 2 / 1.24) ** 2), s * 0.4)), PAL.timber);
        for (const sx of [-1, 1]) g.add(new THREE.BoxGeometry(0.54, 0.045, 0.045), base.clone().multiply(TRS(sx * 0.25, 0.39 + 0.055, s * 0.4, 0, 0, -sx * 0.2)), PAL.timber);
        g.add(new THREE.BoxGeometry(1.4, 0.07, 0.07), base.clone().multiply(TRS(0, -0.03, s * 0.34)), PAL.timber);
      }
    }
    // rope and stakes where the realm meets land not yet bought
    const stakeDone = new Set<number>();
    const stake = (tx: number, ty: number, tall = false) => {
      const key = ty * 64 + tx;
      if (stakeDone.has(key)) return;
      stakeDone.add(key);
      if (isWet(tx, ty) || isWet(tx - 1, ty) || isWet(tx, ty - 1) || isWet(tx - 1, ty - 1)) return;   // not in the stream
      const h = tall ? 0.52 : 0.36, lean = (hash2(tx, ty) - 0.5) * 0.16;
      g.add(new THREE.BoxGeometry(0.075, h, 0.075), TRS(tx - HALF_W, h / 2, ty - HALF_D, lean, hash2(ty, tx) * 2, lean * 0.7), PAL.timberLight);
      g.add(new THREE.BoxGeometry(0.085, 0.07, 0.085), TRS(tx - HALF_W, h - 0.035, ty - HALF_D, lean, hash2(ty, tx) * 2, lean * 0.7), tall ? PAL.crimson : PAL.parchment);
    };
    const rope = (ax: number, ay: number, bx: number, by: number) => {
      const NSEG = 4, sag = 0.1, top = 0.3;
      for (let i = 0; i < NSEG; i++) {
        const u0 = i / NSEG, u1 = (i + 1) / NSEG;
        const x0 = lerp(ax, bx, u0) - HALF_W, z0 = lerp(ay, by, u0) - HALF_D, x1 = lerp(ax, bx, u1) - HALF_W, z1 = lerp(ay, by, u1) - HALF_D;
        const y0 = top - sag * 4 * u0 * (1 - u0), y1 = top - sag * 4 * u1 * (1 - u1);
        const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
        const m = new THREE.Matrix4().lookAt(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1), new THREE.Vector3(0, 1, 0));
        m.setPosition((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
        g.add(new THREE.BoxGeometry(0.026, 0.026, len + 0.01), m, 0xb9a57a);
      }
    };
    const P = state.map.parcels;
    const isOwned = (px: number, py: number): boolean => parcelOwned[py * 4 + px] === 1;
    // tall survey stakes where four lots meet, if any of them is still for sale (placed first so they win the spot)
    for (let py = 1; py < 3; py++) for (let px = 1; px < 4; px++) {
      if (isOwned(px - 1, py - 1) && isOwned(px, py - 1) && isOwned(px - 1, py) && isOwned(px, py)) continue;
      stake(px * PARCEL, py * PARCEL, true);
    }
    for (let py = 0; py < 3; py++) for (let px = 0; px < 4; px++) {
      // east edge of (px,py) against (px+1,py); south edge against (px,py+1)
      if (px < 3 && isOwned(px, py) !== isOwned(px + 1, py)) {
        const x = (px + 1) * PARCEL;
        for (let t = 0; t < PARCEL; t += 2) {
          const y0 = py * PARCEL + t, gap = [0, 1].some(d => isLane(x - 1, y0 + d) || isLane(x, y0 + d) || isWet(x - 1, y0 + d) || isWet(x, y0 + d));
          stake(x, y0); stake(x, y0 + 2);
          if (!gap) rope(x, y0, x, y0 + 2);
        }
      }
      if (py < 2 && isOwned(px, py) !== isOwned(px, py + 1)) {
        const y = (py + 1) * PARCEL;
        for (let t = 0; t < PARCEL; t += 2) {
          const x0 = px * PARCEL + t, gap = [0, 1].some(d => isLane(x0 + d, y - 1) || isLane(x0 + d, y) || isWet(x0 + d, y - 1) || isWet(x0 + d, y));
          stake(x0, y); stake(x0 + 2, y);
          if (!gap) rope(x0, y, x0 + 2, y);
        }
      }
    }
    // a signpost on each lot for sale: a gold coin if the Crown will sell it to you now, a lock if not yet
    let cx = 0, cy = 0, cn = 0;
    for (let i = 0; i < 12; i++) if (parcelOwned[i]) { cx += (i % 4) * PARCEL + PARCEL / 2; cy += Math.floor(i / 4) * PARCEL + PARCEL / 2; cn++; }
    if (cn) { cx /= cn; cy /= cn; } else { cx = MAP_W / 2; cy = MAP_H / 2; }
    for (let i = 0; i < 12; i++) {
      if (parcelOwned[i]) continue;
      const x0 = (i % 4) * PARCEL, y0 = Math.floor(i / 4) * PARCEL;
      let best = -1, bd = 1e9;
      for (let y = y0 + 1; y < y0 + PARCEL - 1; y++) for (let x = x0 + 1; x < x0 + PARCEL - 1; x++) {
        const ti = y * MAP_W + x;
        if (kind[ti] !== KIND.grass || built[ti]) continue;
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) + hash2(x, y) * 0.5;
        if (d < bd) { bd = d; best = ti; }
      }
      if (best < 0) continue;
      const sx = (best % MAP_W) + 0.5 - HALF_W, sz = Math.floor(best / MAP_W) + 0.5 - HALF_D;
      const lean = (hash01(i * 91) - 0.5) * 0.14, turn = (hash01(i * 17) - 0.5) * 0.5;
      const base = TRS(sx, 0, sz, 0, turn, lean);
      const parcel = P[i];
      const open = !parcel || RANK_ORDER.indexOf(parcel.minRank) <= rankIdx;
      g.add(new THREE.BoxGeometry(0.09, 0.74, 0.09), base.clone().multiply(TRS(0, 0.37, 0)), PAL.timber);
      g.add(new THREE.BoxGeometry(0.56, 0.3, 0.05), base.clone().multiply(TRS(0, 0.62, 0.06)), 0xd9c9a0);
      g.add(new THREE.BoxGeometry(0.6, 0.045, 0.06), base.clone().multiply(TRS(0, 0.78, 0.06)), PAL.timberLight);
      if (open) g.add(new THREE.CylinderGeometry(0.085, 0.085, 0.03, 10), base.clone().multiply(TRS(0, 0.62, 0.1, Math.PI / 2, 0, 0)), PAL.gold, false);
      else {
        g.add(new THREE.BoxGeometry(0.14, 0.11, 0.03), base.clone().multiply(TRS(0, 0.59, 0.1)), PAL.iron);
        g.add(new THREE.TorusGeometry(0.045, 0.014, 4, 8, Math.PI), base.clone().multiply(TRS(0, 0.645, 0.1)), PAL.iron, false);
      }
    }
    if (g.count === 0) return;
    fixtures = new THREE.Mesh(g.build(), fixMat);
    fixtures.castShadow = true; fixtures.receiveShadow = true;
    group.add(fixtures);
  }

  // ── tile overlays ──────────────────────────────────────────────────────
  const overlayMat = () => keep(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  const hiMat = overlayMat(), markMat = overlayMat();
  let hi: THREE.Mesh | null = null, marks: THREE.Mesh | null = null;
  function tilesMesh(tiles: [number, number][], color: number, mat: THREE.Material, y: number): THREE.Mesh {
    const set = new Set<number>();
    for (const [x, yy] of tiles) if (x >= 0 && yy >= 0 && x < MAP_W && yy < MAP_H) set.add(yy * MAP_W + x);
    const pos: number[] = [], col: number[] = [];
    _c.setHex(color);
    const quad = (x0: number, z0: number, x1: number, z1: number, a: number) => {
      pos.push(x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0);
      for (let i = 0; i < 6; i++) col.push(_c.r, _c.g, _c.b, a);
    };
    const B = 0.075;
    for (const k of set) {
      const x = k % MAP_W, yy = Math.floor(k / MAP_W), wx = x - HALF_W, wz = yy - HALF_D;
      quad(wx, wz, wx + 1, wz + 1, 0.2);
      if (!set.has(k - MAP_W) || yy === 0) quad(wx, wz, wx + 1, wz + B, 0.85);
      if (!set.has(k + MAP_W) || yy === MAP_H - 1) quad(wx, wz + 1 - B, wx + 1, wz + 1, 0.85);
      if (!set.has(k - 1) || x === 0) quad(wx, wz, wx + B, wz + 1, 0.85);
      if (!set.has(k + 1) || x === MAP_W - 1) quad(wx + 1 - B, wz, wx + 1, wz + 1, 0.85);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    const m = new THREE.Mesh(g, mat);
    m.renderOrder = 5; m.frustumCulled = false;
    return m;
  }

  // ── reading the map ────────────────────────────────────────────────────
  function readTiles(state: GameState, full: boolean): { x0: number; y0: number; x1: number; y1: number; kinds: boolean; water: boolean; scatter: boolean } | null {
    const tiles = state.map.tiles;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, kinds = false, waterCh = false, scatter = false;
    const ok = tiles.length >= NT;
    for (let i = 0; i < NT; i++) {
      const t = ok ? tiles[i]! : null;
      const k = t ? KIND[t.t] ?? 0 : 0, b = t && t.b ? 1 : 0, w = t ? t.wear : 0;
      let ch = full;
      if (k !== kind[i]) {
        const wasWet = kind[i] === KIND.water || kind[i] === KIND.bridge, isWet = k === KIND.water || k === KIND.bridge;
        if (wasWet !== isWet || full) waterCh = true;
        kind[i] = k; kinds = true; scatter = true; ch = true;
        fRoad[i] = k === KIND.road || k === KIND.bridge ? 1 : 0;
        fWater[i] = isWet ? 1 : 0;
        fForest[i] = k === KIND.forest ? 1 : 0; fRock[i] = k === KIND.rock ? 1 : 0; fField[i] = k === KIND.field ? 1 : 0;
      }
      if (b !== built[i]) { built[i] = b; fBuilt[i] = b; scatter = true; ch = true; }
      if (Math.abs(w - wear[i]!) > 0.05 || (full && w !== wear[i])) { if ((w > 0.25) !== (wear[i]! > 0.25)) scatter = true; wear[i] = w; ch = true; }
      if (t && t.v !== seedV[i]) { seedV[i] = t.v; scatter = true; }
      if (ch) { const x = i % MAP_W, y = Math.floor(i / MAP_W); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (full) { waterCh = true; kinds = true; scatter = true; }
    return x1 < 0 ? null : { x0, y0, x1, y1, kinds, water: waterCh, scatter };
  }
  function readParcels(state: GameState, snap: boolean): boolean {
    let changed = false;
    for (let i = 0; i < 12; i++) {
      const p = state.map.parcels[i];
      const o = !p || p.owned ? 1 : 0;
      if (o !== parcelOwned[i]) { parcelOwned[i] = o; changed = true; }
      ownedGoal[i] = o;
      if (snap) U.uOwned.value[i] = o;
    }
    const r = RANK_ORDER.indexOf(state.realm.rank);
    if (r !== rankIdx) { rankIdx = r; changed = true; }
    return changed;
  }

  let frameNo = 0;
  const api: Terrain = {
    group, uniforms: U,
    reset(state) {
      kind.fill(255);
      readParcels(state, true);
      readTiles(state, true);
      rebuildWaterField();
      paintRegion(0, 0, MAP_W, MAP_H);
      rebuildWater();
      rebuildScatter();
      rebuildFixtures(state);
    },
    sync(state) {
      // tiles are diffed every few frames; a 768-entry loop is nothing, the repaint only happens on change
      if ((frameNo++ & 3) !== 0) return;
      const parcelsChanged = readParcels(state, false);
      const d = readTiles(state, false);
      if (d) {
        if (d.water) rebuildWaterField();
        paintRegion(d.x0, d.y0, d.x1, d.y1);
        if (d.water) rebuildWater();
        if (d.scatter) rebuildScatter();
      }
      if (parcelsChanged && !(d && d.scatter)) rebuildScatter();
      if (parcelsChanged || (d && d.kinds)) rebuildFixtures(state);
    },
    setHighlight(tiles, color = PAL.gold) {
      if (hi) { group.remove(hi); hi.geometry.dispose(); hi = null; }
      if (tiles && tiles.length) { hi = tilesMesh(tiles, color, hiMat, 0.03); group.add(hi); }
    },
    setMarks(tiles, color = PAL.good) {
      if (marks) { group.remove(marks); marks.geometry.dispose(); marks = null; }
      if (tiles && tiles.length) { marks = tilesMesh(tiles, color, markMat, 0.045); group.add(marks); }
    },
    setGrid(amount, wx = 0, wz = 0) { U.uGrid.value.set(wx, wz, amount, 7.5); },
    update(env, sky) {
      U.uTime.value = env.time;
      U.uWind.value = env.wind;
      U.uSnow.value = env.snow;
      seasonBlend(GRASS_A, sky.seasonF, U.uGrassA.value);
      seasonBlend(GRASS_B, sky.seasonF, U.uGrassB.value);
      U.uSnowCol.value.setHex(PAL.grassWinter).lerp(_c.setHex(PAL.snow), 0.45).multiplyScalar(0.95);
      for (let i = 0; i < 12; i++) { const v = U.uOwned.value[i]!, goal = ownedGoal[i]!; if (v !== goal) U.uOwned.value[i] = Math.abs(v - goal) < 0.004 ? goal : damp(v, goal, 2.4, env.dt); }
      const frozen = smoothstep(0.55, 0.85, env.snow);
      U.uFrozen.value = frozen;
      waterMat.roughness = lerp(0.14, 0.42, frozen);
      waterMat.envMapIntensity = lerp(0.5, 1.0, sky.day) * (1 - frozen * 0.4);
      hiMat.opacity = 0.72 + 0.28 * Math.sin(env.time * 3.2);
      // leaves, crops and flowers follow the calendar, a game-day at a time
      lastSeasonF = sky.seasonF;
      const key = Math.floor(sky.seasonF * 90 / 1.25);
      if (key !== seasonKey) { seasonKey = key; dressSeason(sky.seasonF); }
    },
    dispose() {
      for (const o of owned) o.dispose();
      for (const m of [oakTrunks, oakLeaves, birchTrunks, birchLeaves, pines, rocks, tufts, flowers, crops]) m.dispose();
      water?.geometry.dispose(); fixtures?.geometry.dispose(); hi?.geometry.dispose(); marks?.geometry.dispose();
    },
  };
  return api;
}
