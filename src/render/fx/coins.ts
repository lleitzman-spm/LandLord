/**
 * Rent Day coins: chunky gold discs with a raised rim, flipping end over end
 * on a ballistic arc from a roof to the coffer, staggered, each landing with a
 * glint. One instanced draw call for every coin on the table; the glow, the
 * glitter they shed and the glints go to the additive sprite layer.
 */
import * as THREE from 'three';
import { PAL } from '../palette';
import { F_GLOW, F_STAR, F_STAR8, F_MOTE, F_STREAK } from './atlas';
import { type SpriteLayer, S_PULSE, S_GROW, K_GENERIC, M_FACE, M_STREAK } from './sprites';
import { type FxFrame, rand, lin, TAU } from './util';

const GOLD = lin(PAL.gold);
const GOLD_HOT: [number, number, number] = [GOLD[0] * 2.2, GOLD[1] * 2.0, GOLD[2] * 1.6];
const GLINT: [number, number, number] = [2.4, 2.1, 1.5];

export class Coins {
  readonly mesh: THREE.InstancedMesh;
  readonly cap: number;
  private n = 0;
  private mat: THREE.MeshStandardMaterial;
  private geo: THREE.BufferGeometry;
  // per coin
  private fx: Float32Array; private fy: Float32Array; private fz: Float32Array;
  private tx: Float32Array; private ty: Float32Array; private tz: Float32Array;
  private delay: Float32Array; private u: Float32Array; private dur: Float32Array; private apex: Float32Array;
  private sx: Float32Array; private sz: Float32Array; private spin: Float32Array; private spinV: Float32Array;
  private yaw: Float32Array; private tilt: Float32Array; private landT: Float32Array; private glintCd: Float32Array;
  private state: Uint8Array;
  // temporaries (reused)
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler(0, 0, 0, 'YXZ');
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();

