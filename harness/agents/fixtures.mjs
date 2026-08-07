// FIXTURES — a handful of realistically-shaped work orders, for the viewer
// and for the rig's tests. Each fixture builds its case through the REAL flow
// engine (`instantiateFlow` / `completeStep` — the same primitives a clerk or
// a human uses), never by hand-typing an event array, so a fixture can never
// drift from what the engine actually accepts.
//
// The founding catalog + flow book here is a FROZEN SNAPSHOT
// (`fixtures/founding-book.json` — the same 52 catalog rows / 5 flows the
// founding chronicle ships, taken 2026-08-07). Static on purpose: a fixture
// that read the live `data/chronicle.json` would break the moment a session
// mutates it, and "the chronicle stores its own copy" is a trap this
// repository has already been bitten by once (book/memory/learned.md, "A
// generated page is not where a running game reads its rules").
//
// Three stages, one work order, the M family's own arc (KINGDOM.md: "the
// vendor-dispatch loop runs end to end: quote in → (Regent approves) →
// invoice checked → pay or hold"):
//
//   rawIntakeFixture()          — before Mace. A tenant's words, untriaged.
//   vendorCommitmentFixture()   — before Milo. Report + identify done; the
//                                  case sits at `assign-vendor`.
//   settlementFixture()         — before Mira. Dispatch done, the world's
//                                  invoice in; the case sits at `pay-vendor`.
//
// Steps completed to REACH a stage are written with `core.completeStep` and
// no `actor` — the engine's own convention for a human/system act ("a human
// act carries none", `src/domain/flows.ts`). A fixture represents HISTORY,
// not another agent's act, and no agent in this codebase may write `done` on
// a judgment step in its own name either way (roster.test.ts, "NO agent may
// ratify") — a fixture standing in for the past is not exempt from that rule.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { invoiceFor } from '../vendors.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BOOK = JSON.parse(readFileSync(resolve(HERE, 'fixtures/founding-book.json'), 'utf8'));

const vendorDispatchTpl = () => BOOK.flows.find((f) => f.key === 'vendor-dispatch');

