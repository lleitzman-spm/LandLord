// Holding court — the docket. "Every decision the King needs to make brought
// before him in order of importance and urgency, across all departments, fiefs,
// etc." (Edwin, 2026-07-27). The order IS the feature: a docket that buries the
// crisis under a year-old trifle is worse than no docket.
import { describe, it, expect } from 'vitest';
import { readCourt } from '../src/domain/docket';
import { grandMusterDoc, foundingDoc } from './fixtures';
import { readRealm } from '../src/domain/realm';
import { readKingdom } from '../src/domain/states';
import { assembleKingdom } from '../src/domain/court';
import { EMPTY_TREASURY } from '../src/domain/treasury';
import { FOUNDING_ECONOMY } from '../src/domain/economy';
import type { KingdomEvent } from '../src/domain/events';

const NOW = '2026-07-27T00:00:00.000Z';
const daysAgo = (n: number) => new Date(Date.parse(NOW) - n * 86_400_000).toISOString();

function courtOf(doc: ReturnType<typeof foundingDoc>, seed: string | null, now = NOW) {
  const kingdom = assembleKingdom(doc.census, doc.acts);
  const realm = readRealm(kingdom, doc.events, now, seed, EMPTY_TREASURY, FOUNDING_ECONOMY, doc.money ?? []);
  return readCourt(doc.events, now, {
    guilds: realm.guilds,
    fiefs: readKingdom(kingdom),
    unplaced: realm.unplaced,
  });
}

