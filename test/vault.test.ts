import { describe, it, expect, vi, afterEach } from 'vitest';
import { revOf, revFilter, vaultCasWrite, vaultReadDoc, CANONICAL_DOC_ID } from '../src/server/vault';

afterEach(() => vi.unstubAllGlobals());

const REST = 'https://x/rest/v1';
const res = (body: unknown, status = 200) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

describe('vault — rev token', () => {
  it('revOf reads a numeric rev, else 0', () => {
    expect(revOf({ rev: 7 })).toBe(7);
    expect(revOf({})).toBe(0);
    expect(revOf(null)).toBe(0);
    expect(revOf({ rev: 'x' })).toBe(0);
  });

  it('revFilter matches null-or-0 at base 0 (bootstrap), exact past that', () => {
    expect(revFilter(0)).toContain('is.null');
    expect(revFilter(0)).toContain('.eq.0');
    expect(revFilter(3)).toBe('doc-%3E%3Erev=eq.3');
  });
});

describe('vault — read', () => {
  it('ok returns the doc, absent on zero rows, error on refusal', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res([{ doc: { rev: 4 } }])));
    expect(await vaultReadDoc(REST, {}, CANONICAL_DOC_ID)).toEqual({ status: 'ok', doc: { rev: 4 } });
    vi.stubGlobal('fetch', vi.fn(async () => res([])));
    expect(await vaultReadDoc(REST, {}, 'chronicle:new@example.com')).toEqual({ status: 'absent' });
    vi.stubGlobal('fetch', vi.fn(async () => res('nope', 500)));
    expect(await vaultReadDoc(REST, {}, CANONICAL_DOC_ID)).toEqual({ status: 'error' });
  });

  it('encodes the id (email sandbox) into the filter', async () => {
    const fetchMock = vi.fn(async () => res([{ doc: {} }]));
    vi.stubGlobal('fetch', fetchMock);
    await vaultReadDoc(REST, {}, 'chronicle:a.b@example.net');
    expect(String(fetchMock.mock.calls[0][0])).toContain('id=eq.chronicle%3Aa.b%40example.net');
  });
});

describe('vault — compare-and-set write, base ≥ 1 (PATCH)', () => {
  it('commits when the row matches (non-empty representation)', async () => {
    const fetchMock = vi.fn(async () => res([{ id: CANONICAL_DOC_ID }]));
    vi.stubGlobal('fetch', fetchMock);
    expect(await vaultCasWrite(REST, {}, CANONICAL_DOC_ID, { rev: 6 }, 5)).toBe('ok');
    const [url, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('PATCH');
    expect(String(url)).toContain('doc-%3E%3Erev=eq.5'); // exact rev filter past bootstrap
  });

  it('reports conflict when the row moved (empty representation)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res('[]')));
    expect(await vaultCasWrite(REST, {}, CANONICAL_DOC_ID, { rev: 6 }, 5)).toBe('conflict');
  });

  it('reports error on a refused write', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res('nope', 500)));
    expect(await vaultCasWrite(REST, {}, CANONICAL_DOC_ID, { rev: 6 }, 5)).toBe('error');
  });
});

describe('vault — compare-and-set write, base 0 (create-or-bootstrap)', () => {
  it('creates a new identity row via POST insert', async () => {
    const fetchMock = vi.fn(async () => res([{ id: 'chronicle:new@example.com' }], 201));
    vi.stubGlobal('fetch', fetchMock);
    expect(await vaultCasWrite(REST, {}, 'chronicle:new@example.com', { rev: 1 }, 0)).toBe('ok');
    // The ONLY call is a POST insert — no PATCH needed for a fresh row.
    expect(fetchMock.mock.calls).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(String(url)).toMatch(/\/chronicle$/);
    expect(JSON.parse(init.body)).toEqual({ id: 'chronicle:new@example.com', doc: { rev: 1 } });
  });

  it('falls to the bootstrap PATCH when the row already exists (POST 409)', async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (_url: string, init: { method: string }) => {
      calls.push(init.method);
      return init.method === 'POST' ? res('duplicate key', 409) : res([{ id: CANONICAL_DOC_ID }]);
    });
    vi.stubGlobal('fetch', fetchMock);
    expect(await vaultCasWrite(REST, {}, CANONICAL_DOC_ID, { rev: 1 }, 0)).toBe('ok');
    expect(calls).toEqual(['POST', 'PATCH']);
    // The PATCH uses the null-or-0 bootstrap filter (the pre-rev row).
    expect(String(fetchMock.mock.calls[1][0])).toContain('is.null');
  });

  it('a lost create race yields conflict (POST 409, then PATCH matches 0 rows)', async () => {
    const fetchMock = vi.fn(async (_url: string, init: { method: string }) =>
      init.method === 'POST' ? res('duplicate key', 409) : res('[]'),
    );
    vi.stubGlobal('fetch', fetchMock);
    // The winner already advanced the rev, so the null-or-0 PATCH matches nothing.
    expect(await vaultCasWrite(REST, {}, CANONICAL_DOC_ID, { rev: 1 }, 0)).toBe('conflict');
  });

  it('a real insert failure (not a duplicate) is an error, not a conflict', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res('column missing', 400)));
    expect(await vaultCasWrite(REST, {}, 'chronicle:new@example.com', { rev: 1 }, 0)).toBe('error');
  });
});
