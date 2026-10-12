/**
 * SpriteLayer: one pooled, instanced draw call of camera-facing (or
 * velocity-stretched, or ground-flat) quads that sample the sprite atlas.
 *
 * Particles live in struct-of-arrays typed buffers; spawning writes into the
 * next free slot, dying swaps the last live particle in. Each frame the
 * simulation and the GPU write happen in one pass, and only the live range of
 * each attribute is uploaded. Nothing in update() allocates.
 *
 * "Immediate" sprites (coin halos, lightning segments) are pushed for one
 * frame only and appended after the simulated ones.
 */
import * as THREE from 'three';
import { type FxFrame, BOARD_HX, BOARD_HZ, TAU } from './util';

// particle kinds (behaviour switches)
export const K_GENERIC = 0, K_SMOKE = 1, K_FIREFLY = 2, K_RAIN = 3;
// size curves
export const S_GROW = 0, S_POP = 1, S_PULSE = 2, S_CONST = 3;
// alpha curves (on top of the fade in / fade out envelope)
export const A_ENV = 0, A_THIN = 1, A_BLINK = 2;
// what happens at the board surface (y <= 0)
export const G_NONE = 0, G_DIE = 1, G_BOUNCE = 2, G_SETTLE = 3;
// how the quad is oriented
export const M_FACE = 0, M_STREAK = 1, M_FLAT = 2;

const VERT = /* glsl */`
uniform float uPx;       // world units per pixel at unit depth: 2 tan(fov / 2) / viewport height
attribute vec3 iPos;
attribute vec3 iVel;
attribute vec4 iShape;   // w, h, rot, flip
attribute vec4 iColor;   // linear rgb, alpha
attribute vec3 iMisc;    // frame, mode, tint
varying vec2 vUv;
varying vec4 vColor;
varying float vTint;
varying float vLod;
// texels across one atlas cell (512 / 4)
const float CELL = 128.0;
void main() {
  vec2 c = position.xy;
  float spanPx = 1.0;      // the quad's longer side on screen, in pixels
  float mode = iMisc.y;
  float alpha = iColor.a;
  vec4 mv;
  // Far from the camera a raindrop or a snow dot would shrink below a pixel
  // and shimmer away. Hold each quad at a minimum size on screen and pay for
  // the extra area with alpha, so a zoomed-out storm still reads as a veil.
  if (mode < 0.5) {
    mv = modelViewMatrix * vec4(iPos, 1.0);
    float m = min(iShape.x, iShape.y);
    float k = m > 1e-6 ? max(1.0, 2.4 * uPx * max(0.05, -mv.z) / m) : 1.0;
    alpha /= pow(k, 1.4);
    spanPx = max(iShape.x, iShape.y) * k / (uPx * max(0.05, -mv.z));
    float cs = cos(iShape.z), sn = sin(iShape.z);
    vec2 q = vec2(c.x * iShape.x * iShape.w, c.y * iShape.y) * k;
    mv.xy += vec2(q.x * cs - q.y * sn, q.x * sn + q.y * cs);
  } else if (mode < 1.5) {
    vec4 h = modelViewMatrix * vec4(iPos, 1.0);
    vec4 t = modelViewMatrix * vec4(iPos - iVel, 1.0);
    vec2 ax = h.xy - t.xy;
    float L = length(ax);
    vec2 d = L > 1e-5 ? ax / L : vec2(0.0, 1.0);
    // (n, d) must keep the quad's winding counter-clockwise on screen
    vec2 n = vec2(d.y, -d.x);
    float k = iShape.x > 1e-6 ? max(1.0, 3.2 * uPx * max(0.05, -h.z) / iShape.x) : 1.0;
    alpha /= pow(k, 0.8);
    spanPx = max(L + 2.0 * iShape.y * k, iShape.x * k) / (uPx * max(0.05, -h.z));
    mv = mix(t, h, c.y + 0.5);
    mv.xy += n * (c.x * iShape.x * k) + d * (c.y * iShape.y * k);
  } else {
    float cs = cos(iShape.z), sn = sin(iShape.z);
    vec2 q = vec2(c.x * iShape.x, c.y * iShape.y);
    // lying on the board, facing up: local y runs toward -z so the winding faces the sky
    mv = modelViewMatrix * vec4(iPos + vec3(q.x * cs - q.y * sn, 0.0, -(q.x * sn + q.y * cs)), 1.0);
    spanPx = max(iShape.x, iShape.y) / (uPx * max(0.05, -mv.z));
  }
  // Choose the mip level from the LONG side of the quad. Left to itself the
  // GPU picks it from the short side, and a raindrop three pixels wide samples
  // a mip so blurred its streak averages away to nothing.
  vLod = clamp(log2(CELL / max(1.0, spanPx)), 0.0, 4.5);
  gl_Position = projectionMatrix * mv;
  float f = iMisc.x + 0.01;
  vec2 cell = vec2(floor(mod(f, 4.0)), floor(f / 4.0));
  vUv = (cell + c + 0.5) * 0.25;
  vColor = vec4(iColor.rgb, alpha);
  vTint = iMisc.z;
}`;

