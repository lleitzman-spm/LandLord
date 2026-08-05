# Writ — the Muster Library and the Intro Campaign

*Drafted 2026-07-27 in answer to two questions Edwin asked in the same breath:
"redesign that first muster as an **intro campaign** that helps a user learn how
to be a **successful LandLord**", and "maybe a good time to think of a **muster
library** — but I worry that with all the additional changes we're likely to
make it'll butcher the musters and they'll have to be remade entirely."*

*They have one answer underneath them, so they are one writ.*

---

## I. The worry, answered: a muster is a RECIPE, not a RECORDING

Edwin's worry is exactly right about the thing he is worried about, and the
kingdom already dodged it — by accident of good architecture, not by plan. Worth
writing down before someone builds the library the wrong way.

**What a muster is today.** `generateGrandMuster({ seed, end, flows, catalog,
economy })` deals a whole operation from a seed against **the setting as it
stands right now**. It stores nothing. Redeploy the same seed against a changed
catalog and you get a muster that fits the changed catalog. The events are
*computed*, exactly as every reading in this kingdom is computed.

**So the library must store recipes, never event logs.** The distinction is the
whole answer:

| | Rots when we change things | Why |
|---|---|---|
| A dumped **event log** (or a saved chronicle doc) | **Yes, silently** | Its events name catalog rows, flow keys and step keys that a rename quietly orphans. It looks fine and is wrong. |
| A **recipe** — a seed plus a declared shape | **No** | It is re-dealt against whatever the setting is. A renamed step is a step the recipe re-reads by its new name. |

This is the constitution's own law one level up: **records in, readings out**.
Store the intent; compute the muster. The library is a shelf of *intents*.

**The one real failure mode, and its guard.** A recipe that NAMES specifics — "an
eviction must stand at step 5 of `legal-eviction`" — breaks when that name
changes. That is the stringly-typed-contract fault this codebase has now shipped
five times (the command bar, `keepOf`, the household's dead territory ids, the
merge sentinel, `renewal_fee`). It is not a reason to avoid naming things. It is
a reason to **check the names at build time**:

> **The library resolution test.** Every scenario in the library is generated
> against the founding setting, and every catalog row, flow key, step key and
> seat it names must resolve. A rename that would butcher a scenario **fails the
> build**, loudly, instead of dealing a broken muster quietly.

With that test, the library is safe to grow now and cheap to keep. Without it,
Edwin's worry comes true on the first rename. **Nothing goes on the shelf that the
test does not cover.**

**What is genuinely NOT worth doing:** freezing a muster to preserve it. A frozen
muster is a fossil of a setting we no longer run, and it will teach a new user
the old kingdom. If a scenario cannot survive being re-dealt, the scenario was
describing our implementation rather than our operation, and it should be
rewritten, not pinned.

---

## II. Why the first muster cannot be the first thing a user sees

Edwin: *"I think the initial Muster was based on the data we just happened to
provide it as a sample."* That is right, and the playthrough of 2026-07-27
measured what it costs:

- **~200 doors, ~520 flow instances, 20 raw intake** dealt at once.
- **555 of 560 open items read "stuck > 7d" at week one** — oldest 61 days. The
  backlog arrives already stale, so the aging gauge is saturated before the
  player has done anything, and reads identically whether they play well or
  ignore the board entirely.
- **322 cases awaiting a human.**
- **Structurally insolvent from deploy** — $18,200/mo upkeep against $13,680
  tribute. The player is losing from turn one with no lever they have been shown.

None of that is a bug. It is a **stress test**, and it is an excellent one — it
is how the fleet, the Ledger and the economy got proved. It is simply not a
lesson. A first run should be legible; this one is a wall.

**So the grand muster stays, unchanged, as the stress test.** The intro campaign
is a second, smaller thing beside it — not a replacement.

---

## III. What "a successful LandLord" actually means, in this kingdom's own terms

A campaign can only teach what the machine already measures. The machine measures
two things, and they are causally linked:

```
      neglect a door  →  the patron's faith falls  →  the patron withdraws
                                                              │
                                                              ▼
   the coffers run dry  ←  tribute falls  ←  their doors leave the rolls

      delegate the work  →  a clerk proposes  →  you ratify  →  the work closes
                                                              │
                                                              ▼
                    faith holds  →  doors stay  →  tribute holds  →  solvent
```

**Success is: every owner in a knight's care, every craft headed, every box of
work on a real desk — and the coffers in the black because of it.** That is
`realm.debt` driven to zero, and the coffers held up by the doors that debt
protects. The campaign teaches exactly that loop and nothing else.

The critical teaching point, which the grand muster hides in noise: **the money
is downstream of the work.** A player who learns to clear crises before faith
cracks never has a money problem. A player who watches the coffers and ignores
the board loses, and cannot see why. The intro campaign must make that visible in
a handful of moves.

---

## IV. The Intro Campaign — "A Small Holding"

**Shape: small, clean, solvent-at-rest, and staged.**

