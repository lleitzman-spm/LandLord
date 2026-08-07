---
type: "module"
id: "module:src/domain/flows.ts"
title: "src/domain/flows.ts"
standing: "built"
standing_source: "knowledge/artifacts.json"
source_path: "src/domain/flows.ts"
source_line: 1
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "module:src/domain/flows.ts"
---

# src/domain/flows.ts

> **STANDING — BUILT**  
> Implemented in code and checkable against the tree.  
> *Declared in `knowledge/artifacts.json`.*

1422 lines · 30 exported symbols.

## What the file says of itself

> ⚠ THE FLOW TEMPLATES BELOW ARE DEMO DATA for the seed tenant. The ENGINE is
> the product — a flow is loaded configuration, and no code here knows the
> word "move-out". The specific steps, holders and timings encode one
> worked way of working; a deployment loads its own.
> The flow engine — the operator's spine (docs/WRIT-FLOW-ENGINE.md, swing one).
> A flow template is *config*: a trigger and a set of steps, each step naming a
> catalog row (task-type), a holder, a timing edge, and the board it belongs
> to. Instantiating a flow on a subject opens one **case** and emits every
> step as an **event** in the 

## Shape

- **Lines:** 1422
- **Exported symbols (30):** `FOUNDING_FLOWS`, `FailureDetects`, `FailureEnds`, `FailureRoute`, `FailureRoutes`, `FlowBook`, `FlowInstance`, `FlowParams`, `FlowReading`, `FlowStep`, `FlowTemplate`, `HolderRef`, `StepReading`, `TimingEdge`, `approveStep`, `awaitsOutside`, `completeStep`, `edgeLine`, `failStep`, `flowsAtFounding`, `fullParams`, `handStep`, `instantiateFlow`, `mayRunUnattended`, `overrideStep`, `paramsOf`, `proposeStep`, `readFailureRoutes`, `readFlow`, `readFlows`
- **Assets it pulls in (no page, so no road):** `knowledge/facts.json`

## Modules

- [[src/domain/events.ts]] — *imported by this file*

## Backlinks

### Writs that specify it

