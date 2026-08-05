// The War Game generator — the proving ground (docs/WAR-GAMES.md,
// docs/WRIT-WAR-GAME.md). From a seed and a clock this pours a synthetic
// ~200-door operation through the operator, entirely as EVENTS: doors,
// medieval-named tenants, and a stream of work boxes — move-out relays
// triggered on doors (dealt at varied stages of progress), work orders,
// delinquencies, renewals, rent postings — spread across the real seats and
// timestamped across recent simulated days, so the queues and aging read
// true the moment the game loads.
//
// Events-only: a War Game is just a big generated log the operator already
// knows how to read. Nothing here is stored state; the store appends the
// returned events to the chronicle's log, and every reading folds from there.
// Gate-safe and recoverable: every door, tenant, and owner is invented — the
// data gate stays shut — and every case id carries the `wg/<seed>` mark so
// Reset strikes exactly the game's events and nothing else (the founding
// chronicle is one Reset away).
//
// Pure and seeded: same seed, same clock, same world. The clock is injected
// as `end` (game-now); ids are deterministic so a redeploy of the same seed
// can skip what is already dealt and append only new boxes.

import type { Catalog } from './catalog';
import { findRow } from './catalog';
import type { KingdomEvent } from './events';
import type { FlowBook, FlowTemplate } from './flows';
import { handStep, instantiateFlow } from './flows';
import { commissionCaseId, placementCaseId } from './pods';
import type { EconomyBook, MoneyEvent } from './economy';
import { FOUNDING_ECONOMY, feeAmount, feeRuleFor, readOwnerStatement } from './economy';
import type { Upkeep } from './treasury';
import { RENT_PER_DOOR, WAR_HOUSEHOLD } from './treasury';

// ── The mark — how Reset knows the game's events from any other ─────────────
// Every case a game opens reads `wg/<seed> …`; striking a game removes the
// events whose caseId bears its mark, and only those.

export const WAR_MARK = 'wg/';

/** What a seed has already dealt, folded from the log — so a redeploy of the
 *  same seed appends only new boxes, never duplicates. */
export interface DealtGame {
  seed: string;
  tenants: Map<string, string>; // door address → tenant name (from lease cases)
  relays: string[]; // relay subjects already triggered
}

export function dealtGame(log: KingdomEvent[], seed: string): DealtGame {
  const mark = `${WAR_MARK}${seed} · `;
  const tenants = new Map<string, string>();
  const relays: string[] = [];
  for (const e of log) {
    if (!e.caseId.includes(mark)) continue;
    if (e.kind !== 'opened') continue;
    const lease = e.caseId.match(/ · lease · (.+) — (.+)$/);
    if (lease) tenants.set(lease[1], lease[2]);
    const horn = e.note?.indexOf('The war horn sounds');
    if (horn != null && horn >= 0) {
      const subject = e.caseId.slice(e.caseId.indexOf(': ') + 2);
      relays.push(subject);
    }
  }
  return { seed, tenants, relays };
}

// ── The banner — the war state the chronicle carries ────────────────────────
// The game itself is events; this small marker is only the muster's name and
// its clock. While it stands, the app reads the operator against `now`
// (game time) instead of the wall clock; Reset strikes it.

export interface WarState {
  seed: string;
  /** Game-now — the simulated clock. Advance moves it forward; the readings
   *  re-fold, aging climbs, breaches surface. */
  now: string;
  /** When the muster was deployed (wall time) — for the record. */
  deployedAt: string;
  /** The line the generator tallied at deploy (boxes dealt, by kind). */
  tally: Record<string, number>;
  /** The muster's door book — every door and its owner, including the ones
   *  standing EMPTY. A vacant door has no case (that is why it is vacant), so
   *  it appears in no reading folded from the log; without this roster the
   *  living map could never draw the empties, which is half of what it is for.
   *  Optional: a muster deployed before this was recorded simply has none. */
  doors?: WarDoor[];
  /** The catalog/flows that stood BEFORE a grand muster swapped them for the
   *  reference library — the snapshot Reset restores so the swap is not
   *  permanent. Present only for a grand muster (the plain war game leaves the
   *  catalog untouched, so it needs no snapshot). Undefined ⇒ nothing to
   *  restore (a plain game, or a grand muster deployed before this was added). */
  restoreCatalog?: Catalog;
  restoreFlows?: FlowBook;
}

// ── The dice — a small seeded generator (mulberry32) ────────────────────────
// The kingdom needs no crypto here: a game must be REPRODUCIBLE from its
// seed, so the die is a plain 32-bit mulberry — same seed, same throws.

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface Dice {
  next: () => number; // [0, 1)
  int: (lo: number, hi: number) => number; // inclusive
  pick: <T>(xs: T[]) => T;
  chance: (p: number) => boolean;
}

export function dice(seed: string): Dice {
  let a = hashSeed(seed);
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (xs) => xs[Math.floor(next() * xs.length)],
    chance: (p) => next() < p,
  };
}

// ── The clock helpers ───────────────────────────────────────────────────────

const dayMs = 86_400_000;

function daysAgo(end: string, days: number, d: Dice): string {
  // Scatter within the day so the feed doesn't read as one midnight drumbeat.
  return new Date(Date.parse(end) - days * dayMs - d.int(0, 14 * 3600) * 1000).toISOString();
}

function daysAfter(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * dayMs).toISOString();
}

// ── The doors and the name-maker ────────────────────────────────────────────
// Working fluid with flavor (law 1: recognizable words, no glossary): ~200
// doors on invented rows, tenants named given-name + trade, owners holding
// one to a few doors. Plentiful and varied; the melee reads as the kingdom.

