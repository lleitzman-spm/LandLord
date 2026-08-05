// The tenure hierarchy's resolution test — and the standing's arithmetic.
//
// Same discipline as `test/campaign.test.ts`, for the same reason: the founding
// hierarchy NAMES things by id — a realm, a shire, a fee, a knight — and a
// rename orphans every one of them silently. The book looks fine while being
// wrong: a door whose `shireId` names a metro nobody holds any more simply
// vanishes from every count, and the count still renders. That is the
// stringly-typed fault this codebase has shipped nine times, so every id every
// founding record speaks is resolved here, and a rename fails the build loudly
// instead of quietly losing a metro.
//
// Beyond resolution, three facts of this shelf are load-bearing and each has
// its own section below:
//   · the shire/march standing is a READING — it flips both ways as the records
//     change, and no record anywhere stores it;
//   · a FEE CANNOT EXPRESS GEOMETRY — a fee with doors scattered across three
//     metros is ordinary and must read fine;
//   · each of the three promotion thresholds independently holds a march back.

import { describe, it, expect } from 'vitest';
import {
  EDICT_PRESSING_DAYS,
  EMPTY_TENURE,
  FOUNDING_TENURE,
  GEOMETRY_WORDS,
  SHIRE_MAX_HEADLESS_CRAFTS,
  SHIRE_MIN_DOORS,
  SHIRE_MIN_KNIGHTS,
  doorsOfFee,
  doorsOfShire,
  edictsOfRealm,
  feeOf,
  knightsOfShire,
  readEdict,
  readEdicts,
  readShireStanding,
  readShireStandings,
  realmOf,
  shireOf,
  shiresOfFee,
  unattendedDoors,
  type CraftStanding,
  type Door,
  type Fee,
  type Realm,
  type Shire,
  type TenureBook,
} from '../src/domain/tenure';
import {
  doorKey,
  musteredFromRoster,
  placedShare,
  readMusterTenure,
  unplacedAddresses,
  type MusteredDoor,
} from '../src/domain/tenureMuster';
import { dice, makeDoors } from '../src/domain/wargame';
import { FOUNDING_GUILDS, readGuilds, unmannedGuilds } from '../src/domain/guilds';
import { assembleKingdom } from '../src/domain/court';
import { foundingDoc } from './fixtures';

const NOW = '2026-07-28T00:00:00.000Z';
const dayMs = 86_400_000;
const later = (iso: string, days: number) =>
  new Date(Date.parse(iso) + days * dayMs).toISOString();

/** A household whose crafts all have heads — the third clause satisfied, so a
 *  test about doors is only about doors. */
const HEADED: CraftStanding[] = [{ manned: true }, { manned: true }, { manned: true }];

/** A book with the doors swapped and everything else left alone — every test
 *  below changes the RECORDS and re-reads, never a field. */
function withDoors(book: TenureBook, doors: Door[]): TenureBook {
  return { ...book, doors };
}

// ── The resolution test ─────────────────────────────────────────────────────

