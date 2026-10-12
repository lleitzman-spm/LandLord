/** OWNER: render-creatures agent. Incident visuals (griffin on the roof, goblins at the windows...). Placeholder. */
import * as THREE from 'three';
import type { VisualHandle, VisualHost, RenderCtx, Env } from '../api';
import type { VisualId } from '../../data/ids';
import { PAL, mat } from '../palette';

export function createVisual(_id: VisualId, host: VisualHost, _ctx: RenderCtx): VisualHandle {
  const group = new THREE.Group();
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.15), mat(PAL.magic, { emissive: PAL.magic, emissiveIntensity: 0.6 }));
  m.position.copy(host.visual.anchors.roof).add(new THREE.Vector3(0, 0.3, 0)); group.add(m);
  return { group, update(e: Env) { m.rotation.y = e.time; }, leave(done) { done(); }, dispose() {} };
}
