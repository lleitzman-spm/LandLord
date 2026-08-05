import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import worker, { createWorker, type Env } from '../src/worker';
import { makeComplete } from '../src/server/brain';

const TEAM_DOMAIN = 'https://team.example.com';
const POLICY_AUD = 'landlord-audience';
const ASSETS = { fetch: vi.fn(async () => new Response('the castle', { status: 200 })) };

let signingKey: CryptoKey;
let otherSigningKey: CryptoKey;
let jwks = '';

beforeAll(async () => {
  const main = await generateKeyPair('RS256', { extractable: true });
  const other = await generateKeyPair('RS256', { extractable: true });
  signingKey = main.privateKey;
  otherSigningKey = other.privateKey;
  jwks = JSON.stringify({
    keys: [{ ...(await exportJWK(main.publicKey)), kid: 'access-key', alg: 'RS256', use: 'sig' }],
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  ASSETS.fetch.mockClear();
});

function env(overrides: Partial<Env> = {}): Env {
  return {
    TEAM_DOMAIN,
    POLICY_AUD,
    CF_ACCESS_JWKS: jwks,
    CANONICAL_CAPABILITY_TOKEN: 'test-canonical-token',
    SUPABASE_URL: 'https://vault.example',
    SUPABASE_SECRET_KEY: 'sb_secret_test',
    ASSETS,
    ...overrides,
  };
}

async function assertion(opts: {
  email?: string;
  audience?: string;
  key?: CryptoKey;
  kid?: string;
} = {}): Promise<string> {
  const claims = opts.email === undefined ? {} : { email: opts.email };
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: opts.kid ?? 'access-key' })
    .setIssuer(TEAM_DOMAIN)
    .setAudience(opts.audience ?? POLICY_AUD)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(opts.key ?? signingKey);
}

async function accessHeaders(email = 'edwin@example.com'): Promise<Record<string, string>> {
  return { 'Cf-Access-Jwt-Assertion': await assertion({ email }) };
}

/** A fake PostgREST: route by table, capture every call for assertions. */
function fakeVault(opts: { chronicleRows?: unknown[]; borderRows?: unknown[] } = {}) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  const fetchMock = vi.fn(async (url: string, init: { method?: string; body?: string } = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ url: String(url), method, body: init.body ? JSON.parse(init.body) : undefined });
    if (String(url).includes('border_arrivals')) {
      return new Response(JSON.stringify(opts.borderRows ?? []), { status: 200 });
    }
    if (String(url).includes('/chat/completions')) {
      return new Response(
        JSON.stringify({ choices: [{ message: { role: 'assistant', content: '{}' } }] }),
        { status: 200 },
      );
    }
    if (method === 'GET') {
      return new Response(JSON.stringify(opts.chronicleRows ?? []), { status: 200 });
    }
    if (method === 'POST') return new Response(JSON.stringify([{ id: 'x' }]), { status: 201 });
    return new Response(JSON.stringify([{ id: 'x' }]), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

async function get(email = 'edwin@example.com', useEnv = env()) {
  return worker.fetch(
    new Request('https://landlord.app/api/chronicle', { headers: await accessHeaders(email) }),
    useEnv,
  );
}

async function put(body: unknown, email = 'edwin@example.com') {
  return worker.fetch(
    new Request('https://landlord.app/api/chronicle', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...(await accessHeaders(email)) },
      body: JSON.stringify(body),
    }),
    env(),
  );
}

