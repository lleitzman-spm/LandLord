/**
 * OWNER: render-civic. Bodies for commercial, amenity and staff buildings.
 * Each builder returns the pristine body only (see ./types.ts); the wrapper in
 * ./index.ts adds construction, wear, snow, night windows and the TO LET sign.
 * The shared workbench is ./civic-parts.ts; the bodies live in civic-trade,
 * civic-amenity and civic-staff.
 */
import type { BodyBuilder } from './types';
import type { BuildingType } from '../../data/ids';
import { marketStall, bakery, smithy, mill, apothecary, tavern } from './civic-trade';
import { well, garden, noticeBoard, shrine, stocks, statue, watchtower, chapel } from './civic-amenity';
import { masonsYard, bailiffsPost, criersStand, countingHouse } from './civic-staff';

/** Builders for: market_stall, bakery, smithy, mill, apothecary, tavern, well, garden, notice_board, shrine,
 *  stocks, statue, watchtower, chapel, masons_yard, bailiffs_post, criers_stand, counting_house. */
export const CIVIC_BUILDERS: Partial<Record<BuildingType, BodyBuilder>> = {
  market_stall: marketStall,
  bakery,
  smithy,
  mill,
  apothecary,
  tavern,
  well,
  garden,
  notice_board: noticeBoard,
  shrine,
  stocks,
  statue,
  watchtower,
  chapel,
  masons_yard: masonsYard,
  bailiffs_post: bailiffsPost,
  criers_stand: criersStand,
  counting_house: countingHouse,
};