const STREETS = [
  'Willow Row',
  'Cobblegate Lane',
  'Millbrook Way',
  'Thatchfield Road',
  'Barleycorn Street',
  'Foxglove Close',
  'Harrowgate Road',
  'Meadowlark Lane',
  'Stonewall Row',
  'Kingsmill Way',
  'Alderbrook Lane',
  'Wheatland Street',
  'Cinderford Road',
  'Rookery Row',
  'Lantern Way',
  'Millstone Close',
];

const GIVEN = [
  'Agnes', 'Aldric', 'Alfred', 'Alice', 'Anselm', 'Audrey', 'Baldwin', 'Beatrice',
  'Benedict', 'Bertha', 'Bertram', 'Bob', 'Cecily', 'Clement', 'Constance', 'Cuthbert',
  'Dorothy', 'Dunstan', 'Edith', 'Edmund', 'Eleanor', 'Elsbeth', 'Emma', 'Eustace',
  'Felix', 'Gilbert', 'Giles', 'Godfrey', 'Greta', 'Gunnilda', 'Guy', 'Hawise',
  'Henry', 'Hilda', 'Hugh', 'Ida', 'Isolda', 'Ivo', 'Joan', 'Jocelyn',
  'Lambert', 'Lettice', 'Margery', 'Martin', 'Matilda', 'Maud', 'Milo', 'Nicholas',
  'Osbert', 'Osric', 'Percival', 'Petronilla', 'Ralph', 'Randall', 'Reynold', 'Rohesia',
  'Roland', 'Rosamund', 'Rowena', 'Sabina', 'Sybil', 'Thomas', 'Walter', 'Wilfred',
  'Winifred', 'Yolanda',
];

const TRADE = [
  'the Tanner', 'the Alewife', 'the Smith', 'the Cooper', 'the Mason', 'the Miller',
  'the Weaver', 'the Chandler', 'the Fletcher', 'the Baker', 'the Carpenter', 'the Cobbler',
  'the Dyer', 'the Potter', 'the Reeve', 'the Scribe', 'the Tailor', 'the Thatcher',
  'the Wheelwright', 'the Butcher', 'the Carter', 'the Fisher', 'the Fuller', 'the Glover',
  'the Harper', 'the Locksmith', 'the Mercer', 'the Plowman', 'the Roper', 'the Saddler',
  'the Shepherd', 'the Tiler', 'the Wainwright',
];

const EPITHET = [
  'the Widow of Willow Row',
  'the Hermit of Harrowgate',
  'Old Hob of the Mill',
  'the Peddler of Cobblegate',
  'the Watchman of Rookery Row',
  'the Beggar of Barleycorn',
  'the Midwife of Meadowlark',
  'the Gravedigger of Cinderford',
];

const SURNAME = [
  'Ashdown', 'Barley', 'Blackwood', 'Bridgewater', 'Coldwell', 'Crowther',
  'Fairbanks', 'Fenwick', 'Grimsby', 'Halloway', 'Hartfield', 'Hollowell',
  'Ironmonger', 'Larkspur', 'Marsh', 'Netherfield', 'Oakhart', 'Ravensworth',
  'Thistledown', 'Underhill', 'Weatherby', 'Wickham',
];

/** One tenant's name: a given name and a trade, or one of the titled folk. */
export function tenantName(d: Dice): string {
  if (d.chance(0.08)) return d.pick(EPITHET);
  return `${d.pick(GIVEN)} ${d.pick(TRADE)}`;
}

/** A landlord's name — an owner of doors, not a trade. */
function ownerName(d: Dice): string {
  return `${d.pick(GIVEN)} ${d.pick(SURNAME)}`;
}

export interface WarDoor {
  address: string;
  owner: string;
}

/** The ~200 doors of the operation, each with its owner. Owners hold one to
 *  a few doors, as scattered portfolios do. */
export function makeDoors(d: Dice, count: number): WarDoor[] {
  const doors: WarDoor[] = [];
  for (let i = 0; i < count; i++) {
    const street = STREETS[i % STREETS.length];
    const unit = `unit ${String.fromCharCode(65 + (i % 4))}`;
    doors.push({ address: `${101 + i} ${street}, ${unit}`, owner: '' });
  }
  // Deal owners across the doors in runs of 1–4.
  let at = 0;
  while (at < doors.length) {
    const owner = ownerName(d);
    const span = d.int(1, 4);
    for (let k = 0; k < span && at < doors.length; k++, at++) doors[at].owner = owner;
  }
  return doors;
}

// ── The box stream ──────────────────────────────────────────────────────────

export interface WarGame {
  seed: string;
  /** Game-now — the instant the world was dealt up to. The store keeps it as
   *  the simulated clock; Advance moves it; the operator reads against it. */
  now: string;
  doors: WarDoor[];
  /** The events to append — the whole operation, in time order. */
  events: KingdomEvent[];
  /** The money-dimension the operation moved this month — rents, fees, bills,
   *  sweeps, draws, and the Crown's upkeep — every one `wg`-marked so Reset
   *  strikes it (docs/WRIT-ECONOMY.md, swing three). Appended to `chronicle.money`. */
  money: MoneyEvent[];
  /** A line for the regent: how many of each box were dealt. */
  tally: Record<string, number>;
}

// ── The money the operation moves (WRIT-ECONOMY, swing three) ────────────────
// A month of coin dealt from the SAME world the work is dealt from, so the
// coffers move as the operation runs (not only when a sample is dealt by hand).
// For each occupied door: the deposit held, the month's rent charged and
// received, the management fee earned on it; a share of doors carry a vendor
// repair (bill, pay, and the firm's coordination markup). The earned fees are
// mostly swept to the company bank, the owners are paid most of their net, and
// the Crown's own household upkeep is folded into the CORPORATE book as expense —
// so the Counting-house's corporate runway reads fees-against-upkeep, the real
// fail state. Cash-complete on rent (so the trust bank reconciles clean); every
// event `wg`-marked. Pure and seeded.

