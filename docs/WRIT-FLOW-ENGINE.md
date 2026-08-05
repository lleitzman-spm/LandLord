# Writ — the flow engine (the operator's spine)

*Staged for a single K3 summoning (the megamind law: hoard, then loose once). This is **swing
one** of "the operator" — the unified machine the Regent named when he saw that the clerk layer
and the flow/cascade engine are one thing. Swing one builds the **spine**: flows expressed from
config. Swing two gives it **hands**: the per-seat clerks. Build only swing one now.*

*Addressed to the builder (Kimi K3). Read `docs/KINGDOM.md` (the constitution — it wins),
`CLAUDE.md` (conventions), and `AGENTS.md` (your charter and the gates) before you start. Your
capability profile and why you hold the hammer: `docs/K3-PROFILE.md`.*

## What you are building

A general **flow/cascade engine**: a mechanism where one trigger fans out into many steps across
many holders, with timing edges, waits, conditions, and loops — all expressed from **loaded
config**, never hardwired in code. Events-only: a flow instance is a *case*, and its steps are
*events* in the log we already keep. You are building the part that turns a config-defined flow
into live work on the board.

## The ground you build on (already standing)

- `src/domain/events.ts` — the event log and its readings (cases, queues, aging, outcomes). Your
  steps become events here. Events-only is law (`KINGDOM.md`, "Events-only"): nothing is stored;
  every reading folds from the log.
- `src/domain/catalog.ts` — the task-type ontology (build 16d). Every step references a catalog
  row by key. Add rows to `FOUNDING_CATALOG` as the relay needs them.
- `src/domain/chronicle.ts` + `src/store/chronicleStore.ts` — the chronicle's shelves adopt their
  founding state when a book arrives without them (the census-migration pattern; see exactly how
  `catalog` and `events` do it). Your flow config is a new shelf that follows the same pattern.
- `src/LedgerView.tsx` — the surface. A triggered flow renders here.

## The shape — yours to design

You outbuild the reviewer; design the abstraction well rather than typing one I dictated.
Guidance, not a cage:

- A **flow template**, loaded from config: a trigger and a set of **steps**. A step names a
  **catalog row** (task-type), a **holder** (who gets the ball — a census person id or a queue),
  a **timing edge** (relative, like T-7d, or a window, like "after the 15th / before the 10th"),
  an optional **wait / SLA**, an optional **condition**, and which **board / phase** it belongs to.
- **Loops:** at least one step repeats on an edge (the weekly vacancy price-drop).
- **Instantiate** = trigger a flow on a subject (e.g. "Willow Creek unit 4"): open a case and emit
  the steps as events referencing catalog rows + holders + timing. The flow instance *is* the
  case; its state folds from the events — no stored flow state.
- **Readings:** fold the flow back from its events — where the cascade sits, what is next, which
  timing edges are breached. General; no a firm names in the mechanism.
- Config lives in a new chronicle shelf (`flows`) that adopts a working-fluid founding set when
  missing (`normalizeChronicle` adopts it; `isFoundingChronicle` accounts for it). The store
  exposes it (a bulk `load` for the gated real flows, plus what the surface needs).

## The stress test — the leash

Express **a firm's move-out → re-list relay** purely from config — **working-fluid** (synthetic; the
real one loads at the data gate, per the data gate). Capture this shape:

- **1 notice → 13 steps → 5 actors → 3 boards** (Move-Out → Deposit Transfer → Leasing).
- Actors: a property manager, Osric (Leasing), Alys (Property Management), an LP, a VA — map to
  census holders where they exist (`osric`, `alys`), to queues/role-holders otherwise.
- A **timing-boxed money step**: a ~$750 reserve, windowed ("after the 15th / before the 10th").
- A **weekly $25/wk vacancy price-drop loop** until leased.

The whole test is this: if the *generic* engine renders that 13-step cascade **from config
alone** — with no branch of code that knows the word "move-out" — the abstraction line is right.

## The leash and the gates (they bind you as they bind Claude)

- **Factory-clean.** Build the general mechanism; keep every firm-specific thing as config that
  loads in. The test is blunt: could a firm's real relay be assembled from your engine *without
  cutting new code*? If not, it is under-powered; if it carries knobs a firm never turns, over-built.
- **Events-only.** No stored work-item or flow state; everything folds from the log.
- **Working fluid / the data gate.** Synthetic config only. Do not reach for real client content
  (`AGENTS.md`, gate 3).
- **Not now — the clerks are swing two.** No autonomous queue-working, no scheduled `proposed`
  emission. Swing one is engine + config + rendering. But leave the seam: the human-in-the-loop
  event kinds (`proposed → awaiting → approved / overridden`) already exist in the log so the
  clerks can grip this spine next. Build toward them; do not build them.

## Deliverables

- The domain (`src/domain/flows.ts`, or as you judge best): the flow template/step types, the
  readings, and a working-fluid `FOUNDING_FLOWS` that holds the move-out relay.
- The `flows` chronicle shelf (normalize + isFounding) and its store exposure.
- The engine: trigger a flow → emit its steps as events into the log.
- The Ledger surface: trigger a flow, and watch the cascade render — steps across their boards and
  holders with their timing — folded from the events. Running one relay should also *feed the
  machine*: 13 events across the seats, showing up in the queues you already read.
- `npm run build` green; the feature **driven in a real browser** (playwright-core + the chromium
  at `/opt/pw-browsers/chromium` against `npm run dev -- --port 5199`); the chronicle restored
  after (`git checkout -- data/chronicle.json`).
- Commit in the kingdom's plain-English medieval voice on a `k3/` branch; open a pull request;
  **do not merge** — Claude reviews the code, the Regent judges the outcome. Note any fork you
  hit for the Regent in `docs/HANDOFF.md`.

## Why this matters (build toward the vision, not the ticket)

This is the operator's spine — the thing that turns an instrument over the *org* into a living
instrument over the *work*, running real cascades from config. Build it so its hands can grip it:
the clerks come next, working these very steps and stopping at the judgment moments. If you see a
better abstraction than the one sketched here, take it — and say why in the PR.
