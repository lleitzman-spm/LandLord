/**
 * Where the pieces stand — the LIVE realm laid onto the parcel lattice.
 *
 * `src/table/parcels.ts` places ~203 INVENTED doors, because the baked frame
 * had no chronicle to read. This places the doors the chronicle actually holds:
 * one parcel per door, one contiguous block of parcels per fief, packed onto
 * one global lattice with roads between the blocks.
 *
 * Edwin's direction, 2026-07-29: DETERMINISTIC, DISCRETE MODULARITY — a finite
 * kit of pieces on subdivided ground, density from many discrete units rather
 * than from texture, every position DERIVED rather than scattered. So nothing
 * here is jittered and nothing is relaxed: a door's position is a pure function
 * of which fief holds it and its place within that fief, which means the same
 * shire always draws the same town and a holding can be FOUND by its address
 * rather than hunted for.
 *
 * Pure, and a pure function of the scene contract alone — this file never
 * imports the domain (`src/realm/scene.ts` is the firewall, and it holds).
 * Growth is handled by the pack rather than by a table of hand-placed origins:
 * four fiefs or forty, twenty doors or six hundred, everything fits the board.
 */

import type { BuildingState, FiefHealth, RealmScene, SceneFief } from '../realm/scene';
import { MAP } from './flatMap';

/** The kit. Four glyphs and no more — a finite kit is the whole point; a fifth
 *  shape earns its place only by meaning something a Regent must act on. */
export type PieceKind = 'cottage' | 'house' | 'wide' | 'chapel';

export interface TablePiece {
  /** The door's stable slug — what the app opens when the piece is clicked. */
  doorId: string;
  fiefId: string;
  /** The door's address, in plain words. */
  label: string;
  /** Map units. */
  x: number;
  y: number;
  kind: PieceKind;
  state: BuildingState;
  /** Which fief's block, and the parcel's address within it. */
  block: number;
  col: number;
  row: number;
  /** Tiny hashed variation in the PAINT — never in the position. */
  lean: number;
  tone: number;
  /** The open matter on this door, when one stands. The inspector offers a
   *  road to the WORK only when there is work to reach — an act that would
   *  land nowhere is not offered at all. */
  openCase?: string;
}

export interface TableBlock {
  fiefId: string;
  name: string;
  health: FiefHealth;
  /** The block's surveyed ground, in map units. */
  x: number;
  y: number;
  w: number;
  h: number;
  cols: number;
  rows: number;
  /** The parcel pitch in force — the block's own grid lines. */
  pitchX: number;
  pitchY: number;
  doors: number;
  held: number;
  /** Doors standing in crisis in this fief — what makes a banner fly red. */
  crises: number;
}

export interface TableBanner {
  fiefId: string;
  name: string;
  seatLabel?: string;
  health: FiefHealth;
  x: number;
  y: number;
  lean: number;
}

export interface TableLayout {
  pieces: TablePiece[];
  blocks: TableBlock[];
  banners: TableBanner[];
  /** The Crown's own seat, standing north of the shire it surveys. */
  capital: { x: number; y: number; name: string };
}

// ── The lattice ────────────────────────────────────────────────────────────

/** The founding parcel pitch, in map units. Dense enough that a town reads as
 *  a town, open enough that a piece is CLICKABLE where it is visible.
 *
 *  The row pitch was 17.5 first, and measurement killed it: a house glyph
 *  stands ~19 units tall before the depth scale, so every row overlapped the
 *  row behind it and the piece in FRONT took the click. Aiming at a holding's
 *  middle selected its neighbour 8 times in 14 — the very fault the baked
 *  frame was fixed for once already. The rows are pitched taller than the
 *  tallest piece now. The pack shrinks the pitch when a realm outgrows the
 *  board, never below `MIN_PITCH`. */
const PITCH_X = 0.0225 * MAP;
const PITCH_Y = 0.0215 * MAP;
const MIN_PITCH = 0.5;
/** The road margin between one fellowship's block and the next. */
const ROAD_X = 0.026 * MAP;
const ROAD_Y = 0.03 * MAP;

/** The ground the shire may be surveyed on — the rest stays open country,
 *  which is TRUE rather than decorative: the emptiness is where nothing is
 *  held. The north strip is left clear for the Crown's own seat. */
const FIELD = { x0: 0.05 * MAP, y0: 0.14 * MAP, x1: 0.95 * MAP, y1: 0.94 * MAP };

function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 0..1 from an id and a salt — the realm's one way of being varied without
 *  being random. */
const roll = (id: string, salt: string) => (hashStr(`${salt}:${id}`) % 10000) / 10000;

/** The kit a door is drawn as. The knight's manor and the market are the wide
 *  buildings; a chapel gets the spire; the well and the cottage are cottages.
 *  Dressing only — it carries no standing, and no act reads it. */
function kindOf(kind: SceneFief['buildings'][number]['kind']): PieceKind {
  switch (kind) {
    case 'manor':
    case 'market':
      return 'wide';
    case 'chapel':
      return 'chapel';
    default:
      return 'cottage';
  }
}

/** A block is as square as it can be, filled row-major. Deterministic: it
 *  depends on the count and on nothing else. */
function shapeOf(n: number): { cols: number; rows: number } {
  const cols = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, n))));
  return { cols, rows: Math.max(1, Math.ceil(Math.max(1, n) / cols)) };
}

