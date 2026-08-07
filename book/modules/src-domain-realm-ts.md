---
type: "module"
id: "module:src/domain/realm.ts"
title: "src/domain/realm.ts"
standing: "built"
standing_source: "knowledge/artifacts.json"
source_path: "src/domain/realm.ts"
source_line: 1
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "module:src/domain/realm.ts"
---

# src/domain/realm.ts

> **STANDING — BUILT**  
> Implemented in code and checkable against the tree.  
> *Declared in `knowledge/artifacts.json`.*

110 lines · 2 exported symbols.

## What the file says of itself

> The realm — the Regent's whole reading, remodeled (docs/WRIT-THE-LAND.md,
> Phase 3; docs/KINGDOM.md, "The realm remodeled"). The delegation debt the
> Regent drives to zero is no longer "unlorded fiefs + unseated boxes" but the
> reconciled objective: EVERY OWNER IN A KNIGHT'S CARE, EVERY CROWN OFFICE HEADED, EVERY
> BOX OF WORK ON A REAL DESK — and grow by recruiting knights.
> 
> A fusion reading, like the Throne it stands beside: it folds the pods (the
> org's new allocation), the guilds (the functions), and the operator's unseated
> work into one number. Everything is a reading against the effective cloc

## Shape

- **Lines:** 110
- **Exported symbols (2):** `RealmReading`, `readRealm`

## Entities

- [[RealmReading (a score, not a place)]] — *the same file `src/domain/realm.ts`, seen as a entity rather than a module*

## Modules

- [[src/domain/consequences.ts]] — *imported by this file*
- [[src/domain/economy.ts]] — *imported by this file*
- [[src/domain/events.ts]] — *imported by this file*
- [[src/domain/guilds.ts]] — *imported by this file*
- [[src/domain/pods.ts]] — *imported by this file*
- [[src/domain/throne.ts]] — *imported by this file*
- [[src/domain/treasury.ts]] — *imported by this file*
- [[src/domain/types.ts]] — *imported by this file*

## Backlinks

### Writs that specify it

- [[Handoff — where things stand]] — *this writ names the exported symbol `readRealm`*
- [[The Kingdom — Canon]] — *this writ names the exported symbol `readRealm`*
- [[Writ — the Land: pods, knights, owners, and guilds (the realm remodeled)]] — *this writ names the exported symbol `readRealm`*
- [[Writ — the War Table (the front-end direction)]] — *this writ names the exported symbol `readRealm`; this writ names the exported symbol `RealmReading`*

### Decisions that touched it

- [[Realm and marches are not renamed despite the naming collision]] — *names the exported symbol `RealmReading`*

### Entities

- [[RealmReading (a score, not a place)]] — *names the exported symbol `RealmReading`; the same file `src/domain/realm.ts`, seen as a module rather than a entity*

### Modules

- [[src/domain/realmScene.ts]] — *imported by this file*
- [[src/WarTableView.tsx]] — *imported by this file*

### Surfaces

- [[WarTableView]] — *imported by this view*

### Invariants that enforce it

*These roads come from a shared source FILE, not from a semantic claim: the test file imports the module. Read it as "stands near", never as "proves".*

- [[a clean founding brings NOTHING — the household is fully staffed]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a clerk’s proposal is heard ONCE — never also as a bare waiting case]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a craft left headless IS brought before the court]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a crisis on a leased door OUTRANKS its lease — the map shows trouble]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a CRISIS outranks a fresh matter, and held COIN outranks a bare wait]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a standing muster reveals a realm of towns, every door a building]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an ancient trifle never outranks today’s crisis — age does not compound forever]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[caps what one court hears, keeping the heaviest and still every kind]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every town has exactly ONE manor, and every building a stable slug id]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[gathers matters from EVERY department — not one kind of thing]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is a READING — answering elsewhere simply stops it being brought]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is ordered heaviest FIRST — the docket never rises]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[no muster stands ⇒ the land lies UNREVEALED, and no town is drawn]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[no ONE kind starves the rest — the standing debts are always heard]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the doors read held / vacant / crisis — all three states are drawn]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the HUD carries only the coffers’ trend, the red month and the fall — no scoreboard]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the id hash is stable and well spread — the view places from it]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the reading and the VIEW’s contract are the same shape — the firewall holds]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the scene is PURE — the same records fold the same map, twice]] — *imported by the test FILE (shared source, not a claim about this one test)*

## Documents that cite this source

*These name this FILE by its path. That is a citation of the source, not a claim about any one idea inside it — do not read a path citation as agreement, dependence or implementation.*

- [[Handoff — where things stand]]
- [[Writ — the War Table (the front-end direction)]]

---

*Generated by `tools/vault/emit.mjs` from `src/domain/realm.ts`:1. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
