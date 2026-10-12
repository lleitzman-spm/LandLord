/** OWNER: sim-people agent. Rent Day, purses, the late-rent pipeline, court, eviction, renewals, deposits. */
import type { GameState, SimModule, Id, DecisionOption, Tenant, Building, Job, MoveOutReason, Applicant } from './types';
import type { SquatterKind } from '../data/ids';
import { SQUATTER_KINDS } from '../data/ids';
import { BUILDINGS } from '../data/buildings';
import { BAL } from '../data/balance';
import { TRAIT_DEFS } from '../data/traits';
import { INCIDENT_BY_ID } from '../data/incidents/index';
import { clamp, emit, herald, chance, weighted, dist, seasonOf, rulerTitle } from './core';
import { earn, spend, marketRent, currentBook } from './economy';
import { changeRenown } from './renown';
import {
  auxOf, housed, moveOut, moveIn, changeHappiness, addMemory, neighborsOf, decisionPending, dismissApplicant,
  sayLine, hiddenTraits, leaseEndDay, traitTotal, tenantsOf, applicantFor, clerkLine,
} from './tenants';
import { spawnDecision } from './incidents';
import { enqueueJob } from './jobs';
import { staffOf } from './staff';
import { damageBuilding, setSquatters } from './buildings';
import { entranceOf } from './world';

export const TUNE = {
  /** days after a showing an applicant will wait for an answer */
  answerDays: 9,
  screenFee: 3,
  /** share of income a household can scrape together toward old debts in a month */
  catchUpShare: 0.2,
  /** daily chance (times reliability) that a household in grace turns up with the rent after all */
  graceCure: 0.12,
  /** daily chance that a household never home on Rent Day (the "ghost" quirk) turns up with the rent after all */
  ghostCure: 0.45,
  /** daily chance (times reliability) that a late household pays unprompted */
  lateCure: 0.04,
  waitDays: 7,
  waitCure: 0.1,
  feeCure: 0.3,
  noticeCure: 0.12,
  courtCure: 0.015,
  /** days a Notice to Quit hangs on the door before the court takes the matter up */
  noticeDays: 7,
  litigiousCourtDays: 15,
  planMonths: 3,
  mercyMonths: 6,
  /** coin for keys, in months of rent (never less than 6 crowns) */
  keysMonths: 1.5,
  evictRenown: -2,
  evictNeighbors: -3,
  /** days after the lease ends before it simply carries on, if nobody rules */
  renewalDriftDays: 20,
  /** crowns of damage per point of wear, as a share of what the building cost */
  damagePerPoint: 1 / 250,
  /** a departing household's wear never takes a building below this condition */
  wearFloor: 6,
  inspectWaitDays: 6,
  depositWaitDays: 14,
  squatterAfterDays: 40,
  squatterChanceListed: 0.012,
  squatterChanceUnlisted: 0.04,
  /** a listed vacancy shown to someone within this many days draws no squatters */
  shownKeepsDays: 20,
  /** squatters nobody has dealt with are put before the ruler again this often */
  squatterAgainDays: 30,
  stocksRadius: 5,
  stocksBoost: 0.08,
  /** a purse somebody has been sent for (or that is on the Bailiff's round) waits this many times longer */
  purseStretch: 2,
};

const crowns = (n: number): string => (n === 1 ? '1 crown' : `${n} crowns`);
const refsOf = (t: Tenant): { tenantId: Id; buildingId?: Id } => {
  const where = t.buildingId ?? auxOf(t).home;
  return where ? { tenantId: t.id, buildingId: where } : { tenantId: t.id };
};
const homeOf = (s: GameState, t: Tenant): Building | undefined => (t.buildingId ? s.buildings[t.buildingId] : undefined);
const dom0 = (s: GameState): number => Math.floor(s.day) % 30;
const graceDays = (s: GameState): number => clamp(Math.round(Number.isFinite(s.policies.graceDays) ? s.policies.graceDays : 3), 0, 20);

function doorOf(s: GameState, b: Building): [number, number] {
  const e = entranceOf(s, b);
  return e && Number.isFinite(e[0]) && Number.isFinite(e[1]) ? e : [b.x + b.w / 2, b.y + b.h + 0.5];
}
function liveJob(s: GameState, kind: Job['kind'], match: (j: Job) => boolean): Job | null {
  for (const j of Object.values(s.jobs)) if (j.kind === kind && j.state !== 'done' && j.state !== 'cancelled' && match(j)) return j;
  return null;
}

// ───────────── paying ─────────────

/** With a Steward and a ready Counting House the rent comes to the ruler's door; otherwise it waits in a purse. */
export function paysDirect(s: GameState): boolean {
  if (!staffOf(s, 'steward')) return false;
  for (const b of Object.values(s.buildings)) if (b.type === 'counting_house' && b.state === 'ready') return true;
  return false;
}

function stocksNear(s: GameState, b: Building): boolean {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  for (const o of Object.values(s.buildings)) {
    if (o.type === 'stocks' && o.state === 'ready' && dist(o.x + o.w / 2, o.y + o.h / 2, cx, cy) <= TUNE.stocksRadius) return true;
  }
  return false;
}

/** Chance this household has the rent ready on its pay day. */
export function payChance(s: GameState, t: Tenant): number {
  if (!t.lease || !(t.reliability > 0)) return 0;      // a household with no reliability at all never has it
  if (t.traits.includes('ghost')) return 0;            // never home on Rent Day; turns up with it later
  let p = Number.isFinite(t.reliability) ? t.reliability : 0.78;
  p += (t.happiness - 50) * 0.003;
  p -= Math.max(0, t.lease.rent / Math.max(1, t.income) - 0.35) * 0.9;
  if (t.arrears > 0) p -= 0.1;
  if (seasonOf(s.day) === 'winter') p -= 0.03;
  const b = homeOf(s, t);
  if (b && stocksNear(s, b)) p += TUNE.stocksBoost;
  if (t.lateStage === 'writ') return 0;                // the court has ruled: what coin they have is for the cart
  if (t.lateStage === 'late') p *= 0.5;
  else if (t.lateStage === 'noticed' || t.lateStage === 'court') p *= auxOf(t).cause ? 0.15 : 0.6;
  return clamp(p, 0.02, 1);
}

function receive(s: GameState, t: Tenant, b: Building, amount: number, fees: number): void {
  const fee = clamp(Math.round(fees), 0, amount);
  if (amount - fee > 0) earn(s, amount - fee, 'rent', `Rent, ${b.name}`, { tenantId: t.id, buildingId: b.id });
  if (fee > 0) earn(s, fee, 'fees', `Late fee, ${t.name}`, { tenantId: t.id, buildingId: b.id });
  emit(s, { type: 'rent_paid', tenantId: t.id, buildingId: b.id, amount });
}

