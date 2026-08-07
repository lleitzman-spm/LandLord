// THE ESCAPE RATE — what fraction of work reaches a human.
//
// WHY THIS EXISTS. The bar this product is built against is one operator running a
// portfolio that today takes a firm. The arithmetic is unforgiving: at ~21 hours per
// door per year, ten thousand doors is 210,000 hours against one person's ~2,000. So
// roughly 99% of the hours must never reach a human, which leaves a few minutes of
// human attention per door per year.
//
// The escape rate is the one number that says whether that is happening, and it has
// the property that makes a KPI dangerous: it is invisible when it is worst. A firm
// at 1% escaping and a firm at 5% look identical on every other instrument — same
// flows, same boards, same cases closing — and the second one has an operator who is
// the bottleneck. Nothing in this codebase measured it.
//
// IT IS A READING, NOT A STORED SCORE. Computed from the event log every time it is
// asked for, like every other reading here. There is no escape counter to drift.
//
// TWO KINDS OF ESCAPE, AND THE DIFFERENCE IS THE POINT
//
//   · A DESIGNED escape is a step the flow book means to be human. The violation
//     call, the rent call, a signature. These are not failures — the flows exist to
//     stop at judgments they must never cross — but they are not free either. They
//     spend the same scarce minutes, and a design that budgets most of its steps to
//     a person has set its own ceiling long before anything goes wrong.
//
//   · An UNPLANNED escape is a human touching a step the catalog marks `auto`. That
//     is the machine failing to do a job it claimed. This is the number to drive
//     down, and it is the one that hides inside a healthy-looking total.
//
// A total that mixes them tells you the operator is busy and not why. Reported apart,
// they tell you whether to redesign the flow or fix the automation.
//
// WHAT IT REFUSES TO DO
//   · It sets no target. There is no "good" escape rate in this file, because
//     inventing a completion criterion is how a measure stops being falsifiable. The
//     reading reports; a human decides what is acceptable.
//   · A step whose catalog row carries no `mode` is NOT MEASURED, and an unmeasured
//     step never joins a total. "Nothing there" and "not measured" are different
//     readings and must look different — a denominator quietly padded with unknowns
//     is how a rate flatters itself.
//
// WHAT IT CANNOT SEE, AND WHY IT DOES NOT GUESS
//
// REWORK, PARTLY RESOLVED — read this, it changed. A step still counts ONCE
// however many times it was worked, because the unit here is a step reached,
// not an event. What has changed is that the escapes among those repeats are no
// longer invisible.
//
// The old note here said the fix was blocked: counting rework meant deciding a
// `failed` event implies a person, and nothing in the engine said so, so
// assuming it would have put a guess inside the one number the product is
// judged against. That was the right call and it is now moot, because the book
// says it outright. A failure route declares `endsAt` — `origin` (back to the
// party who erred) or `operator` (up to the one human). A `failed` event on a
// step whose route ends at the operator IS a person's attention, by
// declaration, not by inference. `escalated` below counts those.
//
// WHAT IS STILL NOT COUNTED, PRECISELY. A failure that ends at `origin` costs
// the operator the chase and nothing here measures the chase. And `escalated`
// is deliberately NOT folded into `rate`: the rate's denominator is steps
// reached, and an escalation is an event on a step already counted, so adding it
// to the numerator would let a rate exceed 1 — which is not a bug to clamp but a
// sign the two are different measures. They are reported side by side. A single
// number that mixed "how much of the work is human" with "how often it went
// wrong" would answer neither question.

import type { KingdomEvent } from './events';
import type { CatalogRow } from './catalog';
import type { FlowBook } from './flows';

/** The events that mean a person was actually in the loop. `awaiting` is NOT here:
 *  the engine raises it for anything with a wait, a calendar window, a loop or a
 *  condition, so it means "parked on a clock" far more often than "parked on a
 *  person", and counting it would inflate every reading below. */
const HUMAN_TOUCH = new Set(['proposed', 'approved', 'overridden']);

export interface EscapeLine {
  /** The step, flow or holder this line is about. */
  key: string;
  reached: number;
  designed: number;
  unplanned: number;
  /** Steps whose catalog row declares no mode — reported, never totalled. */
  unmeasured: number;
}

