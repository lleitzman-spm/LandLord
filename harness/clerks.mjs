// The clerks — the fleet's agents, one procedure per seat (WRIT-TASK-LANGUAGE,
// "the full clerk fleet"; swing four proved ONE, this generalizes it). Every
// clerk is the same shape: a seat, a task-type, a brain policy (from the
// clerk-brain doctrine), and a `run` that reads the log, does its bounded work
// through the REAL flow engine, and STOPS at a judgment — emitting `proposed`
// with an `agent:<seat>` actor so the Regent ratifies. No clerk ever
// self-approves; the human's hand stays on the ratchet.
//
// Two kinds ship here:
//   • the INTAKE clerk (Tier 1, a cheap brain) — Mabel's: it originates a
//     cascade from raw intake, identifies the complaint down the tree, and
//     proposes at the first commitment. This is swing four, unchanged in
//     behavior, now a clerk in the roster.
//   • the ADVANCE clerk (Tier 0, a tool — no brain) — a GENERAL agent for any
//     seat: it finds live cascades whose step-in-hand sits on its seat and
//     proposes that step for the Regent. One factory makes a clerk for every
//     seat, which is the whole idea of the fleet.

import { randomUUID } from 'node:crypto';
import { brainOpts } from './brain-doctrine.mjs';
import { rosterFor, rosterTrade, clampFeeCents, invoiceFor } from './vendors.mjs';
import { baseRentCents, movesFor, moveByKey, applyMove } from './leasing.mjs';
import { maintenanceSymptom, safeUrgency } from './safe-evidence.mjs';
import { stampAgentActor } from './agents/actor.mjs';

// ── Shared intake helpers (the Mabel clerk) ────────────────────────────────

export const FLOW_KEY = 'vendor-dispatch';
const INTAKE_MARK = ' · intake · ';

/** The vendor-dispatch commitment step — where a vendor, and owner money, is
 *  committed (KINGDOM.md "It STOPS at the first commitment"): `assign-vendor` in
 *  the founding flow, `approve-spend` in the muster's / loaded grammars'. The
 *  owner-approval spend gate is read here. */
export const COMMIT_STEP_KEYS = new Set(['assign-vendor', 'approve-spend']);

/** The vendor-dispatch SETTLEMENT commitment — where owner money actually leaves
 *  to pay the sellsword ("Approve against NTE {amount} and pay"): `pay-vendor` in
 *  the founding flow, `pay` in the loaded grammars. The price-approval clerk
 *  reconciles the invoice here before the coin moves. */
export const SETTLE_STEP_KEYS = new Set(['pay-vendor', 'pay']);

/** The leasing commitments the osric clerk REASONS at — where a rent, and the fee
 *  it earns, is set. Two shapes, both held by `osric`:
 *    • the RENEWAL rent call (`price` in lease-renewal) — hold / raise / concede,
 *      earning the flat renewal fee;
 *    • the VACANT door's ask (`list-unit` in the move-out relay) — the re-list
 *      price, earning the leasing (placement) fee of a month's rent.
 *  Each names the mode (which move menu the clerk chooses from) and the economy
 *  fee kind read against the reasoned rent. The osric clerk's OTHER osric steps
 *  (final-walk, show-and-screen, the weekly drop, countersign) are deterministic
 *  and stay with the general advance clerk, exactly as the vendor clerk takes
 *  `assign-vendor` and leaves `dispatch` to the advance clerk. */
export const LEASE_COMMITMENTS = {
  // `stepKeys` lists every step (across grammars) that names this commitment, so
  // the clerk fires on the founding flows AND the grand-muster library: the
  // renewal rent call is `price` (founding) or `offer-to-tenant` (library);
  // the vacancy re-list is `list-unit` (founding). The `lease-renewal` key is
  // shared by both grammars, so one entry must accept either step.
  'lease-renewal': { stepKeys: ['price', 'offer-to-tenant'], mode: 'renewal', feeKind: 'renewal' },
  'move-out-relay': { stepKeys: ['list-unit'], mode: 'vacancy', feeKind: 'leasing' },
};

/** Recover the amount a vendor was authorized to bill — the quote the vendor
 *  clerk proposed at the dispatch commitment, read back from the case's own
 *  record ("quoted $X"). None found (a human dispatched without a clerk quote) →
 *  null, and the caller falls back to the cap/urgency estimate. */
function authorizedQuoteCents(doc, caseId) {
  for (const e of doc.events) {
    if (e.caseId !== caseId) continue;
    const m = (e.note ?? '').match(/quoted \$([\d,]+)/);
    if (m) return Number(m[1].replace(/,/g, '')) * 100;
  }
  return null;
}

/** The economy the kingdom actually governs by — the founding/loaded chart with
 *  its gate patch folded in. The harness twin of `chronicle.ts`'s `economyOf`,
 *  tolerant of a raw vault doc that predates either shelf: no `economySetting`
 *  on the doc ⇒ the chart reads byte-identical to before. Every clerk's economy
 *  read routes through here, so a setting loaded through the Counting-house gate
 *  governs the fleet exactly as it governs the app. */
function economyFor(core, doc) {
  return core.applyEconomySetting(doc.economy ?? core.FOUNDING_ECONOMY, doc.economySetting);
}

/** A case's real-property slug, folded off its own events (`readCase`) — the
 *  key a per-estate NTE cap or fee rule binds on. Null when the case names no
 *  estate, and every gate reading then falls back to the house cap. */
function estateOf(core, doc, caseId) {
  return core.readCase(doc.events, caseId).estateId ?? undefined;
}

/** The spend-gate decision for the step a clerk is about to propose, or null
 *  when that step is not a vendor-dispatch commitment (so no gate applies). The
 *  estimate is a working-fluid reading off the WO's `{urgency}`; a setting loads
 *  real per-trade estimates at the gate. Reads the economy folded on the
 *  chronicle — the loaded setting patch included — and the case's own estate,
 *  so a per-estate NTE governs where one is loaded. */
function spendGateFor(core, doc, tpl, index, params, estateId) {
  if (!tpl || tpl.key !== FLOW_KEY) return null;
  const step = tpl.steps[index];
  if (!step || !COMMIT_STEP_KEYS.has(step.key)) return null;
  const economy = economyFor(core, doc);
  const estimate = core.estimateSpendCents(params?.urgency);
  return core.spendGate(economy, estimate, estateId);
}

/** The maintenance leaves that complete a vendor dispatch — the language the
 *  intake clerk identifies into. */
function dispatchLeaves(catalog) {
  const bound = catalog.filter((r) => r.completes === FLOW_KEY);
  const maint = bound.filter((r) => r.domain === 'maintenance');
  return maint.length ? maint : bound;
}

/** The aging raw-intake maintenance tickets, most-aged first. */
function agingIntake(core, doc, now) {
  return core
    .readCases(doc.events)
    .filter((c) => c.status === 'open' && c.holder === 'pm-desk' && c.caseId.includes(INTAKE_MARK))
    .map((c) => ({ c, age: core.ageInDays(c, now) ?? 0 }))
    .sort((a, b) => b.age - a.age);
}

