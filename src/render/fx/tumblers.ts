/**
 * Tumblers: small flat things that turn over in the air and catch the light
 * (confetti, autumn leaves, blossom petals). Real lit quads in one
 * InstancedMesh so they shade with the scene's own lights as they turn, then
 * lie on the board a while before shrinking away.
 */
import * as THREE from 'three';
import { type FxFrame, TAU, rand } from './util';

export const TB_CONFETTI = 0, TB_LEAF = 1, TB_PETAL = 2;

export class Tumblers {
  readonly mesh: THREE.InstancedMesh;
  readonly cap: number;
  private n = 0;
  private geo: THREE.PlaneGeometry;
  private mat: THREE.MeshStandardMaterial;
  private aCell: THREE.InstancedBufferAttribute;
  private cellArr: Float32Array;

  x: Float32Array; y: Float32Array; z: Float32Array; vx: Float32Array; vy: Float32Array; vz: Float32Array;
  rx: Float32Array; ry: Float32Array; rz: Float32Array; wx: Float32Array; wy: Float32Array; wz: Float32Array;
  w: Float32Array; h: Float32Array; r: Float32Array; g: Float32Array; b: Float32Array;
  age: Float32Array; life: Float32Array; landT: Float32Array; linger: Float32Array;
  swayA: Float32Array; swayF: Float32Array; seed: Float32Array; term: Float32Array; drag: Float32Array; grav: Float32Array; windR: Float32Array;
  cell: Uint8Array; state: Uint8Array; world: Uint8Array; kind: Uint8Array;

  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler(0, 0, 0, 'YXZ');
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  /** translucency term, follows the daylight (set each frame) */
  private selfLit = { value: 0.3 };

  constructor(cap: number, atlas: THREE.Texture) {
    this.cap = cap;
    const f = () => new Float32Array(cap), u = () => new Uint8Array(cap);
    this.x = f(); this.y = f(); this.z = f(); this.vx = f(); this.vy = f(); this.vz = f();
    this.rx = f(); this.ry = f(); this.rz = f(); this.wx = f(); this.wy = f(); this.wz = f();
    this.w = f(); this.h = f(); this.r = f(); this.g = f(); this.b = f();
    this.age = f(); this.life = f(); this.landT = f(); this.linger = f();
    this.swayA = f(); this.swayF = f(); this.seed = f(); this.term = f(); this.drag = f(); this.grav = f(); this.windR = f();
    this.cell = u(); this.state = u(); this.world = u(); this.kind = u();

    this.geo = new THREE.PlaneGeometry(1, 1);
    this.cellArr = new Float32Array(cap);
    this.aCell = new THREE.InstancedBufferAttribute(this.cellArr, 1);
    this.aCell.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('aCell', this.aCell);

    this.mat = new THREE.MeshStandardMaterial({
      map: atlas, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55, metalness: 0, flatShading: false,
    });
    const selfLit = this.selfLit;
    this.mat.onBeforeCompile = (sh) => {
      sh.uniforms.uSelfLit = selfLit;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aCell;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n  vMapUv = (vMapUv + vec2(mod(aCell + 0.01, 2.0) - 0.01, floor(aCell * 0.5 + 0.01))) * 0.5;\n#endif');
      // thin paper and leaves glow a little with the light passing through them,
      // so a piece seen edge-on or from behind never reads as a black fleck
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uSelfLit;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * uSelfLit;');
    };
    this.mat.customProgramCacheKey = () => 'landlord-fx-tumbler';

    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // allocate the colour attribute once
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    this.mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.matrixAutoUpdate = false;
  }

  get active(): number { return this.n; }
  /** drop everything in the air at once */
  clear(): void { this.n = 0; }

  /** claim a slot; -1 when full. Caller fills position, velocity, size, colour. */
  spawn(kind: number, cell: number, world: boolean): number {
    if (this.n >= this.cap) return -1;
    const i = this.n++;
    this.kind[i] = kind; this.cell[i] = cell; this.world[i] = world ? 1 : 0; this.state[i] = 0;
    this.vx[i] = 0; this.vy[i] = 0; this.vz[i] = 0;
    this.rx[i] = Math.random() * TAU; this.ry[i] = Math.random() * TAU; this.rz[i] = Math.random() * TAU;
    this.wx[i] = rand(-8, 8); this.wy[i] = rand(-3, 3); this.wz[i] = rand(-6, 6);
    this.age[i] = 0; this.life[i] = 30; this.landT[i] = 0; this.linger[i] = 3;
    this.swayA[i] = 0; this.swayF[i] = 1; this.seed[i] = Math.random(); this.term[i] = 0.7; this.drag[i] = 0.4; this.grav[i] = -4; this.windR[i] = 0;
    this.r[i] = 1; this.g[i] = 1; this.b[i] = 1; this.w[i] = 0.1; this.h[i] = 0.1;
    return i;
  }

