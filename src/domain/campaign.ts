// The muster library and the Intro Campaign (docs/WRIT-THE-CAMPAIGN.md).
//
// A SCENARIO is a recipe, never a recording. It stores the *intent* of a world
// — how many doors, how many knights, how much of what kind of work, at what
// age — and hands that intent to the generator we already have. Re-dealt
// against whatever the setting is, so a renamed step is a step the recipe
// re-reads by its new name (writ §I). Nothing on this shelf is a dumped event
// log: a log names catalog rows, flow keys and step keys that a rename quietly
// orphans, and it looks fine while being wrong.
//
// An ACT's GOAL is a READING, never a stored flag. This is the constitution's
// central law (records in, readings out) applied to the tutorial: the campaign
// cannot desync from the board, because the only thing it ever does to the
// board is read it. There is no "act 3 complete" record anywhere — act 3 is
// complete exactly while no box of the holding's work rests on the Regent's
// own hand, and it becomes incomplete again the moment one does.
//
// The one real failure mode of a recipe is that it NAMES specifics — a flow
// key, a catalog row, a seat — and a rename butchers it silently. That is the
// stringly-typed fault this codebase has shipped five times. The guard is
// `test/campaign.test.ts`: every name every scenario on this shelf speaks must
// resolve against the founding setting, or the build fails loudly.

import type { Catalog } from './catalog';
import { findRow } from './catalog';
import type { ActsBook } from './court';
import type { CaseReading, EventLog, KingdomEvent } from './events';
import { readCases } from './events';
import type { FlowBook, FlowTemplate } from './flows';
import { fullParams, handStep, instantiateFlow, readFlows } from './flows';
import { readGuilds, unmannedGuilds } from './guilds';
import { CRISIS_DAYS, readPatrons, retainedDoors } from './consequences';
import { regent } from './states';
import type { Kingdom } from './types';
import type { EconomyBook, MoneyLog } from './economy';
import type { TreasuryLedger, Upkeep } from './treasury';
import { coin, readCoffers } from './treasury';
import type { DealtGame, WarDoor, WarGame } from './wargame';
import { WAR_MARK, dealtGame, generateWarGame } from './wargame';

// ── The shelf's shapes ──────────────────────────────────────────────────────

/** What a goal answers: whether the board reads done, and the one line that
 *  says how far along it is. Both folded fresh; neither is stored. */
export interface GoalReading {
  met: boolean;
  progress: string;
}

/** Everything a goal is allowed to look at — the board, whole, as of game-now.
 *  A goal takes this and returns a reading; it may not write, and there is
 *  nowhere for it to write to. */
export interface CampaignContext {
  /** The living census (people, territories and the acts that seat them) —
   *  where a craft's head is read from. */
  kingdom: Kingdom;
  log: EventLog;
  money: MoneyLog;
  economy: EconomyBook;
  treasury: TreasuryLedger;
  flows: FlowBook;
  /** The standing muster's seed — the mark that says which cases are the
   *  holding's. */
  seed: string;
  /** Game-now. Every reading is folded against it, never the wall clock. */
  now: string;
  /** Where the holding's clock started — game-now at deploy (the muster
   *  banner's `deployedAt`). The acts that measure a WATCH or a MONTH measure
   *  it from here. */
  startedAt: string;
}

/** The role a dealt box lands on when the scenario means "the catch-basin"
 *  rather than a named person. A recipe must never hardcode the Regent's own
 *  id — that is a census record, and the census is edited by hand; the recipe
 *  names the ROLE and the deal resolves it against the census it is dealt into. */
export const THE_REGENT = 'the-regent';

/** A cascade the act opens: a grammar from the loaded flow book, walked part
 *  way, standing at a declared idle age. Ages are declared, not diced, because
 *  the whole point of the campaign is that the aging gauge measures the PLAYER
 *  (writ §II): nothing may arrive already stale. */
