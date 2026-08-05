// The resident-communications knowledge — the res-desk clerk's working fluid
// (WRIT-TASK-LANGUAGE, another reasoning seat of the fleet, a sibling of the
// osric leasing clerk). The RESPONSE POSTURES the clerk weighs when an inbound
// resident/HOA notice lands on the violation-notice flow's classify step —
// a routine cure, a priority cure, or an escalation up the ladder — each with
// the tenant-facing tone the desk should draft in.
//
// NOT any firm's real notice history, violation codes, or letter templates: when the
// AppFolio data gate opens, the firm's actual violation ledger + correspondence
// policy load here as a setting and replace this — the twin of how leasing.mjs's
// rent baseline gives way to the real rent roll. General/founding, the machine's
// working fluid (a sibling of the vendor roster and economy's sampleLedger).
// Names and labels keep the kingdom's plain-English voice.

import { randomUUID } from 'node:crypto';
import { brainOpts } from './brain-doctrine.mjs';
import { residentEvidence } from './safe-evidence.mjs';

/** A deterministic hash of a case id → a fraction in [0, 1). Working-fluid: it
 *  lets an inbound notice's severity vary reproducibly (no Math.random, so a
 *  verify run is stable). The twin of leasing.mjs's caseFraction. */
function caseFraction(caseId) {
  let h = 2166136261;
  const s = String(caseId ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** The desk's stable first read of a notice's severity, in plain words — a
 *  working-fluid framing handed to the brain alongside the subject, so the same
 *  notice always reads the same way. The brain still chooses the posture. */
function severityFrame(caseId) {
  const f = caseFraction(caseId);
  if (f < 0.34) return 'the desk\'s first read marks it a mild matter';
  if (f < 0.67) return 'the desk\'s first read marks it a pressing matter';
  return 'the desk\'s first read marks it a grave matter';
}

/** The response postures the clerk weighs on an inbound notice — answer it as a
 *  routine matter, press it as a priority, or hand it up the ladder. `tone` is
 *  the tenant-facing voice the desk should draft in. The bands straddle a
 *  routine answer on purpose, so a posture that fits everything really fits
 *  nothing, and doubles as the Tier-0 fallback. */
export const RESPONSE_MOVES = [
  { key: 'routine', label: 'a routine cure', tone: 'a courteous reminder' },
  { key: 'priority', label: 'a priority cure', tone: 'a firm, dated demand' },
  { key: 'escalate', label: 'escalate up the ladder', tone: 'a formal notice, counsel copied' },
];

/** A posture by its key, or null (an unknown key → the caller's deterministic
 *  fallback). */
export function postureByKey(key) {
  if (!key) return null;
  return RESPONSE_MOVES.find((m) => m.key === key) ?? null;
}

/** The commitments this clerk grips: flow template key → the step it reasons
 *  on. The violation-notice flow's classify step — an inbound resident/HOA
 *  notice waiting to be triaged. */
export const COMMITMENTS = {
  // The founding grammar (src/domain/flows.ts).
  'violation-notice': { stepKey: 'classify', holder: 'va-desk' },
  // The grand-muster library grammar (data/library/pm-setting.json) — an inbound
  // resident request is triaged/classified on mabel's intake desk there.
  'service-request-triage': { stepKey: 'classify', holder: 'mabel' },
};

async function reasonTriage(complete, model, { evidence, severity, moves }, { deliberate = false } = {}) {
  const menu = moves.map((m) => `- ${m.key} — ${m.label}`).join('\n');
  const system = deliberate
    ? 'You are a SENIOR resident-communications clerk at a property-management firm. A junior ' +
      "clerk's first read on this inbound notice came back uncertain, so it has been handed up " +
      'to you — reason carefully, this notice is genuinely ambiguous. Weigh the de-identified ' +
      'category/symptom, severity, and the firm\'s duty before choosing; do not default ' +
      'to the safe routine answer unless nothing else truly fits. Reply with ONLY a JSON object: ' +
      '{"posture":"<exact key from the menu>","confidence":<0-1>,"why":"<one short clause>"}. ' +
      "Confidence is your own honest certainty that this is the single best posture — don't " +
      'inflate it.'
    : 'You are a resident-communications clerk at a property-management firm. Given an inbound ' +
      'resident/HOA notice, choose the single best response posture from the menu — weigh the ' +
      "notice's severity against keeping a good resident and the firm's duty. Reply with ONLY a " +
      'JSON object: {"posture":"<exact key from the menu>","confidence":<0-1>,"why":"<one short ' +
      'clause>"}. Choose the single best-fitting posture, and give your own honest confidence ' +
      "(0 to 1) that it's the right call — nothing else.";
  const messages = [
    { role: 'system', content: system },
    {
      role: 'user',
      content: `An inbound notice to triage; ${severity}.\nOperational evidence:\n- ${evidence.join('\n- ')}\n\nPostures:\n${menu}\n\nReturn {"posture":"<key>","confidence":<0-1>,"why":"<clause>"}.`,
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
    console.warn(`  resident-comms brain call failed (${err.message}); falling back${deliberate ? ' further' : ' to the rule'}.`);
  }
  return null;
}

/** The safe DEFAULT posture — the one that decides nothing (answer the notice
 *  as a routine cure). The resident-comms equivalent of the leasing clerk's
 *  no-judgment move: a posture that fits everything really fits nothing, and
 *  doubles as the Tier-0 fallback so the seat never stalls. */
function defaultPostureKey() {
  return 'routine';
}

/** LOW confidence — the trigger for the resident-comms clerk's Tier-2 escalation
 *  (or, past escalation, for falling further down the cascade): no valid posture
 *  parsed at all, OR the model's own confidence undercuts 0.6, OR it landed on
 *  the safe default posture. */
function isTriageLowConfidence(result) {
  if (!result || !result.postureKey) return true;
  if (result.confidence == null || result.confidence < 0.6) return true;
  if (result.postureKey === defaultPostureKey()) return true;
  return false;
}

/** The res-desk reasoning resident-comms clerk: find live cascades standing at
 *  the violation-notice flow's classify step, reason a response posture —
 *  deepened with CONFIDENCE-ESCALATION, the same shape as the leasing clerk:
 *  Tier 1 (the seat's base brain) reads the notice first; a clear case resolves
 *  right there. An uncertain one (no valid posture parsed, confidence under 0.6,
 *  or the safe routine posture) escalates ONE time to Tier 2 (the more
 *  deliberate hand on the same line — never the next line) with a "reason
 *  carefully" prompt. The cascade never stalls: Tier 2 → Tier 1's own
 *  (still-uncertain) answer → the Tier-0 default posture, whichever first hands
 *  back a usable posture — then propose, showing the Regent the posture and
 *  the tenant-facing tone to draft in. This seat coins no fee: the notice
 *  carries no money figure, and the clerk fabricates none. */
export function makeResidentClerk(ctx) {
  const seat = 'res-desk';
  const policy = ctx.brainFor(seat, 'triage');
  return {
    seat,
    taskType: 'triage',
    policy,
    label: `the ${seat} resident-comms clerk`,
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
        const moves = RESPONSE_MOVES;
        // Minimum necessary context: the operational severity, without the
        // case label that carries a resident and a door.
        const severity = severityFrame(r.caseId);
        const params = core.paramsOf(doc.events, r.caseId) ?? {};
        const evidence = residentEvidence(r.subject, params);

        // Tier 1 first (the seat's base brain, unchanged). A clear case stops
        // right here — no escalation, no extra call, no extra spend.
        let resolved = null; // { postureKey, why } once a brain tier lands one
        let how = 'default';
        if (policy.tier > 0) {
          const t1 = await reasonTriage(ctx.complete, policy, { evidence, severity, moves });
          if (!isTriageLowConfidence(t1)) {
            resolved = t1;
            how = 'brain t1';
          } else if (policy.escalate) {
            // Ambiguous — hand it up to Tier 2, the deliberate hand on the same
            // line. Take its answer if it parses a valid posture; if the
            // escalation call itself comes back empty, fall to Tier 1's own
            // (still-uncertain) pick rather than skip straight to the default —
            // the cascade folds one rail at a time.
            const t2 = await reasonTriage(
              ctx.complete,
              policy.escalate,
              { evidence, severity, moves },
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

        // Tier-0 fallback: the sensible default so the seat never stalls —
        // answer the notice as a routine cure.
        const move = postureByKey(resolved?.postureKey) ?? postureByKey(defaultPostureKey());
        const because = resolved?.why ? ` (${resolved.why})` : '';
        const note = `Triage the notice as ${move.label} — draft ${move.tone}.${because}`;

        const proposal = core.proposeStep(r.template, r.caseId, r.next.index - 1, `agent:${seat}`, { at, id, note });
        if (!proposal) continue;
        events.push(proposal);
        taken.add(r.caseId);
        records.push(`${r.template.title} "${r.subject}" -> ${move.label} [${how}].`);
      }
      return { events, records };
    },
  };
}