function complaintOf(caseId) {
  const tail = caseId.split(INTAKE_MARK)[1] ?? caseId;
  const dash = tail.indexOf(' — ');
  return dash >= 0 ? tail.slice(dash + 3).trim() : tail.trim();
}

/** The generic catch-all leaf — a valid pick that says nothing (the identify
 *  equivalent of a shrug). A confident clerk should rarely land here; when it
 *  does, treat it as low confidence even if the model claims otherwise. */
const CATCHALL_LEAF = 'work-order';

/** Ask a brain to identify a complaint down to a leaf key, WITH its own honest
 *  confidence (0–1) — Tier 1's bread-and-butter parse, and Tier 2's escalation
 *  reuses the same shape with a more deliberate system prompt. Returns
 *  `{ key, confidence }` (either may be `null` when the reply doesn't parse a
 *  usable leaf) on a completed call, or `null` outright on a hard failure
 *  (network down, bad base URL, the call throws) — the caller's cascade
 *  absorbs both the same way. `deliberate` swaps in the Tier-2 system prompt
 *  ("reason carefully, the complaint is ambiguous") for the escalation call. */
async function brainIdentify(complete, model, symptom, leaves, { deliberate = false } = {}) {
  const menu = leaves
    .map(
      (r) =>
        `- ${r.key} — ${r.title}${r.system ? ` (${r.system})` : ''}${r.params?.trade ? ` [trade: ${r.params.trade}]` : ''}`,
    )
    .join('\n');
  const system = deliberate
    ? 'You are a SENIOR property-management maintenance clerk. A junior clerk\'s first ' +
      'read on this complaint came back uncertain, so it has been handed up to you — ' +
      'reason carefully, the complaint is genuinely ambiguous. Weigh the controlled symptom token ' +
      'against every catalog leaf before choosing; do not default to a generic catch-all ' +
      'unless nothing else fits. Reply with ONLY a JSON object: {"leaf":"<the exact leaf ' +
      'key>","confidence":<0-1>}. Confidence is your own honest certainty that this is ' +
      "the single best-fitting leaf — don't inflate it."
    : 'You are a property-management maintenance clerk. You identify a de-identified ' +
      'operational symptom as exactly one catalog leaf (the task-type a vendor dispatch will ' +
      'complete). Reply with ONLY a JSON object: {"leaf":"<the exact leaf key>",' +
      '"confidence":<0-1>}. Choose the single best-fitting key from the menu, and give ' +
      "your own honest confidence (0 to 1) that it's the right one — nothing else.";
  const messages = [
    { role: 'system', content: system },
    {
      role: 'user',
      content: `Operational symptom: ${symptom}\n\nCatalog leaves to choose from:\n${menu}\n\nReturn {"leaf":"<key>","confidence":<0-1>}.`,
    },
  ];
  const valid = new Set(leaves.map((r) => r.key));
  try {
    const { message } = await complete({ messages, ...brainOpts(model), maxTokens: 2048 });
    const text = message.content ?? '';
    let key = text.match(/"leaf"\s*:\s*"([^"]+)"/)?.[1]?.trim();
    if (!key || !valid.has(key)) key = [...valid].find((k) => text.includes(k)) ?? null;
    const confidence = Number(text.match(/"confidence"\s*:\s*([\d.]+)/)?.[1]);
    return { key, confidence: Number.isFinite(confidence) ? confidence : null };
  } catch (err) {
    console.warn(`  brain call failed (${err.message}); falling back${deliberate ? ' further' : ' to a heuristic'}.`);
  }
  return null;
}

/** LOW confidence — the trigger for escalation (or, past escalation, for
 *  falling further down the cascade): no valid leaf parsed at all, OR the
 *  model's own confidence undercuts 0.6, OR it landed on the generic
 *  catch-all (a leaf that fits everything really fits nothing). */
function isLowConfidence(result) {
  if (!result || !result.key) return true;
  if (result.confidence == null || result.confidence < 0.6) return true;
  if (result.key === CATCHALL_LEAF) return true;
  return false;
}

