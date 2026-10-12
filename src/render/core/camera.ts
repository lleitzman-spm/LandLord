/**
 * The camera: an orbit round a point on the board. Damped, clamped, with a
 * slight lean-in as you zoom close (you bend over the table to look at a
 * house), timed tweens for focus(), and scripted moves for the title orbit,
 * audiences and the promotion ceremony.
 */
import * as THREE from 'three';
import type { SceneMode } from '../api';
import { HALF_W, HALF_D } from './layout';
import { clamp, damp, lerp, smoothstep, easeInOut, DEG } from './util';

export interface Pose { tx: number; tz: number; dist: number; yaw: number; pitch: number }

export const PITCH_MIN = 25 * DEG, PITCH_MAX = 70 * DEG;
/** how steeply you look down by default, and from the overview */
export const HOME_PITCH = 43 * DEG, OVERVIEW_PITCH = 47 * DEG;
const MIN_DIST = 7;
const LEAN = 13 * DEG;
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _v = new THREE.Vector3();
const wrapPi = (a: number): number => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };

export class CameraRig {
  readonly cur: Pose = { tx: -4, tz: 0, dist: 30, yaw: 0, pitch: HOME_PITCH };
  readonly goal: Pose = { ...this.cur };
  mode: SceneMode = 'play';
  /** the distance that counts as "default zoom" (Anchor.scale is 1 there) */
  refDist = 30;
  /** keys held: pan x, pan z (screen-relative), rotate */
  keyPan = new THREE.Vector2();
  keyTurn = 0;
  private saved: Pose = { ...this.cur };
  private tween: { from: Pose; to: Pose; t: number; dur: number } | null = null;
  private aspect = 1.6;
  private modeTime = 10;
  private leanK = 1;
  private seat = { x: -5.5, z: -2.5, yaw: 0 };
  private orbit0 = 0.5;

  constructor(readonly camera: THREE.PerspectiveCamera) {
    this.apply();
  }

  setAspect(aspect: number): void {
    this.aspect = aspect;
    this.camera.aspect = aspect;
    this.camera.fov = lerp(44, 30, smoothstep(0.5, 1.2, aspect));
    this.camera.updateProjectionMatrix();
    this.refDist = clamp(this.overviewDist() * 0.56, 22, 60);
  }

  /**
   * distance from which the whole board fits the frame. On a wide screen it also
   * takes in the coffer and the charter either side; on a narrow one just the board.
   */
  overviewDist(): number {
    const tv = Math.tan((this.camera.fov * DEG) / 2), th = tv * this.aspect;
    const p = OVERVIEW_PITCH;
    const side = lerp(2.0, 8.4, smoothstep(1.05, 1.55, this.aspect));
    return clamp(Math.max((HALF_W + side) / th, ((HALF_D + 1.6) * Math.sin(p)) / tv + (HALF_D + 1.6) * Math.cos(p)), 30, 130);
  }
  get maxDist(): number { return this.overviewDist() * 1.12; }
  /** 0 at the closest zoom .. 1 at the overview */
  get zoomT(): number { return clamp(Math.log(this.cur.dist / MIN_DIST) / Math.log(this.overviewDist() / MIN_DIST), 0, 1); }

  setSeat(x: number, z: number, frontYaw: number): void { this.seat.x = x; this.seat.z = z; this.seat.yaw = frontYaw; }

  /** snap to a fresh default view (new game / load) */
  reset(tx: number, tz: number): void {
    this.tween = null;
    const p: Pose = { tx, tz, dist: this.refDist, yaw: 0, pitch: HOME_PITCH };
    Object.assign(this.goal, p); Object.assign(this.saved, p);
    if (this.mode === 'play') Object.assign(this.cur, p);
    else { this.script(0); Object.assign(this.cur, this.goal); }
    this.modeTime = 10;
    this.apply();
  }

  setMode(mode: SceneMode): void {
    if (mode === this.mode) return;
    if (this.mode === 'play') Object.assign(this.saved, this.goal);
    this.mode = mode;
    this.modeTime = 0;
    this.tween = null;
    this.keyPan.set(0, 0); this.keyTurn = 0;
    if (mode === 'play') {
      Object.assign(this.goal, this.saved);
      this.goal.yaw = this.cur.yaw + wrapPi(this.saved.yaw - this.cur.yaw);
    } else {
      this.orbit0 = this.cur.yaw;
    }
  }

  /** timed move (play mode); in other modes it re-aims the view you will return to */
  focus(tx: number | null, tz: number | null, dist: number | null, ms: number, pitch: number | null = null): void {
    const base = this.mode === 'play' ? this.goal : this.saved;
    const to: Pose = { tx: tx ?? base.tx, tz: tz ?? base.tz, dist: clamp(dist ?? base.dist, MIN_DIST, this.maxDist), yaw: base.yaw, pitch: pitch ?? base.pitch };
    this.clampPose(to);
    if (this.mode !== 'play') { Object.assign(this.saved, to); return; }
    Object.assign(this.goal, to);
    if (ms <= 0) { Object.assign(this.cur, to); this.tween = null; return; }
    this.tween = { from: { ...this.cur }, to, t: 0, dur: ms / 1000 };
  }

  // ── direct manipulation (play mode only) ──────────────────────────────

  /** world point on the ground under a screen position (NDC); null if the ray misses the table plane */
  groundAt(ndcX: number, ndcY: number, out: THREE.Vector3): THREE.Vector3 | null {
    _ray.setFromCamera(_ndc.set(ndcX, ndcY), this.camera);
    return _ray.ray.intersectPlane(_plane, out);
  }

