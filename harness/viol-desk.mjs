// The lease-violation knowledge — the viol-desk clerk's working fluid
// (a reasoning seat of the fleet, a sibling of the res-desk and leasing
// clerks). The GRADES the clerk weighs when a documented lease/HOA violation
// lands on the lease-violation flow's verify step — a minor breach, a
// standard breach, or a severe breach — each with the notice posture the
// desk should draft in: a courtesy notice, a formal cure notice with the
// days stated, or an at-once escalation with counsel on notice.
//
// NOT any firm's real violation ledger, breach codes, or notice templates: when the
// AppFolio data gate opens, the firm's actual violation history + compliance
// policy load here as a setting and replace this — the twin of how leasing.mjs's
// rent baseline gives way to the real rent roll. General/founding, the machine's
// working fluid (a sibling of the vendor roster and economy's sampleLedger).
// Names and labels keep the kingdom's plain-English voice.

import { randomUUID } from 'node:crypto';
import { brainOpts } from './brain-doctrine.mjs';
import { violationType } from './safe-evidence.mjs';

/** A deterministic hash of a case id → a fraction in [0, 1). Working-fluid: it
 *  lets a documented violation's severity vary reproducibly (no Math.random, so
 *  a verify run is stable). The twin of leasing.mjs's caseFraction. */
