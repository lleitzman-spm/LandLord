# Brief: sim-crown

**Your files:** `src/sim/oaths.ts`, `src/sim/rank.ts`, `src/sim/rival.ts`, `src/sim/modes.ts`, `src/sim/save.ts`, `test/sim-crown.test.ts`.
**Read:** `src/sim/types.ts`, `core.ts`, `index.ts`, `src/data/schema.ts`, `ids.ts`, `ranks.ts`, `balance.ts`, `characters.ts` (RIVAL_NAMES, REALM_NAMES), and the other `src/sim/*.ts` files for the functions you call.

ARCHITECTURE.md ("Oaths", "Rival", "Rank", "Modes") defines the behaviour; details:

**Oaths.** `swear`, daily checks for every kind exactly as specified, `wouldBreak`, `release_oath` (the promisee lets you off only if happy; otherwise it counts as broken), handlers `swear_oath` / `release_oath`. Kept and broken oaths herald in the `oath` kind, in the dry voice ("You promised Old Marta a roof before the frost. The frost came. The roof did not.").

**Rank.** Init the Reeve charter and name the realm (from `REALM_NAMES` by seed if blank), with a Crown herald using `RANKS.reeve.proclamation`. Daily goal metrics: `households`, `rentRoll`, `renown`, `favor`, `gold`, `happinessAvg`, `staff`, `oathsKept`, `buildings` (ready count of `buildingType`), `monthsNoVacancy`, `conditionAvg`. Emit `goal` once per goal met; when all are met set `ready`, herald, emit `charter_ready`. `accept_promotion`: next rank, `buildings.upgradeSeat` to the new `seatLevel`, favor +10, new goals, staff candidates refreshed, a proclamation herald, `promotion` event, a gift of crowns from the Crown scaled to rank. Goals met once stay met for that charter. Duke and King must work mechanically (the rank can be reached) even though their content is thin.

**Rival.** As specified. Three temperaments with distinct herald voices: grasping (undercuts rents), charming (throws feasts, steals the happy ones too), ruthless (spreads rumours: your renown −1). Roughly one move every month or two, never more than one household a month, never below two households left. When your renown beats his by 15 a household of his defects to you as a fresh applicant with a line about it.

**Modes.** Tribute, the moneylender, interest, `take_loan` / `repay_loan`, demotion in Steward's Peace, the end in Iron Crown, `abdicate`, plus the trivial handlers `set_speed`, `mark_seen`, `set_flag`. Favor: +2 for tribute paid on time, −12 unpaid (it is then added to debt), slow drift toward 50. The moneylender is a character (`moneylender` NPC): heralds in a soft, patient, alarming voice. Demotion and the end each get a written `epitaph` line built from what actually happened (rank, years, households, evictions, oaths broken, the cause).

**Save.** `serialize` / `deserialize`: versioned JSON, never saving `_events`; tolerant loading (missing fields filled from `blankState`-style defaults, unknown fields dropped, a newer `version` rejected with a clear error). Round-trip must be exact: `serialize(deserialize(serialize(s))) === serialize(s)`.

**Tests** (`npx tsx test/sim-crown.test.ts`): each oath kind kept and broken; promotion from Reeve through Baron by forcing the metrics; tribute unpaid into debt into demotion (peace) and into game over (iron); save round-trip on the fixture state (`src/dev/fixture.ts`) and on a simulated reign; determinism.
