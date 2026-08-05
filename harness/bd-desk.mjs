// The owner-acquisition knowledge — the bd-desk clerk's working fluid (a new
// reasoning seat for qualifying inbound owner leads). A working-fluid lead
// profile and the outreach MOVES the clerk chooses among — enough to decide
// whether to pursue an owner now, nurture the lead for a later season, or let
// it pass, so the clerk can propose the intake step with a clear posture.
//
// NOT any firm's real leads, portfolios, or acquisition policy: when the AppFolio
// data gate opens, the firm's actual owner pipeline and qualification rules
// load here as a setting and replace this — the twin of how vendors.mjs's
// roster gives way to the real vendor list. General/founding, the machine's
// working fluid. Names and labels keep the kingdom's plain-English voice.

import { randomUUID } from 'node:crypto';
import { brainOpts } from './brain-doctrine.mjs';

/** The owner-onboarding commitments this clerk grips — a new owner lead standing
 *  at the intake step, waiting to be qualified before the realm spends its time. */
export const COMMITMENTS = {
  // The founding grammar (src/domain/flows.ts) — the lead is qualified at
  // owner-onboarding's intake step.
  'owner-onboarding': { stepKey: 'intake', holder: 'pm-desk' },
  // The grand-muster library grammar (data/library/pm-setting.json) — the BDR
  // funnel is its own flow there; the qualification is its `qualify` step.
  'owner-acquisition': { stepKey: 'qualify', holder: 'pm-desk' },
};

/** A deterministic hash of a case id → a fraction in [0, 1). Working-fluid: it
 *  lets a lead's portfolio vary reproducibly (no Math.random, so a verify run is
 *  stable). The twin of vendors.mjs's caseFraction. */
