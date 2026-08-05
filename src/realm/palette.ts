/**
 * The realm's palette and shared materials — the ONE seam every colour
 * passes through.
 *
 * The look (Edwin, 2026-07-27): a RICH AUTUMNAL KINGDOM. The vellum/beige
 * ground is banished — "I absolutely loathe this vellum/AI beige thing" —
 * the land is LAND, never a document and never sand. Deep moss and meadow
 * greens for pasture, darker pine masses, dark loam for tilled earth,
 * cool slate water, grey stone for walls and keeps. The WARMTH comes from
 * FOLIAGE and ROOFTOPS — russet, copper and old gold in the autumn woods,
 * fired terracotta and oxblood on the roofs — never from the ground.
 * The ink linework stays (a map's linework is good); the parchment does not.
 * The three health colours are pinned and must blaze against the green.
 *
 * Two rules hold this file together:
 *   1. Components never write a hex. Every colour is a ROLE token here
 *      (land, sea, roadInk, roofTile…), so a repaint is one edit, not a
 *      hunt. Roles survive a repaint; hue names become lies.
 *   2. Families are DERIVED from a handful of bases with the helpers below
 *      (mix / lighten / darken), so shifting a base moves its whole family
 *      coherently.
 *
 * One instance of every repeated material, created once — an InstancedMesh
 * carries a thousand houses but should carry ONE material.
 */

import * as THREE from 'three';

// ── Derivation helpers (hex in → hex out) ─────────────────────────────────

/** Blend a toward b by t (0..1). */
export function mix(a: string, b: string, t: number): string {
  return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
}

/** Lift lightness by l (−1..1). */
export function lighten(c: string, l: number): string {
  const col = new THREE.Color(c);
  col.offsetHSL(0, 0, l);
  return '#' + col.getHexString();
}

/** Drop lightness by l (0..1). */
export function darken(c: string, l: number): string {
  return lighten(c, -l);
}

/** Pull saturation by s (0..1) — toward grey, the drab end of anything. */
export function desaturate(c: string, s: number): string {
  const col = new THREE.Color(c);
  col.offsetHSL(0, -s, 0);
  return '#' + col.getHexString();
}

// ── The bases (the only raw hues; everything else derives) ────────────────

export const PALETTE = {
  /** The pasture: deep meadow green — the common coat of the realm's land. */
  meadow: '#5b7f40',
  /** The darker moss the meadow falls into on high or shadowed ground. */
  moss: '#3d5731',
  /** The pine masses — the darkest green the woods reach. */
  pine: '#2b4229',
  /** Tilled earth and bare ground: dark brown loam, never sand. */
  loam: '#4c3a26',
  /** The loam's wet, shadowed depth — the shore's earth, the field's furrow. */
  loamDark: '#332619',
  /** The autumn woods: russet… */
  russet: '#96452a',
  /** …copper… */
  copper: '#b06f33',
  /** …and old gold. */
  oldGold: '#c69a3f',
  /** The water: cool slate-blue, rivers and sea alike. */
  slateWater: '#576b7a',
  /** The linework: near-black ink. */
  ink: '#211a10',
  /** The built realm: grey stone for walls and keeps. */
  stone: '#a19a8d',
  /** The roofs' warmth: fired terracotta… */
  terracotta: '#a85433',
  /** …and oxblood for the great roofs. */
  oxblood: '#6e2d24',
  /** Aged brass — the app's own accent; the lettering and the trim. */
  brass: '#d9b65c',
  /** Cold slate — the vacant house's grey-blue, so shuttered ≠ merely dark. */
  slate: '#737a84',
  /** The health colours — pinned by the writ, never derived. */
  green: '#5aa168',
  amber: '#d19a33',
  red: '#c0492f',
} as const;

// ── The role tokens (what components actually name) ───────────────────────

