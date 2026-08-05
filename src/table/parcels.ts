/**
 * The pieces' positions — WORKING FLUID behind a stable interface.
 *
 * The app holds no real parcels (the data gate — see the writ's ANSWERED
 * §12.2, on the record). These ~203 doors are invented: plausible clusters
 * across the realm’s relief, named in the muster's own style, never a real
 * address. When the gate opens, a real source implements the same
 * `ParcelSource` and the table redraws with true positions — nothing above
 * this interface changes.
 *
 * Every position is deterministic (hash streams from stable ids, the realm's
 * standing rule): the same shire lands on the same table every load.
 */

export type DoorKind = 'cottage' | 'house' | 'wide';
export type DoorState = 'held' | 'bare' | 'vacant' | 'crisis' | 'fallen';

export interface DoorPiece {
  id: string;
  /** Invented street, muster style. Never a real address. */
  street: string;
  x: number;
  y: number;
  kind: DoorKind;
  state: DoorState;
  /** 0..1 — paint-tone jitter, the handmade irregularity of a batch. */
  tone: number;
  /** Small lean off vertical, radians — no two pieces set down alike. */
  lean: number;
  /** Scale around 1. */
  size: number;
}

export interface KnightPiece {
  id: string;
  name: string;
  x: number;
  y: number;
  lean: number;
}

export interface ParcelSource {
  doors(): DoorPiece[];
  knights(): KnightPiece[];
}

// ── Deterministic streams (FNV-1a, as the realm lays out) ─────────────────

function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function stream(seed: string): () => number {
  let s = hashId(seed);
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 16), 0x21f0aaad);
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
    return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
  };
}

/** Sum of two rolls − 1: a cheap bell curve, so clusters thin at the edge. */
const bell = (r: () => number) => r() + r() - 1;

// ── The invented shire ────────────────────────────────────────────────────

/**
 * Where a single-family portfolio actually pools: subdivision belts, not a
 * grid. The belts are broken into NEIGHBOURHOOD KNOTS — more of them, and
 * smaller, than the first pass's eight great blobs, in which 203 pieces
 * clumped into about eight visible things. Within a knot the pieces stand
 * along short curved LANES (a subdivision on a terrain board reads as rows
 * of little roofs, not a heap), and a relaxation pass below guarantees no
 * piece swallows its neighbour. dir is the lane bearing in radians, 0 = east.
 */
const KNOTS: { x: number; y: number; n: number; dir: number }[] = [
  // NE belt (Universal City way) — the heaviest country
  { x: 0.8095, y: 0.6533, n: 20, dir: 0.5 },
  { x: 0.8603, y: 0.5933, n: 16, dir: -0.3 },
  { x: 0.7619, y: 0.7033, n: 12, dir: 0.9 },
  // inner NE
  { x: 0.7111, y: 0.57, n: 14, dir: -0.6 },
  { x: 0.6587, y: 0.62, n: 12, dir: 0.2 },
  // west side
  { x: 0.3048, y: 0.5133, n: 16, dir: 0.15 },
  { x: 0.2333, y: 0.4633, n: 14, dir: -0.45 },
  // north central
  { x: 0.4889, y: 0.73, n: 12, dir: 0.7 },
  { x: 0.5429, y: 0.6867, n: 10, dir: -0.2 },
  // south side
  { x: 0.4127, y: 0.2967, n: 12, dir: 0.35 },
  { x: 0.4794, y: 0.3367, n: 10, dir: -0.5 },
  // southeast
  { x: 0.6, y: 0.3467, n: 10, dir: 0.1 },
  { x: 0.654, y: 0.4033, n: 8, dir: 0.85 },
  // NW fringe
  { x: 0.2413, y: 0.66, n: 12, dir: -0.35 },
  // east fringe
  { x: 0.8762, y: 0.53, n: 9, dir: 0.4 },
  // the northern toehold under the escarpment
  { x: 0.4159, y: 0.8133, n: 8, dir: 0.25 },
];
const STRAYS = 8; // and a few doors far from any fellowship
// knots 195 + strays 8 = 203

