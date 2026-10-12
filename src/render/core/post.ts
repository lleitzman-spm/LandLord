/**
 * The finish. The scene renders in linear HDR into a multisampled target with
 * mipmaps; a small bright-pass feeds the bloom; then ONE full-screen pass does
 * the miniature lens: tilt-shift blur growing toward the top and bottom of the
 * frame, bloom on flames and lit windows, ACES, a warm grade, vignette, grain.
 */
import * as THREE from 'three';
import type { Quality } from '../api';

export interface PostParams {
  /** uv height (0 bottom .. 1 top) of the sharp line: where the camera target sits */
  focusY: number;
  /** half-height of the fully sharp band, in uv */
  band: number;
  /** how far past the band the blur takes to reach full strength, in uv */
  feather: number;
  /** blur radius at full strength, as a fraction of the frame height */
  blur: number;
  bloom: number;
  /** bright-pass threshold (linear HDR) */
  threshold: number;
  vignette: number;
  grain: number;
  time: number;
}

/**
 * The scene is kept in linear HDR, and a float target keeps a NaN where an 8-bit canvas would
 * quietly show black; the blur and bloom then spread it. One bad pixel from any piece on the
 * table must not do that, so every built-in material's last chunk drops non-finite colour.
 */
const NAN_GUARD = '\n#ifndef LL_FINITE\n#define LL_FINITE\n#endif\nif (any(isnan(gl_FragColor.rgb)) || any(isinf(gl_FragColor.rgb))) gl_FragColor.rgb = vec3(0.0);\n';
if (!THREE.ShaderChunk.dithering_fragment.includes('LL_FINITE')) THREE.ShaderChunk.dithering_fragment += NAN_GUARD;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const BRIGHT = /* glsl */ `
uniform sampler2D tScene;
uniform vec2 uTexel;
uniform float uThreshold;
varying vec2 vUv;
vec3 pre(vec2 uv) { vec3 c = textureLod(tScene, uv, 1.0).rgb; if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0); return c / (1.0 + max(c.r, max(c.g, c.b)) * 0.12); }
void main() {
  // four taps of the half-res mip: a wide, firefly-safe prefilter
  vec3 c = 0.25 * (pre(vUv + uTexel * vec2(-1.0, -1.0)) + pre(vUv + uTexel * vec2(1.0, -1.0)) + pre(vUv + uTexel * vec2(-1.0, 1.0)) + pre(vUv + uTexel * vec2(1.0, 1.0)));
  float l = max(c.r, max(c.g, c.b));
  float knee = uThreshold * 0.5;
  float soft = clamp(l - uThreshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-4);
  float k = max(soft, l - uThreshold) / max(l, 1e-4);
  gl_FragColor = vec4(min(c * k, vec3(12.0)), 1.0);
}`;