export const TOKEN = {
  // The water and the world beyond it
  /** Retired: the realm sits inland and has no sea. Kept pointing at the wild
   *  country so any straggler asking for water gets land instead. */
  sea: darken(desaturate(PALETTE.meadow, 0.05), 0.05),
  seaEdge: darken(desaturate(PALETTE.meadow, 0.16), 0.16),
  /** The realm's outer bound. Not a coastline — there is no sea — so it is
   *  drawn faint: a surveyor's mark where the tilled land gives way to wild
   *  country, never a hard edge that makes the kingdom look cut out. */
  coastInk: mix(PALETTE.ink, PALETTE.meadow, 0.55),
  lettering: PALETTE.brass,
  letteringDim: mix(PALETTE.brass, PALETTE.slateWater, 0.45),
  /** A fief's name, inked onto its own land. */
  letteringLand: mix(PALETTE.ink, PALETTE.loamDark, 0.3),
  fog: darken(desaturate(PALETTE.slateWater, 0.08), 0.2),
  /** The horizon the open water runs out to. Edwin, 2026-07-27: "I'd rather
   *  dispense with the fog of war idea, and just allow the surrounding to flow
   *  more naturally out" — so nothing fades into nothing. The water simply
   *  keeps going and meets a sky of the same family at the frame's edge. */
  horizon: darken(desaturate(PALETTE.meadow, 0.2), 0.2),
  /** The unclaimed country just past the realm's own fiefs — still green, a
   *  little wilder and cooler than tilled land. */
  wildNear: darken(desaturate(PALETTE.meadow, 0.05), 0.05),
  /** The same country far off, greyed by distance. It never becomes water and
   *  never becomes nothing: the continent simply goes on. */
  wildFar: darken(desaturate(PALETTE.meadow, 0.16), 0.16),

  // The land ramp — grass and loam, not paper: dark wet earth at the
  // waterline, meadow greens over the middle ground, moss and pine dark
  // toward the heights. The ground is never beige.
  landShore: mix(PALETTE.loamDark, PALETTE.moss, 0.4),
  landLow: mix(PALETTE.moss, PALETTE.meadow, 0.62),
  land: PALETTE.meadow,
  landMeadow: lighten(mix(PALETTE.meadow, PALETTE.oldGold, 0.1), 0.03),
  landHigh: mix(PALETTE.moss, PALETTE.pine, 0.3),
  /** The tended green around a town — kept ground, a shade brighter. */
  townGreen: lighten(PALETTE.meadow, 0.05),
  townGreenDrab: mix(PALETTE.meadow, PALETTE.loam, 0.4),

  // The fields
  fieldTilled: mix(PALETTE.loam, PALETTE.copper, 0.16),
  fieldFurrow: mix(PALETTE.loamDark, PALETTE.loam, 0.3),
  pasture: mix(PALETTE.meadow, PALETTE.oldGold, 0.13),
  pastureDrab: mix(PALETTE.meadow, PALETTE.loam, 0.35),

  // The ink lines
  roadInk: mix(PALETTE.ink, PALETTE.loam, 0.35),
  borderInk: PALETTE.ink,

  // Stone and timber — the built realm, grey stone against green land
  wallStone: PALETTE.stone,
  wallStoneDark: mix(PALETTE.stone, PALETTE.loamDark, 0.45),
  keepWall: lighten(PALETTE.stone, 0.06),
  timber: mix(PALETTE.ink, PALETTE.loam, 0.4),
  board: mix(PALETTE.loamDark, PALETTE.slate, 0.35),
  scaffold: mix(PALETTE.loam, PALETTE.brass, 0.3),
  bannerPole: mix(PALETTE.ink, PALETTE.loam, 0.25),

  // The houses — limewashed walls, warm fired roofs
  houseWall: lighten(desaturate(PALETTE.stone, 0.04), 0.14),
  houseWallDrab: mix(PALETTE.stone, PALETTE.loam, 0.4),
  roofTile: PALETTE.terracotta,
  roofTileDrab: mix(PALETTE.terracotta, PALETTE.loamDark, 0.45),
  roofGreat: PALETTE.oxblood,
  /** The guild halls' roofs — cool slate, so the realm's own functions never
   *  read as one more fief. */
  roofGuild: mix(PALETTE.slate, PALETTE.ink, 0.3),
  houseVacant: PALETTE.slate,
  roofVacant: darken(desaturate(PALETTE.slate, 0.05), 0.12),
  houseCrisis: mix(PALETTE.loamDark, PALETTE.ink, 0.3),
  roofCrisis: mix(PALETTE.oxblood, PALETTE.ink, 0.5),
  windowLit: mix(PALETTE.amber, '#ffd27a', 0.75),
  windowDark: PALETTE.ink,

  // The woods — the autumn's warmth lives HERE, in the leaves
  trunk: mix(PALETTE.ink, PALETTE.loam, 0.35),
  canopyPine: PALETTE.pine,
  canopyGreen: mix(PALETTE.pine, PALETTE.meadow, 0.55),
  canopyRusset: PALETTE.russet,
  canopyCopper: PALETTE.copper,
  canopyGold: PALETTE.oldGold,
  hedge: mix(PALETTE.pine, PALETTE.meadow, 0.4),

  // Fire and smoke
  flame: mix(PALETTE.amber, PALETTE.red, 0.45),
  smoke: mix(PALETTE.stone, PALETTE.slateWater, 0.3),
  smokeDark: darken(PALETTE.loamDark, 0.05),

  // The light: a clear autumn afternoon — warm low sun, cool sky fill
  sunLight: '#ffd9a0',
  skyFill: '#93a0b5',
  ambient: mix('#cfd4c8', PALETTE.oldGold, 0.1),
  hemiSky: mix('#c8d2dc', PALETTE.oldGold, 0.08),
  hemiGround: PALETTE.moss,
} as const;

/** A fief's banner color by its health — pinned by the writ. */
export const BANNER: Record<'thriving' | 'strained' | 'failing', string> = {
  thriving: PALETTE.green,
  strained: PALETTE.amber,
  failing: PALETTE.red,
};

