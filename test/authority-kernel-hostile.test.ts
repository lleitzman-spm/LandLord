import { describe, expect, it } from 'vitest';
import {
  caseVersion,
  declaredFlowVersion,
  evaluateCommand,
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
      holder: 'demo-desk',
      board: 'Intake',
      edge: { after: 0 },
    },
    {
      key: 'settle',
      catalogRow: 'demo.settle',
      holder: 'human-desk',
      board: 'Close',
      edge: { after: 0 },
    },
  ],
} as FlowTemplate & { version: string };

let n = 0;
const instance = instantiateFlow(flow, 'sample', {
  at: '2026-08-09T17:00:00.000Z',
  id: () => `founding-${++n}`,
});

function chronicle(events = instance.events) {
  return normalizeChronicle({ events, flows: [flow] });
}

function grant(overrides: Partial<AuthorityGrant> = {}): AuthorityGrant {
  return {
    id: 'grant-demo',
    principal: PRINCIPAL,
    subject: ACTOR,
    actorKind: 'agent',
    capabilities: ['step:complete', 'step:propose', 'event:correct'],
    caseIds: [instance.caseId],
    flowKeys: [flow.key],
    origins: ['shadow'],
    purposes: ['demo-work'],
    issuedAt: '2026-08-09T17:30:00.000Z',
    expiresAt: '2026-08-09T18:30:00.000Z',
    maxAmountCents: 500,
    ordinaryAmountCents: 300,
    amountRequiredPurposes: [],
    evidenceVersions: ['evidence/v1'],
    policyVersions: ['policy/v1'],
    ...overrides,
  };
}

function command(overrides: Partial<ExternalCommand> = {}): ExternalCommand {
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
    expectedCaseVersion: caseVersion(c.events, instance.caseId),
    actor: ACTOR,
    grantId: 'grant-demo',
    origin: 'shadow',
    cause: 'the current step is ready',
    idempotencyKey: 'command-1',
    evidenceVersion: 'evidence/v1',
    policyVersion: 'policy/v1',
    correctionTarget: null,
    purpose: 'demo-work',
    amountCents: null,
    note: 'checked against the demo evidence',
    ...overrides,
  };
}

function context(overrides: Partial<AuthorityContext> = {}): AuthorityContext {
  let ids = 0;
  return {
    chronicle: chronicle(),
    chronicleVersion: 7,
    authenticatedPrincipal: PRINCIPAL,
    currentEvidenceVersion: 'evidence/v1',
    currentPolicyVersion: 'policy/v1',
    now: NOW,
    id: () => `minted-${++ids}`,
    grant: grant(),
    ...overrides,
  };
}

function refusal(
  commandOverrides: Partial<ExternalCommand>,
  contextOverrides: Partial<AuthorityContext> = {},
) {
  const decision = evaluateCommand(command(commandOverrides), context(contextOverrides));
  expect(decision.ok).toBe(false);
  return decision.ok ? 'accepted' : decision.code;
}

