/**
 * Emotes: small inked signs that pop above a head. Drawn once into one canvas
 * atlas in the manuscript manner (ink line, flat wash, a pale halo so they read
 * against anything), shown on shared quads that face the camera.
 */
import * as THREE from 'three';
import { EMOTES, type EmoteId } from '../../data/ids';

const CELL = 96, COLS = 4, ROWS = 4;
const INK = '#2a1d14', HALO = '#f6ecd2', RED = '#b3261e', GOLD = '#e3b23c', GOLD_D = '#a8781e', LAPIS = '#2f4a7a', WATER = '#5d9ac4', GREEN = '#5f9a4a', BONE = '#f4efe2', GREY = '#8a8f96';

type Ctx = CanvasRenderingContext2D;

/** draw `path` with a pale halo, a wash and an ink line */
function inked(c: Ctx, fill: string | null, path: () => void, lw = 4.5): void {
  c.lineJoin = 'round'; c.lineCap = 'round';
  path(); c.strokeStyle = HALO; c.lineWidth = lw + 7; c.stroke();
  if (fill) { path(); c.fillStyle = fill; c.fill(); }
  path(); c.strokeStyle = INK; c.lineWidth = lw; c.stroke();
}
function heart(c: Ctx, x: number, y: number, s: number): void {
  c.beginPath(); c.moveTo(x, y + s * 0.9);
  c.bezierCurveTo(x - s * 1.5, y - s * 0.1, x - s * 0.8, y - s * 1.15, x, y - s * 0.35);
  c.bezierCurveTo(x + s * 0.8, y - s * 1.15, x + s * 1.5, y - s * 0.1, x, y + s * 0.9); c.closePath();
}
function drop(c: Ctx, x: number, y: number, s: number, rot = 0): void {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.beginPath(); c.moveTo(0, -s * 1.3); c.bezierCurveTo(s * 1.1, 0, s * 0.8, s, 0, s); c.bezierCurveTo(-s * 0.8, s, -s * 1.1, 0, 0, -s * 1.3); c.closePath();
  c.restore();
}
function star(c: Ctx, x: number, y: number, ro: number, ri: number, n: number, rot = -Math.PI / 2): void {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, r = i % 2 ? ri : ro; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (i) c.lineTo(px, py); else c.moveTo(px, py); }
  c.closePath();
}
function glyph(c: Ctx, ch: string, x: number, y: number, size: number, fill: string, rot = 0): void {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.font = `900 ${size}px Georgia, 'Times New Roman', serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  c.strokeStyle = HALO; c.lineWidth = 11; c.strokeText(ch, 0, 0);
  c.strokeStyle = INK; c.lineWidth = 5; c.strokeText(ch, 0, 0);
  c.fillStyle = fill; c.fillText(ch, 0, 0);
  c.restore();
}

const DRAW: Record<EmoteId, (c: Ctx) => void> = {
  happy: c => {      // a small pleased sun
    inked(c, GOLD, () => star(c, 48, 50, 34, 23, 9));
    inked(c, '#f4cf5a', () => { c.beginPath(); c.arc(48, 50, 19, 0, Math.PI * 2); }, 3.5);
    c.strokeStyle = INK; c.lineWidth = 3.5; c.lineCap = 'round';
    c.beginPath(); c.arc(48, 51, 10, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();
    c.beginPath(); c.arc(41, 45, 2.5, Math.PI, 0); c.stroke(); c.beginPath(); c.arc(55, 45, 2.5, Math.PI, 0); c.stroke();
  },
  angry: c => {      // the scribble of a person with a point to make
    const path = () => {
      c.beginPath(); c.moveTo(22, 58);
      c.bezierCurveTo(10, 30, 44, 12, 52, 34); c.bezierCurveTo(60, 56, 26, 66, 34, 42);
      c.bezierCurveTo(42, 20, 78, 22, 70, 46); c.bezierCurveTo(62, 70, 40, 60, 54, 46);
      c.bezierCurveTo(66, 34, 86, 50, 76, 68); c.bezierCurveTo(68, 80, 38, 82, 26, 72);
    };
    c.lineCap = 'round'; c.lineJoin = 'round';
    path(); c.strokeStyle = HALO; c.lineWidth = 13; c.stroke();
    path(); c.strokeStyle = INK; c.lineWidth = 7.5; c.stroke();
    path(); c.strokeStyle = RED; c.lineWidth = 3.5; c.stroke();
  },
  sad: c => {        // a private raincloud
    inked(c, '#b9c0c8', () => {
      c.beginPath(); c.arc(34, 42, 14, Math.PI * 0.5, Math.PI * 1.5); c.arc(46, 32, 15, Math.PI, Math.PI * 1.9); c.arc(63, 40, 13, Math.PI * 1.4, Math.PI * 0.5); c.closePath();
    });
    for (const [x, y] of [[32, 68], [48, 76], [64, 67]] as const) inked(c, WATER, () => drop(c, x, y, 5.5), 3);
  },
  love: c => { inked(c, RED, () => heart(c, 48, 50, 26)); c.fillStyle = '#e8726a'; c.beginPath(); c.ellipse(36, 40, 6, 9, -0.6, 0, Math.PI * 2); c.fill(); },
  alert: c => glyph(c, '!', 48, 50, 84, RED),
  question: c => glyph(c, '?', 48, 50, 78, LAPIS),
  coin: c => {
    inked(c, GOLD, () => { c.beginPath(); c.arc(48, 48, 30, 0, Math.PI * 2); });
    c.strokeStyle = GOLD_D; c.lineWidth = 3; c.beginPath(); c.arc(48, 48, 22, 0, Math.PI * 2); c.stroke();
    // a little crown struck on it
    c.fillStyle = GOLD_D; c.beginPath(); c.moveTo(34, 58); c.lineTo(34, 40); c.lineTo(41, 49); c.lineTo(48, 37); c.lineTo(55, 49); c.lineTo(62, 40); c.lineTo(62, 58); c.closePath(); c.fill();
    c.fillStyle = '#fff4c8'; c.beginPath(); c.ellipse(36, 32, 7, 3.5, -0.7, 0, Math.PI * 2); c.fill();
  },
  zzz: c => { glyph(c, 'z', 28, 68, 34, LAPIS, -0.1); glyph(c, 'z', 48, 48, 44, LAPIS, -0.1); glyph(c, 'Z', 70, 26, 50, LAPIS, -0.1); },
  music: c => {
    inked(c, INK, () => { c.beginPath(); c.ellipse(30, 68, 11, 8, -0.4, 0, Math.PI * 2); });
    inked(c, INK, () => { c.beginPath(); c.ellipse(64, 60, 11, 8, -0.4, 0, Math.PI * 2); });
    inked(c, LAPIS, () => { c.beginPath(); c.moveTo(38, 66); c.lineTo(38, 24); c.lineTo(73, 16); c.lineTo(73, 58); c.lineTo(69, 58); c.lineTo(69, 30); c.lineTo(42, 36); c.lineTo(42, 66); c.closePath(); }, 3);
  },
  sweat: c => { inked(c, WATER, () => drop(c, 36, 54, 14, 0.5)); inked(c, WATER, () => drop(c, 64, 38, 10, 0.5), 3.5); c.fillStyle = '#d8ecf8'; c.beginPath(); c.ellipse(31, 58, 3, 5, 0.5, 0, Math.PI * 2); c.fill(); },
  idea: c => {       // a candle is lit
    c.strokeStyle = GOLD; c.lineWidth = 4; c.lineCap = 'round';
    for (let i = 0; i < 7; i++) { const a = Math.PI + (i + 0.5) / 7 * Math.PI; c.beginPath(); c.moveTo(48 + Math.cos(a) * 24, 30 + Math.sin(a) * 24); c.lineTo(48 + Math.cos(a) * 33, 30 + Math.sin(a) * 33); c.stroke(); }
    inked(c, BONE, () => { c.beginPath(); c.rect(39, 46, 18, 36); });
    inked(c, '#ffb25e', () => { c.beginPath(); c.moveTo(48, 12); c.bezierCurveTo(62, 28, 56, 42, 48, 42); c.bezierCurveTo(40, 42, 34, 28, 48, 12); c.closePath(); }, 3.5);
    c.fillStyle = '#fff0c0'; c.beginPath(); c.ellipse(48, 34, 4, 6, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(48, 42); c.lineTo(48, 47); c.stroke();
  },
  skull: c => {
    inked(c, BONE, () => { c.beginPath(); c.arc(48, 42, 27, Math.PI * 0.85, Math.PI * 0.15); c.lineTo(64, 66); c.lineTo(64, 78); c.lineTo(32, 78); c.lineTo(32, 66); c.closePath(); });
    c.fillStyle = INK; c.beginPath(); c.ellipse(37, 45, 7.5, 9, 0.15, 0, Math.PI * 2); c.fill(); c.beginPath(); c.ellipse(59, 45, 7.5, 9, -0.15, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(48, 54); c.lineTo(44, 62); c.lineTo(52, 62); c.closePath(); c.fill();
    c.strokeStyle = INK; c.lineWidth = 3; for (const x of [40, 48, 56]) { c.beginPath(); c.moveTo(x, 68); c.lineTo(x, 78); c.stroke(); }
  },
  cheer: c => {      // hurrah
    inked(c, GOLD, () => star(c, 46, 50, 30, 13, 5));
    for (const [x, y, col, r] of [[76, 24, RED, 6], [18, 26, LAPIS, 5], [78, 70, GREEN, 5], [20, 76, RED, 4]] as const) inked(c, col, () => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); }, 2.5);
  },
  shock: c => { inked(c, '#f4cf5a', () => star(c, 48, 48, 40, 25, 10)); glyph(c, '!', 39, 50, 46, RED, -0.12); glyph(c, '!', 58, 50, 46, RED, 0.12); },
};
void GREY;

let atlas: THREE.CanvasTexture | null = null;
let material: THREE.MeshBasicMaterial | null = null;
const quads = new Map<EmoteId, THREE.BufferGeometry>();

/** false in node (no canvas): emotes are simply not shown */
export function emotesAvailable(): boolean { return typeof document !== 'undefined'; }

function ensure(): THREE.MeshBasicMaterial | null {
  if (material) return material;
  if (!emotesAvailable()) return null;
  const cv = document.createElement('canvas'); cv.width = CELL * COLS; cv.height = CELL * ROWS;
  const c = cv.getContext('2d');
  if (!c) return null;
  EMOTES.forEach((id, i) => {
    c.save(); c.translate((i % COLS) * CELL, Math.floor(i / COLS) * CELL);
    c.beginPath(); c.rect(0, 0, CELL, CELL); c.clip();
    DRAW[id](c);
    c.restore();
  });
  atlas = new THREE.CanvasTexture(cv);
  atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 4; atlas.generateMipmaps = true;
  material = new THREE.MeshBasicMaterial({ map: atlas, transparent: true, alphaTest: 0.08, depthWrite: false, toneMapped: false, fog: false });
  return material;
}

/** a unit quad whose UVs frame one emote in the atlas (shared) */
export function emoteQuad(id: EmoteId): THREE.BufferGeometry {
  let g = quads.get(id);
  if (!g) {
    g = new THREE.PlaneGeometry(1, 1);
    const i = EMOTES.indexOf(id), cx = i % COLS, cy = Math.floor(i / COLS);
    const u0 = cx / COLS, u1 = (cx + 1) / COLS, v1 = 1 - cy / ROWS, v0 = 1 - (cy + 1) / ROWS;
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0);
    quads.set(id, g);
  }
  return g;
}
export function emoteMaterial(): THREE.MeshBasicMaterial | null { return ensure(); }
