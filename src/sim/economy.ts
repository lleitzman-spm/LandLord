/** OWNER: sim-people agent. Coffers, ledger, market rent, wages, upkeep, gifts and feasts. */
import type {
  GameState, SimModule, Building, IncomeCat, ExpenseCat, MonthBook, Id, Txn, ActionResult, Tenant,
} from './types';
import { BUILDINGS } from '../data/buildings';
import { BAL } from '../data/balance';
import { RANKS } from '../data/ranks';
import { clamp, emit, herald, monthIndexOf, rulerTitle, monthName } from './core';
import { desirability } from './world';
import { changeHappiness, addMemory, housed } from './tenants';
import { changeRenown } from './renown';

export const TUNE = {
  /** months of books kept */
  monthsKept: 48,
  /** transactions kept */
  txnsKept: 240,
  /** market rent rises this much per housed household (a busier realm is worth more), capped */
  growthPerHousehold: 0.004,
  growthCap: 0.2,
  /** asking rent may be set between 1 crown and this multiple of the base rent */
  maxAskMult: 5,
  feastHappiness: 8,
  feastRenown: 3,
  feastEveryDays: 180,
  /** a second gift inside this many days is worth half */
  giftFadeDays: 20,
};

/** Building flag: the asking rent was set by the ruler's own word, and holds until the next lease is signed there. */
export const ASK_BY_HAND = 'askByHand';

// ───────────── books ─────────────

function blankBook(index: number, gold: number): MonthBook {
  return {
    index,
    income: { rent: 0, fees: 0, deposits_kept: 0, windfall: 0, loan: 0 },
    expense: {
      construction: 0, repairs: 0, wages: 0, upkeep: 0, tribute: 0, interest: 0, deposits_returned: 0,
      bribes: 0, gifts: 0, court: 0, land: 0, loan_repaid: 0, other: 0,
    },
    closing: gold, rentDue: 0, rentCollected: 0,
  };
}

/** This month's (open) book. */
export function currentBook(s: GameState): MonthBook {
  const idx = monthIndexOf(s.day);
  const months = s.ledger.months;
  let b = months[months.length - 1];
  if (!b || b.index !== idx) {
    b = blankBook(idx, s.gold);
    months.push(b);
    if (months.length > TUNE.monthsKept) months.splice(0, months.length - TUNE.monthsKept);
  }
  return b;
}

function logTxn(s: GameState, amount: number, cat: IncomeCat | ExpenseCat, memo: string, refs?: { buildingId?: Id; tenantId?: Id }): void {
  const t: Txn = { day: s.day, amount, cat, memo };
  if (refs?.tenantId) t.tenantId = refs.tenantId;
  if (refs?.buildingId) t.buildingId = refs.buildingId;
  const txns = s.ledger.txns;
  txns.push(t);
  if (txns.length > TUNE.txnsKept) txns.splice(0, txns.length - TUNE.txnsKept);
}

const INCOME_MEMO: Record<IncomeCat, string> = {
  rent: 'Rent', fees: 'Late fees', deposits_kept: 'Surety held', windfall: 'Windfall', loan: 'From the moneylender',
};
const EXPENSE_MEMO: Record<ExpenseCat, string> = {
  construction: 'Building', repairs: 'Repairs', wages: 'Wages', upkeep: 'Upkeep', tribute: 'Tribute to the Crown',
  interest: 'Interest', deposits_returned: 'Surety returned', bribes: 'Coin for quiet', gifts: 'Gifts',
  court: "The Reeve's Court", land: 'Land', loan_repaid: 'To the moneylender', other: 'Sundries',
};

function whole(amount: number): number {
  return Number.isFinite(amount) ? Math.round(amount) : 0;
}

