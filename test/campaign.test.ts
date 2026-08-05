// The library resolution test (docs/WRIT-THE-CAMPAIGN.md §I) — and the
// campaign's own arithmetic.
//
// A scenario is a recipe, and a recipe NAMES things: a flow key, a catalog row,
// a step's holder, an office. A rename orphans every one of those silently, and
// the muster deals broken. That is the stringly-typed fault this codebase has
// shipped five times (the command bar, `keepOf`, the household's dead territory
// ids, the merge sentinel, `renewal_fee`). So: every name every scenario on the
// shelf speaks is resolved here against the founding setting, and a rename
// fails the build loudly instead of dealing a broken world quietly.
//
// Nothing goes on the shelf that this test does not cover.

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  CAMPAIGN_FRESH_DAYS,
  CAMPAIGN_MONTH_DAYS,
  INTRO_CAMPAIGN,
  MUSTER_LIBRARY,
  PROPOSALS_TO_ANSWER,
  THE_REGENT,
  campaignMark,
  generateCampaign,
  readCampaign,
  vacateOffices,
  type CampaignContext,
  type Scenario,
} from '../src/domain/campaign';
import { FOUNDING_CATALOG, findRow } from '../src/domain/catalog';
import { FOUNDING_FLOWS } from '../src/domain/flows';
import { generateWarGame } from '../src/domain/wargame';
import { assembleKingdom } from '../src/domain/court';
import { economyOf, type Chronicle } from '../src/domain/chronicle';
import { FESTER_DAYS, CRISIS_DAYS, readPatrons, retainedDoors } from '../src/domain/consequences';
import { SEAT_GUILD, readGuilds, unmannedGuilds } from '../src/domain/guilds';
import { ageInDays, outcomes, readCases } from '../src/domain/events';
import type { KingdomEvent } from '../src/domain/events';
import { completeStep, proposeStep, approveStep, readFlows } from '../src/domain/flows';
import { readPods } from '../src/domain/pods';
import { readCoffers } from '../src/domain/treasury';
import { readThrone } from '../src/domain/throne';
import { foundingDoc, grandMusterDoc } from './fixtures';

const END = '2026-07-28T00:00:00.000Z';
const SEED = INTRO_CAMPAIGN.key;
const dayMs = 86_400_000;

const later = (iso: string, days: number) =>
  new Date(Date.parse(iso) + days * dayMs).toISOString();

/** Deploy the campaign into a founding chronicle exactly as the store would:
 *  the events and coin appended, the small holding's household loaded, the
 *  named office left headless. */
function deploy(scenario: Scenario = INTRO_CAMPAIGN, seed = SEED) {
  const doc = foundingDoc();
  const deal = generateCampaign({
    end: END,
    flows: doc.flows,
    catalog: doc.catalog,
    kingdom: assembleKingdom(doc.census, doc.acts),
    scenario,
    seed,
  });
  doc.events = deal.events;
  doc.money = deal.money;
  doc.treasury = { upkeeps: deal.household };
  doc.acts = vacateOffices(doc.acts, deal.vacate);
  doc.wargame = {
    seed,
    now: deal.now,
    deployedAt: END,
    tally: deal.tally,
    doors: deal.doors,
  } as Chronicle['wargame'];
  return { doc, deal };
}

function ctxOf(doc: Chronicle, now = END, seed = SEED, startedAt = END): CampaignContext {
  return {
    kingdom: assembleKingdom(doc.census, doc.acts),
    log: doc.events,
    money: doc.money,
    economy: economyOf(doc),
    treasury: doc.treasury,
    flows: doc.flows,
    seed,
    now,
    startedAt,
  };
}

/** True when a holder id names something real: a census person, or a desk the
 *  seats' map knows. A holder that resolves to neither is a dead seat — the
 *  exact rename fault this file guards. */
