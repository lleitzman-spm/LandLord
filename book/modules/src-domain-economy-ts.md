---
type: "module"
id: "module:src/domain/economy.ts"
title: "src/domain/economy.ts"
standing: "built"
standing_source: "knowledge/artifacts.json"
source_path: "src/domain/economy.ts"
source_line: 1
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "module:src/domain/economy.ts"
---

# src/domain/economy.ts

> **STANDING — BUILT**  
> Implemented in code and checkable against the tree.  
> *Declared in `knowledge/artifacts.json`.*

1545 lines · 60 exported symbols.

## What the file says of itself

> The economy — the two treasuries, kept the constitutional way: records in,
> readings out. A residential property manager is a fiduciary running two money
> worlds at once (docs/RESEARCH-ECONOMY.md, docs/KINGDOM.md "The economy"):
> 
>   • the ESTATES in trust (the AppFolio dimension) — the Patrons' rents,
>     deposits, reserves, and the vendor costs of their doors; the Crown only
>     holds and moves this, per estate and per owner. Fiduciary money.
>   • the CROWN's own coin (the QuickBooks dimension) — the FEES it earns for
>     keeping the estates (tribute), against its upkeep. The company's money.
> 
> Th

## Shape

- **Lines:** 1545
- **Exported symbols (60):** `AcctType`, `BankId`, `BankRec`, `BankRecs`, `Book`, `BridgeCheck`, `BudgetLine`, `BudgetVsActual`, `BudgetVsActualLine`, `Compliance`, `ComplianceCheck`, `CorporateCoffers`, `EARNED_FEE_LIMIT_DAYS`, `EconomyBook`, `FOUNDING_ECONOMY`, `FeeKind`, `FeeRule`, `LedgerAccount`, `MoneyEvent`, `MoneyKind`, `MoneyLog`, `OwnerStatement`, `PnL`, `PnLLine`, `Posting`, `SettlementGate`, `Side`, `Solvency`, `SpendDisposition`, `SpendGate`, `SpendReconciliation`, `TRUST_CASH_ROLES`, `balanceOf`, `booksBalance`, `bridgeCheck`, `coinCents`, `economyAtFounding`, `estimateSpendCents`, `feeAmount`, `feeRuleFor`, `fiduciaryViolationsAt`, `lateFeeSplit`, `mtmSplit`, `needsOwnerApproval`, `ownersInLog`, `postingsFor`, `readBankRecs`, `readBudgetVsActual`, `readCompliance`, `readCorporateCoffers`, `readOwnerStatement`, `readPnL`, `readPostings`, `readSolvency`, `reconcileSpend`, `sampleLedger`, `settlementGate`, `spendCapFor`, `spendGate`, `vendorSettlementMoney`

## Backlinks

### Writs that specify it

- [[Handoff — where things stand]] — *this writ names the exported symbol `coinCents`; this writ names the exported symbol `settlementGate`; +2 more*
- [[Open questions]] — *this writ names the exported symbol `estimateSpendCents`; this writ names the exported symbol `spendGate`*
- [[The Kingdom — Canon]] — *this writ names the exported symbol `BudgetLine`; this writ names the exported symbol `EARNED_FEE_LIMIT_DAYS`; +9 more*
- [[Writ — the economy pillar, re-expressed as chronicle readings]] — *this writ names the exported symbol `EconomyBook`; this writ names the exported symbol `feeAmount`; +8 more*
- [[Writ — The Gate: the money law is written and nothing enforces it]] — *this writ names the exported symbol `settlementGate`; this writ names the exported symbol `spendGate`*

### Facts it depends on

