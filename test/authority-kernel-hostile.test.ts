import { describe, expect, it } from 'vitest';
import {
  caseVersion,
  catalogDigest,
  declaredFlowVersion,
  evaluateCommand,
  flowDigest,
  type AuthorityContext,
  type AuthorityGrant,
  type ExternalCommand,
} from '../src/domain/authority';
import { normalizeChronicle } from '../src/domain/chronicle';
import { instantiateFlow, proposeStep, type FlowTemplate } from '../src/domain/flows';

const NOW = '2026-08-09T18:00:00.000Z';
const PRINCIPAL = 'worker@example.com';
const ACTOR = 'agent:demo';

const flow = {
  key: 'demo-flow',
  version: 'demo-flow/v1',
  title: 'Demo relay',
  trigger: 'a demo case arrives',
  steps: [
    {
      key: 'inspect',
      catalogRow: 'demo.inspect',
      mode: 'auto',
      holder: 'demo-desk',
      board: 'Intake',
      edge: { after: 0 },
    },
    {
      key: 'settle',
      catalogRow: 'demo.settle',
      mode: 'human',
      holder: 'human-desk',
      board: 'Close',
      edge: { after: 0 },
    },
  ],
} as FlowTemplate & { version: string };

function opened(template: FlowTemplate = flow) {
  let ids = 0;
  return instantiateFlow(template, 'sample', {
    at: '2026-08-09T17:00:00.000Z',
    id: () => `founding-${++ids}`,
  });
}

const instance = opened();

function chronicle(events = instance.events, template: FlowTemplate = flow) {
  return normalizeChronicle({ events, flows: [template] });
}

async function grant(overrides: Partial<AuthorityGrant> = {}): Promise<AuthorityGrant> {
  return {
    id: 'grant-demo',
    principal: PRINCIPAL,
    subject: ACTOR,
    actorKind: 'agent',
    capabilities: ['step:complete', 'step:propose'],
    caseIds: [instance.caseId],
    catalogSha256: await catalogDigest(chronicle().catalog),
    flows: [{ key: flow.key, version: flow.version, sha256: await flowDigest(flow) }],
    stepPolicies: [
      { flowKey: flow.key, stepKey: 'inspect', purpose: 'demo-work', money: false },
      { flowKey: flow.key, stepKey: 'settle', purpose: 'human-work', money: false },
    ],
    origins: ['shadow'],
    causeRefs: ['evidence/demo-ready/v1'],
    issuedAt: '2026-08-09T17:30:00.000Z',
    expiresAt: '2026-08-09T18:30:00.000Z',
    maxAmountCents: 500,
    ordinaryAmountCents: 300,
    evidenceVersions: ['evidence/v1'],
    policyVersions: ['policy/v1'],
    ...overrides,
  };
}

async function command(overrides: Partial<ExternalCommand> = {}): Promise<ExternalCommand> {
  const c = chronicle();
  return {
    type: 'complete-step',
    caseId: instance.caseId,
    flowKey: flow.key,
    flowVersion: flow.version,
    stepKey: 'inspect',
    stepIndex: 0,
    attempt: 1,
    expectedChronicleVersion: 7,
    expectedCaseVersion: await caseVersion(c.events, instance.caseId),
    actor: ACTOR,
    grantId: 'grant-demo',
    origin: 'shadow',
    causeRef: 'evidence/demo-ready/v1',
    idempotencyKey: 'command-1',
    evidenceVersion: 'evidence/v1',
    policyVersion: 'policy/v1',
    purpose: 'demo-work',
    amountCents: null,
    ...overrides,
  };
}

async function context(overrides: Partial<AuthorityContext> = {}): Promise<AuthorityContext> {
  let ids = 0;
  return {
    chronicle: chronicle(),
    chronicleVersion: 7,
    authenticatedPrincipal: PRINCIPAL,
    currentEvidenceVersion: 'evidence/v1',
    currentPolicyVersion: 'policy/v1',
    now: NOW,
    id: () => `minted-${++ids}`,
    grant: await grant(),
    ...overrides,
  };
}

async function refusal(
  commandOverrides: Partial<ExternalCommand>,
  contextOverrides: Partial<AuthorityContext> = {},
) {
  const decision = await evaluateCommand(
    await command(commandOverrides),
    await context(contextOverrides),
  );
  expect(decision.ok).toBe(false);
  return decision.ok ? 'accepted' : decision.code;
}