function handOver(s: GameState, t: Tenant, amount: number, fees: number): void {
  const b = homeOf(s, t);
  const u = b?.units[t.unit];
  if (!b || !u || amount <= 0) return;
  if (paysDirect(s)) { receive(s, t, b, amount, fees); return; }
  if (u.purse <= 0) u.purseDay = s.day;
  u.purse += amount;
  auxOf(t).purseFees += fees;
  emit(s, { type: 'purse', buildingId: b.id, unit: t.unit, amount: u.purse });
  nextOnTheRound(s);
}

/**
 * With a Bailiff on the roll nobody has to be told: the purses are fetched. The Bailiff is given one door at a
 * time, the nearest purse to wherever the last one was bagged, so the round sweeps the lanes once instead of
 * doubling back for every household that paid a day later. Purses the ruler has already sent someone for
 * (collect_purse / collect_all) are left to that errand.
 */
function nextOnTheRound(s: GameState, from?: [number, number]): void {
  const bailiff = staffOf(s, 'bailiff');
  if (!bailiff) return;
  const spoken: Record<string, true> = {};
  for (const j of Object.values(s.jobs)) {
    if (j.kind !== 'collect' || j.state === 'done' || j.state === 'cancelled' || !j.buildingId) continue;
    if (!j.byRuler) return;                         // the Bailiff already has a door to go to
    spoken[j.buildingId + ':' + (j.unit ?? '*')] = true;
  }
  const figure = bailiff.actorId ? s.actors[bailiff.actorId] : undefined;
  const fx = from ? from[0] : figure ? figure.x : NaN, fy = from ? from[1] : figure ? figure.y : NaN;
  let best: { b: Building; unit: number; x: number; y: number } | null = null, bestD = Infinity;
  for (const b of Object.values(s.buildings)) {
    if (spoken[b.id + ':*']) continue;
    for (let i = 0; i < b.units.length; i++) {
      const u = b.units[i]!;
      if (u.purse <= 0 || spoken[b.id + ':' + i]) continue;
      const [x, y] = doorOf(s, b);
      const d = Number.isFinite(fx) && Number.isFinite(fy) ? dist(fx, fy, x, y) : 0;
      if (d < bestD - 1e-9) { best = { b, unit: i, x, y }; bestD = d; }
    }
  }
  if (!best) return;
  enqueueJob(s, {
    kind: 'collect', role: 'bailiff', buildingId: best.b.id, unit: best.unit, tenantId: best.b.units[best.unit]!.tenantId,
    x: best.x, y: best.y, workDays: 0.1, priority: 3,
  });
}

function clearCase(t: Tenant): void {
  const aux = auxOf(t);
  t.lateStage = aux.due > 0 ? 'grace' : 'none';
  t.daysLate = 0; t.courtDay = null; t.plan = null;
  aux.noticeDay = -1; aux.urgeUntil = -1; aux.fees = 0; aux.cause = 0;
}

/** Is the ruler (or a delegate) still to rule on this household's late rent? */
function rulingAwaited(s: GameState, t: Tenant): boolean {
  return t.lateStage === 'late' && decisionPending(s, 'late_rent', { tenantId: t.id });
}

/**
 * The household pays what it can: this month's rent if it is outstanding, and something toward old debts
 * (arrears are always paid down first). `all` = they have found the whole of what they owe.
 * While a ruling on their arrears is awaited they pay the new month only: the old debt is the ruler's to settle.
 */
function payNow(s: GameState, t: Tenant, all: boolean): number {
  if (!t.lease) return 0;
  const aux = auxOf(t);
  const wasInCourt = t.lateStage === 'noticed' || t.lateStage === 'court' || t.lateStage === 'writ';
  const wasLate = wasInCourt || t.lateStage === 'late';
  const due = Math.max(0, aux.due);
  let toward = 0;
  if (t.arrears > 0 && !(!all && rulingAwaited(s, t))) {
    if (all) toward = t.arrears;
    else if (t.plan) toward = Math.min(t.arrears, t.plan.each);
    else toward = Math.min(t.arrears, Math.max(1, Math.round(t.income * TUNE.catchUpShare)));
  }
  const total = due + toward;
  if (total <= 0) return 0;
  const feePart = Math.min(aux.fees, toward);
  aux.fees -= feePart;
  t.arrears -= toward;
  aux.due = 0; aux.payDay = -1;
  if (t.plan && toward > 0) {
    t.plan.left -= 1;
    if (t.arrears <= 0) t.plan = null;
    else if (t.plan.left <= 0) {
      // more was put on the account after the plan was drawn (a repair billed to them, a purse left to spoil):
      // the plan runs on until the whole is paid, rather than ending with the debt standing and nobody asking
      const each = Math.max(1, t.plan.each, Math.round((Number.isFinite(t.income) ? t.income : 0) * TUNE.catchUpShare));
      t.plan = { left: Math.max(1, Math.ceil(t.arrears / each)), each };
      herald(s, 'info', `${t.name} has paid the last instalment, but more went on the account since. ${crowns(t.arrears)} still stand; the plan runs on at ${Math.min(each, t.arrears)} a month.`, refsOf(t));
    }
  }
  if (t.arrears <= 0 && wasInCourt && !aux.cause) {
    t.arrears = 0;                                       // the notice was never about money: paying does not lift it
  } else if (t.arrears <= 0) {
    t.arrears = 0;
    const b = homeOf(s, t);
    if (wasInCourt) herald(s, 'good', `${t.name} paid everything owed on the steps of the Reeve's Court. The matter is closed. The court looks disappointed.`, refsOf(t));
    else if (wasLate) {
      const at = b ? ` at ${b.name}` : '';
      herald(s, 'good', clerkLine(s, t.portraitSeed, [
        `${t.name} has paid what was owed${at}, in full, with a look.`,
        `${t.name} has settled up${at}. Every crown of it, and not one word.`,
        `The arrears${at} are paid. ${t.first} counted them out slowly, so that you could watch.`,
      ]), refsOf(t));
    }
    else if (t.lateStage === 'plan') herald(s, 'good', `${t.name} has paid off the last of the arrears. The plan worked, to the surprise of both parties.`, refsOf(t));
    clearCase(t);
  } else if (t.lateStage === 'grace' || t.lateStage === 'none') {
    t.lateStage = t.plan ? 'plan' : 'none';
  } else if (t.lateStage === 'plan' && !t.plan) {
    t.lateStage = 'none';
  }
  handOver(s, t, total, feePart);
  return total;
}

/** Take the purse at a door into the coffers. Returns the crowns collected. */
export function collectPurse(s: GameState, buildingId: Id, unit: number, byActor: Id | null = null): number {
  const b = s.buildings[buildingId];
  const u = b?.units[unit];
  if (!b || !u || u.purse <= 0) return 0;
  const amount = u.purse;
  u.purse = 0;
  const t = u.tenantId ? s.tenants[u.tenantId] : undefined;
  if (t) {
    const aux = auxOf(t);
    const fees = aux.purseFees;
    aux.purseFees = 0;
    receive(s, t, b, amount, fees);
  } else {
    earn(s, amount, 'rent', `Rent, ${b.name}`, { buildingId: b.id });
  }
  emit(s, { type: 'purse_collected', buildingId: b.id, unit, amount, byActor });
  return amount;
}

