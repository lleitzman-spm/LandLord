// THE FAILURE PATH — a step can fail, and a failure needs an exit.
//
// Everything the engine could record before this was a way forward: handed,
// noted, proposed, approved, overridden, done. A step that could not be
// completed had no word for itself and simply stopped, which on every board and
// in every count is indistinguishable from a step nobody has reached yet.
//
// Luke, 2026-08-06: *"the human steps especially can't just be rejected — there
// needs to be remediation to either get them to put in the right input or to
// correct their input."*
//
// The shape is two pieces and no more. `FlowStep.onFail` is a `FailureRoute` —
// where the case goes, how the failure was caught (`detects`), and where it comes
// to rest (`endsAt`); `failStep` writes the `failed` record and hands the remedy
// step. Still no severity, no retry budget, no taxonomy of wrongness.
//
// The two axes are the sibling project's, reached from evidence rather than from
// an engine, and adopted so the two projects' escape counts are one number
// instead of two wearing one word. Only the shape crossed.
//
// `endsAt: 'operator'` is the one that carries weight: it is the declaration —
// not an inference — that a failure cost the single human running the system a
// slice of their day. It is what lets the escape rate see rework at all.
//
// These tests use their OWN templates rather than the founding book, and that
// is deliberate: the founding book declares no routes at all (46 of 46), and
// adding some to make the tests convenient would be inventing forty-six
// remedies in an afternoon. The mechanism is proved here; the routes stay a
// design decision, and the lint's `failure routes` line keeps the size of it on
// the page every run.

import { describe, it, expect } from 'vitest';
import {
  FOUNDING_FLOWS,
  failStep,
  completeStep,
  instantiateFlow,
  readFailureRoutes,
  readFlow,
} from '../src/domain/flows';
import { readEscape } from '../src/domain/escape';
import type { FlowTemplate } from '../src/domain/flows';
import type { KingdomEvent } from '../src/domain/events';

const AT = '2026-07-01T00:00:00.000Z';
const NOW = '2026-07-10T00:00:00.000Z';

/** A three-step flow whose middle step sends a failure back to itself — the
 *  ordinary remediation shape: the input was wrong, put it in again. */
const SELF_ROUTED: FlowTemplate = {
  key: 'test-self',
  title: 'A flow that can be redone',
  trigger: 'a test says so',
  steps: [
    { key: 'first', catalogRow: 'r-a', holder: 'h1', board: 'B', edge: {} },
    {
      key: 'middle',
      catalogRow: 'r-b',
      holder: 'h2',
      board: 'B',
      edge: {},
      onFail: { to: 'middle', detects: 'validation', endsAt: 'origin' },
    },
    { key: 'last', catalogRow: 'r-c', holder: 'h3', board: 'B', edge: {} },
  ],
};

/** The same flow, but a failure at the third step sends the case back to the
 *  first — where the bad input entered. */
const BACK_ROUTED: FlowTemplate = {
  key: 'test-back',
  title: 'A flow that sends a failure upstream',
  trigger: 'a test says so',
  steps: [
    { key: 'first', catalogRow: 'r-a', holder: 'h1', board: 'B', edge: {} },
    { key: 'middle', catalogRow: 'r-b', holder: 'h2', board: 'B', edge: {} },
    {
      key: 'last',
      catalogRow: 'r-c',
      holder: 'h3',
      board: 'B',
      edge: {},
      onFail: { to: 'first', detects: 'judgment', endsAt: 'operator' },
    },
  ],
};

/** A route naming a step this flow does not have — the shape that would record a
 *  failure and then have nowhere to hand the case. */
const BROKEN: FlowTemplate = {
  key: 'test-broken',
  title: 'A flow with a route to nowhere',
  trigger: 'a test says so',
  steps: [
    {
      key: 'only',
      catalogRow: 'r-a',
      holder: 'h1',
      board: 'B',
      edge: {},
      onFail: { to: 'a-step-that-does-not-exist', detects: 'absence', endsAt: 'origin' },
    },
  ],
};

function open(tpl: FlowTemplate) {
  let n = 0;
  const id = () => `f-${++n}`;
  const inst = instantiateFlow(tpl, 'a subject', { at: AT, id });
  return { caseId: inst.caseId, log: [...inst.events] as KingdomEvent[], opts: { at: AT, id } };
}