function holderResolves(holder: string): boolean {
  const doc = foundingDoc();
  return (
    doc.census.people.some((p) => p.id === holder) || Object.hasOwn(SEAT_GUILD, holder)
  );
}

// ── The resolution test ─────────────────────────────────────────────────────

describe('the muster library resolves against the founding setting', () => {
  for (const scenario of MUSTER_LIBRARY) {
    describe(scenario.title, () => {
      it('every flow key an act names stands in the flow book', () => {
        for (const act of scenario.acts) {
          for (const c of act.deal.cascades ?? []) {
            expect(
              FOUNDING_FLOWS.some((f) => f.key === c.flow),
              `act "${act.key}" names flow "${c.flow}", which the founding book does not hold`,
            ).toBe(true);
          }
        }
      });

      it('every catalog row an act names stands in the catalog', () => {
        for (const act of scenario.acts) {
          for (const b of act.deal.boxes ?? []) {
            expect(
              findRow(FOUNDING_CATALOG, b.row),
              `act "${act.key}" names row "${b.row}", which the founding catalog does not hold`,
            ).toBeDefined();
          }
          for (const c of act.deal.cascades ?? []) {
            if (!c.leaf) continue;
            const leaf = findRow(FOUNDING_CATALOG, c.leaf);
            expect(leaf, `act "${act.key}" names leaf "${c.leaf}"`).toBeDefined();
            // A leaf bound to ANOTHER grammar would render the wrong letters
            // into the wrong cascade — resolvable but wrong, which is worse.
            expect(
              leaf!.completes,
              `leaf "${c.leaf}" completes "${leaf!.completes}", not the "${c.flow}" the act deals it into`,
            ).toBe(c.flow);
          }
        }
      });

      it('every step of every named flow resolves — row, holder and key', () => {
        const named = new Set(
          scenario.acts.flatMap((a) => (a.deal.cascades ?? []).map((c) => c.flow)),
        );
        for (const key of named) {
          const tpl = FOUNDING_FLOWS.find((f) => f.key === key)!;
          expect(tpl.steps.length, `flow "${key}" has no steps`).toBeGreaterThan(0);
          for (const s of tpl.steps) {
            expect(s.key.trim(), `flow "${key}" has a nameless step`).not.toBe('');
            expect(
              findRow(FOUNDING_CATALOG, s.catalogRow),
              `flow "${key}" step "${s.key}" names row "${s.catalogRow}", which the catalog does not hold`,
            ).toBeDefined();
            expect(
              holderResolves(s.holder),
              `flow "${key}" step "${s.key}" hands to "${s.holder}", which is neither a person nor a known desk`,
            ).toBe(true);
          }
        }
      });

      it('every seat an act names resolves', () => {
        for (const act of scenario.acts) {
          for (const b of act.deal.boxes ?? []) {
            if (b.holder === THE_REGENT) continue; // the role, resolved at deal time
            expect(
              holderResolves(b.holder),
              `act "${act.key}" hands a box to "${b.holder}", which is neither a person nor a known desk`,
            ).toBe(true);
          }
        }
      });

      it('every office an act leaves headless stands in the census', () => {
        const doc = foundingDoc();
        for (const act of scenario.acts) {
          for (const v of act.deal.vacate ?? []) {
            expect(
              doc.census.territories.some((t) => t.id === v),
              `act "${act.key}" vacates "${v}", which the census does not hold`,
            ).toBe(true);
            // …and something must actually be seated there, or "vacate" vacates
            // nothing and act one is met before it begins.
            expect(
              doc.acts.grants.some((g) => g.territoryId === v),
              `nothing is seated at "${v}" to vacate`,
            ).toBe(true);
          }
        }
      });

      it('the THE_REGENT role resolves against the census it is dealt into', () => {
        const doc = foundingDoc();
        expect(doc.census.people.some((p) => p.pledge === 'steward')).toBe(true);
      });

      it('every named box and cascade actually LANDS on the board', () => {
        // The strongest form of the guard: not "the name resolves" but "the
        // deal, dealt, produced the case the recipe asked for". A silent
        // fall-through in the dealer reads exactly like a rename to a player.
        const { doc } = deploy(scenario, scenario.key);
        const flows = readFlows(doc.flows, doc.events, END);
        const cases = readCases(doc.events);
        for (const act of scenario.acts) {
          for (const c of act.deal.cascades ?? []) {
            expect(
              flows.some((f) => f.template.key === c.flow && f.caseId.includes(` · ${c.box} · `)),
              `act "${act.key}" declared a "${c.box}" ${c.flow} and none was dealt`,
            ).toBe(true);
          }
          for (const b of act.deal.boxes ?? []) {
            expect(
              cases.some((x) => x.caseId.includes(` · ${b.box} · `) && x.catalogRow === b.row),
              `act "${act.key}" declared a "${b.box}" box and none was dealt`,
            ).toBe(true);
          }
        }
      });
    });
  }
});

