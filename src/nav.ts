// Navigation context: design law 6 — actions stand beside their
// information. Anything that names a thing is a road to that thing, so
// every component can reach the map.

import { createContext, useContext } from 'react';

export interface Nav {
  goToPerson: (personId: string) => void;
  /** Hamlets route to their parent fief's page. */
  goToTerritory: (territoryId: string) => void;
  goToMarches: () => void;
  /** The Ledger — where the real work is acted on. An optional case id asks
   *  the Ledger to open and scroll to that flow instance (drill to the step
   *  in hand, law 6). */
  goToLedger: (focusCase?: string) => void;
  /** The Regent's Seat — the catch-basin console where work is identified
   *  and delegated. */
  goToRegent: () => void;
}

export const NavContext = createContext<Nav | null>(null);

export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error('NavContext is missing a provider');
  return nav;
}
