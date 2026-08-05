// The founding census — SEED DATA FOR THE DEMO TENANT. See docs/KINGDOM.md.
//
// ⚠ Every person below is INVENTED. Harold, Edwin, Mabel, Osric, Alys, Piers,
// Marlowe, Thatch, Mason, Carver and Sterling are a fictional cast, and this is
// a worked example of the pledge model — not any real company's staff, and not
// a template for how a firm ought to be organised. A deployment enrolls its own
// people in the app; nothing here is meant to survive first contact with one.
//
// Raw data in, structure out: corrections to this file are missing facts
// being filled, never rule violations.
//
// Since the court opened and the census came alive (2026-07-17), this
// entire file is the FOUNDING record only: the living books — acts
// (grants, appointments, postings, fealty) and census (people,
// territories) — reside in the chronicle (see domain/court.ts), seeded
// from here exactly once. Editing this file after adoption changes
// history, not the present.

import type { Kingdom, Territory } from './types';

export const FOUNDING = '2026-07-17';

export const census: Kingdom = {
  // Refounded 2026-07-27 to the Brokerage model (docs/WRIT-THE-BROKERAGE.md).
  // What stood before was the founding scaffolding: six DEPARTMENTS recorded as
  // territories, because at the founding a craft had to be seated somewhere and
  // a territory was the only seat there was. Once fiefs became literal land that
  // was a collision, not a shortcut — Alys read as "vassal of a fief" that is
  // not land at all. The crafts and the land are now separate things.
  people: [
    { id: 'harold', name: 'Harold', pledge: 'king' },
    {
      id: 'edwin',
      name: 'Edwin',
      pledge: 'steward',
      note: 'Regent. Administers the kingdom for the King. Catch-basin for everything undelegated.',
    },
    // The Chancellors — the household's own staff. They head a craft; they hold
    // no land, and only an agent may hold land.
    { id: 'mabel', name: 'Mabel', pledge: 'vassal', note: 'Chancellor of Works.' },
    { id: 'osric', name: 'Osric', pledge: 'vassal', note: 'Chancellor of Tenancy.' },
    { id: 'alys', name: 'Alys', pledge: 'vassal', note: 'Chancellor of the Chancery.' },
    // The agents — these alone rise through the land.
    { id: 'piers', name: 'Piers', pledge: 'squire', pledgedTo: 'edwin', note: 'An agent in training.' },
    // The artisans — hands from the outside trades. They work the land, they can
    // even keep it, they can never hold it.
    { id: 'marlowe', name: 'Marlowe', pledge: 'sellsword', note: 'Outside counsel — the lawyers\' guild.' },
    { id: 'thatch', name: 'Thatch', pledge: 'sellsword', note: 'The roofers\' guild.' },
    { id: 'mason', name: 'Mason', pledge: 'sellsword', note: 'The builders\' guild.' },
    { id: 'carver', name: 'Carver', pledge: 'sellsword', note: 'The wrights\' guild.' },
    { id: 'sterling', name: 'Sterling', pledge: 'sellsword', note: 'The lenders\' guild.' },
  ],

  // The three CROWN OFFICES, seated in the palace. Never land, never on the map.
  // Property management divides three ways and these are they; what used to be
  // Property Management as a department is dissolved, because it IS the three.
  territories: [
    { id: 'office-works', name: 'The Office of Works', kind: 'office' },
    { id: 'office-tenancy', name: 'The Office of Tenancy', kind: 'office' },
    { id: 'office-chancery', name: 'The Chancery', kind: 'office' },
    // No fief stands at the founding. A fief is a group's book of doors, and the
    // realm has no groups until the Regent founds them — an empty land read
    // honestly as debt is the gauge working, not a gap.
  ],

  grants: [
    {
      id: 'grant-works-mabel',
      territoryId: 'office-works',
      personId: 'mabel',
      role: 'lord',
      grantedOn: FOUNDING,
    },
    {
      id: 'grant-tenancy-osric',
      territoryId: 'office-tenancy',
      personId: 'osric',
      role: 'lord',
      grantedOn: FOUNDING,
    },
    {
      id: 'grant-chancery-alys',
      territoryId: 'office-chancery',
      personId: 'alys',
      role: 'lord',
      grantedOn: FOUNDING,
    },
  ],

  appointments: [],
  postings: [],
  fealties: [],
};

// ── What may become land, and what may never ───────────────────────────────
//
// A FIEF and a HAMLET are land: a hamlet graduates to a fief when the kingdom
// needs it sovereign, and a fief folds back inside another as a hamlet. A CROWN
// OFFICE is not land at all — it is the household's own craft, seated in the
// palace (docs/WRIT-THE-BROKERAGE.md) — so neither act may touch one.
//
// This lived as an unguarded store mutation until 2026-07-29, and the gap was
// destructive: the fief page's "Fold into which fief…" control rewrote an
// office's kind to `hamlet`, the office vanished from the court tree, its
// Chancellor's grant became a stray record on a hamlet, and nothing in the app
// could put it back — `promote` restores `fief`, not `office`. Two clicks from
// the Census, silent, and irreversible.

/** True when this territory may be promoted or folded — i.e. when it is land. */
export function mayChangeStanding(territories: Territory[], territoryId: string): boolean {
  return territories.find((t) => t.id === territoryId)?.kind !== 'office';
}

/** Fold a fief back inside another as a hamlet. Refuses a Crown office, refuses
 *  a fold into itself, and returns the book UNCHANGED when it refuses. */
export function foldIntoFief(
  territories: Territory[],
  territoryId: string,
  parentId: string,
): Territory[] {
  if (!parentId || parentId === territoryId) return territories;
  if (!mayChangeStanding(territories, territoryId)) return territories;
  return territories.map((t) =>
    t.id === territoryId ? { ...t, kind: 'hamlet' as const, parentId } : t,
  );
}

/** Raise a hamlet to a fief of its own. Refuses a Crown office. */
export function raiseToFief(territories: Territory[], territoryId: string): Territory[] {
  if (!mayChangeStanding(territories, territoryId)) return territories;
  return territories.map((t) =>
    t.id === territoryId ? { ...t, kind: 'fief' as const, parentId: undefined } : t,
  );
}
