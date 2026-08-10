import { describe, it, expect } from 'vitest';
import {
  normalizeChronicle,
  isFoundingChronicle,
  FOUNDING_CHRONICLE,
  LEGACY_FLOW_VERSION,
} from '../src/domain/chronicle';
import { foundingDoc } from './fixtures';

describe('chronicle — the migration seam', () => {
  it('normalizeChronicle is idempotent', () => {
    const once = normalizeChronicle(FOUNDING_CHRONICLE);
    const twice = normalizeChronicle(once);
    expect(twice).toEqual(once);
  });

  it('an empty object normalizes to founding state', () => {
    expect(isFoundingChronicle(normalizeChronicle({}))).toBe(true);
  });

  it('a present-but-empty catalog shelf stays empty (truth as struck, not re-seeded)', () => {
    const c = normalizeChronicle({ catalog: [] });
    expect(c.catalog).toEqual([]);
  });

  it('an absent catalog shelf adopts the founding rows', () => {
    const c = normalizeChronicle({});
    expect(c.catalog.length).toBeGreaterThan(0);
  });

  it('marks a present unversioned flow as legacy instead of inventing a current version', () => {
    const legacy = structuredClone(FOUNDING_CHRONICLE.flows[0]) as unknown as Record<string, unknown>;
    delete legacy.version;
    const c = normalizeChronicle({ flows: [legacy] });
    expect(c.flows[0].version).toBe(LEGACY_FLOW_VERSION);
  });

  it('the founding chronicle reads as founding', () => {
    expect(isFoundingChronicle(foundingDoc())).toBe(true);
  });
});
