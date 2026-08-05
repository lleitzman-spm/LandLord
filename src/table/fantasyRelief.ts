/**
 * The fantasy relief — an INVENTED heightfield, standing in for the baked
 * real one (`src/table/relief.ts`) wherever the table wants a made-up realm
 * instead of true ground. Same interface, so it drops in wherever a `Relief`
 * is expected (`toUV`, `cell`, `sample` all behave the same way — row 0 is
 * NORTH, u runs west→east, v runs north→south).
 *
 * Everything here is generated from a seed string: value-noise fBm (the
 * FNV-1a hash + xorshift-mix stream, same style as `parcels.ts`'s
 * deterministic doors) shaped by a couple of hand-placed "control curves" —
 * a mountain spine hugging the north/north-east edge, and a wiggly coastline
 * eating into the south-west corner. Rivers are then walked downhill by
 * steepest descent from the high ground to the sea and carved into the
 * grid, so the terrain and the painted rivers always agree.
 *
 * No `Math.random`, no `Date`, no imports beyond the `Relief` type — same
 * seed always yields the same realm, byte for byte.
 */

import type { Relief } from './relief';

export interface FantasyOptions {
  seed?: string;
  side?: number;
  /** uv points that MUST end up as habitable dry lowland (the holdings). */
  keepDry?: { u: number; v: number }[];
}

export interface FantasyRealm extends Relief {
  /** Metres. Ground strictly below this is water. */
  seaLevel: number;
  /**
   * River courses in uv space, ~90 evenly spaced points each, lightly
   * smoothed. Ordered SOURCE → MOUTH: index 0 sits in the high ground,
   * the last index sits at the sea (or the map edge, if the course could
   * not reach the coast) — elevation descends along each array.
   */
  rivers: { u: number; v: number }[][];
}

// ── The same geographic frame the baked relief used. Now just an arbitrary
//    coordinate box, not a claim about the real world. ────────────────────
const WEST = 0;
const SOUTH = 0;
const EAST = 1;
const NORTH = 1;

// ── Deterministic hash / stream (FNV-1a + xorshift-mix), parcels.ts's style ─

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mix32(x: number): number {
  x |= 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return (x ^ (x >>> 15)) >>> 0;
}

/** A named sequential stream, same shape as parcels.ts's `stream()`. */
function stream(seed: string): () => number {
  let s = fnv1a(seed);
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    return mix32(s) / 4294967296;
  };
}

/** Deterministic hash of a salt + an integer lattice cell, → [0,1). */
function hash2(salt: number, ix: number, iy: number): number {
  const h = (salt ^ Math.imul(ix, 0x27d4eb2f) ^ Math.imul(iy, 0x165667b1)) | 0;
  return mix32(h) / 4294967296;
}

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (t: number) => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};

/** Bilinear value noise on an integer lattice, salt-keyed. Returns [0,1). */
function valueNoise2D(x: number, y: number, salt: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothstep(x - x0);
  const ty = smoothstep(y - y0);
  const h00 = hash2(salt, x0, y0);
  const h10 = hash2(salt, x0 + 1, y0);
  const h01 = hash2(salt, x0, y0 + 1);
  const h11 = hash2(salt, x0 + 1, y0 + 1);
  const a = h00 * (1 - tx) + h10 * tx;
  const b = h01 * (1 - tx) + h11 * tx;
  return a * (1 - ty) + b * ty;
}

/** Fractal-Brownian-motion of the value noise above. Returns roughly [-1,1]. */
function fbm(x: number, y: number, salt: number, octaves = 5): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * (valueNoise2D(x * freq, y * freq, (salt + i * 101) | 0) * 2 - 1);
    norm += amp;
    amp *= 0.5;
    freq *= 2.02; // slightly off 2.0 so octaves never line up on a shared grid
  }
  return sum / norm;
}

// ── Control curves: a mountain spine and a wiggly coastline ───────────────

interface UV { u: number; v: number }

