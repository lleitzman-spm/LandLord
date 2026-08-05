# The clerk-brain doctrine — what intelligence powers which clerk

*The runtime sibling of `docs/MODEL-DOCTRINE.md`. That doc allocates the minds that **build** the
kingdom (Opus/Fable/K3/Sonnet at the session, human-in-the-loop, spend-when-the-ROI-is-there). This
one allocates the minds that **run inside** it — the clerks, invoked per case, at volume, often
unattended. Different work, different economics, different failure modes. Read this before wiring a
brain into any seat. Drafted 2026-07-20 (Edwin named the need the moment swing four proved ONE clerk);
recommendations are mine to propose and the Regent's to ratify or amend — the open questions at the
foot are his calls.*

## The one idea

**A clerk is three separable choices, not one: where it RUNS, what it THINKS with, and what TOOLS sit
beneath it.** Pick each deliberately, per seat and per task-type. The governing rule is the same as the
build doctrine, inverted for runtime: **use the cheapest thing that clears the bar, escalate only on
doubt, and let the data gate decide where the brain may live.** A frontier model on every routine work
order is as wrong at runtime as Haiku on a flagship build is at session-time.

## Build-time vs run-time — do not confuse the two doctrines

| | Build doctrine (MODEL-DOCTRINE) | Clerk-brain doctrine (this) |
|---|---|---|
| Who | Opus/Fable/K3/Sonnet | tools · cheap hosted · mid · frontier · local |
| When | at the session, a few big swings | inside the running kingdom, per case, at volume |
| Watched? | yes — Opus reviews every diff | mostly unattended — the human ratifies the *proposal*, not each call |
| Cost shape | per-swing; spend for ROI | per-call × calls/day; a fraction of a cent compounds |
| Governs | *who writes the code* | *who does the work the code delegates* |
| Data | the repo (no client secrets) | may touch **real client data** → the gate binds it |

The trap is reaching for a session-grade model (Opus, Fable) to power a clerk because it's "smartest."
At runtime that is backwards: smartest-per-call loses to cheapest-that-clears-the-bar, because the
clerk runs thousands of times and a human still ratifies the judgment.

## The three layers of a clerk

1. **Where it RUNS — the runtime host.** Today the operator runs in `harness/` (Node, dev, straight on
   `data/chronicle.json`). A production fleet needs a home: a Worker cron, a small always-on agent
   service, or Edwin's box. **This choice is itself a choke point** — wherever the clerk runs is a
   dependency, and it must be able to reach whatever brain it uses (a local model means the clerk must
   run somewhere on the same network as the box).
2. **What it THINKS with — the brain.** The reasoning engine, chosen by task shape (the tiers below).
3. **What sits BENEATH it — the tools.** Deterministic rules, lookups, embeddings/classifiers, RAG
   retrieval, the flow engine itself. Much "clerk intelligence" is not reasoning at all — it is
   classification or lookup, and belongs in a tool, not a model.

## The tiers — task shape → brain

| Tier | The work | Engine | Why |
|---|---|---|---|
| **0 · tool** | classify / look up / match / retrieve — no judgment | deterministic rules, embeddings nearest-neighbor, RAG, the flow engine | free, instant, auditable, **private**; prefer it whenever the task is really lookup. *Swing four's keyword heuristic already IS a Tier-0 identify, and it identified correctly when the brain was unreachable.* |
| **1 · cheap hosted / small local** | bounded classify · extract · route · fill a form | Kimi k2.7 · Haiku · a local 7–8B | the clerk's bread and butter; **swing four's vendor-dispatch identify lives here** |
| **2 · mid** | draft with judgment · triage the ambiguous · summarize a thread | Sonnet · a local ~70B | real language work a human will still ratify |
| **3 · frontier** | genuinely ambiguous · high-stakes · a supervisor arbitrating other clerks | Opus · Fable | rare, low-volume, always human-ratified — the tail, never the trunk |

**Escalate on doubt, don't provision for the worst case.** Run Tier 0/1 first; if the tool can't resolve
or the cheap brain reports low confidence, escalate one tier. Most cases never leave Tier 0/1; only the
hard tail reaches Tier 3. This confidence-escalation is the single biggest cost lever at volume — the
runtime equivalent of "don't fritter the big hands on small errands."

## The roster and its trade-offs

