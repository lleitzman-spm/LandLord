/**
 * The build book: a slim rail of wax-seal tools down the left edge, and the
 * pattern book that opens beside it.
 *
 *   rail    Build (opens the book) · Road · Clear · Demolish | Ledger · Council · Charter · Help
 *   book    Homes / Trades / Amenities / Household, each plan a small inked plate; and Buy land
 *   strip   what is in hand right now, and how to put it down
 *
 * With the frame: B arrives as the frame's `ll:summon` ('build') on ctx.root, which this
 * part answers; Esc is the frame's (it puts the tool down, we hear 'cancel' from the
 * renderer fan-out, and `escape()` shuts the book). R turns the plan in hand.
 * Extras beyond `Part`: `escape()`, `reset()`, `toggle()`, `openBook(tab?)`, `closeBook()`,
 * `disarm()`, `dispose()`. It also answers a window CustomEvent `ll:buildmenu`
 * (detail: 'toggle' | 'open' | 'close').
 *
 * `pictogram(btype, level)` is exported for the inspector's header.
 */
import type { UICtx } from '../api';
import type { Part } from './part';
import type { GameState, RankId, Parcel, SimEvent, Id } from '../../sim/types';
import { RANK_ORDER, PARCEL } from '../../sim/types';
import type { Tool } from '../../render/api';
import type { BuildingType, IconId } from '../../data/ids';
import type { BuildingDef } from '../../data/schema';
import { BUILDINGS, BUILDING_LIST, RANKS, ROLE_TITLES, TRADE_DEFS, SPECIES_DEFS } from '../../data';
import { h, clear, fromHTML, addStyle, setText, setClass, num, signed, crowns, plural } from '../kit';
import { iconSvg } from '../icons';
import { TOOLS_CSS } from '../css/tools';
import * as worldSim from '../../sim/world';

/** What the sim charges for a tile of road and for clearing, when it says (it is the owner of those numbers). */
function landCosts(): { road: number | null; tree: number | null; rock: number | null } {
  const tune = (worldSim as unknown as { TUNE?: { roadCost?: unknown; clearForest?: { cost?: unknown }; clearRock?: { cost?: unknown } } }).TUNE;
  const n = (v: unknown): number | null => (typeof v === 'number' && v > 0 ? v : null);
  return { road: n(tune?.roadCost), tree: n(tune?.clearForest?.cost), rock: n(tune?.clearRock?.cost) };
}

// ───────────────────────── pictograms ─────────────────────────
// One inked plate per building: 48-unit box, ground line near y = 41, ink in
// currentColor with flat washes. Drawn by hand, in code, to read at 40px.

