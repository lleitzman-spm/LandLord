/**
 * The pieces — painted lead, drawn once into a canvas atlas.
 *
 * The writ (§8): sprite billboards over meshes. Every piece type is authored
 * here as an image in the style of a hand-painted miniature: bold silhouette,
 * flat paint in two values, a dark outline, a cast-lead base. Light in the
 * paint comes from the LEFT, matching the table's one warm key.
 *
 * All wobble is deterministic (seeded), so the atlas is the same every load.
 */

import * as THREE from 'three';
import { T, INK, mix, lighten, darken } from './palette';

export const CELL_W = 128;
export const CELL_H = 192;
const COLS = 4;
const ROWS = 3;

export type CellName =
  | 'cottageHeld' | 'houseHeld' | 'wideHeld' | 'cottageVacant'
  | 'houseVacant' | 'cottageBare' | 'houseBare' | 'crisis'
  | 'fallen' | 'treeOak' | 'treeCedar' | 'banner';

const CELL: Record<CellName, [number, number]> = {
  cottageHeld: [0, 0], houseHeld: [1, 0], wideHeld: [2, 0], cottageVacant: [3, 0],
  houseVacant: [0, 1], cottageBare: [1, 1], houseBare: [2, 1], crisis: [3, 1],
  fallen: [0, 2], treeOak: [1, 2], treeCedar: [2, 2], banner: [3, 2],
};

// ── Deterministic wobble ──────────────────────────────────────────────────

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

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];

/** A polygon path with a hand's slight wobble at each vertex. */
function wobPath(ctx: Ctx, pts: Pt[], r: () => number, j = 1.6) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const wx = x + (r() - 0.5) * j;
    const wy = y + (r() - 0.5) * j;
    if (i === 0) ctx.moveTo(wx, wy);
    else ctx.lineTo(wx, wy);
  });
  ctx.closePath();
}

function fillPoly(ctx: Ctx, pts: Pt[], color: string, r: () => number, j?: number) {
  wobPath(ctx, pts, r, j);
  ctx.fillStyle = color;
  ctx.fill();
}

function outlinePoly(ctx: Ctx, pts: Pt[], r: () => number, width = 3) {
  wobPath(ctx, pts, r, 1.2);
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** The cast-lead base every piece stands on. */
function leadBase(ctx: Ctx, cx: number, cy: number, rx: number, r: () => number) {
  const ry = rx * 0.27;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2.5, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = darken(T.leadBase, 0.04);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = T.leadBase;
  ctx.fill();
  // a worn sheen on the left rim
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - 1.5, ry - 1, 0, Math.PI * 0.95, Math.PI * 1.55);
  ctx.strokeStyle = lighten(T.leadBase, 0.13 + r() * 0.03);
  ctx.lineWidth = 2;
  ctx.stroke();
}

// ── The house painter ─────────────────────────────────────────────────────

interface HouseLook {
  wall: string;
  roof: string;
  windows: 'lit' | 'dark' | 'boarded' | 'none';
  door: 'painted' | 'boarded' | 'dark';
  pennant?: boolean;
  chimneySmoke?: boolean;
}