/** Add to the coffers, book it, emit {type:'gold'}. */
export function earn(s: GameState, amount: number, cat: IncomeCat, memo?: string, refs?: { buildingId?: Id; tenantId?: Id }): void {
  const a = whole(amount);
  if (a <= 0) return;
  s.gold += a;
  const book = currentBook(s);
  book.income[cat] = (book.income[cat] ?? 0) + a;
  if (cat === 'rent') {
    book.rentCollected += a;
    s.stats.rentCollected += a;
  }
  book.closing = s.gold;
  logTxn(s, a, cat, memo || INCOME_MEMO[cat] || 'Income', refs);
  emit(s, { type: 'gold', amount: a, cat, ...(refs?.buildingId ? { buildingId: refs.buildingId } : {}), ...(refs?.tenantId ? { tenantId: refs.tenantId } : {}) });
}

/** Take from the coffers (may go negative; modes.ts deals with debt), book it, emit {type:'gold'} (negative amount). */
export function spend(s: GameState, amount: number, cat: ExpenseCat, memo?: string, refs?: { buildingId?: Id; tenantId?: Id }): void {
  const a = whole(amount);
  if (a <= 0) return;
  s.gold -= a;
  const book = currentBook(s);
  book.expense[cat] = (book.expense[cat] ?? 0) + a;
  book.closing = s.gold;
  logTxn(s, -a, cat, memo || EXPENSE_MEMO[cat] || 'Expense', refs);
  emit(s, { type: 'gold', amount: -a, cat, ...(refs?.buildingId ? { buildingId: refs.buildingId } : {}), ...(refs?.tenantId ? { tenantId: refs.tenantId } : {}) });
}

export function canAfford(s: GameState, amount: number): boolean { return s.gold >= amount; }

// ───────────── rents ─────────────

function safeDesirability(s: GameState, b: Building): number {
  const d = desirability(s, b);
  return Number.isFinite(d) ? clamp(d, 0, 100) : 50;
}

/** What a unit in this building would fetch from a typical applicant right now. */
export function marketRent(s: GameState, b: Building): number {
  const def = BUILDINGS[b.type];
  if (!def || def.baseRent <= 0) return 0;
  const des = safeDesirability(s, b);
  const cond = Number.isFinite(b.condition) ? clamp(b.condition, 0, 100) : 100;
  let households = 0;
  for (const id in s.tenants) if (s.tenants[id]!.status === 'housed') households++;
  const growth = 1 + Math.min(TUNE.growthCap, households * TUNE.growthPerHousehold);
  const r = def.baseRent * (0.6 + 0.8 * des / 100) * (0.7 + 0.3 * cond / 100) * growth;
  return Math.max(1, Math.round(r));
}

/** Highest asking rent the clerk will write on the board for this building. */
export function maxAskingRent(b: Building): number {
  return Math.max(1, Math.round((BUILDINGS[b.type]?.baseRent ?? 0) * TUNE.maxAskMult));
}

/** Sum of all current lease rents per month. */
export function rentRoll(s: GameState): number {
  let r = 0;
  for (const t of Object.values(s.tenants)) if (t.status === 'housed' && t.lease) r += t.lease.rent;
  return r;
}

/** Total of sureties held against housed and lately departed households (owed back unless kept). */
export function suretiesHeld(s: GameState): number {
  let d = 0;
  for (const t of Object.values(s.tenants)) if (t.lease) d += t.lease.deposit;
  return d;
}

export function monthlyWages(s: GameState): number {
  let w = 0;
  for (const m of Object.values(s.staff)) w += Math.max(0, whole(m.wage));
  return w;
}

export function monthlyUpkeep(s: GameState): number {
  let u = 0;
  for (const b of Object.values(s.buildings)) if (b.state === 'ready') u += BUILDINGS[b.type]?.upkeep ?? 0;
  return u;
}

/** Wages + upkeep + tribute share + loan interest per month. */
export function monthlyOutgoings(s: GameState): number {
  const tribute = (RANKS[s.realm.rank]?.tribute ?? 0) / 3;
  let interest = 0;
  for (const l of s.loans) interest += l.principal * l.ratePctMonth / 100;
  return Math.round(monthlyWages(s) + monthlyUpkeep(s) + tribute + interest);
}

// ───────────── feasts ─────────────