const W = {
  plaster: '#f7efd9', thatch: '#d6b25f', timber: '#8b6b47', plank: '#b99668', tile: '#b8573f',
  slate: '#7f8a96', stone: '#cbc3af', leaf: '#7a9a68', water: '#5f80ab', glass: '#f3d98a',
  gold: '#dcb94a', dark: '#3b2a1d', wine: '#8f3028', purple: '#7c5d99', cloth: '#efe4c8',
  sky: '#9db2d2', copper: '#6f9a8a', ember: '#e8873a', soot: '#8a8076', marble: '#e4ddcd',
};
const f = (d: string, fill: string, extra = ''): string => `<path d="${d}" fill="${fill}"${extra}/>`;
const s = (d: string, extra = ''): string => `<path d="${d}"${extra}/>`;
const t = (d: string, extra = ''): string => `<path d="${d}" stroke-width=".9" opacity=".72"${extra}/>`;
const o = (cx: number, cy: number, r: number, fill = 'none', extra = ''): string => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${extra}/>`;
const GROUND = '<path d="M4.5 41.6Q13 40.7 24 41.5T43.5 41.2" stroke-width="1.1" opacity=".8"/>';
const smoke = (x: number, y: number): string => t(`M${x} ${y}q-2.2-1.8-.2-3.8q2-1.6.2-3.6`);

function sails(cx: number, cy: number, r0: number, r1: number, wid: number, a0: number): string {
  let out = '';
  for (let i = 0; i < 4; i++) {
    const a = a0 + (i * Math.PI) / 2, dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx;
    const P = (r: number, w: number): string => `${(cx + dx * r + px * w).toFixed(1)} ${(cy + dy * r + py * w).toFixed(1)}`;
    out += f(`M${P(r0, 0)}L${P(r1, 0)}L${P(r1, wid)}L${P(r0, wid)}Z`, W.cloth, ' stroke-width="1.1"');
    out += t(`M${P((r0 + r1) / 2, 0)}L${P((r0 + r1) / 2, wid)}M${P(r0, wid / 2)}L${P(r1, wid / 2)}`);
    out += s(`M${cx} ${cy}L${P(r1 + 0.6, 0)}`);
  }
  return out;
}

const PLATES: Record<Exclude<BuildingType, 'seat'>, string> = {
  hovel:
    GROUND
    + f('M13 41L13.6 28.5L35 27.8L35.6 41Z', W.plaster)
    + f('M8.5 30Q14 21 22.5 14.5Q24 13.6 25.4 14.8Q33.5 21.5 40 29.2L36.8 31Q30.5 27.2 24 27.6Q17 27.6 11.6 31.4Z', W.thatch)
    + t('M18 20.5l-1.6 3M24 17v3.2M29.6 20.6l1.4 2.8M14.5 25.5l-1.2 2.4M33.6 25l1.2 2.2')
    + f('M26.8 22.6l2.8-1l1 2.5l-2.8 1Z', W.plaster, ' stroke-width="1"')
    + f('M21 41V33.4Q23.6 31.6 26.4 33.2V41Z', W.timber)
    + f('M29.8 33h3.2v3.2h-3.2Z', W.dark)
    + s('M39.4 41L36.4 32.6'),
  cottage:
    GROUND
    + f('M12 41V26H36V41Z', W.plaster)
    + t('M12 33H36M18 26V41M30 26V41M12 33l6-7M36 33l-6-7')
    + f('M8.5 27.5L24 12L39.5 27.5L36.5 28.6H11.5Z', W.tile)
    + t('M14.6 24H33.4M18.8 19.8H29.2')
    + f('M29.6 17.4V8.6H33.6V21.2Z', W.stone)
    + smoke(31.8, 6.8)
    + f('M21.6 41V32.2H26.4V41Z', W.timber) + o(25.3, 37, 0.5, 'currentColor')
    + f('M13.6 28.6h3.2v3.2h-3.2Z', W.glass) + f('M31.2 28.6h3.2v3.2h-3.2Z', W.glass)
    + o(14.6, 39.6, 0.8, W.wine, ' stroke-width=".6"') + o(33.6, 39.4, 0.8, W.wine, ' stroke-width=".6"'),
  burrow:
    GROUND
    + f('M5 41Q7 22 24 20Q41 22 43 41Z', W.leaf)
    + f('M12.6 26V19.4h3.8V24Z', W.stone) + smoke(14.6, 17.6)
    + o(23, 33.4, 6.8, W.wine)
    + t('M20.4 27.4V39.4M23 26.6V40.2M25.6 27.4V39.4')
    + o(23, 33.4, 1, W.gold, ' stroke-width=".8"')
    + o(35.4, 34.6, 2.5, W.glass) + t('M33 34.6h4.8M35.4 32.2v4.8')
    + t('M9 31l1-2.2l.9 2.2M30.4 23l.8-2.1l.9 2M39 29l.9-2.1l.9 2.2M16 23.4l.8-2l.9 1.9'),
  longhouse:
    GROUND
    + f('M7 41V30H41V41Z', W.plaster)
    + f('M4.5 31L11 17.5H37L43.5 31L40.5 32H7.5Z', W.thatch)
    + t('M8.6 27H39.4M10.4 22.6H37.6')
    + s('M9 20.4L13.6 13.6M13.2 20.4L8.6 13.6M39 20.4L34.4 13.6M34.8 20.4L39.4 13.6')
    + smoke(24, 15.6)
    + f('M13.6 41V34.2h4.4V41Z', W.timber) + f('M30 41V34.2h4.4V41Z', W.timber)
    + f('M22.4 34.2h3.2v3h-3.2Z', W.glass)
    + t('M24 30.6v2.4'),
  stonehall:
    GROUND
    + f('M8 41V30l-2.8 3.2V41Z', W.stone) + f('M40 41V30l2.8 3.2V41Z', W.stone)
    + f('M8 41V23H40V41Z', W.stone)
    + t('M8 28.6H40M15 23v5.6M25 23v5.6M33.4 23v5.6M18.6 28.6V34M29.6 28.6V34M8 34.4h3.2M37 34.4h3')
    + f('M6 23.6L10.5 14H37.5L42 23.6Z', W.slate)
    + t('M9.4 20H38.6M11.4 17H36.6')
    + f('M13 14V10.2h3.6V14Z', W.stone) + f('M31.4 14V10.2H35V14Z', W.stone)
    + f('M21 41V34.5Q24 30.4 27 34.5V41Z', W.timber)
    + f('M12.6 37V32.4q1.2-1.7 2.4 0V37Z', W.dark) + f('M33 37V32.4q1.2-1.7 2.4 0V37Z', W.dark),
  townhouse:
    GROUND
    + f('M15 41V32H33V41Z', W.plaster)
    + f('M13.5 32V23H34.5V32Z', W.plaster)
    + f('M12 23V15.6H36V23Z', W.plaster)
    + f('M30.2 11V4.6h3.2v9.2Z', W.stone)
    + f('M10 16.4L24 4.4L38 16.4Z', W.tile)
    + t('M14.6 13H33.4M18.4 9.6H29.6')
    + f('M21.6 17.4h4.8v3.4h-4.8Z', W.glass)
    + f('M16.4 25.2h3.8v3.8h-3.8Z', W.glass) + f('M27.8 25.2h3.8v3.8h-3.8Z', W.glass)
    + t('M24 23.4v8.2')
    + f('M18.4 41V34.6h4.4V41Z', W.timber) + f('M26.4 35h3.4v3h-3.4Z', W.glass),
  treehouse:
    GROUND
    + f('M21.4 41Q22.6 33 21 26L27.2 26Q25.6 33 27 41Z', W.timber)
    + f('M8 22Q5 14 12 10.5Q14 4.5 22 5.5Q28 2 33.5 6.5Q41 7 41 14.5Q45 20 39.5 24Q36 29 29 26.5Q22 30 16 26.5Q9.5 27.5 8 22Z', W.leaf)
    + t('M11.6 16.4q1.6-1.6 3.2 0M33.6 10.6q1.6-1.4 3.2 0M36 20.6q1.4-1.4 2.8 0M17.6 8.8q1.4-1.3 2.8 0')
    + f('M17.6 24V17H30.4V24Z', W.plaster)
    + f('M15.4 17.6L24 10.6L32.6 17.6Z', W.thatch)
    + f('M22 18.8h4v3.2h-4Z', W.glass)
    + s('M14.4 24.2H33.6', ' stroke-width="1.9"')
    + s('M31 24.4L33.6 41M34 24.4L36.6 41') + t('M31.6 28.4h3M32.2 32.4h3M32.8 36.4h3'),
  wizard_tower:
    GROUND
    + f('M18.4 41L20 17H29L30.6 41Z', W.stone)
    + t('M19.4 27.4h4M25.6 31h4.6M19 34.6h3.4M26 23.6h3.4')
    + f('M29.8 26.6h4.4v4.8h-4.1Z', W.plaster) + f('M29.2 26.8l2.8-2.8l3 2.8Z', W.purple)
    + f('M17.4 17.4H31.6L30.4 14H18.6Z', W.stone)
    + f('M17.2 14L24.4 3.8Q25.2 2 27.4 1.6Q26 3.2 26.4 4.6L32 14Z', W.purple)
    + f('M22.8 23v-2.2q1.6-1.8 3.2 0V23Z', W.glass)
    + f('M22.4 41V36.4Q24.5 34.2 26.6 36.4V41Z', W.timber)
    + s('M37.4 7.6v4.4M35.2 9.8h4.4', ' stroke-width="1.1"') + t('M10.6 15.6v3M9.1 17.1h3M38.6 19.6v2.4M37.4 20.8h2.4'),
  market_stall:
    GROUND
    + s('M10 41V19.6M38 41V19.6')
    + f('M9 41V30.4H39V41Z', W.plank) + t('M9 34.6H39M17 34.6V41M31 34.6V41')
    + f('M7 20L11 12H37L41 20Z', W.cloth)
    + f('M7 20L11 12h4.3L12.7 20Z', W.wine, ' stroke-width="1"') + f('M18.3 20L19.7 12H24v8Z', W.wine, ' stroke-width="1"') + f('M29.7 20L28.3 12h4.4L35.3 20Z', W.wine, ' stroke-width="1"')
    + f('M7 20q2.85 3.2 5.7 0q2.85 3.2 5.6 0q2.85 3.2 5.7 0q2.85 3.2 5.7 0q2.85 3.2 5.6 0q2.85 3.2 5.7 0Z', W.cloth, ' stroke-width="1.1"')
    + f('M13.4 30.4a3.3 2.4 0 0 1 6.6 0Z', W.gold) + f('M22.6 30.4a2.5 2 0 0 1 5 0Z', W.thatch)
    + f('M31.6 30.4v-3.6h3v3.6Z', W.sky) + t('M15.4 29l1.6-1'),
  bakery:
    GROUND
    + f('M10 41V26H34V41Z', W.plaster)
    + f('M34 41V31Q34 25.6 38.6 25.6Q43 25.6 43 31V41Z', W.tile)
    + f('M36.6 41V36Q38.6 33.2 40.6 36V41Z', W.dark) + f('M38.6 40.4q-1.5-1.8 0-3.4q1.5 1.6 0 3.4Z', W.ember, ' stroke-width=".6"')
    + f('M36.8 25.8V14.6h3.6V26Z', W.tile) + smoke(38.6, 12.6) + smoke(41, 9.6)
    + f('M7 27L22 13L37 27L34 28H10Z', W.thatch) + t('M14 23.6H30M17.6 19.8H26.4')
    + f('M13.6 41V33h4.8V41Z', W.timber)
    + f('M21.6 31h8.4v5.4h-8.4Z', W.glass) + t('M22.8 35.4a1.3 1.1 0 0 1 2.6 0M26.2 35.4a1.3 1.1 0 0 1 2.6 0')
    + s('M10 29.4H4.6M7 29.4v1.4') + f('M3.4 33.2a3.4 2.3 0 1 0 6.8 0a3.4 2.3 0 1 0-6.8 0Z', W.thatch, ' stroke-width="1.1"') + t('M5.4 32.6l1 1.2M7.4 32.4l1 1.2'),
  smithy:
    GROUND
    + f('M9 41V25H33V41Z', W.stone)
    + f('M13 41V30H28V41Z', W.dark)
    + f('M20.4 40q-3.4-3.2 0-7q3.4 3.6 0 7Z', W.ember, ' stroke-width=".7"')
    + f('M22.8 16.4V8h5.6v8.4Z', W.stone)
    + f('M25.4 6.2q-3.2-1.2-1.8-3.8q2.2-2.6 4.6-.6q3-.6 3.2 1.8q.2 2.6-2.8 2.6Z', W.soot, ' stroke-width="1"')
    + f('M6.5 26L12 16H31L35.5 26Z', W.slate) + t('M9.4 22.6H33')
    + t('M18.6 28a2 2 0 1 1 3.6 0')
    + f('M35.4 34.6H44.4L42.4 36.8H40.8V39.2H42.4V41H36.4V39.2H38V36.8H35.4Z', W.slate, ' stroke-width="1.2"'),
  mill:
    GROUND
    + f('M17 41L19.6 20H28.4L31 41Z', W.plaster)
    + f('M18.4 20.4Q24 12.6 29.6 20.4Z', W.tile)
    + f('M22 41V35.4h4V41Z', W.timber) + f('M22.8 27h2.4v3h-2.4Z', W.dark)
    + sails(24, 18.6, 3.6, 15, 3.8, 0.38)
    + o(24, 18.6, 1.5, W.dark),
  apothecary:
    GROUND
    + f('M11 41V25H37V41Z', W.plaster)
    + f('M8 26L24 12.5L40 26L37 27H11Z', W.copper) + t('M14.4 22.6H33.6M18.6 18.6H29.4')
    + f('M14.4 41V32.4h5V41Z', W.timber)
    + f('M23.6 30h10.4v7.4H23.6Z', W.glass)
    + f('M25.6 36.6v-2.8h-.6v-1.3h2.3v1.3h-.6v2.8Z', W.wine, ' stroke-width=".8"')
    + o(31, 35, 1.6, W.leaf, ' stroke-width=".8"') + t('M31 33.4v-1.5')
    + s('M37 27.6h5.6M40.6 27.6v1.4')
    + f('M39.9 29v2.2l-2.3 3.9q-.7 1.7 1 1.7h4q1.7 0 1-1.7l-2.3-3.9V29Z', W.purple, ' stroke-width="1.1"'),
  tavern:
    GROUND
    + f('M7 41V29H41V41Z', W.plaster)
    + f('M5.6 29V20H42.4V29Z', W.plaster) + t('M14 20v9M24 20v9M34 20v9')
    + f('M31 9.6V4.6h3.8v5Z', W.stone) + smoke(33, 2.9)
    + f('M3.6 20.6L10 9H38L44.4 20.6Z', W.tile) + t('M7.4 16.6H40.6M9.6 12.8H38.4')
    + f('M17.2 22.4h3.6v3.9h-3.6Z', W.glass) + f('M27.2 22.4h3.6v3.9h-3.6Z', W.glass)
    + f('M20.6 41V34Q24 30.4 27.4 34V41Z', W.timber) + t('M24 32.2V41')
    + f('M9.6 32.6h5v4.4h-5Z', W.glass) + t('M12.1 32.6v4.4M9.6 34.8h5')
    + f('M31.4 41q-1.1-3 0-5.8h4.2q1.1 2.8 0 5.8Z', W.timber, ' stroke-width="1.1"') + t('M31 37h5M31 39.2h5')
    + s('M42.4 22.4h3.4', ' stroke-width="1.1"') + f('M43.2 23.6h3.4v4.2h-3.4Z', W.gold, ' stroke-width="1"'),
  well:
    GROUND
    + s('M16.4 32.6V17M31.6 32.6V17')
    + f('M15 41V33a9 3 0 0 1 18 0V41a9 3 0 0 1-18 0Z', W.stone)
    + f('M15 33a9 3 0 0 0 18 0a9 3 0 0 0-18 0Z', W.water)
    + t('M19.6 37v3.4M24 38v3.6M28.6 37v3.4M15.6 38.6q8.4 2.8 16.8 0')
    + f('M12 18.6L24 10L36 18.6Z', W.tile)
    + s('M16.4 22H34.2v2.6') + s('M24 22v5.6', ' stroke-width="1"')
    + f('M22.1 27.6h3.8l-.5 3.4h-2.8Z', W.timber, ' stroke-width="1.1"'),
  garden:
    GROUND
    + s('M30 33V19.6') + t('M30 26q-3.4-.8-4.2-3.6M30 28.6q3.4-.8 4.2-3.4')
    + o(30, 16.6, 3.3, W.gold) + o(30, 16.6, 1.3, W.timber, ' stroke-width=".8"')
    + s('M35.6 33.4L38.2 21L40.8 33.4M38.2 21v12.4', ' stroke-width="1.1"')
    + o(37, 27, 1, W.leaf, ' stroke-width=".7"') + o(39.6, 30, 1, W.leaf, ' stroke-width=".7"') + o(38.4, 24, 0.9, W.wine, ' stroke-width=".7"')
    + o(11, 29.8, 3.4, W.leaf) + t('M9.4 29.4q1.6-1.8 3.2 0M10.2 31.2q.9-1 1.8 0')
    + o(19.6, 29.4, 3.4, W.leaf) + t('M18 29q1.6-1.8 3.2 0M18.8 30.8q.9-1 1.8 0')
    + s('M6 41V32.6M13.4 41V32.6M20.8 41V32.6M28.2 41V32.6M35.6 41V32.6M43 41V32.6')
    + s('M5 35.2H44M5 38.4H44', ' stroke-width="1.2"'),
  notice_board:
    GROUND
    + s('M14 41V17M34 41V17')
    + f('M11.6 19H36.4V33H11.6Z', W.plank)
    + f('M9.6 18.6L24 12.4L38.4 18.6Z', W.tile)
    + f('M14.2 21.4h6v7.2h-6Z', W.plaster, ' stroke-width="1"') + t('M15.4 23.4h3.6M15.4 25.2h3.6M15.4 27h2.2')
    + f('M22.4 22.4l5-.6l.5 4.4l-5 .6Z', W.plaster, ' stroke-width="1"')
    + f('M29.2 21.2h5v8.8h-5Z', W.plaster, ' stroke-width="1"') + t('M30.4 23.2h2.6M30.4 25h2.6') + o(31.7, 28, 0.9, W.wine, ' stroke-width=".6"'),
  shrine:
    GROUND
    + f('M19 41V30H29V41Z', W.stone) + s('M16.6 41H31.4')
    + f('M16 30V19.6H32V30Z', W.plaster)
    + f('M13.6 20L24 11L34.4 20Z', W.tile)
    + f('M19.6 30V24Q24 19.2 28.4 24V30Z', W.sky)
    + f('M22.3 30q.2-3.6 1.7-4q1.5.4 1.7 4Z', W.wine, ' stroke-width="1"') + o(24, 24.5, 1.3, W.plaster, ' stroke-width="1"')
    + f('M12.6 41v-3.6h1.8V41Z', W.plaster, ' stroke-width="1"') + f('M13.5 36.6q-1-1.2 0-2.4q1 1.2 0 2.4Z', W.gold, ' stroke-width=".6"')
    + o(33.6, 39.8, 0.9, W.wine, ' stroke-width=".6"') + o(35.6, 40, 0.8, W.gold, ' stroke-width=".6"'),
  stocks:
    GROUND
    + f('M11 41V20h3.4V41Z', W.timber) + f('M33.6 41V20H37V41Z', W.timber)
    + f('M8.4 31H39.6V36.4H8.4Z', W.plank) + f('M8.4 25.4H39.6V31H8.4Z', W.plank)
    + o(24, 31, 3.3, W.dark) + o(16, 31, 1.8, W.dark) + o(32, 31, 1.8, W.dark)
    + f('M40.6 30.4a1.5 1.7 0 0 1 3 0v.5h.6v3.1h-4.2v-3.1h.6Z', W.gold, ' stroke-width="1"')
    + o(20.4, 39.6, 1.4, W.wine, ' stroke-width=".7"') + t('M20.4 38.2l.6-1') + o(28.6, 40, 1.1, W.leaf, ' stroke-width=".7"'),
  statue:
    GROUND
    + f('M16 41V33H32V41Z', W.stone) + f('M14.6 33.2H33.4V30.6H14.6Z', W.stone) + t('M19 36.2h10M20.6 38.4h6.8')
    + f('M20.6 30.6Q20.2 23 22.2 18.6H26Q28 23 27.6 30.6Z', W.marble)
    + s('M22.3 19.8q-3.4 1.8-2 5.2q1.2.5 1.8-.6', ' stroke-width="1.3"')
    + s('M25.9 19.6L31.2 13', ' stroke-width="1.7"')
    + o(24.1, 14.9, 2.6, W.marble)
    + f('M22 13.2l.5-2l1.6 1.3l1.6-1.3l.5 2Z', W.gold, ' stroke-width=".8"')
    + f('M30.4 11.6q1.7-1.9 3.6-.4l1.3-.4l-.8 1.3q-1.7 1.3-4.1-.5Z', W.slate, ' stroke-width=".9"'),
  watchtower:
    GROUND
    + s('M17 41L20 22M31 41L28 22') + t('M18 35L29.6 28M30 35L18.4 28')
    + s('M22.6 41V22M25.4 41V22', ' stroke-width="1"') + t('M22.6 37.6h2.8M22.6 33.6h2.8M22.6 29.6h2.8M22.6 25.6h2.8')
    + f('M15.6 22V13.6H32.4V22Z', W.plank) + f('M19 15.8h10v3H19Z', W.dark)
    + s('M24 6V1.6', ' stroke-width="1.1"') + f('M24 1.8l5.2 1.4L24 4.6Z', W.wine, ' stroke-width=".9"')
    + f('M13.6 14L24 5.8L34.4 14Z', W.slate),
  chapel:
    GROUND
    + f('M17 41V26H41V41Z', W.plaster)
    + f('M15 26.6L29 14.6L43 26.6Z', W.slate)
    + f('M7 41V17H17V41Z', W.stone)
    + f('M9.9 25v-4.6q2.1-2.3 4.2 0V25Z', W.dark) + o(12, 23.2, 1.1, W.gold, ' stroke-width=".6"')
    + f('M5.6 17.4L12 4.8L18.4 17.4Z', W.slate)
    + s('M12 4.8V2.2', ' stroke-width="1"') + f('M10.2 2.4l3.4-1l-.7 1.7Z', W.gold, ' stroke-width=".7"')
    + f('M26.4 41V34.2Q29 30.6 31.6 34.2V41Z', W.timber)
    + o(29, 28.6, 2, W.sky)
    + f('M19.8 37.4V33q1.2-1.7 2.4 0v4.4Z', W.sky, ' stroke-width="1"') + f('M35.8 37.4V33q1.2-1.7 2.4 0v4.4Z', W.sky, ' stroke-width="1"'),
  masons_yard:
    GROUND
    + s('M8 41V25.6M24.6 41V22')
    + f('M5.4 25.2L26.4 19.8L27.4 23.2L6.2 28.8Z', W.thatch)
    + s('M10 36H21.4M11.6 36L10 41M19.8 36L21.4 41', ' stroke-width="1.2"')
    + f('M12.8 36v-4.2h5.8V36Z', W.stone)
    + f('M29 41v-4.6h6.4V41Z', W.stone) + f('M35.4 41v-4.6h6.4V41Z', W.stone) + f('M32 36.4v-4.6h6.6v4.6Z', W.stone)
    + s('M35 31l3.2-4.2', ' stroke-width="1.2"') + f('M36.6 26.2l1.7-1.7l2.6 2.6l-1.7 1.7Z', W.timber, ' stroke-width="1"')
    + f('M43 41L44.6 22.6l1.7.2L45 41Z', W.plank, ' stroke-width="1"'),
  bailiffs_post:
    GROUND
    + f('M11 41V24H37V41Z', W.stone)
    + t('M11 30h3M34 30h3M11 36h3M34 36h3M22 24v3M26 38v3')
    + f('M8.4 24.6L24 13L39.6 24.6Z', W.slate) + t('M14.6 21H33.4')
    + f('M15 41V32.4Q18 28.8 21 32.4V41Z', W.timber) + f('M16.8 33.8h2.6v3h-2.6Z', W.plaster, ' stroke-width=".8"')
    + f('M25.4 29.4h7.6v6.6h-7.6Z', W.dark)
    + '<path d="M27.4 29.6v6.2M29.2 29.6v6.2M31 29.6v6.2" stroke="' + W.stone + '" stroke-width="1"/>'
    + s('M11 26.6H5.4M6.8 26.6v1.2', ' stroke-width="1.1"')
    + o(6.8, 29.9, 2, W.gold, ' stroke-width="1.1"') + s('M6.8 31.9v5.3M6.8 34.6h2M6.8 36.8h2.3', ' stroke-width="1.2"'),
  criers_stand:
    GROUND
    + s('M27.6 33V9.2')
    + f('M27.6 9.4L36 11.4L27.6 13.6Z', W.wine, ' stroke-width="1"')
    + s('M27.6 15.4H19.4M20.6 15.4v1.4', ' stroke-width="1.2"')
    + f('M17.4 23.2q.4-5.8 3.2-6.2q2.8.4 3.2 6.2Z', W.gold) + o(20.6, 24.2, 0.9, W.dark, ' stroke-width=".6"')
    + t('M13.8 18l-2.3-1M13.2 21h-2.6M13.8 24l-2.3 1')
    + f('M15 41V33H31V41Z', W.plank) + t('M15 37H31')
    + f('M11.4 41v-3.2H15V41Z', W.plank, ' stroke-width="1.1"')
    + f('M18.6 34.6h8.4v4.4h-8.4Z', W.plaster, ' stroke-width="1"') + t('M20 36.2h5.6M20 37.6h4'),
  counting_house:
    GROUND
    + f('M10 41V24H38V41Z', W.plaster)
    + f('M10 41V24h3.4V41Z', W.stone, ' stroke-width="1"') + f('M34.6 41V24H38V41Z', W.stone, ' stroke-width="1"')
    + f('M7.6 24.6L13 14H35L40.4 24.6Z', W.slate) + t('M10.6 20.8H37.4')
    + t('M24 16v4.2M20.6 17.2h6.8M20.6 17.2l-1.2 2.4h2.4ZM27.4 17.2l-1.2 2.4h2.4Z')
    + f('M21 41V32h6V41Z', W.timber) + t('M21 35h6M21 38h6')
    + f('M14.6 30h4.6v4.6h-4.6Z', W.glass) + t('M16.2 30v4.6M17.7 30v4.6')
    + f('M28.8 30h4.6v4.6h-4.6Z', W.glass) + t('M30.4 30v4.6M31.9 30v4.6')
    + s('M19 41h10', ' stroke-width="1.9"')
    + s('M38 26.6h4.8M42.4 26.6v1', ' stroke-width="1.1"') + o(42.4, 30.6, 2.9, W.gold) + t('M41 31.4l.5-1.9l.9 1.1l.9-1.1l.5 1.9Z'),
};

const SEATS: string[] = [
  // the Reeve's hut
  GROUND
  + f('M11 41V27H37V41Z', W.plaster)
  + s('M24 13.4V4', ' stroke-width="1.1"') + f('M24 4.4l7.2 1.9L24 8.6Z', W.wine, ' stroke-width="1"')
  + f('M7.6 28.4L24 13L40.4 28.4L37 29.6H11Z', W.thatch) + t('M15 24H33M19 19.8H29')
  + f('M21.4 41V32.6h5.2V41Z', W.timber)
  + f('M14.2 31.6h4v3.6h-4Z', W.glass) + f('M29.8 31.6h4v3.6h-4Z', W.glass),
  // the manor
  GROUND
  + f('M8 41V25H40V41Z', W.plaster) + t('M8 33H40M14 25V41M34 25V41')
  + f('M12 14.4V9.4h3.4v5Z', W.stone) + f('M32.6 14.4V9.4H36v5Z', W.stone)
  + f('M5.4 25.6L10.6 14H37.4L42.6 25.6Z', W.tile) + t('M8 21.6H40')
  + f('M17.4 25.6V20L24 14.6L30.6 20v5.6Z', W.plaster) + f('M16.2 20.8L24 14L31.8 20.8', 'none')
  + f('M22.2 19.6h3.6v3.8h-3.6Z', W.glass)
  + s('M24 14V6.4', ' stroke-width="1.1"') + f('M24 6.6l6.4 1.7L24 10.2Z', W.wine, ' stroke-width="1"')
  + f('M20.8 41V34Q24 30.6 27.2 34V41Z', W.timber)
  + f('M10.4 28.2h2.8v3.4h-2.8Z', W.glass) + f('M15.8 28.2h2.8v3.4h-2.8Z', W.glass) + f('M29.4 28.2h2.8v3.4h-2.8Z', W.glass) + f('M34.8 28.2h2.8v3.4h-2.8Z', W.glass),
  // the keep
  GROUND
  + f('M7 41V26h6v15Z', W.stone) + f('M35 41V26h6v15Z', W.stone)
  + f('M13 41V15.4H35V41Z', W.stone)
  + f('M11.6 15.6V9.8h4v2.6h2.93V9.8h4v2.6h2.94V9.8h4v2.6h2.93V9.8h4v5.8Z', W.stone)
  + t('M13 22h4M31 22h4M13 30h3.4M31.6 30H35M20 18.6h4M26 26h4')
  + s('M24 9.8V2', ' stroke-width="1.1"') + f('M24 2.4h7.8l-1.9 2.2l1.9 2.2H24Z', W.wine, ' stroke-width="1"')
  + f('M22.2 23.6v-3q1.8-2 3.6 0v3Z', W.glass)
  + s('M17.4 24.6v4.6M30.6 24.6v4.6', ' stroke-width="1.8"')
  + f('M20 41V32.4Q24 27.8 28 32.4V41Z', W.dark)
  + '<path d="M22 31.4V41M24 30.4V41M26 31.4V41M20 35.4h8M20 38.4h8" stroke="' + W.stone + '" stroke-width=".8"/>',
];

/** An inked plate of a building type as inline SVG (class `ll-pic`). `level` picks the seat's form. */
export function pictogram(btype: BuildingType, level = 1): string {
  const body = btype === 'seat' ? SEATS[Math.max(0, Math.min(SEATS.length - 1, level - 1))]! : PLATES[btype];
  return `<svg class="ll-pic" viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
}

