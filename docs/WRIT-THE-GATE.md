# Writ — The Gate: the money law is written and nothing enforces it

*Recorded 2026-08-07. Not a design document — a finding, with the check that stands under each
line. Every claim below was **verified against this tree**, not inherited. The audit that prompted
it came from the sibling project; the counsel was good and the reading is ours.*

---

## The finding, in one line

**The kingdom's money law is well specified and has no runtime enforcement whatsoever.**

What protects the money today is an **air gap** — the harness's tool belt simply has no money door.
And an air gap is *surface area, not an invariant*: an invariant refuses; surface area merely has
not been reached yet.

This matters now, and did not before, because the agent layer's whole purpose is to let agents
operate real records (`docs/WRIT-THE-KNIGHTHOOD.md`). The moment a hand reaches the door, the gap
is the loss.

---

## The five, each with its check

### 1. The fiduciary invariant is a test helper

`assertFiduciarySound` is defined at `test/invariants.ts:161`. Its only caller is
`test/fiduciary.test.ts:18`. **No writer in `src/` or `harness/` passes through it.** The kingdom
proves its books balance in CI and never once asks the question at the moment coin moves.

### 2. `spendGate` returns a struct that cannot fail

`spendGate` is consulted in three places — `harness/clerks.mjs:309` (intake), `:507` (vendor),
`:1007` (advance). In every one, the result is used to **word a sentence**:

```
harness/clerks.mjs:508-515   gate.needsApproval selects capLine, a string
harness/clerks.mjs:516-517   note = `... ${capLine}`  →  proposeStep(..., { note })
```

It is not unused — which is worse than unused, because a gate that is read reads as protection.
Nothing branches on it. Nothing refuses.

### 3. The "hard rail" emits an identical event on both branches

The settlement reconciliation (`src/domain/economy.ts:536`) correctly returns
`'clear-to-pay'` or `'needs-owner-approval'`. The price clerk then computes `hold`
(`harness/clerks.mjs:722`) — and both branches call:

```
harness/clerks.mjs:733   core.proposeStep(r.template, r.caseId, r.next.index - 1, `agent:${seat}`, { at, id, note })
```

**The same event kind, the same step, the same actor. Only `note` differs.** The `verdict`
(`:737`) goes to the console records, never to the log. An invoice that overruns its authorized
ceiling and one that sits comfortably under it are **indistinguishable in the record**, which is the
only thing that survives the run. The rail is a label, not a branch.

### 4. The calendar window is decorative

`onOrAfterDayOfMonth` / `beforeDayOfMonth` are loaded from the facts at `src/domain/flows.ts:262-267`
and read in exactly two places: `stepWaits` (`:677-678`), which only asks *does this step wait at
all*, and a description string (`:693-695`). **Neither is ever compared to a date.** The generalized
form of the month-start freeze — the rule that the books are not touched while they are being
closed — parks a step and then lets it through on any day of the month.

### 5. The only guard before a ratification is a render condition

`approveStep` (`src/domain/flows.ts:916-928`) validates exactly one thing: `index < 0 || index >=
tpl.steps.length`. Array bounds. It does **not** check that the step is awaiting anything, that a
proposal exists, or that the case is open.

The sole check that a step is ratifiable is `src/LedgerView.tsx:889`:

```
const canRatify = s.kind === 'awaiting' || s.kind === 'proposed';
```

**That is a JSX render condition.** It hides a button. Any script, any agent, any future route, any
replay reaches the writer directly and the writer agrees.

---

## The sixth, which is ours and is the sharp one

`src/domain/flows.ts:551` declares, on the lease-renewal **`owner-window`** step:

```
condition: 'silence is authorization'
```

`condition` is **never evaluated anywhere** — it feeds `stepWaits` (`:680`) and prose (`:723`,
`:725`) and nothing else. So today it is inert, and the step is correct in a simulation where
nobody's money is real.

**But `owner-window` is `mode: 'auto'`, and it is one of the thirteen.** The founding book declares
13 of its 46 steps `auto`; all 13 sit on advance-clerk seats; and the fleet currently proposes every
one of them to a human anyway.

So the obvious first improvement — *make `mode` operative, let the clerks complete the steps the
book says need no person* — would, done in the obvious order, **automatically treat an owner's
non-response as authorization to spend that owner's money.** The step would run itself, on a clock,
with no human in it, exactly as declared.

**Sequencing ruling: `silence is authorization` is struck before `mode` is made operative, not
after.** This is written down because the safe order and the natural order are opposites here, and
the natural order is the one a session reaches for.

---

## The standing rule

> **No real data reaches the fleet until at least one runtime refusal exists in it.**

Not one gate that *reports*. One writer that **refuses** — that declines to emit, and says why.
Until then, "the agents can operate the graph" is a sentence about surface area.

This is the entry condition for the agent layer, not a chore beside it. Everything in
`docs/WRIT-THE-KNIGHTHOOD.md` about knights holding desks over real records stands behind it.

## What a refusal has to look like

Three properties, so the next session does not build a fourth reporting gate by accident:

1. **It refuses at the writer, not at the view.** The check belongs where the event is minted, so a
   script and a button are governed by the same rule.
2. **It leaves a different record.** A refusal that emits the same event with sadder prose is
   finding 3 again. Held and cleared must be distinguishable by a reading, not by a human reading.
3. **It fails closed.** The precedent is already in this tree and it is the right one:
   `src/domain/contextGuard.ts` **throws rather than redacting**, on the reasoning that a clerk
   reasoning on silently-altered evidence is worse than a clerk that stops. The money gate inherits
   that posture.

## What is NOT claimed here

- **No loss has occurred.** Every one of these sits behind the air gap, on simulated data. This is a
  writ about what happens when the gap closes, which is the thing we are deliberately doing.
- **No timeline.** The order is fixed (§ sixth, above); the schedule is not.
- **The books themselves are sound.** The posting catalog makes commingling structurally impossible
  and the invariants pass. The defect is that nothing consults them at the moment of writing.
