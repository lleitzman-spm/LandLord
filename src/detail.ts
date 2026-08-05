// Clean by default, detail on demand. The whole app reads clean — humanized
// labels, no explainer prose — until the Regent flips "detail" on, and then
// the raw ids and the teaching text reveal (docs/HANDOFF, the Civ/Tropico
// reframe; Edwin 2026-07-20: "so much text… feels Salesforce"). A single global
// flag, provided at the board and read (and flipped) wherever a surface can say
// more — the ribbon, and every panel's head.

import { createContext, useContext } from 'react';

export interface DetailState {
  detail: boolean;
  toggle: () => void;
}

export const DetailContext = createContext<DetailState>({ detail: false, toggle: () => {} });

/** True when detail mode is on — show raw ids and explainer prose. */
export function useDetail(): boolean {
  return useContext(DetailContext).detail;
}

/** Flip detail mode — for the toggles in the ribbon and every panel head. */
export function useToggleDetail(): () => void {
  return useContext(DetailContext).toggle;
}
