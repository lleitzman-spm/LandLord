import { describe, expect, it } from 'vitest';
import {
  AUDIT_SHADOW_PROOF,
  createAuditShadowWorker,
} from '../src/audit-shadow-worker';

const worker = createAuditShadowWorker();

describe('isolated audit activation proof', () => {
  it('answers only the static proof path', async () => {
    const response = await worker.fetch(new Request('https://probe.invalid/proof?ignored=1'));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(await response.json()).toEqual(AUDIT_SHADOW_PROOF);
  });

  it('answers HEAD without a body', async () => {
    const response = await worker.fetch(
      new Request('https://probe.invalid/proof', { method: 'HEAD' }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
  });

  it('refuses writes and unrelated paths', async () => {
    const write = await worker.fetch(
      new Request('https://probe.invalid/proof', { method: 'POST', body: '{}' }),
    );
    const unrelated = await worker.fetch(new Request('https://probe.invalid/'));

    expect(write.status).toBe(405);
    expect(write.headers.get('allow')).toBe('GET, HEAD');
    expect(await write.text()).toBe('');
    expect(unrelated.status).toBe(404);
    expect(await unrelated.text()).toBe('');
  });
});
