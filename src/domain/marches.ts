// The Marches: the border lands. Work that has arrived in the kingdom but
// has not yet been assigned to any fief. Everything enters here and must be
// ridden out to a territory — or found to be no business of the kingdom's
// and turned away at the border. See docs/KINGDOM.md.
//
// Same constitutional pattern as fiefs: an arrival's state is computed from
// disposition records, never stored.

export interface Arrival {
  id: string;
  title: string;
  note?: string;
  arrivedOn: string;
}

/** The deliberate act of assigning an arrival to a territory. */
export interface Dispatch {
  id: string;
  arrivalId: string;
  territoryId: string;
  dispatchedOn: string;
}

/** The deliberate act of refusing an arrival at the border. */
export interface Turnaway {
  id: string;
  arrivalId: string;
  turnedAwayOn: string;
}

export interface MarchesLedger {
  arrivals: Arrival[];
  dispatches: Dispatch[];
  turnaways: Turnaway[];
}

export const EMPTY_LEDGER: MarchesLedger = {
  arrivals: [],
  dispatches: [],
  turnaways: [],
};

export type ArrivalState = 'at-the-border' | 'dispatched' | 'turned-away';

export interface ArrivalReading {
  arrival: Arrival;
  state: ArrivalState;
  dispatch: Dispatch | null;
  turnaway: Turnaway | null;
}

export function readArrival(ledger: MarchesLedger, arrival: Arrival): ArrivalReading {
  const dispatch = ledger.dispatches.find((d) => d.arrivalId === arrival.id) ?? null;
  const turnaway = ledger.turnaways.find((t) => t.arrivalId === arrival.id) ?? null;
  const state: ArrivalState = dispatch
    ? 'dispatched'
    : turnaway
      ? 'turned-away'
      : 'at-the-border';
  return { arrival, state, dispatch, turnaway };
}

export function readMarches(ledger: MarchesLedger): ArrivalReading[] {
  return ledger.arrivals.map((a) => readArrival(ledger, a));
}

/** The queue: arrivals with no disposition record yet. */
export function atTheBorder(ledger: MarchesLedger): ArrivalReading[] {
  return readMarches(ledger).filter((r) => r.state === 'at-the-border');
}

/** Arrivals ridden out to any of the given territories (a fief and its hamlets). */
export function dispatchedTo(
  ledger: MarchesLedger,
  territoryIds: string[],
): ArrivalReading[] {
  const wanted = new Set(territoryIds);
  return readMarches(ledger).filter(
    (r) => r.dispatch != null && wanted.has(r.dispatch.territoryId),
  );
}
