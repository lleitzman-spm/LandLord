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
  const events = [
    ...instance.events,
    ...core.completeStep(tpl, instance.caseId, 0, { at: now, id, note: 'Report logged from the tenant intake.' }, params),
    ...core.completeStep(tpl, instance.caseId, 1, { at: now, id, note: `Identified as an ${trade} call.` }, params),
  ];
  return { catalog: BOOK.catalog, flows: BOOK.flows, events, caseId: instance.caseId };
}

/** Stage 3 — dispatch already done, the vendor's invoice already in from the
 *  world; the case sits at `pay-vendor`, exactly where Mira's judgment
 *  starts. `quoteCents` is what the vendor was authorized to bill — it drives
 *  the clerk's own read, via the note Milo would have written
 *  (`authorizedQuoteCents` in `clerks.mjs` reads it back with the same
 *  `/quoted \$([\d,]+)/` pattern). `invoiceCents` decorates a `noted` event
 *  with the world's own words for the trace to show, but Mira's clerk does
 *  NOT read that note — `clerks.mjs` derives the actual bill itself
 *  (`invoiceFor(quoteCents, caseId)`, a deterministic working-fluid stand-in
 *  for the real vendor bill), matching production exactly. Passing an
 *  `invoiceCents` that disagrees with that derivation is honest, not a bug:
 *  the real world's invoice and the clerk's own reconciliation input can
 *  differ today, and closing that gap is real invoice ingestion, not a
 *  fixture's job. */
export function settlementFixture(core, {
  trade = 'HVAC',
  urgency = 'urgent',
  vendor = 'Ser Emrick the Bellows-smith',
  quoteCents = 18000,
  invoiceCents = 24700,
  now = '2026-08-07T09:00:00.000Z',
} = {}) {
  const base = vendorCommitmentFixture(core, { trade, urgency, now });
  const tpl = vendorDispatchTpl();
  const id = ids('fx-settle');
  const params = core.fullParams(tpl, { trade, urgency });
  const dollars = (c) => (c / 100).toFixed(0);
  const events = [
    ...base.events,
    ...core.completeStep(tpl, base.caseId, 2, { at: now, id, note: `${vendor} engaged — quoted $${dollars(quoteCents)}.` }, params),
    ...core.completeStep(tpl, base.caseId, 3, { at: now, id, note: `${vendor} dispatched — tenant notified.` }, params),
    {
      id: id(), at: now, caseId: base.caseId, kind: 'noted', holder: 'lp-queue', catalogRow: 'work-order',
      note: `Invoice received from ${vendor}: $${dollars(invoiceCents)}.`,
    },
    ...core.completeStep(tpl, base.caseId, 4, { at: now, id, note: 'Invoice matched to the work.' }, params),
    ...core.completeStep(tpl, base.caseId, 5, { at: now, id, note: 'Tenant confirms the fix holds.' }, params),
  ];
  return { catalog: BOOK.catalog, flows: BOOK.flows, events, caseId: base.caseId, quoteCents, invoiceCents };
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