describe('the founding hierarchy resolves against itself', () => {
  it('every shire names a realm the book holds', () => {
    for (const s of FOUNDING_TENURE.shires) {
      expect(
        realmOf(FOUNDING_TENURE, s.realmId),
        `shire "${s.id}" names realm "${s.realmId}", which the book does not hold`,
      ).not.toBeNull();
    }
  });

  it('every fee names a realm the book holds', () => {
    for (const f of FOUNDING_TENURE.fees) {
      expect(
        realmOf(FOUNDING_TENURE, f.realmId),
        `fee "${f.id}" names realm "${f.realmId}", which the book does not hold`,
      ).not.toBeNull();
    }
  });

  it('every door names a realm, a shire and a fee the book holds', () => {
    expect(FOUNDING_TENURE.doors.length).toBeGreaterThan(0);
    for (const d of FOUNDING_TENURE.doors) {
      expect(realmOf(FOUNDING_TENURE, d.realmId), `door "${d.id}" names realm "${d.realmId}"`)
        .not.toBeNull();
      expect(shireOf(FOUNDING_TENURE, d.shireId), `door "${d.id}" names shire "${d.shireId}"`)
        .not.toBeNull();
      expect(feeOf(FOUNDING_TENURE, d.feeId), `door "${d.id}" names fee "${d.feeId}"`)
        .not.toBeNull();
    }
  });

  it('a door’s shire and its fee stand in the SAME realm as the door', () => {
    // Resolvable but wrong is worse than unresolvable: a door in Aldermarch whose
    // fee answers to another realm would read fine and count under two laws.
    for (const d of FOUNDING_TENURE.doors) {
      expect(shireOf(FOUNDING_TENURE, d.shireId)!.realmId, `door "${d.id}"`).toBe(d.realmId);
      expect(feeOf(FOUNDING_TENURE, d.feeId)!.realmId, `door "${d.id}"`).toBe(d.realmId);
    }
  });

  it('every edict names a realm the book holds', () => {
    expect(FOUNDING_TENURE.edicts.length).toBeGreaterThan(0);
    for (const e of FOUNDING_TENURE.edicts) {
      expect(
        realmOf(FOUNDING_TENURE, e.realmId),
        `edict "${e.id}" names realm "${e.realmId}", which the book does not hold`,
      ).not.toBeNull();
    }
  });

  it('every id in the book is unique within its kind', () => {
    const unique = (ids: string[]) => expect(new Set(ids).size).toBe(ids.length);
    unique(FOUNDING_TENURE.realms.map((r) => r.id));
    unique(FOUNDING_TENURE.shires.map((s) => s.id));
    unique(FOUNDING_TENURE.fees.map((f) => f.id));
    unique(FOUNDING_TENURE.doors.map((d) => d.id));
    unique(FOUNDING_TENURE.edicts.map((e) => e.id));
  });

  it('every realm names a sovereign — a realm with no law is not a realm', () => {
    for (const r of FOUNDING_TENURE.realms) {
      expect(r.name.trim(), `realm "${r.id}" is nameless`).not.toBe('');
      expect(r.sovereign.trim(), `realm "${r.id}" names no sovereign`).not.toBe('');
    }
  });

  it('the household’s craft reading satisfies what the standing asks of it', () => {
    // The join between the two axes, checked rather than assumed: if
    // `GuildReading` ever loses `manned`, the standing loses its third clause
    // and this fails at the call, not six files later.
    const doc = foundingDoc();
    const guilds = readGuilds(assembleKingdom(doc.census, doc.acts), doc.events, NOW);
    expect(guilds.length).toBe(FOUNDING_GUILDS.length);
    // Handed straight in — no adapter, no new fold. This assignment is the
    // proof: `GuildReading` IS a `CraftStanding`.
    const crafts: readonly CraftStanding[] = guilds;
    const r = readShireStanding(FOUNDING_TENURE, 'northreach', crafts)!;
    expect(r.headlessCrafts).toBe(unmannedGuilds(guilds).length);
  });

  it('a name the book does not hold reads as NOTHING rather than throwing', () => {
    expect(realmOf(FOUNDING_TENURE, 'no-such-realm')).toBeNull();
    expect(shireOf(FOUNDING_TENURE, 'no-such-shire')).toBeNull();
    expect(feeOf(FOUNDING_TENURE, 'no-such-fee')).toBeNull();
    expect(readShireStanding(FOUNDING_TENURE, 'no-such-shire')).toBeNull();
    expect(doorsOfShire(FOUNDING_TENURE, 'no-such-shire')).toEqual([]);
    expect(readShireStandings(EMPTY_TENURE)).toEqual([]);
  });
});

// ── Doors carry the whole hierarchy from the first migration ────────────────

describe('a door carries realm, shire, fee and knight', () => {
  it('every founding door bears all four keys', () => {
    for (const d of FOUNDING_TENURE.doors) {
      expect(typeof d.realmId, d.id).toBe('string');
      expect(typeof d.shireId, d.id).toBe('string');
      expect(typeof d.feeId, d.id).toBe('string');
      // The knight is the one that may be absent — and it must be EXPLICITLY
      // absent (null), never simply missing, or "in no knight's care" and "the
      // field was forgotten" become the same fact.
      expect(Object.hasOwn(d, 'knightId'), `door "${d.id}" omits knightId`).toBe(true);
      expect(d.knightId === null || typeof d.knightId === 'string').toBe(true);
    }
  });

  it('a door in no knight’s care is a real state, and reads as debt', () => {
    const bare = unattendedDoors(FOUNDING_TENURE);
    expect(bare.length).toBeGreaterThan(0);
    for (const d of bare) expect(d.knightId).toBeNull();
    expect(unattendedDoors(FOUNDING_TENURE, 'northreach').every((d) => d.shireId === 'northreach')).toBe(true);
  });
});

// ── A fee is not a place ────────────────────────────────────────────────────

