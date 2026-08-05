// THE CROWN OFFICES — the household's own crafts (docs/WRIT-THE-BROKERAGE.md,
// ratified 2026-07-27; docs/KINGDOM.md, "Territories", amended 2026-07-29).
//
// There are three: the Office of Works, the Office of Tenancy, and the
// Chancery, each headed by a CHANCELLOR. They are seated in the palace and
// they are NEVER LAND — an office has no geometry, never appears on the map,
// cannot be folded into a fief or raised to one, and no outside artisan may
// keep it. A Chancellor's seat is a lord-role grant on an office.
//
// **The word GUILD now means an OUTSIDE TRADE** — the roofers, the lenders,
// outside counsel — and those are not these. The Crown neither staffs a guild
// nor "mans" one. The TYPES below still read `Guild`/`GuildReading`/
// `FOUNDING_GUILDS`, deliberately: the rename is in progress and the names are
// load-bearing across the pinned map contract, whose twin assertion fails the
// build when either side drifts. The PROSE is not deliberate and was simply
// stale — this header described the retired departments-as-guilds model as
// current law for eight days after the code beneath it was refounded.
//
// A factory component and reading-first, as the constitution commands: this is
// a pure re-reading over the census records and the event log — nothing new is
// stored. a firm's real craft set loads at the data gate; the founding three
// below are the working-fluid alphabet until it does.

import type { CaseReading, EventLog } from './events';
import { ageInDays, queues } from './events';
import type { Kingdom, Person } from './types';

export interface Guild {
  id: string;
  name: string;
  /** The census OFFICE this craft is seated in, when one exists — the
   *  Chancellor is read from its holder. Absent → a craft with no founding
   *  seat: headless until a setting seats it. */
  territoryId?: string;
}

// The founding alphabet — the three Crown offices, each seated in the founding
// census's own office territory, so their Chancellors are read straight off the
// grants. Working fluid until a firm's own set loads at the gate.
export const FOUNDING_GUILDS: Guild[] = [
  // The three CROWN OFFICES (WRIT-THE-BROKERAGE, 2026-07-27). These are the
  // household's own crafts, seated in the palace — the thing this book has
  // always actually modelled, whatever it was called. Property Management is
  // gone from the list because it IS the three, and Legal folds into the
  // Chancery; Technology and Investor Relations were never crafts of property
  // management at all.
  //
  // The word GUILD now means an outside trade — the roofers, the lenders — and
  // those are not these. This book is being renamed to the offices it holds;
  // until every reading follows, the type keeps its old name.
  { id: 'works', name: 'The Office of Works', territoryId: 'office-works' },
  { id: 'tenancy', name: 'The Office of Tenancy', territoryId: 'office-tenancy' },
  { id: 'chancery', name: 'The Chancery', territoryId: 'office-chancery' },
];

// Which guild a work-holder's hand belongs to — the flow-step holders and the
// unowned queues mapped to the function that does that work. Working fluid; a
// setting's role→seat map (data/library/pm-setting.json) supersedes it at the
// gate. A holder the map does not know contributes to no guild's load (it still
// reads on the Throne's queues) — the reading tolerates the gap.
export const SEAT_GUILD: Record<string, string> = {
  // Every desk now serves one of the three offices. The manager's desk answers
  // to Tenancy (it is where a tenancy is actually run), the vendors' desk and
  // the maintenance hands to Works, and the accounting queue and the law to the
  // Chancery.
  'pm-desk': 'tenancy',
  alys: 'chancery',
  osric: 'tenancy',
  mabel: 'works',
  'va-desk': 'works',
  mason: 'works',
  'lp-queue': 'chancery',
  marlowe: 'chancery',
  'carver': 'chancery',
  // The reasoning clerks' seats, each under the craft it serves (names in
  // caselabel.ts SEAT_LABEL): the make-ready yard turns doors, the reckoning
  // desk squares deposits, the residents' parley answers the folk, and the
  // envoy's desk courts new owners.
  'turn-desk': 'works', // the make-ready yard turns doors
  'acct-desk': 'chancery', // the reckoning desk squares deposits
  'res-desk': 'tenancy', // the residents' parley answers the folk
  'bd-desk': 'tenancy', // the envoy's desk courts new owners
  'col-desk': 'chancery', // collections is an accounts-receivable craft
  'viol-desk': 'chancery', // lease and HOA compliance is law
};

/** The guild a work-holder serves, or null when the map does not know it. */
export function seatGuild(holder: string | null | undefined): string | null {
  if (!holder) return null;
  return SEAT_GUILD[holder] ?? null;
}

