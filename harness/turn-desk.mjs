// The turn-desk knowledge + the reasoning turnover clerk — the fourth reasoning
// seat, following the va-desk vendor clerk, the lp-queue price clerk, and the
// osric leasing clerk. Where those seats price a vendor, a settlement, or a
// rent, this seat SCOPES a make-ready: how much work a vacated door needs
// before it is rent-ready again. A working-fluid move menu of turn scopes
// (cosmetic → full renovation, each with a rough cost and day-count) that the
// clerk chooses among at the door's turn-scope commitment, then proposes for
// the Regent to ratify — the same PROPOSE-ONLY discipline as every clerk
// (KINGDOM.md: no clerk self-approves).
//
// NOT any firm's real make-ready costs or day-counts: when the AppFolio data gate
// opens, the firm's actual turn cost book loads here as a setting and replaces
// this, the twin of how vendors.mjs's roster and leasing.mjs's market rent give
// way to real data. General/founding, the machine's working fluid. Names and
// labels keep the kingdom's plain-English voice.

import { randomUUID } from 'node:crypto';
import { brainOpts } from './brain-doctrine.mjs';
import { turnoverEvidence } from './safe-evidence.mjs';

/** dollars → cents, the turn-desk convention (the economy speaks cents). */
const d = (dollars) => Math.round(dollars * 100);

/** The scope moves the clerk weighs on a vacated door — how deep the make-ready
 *  runs before the door is rent-ready. Working-fluid cost/day figures, NOT
 *  a firm's numbers: a placeholder cost book the real one replaces at the gate. */
export const SCOPE_MOVES = [
  { key: 'cosmetic', label: 'a cosmetic refresh', costCents: d(450), days: 3 },
  { key: 'standard', label: 'a standard turn', costCents: d(1400), days: 7 },
  { key: 'heavy', label: 'a heavy turn', costCents: d(3800), days: 14 },
  { key: 'full-reno', label: 'a full renovation', costCents: d(9500), days: 30 },
];

/** A scope move by its key, or null (an unknown key → the caller's
 *  deterministic fallback). The twin of leasing.mjs's moveByKey, but this seat
 *  has only the one menu (no renewal/vacancy split), so it takes the key alone. */
export function moveByKey(key) {
  if (!key) return null;
  return SCOPE_MOVES.find((m) => m.key === key) ?? null;
}

// ── The reasoning turnover clerk (turn-desk, Tier 1 → Tier 2 on doubt) ─────
// The fourth reasoning seat. Where an advance clerk (Tier 0) would just
// propose the templated step, the turnover clerk REASONS the scope at the
// door's turn-scope commitment: a light cosmetic pass, a standard turn, a
// heavy turn, or a full renovation. Scoping a make-ready off a thin
// description is genuinely ambiguous — the same shape as intake's raw
// complaints and osric's rent pricing — so this seat carries the SAME
// confidence-escalation: Tier 1 (`kimi-k2.7-code-highspeed`) scopes first with
// its own honest confidence; low confidence — no valid scope parsed,
// confidence under 0.6, or the scope landed on the safe default (a scope that
// decides little) — escalates ONE hop to Tier 2 (`kimi-k2.7-code`, the same
// Moonshot line's more deliberate hand, never k3) with a "reason carefully"
// prompt. The cascade never stalls: Tier 2 → Tier 1's own uncertain pick →
// the Tier-0 default scope, whichever first hands back a usable move. It
// STILL only proposes — the human's Approve/Override ratchet is untouched
// (no clerk self-approves, KINGDOM.md).

/** The commitments this seat grips — where a live cascade hands the door's
 *  turn-scope call to turn-desk. `move-out-relay` scopes the make-ready right
 *  after a tenant vacates; `owner-onboarding` scopes a newly-onboarded door
 *  before its first listing. Both land on va-desk's step-in-hand; the
 *  turnover clerk reasons the step's NOTE, the same shape as osric reasoning a
 *  leasing commitment held by osric itself. */
export const COMMITMENTS = {
  // The founding grammar (src/domain/flows.ts).
  'move-out-relay': { stepKey: 'turn-scope', holder: 'va-desk' },
  'owner-onboarding': { stepKey: 'make-ready', holder: 'va-desk' },
  // The grand-muster library grammar (data/library/pm-setting.json) — the
  // make-ready is its own flow there, scoped at scope-and-bid on mabel's desk.
  'make-ready-turn': { stepKey: 'scope-and-bid', holder: 'mabel' },
};

