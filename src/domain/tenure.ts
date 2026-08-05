// The tenure hierarchy — where a door sits and under whose law
// (docs/WRIT-THE-WAR-TABLE.md §5, and the ANSWERED section at its foot).
//
// The book already had one axis: WHO HOLDS WHAT WORK — the offices, the fiefs,
// the knights, the pods, the patrons. This is the other axis, and it answers a
// different question: WHERE A DOOR STANDS AND WHOSE LAW REACHES IT. The two are
// orthogonal, which is why they compose without a fight; they meet at exactly
// two points and at both they already agree — the KNIGHT here is the knight of
// `pods.ts` (a person with a book of business), and the DOOR here is the door
// every other reading already speaks of, keyed by the same stable address slug
// that `estateId` and `EstateRecord.id` use.
//
//   Realm   — a sovereign polity (a US state; its sovereign is the commission
//             that grants the right to practise). Aldermarch / the Estates Commission.
//   Shire   — a metro. `shire` (settled) or `march` (frontier) is a STANDING,
//             and a standing is READ, never stored.
//   Fee     — an owner group. NOT A PLACE (see below).
//   Knight  — the vassal who covers a door. Already modelled; not re-declared.
//   Door    — the asset.
//
// Records in, readings out, the whole way down: the only stored things on this
// shelf are the five record shapes below and the ids that join them. Every
// judgment — a shire's standing, an edict's lateness, how far a fee scatters —
// is folded fresh from those records, so nothing here can go stale and disagree
// with the board.
//
// NO UI THIS PHASE (§7). The hierarchy earns its keep as a data model long
// before it earns its keep as three screens.

import type { GuildReading } from './guilds';

// ── The realm ──────────────────────────────────────────────────────────────

/** A SOVEREIGN POLITY — a US state, and the body that grants the right to
 *  practise within it (the Estates Commission in Aldermarch). The mapping is not flavour: the state
 *  grants a licence as a crown grants a patent, an agent cannot hold that right
 *  freestanding but must hang it with a sponsoring broker, and the broker
 *  answers to the commission. That is vassalage in the strict sense, three
 *  tiers deep; reciprocity between states is a treaty.
 *
 *  **This is NOT `RealmReading` (`src/domain/realm.ts`), and a reader who
 *  confuses the two will build the wrong thing.** They are different words that
 *  happen to share five letters:
 *
 *   · `Realm` (here) is a PLACE — a polity, with a name and a sovereign, that
 *     shires sit inside of and edicts issue from. A record.
 *   · `RealmReading` (`realm.ts`) is a SCORE — the Regent's whole-kingdom fusion
 *     of pods, crafts, unseated work and coffers: the delegation debt he drives
 *     to zero. It is not a place and never was. A reading.
 *
 *  Nothing was renamed to settle this, deliberately: the two names already
 *  differ, and `marches` next door is a PERSISTED key on the Chronicle whose
 *  rename would be a migration on every stored vault. The collision is a
 *  reader's problem, not the compiler's, and this comment is the answer to it. */
export interface Realm {
  id: string;
  /** As a human says it — "Aldermarch". */
  name: string;
  /** The body whose word is law here — the regulator, in its own name. */
  sovereign: string;
}

// ── The shire ──────────────────────────────────────────────────────────────

/** A METRO. Note what is NOT on this record: its standing. A shire holds only
 *  its name and the realm it lies in; whether it is a settled SHIRE or a
 *  frontier MARCH is folded from the doors and the household by
 *  `readShireStanding`, every time it is asked.
 *
 *  The writ called it "one status field", and a field is what everyone reaches
 *  for. A field is also what goes stale: a metro crosses twenty-five doors and
 *  the field still says `march` until some write remembers to move it, and then
 *  a stored value disagrees with the records — the exact fault this codebase
 *  has shipped nine times. A reading cannot disagree with the records, because
 *  it IS the records. */
export interface Shire {
  id: string;
  realmId: string;
  name: string;
}

