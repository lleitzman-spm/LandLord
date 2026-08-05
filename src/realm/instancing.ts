/**
 * A tiny helper for the realm's many InstancedMeshes: builds the matrices
 * once from a list of placements. Never Math.random() — every transform
 * comes from deriveLayout or a hash of a stable key.
 */

import { useMemo } from 'react';
import * as THREE from 'three';

export interface Placement {
  x: number;
  y: number;
  z: number;
  rotY?: number;
  scale?: number;
  scaleY?: number;
}

/**
 * Build a static InstancedMesh for `count` placements sharing a geometry and
 * material. The mesh is memoized; its matrices are written once. Per-instance
 * color is applied if `colors` is given (same length as placements).
 */
export function useInstanced(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  placements: Placement[],
  colors?: THREE.Color[],
) {
  const mesh = useMemo(
    // EXACTLY as many instances as there are placements — zero included.
    // `Math.max(1, …)` allocated a slot nobody filled, and three leaves an
    // unwritten slot at the IDENTITY matrix: so a fief with no crisis doors (or
    // no vacant ones) still drew a unit-scale house at its own origin, standing
    // alone out in the fields. Worse, it carried the batch's onClick, and the
    // handler looks up `list[instanceId]` — undefined — so it was a phantom
    // house you could hover and click that did nothing at all. A count of 0
    // draws nothing and can be hit by nothing. (Audit, 2026-07-27.)
    () => new THREE.InstancedMesh(geometry, material, placements.length),
    [geometry, material, placements.length],
  );

  useMemo(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const e = new THREE.Euler();
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      e.set(0, p.rotY ?? 0, 0);
      q.setFromEuler(e);
      s.set(p.scale ?? 1, p.scaleY ?? p.scale ?? 1, p.scale ?? 1);
      m.compose(new THREE.Vector3(p.x, p.y, p.z), q, s);
      mesh.setMatrixAt(i, m);
      if (colors && colors[i]) mesh.setColorAt(i, colors[i]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (colors && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [mesh, placements, colors]);

  return mesh;
}