- [[Admin fee (demo)]] — *declared in `knowledge/facts.json`*
- [[Ancillary (resident benefit) fee (demo)]] — *declared in `knowledge/facts.json`*
- [[Annual admin fee (demo)]] — *declared in `knowledge/facts.json`*
- [[Application fee (demo)]] — *declared in `knowledge/facts.json`*
- [[Corporate budget — management fee income (demo)]] — *declared in `knowledge/facts.json`*
- [[Corporate budget — markup income (demo)]] — *declared in `knowledge/facts.json`*
- [[Corporate budget — overhead expense (demo)]] — *declared in `knowledge/facts.json`*
- [[Corporate budget — payroll expense (demo)]] — *declared in `knowledge/facts.json`*
- [[Corporate budget — software expense (demo)]] — *declared in `knowledge/facts.json`*
- [[Default estimate for an unclassified repair — RETIRED, there is no default]] — *declared in `knowledge/facts.json`; names the exported symbol `estimateSpendCents`*
- [[Earned-fee sweep limit]] — *declared in `knowledge/facts.json`*
- [[House owner-approval spend cap (demo)]] — *declared in `knowledge/facts.json`*
- [[Late fee split — firm's cut (demo)]] — *declared in `knowledge/facts.json`*
- [[Leasing fee rate (demo)]] — *declared in `knowledge/facts.json`*
- [[Maintenance markup rate (demo)]] — *declared in `knowledge/facts.json`*
- [[Management fee rate (demo)]] — *declared in `knowledge/facts.json`*
- [[Month-to-month premium rate (demo)]] — *declared in `knowledge/facts.json`*
- [[Month-to-month premium split — firm's cut (demo)]] — *declared in `knowledge/facts.json`*
- [[NSF fee (demo)]] — *declared in `knowledge/facts.json`*
- [[Per-estate spend cap override (demo)]] — *declared in `knowledge/facts.json`*
- [[Pet damage guarantee fee (demo)]] — *declared in `knowledge/facts.json`*
- [[Project coordination fee (demo)]] — *declared in `knowledge/facts.json`*
- [[Referral fee (demo)]] — *declared in `knowledge/facts.json`*
- [[Reletting fee rate (demo)]] — *declared in `knowledge/facts.json`*
- [[Renewal fee (demo)]] — *declared in `knowledge/facts.json`*
- [[Resident benefit package fee (demo)]] — *declared in `knowledge/facts.json`*
- [[Risk / enforcement fee (demo)]] — *declared in `knowledge/facts.json`*
- [[Seasonal AC rental fee (demo)]] — *declared in `knowledge/facts.json`*
- [[Warranty coordination fee (demo)]] — *declared in `knowledge/facts.json`*
- [[Working-fluid repair estimate — emergency]] — *declared in `knowledge/facts.json`*
- [[Working-fluid repair estimate — routine/normal urgency]] — *declared in `knowledge/facts.json`*
- [[Working-fluid repair estimate — urgent]] — *declared in `knowledge/facts.json`*

### Entities

- [[BudgetLine]] — *names the exported symbol `readBudgetVsActual`*
- [[Compliance check (reading)]] — *declared in `knowledge/entities.json`*
- [[EconomyBook]] — *declared in `knowledge/entities.json`*
- [[FeeRule]] — *names the exported symbol `feeAmount`*
- [[MoneyEvent]] — *declared in `knowledge/entities.json`*
- [[The fee bridge]] — *declared in `knowledge/entities.json`*
- [[The owner-approval spend gate]] — *declared in `knowledge/entities.json`*

### Modules

- [[src/domain/campaign.ts]] — *imported by this file*
- [[src/domain/chronicle.ts]] — *imported by this file*
- [[src/domain/economySetting.ts]] — *imported by this file*
- [[src/domain/realm.ts]] — *imported by this file*
- [[src/domain/treasury.ts]] — *imported by this file*
- [[src/domain/wargame.ts]] — *imported by this file*
- [[src/operator-core.ts]] — *imported by this file*
- [[src/store/chronicleStore.ts]] — *imported by this file*
- [[src/WarTableView.tsx]] — *imported by this file*

### Surfaces

- [[WarTableView]] — *imported by this view*

### Invariants that enforce it

*These roads come from a shared source FILE, not from a semantic claim: the test file imports the module. Read it as "stands near", never as "proves".*

- [[${name} works a real ${flowKey}/${stepKey} case and stops at a proposal]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a `done` written through a granted completeStep is stamped with the seat]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a bare census is never dry — there is nothing to be broke with]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a base-blind merge is unchanged — it still takes the writing session]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a belt tag that grants nothing is DECLARED as such, never left looking like a grant]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a bill above the cap that a HUMAN ratified]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a bill above the cap that NOBODY ratified]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a bill nobody priced]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a bill within the cap, ratified or not — that is what a cap IS]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a book cut over the muster places EVERY door — the join is sound]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a case with no estateId folds to null (byte-identical to before)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a cash-complete sample month is sound]] — *reached by the test FILE through its helper `test/invariants.ts` (shared source, not a claim about this one test)*
- [[a Chancellor granted ONE fief holds one fief — an office is not land]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a chronicle predating the estates shelf migrates to the empty founding book]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a classified estimate is still weighed against the cap, both ways]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a clean founding brings NOTHING — the household is fully staffed]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a clerk’s proposal is heard ONCE — never also as a bare waiting case]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a craft left headless IS brought before the court]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a craft standing headless holds it at a march]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a crisis on a leased door OUTRANKS its lease — the map shows trouble]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a CRISIS outranks a fresh matter, and held COIN outranks a bare wait]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a deployed agent's core carries only functions its belt tags grant]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a door in no knight’s care is a real state, and reads as debt]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a door the book does not hold reads UNPLACED, and is named]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a door the book holds places cleanly — realm, shire, fee and knight]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a door’s shire and its fee stand in the SAME realm as the door]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a fee scattered across two shires reads fine, and rolls up as ONE fee]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a fee with doors scattered across three metros reads fine]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a fee’s patron at odds with the muster’s owner is a finding, not a refusal]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a fief with no grant draws NO lord — the Regent is not its lord]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a full mtm month (split, funded) is sound end-to-end and the bridge ties after the fee]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a full TRUST account never saves the Crown — that coin is not its own]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a GL-rename + fee-rate + mtm-split patch stays sound over a dealt month]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a headless craft holds back EVERY metro, not one — the household is shared]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a headless office reads as headless — never as somebody else’s]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a house mtm rule with no splitBps falls back to the named constant]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a known band still returns its figure]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a loaded estate roster flips isFoundingChronicle to non-founding]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a march PROMOTES when the records change, with no field written]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a muster deployed on the remote side is adopted, not clobbered by a stale local]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a name the book does not hold reads as NOTHING rather than throwing]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a neglected operation loses doors until tribute drops below upkeep — RED, fallen]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a null/absent patch is a no-op — returns base unchanged (same reference)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a one-off company expense does NOT become the standing monthly upkeep]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a placed door in no knight’s care is NOT unplaced — it is the debt]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a PRE-FUNDED owner settles with NO topup and stays sound]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a present economySetting (even a no-op patch) means the chronicle is no longer "at founding"]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a present economySetting rides the raw record untouched; economyOf folds it in]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a present-but-empty catalog shelf stays empty (truth as struck, not re-seeded)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a real grand muster is sound]] — *reached by the test FILE through its helper `test/invariants.ts` (shared source, not a claim about this one test)*
- [[a real grand muster is sound — no false positives on realistic data]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a realm’s edicts read soonest-due first]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a regency draws its keeper, not a lord]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a revoked grant struck on the remote side stays struck]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a row naming a place the book does not hold reads unplaced, and says WHICH]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a shire DEMOTES again when the records go the other way]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a solvent operation clears its upkeep — black, not fallen]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a spend on the higher-cap estate CLEARS; the same spend on an unlisted estate GATES]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a stale vault reads every craft headless — honestly, and fillable]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a standing muster reveals a realm of towns, every door a building]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a struck money event stays struck through the merge]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a supplied bank statement that disagrees produces the exact lapse]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a tenure realm is a PLACE — a name and a sovereign, and no score on it]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a tightened-cap patch stays sound over a dealt month (spend caps do not touch the postings)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a war door and an estate roster both go straight in]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a war door carries NO tenure of its own — only an address and an owner]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a well-ordered owner month is sound (income before fees, temporal-clean)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a work order with no urgency band has NO estimate]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a zero/invalid bill posts nothing]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[accepts a well-formed patch and round-trips through applyEconomySetting]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[accepts null on a rate field (clear) but still rejects other non-numbers]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act five is met by holding the watch with no door in crisis]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[act four is met by ANSWERING three of the clerks’ proposals]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[act one is met by SEATING the empty craft — a record, not a flag]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[act six is met by ending a month in the black]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[act three is met by getting the boxes onto real desks]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[act two is met by WALKING a cascade to done]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[all three failing at once names all three]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an absent catalog shelf adopts the founding rows]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an absent economySetting normalizes through untouched, and economyOf is a true no-op]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an agent CAN still advance a cascade — the belt makes it legible, not impossible]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an agent with no wired judgment refuses to run rather than pretend to]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an ancient trifle never outranks today’s crisis — age does not compound forever]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an ANSWERED edict is never late, however long the day is gone]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an artisan naming no trade is shown, not swallowed]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an empty array is valid — the revert-to-founding shape]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an empty muster reads empty, not broken]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an empty object is the valid no-op patch]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an empty object normalizes to founding state]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an estate with a higher cap (harrow-c) clears a spend the house cap would gate]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an estate with no override still reads the house cap]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an estate with no override still reads the house cap (invariant)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an estate's own cap governs over the house cap]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an estate's own NTE governs the settlement ceiling where it has one]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an id-keyed array merges by id, not by index]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an owed edict PRESSES as its day nears]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an unclassified estimate stops, and says WHY it stopped]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an UNFUNDED owner settles soundly via the shortfall topup]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an unknown belt tag is refused at deploy, not silently ignored]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an urgency band this table does not know has no estimate either]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[and CLEARS an invoice that stays inside it — both verdicts are reachable]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[and it stops REGARDLESS of the cap — the old default did not]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[and the grammars they need really are absent from the founding book]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[any bill where the deployment set no cap — ungated, and it says so]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[appendEvents on a memory backing never touches disk]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[appendEvents on a seedless chronicle refuses, not just readLog]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[at the cap settles; one cent over does not]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[atStepFixture refuses to park on a step the book does not have]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[balances within both books (the bridge)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[both books balance over the whole dealt money log]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[buildAgent touches no I/O and needs no backing]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[but two fiefs under one lord IS a plurality]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[caps what one court hears, keeping the heaviest and still every kind]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[catches a deposit refunded from the wrong tenant (per-tenant subledger)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[catches a mid-history breach that the end state hides (temporal replay)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[catches a money event with an unknown kind (silent-drop guard)]] — *reached by the test FILE through its helper `test/invariants.ts` (shared source, not a claim about this one test)*
- [[catches an over-sweep (bridge driven negative) the aggregate checker misses]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[catches an owner overdrawn (commingling guard)]] — *reached by the test FILE through its helper `test/invariants.ts` (shared source, not a claim about this one test)*
- [[commission_sweep lands the markup in By-Pass, never operating, and stays sound]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[counts each kind of override, and the house cap as one]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[deals six cascades, four boxes on the Regent, and two raw tickets]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[deals the scenario’s doors and knights]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[deploy refuses a backing that does not implement the interface]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[does NOT break the trust reconciliation]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[does not raise a FALSE compliance flag]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[doors the hierarchy cannot place count toward NO metro’s standing]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[draws the Crown at the head, with its wards beneath it]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[each judgment's declared `requires` matches what its clerk module actually reads]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[estateLabel resolves a slug to its label, falling back to the raw slug]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every catalog row an act names stands in the catalog]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every door names a realm, a shire and a fee the book holds]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every edict names a realm the book holds]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[EVERY enrolled subject is drawn somewhere — the totality guarantee]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every fee names a realm the book holds]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every flow key an act names stands in the flow book]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every founding door bears all four keys]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every goal reads UNMET on a fresh deploy]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every goal reads UNMET when no holding is dealt at all]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every id in the book is unique within its kind]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every metro of the joined book reads its standing, marches first]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every MoneyKind balances within each book (double-entry)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every MoneyKind produces postings — none falls through to default:]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every named agent carries a belt SUFFICIENT for the clerk that runs it]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every named box and cascade actually LANDS on the board]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every office an act leaves headless stands in the census]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every realm names a sovereign — a realm with no law is not a realm]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every roster agent deploys to a core with no ratify/pay tool present]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every roster agent with a wired judgment has a sufficient belt]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every roster entry constructs cleanly]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every seat an act names resolves]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every shire names a realm the book holds]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every step of every named flow resolves — row, holder and key]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every town has exactly ONE manor, and every building a stable slug id]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[falls back to the house cap for an unknown estate]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[falls back to the house cap when no estateId is given]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[fileBacking refuses a doc with no standing War Game]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[firm keeps the WHOLE late fee (splitBps 10000) still nets the owner zero soundly]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[folds the outside trades from their hands’ own notes]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[founding is empty and reads as founding]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[gathers matters from EVERY department — not one kind of thing]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[gathers several hands of one trade under that one guild]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[hangs knights under their fief’s lord, and squires under their knight]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[ignores a GL patch naming a role the chart does not have (leash: never invents an account)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[instantiateFlow stamps estateId on the opened event; readCase folds it forward]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[IRS backup withholding stays sound and rides the solvency identity]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is a READING — answering elsewhere simply stops it being brought]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is a real posting (R1: never the empty default)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is idempotent when local and remote are identical (no duplication)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[is meaningfully SMALLER than the grand muster]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[is null for an absent patch (founding, no setting)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is ordered heaviest FIRST — the docket never rises]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is SOLVENT at rest, with a margin, and the Crown’s own coin is not gone]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[KEEPS a setting the other session loaded, when the base carried none]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[lateness is READ from the day against the clock, never stored]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[Mace: a raw complaint in, an identified cascade proposed, and she stops there]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[memoryBacking never requires a war-game seed]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[Milo: a vendor-commitment case in, a reasoned quote proposed, and he stops there]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[Mira HOLDS an invoice that overruns its authorized ceiling]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[Mira: a settlement case in, a pay/hold recommendation proposed, and she stops there]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[MOVES the owner’s statement — it is their money]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[mtm %→flat : a flat-basis override splits 50/50 on the entered premium]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[mtm_fee balances across both books (the bridge)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[mtm_premium balances within the trust book (owner income collected)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[names NO keep when the office it declares is not in the census]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[names no trade where the note names none]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[needsOwnerApproval agrees with spendGate for the estate override]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[never mutates the base economy]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[NO belt, on any agent, ever grants approveStep or overrideStep]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[no fief stands at the founding — an empty land, read honestly]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[no founding fee bears any word that describes a place]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[no knight seated there holds it at a march]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[no mtm rule at all still resolves via the fallback constant (never throws)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[no muster stands ⇒ the land lies UNREVEALED, and no town is drawn]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[no ONE kind starves the rest — the standing debts are always heard]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[no record anywhere in the book stores a standing]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[normalizeChronicle is idempotent]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[nothing dealt is STALE — the clock starts clean]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[null CLEARS a field — flips the founding flat renewal into a % of new rent]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[ONE door short holds it at a march, and says which clause failed]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[overrides a budget line by accountRole (and can add a new one)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[overrides a fee rate by kind, leaving other rules untouched]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[overrides an existing per-estate cap and upserts a brand-new one]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[overrides the house-wide spend cap]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[overrides the mtm split ratio]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[ownerCents + firmCents always ties the fee (rounding lands on the owner)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[ownerCents + firmCents always ties the premium (rounding lands on the owner)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[re-settling the same WO is caught by the store guard (kind + sourceId)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[readBankRecs folds every physical bank on a real grand muster; none overdrawn]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[reads a master once the office is founded and granted — the act STICKS]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[reads a well-formed roster, trimming and keeping order]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[reads BOTH corporate banks, not just the operating one]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[reads the demo 35% firm / 65% owner split]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[reads the demo 60/40 split (owner takes the remainder)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[reads the trade out of a sentence]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[reads undefined when the economy sets no house cap and the estate has no override]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[reconcileById: a strike on one side is not resurrected by the other]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[refuses a missing/empty id or label, and a duplicate id]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[refuses non-JSON, a non-array, a rowless shape, and unknown fields]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[refuses to construct an agent that does not refuse to ratify]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[rejects malformed rows and bad number shapes]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[rejects non-JSON, a non-object, and an unknown top-level field]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[renames a GL account code and name by role]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[renewal flat→% : a new_rent-basis override yields a percentage of new rent via feeAmount]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[returns the seeded harrow-c estate's own cap]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[run refuses rather than inventing a clock when the backing carries none]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[run refuses with a BeltRefusal naming the missing tag]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[scalars overwrite; an unknown top-level field on the patch is ignored]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[seats all three Crown offices with their Chancellors]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[settling a real WO onto a live grand muster keeps the whole chronicle sound]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[still lets THIS session’s own load win over a stale remote]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[still names the declared office where it DOES stand]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[still weighs a hand-recorded cost when no upkeep book stands]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[sweeping commission through operating (fee_sweep) raises a By-Pass segregation lapse]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[takes at most two words before "guild" — never a whole clause]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[tenant billed the WHOLE fee, owner keeps its share, firm earns its cut — sound with NO funding]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the book reaches ONE door in two hundred — the finding, said as a number]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[THE BUG, pinned: a dealt grand muster runs red but is NOT broke]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the capability table is DEEP frozen — its arrays cannot be widened]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the case spine feeds the gate end-to-end: readCase(estateId) → spendGate]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the coffers ARE dry when the Crown’s own banks run out]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the control reads a SHIRE — all three clauses hold]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the doors read held / vacant / crisis — all three states are drawn]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the fallback (no base) CANNOT honor a strike — it resurrects (documents the limit)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the fee bridge ties]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the Fee shape itself holds only id, realm, name and patron]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the FOUNDING book already scatters a fee across two metros]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the founding book reads one shire and one march]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the founding chronicle is fiduciarily sound (aggregate + temporal)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the founding chronicle is sound]] — *reached by the test FILE through its helper `test/invariants.ts` (shared source, not a claim about this one test)*
- [[the founding chronicle reads as founding]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the founding realm carries an edict of every kind]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the grand muster is UNCHANGED by the campaign’s knobs — a GOLDEN fingerprint]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the household’s craft reading satisfies what the standing asks of it]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the HUD carries only the coffers’ trend, the red month and the fall — no scoreboard]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the id hash is stable and well spread — the view places from it]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the key forgives case, spacing and a tenant suffix — and nothing else]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the M family judgments are all known to this rig]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the muster’s doors decide the standing, not the founding book’s]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the reading and the VIEW’s contract are the same shape — the firewall holds]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the reading counts the metro’s own doors, knights and fees]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the reconciliation’s detail follows its own verdict]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the record and the judgment name the SAME invoice figure]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the scene is PURE — the same records fold the same map, twice]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the shapes stay what they say they are]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the THE_REGENT role resolves against the census it is dealt into]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the three-arg call (no estate) reads the house cap exactly as before]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the trust solvency identity holds (variance ≡ AP − AR)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the two readings are genuinely independent]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the two that cannot be driven refuse with the REASON, not a missing wire]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the two-arg needsOwnerApproval call behaves exactly as before]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the two-arg spendGate call (the harness shape) behaves exactly as before]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the UPKEEP BOOK is the monthly rate — the money log is only the fallback]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the whole founding book, mustered, rolls up to the counts the shelf reads]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the writing session keeps its own board change when it is the one that moved it]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[tribute per door comes from the economy management fee rule (not a hardcode)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[two proposals answered on ONE case count as two]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[two rows for one door are SAID, not chosen in silence]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[two writers appending disjoint events lose nothing on merge (base-blind fallback)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[two writers appending disjoint events lose nothing WITH a base (3-way)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[undefined LEAVES a field; null on a brand-new rule just means absent]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[unionById keeps both sides, remote first, dedupes by id]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[unions money and record books by id too (no owner/grant append lost)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[with no game standing, upkeep falls back to the treasury rolls]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*

## Documents that cite this source

*These name this FILE by its path. That is a citation of the source, not a claim about any one idea inside it — do not read a path citation as agreement, dependence or implementation.*

- [[The Kingdom — Canon]]
- [[Working in parallel — the multi-session doctrine]]
- [[Writ — the economy pillar, re-expressed as chronicle readings]]
- [[Writ — The Gate: the money law is written and nothing enforces it]]

---

*Generated by `tools/vault/emit.mjs` from `src/domain/economy.ts`:1. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
