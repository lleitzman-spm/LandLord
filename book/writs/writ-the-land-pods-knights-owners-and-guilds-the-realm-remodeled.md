---
type: "writ"
id: "writ:docs/WRIT-THE-LAND.md"
title: "Writ — the Land: pods, knights, owners, and guilds (the realm remodeled)"
standing: "retired"
standing_source: "knowledge/artifacts.json"
source_path: "docs/WRIT-THE-LAND.md"
source_line: 1
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "writ:docs/WRIT-THE-LAND.md"
---

# Writ — the Land: pods, knights, owners, and guilds (the realm remodeled)

> **STANDING — RETIRED**  
> Superseded. Kept for history, never cited as current.  
> *Declared in `knowledge/artifacts.json`.*

> ## ⚠ SUPERSEDED IN PART — 2026-07-27 > > **The DEPARTMENTS-AS-GUILDS model this writ describes is retired.** It is kept as the record of > how the realm was thought about before the refounding, and the org chart in §"the shape" names > territories the census no longer holds. What now stands, and w

## The source, verbatim

> > ## ⚠ SUPERSEDED IN PART — 2026-07-27
> >
> > **The DEPARTMENTS-AS-GUILDS model this writ describes is retired.** It is kept as the record of
> > how the realm was thought about before the refounding, and the org chart in §"the shape" names
> > territories the census no longer holds. What now stands, and what to read instead:
> >
> > - **`docs/WRIT-THE-BROKERAGE.md`** — the ratified model: three CROWN OFFICES in the palace (the
> >   Office of Works, the Office of Tenancy, the Chancery), each headed by a CHANCELLOR.
> > - A **FIEF** is a group's BOOK OF DOORS, not a department. A **GUILD** is an OUTSIDE trade, and
> >   its hands are **ARTISANS**. The Steward is the **REGENT** everywhere a human reads.
> > - `docs/KINGDOM.md` → "Territories" and "The census (as ratified)" carry the amended law.
> >
> > Everything below this line is history. Do not build from it.

*Verified against `docs/WRIT-THE-LAND.md`:1 on every lint — no quote, no object.*

## Outline

- The whole idea (why we remodel)
- The leash (unchanged, and it matters more here)
- Phase 1 — Guilds: the departments become functions
- Phase 2 — Pods, knights, owners, and the land
- Phase 3 — The debt redefined, the generator, and consequences re-homed
- The reading API the HUD will consume (build these shapes)
- Deliverables (K3's half)
- Out of scope (name, don't build)
- Charter (three-tier)

## Decisions that touched it

- [[The departments-as-guilds land model is superseded]] — *the same file `docs/WRIT-THE-LAND.md`, seen as a decision rather than a writ*

## Entities

- [[CatalogRow]] — *this writ names "CatalogRow" literally*
- [[The census]] — *this writ names "The census" literally*
- [[The Chancery]] — *this writ names "The Chancery" literally*
- [[The consequence engine]] — *this writ names "The consequence engine" literally*
- [[The Office of Tenancy]] — *this writ names "The Office of Tenancy" literally*
- [[The Throne]] — *this writ names "The Throne" literally*

## Modules

- [[src/domain/catalog.ts]] — *this writ names the exported symbol `catalogAtFounding`*
- [[src/domain/chronicle.ts]] — *this writ names the exported symbol `normalizeChronicle`*
- [[src/domain/consequences.ts]] — *this writ names the exported symbol `doorOf`; this writ names the exported symbol `PatronReading`; +1 more*
- [[src/domain/flows.ts]] — *this writ names the exported symbol `flowsAtFounding`; this writ names the exported symbol `readFlow`*
- [[src/domain/guilds.ts]] — *this writ names the exported symbol `FOUNDING_GUILDS`; this writ names the exported symbol `GuildReading`; +3 more*
- [[src/domain/pods.ts]] — *this writ names the exported symbol `POD_CAPACITY`; this writ names the exported symbol `readPods`; +1 more*
- [[src/domain/realm.ts]] — *this writ names the exported symbol `readRealm`*
- [[src/domain/states.ts]] — *this writ names the exported symbol `readKingdom`; this writ names the exported symbol `regentsDesk`*
- [[src/domain/throne.ts]] — *this writ names the exported symbol `readThrone`*
- [[src/domain/wargame.ts]] — *this writ names the exported symbol `dealtGame`*
- [[src/LedgerView.tsx]] — *this writ names the exported symbol `LedgerView`*
- [[src/operator-core.ts]] — *this writ names the exported symbol `catalogAtFounding`; this writ names the exported symbol `flowsAtFounding`; +1 more*
- [[src/wargame-core.ts]] — *this writ names the exported symbol `dealtGame`; this writ names the exported symbol `normalizeChronicle`*

## artifact

- [[docs/WRIT-THE-LAND.md]] — *the same file `docs/WRIT-THE-LAND.md`, seen as a artifact rather than a writ*

## Backlinks

### Decisions that touched it

- [[The departments-as-guilds land model is superseded]] — *the same file `docs/WRIT-THE-LAND.md`, seen as a writ rather than a decision*

### artifact

- [[docs/WRIT-THE-LAND.md]] — *the same file `docs/WRIT-THE-LAND.md`, seen as a writ rather than a artifact*

## Sources this page cites

*Files this page names by path. Again: a citation of the file, nothing more.*

- [[AGENTS.md]]
- [[CLAUDE.md]]
- [[docs/K3-PROFILE.md]]
- [[docs/KINGDOM.md]]
- [[docs/WRIT-THE-BROKERAGE.md]]
- [[Kimi K3 — capability profile & how to wield it]]
- [[src/domain/guilds.ts]]
- [[src/domain/pods.ts]]
- [[src/domain/types.ts]]
- [[src/store/chronicleStore.ts]]
- [[The Kingdom — Canon]]
- [[Writ — The Brokerage: offices, guilds, fiefs, and the line of answer]]

---

*Generated by `tools/vault/emit.mjs` from `docs/WRIT-THE-LAND.md`:1. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
