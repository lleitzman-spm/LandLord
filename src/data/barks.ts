/** OWNER: content-people agent. Short overheard lines for speech bubbles. */
import type { BarkTable, BarkKey } from './schema';
const KEYS: BarkKey[] = ['pay_rent', 'pay_rent_grudging', 'late_excuse', 'move_in', 'move_out_happy', 'move_out_angry', 'rent_raised', 'rent_lowered', 'repair_thanks', 'repair_waiting', 'idle_happy', 'idle_unhappy', 'idle_winter', 'idle_summer', 'see_ruler', 'see_bailiff', 'feast', 'evicted', 'neighbor_evicted', 'griffin', 'goblins', 'rain', 'snow', 'new_building', 'vacancy_gossip', 'well_gossip', 'tavern', 'purse_waiting', 'applicant_waiting', 'applicant_signed', 'applicant_rejected'];
export const BARKS = Object.fromEntries(KEYS.map(k => [k, ['...']])) as BarkTable;