/** The Tier-0 fallback: the leaf sharing the most words with the complaint. */
function heuristicLeaf(complaint, leaves) {
  const words = new Set(complaint.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3));
  let best = leaves[0];
  let bestScore = -1;
  for (const r of leaves) {
    const hay = `${r.title} ${r.system ?? ''} ${r.params?.trade ?? ''}`.toLowerCase();
    let score = 0;
    for (const w of words) if (hay.includes(w)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best;
}

/** Mabel's intake clerk: originate a vendor-dispatch cascade from raw intake,
 *  identify it, advance the report and identify steps through the real engine,
 *  and propose at the first commitment (assign-vendor / approve-spend). Swing
 *  four's arc, now a clerk — deepened with CONFIDENCE-ESCALATION (the
 *  doctrine's deferred item #4, called on this seat because raw intake is the
 *  one genuinely AMBIGUOUS input): Tier 1 (`kimi-k2.7-code-highspeed`) reads
 *  the complaint first; a clear one resolves right there. An uncertain one
 *  (no valid leaf parsed, confidence under 0.6, or the generic catch-all)
 *  escalates ONE time to Tier 2 (`kimi-k2.7-code`, the same Moonshot line's
 *  more deliberate hand — never k3) with a "reason carefully" prompt. The
 *  cascade never stalls: Tier 2 → Tier 1's own (still-uncertain) answer →
 *  the Tier-0 keyword heuristic, whichever first hands back a usable leaf. */
export function makeIntakeClerk(ctx) {
  const seat = 'mabel';
  const policy = ctx.brainFor(seat, 'identify');
  return {
    seat,
    taskType: 'identify',
    policy,
    label: `${seat}'s intake clerk`,
    async run({ doc, now, taken, cap = 3 }) {
      const core = ctx.core;
      const events = [];
      const records = [];
      const leaves = dispatchLeaves(doc.catalog);
      const tpl = doc.flows.find((f) => f.key === FLOW_KEY);
      if (!tpl || !leaves.length) return { events, records };

      const pending = agingIntake(core, doc, now).filter(({ c }) => !taken.has(c.caseId));
      for (let i = 0; i < cap && i < pending.length; i++) {
        const { c, age } = pending[i];
        const complaint = complaintOf(c.caseId);
        const symptom = maintenanceSymptom(complaint);

        // Tier 1 first (the seat's base brain, unchanged). A clear complaint
        // stops right here — no escalation, no extra call, no extra spend.
        let resolvedKey = null;
        let how = 'heuristic';
        if (policy.tier > 0) {
          const t1 = await brainIdentify(ctx.complete, policy, symptom, leaves);
          if (!isLowConfidence(t1)) {
            resolvedKey = t1.key;
            how = 'brain t1';
          } else if (policy.escalate) {
            // Ambiguous — hand it up to Tier 2, the deliberate hand on the
            // same Moonshot line. Take its answer if it parses a valid leaf;
            // if the escalation call itself comes back empty, fall to Tier
            // 1's own (still-uncertain) pick rather than skip straight to
            // the heuristic — the cascade folds one rail at a time.
            const t2 = await brainIdentify(ctx.complete, policy.escalate, symptom, leaves, {
              deliberate: true,
            });
            if (t2?.key) {
              resolvedKey = t2.key;
              how = 'brain t2 ↑escalated';
            } else if (t1?.key) {
              resolvedKey = t1.key;
              how = 'brain t1';
            }
          } else if (t1?.key) {
            // No escalation target on this policy — take Tier 1's uncertain
            // pick over the heuristic; it still beat parsing nothing at all.
            resolvedKey = t1.key;
            how = 'brain t1';
          }
        }

        const leaf = resolvedKey ? leaves.find((r) => r.key === resolvedKey) : heuristicLeaf(complaint, leaves);

        const at = now;
        const id = () => randomUUID();
        const subject = c.caseId.replace(INTAKE_MARK, ' · ');
        const params = core.fullParams(tpl, leaf.params);

        // The raw ticket's estate rides onto the cascade (the muster's own
        // stamp pattern), so the spend gate and the settlement money keep the
        // real-property dimension the intake arrived with.
        const estateId = c.estateId ?? undefined;
        const instance = core.instantiateFlow(tpl, subject, { at, id, estateId }, params);
        const caseId = instance.caseId;
        const opened = instance.events.find((e) => e.kind === 'opened');
        if (opened) opened.note = `${opened.note ?? ''} Identified by ${seat}'s clerk from: "${complaint}".`.trim();
        events.push(...instance.events);
        events.push({
          id: id(),
          at,
          caseId: c.caseId,
          kind: 'done',
          catalogRow: 'work-order',
          actor: `agent:${seat}`,
          note: `Identified as ${leaf.title} — put in motion as a ${tpl.title}.`,
        });
        // Stamped: a clerk's `done` must not read as the operator's own work.
        events.push(...stampAgentActor(core.completeStep(tpl, caseId, 0, { at, id, note: 'Report logged from the tenant intake.', log: [...doc.events, ...events] }, params), seat));
        events.push(...stampAgentActor(core.completeStep(tpl, caseId, 1, { at, id, note: `Identified as ${leaf.title}.`, log: [...doc.events, ...events] }, params), seat));
        const trade = params.trade ?? 'the trade';
        const urgency = params.urgency ?? 'routine';
        const gate = spendGateFor(core, doc, tpl, 2, params, estateId);
        const proposal = core.proposeStep(tpl, caseId, 2, `agent:${seat}`, {
          at,
          id,
          note: `Propose engaging a ${trade} artisan — ${urgency} priority.${gate ? ` ${gate.note}` : " The spend awaits the Regent's word."}`,
        });
        if (proposal) events.push(proposal);

        taken.add(c.caseId);
        taken.add(caseId);
        records.push(
          `WO "${complaint}" (aged ${age}d) → identified [${how}] as ${leaf.key}; cascade opened, advanced, proposal parked awaiting${gate ? ` — ${gate.disposition}` : ''}.`,
        );
      }
      return { events, records };
    },
  };
}

// ── The reasoning vendor clerk (va-desk, Tier 1 → Tier 2 on doubt) ──────────
// The fleet's first clerk that REASONS at a commitment rather than proposing the
// templated step. Where the advance clerk (Tier 0) would say "advance assign-
// vendor", this clerk picks an actual sellsword from the trade's roster and
// forms a price, then reads the SPEND GATE against that reasoned quote — so the
// gate bites on a real number, not just the urgency band. Under the NTE cap it
// recommends the Regent proceed; over it, it flags that the owner's word is
// needed. It STILL only proposes — the human's Approve/Override ratchet is
// untouched (no clerk self-approves, KINGDOM.md). Choosing among a roster off a
// thin work-order description is the same shape of ambiguity as raw intake and
// lease pricing, so this seat carries the SAME confidence-escalation as
// mabel/identify and osric/price-lease: Tier 1 (`kimi-k2.7-code-highspeed`)
// reasons first with its own honest confidence; a clear pick stops right there.
// An uncertain one (no valid vendor parsed off the roster, confidence under 0.6,
// or nothing usable at all) escalates ONE hop to Tier 2 (`kimi-k2.7-code`, the
// same Moonshot line's more deliberate hand — never k3) with a "reason
// carefully" prompt. The cascade never stalls: Tier 2 → Tier 1's own (still-
// uncertain) pick → the Tier-0 fallback (first-of-roster + the urgency band).

/** Ask the brain to pick a sellsword and quote the job, WITH its own honest
 *  confidence (0–1) — Tier 1's bread-and-butter pick, and Tier 2's escalation
 *  reuses the same shape with a more deliberate system prompt. Returns
 *  `{ vendor, feeCents, confidence, why }` (`vendor`/`feeCents`/`confidence` may
 *  be `null` when the reply doesn't parse a usable pick) on a completed call, or
 *  `null` outright on a hard failure (network down, the call throws) — the
 *  caller's cascade absorbs both the same way. `deliberate` swaps in the Tier-2
 *  system prompt ("reason carefully, the vendor pick is ambiguous") for the
 *  escalation call. */
async function reasonVendor(complete, model, { symptom, trade, urgency, roster }, { deliberate = false } = {}) {
  const options = roster.map((vendor, index) => ({ key: `vendor-${index + 1}`, vendor }));
  const menu = options
    .map(({ key, vendor }) => `- ${key} (typical $${Math.round(vendor.lowCents / 100)}–$${Math.round(vendor.highCents / 100)})`)
    .join('\n');
  const system = deliberate
    ? 'You are va-desk, a SENIOR property-management dispatch clerk. A junior clerk\'s first read on ' +
      'this vendor pick came back uncertain, so it has been handed up to you — reason carefully, the ' +
      'choice is genuinely ambiguous. Weigh the operational symptom, trade, and urgency against every ' +
      'roster entry before choosing. Reply with ONLY a JSON object: {"vendor":"<exact option from the ' +
      'roster>","dollars":<integer>,"confidence":<0-1>,"why":"<one short clause>"}. Confidence is your ' +
      "own honest certainty that this is the single best vendor and price — don't inflate it."
    : 'You are va-desk, a property-management dispatch clerk. Given a work order (its de-identified symptom, ' +
      'trade, and urgency) and a roster of vendors for that trade, choose the single best vendor and ' +
      'estimate the repair cost in whole dollars. Weigh urgency: an emergency or a major-system ' +
      'failure costs more than a routine call. Reply with ONLY a JSON object: {"vendor":"<exact option ' +
      'from the roster>","dollars":<integer>,"confidence":<0-1>,"why":"<one short clause>"}. Choose ' +
      "the single best-fitting vendor, and give your own honest confidence (0 to 1) that it's the " +
      'right pick — nothing else.';
  const messages = [
    { role: 'system', content: system },
    {
      role: 'user',
      content: `Symptom: ${symptom}\nTrade: ${trade} · urgency: ${urgency}\n\nVendor options:\n${menu}\n\nReturn {"vendor":"<option>","dollars":<integer>,"confidence":<0-1>,"why":"<clause>"}.`,
    },
  ];
  try {
    const { message } = await complete({ messages, ...brainOpts(model), maxTokens: 2048 });
    const text = message.content ?? '';
    // The dollars figure and the vendor, parsed tolerantly from the JSON.
    const dollars = Number(text.match(/"dollars"\s*:\s*(\d+(?:\.\d+)?)/)?.[1]);
    const feeCents = clampFeeCents(dollars * 100);
    let option = text.match(/"vendor"\s*:\s*"([^"]+)"/)?.[1]?.trim();
    if (!options.some((entry) => entry.key === option)) {
      option = options.find((entry) => text.includes(entry.key))?.key ?? null;
    }
    const vendor = options.find((entry) => entry.key === option)?.vendor.name ?? null;
    const confidence = Number(text.match(/"confidence"\s*:\s*([\d.]+)/)?.[1]);
    const why = (text.match(/"why"\s*:\s*"([^"]+)"/)?.[1] ?? '').replace(/[{}]/g, '').trim();
    return { vendor, feeCents, confidence: Number.isFinite(confidence) ? confidence : null, why };
  } catch (err) {
    console.warn(`  vendor brain call failed (${err.message}); falling back${deliberate ? ' further' : ' to the roster'}.`);
  }
  return null;
}

