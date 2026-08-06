---
type: "flow"
id: "flow:move-out-relay"
title: "Move-out → re-list relay"
standing: "built"
standing_source: "derived"
source_path: "src/domain/flows.ts"
source_line: 204
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "flow:move-out-relay"
---

# Move-out → re-list relay

> **STANDING — BUILT**  
> Implemented in code and checkable against the tree.  
> *Derived from the tree — the code is there to be read.*

Triggered by: A tenant gives notice. 13 steps across 3 board(s), 5 hand(s).

## The source, verbatim

> key: 'move-out-relay'

*Verified against `src/domain/flows.ts`:204 on every lint — no quote, no object.*

## The cascade

**Trigger — A tenant gives notice.** 13 steps, 5 hand(s), 3 board(s).

```text
▶ log-notice   [Move-Out]  — pm-desk
   └─▶ on or after day 1, and it is BREACHED if it sits 2 days past that
· confirm-date   [Move-Out]  — pm-desk
   └─▶ between 14 days BEFORE the event and 7 days BEFORE the event   ⇢ handover pm-desk → alys
· pre-inspection   [Move-Out]  — alys
   └─▶ between the day it fires and day 2, and it is BREACHED if it sits 2 days past that
· move-out-inspection   [Move-Out]  — alys
   └─▶ between day 1 and day 3, and it is BREACHED if it sits 2 days past that   ⇢ handover alys → va-desk
· turn-scope   [Move-Out]  — va-desk
   └─▶ between day 3 and day 10, on or after the 15th of the month, before the 10th of the month, and it is BREACHED if it sits 5 days past that   ⇢ handover va-desk → lp-queue
· owner-reserve   [Deposit Transfer]  — lp-queue
   └─▶ between day 3 and day 10, and it is BREACHED if it sits 7 days past that   ⇢ handover lp-queue → va-desk
· turn-work   [Move-Out]  — va-desk
   └─▶ between day 2 and day 21, and it is BREACHED if it sits 3 days past that   ⇢ handover va-desk → alys
· deposit-accounting   [Deposit Transfer]  — alys
   └─▶ between day 21 and day 30, and it is BREACHED if it sits 5 days past that   ⇢ handover alys → lp-queue
· deposit-transfer   [Deposit Transfer]  — lp-queue
   └─▶ between day 10 and day 12   ⇢ handover lp-queue → osric
· final-walk   [Leasing]  — osric
   └─▶ on or after day 12, and it is BREACHED if it sits 2 days past that
· list-unit   [Leasing]  — osric
   └─▶ between day 12 and day 40
· show-and-screen   [Leasing]  — osric
   └─▶ on or after day 19, then again every 7 days
■ weekly-price-drop   [Leasing]  — osric
```

*▶ where a case enters  ·  ■ where it comes to rest*

## Every step

| # | step | board | held by | when it may start | breached after | what it is |
|---:|---|---|---|---|---|---|
| 1 | [[Move-out → re-list relay: log-notice]] | Move-Out | [[pm-desk]] | on or after the day it fires | 1 day | Notice logged and acknowledged; the clock starts. |
| 2 | [[Move-out → re-list relay: confirm-date]] | Move-Out | [[pm-desk]] | on or after day 1 | 2 days | Vacate date confirmed in writing with the tenant. |
| 3 | [[Move-out → re-list relay: pre-inspection]] | Move-Out | [[Alys]] | between 14 days BEFORE the event and 7 days BEFORE the event | *no SLA* | Walk the unit before the tenant leaves; scope the turn. |
| 4 | [[Move-out → re-list relay: move-out-inspection]] | Move-Out | [[Alys]] | between the day it fires and day 2 | 2 days | Document condition against the deposit. |
| 5 | [[Move-out → re-list relay: turn-scope]] | Move-Out | [[va-desk]] | between day 1 and day 3 | 2 days | Bids gathered, the turn scoped and priced. |
| 6 | [[Move-out → re-list relay: owner-reserve]] | Deposit Transfer | [[lp-queue]] | between day 3 and day 10, on or after the 15th of the month, before the 10th of the month | 5 days | A ~$750 owner reserve, requested only inside the open window. |
| 7 | [[Move-out → re-list relay: turn-work]] | Move-Out | [[va-desk]] | between day 3 and day 10 | 7 days | The turn itself: vendors dispatched, unit made ready. |
| 8 | [[Move-out → re-list relay: deposit-accounting]] | Deposit Transfer | [[Alys]] | between day 2 and day 21 | 3 days | Deductions itemized and sent inside the statutory window. |
| 9 | [[Move-out → re-list relay: deposit-transfer]] | Deposit Transfer | [[lp-queue]] | between day 21 and day 30 | 5 days | What is owed moves: refund out, damages to the owner. |
| 10 | [[Move-out → re-list relay: final-walk]] | Leasing | [[Osric]] | between day 10 and day 12 | *no SLA* | Rent-ready verified before the listing goes live. |
| 11 | [[Move-out → re-list relay: list-unit]] | Leasing | [[Osric]] | on or after day 12 | 2 days | Photos, price, syndication — the unit is on the market. |
| 12 | [[Move-out → re-list relay: show-and-screen]] | Leasing | [[Osric]] | between day 12 and day 40 | *no SLA* | Showings worked, applicants screened. |
| 13 | [[Move-out → re-list relay: weekly-price-drop]] | Leasing | [[Osric]] | on or after day 19, then again every 7 days | *no SLA* | The vacancy loop: $25 off the ask each week it sits. |

