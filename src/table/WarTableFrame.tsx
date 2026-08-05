/**
 * The War Table — the proving frame (WRIT-THE-WAR-TABLE §11).
 *
 * The table. One warm key light. The Northreach relief with vertical
 * exaggeration. Roughly two hundred pieces placed across the real ground.
 * The clock. Tilt-shift depth of field.
 *
 * No panels. No cards. No chrome. No rail.
 *
 * This is a standalone preview, judged before anything is wired into the
 * app. Fixed camera; the darkness beyond the lamplight is content, not
 * absence (§2 — shadow is free).
 */

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RIVER_COURSES, snappedCourse, type Relief } from './relief';
import type { ParcelSource, DoorPiece } from './parcels';
import { buildPieceAtlas, softDisc, CELL_W, CELL_H, type CellName, type PieceAtlas } from './sprites';
import { woodTexture, feltTexture, paperTexture, dialTexture, lampEnvironment } from './textures';
import { paintTerrainTexture } from './terrainPaint';
import { T, NAMED, INK, mix, lighten, darken, desaturate } from './palette';
import { TiltShift } from './TiltShift';

// ── The table's dimensions (one place, so the frame stays composable) ─────

/** Relief block footprint: Northreach is ~61 km wide, ~66 km tall. */
const RELIEF_W = 40;
const RELIEF_D = 43.5;
/** Vertical exaggeration — the writ allows 2x–5x; the escarpment earns the
 *  top of the range. */
const EXAG = 5;
const UNITS_PER_M = RELIEF_W / 61070;
const FELT_TOP = 0.12;
const PLINTH_TOP = 1.02;
const RELIEF_BASE = PLINTH_TOP + 0.06;

/** Pushed IN so the relief commands the frame (§1.1 — the reviewer measured
 *  the model at half the pixels; reference sims spend ~90% on world). The
 *  wood survives only as a rim at the frame's edge, enough to hold the
 *  fiction of a table. */
const CAM_POS = new THREE.Vector3(3.8, 31.5, 36);
const CAM_TARGET = new THREE.Vector3(1.8, 1.2, -2.2);
/** LOW and from the west, like a lamp at the table's edge: the raking angle
 *  is what carves the escarpment out of the relief and throws the pieces'
 *  long shadows east. */
const KEY_POS = new THREE.Vector3(-40, 27, 8);

function uvToWorld(u: number, v: number): [number, number] {
  return [(u - 0.5) * RELIEF_W, (v - 0.5) * RELIEF_D];
}

function terrainY(relief: Relief, u: number, v: number): number {
  return RELIEF_BASE + (relief.sample(u, v) - relief.minElev) * UNITS_PER_M * EXAG;
}

// Deterministic stream (cosmetic scatter only)
function stream(seed: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let s = h >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 16), 0x21f0aaad);
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
    return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
  };
}

// ── The relief block ──────────────────────────────────────────────────────

