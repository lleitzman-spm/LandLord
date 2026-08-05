# Wielding the models — the doctrine

> **⚠ RETIRED FRAMING (Edwin, 2026-07-22): the greenfield/brownfield binary is gone.** Where this doc
> below frames K3 as "#1 GREENFIELD / weak agentic / WANDERS on brownfield" and reserves brownfield for
> Fable/Opus, treat that as **superseded**. Delegation is **vendor-blind**: pick the builder by
> task-fit, measured capability, stakes, and cost — not by tribe. **Kimi (K3) is a first-class candidate
> for substantial brownfield builds**, not a greenfield/UI sidecar (re-derived across the sibling repos;
> K3 has built state-critical brownfield code autonomously under review). The recorded observation that
> K3 wandered twice stands as a *review-hard caution*, **not** a categorical exclusion. The one durable
> carve-out is the **STAKES rule** (vendor-neutral): authorship of the highest-stakes, hardest-to-reverse
> core (state-integrity / money / auth) goes to the lowest-surprise hand under the hardest review —
> **split by stakes, not vendor**; hard shot designs get an independent Kimi-vs-Opus panel. Opus still
> drives, reviews every diff, and ships, and the review gate never lifts for any hand.
>
> **Portable:** this doc is written to drop into any repository unchanged.

*How the kingdom allocates its minds across its work. The strategic doc; read it before any build
worth delegating, and before planning a big swing. Snapshot **2026-07-20** — Fable 5 added after it
built the War Table end to end. Numbers move; re-pull from OpenRouter (Artificial Analysis + Design
Arena) to refresh. The K3-specific deep-dive — the harness, the Moonshot quirks — lives in
`docs/K3-PROFILE.md`; this doc is the whole roster and the allocation seam.*

> **Two doctrines, don't confuse them.** This doc governs the minds that **build** the kingdom at the
> session (Opus/Fable/K3/Sonnet, watched, spend-for-ROI). The minds that **run inside** the kingdom —
> the clerks, invoked per case at volume, often unattended, and one day touching real client data — are
> a separate doctrine: **`docs/CLERK-BRAIN-DOCTRINE.md`**. Reaching for a session-grade model to power a
> runtime clerk is the classic error; go there before wiring a brain into a seat.

## The one idea

**Opus DRIVES; the right hand BUILDS; Opus REVIEWS and VERIFIES before anything ships.** The session
is always Opus — it holds the constitution, the context, and the judgment. It writes the spec,
delegates the build to whichever model fits the task's *shape*, then reviews the diff for fidelity and
house-fit and drives it in a real browser before it ships. **Never trust a builder's word** — K3
wandered off-model twice; even Fable's flawless-sounding report was verified independently. The review
gate is what makes delegation safe, and it never lifts.

## The roster