/** The seat a craft's head is read from. The three Crown offices each name
 *  their own place in the palace; a craft that names none takes the place
 *  bearing its NAME, which is how one gets founded for it — found it, grant it,
 *  and the craft is headed. Without this fallback a craft with no seat could
 *  never be filled at all: the panel offered to seat a master and had nothing to
 *  grant (Edwin, 2026-07-27). */
export function keepOf(kingdom: Kingdom, guild: Guild): string | null {
  // The declared seat only counts if it actually STANDS in this census. It used
  // to be returned unconditionally — so on a vault taken before the Brokerage
  // refounding (which has no `office-*` territory at all) every craft named a
  // seat that did not exist. Nothing could ever be read back from it: the
  // master fold found no grant on a phantom id, and the panel, finding no
  // territory, offered to FOUND one — and founded another phantom every time it
  // was pressed. Edwin, testing 2026-07-27: *"when I try to seat a master over
  // any of the offices it seems to go through but then it's still empty."* A
  // declared id that names nothing must read as NOTHING, so the fallback below
  // can do its job.
  if (guild.territoryId && kingdom.territories.some((t) => t.id === guild.territoryId)) {
    return guild.territoryId;
  }
  const named = kingdom.territories.find(
    (t) => t.name.trim().toLowerCase() === guild.name.trim().toLowerCase(),
  );
  return named?.id ?? null;
}

/** The holder of a census territory — a CROWN OFFICE's Chancellor is read from
 *  here: a lord-role grant, else a keeper's appointment, else no one (headless).
 *  Pure over the assembled kingdom's records.
 *
 *  A MAYOR grant no longer counts. Mayor is the line of TRADE — the hamlet role
 *  from the department era, when Mabel was "mayor of Maintenance" — and a
 *  Chancellor's seat is a lord-role grant on an office, full stop. While both
 *  counted here, this reading and `readCourtTree`'s office fold (which has only
 *  ever read `role === 'lord'`) could disagree about whether the same office
 *  was headed, which is the lying-instrument fault twice over. */
function masterOf(kingdom: Kingdom, territoryId: string | undefined | null): Person | null {
  if (!territoryId) return null;
  const grant = kingdom.grants.find((g) => g.territoryId === territoryId && g.role === 'lord');
  if (grant) return kingdom.people.find((p) => p.id === grant.personId) ?? null;
  const appt = kingdom.appointments.find((a) => a.territoryId === territoryId);
  if (appt) return kingdom.people.find((p) => p.id === appt.personId) ?? null;
  return null;
}

export interface GuildReading {
  guild: Guild;
  /** The territory this guild's master is read from, once one exists — the
   *  declared keep, or the one founded under the guild's own name. */
  keepId: string | null;
  /** The person who masters this function, or null — unmanned is debt. */
  master: Person | null;
  manned: boolean;
  /** Open work resting on a hand of this guild, folded from the log. */
  cases: CaseReading[];
  oldestDays: number;
  stuck: number;
}

/** The guilds folded from the census (their masters) and the event log (their
 *  work). `now` injected; aging measured against it (game time under a War
 *  Game). Reading-first: nothing stored, the department-fiefs untouched. */
export function readGuilds(
  kingdom: Kingdom,
  log: EventLog,
  now: string,
  guilds: Guild[] = FOUNDING_GUILDS,
  agedDays = 7,
): GuildReading[] {
  // Open cases grouped by the guild their holder serves.
  const byGuild = new Map<string, CaseReading[]>();
  for (const q of queues(log)) {
    const gid = seatGuild(q.holder);
    if (!gid) continue;
    const arr = byGuild.get(gid);
    if (arr) arr.push(...q.cases);
    else byGuild.set(gid, [...q.cases]);
  }
  return guilds.map((guild) => {
    const keepId = keepOf(kingdom, guild);
    const master = masterOf(kingdom, keepId);
    const cases = byGuild.get(guild.id) ?? [];
    const ages = cases.map((c) => ageInDays(c, now) ?? 0);
    return {
      guild,
      keepId,
      master,
      manned: master != null,
      cases,
      oldestDays: ages.length ? Math.max(...ages) : 0,
      stuck: ages.filter((d) => d >= agedDays).length,
    };
  });
}

/** The functions standing with no master — the org's delegation debt on the
 *  guild side (an unmanned function is an unlorded fief re-read). */
export function unmannedGuilds(readings: GuildReading[]): GuildReading[] {
  return readings.filter((g) => !g.manned);
}
