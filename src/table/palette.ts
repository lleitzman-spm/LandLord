/**
 * The War Table's palette — stated BEFORE the render code, as the writ
 * commands (WRIT-THE-WAR-TABLE §4), so it can be reviewed as a decision.
 *
 * SIX NAMED HEXES, and the reasoning:
 *
 *   walnut   #4A2E1C — the table itself: dark oiled walnut, the frame of
 *                      every shot. Dark so the relief and pieces carry the
 *                      light; warm so the room is a room, not a void.
 *   felt     #2F4A2E — deep hunter-green felt: the cloth under the relief
 *                      and the root of every terrain green. Darker and more
 *                      saturated than the realm's meadow — model-shop felt,
 *                      not pasture.
 *   brass    #C9973B — the clock, the trim, the lettering. The signature
 *                      metal; everything that glints is this.
 *   oxblood  #7A2E22 — the DISTRESS hue, and nothing else: crisis pennants
 *                      and fallen pieces fly it (pushed hot as `alarm`).
 *                      It is spent on no routine roof, so that from across
 *                      the frame a spot of red can only mean trouble.
 *   limewash #D8CDB4 — painted-lead house walls ONLY. Never a background:
 *                      the writ names the parchment trap (§10.3), and the
 *                      cure is keeping the pale warm tone on tiny pieces
 *                      while the frame stays walnut-dark.
 *   night    #26344C — the cool half of the light: ambient fill, shadow
 *                      blue, river slate. Warm key + THIS is where the
 *                      production value comes from (§3.4).
 *
 * Everything else on the table is DERIVED from those six (plus near-black
 * ink), so the palette stays reviewable and a repaint is one edit.
 */

import * as THREE from 'three';

// ── Derivation helpers ────────────────────────────────────────────────────

export function mix(a: string, b: string, t: number): string {
  return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
}

export function lighten(c: string, l: number): string {
  const col = new THREE.Color(c);
  col.offsetHSL(0, 0, l);
  return '#' + col.getHexString();
}

export function darken(c: string, l: number): string {
  return lighten(c, -l);
}

export function desaturate(c: string, s: number): string {
  const col = new THREE.Color(c);
  col.offsetHSL(0, -s, 0);
  return '#' + col.getHexString();
}

export function saturate(c: string, s: number): string {
  return desaturate(c, -s);
}

// ── The six named hexes (and the ink, which is a darkness, not a colour) ──

export const NAMED = {
  walnut: '#4a2e1c',
  felt: '#2f4a2e',
  brass: '#c9973b',
  oxblood: '#7a2e22',
  limewash: '#d8cdb4',
  night: '#26344c',
} as const;

/** Near-black warm ink — outlines, the room beyond the lamplight. */
export const INK = '#151009';

// ── Derived roles ─────────────────────────────────────────────────────────

export const T = {
  // The room and the light
  room: mix(INK, NAMED.walnut, 0.12),
  candle: lighten(mix(NAMED.brass, NAMED.limewash, 0.4), 0.22),
  coolFill: NAMED.night,

  // The table
  wood: NAMED.walnut,
  woodDark: darken(NAMED.walnut, 0.06),
  woodGrain: darken(desaturate(NAMED.walnut, 0.05), 0.1),
  woodSheen: lighten(NAMED.walnut, 0.08),

  // The cloth
  felt: NAMED.felt,
  feltDark: darken(NAMED.felt, 0.05),

  // The relief block's painted terrain (a model, so PAINT colours).
  // Greener and more saturated than instinct says: the one warm key will
  // pull everything toward amber, so the paint leans the other way.
  plainGreen: saturate(lighten(mix(NAMED.felt, NAMED.brass, 0.13), 0.03), 0.06),
  valleyGreen: saturate(mix(NAMED.felt, NAMED.night, 0.16), 0.04),
  uplandDry: mix(mix(NAMED.felt, NAMED.brass, 0.3), NAMED.limewash, 0.15),
  cedarDark: darken(NAMED.felt, 0.05),
  riverSlate: darken(mix(NAMED.night, NAMED.felt, 0.25), 0.05),
  contour: darken(mix(NAMED.felt, NAMED.brass, 0.2), 0.14),
  fascia: darken(NAMED.walnut, 0.04),

  // The metalwork
  brass: NAMED.brass,
  brassDeep: darken(NAMED.brass, 0.16),
  steelBlue: mix(NAMED.night, INK, 0.45),

  // The pieces (painted lead).
  //
  // THE HUE LAW OF THE PIECES (§4 — status is hue-separated, and red is
  // spent on NOTHING but distress, so the one hot hue lands at frame
  // scale): held roofs are umber/ochre/slate — warm and quiet, never red;
  // bare lead is COLD blue-grey (a cool island in a warm frame, findable
  // from across the room); crisis and the fallen fly ALARM — oxblood
  // pushed hot — and nothing else on the table is allowed near that hue.
  wallPaint: NAMED.limewash,
  roofOx: NAMED.oxblood,
  roofUmber: mix(NAMED.walnut, NAMED.brass, 0.42),
  roofCopper: mix(NAMED.oxblood, NAMED.brass, 0.66),
  roofSlate: mix(NAMED.night, NAMED.limewash, 0.25),
  alarm: saturate(lighten(NAMED.oxblood, 0.15), 0.3),
  leadBare: saturate(mix(NAMED.limewash, NAMED.night, 0.72), 0.12),
  leadBase: mix(INK, NAMED.night, 0.35),
  pennantBlack: mix(INK, NAMED.night, 0.15),
  crisisChar: darken(desaturate(NAMED.oxblood, 0.12), 0.06),

  // Paper (an OBJECT on the table, never a background — §10.3, §10.5)
  paper: desaturate(NAMED.limewash, 0.04),
  paperInk: mix(INK, NAMED.walnut, 0.25),
} as const;