/**
 * Lay the whole shire out.
 *
 * The blocks are shelf-packed west to east, wrapping south — the surveyor's
 * order, and stable: adding a fief appends a block, it does not shuffle the
 * ones already drawn. If the shire outgrows the board the PITCH shrinks until
 * it fits (tried at 1.0, 0.86, 0.74 … of the founding pitch), because a realm
 * that grows should draw a denser town, never a town running off the table.
 */
export function layoutTable(scene: RealmScene): TableLayout {
  const fiefs = scene.fiefs.filter((f) => f.buildings.length > 0);

  let fit = tryPack(fiefs, 1);
  for (let k = 1; !fit && k < 14; k++) fit = tryPack(fiefs, 0.86 ** k);
  // Nothing fits at a fourteenth of the pitch either: draw what does. A map
  // that refuses to draw is worse than a crowded one.
  const packed = fit ?? tryPack(fiefs, 0.86 ** 13, true)!;

  const pieces: TablePiece[] = [];
  const banners: TableBanner[] = [];
  packed.blocks.forEach((block, b) => {
    const fief = fiefs[b];
    fief.buildings.forEach((door, i) => {
      const col = i % block.cols;
      const row = Math.floor(i / block.cols);
      pieces.push({
        doorId: door.id,
        fiefId: fief.id,
        label: door.label,
        x: block.x + col * block.pitchX + block.pitchX / 2,
        y: block.y + row * block.pitchY + block.pitchY / 2,
        kind: kindOf(door.kind),
        state: door.state,
        block: b,
        col,
        row,
        // The paint varies; the position does not.
        lean: (roll(door.id, 'lean') - 0.5) * 0.055,
        tone: roll(door.id, 'tone'),
        ...(door.openCase ? { openCase: door.openCase } : {}),
      });
    });
    banners.push({
      fiefId: fief.id,
      name: fief.name,
      ...(fief.seatLabel ? { seatLabel: fief.seatLabel } : {}),
      health: fief.health,
      // At the block's north-east corner, standing over its own ground.
      x: block.x + block.w + block.pitchX * 0.35,
      y: block.y - block.pitchY * 0.15,
      lean: (roll(fief.id, 'banner') - 0.5) * 0.05,
    });
  });

  // The Crown's seat, centred over the shire it surveys, on the clear north
  // strip. Centred on the BLOCKS rather than on the board, so it never drifts
  // away from the realm when the realm is small.
  const xs = packed.blocks.length ? packed.blocks.map((b) => b.x + b.w / 2) : [MAP / 2];
  const capitalX = (Math.min(...xs) + Math.max(...xs)) / 2;

  return {
    pieces,
    blocks: packed.blocks,
    banners,
    capital: { x: capitalX, y: FIELD.y0 - 0.07 * MAP, name: scene.kingName },
  };
}

/** One packing attempt at a fraction of the founding pitch. Null when the
 *  shire runs off the south edge; `force` takes whatever it got. */
function tryPack(
  fiefs: SceneFief[],
  k: number,
  force = false,
): { blocks: TableBlock[] } | null {
  const pitchX = Math.max(MIN_PITCH, PITCH_X * k);
  const pitchY = Math.max(MIN_PITCH, PITCH_Y * k);
  const roadX = Math.max(MIN_PITCH, ROAD_X * k);
  const roadY = Math.max(MIN_PITCH, ROAD_Y * k);

  const blocks: TableBlock[] = [];
  let x = FIELD.x0;
  let y = FIELD.y0;
  let shelfHeight = 0;

  for (const fief of fiefs) {
    const { cols, rows } = shapeOf(fief.buildings.length);
    const w = cols * pitchX;
    const h = rows * pitchY;
    if (x > FIELD.x0 && x + w > FIELD.x1) {
      // The shelf is full — start the next one south of it.
      x = FIELD.x0;
      y += shelfHeight + roadY;
      shelfHeight = 0;
    }
    if (y + h > FIELD.y1 && !force) return null;
    const crises = fief.buildings.filter((b) => b.state === 'crisis').length;
    blocks.push({
      fiefId: fief.id,
      name: fief.name,
      health: fief.health,
      x,
      y,
      w,
      h,
      cols,
      rows,
      pitchX,
      pitchY,
      doors: fief.buildings.length,
      held: fief.buildings.filter((b) => b.state !== 'vacant').length,
      crises,
    });
    x += w + roadX;
    shelfHeight = Math.max(shelfHeight, h);
  }
  return { blocks };
}

// ── Readings the drawing needs, folded here so the view holds no logic ─────

/** How a door's standing reads in plain words — the inspector's own sentence. */
export const STANDING: Record<BuildingState, string> = {
  held: 'held and quiet',
  vacant: 'standing empty',
  crisis: 'in crisis',
};

/** How a fief's condition reads. */
export const CONDITION: Record<FiefHealth, string> = {
  thriving: 'thriving',
  strained: 'strained',
  failing: 'failing',
};

/** Whether a copse may grow where it wants to: not through a holding's
 *  surveyed ground, and not through the Crown's own seat. */
export function onOpenGround(
  site: { x: number; y: number },
  blocks: TableBlock[],
  capital: { x: number; y: number },
): boolean {
  if (Math.hypot(site.x - capital.x, site.y - capital.y) < 70) return false;
  for (const b of blocks) {
    if (
      site.x > b.x - 22 &&
      site.x < b.x + b.w + 22 &&
      site.y > b.y - 22 &&
      site.y < b.y + b.h + 22
    ) {
      return false;
    }
  }
  return true;
}