/** The corporate expense account a household line lands in. */
function householdRole(id: string): string {
  if (id === 'wg-household-tools') return 'software_expense';
  if (id === 'wg-household-hall') return 'overhead_expense';
  return 'payroll_expense'; // the seats' salaries
}

function dealMoney(opts: {
  seed: string;
  end: string;
  d: Dice;
  occupied: WarDoor[];
  economy: EconomyBook;
  /** The Crown's own standing cost for THIS holding. Omit and the full war
   *  household stands (the ~200-door company) — every caller before the
   *  campaign meant exactly that. A small holding bears a small hall, and
   *  says so here rather than drowning under a company's payroll. */
  household?: Upkeep[];
}): MoneyEvent[] {
  const { seed, end, d, occupied, economy } = opts;
  const money: MoneyEvent[] = [];
  let n = 0;
  const id = () => `wgm-${seed.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${++n}`;
  const at = end; // the month dealt as of game-now
  const rentCents = Math.round(RENT_PER_DOOR * 100);
  const mgmt = feeRuleFor(economy, 'management');
  const markup = feeRuleFor(economy, 'markup');
  const push = (kind: MoneyEvent['kind'], amountCents: number, extra: Partial<MoneyEvent> = {}) => {
    money.push({ id: id(), at, kind, amountCents, wg: seed, ...extra });
  };

  let earnedFees = 0; // management — sweeps to the operating bank
  let earnedCommission = 0; // markup — the firm's commission, sweeps to By-Pass
  for (const door of occupied) {
    const p = { estateId: door.address, ownerId: door.owner };
    push('deposit_received', rentCents, p); // one month's deposit, held in trust
    push('rent_charged', rentCents, p);
    push('rent_received', rentCents, p); // cash-complete, so the bank reconciles
    if (mgmt) {
      const fee = feeAmount(mgmt, rentCents);
      push('management_fee', fee, p);
      earnedFees += fee;
    }
    // ~1 in 6 doors carried a repair this month (bill, pay, and the markup).
    if (d.chance(0.16)) {
      const bill = d.int(150, 900) * 100;
      push('vendor_bill', bill, { ...p, vendorId: 'an artisan of the trade' });
      push('vendor_paid', bill, { ...p, vendorId: 'an artisan of the trade' });
      if (markup) {
        const mk = feeAmount(markup, bill);
        push('markup', mk, p);
        earnedCommission += mk;
      }
    }
  }
  // Sweep most of the earned fees; commission to the segregated By-Pass bank, the
  // management fees to operating (the "commissions never post through operating"
  // rule); a fifth of each ages un-swept.
  if (earnedFees > 0) push('fee_sweep', Math.round(earnedFees * 0.8));
  if (earnedCommission > 0) push('commission_sweep', Math.round(earnedCommission * 0.8));
  // Pay each owner most of their net held in trust (a buffer stays behind).
  for (const owner of [...new Set(occupied.map((x) => x.owner))]) {
    const net = readOwnerStatement(economy, money, owner).endingCents;
    const draw = Math.floor((net * 0.7) / 100) * 100;
    if (draw > 0) push('owner_draw', draw, { ownerId: owner });
  }
  // The Crown's own month: the household upkeep, folded into the corporate book
  // so the corporate runway reads fees-against-upkeep (the fail state).
  for (const u of opts.household ?? WAR_HOUSEHOLD) {
    push('corp_expense', Math.round(u.monthly * 100), {
      accountRole: householdRole(u.id),
      memo: u.label,
    });
  }
  return money;
}

/** A standing box: one case, opened some days back and walked as far along
 *  its path as its age allows — so some sit open on their seats and some
 *  stand done. `path` ages are measured back from the box's own age. */
interface PathStep {
  kind: KingdomEvent['kind'];
  ageDays: (d: Dice) => number;
  tone: string;
}

interface StandingBox {
  box: string;
  catalogRow: string;
  holder: string;
  /** How old the box is when dealt (days back from game-now). */
  openedDaysAgo: (d: Dice) => number;
  path: PathStep[];
}

const OPEN_BOXES: StandingBox[] = [
  {
    box: 'rent posting',
    catalogRow: 'rent-post',
    holder: 'pm-desk',
    openedDaysAgo: (d) => d.int(1, 45),
    path: [
      { kind: 'handed', ageDays: (d) => d.int(1, 30), tone: 'the month’s rent is posted' },
      { kind: 'done', ageDays: (d) => d.int(1, 10), tone: 'rent posted and receipted' },
    ],
  },
  {
    box: 'renewal',
    catalogRow: 'renewal',
    holder: 'alys',
    openedDaysAgo: (d) => d.int(1, 20),
    path: [
      { kind: 'handed', ageDays: (d) => d.int(1, 14), tone: 'the T-90 renewal reaches the desk' },
    ],
  },
  {
    box: 'delinquency',
    catalogRow: 'delinquency',
    holder: 'mabel',
    openedDaysAgo: (d) => d.int(1, 20),
    path: [
      { kind: 'handed', ageDays: (d) => d.int(1, 14), tone: 'rent unpaid past grace' },
      { kind: 'awaiting', ageDays: (d) => d.int(1, 5), tone: 'promise to pay — waits on a judgment' },
    ],
  },
];

