import { describe, it, expect } from 'vitest';
import { readCoffers } from '../src/domain/treasury';
import type { Upkeep } from '../src/domain/treasury';
import { FOUNDING_ECONOMY, moneyEvent } from './fixtures';

// Pin the CONSEQUENCE ENGINE's fail state — the coffers reading that decides
// whether the kingdom falls (readCoffers, folded into realm.coffers). This was
// the one load-bearing reading the Shot-0 net didn't cover; it must be green
// before any future coffers/economy consolidation touches it.
const upkeepMoney = (dollars: number) => [moneyEvent('corp_expense', dollars * 100)];

describe('coffers — the fail state (readCoffers)', () => {
  it('a solvent operation clears its upkeep — black, not fallen', () => {
    const c = readCoffers(200, FOUNDING_ECONOMY, upkeepMoney(18_000));
    expect(c.fallen).toBe(false);
    expect(c.trend).toBeGreaterThan(0);
    expect(c.doors).toBe(200);
  });

  it('a neglected operation loses doors until tribute drops below upkeep — RED, fallen', () => {
    // Same upkeep, far fewer retained doors (Patrons withdrew) — the retained-
    // door dynamic is what makes the fail state reachable.
    const c = readCoffers(100, FOUNDING_ECONOMY, upkeepMoney(18_000));
    expect(c.fallen).toBe(true);
    expect(c.trend).toBeLessThan(0);
  });

  it('tribute per door comes from the economy management fee rule (not a hardcode)', () => {
    const one = readCoffers(1, FOUNDING_ECONOMY, upkeepMoney(0));
    // One door's tribute = the management fee on one door's rent, > 0.
    expect(one.tributeMonthly).toBeGreaterThan(0);
    // And it scales linearly with retained doors.
    const two = readCoffers(2, FOUNDING_ECONOMY, upkeepMoney(0));
    expect(two.tributeMonthly).toBeCloseTo(one.tributeMonthly * 2, 5);
  });

  it('with no game standing, upkeep falls back to the treasury rolls', () => {
    const rolls: Upkeep[] = [{ id: 'u1', label: 'a salary', monthly: 30_000, recordedOn: '2026-07-20' }];
    const c = readCoffers(200, FOUNDING_ECONOMY, [], { upkeeps: rolls });
    expect(c.upkeepMonthly).toBe(30_000);
    expect(c.fallen).toBe(true); // 200 doors' tribute < the $30k hand-recorded upkeep
  });

  it('the UPKEEP BOOK is the monthly rate — the money log is only the fallback', () => {
    // This asserted the opposite until 2026-07-28, on the premise that a stale
    // treasury roll should not beat the game's dealt expense. That premise
    // cannot arise: both deploy paths REWRITE the household into the book
    // (`filter(!isHouseholdUpkeep)` + spread), so the book is never stale after
    // a muster — while the money log is a LIFETIME stream, one dealt month plus
    // every one-off a hand has recorded since. Summing it and calling the result
    // "/mo" is a category error, and it had teeth: see the next test.
    const rolls: Upkeep[] = [{ id: 'u1', label: 'the hall', monthly: 18_000, recordedOn: '2026-07-20' }];
    const c = readCoffers(200, FOUNDING_ECONOMY, upkeepMoney(18_000), { upkeeps: rolls });
    expect(c.upkeepMonthly).toBe(18_000);
  });

  it('a one-off company expense does NOT become the standing monthly upkeep', () => {
    // The bug, pinned: on the campaign's $1,200 hall, recording a single $3,000
    // roof made the ribbon announce a standing upkeep of $4,200/mo and flip the
    // coffers to "running red" — while the Counting-house's own Upkeep card,
    // folded from this same book, went on correctly saying $1,200. Two gauges,
    // one fact, and the louder one was wrong. It also put the campaign's last
    // act permanently out of reach.
    const hall: Upkeep[] = [{ id: 'u1', label: 'the hall', monthly: 1_200, recordedOn: '2026-07-28' }];
    const money = [...upkeepMoney(1_200), ...upkeepMoney(3_000)]; // the month, then a roof
    const c = readCoffers(16, FOUNDING_ECONOMY, money, { upkeeps: hall });
    expect(c.upkeepMonthly).toBe(1_200);
    expect(c.trend).toBe(16 * 112.5 - 1_200); // the holding is meant to run a margin
    expect(c.fallen).toBe(false);
  });

  it('still weighs a hand-recorded cost when no upkeep book stands', () => {
    const c = readCoffers(200, FOUNDING_ECONOMY, upkeepMoney(18_000));
    expect(c.upkeepMonthly).toBe(18_000);
  });
});
