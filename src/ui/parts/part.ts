/** A mounted piece of the in-game interface. Owned by the integrator. */
import type { GameState, SimEvent, Id } from '../../sim/types';
export interface Part {
  el: HTMLElement;
  update?(state: GameState, dtSeconds: number): void;
  handleEvents?(events: SimEvent[], state: GameState): void;
  /** the selection changed (ui/index tracks it; null = nothing selected) */
  onSelect?(sel: { buildingId?: Id; tenantId?: Id; staffId?: Id; applicantId?: Id } | null): void;
  /** hide while a full screen is open / on the title screen */
  setVisible?(on: boolean): void;
}
