---
type: "module"
id: "module:src/domain/states.ts"
title: "src/domain/states.ts"
standing: "built"
standing_source: "knowledge/artifacts.json"
source_path: "src/domain/states.ts"
source_line: 1
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "module:src/domain/states.ts"
---

# src/domain/states.ts

> **STANDING — BUILT**  
> Implemented in code and checkable against the tree.  
> *Declared in `knowledge/artifacts.json`.*

178 lines · 10 exported symbols.

## What the file says of itself

> The state machine. States are always computed from the records, never
> stored — lordlessness is a reading on the gauge, not an error.

## Shape

- **Lines:** 178
- **Exported symbols (10):** `FIEF_STATE_LABEL`, `FiefReading`, `HAMLET_STATE_LABEL`, `HamletReading`, `king`, `readFief`, `readKingdom`, `regent`, `regentsDesk`, `squiresOf`

## Entities

- [[FiefReading]] — *the same file `src/domain/states.ts`, seen as a entity rather than a module*
- [[Lorded (fief state)]] — *the same file `src/domain/states.ts`, seen as a entity rather than a module*

## Modules

- [[src/domain/types.ts]] — *imported by this file*

## Backlinks

### Writs that specify it

- [[Writ — the Land: pods, knights, owners, and guilds (the realm remodeled)]] — *this writ names the exported symbol `readKingdom`; this writ names the exported symbol `regentsDesk`*

### Entities

- [[FiefReading]] — *names the exported symbol `FiefReading`; the same file `src/domain/states.ts`, seen as a module rather than a entity*
- [[Lorded (fief state)]] — *the same file `src/domain/states.ts`, seen as a module rather than a entity*

### Modules

- [[src/CensusView.tsx]] — *imported by this file*
- [[src/CrownView.tsx]] — *imported by this file*
- [[src/domain/campaign.ts]] — *imported by this file*
- [[src/domain/courtTree.ts]] — *imported by this file*
- [[src/domain/docket.ts]] — *imported by this file*
- [[src/domain/realmScene.ts]] — *imported by this file*
- [[src/domain/throne.ts]] — *imported by this file*
- [[src/FiefView.tsx]] — *imported by this file*
- [[src/LedgerView.tsx]] — *imported by this file*
- [[src/PersonView.tsx]] — *imported by this file*
- [[src/WarTableView.tsx]] — *imported by this file*

### Surfaces

- [[CensusView]] — *imported by this view*
- [[CrownView]] — *imported by this view*
- [[FiefView]] — *imported by this view*
- [[LedgerView]] — *imported by this view*
- [[PersonView]] — *imported by this view*
- [[WarTableView]] — *imported by this view*

### Invariants that enforce it

*These roads come from a shared source FILE, not from a semantic claim: the test file imports the module. Read it as "stands near", never as "proves".*

- [[a clean founding brings NOTHING — the household is fully staffed]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a clerk’s proposal is heard ONCE — never also as a bare waiting case]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a craft left headless IS brought before the court]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a CRISIS outranks a fresh matter, and held COIN outranks a bare wait]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a fold into itself, or into nothing, changes no record]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a MAYOR grant does not seat a Chancellor — mayor is the line of trade]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an ancient trifle never outranks today’s crisis — age does not compound forever]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an office cannot be folded into a fief — the destructive path, shut]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an office cannot be raised to a fief either]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[but LAND still moves both ways — the guard is not a wall around everything]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[caps what one court hears, keeping the heaviest and still every kind]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every office is seated by a LORD-role grant, and reads as headed]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[gathers matters from EVERY department — not one kind of thing]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is a READING — answering elsewhere simply stops it being brought]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is ordered heaviest FIRST — the docket never rises]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[no ONE kind starves the rest — the standing debts are always heard]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the founding census holds three offices and no fief]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the law names WHICH territories may change standing]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the scribe names an office-holder a CHANCELLOR, not a lord]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the two readings AGREE about who heads an office]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the whole realm reading carries no office among its fiefs]] — *imported by the test FILE (shared source, not a claim about this one test)*

---

*Generated by `tools/vault/emit.mjs` from `src/domain/states.ts`:1. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