export interface CascadeDeal {
  /** A key in the loaded flow book. */
  flow: string;
  /** The plain word the case is filed under — what a human reads on the row. */
  box: string;
  /** The catalog leaf whose letters the cascade renders ({trade}, {urgency}),
   *  when the grammar takes letters. */
  leaf?: string;
  /** Steps already worked when the holding is handed to the player. */
  walk: number;
  /** Days since the case last moved, as of deploy. Under FESTER_DAYS, always:
   *  a clean clock is the campaign's load-bearing difference. */
  idleDays: number;
}

/** A plain typed box the act opens — one case, one catalog row, one hand. */
export interface BoxDeal {
  /** A key in the loaded catalog. */
  row: string;
  box: string;
  /** A census person's id, a queue the seats know, or THE_REGENT. */
  holder: string;
  idleDays: number;
  /** Why it is where it is, in the kingdom's plain words. */
  says: string;
}

/** The act's deal — declarative all the way down. Nothing here deals anything
 *  itself; `generateCampaign` hands it to the generator (writ §V: no second
 *  dealer). */
export interface ActDeal {
  /** What this act puts on the board, in one line, for the writ and the UI. */
  says: string;
  cascades?: CascadeDeal[];
  boxes?: BoxDeal[];
  /** Raw untriaged tickets for the Regent to walk down the tree. */
  intake?: number;
  /** Crown offices left standing headless at deploy. A vacancy is a decision,
   *  not a gap — and removal of a record IS revocation, so the deploy strikes
   *  the grant rather than inventing an "empty" flag. */
  vacate?: string[];
}

export interface Act {
  key: string;
  title: string;
  /** One sentence, in the kingdom's own voice, that opens the act. */
  herald: string;
  deal: ActDeal;
  /** The reading that must become true. Pure, and pure the whole way down. */
  goal: (ctx: CampaignContext) => GoalReading;
}

export interface Scenario {
  key: string;
  title: string;
  blurb: string;
  doors: number;
  knights: number;
  /** The Crown's standing cost while this holding is held. The solvency lever:
   *  tribute must cover it with a margin, or neglect costs nothing and
   *  diligence buys nothing (writ §IV). A test proves the margin numerically. */
  household: Upkeep[];
  acts: Act[];
}

// ── The small holding's household ───────────────────────────────────────────
// The war household is a ~200-door company's month: $18,200 against $22k of
// full tribute. Poured over sixteen doors it is a rout before the first move —
// which is exactly the grand muster's flaw the campaign exists to answer.
//
// This is the same three kinds of cost at a small holding's scale: a room, the
// tools, and the squire who works it. The Regent draws nothing — the holding is
// his. Sixteen doors pay $1,920 of tribute a month, so the margin is $720 and
// visible on the ribbon; lose four doors to a withdrawn patron and it is gone.
//
// The ids are deliberately the war household's own, so every hand that already
// knows how to load and strike a household (isHouseholdUpkeep, the store's
// deploy and Reset) handles the campaign's without learning a new word.
export const CAMPAIGN_HOUSEHOLD: Upkeep[] = [
  {
    id: 'wg-household-hall',
    label: 'The room above the mill (the holding’s hall, dues and post)',
    monthly: 520,
    recordedOn: '2026-07-28',
  },
  {
    id: 'wg-household-tools',
    label: 'The counting-house tools (subscriptions & sundry)',
    monthly: 280,
    recordedOn: '2026-07-28',
  },
  {
    id: 'wg-household-piers',
    label: 'Piers — the Regent’s squire, his days on this holding',
    monthly: 400,
    personId: 'piers',
    recordedOn: '2026-07-28',
  },
];

/** Raw untriaged tickets dealt when a scenario asks for none by name — the
 *  Regent's signature act needs something to walk down the tree. */
const CAMPAIGN_INTAKE = 2;

/** The oldest any open box of the campaign may be at deploy, in days. Under
 *  FESTER_DAYS on purpose: the holding's clock starts clean, so every day of
 *  aging the player later reads is one they themselves let pass. */
export const CAMPAIGN_FRESH_DAYS = 5;

// ── The readings the goals are folded from ──────────────────────────────────
// Small, shared, and all pure. Each takes the context and looks only at the
// board; none of them may be given a memory.

const dayMs = 86_400_000;