function caseFraction(caseId) {
  let h = 2166136261;
  const s = String(caseId ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** The working-fluid portfolio behind a lead — roughly one to forty doors,
 *  stable per case. The real owner pipeline replaces this at the gate. */
export function doorsOf(caseId) {
  return 1 + Math.floor(caseFraction(caseId) * 40);
}

/** The outreach moves the clerk weighs — pursue the owner at once, nurture the
 *  lead for a later season, or let it pass when the fit lies outside the realm. */
export const QUALIFY_MOVES = [
  { key: 'pursue', label: 'pursue now', angle: 'a warm call within the day' },
  { key: 'nurture', label: 'nurture', angle: 'a value note, revisit in a season' },
  { key: 'decline', label: 'let it pass', angle: "a gracious no — outside the realm's fit" },
];

/** A move by its key, or null (an unknown key → the caller's deterministic
 *  fallback). */
function moveByKey(key) {
  if (!key) return null;
  return QUALIFY_MOVES.find((m) => m.key === key) ?? null;
}

async function reasonQualify(complete, model, { subject, doors, moves, coin }, { deliberate = false } = {}) {
  const menu = moves.map((m) => `- ${m.key} — ${m.label}; ${m.angle}`).join('\n');
  const frame = `An inbound owner lead to qualify. The portfolio behind it is about ${doors} door${doors === 1 ? '' : 's'}.`;
  const system = deliberate
    ? 'You are a SENIOR property-management owner-acquisition (BDR) clerk. A junior clerk\'s first ' +
      'read on this owner lead came back uncertain, so it has been handed up to you — reason ' +
      'carefully, this lead is genuinely ambiguous. Weigh the portfolio, the likely fit, and the ' +
      "regent's time before choosing; do not default to the safe nurture move unless nothing " +
      'else truly fits. Reply with ONLY a JSON object: {"move":"<exact key from the menu>",' +
      '"confidence":<0-1>,"why":"<one short clause>"}. Confidence is your own honest certainty that ' +
      "this is the single best move — don't inflate it."
    : 'You are a property-management owner-acquisition (BDR) clerk. Given an inbound owner lead ' +
      'and the size of the portfolio behind it, choose the single best outreach posture from the ' +
      "menu — weigh the owner's likely fit, the doors they bring, and the regent's time. Reply " +
      'with ONLY a JSON object: {"move":"<exact key from the menu>","confidence":<0-1>,' +
      '"why":"<one short clause>"}. Choose the single best-fitting move, and give your own honest ' +
      "confidence (0 to 1) that it's the right call — nothing else.";
  const messages = [
    { role: 'system', content: system },
    {
      role: 'user',
      content: `${frame}\n\nMoves:\n${menu}\n\nReturn {"move":"<key>","confidence":<0-1>,"why":"<clause>"}.`,
    },
  ];
  const keys = new Set(moves.map((m) => m.key));
  try {
    const { message } = await complete({ messages, ...brainOpts(model), maxTokens: 2048 });
    const text = message.content ?? '';
    let moveKey = text.match(/"move"\s*:\s*"([^"]+)"/)?.[1]?.trim();
    if (!moveKey || !keys.has(moveKey)) moveKey = [...keys].find((k) => text.includes(k)) ?? null;
    const confidence = Number(text.match(/"confidence"\s*:\s*([\d.]+)/)?.[1]);
    const why = (text.match(/"why"\s*:\s*"([^"]+)"/)?.[1] ?? '').replace(/[{}]/g, '').trim();
    return { moveKey, confidence: Number.isFinite(confidence) ? confidence : null, why };
  } catch (err) {
    console.warn(`  owner-acquisition brain call failed (${err.message}); falling back${deliberate ? ' further' : ' to the rule'}.`);
  }
  return null;
}

/** The safe DEFAULT move — nurture the lead. It spends little of the regent's
 *  day, decides nothing final, and doubles as the Tier-0 fallback so the seat
 *  never stalls. */
function defaultQualifyKey() {
  return 'nurture';
}

/** LOW confidence — the trigger for the owner-acquisition clerk's Tier-2
 *  escalation (or, past escalation, for falling further down the cascade): no
 *  valid move parsed at all, OR the model's own confidence undercuts 0.6, OR it
 *  landed on the safe nurture default. */
function isQualifyLowConfidence(result) {
  if (!result || !result.moveKey) return true;
  if (result.confidence == null || result.confidence < 0.6) return true;
  if (result.moveKey === defaultQualifyKey()) return true;
  return false;
}

/** The bd-desk reasoning owner-acquisition clerk: find live cascades standing at
 *  the owner-onboarding intake step, read the lead and its working-fluid
 *  portfolio, and reason an outreach posture — deepened with CONFIDENCE-
 *  ESCALATION, the same shape as the other reasoning clerks: Tier 1 (the seat's
 *  base brain) reads the lead first; a clear case resolves right there. An
 *  uncertain one (no valid move parsed, confidence under 0.6, or the safe
 *  nurture default) escalates ONE time to Tier 2 with a "reason carefully"
 *  prompt. The cascade never stalls: Tier 2 → Tier 1's own (still-uncertain)
 *  answer → the Tier-0 default move, whichever first hands back a usable move —
 *  then propose, showing the Regent the lead, the doors, and the posture. */
export function makeBdrClerk(ctx) {
  const seat = 'bd-desk';
  const taskType = 'qualify';
  const policy = ctx.brainFor(seat, taskType);
  return {
    seat,
    taskType,
    policy,
    label: `the ${seat} owner-acquisition clerk`,
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
        const moves = QUALIFY_MOVES;
        // The working-fluid portfolio behind the lead — what the clerk weighs for fit.
        const doors = doorsOf(r.caseId);

        // Tier 1 first (the seat's base brain, unchanged). A clear case stops
        // right here — no escalation, no extra call, no extra spend.
        let resolved = null; // { moveKey, why } once a brain tier lands one
        let how = 'default';
        if (policy.tier > 0) {
          const t1 = await reasonQualify(ctx.complete, policy, {
            subject: r.subject,
            doors,
            moves,
            coin,
          });
          if (!isQualifyLowConfidence(t1)) {
            resolved = t1;
            how = 'brain t1';
          } else if (policy.escalate) {
            // Ambiguous — hand it up to Tier 2, the deliberate hand. Take its
            // answer if it parses a valid move; if the escalation call itself
            // comes back empty, fall to Tier 1's own (still-uncertain) pick
            // rather than skip straight to the default — the cascade folds one
            // rail at a time.
            const t2 = await reasonQualify(
              ctx.complete,
              policy.escalate,
              { subject: r.subject, doors, moves, coin },
              { deliberate: true },
            );
            if (t2?.moveKey) {
              resolved = t2;
              how = 'brain t2 ↑escalated';
            } else if (t1?.moveKey) {
              resolved = t1;
              how = 'brain t1';
            }
          } else if (t1?.moveKey) {
            // No escalation target on this policy — take Tier 1's uncertain pick
            // over the default; it still beat parsing nothing at all.
            resolved = t1;
            how = 'brain t1';
          }
        }

        // Tier-0 fallback: the sensible default so the seat never stalls — nurture
        // the lead and let a later season tell more.
        const move = moveByKey(resolved?.moveKey) ?? moveByKey(defaultQualifyKey());
        const because = resolved?.why ? ` (${resolved.why})` : '';
        const note = `Qualify the owner lead (${doors} doors) — ${move.label}; ${move.angle}.${because}`;

        const proposal = core.proposeStep(r.template, r.caseId, r.next.index - 1, `agent:${seat}`, { at, id, note });
        if (!proposal) continue;
        events.push(proposal);
        taken.add(r.caseId);
        records.push(`${r.template.title} "${r.subject}" -> ${move.label} (${doors} doors) [${how}].`);
      }
      return { events, records };
    },
  };
}
