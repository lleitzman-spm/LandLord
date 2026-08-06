---
type: "flow"
id: "flow:vendor-dispatch"
title: "Vendor dispatch"
standing: "built"
standing_source: "derived"
source_path: "src/domain/flows.ts"
source_line: 255
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "flow:vendor-dispatch"
---

# Vendor dispatch

> **STANDING — BUILT**  
> Implemented in code and checkable against the tree.  
> *Derived from the tree — the code is there to be read.*

Triggered by: A work order is reported. 8 steps across 3 board(s), 4 hand(s).

## The source, verbatim

> key: 'vendor-dispatch'

*Verified against `src/domain/flows.ts`:255 on every lint — no quote, no object.*

## The cascade

**Trigger — A work order is reported.** 8 steps, 4 hand(s), 3 board(s).

```text
▶ report   [Intake]  — pm-desk
   └─▶ on or after the day it fires, and it is BREACHED if it sits 1 day past that   ⇢ handover pm-desk → mabel
· identify   [Intake]  — mabel
   └─▶ between the day it fires and day 1, and it is BREACHED if it sits 1 day past that   ⇢ handover mabel → va-desk
· assign-vendor   [Dispatch]  — va-desk
   └─▶ between the day it fires and day 1, and it is BREACHED if it sits 1 day past that
· dispatch   [Dispatch]  — va-desk
   └─▶ between day 1 and day 7, and it is BREACHED if it sits 5 days past that   ⇢ handover va-desk → lp-queue
· invoice-in   [Settlement]  — lp-queue
   └─▶ between day 1 and day 7, and it is BREACHED if it sits 3 days past that   ⇢ handover lp-queue → mabel
· confirm-work   [Dispatch]  — mabel
   └─▶ between day 3 and day 10, on or after the 15th of the month, before the 10th of the month, and it is BREACHED if it sits 5 days past that   ⇢ handover mabel → lp-queue
· pay-vendor   [Settlement]  — lp-queue
   └─▶ between day 3 and day 14, and it is BREACHED if it sits 5 days past that
■ post-to-accounting   [Settlement]  — lp-queue
```

*▶ where a case enters  ·  ■ where it comes to rest*

## Every step

| # | step | board | held by | when it may start | breached after | what it is |
|---:|---|---|---|---|---|---|
| 1 | [[Vendor dispatch: report]] | Intake | [[pm-desk]] | on or after the day it fires | 1 day | The report logged — what broke, which door, how it reached us. |
| 2 | [[Vendor dispatch: identify]] | Intake | [[Mabel]] | on or after the day it fires | 1 day | Walked down the tree to a leaf — a {trade} call, {urgency} priority. |
| 3 | [[Vendor dispatch: assign-vendor]] | Dispatch | [[va-desk]] | between the day it fires and day 1 | 1 day | A artisan of the {trade} trade chosen for a {urgency} call. |
| 4 | [[Vendor dispatch: dispatch]] | Dispatch | [[va-desk]] | between the day it fires and day 1 | 1 day | The {trade} artisan dispatched — {urgency} window, tenant notified. |
| 5 | [[Vendor dispatch: invoice-in]] | Settlement | [[lp-queue]] | between day 1 and day 7 | 5 days | The {trade} artisan's invoice received and matched to the work. |
| 6 | [[Vendor dispatch: confirm-work]] | Dispatch | [[Mabel]] | between day 1 and day 7 | 3 days | The fix confirmed with the tenant — the {trade} work holds. |
| 7 | [[Vendor dispatch: pay-vendor]] | Settlement | [[lp-queue]] | between day 3 and day 10, on or after the 15th of the month, before the 10th of the month | 5 days | The artisan paid — only inside the open window of the circuit. |
| 8 | [[Vendor dispatch: post-to-accounting]] | Settlement | [[lp-queue]] | between day 3 and day 14 | 5 days | The cost posted to the door and its owner — the ledger balanced. |

## Where it changes hands

*5 handovers in this flow. Each one is a moment the case stops being somebody's problem and starts being somebody else's — which is where work is actually dropped.*

- **pm-desk → mabel** at [[Vendor dispatch: identify]] — 1 day SLA
- **mabel → va-desk** at [[Vendor dispatch: assign-vendor]] — 1 day SLA
- **va-desk → lp-queue** at [[Vendor dispatch: invoice-in]] — 5 day SLA
- **lp-queue → mabel** at [[Vendor dispatch: confirm-work]] — 3 day SLA
- **mabel → lp-queue** at [[Vendor dispatch: pay-vendor]] — 5 day SLA

