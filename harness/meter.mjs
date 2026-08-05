/**
 * The fleet's cost meter — what each seat actually spends.
 *
 * Until now model spend was invisible until the invoice: the harness knew how
 * many proposals it produced and nothing about what they cost. a firm's
 * AGENT-ENVIRONMENT.md names the same hole from its side ("no per-seat cost
 * meter at all"), so this is the answer for both — the run log the console's
 * cost-per-seat surface will read.
 *
 * Wrap the brain once; every clerk's call is counted against whatever seat is
 * currently on the floor.
 *
 *   const meter = makeMeter(complete);
 *   await runFleet({ ..., complete: meter.complete });
 *   meter.report();
 *
 * Prices are per MILLION tokens, USD, and are DECLARED HERE rather than
 * fetched — they are a rate card that moves, so treat the dollar figure as an
 * estimate and the token counts as measured fact. A wrong price still gives a
 * correct token count, which is the number that actually drives the decision.
 */

/** Moonshot list prices, USD per 1M tokens (checked 2026-07-28). */
const RATES = {
  'kimi-k2.7-code-highspeed': { in: 0.15, out: 2.5 },
  'kimi-k2.7-code': { in: 0.6, out: 2.5 },
  'kimi-k3': { in: 0.6, out: 2.5 },
};
const FALLBACK = { in: 0.6, out: 2.5 };

export function makeMeter(complete) {
  /** seat → { calls, in, out, reasoning, byModel, samples } — `samples` holds
   *  every individual call's output tokens, because the TAIL is the number that
   *  matters and a running total destroys it. */
  const seats = new Map();
  let current = '(unattributed)';

  const bucket = (seat) => {
    if (!seats.has(seat))
      seats.set(seat, { calls: 0, in: 0, out: 0, reasoning: 0, byModel: new Map(), samples: [], capped: 0 });
    return seats.get(seat);
  };

  return {
    /** Name the seat whose calls follow. The fleet runs clerks in turn, so a
     *  simple "current seat" marker attributes correctly without threading a
     *  context through every clerk. */
    seat(name) {
      current = name;
    },

    async complete(opts) {
      const res = await complete(opts);
      const u = res?.usage;
      if (u) {
        const b = bucket(current);
        b.calls++;
        b.in += u.prompt_tokens ?? 0;
        b.out += u.completion_tokens ?? 0;
        b.reasoning += u.completion_tokens_details?.reasoning_tokens ?? 0;
        b.samples.push((u.prompt_tokens ?? 0) + (u.completion_tokens ?? 0));
        // A call that spends its whole completion budget on reasoning emits no
        // answer, and the clerk silently falls back to its Tier-0 rule. That is
        // not just cost — it is a QUALITY failure that looks like success in
        // every other number here, so count it.
        const cap = Number(opts?.maxTokens ?? 0);
        if (cap && (u.completion_tokens ?? 0) >= cap) b.capped = (b.capped ?? 0) + 1;
        const m = opts?.model ?? '(default)';
        b.byModel.set(m, (b.byModel.get(m) ?? 0) + 1);
      }
      return res;
    },

    /** Nearest-rank percentile over observed per-call totals. */
    pct(samples, p) {
      if (!samples.length) return 0;
      const s = [...samples].sort((a, b) => a - b);
      return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
    },

    totals() {
      let calls = 0, tin = 0, tout = 0, reasoning = 0, usd = 0;
      for (const [, b] of seats) {
        calls += b.calls; tin += b.in; tout += b.out; reasoning += b.reasoning;
        // Price each seat by whichever model it actually called most.
        const model = [...b.byModel.entries()].sort((a, c) => c[1] - a[1])[0]?.[0];
        const rate = RATES[model] ?? FALLBACK;
        usd += (b.in / 1e6) * rate.in + (b.out / 1e6) * rate.out;
      }
      return { calls, in: tin, out: tout, reasoning, usd };
    },

    report(proposals = 0) {
      const pad = (s, n) => String(s).padEnd(n);
      const num = (n) => n.toLocaleString('en-US');
      console.log('\ncost meter — measured tokens, estimated dollars\n');
      console.log(
        `${pad('seat', 26)} ${pad('calls', 6)} ${pad('in', 8)} ${pad('out', 7)} ${pad('think', 7)} ` +
          `${pad('med', 6)} ${pad('worst', 6)} model`,
      );
      for (const [seat, b] of [...seats].sort((a, c) => c[1].out - a[1].out)) {
        const model = [...b.byModel.entries()].sort((a, c) => c[1] - a[1])[0]?.[0] ?? '—';
        const worst = Math.max(0, ...b.samples);
        console.log(
          `${pad(seat, 26)} ${pad(b.calls, 6)} ${pad(num(b.in), 8)} ${pad(num(b.out), 7)} ` +
            `${pad(num(b.reasoning), 7)} ${pad(num(this.pct(b.samples, 50)), 6)} ${pad(num(worst), 6)} ${model}`,
        );
      }
      const t = this.totals();
      console.log(
        `\n${pad('TOTAL', 26)} ${pad(t.calls, 6)} ${pad(num(t.in), 9)} ${pad(num(t.out), 8)} ${pad(num(t.reasoning), 9)}`,
      );

      // ── The tail, which is the number an unattended run actually needs ──
      //
      // A mean hides exactly the thing that hurts a cron nobody is watching:
      // one bad hour with a fat right tail can spend a month's budget while the
      // average still looks fine. Same shape as the liveness argument — an
      // average tells you nothing about whether the thing stopped.
      //
      // So: per-call spread, and a CEILING for the pass built from each seat's
      // p95 rather than its mean. That is the figure to set a budget against.
      const all = [];
      for (const [, b] of seats) all.push(...b.samples);
      let ceilingTokens = 0;
      for (const [, b] of seats) ceilingTokens += this.pct(b.samples, 95) * b.calls;
      const ratio = t.in + t.out > 0 ? ceilingTokens / (t.in + t.out) : 1;

      let capped = 0;
      for (const [, b] of seats) capped += b.capped ?? 0;
      if (capped) {
        console.log(
          `\n⚠ ${capped} of ${t.calls} call(s) SPENT THE WHOLE COMPLETION BUDGET ON REASONING ` +
            'and returned no answer — those seats fell back to their Tier-0 rule. ' +
            'Silent degradation: every other number here still looks fine.',
        );
      }
      console.log('\nper-call spread (tokens): ' +
        `median ${num(this.pct(all, 50))} · p95 ${num(this.pct(all, 95))} · max ${num(Math.max(0, ...all))}`);
      console.log(`this run: ${num(t.in + t.out)} tokens ≈ $${t.usd.toFixed(4)}`);
      if (proposals) {
        console.log(`per proposal: ${Math.round((t.in + t.out) / proposals)} tokens ≈ $${(t.usd / proposals).toFixed(5)}`);
      }
      console.log(
        `CEILING (every seat at its p95): ≈ ${num(Math.round(ceilingTokens))} tokens ` +
          `≈ $${(t.usd * ratio).toFixed(4)} — ${ratio.toFixed(2)}× this run`,
      );
      console.log(
        `if run hourly: ≈ $${(t.usd * 24).toFixed(2)}/day typical · ` +
          `$${(t.usd * ratio * 24).toFixed(2)}/day at the ceiling · ` +
          `$${(t.usd * ratio * 24 * 30).toFixed(2)}/month at the ceiling`,
      );
      console.log('(token counts are measured; dollars use the rate card in harness/meter.mjs)');
    },
  };
}
