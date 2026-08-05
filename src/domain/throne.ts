// The Throne — the King's seat (docs/HANDOFF.md, "the War Game becomes a real
// game", step 1). The sovereign's top-down reading over the whole kingdom: not
// a new record, but a fusion of two readings the kingdom already folds —
//
//   • the ORG's delegation debt (laws 4–5): fiefs with no lord, the empty
//     seats the Regent's desk already hunts; and
//   • the WORK's delegation debt (the operator): open cases sitting on no real
//     seat, or aging on a hand, folded from the event log.
//
// The two halves are the same debt at two altitudes — a seat with no holder,
// and a box with no seat. The King's objective is to drive their sum to zero:
// every fief lorded, every box on a real desk. Everything here is a reading,
// computed fresh against `now` (game time while a War Game stands); nothing is
// stored (KINGDOM.md, records in, readings out).

import type { CaseReading, EventLog } from './events';
import { UNHELD, ageInDays, queues } from './events';
import type { FiefReading } from './states';
import { readKingdom, regent } from './states';
import type { Kingdom } from './types';

/** Open work resting on one holder — a real seat, an unowned queue, or no one
 *  at all. The operator's queue, dressed for the throne room. */
export interface SeatLoad {
  holder: string; // holder id: a person, a queue id, or UNHELD
  name: string; // the seat's name, or the raw id when no census person holds it
  /** True when a census person holds it — a real seat. False for an unowned
   *  queue (e.g. `pm-desk`) or unassigned work: that is undelegated. */
  seated: boolean;
  cases: CaseReading[];
  oldestDays: number; // the most-aged case on this holder
  stuck: number; // cases idle past `agedDays`
}

export interface ThroneReading {
  // ── The seats of the realm (the org, laws 3–5) ────────────────────────────
  fiefs: FiefReading[];
  lorded: FiefReading[]; // lorded or plurality — a vassal holds it (green)
  regency: FiefReading[]; // a keeper keeps it — foreign hands (amber)
  unlorded: FiefReading[]; // stewardship — no record at all (red)

  // ── The work in motion (the operator) ─────────────────────────────────────
  /** Open work on no real seat — an unowned queue or unassigned. Undelegated
   *  work: the operator's answer to an unlorded fief. Fullest first. */
  unseated: SeatLoad[];
  /** Open work landed on the Regent — the catch-basin filling with real work,
   *  the way undelegated fiefs land on his desk. Null when none. */
  onRegent: SeatLoad | null;
  /** Open work on real seats, fullest first — the load the kingdom carries. */
  seats: SeatLoad[];

  // ── The score the King drives to zero ─────────────────────────────────────
  fiefsTotal: number;
  fiefsLorded: number; // lorded + plurality
  openWork: number; // open cases in all
  unseatedWork: number; // open cases on no real seat
  stuckWork: number; // open cases idle past `agedDays`
  /** The delegation debt: unlorded fiefs + undelegated boxes. The objective is
   *  zero — every fief lorded, every box on a real desk. */
  debt: number;
}

/** Fold the throne reading from the org records and the event log. `now` is
 *  passed in (game time under a War Game); aging is measured against it. */
export function readThrone(
  kingdom: Kingdom,
  log: EventLog,
  now: string,
  agedDays = 7,
): ThroneReading {
  const fiefs = readKingdom(kingdom);
  const lorded = fiefs.filter((r) => r.state === 'lorded' || r.state === 'plurality');
  const regency = fiefs.filter((r) => r.state === 'regency');
  const unlorded = fiefs.filter((r) => r.state === 'stewardship');

  const stew = regent(kingdom);
  const isPerson = (id: string) => kingdom.people.some((p) => p.id === id);

  const load = (holder: string, cases: CaseReading[]): SeatLoad => {
    const ages = cases.map((c) => ageInDays(c, now) ?? 0);
    return {
      holder,
      name:
        holder === UNHELD
          ? '(unassigned)'
          : (kingdom.people.find((p) => p.id === holder)?.name ?? holder),
      seated: holder !== UNHELD && isPerson(holder),
      cases,
      oldestDays: ages.length ? Math.max(...ages) : 0,
      stuck: ages.filter((d) => d >= agedDays).length,
    };
  };

  const loads = queues(log).map((q) => load(q.holder, q.cases));

  const unseated = loads
    .filter((l) => !l.seated && l.holder !== stew?.id)
    .sort((a, b) => b.cases.length - a.cases.length);
  const onRegent = stew ? (loads.find((l) => l.holder === stew.id) ?? null) : null;
  const seats = loads
    .filter((l) => l.seated && l.holder !== stew?.id)
    .sort((a, b) => b.cases.length - a.cases.length);

  const openWork = loads.reduce((n, l) => n + l.cases.length, 0);
  const unseatedWork = unseated.reduce((n, l) => n + l.cases.length, 0);
  const stuckWork = loads.reduce((n, l) => n + l.stuck, 0);

  return {
    fiefs,
    lorded,
    regency,
    unlorded,
    unseated,
    onRegent,
    seats,
    fiefsTotal: fiefs.length,
    fiefsLorded: lorded.length,
    openWork,
    unseatedWork,
    stuckWork,
    debt: unlorded.length + unseatedWork,
  };
}
