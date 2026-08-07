// THE RIG, under test — construction separate from deployment, capability-
// scoped belts, and two backings satisfying one interface. Built as its own
// `core` from the real domain modules (not the bundled dist-operator), so
// this suite never needs `npm run build:operator` first — the same choice
// `test/agent-intake.test.ts` already made importing `FOUNDING_FLOWS`
// straight from `../src/domain/flows`.

import { describe, it, expect } from 'vitest';
// @ts-expect-error — the harness is plain ESM JavaScript, deliberately.
import { buildAgent, deploy, run, fileBacking, memoryBacking, BackingRefusal, BeltRefusal, NoSuchGrammar, NEEDS_LOADED_BOOK, beltShortfall, CAPABILITY_CORE_FNS, DECLARATIVE_TAGS, judgmentKnown } from '../harness/agents/rig.mjs';
// @ts-expect-error — same.
import { ROSTER, agentNamed } from '../harness/agents/roster.mjs';
// @ts-expect-error — same.
import { rawIntakeFixture, vendorCommitmentFixture, settlementFixture, atStepFixture, OVERRUN_SUBJECT } from '../harness/agents/fixtures.mjs';

import * as flows from '../src/domain/flows';
import * as catalog from '../src/domain/catalog';
import * as events from '../src/domain/events';
import * as economy from '../src/domain/economy';
import * as economySetting from '../src/domain/economySetting';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
// @ts-expect-error — plain ESM.
import { guardComplete, isIdentityGuarded } from '../src/domain/contextGuard.mjs';
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
    // A synthetic narrow agent rather than a roster one: every roster belt now
    // carries `read:economy` (the sufficiency fix), so no real agent is narrow
    // enough to prove the scoping any more. Testing the MECHANISM here keeps
    // this honest regardless of what the roster happens to declare.
    const agent = buildAgent({
      name: 'Narrow', seat: 'test', task: 'test', judgment: 'a deliberately narrow belt',
      belt: ['read:work'], refuses: ['ratify', 'move-coin', 'reach-identity'],
    });
    const backing = memoryBacking({ catalog: [], flows: [], events: [] });
    const { ctx } = deploy(agent, backing, { core, complete: offlineComplete, brainFor });
    expect(typeof ctx.core.readCases).toBe('function'); // read:work
    expect(ctx.core.proposeStep).toBeUndefined(); // propose — not granted
    expect(ctx.core.instantiateFlow).toBeUndefined(); // open:cascade — not granted
    expect(ctx.core.spendGate).toBeUndefined(); // read:economy — not granted
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
    const agent = buildAgent({
      name: 'Unwired', seat: 'nowhere', task: 'nothing', judgment: 'a judgment with no clerk',
      belt: ['read:work'], refuses: ['ratify', 'move-coin', 'reach-identity'],
    });
    const backing = memoryBacking({ catalog: [], flows: [], events: [] });
    await expect(run(agent, backing, { core, complete: offlineComplete, brainFor })).rejects.toThrow(/no judgment wired/);
  });

  // The hard rail — WRIT-THE-GATE finding 3's fix — reachable at last. The
  // fixture's subject steers `invoiceFor`'s hash, and a fixed subject used to
  // pin every settlement case to the same within-ceiling branch, so this
  // verdict could not be produced through the rig at all.
  it('Mira HOLDS an invoice that overruns its authorized ceiling', async () => {
    // The ceiling is max(quote, NTE cap) — `reconcileSpend` — so an overrun
    // alone does NOT hold: a $214 invoice against a $180 quote still sits
    // under the $350 house cap and clears, correctly. Holding needs a quote
    // ABOVE the cap that the invoice then overruns. Measured, not guessed.
    const agent = buildAgent(agentNamed('Mira'));
    const doc = settlementFixture(core, { subject: OVERRUN_SUBJECT, quoteCents: 40000, now: '2026-08-07T09:00:00.000Z' });
    expect(doc.invoiceCents, 'the fixture must actually overrun, or this tests nothing').toBeGreaterThan(doc.quoteCents);
    const backing = memoryBacking(doc);
    const out = await run(agent, backing, { core, complete: offlineComplete, brainFor, now: '2026-08-07T09:00:00.000Z' });
    expect(out.records[0]).toMatch(/hold-for-owner/);
  });

  it('and CLEARS an invoice that stays inside it — both verdicts are reachable', () => {
    // The pair is the point: a fixture that can only ever produce one verdict
    // proves nothing about the rail, which is exactly what the first draft
    // shipped.
    const held = settlementFixture(core, { subject: OVERRUN_SUBJECT, quoteCents: 40000 });
    const clear = settlementFixture(core, { quoteCents: 18000 });
    expect(held.invoiceCents).toBeGreaterThan(40000);
    expect(clear.invoiceCents).toBeLessThan(35000); // under the house NTE cap
  });

  it('the record and the judgment name the SAME invoice figure', async () => {
    // The removed `invoiceCents` param used to write one figure into the case
    // record while the clerk reconciled a different one it derived itself.
    const doc = settlementFixture(core, { quoteCents: 18000, now: '2026-08-07T09:00:00.000Z' });
    const noted = doc.events.find((e: any) => e.kind === 'noted');
    expect(noted.note).toContain(`$${(doc.invoiceCents / 100).toFixed(0)}`);
  });
});

