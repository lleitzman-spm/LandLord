# Handoff — where things stand

*The working-state document. `KINGDOM.md` is the constitution (what the kingdom
**is**); this is the state of play (what is **done**, what is **next**, what is
**stuck**). Much of the codebase points here, because a session that starts by
trusting a stale note is worse off than one that starts with nothing.*

**This file starts empty in the public repository, on purpose.** Its private
predecessor grew to three thousand lines of session state naming real people and
live infrastructure, and none of that crosses. What crosses is the *habit*, which
is genuinely load-bearing: coordination lives in files everybody reads and
writes, never in one worker's head.

---

## The discipline

- **Every session ends by refreshing this file.** Not "when there is something
  worth saying" — every time.
- **Trust this file over memory**, and check it against the tree. A note here is
  a claim, not evidence. Three "blockers" once sat marked open for five sessions
  after they were closed, because nobody re-read them against the code.
- **A claim about state carries its check.** "Done" means a named command was
  run and a named thing observed, not that a diff was written.
- **Delete freely.** A stale line here costs more than a missing one.

## LANES — who is working on what

When more than one session or contributor is working at once, claim a lane:
a **branch**, an **owned surface**, and a **section in this file**. A lane edits
only its own surface. Before starting and before shipping, `git fetch` and check
this table — if another hand already landed the work, adopt theirs and drop
yours rather than forcing your copy over live work.

| Lane | Branch | Owned surface | Status |
|---|---|---|---|
| _(none claimed)_ | | | |

## State of play

**2026-08-07 (later still) — the agent rig, a viewer, fixtures, the M family,
and then an adversarial review that found six real defects in all of it.**
All green: `npm run build`, **504 tests**, `leakcheck` **1,484** files / 0
findings, `npm run book` 1,203 pages, `npm run book:lint` exit 0 (0 dangling,
1,109 quotes re-verified). *Every figure here was read off a clean tree with
nothing unstaged, because the count moves as generated pages are added — see
below.*

*Three figures in the first draft of this entry were wrong and are corrected
here: it claimed 493 tests "(was 461)" — 461 was two commits stale, and the
rig's own file held 15 tests, not the 27 the commit message claimed (27 was
`rig.test.ts` and `roster.test.ts` counted together). It claimed leakcheck
scanned 1,458 files while its own commit message said 1,473. Recorded rather
than quietly fixed, because a session that miscounts its own evidence is the
thing this file's discipline exists to catch — and it happened a THIRD time
while writing this correction, when 1,473 went stale the moment the
regenerated Book pages were staged. The lesson is mechanical, not moral:
`leakcheck` counts TRACKED files, so its number is only true for the exact
staged state it was run against. Read it last, off a clean tree.*

The four-item build order from the session brief, in order built:

- **THE RIG** (`harness/agents/rig.mjs`). `buildAgent(spec)` turns a
  `roster.mjs` entry into a frozen descriptor that touches no file, no shell,
  no war-game seed. Only `deploy(agent, backing, {core, complete, brainFor})`
  binds a backing and hands the agent a `core` **scoped to exactly the
  capability tags its belt declares** (`CAPABILITY_CORE_FNS`) — the first time
  any clerk's access has been narrower than the whole engine. No tag, on any
  agent, ever grants `approveStep`/`overrideStep`/`settlementMoney`/
  `vendorSettlementMoney` — the names are absent from the table itself, the
  same defence the money door already stood on, now covering the ratchet too.
  **What that boundary does NOT cover, since an unstated limit is how a gate
  becomes decoration:** the belt scopes the DOMAIN CORE only —
  `harness/clerks.mjs:21-23` reaches `vendors.mjs`/`leasing.mjs`/
  `safe-evidence.mjs` by static import, around `ctx.core`. All three verified
  pure reference/compute (no write, no event, no network, no money door), so
  the bypass widens what an agent may READ, never what it may DO. And an agent
  granted `open:cascade` **can still advance a cascade** — `completeStep`
  bounds-checks only. It cannot RATIFY, which is the guarantee that holds.
  **The weld named in the brief is cut**: `fleet.mjs`'s
  `if (!doc.wargame?.seed) process.exit(1)` used to mean an agent could not
  exist at all without a live disk chronicle carrying a standing War Game.
  That check now belongs to `fileBacking()` — the ONE backing that can reach
  real disk state — as a `BackingRefusal`, and a second backing,
  `memoryBacking(doc)`, satisfies the identical two-function interface
  (`readLog()`/`appendEvents(events)`) with no war-game requirement, because
  it never risks the live simulator. **`fleet.mjs` and `worker.ts` are
  UNCHANGED** — they keep their own inline checks (CLI exit / HTTP 409) rather
  than being migrated onto the rig's backing today; that migration is real
  and still open, named below, not silently done.

- **THE VIEWER** (`harness/viewer.mjs`, `./harness/run.sh viewer.mjs
  [Mace|Milo|Mira|all]`). One work order in, the agent's manifest card, its
  reasoning trace, and exactly where it stops. **Driven both ways, not just
  unit-tested**: with `MOONSHOT_API_KEY` set, real Tier-1 brain calls (`[brain
  t1]` in the trace, e.g. Milo pricing an *urgent* HVAC call at $800 against a
  $350 house cap — "needs-owner-approval"); with the key unset, every agent
  fell straight to its deterministic Tier-0 path (`[heuristic]`) with no crash
  and no hang. `git status --short data/chronicle.json` stayed empty across
  both runs — `memoryBacking()` never touches disk, so nothing needed
  restoring after.

