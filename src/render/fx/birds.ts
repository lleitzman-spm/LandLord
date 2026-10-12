/**
 * A few birds crossing the table by day: a small low-poly flock in a loose V,
 * flapping and gliding by turns, banking a little. One InstancedMesh; the
 * wing beat is a per-instance angle applied in the vertex shader (and in the
 * shadow pass, so their shadows flap across the board too).
 */
import * as THREE from 'three';
import { type FxFrame, TAU, rand } from './util';

const MAX_BIRDS = 16;
const MAX_FLOCKS = 3;

function birdGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const wing: number[] = [];
  const tri = (a: number[], b: number[], c: number[], side: number, wa: number, wb: number, wc: number) => {
    pos.push(...a, ...b, ...c);
    wing.push(side, wa, side, wb, side, wc);
  };
  // body: a small double cone, nose to +z
  const N = [0, 0, 0.13], T = [0, 0.006, -0.1], U = [0, 0.036, 0.02], D = [0, -0.028, 0.02], L = [-0.034, 0, 0.02], R = [0.034, 0, 0.02];
  tri(N, U, R, 0, 0, 0, 0); tri(N, R, D, 0, 0, 0, 0); tri(N, D, L, 0, 0, 0, 0); tri(N, L, U, 0, 0, 0, 0);
  tri(T, R, U, 0, 0, 0, 0); tri(T, D, R, 0, 0, 0, 0); tri(T, L, D, 0, 0, 0, 0); tri(T, U, L, 0, 0, 0, 0);
  // tail fan
  tri(T, [-0.055, 0.006, -0.17], [0.055, 0.006, -0.17], 0, 0, 0, 0);
  // wings: inner panel and a swept outer panel that bends further on the beat
  for (const s of [1, -1]) {
    const rf = [0.03 * s, 0.012, 0.06], rb = [0.03 * s, 0.012, -0.03];
    const mf = [0.16 * s, 0.014, 0.045], mb = [0.15 * s, 0.014, -0.05];
    const tip = [0.3 * s, 0.0, -0.07];
    tri(rf, mf, rb, s, 0, 1, 0);
    tri(mf, mb, rb, s, 1, 1, 0);
    tri(mf, tip, mb, s, 1, 1.6, 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aWingV', new THREE.Float32BufferAttribute(wing, 2));
  g.computeVertexNormals();
  return g;
}

const FLAP_DECL = 'attribute vec2 aWingV;\nattribute float aFlap;';
const FLAP_CODE = /* glsl */`
  vec3 transformed = vec3(position);
  if (aWingV.x != 0.0) {
    float ang = aFlap * aWingV.y * aWingV.x;
    vec2 piv = vec2(0.03 * aWingV.x, 0.012);
    vec2 p = transformed.xy - piv;
    float cs = cos(ang), sn = sin(ang);
    transformed.xy = piv + vec2(p.x * cs - p.y * sn, p.x * sn + p.y * cs);
  }
`;
function addFlap(m: THREE.Material, key: string): void {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + FLAP_DECL)
      .replace('#include <begin_vertex>', FLAP_CODE);
  };
  m.customProgramCacheKey = () => key;
}

export class Birds {
  readonly mesh: THREE.InstancedMesh;
  private geo: THREE.BufferGeometry;
  private mat: THREE.MeshLambertMaterial;
  private depth: THREE.MeshDepthMaterial;
  private flapAttr: THREE.InstancedBufferAttribute;
  private flapArr: Float32Array;
  // flocks
  private fActive = new Uint8Array(MAX_FLOCKS);
  private fsx = new Float32Array(MAX_FLOCKS); private fsz = new Float32Array(MAX_FLOCKS);
  private fdx = new Float32Array(MAX_FLOCKS); private fdz = new Float32Array(MAX_FLOCKS);
  private fsp = new Float32Array(MAX_FLOCKS); private fh = new Float32Array(MAX_FLOCKS);
  private fage = new Float32Array(MAX_FLOCKS); private fdur = new Float32Array(MAX_FLOCKS);
  // birds
  private bFlock = new Int8Array(MAX_BIRDS).fill(-1);
  private boa = new Float32Array(MAX_BIRDS); private bop = new Float32Array(MAX_BIRDS); private boh = new Float32Array(MAX_BIRDS);
  private bph = new Float32Array(MAX_BIRDS); private brate = new Float32Array(MAX_BIRDS); private bglide = new Float32Array(MAX_BIRDS);
  private bmode = new Uint8Array(MAX_BIRDS); private bflap = new Float32Array(MAX_BIRDS); private bbob = new Float32Array(MAX_BIRDS);

  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler(0, 0, 0, 'YXZ');
  private p = new THREE.Vector3();
  private s = new THREE.Vector3(1, 1, 1);