// ── The corrections of 2026-08-07, each pinned so it cannot come back ───────
describe('the belt is enforcement, not decoration', () => {
  it('the capability table is DEEP frozen — its arrays cannot be widened', () => {
    // A shallow freeze let any importer push `approveStep` onto a tag and
    // widen every belt in the process. Measured on the first draft.
    expect(Object.isFrozen(CAPABILITY_CORE_FNS)).toBe(true);
    for (const [tag, names] of Object.entries(CAPABILITY_CORE_FNS)) {
      expect(Object.isFrozen(names), `${tag}'s array is mutable`).toBe(true);
      expect(() => (names as string[]).push('approveStep')).toThrow();
    }
  });

  it('a belt tag that grants nothing is DECLARED as such, never left looking like a grant', () => {
    // `read:trade-roster` reaches vendors.mjs by static import in clerks.mjs,
    // so the rig cannot enforce it. It is listed as declarative rather than
    // bound to functions nothing reads — which is what the first draft did.
    for (const tag of DECLARATIVE_TAGS as string[]) {
      expect(Object.keys(CAPABILITY_CORE_FNS), `${tag} both grants and is declared inert`).not.toContain(tag);
    }
    expect(DECLARATIVE_TAGS).toContain('read:trade-roster');
  });

  it('an unknown belt tag is refused at deploy, not silently ignored', () => {
    const agent = buildAgent({ ...agentNamed('Nell'), belt: ['read:work', 'read:econmy'] });
    const backing = memoryBacking({ catalog: [], flows: [], events: [] });
    expect(() => deploy(agent, backing, { core })).toThrow(/unknown belt tag/);
  });

  it('every named agent carries a belt SUFFICIENT for the clerk that runs it', () => {
    // The class of bug this session found on Mace and then found again on four
    // more agents: a belt that omits a tag its own clerk module needs throws
    // mid-run. Scanned statically, so it catches the seven agents the rig
    // cannot yet run.
    const clerkFile: Record<string, string> = {
      mabel: 'clerks.mjs', 'va-desk': 'clerks.mjs', 'lp-queue': 'clerks.mjs', osric: 'clerks.mjs',
      'res-desk': 'res-desk.mjs', 'viol-desk': 'viol-desk.mjs', 'turn-desk': 'turn-desk.mjs',
      'bd-desk': 'bd-desk.mjs', 'col-desk': 'col-desk.mjs', 'acct-desk': 'acct-desk.mjs',
    };
    const grantedBy = (belt: string[]) => {
      const s = new Set<string>();
      for (const tag of belt) for (const fn of (CAPABILITY_CORE_FNS as any)[tag] ?? []) s.add(fn);
      return s;
    };
    for (const spec of ROSTER as any[]) {
      const file = clerkFile[spec.seat];
      if (!file) continue;
      const src = readFileSync(join(__dirname, '..', 'harness', file), 'utf8');
      const used = new Set([...src.matchAll(/\bcore\.(\w+)/g)].map((m) => m[1]));
      const granted = grantedBy(spec.belt);
      for (const fn of used) {
        // Only names the table knows are the belt's business; a `core.X` the
        // table never grants at all is out of scope for this check.
        const inTable = Object.values(CAPABILITY_CORE_FNS).flat().includes(fn as never);
        if (!inTable) continue;
        // clerks.mjs holds four seats' clerks in one file, so a name used by
        // one seat's clerk cannot be pinned on another's belt by this scan.
        if (file === 'clerks.mjs') continue;
        expect(granted.has(fn), `${spec.name} (${spec.seat}) needs core.${fn} — ${file} uses it — but its belt does not grant it`).toBe(true);
      }
    }
  });
});