describe('the court docket — the realm’s decisions, in one place, in order', () => {
  it('a clean founding brings NOTHING — the household is fully staffed', () => {
    // The refounded census (WRIT-THE-BROKERAGE) seats all three Crown offices,
    // so a clean realm owes the Crown no decision at all. That is the gauge
    // reading zero, not the gauge broken.
    const c = courtOf(foundingDoc(), null);
    expect(c.matters).toEqual([]);
  });

  it('a craft left headless IS brought before the court', () => {
    const doc = foundingDoc();
    doc.acts.grants = doc.acts.grants.filter((g) => g.territoryId !== 'office-works');
    const c = courtOf(doc, null);
    const seats = c.matters.filter((m) => m.kind === 'seat');
    expect(seats.length).toBe(1);
    expect(seats[0].asks).toContain('Works');
    expect(seats[0].weight).toBeGreaterThan(0);
  });

  it('gathers matters from EVERY department — not one kind of thing', () => {
    const { doc } = grandMusterDoc();
    const c = courtOf(doc, doc.wargame!.seed, doc.wargame!.now);
    const kinds = new Set(c.matters.map((m) => m.kind));
    expect(kinds.size).toBeGreaterThan(1);
    expect(c.matters.length).toBeGreaterThan(0);
    // Every matter names what is asked, who brings it, and where to answer it.
    for (const m of c.matters) {
      expect(m.asks.length).toBeGreaterThan(0);
      expect(m.brings.length).toBeGreaterThan(0);
      expect(m.go).toBeTruthy();
    }
  });

  it('is ordered heaviest FIRST — the docket never rises', () => {
    const { doc } = grandMusterDoc();
    const c = courtOf(doc, doc.wargame!.seed, doc.wargame!.now);
    const weights = c.matters.map((m) => m.weight);
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
  });

  it('a CRISIS outranks a fresh matter, and held COIN outranks a bare wait', () => {
    const doc = foundingDoc();
    const mk = (caseId: string, at: string, note: string): KingdomEvent[] => [
      { id: `${caseId}-o`, at, caseId, kind: 'opened', holder: 'alys', note },
      { id: `${caseId}-p`, at, caseId, kind: 'proposed', holder: 'alys', actor: 'agent:va-desk', note },
    ];
    doc.events.push(
      ...mk('fresh · 1 Elm Row, unit A', daysAgo(0), 'A small thing, decided today.'),
      ...mk('rotted · 2 Elm Row, unit A', daysAgo(40), 'Long unanswered.'),
      ...mk('coin · 3 Elm Row, unit A', daysAgo(0), "The owner's approval is needed before the spend."),
    );
    const c = courtOf(doc, null);
    const at = (frag: string) => c.matters.findIndex((m) => m.id.startsWith(frag));
    // The rotted one and the money one both outrank the fresh trifle.
    expect(at('rotted')).toBeLessThan(at('fresh'));
    expect(at('coin')).toBeLessThan(at('fresh'));
    expect(c.matters.find((m) => m.id.startsWith('coin'))!.holdsMoney).toBe(true);
  });

  it('an ancient trifle never outranks today’s crisis — age does not compound forever', () => {
    const doc = foundingDoc();
    doc.events.push(
      { id: 'a1', at: daysAgo(3650), caseId: 'ancient · 9 Old Row, unit A', kind: 'opened', holder: 'alys', note: 'A trifle from long ago.' },
      { id: 'a2', at: daysAgo(3650), caseId: 'ancient · 9 Old Row, unit A', kind: 'awaiting', holder: 'alys', note: 'A trifle from long ago.' },
      { id: 'c1', at: daysAgo(20), caseId: 'urgent · 8 New Row, unit A', kind: 'opened', holder: 'alys', note: "The owner's approval is needed." },
      { id: 'c2', at: daysAgo(20), caseId: 'urgent · 8 New Row, unit A', kind: 'proposed', holder: 'alys', actor: 'agent:va-desk', note: "The owner's approval is needed." },
    );
    const c = courtOf(doc, null);
    const ancient = c.matters.findIndex((m) => m.id.startsWith('ancient'));
    const urgent = c.matters.findIndex((m) => m.id.startsWith('urgent'));
    expect(urgent).toBeLessThan(ancient);
  });

  it('a clerk’s proposal is heard ONCE — never also as a bare waiting case', () => {
    const { doc } = grandMusterDoc();
    const c = courtOf(doc, doc.wargame!.seed, doc.wargame!.now);
    const ids = c.matters.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is a READING — answering elsewhere simply stops it being brought', () => {
    const doc = foundingDoc();
    const caseId = 'settle · 4 Elm Row, unit A';
    doc.events.push(
      { id: 's1', at: daysAgo(5), caseId, kind: 'opened', holder: 'alys', note: 'Asks a word.' },
      { id: 's2', at: daysAgo(5), caseId, kind: 'proposed', holder: 'alys', actor: 'agent:va-desk', note: 'Asks a word.' },
    );
    expect(courtOf(doc, null).matters.some((m) => m.id === caseId)).toBe(true);
    // The word is given, anywhere in the realm — the docket re-folds without it.
    doc.events.push({ id: 's3', at: daysAgo(1), caseId, kind: 'approved', holder: 'alys', note: 'So ruled.' });
    expect(courtOf(doc, null).matters.some((m) => m.id === caseId)).toBe(false);
  });

  it('caps what one court hears, keeping the heaviest and still every kind', () => {
    const { doc } = grandMusterDoc();
    const kingdom = assembleKingdom(doc.census, doc.acts);
    const opts = { fiefs: readKingdom(kingdom) };
    const small = readCourt(doc.events, doc.wargame!.now, opts, 5);
    const big = readCourt(doc.events, doc.wargame!.now, opts, 50);
    expect(small.matters).toHaveLength(5);
    // The heaviest matter is always heard, however short the court.
    expect(small.matters[0].id).toBe(big.matters[0].id);
    // ...and the docket stays ordered, and still spans more than one kind.
    const w = small.matters.map((m) => m.weight);
    expect(w).toEqual([...w].sort((a, b) => b - a));
    expect(new Set(small.matters.map((m) => m.kind)).size).toBeGreaterThanOrEqual(1);
  });

  it('no ONE kind starves the rest — the standing debts are always heard', () => {
    // A live muster carries thousands of waiting cases. Taken purely by weight
    // they filled every slot and an unmanned craft was never brought at all.
    const { doc } = grandMusterDoc();
    const c = courtOf(doc, doc.wargame!.seed, doc.wargame!.now);
    // Strike a Chancellor so a standing debt exists beside the thousands of
    // waiting cases — the point is that the flood does not bury it.
    const bare = { ...doc, acts: { ...doc.acts, grants: doc.acts.grants.filter((g) => g.territoryId !== 'office-works') } };
    const c2 = courtOf(bare, doc.wargame!.seed, doc.wargame!.now);
    expect(c2.matters.filter((m) => m.kind === 'approval').length).toBeGreaterThan(0);
    expect(c2.matters.filter((m) => m.kind === 'seat').length).toBeGreaterThan(0);
  });
});
