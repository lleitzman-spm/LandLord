/**
 * Tilt-shift and the final grade — built EARLY, per the writ (§3.1): the
 * blur is not polish, it is what makes low-poly relief read as a small real
 * object photographed close. Two blur passes (horizontal, vertical) whose
 * radius grows away from a focus band, then the output tone-map, then a
 * grade: vignette into the room's darkness, a breath of warmth, film grain.
 *
 * Rendering runs through an EffectComposer; a positive-priority useFrame
 * takes over the loop from react-three-fiber.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const BLUR_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** 13-tap gaussian whose radius scales with distance from the focus band. */
const BLUR_FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 direction;      // (1,0) or (0,1), in texels
  uniform vec2 resolution;
  uniform float focus;         // uv y of the sharp line
  uniform float band;          // half-width of the fully sharp band
  uniform float feather;       // fade-out beyond the band
  uniform float maxBlur;       // max radius in px
  varying vec2 vUv;

  void main() {
    float d = abs(vUv.y - focus);
    float amt = smoothstep(band, band + feather, d) * maxBlur;
    vec2 step = direction / resolution * amt;
    vec4 sum = vec4(0.0);
    sum += texture2D(tDiffuse, vUv - 6.0 * step) * 0.002216;
    sum += texture2D(tDiffuse, vUv - 5.0 * step) * 0.008764;
    sum += texture2D(tDiffuse, vUv - 4.0 * step) * 0.026995;
    sum += texture2D(tDiffuse, vUv - 3.0 * step) * 0.064759;
    sum += texture2D(tDiffuse, vUv - 2.0 * step) * 0.120985;
    sum += texture2D(tDiffuse, vUv - 1.0 * step) * 0.176033;
    sum += texture2D(tDiffuse, vUv) * 0.199471;
    sum += texture2D(tDiffuse, vUv + 1.0 * step) * 0.176033;
    sum += texture2D(tDiffuse, vUv + 2.0 * step) * 0.120985;
    sum += texture2D(tDiffuse, vUv + 3.0 * step) * 0.064759;
    sum += texture2D(tDiffuse, vUv + 4.0 * step) * 0.026995;
    sum += texture2D(tDiffuse, vUv + 5.0 * step) * 0.008764;
    sum += texture2D(tDiffuse, vUv + 6.0 * step) * 0.002216;
    gl_FragColor = sum;
  }
`;

/** After tone-mapping: vignette to darkness, warm lift, grain. */
const GRADE_FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float time;
  uniform float grain;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec4 c = texture2D(tDiffuse, vUv);
    // vignette — the room swallows the table's far corners, but the model
    // now fills the frame, so the darkness stays OUT at the rim (the first
    // pass let it eat a third of the frame — §1.1)
    vec2 q = vUv - vec2(0.5, 0.5);
    q.x *= 1.26;
    float vig = 1.0 - smoothstep(0.48, 1.12, length(q));
    c.rgb *= mix(0.42, 1.0, vig);
    // a candle's breath of warmth in the mids
    c.rgb = mix(c.rgb, c.rgb * vec3(1.045, 1.0, 0.94), 0.55);
    // gentle S-curve
    c.rgb = c.rgb * c.rgb * (3.0 - 2.0 * c.rgb) * 0.35 + c.rgb * 0.65;
    // the room's cool fill in the deepest darks — one consistent night
    // blue, never a crushed void and never a warm/magenta drift
    float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
    c.rgb += vec3(0.012, 0.018, 0.038) * (1.0 - smoothstep(0.0, 0.4, lum));
    // grain
    float g = (hash(vUv * vec2(1920.0, 1080.0) + fract(time) * 61.7) - 0.5) * grain;
    c.rgb += g;
    gl_FragColor = c;
  }
`;

export interface TiltShiftProps {
  /** uv height of the sharp line (0 bottom, 1 top). */
  focus?: number;
  /** Half-width of the fully sharp band. */
  band?: number;
  feather?: number;
  maxBlur?: number;
  grain?: number;
}

/**
 * Defaults re-tuned against the no-DoF control (the reviewer's A/B): the
 * SHARP BAND SITS ON THE SUBJECT — wide enough that the escarpment texture,
 * the river valleys and the pieces stay readable — and the blur is spent
 * where it sells the miniature: the near table edge and the far rim.
 */
export function TiltShift({
  focus = 0.52,
  band = 0.26,
  feather = 0.24,
  maxBlur = 2.6,
  grain = 0.035,
}: TiltShiftProps) {
  const { gl, scene, camera, size } = useThree();
  const timeRef = useRef(0);

  const rig = useMemo(() => {
    // MSAA + half-float: the composer must not throw away the canvas's own
    // antialias (a coarse target smeared mesh-edge stipple into a dotted
    // line along the board's far silhouette), and blurring in HDR lets hot
    // pixels bloom into small discs instead of grey mush.
    const target = new THREE.WebGLRenderTarget(1, 1, {
      samples: 4,
      type: THREE.HalfFloatType,
    });
    const composer = new EffectComposer(gl, target);
    composer.addPass(new RenderPass(scene, camera));
    const mk = (dir: [number, number]) =>
      new ShaderPass({
        uniforms: {
          tDiffuse: { value: null },
          direction: { value: new THREE.Vector2(...dir) },
          resolution: { value: new THREE.Vector2(1, 1) },
          focus: { value: focus },
          band: { value: band },
          feather: { value: feather },
          maxBlur: { value: maxBlur },
        },
        vertexShader: BLUR_VERT,
        fragmentShader: BLUR_FRAG,
      });
    const h = mk([1, 0]);
    const v = mk([0, 1]);
    composer.addPass(h);
    composer.addPass(v);
    composer.addPass(new OutputPass());
    const grade = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        time: { value: 0 },
        grain: { value: grain },
      },
      vertexShader: BLUR_VERT,
      fragmentShader: GRADE_FRAG,
    });
    composer.addPass(grade);
    return { composer, h, v, grade };
  }, [gl, scene, camera, focus, band, feather, maxBlur, grain]);

  useEffect(() => {
    const pr = gl.getPixelRatio();
    rig.composer.setPixelRatio(pr);
    rig.composer.setSize(size.width, size.height);
    const res = new THREE.Vector2(size.width * pr, size.height * pr);
    (rig.h.uniforms.resolution.value as THREE.Vector2).copy(res);
    (rig.v.uniforms.resolution.value as THREE.Vector2).copy(res);
  }, [rig, gl, size]);

  useEffect(() => () => rig.composer.dispose(), [rig]);

  useFrame((_, delta) => {
    timeRef.current += delta;
    rig.grade.uniforms.time.value = timeRef.current;
    rig.composer.render();
  }, 1);

  return null;
}
