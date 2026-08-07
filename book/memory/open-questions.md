---
type: "memory"
title: "Open questions"
standing: "note"
origin: "hand-written"
aliases:
  - "open-questions"
---

# Open questions

*Waiting on a ruling. When one is answered, put the answer in its source, recompile, and strike
the row from here.*

← [[00 MEMORY]]

## The flow book cannot produce the most expensive escape the business has

`vendor-dispatch` runs `assign-vendor → dispatch` with **no stop at the spend cap**. The sibling
project's evidenced work-order net has that wait, and its single biggest escape is an above-cap
estimate the owner never answers — with no timeout and no chase on either side.

So our model cannot currently produce the failure that costs the most. Adding the gate is a change
to what the business *does*, not to what the code does, which is why it is here and not done.

## Forty-six steps have no failure route

`onFail` now carries `{ to, detects, endsAt }` and nothing declares it. Routing a step is a claim
about how the work actually fails, and guessing forty-six of them would produce forty-six rows to
revisit. The sibling has 19 remedies drawn from real procedure covering four of our five flows —
shapes, which the boundary permits crossing. Adopting them is a session's work once someone says go.

**Note the shape of this one:** declining to guess is what made the `onFail` widening cost nothing
when it came. Zero declarations meant zero migrations. See [[learned]].

## ~~Company material has no home~~ — ANSWERED 2026-08-07

The ruling: **the living iteration goes private; we build in public.** This repository stays the
public engine and canon; the running instance bound to real records is private, and that is where
anything which cannot be public lives.

What it unblocks, now carried in `docs/HANDOFF.md` under *What needs a human*: the sibling's copy of
the pact points at a reconciliation document in this repo that **does not exist** — removed when
this went public, because it carried the seat map — and it can now be restored on the private side.

*Left standing on purpose:* the ruling names a destination, not a migration. Nothing has moved yet.

## ~~`escape.ts` reads as binary to `file`~~ — DIAGNOSED WRONG, corrected 2026-08-07

The old entry said the file was valid UTF-8 and that `file` was "defeated by the density of
typography in the header comment." **That was wrong, and it was wrong twice — [[learned]] carried
the same mistaken diagnosis.**

`src/domain/escape.ts` contains a **literal NUL byte**, at offset 9312, line 176:

    const id = `${e.caseId}\x00${e.catalogRow}`;

It is a deliberate delimiter — a separator that cannot occur inside a case id, so the dedup map
cannot collide `"a b" + "c"` with `"a" + "b c"`. It is the only control byte in the file.

So `file` was RIGHT and the scanner is behaving correctly; there is nothing to fix in either. What
needed fixing was the note. **Two sessions asserted a cause without opening the bytes** — in a
repository whose own standing rule is *verify claims against the bytes*, about the one file its
hygiene scanner keeps pointing at.

The live hazard now is the opposite of the one recorded: **do not let an editor "clean" line 176.**
Retyping it as a space silently reintroduces the collision.
