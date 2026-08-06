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

## Company material has no home

The private repository this project forked from was deleted. There is now no private repository in
the account, so anything that cannot be public has nowhere to live. One correction to the sibling
boundary document is stranded because of it.

Until a private repository exists, the answer to "where does this go" is sometimes *nowhere*, and
the honest move is to say so rather than quietly widen what counts as public.

## `escape.ts` reads as binary to `file`

`tools/leakcheck.mjs` flags `src/domain/escape.ts` for human review as binary content. It is valid
UTF-8 and always has been; `file` is defeated by the density of typography in the header comment.
Harmless, but it will keep flagging until someone thins the comment or the check learns to decode
before it judges.
