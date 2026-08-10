---
type: "module"
id: "module:src/domain/contextGuard.ts"
title: "src/domain/contextGuard.ts"
standing: "built"
standing_source: "knowledge/artifacts.json"
source_path: "src/domain/contextGuard.ts"
source_line: 1
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "module:src/domain/contextGuard.ts"
---

# src/domain/contextGuard.ts

> **STANDING — BUILT**  
> Implemented in code and checkable against the tree.  
> *Declared in `knowledge/artifacts.json`.*

5 lines · 0 exported symbols.

## What the file says of itself

> TypeScript-facing doorway to the one runtime implementation. The `.mjs`
> module is deliberately shared with the Node harness so there is no second,
> weaker copy of the model-context boundary to drift.

## Shape

- **Lines:** 5
- **Exported symbols (0):** *none*

## Modules

- [[src/domain/contextGuard.mjs]] — *imported by this file*

## Backlinks

### Modules

- [[src/domain/agentIntake.ts]] — *imported by this file*
- [[src/operator-core.ts]] — *imported by this file*
- [[src/server/brain.ts]] — *imported by this file*

### Invariants that enforce it

*These roads come from a shared source FILE, not from a semantic claim: the test file imports the module. Read it as "stands near", never as "proves".*

- [[a guarded brain never receives a leaking call]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a guarded brain passes clean calls straight through]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[blocks ${label} before the provider call]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[catches a bank routing number by its checksum]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[catches a government id]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[catches a payment card, and only a Luhn-valid one]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[catches a role-labeled name in ordinary prose]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[catches contact details]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[catches direct doors, unit identifiers, and person names]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[does not mistake compact work-order and invoice numbers for phones]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[does not mistake OpenAI tool-schema names for personal identity]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[gives resident triage a structured request category without its subject]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[gives turnover scoping distinct controlled condition evidence without either subject]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[gives vendor reasoning a controlled symptom, trade, and urgency only]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[gives violation grading its controlled violation type without its subject]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[lets an ordinary payload through]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[materializes once so a stateful toJSON cannot change after the scan]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[never repeats the value it found]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[preserves AbortSignal outside the materialized model body]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[rejects a generic bare name when it arrives in an identity-shaped field]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[reports every finding, not just the first, so one fix does not reveal another]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[scans structured content too, not just strings]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[scans the toJSON value the provider would serialize]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[starts the next invocation clean instead of carrying permanent poison]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[stays quiet on: ${s.slice(0, 46)}…]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[throws rather than redacting, so no clerk reasons on altered evidence]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[withholds fallback events after a clerk swallows a context refusal]] — *imported by the test FILE (shared source, not a claim about this one test)*

## Documents that cite this source

*These name this FILE by its path. That is a citation of the source, not a claim about any one idea inside it — do not read a path citation as agreement, dependence or implementation.*

- [[Writ — The Gate: the money law is written and nothing enforces it]]

---

*Generated by `tools/vault/emit.mjs` from `src/domain/contextGuard.ts`:1. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
