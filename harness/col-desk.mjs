// The collections knowledge — the col-desk clerk's working fluid (ASSESS-LATE,
// another reasoning seat of the fleet, a sibling of the res-desk comms clerk
// and the osric leasing clerk). The LADDER POSTURES the clerk weighs when a
// delinquent tenant's case lands on the collections-ladder flow's assess-late
// step — a soft touch with a payment plan offered first, the standard ladder
// of notices on the clock, or a firm stance straight to pay-or-quit — each
// matched to how far behind the tenant stands.
//
// NOT any firm's real delinquency ledger, grace-period policy, or notice templates:
// when the AppFolio data gate opens, the firm's actual arrears balances and
// collections policy load here as a setting and replace this — the twin of
// how leasing.mjs's rent baseline gives way to the real rent roll. General/
// founding, the machine's working fluid (a sibling of the vendor roster and
// economy's sampleLedger). Names and labels keep the kingdom's plain-English
// voice.

import { randomUUID } from 'node:crypto';
import { brainOpts } from './brain-doctrine.mjs';

/** A deterministic hash of a case id → a fraction in [0, 1). Working-fluid: it
 *  lets a delinquency's depth vary reproducibly (no Math.random, so a verify
 *  run is stable). The twin of leasing.mjs's caseFraction. */
