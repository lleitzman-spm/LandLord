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

## ~~The spend gate's default when urgency is unknown~~ — SETTLED 2026-08-06

**Settled: an unclassified work order does not progress.** *"If it's unclassified it
shouldn't progress because where will it go?"*

The question as originally written asked whether the default felt like a safety net
or like noise. Reading the code to answer it turned up something worse than either:
there was no policy, only a coincidence. An unclassified work order was given
`$350`, a figure chosen to sit exactly AT the demo cap so it would trip the gate.
Raise the cap to $500 and the same unclassified work order read `within-authority`
and proceeded — on an estimate nobody made, for a job nobody classified. The
settlement path then posted that fabricated figure to the ledger as a real vendor
payment.

There is no default now. `estimateSpendCents` returns undefined for an unknown band,
`spendGate` returns a fourth disposition — `unclassified` — which stops the work
order and says *why* it stopped, and the settlement posts no money for a bill nobody
produced. Six tests, verified by restoring the sentinel and watching three fail.

The general rule this belongs to: **a sentinel wearing a dollar sign is worse than an
absence, because every reading downstream treats it as money.** Same shape as the
timing anchors, where a step whose date is unknown gets no due date rather than a
made-up one. Unknown is not overdue; unclassified is not cheap.

## Whether "artisan" should be a pledge or a relationship — ANSWERED, NOT YET BUILT

**The case exists, and it is not hypothetical.** This entry asked for "a case where
one person genuinely holds both relationships at once. Until then the simpler model
is probably right." That case was produced 2026-08-06, from the operator's own
commercial arrangements, and it is not an edge — it is the normal shape of a small
group of businesses that share owners.

Stated structurally (the people are real; their names are not this repository's to
carry, per CLAUDE.md's first rule):

- One individual is a **partner in firm A** and the **owner of firm B**, and firm B
  is a **vendor to firm A**. Internal and external at once, in the same week, over
  the same two entities.
- A second individual is likewise a partner in one firm and the supplier of a
  professional service to two others.

Under the current model an outside vendor is a pledge on the PERSON, so
internal-versus-external is a property of the human rather than of the engagement.
These people cannot be represented at all: whichever pledge is chosen is wrong from
the other firm's point of view, and both firms are in scope.

**So the model has to change: the relationship belongs on the engagement, not on the
person.** A person may hold several at once, each scoped to the counterparty.

**Not built yet, and deliberately so** — it lands on top of tenancy rather than under
it. Tenancy is the thing that makes "from firm A's point of view" expressible at all,
and building a per-engagement relationship model before there is a tenant to scope it
to would produce the wrong shape twice.

## ~~Trust-accounting rules that vary by jurisdiction~~ — SETTLED 2026-08-06

**Settled: properties are always in one jurisdiction, so one number is correct.**
*"Properties will never be outside of texas, owners likely will be."*

Trust-accounting duty follows the property and the licensed broker, not the owner's
address, so the sweep-days limit stays a single deployment-wide number and does NOT
move onto the realm record. Recorded here explicitly rather than left looking like an
oversight — an unexplained single number and a deliberate one are indistinguishable
from the outside, which is the whole reason this file exists.

**What this does NOT settle, and must not be read as settling.** Owners being
out-of-state is a real and separate axis. It does not touch trust accounting, and it
may well touch owner reporting — non-resident withholding and year-end tax documents
are governed by where the OWNER sits, not the property. Nothing in the tree models
that today. It is not raised as a question here because nobody has yet said it is in
scope; if owner reporting is ever built, this is the first thing to ask about it.

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
