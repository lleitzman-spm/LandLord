// The court tree — the realm's SHAPE, folded from the census and the acts
// (docs/WRIT-THE-BROKERAGE.md, "The CENSUS, rebuilt"). Edwin: *"move away from
// it feeling just like a website scrolling list"*, with *"clear sections for the
// different types of subjects, that also allows for subject management."*
//
// So this is not a roster. It is who answers to whom, drawn:
//
//   The Crown  (King · the Regent in his name)
//        │
//   the Offices  — the household's own crafts, seated in the palace, never land
//        │
//   the Lords  — a fief's lord: the team lead, an agent
//        │
//   the Knights  — agents, pledged to a fief
//        │
//   the Squires  — pledged to a KNIGHT personally, seated in that knight's fief
//
//   the Guilds  — the outside trades; the Artisans are their hands
//
// Records in, readings out (law: state is never stored). Every field below is
// computed fresh from `Kingdom` — the same records `readKingdom` folds, read as
// a hierarchy instead of a map. Nothing new is written to found this view.

import type { FiefState, GarrisonPosting, Grant, Fealty, Kingdom, Person, Territory } from './types';
import type { HamletReading } from './states';
import { readFief, king, regent, squiresOf } from './states';

// ── The Crown offices ───────────────────────────────────────────────────────

export interface OfficeReading {
  /** The office's record. Always `kind: 'office'` — never land, never on the map. */
  territory: Territory;
  /** Its head, by grant. Absent = a headless craft: the Crown owes a decision. */
  chancellor: Person | null;
  /** The grant that seats the Chancellor — the record a revocation strikes. */
  grant: Grant | null;
  /** The office's own hands: everyone sworn to it, the Chancellor aside. */
  hands: { person: Person; fealty: Fealty }[];
  /** Artisans stationed in the office — outside hands working an inside craft.
   *  The POSTING rides along: a record shown with no way to strike it is the
   *  very fault this view was built to end, and these rows were the last ones
   *  in it still breaking that law. (Audit, 2026-07-27.) */
  garrison: { person: Person; posting: GarrisonPosting }[];
}

// ── The land, and the line of answer through it ─────────────────────────────

export interface KnightReading {
  person: Person;
  /** The fealty that seats this knight in the fief. */
  fealty: Fealty;
  /** Squires pledged to this knight personally — they travel with them. */
  squires: Person[];
}

export interface FiefCourtReading {
  territory: Territory;
  state: FiefState;
  /** The fief's lord — the team lead. Only an agent may hold land. */
  lord: Person | null;
  grant: Grant | null;
  /** A keeper standing in for an absent lord (regency). */
  keeper: Person | null;
  knights: KnightReading[];
  hamlets: HamletReading[];
  /** Artisans working this land. They may keep it; they can never hold it.
   *  Carries its posting, so the station can be ended where it is shown. */
  garrison: { person: Person; posting: GarrisonPosting }[];
}

// ── The outside trades ──────────────────────────────────────────────────────

/** A guild is NOT a record yet — the writ names the guilds and deliberately
 *  leaves them unmodelled ("What a guild's own record carries … guilds are named
 *  here but not yet modelled"). Until one exists, an artisan's own note names
 *  their trade ("The roofers' guild"), and the guilds are FOLDED from those
 *  names. That is a reading over existing records, not a second roster — when a
 *  guild record lands, this fold is replaced and nothing has to be migrated. */
export interface TradeReading {
  /** Lower-cased fold key ("roofers' guild"). */
  id: string;
  /** What a human reads ("The roofers' guild"). */
  name: string;
  artisans: Person[];
}

export interface CourtTree {
  king: Person | null;
  regent: Person | null;
  /** Squires pledged to the Crown itself rather than to a knight — agents in
   *  training with no fief to stand in yet. They travel with the Crown, so they
   *  are drawn at the head of the court, not listed as adrift. */
  wards: Person[];
  offices: OfficeReading[];
  fiefs: FiefCourtReading[];
  /** Agents — vassals and squires — standing in no office and no fief. Not an
   *  error: an enrolled subject with nowhere to stand is delegation debt in
   *  person form, and it must be VISIBLE to be fixable. */
  unseated: Person[];
  trades: TradeReading[];
  /** Artisans whose note names no trade. */
  unaffiliated: Person[];
}

// ── Folding a trade out of an artisan's note ────────────────────────────────

// "Outside counsel — the lawyers' guild." → "lawyers' guild"
// Up to two words before "guild", so "the roofers' guild" and "the foundation
// guild" both land, and a long sentence does not drag its whole clause in.
const TRADE = /\b(?:the\s+)?([\p{L}\p{N}'’-]+(?:\s+[\p{L}\p{N}'’-]+)?\s+guild)\b/iu;

/** The trade an artisan's note names, or null. The typographer's apostrophe and
 *  the typist's are the same trade to a reader, so the fold key settles on one —
 *  a fold that split them would invent a guild nobody founded. */
export function tradeOf(person: Person): { id: string; name: string } | null {
  const m = person.note?.match(TRADE);
  if (!m) return null;
  const id = m[1].toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
  if (!id) return null;
  return { id, name: `The ${id}` };
}

