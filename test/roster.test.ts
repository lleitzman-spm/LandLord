// BRAINS GET THE NAMES — the rule, made executable.
//
// The roster is not a second list to maintain. A name marks a JUDGMENT, and a
// judgment is exactly what `harness/brain-doctrine.mjs` already records: a seat
// with a model is a brain, a seat with `model: null` is a hand. These tests fail
// if the roster and the registry ever disagree, IN EITHER DIRECTION.
//
// The direction people forget is the second one. A name with no brain behind it
// is a persona over a lookup table — an "AI agent" that is really an
// if-statement — and that is the characteristic failure of this whole product
// category. It is cheap to do by accident and expensive to notice later.

import { describe, it, expect } from 'vitest';
// @ts-expect-error — the harness is plain ESM JavaScript, deliberately (no tsx
// in the agent runtime; see operator-core.ts's header for why that seam exists).
import { ROSTER, HANDS, policyKeyOf, familyOf, agentNamed } from '../harness/agents/roster.mjs';
// @ts-expect-error — same.
import { brainFor } from '../harness/brain-doctrine.mjs';

interface Agent {
  name: string;
  family: string;
  seat: string;
  task: string;
  judgment: string;
  belt: string[];
  refuses: string[];
  skill: string | null;
  validated: string | null;
}
const roster = ROSTER as Agent[];

describe('brains get the names', () => {
  it('every named agent has a real brain in the registry', () => {
    for (const a of roster) {
      const policy = brainFor(a.seat, a.task);
      expect(policy, `${a.name} (${policyKeyOf(a)}) has no brain policy`).toBeTruthy();
      expect(policy.model, `${a.name} is named but carries no model — a persona over a lookup table`).toBeTruthy();
    }
  });

  it('no HAND is given a name', () => {
    // The advance clerks sweep steps the book already declared need no thinking.
    // They are limbs, not people. Naming one would be the inverse error.
    for (const seat of HANDS as string[]) {
      const named = roster.find((a) => a.seat === seat && a.task === 'advance');
      expect(named, `${seat}/advance is a hand and must not be named`).toBeUndefined();
      expect(brainFor(seat, 'advance').model, `${seat}/advance should carry no model`).toBeNull();
    }
  });

  it('one name per judgment — no two agents hold the same seat AND task', () => {
    const keys = roster.map(policyKeyOf);
    expect(new Set(keys).size, 'two names on one judgment').toBe(keys.length);
  });

  it('names are unique and memorable — distinct, and no collision with the demo census', () => {
    const names = roster.map((a) => a.name);
    expect(new Set(names).size).toBe(names.length);
    // The census cast are PEOPLE in the founding data; an agent wearing one of
    // their names would make the log unreadable about who acted.
    const census = ['Harold', 'Edwin', 'Alys', 'Mabel', 'Osric', 'Piers', 'Marlowe', 'Mason', 'Carver'];
    for (const n of names) expect(census, `${n} collides with the census`).not.toContain(n);
  });
});

describe('a squire rides with its knight', () => {
  it('every agent in a family shares its letter', () => {
    for (const a of roster) expect(a.name.startsWith(a.family), `${a.name} is not in family ${a.family}`).toBe(true);
  });

  it('the work-order family is three judgments, not three steps', () => {
    // Mace identifies, Milo prices, Mira reconciles. Three genuinely different
    // calls inside one loop — which is why they are three names and the eight
    // steps between them are not.
    const m = (familyOf('M') as Agent[]).map((a) => a.name).sort();
    expect(m).toEqual(['Mace', 'Milo', 'Mira']);
  });
});

describe('the manifest carries all four axes on every agent', () => {
  it('a judgment, a belt, a refusal list, and a rig it was proven against', () => {
    for (const a of roster) {
      expect(a.judgment.length, `${a.name} has no stated judgment`).toBeGreaterThan(10);
      expect(a.belt.length, `${a.name} has an empty belt — it could do nothing`).toBeGreaterThan(0);
      expect(a.refuses.length, `${a.name} refuses nothing`).toBeGreaterThan(0);
      // `validated` may be null (not yet proven) but the FIELD must exist, so an
      // agent can never be shipped without a provenance answer either way.
      expect(a, `${a.name} has no validated field`).toHaveProperty('validated');
      expect(a, `${a.name} has no skill binding`).toHaveProperty('skill');
    }
  });

  it('NO agent may ratify — the ratchet is the human’s alone', () => {
    for (const a of roster) expect(a.refuses, `${a.name} does not refuse to ratify`).toContain('ratify');
  });

  it('NO agent may move coin, and none may reach identity', () => {
    for (const a of roster) {
      expect(a.refuses, `${a.name} does not refuse to move coin`).toContain('move-coin');
      expect(a.refuses, `${a.name} does not refuse to reach identity`).toContain('reach-identity');
    }
  });

  it('no belt grants a money door — the guard is that the tool does not exist', () => {
    // Capability by construction. The belt is what you are handed, never a list
    // you are checked against, so an agent cannot reach a door absent from it.
    for (const a of roster)
      for (const tool of a.belt)
        expect(tool, `${a.name}'s belt contains a money door`).not.toMatch(/pay|settle|disburse|transfer/i);
  });

  it('nothing speaks outward yet — voice is a field, not a shipped capability', () => {
    // An utterance cannot be ratified after the fact, so a speaking agent needs a
    // different safety model than propose-then-approve. None ships until it has one.
    for (const a of roster) expect(a.belt).not.toContain('speak-outward');
  });
});

describe('the roster is reachable by the readings that will use it', () => {
  it('an agent can be found by name', () => {
    expect((agentNamed('Milo') as Agent).seat).toBe('va-desk');
    expect(agentNamed('Nobody')).toBeUndefined();
  });
});
