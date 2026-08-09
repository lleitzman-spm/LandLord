# ADR: One deny-by-default authority kernel

**Status:** Accepted
**Date:** 2026-08-09
**Decider:** Founder

## Context

LandLord currently has strong authentication and useful domain helpers, but an authenticated caller can still replace a whole Chronicle document. Compare-and-set protects against lost replacement; it does not establish that an event was authorized, causal, current, idempotent, or within a monetary grant. The game, local harness, deployed Worker, and future shadow runtime also do not yet prove that they invoke one equivalent enforcement boundary.

The approved product boundary is: SPM owns identity-bearing operating evidence; LandLord consumes bounded evidence, proposes or performs only typed acts inside an explicit grant, refuses everything else, and accounts for the human attention that remains.

## Decision

All consequential operational writes pass through one pure, deny-by-default command evaluator before persistence. The server, not the caller, mints accepted events. The evaluator receives the current Chronicle, a typed command, the authenticated actor, and the current clock. It either returns a complete append-only event batch or a structured refusal; it never partially accepts a command.

Every command names its case, flow and immutable flow version, exact step and attempt, expected case version, actor, authority grant, origin, cause, idempotency key, evidence version, policy version, and any correction target. The evaluator enforces exact current-step causality, case scope, capability, grant expiry, amount and purpose limits, evidence/policy freshness, actor identity, and idempotency.

Raw whole-document PUT remains available only to explicitly marked simulation fixtures during migration. It is not an operational authority boundary. Shadow mode has no operational writer. Live mode accepts only typed commands.

The proving ground, local runner, named rig, deployed Worker, and shadow evaluator use this same evaluator. A different transport may supply the command, but no transport owns a second authorization implementation.

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
- Corrections append explicit reversing or tombstone records; they never erase the event being corrected.
- A valid identity is necessary but never sufficient authority.
- Shadow output remains an isolated proposal/evaluation record and cannot reuse an operational credential.
- Promotion of one bounded act requires a typed, expiring grant plus replayable evidence that every forbidden case refused.

## Required proof

Hostile tests cover wrong case, wrong/current-future step, stale case version, stale policy/evidence, duplicate command, expired or mismatched grant, unauthorized amount, forged actor, generic writer bypass, double ratification, and cross-scope fleet work. Combined verification must show the same command produces the same acceptance or refusal in every runtime adapter.