// ── The shape of the holding ────────────────────────────────────────────────

describe('A Small Holding — what it deals', () => {
  it('deals the scenario’s doors and knights', () => {
    const { doc, deal } = deploy();
    expect(deal.doors).toHaveLength(INTRO_CAMPAIGN.doors);
    expect(readPods(doc.events, END, SEED)).toHaveLength(INTRO_CAMPAIGN.knights);
  });

  it('deals six cascades, four boxes on the Regent, and two raw tickets', () => {
    const { doc } = deploy();
    const mark = campaignMark(SEED);
    const flows = readFlows(doc.flows, doc.events, END).filter((f) => f.caseId.includes(mark));
    expect(flows).toHaveLength(6);
    const kingdom = assembleKingdom(doc.census, doc.acts);
    const onRegent = readThrone(kingdom, doc.events, END).onRegent;
    expect(onRegent?.cases ?? []).toHaveLength(4);
    const intake = readCases(doc.events).filter((c) => c.caseId.includes(' · intake · '));
    expect(intake).toHaveLength(2);
  });

  it('nothing dealt is STALE — the clock starts clean', () => {
    const { doc } = deploy();
    const open = readCases(doc.events).filter((c) => c.status !== 'done');
    expect(open.length).toBeGreaterThan(0);
    for (const c of open) {
      const age = ageInDays(c, END) ?? 0;
      expect(age, `${c.caseId} arrived ${age} days stale`).toBeLessThan(FESTER_DAYS);
      expect(age).toBeLessThanOrEqual(CAMPAIGN_FRESH_DAYS + 1);
    }
    expect(outcomes(doc.events, END).stuck).toBe(0);
  });

  it('is SOLVENT at rest, with a margin, and the Crown’s own coin is not gone', () => {
    const { doc } = deploy();
    const patrons = readPatrons(doc.events, END, SEED);
    const coffers = readCoffers(
      retainedDoors(patrons).length,
      economyOf(doc),
      doc.money,
      doc.treasury,
    );
    // The numbers, not a vibe: the demo management rate on the demo rent per
    // retained door, against the small holding's hall. The margin is what makes
    // neglect cost something.
    const upkeep = INTRO_CAMPAIGN.household.reduce((n, u) => n + u.monthly, 0);
    expect(upkeep).toBe(1200);
    expect(coffers.doors).toBeGreaterThanOrEqual(13);
    expect(coffers.tributeMonthly).toBe(coffers.doors * 112.5);
    expect(coffers.upkeepMonthly).toBe(upkeep);
    expect(coffers.trend).toBeGreaterThan(300);
    expect(coffers.fallen).toBe(false);
    expect(coffers.dry).toBe(false);
  });

  it('is meaningfully SMALLER than the grand muster', () => {
    const { doc } = deploy();
    const { doc: grand, game } = grandMusterDoc();
    expect(doc.wargame!.doors!.length).toBeLessThan(game.doors.length / 10);
    const small = outcomes(doc.events, END).open;
    const big = outcomes(grand.events, '2026-07-21T00:00:00.000Z').open;
    expect(small).toBeLessThan(big / 20);
    // And it is small in absolute terms too — a first board a human can read.
    expect(small).toBeLessThanOrEqual(16);
  });

  it('the grand muster is UNCHANGED by the campaign’s knobs — a GOLDEN fingerprint', () => {
    // The one hard constraint: every existing caller must deal EXACTLY as it
    // did before the two knobs existed. Comparing two runs of the current code
    // to each other cannot show that — it is true however the code behaves.
    // These hashes were taken from the generator as it stood at b30264c, BEFORE
    // the knobs landed, and they pin the whole deal: every event's id, instant,
    // case and kind, and every money event's id, instant, kind and amount.
    //
    // The knobs are safe because each one changes only how a die's RESULT is
    // used, never how many dice are drawn — `Math.min(d.int(0, 12), back, cap)`
    // draws the same die as `Math.min(d.int(0, 12), back)`. That is the whole
    // argument, and this test is what keeps it true.
    const fp = (evts: { id: string; at: string; caseId: string; kind: string }[]) =>
      createHash('sha256')
        .update(evts.map((e) => e.id + e.at + e.caseId + e.kind).join('|'))
        .digest('hex')
        .slice(0, 16);
    const mfp = (m: { id: string; at: string; kind: string; amountCents: number }[]) =>
      createHash('sha256')
        .update(m.map((x) => x.id + x.at + x.kind + x.amountCents).join('|'))
        .digest('hex')
        .slice(0, 16);

    const a = grandMusterDoc('alpha-probe');
    expect(a.game.events.length).toBe(7644);
    expect(fp(a.game.events)).toBe('807996e731e92584');
    expect(mfp(a.game.money)).toBe('db95c168d20402af');

    const b = grandMusterDoc('the-first-muster');
    expect(b.game.events.length).toBe(8052);
    expect(fp(b.game.events)).toBe('49fc0ddbc48ce6bf');
    expect(mfp(b.game.money)).toBe('1149a2853b07126e');

    // And the plain war game — the campaign calls the same function, so this is
    // the caller most at risk from a knob that leaked a default.
    const relay = FOUNDING_FLOWS.find((f) => f.key === 'move-out-relay')!;
    const dispatch = FOUNDING_FLOWS.find((f) => f.key === 'vendor-dispatch');
    const plain = generateWarGame({
      seed: 'plain-probe',
      end: '2026-07-21T00:00:00.000Z',
      relay,
      dispatch,
      catalog: FOUNDING_CATALOG,
    });
    expect(plain.events.length).toBe(1857);
    expect(fp(plain.events)).toBe('30604c997c4c7bbf');
    expect(mfp(plain.money)).toBe('0217d2e8ba6386a8');

    // The full war household still weighs on a muster nobody told otherwise.
    const upkeep =
      a.game.money
        .filter((m) => m.kind === 'corp_expense')
        .reduce((n, m) => n + m.amountCents, 0) / 100;
    expect(upkeep).toBe(18_200);
  });
});

