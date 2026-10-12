/**
 * Things a mitten can hold. Each is carved once and shared by every figure
 * that carries one. Authored at human scale with the grip at the origin,
 * +y up the handle, +z away from the holder's chest.
 */
import * as THREE from 'three';
import { PAL, mat } from '../palette';
import { Sculpt, shade } from './sculpt';
import type { PropId } from './look';

export interface PropModel {
  geo: THREE.BufferGeometry;
  /** glowing bits (flames, orbs), drawn with an emissive material */
  glow: THREE.BufferGeometry | null;
  glowMat: THREE.Material | null;
  /** a long tool held upright (pitchfork, staff): wave with the other hand */
  long: boolean;
  /** how far the business end is from the grip (sweeping aims it at the ground) */
  reach: number;
  /** hangs below the grip (sack, lantern): turned over when carried overhead */
  hangs: boolean;
}

const WOOD = 0x7a5232, WOOD_DARK = 0x4a3423, IRON = 0x6f7378, STEEL = 0xc4c9ce, BRASS = 0xc39a3c, STRAW = 0xd2b260, PARCH = 0xefe3c4, LEATHER = 0x8a5f38, SACK = 0xb89a6a;
const PI = Math.PI;

type Maker = (s: Sculpt, g: Sculpt) => { long?: boolean; reach?: number; hangs?: boolean; glow?: number };

function pole(s: Sculpt, top: number, c = WOOD, r = 0.0095): void { s.cyl(r * 0.9, r, top + 0.07, c, 0, -0.07, 0, 0, 0, 0, 6); }

