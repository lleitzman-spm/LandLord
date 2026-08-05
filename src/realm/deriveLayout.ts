/**
 * The Realm Map — deterministic layout.
 *
 * Every position in the scene is a pure function of the scene's stable ids:
 * the same scene always lands on the same map, and nothing is ever stored or
 * rolled. NEVER Math.random() for layout (the writ's leash). Randomness is
 * permitted only for cosmetic shimmer — never for where anything stands.
 *
 * The scheme (reworked 2026-07-27, Edwin's verdict): a fief is a REGION, not
 * a village. Each fief holds a TERRITORY — a stretch of land with an ink
 * border, its name lettered on it — containing fields, woods, lanes, and ONE
 * modest town. The doors spread through the fief's land as farmsteads as
 * well as town houses. The Capital holds the centre, clearly grander than
 * any town; the territories tile the land around it; ink roads run home.
 */

export interface Pt {
  x: number;
  z: number;
}

/** A scattered thing's plot: where it stands, plus the small deterministic
 *  variations that stop fifty of them reading as fifty copies — its turn on
 *  the spot, its size, and a hue nudge for its material. Same discipline as a
 *  position: hashed from the id, never rolled, never stored. */
export interface Scatter extends Pt {
  /** Turn about the vertical, radians. */
  rotY: number;
  /** Scale, around 1. */
  s: number;
  /** 0..1 — a hue nudge, so a wood is not one flat green. */
  hue: number;
}

/** FNV-1a over the id's bytes — stable across runs, machines, and sessions. */
export function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A tiny deterministic generator drawn from a hashed seed (splitmix-style).
 * Returns values in [0, 1). Used only to jitter positions around their
 * deterministic anchors — never imported where a roll could change layout.
 */
function stream(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 16), 0x21f0aaad);
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
    return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
  };
}

/** A NUMBER hashed to [0, 1) — the same discipline as `unit`, for the scatter
 *  that is keyed by an index rather than an id (trees, the Capital's
 *  wall towers). Deterministic: the wood stands in the same place every load. */
export function hash1(n: number): number {
  return hashId(`n:${n}`) / 4294967296;
}

/** Continent half-extents — the water runs to the frame beyond these.
 *  Widened hard (Edwin: the realm should FILL the view, not float in margin). */
export const CONTINENT = { width: 118, depth: 82 };

/** The land's height at a point — ONE definition, so the ground the towns sit
 *  on and the ground a tree is planted in can never disagree. A shaped
 *  continent, not a flat square: a broad dome falling into the slate sea,
 *  with gentle hills and a river valley cut through it. At or below zero is
 *  sea, and nothing is planted there. */
export function landHeight(x: number, z: number): number {
  const { width, depth } = CONTINENT;
  // The dome: 1 at the centre, 0 at the coast, negative beyond it.
  const nx = x / (width / 2);
  const nz = z / (depth / 2);
  const dome = 1 - (nx * nx + nz * nz);
  if (dome <= 0) return 0;
  // Gentle hills, and a river running north-east to south-west: the valley is
  // a trough the land dips into, so a fief beside it sits visibly lower.
  const hills = Math.sin(x * 0.11) * Math.cos(z * 0.13) * 0.8;
  const river = Math.exp(-Math.pow((x + z) * 0.055, 2)) * 0.9;
  return Math.max(0, dome * 3.6 + hills - river);
}

/** Hash of id mapped to [0, 1). */
function unit(id: string, salt: number): number {
  return hashId(`${id}#${salt}`) / 4294967296;
}

// ---------------------------------------------------------------------------
// The fief territories
// ---------------------------------------------------------------------------

/**
 * Where a fief's territory centres on the continent. The Capital holds the
 * middle ground, so the territories ring it: the index sets the seat on the
 * ring (an even share of the circle, so no two crowd), the hashed id nudges
 * the angle and the reach so the ring never reads as a clock face. `count` is
 * how many fiefs stand in all — the same fief moves when the realm grows,
 * which is right: the map is a picture of the realm as it IS.
 */
export function fiefAnchor(fiefId: string, index: number, count = 8): Pt {
  const share = Math.max(1, count);
  // A quarter-turn start puts the first fief north, where a map's eye lands.
  const angle =
    -Math.PI / 2 + (index / share) * Math.PI * 2 + (unit(fiefId, 1) - 0.5) * 0.22;
  // The territories sit between the Capital's commons and the coast.
  const reach = 30 + (unit(fiefId, 2) - 0.5) * 4;
  // The continent is wider than it is deep, so the ring is an ellipse.
  return { x: Math.cos(angle) * reach * 1.12, z: Math.sin(angle) * reach * 0.66 };
}

/** A territory's nominal radius — the land a fief holds, NOT its town's
 *  size. The town is a mark on the region; the region is the fief. */
