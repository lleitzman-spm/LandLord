import { describe, it, expect } from 'vitest';
import {
  normalizeChronicle,
  isFoundingChronicle,
  FOUNDING_CHRONICLE,
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

  it('the founding chronicle reads as founding', () => {
    expect(isFoundingChronicle(foundingDoc())).toBe(true);
  });
});