  zoomAt(ndcX: number, ndcY: number, factor: number): void {
    if (this.mode !== 'play') return;
    this.tween = null;
    const g = this.goal;
    const nd = clamp(g.dist * factor, MIN_DIST, this.maxDist);
    const k = nd / g.dist;
    const p = this.groundAt(ndcX, ndcY, _v);
    if (p && Math.abs(p.x) < 60 && Math.abs(p.z) < 60) { g.tx = p.x + (g.tx - p.x) * k; g.tz = p.z + (g.tz - p.z) * k; }
    g.dist = nd;
    this.clampPose(g);
  }

  /** shift the view so that world point `from` lands where `to` is now (grab-panning) */
  grab(from: THREE.Vector3, to: THREE.Vector3): void {
    if (this.mode !== 'play') return;
    this.tween = null;
    const dx = from.x - to.x, dz = from.z - to.z;
    this.goal.tx += dx; this.goal.tz += dz;
    this.clampPose(this.goal);
    this.cur.tx = this.goal.tx; this.cur.tz = this.goal.tz;
    this.apply();
  }

  rotate(dyaw: number, dpitch: number): void {
    if (this.mode !== 'play') return;
    this.tween = null;
    this.goal.yaw += dyaw;
    this.goal.pitch = clamp(this.goal.pitch + dpitch, PITCH_MIN, PITCH_MAX);
  }

  private clampPose(p: Pose): void {
    p.tx = clamp(p.tx, -HALF_W - 1, HALF_W + 1);
    p.tz = clamp(p.tz, -HALF_D - 1, HALF_D + 1);
    p.dist = clamp(p.dist, MIN_DIST, this.maxDist);
  }

  /** scripted goals for the non-play modes */
  private script(dt: number): void {
    const g = this.goal, s = this.seat, t = this.modeTime;
    if (this.mode === 'title') {
      g.tx = s.x + 1.5; g.tz = s.z + 2.5;
      g.dist = 23; g.pitch = 30 * DEG;
      g.yaw = this.orbit0 + t * 0.042;
    } else if (this.mode === 'audience') {
      // low and close before the seat's door, a little off the axis
      g.tx = s.x + Math.sin(s.yaw) * 1.6; g.tz = s.z + Math.cos(s.yaw) * 1.6;
      g.dist = 10.5; g.pitch = 21 * DEG;
      g.yaw = this.orbit0 + wrapPi(s.yaw + 0.42 - this.orbit0) + Math.sin(t * 0.18) * 0.05;
    } else if (this.mode === 'ceremony') {
      g.tx = s.x; g.tz = s.z;
      const k = smoothstep(0, 16, t);
      g.dist = lerp(25, 12.5, k); g.pitch = lerp(36, 27, k) * DEG;
      g.yaw = this.orbit0 + wrapPi(s.yaw - 0.5 - this.orbit0) + t * 0.022;
    }
    void dt;
  }

  update(dt: number): void {
    this.modeTime += dt;
    const c = this.cur, g = this.goal;
    if (this.mode === 'play') {
      if (this.keyPan.x !== 0 || this.keyPan.y !== 0 || this.keyTurn !== 0) {
        this.tween = null;
        const sp = g.dist * 0.95 * dt, sin = Math.sin(g.yaw), cos = Math.cos(g.yaw);
        // screen-right is (cos, -sin) on the ground; screen-up (away from the camera) is (-sin, -cos)
        g.tx += (this.keyPan.x * cos - this.keyPan.y * sin) * sp;
        g.tz += (-this.keyPan.x * sin - this.keyPan.y * cos) * sp;
        g.yaw += this.keyTurn * 1.5 * dt;
        this.clampPose(g);
      }
    } else this.script(dt);

    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      const k = easeInOut(tw.t);
      c.tx = lerp(tw.from.tx, tw.to.tx, k); c.tz = lerp(tw.from.tz, tw.to.tz, k);
      c.dist = Math.exp(lerp(Math.log(tw.from.dist), Math.log(tw.to.dist), k));
      c.yaw = lerp(tw.from.yaw, tw.to.yaw, k); c.pitch = lerp(tw.from.pitch, tw.to.pitch, k);
      if (tw.t >= 1) this.tween = null;
    } else {
      // crisp under the hand in play; slow and cinematic when a mode has just changed
      const settle = smoothstep(0, 1.6, this.modeTime);
      const lam = this.mode === 'play' ? lerp(2.4, 10, settle) : lerp(1.4, 2.6, settle);
      c.tx = damp(c.tx, g.tx, lam, dt); c.tz = damp(c.tz, g.tz, lam, dt);
      c.dist = Math.exp(damp(Math.log(c.dist), Math.log(g.dist), lam, dt));
      c.yaw = damp(c.yaw, g.yaw, lam, dt); c.pitch = damp(c.pitch, g.pitch, lam, dt);
    }
    this.leanK = damp(this.leanK, this.mode === 'play' ? 1 : 0, 2.5, dt);
    this.apply();
  }

  /** the pitch actually used: you lean in as you come close */
  get pitchNow(): number {
    const lean = LEAN * this.leanK * (1 - smoothstep(MIN_DIST, this.refDist * 1.1, this.cur.dist));
    return this.mode === 'play' ? clamp(this.cur.pitch - lean, PITCH_MIN - 3 * DEG, PITCH_MAX) : this.cur.pitch - lean;
  }

  apply(): void {
    const c = this.cur, p = this.pitchNow;
    const cp = Math.cos(p);
    this.camera.position.set(c.tx + Math.sin(c.yaw) * cp * c.dist, Math.sin(p) * c.dist, c.tz + Math.cos(c.yaw) * cp * c.dist);
    this.camera.lookAt(c.tx, 0.35, c.tz);
    this.camera.updateMatrixWorld();
  }
}