function caseFraction(caseId) {
  let h = 2166136261;
  const s = String(caseId ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** The desk's stable first read of a violation's gravity, in plain words — a
 *  working-fluid framing handed to the brain alongside the subject, so the same
 *  violation always reads the same way. The brain still chooses the grade. */
function severityFrame(caseId) {
  const f = caseFraction(caseId);
  if (f < 0.34) return 'the desk\'s first read marks it a slight breach';
  if (f < 0.67) return 'the desk\'s first read marks it a weighty breach';
  return 'the desk\'s first read marks it a grievous breach';
}

/** The grades the clerk weighs on a documented violation — a minor breach, a
 *  standard breach, or a severe one. `tone` is the notice posture the desk
 *  should draft in. The bands straddle a standard cure on purpose, so a grade
 *  that fits everything really fits nothing, and doubles as the Tier-0
 *  fallback. */
export const GRADE_MOVES = [
  { key: 'minor', label: 'a minor breach', tone: 'a courtesy notice' },
  { key: 'standard', label: 'a standard breach', tone: 'a formal cure notice, the days stated' },
  { key: 'severe', label: 'a severe breach', tone: 'escalate at once, counsel on notice' },
];

/** A grade by its key, or null (an unknown key → the caller's deterministic
 *  fallback). */
export function gradeByKey(key) {
  if (!key) return null;
  return GRADE_MOVES.find((m) => m.key === key) ?? null;
}

/** The commitments this clerk grips: flow template key → the step it reasons
 *  on. The grand-muster library grammar (data/library/pm-setting.json) — the
 *  lease-violation flow's verify step, a documented lease/HOA breach waiting
 *  to be graded before its notice goes out. */
export const COMMITMENTS = {
  'lease-violation': { stepKey: 'verify', holder: 'pm-desk' },
};

async function reasonGrade(complete, model, { violation, severity, moves }, { deliberate = false } = {}) {
  const menu = moves.map((m) => `- ${m.key} — ${m.label}`).join('\n');
  const system = deliberate
    ? 'You are a SENIOR compliance clerk at a property-management firm. A junior ' +
      "clerk's first read on this documented lease/HOA violation came back " +
      'uncertain, so it has been handed up to you — reason carefully, this breach ' +
      'is genuinely ambiguous. This is a documented lease/HOA violation, not a ' +
      'resident service request: weigh the breach\'s gravity, the lease terms, the ' +
      'de-identified violation type and the firm\'s duty to the community before grading; ' +
      'do not default to the safe standard grade unless nothing else truly fits. ' +
      'Reply with ONLY a JSON object: {"grade":"<exact key from the menu>",' +
      '"confidence":<0-1>,"why":"<one short clause>"}. Confidence is your own ' +
      "honest certainty that this is the single best grade — don't inflate it."
    : 'You are a compliance clerk at a property-management firm. Given a documented ' +
      'lease/HOA violation — a breach already on the record, not a resident service ' +
      'request — choose the single best grade from the menu: weigh the breach\'s ' +
      "gravity and de-identified type against the lease terms and the firm's duty " +
      'to the community. Reply with ONLY a JSON object: {"grade":"<exact key from ' +
      'the menu>","confidence":<0-1>,"why":"<one short clause>"}. Choose the single ' +
      "best-fitting grade, and give your own honest confidence (0 to 1) that it's " +
      'the right call — nothing else.';
  const messages = [
    { role: 'system', content: system },
    {
      role: 'user',
      content: `A documented lease/HOA violation to grade.\nViolation type: ${violation}\nSeverity: ${severity}.\n\nGrades:\n${menu}\n\nReturn {"grade":"<key>","confidence":<0-1>,"why":"<clause>"}.`,
    },
  ];
  const keys = new Set(moves.map((m) => m.key));
  try {
    const { message } = await complete({ messages, ...brainOpts(model), maxTokens: 2048 });
    const text = message.content ?? '';
    let gradeKey = text.match(/"grade"\s*:\s*"([^"]+)"/)?.[1]?.trim();
    if (!gradeKey || !keys.has(gradeKey)) gradeKey = [...keys].find((k) => text.includes(k)) ?? null;
    const confidence = Number(text.match(/"confidence"\s*:\s*([\d.]+)/)?.[1]);
    const why = (text.match(/"why"\s*:\s*"([^"]+)"/)?.[1] ?? '').replace(/[{}]/g, '').trim();
    return { gradeKey, confidence: Number.isFinite(confidence) ? confidence : null, why };
  } catch (err) {
    console.warn(`  violations brain call failed (${err.message}); falling back${deliberate ? ' further' : ' to the rule'}.`);
  }
  return null;
}

/** The safe DEFAULT grade — the one that decides nothing beyond the ordinary
 *  course (grade the breach standard, send the formal cure notice). The
 *  violations equivalent of the leasing clerk's no-judgment move: a grade that
 *  fits everything really fits nothing, and doubles as the Tier-0 fallback so
 *  the seat never stalls. */
function defaultGradeKey() {
  return 'standard';
}

/** LOW confidence — the trigger for the violations clerk's Tier-2 escalation
 *  (or, past escalation, for falling further down the cascade): no valid grade
 *  parsed at all, OR the model's own confidence undercuts 0.6, OR it landed on
 *  the safe default grade. */
function isGradeLowConfidence(result) {
  if (!result || !result.gradeKey) return true;
  if (result.confidence == null || result.confidence < 0.6) return true;
  if (result.gradeKey === defaultGradeKey()) return true;
  return false;
}

/** The viol-desk reasoning violations clerk: find live cascades standing at
 *  the lease-violation flow's verify step, grade the documented breach —
 *  deepened with CONFIDENCE-ESCALATION, the same shape as the leasing clerk:
 *  Tier 1 (the seat's base brain) reads the violation first; a clear case
 *  resolves right there. An uncertain one (no valid grade parsed, confidence
 *  under 0.6, or the safe standard grade) escalates ONE time to Tier 2 (the
 *  more deliberate hand on the same line — never the next line) with a
 *  "reason carefully" prompt. The cascade never stalls: Tier 2 → Tier 1's own
 *  (still-uncertain) answer → the Tier-0 default grade, whichever first hands
 *  back a usable grade — then propose, showing the Regent the grade and the
 *  notice posture to draft in. This seat coins no fee: the verify step is
 *  read/prep only, and the clerk fabricates no money figure. */
export function makeViolationClerk(ctx) {
  const seat = 'viol-desk';
  const policy = ctx.brainFor(seat, 'classify');
  return {
    seat,
    taskType: 'classify',
    policy,
    label: `the ${seat} violations clerk`,
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
        const moves = GRADE_MOVES;
        // Minimum necessary context: the operational severity, without the
        // case label that carries a resident and a door.
        const severity = severityFrame(r.caseId);
        const params = core.paramsOf(doc.events, r.caseId) ?? {};
        const violation = violationType(r.subject, params);

        // Tier 1 first (the seat's base brain, unchanged). A clear case stops
        // right here — no escalation, no extra call, no extra spend.
        let resolved = null; // { gradeKey, why } once a brain tier lands one
        let how = 'default';
        if (policy.tier > 0) {
          const t1 = await reasonGrade(ctx.complete, policy, { violation, severity, moves });
          if (!isGradeLowConfidence(t1)) {
            resolved = t1;
            how = 'brain t1';
          } else if (policy.escalate) {
            // Ambiguous — hand it up to Tier 2, the deliberate hand on the same
            // line. Take its answer if it parses a valid grade; if the
            // escalation call itself comes back empty, fall to Tier 1's own
            // (still-uncertain) pick rather than skip straight to the default —
            // the cascade folds one rail at a time.
            const t2 = await reasonGrade(
              ctx.complete,
              policy.escalate,
              { violation, severity, moves },
              { deliberate: true },
            );
            if (t2?.gradeKey) {
              resolved = t2;
              how = 'brain t2 ↑escalated';
            } else if (t1?.gradeKey) {
              resolved = t1;
              how = 'brain t1';
            }
          } else if (t1?.gradeKey) {
            // No escalation target on this policy — take Tier 1's uncertain pick
            // over the default; it still beat parsing nothing at all.
            resolved = t1;
            how = 'brain t1';
          }
        }

        // Tier-0 fallback: the sensible default so the seat never stalls —
        // grade the breach standard and send the formal cure notice.
        const move = gradeByKey(resolved?.gradeKey) ?? gradeByKey(defaultGradeKey());
        const because = resolved?.why ? ` (${resolved.why})` : '';
        const note = `Grade the breach ${move.label} — draft ${move.tone}.${because}`;

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
