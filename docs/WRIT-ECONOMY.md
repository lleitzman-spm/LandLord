# Writ — the economy pillar, re-expressed as chronicle readings

*Staged 2026-07-20. The economy pillar is ratified canon (`docs/KINGDOM.md`, "The economy — the two
treasuries") and researched + cited (`docs/RESEARCH-ECONOMY.md`). But that research's §6 data model is
written for **a relational `ops` schema** (tables, RLS, triggers, `gen_random_uuid`) — a
different machine. Before any of it is built, it must be **re-expressed in the kingdom's idiom:
records-in, readings-out, events-only.** This writ is that re-expression and the phasing. Swing one
(the domain core) is built alongside it.*

## The one translation

§6 stores three things in Postgres: `gl_accounts` (the chart), `ledger_events` (what happened), and
`ledger_postings` (the double-entry lines). **The kingdom stores only the first two and FOLDS the
third.** A money event records *what happened and to whom* (`management_fee $150 on estate P, owner O`);
the balanced debit/credit postings are **derived** from a pure catalog on every read, never stored —
exactly as a work case's state folds from its events and a flow's cascade folds from its template. This
is the constitutional improvement over the SQL model: the posting table is a *reading*, not a record, so
it can never drift from the events, and a correction is a reversing event, not an UPDATE.

| §6 (Postgres `ops`) | LandLord (chronicle) |
|---|---|
| `ops.gl_accounts`, `ops.fee_rules` | `chronicle.economy` — a loadable static book (working-fluid founding chart; a setting loads a firm's real one at the gate), like `catalog`/`flows` |
| `ops.ledger_events` | `chronicle.money` — an append-only money-dimension stream, like `events`; each carries `sourceId` linking to a work `caseId` (the operational spine) |
| `ops.ledger_postings` (stored) | **folded** — `postingsFor(event, economy)` expands each event to balanced postings on read; nothing stored |
| append-only trigger, reversing entries | the kingdom's existing append-only law; a correction is a reversing money event |
| RLS / `is_leadership()` | the walls + the data gate: real figures load at the data gate; the model is working-fluid |
| scheduled reconciliation function | a pure reading recomputed live (`readSolvency`), not a monthly batch |

## The shape (swing one — the domain core, `src/domain/economy.ts`)

- **Two books, one engine.** Every account and posting carries `book: 'trust' | 'corporate'`. One posting
  catalog serves both the AppFolio (property/owner) and QuickBooks (corporate/CPA) dimensions; the
  **bridge** kinds are the only ones that move a dollar between the worlds, via the mirrored
  `Due to Mgmt Co` (trust) / `Due from Trust` (corporate) clearing pair (§3, §6.4).
- **The money-dimension is an event, the postings are a reading.** `MoneyEvent { kind, amountCents,
  estateId?, ownerId?, tenantId?, vendorId?, at, settledOn?, sourceId? }`. `postingsFor` expands each
  `kind` into balanced double-entry lines per §6.3. Balanced within each book by construction.
- **Fees are computed, then recorded as an amount.** `feeAmount(rule, basisCents)` applies a `FeeRule`
  (a % in basis points or a flat cents), so the seed/act computes the fee and emits a `management_fee`
  event carrying the resulting `amountCents`; `postingsFor` stays a pure expansion.
- **The four readings, all folds** (§6.5): `readSolvency` (the three-way trust reconciliation, live),
  `readPnL` (corporate income − expense over a period), `readOwnerStatement` (per owner/estate), and the
  bridge self-check (`Due to Mgmt Co` ≡ `Due from Trust`). Budget-vs-actual is deferred.
- **Working fluid, no a firm numbers.** A founding chart of accounts (both books, from §5) + a few founding
  fee rules (management 8%, leasing one month, markup 10%) + a seed of a handful of money events, purely
  to exercise the machine. a firm's real accounts, rules, and figures load at the gate.

### The invariant that proves it (the reading harness asserts these)

- **Every book balances:** Σdebits = Σcredits per book, for every event's postings and in aggregate.
- **The bridge ties:** `Due to Mgmt Co` (trust) magnitude ≡ `Due from Trust` (corporate) magnitude, at
  all times (§6.4).
- **The trust identity:** trust cash − (owner net + deposits held + reserves held + due-to-mgmt) ≡
  (vendor payables − tenant receivables). With a cash-complete book (AR = AP = 0) the variance is **0** —
  the solvency "coffers" reading; a nonzero variance is exactly the in-transit reconciling items the
  monthly three-way would surface (§1.6, §4). This identity holds by double-entry, so the harness proves
  the posting engine is internally consistent.
- **No commingling by construction:** the only `kind` that moves trust cash to the company is
  `fee_sweep` of already-earned `Due to Mgmt Co` (§6.7); corporate expenses never debit trust cash.

## Phasing (this pillar, swing by swing)

1. **The domain core (THIS swing).** `economy.ts` — the two-book chart, the fee helper, the posting
   catalog, and the four readings; the `chronicle.economy` book + `chronicle.money` stream, normalized
   additively; a working-fluid seed; reading-harness-verified against the invariants above. Additive:
   the existing `Treasury`/`readCoffers` (the War Game's simplified tribute-vs-upkeep fail state) is
   **untouched** — this stands beside it as the full model.
2. **Store acts + the War Table surface.** `economy.record(event)` store acts (append-only, `wg`-marked
   when a game stands); a Coin/Counting-house panel that renders the two books, the coffers/solvency, the
   corporate P&L, and an owner statement. Browser-verified.
3. **Wire the operating spine.** The War Game generator deals money events alongside the work (rent on
   leases, vendor bills on work orders, fees on the bridge) so the coffers move as the operation runs;
   fold the existing `Treasury` upkeep into the corporate book's expenses so there is one coffers reading,
   not two.
4. **Compliance as invariants** (§6.7): per-owner no-overdraw, the commingling guard, earned-fee aging —
   surfaced as insights, not just reports.
5. **Budget-vs-actual**, then the **AppFolio backfill** at the gate (real figures replace the seed).

## Recon synthesis — leash-safe structure from a firm's AppFolio (Lane A, 2026-07-21)

A field reconciliation against a live trust-accounting system (`/workspace/operating-model-project`) **validates** this model — a firm books fees as an
owner-side expense mirrored to company income (their GL 5500↔company), deposits as liabilities,
per-property fee config — exactly our two-book bridge. From it, the model gained the leash-safe
**structure** (general kinds, working-fluid — a firm's real *figures* still load at the gate):
- **New money/fee kinds:** `pet_rent` and `utility_reimbursement` (owner-side income, in trust);
  `moveout_reserve_withheld` (the recon's ~$750 reserve held from final rent — a distinct reserve
  liability, `moveout_reserve_held`); and firm-retained ancillary revenue `nsf_fee` / `admin_fee` /
  `reletting_fee` / `ancillary_fee` (RBP), each a named corporate income line. `FeeKind` grew to match.
- **The owner-approval spend gate** — the recon's "$400 cap" as `EconomyBook.spendApprovalCents` +
  `needsOwnerApproval(economy, amountCents)`: a repair at/above the cap needs owner approval before the
  vendor proceeds. General/working-fluid. **Lane B wires it into the vendor-dispatch flow's approval step.**
- Solvency + the owner statement fold the new streams (a shared `ownerNetOf` keeps the two readings from
  drifting); the P&L auto-shows the new company income lines. Reading-harness-verified (books balance, the
  identity holds, the reserve reads as a liability, the spend gate gates at the cap).

## The gates (all swings)

- **Records-in, readings-out; events-only.** Postings are never stored; a correction is a reversing
  event. The chart + fee rules are a loadable book (founding working-fluid; the setting loads real).
- **The data gate holds.** Real client financials (rents, invoices, owner draws, payroll) are gated —
  the *model* is built now, the *numbers* wait for the data gate, the Regent's deliberate call.
- **No chronicle break.** The new `economy` book and `money` stream normalize from missing to their
  founding/empty state, like every shelf before them.
- **Verify.** Reading-harness on the invariants + `npm run build` green + a browser regression (the app
  and its existing panels are unaffected — the layer is additive).
