---
type: "module"
id: "module:src/domain/treasury.ts"
title: "src/domain/treasury.ts"
standing: "built"
standing_source: "knowledge/artifacts.json"
source_path: "src/domain/treasury.ts"
source_line: 1
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "module:src/domain/treasury.ts"
---

# src/domain/treasury.ts

> **STANDING — BUILT**  
> Implemented in code and checkable against the tree.  
> *Declared in `knowledge/artifacts.json`.*

241 lines · 14 exported symbols.

## What the file says of itself

> The Treasury: the kingdom's coin, kept the constitutional way — records
> in, readings out. Version one records upkeep: the recurring monthly cost
> of the kingdom's structure. The reading that matters to the mission is
> how much coin flows to artisans: foreign hands are not only a
> delegation debt, they are a priced one. See docs/KINGDOM.md.

## Shape

- **Lines:** 241
- **Exported symbols (14):** `Coffers`, `EMPTY_TREASURY`, `RENT_PER_DOOR`, `TRIBUTE_PER_DOOR`, `TreasuryLedger`, `Upkeep`, `UpkeepLine`, `WAR_HOUSEHOLD`, `coin`, `isHouseholdUpkeep`, `monthlyOf`, `readCoffers`, `upkeepForPerson`, `upkeepForTerritories`

## Facts it depends on

- [[Rent per door]] — *the same file `src/domain/treasury.ts`, seen as a fact rather than a module*
- [[Tribute (management fee) per door]] — *the same file `src/domain/treasury.ts`, seen as a fact rather than a module*

## Entities

- [[Coffers (reading)]] — *the same file `src/domain/treasury.ts`, seen as a entity rather than a module*

## Modules

- [[src/domain/economy.ts]] — *imported by this file*
- [[src/domain/types.ts]] — *imported by this file*

## Backlinks

### Writs that specify it

- [[The Kingdom — Canon]] — *this writ names the exported symbol `readCoffers`; this writ names the exported symbol `RENT_PER_DOOR`; +1 more*
- [[Writ — the economy pillar, re-expressed as chronicle readings]] — *this writ names the exported symbol `readCoffers`*

### Facts it depends on

- [[Rent per door]] — *declared in `knowledge/facts.json`; the same file `src/domain/treasury.ts`, seen as a module rather than a fact*
- [[Tribute (management fee) per door]] — *declared in `knowledge/facts.json`; the same file `src/domain/treasury.ts`, seen as a module rather than a fact*

### Entities

- [[Coffers (reading)]] — *the same file `src/domain/treasury.ts`, seen as a module rather than a entity*
- [[Upkeep]] — *declared in `knowledge/entities.json`*

### Modules

- [[src/domain/campaign.ts]] — *imported by this file*
- [[src/domain/chronicle.ts]] — *imported by this file*
- [[src/domain/pods.ts]] — *imported by this file*
- [[src/domain/realm.ts]] — *imported by this file*
- [[src/domain/wargame.ts]] — *imported by this file*
- [[src/FiefView.tsx]] — *imported by this file*
- [[src/PersonView.tsx]] — *imported by this file*
- [[src/store/chronicleStore.ts]] — *imported by this file*
- [[src/wargame-core.ts]] — *imported by this file*
- [[src/WarTableView.tsx]] — *imported by this file*

### Surfaces

- [[FiefView]] — *imported by this view*
- [[PersonView]] — *imported by this view*
- [[WarTableView]] — *imported by this view*

### Invariants that enforce it

*These roads come from a shared source FILE, not from a semantic claim: the test file imports the module. Read it as "stands near", never as "proves".*

- [[a bare census is never dry — there is nothing to be broke with]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a clean founding brings NOTHING — the household is fully staffed]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a clerk’s proposal is heard ONCE — never also as a bare waiting case]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a craft left headless IS brought before the court]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a crisis on a leased door OUTRANKS its lease — the map shows trouble]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a CRISIS outranks a fresh matter, and held COIN outranks a bare wait]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a full TRUST account never saves the Crown — that coin is not its own]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a neglected operation loses doors until tribute drops below upkeep — RED, fallen]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a one-off company expense does NOT become the standing monthly upkeep]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a solvent operation clears its upkeep — black, not fallen]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a standing muster reveals a realm of towns, every door a building]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act five is met by holding the watch with no door in crisis]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act four is met by ANSWERING three of the clerks’ proposals]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act one is met by SEATING the empty craft — a record, not a flag]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act six is met by ending a month in the black]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act three is met by getting the boxes onto real desks]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act two is met by WALKING a cascade to done]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an ancient trifle never outranks today’s crisis — age does not compound forever]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[caps what one court hears, keeping the heaviest and still every kind]] — *imported by the test FILE (shared source, not a claim about this one test)*
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
- [[every town has exactly ONE manor, and every building a stable slug id]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[gathers matters from EVERY department — not one kind of thing]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is a READING — answering elsewhere simply stops it being brought]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is meaningfully SMALLER than the grand muster]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is ordered heaviest FIRST — the docket never rises]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is SOLVENT at rest, with a margin, and the Crown’s own coin is not gone]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[no muster stands ⇒ the land lies UNREVEALED, and no town is drawn]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[no ONE kind starves the rest — the standing debts are always heard]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[nothing dealt is STALE — the clock starts clean]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[reads BOTH corporate banks, not just the operating one]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[still weighs a hand-recorded cost when no upkeep book stands]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[THE BUG, pinned: a dealt grand muster runs red but is NOT broke]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the coffers ARE dry when the Crown’s own banks run out]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the doors read held / vacant / crisis — all three states are drawn]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the grand muster is UNCHANGED by the campaign’s knobs — a GOLDEN fingerprint]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the HUD carries only the coffers’ trend, the red month and the fall — no scoreboard]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the id hash is stable and well spread — the view places from it]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the reading and the VIEW’s contract are the same shape — the firewall holds]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the scene is PURE — the same records fold the same map, twice]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the THE_REGENT role resolves against the census it is dealt into]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the two readings are genuinely independent]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the UPKEEP BOOK is the monthly rate — the money log is only the fallback]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[tribute per door comes from the economy management fee rule (not a hardcode)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[two proposals answered on ONE case count as two]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[with no game standing, upkeep falls back to the treasury rolls]] — *imported by the test FILE (shared source, not a claim about this one test)*

---

*Generated by `tools/vault/emit.mjs` from `src/domain/treasury.ts`:1. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