/** The footprint as a tiny grid; the notch marks the side the door faces. */
export function footprintSvg(w: number, hh: number, rot = 0): string {
  const rw = rot % 2 ? hh : w, rh = rot % 2 ? w : hh, c = 4.6, pad = 3, e = 1.3;
  const W_ = rw * c + pad * 2, H_ = rh * c + pad * 2;
  const n = (v: number): string => v.toFixed(1);
  let cells = '';
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) cells += `<rect x="${n(pad + x * c + 0.4)}" y="${n(pad + y * c + 0.4)}" width="${n(c - 0.8)}" height="${n(c - 0.8)}" rx=".7"/>`;
  const mx = pad + (rw * c) / 2, my = pad + (rh * c) / 2;
  // the door mark sits just inside the box, so nothing clips it
  const door = [`M${n(mx - 1.9)} ${n(H_ - e)}h3.8`, `M${e} ${n(my - 1.9)}v3.8`, `M${n(mx - 1.9)} ${e}h3.8`, `M${n(W_ - e)} ${n(my - 1.9)}v3.8`][((rot % 4) + 4) % 4];
  return `<svg class="ll-fp" viewBox="0 0 ${n(W_)} ${n(H_)}" width="${n(W_ * 1.1)}" height="${n(H_ * 1.1)}" aria-hidden="true"><g fill="currentColor" opacity=".55">${cells}</g><path d="${door}" stroke="var(--rubric)" stroke-width="1.7" stroke-linecap="round" fill="none"/></svg>`;
}