function caseFraction(caseId) {
  let h = 2166136261;
  const s = String(caseId ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** How many months behind this delinquency stands, 1..4 — a working-fluid
 *  depth handed to the brain alongside the subject, so the same case always
 *  reads the same way. The brain still chooses the posture. */
function monthsBehind(caseId) {
  return 1 + Math.floor(caseFraction(caseId) * 4);
}

/** The ladder postures the clerk weighs on a delinquency — offer a payment
 *  plan first, run the standard ladder of notices on the clock, or press
 *  straight to pay-or-quit. The bands straddle the standard ladder on purpose,
 *  so a posture that fits everything really fits nothing, and doubles as the
 *  Tier-0 fallback. */
export const LADDER_MOVES = [
  { key: 'soft', label: 'a soft touch — a payment plan offered first' },
  { key: 'standard', label: 'the standard ladder — notices on the clock' },
  { key: 'firm', label: 'a firm stance — straight to pay-or-quit' },
];

/** A posture by its key, or null (an unknown key → the caller's deterministic
 *  fallback). */
export function postureByKey(key) {
  if (!key) return null;
  return LADDER_MOVES.find((m) => m.key === key) ?? null;
}

/** The commitments this clerk grips: flow template key → the step it reasons
 *  on. The grand-muster library's collections-ladder flow at its assess-late
 *  step — a delinquent tenant's case waiting to be weighed on the lp-queue
 *  desk. */
export const COMMITMENTS = {
  // The grand-muster library grammar (data/library/pm-setting.json).
  'collections-ladder': { stepKey: 'assess-late', holder: 'lp-queue' },
};

async function reasonPosture(complete, model, { subject, monthsBehind: behind, moves }, { deliberate = false } = {}) {
  const menu = moves.map((m) => `- ${m.key} — ${m.label}`).join('\n');
  const system = deliberate
    ? 'You are a SENIOR property collections clerk at a property-management firm. A junior ' +
      "clerk's first read on this delinquency came back uncertain, so it has been handed up " +
      'to you — reason carefully, this case is genuinely ambiguous. Weigh how far behind the ' +
      "tenant stands, their standing with the firm, and the firm's duty to both the owner and " +
      'the resident before choosing; do not default to the safe standard ladder unless nothing ' +
      'else truly fits. Reply with ONLY a JSON object: {"posture":"<exact key from the menu>",' +
      '"confidence":<0-1>,"why":"<one short clause>"}. Confidence is your own honest certainty ' +
      "that this is the single best posture — don't inflate it."
    : 'You are a property collections clerk at a property-management firm. Given a delinquent ' +
      "tenant's case, choose the single best collections posture from the menu — weigh how far " +
      "behind the tenant stands against keeping a good resident and the firm's duty. Reply with " +
      'ONLY a JSON object: {"posture":"<exact key from the menu>","confidence":<0-1>,"why":' +
      '"<one short clause>"}. Choose the single best-fitting posture, and give your own honest ' +
      "confidence (0 to 1) that it's the right call — nothing else.";
  const messages = [
    { role: 'system', content: system },
    {
      role: 'user',
      content: `A delinquency to assess.\nMonths behind: ${behind}\n\nPostures:\n${menu}\n\nReturn {"posture":"<key>","confidence":<0-1>,"why":"<clause>"}.`,
    },
  ];
  const keys = new Set(moves.map((m) => m.key));
  try {
    const { message } = await complete({ messages, ...brainOpts(model), maxTokens: 2048 });
    const text = message.content ?? '';
    let postureKey = text.match(/"posture"\s*:\s*"([^"]+)"/)?.[1]?.trim();
    if (!postureKey || !keys.has(postureKey)) postureKey = [...keys].find((k) => text.includes(k)) ?? null;
    const confidence = Number(text.match(/"confidence"\s*:\s*([\d.]+)/)?.[1]);
    const why = (text.match(/"why"\s*:\s*"([^"]+)"/)?.[1] ?? '').replace(/[{}]/g, '').trim();
    return { postureKey, confidence: Number.isFinite(confidence) ? confidence : null, why };
  } catch (err) {
    console.warn(`  collections brain call failed (${err.message}); falling back${deliberate ? ' further' : ' to the rule'}.`);
  }
  return null;
}

/** The safe DEFAULT posture — the one that decides nothing (run the standard
 *  ladder of notices on the clock). The collections equivalent of the leasing
 *  clerk's no-judgment move: a posture that fits everything really fits
 *  nothing, and doubles as the Tier-0 fallback so the seat never stalls. */
function defaultPostureKey() {
  return 'standard';
}

/** LOW confidence — the trigger for the collections clerk's Tier-2 escalation
 *  (or, past escalation, for falling further down the cascade): no valid
 *  posture parsed at all, OR the model's own confidence undercuts 0.6, OR it
 *  landed on the safe default posture. */
function isAssessLowConfidence(result) {
  if (!result || !result.postureKey) return true;
  if (result.confidence == null || result.confidence < 0.6) return true;
  if (result.postureKey === defaultPostureKey()) return true;
  return false;
}

/** The col-desk reasoning collections clerk: find live cascades standing at
 *  the collections-ladder flow's assess-late step, reason how hard to run the
 *  ladder — deepened with CONFIDENCE-ESCALATION, the same shape as the leasing
 *  clerk: Tier 1 (the seat's base brain) reads the case first; a clear case
 *  resolves right there. An uncertain one (no valid posture parsed, confidence
 *  under 0.6, or the safe standard ladder) escalates ONE time to Tier 2 (the
 *  more deliberate hand on the same line — never the next line) with a "reason
 *  carefully" prompt. The cascade never stalls: Tier 2 → Tier 1's own
 *  (still-uncertain) answer → the Tier-0 default posture, whichever first
 *  hands back a usable posture — then propose, showing the Regent the posture
 *  and how far behind the tenant stands. This seat posts NO money — read/prep
 *  only; the clerk fabricates no arrears figure and coins no fee, it proposes
 *  the collections posture for the Regent. */
export function makeCollectionsClerk(ctx) {
  const seat = 'col-desk';
  const policy = ctx.brainFor(seat, 'assess');
  return {
    seat,
    taskType: 'assess',
    policy,
    label: `the ${seat} collections clerk`,
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
        const moves = LADDER_MOVES;
        // The delinquency as the brain should see it: the subject plus the
        // working-fluid depth of the arrears (per case, stable).
        const behind = monthsBehind(r.caseId);
        const subject = r.subject;

        // Tier 1 first (the seat's base brain, unchanged). A clear case stops
        // right here — no escalation, no extra call, no extra spend.
        let resolved = null; // { postureKey, why } once a brain tier lands one
        let how = 'default';
        if (policy.tier > 0) {
          const t1 = await reasonPosture(ctx.complete, policy, { subject, monthsBehind: behind, moves });
          if (!isAssessLowConfidence(t1)) {
            resolved = t1;
            how = 'brain t1';
          } else if (policy.escalate) {
            // Ambiguous — hand it up to Tier 2, the deliberate hand on the same
            // line. Take its answer if it parses a valid posture; if the
            // escalation call itself comes back empty, fall to Tier 1's own
            // (still-uncertain) pick rather than skip straight to the default —
            // the cascade folds one rail at a time.
            const t2 = await reasonPosture(
              ctx.complete,
              policy.escalate,
              { subject, monthsBehind: behind, moves },
              { deliberate: true },
            );
            if (t2?.postureKey) {
              resolved = t2;
              how = 'brain t2 ↑escalated';
            } else if (t1?.postureKey) {
              resolved = t1;
              how = 'brain t1';
            }
          } else if (t1?.postureKey) {
            // No escalation target on this policy — take Tier 1's uncertain pick
            // over the default; it still beat parsing nothing at all.
            resolved = t1;
            how = 'brain t1';
          }
        }

        // Tier-0 fallback: the sensible default so the seat never stalls — run
        // the standard ladder of notices on the clock.
        const move = postureByKey(resolved?.postureKey) ?? postureByKey(defaultPostureKey());
        const because = resolved?.why ? ` (${resolved.why})` : '';
        const note = `Run the ladder ${move.label} — ${behind} month(s) behind.${because}`;

        const proposal = core.proposeStep(r.template, r.caseId, r.next.index - 1, `agent:${seat}`, { at, id, note });
        if (!proposal) continue;
        events.push(proposal);
        taken.add(r.caseId);
        records.push(`${r.template.title} "${r.subject}" -> ${move.label} (${behind}mo behind) [${how}].`);
      }
      return { events, records };
    },
  };
}