/** The mark every case of a muster bears — `wg/<seed> · `. */
export function campaignMark(seed: string): string {
  return `${WAR_MARK}${seed} · `;
}

/** Days the holding has been held, in game time. */
export function daysHeld(ctx: CampaignContext): number {
  const ms = Date.parse(ctx.now) - Date.parse(ctx.startedAt);
  return Number.isFinite(ms) && ms > 0 ? Math.floor(ms / dayMs) : 0;
}

/** Every case of this holding, folded. */
function holdingCases(ctx: CampaignContext): CaseReading[] {
  const mark = campaignMark(ctx.seed);
  return readCases(ctx.log).filter((c) => c.caseId.includes(mark));
}

/** True once the holding has actually been dealt. Several goals are about
 *  something being GONE from the board, and a board with nothing on it would
 *  read them as met — an undealt campaign must never read as a won one. */
function dealt(ctx: CampaignContext): boolean {
  const mark = campaignMark(ctx.seed);
  return ctx.log.some((e) => e.caseId.includes(mark));
}

const NOT_DEALT: GoalReading = {
  met: false,
  progress: 'The holding is not dealt yet.',
};

/** The door a case names, as the rolls know it — the segment that carries a
 *  street and a unit, with any tenant suffix stripped. */
function doorLine(caseId: string): string {
  const seg = caseId.split(' · ').find((s) => s.includes(', '));
  return seg ? seg.split(' — ')[0].trim() : caseId;
}

// ── The Intro Campaign — "A Small Holding" ──────────────────────────────────
// Six acts, each one herald and one goal, in the order the writ sets them
// (§IV). Nothing is gated: a player may wander, and the acts simply read where
// they read. The lesson is the causal loop the machine already measures —
// delegate the work, the faith holds, the doors stay, the coffers hold — and
// the money is downstream of the work.

const ACT_HEAD_THE_CRAFT: Act = {
  key: 'the-realm-is-yours',
  title: 'The realm is yours',
  herald:
    'Sixteen doors, two knights, and one Crown office standing with no head — a vacancy is a decision waiting on you, not a gap in the rolls.',
  deal: {
    says: 'Sixteen doors under two knights, four cascades already in motion, and the Office of Works left with no Chancellor.',
    // The work you INHERIT — four grammars part-walked, so the board reads as an
    // operation someone has been running, not a blank page. Every one is fresh:
    // the ages are declared under the festering threshold, because a backlog
    // that arrives stale saturates the gauge and then reads the same whether
    // the player is diligent or asleep (writ §II).
    cascades: [
      { flow: 'lease-renewal', box: 'renewal', walk: 3, idleDays: 2 },
      { flow: 'violation-notice', box: 'notice', walk: 2, idleDays: 4 },
      { flow: 'move-out-relay', box: 'move-out', walk: 4, idleDays: 3 },
      {
        flow: 'vendor-dispatch',
        box: 'refrigerator down',
        leaf: 'maintenance.appliance.refrigerator',
        walk: 2,
        idleDays: 3,
      },
    ],
    vacate: ['office-works'],
  },
  goal: (ctx) => {
    // Every act is guarded the same way: a board with no holding on it has of
    // course no headless craft either, and reading that as the act won would
    // hand the player a finished campaign they never played.
    if (!dealt(ctx)) return NOT_DEALT;
    const crafts = readGuilds(ctx.kingdom, ctx.log, ctx.now);
    const headless = unmannedGuilds(crafts);
    const headed = crafts.length - headless.length;
    if (headless.length === 0) {
      return {
        met: true,
        progress: `Every Crown office is headed — ${headed} of ${crafts.length}.`,
      };
    }
    return {
      met: false,
      // The offices are NOT named here. The board's own rail lists every one
      // of them by name with "seat open" beneath it, and the herald beside
      // this card listed them again — three copies of the same three names
      // on one screen, which is what a dense card is actually made of.
      progress: `${headed} of ${crafts.length} Crown offices headed.`,
    };
  },
};