// ───────────────────────── content helpers ─────────────────────────

type TabId = 'housing' | 'commercial' | 'amenity' | 'staff' | 'land';
const TABS: { id: TabId; label: string; note: string }[] = [
  { id: 'housing', label: 'Homes', note: 'Somewhere to live, and someone to pay for it.' },
  { id: 'commercial', label: 'Trades', note: 'Premises let to a tradesperson. Most cheer the street. One or two do not.' },
  { id: 'amenity', label: 'Amenities', note: 'They pay no rent. The homes around them pay a little more.' },
  { id: 'staff', label: 'Household', note: 'A delegate needs somewhere to stand before you can hire one.' },
  { id: 'land', label: 'Buy land', note: 'More mud, by the parcel. It must adjoin what you already hold.' },
];
/** the four chapters of plans; land is its own entry in the head of the book */
const PLAN_TABS = TABS.filter(tb => tb.id !== 'land');

const rankIdx = (r: RankId): number => RANK_ORDER.indexOf(r);
/** The rank whose charter brings this building (from RANKS; falls back to the def). */
function unlockRank(bt: BuildingType): RankId {
  for (const r of RANK_ORDER) if (RANKS[r].buildings.includes(bt)) return r;
  return BUILDINGS[bt].minRank;
}
const NUM_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const numWord = (n: number): string => NUM_WORDS[n] ?? String(n);
const aAn = (word: string): string => (/^[aeiou]/i.test(word) ? 'an ' : 'a ') + word;