// The typed work orders — the maintenance leaves of the task-language, each
// its own word (its catalog key carries the domain/system facets, so the
// readings group them without any extra marking here). A share of these is
// dealt as full vendor-dispatch cascades instead (see generateWarGame) —
// atomic short tasks for the bulk, walked 8-step grammars for the rest, so
// the open-case budget holds.
// Keyed by the leaf's final segment ("no-cooling"), so a catalog leaf
// ("maintenance.hvac.no-cooling") finds its box/holder/path by exact segment
// match — see pickSpec.
const MAINTENANCE_LEAVES: (Omit<StandingBox, 'catalogRow'> & { leaf: string })[] = [
  {
    leaf: 'no-cooling',
    box: 'no-cooling call',
    holder: 'pm-desk',
    openedDaysAgo: (d) => d.int(1, 16),
    path: [{ kind: 'handed', ageDays: (d) => d.int(1, 12), tone: 'no cooling reported at the door' }],
  },
  {
    leaf: 'no-heating',
    box: 'no-heating call',
    holder: 'pm-desk',
    openedDaysAgo: (d) => d.int(1, 16),
    path: [{ kind: 'handed', ageDays: (d) => d.int(1, 12), tone: 'no heating reported at the door' }],
  },
  {
    leaf: 'refrigerant-leak',
    box: 'refrigerant leak',
    holder: 'pm-desk',
    openedDaysAgo: (d) => d.int(1, 16),
    path: [{ kind: 'handed', ageDays: (d) => d.int(1, 12), tone: 'the cooling lines weep refrigerant' }],
  },
  {
    leaf: 'thermostat',
    box: 'thermostat fault',
    holder: 'pm-desk',
    openedDaysAgo: (d) => d.int(1, 16),
    path: [{ kind: 'handed', ageDays: (d) => d.int(1, 12), tone: 'the thermostat reads wrong' }],
  },
  {
    leaf: 'routine-service',
    box: 'routine HVAC service',
    holder: 'pm-desk',
    openedDaysAgo: (d) => d.int(1, 30),
    path: [{ kind: 'handed', ageDays: (d) => d.int(1, 20), tone: 'the seasonal service comes due' }],
  },
  {
    leaf: 'leak',
    box: 'active leak',
    holder: 'pm-desk',
    openedDaysAgo: (d) => d.int(1, 16),
    path: [{ kind: 'handed', ageDays: (d) => d.int(1, 12), tone: 'water where water must not be' }],
  },
  {
    leaf: 'refrigerator',
    box: 'refrigerator down',
    holder: 'pm-desk',
    openedDaysAgo: (d) => d.int(1, 16),
    path: [{ kind: 'handed', ageDays: (d) => d.int(1, 12), tone: 'the cold box has gone warm' }],
  },
];

// ── Raw, untriaged intake — the Regent's signature act's input ─────────────
// "A thing happened at a door," not yet a typed word: a plain open `work-order`
// case that names no leaf. The Regent's seat (swing three) walks each down the
// tree (domain → system → leaf) to identify it, and choosing the leaf TRIGGERS
// its completion flow — the ticket becomes a real cascade, not a tick. Modest
// by design (WRIT-TASK-LANGUAGE swing three: a satisfying core act, not data
// entry); the bulk of the work arrives typed, for bulk delegation. Each carries
// its door's owner so its harm — and its identification — folds onto the Patron.
const INTAKE_COMPLAINTS = [
  'no cooling in the heat',
  'no heat and a cold snap coming',
  'a pipe burst under the sink',
  'the refrigerator has quit',
  'no hot water since the morning',
  'a window cracked in the wind',
  'the garbage disposal is jammed',
  'a smoke alarm chirping through the night',
  'the toilet overflows',
  'a door lock seized shut',
  'the dishwasher floods the floor',
  'a stain spreading on the ceiling',
];

// The knights the muster recruits — working-fluid agent names (the Master Plan's
// equity-partners), each holding a pod of owners. A share of the game's owners is
// dealt already placed into these pods; the rest stand UNPLACED — the Regent's
// allocation debt, the owners to put into a knight's care (WRIT-THE-LAND, Phase
// 2). Recruit more knights and place more owners to drive the debt down.
const KNIGHT_NAMES = ['Ser Aldous Vane', 'Ser Maren Holt', 'Ser Bertrand Coles'];

/** Deal the pods: commission a couple of knights and place a share of the
 *  operation's owners into their care, leaving the rest unplaced. Events-only and
 *  `wg/<seed>`-marked (commissionCaseId / placementCaseId), so Reset strikes them
 *  and readPods folds them. Pure: seed-driven dice in, events out. */
function dealPods(opts: {
  seed: string;
  end: string;
  d: Dice;
  owners: string[];
  id: () => string;
  knights?: number;
  placeFrac?: number;
}): KingdomEvent[] {
  const { seed, end, d, owners, id } = opts;
  const knights = KNIGHT_NAMES.slice(0, Math.max(1, opts.knights ?? 2));
  const events: KingdomEvent[] = [];
  // A commission and a placement are SETTLED facts, not open work — dealt like a
  // lease (opened + a settling done at the same instant), so the operator's
  // work-readings never count them as boxes, while readPods still folds them.
  const commissionedAt = daysAgo(end, d.int(30, 90), d);
  for (const name of knights) {
    const cid = commissionCaseId(seed, name);
    events.push({ id: id(), at: commissionedAt, caseId: cid, kind: 'opened', holder: name, note: `${name} is commissioned a knight — a pod stands open for owners to place.` });
    events.push({ id: id(), at: commissionedAt, caseId: cid, kind: 'done', holder: name, note: `${name} holds the pod.` });
  }
  const distinct = [...new Set(owners)];
  const placeFrac = opts.placeFrac ?? 0.35;
  for (const owner of distinct) {
    if (!d.chance(placeFrac)) continue;
    const knight = knights[Math.floor(d.next() * knights.length)];
    const at = daysAgo(end, d.int(1, 40), d);
    const pid = placementCaseId(seed, owner);
    events.push({ id: id(), at, caseId: pid, kind: 'opened', holder: knight, note: `${owner} placed in ${knight}'s care.` });
    events.push({ id: id(), at, caseId: pid, kind: 'done', holder: knight, note: `${owner} settled in ${knight}'s pod.` });
  }
  return events;
}

/** Deal a modest stream of raw, untriaged intake across the doors — plain open
 *  `work-order` cases the Regent will identify down the tree. Marked and owner-
 *  bearing like every war case, so Reset strikes them and the Patron fold reads
 *  them. Pure: seed-driven dice in, events out. */
