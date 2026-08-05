---
type: "module"
id: "module:src/realm/scene.ts"
title: "src/realm/scene.ts"
standing: "built"
standing_source: "knowledge/artifacts.json"
source_path: "src/realm/scene.ts"
source_line: 1
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "module:src/realm/scene.ts"
---

# src/realm/scene.ts

> **STANDING — BUILT**  
> Implemented in code and checkable against the tree.  
> *Declared in `knowledge/artifacts.json`.*

274 lines · 12 exported symbols.

## What the file says of itself

> The Realm Map — the data contract, and the canned realms the standalone view
> is built against (docs/WRIT-THE-REALM-MAP.md, "The firewall").
> 
> `RealmScene` is the WHOLE of what the view needs. The view is a pure function
> of it: it computes no kingdom state, reaches for nothing outside `src/realm`,
> and stores nothing. The real scene is folded by `readRealmScene()` in
> `src/domain/realmScene.ts` — these types are its twin, declared here so the
> view never imports the domain.
> 
> **Do not reshape these types.** The reading is written against exactly this;
> a field renamed here is a field the map silently

## Shape

- **Lines:** 274
- **Exported symbols (12):** `BuildingKind`, `BuildingState`, `FiefHealth`, `RealmHandlers`, `RealmScene`, `SAMPLE_REALM`, `SAMPLE_REALM_UNREVEALED`, `SceneBuilding`, `SceneFief`, `SceneGuild`, `fullMuster`, `slugOf`

## Backlinks

### Writs that specify it

- [[Writ — The Realm Map (the illuminated map, come alive)]] — *this writ names the exported symbol `RealmScene`; this writ names the exported symbol `SAMPLE_REALM`; +3 more*

### Modules

- [[src/domain/realmScene.ts]] — *imported by this file*
- [[src/realm/Building.tsx]] — *imported by this file*
- [[src/realm/Chrome.tsx]] — *imported by this file*
- [[src/realm/GuildHalls.tsx]] — *imported by this file*
- [[src/realm/Roads.tsx]] — *imported by this file*
- [[src/realm/Town.tsx]] — *imported by this file*
- [[src/table/FlatMapView.tsx]] — *imported by this file*
- [[src/table/tableScene.ts]] — *imported by this file*
- [[src/WarTableView.tsx]] — *imported by this file*

### Surfaces

- [[FlatMapView]] — *imported by this view*
- [[WarTableView]] — *imported by this view*

### Invariants that enforce it

*These roads come from a shared source FILE, not from a semantic claim: the test file imports the module. Read it as "stands near", never as "proves".*

- [[a crisis on a leased door OUTRANKS its lease — the map shows trouble]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a fellowship’s block holds its own doors and no one else’s]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a fief with no doors is not given a block of empty ground]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a shire that grows draws a DENSER town, never one off the table]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a standing muster reveals a realm of towns, every door a building]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[accepts a relief of any side — the drawing is not tied to one bake]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an unrevealed realm draws no pieces at all — the land lies bare]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[carries each door’s open matter through to the piece — the road to the work]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[draws a band for every level, and every band is a closed figure]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every knight’s banner stands over their own fellowship]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every town has exactly ONE manor, and every building a stable slug id]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is DETERMINISTIC — the same shire draws the same town, twice]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is PURE — the same land draws the same map, twice]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[no muster stands ⇒ the land lies UNREVEALED, and no town is drawn]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[no two pieces stand on one parcel]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[reads a sea when there is one, and dry land when there is not]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[stands the woods apart, on the board, and off the bare tops]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the blocks never overlap — a road runs between every two]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the doors read held / vacant / crisis — all three states are drawn]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the frame fits every piece it is given]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the HUD carries only the coffers’ trend, the red month and the fall — no scoreboard]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the id hash is stable and well spread — the view places from it]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the reading and the VIEW’s contract are the same shape — the firewall holds]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the scene is PURE — the same records fold the same map, twice]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the woods do not grow through a holding]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[throws a shadow no longer than the thing casting it]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[TOTALITY: every door the realm holds stands somewhere on the board]] — *imported by the test FILE (shared source, not a claim about this one test)*

## Documents that cite this source

*These name this FILE by its path. That is a citation of the source, not a claim about any one idea inside it — do not read a path citation as agreement, dependence or implementation.*

- [[Writ — The Realm Map (the illuminated map, come alive)]]

---

*Generated by `tools/vault/emit.mjs` from `src/realm/scene.ts`:1. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