| Engine | Capability | $/call | Latency | Ops complexity | Choke point / runtime risk | Data sovereignty |
|---|---|---|---|---|---|---|
| **Hosted frontier** (Opus/Sonnet/Haiku, API) | highest | cents→sub-cent | low | none | provider uptime, rate limits, network | **data leaves the walls** — gated only by contract (BAA / zero-retention) |
| **Hosted cheap reasoner** (Kimi via Moonshot) | good, bounded | ~$3–15/M | low | none | one provider, one key, network | same — third-party API |
| **Local open-source** (Llama/Qwen on Edwin's PC or a box) | weaker per-size | ~free per call | med→high | **real** (serve, update, monitor) | **a single point of failure** — the box's uptime/power/thermals become the kingdom's; a laptop is not a server | **full — data never leaves**; the reason local exists |
| **Non-LLM tools** (rules, embeddings, RAG) | narrow but exact | ~free | lowest | low | the code you own | full |

The honest summary: **hosted buys capability and zero ops at the price of per-call money and letting
data leave your walls; local buys data sovereignty and no per-call money at the price of ops and a
single point of failure; tools beat both wherever the task actually fits them.**

## The hard constraints (the Regent's axes, made explicit)

- **Expense.** Cost is per-call × calls/day, not per-call. A clerk that runs 2,000×/day at even a cent
  is $20/day; at Tier 0/1 it is cents. Reserve paid reasoning for the tail; push the trunk to tools and
  small models.
- **Choke points / runtime risk.** Every brain is a dependency. Hosted = network + provider + rate
  limits. Local = your box's uptime, power, a home-PC single point of failure. **The rule: every clerk
  degrades gracefully — a primary brain and a fallback (a cheaper brain, or a Tier-0 tool, or park the
  case for a human).** Swing four already does this: the brain call falls back to the heuristic when
  Moonshot is unreachable, and the clerk keeps moving. That pattern is mandatory, not optional.
- **Data gate / privacy — the constraint that can override cost.** Real client data (tenant PII,
  owner financials) must not leave the walls to a third-party API unless a contract allows it (a BAA /
  zero-retention terms). **On the War Game's simulated data (today) any brain is fine — no gate.** When
  the real-data gate opens (the Regent's deliberate call, per `KINGDOM.md`), every brain is re-judged
  against *where the data may go*: PII-touching work moves to **local / self-hosted / contractually-gated**
  engines; hosted frontier is allowed only on gated-safe, non-PII reasoning or under a signed
  arrangement. **This — not cost — is the real driver for Edwin's "run an open-source model on my PC"
  idea.**
- **Complexity.** Local infra is real, ongoing ops. Don't take it on before a driver (cost at true
  scale, or the data gate) justifies it. Start hosted-cheap + tools; add local when the numbers or the
  gate demand it — not speculatively.
- **Latency & auditability.** A clerk in a human's live flow must feel instant (favor tools + small
  models); a batch clerk can be slow. And "why did the clerk propose this?" is easier to answer for a
  tool or a logged small-model call than a frontier black box — auditability favors the lower tiers too.

## The posture, staged (today → the fleet → real data)

- **Today — simulated, ONE clerk (shipped).** Hosted-cheap (Kimi `kimi-k2.7-code-highspeed`) + a
  deterministic Tier-0 fallback. The brain is now a **named policy** (`harness/brain-doctrine.mjs`),
  not a hardcoded string — so this doc has a home in code and the next seat is a registry entry, not a
  new magic value.
- **The fleet — simulated, MANY clerks (next).** Grow the registry: each seat/task-type names its tier
  and fallback; most seats are Tier 0/1. Add **confidence-escalation** (cheap → mid on low confidence).
  Still hosted-cheap + tools; **no local yet** — there's no data driver while the world is simulated.
- **Real data — the gate opens (later, the Regent's call).** Re-judge every brain against sovereignty.
  Likely shape: tools + a **self-hosted/gated model** for anything touching PII; hosted frontier only
  where gated-safe or contractually covered. This is where a local model earns its place — deployed on
  a real always-on box (not a laptop), with a hosted fallback for when it's down, and health checks.

## The code seam

`brainFor(seat, taskType)` (`harness/brain-doctrine.mjs`) resolves a **policy** — `{ tier, model,
fallback }` — from a small registry, defaulting sanely. One place to change; the doctrine is config, not
scattered strings. Swing four's operator is the first consumer (`operate.mjs`). As the fleet grows, each
new seat is a registry line; when the gate opens, the registry is where "PII → local" is enforced.

## Ratified by the Regent (2026-07-20)

**Stage it, and nothing more yet.** Edwin's call: the local-model / sovereignty question is a decision
for **when the real-data gate actually opens**, not before — the world is simulated, so there is no
data driver, and taking on a home-PC brain's runtime risk and ops now would be premature. So the posture
above is canon: **hosted-cheap + Tier-0 tools today; re-judge every brain against sovereignty at the
gate.** No local infra is provisioned speculatively. And **no further build on the clerk-brain thread
now** — the doctrine plus the `brainFor` seam is enough until the fleet is actually built; each clerk
stays single-tier until a seat visibly needs escalation.

### Still open, deferred to the gate (revisit then, not now)

1. **Cost ceiling** — a per-clerk-action cost to tolerate at fleet scale (sets how hard we push toward
   Tier 0/tools vs. a cheap hosted call). Settle when the fleet's real volume is in view.
2. **The gate's sovereignty answer** — a **self-hosted model** or a **zero-retention / BAA hosted**
   arrangement — and **3. the runtime host** (Edwin's PC vs. a dedicated always-on box; a home PC as the
   kingdom's brain is a real single point of failure to design around). Both are the gate-day decision.
4. **Escalation appetite** — build confidence-escalation (cheap→mid on doubt) when a seat first needs
   it, not before. **Built 2026-07-22** on the one seat that visibly needed it: `mabel/identify`
   (raw tenant intake is genuinely ambiguous — Tier 2's "triage the ambiguous", almost by definition).
   The clerk asks Tier 1 (`kimi-k2.7-code-highspeed`) first; a clear complaint resolves there, no
   escalation, no extra spend. Low confidence — no valid leaf parsed, the model's own confidence
   under 0.6, or the generic `work-order` catch-all — escalates ONE hop to Tier 2
   (`kimi-k2.7-code`, the same Moonshot line's more deliberate hand, never k3) with a "reason
   carefully" prompt; the cascade folds Tier 2 → Tier 1's own uncertain pick → the Tier-0 keyword
   heuristic, whichever first hands back a usable leaf, so the seat never stalls. `brain-doctrine.mjs`
   carries the target as an optional `escalate: { tier, model }` field on that one registry line only
   — every other seat's policy and behavior is unchanged. See `harness/clerks.mjs`'s `brainIdentify` /
   `isLowConfidence` / `makeIntakeClerk`.