// ── The fold ────────────────────────────────────────────────────────────────

export function readCourtTree(kingdom: Kingdom): CourtTree {
  const people = new Map(kingdom.people.map((p) => [p.id, p]));
  const person = (id: string): Person | null => people.get(id) ?? null;

  // Every office, its head, and its hands.
  const offices: OfficeReading[] = kingdom.territories
    .filter((t) => t.kind === 'office')
    .map((territory) => {
      const grant =
        kingdom.grants.find((g) => g.territoryId === territory.id && g.role === 'lord') ?? null;
      const chancellor = grant ? person(grant.personId) : null;
      const hands = kingdom.fealties
        .filter((f) => f.territoryId === territory.id && f.personId !== grant?.personId)
        .map((fealty) => ({ person: person(fealty.personId), fealty }))
        .filter((h): h is { person: Person; fealty: Fealty } => h.person != null);
      const garrison = kingdom.postings
        .filter((p) => p.territoryId === territory.id)
        .map((posting) => ({ person: person(posting.personId), posting }))
        .filter((g): g is { person: Person; posting: GarrisonPosting } => g.person != null);
      return { territory, chancellor, grant, hands, garrison };
    });

  // Every fief, its lord, its knights, and each knight's squires beneath them.
  // `readFief` already folds the state, the holder and the hamlets — this reads
  // its vassals as KNIGHTS and hangs each one's squires under them, which is the
  // line of answer the writ draws.
  const fiefs: FiefCourtReading[] = kingdom.territories
    .filter((t) => t.kind === 'fief')
    .map((territory) => {
      const r = readFief(kingdom, territory);
      const knights: KnightReading[] = kingdom.fealties
        .filter((f) => f.territoryId === territory.id)
        .map((fealty) => ({ person: person(fealty.personId), fealty }))
        .filter((k): k is { person: Person; fealty: Fealty } => k.person != null)
        .map(({ person: p, fealty }) => ({
          person: p,
          fealty,
          squires: squiresOf(kingdom, p.id),
        }));
      return {
        territory,
        state: r.state,
        // A fief in stewardship falls to the Regent's desk — `readFief` names
        // the Regent its holder, but the Regent is not its LORD, and this view
        // must not draw a lord where no grant stands.
        lord: r.grant ? r.holder : null,
        grant: r.grant,
        keeper: r.state === 'regency' ? r.holder : null,
        knights,
        hamlets: r.hamlets,
        garrison: kingdom.postings
          .filter((p) => p.territoryId === territory.id)
          .map((posting) => ({ person: person(posting.personId), posting }))
          .filter((g): g is { person: Person; posting: GarrisonPosting } => g.person != null),
      };
    });

  // The outside trades, folded from their hands' own notes.
  const byTrade = new Map<string, TradeReading>();
  const unaffiliated: Person[] = [];
  for (const p of kingdom.people) {
    if (p.pledge !== 'sellsword') continue;
    const trade = tradeOf(p);
    if (!trade) {
      unaffiliated.push(p);
      continue;
    }
    const seen = byTrade.get(trade.id);
    if (seen) seen.artisans.push(p);
    else byTrade.set(trade.id, { ...trade, artisans: [p] });
  }
  const trades = [...byTrade.values()].sort((a, b) => a.name.localeCompare(b.name));

  // Agents standing nowhere. The Crown itself is never unseated (the King holds
  // the kingdom; the Regent holds everything undelegated), and a squire seated
  // through their knight stands where that knight stands.
  const theKing = king(kingdom);
  const theRegent = regent(kingdom);
  const seated = new Set<string>();
  if (theKing) seated.add(theKing.id);
  if (theRegent) seated.add(theRegent.id);
  const wards = kingdom.people.filter(
    (p) =>
      p.pledge === 'squire' &&
      p.pledgedTo != null &&
      (p.pledgedTo === theKing?.id || p.pledgedTo === theRegent?.id),
  );
  for (const o of offices) {
    if (o.chancellor) seated.add(o.chancellor.id);
    for (const h of o.hands) seated.add(h.person.id);
    for (const g of o.garrison) seated.add(g.person.id);
  }
  for (const f of fiefs) {
    if (f.lord) seated.add(f.lord.id);
    if (f.keeper) seated.add(f.keeper.id);
    for (const k of f.knights) {
      seated.add(k.person.id);
      for (const s of k.squires) seated.add(s.id);
    }
    for (const g of f.garrison) seated.add(g.person.id);
    for (const h of f.hamlets) {
      if (h.mayor) seated.add(h.mayor.id);
      for (const g of h.garrison) seated.add(g.id);
    }
  }
  const unseated = kingdom.people.filter(
    (p) =>
      (p.pledge === 'vassal' || p.pledge === 'squire') &&
      !seated.has(p.id) &&
      // A squire pledged to someone who IS seated travels with them — they are
      // drawn under their knight, not listed as adrift.
      !(p.pledge === 'squire' && p.pledgedTo && seated.has(p.pledgedTo)),
  );

  return {
    king: theKing,
    regent: theRegent,
    wards,
    offices,
    fiefs,
    unseated,
    trades,
    unaffiliated,
  };
}
