# Open questions

*Decisions that are genuinely open, written down rather than settled quietly in
a comment. The rule that feeds this file: **if a behaviour can only be justified
by pointing at what one company does, it is probably wrong for a product** —
raise it here instead of shipping it.*

Add to this file freely. An entry needs the question, why it is open, and what
would settle it.

---

## Fee terms that are currently one shape, and probably need to be many

The economy models a fee as a `kind` plus a `basis` plus a rate or flat amount.
That covers a lot, but several real arrangements do not fit cleanly:

- **Tiered management fees** — a rate that changes with door count or with
  collected income. Today a deployment can set one rate per estate, not a curve.
- **Per-owner-agreement variation** — the model allows a per-estate override of
  the rate, but an owner with several estates on one agreement has to be
  expressed estate by estate.
- **Whether a firm keeps all, some or none of a late fee.** Currently a single
  `splitBps`. Some firms split it, some keep it whole, some pass it entirely to
  the owner, and at least one jurisdiction constrains the answer.

**What would settle it:** two or three real fee schedules from unrelated firms,
compared. If they all fit `kind + basis + rate`, close this. If they do not, the
gap is the design.

## The spend gate's default when urgency is unknown

An unclassified repair estimate currently defaults **at** the approval cap, so it
gates — "when in doubt, ask." That is defensible, but it means a firm with a high
cap gets a lot of unnecessary asks, and a firm with a low cap gets none of the
protection the default was meant to give.

**What would settle it:** whether operators experience the default as a safety
net or as noise. Candidate alternative: no default at all, and an unclassified
estimate is a *reading* ("unclassified — cannot gate") rather than a number.

## Whether "artisan" should be a pledge or a relationship

An outside vendor is stored as a pledge (`sellsword`) on a person, which makes
"internal versus external" a property of the human rather than of the engagement.
A contractor who is later hired inside the walls re-pledges, which works — but a
person who is staff at one firm and a vendor to another cannot be modelled at
all, and a shared-services arrangement between two firms would hit this
immediately.

**What would settle it:** a case where one person genuinely holds both
relationships at once. Until then the simpler model is probably right.

## Trust-accounting rules that vary by jurisdiction

`readCompliance` folds five checks that hold nearly everywhere (the bank
reconciles, no trust bank overdrawn, no owner overdrawn, deposits held whole,
earned fees swept in time). The last one carries a day count, and that day count
is set by the jurisdiction, not by the firm. Today it is one number for the whole
deployment.

**What would settle it:** whether a single deployment ever operates across two
jurisdictions with different limits. If it does, the limit belongs on the realm
record (`src/domain/tenure.ts` already models a realm and its regulator) rather
than on the economy.

## Multi-tenancy, and what the per-identity vault rows actually are

The vault keys a chronicle document by verified identity. That is a **sandbox** —
it keeps two people from overwriting each other while exploring — and it is
repeatedly at risk of being described as tenant isolation, which it is not. There
is no tenant record, no membership, no authorisation model between identities,
and writes are whole-document upserts where the last writer wins.

**What would settle it:** deciding whether LandLord is single-tenant per
deployment (in which case the sandbox should be renamed and scoped down) or
multi-tenant (in which case tenancy is a first-class record and this is a large
piece of design, not a rename).