// ── The fee ────────────────────────────────────────────────────────────────
// A fee is an owner group, and an owner group IS NOT A PLACE.
//
// Owner groups are scattered across a metro and only incidentally clustered —
// a fee with doors in three separate shires is ordinary, not an error. This is
// historically right as well as operationally right: a medieval manor held by
// one lord was routinely non-contiguous, interleaved with other lords' holdings
// in the same village. Contiguous land with hard borders is the modern
// nation-state, not the feudal one.
//
// So `Fee` carries NO GEOMETRY — no bounds, no centroid, no polygon, no
// coordinate of any kind — and the type is where that is ENFORCED rather than
// merely hoped for. The writ's §10.7 names "assuming geographic separation
// between fees" as a standing failure mode of this project; the moment a fee
// can hold a centroid, some future renderer will draw a border around it and
// tell a confident lie about the operation. `FEE_HAS_NO_GEOMETRY` below fails
// the build instead.

/** The words a place would be described with. A fee may bear none of them.
 *  One list, guarding both the compiler (below) and the test. */
export const GEOMETRY_WORDS = [
  'bounds',
  'bbox',
  'polygon',
  'centroid',
  'center',
  'centre',
  'geometry',
  'shape',
  'outline',
  'border',
  'borders',
  'extent',
  'area',
  'radius',
  'coords',
  'coordinates',
  'point',
  'position',
  'lat',
  'latitude',
  'lng',
  'lon',
  'longitude',
  'x',
  'y',
  'z',
] as const;

type GeometryWord = (typeof GEOMETRY_WORDS)[number];

/** A fee — an OWNER GROUP, and never a territory. It names itself, the realm
 *  whose law it answers to, and (when the group is one patron's book) the
 *  patron the rolls know it by. Where its doors stand is a question for the
 *  DOORS, which carry their own shire; ask `shiresOfFee` and expect several. */
export interface Fee {
  id: string;
  realmId: string;
  name: string;
  /** The Patron's name as the war rolls speak it (`PatronReading.name`), when
   *  this fee is one owner's book. The join between the two axes: the fee is
   *  where the owner's doors are gathered, the patron is whose faith answers
   *  for them. */
  patron?: string;
}

// ── The door ───────────────────────────────────────────────────────────────

/** A DOOR, placed in the hierarchy. It carries `realmId`, `shireId`, `feeId`
 *  and `knightId` from the first migration — cheap today and expensive to
 *  retrofit (§5), so all four ride from the start even though only the shire
 *  is read yet.
 *
 *  `id` is the stable door slug every other book already keys on — a case's and
 *  a money event's `estateId`, `EstateRecord.id`, the address a war door bears.
 *  The human address deliberately does NOT live here: it lives once, on the
 *  estate roster (`estateLabel`). A second copy of an address is a second thing
 *  to keep true, and it would not stay true. */
export interface Door {
  id: string;
  realmId: string;
  shireId: string;
  feeId: string;
  /** The knight who covers this door, or NULL for a door in no knight's care.
   *  Null is a real state and the realm's central debt — the same fact
   *  `unplacedOwners` folds on the other axis — not a missing field. A door
   *  with no knight must be expressible or the model cannot say what is wrong. */
  knightId: string | null;
}

// ── The crown's edicts ─────────────────────────────────────────────────────
// Because the realm's sovereign is the regulator, realm-level law is a real
// mechanic: a compliance calendar in costume, and functional rather than
// ornamental. Each further realm brings its own edicts, which is what makes
// expansion operationally meaningful rather than just more map.
//
// DATA MODEL ONLY this phase (§5, §7) — no UI, no surface, no rail item.

export type EdictKind =
  /** The licence itself must stand — hung, current, unrevoked. */
  | 'licence'
  /** Hours of continuing education owed before the licence may be renewed. */
  | 'ce-hours'
  /** What must be told to whom, and by when. */
  | 'disclosure'
  /** How other folk's money is kept: segregated, reconciled, never borrowed. */
  | 'trust-account'
  /** A paper the sovereign wants filed by a date certain. */
  | 'filing';

/** What the sovereign's roll says of an obligation. This is a RECORD of a
 *  deliberate act (the thing was answered, or the sovereign struck it), never a
 *  judgment about the clock — so it cannot go stale.
 *
 *  Lateness is deliberately NOT one of these values: an owed edict past its day
 *  is LATE, and that is read from `dueOn` against the clock by `readEdict`. Had
 *  `broken` been stored, a date passing in the night would leave the record
 *  saying one thing and the calendar another. */
