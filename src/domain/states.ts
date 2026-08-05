// The state machine. States are always computed from the records, never
// stored — lordlessness is a reading on the gauge, not an error.

import type {
  FiefState,
  Grant,
  HamletState,
  KeeperAppointment,
  Kingdom,
  Person,
  Territory,
} from './types';

export interface FiefReading {
  territory: Territory;
  state: FiefState;
  /** The lord (lorded/plurality), the keeper (regency), or the Regent (stewardship). */
  holder: Person | null;
  grant: Grant | null;
  /** The keeper appointment on the books, if any — shown even when a lord
   *  holds the fief: a lingering record must stay visible to be revocable. */
  appointment: KeeperAppointment | null;
  /** Mayor-role grants on a fief — left behind when a hamlet was promoted.
   *  A record from another life stays visible so it can be revoked. */
  strayGrants: Grant[];
  hamlets: HamletReading[];
  vassals: Person[];
  garrison: Person[];
}

export interface HamletReading {
  territory: Territory;
  state: HamletState;
  mayor: Person | null;
  /** The mayor's grant — the record a revocation strikes. */
  grant: Grant | null;
  /** Lord-role grants on a hamlet — left behind when a fief was demoted. */
  strayGrants: Grant[];
  garrison: Person[];
}

const byId = (kingdom: Kingdom) =>
  new Map(kingdom.people.map((p) => [p.id, p]));

export function regent(kingdom: Kingdom): Person | null {
  return kingdom.people.find((p) => p.pledge === 'steward') ?? null;
}

export function king(kingdom: Kingdom): Person | null {
  return kingdom.people.find((p) => p.pledge === 'king') ?? null;
}

export function squiresOf(kingdom: Kingdom, personId: string): Person[] {
  return kingdom.people.filter(
    (p) => p.pledge === 'squire' && p.pledgedTo === personId,
  );
}

function readHamlet(kingdom: Kingdom, hamlet: Territory): HamletReading {
  const people = byId(kingdom);
  const mayorGrant = kingdom.grants.find(
    (g) => g.territoryId === hamlet.id && g.role === 'mayor',
  );
  const mayor = mayorGrant ? (people.get(mayorGrant.personId) ?? null) : null;
  const garrison = kingdom.postings
    .filter((post) => post.territoryId === hamlet.id)
    .map((post) => people.get(post.personId))
    .filter((p): p is Person => p != null);
  return {
    territory: hamlet,
    state: mayor ? 'mayored' : 'garrisoned',
    mayor,
    grant: mayorGrant ?? null,
    strayGrants: kingdom.grants.filter(
      (g) => g.territoryId === hamlet.id && g.role === 'lord',
    ),
    garrison,
  };
}

export function readFief(kingdom: Kingdom, fief: Territory): FiefReading {
  const people = byId(kingdom);

  const lordGrant =
    kingdom.grants.find(
      (g) => g.territoryId === fief.id && g.role === 'lord',
    ) ?? null;
  const appointment =
    kingdom.appointments.find((a) => a.territoryId === fief.id) ?? null;

  let state: FiefState;
  let holder: Person | null;
  if (lordGrant) {
    // Plurality means one lord holds SEVERAL FIEFS. Since the Brokerage
    // refounding (WRIT-THE-BROKERAGE, 2026-07-27) a Chancellor's seat is also a
    // lord-role grant — on an OFFICE, which is not land. Counting those made a
    // Chancellor granted a single fief read as holding a plurality: the gauge
    // lying, which is worse than no gauge. Only land counts toward land.
    const isFief = new Set(
      kingdom.territories.filter((t) => t.kind === 'fief').map((t) => t.id),
    );
    const holdings = kingdom.grants.filter(
      (g) => g.personId === lordGrant.personId && g.role === 'lord' && isFief.has(g.territoryId),
    );
    state = holdings.length > 1 ? 'plurality' : 'lorded';
    holder = people.get(lordGrant.personId) ?? null;
  } else if (appointment) {
    state = 'regency';
    holder = people.get(appointment.personId) ?? null;
  } else {
    // No record at all: by the ruling of 2026-07-17, undelegated land falls
    // to the Regent's desk as a thing that needs delegating.
    state = 'stewardship';
    holder = regent(kingdom);
  }

  const hamlets = kingdom.territories
    .filter((t) => t.kind === 'hamlet' && t.parentId === fief.id)
    .map((h) => readHamlet(kingdom, h));

  const vassals = kingdom.fealties
    .filter((f) => f.territoryId === fief.id)
    .map((f) => people.get(f.personId))
    .filter((p): p is Person => p != null);

  const garrison = kingdom.postings
    .filter((post) => post.territoryId === fief.id)
    .map((post) => people.get(post.personId))
    .filter((p): p is Person => p != null);

  return {
    territory: fief,
    state,
    holder,
    grant: lordGrant,
    appointment,
    strayGrants: kingdom.grants.filter(
      (g) => g.territoryId === fief.id && g.role === 'mayor',
    ),
    hamlets,
    vassals,
    garrison,
  };
}

export function readKingdom(kingdom: Kingdom): FiefReading[] {
  return kingdom.territories
    .filter((t) => t.kind === 'fief')
    .map((f) => readFief(kingdom, f));
}

/** The Regent's desk: every fief in stewardship (delegation debt, red),
 *  with regencies as watch items (amber) beneath. Ideal length: zero. */
export function regentsDesk(kingdom: Kingdom): {
  debt: FiefReading[];
  watch: FiefReading[];
} {
  const readings = readKingdom(kingdom);
  return {
    debt: readings.filter((r) => r.state === 'stewardship'),
    watch: readings.filter((r) => r.state === 'regency'),
  };
}

export const FIEF_STATE_LABEL: Record<FiefState, string> = {
  lorded: 'Lorded',
  plurality: 'Held in plurality',
  regency: 'In regency',
  // The stored state keeps its founding name; what a human reads names the
  // desk it actually falls to (Edwin, 2026-07-27 — the Steward is the Regent).
  stewardship: 'Falls to the Regent',
};

export const HAMLET_STATE_LABEL: Record<HamletState, string> = {
  mayored: 'Mayored',
  garrisoned: 'Garrisoned',
};
