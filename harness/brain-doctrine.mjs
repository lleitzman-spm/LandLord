// The clerk-brain doctrine, in code — which engine powers which clerk, as a
// NAMED POLICY rather than a hardcoded model string. The runtime sibling of
// docs/MODEL-DOCTRINE.md; the whole reasoning lives in docs/CLERK-BRAIN-DOCTRINE.md.
//
// The rule (see the doc): the cheapest thing that clears the bar, a fallback for
// every clerk, and the data gate deciding where the brain may live. Today the
// world is simulated (no data gate), so hosted-cheap is fine everywhere.
//
// Tiers:
//   0 · tool     — deterministic: rules, embeddings, lookup. No model, no cost,
//                  fully private. A clerk's fallback when its brain can't answer.
//   1 · cheap    — a small hosted/local model for bounded classify/extract/route.
//   2 · mid      — Sonnet-class, for drafting with judgment.
//   3 · frontier — Opus/Fable, for the ambiguous/high-stakes tail only.
export const TIER = { TOOL: 0, CHEAP: 1, MID: 2, FRONTIER: 3 };

// The registry: a seat's task-shape → its policy. Grows one line per seat as the
// fleet grows; when the real-data gate opens, this is where "PII → a local/gated
// model" gets enforced (a policy may then name a local engine + require it).
//
//   effort   — reasoning effort for THIS seat's call. The cheapest thing that
//              clears the seat's bar, per the doctrine's own logic: a seat
//              choosing from a fixed menu does not need to deliberate, while a
//              genuinely ambiguous judgment does. Escalation targets carry
//              their own, higher, effort — that IS the escalation.
//   tier     — the doctrine tier (for the record / future escalation)
//   model    — the hosted brain to call (a Moonshot model id today)
//   fallback — what to do if the brain is unreachable: 'tool' = the clerk's
//              deterministic Tier-0 path (never stall the seat)
const REGISTRY = {
  // Mabel's clerk identifying a raw-intake work order down to a leaf: a bounded
  // classification (Tier 1). Cheap hosted brain; deterministic keyword fallback.
  // NOT k3, NOT Fable — bounded procedural work (MODEL-DOCTRINE's cheap lane).
  // This is the FIRST seat the doctrine's deferred item #4 names outright — raw
  // intake is genuinely AMBIGUOUS (Tier 2's "triage the ambiguous"), so it also
  // carries an `escalate` target: on low confidence at Tier 1, the clerk asks the
  // SAME Moonshot line's more deliberate hand (`kimi-k2.7-code`, not the
  // -highspeed twin) to reason it again before falling back further. The pattern
  // has since been grafted onto every reasoning seat that shows the same
  // ambiguity (osric/price-lease, va-desk/assign-vendor, lp-queue/approve-pay);
  // the deterministic Tier-0 advance seats stay single-tier. `escalate` is
  // optional and `brainFor` stays backward-compatible without it.
  'mabel/identify': {
    tier: TIER.CHEAP,
    effort: 'low',
    model: 'kimi-k2.7-code-highspeed',
    fallback: 'tool',
    escalate: { tier: TIER.MID, model: 'kimi-k2.7-code', effort: 'high' },
  },

  // The va-desk REASONING vendor clerk: at the vendor-dispatch commitment it
  // chooses a sellsword and forms a price, then reads the spend gate against that
  // reasoned quote. Real judgment (which vendor, what it costs) but bounded and
  // procedural — Tier 1, the cheap hosted brain, with a Tier-0 roster fallback so
  // the seat never stalls. Choosing among a roster on a thin description is the
  // SAME shape of ambiguity as raw intake and lease pricing, so this seat ALSO
  // carries the escalate target: on low confidence at Tier 1 (no valid vendor
  // parsed off the roster, confidence under 0.6, or nothing usable at all), the
  // clerk asks the SAME Moonshot line's more deliberate hand (`kimi-k2.7-code`,
  // not the -highspeed twin) to reason it again before falling back to the
  // roster's first-of-trade.
  'va-desk/assign-vendor': {
    tier: TIER.CHEAP,
    effort: 'low',
    model: 'kimi-k2.7-code-highspeed',
    fallback: 'tool',
    escalate: { tier: TIER.MID, model: 'kimi-k2.7-code', effort: 'high' },
  },

  // The lp-queue REASONING price-approval clerk: at the settlement commitment it
  // reconciles the invoice against the authorization and recommends pay-or-hold.
  // The reconciliation ceiling is a hard rule; the brain refines the judgment on
  // a within-ceiling invoice that still looks off. Tier 1, cheap brain, Tier-0
  // rule fallback (the ceiling alone) so the seat never stalls. Judging a clean-
  // looking invoice that sits close to its ceiling is genuinely ambiguous too, so
  // this seat ALSO carries the escalate target: on low confidence at Tier 1 (no
  // pay/hold call parsed, confidence under 0.6, or a borderline invoice sitting
  // within a hair of the authorized ceiling), the clerk asks the SAME Moonshot
  // line's more deliberate hand (`kimi-k2.7-code`) to reason it again before
  // falling back to the reconciliation rule alone.
  'lp-queue/approve-pay': {
    tier: TIER.CHEAP,
    effort: 'low',
    model: 'kimi-k2.7-code-highspeed',
    fallback: 'tool',
    escalate: { tier: TIER.MID, model: 'kimi-k2.7-code', effort: 'high' },
  },

  // The osric REASONING leasing clerk: at the leasing commitment it reasons the
  // rent — a renewal's hold/raise/concession, or a vacant door's re-list ask —
  // then reads the economy's leasing/renewal fee against the reasoned rent. Real
  // judgment (keep a tenant, fill a door, the owner's return) but bounded to a
  // move menu — Tier 1, the cheap hosted brain, with a Tier-0 default-move
  // fallback so the seat never stalls. Pricing a lease against a tenant's
  // reliability and the market is genuinely ambiguous (the same shape as raw
  // intake), so this seat ALSO carries the escalate target, mirroring
  // mabel/identify: on low confidence at Tier 1, the clerk asks the SAME
  // Moonshot line's more deliberate hand (`kimi-k2.7-code`, not the -highspeed
  // twin) to reason it again before falling back further.
  'osric/price-lease': {
    tier: TIER.CHEAP,
    effort: 'low',
    model: 'kimi-k2.7-code-highspeed',
    fallback: 'tool',
    escalate: { tier: TIER.MID, model: 'kimi-k2.7-code', effort: 'high' },
  },

  // The four seats a firm's blueprint named next (the reconciliation's seat map:
  // turnover · owner-acquisition · resident-comms · accounting). Each is a
  // reasoning seat gripping an existing flow step that only an advance clerk
  // swept before — the same Tier-1 + confidence-escalation shape as the four
  // above (a clear case resolves cheap at Tier 1; an ambiguous one hands up ONE
  // hop to the deliberate `kimi-k2.7-code`, never k3), with the seat's own
  // Tier-0 default so it never stalls. Working-fluid; the real data gates (A2).

  // turn-desk: the make-ready SCOPE on a vacated door (move-out turn / onboarding
  // make-ready) — cosmetic through full renovation; genuinely ambiguous, escalates.
  'turn-desk/scope': {
    tier: TIER.CHEAP,
    effort: 'low',
    model: 'kimi-k2.7-code-highspeed',
    fallback: 'tool',
    escalate: { tier: TIER.MID, model: 'kimi-k2.7-code', effort: 'high' },
  },

  // bd-desk: qualify an inbound owner lead at onboarding intake — pursue, nurture,
  // or let it pass; the fit call is ambiguous, so it escalates.
  'bd-desk/qualify': {
    tier: TIER.CHEAP,
    effort: 'low',
    model: 'kimi-k2.7-code-highspeed',
    fallback: 'tool',
    escalate: { tier: TIER.MID, model: 'kimi-k2.7-code', effort: 'high' },
  },

  // res-desk: triage an inbound resident/HOA notice at the violation classify step
  // — routine cure, priority cure, or escalate; the severity read is ambiguous.
  'res-desk/triage': {
    tier: TIER.CHEAP,
    effort: 'low',
    model: 'kimi-k2.7-code-highspeed',
    fallback: 'tool',
    escalate: { tier: TIER.MID, model: 'kimi-k2.7-code', effort: 'high' },
  },

  // acct-desk: reconcile a move-out deposit (read/prep only, posts no coin) —
  // full refund, partial deduction, or forfeit; a within-reason call that escalates.
  'acct-desk/reconcile': {
    tier: TIER.CHEAP,
    effort: 'low',
    model: 'kimi-k2.7-code-highspeed',
    fallback: 'tool',
    escalate: { tier: TIER.MID, model: 'kimi-k2.7-code', effort: 'high' },
  },

  // Two more library-native seats (grand-muster grammar): the collections clerk
  // reasons the delinquency ladder's posture (assess-late), the violations clerk
  // grades a documented lease/HOA breach (verify). Same Tier-1 + escalation shape.

  // col-desk: how hard to run the collections ladder on a delinquent tenant.
  'col-desk/assess': {
    tier: TIER.CHEAP,
    effort: 'low',
    model: 'kimi-k2.7-code-highspeed',
    fallback: 'tool',
    escalate: { tier: TIER.MID, model: 'kimi-k2.7-code', effort: 'high' },
  },

  // viol-desk: grade a documented lease/HOA violation → the notice posture.
  'viol-desk/classify': {
    tier: TIER.CHEAP,
    effort: 'low',
    model: 'kimi-k2.7-code-highspeed',
    fallback: 'tool',
    escalate: { tier: TIER.MID, model: 'kimi-k2.7-code', effort: 'high' },
  },

  // The general ADVANCE clerks — one per seat (the fleet). Advancing the step in
  // hand to a proposal is a DETERMINISTIC move (the template says the step), so
  // it needs no brain at all: Tier 0, a tool. This is the doctrine's point —
  // most clerk work is not reasoning, and the cheapest engine that clears the
  // bar for "propose the next step" is no model.
  'va-desk/advance': { tier: TIER.TOOL, model: null, fallback: 'tool' },
  'lp-queue/advance': { tier: TIER.TOOL, model: null, fallback: 'tool' },
  'osric/advance': { tier: TIER.TOOL, model: null, fallback: 'tool' },
  'pm-desk/advance': { tier: TIER.TOOL, model: null, fallback: 'tool' },
};