const ACT_WALK_ONE_CASE: Act = {
  key: 'work-arrives',
  title: 'Work arrives',
  herald:
    'A door reports no cooling; the cascade knows every step it must take, and none of them takes itself.',
  deal: {
    says: 'One fresh vendor dispatch standing at its first step, and two raw tickets nobody has typed yet.',
    cascades: [
      { flow: 'vendor-dispatch', box: 'no cooling', leaf: 'maintenance.hvac.no-cooling', walk: 0, idleDays: 1 },
    ],
    intake: 2,
  },
  goal: (ctx) => {
    if (!dealt(ctx)) return NOT_DEALT;
    const mark = campaignMark(ctx.seed);
    const cascades = readFlows(ctx.flows, ctx.log, ctx.now).filter((f) =>
      f.caseId.includes(mark),
    );
    const done = cascades.filter((f) => f.status === 'done');
    if (done.length > 0) {
      return {
        met: true,
        progress: `${done.length} cascade${done.length === 1 ? '' : 's'} walked to done — the first was ${doorLine(done[0].caseId)}.`,
      };
    }
    const furthest = cascades.reduce(
      (best, f) => (best && best.advanced >= f.advanced ? best : f),
      cascades[0],
    );
    return {
      met: false,
      progress: furthest
        ? `${cascades.length} cascades stand open; the furthest along is ${doorLine(furthest.caseId)} at step ${furthest.advanced + 1} of ${furthest.steps.length}.`
        : 'No cascade stands open on the holding.',
    };
  },
};

const ACT_OFF_THE_DESK: Act = {
  key: 'one-desk-cannot-hold-it',
  title: 'One desk cannot hold it',
  herald:
    'Four boxes came to the Regent for want of a desk to put them on; a catch-basin is not a queue, and it does not empty itself.',
  deal: {
    says: 'Four typed boxes landed on the Regent’s own hand.',
    boxes: [
      {
        row: 'rent-post',
        box: 'rent posting',
        holder: THE_REGENT,
        idleDays: 1,
        says: 'The month’s rent wants posting at this door, and it came to the Regent for want of a desk.',
      },
      {
        row: 'delinquency',
        box: 'delinquency',
        holder: THE_REGENT,
        idleDays: 2,
        says: 'Rent unpaid past grace at this door — it landed on the Regent, who cannot chase every purse himself.',
      },
      {
        row: 'renewal',
        box: 'renewal',
        holder: THE_REGENT,
        idleDays: 0,
        says: 'A term runs out at this door and the renewal came to the Regent, because no Crown office holds that trade.',
      },
      {
        row: 'work-order',
        box: 'work order',
        holder: THE_REGENT,
        idleDays: 2,
        says: 'A thing happened at this door and nobody knew whose it was, so it came to the Regent.',
      },
    ],
  },
  goal: (ctx) => {
    if (!dealt(ctx)) return NOT_DEALT;
    const rid = regent(ctx.kingdom)?.id ?? null;
    const held = holdingCases(ctx).filter(
      (c) => c.status !== 'done' && (rid ? c.holder === rid : c.holder == null),
    );
    return {
      met: held.length === 0,
      progress:
        held.length === 0
          ? 'The Regent’s hand is empty — every box of the holding sits on a real desk.'
          : `${held.length} box${held.length === 1 ? '' : 'es'} still rest on the Regent’s own hand.`,
    };
  },
};

/** How many of the clerks' proposals the Crown must answer to close act four. */
export const PROPOSALS_TO_ANSWER = 3;

