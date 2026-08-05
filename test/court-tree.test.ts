// The court tree — the census read as a HIERARCHY, not a roster
// (docs/WRIT-THE-BROKERAGE.md). What is tested here is the SHAPE: who answers
// to whom, and that nobody enrolled falls out of the drawing. A subject the
// tree cannot place is a subject nobody can manage, which is exactly the fault
// this rebuild exists to end.
import { describe, it, expect } from 'vitest';
import { readCourtTree, tradeOf } from '../src/domain/courtTree';
import { assembleKingdom } from '../src/domain/court';
import { foundingDoc } from './fixtures';
import type { Kingdom, Person } from '../src/domain/types';

function kingdomOf(mutate?: (doc: ReturnType<typeof foundingDoc>) => void): Kingdom {
  const doc = foundingDoc();
  mutate?.(doc);
  return assembleKingdom(doc.census, doc.acts);
}

const names = (people: { name: string }[]) => people.map((p) => p.name).sort();

describe('the court tree — the realm’s shape, folded from the records', () => {
  it('draws the Crown at the head, with its wards beneath it', () => {
    const t = readCourtTree(kingdomOf());
    expect(t.king?.name).toBe('Harold');
    expect(t.regent?.name).toBe('Edwin');
    // Piers is an agent in training pledged to the Regent himself. He stands in
    // no fief — but he travels with the Crown, so he is drawn, not adrift.
    expect(names(t.wards)).toEqual(['Piers']);
    expect(t.unseated).toEqual([]);
  });

  it('seats all three Crown offices with their Chancellors', () => {
    const t = readCourtTree(kingdomOf());
    expect(t.offices.map((o) => o.territory.name)).toEqual([
      'The Office of Works',
      'The Office of Tenancy',
      'The Chancery',
    ]);
    expect(t.offices.map((o) => o.chancellor?.name)).toEqual(['Mabel', 'Osric', 'Alys']);
    // Every seat is a GRANT — revocable exactly like any other, which is what
    // makes a Chancellor manageable where they stand.
    expect(t.offices.every((o) => o.grant != null)).toBe(true);
  });

  it('a headless office reads as headless — never as somebody else’s', () => {
    const t = readCourtTree(
      kingdomOf((doc) => {
        doc.acts.grants = doc.acts.grants.filter((g) => g.territoryId !== 'office-works');
      }),
    );
    const works = t.offices.find((o) => o.territory.id === 'office-works')!;
    expect(works.chancellor).toBeNull();
    expect(works.grant).toBeNull();
    // And the Chancellor who lost the seat is now standing nowhere — visible,
    // because an invisible unseated subject cannot be re-seated.
    expect(names(t.unseated)).toEqual(['Mabel']);
  });

  it('no fief stands at the founding — an empty land, read honestly', () => {
    expect(readCourtTree(kingdomOf()).fiefs).toEqual([]);
  });

  it('hangs knights under their fief’s lord, and squires under their knight', () => {
    const t = readCourtTree(
      kingdomOf((doc) => {
        doc.census.territories.push({ id: 'north', name: 'The North', kind: 'fief' });
        doc.census.people.push(
          { id: 'ned', name: 'Ned', pledge: 'vassal' },
          { id: 'jon', name: 'Jon', pledge: 'vassal' },
          { id: 'pod', name: 'Podrick', pledge: 'squire', pledgedTo: 'jon' },
        );
        doc.acts.grants.push({
          id: 'grant-north',
          territoryId: 'north',
          personId: 'ned',
          role: 'lord',
          grantedOn: '2026-07-27',
        });
        doc.acts.fealties.push({ id: 'f-jon', territoryId: 'north', personId: 'jon' });
      }),
    );
    expect(t.fiefs).toHaveLength(1);
    const north = t.fiefs[0];
    expect(north.lord?.name).toBe('Ned');
    expect(north.state).toBe('lorded');
    expect(north.knights.map((k) => k.person.name)).toEqual(['Jon']);
    // The squire is drawn beneath his own knight — pledged to a PERSON, seated
    // in that knight's fief. And he is not also listed as adrift.
    expect(names(north.knights[0].squires)).toEqual(['Podrick']);
    expect(t.unseated).toEqual([]);
  });

  it('a fief with no grant draws NO lord — the Regent is not its lord', () => {
    // `readFief` names the Regent the holder of undelegated land (delegation
    // debt). This view must not turn that into a lordship on the drawing.
    const t = readCourtTree(
      kingdomOf((doc) => {
        doc.census.territories.push({ id: 'riverlands', name: 'The Riverlands', kind: 'fief' });
      }),
    );
    const r = t.fiefs[0];
    expect(r.state).toBe('stewardship');
    expect(r.lord).toBeNull();
    expect(r.keeper).toBeNull();
  });

  it('a Chancellor granted ONE fief holds one fief — an office is not land', () => {
    // The gauge lied here once: a Chancellor's seat is a lord-role grant on an
    // OFFICE, so counting it made a single fief read "held in plurality." A
    // measuring instrument that lies is worse than none.
    const t = readCourtTree(
      kingdomOf((doc) => {
        doc.census.territories.push({ id: 'west', name: 'The Westmarch', kind: 'fief' });
        doc.acts.grants.push({
          id: 'grant-west',
          territoryId: 'west',
          personId: 'mabel', // already Chancellor of Works
          role: 'lord',
          grantedOn: '2026-07-27',
        });
      }),
    );
    expect(t.fiefs[0].lord?.name).toBe('Mabel');
    expect(t.fiefs[0].state).toBe('lorded');
  });

  it('but two fiefs under one lord IS a plurality', () => {
    const t = readCourtTree(
      kingdomOf((doc) => {
        doc.census.territories.push(
          { id: 'west', name: 'The Westmarch', kind: 'fief' },
          { id: 'east', name: 'The Eastmarch', kind: 'fief' },
        );
        doc.acts.grants.push(
          {
            id: 'grant-west',
            territoryId: 'west',
            personId: 'mabel',
            role: 'lord',
            grantedOn: '2026-07-27',
          },
          {
            id: 'grant-east',
            territoryId: 'east',
            personId: 'mabel',
            role: 'lord',
            grantedOn: '2026-07-27',
          },
        );
      }),
    );
    expect(t.fiefs.map((f) => f.state)).toEqual(['plurality', 'plurality']);
  });

  it('a regency draws its keeper, not a lord', () => {
    const t = readCourtTree(
      kingdomOf((doc) => {
        doc.census.territories.push({ id: 'vale', name: 'The Vale', kind: 'fief' });
        doc.acts.appointments.push({
          id: 'a-vale',
          territoryId: 'vale',
          personId: 'marlowe',
          appointedOn: '2026-07-27',
        });
      }),
    );
    const vale = t.fiefs[0];
    expect(vale.state).toBe('regency');
    expect(vale.lord).toBeNull();
    expect(vale.keeper?.name).toBe('Marlowe');
  });

  it('folds the outside trades from their hands’ own notes', () => {
    const t = readCourtTree(kingdomOf());
    expect(t.trades.map((g) => g.name)).toEqual([
      "The builders' guild",
      "The lawyers' guild",
      "The lenders' guild",
      "The roofers' guild",
      "The wrights' guild",
    ]);
    expect(t.trades.every((g) => g.artisans.length === 1)).toBe(true);
    expect(t.unaffiliated).toEqual([]);
  });

  it('gathers several hands of one trade under that one guild', () => {
    const t = readCourtTree(
      kingdomOf((doc) => {
        doc.census.people.push({
          id: 'otto',
          name: 'Otto',
          pledge: 'sellsword',
          note: 'The roofers’ guild.',
        });
      }),
    );
    const roofers = t.trades.filter((g) => g.id.startsWith('roofers'));
    // The curly apostrophe and the straight one are the same trade to a reader,
    // and a fold that splits them invents a guild that does not exist.
    expect(roofers).toHaveLength(1);
    expect(names(roofers[0].artisans)).toEqual(['Otto', 'Thatch']);
  });

  it('an artisan naming no trade is shown, not swallowed', () => {
    const t = readCourtTree(
      kingdomOf((doc) => {
        doc.census.people.push({ id: 'bronn', name: 'Bronn', pledge: 'sellsword' });
      }),
    );
    expect(names(t.unaffiliated)).toEqual(['Bronn']);
  });

  it('EVERY enrolled subject is drawn somewhere — the totality guarantee', () => {
    // The fault this rebuild ends: a subject the census holds but the drawing
    // cannot place is a subject nobody can manage. Nobody may fall through.
    const kingdom = kingdomOf((doc) => {
      doc.census.territories.push({ id: 'north', name: 'The North', kind: 'fief' });
      doc.census.people.push(
        { id: 'ned', name: 'Ned', pledge: 'vassal' },
        { id: 'jon', name: 'Jon', pledge: 'vassal' },
        { id: 'pod', name: 'Podrick', pledge: 'squire', pledgedTo: 'jon' },
        { id: 'brienne', name: 'Brienne', pledge: 'vassal' },
        { id: 'bronn', name: 'Bronn', pledge: 'sellsword' },
      );
      doc.acts.grants.push({
        id: 'grant-north',
        territoryId: 'north',
        personId: 'ned',
        role: 'lord',
        grantedOn: '2026-07-27',
      });
      doc.acts.fealties.push({ id: 'f-jon', territoryId: 'north', personId: 'jon' });
      doc.acts.postings.push({ id: 'p-bronn', territoryId: 'north', personId: 'bronn' });
    });
    const t = readCourtTree(kingdom);

    const drawn = new Set<string>();
    const add = (p: Person | null | undefined) => p && drawn.add(p.id);
    add(t.king);
    add(t.regent);
    t.wards.forEach(add);
    for (const o of t.offices) {
      add(o.chancellor);
      o.hands.forEach((h) => add(h.person));
      o.garrison.forEach((g) => add(g.person));
    }
    for (const f of t.fiefs) {
      add(f.lord);
      add(f.keeper);
      f.garrison.forEach((g) => add(g.person));
      for (const k of f.knights) {
        add(k.person);
        k.squires.forEach(add);
      }
      for (const h of f.hamlets) {
        add(h.mayor);
        h.garrison.forEach(add);
      }
    }
    t.unseated.forEach(add);
    t.trades.forEach((g) => g.artisans.forEach(add));
    t.unaffiliated.forEach(add);

    const missing = kingdom.people.filter((p) => !drawn.has(p.id)).map((p) => p.name);
    expect(missing).toEqual([]);
    expect(names(t.unseated)).toEqual(['Brienne']);
  });
});

describe('tradeOf — a trade read off an artisan’s own note', () => {
  const artisan = (note?: string): Person => ({
    id: 'x',
    name: 'X',
    pledge: 'sellsword',
    note,
  });

  it('reads the trade out of a sentence', () => {
    expect(tradeOf(artisan('Outside counsel — the lawyers\' guild.'))?.name).toBe(
      "The lawyers' guild",
    );
  });

  it('takes at most two words before "guild" — never a whole clause', () => {
    const t = tradeOf(artisan('Came up through the docks and joined the foundation guild.'));
    expect(t?.name).toBe('The foundation guild');
  });

  it('names no trade where the note names none', () => {
    expect(tradeOf(artisan())).toBeNull();
    expect(tradeOf(artisan('A good hand.'))).toBeNull();
  });
});