/** Ask a brain to reason a turn scope, WITH its own honest confidence (0–1) —
 *  Tier 1's bread-and-butter scoping call, and Tier 2's escalation reuses the
 *  same shape with a more deliberate system prompt. Returns `{ scopeKey,
 *  confidence, why }` (`scopeKey`/`confidence` may be `null` when the reply
 *  doesn't parse) on a completed call, or `null` outright on a hard failure
 *  (network down, the call throws) — the caller's cascade absorbs both the
 *  same way. The scope is constrained to the menu keys, exactly as the
 *  leasing clerk constrains the move to its menu — the brain judges WHICH
 *  scope, the harness owns the cost/day arithmetic. `deliberate` swaps in the
 *  Tier-2 system prompt ("reason carefully, this turn is ambiguous") for the
 *  escalation call. */
async function reasonScope(complete, model, { evidence, moves, coin }, { deliberate = false } = {}) {
  const menu = moves.map((m) => `- ${m.key} — ${m.label} (about ${coin(m.costCents)}, ~${m.days}d)`).join('\n');
  const system = deliberate
    ? 'You are the turn-desk, a SENIOR property make-ready coordinator. A junior clerk\'s first read on ' +
      'this scope call came back uncertain, so it has been handed up to you — reason carefully, this ' +
      'turn is genuinely ambiguous. Weigh the controlled condition token before choosing; do ' +
      'not default to the safe middling scope unless nothing else truly fits. Reply with ONLY a JSON ' +
      'object: {"scope":"<exact key from the menu>","confidence":<0-1>,"why":"<one short clause>"}. ' +
      "Confidence is your own honest certainty that this is the single best scope — don't inflate it."
    : 'You are the turn-desk, a property make-ready coordinator. Given a vacated door, choose the single ' +
      'best turn scope from the menu — how much work it needs before it is rent-ready again. Reply with ' +
      'ONLY a JSON object: {"scope":"<exact key from the menu>","confidence":<0-1>,"why":"<one short ' +
      'clause>"}. Choose the single best-fitting scope, and give your own honest confidence (0 to 1) ' +
      "that it's the right call — nothing else.";
  const messages = [
    { role: 'system', content: system },
    {
      role: 'user',
      content: `A make-ready scope to choose.\nOperational evidence:\n- ${evidence.join('\n- ')}\n\nScopes:\n${menu}\n\nReturn {"scope":"<key>","confidence":<0-1>,"why":"<clause>"}.`,
    },
  ];
  const keys = new Set(moves.map((m) => m.key));
  try {
    const { message } = await complete({ messages, ...brainOpts(model), maxTokens: 2048 });
    const text = message.content ?? '';
    let scopeKey = text.match(/"scope"\s*:\s*"([^"]+)"/)?.[1]?.trim();
    if (!scopeKey || !keys.has(scopeKey)) scopeKey = [...keys].find((k) => text.includes(k)) ?? null;
    const confidence = Number(text.match(/"confidence"\s*:\s*([\d.]+)/)?.[1]);
    const why = (text.match(/"why"\s*:\s*"([^"]+)"/)?.[1] ?? '').replace(/[{}]/g, '').trim();
    return { scopeKey, confidence: Number.isFinite(confidence) ? confidence : null, why };
  } catch (err) {
    console.warn(`  turn-desk brain call failed (${err.message}); falling back${deliberate ? ' further' : ' to the rule'}.`);
  }
  return null;
}

/** The safe DEFAULT scope — the one that decides little (a standard turn:
 *  neither the light-touch cosmetic pass nor the deep heavy/full-reno work).
 *  The turnover equivalent of osric's default move, and the Tier-0 fallback so
 *  the seat never stalls. */
export function defaultScopeKey() {
  return 'standard';
}

/** LOW confidence — the trigger for the turnover clerk's Tier-2 escalation
 *  (or, past escalation, for falling further down the cascade): no valid
 *  scope parsed at all, OR the model's own confidence undercuts 0.6, OR it
 *  landed on the safe default scope. */
export function isScopeLowConfidence(result) {
  if (!result || !result.scopeKey) return true;
  if (result.confidence == null || result.confidence < 0.6) return true;
  if (result.scopeKey === defaultScopeKey()) return true;
  return false;
}

