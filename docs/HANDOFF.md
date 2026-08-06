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

Unclaimed and roughly ordered by how much they unblock:

1. **Multi-tenancy.** One deployment serves one book. Per-identity vault rows are
   a sandbox, not tenant isolation, and nothing should describe them as such
   until they are. This is the gap between "a working app" and "software anyone
   else can use", and `docs/OPEN-QUESTIONS.md` names it too.
2. **Write-loss surfacing.** Writes are whole-document upserts and last writer
   wins. A losing write should say so in the interface; today it can be silent.
3. **Clerk fleet on non-simulated data.** Proven on the war game only.
4. **Twenty orphan pages** — decisions and laws nothing in the Book cites. Not
   cosmetic: an uncited decision is one nobody can find, which is how a thing
   gets built twice.

**Retired from this list 2026-08-06:** "The Great Book's sources must be re-mined
— until they exist, `npm run book` has nothing to compile." They exist and it
compiles 1,106 pages. That line was stale in exactly the way this file's own
discipline warns about, which is why it is named here rather than quietly deleted.

## What needs a human

Four of the five entries in `docs/OPEN-QUESTIONS.md` are domain decisions no
amount of reading the tree will settle — fee shapes, the spend gate's default
when urgency is unknown, whether "artisan" is a pledge or a relationship, and
trust-accounting rules that vary by jurisdiction.