function dealIntake(opts: {
  seed: string;
  end: string;
  d: Dice;
  doors: WarDoor[];
  id: () => string;
  count: number;
  /** The oldest a ticket may be dealt (days back). Omit and the founding
   *  spread stands (up to nine days, which reads STUCK the moment it lands). */
  maxAgeDays?: number;
}): KingdomEvent[] {
  const { seed, end, d, doors, id } = opts;
  if (!doors.length) return [];
  const oldest = Math.min(9, opts.maxAgeDays ?? 9);
  const events: KingdomEvent[] = [];
  for (let k = 0; k < opts.count; k++) {
    const door = doors[Math.floor(d.next() * doors.length)];
    const complaint = INTAKE_COMPLAINTS[Math.floor(d.next() * INTAKE_COMPLAINTS.length)];
    const caseId = `${WAR_MARK}${seed} · intake · ${door.address} — ${complaint}`;
    events.push({
      id: id(),
      at: daysAgo(end, d.int(0, oldest), d),
      caseId,
      kind: 'opened',
      holder: 'pm-desk',
      catalogRow: 'work-order',
      note: `A tenant reports: ${complaint}. Untriaged — walk it down the tree to put it in motion. Owner: ${door.owner}.`,
    });
  }
  return events;
}

/** Deal the world: doors, leases, standing boxes, and move-out relays
 *  triggered on doors and walked to varied stages of progress. Pure: seed +
 *  `end` in, the whole world out. `dealt` (from `dealtGame`) makes a redeploy
 *  of the same seed skip the leases and relays the log already carries. */
