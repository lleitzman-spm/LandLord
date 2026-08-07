// THE RIG, under test — construction separate from deployment, capability-
// scoped belts, and two backings satisfying one interface. Built as its own
// `core` from the real domain modules (not the bundled dist-operator), so
// this suite never needs `npm run build:operator` first — the same choice
// `test/agent-intake.test.ts` already made importing `FOUNDING_FLOWS`
// straight from `../src/domain/flows`.

import { describe, it, expect } from 'vitest';
// @ts-expect-error — the harness is plain ESM JavaScript, deliberately.
import { buildAgent, deploy, run, fileBacking, memoryBacking, BackingRefusal, CAPABILITY_CORE_FNS, judgmentKnown } from '../harness/agents/rig.mjs';
// @ts-expect-error — same.
import { ROSTER, agentNamed } from '../harness/agents/roster.mjs';
// @ts-expect-error — same.
import { rawIntakeFixture, vendorCommitmentFixture, settlementFixture } from '../harness/agents/fixtures.mjs';

import * as flows from '../src/domain/flows';
import * as catalog from '../src/domain/catalog';
import * as events from '../src/domain/events';
import * as economy from '../src/domain/economy';
import * as economySetting from '../src/domain/economySetting';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A REAL core assembled from the actual domain functions — the same names
// `operator-core.ts` re-exports, built here so the test never needs the
// bundled `dist-operator/operator-core.mjs`.
const core: Record<string, unknown> = {
  ...flows,
  ...catalog,
  ...events,
  ...economy,
  ...economySetting,
};

// A `complete` that never reaches a network: every judgment falls straight to
// its Tier-0 fallback, deterministically and fast — this suite is about the
// RIG's plumbing, not brain calls (those are `harness/README.md`'s territory,
// driven live by the viewer).
const offlineComplete = async () => {
  throw new Error('offline in tests — the point is the deterministic fallback path');
};
const brainFor = () => ({ tier: 1, model: 'stub', fallback: 'tool' });

describe('construction is separate from deployment', () => {
  it('buildAgent touches no I/O and needs no backing', () => {
    const agent = buildAgent(agentNamed('Mace'));
    expect(agent.name).toBe('Mace');
    expect(agent.belt).toContain('read:work');
    // Frozen — a constructed agent cannot be mutated into a wider belt later.
    expect(Object.isFrozen(agent)).toBe(true);
    expect(() => {
      (agent as any).belt.push('propose-money');
    }).toThrow();
  });

  it('refuses to construct an agent that does not refuse to ratify', () => {
    expect(() =>
      buildAgent({ name: 'X', seat: 'x', task: 'x', judgment: 'a judgment', belt: ['read:work'], refuses: [] }),
    ).toThrow(/refuse to ratify/);
  });

  it('every roster entry constructs cleanly', () => {
    for (const spec of ROSTER as any[]) expect(() => buildAgent(spec)).not.toThrow();
  });
});

describe('two backings, one interface', () => {
  it('memoryBacking never requires a war-game seed', () => {
    const backing = memoryBacking({ catalog: [], flows: [], events: [] });
    expect(() => backing.readLog()).not.toThrow();
  });

  it('fileBacking refuses a doc with no standing War Game', () => {
    // A temp chronicle with no wargame field — the exact shape a fresh clone
    // ships (data/chronicle.json's own founding state).
    const dir = mkdtempSync(join(tmpdir(), 'rig-test-'));
    const file = join(dir, 'chronicle.json');
    writeFileSync(file, JSON.stringify({ events: [], catalog: [], flows: [] }));
    const backing = fileBacking(file);
    expect(() => backing.readLog()).toThrow(BackingRefusal);
  });

  it('appendEvents on a memory backing never touches disk', () => {
    const backing = memoryBacking({ catalog: [], flows: [], events: [] });
    backing.appendEvents([{ id: '1', at: '2026-08-07T00:00:00.000Z', caseId: 'c', kind: 'noted' }]);
    expect(backing.readLog().events).toHaveLength(1);
  });
});