## Where it changes hands

*7 handovers in this flow. Each one is a moment the case stops being somebody's problem and starts being somebody else's — which is where work is actually dropped.*

- **pm-desk → alys** at [[Move-out → re-list relay: pre-inspection]] — *no SLA on the receiving step*
- **alys → va-desk** at [[Move-out → re-list relay: turn-scope]] — 2 day SLA
- **va-desk → lp-queue** at [[Move-out → re-list relay: owner-reserve]] — 5 day SLA
- **lp-queue → va-desk** at [[Move-out → re-list relay: turn-work]] — 7 day SLA
- **va-desk → alys** at [[Move-out → re-list relay: deposit-accounting]] — 3 day SLA
- **alys → lp-queue** at [[Move-out → re-list relay: deposit-transfer]] — 5 day SLA
- **lp-queue → osric** at [[Move-out → re-list relay: final-walk]] — *no SLA on the receiving step*

## Modules

- [[src/domain/flows.ts]] — *declared in this module*

## place

- [[Move-out → re-list relay: confirm-date]] — *a step of this flow*
- [[Move-out → re-list relay: deposit-accounting]] — *a step of this flow*
- [[Move-out → re-list relay: deposit-transfer]] — *a step of this flow*
- [[Move-out → re-list relay: final-walk]] — *a step of this flow*
- [[Move-out → re-list relay: list-unit]] — *a step of this flow*
- [[Move-out → re-list relay: log-notice]] — *a step of this flow*
- [[Move-out → re-list relay: move-out-inspection]] — *a step of this flow*
- [[Move-out → re-list relay: owner-reserve]] — *a step of this flow*
- [[Move-out → re-list relay: pre-inspection]] — *a step of this flow*
- [[Move-out → re-list relay: show-and-screen]] — *a step of this flow*
- [[Move-out → re-list relay: turn-scope]] — *a step of this flow*
- [[Move-out → re-list relay: turn-work]] — *a step of this flow*
- [[Move-out → re-list relay: weekly-price-drop]] — *a step of this flow*

## Backlinks

### guard

- [[when confirm-date may start]] — *a condition inside this flow*
- [[when deposit-accounting may start]] — *a condition inside this flow*
- [[when deposit-transfer may start]] — *a condition inside this flow*
- [[when final-walk may start]] — *a condition inside this flow*
- [[when list-unit may start]] — *a condition inside this flow*
- [[when move-out-inspection may start]] — *a condition inside this flow*
- [[when owner-reserve may start]] — *a condition inside this flow*
- [[when pre-inspection may start]] — *a condition inside this flow*
- [[when show-and-screen may start]] — *a condition inside this flow*
- [[when turn-scope may start]] — *a condition inside this flow*
- [[when turn-work may start]] — *a condition inside this flow*
- [[when weekly-price-drop may start]] — *a condition inside this flow*

### place

- [[Move-out → re-list relay: confirm-date]] — *a step of this flow*
- [[Move-out → re-list relay: deposit-accounting]] — *a step of this flow*
- [[Move-out → re-list relay: deposit-transfer]] — *a step of this flow*
- [[Move-out → re-list relay: final-walk]] — *a step of this flow*
- [[Move-out → re-list relay: list-unit]] — *a step of this flow*
- [[Move-out → re-list relay: log-notice]] — *a step of this flow*
- [[Move-out → re-list relay: move-out-inspection]] — *a step of this flow*
- [[Move-out → re-list relay: owner-reserve]] — *a step of this flow*
- [[Move-out → re-list relay: pre-inspection]] — *a step of this flow*
- [[Move-out → re-list relay: show-and-screen]] — *a step of this flow*
- [[Move-out → re-list relay: turn-scope]] — *a step of this flow*
- [[Move-out → re-list relay: turn-work]] — *a step of this flow*
- [[Move-out → re-list relay: weekly-price-drop]] — *a step of this flow*

### transition

- [[confirm-date → pre-inspection]] — *an arrow of this flow*
- [[deposit-accounting → deposit-transfer]] — *an arrow of this flow*
- [[deposit-transfer → final-walk]] — *an arrow of this flow*
- [[final-walk → list-unit]] — *an arrow of this flow*
- [[list-unit → show-and-screen]] — *an arrow of this flow*
- [[log-notice → confirm-date]] — *an arrow of this flow*
- [[move-out-inspection → turn-scope]] — *an arrow of this flow*
- [[owner-reserve → turn-work]] — *an arrow of this flow*
- [[pre-inspection → move-out-inspection]] — *an arrow of this flow*
- [[show-and-screen → weekly-price-drop]] — *an arrow of this flow*
- [[turn-scope → owner-reserve]] — *an arrow of this flow*
- [[turn-work → deposit-accounting]] — *an arrow of this flow*

---

*Generated by `tools/vault/emit.mjs` from `src/domain/flows.ts`:204. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
