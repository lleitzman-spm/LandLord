import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import {
  caseVersion,
  flowDigest,
  type AuthorityGrant,
  type ExternalCommand,
} from '../src/domain/authority';
import { instantiateFlow, type FlowTemplate } from '../src/domain/flows';
import { handleCommand } from '../src/server/command';
import worker, { type Env } from '../src/worker';

const TEAM_DOMAIN = 'https://team.example.com';
const POLICY_AUD = 'landlord-audience';
let signingKey: CryptoKey;
let jwks = '';

const flow = {
  key: 'door-demo',
  version: 'door-demo/v1',
  title: 'Door demo',
  trigger: 'a test arrives',
  steps: [
    {
      key: 'work',
      catalogRow: 'door.work',
      mode: 'auto',
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

beforeAll(async () => {
  const pair = await generateKeyPair('RS256', { extractable: true });
  signingKey = pair.privateKey;
  jwks = JSON.stringify({
    keys: [{ ...(await exportJWK(pair.publicKey)), kid: 'access-key', alg: 'RS256', use: 'sig' }],
  });
});

async function assertion(email = 'worker@example.com') {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'RS256', kid: 'access-key' })
    .setIssuer(TEAM_DOMAIN)
    .setAudience(POLICY_AUD)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(signingKey);
}

async function setup() {
  const grant: AuthorityGrant = {
    id: 'door-grant',
    principal: 'worker@example.com',
    subject: 'agent:demo',
    actorKind: 'agent',
    capabilities: ['step:complete'],
    caseIds: [instance.caseId],
    flows: [{ key: flow.key, version: flow.version, sha256: await flowDigest(flow) }],
    stepPolicies: [
      { flowKey: flow.key, stepKey: 'work', purpose: 'demo-work', money: false },
    ],
    origins: ['shadow'],
    causeRefs: ['evidence/door-ready/v1'],
    issuedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2027-01-01T00:00:00.000Z',
    maxAmountCents: null,
    ordinaryAmountCents: null,
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
    expectedCaseVersion: await caseVersion(instance.events, instance.caseId),
    actor: 'agent:demo',
    grantId: 'door-grant',
    origin: 'shadow',
    causeRef: 'evidence/door-ready/v1',
    idempotencyKey: 'door-command-1',
    evidenceVersion: 'evidence/v1',
    policyVersion: 'policy/v1',
    purpose: 'demo-work',
    amountCents: null,
  };
  return {
    grant,
    command,
    env: {
      LANDLORD_AUTHORITY_GRANTS: JSON.stringify([grant]),
      LANDLORD_EVIDENCE_VERSION: 'evidence/v1',
      LANDLORD_POLICY_VERSION: 'policy/v1',
    },
  };
}

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
      { ASSETS: { fetch: vi.fn(async () => new Response('asset')) } } as Env,
    );
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('denies generic PUT on the exact per-identity document used by commands', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await worker.fetch(
      new Request('https://landlord.app/api/chronicle', {
        method: 'PUT',
        headers: { 'Cf-Access-Jwt-Assertion': await assertion() },
        body: JSON.stringify({ rev: 5, events: [{ kind: 'approved' }] }),
      }),
      {
        TEAM_DOMAIN,
        POLICY_AUD,
        CF_ACCESS_JWKS: jwks,
        SUPABASE_URL: 'https://vault.example',
        SUPABASE_SECRET_KEY: 'test-only',
        ASSETS: { fetch: vi.fn(async () => new Response('asset')) },
      } as Env,
    );
    expect(response.status).toBe(405);
    expect(await response.text()).toBe('typed commands only');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('denies generic PUT on the canonical document too', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await worker.fetch(
      new Request('https://landlord.app/api/canonical/chronicle', {
        method: 'PUT',
        headers: { Authorization: 'Bearer canonical-test-capability' },
        body: JSON.stringify({ rev: 5, events: [] }),
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

  it('keeps the untyped fleet writer shut', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await worker.fetch(
      new Request('https://landlord.app/api/fleet', {
        method: 'POST',
        headers: { 'Cf-Access-Jwt-Assertion': await assertion() },
      }),
      {
        TEAM_DOMAIN,
        POLICY_AUD,
        CF_ACCESS_JWKS: jwks,
        ASSETS: { fetch: vi.fn(async () => new Response('asset')) },
      } as Env,
    );
    expect(response.status).toBe(503);
    expect(await response.text()).toContain('fleet disabled');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('persists only the server-minted event batch', async () => {
    const { env, command } = await setup();
    const calls: { method: string; body?: unknown }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { method?: string; body?: string } = {}) => {
        calls.push({ method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined });
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
    const write = calls.find((call) => call.method === 'PATCH');
    const written = (write?.body as { doc?: { events?: unknown[]; rev?: number } }).doc;
    expect(written?.rev).toBe(5);
    expect(written?.events?.at(-1)).toMatchObject({
      kind: 'done',
      actor: 'agent:demo',
      authority: { grantId: 'door-grant', idempotencyKey: 'door-command-1' },
    });
  });

  it('rejects caller-supplied event shape before any write', async () => {
    const { env, command } = await setup();
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
    expect(calls).toEqual(['GET']);
  });

  it('does not replay an accepted command after a compare-and-set conflict', async () => {
    const { env, command } = await setup();
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
    expect(calls).toEqual(['GET', 'PATCH']);
  });
});
