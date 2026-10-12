/** OWNER: render-buildings agent. Placeholder: grey boxes so the scene runs before the real meshes land. */
import * as THREE from 'three';
import type { BuildingLook, BuildingVisual, RenderCtx, Env } from '../api';
import { PAL, mat, shadows } from '../palette';

export function createBuildingVisual(look: BuildingLook, _ctx: RenderCtx): BuildingVisual {
  const group = new THREE.Group();
  const hgt = 0.9 + (look.w + look.h) * 0.15;
  const body = new THREE.Mesh(new THREE.BoxGeometry(look.w * 0.8, hgt, look.h * 0.8), mat(PAL.plaster));
  body.position.y = hgt / 2; group.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(look.w, look.h) * 0.62, 0.7, 4), mat(PAL.thatch));
  roof.position.y = hgt + 0.35; roof.rotation.y = Math.PI / 4; group.add(roof);
  shadows(group);
  return {
    group, set(_l: BuildingLook) {}, update(_e: Env) {},
    anchors: { door: new THREE.Vector3(0, 0, look.h / 2 + 0.2), roof: new THREE.Vector3(0, hgt + 0.7, 0), chimney: null, top: hgt + 0.8, windows: [] },
    dispose() { group.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); }); },
  };
}
