/**
 * The painted face that moves. One small mesh per figure: eyes, glints, brows,
 * mouth (and goblin teeth, and a blush) are flat patches of paint lying on the
 * head ball. Moving the paint is rewriting a few dozen vertices, and only when
 * something actually changed.
 *
 * Face space: the head is a unit ball, features are placed in (x, y) as seen
 * from the front and pressed onto the ball.
 */
import * as THREE from 'three';
import type { FaceLook } from './look';
import { clamp } from './util';

const EYE_N = 12, PUPIL_N = 8, CHEEK_N = 8, MOUTH_N = 6, TEETH = 5;
const _c = new THREE.Color();

export class Face {
  readonly mesh: THREE.Mesh;
  // ── what the animation layer sets every frame ──
  /** 0 open .. 1 shut */
  blink = 0;
  /** upper lid: 1 open, <1 heavy, >1 startled */
  lid = 1;
  /** 0 normal .. 1 smiling eyes (the lower lid rides up: little half moons) */
  smile = 0;
  gazeX = 0; gazeY = 0;
  browRaise = 0;
  /** + inner ends up (sad, worried), − inner ends down (cross) */
  browTilt = 0;
  /** one brow higher than the other (a shrug, a doubt) */
  browSkew = 0;
  mouthOpen = 0;
  /** + smile, − frown */
  mouthCurve = 0;
  /** 1 normal, <1 pursed */
  mouthWide = 1;

  private readonly look: FaceLook;
  private readonly pos: Float32Array;
  private readonly attr: THREE.BufferAttribute;
  private readonly last = new Float32Array(11).fill(999);
  private readonly oEye: number; private readonly oPupil: number; private readonly oGlint: number;
  private readonly oBrow: number; private readonly oMouth: number; private readonly oTeeth: number;

