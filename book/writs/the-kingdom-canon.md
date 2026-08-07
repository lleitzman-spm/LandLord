---
type: "writ"
id: "writ:docs/KINGDOM.md"
title: "The Kingdom — Canon"
standing: "canon"
standing_source: "knowledge/artifacts.json"
source_path: "docs/KINGDOM.md"
source_line: 1
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "writ:docs/KINGDOM.md"
---

# The Kingdom — Canon

> **STANDING — CANON**  
> Ratified in the constitution. Wins until amended; changing it is an amendment, not an edit.  
> *Declared in `knowledge/artifacts.json`.*

*Ratified 2026-07-17. This document is the constitution of LandLord. The app implements this model; when the app and this document disagree, this document wins until amended.*

## The source, verbatim

> *Ratified 2026-07-17. This document is the constitution of LandLord. The app implements this
> model; when the app and this document disagree, this document wins until amended.*

*Verified against `docs/KINGDOM.md`:1 on every lint — no quote, no object.*

## Outline

- Design laws
- The knighthood — the agent layer
- The two lines
- Pledges (the kinds of people)
- Territories
- The four states of a fief
  - The Regent's desk
- The records (the deliberate acts)
  - The census comes alive
  - Life-cycle acts
  - The court opens
- The census (as ratified)
- Beyond the borders
- The Marches
  - The border scribe
- The walls
- The Treasury
  - The economy — the two treasuries
  - The chronicle
  - The vault
  - The border book
- The living instrument — the operating model, the factory, and the event log
  - The factory and the setting
  - Events-only (the record, extended)
  - What the operating model demands of the design
  - The clerk — an agent for every seat
  - The throne — the King's seat (the game's top-down view)
  - The task-language — the catalog grows a tree
  - The Regent's seat — the first per-seat console (built 2026-07-20)
  - The clerk executes — one operator agent, proven (built 2026-07-20)
  - The realm remodeled — pods, knights, guilds, and the land (ratified 2026-07-20)
- Build order

## Laws that govern it

- [[A deployment is not reachable until an identity wall stands]] — *this writ names "A deployment is not reachable until an identity wall stands" literally*
- [[A fief is a book of doors]] — *this writ names "A fief is a book of doors" literally*
- [[Actions stand beside their information]] — *this writ names "Actions stand beside their information" literally*
- [[Deliberate acts, recorded]] — *this writ names "Deliberate acts, recorded" literally*
- [[Generated land may never be presented as a finding]] — *this writ names "Generated land may never be presented as a finding" literally*
- [[No credential is ever version-controlled]] — *this writ names "No credential is ever version-controlled" literally*
- [[Plain English medieval terms]] — *this writ names "Plain English medieval terms" literally*
- [[Presence in the book is the only truth]] — *this writ names "Presence in the book is the only truth" literally*
- [[Raw data in, structure out]] — *this writ names "Raw data in, structure out" literally*
- [[The bridge is tribute]] — *this writ names "The bridge is tribute" literally*
- [[The graduation path]] — *this writ names "The graduation path" literally*
- [[The land itself is invented]] — *this writ names "The land itself is invented" literally*
- [[The line of rule]] — *this writ names "The line of rule" literally*
- [[The line of trade]] — *this writ names "The line of trade" literally*
- [[The Marches are the border lands]] — *this writ names "The Marches are the border lands" literally*
- [[The system hunts delegation debt]] — *this writ names "The system hunts delegation debt" literally*

## Entities

