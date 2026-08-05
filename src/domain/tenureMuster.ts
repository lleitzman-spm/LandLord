// The muster, placed in the hierarchy — the join between the doors in PLAY and
// the tenure book (docs/WRIT-THE-WAR-TABLE.md §5; `src/domain/tenure.ts`).
//
// §5 commands that "every door row carries realm, shire-or-march, fee, and
// knight from the first migration", and the hierarchy's own `Door` does. THE
// DOORS ACTUALLY IN PLAY DO NOT. A muster's doors are `WarDoor`s — an address
// and an owner, persisted inside `chronicle.wargame.doors` — and they were left
// alone on purpose: adding a required field to a STORED record is the "a stored
// value disagrees with the code after a change" fault this codebase has shipped
// nine times, and every document already in the vault would carry the old shape.
// The estate roster (`estate.ts`) is the same story from the other side: it
// holds a slug and a human label, and nothing more.
//
// So the two books are JOINED, never merged, on the one thing both already
// hold: the stable address slug — the seam `tenure.ts` names in its header (a
// `Door.id`, an `EstateRecord.id`, a case's and a money event's `estateId`, and
// a war door's `address` are all the same string for the same door). Records in,
// readings out: nothing is written, no key is added to the Chronicle, and the
// hierarchy stays a book that can be swapped whole.
//
// WHY THIS IS A SIBLING OF `tenure.ts` AND NOT MORE OF IT. That shelf holds the
// RECORDS of the hierarchy and only the readings folded from those records
// alone — which is what lets it carry the compile-time guards without a single
// import from the rest of the kingdom. This is a reading ACROSS books, and it
// must know the war game's door shape to do its work; kept next door, a rename
// in `wargame.ts` breaks THIS file rather than the shelf the whole hierarchy
// hangs from. `realmScene.ts` beside `realm.ts` is the same split for the same
// reason.
//
// NO UI THIS PHASE (§7), as with the shelf itself.

import type { EstateBook } from './estate';
import {
  feeOf,
  realmOf,
  shireOf,
  type Door,
  type Fee,
  type Realm,
  type Shire,
  type TenureBook,
} from './tenure';
import type { WarDoor } from './wargame';

// ── What a door in play looks like ─────────────────────────────────────────

/** A door the operation actually holds, as the books that hold doors speak of
 *  it: a stable address slug, and (when the roll knows one) the owner whose
 *  book it sits in.
 *
 *  `WarDoor` satisfies this AS IT STANDS — `{ address, owner }` — so a caller
 *  hands `chronicle.wargame.doors` straight in with no adapter and no new fold
 *  (`WAR_DOOR_IS_A_MUSTERED_DOOR` below holds that fact at the type level). The
 *  estate roster keys its slug as `id` rather than `address`, so it comes
 *  through `musteredFromRoster`. */
export interface MusteredDoor {
  /** The stable address slug — a war door's `address`, an estate's `id`. */
  address: string;
  /** Who the rolls say holds it. The other axis's name for the same door: the
   *  war game's owner is the `PatronReading.name` of `consequences.ts` and the
   *  `Fee.patron` of the hierarchy. Absent is ordinary — a roster carries no
   *  owner at all. */
  owner?: string;
}

/** The estate roster as doors in play. The slug is the join key; the human
 *  label is deliberately dropped — it lives once, on the roster, and
 *  `estateLabel` is how a surface says it (a second copy would not stay true). */
export function musteredFromRoster(estates: EstateBook): MusteredDoor[] {
  return estates.map((e) => ({ address: e.id }));
}

// ── The join key ───────────────────────────────────────────────────────────

/** The key both books are joined on: the address slug, forgiving only case and
 *  spacing — and a trailing ` — <tenant>`, which lease and relay cases append
 *  to the same physical door (`doorOf` in `consequences.ts` strips it for the
 *  same reason, and the two must agree or one door counts twice).
 *
 *  It is DELIBERATELY THIN. A key that guessed — dropping punctuation, folding
 *  "unit A" onto "Apt A", reading numbers out of the string — would place doors
 *  it had no business placing, and a wrong placement is silent while an unplaced
 *  door is a finding that says its own name. When in doubt this reads UNPLACED,
 *  which is the honest answer. */
