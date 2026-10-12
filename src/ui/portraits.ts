/** OWNER: ui-portraits agent. Code-drawn, animated ink-and-wash faces. Placeholder: a circle. */
import type { Species, TradeId, NpcId } from '../data/ids';
import type { StaffRole, RankId } from '../sim/types';
import type { Mood } from '../word/api';

export interface PortraitSpec {
  species: Species;
  seed: number;
  trade?: TradeId;
  role?: StaffRole | 'ruler';
  rank?: RankId;
  npc?: NpcId;
  /** hints from CharacterDef / NpcDef */
  look?: { hair?: string; beard?: boolean; hat?: string; feature?: string };
  /** CSS pixels (square). Portraits must read at 40px (lists) and at 360px (audience). */
  size: number;
  /** draw the roundel frame (gold ring, lapis ground) */
  frame?: boolean;
}
export interface Portrait {
  el: HTMLElement;
  setMood(mood: Mood): void;
  /** mouth flaps while true */
  setTalking(on: boolean): void;
  /** eyes follow a point in the element's own box, 0..1 (null = wander) */
  lookAt(x: number | null, y?: number): void;
  dispose(): void;
}
export function createPortrait(spec: PortraitSpec): Portrait {
  const el = document.createElement('div');
  el.style.cssText = `width:${spec.size}px;height:${spec.size}px;border-radius:50%;background:#2f4a7a;border:2px solid #c9a227`;
  return { el, setMood() {}, setTalking() {}, lookAt() {}, dispose() {} };
}
