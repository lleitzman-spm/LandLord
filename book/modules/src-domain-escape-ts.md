---
type: "module"
id: "module:src/domain/escape.ts"
title: "src/domain/escape.ts"
standing: "built"
standing_source: "knowledge/artifacts.json"
source_path: "src/domain/escape.ts"
source_line: 1
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "module:src/domain/escape.ts"
---

# src/domain/escape.ts

> **STANDING — BUILT**  
> Implemented in code and checkable against the tree.  
> *Declared in `knowledge/artifacts.json`.*

298 lines · 4 exported symbols.

## What the file says of itself

> THE ESCAPE RATE — what fraction of work reaches a human.
> 
> WHY THIS EXISTS. The bar this product is built against is one operator running a
> portfolio that today takes a firm. The arithmetic is unforgiving: at ~21 hours per
> door per year, ten thousand doors is 210,000 hours against one person's ~2,000. So
> roughly 99% of the hours must never reach a human, which leaves a few minutes of
> human attention per door per year.
> 
> The escape rate is the one number that says whether that is happening, and it has
> the property that makes a KPI dangerous: it is invisible when it is worst. A firm
> at 1% escaping

## Shape

- **Lines:** 298
- **Exported symbols (4):** `EscapeLine`, `EscapeReading`, `readDesignedCeiling`, `readEscape`

## Modules

- [[src/domain/catalog.ts]] — *imported by this file*
- [[src/domain/events.ts]] — *imported by this file*
- [[src/domain/flows.ts]] — *imported by this file*

## Backlinks

### Writs that specify it

- [[Handoff — where things stand]] — *this writ names the exported symbol `EscapeReading`; this writ names the exported symbol `readEscape`*
- [[The sibling boundary — who owns the process model]] — *this writ names the exported symbol `EscapeReading`*

### Modules

- [[src/LedgerView.tsx]] — *imported by this file*
- [[src/WarTableView.tsx]] — *imported by this file*

### Surfaces

- [[LedgerView]] — *imported by this view*
- [[WarTableView]] — *imported by this view*

### Invariants that enforce it

*These roads come from a shared source FILE, not from a semantic claim: the test file imports the module. Read it as "stands near", never as "proves".*

- [[`awaiting` is NOT an escape — it means parked on a clock, not on a person]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a failure sent back to the party who erred is NOT an escape]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a failure that is redone still leaves a mark — the count, not the latest kind]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a human touching an AUTO step is an unplanned escape — the machine failed]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a judgment failure repaired on an `auto` row is a fault — the two claims cannot both hold]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a route naming a step the flow does not have writes nothing either]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a self-routed step comes back to the same desk, and the cascade does not walk past it]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a step never reached cannot escape — an idle system is not an automated one]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a step routed upstream sends the case back to where the bad input entered]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a step the catalog marks human is a DESIGNED escape, not a failure]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a step with no declared mode is NOT MEASURED and never joins a total]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a step with NO route cannot fail — nothing is written at all]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an auto step nobody touched is not an escape at all]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an out-of-range index is no act at all, like every other writer]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[and it says how few independent judgments that rests on]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[counts each escalation, not each step — this is where rework becomes visible]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[names routed, unrouted and broken apart]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[names WHICH step leaks, not just that one does]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[one step worked over many events counts once, not once per event]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the escape count is not folded into the rate]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the founding book declares no failure routes, and says so rather than defaulting]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the founding flow book budgets most of its steps to a person]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[with no routes declared the count is zero and the rate is unchanged]] — *imported by the test FILE (shared source, not a claim about this one test)*

## Documents that cite this source

*These name this FILE by its path. That is a citation of the source, not a claim about any one idea inside it — do not read a path citation as agreement, dependence or implementation.*

- [[Handoff — where things stand]]
- [[The sibling boundary — who owns the process model]]
- [[Writ — The Knighthood: one seat, a Regent that is an agent, and the fief as a desk]]

---

*Generated by `tools/vault/emit.mjs` from `src/domain/escape.ts`:1. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