describe('a fee cannot express geometry', () => {
  it('no founding fee bears any word that describes a place', () => {
    // The runtime half of the guard the compiler holds in `tenure.ts`
    // (`FEE_HAS_NO_GEOMETRY`). Both read the same list, so widening one widens
    // the other.
    const banned = new Set<string>(GEOMETRY_WORDS);
    for (const f of FOUNDING_TENURE.fees) {
      for (const k of Object.keys(f)) {
        expect(banned.has(k.toLowerCase()), `fee "${f.id}" carries "${k}" — a fee is not a place`)
          .toBe(false);
      }
    }
  });

  it('the Fee shape itself holds only id, realm, name and patron', () => {
    // Named exhaustively so ADDING a field is a deliberate act with a test to
    // change, rather than a quiet drift toward a polygon.
    const keys = Object.keys(FOUNDING_TENURE.fees[0]).sort();
    expect(keys).toEqual(['id', 'name', 'patron', 'realmId']);
  });

  it('a fee with doors scattered across three metros reads fine', () => {
    const wide: TenureBook = {
      ...FOUNDING_TENURE,
      shires: [
        ...FOUNDING_TENURE.shires,
        { id: 'eastfen', realmId: 'am', name: 'Eastfen' },
      ],
      doors: [
        ...FOUNDING_TENURE.doors,
        {
          id: '701 Harrowgate Road, unit A',
          realmId: 'am',
          shireId: 'eastfen',
          feeId: 'fee-ashcombe',
          knightId: 'knight-aldous',
        },
      ],
    };
    expect(shiresOfFee(wide, 'fee-ashcombe').sort()).toEqual(['eastfen', 'northreach', 'westmoor']);
    // …and every one of those metros still reads its own standing without a
    // word about the fee. Scattering is not an error state.
    for (const id of shiresOfFee(wide, 'fee-ashcombe')) {
      expect(readShireStanding(wide, id, HEADED)).not.toBeNull();
    }
    expect(doorsOfFee(wide, 'fee-ashcombe').length).toBe(
      doorsOfFee(FOUNDING_TENURE, 'fee-ashcombe').length + 1,
    );
  });

  it('the FOUNDING book already scatters a fee across two metros', () => {
    // The point is made in the data, not only in a synthetic case: if someone
    // "tidies" the founding book into one-fee-per-metro, the next renderer will
    // believe fees are contiguous because the data said so.
    expect(shiresOfFee(FOUNDING_TENURE, 'fee-ashcombe').sort()).toEqual(['northreach', 'westmoor']);
  });
});

// ── The standing is a reading ───────────────────────────────────────────────

describe('the shire/march standing is READ, never stored', () => {
  it('no record anywhere in the book stores a standing', () => {
    const banned = ['standing', 'kind', 'status', 'march', 'promoted', 'shire'];
    for (const s of FOUNDING_TENURE.shires) {
      for (const k of Object.keys(s)) {
        expect(banned.includes(k), `shire "${s.id}" stores "${k}" — the standing is a reading`)
          .toBe(false);
      }
      expect(Object.keys(s).sort()).toEqual(['id', 'name', 'realmId']);
    }
  });

  it('the founding book reads one shire and one march', () => {
    const all = readShireStandings(FOUNDING_TENURE, HEADED);
    expect(all.map((r) => `${r.shire.id}:${r.standing}`)).toEqual([
      'westmoor:march', // marches first — the frontier wants the Crown's attention
      'northreach:shire',
    ]);
  });

  it('a march PROMOTES when the records change, with no field written', () => {
    const before = readShireStanding(FOUNDING_TENURE, 'westmoor', HEADED)!;
    expect(before.standing).toBe('march');
    expect(before.doors).toBeLessThan(SHIRE_MIN_DOORS);

    // Grow the frontier past the threshold — records in, nothing else touched.
    const grown = withDoors(FOUNDING_TENURE, [
      ...FOUNDING_TENURE.doors,
      ...Array.from({ length: SHIRE_MIN_DOORS - before.doors }, (_, i) => ({
        id: `${801 + i} Stonewall Row, unit A`,
        realmId: 'am',
        shireId: 'westmoor',
        feeId: 'fee-greaves',
        knightId: 'knight-maren',
      })),
    ]);
    const after = readShireStanding(grown, 'westmoor', HEADED)!;
    expect(after.standing).toBe('shire');
    expect(after.doors).toBe(SHIRE_MIN_DOORS);
    expect(after.wanting).toEqual([]);
    // The shire record itself is byte-for-byte what it was. That is the whole
    // point: a stored flag could not have done this without a write.
    expect(after.shire).toEqual(before.shire);
  });

  it('a shire DEMOTES again when the records go the other way', () => {
    // The direction a stored field always gets wrong. Strike doors from Northreach
    // and it is a march again the very next read.
    const kept = doorsOfShire(FOUNDING_TENURE, 'northreach').slice(0, 6);
    const shrunk = withDoors(FOUNDING_TENURE, [
      ...kept,
      ...doorsOfShire(FOUNDING_TENURE, 'westmoor'),
    ]);
    expect(readShireStanding(FOUNDING_TENURE, 'northreach', HEADED)!.standing).toBe('shire');
    expect(readShireStanding(shrunk, 'northreach', HEADED)!.standing).toBe('march');
  });

  it('the reading counts the metro’s own doors, knights and fees', () => {
    const r = readShireStanding(FOUNDING_TENURE, 'northreach', HEADED)!;
    expect(r.doors).toBe(doorsOfShire(FOUNDING_TENURE, 'northreach').length);
    expect(r.doors).toBe(28);
    expect(r.knights.sort()).toEqual(knightsOfShire(FOUNDING_TENURE, 'northreach').sort());
    expect(r.knights).toContain('knight-aldous');
    expect(r.fees.sort()).toEqual(['fee-ashcombe', 'fee-greaves', 'fee-underhill']);
  });
});

// ── Each threshold holds the promotion back on its own ──────────────────────

