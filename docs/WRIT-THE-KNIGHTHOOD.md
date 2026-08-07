# Writ — The Knighthood: one seat, a Regent that is an agent, and the fief as a desk

*Ratified 2026-08-07. This writ records the model; `docs/KINGDOM.md` is amended to match and the
code follows after. Nothing below is built yet — it is written down first, because the last two
times a stale structure met a new one it was found by a user clicking a dead button.*

---

## The collision this writ resolves

Twice now the kingdom has answered the question *what does a lord hold?* — and both answers were
built for a company with an org chart.

- **First: a fief was a DEPARTMENT.** Property Management, Leasing, Legal, Technology. Dissolved by
  the REFOUNDING (`docs/WRIT-THE-BROKERAGE.md`, 2026-07-27) because a department is not land and the
  tool that calls itself *LandLord* had no land in it.
- **Then: a fief was a BOOK OF DOORS** — a portfolio, held by a knight who was an equity partner,
  with owners inside it and guilds cutting across. That is a real shape, and it is the shape of a
  firm with partners, pods and functions.

**LandLord is not that firm.** It is a **single-seat property-manager platform**: one human, and a
workforce of agents. A single seat has no org chart, so neither answer fits, and choosing between
them felt like a rollback in whichever direction you went.

The third answer is neither.

## What LandLord is

> **LandLord is the AGENT LAYER. The operating records are the GRAPH, and they live elsewhere.**

This is not new law so much as law finally said plainly. The boundary agreed with the sibling
project on 2026-07-22 already assigns this repository *the seat model, the task-language, the money
invariants, the propose-only ratchet, the audit ledger, and the simulation* — and assigns the real
rails, the bindings and the client's own records to the other side of the wall. What changes today
is that the kingdom's **vocabulary** stops describing a firm and starts describing the workforce.

---

## A fief is a DESK

**A fief is a slice of the work, defined by the flow book itself.**

Not a department: a department owns headcount and budget. Not a portfolio: a portfolio is the
graph's, not ours. A **desk** is the set of steps in the flow book that share one `holder`, and the
flow book already declares them — six in the founding book, more in a loaded one.

This is not a rollback to fief-as-department. It is the opposite of one. A department is an org unit
that work is *assigned to*; a desk is **defined by the work** — which was the REFOUNDING's own
complaint about departments, honoured rather than reversed.

**The evidence was already on the board.** The Book compiler reported the founding flow book as
*"6 hands — three of which are queues, not people, which is a finding, not a blank."* Half the
kingdom's fiefs stopped being people some time ago. Nobody noticed, because the canon had no word
for a holding that was never a person's in the first place.

A desk exists whether or not an agent holds it — design law 3, untouched. An empty desk is data.

---

## The knighthood — who holds what

| Pledge | Meaning under the agent layer |
|---|---|
| **King** | **The single human operator.** The one seat. The kingdom is theirs. |
| **Regent** | **The orchestrator agent.** Holds no desk. Routes the work and escalates to the King. |
| **Knight / vassal** | An **agent granted a desk** by deliberate, recorded act. The knighthood is the fleet. |
| **Squire** | An **agent in training**. Pledged to a desk's holder, not to the desk. Reads and drafts; does not act. |
| **Artisan** | An **outside hand** — a hosted model, a third party's system. Works the land, never holds it. |
| **Keeper** | An outside hand running a desk that has no trusted vassal. Amber, exactly as before. |

**King and Regent are no longer two people, because they were never two seats — they were two
halves of one job.** The King decides; the Regent routes. Now the routing half is a machine, and the
deciding half is the only human in the kingdom.

**The Regent holds no desk, and that is the point.** The constitution's sharpest line about the
office survives verbatim: *the Regent manages what he does not hold.* An orchestrator that also
executes is a bottleneck wearing a crown. It dispatches; the knights do the work.

### The trust ladder — how a squire is knighted

An agent is not handed a desk on the day it is built. It climbs:

| Rung | What it may do |
|---|---|
| **0 — read** | Observe the desk's work. Produce nothing. |
| **1 — draft** | Propose. Every act parked for the King's word. |
| **2 — act within limits** | Complete the steps the book declares need no person; still propose at every judgment. |

**A squire is rung 0 and 1. Knighting is the promotion to rung 2, and it is earned rather than
granted on faith — an agent is knighted when its runs have become boring.** The kingdom already has
the machinery: `re-pledge` (a squire knighted a vassal) is a ratified life-cycle act and needs no
new record. The word was waiting.

