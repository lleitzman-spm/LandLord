---
type: "module"
id: "module:src/domain/courtTree.ts"
title: "src/domain/courtTree.ts"
standing: "built"
standing_source: "knowledge/artifacts.json"
source_path: "src/domain/courtTree.ts"
source_line: 1
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "module:src/domain/courtTree.ts"
---

# src/domain/courtTree.ts

> **STANDING — BUILT**  
> Implemented in code and checkable against the tree.  
> *Declared in `knowledge/artifacts.json`.*

250 lines · 7 exported symbols.

## What the file says of itself

> The court tree — the realm's SHAPE, folded from the census and the acts
> (docs/WRIT-THE-BROKERAGE.md, "The CENSUS, rebuilt"). Edwin: *"move away from
> it feeling just like a website scrolling list"*, with *"clear sections for the
> different types of subjects, that also allows for subject management."*
> 
> So this is not a roster. It is who answers to whom, drawn:
> 
>   The Crown  (King · the Regent in his name)
>        │
>   the Offices  — the household's own crafts, seated in the palace, never land
>        │
>   the Lords  — a fief's lord: the team lead, an agent

## Shape

- **Lines:** 250
- **Exported symbols (7):** `CourtTree`, `FiefCourtReading`, `KnightReading`, `OfficeReading`, `TradeReading`, `readCourtTree`, `tradeOf`

## Modules

- [[src/domain/states.ts]] — *imported by this file*
- [[src/domain/types.ts]] — *imported by this file*

## Backlinks

### Modules

- [[src/CensusView.tsx]] — *imported by this file*

### Surfaces

- [[CensusView]] — *imported by this view*

### Invariants that enforce it

*These roads come from a shared source FILE, not from a semantic claim: the test file imports the module. Read it as "stands near", never as "proves".*

- [[a Chancellor granted ONE fief holds one fief — an office is not land]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a fief with no grant draws NO lord — the Regent is not its lord]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a fold into itself, or into nothing, changes no record]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a headless office reads as headless — never as somebody else’s]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a MAYOR grant does not seat a Chancellor — mayor is the line of trade]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a regency draws its keeper, not a lord]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an artisan naming no trade is shown, not swallowed]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an office cannot be folded into a fief — the destructive path, shut]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an office cannot be raised to a fief either]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[but LAND still moves both ways — the guard is not a wall around everything]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[but two fiefs under one lord IS a plurality]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[draws the Crown at the head, with its wards beneath it]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[EVERY enrolled subject is drawn somewhere — the totality guarantee]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every office is seated by a LORD-role grant, and reads as headed]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[folds the outside trades from their hands’ own notes]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[gathers several hands of one trade under that one guild]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[hangs knights under their fief’s lord, and squires under their knight]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[names no trade where the note names none]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[no fief stands at the founding — an empty land, read honestly]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[reads the trade out of a sentence]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[seats all three Crown offices with their Chancellors]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[takes at most two words before "guild" — never a whole clause]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the founding census holds three offices and no fief]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the law names WHICH territories may change standing]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the scribe names an office-holder a CHANCELLOR, not a lord]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the two readings AGREE about who heads an office]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the whole realm reading carries no office among its fiefs]] — *imported by the test FILE (shared source, not a claim about this one test)*

---

*Generated by `tools/vault/emit.mjs` from `src/domain/courtTree.ts`:1. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
