// The Kingdom's data model. See docs/KINGDOM.md — that document is canon;
// this file implements it.

// ── Pledges ────────────────────────────────────────────────────────────────

export type PledgeType = 'king' | 'steward' | 'vassal' | 'squire' | 'sellsword';

export interface Person {
  id: string;
  name: string;
  pledge: PledgeType;
  /** Squires pledge to a person, not a fief. */
  pledgedTo?: string;
  note?: string;
}

// ── Territories ────────────────────────────────────────────────────────────

/** What a place in the book IS (WRIT-THE-BROKERAGE, 2026-07-27).
 *  - `fief`   — a group's book of doors: land, held by a lord, worked by knights.
 *  - `hamlet` — a lesser holding inside a fief.
 *  - `office` — a CROWN OFFICE, seated in the palace and never on land: the
 *    Office of Works, the Office of Tenancy, the Chancery. It is a place in the
 *    record only so a Chancellor's seat is a grant like any other, revocable the
 *    same way — but it is NOT land and never appears on the map. */
export type TerritoryKind = 'fief' | 'hamlet' | 'office';

export interface Territory {
  id: string;
  name: string;
  kind: TerritoryKind;
  /** Hamlets nest inside a fief. */
  parentId?: string;
  note?: string;
}

// ── The deliberate acts, recorded ──────────────────────────────────────────
// Authority exists only through these records. Their absence is itself a
// reading: no grant + no appointment = stewardship (delegation debt).

/** Places an internal vassal in charge of a territory. THREE senses, all
 *  carried by the same two stored roles:
 *    lord  on a FIEF   = the line of rule
 *    mayor on a HAMLET = the line of trade
 *    lord  on an OFFICE = a CHANCELLOR's seat — a Crown office, never land.
 *  The third is the one that has caused two shipped bugs by being read as the
 *  first: a Chancellor counted toward land plurality, and clicking an office
 *  blanked the board. Read the TERRITORY's kind, never the role alone. */
export interface Grant {
  id: string;
  territoryId: string;
  personId: string;
  role: 'lord' | 'mayor';
  grantedOn: string;
}

/** Formally names an artisan the keeper of a lordless territory — they
 *  keep the castle for its absent lord. This record is what makes a
 *  regency a regency and not stewardship. */
export interface KeeperAppointment {
  id: string;
  territoryId: string;
  personId: string;
  appointedOn: string;
}

/** Stations an artisan in a territory as workforce. Not authority. */
export interface GarrisonPosting {
  id: string;
  territoryId: string;
  personId: string;
}

/** A vassal serving inside a fief under its lord — or one of a Crown
 *  office's own hands, under its Chancellor. */
export interface Fealty {
  id: string;
  territoryId: string;
  personId: string;
}

// ── The kingdom ────────────────────────────────────────────────────────────

export interface Kingdom {
  people: Person[];
  territories: Territory[];
  grants: Grant[];
  appointments: KeeperAppointment[];
  postings: GarrisonPosting[];
  fealties: Fealty[];
}

// ── The four states of a fief ──────────────────────────────────────────────
// Always computed from the records, never stored.

export type FiefState =
  | 'lorded' // 🟢 internal vassal holds it by explicit grant
  | 'plurality' // 🟢 its lord holds several fiefs, each by explicit grant
  | 'regency' // 🟡 no lord; an appointed keeper keeps it
  | 'stewardship'; // 🔴 no record at all; falls to the Regent's desk as delegation debt

export type HamletState =
  | 'mayored' // 🟢 a mayor holds it (line of trade)
  | 'garrisoned'; // 🟡 worked land, no local leadership yet