function stalePurses(s: GameState): void {
  // a household will watch its purse sit for BAL.purseDays; longer if it can see that someone is on the way
  const round = !!staffOf(s, 'bailiff');
  for (const b of Object.values(s.buildings)) {
    for (let i = 0; i < b.units.length; i++) {
      const u = b.units[i]!;
      if (u.purse <= 0 || s.day - u.purseDay < BAL.purseDays) continue;
      const awaited = round || !!liveJob(s, 'collect', j => j.buildingId === b.id && (j.unit === null || j.unit === i));
      if (awaited && s.day - u.purseDay < BAL.purseDays * TUNE.purseStretch) continue;
      const t = u.tenantId ? s.tenants[u.tenantId] : undefined;
      const amount = u.purse;
      const sat = Math.max(1, Math.round(s.day - u.purseDay));
      u.purse = 0;
      emit(s, { type: 'building_changed', buildingId: b.id });
      if (!t) continue;
      const aux = auxOf(t);
      // their rent, left on the step: owed again, and not their doing
      t.arrears += amount;
      aux.fees += aux.purseFees; aux.purseFees = 0;
      aux.noFaultDay = s.day;
      addMemory(s, t.id, `You left their rent on the step for ${sat} days.`, -1);
      emit(s, { type: 'emote', emote: 'question', tenantId: t.id, buildingId: b.id });
      herald(s, 'bad', clerkLine(s, t.portraitSeed, [
        `The purse at ${b.name} sat on the step for ${sat} days. ${t.first} has taken it back and spent it, as anyone would. It is owed again.`,
        `Nobody came for the purse at ${b.name} in ${sat} days, so ${t.first} took it to market. The rent is owed again.`,
      ]), { tenantId: t.id, buildingId: b.id });
    }
  }
}

// ───────────── Rent Day ─────────────

function rollPayment(s: GameState, t: Tenant): void {
  const aux = auxOf(t);
  aux.payDay = -1;
  if (aux.due <= 0) return;
  if (chance(s, payChance(s, t))) {
    payNow(s, t, false);
    sayLine(s, t, 'pay', t.happiness < 40 ? 'pay_rent_grudging' : 'pay_rent', 0.3);
  } else {
    emit(s, { type: 'emote', emote: 'sweat', ...refsOf(t) });
  }
}

function rentDay(s: GameState): void {
  const book = currentBook(s);
  const grace = graceDays(s);
  for (const t of housed(s)) {
    if (!t.lease) continue;
    const aux = auxOf(t);
    if (aux.due > 0) { t.arrears += aux.due; aux.due = 0; }
    const rent = Math.max(1, Math.round(t.lease.rent));
    book.rentDue += rent;
    aux.due = rent;
    if (t.lateStage === 'none') t.lateStage = 'grace';
    // payers are spread over the first three days (never past the grace days)
    let offset = weighted(s, [0, 1, 2], k => [0.5, 0.3, 0.2][k]!) ?? 0;
    if (t.traits.includes('punctual')) offset = 0;
    else if (t.traits.includes('forgetful')) offset = 2;
    aux.payDay = Math.floor(s.day) + Math.min(offset, grace);
  }
  paymentsDue(s);
}

function paymentsDue(s: GameState): void {
  const today = Math.floor(s.day);
  for (const t of housed(s)) {
    const aux = auxOf(t);
    if (aux.due > 0 && aux.payDay >= 0 && aux.payDay <= today) rollPayment(s, t);
  }
}

function askLate(s: GameState, t: Tenant, announce: boolean): void {
  const aux = auxOf(t);
  if (decisionPending(s, 'late_rent', { tenantId: t.id })) { aux.askDay = s.day + 3; return; }
  aux.askDay = s.day + 12;       // set first: an order or a delegate may rule on the spot, and the ruling sets its own date
  const inc = spawnDecision(s, 'late_rent', { tenantId: t.id, ...(t.buildingId ? { buildingId: t.buildingId } : {}), unit: t.unit }, { amount: t.arrears });
  if (!inc) aux.askDay = s.day + 2;
  if (!inc && announce) {
    herald(s, 'bad', `${t.name} has not paid. The grace days are spent and ${crowns(t.arrears)} are owed.`, refsOf(t));
  }
}

function goLate(s: GameState, t: Tenant): void {
  const aux = auxOf(t);
  if (aux.due <= 0) return;
  t.arrears += aux.due;
  aux.due = 0; aux.payDay = -1;
  if (t.lateStage === 'plan') {
    t.plan = null;
    t.lateStage = 'late';
    t.daysLate = dom0(s);
    herald(s, 'bad', `${t.name} has missed an instalment. The payment plan is now more of a hope.`, refsOf(t));
  } else if (t.lateStage === 'grace' || t.lateStage === 'none') {
    t.lateStage = 'late';
    t.daysLate = dom0(s);
  } else {
    return;   // already late or before the court: it is simply more owed
  }
  if (t.buildingId) emit(s, { type: 'rent_late', tenantId: t.id, buildingId: t.buildingId });
  sayLine(s, t, 'late', 'late_excuse', 0.6);
  askLate(s, t, true);
}

function rentDaySummary(s: GameState): void {
  if (currentBook(s).rentDue <= 0) return;      // no Rent Day has been rung this month (a reign's first days)
  const all = housed(s).filter(t => t.lease);
  if (!all.length) return;
  const missing = all.filter(t => auxOf(t).due > 0 || ((t.lateStage === 'late' || t.lateStage === 'noticed' || t.lateStage === 'court' || t.lateStage === 'writ') && t.arrears > 0));
  const paid = all.length - missing.length;
  if (!missing.length) {
    herald(s, 'good', all.length === 1 ? 'Rent Day is done. The one household has paid.' : clerkLine(s, all.length, [
      `Rent Day is done. All ${all.length} households have paid, which the clerk has underlined.`,
      `Rent Day is done. All ${all.length} households have paid. The clerk checked the sum twice, out of surprise.`,
      `Rent Day is done, and all ${all.length} households have paid. Nobody is sure what to do with the afternoon.`,
    ]));
    return;
  }
  const names = missing.slice(0, 2).map(t => t.name).join(' and ');
  const more = missing.length > 2 ? ` and ${missing.length - 2} more` : '';
  herald(s, 'info', all.length === 1 ? `Rent Day is done. The one household has not paid: ${names}.` : `Rent Day is done. ${paid} of ${all.length} households have paid. Not heard from: ${names}${more}.`);
}

// ───────────── the late pipeline ─────────────