  constructor(cap: number, env: THREE.Texture) {
    this.cap = cap;
    const f = () => new Float32Array(cap);
    this.fx = f(); this.fy = f(); this.fz = f(); this.tx = f(); this.ty = f(); this.tz = f();
    this.delay = f(); this.u = f(); this.dur = f(); this.apex = f(); this.sx = f(); this.sz = f();
    this.spin = f(); this.spinV = f(); this.yaw = f(); this.tilt = f(); this.landT = f(); this.glintCd = f();
    this.state = new Uint8Array(cap);

    // a struck coin: recessed face, raised bevelled rim (flat shading makes the facets glint)
    const prof = [
      [0.0, -0.010], [0.062, -0.010], [0.069, -0.016], [0.088, -0.012],
      [0.088, 0.012], [0.069, 0.016], [0.062, 0.010], [0.0, 0.010],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    this.geo = new THREE.LatheGeometry(prof, 16);
    this.mat = new THREE.MeshStandardMaterial({
      color: PAL.gold, metalness: 0.82, roughness: 0.3, flatShading: true,
      envMap: env, envMapIntensity: 1.0, emissive: PAL.goldDark, emissiveIntensity: 0.14,
    });
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.matrixAutoUpdate = false;
  }

  get active(): number { return this.n; }
  /** drop everything in the air at once */
  clear(): void { this.n = 0; }

  add(from: THREE.Vector3, to: THREE.Vector3, count: number): void {
    const dx = to.x - from.x, dz = to.z - from.z;
    const dist = Math.sqrt(dx * dx + dz * dz + (to.y - from.y) ** 2);
    const hd = Math.sqrt(dx * dx + dz * dz) || 1;
    const px = dz / hd, pz = -dx / hd;              // horizontal perpendicular
    const yaw = Math.atan2(dx, dz);
    const baseDur = Math.min(1.7, 0.75 + dist * 0.045);
    const baseApex = 0.9 + dist * 0.16;
    for (let k = 0; k < count; k++) {
      if (this.n >= this.cap) return;
      const i = this.n++;
      const a = Math.random() * TAU, r = Math.random() * 0.16;
      this.fx[i] = from.x + Math.cos(a) * r; this.fy[i] = from.y + rand(0, 0.06); this.fz[i] = from.z + Math.sin(a) * r;
      const b = Math.random() * TAU, rr = Math.random() * 0.14;
      this.tx[i] = to.x + Math.cos(b) * rr; this.ty[i] = to.y; this.tz[i] = to.z + Math.sin(b) * rr;
      this.delay[i] = k * 0.075 + rand(0, 0.05);
      this.u[i] = 0;
      this.dur[i] = baseDur * rand(0.9, 1.1);
      this.apex[i] = baseApex * rand(0.85, 1.15);
      const side = rand(-0.4, 0.4);
      this.sx[i] = px * side; this.sz[i] = pz * side;
      this.spin[i] = Math.random() * TAU;
      this.spinV[i] = rand(13, 20) * (Math.random() < 0.5 ? -1 : 1);
      this.yaw[i] = yaw + rand(-0.3, 0.3);
      this.tilt[i] = rand(-0.35, 0.35);
      this.landT[i] = 0; this.glintCd[i] = rand(0, 0.2);
      this.state[i] = 0;
    }
  }

  private kill(i: number): void {
    const j = --this.n;
    if (i === j) return;
    this.fx[i] = this.fx[j]; this.fy[i] = this.fy[j]; this.fz[i] = this.fz[j];
    this.tx[i] = this.tx[j]; this.ty[i] = this.ty[j]; this.tz[i] = this.tz[j];
    this.delay[i] = this.delay[j]; this.u[i] = this.u[j]; this.dur[i] = this.dur[j]; this.apex[i] = this.apex[j];
    this.sx[i] = this.sx[j]; this.sz[i] = this.sz[j]; this.spin[i] = this.spin[j]; this.spinV[i] = this.spinV[j];
    this.yaw[i] = this.yaw[j]; this.tilt[i] = this.tilt[j]; this.landT[i] = this.landT[j]; this.glintCd[i] = this.glintCd[j];
    this.state[i] = this.state[j];
  }

  private glint(glow: SpriteLayer, x: number, y: number, z: number, size: number, life: number, frame: number): void {
    const j = glow.spawn(K_GENERIC, frame, M_FACE, false);
    if (j < 0) return;
    glow.pos(j, x, y, z);
    glow.size(j, 0, size);
    glow.smode[j] = S_PULSE;
    glow.col(j, GLINT, 0, 1, 0);
    glow.fade(j, life, 0, 0);
    glow.rot[j] = Math.random() * TAU; glow.rotV[j] = rand(-2, 2);
  }

  update(f: FxFrame, glow: SpriteLayer): void {
    const dt = f.dtR;
    const arr = this.mesh.instanceMatrix.array as Float32Array;
    this.mat.envMapIntensity = 0.55 + 0.5 * f.day;
    let k = 0;
    let i = 0;
    while (i < this.n) {
      let st = this.state[i];
      if (st === 0) {
        this.delay[i] -= dt;
        if (this.delay[i] > 0) { i++; continue; }
        st = this.state[i] = 1;
      }
      let x: number, y: number, z: number, scale = 1;
      if (st === 1) {
        let u = this.u[i] + dt / this.dur[i];
        if (u >= 1) {
          u = 1; this.state[i] = 2; this.landT[i] = 0;
          this.glint(glow, this.tx[i], this.ty[i] + 0.06, this.tz[i], 0.55, 0.42, F_STAR8);
          // a few bright chips thrown off the pile
          for (let c = 0; c < 3; c++) {
            const j = glow.spawn(K_GENERIC, F_MOTE, M_FACE, false);
            if (j < 0) break;
            const a = Math.random() * TAU;
            glow.pos(j, this.tx[i], this.ty[i] + 0.04, this.tz[i]);
            glow.vel(j, Math.cos(a) * 0.5, rand(0.5, 0.9), Math.sin(a) * 0.5);
            glow.grav[j] = -3.2;
            glow.size(j, 0.07, 0.02);
            glow.col(j, GOLD_HOT, 0, 0.9, 0);
            glow.fade(j, 0.4, 0, 0.5);
          }
        }
        this.u[i] = u;
        const sp = Math.sin(Math.PI * u);
        x = this.fx[i] + (this.tx[i] - this.fx[i]) * u + this.sx[i] * sp;
        z = this.fz[i] + (this.tz[i] - this.fz[i]) * u + this.sz[i] * sp;
        y = this.fy[i] + (this.ty[i] - this.fy[i]) * u + 4 * this.apex[i] * u * (1 - u);
        const fl = u * this.dur[i];
        scale = fl < 0.09 ? 0.35 + 0.65 * (fl / 0.09) : 1;
        this.spin[i] += this.spinV[i] * dt;

        // warm halo and a short motion streak while in flight (one frame sprites)
        const idur = 1 / this.dur[i];
        const cpu = Math.PI * Math.cos(Math.PI * u);
        const vx = ((this.tx[i] - this.fx[i]) + this.sx[i] * cpu) * idur;
        const vz = ((this.tz[i] - this.fz[i]) + this.sz[i] * cpu) * idur;
        const vy = ((this.ty[i] - this.fy[i]) + 4 * this.apex[i] * (1 - 2 * u)) * idur;
        const tl = 0.1 * Math.min(1, fl / 0.15);
        glow.push(x, y, z, vx * tl, vy * tl, vz * tl, 0.19, 0.12, 0, GOLD[0] * 1.4, GOLD[1] * 1.1, GOLD[2] * 0.6, 0.6, F_STREAK, M_STREAK, 0);
        glow.push(x, y, z, 0, 0, 0, 0.72, 0.72, 0, GOLD[0] * 1.25, GOLD[1] * 0.95, GOLD[2] * 0.55, 0.36, F_GLOW, M_FACE, 0);
        // glitter shed along the arc
        if (Math.random() < 14 * dt) {
          const j = glow.spawn(K_GENERIC, F_MOTE, M_FACE, false);
          if (j >= 0) {
            glow.pos(j, x, y, z);
            glow.vel(j, rand(-0.15, 0.15), rand(-0.35, 0.05), rand(-0.15, 0.15));
            glow.grav[j] = -0.5;
            glow.size(j, 0.085, 0.015);
            glow.smode[j] = S_GROW;
            glow.col(j, GOLD_HOT, 0, 0.85, 0);
            glow.fade(j, rand(0.4, 0.7), 0, 0.6);
            glow.twA[j] = 0.6; glow.twF[j] = rand(25, 40);
          }
        }
        // a specular wink when a face turns to the camera
        this.glintCd[i] -= dt;
        if (this.glintCd[i] <= 0) {
          const sn = Math.sin(this.spin[i]), cs = Math.cos(this.spin[i]);
          const st2 = Math.sin(this.tilt[i]), ct = Math.cos(this.tilt[i]);
          const nx0 = -st2, ny = ct * cs, nz0 = ct * sn;
          const yw = this.yaw[i], cy = Math.cos(yw), sy = Math.sin(yw);
          const nx = nx0 * cy + nz0 * sy, nz = -nx0 * sy + nz0 * cy;
          let vx = f.camX - x, vy = f.camY - y, vz = f.camZ - z;
          const vl = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
          vx /= vl; vy /= vl; vz /= vl;
          if (Math.abs(nx * vx + ny * vy + nz * vz) > 0.94) {
            this.glint(glow, x, y, z, 0.36, 0.2, F_STAR);
            this.glintCd[i] = 0.3;
          }
        }
      } else {
        // landed: a little clink and bounce, then into the pile
        const lt = (this.landT[i] += dt);
        if (lt >= 0.3) { this.kill(i); continue; }
        x = this.tx[i]; z = this.tz[i];
        y = this.ty[i] + 0.09 * Math.abs(Math.sin(lt * Math.PI / 0.14)) * (1 - lt / 0.3);
        this.spin[i] += this.spinV[i] * dt * (1 - lt / 0.3) * 0.4;
        scale = lt > 0.2 ? 1 - (lt - 0.2) / 0.1 : 1;
      }
      // write the matrix
      this.e.set(this.spin[i], this.yaw[i], this.tilt[i], 'YXZ');
      this.q.setFromEuler(this.e);
      this.p.set(x, y, z);
      const sc = scale * 1.65;
      this.s.set(sc, sc, sc);
      this.m.compose(this.p, this.q, this.s);
      this.m.toArray(arr, k * 16);
      k++;
      i++;
    }
    this.mesh.count = k;
    this.mesh.visible = k > 0;
    if (k > 0) {
      const im = this.mesh.instanceMatrix;
      im.clearUpdateRanges();
      im.addUpdateRange(0, k * 16);
      im.needsUpdate = true;
    }
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geo.dispose();
    this.mat.dispose();
  }
}