export function doorKey(address: string): string {
  return address.split(' — ')[0].trim().replace(/\s+/g, ' ').toLowerCase();
}

// ── A door, placed (or not) ────────────────────────────────────────────────

/** Why the hierarchy cannot place a door. Every one of these is a FINDING, not
 *  an error: a door in no fee is tenure debt exactly as an unlorded fief is
 *  delegation debt, and a row naming a shire nobody holds is a name that rotted
 *  — the same stringly-typed fault the shelf's resolution test guards the
 *  founding book against, caught here against the doors in play. */
export type UnplacedReason =
  /** The book holds no row for this door at all — it stands in no fee. */
  | 'no-row'
  /** Its row names a shire the book does not hold. */
  | 'shire-unheld'
  /** Its row names a fee the book does not hold. */
  | 'fee-unheld'
  /** Its row names a realm the book does not hold. */
  | 'realm-unheld';

/** What each reason is, in the kingdom's plain words — one list, so the roll-up
 *  and a door's own line never drift apart. */
export const UNPLACED_SAYS: Record<UnplacedReason, string> = {
  'no-row': 'In no fee — the book holds no row for this door.',
  'shire-unheld': 'Its row names a shire the book does not hold.',
  'fee-unheld': 'Its row names a fee the book does not hold.',
  'realm-unheld': 'Its row names a realm the book does not hold.',
};

/** One door in play, held up against the hierarchy. Whatever resolved is here
 *  even when the placement fails — a door whose fee is known and whose shire
 *  rotted should say both halves, not go blank. */
export interface DoorPlacement {
  /** The address as the muster says it — what a surface shows. */
  address: string;
  /** The key it was joined on (`doorKey`) — what a surface shows when a hand is
   *  hunting down why a door would not place. */
  key: string;
  /** The owner the roll named, when it named one. */
  owner?: string;
  /** The hierarchy's row, or null when the book holds none. */
  door: Door | null;
  realm: Realm | null;
  shire: Shire | null;
  fee: Fee | null;
  /** The knight who covers it. Null is TWO different facts here and they must
   *  not be confused: an unplaced door has no row to ask, and a placed door
   *  with a null knight stands in no knight's care — which is the allocation
   *  debt (`unattended` below), a placed door and a real finding of its own. */
  knightId: string | null;
  /** Placed when the book holds a row for it AND that row's realm, shire and
   *  fee all resolve. Nothing less counts: a row pointing at a shire nobody
   *  holds cannot answer "which shire". */
  placed: boolean;
  reason: UnplacedReason | null;
  /** Why, in plain words — empty when the door placed. */
  says: string;
  /** Whether the fee's patron and the muster's owner are the same person: true
   *  they agree, false they are at odds, NULL when either side is silent (the
   *  fee names no patron, or the roll no owner). Not a placement test — a door
   *  places on its ids — but a real finding, and the join between the two axes
   *  that `Fee.patron` exists to make. */
  patronAgrees: boolean | null;
}

// ── The roll-up ────────────────────────────────────────────────────────────

/** A count under one name — a shire, a fee, a knight, or a reason a door would
 *  not place. `name` is what a human says when the book names it, and the bare
 *  id when it does not (the `estateLabel` fallback: a reading never drops a row
 *  just because its roster line is missing). */
export interface TenureTally {
  id: string;
  name: string;
  doors: number;
}