describe("an agent's own advances are legible in the log", () => {
  it('a `done` written through a granted completeStep is stamped with the seat', async () => {
    // Standing HIGH finding #2 in docs/HANDOFF.md — "an agent-completed step
    // is indistinguishable from a human's" — closed for rig-deployed agents.
    // `completeStep` sets no actor and its opts carry no field for one, so the
    // rig stamps it on the way out.
    const agent = buildAgent(agentNamed('Mace'));
    const doc = rawIntakeFixture({ now: '2026-08-07T09:00:00.000Z' });
    const backing = memoryBacking(doc);
    const out = await run(agent, backing, { core, complete: offlineComplete, brainFor, now: '2026-08-07T09:00:00.000Z' });
    const dones = out.events.filter((e: any) => e.kind === 'done');
    expect(dones.length).toBeGreaterThan(0);
    for (const d of dones) expect(d.actor).toBe('agent:mabel');
  });

  it('an agent CAN still advance a cascade — the belt makes it legible, not impossible', () => {
    // Stated as a test because the opposite was claimed in an earlier draft of
    // rig.mjs and printed to the operator by the viewer. It was false.
    const agent = buildAgent(agentNamed('Mace'));
    const doc = vendorCommitmentFixture(core, { now: '2026-08-07T09:00:00.000Z' });
    const backing = memoryBacking(doc);
    const { ctx } = deploy(agent, backing, { core, complete: offlineComplete, brainFor });
    expect(ctx.core.approveStep, 'the ratchet is genuinely absent').toBeUndefined();
    expect(typeof ctx.core.completeStep, 'and completeStep is genuinely granted').toBe('function');
  });
});