  private kill(i: number): void {
    const j = --this.n;
    if (i === j) return;
    this.x[i] = this.x[j]; this.y[i] = this.y[j]; this.z[i] = this.z[j]; this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j]; this.vz[i] = this.vz[j];
    this.rx[i] = this.rx[j]; this.ry[i] = this.ry[j]; this.rz[i] = this.rz[j]; this.wx[i] = this.wx[j]; this.wy[i] = this.wy[j]; this.wz[i] = this.wz[j];
    this.w[i] = this.w[j]; this.h[i] = this.h[j]; this.r[i] = this.r[j]; this.g[i] = this.g[j]; this.b[i] = this.b[j];
    this.age[i] = this.age[j]; this.life[i] = this.life[j]; this.landT[i] = this.landT[j]; this.linger[i] = this.linger[j];
    this.swayA[i] = this.swayA[j]; this.swayF[i] = this.swayF[j]; this.seed[i] = this.seed[j]; this.term[i] = this.term[j];
    this.drag[i] = this.drag[j]; this.grav[i] = this.grav[j]; this.windR[i] = this.windR[j];
    this.cell[i] = this.cell[j]; this.state[i] = this.state[j]; this.world[i] = this.world[j]; this.kind[i] = this.kind[j];
  }

  update(f: FxFrame): void {
    const mArr = this.mesh.instanceMatrix.array as Float32Array;
    const cArr = this.mesh.instanceColor!.array as Float32Array;
    this.selfLit.value = 0.06 + 0.3 * f.day;
    let i = 0;
    while (i < this.n) {
      const dt = this.world[i] ? f.dtW : f.dtR;
      this.age[i] += dt;
      let scale = 1;
      if (this.state[i] === 0) {
        if (this.age[i] > this.life[i]) { this.kill(i); continue; }
        let vx = this.vx[i], vy = this.vy[i] + this.grav[i] * dt, vz = this.vz[i];
        const d = Math.exp(-this.drag[i] * dt);
        vx *= d; vz *= d; vy *= d;
        // flutter: falling speed breathes as the piece turns face-on and edge-on
        const term = this.term[i] * (0.55 + 0.45 * Math.abs(Math.sin(this.rx[i])));
        if (vy < -term) vy += (-term - vy) * Math.min(1, 7 * dt);
        this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
        const ph = this.age[i] * this.swayF[i] + this.seed[i] * TAU;
        const sw = this.swayA[i];
        const wk = this.windR[i] * f.windS;
        this.x[i] += (vx + Math.cos(ph) * sw + f.windX * wk) * dt;
        this.z[i] += (vz + Math.sin(ph * 0.8 + 2) * sw * 0.7 + f.windZ * wk) * dt;
        this.y[i] += vy * dt;
        this.rx[i] += this.wx[i] * dt; this.ry[i] += this.wy[i] * dt; this.rz[i] += this.wz[i] * dt;
        if (this.y[i] <= 0.012 && vy < 0) {
          // come to rest flat on the board
          this.state[i] = 1; this.landT[i] = 0;
          this.y[i] = 0.006 + this.seed[i] * 0.006;
          this.rx[i] = -Math.PI / 2 + (this.seed[i] - 0.5) * 0.12; this.rz[i] = 0;
        }
        const pop = this.age[i] / 0.12;
        if (pop < 1) scale = 0.3 + 0.7 * pop;
      } else {
        const lt = (this.landT[i] += dt);
        const L = this.linger[i];
        if (lt >= L + 0.45) { this.kill(i); continue; }
        if (lt > L) scale = 1 - (lt - L) / 0.45;
      }
      this.e.set(this.rx[i], this.ry[i], this.rz[i], 'YXZ');
      this.q.setFromEuler(this.e);
      this.p.set(this.x[i], this.y[i], this.z[i]);
      this.s.set(this.w[i] * scale, this.h[i] * scale, 1);
      this.m.compose(this.p, this.q, this.s);
      this.m.toArray(mArr, i * 16);
      const o = i * 3;
      cArr[o] = this.r[i]; cArr[o + 1] = this.g[i]; cArr[o + 2] = this.b[i];
      this.cellArr[i] = this.cell[i];
      i++;
    }
    const n = this.n;
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    if (n > 0) {
      const im = this.mesh.instanceMatrix, ic = this.mesh.instanceColor!;
      im.clearUpdateRanges(); im.addUpdateRange(0, n * 16); im.needsUpdate = true;
      ic.clearUpdateRanges(); ic.addUpdateRange(0, n * 3); ic.needsUpdate = true;
      this.aCell.clearUpdateRanges(); this.aCell.addUpdateRange(0, n); this.aCell.needsUpdate = true;
    }
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geo.dispose();
    this.mat.dispose();
  }
}
