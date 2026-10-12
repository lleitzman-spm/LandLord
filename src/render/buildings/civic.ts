/** OWNER: render-buildings-civic agent. Bodies for commercial, amenity and staff buildings. Placeholder. */
import type { BodyBuilder } from './types';
import type { BuildingType } from '../../data/ids';
/** Builders for: market_stall, bakery, smithy, mill, apothecary, tavern, well, garden, notice_board, shrine,
 *  stocks, statue, watchtower, chapel, masons_yard, bailiffs_post, criers_stand, counting_house. */
export const CIVIC_BUILDERS: Partial<Record<BuildingType, BodyBuilder>> = {};