const COMPOSITE = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform vec2 uRes;
uniform float uFocusY, uBand, uFeather, uBlur, uBloom, uVignette, uGrain, uTime;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
vec3 tent(float lod) {
  vec2 o = exp2(lod) * 0.5 / (uRes * 0.5);
  return 0.25 * (textureLod(tBloom, vUv + o * vec2(-1.0, -1.0), lod).rgb + textureLod(tBloom, vUv + o * vec2(1.0, -1.0), lod).rgb
               + textureLod(tBloom, vUv + o * vec2(-1.0, 1.0), lod).rgb + textureLod(tBloom, vUv + o * vec2(1.0, 1.0), lod).rgb);
}
void main() {
  // ── tilt-shift: a disc blur whose radius grows away from the focus band
  float d = abs(vUv.y - uFocusY);
  float amt = smoothstep(uBand, uBand + uFeather, d);
  float r = amt * uBlur * uRes.y;                 // radius in pixels
  vec3 col;
  if (r < 0.6) {
    col = texture2D(tScene, vUv).rgb;
  } else {
    float lod = clamp(log2(r * 0.42), 0.0, 4.0);  // each tap covers the gap to the next
    float rot = hash(gl_FragCoord.xy) * 6.2832;
    vec3 acc = textureLod(tScene, vUv, lod).rgb;
    float wsum = 1.0;
    for (int i = 0; i < TAPS; i++) {
      float fi = float(i) + 0.5;
      float rr = sqrt(fi / float(TAPS));
      float a = fi * 2.39996 + rot;
      vec2 o = vec2(cos(a), sin(a)) * rr * r / uRes;
      acc += textureLod(tScene, vUv + o, lod).rgb;
      wsum += 1.0;
    }
    col = acc / wsum;
  }
  // ── bloom: flames, lit windows, sun on snow
  vec3 bloom = tent(0.0) * 0.2 + tent(1.0) * 0.26 + tent(2.0) * 0.24 + tent(3.0) * 0.18 + tent(4.0) * 0.12;
  col += bloom * uBloom;

  if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  vec3 c = clamp(gl_FragColor.rgb, 0.0, 1.0);
  // ── the grade: a candle's warmth in the mids, a gentle S, cool in the deepest darks
  c = mix(c, c * vec3(1.05, 1.0, 0.925), 0.55);
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.2);
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c += vec3(0.004, 0.007, 0.016) * (1.0 - smoothstep(0.0, 0.3, lum));
  // ── vignette: the room swallows the corners
  vec2 q = (vUv - 0.5) * vec2(mix(1.0, uRes.x / uRes.y, 0.35), 1.0);
  float vig = smoothstep(0.38, 1.0, length(q) * 1.18);
  c *= 1.0 - vig * uVignette;
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
  // ── a touch of grain, in display space
  float g = hash(gl_FragCoord.xy + fract(uTime) * 61.7) - 0.5;
  gl_FragColor.rgb += g * uGrain * (0.55 + 0.45 * (1.0 - lum));
}`;

export class Post {
  readonly supported: boolean;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private tri: THREE.Mesh;
  private rt: THREE.WebGLRenderTarget | null = null;
  private bright: THREE.WebGLRenderTarget | null = null;
  private brightMat: THREE.ShaderMaterial;
  private compMat: THREE.ShaderMaterial;
  private w = 0;
  private h = 0;
  private samples = 4;
  private taps = 16;

  constructor(private renderer: THREE.WebGLRenderer, quality: Quality) {
    const gl = renderer.getContext();
    const isGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    this.supported = isGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.brightMat = new THREE.ShaderMaterial({
      uniforms: { tScene: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1 } },
      vertexShader: VERT, fragmentShader: BRIGHT, depthTest: false, depthWrite: false, toneMapped: false,
    });
    this.compMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null }, tBloom: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
        uFocusY: { value: 0.5 }, uBand: { value: 0.2 }, uFeather: { value: 0.3 }, uBlur: { value: 0.01 },
        uBloom: { value: 0.5 }, uVignette: { value: 0.5 }, uGrain: { value: 0.03 }, uTime: { value: 0 },
      },
      defines: { TAPS: 16 },
      vertexShader: VERT, fragmentShader: COMPOSITE, depthTest: false, depthWrite: false,
    });
    this.tri = new THREE.Mesh(geo, this.compMat);
    this.tri.frustumCulled = false;
    this.scene.add(this.tri);
    this.setQuality(quality);
  }

  setQuality(q: Quality): void {
    const samples = q === 'high' ? 4 : 2, taps = q === 'high' ? 16 : 9;
    if (taps !== this.taps) { this.taps = taps; this.compMat.defines.TAPS = taps; this.compMat.needsUpdate = true; }
    if (samples !== this.samples) { this.samples = samples; this.disposeTargets(); }
  }

  setSize(w: number, h: number): void {
    w = Math.max(2, Math.floor(w)); h = Math.max(2, Math.floor(h));
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.disposeTargets();
  }

  private ensure(): void {
    if (this.rt) return;
    const mk = (w: number, h: number, samples: number, depth: boolean) => {
      const t = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, samples, depthBuffer: depth, stencilBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
      t.texture.colorSpace = THREE.LinearSRGBColorSpace;
      return t;
    };
    this.rt = mk(this.w, this.h, this.samples, true);
    this.bright = mk(Math.max(2, this.w >> 1), Math.max(2, this.h >> 1), 0, false);
  }

  private disposeTargets(): void {
    this.rt?.dispose(); this.bright?.dispose();
    this.rt = null; this.bright = null;
  }

  render(scene: THREE.Scene, camera: THREE.Camera, p: PostParams): void {
    this.ensure();
    const r = this.renderer, rt = this.rt!, bright = this.bright!;
    r.setRenderTarget(rt);
    r.render(scene, camera);
    // bright pass → half-res target (its mips are the bloom pyramid)
    this.tri.material = this.brightMat;
    this.brightMat.uniforms.tScene!.value = rt.texture;
    (this.brightMat.uniforms.uTexel!.value as THREE.Vector2).set(1 / this.w, 1 / this.h);
    this.brightMat.uniforms.uThreshold!.value = p.threshold;
    r.setRenderTarget(bright);
    r.render(this.scene, this.cam);
    // the one finishing pass, to the screen
    const u = this.compMat.uniforms;
    this.tri.material = this.compMat;
    u.tScene!.value = rt.texture; u.tBloom!.value = bright.texture;
    (u.uRes!.value as THREE.Vector2).set(this.w, this.h);
    u.uFocusY!.value = p.focusY; u.uBand!.value = p.band; u.uFeather!.value = p.feather; u.uBlur!.value = p.blur;
    u.uBloom!.value = p.bloom; u.uVignette!.value = p.vignette; u.uGrain!.value = p.grain; u.uTime!.value = p.time;
    r.setRenderTarget(null);
    r.render(this.scene, this.cam);
  }

  dispose(): void {
    this.disposeTargets();
    this.tri.geometry.dispose();
    this.brightMat.dispose(); this.compMat.dispose();
  }
}