- [[Handoff — where things stand]] — *this writ names the exported symbol `approveStep`; this writ names the exported symbol `awaitsOutside`; +10 more*
- [[The Kingdom — Canon]] — *this writ names the exported symbol `approveStep`; this writ names the exported symbol `completeStep`; +6 more*
- [[The PM Task-and-Process Library (reference)]] — *this writ names the exported symbol `FlowTemplate`; this writ names the exported symbol `instantiateFlow`; +1 more*
- [[Writ — the flow engine (the operator's spine)]] — *this writ names the exported symbol `FOUNDING_FLOWS`*
- [[Writ — The Gate: the money law is written and nothing enforces it]] — *this writ names the exported symbol `approveStep`; this writ names the exported symbol `overrideStep`; +1 more*
- [[Writ — the Land: pods, knights, owners, and guilds (the realm remodeled)]] — *this writ names the exported symbol `flowsAtFounding`; this writ names the exported symbol `readFlow`*
- [[Writ — the operator's hands (swing two, part one)]] — *this writ names the exported symbol `handStep`; this writ names the exported symbol `readFlow`*
- [[Writ — the task-language, the consequences, and the Regent's seat]] — *this writ names the exported symbol `flowsAtFounding`; this writ names the exported symbol `FlowTemplate`; +4 more*

### Facts it depends on

- [[Lease renewal · countersign · after]] — *declared in `knowledge/facts.json`*
- [[Lease renewal · countersign · before]] — *declared in `knowledge/facts.json`*
- [[Lease renewal · countersign · slaDays]] — *declared in `knowledge/facts.json`*
- [[Lease renewal · draft-offer · after]] — *declared in `knowledge/facts.json`*
- [[Lease renewal · draft-offer · before]] — *declared in `knowledge/facts.json`*
- [[Lease renewal · draft-offer · slaDays]] — *declared in `knowledge/facts.json`*
- [[Lease renewal · open-window · after]] — *declared in `knowledge/facts.json`*
- [[Lease renewal · owner-window · after]] — *declared in `knowledge/facts.json`*
- [[Lease renewal · owner-window · before]] — *declared in `knowledge/facts.json`*
- [[Lease renewal · owner-window · slaDays]] — *declared in `knowledge/facts.json`*
- [[Lease renewal · post-fee · after]] — *declared in `knowledge/facts.json`*
- [[Lease renewal · post-fee · before]] — *declared in `knowledge/facts.json`*
- [[Lease renewal · post-fee · beforeDayOfMonth]] — *declared in `knowledge/facts.json`*
- [[Lease renewal · post-fee · onOrAfterDayOfMonth]] — *declared in `knowledge/facts.json`*
- [[Lease renewal · post-fee · slaDays]] — *declared in `knowledge/facts.json`*
- [[Lease renewal · price · after]] — *declared in `knowledge/facts.json`*
- [[Lease renewal · price · slaDays]] — *declared in `knowledge/facts.json`*
- [[Lease renewal · record · after]] — *declared in `knowledge/facts.json`*
- [[Lease renewal · record · slaDays]] — *declared in `knowledge/facts.json`*
- [[Lease renewal · send-offer · after]] — *declared in `knowledge/facts.json`*
- [[Lease renewal · send-offer · before]] — *declared in `knowledge/facts.json`*
- [[Lease renewal · send-offer · slaDays]] — *declared in `knowledge/facts.json`*
- [[Lease renewal · tenant-response · after]] — *declared in `knowledge/facts.json`*
- [[Lease renewal · tenant-response · repeatEveryDays]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · confirm-date · after]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · confirm-date · slaDays]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · deposit-accounting · after]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · deposit-accounting · before]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · deposit-accounting · slaDays]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · deposit-transfer · after]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · deposit-transfer · before]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · deposit-transfer · slaDays]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · final-walk · after]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · final-walk · before]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · list-unit · after]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · list-unit · slaDays]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · log-notice · after]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · log-notice · slaDays]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · move-out-inspection · after]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · move-out-inspection · before]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · move-out-inspection · slaDays]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · owner-reserve · after]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · owner-reserve · before]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · owner-reserve · beforeDayOfMonth]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · owner-reserve · onOrAfterDayOfMonth]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · owner-reserve · slaDays]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · pre-inspection · after]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · pre-inspection · before]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · show-and-screen · after]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · show-and-screen · before]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · turn-scope · after]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · turn-scope · before]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · turn-scope · slaDays]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · turn-work · after]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · turn-work · before]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · turn-work · slaDays]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · weekly-price-drop · after]] — *declared in `knowledge/facts.json`*
- [[Move-out → re-list relay · weekly-price-drop · repeatEveryDays]] — *declared in `knowledge/facts.json`*
- [[Owner onboarding · agreement · after]] — *declared in `knowledge/facts.json`*
- [[Owner onboarding · agreement · slaDays]] — *declared in `knowledge/facts.json`*
- [[Owner onboarding · first-report · after]] — *declared in `knowledge/facts.json`*
- [[Owner onboarding · first-report · before]] — *declared in `knowledge/facts.json`*
- [[Owner onboarding · first-report · slaDays]] — *declared in `knowledge/facts.json`*
- [[Owner onboarding · go-live · after]] — *declared in `knowledge/facts.json`*
- [[Owner onboarding · intake · after]] — *declared in `knowledge/facts.json`*
- [[Owner onboarding · lockbox · after]] — *declared in `knowledge/facts.json`*
- [[Owner onboarding · lockbox · before]] — *declared in `knowledge/facts.json`*
- [[Owner onboarding · lockbox · slaDays]] — *declared in `knowledge/facts.json`*
- [[Owner onboarding · make-ready · after]] — *declared in `knowledge/facts.json`*
- [[Owner onboarding · set-up-records · after]] — *declared in `knowledge/facts.json`*
- [[Owner onboarding · set-up-records · before]] — *declared in `knowledge/facts.json`*
- [[Owner onboarding · set-up-records · slaDays]] — *declared in `knowledge/facts.json`*
- [[Owner onboarding · verify-insurance · after]] — *declared in `knowledge/facts.json`*
- [[Owner onboarding · verify-insurance · before]] — *declared in `knowledge/facts.json`*
- [[Owner onboarding · verify-insurance · slaDays]] — *declared in `knowledge/facts.json`*
- [[Owner onboarding · walkthrough · after]] — *declared in `knowledge/facts.json`*
- [[Owner onboarding · walkthrough · before]] — *declared in `knowledge/facts.json`*
- [[Owner onboarding · walkthrough · slaDays]] — *declared in `knowledge/facts.json`*
- [[Vendor dispatch · assign-vendor · after]] — *declared in `knowledge/facts.json`*
- [[Vendor dispatch · assign-vendor · before]] — *declared in `knowledge/facts.json`*
- [[Vendor dispatch · assign-vendor · slaDays]] — *declared in `knowledge/facts.json`*
- [[Vendor dispatch · confirm-work · after]] — *declared in `knowledge/facts.json`*
- [[Vendor dispatch · confirm-work · before]] — *declared in `knowledge/facts.json`*
- [[Vendor dispatch · confirm-work · slaDays]] — *declared in `knowledge/facts.json`*
- [[Vendor dispatch · dispatch · after]] — *declared in `knowledge/facts.json`*
- [[Vendor dispatch · dispatch · before]] — *declared in `knowledge/facts.json`*
- [[Vendor dispatch · dispatch · slaDays]] — *declared in `knowledge/facts.json`*
- [[Vendor dispatch · identify · after]] — *declared in `knowledge/facts.json`*
- [[Vendor dispatch · identify · slaDays]] — *declared in `knowledge/facts.json`*
- [[Vendor dispatch · invoice-in · after]] — *declared in `knowledge/facts.json`*
- [[Vendor dispatch · invoice-in · before]] — *declared in `knowledge/facts.json`*
- [[Vendor dispatch · invoice-in · slaDays]] — *declared in `knowledge/facts.json`*
- [[Vendor dispatch · pay-vendor · after]] — *declared in `knowledge/facts.json`*
- [[Vendor dispatch · pay-vendor · before]] — *declared in `knowledge/facts.json`*
- [[Vendor dispatch · pay-vendor · beforeDayOfMonth]] — *declared in `knowledge/facts.json`*
- [[Vendor dispatch · pay-vendor · onOrAfterDayOfMonth]] — *declared in `knowledge/facts.json`*
- [[Vendor dispatch · pay-vendor · slaDays]] — *declared in `knowledge/facts.json`*
- [[Vendor dispatch · post-to-accounting · after]] — *declared in `knowledge/facts.json`*
- [[Vendor dispatch · post-to-accounting · before]] — *declared in `knowledge/facts.json`*
- [[Vendor dispatch · post-to-accounting · slaDays]] — *declared in `knowledge/facts.json`*
- [[Vendor dispatch · report · after]] — *declared in `knowledge/facts.json`*
- [[Vendor dispatch · report · slaDays]] — *declared in `knowledge/facts.json`*
- [[Violation / notice · classify · after]] — *declared in `knowledge/facts.json`*
- [[Violation / notice · close · after]] — *declared in `knowledge/facts.json`*
- [[Violation / notice · close · slaDays]] — *declared in `knowledge/facts.json`*
- [[Violation / notice · cure-window · after]] — *declared in `knowledge/facts.json`*
- [[Violation / notice · cure-window · repeatEveryDays]] — *declared in `knowledge/facts.json`*
- [[Violation / notice · decide · after]] — *declared in `knowledge/facts.json`*
- [[Violation / notice · decide · slaDays]] — *declared in `knowledge/facts.json`*
- [[Violation / notice · draft-notice · after]] — *declared in `knowledge/facts.json`*
- [[Violation / notice · draft-notice · before]] — *declared in `knowledge/facts.json`*
- [[Violation / notice · draft-notice · slaDays]] — *declared in `knowledge/facts.json`*
- [[Violation / notice · receive · after]] — *declared in `knowledge/facts.json`*
- [[Violation / notice · serve · after]] — *declared in `knowledge/facts.json`*
- [[Violation / notice · serve · before]] — *declared in `knowledge/facts.json`*
- [[Violation / notice · serve · slaDays]] — *declared in `knowledge/facts.json`*