const MAKERS: Record<Exclude<PropId, 'none'>, Maker> = {
  hammer: s => {
    s.cyl(0.0095, 0.011, 0.18, WOOD, 0, -0.045, 0, 0, 0, 0, 6);
    s.box(0.05, 0.05, 0.095, IRON, 0, 0.14, 0.006);
    s.box(0.054, 0.02, 0.03, shade(IRON, -0.2), 0, 0.14, 0.006);
    return {};
  },
  gavel: s => {
    s.cyl(0.009, 0.011, 0.18, WOOD_DARK, 0, -0.045, 0, 0, 0, 0, 6);
    s.cyl(0.033, 0.033, 0.1, WOOD, 0, 0.14, -0.05, PI / 2, 0, 0, 8);
    for (const z of [-0.036, 0.03]) s.cyl(0.035, 0.035, 0.012, WOOD_DARK, 0, 0.14, z, PI / 2, 0, 0, 8);
    return {};
  },
  trowel: s => {
    s.cyl(0.011, 0.012, 0.06, WOOD, 0, -0.03, 0, 0, 0, 0, 6);
    s.cyl(0.005, 0.005, 0.03, IRON, 0, 0.03, 0, 0, 0, 0, 4);
    s.cone(0.04, 0.1, STEEL, 0, 0.055, 0.012, 0.3, PI / 4, 0, 4, 0.16);
    return {};
  },
  broom: s => {
    pole(s, 0.3);
    s.cyl(0.052, 0.02, 0.13, STRAW, 0, 0.29, 0, 0, 0, 0, 7);
    s.cyl(0.058, 0.05, 0.02, shade(STRAW, -0.15), 0, 0.42, 0, 0, 0, 0, 7);
    s.cyl(0.024, 0.024, 0.02, PAL.clothRed, 0, 0.3, 0, 0, 0, 0, 7);
    return { long: true, reach: 0.44 };
  },
  pitchfork: s => {
    pole(s, 0.3);
    s.box(0.09, 0.012, 0.012, IRON, 0, 0.3, 0);
    for (const x of [-0.039, 0, 0.039]) s.cone(0.007, 0.11, IRON, x, 0.3, 0, 0, 0, 0, 4);
    return { long: true, reach: 0.41 };
  },
  crook: s => {
    pole(s, 0.335);
    s.torus(0.035, 0.0095, WOOD, 0.035, 0.335, 0, -PI / 2, 0, 0, 5, 9, PI * 1.05);
    return { long: true, reach: 0.38 };
  },
  staff: (s, g) => {
    pole(s, 0.34, WOOD_DARK, 0.011);
    s.ball(0.02, WOOD_DARK, 0, 0.2, 0.004, 1, 1, 1, true, 0);
    for (let k = 0; k < 3; k++) { const a = k * 2.09; s.cone(0.008, 0.05, WOOD_DARK, Math.sin(a) * 0.018, 0.34, Math.cos(a) * 0.018, Math.cos(a) * -0.3, 0, Math.sin(a) * 0.3, 4); }
    g.ball(0.022, PAL.magic, 0, 0.385, 0, 1, 1, 1, false, 1);
    return { long: true, reach: 0.4, glow: PAL.magic };
  },
  shovel: s => {
    pole(s, 0.27);
    s.box(0.045, 0.01, 0.01, WOOD, 0, -0.07, 0);
    s.box(0.062, 0.075, 0.008, IRON, 0, 0.305, 0);
    s.cone(0.044, 0.045, IRON, 0, 0.342, 0, 0, PI / 4, 0, 4, 0.13);
    return { long: true, reach: 0.38 };
  },
  ratpole: s => {
    pole(s, 0.36);
    s.box(0.13, 0.009, 0.009, WOOD, 0, 0.35, 0);
    for (const x of [-0.05, 0.045]) {
      const y = x < 0 ? 0.275 : 0.29;
      s.cyl(0.0025, 0.0025, 0.35 - y - 0.02, 0xc89a8a, x, y + 0.02, 0, 0, 0, 0, 3);
      s.ball(0.02, 0x6a625a, x, y, 0, 0.8, 1.35, 0.85, false, 1);
      s.ball(0.012, 0x6a625a, x, y - 0.028, 0.004, 1, 1.1, 1, false, 0);
      s.ball(0.004, 0xd88a8a, x, y - 0.041, 0.008, 1, 1, 1, true, 0);
      for (const e of [-1, 1]) s.ball(0.006, 0x8a7f74, x + e * 0.009, y - 0.02, -0.002, 1, 1, 0.5, true, 0);
    }
    return { long: true, reach: 0.37 };
  },
  sack: s => {
    s.ball(0.078, SACK, 0, -0.082, 0, 1, 1.12, 0.92, true, 1, 0.3, 0.5, 0);
    s.cone(0.034, 0.045, SACK, 0, -0.012, 0, PI, 0, 0, 6);
    s.cyl(0.018, 0.018, 0.012, shade(SACK, -0.35), 0, -0.016, 0, 0, 0, 0, 6);
    s.box(0.04, 0.04, 0.006, shade(SACK, -0.2), 0.02, -0.1, 0.068, 0.1, 0.25, 0.2);
    return { hangs: true };
  },
  purse: s => {
    s.ball(0.043, LEATHER, 0, -0.045, 0, 1, 1.05, 0.9, true, 1, 0.2, 0.3, 0);
    s.cone(0.022, 0.03, LEATHER, 0, -0.004, 0, PI, 0, 0, 6);
    s.cyl(0.012, 0.012, 0.008, PAL.goldDark, 0, -0.008, 0, 0, 0, 0, 6);
    s.cyl(0.014, 0.014, 0.004, PAL.gold, 0.012, 0.004, 0.008, 0.5, 0, 0.3, 7);
    return { hangs: true };
  },
  scroll: s => {
    s.cyl(0.016, 0.016, 0.12, PARCH, 0.06, 0.012, 0.012, 0, 0, PI / 2, 7);
    for (const x of [-0.064, 0.064]) s.ball(0.012, WOOD_DARK, x, 0.012, 0.012, 1, 1, 1, true, 0);
    s.box(0.098, 0.085, 0.004, PARCH, 0, -0.036, 0.014);
    for (let k = 0; k < 3; k++) s.box(0.07 - k * 0.012, 0.005, 0.002, 0x5a4a3a, -0.006 * k, -0.02 - k * 0.018, 0.017);
    s.ball(0.012, PAL.crimson, 0.028, -0.068, 0.018, 1, 1, 0.5, true, 0);
    return {};
  },
  bell: s => {
    s.cyl(0.0085, 0.0085, 0.04, WOOD_DARK, 0, -0.012, 0, 0, 0, 0, 6);
    s.cyl(0.014, 0.04, 0.052, BRASS, 0, -0.064, 0, 0, 0, 0, 8, false);
    s.cyl(0.043, 0.043, 0.008, shade(BRASS, -0.12), 0, -0.07, 0, 0, 0, 0, 8);
    s.ball(0.011, IRON, 0, -0.076, 0, 1, 1, 1, true, 0);
    return { hangs: true };
  },
  keys: s => {
    s.torus(0.03, 0.005, IRON, 0, -0.03, 0, -PI / 2, 0, 0, 4, 10);
    for (let k = -1; k <= 1; k++) {
      const a = k * 0.42;
      s.box(0.007, 0.055, 0.005, k ? IRON : BRASS, Math.sin(a) * 0.058, -0.06 - Math.cos(a) * 0.026, k * 0.004, 0, 0, a);
      s.box(0.018, 0.01, 0.005, k ? IRON : BRASS, Math.sin(a) * 0.082 + 0.006, -0.06 - Math.cos(a) * 0.048, k * 0.004, 0, 0, a);
    }
    return { hangs: true };
  },
  ledger: s => {
    s.box(0.1, 0.128, 0.007, PAL.lapis, 0, 0.04, 0.034);
    s.box(0.1, 0.128, 0.007, PAL.lapis, 0, 0.04, 0.006);
    s.box(0.012, 0.128, 0.035, shade(PAL.lapis, -0.2), -0.046, 0.04, 0.02);
    s.box(0.09, 0.12, 0.021, PARCH, 0.003, 0.04, 0.02);
    for (const [x, y] of [[-0.036, 0.092], [0.04, 0.092], [-0.036, -0.012], [0.04, -0.012]] as const) s.box(0.016, 0.016, 0.004, PAL.gold, x, y, 0.039);
    s.box(0.03, 0.04, 0.004, PAL.gold, 0.002, 0.04, 0.039, 0, 0, PI / 4);
    return {};
  },
  lute: s => {
    s.pushFrame(0, 0.01, 0.03, 0, 0, 0.95);
    s.ball(0.06, 0xc89a5a, 0, -0.02, 0, 1, 1.22, 0.5, false, 1);
    s.cyl(0.02, 0.02, 0.004, WOOD_DARK, 0, -0.012, 0.03, PI / 2, 0, 0, 8);
    s.box(0.018, 0.13, 0.012, WOOD_DARK, 0, 0.105, 0.008);
    s.box(0.024, 0.036, 0.012, WOOD, 0, 0.18, -0.004, -0.5);
    for (const x of [-0.016, 0.016]) for (const y of [0.172, 0.188]) s.ball(0.006, PARCH, x, y, -0.006, 1, 1, 1, true, 0);
    s.box(0.03, 0.006, 0.006, WOOD_DARK, 0, -0.055, 0.03);
    s.popFrame();
    return {};
  },
  loaf: s => {
    s.ball(0.04, 0xc98a4a, 0, 0.012, 0.01, 1.75, 0.78, 0.95, false, 1);
    for (const x of [-0.03, 0, 0.03]) s.box(0.007, 0.007, 0.05, 0xecc88a, x, 0.04, 0.01, 0, 0.5, 0);
    return {};
  },
  mug: s => {
    s.cyl(0.03, 0.027, 0.062, WOOD, 0, -0.022, 0.012, 0, 0, 0, 8);
    for (const y of [-0.016, 0.026]) s.cyl(0.0315, 0.0315, 0.008, IRON, 0, y, 0.012, 0, 0, 0, 8);
    s.ball(0.03, 0xf6f1e4, 0, 0.044, 0.012, 1, 0.5, 1, true, 1);
    s.ball(0.014, 0xf6f1e4, 0.02, 0.05, 0.02, 1, 1, 1, true, 0);
    s.torus(0.018, 0.005, WOOD_DARK, -0.032, 0.008, 0.012, -PI / 2, 0, 0, 4, 8);
    return {};
  },
  basket: s => {
    const W = 0xb08a4a;
    s.cyl(0.066, 0.048, 0.056, W, 0, -0.118, 0, 0, 0, 0, 9);
    s.torus(0.066, 0.007, shade(W, -0.2), 0, -0.062, 0, 0, 0, 0, 4, 10);
    s.torus(0.062, 0.006, shade(W, -0.2), 0, -0.062, 0, -PI / 2, 0, 0, 4, 9, PI);
    s.ball(0.03, 0x7a9a5a, -0.022, -0.06, 0.012, 1, 0.8, 1, true, 0);
    s.ball(0.028, 0xe6d8b8, 0.024, -0.06, -0.012, 1, 0.8, 1, true, 0);
    s.ball(0.022, PAL.clothRed, 0.006, -0.054, 0.03, 1, 0.8, 1, true, 0);
    return { hangs: true };
  },
  lantern: (s, g) => {
    s.torus(0.014, 0.004, IRON, 0, -0.012, 0, -PI / 2, 0, 0, 4, 8);
    s.cone(0.034, 0.024, IRON, 0, -0.048, 0, 0, PI / 4, 0, 4);
    for (const x of [-1, 1]) for (const z of [-1, 1]) s.box(0.005, 0.052, 0.005, IRON, x * 0.021, -0.073, z * 0.021);
    s.box(0.052, 0.007, 0.052, IRON, 0, -0.1, 0);
    g.box(0.036, 0.046, 0.036, PAL.flame, 0, -0.073, 0);
    return { hangs: true, glow: PAL.flame };
  },
  sword: s => {
    s.box(0.016, 0.2, 0.006, STEEL, 0, 0.135, 0);
    s.cone(0.0115, 0.03, STEEL, 0, 0.235, 0, 0, PI / 4, 0, 4, 0.36);
    s.box(0.064, 0.012, 0.016, BRASS, 0, 0.03, 0);
    s.cyl(0.008, 0.008, 0.045, LEATHER, 0, -0.02, 0, 0, 0, 0, 6);
    s.ball(0.012, BRASS, 0, -0.026, 0, 1, 1, 1, true, 0);
    return {};
  },
  fish: s => {
    const F = 0x8aa8b8;
    s.ball(0.03, F, 0, -0.075, 0, 0.62, 1.9, 0.42, false, 1);
    s.ball(0.022, 0xd8e2e6, 0.006, -0.08, 0, 0.5, 1.6, 0.43, false, 1);
    for (const x of [-1, 1]) s.cone(0.014, 0.034, shade(F, -0.15), x * 0.008, -0.03, 0, 0, 0, -x * 0.5, 4, 0.25);
    s.ball(0.005, 0x1a1a1a, -0.008, -0.112, 0.011, 1, 1, 0.6, true, 0);
    s.ball(0.005, 0x1a1a1a, -0.008, -0.112, -0.011, 1, 1, 0.6, true, 0);
    return { hangs: true };
  },
  quill: s => {
    s.cone(0.014, 0.14, 0xf4efe2, 0, -0.015, 0, 0.2, 0, -0.3, 4, 0.3);
    s.cone(0.004, 0.03, 0x2a2623, 0, -0.015, 0, PI + 0.2, 0, -0.3, 4);
    return {};
  },
  flask: (s, g) => {
    s.cyl(0.01, 0.012, 0.05, 0xcfe4dc, 0, -0.022, 0, 0, 0, 0, 7);
    s.cyl(0.011, 0.009, 0.012, 0x9a7248, 0, 0.028, 0, 0, 0, 0, 6);
    s.cap(0.035, 0xcfe4dc, 0, PI * 0.42, 0, PI * 2, 0, -0.05, 0, 0, 0, 0, 1, 1, 1, false, 9, 3);
    g.cap(0.0345, 0x7fe08a, PI * 0.42, PI * 0.58, 0, PI * 2, 0, -0.05, 0, 0, 0, 0, 1, 1, 1, false, 9, 4);
    g.ball(0.007, 0x7fe08a, 0.006, 0.05, 0, 1, 1, 1, true, 0);
    g.ball(0.005, 0x7fe08a, -0.005, 0.068, 0.003, 1, 1, 1, true, 0);
    return { hangs: true, glow: 0x7fe08a };
  },
  keg: s => {
    s.cyl(0.05, 0.043, 0.055, WOOD, 0, -0.03, -0.055, PI / 2, 0, 0, 9);
    s.cyl(0.043, 0.05, 0.055, WOOD, 0, -0.03, 0, PI / 2, 0, 0, 9);
    for (const z of [-0.05, 0, 0.047]) s.cyl(z ? 0.046 : 0.052, z ? 0.046 : 0.052, 0.008, IRON, 0, -0.03, z, PI / 2, 0, 0, 9);
    s.cyl(0.006, 0.006, 0.02, BRASS, 0, -0.05, 0.055, PI / 2, 0, 0, 5);
    return {};
  },
  bow: s => {
    s.torus(0.13, 0.006, WOOD, -0.13, 0, 0, -PI / 2, 0, -0.45 * PI, 4, 10, PI * 0.9);
    s.box(0.003, 0.256, 0.003, 0xe8dcc0, -0.11, 0, 0);
    s.cyl(0.009, 0.009, 0.04, LEATHER, 0, -0.02, 0, 0, 0, 0, 5);
    return {};
  },
  skep: s => {
    s.cyl(0.05, 0.056, 0.028, STRAW, 0, 0.0, 0, 0, 0, 0, 9);
    s.cyl(0.036, 0.05, 0.026, shade(STRAW, -0.08), 0, 0.028, 0, 0, 0, 0, 9);
    s.cyl(0.016, 0.036, 0.022, STRAW, 0, 0.054, 0, 0, 0, 0, 9);
    s.ball(0.016, shade(STRAW, -0.08), 0, 0.078, 0, 1, 0.8, 1, true, 0);
    s.ball(0.012, 0x2a1d14, 0, 0.012, 0.052, 1, 1, 0.5, true, 0);
    s.ball(0.006, 0xe8c040, 0.04, 0.085, 0.03, 1.4, 1, 1, true, 0);
    s.ball(0.006, 0xe8c040, -0.05, 0.06, 0.04, 1.4, 1, 1, true, 0);
    return {};
  },
  cheese: s => {
    const C = 0xe8c040;
    s.cyl(0.056, 0.056, 0.04, C, 0, 0.0, 0.01, 0, 0.5, 0, 3);
    s.cyl(0.058, 0.058, 0.008, 0xb8862a, 0, 0.04, 0.01, 0, 0.5, 0, 3);
    for (const [x, y, z] of [[0.01, 0.022, 0.036], [-0.016, 0.012, 0.027], [0.03, 0.03, -0.0]] as const) s.ball(0.007, 0xb8922a, x, y, z, 1, 1, 0.5, true, 0);
    return {};
  },
  candle: (s, g) => {
    s.cyl(0.03, 0.022, 0.01, BRASS, 0, -0.03, 0, 0, 0, 0, 8);
    s.cyl(0.012, 0.013, 0.09, 0xf0e6cc, 0, -0.02, 0, 0, 0, 0, 7, false);
    s.ball(0.006, 0xf0e6cc, 0.011, 0.045, 0.004, 1, 2, 1, true, 0);
    s.cyl(0.0015, 0.0015, 0.012, 0x2a2623, 0, 0.07, 0, 0, 0, 0, 3);
    g.cone(0.009, 0.03, PAL.flame, 0, 0.078, 0, 0, 0, 0, 5);
    g.ball(0.009, PAL.flameCore, 0, 0.082, 0, 1, 1, 1, true, 0);
    return { glow: PAL.flame };
  },
  orb: (s, g) => {
    s.cyl(0.02, 0.028, 0.014, BRASS, 0, 0.0, 0.01, 0, 0, 0, 7);
    s.cyl(0.03, 0.03, 0.006, PAL.clothPlum, 0, -0.006, 0.01, 0, 0, 0, 7);
    g.ball(0.036, PAL.magic, 0, 0.046, 0.01, 1, 1, 1, false, 1);
    return { glow: PAL.magic };
  },
  horn: s => {
    s.pushFrame(0, 0, 0, 0.5, 0, 0);
    s.cyl(0.03, 0.006, 0.27, BRASS, 0, -0.03, 0, 0, 0, 0, 8, false);
    s.cyl(0.036, 0.03, 0.012, shade(BRASS, -0.1), 0, 0.24, 0, 0, 0, 0, 8);
    s.box(0.004, 0.1, 0.085, PAL.crimson, 0, 0.11, -0.05);
    s.box(0.005, 0.03, 0.03, PAL.gold, 0, 0.11, -0.05, PI / 4);
    s.box(0.004, 0.012, 0.085, PAL.gold, 0, 0.056, -0.05);
    s.popFrame();
    return {};
  },
  sceptre: s => {
    s.cyl(0.0075, 0.0085, 0.2, PAL.gold, 0, -0.05, 0, 0, 0, 0, 6, false);
    s.ball(0.021, PAL.gold, 0, 0.165, 0, 1, 1, 1, false, 1);
    s.ball(0.012, PAL.crimson, 0, 0.14, 0, 1, 1, 1, true, 0);
    s.box(0.008, 0.034, 0.008, PAL.gold, 0, 0.2, 0); s.box(0.026, 0.008, 0.008, PAL.gold, 0, 0.202, 0);
    return {};
  },
  stamp: s => {
    s.ball(0.021, WOOD_DARK, 0, 0.0, 0, 1, 1, 1, false, 1);
    s.cyl(0.009, 0.012, 0.05, WOOD, 0, -0.06, 0, 0, 0, 0, 6);
    s.box(0.052, 0.022, 0.052, WOOD, 0, -0.07, 0);
    s.box(0.048, 0.005, 0.048, PAL.crimson, 0, -0.083, 0);
    return { hangs: true };
  },
};

const cache = new Map<PropId, PropModel>();

export function propModel(id: PropId): PropModel | null {
  if (id === 'none') return null;
  let m = cache.get(id);
  if (!m) {
    const s = new Sculpt(), g = new Sculpt();
    const meta = MAKERS[id](s, g);
    m = {
      geo: s.build(), glow: g.empty ? null : g.build(),
      glowMat: meta.glow !== undefined ? mat(0xffffff, { emissive: meta.glow, emissiveIntensity: 1.25, flat: false, rough: 0.5, vertexColors: true }) : null,
      long: !!meta.long, reach: meta.reach ?? 0.2, hangs: !!meta.hangs,
    };
    cache.set(id, m);
  }
  return m;
}