const FRAG = /* glsl */`
uniform sampler2D uMap;
uniform vec3 uLight;
varying vec2 vUv;
varying vec4 vColor;
varying float vTint;
varying float vLod;
void main() {
  vec4 t = textureLod(uMap, vUv, vLod);
  float a = vColor.a * t.a;
  if (a < 0.003) discard;
  vec3 c = vColor.rgb * t.rgb * mix(vec3(1.0), uLight, vTint);
  gl_FragColor = vec4(c, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const IMM_FLOATS = 17;

export class SpriteLayer {
  readonly cap: number;
  n = 0;
  readonly mesh: THREE.Mesh;
  private geo: THREE.InstancedBufferGeometry;
  private mat: THREE.ShaderMaterial;
  private aPos: THREE.InstancedBufferAttribute;
  private aVel: THREE.InstancedBufferAttribute;
  private aShape: THREE.InstancedBufferAttribute;
  private aColor: THREE.InstancedBufferAttribute;
  private aMisc: THREE.InstancedBufferAttribute;
  private gPos: Float32Array; private gVel: Float32Array; private gShape: Float32Array; private gColor: Float32Array; private gMisc: Float32Array;

  // simulation state
  kind: Uint8Array; mode: Uint8Array; frame: Uint8Array; smode: Uint8Array; amode: Uint8Array; ground: Uint8Array; world: Uint8Array; bound: Uint8Array;
  x: Float32Array; y: Float32Array; z: Float32Array; vx: Float32Array; vy: Float32Array; vz: Float32Array;
  age: Float32Array; life: Float32Array; s0: Float32Array; s1: Float32Array; asp: Float32Array; rot: Float32Array; rotV: Float32Array;
  r: Float32Array; g: Float32Array; b: Float32Array; a: Float32Array;
  grav: Float32Array; drag: Float32Array; wind: Float32Array; swayA: Float32Array; swayF: Float32Array;
  twA: Float32Array; twF: Float32Array; seed: Float32Array; tint: Float32Array; fin: Float32Array; fout: Float32Array;
  len: Float32Array; aux: Float32Array; linger: Float32Array;

  private imm: Float32Array; private immN = 0; private immCap: number;
  /** called when a K_RAIN particle reaches the board (splash spawner) */
  onSplash: ((x: number, z: number, i: number) => void) | null = null;

  constructor(cap: number, atlas: THREE.Texture, light: THREE.Color, blending: THREE.Blending, renderOrder: number, immCap = 512,
    px: { value: number } = { value: 0.001 }) {
    this.cap = cap;
    this.immCap = immCap;
    const total = cap + immCap;
    const u8 = () => new Uint8Array(cap), f32 = () => new Float32Array(cap);
    this.kind = u8(); this.mode = u8(); this.frame = u8(); this.smode = u8(); this.amode = u8(); this.ground = u8(); this.world = u8(); this.bound = u8();
    this.x = f32(); this.y = f32(); this.z = f32(); this.vx = f32(); this.vy = f32(); this.vz = f32();
    this.age = f32(); this.life = f32(); this.s0 = f32(); this.s1 = f32(); this.asp = f32(); this.rot = f32(); this.rotV = f32();
    this.r = f32(); this.g = f32(); this.b = f32(); this.a = f32();
    this.grav = f32(); this.drag = f32(); this.wind = f32(); this.swayA = f32(); this.swayF = f32();
    this.twA = f32(); this.twF = f32(); this.seed = f32(); this.tint = f32(); this.fin = f32(); this.fout = f32();
    this.len = f32(); this.aux = f32(); this.linger = f32();
    this.imm = new Float32Array(immCap * IMM_FLOATS);

    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    const mk = (n: number) => {
      const at = new THREE.InstancedBufferAttribute(new Float32Array(total * n), n);
      at.setUsage(THREE.DynamicDrawUsage);
      return at;
    };
    this.aPos = mk(3); this.aVel = mk(3); this.aShape = mk(4); this.aColor = mk(4); this.aMisc = mk(3);
    this.gPos = this.aPos.array as Float32Array; this.gVel = this.aVel.array as Float32Array; this.gShape = this.aShape.array as Float32Array;
    this.gColor = this.aColor.array as Float32Array; this.gMisc = this.aMisc.array as Float32Array;
    geo.setAttribute('iPos', this.aPos); geo.setAttribute('iVel', this.aVel); geo.setAttribute('iShape', this.aShape);
    geo.setAttribute('iColor', this.aColor); geo.setAttribute('iMisc', this.aMisc);
    geo.instanceCount = 0;
    this.geo = geo;

    this.mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: atlas }, uLight: { value: light }, uPx: px },
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, depthTest: true, blending, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    this.mesh.visible = false;
    this.mesh.matrixAutoUpdate = false;
  }

  /**
   * Claim a particle slot with sensible defaults; returns -1 when the pool is
   * full (callers simply skip). Set the fields you need on the arrays.
   */
  spawn(kind: number, frame: number, mode: number, world: boolean): number {
    if (this.n >= this.cap) return -1;
    const i = this.n++;
    this.kind[i] = kind; this.frame[i] = frame; this.mode[i] = mode; this.world[i] = world ? 1 : 0;
    this.smode[i] = S_GROW; this.amode[i] = A_ENV; this.ground[i] = G_NONE; this.bound[i] = 0;
    this.vx[i] = 0; this.vy[i] = 0; this.vz[i] = 0;
    this.age[i] = 0; this.life[i] = 1; this.asp[i] = 1; this.rot[i] = 0; this.rotV[i] = 0;
    this.r[i] = 1; this.g[i] = 1; this.b[i] = 1; this.a[i] = 1;
    this.grav[i] = 0; this.drag[i] = 0; this.wind[i] = 0; this.swayA[i] = 0; this.swayF[i] = 1;
    this.twA[i] = 0; this.twF[i] = 0; this.seed[i] = Math.random(); this.tint[i] = 1; this.fin[i] = 0.1; this.fout[i] = 0.3;
    this.len[i] = 0; this.aux[i] = 0; this.linger[i] = 1;
    return i;
  }
  pos(i: number, x: number, y: number, z: number): void { this.x[i] = x; this.y[i] = y; this.z[i] = z; }
  vel(i: number, x: number, y: number, z: number): void { this.vx[i] = x; this.vy[i] = y; this.vz[i] = z; }
  size(i: number, s0: number, s1: number, asp = 1): void { this.s0[i] = s0; this.s1[i] = s1; this.asp[i] = asp; }
  col(i: number, rgb: ArrayLike<number>, o: number, a: number, tint: number): void {
    this.r[i] = rgb[o]; this.g[i] = rgb[o + 1]; this.b[i] = rgb[o + 2]; this.a[i] = a; this.tint[i] = tint;
  }
  fade(i: number, life: number, fin: number, fout: number): void { this.life[i] = life; this.fin[i] = fin; this.fout[i] = fout; }

  /** one-frame sprite (drawn this frame only) */
  push(x: number, y: number, z: number, tx: number, ty: number, tz: number, w: number, h: number, rot: number,
    r: number, g: number, b: number, a: number, frame: number, mode: number, tint: number): void {
    if (this.immN >= this.immCap) return;
    const o = this.immN++ * IMM_FLOATS, d = this.imm;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = tx; d[o + 4] = ty; d[o + 5] = tz;
    d[o + 6] = w; d[o + 7] = h; d[o + 8] = rot; d[o + 9] = r; d[o + 10] = g; d[o + 11] = b; d[o + 12] = a;
    d[o + 13] = frame; d[o + 14] = mode; d[o + 15] = tint;
  }

  private kill(i: number): void {
    const j = --this.n;
    if (i === j) return;
    this.kind[i] = this.kind[j]; this.mode[i] = this.mode[j]; this.frame[i] = this.frame[j]; this.smode[i] = this.smode[j];
    this.amode[i] = this.amode[j]; this.ground[i] = this.ground[j]; this.world[i] = this.world[j]; this.bound[i] = this.bound[j];
    this.x[i] = this.x[j]; this.y[i] = this.y[j]; this.z[i] = this.z[j]; this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j]; this.vz[i] = this.vz[j];
    this.age[i] = this.age[j]; this.life[i] = this.life[j]; this.s0[i] = this.s0[j]; this.s1[i] = this.s1[j]; this.asp[i] = this.asp[j];
    this.rot[i] = this.rot[j]; this.rotV[i] = this.rotV[j]; this.r[i] = this.r[j]; this.g[i] = this.g[j]; this.b[i] = this.b[j]; this.a[i] = this.a[j];
    this.grav[i] = this.grav[j]; this.drag[i] = this.drag[j]; this.wind[i] = this.wind[j]; this.swayA[i] = this.swayA[j]; this.swayF[i] = this.swayF[j];
    this.twA[i] = this.twA[j]; this.twF[i] = this.twF[j]; this.seed[i] = this.seed[j]; this.tint[i] = this.tint[j];
    this.fin[i] = this.fin[j]; this.fout[i] = this.fout[j]; this.len[i] = this.len[j]; this.aux[i] = this.aux[j]; this.linger[i] = this.linger[j];
  }

  /** Lay a particle down on the board: it stops, then fades over `linger` seconds. */
  private settle(i: number, size: number): void {
    this.y[i] = 0.015; this.vx[i] = 0; this.vy[i] = 0; this.vz[i] = 0;
    this.grav[i] = 0; this.wind[i] = 0; this.swayA[i] = 0; this.rotV[i] = 0;
    this.age[i] = 0; this.life[i] = this.linger[i]; this.fin[i] = 0; this.fout[i] = 0.7;
    this.ground[i] = G_NONE; this.smode[i] = S_CONST; this.s0[i] = size; this.s1[i] = size;
    this.amode[i] = A_ENV; this.len[i] = 0;
    if (this.mode[i] === M_STREAK) this.mode[i] = M_FACE;
  }

  private sizeAt(i: number, t: number): number {
    const s0 = this.s0[i], s1 = this.s1[i];
    switch (this.smode[i]) {
      case S_GROW: { const k = 1 - (1 - t) * (1 - t); return s0 + (s1 - s0) * k; }
      case S_POP: {
        const k = Math.min(1, Math.max(0, this.age[i]) / 0.24) - 1;
        const back = 1 + 2.70158 * k * k * k + 1.70158 * k * k;   // ease-out-back
        const tail = t > 0.78 ? 1 - ((t - 0.78) / 0.22) * 0.55 : 1;
        return s1 * back * tail;
      }
      case S_PULSE: return s0 + (s1 - s0) * Math.sin(Math.PI * Math.sqrt(t));
      default: return s0;
    }
  }

  update(f: FxFrame): void {
    const gP = this.gPos, gV = this.gVel, gS = this.gShape, gC = this.gColor, gM = this.gMisc;
    let i = 0;
    while (i < this.n) {
      const dt = this.world[i] ? f.dtW : f.dtR;
      const age = this.age[i] + dt;
      const life = this.life[i];
      if (age >= life) { this.kill(i); continue; }
      this.age[i] = age;
      if (age < 0) {
        // not born yet (staggered bursts): hold still, draw nothing
        const o3 = i * 3, o4 = i * 4;
        gP[o3] = this.x[i]; gP[o3 + 1] = this.y[i]; gP[o3 + 2] = this.z[i];
        gS[o4] = 0; gS[o4 + 1] = 0; gC[o4 + 3] = 0; gM[o3] = this.frame[i]; gM[o3 + 1] = M_FACE;
        i++; continue;
      }
      const t = age / life;
      const kind = this.kind[i];
      const seed = this.seed[i];
      let x: number, y: number, z: number;
      if (kind === K_FIREFLY) {
        // wander around an anchor kept in the velocity slots
        x = this.vx[i] + Math.sin(age * 0.37 + seed * 11) * 0.9 + Math.sin(age * 0.93 + seed * 3) * 0.32;
        z = this.vz[i] + Math.cos(age * 0.31 + seed * 7) * 0.9 + Math.sin(age * 0.81 + seed * 5) * 0.3;
        y = this.vy[i] + Math.sin(age * 0.55 + seed * 13) * 0.22;
      } else {
        let vx = this.vx[i], vy = this.vy[i] + this.grav[i] * dt, vz = this.vz[i];
        const dr = this.drag[i];
        if (dr > 0) { const d = Math.exp(-dr * dt); vx *= d; vy *= d; vz *= d; }
        this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
        x = this.x[i] + vx * dt; y = this.y[i] + vy * dt; z = this.z[i] + vz * dt;
        const w = this.wind[i];
        if (w !== 0) {
          const k = w * f.windS * dt * (kind === K_SMOKE ? 0.2 + 1.3 * t : 1);
          x += f.windX * k; z += f.windZ * k;
        }
        const sa = this.swayA[i];
        if (sa !== 0) {
          const ph = age * this.swayF[i] + seed * TAU;
          x += Math.cos(ph) * sa * dt;
          z += Math.sin(ph * 0.73 + 1.3) * sa * 0.7 * dt;
        }
        const gm = this.ground[i];
        if (gm !== G_NONE && y <= 0) {
          if (gm === G_DIE) {
            if (kind === K_RAIN && this.onSplash) this.onSplash(x, z, i);
            this.kill(i); continue;
          } else if (gm === G_BOUNCE) {
            y = 0.01;
            this.vy[i] = -vy * (0.3 + seed * 0.18); this.vx[i] = vx * 0.5 + (seed - 0.5) * 0.6; this.vz[i] = vz * 0.5 + (Math.sin(seed * 91) * 0.3);
            this.aux[i] += 1;
            if (this.aux[i] >= 3 || this.vy[i] < 0.25) { this.x[i] = x; this.z[i] = z; this.settle(i, this.sizeAt(i, t)); }
          } else {
            this.x[i] = x; this.z[i] = z;
            this.settle(i, this.sizeAt(i, t));
            y = 0.015;
          }
        }
        if (this.bound[i] && (x < -BOARD_HX || x > BOARD_HX || z < -BOARD_HZ || z > BOARD_HZ)) { this.kill(i); continue; }
        this.x[i] = x; this.y[i] = y; this.z[i] = z;
      }
      this.rot[i] += this.rotV[i] * dt;

      // ── size and alpha ──
      const tt = this.age[i] / this.life[i];        // settle() may have reset the clock
      const s = this.sizeAt(i, tt);
      let e = 1;
      const fin = this.fin[i], fout = this.fout[i];
      if (fin > 0 && tt < fin) { const k = tt / fin; e = k * k * (3 - 2 * k); }
      if (fout > 0 && tt > 1 - fout) { const k = (1 - tt) / fout; e *= k * k * (3 - 2 * k); }
      const am = this.amode[i];
      if (am === A_THIN) e *= (1 - tt) * (1.15 - 0.15 * tt);
      else if (am === A_BLINK) {
        const P = 2.1 + seed * 1.9;
        const ph = (this.age[i] + seed * 7) % P;
        const on = ph < 0.95 ? Math.sin(Math.PI * ph / 0.95) : 0;
        e *= 0.07 + 0.93 * on * on;
      }
      const tw = this.twA[i];
      if (tw > 0) e *= 1 - tw + tw * (0.5 + 0.5 * Math.sin(this.age[i] * this.twF[i] + seed * 40));

      // ── GPU write at this particle's final index ──
      const o3 = i * 3, o4 = i * 4;
      gP[o3] = x; gP[o3 + 1] = y; gP[o3 + 2] = z;
      const mode = this.mode[i];
      if (mode === M_STREAK) {
        const L = this.len[i];
        gV[o3] = this.vx[i] * L; gV[o3 + 1] = this.vy[i] * L; gV[o3 + 2] = this.vz[i] * L;
      }
      gS[o4] = s; gS[o4 + 1] = s * this.asp[i]; gS[o4 + 2] = this.rot[i]; gS[o4 + 3] = 1;
      gC[o4] = this.r[i]; gC[o4 + 1] = this.g[i]; gC[o4 + 2] = this.b[i]; gC[o4 + 3] = this.a[i] * e;
      gM[o3] = this.frame[i]; gM[o3 + 1] = mode; gM[o3 + 2] = this.tint[i];
      i++;
    }

    // ── immediates ──
    const n = this.n;
    const d = this.imm;
    for (let k = 0; k < this.immN; k++) {
      const o = k * IMM_FLOATS, j = n + k, o3 = j * 3, o4 = j * 4;
      gP[o3] = d[o]; gP[o3 + 1] = d[o + 1]; gP[o3 + 2] = d[o + 2];
      gV[o3] = d[o + 3]; gV[o3 + 1] = d[o + 4]; gV[o3 + 2] = d[o + 5];
      gS[o4] = d[o + 6]; gS[o4 + 1] = d[o + 7]; gS[o4 + 2] = d[o + 8]; gS[o4 + 3] = 1;
      gC[o4] = d[o + 9]; gC[o4 + 1] = d[o + 10]; gC[o4 + 2] = d[o + 11]; gC[o4 + 3] = d[o + 12];
      gM[o3] = d[o + 13]; gM[o3 + 1] = d[o + 14]; gM[o3 + 2] = d[o + 15];
    }
    const total = n + this.immN;
    this.immN = 0;
    this.geo.instanceCount = total;
    this.mesh.visible = total > 0;
    if (total > 0) {
      this.mark(this.aPos, total); this.mark(this.aVel, total); this.mark(this.aShape, total);
      this.mark(this.aColor, total); this.mark(this.aMisc, total);
    }
  }

  /** drop every particle at once (dev gallery, scene changes) */
  clear(): void { this.n = 0; this.immN = 0; }

  private mark(at: THREE.InstancedBufferAttribute, count: number): void {
    at.clearUpdateRanges();
    at.addUpdateRange(0, count * at.itemSize);
    at.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geo.dispose();
    this.mat.dispose();
  }
}