/** LOW confidence — the trigger for the vendor clerk's Tier-2 escalation (or,
 *  past escalation, for falling further down the cascade): no valid vendor
 *  parsed off the roster, no usable quote, OR the model's own confidence
 *  undercuts 0.6. */
function isLowVendorConfidence(result) {
  if (!result || !result.vendor || result.feeCents == null) return true;
  if (result.confidence == null || result.confidence < 0.6) return true;
  return false;
}

/** The va-desk reasoning vendor clerk: find live vendor-dispatch cascades
 *  standing at the commitment (`assign-vendor` / `approve-spend`) on va-desk,
 *  reason a vendor + price — deepened with CONFIDENCE-ESCALATION, the same
 *  shape as the intake and leasing clerks: Tier 1 reads the roster first; a
 *  clear pick stops right there. An uncertain one (no valid vendor, confidence
 *  under 0.6, or a hard failure) escalates ONE time to Tier 2 with a "reason
 *  carefully" prompt. The cascade never stalls: Tier 2 → Tier 1's own (still-
 *  uncertain) pick → the Tier-0 fallback (first-of-roster + the urgency band),
 *  whichever first hands back a usable vendor — then read the spend gate
 *  against that reasoned quote, and propose — recommending the Regent proceed
 *  under the cap, flagging the owner's word over it. */
export function makeVendorClerk(ctx) {
  const seat = 'va-desk';
  const policy = ctx.brainFor(seat, 'assign-vendor');
  return {
    seat,
    taskType: 'assign-vendor',
    policy,
    label: `the ${seat} vendor clerk`,
    async run({ doc, now, taken, cap = 5 }) {
      const core = ctx.core;
      const events = [];
      const records = [];
      const acted = new Set(['proposed', 'approved', 'overridden', 'done']);
      const economy = economyFor(core, doc);
      const coin = core.coinCents;

      const targets = core
        .readFlows(doc.flows, doc.events, now)
        .filter(
          (r) =>
            r.template.key === FLOW_KEY &&
            r.status !== 'done' &&
            r.next &&
            // No holder gate: the vendor-assignment commitment (assign-vendor /
            // approve-spend) belongs to this clerk wherever the loaded grammar
            // seats it — va-desk in the founding flows, mabel/pm-desk in the
            // grand-muster library. The step keys are specific enough to be
            // unambiguous within vendor-dispatch; `taken` keeps the advance
            // clerk off the same case.
            COMMIT_STEP_KEYS.has(r.next.step.key) &&
            !acted.has(r.next.kind) &&
            !taken.has(r.caseId),
        )
        .sort((a, b) => (a.openedAt ?? '').localeCompare(b.openedAt ?? '')); // oldest first

      for (let i = 0; i < cap && i < targets.length; i++) {
        const r = targets[i];
        const at = now;
        const id = () => randomUUID();
        const params = core.paramsOf(doc.events, r.caseId);
        const trade = rosterTrade(params?.trade);
        const urgency = safeUrgency(params?.urgency);
        const symptom = maintenanceSymptom(r.subject, params);
        const roster = rosterFor(trade);

        // Tier 1 first (the seat's base brain, unchanged). A clear pick stops
        // right here — no escalation, no extra call, no extra spend.
        let resolved = null; // { vendor, feeCents, why } once a brain tier lands one
        let how = 'roster';
        if (policy.tier > 0) {
          const t1 = await reasonVendor(ctx.complete, policy, { symptom, trade, urgency, roster });
          if (!isLowVendorConfidence(t1)) {
            resolved = t1;
            how = 'brain t1';
          } else if (policy.escalate) {
            // Ambiguous — hand it up to Tier 2, the deliberate hand on the same
            // Moonshot line. Take its answer if it parses a valid vendor + quote;
            // if the escalation call itself comes back empty, fall to Tier 1's
            // own (still-uncertain) pick rather than skip straight to the
            // roster — the cascade folds one rail at a time.
            const t2 = await reasonVendor(
              ctx.complete,
              policy.escalate,
              { symptom, trade, urgency, roster },
              { deliberate: true },
            );
            if (t2?.vendor && t2.feeCents != null) {
              resolved = t2;
              how = 'brain t2 ↑escalated';
            } else if (t1?.vendor && t1.feeCents != null) {
              resolved = t1;
              how = 'brain t1';
            }
          } else if (t1?.vendor && t1.feeCents != null) {
            // No escalation target on this policy — take Tier 1's uncertain
            // pick over the roster; it still beat parsing nothing at all.
            resolved = t1;
            how = 'brain t1';
          }
        }

        const vendor = resolved?.vendor ?? roster[0].name;
        const feeCents = resolved?.feeCents ?? core.estimateSpendCents(urgency);

        const gate = core.spendGate(economy, feeCents, estateOf(core, doc, r.caseId));
        const because = resolved?.why ? ` (${resolved.why})` : '';
        const capLine =
          gate.capCents == null
            ? 'no NTE cap set — the clerk may commit'
            : gate.needsApproval
              ? `over the ${coin(gate.capCents)} NTE cap — the owner's word is needed before the work proceeds`
              : `under the ${coin(gate.capCents)} NTE cap — within the clerk's authority once the Regent approves`;
        const note = `Engage ${vendor} for the ${trade ?? 'general'} call — quoted ${coin(feeCents)}, ${capLine}.${because}`;

        const proposal = core.proposeStep(r.template, r.caseId, r.next.index - 1, `agent:${seat}`, { at, id, note });
        if (!proposal) continue;
        events.push(proposal);
        taken.add(r.caseId);
        records.push(
          `${r.template.title} "${r.subject}" → ${vendor} @ ${coin(feeCents)} [${how}] — ${gate.disposition}.`,
        );
      }
      return { events, records };
    },
  };
}