// Degrees per world unit of the 40 × 43.5 relief block (0.63° × 0.60°).
const X_PER_UNIT = 1 / 40;
const Y_PER_UNIT = 1 / 43.5;
/** Spacing along a lane / between lanes, in world units (a cottage stands
 *  ~0.75 wide, so lanes read as rows of distinct roofs, near-touching). */
const ALONG_SP = 0.84;
const ROW_SP = 1.3;
/** No two pieces closer than this (world units) after relaxation. */
const MIN_SEP = 0.62;

const STEM = [
  'Cobble', 'Mill', 'Ash', 'Thorn', 'Bram', 'Fox', 'Harrow', 'Wick', 'Alder',
  'Stone', 'Marsh', 'Hay', 'Rye', 'Bell', 'Crook', 'Fen', 'Gorse', 'Heath',
  'Elm', 'Oaken', 'Tanner', 'Wain', 'Candle', 'Frost', 'Lark', 'Badger',
];
const ROOT = ['gate', 'brook', 'field', 'mead', 'wood', 'croft', 'well', 'bourne', 'leigh', 'moor', 'row', 'stead'];
const WAYS = ['Lane', 'Way', 'Row', 'Court', 'Close', 'Walk', 'End'];

function streetName(r: () => number): string {
  const num = 3 + Math.floor(r() * 97) * (1 + Math.floor(r() * 9));
  return `${num} ${STEM[Math.floor(r() * STEM.length)]}${ROOT[Math.floor(r() * ROOT.length)]} ${WAYS[Math.floor(r() * WAYS.length)]}`;
}

const KNIGHT_NAMES = ['Sir Aldous', 'Sir Brannoc', 'Dame Yseult', 'Sir Cadfan', 'Dame Rohese'];

