---
type: "module"
id: "module:src/domain/types.ts"
title: "src/domain/types.ts"
standing: "built"
standing_source: "knowledge/artifacts.json"
source_path: "src/domain/types.ts"
source_line: 1
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "module:src/domain/types.ts"
---

# src/domain/types.ts

> **STANDING — BUILT**  
> Implemented in code and checkable against the tree.  
> *Declared in `knowledge/artifacts.json`.*

105 lines · 11 exported symbols.

## What the file says of itself

> The Kingdom's data model. See docs/KINGDOM.md — that document is canon;
> this file implements it.

## Shape

- **Lines:** 105
- **Exported symbols (11):** `Fealty`, `FiefState`, `GarrisonPosting`, `Grant`, `HamletState`, `KeeperAppointment`, `Kingdom`, `Person`, `PledgeType`, `Territory`, `TerritoryKind`

## Entities

- [[Fief (territory kind)]] — *the same file `src/domain/types.ts`, seen as a entity rather than a module*
- [[Grant (record)]] — *the same file `src/domain/types.ts`, seen as a entity rather than a module*
- [[Hamlet (territory kind)]] — *the same file `src/domain/types.ts`, seen as a entity rather than a module*
- [[Keeper appointment (record)]] — *the same file `src/domain/types.ts`, seen as a entity rather than a module*
- [[Office (territory kind)]] — *the same file `src/domain/types.ts`, seen as a entity rather than a module*

## Backlinks

### Entities

- [[Artisan]] — *declared in `knowledge/entities.json`*
- [[Fealty (record)]] — *declared in `knowledge/entities.json`*
- [[Fief (territory kind)]] — *names the exported symbol `TerritoryKind`; the same file `src/domain/types.ts`, seen as a module rather than a entity*
- [[Garrison posting (record)]] — *declared in `knowledge/entities.json`*
- [[Grant (record)]] — *the same file `src/domain/types.ts`, seen as a module rather than a entity*
- [[Hamlet (territory kind)]] — *the same file `src/domain/types.ts`, seen as a module rather than a entity*
- [[Keeper appointment (record)]] — *the same file `src/domain/types.ts`, seen as a module rather than a entity*
- [[King]] — *declared in `knowledge/entities.json`*
- [[Office (territory kind)]] — *the same file `src/domain/types.ts`, seen as a module rather than a entity*
- [[Regent]] — *declared in `knowledge/entities.json`*
- [[Squire]] — *declared in `knowledge/entities.json`*
- [[Vassal]] — *declared in `knowledge/entities.json`*

### Modules

- [[src/CensusView.tsx]] — *imported by this file*
- [[src/components.tsx]] — *imported by this file*
- [[src/CrownView.tsx]] — *imported by this file*
- [[src/domain/campaign.ts]] — *imported by this file*
- [[src/domain/census.ts]] — *imported by this file*
- [[src/domain/court.ts]] — *imported by this file*
- [[src/domain/courtTree.ts]] — *imported by this file*
- [[src/domain/guilds.ts]] — *imported by this file*
- [[src/domain/realm.ts]] — *imported by this file*
- [[src/domain/realmScene.ts]] — *imported by this file*
- [[src/domain/scribe.ts]] — *imported by this file*
- [[src/domain/states.ts]] — *imported by this file*
- [[src/domain/throne.ts]] — *imported by this file*
- [[src/domain/treasury.ts]] — *imported by this file*
- [[src/FiefView.tsx]] — *imported by this file*
- [[src/LedgerView.tsx]] — *imported by this file*
- [[src/PersonView.tsx]] — *imported by this file*
- [[src/store/chronicleStore.ts]] — *imported by this file*
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

- [[a Chancellor granted ONE fief holds one fief — an office is not land]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a fief with no grant draws NO lord — the Regent is not its lord]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a headless office reads as headless — never as somebody else’s]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a regency draws its keeper, not a lord]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a stale vault reads every craft headless — honestly, and fillable]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an artisan naming no trade is shown, not swallowed]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[but two fiefs under one lord IS a plurality]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[draws the Crown at the head, with its wards beneath it]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[EVERY enrolled subject is drawn somewhere — the totality guarantee]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[folds the outside trades from their hands’ own notes]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[gathers several hands of one trade under that one guild]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[hangs knights under their fief’s lord, and squires under their knight]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[names NO keep when the office it declares is not in the census]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[names no trade where the note names none]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[no fief stands at the founding — an empty land, read honestly]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[reads a master once the office is founded and granted — the act STICKS]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[reads the trade out of a sentence]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[seats all three Crown offices with their Chancellors]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[still names the declared office where it DOES stand]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[takes at most two words before "guild" — never a whole clause]] — *imported by the test FILE (shared source, not a claim about this one test)*

## Documents that cite this source

*These name this FILE by its path. That is a citation of the source, not a claim about any one idea inside it — do not read a path citation as agreement, dependence or implementation.*

- [[Writ — the Land: pods, knights, owners, and guilds (the realm remodeled)]]

---

*Generated by `tools/vault/emit.mjs` from `src/domain/types.ts`:1. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