function pipelineDaily(s: GameState): void {
  const d0 = dom0(s);
  const grace = graceDays(s);
  for (const t of housed(s)) {
    if (!t.lease) continue;
    const aux = auxOf(t);
    const rel = clamp(Number.isFinite(t.reliability) ? t.reliability : 0.78, 0, 1);

    // still in grace with the rent outstanding: it may yet appear; when grace runs out it is late
    if (aux.due > 0 && aux.payDay < 0) {
      const ghost = t.traits.includes('ghost');
      const inGoodStanding = t.lateStage === 'grace' || t.lateStage === 'plan' || t.lateStage === 'none';
      // (a ghost is never in on the day, and nearly always turns up with it a day or two after)
      const cure = t.lateStage === 'writ' ? 0 : ghost ? TUNE.ghostCure : TUNE.graceCure * rel * (inGoodStanding ? 1 : 0.3);
      if (d0 >= 1 && cure > 0 && chance(s, cure)) payNow(s, t, false);
      else if (d0 >= grace && d0 >= 1) goLate(s, t);
    }

    const stage = t.lateStage;
    if (stage === 'late' || stage === 'noticed' || stage === 'court' || stage === 'writ') {
      // nothing owed any more: a case about money is over (a notice served for other cause runs its course)
      if (t.arrears <= 0 && (stage === 'late' || aux.cause)) { clearCase(t); continue; }
      t.daysLate += 1;
      let p = TUNE.lateCure * rel;
      if (s.day <= aux.urgeUntil) p = Math.max(p, aux.urgeP, t.traits.includes('ghost') && stage === 'late' ? TUNE.ghostCure : 0);
      else if (stage === 'court') p = TUNE.courtCure * rel;
      // while the matter stands before the ruler they wait for the ruling; once the court has ruled it is too late
      if (stage === 'writ' || t.arrears <= 0 || rulingAwaited(s, t)) p = 0;
      if (p > 0 && chance(s, p)) {
        const canFindAll = t.arrears <= t.income * 1.5;
        if (canFindAll) { payNow(s, t, true); continue; }
        if (stage === 'late') {
          const part = payNow(s, t, false);
          aux.urgeUntil = -1;       // they have brought what they could find; there is no more where that came from
          if (part > 0 && t.arrears > 0) herald(s, 'info', `${t.name} brought ${crowns(part)} toward the arrears. ${crowns(t.arrears)} still stand against the name.`, refsOf(t));
          if (t.lateStage !== 'late') continue;
        }
      }
    }

    if (t.lateStage === 'late') {
      if (s.day >= aux.askDay) askLate(s, t, false);
    } else if (t.lateStage === 'noticed') {
      if (aux.noticeDay >= 0 && s.day >= aux.noticeDay + TUNE.noticeDays) {
        t.lateStage = 'court';
        const left = t.courtDay !== null ? Math.max(1, Math.round(t.courtDay - s.day)) : BAL.courtDays;
        herald(s, 'info', `The Reeve's Court has accepted the matter of ${t.name}. It will be heard in about ${left} days, which for the court is brisk.`, refsOf(t));
        emit(s, { type: 'sfx', id: 'gavel', ...(t.buildingId ? { buildingId: t.buildingId } : {}) });
      }
    }
    if ((t.lateStage === 'noticed' || t.lateStage === 'court') && t.courtDay !== null && s.day >= t.courtDay) {
      t.lateStage = 'writ';
      aux.urgeUntil = -1;
      emit(s, { type: 'sfx', id: 'gavel', ...(t.buildingId ? { buildingId: t.buildingId } : {}) });
      askWrit(s, t, true);
    } else if (t.lateStage === 'writ' && s.day >= aux.askDay) {
      if (!liveJob(s, 'evict', j => j.tenantId === t.id)) askWrit(s, t, false);
    }
  }
}

function askWrit(s: GameState, t: Tenant, announce: boolean): void {
  const aux = auxOf(t);
  if (decisionPending(s, 'eviction_ready', { tenantId: t.id })) { aux.askDay = s.day + 3; return; }
  aux.askDay = s.day + 14;
  const inc = spawnDecision(s, 'eviction_ready', { tenantId: t.id, ...(t.buildingId ? { buildingId: t.buildingId } : {}), unit: t.unit }, { amount: t.arrears });
  if (!inc) aux.askDay = s.day + 2;
  if (!inc && announce) herald(s, 'urgent', `The Reeve's Court has ruled against ${t.name}. The writ is yours to use, or not.`, refsOf(t));
}

export function addArrears(s: GameState, tenantId: Id, amount: number): void {
  const t = s.tenants[tenantId];
  if (!t || !Number.isFinite(amount)) return;
  t.arrears = Math.max(0, Math.round(t.arrears + amount));
  if (t.arrears <= 0 && t.status === 'housed' && t.lateStage !== 'none' && t.lateStage !== 'grace') clearCase(t);
}

export function forgiveArrears(s: GameState, tenantId: Id): void {
  const t = s.tenants[tenantId];
  if (!t) return;
  t.arrears = 0;
  if (t.status !== 'housed') return;
  // a notice served for other cause was never about money: forgiving a debt does not take it off the door
  const inCourt = t.lateStage === 'noticed' || t.lateStage === 'court' || t.lateStage === 'writ';
  if (inCourt && !auxOf(t).cause) return;
  clearCase(t);
}

