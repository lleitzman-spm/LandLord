---
type: "module"
id: "module:src/domain/consequences.ts"
title: "src/domain/consequences.ts"
standing: "built"
standing_source: "knowledge/artifacts.json"
source_path: "src/domain/consequences.ts"
source_line: 1
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "module:src/domain/consequences.ts"
---

# src/domain/consequences.ts

> **STANDING — BUILT**  
> Implemented in code and checkable against the tree.  
> *Declared in `knowledge/artifacts.json`.*

233 lines · 15 exported symbols.

## What the file says of itself

> The consequence engine — neglect compounds, and the score is the kingdom's
> own health (docs/KINGDOM.md, "The task-language"; docs/WRIT-TASK-LANGUAGE.md,
> swing two 2b–2f). Ratified 2026-07-20 (Edwin): an unattended task FESTERS →
> CRISIS → the door's PATRON loses FAITH → the Patron WITHDRAWS their estate
> (their doors and their tribute) → the coffers bleed until upkeep drowns them
> → the kingdom falls.
> 
> Reading-first, as the constitution commands: severity, faith, withdrawal,
> and the doors at risk are all FOLDED from age and inaction against the
> clock — never stored. The one place the clock writes

## Shape

- **Lines:** 233
- **Exported symbols (15):** `CRISIS_DAYS`, `ESCALATE_AFTER_DAYS`, `ESCALATION_CAP`, `FESTER_DAYS`, `PatronReading`, `Severity`, `SeverityBand`, `WITHDRAW_FLOOR`, `doorOf`, `escalatedDoors`, `escalationCandidates`, `readPatrons`, `retainedDoors`, `severities`, `severityOf`

## Facts it depends on

- [[Crisis threshold]] — *the same file `src/domain/consequences.ts`, seen as a fact rather than a module*
- [[Escalation delay]] — *the same file `src/domain/consequences.ts`, seen as a fact rather than a module*
- [[Escalation spawn cap]] — *the same file `src/domain/consequences.ts`, seen as a fact rather than a module*
- [[Fester threshold]] — *the same file `src/domain/consequences.ts`, seen as a fact rather than a module*
- [[Patron withdrawal floor]] — *the same file `src/domain/consequences.ts`, seen as a fact rather than a module*

## Entities

- [[Patron]] — *the same file `src/domain/consequences.ts`, seen as a entity rather than a module*

## Modules

- [[src/domain/events.ts]] — *imported by this file*

## Backlinks

### Writs that specify it

- [[Writ — the Land: pods, knights, owners, and guilds (the realm remodeled)]] — *this writ names the exported symbol `doorOf`; this writ names the exported symbol `PatronReading`; +1 more*

### Facts it depends on

- [[Crisis threshold]] — *declared in `knowledge/facts.json`; the same file `src/domain/consequences.ts`, seen as a module rather than a fact*
- [[Escalation delay]] — *declared in `knowledge/facts.json`; the same file `src/domain/consequences.ts`, seen as a module rather than a fact*
- [[Escalation spawn cap]] — *declared in `knowledge/facts.json`; the same file `src/domain/consequences.ts`, seen as a module rather than a fact*
- [[Fester threshold]] — *declared in `knowledge/facts.json`; the same file `src/domain/consequences.ts`, seen as a module rather than a fact*
- [[Patron withdrawal floor]] — *declared in `knowledge/facts.json`; the same file `src/domain/consequences.ts`, seen as a module rather than a fact*

### Entities

- [[Patron]] — *names the exported symbol `PatronReading`; the same file `src/domain/consequences.ts`, seen as a module rather than a entity*
- [[The consequence engine]] — *declared in `knowledge/entities.json`*

### Modules

- [[src/domain/campaign.ts]] — *imported by this file*
- [[src/domain/docket.ts]] — *imported by this file*
- [[src/domain/pods.ts]] — *imported by this file*
- [[src/domain/realm.ts]] — *imported by this file*
- [[src/domain/realmScene.ts]] — *imported by this file*
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

---

*Generated by `tools/vault/emit.mjs` from `src/domain/consequences.ts`:1. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