export interface EscapeReading {
  /** Distinct steps the cascade actually got to. A step never reached cannot
   *  escape, and counting it would make an idle system look automated. */
  stepsReached: number;
  /** Reached steps the flow book MEANS to be human. */
  designed: number;
  /** Reached steps the catalog marks `auto` that a human touched anyway. */
  unplanned: number;
  /** designed + unplanned. */
  escaped: number;
  /** escaped / stepsReached, as a fraction — or null when nothing has been
   *  reached yet. Null is not zero: a rate over no work is not a good rate. */
  rate: number | null;
  /** Steps whose catalog row declares no mode. Excluded from every total above. */
  unmeasured: number;
  /** FAILURES THAT REACHED THE ONE OPERATOR — the escape count, as distinct
   *  from the escape rate above.
   *
   *  Counted per `failed` event, NOT per step, and that is the point: this is
   *  the one place rework is visible. A step that failed three times and was
   *  escalated each time cost three slices of the operator's day and reads as 3
   *  here, while `stepsReached` still counts it once.
   *
   *  It rests on a declaration, never a guess: only a `failed` event on a step
   *  whose `onFail.endsAt` is `operator` counts. A failure routed back to the
   *  party who erred costs the operator the chase, which nothing here measures,
   *  and it is not counted as an escape because it is not one. */
  escalated: number;
  byFlow: EscapeLine[];
  byStep: EscapeLine[];
  byHolder: EscapeLine[];
  /** HOW MANY INDEPENDENT JUDGMENTS THIS READING IS ACTUALLY BUILT ON.
   *
   *  `mode` lives on the catalog ROW, not on the step, so several steps pointing at
   *  one row inherit a single authoring decision. The whole vendor-dispatch cascade
   *  — report, identify, assign, dispatch, invoice, confirm, pay, post — points at
   *  one row, `work-order`. Eight steps, one judgment.
   *
   *  A rate quoted over steps therefore overstates its own evidence, and a reading
   *  that did not say so would be the same failure as a denominator padded with
   *  unknowns. `judgments` is the honest denominator; `inheritedSteps` is how many
   *  steps got their mode from a row they share with another. */
  judgments: number;
  inheritedSteps: number;
}

const blank = (key: string): EscapeLine => ({ key, reached: 0, designed: 0, unplanned: 0, unmeasured: 0 });

function bump(m: Map<string, EscapeLine>, key: string, field: keyof Omit<EscapeLine, 'key'>): void {
  if (!key) return;
  if (!m.has(key)) m.set(key, blank(key));
  const line = m.get(key) as EscapeLine;
  line[field] += 1;
}

const sorted = (m: Map<string, EscapeLine>): EscapeLine[] =>
  [...m.values()].sort((a, b) => b.unplanned - a.unplanned || b.designed - a.designed || a.key.localeCompare(b.key));

/** Read the escape rate over a log.
 *
 *  `catalog` decides whether a step is meant to be human; `flows` maps a catalog row
 *  back to the flow it belongs to, so a leak can be named per flow rather than only
 *  in aggregate. A total tells you there is a problem; `byStep` tells you where. */