// ── The price-approval clerk (lp-queue, Tier 1 → Tier 2 on doubt) ───────────
// The settlement side of the vendor-dispatch loop — the mirror of the vendor
// clerk. Where the vendor clerk QUOTES at dispatch, this clerk CHECKS the invoice
// at settlement: it recovers what the vendor was authorized to bill, reads the
// invoice the world submitted, reconciles them (`reconcileSpend`), and reasons a
// recommendation — pay a clean invoice, or hold an overrun for the owner. The
// authorized ceiling (owner-approved quote, else the NTE cap) is a HARD rail: an
// invoice over it is always held, whatever the brain says. It STILL only proposes.
// Judging a within-ceiling invoice that still looks off — or one that sits close
// enough to the ceiling that "material overrun" is a judgment call — is the same
// shape of ambiguity as raw intake, lease pricing, and the vendor pick, so this
// seat carries the SAME confidence-escalation: Tier 1 (`kimi-k2.7-code-highspeed`)
// recommends first with its own honest confidence; a clear invoice stops right
// there. An uncertain one (no pay/hold call parsed, confidence under 0.6, or a
// BORDERLINE invoice sitting within a hair of the authorized ceiling) escalates
// ONE hop to Tier 2 (`kimi-k2.7-code`, the same Moonshot line's more deliberate
// hand — never k3) with a "reason carefully" prompt. The cascade never stalls:
// Tier 2 → Tier 1's own (still-uncertain) recommendation → the Tier-0 rule alone
// (the reconciliation ceiling, unaided).

/** Ask the brain to review an invoice against its authorization, WITH its own
 *  honest confidence (0–1) — Tier 1's bread-and-butter read, and Tier 2's
 *  escalation reuses the same shape with a more deliberate system prompt.
 *  Returns `{ recommend: 'pay' | 'hold' | null, confidence, why }` (`recommend`/
 *  `confidence` may be `null` when the reply doesn't parse) on a completed call,
 *  or `null` outright on a hard failure (network down, the call throws) — the
 *  caller's cascade absorbs both the same way. The brain refines the WITHIN-
 *  ceiling case (a suspicious clean invoice may still merit a hold); the over-
 *  ceiling rail is enforced by the caller regardless. `deliberate` swaps in the
 *  Tier-2 system prompt ("reason carefully, this invoice is genuinely
 *  borderline") for the escalation call. */
async function reasonPayment(complete, model, { subject, trade, authorizedCents, invoiceCents, coin }, { deliberate = false } = {}) {
  const system = deliberate
    ? 'You are lp-queue, a SENIOR property-management accounts-payable clerk. A junior clerk\'s first ' +
      'read on this invoice came back uncertain, so it has been handed up to you — reason carefully, ' +
      'this invoice is genuinely borderline. Weigh the overrun (if any), the work described, and what ' +
      'looks ordinary versus suspicious before recommending. Reply with ONLY a JSON object: ' +
      '{"recommend":"pay"|"hold","confidence":<0-1>,"why":"<one short clause>"}. Confidence is your ' +
      "own honest certainty in the recommendation — don't inflate it."
    : 'You are lp-queue, a property-management accounts-payable clerk. You review a vendor invoice ' +
      "against what was authorized and recommend paying it or holding it for the owner's review. An " +
      'invoice at or under the authorized amount is normally paid; a material overrun, or anything ' +
      'that looks off for the work described, is held. Reply with ONLY a JSON object: ' +
      '{"recommend":"pay"|"hold","confidence":<0-1>,"why":"<one short clause>"}. Give your own honest ' +
      "confidence (0 to 1) in the recommendation — nothing else.";
  const messages = [
    { role: 'system', content: system },
    {
      role: 'user',
      content: `Trade: ${trade ?? 'general'}\nAuthorized: ${coin(authorizedCents)}\nInvoice received: ${coin(invoiceCents)}\n\nReturn {"recommend":"pay"|"hold","confidence":<0-1>,"why":"<clause>"}.`,
    },
  ];
  try {
    const { message } = await complete({ messages, ...brainOpts(model), maxTokens: 2048 });
    const text = message.content ?? '';
    const rec = text.match(/"recommend"\s*:\s*"(pay|hold)"/i)?.[1]?.toLowerCase();
    const confidence = Number(text.match(/"confidence"\s*:\s*([\d.]+)/)?.[1]);
    const why = (text.match(/"why"\s*:\s*"([^"]+)"/)?.[1] ?? '').replace(/[{}]/g, '').trim();
    return {
      recommend: rec === 'pay' || rec === 'hold' ? rec : null,
      confidence: Number.isFinite(confidence) ? confidence : null,
      why,
    };
  } catch (err) {
    console.warn(`  payment brain call failed (${err.message}); falling back${deliberate ? ' further' : ' to the rule'}.`);
  }
  return null;
}

/** A BORDERLINE invoice — within-ceiling (the hard rule already resolved an
 *  over-ceiling case, no ambiguity left there) but sitting close enough to the
 *  authorized ceiling that "clean" versus "a material overrun waiting to
 *  happen" is a genuine judgment call: the margin under the ceiling is 10% of
 *  the ceiling or less. */
function isBorderlineInvoice(recon) {
  if (!recon || recon.needsApproval) return false;
  if (!recon.authorizedCeilingCents) return false;
  const marginCents = recon.authorizedCeilingCents - recon.invoiceCents;
  return marginCents <= recon.authorizedCeilingCents * 0.1;
}

/** LOW confidence — the trigger for the price clerk's Tier-2 escalation (or,
 *  past escalation, for falling further down the cascade): no pay/hold call
 *  parsed at all, OR the model's own confidence undercuts 0.6, OR the invoice
 *  itself is borderline (close enough to the ceiling that a second, more
 *  deliberate read is worth the ask, whatever the first read said). */
function isLowPayConfidence(result, recon) {
  if (!result || !result.recommend) return true;
  if (result.confidence == null || result.confidence < 0.6) return true;
  if (isBorderlineInvoice(recon)) return true;
  return false;
}

/** The lp-queue price-approval clerk: find live vendor-dispatch cascades standing
 *  at the settlement commitment (`pay-vendor` / `pay`) on lp-queue, recover the
 *  authorized quote, read the invoice the world submitted, reconcile them, and
 *  reason a recommendation — deepened with CONFIDENCE-ESCALATION, the same shape
 *  as the intake, leasing, and vendor clerks: Tier 1 reads the invoice first; a
 *  clear one stops right there. An uncertain one (no call parsed, confidence
 *  under 0.6, or a borderline invoice near the ceiling) escalates ONE time to
 *  Tier 2 with a "reason carefully" prompt. The cascade never stalls: Tier 2 →
 *  Tier 1's own (still-uncertain) recommendation → the Tier-0 rule alone,
 *  whichever first hands back a usable call — and propose, clear to pay within
 *  authority, held for the owner on an overrun (the hard rail holds regardless
 *  of the brain). */