- [[BudgetLine]] — *this writ names "BudgetLine" literally*
- [[CatalogRow]] — *this writ names "CatalogRow" literally*
- [[EconomyBook]] — *this writ names "EconomyBook" literally*
- [[The border book]] — *this writ names "The border book" literally*
- [[The border scribe]] — *this writ names "The border scribe" literally*
- [[The census]] — *this writ names "The census" literally*
- [[The Chancery]] — *this writ names "The Chancery" literally*
- [[The chronicle]] — *this writ names "The chronicle" literally*
- [[The clerk fleet]] — *this writ names "The clerk fleet" literally*
- [[The consequence engine]] — *this writ names "The consequence engine" literally*
- [[The Crown's own coin (the QuickBooks dimension)]] — *this writ names "The Crown's own coin (the QuickBooks dimension)" literally*
- [[The estates in trust (the AppFolio dimension)]] — *this writ names "The estates in trust (the AppFolio dimension)" literally*
- [[The event log]] — *this writ names "The event log" literally*
- [[The fee bridge]] — *this writ names "The fee bridge" literally*
- [[The grand muster]] — *this writ names "The grand muster" literally*
- [[The Marches]] — *this writ names "The Marches" literally*
- [[The Office of Tenancy]] — *this writ names "The Office of Tenancy" literally*
- [[The Office of Works]] — *this writ names "The Office of Works" literally*
- [[The Regent's desk]] — *this writ names "The Regent's desk" literally*
- [[The Throne]] — *this writ names "The Throne" literally*

## Modules

- [[src/domain/catalog.ts]] — *this writ names the exported symbol `CatalogRow`*
- [[src/domain/economy.ts]] — *this writ names the exported symbol `BudgetLine`; this writ names the exported symbol `EARNED_FEE_LIMIT_DAYS`; +9 more*
- [[src/domain/flows.ts]] — *this writ names the exported symbol `approveStep`; this writ names the exported symbol `completeStep`; +6 more*
- [[src/domain/guilds.ts]] — *this writ names the exported symbol `readGuilds`*
- [[src/domain/pods.ts]] — *this writ names the exported symbol `readPods`; this writ names the exported symbol `unplacedOwners`*
- [[src/domain/realm.ts]] — *this writ names the exported symbol `readRealm`*
- [[src/domain/throne.ts]] — *this writ names the exported symbol `readThrone`*
- [[src/domain/treasury.ts]] — *this writ names the exported symbol `readCoffers`; this writ names the exported symbol `RENT_PER_DOOR`; +1 more*
- [[src/domain/wargame.ts]] — *this writ names the exported symbol `generateGrandMuster`; this writ names the exported symbol `generateWarGame`*
- [[src/operator-core.ts]] — *this writ names the exported symbol `approveStep`; this writ names the exported symbol `CatalogRow`; +15 more*
- [[src/wargame-core.ts]] — *this writ names the exported symbol `generateGrandMuster`; this writ names the exported symbol `generateWarGame`*
- [[src/WarTableView.tsx]] — *this writ names the exported symbol `WarTableView`*

## Backlinks

*Nothing in the Book points here. An orphan page is worse than a missing one — it exists, it is correct, and no reader will ever reach it. `npm run book:lint` counts these.*

## Documents that cite this source

*These name this FILE by its path. That is a citation of the source, not a claim about any one idea inside it — do not read a path citation as agreement, dependence or implementation.*

- [[The PM Task-and-Process Library (reference)]]
- [[Writ — the economy pillar, re-expressed as chronicle readings]]
- [[Writ — the first War Game (the proving ground)]]
- [[Writ — the flow engine (the operator's spine)]]
- [[Writ — The Knighthood: one seat, a Regent that is an agent, and the fief as a desk]]
- [[Writ — the Land: pods, knights, owners, and guilds (the realm remodeled)]]
- [[Writ — the operator's hands (swing two, part one)]]
- [[Writ — The Realm Map (the illuminated map, come alive)]]
- [[Writ — the task-language, the consequences, and the Regent's seat]]
- [[Writ of the Great Book — the living wiki, and the law that keeps it honest]]

## Sources this page cites

*Files this page names by path. Again: a citation of the file, nothing more.*

- [[.env.example]]
- [[AGENTS.md]]
- [[docs/CLERK-BRAIN-DOCTRINE.md]]
- [[docs/HANDOFF.md]]
- [[docs/PARALLEL-SESSIONS.md]]
- [[docs/WRIT-ECONOMY.md]]
- [[docs/WRIT-TASK-LANGUAGE.md]]
- [[docs/WRIT-THE-BROKERAGE.md]]
- [[Handoff — where things stand]]
- [[src/domain/catalog.ts]]
- [[src/domain/economy.ts]]
- [[src/domain/flows.ts]]
- [[src/domain/guilds.ts]]
- [[src/operator-core.ts]]
- [[src/WarTableView.tsx]]
- [[The clerk-brain doctrine — what intelligence powers which clerk]]
- [[WarTableView]]
- [[Working in parallel — the multi-session doctrine]]
- [[wrangler.jsonc]]
- [[Writ — The Brokerage: offices, guilds, fiefs, and the line of answer]]
- [[Writ — the economy pillar, re-expressed as chronicle readings]]
- [[Writ — The Gate: the money law is written and nothing enforces it]]
- [[Writ — The Knighthood: one seat, a Regent that is an agent, and the fief as a desk]]
- [[Writ — the task-language, the consequences, and the Regent's seat]]

---

*Generated by `tools/vault/emit.mjs` from `docs/KINGDOM.md`:1. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
