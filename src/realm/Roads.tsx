/**
 * Roads of ink running from each fief's gate to the Capital. Not paved
 * lanes: hand-drawn lines, laid flat on the land like the rest of the
 * map's linework, each with the gentle bow a scribe's hand gives a route.
 * The bow is hashed from the fief's id — drawn, never stored, never rolled.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { SceneFief } from './scene';
import { roadToCapital, landHeight, hashId } from './deriveLayout';
import { MAT } from './palette';

/** How far short of the Capital's wall the ink stops (the gate takes over). */
const CAPITAL_CLEAR = 7.2;
/** How far short of the town's own cluster it stops. */
const TOWN_CLEAR = 1.4;
/** The drawn line's half-width. */
const HALF_W = 0.22;

export function Roads({ fiefs }: { fiefs: SceneFief[] }) {
  const geom = useMemo(() => {
    const positions: number[] = [];
    const indices: number[] = [];

    fiefs.forEach((f, i) => {
      const [from, to] = roadToCapital(f.id, i, fiefs.length);
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      const len = Math.hypot(dx, dz);
      if (len < CAPITAL_CLEAR + TOWN_CLEAR + 1) return;
      // Unit direction and its left-hand normal.
      const ux = dx / len;
      const uz = dz / len;
      const nx = -uz;
      const nz = ux;
      // The scribe's bow — a fixed lateral bulge hashed from the id.
      const bow = ((hashId(`${f.id}/road`) / 4294967296) - 0.5) * 0.18 * len;

      const t0 = TOWN_CLEAR / len;
      const t1 = 1 - CAPITAL_CLEAR / len;
      const steps = 40;
      const base = positions.length / 3;
      for (let sIdx = 0; sIdx <= steps; sIdx++) {
        const t = t0 + (t1 - t0) * (sIdx / steps);
        const bowAmt = Math.sin(Math.PI * ((t - t0) / (t1 - t0))) * bow;
        const x = from.x + dx * t + nx * bowAmt;
        const z = from.z + dz * t + nz * bowAmt;
        const y = landHeight(x, z) + 0.2;
        // A ribbon two verts wide, flat on the ground.
        positions.push(x + nx * HALF_W, y, z + nz * HALF_W);
        positions.push(x - nx * HALF_W, y, z - nz * HALF_W);
        if (sIdx > 0) {
          const a = base + (sIdx - 1) * 2;
          indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
    });

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, [fiefs]);

  return <mesh geometry={geom} material={MAT.roadInk} />;
}
