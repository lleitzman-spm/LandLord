# ADR: One deny-by-default authority kernel

**Status:** Accepted target; typed Worker seam implemented, remaining adapters fail closed or stay simulation-only
**Date:** 2026-08-09
**Decider:** Founder

## Context

LandLord currently has strong authentication and useful domain helpers, but an authenticated caller can still replace a whole Chronicle document. Compare-and-set protects against lost replacement; it does not establish that an event was authorized, causal, current, idempotent, or within a monetary grant. The game, local harness, deployed Worker, and future shadow runtime also do not yet prove that they invoke one equivalent enforcement boundary.

The approved product boundary is: SPM owns identity-bearing operating evidence; LandLord consumes bounded evidence, proposes or performs only typed acts inside an explicit grant, refuses everything else, and accounts for the human attention that remains.

## Decision

All consequential operational writes pass through one pure, deny-by-default command evaluator before persistence. The server, not the caller, mints accepted events. The evaluator receives the current Chronicle, a typed command, the authenticated actor, and the current clock. It either returns a complete append-only event batch or a structured refusal; it never partially accepts a command.

Every currently accepted command names its case, flow and immutable flow version, exact step and attempt, expected case version, actor, authority grant, origin, trusted cause reference, idempotency key, evidence version, policy version, purpose, and amount classification. The evaluator enforces exact current-step causality, case scope, capability, grant expiry, flow and catalog digests, amount and purpose limits, evidence/policy freshness, actor identity, and idempotency. Correction commands are not exposed until a real reversing/tombstone fold exists.

Raw whole-document PUT is denied for canonical and per-identity Worker documents. Shadow mode has no operational writer. The only deployed Chronicle write seam in this decision is `POST /api/command`, and it accepts only typed commands with a single-attempt compare-and-set.

The end-state remains one evaluator across the proving ground, local runner, named rig, deployed Worker, and any future operating shadow. That equivalence is **not yet implemented**: the UI's former remote whole-document write is refused, the fleet route is disabled, the canonical Chronicle has no typed writer, the court roll is a separate legacy human surface, and the synthetic attention shadow has no operational writer. None of those surfaces may claim LIVE or equivalent enforcement until it is adapted and tested against this kernel.

## Options considered

### Keep cooperative domain helpers plus whole-document CAS

Lower migration cost, but invalid events remain writable by direct or confused callers. Rejected because CAS protects concurrency, not authority.

### Add validation independently to each route

Incremental, but creates path-dependent safety and makes proving runtime equivalence impossible. Rejected because every new caller becomes another authority implementation.

### One command evaluator at the authoritative boundary

Higher initial migration cost and requires explicit event identity, but makes refusal compositional, testable, and shared across runtimes. Accepted.

## Consequences

- Existing UI and fleet callers must migrate from arbitrary document replacement to typed commands before they can be classified operational.
- Old or unversioned flow books may still be rendered and replayed as historical/simulation records, but operational commands against them refuse until a version is ratified.
- Corrections must eventually append explicit reversing or tombstone records; until a fold consumes them correctly, the external command protocol refuses to offer correction at all.
- A valid identity is necessary but never sufficient authority.
- Shadow output remains an isolated proposal/evaluation record and cannot reuse an operational credential.
- Promotion of one bounded act requires a typed, expiring grant plus replayable evidence that every forbidden case refused.

## Required proof

Hostile tests cover wrong case, wrong/current-future step, stale case version, stale policy/evidence, duplicate command, expired or mismatched grant, unauthorized amount, forged actor, mutable flow/catalog bytes, generic writer bypass, double ratification, and cross-scope fleet work. The current proof applies to the typed Worker seam. Adapter equivalence remains a later promotion gate and must show the same command produces the same acceptance or refusal before any additional runtime is classified operational.

The checkable implementation is `src/domain/authority.ts`, the single-attempt persistence adapter is `src/server/command.ts`, and the deployed route is wired in `src/worker.ts`. The hostile contract is pinned by `test/authority-kernel-hostile.test.ts` and `test/typed-command-door.test.ts`.