- **FIXTURES** (`harness/agents/fixtures.mjs` +
  `agents/fixtures/founding-book.json`). Three stages of ONE work order —
  raw intake (before Mace) → the vendor-dispatch commitment (before Milo) →
  settlement (before Mira) — each built by calling the REAL flow engine
  (`instantiateFlow`/`completeStep`), never a hand-typed event array, off a
  **frozen snapshot** of the founding catalog + flow book rather than the
  live, mutable `data/chronicle.json` (the exact trap `book/memory/learned.md`
  already names: "a generated page is not where a running game reads its
  rules").

- **THE FIRST FAMILY** — Mace, Milo, Mira, run through the rig unchanged from
  the fleet's own judgment code (`clerks.mjs`'s `makeIntakeClerk`/
  `makeVendorClerk`/`makePriceClerk`, reused by reference, not reimplemented).
  Their rail ran end to end on the viewer: Mace identified a furnace complaint
  as `maintenance.hvac.no-heating` and proposed engaging an HVAC artisan;
  Milo (a separate, dedicated commitment fixture — see below) reasoned Ser
  Emrick the Bellows-smith at $800, over the $350 cap, "the owner's word is
  needed"; Mira reconciled a settlement fixture's invoice at $175 against a
  $350 ceiling, "clear to pay." Every terminal event: `kind: proposed`,
  `actor: agent:<seat>` — never `approved`/`overridden`.