const ACT_THE_CLERKS: Act = {
  key: 'the-clerks',
  title: 'The clerks',
  herald:
    'The fleet reasons over the standing work and stops at the human word — a clerk proposes, the Regent decides, and overruling is an answer, not a failure.',
  deal: {
    says: 'No new work: the clerks reason over the boxes already standing.',
  },
  goal: (ctx) => {
    if (!dealt(ctx)) return NOT_DEALT;
    // Count PROPOSALS, not cases that happen to hold one. This counted a case
    // once however many times a clerk had spoken on it, while its own line said
    // "proposals answered" — so a fleet run that parked four proposals across
    // two cases read "2 of 3", and a player who had answered everything in front
    // of them could not see why the act would not close. A number and its label
    // must be the same fact; that is the whole of the lesson this session keeps
    // teaching. (Found by playing the campaign through, 2026-07-27.)
    let answered = 0;
    let waiting = 0;
    for (const c of holdingCases(ctx)) {
      let open = 0; // clerk proposals on this case still unanswered
      for (const e of c.events) {
        if (e.kind === 'proposed' && (e.actor ?? '').startsWith('agent:')) {
          open++;
          continue;
        }
        // A ratification or an overrule that lands after a clerk's proposal is
        // the Crown's answer to it. Both count: the writ is explicit that
        // overruling is a first-class answer, not a failure.
        if (open > 0 && (e.kind === 'approved' || e.kind === 'overridden')) {
          open--;
          answered++;
        }
      }
      waiting += open;
    }
    return {
      met: answered >= PROPOSALS_TO_ANSWER,
      progress:
        answered >= PROPOSALS_TO_ANSWER
          ? `${answered} of the clerks’ proposals answered — ratified or overruled.`
          : `${answered} of ${PROPOSALS_TO_ANSWER} proposals answered; ${waiting} stand before the court.`,
    };
  },
};

const ACT_NEGLECT_HAS_A_PRICE: Act = {
  key: 'neglect-has-a-price',
  title: 'Neglect has a price',
  herald:
    'One door has stood nearly a week untouched, and the clock is the opponent — a crisis erodes a patron’s faith week by week until they recall their doors.',
  deal: {
    says: 'One dispatch dealt at the brink of festering — the door that cracks first.',
    cascades: [
      { flow: 'vendor-dispatch', box: 'active leak', leaf: 'maintenance.plumbing.leak', walk: 1, idleDays: 6 },
    ],
  },
  goal: (ctx) => {
    if (!dealt(ctx)) return NOT_DEALT;
    const patrons = readPatrons(ctx.log, ctx.now, ctx.seed);
    const crises = patrons.reduce((n, p) => n + p.crises, 0);
    const lost = patrons.filter((p) => p.withdrawn);
    const held = daysHeld(ctx);
    // The watch is only survived once the clock has actually run: a board that
    // has stood for an hour has of course no crisis on it, and reading that as
    // the lesson learned would teach nothing at all.
    if (held < CRISIS_DAYS) {
      const worst = patrons[0];
      return {
        met: false,
        progress: `Day ${held} of ${CRISIS_DAYS} on the watch — ${crises} case${crises === 1 ? '' : 's'} in crisis${worst ? `, and ${worst.name}’s faith reads ${worst.faith}` : ''}.`,
      };
    }
    if (lost.length > 0) {
      return {
        met: false,
        progress: `${lost.map((p) => p.name).join(', ')} recalled their doors — the price was paid in full.`,
      };
    }
    return {
      met: crises === 0,
      progress:
        crises === 0
          ? `${held} days held and not one case in crisis — every patron still keeps faith.`
          : `${crises} case${crises === 1 ? '' : 's'} stand in crisis — clear them before a patron withdraws.`,
    };
  },
};

/** Days on the clock before the reckoning can be read — a month of the game's
 *  own time, not the wall's. */
export const CAMPAIGN_MONTH_DAYS = 30;

const ACT_THE_RECKONING: Act = {
  key: 'the-reckoning',
  title: 'The reckoning',
  herald:
    'Read the Counting-house at the month’s end: tribute against upkeep, and what every door you kept is worth — the money is downstream of the work.',
  deal: {
    says: 'No new work: the month itself is the act.',
  },
  goal: (ctx) => {
    if (!dealt(ctx)) return NOT_DEALT;
    const patrons = readPatrons(ctx.log, ctx.now, ctx.seed);
    const coffers = readCoffers(
      retainedDoors(patrons).length,
      ctx.economy,
      ctx.money,
      ctx.treasury,
    );
    const held = daysHeld(ctx);
    const line = `${coin(coffers.tributeMonthly)} tribute on ${coffers.doors} doors against ${coin(coffers.upkeepMonthly)} upkeep — the month runs ${coffers.trend >= 0 ? '+' : '−'}${coin(Math.abs(coffers.trend))}`;
    if (held < CAMPAIGN_MONTH_DAYS) {
      return { met: false, progress: `Day ${held} of ${CAMPAIGN_MONTH_DAYS} — ${line}.` };
    }
    if (coffers.dry) {
      return { met: false, progress: `The month closed with the coffers dry — ${line}.` };
    }
    return {
      met: coffers.trend > 0,
      progress:
        coffers.trend > 0
          ? `The month closed in the black — ${line}.`
          : `The month closed to the bad — ${line}.`,
    };
  },
};

