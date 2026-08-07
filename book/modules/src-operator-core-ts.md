---
type: "module"
id: "module:src/operator-core.ts"
title: "src/operator-core.ts"
standing: "built"
standing_source: "knowledge/artifacts.json"
source_path: "src/operator-core.ts"
source_line: 1
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "module:src/operator-core.ts"
---

# src/operator-core.ts

> **STANDING — BUILT**  
> Implemented in code and checkable against the tree.  
> *Declared in `knowledge/artifacts.json`.*

90 lines · 80 exported symbols.

## What the file says of itself

> The operator's core — the pure domain engine, bundled for the harness.
> 
> Swing four (WRIT-TASK-LANGUAGE, "prove one agent") reuses `harness/` as an
> OPERATOR, not the K3 builder: a small loop with a two-tool belt (read the
> chronicle, append events) driven by a cheap brain. The crux decision was
> FAITHFUL FLOW REUSE — the agent must advance a cascade through the REAL flow
> engine, never a reimplementation, so the app's `readFlows` renders the
> agent's work identically to a human's (no drift, KINGDOM.md "one source").
> 
> The harness is raw Node with no tsx/esbuild, and Node's --experimental-strip-
> type

## Shape

- **Lines:** 90
- **Exported symbols (80):** `BankId`, `BankRec`, `BankRecs`, `CaseReading`, `Catalog`, `CatalogRow`, `DomainGroup`, `EconomyBook`, `EconomySettingPatch`, `EventKind`, `EventLog`, `FOUNDING_ECONOMY`, `FeeRule`, `FlowBook`, `FlowInstance`, `FlowParams`, `FlowReading`, `FlowTemplate`, `IdentityFinding`, `IdentityLeakError`, `KingdomEvent`, `LedgerAccount`, `MoneyEvent`, `MoneyKind`, `MoneyLog`, `Posting`, `SpendDisposition`, `SpendGate`, `SpendReconciliation`, `ageInDays`, `applyEconomySetting`, `approveStep`, `assertNoIdentity`, `awaitingHuman`, `awaitsOutside`, `balanceOf`, `booksBalance`, `bridgeCheck`, `catalogAtFounding`, `coinCents`, `completeStep`, `domainsOf`, `estimateSpendCents`, `feeAmount`, `feeRuleFor`, `findIdentity`, `findRow`, `flowKeyFor`, `flowsAtFounding`, `fullParams`, `guardComplete`, `handStep`, `instantiateFlow`, `lateFeeSplit`, `mtmSplit`, `needsOwnerApproval`, `overrideStep`, `paramsOf`, `postingsFor`, `proposeStep`, `queues`, `readBankRecs`, `readBudgetVsActual`, `readCase`, `readCases`, `readCompliance`, `readCorporateCoffers`, `readFlow`, `readFlows`, `readOwnerStatement`, `readPnL`, `readPostings`, `readSolvency`, `reconcileSpend`, `rowsByDomain`, `spendCapFor`, `spendGate`, `systemsOf`, `titleOf`, `vendorSettlementMoney`

## Modules

- [[src/domain/catalog.ts]] — *imported by this file*
- [[src/domain/contextGuard.ts]] — *imported by this file*
- [[src/domain/economy.ts]] — *imported by this file*
- [[src/domain/economySetting.ts]] — *imported by this file*
- [[src/domain/events.ts]] — *imported by this file*
- [[src/domain/flows.ts]] — *imported by this file*

## Backlinks

### Writs that specify it

- [[Handoff — where things stand]] — *this writ names the exported symbol `applyEconomySetting`; this writ names the exported symbol `approveStep`; +12 more*
- [[Open questions]] — *this writ names the exported symbol `estimateSpendCents`; this writ names the exported symbol `spendGate`*
- [[The Kingdom — Canon]] — *this writ names the exported symbol `approveStep`; this writ names the exported symbol `CatalogRow`; +15 more*
- [[The PM Task-and-Process Library (reference)]] — *this writ names the exported symbol `CatalogRow`; this writ names the exported symbol `domainsOf`; +6 more*
- [[Writ — the economy pillar, re-expressed as chronicle readings]] — *this writ names the exported symbol `EconomyBook`; this writ names the exported symbol `feeAmount`; +7 more*
- [[Writ — The Gate: the money law is written and nothing enforces it]] — *this writ names the exported symbol `approveStep`; this writ names the exported symbol `overrideStep`; +2 more*
- [[Writ — the Land: pods, knights, owners, and guilds (the realm remodeled)]] — *this writ names the exported symbol `catalogAtFounding`; this writ names the exported symbol `flowsAtFounding`; +1 more*
- [[Writ — the operator's hands (swing two, part one)]] — *this writ names the exported symbol `handStep`; this writ names the exported symbol `readFlow`*
- [[Writ — the task-language, the consequences, and the Regent's seat]] — *this writ names the exported symbol `catalogAtFounding`; this writ names the exported symbol `CatalogRow`; +11 more*

### Facts it depends on

- [[Default estimate for an unclassified repair — RETIRED, there is no default]] — *names the exported symbol `estimateSpendCents`*

### Entities

- [[BudgetLine]] — *names the exported symbol `readBudgetVsActual`*
- [[CatalogRow]] — *names the exported symbol `CatalogRow`; names the exported symbol `FlowTemplate`*
- [[FeeRule]] — *names the exported symbol `feeAmount`*
- [[FlowTemplate]] — *names the exported symbol `FlowTemplate`*

### Modules

- [[src/worker.ts]] — *imported by this file*

## Documents that cite this source

*These name this FILE by its path. That is a citation of the source, not a claim about any one idea inside it — do not read a path citation as agreement, dependence or implementation.*

- [[The Kingdom — Canon]]

---

*Generated by `tools/vault/emit.mjs` from `src/operator-core.ts`:1. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
