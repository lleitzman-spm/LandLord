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

## A negative claim from a scoped search is not a finding — 2026-08-07

`docs/KINGDOM.md` says the vault keeps an append-only `chronicle_history` recording every write. A
session grepped `src/` and `src/worker.ts`, found nothing writing it, and concluded **the
constitution was asserting a safety net the tree did not build.** That conclusion was written into
`docs/OPEN-QUESTIONS.md`, into `docs/HANDOFF.md`, and into a commit message — as a finding, with
confidence — before anyone looked in `supabase/`.

The table is real. `supabase/migrations/20260722_chronicle_history_identity.sql` defines an `AFTER`
trigger on `chronicle` that inserts the whole document on every write. The canon was right the whole
time. **The application code does not write it because a database trigger does**, which is precisely
the kind of place a scoped grep does not reach.

The general form, and it is the inverse of the one already on this shelf: an unchecked explanation is
durable, and **an unchecked NEGATIVE is worse**, because "X does not exist" reads as a discovery
rather than an absence of looking. Presence can be proved by one hit; absence cannot be proved by one
search. Before writing down that something is missing, say out loud where it WOULD live if it
existed — schema, migrations, infrastructure, another repository — and look there.

It also came within one question of doing real damage: the operator had made an automation ruling
conditional on that audit trail, and was told the trail did not exist. The correct answer was that
their condition was already met.

## The session that read the gate writ then re-shipped its central fault — 2026-08-07

A session spent its first hour reading `docs/WRIT-THE-GATE.md`, whose finding 2 is *"it is not
unused — which is worse than unused, because a gate that is read reads as protection. Nothing
branches on it."* It then built a capability rig and put **three** of exactly that in it: a belt tag
(`read:trade-roster`) that bound functions nothing read, a freeze one level too shallow to freeze
anything that mattered, and a printed reassurance to the operator — *"no tool could cross this"* —
that was false, proved by driving the agent's own scoped core straight past the commitment.

Reading a failure mode does not inoculate you against it. The writ describes a shape that is
**cheap to build by accident**, and the accident is not committed at the moment you write the
decorative line — it is committed at the moment you *believe your own manifest instead of running
it*. All three survived a green build, a green suite, and a hand-written test file specifically
about capability enforcement, because every one of those checks read the same table the code did.

What actually caught them: a reviewer with no stake in the design, asked to prove the claims false
rather than confirm them, who instrumented the running agent instead of reading the source. **The
check has to come from outside the assumption.** A test written by the author of a guard tends to
test the guard's own vocabulary.

## A belt's manifest is a claim, and only running the agent through it checks it — 2026-08-07

`harness/agents/roster.mjs` declared Mace's belt as `['read:work', 'read:catalog',
'open:cascade']` — a manifest that read as complete and passed every existing test
(`roster.test.ts` checks shape, not sufficiency). It was wrong twice over, and
neither gap showed until the agent rig (`harness/agents/rig.mjs`) actually scoped
her `core` to those tags and *ran* her: her clerk (`clerks.mjs` `makeIntakeClerk`)
stops at a `proposed` commitment, which needs `propose`; and that proposal reads
the spend gate first, which needs `read:economy` (`core.applyEconomySetting is not
a function`, thrown mid-run — nothing before this session had ever restricted her
`core` to her declared belt, so the gap was invisible to every prior check).

The general shape: a capability manifest is only as honest as the narrowest thing
that has ever tried to exercise it. **Verify claims against the bytes** now has a
second reading: verify a capability declaration by constructing the narrowest
thing that would fail if it were wrong, not by reading the declaration and nodding.

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

## ~~`file` is not a decoder~~ — the diagnosis was wrong — 2026-08-06, corrected 2026-08-07

This said a leak check flagged a `.ts` source as binary because it was "valid UTF-8 with a dense run
of em-dashes and middots in its header," and concluded the cost was a reviewer's attention spent on
nothing.

**The file contains a literal NUL byte** (`src/domain/escape.ts:176`, offset 9312) — a deliberate
map-key delimiter. `file` classified it correctly. The reviewer's attention was not spent on nothing;
it was spent on the one real control byte in the tree, which is exactly what that column is for.

Nothing was broken by the wrong diagnosis, and that is the point worth keeping: **a plausible
explanation that is never checked survives, gets written down, and is then cited.** It took a third
session actually running `open(...,'rb').read().find(b'\x00')` to find out — one line, against a
note that had already been ratified twice.

The general form: **when you explain away a tool's warning, check the bytes before you write the
explanation down.** An unchecked explanation is more durable than the warning it dismisses.