/** The working-fluid source: ~203 doors, five knights, all invented. */
export function workingFluidParcels(): ParcelSource {
  const doors: DoorPiece[] = [];
  let i = 0;
  const push = (x: number, y: number, r: () => number) => {
    const id = `door:${i++}`;
    const roll = r();
    // The readiness audit's own numbers, roughly: most held, 21 bare,
    // a handful vacant, a few in crisis — and ONE knocked clean over.
    const state: DoorState =
      i === 117 ? 'fallen'
      : roll < 0.105 ? 'bare'
      : roll < 0.155 ? 'vacant'
      : roll < 0.185 ? 'crisis'
      : 'held';
    const kindRoll = r();
    doors.push({
      id,
      street: streetName(r),
      x,
      y,
      kind: kindRoll < 0.45 ? 'cottage' : kindRoll < 0.82 ? 'house' : 'wide',
      state,
      tone: r(),
      lean: (r() - 0.5) * 0.11,
      size: 0.8 + r() * 0.2,
    });
  };

  // Each knot: pieces set down along short curved lanes. Layout runs in
  // world units (the table's own scale), then converts to degrees.
  KNOTS.forEach((knot, ki) => {
    const rKnot = stream(`knot:${ki}`);
    const rows = Math.max(1, Math.round(Math.sqrt(knot.n / 2.4)));
    const perRow = Math.ceil(knot.n / rows);
    const curve = (rKnot() - 0.5) * 0.14; // gentle bend, the surveyor's hand
    const cosD = Math.cos(knot.dir);
    const sinD = Math.sin(knot.dir);
    let placed = 0;
    for (let row = 0; row < rows && placed < knot.n; row++) {
      const inRow = Math.min(perRow, knot.n - placed);
      const rowOff = (row - (rows - 1) / 2) * ROW_SP + (rKnot() - 0.5) * 0.3;
      for (let j = 0; j < inRow; j++, placed++) {
        const r = stream(`door:${ki}:${row}:${j}`);
        const along = (j - (inRow - 1) / 2) * ALONG_SP + (r() - 0.5) * 0.24;
        const perp = rowOff + curve * along * along + (r() - 0.5) * 0.26;
        // rotate lane frame into east/north world offsets
        const wx = along * cosD - perp * sinD;
        const wy = along * sinD + perp * cosD;
        push(knot.x + wx * X_PER_UNIT, knot.y + wy * Y_PER_UNIT, r);
      }
    }
  });
  for (let k = 0; k < STRAYS; k++) {
    const r = stream(`stray:${k}`);
    push(0.0476 + r() * 0.8889, 0.0833 + r() * 0.8333, r);
  }

  // Relaxation: push near-coincident pieces apart until every piece holds
  // MIN_SEP of ground. Deterministic (fixed order, fixed passes) — this is
  // what makes two hundred pieces read as two hundred, not eight blobs.
  for (let pass = 0; pass < 6; pass++) {
    let moved = false;
    for (let a = 0; a < doors.length; a++) {
      for (let b = a + 1; b < doors.length; b++) {
        const dx = (doors[b].x - doors[a].x) / X_PER_UNIT;
        const dy = (doors[b].y - doors[a].y) / Y_PER_UNIT;
        const d = Math.hypot(dx, dy);
        if (d >= MIN_SEP) continue;
        moved = true;
        // Coincident pair: separate along a direction hashed from the ids.
        const ux = d < 1e-6 ? Math.cos(hashId(doors[a].id + doors[b].id)) : dx / d;
        const uy = d < 1e-6 ? Math.sin(hashId(doors[a].id + doors[b].id)) : dy / d;
        const shove = (MIN_SEP - d) / 2 + 0.01;
        doors[a].x -= ux * shove * X_PER_UNIT;
        doors[a].y -= uy * shove * Y_PER_UNIT;
        doors[b].x += ux * shove * X_PER_UNIT;
        doors[b].y += uy * shove * Y_PER_UNIT;
      }
    }
    if (!moved) break;
  }

  const knights: KnightPiece[] = KNIGHT_NAMES.map((name, k) => {
    // One banner over each of the five heaviest countries of the shire.
    const knot = KNOTS[[0, 5, 3, 7, 9][k]];
    const r = stream(`knight:${k}`);
    return {
      id: `knight:${k}`,
      name,
      x: knot.x + (bell(r) * 0.6 + 1.1) * X_PER_UNIT,
      y: knot.y + (bell(r) * 0.6 + 0.9) * Y_PER_UNIT,
      lean: (r() - 0.5) * 0.06,
    };
  });

  return { doors: () => doors, knights: () => knights };
}

// ── The modular placement — pieces on parcels, not on noise ───────────────
//
// Edwin's direction (2026-07-29), from two references that look nothing alike
// and share one property: **deterministic, discrete modularity.** A finite kit
// of pieces on SUBDIVIDED ground, density from many discrete units rather than
// from texture, and every position derived rather than scattered.
//
// `workingFluidParcels` above does the opposite, and at some cost: bell curves,
// curved lanes, per-piece jitter and a six-pass relaxation, all spent making a
// script look like a hand. It never convinced — a blind critic called the
// result a strict diagonal lattice anyway ("a village looks like a spreadsheet")
// while the effort to look organic was still being paid for. The fault was
// never that the pieces were ordered. It was that they were NEITHER honestly
// organic NOR honestly modular.
//
// So this commits. Every holding sits at the centre of a parcel on one global
// lattice. A neighbourhood is a contiguous BLOCK of parcels; the gaps between
// blocks are roads. Nothing is jittered, nothing is relaxed, and a door's
// position is a pure function of which fellowship it belongs to and its place
// within it — which means the same shire always draws the same town, and a
// piece can be found by its address rather than hunted for.
//
// The records are untouched: this re-places the doors `workingFluidParcels`
// already made, so state, street, kind and tone all stand.

/** Where the lone holdings stand — spread across open ground, each on the
 *  lattice, none adjacent to a fellowship's block. */
const STRAY_PARCELS: [number, number][] = [
  [0.86, 0.16], [0.28, 0.26], [0.68, 0.50], [0.18, 0.66],
  [0.88, 0.70], [0.50, 0.80], [0.38, 0.54], [0.76, 0.36],
];

