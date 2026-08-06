---
type: "flow"
id: "flow:violation-notice"
title: "Violation / notice"
standing: "built"
standing_source: "derived"
source_path: "src/domain/flows.ts"
source_line: 315
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "flow:violation-notice"
---

# Violation / notice

> **STANDING — BUILT**  
> Implemented in code and checkable against the tree.  
> *Derived from the tree — the code is there to be read.*

Triggered by: A violation or notice arrives. 7 steps across 5 board(s), 3 hand(s).

## The source, verbatim

> key: 'violation-notice'

*Verified against `src/domain/flows.ts`:315 on every lint — no quote, no object.*

## The cascade

**Trigger — A violation or notice arrives.** 7 steps, 3 hand(s), 5 board(s).

```text
▶ receive   [Intake]  — pm-desk
   └─▶ on or after the day it fires   ⇢ handover pm-desk → va-desk
· classify   [Intake]  — va-desk
   └─▶ on or after day 1, and it is BREACHED if it sits 2 days past that   ⇢ handover va-desk → mabel
· decide   [Judgment]  — mabel
   └─▶ between day 1 and day 3, and it is BREACHED if it sits 2 days past that   ⇢ handover mabel → va-desk
· draft-notice   [Notice]  — va-desk
   └─▶ between day 2 and day 4, and it is BREACHED if it sits 2 days past that   ⇢ handover va-desk → pm-desk
· serve   [Notice]  — pm-desk
   └─▶ on or after day 3, then again every 7 days   ⇢ handover pm-desk → mabel
· cure-window   [Follow-up]  — mabel
   └─▶ on or after day 10, and it is BREACHED if it sits 3 days past that   ⇢ handover mabel → pm-desk
■ close   [Close]  — pm-desk
```

*▶ where a case enters  ·  ■ where it comes to rest*

## Every step

| # | step | board | held by | when it may start | breached after | what it is |
|---:|---|---|---|---|---|---|
| 1 | [[Violation / notice: receive]] | Intake | [[pm-desk]] | on or after the day it fires | *no SLA* | The notice logged — HOA, owner, or vendor; what, which door, from whom. |
| 2 | [[Violation / notice: classify]] | Intake | [[va-desk]] | on or after the day it fires | *no SLA* | Classified by kind and severity — the {violation} named. |
| 3 | [[Violation / notice: decide]] | Judgment | [[Mabel]] | on or after day 1 | 2 days | The call a human makes: cure, waive, or send the {violation} up the ladder. |
| 4 | [[Violation / notice: draft-notice]] | Notice | [[va-desk]] | between day 1 and day 3 | 2 days | The cure notice drafted from the template — the {days}-day window stated. |
| 5 | [[Violation / notice: serve]] | Notice | [[pm-desk]] | between day 2 and day 4 | 2 days | Served and recorded — the legal gate kept, the clock on record. |
| 6 | [[Violation / notice: cure-window]] | Follow-up | [[Mabel]] | on or after day 3, then again every 7 days | *no SLA* | The cure period worked — reminded each week it stands open. |
| 7 | [[Violation / notice: close]] | Close | [[pm-desk]] | on or after day 10 | 3 days | The outcome recorded and the case closed — cured, or handed up the ladder. |

## Where it changes hands

*6 handovers in this flow. Each one is a moment the case stops being somebody's problem and starts being somebody else's — which is where work is actually dropped.*

- **pm-desk → va-desk** at [[Violation / notice: classify]] — *no SLA on the receiving step*
- **va-desk → mabel** at [[Violation / notice: decide]] — 2 day SLA
- **mabel → va-desk** at [[Violation / notice: draft-notice]] — 2 day SLA
- **va-desk → pm-desk** at [[Violation / notice: serve]] — 2 day SLA
- **pm-desk → mabel** at [[Violation / notice: cure-window]] — *no SLA on the receiving step*
- **mabel → pm-desk** at [[Violation / notice: close]] — 3 day SLA

## Modules

- [[src/domain/flows.ts]] — *declared in this module*

## place

- [[Violation / notice: classify]] — *a step of this flow*
- [[Violation / notice: close]] — *a step of this flow*
- [[Violation / notice: cure-window]] — *a step of this flow*
- [[Violation / notice: decide]] — *a step of this flow*
- [[Violation / notice: draft-notice]] — *a step of this flow*
- [[Violation / notice: receive]] — *a step of this flow*
- [[Violation / notice: serve]] — *a step of this flow*

## Backlinks

### guard

- [[when classify may start]] — *a condition inside this flow*
- [[when close may start]] — *a condition inside this flow*
- [[when cure-window may start]] — *a condition inside this flow*
- [[when decide may start]] — *a condition inside this flow*
- [[when draft-notice may start]] — *a condition inside this flow*
- [[when serve may start]] — *a condition inside this flow*

### place

- [[Violation / notice: classify]] — *a step of this flow*
- [[Violation / notice: close]] — *a step of this flow*
- [[Violation / notice: cure-window]] — *a step of this flow*
- [[Violation / notice: decide]] — *a step of this flow*
- [[Violation / notice: draft-notice]] — *a step of this flow*
- [[Violation / notice: receive]] — *a step of this flow*
- [[Violation / notice: serve]] — *a step of this flow*

### transition

- [[classify → decide]] — *an arrow of this flow*
- [[cure-window → close]] — *an arrow of this flow*
- [[decide → draft-notice]] — *an arrow of this flow*
- [[draft-notice → serve]] — *an arrow of this flow*
- [[receive → classify]] — *an arrow of this flow*
- [[serve → cure-window]] — *an arrow of this flow*

---

*Generated by `tools/vault/emit.mjs` from `src/domain/flows.ts`:315. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
