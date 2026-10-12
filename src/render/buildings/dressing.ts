/**
 * What gets hung on a building after it is built: the TO LET shingle, the
 * gargoyles nobody asked for, the banner of a goblin household that has been
 * there a year and a day, and the snow that drifts against its walls.
 * Geometry here is made once and shared by every building on the table.
 */
import * as THREE from 'three';
import type { BuildingLook } from '../api';
import type { BuiltBody } from './types';
import { PAL } from '../palette';
import { Sculpt, paintMat, makeCloth, type Rng } from './parts';
import { soupOf } from './shared';
import type { Bounds } from './wear';

const shared = <T extends THREE.BufferGeometry>(g: T): T => { g.userData.shared = true; g.userData.owned = false; return g; };

// ───────────────────────── TO LET ─────────────────────────

const SIGN = { postH: 0.66, armY: 0.6, reach: 0.4, hangX: 0.21, boardW: 0.36, boardH: 0.2 } as const;
let signGeo: { post: THREE.BufferGeometry; board: THREE.BufferGeometry; face: THREE.BufferGeometry } | null = null;
let signFace: THREE.MeshStandardMaterial | null = null;

function signFaceMat(): THREE.MeshStandardMaterial {
  if (signFace) return signFace;
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
  if (typeof document === 'undefined') { m.color.setHex(PAL.parchment); return (signFace = m); }
  const c = document.createElement('canvas'); c.width = 288; c.height = 160;
  const g = c.getContext('2d');
  if (!g) { m.color.setHex(PAL.parchment); return (signFace = m); }
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
  g.fillStyle = hex(PAL.parchment); g.fillRect(0, 0, c.width, c.height);
  // a board that has been out in the weather: darker toward the edges, a few knocks
  const v = g.createRadialGradient(144, 80, 30, 144, 80, 190);
  v.addColorStop(0, 'rgba(120,90,50,0)'); v.addColorStop(1, 'rgba(120,90,50,0.38)');
  g.fillStyle = v; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = 'rgba(90,60,30,0.16)';
  for (const [x, y, w, h] of [[30, 22, 44, 3], [200, 128, 52, 3], [226, 34, 22, 2], [52, 132, 30, 2]] as const) g.fillRect(x, y, w, h);
  g.strokeStyle = hex(PAL.crimson); g.lineWidth = 7; g.strokeRect(11, 11, c.width - 22, c.height - 22);
  g.lineWidth = 2; g.strokeRect(21, 21, c.width - 42, c.height - 42);
  g.fillStyle = hex(PAL.ink); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 84px "IM Fell English SC", "IM Fell English", Georgia, "Times New Roman", serif';
  const text = 'TO LET', tw = g.measureText(text).width, k = Math.min(1, 222 / Math.max(1, tw));
  g.save(); g.translate(144, 84); g.scale(k, 1); g.fillText(text, 0, 0); g.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  m.map = tex;
  return (signFace = m);
}