function paintHouse(
  ctx: Ctx,
  look: HouseLook,
  shape: 'cottage' | 'house' | 'wide',
  seed: number,
  withBase = true,
) {
  const r = stream(seed);
  const wallShade = darken(look.wall, 0.09);
  const wallLight = lighten(look.wall, 0.05);
  const roofShade = darken(look.roof, 0.07);
  const roofLight = lighten(look.roof, 0.08);

  // Body and roof footprints per shape (within the 128×192 cell, base y≈168)
  let bx0 = 36, bx1 = 92, by0 = 110, by1 = 164, apex = 76, eave = 114;
  if (shape === 'house') { bx0 = 38; bx1 = 90; by0 = 88; by1 = 164; apex = 52; eave = 92; }
  if (shape === 'wide') { bx0 = 22; bx1 = 106; by0 = 118; by1 = 164; apex = 90; eave = 122; }
  const cx = (bx0 + bx1) / 2;

  if (withBase) leadBase(ctx, 64, 168, (bx1 - bx0) / 2 + 12, r);

  // Walls
  const body: Pt[] = [[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1]];
  fillPoly(ctx, body, look.wall, r);
  // right third in shade, left edge in light
  fillPoly(ctx, [[cx + (bx1 - cx) * 0.35, by0], [bx1, by0], [bx1, by1], [cx + (bx1 - cx) * 0.35, by1]], wallShade, r, 1);
  ctx.strokeStyle = wallLight;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(bx0 + 2, by0 + 3);
  ctx.lineTo(bx0 + 2, by1 - 2);
  ctx.stroke();

  // Roof
  const roof: Pt[] = [[bx0 - 8, eave], [cx, apex], [bx1 + 8, eave]];
  fillPoly(ctx, roof, look.roof, r);
  fillPoly(ctx, [[cx, apex], [bx1 + 8, eave], [cx + 6, eave]], roofShade, r, 1);
  ctx.strokeStyle = roofLight;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(bx0 - 5, eave - 1);
  ctx.lineTo(cx - 1, apex + 1);
  ctx.stroke();

  // Chimney (right side)
  const chX = cx + (bx1 - cx) * 0.55;
  const chTop = apex + (eave - apex) * 0.35 - 16;
  fillPoly(ctx, [[chX - 5, chTop], [chX + 5, chTop], [chX + 5, chTop + 22], [chX - 5, chTop + 22]], wallShade, r, 1);
  outlinePoly(ctx, [[chX - 5, chTop], [chX + 5, chTop], [chX + 5, chTop + 22], [chX - 5, chTop + 22]], r, 2);

  // Door
  const dw = 11, dh = 22, dx = cx - dw / 2, dy = by1 - dh;
  ctx.fillStyle = look.door === 'painted' ? T.roofOx : look.door === 'dark' ? INK : darken(T.wood, 0.02);
  ctx.fillRect(dx, dy, dw, dh);
  if (look.door === 'boarded') {
    ctx.strokeStyle = darken(T.leadBare, 0.1);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(dx, dy + 2); ctx.lineTo(dx + dw, dy + dh - 2);
    ctx.moveTo(dx + dw, dy + 2); ctx.lineTo(dx, dy + dh - 2);
    ctx.stroke();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(dx, dy, dw, dh);

  // Windows
  const winY = shape === 'house' ? [by0 + 12, by0 + 44] : [by0 + 12];
  const winXs = shape === 'wide' ? [bx0 + 14, cx - 24, cx + 16, bx1 - 22] : [bx0 + 8, bx1 - 18];
  if (look.windows !== 'none') {
    for (const wy of winY) {
      for (const wx of winXs) {
        if (wx > dx - 12 && wx < dx + dw + 2 && wy > by1 - dh - 14) continue;
        if (look.windows === 'lit') {
          ctx.fillStyle = '#ffcf7d';
          ctx.fillRect(wx, wy, 10, 12);
          ctx.fillStyle = 'rgba(255,190,90,0.25)';
          ctx.fillRect(wx - 2, wy - 2, 14, 16);
        } else {
          ctx.fillStyle = look.windows === 'boarded' ? darken(T.leadBare, 0.12) : INK;
          ctx.fillRect(wx, wy, 10, 12);
        }
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.strokeRect(wx, wy, 10, 12);
      }
    }
  }

  // Outline the silhouette
  outlinePoly(ctx, roof, r);
  outlinePoly(ctx, body, r);

  // The ALARM pennant of a house in crisis — the one hot hue on the table,
  // cut LARGE so it reads from across the frame (§4: status at frame scale,
  // which the old small black pennant failed)
  if (look.pennant) {
    const px = cx - 4, pTop = apex - 46;
    ctx.strokeStyle = T.steelBlue;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(px, apex - 2);
    ctx.lineTo(px, pTop);
    ctx.stroke();
    const flag: Pt[] = [[px + 1, pTop], [px + 58, pTop + 9], [px + 20, pTop + 16], [px + 46, pTop + 25], [px + 1, pTop + 32]];
    fillPoly(ctx, flag, T.alarm, r, 2);
    fillPoly(ctx, [[px + 1, pTop], [px + 58, pTop + 9], [px + 1, pTop + 13]], lighten(T.alarm, 0.08), r, 2);
    outlinePoly(ctx, flag, r, 2.5);
  }
}

// ── Trees, banner ─────────────────────────────────────────────────────────

function paintTree(ctx: Ctx, kind: 'oak' | 'cedar', seed: number) {
  const r = stream(seed);
  // No cast base under a tree: model trees are PLANTED — the trunk sinks
  // into the ground under a small flocked skirt. (The old lead discs were
  // the only blue things in a warm frame and read as sprue.)
  ctx.strokeStyle = mix(INK, T.wood, 0.4);
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(64, 178);
  ctx.lineTo(64 + (r() - 0.5) * 6, kind === 'oak' ? 120 : 128);
  ctx.stroke();
  // the flocked skirt at the foot
  for (let s = 0; s < 3; s++) {
    ctx.beginPath();
    ctx.ellipse(64 + (r() - 0.5) * 22, 172 + (r() - 0.5) * 5, 10 + r() * 9, 4 + r() * 2.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = s === 0 ? darken(T.cedarDark, 0.02) : mix(T.cedarDark, T.plainGreen, r() * 0.5);
    ctx.fill();
  }
  // Model-shop flock greens — LIGHTER than the terrain paint, or the wood
  // reads as holes in the light rather than trees standing in it.
  const dark = kind === 'oak' ? lighten(T.plainGreen, 0.03) : mix(T.cedarDark, T.plainGreen, 0.45);
  const lit = kind === 'oak' ? lighten(T.plainGreen, 0.12) : lighten(mix(T.cedarDark, T.plainGreen, 0.65), 0.03);
  const lumps: [number, number, number][] = kind === 'oak'
    ? [[46, 108, 24], [82, 104, 26], [64, 78, 30], [58, 118, 20]]
    : [[64, 130, 22], [64, 100, 19], [64, 72, 15]];
  for (const [x, y, rad] of lumps) {
    ctx.beginPath();
    ctx.arc(x + (r() - 0.5) * 4, y + (r() - 0.5) * 4, rad, 0, Math.PI * 2);
    ctx.fillStyle = dark;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  // lit side (left-up), painted as offset lighter blobs
  for (const [x, y, rad] of lumps) {
    ctx.beginPath();
    ctx.arc(x - rad * 0.25 + (r() - 0.5) * 3, y - rad * 0.28, rad * 0.62, 0, Math.PI * 2);
    ctx.fillStyle = lit;
    ctx.fill();
  }
}

function paintBanner(ctx: Ctx, seed: number) {
  const r = stream(seed);
  leadBase(ctx, 50, 172, 20, r);
  // the pike
  ctx.strokeStyle = T.steelBlue;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(50, 170);
  ctx.lineTo(52, 22);
  ctx.stroke();
  // brass finial
  ctx.beginPath();
  ctx.arc(52, 17, 6, 0, Math.PI * 2);
  ctx.fillStyle = T.brass;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  // The knight's swallowtail — BRASS, not red: a knight's banner means
  // care, and red is reserved for distress (§4). Gold glints calm.
  const pen: Pt[] = [[55, 26], [118, 40], [86, 52], [116, 64], [55, 74]];
  fillPoly(ctx, pen, T.brass, r, 2);
  fillPoly(ctx, [[55, 26], [118, 40], [55, 44]], lighten(T.brass, 0.09), r, 2);
  // the green chevron of the household
  fillPoly(ctx, [[62, 30], [84, 48], [62, 68]], darken(T.felt, 0.02), r, 1.5);
  // deep-brass hoist stripe
  ctx.fillStyle = darken(T.brass, 0.16);
  ctx.fillRect(55, 26, 5, 48);
  outlinePoly(ctx, pen, r, 2.5);
}

// ── The atlas ─────────────────────────────────────────────────────────────

export interface PieceAtlas {
  texture: THREE.CanvasTexture;
  /** uv rectangle of a cell (v measured WebGL-style, 0 at bottom). */
  uv(name: CellName): { u0: number; v0: number; u1: number; v1: number };
}

export function buildPieceAtlas(): PieceAtlas {
  const canvas = document.createElement('canvas');
  canvas.width = COLS * CELL_W;
  canvas.height = ROWS * CELL_H;
  const ctx = canvas.getContext('2d')!;

  const at = (name: CellName, paint: (c: Ctx) => void) => {
    const [col, row] = CELL[name];
    ctx.save();
    ctx.translate(col * CELL_W, row * CELL_H);
    ctx.beginPath();
    ctx.rect(0, 0, CELL_W, CELL_H);
    ctx.clip();
    paint(ctx);
    ctx.restore();
  };

  // Held roofs are umber, ochre-copper and slate — warm and QUIET. No held
  // roof is red: red on this table can only mean distress (§4).
  const held = (windows: 'lit') => ({ wall: T.wallPaint, windows, door: 'painted' as const });
  at('cottageHeld', (c) => paintHouse(c, { ...held('lit'), roof: T.roofUmber }, 'cottage', 101));
  at('houseHeld', (c) => paintHouse(c, { ...held('lit'), roof: T.roofCopper }, 'house', 102));
  at('wideHeld', (c) => paintHouse(c, { ...held('lit'), roof: T.roofSlate }, 'wide', 103));
  at('cottageVacant', (c) =>
    paintHouse(c, { wall: mix(T.wallPaint, T.leadBare, 0.55), roof: T.roofSlate, windows: 'dark', door: 'boarded' }, 'cottage', 104));
  at('houseVacant', (c) =>
    paintHouse(c, { wall: mix(T.wallPaint, T.leadBare, 0.55), roof: T.roofSlate, windows: 'dark', door: 'boarded' }, 'house', 105));
  // Bare lead: the unpainted casting — no knight has taken the brush to it.
  at('cottageBare', (c) =>
    paintHouse(c, { wall: T.leadBare, roof: darken(T.leadBare, 0.06), windows: 'boarded', door: 'dark' }, 'cottage', 106));
  at('houseBare', (c) =>
    paintHouse(c, { wall: T.leadBare, roof: darken(T.leadBare, 0.06), windows: 'boarded', door: 'dark' }, 'house', 107));
  at('crisis', (c) =>
    paintHouse(c, { wall: T.crisisChar, roof: darken(T.roofOx, 0.1), windows: 'dark', door: 'dark', pennant: true }, 'house', 108));
  at('fallen', (c) => {
    // Knocked clean over: the same cottage, lying on its side, base to the
    // east — and its upturned roof painted ALARM, so the one piece on the
    // table lying flat is also a spot of red you can find from the door.
    c.save();
    c.translate(60, 148);
    c.rotate(Math.PI * 0.46);
    c.translate(-64, -150);
    paintHouse(c, { wall: T.wallPaint, roof: T.alarm, windows: 'dark', door: 'painted' }, 'cottage', 109, false);
    c.restore();
    // the base, seen edge-on where the piece tipped
    const r = stream(110);
    c.beginPath();
    c.ellipse(104, 148, 7, 26, 0, 0, Math.PI * 2);
    c.fillStyle = T.leadBase;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2;
    c.stroke();
    void r;
  });
  at('treeOak', (c) => paintTree(c, 'oak', 111));
  at('treeCedar', (c) => paintTree(c, 'cedar', 112));
  at('banner', (c) => paintBanner(c, 113));

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;

  const uv = (name: CellName) => {
    const [col, row] = CELL[name];
    return {
      u0: col / COLS,
      u1: (col + 1) / COLS,
      // canvas v grows downward; texture v grows upward
      v0: (ROWS - row - 1) / ROWS,
      v1: (ROWS - row) / ROWS,
    };
  };

  return { texture, uv };
}

/** A soft radial disc — blob shadows, dust motes. */
export function softDisc(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
