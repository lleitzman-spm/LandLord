// The Treasury: the kingdom's coin, kept the constitutional way — records
// in, readings out. Version one records upkeep: the recurring monthly cost
// of the kingdom's structure. The reading that matters to the mission is
// how much coin flows to artisans: foreign hands are not only a
// delegation debt, they are a priced one. See docs/KINGDOM.md.

import type { Kingdom, Person, Territory } from './types';
import type { EconomyBook, MoneyLog } from './economy';
import { balanceOf, feeAmount, feeRuleFor, readPostings } from './economy';

export interface Upkeep {
  id: string;
  /** What the coin is for: "Retainer", "Salary", "Software subscription". */
  label: string;
  /** Dollars per month. */
  monthly: number;
  /** The territory that bears the cost; absent = it weighs on the Crown. */
  territoryId?: string;
  /** Who receives the coin, when the coin has a face. */
  personId?: string;
  recordedOn: string;
}

export interface TreasuryLedger {
  upkeeps: Upkeep[];
}

export const EMPTY_TREASURY: TreasuryLedger = { upkeeps: [] };

export interface UpkeepLine {
  upkeep: Upkeep;
  /** null = the Crown bears it. */
  territory: Territory | null;
  person: Person | null;
  /** Coin leaving the walls: the recipient is a artisan. */
  toArtisan: boolean;
}

function toLine(kingdom: Kingdom, upkeep: Upkeep): UpkeepLine {
  const territory = upkeep.territoryId
    ? (kingdom.territories.find((t) => t.id === upkeep.territoryId) ?? null)
    : null;
  const person = upkeep.personId
    ? (kingdom.people.find((p) => p.id === upkeep.personId) ?? null)
    : null;
  return {
    upkeep,
    territory,
    person,
    toArtisan: person?.pledge === 'sellsword',
  };
}

/** Upkeep borne by any of the given territories (a fief and its hamlets). */
export function upkeepForTerritories(
  kingdom: Kingdom,
  ledger: TreasuryLedger,
  territoryIds: string[],
): UpkeepLine[] {
  const wanted = new Set(territoryIds);
  return ledger.upkeeps
    .filter((u) => u.territoryId != null && wanted.has(u.territoryId))
    .map((u) => toLine(kingdom, u));
}

/** Coin the treasury pays to one person. */
export function upkeepForPerson(
  kingdom: Kingdom,
  ledger: TreasuryLedger,
  personId: string,
): UpkeepLine[] {
  return ledger.upkeeps.filter((u) => u.personId === personId).map((u) => toLine(kingdom, u));
}

export function monthlyOf(lines: UpkeepLine[]): number {
  return lines.reduce((acc, l) => acc + l.upkeep.monthly, 0);
}

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function coin(amount: number): string {
  return usd.format(amount);
}

// ── The coffers — tribute against upkeep, the health bar ──────────────────
// The fail state of the consequence engine (docs/KINGDOM.md, "The task-
// language"; docs/WRIT-TASK-LANGUAGE.md, swing two 2c): every door a faithful
// Patron leaves in the Crown's keeping pays TRIBUTE (a working-fluid figure,
// never a firm's numbers — the leash), and the Treasury's upkeep already weighs
// on the other pan. Tribute against upkeep is the coffers' trend; a Patron
// who withdraws cuts their doors from the tribute, and when the trend runs
// below zero the kingdom FALLS. All of it is a reading — nothing is stored.

/** Working fluid: the RENT one door yields per month — the owner's money the
 *  knight collects on the land. A landlord collects rents, not taxes; this is
 *  the pod's rent roll (docs/WRIT-THE-LAND). The Crown's OWN coin is the
 *  management FEE (tribute) below — a slice of this rent, not the rent itself. */
export const RENT_PER_DOOR = 1500;

/** Working fluid: the Crown's management FEE per retained door per month — the
 *  bridge from the estate's rents to the Crown's coffers (docs/KINGDOM.md, "The
 *  economy"), roughly a slice of RENT_PER_DOOR. This is the health bar; the rent
 *  itself belongs to the owner and is collected by the knight. */
export const TRIBUTE_PER_DOOR = 120;