export interface MusterTenureReading {
  /** How many doors were held up — the denominator of everything below. */
  mustered: number;
  /** Every door in play with its placement, in the muster's own order. */
  placements: DoorPlacement[];
  placed: DoorPlacement[];
  /** THE DOORS THE HIERARCHY CANNOT PLACE, each by name. The point of the whole
   *  reading: this is a state of the kingdom, not a failure of the join, and it
   *  is never swallowed, never dropped, and never counted as zero. */
  unplaced: DoorPlacement[];
  /** Placed, and in no knight's care — the allocation debt seen from the land. */
  unattended: DoorPlacement[];
  /** Placed in a fee whose patron is not the owner the roll names. Two books
   *  disagreeing about who holds a door; neither is wrong on its face. */
  atOdds: DoorPlacement[];
  byShire: TenureTally[];
  byFee: TenureTally[];
  byKnight: TenureTally[];
  unplacedByReason: TenureTally[];
  /** Addresses the BOOK holds more than one row for. The join takes the first
   *  and says so here rather than picking in silence — two rows for one door is
   *  a fault in the book, and it decides a door's shire by luck of order. */
  twiceClaimed: string[];
  /** The hierarchy narrowed to the doors ACTUALLY IN PLAY — same `TenureBook`
   *  shape, same realms, shires and fees, but its `doors` are only the placed
   *  ones, each once. This is what makes the shelf's own readings usable against
   *  a real muster: hand it to `readShireStanding`, `shiresOfFee`,
   *  `unattendedDoors` — every one of them, unchanged — and they answer about
   *  the operation instead of about the founding book. */
  book: TenureBook;
}

/** Hold a muster's doors up against the hierarchy and answer, for each: which
 *  realm, which shire, which fee, which knight — and name the ones it cannot
 *  place. Pure; nothing is written and neither book is touched.
 *
 *  `mustered` is the doors in play: `chronicle.wargame.doors` handed straight
 *  in, or `musteredFromRoster(estates)`, or both concatenated — the reading
 *  cares only that each row names an address. */
export function readMusterTenure(
  book: TenureBook,
  mustered: readonly MusteredDoor[],
): MusterTenureReading {
  // The book, indexed by the key once, so a two-hundred-door muster is a walk
  // and not a walk per door.
  const rows = new Map<string, Door[]>();
  for (const d of book.doors) {
    const k = doorKey(d.id);
    const at = rows.get(k);
    if (at) at.push(d);
    else rows.set(k, [d]);
  }
  const twiceClaimed = [...rows.entries()].filter(([, ds]) => ds.length > 1).map(([k]) => k);

  const placements: DoorPlacement[] = mustered.map((m) => {
    const key = doorKey(m.address);
    const door = rows.get(key)?.[0] ?? null;
    const realm = door ? realmOf(book, door.realmId) : null;
    const shire = door ? shireOf(book, door.shireId) : null;
    const fee = door ? feeOf(book, door.feeId) : null;

    // The first thing that fails is what is said. Checked in the order a hand
    // would ask it: is the door in the book at all, then does its place hold.
    const reason: UnplacedReason | null = !door
      ? 'no-row'
      : !shire
        ? 'shire-unheld'
        : !fee
          ? 'fee-unheld'
          : !realm
            ? 'realm-unheld'
            : null;

    const patron = fee?.patron;
    return {
      address: m.address,
      key,
      ...(m.owner ? { owner: m.owner } : {}),
      door,
      realm,
      shire,
      fee,
      knightId: door?.knightId ?? null,
      placed: reason == null,
      reason,
      says: reason ? UNPLACED_SAYS[reason] : '',
      patronAgrees: patron && m.owner ? patron === m.owner : null,
    };
  });

  const placed = placements.filter((p) => p.placed);
  const unplaced = placements.filter((p) => !p.placed);

  // Each placed door counted once under its shire, its fee and its knight. A
  // door with no knight is counted under NO knight — it is not a knight named
  // "none", it is the debt, and it stands in `unattended` where it can be read
  // as one (the `knightsOfShire` discipline, which filters the nulls out).
  const tally = (
    of: (p: DoorPlacement) => { id: string; name: string } | null,
  ): TenureTally[] => {
    const counts = new Map<string, TenureTally>();
    for (const p of placed) {
      const at = of(p);
      if (!at) continue;
      const row = counts.get(at.id);
      if (row) row.doors++;
      else counts.set(at.id, { id: at.id, name: at.name, doors: 1 });
    }
    return [...counts.values()].sort((a, b) => b.doors - a.doors || a.id.localeCompare(b.id));
  };

  const unplacedByReason = (['no-row', 'shire-unheld', 'fee-unheld', 'realm-unheld'] as const)
    .map((r) => ({
      id: r,
      name: UNPLACED_SAYS[r],
      doors: unplaced.filter((p) => p.reason === r).length,
    }))
    .filter((t) => t.doors > 0)
    .sort((a, b) => b.doors - a.doors || a.id.localeCompare(b.id));

  // The narrowed book: the same hierarchy, carrying only the doors in play.
  // Deduped by row, so a muster that names one door twice cannot double it.
  const inPlay = new Map<string, Door>();
  for (const p of placed) if (p.door) inPlay.set(p.door.id, p.door);

  return {
    mustered: placements.length,
    placements,
    placed,
    unplaced,
    unattended: placed.filter((p) => p.knightId == null),
    atOdds: placed.filter((p) => p.patronAgrees === false),
    byShire: tally((p) => (p.shire ? { id: p.shire.id, name: p.shire.name } : null)),
    byFee: tally((p) => (p.fee ? { id: p.fee.id, name: p.fee.name } : null)),
    byKnight: tally((p) => (p.knightId ? { id: p.knightId, name: p.knightId } : null)),
    unplacedByReason,
    twiceClaimed,
    book: { ...book, doors: [...inPlay.values()] },
  };
}

