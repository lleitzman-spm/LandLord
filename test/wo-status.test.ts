import { describe, it, expect } from 'vitest';
import {
  FOUNDING_CATALOG,
  STATUS_ORDER,
  STATUS_LABEL,
  STATUS_MARK,
  SLA_ORDER,
  SLA_LABEL,
  statusOf,
  slaOf,
  rowsByStatus,
} from '../src/domain/catalog';

describe('catalog — WO status / SLA facets (Frontier A slice-2)', () => {
  it('every Status carries a plain label and a mark, in lifecycle order', () => {
    expect(STATUS_ORDER).toEqual(['new', 'assigned', 'scheduled', 'in-progress', 'on-hold', 'completed', 'canceled']);
    for (const s of STATUS_ORDER) {
      expect(STATUS_LABEL[s], `no label for ${s}`).toBeTruthy();
      expect(STATUS_MARK[s], `no mark for ${s}`).toBeTruthy();
    }
  });

  it('every SLA band carries a plain label, in tightest-first order', () => {
    expect(SLA_ORDER).toEqual(['same-day', '3-day', '7-day', 'scheduled']);
    for (const b of SLA_ORDER) {
      expect(SLA_LABEL[b], `no label for ${b}`).toBeTruthy();
    }
  });

  it('statusOf/slaOf resolve a known key, tolerate an unknown one', () => {
    // A founding leaf that wears both facets.
    expect(statusOf(FOUNDING_CATALOG, 'maintenance.hvac.no-cooling')).toBe('new');
    expect(slaOf(FOUNDING_CATALOG, 'maintenance.hvac.no-cooling')).toBe('same-day');
    // A row that carries neither facet (not a work order) reads undefined,
    // not a throw.
    expect(statusOf(FOUNDING_CATALOG, 'rent-post')).toBeUndefined();
    expect(slaOf(FOUNDING_CATALOG, 'rent-post')).toBeUndefined();
    // An unknown key, and no key at all, both tolerate rather than reject.
    expect(statusOf(FOUNDING_CATALOG, 'no-such-key')).toBeUndefined();
    expect(slaOf(FOUNDING_CATALOG, undefined)).toBeUndefined();
    expect(statusOf(FOUNDING_CATALOG, null)).toBeUndefined();
  });

  it('the founding catalog exercises every Status and every SLA band at least once', () => {
    const statusesSeen = new Set(FOUNDING_CATALOG.map((r) => r.status).filter(Boolean));
    const slasSeen = new Set(FOUNDING_CATALOG.map((r) => r.slaBand).filter(Boolean));
    for (const s of STATUS_ORDER) expect(statusesSeen.has(s), `no founding row wears status ${s}`).toBe(true);
    for (const b of SLA_ORDER) expect(slasSeen.has(b), `no founding row wears SLA ${b}`).toBe(true);
  });

  it('rowsByStatus groups the loaded rows by Status in STATUS_ORDER, dropping empty groups', () => {
    const groups = rowsByStatus(FOUNDING_CATALOG);
    // Groups appear in STATUS_ORDER (a subsequence — some may be dropped).
    const seenOrder = groups.map((g) => g.status);
    const expectedOrder = STATUS_ORDER.filter((s) => seenOrder.includes(s));
    expect(seenOrder).toEqual(expectedOrder);
    // No empty group ever appears.
    for (const g of groups) expect(g.rows.length).toBeGreaterThan(0);
    // Every row in a group actually carries that status.
    for (const g of groups) {
      for (const row of g.rows) expect(row.status).toBe(g.status);
    }
    // A row with no status is not in any group.
    const grouped = new Set(groups.flatMap((g) => g.rows.map((r) => r.key)));
    for (const row of FOUNDING_CATALOG) {
      if (!row.status) expect(grouped.has(row.key)).toBe(false);
    }
  });

  it('the facets are additive — every existing FOUNDING_CATALOG key is still present, unrenamed', () => {
    // A regression guard against the correctness landmine noted in catalog.ts:
    // readFlow matches by catalogRow key, so a rename would silently break the
    // relay. This slice must only ADD fields, never touch a key.
    const keys = FOUNDING_CATALOG.map((r) => r.key);
    expect(keys).toContain('work-order');
    expect(keys).toContain('scope-the-turn');
    expect(keys).toContain('work-the-turn');
    expect(keys).toContain('onboarding.make-ready');
    expect(keys).toContain('maintenance.hvac.no-cooling');
    expect(keys).toContain('maintenance.escalation.habitability');
  });
});
