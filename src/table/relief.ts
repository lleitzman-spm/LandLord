/**
 * The realm's relief — BAKED ground, loaded from the committed asset.
 *
 * `public/fantasy-relief.bin` is baked by `tools/bake-fantasy-relief.mjs` (see
 * that file's header for the byte format). This module only loads, samples and
 * converts; it invents nothing and it knows nothing about which land it is on.
 *
 * `Relief` is the seam the ratified land ruling turns on (`docs/KINGDOM.md`,
 * "The land itself is INVENTED"): the realm the board draws is a fantasy realm,
 * and a real survey — should one ever be wanted — arrives behind THIS interface,
 * which `src/table/fantasyRelief.ts` also satisfies live and unbaked. Swapping
 * the ground is a change of source, never a rewrite.
 *
 * Coordinates are the realm's own unit box (west 0 → east 1, north 1 → south 0),
 * not longitude and latitude. Nothing here is a claim about the real world, and
 * the law that rides with that: **generated land may never be presented as a
 * finding.** The doors carry the data; the ground is scenery.
 */

export interface Relief {
  /** Grid size. Row 0 is the NORTH edge. */
  w: number;
  h: number;
  /** The realm's coordinate frame (a unit box). */
  west: number;
  south: number;
  east: number;
  north: number;
  /** Elevation range, metres. */
  minElev: number;
  maxElev: number;
  /** Elevation at a grid cell, metres (clamped to the grid). */
  cell(ix: number, iy: number): number;
  /** Bilinear elevation, metres. u: 0=west→1=east, v: 0=north→1=south. */
  sample(u: number, v: number): number;
  /** A point in the realm's frame → uv on the relief. */
  toUV(x: number, y: number): { u: number; v: number };
}

export async function loadRelief(url = '/fantasy-relief.bin'): Promise<Relief> {
  const buf = await (await fetch(url)).arrayBuffer();
  const head = new DataView(buf, 0, 24);
  const west = head.getFloat32(0, true);
  const south = head.getFloat32(4, true);
  const east = head.getFloat32(8, true);
  const north = head.getFloat32(12, true);
  const minElev = head.getFloat32(16, true);
  const maxElev = head.getFloat32(20, true);
  const raw = new Uint16Array(buf, 24);
  // The bake writes a square grid; recover its side from the payload.
  const side = Math.round(Math.sqrt(raw.length));
  const w = side;
  const h = side;
  const span = maxElev - minElev;

  const cell = (ix: number, iy: number): number => {
    ix = Math.max(0, Math.min(w - 1, ix));
    iy = Math.max(0, Math.min(h - 1, iy));
    return minElev + (raw[iy * w + ix] / 65535) * span;
  };

  const sample = (u: number, v: number): number => {
    const fx = Math.max(0, Math.min(1, u)) * (w - 1);
    const fy = Math.max(0, Math.min(1, v)) * (h - 1);
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const a = cell(x0, y0) * (1 - tx) + cell(x0 + 1, y0) * tx;
    const b = cell(x0, y0 + 1) * (1 - tx) + cell(x0 + 1, y0 + 1) * tx;
    return a * (1 - ty) + b * ty;
  };

  const toUV = (x: number, y: number) => ({
    u: (x - west) / (east - west),
    v: (north - y) / (north - south),
  });

  return { w, h, west, south, east, north, minElev, maxElev, cell, sample, toUV };
}

/**
 * The rivers of the realm, as approximate courses in the realm's unit frame
 * (x: 0 = west → 1 = east, y: 0 = south → 1 = north). Each vertex is SNAPPED to
 * the lowest ground in a small window of the loaded relief, so the painted
 * ribbon hugs whatever valley the ground actually has — the hand-set course
 * only has to be roughly right. Invented water on invented ground.
 */
export const RIVER_COURSES: { name: string; pts: [number, number][] }[] = [
  {
    name: 'the Kingswater',
    pts: [
      [0.50, 0.62], [0.52, 0.48], [0.53, 0.37], [0.55, 0.28],
      [0.59, 0.18], [0.64, 0.10], [0.68, 0.03],
    ],
  },
  {
    name: 'the Marlbrook',
    pts: [
      [0.02, 0.34], [0.14, 0.29], [0.28, 0.24], [0.39, 0.21],
      [0.50, 0.18], [0.58, 0.19],
    ],
  },
  {
    name: 'Aldercreek',
    pts: [
      [0.54, 0.80], [0.60, 0.68], [0.64, 0.56], [0.66, 0.46],
      [0.64, 0.36], [0.60, 0.28],
    ],
  },
  {
    name: 'Fenn Creek',
    pts: [
      [0.24, 0.78], [0.28, 0.66], [0.33, 0.56], [0.37, 0.46],
      [0.41, 0.36], [0.45, 0.28],
    ],
  },
  {
    name: 'Stonebeck',
    pts: [
      [0.59, 0.99], [0.68, 0.93], [0.79, 0.81], [0.87, 0.70],
      [0.92, 0.56], [0.97, 0.46],
    ],
  },
];

/** A river course snapped to the relief's own valleys, in uv space,
 *  resampled to many small steps for smooth painting. */
export function snappedCourse(relief: Relief, pts: [number, number][], steps = 90): { u: number; v: number }[] {
  // First, snap each hand-set vertex to the lowest cell in a window.
  const snapped = pts.map(([x, y]) => {
    const { u, v } = relief.toUV(x, y);
    let bx = Math.round(u * (relief.w - 1));
    let by = Math.round(v * (relief.h - 1));
    let best = Infinity;
    let fx = bx;
    let fy = by;
    const R = 6;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const e = relief.cell(bx + dx, by + dy) + (Math.abs(dx) + Math.abs(dy)) * 0.35;
        if (e < best) {
          best = e;
          fx = bx + dx;
          fy = by + dy;
        }
      }
    }
    return { u: fx / (relief.w - 1), v: fy / (relief.h - 1) };
  });
  // Then resample along the polyline with light smoothing.
  const out: { u: number; v: number }[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / (steps - 1)) * (snapped.length - 1);
    const k = Math.min(snapped.length - 2, Math.floor(t));
    const f = t - k;
    out.push({
      u: snapped[k].u * (1 - f) + snapped[k + 1].u * f,
      v: snapped[k].v * (1 - f) + snapped[k + 1].v * f,
    });
  }
  return out;
}