describe('the deny-by-default authority kernel', () => {
  it('lets the server mint a complete, provenance-bearing batch', async () => {
    const decision = await evaluateCommand(await command(), await context());
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.events.map((event) => event.kind)).toEqual(['done', 'handed']);
    expect(decision.events[0].actor).toBe(ACTOR);
    expect(decision.events[0].authority).toMatchObject({
      grantId: 'grant-demo',
      principal: PRINCIPAL,
      actor: ACTOR,
      flowVersion: 'demo-flow/v1',
      stepKey: 'inspect',
      attempt: 1,
      causeRef: 'evidence/demo-ready/v1',
      idempotencyKey: 'command-1',
    });
  });

  it('refuses missing, unknown, and correction command fields', async () => {
    const missing = { ...(await command()) } as Record<string, unknown>;
    delete missing.causeRef;
    expect(await evaluateCommand(missing, await context())).toMatchObject({
      ok: false,
      code: 'malformed-command',
    });
    expect(
      await evaluateCommand({ ...(await command()), event: { kind: 'done' } }, await context()),
    ).toMatchObject({ ok: false, code: 'malformed-command' });
    expect(
      await evaluateCommand({ ...(await command()), type: 'correct-event' }, await context()),
    ).toMatchObject({ ok: false, code: 'malformed-command' });
  });

  it('refuses future, repeated, and stale step claims', async () => {
    expect(
      await refusal({ stepKey: 'settle', stepIndex: 1, purpose: 'human-work' }),
    ).toBe('wrong-step');
    expect(await refusal({ attempt: 2 })).toBe('wrong-attempt');
    expect(await refusal({ expectedChronicleVersion: 6 })).toBe('stale-chronicle');
    expect(await refusal({ expectedCaseVersion: 'sha256:' + '0'.repeat(64) })).toBe('stale-case');
  });

  it('uses collision-resistant case tokens', async () => {
    const first = await caseVersion(instance.events, instance.caseId);
    const changed = await caseVersion(
      [...instance.events, { ...instance.events[1], id: 'another-id' }],
      instance.caseId,
    );
    expect(first).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(changed).not.toBe(first);
  });

  it('binds a trusted version to the complete flow digest', async () => {
    expect(await refusal({ flowVersion: 'demo-flow/v0' })).toBe('out-of-scope');
    const altered = {
      ...flow,
      title: 'Changed bytes under the same label',
    } as FlowTemplate & { version: string };
    const c = chronicle(instance.events, altered);
    expect(await refusal({}, { chronicle: c })).toBe('flow-digest-mismatch');
  });

  it('binds inherited unattended mode to the complete catalog digest', async () => {
    const inherited = {
      ...flow,
      steps: [{ ...flow.steps[0], mode: undefined }, flow.steps[1]],
    } as FlowTemplate & { version: string };
    const inheritedInstance = opened(inherited);
    const autoCatalog = [
      ...chronicle().catalog,
      { key: 'demo.inspect', title: 'Demo inspect', mode: 'auto' as const },
    ];
    const allowed = normalizeChronicle({
      events: inheritedInstance.events,
      flows: [inherited],
      catalog: autoCatalog,
    });
    const boundGrant = await grant({
      catalogSha256: await catalogDigest(autoCatalog),
      flows: [{ key: flow.key, version: flow.version, sha256: await flowDigest(inherited) }],
    });
    const mutated = normalizeChronicle({
      events: inheritedInstance.events,
      flows: [inherited],
      catalog: autoCatalog.map((row) =>
        row.key === 'demo.inspect' ? { ...row, mode: 'human' as const } : row,
      ),
    });
    expect(
      await refusal(
        { expectedCaseVersion: await caseVersion(allowed.events, inheritedInstance.caseId) },
        { chronicle: mutated, grant: boundGrant },
      ),
    ).toBe('catalog-digest-mismatch');
  });

  it('refuses unversioned and migrated-legacy flows operationally', async () => {
    const record = { ...flow } as Record<string, unknown>;
    delete record.version;
    const unversioned = record as unknown as FlowTemplate;
    expect(declaredFlowVersion(unversioned)).toBeNull();
    expect(await refusal({}, { chronicle: chronicle(instance.events, unversioned) })).toBe(
      'unversioned-flow',
    );
    const legacy = { ...flow, version: 'legacy-unversioned' } as FlowTemplate;
    expect(await refusal({ flowVersion: 'legacy-unversioned' }, { chronicle: chronicle(instance.events, legacy) })).toBe(
      'unversioned-flow',
    );
  });

  it('refuses forged actors, expired or mismatched grants, and missing capabilities', async () => {
    expect(await refusal({ actor: 'agent:other' })).toBe('forged-actor');
    expect(await refusal({}, { grant: await grant({ expiresAt: NOW }) })).toBe('expired-grant');
    expect(await refusal({}, { grant: await grant({ caseIds: ['demo-flow: another'] }) })).toBe(
      'out-of-scope',
    );
    expect(await refusal({}, { grant: await grant({ capabilities: ['step:propose'] }) })).toBe(
      'missing-capability',
    );
  });

  it('requires trusted opaque cause references', async () => {
    expect(await refusal({ causeRef: 'because it looked ready' })).toBe('wrong-cause');
    expect(await refusal({ causeRef: 'evidence/not-granted/v1' })).toBe('wrong-cause');
  });

  it('requires trusted step money classification and an exact amount', async () => {
    expect(await refusal({ amountCents: 1 })).toBe('amount-refused');
    const moneyGrant = await grant({
      stepPolicies: [
        { flowKey: flow.key, stepKey: 'inspect', purpose: 'money-work', money: true },
      ],
    });
    expect(await refusal({ purpose: 'money-work' }, { grant: moneyGrant })).toBe('amount-refused');
    expect(await refusal({ purpose: 'money-work', amountCents: 501 }, { grant: moneyGrant })).toBe(
      'amount-refused',
    );
    expect(await refusal({ purpose: 'money-work', amountCents: 301 }, { grant: moneyGrant })).toBe(
      'human-only',
    );
  });

  it('keeps approval and override human-only even if an agent grant lists them', async () => {
    const proposal = proposeStep(flow, instance.caseId, 0, ACTOR, {
      at: '2026-08-09T17:30:00.000Z',
      id: () => 'proposal-1',
    });
    const events = [...instance.events, ...(proposal ? [proposal] : [])];
    const c = chronicle(events);
    const expectedCaseVersion = await caseVersion(c.events, instance.caseId);
    const agentGrant = await grant({ capabilities: ['step:approve', 'step:override'] });
    expect(
      await refusal({ type: 'approve-step', expectedCaseVersion }, { chronicle: c, grant: agentGrant }),
    ).toBe('human-only');
    expect(
      await refusal({ type: 'override-step', expectedCaseVersion }, { chronicle: c, grant: agentGrant }),
    ).toBe('human-only');
  });

  it('does not let a human complete around the distinct approval capability', async () => {
    const proposal = proposeStep(flow, instance.caseId, 0, ACTOR, {
      at: '2026-08-09T17:30:00.000Z',
      id: () => 'proposal-human-ratchet',
    });
    const c = chronicle([...instance.events, ...(proposal ? [proposal] : [])]);
    const humanCompleteGrant = await grant({ actorKind: 'human', capabilities: ['step:complete'] });
    expect(
      await refusal(
        { type: 'complete-step', expectedCaseVersion: await caseVersion(c.events, instance.caseId) },
        { chronicle: c, grant: humanCompleteGrant },
      ),
    ).toBe('proposal-requires-ratification');
  });

  it('refuses agent completion on human, outside-wait, and unresolved modes', async () => {
    for (const first of [
      { ...flow.steps[0], mode: 'human' as const },
      { ...flow.steps[0], mode: 'auto' as const, condition: 'until an outside answer arrives' },
      { ...flow.steps[0], mode: undefined },
    ]) {
      const variant = { ...flow, steps: [first, flow.steps[1]] } as FlowTemplate & {
        version: string;
      };
      const variantInstance = opened(variant);
      const c = chronicle(variantInstance.events, variant);
      const variantGrant = await grant({
        flows: [{ key: flow.key, version: flow.version, sha256: await flowDigest(variant) }],
      });
      expect(
        await refusal(
          { expectedCaseVersion: await caseVersion(c.events, variantInstance.caseId) },
          { chronicle: c, grant: variantGrant },
        ),
      ).toBe('unattended-refused');
    }
  });

  it('refuses an accepted idempotency key on the same current case', async () => {
    const prior = {
      ...instance.events[0],
      authority: { idempotencyKey: 'command-1' },
    };
    const c = chronicle([prior, ...instance.events.slice(1)]);
    expect(
      await refusal(
        { expectedCaseVersion: await caseVersion(c.events, instance.caseId) },
        { chronicle: c },
      ),
    ).toBe('replay');
  });

  it('refuses a second proposal while one already awaits judgment', async () => {
    const proposal = proposeStep(flow, instance.caseId, 0, ACTOR, {
      at: '2026-08-09T17:30:00.000Z',
      id: () => 'proposal-existing',
    });
    const c = chronicle([...instance.events, ...(proposal ? [proposal] : [])]);
    expect(
      await refusal(
        {
          type: 'propose-step',
          idempotencyKey: 'proposal-fresh-key',
          expectedCaseVersion: await caseVersion(c.events, instance.caseId),
        },
        { chronicle: c },
      ),
    ).toBe('proposal-already-pending');
  });

  it('refuses stale evidence and policy versions', async () => {
    expect(await refusal({ evidenceVersion: 'evidence/v0' })).toBe('stale-evidence');
    expect(await refusal({ policyVersion: 'policy/v0' })).toBe('stale-policy');
  });
});
