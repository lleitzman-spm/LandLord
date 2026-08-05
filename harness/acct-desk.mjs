// The acct-desk reasoning clerk — the fourth reasoning seat, following the
// va-desk vendor clerk, the lp-queue price clerk, and the osric leasing clerk.
// At the move-out relay's deposit-accounting step it reasons how a security
// deposit SPLITS — refund to the tenant, deductions to the owner — and drafts
// the itemized reconciliation for alys to ratify. This seat is
// MONEY-ADJACENT but READ/PREP ONLY: it PROPOSES the reconciliation note; it
// never posts a transfer, never touches a bank or a book. The human ratifies;
// only then (elsewhere, not here) does coin move.
//
// The figures below (DEPOSIT_CENTS, damageEstimateCents) are working fluid —
// NOT any firm's real deposits, rents, or damage findings. They exist so the
// machine has something to reason against; the real numbers load at the
// data gate, the twin of how leasing.mjs's MARKET_RENT_CENTS and
// vendors.mjs's roster give way to real data. Deterministic (no Math.random)
// so a verify run is stable. Names and labels keep the kingdom's plain-
// English voice.

import { randomUUID } from 'node:crypto';
import { brainOpts } from './brain-doctrine.mjs';

/** dollars → cents, the same convention as leasing.mjs (the economy speaks
 *  cents). */
const d = (dollars) => Math.round(dollars * 100);

/** A deterministic hash of a case id → a fraction in [0, 1). Working-fluid:
 *  lets a case's deposit and damage vary reproducibly (no Math.random, so a
 *  verify run is stable). The twin of leasing.mjs's / vendors.mjs's
 *  caseFraction. */