/** Carry out a late-rent option on a household: wait | late_fee | payment_plan | forgive | notice | cash_for_keys | evict | mercy. */
export function applyLateOption(s: GameState, tenantId: Id, option: DecisionOption): void {
  const t = s.tenants[tenantId];
  if (!t || t.status !== 'housed' || !t.lease) return;
  const aux = auxOf(t);
  const rel = clamp(Number.isFinite(t.reliability) ? t.reliability : 0.78, 0, 1);
  const inCourt = t.lateStage === 'noticed' || t.lateStage === 'court' || t.lateStage === 'writ';
  switch (option) {
    case 'wait': {
      aux.askDay = s.day + TUNE.waitDays;
      aux.urgeUntil = s.day + TUNE.waitDays; aux.urgeP = TUNE.waitCure * rel;
      break;
    }
    case 'late_fee': {
      const pct = clamp(Number.isFinite(s.policies.lateFeePct) ? s.policies.lateFeePct : 10, 0, 100);
      const fee = Math.max(1, Math.round(t.lease.rent * pct / 100));
      t.arrears += fee; aux.fees += fee;
      if (!inCourt && t.lateStage !== 'late') { t.lateStage = 'late'; t.plan = null; }
      if (aux.noFaultDay >= 0 && s.day - aux.noFaultDay <= 45) {
        // the debt came from a purse the ruler never fetched: a fee on top of that stings
        changeHappiness(s, t.id, -8, 'unfair fee');
        addMemory(s, t.id, 'You charged a late fee on rent you had left lying on their step.', -2);
        aux.noFaultDay = -1;
      }
      aux.askDay = s.day + TUNE.waitDays;
      aux.urgeUntil = s.day + TUNE.waitDays - 1; aux.urgeP = rel > 0 ? TUNE.feeCure * (0.4 + 0.6 * rel) : 0;
      break;
    }
    case 'payment_plan': {
      if (t.arrears <= 0) { clearCase(t); break; }
      t.plan = { left: TUNE.planMonths, each: Math.max(1, Math.ceil(t.arrears / TUNE.planMonths)) };
      t.lateStage = 'plan'; t.courtDay = null; t.daysLate = 0;
      aux.noticeDay = -1; aux.urgeUntil = -1; aux.cause = 0;
      t.reliability = clamp(t.reliability + 0.04, 0.2, 0.98);
      break;
    }
    case 'forgive': {
      forgiveArrears(s, t.id);
      // word spreads: if the Reeve forgives, the rent is perhaps less urgent than it looked
      for (const o of housed(s)) if (o.id !== t.id) o.reliability = clamp(o.reliability - 0.008, 0.3, 0.98);
      break;
    }
    case 'notice': {
      if (inCourt) break;
      aux.noticeDay = s.day;
      aux.cause = t.arrears + aux.due > 0 || t.lateStage === 'late' || t.lateStage === 'plan' ? 1 : 0;
      t.courtDay = s.day + BAL.courtDays + (t.traits.includes('litigious') ? TUNE.litigiousCourtDays : 0);
      t.lateStage = 'noticed'; t.plan = null;
      aux.urgeUntil = s.day + TUNE.noticeDays; aux.urgeP = TUNE.noticeCure * rel;
      if (t.buildingId) emit(s, { type: 'sfx', id: 'knock', buildingId: t.buildingId });
      emit(s, { type: 'emote', emote: 'shock', ...refsOf(t) });
      break;
    }
    case 'cash_for_keys': {
      const pay = Math.max(6, Math.round(t.lease.rent * TUNE.keysMonths));
      spend(s, pay, 'bribes', `Coin for keys, ${t.name}`, refsOf(t));
      addMemory(s, t.id, 'You paid their way out rather than throw them out.', 1);
      sayLine(s, t, 'leave', 'move_out_happy', 0.8);
      moveOut(s, t.id, 'cash_for_keys');
      break;
    }
    case 'evict': {
      if (liveJob(s, 'evict', j => j.tenantId === t.id)) break;
      const b = homeOf(s, t);
      const [x, y] = b ? doorOf(s, b) : [0, 0];
      const job = enqueueJob(s, { kind: 'evict', role: 'bailiff', buildingId: t.buildingId, unit: t.unit, tenantId: t.id, x, y, workDays: 1, cost: 5, priority: 6 });
      if (t.lateStage !== 'writ') { t.lateStage = 'writ'; t.courtDay = t.courtDay ?? s.day; }
      aux.askDay = s.day + 8;
      if (!job) evict(s, t.id);
      break;
    }
    case 'mercy': {
      t.courtDay = null; aux.noticeDay = -1; aux.urgeUntil = -1; t.daysLate = 0; aux.cause = 0;
      if (t.arrears > 0) {
        t.plan = { left: TUNE.mercyMonths, each: Math.max(1, Math.ceil(t.arrears / TUNE.mercyMonths)) };
        t.lateStage = 'plan';
      } else {
        clearCase(t);
      }
      t.reliability = clamp(t.reliability + 0.03, 0.2, 0.98);
      break;
    }
    default: break;
  }
}

/** Remove the household now (the Bailiff has done the deed). */
export function evict(s: GameState, tenantId: Id): void {
  const t = s.tenants[tenantId];
  if (!t || t.status !== 'housed') return;
  const home = t.buildingId;
  emit(s, { type: 'sfx', id: 'gavel', ...(home ? { buildingId: home } : {}) });
  sayLine(s, t, 'leave', 'evicted', 1);
  addMemory(s, t.id, 'You had them put out into the lane.', -2);
  moveOut(s, t.id, 'evicted');
  s.stats.evictions++;
  changeRenown(s, TUNE.evictRenown, 'eviction');
  if (home) {
    for (const n of neighborsOf(s, home, 4)) {
      changeHappiness(s, n.id, TUNE.evictNeighbors, 'neighbour evicted');
      if (n.tags.includes('widow') || n.tags.includes('elder') || t.tags.includes('widow') || t.tags.includes('elder')) {
        addMemory(s, n.id, `You had ${t.name} put out of the house next door.`, -1);
      }
    }
  }
}

// ───────────── applicants: the showing and the answer ─────────────

function askApplicant(s: GameState, a: Applicant, announce: boolean): void {
  if (decisionPending(s, 'applicant', { applicantId: a.id, buildingId: a.buildingId, unit: a.unit })) return;
  const inc = spawnDecision(s, 'applicant', { applicantId: a.id, buildingId: a.buildingId, unit: a.unit });
  if (!inc && announce) {
    const b = s.buildings[a.buildingId];
    herald(s, 'info', `${a.household.name} has seen ${b?.name ?? 'the place'} and wishes to take it at ${crowns(b?.rent ?? 0)} a month.`, { buildingId: a.buildingId });
  }
}

function showDone(s: GameState, job: Job): void {
  let a = job.applicantId ? s.applicants[job.applicantId] : undefined;
  if (!a && job.buildingId) a = applicantFor(s, job.buildingId, job.unit ?? 0) ?? Object.values(s.applicants).find(x => x.buildingId === job.buildingId);
  if (!a || a.shown) return;
  a.shown = true;
  const shownAt = s.buildings[a.buildingId];
  if (shownAt) shownAt.flags[SHOWN_DAY] = Math.floor(s.day);
  a.leavesDay = Math.max(a.leavesDay, s.day + TUNE.answerDays);
  if (s.policies.screening === 'always' && !a.screened) {
    spend(s, TUNE.screenFee, 'other', `Asking after ${a.household.name}`, { buildingId: a.buildingId });
    screen(s, a.id);
  }
  askApplicant(s, a, true);
}

/** Accept (sign at asking rent * rentPct/100, default 100) or turn away an applicant. */
export function applyLease(s: GameState, applicantId: Id, accept: boolean, rentPct?: number): void {
  const a = s.applicants[applicantId];
  if (!a) return;
  const b = s.buildings[a.buildingId];
  const u = b?.units[a.unit];
  if (!b || !u || b.state !== 'ready' || (u.tenantId && !b.units.some(x => !x.tenantId))) { dismissApplicant(s, a.id, 'gone'); return; }
  if (!accept) { dismissApplicant(s, a.id, 'rejected'); return; }
  const pct = Number.isFinite(rentPct) ? clamp(rentPct as number, 10, 500) : 100;
  const rent = Math.max(1, Math.round(b.rent * pct / 100));
  if (rent > a.maxRent) {
    herald(s, 'info', `${a.household.name} looked at the number, then at the roof of ${b.name}, and left. ${crowns(rent)} was more than they would pay.`, { buildingId: b.id });
    dismissApplicant(s, a.id, 'refused');
    return;
  }
  const t = moveIn(s, a.id, rent);
  if (pct > 100) addMemory(s, t.id, 'You asked more rent than the board said, on the doorstep.', -1);
  else if (pct < 100) addMemory(s, t.id, 'You took something off the posted rent before they had even asked.', 1);
}