function plansFor(tab: TabId): BuildingDef[] {
  return BUILDING_LIST.filter(d => d.category === tab)
    .sort((a, b) => rankIdx(unlockRank(a.id)) - rankIdx(unlockRank(b.id)) || a.cost - b.cost);
}

/** The long caption for the foot of the book. */
function factsOf(def: BuildingDef): string {
  const bits: string[] = [`${crowns(def.cost)}, ${plural(def.buildDays, 'day')} of work.`];
  if (def.upkeep > 0) bits.push(`Upkeep ${def.upkeep} a month.`);
  if (def.category === 'housing') {
    bits.push(def.units > 1 ? `${numWord(def.units)[0]!.toUpperCase() + numWord(def.units).slice(1)} households of up to ${numWord(def.capacity)}.` : `A household of up to ${numWord(def.capacity)}.`);
    const fond = def.only ?? def.prefers;
    if (fond?.length) bits.push(`${fond.map(sp => SPECIES_DEFS[sp].plural).join(' and ')} ${def.only ? 'only' : 'especially'}.`);
  }
  if (def.category === 'commercial' && def.trades?.length) {
    const names = def.trades.map(tr => TRADE_DEFS[tr].name.toLowerCase());
    bits.push(names.length === 1 ? `Lets to ${aAn(names[0]!)}.` : `Lets to ${aAn(names[0]!)}, ${names.length === 2 ? 'or ' + aAn(names[1]!) : 'among others'}.`);
  }
  if (def.aura) bits.push(`${def.aura.amount >= 0 ? 'Lifts' : 'Lowers'} homes within ${numWord(def.aura.radius)} tiles by up to ${Math.abs(def.aura.amount)}.`);
  if (def.staffRole) bits.push(`Lets you keep a ${ROLE_TITLES[def.staffRole]}.`);
  return bits.join(' ');
}

function parcelTiles(p: Parcel): [number, number][] {
  const out: [number, number][] = [];
  for (let y = p.y; y < p.y + PARCEL; y++) for (let x = p.x; x < p.x + PARCEL; x++) out.push([x, y]);
  return out;
}
interface LandRow { p: Parcel; ok: boolean; afford: boolean; why: string }
function landRows(st: GameState): { rows: LandRow[]; owned: number; cap: number } {
  const ps = st.map.parcels, ownedList = ps.filter(p => p.owned), cap = RANKS[st.realm.rank].maxParcels;
  const rows: LandRow[] = [];
  for (const p of ps) {
    if (p.owned) continue;
    const adj = ownedList.some(q => Math.abs(q.x - p.x) + Math.abs(q.y - p.y) === PARCEL);
    let why = '';
    if (rankIdx(st.realm.rank) < rankIdx(p.minRank)) why = `At ${RANKS[p.minRank].title}`;
    else if (!adj) why = 'Does not adjoin your land';
    else if (ownedList.length >= cap) why = 'The charter allows no more';
    rows.push({ p, ok: !why, afford: st.gold >= p.price, why });
  }
  rows.sort((a, b) => Number(b.ok) - Number(a.ok) || a.p.price - b.p.price);
  return { rows, owned: ownedList.length, cap };
}

const ico = (id: IconId): HTMLElement => fromHTML(iconSvg(id));
function isTyping(): boolean {
  const a = document.activeElement as HTMLElement | null;
  return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable);
}
const HIGHLIGHT = 0xe3c05a, HIGHLIGHT_HOT = 0xfff0b0;

export interface BuildMenuPart extends Part {
  /** Esc: shut the book if it is open, and say so */
  escape(): boolean;
  /** the sim was replaced */
  reset(): void;
  toggle(): void;
  openBook(tab?: TabId): void;
  closeBook(): void;
  disarm(): void;
  dispose(): void;
}

// ───────────────────────── the part ─────────────────────────

