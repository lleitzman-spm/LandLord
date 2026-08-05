// The court: where the deliberate acts are made and struck. The census in
// census.ts is the founding document — ratified, dated, immutable. The
// living records reside in the chronicle in two books, each adopted from
// the founding census the first time a chronicle without it is opened:
//
//   - the book of acts: grants, keeper appointments, garrison postings,
//     fealty — every deliberate act of authority or service
//   - the census book: the people and territories the acts point at
//
// From adoption on, presence in the book is the only truth. Making a
// record appends it; revoking or striking one removes it — founding
// records included. Whatever state that leaves the kingdom in is a
// reading on the gauge, never an error.

import type {
  Fealty,
  GarrisonPosting,
  Grant,
  KeeperAppointment,
  Kingdom,
  Person,
  Territory,
} from './types';
import { census } from './census';

export interface ActsBook {
  grants: Grant[];
  appointments: KeeperAppointment[];
  postings: GarrisonPosting[];
  fealties: Fealty[];
}

export interface CensusBook {
  people: Person[];
  territories: Territory[];
}

/** The acts as ratified at the founding — the chronicle's starting book. */
export const FOUNDING_ACTS: ActsBook = {
  grants: census.grants,
  appointments: census.appointments,
  postings: census.postings,
  fealties: census.fealties,
};

/** The people and territories as ratified at the founding. */
export const FOUNDING_CENSUS: CensusBook = {
  people: census.people,
  territories: census.territories,
};

/** The living kingdom, assembled entirely from the chronicle's books. */
export function assembleKingdom(censusBook: CensusBook, acts: ActsBook): Kingdom {
  return { ...censusBook, ...acts };
}

/** True while the book still reads exactly as ratified at the founding. */
export function actsAtFounding(acts: ActsBook): boolean {
  return JSON.stringify(acts) === JSON.stringify(FOUNDING_ACTS);
}

export function censusAtFounding(censusBook: CensusBook): boolean {
  return JSON.stringify(censusBook) === JSON.stringify(FOUNDING_CENSUS);
}

/** True when the act (grant, appointment, posting, or fealty) this id names
 *  is one of the acts ratified straight from census.ts at the founding —
 *  the ones a stray click should not be able to strike without a confirm
 *  (BETA blocker S3: founding records strikable in one click). A record made
 *  since — by a game or by hand — is not founding, and strikes in one click
 *  as it always has. */
export function isFoundingActId(actId: string): boolean {
  return (
    FOUNDING_ACTS.grants.some((g) => g.id === actId) ||
    FOUNDING_ACTS.appointments.some((a) => a.id === actId) ||
    FOUNDING_ACTS.postings.some((p) => p.id === actId) ||
    FOUNDING_ACTS.fealties.some((f) => f.id === actId)
  );
}

/** True when the person or territory this id names is one of the census's
 *  founding records — the 11 real people or the 3 Crown offices ratified from
 *  census.ts. Same guard as `isFoundingActId`, for the census book. */
export function isFoundingCensusId(id: string): boolean {
  return (
    FOUNDING_CENSUS.people.some((p) => p.id === id) ||
    FOUNDING_CENSUS.territories.some((t) => t.id === id)
  );
}

/** Who may hold territory by grant: vassals — and the Regent, though the
 *  ruling of 2026-07-17 shows that door deliberately left unwalked. */
export function grantable(kingdom: Kingdom): Person[] {
  return kingdom.people.filter(
    (p) => p.pledge === 'vassal' || p.pledge === 'steward',
  );
}

/** Who may keep a castle, or be stationed as a garrison: artisans.
 *  Keeping and working are labor, not holding — fiefs are for subjects. */
export function appointable(kingdom: Kingdom): Person[] {
  return kingdom.people.filter((p) => p.pledge === 'sellsword');
}

/** Who may swear fealty inside a fief: vassals. Squires pledge to a
 *  person, not a fief; artisans are posted, not sworn. */
export function swearable(kingdom: Kingdom): Person[] {
  return kingdom.people.filter((p) => p.pledge === 'vassal');
}