// The house default for any seat/task not yet in the registry: cheap + a tool
// fallback. Deliberately conservative — a new clerk starts on the cheap tier and
// is promoted only when a seat visibly needs it.
const DEFAULT_POLICY = { tier: TIER.CHEAP, model: 'kimi-k2.7-code-highspeed', fallback: 'tool' };

/** The brain policy for a clerk. `seat` is the census id whose clerk this is
 *  (e.g. 'mabel'); `taskType` is the shape of the work ('identify'). Returns
 *  `{ tier, model, fallback }`. An operator-time MOONSHOT_MODEL override wins
 *  over the registry model (for experimentation), but never selects k3 — the
 *  doctrine keeps k3 for building, never for a runtime clerk. */
export function brainFor(seat, taskType) {
  const policy = REGISTRY[`${seat}/${taskType}`] ?? DEFAULT_POLICY;
  const override =
    process.env.MOONSHOT_MODEL && !/k3/i.test(process.env.MOONSHOT_MODEL)
      ? process.env.MOONSHOT_MODEL
      : null;
  return { ...policy, model: override ?? policy.model };
}

/** Turn a policy (or an escalate target, or a bare model string) into the
 *  options a brain call takes. Callers pass the POLICY now rather than just its
 *  model, so the seat's declared reasoning effort travels with its model — the
 *  two were always one decision and splitting them is how `high` ended up on
 *  every call in the fleet. A plain string still works, defaulting the effort. */
export function brainOpts(p) {
  if (!p) return {};
  if (typeof p === 'string') return { model: p };
  return p.effort ? { model: p.model, effort: p.effort } : { model: p.model };
}