export function readEscape(
  flows: FlowBook,
  catalog: CatalogRow[],
  log: KingdomEvent[],
  /** The standing muster's seed, or null/omitted for the whole book.
   *
   *  WHY THIS EXISTS. Unscoped, this reading mixed a war game's cases with every
   *  pre-muster and hand-worked case in the chronicle — so the one number the
   *  product is judged against was measuring two populations at once and calling
   *  the average an operation's escape rate.
   *
   *  Optional and trailing on purpose: the unscoped reading is still a real
   *  reading (a deployment with no game has only the one population), and every
   *  existing caller keeps compiling. `readDesignedCeiling` takes no log at all
   *  and is structurally incapable of being affected. */
  seed?: string | null,
): EscapeReading {
  const modeOf = new Map(catalog.map((r) => [r.key, r.mode]));
  const flowOfRow = new Map<string, string>();
  for (const t of flows) for (const s of t.steps) if (!flowOfRow.has(s.catalogRow)) flowOfRow.set(s.catalogRow, t.key);

  // Which catalog rows carry a failure route that comes to rest on the operator.
  // Keyed by row because that is what a `failed` event names — the same join the
  // rest of this reading uses. A row reached from two flows where only one
  // escalates would over-count here; the book has no such row today, and the
  // honest fix if it ever gets one is to record the flow on the event, not to
  // guess which route was in force.
  const escalatingRow = new Set<string>();
  for (const t of flows) for (const s of t.steps) if (s.onFail?.endsAt === 'operator') escalatingRow.add(s.catalogRow);
  // The muster's own cases, or the whole book. The mark is `wg/<seed> · ` and it
  // is matched with INCLUDES, never startsWith: `instantiateFlow` names a flow
  // case `<template>: <subject>`, so a war relay carries the mark INFIXED
  // (`move-out-relay: wg/s1 · …`). A startsWith here would score zero flow cases
  // — precisely the ones this reading measures — and would fail silently, as a
  // rate of `null` reads like "nothing has happened yet" rather than like a bug.
  //
  // The literal mirrors `consequences.ts`'s `severities()` rather than importing
  // `WAR_MARK`, deliberately: this module's three imports are all `import type`,
  // so it carries no runtime dependency at all, and pulling in the whole
  // proving-ground module for one three-character constant would trade that away.
  // If the mark ever changes, it changes in both places — they are named here so
  // the pair is findable.
  const mark = seed ? `wg/${seed} · ` : null;
  const scoped = mark ? log.filter((e) => e.caseId.includes(mark)) : log;

  let escalated = 0;
  for (const e of scoped) if (e.kind === 'failed' && e.catalogRow && escalatingRow.has(e.catalogRow)) escalated += 1;

  // One entry per (case, step). A step worked over five events is one step reached,
  // not five — otherwise a chatty step outweighs a costly one.
  interface Seen {
    row: string;
    holder: string;
    touched: boolean;
  }
  const seen = new Map<string, Seen>();
  for (const e of scoped) {
    if (!e.catalogRow || e.kind === 'opened') continue;
    const id = `${e.caseId} ${e.catalogRow}`;
    const prev = seen.get(id);
    const touched = HUMAN_TOUCH.has(e.kind);
    if (prev) {
      if (touched) prev.touched = true;
      if (e.holder) prev.holder = e.holder;
    } else {
      seen.set(id, { row: e.catalogRow, holder: e.holder ?? '', touched });
    }
  }

  const byFlow = new Map<string, EscapeLine>();
  const byStep = new Map<string, EscapeLine>();
  const byHolder = new Map<string, EscapeLine>();
  let stepsReached = 0;
  let designed = 0;
  let unplanned = 0;
  let unmeasured = 0;

  for (const s of seen.values()) {
    const mode = modeOf.get(s.row);
    const flow = flowOfRow.get(s.row) ?? '(no flow declares this row)';
    if (mode !== 'auto' && mode !== 'human') {
      // Not measured, and it does not join a denominator. Reported so the gap has a
      // size rather than silently improving every rate on the page.
      unmeasured += 1;
      bump(byFlow, flow, 'unmeasured');
      bump(byStep, s.row, 'unmeasured');
      if (s.holder) bump(byHolder, s.holder, 'unmeasured');
      continue;
    }
    stepsReached += 1;
    bump(byFlow, flow, 'reached');
    bump(byStep, s.row, 'reached');
    if (s.holder) bump(byHolder, s.holder, 'reached');

    if (mode === 'human') {
      designed += 1;
      bump(byFlow, flow, 'designed');
      bump(byStep, s.row, 'designed');
      if (s.holder) bump(byHolder, s.holder, 'designed');
    } else if (s.touched) {
      unplanned += 1;
      bump(byFlow, flow, 'unplanned');
      bump(byStep, s.row, 'unplanned');
      if (s.holder) bump(byHolder, s.holder, 'unplanned');
    }
  }

  const rows = new Set([...seen.values()].map((x) => x.row));
  const escaped = designed + unplanned;
  return {
    judgments: rows.size,
    inheritedSteps: seen.size - rows.size,
    stepsReached,
    designed,
    unplanned,
    escaped,
    rate: stepsReached === 0 ? null : escaped / stepsReached,
    unmeasured,
    escalated,
    byFlow: sorted(byFlow),
    byStep: sorted(byStep),
    byHolder: sorted(byHolder),
  };
}

/** What the flow book BUDGETS to human attention, before a single case is worked.
 *
 *  This is the design's own ceiling and it is knowable without any history at all: if
 *  most steps are marked `human`, no amount of running the machine well will produce
 *  a low escape rate, and the fix is the flow book rather than the automation. Worth
 *  reading before the measured rate, because it explains it. */
export function readDesignedCeiling(flows: FlowBook, catalog: CatalogRow[]): EscapeReading {
  const modeOf = new Map(catalog.map((r) => [r.key, r.mode]));
  const byFlow = new Map<string, EscapeLine>();
  const byStep = new Map<string, EscapeLine>();
  const byHolder = new Map<string, EscapeLine>();
  let stepsReached = 0;
  let designed = 0;
  let unmeasured = 0;

  for (const t of flows) {
    for (const s of t.steps) {
      const mode = s.mode ?? modeOf.get(s.catalogRow);
      if (mode !== 'auto' && mode !== 'human') {
        unmeasured += 1;
        bump(byFlow, t.key, 'unmeasured');
        bump(byStep, s.key, 'unmeasured');
        bump(byHolder, s.holder, 'unmeasured');
        continue;
      }
      stepsReached += 1;
      bump(byFlow, t.key, 'reached');
      bump(byStep, s.key, 'reached');
      bump(byHolder, s.holder, 'reached');
      if (mode === 'human') {
        designed += 1;
        bump(byFlow, t.key, 'designed');
        bump(byStep, s.key, 'designed');
        bump(byHolder, s.holder, 'designed');
      }
    }
  }
  const rows = new Set(flows.flatMap((t) => t.steps.map((x) => x.catalogRow)));
  return {
    judgments: rows.size,
    inheritedSteps: flows.reduce((n, t) => n + t.steps.length, 0) - rows.size,
    stepsReached,
    designed,
    unplanned: 0,
    escaped: designed,
    rate: stepsReached === 0 ? null : designed / stepsReached,
    unmeasured,
    // The ceiling is read from the book alone, with no log to read failures
    // from. Zero here means "no history was consulted", not "nothing escalated".
    escalated: 0,
    byFlow: sorted(byFlow),
    byStep: sorted(byStep),
    byHolder: sorted(byHolder),
  };
}