  constructor(color: number) {
    this.geo = birdGeometry();
    this.flapArr = new Float32Array(MAX_BIRDS);
    this.flapAttr = new THREE.InstancedBufferAttribute(this.flapArr, 1);
    this.flapAttr.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('aFlap', this.flapAttr);
    this.mat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, flatShading: true });
    addFlap(this.mat, 'landlord-fx-bird');
    this.depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
    addFlap(this.depth, 'landlord-fx-bird-depth');
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, MAX_BIRDS);
    this.mesh.customDepthMaterial = this.depth;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.matrixAutoUpdate = false;
  }

  get flocks(): number { let c = 0; for (let k = 0; k < MAX_FLOCKS; k++) c += this.fActive[k]; return c; }
  /** send every flock home at once */
  clear(): void { this.fActive.fill(0); this.bFlock.fill(-1); }

  /** send a flock across the table: from far off one side to far off the other */
  launch(size: number, reach: number): boolean {
    let fi = -1;
    for (let k = 0; k < MAX_FLOCKS; k++) if (!this.fActive[k]) { fi = k; break; }
    if (fi < 0) return false;
    const ang = Math.random() * TAU;
    const dx = Math.cos(ang), dz = Math.sin(ang);
    // offset the line a little from the centre so they do not all cross the middle
    const off = rand(-reach * 0.35, reach * 0.35);
    this.fsx[fi] = -dx * reach + -dz * off; this.fsz[fi] = -dz * reach + dx * off;
    this.fdx[fi] = dx; this.fdz[fi] = dz;
    this.fsp[fi] = rand(2.0, 2.8);
    this.fh[fi] = rand(4.6, 6.4);
    this.fage[fi] = 0;
    this.fdur[fi] = (reach * 2 + 3) / this.fsp[fi];
    this.fActive[fi] = 1;
    let placed = 0;
    for (let b = 0; b < MAX_BIRDS && placed < size; b++) {
      if (this.bFlock[b] >= 0) continue;
      this.bFlock[b] = fi;
      const rank = Math.ceil(placed / 2), side = placed % 2 === 1 ? 1 : -1;
      this.boa[b] = -rank * rand(0.45, 0.6) + rand(-0.1, 0.1);
      this.bop[b] = placed === 0 ? 0 : side * rank * rand(0.38, 0.5);
      this.boh[b] = rand(-0.15, 0.15) + rank * 0.04;
      this.bph[b] = Math.random() * TAU;
      this.brate[b] = rand(6.5, 8.5);
      this.bglide[b] = rand(0.6, 2.0);
      this.bmode[b] = 0;
      this.bflap[b] = 0.2;
      this.bbob[b] = Math.random() * TAU;
      placed++;
    }
    return true;
  }

  update(f: FxFrame): void {
    const dt = f.dtW;
    for (let k = 0; k < MAX_FLOCKS; k++) {
      if (!this.fActive[k]) continue;
      this.fage[k] += dt;
      if (this.fage[k] > this.fdur[k]) {
        this.fActive[k] = 0;
        for (let b = 0; b < MAX_BIRDS; b++) if (this.bFlock[b] === k) this.bFlock[b] = -1;
      }
    }
    const arr = this.mesh.instanceMatrix.array as Float32Array;
    let n = 0;
    for (let b = 0; b < MAX_BIRDS; b++) {
      const k = this.bFlock[b];
      if (k < 0) continue;
      const age = this.fage[k];
      // flap / glide by turns
      this.bglide[b] -= dt;
      if (this.bglide[b] <= 0) {
        this.bmode[b] ^= 1;
        this.bglide[b] = this.bmode[b] ? rand(0.7, 1.6) : rand(1.0, 2.4);
      }
      let target: number;
      if (this.bmode[b] === 0) {
        this.bph[b] += this.brate[b] * dt * TAU;
        target = 0.18 + 0.78 * Math.sin(this.bph[b]);
        this.bflap[b] = target;
      } else {
        target = 0.12;
        this.bflap[b] += (target - this.bflap[b]) * Math.min(1, 6 * dt);
      }
      const dx = this.fdx[k], dz = this.fdz[k];
      const along = this.fsp[k] * age + this.boa[b];
      const x = this.fsx[k] + dx * along - dz * this.bop[b];
      const z = this.fsz[k] + dz * along + dx * this.bop[b];
      const y = this.fh[k] + this.boh[b] + Math.sin(age * 1.4 + this.bbob[b]) * 0.12 - (this.bmode[b] ? 0.04 : 0);
      const yaw = Math.atan2(dx, dz) + Math.sin(age * 0.7 + this.bbob[b]) * 0.06;
      const bank = Math.sin(age * 0.9 + this.bbob[b] * 2) * 0.14;
      const pitch = this.bmode[b] === 0 ? Math.sin(this.bph[b]) * 0.04 : 0.03;
      this.e.set(pitch, yaw, bank, 'YXZ');
      this.q.setFromEuler(this.e);
      this.p.set(x, y, z);
      this.m.compose(this.p, this.q, this.s);
      this.m.toArray(arr, n * 16);
      this.flapArr[n] = this.bflap[b];
      n++;
    }
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    if (n > 0) {
      const im = this.mesh.instanceMatrix;
      im.clearUpdateRanges(); im.addUpdateRange(0, n * 16); im.needsUpdate = true;
      this.flapAttr.clearUpdateRanges(); this.flapAttr.addUpdateRange(0, n); this.flapAttr.needsUpdate = true;
    }
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geo.dispose();
    this.mat.dispose();
    this.depth.dispose();
  }
}