// ── The goals are readings ──────────────────────────────────────────────────

describe('the six goals read the board', () => {
  it('every goal reads UNMET on a fresh deploy', () => {
    const { doc } = deploy();
    const r = readCampaign(INTRO_CAMPAIGN, ctxOf(doc));
    expect(r.complete).toBe(0);
    expect(r.finished).toBe(false);
    expect(r.current?.act.key).toBe(INTRO_CAMPAIGN.acts[0].key);
    for (const a of r.acts) {
      expect(a.met, `${a.act.key} read met on a fresh deploy: ${a.progress}`).toBe(false);
      expect(a.progress.trim()).not.toBe('');
    }
  });

  it('act one is met by SEATING the empty craft — a record, not a flag', () => {
    const { doc } = deploy();
    const act = INTRO_CAMPAIGN.acts[0];
    expect(act.goal(ctxOf(doc)).met).toBe(false);
    doc.acts = {
      ...doc.acts,
      grants: [
        ...doc.acts.grants,
        {
          id: 'grant-works-mabel-again',
          territoryId: 'office-works',
          personId: 'mabel',
          role: 'lord',
          grantedOn: '2026-07-28',
        },
      ],
    };
    expect(act.goal(ctxOf(doc)).met).toBe(true);
    // …and it comes UNDONE again when the record is struck. A stored flag could
    // not do that, which is the whole reason a goal is a reading.
    doc.acts = { ...doc.acts, grants: doc.acts.grants.slice(0, -1) };
    expect(act.goal(ctxOf(doc)).met).toBe(false);
    expect(unmannedGuilds(readGuilds(assembleKingdom(doc.census, doc.acts), doc.events, END)))
      .toHaveLength(1);
  });

  it('act two is met by WALKING a cascade to done', () => {
    const { doc } = deploy();
    const act = INTRO_CAMPAIGN.acts[1];
    expect(act.goal(ctxOf(doc)).met).toBe(false);
    const flow = readFlows(doc.flows, doc.events, END).find((f) =>
      f.caseId.includes(' · no cooling · '),
    )!;
    expect(flow).toBeDefined();
    let n = 0;
    const id = () => `walk-${++n}`;
    for (let i = 0; i < flow.template.steps.length; i++) {
      doc.events.push(
        ...completeStep(flow.template, flow.caseId, i, { at: later(END, 1), id }),
      );
    }
    const r = act.goal(ctxOf(doc, later(END, 1)));
    expect(r.met).toBe(true);
    expect(r.progress).toMatch(/walked to done/);
  });

  it('act three is met by getting the boxes onto real desks', () => {
    const { doc } = deploy();
    const act = INTRO_CAMPAIGN.acts[2];
    expect(act.goal(ctxOf(doc)).met).toBe(false);
    const kingdom = assembleKingdom(doc.census, doc.acts);
    const onRegent = readThrone(kingdom, doc.events, END).onRegent!;
    let n = 0;
    for (const c of onRegent.cases) {
      doc.events.push({
        id: `hand-${++n}`,
        at: later(END, 1),
        caseId: c.caseId,
        kind: 'handed',
        holder: 'mabel',
        note: 'Handed to a real seat.',
      });
    }
    expect(act.goal(ctxOf(doc, later(END, 1))).met).toBe(true);
  });

  it('act four is met by ANSWERING three of the clerks’ proposals', () => {
    const { doc } = deploy();
    const act = INTRO_CAMPAIGN.acts[3];
    expect(act.goal(ctxOf(doc)).met).toBe(false);
    const mark = campaignMark(SEED);
    const flows = readFlows(doc.flows, doc.events, END)
      .filter((f) => f.caseId.includes(mark) && f.next)
      .slice(0, PROPOSALS_TO_ANSWER);
    expect(flows).toHaveLength(PROPOSALS_TO_ANSWER);
    let n = 0;
    const id = () => `clerk-${++n}`;
    for (const f of flows) {
      const i = f.next!.index - 1;
      doc.events.push(
        proposeStep(f.template, f.caseId, i, 'agent:works', {
          at: later(END, 1),
          id,
          note: 'The clerk reasoned and stopped for the word.',
        })!,
      );
    }
    // Proposals standing is not the goal — answering them is.
    expect(act.goal(ctxOf(doc, later(END, 1))).met).toBe(false);
    for (const f of flows) {
      const i = f.next!.index - 1;
      doc.events.push(
        ...approveStep(f.template, f.caseId, i, { at: later(END, 2), id }),
      );
    }
    const r = act.goal(ctxOf(doc, later(END, 2)));
    expect(r.met).toBe(true);
    expect(r.progress).toMatch(/answered/);
  });

  it('act five is met by holding the watch with no door in crisis', () => {
    const { doc } = deploy();
    const act = INTRO_CAMPAIGN.acts[4];
    expect(act.goal(ctxOf(doc)).met).toBe(false);
    // Let the clock run and touch nothing: the door dealt at the brink cracks.
    const abandoned = later(END, CRISIS_DAYS + 2);
    const neglected = act.goal(ctxOf(doc, abandoned));
    expect(neglected.met).toBe(false);
    expect(neglected.progress).toMatch(/crisis/);
    expect(readPatrons(doc.events, abandoned, SEED).some((p) => p.crises > 0)).toBe(true);
    // Now the diligent run: every open box worked on the way through.
    let n = 0;
    for (const c of readCases(doc.events).filter((x) => x.status !== 'done')) {
      doc.events.push({
        id: `work-${++n}`,
        at: later(END, CRISIS_DAYS),
        caseId: c.caseId,
        kind: 'noted',
        note: 'Worked on the round.',
      } as KingdomEvent);
    }
    const held = later(END, CRISIS_DAYS + 1);
    const r = act.goal(ctxOf(doc, held));
    expect(r.met).toBe(true);
    expect(readPatrons(doc.events, held, SEED).every((p) => !p.withdrawn)).toBe(true);
  });

  it('act six is met by ending a month in the black', () => {
    const { doc } = deploy();
    const act = INTRO_CAMPAIGN.acts[5];
    const fresh = act.goal(ctxOf(doc));
    expect(fresh.met).toBe(false);
    expect(fresh.progress).toMatch(new RegExp(`of ${CAMPAIGN_MONTH_DAYS}`));
    const monthEnd = later(END, CAMPAIGN_MONTH_DAYS + 1);
    const r = act.goal(ctxOf(doc, monthEnd));
    expect(r.met).toBe(true);
    expect(r.progress).toMatch(/in the black/);
  });

  it('every goal reads UNMET when no holding is dealt at all', () => {
    // A campaign nobody deployed must never read as a campaign somebody won:
    // most of these acts are about something being GONE from the board, and an
    // empty board would satisfy them all vacuously.
    const doc = foundingDoc();
    const r = readCampaign(INTRO_CAMPAIGN, ctxOf(doc));
    expect(r.complete).toBe(0);
    for (const a of r.acts) expect(a.met, a.act.key).toBe(false);
  });
});