describe('capability by construction — the belt is what you are handed', () => {
  it("a deployed agent's core carries only functions its belt tags grant", () => {
    const agent = buildAgent(agentNamed('Nell')); // belt: ['read:work', 'propose']
    const backing = memoryBacking({ catalog: [], flows: [], events: [] });
    const { ctx } = deploy(agent, backing, { core, complete: offlineComplete, brainFor });
    expect(typeof ctx.core.readCases).toBe('function'); // read:work
    expect(typeof ctx.core.proposeStep).toBe('function'); // propose
    expect(ctx.core.instantiateFlow).toBeUndefined(); // open:cascade — not on Nell's belt
    expect(ctx.core.spendGate).toBeUndefined(); // read:economy — not on Nell's belt
  });

  it('NO belt, on any agent, ever grants approveStep or overrideStep', () => {
    // Not a per-agent check — a check that the vocabulary itself never
    // contains the ratchet, so no future belt edit could grant it by accident.
    const granted = new Set(Object.values(CAPABILITY_CORE_FNS).flat() as string[]);
    expect(granted.has('approveStep')).toBe(false);
    expect(granted.has('overrideStep')).toBe(false);
    expect(granted.has('settlementMoney')).toBe(false);
    expect(granted.has('vendorSettlementMoney')).toBe(false);
  });

  it('every roster agent deploys to a core with no ratify/pay tool present', () => {
    const backing = memoryBacking({ catalog: [], flows: [], events: [] });
    for (const spec of ROSTER as any[]) {
      const agent = buildAgent(spec);
      const { ctx } = deploy(agent, backing, { core, complete: offlineComplete, brainFor });
      expect((ctx.core as any).approveStep).toBeUndefined();
      expect((ctx.core as any).overrideStep).toBeUndefined();
      for (const key of Object.keys(ctx.core as object)) {
        expect(key, `${agent.name}'s core exposes a money door: ${key}`).not.toMatch(/^(pay|settle|disburse|transfer)/i);
      }
    }
  });

  it('deploy refuses a backing that does not implement the interface', () => {
    const agent = buildAgent(agentNamed('Mace'));
    expect(() => deploy(agent, {} as any, { core })).toThrow(/backing must implement/);
  });
});

describe('the M family, driven through the rig against fixtures', () => {
  it('Mace: a raw complaint in, an identified cascade proposed, and she stops there', async () => {
    const agent = buildAgent(agentNamed('Mace'));
    const doc = rawIntakeFixture({ now: '2026-08-07T09:00:00.000Z', agedDays: 3 });
    const backing = memoryBacking(doc);
    const out = await run(agent, backing, { core, complete: offlineComplete, brainFor, now: '2026-08-07T09:00:00.000Z' });
    expect(out.events.length).toBeGreaterThan(0);
    const last = out.events[out.events.length - 1];
    expect(last.kind).toBe('proposed');
    expect(last.actor).toBe('agent:mabel');
    // The backing actually received the batch — this is deployment, not a dry run.
    expect(backing.readLog().events.length).toBe(1 + out.events.length);
  });

  it('Milo: a vendor-commitment case in, a reasoned quote proposed, and he stops there', async () => {
    const agent = buildAgent(agentNamed('Milo'));
    const doc = vendorCommitmentFixture(core, { now: '2026-08-07T09:00:00.000Z' });
    const backing = memoryBacking(doc);
    const out = await run(agent, backing, { core, complete: offlineComplete, brainFor, now: '2026-08-07T09:00:00.000Z' });
    expect(out.events).toHaveLength(1);
    expect(out.events[0].kind).toBe('proposed');
    expect(out.events[0].actor).toBe('agent:va-desk');
    expect(out.events[0].note).toMatch(/quoted \$/);
  });

  it('Mira: a settlement case in, a pay/hold recommendation proposed, and she stops there', async () => {
    const agent = buildAgent(agentNamed('Mira'));
    const doc = settlementFixture(core, { now: '2026-08-07T09:00:00.000Z' });
    const backing = memoryBacking(doc);
    const out = await run(agent, backing, { core, complete: offlineComplete, brainFor, now: '2026-08-07T09:00:00.000Z' });
    expect(out.events).toHaveLength(1);
    expect(out.events[0].kind).toBe('proposed');
    expect(out.events[0].actor).toBe('agent:lp-queue');
  });

  it('the M family judgments are all known to this rig', () => {
    for (const name of ['Mace', 'Milo', 'Mira']) expect(judgmentKnown(buildAgent(agentNamed(name)))).toBe(true);
  });

  it('an agent with no wired judgment refuses to run rather than pretend to', async () => {
    const agent = buildAgent(agentNamed('Nell')); // no factory registered yet
    const backing = memoryBacking({ catalog: [], flows: [], events: [] });
    await expect(run(agent, backing, { core, complete: offlineComplete, brainFor })).rejects.toThrow(/no judgment wired/);
  });
});
