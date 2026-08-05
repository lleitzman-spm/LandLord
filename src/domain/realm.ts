// The realm — the Regent's whole reading, remodeled (docs/WRIT-THE-LAND.md,
// Phase 3; docs/KINGDOM.md, "The realm remodeled"). The delegation debt the
// Regent drives to zero is no longer "unlorded fiefs + unseated boxes" but the
// reconciled objective: EVERY OWNER IN A KNIGHT'S CARE, EVERY CROWN OFFICE HEADED, EVERY
// BOX OF WORK ON A REAL DESK — and grow by recruiting knights.
//
// A fusion reading, like the Throne it stands beside: it folds the pods (the
// org's new allocation), the guilds (the functions), and the operator's unseated
// work into one number. Everything is a reading against the effective clock;
// nothing is stored. The old `readThrone` stands untouched for the old views —
// this is the new lens the War Table will render.
//
// TWO REALMS, AND THEY ARE NOT THE SAME WORD. The `RealmReading` below is a
// SCORE — the Regent's whole-kingdom fusion, the debt he drives to zero. It is
// not a place and never was. The `Realm` of `src/domain/tenure.ts` is a PLACE —
// a sovereign polity (a US state and its commission) that shires sit inside of
// and edicts issue from. Nothing was renamed to settle this; see that file's
// header for why, and read it before you build on either sense.

import type { EventLog } from './events';
import type { Kingdom } from './types';
import type { GuildReading } from './guilds';
import { readGuilds, unmannedGuilds } from './guilds';
import type { PodReading } from './pods';
import { emptyPods, readPods, unplacedOwners } from './pods';
import type { PatronReading } from './consequences';
import { readPatrons, retainedDoors } from './consequences';
import type { Coffers, TreasuryLedger } from './treasury';
import { readCoffers } from './treasury';
import type { EconomyBook, MoneyLog } from './economy';
import { readThrone } from './throne';

export interface RealmReading {
  // ── The pods (the org's new allocation) ───────────────────────────────────
  pods: PodReading[];
  /** Owners entrusted to the realm but in no knight's care — allocation debt. */
  unplaced: PatronReading[];
  /** Knights recruited but keeping no owner yet — the room to grow. */
  empty: PodReading[];

  // ── The guilds (the functions) ────────────────────────────────────────────
  guilds: GuildReading[];
  unmanned: GuildReading[];

  // ── The work in motion (the operator) ─────────────────────────────────────
  /** Open work on no real seat — folded by the Throne reading (unchanged). */
  unseatedWork: number;

  // ── The stakes ────────────────────────────────────────────────────────────
  patrons: PatronReading[];
  coffers: Coffers;
  crises: number;

  // ── The score the Regent drives to zero ──────────────────────────────────
  /** unplaced owners + unmanned guilds + unseated boxes. Zero = every owner in
   *  a knight's care, every Crown office headed, every box on a real desk. */
  debt: number;
  ownersTotal: number;
  ownersPlaced: number;
  knights: number;
}

/** Fold the realm reading. `seed` is the standing muster's, or null (no game →
 *  no pods/owners; the guilds and the org still read). `now` is game time under
 *  a War Game. */
export function readRealm(
  kingdom: Kingdom,
  log: EventLog,
  now: string,
  seed: string | null,
  treasury: TreasuryLedger,
  economy: EconomyBook,
  money: MoneyLog,
): RealmReading {
  const guilds = readGuilds(kingdom, log, now);
  const unmanned = unmannedGuilds(guilds);

  const pods = seed ? readPods(log, now, seed) : [];
  const unplaced = seed ? unplacedOwners(log, now, seed) : [];
  const patrons = seed ? readPatrons(log, now, seed) : [];
  const empty = emptyPods(pods);

  const t = readThrone(kingdom, log, now);
  const coffers = readCoffers(retainedDoors(patrons).length, economy, money, treasury);
  const crises = patrons.reduce((n, p) => n + p.crises, 0);

  const ownersPlaced = patrons.length - unplaced.length;

  return {
    pods,
    unplaced,
    empty,
    guilds,
    unmanned,
    unseatedWork: t.unseatedWork,
    patrons,
    coffers,
    crises,
    debt: unplaced.length + unmanned.length + t.unseatedWork,
    ownersTotal: patrons.length,
    ownersPlaced,
    knights: pods.length,
  };
}
