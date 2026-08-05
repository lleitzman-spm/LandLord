// The chronicle: every mutable record book of the kingdom in one volume —
// the Marches ledger, the Treasury rolls, the book of acts (grants,
// appointments, postings, fealty), and the census book (people and
// territories). The last two adopt their founding state from census.ts
// the first time a chronicle without them is opened; from then on the
// chronicle is the only truth. One volume, one persistence story: the
// vault when a key is present, a file in the private repo otherwise —
// the domain never notices.

import type { Catalog } from './catalog';
import { FOUNDING_CATALOG, catalogAtFounding } from './catalog';
import type { ActsBook, CensusBook } from './court';
import {
  FOUNDING_ACTS,
  FOUNDING_CENSUS,
  actsAtFounding,
  censusAtFounding,
} from './court';
import type { EventLog } from './events';
import { EMPTY_LOG } from './events';
import type { FlowBook } from './flows';
import { FOUNDING_FLOWS, flowsAtFounding } from './flows';
import type { MarchesLedger } from './marches';
import { EMPTY_LEDGER } from './marches';
import type { TreasuryLedger } from './treasury';
import { EMPTY_TREASURY } from './treasury';
import type { EconomyBook, MoneyLog } from './economy';
import { FOUNDING_ECONOMY, economyAtFounding } from './economy';
import type { EconomySettingPatch } from './economySetting';
import { applyEconomySetting } from './economySetting';
import type { EstateBook } from './estate';
import { FOUNDING_ESTATES, estatesAtFounding } from './estate';
import type { WarState } from './wargame';

export interface Chronicle {
  marches: MarchesLedger;
  treasury: TreasuryLedger;
  acts: ActsBook;
  census: CensusBook;
  /** The living instrument's spine: the append-only event log. Every reading
   *  of the real work folds from here (docs/KINGDOM.md, "Events-only"). */
  events: EventLog;
  /** The task-type ontology events reference — a loadable book. LandLord holds
   *  the mechanism; a factory setting loads the rows (docs/KINGDOM.md, "The
   *  synergy brief: the catalog is the event taxonomy"). */
  catalog: Catalog;
  /** The flow templates — cascades expressed from loaded config, never
   *  hardwired (docs/WRIT-FLOW-ENGINE.md). A book like any other: a setting's
   *  real relays load through the same gate as its catalog rows. */
  flows: FlowBook;
  /** The economy's static book — the two-book chart of accounts and the fee
   *  rules (docs/WRIT-ECONOMY.md). Loadable like the catalog: LandLord holds a
   *  working-fluid founding chart; a setting loads a firm's real one at the gate. */
  economy: EconomyBook;
  /** The estate roster (docs on `estate.ts`): the loadable book of real
   *  properties — the stable identity per-estate spend caps and fee rules key
   *  on. Founding is EMPTY (the synthetic muster keys on inline door addresses);
   *  the real roster loads attended, like the catalog. A case's / money event's
   *  `estateId` is a slug into this book. */
  estates: EstateBook;
  /** The gate (docs on `economySetting.ts`): an OPTIONAL patch that overrides
   *  the founding economy's gate-able fields — the mechanism a firm's real fee
   *  rates/caps/GL-codes load through, attended, at the data gate. Absent
   *  (the default) ⇒ `economy` reads exactly as founded. Records-in: this is
   *  the record; `economyOf` below is the reading. Never a place a real
   *  figure lives — see `economySetting.ts`'s header. */
  economySetting?: EconomySettingPatch;
  /** The money-dimension: an append-only stream of what cost or earned. Balanced
   *  double-entry postings FOLD from these events (never stored) — records-in,
   *  readings-out applied to coin (docs/KINGDOM.md, "The economy"). */
  money: MoneyLog;
  /** The War Game's banner: which seed is deployed and where the simulated
   *  clock stands (docs/WRIT-WAR-GAME.md). The game itself is events — this
   *  small marker is only the clock and the muster's name; Reset strikes it
   *  and the game's events together. */
  wargame: WarState | null;
}

export const FOUNDING_CHRONICLE: Chronicle = {
  marches: EMPTY_LEDGER,
  treasury: EMPTY_TREASURY,
  acts: FOUNDING_ACTS,
  census: FOUNDING_CENSUS,
  events: EMPTY_LOG,
  catalog: FOUNDING_CATALOG,
  flows: FOUNDING_FLOWS,
  economy: FOUNDING_ECONOMY,
  estates: FOUNDING_ESTATES,
  money: [],
  wargame: null,
};