export function makePriceClerk(ctx) {
  const seat = 'lp-queue';
  const policy = ctx.brainFor(seat, 'approve-pay');
  return {
    seat,
    taskType: 'approve-pay',
    policy,
    label: `the ${seat} price clerk`,
    async run({ doc, now, taken, cap = 5 }) {
      const core = ctx.core;
      const events = [];
      const records = [];
      const acted = new Set(['proposed', 'approved', 'overridden', 'done']);
      const economy = economyFor(core, doc);
      const coin = core.coinCents;

      const targets = core
        .readFlows(doc.flows, doc.events, now)
        .filter(
          (r) =>
            r.template.key === FLOW_KEY &&
            r.status !== 'done' &&
            r.next &&
            r.next.step.holder === seat &&
            SETTLE_STEP_KEYS.has(r.next.step.key) &&
            !acted.has(r.next.kind) &&
            !taken.has(r.caseId),
        )
        .sort((a, b) => (a.openedAt ?? '').localeCompare(b.openedAt ?? ''));

      for (let i = 0; i < cap && i < targets.length; i++) {
        const r = targets[i];
        const at = now;
        const id = () => randomUUID();
        const params = core.paramsOf(doc.events, r.caseId);
        const trade = rosterTrade(params?.trade);
        // The authorization: the vendor clerk's quote from the record, else the
        // urgency-band estimate (a human-dispatched case with no clerk quote).
        const quoteCents = authorizedQuoteCents(doc, r.caseId) ?? core.estimateSpendCents(params?.urgency);
        const invoiceCents = invoiceFor(quoteCents, r.caseId);
        const recon = core.reconcileSpend(economy, quoteCents, invoiceCents, estateOf(core, doc, r.caseId));

        // The brain refines the within-ceiling case; the over-ceiling rail holds
        // regardless (no clerk waves through an unauthorized overrun). Tier 1
        // first — a clear invoice (or an obvious over-ceiling one) stops right
        // here, no escalation, no extra call, no extra spend.
        let resolved = null; // { recommend, why } once a brain tier lands one
        let how = 'rule';
        if (policy.tier > 0) {
          const t1 = await reasonPayment(ctx.complete, policy, {
            subject: r.subject,
            trade,
            authorizedCents: recon.authorizedCeilingCents,
            invoiceCents,
            coin,
          });
          if (!isLowPayConfidence(t1, recon)) {
            resolved = t1;
            how = 'brain t1';
          } else if (policy.escalate) {
            // Uncertain or borderline — hand it up to Tier 2, the deliberate
            // hand on the same Moonshot line. Take its answer if it parses a
            // valid recommendation; if the escalation call itself comes back
            // empty, fall to Tier 1's own (still-uncertain) call rather than
            // skip straight to the rule alone — the cascade folds one rail at
            // a time.
            const t2 = await reasonPayment(
              ctx.complete,
              policy.escalate,
              { subject: r.subject, trade, authorizedCents: recon.authorizedCeilingCents, invoiceCents, coin },
              { deliberate: true },
            );
            if (t2?.recommend) {
              resolved = t2;
              how = 'brain t2 ↑escalated';
            } else if (t1?.recommend) {
              resolved = t1;
              how = 'brain t1';
            }
          } else if (t1?.recommend) {
            // No escalation target on this policy — take Tier 1's uncertain
            // call over the rule; it still beat parsing nothing at all.
            resolved = t1;
            how = 'brain t1';
          }
        }

        const hold = recon.needsApproval || resolved?.recommend === 'hold';
        const because = resolved?.why ? ` (${resolved.why})` : '';

        const note = hold
          ? recon.needsApproval
            ? `${recon.note}${because}`
            : `${coin(invoiceCents)} invoice within the ${coin(recon.authorizedCeilingCents)} authorized ceiling, but held for the owner's review.${because}`
          : `${recon.note} Recommend approve & pay.${because}`;

        const verdict = hold ? 'hold-for-owner' : 'clear-to-pay';
        const proposal = core.proposeStep(r.template, r.caseId, r.next.index - 1, `agent:${seat}`, { at, id, note });
        if (!proposal) continue;
        // THE VERDICT GOES INTO THE RECORD, not only into the console.
        // `docs/WRIT-THE-GATE.md` finding 3: both branches used to call
        // proposeStep with identical arguments and differ only in `note`, so an
        // invoice that overran its authorized ceiling and one comfortably under
        // it were indistinguishable in the only thing that survives the run. A
        // reading can now tell them apart without parsing prose.
        proposal.params = {
          ...(proposal.params ?? {}),
          settlement: verdict,
          invoiceCents: String(invoiceCents),
          authorizedCeilingCents: String(recon.authorizedCeilingCents),
        };
        events.push(proposal);
        taken.add(r.caseId);
        records.push(
          `${r.template.title} "${r.subject}" → invoice ${coin(invoiceCents)} vs ${coin(recon.authorizedCeilingCents)} ceiling [${how}] — ${verdict}.`,
        );
      }
      return { events, records };
    },
  };
}

// ── The reasoning leasing clerk (osric, Tier 1 → Tier 2 on doubt) ────────────
// The third reasoning seat — the leasing side, the mirror of the vendor + price
// clerks on the money-out loop. Where an advance clerk (Tier 0) would just propose
// the templated step, the leasing clerk REASONS the rent at the leasing commitment:
// on a RENEWAL it weighs keeping a good tenant against the owner's return (hold,
// raise, or a concession) and prices the term; on a VACANT door it sets the re-list
// ask (market, a premium, or a concession to fill it faster). Then it reads the
// economy's leasing/renewal FEE RULE against that reasoned rent — so the Regent
// sees not just a price but the fee it earns the house. Pricing a lease against a
// tenant's reliability and the market is genuinely ambiguous (the same shape as
// intake's raw complaints), so this seat carries the SAME confidence-escalation as
// mabel/identify: Tier 1 (`kimi-k2.7-code-highspeed`) reasons first with its own
// honest confidence; low confidence — no valid move parsed, confidence under 0.6,
// or the move landed on the mode's safe default (a move that decides nothing) —
// escalates ONE hop to Tier 2 (`kimi-k2.7-code`, the same Moonshot line's more
// deliberate hand, never k3) with a "reason carefully" prompt. The cascade never
// stalls: Tier 2 → Tier 1's own uncertain pick → the Tier-0 default move,
// whichever first hands back a usable move. It STILL only proposes — the broker's
// countersignature and the human's Approve/Override ratchet are untouched (no
// clerk self-approves, KINGDOM.md).

/** Ask a brain to reason a leasing move, WITH its own honest confidence (0–1) —
 *  Tier 1's bread-and-butter pricing call, and Tier 2's escalation reuses the same
 *  shape with a more deliberate system prompt. Returns `{ moveKey, confidence,
 *  why }` (`moveKey`/`confidence` may be `null` when the reply doesn't parse) on a
 *  completed call, or `null` outright on a hard failure (network down, the call
 *  throws) — the caller's cascade absorbs both the same way. The move is
 *  constrained to the mode's menu, exactly as the vendor clerk constrains the
 *  vendor to the roster — the brain judges WHICH move, the harness owns the
 *  arithmetic and the fee. `deliberate` swaps in the Tier-2 system prompt ("reason
 *  carefully, this pricing is ambiguous") for the escalation call. */