function traitNames(traits: readonly Tenant['traits'][number][]): string {
  return traits.map(tr => TRAIT_DEFS[tr]?.name || tr.replace(/_/g, ' ')).join(', ');
}

/** Check references: reveal hidden traits of an applicant (or housed tenant). */
export function screen(s: GameState, id: Id): void {
  let a: Applicant | undefined = s.applicants[id];
  if (!a) a = Object.values(s.applicants).find(x => x.household.id === id);
  if (a) {
    const hidden = hiddenTraits(a.household);
    a.household.revealed = [...a.household.traits];
    const first = !a.screened;
    a.screened = true;
    a.leavesDay = Math.max(a.leavesDay, s.day + 4);
    if (!first && !hidden.length) return;
    let line = hidden.length
      ? `Asked after ${a.household.name}. Their last landlord says: ${traitNames(hidden)}.`
      : `Asked after ${a.household.name}. Their last landlord had nothing to add, and seemed sorry about it.`;
    if (line.length > 150) line = `Asked after ${a.household.name}. Their last landlord had a good deal to say. It is in the record.`;
    herald(s, 'info', line, { buildingId: a.buildingId });
    return;
  }
  const t = s.tenants[id];
  if (!t) return;
  const hidden = hiddenTraits(t);
  if (!hidden.length) return;
  t.revealed = [...t.traits];
  let line = `Enquiries were made about ${t.name}. Now known: ${traitNames(hidden)}.`;
  if (line.length > 150) line = `Enquiries were made about ${t.name}. A good deal is now known. It is in the record.`;
  herald(s, 'info', line, refsOf(t));
}

function applicantsDaily(s: GameState): void {
  for (const a of Object.values(s.applicants)) if (a.shown) askApplicant(s, a, false);
}

// ───────────── leases: renewal and the rent ─────────────

function renewLease(t: Tenant, day: number): void {
  if (!t.lease) return;
  const aux = auxOf(t);
  t.lease.startDay = day;
  aux.raised = 0; aux.renewDay = -1;
}

/** Change a household's lease rent by pct (e.g. +10, -15). Reactions included. */
export function changeLeaseRent(s: GameState, tenantId: Id, pct: number): void {
  const t = s.tenants[tenantId];
  if (!t || t.status !== 'housed' || !t.lease) return;
  const aux = auxOf(t);
  const b = homeOf(s, t);
  const renewing = aux.renewDay >= 0 || s.day >= leaseEndDay(t);
  if (renewing) aux.raised = 0;       // a new term: the Crown's cap starts afresh
  let p = Number.isFinite(pct) ? pct : 0;
  if (p > 0) {
    const cap = Math.max(0, Number.isFinite(s.policies.renewalCapPct) ? s.policies.renewalCapPct : 10);
    const allowed = Math.max(0, cap - aux.raised);
    if (p > allowed) {
      herald(s, 'info', allowed > 0
        ? `The Crown's cap on rises holds ${t.name} to ${Math.round(allowed)} percent more this year, whatever was said.`
        : `The Crown's cap on rises forbids raising ${t.name}'s rent again this year. The clerk declined to write the number.`, refsOf(t));
      p = allowed;
    }
  }
  const old = t.lease.rent;
  let rent = p === 0 ? old : Math.max(1, Math.round(old * (1 + p / 100)));
  if (p > 0 && rent === old) rent = old + 1;
  if (p < 0 && rent === old && old > 1) rent = old - 1;
  t.lease.rent = rent;
  if (rent > old) {
    aux.raised += p;
    changeHappiness(s, t.id, -Math.max(1, Math.round(p * 0.3)) - (t.traits.includes('haggler') ? 2 : 0), 'rent raised');
    if (p >= 10) addMemory(s, t.id, renewing ? 'You raised their rent when the lease came round.' : 'You raised their rent in the middle of a lease.', -1);
    sayLine(s, t, 'complain', 'rent_raised', 0.7);
    const market = b ? Math.max(1, marketRent(s, b)) : rent;
    // the loyal put up with more before they pack; the flighty with less
    if ((rent > market * 1.35 || rent > t.income * 0.6) && t.happiness < 45 / clamp(traitTotal(t.traits, 'stay'), 0.5, 2)) {
      herald(s, 'bad', `${t.name} has left ${b?.name ?? 'the realm'}. The rent went up, so they went out.`, refsOf(t));
      sayLine(s, t, 'leave', 'move_out_angry', 1);
      moveOut(s, t.id, 'rent_too_high');
      return;
    }
  } else if (rent < old) {
    changeHappiness(s, t.id, Math.max(1, Math.round(-p * 0.3)), 'rent lowered');
    sayLine(s, t, 'thanks', 'rent_lowered', 0.7);
  }
  if (renewing) renewLease(t, s.day);
}

function renewalsDaily(s: GameState): void {
  for (const t of housed(s)) {
    if (!t.lease || s.day < leaseEndDay(t)) continue;
    if (t.lateStage === 'late' || t.lateStage === 'noticed' || t.lateStage === 'court' || t.lateStage === 'writ') continue;
    const aux = auxOf(t);
    const b = homeOf(s, t);
    if (!b) continue;
    if (aux.renewDay < 0) {
      const stay = traitTotal(t.traits, 'stay');
      const market = Math.max(1, marketRent(s, b));
      if (t.happiness < 30 / Math.max(0.5, stay)) {
        herald(s, 'bad', `The lease of ${t.name} at ${b.name} is up, and so is ${t.first}. They did not say why. They did not have to.`, refsOf(t));
        sayLine(s, t, 'leave', 'move_out_angry', 1);
        moveOut(s, t.id, 'lease_end');
        continue;
      }
      if (t.lease.rent > market * 1.3 && t.happiness < 55) {
        herald(s, 'bad', `${t.name} will not sign again at ${b.name}. ${crowns(t.lease.rent)} a month, they said, buys a better roof elsewhere.`, refsOf(t));
        sayLine(s, t, 'leave', 'move_out_angry', 1);
        moveOut(s, t.id, 'rent_too_high');
        continue;
      }
      aux.renewDay = s.day;
      spawnDecision(s, 'rent_renewal', { tenantId: t.id, buildingId: b.id, unit: t.unit });
    } else if (s.day - aux.renewDay >= TUNE.renewalDriftDays && !decisionPending(s, 'rent_renewal', { tenantId: t.id })) {
      herald(s, 'info', `Nobody mentioned the lease of ${t.name}, so it carried on by itself, as leases do.`, refsOf(t));
      renewLease(t, s.day);
    }
  }
}

// ───────────── sureties ─────────────

let settlingInPlace = false;

function damageCost(t: Tenant, b: Building | null | undefined): number {
  const pts = Math.max(0, t.wear - 4);
  const perPoint = Math.max(0.15, (b ? BUILDINGS[b.type]?.cost ?? 60 : 60) * TUNE.damagePerPoint);
  return Math.max(0, Math.round(pts * perPoint));
}