  constructor(look: FaceLook, material: THREE.Material) {
    this.look = look;
    const idx: number[] = [], col: number[] = [];
    let n = 0;
    const paint = (count: number, hex: number) => { _c.setHex(hex); for (let i = 0; i < count; i++) col.push(_c.r, _c.g, _c.b); };
    const fan = (count: number, hex: number): number => {
      const o = n; paint(count + 1, hex);
      for (let k = 0; k < count; k++) idx.push(o, o + 1 + k, o + 1 + ((k + 1) % count));
      n += count + 1; return o;
    };
    // cheeks (static)
    const cheeks: number[] = [];
    if (look.blush !== null) for (let s = 0; s < 2; s++) cheeks.push(fan(CHEEK_N, look.blush));
    this.oEye = n; for (let s = 0; s < 2; s++) fan(EYE_N, look.eyeColor);
    this.oPupil = n; if (look.pupil !== null) for (let s = 0; s < 2; s++) fan(PUPIL_N, look.pupil);
    this.oGlint = n; if (look.glint > 0) for (let s = 0; s < 2; s++) fan(4, 0xffffff);
    this.oBrow = n;
    for (let s = 0; s < 2; s++) { paint(4, look.browColor); idx.push(n, n + 1, n + 2, n, n + 2, n + 3); n += 4; }
    this.oMouth = n;
    paint((MOUTH_N + 1) * 2, look.mouthColor);
    for (let k = 0; k < MOUTH_N; k++) { const a = n + k * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    n += (MOUTH_N + 1) * 2;
    this.oTeeth = n;
    if (look.teeth) { paint(TEETH * 3, 0xf6f1e0); for (let k = 0; k < TEETH; k++) idx.push(n + k * 3, n + k * 3 + 1, n + k * 3 + 2); n += TEETH * 3; }

    this.pos = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(this.pos, 3);
    this.attr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.attr);
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
    g.setIndex(idx);
    // static cheeks
    for (let s = 0; s < cheeks.length; s++) {
      const sx = s ? 1 : -1, o = cheeks[s]!;
      this.put(o, sx * (look.eyeX + 0.2), look.eyeY - 0.33, 1.012);
      for (let k = 0; k < CHEEK_N; k++) { const a = k / CHEEK_N * Math.PI * 2; this.put(o + 1 + k, sx * (look.eyeX + 0.2) + Math.cos(a) * 0.125, look.eyeY - 0.33 + Math.sin(a) * 0.095, 1.012); }
    }
    this.write();
    // paint lies on the ball: the normal is the direction from the centre
    const nor = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = this.pos[i * 3]!, y = this.pos[i * 3 + 1]!, z = this.pos[i * 3 + 2]!, l = Math.hypot(x, y, z) || 1;
      nor[i * 3] = x / l; nor[i * 3 + 1] = y / l; nor[i * 3 + 2] = z / l;
    }
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0.6), 1.1);
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.castShadow = false; this.mesh.receiveShadow = true;
  }

  /** press a face-plane point onto the ball, `lift` just proud of the surface */
  private put(i: number, x: number, y: number, lift: number): void {
    const d = x * x + y * y;
    const z = Math.sqrt(d < 0.96 ? 1 - d : 0.04);
    const p = this.pos, o = i * 3;
    p[o] = x * lift; p[o + 1] = y * lift; p[o + 2] = z * lift;
  }

  /** push the current expression into the mesh, if it differs from what is showing */
  update(): void {
    const l = this.last;
    const v0 = this.blink, v1 = this.lid, v2 = this.smile, v3 = this.gazeX, v4 = this.gazeY, v5 = this.browRaise, v6 = this.browTilt, v7 = this.mouthOpen, v8 = this.mouthCurve, v9 = this.mouthWide, v10 = this.browSkew;
    const e = 0.006;
    if (Math.abs(v0 - l[0]!) < e && Math.abs(v1 - l[1]!) < e && Math.abs(v2 - l[2]!) < e && Math.abs(v3 - l[3]!) < e && Math.abs(v4 - l[4]!) < e && Math.abs(v5 - l[5]!) < e
      && Math.abs(v6 - l[6]!) < e && Math.abs(v7 - l[7]!) < e && Math.abs(v8 - l[8]!) < e && Math.abs(v9 - l[9]!) < e && Math.abs(v10 - l[10]!) < e) return;
    l[0] = v0; l[1] = v1; l[2] = v2; l[3] = v3; l[4] = v4; l[5] = v5; l[6] = v6; l[7] = v7; l[8] = v8; l[9] = v9; l[10] = v10;
    this.write();
    this.attr.needsUpdate = true;
  }

  private write(): void {
    const k = this.look;
    const blink = clamp(this.blink, 0, 1);
    const smile = clamp(this.smile, 0, 1) * (1 - blink);
    // lids: the top comes down to blink, the bottom rides up to smile
    const up = Math.max(0.05, clamp(this.lid * k.lid, 0.1, 1.35) * (1 - blink * 0.95));
    const low = (1 - blink * 0.72) * (1 - smile);
    const gx = clamp(this.gazeX, -1, 1) * 0.055, gy = clamp(this.gazeY, -1, 1) * 0.045 - smile * 0.02;
    let o = this.oEye;
    for (let s = 0; s < 2; s++) {
      const sx = s ? 1 : -1, cx = sx * k.eyeX + gx, cy = k.eyeY + gy;
      this.put(o, cx, cy, 1.016);
      for (let i = 0; i < EYE_N; i++) {
        const a = i / EYE_N * Math.PI * 2, sn = Math.sin(a);
        this.put(o + 1 + i, cx + Math.cos(a) * k.eyeW, cy + sn * k.eyeH * (sn >= 0 ? up : low), 1.016);
      }
      o += EYE_N + 1;
    }
    if (k.pupil !== null) {
      o = this.oPupil;
      const ph = k.eyeH * 0.82 * Math.min(1, (up + Math.max(low, 0)) * 0.5 + 0.05) * (1 - smile);
      for (let s = 0; s < 2; s++) {
        const sx = s ? 1 : -1, cx = sx * k.eyeX + gx * 2.1, cy = k.eyeY + gy * 1.8;
        this.put(o, cx, cy, 1.022);
        for (let i = 0; i < PUPIL_N; i++) { const a = i / PUPIL_N * Math.PI * 2; this.put(o + 1 + i, cx + Math.cos(a) * k.eyeW * 0.36, cy + Math.sin(a) * ph, 1.022); }
        o += PUPIL_N + 1;
      }
    }
    if (k.glint > 0) {
      o = this.oGlint;
      const gs = k.glint * clamp((up - 0.3) * 2.2, 0, 1) * (1 - smile);
      for (let s = 0; s < 2; s++) {
        const sx = s ? 1 : -1, cx = sx * k.eyeX + gx + k.eyeW * 0.32, cy = k.eyeY + gy + k.eyeH * 0.36 * Math.min(up, 1);
        this.put(o, cx, cy, 1.028);
        this.put(o + 1, cx + gs, cy, 1.028); this.put(o + 2, cx, cy + gs, 1.028); this.put(o + 3, cx - gs, cy, 1.028); this.put(o + 4, cx, cy - gs, 1.028);
        o += 5;
      }
    }
    // brows
    o = this.oBrow;
    const tilt = k.browTilt + this.browTilt;
    for (let s = 0; s < 2; s++) {
      const sx = s ? 1 : -1;
      const raise = this.browRaise * 0.085 + sx * this.browSkew * 0.05 - blink * 0.02;
      const yb = k.eyeY + k.browY + raise + smile * 0.02;
      const xi = sx * (k.eyeX - k.browLen * 0.9), xo = sx * (k.eyeX + k.browLen * 1.05);
      const yi = yb + tilt * 0.085, yo = yb - tilt * 0.05;
      const t = k.browT;
      this.put(o, xi, yi - t, 1.02); this.put(o + 1, xo, yo - t * 0.7, 1.02); this.put(o + 2, xo, yo + t * 0.7, 1.02); this.put(o + 3, xi, yi + t, 1.02);
      if (sx < 0) {   // keep the winding facing out on the mirrored side
        const p = this.pos, a = (o + 1) * 3, b = (o + 3) * 3;
        for (let j = 0; j < 3; j++) { const tmp = p[a + j]!; p[a + j] = p[b + j]!; p[b + j] = tmp; }
      }
      o += 4;
    }
    // mouth: a ribbon from corner to corner, fat in the middle when open
    o = this.oMouth;
    const open = clamp(k.open + this.mouthOpen, 0, 1.2), curve = clamp(k.curve + this.mouthCurve, -1.2, 1.2);
    const w = k.mouthW * clamp(this.mouthWide, 0.3, 1.4) * (1 + Math.max(0, curve) * 0.12);
    for (let i = 0; i <= MOUTH_N; i++) {
      const t = i / MOUTH_N * 2 - 1, q = 1 - t * t;
      const yc = k.mouthY + curve * 0.085 * (t * t - 0.45);
      const th = 0.02 * (0.45 + 0.55 * q);
      this.put(o + i * 2, t * w, yc + th + open * 0.035 * q, 1.016);
      this.put(o + i * 2 + 1, t * w, yc - th - open * 0.15 * Math.pow(q, 0.8), 1.016);
    }
    if (k.teeth) {
      o = this.oTeeth;
      const th = Math.min(0.085, open * 0.13 + 0.012);
      for (let i = 0; i < TEETH; i++) {
        const t0 = (i / TEETH) * 1.5 - 0.75, t1 = ((i + 1) / TEETH) * 1.5 - 0.75, tm = (t0 + t1) / 2;
        const y = (t: number) => k.mouthY + curve * 0.085 * (t * t - 0.45) + 0.02 * (0.45 + 0.55 * (1 - t * t)) + open * 0.035 * (1 - t * t) - 0.008;
        this.put(o + i * 3, t0 * w, y(t0), 1.024); this.put(o + i * 3 + 1, tm * w, y(tm) - th, 1.024); this.put(o + i * 3 + 2, t1 * w, y(t1), 1.024);
      }
    }
  }

  dispose(): void { this.mesh.geometry.dispose(); }
}