function signGeos(): NonNullable<typeof signGeo> {
  if (signGeo) return signGeo;
  // the post, with its arm reaching toward +x
  const p = new Sculpt(4041); p.jit = 0.04;
  p.block('s', PAL.timber, 0, 0, 0, 0.05, SIGN.postH, 0.05, { tw: 0.042, td: 0.042, sx: 0.006 });
  p.block('s', PAL.timberLight, 0.006, SIGN.postH, 0, 0.065, 0.02, 0.065, { bottom: true });
  p.beam('s', PAL.timber, [-0.05, SIGN.armY, 0], [SIGN.reach, SIGN.armY + 0.012, 0], 0.036, 0.04);
  p.beam('s', PAL.timberLight, [0.02, SIGN.armY - 0.19, 0], [0.19, SIGN.armY - 0.012, 0], 0.028, 0.03);
  p.blob('s', PAL.rock, 0.03, 0, 0.03, 0.06, 0.035, 0.05, { detail: 0, floor: 0, jit: 0.03 });
  p.blob('s', PAL.stoneDark, -0.04, 0, -0.02, 0.045, 0.03, 0.045, { detail: 0, floor: 0, jit: 0.03 });
  // the board, hanging from y = 0 on two iron links
  const b = new Sculpt(4042); b.jit = 0.03;
  const w = SIGN.boardW, h = SIGN.boardH, top = -0.045;
  b.block('s', PAL.timberLight, 0, top - h, 0, w, h, 0.022, { bottom: true });
  b.block('s', PAL.timber, 0, top - 0.004, 0, w + 0.02, 0.016, 0.03, { bottom: true });
  for (const sx of [-1, 1]) b.beam('s', PAL.iron, [sx * w * 0.36, 0.012, 0], [sx * w * 0.36, top, 0], 0.012, 0.012, 0);
  // both painted faces as one mesh
  const fw = w - 0.03, fh = h - 0.028, cy = top - h / 2, z = 0.0125;
  const pos = [-fw / 2, cy - fh / 2, z, fw / 2, cy - fh / 2, z, fw / 2, cy + fh / 2, z, -fw / 2, cy - fh / 2, z, fw / 2, cy + fh / 2, z, -fw / 2, cy + fh / 2, z,
    fw / 2, cy - fh / 2, -z, -fw / 2, cy - fh / 2, -z, -fw / 2, cy + fh / 2, -z, fw / 2, cy - fh / 2, -z, -fw / 2, cy + fh / 2, -z, fw / 2, cy + fh / 2, -z];
  const uv = [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1];
  const nor = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1];
  const face = new THREE.BufferGeometry();
  face.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  face.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  face.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  signGeo = { post: shared(p.bake('s')!), board: shared(b.bake('s')!), face: shared(face) };
  return signGeo;
}

export interface Shingle { group: THREE.Group; swing: THREE.Group; phase: number }
/**
 * A TO LET shingle on a post beside the door. It stands on whichever side has room and
 * hangs away from the doorway, so nobody walks into it.
 */
export function makeShingle(look: BuildingLook, door: THREE.Vector3, rand: Rng): Shingle {
  const geo = signGeos(), hw = look.w / 2 - 0.03, need = SIGN.hangX + SIGN.boardW / 2 + 0.01;
  let side = rand.sign(), x = 0, dir = 1, placed = false;
  for (let i = 0; i < 2 && !placed; i++, side = -side) {
    x = door.x + side * 0.27; dir = side;
    if (Math.abs(x) <= hw - 0.03 && Math.abs(x + dir * need) <= hw) placed = true;
  }
  if (!placed) {
    // a narrow plot: stand at the edge and hang inward, over the path
    side = door.x > 0 ? -1 : 1;
    x = Math.max(-hw + 0.05, Math.min(hw - 0.05, door.x + side * 0.3)); dir = x + need <= hw ? 1 : -1;
  }
  const z = Math.min(look.h / 2 - 0.07, door.z - 0.04);
  const group = new THREE.Group(); group.name = 'to-let';
  group.position.set(x, 0, z);
  group.rotation.y = (rand() - 0.5) * 0.24;
  const post = new THREE.Mesh(geo.post, paintMat());
  post.scale.x = dir; post.castShadow = true; post.receiveShadow = true;
  const swing = new THREE.Group();
  swing.position.set(dir * SIGN.hangX, SIGN.armY - 0.02, 0);
  const board = new THREE.Mesh(geo.board, paintMat());
  board.castShadow = true; board.receiveShadow = true;
  const face = new THREE.Mesh(geo.face, signFaceMat());
  face.castShadow = false; face.receiveShadow = true;
  swing.add(board, face);
  group.add(post, swing);
  return { group, swing, phase: rand() * 6.28 };
}
/** swing a shingle in the wind. No allocation. */
export function swingShingle(s: Shingle, time: number, wind: number): void {
  const a = 0.05 + wind * 0.42, sp = 1.7 + wind * 2.6;
  s.swing.rotation.x = Math.sin(time * sp + s.phase) * a + Math.sin(time * sp * 2.3 + s.phase * 1.7) * a * 0.18 + wind * 0.1;
  s.swing.rotation.z = Math.sin(time * 1.3 + s.phase * 2.1) * 0.02 * (1 + wind * 2);
}

