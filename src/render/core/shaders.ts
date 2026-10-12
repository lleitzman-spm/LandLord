/**
 * Small patches onto MeshStandardMaterial (via onBeforeCompile) so the
 * terrain keeps three's lights and shadows but gains season, snow, wind and
 * water. One shared uniform set drives them all.
 */
import * as THREE from 'three';
import { PAL } from '../palette';

export interface TerrainUniforms {
  uTime: { value: number };
  uWind: { value: number };
  uSnow: { value: number };
  uSnowCol: { value: THREE.Color };
  uGrassA: { value: THREE.Color };
  uGrassB: { value: THREE.Color };
  uOwned: { value: Float32Array };
  /** x, z of the cursor in world space, strength, radius */
  uGrid: { value: THREE.Vector4 };
  uFrozen: { value: number };
}

export function makeTerrainUniforms(): TerrainUniforms {
  return {
    uTime: { value: 0 }, uWind: { value: 0.2 }, uSnow: { value: 0 }, uSnowCol: { value: new THREE.Color(PAL.snow) },
    uGrassA: { value: new THREE.Color(PAL.grassSpring) }, uGrassB: { value: new THREE.Color(PAL.grassSummer) },
    uOwned: { value: new Float32Array(12).fill(1) }, uGrid: { value: new THREE.Vector4(0, 0, 0, 6) }, uFrozen: { value: 0 },
  };
}

const NOISE = /* glsl */ `
float llHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float llNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(llHash(i), llHash(i + vec2(1.0, 0.0)), f.x), mix(llHash(i + vec2(0.0, 1.0)), llHash(i + vec2(1.0, 1.0)), f.x), f.y);
}`;

type Shader = { uniforms: Record<string, THREE.IUniform>; vertexShader: string; fragmentShader: string };
function chain(mat: THREE.Material, key: string, fn: (s: Shader) => void): void {
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.onBeforeCompile = (s, r) => { prev?.call(mat, s, r); fn(s as unknown as Shader); };
  mat.customProgramCacheKey = () => prevKey() + '|' + key;
  mat.needsUpdate = true;
}

/** the painted ground: season grass, furrows, parcel ownership, snow, and a faint tile grid near the cursor */
export function patchGround(mat: THREE.MeshStandardMaterial, u: TerrainUniforms): void {
  chain(mat, 'll-ground', s => {
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aMix;\nvarying vec4 vMix;\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMix = aMix;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec4 vMix; varying vec3 vWPos;
uniform vec3 uGrassA; uniform vec3 uGrassB; uniform vec3 uSnowCol; uniform float uSnow;
uniform float uOwned[12]; uniform vec4 uGrid;
${NOISE}
float llOwn(vec2 p) { p = clamp(p, vec2(0.0), vec2(3.0, 2.0)); return uOwned[int(p.y) * 4 + int(p.x)]; }`)
      .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
{
  vec2 wp = vWPos.xz;
  float n1 = llNoise(wp * 0.85 + 3.1);
  float n2 = llNoise(wp * 3.7 + 11.0);
  float fw = max(fwidth(wp.x), fwidth(wp.y));
  float fine = (llNoise(wp * 15.0) - 0.5) * (1.0 - smoothstep(0.015, 0.07, fw));
  vec3 grass = mix(uGrassA, uGrassB, clamp(vMix.y * 0.8 + n1 * 0.5 - 0.15, 0.0, 1.0));
  // broad drifts so a parcel is never one flat green: lighter rises, sun-dried and lusher patches
  float n0 = llNoise(wp * 0.23 + 17.3);
  grass *= 0.76 + 0.15 * n2 + 0.12 * fine + 0.18 * n0;
  grass = mix(grass, grass * vec3(1.13, 1.03, 0.78), smoothstep(0.5, 0.85, llNoise(wp * 0.47 + 31.0)) * 0.55);
  grass = mix(grass, grass * vec3(0.8, 0.96, 0.9), smoothstep(0.55, 0.9, llNoise(wp * 0.61 + 53.0)) * 0.5);
  vec3 c = mix(diffuseColor.rgb * (0.92 + 0.12 * n2 + 0.14 * fine), grass, vMix.x);
  // ploughed furrows on field tiles
  // tilled strips: each strip of a field its own colour (bare loam, straw, a green ley), ridge and furrow across it
  float strip = llHash(vec2(floor(wp.y * 1.5) + 0.37, floor((wp.x + 16.0) / 4.0) + 0.61));
  vec3 tilled = strip < 0.34 ? c * vec3(1.02, 0.98, 0.94) : strip < 0.67 ? mix(c, vec3(0.62, 0.5, 0.25), 0.42) : mix(c, grass * vec3(0.95, 1.0, 0.85), 0.5);
  tilled *= 1.08 + sin(wp.y * 18.8496) * 0.12 + 0.06 * (n2 - 0.5);
  c = mix(c, tilled, vMix.w);
  // lying snow, patchy as it comes and goes
  float sn = smoothstep(0.34, 0.66, uSnow * vMix.z * 1.3 + (n1 - 0.5) * 0.42 * (1.0 - uSnow * 0.6) + (n2 - 0.5) * 0.14);
  c = mix(c, uSnowCol * (0.93 + 0.07 * n2), sn);
  // land not yet bought lies dimmer and greyer
  // (cooler and a little dimmer, never dead), easing across the boundary over about a tile
  vec2 pf = (wp + vec2(16.0, 12.0)) / 8.0 - 0.5;
  vec2 p0 = floor(pf);
  vec2 pe = smoothstep(vec2(0.42), vec2(0.58), fract(pf) + (vec2(n2, n1) - 0.5) * 0.05);
  float own = mix(mix(llOwn(p0), llOwn(p0 + vec2(1.0, 0.0)), pe.x), mix(llOwn(p0 + vec2(0.0, 1.0)), llOwn(p0 + vec2(1.0, 1.0)), pe.x), pe.y);
  float lum = dot(c, vec3(0.3, 0.59, 0.11));
  c = mix(mix(vec3(lum), c, 0.86) * vec3(0.76, 0.86, 0.9), c, own);
  // the surveyor's grid, only where a tool is working
  if (uGrid.z > 0.001) {
    vec2 g = abs(fract(wp + 0.5) - 0.5);
    float line = 1.0 - smoothstep(0.0, max(0.022, fw * 1.6), min(g.x, g.y));
    float fall = 1.0 - smoothstep(uGrid.w * 0.35, uGrid.w, distance(wp, uGrid.xy));
    c = mix(c, vec3(1.0, 0.94, 0.78), line * fall * uGrid.z * 0.42);
  }
  diffuseColor.rgb = c;
}`);
  });
}

