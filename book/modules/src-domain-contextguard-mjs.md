---
type: "module"
id: "module:src/domain/contextGuard.mjs"
title: "src/domain/contextGuard.mjs"
standing: "built"
standing_source: "knowledge/artifacts.json"
source_path: "src/domain/contextGuard.mjs"
source_line: 1
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "module:src/domain/contextGuard.mjs"
---

# src/domain/contextGuard.mjs

> **STANDING — BUILT**  
> Implemented in code and checkable against the tree.  
> *Declared in `knowledge/artifacts.json`.*

310 lines · 7 exported symbols.

## What the file says of itself

> The one model-context boundary, shared by browser builds, the Worker, and
> the Node harness. Provider transports stay private behind `guardComplete`;
> callers can construct only a client that scans before it sends.

## Shape

- **Lines:** 310
- **Exported symbols (7):** `IDENTITY_GUARDED`, `IdentityLeakError`, `assertNoIdentity`, `findIdentity`, `findPersistentIdentity`, `guardComplete`, `isIdentityGuarded`

## Backlinks

### Writs that specify it

- [[Handoff — where things stand]] — *this writ names the exported symbol `guardComplete`; this writ names the exported symbol `isIdentityGuarded`*

### Modules

- [[src/domain/contextGuard.d.mts]] — *the implementation this declaration file describes (same stem)*
- [[src/domain/contextGuard.ts]] — *imported by this file*

### Invariants that enforce it

*These roads come from a shared source FILE, not from a semantic claim: the test file imports the module. Read it as "stands near", never as "proves".*

- [[${name} works a real ${flowKey}/${stepKey} case and stops at a proposal]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a `done` written through a granted completeStep is stamped with the seat]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a belt tag that grants nothing is DECLARED as such, never left looking like a grant]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[a deployed agent's core carries only functions its belt tags grant]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an agent CAN still advance a cascade — the belt makes it legible, not impossible]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an agent with no wired judgment refuses to run rather than pretend to]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[an unknown belt tag is refused at deploy, not silently ignored]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[and CLEARS an invoice that stays inside it — both verdicts are reachable]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[and the grammars they need really are absent from the founding book]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[appendEvents on a memory backing never touches disk]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[appendEvents on a seedless chronicle refuses, not just readLog]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[atStepFixture refuses to park on a step the book does not have]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[buildAgent touches no I/O and needs no backing]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[deploy refuses a backing that does not implement the interface]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[does NOT re-wrap an already-guarded transport — that would swallow the caller's poison flag]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[each judgment's declared `requires` matches what its clerk module actually reads]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every named agent carries a belt SUFFICIENT for the clerk that runs it]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every roster agent deploys to a core with no ratify/pay tool present]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every roster agent with a wired judgment has a sufficient belt]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[every roster entry constructs cleanly]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[fileBacking refuses a doc with no standing War Game]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[Mace: a raw complaint in, an identified cascade proposed, and she stops there]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[memoryBacking never requires a war-game seed]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[Milo: a vendor-commitment case in, a reasoned quote proposed, and he stops there]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[Mira HOLDS an invoice that overruns its authorized ceiling]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[Mira: a settlement case in, a pay/hold recommendation proposed, and she stops there]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[NO belt, on any agent, ever grants approveStep or overrideStep]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[refuses to construct an agent that does not refuse to ratify]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[run refuses rather than inventing a clock when the backing carries none]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[run refuses with a BeltRefusal naming the missing tag]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the capability table is DEEP frozen — its arrays cannot be widened]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the M family judgments are all known to this rig]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the record and the judgment name the SAME invoice figure]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the two that cannot be driven refuse with the REASON, not a missing wire]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[the wrap it installs really does block a leaking payload]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[wraps an UNGUARDED transport, so a direct caller of deploy/run still gets the boundary]] — *imported by the test FILE (shared source, not a claim about this one test)*

---

*Generated by `tools/vault/emit.mjs` from `src/domain/contextGuard.mjs`:1. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