**No rung reaches the ratchet.** No knight, at any rung, ever emits `approved` or `overridden`.
That mark is the King's alone, and it is what makes the whole arrangement an augmentation rather
than a replacement.

---

## The four states, re-read

Unchanged in mechanism, and now pointed at the workforce. Still computed from records, never stored.

1. 🟢 **Lorded** — a knight holds the desk and the work does not come back. Healthy.
2. 🟢 **Held in plurality** — one knight holds several desks by explicit grant. Legitimate. Watched.
3. 🟡 **In regency** — an outside hand keeps the desk, or a knight works it but the work keeps
   escaping to the King. The work gets done, but not by a trusted hand and not without cost. Amber.
4. 🔴 **In stewardship** — no agent. **The King is doing it personally.** Red, and this is the state
   the whole instrument exists to hunt.

## The debt and the rate are ONE number

The kingdom has been carrying two instruments that measure the same thing from opposite ends:

- **The delegation debt** — desks with no agent. Counted from the org side.
- **The escape rate** (`src/domain/escape.ts`) — what fraction of the work reaches a human. Counted
  from the work side.

**They are one quantity: how much of the operation is still the King's own hands.** A desk with no
knight and a step that reached the King are the same failure at two altitudes — a seat with no
holder, and a box with no seat.

Design law 5 — *"any time someone is doing a job they should be delegating, the board says so"* —
stops being a metaphor. It is now the literal thesis of the product, and the number that expresses
it is the one the whole thing is judged against.

The reading keeps its existing honesty and gains none of the old debt's looseness: it still sets no
target, still reports **designed** escapes apart from **unplanned** ones, and still says NOT
MEASURED rather than 0% over no work.

---

## What is struck, and why

Each of these modelled a company with an org chart. A single seat has none.

| Struck | Why |
|---|---|
| **Guilds** | A cross-cutting function needs departments to cut across. There are none. |
| **Pods** | A partner's book of owners. There are no partners. |
| **Knights as equity partners** | The word is kept; the meaning is now an agent holding a desk. |
| **Patrons as a knight's book** | Owners belong to the graph. The agent layer holds no owner records. |
| **Hamlets and mayors** | Sub-territory with local leadership — an org shape, twice over. |
| **The two lines of rule and trade** | Both lines described how humans outrank humans. One seat, no ladder. |
| **The realm map** | Scenery for a realm that no longer has territory to draw. |

**None of it is deleted from history.** It goes to an archive branch, whole and graftable, because
a shape built for a multi-person firm is exactly right for a multi-person firm and may be wanted by
one later. Deprecating is not discarding.

## What survives untouched — and must not be quietly reopened

- **Design law 3** — an empty desk is data, not an error.
- **Design law 4** — authority exists only through recorded acts. A knight holds a desk because a
  grant says so; the absence of one is debt, not an implicit holding.
- **Design law 5** — the system hunts delegation debt. Now the literal product thesis.
- **Design law 6** — the act stands beside the record it changes.
- **Records in, readings out.** No status field. Every state above is folded, never stored.
- **The append-only log.** A correction is a reversing event, never an edit.
- **The propose-only ratchet.** `proposed → awaiting → approved / overridden`, and no agent crosses it.

---

## What this writ does NOT decide

Recorded here so the next session does not mistake silence for a ruling.

1. **The Regent is not built.** What exists today is a **runner** — a sequential loop over a fixed
   roster with a shared de-duplication set. No scheduler, no queue, no retry, no autonomous trigger,
   no clock. The word *orchestrator* has been used for it in both this repository and the sibling's,
   and it was wrong in both. `docs/SIBLING-BOUNDARY.md` now records the correction.

2. **A clock must not come before the auto steps run themselves.** A clock over a propose-only fleet
   **piles up; it does not progress** — an unattended tick produces `awaiting` and nothing else until
   a human ratifies. The founding book already declares **13 of its 46 steps `auto`**, and every one
   of them is currently *proposed to a human anyway*. Until that is fixed, a Regent with a clock
   builds nothing but a longer queue. The measure of a Regent is **queue depth the King can clear**,
   never throughput.

3. **The money gate does not refuse.** See `docs/WRIT-THE-GATE.md`. Until at least one runtime
   refusal exists, no real data may reach the fleet — and that is the entry condition for everything
   the agent layer is for, not a chore beside it.

4. **A live cross-repo contract depends on the map.** The sibling emits a bounded projection for
   this repository to render, and its own invariant is that a visual layer may render a projection
   but may never decide whether a light is green. Striking the map breaks a consumer that exists.
   **Renegotiate it; do not delete it unilaterally.**