| Model | Best at | Weak / watch | Out $/M | Reached via | Native? |
|---|---|---|---|---|---|
| **Opus 4.8** | Orchestration, planning, spec-writing, diff review, brownfield judgment, the hardest calls | Mid on greenfield build-arena (#22–26) — not the prettiest builder | $25 | the session, or Agent `model:"opus"` | yes |
| **Fable 5** | The strongest agentic coder (SWE-Bench Pro **80.3** vs Opus 69.2), long-horizon "works for hours," big **brownfield** builds that are aesthetics **and** wiring; strong build-arena (#2–3) | Priciest; thinking always-on (runs many minutes — background it) | **$50** | Agent `model:"fable"` | yes (honors voice/law) |
| **Kimi K3** | A first-class builder for **substantial brownfield** work as well as greenfield artifacts; cheapest of the capable hands; strong build-arena | Foreign brain (non-Claude, via the harness) — holds the constitution less automatically; wandered off-model twice, so **review it hard** (a caution, not a categorical exclusion) | $15 | the `harness/` (Moonshot) | no |
| **Sonnet 5** | The workhorse — fast, well-scoped implementation, mechanical refactors, bounded per-seat agents | Not for the hardest reasoning or the flagship look | ~mid | Agent `model:"sonnet"` | yes |
| **Haiku 4.5** | Cheap + fast: high-volume simple work, parallel fan-out, cheap operator agents | Shallow on anything tangled | low | Agent `model:"haiku"` | yes |

Intelligence / Coding / Agentic (Artificial Analysis, higher = better): Fable **59.9 / 76.5 / 52.8** ·
K3 57.1 / 76.2 / 50.1 · Opus 55.7 / 74.3 / 47.2. Fable also has full **1M** context (Opus caps 500K).
*The Claude models (Opus/Fable/Sonnet/Haiku) are all reached natively through the **Agent tool** and
the **Workflow tool** — no harness, and they honor `KINGDOM.md`/`CLAUDE.md`. Only K3 needs the harness
and is a foreign brain.*

## The allocation seam — task shape → hand

| The task's shape | Build it with | Why |
|---|---|---|
| **Flagship brownfield build** — aesthetics AND perfect wiring into the living system, long-horizon | the **best-fit capable hand** — Fable (its lead grows with complexity; Claude-native, holds the law; the War Table proved it), or **K3 for substantial brownfield** under hard review | vendor-blind: pick by task-fit + measured capability + cost, all under the review gate — not by tribe |
| **Isolated greenfield artifact** — a mockup, a standalone viz, a throwaway widget | **K3** (cheap) or Fable if it must integrate | cheapest capable hand when the output is self-contained and reviewed |
| **Highest-stakes, hardest-to-reverse core** — state-integrity / money / auth | the **lowest-surprise hand under the hardest review** (the STAKES rule); hard designs get an independent Kimi-vs-Opus panel | split by stakes, not vendor — authorship of the irreversible core goes where surprise is lowest |
| **Well-scoped mechanical build / refactor / bounded per-seat agent** | **Sonnet** (cheaper than Opus) or Opus | don't pay flagship rates for scoped work |
| **High-volume trivial / parallel fan-out** | **Haiku** | cheapest per unit; fan out wide |
| **Spec, orchestration, review, browser-verify, the hardest judgment** | **Opus** — never delegated | the driver holds the context and the law |

## The big-swing playbook

The pattern that ships flagships (the War Table, the domain rebuild):

1. **Opus writes the writ/brief** — the spec + the exact interfaces (reading signatures, act signatures)
   + the constitution + the constraints + how to verify. *This is where Opus adds the most value; the
   typing is the cheap part.*
2. **Delegate the build** to the right hand (Agent tool for the Claude models; the harness for K3).
   Background it if long; you're pinged on completion.
3. **Opus reviews** the diff for fidelity + house-fit, **drives it in a real browser**, finishes the
   last mile, and ships (commit → `main`, the herald deploys).
4. **For a truly massive swing that decomposes** — the **Workflow tool**: parallel builders on
   independent surfaces, adversarial verifiers, judge panels, loop-until-done. This is how "one
   massively productive swing" happens. It is **opt-in** (say "ultracode" or ask for a workflow) —
   it spends a lot; the user chooses that scale.

Stage the tangled, hoarded work into **ONE well-staged writ and loose it once** (the megamind law,
now generalized to every builder — not just K3).

## The review gate (never skip, whoever built it)

Every delegated build → Opus reads the whole diff for fidelity + house-fit, then **drives it in a real
browser** (or exercises the readings), then ships. The three-tier holds regardless of the hand. A
builder's word is **counsel, not command** — weigh it before it becomes law. This is the discipline
that let Fable build the War Table unsupervised and still ship clean: the gate caught nothing because
the review *confirmed* it, not because it trusted the report.

## Cost & when to spend (the current posture)

Edwin's steer (2026-07-20): *don't burn quite as hot right now — but if the production is there, buy
credits and take the swing.*

- **Default lean:** Opus drives; delegate **judiciously**. Reserve the priciest hands (Fable, and
  Workflow fan-outs) for the big, high-ROI swings — not for errands.
- **Fable ($10/$50) earns its price** when the task is big + complex + brownfield (its lead *grows*
  with complexity), or when one clean pass beats days of iteration. The War Table was a flagship shipped
  in **one ~23-minute pass + review** — cheap against the alternative.
- **K3 ($3/$15) is the cheapest capable hand** — a first-class candidate for substantial brownfield as
  well as greenfield, under hard review (it wandered twice; the review gate, not exclusion, is the guard).
  Budget a little rework-tax margin for a foreign brain, but it is no longer greenfield-only.
- **Sonnet / Haiku for the cheap tiers** — never spend Opus/Fable rates on mechanical or trivial work.
- **Prompt caching** narrows repeated-context cost; a warm session is cheaper than the sticker rate.
- **The spend test:** *would this swing ship something that would otherwise take far longer?* If yes,
  and the production is real, **spend** — buy credits and take the big swing.

## Applied — the upcoming swings, planned

Active planning is the point of this doc. As of 2026-07-20:

- **Absorb the old shell into the War Table** (UI + wiring, brownfield) → **Fable builds / Opus reviews**,
  or Opus solo if scoped tight. A natural Fable job (aesthetics + wiring).
- **Swing 4 — prove ONE operator agent** (bounded, cheap procedural work on the harness-as-operator) →
  **Sonnet or Haiku**, NOT K3/Fable. Cheap bounded labor; the flagship hands are overkill.
- **The economy pillar** (re-express the research's data model as chronicle readings, then build) →
  **Opus specs it; Fable or Opus builds.**
- **Any future massively-productive multi-surface swing** → a **Workflow** (opt-in), Fable/Sonnet
  builders under Opus verifiers.

*Keep this section current: when a swing is planned, name the hand and the why here first.*