describe('worker — verified Access identity', () => {
  it('derives the sandbox only from a valid signed assertion', async () => {
    const { calls } = fakeVault({ chronicleRows: [{ doc: { rev: 2 } }] });
    const response = await get('EDWIN@example.com');
    expect(response.status).toBe(200);
    const chronicle = calls.find((call) => call.url.includes('/chronicle?'));
    expect(chronicle?.url).toContain('id=eq.chronicle%3Aedwin%40example.com');
    expect(calls.some((call) => call.url.includes('border_arrivals'))).toBe(false);
  });

  it.each(['/api/chronicle', '/api/court', '/api/fleet'])(
    'rejects a missing assertion on %s before touching the vault',
    async (path) => {
      const { calls } = fakeVault();
      const response = await worker.fetch(new Request(`https://landlord.app${path}`), env());
      expect(response.status).toBe(401);
      expect(calls).toEqual([]);
    },
  );

  it('does not treat a raw Access email header as identity or canonical authority', async () => {
    const { calls } = fakeVault();
    const response = await worker.fetch(
      new Request('https://landlord.app/api/chronicle', {
        headers: { 'Cf-Access-Authenticated-User-Email': 'spoofed@elsewhere.test' },
      }),
      env(),
    );
    expect(response.status).toBe(401);
    expect(calls).toEqual([]);
  });

  it('keeps canonical access on a separate machine capability', async () => {
    const { calls } = fakeVault({
      chronicleRows: [{ doc: { rev: 1, marches: { arrivals: [] } } }],
    });
    const missing = await worker.fetch(
      new Request('https://landlord.app/api/canonical/chronicle'),
      env(),
    );
    const wrong = await worker.fetch(
      new Request('https://landlord.app/api/canonical/chronicle', {
        headers: { Authorization: 'Bearer wrong-token' },
      }),
      env(),
    );
    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(calls).toEqual([]);

    const valid = await worker.fetch(
      new Request('https://landlord.app/api/canonical/chronicle', {
        headers: { Authorization: 'Bearer test-canonical-token' },
      }),
      env(),
    );
    expect(valid.status).toBe(200);
    expect(calls.find((call) => call.url.includes('/chronicle?'))?.url).toContain(
      'id=eq.the-chronicle',
    );
    expect(calls.some((call) => call.url.includes('border_arrivals'))).toBe(true);
  });

  it('rejects the wrong audience and a forged signature', async () => {
    const { calls } = fakeVault();
    const wrongAudience = await assertion({ email: 'a@example.org', audience: 'some-other-app' });
    const forged = await assertion({ email: 'a@example.org', key: otherSigningKey });
    for (const token of [wrongAudience, forged]) {
      const response = await worker.fetch(
        new Request('https://landlord.app/api/chronicle', {
          headers: { 'Cf-Access-Jwt-Assertion': token },
        }),
        env(),
      );
      expect(response.status).toBe(401);
    }
    expect(calls).toEqual([]);
  });

  it('rejects a signed assertion with no usable identity claim', async () => {
    fakeVault();
    const response = await worker.fetch(
      new Request('https://landlord.app/api/chronicle', {
        headers: { 'Cf-Access-Jwt-Assertion': await assertion() },
      }),
      env(),
    );
    expect(response.status).toBe(401);
  });

  it('serves a new verified identity founding rather than the canonical Chronicle', async () => {
    fakeVault({ chronicleRows: [] });
    const response = await get('new@elsewhere.test');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
  });

  it('keeps a real read failure distinct from an identity failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })));
    const response = await get('new@elsewhere.test');
    expect(response.status).toBe(502);
  });

  it('writes only to the verified identity sandbox', async () => {
    const { calls } = fakeVault();
    const response = await put({ rev: 5, marches: { arrivals: [] } }, 'a@example.org');
    expect(response.status).toBe(200);
    const write = calls.find((call) => call.method === 'PATCH' || call.method === 'POST');
    expect(write?.url).toContain('chronicle%3Aa%40example.org');
    expect(calls.some((call) => call.url.includes('border_arrivals'))).toBe(false);
  });

  it('requires verifier configuration rather than failing open', async () => {
    fakeVault();
    const response = await worker.fetch(
      new Request('https://landlord.app/api/chronicle', {
        headers: await accessHeaders(),
      }),
      env({ TEAM_DOMAIN: undefined }),
    );
    expect(response.status).toBe(503);
  });

  it('authenticates before reporting missing vault configuration', async () => {
    fakeVault();
    const response = await get(
      'edwin@example.com',
      env({ SUPABASE_URL: undefined, SUPABASE_SECRET_KEY: undefined }),
    );
    expect(response.status).toBe(503);
    expect(await response.text()).toBe('vault not configured');
  });

  it('lets non-api paths fall through to the castle assets', async () => {
    const response = await worker.fetch(new Request('https://landlord.app/index.html'), env());
    expect(await response.text()).toBe('the castle');
    expect(ASSETS.fetch).toHaveBeenCalled();
  });
});

describe('worker — fleet context boundary', () => {
  it('a blocked fleet prompt never calls the provider and never persists a proposal', async () => {
    const runFleet = vi.fn(async ({ complete }: { complete: (args: unknown) => Promise<unknown> }) => {
      try {
        await complete({
          messages: [
            {
              role: 'user',
              content: 'Resident: Alice Smith at 123 Kingsmill Way, unit B',
            },
          ],
        });
      } catch {
        // This mirrors the fleet clerks' deterministic fallback behavior.
      }
      return {
        events: [
          {
            id: 'proposal-1',
            at: '2026-07-29T00:00:00.000Z',
            caseId: 'case-1',
            kind: 'proposed',
          },
        ],
        perClerk: [],
        proposals: 1,
      };
    });
    const productionWorker = createWorker({
      runFleet,
      makeComplete,
    } as never);
    const { calls } = fakeVault({
      chronicleRows: [
        {
          doc: {
            rev: 1,
            wargame: { seed: 'guard-test', now: '2026-07-29T00:00:00.000Z' },
            events: [],
          },
        },
      ],
    });

    const response = await productionWorker.fetch(
      new Request('https://landlord.app/api/fleet', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(await accessHeaders()),
        },
        body: JSON.stringify({ cap: 1 }),
      }),
      env({ MOONSHOT_API_KEY: 'test-provider-key' }),
    );

    expect(response.status).toBe(422);
    expect(runFleet).toHaveBeenCalledOnce();
    expect(calls.some((call) => call.url.includes('/chat/completions'))).toBe(false);
    expect(calls.some((call) => call.method === 'PATCH' || call.method === 'POST')).toBe(false);
    expect(await response.json()).toEqual({
      error: 'model context refused; no clerk proposal was written',
    });
  });
});
