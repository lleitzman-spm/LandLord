// The pure fleet run — the roster and the loop, lifted out of fleet.mjs so BOTH
// the Node harness (harness/fleet.mjs, reading data/chronicle.json) and the
// deployed keyholder (a POST /api/fleet route on the Worker, reading a beta
// user's vault) can run the SAME clerk fleet against a chronicle doc. It does no
// I/O of its own: hand it a doc + an operator core + a brain, and it returns the
// proposal events + a per-clerk record. The caller owns reading the vault and
// writing the result back (CAS on the Worker; appendEvents in the harness).
//
// This is the seam that carries the fleet from "a tool Edwin runs at the terminal"
// to "the clerks work for every user behind the wall" — the same ten seats, the
// same propose-only ratchet, no clerk self-approves.

import { makeIntakeClerk, makeVendorClerk, makePriceClerk, makeLeasingClerk, makeAdvanceClerk } from './clerks.mjs';
import { makeTurnoverClerk } from './turn-desk.mjs';
import { makeBdrClerk } from './bd-desk.mjs';
import { makeResidentClerk } from './res-desk.mjs';
import { makeAccountingClerk } from './acct-desk.mjs';
import { makeCollectionsClerk } from './col-desk.mjs';
import { makeViolationClerk } from './viol-desk.mjs';

// The seats the advance clerks cover — the fleet grows by adding a reasoning
// clerk to the roster below (and a registry line in brain-doctrine.mjs).
export const ADVANCE_SEATS = ['va-desk', 'lp-queue', 'osric', 'pm-desk'];

/** The full roster for a given ctx ({ core, complete, brainFor }). The reasoning
 *  clerks run BEFORE the advance clerks so they own their commitments — the
 *  shared `taken` set then keeps the advance clerks off the same case. */
export function fleetRoster(ctx) {
  return [
    makeIntakeClerk(ctx),
    makeVendorClerk(ctx),
    makePriceClerk(ctx),
    makeLeasingClerk(ctx),
    makeTurnoverClerk(ctx),
    makeBdrClerk(ctx),
    makeResidentClerk(ctx),
    makeAccountingClerk(ctx),
    makeCollectionsClerk(ctx),
    makeViolationClerk(ctx),
    ...ADVANCE_SEATS.map((s) => makeAdvanceClerk(ctx, s)),
  ];
}

/** Run the whole fleet against a doc. PURE — no file or vault I/O. Returns the
 *  batch of proposal events (for the caller to append/commit) + a per-clerk
 *  record (for logging or the API response) + the proposal count. `cap`
 *  optionally bounds each clerk's proposals this run (the Worker will cap it so
 *  one request can't fan out unbounded). */
export async function runFleet({ doc, now, core, complete, brainFor, cap, meter }) {
  const roster = fleetRoster({ core, complete, brainFor });
  const taken = new Set();
  const events = [];
  const perClerk = [];
  for (const clerk of roster) {
    // Attribute every brain call this clerk makes to its seat, so spend can be
    // read per seat rather than only as one invoice total.
    meter?.seat(clerk.label ?? clerk.seat);
    const args = { doc, now, taken };
    if (cap != null) args.cap = cap;
    const out = await clerk.run(args);
    events.push(...out.events);
    perClerk.push({
      seat: clerk.seat,
      label: clerk.label,
      tier: clerk.policy.tier,
      model: clerk.policy.model ?? null,
      records: out.records,
    });
  }
  return { events, perClerk, proposals: perClerk.reduce((n, c) => n + c.records.length, 0) };
}