export function generateWarGame(opts: {
  seed: string;
  /** Game-now: the world is dealt as of this instant (the store passes the
   *  wall clock at deploy, so game time starts where real time stands). */
  end: string;
  /** The move-out → re-list template — the relay cascades are built from it. */
  relay: FlowTemplate;
  /** The vendor-dispatch grammar — a share of the typed work orders are dealt
   *  as walked instances of it (omit to deal every WO atomically). */
  dispatch?: FlowTemplate;
  /** The loaded catalog — doors are only drawn into boxes whose rows it
   *  knows; a struck row simply thins the stream. */
  catalog: Catalog;
  doors?: number; // default 200
  /** Standing boxes per day of history, 45 days deep — kept to the ~700–1,000
   *  open-case budget (WRIT-TASK-LANGUAGE, swing two's volume law) now that
   *  leases stand settled and the relay cascades carry their own weight. */
  boxesPerDay?: number;
  /** Roughly 1 in `moveOutEvery` occupied doors carries a live relay. */
  moveOutEvery?: number; // default 8
  /** Raw untriaged intake to deal for the Regent's seat to identify. */
  intake?: number; // default 18
  /** The economy's chart + fee rules — the money-dimension's fees fold from it
   *  (docs/WRIT-ECONOMY.md). Defaults to the founding working-fluid chart. */
  economy?: EconomyBook;
  /** The Crown's standing cost this world bears. Omit and the full war
   *  household stands, as it always has. */
  household?: Upkeep[];
  /** The oldest an OPEN box may be dealt, in days back from game-now. Omit and
   *  each stream keeps its founding spread — which is how the grand muster
   *  arrives with a backlog already stale (555 of 560 boxes read "stuck > 7d"
   *  at week one, so the gauge is saturated before the player has done
   *  anything). A campaign passes a small number: the clock starts clean, and
   *  the aging gauge then measures the PLAYER, which is the whole lesson
   *  (docs/WRIT-THE-CAMPAIGN.md §II). */
  maxOpenAgeDays?: number;
  dealt?: DealtGame;
}): WarGame {
  const seed = opts.seed.trim() || 'the-first-muster';
  const end = opts.end;
  const d = dice(seed);
  const doorCount = opts.doors ?? 200;
  const doors = makeDoors(d, doorCount);
  // No cap unless one is asked for — Infinity leaves every `Math.min` below
  // reading exactly as it did before the knob existed.
  const oldestOpen = opts.maxOpenAgeDays ?? Infinity;
  const known = new Set(opts.catalog.map((r) => r.key));
  const dealt = opts.dealt;
  // The leaf rows that bind the vendor-dispatch grammar, with their letters
  // ({trade}, {urgency}) — the typed work orders below are dealt from these.
  const leaves = opts.catalog.filter((r) => r.completes === 'vendor-dispatch');

  const events: KingdomEvent[] = [];
  const tally: Record<string, number> = {};
  let n = 0;
  const id = () => `wg-${seed.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${++n}`;
  const mark = (box: string, by = 1) => {
    tally[box] = (tally[box] ?? 0) + by;
  };
  const warCase = (box: string, door: WarDoor) =>
    `${WAR_MARK}${seed} · ${box} · ${door.address}`;

  // The leases: most doors occupied (one tenant each, named), a few standing
  // vacant. A lease in good standing is a STATE, not open work (WRIT-TASK-
  // LANGUAGE, swing two — the perpetual-open lease was the old system's
  // clutter): the signing opens the case and a settling `done` at the same
  // instant closes it, so `statusOf` never reads it as open and the queues /
  // outcomes / the Throne never count it. The events still carry the door →
  // tenant roster the relays name, and `dealtGame` still folds it, so a
  // redeploy of the same seed skips every settled lease (no double-deal).
  const vacant = new Set<WarDoor>();
  const tenants = new Map<string, string>(); // address → tenant
  for (const door of doors) {
    if (d.chance(0.06)) {
      vacant.add(door);
      continue;
    }
    const tenant = tenantName(d);
    tenants.set(door.address, tenant);
    if (dealt?.tenants.has(door.address)) continue; // already on the books
    const signedAt = daysAgo(end, d.int(90, 400), d);
    const caseId = warCase('lease', door) + ` — ${tenant}`;
    events.push({
      id: id(),
      at: signedAt,
      caseId,
      kind: 'opened',
      holder: 'alys',
      note: `Lease signed — ${tenant} takes the door; rent due the 1st. Owner: ${door.owner}.`,
    });
    events.push({
      id: id(),
      at: signedAt,
      caseId,
      kind: 'done',
      holder: 'alys',
      note: `Lease settled at signing — ${tenant} holds the door in good standing.`,
    });
    mark('leases');
  }

  // Draw the box a day's slot deals: three words in five a maintenance leaf
  // (drawn only from the loaded catalog's vendor-dispatch leaves), the rest
  // one of the other domains' standing rows — rent postings, renewals,
  // delinquencies — whose facets ride their catalog rows.
  const pickSpec = (d: Dice, leaves: Catalog): StandingBox | null => {
    if (d.chance(0.6) && leaves.length) {
      const leaf = d.pick(leaves);
      const seg = leaf.key.split('.').pop();
      const spec = MAINTENANCE_LEAVES.find((m) => m.leaf === seg);
      return spec
        ? {
            box: spec.box,
            catalogRow: leaf.key,
            holder: spec.holder,
            openedDaysAgo: spec.openedDaysAgo,
            path: spec.path,
          }
        : null;
    }
    const spec = d.pick(OPEN_BOXES);
    return known.has(spec.catalogRow) ? spec : null;
  };

  // The typed vendor-dispatch cascades: a maintenance leaf instantiated as a
  // real flow case and walked like the relays — the leaf's letters threaded
  // through the walk, so the steps render its trade and urgency ("a HVAC
  // call, emergency priority"), never a literal {trade}.
  const dealDispatch = (d: Dice, door: WarDoor, back: number, k: number, leafKey: string) => {
    const tpl = opts.dispatch;
    if (!tpl) return;
    const leaf = findRow(opts.catalog, leafKey);
    const word = leafKey.slice(leafKey.indexOf('.') + 1).split('.').join(' ');
    const subject = `${warCase(word, door)} · d-${back} #${k}`;
    const age = Math.min(d.int(0, 12), back, oldestOpen);
    const at = daysAgo(end, age, d);
    // Stamp the door's address as the case's estate id, so the spend gate reads
    // this door's own cap (the money events already carry it — dealMoney).
    const instance = instantiateFlow(tpl, subject, { at, id, estateId: door.address }, leaf?.params);
    for (const e of instance.events) {
      if (e.kind === 'opened')
        e.note = `${e.note} The war horn sounds — a training muster, not a real call.`;
      events.push(e);
    }
    mark(word + ' cascades');
    // Walk the cascade: roughly one step per two days of age, no step worked
    // before game-now — the same rhythm the relays keep.
    let stepsWorked = Math.min(Math.floor(age / 2), tpl.steps.length - 1);
    let stepAt = at;
    for (let s = 0; s < stepsWorked; s++) {
      stepAt = daysAfter(stepAt, d.int(1, 3));
      if (Date.parse(stepAt) > Date.parse(end)) break;
      events.push({
        id: id(),
        at: stepAt,
        caseId: instance.caseId,
        kind: 'done',
        catalogRow: tpl.steps[s].catalogRow,
        holder: tpl.steps[s].holder,
        note: `Step ${s + 1}/${tpl.steps.length} · done — worked in the muster.`,
      });
      events.push(handStep(tpl, instance.caseId, s + 1, { at: stepAt, id }, leaf?.params));
    }
  };

  // The standing stream, 45 days deep: each day's quota of TYPED boxes,
  // scattered across doors, each walked as far as its age allows. A box is
  // drawn from the task-language's words — a maintenance leaf (a share of
  // those become full vendor-dispatch cascades, below) or one of the other
  // domains' rows — so the queues read in the new alphabet, never the old
  // untyped "work order".
  const perDay = opts.boxesPerDay ?? 10;
  for (let back = 45; back >= 0; back--) {
    for (let k = 0; k < perDay; k++) {
      const door = d.pick(doors);
      const spec = pickSpec(d, leaves);
      if (!spec) continue;
      if (d.chance(0.22) && opts.dispatch && spec.catalogRow.startsWith('maintenance.')) {
        dealDispatch(d, door, back, k, spec.catalogRow);
        continue;
      }
      const caseId = `${warCase(spec.box, door)} · d-${back} #${k}`;
      const age = Math.min(spec.openedDaysAgo(d), back, oldestOpen);
      const openedAt = daysAgo(end, age, d);
      events.push({
        id: id(),
        at: openedAt,
        caseId,
        kind: 'opened',
        holder: spec.holder,
        catalogRow: spec.catalogRow,
        note: `A ${spec.box} opens at the door. Owner: ${door.owner}.`,
      });
      mark(spec.box + 's');
      // Walk the path while the box is old enough to have reached each state.
      let at = openedAt;
      let remaining = age;
      for (const step of spec.path) {
        const stepAge = step.ageDays(d);
        if (remaining < stepAge) break;
        at = daysAfter(at, Math.max(1, remaining - stepAge));
        if (Date.parse(at) > Date.parse(end)) break;
        events.push({
          id: id(),
          at,
          caseId,
          kind: step.kind,
          holder: spec.holder,
          catalogRow: spec.catalogRow,
          note: step.tone,
        });
        remaining = stepAge;
      }
    }
  }

  // The relays: the war horn sounds on ~1 in 8 occupied doors. Each opens a
  // real flow case and is then WALKED forward as far as its age allows —
  // steps worked in template order — so the cascades stand at varied stages
  // of progress the moment the game loads. Events-only throughout: the walk
  // is the same `done`/hand the operator's own hands would append.
  const every = opts.moveOutEvery ?? 8;
  const occupied = doors.filter((x) => !vacant.has(x));
  for (let i = 0; i < occupied.length; i++) {
    if (i % every !== every - 1) continue;
    const door = occupied[i];
    const tenant = tenants.get(door.address) ?? tenantName(d);
    const subject = warCase('move-out', door) + ` — ${tenant}`;
    if (dealt?.relays.includes(subject)) continue;
    const triggerAge = Math.min(d.int(0, 30), oldestOpen);
    const at = daysAgo(end, triggerAge, d);
    const instance = instantiateFlow(opts.relay, subject, { at, id, estateId: door.address });
    for (const e of instance.events) {
      if (e.kind === 'opened')
        e.note = `${e.note} The war horn sounds — a training muster, not a real notice.`;
      events.push(e);
    }
    mark('move-out relays');
    // Walk the cascade: roughly one step per two days of age, no step worked
    // before game-now.
    let stepsWorked = Math.min(Math.floor(triggerAge / 2), opts.relay.steps.length - 1);
    let stepAt = at;
    for (let s = 0; s < stepsWorked; s++) {
      stepAt = daysAfter(stepAt, d.int(1, 3));
      if (Date.parse(stepAt) > Date.parse(end)) break;
      events.push({
        id: id(),
        at: stepAt,
        caseId: instance.caseId,
        kind: 'done',
        catalogRow: opts.relay.steps[s].catalogRow,
        holder: opts.relay.steps[s].holder,
        note: `Step ${s + 1}/${opts.relay.steps.length} · done — worked in the muster.`,
      });
      events.push(handStep(opts.relay, instance.caseId, s + 1, { at: stepAt, id }));
    }
  }

  // The raw intake stream — the untriaged tickets the Regent identifies.
  const intake = dealIntake({
    seed,
    end,
    d,
    doors,
    id,
    count: opts.intake ?? 18,
    maxAgeDays: oldestOpen,
  });
  for (const e of intake) events.push(e);
  if (intake.length) mark('raw intake', intake.length);

  // The pods — commission a couple of knights and place a share of the owners
  // (WRIT-THE-LAND, Phase 2); the rest stand unplaced, the allocation debt.
  const pods = dealPods({ seed, end, d, owners: doors.map((x) => x.owner), id });
  for (const e of pods) events.push(e);
  mark('knights', KNIGHT_NAMES.slice(0, 2).length);

  // The month's coin, from the same occupied doors the work is dealt on.
  const money = dealMoney({
    seed,
    end,
    d,
    occupied,
    economy: opts.economy ?? FOUNDING_ECONOMY,
    household: opts.household,
  });
  if (money.length) mark('money events', money.length);

  events.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  return { seed, now: end, doors, events, money, tally };
}