/** Parcel pitch in uv (1/1000 of the board per unit). ~18 map units gives
 *  pieces that nearly touch at the drawn scale — dense, still countable. */
const PITCH_U = 0.019;
const PITCH_V = 0.0175;

/** Where each fellowship's block is planted, in uv. Chosen to sit on the
 *  realm's habitable middle and east and to leave the south-west (the sea)
 *  empty — the emptiness is a true finding about where nothing is held. */
const BLOCK_ORIGINS: [number, number][] = [
  [0.60, 0.20], [0.74, 0.28], [0.52, 0.14], [0.44, 0.30], [0.62, 0.38],
  [0.30, 0.44], [0.20, 0.52], [0.42, 0.46], [0.54, 0.54], [0.34, 0.62],
  [0.46, 0.66], [0.60, 0.70], [0.72, 0.60], [0.24, 0.34], [0.80, 0.44],
  [0.36, 0.22],
];

/** How many doors each fellowship holds — the KNOTS above, in order. */
const BLOCK_SIZES = KNOTS.map((k) => k.n);

export interface Parcel {
  /** Which block (fellowship) this parcel belongs to; -1 for a stray. */
  block: number;
  /** Column and row WITHIN the block — the address. */
  col: number;
  row: number;
}

/** The lattice: doors re-placed onto parcels, records unchanged. */
export function modularParcels(): ParcelSource & { parcelOf: (id: string) => Parcel } {
  const src = workingFluidParcels();
  const doors = src.doors();
  const parcels = new Map<string, Parcel>();

  let i = 0;
  BLOCK_SIZES.forEach((n, b) => {
    // A block is as square as it can be, filled row-major. Deterministic:
    // no dependence on anything but the count.
    const cols = Math.ceil(Math.sqrt(n));
    const [ou, ov] = BLOCK_ORIGINS[b];
    for (let j = 0; j < n && i < doors.length; j++, i++) {
      const col = j % cols;
      const row = Math.floor(j / cols);
      doors[i].x = FRAME_WEST + (ou + col * PITCH_U) * FRAME_X_SPAN;
      doors[i].y = FRAME_NORTH - (ov + row * PITCH_V) * FRAME_Y_SPAN;
      parcels.set(doors[i].id, { block: b, col, row });
    }
  });

  // The strays stand alone — one parcel each, scattered across the realm's open
  // ground rather than lined up. They were briefly a row of eight along the
  // southern coast, which read as a mistake instead of as "these are held
  // alone": a line is a pattern, and a pattern implies a reason that isn't
  // there. Declared positions, not hashed ones, so a stray keeps its place.
  for (let k = 0; i < doors.length; i++, k++) {
    const [ou, ov] = STRAY_PARCELS[k % STRAY_PARCELS.length];
    doors[i].x = FRAME_WEST + ou * FRAME_X_SPAN;
    doors[i].y = FRAME_NORTH - ov * FRAME_Y_SPAN;
    parcels.set(doors[i].id, { block: -1, col: k, row: 0 });
  }

  // Knights stand at their fellowship's corner, not at a hashed offset.
  const knights = src.knights();
  knights.forEach((kn, k) => {
    const b = [0, 5, 3, 7, 9][k];
    const [ou, ov] = BLOCK_ORIGINS[b];
    const cols = Math.ceil(Math.sqrt(BLOCK_SIZES[b]));
    kn.x = FRAME_WEST + (ou + cols * PITCH_U) * FRAME_X_SPAN;
    kn.y = FRAME_NORTH - (ov - PITCH_V * 0.6) * FRAME_Y_SPAN;
  });

  return { doors: () => doors, knights: () => knights, parcelOf: (id) => parcels.get(id)! };
}

/** The frame the uv lattice is expressed against — the same arbitrary
 *  coordinate system the rest of the realm uses (KINGDOM.md: the land is
 *  invented, so these are axes, not a claim about anywhere). */
const FRAME_WEST = 0;
const FRAME_NORTH = 1;
const FRAME_X_SPAN = 1;
const FRAME_Y_SPAN = 1;