describe('the fleet past the M family — eight wired, two honestly refused', () => {
  // Each pair is the flow/step its own clerk's COMMITMENTS map names, verified
  // against the founding book INCLUDING the holder — a step key that matches
  // while the holder does not would silently find no work and still pass a
  // "did it throw" test.
  const REACHABLE = [
    ['Lena', 'lease-renewal', 'price', 'agent:osric'],
    ['Rhys', 'violation-notice', 'classify', 'agent:res-desk'],
    ['Tess', 'move-out-relay', 'turn-scope', 'agent:turn-desk'],
    ['Nell', 'owner-onboarding', 'intake', 'agent:bd-desk'],
    ['Bea', 'move-out-relay', 'deposit-accounting', 'agent:acct-desk'],
  ] as const;

  for (const [name, flowKey, stepKey, actor] of REACHABLE) {
    it(`${name} works a real ${flowKey}/${stepKey} case and stops at a proposal`, async () => {
      const agent = buildAgent(agentNamed(name));
      const doc = atStepFixture(core, { flowKey, stepKey, subject: `a ${flowKey} case for ${name}` });
      const backing = memoryBacking(doc);
      const out = await run(agent, backing, { core, complete: offlineComplete, brainFor, now: '2026-08-07T09:00:00.000Z' });
      expect(out.events, `${name} found no work — the fixture parks on the wrong step or holder`).toHaveLength(1);
      expect(out.events[0].kind).toBe('proposed');
      expect(out.events[0].actor).toBe(actor);
    });
  }

  it('the two that cannot be driven refuse with the REASON, not a missing wire', async () => {
    // Ross and Dara grip grammars only the ~160-step grand-muster library
    // carries. Absent BOOK, not absent code — and the refusal says which.
    for (const name of ['Ross', 'Dara']) {
      const agent = buildAgent(agentNamed(name));
      const backing = memoryBacking({ catalog: [], flows: [], events: [] });
      await expect(run(agent, backing, { core, complete: offlineComplete, brainFor, now: '2026-08-07T09:00:00.000Z' }))
        .rejects.toThrow(NoSuchGrammar);
    }
  });

  it('and the grammars they need really are absent from the founding book', () => {
    // Pins the claim rather than trusting the constant: if a future book adds
    // these flows, this fails and the two get wired instead of excused.
    const book = JSON.parse(readFileSync(join(__dirname, '..', 'harness', 'agents', 'fixtures', 'founding-book.json'), 'utf8'));
    const flowKeys = new Set(book.flows.map((f: any) => f.key));
    for (const target of Object.values(NEEDS_LOADED_BOOK as Record<string, string>)) {
      expect(flowKeys.has(target.split('/')[0]), `${target} IS in the founding book — wire it`).toBe(false);
    }
  });

  it('atStepFixture refuses to park on a step the book does not have', () => {
    // A fixture that silently lands elsewhere tests the wrong judgment and
    // still goes green, which is the failure mode this guard exists for.
    expect(() => atStepFixture(core, { flowKey: 'lease-renewal', stepKey: 'not-a-step', subject: 'x' })).toThrow(/no step/);
    expect(() => atStepFixture(core, { flowKey: 'not-a-flow', stepKey: 'x', subject: 'x' })).toThrow(/no flow/);
  });
});

describe('a belt too narrow for its judgment is REFUSED, not discovered mid-run', () => {
  it('run refuses with a BeltRefusal naming the missing tag', async () => {
    const spec = { ...(agentNamed('Bea') as any), belt: ['propose'] }; // read:economy stripped
    const agent = buildAgent(spec);
    const backing = memoryBacking(atStepFixture(core, { flowKey: 'move-out-relay', stepKey: 'deposit-accounting', subject: 'x' }));
    await expect(run(agent, backing, { core, complete: offlineComplete, brainFor, now: '2026-08-07T09:00:00.000Z' }))
      .rejects.toThrow(BeltRefusal);
    await expect(run(agent, backing, { core, complete: offlineComplete, brainFor, now: '2026-08-07T09:00:00.000Z' }))
      .rejects.toThrow(/read:economy/);
  });

  it('every roster agent with a wired judgment has a sufficient belt', () => {
    for (const spec of ROSTER as any[]) {
      const agent = buildAgent(spec);
      if (!judgmentKnown(agent)) continue;
      expect(beltShortfall(agent), `${agent.name}'s belt is short for its own judgment`).toEqual([]);
    }
  });

  it("each judgment's declared `requires` matches what its clerk module actually reads", () => {
    // The declaration is not taken on trust. If a clerk grows a `core.X` its
    // judgment's `requires` does not cover, this fails — which is the same
    // class of bug that shipped on Mace and on four more agents after her.
    const moduleOf: Record<string, string> = {
      'res-desk/triage': 'res-desk.mjs', 'turn-desk/scope': 'turn-desk.mjs',
      'bd-desk/qualify': 'bd-desk.mjs', 'acct-desk/reconcile': 'acct-desk.mjs',
    };
    const tagOf = new Map<string, string>();
    for (const [tag, fns] of Object.entries(CAPABILITY_CORE_FNS)) for (const f of fns as string[]) tagOf.set(f, tag);
    for (const spec of ROSTER as any[]) {
      const file = moduleOf[`${spec.seat}/${spec.task}`];
      if (!file) continue; // clerks.mjs hosts four seats in one file — not attributable by scan
      const src = readFileSync(join(__dirname, '..', 'harness', file), 'utf8');
      const needed = new Set(
        [...src.matchAll(/\bcore\.(\w+)/g)].map((m) => tagOf.get(m[1])).filter(Boolean) as string[],
      );
      for (const tag of needed) {
        expect(spec.belt, `${spec.name} needs ${tag} (from ${file}) but does not declare it`).toContain(tag);
      }
    }
  });
});