// ───────────────────────── gargoyles ─────────────────────────

let gargGeo: THREE.BufferGeometry | null = null;
/** one hunched stone grotesque, facing +z, sitting on the origin */
export function gargoyleGeometry(): THREE.BufferGeometry {
  if (gargGeo) return gargGeo;
  const s = new Sculpt(666); s.jit = 0.05;
  const st = PAL.stoneDark, hi = PAL.stone, lo = PAL.rockDark;
  s.block('g', lo, 0, -0.02, 0, 0.13, 0.035, 0.15, { bottom: true });
  s.blob('g', st, 0, 0.06, -0.025, 0.06, 0.055, 0.065, { detail: 1, lump: 0.08, facets: 0.06 });
  s.blob('g', st, 0, 0.115, 0.03, 0.048, 0.055, 0.05, { detail: 1, lump: 0.08, facets: 0.06 });
  s.blob('g', hi, 0, 0.17, 0.085, 0.04, 0.036, 0.046, { detail: 1, lump: 0.06, facets: 0.05 });
  s.block('g', hi, 0, 0.145, 0.125, 0.04, 0.026, 0.045, { bottom: true, tw: 0.026 });
  for (const sg of [-1, 1]) {
    s.cone('g', hi, sg * 0.03, 0.195, 0.07, 0.014, 0.05, 4, { sx: sg * 0.012, sz: -0.012 });
    s.beam('g', st, [sg * 0.035, 0.1, 0.05], [sg * 0.04, 0.015, 0.085], 0.024, 0.024);
    s.block('g', lo, sg * 0.04, 0.015, 0.095, 0.03, 0.014, 0.04, { bottom: true });
    // wings, half furled
    const a: [number, number, number] = [sg * 0.035, 0.135, -0.01], b: [number, number, number] = [sg * 0.15, 0.23, -0.09], c: [number, number, number] = [sg * 0.07, 0.06, -0.11], d: [number, number, number] = [sg * 0.12, 0.11, -0.13];
    s.tri('g', st, a, b, c); s.tri('g', st, a, c, b); s.tri('g', lo, b, d, c); s.tri('g', lo, b, c, d);
  }
  s.cone('g', lo, 0, 0.03, -0.085, 0.016, 0.07, 4, { sz: -0.05 });
  gargGeo = shared(s.bake('g')!);
  return gargGeo;
}

const DIRS: readonly (readonly [number, number])[] = [[1, 0.25], [-1, 0.25], [0, -1], [0, 1]];
/**
 * Where gargoyles perch: the high corners of the roof (ridge ends, for preference), each
 * looking outward. Falls back to the wall tops when there is no roof to sit on.
 */
export function gargoylePerches(body: BuiltBody, b: Bounds): { p: THREE.Vector3; yaw: number }[] {
  const soup = soupOf(body.roofs.filter(m => m.visible), body.group, 0.2), T = soup.tris, out: { p: THREE.Vector3; yaw: number }[] = [];
  if (T.length) {
    for (const [dx, dz] of DIRS) {
      let best = -Infinity, bi = -1;
      for (let i = 0; i < T.length; i += 3) { const sc = T[i + 1] * 1.25 + T[i] * dx + T[i + 2] * dz; if (sc > best) { best = sc; bi = i; } }
      if (bi < 0) continue;
      const p = new THREE.Vector3(T[bi], T[bi + 1], T[bi + 2]);
      if (out.some(o => o.p.distanceTo(p) < 0.4)) continue;
      // sit just inboard of the very tip, so it is on the roof and not on the air beside it
      p.x -= dx * 0.07; p.z -= dz * 0.07;
      out.push({ p, yaw: Math.atan2(dx, dz) });
      if (out.length === 2) break;
    }
  }
  if (!out.length) {
    out.push({ p: new THREE.Vector3(b.maxX - 0.06, b.maxY, b.maxZ - 0.06), yaw: 0.6 });
    out.push({ p: new THREE.Vector3(b.minX + 0.06, b.maxY, b.maxZ - 0.06), yaw: -0.6 });
  }
  return out;
}