/** Tolerant parse: missing books — and missing shelves within a book —
 *  adopt their founding state. This is the migration that moves census
 *  records from code into the chronicle, one shelf at a time as features
 *  arrive; a shelf that is present, even empty, is the truth as struck. */
export function normalizeChronicle(raw: unknown): Chronicle {
  const c = (raw ?? {}) as Partial<Chronicle>;
  return {
    marches: {
      arrivals: c.marches?.arrivals ?? [],
      dispatches: c.marches?.dispatches ?? [],
      turnaways: c.marches?.turnaways ?? [],
    },
    treasury: {
      upkeeps: c.treasury?.upkeeps ?? [],
    },
    acts: {
      grants: c.acts?.grants ?? FOUNDING_ACTS.grants,
      appointments: c.acts?.appointments ?? FOUNDING_ACTS.appointments,
      postings: c.acts?.postings ?? FOUNDING_ACTS.postings,
      fealties: c.acts?.fealties ?? FOUNDING_ACTS.fealties,
    },
    census: {
      people: c.census?.people ?? FOUNDING_CENSUS.people,
      territories: c.census?.territories ?? FOUNDING_CENSUS.territories,
    },
    // A chronicle predating the event log adopts an empty one — the same
    // shelf-by-shelf migration every book here has followed.
    events: c.events ?? [],
    // A chronicle with no catalog shelf adopts the founding rows (the census
    // migration pattern); a shelf present, even empty, is the truth as loaded.
    catalog: c.catalog ?? FOUNDING_CATALOG,
    // A chronicle with no flows shelf adopts the founding templates — the same
    // shelf-by-shelf migration; a shelf present, even empty, is the truth.
    flows: c.flows ?? FOUNDING_FLOWS,
    // The economy book adopts the founding working-fluid chart when absent (the
    // catalog/flows migration pattern); the money stream adopts empty. The raw
    // record is carried as-is — UNPATCHED — so `economy` always names the
    // founding/loaded chart itself; `economySetting` rides alongside it as its
    // own record, and `economyOf` (below) is where the two are read together.
    economy: c.economy ?? FOUNDING_ECONOMY,
    economySetting: c.economySetting,
    // The estate roster adopts the founding empty book when absent (the same
    // shelf-by-shelf migration); a shelf present, even empty, is the truth.
    estates: c.estates ?? FOUNDING_ESTATES,
    money: c.money ?? [],
    // No war banner flies at the founding; a chronicle predating the War
    // Games adopts none.
    wargame: c.wargame ?? null,
  };
}

/** True when nothing has been recorded since the founding — the state a
 *  brand-new chronicle opens in. Such a volume must never overwrite one
 *  that carries real records. */
export function isFoundingChronicle(c: Chronicle): boolean {
  return (
    c.marches.arrivals.length === 0 &&
    c.marches.dispatches.length === 0 &&
    c.marches.turnaways.length === 0 &&
    c.treasury.upkeeps.length === 0 &&
    c.events.length === 0 &&
    c.money.length === 0 &&
    actsAtFounding(c.acts) &&
    censusAtFounding(c.census) &&
    catalogAtFounding(c.catalog) &&
    flowsAtFounding(c.flows) &&
    economyAtFounding(c.economy) &&
    c.economySetting == null &&
    estatesAtFounding(c.estates) &&
    c.wargame == null
  );
}

/** THE read seam for the economy the kingdom actually governs by: the founding
 *  (or loaded) chart with its gate patch folded in, GATED — no `economySetting`
 *  ⇒ `chronicle.economy` unchanged, exactly as every reading has always seen
 *  it. Every reading of the economy (fees, spend caps, the postings catalog,
 *  the solvency/compliance folds) should call this rather than reaching for
 *  `chronicle.economy` directly, so a setting takes effect everywhere at once.
 *  (`src/store/chronicleStore.ts` still reads `chronicle.economy` in a few
 *  places — see HANDOFF/the A2 report for the follow-up to route those
 *  through here; out of this shot's owned surface.) */
export function economyOf(c: Chronicle): EconomyBook {
  return applyEconomySetting(c.economy, c.economySetting);
}
