---
type: "module"
id: "module:src/domain/authority.ts"
title: "src/domain/authority.ts"
standing: "built"
standing_source: "knowledge/artifacts.json"
source_path: "src/domain/authority.ts"
source_line: 1
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "module:src/domain/authority.ts"
---

# src/domain/authority.ts

> **STANDING — BUILT**  
> Implemented in code and checkable against the tree.  
> *Declared in `knowledge/artifacts.json`.*

631 lines · 16 exported symbols.

## What the file says of itself

> The authority kernel: one pure refusal point between an outside command and
> the append-only Chronicle. Authentication names a principal; it does not
> grant an act. This module receives the already-authenticated principal, the
> current record, and an expiring grant from the server's trusted setting. It
> either mints the complete event batch or mints nothing.
> 
> This governs the deployed external command seam only. The game's internal
> helpers remain simulation machinery, not equivalent enforcement, and the
> untyped fleet route stays disabled until it speaks this protocol.

## Shape

- **Lines:** 631
- **Exported symbols (16):** `AuthorityCapability`, `AuthorityContext`, `AuthorityDecision`, `AuthorityGrant`, `AuthorityRefusalCode`, `AuthorizedKingdomEvent`, `CommandKind`, `EventAuthority`, `ExternalCommand`, `GrantedFlow`, `GrantedStepPolicy`, `caseVersion`, `catalogDigest`, `declaredFlowVersion`, `evaluateCommand`, `flowDigest`

## Modules

- [[src/domain/catalog.ts]] — *imported by this file*
- [[src/domain/chronicle.ts]] — *imported by this file*
- [[src/domain/events.ts]] — *imported by this file*
- [[src/domain/flows.ts]] — *imported by this file*

## Backlinks

### Modules

- [[src/server/command.ts]] — *imported by this file*

### Invariants that enforce it

*These roads come from a shared source FILE, not from a semantic claim: the test file imports the module. Read it as "stands near", never as "proves".*

- [[binds a trusted version to the complete flow digest]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[binds inherited unattended mode to the complete catalog digest]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[denies generic PUT on the canonical document too]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[denies generic PUT on the exact per-identity document used by commands]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[does not let a human complete around the distinct approval capability]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[does not replay an accepted command after a compare-and-set conflict]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is private at the Worker wall]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[keeps approval and override human-only even if an agent grant lists them]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[keeps the untyped fleet writer shut]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[lets the server mint a complete, provenance-bearing batch]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[persists only the server-minted event batch]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[refuses a second proposal while one already awaits judgment]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[refuses agent completion on human, outside-wait, and unresolved modes]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[refuses an accepted idempotency key on the same current case]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[refuses forged actors, expired or mismatched grants, and missing capabilities]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[refuses future, repeated, and stale step claims]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[refuses missing, unknown, and correction command fields]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[refuses stale evidence and policy versions]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[refuses unversioned and migrated-legacy flows operationally]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[rejects caller-supplied event shape before any write]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[requires trusted opaque cause references]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[requires trusted step money classification and an exact amount]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[uses collision-resistant case tokens]] — *imported by the test FILE (shared source, not a claim about this one test)*

## Documents that cite this source

*These name this FILE by its path. That is a citation of the source, not a claim about any one idea inside it — do not read a path citation as agreement, dependence or implementation.*

- [[ADR: One deny-by-default authority kernel]]

---

*Generated by `tools/vault/emit.mjs` from `src/domain/authority.ts`:1. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