/** The banner's pale trim stripe. */
export const BANNER_TRIM = lighten(PALETTE.stone, 0.2);

/** The fog's color — the cold haze past the realm's water. */
export const FOG_COLOR = TOKEN.fog;

// ── Shared materials (one of each, reused everywhere) ─────────────────────

/** The painterly toon ramp — three soft steps shared by every toon material,
 *  so light quantizes into painted bands instead of a hard on/off. */
let _ramp: THREE.DataTexture | null = null;
export function toonRamp(): THREE.DataTexture {
  if (_ramp) return _ramp;
  const data = new Uint8Array([135, 135, 135, 255, 200, 200, 200, 255, 255, 255, 255, 255]);
  _ramp = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  _ramp.minFilter = THREE.NearestFilter;
  _ramp.magFilter = THREE.NearestFilter;
  _ramp.needsUpdate = true;
  return _ramp;
}

const toon = (color: string) =>
  new THREE.MeshToonMaterial({ color: new THREE.Color(color), gradientMap: toonRamp() });

/** The shared house materials. Walls and roofs are vertex-tinted per
 *  instance (color = faith/health tint); windows are emissive for the
 *  warm-lit held houses and dark for the shuttered. */
export const MAT = {
  wall: toon('#ffffff'), // tinted per-instance
  roof: toon('#ffffff'), // tinted per-instance
  windowLit: new THREE.MeshBasicMaterial({ color: TOKEN.windowLit }),
  windowDark: new THREE.MeshBasicMaterial({ color: TOKEN.windowDark }),
  board: toon(TOKEN.board),
  /** Solid oxblood — the NON-instanced great roofs (keeps, towers, halls);
   *  MAT.roof stays white because instanced roofs tint it per instance. */
  roofSolid: toon(TOKEN.roofGreat),
  roofGuild: toon(TOKEN.roofGuild),
  scaffold: toon(TOKEN.scaffold),
  fire: new THREE.MeshBasicMaterial({ color: TOKEN.flame }),
  hedge: toon(TOKEN.hedge),
  stone: toon(TOKEN.wallStone),
  stoneDark: toon(TOKEN.wallStoneDark),
  keepWall: toon(TOKEN.keepWall),
  timber: toon(TOKEN.timber),
  trunk: toon(TOKEN.trunk),
  canopy: toon('#ffffff'), // tinted per-instance — pine to old gold
  bannerPole: toon(TOKEN.bannerPole),
  goldTrim: new THREE.MeshBasicMaterial({ color: PALETTE.brass }),
  field: toon('#ffffff'), // tinted per-instance — tilled loam or pasture
  furrow: toon(TOKEN.fieldFurrow),
  inkLine: new THREE.MeshBasicMaterial({
    color: TOKEN.coastInk,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    side: THREE.DoubleSide,
  }),
  /** The fief border — a firm ink stroke on the land, as on a real map. */
  borderInk: new THREE.MeshBasicMaterial({
    color: TOKEN.borderInk,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: THREE.DoubleSide,
  }),
  /** The ink road — a hand-drawn line laid flat on the land, not a paved lane. */
  roadInk: new THREE.MeshBasicMaterial({
    color: TOKEN.roadInk,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: THREE.DoubleSide,
  }),
};

/** The autumn canopy family, in the order a wood mixes them. */
export const CANOPY_RANGE = [
  TOKEN.canopyPine,
  TOKEN.canopyGreen,
  TOKEN.canopyRusset,
  TOKEN.canopyCopper,
  TOKEN.canopyGold,
] as const;

/** A canopy colour drawn from the autumn range by a 0..1 hue key —
 *  green-weighted so the woods stay woods, with autumn burning through. */
export function canopyColor(hue: number, out: THREE.Color): THREE.Color {
  // 55% of trees keep a green, the rest turn.
  const t = hue < 0.55 ? (hue / 0.55) * 1 : 1 + ((hue - 0.55) / 0.45) * 3;
  const i = Math.min(CANOPY_RANGE.length - 2, Math.floor(t));
  const f = t - i;
  return out.set(CANOPY_RANGE[i]).lerp(new THREE.Color(CANOPY_RANGE[i + 1]), f);
}

/** Faith (0..100) → a wall/roof tint. High faith is lush and warm; low faith
 *  drab and grey. Returns a THREE.Color ready for instance tinting. */
export function faithTint(faith: number, base: string, drab: string): THREE.Color {
  const t = THREE.MathUtils.clamp(faith / 100, 0, 1);
  return new THREE.Color(drab).lerp(new THREE.Color(base), 0.35 + 0.65 * t);
}

/**
 * A soft radial-gradient sprite as a data-URI texture — used for smoke and
 * fire glow. Procedural, inline, self-contained (the writ's leash 2).
 */
let _softTex: THREE.CanvasTexture | null = null;
export function softDiscTexture(): THREE.CanvasTexture {
  if (_softTex) return _softTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  _softTex = new THREE.CanvasTexture(c);
  return _softTex;
}
