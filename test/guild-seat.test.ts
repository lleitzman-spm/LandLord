// Seating a master over a Crown office. Edwin, testing 2026-07-27: *"when I try
// to seat a master over any of the offices it seems to go through but then it's
// still empty."*
//
// It went through. It just could never be READ back — and the act that looked
// like it worked was quietly founding a phantom fief each time it was pressed.
// This is the failure mode the kingdom fears most: an act that reports success
// and changes nothing a reading can see.
import { describe, it, expect } from 'vitest';
import { FOUNDING_GUILDS, keepOf, readGuilds } from '../src/domain/guilds';
import { assembleKingdom } from '../src/domain/court';
import { foundingDoc } from './fixtures';
import type { Kingdom } from '../src/domain/types';

/** A vault taken BEFORE the Brokerage refounding — the six departments as
 *  territories, no `office-*` seat anywhere. This is the shape every live vault
 *  is in until it is reset, which is exactly where Edwin hit this. */
function staleKingdom(): Kingdom {
  const doc = foundingDoc();
  doc.census.territories = [
    { id: 'property-management', name: 'Property Management', kind: 'fief' },
    { id: 'maintenance', name: 'Maintenance', kind: 'hamlet', parentId: 'property-management' },
    { id: 'leasing', name: 'Leasing', kind: 'fief' },
    { id: 'legal', name: 'Legal', kind: 'fief' },
    { id: 'technology', name: 'Technology', kind: 'fief' },
    { id: 'marketing', name: 'Marketing', kind: 'fief' },
  ];
  doc.acts.grants = [];
  return assembleKingdom(doc.census, doc.acts);
}

const works = FOUNDING_GUILDS.find((g) => g.id === 'works')!;

describe('seating a master over a Crown office', () => {
  it('names NO keep when the office it declares is not in the census', () => {
    // The old fold returned the declared id unconditionally, so it named a
    // territory that does not exist. Everything downstream then read a seat
    // nobody could ever fill: masterOf found no grant on a phantom id, and the
    // panel found no territory to offer, so it founded ANOTHER one — forever.
    expect(keepOf(staleKingdom(), works)).toBeNull();
  });

  it('still names the declared office where it DOES stand', () => {
    const kingdom = assembleKingdom(foundingDoc().census, foundingDoc().acts);
    expect(keepOf(kingdom, works)).toBe('office-works');
  });

  it('reads a master once the office is founded and granted — the act STICKS', () => {
    // The exact sequence the panel performs: found the keep under the craft's
    // own name, then grant it in the same breath.
    const doc = foundingDoc();
    doc.census.territories = [];
    doc.acts.grants = [];
    doc.census.territories.push({
      id: 'the-office-of-works',
      name: 'The Office of Works',
      kind: 'office',
    });
    doc.acts.grants.push({
      id: 'g1',
      territoryId: 'the-office-of-works',
      personId: 'mabel',
      role: 'lord',
      grantedOn: '2026-07-27',
    });
    const kingdom = assembleKingdom(doc.census, doc.acts);
    expect(keepOf(kingdom, works)).toBe('the-office-of-works');

    const reading = readGuilds(kingdom, [], '2026-07-27T00:00:00.000Z').find(
      (g) => g.guild.id === 'works',
    )!;
    expect(reading.manned).toBe(true);
    expect(reading.master?.name).toBe('Mabel');
  });

  it('a stale vault reads every craft headless — honestly, and fillable', () => {
    const readings = readGuilds(staleKingdom(), [], '2026-07-27T00:00:00.000Z');
    expect(readings.map((g) => g.manned)).toEqual([false, false, false]);
    // And each one names no keep, which is what makes the panel offer to FOUND
    // one instead of granting a phantom.
    expect(readings.map((g) => g.keepId)).toEqual([null, null, null]);
  });
});
