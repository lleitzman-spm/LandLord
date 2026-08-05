---
type: "module"
id: "module:src/domain/campaign.ts"
title: "src/domain/campaign.ts"
standing: "built"
standing_source: "knowledge/artifacts.json"
source_path: "src/domain/campaign.ts"
source_line: 1
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "module:src/domain/campaign.ts"
---

# src/domain/campaign.ts

> **STANDING — BUILT**  
> Implemented in code and checkable against the tree.  
> *Declared in `knowledge/artifacts.json`.*

809 lines · 22 exported symbols.

## What the file says of itself

> The muster library and the Intro Campaign (docs/WRIT-THE-CAMPAIGN.md).
> 
> A SCENARIO is a recipe, never a recording. It stores the *intent* of a world
> — how many doors, how many knights, how much of what kind of work, at what
> age — and hands that intent to the generator we already have. Re-dealt
> against whatever the setting is, so a renamed step is a step the recipe
> re-reads by its new name (writ §I). Nothing on this shelf is a dumped event
> log: a log names catalog rows, flow keys and step keys that a rename quietly
> orphans, and it looks fine while being wrong.
> 
> An ACT's GOAL is a READING, never

## Shape

- **Lines:** 809
- **Exported symbols (22):** `Act`, `ActDeal`, `ActReading`, `BoxDeal`, `CAMPAIGN_FRESH_DAYS`, `CAMPAIGN_HOUSEHOLD`, `CAMPAIGN_MONTH_DAYS`, `CampaignContext`, `CampaignDeal`, `CampaignReading`, `CascadeDeal`, `GoalReading`, `INTRO_CAMPAIGN`, `MUSTER_LIBRARY`, `PROPOSALS_TO_ANSWER`, `Scenario`, `THE_REGENT`, `campaignMark`, `daysHeld`, `generateCampaign`, `readCampaign`, `vacateOffices`

## Facts it depends on

- [[Intro campaign — freshest backlog age at deploy]] — *the same file `src/domain/campaign.ts`, seen as a fact rather than a module*
- [[Intro campaign act four — proposals to answer]] — *the same file `src/domain/campaign.ts`, seen as a fact rather than a module*
- [[Intro campaign act six — a game month]] — *the same file `src/domain/campaign.ts`, seen as a fact rather than a module*

## Entities

- [[Scenario (the muster library's recipe shape)]] — *the same file `src/domain/campaign.ts`, seen as a entity rather than a module*

## Modules

- [[src/domain/catalog.ts]] — *imported by this file*
- [[src/domain/consequences.ts]] — *imported by this file*
- [[src/domain/court.ts]] — *imported by this file*
- [[src/domain/economy.ts]] — *imported by this file*
- [[src/domain/events.ts]] — *imported by this file*
- [[src/domain/flows.ts]] — *imported by this file*
- [[src/domain/guilds.ts]] — *imported by this file*
- [[src/domain/states.ts]] — *imported by this file*
- [[src/domain/treasury.ts]] — *imported by this file*
- [[src/domain/types.ts]] — *imported by this file*
- [[src/domain/wargame.ts]] — *imported by this file*

## Backlinks

### Facts it depends on

- [[Intro campaign — freshest backlog age at deploy]] — *declared in `knowledge/facts.json`; the same file `src/domain/campaign.ts`, seen as a module rather than a fact*
- [[Intro campaign act four — proposals to answer]] — *declared in `knowledge/facts.json`; the same file `src/domain/campaign.ts`, seen as a module rather than a fact*
- [[Intro campaign act six — a game month]] — *declared in `knowledge/facts.json`; the same file `src/domain/campaign.ts`, seen as a module rather than a fact*

### Entities

- [[Scenario (the muster library's recipe shape)]] — *the same file `src/domain/campaign.ts`, seen as a module rather than a entity*
- [[The grand muster]] — *declared in `knowledge/entities.json`*
- [[The Intro Campaign, "A Small Holding"]] — *declared in `knowledge/entities.json`*

### Modules

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

*Generated by `tools/vault/emit.mjs` from `src/domain/campaign.ts`:1. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