### Entities

- [[CatalogRow]] — *names the exported symbol `FlowTemplate`*
- [[FlowStep]] — *names the exported symbol `FlowStep`*
- [[FlowTemplate]] — *names the exported symbol `FlowTemplate`*

### Modules

- [[src/domain/agentIntake.ts]] — *imported by this file*
- [[src/domain/campaign.ts]] — *imported by this file*
- [[src/domain/chronicle.ts]] — *imported by this file*
- [[src/domain/escape.ts]] — *imported by this file*
- [[src/domain/wargame.ts]] — *imported by this file*
- [[src/LedgerView.tsx]] — *imported by this file*
- [[src/operator-core.ts]] — *imported by this file*
- [[src/store/chronicleStore.ts]] — *imported by this file*
- [[src/WarTableView.tsx]] — *imported by this file*

### Surfaces

- [[LedgerView]] — *imported by this view*
- [[WarTableView]] — *imported by this view*

### Invariants that enforce it

*These roads come from a shared source FILE, not from a semantic claim: the test file imports the module. Read it as "stands near", never as "proves".*

- [[`awaiting` is NOT an escape — it means parked on a clock, not on a person]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a bare census is never dry — there is nothing to be broke with]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a base-blind merge is unchanged — it still takes the writing session]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a batch that repeats an id inside itself opens one case, not two]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a book cut over the muster places EVERY door — the join is sound]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a case with no estateId folds to null (byte-identical to before)]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a cash-complete sample month is sound]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a Chancellor granted ONE fief holds one fief — an office is not land]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a chase LOOP never runs unattended]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a chronicle predating the estates shelf migrates to the empty founding book]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a classified estimate is still weighed against the cap, both ways]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a clean founding brings NOTHING — the household is fully staffed]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a clerk’s proposal is heard ONCE — never also as a bare waiting case]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a craft left headless IS brought before the court]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a craft standing headless holds it at a march]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a crisis on a leased door OUTRANKS its lease — the map shows trouble]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a CRISIS outranks a fresh matter, and held COIN outranks a bare wait]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a DEADLINE is not a dependency — an SLA step still runs unattended]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a door in no knight’s care is a real state, and reads as debt]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a door the book does not hold reads UNPLACED, and is named]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a door the book holds places cleanly — realm, shire, fee and knight]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a door’s shire and its fee stand in the SAME realm as the door]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a failure sent back to the party who erred is NOT an escape]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a failure that is redone still leaves a mark — the count, not the latest kind]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a fee scattered across two shires reads fine, and rolls up as ONE fee]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a fee with doors scattered across three metros reads fine]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a fee’s patron at odds with the muster’s owner is a finding, not a refusal]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a fief with no grant draws NO lord — the Regent is not its lord]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a full mtm month (split, funded) is sound end-to-end and the bridge ties after the fee]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a full TRUST account never saves the Crown — that coin is not its own]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a fully-worked vendor-dispatch folds to done and reaches settlement]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a GL-rename + fee-rate + mtm-split patch stays sound over a dealt month]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a hand-worked case does not count against a muster]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a headless craft holds back EVERY metro, not one — the household is shared]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a headless office reads as headless — never as somebody else’s]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a house mtm rule with no splitBps falls back to the named constant]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a HUMAN step never runs unattended, however simple it looks]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a human touching an AUTO step is an unplanned escape — the machine failed]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a judgment failure repaired on an `auto` row is a fault — the two claims cannot both hold]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a known band still returns its figure]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a loaded estate roster flips isFoundingChronicle to non-founding]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a march PROMOTES when the records change, with no field written]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a MIDDLE step hands on and closes NOTHING]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a muster deployed on the remote side is adopted, not clobbered by a stale local]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a name the book does not hold reads as NOTHING rather than throwing]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a neglected operation loses doors until tribute drops below upkeep — RED, fallen]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a null/absent patch is a no-op — returns base unchanged (same reference)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a one-off company expense does NOT become the standing monthly upkeep]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a placed door in no knight’s care is NOT unplaced — it is the debt]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a PRE-FUNDED owner settles with NO topup and stays sound]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a present economySetting (even a no-op patch) means the chronicle is no longer "at founding"]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a present economySetting rides the raw record untouched; economyOf folds it in]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a present-but-empty catalog shelf stays empty (truth as struck, not re-seeded)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a re-observed condition with a NEW id does not open a second case]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a real grand muster is sound]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a real grand muster is sound — no false positives on realistic data]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a realm’s edicts read soonest-due first]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a regency draws its keeper, not a lord]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[A RELAY CASE IS MATCHED — the mark is INFIXED, not a prefix]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a revoked grant struck on the remote side stays struck]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a route naming a step the flow does not have writes nothing either]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a row naming a place the book does not hold reads unplaced, and says WHICH]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a self-routed step comes back to the same desk, and the cascade does not walk past it]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a shire DEMOTES again when the records go the other way]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a solvent operation clears its upkeep — black, not fallen]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a spend on the higher-cap estate CLEARS; the same spend on an unlisted estate GATES]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a stale vault reads every craft headless — honestly, and fillable]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a standing muster reveals a realm of towns, every door a building]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a step never reached cannot escape — an idle system is not an automated one]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a step routed upstream sends the case back to where the bad input entered]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a step the catalog marks human is a DESIGNED escape, not a failure]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a step waiting on an OUTSIDE answer never runs unattended]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a step with no declared mode is NOT MEASURED and never joins a total]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a step with NO route cannot fail — nothing is written at all]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a struck money event stays struck through the merge]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a supplied bank statement that disagrees produces the exact lapse]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a target-anchored step with NO target date is unknown, never overdue]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a tenure realm is a PLACE — a name and a sovereign, and no score on it]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a tightened-cap patch stays sound over a dealt month (spend caps do not touch the postings)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a war door and an estate roster both go straight in]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a war door carries NO tenure of its own — only an address and an owner]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a well-ordered owner month is sound (income before fees, temporal-clean)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a work order with no urgency band has NO estimate]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[a zero/invalid bill posts nothing]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[accepts a well-formed patch and round-trips through applyEconomySetting]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[accepts null on a rate field (clear) but still rejects other non-numbers]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[act five is met by holding the watch with no door in crisis]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act four is met by ANSWERING three of the clerks’ proposals]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act one is met by SEATING the empty craft — a record, not a flag]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act six is met by ending a month in the black]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act three is met by getting the boxes onto real desks]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[act two is met by WALKING a cascade to done]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[all three failing at once names all three]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[ALLOWS the step that genuinely waits — the guard is not a wall]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an absent catalog shelf adopts the founding rows]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an absent economySetting normalizes through untouched, and economyOf is a true no-op]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an ancient trifle never outranks today’s crisis — age does not compound forever]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an ANSWERED edict is never late, however long the day is gone]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an artisan naming no trade is shown, not swallowed]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an auto step nobody touched is not an escape at all]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an empty array is valid — the revert-to-founding shape]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an empty muster reads empty, not broken]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an empty object is the valid no-op patch]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an empty object normalizes to founding state]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an estate with a higher cap (harrow-c) clears a spend the house cap would gate]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an estate with no override still reads the house cap]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an estate with no override still reads the house cap (invariant)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an estate's own NTE governs the settlement ceiling where it has one]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an id-keyed array merges by id, not by index]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an out-of-range index is no act at all, like every other writer]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an owed edict PRESSES as its day nears]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an unclassified estimate stops, and says WHY it stopped]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an UNFUNDED owner settles soundly via the shortfall topup]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[an urgency band this table does not know has no estimate either]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[and it says how few independent judgments that rests on]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[and it stops REGARDLESS of the cap — the old default did not]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[and the gate opens for a real, useful number of steps]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[approving the final step records that the case is DONE]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[balances within both books (the bridge)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[both books balance over the whole dealt money log]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[but two fiefs under one lord IS a plurality]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[caps what one court hears, keeping the heaviest and still every kind]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[carries the originating event id onto the opening record]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[catches a deposit refunded from the wrong tenant (per-tenant subledger)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[catches a mid-history breach that the end state hides (temporal replay)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[catches a money event with an unknown kind (silent-drop guard)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[catches an over-sweep (bridge driven negative) the aggregate checker misses]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[catches an owner overdrawn (commingling guard)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[commission_sweep lands the markup in By-Pass, never operating, and stays sound]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[counts each escalation, not each step — this is where rework becomes visible]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[counts each kind of override, and the house cap as one]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[deals six cascades, four boxes on the Regent, and two raw tickets]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[deals the scenario’s doors and knights]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[distinct signals on the same subject open distinct cases]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[doors the hierarchy cannot place count toward NO metro’s standing]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[draws the Crown at the head, with its wards beneath it]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[drops non-string params, which is how a nested record would arrive]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[emits ONLY an opening and the hand to step one — never an approval or a completion]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[estateLabel resolves a slug to its label, falling back to the raw slug]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every agreed signal names a flow and a reason — no silent entries]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every catalog row an act names stands in the catalog]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every door names a realm, a shire and a fee the book holds]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every edict names a realm the book holds]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[EVERY enrolled subject is drawn somewhere — the totality guarantee]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every fee names a realm the book holds]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every flow key an act names stands in the flow book]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every founding door bears all four keys]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every goal reads UNMET on a fresh deploy]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every goal reads UNMET when no holding is dealt at all]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every id in the book is unique within its kind]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every metro of the joined book reads its standing, marches first]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every MoneyKind balances within each book (double-entry)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every MoneyKind produces postings — none falls through to default:]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every named box and cascade actually LANDS on the board]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every office an act leaves headless stands in the census]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every other step still counts from the open date, unchanged]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every realm names a sovereign — a realm with no law is not a realm]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every seat an act names resolves]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every shire names a realm the book holds]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[every step of every named flow resolves — row, holder and key]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every town has exactly ONE manor, and every building a stable slug id]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[falls back to the house cap for an unknown estate]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[falls back to the house cap when no estateId is given]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[firm keeps the WHOLE late fee (splitBps 10000) still nets the owner zero soundly]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[folds the outside trades from their hands’ own notes]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[founding is empty and reads as founding]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[gathers matters from EVERY department — not one kind of thing]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[gathers several hands of one trade under that one guild]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[hangs knights under their fief’s lord, and squires under their knight]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[ignores a GL patch naming a role the chart does not have (leash: never invents an account)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[instantiateFlow stamps estateId on the opened event; readCase folds it forward]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[IRS backup withholding stays sound and rides the solvency identity]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[is a READING — answering elsewhere simply stops it being brought]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[is a real posting (R1: never the empty default)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[is idempotent when local and remote are identical (no duplication)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[is meaningfully SMALLER than the grand muster]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is null for an absent patch (founding, no setting)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[is ordered heaviest FIRST — the docket never rises]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[is SOLVENT at rest, with a margin, and the Crown’s own coin is not gone]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[KEEPS a setting the other session loaded, when the base carried none]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[lateness is READ from the day against the clock, never stored]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[mtm %→flat : a flat-basis override splits 50/50 on the entered premium]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[mtm_fee balances across both books (the bridge)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[mtm_premium balances within the trust book (owner income collected)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[names NO keep when the office it declares is not in the census]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[names no trade where the note names none]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[names routed, unrouted and broken apart]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[names WHICH step leaks, not just that one does]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[needsOwnerApproval agrees with spendGate for the estate override]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[never mutates the base economy]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[no fief stands at the founding — an empty land, read honestly]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[no founding fee bears any word that describes a place]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[no knight seated there holds it at a march]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[no mtm rule at all still resolves via the fallback constant (never throws)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[no muster stands ⇒ the land lies UNREVEALED, and no town is drawn]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[no ONE kind starves the rest — the standing debts are always heard]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[no record anywhere in the book stores a standing]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[no seed is the reading it always was — byte for byte]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[no step in the whole book that waits on the outside may run unattended]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[no step note leaks a literal {token} when rendered with full params]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[normalizeChronicle is idempotent]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[nothing dealt is STALE — the clock starts clean]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[null CLEARS a field — flips the founding flat renewal into a % of new rent]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[once every step is done, the condition may open a fresh case]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[ONE door short holds it at a march, and says which clause failed]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[one muster does not count another muster’s work]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[one step worked over many events counts once, not once per event]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[opens a case on the flow the signal names]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[overrides a budget line by accountRole (and can add a new one)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[overrides a fee rate by kind, leaving other rules untouched]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[overrides an existing per-estate cap and upserts a brand-new one]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[overrides the house-wide spend cap]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[overrides the mtm split ratio]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[overruling the final step closes it too]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[ownerCents + firmCents always ties the fee (rounding lands on the owner)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[ownerCents + firmCents always ties the premium (rounding lands on the owner)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[re-settling the same WO is caught by the store guard (kind + sourceId)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[readBankRecs folds every physical bank on a real grand muster; none overdrawn]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[reads a master once the office is founded and granted — the act STICKS]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[reads a well-formed roster, trimming and keeping order]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[reads BOTH corporate banks, not just the operating one]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[reads taken ids straight out of the log, so no side index can drift]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[reads the demo 35% firm / 65% owner split]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[reads the demo 60/40 split (owner takes the remainder)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[reads the trade out of a sentence]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[reads undefined when the economy sets no house cap and the estate has no override]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[reconcileById: a strike on one side is not resurrected by the other]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[REFUSES a case it cannot see at all — it fails CLOSED]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[refuses a missing/empty id or label, and a duplicate id]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[refuses a row whose string params carry an identifier]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[refuses a row whose SUBJECT carries an identifier]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[REFUSES a step nobody has reached]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[REFUSES an out-of-range step]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[refuses non-JSON, a non-array, a rowless shape, and unknown fields]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[REFUSES to ratify the same step twice]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[rejects malformed rows and bad number shapes]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[rejects non-JSON, a non-object, and an unknown top-level field]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[renames a GL account code and name by role]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[renewal flat→% : a new_rent-basis override yields a percentage of new rent via feeAmount]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[returns the seeded harrow-c estate's own cap]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[routes the good rows in a batch and skips only the bad]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[routes the over-limit spend signal a firm asked for]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[routing the same batch twice opens nothing the second time]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[scalars overwrite; an unknown top-level field on the patch is ignored]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[seats all three Crown offices with their Chancellors]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[settling a real WO onto a live grand muster keeps the whole chronicle sound]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[skips a known signal whose flow this chronicle does not carry]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[skips a malformed row rather than opening a case with a hole in it]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[skips a signal it has never agreed on, and says so]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[still lets THIS session’s own load win over a stale remote]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[still names the declared office where it DOES stand]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[still routes ordinary rows — the scan must not fire on real work]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[still weighs a hand-recorded cost when no upkeep book stands]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[sweeping commission through operating (fee_sweep) raises a By-Pass segregation lapse]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[takes at most two words before "guild" — never a whole clause]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[tenant billed the WHOLE fee, owner keeps its share, firm earns its cut — sound with NO funding]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the book reaches ONE door in two hundred — the finding, said as a number]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[THE BUG, pinned: a dealt grand muster runs red but is NOT broke]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the case READS as done once the last step is ratified]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the case spine feeds the gate end-to-end: readCase(estateId) → spendGate]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the coffers ARE dry when the Crown’s own banks run out]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the control reads a SHIRE — all three clauses hold]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the doors read held / vacant / crisis — all three states are drawn]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the escape count is not folded into the rate]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the fallback (no base) CANNOT honor a strike — it resurrects (documents the limit)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the fee bridge ties]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the Fee shape itself holds only id, realm, name and patron]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the FOUNDING book already scatters a fee across two metros]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the founding book declares no failure routes, and says so rather than defaulting]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the founding book reads one shire and one march]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the founding chronicle is fiduciarily sound (aggregate + temporal)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the founding chronicle is sound]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the founding chronicle reads as founding]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the founding flow book budgets most of its steps to a person]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the founding realm carries an edict of every kind]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the grand muster is UNCHANGED by the campaign’s knobs — a GOLDEN fingerprint]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the household’s craft reading satisfies what the standing asks of it]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the HUD carries only the coffers’ trend, the red month and the fall — no scoreboard]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the id hash is stable and well spread — the view places from it]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the key forgives case, spacing and a tenant suffix — and nothing else]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the move-out relay also folds clean to done]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the muster’s doors decide the standing, not the founding book’s]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the owner's window is BOTH human and outside-waiting — belt and braces]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the reading and the VIEW’s contract are the same shape — the firewall holds]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the reading counts the metro’s own doors, knights and fees]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the scene is PURE — the same records fold the same map, twice]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the seen-map key survives — the separator is a NUL byte, not a space]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the shapes stay what they say they are]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the step IS anchored to the target date, not left to default]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the THE_REGENT role resolves against the census it is dealt into]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the three-arg call (no estate) reads the house cap exactly as before]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the trust solvency identity holds (variance ≡ AP − AR)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the two readings are genuinely independent]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the two-arg needsOwnerApproval call behaves exactly as before]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the two-arg spendGate call (the harness shape) behaves exactly as before]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the UPKEEP BOOK is the monthly rate — the money log is only the fallback]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the whole founding book, mustered, rolls up to the counts the shelf reads]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[the writing session keeps its own board change when it is the one that moved it]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[threads the estate through so the spend gate reads a per-estate cap]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[tribute per door comes from the economy management fee rule (not a hardcode)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[two fresh ids for the same condition in ONE batch open exactly one case]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[two proposals answered on ONE case count as two]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[two rows for one door are SAID, not chosen in silence]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[two writers appending disjoint events lose nothing on merge (base-blind fallback)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[two writers appending disjoint events lose nothing WITH a base (3-way)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[undefined LEAVES a field; null on a brand-new rule just means absent]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[unionById keeps both sides, remote first, dedupes by id]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[unions money and record books by id too (no owner/grant append lost)]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[with a target date ahead, it is due relative to THAT date]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[with no game standing, upkeep falls back to the treasury rolls]] — *reached by the test FILE through its helper `test/fixtures.ts` (shared source, not a claim about this one test)*
- [[with no routes declared the count is zero and the rate is unchanged]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[with the target date past, it breaches like any other step]] — *imported by the test FILE (shared source, not a claim about this one test)*