async function reasonLease(complete, model, { subject, mode, currentCents, moves, coin }, { deliberate = false } = {}) {
  const menu = moves.map((m) => `- ${m.key} — ${m.label}`).join('\n');
  const frame =
    mode === 'vacancy'
      ? `A vacant door to re-list. Market rent for it is about ${coin(currentCents)}/mo.`
      : `A lease renewal at the T-90 window. The current rent is ${coin(currentCents)}/mo.`;
  const system = deliberate
    ? 'You are osric, a SENIOR property-management leasing broker. A junior clerk\'s first read on ' +
      'this pricing call came back uncertain, so it has been handed up to you — reason carefully, ' +
      "this door's pricing is genuinely ambiguous. Weigh the tenant's standing, the market, and the " +
      "owner's return before choosing; do not default to the safe no-judgment move unless nothing " +
      'else truly fits. Reply with ONLY a JSON object: {"move":"<exact key from the menu>",' +
      '"confidence":<0-1>,"why":"<one short clause>"}. Confidence is your own honest certainty that ' +
      "this is the single best move — don't inflate it."
    : 'You are osric, a property-management leasing broker. Given a door and its rent, choose the ' +
      'single best pricing move from the menu — weigh keeping a good tenant or filling a vacancy ' +
      'against the owner\'s return. Reply with ONLY a JSON object: {"move":"<exact key from the ' +
      'menu>","confidence":<0-1>,"why":"<one short clause>"}. Choose the single best-fitting move, ' +
      "and give your own honest confidence (0 to 1) that it's the right call — nothing else.";
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
    console.warn(`  leasing brain call failed (${err.message}); falling back${deliberate ? ' further' : ' to the rule'}.`);
  }
  return null;
}

/** The mode's safe DEFAULT move — the one that decides nothing (hold the rent on
 *  a renewal, list plain at market on a vacancy). The leasing equivalent of the
 *  intake clerk's generic catch-all leaf: a move that fits everything really
 *  fits nothing, and doubles as the Tier-0 fallback so the seat never stalls. */
function defaultMoveKey(mode) {
  return mode === 'vacancy' ? 'market' : 'raise-modest';
}

/** LOW confidence — the trigger for the leasing clerk's Tier-2 escalation (or,
 *  past escalation, for falling further down the cascade): no valid move parsed
 *  at all, OR the model's own confidence undercuts 0.6, OR it landed on the
 *  mode's safe default move. */
function isLeaseLowConfidence(result, mode) {
  if (!result || !result.moveKey) return true;
  if (result.confidence == null || result.confidence < 0.6) return true;
  if (result.moveKey === defaultMoveKey(mode)) return true;
  return false;
}

/** The osric reasoning leasing clerk: find live cascades standing at a leasing
 *  commitment (`price` in lease-renewal / `list-unit` in the move-out relay) on
 *  osric, reason a pricing move — deepened with CONFIDENCE-ESCALATION, the same
 *  shape as the intake clerk: Tier 1 (`kimi-k2.7-code-highspeed`) reads the door
 *  first; a clear case resolves right there. An uncertain one (no valid move
 *  parsed, confidence under 0.6, or the safe default move) escalates ONE time to
 *  Tier 2 (`kimi-k2.7-code`, the same Moonshot line's more deliberate hand — never
 *  k3) with a "reason carefully" prompt. The cascade never stalls: Tier 2 → Tier
 *  1's own (still-uncertain) answer → the Tier-0 default move, whichever first
 *  hands back a usable move — then read the economy's matching fee rule against
 *  the reasoned rent, and propose, showing the Regent the term, the rent, and
 *  the fee it earns. */
