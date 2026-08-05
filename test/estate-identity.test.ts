// The real-property estate-identity layer: a case carries a stable estate slug
// on its spine, folded by readCase, so the spend gate can read that estate's own
// cap. Proven to BIND (a per-estate cap now bites a case on that estate) while
// staying byte-identical when no estate id is present (the house cap, as before).
// Every id here is synthetic — real properties load attended, never in code.
import { describe, it, expect } from 'vitest';
import { instantiateFlow, FOUNDING_FLOWS } from '../src/domain/flows';
import { readCase } from '../src/domain/events';
import { spendGate, FOUNDING_ECONOMY } from '../src/domain/economy';
import { FOUNDING_ESTATES, estatesAtFounding, estateLabel, parseEstateBook } from '../src/domain/estate';
import { FOUNDING_CHRONICLE, normalizeChronicle, isFoundingChronicle } from '../src/domain/chronicle';

let n = 0;
const ids = () => `est-${(n += 1)}`;
const tpl = FOUNDING_FLOWS[0];
const AT = '2026-07-01T00:00:00.000Z';

describe('estate identity — the case spine carries a stable estate slug', () => {
  it('instantiateFlow stamps estateId on the opened event; readCase folds it forward', () => {
    const inst = instantiateFlow(tpl, 'a property', { at: AT, id: ids, estateId: 'harrow-c' });
    expect(inst.events.find((e) => e.kind === 'opened')?.estateId).toBe('harrow-c');
    expect(readCase(inst.events, inst.caseId).estateId).toBe('harrow-c');
  });

  it('a case with no estateId folds to null (byte-identical to before)', () => {
    const inst = instantiateFlow(tpl, 'a property', { at: AT, id: ids });
    expect(inst.events.find((e) => e.kind === 'opened')?.estateId).toBeUndefined();
    expect(readCase(inst.events, inst.caseId).estateId).toBeNull();
  });
});

describe('the binding proof — a per-estate cap now BINDS through the case spine', () => {
  // FOUNDING_ECONOMY: house cap $400 (40000); the seeded harrow-c override $1,000 (100000).
  const spend = 60000; // $600 — above the house cap, below harrow-c's

  it('a spend on the higher-cap estate CLEARS; the same spend on an unlisted estate GATES', () => {
    expect(spendGate(FOUNDING_ECONOMY, spend, 'harrow-c').needsApproval).toBe(false); // $600 < $1,000
    expect(spendGate(FOUNDING_ECONOMY, spend, undefined).needsApproval).toBe(true); // house cap $400, as before
    expect(spendGate(FOUNDING_ECONOMY, spend, 'no-such-estate').needsApproval).toBe(true); // unlisted → house cap
  });

  it('the case spine feeds the gate end-to-end: readCase(estateId) → spendGate', () => {
    const inst = instantiateFlow(tpl, 'harrow property', { at: AT, id: ids, estateId: 'harrow-c' });
    const estateId = readCase(inst.events, inst.caseId).estateId ?? undefined;
    expect(spendGate(FOUNDING_ECONOMY, spend, estateId).needsApproval).toBe(false);
  });
});

describe('the estate roster book — founding empty, tolerant migration', () => {
  it('founding is empty and reads as founding', () => {
    expect(estatesAtFounding(FOUNDING_ESTATES)).toBe(true);
    expect(isFoundingChronicle(normalizeChronicle(structuredClone(FOUNDING_CHRONICLE)))).toBe(true);
  });

  it('a chronicle predating the estates shelf migrates to the empty founding book', () => {
    const raw = structuredClone(FOUNDING_CHRONICLE) as Record<string, unknown>;
    delete raw.estates;
    const doc = normalizeChronicle(raw);
    expect(doc.estates).toEqual([]);
    expect(isFoundingChronicle(doc)).toBe(true); // still founding
  });

  it('estateLabel resolves a slug to its label, falling back to the raw slug', () => {
    const roster = [{ id: 'harrow-c', label: '123 Harrow Court' }];
    expect(estateLabel(roster, 'harrow-c')).toBe('123 Harrow Court');
    expect(estateLabel(roster, 'unlisted')).toBe('unlisted'); // fallback: never rejects a record
    expect(estateLabel(roster, null)).toBe('');
  });

  it('a loaded estate roster flips isFoundingChronicle to non-founding', () => {
    const doc = normalizeChronicle(structuredClone(FOUNDING_CHRONICLE));
    doc.estates = [{ id: 'harrow-c', label: '123 Harrow Court' }];
    expect(isFoundingChronicle(doc)).toBe(false);
  });
});

describe('parseEstateBook — the attended roster gate validates hard at the door', () => {
  it('reads a well-formed roster, trimming and keeping order', () => {
    const p = parseEstateBook('[{"id":" harrow-c ","label":" 12 Harrow Court "},{"id":"willow-4","label":"4 Willow Way"}]');
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.roster).toEqual([
        { id: 'harrow-c', label: '12 Harrow Court' },
        { id: 'willow-4', label: '4 Willow Way' },
      ]);
    }
  });

  it('an empty array is valid — the revert-to-founding shape', () => {
    const p = parseEstateBook('[]');
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.roster).toEqual([]);
  });

  it('refuses non-JSON, a non-array, a rowless shape, and unknown fields', () => {
    expect(parseEstateBook('not json').ok).toBe(false);
    expect(parseEstateBook('{"id":"a","label":"b"}').ok).toBe(false);
    expect(parseEstateBook('["harrow-c"]').ok).toBe(false);
    const extra = parseEstateBook('[{"id":"a","label":"b","capCents":1}]');
    expect(extra.ok).toBe(false);
    if (!extra.ok) expect(extra.error).toContain('capCents');
  });

  it('refuses a missing/empty id or label, and a duplicate id', () => {
    expect(parseEstateBook('[{"label":"b"}]').ok).toBe(false);
    expect(parseEstateBook('[{"id":"a","label":"  "}]').ok).toBe(false);
    const dup = parseEstateBook('[{"id":"a","label":"b"},{"id":"a","label":"c"}]');
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error).toContain('twice');
  });
});