export type EdictStanding =
  /** It stands unanswered — the obligation is live. */
  | 'owed'
  /** Answered: filed, taught, disclosed, reconciled. */
  | 'kept'
  /** The sovereign struck or waived it. */
  | 'forgiven';

export interface Edict {
  id: string;
  realmId: string;
  kind: EdictKind;
  /** The day it comes due, as a date the whole book writes dates (`YYYY-MM-DD`
   *  or a full instant — both parse). */
  dueOn: string;
  standing: EdictStanding;
  /** What is actually wanted, in the kingdom's plain words. */
  says?: string;
}

// ── The book ───────────────────────────────────────────────────────────────

/** Every record of the tenure hierarchy in one volume — the same one-book shape
 *  the Marches ledger and the acts book take. It is NOT yet a shelf of the
 *  Chronicle: no key of the vault is added by this phase, so no stored document
 *  has to be migrated for it. When a surface wants it, it adopts its founding
 *  state through `normalizeChronicle` like every book before it. */
export interface TenureBook {
  realms: Realm[];
  shires: Shire[];
  fees: Fee[];
  doors: Door[];
  edicts: Edict[];
}

export const EMPTY_TENURE: TenureBook = {
  realms: [],
  shires: [],
  fees: [],
  doors: [],
  edicts: [],
};

// ── The promotion thresholds ───────────────────────────────────────────────
// Working fluid, every one of them: they are picked so the reading can be
// exercised today, not because twenty-five is sacred. They belong in a setting
// at the gate with every other rate (economySetting.ts), and named constants
// are what makes that move a one-line change rather than a hunt.

/** Doors before a metro is more than a toehold. Below this the vendor radius
 *  and the drive time do not amortise, and one bad door is a fifth of the book. */
export const SHIRE_MIN_DOORS = 25;

/** Knights who must actually cover doors there — someone on the ground, not a
 *  pin on a map. */
export const SHIRE_MIN_KNIGHTS = 1;

/** Crafts allowed to stand headless while a metro is promoted: none. The
 *  household must be able to serve it at all. */
export const SHIRE_MAX_HEADLESS_CRAFTS = 0;

// ── The standing — a reading, and only ever a reading ──────────────────────

export type ShireStanding = 'shire' | 'march';

/** All the standing asks of a craft: whether it has a head. `GuildReading`
 *  satisfies this as it stands, so a caller hands `readGuilds(...)` straight in
 *  and nothing new must be folded for this reading's sake. */
export interface CraftStanding {
  manned: boolean;
}

export interface ShireStandingReading {
  shire: Shire;
  standing: ShireStanding;
  /** Doors of this shire — the whole hierarchy's count, not one muster's. */
  doors: number;
  /** The knights who cover a door here, each once. */
  knights: string[];
  /** Fees with a door here. A fee may appear under several shires; that is
   *  ordinary and is the point (see `shiresOfFee`). */
  fees: string[];
  headlessCrafts: number;
  /** The three tests, each named, so a surface can say WHICH one holds the
   *  promotion back rather than only that something does. */
  holdsDoors: boolean;
  holdsKnight: boolean;
  holdsCrafts: boolean;
  /** What is still wanting, in the kingdom's plain words — empty when the metro
   *  reads as a shire. */
  wanting: string[];
}

/** Fold one metro's standing. A march promotes to a shire when ALL THREE hold:
 *  twenty-five doors, a knight who actually covers one of them, and no craft of
 *  the household standing headless. Any one of them failing leaves it a march.
 *
 *  `crafts` is the household's crafts as already folded (`readGuilds(...)`) —
 *  household-wide, because the offices serve every metro; a headless Chancery
 *  is a reason no metro is ready, not a reason one of them is not. Pass none
 *  and the craft clause simply holds (nothing is headless in an empty list),
 *  which is the honest reading for a caller that has no household to speak of. */