describe('the failure path — a step that fails goes somewhere', () => {
  it('a self-routed step comes back to the same desk, and the cascade does not walk past it', () => {
    const { caseId, log, opts } = open(SELF_ROUTED);
    log.push(...completeStep(SELF_ROUTED, caseId, 0, opts)); // first: done, middle handed
    log.push(...failStep(SELF_ROUTED, caseId, 1, opts));

    const r = readFlow(SELF_ROUTED, log, caseId, NOW)!;
    // The head of the cascade is still the middle step. Treating a failure as
    // progress is the whole fault this path closes.
    expect(r.next!.step.key).toBe('middle');
    expect(r.advanced).toBe(1);
    expect(r.status).not.toBe('done');
  });

  it('a failure that is redone still leaves a mark — the count, not the latest kind', () => {
    const { caseId, log, opts } = open(SELF_ROUTED);
    log.push(...completeStep(SELF_ROUTED, caseId, 0, opts));
    log.push(...failStep(SELF_ROUTED, caseId, 1, opts));
    log.push(...failStep(SELF_ROUTED, caseId, 1, opts));
    log.push(...completeStep(SELF_ROUTED, caseId, 1, opts)); // got it right the third time

    const r = readFlow(SELF_ROUTED, log, caseId, NOW)!;
    const middle = r.steps.find((s) => s.step.key === 'middle')!;
    // THIS IS THE POINT OF COUNTING. A self-route writes `failed` then `handed`,
    // so the latest kind is never the failure — and after the eventual success
    // it is `done`. Read off `kind` alone, a step failed twice is identical to
    // one that went through first time.
    expect(middle.kind).toBe('done');
    expect(middle.failures).toBe(2);
    expect(r.failures).toBe(2);
    expect(r.rework.map((s) => s.step.key)).toEqual(['middle']);
  });

  it('a step routed upstream sends the case back to where the bad input entered', () => {
    const { caseId, log, opts } = open(BACK_ROUTED);
    log.push(...completeStep(BACK_ROUTED, caseId, 0, opts));
    log.push(...completeStep(BACK_ROUTED, caseId, 1, opts));
    log.push(...failStep(BACK_ROUTED, caseId, 2, opts));

    const r = readFlow(BACK_ROUTED, log, caseId, NOW)!;
    expect(r.next!.step.key).toBe('first');
    // The upstream step was done and is now handed again — the case genuinely
    // moved backwards, which is what an upstream route means.
    expect(r.steps.find((s) => s.step.key === 'first')!.kind).toBe('handed');
    expect(r.steps.find((s) => s.step.key === 'last')!.failures).toBe(1);
  });

  it('a step with NO route cannot fail — nothing is written at all', () => {
    const { caseId, log, opts } = open(SELF_ROUTED);
    const before = log.length;
    // `first` declares no `onFail`.
    const events = failStep(SELF_ROUTED, caseId, 0, opts);
    expect(events).toEqual([]);
    log.push(...events);
    expect(log.length).toBe(before);
    // The gate is the reason the mechanism is safe to ship with zero routes
    // declared: there is no way to strand a case, because there is no way to
    // record a failure that has nowhere to go.
  });

  it('a route naming a step the flow does not have writes nothing either', () => {
    const { caseId, log, opts } = open(BROKEN);
    const before = log.length; // `opened` plus the first hand, from instantiateFlow
    expect(failStep(BROKEN, caseId, 0, opts)).toEqual([]);
    expect(log.length).toBe(before);
    // The lint is fatal on this in the book. The writer refuses it too, because
    // a check that only runs in a tool is not a guarantee about what the engine
    // does at runtime.
  });

  it('an out-of-range index is no act at all, like every other writer', () => {
    const { caseId, opts } = open(SELF_ROUTED);
    expect(failStep(SELF_ROUTED, caseId, -1, opts)).toEqual([]);
    expect(failStep(SELF_ROUTED, caseId, 99, opts)).toEqual([]);
  });
});

describe('the failure path — what it lets the escape rate see', () => {
  // THE BLIND SPOT THIS CLOSES. `readEscape` counts a step ONCE however many
  // times it was worked, so three passes at one step read as one. Before the
  // route declared where a failure comes to rest there was no honest way to fix
  // that: counting `failed` as human attention meant ASSUMING a person is
  // involved, and nothing in the engine said so. `endsAt: 'operator'` says so.
  const ESCALATING: FlowTemplate = {
    key: 'test-escalates',
    title: 'A flow whose failures land on the operator',
    trigger: 'a test says so',
    steps: [
      { key: 'machine-does-it', catalogRow: 'auto-row', holder: 'h1', board: 'B', edge: {} },
      {
        key: 'hard-call',
        catalogRow: 'human-row',
        holder: 'h2',
        board: 'B',
        edge: {},
        onFail: { to: 'hard-call', detects: 'judgment', endsAt: 'operator' },
      },
    ],
  };
  const BOUNCING: FlowTemplate = {
    ...ESCALATING,
    key: 'test-bounces',
    steps: [
      ESCALATING.steps[0],
      { ...ESCALATING.steps[1], onFail: { to: 'hard-call', detects: 'absence', endsAt: 'origin' } },
    ],
  };
  const CATALOG = [
    { key: 'auto-row', mode: 'auto' },
    { key: 'human-row', mode: 'human' },
  ] as never;

  function drive(tpl: FlowTemplate, failures: number) {
    const { caseId, log, opts } = open(tpl);
    log.push(...completeStep(tpl, caseId, 0, opts));
    for (let i = 0; i < failures; i++) log.push(...failStep(tpl, caseId, 1, opts));
    return log;
  }

  it('counts each escalation, not each step — this is where rework becomes visible', () => {
    const log = drive(ESCALATING, 3);
    const r = readEscape([ESCALATING], CATALOG, log);
    // The step is reached once and stays reached once...
    expect(r.stepsReached).toBe(2);
    expect(r.designed).toBe(1);
    // ...but the operator was pulled in three times, and now that shows.
    expect(r.escalated).toBe(3);
  });

  it('a failure sent back to the party who erred is NOT an escape', () => {
    const log = drive(BOUNCING, 3);
    const r = readEscape([BOUNCING], CATALOG, log);
    // Same three failures, same step, same everything except where the case
    // comes to rest. Costing the operator a chase is not costing them a
    // judgment, and a model that could not tell them apart would count every
    // remedy as coverage.
    expect(r.escalated).toBe(0);
    expect(r.designed).toBe(1);
  });

  it('the escape count is not folded into the rate', () => {
    const log = drive(ESCALATING, 3);
    const r = readEscape([ESCALATING], CATALOG, log);
    // One of two reached steps is designed-human. The three escalations do NOT
    // push the numerator to 4/2 — they are a different measure over a different
    // unit, and a rate above 1 would be the tell that they had been mixed.
    expect(r.rate).toBe(0.5);
    expect(r.escaped).toBe(1);
  });

  it('with no routes declared the count is zero and the rate is unchanged', () => {
    // The whole founding book is in this state. Zero here must mean "nothing
    // escalated", and it does, because no step can fail at all.
    const log = drive(SELF_ROUTED, 0);
    const r = readEscape([SELF_ROUTED], CATALOG, log);
    expect(r.escalated).toBe(0);
  });
});