/** What the household did to the place shows once someone looks. Hard living wears a house; it does not fell one. */
function leaveMarks(s: GameState, t: Tenant, home: Building | null | undefined): void {
  if (!home || home.state !== 'ready' || !(t.wear > 0)) return;
  const marks = Math.min(t.wear, Math.max(0, home.condition - TUNE.wearFloor));
  if (marks > 0) damageBuilding(s, home.id, marks, 'move_out');
}

/** Called by tenants.moveOut for every departure, whoever sent them: starts settling the surety. */
export function settleDeparture(s: GameState, t: Tenant, home: Building | null, unit: number, reason: MoveOutReason): void {
  const aux = auxOf(t);
  aux.damage = damageCost(t, home);
  aux.depDay = s.day; aux.depTries = 0;
  if (!t.lease || t.lease.deposit <= 0) { aux.dep = 3; return; }
  if (t.arrears > 0) {
    // what they owe comes out of the surety before anyone argues about the hearth
    const applied = Math.min(t.lease.deposit, t.arrears);
    t.lease.deposit -= applied;
    t.arrears -= applied;
    aux.fees = Math.min(aux.fees, t.arrears);
    herald(s, 'info', t.lease.deposit > 0
      ? `${crowns(applied)} of ${t.name}'s surety went against what they owed. ${crowns(t.lease.deposit)} of it remain to be settled.`
      : `The surety of ${t.name} went against what they owed${t.arrears > 0 ? `. The other ${crowns(t.arrears)} went with them` : ', which settles it'}.`, refsOf(t));
    if (t.lease.deposit <= 0) { aux.dep = 3; return; }
  }
  if (settlingInPlace) {
    leaveMarks(s, t, home);
    aux.dep = 2;
    return;
  }
  if (reason === 'ruin' || !home) {
    // nothing left to inspect: the surety goes back whole
    const back = t.lease.deposit;
    t.lease.deposit = 0; aux.dep = 3;
    spend(s, back, 'deposits_returned', `Surety returned to ${t.name}`, refsOf(t));
    herald(s, 'info', `The surety of ${crowns(back)} was returned to ${t.name}. There was no house left to hold it against.`, refsOf(t));
    return;
  }
  aux.dep = 1;
  const [x, y] = doorOf(s, home);
  enqueueJob(s, { kind: 'inspect', role: 'mason', buildingId: home.id, unit, tenantId: t.id, x, y, workDays: 0.3, priority: 2 });
}

function askDeposit(s: GameState, t: Tenant): void {
  const aux = auxOf(t);
  if (!t.lease || aux.depTries >= 3) return;
  if (decisionPending(s, 'move_out_deposit', { tenantId: t.id })) return;
  if (!aux.home || !s.buildings[aux.home]) {
    // the house has since come down: there is nothing to point at, so the clerk settles it on the inspection
    clerkSettles(s, t, 'The house is gone, so the clerk settled');
    return;
  }
  const inc = spawnDecision(s, 'move_out_deposit',
    { tenantId: t.id, ...(aux.home ? { buildingId: aux.home } : {}), unit: aux.homeUnit },
    { amount: aux.damage, deposit: t.lease.deposit });
  if (inc) aux.depTries++;
}

function finishInspection(s: GameState, t: Tenant): void {
  const aux = auxOf(t);
  if (aux.dep !== 1) return;
  leaveMarks(s, t, aux.home ? s.buildings[aux.home] : undefined);
  aux.dep = 2; aux.depDay = s.day;
  askDeposit(s, t);
}

/** Settle a departed household's deposit, keeping keepPct (0..100) of it; -1 = keep exactly the cost of the damage. */
export function applyDeposit(s: GameState, tenantId: Id, keepPct: number): void {
  const t = s.tenants[tenantId];
  if (!t || !t.lease) return;
  if (t.status === 'housed') {
    // an incident settled the surety with the household still inside: they leave now, and it is settled here
    settlingInPlace = true;
    try { moveOut(s, t.id, 'lease_end'); } finally { settlingInPlace = false; }
  }
  const aux = auxOf(t);
  const held = t.lease.deposit;
  if (held <= 0 || aux.dep === 3) { aux.dep = 3; return; }
  const fair = Math.min(held, Math.max(0, aux.damage));
  const keep = keepPct < 0 || !Number.isFinite(keepPct) ? fair : clamp(Math.round(held * clamp(keepPct, 0, 100) / 100), 0, held);
  const back = held - keep;
  t.lease.deposit = 0;
  aux.dep = 3;
  if (back > 0) spend(s, back, 'deposits_returned', `Surety returned to ${t.name}`, refsOf(t));
  const over = keep - fair;
  if (over > 0 && over >= held * 0.25) {
    // kept more than the damage: they will say so at the well
    addMemory(s, t.id, fair > 0 ? 'You kept more of their surety than the damage came to.' : 'You kept their surety over honest wear.', -2);
    if (over >= held * 0.6) changeRenown(s, -1, 'surety kept');
    if (aux.home) for (const n of neighborsOf(s, aux.home, 4)) changeHappiness(s, n.id, -2, 'surety kept next door');
  } else if (keep < fair && fair >= held * 0.3) {
    addMemory(s, t.id, 'You returned their surety though the damage was real.', 2);
    changeRenown(s, 1, 'surety returned');
  }
}

/** Nobody ruled (or there is nothing left to rule on): the surety is settled on the inspection alone. */
function clerkSettles(s: GameState, t: Tenant, opening: string): void {
  if (!t.lease || t.lease.deposit <= 0) { auxOf(t).dep = 3; return; }
  const held = t.lease.deposit;
  const keep = Math.min(held, Math.max(0, auxOf(t).damage));
  applyDeposit(s, t.id, -1);
  herald(s, 'info', keep > 0
    ? `${opening} the surety of ${t.name}: ${crowns(keep)} kept for the damage, ${crowns(held - keep)} returned.`
    : `${opening} the surety of ${t.name}: all ${crowns(held)} returned. Honest wear, the note says.`, refsOf(t));
}

function depositsDaily(s: GameState): void {
  for (const t of Object.values(s.tenants)) {
    if (t.status === 'housed') continue;
    const aux = auxOf(t);
    if (aux.dep === 1) {
      if (s.day - aux.depDay >= TUNE.inspectWaitDays) finishInspection(s, t);
    } else if (aux.dep === 2) {
      if (!t.lease || t.lease.deposit <= 0) { aux.dep = 3; continue; }
      if (decisionPending(s, 'move_out_deposit', { tenantId: t.id })) continue;
      if (s.day - aux.depDay >= TUNE.depositWaitDays) {
        clerkSettles(s, t, 'The clerk settled');
      } else if (s.day - aux.depDay >= 1) {
        askDeposit(s, t);
      }
    }
  }
}

// ───────────── vacancies with teeth ─────────────

function squatterKind(defId: string): SquatterKind {
  for (const k of SQUATTER_KINDS) if (defId.includes(k) || defId.includes(k.replace(/s$/, ''))) return k;
  return 'goblins';
}