### flow

- [[Lease renewal]] — *declared in this module*
- [[Move-out → re-list relay]] — *declared in this module*
- [[Owner onboarding]] — *declared in this module*
- [[Vendor dispatch]] — *declared in this module*
- [[Violation / notice]] — *declared in this module*

### guard

- [[when agreement may start]] — *declared in this module*
- [[when assign-vendor may start]] — *declared in this module*
- [[when classify may start]] — *declared in this module*
- [[when close may start]] — *declared in this module*
- [[when confirm-date may start]] — *declared in this module*
- [[when confirm-work may start]] — *declared in this module*
- [[when countersign may start]] — *declared in this module*
- [[when cure-window may start]] — *declared in this module*
- [[when decide may start]] — *declared in this module*
- [[when deposit-accounting may start]] — *declared in this module*
- [[when deposit-transfer may start]] — *declared in this module*
- [[when dispatch may start]] — *declared in this module*
- [[when draft-notice may start]] — *declared in this module*
- [[when draft-offer may start]] — *declared in this module*
- [[when final-walk may start]] — *declared in this module*
- [[when first-report may start]] — *declared in this module*
- [[when go-live may start]] — *declared in this module*
- [[when identify may start]] — *declared in this module*
- [[when invoice-in may start]] — *declared in this module*
- [[when list-unit may start]] — *declared in this module*
- [[when lockbox may start]] — *declared in this module*
- [[when make-ready may start]] — *declared in this module*
- [[when move-out-inspection may start]] — *declared in this module*
- [[when owner-reserve may start]] — *declared in this module*
- [[when owner-window may start]] — *declared in this module*
- [[when pay-vendor may start]] — *declared in this module*
- [[when post-fee may start]] — *declared in this module*
- [[when post-to-accounting may start]] — *declared in this module*
- [[when pre-inspection may start]] — *declared in this module*
- [[when price may start]] — *declared in this module*
- [[when record may start]] — *declared in this module*
- [[when send-offer may start]] — *declared in this module*
- [[when serve may start]] — *declared in this module*
- [[when set-up-records may start]] — *declared in this module*
- [[when show-and-screen may start]] — *declared in this module*
- [[when tenant-response may start]] — *declared in this module*
- [[when turn-scope may start]] — *declared in this module*
- [[when turn-work may start]] — *declared in this module*
- [[when verify-insurance may start]] — *declared in this module*
- [[when walkthrough may start]] — *declared in this module*
- [[when weekly-price-drop may start]] — *declared in this module*