describe('the three thresholds each hold a promotion back independently', () => {
  /** A metro that clears every test — the control the three failures are cut
   *  from, so each one differs from a promoted shire in exactly one way. */
  function readyBook(): TenureBook {
    return {
      realms: FOUNDING_TENURE.realms,
      shires: [{ id: 'ready', realmId: 'am', name: 'Ready' }],
      fees: FOUNDING_TENURE.fees,
      doors: Array.from({ length: SHIRE_MIN_DOORS }, (_, i) => ({
        id: `${901 + i} Kingsmill Way, unit A`,
        realmId: 'am',
        shireId: 'ready',
        feeId: 'fee-ashcombe',
        knightId: 'knight-aldous' as string | null,
      })),
      edicts: [],
    };
  }

  it('the control reads a SHIRE — all three clauses hold', () => {
    const r = readShireStanding(readyBook(), 'ready', HEADED)!;
    expect(r.standing).toBe('shire');
    expect([r.holdsDoors, r.holdsKnight, r.holdsCrafts]).toEqual([true, true, true]);
    expect(r.wanting).toEqual([]);
  });

  it('ONE door short holds it at a march, and says which clause failed', () => {
    const book = readyBook();
    const r = readShireStanding(withDoors(book, book.doors.slice(0, -1)), 'ready', HEADED)!;
    expect(r.standing).toBe('march');
    expect(r.doors).toBe(SHIRE_MIN_DOORS - 1);
    expect(r.holdsDoors).toBe(false);
    // …and ONLY that clause. A test that let two things fail at once would
    // prove nothing about either.
    expect(r.holdsKnight).toBe(true);
    expect(r.holdsCrafts).toBe(true);
    expect(r.wanting).toHaveLength(1);
    expect(r.wanting[0]).toMatch(/1 more door/);
  });

  it('no knight seated there holds it at a march', () => {
    const book = readyBook();
    const r = readShireStanding(
      withDoors(book, book.doors.map((d) => ({ ...d, knightId: null }))),
      'ready',
      HEADED,
    )!;
    expect(r.standing).toBe('march');
    expect(r.knights).toEqual([]);
    expect(r.holdsKnight).toBe(false);
    expect(r.holdsDoors).toBe(true);
    expect(r.holdsCrafts).toBe(true);
    expect(r.wanting).toEqual(['No knight covers a door here.']);
    // The door count alone can never carry the knight clause: doors stand, and
    // nobody rides to them.
    expect(r.doors).toBeGreaterThanOrEqual(SHIRE_MIN_DOORS);
    expect(SHIRE_MIN_KNIGHTS).toBe(1);
  });

  it('a craft standing headless holds it at a march', () => {
    const headless: CraftStanding[] = [{ manned: true }, { manned: false }, { manned: true }];
    const r = readShireStanding(readyBook(), 'ready', headless)!;
    expect(r.standing).toBe('march');
    expect(r.headlessCrafts).toBe(1);
    expect(r.holdsCrafts).toBe(false);
    expect(r.holdsDoors).toBe(true);
    expect(r.holdsKnight).toBe(true);
    expect(r.wanting).toHaveLength(1);
    expect(r.wanting[0]).toMatch(/headless/);
    expect(SHIRE_MAX_HEADLESS_CRAFTS).toBe(0);
  });

  it('a headless craft holds back EVERY metro, not one — the household is shared', () => {
    const headless: CraftStanding[] = [{ manned: false }];
    for (const r of readShireStandings(FOUNDING_TENURE, headless)) {
      expect(r.standing, r.shire.id).toBe('march');
    }
  });

  it('all three failing at once names all three', () => {
    const book = readyBook();
    const r = readShireStanding(
      withDoors(book, book.doors.slice(0, 3).map((d) => ({ ...d, knightId: null }))),
      'ready',
      [{ manned: false }],
    )!;
    expect(r.standing).toBe('march');
    expect(r.wanting).toHaveLength(3);
  });
});

// ── The crown's edicts — data only, and lateness is a reading ───────────────

describe('the crown’s edicts', () => {
  it('the founding realm carries an edict of every kind', () => {
    const kinds = edictsOfRealm(FOUNDING_TENURE, 'am').map((e) => e.kind).sort();
    expect(kinds).toEqual(['ce-hours', 'disclosure', 'filing', 'licence', 'trust-account']);
  });

  it('lateness is READ from the day against the clock, never stored', () => {
    const owed = FOUNDING_TENURE.edicts.find((e) => e.id === 'am-trust-account')!;
    expect(owed.standing).toBe('owed');
    const before = readEdict(owed, '2026-08-01T00:00:00.000Z');
    expect(before.late).toBe(false);
    // The same record, one clock later. Nothing was written; the day passed.
    const after = readEdict(owed, '2026-09-01T00:00:00.000Z');
    expect(after.late).toBe(true);
    expect(after.dueInDays).toBeLessThan(0);
    expect(owed.standing).toBe('owed');
  });

  it('an ANSWERED edict is never late, however long the day is gone', () => {
    const kept = FOUNDING_TENURE.edicts.find((e) => e.id === 'am-filing')!;
    expect(kept.standing).toBe('kept');
    expect(readEdict(kept, later(NOW, 400)).late).toBe(false);
    expect(readEdict(kept, later(NOW, 400)).pressing).toBe(false);
  });

  it('an owed edict PRESSES as its day nears', () => {
    const owed = FOUNDING_TENURE.edicts.find((e) => e.id === 'am-licence')!;
    const far = readEdict(owed, '2026-08-01T00:00:00.000Z');
    expect(far.pressing).toBe(false);
    expect(far.dueInDays).toBeGreaterThan(EDICT_PRESSING_DAYS);
    const near = readEdict(owed, '2027-04-20T00:00:00.000Z');
    expect(near.pressing).toBe(true);
    expect(near.late).toBe(false);
  });

  it('a realm’s edicts read soonest-due first', () => {
    const days = readEdicts(FOUNDING_TENURE, 'am', NOW).map((r) => r.dueInDays);
    expect(days).toEqual([...days].sort((a, b) => a - b));
    expect(readEdicts(FOUNDING_TENURE, 'no-such-realm', NOW)).toEqual([]);
  });
});

