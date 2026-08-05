// THE CROWN OFFICES — a craft is not land, and the code must know it.
//
// The refounding (docs/WRIT-THE-BROKERAGE.md, 2026-07-27) replaced the six
// DEPARTMENTS-as-fiefs with three CROWN OFFICES under Chancellors. The code was
// refounded; several readings and one whole surface were not, and the sharpest
// consequence was destructive: the fief page's "Fold into which fief…" control
// rewrote an office's `kind` to `hamlet`, the office then vanished from the
// court tree, its Chancellor's grant became a stray record, and nothing in the
// app could put it back — two clicks from the Census, silent and irreversible.
//
// These are the guards, proven to bite by violating them on purpose (the same
// discipline the tenure hierarchy's own guards were held to).

import { describe, expect, it } from 'vitest';
import { FOUNDING_CHRONICLE, normalizeChronicle } from '../src/domain/chronicle';
import { readKingdom } from '../src/domain/states';
import { assembleKingdom } from '../src/domain/court';
import { readGuilds } from '../src/domain/guilds';
import { readCourtTree } from '../src/domain/courtTree';
import { foldIntoFief, mayChangeStanding, raiseToFief } from '../src/domain/census';
import { readArrivalText } from '../src/domain/scribe';
import type { Chronicle } from '../src/domain/chronicle';

const NOW = '2026-07-29T00:00:00.000Z';
const founding = (): Chronicle => normalizeChronicle(structuredClone(FOUNDING_CHRONICLE));

const officeIds = (c: Chronicle) =>
  c.census.territories.filter((t) => t.kind === 'office').map((t) => t.id);

describe('THE CROWN OFFICES — the founding shape', () => {
  it('the founding census holds three offices and no fief', () => {
    const c = founding();
    expect(officeIds(c)).toEqual(['office-works', 'office-tenancy', 'office-chancery']);
    expect(c.census.territories.filter((t) => t.kind === 'fief')).toHaveLength(0);
  });

  it('every office is seated by a LORD-role grant, and reads as headed', () => {
    const c = founding();
    const kingdom = assembleKingdom(c.census, c.acts);
    for (const id of officeIds(c)) {
      const grant = kingdom.grants.find((g) => g.territoryId === id);
      expect(grant?.role).toBe('lord');
    }
    const guilds = readGuilds(kingdom, c.events, NOW);
    expect(guilds).toHaveLength(3);
    for (const g of guilds) expect(g.manned).toBe(true);
  });

  it('the two readings AGREE about who heads an office', () => {
    // `readGuilds` counted a mayor grant as a master while `readCourtTree` has
    // only ever read a lord grant — so the same office could read headed on one
    // surface and headless on another. A measuring instrument that lies is
    // worse than none, and this one lied in two directions at once.
    const c = founding();
    const kingdom = assembleKingdom(c.census, c.acts);
    const guilds = readGuilds(kingdom, c.events, NOW);
    const tree = readCourtTree(kingdom, c.census, NOW);
    for (const office of tree.offices) {
      const guild = guilds.find((g) => g.keepId === office.territory.id);
      expect(Boolean(guild?.manned)).toBe(Boolean(office.chancellor));
      if (office.chancellor) expect(guild?.master?.id).toBe(office.chancellor.id);
    }
  });

  it('a MAYOR grant does not seat a Chancellor — mayor is the line of trade', () => {
    const c = founding();
    const works = 'office-works';
    c.acts.grants = c.acts.grants.filter((g) => g.territoryId !== works);
    c.acts.grants.push({
      id: 'test-mayor-works',
      personId: c.census.people[1].id,
      territoryId: works,
      role: 'mayor',
      grantedOn: '2026-07-29',
    });
    const kingdom = assembleKingdom(c.census, c.acts);
    const guild = readGuilds(kingdom, c.events, NOW).find((g) => g.keepId === works);
    expect(guild?.manned).toBe(false);
  });
});

describe('THE CROWN OFFICES — an office is never land', () => {
  it('the scribe names an office-holder a CHANCELLOR, not a lord', () => {
    // The stored role is `'lord'` on all three founding office grants — and it
    // stays that way, because renaming a stored value is a vault migration. So
    // the reading has to look at the TERRITORY, not the role.
    const c = founding();
    const kingdom = assembleKingdom(c.census, c.acts);
    const chancellorId = kingdom.grants.find((g) => g.territoryId === 'office-works')!.personId;
    const chancellor = kingdom.people.find((p) => p.id === chancellorId)!;
    const read = readArrivalText(kingdom, `A letter for ${chancellor.name}`);
    expect(read.lines.join(' ')).toContain(`${chancellor.name} is Chancellor of The Office of Works.`);
    expect(read.lines.join(' ')).not.toContain('lord of');
  });

  it('the whole realm reading carries no office among its fiefs', () => {
    // `readKingdom` folds only `kind: 'fief'`. An office slipping into that list
    // is what once made a Chancellor read "Held in plurality" and what blanked
    // the board when one was clicked.
    const c = founding();
    const kingdom = assembleKingdom(c.census, c.acts);
    const drawn = readKingdom(kingdom).map((r) => r.territory.id);
    for (const id of officeIds(c)) expect(drawn).not.toContain(id);
  });
});

describe('THE CROWN OFFICES — the acts that make land refuse them', () => {
  it('an office cannot be folded into a fief — the destructive path, shut', () => {
    const c = founding();
    const before = structuredClone(c.census.territories);
    // Violate it on purpose: fold The Chancery into the Office of Works.
    const after = foldIntoFief(c.census.territories, 'office-chancery', 'office-works');
    expect(after).toEqual(before);
    expect(after.find((t) => t.id === 'office-chancery')?.kind).toBe('office');
  });

  it('an office cannot be raised to a fief either', () => {
    const c = founding();
    const after = raiseToFief(c.census.territories, 'office-works');
    expect(after.find((t) => t.id === 'office-works')?.kind).toBe('office');
  });

  it('but LAND still moves both ways — the guard is not a wall around everything', () => {
    const c = founding();
    // Found a fief and a second one to fold it into, then walk it both ways.
    const land = [
      ...c.census.territories,
      { id: 'greenholt', name: 'Greenholt', kind: 'fief' as const },
      { id: 'stonefold', name: 'Stonefold', kind: 'fief' as const },
    ];
    const folded = foldIntoFief(land, 'greenholt', 'stonefold');
    expect(folded.find((t) => t.id === 'greenholt')).toMatchObject({
      kind: 'hamlet',
      parentId: 'stonefold',
    });
    const raised = raiseToFief(folded, 'greenholt');
    expect(raised.find((t) => t.id === 'greenholt')).toMatchObject({ kind: 'fief' });
    expect(raised.find((t) => t.id === 'greenholt')?.parentId).toBeUndefined();
  });

  it('a fold into itself, or into nothing, changes no record', () => {
    const c = founding();
    const land = [...c.census.territories, { id: 'greenholt', name: 'Greenholt', kind: 'fief' as const }];
    expect(foldIntoFief(land, 'greenholt', 'greenholt')).toEqual(land);
    expect(foldIntoFief(land, 'greenholt', '')).toEqual(land);
  });

  it('the law names WHICH territories may change standing', () => {
    const c = founding();
    for (const id of officeIds(c)) {
      expect(mayChangeStanding(c.census.territories, id)).toBe(false);
    }
    const land = [...c.census.territories, { id: 'greenholt', name: 'Greenholt', kind: 'fief' as const }];
    expect(mayChangeStanding(land, 'greenholt')).toBe(true);
  });
});
