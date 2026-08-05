/**
 * The relief's paint — the model-maker's brush over the REAL ground.
 *
 * Takes the loaded Northreach relief and paints one canvas texture in the manner
 * of a hand-painted terrain board: green river plain, drier olive uplands,
 * cedar-dark mottle on the Balcones rim, faint contour lines (the model
 * maker's layers showing through the paint), and the rivers as slate
 * ribbons snapped to the true valleys. No data is invented — every stroke
 * follows the baked elevation.
 */

import * as THREE from 'three';
import type { Relief } from './relief';
import { RIVER_COURSES, snappedCourse } from './relief';
import { T, mix, lighten, darken } from './palette';

// ── Small deterministic value noise (paint mottle only) ───────────────────

function latticeHash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = latticeHash(x0, y0) * (1 - sx) + latticeHash(x0 + 1, y0) * sx;
  const b = latticeHash(x0, y0 + 1) * (1 - sx) + latticeHash(x0 + 1, y0 + 1) * sx;
  return a * (1 - sy) + b * sy;
}

function hexToRgb(hex: string): [number, number, number] {
  const c = new THREE.Color(hex);
  return [c.r * 255, c.g * 255, c.b * 255];
}

export function paintTerrainTexture(relief: Relief, size = 1024): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const px = img.data;

  const valley = hexToRgb(T.valleyGreen);
  const plain = hexToRgb(T.plainGreen);
  const plainWarm = hexToRgb(mix(T.plainGreen, lighten(T.plainGreen, 0.05), 1));
  const upland = hexToRgb(T.uplandDry);
  const cedar = hexToRgb(T.cedarDark);
  // field tones for the lowland patchwork
  const hay = hexToRgb(mix(T.uplandDry, T.plainGreen, 0.35));
  const pasture = hexToRgb(darken(T.plainGreen, 0.045));
  const span = relief.maxElev - relief.minElev;

  const lerp3 = (a: number[], b: number[], t: number): [number, number, number] => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];

  for (let y = 0; y < size; y++) {
    const v = y / (size - 1);
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const e = relief.sample(u, v);
      const e01 = (e - relief.minElev) / span;

      // Paint bands over real elevation
      let rgb: [number, number, number];
      if (e01 < 0.16) rgb = lerp3(valley, plain, e01 / 0.16);
      else if (e01 < 0.42) rgb = lerp3(plain, plainWarm, (e01 - 0.16) / 0.26);
      else if (e01 < 0.66) rgb = lerp3(plainWarm, upland, (e01 - 0.42) / 0.24);
      else rgb = lerp3(upland, cedar, Math.min(1, (e01 - 0.66) / 0.3) * 0.75);

      // The patchwork of the worked lowlands — hay squares and deeper
      // pasture on a surveyor's grid set 20° off the frame, fading out
      // where the ground climbs. The first paint left the whole southern
      // plain one flat olive; a model maker would never leave it bare.
      if (e01 < 0.45) {
        const ur = u * 0.94 - v * 0.34;
        const vr = u * 0.34 + v * 0.94;
        const cellId = latticeHash(Math.floor(ur * 26) + 217, Math.floor(vr * 26) + 91);
        const worked = valueNoise(u * 6 + 91, v * 6 + 7);
        const strength =
          (worked < 0.42 ? 0 : Math.min(1, (worked - 0.42) / 0.18)) *
          (1 - Math.min(1, Math.max(0, (e01 - 0.34) / 0.11)));
        if (strength > 0) {
          if (cellId < 0.3) rgb = lerp3(rgb, hay, 0.34 * strength);
          else if (cellId > 0.72) rgb = lerp3(rgb, pasture, 0.3 * strength);
        }
      }

      // Cedar brake mottle on the high ground — the escarpment's dark scrub
      if (e01 > 0.5) {
        const n = valueNoise(u * 90, v * 90) * 0.65 + valueNoise(u * 220, v * 220) * 0.35;
        const brake = Math.max(0, n - 0.52) * Math.min(1, (e01 - 0.5) / 0.2) * 2.2;
        rgb = lerp3(rgb, cedar, Math.min(0.85, brake));
      }

      // The brush's own mottle — no field of one flat green
      const m = valueNoise(u * 46 + 7, v * 46 + 3) * 0.6 + valueNoise(u * 150 + 31, v * 150 + 11) * 0.4;
      const mm = 0.9 + m * 0.2;

      // Contour lines every 50 m — the model's layers under the paint
      const c = Math.abs(((e / 50) % 1 + 1) % 1 - 0.5);
      const contour = c > 0.455 ? 0.9 : 1;

      // Painted slope shading — the model maker paints his shadows east of
      // every rise, as the lamp will light from the west
      const eE = relief.sample(u + 2 / size, v);
      const eS = relief.sample(u, v + 2 / size);
      const shade = 1 - Math.max(-0.4, Math.min(0.4, ((eE - e) + (e - eS)) * 0.028));

      const i = (y * size + x) * 4;
      px[i] = rgb[0] * mm * contour * shade;
      px[i + 1] = rgb[1] * mm * contour * shade;
      px[i + 2] = rgb[2] * mm * contour * shade;
      px[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // ── The rivers — slate ribbons in the true valleys ──────────────────────
  for (const course of RIVER_COURSES) {
    const pts = snappedCourse(relief, course.pts, 120);
    const trace = (width: number, color: string, alpha: number) => {
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 1; i < pts.length; i++) {
        const grow = 0.55 + (i / pts.length) * 0.75; // downstream swell
        ctx.lineWidth = width * grow;
        ctx.beginPath();
        ctx.moveTo(pts[i - 1].u * size, pts[i - 1].v * size);
        ctx.lineTo(pts[i].u * size, pts[i].v * size);
        ctx.stroke();
      }
    };
    // The paint is only the carved CHANNEL now — bank lip and dark bed.
    // The water itself is a glossy resin ribbon laid over this in the
    // scene (Rivers in WarTableFrame): the glint is what says water.
    trace(6.6, darken(T.riverSlate, 0.06), 0.6); // the painted bank
    trace(4.4, darken(T.riverSlate, 0.14), 0.95); // the channel bed
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
