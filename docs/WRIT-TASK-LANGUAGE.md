# Writ — the task-language, the consequences, and the Regent's seat

*Staged for a K3 summoning (2026-07-20, reshaped after Edwin's rulings). One batched build, four
swings. Loose it to K3 **swing by swing** — prior runs hit their token budget mid-stride on a
single mind-bomb, so do not hand all four at once. Claude reviews each swing's PR, finishes the
last mile, verifies in a browser; the herald deploys on merge to `main`.*

*Read first — the constitution wins: `docs/KINGDOM.md` (esp. "The living instrument", "The
synergy brief", "The throne — the King's seat", "The task-language"), then `CLAUDE.md`,
`AGENTS.md` (the charter for agents), `docs/K3-PROFILE.md` (you). Then the code you extend:
`src/domain/catalog.ts`, `flows.ts`, `events.ts`, `wargame.ts`, `throne.ts`, `states.ts`,
`treasury.ts`, the surfaces `src/LedgerView.tsx`, `WarGamesView.tsx`, `ThroneView.tsx`,
`App.tsx`, `store/chronicleStore.ts`, and the agent machinery in `harness/` (`README.md`, the
loop, the tool-belt, the brain, the leash).*

---

## The whole idea (why we build this)

Three rulings from Edwin (2026-07-20) turn the War Game from a data-sampler into a real game:

1. **Tasks are a bounded, compositional language, and each word carries the flow that actually
   completes it.** A work order is not a "complete" click — it is *report → identify → assign a
   vendor → dispatch → invoice → confirm → pay → post to accounting*, a flow (`flows.ts` already
   models this shape). Identification is a path down a small tree: ~8 **domains** of PM → a
   domain's ~6 **systems** (Maintenance → HVAC, Plumbing…) → a system's ~5 **leaves** (HVAC →
   no-cooling, no-heating…). `maintenance / hvac / no-cooling` is one **word**. The alphabet at
   each level is tiny; the words are many but bounded — and **a few dozen flow *shapes*,
   parameterized by the leaf (which trade, what urgency), render all the words.** So many letters,
   a couple dozen grammars. **This library is not for pretty readings — it is the executable
   instruction set the agents will run** (ruling 3). An agent can only *actually do* a work order
   if `maintenance/hvac/no-cooling` carries the genuine steps.

2. **Neglect compounds — the score is a consequence simulation, not a count.** An unattended task
   festers → escalates into a crisis → the door's **Patron** loses faith → the Patron **withdraws
   their doors and their tribute** → the coffers bleed until upkeep drowns them → **the kingdom
   falls** (bankruptcy). The Treasury is already the health bar (upkeep on one pan, tribute on the
   other). The stakes are not invented; they are the coffers going red.

3. **The Regent's seat must feel impossible solo, so you must delegate — to agents that actually
   do the work.** Not seats that fake "done": **agents that execute a task's real procedure**
   (against simulated data, but doing real labor — reading the queue, walking the flow's steps,
   appending real events, stopping at the judgment moments for the Regent's ratification:
   `proposed → approved / overridden`). The clerk layer (KINGDOM.md, "The clerk"; the harness in
   `AGENTS.md`) is what the library exists to feed.

**The leash holds throughout (KINGDOM.md, the factory/setting seam):** LandLord ships only the
**mechanism** and a **small working-fluid** alphabet — never a firm's curated rows. a firm's real ~8
domains, systems, leaves, vendor roster, tribute figures, and flow shapes load through
`catalog.load` / `flows.load` at the data gate.

---

## Swing one — the executable task-library (the tongue of tasks)

**Goal:** the catalog becomes a faceted tree whose leaves each name the flow that completes them;
the engine renders one shape as many words. This is the substrate everything else stands on.

### 1a. The faceted catalog row (`src/domain/catalog.ts`)
Extend `CatalogRow` with optional, **general** fields (no a firm names):
```ts
export interface CatalogRow {
  key: string;            // stable; may be dotted for legibility ("maintenance.hvac.no-cooling")
  title: string;
  class?: CatalogClass;   // (unchanged) RUN / ACQ / FIRM
  mode?: CatalogMode;     // (unchanged) ⚙ auto / ◆ human
  note?: string;
  domain?: string;        // NEW — top facet (one of the ~8 PM domains)
  system?: string;        // NEW — mid facet ("hvac" within "maintenance")
  completes?: string;     // NEW — a FlowTemplate.key; triggering it works the task.
                          //       Absent → atomic (a single `done` closes it).
  params?: Record<string, string>; // NEW — the word filling a grammar: { trade, urgency, … }
}
```
Add readings (folded, never stored), mirroring `rowsByClass`: `rowsByDomain(catalog)` (group by
domain, then system), `domainsOf` / `systemsOf` (the alphabet at each level), `flowKeyFor(catalog,
key)` (the binding or null). `titleOf` / `findRow` keep working; **old flat keys must still
resolve** — an event may carry a key the catalog does not know, and the reading tolerates it.

> **Correctness landmine — do NOT rename existing keys.** `readFlow` matches steps by
> `catalogRow` + `holder`. Renaming `work-order` → `maintenance.general.work-order` silently
> breaks the move-out relay and the War Game. **Add facets to existing rows; add new leaf keys for
> the new alphabet. Never rename.**

### 1b. Flow-shape parameterization (`src/domain/flows.ts`)
One shape, many words. Teach `instantiateFlow` (and `handStep`'s note) to substitute `{token}`
from a `params` map — **in `note`, `condition`, and `board` only, NOT in `holder`.** (Holders
must stay real ids — a census person or a queue; the leaf's *trade* is flavor in the note, not a
fake seat. This sidesteps the "holder = 'HVAC tech'" trap.)
```ts
instantiateFlow(tpl, subject, opts, params?)  // "{trade}" in a note → params.trade; unknowns left verbatim
```
Pure, as all of `flows.ts` is. The store passes a triggered task-type's `params` in. This is the
**only** engine change; the reading side is untouched — step-state still folds from the same event
kinds, so the agents (swing four) grip these steps unchanged.

### 1c. The working-fluid alphabet (`FOUNDING_CATALOG` + `FOUNDING_FLOWS`)
Ship a **small** alphabet — proof of machine, never a firm's rows:
- **Maintenance** fully: ~6 systems as facets; **HVAC fully leafed** (5 leaves: `no-cooling`,
  `no-heating`, `refrigerant-leak`, `thermostat`, `routine-service`), each `completes:
  'vendor-dispatch'` with per-leaf `params` (trade, urgency). One or two other systems
  (Plumbing, Appliance) with a leaf apiece, so the second letter visibly varies.
- The other **domains named at the top** (Leasing, Collections, Renewals, Move-out,
  Owner/Accounting, Compliance) with one representative row each, so `rowsByDomain` shows the full
  breadth. **Reuse existing rows** by adding `domain`/`system` facets (e.g. `renewal`,
  `delinquency`, the move-out relay's rows) rather than duplicating.
- Add flow shapes to `FOUNDING_FLOWS`: **`vendor-dispatch`** — the WO grammar: report → identify →
  assign-vendor → dispatch → invoice-in → confirm-work → pay → post-to-accounting. Holders across
  the right seats (working-fluid-approximate is fine: `pm-desk`/Mabel → `va-desk` → `lp-queue`;
  vendors are **sellswords**, KINGDOM.md — a `va-desk` queue or a sellsword id, never a fake seat).
  Money steps carry `slaDays`/windows as the move-out relay's do. `{trade}`/`{urgency}` tokens in
  the notes so the HVAC leaves render distinctly. Keep the existing `move-out-relay`.

New fields are optional — **no chronicle break**; `catalogAtFounding`/`flowsAtFounding` (JSON
compares) and the census-migration adoption keep working.

**Verify:** build green; the catalog reads as a tree, an HVAC leaf shows its bound flow, and
triggering it renders a vendor-dispatch cascade with the leaf's trade in the step text.

---

## Swing two — the consequence engine (neglect compounds; Patrons; the coffers as health bar)

**The disease we cure and the stakes we add.** A good-standing lease is a **state, not open work**
(Edwin's correction — the perpetual-open lease is the *old system's* clutter, and eradicating it is
the thesis). Work exists only when the operation *emits* it, and **unattended work gets worse.**

### 2a. Leases as state (`src/domain/wargame.ts`)
Deal each occupied door's lease as **settled** (an `opened` immediately answered by a settling
`done` at signing, or a roster fact that never enters the log as an *open* case) so `statusOf`
never reads a good-standing lease as open — `queues`/`outcomes`/the Throne stop counting it. Keep
the door→tenant roster. **Update `dealtGame`** so a redeploy still skips settled leases (no
double-deal). Same seed → same world; the `wg/<seed>` mark and Reset intact.

### 2b. Patrons — the owners, themed (Edwin: call them **Patrons**)
Doors already carry an owner name (`ownerName` in `wargame.ts`). A **Patron** is an owner who has
entrusted their estate (their doors) to the Crown's keeping and pays **tribute** for it. Model the
patrons from the door roster (a handful of doors each). A Patron's **faith** is a **reading**,
folded from the state of work on their doors — pure, from the clock, never stored.

### 2c. Consequences as readings first (`src/domain/` — a new `consequences.ts` or fold into
`events.ts`/`throne.ts`)
Keep the spine **events-only and reading-first** — consequences are a *function of age and
inaction against the clock*, not stored state:
- **`severity(case, now)`** — an open case's harm, climbing with idle age past thresholds
  (fester → crisis). A done/dispatched case does not climb.
- **`patronFaith(patron, log, now)`** — folded from the severities on that patron's doors: crises
  erode faith.
- **`withdrawn(patron, …)`** — a reading: faith past the floor → the patron recalls their estate;
  their doors and their tribute drop from the readings.
- **`coffers(...)`** — extend the Treasury (`treasury.ts`): **tribute** (a working-fluid figure
  per *retained* door) on one pan, **upkeep** (already modeled) on the other. `withdrawn` patrons
  cut tribute. The **fail state is a reading**: coffers trend below zero → the kingdom falls.

### 2d. The rising tide (the one place the clock writes)
For the seat to genuinely *drown* (ruling 3), neglect must **create more work**, not just worsen a
number. On **`advance`**, a case past a crisis threshold with no action **spawns one escalation
case** (a higher-severity typed task — e.g. a neglected `no-cooling` spawns a habitability/legal
case), events-only and `wg/<seed>`-marked so Reset still strikes it. **Cap it** (a bounded number
of new cases per advance) to keep volume sane — see the budget below. This is the tide the Regent
races.

### 2e. Volume budget (perf)
The current generator deals ~600 boxes; walked cascades multiply events fast (the handoff clocked
~1s renders at ~2,000 events). Keep the **base deal in the ~700–1,000 open-case range** — a *mix*
of atomic tasks and full cascades, not every WO an 8-step walk — and cap escalation spawns per
advance. If it still bites, the canon's answer is the materialized reading-snapshot cache — note
it, don't build it yet.

### 2f. The Throne and War Games show the stakes
The Throne (`ThroneView.tsx`) already reads allocation (the delegation debt). **Add the stakes
beside it:** patron faith (who's wavering, who's near withdrawal), doors at risk, and the coffers
trend (the health bar). Allocation is the *lever*, consequences are the *stakes* — delegate well →
work clears → faith holds → coffers hold; neglect → compounds → fall. Keep both gauges; don't rip
out the allocation reading.

**Verify:** deploy a game — no perpetual-lease clutter; open work is typed; patron faith and the
coffers read live. Advance the clock — severities climb, a crisis spawns new work, a patron's
faith falls, tribute dips. Reset restores the founding chronicle.

---

## Swing three — the Regent's seat that drowns you

**The first real per-seat surface (Edwin chose the Regent first).** New `src/StewardView.tsx`;
**absorb the existing read-only `DeskView`** into it (one desk, not two). It reads against the
effective clock and makes the overwhelm real and the delegation the escape (all law-6 — act beside
the information):

1. **The rising tide, surfaced.** What has landed on / fallen to the Regent — reuse `readThrone`
   and the new consequence readings (do not re-derive): unlorded fiefs, unowned queues (`pm-desk`
   …), unassigned and untriaged work, and the **festering** cases by severity, the patrons losing
   faith, the coffers. It should read as *more than one person can clear* — that is the point.
2. **Identify → put in motion (the signature act).** For raw/untriaged intake ("a thing happened
   at a door"), walk it **down the tree** (domain → system → leaf) in the seat; choosing the leaf
   **triggers that leaf's `completes` flow** onto the right holder with the leaf's params — the
   task is now *properly in motion*, not ticked. (Swing two must deal a **modest stream of raw,
   untriaged intake** — Edwin: a satisfying core act, not data entry — so the seat has input; the
   bulk arrives typed for bulk delegation.)
3. **Delegate to escape.** Hand an unowned queue's work, or a single case, to a real seat in one
   act (append `handed`). This is the "clear the ball off my desk" move — and in swing four, the
   receiving seat can be an **agent** that actually does it.
4. **The stakes, felt.** The consequence readings fall as he delegates and clears, and rise as he
   dithers — the game loop from his chair.

Store actions (`store/chronicleStore.ts`, events-only, same id/clock discipline as
`events.record`/`flows.trigger`): **`triggerTyped(catalogKey, subject)`** (look up `completes` +
`params`; bound → `instantiateFlow(tpl, subject, opts, params)`; else a single typed `opened` —
the primitive the seat and the agents share) and **`handQueue(fromHolder, toHolder)` /
`handCase(caseId, toHolder)`**. Wire the seat into the `goToLedger` roads already built.

**Verify:** deploy a game; from the seat, identify an untriaged WO to an HVAC leaf → a live
vendor-dispatch cascade on the right seat; hand an unowned queue to a real seat; watch the tide
and the coffers respond. The overwhelm is legible: doing it all by hand is visibly losing.

---

## Swing four — prove one agent (the clerk layer's seed)

**Set the stage, prove one agent (Edwin's choice).** Build ONE real agent that **actually
executes** ONE task-type against the War Game's simulated data — the seed of the per-seat clerk,
proving the thesis that delegation targets *do* the work rather than fake it.

- **Reuse `harness/`** — the same machinery as the K3 builder (a loop, a tool-belt, a brain, a
  leash), but as an **operator**, not a builder. Its tool-belt is small and domain-specific: **read
  the event log** (the queue for its seat/task-type) and **append events** (advance the flow,
  emit `proposed` at a judgment point). Not the file/shell builder belt.
- **The one task-type: the vendor-dispatch WO** (it shows the language, the flow, and a real
  judgment stop in one). The agent: picks an untriaged/aging WO on its seat → **identifies it down
  the tree** (the language, used by a machine) → **triggers/advances the completion flow** →
  **stops at the judgment step**, emitting `proposed` with an `agent:<seat>` actor and parking the
  case `awaiting` — for the Regent to `approve` / `override` in his seat (the arc already in the
  log's event kinds and the flow engine's hands). *(A simpler single-decision task-type is an
  acceptable fallback if vendor-dispatch proves too much for one swing — the goal is one agent
  genuinely doing, with a human-in-the-loop stop.)*
- **Brain-agnostic and cheap.** A per-seat clerk doing bounded procedural work does **not** need
  K3's building power — the harness is brain-agnostic; use a smaller/cheaper model for the
  operator and keep K3 for building (megamind law). State which model in the PR.
- **Gate-safe, no data gate needed.** It operates only on the **simulated** War Game world —
  synthetic doors, tenants, patrons — so no real client system is touched (HANDOFF: War Games give
  synthetic work to operate on now, no gate). The data gate for *real* work stays Edwin's deliberate
  call.
- **Human-in-the-loop, always.** The agent augments, never replaces: it works to the judgment
  moment and stops (`proposed → awaiting`); the Regent ratifies. Never let it self-approve.

**Verify:** in the War Game, loose the one agent on its seat; watch it identify and advance a real
WO and park a `proposed` on the Regent; the Regent approves in his seat and the cascade moves;
override and it holds. One agent, actually doing, with the human's hand on the ratchet.

---

## The leash and the gates (all swings)
- **The constitution wins.** Any conflict with `docs/KINGDOM.md` — stop and flag, don't build around.
- **Events-only.** No new stored state: tasks, queues, aging, severity, faith, the coffers trend,
  the fail state — all readings folded from the log (+ the Treasury book). A flow instance *is* its
  case. The only place the clock *writes* is the bounded escalation spawn on `advance` (2d).
- **The factory/setting leash.** Ship the mechanism + a **small working-fluid** alphabet; name
  nothing firm-specific in code. a firm's real alphabet, flows, vendors, and tribute figures load at
  the gate.
- **Working fluid.** Never curate toward reality; restore `data/chronicle.json` after any test
  (`git checkout -- data/chronicle.json`).
- **No chronicle break.** New fields optional; old chronicles normalize unchanged; the
  census-migration adoption keeps working.
- **Verify every swing in a real browser** (playwright-core, chromium at `/opt/pw-browsers/…`;
  `npm run dev -- --port 5199`; kill with `pkill -f '[v]ite --port 5199'`). `npm run build` green
  at every commit.
- **Charter:** `k3/` branch, a commit per swing, **open a PR per swing, do not merge** — Claude
  reviews and finishes the last mile; the Regent judges the outcome and commands the deploy.

## Deliverables (by swing)
1. `catalog.ts` (facets, `completes`, `params`, `rowsByDomain`, alphabet readings, extended
   working-fluid catalog) · `flows.ts` (`{token}` substitution, `vendor-dispatch` shape).
2. `wargame.ts` (leases as state; typed emitted work; the escalation tide) · a `consequences`
   reading (severity, patron faith, withdrawal) · `treasury.ts` (tribute vs upkeep = the coffers/
   fail state) · Throne + War Games showing the stakes.
3. `StewardView.tsx` (absorbs `DeskView`) + `triggerTyped` / `handQueue` / `handCase` store
   actions; nav wired.
4. One operator agent on `harness/` (operator tool-belt: read log / append events) executing one
   task-type against the sim, with the `proposed → awaiting` human-in-the-loop stop.
- Throughout: `docs/KINGDOM.md` canon kept current; `docs/HANDOFF.md` refreshed each swing.

## Out of scope (name, don't build)
- a firm's real alphabet/flows/vendors/tribute (loads at the gate).
- The **full** clerk fleet (an agent on every seat) — swing four proves ONE; the fleet follows.
- Autonomous agents on **real** (non-simulated) data — behind the data gate, Edwin's deliberate call.
- An occupancy/vacancy reading over the lease roster — worth having once leases are state; separate build.
