/**
 * Bake the war table's scene data into one JSON the Blender oven can eat.
 *
 * Blender's Python cannot read our TypeScript, and we refuse to reimplement
 * the layout in a second language — a piece that stands in one place in the
 * app and another in the render is worse than no render. So this runs the
 * REAL `src/table/parcels.ts` (Node 22 strips the types) and the REAL baked
 * relief, and writes what both produce.
 *
 *   node --experimental-strip-types tools/bake-table-scene.mjs [out.json]
 *
 * Everything below the relief loader is transport, not decision: the shape
 * of the shire is decided in parcels.ts and nowhere else.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { workingFluidParcels, modularParcels } from '../src/table/parcels.ts';
import { RIVER_COURSES } from '../src/table/relief.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

// ── The relief, decoded from the same asset the browser loads ─────────────

function loadRelief(path) {
  const buf = readFileSync(path);
  const head = new DataView(buf.buffer, buf.byteOffset, 24);
  const west = head.getFloat32(0, true);
  const south = head.getFloat32(4, true);
  const east = head.getFloat32(8, true);
  const north = head.getFloat32(12, true);
  const minElev = head.getFloat32(16, true);
  const maxElev = head.getFloat32(20, true);
  const raw = new Uint16Array(buf.buffer, buf.byteOffset + 24, (buf.byteLength - 24) / 2);
  const side = Math.round(Math.sqrt(raw.length));
  const span = maxElev - minElev;

  const cell = (ix, iy) => {
    ix = Math.max(0, Math.min(side - 1, ix));
    iy = Math.max(0, Math.min(side - 1, iy));
    return minElev + (raw[iy * side + ix] / 65535) * span;
  };
  const sample = (u, v) => {
    const fx = Math.max(0, Math.min(1, u)) * (side - 1);
    const fy = Math.max(0, Math.min(1, v)) * (side - 1);
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const a = cell(x0, y0) * (1 - tx) + cell(x0 + 1, y0) * tx;
    const b = cell(x0, y0 + 1) * (1 - tx) + cell(x0 + 1, y0 + 1) * tx;
    return a * (1 - ty) + b * ty;
  };
  const toUV = (x, y) => ({
    u: (x - west) / (east - west),
    v: (north - y) / (north - south),
  });

  // Elevations as a plain row-major array of metres, row 0 = NORTH edge.
  const grid = new Array(side * side);
  for (let iy = 0; iy < side; iy++) {
    for (let ix = 0; ix < side; ix++) grid[iy * side + ix] = cell(ix, iy);
  }
  return { side, west, south, east, north, minElev, maxElev, grid, sample, toUV };
}

// The river snapping lives in relief.ts against a Relief interface; rather
// than reconstruct that interface here, snap with the same rule directly.
function snapCourse(relief, pts, steps = 90) {
  const snapped = pts.map(([x, y]) => {
    const { u, v } = relief.toUV(x, y);
    let bx = Math.round(u * (relief.side - 1));
    let by = Math.round(v * (relief.side - 1));
    let best = Infinity;
    let fx = bx;
    let fy = by;
    const R = 6;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const ix = Math.max(0, Math.min(relief.side - 1, bx + dx));
        const iy = Math.max(0, Math.min(relief.side - 1, by + dy));
        const e = relief.grid[iy * relief.side + ix] + (Math.abs(dx) + Math.abs(dy)) * 0.35;
        if (e < best) {
          best = e;
          fx = bx + dx;
          fy = by + dy;
        }
      }
    }
    return { u: fx / (relief.side - 1), v: fy / (relief.side - 1) };
  });
  const out = [];
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

// ── Bake ──────────────────────────────────────────────────────────────────

// The geographic frame. Since 2026-07-28 this is an arbitrary coordinate
// system, not a claim about anywhere — the realm is invented (KINGDOM.md).
const FRAME = { west: 0, south: 0, east: 1, north: 1 };
const frameUV = (x, y) => ({
  u: (x - FRAME.west) / (FRAME.east - FRAME.west),
  v: (FRAME.north - y) / (FRAME.north - FRAME.south),
});

// The lattice is the default now (Edwin, 2026-07-29 — deterministic, discrete
// modularity). `--scattered` keeps the old organic placement reachable for a
// side-by-side, since the two are one flag apart and the comparison is the
// whole argument.
const source = process.argv.includes('--scattered') ? workingFluidParcels() : modularParcels();
// The parcel address, when the lattice is in use — block/col/row IS the
// position now, so it travels with the record rather than being re-derived
// downstream by clustering pixels back into neighbourhoods.
const parcelOf = source.parcelOf ?? (() => null);
const doors = source.doors();
const knights = source.knights();

// `--baked` keeps the retired real ground reachable. The real-ground bake is not
// deleted and the realm satisfies the same interface, so the day a real map
// is wanted it is a swap of source, not a rewrite (WRIT §8, amended).
// The realm module is imported LAZILY so that `--baked` keeps working even
// when it is absent, and so a missing realm fails with a sentence rather than
// an unresolved-import stack trace.
const useBaked = process.argv.includes('--baked');
let relief;
if (useBaked) {
  relief = loadRelief(resolve(root, 'public/fantasy-relief.bin'));
} else {
  let mod;
  try {
    mod = await import('../src/table/fantasyRelief.ts');
  } catch (err) {
    console.error('No realm to bake: src/table/fantasyRelief.ts did not load.');
    console.error('Run with --baked to fall back to the retired real ground.');
    console.error(String(err && err.message ? err.message : err));
    process.exit(1);
  }
  relief = mod.fantasyRelief({
    seed: process.env.REALM_SEED || 'the-realm',
    side: 300,
    // the holdings must stand on dry, habitable lowland — the realm is
    // generated around where the shire already is, not the other way round
    keepDry: doors.concat(knights).map((d) => frameUV(d.x, d.y)),
  });
}

// Each piece carries its uv on the relief and the ground height under it, so
// Blender never has to know what a longitude is.
const place = (x, y) => {
  const { u, v } = relief.toUV(x, y);
  return { u, v, elev: relief.sample(u, v) };
};

// The two sources agree on the interface but not on their innards: the baked
// grid carries a flat array, the generated realm answers through cell(). Read
// whichever exists so nothing downstream has to know which land it is looking at.
const side = relief.side ?? relief.w;
const grid = relief.grid
  ? relief.grid
  : Array.from({ length: side * side }, (_, i) => relief.cell(i % side, Math.floor(i / side)));

const scene = {
  note: 'Baked by tools/bake-table-scene.mjs — do not hand-edit. Positions come from src/table/parcels.ts.',
  land: useBaked ? 'fantasy-realm' : 'fantasy-realm',
  seaLevel: useBaked ? null : relief.seaLevel,
  relief: {
    side,
    west: relief.west,
    south: relief.south,
    east: relief.east,
    north: relief.north,
    minElev: relief.minElev,
    maxElev: relief.maxElev,
    grid: grid.map((e) => Math.round(e * 100) / 100),
  },
  rivers: useBaked
    ? RIVER_COURSES.map((r) => ({ name: r.name, pts: snapCourse({ ...relief, side, grid }, r.pts) }))
    : relief.rivers.map((pts, i) => ({ name: `river ${i + 1}`, pts })),
  doors: doors.map((d) => {
    const p = place(d.x, d.y);
    return {
      id: d.id, street: d.street, kind: d.kind, state: d.state,
      parcel: parcelOf(d.id) ?? null,
      tone: d.tone, lean: d.lean, size: d.size,
      u: p.u, v: p.v, elev: p.elev,
    };
  }),
  knights: knights.map((k) => {
    const p = place(k.x, k.y);
    return { id: k.id, name: k.name, lean: k.lean, u: p.u, v: p.v, elev: p.elev };
  }),
};

// Skip flags when picking the output path — `--baked` on its own once wrote a
// file literally named "--baked" into the repo root.
const out = process.argv.slice(2).find((a) => !a.startsWith('-'))
  || resolve(root, 'public/table-scene.json');
writeFileSync(out, JSON.stringify(scene));

const tally = {};
for (const d of scene.doors) tally[d.state] = (tally[d.state] || 0) + 1;
console.log(`placement ${process.argv.includes('--scattered') ? 'scattered (organic)' : 'MODULAR (parcel lattice)'}`);
console.log(`land ${scene.land}${scene.seaLevel != null ? ` (sea ${scene.seaLevel.toFixed(0)}m)` : ''}`);
console.log(`relief ${side}×${side}, ${relief.minElev.toFixed(0)}–${relief.maxElev.toFixed(0)}m`);
const dry = scene.doors.filter((d) => scene.seaLevel == null || d.elev > scene.seaLevel).length;
console.log(`doors on dry land: ${dry}/${scene.doors.length}`);
console.log(`doors ${scene.doors.length}`, tally);
console.log(`knights ${scene.knights.length}, rivers ${scene.rivers.length}`);
console.log(`→ ${out}`);