export function readShireStanding(
  book: TenureBook,
  shireId: string,
  crafts: readonly CraftStanding[] = [],
): ShireStandingReading | null {
  const shire = book.shires.find((s) => s.id === shireId);
  if (!shire) return null;

  const doors = doorsOfShire(book, shireId);
  const knights = [
    ...new Set(doors.map((d) => d.knightId).filter((k): k is string => !!k)),
  ];
  const fees = [...new Set(doors.map((d) => d.feeId))];
  const headlessCrafts = crafts.filter((c) => !c.manned).length;

  const holdsDoors = doors.length >= SHIRE_MIN_DOORS;
  const holdsKnight = knights.length >= SHIRE_MIN_KNIGHTS;
  const holdsCrafts = headlessCrafts <= SHIRE_MAX_HEADLESS_CRAFTS;

  const wanting: string[] = [];
  if (!holdsDoors) {
    wanting.push(
      `${SHIRE_MIN_DOORS - doors.length} more door${SHIRE_MIN_DOORS - doors.length === 1 ? '' : 's'} — a metro under ${SHIRE_MIN_DOORS} is a toehold.`,
    );
  }
  if (!holdsKnight) wanting.push('No knight covers a door here.');
  if (!holdsCrafts) {
    wanting.push(
      `${headlessCrafts} craft${headlessCrafts === 1 ? '' : 's'} stand${headlessCrafts === 1 ? 's' : ''} headless — the household cannot serve it yet.`,
    );
  }

  return {
    shire,
    standing: holdsDoors && holdsKnight && holdsCrafts ? 'shire' : 'march',
    doors: doors.length,
    knights,
    fees,
    headlessCrafts,
    holdsDoors,
    holdsKnight,
    holdsCrafts,
    wanting,
  };
}

/** Every metro of the book with its standing folded — marches first, since a
 *  frontier is what wants the Crown's attention. */
export function readShireStandings(
  book: TenureBook,
  crafts: readonly CraftStanding[] = [],
): ShireStandingReading[] {
  return book.shires
    .map((s) => readShireStanding(book, s.id, crafts))
    .filter((r): r is ShireStandingReading => r != null)
    .sort((a, b) =>
      a.standing === b.standing ? b.doors - a.doors : a.standing === 'march' ? -1 : 1,
    );
}

// ── The small readings the hierarchy is walked with ────────────────────────
// Every one of them tolerates a name it does not know by returning nothing,
// the `estateLabel` way: a reading never throws because a row is missing. The
// guard against a name rotting is the resolution test, not a crash at runtime.

export function realmOf(book: TenureBook, id: string | null | undefined): Realm | null {
  return book.realms.find((r) => r.id === id) ?? null;
}

export function shireOf(book: TenureBook, id: string | null | undefined): Shire | null {
  return book.shires.find((s) => s.id === id) ?? null;
}

export function feeOf(book: TenureBook, id: string | null | undefined): Fee | null {
  return book.fees.find((f) => f.id === id) ?? null;
}

export function doorsOfShire(book: TenureBook, shireId: string): Door[] {
  return book.doors.filter((d) => d.shireId === shireId);
}

export function doorsOfFee(book: TenureBook, feeId: string): Door[] {
  return book.doors.filter((d) => d.feeId === feeId);
}

export function doorsOfRealm(book: TenureBook, realmId: string): Door[] {
  return book.doors.filter((d) => d.realmId === realmId);
}

/** The shires a fee's doors scatter across. Several is NORMAL — this is the
 *  reading that says out loud that a fee is not a place, and the one a renderer
 *  should have to call before it imagines a border. */
export function shiresOfFee(book: TenureBook, feeId: string): string[] {
  return [...new Set(doorsOfFee(book, feeId).map((d) => d.shireId))];
}

/** The knights covering doors in a metro, each once. */
export function knightsOfShire(book: TenureBook, shireId: string): string[] {
  return [
    ...new Set(doorsOfShire(book, shireId).map((d) => d.knightId).filter((k): k is string => !!k)),
  ];
}

/** Doors of a metro in no knight's care — the allocation debt, seen from the
 *  land rather than from the owner. */
export function unattendedDoors(book: TenureBook, shireId?: string): Door[] {
  return book.doors.filter((d) => d.knightId == null && (!shireId || d.shireId === shireId));
}