function caseFraction(caseId) {
  let h = 2166136261;
  const s = String(caseId ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** The working-fluid baseline deposit — about one month's rent (~$1,500).
 *  NOT any firm's real deposit schedule; the real ledger replaces this at the
 *  gate. */
const DEPOSIT_BASELINE_CENTS = d(1500);

/** A case's deposit held, in cents — a working-fluid spread around the
 *  baseline (±10%), stable per case, clamped to a $200 floor so a case never
 *  reasons against a nonsense sum. */
export function depositCents(caseId) {
  const f = caseFraction(caseId);
  const spread = (f - 0.5) * 0.2; // −10%…+10% around the baseline
  const cents = Math.round(DEPOSIT_BASELINE_CENTS * (1 + spread));
  return Math.max(d(200), cents);
}

/** The working-fluid documented damage on a case, in cents — a per-case
 *  fraction of that case's deposit (0%…~90%), deterministic. Stands in for
 *  the move-out inspection's actual damage findings until the gate opens. */
export function damageEstimateCents(caseId) {
  // A second, independent-looking fraction off the same case id (offset the
  // hash input) so damage doesn't just track the deposit spread 1:1.
  const f = caseFraction(`${caseId}:damage`);
  return Math.round(depositCents(caseId) * f * 0.9);
}

/** The reconciliation dispositions the clerk weighs — how the deposit splits
 *  between the tenant's refund and the owner's deductions. The harness owns
 *  every cents figure (see `splitDeposit`); the brain only picks WHICH
 *  disposition fits the documented damage. */
export const SETTLE_MOVES = [
  { key: 'full-refund', label: 'a full refund' },
  { key: 'partial', label: 'a partial deduction' },
  { key: 'forfeit', label: 'a full forfeit' },
];

/** A move by its key, or null (an unknown key → the caller's deterministic
 *  fallback). */
export function moveByKey(key) {
  if (!key) return null;
  return SETTLE_MOVES.find((m) => m.key === key) ?? null;
}

/** Apply a chosen disposition to a case's deposit + documented damage →
 *  `{ deductionsCents, refundCents }`, both clamped inside [0, depositCents].
 *  The brain chooses WHICH disposition; the harness does every sum — the
 *  same split as leasing.mjs's `applyMove` owning the rent arithmetic while
 *  the brain only picks the move. */
export function splitDeposit(move, depCents, damageCents) {
  const dep = Math.max(0, Math.round(depCents ?? 0));
  const damage = Math.max(0, Math.round(damageCents ?? 0));
  const key = move?.key;
  if (key === 'forfeit') {
    return { deductionsCents: dep, refundCents: 0 };
  }
  if (key === 'partial') {
    const deductionsCents = Math.min(damage, dep);
    return { deductionsCents, refundCents: dep - deductionsCents };
  }
  // 'full-refund' and any unrecognized key land on the safe baseline: no
  // deduction, the whole deposit returned.
  return { deductionsCents: 0, refundCents: dep };
}

// ── The reasoning accounting clerk (acct-desk, Tier 1 → Tier 2 on doubt) ────
// The fourth reasoning seat — the deposit-reconciliation side, the mirror of
// the leasing clerk's price call on the move-out relay's OTHER money-adjacent
// commitment. At `deposit-accounting` (alys's step) it reasons which
// disposition fits the documented damage against the deposit held — full
// refund, a partial deduction, or a full forfeit — then drafts the itemized
// split for the Regent's word. Judging documented damage against a held
// deposit is genuinely ambiguous (the same shape as intake and lease
// pricing), so this seat carries the SAME confidence-escalation as
// osric/mabel: Tier 1 (`kimi-k2.7-code-highspeed`) reasons first with its own
// honest confidence; low confidence — no valid disposition parsed, confidence
// under 0.6, or the pick landed on the tenant-safe default (a disposition
// that decides nothing against the tenant) — escalates ONE hop to Tier 2
// (`kimi-k2.7-code`, the same Moonshot line's more deliberate hand, never k3)
// with a "reason carefully" prompt. The cascade never stalls: Tier 2 → Tier
// 1's own uncertain pick → the Tier-0 default disposition, whichever first
// hands back a usable move. THIS SEAT POSTS NO MONEY: it emits exactly one
// event per case — the proposal — for a human to ratify before any transfer.
// No clerk self-approves (KINGDOM.md).

/** Ask a brain to reason a deposit-reconciliation disposition, WITH its own
 *  honest confidence (0–1) — Tier 1's bread-and-butter call, and Tier 2's
 *  escalation reuses the same shape with a more deliberate system prompt.
 *  Returns `{ dispositionKey, confidence, why }` (`dispositionKey`/
 *  `confidence` may be `null` when the reply doesn't parse) on a completed
 *  call, or `null` outright on a hard failure (network down, the call
 *  throws) — the caller's cascade absorbs both the same way. The disposition
 *  is constrained to the menu, exactly as the leasing clerk constrains the
 *  move to its mode's menu — the brain judges WHICH disposition, the harness
 *  owns every cents figure. `deliberate` swaps in the Tier-2 system prompt
 *  ("reason carefully, this reconciliation is ambiguous") for the escalation
 *  call. The clerk PREPARES, never POSTS — the prompt says so outright, so
 *  the brain never mistakes this for authority to move coin. */
async function reasonReconcile(complete, model, { subject, depositCents: dep, damageCents: damage, coin }, { deliberate = false } = {}) {
  const menu = SETTLE_MOVES.map((m) => `- ${m.key} — ${m.label}`).join('\n');
  const frame = `A move-out deposit reconciliation. Deposit held: ${coin(dep)}. Documented damage: ${coin(damage)}.`;
  const system = deliberate
    ? 'You are a SENIOR property-accounting clerk. A junior clerk\'s first read on this deposit ' +
      'reconciliation came back uncertain, so it has been handed up to you — reason carefully, this ' +
      'split is genuinely ambiguous. Weigh the documented damage against the deposit held before ' +
      'choosing; do not default to the tenant-safe move unless nothing else truly fits. You are ' +
      'PREPARING a reconciliation for a human to ratify, NOT posting any transfer — no coin moves on ' +
      'your word. Reply with ONLY a JSON object: {"disposition":"<exact key from the menu>",' +
      '"confidence":<0-1>,"why":"<one short clause>"}. Confidence is your own honest certainty that ' +
      "this is the single best disposition — don't inflate it."
    : 'You are a property-accounting clerk preparing (NOT posting) a move-out deposit reconciliation. ' +
      'Given the deposit held and the documented damage, choose the single best-fitting disposition ' +
      'from the menu. You are drafting a proposal for a human to ratify — no coin moves on your word. ' +
      'Reply with ONLY a JSON object: {"disposition":"<exact key from the menu>","confidence":<0-1>,' +
      '"why":"<one short clause>"}. Choose the single best-fitting disposition, and give your own ' +
      "honest confidence (0 to 1) that it's the right call — nothing else.";
  const messages = [
    { role: 'system', content: system },
    {
      role: 'user',
      content: `${frame}\n\nDispositions:\n${menu}\n\nReturn {"disposition":"<key>","confidence":<0-1>,"why":"<clause>"}.`,
    },
  ];
  const keys = new Set(SETTLE_MOVES.map((m) => m.key));
  try {
    const { message } = await complete({ messages, ...brainOpts(model), maxTokens: 2048 });
    const text = message.content ?? '';
    let dispositionKey = text.match(/"disposition"\s*:\s*"([^"]+)"/)?.[1]?.trim();
    if (!dispositionKey || !keys.has(dispositionKey)) dispositionKey = [...keys].find((k) => text.includes(k)) ?? null;
    const confidence = Number(text.match(/"confidence"\s*:\s*([\d.]+)/)?.[1]);
    const why = (text.match(/"why"\s*:\s*"([^"]+)"/)?.[1] ?? '').replace(/[{}]/g, '').trim();
    return { dispositionKey, confidence: Number.isFinite(confidence) ? confidence : null, why };
  } catch (err) {
    console.warn(`  acct-desk brain call failed (${err.message}); falling back${deliberate ? ' further' : ' to the rule'}.`);
  }
  return null;
}

/** The safe DEFAULT disposition — the one that decides nothing against the
 *  tenant (a full refund). The accounting equivalent of the leasing clerk's
 *  "hold the rent"/"list at market": a move that fits everything really fits
 *  nothing, and doubles as the Tier-0 fallback so the seat never stalls. */
export function defaultDispositionKey() {
  return 'full-refund';
}

/** LOW confidence — the trigger for the acct-desk clerk's Tier-2 escalation
 *  (or, past escalation, for falling further down the cascade): no valid
 *  disposition parsed at all, OR the model's own confidence undercuts 0.6, OR
 *  it landed on the safe default disposition. */
export function isReconcileLowConfidence(result) {
  if (!result || !result.dispositionKey) return true;
  if (result.confidence == null || result.confidence < 0.6) return true;
  if (result.dispositionKey === defaultDispositionKey()) return true;
  return false;
}

/** The move-out relay commitment this seat grips — `deposit-accounting`, held
 *  by alys. The twin of clerks.mjs's LEASE_COMMITMENTS, kept local to this
 *  file since acct-desk is a seat of its own (not alys's advance clerk):
 *  the reasoning happens here, at alys's step, before her advance clerk
 *  (if any) would otherwise just sweep it through untouched. */
export const COMMITMENTS = {
  // The founding grammar (src/domain/flows.ts).
  'move-out-relay': { stepKey: 'deposit-accounting', holder: 'alys' },
  // The grand-muster library grammar (data/library/pm-setting.json) — the
  // deposit reconciliation is itemized on the accounting queue there.
  'move-out-reconcile': { stepKey: 'itemize', holder: 'lp-queue' },
};

/** The acct-desk reasoning accounting clerk: find live cascades standing at
 *  the deposit-accounting commitment, reason a reconciliation disposition —
 *  deepened with CONFIDENCE-ESCALATION, the same shape as osric/mabel: Tier 1
 *  (`kimi-k2.7-code-highspeed`) reads the case first; a clear one resolves
 *  right there. An uncertain one (no valid disposition parsed, confidence
 *  under 0.6, or the tenant-safe default) escalates ONE time to Tier 2
 *  (`kimi-k2.7-code`, the same Moonshot line's more deliberate hand — never
 *  k3) with a "reason carefully" prompt. The cascade never stalls: Tier 2 →
 *  Tier 1's own (still-uncertain) answer → the Tier-0 default disposition,
 *  whichever first hands back a usable move — then split the deposit
 *  deterministically and PROPOSE the itemized reconciliation, showing the
 *  Regent the split before any coin moves. READ/PREP ONLY: the clerk emits
 *  exactly one event per case (the proposal); it never creates or pushes any
 *  money/economy event, never touches a bank or a book. */
export function makeAccountingClerk(ctx) {
  const seat = 'acct-desk';
  const policy = ctx.brainFor(seat, 'reconcile');
  return {
    seat,
    taskType: 'reconcile',
    policy,
    label: `the ${seat} accounting clerk`,
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
        const dep = depositCents(r.caseId);
        const damage = damageEstimateCents(r.caseId);

        // Tier 1 first (the seat's base brain, unchanged). A clear case stops
        // right here — no escalation, no extra call, no extra spend.
        let resolved = null; // { dispositionKey, why } once a brain tier lands one
        let how = 'default';
        if (policy.tier > 0) {
          const t1 = await reasonReconcile(ctx.complete, policy, {
            subject: r.subject,
            depositCents: dep,
            damageCents: damage,
            coin,
          });
          if (!isReconcileLowConfidence(t1)) {
            resolved = t1;
            how = 'brain t1';
          } else if (policy.escalate) {
            // Ambiguous — hand it up to Tier 2, the deliberate hand on the same
            // Moonshot line. Take its answer if it parses a valid disposition;
            // if the escalation call itself comes back empty, fall to Tier 1's
            // own (still-uncertain) pick rather than skip straight to the
            // default — the cascade folds one rail at a time.
            const t2 = await reasonReconcile(
              ctx.complete,
              policy.escalate,
              { subject: r.subject, depositCents: dep, damageCents: damage, coin },
              { deliberate: true },
            );
            if (t2?.dispositionKey) {
              resolved = t2;
              how = 'brain t2 ↑escalated';
            } else if (t1?.dispositionKey) {
              resolved = t1;
              how = 'brain t1';
            }
          } else if (t1?.dispositionKey) {
            // No escalation target on this policy — take Tier 1's uncertain
            // pick over the default; it still beat parsing nothing at all.
            resolved = t1;
            how = 'brain t1';
          }
        }

        // Tier-0 fallback: the tenant-safe default so the seat never stalls —
        // a full refund, deciding nothing against the tenant.
        const move = moveByKey(resolved?.dispositionKey) ?? moveByKey(defaultDispositionKey());

        // The harness owns every cents figure — the brain only chose WHICH
        // disposition; the split itself is deterministic arithmetic.
        const { deductionsCents: ded, refundCents: ref } = splitDeposit(move, dep, damage);
        const because = resolved?.why ? ` (${resolved.why})` : '';

        const note =
          `Reconcile the deposit — ${move.label}: of ${coin(dep)} held, ${coin(ded)} to deductions and ` +
          `${coin(ref)} refunded. Drafted for the Regent's word — no coin moves until ratified.${because}`;

        // The ONLY event this clerk ever emits: a proposal on the step in
        // hand. No money/economy event of any kind is created or pushed here
        // — the human ratifies; only then, elsewhere, does coin move.
        const proposal = core.proposeStep(r.template, r.caseId, r.next.index - 1, `agent:${seat}`, {
          at: now,
          id: () => randomUUID(),
          note,
        });
        if (!proposal) continue;
        events.push(proposal);
        taken.add(r.caseId);
        records.push(`${r.template.title} "${r.subject}" → ${move.label} (refund ${coin(ref)}) [${how}].`);
      }
      return { events, records };
    },
  };
}
