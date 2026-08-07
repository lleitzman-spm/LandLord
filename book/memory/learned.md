---
type: "memory"
title: "Learned"
standing: "note"
origin: "hand-written"
aliases:
  - "learned"
---

# Learned

*Things that cost something to find out, kept so they cost it once. Newest first.*

← [[00 MEMORY]]

## The safe order and the natural order were opposites — 2026-08-07

The founding flow book declares 13 of its 46 steps `auto`, and the fleet proposes every one of them
to a human anyway. The obvious fix is to make `mode` operative and let the clerks complete them.

One of those 13 is lease-renewal `owner-window`, and it carries `condition: 'silence is
authorization'`. So the obvious fix, done in the obvious order, **auto-approves spending an owner's
money on their silence.** It is inert today only because `condition` is never evaluated.

Nothing was wrong with either piece. The hazard lived in the *sequence*, and the natural reach — fix
the thing that is plainly broken first — is the one that builds the loss. **When two safe-looking
changes compose into an unsafe one, the ordering is the finding; write it down as a ruling, because
the next session will reach in the natural order too.**

## `leakcheck` scans TRACKED files — a new file is invisible to it — 2026-08-07

Two new documents were written, `node tools/leakcheck.mjs` was run, and it reported **0 findings
over 1,410 files** — the identical count as before the documents existed. It had never read them.
The scan walks the git index; an untracked file is not in it.

The output does not lie and does not warn, because from the scanner's side nothing happened. `git
add` first, then scan: the count moved to 1,412 and the files were genuinely covered.

**A clean result from a tool that never saw the input is the most convincing wrong answer there
is** — and this repository's whole hygiene posture rests on that one command.

## A generated page is not where a running game reads its rules — 2026-08-06

A failure route added in `src/domain/flows.ts` did not reach a game already in progress. The
chronicle stores **its own copy** of the flow book, so the first drive counted zero escalations from
two real failures, and the code was correct the whole time.

This is the records-in/readings-out rule biting from the other side: state is computed from records,
and the records carry the rules they were played under. Anything that changes the catalog or the
flow book needs a deployment path to existing chronicles, not just a commit.

## Refusing to guess made a later change free — 2026-08-06

`onFail` was widened from a bare step key to `{ to, detects, endsAt }`. The migration cost was zero,
because nothing had been routed yet — an earlier session had declined to guess-route forty-six steps
and that had read, at the time, as work left undone.

It wasn't. Forty-six guessed routes would have been forty-six rows to find and rewrite, each one a
small chance of preserving a wrong guess by hand. **Unmade decisions are cheap to change; that is
the whole reason to leave them unmade when the evidence is not in yet.**

## Two sessions built the same layer thirty-five minutes apart — 2026-08-06

The sibling project shipped a failure vocabulary at 06:18 UTC; this one shipped its own at 06:53.
Neither knew. The boundary between the projects was agreed on 2026-07-22, when *neither had a
process model*, so the table simply had no row for one — and a boundary table with a hole in it is
what a double-build looks like before it happens.

Recorded as a rule in `docs/SIBLING-BOUNDARY.md` (outside the Book, so no wikilink): **read the sibling's recent commits before starting
anything structural.** The two repositories move fast enough that a week-old memory of who owns what
is already wrong.

It also produced a vocabulary split worth remembering: both projects measured against the same
one-operator/ten-thousand-door bar and used the word *escape* for different quantities — a rate over
steps here, a count of operator-terminated repairs there. Same word, same bar, different number.
Reconciled at `endsAt`.

## `file` is not a decoder — 2026-08-06

A leak check reported a `.ts` source as binary needing human review. It was valid UTF-8 with a dense
run of em-dashes and middots in its header. Any check that classifies before it decodes will do this,
and the cost is a reviewer's attention spent on nothing.