// ── The two "realms" are two different words ────────────────────────────────

describe('the tenure Realm is not the RealmReading', () => {
  it('a tenure realm is a PLACE — a name and a sovereign, and no score on it', () => {
    // Cheap, and it is the guard against the one real risk on this shelf: a
    // future hand folding the Regent's debt onto the polity because both are
    // spelled "realm". A polity holds no debt, no pods and no coffers.
    const r: Realm = FOUNDING_TENURE.realms[0];
    expect(Object.keys(r).sort()).toEqual(['id', 'name', 'sovereign']);
    for (const k of ['debt', 'pods', 'coffers', 'knights', 'patrons', 'guilds']) {
      expect(Object.hasOwn(r, k), `a polity must carry no "${k}" — that is RealmReading`)
        .toBe(false);
    }
  });

  it('the shapes stay what they say they are', () => {
    // Plain assignments, but they are what makes a rename of any of these three
    // types fail the build here rather than rot.
    const shire: Shire = FOUNDING_TENURE.shires[0];
    const fee: Fee = FOUNDING_TENURE.fees[0];
    const door: Door = FOUNDING_TENURE.doors[0];
    expect(shire.realmId).toBe(FOUNDING_TENURE.realms[0].id);
    expect(fee.realmId).toBe(FOUNDING_TENURE.realms[0].id);
    expect(door.realmId).toBe(FOUNDING_TENURE.realms[0].id);
  });
});

// ── The join: the doors in play, placed in the hierarchy ────────────────────
// `src/domain/tenureMuster.ts`. The hierarchy's own `Door` carries all four
// keys; the doors ACTUALLY IN PLAY (a muster's `WarDoor`s, the estate roster)
// carry an address and nothing else, and are persisted, so they are joined
// rather than extended. Everything below tests the seam that join stands on.

/** One door in play, said the way a muster says it. */
const inPlay = (address: string, owner?: string): MusteredDoor =>
  owner ? { address, owner } : { address };

/** The founding book's own doors, held up as if they were the muster. */
const asMuster = (doors: readonly Door[]): MusteredDoor[] =>
  doors.map((d) => inPlay(d.id));

