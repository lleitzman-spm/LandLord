---
type: "module"
id: "module:src/domain/pods.ts"
title: "src/domain/pods.ts"
standing: "built"
standing_source: "knowledge/artifacts.json"
source_path: "src/domain/pods.ts"
source_line: 1
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "module:src/domain/pods.ts"
---

# src/domain/pods.ts

> **STANDING — BUILT**  
> Implemented in code and checkable against the tree.  
> *Declared in `knowledge/artifacts.json`.*

172 lines · 10 exported symbols.

## What the file says of itself

> The pods — the fiefs of the reconciled realm (docs/WRIT-THE-LAND.md, Phase 2;
> docs/KINGDOM.md, "The realm remodeled"). A POD is a knight's book of business:
> a set of OWNERS (the Patrons) and their DOORS (the LAND). The realm grows by
> RECRUITING knights to hold new pods. This is the top-level holding the metaphor
> was missing — "LandLord" finally has land.
> 
> Reading-first and events-only, as the constitution commands (the law K3's pass
> broke and this build keeps): owners and doors are FOLDED from the War Game log
> (readPatrons already reads an owner with its doors and its faith); the only new
> reco

## Shape

- **Lines:** 172
- **Exported symbols (10):** `POD_CAPACITY`, `PodHealth`, `PodReading`, `commissionCaseId`, `emptyPods`, `knightsOf`, `placementCaseId`, `placements`, `readPods`, `unplacedOwners`

## Facts it depends on

- [[Pod capacity]] — *the same file `src/domain/pods.ts`, seen as a fact rather than a module*

## Entities

- [[Pod]] — *the same file `src/domain/pods.ts`, seen as a entity rather than a module*

## Modules

- [[src/domain/consequences.ts]] — *imported by this file*
- [[src/domain/events.ts]] — *imported by this file*
- [[src/domain/treasury.ts]] — *imported by this file*

## Backlinks

### Writs that specify it

- [[The Kingdom — Canon]] — *this writ names the exported symbol `readPods`; this writ names the exported symbol `unplacedOwners`*
- [[Writ — the Land: pods, knights, owners, and guilds (the realm remodeled)]] — *this writ names the exported symbol `POD_CAPACITY`; this writ names the exported symbol `readPods`; +1 more*

### Facts it depends on

- [[Pod capacity]] — *declared in `knowledge/facts.json`; the same file `src/domain/pods.ts`, seen as a module rather than a fact*

### Entities

- [[Pod]] — *the same file `src/domain/pods.ts`, seen as a module rather than a entity*

### Modules

- [[src/domain/realm.ts]] — *imported by this file*
- [[src/domain/realmScene.ts]] — *imported by this file*
- [[src/domain/wargame.ts]] — *imported by this file*
- [[src/store/chronicleStore.ts]] — *imported by this file*
- [[src/WarTableView.tsx]] — *imported by this file*

### Surfaces

- [[WarTableView]] — *imported by this view*

### Invariants that enforce it

*These roads come from a shared source FILE, not from a semantic claim: the test file imports the module. Read it as "stands near", never as "proves".*

- [[act five is met by holding the watch with no door in crisis]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act four is met by ANSWERING three of the clerks’ proposals]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act one is met by SEATING the empty craft — a record, not a flag]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act six is met by ending a month in the black]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act three is met by getting the boxes onto real desks]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act two is met by WALKING a cascade to done]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[deals six cascades, four boxes on the Regent, and two raw tickets]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[deals the scenario’s doors and knights]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every catalog row an act names stands in the catalog]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every flow key an act names stands in the flow book]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every goal reads UNMET on a fresh deploy]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every goal reads UNMET when no holding is dealt at all]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every named box and cascade actually LANDS on the board]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every office an act leaves headless stands in the census]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every seat an act names resolves]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every step of every named flow resolves — row, holder and key]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is meaningfully SMALLER than the grand muster]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is SOLVENT at rest, with a margin, and the Crown’s own coin is not gone]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[nothing dealt is STALE — the clock starts clean]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the grand muster is UNCHANGED by the campaign’s knobs — a GOLDEN fingerprint]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the THE_REGENT role resolves against the census it is dealt into]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[two proposals answered on ONE case count as two]] — *imported by the test FILE (shared source, not a claim about this one test)*

## Documents that cite this source

*These name this FILE by its path. That is a citation of the source, not a claim about any one idea inside it — do not read a path citation as agreement, dependence or implementation.*

- [[Writ — the Land: pods, knights, owners, and guilds (the realm remodeled)]]

---

*Generated by `tools/vault/emit.mjs` from `src/domain/pods.ts`:1. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
