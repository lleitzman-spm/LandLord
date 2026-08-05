---
type: "module"
id: "module:src/domain/tenureMuster.ts"
title: "src/domain/tenureMuster.ts"
standing: "built"
standing_source: "knowledge/artifacts.json"
source_path: "src/domain/tenureMuster.ts"
source_line: 1
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "module:src/domain/tenureMuster.ts"
---

# src/domain/tenureMuster.ts

> **STANDING — BUILT**  
> Implemented in code and checkable against the tree.  
> *Declared in `knowledge/artifacts.json`.*

350 lines · 13 exported symbols.

## What the file says of itself

> The muster, placed in the hierarchy — the join between the doors in PLAY and
> the tenure book (docs/WRIT-THE-WAR-TABLE.md §5; `src/domain/tenure.ts`).
> 
> §5 commands that "every door row carries realm, shire-or-march, fee, and
> knight from the first migration", and the hierarchy's own `Door` does. THE
> DOORS ACTUALLY IN PLAY DO NOT. A muster's doors are `WarDoor`s — an address
> and an owner, persisted inside `chronicle.wargame.doors` — and they were left
> alone on purpose: adding a required field to a STORED record is the "a stored
> value disagrees with the code after a change" fault this codebase has

## Shape

- **Lines:** 350
- **Exported symbols (13):** `DoorPlacement`, `MusterTenureReading`, `MusteredDoor`, `TenureTally`, `UNPLACED_SAYS`, `UnplacedReason`, `WAR_DOOR_CARRIES_NO_TENURE`, `WAR_DOOR_IS_A_MUSTERED_DOOR`, `doorKey`, `musteredFromRoster`, `placedShare`, `readMusterTenure`, `unplacedAddresses`

## Modules

- [[src/domain/estate.ts]] — *imported by this file*
- [[src/domain/tenure.ts]] — *imported by this file*
- [[src/domain/wargame.ts]] — *imported by this file*

## Backlinks

### Invariants that enforce it

*These roads come from a shared source FILE, not from a semantic claim: the test file imports the module. Read it as "stands near", never as "proves".*

- [[a book cut over the muster places EVERY door — the join is sound]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a craft standing headless holds it at a march]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a door in no knight’s care is a real state, and reads as debt]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a door the book does not hold reads UNPLACED, and is named]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a door the book holds places cleanly — realm, shire, fee and knight]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a door’s shire and its fee stand in the SAME realm as the door]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a fee scattered across two shires reads fine, and rolls up as ONE fee]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a fee with doors scattered across three metros reads fine]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a fee’s patron at odds with the muster’s owner is a finding, not a refusal]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a headless craft holds back EVERY metro, not one — the household is shared]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a march PROMOTES when the records change, with no field written]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a name the book does not hold reads as NOTHING rather than throwing]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a placed door in no knight’s care is NOT unplaced — it is the debt]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a realm’s edicts read soonest-due first]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a row naming a place the book does not hold reads unplaced, and says WHICH]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a shire DEMOTES again when the records go the other way]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a tenure realm is a PLACE — a name and a sovereign, and no score on it]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a war door and an estate roster both go straight in]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a war door carries NO tenure of its own — only an address and an owner]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[all three failing at once names all three]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an ANSWERED edict is never late, however long the day is gone]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an empty muster reads empty, not broken]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an owed edict PRESSES as its day nears]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[doors the hierarchy cannot place count toward NO metro’s standing]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every door names a realm, a shire and a fee the book holds]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every edict names a realm the book holds]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every fee names a realm the book holds]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every founding door bears all four keys]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every id in the book is unique within its kind]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every metro of the joined book reads its standing, marches first]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every realm names a sovereign — a realm with no law is not a realm]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every shire names a realm the book holds]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[lateness is READ from the day against the clock, never stored]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[no founding fee bears any word that describes a place]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[no knight seated there holds it at a march]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[no record anywhere in the book stores a standing]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[ONE door short holds it at a march, and says which clause failed]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the book reaches ONE door in two hundred — the finding, said as a number]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the control reads a SHIRE — all three clauses hold]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the Fee shape itself holds only id, realm, name and patron]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the FOUNDING book already scatters a fee across two metros]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the founding book reads one shire and one march]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the founding realm carries an edict of every kind]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the household’s craft reading satisfies what the standing asks of it]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the key forgives case, spacing and a tenant suffix — and nothing else]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the muster’s doors decide the standing, not the founding book’s]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the reading counts the metro’s own doors, knights and fees]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the shapes stay what they say they are]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the whole founding book, mustered, rolls up to the counts the shelf reads]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[two rows for one door are SAID, not chosen in silence]] — *imported by the test FILE (shared source, not a claim about this one test)*

---

*Generated by `tools/vault/emit.mjs` from `src/domain/tenureMuster.ts`:1. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