export interface Coffers {
  /** Retained doors paying tribute (withdrawn Patrons' doors drop out). */
  doors: number;
  /** Tribute in, per month — the retained doors × the working-fluid figure. */
  tributeMonthly: number;
  /** Upkeep out, per month — the Treasury's existing reading. */
  upkeepMonthly: number;
  /** The trend: tribute minus upkeep. Below zero, the month runs to the bad. */
  trend: number;
  /** The month runs RED — tribute does not cover upkeep. A warning, and the
   *  tone every gauge on the board wears. It is NOT the end of the kingdom:
   *  a company can run a bad month with a full bank. */
  fallen: boolean;
  /** The Crown's own coin is ACTUALLY GONE — operating cash at or below zero.
   *  This is the fail state, and it is a different fact from a red month.
   *
   *  They used to be one boolean (`fallen: trend < 0`), so a single bad month
   *  told the Regent "the coffers are dry — the kingdom falls" while the
   *  company still held its cash. The tell was dead code: the cartouche
   *  carried a "the month runs to the bad" wording that could never be
   *  reached, because the condition that would have shown it was the same
   *  condition that declared the kingdom fallen. Found by playing (2026-07-27)
   *  — the realm "fell" in week five of a fresh muster, every time, and
   *  nothing happened, which teaches the player to ignore the loudest thing on
   *  the board. Trust nothing but the coin itself. */
  dry: boolean;
}

// UNIFIED with the economy (docs/WRIT-ECONOMY.md, swing five): the coffers'
// two figures now come from the ECONOMY, not a hardcoded rate and a separate
// upkeep book — so the ribbon gauge, the Throne, the old Coin panel, and the
// new Counting-house all read ONE coffers. The retained-door DYNAMIC is
// preserved (tribute still falls as Patrons withdraw), which is what keeps the
// consequence engine's fail state reachable. The numbers are unchanged at the
// founding (TRIBUTE_PER_DOOR = 8% × RENT_PER_DOOR); the source is now the model.
export function readCoffers(
  retainedDoorCount: number,
  economy: EconomyBook,
  money: MoneyLog,
  fallbackLedger?: TreasuryLedger,
): Coffers {
  // Tribute per retained door = the management fee on one door's rent, from the
  // economy's own fee rule (a setting tunes it) — the single source of the rate.
  const mgmt = feeRuleFor(economy, 'management');
  const tributePerDoor = mgmt
    ? feeAmount(mgmt, Math.round(RENT_PER_DOOR * 100)) / 100
    : TRIBUTE_PER_DOOR;
  const tributeMonthly = retainedDoorCount * tributePerDoor;
  // Upkeep = the corporate book's monthly expense (the household folded in on
  // deploy, plus any recorded company cost) — the SAME upkeep the Counting-house
  // shows. No game standing (no money) falls back to the treasury's upkeep rolls,
  // so a hand-recorded upkeep still weighs on the coffers.
  // The standing MONTHLY cost is the upkeep book — that is what an upkeep line
  // is: a recurring rate. This used to prefer the sum of every `corp_expense`
  // in the money log, which is not a rate at all: the log holds the dealt month
  // AND every one-off a hand has recorded since. So recording a single $3,000
  // roof as a company expense made the ribbon announce a standing upkeep of
  // $4,200/mo, flip the coffers to "running red", and put the campaign's last
  // act permanently out of reach — while the Counting-house's own Upkeep card,
  // folded from this very book, went on correctly saying $1,200. Two gauges,
  // one fact, and the louder one was wrong. ("Deal a sample month" did the same
  // at $12,900 a press.) Found by an adversarial sweep, 2026-07-28.
  //
  // The money log is still the fallback, for a standing that carries coin but
  // no upkeep book — a hand-recorded cost must still weigh on the coffers.
  const booked = fallbackLedger?.upkeeps.reduce((n, u) => n + u.monthly, 0) ?? 0;
  const corpExpense =
    money.filter((m) => m.kind === 'corp_expense').reduce((n, m) => n + m.amountCents, 0) / 100;
  const upkeepMonthly = booked > 0 ? booked : corpExpense;
  const trend = tributeMonthly - upkeepMonthly;
  // The Crown's OWN coin: every CORPORATE bank account it actually holds.
  //
  // Three things this deliberately is not. Not the TRUST cash — that is the
  // owners' money and the Crown may never spend it, so a full trust account
  // says nothing about whether the kingdom can make payroll (the fiduciary
  // line, read as a game state). Not `due_from_trust` — a fee earned and not
  // yet swept is a receivable, and a company can be receivable-rich and still
  // unable to pay its people. And not the operating account ALONE: a dealt
  // muster holds −$56 in operating and +$1,512 in By-Pass, so reading one
  // account would have called a solvent Crown broke — the same lie in a new
  // costume. Every corporate account with a real bank behind it, summed, so a
  // setting that opens another one is counted without a code change.
  const corporateBanks = economy.accounts.filter(
    (a) => a.book === 'corporate' && a.type === 'asset' && a.bank != null,
  );
  const posts = money.length > 0 ? readPostings(money) : [];
  const crownCoin = corporateBanks.reduce((n, a) => n + balanceOf(economy, posts, a.role), 0);
  // Absent a money book there is nothing to be broke WITH — a bare census is
  // never dry, or the board would cry ruin before the game begins.
  const dry = money.length > 0 && crownCoin <= 0;
  return {
    doors: retainedDoorCount,
    tributeMonthly,
    upkeepMonthly,
    trend,
    fallen: trend < 0,
    dry,
  };
}

