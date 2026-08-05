/**
 * The towns' houses — one InstancedMesh per state so the whole realm's ~200
 * buildings draw in a handful of calls (the writ's leash 5).
 *
 * STATE reads at a glance:
 *   held   → alive, warm-lit windows, a wisp of chimney smoke
 *   vacant → shuttered, dark, boarded, grey
 *   crisis → visibly in trouble: a plume of dark smoke, a lick of flame
 * KIND varies the form: the manor (the knight's keep), cottage, chapel,
 * market, well.
 *
 * The keep is NOT instanced — it is the town's anchor and flies the banner —
 * it lives in Town.tsx. This file is the common housing stock.
 */

import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { SceneBuilding, SceneFief } from './scene';
import { buildingLocal, hash1, landHeight } from './deriveLayout';
import { MAT, TOKEN, faithTint } from './palette';
import { useInstanced, type Placement } from './instancing';

// Per-kind footprint (width, height, depth) and roof height.
const FORM: Record<string, { w: number; h: number; d: number; roof: number }> = {
  cottage: { w: 0.9, h: 0.62, d: 0.8, roof: 0.5 },
  chapel: { w: 1.0, h: 1.0, d: 1.5, roof: 0.7 },
  market: { w: 1.6, h: 0.6, d: 1.0, roof: 0.42 },
  well: { w: 0.5, h: 0.4, d: 0.5, roof: 0.3 },
};

interface Placed {
  b: SceneBuilding;
  i: number; // its index in the fief's buildings (drives buildingLocal)
  p: { x: number; z: number };
  /** The ground under the house — each stands on its own patch of land. */
  y: number;
}

export function Houses({
  fief,
  anchor,
  onSelect,
}: {
  fief: SceneFief;
  /** The fief's world anchor — the houses ask the land for their footing. */
  anchor: { x: number; z: number };
  onSelect?: (fiefId: string, doorId: string) => void;
}) {
  const [hover, setHover] = useState<Placed | null>(null);

  // Every house but the manor (the keep is drawn by the Fief).
  const placed = useMemo<Placed[]>(() => {
    return fief.buildings
      .map((b, i) => {
        const p = buildingLocal(fief.id, b.id, i, fief.buildings.length, b.kind);
        return { b, i, p, y: Math.max(0.05, landHeight(anchor.x + p.x, anchor.z + p.z)) };
      })
      .filter((x) => x.b.kind !== 'manor');
  }, [fief, anchor.x, anchor.z]);

  // Group by state: three draw batches.
  const byState = useMemo(() => {
    const m: Record<string, Placed[]> = { held: [], vacant: [], crisis: [] };
    for (const x of placed) m[x.b.state].push(x);
    return m;
  }, [placed]);

  const geoms = useGeoms();

  const batch = (list: Placed[], state: string) => {
    const placements: Placement[] = list.map((x) => ({
      x: x.p.x,
      y: x.y,
      z: x.p.z,
      rotY: hash1(x.i * 13 + 7) * Math.PI * 2,
      scale: 1,
    }));
    const wallCols = list.map((x) => {
      if (state === 'held') {
        // Faith tints prosperity — a per-fief lushness with a fine per-door variation.
        const fine = hash1(x.i * 29 + 3) * 30;
        return faithTint(Math.min(100, fief.faith * 0.8 + fine), TOKEN.houseWall, TOKEN.houseWallDrab);
      }
      if (state === 'vacant') return new THREE.Color(TOKEN.houseVacant);
      return new THREE.Color(TOKEN.houseCrisis);
    });
    const roofCols = list.map(() =>
      state === 'held'
        ? faithTint(fief.faith, TOKEN.roofTile, TOKEN.roofTileDrab)
        : state === 'vacant'
          ? new THREE.Color(TOKEN.roofVacant)
          : new THREE.Color(TOKEN.roofCrisis),
    );

    // Walls, roofs, and (for the vacant) boards. One footprint per kind is
    // folded into the per-instance scale, so a single geometry serves all.
    const walls = useInstancedWalls(geoms.wall, MAT.wall, list, placements, wallCols);
    const roofs = useInstancedWalls(geoms.roof, MAT.roof, list, placements, roofCols, true);

    const onClick = (e: any) => {
      e.stopPropagation();
      const x = list[e.instanceId];
      if (x) onSelect?.(fief.id, x.b.id);
    };
    const onOver = (e: any) => {
      e.stopPropagation();
      setHover(list[e.instanceId]);
    };

    return (
      <group key={state}>
        <primitive object={walls} castShadow receiveShadow onClick={onClick} onPointerOver={onOver} onPointerOut={() => setHover(null)} />
        <primitive object={roofs} castShadow onClick={onClick} onPointerOver={onOver} onPointerOut={() => setHover(null)} />
        {state === 'vacant' && (
          <primitive object={useInstancedWalls(geoms.board, MAT.board, list, placements, undefined)} />
        )}
        {state === 'held' && (
          <primitive object={useWindows(geoms.window, MAT.windowLit, list, placements)} />
        )}
        {state === 'vacant' && (
          <primitive object={useWindows(geoms.window, MAT.windowDark, list, placements)} />
        )}
      </group>
    );
  };

  return (
    <group>
      {batch(byState.held, 'held')}
      {batch(byState.vacant, 'vacant')}
      {batch(byState.crisis, 'crisis')}
      {hover && (
        <Html position={[hover.p.x, hover.y + 1.4, hover.p.z]} center distanceFactor={26} style={{ pointerEvents: 'none' }}>
          <div className="rl-tip">{hover.b.label}</div>
        </Html>
      )}
    </group>
  );
}