export function territoryRadius(fiefId: string, count = 8): number {
  // Sized so neighbouring territories nearly meet along the ring.
  const base = count <= 5 ? 10.5 : 8.6;
  return base + (unit(fiefId, 3) - 0.5) * 1.4;
}

/**
 * The territory's ink border — a hand-wobbled closed loop of points in LOCAL
 * coordinates about the fief's anchor. Squashed to the ring's own ellipse so
 * neighbours meet side-by-side rather than overlap.
 */
export function territoryOutline(fiefId: string, count = 8, segs = 48): Pt[] {
  const r = territoryRadius(fiefId, count);
  const a1 = unit(fiefId, 4) * Math.PI * 2;
  const a2 = unit(fiefId, 5) * Math.PI * 2;
  const a3 = unit(fiefId, 6) * Math.PI * 2;
  const pts: Pt[] = [];
  for (let s = 0; s < segs; s++) {
    const ang = (s / segs) * Math.PI * 2;
    const wobble =
      1 +
      0.1 * Math.sin(ang * 2 + a1) +
      0.07 * Math.sin(ang * 3 + a2) +
      0.045 * Math.sin(ang * 5 + a3);
    pts.push({ x: Math.cos(ang) * r * wobble * 1.06, z: Math.sin(ang) * r * wobble * 0.72 });
  }
  return pts;
}

/** Where the fief's ONE town sits inside its territory — a modest cluster
 *  off-centre, so the land reads as the holding and the town as its mark. */
export function townLocal(fiefId: string): Pt {
  const a = unit(fiefId, 7) * Math.PI * 2;
  const d = 1.2 + unit(fiefId, 8) * 1.6;
  return { x: Math.cos(a) * d, z: Math.sin(a) * d * 0.7 };
}

/** How close about the town the town-cluster houses stand. */
export const TOWN_CLUSTER_R = 2.6;

/**
 * A building's spot in its fief, LOCAL to the fief's anchor. The manor stands
 * at the town's heart; chapel, market, well and every third cottage cluster
 * tight about it (the town); the REST of the cottages spread through the
 * fief's land as farmsteads — the doors are the holding, and the holding is
 * the land, not a heap of houses.
 */
export function buildingLocal(
  fiefId: string,
  doorId: string,
  index: number,
  _count: number,
  kind: string = 'cottage',
): Pt {
  const rng = stream(hashId(`${fiefId}/${doorId}`));
  const town = townLocal(fiefId);
  if (index === 0 || kind === 'manor') {
    return { x: town.x, z: town.z };
  }
  const inTown = kind !== 'cottage' || index % 3 === 1;
  if (inTown) {
    // The town cluster — close-set rings about the manor.
    const slot = Math.floor(index / 1.5);
    const ang = (slot * 2.399963) + (rng() - 0.5) * 0.5; // golden-angle steps
    const rad = 1.1 + (slot % 3) * 0.62 + rng() * 0.35;
    return {
      x: town.x + Math.cos(ang) * Math.min(rad, TOWN_CLUSTER_R),
      z: town.z + Math.sin(ang) * Math.min(rad, TOWN_CLUSTER_R) * 0.85,
    };
  }
  // A farmstead out on the land: a spoke and a reach, well clear of the town,
  // inside the territory's border with a lane's margin.
  const r = territoryRadius(fiefId) * 0.9;
  const ang = rng() * Math.PI * 2;
  const rad = TOWN_CLUSTER_R + 1.6 + rng() * (r - TOWN_CLUSTER_R - 2.6);
  return {
    x: town.x * 0.3 + Math.cos(ang) * rad * 1.02,
    z: town.z * 0.3 + Math.sin(ang) * rad * 0.68,
  };
}

/** A prop (lantern post, crate stack) beside a door — same hash discipline. */
export function propLocal(fiefId: string, doorId: string, prop: number): Pt {
  const rng = stream(hashId(`${fiefId}/${doorId}/prop${prop}`));
  const angle = rng() * Math.PI * 2;
  const radius = 0.45 + rng() * 0.2;
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
}

// ---------------------------------------------------------------------------
// The fief's land: fields and woods
// ---------------------------------------------------------------------------

export interface FieldPlot extends Pt {
  rotY: number;
  w: number;
  d: number;
  /** Tilled loam strips or open pasture. */
  tilled: boolean;
}

/** The fief's fields — tilled strips and pasture laid through the territory,
 *  clear of the town, each aligned roughly toward the town as real strip
 *  fields ran toward their village. */