describe('the failure path — closure over a book', () => {
  it('names routed, unrouted and broken apart', () => {
    const routes = readFailureRoutes([SELF_ROUTED, BACK_ROUTED, BROKEN]);
    expect(routes.routed).toEqual([
      { flow: 'test-self', step: 'middle', to: 'middle', self: true, detects: 'validation', endsAt: 'origin' },
      { flow: 'test-back', step: 'last', to: 'first', self: false, detects: 'judgment', endsAt: 'operator' },
    ]);
    // One of the two routes escalates. This is the escape count read off the
    // book alone, before any case is worked.
    expect(routes.escalating).toBe(1);
    expect(routes.unrouted).toHaveLength(4);
    expect(routes.broken).toEqual([
      { flow: 'test-broken', step: 'only', to: 'a-step-that-does-not-exist' },
    ]);
  });

  it('the founding book declares no failure routes, and says so rather than defaulting', () => {
    const routes = readFailureRoutes(FOUNDING_FLOWS);
    const steps = FOUNDING_FLOWS.reduce((n, t) => n + t.steps.length, 0);
    // THE HONEST CURRENT ANSWER. Not a bug and not a passing grade: the
    // mechanism exists, and which steps may fail — and where each goes — is a
    // design decision nobody has made. Every one of these steps therefore
    // cannot fail, which is a safe state, not a finished one.
    //
    // This assertion is written against the count on purpose. The day somebody
    // routes a step, this test fails and they have to come here and say so —
    // which is the only way a decision this quiet gets recorded.
    expect(routes.unrouted).toHaveLength(steps);
    expect(routes.routed).toHaveLength(0);
    // A broken route in the founding book would be a real fault at any count.
    expect(routes.broken).toEqual([]);
    expect(routes.escalating).toBe(0);
  });

  it('a judgment failure repaired on an `auto` row is a fault — the two claims cannot both hold', () => {
    // The book says no machine can catch this failure, and hands the repair to a
    // step a machine performs. One of those is wrong and nothing says which.
    const AUTO_REMEDY: FlowTemplate = {
      key: 'test-judgment',
      title: 'A judgment call repaired by a machine',
      trigger: 'a test says so',
      steps: [
        { key: 'call-it', catalogRow: 'r-auto', holder: 'h1', board: 'B', edge: {} },
        {
          key: 'weigh',
          catalogRow: 'r-human',
          holder: 'h2',
          board: 'B',
          edge: {},
          onFail: { to: 'call-it', detects: 'judgment', endsAt: 'operator' },
        },
      ],
    };
    const bad = readFailureRoutes(
      [AUTO_REMEDY],
      new Map([
        ['r-auto', 'auto'],
        ['r-human', 'human'],
      ]),
    );
    expect(bad.judgmentOnAuto).toEqual([{ flow: 'test-judgment', step: 'weigh', to: 'call-it' }]);

    // Same book, same route, remedy row marked human — nothing to report. It is
    // the PAIRING that is the fault, not either half on its own.
    const ok = readFailureRoutes(
      [AUTO_REMEDY],
      new Map([
        ['r-auto', 'human'],
        ['r-human', 'human'],
      ]),
    );
    expect(ok.judgmentOnAuto).toEqual([]);

    // WITHOUT THE CATALOG IT DOES NOT PRETEND TO HAVE CHECKED. An absence is a
    // reading: no modes handed in means no cross-check ran, and the empty array
    // must not be read as a clean bill. This is the same rule the escape rate
    // runs on for a row with no mode.
    expect(readFailureRoutes([AUTO_REMEDY]).judgmentOnAuto).toEqual([]);
  });
});
