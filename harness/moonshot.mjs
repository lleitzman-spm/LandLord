// The brain's mouth: one call to Moonshot's OpenAI-compatible chat endpoint,
// with the quirks K3 taught us the hard way — written down so no one relearns
// them:
//
//   - The kimi reasoners pin `temperature` to 1 — not just k3, but the cheaper
//     kimi-k2.* code models too ("invalid temperature: only 1 is allowed for
//     this model", verified 2026-07-20). So `complete` omits temperature unless
//     a caller sets one, and if the model refuses over temperature it retries
//     pinned to 1 — no caller needs to know which models are strict.
//   - kimi-k3 is a heavy reasoner. It spends a large share of its token budget
//     *thinking* (see usage.completion_tokens_details.reasoning_tokens) before
//     it emits a single visible word. A small max_tokens comes back with empty
//     content — the reasoning ate the whole budget. So budgets must be generous;
//     we default high, and callers doing real work should go higher still.
//
// Returns the assistant message (content plus any tool_calls), why it stopped,
// and the usage — the caller decides what to do with each.

import { config, requireKey } from './config.mjs';
import { guardComplete } from '../src/domain/contextGuard.mjs';

async function providerComplete({ messages, tools, maxTokens = 8192, temperature, model, signal, effort } = {}) {
  requireKey();

  // The model: config's by default (the K3 builder), or a caller's override —
  // the swing-four operator names its own cheap brain, keeping K3 for building.
  const useModel = model || config.model;

  // Temperature is a per-model quirk on Moonshot, not just k3's: k3 refuses any
  // value but 1, and the cheaper kimi reasoners (kimi-k2.7-code-highspeed, the
  // swing-four operator's brain) do the SAME ("invalid temperature: only 1 is
  // allowed for this model") — verified this session, correcting the writ's
  // guess that a smaller model takes a normal temp. So: honor a caller's
  // temperature if given; else pin k3 to 1 (its known hard rule — no wasted
  // round-trip on the builder's hot path); else omit it and let the model use
  // its own default. And as a safety net, if ANY model refuses OVER temperature,
  // transparently retry pinned to 1 — no caller need know which models are strict.
  const isK3 = /(^|[^\w])k3([^\w]|$)/i.test(useModel);
  const body = {
    model: useModel,
    messages,
    // CLAUDE.md, "The megamind": never the default max — at max K3 wanders the
    // endless corridor and does not return. `high` remains the default for the
    // BUILDER, which is what that rule was written about.
    //
    // But it was applied to every call, including a clerk picking one key from a
    // five-item menu, and the meter showed the bill: 95.8% of output tokens were
    // reasoning tokens. We were paying for deliberation and receiving a menu
    // choice. Callers now name their own effort; the doctrine sets it per seat.
    //
    // MEASURED on kimi-k2.7-code-highspeed, same 3-item menu prompt, 5 samples
    // each. Reasoning tokens per reply, as summary statistics — the raw sample
    // list is left out on purpose, because a bare run of three- and four-digit
    // numbers reads exactly like a telephone number to every credential scanner
    // ever written, and a comment is not worth a false positive on every scan:
    //   low   mean 293, min 220, max 405,  spread 185
    //   high  mean 442, min 109, max 1044, spread 935
    // `low` is a third cheaper on average and FIVE TIMES more predictable —
    // the tail is the real win, because `high` will occasionally spend a
    // thousand reasoning tokens picking one of three keys.
    //
    // DO NOT USE 'medium'. It ran away on the first try: 2047 reasoning tokens
    // against a 2048 cap, emitting no answer at all — the empty-response failure
    // this file's header warns about, reached by a knob rather than by max_tokens.
    // Same class of trap as CLAUDE.md's rule against `max`, and now measured.
    //
    // AND THE OBVIOUS FIX MAKES IT WORSE, measured on the full fleet: raising
    // the clerks' completion cap 2048 → 4096 did NOT stop the runaways (still
    // ~2 of 26 calls), it only let them burn 4,352 tokens instead of 2,305 —
    // run cost +21%, ceiling 1.65× → 1.94×. The model fills whatever budget it
    // is given. The cap is not the problem; keep it small so the failure is
    // cheap, and rely on the clerk's deterministic fallback, which is what it
    // is for. What was actually wrong was that the fallback was INVISIBLE — the
    // meter counts it now.
    reasoning_effort: effort ?? 'high',
    max_tokens: maxTokens,
  };
  if (temperature != null) body.temperature = temperature;
  else if (isK3) body.temperature = 1;
  if (tools && tools.length) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const once = (b) =>
    fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(b),
      signal,
    });

  // The line drops. Twice in one session a Realm-Map build died mid-run on a
  // bare `fetch failed` — once after writing two of five files, once before
  // writing anything — and took the whole agent run down with it, hours of
  // context and every file it had reasoned about, gone. A big-context call at
  // high reasoning effort sits silent for minutes before its first byte, which
  // is exactly the shape of request a proxy or a load balancer severs.
  //
  // A dropped socket is not an answer, so it is not treated as one: a transport
  // failure (or a 429 / 5xx, which are the server saying "not now") is retried
  // with a widening pause. A refusal WITH a verdict — a 4xx that means the
  // request itself is wrong — is never retried; it would only be refused again.
  const post = async (b) => {
    let lastErr = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) {
        const pause = 2000 * 2 ** (attempt - 1); // 2s, 4s, 8s
        console.error(`  [moonshot] the line dropped — retrying in ${pause / 1000}s`);
        await new Promise((r) => setTimeout(r, pause));
      }
      try {
        const res = await once(b);
        // The server saying "not now" — worth asking again.
        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error(`Moonshot answered ${res.status}`);
          continue;
        }
        return res;
      } catch (err) {
        // A severed connection, a DNS blip, a proxy hang-up. Never a verdict.
        if (signal?.aborted) throw err;
        lastErr = err;
      }
    }
    throw lastErr ?? new Error('Moonshot unreachable');
  };

  let res = await post(body);
  let text = await res.text();
  // The one known-recoverable refusal: this model pins temperature to 1. Retry
  // once with it pinned, so no caller has to know which models are strict.
  if (!res.ok && /temperature/i.test(text) && body.temperature !== 1) {
    res = await post({ ...body, temperature: 1 });
    text = await res.text();
  }
  if (!res.ok) {
    throw new Error(`Moonshot refused (${res.status}): ${text.slice(0, 600)}`);
  }

  const data = JSON.parse(text);
  const choice = data.choices?.[0] ?? {};
  return {
    message: choice.message ?? { role: 'assistant', content: '' },
    finishReason: choice.finish_reason,
    usage: data.usage,
  };
}

/** Construct a guarded client. The raw provider transport is intentionally not
 *  exported, so the harness and Vite fleet cannot wire around the boundary. */
export function makeComplete({ onBlocked } = {}) {
  return guardComplete(providerComplete, { onBlocked });
}

export const complete = makeComplete();