export function fieldPlots(fiefId: string, count = 8): FieldPlot[] {
  const rng = stream(hashId(`${fiefId}/fields`));
  const r = territoryRadius(fiefId, count);
  const town = townLocal(fiefId);
  const n = 6 + Math.floor(rng() * 3);
  const plots: FieldPlot[] = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + rng() * 0.8;
    const rad = TOWN_CLUSTER_R + 1.2 + rng() * (r * 0.72 - TOWN_CLUSTER_R);
    const x = town.x * 0.3 + Math.cos(ang) * rad * 1.02;
    const z = town.z * 0.3 + Math.sin(ang) * rad * 0.66;
    plots.push({
      x,
      z,
      // The strips run toward the town, give or take a hand's turn.
      rotY: Math.atan2(town.x - x, town.z - z) + (rng() - 0.5) * 0.6,
      w: 1.4 + rng() * 1.0,
      d: 1.0 + rng() * 0.7,
      tilled: rng() < 0.55,
    });
  }
  return plots;
}

/** The fief's own woods — one or two copses inside the territory, each tree
 *  scattered about its copse. The autumn's warmth lives in these leaves. */
export function fiefTreeAt(fiefId: string, i: number, count = 8): Scatter {
  const copse = i % 2;
  const g = stream(hashId(`${fiefId}/copse/${copse}`));
  const r = territoryRadius(fiefId, count);
  const ang = g() * Math.PI * 2;
  const rad = TOWN_CLUSTER_R + 1.8 + g() * (r * 0.7 - TOWN_CLUSTER_R - 1);
  const cx = Math.cos(ang) * rad * 1.0;
  const cz = Math.sin(ang) * rad * 0.66;
  const rng = stream(hashId(`${fiefId}/tree/${i}`));
  return {
    x: cx + (rng() - 0.5) * 3.4,
    z: cz + (rng() - 0.5) * 2.6,
    rotY: rng() * Math.PI * 2,
    s: 0.65 + rng() * 0.6,
    hue: rng(),
  };
}

/** Trees a fief wears per its size — enough to read as woods, never a forest
 *  that hides the doors. */
export const FIEF_TREES = 10;

// ---------------------------------------------------------------------------
// The headland, the hill, the trees, the rose
// ---------------------------------------------------------------------------

/**
 * A guildhall's plot in WORLD coordinates. The guilds are the realm's own
 * functions, so their halls stand on the Capital's commons — an arc sweeping
 * the south-western approach, each hall turned to face the seat it serves.
 * On the commons they sit inside every fief's border and clear of the coast.
 */
export function guildHallPlot(index: number): { hx: number; hz: number; rotY: number } {
  const a = 1.92 + index * 0.24; // the arc, radians — a south-western sweep
  const r = 9.9 + (hash1(880 + index * 7) - 0.5) * 0.9;
  const hx = Math.cos(a) * r;
  const hz = Math.sin(a) * r * 0.85;
  // Face the Capital, give or take the hand's small turn.
  const rotY = Math.atan2(-hx, -hz) + (hash1(890 + index * 11) - 0.5) * 0.2;
  return { hx, hz, rotY };
}

/** The Capital's hill: the CENTRE of the continent, the walled city and the
 *  castle, with every fief's territory ringed around it and the ink roads
 *  running in. */
export const CAPITAL_HILL: Pt = { x: 0, z: 0 };

/** The Capital's commons — the ground the city holds; territories and wild
 *  woods keep out of it. */
export const CAPITAL_CLEAR_R = 13;

/** The ink road from a fief's town to the Capital — the two ends of the line
 *  the map draws; the view bends it as it likes. Roads are drawn, never
 *  stored. */
export function roadToCapital(fiefId: string, index: number, count = 8): [Pt, Pt] {
  const a = fiefAnchor(fiefId, index, count);
  const t = townLocal(fiefId);
  return [{ x: a.x + t.x, z: a.z + t.z }, CAPITAL_HILL];
}

/**
 * Wild trees on the mainland, scattered by a fixed lattice of hashed seeds —
 * deterministic, and independent of any fief so the wood stays put while
 * the realm grows. These are the pine masses BETWEEN the holdings.
 */
export function treeAt(index: number): Scatter {
  // Trees gather into GROVES — hashed copse-centres, each tree scattered
  // about its own — so the realm wears woods, not confetti.
  const grove = index % 16;
  const g = stream(hashId(`grove/${grove}`));
  const gx = (g() - 0.5) * 96;
  const gz = (g() - 0.5) * 60 + 2;
  const rng = stream(hashId(`tree/${index}`));
  return {
    x: gx + (rng() - 0.5) * 8,
    z: gz + (rng() - 0.5) * 6,
    rotY: rng() * Math.PI * 2,
    s: 0.7 + rng() * 0.7,
    hue: rng(),
  };
}

/** The compass rose, set into the sea south-east of the continent — with the
 *  slight turn a hand-drawn one always has. */
export const COMPASS_ROSE: Pt & { rotY: number } = { x: 58, z: 27, rotY: -0.14 };