/** Day of the last feast, or null if there has never been one. (Stored in s.flags.lastFeastDay.) */
export function lastFeastDay(s: GameState): number | null {
  const v = s.flags.lastFeastDay;
  return typeof v === 'number' ? v : null;
}
/** Whole days until another feast may be held (0 = now). */
export function feastWaitDays(s: GameState): number {
  const last = lastFeastDay(s);
  if (last === null) return 0;
  return Math.max(0, Math.ceil(last + TUNE.feastEveryDays - s.day));
}
export function feastCost(s: GameState): number { return BAL.feastCost[s.realm.rank] ?? 30; }

// ───────────── handlers ─────────────

function refuse(code: Extract<ActionResult, { ok: false }>['code'], reason: string): ActionResult {
  return { ok: false, code, reason };
}

function setRent(s: GameState, buildingId: Id, rent: number): ActionResult {
  const b = s.buildings[buildingId];
  if (!b) return refuse('not_found', 'There is no such building on the rolls.');
  const def = BUILDINGS[b.type];
  if (!def || def.units <= 0) return refuse('invalid', `Nobody pays rent to live in a ${def ? def.name.toLowerCase() : 'thing like that'}, ${rulerTitle(s)}.`);
  if (!Number.isFinite(rent)) return refuse('invalid', 'That is not a number the clerk can write down.');
  const r = Math.round(rent);
  if (r < 1) return refuse('invalid', 'The rent must be at least one crown. Less than that is called charity.');
  const max = maxAskingRent(b);
  if (r > max) return refuse('invalid', `${r} crowns for ${b.name}? The board will not hold a number above ${max}, ${rulerTitle(s)}. It has its pride.`);
  if (b.rent !== r) {
    b.rent = r;
    emit(s, { type: 'sfx', id: 'quill', buildingId: b.id });
  }
  // the ruler's own figure stands on the board until the place is let: a Steward does not chalk over it
  b.flags[ASK_BY_HAND] = true;
  return { ok: true, id: b.id };
}

function recentGiftTo(s: GameState, tenantId: Id): boolean {
  const txns = s.ledger.txns;
  for (let i = txns.length - 1; i >= 0; i--) {
    const x = txns[i]!;
    if (s.day - x.day > TUNE.giftFadeDays) break;
    if (x.cat === 'gifts' && x.tenantId === tenantId) return true;
  }
  return false;
}

function crowns(n: number): string { return n === 1 ? '1 crown' : `${n} crowns`; }

function gift(s: GameState, tenantId: Id, amount: number): ActionResult {
  const t: Tenant | undefined = s.tenants[tenantId];
  if (!t || t.status !== 'housed') return refuse('not_found', 'No such household lives under your roofs.');
  if (!Number.isFinite(amount) || Math.round(amount) < 1) return refuse('invalid', 'A gift of nothing is called a visit.');
  const a = Math.round(amount);
  if (!canAfford(s, a)) return refuse('no_gold', `The coffers hold but ${crowns(Math.max(0, Math.floor(s.gold)))}, ${rulerTitle(s)}.`);
  const again = recentGiftTo(s, t.id);
  spend(s, a, 'gifts', `A gift to ${t.name}`, { tenantId: t.id, ...(t.buildingId ? { buildingId: t.buildingId } : {}) });
  const rent = Math.max(1, t.lease?.rent ?? 8);
  let lift = clamp(Math.round(3 + 15 * a / rent), 3, 24);
  if (again) lift = Math.max(2, Math.round(lift / 2));
  if (t.traits.includes('proud')) lift = Math.max(1, Math.round(lift * 0.6));
  changeHappiness(s, t.id, lift, 'gift');
  const big = a >= rent;
  addMemory(s, t.id, big ? `You gave them ${crowns(a)}, a month's rent or better, and asked nothing for it.` : `You gave them ${crowns(a)}, unasked.`, big ? 2 : 1);
  if (big && !again) changeRenown(s, 1, 'gift');
  emit(s, { type: 'emote', emote: 'love', tenantId: t.id, ...(t.buildingId ? { buildingId: t.buildingId } : {}) });
  herald(s, 'good', t.traits.includes('proud')
    ? `You pressed ${crowns(a)} on ${t.name}. ${t.first} took it as a loan, to be clear, and will say so at the well.`
    : `You pressed ${crowns(a)} on ${t.name}. ${t.first} counted it twice and then said thank you.`,
  { tenantId: t.id, ...(t.buildingId ? { buildingId: t.buildingId } : {}) });
  return { ok: true, id: t.id };
}