export const INTRO_CAMPAIGN: Scenario = {
  key: 'a-small-holding',
  title: 'A Small Holding',
  blurb:
    'Sixteen doors, two knights, and a clean clock. Learn the loop the kingdom runs on — head the Crown offices, keep the work moving, and the coffers keep themselves — then take the grand muster, which is two hundred doors and does not wait.',
  doors: 16,
  knights: 2,
  household: CAMPAIGN_HOUSEHOLD,
  acts: [
    ACT_HEAD_THE_CRAFT,
    ACT_WALK_ONE_CASE,
    ACT_OFF_THE_DESK,
    ACT_THE_CLERKS,
    ACT_NEGLECT_HAS_A_PRICE,
    ACT_THE_RECKONING,
  ],
};

/** The shelf — every scenario the library holds. The resolution test walks this
 *  list, so nothing goes on it that the test does not cover (writ §I). */
export const MUSTER_LIBRARY: Scenario[] = [INTRO_CAMPAIGN];

// ── Dealing the campaign ────────────────────────────────────────────────────
// The WORLD — doors, tenants, settled leases, knights and their placements, the
// raw intake and the whole month of coin — comes from `generateWarGame` with
// small numbers. There is no second dealer. What is composed below is only the
// acts' own declared boxes, opened through the SAME flow engine the generator
// itself opens cascades with (instantiateFlow / handStep), because an act needs
// to name its kind, its door and its age, and the generator deals those by
// dice. The dice are the right answer for a stress test and the wrong one for a
// lesson.

export interface CampaignDeal extends WarGame {
  scenario: Scenario;
  /** The upkeep this holding bears — load it as the household on deploy (the
   *  ids are the war household's, so the existing load/strike handles it). */
  household: Upkeep[];
  /** Crown offices the deploy must leave headless: strike their grants (see
   *  `vacateOffices`). A vacancy is a decision, and removal IS revocation. */
  vacate: string[];
}

