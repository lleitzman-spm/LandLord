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
// The shape is two pieces and no more. `FlowStep.onFail` names the step a case
// goes to when this one fails; `failStep` writes the `failed` record and hands
// that step. No severity, no kinds of wrongness, no retry budget — a taxonomy
// invented before anything has been counted is a guess wearing a schema.
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
    { key: 'middle', catalogRow: 'r-b', holder: 'h2', board: 'B', edge: {}, onFail: 'middle' },
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
    { key: 'last', catalogRow: 'r-c', holder: 'h3', board: 'B', edge: {}, onFail: 'first' },
  ],
};

/** A route naming a step this flow does not have — the shape that would record a
 *  failure and then have nowhere to hand the case. */
const BROKEN: FlowTemplate = {
  key: 'test-broken',
  title: 'A flow with a route to nowhere',
  trigger: 'a test says so',
  steps: [
    { key: 'only', catalogRow: 'r-a', holder: 'h1', board: 'B', edge: {}, onFail: 'a-step-that-does-not-exist' },
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

describe('the failure path — closure over a book', () => {
  it('names routed, unrouted and broken apart', () => {
    const routes = readFailureRoutes([SELF_ROUTED, BACK_ROUTED, BROKEN]);
    expect(routes.routed).toEqual([
      { flow: 'test-self', step: 'middle', to: 'middle', self: true },
      { flow: 'test-back', step: 'last', to: 'first', self: false },
    ]);
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
  });
});