export function edictsOfRealm(book: TenureBook, realmId: string): Edict[] {
  return book.edicts.filter((e) => e.realmId === realmId);
}

// ── The edicts, read against the clock ─────────────────────────────────────

export interface EdictReading {
  edict: Edict;
  /** Days until it comes due; negative once the day has passed. */
  dueInDays: number;
  /** Owed, and the day is gone. The thing `standing` deliberately does not
   *  store, because a date passing in the night is not a deliberate act. */
  late: boolean;
  /** Owed and the day is near — the band a calendar would colour. */
  pressing: boolean;
}

/** Days ahead of a due date that an owed edict starts to press. Working fluid,
 *  like every other threshold here. */
export const EDICT_PRESSING_DAYS = 30;

const dayMs = 86_400_000;

/** Fold one edict against game-now. `now` is injected, never the wall clock —
 *  under a War Game every reading of this book folds against game time, as the
 *  whole domain does. */
export function readEdict(edict: Edict, now: string): EdictReading {
  const ms = Date.parse(edict.dueOn) - Date.parse(now);
  const dueInDays = Number.isFinite(ms) ? Math.ceil(ms / dayMs) : 0;
  const owed = edict.standing === 'owed';
  return {
    edict,
    dueInDays,
    late: owed && dueInDays < 0,
    pressing: owed && dueInDays >= 0 && dueInDays <= EDICT_PRESSING_DAYS,
  };
}

/** A realm's edicts folded, soonest-due first — the compliance calendar, in
 *  the order a calendar reads. */
export function readEdicts(book: TenureBook, realmId: string, now: string): EdictReading[] {
  return edictsOfRealm(book, realmId)
    .map((e) => readEdict(e, now))
    .sort((a, b) => a.dueInDays - b.dueInDays);
}

// ── The guards the compiler holds ──────────────────────────────────────────
// Two facts of this shelf are load-bearing enough that a comment is not enough
// to keep them: they are asserted at the type level, so breaking either one
// fails `npx tsc` at the moment it is written rather than in a renderer six
// months from now. `test/tenure.test.ts` holds the same two facts over the
// founding records at runtime.

type Assert<T extends true> = T;

/** A fee may bear no word that describes a place (see `GEOMETRY_WORDS`). Add
 *  `centroid` to `Fee` and this line stops compiling. */
export type FEE_HAS_NO_GEOMETRY = Assert<
  Extract<keyof Fee, GeometryWord> extends never ? true : false
>;

/** A shire may not STORE its standing. Add `standing`, `kind` or `status` to
 *  `Shire` and this line stops compiling — the reading is the only truth. */
export type SHIRE_STORES_NO_STANDING = Assert<
  Extract<keyof Shire, 'standing' | 'kind' | 'status' | 'march' | 'promoted'> extends never
    ? true
    : false
>;

/** And the household's craft reading really does satisfy what the standing asks
 *  of it — so `readGuilds(...)` can be handed straight in, and a change to
 *  `GuildReading` that dropped `manned` would be heard here. */
export type GUILD_READING_IS_A_CRAFT = Assert<
  GuildReading extends CraftStanding ? true : false
>;

// ── The founding hierarchy ─────────────────────────────────────────────────
// WORKING FLUID, every row: invented streets on invented owner groups, in the
// war game's own voice. The realm and its two metros are public geography and
// a public regulator; nothing any firm holds is here, and nothing here is meant to
// mirror it. The data gate stands where it stood.
//
// It is shaped to exercise the reading rather than to be pretty: Northreach clears
// all three tests and reads a SHIRE; Westmoor is short on doors and reads a MARCH;
// and one fee (Ashcombe) holds doors in BOTH, which is the non-contiguity the
// type refuses to let anyone forget.

const ALDERMARCH = 'am';

/** Expand a run of doors onto one street — the founding book's rows are
 *  regular, and thirty-six hand-written literals would hide the shape rather
 *  than show it. Every id it makes is a plain stable slug, the same kind the
 *  war game's addresses are. */
