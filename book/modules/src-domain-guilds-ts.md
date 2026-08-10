---
type: "module"
id: "module:src/domain/guilds.ts"
title: "src/domain/guilds.ts"
standing: "built"
standing_source: "knowledge/artifacts.json"
source_path: "src/domain/guilds.ts"
source_line: 1
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "module:src/domain/guilds.ts"
---

# src/domain/guilds.ts

> **STANDING — BUILT**  
> Implemented in code and checkable against the tree.  
> *Declared in `knowledge/artifacts.json`.*

193 lines · 8 exported symbols.

## What the file says of itself

> THE CROWN OFFICES — the household's own crafts (docs/WRIT-THE-BROKERAGE.md,
> ratified 2026-07-27; docs/KINGDOM.md, "Territories", amended 2026-07-29).
> 
> There are three: the Office of Works, the Office of Tenancy, and the
> Chancery, each headed by a CHANCELLOR. They are seated in the palace and
> they are NEVER LAND — an office has no geometry, never appears on the map,
> cannot be folded into a fief or raised to one, and no outside artisan may
> keep it. A Chancellor's seat is a lord-role grant on an office.
> 
> **The word GUILD now means an OUTSIDE TRADE** — the roofers, the lenders,
> outside counsel — a

## Shape

- **Lines:** 193
- **Exported symbols (8):** `FOUNDING_GUILDS`, `Guild`, `GuildReading`, `SEAT_GUILD`, `keepOf`, `readGuilds`, `seatGuild`, `unmannedGuilds`

## Entities

- [[FOUNDING_GUILDS still names Crown offices, not outside trades]] — *the same file `src/domain/guilds.ts`, seen as a entity rather than a module*

## Modules

- [[src/domain/events.ts]] — *imported by this file*
- [[src/domain/types.ts]] — *imported by this file*

## Backlinks

### Writs that specify it

- [[Handoff — where things stand]] — *this writ names the exported symbol `SEAT_GUILD`*
- [[The Kingdom — Canon]] — *this writ names the exported symbol `readGuilds`*
- [[Writ — The Knighthood: one seat, a Regent that is an agent, and the fief as a desk]] — *this writ names the exported symbol `GuildReading`; this writ names the exported symbol `SEAT_GUILD`*
- [[Writ — the Land: pods, knights, owners, and guilds (the realm remodeled)]] — *this writ names the exported symbol `FOUNDING_GUILDS`; this writ names the exported symbol `GuildReading`; +3 more*
- [[Writ — the Muster Library and the Intro Campaign]] — *this writ names the exported symbol `keepOf`*

### Entities

- [[FOUNDING_GUILDS still names Crown offices, not outside trades]] — *names the exported symbol `FOUNDING_GUILDS`; names the exported symbol `GuildReading`; +1 more*
- [[The Chancery]] — *declared in `knowledge/entities.json`*
- [[The Office of Tenancy]] — *declared in `knowledge/entities.json`*
- [[The Office of Works]] — *declared in `knowledge/entities.json`*

### Modules

- [[src/domain/campaign.ts]] — *imported by this file*
- [[src/domain/docket.ts]] — *imported by this file*
- [[src/domain/realm.ts]] — *imported by this file*
- [[src/WarTableView.tsx]] — *imported by this file*

### Surfaces

- [[WarTableView]] — *imported by this view*

### Invariants that enforce it

*These roads come from a shared source FILE, not from a semantic claim: the test file imports the module. Read it as "stands near", never as "proves".*

- [[a fold into itself, or into nothing, changes no record]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a MAYOR grant does not seat a Chancellor — mayor is the line of trade]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a stale vault reads every craft headless — honestly, and fillable]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act five is met by holding the watch with no door in crisis]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act four is met by ANSWERING three of the clerks’ proposals]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act one is met by SEATING the empty craft — a record, not a flag]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act six is met by ending a month in the black]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act three is met by getting the boxes onto real desks]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act two is met by WALKING a cascade to done]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an office cannot be folded into a fief — the destructive path, shut]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an office cannot be raised to a fief either]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[but LAND still moves both ways — the guard is not a wall around everything]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[deals six cascades, four boxes on the Regent, and two raw tickets]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[deals the scenario’s doors and knights]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every catalog row an act names stands in the catalog]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every flow key an act names stands in the flow book]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every goal reads UNMET on a fresh deploy]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every goal reads UNMET when no holding is dealt at all]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every named box and cascade actually LANDS on the board]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every office an act leaves headless stands in the census]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every office is seated by a LORD-role grant, and reads as headed]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every seat an act names resolves]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every step of every named flow resolves — row, holder and key]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is meaningfully SMALLER than the grand muster]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is SOLVENT at rest, with a margin, and the Crown’s own coin is not gone]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[names NO keep when the office it declares is not in the census]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[nothing dealt is STALE — the clock starts clean]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[reads a master once the office is founded and granted — the act STICKS]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[still names the declared office where it DOES stand]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the founding census holds three offices and no fief]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the grand muster is UNCHANGED by the campaign’s knobs — a GOLDEN fingerprint]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the law names WHICH territories may change standing]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the scribe names an office-holder a CHANCELLOR, not a lord]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the THE_REGENT role resolves against the census it is dealt into]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the two readings AGREE about who heads an office]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the whole realm reading carries no office among its fiefs]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[two proposals answered on ONE case count as two]] — *imported by the test FILE (shared source, not a claim about this one test)*

## Documents that cite this source

*These name this FILE by its path. That is a citation of the source, not a claim about any one idea inside it — do not read a path citation as agreement, dependence or implementation.*

- [[Handoff — where things stand]]
- [[The Kingdom — Canon]]
- [[Writ — The Knighthood: one seat, a Regent that is an agent, and the fief as a desk]]
- [[Writ — the Land: pods, knights, owners, and guilds (the realm remodeled)]]

---

*Generated by `tools/vault/emit.mjs` from `src/domain/guilds.ts`:1. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