describe('a door in play, placed in the hierarchy', () => {
  it('a door the book holds places cleanly — realm, shire, fee and knight', () => {
    const first = FOUNDING_TENURE.doors[0];
    const r = readMusterTenure(FOUNDING_TENURE, [inPlay(first.id, 'Mira Ashcombe')]);
    expect(r.mustered).toBe(1);
    expect(r.placed).toHaveLength(1);
    expect(r.unplaced).toEqual([]);

    const p = r.placed[0];
    expect(p.address).toBe(first.id);
    expect(p.placed).toBe(true);
    expect(p.reason).toBeNull();
    expect(p.says).toBe('');
    expect(p.realm!.name).toBe('Aldermarch');
    expect(p.shire!.name).toBe('Northreach');
    expect(p.fee!.name).toBe('The Ashcombe holding');
    expect(p.knightId).toBe('knight-aldous');
    // The two axes agreeing: the fee's patron IS the owner the roll names.
    expect(p.patronAgrees).toBe(true);
  });

  it('a door the book does not hold reads UNPLACED, and is named', () => {
    // The whole point of the reading. An unplaceable door is a finding — a door
    // in no fee — and it must come back by name, never be silently dropped.
    const first = FOUNDING_TENURE.doors[0];
    const stray = '909 Nowhere Lane, unit Z';
    const r = readMusterTenure(FOUNDING_TENURE, [inPlay(first.id), inPlay(stray)]);

    expect(r.mustered).toBe(2);
    // Nothing is swallowed: every door held up comes back on exactly one side.
    expect(r.placed.length + r.unplaced.length).toBe(r.mustered);
    expect(unplacedAddresses(r)).toEqual([stray]);

    const p = r.unplaced[0];
    expect(p.address).toBe(stray);
    expect(p.placed).toBe(false);
    expect(p.reason).toBe('no-row');
    expect(p.says).toMatch(/in no fee/i);
    // …and it says nothing it does not know. A door with no row has no shire.
    expect(p.door).toBeNull();
    expect(p.shire).toBeNull();
    expect(p.fee).toBeNull();
    expect(p.knightId).toBeNull();
    expect(r.unplacedByReason).toEqual([
      { id: 'no-row', name: expect.stringMatching(/in no fee/i), doors: 1 },
    ]);
  });

  it('a row naming a place the book does not hold reads unplaced, and says WHICH', () => {
    // Resolvable-looking but rotted: the row exists, its name does not. Each of
    // the three names fails on its own and is reported on its own, so a hand
    // knows whether to mend a shire, a fee or a realm.
    const rot = (patch: Partial<Door>): TenureBook => ({
      ...FOUNDING_TENURE,
      doors: [{ ...FOUNDING_TENURE.doors[0], ...patch }],
    });
    const one = [inPlay(FOUNDING_TENURE.doors[0].id)];

    const noShire = readMusterTenure(rot({ shireId: 'no-such-shire' }), one).unplaced[0];
    expect(noShire.reason).toBe('shire-unheld');
    expect(noShire.says).toMatch(/shire/i);
    // What DID resolve is still reported — the fee is known even here.
    expect(noShire.fee!.id).toBe('fee-ashcombe');
    expect(noShire.shire).toBeNull();

    expect(readMusterTenure(rot({ feeId: 'no-such-fee' }), one).unplaced[0].reason)
      .toBe('fee-unheld');
    expect(readMusterTenure(rot({ realmId: 'no-such-realm' }), one).unplaced[0].reason)
      .toBe('realm-unheld');
  });

  it('the key forgives case, spacing and a tenant suffix — and nothing else', () => {
    const first = FOUNDING_TENURE.doors[0];
    const same = [
      first.id.toUpperCase(),
      `  ${first.id.replace(/ /g, '   ')}  `,
      // A lease or relay case appends the tenant to the same physical door;
      // `doorOf` strips it for the same reason, and the two must agree.
      `${first.id} — Agnes the Tanner`,
    ];
    for (const address of same) {
      expect(doorKey(address), address).toBe(doorKey(first.id));
      expect(readMusterTenure(FOUNDING_TENURE, [inPlay(address)]).placed, address)
        .toHaveLength(1);
    }
    // …and a near-miss reads UNPLACED rather than being guessed into place. A
    // wrong placement is silent; an unplaced door says its own name.
    const near = first.id.replace(', unit', ' unit');
    expect(near).not.toBe(first.id);
    expect(readMusterTenure(FOUNDING_TENURE, [inPlay(near)]).unplaced).toHaveLength(1);
  });

  it('a war door and an estate roster both go straight in', () => {
    // The type-level claim (`WAR_DOOR_IS_A_MUSTERED_DOOR`) exercised at runtime:
    // `chronicle.wargame.doors` is handed in with no adapter and no new fold.
    const warDoors = makeDoors(dice('a-small-muster'), 4);
    const straight: readonly MusteredDoor[] = warDoors; // no adapter — the proof
    const r = readMusterTenure(FOUNDING_TENURE, straight);
    expect(r.mustered).toBe(4);
    expect(r.placements[0].owner).toBe(warDoors[0].owner);

    // The roster keys its slug as `id`, so it comes through the one adapter.
    const roster = readMusterTenure(
      FOUNDING_TENURE,
      musteredFromRoster([{ id: FOUNDING_TENURE.doors[0].id, label: 'a door on Willow Row' }]),
    );
    expect(roster.placed).toHaveLength(1);
    expect(roster.placed[0].owner).toBeUndefined();
    // A roster names no owner, so the two axes cannot be at odds — and NULL is
    // how that is said, never `false`.
    expect(roster.placed[0].patronAgrees).toBeNull();
  });

  it('an empty muster reads empty, not broken', () => {
    const r = readMusterTenure(FOUNDING_TENURE, []);
    expect(r.mustered).toBe(0);
    expect(placedShare(r)).toBe(0);
    expect(r.byShire).toEqual([]);
    expect(r.unplacedByReason).toEqual([]);
    expect(r.book.doors).toEqual([]);
    // The realms, shires and fees survive the narrowing — only the doors change.
    expect(r.book.shires).toEqual(FOUNDING_TENURE.shires);
  });
});

// ── The roll-up ─────────────────────────────────────────────────────────────