// ── Shared geometries ──────────────────────────────────────────────────────

function useGeoms() {
  return useMemo(() => {
    const wall = new THREE.BoxGeometry(1, 1, 1);
    wall.translate(0, 0.5, 0);
    const roof = new THREE.ConeGeometry(0.74, 1, 4);
    roof.rotateY(Math.PI / 4);
    roof.translate(0, 0.5, 0); // spans 0..1: scaled by roof height it sits flush on the wall
    const board = new THREE.BoxGeometry(1.06, 0.15, 1.06);
    board.translate(0, 0.45, 0);
    const window = new THREE.PlaneGeometry(0.42, 0.26);
    window.translate(0, 0.5, 0.505); // the front face of a 1×1×1 wall
    return { wall, roof, board, window };
  }, []);
}

// ── Instancing with a per-kind footprint ──────────────────────────────────

/**
 * Walls and roofs share a 1×1×1 geometry scaled per instance to the house's
 * kind. Roofs sit on top of the wall, so their y-scale is the roof height.
 */
function useInstancedWalls(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  list: Placed[],
  placements: Placement[],
  colors: THREE.Color[] | undefined,
  isRoof = false,
) {
  const mesh = useInstanced(geometry, material, placements, colors);
  useMemo(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const e = new THREE.Euler();
    for (let i = 0; i < list.length; i++) {
      const form = FORM[list[i].b.kind] ?? FORM.cottage;
      const p = placements[i];
      e.set(0, p.rotY ?? 0, 0);
      q.setFromEuler(e);
      if (isRoof) {
        // Sit the roof on top of the wall.
        s.set(form.w * 1.18, form.roof, form.d * 1.18);
        m.compose(new THREE.Vector3(p.x, p.y + form.h, p.z), q, s);
      } else {
        s.set(form.w, form.h, form.d);
        m.compose(new THREE.Vector3(p.x, p.y, p.z), q, s);
      }
      mesh.setMatrixAt(i, m);
      if (colors && colors[i]) mesh.setColorAt(i, colors[i]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (colors && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesh, list, placements, colors, isRoof]);
  return mesh;
}

/** The windows — one lit (or dark) face per house, on its front wall. */
function useWindows(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  list: Placed[],
  placements: Placement[],
) {
  const mesh = useInstanced(geometry, material, placements);
  useMemo(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    const e = new THREE.Euler();
    for (let i = 0; i < list.length; i++) {
      const form = FORM[list[i].b.kind] ?? FORM.cottage;
      const p = placements[i];
      e.set(0, p.rotY ?? 0, 0);
      q.setFromEuler(e);
      // The window plane is baked to a 1×1×1 wall's front; scale x/y with the
      // house and push it out to the house's own front face.
      const local = new THREE.Vector3(0, 0, 0.505).applyQuaternion(q);
      m.compose(
        new THREE.Vector3(p.x + local.x * form.d, p.y + form.h * 0.5, p.z + local.z * form.d),
        q,
        s.set(form.w, form.h, 1),
      );
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesh, list, placements]);
  return mesh;
}