// ───────────────────────── hearth-right ─────────────────────────

let hearthGeo: THREE.BufferGeometry | null = null;
const HEARTH_H = 0.92, HEARTH_ARM = 0.36;
function hearthPole(): THREE.BufferGeometry {
  if (hearthGeo) return hearthGeo;
  const s = new Sculpt(1401); s.jit = 0.05;
  // a stick that was the straightest one available
  s.beam('h', PAL.timberLight, [0, 0, 0], [0.025, HEARTH_H * 0.5, -0.01], 0.03, 0.03);
  s.beam('h', PAL.timberLight, [0.025, HEARTH_H * 0.5, -0.01], [0, HEARTH_H, 0.005], 0.026, 0.026);
  s.beam('h', PAL.timber, [-0.03, HEARTH_H - 0.05, 0], [HEARTH_ARM, HEARTH_H - 0.03, 0], 0.022, 0.022);
  // the committee's stamp, mounted where a finial would go
  s.cyl('h', PAL.timber, 0, HEARTH_H, 0.005, 0.014, 0.014, 0.04, 5);
  s.cyl('h', PAL.crimson, 0, HEARTH_H + 0.04, 0.005, 0.034, 0.03, 0.028, 6, { jit: 0.02 });
  for (const [x, z] of [[0.04, 0.03], [-0.035, 0.02], [0.0, -0.045]] as const) s.blob('h', PAL.rock, x, 0, z, 0.04, 0.03, 0.04, { detail: 0, floor: 0 });
  hearthGeo = shared(s.bake('h')!);
  return hearthGeo;
}
export interface HearthBanner { group: THREE.Group; cloth: THREE.Mesh; phase: number }
/** A small goblin banner planted by the door: the household has hearth-right and wants it known. */
export function makeHearthBanner(look: BuildingLook, door: THREE.Vector3, avoidX: number | null, rand: Rng): HearthBanner {
  const hw = look.w / 2 - 0.06;
  let side = avoidX !== null ? (avoidX > door.x ? -1 : 1) : rand.sign();
  let x = door.x + side * 0.34;
  if (Math.abs(x) > hw) { side = -side; x = door.x + side * 0.34; }
  x = Math.max(-hw, Math.min(hw, x));
  const group = new THREE.Group(); group.name = 'hearth-right';
  group.position.set(x, 0, Math.min(look.h / 2 - 0.07, door.z + 0.02));
  group.rotation.y = (rand() - 0.5) * 0.5;
  group.rotation.z = (rand() - 0.5) * 0.12;
  const pole = new THREE.Mesh(hearthPole(), paintMat());
  pole.castShadow = true; pole.receiveShadow = true;
  // it hangs from the cross-stick like a proclamation
  const cloth = makeCloth(0.4, 0.3, PAL.goblinDark, { device: PAL.parchment, swallow: true, segs: 5 });
  cloth.rotation.z = -Math.PI / 2;
  cloth.position.set(HEARTH_ARM - 0.01, HEARTH_H - 0.05, 0.014);
  group.add(pole, cloth);
  return { group, cloth, phase: rand() * 6.28 };
}

// ───────────────────────── snow drifts ─────────────────────────

export interface DriftHint { x: number; z: number; nx: number; nz: number; len: number }

/**
 * Drifts against the foot of the walls, as collapsed wedges that the snow material pushes out:
 * `pos` holds where each vertex lies with no snow, `push` how far it moves at full snow.
 * A body may say where its own drifts go (`group.userData.drifts`); an empty list means none.
 */
