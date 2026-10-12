/** OWNER: sim-decide agent. The household of delegates: candidates, hiring, wages, loyalty, authority.
 *  Bodies below are thin PLACEHOLDERS so other modules can run; replace them. Keep the signatures. */
import type { GameState, SimModule, StaffMember, StaffRole } from './types';
import type { TemperamentDef } from '../data/schema';
import { TEMPERAMENT_DEFS } from '../data/temperaments';
import { clamp100 } from './core';
export function staffOf(s: GameState, role: StaffRole): StaffMember | null { return Object.values(s.staff).find(m => m.role === role) ?? null; }
export function temperamentOf(s: GameState, role: StaffRole): TemperamentDef | null { const m = staffOf(s, role); return m ? TEMPERAMENT_DEFS[m.temperament] : null; }
export function changeLoyalty(s: GameState, role: StaffRole, amount: number): void { const m = staffOf(s, role); if (m) m.loyalty = clamp100(m.loyalty + amount); }
export const staffModule: SimModule = { name: 'staff' };
