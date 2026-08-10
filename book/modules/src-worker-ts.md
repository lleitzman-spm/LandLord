---
type: "module"
id: "module:src/worker.ts"
title: "src/worker.ts"
standing: "built"
standing_source: "knowledge/artifacts.json"
source_path: "src/worker.ts"
source_line: 1
origin: "derived"
generator: "tools/vault/emit.mjs"
aliases:
  - "module:src/worker.ts"
---

# src/worker.ts

> **STANDING — BUILT**  
> Implemented in code and checkable against the tree.  
> *Declared in `knowledge/artifacts.json`.*

337 lines · 2 exported symbols.

## What the file says of itself

> The deployed keyholder. What vite.config.ts's chronicleStore does for the
> dev server, this worker does for the deployed castle: the browser speaks
> only to /api/chronicle, and behind that door the worker alone holds the
> vault key — Supabase Postgres, row security with no policies, so only the
> secret key passes (see docs/KINGDOM.md, "The vault"). Per the walls ruling
> this worker runs only behind the Cloudflare Access wall — wall first, route
> second, deploy third — and the key arrives by `npx wrangler secret put
> SUPABASE_SECRET_KEY`, never in git and never in the browser. There is no
> repo ledger 

## Shape

- **Lines:** 337
- **Exported symbols (2):** `Env`, `createWorker`
- **Assets it pulls in (no page, so no road):** `harness/brain-doctrine.mjs`, `harness/run-fleet.mjs`, `harness/run-guard.mjs`

## Modules

- [[src/operator-core.ts]] — *imported by this file*
- [[src/server/access.ts]] — *imported by this file*
- [[src/server/border.ts]] — *imported by this file*
- [[src/server/brain.ts]] — *imported by this file*
- [[src/server/command.ts]] — *imported by this file*
- [[src/server/courtroll.ts]] — *imported by this file*
- [[src/server/vault.ts]] — *imported by this file*

## Backlinks

### Entities

- [[The deployed keyholder (the Worker)]] — *declared in `knowledge/entities.json`*

### Invariants that enforce it

*These roads come from a shared source FILE, not from a semantic claim: the test file imports the module. Read it as "stands near", never as "proves".*

- [[authenticates before reporting missing vault configuration]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[denies generic PUT on the canonical document too]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[denies generic PUT on the exact per-identity document used by commands]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[denies generic writes even on the verified identity sandbox]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[derives the sandbox only from a valid signed assertion]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[does not replay an accepted command after a compare-and-set conflict]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[does not treat a raw Access email header as identity or canonical authority]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[is private at the Worker wall]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[keeps a real read failure distinct from an identity failure]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[keeps canonical access on a separate machine capability]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[keeps the legacy fleet disabled until it uses typed commands]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[keeps the untyped fleet writer shut]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[lets non-api paths fall through to the castle assets]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[persists only the server-minted event batch]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[rejects a missing assertion on %s before touching the vault]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[rejects a signed assertion with no usable identity claim]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[rejects caller-supplied event shape before any write]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[rejects the wrong audience and a forged signature]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[requires verifier configuration rather than failing open]] — *imported by the test FILE (shared source, not a claim about this one test)*
- [[serves a new verified identity founding rather than the canonical Chronicle]] — *imported by the test FILE (shared source, not a claim about this one test)*

## Documents that cite this source

*These name this FILE by its path. That is a citation of the source, not a claim about any one idea inside it — do not read a path citation as agreement, dependence or implementation.*

- [[ADR: One deny-by-default authority kernel]]

---

*Generated by `tools/vault/emit.mjs` from `src/worker.ts`:1. **Never edit this page** — it is a view, not an artifact. Fix the source and re-compile (`npm run book`).*