### hand

- [[lp-queue]] — *declared in this module*
- [[pm-desk]] — *declared in this module*
- [[va-desk]] — *declared in this module*

### place

- [[Lease renewal: countersign]] — *declared in this module*
- [[Lease renewal: draft-offer]] — *declared in this module*
- [[Lease renewal: open-window]] — *declared in this module*
- [[Lease renewal: owner-window]] — *declared in this module*
- [[Lease renewal: post-fee]] — *declared in this module*
- [[Lease renewal: price]] — *declared in this module*
- [[Lease renewal: record]] — *declared in this module*
- [[Lease renewal: send-offer]] — *declared in this module*
- [[Lease renewal: tenant-response]] — *declared in this module*
- [[Move-out → re-list relay: confirm-date]] — *declared in this module*
- [[Move-out → re-list relay: deposit-accounting]] — *declared in this module*
- [[Move-out → re-list relay: deposit-transfer]] — *declared in this module*
- [[Move-out → re-list relay: final-walk]] — *declared in this module*
- [[Move-out → re-list relay: list-unit]] — *declared in this module*
- [[Move-out → re-list relay: log-notice]] — *declared in this module*
- [[Move-out → re-list relay: move-out-inspection]] — *declared in this module*
- [[Move-out → re-list relay: owner-reserve]] — *declared in this module*
- [[Move-out → re-list relay: pre-inspection]] — *declared in this module*
- [[Move-out → re-list relay: show-and-screen]] — *declared in this module*
- [[Move-out → re-list relay: turn-scope]] — *declared in this module*
- [[Move-out → re-list relay: turn-work]] — *declared in this module*
- [[Move-out → re-list relay: weekly-price-drop]] — *declared in this module*
- [[Owner onboarding: agreement]] — *declared in this module*
- [[Owner onboarding: first-report]] — *declared in this module*
- [[Owner onboarding: go-live]] — *declared in this module*
- [[Owner onboarding: intake]] — *declared in this module*
- [[Owner onboarding: lockbox]] — *declared in this module*
- [[Owner onboarding: make-ready]] — *declared in this module*
- [[Owner onboarding: set-up-records]] — *declared in this module*
- [[Owner onboarding: verify-insurance]] — *declared in this module*
- [[Owner onboarding: walkthrough]] — *declared in this module*
- [[Vendor dispatch: assign-vendor]] — *declared in this module*
- [[Vendor dispatch: confirm-work]] — *declared in this module*
- [[Vendor dispatch: dispatch]] — *declared in this module*
- [[Vendor dispatch: identify]] — *declared in this module*
- [[Vendor dispatch: invoice-in]] — *declared in this module*
- [[Vendor dispatch: pay-vendor]] — *declared in this module*
- [[Vendor dispatch: post-to-accounting]] — *declared in this module*
- [[Vendor dispatch: report]] — *declared in this module*
- [[Violation / notice: classify]] — *declared in this module*
- [[Violation / notice: close]] — *declared in this module*
- [[Violation / notice: cure-window]] — *declared in this module*
- [[Violation / notice: decide]] — *declared in this module*
- [[Violation / notice: draft-notice]] — *declared in this module*
- [[Violation / notice: receive]] — *declared in this module*
- [[Violation / notice: serve]] — *declared in this module*