export function generateCampaign(opts: {
  /** Game-now: the holding is dealt as of this instant, and its clock starts
   *  here. */
  end: string;
  /** The loaded flow book — the cascades are instances of ITS grammars. */
  flows: FlowBook;
  /** The loaded catalog — the leaves whose letters the cascades render. */
  catalog: Catalog;
  /** The living census — the deal resolves THE_REGENT against it. */
  kingdom: Kingdom;
  seed?: string;
  scenario?: Scenario;
  economy?: EconomyBook;
  /** The log as it already stands, so a redeploy of the same seed appends only
   *  what is missing rather than doubling the acts' boxes. */
  log?: EventLog;
  dealt?: DealtGame;
}): CampaignDeal {
  const scenario = opts.scenario ?? INTRO_CAMPAIGN;
  const seed = (opts.seed ?? scenario.key).trim() || scenario.key;
  const end = opts.end;

  // Fold the acts' declared deals into one intent.
  const cascades: CascadeDeal[] = [];
  const boxes: BoxDeal[] = [];
  const vacate: string[] = [];
  let intake = 0;
  // A scenario that asks for NO raw intake is a different thing from one that
  // never mentions it, so the ask is tracked rather than inferred from a zero.
  let intakeAsked = false;
  for (const act of scenario.acts) {
    for (const c of act.deal.cascades ?? []) cascades.push(c);
    for (const b of act.deal.boxes ?? []) boxes.push(b);
    for (const v of act.deal.vacate ?? []) if (!vacate.includes(v)) vacate.push(v);
    if (act.deal.intake != null) {
      intake += act.deal.intake;
      intakeAsked = true;
    }
  }

  // The world, from the generator we already have. Small numbers throughout:
  //  · no standing 45-day stream (`boxesPerDay: 0`) — that stream is where the
  //    grand muster's stale backlog comes from, and the campaign's clock starts
  //    clean;
  //  · no relay drawn at random (`moveOutEvery` past the door count) — the acts
  //    name the cascades they want, on the doors they want, at the age they
  //    want;
  //  · `maxOpenAgeDays` under the festering threshold, so nothing the generator
  //    DOES deal (the raw intake) arrives already stuck;
  //  · the small holding's household, so tribute covers upkeep with a margin
  //    and neglect therefore costs something.
  const game = generateWarGame({
    seed,
    end,
    relay: opts.flows.find((f) => f.key === 'move-out-relay') ?? opts.flows[0],
    dispatch: opts.flows.find((f) => f.key === 'vendor-dispatch'),
    catalog: opts.catalog,
    doors: scenario.doors,
    boxesPerDay: 0,
    moveOutEvery: scenario.doors + 1,
    intake: intakeAsked ? intake : CAMPAIGN_INTAKE,
    maxOpenAgeDays: CAMPAIGN_FRESH_DAYS,
    economy: opts.economy,
    household: scenario.household,
    dealt: opts.dealt,
  });

  // The doors the acts hang their work on: the OCCUPIED ones, in the roster's
  // own order, one act-box to a door and round again if the acts outnumber
  // them. A door with a tenant is a door whose patron can lose faith, which is
  // the only kind of door a lesson about faith can be taught on.
  const tenants = dealtGame(game.events, seed).tenants;
  const occupied = game.doors.filter((d) => tenants.has(d.address));
  const standing = occupied.length ? occupied : game.doors;

  const already = new Set((opts.log ?? []).map((e) => e.caseId));
  const events: KingdomEvent[] = [];
  let n = 0;
  const id = () => `wgc-${seed.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${++n}`;
  const tally = { ...game.tally };
  const mark = (k: string, by = 1) => {
    tally[k] = (tally[k] ?? 0) + by;
  };
  let at = 0; // which door the next act-box lands on

  const rid = regent(opts.kingdom)?.id ?? null;

  for (const c of cascades) {
    const tpl = opts.flows.find((f) => f.key === c.flow);
    if (!tpl) continue; // a grammar the loaded book does not hold: deal nothing
    const door = standing[at++ % standing.length];
    const walked = dealCascade({ tpl, c, door, tenant: tenants.get(door.address), seed, end, id, catalog: opts.catalog, already });
    for (const e of walked) events.push(e);
    if (walked.length) mark(`${c.box} cascade`);
  }

  for (const b of boxes) {
    const door = standing[at++ % standing.length];
    const holder = b.holder === THE_REGENT ? rid : b.holder;
    const caseId = `${WAR_MARK}${seed} · ${b.box} · ${door.address}`;
    if (already.has(caseId)) continue;
    events.push({
      id: id(),
      at: daysBack(end, b.idleDays),
      caseId,
      kind: 'opened',
      ...(holder ? { holder } : {}),
      catalogRow: b.row,
      estateId: door.address,
      // The owner rides the opening note, because that line — and only that
      // line — is how the consequence engine folds this case's harm onto its
      // patron. Drop it and the box is real work that nobody's faith answers for.
      note: `${b.says} Owner: ${door.owner}.`,
    });
    // The tally names the box as the act named it — no naive plural, which is
    // how a line reading "delinquencys" reaches a human's eye.
    mark(`${b.box} box`);
  }

  const all = [...game.events, ...events].sort((a, b) =>
    a.at < b.at ? -1 : a.at > b.at ? 1 : 0,
  );
  return {
    ...game,
    events: all,
    tally,
    scenario,
    household: scenario.household,
    vacate,
  };
}

function daysBack(end: string, days: number): string {
  return new Date(Date.parse(end) - days * dayMs).toISOString();
}

/** One declared cascade, opened and walked exactly as far as the act says.
 *  Its last event lands `idleDays` before game-now — the age is DECLARED, not
 *  a consequence of how many steps happened to fit. */
