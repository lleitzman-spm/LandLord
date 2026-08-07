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
- [[src/domain/tenure.ts]] — *imported by this file*
- [[src/WarTableView.tsx]] — *imported by this file*

### Surfaces

- [[WarTableView]] — *imported by this view*

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
- [[a fold into itself, or into nothing, changes no record]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a headless craft holds back EVERY metro, not one — the household is shared]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a march PROMOTES when the records change, with no field written]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a MAYOR grant does not seat a Chancellor — mayor is the line of trade]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a name the book does not hold reads as NOTHING rather than throwing]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a placed door in no knight’s care is NOT unplaced — it is the debt]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a realm’s edicts read soonest-due first]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a row naming a place the book does not hold reads unplaced, and says WHICH]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a shire DEMOTES again when the records go the other way]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a stale vault reads every craft headless — honestly, and fillable]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a tenure realm is a PLACE — a name and a sovereign, and no score on it]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a war door and an estate roster both go straight in]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a war door carries NO tenure of its own — only an address and an owner]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act five is met by holding the watch with no door in crisis]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act four is met by ANSWERING three of the clerks’ proposals]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act one is met by SEATING the empty craft — a record, not a flag]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act six is met by ending a month in the black]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act three is met by getting the boxes onto real desks]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act two is met by WALKING a cascade to done]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[all three failing at once names all three]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an ANSWERED edict is never late, however long the day is gone]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an empty muster reads empty, not broken]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an office cannot be folded into a fief — the destructive path, shut]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an office cannot be raised to a fief either]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an owed edict PRESSES as its day nears]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[but LAND still moves both ways — the guard is not a wall around everything]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[deals six cascades, four boxes on the Regent, and two raw tickets]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[deals the scenario’s doors and knights]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[doors the hierarchy cannot place count toward NO metro’s standing]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every catalog row an act names stands in the catalog]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every door names a realm, a shire and a fee the book holds]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every edict names a realm the book holds]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every fee names a realm the book holds]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every flow key an act names stands in the flow book]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every founding door bears all four keys]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every goal reads UNMET on a fresh deploy]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every goal reads UNMET when no holding is dealt at all]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every id in the book is unique within its kind]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every metro of the joined book reads its standing, marches first]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every named box and cascade actually LANDS on the board]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every office an act leaves headless stands in the census]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every office is seated by a LORD-role grant, and reads as headed]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every realm names a sovereign — a realm with no law is not a realm]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every seat an act names resolves]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every shire names a realm the book holds]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every step of every named flow resolves — row, holder and key]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is meaningfully SMALLER than the grand muster]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is SOLVENT at rest, with a margin, and the Crown’s own coin is not gone]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[lateness is READ from the day against the clock, never stored]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[names NO keep when the office it declares is not in the census]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[no founding fee bears any word that describes a place]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[no knight seated there holds it at a march]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[no record anywhere in the book stores a standing]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[nothing dealt is STALE — the clock starts clean]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[ONE door short holds it at a march, and says which clause failed]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[reads a master once the office is founded and granted — the act STICKS]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[still names the declared office where it DOES stand]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the book reaches ONE door in two hundred — the finding, said as a number]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the control reads a SHIRE — all three clauses hold]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the Fee shape itself holds only id, realm, name and patron]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the FOUNDING book already scatters a fee across two metros]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the founding book reads one shire and one march]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the founding census holds three offices and no fief]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the founding realm carries an edict of every kind]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the grand muster is UNCHANGED by the campaign’s knobs — a GOLDEN fingerprint]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the household’s craft reading satisfies what the standing asks of it]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the key forgives case, spacing and a tenant suffix — and nothing else]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the law names WHICH territories may change standing]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the muster’s doors decide the standing, not the founding book’s]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the reading counts the metro’s own doors, knights and fees]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the scribe names an office-holder a CHANCELLOR, not a lord]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the shapes stay what they say they are]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the THE_REGENT role resolves against the census it is dealt into]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the two readings AGREE about who heads an office]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the whole founding book, mustered, rolls up to the counts the shelf reads]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the whole realm reading carries no office among its fiefs]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[two proposals answered on ONE case count as two]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[two rows for one door are SAID, not chosen in silence]] — *imported by the test FILE (shared source, not a claim about this one test)*

## Documents that cite this source

*These name this FILE by its path. That is a citation of the source, not a claim about any one idea inside it — do not read a path citation as agreement, dependence or implementation.*

- [[Handoff — where things stand]]
- [[The Kingdom — Canon]]
- [[Writ — The Knighthood: one seat, a Regent that is an agent, and the fief as a desk]]
- [[Writ — the Land: pods, knights, owners, and guilds (the realm remodeled)]]

---

*Generated by `tools/vault/emit.mjs` from `src/domain/guilds.ts`:1. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