### transition

- [[agreement → set-up-records]] — *declared in this module*
- [[assign-vendor → dispatch]] — *declared in this module*
- [[classify → decide]] — *declared in this module*
- [[confirm-date → pre-inspection]] — *declared in this module*
- [[confirm-work → pay-vendor]] — *declared in this module*
- [[countersign → post-fee]] — *declared in this module*
- [[cure-window → close]] — *declared in this module*
- [[decide → draft-notice]] — *declared in this module*
- [[deposit-accounting → deposit-transfer]] — *declared in this module*
- [[deposit-transfer → final-walk]] — *declared in this module*
- [[dispatch → invoice-in]] — *declared in this module*
- [[draft-notice → serve]] — *declared in this module*
- [[draft-offer → send-offer]] — *declared in this module*
- [[final-walk → list-unit]] — *declared in this module*
- [[first-report → go-live]] — *declared in this module*
- [[identify → assign-vendor]] — *declared in this module*
- [[intake → agreement]] — *declared in this module*
- [[invoice-in → confirm-work]] — *declared in this module*
- [[list-unit → show-and-screen]] — *declared in this module*
- [[lockbox → first-report]] — *declared in this module*
- [[log-notice → confirm-date]] — *declared in this module*
- [[make-ready → lockbox]] — *declared in this module*
- [[move-out-inspection → turn-scope]] — *declared in this module*
- [[open-window → price]] — *declared in this module*
- [[owner-reserve → turn-work]] — *declared in this module*
- [[owner-window → tenant-response]] — *declared in this module*
- [[pay-vendor → post-to-accounting]] — *declared in this module*
- [[post-fee → record]] — *declared in this module*
- [[pre-inspection → move-out-inspection]] — *declared in this module*
- [[price → draft-offer]] — *declared in this module*
- [[receive → classify]] — *declared in this module*
- [[report → identify]] — *declared in this module*
- [[send-offer → owner-window]] — *declared in this module*
- [[serve → cure-window]] — *declared in this module*
- [[set-up-records → walkthrough]] — *declared in this module*
- [[show-and-screen → weekly-price-drop]] — *declared in this module*
- [[tenant-response → countersign]] — *declared in this module*
- [[turn-scope → owner-reserve]] — *declared in this module*
- [[turn-work → deposit-accounting]] — *declared in this module*
- [[verify-insurance → make-ready]] — *declared in this module*
- [[walkthrough → verify-insurance]] — *declared in this module*

## Documents that cite this source

*These name this FILE by its path. That is a citation of the source, not a claim about any one idea inside it — do not read a path citation as agreement, dependence or implementation.*

- [[Handoff — where things stand]]
- [[The Kingdom — Canon]]
- [[The PM Task-and-Process Library (reference)]]
- [[The sibling boundary — who owns the process model]]
- [[Writ — the first War Game (the proving ground)]]
- [[Writ — the flow engine (the operator's spine)]]
- [[Writ — The Gate: the money law is written and nothing enforces it]]
- [[Writ — the operator's hands (swing two, part one)]]
- [[Writ — the task-language, the consequences, and the Regent's seat]]

---

*Generated by `tools/vault/emit.mjs` from `src/domain/flows.ts`:1. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
