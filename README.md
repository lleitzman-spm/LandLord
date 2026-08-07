# The multi-person firm — archived, not deleted

This branch is an **orphan**: it shares no history with `main`, and nothing is
built or tested from it. It exists so a model that was deliberately retired can
be found and grafted, rather than only recovered by someone who already knows
which commit to look behind.

## What is here

The tenure hierarchy — the property model LandLord used while it was an
instrument panel over a firm with **many people in it**.

| File | What it holds |
|---|---|
| `src/domain/tenure.ts` | `Realm` → `Shire` → `Fee` → `Door`, plus `Edict`, the shire-standing reading, and `FOUNDING_TENURE`. |
| `src/domain/tenureMuster.ts` | Mustering doors from an estate roster, and the reasons a door goes unplaced. |
| `test/tenure.test.ts` | Its whole suite. It passed on the day it left. |

## Why it left

LandLord was reframed as the **agent layer**: one human operator and a
knighthood of agents, where a *fief is a desk* — the flow-book steps sharing one
`holder` — and delegation debt is the escape rate. See
`docs/WRIT-THE-KNIGHTHOOD.md` on the working branch.

The tenure model answers a different question. Its shire standing counts
`SHIRE_MIN_KNIGHTS` and headless crafts; `knightsOfShire` returns *people*. That
is an org chart over a firm with staff to place — coherent, tested, and simply
not what the product is now. Nothing in the running application imported either
module: the app read `src/domain/realm.ts`, which shares five letters with
`tenure.ts`'s `Realm` and means something else entirely (one is a place, one is
a score — that collision is called out in `realm.ts`'s own header, deliberately
un-renamed because a rename is a migration on every stored document).

## Why archived rather than dropped

The retirement removed the *multi-person firm*, which is a real shape that a
different product might want whole. Scenery struck alongside it — the 3D realm
and the 3D war table — got no branch, because the design survives in
`docs/WRIT-THE-REALM-MAP.md` and `docs/WRIT-THE-WAR-TABLE.md` and the code is
not waiting to come back. This is.

## Grafting it back

    git checkout archive/multi-person-firm -- src/domain/tenure.ts

Then read it before trusting it. Two things it assumes that the working branch
no longer does: that a *fief* is a territory rather than a desk, and that the
board is drawn on generated land. On the second, the working branch's rule
stands and should travel with the code — **generated land may never be presented
as a finding.** A gap or cluster drawn on invented terrain says nothing true
about drive time or concentration risk.

## The rule that follows it here

No real personal data and no credential may enter this repository, on any
branch. The demo cast, `example.com` addresses and `555-01xx` telephone numbers
only. `npm run leakcheck` on the working branch scans the git index; it does not
scan this branch, so anything grafted **out** of here gets scanned on the way
in, and nothing may be added **to** here without the same care.