describe('the muster rolls up per shire, per fee, per knight — and the unplaced', () => {
  it('a fee scattered across two shires reads fine, and rolls up as ONE fee', () => {
    // The non-contiguity the type refuses to let anyone forget, now over the
    // doors in play: Ashcombe holds doors in Northreach AND Westmoor, and the roll-up
    // must count one fee across two shires rather than treating the scatter as
    // an error.
    const scattered = doorsOfFee(FOUNDING_TENURE, 'fee-ashcombe');
    expect(new Set(scattered.map((d) => d.shireId)).size).toBe(2);

    const r = readMusterTenure(FOUNDING_TENURE, asMuster(scattered));
    expect(r.unplaced).toEqual([]);
    expect(r.byFee).toEqual([
      { id: 'fee-ashcombe', name: 'The Ashcombe holding', doors: scattered.length },
    ]);
    expect(r.byShire.map((t) => t.id).sort()).toEqual(['northreach', 'westmoor']);
    expect(r.byShire.reduce((n, t) => n + t.doors, 0)).toBe(scattered.length);
    // …and the narrowed book says the scatter out loud, through the reading
    // that exists to say it.
    expect(shiresOfFee(r.book, 'fee-ashcombe').sort()).toEqual(['northreach', 'westmoor']);
  });

  it('a placed door in no knight’s care is NOT unplaced — it is the debt', () => {
    // Two different nulls, and confusing them would lose the realm's central
    // finding: an unplaced door has no row to ask; an unattended door has a row
    // that says plainly that nobody rides to it.
    const bare = unattendedDoors(FOUNDING_TENURE, 'northreach');
    expect(bare.length).toBeGreaterThan(0);
    const r = readMusterTenure(FOUNDING_TENURE, asMuster(bare));
    expect(r.unplaced).toEqual([]);
    expect(r.placed).toHaveLength(bare.length);
    expect(r.unattended).toHaveLength(bare.length);
    // No knight named "none": the debt is a list of doors, not a tally row.
    expect(r.byKnight).toEqual([]);
    // And the narrowed book folds the same debt through the shelf's own reading.
    expect(unattendedDoors(r.book)).toHaveLength(bare.length);
  });

  it('the whole founding book, mustered, rolls up to the counts the shelf reads', () => {
    const r = readMusterTenure(FOUNDING_TENURE, asMuster(FOUNDING_TENURE.doors));
    expect(placedShare(r)).toBe(1);
    expect(r.byShire).toEqual([
      { id: 'northreach', name: 'Northreach', doors: 28 },
      { id: 'westmoor', name: 'Westmoor', doors: 8 },
    ]);
    expect(r.byFee.reduce((n, t) => n + t.doors, 0)).toBe(FOUNDING_TENURE.doors.length);
    expect(r.byKnight.map((t) => t.id).sort()).toEqual(['knight-aldous', 'knight-maren']);
    expect(r.byKnight.reduce((n, t) => n + t.doors, 0) + r.unattended.length)
      .toBe(FOUNDING_TENURE.doors.length);
    expect(r.twiceClaimed).toEqual([]);
  });

  it('two rows for one door are SAID, not chosen in silence', () => {
    // A book holding a door twice decides that door's shire by luck of order.
    // The join takes the first and names the address, so the fault surfaces.
    const doubled: TenureBook = {
      ...FOUNDING_TENURE,
      doors: [
        ...FOUNDING_TENURE.doors,
        { ...FOUNDING_TENURE.doors[0], shireId: 'westmoor', feeId: 'fee-greaves' },
      ],
    };
    const r = readMusterTenure(doubled, [inPlay(FOUNDING_TENURE.doors[0].id)]);
    expect(r.twiceClaimed).toEqual([doorKey(FOUNDING_TENURE.doors[0].id)]);
    expect(r.placed[0].shire!.id).toBe('northreach'); // the first row, as declared
  });

  it('a fee’s patron at odds with the muster’s owner is a finding, not a refusal', () => {
    const first = FOUNDING_TENURE.doors[0];
    const r = readMusterTenure(FOUNDING_TENURE, [inPlay(first.id, 'Osbert Ravensworth')]);
    // It places — a door places on its ids, never on a name matching.
    expect(r.placed).toHaveLength(1);
    expect(r.unplaced).toEqual([]);
    // …and the disagreement is carried out where it can be read.
    expect(r.placed[0].patronAgrees).toBe(false);
    expect(r.atOdds).toHaveLength(1);
    expect(r.atOdds[0].owner).toBe('Osbert Ravensworth');
    expect(r.atOdds[0].fee!.patron).toBe('Mira Ashcombe');
  });
});

// ── The standing, read off the MUSTER ───────────────────────────────────────

