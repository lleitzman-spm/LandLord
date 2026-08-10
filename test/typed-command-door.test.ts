import { afterEach, describe, expect, it, vi } from 'vitest';
import { caseVersion, type AuthorityGrant, type ExternalCommand } from '../src/domain/authority';
import { instantiateFlow, type FlowTemplate } from '../src/domain/flows';
import { handleCommand } from '../src/server/command';
import worker, { type Env } from '../src/worker';

const flow = {
  key: 'door-demo',
  version: 'door-demo/v1',
  title: 'Door demo',
  trigger: 'a test arrives',
  steps: [
    {
      key: 'work',
      catalogRow: 'door.work',
      holder: 'demo-desk',
      board: 'Demo',
      edge: { after: 0 },
    },
  ],
} as FlowTemplate & { version: string };
let id = 0;
const instance = instantiateFlow(flow, 'sample', {
  at: '2026-08-09T17:00:00.000Z',
  id: () => `opening-${++id}`,
});
const doc = { rev: 4, flows: [flow], events: instance.events };

const grant: AuthorityGrant = {
  id: 'door-grant',
  principal: 'worker@example.com',
  subject: 'agent:demo',
  actorKind: 'agent',
  capabilities: ['step:complete'],
  caseIds: [instance.caseId],
  flowKeys: [flow.key],
  origins: ['shadow'],
  purposes: ['demo-work'],
  issuedAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2027-01-01T00:00:00.000Z',
  maxAmountCents: null,
  ordinaryAmountCents: null,
  amountRequiredPurposes: [],
  evidenceVersions: ['evidence/v1'],
  policyVersions: ['policy/v1'],
};

const command: ExternalCommand = {
  type: 'complete-step',
  caseId: instance.caseId,
  flowKey: flow.key,
  flowVersion: flow.version,
  stepKey: 'work',
  stepIndex: 0,
  attempt: 1,
  expectedChronicleVersion: 4,
  expectedCaseVersion: caseVersion(instance.events, instance.caseId),
  actor: 'agent:demo',
  grantId: 'door-grant',
  origin: 'shadow',
  cause: 'the demo step is ready',
  idempotencyKey: 'door-command-1',
  evidenceVersion: 'evidence/v1',
  policyVersion: 'policy/v1',
  correctionTarget: null,
  purpose: 'demo-work',
  amountCents: null,
  note: null,
};

const env = {
  LANDLORD_AUTHORITY_GRANTS: JSON.stringify([grant]),
  LANDLORD_EVIDENCE_VERSION: 'evidence/v1',
  LANDLORD_POLICY_VERSION: 'policy/v1',
};

const vault = {
  rest: 'https://vault.example/rest/v1',
  headers: { apikey: 'test-only' },
  docId: 'chronicle:worker@example.com',
};

afterEach(() => vi.unstubAllGlobals());

describe('the typed command door', () => {
  it('is private at the Worker wall', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await worker.fetch(
      new Request('https://landlord.app/api/command', { method: 'POST', body: '{}' }),
      {
        ASSETS: { fetch: vi.fn(async () => new Response('asset')) },
      } as Env,
    );
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not expose a generic canonical Chronicle writer', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await worker.fetch(
      new Request('https://landlord.app/api/canonical/chronicle', {
        method: 'PUT',
        headers: { Authorization: 'Bearer canonical-test-capability' },
        body: JSON.stringify({ rev: 1, events: [] }),
      }),
      {
        CANONICAL_CAPABILITY_TOKEN: 'canonical-test-capability',
        SUPABASE_URL: 'https://vault.example',
        SUPABASE_SECRET_KEY: 'test-only',
        ASSETS: { fetch: vi.fn(async () => new Response('asset')) },
      } as Env,
    );
    expect(response.status).toBe(405);
    expect(await response.text()).toBe('typed commands only');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('persists only the server-minted event batch', async () => {
    const calls: { method: string; body?: unknown }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { method?: string; body?: string } = {}) => {
        calls.push({
          method: init.method ?? 'GET',
          body: init.body ? JSON.parse(init.body) : undefined,
        });
        if (!init.method) return new Response(JSON.stringify([{ doc }]), { status: 200 });
        return new Response(JSON.stringify([{ id: 'written' }]), { status: 200 });
      }),
    );

    const response = await handleCommand(
      new Request('https://landlord.app/api/command', {
        method: 'POST',
        body: JSON.stringify(command),
      }),
      env,
      'worker@example.com',
      vault,
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ accepted: true, chronicleVersion: 5 });
    const write = calls.find((call) => call.method === 'PATCH');
    const written = (write?.body as { doc?: { events?: unknown[]; rev?: number } }).doc;
    expect(written?.rev).toBe(5);
    expect(written?.events).toHaveLength(instance.events.length + 1);
    expect(written?.events?.at(-1)).toMatchObject({
      kind: 'done',
      actor: 'agent:demo',
      authority: {
        grantId: 'door-grant',
        idempotencyKey: 'door-command-1',
      },
    });
  });

  it('rejects a caller-supplied event shape before any write', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { method?: string } = {}) => {
        calls.push(init.method ?? 'GET');
        return new Response(JSON.stringify([{ doc }]), { status: 200 });
      }),
    );
    const response = await handleCommand(
      new Request('https://landlord.app/api/command', {
        method: 'POST',
        body: JSON.stringify({ ...command, event: { kind: 'approved' } }),
      }),
      env,
      'worker@example.com',
      vault,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      accepted: false,
      refusal: { code: 'malformed-command' },
    });
    expect(calls).toEqual(['GET']);
  });

  it('does not replay an accepted command after a compare-and-set conflict', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { method?: string } = {}) => {
        calls.push(init.method ?? 'GET');
        if (!init.method) return new Response(JSON.stringify([{ doc }]), { status: 200 });
        return new Response(JSON.stringify([]), { status: 200 });
      }),
    );
    const response = await handleCommand(
      new Request('https://landlord.app/api/command', {
        method: 'POST',
        body: JSON.stringify(command),
      }),
      env,
      'worker@example.com',
      vault,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      accepted: false,
      refusal: { code: 'stale-chronicle' },
    });
    expect(calls).toEqual(['GET', 'PATCH']);
  });
});
