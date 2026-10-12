/**
 * The light rig: one warm shadow-casting key fitted to what the camera sees,
 * a cool fill from the far side, and a hemisphere for the room's bounce.
 * (The candle point lights live with the candles in props.ts.)
 */
import * as THREE from 'three';
import type { Quality } from '../api';
import type { Sky } from './env';
import { clamp } from './util';

const _right = new THREE.Vector3(), _up = new THREE.Vector3(), _c = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const COLD = new THREE.Color(0xdfe8ff);
const KEY_DIST = 70;

export class LightRig {
  readonly key = new THREE.DirectionalLight(0xffffff, 3);
  readonly fill = new THREE.DirectionalLight(0xffffff, 0.4);
  readonly hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 0.6);
  private mapSize = 2048;
  private radius = 0;
  private tick = 0;
  /** redraw the shadow map every Nth frame (2 on a struggling machine: nothing on the table moves that fast) */
  every = 1;

  constructor(private scene: THREE.Scene, quality: Quality) {
    const k = this.key;
    k.castShadow = true;
    k.shadow.bias = -0.00035;
    k.shadow.normalBias = 0.028;
    k.shadow.camera.near = 1;
    k.shadow.camera.far = KEY_DIST * 2 + 30;
    scene.add(k, k.target, this.fill, this.fill.target, this.hemi);
    this.setQuality(quality);
  }

  setQuality(q: Quality): void {
    const size = q === 'low' ? 1024 : 2048;
    if (size === this.mapSize && this.key.shadow.map) return;
    this.mapSize = size;
    this.key.shadow.mapSize.set(size, size);
    if (this.key.shadow.map) { this.key.shadow.map.dispose(); this.key.shadow.map = null; }
    this.radius = 0;
  }

  /** colours and strengths for this frame; `flash` is lightning (0..1) */
  apply(sky: Sky, flash: number): void {
    this.key.color.copy(sky.keyColor);
    this.key.intensity = sky.keyIntensity;
    this.fill.color.copy(sky.fillColor).lerp(COLD, clamp(flash, 0, 1));
    this.fill.intensity = sky.fillIntensity + flash * 3.2;
    this.hemi.color.copy(sky.hemiSky);
    this.hemi.groundColor.copy(sky.hemiGround);
    this.hemi.intensity = sky.hemiIntensity + flash * 0.5;
  }

  /**
   * Aim the key at `center` and fit its shadow box to a ground disc of `radius`.
   * The radius is quantised and the centre snapped to shadow texels so the
   * shadows do not swim while the camera pans.
   */
  fit(sky: Sky, center: THREE.Vector3, radius: number): void {
    const steps = [9, 12.5, 17, 23, 30];
    let R = steps[steps.length - 1]!;
    for (const s of steps) { if (radius <= s) { R = s; break; } }
    const cam = this.key.shadow.camera;
    let due = this.every <= 1 || ++this.tick % this.every === 0;
    if (R !== this.radius) {
      this.radius = R;
      cam.left = -R; cam.right = R; cam.top = R; cam.bottom = -R;
      cam.updateProjectionMatrix();
      due = true;
    }
    this.key.shadow.autoUpdate = false;
    if (due) this.key.shadow.needsUpdate = true;
    else return;      // the old map and its matrix stay as they were, and agree with each other
    const dir = sky.sunDir;
    _right.crossVectors(UP, dir).normalize();
    _up.crossVectors(dir, _right).normalize();
    const texel = (2 * R) / this.mapSize;
    const sx = Math.round(center.dot(_right) / texel) * texel;
    const sy = Math.round(center.dot(_up) / texel) * texel;
    const sz = center.dot(dir);
    _c.set(0, 0, 0).addScaledVector(_right, sx).addScaledVector(_up, sy).addScaledVector(dir, sz);
    this.key.target.position.copy(_c);
    this.key.position.copy(_c).addScaledVector(dir, KEY_DIST);
    this.key.target.updateMatrixWorld();
    // the fill comes from across the table, low
    this.fill.position.set(-dir.x * 30, 18, -dir.z * 30);
    this.fill.target.position.set(0, 0, 0);
    this.fill.target.updateMatrixWorld();
  }

  dispose(): void {
    this.scene.remove(this.key, this.key.target, this.fill, this.fill.target, this.hemi);
    this.key.shadow.map?.dispose();
    this.key.dispose(); this.fill.dispose(); this.hemi.dispose();
  }
}