/** Building flag: the day somebody was last shown round a vacancy there. */
const SHOWN_DAY = 'shownDay';

function lastSquatterRuling(s: GameState, buildingId: Id): number {
  let last = -Infinity;
  for (const inc of Object.values(s.incidents)) {
    if (inc.buildingId === buildingId && INCIDENT_BY_ID[inc.defId]?.decision === 'squatters') last = Math.max(last, inc.startedDay);
  }
  return last;
}

function squattersDaily(s: GameState): void {
  let watch = 1;
  for (const b of Object.values(s.buildings)) if (b.type === 'watchtower' && b.state === 'ready') { watch = 0.4; break; }
  for (const b of Object.values(s.buildings)) {
    if (b.state !== 'ready' || !b.units.length) continue;
    if (b.squatters) {
      // still in there: the matter comes round again every month until somebody settles it
      const unit = b.units.findIndex(u => !u.tenantId);
      if (unit < 0 || s.day - b.squatters.sinceDay < TUNE.squatterAgainDays) continue;
      if (s.day - lastSquatterRuling(s, b.id) < TUNE.squatterAgainDays || decisionPending(s, 'squatters', { buildingId: b.id })) continue;
      spawnDecision(s, 'squatters', { buildingId: b.id, unit });
      continue;
    }
    for (let i = 0; i < b.units.length; i++) {
      const u = b.units[i]!;
      if (u.tenantId || u.vacantSince === null || s.day - u.vacantSince < TUNE.squatterAfterDays) continue;
      if (applicantFor(s, b.id, i)) continue;
      // a place that is on the board and lately shown has too many eyes on it
      const shown = b.flags[SHOWN_DAY];
      if (u.listed && typeof shown === 'number' && s.day - shown < TUNE.shownKeepsDays) continue;
      if (!chance(s, (u.listed ? TUNE.squatterChanceListed : TUNE.squatterChanceUnlisted) * watch)) continue;
      if (decisionPending(s, 'squatters', { buildingId: b.id })) break;
      const inc = spawnDecision(s, 'squatters', { buildingId: b.id, unit: i });
      if (inc && (inc.state === 'open' || inc.state === 'in_progress') && !b.squatters) setSquatters(s, b.id, squatterKind(inc.defId));
      break;
    }
  }
}

// ───────────── jobs ─────────────

function serveNoticeDone(s: GameState, t: Tenant): void {
  if (t.lateStage === 'noticed' || t.lateStage === 'court' || t.lateStage === 'writ') return;
  const b = homeOf(s, t);
  applyLateOption(s, t.id, 'notice');
  changeHappiness(s, t.id, t.arrears > 0 ? -12 : -22, 'notice to quit');
  addMemory(s, t.id, t.arrears > 0 ? 'You nailed a Notice to Quit to their door.' : 'You nailed a Notice to Quit to their door, with the rent paid.', -2);
  if (b) for (const n of neighborsOf(s, b.id, 4)) changeHappiness(s, n.id, -2, 'notice next door');
  if (t.arrears <= 0) changeRenown(s, -1, 'notice without cause');
  herald(s, 'info', `A Notice to Quit was nailed to the door of ${b?.name ?? 'the house'}. The Reeve's Court will hear it in due course.`, refsOf(t));
}

function evictJobDone(s: GameState, job: Job): void {
  const t = job.tenantId ? s.tenants[job.tenantId] : (job.buildingId ? tenantsOf(s, job.buildingId)[job.unit ?? 0] ?? tenantsOf(s, job.buildingId)[0] : undefined);
  if (!t || t.status !== 'housed') return;
  const b = homeOf(s, t);
  if (t.lateStage === 'writ') {
    herald(s, 'bad', `${t.name} was put out of ${b?.name ?? 'the house'} by writ of the Reeve's Court. The street watched.`, refsOf(t));
    evict(s, t.id);
  } else if (t.lateStage === 'noticed' || t.lateStage === 'court') {
    herald(s, 'info', `The court has not yet ruled on ${t.name}, so nobody was put out of ${b?.name ?? 'the house'}. A stern look was delivered instead.`, refsOf(t));
  } else if (!job.byRuler) {
    // sent on a writ that has since been answered (paid, forgiven, or shown mercy): there is nothing left to enforce,
    // and a household that has just settled is not handed a fresh Notice to Quit for its trouble
    herald(s, 'info', `The writ against ${t.name} had lapsed before anyone reached ${b?.name ?? 'the house'}. Nobody was put out. The door was knocked on anyway, for form.`, refsOf(t));
  } else {
    serveNoticeDone(s, t);
    herald(s, 'info', `There is no writ against ${t.name}, ${rulerTitle(s)}, so a Notice to Quit went up instead. Evictions go by way of the court.`, refsOf(t));
  }
}

function jobDone(s: GameState, job: Job): void {
  switch (job.kind) {
    case 'collect': {
      const b = job.buildingId ? s.buildings[job.buildingId] : undefined;
      if (!b) return;
      let got = 0;
      if (job.unit !== null && job.unit !== undefined && b.units[job.unit]) got += collectPurse(s, b.id, job.unit, job.assignee);
      else for (let i = 0; i < b.units.length; i++) got += collectPurse(s, b.id, i, job.assignee);
      if (got > 0) emit(s, { type: 'sfx', id: 'coins', buildingId: b.id });
      nextOnTheRound(s, Number.isFinite(job.x) && Number.isFinite(job.y) ? [job.x, job.y] : undefined);
      return;
    }
    case 'show': showDone(s, job); return;
    case 'screen': {
      const id = job.applicantId ?? job.tenantId ?? (job.buildingId ? Object.values(s.applicants).find(a => a.buildingId === job.buildingId)?.id : undefined);
      if (id) screen(s, id);
      return;
    }
    case 'serve_notice': {
      const t = job.tenantId ? s.tenants[job.tenantId] : (job.buildingId ? tenantsOf(s, job.buildingId)[0] : undefined);
      if (t && t.status === 'housed') serveNoticeDone(s, t);
      return;
    }
    case 'evict': evictJobDone(s, job); return;
    case 'inspect': {
      const t = job.tenantId ? s.tenants[job.tenantId] : undefined;
      if (t) { finishInspection(s, t); return; }
      // an inspection ordered by hand: look for a departed household of that building still awaiting one
      for (const d of Object.values(s.tenants)) if (d.status !== 'housed' && auxOf(d).dep === 1 && auxOf(d).home === job.buildingId) finishInspection(s, d);
      return;
    }
    default: return;
  }
}

// ───────────── module ─────────────

export const rentModule: SimModule = {
  name: 'rent',

  onDay(s) {
    paymentsDue(s);
    pipelineDaily(s);
    stalePurses(s);
    renewalsDaily(s);
    depositsDaily(s);
    squattersDaily(s);
    applicantsDaily(s);
    nextOnTheRound(s);
    if (dom0(s) === 3) rentDaySummary(s);
  },

  onMonth(s) { rentDay(s); },

  onJobDone(s, job) { jobDone(s, job); },
};