/** snow settles on whatever faces up (trees, rocks, fences) */
export function patchSnow(mat: THREE.MeshStandardMaterial, u: TerrainUniforms, amount = 1): void {
  chain(mat, 'll-snow' + amount, s => {
    s.uniforms.uSnow = u.uSnow; s.uniforms.uSnowCol = u.uSnowCol;
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSnow; uniform vec3 uSnowCol;')
      .replace('#include <normal_fragment_maps>', /* glsl */ `#include <normal_fragment_maps>
{
  vec3 llUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  float llS = smoothstep(0.12, 0.62, dot(normal, llUp)) * smoothstep(0.0, 0.75, uSnow) * ${amount.toFixed(2)};
  diffuseColor.rgb = mix(diffuseColor.rgb, uSnowCol, llS);
}`);
  });
}

/** trees and crops lean and shiver with the wind; phase comes from where the instance stands */
export function patchSway(mat: THREE.Material, u: TerrainUniforms, strength = 1): void {
  chain(mat, 'll-sway' + strength, s => {
    s.uniforms.uTime = u.uTime; s.uniforms.uWind = u.uWind;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind;')
      .replace('#include <begin_vertex>', /* glsl */ `#include <begin_vertex>
{
  #ifdef USE_INSTANCING
    vec2 llP = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
  #else
    vec2 llP = vec2(modelMatrix[3][0], modelMatrix[3][2]);
  #endif
  float llPh = llP.x * 0.71 + llP.y * 1.33;
  float llH = max(transformed.y, 0.0);
  float llK = llH * llH * (0.012 + uWind * 0.05) * ${strength.toFixed(2)};
  transformed.x += (sin(uTime * 1.7 + llPh) + 0.6 * sin(uTime * 3.1 + llPh * 1.9) + uWind * 1.2) * llK;
  transformed.z += (cos(uTime * 1.3 + llPh * 0.8) + 0.5 * sin(uTime * 2.7 + llPh * 2.3)) * llK * 0.7;
}`);
  });
}

/** the stream: a slow travelling shimmer on the normal, pale ice when it freezes */
export function patchWater(mat: THREE.MeshStandardMaterial, u: TerrainUniforms): void {
  chain(mat, 'll-water', s => {
    s.uniforms.uTime = u.uTime; s.uniforms.uFrozen = u.uFrozen;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWPos; uniform float uTime; uniform float uFrozen;\n${NOISE}`)
      .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
{
  vec2 p = vWPos.xz;
  float t = uTime * (1.0 - uFrozen);
  float band = sin(p.x * 2.3 + p.y * 5.1 - t * 0.8) * 0.5 + 0.5;
  diffuseColor.rgb *= 0.9 + 0.2 * band * (1.0 - uFrozen);
  vec3 ice = vec3(0.74, 0.84, 0.9) * (0.9 + 0.14 * llNoise(p * 4.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, ice, uFrozen * 0.88);
  diffuseColor.a = mix(diffuseColor.a, min(1.0, diffuseColor.a * 1.6), uFrozen);
}`)
      .replace('#include <normal_fragment_maps>', /* glsl */ `#include <normal_fragment_maps>
{
  vec2 p = vWPos.xz;
  float t = uTime * (1.0 - uFrozen);
  vec2 d = vec2(sin(p.x * 5.1 + t * 1.3) + sin(p.y * 7.3 - t * 0.9 + p.x * 2.0), cos(p.y * 4.7 + t * 1.1) + sin(p.x * 8.9 + t * 0.7 + p.y * 3.1));
  vec3 wn = normalize(vec3(d.x * 0.1 * (1.0 - uFrozen), 1.0, d.y * 0.1 * (1.0 - uFrozen)));
  normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
}`);
  });
}
