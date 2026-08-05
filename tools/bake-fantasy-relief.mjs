/**
 * Bake the realm's relief — INVENTED ground, deterministic, into the repo.
 *
 * The land the war table draws is a fantasy realm, not a real county
 * (`docs/KINGDOM.md`, "The land itself is INVENTED"). This tool generates that
 * ground from a seed string and writes ONE small asset:
 *
 *   public/fantasy-relief.bin
 *     header  (24 bytes): 6 float32 LE — west, south, east, north (realm
 *                         coordinates, a unit box), minElev, maxElev (metres)
 *     payload: width*height uint16 LE, row 0 = NORTH edge, elevation
 *              normalized 0..65535 between minElev and maxElev.
 *
 * The format is exactly what `src/table/relief.ts` loads, so the baked path and
 * the live procedural path (`src/table/fantasyRelief.ts`) are interchangeable.
 *
 * NOTHING here reaches the network and nothing here is measured from the real
 * world: value-noise fBm over a seeded FNV-1a + xorshift stream, shaped by two
 * hand-placed control curves (a mountain spine on the north/north-east edge, a
 * coastline eating into the south-west corner). Same seed, same bytes, forever
 * — which is the point: a committed binary nobody can regenerate is a mystery,
 * and a mystery in a public repo is a liability.
 *
 *   node tools/bake-fantasy-relief.mjs            # default seed
 *   node tools/bake-fantasy-relief.mjs my-realm   # another realm
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');

// ── The realm's frame: a unit box, deliberately not a place ────────────────
const WEST = 0, EAST = 1, SOUTH = 0, NORTH = 1;
const SIDE = 300;                       // 300 × 300 cells
const SEED = process.argv[2] || 'the-realm';

// ── Deterministic hash / stream (FNV-1a + xorshift-mix) ────────────────────

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mix32(x) {
  x |= 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}

/** A stable pseudo-random in [0,1) for an integer lattice point. */
const at = (base, ix, iy) => mix32(base ^ Math.imul(ix, 0x27d4eb2f) ^ Math.imul(iy, 0x165667b1)) / 0x100000000;

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/** Bilinear value noise on a lattice of `freq` cells across the unit square. */
function valueNoise(base, u, v, freq) {
  const x = u * freq, y = v * freq;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const tx = fade(x - x0), ty = fade(y - y0);
  const a = at(base, x0, y0) * (1 - tx) + at(base, x0 + 1, y0) * tx;
  const b = at(base, x0, y0 + 1) * (1 - tx) + at(base, x0 + 1, y0 + 1) * tx;
  return a * (1 - ty) + b * ty;
}

/** Fractal Brownian motion — five octaves, halving amplitude. */
function fbm(base, u, v, freq = 3, octaves = 5) {
  let sum = 0, amp = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(base ^ (o * 0x9e3779b9), u, v, freq * 2 ** o);
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

// ── The land ───────────────────────────────────────────────────────────────
//
// Two control curves give the realm a readable shape rather than uniform mush:
//
//   spine     — high ground hugging the north / north-east edge
//   seaward   — a wiggly coast eating into the south-west corner
//
// Both are cheap smooth functions of position, so the terrain is legible at a
// glance and still different for every seed.

const base = fnv1a(SEED);
const wob = fnv1a(SEED + ':coast');

function height(u, v) {
  // v: 0 = north, 1 = south. The spine sits in the north-east.
  const spine = Math.max(0, 1 - Math.hypot((u - 0.78) * 0.9, (v - 0.12) * 1.6)) ** 1.6;
  // A wobbling coastline running roughly NW→SE across the south-west corner.
  const wobble = (valueNoise(wob, v, 0.5, 6) - 0.5) * 0.22;
  const seaward = (u + (1 - v)) * 0.5 + wobble;   // 0 in the SW corner, 1 in the NE
  const shelf = Math.max(0, Math.min(1, (seaward - 0.24) / 0.30));

  const rough = fbm(base, u, v);
  // Land rises from the shelf, the spine piles on top, noise roughens it all.
  const land = shelf * (0.30 + 0.55 * rough) + spine * 0.95;
  return land - 0.06;   // a little below zero out at sea
}

// ── Bake ───────────────────────────────────────────────────────────────────

const raw = new Float32Array(SIDE * SIDE);
let lo = Infinity, hi = -Infinity;
for (let iy = 0; iy < SIDE; iy++) {
  const v = iy / (SIDE - 1);
  for (let ix = 0; ix < SIDE; ix++) {
    const u = ix / (SIDE - 1);
    const h = height(u, v);
    raw[iy * SIDE + ix] = h;
    if (h < lo) lo = h;
    if (h > hi) hi = h;
  }
}

// Map the unit-ish field onto a plausible metre range, so slope shading and the
// river walk behave as they did on baked ground.
const MIN_M = 110, MAX_M = 585;
const span = hi - lo;
const metres = (h) => MIN_M + ((h - lo) / span) * (MAX_M - MIN_M);

const buf = Buffer.alloc(24 + SIDE * SIDE * 2);
buf.writeFloatLE(WEST, 0);
buf.writeFloatLE(SOUTH, 4);
buf.writeFloatLE(EAST, 8);
buf.writeFloatLE(NORTH, 12);
buf.writeFloatLE(MIN_M, 16);
buf.writeFloatLE(MAX_M, 20);
for (let i = 0; i < raw.length; i++) {
  const norm = (metres(raw[i]) - MIN_M) / (MAX_M - MIN_M);
  buf.writeUInt16LE(Math.round(Math.max(0, Math.min(1, norm)) * 65535), 24 + i * 2);
}

const outPath = join(repo, 'public', 'fantasy-relief.bin');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, buf);
console.log(
  `wrote ${outPath} — ${SIDE}×${SIDE}, seed "${SEED}", ` +
  `${MIN_M}–${MAX_M} m, ${buf.length} bytes`,
);
