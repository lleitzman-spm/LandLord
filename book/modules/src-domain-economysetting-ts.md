---
type: "module"
id: "module:src/domain/economySetting.ts"
title: "src/domain/economySetting.ts"
standing: "built"
standing_source: "knowledge/artifacts.json"
source_path: "src/domain/economySetting.ts"
source_line: 1
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "module:src/domain/economySetting.ts"
---

# src/domain/economySetting.ts

> **STANDING — BUILT**  
> Implemented in code and checkable against the tree.  
> *Declared in `knowledge/artifacts.json`.*

330 lines · 10 exported symbols.

## What the file says of itself

> The tenant setting: the mechanism by which a deployment overrides the seed
> tenant's DEMO figures with its own, without any real figure ever living in
> this repository
> (docs/WRIT-ECONOMY.md, the many "loads at the gate as a setting" comments in
> `economy.ts`). LandLord holds the machine; a human's attended switch loads
> a firm's real chart through it. This file is the leash: every value below is a
> SYNTHESIZED, obviously-fake working-fluid example — never any real firm's real
> figures. The real numbers load attended, never in this file.
> 
> The patch only reaches the fields `economy.ts` itself marks ga

## Shape

- **Lines:** 330
- **Exported symbols (10):** `AccountPatch`, `BudgetLinePatch`, `EXAMPLE_RENAMED_CHART`, `EXAMPLE_TIGHTER_CAPS`, `EconomySettingPatch`, `EstateSpendCapPatch`, `FeeRulePatch`, `applyEconomySetting`, `parseEconomySetting`, `summarizeSetting`

## Entities

- [[The tenant (economy) setting]] — *the same file `src/domain/economySetting.ts`, seen as a entity rather than a module*

## Modules

- [[src/domain/economy.ts]] — *imported by this file*

## Backlinks

### Writs that specify it

- [[Handoff — where things stand]] — *this writ names the exported symbol `applyEconomySetting`*

### Entities

- [[The tenant (economy) setting]] — *the same file `src/domain/economySetting.ts`, seen as a module rather than a entity*

### Modules

- [[src/domain/chronicle.ts]] — *imported by this file*
- [[src/operator-core.ts]] — *imported by this file*
- [[src/store/chronicleStore.ts]] — *imported by this file*
- [[src/WarTableView.tsx]] — *imported by this file*

### Surfaces

- [[WarTableView]] — *imported by this view*

### Invariants that enforce it

*These roads come from a shared source FILE, not from a semantic claim: the test file imports the module. Read it as "stands near", never as "proves".*

- [[a `done` written through a granted completeStep is stamped with the seat]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a belt tag that grants nothing is DECLARED as such, never left looking like a grant]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a deployed agent's core carries only functions its belt tags grant]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a GL-rename + fee-rate + mtm-split patch stays sound over a dealt month]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a null/absent patch is a no-op — returns base unchanged (same reference)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a present economySetting (even a no-op patch) means the chronicle is no longer "at founding"]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a present economySetting rides the raw record untouched; economyOf folds it in]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a tightened-cap patch stays sound over a dealt month (spend caps do not touch the postings)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[accepts a well-formed patch and round-trips through applyEconomySetting]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[accepts null on a rate field (clear) but still rejects other non-numbers]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an absent economySetting normalizes through untouched, and economyOf is a true no-op]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an agent CAN still advance a cascade — the belt makes it legible, not impossible]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an agent with no wired judgment refuses to run rather than pretend to]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an empty object is the valid no-op patch]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an id-keyed array merges by id, not by index]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an unknown belt tag is refused at deploy, not silently ignored]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[and CLEARS an invoice that stays inside it — both verdicts are reachable]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[appendEvents on a memory backing never touches disk]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[appendEvents on a seedless chronicle refuses, not just readLog]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[buildAgent touches no I/O and needs no backing]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[counts each kind of override, and the house cap as one]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[deploy refuses a backing that does not implement the interface]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every named agent carries a belt SUFFICIENT for the clerk that runs it]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every roster agent deploys to a core with no ratify/pay tool present]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every roster entry constructs cleanly]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[fileBacking refuses a doc with no standing War Game]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[ignores a GL patch naming a role the chart does not have (leash: never invents an account)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is null for an absent patch (founding, no setting)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[Mace: a raw complaint in, an identified cascade proposed, and she stops there]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[memoryBacking never requires a war-game seed]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[Milo: a vendor-commitment case in, a reasoned quote proposed, and he stops there]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[Mira HOLDS an invoice that overruns its authorized ceiling]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[Mira: a settlement case in, a pay/hold recommendation proposed, and she stops there]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[mtm %→flat : a flat-basis override splits 50/50 on the entered premium]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[never mutates the base economy]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[NO belt, on any agent, ever grants approveStep or overrideStep]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[null CLEARS a field — flips the founding flat renewal into a % of new rent]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[overrides a budget line by accountRole (and can add a new one)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[overrides a fee rate by kind, leaving other rules untouched]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[overrides an existing per-estate cap and upserts a brand-new one]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[overrides the house-wide spend cap]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[overrides the mtm split ratio]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[refuses to construct an agent that does not refuse to ratify]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[rejects malformed rows and bad number shapes]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[rejects non-JSON, a non-object, and an unknown top-level field]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[renames a GL account code and name by role]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[renewal flat→% : a new_rent-basis override yields a percentage of new rent via feeAmount]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[run refuses rather than inventing a clock when the backing carries none]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[scalars overwrite; an unknown top-level field on the patch is ignored]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the capability table is DEEP frozen — its arrays cannot be widened]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the M family judgments are all known to this rig]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the record and the judgment name the SAME invoice figure]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[undefined LEAVES a field; null on a brand-new rule just means absent]] — *imported by the test FILE (shared source, not a claim about this one test)*

---

*Generated by `tools/vault/emit.mjs` from `src/domain/economySetting.ts`:1. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
