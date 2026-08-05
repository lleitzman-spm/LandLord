import { describe, it, expect } from 'vitest';
import { unionById, reconcileById, mergeOnConflict } from '../src/store/chronicleMerge';
import { foundingDoc } from './fixtures';
import type { KingdomEvent } from '../src/domain/events';

const ev = (id: string): KingdomEvent => ({ id, at: '2026-07-01T00:00:00.000Z', caseId: `c-${id}`, kind: 'opened' });

describe('chronicleMerge — no append lost on conflict (R2)', () => {
  it('unionById keeps both sides, remote first, dedupes by id', () => {
    const remote = [{ id: 'a' }, { id: 'b' }];
    const local = [{ id: 'b' }, { id: 'c' }];
    expect(unionById(remote, local).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('two writers appending disjoint events lose nothing on merge (base-blind fallback)', () => {
    const local = foundingDoc();
    local.events = [ev('base'), ev('local-1'), ev('local-2')];
    const remote = foundingDoc();
    remote.events = [ev('base'), ev('remote-1')];
    // No base passed → additive union: everything survives.
    const merged = mergeOnConflict(local, remote);
    expect(merged.events.map((e) => e.id).sort()).toEqual(['base', 'local-1', 'local-2', 'remote-1']);
  });

  it('two writers appending disjoint events lose nothing WITH a base (3-way)', () => {
    const base = foundingDoc();
    base.events = [ev('base')];
    const local = foundingDoc();
    local.events = [ev('base'), ev('local-1'), ev('local-2')];
    const remote = foundingDoc();
    remote.events = [ev('base'), ev('remote-1')];
    const merged = mergeOnConflict(local, remote, base);
    expect(merged.events.map((e) => e.id).sort()).toEqual(['base', 'local-1', 'local-2', 'remote-1']);
  });

  it('unions money and record books by id too (no owner/grant append lost)', () => {
    const local = foundingDoc();
    local.money = [{ id: 'm-local', at: '2026-07-01T00:00:00.000Z', kind: 'rent_charged', amountCents: 1 }];
    local.acts.grants = [...local.acts.grants, { id: 'g-local', territoryId: 'x', personId: 'p', role: 'lord', grantedOn: '2026-07-01' }];
    const remote = foundingDoc();
    remote.money = [{ id: 'm-remote', at: '2026-07-01T00:00:00.000Z', kind: 'late_fee', amountCents: 2 }];
    const merged = mergeOnConflict(local, remote);
    expect(merged.money.map((m) => m.id).sort()).toEqual(['m-local', 'm-remote']);
    expect(merged.acts.grants.some((g) => g.id === 'g-local')).toBe(true);
  });

  it('is idempotent when local and remote are identical (no duplication)', () => {
    const a = foundingDoc();
    a.events = [ev('x')];
    const b = foundingDoc();
    b.events = [ev('x')];
    expect(mergeOnConflict(a, b).events).toHaveLength(1);
  });
});

describe('chronicleMerge — 3-way reconcile honors deletions (S2)', () => {
  it('reconcileById: a strike on one side is not resurrected by the other', () => {
    const base = [{ id: 'a' }, { id: 'b' }];
    const local = [{ id: 'a' }]; // local struck b
    const remote = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]; // remote still has b, appended c
    // b was struck locally → stays gone; c is a remote append → kept.
    expect(reconcileById(local, remote, base).map((x) => x.id).sort()).toEqual(['a', 'c']);
  });

  it('a struck money event stays struck through the merge', () => {
    const m1 = { id: 'm1', at: '2026-07-01T00:00:00.000Z', kind: 'rent_charged' as const, amountCents: 100 };
    const base = foundingDoc();
    base.money = [m1];
    const local = foundingDoc();
    local.money = []; // this session struck m1
    const remote = foundingDoc();
    remote.money = [m1]; // the other session never saw the strike
    const merged = mergeOnConflict(local, remote, base);
    expect(merged.money.find((m) => m.id === 'm1')).toBeUndefined();
  });

  it('a revoked grant struck on the remote side stays struck', () => {
    const g = { id: 'g1', territoryId: 'x', personId: 'p', role: 'lord' as const, grantedOn: '2026-07-01' };
    const base = foundingDoc();
    base.acts.grants = [g];
    const local = foundingDoc();
    local.acts.grants = [g]; // local still carries it
    const remote = foundingDoc();
    remote.acts.grants = []; // remote revoked it
    const merged = mergeOnConflict(local, remote, base);
    expect(merged.acts.grants.some((x) => x.id === 'g1')).toBe(false);
  });

  it('the fallback (no base) CANNOT honor a strike — it resurrects (documents the limit)', () => {
    const m1 = { id: 'm1', at: '2026-07-01T00:00:00.000Z', kind: 'rent_charged' as const, amountCents: 100 };
    const local = foundingDoc();
    local.money = [];
    const remote = foundingDoc();
    remote.money = [m1];
    // Without a base, the union re-adds m1 — why the store now always passes base.
    expect(mergeOnConflict(local, remote).money.some((m) => m.id === 'm1')).toBe(true);
  });
});

describe('chronicleMerge — non-log state stays coherent (S1)', () => {
  it('a muster deployed on the remote side is adopted, not clobbered by a stale local', () => {
    const base = foundingDoc(); // no game standing
    const local = foundingDoc(); // this session only appended an event; never touched the board
    local.events = [ev('local-note')];
    const remote = foundingDoc(); // the other session deployed a grand muster
    remote.wargame = { seed: 'm', now: '2026-08-01T00:00:00.000Z', deployedAt: '2026-08-01T00:00:00.000Z', tally: {} };
    remote.catalog = [{ key: 'k', label: 'L', clazz: 'run' }] as typeof remote.catalog;
    const merged = mergeOnConflict(local, remote, base);
    // Local didn't move the board from base → adopt the remote's muster + catalog.
    expect(merged.wargame?.seed).toBe('m');
    expect(merged.catalog).toEqual(remote.catalog);
    // ...and the local append is still there.
    expect(merged.events.some((e) => e.id === 'local-note')).toBe(true);
  });

  it('the writing session keeps its own board change when it is the one that moved it', () => {
    const base = foundingDoc();
    const local = foundingDoc();
    local.wargame = { seed: 'mine', now: '2026-08-01T00:00:00.000Z', deployedAt: '2026-08-01T00:00:00.000Z', tally: {} };
    const remote = foundingDoc(); // remote still has no game
    const merged = mergeOnConflict(local, remote, base);
    expect(merged.wargame?.seed).toBe('mine');
  });
});

// ── The optional book's sentinel (found by adversarial audit, 2026-07-27) ────
// `economySetting` is the ONE optional field on a Chronicle, and the merge
// asked `base?.economySetting === undefined` to mean "no base known" — which is
// also true, ordinarily, when the base simply carried no setting. So the one
// field carrying a firm's real rates and caps was the one field the 3-way merge
// could silently drop.
describe('the merge and the one optional book', () => {
  it('KEEPS a setting the other session loaded, when the base carried none', () => {
    const base = foundingDoc();
    const local = foundingDoc(); // this session never touched the setting
    const remote = foundingDoc();
    remote.economySetting = { spendCaps: { houseNteCents: 100_000 } } as never;

    const merged = mergeOnConflict(local, remote, base);
    expect(merged.economySetting).toBeDefined();
    expect(merged.economySetting).toEqual(remote.economySetting);
  });

  it('still lets THIS session’s own load win over a stale remote', () => {
    const base = foundingDoc();
    const local = foundingDoc();
    local.economySetting = { spendCaps: { houseNteCents: 40_000 } } as never;
    const remote = foundingDoc(); // the other side never had one

    const merged = mergeOnConflict(local, remote, base);
    expect(merged.economySetting).toEqual(local.economySetting);
  });

  it('a base-blind merge is unchanged — it still takes the writing session', () => {
    const local = foundingDoc();
    local.economySetting = { spendCaps: { houseNteCents: 40_000 } } as never;
    const remote = foundingDoc();
    remote.economySetting = { spendCaps: { houseNteCents: 90_000 } } as never;

    const merged = mergeOnConflict(local, remote);
    expect(merged.economySetting).toEqual(local.economySetting);
  });
});
