---
type: "flow"
id: "flow:owner-onboarding"
title: "Owner onboarding"
standing: "built"
standing_source: "derived"
source_path: "src/domain/flows.ts"
source_line: 483
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "flow:owner-onboarding"
---

# Owner onboarding

> **STANDING — BUILT**  
> Implemented in code and checkable against the tree.  
> *Derived from the tree — the code is there to be read.*

Triggered by: A new owner's property is won. 9 steps across 8 board(s), 4 hand(s).

## The source, verbatim

> key: 'owner-onboarding'

*Verified against `src/domain/flows.ts`:483 on every lint — no quote, no object.*

## The cascade

**Trigger — A new owner's property is won.** 9 steps, 4 hand(s), 8 board(s).

```text
▶ intake   [Intake]  — pm-desk
   └─▶ on or after day 1, and it is BREACHED if it sits 3 days past that   ⇢ handover pm-desk → osric
· agreement   [Agreement]  — osric
   └─▶ between day 2 and day 5, and it is BREACHED if it sits 3 days past that   ⇢ handover osric → va-desk
· set-up-records   [Setup]  — va-desk
   └─▶ between day 2 and day 7, and it is BREACHED if it sits 4 days past that   ⇢ handover va-desk → alys
· walkthrough   [Onsite]  — alys
   └─▶ between day 3 and day 8, and it is BREACHED if it sits 5 days past that   ⇢ handover alys → va-desk
· verify-insurance   [Compliance]  — va-desk
   └─▶ on or after day 5
· make-ready   [Make-Ready]  — va-desk
   └─▶ between day 5 and day 9, and it is BREACHED if it sits 3 days past that   ⇢ handover va-desk → alys
· lockbox   [Onsite]  — alys
   └─▶ between day 7 and day 12, and it is BREACHED if it sits 3 days past that   ⇢ handover alys → pm-desk
· first-report   [Report]  — pm-desk
   └─▶ on or after day 10   ⇢ handover pm-desk → osric
■ go-live   [Leasing]  — osric
```

*▶ where a case enters  ·  ■ where it comes to rest*

## Every step

| # | step | board | held by | when it may start | breached after | what it is |
|---:|---|---|---|---|---|---|
| 1 | [[Owner onboarding: intake]] | Intake | [[pm-desk]] | on or after the day it fires | *no SLA* | The owner intake logged — the property, the doors, the terms sought. |
| 2 | [[Owner onboarding: agreement]] | Agreement | [[Osric]] | on or after day 1 | 3 days | The management agreement — a signature and a judgment, kept human. |
| 3 | [[Owner onboarding: set-up-records]] | Setup | [[va-desk]] | between day 2 and day 5 | 3 days | Records opened and defaults set in the system of record. |
| 4 | [[Owner onboarding: walkthrough]] | Onsite | [[Alys]] | between day 2 and day 7 | 4 days | The property walked — the onsite judgment the machine can't make. |
| 5 | [[Owner onboarding: verify-insurance]] | Compliance | [[va-desk]] | between day 3 and day 8 | 5 days | Owner insurance verified and on file — the coverage gate. |
| 6 | [[Owner onboarding: make-ready]] | Make-Ready | [[va-desk]] | on or after day 5 | *no SLA* | The make-ready batched — only where a door comes empty. |
| 7 | [[Owner onboarding: lockbox]] | Onsite | [[Alys]] | between day 5 and day 9 | 3 days | Keys logged and the lockbox hung — the physical leg. |
| 8 | [[Owner onboarding: first-report]] | Report | [[pm-desk]] | between day 7 and day 12 | 3 days | The first owner report sent — the relationship opened on the books. |
| 9 | [[Owner onboarding: go-live]] | Leasing | [[Osric]] | on or after day 10 | *no SLA* | Built and syndicated — the vacant door goes to market. |

## Where it changes hands

*7 handovers in this flow. Each one is a moment the case stops being somebody's problem and starts being somebody else's — which is where work is actually dropped.*

- **pm-desk → osric** at [[Owner onboarding: agreement]] — 3 day SLA
- **osric → va-desk** at [[Owner onboarding: set-up-records]] — 3 day SLA
- **va-desk → alys** at [[Owner onboarding: walkthrough]] — 4 day SLA
- **alys → va-desk** at [[Owner onboarding: verify-insurance]] — 5 day SLA
- **va-desk → alys** at [[Owner onboarding: lockbox]] — 3 day SLA
- **alys → pm-desk** at [[Owner onboarding: first-report]] — 3 day SLA
- **pm-desk → osric** at [[Owner onboarding: go-live]] — *no SLA on the receiving step*

## Modules

- [[src/domain/flows.ts]] — *declared in this module*

## place

- [[Owner onboarding: agreement]] — *a step of this flow*
- [[Owner onboarding: first-report]] — *a step of this flow*
- [[Owner onboarding: go-live]] — *a step of this flow*
- [[Owner onboarding: intake]] — *a step of this flow*
- [[Owner onboarding: lockbox]] — *a step of this flow*
- [[Owner onboarding: make-ready]] — *a step of this flow*
- [[Owner onboarding: set-up-records]] — *a step of this flow*
- [[Owner onboarding: verify-insurance]] — *a step of this flow*
- [[Owner onboarding: walkthrough]] — *a step of this flow*

## Backlinks

### guard

- [[when agreement may start]] — *a condition inside this flow*
- [[when first-report may start]] — *a condition inside this flow*
- [[when go-live may start]] — *a condition inside this flow*
- [[when lockbox may start]] — *a condition inside this flow*
- [[when make-ready may start]] — *a condition inside this flow*
- [[when set-up-records may start]] — *a condition inside this flow*
- [[when verify-insurance may start]] — *a condition inside this flow*
- [[when walkthrough may start]] — *a condition inside this flow*

### place

- [[Owner onboarding: agreement]] — *a step of this flow*
- [[Owner onboarding: first-report]] — *a step of this flow*
- [[Owner onboarding: go-live]] — *a step of this flow*
- [[Owner onboarding: intake]] — *a step of this flow*
- [[Owner onboarding: lockbox]] — *a step of this flow*
- [[Owner onboarding: make-ready]] — *a step of this flow*
- [[Owner onboarding: set-up-records]] — *a step of this flow*
- [[Owner onboarding: verify-insurance]] — *a step of this flow*
- [[Owner onboarding: walkthrough]] — *a step of this flow*

### transition

- [[agreement → set-up-records]] — *an arrow of this flow*
- [[first-report → go-live]] — *an arrow of this flow*
- [[intake → agreement]] — *an arrow of this flow*
- [[lockbox → first-report]] — *an arrow of this flow*
- [[make-ready → lockbox]] — *an arrow of this flow*
- [[set-up-records → walkthrough]] — *an arrow of this flow*
- [[verify-insurance → make-ready]] — *an arrow of this flow*
- [[walkthrough → verify-insurance]] — *an arrow of this flow*

---

*Generated by `tools/vault/emit.mjs` from `src/domain/flows.ts`:483. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