/** A hand-anchored line, pushed into a natural wiggle by 1D-sampled fbm. */
function buildWigglyLine(p0: UV, p1: UV, salt: number, segments: number, amp: number, freq: number): UV[] {
  const dx = p1.u - p0.u;
  const dy = p1.v - p0.v;
  const len = Math.hypot(dx, dy) || 1;
  const perpx = -dy / len;
  const perpy = dx / len;
  const pts: UV[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const bx = p0.u + dx * t;
    const by = p0.v + dy * t;
    // Two octaves stacked at different frequency so the wiggle itself has
    // both a broad sway and small irregularity — never a smooth sine.
    const n = fbm(t * freq, 0.41, salt, 4) * 0.75 + fbm(t * freq * 2.7 + 5, 1.9, salt + 17, 3) * 0.25;
    const off = n * amp;
    pts.push({ u: bx + perpx * off, v: by + perpy * off });
  }
  return pts;
}

function distanceToPolyline(u: number, v: number, poly: UV[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i];
    const b = poly[i + 1];
    const dx = b.u - a.u;
    const dy = b.v - a.v;
    const len2 = dx * dx + dy * dy || 1e-9;
    let t = ((u - a.u) * dx + (v - a.v) * dy) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = a.u + dx * t;
    const py = a.v + dy * t;
    const d = Math.hypot(u - px, v - py);
    if (d < best) best = d;
  }
  return best;
}

/** Distance to the polyline PLUS which side ("land" vs "sea") the point falls on,
 *  calibrated against two known reference points so the sign is never guessed wrong. */
function coastSide(u: number, v: number, poly: UV[]): { dist: number; land: boolean } {
  let best = Infinity;
  let bestCross = 0;
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i];
    const b = poly[i + 1];
    const dx = b.u - a.u;
    const dy = b.v - a.v;
    const len2 = dx * dx + dy * dy || 1e-9;
    let t = ((u - a.u) * dx + (v - a.v) * dy) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = a.u + dx * t;
    const py = a.v + dy * t;
    const d = Math.hypot(u - px, v - py);
    if (d < best) {
      best = d;
      bestCross = dx * (v - a.v) - dy * (u - a.u);
    }
  }
  return { dist: best, land: bestCross >= 0 };
}

function calibrateFlip(poly: UV[], landRef: UV, seaRef: UV): boolean {
  // true if the raw "land>=0" convention above already matches landRef being land.
  const landRaw = coastSide(landRef.u, landRef.v, poly).land;
  const seaRaw = coastSide(seaRef.u, seaRef.v, poly).land;
  return landRaw === true && seaRaw === false;
}

// ── The realm ───────────────────────────────────────────────────────────