export function makeLeasingClerk(ctx) {
  const seat = 'osric';
  const policy = ctx.brainFor(seat, 'price-lease');
  return {
    seat,
    taskType: 'price-lease',
    policy,
    label: `the ${seat} leasing clerk`,
    async run({ doc, now, taken, cap = 5 }) {
      const core = ctx.core;
      const events = [];
      const records = [];
      const acted = new Set(['proposed', 'approved', 'overridden', 'done']);
      const economy = economyFor(core, doc);
      const coin = core.coinCents;

      const targets = core
        .readFlows(doc.flows, doc.events, now)
        .filter((r) => {
          const commit = LEASE_COMMITMENTS[r.template.key];
          return (
            commit &&
            r.status !== 'done' &&
            r.next &&
            r.next.step.holder === seat &&
            commit.stepKeys.includes(r.next.step.key) &&
            !acted.has(r.next.kind) &&
            !taken.has(r.caseId)
          );
        })
        .sort((a, b) => (a.openedAt ?? '').localeCompare(b.openedAt ?? '')); // oldest first

      for (let i = 0; i < cap && i < targets.length; i++) {
        const r = targets[i];
        const commit = LEASE_COMMITMENTS[r.template.key];
        const at = now;
        const id = () => randomUUID();
        const moves = movesFor(commit.mode);
        // The rent to reason from: a renewal raises from the door's standing rent;
        // a vacancy re-lists around the door's market rent. Both working-fluid.
        const currentCents = baseRentCents(r.caseId);

        // Tier 1 first (the seat's base brain, unchanged). A clear case stops
        // right here — no escalation, no extra call, no extra spend.
        let resolved = null; // { moveKey, why } once a brain tier lands one
        let how = 'default';
        if (policy.tier > 0) {
          const t1 = await reasonLease(ctx.complete, policy, {
            subject: r.subject,
            mode: commit.mode,
            currentCents,
            moves,
            coin,
          });
          if (!isLeaseLowConfidence(t1, commit.mode)) {
            resolved = t1;
            how = 'brain t1';
          } else if (policy.escalate) {
            // Ambiguous — hand it up to Tier 2, the deliberate hand on the same
            // Moonshot line. Take its answer if it parses a valid move; if the
            // escalation call itself comes back empty, fall to Tier 1's own
            // (still-uncertain) pick rather than skip straight to the default —
            // the cascade folds one rail at a time.
            const t2 = await reasonLease(
              ctx.complete,
              policy.escalate,
              { subject: r.subject, mode: commit.mode, currentCents, moves, coin },
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

        // Tier-0 fallback: the sensible default so the seat never stalls — a modest
        // raise on a renewal, list at market on a vacancy.
        const move = moveByKey(commit.mode, resolved?.moveKey) ?? moveByKey(commit.mode, defaultMoveKey(commit.mode));

        const rentCents = applyMove(currentCents, move);
        // The case's estate lets a per-estate fee rule govern where the loaded
        // setting names one; absent, `feeRuleFor` reads the house rule as ever.
        const feeRule = core.feeRuleFor(economy, commit.feeKind, estateOf(core, doc, r.caseId));
        const feeCents = feeRule ? core.feeAmount(feeRule, rentCents) : 0;
        const because = resolved?.why ? ` (${resolved.why})` : '';

        let note;
        if (commit.mode === 'vacancy') {
          note = `List the vacant door at ${coin(rentCents)}/mo — ${move.label}; a signed lease earns a ${coin(feeCents)} leasing fee.${because}`;
        } else {
          const delta = rentCents - currentCents;
          const dir =
            delta > 0
              ? `raise to ${coin(rentCents)}/mo (from ${coin(currentCents)})`
              : delta < 0
                ? `a concession to ${coin(rentCents)}/mo (from ${coin(currentCents)})`
                : `hold at ${coin(rentCents)}/mo`;
          note = `Renew the lease — ${dir}; the renewal earns a ${coin(feeCents)} fee.${because}`;
        }

        const proposal = core.proposeStep(r.template, r.caseId, r.next.index - 1, `agent:${seat}`, { at, id, note });
        if (!proposal) continue;
        events.push(proposal);
        taken.add(r.caseId);
        records.push(
          `${r.template.title} "${r.subject}" → ${move.label} @ ${coin(rentCents)}/mo [${how}] — ${coin(feeCents)} ${commit.feeKind} fee.`,
        );
      }
      return { events, records };
    },
  };
}

/** A general ADVANCE clerk for one seat (Tier 0, no brain): find live cascades
 *  whose step-in-hand sits on this seat and has not yet been acted on, and
 *  propose that step (`agent:<seat>`) so the Regent ratifies. Flow-agnostic —
 *  it works on any grammar the setting loaded, which is exactly what "an agent
 *  on every seat" means. Deterministic: the proposal is the template's own step,
 *  no reasoning needed (the doctrine's Tier-0 lane). */
export function makeAdvanceClerk(ctx, seat) {
  const policy = ctx.brainFor(seat, 'advance');
  return {
    seat,
    taskType: 'advance',
    policy,
    label: `the ${seat} clerk`,
    async run({ doc, now, taken, cap = 5 }) {
      const core = ctx.core;
      const events = [];
      const records = [];
      const acted = new Set(['proposed', 'approved', 'overridden', 'done']);
      const targets = core
        .readFlows(doc.flows, doc.events, now)
        .filter(
          (r) =>
            r.status !== 'done' &&
            r.next &&
            r.next.step.holder === seat &&
            !acted.has(r.next.kind) &&
            !taken.has(r.caseId),
        )
        .sort((a, b) => (a.openedAt ?? '').localeCompare(b.openedAt ?? '')); // oldest first

      // The book's own claim about which steps need no person. `mode` lives on
      // the CATALOG ROW, so this map is the lookup `mayRunUnattended` wants.
      const modeOf = new Map((doc.catalog ?? []).map((row) => [row.key, row.mode]));

      // THE SWEEP RUNS ONLY AGAINST AN AUDITED BOOK.
      //
      // `mode: 'auto'` is a claim, and the claim is only as good as the hand that
      // wrote it. The FOUNDING books were read step by step before the sweep was
      // switched on. The grand muster's loaded library was not: `deployGrand`
      // swaps in a ~160-step book whose `mode` was authored to mean "a PM shop
      // could in principle automate this", which is NOT a grant of authority to
      // assert the work happened. Left ungated, this clerk was measured
      // completing — unattended, on that book — a statutory deposit disposition
      // and refund, a late-fee assessment, a rent posting, and a SHOWING, which
      // asserts a physical event occurred that nobody observed.
      //
      // `awaitsOutside` cannot catch those: none of them carries a condition, a
      // repeat or a window. Nothing structural distinguishes them. The only
      // honest guard is provenance — so the sweep is refused on any book this
      // repository has not read, and such a book falls back to proposing, which
      // is exactly the old behaviour and safe by construction.
      //
      // To widen it: audit the loaded book's `auto` rows one at a time, the way
      // the founding thirteen were, and say so here. Do not relax the check.
      const audited =
        typeof core.flowsAtFounding === 'function' &&
        typeof core.catalogAtFounding === 'function' &&
        core.flowsAtFounding(doc.flows) &&
        core.catalogAtFounding(doc.catalog);

      for (let i = 0; i < cap && i < targets.length; i++) {
        const r = targets[i];
        const at = now;
        const id = () => randomUUID();
        const params = core.paramsOf(doc.events, r.caseId);

        // ── The auto sweep ────────────────────────────────────────────────
        // If the book says this step needs no person, DO IT — do not park it on
        // the Regent's desk. Proposing an `auto` step was the fleet's own worst
        // habit: `proposed` counts as a human touch, so every one of them booked
        // an UNPLANNED ESCAPE against the one number the product is judged by,
        // while adding a click nobody had asked for. A clock over a fleet that
        // only proposes piles up; it does not progress.
        //
        // The sweep runs on while the NEXT step is also unattendable and also
        // this seat's — consecutive auto runs exist (an offer drafted then sent;
        // a report filed then the door opened) and stopping between them would
        // leave a cascade parked mid-stride for no reason. It stops at a seat
        // boundary by design: a clerk works its own desk, and the neighbouring
        // desk's clerk takes it from there.
        if (audited && core.mayRunUnattended(r.next.step, modeOf)) {
          let index = r.next.index - 1;
          const ran = [];
          while (index < r.template.steps.length) {
            const s = r.template.steps[index];
            if (s.holder !== seat || !core.mayRunUnattended(s, modeOf)) break;
            const done = stampAgentActor(core.completeStep(r.template, r.caseId, index, { at, id, log: [...doc.events, ...events] }, params), seat);
            if (!done.length) break;
            events.push(...done);
            // Name the STEP. All eight vendor-dispatch steps share one catalog
            // row, so a line built from the row title alone repeats the same
            // words for every step swept and says nothing about what ran.
            const title = core.titleOf(doc.catalog, s.catalogRow);
            ran.push(title && title !== s.key ? `${s.key} (${title})` : s.key);
            index += 1;
          }
          if (ran.length) {
            taken.add(r.caseId);
            records.push(
              `${r.template.title} "${r.subject}" → ran ${ran.length} step(s) unattended: ${ran.join(' → ')}.`,
            );
            continue;
          }
        }

        // ── Otherwise: propose, and stop ──────────────────────────────────
        // A judgment, or a step waiting on something outside the machine's
        // sight. Either way the Regent's word is next, and no clerk crosses the
        // ratchet.
        const step = r.next.step;
        const what = core.titleOf(doc.catalog, step.catalogRow) || step.key;
        const gate = spendGateFor(core, doc, r.template, r.next.index - 1, params, estateOf(core, doc, r.caseId));
        // Say WHICH of the two reasons parked it — a judgment the book means to
        // stop at reads very differently from an `auto` step held back because it
        // waits on an answer nobody here can give.
        const why = core.awaitsOutside(step) ? ' — it waits on an answer from outside' : '';
        const proposal = core.proposeStep(r.template, r.caseId, r.next.index - 1, `agent:${seat}`, {
          at,
          id,
          note: `Propose to advance ${what} on the ${step.board} board — awaiting the Regent's word${why}.${gate ? ` ${gate.note}` : ''}`,
        });
        if (!proposal) continue;
        events.push(proposal);
        taken.add(r.caseId);
        records.push(
          `${r.template.title} "${r.subject}" → proposed ${what} (step ${r.next.index}/${r.steps.length})${gate ? ` — ${gate.disposition}` : ''}.`,
        );
      }
      return { events, records };
    },
  };
}
