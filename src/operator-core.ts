// The operator's core — the pure domain engine, bundled for the harness.
//
// Swing four (WRIT-TASK-LANGUAGE, "prove one agent") reuses `harness/` as an
// OPERATOR, not the K3 builder: a small loop with a two-tool belt (read the
// chronicle, append events) driven by a cheap brain. The crux decision was
// FAITHFUL FLOW REUSE — the agent must advance a cascade through the REAL flow
// engine, never a reimplementation, so the app's `readFlows` renders the
// agent's work identically to a human's (no drift, KINGDOM.md "one source").
//
// The harness is raw Node with no tsx/esbuild, and Node's --experimental-strip-
// types chokes on the domain's extensionless imports, so the engine can't be
// imported from `.ts` directly. This module is the seam: `npm run build:operator`
// bundles it (vite lib build → dist-operator/operator-core.mjs) and the harness
// imports the built `.mjs`. Nothing here is new logic — it only re-exports the
// same functions the store and the Ledger already use, so the operator grips
// EXACTLY the primitives a human does.

// ── The flow engine (the operator's spine) ──────────────────────────────────
export {
  instantiateFlow,
  handStep,
  completeStep,
  approveStep,
  overrideStep,
  proposeStep,
  readFlows,
  readFlow,
  fullParams,
  paramsOf,
} from './domain/flows';
export type { FlowBook, FlowTemplate, FlowParams, FlowInstance, FlowReading } from './domain/flows';

// ── The catalog (the task-language the agent reads) ─────────────────────────
export { findRow, rowsByDomain, titleOf, flowKeyFor, domainsOf, systemsOf } from './domain/catalog';
export type { Catalog, CatalogRow, DomainGroup } from './domain/catalog';

// ── The event log (the queue the agent works off) ───────────────────────────
export { readCases, readCase, queues, ageInDays, awaitingHuman } from './domain/events';
export type { KingdomEvent, EventLog, CaseReading, EventKind } from './domain/events';

// ── The economy (the money-dimension — coin folded from the log) ─────────────
export {
  FOUNDING_ECONOMY,
  postingsFor,
  readPostings,
  balanceOf,
  booksBalance,
  readSolvency,
  bridgeCheck,
  readPnL,
  readBudgetVsActual,
  readOwnerStatement,
  readCorporateCoffers,
  readCompliance,
  feeAmount,
  feeRuleFor,
  needsOwnerApproval,
  estimateSpendCents,
  spendGate,
  spendCapFor,
  mtmSplit,
  lateFeeSplit,
  reconcileSpend,
  vendorSettlementMoney,
  readBankRecs,
  coinCents,
} from './domain/economy';
export type { EconomyBook, MoneyEvent, MoneyLog, MoneyKind, Posting, LedgerAccount, FeeRule, SpendGate, SpendDisposition, SpendReconciliation, BankId, BankRec, BankRecs } from './domain/economy';

// ── The gate (the economy-setting patch, folded on read) ────────────────────
// The harness works on a RAW vault doc, not a normalized chronicle, so it can't
// call `chronicle.ts`'s `economyOf` directly — it composes the same fold itself:
// `applyEconomySetting(doc.economy ?? FOUNDING_ECONOMY, doc.economySetting)`.
// One seam, two doors: a setting loaded through the Counting-house gate governs
// the clerks' spend gates exactly as it governs every app reading.
export { applyEconomySetting } from './domain/economySetting';
export type { EconomySettingPatch } from './domain/economySetting';

// The enrichment boundary (the producer boundary). Shipped in
// the runtime bundle because BOTH hands that run clerks — the Node harness and
// the Worker's fleet route — must be unable to call a brain unguarded.
export { assertNoIdentity, guardComplete, findIdentity, IdentityLeakError } from './domain/contextGuard';
export type { IdentityFinding } from './domain/contextGuard';