function holdFeast(s: GameState): ActionResult {
  const wait = feastWaitDays(s);
  if (wait > 0) {
    return refuse('busy', `The last feast is still being digested, ${rulerTitle(s)}. Ask again in ${monthName(s.day + wait)}.`);
  }
  const cost = feastCost(s);
  if (!canAfford(s, cost)) return refuse('no_gold', `A feast costs ${crowns(cost)}, ${rulerTitle(s)}, and the coffers hold ${Math.max(0, Math.floor(s.gold))}. The realm cannot dine on intentions.`);
  spend(s, cost, 'gifts', 'A feast for the realm');
  s.flags.lastFeastDay = s.day;
  const guests = housed(s);
  for (const t of guests) {
    changeHappiness(s, t.id, TUNE.feastHappiness, 'feast');
    addMemory(s, t.id, 'You held a feast and sat everyone at the same table.', 1);
  }
  changeRenown(s, TUNE.feastRenown, 'feast');
  emit(s, { type: 'sfx', id: 'cheer' });
  for (const t of guests.slice(0, 8)) emit(s, { type: 'emote', emote: 'cheer', tenantId: t.id, ...(t.buildingId ? { buildingId: t.buildingId } : {}) });
  herald(s, 'good', guests.length
    ? `A feast was held for ${s.realm.name || 'the realm'}. ${guests.length === 1 ? 'The one household' : `All ${guests.length} households`} came, ate for two, and spoke well of you until the ale ran out.`
    : `A feast was held for ${s.realm.name || 'the realm'}. Nobody lives here, so you ate alone, at length.`);
  return { ok: true };
}

// ───────────── module ─────────────

/** A Steward keeps the boards of vacant units priced to the policy (askPct of market). */
function stewardPricesVacancies(s: GameState): void {
  let steward = false;
  for (const m of Object.values(s.staff)) if (m.role === 'steward') { steward = true; break; }
  if (!steward) return;
  const pct = clamp(Number.isFinite(s.policies.askPct) ? s.policies.askPct : 100, 50, 200);
  for (const b of Object.values(s.buildings)) {
    if (b.state !== 'ready' || b.units.length === 0 || b.flags[ASK_BY_HAND]) continue;
    if (!b.units.some(u => !u.tenantId)) continue;
    const want = clamp(Math.round(marketRent(s, b) * pct / 100), 1, maxAskingRent(b));
    if (want !== b.rent) b.rent = want;
  }
}

export const economyModule: SimModule = {
  name: 'economy',

  init(s) {
    s.gold = BAL.startGold;
    s.ledger.months = [];
    s.ledger.txns = [];
    currentBook(s);
  },

  onMonth(s) {
    // close the month that has just ended
    const months = s.ledger.months;
    const last = months[months.length - 1];
    if (last && last.index !== monthIndexOf(s.day)) last.closing = s.gold;
    currentBook(s);

    const wages = monthlyWages(s);
    if (wages > 0) {
      const n = Object.keys(s.staff).length;
      spend(s, wages, 'wages', n === 1 ? 'Wages for your delegate' : `Wages for ${n} delegates`);
    }
    const upkeep = monthlyUpkeep(s);
    if (upkeep > 0) spend(s, upkeep, 'upkeep', 'Upkeep of the realm');

    stewardPricesVacancies(s);

    const roll = rentRoll(s);
    if (roll > s.stats.peakRentRoll) s.stats.peakRentRoll = roll;
  },

  onDay(s) {
    // keep the peak honest between Rent Days (new leases sign mid-month)
    const roll = rentRoll(s);
    if (roll > s.stats.peakRentRoll) s.stats.peakRentRoll = roll;
  },

  handlers: {
    set_rent: (s, a) => setRent(s, a.buildingId, a.rent),
    gift: (s, a) => gift(s, a.tenantId, a.amount),
    hold_feast: (s) => holdFeast(s),
  },
};
