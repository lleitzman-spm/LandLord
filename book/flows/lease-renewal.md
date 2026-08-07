---
type: "flow"
id: "flow:lease-renewal"
title: "Lease renewal"
standing: "built"
standing_source: "derived"
source_path: "src/domain/flows.ts"
source_line: 545
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "flow:lease-renewal"
---

# Lease renewal

> **STANDING — BUILT**  
> Implemented in code and checkable against the tree.  
> *Derived from the tree — the code is there to be read.*

Triggered by: A lease nears its term (T-90). 9 steps across 7 board(s), 2 hand(s).

## The source, verbatim

> key: 'lease-renewal'

*Verified against `src/domain/flows.ts`:545 on every lint — no quote, no object.*

## The cascade

**Trigger — A lease nears its term (T-90).** 9 steps, 2 hand(s), 7 board(s).

```text
▶ open-window   [Renewal]  — lp-queue
   └─▶ on or after day 1, and it is BREACHED if it sits 3 days past that   ⇢ handover lp-queue → osric
· price   [Pricing]  — osric
   └─▶ between day 2 and day 5, and it is BREACHED if it sits 2 days past that   ⇢ handover osric → lp-queue
· draft-offer   [Offer]  — lp-queue
   └─▶ between day 3 and day 6, and it is BREACHED if it sits 1 day past that
· send-offer   [Offer]  — lp-queue
   └─▶ between day 3 and day 10, and it is BREACHED if it sits 7 days past that
· owner-window   [Owner]  — lp-queue
   └─▶ on or after day 6, then again every 7 days
· tenant-response   [Offer]  — lp-queue
   └─▶ between day 20 and day 30, and it is BREACHED if it sits 2 days past that   ⇢ handover lp-queue → osric
· countersign   [Execution]  — osric
   └─▶ between day 20 and day 30, on or after the 15th of the month, before the 10th of the month, and it is BREACHED if it sits 5 days past that   ⇢ handover osric → lp-queue
· post-fee   [Settlement]  — lp-queue
   └─▶ on or after day 25, and it is BREACHED if it sits 2 days past that
■ record   [Close]  — lp-queue
```

*▶ where a case enters  ·  ■ where it comes to rest*

## Every step

| # | step | board | held by | when it may start | breached after | what it is |
|---:|---|---|---|---|---|---|
| 1 | [[Lease renewal: open-window]] | Renewal | [[lp-queue]] | on or after the day it fires | *no SLA* | The T-90 window opens — the term in sight, the file pulled. |
| 2 | [[Lease renewal: price]] | Pricing | [[Osric]] | on or after day 1 | 3 days | The rent call a human makes — hold, raise by {increase}, or let the door go. |
| 3 | [[Lease renewal: draft-offer]] | Offer | [[lp-queue]] | between day 2 and day 5 | 2 days | The renewal offer drafted at the set {rent} — the packet staged. |
| 4 | [[Lease renewal: send-offer]] | Offer | [[lp-queue]] | between day 3 and day 6 | 1 day | The offer sent to the tenant — the term and the {rent} on the table. |
| 5 | [[Lease renewal: owner-window]] | Owner | [[lp-queue]] | between day 3 and day 10 | 7 days | The owner's window — an unanswered window is an absence, never a consent. |
| 6 | [[Lease renewal: tenant-response]] | Offer | [[lp-queue]] | on or after day 6, then again every 7 days | *no SLA* | The tenant chased each week — signed, or the term runs month-to-month. |
| 7 | [[Lease renewal: countersign]] | Execution | [[Osric]] | between day 20 and day 30 | 2 days | The broker's signature — the one hand the machine never holds. |
| 8 | [[Lease renewal: post-fee]] | Settlement | [[lp-queue]] | between day 20 and day 30, on or after the 15th of the month, before the 10th of the month | 5 days | The renewal fee posted — only inside the open window of the circuit. |
| 9 | [[Lease renewal: record]] | Close | [[lp-queue]] | on or after day 25 | 2 days | Filed and notified — unsigned rolls to month-to-month with the premium. |

## Where it changes hands

*4 handovers in this flow. Each one is a moment the case stops being somebody's problem and starts being somebody else's — which is where work is actually dropped.*

- **lp-queue → osric** at [[Lease renewal: price]] — 3 day SLA
- **osric → lp-queue** at [[Lease renewal: draft-offer]] — 2 day SLA
- **lp-queue → osric** at [[Lease renewal: countersign]] — 2 day SLA
- **osric → lp-queue** at [[Lease renewal: post-fee]] — 5 day SLA

## Modules

- [[src/domain/flows.ts]] — *declared in this module*

## place

- [[Lease renewal: countersign]] — *a step of this flow*
- [[Lease renewal: draft-offer]] — *a step of this flow*
- [[Lease renewal: open-window]] — *a step of this flow*
- [[Lease renewal: owner-window]] — *a step of this flow*
- [[Lease renewal: post-fee]] — *a step of this flow*
- [[Lease renewal: price]] — *a step of this flow*
- [[Lease renewal: record]] — *a step of this flow*
- [[Lease renewal: send-offer]] — *a step of this flow*
- [[Lease renewal: tenant-response]] — *a step of this flow*

## Backlinks

### guard

- [[when countersign may start]] — *a condition inside this flow*
- [[when draft-offer may start]] — *a condition inside this flow*
- [[when owner-window may start]] — *a condition inside this flow*
- [[when post-fee may start]] — *a condition inside this flow*
- [[when price may start]] — *a condition inside this flow*
- [[when record may start]] — *a condition inside this flow*
- [[when send-offer may start]] — *a condition inside this flow*
- [[when tenant-response may start]] — *a condition inside this flow*

### place

- [[Lease renewal: countersign]] — *a step of this flow*
- [[Lease renewal: draft-offer]] — *a step of this flow*
- [[Lease renewal: open-window]] — *a step of this flow*
- [[Lease renewal: owner-window]] — *a step of this flow*
- [[Lease renewal: post-fee]] — *a step of this flow*
- [[Lease renewal: price]] — *a step of this flow*
- [[Lease renewal: record]] — *a step of this flow*
- [[Lease renewal: send-offer]] — *a step of this flow*
- [[Lease renewal: tenant-response]] — *a step of this flow*

### transition

- [[countersign → post-fee]] — *an arrow of this flow*
- [[draft-offer → send-offer]] — *an arrow of this flow*
- [[open-window → price]] — *an arrow of this flow*
- [[owner-window → tenant-response]] — *an arrow of this flow*
- [[post-fee → record]] — *an arrow of this flow*
- [[price → draft-offer]] — *an arrow of this flow*
- [[send-offer → owner-window]] — *an arrow of this flow*
- [[tenant-response → countersign]] — *an arrow of this flow*

---

*Generated by `tools/vault/emit.mjs` from `src/domain/flows.ts`:545. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
