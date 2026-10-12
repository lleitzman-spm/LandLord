/** OWNER: render-figures agent. Placeholder: a peg, so the scene runs before the living figurines land. */
import * as THREE from 'three';
import type { Figure, FigureSpec, RenderCtx, Env, FigureProp } from '../api';
import type { AnimId } from '../../data/ids';
import { PAL, mat, shadows } from '../palette';

export function createFigure(_spec: FigureSpec, _ctx: RenderCtx): Figure {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.3, 8), mat(PAL.clothBlue)); body.position.y = 0.15; group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mat(PAL.skinA)); head.position.y = 0.38; group.add(head);
  shadows(group, true, false);
  return {
    group, height: 0.5,
    setAnim(_a: AnimId) {}, lookAt() {}, setHeading(r: number) { group.rotation.y = r; }, setProp(_p: FigureProp) {}, setMood() {}, react() {}, setSelected() {},
    update(_e: Env) {}, dispose() {},
  };
}