**A real finding from driving Mace, not from reading her.** Her belt was
declared `['read:work', 'read:catalog', 'open:cascade']` and passed every
existing test — `roster.test.ts` checks shape, not sufficiency. The first
time anything actually scoped her `core` to that belt (this session's rig),
she threw: `core.applyEconomySetting is not a function`. Her `run()`
(`makeIntakeClerk`) does not stop at "identified" — it stops at the first
COMMITMENT with a `proposed`, reading the spend gate first — so her belt
needed `propose` AND `read:economy`, not just `open:cascade`. Both added,
with the reasoning kept in the roster's own comment and in
`book/memory/learned.md` ("A belt's manifest is a claim, and only running the
agent through it checks it"). **Nothing about her observable behavior via
`fleet.mjs` changed** — the fleet has always handed every clerk the whole
engine; only a belt-scoped `core` could ever have caught this gap.

**What this session did NOT do, named so nobody assumes it did:**

- `fleet.mjs` and `worker.ts` still read/write the chronicle their own way,
  not through `rig.mjs`'s backings. Migrating them is real work (the live,
  deployed entry points), not done here.
- ~~Only Mace/Milo/Mira are wired.~~ **DONE — eight of ten are now wired and
  driven** (see the entry below). The remaining two cannot be, and the reason
  is a missing BOOK rather than a missing wire.
- Everything Phase-2/3/4/5/6 of `docs/WRIT-THE-KNIGHTHOOD.md` still open
  below is unchanged by this session.

**AN ADVERSARIAL REVIEW OF THE RIG FOUND SIX REAL DEFECTS IN IT. All six are
fixed; each was re-verified against the bytes before it was believed, and the
worst of them was the rig's own central safety claim.**

1. **The claim "no agent can cross the stop" was FALSE.** `open:cascade` grants
   `completeStep`, which bounds-checks and nothing else, so a granted agent
   walks a case straight past a commitment. Proved by driving Mace's own
   scoped core past `assign-vendor` — `next` moved from step 3 to step 4,
   status `awaiting`, no ratification anywhere. The viewer PRINTED that false
   reassurance to the operator, citing the `refuses` list, which nothing reads
   at runtime. **`completeStep` still has to be granted** (Mace legitimately
   completes `report` and `identify`; the audited sweep needs it), so the fix
   is not a refusal but honesty plus legibility: the rig now stamps every
   `done` an agent writes with `actor: 'agent:<seat>'`, and the viewer states
   exactly what holds (no ratification, ever) and what does not (advancing).
   **That stamp closes standing HIGH finding #2** — "an agent-completed step is
   indistinguishable from a human's" — for rig-deployed agents.
2. **A belt tag that enforced nothing.** `read:trade-roster` bound vendor
   functions onto the scoped core; nothing ever read them, because
   `clerks.mjs:21` imports them directly. Stripping the tag was measured to
   change nothing. This is `docs/WRIT-THE-GATE.md` finding 2 re-shipped by the
   session that had just read it. The grant is deleted; the tag stays, now
   declared inert in `DECLARATIVE_TAGS` with a test pinning it both ways.
3. **The enforcement table's freeze was one level too shallow.** `Object.freeze`
   on the object left every array mutable, so any importer could
   `.push('approveStep')` and widen every belt in the process. Deep-frozen.
4. **Four agents carried belts insufficient for their own clerks** (Rhys, Ross,
   Tess, Nell — all read `core.coinCents` without `read:economy`). The same
   class of bug this session had already found on Mace and written up as a
   lesson learned while four more instances sat open. Fixed, and now caught by
   a static scan rather than by a lesson.
5. **Mira's hard rail was unreachable through the rig.** `settlementFixture`
   had a constant subject, and `invoiceFor`'s drift is a hash of the caseId, so
   every settlement fixture landed on the same within-ceiling branch — no
   setting of any parameter could produce `needs-owner-approval`. The one
   parameter that looked like it would (`invoiceCents`) was inert: the clerk
   derives the bill itself and never reads the record, and the default wrote a
   figure into the case that contradicted the one the clerk reconciled. The
   param is gone, the record now carries the derived figure, and `subject`
   steers the verdict. Both verdicts are tested. *Worth knowing:* the ceiling
   is `max(quote, cap)`, so an overrun alone does not hold — the quote must
   also exceed the NTE cap.
6. **`fileBacking` guarded the read path only.** `appendEvents` re-read and
   wrote with no seed check, so calling it directly could write to a seedless
   chronicle on real disk. Both doors now go through one guarded read.

Three smaller ones fixed in the same pass: `run()` defaulted a missing clock to
1970 (now refuses — an invented clock reads as an aging of twenty thousand days,
not as an error); `deploy()` accepted unknown belt tags silently (a typo now
refuses at deploy, where the name is still in front of the reader); and
`memoryBacking.readLog()` handed back its internal document by reference, so
isolation was one-way.

**Still true and NOT fixed:** `rig.mjs`'s own `run()` applies no identity
guard; the viewer and `fleet.mjs` both wrap in `runGuardedModelWork`, but a
direct caller of `run()` gets none. *(The `BeltRefusal` gap listed here is now
closed — see the entry below.)*

**2026-08-07 (last) — eight of the ten agents wired, driven, and the belt
learned to refuse.** All green: `npm run build`, **515 tests**, `leakcheck`
0 findings, `book:lint` exit 0.

- **`BeltRefusal` closes the gap the previous entry left open.** A belt too
  narrow for its judgment is now refused BEFORE the run, naming the missing
  tag — not discovered as a `TypeError` on some domain function partway
  through. Each judgment declares its `requires`, and **the declaration is not
  trusted**: a test scans each clerk module's real `core.<fn>` references and
  fails if `requires` drifts from the bytes. `NoSuchGrammar` is its sibling for
  a judgment whose flow book this repo does not ship.

- **Five more agents wired and driven with live brains** — Lena
  (`lease-renewal/price`), Rhys (`violation-notice/classify`), Tess
  (`move-out-relay/turn-scope`), Nell (`owner-onboarding/intake`), Bea
  (`move-out-relay/deposit-accounting`). Each parks at the exact commitment its
  own `COMMITMENTS` map names, every one stopping at `proposed` with an
  `agent:<seat>` actor. Observed, not inferred: Lena raised a rent to
  $1,721/mo earning a $275 renewal fee (escalated to Tier 2); Bea proposed a
  partial deposit deduction — of $1,647 held, $763 to deductions and $884
  refunded — with "no coin moves until ratified" in its own note.

- **`atStepFixture` replaced five bespoke builders.** It walks the real engine
  to park a case at any named step of any founding flow, and **refuses** a flow
  or step the book lacks rather than parking somewhere else quietly. Proved to
  bite twice: on a nonexistent step, and on a real step held by the right seat
  that is nonetheless not that agent's commitment (`lease-renewal/countersign`
  for Lena) — the case where a weaker fixture would find no work and still go
  green.

- **Ross and Dara are NOT wired, and that is a finding, not a gap.** Their only
  commitments (`lease-violation/verify`, `collections-ladder/assess-late`) live
  in the ~160-step grand-muster library, which is loaded at deploy time and is
  not in this tree. They refuse with `NoSuchGrammar` naming the grammar, and a
  test pins that those flows really are absent from the founding book — so if a
  future book adds them, the test fails and they get wired instead of excused.

- **The reachability check had to include the HOLDER, not just the step key.**
  Every desk clerk gates on `r.next.step.holder === commit.holder`. A first pass
  that matched step keys alone would have called agents reachable whose holder
  the founding book seats differently.

**2026-08-07 (later) — the gate grew hands. Three refusals now exist where there
were none.** All green: `npm run build`, **461 tests** (was 442), `leakcheck`
1,427 files / 0 findings.

Phase 2 of `docs/WRIT-THE-KNIGHTHOOD.md`, in the order the ordering ruling fixed:

- **`silence is authorization` is struck** and `renewal.owner-window` is now
  `human`. The designed escape ceiling rose 33 → 34, which is the honest
  direction: a budget that got cheaper by mislabelling a judgment was not a
  better budget.

- **`mode` is operative.** The advance clerk COMPLETES an `auto` step and sweeps
  consecutive ones on its seat, instead of proposing all 13 to a human and
  booking an unplanned escape for each. **The guard was the real design problem:**
  reusing the existing `stepWaits` would have left **1 of 13** steps runnable
  instead of 8 — it conflates a DEADLINE (`slaDays`) with a DEPENDENCY, and would
  have silently cancelled the feature while every test of it in isolation still
  passed. `awaitsOutside` is the new predicate. Driven end to end: a lease
  renewal runs `draft-offer → send-offer` in one sweep, **stops dead at
  `owner-window`**, later runs `record` — nine human touches become six.

