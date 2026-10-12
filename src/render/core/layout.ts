/**
 * Where things stand on the table. World space: the board top is y = 0 and
 * spans x in [-16, 16], z in [-12, 12]; the table top lies below it.
 */
import { MAP_W, MAP_H } from '../../sim/types';

export const HALF_W = MAP_W / 2;
export const HALF_D = MAP_H / 2;
/** y of the oak table top (the board is a slab standing this proud of it) */
export const TABLE_Y = -0.95;
/** how far the board's wooden frame reaches beyond the map edge */
export const FRAME_OUT = 1.3;
/** the frame's top lip stands this far above the ground */
export const FRAME_LIP = 0.11;
export const TABLE_W = 104;
export const TABLE_D = 78;

/**
 * table props: [x, z, turn about y]. The near (south, +z) side faces the default camera,
 * and a perspective view is widest at the far side: so the big flat things lie beyond the
 * board, the coffer and charter flank its far half, and nothing sits where the frame
 * of the screen would cut it in the overview.
 */
export const PROP_AT = {
  coffer: [21.7, -6.6, -0.42],
  ledger: [-8.8, -18.3, 0.14],
  inkwell: [-2.9, -17.0, 0],
  charter: [-21.3, -7.6, -0.2],
  seal: [-19.7, -2.4, 0.7],
  map_scroll: [10.6, -16.9, 0.12],
  bell: [20.3, 1.2, 0],
} as const;

/** candles: [x, z, height seed]. Two stand behind the town; two by the near corners, where they frame the view. */
export const CANDLES: [number, number, number][] = [
  [-19.8, -15.1, 0.0],
  [20.1, -14.8, 0.6],
  [-21.2, 15.3, 0.3],
  [21.6, 14.9, 0.85],
];

export const tileToWorldX = (x: number): number => x - HALF_W;
export const tileToWorldZ = (y: number): number => y - HALF_D;