/** The turn-desk reasoning turnover clerk: find live cascades standing at a
 *  turn-scope commitment (`turn-scope` in the move-out relay, `make-ready` in
 *  owner onboarding) on va-desk's step-in-hand, reason a scope move —
 *  deepened with CONFIDENCE-ESCALATION, the same shape as osric/mabel: Tier 1
 *  (`kimi-k2.7-code-highspeed`) reads the door first; a clear case resolves
 *  right there. An uncertain one (no valid scope parsed, confidence under
 *  0.6, or the safe default scope) escalates ONE time to Tier 2
 *  (`kimi-k2.7-code`, the same Moonshot line's more deliberate hand — never
 *  k3) with a "reason carefully" prompt. The cascade never stalls: Tier 2 →
 *  Tier 1's own (still-uncertain) answer → the Tier-0 default scope,
 *  whichever first hands back a usable move — then propose, showing the
 *  Regent the scope, its rough cost, and its rough days to rent-ready. */
export function makeTurnoverClerk(ctx) {
  const seat = 'turn-desk';
  const policy = ctx.brainFor(seat, 'scope');
  return {
    seat,
    taskType: 'scope',
    policy,
    label: `the ${seat} make-ready clerk`,
    async run({ doc, now, taken, cap = 5 }) {
      const core = ctx.core;
      const events = [];
      const records = [];
      const acted = new Set(['proposed', 'approved', 'overridden', 'done']);
      const coin = core.coinCents;

      const targets = core
        .readFlows(doc.flows, doc.events, now)
        .filter((r) => {
          const commit = COMMITMENTS[r.template.key];
          return (
            commit &&
            r.status !== 'done' &&
            r.next &&
            r.next.step.holder === commit.holder &&
            r.next.step.key === commit.stepKey &&
            !acted.has(r.next.kind) &&
            !taken.has(r.caseId)
          );
        })
        .sort((a, b) => (a.openedAt ?? '').localeCompare(b.openedAt ?? '')); // oldest first

      for (let i = 0; i < cap && i < targets.length; i++) {
        const r = targets[i];
        const at = now;
        const id = () => randomUUID();
        const params = core.paramsOf(doc.events, r.caseId) ?? {};
        const evidence = turnoverEvidence(r.subject, params);

        // Tier 1 first (the seat's base brain, unchanged). A clear case stops
        // right here — no escalation, no extra call, no extra spend.
        let resolved = null; // { scopeKey, why } once a brain tier lands one
        let how = 'default';
        if (policy.tier > 0) {
          const t1 = await reasonScope(ctx.complete, policy, { evidence, moves: SCOPE_MOVES, coin });
          if (!isScopeLowConfidence(t1)) {
            resolved = t1;
            how = 'brain t1';
          } else if (policy.escalate) {
            // Ambiguous — hand it up to Tier 2, the deliberate hand on the
            // same Moonshot line. Take its answer if it parses a valid scope;
            // if the escalation call itself comes back empty, fall to Tier
            // 1's own (still-uncertain) pick rather than skip straight to
            // the default — the cascade folds one rail at a time.
            const t2 = await reasonScope(
              ctx.complete,
              policy.escalate,
              { evidence, moves: SCOPE_MOVES, coin },
              { deliberate: true },
            );
            if (t2?.scopeKey) {
              resolved = t2;
              how = 'brain t2 ↑escalated';
            } else if (t1?.scopeKey) {
              resolved = t1;
              how = 'brain t1';
            }
          } else if (t1?.scopeKey) {
            // No escalation target on this policy — take Tier 1's uncertain
            // pick over the default; it still beat parsing nothing at all.
            resolved = t1;
            how = 'brain t1';
          }
        }

        // Tier-0 fallback: the sensible default so the seat never stalls — a
        // standard turn, neither the light cosmetic pass nor the deep work.
        const move = moveByKey(resolved?.scopeKey) ?? moveByKey(defaultScopeKey());

        const because = resolved?.why ? ` (${resolved.why})` : '';
        const note = `Scope the make-ready as ${move.label} — about ${coin(move.costCents)}, ~${move.days}d to rent-ready.${because}`;

        const proposal = core.proposeStep(r.template, r.caseId, r.next.index - 1, 'agent:turn-desk', { at, id, note });
        if (!proposal) continue;
        events.push(proposal);
        taken.add(r.caseId);
        records.push(
          `${r.template.title} "${r.subject}" → ${move.label} (${coin(move.costCents)}, ${move.days}d) [${how}].`,
        );
      }
      return { events, records };
    },
  };
}