/** The share of the muster the hierarchy could place, 0..1 — the one number
 *  that says how far the book reaches over the doors in play. An empty muster
 *  reads 0: nothing was placed, because nothing was held up. */
export function placedShare(reading: MusterTenureReading): number {
  return reading.mustered === 0 ? 0 : reading.placed.length / reading.mustered;
}

/** The unplaced doors' addresses, in the muster's order — for a line of prose
 *  or a plain list. The full placements carry the reasons. */
export function unplacedAddresses(reading: MusterTenureReading): string[] {
  return reading.unplaced.map((p) => p.address);
}

// ── The guards the compiler holds ──────────────────────────────────────────
// The shelf next door holds two (`FEE_HAS_NO_GEOMETRY`, `SHIRE_STORES_NO_STANDING`).
// This file's own load-bearing fact needs a third, for the same reason: it is a
// fact a future hand would break in one line while meaning well.

type Assert<T extends true> = T;

/** A war door is a mustered door as it stands — so `chronicle.wargame.doors`
 *  goes straight into `readMusterTenure` with no adapter. Rename `address` on
 *  `WarDoor` and this line stops compiling, at the seam, rather than the join
 *  silently placing nothing. */
export type WAR_DOOR_IS_A_MUSTERED_DOOR = Assert<
  WarDoor extends MusteredDoor ? true : false
>;

/** THE DOOR IN PLAY CARRIES NO TENURE OF ITS OWN, and the join is the only way
 *  to ask where it stands. `WarDoor` is PERSISTED inside `chronicle.wargame.doors`;
 *  the obvious "improvement" — hang `shireId` on it and read the field directly —
 *  is a migration on every stored document, and every muster already in a vault
 *  would answer `undefined` while the code swore the field was required. That is
 *  the fault this codebase has shipped nine times.
 *
 *  So: add any hierarchy key to `WarDoor` and this line stops compiling. It is
 *  not a ban on the idea — it is a demand that the idea arrive with a migration
 *  and a conversation, instead of arriving in one line on a Tuesday. */
export type WAR_DOOR_CARRIES_NO_TENURE = Assert<
  Extract<
    keyof WarDoor,
    'realmId' | 'shireId' | 'feeId' | 'knightId' | 'realm' | 'shire' | 'fee' | 'knight' | 'tenure'
  > extends never
    ? true
    : false
>;