## Modules

- [[src/domain/flows.ts]] — *declared in this module*

## place

- [[Vendor dispatch: assign-vendor]] — *a step of this flow*
- [[Vendor dispatch: confirm-work]] — *a step of this flow*
- [[Vendor dispatch: dispatch]] — *a step of this flow*
- [[Vendor dispatch: identify]] — *a step of this flow*
- [[Vendor dispatch: invoice-in]] — *a step of this flow*
- [[Vendor dispatch: pay-vendor]] — *a step of this flow*
- [[Vendor dispatch: post-to-accounting]] — *a step of this flow*
- [[Vendor dispatch: report]] — *a step of this flow*

## Backlinks

### Facts it depends on

- [[Vendor dispatch · assign-vendor · after]] — *declared in this flow*
- [[Vendor dispatch · assign-vendor · before]] — *declared in this flow*
- [[Vendor dispatch · assign-vendor · slaDays]] — *declared in this flow*
- [[Vendor dispatch · confirm-work · after]] — *declared in this flow*
- [[Vendor dispatch · confirm-work · before]] — *declared in this flow*
- [[Vendor dispatch · confirm-work · slaDays]] — *declared in this flow*
- [[Vendor dispatch · dispatch · after]] — *declared in this flow*
- [[Vendor dispatch · dispatch · before]] — *declared in this flow*
- [[Vendor dispatch · dispatch · slaDays]] — *declared in this flow*
- [[Vendor dispatch · identify · after]] — *declared in this flow*
- [[Vendor dispatch · identify · slaDays]] — *declared in this flow*
- [[Vendor dispatch · invoice-in · after]] — *declared in this flow*
- [[Vendor dispatch · invoice-in · before]] — *declared in this flow*
- [[Vendor dispatch · invoice-in · slaDays]] — *declared in this flow*
- [[Vendor dispatch · pay-vendor · after]] — *declared in this flow*
- [[Vendor dispatch · pay-vendor · before]] — *declared in this flow*
- [[Vendor dispatch · pay-vendor · beforeDayOfMonth]] — *declared in this flow*
- [[Vendor dispatch · pay-vendor · onOrAfterDayOfMonth]] — *declared in this flow*
- [[Vendor dispatch · pay-vendor · slaDays]] — *declared in this flow*
- [[Vendor dispatch · post-to-accounting · after]] — *declared in this flow*
- [[Vendor dispatch · post-to-accounting · before]] — *declared in this flow*
- [[Vendor dispatch · post-to-accounting · slaDays]] — *declared in this flow*
- [[Vendor dispatch · report · after]] — *declared in this flow*
- [[Vendor dispatch · report · slaDays]] — *declared in this flow*

### guard

- [[when assign-vendor may start]] — *a condition inside this flow*
- [[when confirm-work may start]] — *a condition inside this flow*
- [[when dispatch may start]] — *a condition inside this flow*
- [[when identify may start]] — *a condition inside this flow*
- [[when invoice-in may start]] — *a condition inside this flow*
- [[when pay-vendor may start]] — *a condition inside this flow*
- [[when post-to-accounting may start]] — *a condition inside this flow*

### place

- [[Vendor dispatch: assign-vendor]] — *a step of this flow*
- [[Vendor dispatch: confirm-work]] — *a step of this flow*
- [[Vendor dispatch: dispatch]] — *a step of this flow*
- [[Vendor dispatch: identify]] — *a step of this flow*
- [[Vendor dispatch: invoice-in]] — *a step of this flow*
- [[Vendor dispatch: pay-vendor]] — *a step of this flow*
- [[Vendor dispatch: post-to-accounting]] — *a step of this flow*
- [[Vendor dispatch: report]] — *a step of this flow*

### transition

- [[assign-vendor → dispatch]] — *an arrow of this flow*
- [[confirm-work → pay-vendor]] — *an arrow of this flow*
- [[dispatch → invoice-in]] — *an arrow of this flow*
- [[identify → assign-vendor]] — *an arrow of this flow*
- [[invoice-in → confirm-work]] — *an arrow of this flow*
- [[pay-vendor → post-to-accounting]] — *an arrow of this flow*
- [[report → identify]] — *an arrow of this flow*

---

*Generated by `tools/vault/emit.mjs` from `src/domain/flows.ts`:255. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