describe('the deny-by-default authority kernel', () => {
  it('lets the server mint a complete, provenance-bearing batch', () => {
    const decision = evaluateCommand(command(), context());
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
      idempotencyKey: 'command-1',
      evidenceVersion: 'evidence/v1',
      policyVersion: 'policy/v1',
    });
    expect(decision.events[0].id).toMatch(/^minted-/);
  });

  it('refuses missing fields and unknown fields', () => {
    const missing = { ...command() } as Record<string, unknown>;
    delete missing.cause;
    const extra = { ...command(), event: { kind: 'done' } };
    expect(evaluateCommand(missing, context())).toMatchObject({
      ok: false,
      code: 'malformed-command',
    });
    expect(evaluateCommand(extra, context())).toMatchObject({
      ok: false,
      code: 'malformed-command',
    });
  });

  it('refuses wrong, future, and repeated step claims', () => {
    expect(refusal({ stepKey: 'settle', stepIndex: 1 })).toBe('wrong-step');
    expect(refusal({ attempt: 2 })).toBe('wrong-attempt');

    const first = evaluateCommand(command(), context());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const moved = chronicle([...instance.events, ...first.events]);
    expect(
      refusal(
        {
          idempotencyKey: 'command-2',
          expectedChronicleVersion: 8,
          expectedCaseVersion: caseVersion(moved.events, instance.caseId),
        },
        { chronicle: moved, chronicleVersion: 8 },
      ),
    ).toBe('wrong-step');
  });

  it('refuses stale flow, Chronicle, case, evidence, and policy versions', () => {
    expect(refusal({ flowVersion: 'demo-flow/v0' })).toBe('stale-flow');
    expect(refusal({ expectedChronicleVersion: 6 })).toBe('stale-chronicle');
    expect(refusal({ expectedCaseVersion: 'case-v1:stale' })).toBe('stale-case');
    expect(refusal({ evidenceVersion: 'evidence/v0' })).toBe('stale-evidence');
    expect(refusal({ policyVersion: 'policy/v0' })).toBe('stale-policy');
  });

  it('refuses an unversioned historical flow at the operational seam', () => {
    const unversionedRecord = { ...flow } as Record<string, unknown>;
    delete unversionedRecord.version;
    const unversioned = unversionedRecord as unknown as FlowTemplate;
    const c = normalizeChronicle({ events: instance.events, flows: [unversioned] });
    expect(declaredFlowVersion(unversioned)).toBeNull();
    expect(refusal({}, { chronicle: c })).toBe('unversioned-flow');

    const migratedLegacy = { ...flow, version: 'legacy-unversioned' };
    const legacyChronicle = normalizeChronicle({
      events: instance.events,
      flows: [migratedLegacy],
    });
    expect(declaredFlowVersion(migratedLegacy)).toBeNull();
    expect(refusal({ flowVersion: 'legacy-unversioned' }, { chronicle: legacyChronicle })).toBe(
      'unversioned-flow',
    );
  });

  it('refuses forged actors, expired or mismatched grants, and missing capabilities', () => {
    expect(refusal({ actor: 'agent:other' })).toBe('forged-actor');
    expect(refusal({}, { grant: grant({ expiresAt: NOW }) })).toBe('expired-grant');
    expect(refusal({}, { grant: grant({ caseIds: ['demo-flow: another'] }) })).toBe(
      'out-of-scope',
    );
    expect(refusal({}, { grant: grant({ capabilities: ['step:propose'] }) })).toBe(
      'missing-capability',
    );
  });

  it('refuses unauthorized and exceptional agent money', () => {
    expect(refusal({ amountCents: 501 })).toBe('amount-refused');
    expect(refusal({ amountCents: 301 })).toBe('human-only');
    expect(
      refusal({}, { grant: grant({ amountRequiredPurposes: ['demo-work'] }) }),
    ).toBe('amount-refused');
  });

  it('keeps approval and override human-only even if an agent grant lists them', () => {
    const proposal = proposeStep(flow, instance.caseId, 0, ACTOR, {
      at: '2026-08-09T17:30:00.000Z',
      id: () => 'proposal-1',
    });
    const events = [...instance.events, ...(proposal ? [proposal] : [])];
    const c = chronicle(events);
    const common = {
      expectedCaseVersion: caseVersion(c.events, instance.caseId),
    };
    const agentGrant = grant({ capabilities: ['step:approve', 'step:override'] });
    expect(refusal({ ...common, type: 'approve-step' }, { chronicle: c, grant: agentGrant })).toBe(
      'human-only',
    );
    expect(refusal({ ...common, type: 'override-step' }, { chronicle: c, grant: agentGrant })).toBe(
      'human-only',
    );
  });

  it('refuses replay and cross-case correction, while a same-case correction appends', () => {
    const prior = {
      ...instance.events[0],
      authority: { idempotencyKey: 'command-1', correctionTarget: null },
    };
    const replayChronicle = chronicle([prior, ...instance.events.slice(1)]);
    expect(
      refusal(
        { expectedCaseVersion: caseVersion(replayChronicle.events, instance.caseId) },
        { chronicle: replayChronicle },
      ),
    ).toBe('replay');

    expect(
      refusal({ type: 'correct-event', correctionTarget: 'event-in-another-case' }),
    ).toBe('wrong-correction-target');
    const correction = evaluateCommand(
      command({
        type: 'correct-event',
        correctionTarget: instance.events[0].id,
        idempotencyKey: 'correction-1',
      }),
      context(),
    );
    expect(correction.ok).toBe(true);
    if (!correction.ok) return;
    expect(correction.events).toHaveLength(1);
    expect(correction.events[0]).toMatchObject({
      kind: 'noted',
      authority: { correctionTarget: instance.events[0].id },
    });
  });
});
