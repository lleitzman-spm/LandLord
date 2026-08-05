# Writ — the operator's hands (swing two, part one)

*Staged for a K3 summoning. Swing one built the **spine** (the flow engine, `src/domain/flows.ts`);
this builds the **hands**: the human-in-the-loop arc that makes a cascade *workable* — advance a
step, ratify a proposal, and the flow moves. It does **not** build the clerk agents themselves
(a later round); it builds the surface those agents will act through, and the mechanism that walks
a flow forward.*

*Addressed to the builder (Kimi K3). Read `docs/KINGDOM.md` (the constitution — it wins),
`CLAUDE.md`, `AGENTS.md`, and `docs/WRIT-FLOW-ENGINE.md` (swing one) before you start. Your profile
and why you hold the hammer: `docs/K3-PROFILE.md`.*

## What you are building

Make a triggered cascade actually **move**. Today a flow opens and hands its first step, and there
it sits — nothing walks it forward. Build the human-in-the-loop arc on the event log:

- **Advance.** When the step in hand is finished, hand the next. `handStep(tpl, caseId, index,
  opts)` in `flows.ts` already emits the right event — use it. Marking the step in hand `done`
  advances the cascade to the next template step.
- **Ratify.** The human-in-the-loop kinds already exist (`proposed → awaiting → approved /
  overridden`). A step that waits (`awaiting`) can be **approved** (it proceeds) or **overridden**
  (the human chose otherwise); the step in hand can be marked **done**. Each is one appended event;
  the reading recomputes around it.
- **Beside the record (law 6).** The Ledger's flow card (`FlowInstanceCard` in `src/LedgerView.tsx`)
  grows the buttons to do this, beside the step they concern. Clicking walks the live cascade — you
  watch it travel from notice to leased, the ball moving seat to seat.

## The ground you build on (already standing)

- `src/domain/flows.ts` — the engine. `handStep` (exported) hands a step; `readFlow` folds the
  cascade and gives `next` (the step in hand) and each step's `kind`. Put the advance/ratify
  helpers here.
- `src/store/chronicleStore.ts` — `flows.trigger` opens a flow. Add what the surface needs to walk
  it: an act that appends the right event (mark done → hand next via `handStep`; approve; override).
  Events-only — append through the log, store nothing.
- `src/domain/events.ts` — the log and its readings; new events are appended, never stored.
- `src/LedgerView.tsx` — `FlowInstanceCard` renders the cascade; add the act buttons at the step
  in hand.

## The leash and the gates (they bind you)

- **Events-only.** Advancing or ratifying is *appending an event*; nothing about a flow's progress
  is stored. The reading folds it.
- **The template is the plan; the log is the truth.** A flow advances by handing the *next template
  step* (via `handStep`). Do not pre-emit future steps.
- **Leave the clerk's seam clean.** A human act carries no agent actor. When the clerk agents
  arrive they will emit `proposed` with an `agent:<seat>` actor, and the human's `approved` /
  `overridden` answers it. Build so that plugs in — do not wire it now.
- **Not now — the clerk agents.** Do **not** build an autonomous agent or loop working a queue.
  Build the arc a human works by hand; the agents grip it next.
- **Factory-clean, working fluid, verify in a browser, `k3/` branch + PR, do not merge** — as the
  charter and the swing-one writ set out. Restore the chronicle after (`git checkout -- data/chronicle.json`).

## Deliverables

- The advance/ratify mechanism (store + `flows.ts` helpers): hand the next step, mark done,
  approve, override — each an appended event.
- The Ledger's flow card: buttons at the step in hand to advance/ratify; clicking walks the
  cascade and the readings recompute (the queue moves to the next holder, boards light, breaches
  clear or appear).
- A flow driven from trigger to done in a browser. `npm run build` green; driven end to end.
- Commit in the kingdom's plain-English medieval voice on a `k3/` branch; open a PR; **do not
  merge** — Claude reviews, the Regent judges the outcome.

## Why this matters

This turns the operator from a thing you *look at* into a thing you *work*. It is also the exact
surface the per-seat clerks will act through: they propose, you ratify, the cascade moves. Build
the hands so the clerks have something to grip.