/** A deterministic id source, so a fixture is byte-identical run to run. */
function ids(prefix) {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

/** Stage 1 — a raw, untriaged complaint on pm-desk. Mace's whole world: no
 *  cascade exists yet, only a tenant's words (the shape `wargame.ts`'s
 *  `dealIntake` deals, minus the `wg/<seed>` war-mark — this is not a War
 *  Game case, so nothing here should read or Reset like one). */
export function rawIntakeFixture({
  address = '14 Cobble Row',
  complaint = 'no heat, furnace will not ignite',
  agedDays = 4,
  now = '2026-08-07T09:00:00.000Z',
} = {}) {
  const at = new Date(new Date(now).getTime() - agedDays * 86400000).toISOString();
  return {
    catalog: BOOK.catalog,
    flows: BOOK.flows,
    events: [
      {
        id: 'fx-raw-1',
        at,
        caseId: `fixture · intake · ${address} — ${complaint}`,
        kind: 'opened',
        holder: 'pm-desk',
        catalogRow: 'work-order',
        note: `A tenant reports: ${complaint}. Untriaged — walk it down the tree to put it in motion.`,
      },
    ],
  };
}

/** Stage 2 — report + identify already done; the case sits at
 *  `assign-vendor`, exactly where Milo's judgment starts. `core` supplies the
 *  real `instantiateFlow`/`completeStep`/`fullParams` (the operator core, or
 *  any object shaped like it — a test may pass a lighter stand-in). */
export function vendorCommitmentFixture(core, {
  trade = 'HVAC',
  urgency = 'urgent',
  subject = '14 Cobble Row — no heat, furnace will not ignite',
  now = '2026-08-07T09:00:00.000Z',
} = {}) {
  const tpl = vendorDispatchTpl();
  const id = ids('fx-vc');
  const params = core.fullParams(tpl, { trade, urgency });
  const instance = core.instantiateFlow(tpl, subject, { at: now, id }, params);
  // Built by PUSHING rather than in one literal, so each `completeStep` can be
  // handed the log as it stands — the completion guard folds the case from it,
  // and a literal referring to the array it defines is a dead zone.
  const events = [...instance.events];
  events.push(...core.completeStep(tpl, instance.caseId, 0, { at: now, id, note: 'Report logged from the tenant intake.', log: events }, params));
  events.push(...core.completeStep(tpl, instance.caseId, 1, { at: now, id, note: `Identified as an ${trade} call.`, log: events }, params));
  return { catalog: BOOK.catalog, flows: BOOK.flows, events, caseId: instance.caseId };
}

/** Stage 3 — dispatch already done, the vendor's invoice already in from the
 *  world; the case sits at `pay-vendor`, exactly where Mira's judgment starts.
 *
 *  `quoteCents` is what the vendor was authorized to bill, and it reaches the
 *  clerk the way production does — through the note Milo would have written
 *  (`authorizedQuoteCents` in `clerks.mjs` reads it back with the same
 *  `/quoted \$([\d,]+)/` pattern).
 *
 *  THE INVOICE IS NOT A PARAMETER, and an earlier draft's `invoiceCents` was
 *  removed rather than kept: `clerks.mjs:674` derives the bill itself with
 *  `invoiceFor(quoteCents, caseId)` and never reads the record, so the
 *  parameter was inert — no value of it could change a verdict. Worse, its
 *  default wrote a figure into the case record that contradicted the one the
 *  clerk actually reconciled. The `noted` event now carries the SAME derived
 *  figure the clerk will read, so the record and the judgment agree.
 *
 *  `subject` is what steers the verdict, because `invoiceFor`'s drift is a
 *  hash of the caseId (`vendors.mjs:66-93`) — most jobs bill near the quote,
 *  about one in three runs over. A fixed subject therefore pinned every
 *  settlement fixture to one branch and made Mira's over-ceiling HARD RAIL —
 *  the fix for `docs/WRIT-THE-GATE.md` finding 3 — unreachable through the
 *  rig. `OVERRUN_SUBJECT` below is a measured subject that lands on the
 *  overrun branch, so the refusal path can actually be exercised.
 *
 *  ONE MORE THING THE RAIL ACTUALLY REQUIRES, measured while wiring this: an
 *  overrun alone does not hold. The authorized ceiling is
 *  `max(quote, NTE cap)` (`reconcileSpend`), so a $214 invoice against a $180
 *  quote still sits under the $350 house cap and CLEARS — correctly. To reach
 *  `needs-owner-approval` the quote must itself be above the cap and the
 *  invoice must then overrun it (e.g. `quoteCents: 40000` with
 *  `OVERRUN_SUBJECT` → a $474 invoice against a $400 ceiling). */
export const OVERRUN_SUBJECT = '2 Anvil Court — no cooling';

export function settlementFixture(core, {
  trade = 'HVAC',
  urgency = 'urgent',
  vendor = 'Ser Emrick the Bellows-smith',
  quoteCents = 18000,
  subject = '14 Cobble Row — no heat, furnace will not ignite',
  now = '2026-08-07T09:00:00.000Z',
} = {}) {
  const base = vendorCommitmentFixture(core, { trade, urgency, subject, now });
  const invoiceCents = invoiceFor(quoteCents, base.caseId);
  const tpl = vendorDispatchTpl();
  const id = ids('fx-settle');
  const params = core.fullParams(tpl, { trade, urgency });
  const dollars = (c) => (c / 100).toFixed(0);
  const events = [...base.events];
  events.push(...core.completeStep(tpl, base.caseId, 2, { at: now, id, note: `${vendor} engaged — quoted $${dollars(quoteCents)}.`, log: events }, params));
  events.push(...core.completeStep(tpl, base.caseId, 3, { at: now, id, note: `${vendor} dispatched — tenant notified.`, log: events }, params));
  events.push({
    id: id(), at: now, caseId: base.caseId, kind: 'noted', holder: 'lp-queue', catalogRow: 'work-order',
    note: `Invoice received from ${vendor}: $${dollars(invoiceCents)}.`,
  });
  events.push(...core.completeStep(tpl, base.caseId, 4, { at: now, id, note: 'Invoice matched to the work.', log: events }, params));
  events.push(...core.completeStep(tpl, base.caseId, 5, { at: now, id, note: 'Tenant confirms the fix holds.', log: events }, params));
  return { catalog: BOOK.catalog, flows: BOOK.flows, events, caseId: base.caseId, quoteCents, invoiceCents };
}

/** A case parked at ONE named step of any founding flow — the general form of
 *  the three hand-written stages above, and how every agent past the M family
 *  gets a fixture without a bespoke builder each.
 *
 *  It walks the REAL engine: instantiate the flow, then `completeStep` every
 *  step BEFORE the target, so the case folds to exactly the step named and the
 *  reading is the engine's own rather than a hand-placed event. Throws if the
 *  flow or the step is not in the founding book, rather than returning a
 *  fixture that quietly parks somewhere else — a fixture that lands on the
 *  wrong step tests the wrong judgment and still goes green. */
export function atStepFixture(core, { flowKey, stepKey, subject, params = {}, now = '2026-08-07T09:00:00.000Z' }) {
  const tpl = BOOK.flows.find((f) => f.key === flowKey);
  if (!tpl) throw new Error(`atStepFixture: the founding book has no flow "${flowKey}"`);
  const target = tpl.steps.findIndex((s) => s.key === stepKey);
  if (target < 0) throw new Error(`atStepFixture: flow "${flowKey}" has no step "${stepKey}"`);
  const id = ids(`fx-${flowKey}`);
  const full = core.fullParams(tpl, params);
  const instance = core.instantiateFlow(tpl, subject, { at: now, id }, full);
  const events = [...instance.events];
  for (let i = 0; i < target; i++) {
    events.push(...core.completeStep(tpl, instance.caseId, i, { at: now, id, log: events }, full));
  }
  return { catalog: BOOK.catalog, flows: BOOK.flows, events, caseId: instance.caseId, stepIndex: target };
}

/** name → builder, keyed the way the viewer's CLI arg names them. Milo's and
 *  Mira's builders take `core` first (they drive the real engine); the
 *  signature is uniform here (`(core, opts)`) so a caller can loop over this
 *  table without a special case for Mace's stage. */
export const FIXTURES = {
  'mace/raw-intake': (core, opts) => rawIntakeFixture(opts),
  'milo/vendor-commitment': (core, opts) => vendorCommitmentFixture(core, opts),
  'mira/settlement': (core, opts) => settlementFixture(core, opts),
};