describe('readShireStanding driven off a joined muster', () => {
  it('the muster’s doors decide the standing, not the founding book’s', () => {
    // The reading that makes the whole join worth having. Northreach reads a SHIRE in
    // the book; muster only a part of it and the same reading, unchanged, reads
    // a MARCH — because the standing is folded from the doors it is handed.
    const northreach = doorsOfShire(FOUNDING_TENURE, 'northreach');
    const short = northreach.slice(0, SHIRE_MIN_DOORS - 5);
    const r = readMusterTenure(FOUNDING_TENURE, asMuster(short));

    expect(readShireStanding(FOUNDING_TENURE, 'northreach', HEADED)!.standing).toBe('shire');
    const mustered = readShireStanding(r.book, 'northreach', HEADED)!;
    expect(mustered.standing).toBe('march');
    expect(mustered.doors).toBe(short.length);
    expect(mustered.wanting[0]).toMatch(/5 more doors/);
    // The book itself was not touched to say this — the narrowed one is a new
    // object over the same records.
    expect(FOUNDING_TENURE.doors.length).toBeGreaterThan(r.book.doors.length);
    expect(r.book.shires).toBe(FOUNDING_TENURE.shires);
  });

  it('every metro of the joined book reads its standing, marches first', () => {
    const r = readMusterTenure(FOUNDING_TENURE, asMuster(FOUNDING_TENURE.doors));
    expect(readShireStandings(r.book, HEADED).map((s) => `${s.shire.id}:${s.standing}`))
      .toEqual(['westmoor:march', 'northreach:shire']);
  });

  it('doors the hierarchy cannot place count toward NO metro’s standing', () => {
    // The honest arithmetic: an unplaced door is not quietly filed under the
    // nearest shire to make a count look better. It stands in the unplaced set
    // and nowhere else.
    const northreach = doorsOfShire(FOUNDING_TENURE, 'northreach');
    const strays = Array.from({ length: 40 }, (_, i) => inPlay(`${1_000 + i} Nowhere Lane, unit A`));
    const r = readMusterTenure(FOUNDING_TENURE, [...asMuster(northreach), ...strays]);
    expect(r.unplaced).toHaveLength(40);
    expect(readShireStanding(r.book, 'northreach', HEADED)!.doors).toBe(northreach.length);
    expect(r.byShire.reduce((n, t) => n + t.doors, 0)).toBe(northreach.length);
  });
});

// ── Against a real muster ───────────────────────────────────────────────────

describe('the founding hierarchy against a real grand muster', () => {
  /** A grand muster's own door book. `generateGrandMuster` deals it with exactly
   *  this call before it deals anything else, so these ARE the doors in play. */
  const grand = () => makeDoors(dice('the-grand-muster'), 200);

  it('a war door carries NO tenure of its own — only an address and an owner', () => {
    // The runtime mirror of `WAR_DOOR_CARRIES_NO_TENURE`. If a hand ever hangs
    // `shireId` on the persisted war door, both this and the compiler object,
    // and the migration conversation happens on purpose.
    for (const d of grand().slice(0, 8)) {
      expect(Object.keys(d).sort()).toEqual(['address', 'owner']);
    }
  });

  it('the book reaches ONE door in two hundred — the finding, said as a number', () => {
    // Not a broken join: the founding hierarchy's streets run consecutively
    // (101–108 Willow Row) while the muster's generator walks a different street
    // every door (101 Willow Row, 102 Cobblegate Lane…), so the two books
    // overlap almost nowhere. That is delegation debt in the tenure axis — 199
    // doors in play stand in no fee — and it is meant to be READ, loudly, not
    // papered over by a looser key.
    //
    // If the founding book is widened to cover the muster, this number moves.
    // Move it here deliberately; that is the tripwire working.
    const r = readMusterTenure(FOUNDING_TENURE, grand());
    expect(r.mustered).toBe(200);
    expect(r.placed).toHaveLength(1);
    expect(r.unplaced).toHaveLength(199);
    expect(placedShare(r)).toBeCloseTo(0.005, 5);
    expect(r.unplacedByReason).toEqual([
      { id: 'no-row', name: expect.stringMatching(/in no fee/i), doors: 199 },
    ]);
    expect(r.placed[0].address).toBe('101 Willow Row, unit A');
    expect(r.placed[0].shire!.name).toBe('Northreach');
  });

  it('a book cut over the muster places EVERY door — the join is sound', () => {
    // The other half of the finding above, so the two are never confused: hand
    // the join a hierarchy that actually covers the doors in play and it places
    // all two hundred. The gap is the founding book's reach, not the seam.
    const doors = grand();
    const covering: TenureBook = {
      ...FOUNDING_TENURE,
      doors: doors.map((w, i) => ({
        id: w.address,
        realmId: 'am',
        shireId: i % 5 === 0 ? 'westmoor' : 'northreach',
        feeId: FOUNDING_TENURE.fees[i % FOUNDING_TENURE.fees.length].id,
        knightId: i % 9 === 0 ? null : i % 2 === 0 ? 'knight-aldous' : 'knight-maren',
      })),
    };
    const r = readMusterTenure(covering, doors);
    expect(placedShare(r)).toBe(1);
    expect(r.unplaced).toEqual([]);
    expect(r.byShire.reduce((n, t) => n + t.doors, 0)).toBe(200);
    expect(r.unattended.length).toBeGreaterThan(0);
    // …and now the shelf's own reading answers about the OPERATION: two metros,
    // both carrying real weight, folded from the muster and nothing else.
    const standings = readShireStandings(r.book, HEADED);
    expect(standings.map((s) => s.shire.id).sort()).toEqual(['northreach', 'westmoor']);
    for (const s of standings) expect(s.standing).toBe('shire');
    expect(standings.reduce((n, s) => n + s.doors, 0)).toBe(200);
  });
});