// ── The Grand Muster — the full operation from the loaded library ────────────
// Where generateWarGame deals the small founding slice (leases, maintenance,
// the one relay), the Grand Muster deals the WHOLE operation from a loaded
// setting (docs/LIBRARY-PM.md; the grand-muster Opus workflow): the 297-leaf
// catalog and all ~24 flow grammars, mapped to the kingdom's real seats. Every
// domain flows — repairs, leasing, collections, renewals, turns, inspections,
// compliance, owner accounting — walked to varied stages, so the queues, the
// consequence engine, and the coffers read a real ~200-door company the moment
// it loads. Events-only and gate-safe throughout: same seed, same world; every
// case bears the `wg/<seed>` mark, so Reset strikes exactly the muster.

/** A weight per flow, folded from the setting's plan (a domain's share split
 *  across its grammars), so maintenance out-deals onboarding as it should. */
function flowWeights(flows: FlowBook, plan: PlanEntry[]): Map<string, number> {
  const shareOf = new Map<string, number>();
  const domainOf = new Map<string, string>();
  for (const p of plan ?? []) {
    const share = Number.parseFloat(String(p.approxShare ?? '').replace('%', '')) || 5;
    shareOf.set(p.domain, share);
    const inDomain = (p.grammars ?? []).length || 1;
    for (const g of p.grammars ?? []) domainOf.set(g, p.domain);
    // stash per-domain count for the split below via a closure map
    p.__count = inDomain;
  }
  const countOf = new Map<string, number>((plan ?? []).map((p) => [p.domain, p.__count ?? 1]));
  const w = new Map<string, number>();
  for (const f of flows) {
    const dom = domainOf.get(f.key);
    const share = dom ? (shareOf.get(dom) ?? 5) : 5;
    const count = dom ? (countOf.get(dom) ?? 1) : 1;
    w.set(f.key, share / count);
  }
  return w;
}

interface PlanEntry {
  domain: string;
  approxShare?: string;
  grammars?: string[];
  __count?: number;
}

/** Deal the full operation. `flows` is the loaded book (all grammars),
 *  `catalog` the loaded leaves; `plan` weights the mix. Pure and seeded. */