describe('the rig guarantees the identity boundary it declares', () => {
  it('wraps an UNGUARDED transport, so a direct caller of deploy/run still gets the boundary', () => {
    const raw = async () => { throw new Error('offline'); };
    expect(isIdentityGuarded(raw)).toBe(false);
    const agent = buildAgent(agentNamed('Mace'));
    const backing = memoryBacking({ catalog: [], flows: [], events: [] });
    const { ctx } = deploy(agent, backing, { core, complete: raw, brainFor });
    expect(ctx.complete, 'the raw transport was handed straight through').not.toBe(raw);
    expect(isIdentityGuarded(ctx.complete)).toBe(true);
  });

  it('does NOT re-wrap an already-guarded transport — that would swallow the caller\'s poison flag', () => {
    // The subtle one, and the reason this is a conditional wrap rather than an
    // unconditional one. An outer guard catches the FIRST leak and throws
    // before the inner guard runs, so `runGuardedModelWork`'s onBlocked never
    // fires and a blocked run keeps its fallback events as though nothing had
    // happened. Identity of the reference is the check: same function in, same
    // function out.
    const guarded = guardComplete(async () => { throw new Error('offline'); }, { onBlocked: () => {} });
    const agent = buildAgent(agentNamed('Mace'));
    const backing = memoryBacking({ catalog: [], flows: [], events: [] });
    const { ctx } = deploy(agent, backing, { core, complete: guarded, brainFor });
    expect(ctx.complete, 'an already-guarded transport was wrapped a second time').toBe(guarded);
  });

  it("the wrap it installs really does block a leaking payload", async () => {
    // Proves the wrapper is the real boundary and not a marker: a payload that
    // carries an identifier is refused, and the onBlocked the rig forwarded
    // fires. (Note this takes a HAND-BUILT payload. In a real Mace run nothing
    // leaks, because `safe-evidence.mjs` collapses the complaint to a
    // controlled token — "call resident 555-0123 ssn 123-45-6789 about no
    // heat" reaches the brain as "no-heating". The guard is defence in depth
    // behind that, which is why a naive end-to-end test of it sees nothing.)
    let blocked = 0;
    const agent = buildAgent(agentNamed('Mace'));
    const backing = memoryBacking({ catalog: [], flows: [], events: [] });
    const { ctx } = deploy(agent, backing, {
      core, brainFor,
      complete: async () => ({ message: { content: 'ok' } }),
      onBlocked: () => { blocked += 1; },
    });
    await expect(
      ctx.complete({ messages: [{ role: 'user', content: 'resident ssn 123-45-6789' }] }),
    ).rejects.toThrow();
    expect(blocked, 'the rig did not forward onBlocked to the guard it installed').toBe(1);
  });
});

describe('a backing refuses on the WRITE path too', () => {
  it('appendEvents on a seedless chronicle refuses, not just readLog', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-write-'));
    const file = join(dir, 'chronicle.json');
    writeFileSync(file, JSON.stringify({ events: [], catalog: [], flows: [] }));
    const backing = fileBacking(file);
    expect(() => backing.appendEvents([{ id: '1', at: 'x', caseId: 'c', kind: 'noted' }])).toThrow(BackingRefusal);
    // and nothing was written
    expect(JSON.parse(readFileSync(file, 'utf8')).events).toHaveLength(0);
  });

  it('run refuses rather than inventing a clock when the backing carries none', async () => {
    const agent = buildAgent(agentNamed('Mace'));
    const backing = memoryBacking(rawIntakeFixture({ now: '2026-08-07T09:00:00.000Z' }));
    await expect(run(agent, backing, { core, complete: offlineComplete, brainFor })).rejects.toThrow(/no clock/);
  });
});