- **A ratification can be refused.** `refusesRatification` moved the guard from
  `canRatify` in the Ledger — a JSX render condition — to where the event is
  minted. Driven in Chromium: a legitimate Approve still lands `approved` +
  `awaiting`, 0 console errors. *The stat tiles do not move across that click and
  that is CORRECT* (both cases still open; step 2 takes step 1's place) — I
  checked the event log before believing the counters.

- **The settlement gate.** Findings 2/3 are about proposals, and chasing them
  found worse: `settlementMoney` — where coin actually moves — **consulted no
  ceiling of any kind.** Now: *coin above the owner-approval cap may not settle
  unless a HUMAN ratified the case.* The second half is free, because no clerk
  may emit `approved`/`overridden`, so the presence of one is proof a person
  looked. Same principle as the struck condition: silence is not authorization.

- **The fiduciary invariant left the test shelf** (finding 1) and now guards
  `settlementMoney`. The test is "does this batch INTRODUCE a breach", not "is
  the book sound" — refusing every write because of an older fault would strand
  the ledger on somebody else's mistake.

**Not claimed:** the settlement gate has **not been observed refusing in the
running app**, only in unit tests — it cannot be reached by the fleet today,
since all eight vendor-dispatch steps share one `human` catalog row. A guard
built ahead of its door, which is the right order, but a green suite is not
evidence it has bitten. **Finding 4 stands** (the calendar window is still never
compared to a date), and `readEscape` is still unscoped by seed.

- **The escape rate is scoped to its muster.** `readEscape` took an optional
  trailing `seed`; both surfaces pass it. Unscoped it averaged a game's cases
  with every pre-muster and hand-worked one — two populations, one number. The
  mark is matched with **`.includes`, never `.startsWith`**: a flow case is named
  `<template>: <subject>`, so a war relay carries the mark **infixed**, and a
  prefix match would score zero flow cases — precisely the ones this measures —
  and fail *silently*, because a rate of `null` reads as "nothing has happened
  yet". There is a test named for exactly that.

**AN ADVERSARIAL REVIEW OF THE SAME DAY'S WORK FOUND TWELVE THINGS. Two were
dangerous and are fixed; ten are open and listed here because they are real.**

Fixed same-day:

- **The sweep was armed against a book nobody audited.** `mayRunUnattended` was
  measured on the FOUNDING books, but `modeOf` reads `doc.catalog`, and
  `deployGrand` swaps in a ~160-step library whose `mode` was authored to mean
  *"a PM shop could in principle automate this"* — not a grant of authority to
  assert the work happened. Driven against it, the clerk completed **unattended**
  a statutory deposit disposition and refund, a late-fee assessment, a rent
  posting, and a **showing** (asserting a physical event nobody observed).
  `awaitsOutside` cannot catch these — none carries a condition, repeat or
  window. The sweep is now gated on `flowsAtFounding && catalogAtFounding`;
  an unaudited book falls back to proposing. **To widen it, audit the loaded
  book's `auto` rows one at a time. Do not relax the check.**
- **The mode flip had not reached the running app.** `data/chronicle.json`
  carries its own catalog and flow shelves, so the stored doc still read
  `mode: "auto"` and `condition: "silence is authorization"`. The browser drive
  could not tell which guard held — and it was the stale condition, not the mode
  flip. **This is exactly the hazard `book/memory/learned.md` already records**
  ("a generated page is not where a running game reads its rules") and it was
  walked into anyway. The books are now deployed to the stored chronicle.

**Open, ranked — none of these is speculative; each names a file:line:**

1. **HIGH — the vault replays an ADVANCING batch.** `src/server/vault.ts:119-132`
   justifies replay-on-conflict because the fleet's output was pure append and a
   duplicate `proposed` is a no-op. That is no longer true. A concurrent human
   ratification can be overwritten by a replayed `done`, marking a step nobody
   saw as complete.
2. **HIGH — an agent-completed step is indistinguishable from a human's.**
   `completeStep`→`answerStep` sets no `actor`, and the engine's own comment says
   a human act carries none. Every swept `done` now reads as the operator's.
3. **MEDIUM-HIGH — the fleet toast counts sweeps as proposals** and offers a road
   to an empty Ledger (`run-fleet.mjs:70` vs `events.ts:264-270`). A dead button.
4. **MEDIUM — `mayRunUnattended` is wired into 1 of 11 clerks**, and
   `harness/res-desk.mjs:65` still proposes an `auto` step; the intake clerk
   completes two `human` steps unconditionally.
5. **MEDIUM — the ratification guard is TOCTOU through `handFlow`**, which reads
   the render snapshot and writes through `mutate`.
6. **MEDIUM — `completeStep` is now the loose door**: bounds-checked only, and
   "Mark done" renders unconditionally.
7. **MEDIUM — the refusal leaves no distinguishable record**, which is the writ's
   own property 2 unmet.
8. **LOW ×4** — dead `overridden` Approve branch; the sweep's audit line names the
   catalog row not the step; and **fixing finding 4 (the calendar window) would
   silently arm unattended owner disbursement**, because that clause in
   `awaitsOutside` is the only thing currently barring it. That coupling needs a
   second gate before finding 4 is touched.

**A verified strike list exists for Phase 5, and it CORRECTED this session's own
writ before anything was deleted:**

- **`src/domain/guilds.ts` must NOT be struck.** It is the Crown Offices plus
  `SEAT_GUILD` — a **holder → office map over the clerk fleet's own desks**
  (`turn-desk`, `acct-desk`, `res-desk`, `bd-desk`, `col-desk`, `viol-desk`, and
  the three queues). That is the desk model the amendment defines. The file says
  so itself, and `knowledge/entities.json` already carries it as
  `entity:founding-guilds-naming-drift`, standing **contested**. **Rename it;
  never delete it.**
- **Four functions in `pods.ts`** (`commissionCaseId`, `placementCaseId`,
  `placements`, `knightsOf`) are the war-game **case-id grammar Reset keys off**.
  They move; they do not die.
- **`tenure.ts` + `tenureMuster.ts` are already dead** — 966 lines, zero
  production importers, held alive by one test file (**−50 tests** when they go).
- **`src/realm/` is largely orphaned**, and `realm-preview.tsx` imports a file
  that was **never committed**. Wave 0 is a zero-breakage deletion.
- **`throne.ts` is clean** — no pods, no guilds — and is already the desk-shaped
  instrument the re-cut of `readRealm.debt` should build on.
- Worst-case blast radius if struck naively: **≈141 of 461 tests**. Deleting
  without retiring the matching `knowledge/*.json` records is a **FATAL** Book
  lint (a `module:` edge whose target is gone).

**Corrected from the plan:** `readFlows` not passing `targetAt0` is **not** a
defect. Nothing records a case's target date, so there is nothing to pass, and a
case with no target correctly reads *no due date* rather than a wrong one.
Wiring it means recording the date first — a feature, not a fix.

**2026-08-07 — the knighthood: LandLord is the agent layer, a fief is a desk, and
the money gate turns out not to refuse.** All green: `npm run build`, **442 tests**,
`leakcheck` 1,412 files / 0 findings, `npm run book` 1,141 pages / 4,472 roads,
`npm run book:lint` **exit 0**, 0 dangling, 1,047 quotes re-verified against disk.

**The frame question below is ANSWERED and struck.** The ruling: *operating
instrument under load, not a video game with score points.* The follow-on reframe
is the bigger news — **LandLord is the AGENT LAYER; the operating records are the
graph and live behind the data gate.** A single-seat platform: one human, a fleet
of agents.

- **`docs/WRIT-THE-KNIGHTHOOD.md` — the canon amended.** King = the one human
  operator. Regent = **the orchestrator agent**, holds no desk. **A fief is a
  DESK** — the flow-book steps sharing one `holder`. Knight/vassal = an agent
  granted a desk; squire = an agent in training, knighted at rung 2 *when its runs
  get boring* (`re-pledge` already models it — no new record). **The delegation
  debt and the escape rate are ONE number.** Struck: guilds, pods,
  knights-as-partners, hamlets, mayors, the two lines, the map — to an archive
  branch, not discarded. Design laws 3–6 untouched; law 5 becomes the literal
  product thesis. `KINGDOM.md` carries the amendment and the four superseded
  sections each say so on their face.

- **The "orchestrator" correction is PAID** (`docs/SIBLING-BOUNDARY.md`). The
  sibling recorded that the wrong noun started here and owed us the fix. Verified
  against the tree: `harness/run-fleet.mjs:49-66` is a sequential `for…of` over a
  fixed roster with a shared `taken` Set — no scheduler, queue, retry,
  backpressure, autonomous trigger, or clock. **A runner, not a control plane**,
  and neither side of the boundary has one. Consequence worth keeping: for as long
  as both projects believed a control plane existed here, neither built one.

- **`docs/WRIT-THE-GATE.md` — the money law is written and nothing enforces it.**
  Five findings, **each re-verified against the bytes, not inherited**:
  `assertFiduciarySound` lives at `test/invariants.ts:161` with a test as its only
  caller; `spendGate` is read at three clerk sites and only ever *words a sentence*;
  the price clerk's `hold` branch and its clear branch call `proposeStep` with
  **identical arguments** (`clerks.mjs:733`) so an over-ceiling invoice is
  indistinguishable in the record; the calendar window is never compared to a date;
  and the only guard before a ratification is a **JSX render condition**
  (`LedgerView.tsx:889`) — `approveStep` checks array bounds and nothing else.
  What guards the money is an air gap, and **an air gap is surface area, not an
  invariant.**

- **The sharp one, and it is ours.** `flows.ts:551` declares `condition: 'silence
  is authorization'` on lease-renewal `owner-window`. `condition` is never
  evaluated, so it is inert today — **but that step is `mode: 'auto'`, one of the
  13.** So the obvious next improvement (make `mode` operative; let clerks complete
  the steps the book says need no person) would, in the natural order,
  **auto-approve spending an owner's money on their silence.** *Ruling: strike
  `silence is authorization` BEFORE `mode` is made operative.* Written down because
  the safe order and the natural order are opposites here.

**The standing rule that gates everything the agent layer is for:** no real data
reaches the fleet until **at least one runtime refusal** exists in it. Not a gate
that reports — a writer that declines, and leaves a different record.

**2026-08-06 (later) — the Book opens as a vault, two labels stopped lying, and a
blocker turned out to be built.** All green: `npm run build`, 442 tests,
`leakcheck` 0, `book:lint` 0 dangling with 1,045 quotes re-verified.

- **The Book is an Obsidian vault.** It already was one without anyone aiming at
  it — wikilinks throughout, frontmatter aliases, typed shelves. What it lacked
  was a config and anywhere to write by hand. `book/memory/` is a shelf the
  compiler cannot sweep (verified byte-identical across a full recompile, not
  assumed), and `CLAUDE.md` now points a session at it — notes nobody is told to
  read are not memory. `.gitattributes` pins LF so a Windows clone does not
  rewrite all 1,138 generated pages as CRLF.
- **`⌘K` is gone from the interface.** Two faults, one after the other. The label
  was Mac-only while the handler had always taken `metaKey || ctrlKey` — the
  worse shape, since the shortcut worked and no PC user would ever have
  complained; they simply never learned it existed. Then the badge came off the
  board entirely (Luke): *"a menu in settings, not on screen — that's forcing
  tutorial throughout the game."* No new surface was needed; `CommandPalette.tsx`
  already declares itself the key map and refuses a second screen repeating it.
- **Write-loss surfacing was already built** — see the retirement note below. Two
  stale candidates in two sessions is now itself recorded as a pattern.

**ANSWERED 2026-08-07 — see the entry above. The ruling is *operating instrument
under load*, and the reframe that followed it (LandLord is the agent layer) settles
the rest: the ribbon's counters and win condition describe a firm that no longer
exists in the model. Kept below only for the reasoning, which was sound.***

~~**Open and unresolved — the frame question.**~~ 2026-08-06: *"the real one
shouldn't be a video game with video game score points."* The ribbon reads
COFFERS · DELEGATION DEBT · PATRONS · ESCAPE RATE · *drive the debt to zero* —
state counters with a win condition. The sibling's command bridge reads
consequences with a date (ESCAPED TO ME · **ABOUT TO BREACH 2026-09-03** ·
DRIFTING · UNTRUSTED). Nothing is decided and nothing was changed. Two things a
next session should know before touching it: the objective line was added
2026-07-29 answering *"once the game starts I'm still not sure what to do"* — the
same need a bridge serves, reached for in game clothing — and `KINGDOM.md:552`
ratifies the **War Game** as deliberately a game, which is separable from the main
board's HUD. *Also: "bridge" names two unrelated things across these projects —
the sibling's command bridge and LandLord's trust/corporate fee bridge. They were
conflated in conversation; they are not the same idea.*

**2026-08-06 — the operational graph, and every governing number made first-class.**
All green: `npm run build`, 413 tests, `node tools/leakcheck.mjs` 0 findings,
`npm run book` 1,106 pages / 4,315 roads, `npm run book:lint` exit 0 with 1,013
quotes re-verified against disk.

What landed, and the check that stands under each:

- **The operational graph exists.** `src/domain/flows.ts` held five real
  workflows and nothing mined them; the manifest had declared an `operational`
  kind since the beginning with nothing under it but whole directories. Now
  5 flows · 46 places · 41 transitions · 41 guards, plus the two knowledge
  shelves they consume (52 catalog tasks, 6 hands — **three of which are queues,
  not people**, which is a finding, not a blank). Read by evaluating the real
  module, not by regex, so a step renamed in code renames its page.

- **A live bug, found by that graph and proven before it was touched.**
  `readFlow` measured every day-offset from the day a case OPENED, but
  `pre-inspection` is written against the tenant's last day. Every move-out case
  carried a step marked BREACHED from day zero, permanently, unclearably.
  `TimingEdge.anchor` fixes it; a target-anchored step with no known date now
  reads **no due date and no breach** — unknown is not overdue. Five regression
  tests, verified by removing the anchor and watching three fail.

- **Two more of the same error.** `move-out-inspection` is the inspection AT
  move-out; `deposit-accounting` and `deposit-transfer` run from SURRENDER, not
  notice — anchoring them to the notice date started the statutory window early.
  All three moved to the target clock.

- **116 governing numbers left the code.** Every SLA, day offset, calendar edge
  and repeat interval now lives in `knowledge/facts.json`, typed
  (`duration-threshold` · `calendar-deadline` · `cadence` · `day-offset`) and
  carrying its anchor. `flows.ts` holds none of them; `withTiming()` joins the
  two at load. **The refactor was proven behaviour-preserving by hashing the
  resolved flow book before and after** — identical. A fatal lint keeps it true.

Corrections made to this repo's own instruments, worth knowing about:

- The cascade check compared steps ACROSS boards. A cascade is not one line —
  it runs parallel tracks, and a deposit step is not "after" a leasing step
  because it sits lower in the array. It compares within a track now.
- The compiler's orphan count did not exclude the contents page while the lint
  did, so the two reported 0 and 70 for the same question. Same rule, both places.
- Orphans are now **classified, not manufactured**: eight pieces of repo
  furniture are declared expected with reasons. The obvious fix — every source
  document linking what was mined from it — is a trap that makes every mined page
  un-orphanable; it was tried and removed in the sibling repo.

**2026-08-06, later — the escape rate, its door, and the failure path.**
All green: `npm run build`, **437 tests**, `npm run book:lint` exit 0 with
**1,037 quotes** re-verified against disk.

- **The escape rate is measured.** `src/domain/escape.ts` — what fraction of
  work reaches a person. It is the number the whole product is judged against
  (21 hr/door/yr × 10,000 doors against one person's ~2,000 hours means ~99% of
  the hours must never reach a human) and nothing here computed it. It reports
  **designed** escapes (steps the flow book means to be human) apart from
  **unplanned** ones (a step marked `auto` that somebody touched anyway),
  because a total that mixes them says the operator is busy and not why.
  It sets **no target** — that would make it unfalsifiable — and reports
  NOT MEASURED rather than 0% over no work.
  It also reports what it rests on: **46 steps but only 39 independent
  judgments**, because `mode` lives on the catalog ROW and all eight
  vendor-dispatch steps share one row.

- **The Ledger got a standing door.** The surface holding that number was
  reachable only by the command bar, a proposal count that exists only when a
  clerk has parked something, and a self-dismissing toast — three conditional
  roads. The rate now rides the ribbon and opens the Ledger. It is a READOUT,
  not a gauge: the measure names no target, and a bar draws a scale with a good
  end and a bad end. Measured cost — one row at 1366px unchanged; **2px of
  ribbon slack left**, so the next thing added there has to take space from
  something, not shave this.

- **A step can fail.** Every event kind was a way forward, so a step that could
  not be completed simply stopped — indistinguishable from one nobody reached.
  `FlowStep.onFail` names where a case goes; `failStep` writes the `failed`
  record and hands that step. **A step with no `onFail` cannot fail** — the
  writer refuses it — so the engine can never strand a case, and the honest
  current state is **46 of 46 unrouted**, printed by the lint every run.
  Which steps may fail, and where each goes, is a design decision nobody has
  made; routing them by guesswork would be inventing forty-six remedies in an
  afternoon. **No remedy taxonomy** — that waits for evidence, and the escape
  rate is what will generate it.

- **Known and stated, not fixed:** the escape rate cannot see rework. A step
  counts once however many times it was worked, so three human attempts read as
  one. Fixing it means deciding a `failed` event implies a person, and nothing
  in the engine says so yet. `FlowReading.failures` counts rework separately in
  the meantime.

**2026-08-06, third pass — the sibling was checked, and it had built the same layer.**
All green: `npm run build`, **442 tests**, `npm run book:lint` exit 0 with 1,042 quotes.

- **A failure route grew two axes.** `onFail` was a step key; it is now
  `{ to, detects, endsAt }`. `detects` is `validation | absence | judgment` —
  whether a machine could ever have caught it, with `judgment` the floor under
  the escape rate. `endsAt` is `origin | operator`, and **only `operator` is an
  escape**. New FATAL: a `judgment` route whose remedy sits on an `auto` catalog
  row asserts two things that cannot both be true.

- **The axes were not invented here.** A read of the sibling project found it had
  reached the same layer **thirty-five minutes earlier the same day**, from the
  opposite direction — drawn out of real procedure rather than out of an engine —
  and landed on the same two axes with the same values and the same judgment
  rule. Adopting them means the two projects' escape numbers are one number
  instead of two wearing one word. **Only the shape crossed**: no instance, no
  evidence, no figure.

- **It cost nothing because nothing was routed.** Widening the field migrated
  zero declarations. The earlier refusal to route the book by guesswork — which
  read as work left undone — is exactly what made the correction free.

- **The escape rate can now see rework.** The blind spot recorded above is
  closed: counting a `failed` event as human attention no longer requires
  assuming a person was involved, because `endsAt: 'operator'` declares it.
  `EscapeReading.escalated` counts per failure, not per step. It is **not folded
  into the rate** — different units; a blended number would answer neither
  question.

- **Found while driving it, and worth knowing:** a route added in code does not
  reach a running game. The chronicle stores its own copy of the flow book and
  the app reads that, so the first drive counted 0 escalations from 2 real
  `failed` events. Correct behaviour, but it means routes will need the same
  deployment path as the catalog — the same surface as the standing
  "deploy the muster" question.

## Next candidates

**Retired from this list 2026-08-07 (third session):** the OLD items 1–3 below
(strike `silence is authorization`, make `mode` operative, make one refusal
real) are **already done** — see the "the gate grew hands" state-of-play entry
above, checked again against the bytes just now (`flows.ts:551` carries
`// STRUCK 2026-08-07`; `makeAdvanceClerk` in `clerks.mjs` calls
`core.mayRunUnattended` and completes swept steps; `settlementGate` guards
`settlementMoney`). This list had not been updated when that work landed —
the exact staleness this file's own discipline warns about ("Two sessions in a
row have now found a 'next candidate' already done"). Renumbered below.

1. **The agent rig, a viewer, and fixtures** — **done this session**
   (`harness/agents/rig.mjs`, `viewer.mjs`, `agents/fixtures.mjs`; see the
   state-of-play entry above). Two follow-ons it opened, real and not done:
   - **Migrate `fleet.mjs`/`worker.ts` onto the rig's backings.** Both still
     read/write the chronicle their own way; the rig sits alongside them,
     proven only on Mace/Milo/Mira through the viewer and tests.
   - **Wire the other seven named agents into `rig.mjs`'s
     `JUDGMENT_FACTORIES`.** Their clerk factories already exist
     (`res-desk.mjs`, `viol-desk.mjs`, `turn-desk.mjs`, `bd-desk.mjs`,
     `col-desk.mjs`, `acct-desk.mjs`); only Mace/Milo/Mira are reachable
     through the rig today.
2. **Two defects that make the governing number lie.** `readEscape` is not
   seed-scoped, so pre-muster and hand-worked cases mix into a muster's rate; and
   `readFlows` (`flows.ts:1301`) never passes `targetAt0` to `readFlow`, so the four
   `anchor:'target'` steps of the move-out relay can never breach — silently undoing
   half of the anchor fix from 2026-08-06.
3. **The Regent** — the orchestrator that replaces the 14-poller roster with
   dispatch. Its measure is **queue depth the human can clear**, never
   throughput.
4. **Segregate the multi-person-firm model** to an archive branch (guilds, pods,
   tenure, the map). Deliberately LAST — deleting rendering code is the cheapest and
   least urgent thing here. `src/domain/realm.ts` is a **rewrite, not a delete**: its
   `debt` reading is the objective and must be re-cut against desks. The economy
   stack **stays whole** — it needs strengthening, not deletion.

Older, still standing:

5. **Multi-tenancy.** One deployment serves one book. Per-identity vault rows are
   a sandbox, not tenant isolation, and nothing should describe them as such
   until they are. This is the gap between "a working app" and "software anyone
   else can use", and `docs/OPEN-QUESTIONS.md` names it too.
6. **Clerk fleet on non-simulated data.** Proven on the war game only. The
   entry condition (one runtime refusal) is met (`settlementGate`), but **not
   yet observed refusing in the running app** — see `docs/WRIT-THE-GATE.md`'s
   own "honest limits" note.
7. **Orphan pages** — decisions and laws nothing in the Book cites. Not
   cosmetic: an uncited decision is one nobody can find, which is how a thing
   gets built twice. (Measured 2026-08-07, this session: 33 unreachable + 8
   declared-expected, up from 21+8 — this session's own test-mined invariant
   pages, e.g. `book/invariants/mace-a-raw-complaint-in-*`, are orphaned the
   same way every prior test file's mined pages already were. `book:lint`
   still exits 0; this is WARN, not fatal.)

**Retired from this list 2026-08-06:** "The Great Book's sources must be re-mined
— until they exist, `npm run book` has nothing to compile." They exist and it
compiles 1,106 pages. That line was stale in exactly the way this file's own
discipline warns about, which is why it is named here rather than quietly deleted.

**Retired from this list 2026-08-06 (second):** "Write-loss surfacing — a losing
write should say so in the interface; today it can be silent." **It already says
so.** The whole path is built: the worker does compare-and-set on `rev` and hands
back the fresh document on 409; the client 3-way-merges rather than overwriting;
and a write that is *refused* or *unreachable* raises a banner naming which of the
two happened, because they call for opposite acts — a vault that answered and said
no will keep saying no, while one that never answered is usually a dropped line.

Checked, not read: `refused` (503) and `unreachable` (aborted connection) each
driven in Chromium. Banner up in both, `role="alert"`, fully inside the viewport,
`elementFromPoint` clean at three points on its face — so it is not merely in the
DOM behind something — and **Try again** genuinely issues another write. The
distinct guidance per failure kind renders as designed.

Two sessions in a row have now found a "next candidate" already done. The pattern
is worth naming: this list is written when work is *proposed* and only revised
when someone thinks to. Check the tree before picking one up.

## What needs a human

Four of the five entries in `docs/OPEN-QUESTIONS.md` are domain decisions no
amount of reading the tree will settle — fee shapes, the spend gate's default
when urgency is unknown, whether "artisan" is a pledge or a relationship, and
trust-accounting rules that vary by jurisdiction.

Raised 2026-08-07 by the knighthood amendment, none of them decidable from this tree:

- **A live cross-repo contract depends on the map.** The sibling emits a bounded
  projection for this repository to render, and its own load-bearing invariant —
  stated in three separate places over there — is that *a visual layer may render a
  projection but may never decide whether a light is green*. Striking the map
  (candidate 6) breaks a consumer that exists. **Renegotiate with the sibling; do
  not delete unilaterally.**
- **The bridge document has one side.** The sibling's copy of the pact points at a
  reconciliation doc in *this* repo, quoting it by line number. **No such file
  exists here** — it was almost certainly removed when this repository went public,
  because it carried the seat map. The ruling of 2026-08-07 (*"the living iteration
  goes private, we build in public"*) finally gives that material a home; whether
  the file is restored there is the owner's call.
- **The archive branch is a decision about reuse, not just cleanup.** The
  multi-person-firm model is being deprecated *because it may be wanted by another
  project*, which is a different intent from deleting it, and it is why candidate 6
  says archive branch rather than `rm`.