function dealCascade(o: {
  tpl: FlowTemplate;
  c: CascadeDeal;
  door: WarDoor;
  tenant: string | undefined;
  seed: string;
  end: string;
  id: () => string;
  catalog: Catalog;
  already: Set<string>;
}): KingdomEvent[] {
  const { tpl, c, door, seed, end, id } = o;
  const walk = Math.max(0, Math.min(c.walk, tpl.steps.length - 1));
  const subject =
    `${WAR_MARK}${seed} · ${c.box} · ${door.address}` + (o.tenant ? ` — ${o.tenant}` : '');
  const caseId = `${tpl.key}: ${subject}`;
  if (o.already.has(caseId)) return [];
  // One day per worked step, then the declared idle age — so the case's own
  // history reads as a hand working it, and its age reads as the truth.
  const openedDaysAgo = walk + c.idleDays;
  const leaf = findRow(o.catalog, c.leaf);
  const params = fullParams(tpl, leaf?.params);
  const events: KingdomEvent[] = [];
  const instance = instantiateFlow(
    tpl,
    subject,
    { at: daysBack(end, openedDaysAgo), id, estateId: door.address },
    params,
  );
  for (const e of instance.events) {
    if (e.kind === 'opened')
      e.note = `${e.note} The war horn sounds — a training muster, not a real notice. Owner: ${door.owner}.`;
    events.push(e);
  }
  for (let s = 0; s < walk; s++) {
    const stepAt = daysBack(end, openedDaysAgo - (s + 1));
    events.push({
      id: id(),
      at: stepAt,
      caseId: instance.caseId,
      kind: 'done',
      catalogRow: tpl.steps[s].catalogRow,
      holder: tpl.steps[s].holder,
      note: `Step ${s + 1}/${tpl.steps.length} · done — worked in the muster.`,
    });
    events.push(handStep(tpl, instance.caseId, s + 1, { at: stepAt, id }, params));
  }
  return events;
}

/** The acts book with the named offices left headless — the grants and keeper
 *  appointments on them struck. Pure: records out, not a flag. The player heads
 *  the craft by granting it again, which is act one. */
export function vacateOffices(acts: ActsBook, territoryIds: string[]): ActsBook {
  const wanted = new Set(territoryIds);
  return {
    ...acts,
    grants: acts.grants.filter((g) => !wanted.has(g.territoryId)),
    appointments: acts.appointments.filter((a) => !wanted.has(a.territoryId)),
  };
}

// ── The campaign, read ──────────────────────────────────────────────────────

export interface ActReading {
  act: Act;
  /** 1-based — the act's place in the campaign. */
  number: number;
  met: boolean;
  progress: string;
  /** True for the first act whose goal is unmet: the one the Council names. */
  current: boolean;
}

export interface CampaignReading {
  scenario: Scenario;
  acts: ActReading[];
  /** The act in hand — the first whose goal is unmet, or null when the whole
   *  campaign reads done. */
  current: ActReading | null;
  /** How many acts read complete. Not "how far you got": an act that comes
   *  undone (a craft unseated again) stops reading complete, as it should. */
  complete: number;
  total: number;
  finished: boolean;
  /** The current act's line, hoisted for the ribbon. */
  progress: string;
}

/** Fold the campaign: which act stands, how many are complete, and the line
 *  that says how far along the standing one is. A reading like every other —
 *  nothing here is stored, and nothing here writes. */
export function readCampaign(scenario: Scenario, ctx: CampaignContext): CampaignReading {
  const acts: ActReading[] = scenario.acts.map((act, i) => {
    const r = act.goal(ctx);
    return { act, number: i + 1, met: r.met, progress: r.progress, current: false };
  });
  const current = acts.find((a) => !a.met) ?? null;
  if (current) current.current = true;
  return {
    scenario,
    acts,
    current,
    complete: acts.filter((a) => a.met).length,
    total: acts.length,
    finished: current == null,
    progress: current
      ? current.progress
      : 'The holding is learned — the realm is two hundred doors, and it does not wait.',
  };
}