export function generateGrandMuster(opts: {
  seed: string;
  end: string;
  flows: FlowBook;
  catalog: Catalog;
  plan?: PlanEntry[];
  doors?: number;
  /** Total flow instances to deal across the whole book (default ~520). */
  instances?: number;
  /** Raw untriaged intake to deal for the Regent's seat to identify. */
  intake?: number; // default 20
  /** The economy's chart + fee rules — the money-dimension folds its fees from
   *  it (docs/WRIT-ECONOMY.md). Defaults to the founding working-fluid chart. */
  economy?: EconomyBook;
  dealt?: DealtGame;
}): WarGame {
  const seed = opts.seed.trim() || 'the-grand-muster';
  const end = opts.end;
  const d = dice(seed);
  const doors = makeDoors(d, opts.doors ?? 200);
  const dealt = opts.dealt;
  const flows = opts.flows.filter((f) => f.steps.length > 0);

  const events: KingdomEvent[] = [];
  const tally: Record<string, number> = {};
  let n = 0;
  const id = () => `wg-${seed.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${++n}`;
  const mark = (k: string, by = 1) => {
    tally[k] = (tally[k] ?? 0) + by;
  };
  const warCase = (box: string, door: WarDoor) => `${WAR_MARK}${seed} · ${box} · ${door.address}`;

  // Leases settled — a good-standing lease is state, not open work.
  const vacant = new Set<WarDoor>();
  const tenants = new Map<string, string>();
  for (const door of doors) {
    if (d.chance(0.06)) {
      vacant.add(door);
      continue;
    }
    const tenant = tenantName(d);
    tenants.set(door.address, tenant);
    if (dealt?.tenants.has(door.address)) continue;
    const signedAt = daysAgo(end, d.int(90, 400), d);
    const caseId = warCase('lease', door) + ` — ${tenant}`;
    events.push({ id: id(), at: signedAt, caseId, kind: 'opened', holder: 'alys', note: `Lease signed — ${tenant} takes the door; rent due the 1st. Owner: ${door.owner}.` });
    events.push({ id: id(), at: signedAt, caseId, kind: 'done', holder: 'alys', note: `Lease settled at signing — ${tenant} holds the door in good standing.` });
    mark('leases');
  }
  const occupied = doors.filter((x) => !vacant.has(x));

  // The letters a flow's steps render from. A completing leaf's params seed it;
  // then every {token} the template actually uses gets a value — a readable
  // default where we know one, else the token's own word — so no literal
  // {token} ever leaks, in a maintenance leaf or a cadence flow alike.
  const TOKEN_WORDS: Record<string, string> = {
    trade: 'the trade', urgency: 'routine', amount: 'the cap', days: '30',
    rent: 'the rent', balance: 'the balance', fee: 'the fee', date: 'the date',
    unit: 'the unit', name: 'the tenant', increase: 'the increase', notice: 'the notice',
    term: 'the term', deposit: 'the deposit', reason: 'the reason', count: 'the count',
  };
  const paramsFor = (tpl: FlowTemplate): Record<string, string> => {
    const leaf = opts.catalog.find((r) => r.completes === tpl.key && r.params);
    const p: Record<string, string> = { ...(leaf?.params ?? {}) };
    for (const s of tpl.steps) {
      for (const src of [s.note, s.condition]) {
        if (!src) continue;
        for (const m of src.matchAll(/\{(\w+)\}/g)) {
          if (!(m[1] in p)) p[m[1]] = TOKEN_WORDS[m[1]] ?? m[1];
        }
      }
    }
    return p;
  };

  // A weighted pool of flow keys — draw from it so the mix reads like a real
  // book (maintenance-heavy, onboarding-light).
  const weights = flowWeights(flows, opts.plan ?? []);
  const pool: FlowTemplate[] = [];
  for (const f of flows) {
    const reps = Math.max(1, Math.round((weights.get(f.key) ?? 5)));
    for (let i = 0; i < reps; i++) pool.push(f);
  }
  if (pool.length === 0) pool.push(...flows);

  // Deal the instances: each a flow triggered on a door and walked to a varied
  // stage (roughly a step per two days of age), the leaf's params threaded so
  // the steps render their trade and urgency.
  const total = opts.instances ?? 520;
  for (let i = 0; i < total && occupied.length; i++) {
    const tpl = pool[d.int(0, pool.length - 1)];
    const door = occupied[d.int(0, occupied.length - 1)];
    const tenant = tenants.get(door.address) ?? tenantName(d);
    // The instance discriminator (#i) rides the BOX segment, so the address
    // segment stays clean — the consequence engine keys a Patron's doors on it
    // and must not see two doors where there is one.
    const subject = warCase(`${tpl.key} #${i}`, door) + ` — ${tenant}`;
    if (dealt?.relays.includes(subject)) continue;
    const params = paramsFor(tpl);
    const triggerAge = d.int(0, 40);
    const at = daysAgo(end, triggerAge, d);
    const instance = instantiateFlow(tpl, subject, { at, id, estateId: door.address }, params);
    for (const e of instance.events) {
      // Name the door's owner in the opening note — the consequence engine
      // reads "Owner: <name>." to fold this case's harm onto its Patron.
      if (e.kind === 'opened')
        e.note = `${e.note} The war horn sounds — a training muster, not a real notice. Owner: ${door.owner}.`;
      events.push(e);
    }
    mark(tpl.title);
    const stepsWorked = Math.min(Math.floor(triggerAge / 2), tpl.steps.length - 1);
    let stepAt = at;
    for (let s = 0; s < stepsWorked; s++) {
      stepAt = daysAfter(stepAt, d.int(1, 3));
      if (Date.parse(stepAt) > Date.parse(end)) break;
      events.push({ id: id(), at: stepAt, caseId: instance.caseId, kind: 'done', catalogRow: tpl.steps[s].catalogRow, holder: tpl.steps[s].holder, note: `Step ${s + 1}/${tpl.steps.length} · done — worked in the muster.` });
      events.push(handStep(tpl, instance.caseId, s + 1, { at: stepAt, id }, params));
    }
  }

  // The raw intake stream — untriaged tickets for the Regent's seat, dealt on
  // the occupied doors so their Patrons are known.
  const intake = dealIntake({
    seed,
    end,
    d,
    doors: occupied.length ? occupied : doors,
    id,
    count: opts.intake ?? 20,
  });
  for (const e of intake) events.push(e);
  if (intake.length) mark('raw intake', intake.length);

  // The pods — knights recruited, a share of owners placed, the rest unplaced.
  const pods = dealPods({ seed, end, d, owners: occupied.map((x) => x.owner), id });
  for (const e of pods) events.push(e);
  mark('knights', KNIGHT_NAMES.slice(0, 2).length);

  // The month's coin, from the same occupied doors the work is dealt on.
  const money = dealMoney({ seed, end, d, occupied, economy: opts.economy ?? FOUNDING_ECONOMY });
  if (money.length) mark('money events', money.length);

  events.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  return { seed, now: end, doors, events, money, tally };
}