export function fantasyRelief(opts: FantasyOptions = {}): FantasyRealm {
  const seed = opts.seed ?? 'the-realm';
  const side = opts.side ?? 300;
  const keepDry = opts.keepDry ?? [];
  const w = side;
  const h = side;

  const saltWarpX = fnv1a(seed + ':warpx');
  const saltWarpY = fnv1a(seed + ':warpy');
  const saltPeak = fnv1a(seed + ':peak');
  const saltDetail1 = fnv1a(seed + ':detail1');
  const saltDetail2 = fnv1a(seed + ':detail2');
  const saltSeaFloor = fnv1a(seed + ':seafloor');
  const saltRidgeWiggle = fnv1a(seed + ':ridge');
  const saltCoastWiggle = fnv1a(seed + ':coast');
  const saltRiverBias = fnv1a(seed + ':riverbias');

  // Mountain spine: sweeps along the north edge and bends down the east
  // edge a little — the "north / north-east edge" hero range. Anchors run
  // slightly past the map so the wiggle stays coherent right at the border.
  const ridgePoly = buildWigglyLine(
    { u: -0.12, v: 0.11 },
    { u: 1.12, v: 0.36 },
    saltRidgeWiggle,
    22,
    0.07,
    2.6,
  );

  // Coastline: a wiggly diagonal cutting into the SW quarter — the bay.
  const coastPoly = buildWigglyLine(
    { u: -0.18, v: 0.4 },
    { u: 0.62, v: 1.16 },
    saltCoastWiggle,
    26,
    0.1,
    2.2,
  );
  // Calibrate the "which side is land" convention against two points we
  // KNOW are land (well into the NE) and sea (deep in the SW corner).
  const flipOk = calibrateFlip(coastPoly, { u: 0.75, v: 0.25 }, { u: 0.05, v: 0.95 });

  const SEA_LEVEL = 0;

  function elevationAt(u: number, v: number): number {
    // Domain-warp the coordinates used for the ridge & peak texture only,
    // so the range breaks into individual high points instead of a wall,
    // and nothing lines up with the u/v axes.
    const wu = u + fbm(u * 2.4, v * 2.4, saltWarpX, 4) * 0.1;
    const wv = v + fbm(u * 2.4 + 50, v * 2.4 + 50, saltWarpY, 4) * 0.1;

    // Continental gradient: high near north (and a bit more toward east),
    // low toward south-west. A gentle background, not itself a mountain.
    const d = clamp01((1 - v) * 0.7 + u * 0.3);
    const slopeHeight = Math.pow(d, 1.3) * 230;

    // Mountain range: distance-to-spine falloff, sharp core + broad shoulder,
    // modulated by noise so it reads as a chain of peaks, not a wall.
    const distR = distanceToPolyline(wu, wv, ridgePoly);
    const ridgeCore = 230 * Math.exp(-(distR * distR) / (2 * 0.1 * 0.1));
    const ridgeShoulder = 75 * Math.exp(-(distR * distR) / (2 * 0.27 * 0.27));
    const peakVar = 0.55 + 0.55 * (fbm(u * 7, v * 7, saltPeak, 4) * 0.5 + 0.5);
    const ridgeHeight = (ridgeCore + ridgeShoulder) * Math.max(0, peakVar);

    // General roughness — rolling downs everywhere, foothill texture near
    // the range (it rides on top of ridgeHeight, so it's automatically
    // rougher there without a separate "foothill" mask).
    const detail = fbm(u * 6, v * 6, saltDetail1, 5) * 32;
    const detail2 = fbm(u * 13, v * 13, saltDetail2, 4) * 12;

    const rawLand = slopeHeight + ridgeHeight + detail + detail2 + 6;

    // Mix down into the sea across the coastline, smoothly (no cliff at
    // the shore: the land side already tends toward low values near the
    // coast, since the coast sits in the low-d south-west).
    const side2 = coastSide(u, v, coastPoly);
    const land = flipOk ? side2.land : !side2.land;
    const signedCoast = land ? side2.dist : -side2.dist;
    const falloff = 0.09;
    const shoreT = clamp01(0.5 + signedCoast / (2 * falloff));
    const seaFloorN = fbm(u * 9, v * 9, saltSeaFloor, 4);
    const seaDepth = 8 + 9 * clamp01(seaFloorN * 0.5 + 0.5);

    return lerp(-seaDepth, rawLand, shoreT);
  }

  const grid = new Float32Array(w * h);
  for (let iy = 0; iy < h; iy++) {
    const v = iy / (h - 1);
    for (let ix = 0; ix < w; ix++) {
      const u = ix / (w - 1);
      grid[iy * w + ix] = elevationAt(u, v);
    }
  }

  // ── Guarantee the holdings' ground: raise+flatten a smooth knoll under
  //    every keepDry point, blended over a radius so there's no cliff. ──
  const KEEP_DRY_MARGIN = 20; // > the promised 12m, so bilinear sampling near
                                // the centre still clears the margin comfortably.
  const raiseRadiusCells = Math.max(6, Math.round(side * 0.05));
  for (const pt of keepDry) {
    const cx = clamp01(pt.u) * (w - 1);
    const cy = clamp01(pt.v) * (h - 1);
    const target = SEA_LEVEL + KEEP_DRY_MARGIN;
    const R = raiseRadiusCells;
    const ixMin = Math.max(0, Math.floor(cx - R));
    const ixMax = Math.min(w - 1, Math.ceil(cx + R));
    const iyMin = Math.max(0, Math.floor(cy - R));
    const iyMax = Math.min(h - 1, Math.ceil(cy + R));
    for (let iy = iyMin; iy <= iyMax; iy++) {
      for (let ix = ixMin; ix <= ixMax; ix++) {
        const dist = Math.hypot(ix - cx, iy - cy);
        if (dist > R) continue;
        const weight = smoothstep(1 - dist / R);
        const idx = iy * w + ix;
        const cur = grid[idx];
        const desired = Math.max(cur, target);
        grid[idx] = cur * (1 - weight) + desired * weight;
      }
    }
  }

  // ── Rivers: pick sources in the high ground, walk downhill, carve. ────
  const keepDryCenters = keepDry.map((p) => ({
    x: clamp01(p.u) * (w - 1),
    y: clamp01(p.v) * (h - 1),
  }));
  const blockRadius = Math.max(4, Math.round(side * 0.035));
  const isBlocked = (ix: number, iy: number): boolean => {
    for (const c of keepDryCenters) {
      if (Math.hypot(ix - c.x, iy - c.y) <= blockRadius) return true;
    }
    return false;
  };

  function pickRiverSources(count: number): { ix: number; iy: number }[] {
    let maxE = -Infinity;
    for (let i = 0; i < grid.length; i++) if (grid[i] > maxE) maxE = grid[i];
    const step = Math.max(1, Math.floor(side / 150));
    const minSep = side * 0.09;
    let thresh = maxE * 0.6;
    let chosen: { ix: number; iy: number }[] = [];
    for (let attempt = 0; attempt < 6 && chosen.length < count; attempt++) {
      const candidates: { ix: number; iy: number; e: number }[] = [];
      for (let iy = 0; iy < h; iy += step) {
        for (let ix = 0; ix < w; ix += step) {
          const e = grid[iy * w + ix];
          if (e >= thresh && !isBlocked(ix, iy)) candidates.push({ ix, iy, e });
        }
      }
      candidates.sort((a, b) => b.e - a.e);
      const rnd = stream(seed + ':rsrc');
      const startSkip = candidates.length > 0 ? Math.floor(rnd() * Math.min(10, candidates.length)) : 0;
      chosen = [];
      for (let pass = 0; pass < 2 && chosen.length < count; pass++) {
        const begin = pass === 0 ? startSkip : 0;
        const end = pass === 0 ? candidates.length : startSkip;
        for (let i = begin; i < end && chosen.length < count; i++) {
          const c = candidates[i];
          if (chosen.every((s) => Math.hypot(c.ix - s.ix, c.iy - s.iy) >= minSep)) {
            chosen.push({ ix: c.ix, iy: c.iy });
          }
        }
      }
      thresh *= 0.85;
    }
    return chosen;
  }

  // Small on purpose: with the continental gradient as strong as it is here,
  // a real local pit only ever needs a short hop to find lower ground again.
  // A large search radius risks finding a "lower" cell that's only lower in
  // absolute terms — geographically nowhere near the pit — dragging a long,
  // nonsensical corridor across the map (through unrelated terrain, even
  // through another river's territory) when it gets carved.
  const ESCAPE_MAX_R = Math.max(5, Math.round(side * 0.03));

  function findEscape(cx: number, cy: number, curElev: number, maxR = ESCAPE_MAX_R): { x: number; y: number } | null {
    for (let r = 1; r <= maxR; r++) {
      let best: { x: number; y: number } | null = null;
      let bestE = Infinity;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          if (isBlocked(nx, ny)) continue;
          const e = grid[ny * w + nx];
          if (e < curElev - 0.01 && e < bestE) {
            bestE = e;
            best = { x: nx, y: ny };
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /** Every integer cell on the straight line between two points (excluding
   *  the start) — so an escape jump still leaves a walkable, carve-able
   *  corridor instead of a spatial leap the carve pass never touches. */
  function walkLine(x0: number, y0: number, x1: number, y1: number): { x: number; y: number }[] {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    const pts: { x: number; y: number }[] = [];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(x0 + dx * t);
      const y = Math.round(y0 + dy * t);
      const last = pts[pts.length - 1];
      if (!last || last.x !== x || last.y !== y) pts.push({ x, y });
    }
    return pts;
  }

  function traceRiver(startIx: number, startIy: number): { ix: number; iy: number }[] {
    const path: { ix: number; iy: number }[] = [{ ix: startIx, iy: startIy }];
    const pushCell = (ix: number, iy: number) => {
      const last = path[path.length - 1];
      if (last.ix !== ix || last.iy !== iy) path.push({ ix, iy });
    };
    let cx = startIx;
    let cy = startIy;
    const maxSteps = side * 4;
    for (let step = 0; step < maxSteps; step++) {
      const curElev = grid[cy * w + cx];
      if (curElev <= SEA_LEVEL) break;
      if (cx <= 0 || cx >= w - 1 || cy <= 0 || cy >= h - 1) break;

      let bestScore = Infinity;
      let bestX = -1;
      let bestY = -1;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          if (isBlocked(nx, ny)) continue;
          const e = grid[ny * w + nx];
          const bias = (hash2(saltRiverBias, nx, ny) - 0.5) * 0.001;
          const score = e + bias;
          if (score < bestScore) {
            bestScore = score;
            bestX = nx;
            bestY = ny;
          }
        }
      }
      if (bestX < 0) break; // fully boxed in by protected ground

      if (grid[bestY * w + bestX] > curElev - 0.001) {
        const esc = findEscape(cx, cy, curElev);
        if (!esc) break; // no lower ground reachable — inland basin, stop here
        // Walk the whole corridor to the escape point (not just teleport to
        // it) so every cell in between is part of the path the carve pass
        // will clamp to a non-increasing profile too.
        for (const p of walkLine(cx, cy, esc.x, esc.y)) {
          if (p.x < 0 || p.x >= w || p.y < 0 || p.y >= h) continue;
          pushCell(p.x, p.y);
        }
        cx = esc.x;
        cy = esc.y;
      } else {
        cx = bestX;
        cy = bestY;
        pushCell(cx, cy);
      }
    }
    return path;
  }

  // Bilinear sample straight off the live grid — defined once, used both
  // while carving (so "carved" and "sampled" can never disagree) and as
  // the realm's own returned `sample()`.
  const cellClamped = (ix: number, iy: number): number => {
    ix = ix < 0 ? 0 : ix > w - 1 ? w - 1 : ix;
    iy = iy < 0 ? 0 : iy > h - 1 ? h - 1 : iy;
    return grid[iy * w + ix];
  };
  const sampleGrid = (u: number, v: number): number => {
    const fx = clamp01(u) * (w - 1);
    const fy = clamp01(v) * (h - 1);
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const a = cellClamped(x0, y0) * (1 - tx) + cellClamped(x0 + 1, y0) * tx;
    const b = cellClamped(x0, y0 + 1) * (1 - tx) + cellClamped(x0 + 1, y0 + 1) * tx;
    return a * (1 - ty) + b * ty;
  };
  /** The (up to 4) grid cell indices sampleGrid(u,v) actually blends. */
  const cornersOf = (u: number, v: number): number[] => {
    const fx = clamp01(u) * (w - 1);
    const fy = clamp01(v) * (h - 1);
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const out: number[] = [];
    for (const [x, y] of [
      [x0, y0],
      [x0 + 1, y0],
      [x0, y0 + 1],
      [x0 + 1, y0 + 1],
    ]) {
      if (x >= 0 && x < w && y >= 0 && y < h) out.push(y * w + x);
    }
    return out;
  };

  function resamplePolyline(pts: UV[], n: number): UV[] {
    if (pts.length === 1) return Array.from({ length: n }, () => ({ ...pts[0] }));
    const cum: number[] = [0];
    for (let i = 1; i < pts.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(pts[i].u - pts[i - 1].u, pts[i].v - pts[i - 1].v));
    }
    const total = cum[cum.length - 1] || 1e-9;
    const out: UV[] = [];
    let k = 0;
    for (let i = 0; i < n; i++) {
      const target = (total * i) / (n - 1);
      while (k < cum.length - 2 && cum[k + 1] < target) k++;
      const segLen = cum[k + 1] - cum[k] || 1e-9;
      const f = clamp01((target - cum[k]) / segLen);
      out.push({
        u: lerp(pts[k].u, pts[k + 1].u, f),
        v: lerp(pts[k].v, pts[k + 1].v, f),
      });
    }
    return out;
  }

  function smoothPolyline(pts: UV[], passes: number, alpha: number): UV[] {
    let cur = pts;
    for (let p = 0; p < passes; p++) {
      const next: UV[] = cur.map((pt, i) => {
        if (i === 0 || i === cur.length - 1) return pt;
        return {
          u: pt.u * (1 - alpha) + alpha * 0.5 * (cur[i - 1].u + cur[i + 1].u),
          v: pt.v * (1 - alpha) + alpha * 0.5 * (cur[i - 1].v + cur[i + 1].v),
        };
      });
      cur = next;
    }
    return cur;
  }

  // ── Rivers: route by steepest descent, THEN resample+smooth to the
  //    final ~90-point courses, THEN carve exactly those courses. Carving
  //    the RETURNED course (rather than the raw traced cell path) is what
  //    guarantees "the terrain and the river course agree": sampling the
  //    final course can never disagree with what got carved, because it's
  //    the very thing that got carved. ─────────────────────────────────
  const riverCountRoll = stream(seed + ':rcount')();
  const riverCount = 4 + Math.floor(riverCountRoll * 3); // 4..6
  const sources = pickRiverSources(riverCount);
  const rawPaths = sources.map((s) => traceRiver(s.ix, s.iy)).filter((p) => p.length >= 2);

  const rivers: UV[][] = rawPaths.map((p) => {
    const uvPath = p.map(({ ix, iy }) => ({ u: ix / (w - 1), v: iy / (h - 1) }));
    const resampled = resamplePolyline(uvPath, 90);
    return smoothPolyline(resampled, 1, 0.25);
  });

  // Cells any course's pass has ever written to, or reserved, ever — FIRST
  // COURSE TO REACH A CELL OWNS IT, permanently, for the rest of carving.
  // Two different rivers occasionally pass close enough to genuinely share
  // a bilinear corner (a real near-confluence, or a rare long detour where
  // a river had to route around a local pit). Letting a LATER course keep
  // adjusting an EARLIER course's already-settled cell is exactly what
  // broke monotonicity here before: one course's clamp would lower only a
  // FEW of another course's points — wherever they happened to share a
  // cell — leaving that other course's untouched points sitting higher
  // than ones now artificially pulled down, inverting its order even
  // though every individual touch, in isolation, only ever lowered a cell.
  // Claiming permanently avoids that: nothing may touch a cell it doesn't
  // own, so a settled course's own profile can never move again.
  const claimed = new Set<number>();
  const CARVE_R = 3;
  const CARVE_SLOPE_UP = 9;
  for (const course of rivers) {
    // Pass 1: force every un-claimed corner of every point (after the
    // source) down to at most the running elevation. sampleGrid is a
    // convex (bilinear) blend of a point's corners, so once every corner
    // is <= running, the sampled elevation at that exact uv point is
    // PROVABLY <= running too — independent of how far smoothing nudged
    // the point off the raw traced cells.
    let running = sampleGrid(course[0].u, course[0].v);
    const runningPerPoint: number[] = [running];
    const myCorners = new Set<number>();
    for (let i = 1; i < course.length; i++) {
      const { u, v } = course[i];
      for (const k of cornersOf(u, v)) {
        myCorners.add(k);
        if (claimed.has(k)) continue; // an earlier course already settled this cell
        if (grid[k] > running) grid[k] = running;
      }
      const e = sampleGrid(u, v);
      running = Math.min(running, e);
      runningPerPoint.push(running);
    }
    // Claim every corner this course touched — including any it found
    // already claimed — so pass 2 (and every later course) leaves them
    // alone from here on.
    for (const k of myCorners) claimed.add(k);

    // Pass 2: widen into a valley so a lightly-smoothed point that lands a
    // cell or two off the exact centreline still reads as descending —
    // every un-claimed cell within CARVE_R gets a ceiling that rises
    // gently with distance. Never touches a claimed cell.
    for (let i = 1; i < course.length; i++) {
      const { u, v } = course[i];
      const cx = Math.round(clamp01(u) * (w - 1));
      const cy = Math.round(clamp01(v) * (h - 1));
      const e = runningPerPoint[i];
      for (let dy = -CARVE_R; dy <= CARVE_R; dy++) {
        for (let dx = -CARVE_R; dx <= CARVE_R; dx++) {
          const dist = Math.hypot(dx, dy);
          if (dist > CARVE_R || dist === 0) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const nIdx = ny * w + nx;
          if (claimed.has(nIdx)) continue;
          const ceiling = e + CARVE_SLOPE_UP * dist;
          if (ceiling < grid[nIdx]) grid[nIdx] = ceiling;
        }
      }
    }
  }

  // Final min/max: scan the grid AFTER every mutation (keepDry, carving).
  let minElev = Infinity;
  let maxElev = -Infinity;
  for (let i = 0; i < grid.length; i++) {
    const e = grid[i];
    if (e < minElev) minElev = e;
    if (e > maxElev) maxElev = e;
  }

  // ── Relief interface: cell / sample / toUV, same shape as relief.ts. ──
  const cell = (ix: number, iy: number): number => cellClamped(Math.round(ix), Math.round(iy));
  const sample = sampleGrid;

  const toUV = (x: number, y: number) => ({
    u: (x - WEST) / (EAST - WEST),
    v: (NORTH - y) / (NORTH - SOUTH),
  });

  return {
    w,
    h,
    west: WEST,
    south: SOUTH,
    east: EAST,
    north: NORTH,
    minElev,
    maxElev,
    cell,
    sample,
    toUV,
    seaLevel: SEA_LEVEL,
    rivers,
  };
}