export function mount(ctx: UICtx): BuildMenuPart {
  addStyle('tools', TOOLS_CSS);

  let armed: Tool = { kind: 'select' };
  let open = false;
  let tab: TabId = 'housing';
  let lastPlans: TabId = 'housing';
  let rot: 0 | 1 | 2 | 3 = 0;
  let visible = true;
  let sig = '';
  let hoverPlan: BuildingType | null = null;
  /** touch only: the plan tapped once, shown in the foot with a button to take it up */
  let tapPlan: BuildingType | null = null;
  let hoverParcel: number | null = null;
  let lastToggle = -1e9;
  const narrow = (): boolean => window.matchMedia('(max-width: 699px)').matches;
  /** no mouse to right-click with: the strip's own buttons do that work, so the hints do not mention it */
  const touch = (): boolean => window.matchMedia('(hover: none), (pointer: coarse)').matches;

  // ── rail
  interface RailTool { id: string; label: string; icon: IconId; tip: string; kind: 'tool' | 'screen'; btn?: HTMLButtonElement; run: () => void }
  const railTools: RailTool[] = [
    { id: 'build', label: 'Build', icon: 'house', tip: 'The pattern book: homes, trades, amenities and land. (B)', kind: 'tool', run: () => toggle() },
    { id: 'road', label: 'Road', icon: 'road', tip: 'Lay a road. People walk faster on it, and homes beside one are worth more.', kind: 'tool', run: () => arm(armed.kind === 'road' || armed.kind === 'unroad' ? { kind: 'select' } : { kind: 'road' }) },
    { id: 'clear', label: 'Clear', icon: 'axe', tip: 'Fell a tree or break a rock, so something can be built there.', kind: 'tool', run: () => arm(armed.kind === 'clear' ? { kind: 'select' } : { kind: 'clear' }) },
    { id: 'demolish', label: 'Demolish', icon: 'hammer', tip: 'Pull a building down. It must be empty first.', kind: 'tool', run: () => arm(armed.kind === 'demolish' ? { kind: 'select' } : { kind: 'demolish' }) },
    { id: 'ledger', label: 'Ledger', icon: 'ledger', tip: 'The ledger: accounts, households, standing orders, oaths. (L)', kind: 'screen', run: () => ctx.open('ledger') },
    { id: 'council', label: 'Council', icon: 'people', tip: 'Your household of delegates. (C)', kind: 'screen', run: () => ctx.open('council') },
    { id: 'charter', label: 'Charter', icon: 'scroll', tip: 'What the Crown expects before it raises you.', kind: 'screen', run: () => ctx.open('charter') },
    { id: 'help', label: 'Help', icon: 'book', tip: 'How to rule. (H)', kind: 'screen', run: () => ctx.open('help') },
  ];
  const railIn = h('div', { class: 'll-bm-rail-in' });
  railTools.forEach((rt, i) => {
    if (i === 4) railIn.appendChild(h('span', { class: 'll-bm-knot', 'aria-hidden': 'true' }));
    rt.btn = h('button', {
      class: `ll-bm-tool ll-bm-tool-${rt.kind}`, type: 'button', 'aria-label': rt.label, 'data-tip': rt.tip, dataset: { tool: rt.id },
      // a pointer click should not leave focus sitting on the seal, or Space and Enter would press it again
      onclick: (e: MouseEvent) => { if (e.detail > 0) rt.btn?.blur(); rt.run(); },
    }, h('span', { class: 'll-bm-wax' }, ico(rt.icon)), h('span', { class: 'll-bm-lbl' }, rt.label));
    railIn.appendChild(rt.btn);
  });
  const rail = h('nav', { class: 'll-bm-rail', 'aria-label': 'Tools' }, h('div', { class: 'll-bm-rail-edge' }, railIn));

  // ── the strip: what is in hand
  const strip = h('div', { class: 'll-bm-strip ll-parch', hidden: true, role: 'status' });

  // ── the book
  const tabBtns = new Map<TabId, HTMLButtonElement>();
  const tabsEl = h('div', { class: 'll-bm-tabs', role: 'tablist' }, PLAN_TABS.map(tb => {
    const b = h('button', { class: 'll-bm-tab', type: 'button', role: 'tab', dataset: { tab: tb.id }, onclick: () => setTab(tb.id) }, tb.label);
    tabBtns.set(tb.id, b);
    return b;
  }));
  const landBtn = h('button', {
    class: 'll-bm-landbtn', type: 'button', 'aria-pressed': 'false', dataset: { tab: 'land' },
    'data-tip': 'Parcels for sale. They glow on the table while this page is open.',
    onclick: () => setTab(tab === 'land' ? lastPlans : 'land'),
  }, ico('map'), h('span', null, 'Buy land'));
  const noteEl = h('p', { class: 'll-bm-note ll-note' });
  const listEl = h('div', { class: 'll-bm-list ll-scrollbox' });
  const footEl = h('div', { class: 'll-bm-foot' });
  const book = h('section', { class: 'll-bm-book ll-parch', hidden: true, 'aria-label': 'The pattern book' },
    h('header', { class: 'll-bm-head' },
      h('h2', { class: 'll-title' }, 'The Pattern Book'),
      landBtn,
      h('button', { class: 'll-seal ll-close', type: 'button', 'aria-label': 'Close the pattern book', onclick: () => closeBook() }, '✕')),
    tabsEl, noteEl, listEl, footEl);

  const side = h('div', { class: 'll-bm-side' }, strip, book);
  const el = h('div', { class: 'll-part-buildmenu' }, rail, side);

  // ── tools
  function setHighlight(tiles: [number, number][] | null, color?: number): void {
    try { ctx.renderer.setHighlight(tiles, color); } catch { /* a renderer still being built */ }
  }
  function arm(tool: Tool): void {
    armed = tool;
    try { ctx.renderer.setTool(tool); } catch { /* a renderer still being built */ }
    if (tool.kind !== 'select') {
      ctx.select(null);
      if (tool.kind !== 'place') closeBook();
      else if (narrow()) closeBook();
    }
    renderRail(); renderStrip(); markArmedCard(); renderFoot();
    if (open) fitBook();
  }
  function disarm(): void { if (armed.kind !== 'select') arm({ kind: 'select' }); }
  function choose(bt: BuildingType): void {
    if (armed.kind === 'place' && armed.btype === bt) { disarm(); return; }
    rot = 0;
    arm({ kind: 'place', btype: bt, rot });
  }
  function turn(): void {
    if (armed.kind !== 'place') return;
    rot = ((rot + 1) % 4) as 0 | 1 | 2 | 3;
    arm({ kind: 'place', btype: armed.btype, rot });
  }

  function renderRail(): void {
    for (const rt of railTools) {
      const on = rt.id === 'build' ? (open || armed.kind === 'place')
        : rt.id === 'road' ? (armed.kind === 'road' || armed.kind === 'unroad')
        : rt.id === armed.kind;
      setClass(rt.btn!, 'is-on', on);
      if (rt.kind === 'tool') rt.btn!.setAttribute('aria-pressed', String(on));
    }
  }

  function stripBtn(label: string, onClick: () => void, cls = ''): HTMLButtonElement {
    return h('button', { class: 'll-btn ll-bm-sbtn ' + cls, type: 'button', onclick: onClick }, label);
  }
  function renderStrip(): void {
    clear(strip);
    strip.hidden = armed.kind === 'select';
    if (armed.kind === 'select') return;
    const st = ctx.state();
    const putDown = stripBtn('Put it down', () => disarm(), 'll-btn-quiet');
    if (armed.kind === 'place') {
      const def = BUILDINGS[armed.btype];
      const short = st.gold < def.cost;
      strip.append(
        h('span', { class: 'll-bm-spic', html: pictogram(armed.btype) }),
        h('div', { class: 'll-bm-stext' },
          h('div', { class: 'll-bm-sname' }, def.name, ' ',
            h('span', { class: 'll-bm-cost ll-num' + (short ? ' is-short' : '') }, ico('coin'), num(def.cost)),
            h('span', { class: 'll-bm-sfp', html: footprintSvg(def.w, def.h, rot) })),
          h('div', { class: 'll-bm-shint' }, short ? 'The coffers will not stretch to it.' : touch() ? 'Tap your land to set it there. It stays in hand for the next.' : 'R to turn. Right-click to put it down.')),
        h('div', { class: 'll-bm-sacts' }, stripBtn('Turn', () => turn()), putDown));
    } else {
      const road = armed.kind === 'road' || armed.kind === 'unroad';
      const icon: IconId = road ? 'road' : armed.kind === 'clear' ? 'axe' : 'hammer';
      const name = armed.kind === 'road' ? 'Laying road' : armed.kind === 'unroad' ? 'Lifting road' : armed.kind === 'clear' ? 'Clearing land' : 'Demolishing';
      const cost = landCosts();
      const tap = touch(), stop = tap ? '' : ' Right-click to stop.';
      const hint = armed.kind === 'road' ? `Drag to lay it${cost.road ? (cost.road === 1 ? ', a crown a tile' : `, ${cost.road} crowns a tile`) : ''}.${stop}`
        : armed.kind === 'unroad' ? `Drag over road to take it up.${stop}`
        : armed.kind === 'clear' ? `${tap ? 'Tap' : 'Click'} a tree or a rock.${cost.tree && cost.rock ? ` A tree is ${cost.tree}, a rock ${cost.rock}.` : ''}${stop}`
        : `${tap ? 'Tap' : 'Click'} what must come down. It must stand empty.${stop}`;
      strip.append(
        h('span', { class: 'll-bm-sico' }, ico(icon)),
        h('div', { class: 'll-bm-stext' }, h('div', { class: 'll-bm-sname' }, name), h('div', { class: 'll-bm-shint' }, hint)),
        h('div', { class: 'll-bm-sacts' },
          road ? stripBtn(armed.kind === 'road' ? 'Lift instead' : 'Lay instead', () => arm({ kind: armed.kind === 'road' ? 'unroad' : 'road' })) : null,
          putDown));
    }
  }

  // ── book
  function toggle(): void {
    const now = performance.now();
    if (now - lastToggle < 60) return;       // two summons landing on the same keypress
    lastToggle = now;
    if (open) closeBook(); else openBook();
  }
  function openBook(to?: TabId): void {
    if (to) { tab = to; if (to !== 'land') lastPlans = to; }
    if (!open) {
      open = true; book.hidden = false;
      ctx.select(null);
      try { ctx.audio.sfx('page'); } catch { /* silence is fine */ }
    }
    sig = ''; fitBook(); renderBook(); renderRail();
  }
  function closeBook(): void {
    if (!open) return;
    open = false; book.hidden = true; hoverPlan = null; tapPlan = null; hoverParcel = null;
    setHighlight(null);
    renderRail();
  }
  function setTab(id: TabId): void {
    if (tab === id) return;
    tab = id; hoverPlan = null; tapPlan = null; hoverParcel = null; sig = '';
    if (id !== 'land') lastPlans = id;
    listEl.scrollTop = 0;
    try { ctx.audio.sfx('page', { volume: 0.5 }); } catch { /* silence is fine */ }
    renderBook();
  }
  /** a length the frame (or the Word bar) publishes on the root, in pixels */
  function rootPx(name: string): number {
    try { return parseFloat(getComputedStyle(ctx.root).getPropertyValue(name)) || 0; } catch { return 0; }
  }
  function fitBook(): void {
    if (narrow()) {
      // a sheet standing on the Word bar, as tall as the rail's slot allows
      const room = el.clientHeight - (strip.hidden ? 0 : strip.offsetHeight + 8);
      book.style.maxHeight = (room > 200 ? Math.min(440, room) : Math.min(440, Math.round(window.innerHeight * 0.52))) + 'px';
      return;
    }
    const top = book.getBoundingClientRect().top || el.getBoundingClientRect().top;
    // between 700 and 980 wide the Word bar runs under the book's column: stop above it
    const under = window.matchMedia('(max-width: 979px)').matches ? rootPx('--ll-word-h') : 0;
    const floor = window.innerHeight - 18 - (under ? under + 10 : 0);
    book.style.maxHeight = Math.max(200, Math.min(640, floor - top)) + 'px';
  }

  function bookSig(st: GameState): string {
    if (tab === 'land') return 'land|' + st.realm.rank + '|' + Math.floor(st.gold) + '|' + st.map.parcels.map(p => (p.owned ? 1 : 0)).join('');
    const plans = plansFor(tab);
    const built = plans.filter(d => d.staffRole).map(d => (hasBuilding(st, d.id) ? 1 : 0)).join('');
    return tab + '|' + st.realm.rank + '|' + plans.map(d => (st.gold >= d.cost ? 1 : 0)).join('') + '|' + built;
  }
  const hasBuilding = (st: GameState, bt: BuildingType): boolean => Object.values(st.buildings).some(b => b.type === bt);

  function renderBook(): void {
    if (!open) return;
    const st = ctx.state();
    sig = bookSig(st);
    for (const [id, b] of tabBtns) { setClass(b, 'is-on', id === tab); b.setAttribute('aria-selected', String(id === tab)); }
    setClass(landBtn, 'is-on', tab === 'land'); landBtn.setAttribute('aria-pressed', String(tab === 'land'));
    setText(noteEl, TABS.find(x => x.id === tab)!.note);
    const keep = listEl.scrollTop;
    clear(listEl);
    setClass(listEl, 'is-land', tab === 'land');
    if (tab === 'land') renderLand(st); else renderPlans(st);
    listEl.scrollTop = keep;
    renderFoot();
    syncHighlight();
  }

  function renderPlans(st: GameState): void {
    const here = rankIdx(st.realm.rank);
    for (const def of plansFor(tab)) {
      const need = unlockRank(def.id);
      const locked = rankIdx(need) > here;
      const taken = !!def.staffRole && hasBuilding(st, def.id);
      const short = !locked && !taken && st.gold < def.cost;
      const lines: (Node | string)[] = [];
      if (def.units > 0 && def.baseRent > 0) lines.push(h('span', { class: 'll-bm-fact' }, 'rent ', h('b', { class: 'll-num' }, def.units > 1 ? `${def.units} × ${def.baseRent}` : String(def.baseRent))));
      if (def.aura) lines.push(h('span', { class: 'll-bm-fact ' + (def.aura.amount >= 0 ? 'is-up' : 'is-down') }, h('b', { class: 'll-num' }, signed(def.aura.amount)), ' nearby'));
      if (def.staffRole) lines.push(h('span', { class: 'll-bm-fact' }, 'for a ', ROLE_TITLES[def.staffRole]));
      const card = h('button', {
        class: 'll-bm-card' + (locked ? ' is-locked' : '') + (taken ? ' is-taken' : ''), type: 'button', dataset: { plan: def.id },
        'aria-disabled': locked || taken ? 'true' : undefined,
        'aria-label': `${def.name}, ${locked ? 'unlocked at ' + RANKS[need].title : crowns(def.cost)}`,
        onclick: (e: MouseEvent) => {
          hoverPlan = def.id;
          if (e.detail > 0) (e.currentTarget as HTMLElement).blur();
          if (locked) { tapPlan = null; renderFoot(); markArmedCard(); return; }
          if (taken) { tapPlan = null; ctx.toast(`One ${def.name} is enough for any realm.`, 'info'); renderFoot(); markArmedCard(); return; }
          // with no pointer to hover, the first tap reads the plan out and the second takes it up
          const inHand = armed.kind === 'place' && armed.btype === def.id;
          if (touch() && !inHand && tapPlan !== def.id) { tapPlan = def.id; renderFoot(); markArmedCard(); return; }
          tapPlan = null;
          choose(def.id);
        },
        onpointerenter: () => { hoverPlan = def.id; renderFoot(); },
        onfocus: () => { hoverPlan = def.id; renderFoot(); },
      },
        h('span', { class: 'll-bm-ctop' },
          h('span', { class: 'll-bm-plate', html: pictogram(def.id) }),
          h('span', { class: 'll-bm-ctext' },
            h('span', { class: 'll-bm-cname' }, def.name),
            locked ? h('span', { class: 'll-bm-lock' }, 'At ' + RANKS[need].title)
              : taken ? h('span', { class: 'll-bm-lock' }, 'Built')
              : h('span', { class: 'll-bm-cost ll-num' + (short ? ' is-short' : '') }, ico('coin'), num(def.cost)))),
        h('span', { class: 'll-bm-facts' }, lines, h('span', { class: 'll-bm-cfp', html: footprintSvg(def.w, def.h) })));
      listEl.appendChild(card);
    }
    markArmedCard();
  }

  function renderLand(st: GameState): void {
    const { rows, owned, cap } = landRows(st);
    listEl.appendChild(h('p', { class: 'll-bm-landsum' },
      `You hold ${numWord(owned)} of the ${numWord(cap)} parcels your charter allows.`));
    if (!rows.length) { listEl.appendChild(h('p', { class: 'll-note' }, 'There is no more land to be had. You own the map.')); return; }
    for (const r of rows) {
      const row = h('div', {
        class: 'll-bm-parcel' + (r.ok ? '' : ' is-locked'), dataset: { parcel: String(r.p.id) },
        onpointerenter: () => { hoverParcel = r.p.id; syncHighlight(); },
        onpointerleave: () => { if (hoverParcel === r.p.id) { hoverParcel = null; syncHighlight(); } },
      },
        h('button', {
          class: 'll-bm-pname', type: 'button', 'data-tip': 'Show it on the table',
          onclick: () => { try { ctx.renderer.focus({ tile: [r.p.x + PARCEL / 2, r.p.y + PARCEL / 2] }); } catch { /* no table yet */ } hoverParcel = r.p.id; syncHighlight(); },
        }, ico('map'), h('span', null, r.p.name)),
        r.ok
          ? h('span', { class: 'll-bm-cost ll-num' + (r.afford ? '' : ' is-short') }, ico('coin'), num(r.p.price))
          : h('span', { class: 'll-bm-lock' }, r.why),
        r.ok ? h('button', {
          class: 'll-btn ll-btn-primary ll-bm-buy', type: 'button', disabled: !r.afford,
          'data-tip': r.afford ? `Buy ${r.p.name} for ${crowns(r.p.price)}` : 'The coffers will not stretch to it.',
          onclick: () => { const res = ctx.act({ type: 'buy_parcel', parcelId: r.p.id }); if (res.ok) { hoverParcel = null; sig = ''; } },
        }, 'Buy') : null);
      listEl.appendChild(row);
    }
  }

  function renderFoot(): void {
    clear(footEl);
    if (tab === 'land') {
      footEl.append(h('p', { class: 'll-bm-blurb' }, 'Land for sale glows on the table. Parcels are eight tiles square. The price is the price.'));
      return;
    }
    const id = hoverPlan ?? (armed.kind === 'place' ? armed.btype : null);
    const def = id ? BUILDINGS[id] : null;
    if (!def || def.category !== tab) {
      footEl.append(h('p', { class: 'll-bm-blurb is-idle' }, 'Choose a plan, then set it down on your own land. Buildings are placed by hand.'));
      return;
    }
    const need = unlockRank(def.id), locked = rankIdx(need) > rankIdx(ctx.state().realm.rank);
    footEl.append(
      h('p', { class: 'll-bm-blurb' }, h('span', { class: 'll-bm-bname' }, def.name + '. '), def.blurb),
      h('p', { class: 'll-bm-factline' }, locked ? `The Crown grants this to a ${RANKS[need].title}. ` : '', factsOf(def)));
    if (tapPlan === def.id && !locked) {
      footEl.append(h('button', { class: 'll-btn ll-btn-primary ll-bm-take', type: 'button', onclick: () => { tapPlan = null; choose(def.id); } }, 'Take it in hand'));
    }
  }

  function markArmedCard(): void {
    const on = armed.kind === 'place' ? armed.btype : '';
    for (const c of Array.from(listEl.querySelectorAll<HTMLElement>('.ll-bm-card'))) {
      setClass(c, 'is-armed', c.dataset.plan === on);
      setClass(c, 'is-looked', !!tapPlan && c.dataset.plan === tapPlan && tapPlan !== on);
    }
  }

  function syncHighlight(): void {
    if (!open || tab !== 'land') { setHighlight(null); return; }
    const st = ctx.state();
    const { rows } = landRows(st);
    if (hoverParcel !== null) {
      const p = st.map.parcels.find(q => q.id === hoverParcel);
      if (p && !p.owned) { setHighlight(parcelTiles(p), HIGHLIGHT_HOT); return; }
    }
    const tiles: [number, number][] = [];
    for (const r of rows) if (r.ok) tiles.push(...parcelTiles(r.p));
    setHighlight(tiles.length ? tiles : null, HIGHLIGHT);
  }

  // ── keys and the outside world
  const onKey = (e: KeyboardEvent): void => {
    if (!visible || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
    if ((e.key === 'r' || e.key === 'R') && armed.kind === 'place') { turn(); e.preventDefault(); }
  };
  window.addEventListener('keydown', onKey);
  // the frame's B key: "ll:summon" with detail 'build'. Answering it stops the frame clicking for us.
  const onSummon = (e: Event): void => {
    if ((e as CustomEvent).detail !== 'build' || !visible) return;
    e.preventDefault();
    toggle();
  };
  ctx.root.addEventListener('ll:summon', onSummon);

  // right-click on the table without a drag puts the tool down (the renderer says so too, when it can)
  let rdown: { x: number; y: number; t: number } | null = null;
  const onPD = (e: PointerEvent): void => { rdown = e.button === 2 && (e.target as HTMLElement | null)?.tagName === 'CANVAS' ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; };
  const onPU = (e: PointerEvent): void => {
    if (!rdown || e.button !== 2) return;
    const still = Math.hypot(e.clientX - rdown.x, e.clientY - rdown.y) < 6 && performance.now() - rdown.t < 500;
    rdown = null;
    if (still && armed.kind !== 'select') disarm();
  };
  window.addEventListener('pointerdown', onPD, true);
  window.addEventListener('pointerup', onPU, true);
  try { ctx.renderer.on('cancel', () => { if (armed.kind !== 'select') disarm(); }); } catch { /* a renderer still being built */ }

  const onBus = (e: Event): void => {
    const d = (e as CustomEvent).detail as unknown;
    if (d === 'open') openBook(); else if (d === 'close') closeBook(); else toggle();
  };
  window.addEventListener('ll:buildmenu', onBus);
  const onResize = (): void => { if (open) fitBook(); };
  window.addEventListener('resize', onResize);

  renderRail();

  return {
    el,
    update(st: GameState): void {
      if (!visible) return;
      if (open) { const now = bookSig(st); if (now !== sig) renderBook(); }
      if (armed.kind === 'place') {
        const short = st.gold < BUILDINGS[armed.btype].cost;
        const shown = strip.querySelector('.ll-bm-cost')?.classList.contains('is-short') ?? false;
        if (short !== shown) renderStrip();
      }
    },
    handleEvents(events: SimEvent[]): void {
      for (const ev of events) if (ev.type === 'parcel_bought' || ev.type === 'promotion' || ev.type === 'demotion') { sig = ''; }
    },
    onSelect(sel: { buildingId?: Id; tenantId?: Id; staffId?: Id; applicantId?: Id } | null): void {
      // the sheet for what was picked wants the room the book is taking
      if (sel && open && armed.kind === 'select') closeBook();
      // on a phone the sheet rises over the lower rail, so the rail folds its second half away
      setClass(el, 'has-sel', !!sel);
    },
    setVisible(on: boolean): void {
      visible = on; el.hidden = !on;
      if (!on) { disarm(); closeBook(); }
    },
    escape(): boolean {
      if (!open) return false;
      closeBook();
      return true;
    },
    reset(): void { hoverPlan = null; tapPlan = null; hoverParcel = null; rot = 0; disarm(); closeBook(); sig = ''; },
    toggle, openBook, closeBook, disarm,
    dispose(): void {
      window.removeEventListener('keydown', onKey);
      ctx.root.removeEventListener('ll:summon', onSummon);
      window.removeEventListener('pointerdown', onPD, true);
      window.removeEventListener('pointerup', onPU, true);
      window.removeEventListener('ll:buildmenu', onBus);
      window.removeEventListener('resize', onResize);
      setHighlight(null);
    },
  };
}