export function driftShell(look: BuildingLook, b: Bounds, door: THREE.Vector3, hints: DriftHint[] | undefined, rand: Rng, pos: number[], push: number[]): void {
  const hw = look.w / 2 - 0.03, hh = look.h / 2 - 0.03;
  const runs: { x: number; z: number; nx: number; nz: number; len: number; room: number }[] = [];
  if (hints) for (const h of hints) runs.push({ ...h, room: 0.2 });
  else {
    const gap = 0.24;
    // front, split round the doorstep
    const fz = b.maxZ, room = hh - fz;
    const a0 = b.minX, a1 = Math.min(b.maxX, door.x - gap), c0 = Math.max(b.minX, door.x + gap), c1 = b.maxX;
    if (Math.abs(door.z - fz) > 0.6) runs.push({ x: (b.minX + b.maxX) / 2, z: fz, nx: 0, nz: 1, len: b.maxX - b.minX, room });
    else {
      if (a1 - a0 > 0.2) runs.push({ x: (a0 + a1) / 2, z: fz, nx: 0, nz: 1, len: a1 - a0, room });
      if (c1 - c0 > 0.2) runs.push({ x: (c0 + c1) / 2, z: fz, nx: 0, nz: 1, len: c1 - c0, room });
    }
    runs.push({ x: (b.minX + b.maxX) / 2, z: b.minZ, nx: 0, nz: -1, len: b.maxX - b.minX, room: hh + b.minZ });
    runs.push({ x: b.maxX, z: (b.minZ + b.maxZ) / 2, nx: 1, nz: 0, len: b.maxZ - b.minZ, room: hw - b.maxX });
    runs.push({ x: b.minX, z: (b.minZ + b.maxZ) / 2, nx: -1, nz: 0, len: b.maxZ - b.minZ, room: hw + b.minX });
  }
  for (const run of runs) {
    const depth = Math.min(0.2, run.room) * rand.range(0.75, 1), high = rand.range(0.1, 0.17);
    if (depth < 0.05 || run.len < 0.15) continue;
    const tx = -run.nz, tz = run.nx, n = Math.max(3, Math.round(run.len / 0.16));
    // profile along the wall: nothing at the ends, heaped unevenly between
    const f: number[] = [];
    for (let i = 0; i <= n; i++) f.push(i === 0 || i === n ? 0 : Math.pow(Math.sin((Math.PI * i) / n), 0.55) * rand.range(0.62, 1.08));
    for (let i = 0; i < n; i++) {
      const u0 = (i / n - 0.5) * run.len, u1 = ((i + 1) / n - 0.5) * run.len;
      const x0 = run.x + tx * u0, z0 = run.z + tz * u0, x1 = run.x + tx * u1, z1 = run.z + tz * u1, y = 0.004;
      // four moving corners: up the wall (t) and out along the ground (g), at each end
      const t0: [number, number, number] = [run.nx * 0.012, high * f[i], run.nz * 0.012], t1: [number, number, number] = [run.nx * 0.012, high * f[i + 1], run.nz * 0.012];
      const g0: [number, number, number] = [run.nx * depth * f[i], 0.006, run.nz * depth * f[i]], g1: [number, number, number] = [run.nx * depth * f[i + 1], 0.006, run.nz * depth * f[i + 1]];
      // faces up and out; winding depends on which way the wall runs
      const quad = (pa: [number, number, number], qa: [number, number, number], pb: [number, number, number], qb: [number, number, number], pc: [number, number, number], qc: [number, number, number]) => {
        pos.push(pa[0], pa[1], pa[2], pb[0], pb[1], pb[2], pc[0], pc[1], pc[2]);
        push.push(qa[0], qa[1], qa[2], qb[0], qb[1], qb[2], qc[0], qc[1], qc[2]);
      };
      const P0: [number, number, number] = [x0, y, z0], P1: [number, number, number] = [x1, y, z1];
      // (t0, g1, g0) and (t0, t1, g1): counter-clockwise seen from outside for tangent = (-nz, nx)
      quad(P0, t0, P1, g1, P0, g0);
      quad(P0, t0, P1, t1, P1, g1);
    }
  }
}