function doorRun(o: {
  street: string;
  from: number;
  count: number;
  shireId: string;
  feeId: string;
  knightId: string | null;
}): Door[] {
  const doors: Door[] = [];
  for (let i = 0; i < o.count; i++) {
    doors.push({
      id: `${o.from + i} ${o.street}, unit ${String.fromCharCode(65 + (i % 4))}`,
      realmId: ALDERMARCH,
      shireId: o.shireId,
      feeId: o.feeId,
      knightId: o.knightId,
    });
  }
  return doors;
}

export const FOUNDING_TENURE: TenureBook = {
  realms: [
    {
      id: ALDERMARCH,
      name: 'Aldermarch',
      sovereign: 'The Aldermarch Estates Commission',
    },
  ],
  shires: [
    // The seat. Twenty-eight doors under two knights — it clears every test.
    { id: 'northreach', realmId: ALDERMARCH, name: 'Northreach' },
    // The frontier: entered lately, eight doors, one knight riding out. It
    // reads a MARCH, and it reads a shire the day it crosses the thresholds —
    // no hand moves a field for that to happen.
    { id: 'westmoor', realmId: ALDERMARCH, name: 'Westmoor' },
  ],
  fees: [
    {
      id: 'fee-ashcombe',
      realmId: ALDERMARCH,
      name: 'The Ashcombe holding',
      patron: 'Mira Ashcombe',
      // Scattered on purpose: doors in Northreach AND Westmoor. Draw a border round
      // this and the border is a lie.
    },
    {
      id: 'fee-underhill',
      realmId: ALDERMARCH,
      name: 'The Underhill holding',
      patron: 'Ida Underhill',
    },
    {
      id: 'fee-greaves',
      realmId: ALDERMARCH,
      name: 'The Greaves holding',
      patron: 'Otho Greaves',
    },
  ],
  doors: [
    // ── Northreach: 28 doors, two knights, and four doors in no knight's care ────
    ...doorRun({ street: 'Willow Row', from: 101, count: 8, shireId: 'northreach', feeId: 'fee-ashcombe', knightId: 'knight-aldous' }),
    ...doorRun({ street: 'Cobblegate Lane', from: 201, count: 8, shireId: 'northreach', feeId: 'fee-underhill', knightId: 'knight-aldous' }),
    ...doorRun({ street: 'Millbrook Way', from: 301, count: 8, shireId: 'northreach', feeId: 'fee-greaves', knightId: 'knight-maren' }),
    // The debt, said in doors: four stand with no knight over them.
    ...doorRun({ street: 'Thatchfield Road', from: 401, count: 4, shireId: 'northreach', feeId: 'fee-underhill', knightId: null }),

    // ── Westmoor: 8 doors — a march, and short of the door threshold ───────────
    ...doorRun({ street: 'Barleycorn Street', from: 501, count: 5, shireId: 'westmoor', feeId: 'fee-ashcombe', knightId: 'knight-maren' }),
    ...doorRun({ street: 'Foxglove Close', from: 601, count: 3, shireId: 'westmoor', feeId: 'fee-greaves', knightId: null }),
  ],
  edicts: [
    {
      id: 'am-licence',
      realmId: ALDERMARCH,
      kind: 'licence',
      dueOn: '2027-04-30',
      standing: 'owed',
      says: 'The broker’s licence is hung and current; it must be renewed before the day.',
    },
    {
      id: 'am-ce-hours',
      realmId: ALDERMARCH,
      kind: 'ce-hours',
      dueOn: '2027-03-31',
      standing: 'owed',
      says: 'Eighteen hours of continuing education owed before the licence renews.',
    },
    {
      id: 'am-disclosure',
      realmId: ALDERMARCH,
      kind: 'disclosure',
      dueOn: '2026-08-31',
      standing: 'owed',
      says: 'The agency disclosure is given at first substantive contact — every door, every time.',
    },
    {
      id: 'am-trust-account',
      realmId: ALDERMARCH,
      kind: 'trust-account',
      dueOn: '2026-08-15',
      standing: 'owed',
      says: 'The trust account is reconciled monthly and never borrowed from.',
    },
    {
      id: 'am-filing',
      realmId: ALDERMARCH,
      kind: 'filing',
      dueOn: '2026-07-15',
      standing: 'kept',
      says: 'The quarterly filing went in on the day it was owed.',
    },
  ],
};