function useReliefGeometry(relief: Relief, res = 240): THREE.BufferGeometry {
  return useMemo(() => {
    const verts = (res + 1) * (res + 1);
    const pos = new Float32Array(verts * 3);
    const uv = new Float32Array(verts * 2);
    const idx = new Uint32Array(res * res * 6);
    let p = 0;
    let q = 0;
    for (let iy = 0; iy <= res; iy++) {
      const v = iy / res;
      for (let ix = 0; ix <= res; ix++) {
        const u = ix / res;
        const [x, z] = uvToWorld(u, v);
        pos[p] = x;
        pos[p + 1] = terrainY(relief, u, v);
        pos[p + 2] = z;
        p += 3;
        uv[q] = u;
        uv[q + 1] = 1 - v;
        q += 2;
      }
    }
    let t = 0;
    for (let iy = 0; iy < res; iy++) {
      for (let ix = 0; ix < res; ix++) {
        const a = iy * (res + 1) + ix;
        const b = a + 1;
        const c = a + res + 1;
        const d = c + 1;
        idx[t++] = a; idx[t++] = c; idx[t++] = b;
        idx[t++] = b; idx[t++] = c; idx[t++] = d;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    return g;
  }, [relief, res]);
}

/** The cut plaster edge of the model — terrain rim down to the plinth.
 *  res MUST match the relief geometry's, so the two meshes share every
 *  boundary vertex — a coarser skirt left a stippled crack of bright wood
 *  along the model's far silhouette. */
function useSkirtGeometry(relief: Relief, res = 240): THREE.BufferGeometry {
  return useMemo(() => {
    const pos: number[] = [];
    const idx: number[] = [];
    const edge = (uOf: (t: number) => number, vOf: (t: number) => number) => {
      const base = pos.length / 3;
      for (let i = 0; i <= res; i++) {
        const t = i / res;
        const u = uOf(t);
        const v = vOf(t);
        const [x, z] = uvToWorld(u, v);
        const y = terrainY(relief, u, v);
        pos.push(x, y, z, x, PLINTH_TOP - 0.04, z);
      }
      for (let i = 0; i < res; i++) {
        const a = base + i * 2;
        idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
      }
    };
    edge((t) => t, () => 0); // north
    edge((t) => 1 - t, () => 1); // south
    edge(() => 0, (t) => 1 - t); // west
    edge(() => 1, (t) => t); // east
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [relief, res]);
}

function ReliefBlock({ relief }: { relief: Relief }) {
  const geom = useReliefGeometry(relief);
  const skirt = useSkirtGeometry(relief);
  const tex = useMemo(() => paintTerrainTexture(relief), [relief]);
  const plaster = useMemo(() => desaturate(mix(T.paper, T.felt, 0.18), 0.12), []);
  return (
    <group>
      {/* envMapIntensity held LOW on the matte surfaces: image-based light
          ignores occlusion, and at full strength it was quietly refilling
          every cast shadow the key threw */}
      <mesh geometry={geom} castShadow receiveShadow>
        <meshStandardMaterial map={tex} roughness={0.94} metalness={0} envMapIntensity={0.15} />
      </mesh>
      <mesh geometry={skirt} castShadow receiveShadow>
        <meshStandardMaterial color={plaster} roughness={0.95} side={THREE.DoubleSide} envMapIntensity={0.3} />
      </mesh>
      {/* The walnut plinth the model is bedded on */}
      <mesh position={[0, (FELT_TOP + PLINTH_TOP) / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[RELIEF_W + 1.4, PLINTH_TOP - FELT_TOP, RELIEF_D + 1.4]} />
        <meshStandardMaterial color={T.fascia} roughness={0.62} envMapIntensity={0.4} />
      </mesh>
      {/* Brass tacks at the plinth corners — the maker's touch */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx * (RELIEF_W / 2 + 0.55), PLINTH_TOP + 0.02, sz * (RELIEF_D / 2 + 0.55)]}>
          <sphereGeometry args={[0.16, 12, 8]} />
          <meshStandardMaterial color={NAMED.brass} metalness={0.85} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

// ── The room, the table, the cloth ────────────────────────────────────────

function Table() {
  const wood = useMemo(() => {
    const t = woodTexture();
    t.repeat.set(1.7, 1.1);
    return t;
  }, []);
  const felt = useMemo(() => {
    const t = feltTexture();
    t.repeat.set(6, 6);
    return t;
  }, []);
  return (
    <group>
      {/* Waxed walnut: physical material with grain-aligned anisotropy, so
          the one lamp throws a long sheen band down the boards instead of
          the flat matte that read as painted backdrop */}
      <mesh position={[0, -2.05, -4]} receiveShadow>
        <boxGeometry args={[240, 4, 130]} />
        <meshPhysicalMaterial map={wood} roughness={0.36} metalness={0} anisotropy={0.85} envMapIntensity={0.35} />
      </mesh>
      {/* The felt the model rests on */}
      <mesh position={[0, FELT_TOP / 2, 0]} receiveShadow>
        <boxGeometry args={[RELIEF_W + 2.6, FELT_TOP, RELIEF_D + 2.6]} />
        <meshStandardMaterial map={felt} roughness={1} metalness={0} envMapIntensity={0.2} />
      </mesh>
    </group>
  );
}

// ── The water ─────────────────────────────────────────────────────────────

/**
 * The rivers as REAL water, not paint: glossy ribbons draped on the true
 * valleys, a hand's width above the painted channel bed so the dark bank
 * reads as a lip. At miniature scale it is the GLINT that says water —
 * resin poured into the model's carved channels — so the material is near
 * roughness 0, and the lamp environment gives it something to catch.
 */
function Rivers({ relief }: { relief: Relief }) {
  const geom = useMemo(() => {
    const pos: number[] = [];
    const nrm: number[] = [];
    const idx: number[] = [];
    RIVER_COURSES.forEach((course, ci) => {
      const pts = snappedCourse(relief, course.pts, 120);
      const base = pos.length / 3;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const q = pts[Math.min(pts.length - 1, i + 1)];
        const o = pts[Math.max(0, i - 1)];
        let du = q.u - o.u;
        let dv = q.v - o.v;
        const len = Math.hypot(du, dv) || 1;
        du /= len;
        dv /= len;
        // half-width in world units, swelling downstream — and BREATHING
        // along the course (pools and riffles), because a constant-gauge
        // ribbon is what a road is
        const breathe = 0.8 + 0.45 * (0.5 + 0.5 * Math.sin(i * 0.31 + ci * 1.3));
        const half = (0.13 + (i / pts.length) * 0.16) * breathe;
        const su = (-dv * half) / RELIEF_W;
        const sv = (du * half) / RELIEF_D;
        // Water self-levels, so the normal is UP — but not perfectly: a
        // slow deterministic wobble along the course tips each stretch in
        // and out of the lamp's mirror, so the glint breaks into ripples
        // of light instead of one flat pale band that reads as a road.
        const t1 = Math.sin(i * 0.53 + ci * 1.7) * 0.05 + Math.sin(i * 0.17 + ci * 3.3) * 0.045;
        const t2 = Math.cos(i * 0.41 + ci * 2.2) * 0.05;
        const nx = du * t1 - dv * t2;
        const nz = dv * t1 + du * t2;
        const nl = Math.hypot(nx, 1, nz);
        for (const side of [-1, 1]) {
          const uu = p.u + su * side;
          const vv = p.v + sv * side;
          const [x, z] = uvToWorld(uu, vv);
          pos.push(x, terrainY(relief, uu, vv) + 0.055, z);
          nrm.push(nx / nl, 1 / nl, nz / nl);
        }
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const a = base + i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nrm), 3));
    g.setIndex(idx);
    return g;
  }, [relief]);
  return (
    <mesh geometry={geom} receiveShadow>
      {/* COOL slate-blue, the one genuinely cool material in a tungsten
          frame — value alone read as "road in shadow"; hue is what says
          water from across the room */}
      <meshPhysicalMaterial
        color={mix(NAMED.night, '#7d95bd', 0.55)}
        roughness={0.12}
        metalness={0}
        clearcoat={0.35}
        clearcoatRoughness={0.12}
        envMapIntensity={1.4}
        polygonOffset
        polygonOffsetFactor={-2}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ── The pieces ────────────────────────────────────────────────────────────

interface Placed {
  x: number;
  y: number;
  z: number;
  lean: number;
  size: number;
  tint: THREE.Color;
  /** Mirror the sprite (trees only — one casting, many trees). */
  flip?: boolean;
}

/** World height of each piece type (miniature scale, not map scale). */
const PIECE_H: Record<CellName, number> = {
  cottageHeld: 1.35, houseHeld: 1.62, wideHeld: 1.35, cottageVacant: 1.35,
  houseVacant: 1.62, cottageBare: 1.35, houseBare: 1.62, crisis: 2.05,
  fallen: 1.35, treeOak: 1.45, treeCedar: 1.7, banner: 2.7,
};

function cellOf(d: DoorPiece): CellName {
  if (d.state === 'fallen') return 'fallen';
  if (d.state === 'crisis') return 'crisis';
  if (d.state === 'bare') return d.kind === 'house' ? 'houseBare' : 'cottageBare';
  if (d.state === 'vacant') return d.kind === 'house' ? 'houseVacant' : 'cottageVacant';
  return d.kind === 'cottage' ? 'cottageHeld' : d.kind === 'house' ? 'houseHeld' : 'wideHeld';
}

function pieceGeometry(atlas: PieceAtlas, name: CellName): THREE.PlaneGeometry {
  const h = PIECE_H[name];
  const w = h * (CELL_W / CELL_H);
  const g = new THREE.PlaneGeometry(w, h);
  g.translate(0, h / 2, 0);
  const { u0, v0, u1, v1 } = atlas.uv(name);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  }
  uv.needsUpdate = true;
  return g;
}

function InstancedPieces({
  atlas,
  name,
  placed,
}: {
  atlas: PieceAtlas;
  name: CellName;
  placed: Placed[];
}) {
  const mesh = useMemo(() => {
    const geom = pieceGeometry(atlas, name);
    const mat = new THREE.MeshLambertMaterial({
      map: atlas.texture,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
    const m = new THREE.InstancedMesh(geom, mat, placed.length);
    const mat4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const qLean = new THREE.Quaternion();
    const s = new THREE.Vector3();
    for (let i = 0; i < placed.length; i++) {
      const p = placed[i];
      const yaw = Math.atan2(CAM_POS.x - p.x, CAM_POS.z - p.z);
      q.setFromEuler(new THREE.Euler(0, yaw, 0));
      qLean.setFromEuler(new THREE.Euler(0, 0, p.lean));
      q.multiply(qLean);
      s.set(p.flip ? -p.size : p.size, p.size, p.size);
      mat4.compose(new THREE.Vector3(p.x, p.y, p.z), q, s);
      m.setMatrixAt(i, mat4);
      m.setColorAt(i, p.tint);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.castShadow = true;
    m.customDepthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: atlas.texture,
      alphaTest: 0.5,
    });
    return m;
  }, [atlas, name, placed]);
  return <primitive object={mesh} />;
}

/** Soft contact shadows under every piece — what seats them on the ground. */
function BlobShadows({ spots }: { spots: { x: number; y: number; z: number; r: number }[] }) {
  const mesh = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.InstancedMesh(
      g,
      new THREE.MeshBasicMaterial({
        map: softDisc(),
        color: INK,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
      spots.length,
    );
    const mat4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < spots.length; i++) {
      const sp = spots[i];
      mat4.compose(
        new THREE.Vector3(sp.x + sp.r * 0.22, sp.y + 0.02, sp.z + sp.r * 0.06),
        q,
        new THREE.Vector3(sp.r * 1.5, 1, sp.r * 0.95),
      );
      m.setMatrixAt(i, mat4);
    }
    m.instanceMatrix.needsUpdate = true;
    m.renderOrder = 2;
    return m;
  }, [spots]);
  return <primitive object={mesh} />;
}

function Pieces({ relief, source, atlas }: { relief: Relief; source: ParcelSource; atlas: PieceAtlas }) {
  const { groups, shadows } = useMemo(() => {
    const groups = new Map<CellName, Placed[]>();
    const shadows: { x: number; y: number; z: number; r: number }[] = [];
    const add = (name: CellName, p: Placed, shadowR: number) => {
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name)!.push(p);
      shadows.push({ x: p.x, y: p.y, z: p.z, r: shadowR * p.size });
    };

    for (const d of source.doors()) {
      const { u, v } = relief.toUV(d.x, d.y);
      if (u < 0.015 || u > 0.985 || v < 0.015 || v > 0.985) continue;
      const [x, z] = uvToWorld(u, v);
      const y = terrainY(relief, u, v);
      // paint-tone jitter: a batch of hand-painted castings, no two alike
      const tint = new THREE.Color(1, 1, 1);
      tint.offsetHSL((d.tone - 0.5) * 0.05, 0, -0.02 - d.tone * 0.06);
      add(cellOf(d), { x, y, z, lean: d.lean, size: d.size, tint }, d.state === 'fallen' ? 0.9 : 0.62);
    }
    for (const k of source.knights()) {
      const { u, v } = relief.toUV(k.x, k.y);
      const [x, z] = uvToWorld(u, v);
      const y = terrainY(relief, u, v);
      add('banner', { x, y, z, lean: k.lean, size: 1, tint: new THREE.Color(1, 1, 1) }, 0.5);
    }

    // The woods — cedar brakes on the escarpment, oaks down the river runs
    const courses = riverPointsUV(relief);
    const doorsUV = source.doors().map((d) => relief.toUV(d.x, d.y));
    const r = stream('the-woods');
    let placedTrees = 0;
    let guard = 0;
    while (placedTrees < 165 && guard++ < 7000) {
      const u = 0.02 + r() * 0.96;
      const v = 0.02 + r() * 0.96;
      const e01 = (relief.sample(u, v) - relief.minElev) / (relief.maxElev - relief.minElev);
      let name: CellName | null = null;
      if (e01 > 0.58 && r() < 0.75) name = 'treeCedar';
      else {
        let dMin = 1;
        for (const c of courses) {
          const dd = Math.hypot(c.u - u, c.v - v);
          if (dd < dMin) dMin = dd;
        }
        if (dMin < 0.016 && e01 < 0.45) name = 'treeOak';
        // sparse mesquite scattered over the open south plain, so the
        // lowlands are ground with things on it, not a green void
        else if (e01 < 0.5 && r() < 0.08) name = 'treeOak';
      }
      if (!name) continue;
      let clear = true;
      for (const duv of doorsUV) {
        if (Math.hypot(duv.u - u, duv.v - v) < 0.012) {
          clear = false;
          break;
        }
      }
      if (!clear) continue;
      const [x, z] = uvToWorld(u, v);
      const y = terrainY(relief, u, v);
      // Wide hue jitter and a coin-flip mirror: one casting, MANY trees —
      // without this a wood read as the same tree stamped out.
      const tint = new THREE.Color(1, 1, 1);
      tint.offsetHSL((r() - 0.5) * 0.05, (r() - 0.5) * 0.06, -r() * 0.1);
      add(name, { x, y, z, lean: (r() - 0.5) * 0.1, size: 0.72 + r() * 0.5, tint, flip: r() < 0.5 }, 0.42);
      placedTrees++;
    }

    return { groups, shadows };
  }, [relief, source, atlas]);

  return (
    <group>
      {[...groups.entries()].map(([name, placed]) => (
        <InstancedPieces key={name} atlas={atlas} name={name} placed={placed} />
      ))}
      <BlobShadows spots={shadows} />
    </group>
  );
}

// One flattened list of river uv samples (module-level cache per relief).
const riverCache = new WeakMap<Relief, { u: number; v: number }[]>();
function riverPointsUV(relief: Relief): { u: number; v: number }[] {
  const hit = riverCache.get(relief);
  if (hit) return hit;
  const pts = RIVER_COURSES.flatMap((c) => snappedCourse(relief, c.pts, 60));
  riverCache.set(relief, pts);
  return pts;
}

// ── The clock — the signature element ─────────────────────────────────────

const DIAL_R = 2.9;

function WeekDial({ week }: { week: number }) {
  const dial = useMemo(() => dialTexture(week), [week]);
  return (
    <group position={[24.6, 0, 9]}>
      {/* the dark recess the dial is let into — separates the brass from
          the lit wood around it */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.01}>
        <circleGeometry args={[DIAL_R + 1.05, 64]} />
        <meshStandardMaterial color={darken(T.wood, 0.09)} roughness={0.85} />
      </mesh>
      {/* the recessed face — REAL metal, so the lamp blows one highlight
          across it and the far side goes dark reflecting the black room */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.045}>
        <circleGeometry args={[DIAL_R, 64]} />
        <meshStandardMaterial map={dial} metalness={0.85} roughness={0.32} envMapIntensity={1.4} />
      </mesh>
      {/* the bezel ring, proud of the table */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.16}>
        <ringGeometry args={[DIAL_R, DIAL_R + 0.5, 64]} />
        <meshStandardMaterial color={NAMED.brass} metalness={1} roughness={0.22} envMapIntensity={1.5} />
      </mesh>
      <mesh position-y={0.08}>
        <cylinderGeometry args={[DIAL_R + 0.5, DIAL_R + 0.5, 0.16, 64, 1, true]} />
        <meshStandardMaterial color={T.brassDeep} metalness={0.85} roughness={0.35} />
      </mesh>
      <mesh position-y={0.1}>
        <cylinderGeometry args={[DIAL_R + 0.02, DIAL_R + 0.02, 0.12, 64, 1, true]} />
        <meshStandardMaterial color={darken(T.brassDeep, 0.12)} metalness={0.8} roughness={0.4} side={THREE.BackSide} />
      </mesh>
      {/* the boss */}
      <mesh position-y={0.09}>
        <sphereGeometry args={[0.3, 20, 12]} />
        <meshStandardMaterial color={lighten(NAMED.brass, 0.06)} metalness={1} roughness={0.18} envMapIntensity={1.5} />
      </mesh>
      {/* the winding key at the rim — the hand that advances the week */}
      <group position={[DIAL_R + 1.15, 0.14, 1.1]} rotation-y={0.5}>
        <mesh rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.09, 0.09, 0.9, 10]} />
          <meshStandardMaterial color={T.brassDeep} metalness={0.85} roughness={0.35} />
        </mesh>
        <mesh position={[0.45, 0, 0]}>
          <boxGeometry args={[0.14, 0.16, 0.85]} />
          <meshStandardMaterial color={NAMED.brass} metalness={0.85} roughness={0.3} />
        </mesh>
        <mesh position={[-0.5, 0, 0]}>
          <sphereGeometry args={[0.13, 12, 8]} />
          <meshStandardMaterial color={NAMED.brass} metalness={0.85} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

// ── Paper and instruments (the quiet objects; §10.5 — copy on paper) ──────

function SurveyScrap() {
  const tex = useMemo(
    () => paperTexture(['The Shire of NORTHREACH', 'two hundred and three doors', 'surveyed  ·  Year I']),
    [],
  );
  return (
    <group position={[-23.8, 0, 5]} rotation-y={0.55}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.03} receiveShadow>
        <planeGeometry args={[4.8, 3]} />
        <meshStandardMaterial map={tex} roughness={0.9} />
      </mesh>
    </group>
  );
}

function Dividers() {
  return (
    <group position={[-22.8, 0.08, 10]} rotation-y={-0.7}>
      <mesh position={[0, 0, 2.1]} rotation-y={0.14} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.05, 0.02, 4.2, 8]} />
        <meshStandardMaterial color={T.brassDeep} metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh position={[0.55, 0, 2.08]} rotation-y={-0.14} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.05, 0.02, 4.2, 8]} />
        <meshStandardMaterial color={T.brassDeep} metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh position={[0.28, 0.04, 0.05]}>
        <sphereGeometry args={[0.16, 12, 8]} />
        <meshStandardMaterial color={NAMED.brass} metalness={0.9} roughness={0.25} />
      </mesh>
    </group>
  );
}