// ── The household — the Crown's upkeep, working fluid ───────────────────────
// The coffers have no teeth with $0 upkeep (tribute − 0 never runs red). This
// is the company's real standing cost — salaries for the seats, the tools, the
// hall — loaded WITH a War Game so tribute-vs-upkeep can actually fall red when
// neglect costs the Crown its Patrons (docs/KINGDOM.md, "The economy"). Working
// fluid, not a firm's payroll (that loads at the gate); game-scoped (the store
// loads it on deploy, strikes it on Reset). ~$18k/mo against ~$22k full tribute,
// so a solvent operation clears it and a neglected one drowns.
// The three seated lines name the CROWN OFFICES they are paid to hold. They
// used to name `property-management` / `maintenance` / `leasing` — territories
// the Brokerage refounding dissolved (docs/WRIT-THE-BROKERAGE.md) — so
// `upkeepForTerritories` matched nothing and $12,400/mo of the $18,200
// household appeared on no keep's Upkeep card and read on a person's page as
// borne by "the Crown". A stored id and a founding constant disagreeing after a
// rename, which is the fault this kingdom keeps re-learning. (Audit,
// 2026-07-27.) The coffers were never wrong — `readCoffers` prefers the dealt
// `corp_expense` — but the money showed up nowhere it could be reasoned about.
export const WAR_HOUSEHOLD: Upkeep[] = [
  { id: 'wg-household-alys', label: 'Chancellor Alys — the Chancery', monthly: 4800, personId: 'alys', territoryId: 'office-chancery', recordedOn: '2026-07-20' },
  { id: 'wg-household-mabel', label: 'Chancellor Mabel — the Office of Works', monthly: 3800, personId: 'mabel', territoryId: 'office-works', recordedOn: '2026-07-20' },
  { id: 'wg-household-osric', label: 'Chancellor Osric — the Office of Tenancy', monthly: 3800, personId: 'osric', territoryId: 'office-tenancy', recordedOn: '2026-07-20' },
  { id: 'wg-household-piers', label: 'Piers — the Regent’s squire', monthly: 2200, personId: 'piers', recordedOn: '2026-07-20' },
  { id: 'wg-household-tools', label: 'The counting-house tools (subscriptions & sundry)', monthly: 1400, recordedOn: '2026-07-20' },
  { id: 'wg-household-hall', label: 'The hall and its keeping (office, dues, retainers)', monthly: 2200, recordedOn: '2026-07-20' },
];

/** True for a household upkeep line the War Game loads — so Reset strikes
 *  exactly these and leaves any hand-recorded upkeep standing. */
export function isHouseholdUpkeep(u: Upkeep): boolean {
  return u.id.startsWith('wg-household-');
}