| | Grand muster | Intro campaign |
|---|---|---|
| Doors | ~200 | **~16** |
| Flow instances | ~520 | **~6 at open**, more arriving with the clock |
| Raw intake | 20 | **2** |
| Backlog age at deploy | up to 61d | **none — the clock starts clean** |
| Coffers at rest | insolvent | **solvent with a visible margin** |
| Knights | many | **two**, one of them the player's own |

**Solvent at rest is the load-bearing change.** If the realm loses money whatever
you do, neglect costs nothing and diligence buys nothing, and the whole causal
loop above is unteachable. In the campaign, tribute covers upkeep *while the
doors are held* — so the first withdrawal is felt, and recovering it is a win the
player can read on the ribbon.

### The acts

Each act opens with one herald, sets one goal, and ends when the goal is met.
Nothing is gated — a player may wander — but the Council always names the act's
own next step, so there is never a blank board.

1. **The realm is yours.** Two knights, sixteen doors, one craft standing
   headless. *Goal: head the empty office.* Teaches: the census is the org, and a
   vacancy is a decision, not a gap.
2. **Work arrives.** One maintenance case opens on a door. *Goal: walk it to
   done.* Teaches: the cascade, the step in hand, and that ratifying closes work.
3. **One desk cannot hold it.** Four cases land at once, all on the Regent.
   *Goal: get them onto real desks.* Teaches: the queue, the hand-off, delegation
   debt as a number that falls when you act.
4. **The clerks.** The fleet proposes on the standing work. *Goal: ratify (or
   overrule) three proposals.* Teaches: clerks propose, the Regent decides — and
   overruling is a first-class answer, not a failure.
5. **Neglect has a price.** A door goes into crisis. Advancing without clearing
   it drops a patron's faith, visibly, week by week. *Goal: clear it before the
   patron withdraws.* Teaches: the consequence engine, and that the clock is the
   opponent.
6. **The reckoning.** Read the Counting-house: tribute, upkeep, the trend, and
   what the withdrawn door cost. *Goal: end a month in the black.* Teaches: the
   money is downstream of the work.

**The campaign ends by handing the player the grand muster** — "the holding you
have learned on is one knight's book; the realm is two hundred doors and it does
not wait" — which is the honest bridge from lesson to instrument.

### What it must NOT do

- **No tutorial overlay, no arrows, no modal chain.** The kingdom's design law is
  that the board teaches by being legible. The campaign teaches by *what it
  deals* and by the Council's own heralds — the surfaces that already exist.
- **No new nouns.** A campaign act is a seed and a shape, dealt by the same
  generator into the same books. If teaching it requires a new concept, the
  concept is missing from the product, not from the tutorial.
- **No scripted immunity.** The player can lose the campaign. A lesson you cannot
  fail teaches nothing.

---

## V. How it is built (so the library and the campaign are the same machinery)

A **Scenario** is the recipe. The intro campaign is a scenario with acts; the
grand muster is a scenario with one act and big numbers. Same shelf.

```
Scenario  = { key, title, blurb, doors, knights, solvency, acts[] }
Act       = { key, title, herald, deal: {...}, goal: <a reading that must become true> }
```

- `deal` is declarative — how many of what kind of work, on which doors, at what
  age — and is handed to the **existing** generator. No second dealer.
- `goal` is a **reading**, not a stored flag: "no office is headless", "this case
  reads done", "the month's trend is positive". Records in, readings out; the
  campaign cannot desync from the board because it is only ever reading it.
- The **library resolution test** (§I) covers every scenario on the shelf.

**Sequencing.** Build the Scenario shape + the resolution test + the intro
campaign's six acts first; ship the shelf UI after, once there is more than one
thing on it. A library with one book is a variable.

---

## Settled at build time (2026-07-27, Claude — reversible on Edwin's word)

- **The campaign is the DEFAULT first deploy** — it leads the time control; the grand muster keeps its
  seed field and sits one click to its right, dealing exactly as it always has.
- **The grand muster is NOT retuned.** It stays the torture test. Its saturated stuck gauge and its
  structural insolvency are correct for what it is and wrong for a first read, which is why the
  campaign exists rather than a softened muster.

## Still open (Edwin's call)

- **Act four depends on the LIVE fleet.** It is met by answering three clerk proposals, and the clerks
  need the Moonshot line. Behind the wall the key is set, so it stands — but if the line is ever off,
  act four is unreachable rather than merely hard. The alternative is dealing three seeded proposals,
  which would teach the ratify gesture without teaching that a clerk actually reasons. Left live.
- **Reset does not restore the vacated grant.** Reset strikes the campaign's marked events, its
  household and its coin; the struck Office of Works grant stays struck. Re-granting it IS act one, so
  this is arguably right — but a true restore would snapshot `acts` on deploy the way
  `restoreCatalog`/`restoreFlows` already do.
- **A second scenario.** The shelf holds one book, which makes it a variable. The shape earns its keep
  at two.