// ── Act four counts PROPOSALS, not cases ────────────────────────────────────
// Found by playing it through: a fleet run parked four proposals across two
// cases, the goal counted the CASES, and its own line said "2 of 3 proposals
// answered" while the player had answered four. A number and its label must be
// the same fact.
describe('act four counts what its line says it counts', () => {
  it('two proposals answered on ONE case count as two', () => {
    const { doc } = deploy();
    const act = INTRO_CAMPAIGN.acts[3];
    const live = readFlows(doc.flows, doc.events, END);
    const target = live.find((f) => f.next != null)!;
    const tpl = doc.flows.find((f) => f.key === target.template.key)!;

    let n = 0;
    const at = (d: number) => later(END, d);
    const evs: KingdomEvent[] = [];
    // Two clerk proposals on the same case, each answered.
    for (const step of [0, 1]) {
      evs.push({
        id: `p${n++}`,
        at: at(step * 2 + 1),
        caseId: target.caseId,
        kind: 'proposed',
        actor: 'agent:va-desk',
        note: 'the clerk reasons',
      });
      evs.push(
        ...approveStep(tpl, target.caseId, step, { at: at(step * 2 + 2), id: () => `a${n++}` }),
      );
    }
    const ctx = ctxOf({ ...doc, events: [...doc.events, ...evs] }, later(END, 9));
    const r = act.goal(ctx);
    expect(r.progress).toMatch(/^2 of 3 proposals answered/);
  });
});
