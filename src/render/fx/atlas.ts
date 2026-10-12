/**
 * Code-drawn sprite sheets. Every particle on the table samples one of these:
 * no image files, everything is painted pixel by pixel at start-up.
 *
 * Textures are DataTextures (not canvases) so fully transparent texels keep a
 * white colour and soft edges never pick up a dark fringe when filtered.
 * Row 0 of the data is the bottom of the texture (v = 0), matching the
 * shader's cell maths: frame f sits at column f % 4, row floor(f / 4) from
 * the bottom.
 */
import * as THREE from 'three';

// ── sprite frames (4 x 4 cells) ──
export const F_SMOKE0 = 0, F_SMOKE1 = 1, F_DOT = 2, F_STAR = 3;
export const F_HEART = 4, F_STREAK = 5, F_RING = 6, F_FOG = 7;
export const F_HAIL = 8, F_FLAKE = 9, F_GLOW = 10, F_BOLT = 11;
export const F_DROPS = 12, F_MOTE = 13, F_STAR8 = 14, F_PUFF = 15;

// ── tumbler cells (2 x 2) ──
export const T_PAPER = 0, T_LEAF = 1, T_PETAL = 2, T_SEQUIN = 3;

// ---------- tiny deterministic noise ----------
function hash(ix: number, iy: number, s: number): number {
  let h = (ix * 374761393 + iy * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x: number, y: number, s: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function fbm(x: number, y: number, s: number): number {
  return vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.15;
}
function sstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** A cell painter: u, v in [-1, 1] (v up). Returns [luminance, alpha] in 0..1 via out. */
type Painter = (u: number, v: number, out: [number, number]) => void;

function paintSheet(size: number, grid: number, painters: (Painter | null)[], supersample: number, mips = true): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const cell = size / grid;
  const o: [number, number] = [0, 0];
  for (let f = 0; f < painters.length; f++) {
    const p = painters[f];
    const col = f % grid, row = Math.floor(f / grid);
    for (let py = 0; py < cell; py++) {
      for (let px = 0; px < cell; px++) {
        let L = 0, A = 0;
        if (p) {
          for (let sy = 0; sy < supersample; sy++) {
            for (let sx = 0; sx < supersample; sx++) {
              const u = ((px + (sx + 0.5) / supersample) / cell) * 2 - 1;
              const v = ((py + (sy + 0.5) / supersample) / cell) * 2 - 1;
              p(u, v, o);
              L += o[0] * o[1]; A += o[1];
            }
          }
          const n = supersample * supersample;
          L = A > 1e-6 ? L / A : 1;     // alpha-weighted luminance keeps edges clean
          A = A / n;
        }
        const i = ((row * cell + py) * size + (col * cell + px)) * 4;
        const l8 = Math.round(clamp(L) * 255);
        data[i] = l8; data[i + 1] = l8; data[i + 2] = l8;
        data[i + 3] = Math.round(clamp(A) * 255);
      }
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.generateMipmaps = mips;
  tex.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

// ---------- sprite painters ----------

/** A cotton-wool puff: a union of soft discs, lumpy noise, lit from above. */
function puffPainter(discs: number[][], seed: number, rough: number): Painter {
  return (u, v, out) => {
    let a = 0;
    for (const d of discs) {
      const dx = u - d[0], dy = v - d[1];
      const r = Math.sqrt(dx * dx + dy * dy) / d[2];
      a = Math.max(a, 1 - sstep(0.45, 1.0, r));
    }
    const n = fbm(u * 2.6 + 3, v * 2.6 + 5, seed);
    a *= clamp(1 - rough + rough * 1.6 * n);
    a *= 1 - sstep(0.82, 0.98, Math.max(Math.abs(u), Math.abs(v)));
    // painted shading: lighter crown, a soft grey belly
    const L = 0.74 + 0.2 * clamp(v * 0.55 + 0.5) + 0.08 * n;
    out[0] = L; out[1] = clamp(a * 0.92);
  };
}

const smoke0 = puffPainter([[0, -0.05, 0.62], [-0.36, -0.16, 0.42], [0.38, -0.12, 0.44], [0.08, 0.34, 0.46], [-0.28, 0.26, 0.34]], 11, 0.38);
const smoke1 = puffPainter([[0.04, 0, 0.58], [-0.4, 0.06, 0.4], [0.36, 0.2, 0.42], [-0.06, 0.4, 0.38], [0.24, -0.32, 0.36]], 23, 0.42);
const dust = puffPainter([[0, 0, 0.55], [-0.38, -0.1, 0.38], [0.36, -0.06, 0.4], [0.02, 0.32, 0.4]], 37, 0.62);

/** a snow dot: bright core, a faint grey rim so it still reads against lying snow */
const dot: Painter = (u, v, out) => {
  const r = Math.sqrt(u * u + v * v);
  out[0] = 1 - 0.42 * sstep(0.3, 0.75, r);
  out[1] = (1 - sstep(0.35, 0.95, r)) * 0.95 + 0.05 * Math.exp(-r * r * 30);
};
const glow: Painter = (u, v, out) => {
  const r = Math.sqrt(u * u + v * v);
  out[0] = 1; out[1] = Math.exp(-r * r * 4.2) * (1 - sstep(0.8, 1.0, r));
};
const mote: Painter = (u, v, out) => {
  const r = Math.sqrt(u * u + v * v);
  out[0] = 1; out[1] = clamp(Math.exp(-r * r * 10) * 0.8 + Math.exp(-r * r * 60) * 0.6) * (1 - sstep(0.85, 1, r));
};
function starPainter(diag: number): Painter {
  return (u, v, out) => {
    const r = Math.sqrt(u * u + v * v);
    const au = Math.abs(u), av = Math.abs(v);
    let a = Math.exp(-r * r * 26) + Math.exp(-au * 16) * Math.exp(-av * 2.4) + Math.exp(-av * 16) * Math.exp(-au * 2.4);
    if (diag > 0) {
      const p = Math.abs(u + v) * 0.7071, q = Math.abs(u - v) * 0.7071;
      a += diag * (Math.exp(-p * 18) * Math.exp(-q * 4.5) + Math.exp(-q * 18) * Math.exp(-p * 4.5));
    }
    a *= 1 - sstep(0.85, 1, Math.max(au, av));
    out[0] = 1; out[1] = clamp(a);
  };
}
const heart: Painter = (u, v, out) => {
  // classic implicit heart, scaled into the cell
  const x = u * 1.32, y = v * 1.32 + 0.18;
  const q = x * x + y * y - 1;
  const f = q * q * q - x * x * y * y * y;
  const inside = f <= 0 ? 1 : 0;
  // painted shading: a highlight on the left lobe, a deeper point
  const hl = Math.exp(-((x + 0.42) ** 2 + (y - 0.42) ** 2) * 7);
  const L = 0.72 + 0.12 * clamp(y * 0.5 + 0.5) + 0.32 * hl;
  out[0] = clamp(L); out[1] = inside;
};
const streak: Painter = (u, v, out) => {
  const across = Math.exp(-((u / 0.34) ** 2));
  const along = sstep(-1, 0.55, v) * (1 - sstep(0.82, 0.98, v));
  out[0] = 1; out[1] = clamp(across * along);
};
const ring: Painter = (u, v, out) => {
  const r = Math.sqrt(u * u + v * v);
  out[0] = 1; out[1] = clamp(Math.exp(-(((r - 0.7) / 0.1) ** 2)) * (1 - sstep(0.9, 1, r)));
};
const fog: Painter = (u, v, out) => {
  const r = Math.sqrt(u * u + v * v);
  const n = fbm(u * 1.9 + 9, v * 1.9 + 2, 51);
  const n2 = fbm(u * 4.2 + 1, v * 4.2 + 8, 52);
  const a = (1 - sstep(0.15, 0.98, r)) * clamp(0.25 + 0.95 * n + 0.2 * n2);
  out[0] = 0.9 + 0.1 * n2; out[1] = clamp(a * a * 1.25);
};
const hail: Painter = (u, v, out) => {
  const r = Math.sqrt(u * u + v * v);
  const hl = Math.exp(-((u + 0.22) ** 2 + (v - 0.26) ** 2) * 12);
  out[0] = clamp(0.78 + 0.3 * hl); out[1] = 1 - sstep(0.52, 0.72, r);
};
const flake: Painter = (u, v, out) => {
  const r = Math.sqrt(u * u + v * v);
  const th = Math.atan2(v, u);
  const k = Math.PI / 3;
  const rel = ((th % k) + k) % k;
  const dArm = r * Math.abs(Math.sin(Math.min(rel, k - rel)));
  let a = Math.exp(-((dArm / 0.07) ** 2)) * (1 - sstep(0.62, 0.8, r));
  // little side branches two thirds of the way out
  const br = Math.abs(r - 0.42);
  a = Math.max(a, Math.exp(-((br / 0.06) ** 2)) * Math.exp(-((dArm / 0.2) ** 2)) * 0.8);
  a = Math.max(a, Math.exp(-r * r * 30));
  // arms fade to a soft grey at their tips, like the dot
  out[0] = 1 - 0.35 * sstep(0.3, 0.75, r); out[1] = clamp(a);
};
const bolt: Painter = (u, v, out) => {
  const across = Math.exp(-((u / 0.16) ** 2)) + 0.35 * Math.exp(-((u / 0.55) ** 2));
  const along = 1 - sstep(0.7, 1.0, Math.abs(v));
  out[0] = 1; out[1] = clamp(across * along);
};
const drops: Painter = (u, v, out) => {
  // a little crown of droplets thrown up from a splash
  let a = 0;
  const pts = [[-0.5, -0.05, 0.13], [-0.22, 0.35, 0.12], [0.08, 0.5, 0.14], [0.36, 0.28, 0.12], [0.55, -0.1, 0.11], [0, -0.45, 0.2]];
  for (const p of pts) {
    const d = Math.sqrt((u - p[0]) ** 2 + (v - p[1]) ** 2) / p[2];
    a = Math.max(a, 1 - sstep(0.6, 1, d));
  }
  out[0] = 1; out[1] = a * 0.95;
};

export function makeSpriteAtlas(): THREE.DataTexture {
  const painters: Painter[] = [];
  painters[F_SMOKE0] = smoke0; painters[F_SMOKE1] = smoke1; painters[F_DOT] = dot; painters[F_STAR] = starPainter(0);
  painters[F_HEART] = heart; painters[F_STREAK] = streak; painters[F_RING] = ring; painters[F_FOG] = fog;
  painters[F_HAIL] = hail; painters[F_FLAKE] = flake; painters[F_GLOW] = glow; painters[F_BOLT] = bolt;
  painters[F_DROPS] = drops; painters[F_MOTE] = mote; painters[F_STAR8] = starPainter(0.45); painters[F_PUFF] = dust;
  return paintSheet(512, 4, painters, 2);
}

// ---------- tumbler painters (lit, alpha-tested shapes; white, tinted per instance) ----------

const paper: Painter = (u, v, out) => {
  const inside = Math.abs(u) < 0.86 && Math.abs(v) < 0.86 ? 1 : 0;
  // a soft fold across the middle
  const L = u > 0.02 ? 0.86 : 1.0;
  out[0] = L; out[1] = inside;
};
const leaf: Painter = (u, v, out) => {
  // pointed oval with a lobed edge, a stem, a midrib and side veins
  const y = v * 1.08;
  const half = 0.58 * Math.pow(Math.max(0, 1 - ((y - 0.05) / 0.9) ** 2), 0.75);
  const lobes = 1 + 0.12 * Math.sin((y + 1) * 9.5);
  const inBlade = Math.abs(u) < half * lobes && y > -0.85 && y < 0.95;
  const inStem = Math.abs(u) < 0.045 && y <= -0.8 && y > -1.0;
  let L = 0.9 + 0.1 * fbm(u * 5, v * 5, 61);
  if (Math.abs(u) < 0.035) L = 0.62;                       // midrib
  const side = Math.abs((((y - Math.abs(u) * 0.85) + 2) % 0.34) - 0.17);
  if (side < 0.022 && Math.abs(u) < half * 0.85) L = Math.min(L, 0.72);  // chevron side veins
  out[0] = L; out[1] = inBlade || inStem ? 1 : 0;
};
const petal: Painter = (u, v, out) => {
  // a rounded petal with a notch at the tip, paler at the base
  const y = (v + 1) * 0.5; // 0 base .. 1 tip
  const w = 0.62 * Math.sin(Math.PI * Math.pow(y, 0.75));
  const notch = y > 0.82 && Math.abs(u) < (y - 0.82) * 0.9 ? 1 : 0;
  const a = Math.abs(u) < w && y > 0.02 && y < 0.99 && !notch ? 1 : 0;
  out[0] = 0.78 + 0.22 * y; out[1] = a;
};
const sequin: Painter = (u, v, out) => {
  const r = Math.sqrt(u * u + v * v);
  const hl = Math.exp(-((u + 0.3) ** 2 + (v - 0.3) ** 2) * 6);
  out[0] = clamp(0.85 + 0.25 * hl); out[1] = r < 0.8 ? 1 : 0;
};

export function makeTumblerAtlas(): THREE.DataTexture {
  const painters: Painter[] = [];
  painters[T_PAPER] = paper; painters[T_LEAF] = leaf; painters[T_PETAL] = petal; painters[T_SEQUIN] = sequin;
  // no mipmaps: these are alpha-tested, and a leaf a few pixels across would
  // average below the cut-off in a small mip and blink out of existence
  return paintSheet(256, 2, painters, 3, false);
}

/**
 * A tiny warm equirectangular "room" for the coins to reflect: candle glow
 * above, amber at the horizon, dark oak below, a few hot spots. Gold with
 * nothing to reflect looks like brown plastic.
 */
export function makeCoinEnv(): THREE.DataTexture {
  const W = 64, H = 32;
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);                 // 0 bottom .. 1 top
    for (let x = 0; x < W; x++) {
      const u = x / W;
      let r: number, g: number, b: number;
      if (v > 0.5) {
        const t = (v - 0.5) / 0.5;
        r = 210 + 40 * t; g = 150 + 60 * t; b = 90 + 60 * t;
      } else {
        const t = v / 0.5;
        r = 40 + 150 * t * t; g = 26 + 110 * t * t; b = 16 + 60 * t * t;
      }
      // candle hot spots near the horizon
      for (let k = 0; k < 4; k++) {
        const cu = (k + 0.3) / 4, cv = 0.58 + 0.05 * (k % 2);
        let du = Math.abs(u - cu); du = Math.min(du, 1 - du);
        const d = (du * 4) ** 2 + ((v - cv) * 6) ** 2;
        const s = Math.exp(-d * 8);
        r += 255 * s; g += 220 * s; b += 150 * s;
      }
      const i = (y * W + x) * 4;
      data[i] = Math.min(255, r); data[i + 1] = Math.min(255, g); data[i + 2] = Math.min(255, b); data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}