// ── The air in the lamplight ──────────────────────────────────────────────

function DustMotes() {
  const count = 80;
  const ref = useRef<THREE.Points>(null);
  const seeds = useMemo(() => {
    const r = stream('dust');
    return Array.from({ length: count }, () => ({
      t: 0.3 + r() * 0.65,
      a: r() * Math.PI * 2,
      rad: r(),
      phase: r() * Math.PI * 2,
      speed: 0.25 + r() * 0.5,
    }));
  }, []);
  const { geom, tex } = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    return { geom, tex: softDisc() };
  }, []);
  useFrame(({ clock }) => {
    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    const time = clock.getElapsedTime();
    const dir = new THREE.Vector3().subVectors(CAM_TARGET, KEY_POS);
    for (let i = 0; i < count; i++) {
      const s = seeds[i];
      const drift = (time * 0.012 * s.speed + s.t) % 1;
      const along = new THREE.Vector3().copy(KEY_POS).addScaledVector(dir, 0.25 + drift * 0.72);
      const rad = (2 + drift * 7) * s.rad;
      const a = s.a + time * 0.05 * s.speed;
      pos.setXYZ(
        i,
        along.x + Math.cos(a) * rad,
        along.y + Math.sin(s.phase + time * 0.11) * 1.2,
        along.z + Math.sin(a) * rad * 0.7,
      );
    }
    pos.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial
        map={tex}
        color={T.candle}
        size={0.22}
        transparent
        opacity={0.16}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

// ── Frame timing (read by the harness; window.__ft) ───────────────────────

function FrameStats() {
  const ema = useRef(0);
  // Priority 0, NOT positive: a positive priority tells the fiber someone
  // else owns rendering, and with the tilt-shift off nobody would render —
  // the frame went black once this way.
  useFrame((_, delta) => {
    ema.current = ema.current === 0 ? delta : ema.current * 0.95 + delta * 0.05;
    (window as unknown as Record<string, number>).__ft = ema.current * 1000;
  });
  return null;
}

// ── The frame ─────────────────────────────────────────────────────────────

export interface WarTableFrameProps {
  relief: Relief;
  source: ParcelSource;
  /** The living week the dial stands at. */
  week?: number;
  /** Depth of field on by default; the harness may switch it off to measure. */
  dof?: boolean;
}

export function WarTableFrame({ relief, source, week = 31, dof = true }: WarTableFrameProps) {
  const atlas = useMemo(() => buildPieceAtlas(), []);
  // The key aims a little EAST of centre so the great clusters stand in the
  // light while the west edge falls away — the pieces are the content.
  const keyTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(2, 0, -4);
    return o;
  }, []);
  return (
    <div style={{ position: 'fixed', inset: 0, background: T.room }}>
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ position: CAM_POS.toArray(), fov: 37, near: 1, far: 400 }}
        onCreated={({ gl, camera, scene }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.08;
          camera.lookAt(CAM_TARGET);
          scene.background = new THREE.Color(T.room);
          // the one-lamp room, as a reflection map — what everything shiny sees
          scene.environment = lampEnvironment(gl);
        }}
      >
        {/* ONE warm key, and fills held DOWN at true fill level: a cast
            shadow must be several times darker than the ground beside it,
            and it must fill COOL — the warm-key/cool-shadow separation is
            where tungsten light comes from (§3.4). The first pass ran the
            fills so hot every shadow was a grey smear. */}
        <primitive object={keyTarget} />
        <spotLight
          position={KEY_POS.toArray()}
          target={keyTarget}
          angle={1.08}
          penumbra={0.9}
          intensity={19000}
          decay={1.55}
          color={T.candle}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.0002}
          shadow-normalBias={0.04}
          shadow-camera-near={12}
          shadow-camera-far={140}
        />
        <ambientLight intensity={0.12} color={mix(NAMED.night, '#7f93b8', 0.35)} />
        <directionalLight position={[18, 14, -38]} intensity={1.0} color={mix(NAMED.night, '#8fa3c8', 0.7)} />
        {/* warm fill from behind the viewer, held LOW: the pieces' painted
            faces can NEVER see the key (their billboards face the camera),
            so this is the light that keeps two hundred castings legible.
            Its low angle is deliberate — it face-lights every vertical
            piece at near-full strength while only GRAZING the ground, so
            the key's cast shadows stay deep instead of refilling. */}
        <directionalLight position={[10, 9, 62]} intensity={1.9} color={mix(T.candle, '#ffffff', 0.25)} />
        {/* the lamp's bounce off the far wall — dim on everything matte,
            but it stands exactly where flat water mirrors the camera, so
            the rivers GLINT (at this scale the glint is what says water) */}
        <directionalLight position={[-5, 47, -44]} intensity={0.32} color={T.candle} />
        {/* a small warm accent so the brass clock keeps a glint of its own */}
        <pointLight position={[25, 4.5, 8]} intensity={6} decay={2} color={T.candle} />

        <Table />
        <ReliefBlock relief={relief} />
        <Rivers relief={relief} />
        <Pieces relief={relief} source={source} atlas={atlas} />
        <WeekDial week={week} />
        <SurveyScrap />
        <Dividers />
        <DustMotes />
        {dof && <TiltShift />}
        <FrameStats />
      </Canvas>
    </div>
  );
}

export default WarTableFrame;
