// The War Table — the whole realm on one board (docs/KINGDOM.md, "The realm
// remodeled"; the ratified HUD reframe, rendered from the published concept
// mockup). A lit parchment realm-board in a dark iron frame:
//
//   • the RIBBON reads the coffers, the delegation debt, and the Patrons;
//   • the BOARD lays the PODS (the knights and the land they keep), the
//     CROWN OFFICES (the household's crafts, each under a Chancellor), the
//     Regent's catch-basin,
//     the undelegated posts, and the Patrons' ring across the vellum;
//   • the RAIL rides to every other surface of the app;
//   • the TIME control drives the war clock — deploy, advance, reset;
//   • the COUNCIL feed says what needs the Regent, each herald a road to
//     the act (law 6).
//
// Entering a pod, a Crown office, or the seat opens an OVERLAY PANEL over the board
// — no page reloads. Every act is a real store act: place an owner
// (regent.placeOwner), dub a knight (regent.commissionKnight), seat a
// master (court.grant), identify intake (regent.triggerTyped), hand a queue
// or a case (regent.handQueue / handCase), drive the clock (wargame.*).
// Nothing here is stored — every figure is folded fresh from the readings
// (readRealm / readThrone / severities), records in, readings out.

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { readRealm } from './domain/realm';
import { INTRO_CAMPAIGN, readCampaign } from './domain/campaign';
import type { PodReading, PodHealth } from './domain/pods';
import type { GuildReading } from './domain/guilds';
import type { PatronReading } from './domain/consequences';
import { severities } from './domain/consequences';
import { readThrone } from './domain/throne';
import type { SeatLoad, ThroneReading } from './domain/throne';
import type { CaseReading, EventLog } from './domain/events';
import { ageInDays, casesByCatalogRow, clerkProposals, outcomes, queues, readCases } from './domain/events';
import { readFlows } from './domain/flows';
import type { FlowReading } from './domain/flows';
import { readEscape } from './domain/escape';
import {
  coin,
  upkeepForPerson,
  upkeepForTerritories,
} from './domain/treasury';
import { atTheBorder, dispatchedTo, readMarches } from './domain/marches';
import { readArrivalText } from './domain/scribe';
import { caseLabel, seatLabel, titleFor } from './domain/caselabel';
import type { Catalog } from './domain/catalog';
import { MODE_MARK, rowsByDomain } from './domain/catalog';
import { grantable, isFoundingActId, isFoundingCensusId } from './domain/court';
import { FIEF_STATE_LABEL, king as kingOf, readFief, readKingdom, regent as regentOf } from './domain/states';
import type { CourtReading, Matter } from './domain/docket';
import { readCourt } from './domain/docket';
import { readRealmScene } from './domain/realmScene';
import type { RealmScene as ViewScene } from './realm/scene';
import FlatMapView from './table/FlatMapView';
import './realm/realm.css';
import type { CourtActions as RollActions, RollMatter } from './court';
import { useCourtRoll } from './court';
import type { FiefReading } from './domain/states';
import type { FiefState, Kingdom, Person } from './domain/types';
import type {
  CatalogActions,
  CensusActions,
  CourtActions,
  EconomyActions,
  EstateActions,
  EventsActions,
  FlowsActions,
  MarchesActions,
  RegentActions,
  TreasuryActions,
  WargameActions,
} from './store/chronicleStore';
import {
  balanceOf,
  bridgeCheck,
  coinCents,
  feeRuleFor,
  ownersInLog,
  readBudgetVsActual,
  readCompliance,
  needsOwnerApproval,
  readCorporateCoffers,
  readOwnerStatement,
  readPnL,
  readPostings,
  readSolvency,
  readBankRecs,
  spendCapFor,
} from './domain/economy';
import type { EconomyBook, MoneyKind } from './domain/economy';
import { applyEconomySetting, parseEconomySetting, summarizeSetting } from './domain/economySetting';
import type { EconomySettingPatch } from './domain/economySetting';
import { parseEstateBook } from './domain/estate';
import {
  CaseName,
  Explain,
  InlineLink,
  PLEDGE_LABEL,
  territoryLabel,
} from './components';
import LedgerView from './LedgerView';
import { CommandPalette } from './CommandPalette';
import { GO_KEYS, isTyping, MOD_K, type Command } from './keys';
import CensusView from './CensusView';
import FiefDetail from './FiefView';
import CrownView from './CrownView';
import PersonView from './PersonView';
import { DetailContext, useDetail, useToggleDetail } from './detail';
import { NavContext, useNav } from './nav';
import type { Nav } from './nav';

interface Props {
  kingdom: Kingdom;
  /** The event book — its `.log` is what the whole board folds from, and its
   *  acts (record / strike) are what the Ledger panel drives. */
  events: EventsActions;
  /** The loaded catalog book — its `.rows` are the tree the seat identifies
   *  intake down, and its acts (add / strike) the Ledger panel's catalog card. */
  catalog: CatalogActions;
  /** The Regent's hands: place, commission, identify, delegate. */
  regent: RegentActions;
  /** The war clock and the muster: deploy, advance, reset. */
  wargame: WargameActions;
  /** The Treasury — the coffers' upkeep pan, and the acts that keep it
   *  (record / strike, folded into the Coin panel). */
  treasury: TreasuryActions;
  /** The economy — the two-book money-dimension (record / strike / deal a
   *  sample), folded into the Counting-house panel. */
  economy: EconomyActions;
  /** The court's acts — a Chancellor's grant on an office is made here. */
  court: CourtActions;
  /** The census — the people and territories, and the acts that keep the
   *  books (enroll / found / strike, folded into the Census panel). */
  census: CensusActions;
  /** The Marches — the border book and its acts (arrive / ride out / turn
   *  away / recall, folded into the Marches panel). */
  marches: MarchesActions;
  /** The estate roster — the loaded {id,label} book of real properties, and
   *  its attended load (the Counting-house's roster card). */
  estates: EstateActions;
  /** The flow templates and live cascades — the Muster panel's relay reading. */
  flows: FlowsActions;
  /** The effective clock: game-now while a muster stands, else the wall clock. */
  now: string;
  /** The standing muster's seed, or null. */
  seed: string | null;
}

// ── The panels a click can open over the board ──────────────────────────────

/** What the board underneath is CALLED right now — the Map (the living realm)
 *  or the Table (the same realm read as cards). The two swapped names on
 *  2026-07-27 (Edwin), and a panel's way out has to say the true one, so the
 *  name rides a context rather than being spelled at fifteen call sites. */
const BoardName = createContext('the Map');

type Panel =
  | { kind: 'pod'; knightId: string }
  | { kind: 'guild'; guildId: string }
  | { kind: 'seat' }
  | { kind: 'recruit' }
  | { kind: 'place' }
  | { kind: 'census' }
  | { kind: 'counting' }
  | { kind: 'marches' }
  | { kind: 'throne' }
  | { kind: 'muster' }
  | { kind: 'ledger'; focusCase?: string }
  | { kind: 'fief'; id: string }
  | { kind: 'person'; id: string }
  | { kind: 'court' }
  // No 'council': the Council is the standing aside, never a panel. A panel
  // rendered the same heralds over the board while the aside still showed them.
  | { kind: 'crown' };

/** The color a fief's state wears on the parchment — lorded is kept, a
 *  regency is warm-but-foreign, a stewardship is bare debt. */
const FIEF_RING: Record<FiefState, string> = {
  lorded: 'var(--wt-green)',
  plurality: 'var(--wt-green)',
  regency: 'var(--wt-amber)',
  stewardship: 'var(--wt-red)',
};

// ── Small folds the tiles share ─────────────────────────────────────────────

const dayMs = 86_400_000;

/** Two letters for a medallion — the given name's first pair, honorifics
 *  dropped ("Ser Aldous Vane" → "Al", "Alys" → "Li"). */
function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter((w) => !/^(ser|sir|lord|lady|dame|the)$/i.test(w));
  const w = words[0] ?? name;
  return (w[0]?.toUpperCase() ?? '?') + (w[1]?.toLowerCase() ?? '');
}

const RING: Record<PodHealth, string> = {
  thriving: 'var(--wt-green)',
  strained: 'var(--wt-amber)',
  failing: 'var(--wt-red)',
};

/** The color a Patron's faith coin wears. */
function faithColor(p: PatronReading): string {
  if (p.withdrawn || p.faith <= 40) return 'var(--wt-red)';
  if (p.faith < 90) return 'var(--wt-amber)';
  return 'var(--wt-green)';
}

/** The owner a case's opened note names ("Owner: <name>."), or undefined —
 *  mirrors consequences.ts so identification carries the Patron onward. */
function ownerOfCase(c: CaseReading): string | undefined {
  const note = c.events.find((e) => e.kind === 'opened')?.note;
  const at = note?.indexOf('Owner: ');
  if (note == null || at == null || at < 0) return undefined;
  const rest = note.slice(at + 'Owner: '.length);
  const end = rest.indexOf('.');
  return end > 0 ? rest.slice(0, end) : rest;
}

/** Names a founding act for the revoke confirm (BETA blocker S3) — who holds
 *  what, and how, so the prompt reads like the record it is about to strike
 *  rather than a bare id. Falls back gracefully if a name can't be found. */
function describeFoundingAct(kingdom: Kingdom, actId: string): string {
  const nameOf = (id: string) => kingdom.people.find((p) => p.id === id)?.name ?? 'Someone';
  const landOf = (id: string) => kingdom.territories.find((t) => t.id === id)?.name ?? 'a territory';
  const grant = kingdom.grants.find((g) => g.id === actId);
  if (grant) {
    // `grant.role` is the STORED value, and every founding office grant stores
    // `'lord'` — so unseating a Chancellor used to warn about "a grant as lord
    // of The Chancery". The prompt must read like the record it strikes.
    const seat = kingdom.territories.find((t) => t.id === grant.territoryId);
    const how = seat?.kind === 'office' ? 'Chancellor' : grant.role;
    return `${nameOf(grant.personId)}'s grant as ${how} of ${landOf(grant.territoryId)}`;
  }
  const appt = kingdom.appointments.find((a) => a.id === actId);
  if (appt) return `${nameOf(appt.personId)}'s appointment as keeper of ${landOf(appt.territoryId)}`;
  const posting = kingdom.postings.find((p) => p.id === actId);
  if (posting) return `${nameOf(posting.personId)}'s posting in ${landOf(posting.territoryId)}`;
  const fealty = kingdom.fealties.find((f) => f.id === actId);
  if (fealty) return `${nameOf(fealty.personId)}'s fealty in ${landOf(fealty.territoryId)}`;
  return 'This act';
}

const vars = (v: Record<string, string>) => v as CSSProperties;

// ═══════════════════════════════════════════════════════════════════════════
// The table
// ═══════════════════════════════════════════════════════════════════════════

export default function WarTableView({
  kingdom,
  events,
  catalog,
  regent,
  wargame,
  treasury,
  economy,
  court: rawCourt,
  census: rawCensus,
  marches,
  estates,
  flows,
  now,
  seed,
}: Props) {
  // The board folds from the event log; the catalog's rows are the tree. The
  // full books ride in so the Ledger panel can drive their acts.
  const log = events.log;
  const catalogRows = catalog.rows;

  // BETA blocker S3: a founding record — the census's 11 real people, its 3
  // Crown offices, and the grants/appointments/postings/fealties loaded from
  // census.ts — struck in one click, same as any game-generated record, with
  // no way back. Gate ONLY the founding ones behind a confirm (the same
  // window.confirm the war game's own reset/deploy already stand behind, see
  // resetGame/deployGrand below); a record made since — by a game or by hand
  // — keeps its current one-click strike. Wrapping here, once, covers every
  // panel this table renders (Fief, Person, Census, hamlet cards) without
  // touching the strike/revoke logic itself.
  const court: CourtActions = {
    ...rawCourt,
    revoke: (actId) => {
      if (isFoundingActId(actId)) {
        if (!window.confirm(`${describeFoundingAct(kingdom, actId)} is a founding record, ratified at the census of 2026-07-17 — revoke it anyway? It does not come back on its own.`)) return;
      }
      rawCourt.revoke(actId);
    },
  };
  // Shared by the wrapped strike below AND the PersonView wiring further down
  // (which also navigates back to the Census on strike) — one confirm, asked
  // once, whichever door it is struck from. True clears the strike to proceed.
  const confirmCensusStrike = (id: string): boolean => {
    if (!isFoundingCensusId(id)) return true;
    const name =
      kingdom.people.find((p) => p.id === id)?.name ??
      kingdom.territories.find((t) => t.id === id)?.name ??
      'This record';
    return window.confirm(
      `${name} is part of the founding census taken 2026-07-17 — strike them anyway? They do not come back on their own.`,
    );
  };
  const census: CensusActions = {
    ...rawCensus,
    strike: (id) => {
      if (confirmCensusStrike(id)) rawCensus.strike(id);
    },
  };
  const [panel, setPanel] = useState<Panel | null>(null);
  // Clean by default; the Regent flips detail on to reveal raw ids + prose.
  const [detail, setDetail] = useState(false);
  // The War Table is the whole app now — it holds the ONLY nav. Every road to
  // every surface opens its overlay panel over the board (or lowers all panels
  // for the board itself); nothing routes to a page. This is the map law 6
  // rides on, and the reason there is no longer an old `.court` shell to fall to.
  const nav: Nav = {
    goToPerson: (id) => setPanel({ kind: 'person', id }),
    goToTerritory: (id) => {
      const t = kingdom.territories.find((x) => x.id === id);
      // A CROWN OFFICE is never land (WRIT-THE-BROKERAGE) and it has a surface
      // of its own. It used to open the FIEF page, which then described it as
      // land from top to bottom — "Administer the keep · Lorded", a holder
      // chip reading Lord, a keeper form the Census forbids, and a "Fold into
      // which fief…" control that silently turned the office into a hamlet
      // with no way back. Offices go to their own panel now.
      const office = t?.kind === 'office'
        ? realm.guilds.find((g) => g.guild.territoryId === id || g.keepId === id)
        : undefined;
      if (office) {
        setPanel({ kind: 'guild', guildId: office.guild.id });
        return;
      }
      const fiefId = t?.kind === 'hamlet' && t.parentId ? t.parentId : id;
      setPanel({ kind: 'fief', id: fiefId });
    },
    goToMarches: () => setPanel({ kind: 'marches' }),
    goToLedger: (focusCase) => setPanel({ kind: 'ledger', focusCase }),
    goToRegent: () => setPanel({ kind: 'seat' }),
  };
  // The living map is home. The old card board is one click away while the
  // realm settles — the writ's safety net, removed once the map is solid.
  const [asCards, setAsCards] = useState(() => {
    try {
      return localStorage.getItem('landlord.board') === 'cards';
    } catch {
      return false;
    }
  });
  const showCards = (v: boolean) => {
    setAsCards(v);
    try {
      localStorage.setItem('landlord.board', v ? 'cards' : 'realm');
    } catch {
      /* a refused store only costs the preference, never the board */
    }
  };
  const [seedIn, setSeedIn] = useState('the-first-muster');
  const [mustering, setMustering] = useState(false);
  const [clerksWorking, setClerksWorking] = useState(false);
  /** The palette — the one door that lists every other (⌘K / Ctrl+K, `/`, or `?`). */
  const [paletteOpen, setPaletteOpen] = useState(false);
  /** Whether the Council stands beside the board (`c`). It used to be a
   *  permanent 322px column — 19% of a 1440x900 screen and 23% of a 1280x800
   *  one, at a FIXED width, so it ate proportionally more of a small screen.
   *  Open by default so a first Regent is not left staring at a map with no
   *  counsel, and remembered once closed, so the choice is made once. */
  const [councilOpen, setCouncilOpen] = useState(() => {
    try {
      return localStorage.getItem('landlord.council') !== 'shut';
    } catch {
      return true;
    }
  });
  const showCouncil = (v: boolean) => {
    setCouncilOpen(v);
    try {
      localStorage.setItem('landlord.council', v ? 'open' : 'shut');
    } catch {
      /* a kingdom with no memory still works */
    }
  };
  /** Whether each matter shows its reasoning beneath it. Off by default: the
   *  heads now carry the fact and the buttons name the act, so the prose is for
   *  learning, not for playing — and it was the prose that made this column
   *  "walls of text" (Edwin, 2026-07-29). */
  const [showWhy, setShowWhy] = useState(() => {
    try {
      return localStorage.getItem('landlord.why') === 'on';
    } catch {
      return false;
    }
  });
  const setWhy = (v: boolean) => {
    setShowWhy(v);
    try {
      localStorage.setItem('landlord.why', v ? 'on' : 'off');
    } catch {
      /* no memory, no matter */
    }
  };
  const [clerkElapsed, setClerkElapsed] = useState(0);
  const [clerkResult, setClerkResult] = useState<
    { tone: 'done' | 'empty' | 'error'; line: string; proposals: number } | null
  >(null);
  // The fleet is TEN seats reasoning through a live brain, one after another —
  // a full minute of real work, measured (18 proposals in 64s against a 6,228-
  // event muster). A minute of a silent board reads as a broken button, so the
  // wait is narrated: the elapsed count runs while they work, and the outcome
  // stands on the board until it is dismissed. (Edwin, 2026-07-27: "either
  // nothing's happening or — almost as bad — I can't tell what's happening.")
  // The count runs from the CLICK, not from the render that follows it — on a
  // full board the first commit costs a second or two, and a counter that
  // quietly under-reports the wait is the same lie in a smaller font.
  const clerkStart = useRef(0);
  useEffect(() => {
    if (!clerksWorking) return;
    const tick = () => setClerkElapsed(Math.round((Date.now() - clerkStart.current) / 1000));
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [clerksWorking]);
  // Let the clerks work: run the fleet server-side (the keyholder holds the
  // brain), then the store merges the fresh `agent:<seat>` proposals onto the
  // board. The clerks only propose — the Regent still ratifies each one.
  const letClerksWork = async () => {
    if (clerksWorking) return;
    clerkStart.current = Date.now();
    setClerkElapsed(0);
    setClerksWorking(true);
    setClerkResult(null);
    const r = await wargame.runClerks();
    setClerksWorking(false);
    setClerkResult(
      r.ok
        ? r.proposals > 0
          ? {
              tone: 'done',
              proposals: r.proposals,
              line: `The clerks worked — ${r.proposals} proposal${r.proposals === 1 ? '' : 's'} parked for your word.`,
            }
          : {
              tone: 'empty',
              proposals: 0,
              line: 'The clerks found nothing to take up — every seat they grip is already answered.',
            }
        : { tone: 'error', proposals: 0, line: `The clerks could not work — ${r.error}` },
    );
  };
  const seedRef = useRef<HTMLInputElement>(null);

  // ── The readings — folded fresh, nothing stored ───────────────────────────
  const realm = readRealm(kingdom, log, now, seed, treasury.ledger, economy.book, economy.money);
  const throne = readThrone(kingdom, log, now);
  // The escape rate rides the ribbon because it is the number the whole product
  // is built against, and it lived on a surface with no standing door: the
  // Ledger was reachable from the command bar, from a proposal count that only
  // exists when clerks have parked something, and from a toast that dismisses
  // itself. Three roads, none of them there when you are not already looking.
  const escape = readEscape(flows.flows, catalog.rows, log);
  const untriaged = readCases(log)
    .filter((c) => c.status !== 'done' && c.caseId.includes(' · intake · '))
    .sort((a, b) => (ageInDays(b, now) ?? 0) - (ageInDays(a, now) ?? 0));
  const festering = seed
    ? severities(log, now, seed).filter((c) => c.severity.band === 'festering').length
    : 0;
  // The shared roll — what the realm's other people have put before the court.
  // What comes back is already governed by the wall (src/server/courtroll.ts):
  // the Crown gets every matter, a subject gets only their own.
  const rollActs = useCourtRoll();
  // Holding court: the whole realm's pending decisions, ranked. Folded here so
  // the rail can wear the count without opening the surface.
  const court0 = readCourt(log, now, {
    guilds: realm.guilds,
    fiefs: readKingdom(kingdom),
    unplaced: realm.unplaced,
  });
  const theKing = kingOf(kingdom);
  const theRegent = regentOf(kingdom);
  const game = wargame.state;
  // The living map's sole input — folded from the records, never computed by
  // the view (src/domain/realmScene.ts, the firewall).
  const realmScene = readRealmScene(kingdom, log, now, seed, realm, game?.doors ?? []) as ViewScene;

  const wavering = realm.patrons.filter((p) => !p.withdrawn && p.faith < 100);
  const withdrawn = realm.patrons.filter((p) => p.withdrawn);
  const steady = realm.patrons.filter((p) => p.faith === 100);
  const unplacedNames = new Set(realm.unplaced.map((p) => p.name));

  // ── The war clock, read for the dial ──────────────────────────────────────
  // Rounded, not floored: deployedAt is stamped a breath after the muster's
  // own `end`, so a floored stride would lag the true week by that breath.
  const gameDays = game
    ? Math.max(0, Math.round((Date.parse(game.now) - Date.parse(game.deployedAt)) / dayMs))
    : 0;
  const gameWeek = Math.floor((gameDays % 364) / 7) + 1;
  const gameYear = Math.floor(gameDays / 364) + 1;

  // ── The ribbon's gauges ───────────────────────────────────────────────────
  const c = realm.coffers;
  const cofferPct =
    c.tributeMonthly > 0
      ? Math.max(4, Math.min(100, Math.round((Math.max(0, c.trend) / c.tributeMonthly) * 100)))
      : c.upkeepMonthly > 0
        ? 4
        : 100;
  const whole = realm.ownersTotal + realm.guilds.length + throne.openWork;
  const debtPct =
    realm.debt === 0 ? 0 : Math.max(6, Math.min(100, Math.round((realm.debt / Math.max(1, whole)) * 100)));
  const steadyPct = realm.ownersTotal
    ? Math.round((steady.length / realm.ownersTotal) * 100)
    : 100;

  // ── Esc lowers any open panel ─────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── The time control's acts ───────────────────────────────────────────────
  const deployGame = () => {
    if (seedIn.trim()) wargame.deploy(seedIn);
  };
  /** Begin the intro campaign. Offered whether or not a muster stands — it used
   *  to live only in the no-muster branch of the footer, so a Regent already
   *  holding the grand muster had NO ROAD to the campaign and the board simply
   *  looked unchanged. (Edwin, first thing, 2026-07-28: "looks the same.") When a
   *  muster stands this strikes it first, and says so before it runs. */
  const beginCampaign = () => {
    const standing = game?.seed;
    const warning = standing
      ? `Begin “A Small Holding”? The muster “${standing}” standing now is STRUCK first — its work, its coin and its household go — and the small holding is dealt in its place: sixteen doors, a clean clock, and six acts to learn the realm by.`
      : 'Begin “A Small Holding” — sixteen doors, a clean clock, and six acts to learn the realm by? It deals a fresh holding onto the board.';
    if (!window.confirm(warning)) return;
    wargame.deployCampaign();
    setPanel(null);
  };

  const deployGrand = () => {
    if (!seedIn.trim() || mustering) return;
    // The grand muster REPLACES the shared catalog and flows with the full
    // reference library and deals a whole month of simulated work — a heavy,
    // shared change. Confirm before the swap (Reset now restores what stood).
    if (
      !window.confirm(
        'Deploy the grand muster? This replaces the work-order catalog and flows with the full reference library and deals a whole simulated month of work. Reset restores the founding chronicle.',
      )
    )
      return;
    setMustering(true);
    void Promise.resolve(wargame.deployGrand(seedIn)).finally(() => setMustering(false));
  };
  const resetGame = () => {
    if (
      window.confirm(
        'Strike the game? Every generated event is removed and the founding chronicle stands again.',
      )
    )
      wargame.reset();
  };

  // ── The horn — the muster's own acts, on the muster's own surface ─────────
  // These used to stand in a permanent footer across the foot of every screen.
  // They are the rarest things the Regent does — you deploy a muster once and
  // strike it almost never — so they had the worst claim on standing space of
  // anything on the board. They live on the War Games surface now (`g w`), and
  // every one of them is in the palette besides.
  const musterHorn = game ? (
    <div className="wt-horn">
      <button
        className={`wt-tbtn${clerksWorking ? ' is-working' : ''}`}
        onClick={letClerksWork}
        disabled={clerksWorking}
        title="Run the fleet — each clerk proposes its next step for the Regent to ratify. Ten seats reason in turn; it takes about a minute."
      >
        {clerksWorking ? (
          <>
            <span className="wt-spin" aria-hidden="true" />
            The clerks are working… {clerkElapsed}s
          </>
        ) : (
          '📜 Let the clerks work'
        )}
      </button>
      <button
        type="button"
        className="wt-tbtn"
        onClick={beginCampaign}
        title="The intro campaign — strikes the standing muster and deals the small holding a new Regent learns on"
      >
        📖 Begin the campaign
      </button>
      <button className="wt-tbtn danger" onClick={resetGame} title="Strike every generated event">
        Strike the muster
      </button>
      <p className="wt-hint wt-tide">
        {realm.crises > 0
          ? `${realm.crises} case${realm.crises === 1 ? '' : 's'} in crisis — the tide rises on what you leave undelegated`
          : 'the tide rises on what you leave undelegated'}
      </p>
    </div>
  ) : (
    <form
      className="wt-horn wt-muster"
      onSubmit={(e) => {
        e.preventDefault();
        deployGame();
      }}
    >
      <input
        ref={seedRef}
        className="wt-seedin"
        value={seedIn}
        onChange={(e) => setSeedIn(e.target.value)}
        placeholder="The seed (e.g. the-first-muster)"
        aria-label="The muster's seed"
      />
      {/* The campaign leads: a first-time Regent should meet a holding they can
          read. The grand muster deals ~200 doors with a backlog already 61 days
          stale — an excellent stress test and no kind of lesson
          (docs/WRIT-THE-CAMPAIGN.md §II). It stays as it was. */}
      <button
        type="button"
        className="wt-tbtn primary"
        onClick={beginCampaign}
        title="The intro campaign — the small holding a new Regent learns on"
      >
        📖 Begin the campaign
      </button>
      <button type="submit" className="wt-tbtn" disabled={!seedIn.trim()}>
        Deploy the game
      </button>
      <button
        type="button"
        className="wt-tbtn"
        disabled={!seedIn.trim() || mustering}
        onClick={deployGrand}
      >
        {mustering ? 'Mustering…' : '⚔️ Deploy the grand muster'}
      </button>
    </form>
  );


  // ── The council's heralds — each a road to the act ────────────────────────
  // A herald is not a poster — every piece of it is a door (Edwin, 2026-07-27:
  // "every displayed piece of information across everywhere should generally be
  // directly interactive to maximize click to action efficiency"). The head
  // carries the card's own destination, the body names its subjects inline, and
  // the week reads the war clock.
  interface Herald {
    tone: 'bad' | 'warn' | 'info';
    head: string;
    /** Where the card itself leads — its head becomes the door. */
    go?: () => void;
    when: string;
    body: ReactNode;
    act?: { label: string; go: () => void };
  }
  const wk = game ? `Wk ${gameWeek}` : 'today';
  // The week is the war clock's reading, so it leads to the war clock — the
  // realm keeps no other calendar, and a door to nowhere is worse than none.
  const goToClock = game ? () => setPanel({ kind: 'muster' }) : undefined;
  const heralds: Herald[] = [];
  // A red month and a fallen kingdom are different facts, and saying the second
  // when only the first is true taught the Regent to ignore the loudest herald
  // on the board (found by playing, 2026-07-27 — a fresh muster "fell" in week
  // five, every time, holding a full bank).
  if (c.fallen)
    heralds.push({
      tone: c.dry ? 'bad' : 'warn',
      head: c.dry
        ? 'The coffers are empty — the Crown cannot pay its people'
        : 'The month runs red — upkeep outweighs tribute',
      go: () => setPanel({ kind: 'counting' }),
      when: wk,
      body: (
        <>
          <InlineLink onClick={() => setPanel({ kind: 'counting' })}>
            {coin(c.upkeepMonthly)} upkeep
          </InlineLink>{' '}
          outweighs {coin(c.tributeMonthly)} tribute. Win the Patrons back by clearing the harm on
          their doors.
        </>
      ),
      act: { label: 'Clear the work', go: () => setPanel({ kind: 'seat' }) },
    });
  if (realm.unseatedWork > 0)
    heralds.push({
      tone: 'warn',
      // The head carries the FACT, not the flourish. "The Regent drowns" told a
      // first-time player nothing about what was wrong or what to press; the
      // number and the noun do. The voice may name things — it may not describe
      // states (Edwin, 2026-07-29).
      head: `${realm.unseatedWork} box${realm.unseatedWork === 1 ? '' : 'es'} of work on no one's desk`,
      go: () => setPanel({ kind: 'seat' }),
      when: 'now',
      body: (
        <>
          {untriaged.length > 0 && (
            <>
              <InlineLink onClick={() => setPanel({ kind: 'seat' })}>
                {untriaged.length} not yet sorted
              </InlineLink>
              .{' '}
            </>
          )}
          It all falls to the Regent, and one desk cannot clear it.
        </>
      ),
      act: { label: 'Give the work a desk', go: () => setPanel({ kind: 'seat' }) },
    });
  if (realm.unplaced.length > 0)
    heralds.push({
      tone: 'warn',
      head: `${realm.unplaced.length} owner${realm.unplaced.length === 1 ? '' : 's'} in no knight's care`,
      go: () => setPanel({ kind: 'place' }),
      when: wk,
      body: (
        <>
          {realm.unplaced.reduce((n, p) => n + p.doors.length, 0)} doors, and nobody answers for
          them:{' '}
          {realm.unplaced.slice(0, 3).map((p, i) => (
            <span key={p.name}>
              {i > 0 && ', '}
              <InlineLink onClick={() => goToPatron(p)}>{p.name}</InlineLink>
            </span>
          ))}
          {realm.unplaced.length > 3 && `, and ${realm.unplaced.length - 3} more`}. Give each to a
          knight, or{' '}
          <InlineLink onClick={() => setPanel({ kind: 'recruit' })}>dub a new one</InlineLink>.
        </>
      ),
      act: { label: 'Place them', go: () => setPanel({ kind: 'place' }) },
    });
  if (realm.unmanned.length > 0)
    heralds.push({
      tone: 'warn',
      head: `${realm.unmanned.length} Crown office${realm.unmanned.length === 1 ? ' stands' : 's stand'} headless`,
      go: () => setPanel({ kind: 'guild', guildId: realm.unmanned[0].guild.id }),
      when: wk,
      // The offices are NOT named here. The map's own rail lists all three, by
      // name, with "seat open" under each — and the campaign card listed them a
      // third time. Three copies of the same three names on one screen is most
      // of what a dense card is made of; the board is the place that holds the
      // list, so this card holds only the consequence and the road.
      body: (
        <>
          Until each has a head, every case in its trade lands on the{' '}
          <InlineLink onClick={() => setPanel({ kind: 'seat' })}>Regent's</InlineLink> own desk.
        </>
      ),
      act: {
        label: 'Seat a Chancellor',
        go: () => setPanel({ kind: 'guild', guildId: realm.unmanned[0].guild.id }),
      },
    });
  // The court's backlog. This used to live ONLY as a pip on the rail's ⚖️
  // glyph, which is why the rail could not simply be deleted: a count with no
  // other home takes its information with it. The Council is the one place that
  // says what presses, so it says this too — and now it is a road as well as a
  // number, which the pip never was.
  const courtWaiting =
    court0.waiting + rollActs.roll.matters.filter((m) => !m.heard_at).length;
  if (courtWaiting > 0)
    heralds.push({
      tone: 'warn',
      head: `${courtWaiting} matter${courtWaiting === 1 ? '' : 's'} await${courtWaiting === 1 ? 's' : ''} your word`,
      go: () => setPanel({ kind: 'court' }),
      when: wk,
      body: <>Nothing moves on them until the Crown speaks.</>,
      act: { label: 'Hold court', go: () => setPanel({ kind: 'court' }) },
    });
  const cracking = wavering.find((p) => p.faith < 60);
  if (cracking)
    heralds.push({
      tone: 'bad',
      head: `${cracking.name} is close to walking`,
      go: () => goToPatron(cracking),
      when: wk,
      body: (
        <>
          Faith {cracking.faith} of 100, with {cracking.crises} case
          {cracking.crises === 1 ? '' : 's'} in crisis on{' '}
          <InlineLink onClick={() => goToPatron(cracking)}>their doors</InlineLink>. Clear the harm
          and faith climbs back; leave it and they take their doors home.
        </>
      ),
      act: { label: 'Clear their cases', go: () => setPanel({ kind: 'seat' }) },
    });
  if (withdrawn.length > 0)
    heralds.push({
      tone: 'bad',
      head: `${withdrawn.length} estate${withdrawn.length === 1 ? '' : 's'} recalled`,
      when: wk,
      go: () => goToPatron(withdrawn[0]),
      body: (
        <>
          {withdrawn.slice(0, 3).map((p, i) => (
            <span key={p.name}>
              {i > 0 && ', '}
              <InlineLink onClick={() => goToPatron(p)}>{p.name}</InlineLink>
            </span>
          ))}
          {withdrawn.length > 3 && '…'} withdrew — their doors and their tribute are gone from the
          rolls.
        </>
      ),
    });
  if (game && heralds.length === 0)
    heralds.push({
      tone: 'info',
      head: 'The realm stands well kept',
      when: wk,
      body: 'Every owner placed, every Crown office headed, every box on a desk — hold it so as the clock strides on.',
    });
  if (game)
    heralds.push({
      tone: 'info',
      head: 'The muster stands',
      go: () => setPanel({ kind: 'muster' }),
      when: 'Wk 1',
      body: (
        <>
          Every door, owner and box on the board was dealt by{' '}
          <InlineLink onClick={() => setPanel({ kind: 'muster' })}>“{game.seed}”</InlineLink>.
        </>
      ),
    });
  else
    heralds.push({
      tone: 'info',
      head: 'No muster stands',
      when: 'today',
      body: 'The board reads the bare census. Sound the war horn below — deploy the grand muster and the realm fills with land, owners, and work.',
      act: {
        label: 'To the horn',
        go: () => {
          seedRef.current?.focus();
          seedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        },
      },
    });
  // The campaign in hand — a READING over the same board everything else reads,
  // so it can never disagree with what the player is looking at. Only folded
  // while the campaign's own muster stands.
  const campaign =
    game?.seed === INTRO_CAMPAIGN.key
      ? readCampaign(INTRO_CAMPAIGN, {
          kingdom,
          log: events.log,
          money: economy.money,
          economy: economy.book,
          treasury: treasury.ledger,
          flows: flows.flows,
          seed: game.seed,
          now,
          startedAt: game.deployedAt ?? now,
        })
      : null;

  const alarms = heralds.filter((h) => h.tone !== 'info').length;

  // ── The keyboard, and the one door that lists it ───────────────────────────
  // Edwin, 2026-07-29: *"we have the whole keyboard it doesn't have to all be
  // point and click we can have bindings to open menus."* Every surface and
  // every act is named ONCE, here, and reached three ways — its key, the
  // palette's search, or a click in the palette. That single list is what lets
  // the persistent chrome go: nine rail glyphs and five footer buttons only had
  // to stand there because nothing else could reach what they reached.
  const commands: Command[] = [
    { id: 'map', label: 'The Map', group: 'Surfaces', keys: 'g m', hint: 'the realm at a glance', run: () => { setPanel(null); showCards(false); } },
    { id: 'table', label: 'The Table', group: 'Surfaces', hint: 'the old card board', run: () => { setPanel(null); showCards(true); } },
    { id: 'throne', label: 'The Throne', group: 'Surfaces', keys: 'g t', hint: "the King's view", run: () => setPanel({ kind: 'throne' }) },
    { id: 'seat', label: "The Regent's Seat", group: 'Surfaces', keys: 'g s', hint: 'identify and delegate the work', run: () => setPanel({ kind: 'seat' }) },
    { id: 'court', label: 'Hold court', group: 'Surfaces', keys: 'g c', hint: 'every decision awaiting the Crown', run: () => setPanel({ kind: 'court' }) },
    { id: 'ledger', label: 'The Ledger', group: 'Surfaces', keys: 'g l', hint: 'the work itself', run: () => nav.goToLedger() },
    { id: 'muster', label: 'The War Games', group: 'Surfaces', keys: 'g w', hint: 'the proving ground', run: () => setPanel({ kind: 'muster' }) },
    { id: 'census', label: 'The Census', group: 'Surfaces', keys: 'g n', hint: 'the people and the territories', run: () => setPanel({ kind: 'census' }) },
    { id: 'counting', label: 'The Counting-house', group: 'Surfaces', keys: 'g b', hint: 'both treasuries', run: () => setPanel({ kind: 'counting' }) },
    { id: 'marches', label: 'The Marches', group: 'Surfaces', keys: 'g r', hint: 'the border lands', run: () => setPanel({ kind: 'marches' }) },
    {
      id: 'council',
      label: councilOpen ? 'Lower the Council' : 'Raise the Council',
      group: 'Surfaces',
      keys: 'c',
      hint: alarms > 0 ? `${alarms} matter${alarms === 1 ? '' : 's'} pressing` : 'nothing presses',
      run: () => showCouncil(!councilOpen),
    },
    {
      id: 'detail',
      // A toggle's label must say what pressing it DOES, not what mode you are
      // in — the same rule the herald acts were just held to.
      label: detail ? 'Hide the raw detail' : 'Show the raw detail',
      group: 'Acts',
      keys: 'd',
      hint: 'ids and the teaching text — off for a clean board',
      run: () => setDetail((v) => !v),
    },
    { id: 'place', label: 'Place owners in a knight’s care', group: 'Acts', hint: 'answer the delegation debt', run: () => setPanel({ kind: 'place' }) },
    { id: 'recruit', label: 'Dub a new knight', group: 'Acts', run: () => setPanel({ kind: 'recruit' }) },
    {
      id: 'clerks',
      label: 'Let the clerks work',
      group: 'Acts',
      // DELIBERATELY keyless. This wakes the live fleet: ten seats reason in
      // turn against a real API for about a minute, and it costs money. A bare
      // `w` set it running by accident during the very first keyboard drive of
      // this feature. Cheap, reversible acts earn a single keystroke; a slow,
      // paid, outward-facing one is reached on purpose or not at all.
      hint: 'the fleet proposes its next steps — about a minute',
      disabled: !game ? 'no muster stands' : clerksWorking ? 'already working' : false,
      run: () => void letClerksWork(),
    },
    { id: 'day', label: 'Advance a day', group: 'The clock', keys: '.', disabled: !game && 'no muster stands', run: () => wargame.advance(1) },
    { id: 'week', label: 'Advance a week', group: 'The clock', keys: '>', disabled: !game && 'no muster stands', run: () => wargame.advance(7) },
    { id: 'campaign', label: 'Begin the campaign', group: 'The muster', hint: 'the small holding a new Regent learns on', run: beginCampaign },
    { id: 'reset', label: 'Strike the muster', group: 'The muster', hint: 'every generated event removed', disabled: !game && 'nothing to strike', run: resetGame },
  ];

  // The `g`-prefix is a two-stroke sequence, so it needs one piece of memory.
  // A ref, not state: re-rendering the whole war table between `g` and `m`
  // would be absurd, and the value is never read during a render.
  const goArmed = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Never steal a keystroke from a field, a modifier chord we don't own, or
      // an already-open palette (which handles its own keys).
      if (isTyping(e.target) || e.altKey || paletteOpen) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (e.metaKey || e.ctrlKey) return;

      if (goArmed.current) {
        goArmed.current = false;
        const id = GO_KEYS[e.key.toLowerCase()];
        if (id) {
          e.preventDefault();
          commands.find((c) => c.id === id)?.run();
        }
        return;
      }
      if (e.key === 'g') {
        goArmed.current = true;
        // The armed `g` must not wait forever, or a `g` typed and abandoned
        // turns the next innocent letter into a jump.
        window.setTimeout(() => (goArmed.current = false), 1200);
        return;
      }
      if (e.key === '/' || e.key === '?') {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      const byKey = commands.find((c) => c.keys === e.key && !c.disabled);
      if (byKey) {
        e.preventDefault();
        byKey.run();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // What the fleet parked and nobody has ratified. Edwin, 2026-07-27: *"Once the
  // clerks have proposals I would like to see that visually indicated on the
  // table."* Before this, a finished run said its piece in the status line and
  // then, once that line was dismissed, the board looked exactly as it had —
  // the work existed only in the Ledger, for whoever thought to go and look.
  const parkedProposals = clerkProposals(events.log).filter((p) => p.awaiting).length;

  // The heralds, drawn once and hung in ONE place: the standing Council aside
  // beside the board. They were briefly hung in two — the aside and a Council
  // panel — which put the same list on screen twice at once; see the note where
  // the ⚑ button used to stand.
  // Where each act's work is DONE. The domain deliberately names no route (a
  // scenario is a recipe, not a map of our panels), so the road lives here — but
  // it must exist: an act that reports a state and gives no way to act on it is
  // the proximity fault this kingdom keeps re-learning (the A/E/P check).
  const ACT_ROAD: Record<string, { label: string; go: () => void }> = {
    'the-realm-is-yours': { label: 'To the census', go: () => setPanel({ kind: 'census' }) },
    'work-arrives': { label: 'To the Ledger', go: () => nav.goToLedger() },
    'one-desk-cannot-hold-it': { label: 'To the Regent’s seat', go: () => setPanel({ kind: 'seat' }) },
    // Act four is answered in the Ledger — but ONLY once the fleet has spoken.
    // With nothing parked, "To the Ledger" lands on an empty card and the act
    // looks broken; the real next move is to set the clerks working, which is an
    // ACT, not a place. So the road becomes the act itself when there is nothing
    // yet to answer. (Found by playing it through, 2026-07-27.)
    'the-clerks':
      parkedProposals > 0
        ? { label: 'To the proposals', go: () => nav.goToLedger() }
        : {
            label: clerksWorking ? 'The clerks are at work' : 'Set the clerks to work',
            go: () => {
              if (!clerksWorking) void letClerksWork();
            },
          },
    'neglect-has-a-price': { label: 'To the Ledger', go: () => nav.goToLedger() },
    'the-reckoning': { label: 'To the Counting-house', go: () => setPanel({ kind: 'counting' }) },
  };

  const heraldScraps = heralds.map((h, i) => (
    <div
      key={`${h.head}-${i}`}
      className={`wt-scrap${h.tone === 'warn' ? ' warn' : h.tone === 'info' ? ' info' : ''}`}
    >
      <div className="wt-sh">
        {h.go ? (
          <button className="wt-shead-go" onClick={h.go}>
            {h.head}
          </button>
        ) : (
          <span>{h.head}</span>
        )}
        {goToClock ? (
          <button
            className="wt-swhen-go"
            onClick={goToClock}
            title="The war clock — the time the whole realm reads against"
          >
            {h.when}
          </button>
        ) : (
          <span>{h.when}</span>
        )}
      </div>
      {/* The reasoning, only when asked for. A matter's head now states the
          fact and its button names the act, so those two alone are a complete
          instruction — this sentence explains WHY, which is what you want the
          first few times and never again. Five of these paragraphs stacked in a
          250px column is the "wall of text". */}
      {showWhy && <div className="wt-sb">{h.body}</div>}
      {h.act && (
        <div className="wt-sact">
          <button onClick={h.act.go}>{h.act.label}</button>
        </div>
      )}
    </div>
  ));

  // ── The open panel, resolved against the live readings ────────────────────
  const openPod =
    panel?.kind === 'pod' ? (realm.pods.find((p) => p.knightId === panel.knightId) ?? null) : null;
  const openGuild =
    panel?.kind === 'guild'
      ? (realm.guilds.find((g) => g.guild.id === panel.guildId) ?? null)
      : null;

  const handTargets: Person[] = kingdom.people.filter(
    (p) => p.pledge === 'vassal' || p.pledge === 'squire',
  );

  /** A Patron's coin is a road: unplaced → the placing panel; placed → their
   *  knight's pod (law 6). */
  const goToPatron = (p: PatronReading) => {
    if (unplacedNames.has(p.name)) {
      setPanel({ kind: 'place' });
      return;
    }
    const pod = realm.pods.find((x) => x.owners.some((o) => o.name === p.name));
    if (pod) setPanel({ kind: 'pod', knightId: pod.knightId });
  };

  return (
    <NavContext.Provider value={nav}>
    <DetailContext.Provider value={{ detail, toggle: () => setDetail((d) => !d) }}>
    <BoardName.Provider value={asCards ? 'the Table' : 'the Map'}>
    <div className="wt">
      <div className={`wt-table${councilOpen ? '' : ' wt-table--nocouncil'}`}>
        {/* ── The ribbon ─────────────────────────────────────────────── */}
        <header className="wt-chrome wt-ribbon">
          <div className="wt-crest">
            <div className="wt-seal" aria-hidden="true">
              L
            </div>
            {/* The name, and no subtitle. "The realm · the King's war-table"
                cost 130px of a strip that must stay one row tall, to tell the
                player which surface they were on when there is only one — and it
                was the last straw that wrapped the density toggle onto a second
                row. Decoration pays rent like everything else. */}
            <div className="wt-realm-name">LandLord</div>
          </div>

          <button
            className="wt-gauge wt-gauge-btn"
            onClick={() => setPanel({ kind: 'counting' })}
            title={`${coin(c.tributeMonthly)} tribute on ${c.doors} retained doors · ${coin(c.upkeepMonthly)} upkeep — the health bar. Enter the Counting-house.`}
          >
            <div className="wt-gauge-top">
              <span className="wt-lbl">The coffers</span>
              <span className={`wt-val wt-num ${c.fallen ? 'bad' : 'good'}`}>
                {c.trend > 0 ? '+' : ''}
                {coin(c.trend)}
              </span>
            </div>
            <div className="wt-bar">
              <span
                className={c.fallen ? 'wt-fill-red' : 'wt-fill-gold'}
                style={{ width: `${c.fallen ? 100 : cofferPct}%` }}
              />
            </div>
          </button>

          <button
            className="wt-gauge wt-gauge-btn"
            onClick={() => setPanel({ kind: 'throne' })}
            // One name for one thing. This tooltip said "guilds", the herald
            // beside it says "Crown office", and the map's rail says "The
            // Offices" — three words for the same vacancy, which is most of why
            // the number reads as noise.
            title="Owners in no knight's care + Crown offices with no head + work on no desk — drive it to zero. Enter the Throne."
          >
            <div className="wt-gauge-top">
              <span className="wt-lbl">Delegation debt</span>
              <span className={`wt-val wt-num ${realm.debt > 0 ? 'bad' : 'good'}`}>{realm.debt}</span>
            </div>
            <div className="wt-bar">
              <span className="wt-fill-red" style={{ width: `${debtPct}%` }} />
            </div>
          </button>

          {/* The one gauge that was a dead end: it reported the patrons and made
              you go elsewhere to see them, standing between two gauges that both
              lead somewhere. A number with no road is the proximity fault (A/E/P,
              2026-07-29). */}
          <button
            className="wt-gauge wt-gauge-btn wt-gauge-slim"
            onClick={() => setPanel({ kind: 'census' })}
            title="The owners whose doors you manage — and how many have lost faith. Enter the Census."
          >
            <div className="wt-gauge-top">
              <span className="wt-lbl">Patrons</span>
              <span className={`wt-val wt-num ${wavering.length + withdrawn.length > 0 ? 'warn' : 'good'}`}>
                {realm.ownersTotal}
                {wavering.length + withdrawn.length > 0 && (
                  <span className="wt-val-sub"> · {wavering.length + withdrawn.length}⚠</span>
                )}
              </span>
            </div>
            <div className="wt-bar">
              <span className="wt-fill-green" style={{ width: `${steadyPct}%` }} />
            </div>
          </button>

          {/* THE ESCAPE RATE — and the Ledger's standing door. Two faults, one fix.
              THE ROAD. The Ledger held the only reading of the number this whole
              product is judged against, and every road to it was conditional: the
              command bar (which you must already know to press), a proposal count
              that only exists once a clerk has parked something, and a toast that
              dismisses itself. Three roads, none of them there when you are not
              already looking. Every other surface on the ribbon — the coffers, the
              debt, the patrons, the clock — is a standing reading that is also its
              own door. The Ledger was the one that wasn't.
              WHY IT IS A READOUT AND NOT A GAUGE. The other four wear a bar. This
              one deliberately does not, and the reason is in src/domain/escape.ts:
              the reading SETS NO TARGET, because inventing a completion criterion
              is how a measure stops being falsifiable. A bar draws a scale with a
              good end and a bad end — it would put a target on the page that the
              measure itself refuses to name. So the number stands bare.
              (It also happens to fit, which a full gauge did not: measured at
              1366px, a fourth gauge here wrapped the ribbon 62px → 115px. That is
              a happy coincidence, not the argument.)
              NOT MEASURED IS NOT ZERO. With nothing worked it reads "—", never
              "0%": a rate over no work would look like perfect automation on a
              system that has done nothing.
              WHAT IT COST, MEASURED. One row at 1366px and up, unchanged at 62px.
              The ribbon's slack is now 2px, so this is the last thing that fits —
              the next addition wraps it, and the honest fix then is to take the
              space from something, not to shave this. At 1280px the palette button
              drops to a second row where before it held down to 1200px: one
              breakpoint of headroom, spent knowingly on the one reading the whole
              product is judged against. */}
          <button
            className="wt-gauge wt-gauge-btn wt-readout"
            onClick={() => setPanel({ kind: 'ledger' })}
            title={
              escape.rate === null
                ? 'No step has been worked yet, so no share of the work has reached a person — the rate is NOT MEASURED, which is not the same as zero. Enter the Ledger.'
                : `${escape.escaped} of ${escape.stepsReached} steps reached a person — ${escape.designed} by design, ${escape.unplanned} unplanned. Enter the Ledger.`
            }
          >
            {/* The same words the band on the Ledger wears. One name for one
                thing — a reading that says one thing and opens a panel that says
                another is two readings as far as anyone can tell. */}
            <span className="wt-lbl">Escape rate</span>
            <span
              className={`wt-val wt-num ${escape.rate === null ? 'wt-val-none' : escape.unplanned > 0 ? 'bad' : 'warn'}`}
            >
              {escape.rate === null ? '—' : `${Math.round(escape.rate * 100)}%`}
              {escape.unplanned > 0 && <span className="wt-val-sub"> {escape.unplanned}⚠</span>}
            </span>
          </button>

          {/* WHAT THE GAME WANTS FROM YOU. This sentence already existed — but
              only inside the legacy card view, and the map is the default board,
              so the app stated its objective exactly once on a screen the
              default player never visits (Edwin, 2026-07-29: *"once the game
              starts I'm still not sure what to do"*). It was never that we had
              no answer; the answer was filed where nobody goes.
              It rides the ribbon rather than the map for two reasons: the map is
              already carrying five overlays and a sixth covered the Crown
              offices rail outright, and "drive the debt to zero" belongs BESIDE
              the Delegation debt gauge it talks about (design law 6). It takes
              the space the bare spacer used to hold. */}
          {/* The IMPERATIVE only. The full sentence — "every owner in a knight's
              care, every Crown office headed, every box of work on a real desk"
              — is three lines of prose in a strip that has to stay one line
              tall: at 1366px it wrapped the ribbon to 124px and gave back most
              of the space the retired footer had just freed. So the standing
              line is the five words that say what to DO, the whole sentence is
              one hover away, and the current act is spelled out on the campaign
              card in the Council. Said once each, at the length its place can
              carry. */}
          <p
            className="wt-obj wt-obj-ribbon"
            title="Every owner in a knight's care, every Crown office headed, every box of work on a real desk — that is the whole of it."
          >
            <b>Objective</b> Drive the debt to zero
          </p>
          <div className="wt-spacer" />
          {/* The war clock, and the only two acts done often enough to earn
              standing space. The reading is a door to the War Games, where the
              rest of the muster's acts went. */}
          <div className="wt-rclock">
            <button
              className="wt-rwhen"
              onClick={() => setPanel({ kind: 'muster' })}
              title={
                game
                  ? `game clock ${game.now.slice(0, 10)} — the clock the whole realm reads against. Enter the War Games.`
                  : 'No muster stands — the wall clock rules. Enter the War Games to sound the horn.'
              }
            >
              <span className="wt-dial" style={vars({ '--a': `${(gameDays * 51) % 360}deg` })} />
              {game ? `Yr ${gameYear} · Wk ${gameWeek}` : 'No muster'}
            </button>
            {game && (
              <>
                <button
                  className="wt-radv"
                  onClick={() => wargame.advance(1)}
                  title="Advance a day — the tide rises on what you leave undelegated ( . )"
                  aria-label="Advance a day"
                >
                  ▷
                </button>
                <button
                  className="wt-radv primary"
                  onClick={() => wargame.advance(7)}
                  title="Advance a week ( shift . )"
                  aria-label="Advance a week"
                >
                  ▶
                </button>
              </>
            )}
          </div>
          {/* THE COUNCIL'S DOOR — and yes, this is the third life of a control
              that has been wrong twice. It is not the ⚑ button again, and the
              difference is the whole point: that button was struck for
              DUPLICATION, because the Council stood permanently on the right
              while a button offered to show it to you. The Council is summoned
              now, so this is not a second road to a visible thing — it is the
              only road to a hidden one, which is the case the old button never
              had. It carries the count because a hidden Council cannot. */}
          <button
            className={`wt-council-btn${councilOpen ? ' on' : ''}${alarms > 0 ? ' pressing' : ''}`}
            onClick={() => showCouncil(!councilOpen)}
            aria-pressed={councilOpen}
            title={
              councilOpen
                ? 'Lower the Council — the board takes the space ( c )'
                : `Raise the Council — ${alarms > 0 ? `${alarms} matter${alarms === 1 ? '' : 's'} pressing` : 'nothing presses'} ( c )`
            }
          >
            <span aria-hidden="true">⚑</span>
            <span className="wt-lbl">Council</span>
            {alarms > 0 && <span className="wt-councount">{alarms}</span>}
          </button>
          {/* The palette's own door. A surface reachable ONLY by an
              undocumented keystroke is not reachable — that is the first
              question the A/E/P check asks, and it is the one control that must
              never be retired, because it is how everything else is reached once
              the chrome goes.

              IT NO LONGER WEARS ITS KEY (Luke, 2026-08-06): *"Don't even put
              keybinding clutter in the UI… that's forcing tutorial throughout the
              game."* A badge on the board teaches once and then sits there for
              every hour after, which is a tutorial that never ends. The key still
              reaches the palette, the tooltip still names it for anyone who
              hovers, and the palette itself lists every command beside its own
              key — which CommandPalette.tsx already calls the key map, refusing a
              second surface that repeats them. The teaching lives there; the
              board stays a board. */}
          <button
            className="wt-palbtn"
            onClick={() => setPaletteOpen(true)}
            title={`Every surface and every act, in one list — ${MOD_K}, / or ?`}
          >
            <span aria-hidden="true">☰</span>
            <span className="wt-lbl">Go</span>
          </button>
          {/* THE DENSITY TOGGLE MOVED TO THE PALETTE (`d`). It is set once and
              then left alone for a whole session — the weakest claim on standing
              space of anything here — and it was the item the ribbon wrapped
              onto a second row, costing 53px of board on every screen to hold a
              control almost nobody presses twice. */}
          {/* THE ⚑ COUNCIL BUTTON IS GONE, and this is the second time this
              control has been wrong (Edwin, 2026-07-29: *"the council button is
              redundant to the council panel"*).
              First it scrolled to an aside already on screen — a dead button.
              The fix made it open a Council SURFACE, and that was worse: the
              same `heraldScraps` array rendered twice, side by side, since the
              aside is `grid-area: advisor` and the panel is `grid-area: board`.
              Pressing it destroyed the map to show you a list six inches to the
              right — and the panel dropped the campaign card, the one thing on
              the board that says what to do next.
              The aside stands in EVERY viewport (on a narrow screen it stacks
              below the board), so there was never a case the button served. The
              alarm count it carried now rides on the aside's own caption, beside
              the heralds it counts. The right answer to a redundant control is
              to remove it, not to give it somewhere new to go. */}
        </header>

        {/* THE NINE-GLYPH RAIL IS GONE (Edwin, 2026-07-29: "still seems like a
            lot more buttons than are necessary on the left"). Every one of the
            nine was NAVIGATION, and navigation has a better door now: the
            palette lists all of them beside their keys, and `g` + a letter
            reaches each directly. Nine permanent buttons to save one keystroke
            is a poor trade, and this is the one piece of chrome that could be
            deleted outright rather than rehoused.
            ONE thing it carried was not navigation and would NOT have survived:
            the ⚖️ glyph's pip, the court's backlog. A count with no other home
            takes its information with it when you delete it — so the backlog
            became a Council matter first, where it is a road as well as a number,
            which a pip never was. Look for that before deleting any chrome: a
            badge is often the only place a reading is spoken aloud. */}

        {/* ── The board ──────────────────────────────────────────────── */}
        {!panel && !asCards && (
          <main className="wt-board wt-board-realm">
            <FlatMapView
              scene={realmScene}
              onSelectFief={(id) => setPanel({ kind: 'pod', knightId: id })}
              // The doorId used to be DROPPED here — clicking one smoking house
              // opened the whole neighbourhood without ever naming the door you
              // aimed at (on the standing audit list since 2026-07-27). The
              // scene now carries each door's open matter, so a door leads to
              // its own WORK; a door with nothing open leads to its fief, which
              // is the most that is true about it.
              onSelectBuilding={(fiefId, doorId) => {
                const door = realmScene.fiefs
                  .find((f) => f.id === fiefId)
                  ?.buildings.find((b) => b.id === doorId);
                if (door?.openCase) nav.goToLedger(door.openCase);
                else setPanel({ kind: 'pod', knightId: fiefId });
              }}
              onSelectGuild={(id) => setPanel({ kind: 'guild', guildId: id })}
              onSelectCapital={() => setPanel({ kind: 'crown' })}
              // Straight to the placing form. It used to open the Council, where
              // you then had to find the herald that named the unheld owners and
              // press ITS button to reach this same panel — a road to a road
              // (A/E/P: the act stands beside the record it changes).
              onSelectUnheld={() => setPanel({ kind: 'place' })}
              onDeployMuster={() => setPanel({ kind: 'muster' })}
            />
            {/* What the clerks parked, standing ON the map — the realm should
                show that a scribe has been at work without being asked. */}
            {parkedProposals > 0 && (
              <button
                className="wt-mapscrolls"
                onClick={() => setPanel({ kind: 'ledger' })}
                title="The clerks' proposals await your word — open the Ledger and ratify"
              >
                <span className="wt-mapscrolls-i" aria-hidden="true">
                  📜
                </span>
                <span className="wt-mapscrolls-n">{parkedProposals}</span>
                <span className="wt-mapscrolls-t">
                  {parkedProposals === 1 ? 'proposal awaits' : 'proposals await'}
                </span>
              </button>
            )}
            <button
              className="wt-boardswap"
              onClick={() => showCards(true)}
              title="The Table — the realm read as cards"
            >
              ▤ The Table
            </button>
        </main>
        )}
        {!panel && asCards && (
        <main className="wt-board">
          <div className="wt-vellum" />
          <div className="wt-cartouche" />
          <svg className="wt-compass" viewBox="0 0 100 100" aria-hidden="true">
            <g fill="none" stroke="#bcbfa2" strokeWidth="1.5">
              <circle cx="50" cy="50" r="34" />
              <circle cx="50" cy="50" r="26" strokeDasharray="2 4" />
            </g>
            <polygon points="50,10 56,50 50,44 44,50" fill="#cf5f3c" />
            <polygon points="50,90 44,50 50,56 56,50" fill="#bcbfa2" />
            <text x="50" y="8" fill="#bcbfa2" fontSize="9" textAnchor="middle" fontFamily="Georgia">
              N
            </text>
          </svg>

          <div className="wt-board-inner">
            <div className="wt-crown">
              <button
                className="wt-who wt-who-btn"
                onClick={() => setPanel({ kind: 'crown' })}
                title="The Crown — the royal line and its retinue"
              >
                ♛ <b>{theKing?.name ?? '—'}</b> the King · 📜 <b>{theRegent?.name ?? '—'}</b>,
                Regent of the realm
              </button>
              <div className="wt-obj">
                Objective — every owner in a knight's care, every Crown office headed, every box of
                work on a real desk. Drive the debt to zero.
              </div>
            </div>

            {/* The pods — the land and its keepers */}
            <div className="wt-field-cap">The pods — the knights and the land they keep</div>
            <div className="wt-field">
              {realm.pods.map((pod) => (
                <PodTile key={pod.knightId} pod={pod} onOpen={() => setPanel({ kind: 'pod', knightId: pod.knightId })} />
              ))}
              {seed && realm.unplaced.length > 0 && (
                <button
                  className="wt-holding is-empty"
                  style={vars({ '--ring': 'var(--wt-red)' })}
                  onClick={() => setPanel({ kind: 'place' })}
                >
                  <div className="wt-hhead">
                    <div className="wt-medallion is-vacant">!</div>
                    <div className="wt-hgrow">
                      <div className="wt-htitle">Owners unplaced</div>
                      <div className="wt-hholder">In no knight's care</div>
                    </div>
                    <span className="wt-tag t-red">Debt</span>
                  </div>
                  <div className="wt-hwork">
                    <span className="wt-hcount wt-waxink">
                      {realm.unplaced.length} owner{realm.unplaced.length === 1 ? '' : 's'} ·{' '}
                      {realm.unplaced.reduce((n, p) => n + p.doors.length, 0)} doors adrift
                    </span>
                  </div>
                  <div className="wt-hmeta">The allocation debt — enter to place each estate →</div>
                </button>
              )}
              {seed && (
                <button
                  className="wt-holding is-empty"
                  style={vars({ '--ring': 'var(--wt-gold)' })}
                  onClick={() => setPanel({ kind: 'recruit' })}
                >
                  <div className="wt-hhead">
                    <div className="wt-medallion is-vacant">+</div>
                    <div className="wt-hgrow">
                      <div className="wt-htitle">Recruit a knight</div>
                      <div className="wt-hholder">A new pod stands open</div>
                    </div>
                    <span className="wt-tag t-amber">Grow</span>
                  </div>
                  <div className="wt-hmeta">
                    The realm grows by new pods — dub a subject, or name a new blade →
                  </div>
                </button>
              )}
              {!seed && (
                <button
                  className="wt-holding is-empty"
                  style={vars({ '--ring': 'var(--wt-amber)' })}
                  onClick={() => {
                    seedRef.current?.focus();
                    seedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                >
                  <div className="wt-hhead">
                    <div className="wt-medallion is-vacant">?</div>
                    <div className="wt-hgrow">
                      <div className="wt-htitle">No muster stands</div>
                      <div className="wt-hholder">The land lies unrevealed</div>
                    </div>
                    <span className="wt-tag t-amber">Quiet</span>
                  </div>
                  <div className="wt-hmeta">
                    Sound the war horn below — deploy the muster and the pods, owners, and land fill
                    the board.
                  </div>
                </button>
              )}
            </div>

            {/* The guilds — the functions of the realm */}
            <div className="wt-field-cap wt-field-cap-later">
              The Crown offices — the household's own crafts, seated in the palace
            </div>
            <div className="wt-field">
              {realm.guilds.map((g) => (
                <GuildTile
                  key={g.guild.id}
                  g={g}
                  now={now}
                  onOpen={() => setPanel({ kind: 'guild', guildId: g.guild.id })}
                />
              ))}
              <BasinTile
                regentName={theRegent?.name ?? 'The Regent'}
                unseated={realm.unseatedWork}
                untriaged={untriaged.length}
                crises={realm.crises}
                festering={festering}
                onOpen={() => setPanel({ kind: 'seat' })}
              />
            </div>

            {/* The undelegated posts — flags of work on no seat */}
            {throne.unseated.length > 0 && (
              <div className="wt-posts">
                {throne.unseated.slice(0, 6).map((l) => (
                  <button
                    className="wt-post"
                    key={l.holder}
                    title={l.holder}
                    onClick={() => setPanel({ kind: 'seat' })}
                  >
                    <div className="wt-post-h">
                      <span className="wt-post-n">{seatLabel(l.name)}</span>
                      <span className="wt-post-c wt-num">{l.cases.length}</span>
                    </div>
                    <div className="wt-post-s">
                      no seat holds it · oldest {l.oldestDays}d
                      {l.stuck > 0 ? ` · ${l.stuck} stuck` : ''}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* The Patrons' ring */}
            {realm.patrons.length > 0 && (
              <div className="wt-patrons">
                <span className="wt-pcap">Patrons</span>
                {[...withdrawn, ...wavering].slice(0, 6).map((p) => (
                  <button
                    key={p.name}
                    className={`wt-fav${p.withdrawn ? ' gone' : ''}`}
                    onClick={() => goToPatron(p)}
                    title={
                      p.withdrawn
                        ? `${p.name} — withdrawn; the estate is recalled`
                        : `${p.name} — faith ${p.faith} · ${p.doors.length} door${p.doors.length === 1 ? '' : 's'}${p.crises ? ` · ${p.crises} case${p.crises === 1 ? '' : 's'} in crisis` : ''}`
                    }
                  >
                    <span
                      className="wt-coin wt-num"
                      style={vars({ '--f': String(p.faith), '--fc': faithColor(p) })}
                    >
                      {p.faith}
                    </span>
                    <span className="wt-nm">{p.name}</span>
                  </button>
                ))}
                {steady.length > 0 && (
                  <span className="wt-fav is-steady" title="Patrons holding steady at full faith">
                    <span className="wt-coin" style={vars({ '--f': '100', '--fc': 'var(--wt-green)' })}>
                      ✦
                    </span>
                    <span className="wt-nm">+{steady.length} steady</span>
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            className="wt-boardswap"
            onClick={() => showCards(false)}
            title="The Map — the living realm"
          >
            ⛰ The Map
          </button>
        </main>
        )}

        {/* ── The clerks' word ───────────────────────────────────────────
            The fleet takes about a minute of real reasoning. Neither the wait
            nor its outcome may pass unremarked on the board. */}
        {(clerksWorking || clerkResult) && (
          <div
            className={`wt-clerkline is-${clerksWorking ? 'working' : clerkResult!.tone}`}
            role="status"
            aria-live="polite"
          >
            <span className="wt-clerkmark" aria-hidden="true">
              {clerksWorking ? (
                // PLACEHOLDER ART (Edwin, 2026-07-27: placeholders and a note,
                // not a graphics attempt) — ten quills scratching in turn, one
                // per seat, so a minute of waiting shows the fleet at work
                // rather than a bare spinner. Pure CSS, no asset. A real design
                // pass should replace this whole strip; see the note in
                // docs/HANDOFF.md.
                <span className="wt-scribes" aria-hidden="true">
                  {Array.from({ length: 10 }, (_, i) => (
                    <span key={i} className="wt-quill" style={vars({ '--i': String(i) })}>
                      ✒
                    </span>
                  ))}
                </span>
              ) : clerkResult!.tone === 'error' ? (
                '⚠'
              ) : (
                '📜'
              )}
            </span>
            <span className="wt-clerktext">
              {clerksWorking ? (
                <>
                  <b>The clerks are at work.</b> Ten seats reason in turn through the live
                  brain — this takes about a minute. {clerkElapsed}s elapsed.
                </>
              ) : (
                <b>{clerkResult!.line}</b>
              )}
            </span>
            {!clerksWorking && clerkResult!.proposals > 0 && (
              <button
                className="wt-tbtn primary"
                onClick={() => {
                  setClerkResult(null);
                  setPanel({ kind: 'ledger' });
                }}
              >
                Read them on the Ledger →
              </button>
            )}
            {!clerksWorking && (
              <button
                className="wt-clerkx"
                onClick={() => setClerkResult(null)}
                aria-label="Dismiss the clerks' word"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* ── The time control ───────────────────────────────────────── */}
        {/* THE WAR-CLOCK FOOTER IS GONE (Edwin, 2026-07-29: "the bottom is
            largely wasted space and shouldn't be persistently displayed"). It
            held 12% of the screen at 1440x900 — and MORE of a small one, 114px
            wrapping to two rows at 1366px against 88px at 1920px. What it
            carried is split by how often it is wanted: the clock reading and
            the two advance keys ride the ribbon, where a glance finds them; the
            muster's own acts — deploy, the campaign, the clerks, the strike —
            live on the War Games surface (g w) and in the palette. Nothing was
            dropped; each thing simply stands where its frequency earns it. */}

        {/* ── The council feed ───────────────────────────────────────── */}
        {councilOpen && (
        <aside className="wt-advisor wt-chrome" aria-label="The Council">
          {/* The count stands ON the thing it counts. It used to ride a ⚑ button
              in the ribbon whose only other job was to open a copy of this very
              list — so the count travelled away from the heralds and the button
              stayed to duplicate them. */}
          <div className="wt-acap">
            <span>
              The Council ·{' '}
              {alarms > 0
                ? `${alarms} ${alarms === 1 ? 'matter presses' : 'matters press'}`
                : 'nothing presses'}
            </span>
            <span className="wt-acap-acts">
              {/* ONE toggle for the whole column, not a chevron on every row.
                  Five rows each with their own expander is five more controls in
                  the densest place on the board. */}
              <button
                className={`wt-atog${showWhy ? ' on' : ''}`}
                onClick={() => setWhy(!showWhy)}
                aria-pressed={showWhy}
                title={
                  showWhy
                    ? 'Hide the reasoning under each matter'
                    : 'Show why each matter presses'
                }
              >
                Why
              </button>
              <button
                className="wt-atog"
                onClick={() => showCouncil(false)}
                title="Lower the Council — the board takes the space ( c )"
                aria-label="Lower the Council"
              >
                ✕
              </button>
            </span>
          </div>
          {campaign && (
            <div className={`wt-scrap wt-camp${campaign.finished ? ' done' : ''}`}>
              <div className="wt-sh">
                <span>
                  {campaign.finished
                    ? `${campaign.scenario.title} — learned`
                    : `${campaign.scenario.title} · act ${campaign.current!.number} of ${campaign.total}`}
                </span>
                {/* "act 4 of 6" beside "4/6" read as though four were finished
                    AND you were on the fourth. The acts are not a straight line —
                    a later one can be answered while an earlier one still
                    stands, and an act that comes undone stops counting — so the
                    tally says plainly what it is: how many are answered. */}
                <span className="wt-campn" title="Acts answered">
                  ✓ {campaign.complete}
                </span>
              </div>
              {campaign.finished ? (
                <div className="wt-sb">
                  Every act is answered. The holding you learned on is one knight's book — the
                  realm is two hundred doors and it does not wait.
                </div>
              ) : (
                <>
                  <div className="wt-camp-t">{campaign.current!.act.title}</div>
                  {/* The act's herald is its LESSON — the longest prose on the
                      board, and the campaign card was the densest card of the
                      five (51 words measured). It follows the same rule as the
                      matters: the act's title, its progress and its road are the
                      instruction; the teaching sits behind "Why". */}
                  {showWhy && <div className="wt-sb">{campaign.current!.act.herald}</div>}
                  <div className="wt-camp-p">{campaign.progress}</div>
                  {ACT_ROAD[campaign.current!.act.key] && (
                    <div className="wt-sact">
                      <button onClick={ACT_ROAD[campaign.current!.act.key].go}>
                        {ACT_ROAD[campaign.current!.act.key].label} →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {heraldScraps}
        </aside>
        )}

      {/* ── The overlay panels — a seat entered, over the board ──────── */}
      {panel?.kind === 'pod' && !openPod && (
        <PanelGone what="pod" onClose={() => setPanel(null)} />
      )}
      {panel?.kind === 'guild' && !openGuild && (
        <PanelGone what="craft" onClose={() => setPanel(null)} />
      )}
      {openPod && (
        <PanelShell
          medallion={initialsOf(openPod.knightName)}
          ring={RING[openPod.health]}
          title={openPod.knightName}
          sub={`A pod of the realm · ${openPod.owners.length} owner${openPod.owners.length === 1 ? '' : 's'} · ${openPod.filled} of ${openPod.capacity} doors`}
          onClose={() => setPanel(null)}
        >
          <PodPanel pod={openPod} unplaced={realm.unplaced} act={regent} />
        </PanelShell>
      )}
      {openGuild && (
        <PanelShell
          medallion={openGuild.master ? initialsOf(openGuild.master.name) : '?'}
          ring={
            openGuild.manned
              ? openGuild.master?.pledge === 'sellsword'
                ? 'var(--wt-amber)'
                : 'var(--wt-green)'
              : 'var(--wt-red)'
          }
          title={openGuild.guild.name}
          sub={
            openGuild.master
              ? `${openGuild.master.pledge === 'sellsword' ? 'Kept by' : 'Headed by'} ${openGuild.master.name}${openGuild.master.pledge === 'sellsword' ? ' (artisan)' : ''}`
              : 'Headless — delegation debt on the household\u2019s side'
          }
          onClose={() => setPanel(null)}
        >
          <GuildPanel
            g={openGuild}
            kingdom={kingdom}
            court={court}
            census={census}
            now={now}
            catalog={catalogRows}
          />
        </PanelShell>
      )}
      {panel?.kind === 'seat' && (
        <PanelShell
          medallion={initialsOf(theRegent?.name ?? 'S')}
          ring="var(--wt-gold)"
          title="The Regent's Seat"
          sub={`${theRegent?.name ?? 'The Regent'} · the catch-basin, made a console`}
          onClose={() => setPanel(null)}
        >
          <SeatPanel
            unseatedWork={realm.unseatedWork}
            untriaged={untriaged}
            crises={realm.crises}
            queues={throne.unseated}
            onRegent={throne.onRegent}
            targets={handTargets}
            catalog={catalogRows}
            now={now}
            act={regent}
          />
        </PanelShell>
      )}
      {panel?.kind === 'recruit' && (
        <PanelShell
          medallion="+"
          ring="var(--wt-gold)"
          title="Recruit a knight"
          sub="A commission opens a pod — owners can then be placed in its care"
          onClose={() => setPanel(null)}
        >
          <RecruitPanel kingdom={kingdom} pods={realm.pods} gameOn={seed != null} act={regent} />
        </PanelShell>
      )}
      {panel?.kind === 'place' && (
        <PanelShell
          medallion="!"
          ring="var(--wt-red)"
          title="Place the owners"
          sub="The allocation debt — every estate belongs in a knight's care"
          onClose={() => setPanel(null)}
        >
          <PlacePanel
            unplaced={realm.unplaced}
            pods={realm.pods}
            act={regent}
            onRecruit={() => setPanel({ kind: 'recruit' })}
          />
        </PanelShell>
      )}
      {panel?.kind === 'census' && (
        <PanelShell
          medallion="📖"
          ring="var(--wt-gold)"
          title="The Census"
          sub="The court's own shape — who answers to whom, and every subject managed where they stand"
          onClose={() => setPanel(null)}
        >
          <CensusView kingdom={kingdom} census={census} court={court} />
        </PanelShell>
      )}
      {panel?.kind === 'counting' && (
        <PanelShell
          medallion="🏦"
          ring="var(--wt-gold)"
          title="The Counting-house"
          sub="The two treasuries — the estates in trust and the Crown's own coin — folded from the money log"
          onClose={() => setPanel(null)}
        >
          <CountingHousePanel economy={economy} estates={estates} seed={seed} now={now} coffers={realm.coffers} />
        </PanelShell>
      )}
      {panel?.kind === 'marches' && (
        <PanelShell
          medallion="🏴"
          ring="var(--wt-amber)"
          title="The Marches"
          sub="The border lands — all that enters the realm arrives here first"
          onClose={() => setPanel(null)}
        >
          <MarchesPanel kingdom={kingdom} marches={marches} census={census} />
        </PanelShell>
      )}
      {panel?.kind === 'throne' && (
        <PanelShell
          medallion="👑"
          ring={throne.debt === 0 ? 'var(--wt-green)' : 'var(--wt-red)'}
          title="The Throne"
          sub="The King's seat — every fief lorded, every box on a real desk. Drive the debt to zero."
          onClose={() => setPanel(null)}
        >
          <ThronePanel
            throne={throne}
            coffers={realm.coffers}
            patrons={realm.patrons.length}
            wavering={wavering.length}
            withdrawn={withdrawn.length}
            crises={realm.crises}
            seed={seed}
            onSeat={() => setPanel({ kind: 'seat' })}
          />
        </PanelShell>
      )}
      {panel?.kind === 'muster' && (
        <PanelShell
          medallion="⚔️"
          ring={game ? 'var(--wt-green)' : 'var(--wt-amber)'}
          title="The War Games"
          sub="The proving ground — the whole operation folded from the muster's events"
          onClose={() => setPanel(null)}
        >
          {/* The horn stands FIRST, above the readings. This is the surface you
              come to in order to deploy, and design law 6 asks the act to stand
              beside the record it changes — not three scrolls under it. */}
          {musterHorn}
          <MusterPanel
            game={game}
            log={log}
            catalog={catalogRows}
            flows={flows}
            kingdom={kingdom}
            now={now}
            seed={seed}
            // The horn is on this very surface now, so "to the horn" is a focus
            // move within the panel, not a journey out of it and down a page.
            onToHorn={() => seedRef.current?.focus()}
          />
        </PanelShell>
      )}
      {panel?.kind === 'ledger' && (
        <PanelShell
          wide
          medallion="🗂"
          ring="var(--wt-gold)"
          title="The Ledger"
          sub="The living instrument's spine — every act on the real work, and the readings folded from it"
          onClose={() => setPanel(null)}
        >
          <LedgerView
            events={events}
            catalog={catalog}
            flows={flows}
            kingdom={kingdom}
            now={now}
            focusCase={panel.focusCase}
          />
        </PanelShell>
      )}
      {panel?.kind === 'fief' &&
        (() => {
          // Resolve the territory ITSELF, then read it — `readKingdom` folds
          // only `kind: 'fief'` (the map's list), so looking the panel up there
          // meant an OFFICE could never be found and the block returned null.
          // The board only renders when no panel stands, so the centre of the
          // War Table went BLANK: no title, no ✕, only Esc or the rail to
          // escape. It fired on the plain founding census — every Crown office
          // is an office, and "Administer the keep →" is offered on all three.
          // `readFief` is happy to read any territory; only the LIST was
          // narrowed. (Found by an adversarial audit, 2026-07-27.)
          const territory = kingdom.territories.find((t) => t.id === panel.id);
          const reading = territory ? readFief(kingdom, territory) : null;
          if (!reading) return <PanelGone what="keep" onClose={() => setPanel(null)} />;
          const ids = [reading.territory.id, ...reading.hamlets.map((h) => h.territory.id)];
          return (
            <PanelShell
              wide
              medallion="🏰"
              ring={FIEF_RING[reading.state]}
              title={reading.territory.name}
              sub={`Administer the keep · ${FIEF_STATE_LABEL[reading.state]}`}
              onClose={() => setPanel(null)}
            >
              <FiefDetail
                reading={reading}
                kingdom={kingdom}
                court={court}
                onPromote={census.promote}
                onDemote={(territoryId, parentId) => {
                  census.demote(territoryId, parentId);
                  setPanel({ kind: 'fief', id: parentId });
                }}
                fromMarches={dispatchedTo(marches.ledger, ids)}
                onRecall={marches.recall}
                upkeep={upkeepForTerritories(kingdom, treasury.ledger, ids)}
                onStrikeUpkeep={treasury.strike}
              />
            </PanelShell>
          );
        })()}
      {panel?.kind === 'person' &&
        (() => {
          const person = kingdom.people.find((p) => p.id === panel.id);
          if (!person) return <PanelGone what="subject" onClose={() => setPanel(null)} />;
          return (
            <PanelShell
              wide
              medallion={initialsOf(person.name)}
              ring="var(--wt-gold)"
              title={person.name}
              sub={PLEDGE_LABEL[person.pledge]}
              onClose={() => setPanel(null)}
            >
              <PersonView
                key={person.id}
                person={person}
                paid={upkeepForPerson(kingdom, treasury.ledger, person.id)}
                kingdom={kingdom}
                onRevoke={court.revoke}
                onRepledge={census.repledge}
                onStrike={(id) => {
                  // A cancelled confirm on a founding record must leave this
                  // panel standing, not sail on to the Census as if it struck.
                  if (!confirmCensusStrike(id)) return;
                  rawCensus.strike(id);
                  setPanel({ kind: 'census' });
                }}
              />
            </PanelShell>
          );
        })()}
      {panel?.kind === 'court' && (
        <PanelShell
          wide
          medallion="⚖️"
          ring="var(--wt-gold)"
          title="The court sits"
          sub="Every decision of the realm, brought before the Crown — heaviest first"
          onClose={() => setPanel(null)}
        >
          <CourtPanel
            roll={rollActs}
            court={court0}
            onGo={(m) => {
              if (m.go.kind === 'case') setPanel({ kind: 'ledger', focusCase: m.go.caseId });
              else if (m.go.kind === 'guild') setPanel({ kind: 'guild', guildId: m.go.guildId });
              else if (m.go.kind === 'fief') setPanel({ kind: 'fief', id: m.go.territoryId });
              else setPanel({ kind: 'place' });
            }}
          />
        </PanelShell>
      )}
      {panel?.kind === 'crown' && (
        <PanelShell
          wide
          medallion="👑"
          ring="var(--wt-gold)"
          title="The Crown"
          sub="The kingdom itself — the royal line and its retinue"
          onClose={() => setPanel(null)}
        >
          <CrownView kingdom={kingdom} />
        </PanelShell>
      )}
      {paletteOpen && (
        <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />
      )}
      </div>
    </div>
    </BoardName.Provider>
    </DetailContext.Provider>
    </NavContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// The tiles on the vellum
// ═══════════════════════════════════════════════════════════════════════════

const POD_TAG: Record<PodHealth, { label: string; tone: string }> = {
  thriving: { label: 'Thriving', tone: 't-green' },
  strained: { label: 'Strained', tone: 't-amber' },
  failing: { label: 'Failing', tone: 't-red' },
};

/** One knight's pod: the book of owners and their land, the rent it earns. */
function PodTile({ pod, onOpen }: { pod: PodReading; onOpen: () => void }) {
  const empty = pod.owners.length === 0;
  const ring = empty ? 'var(--wt-gold)' : RING[pod.health];
  const tag = empty ? { label: 'Open', tone: 't-amber' } : POD_TAG[pod.health];
  return (
    <button className="wt-holding" style={vars({ '--ring': ring })} onClick={onOpen}>
      <div className="wt-hhead">
        <div className="wt-medallion">{initialsOf(pod.knightName)}</div>
        <div className="wt-hgrow">
          <div className="wt-htitle">{pod.knightName}</div>
          <div className="wt-hholder">
            {empty
              ? 'Keeping no owner yet'
              : `${pod.owners.length} owner${pod.owners.length === 1 ? '' : 's'} in care`}
          </div>
        </div>
        <span className={`wt-tag ${tag.tone}`}>{tag.label}</span>
      </div>
      {!empty && (
        <div className="wt-hwork">
          <span className="wt-hcount wt-num">{pod.filled} doors</span>
          {pod.crises > 0 && (
            <span className="wt-pips" aria-hidden="true">
              {Array.from({ length: Math.min(8, pod.crises) }).map((_, i) => (
                <i key={i} className="wt-pipdot c" />
              ))}
            </span>
          )}
        </div>
      )}
      <div
        className="wt-capbar"
        title={`${pod.filled} of ${pod.capacity} doors — the room to grow`}
        aria-hidden="true"
      >
        <span style={{ width: `${Math.max(2, Math.min(100, Math.round((pod.filled / pod.capacity) * 100)))}%` }} />
      </div>
      <div className="wt-hmeta">
        {empty
          ? 'The room to grow — enter to place owners →'
          : `faith ${pod.faith} · ${coin(pod.rent)}/mo rent roll${pod.crises > 0 ? ` · ${pod.crises} in crisis` : ''}`}
      </div>
    </button>
  );
}

/** One CROWN OFFICE: the craft, its Chancellor (or the debt of none), its
 *  load. It read "guild / master / unmanned" until 2026-07-29 — the vocabulary
 *  the Brokerage writ retired, still on the board eight days after the code
 *  beneath it was refounded. A guild is an OUTSIDE trade now; these three are
 *  the household's own crafts, and the person who heads one is a Chancellor. */
function GuildTile({ g, now, onOpen }: { g: GuildReading; now: string; onOpen: () => void }) {
  const kept = g.master?.pledge === 'sellsword';
  const ring = g.manned ? (kept ? 'var(--wt-amber)' : 'var(--wt-green)') : 'var(--wt-red)';
  const tag = g.manned
    ? kept
      ? { label: 'Kept', tone: 't-amber' }
      : { label: 'Headed', tone: 't-green' }
    : { label: 'Headless', tone: 't-red' };
  const pips = g.cases.slice(0, 10).map((c) => {
    const age = ageInDays(c, now) ?? 0;
    return age >= 14 ? 'c' : age >= 7 ? 'f' : '';
  });
  return (
    <button className={`wt-holding${g.manned ? '' : ' is-empty'}`} style={vars({ '--ring': ring })} onClick={onOpen}>
      <div className="wt-hhead">
        <div className={`wt-medallion${g.master ? '' : ' is-vacant'}`}>
          {g.master ? initialsOf(g.master.name) : '?'}
        </div>
        <div className="wt-hgrow">
          <div className="wt-htitle">{g.guild.name}</div>
          <div className="wt-hholder">
            {g.master ? (
              <>
                {kept ? 'Keeper' : 'Chancellor'} <b>{g.master.name}</b>
                {kept && <span> (artisan)</span>}
              </>
            ) : (
              'No Chancellor heads the craft'
            )}
          </div>
        </div>
        <span className={`wt-tag ${tag.tone}`}>{tag.label}</span>
      </div>
      <div className="wt-hwork">
        <span className="wt-hcount wt-num">{g.cases.length} open</span>
        {pips.length > 0 && (
          <span className="wt-pips" aria-hidden="true">
            {pips.map((p, i) => (
              <i key={i} className={`wt-pipdot${p ? ` ${p}` : ''}`} />
            ))}
          </span>
        )}
      </div>
      <div className="wt-hmeta">
        {g.cases.length > 0
          ? `oldest ${g.oldestDays}d${g.stuck > 0 ? ` · ${g.stuck} stuck past 7d` : ''}`
          : g.manned
            ? 'No open work rests on this craft.'
            : 'Falls to the Regent — enter to seat a Chancellor →'}
      </div>
    </button>
  );
}

/** The Regent's own catch-basin — the seat that must delegate to live. */
function BasinTile({
  regentName,
  unseated,
  untriaged,
  crises,
  festering,
  onOpen,
}: {
  regentName: string;
  unseated: number;
  untriaged: number;
  crises: number;
  festering: number;
  onOpen: () => void;
}) {
  const tag =
    unseated >= 50
      ? { label: 'Drowning', tone: 't-red' }
      : unseated > 0
        ? { label: 'Laden', tone: 't-amber' }
        : { label: 'Clear', tone: 't-green' };
  const ring = unseated >= 50 ? 'var(--wt-red)' : unseated > 0 ? 'var(--wt-amber)' : 'var(--wt-green)';
  const pips = Array.from({ length: Math.min(8, crises) }, () => 'c').concat(
    Array.from({ length: Math.min(Math.max(0, 8 - crises), festering) }, () => 'f'),
  );
  return (
    <button className="wt-holding" style={vars({ '--ring': ring })} onClick={onOpen}>
      <div className="wt-hhead">
        <div className="wt-medallion">{initialsOf(regentName)}</div>
        <div className="wt-hgrow">
          <div className="wt-htitle">The Regent's Seat</div>
          <div className="wt-hholder">
            <b>{regentName}</b> · the catch-basin
          </div>
        </div>
        <span className={`wt-tag ${tag.tone}`}>{tag.label}</span>
      </div>
      <div className="wt-hwork">
        <span className={`wt-hcount wt-num${unseated > 0 ? ' wt-waxink' : ''}`}>
          {unseated} on no desk
        </span>
        {pips.length > 0 && (
          <span className="wt-pips" aria-hidden="true">
            {pips.map((p, i) => (
              <i key={i} className={`wt-pipdot ${p}`} />
            ))}
          </span>
        )}
      </div>
      <div className="wt-hmeta">
        {untriaged} untriaged · {crises} case{crises === 1 ? '' : 's'} in crisis · enter to identify &amp; delegate →
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// The overlay panels
// ═══════════════════════════════════════════════════════════════════════════

/** The panel chrome: scrim, slide-in sheet, head with medallion and the ✕. */
/** The subject a standing panel names is GONE — struck, or swept by a Reset
 *  fired from the time control, which lives outside every panel and so can run
 *  while one is open. Each of these blocks used to `return null`, and because
 *  the board renders only when NO panel stands, the centre of the War Table
 *  went blank: no title, no ✕, no way back but Escape or the rail. A surface
 *  that cannot show its subject must still show its own door. */
function PanelGone({ what, onClose }: { what: string; onClose: () => void }) {
  return (
    <PanelShell
      medallion="○"
      ring="var(--wt-edge)"
      title="It is no longer on the books"
      sub={`The ${what} this surface named has been struck or swept away`}
      onClose={onClose}
    >
      <div className="wt-card ct-empty">
        <p>
          Nothing stands here now. The records that named it are gone — struck by hand, or swept
          when the muster was reset. <b>Close this and the board is as it was.</b>
        </p>
      </div>
    </PanelShell>
  );
}

function PanelShell({
  medallion,
  ring,
  title,
  sub,
  onClose,
  wide,
  children,
}: {
  medallion: string;
  ring: string;
  title: string;
  sub: string;
  onClose: () => void;
  /** A wider sheet for a dense surface (the Ledger). */
  wide?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const detail = useDetail();
  const toggleDetail = useToggleDetail();
  const boardName = useContext(BoardName);
  // Entering a surface takes the CENTRE of the table, not a sheet over it
  // (Edwin, 2026-07-27): the ribbon, the command rail, and the Council stand
  // still; only the board between them changes. So the shell is no longer a
  // dialog — it is the board, wearing a different face. Focus still moves to
  // it, because the surface under the Regent's eye has changed; Escape
  // returns to the Table, as the scrim's click used to.
  useEffect(() => {
    ref.current?.focus();
    // The board is a long scroll; a surface entered from its foot must not
    // open halfway down itself.
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <section
      className={`wt-panel${wide ? ' wt-panel-wide' : ''}`}
      aria-label={title}
      tabIndex={-1}
      ref={ref}
    >
      <div className="wt-ptop">
        <div className="wt-medallion" style={vars({ '--ring': ring })}>
          {medallion}
        </div>
        <div className="wt-hgrow">
          <h2>{title}</h2>
          <div className="wt-psub">{sub}</div>
        </div>
        <button
          className={`wt-detail wt-detail-sm${detail ? ' on' : ''}`}
          onClick={toggleDetail}
          title={detail ? 'Detail mode — click for the clean view' : 'Clean view — click for detail (raw ids + prose)'}
          aria-pressed={detail}
        >
          <span aria-hidden="true">{detail ? '◆' : '◇'}</span>
          <span className="wt-detail-lbl">{detail ? 'Detail' : 'Clean'}</span>
        </button>
        <button className="wt-close" onClick={onClose} aria-label={`Back to ${boardName}`}>
          ✕ <span className="wt-close-lbl">Back to {boardName}</span>
        </button>
      </div>
      <div className="wt-pbody">{children}</div>
    </section>
  );
}

/** Holding court: the whole realm's pending decisions in one docket, heaviest
 *  first (Edwin, 2026-07-27). Court is not a thing done at a keep — going to a
 *  keep is administering. Court is where everyone else's matters are brought
 *  TO the Crown for a signoff, a blessing, or guidance. */
function CourtPanel({
  court,
  roll,
  onGo,
}: {
  court: CourtReading;
  roll: RollActions;
  onGo: (m: Matter) => void;
}) {
  const KIND_WORD: Record<Matter['kind'], string> = {
    proposal: 'a clerk proposes',
    approval: 'awaits your word',
    seat: 'a craft with no Chancellor',
    keep: 'a keep with no holder',
    placement: 'owners in no care',
  };
  return (
    <>
      <div className="wt-stats">
        {/* The three describe THIS SITTING — the same rows listed below them.
            When the docket is capped the backlog says so out loud, rather than
            the crisis count silently counting a set the list does not show. */}
        <Stat
          n={court.waiting > court.matters.length ? `${court.matters.length} of ${court.waiting}` : court.matters.length}
          label="Before the court"
          tone={court.matters.length > 0 ? 'warn' : 'good'}
        />
        <Stat
          n={court.inCrisisAll > court.inCrisis ? `${court.inCrisis} of ${court.inCrisisAll}` : court.inCrisis}
          label="In crisis"
          tone={court.inCrisisAll > 0 ? 'bad' : 'good'}
        />
        <Stat
          n={court.holdingMoneyAll > court.holdingMoney ? `${court.holdingMoney} of ${court.holdingMoneyAll}` : court.holdingMoney}
          label="Holding coin"
          tone={court.holdingMoneyAll > 0 ? 'warn' : 'good'}
        />
      </div>
      <Explain className="wt-fine">
        The realm's decisions, brought before you in order of what they cost to leave — a stopped
        cascade and held coin outrank a standing debt, and a crisis outranks them all. Answer one
        and it leaves the docket; nothing here is stored, so a matter settled elsewhere simply
        stops being brought.
      </Explain>
      {roll.reachable && <CourtHall roll={roll} />}
      {court.matters.length === 0 ? (
        <div className="wt-card">
          <p className="wt-fine">
            No matter stands before the court. Every decision the realm can put to you has been
            answered.
          </p>
        </div>
      ) : (
        <div className="wt-card">
          {court.matters.map((m, i) => (
            <button key={m.id} className={`wt-matter${m.inCrisis ? ' is-crisis' : ''}`} onClick={() => onGo(m)}>
              <span className="wt-matter-rank wt-num">{i + 1}</span>
              <span className="wt-matter-body">
                <span className="wt-matter-head">
                  <b>{m.subject}</b>
                  <span className="wt-matter-kind">{KIND_WORD[m.kind]}</span>
                  {m.inCrisis && <span className="wt-tag t-red">In crisis</span>}
                  {m.holdsMoney && <span className="wt-tag t-amber">Holds coin</span>}
                </span>
                <span className="wt-matter-asks">{m.asks}</span>
                <span className="wt-matter-foot">
                  brought by {m.brings}
                  {m.waitingDays > 0 && ` · waiting ${m.waitingDays}d`}
                </span>
              </span>
              <span className="wt-matter-go" aria-hidden="true">
                →
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/** The hall — the shared court roll: the matters the realm's OTHER people have
 *  put before the Crown, and the door by which anyone puts one.
 *
 *  One-sided, and the app does not decide that: the wall governs what comes
 *  back (src/server/courtroll.ts). The Crown receives every matter and every
 *  petitioner; a subject receives only their own. Rendering what the door
 *  returns — rather than filtering here — keeps the law in ONE place, since a
 *  second copy of a visibility rule is the copy that drifts and leaks. */
function CourtHall({ roll }: { roll: RollActions }) {
  const [subject, setSubject] = useState('');
  const [asks, setAsks] = useState('');
  const [queued, setQueued] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [answering, setAnswering] = useState<string | null>(null);
  const [word, setWord] = useState('');
  const { sovereign, court, matters } = roll.roll;
  const standing = matters.filter((m) => !m.heard_at);

  const put = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !asks.trim()) return;
    const err = await roll.petition(subject, asks, queued);
    setSaid(err ?? 'Your matter is on the roll.');
    if (!err) {
      setSubject('');
      setAsks('');
      setQueued(false);
    }
  };

  return (
    <>
      <div className="wt-card">
        <h3>
          The hall{' '}
          {standing.length > 0 && <span className="wt-tag t-amber">{standing.length}</span>}
          {court.open && <span className="wt-tag t-green">Court sits</span>}
        </h3>
        <Explain className="wt-fine">
          {sovereign
            ? 'Every matter the realm has put before you, from every hand — nothing on this roll is private from the Crown. Those standing in the hall are heard first.'
            : court.open
              ? 'Court sits now. Put your matter to the Crown, and ask to be heard while it sits.'
              : 'Court does not sit. Leave your matter and it will be heard when it next does.'}
        </Explain>
        {sovereign && (
          <div className="wt-sact">
            <button className="wt-tbtn" onClick={() => void roll.hold(!court.open)}>
              {court.open ? 'Close the court' : '⚖️ Open the court'}
            </button>
            {court.open && (
              <span className="wt-fine">
                The hall is open — everyone in the realm may queue to be heard.
              </span>
            )}
          </div>
        )}
        {standing.length === 0 ? (
          <p className="wt-fine">
            {sovereign ? 'No one waits in the hall.' : 'You have no matter standing.'}
          </p>
        ) : (
          standing.map((m: RollMatter) => (
            <div className="wt-matter" key={m.id}>
              <span className="wt-matter-body">
                <span className="wt-matter-head">
                  <b>{m.subject}</b>
                  {m.queued_at && <span className="wt-tag t-green">In the hall</span>}
                </span>
                <span className="wt-matter-asks">{m.asks}</span>
                <span className="wt-matter-foot">
                  brought by {m.submitted_by} · {m.submitted_at.slice(0, 10)}
                </span>
                {sovereign &&
                  (answering === m.id ? (
                    <form
                      className="wt-actline"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await roll.answer(m.id, word);
                        setAnswering(null);
                        setWord('');
                      }}
                    >
                      <input
                        className="wt-textin"
                        value={word}
                        onChange={(e) => setWord(e.target.value)}
                        placeholder="The Crown's word…"
                        aria-label={`Answer ${m.subject}`}
                      />
                      <button type="submit" className="wt-go">
                        Give the word
                      </button>
                      <button type="button" className="wt-go" onClick={() => setAnswering(null)}>
                        Not yet
                      </button>
                    </form>
                  ) : (
                    <span className="wt-sact">
                      <button className="wt-go" onClick={() => setAnswering(m.id)}>
                        Hear it →
                      </button>
                    </span>
                  ))}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="wt-card">
        <h3>Put a matter before the court</h3>
        <Explain className="wt-fine">
          A signoff, a blessing, or guidance — anything that needs the Crown's word. What you send
          is seen by the Crown, always; no one else in the realm sees another's matter.
        </Explain>
        <form onSubmit={put}>
          <div className="wt-actline">
            <input
              className="wt-textin"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="The matter, in a few words"
              aria-label="The matter"
            />
          </div>
          <div className="wt-actline">
            <input
              className="wt-textin"
              value={asks}
              onChange={(e) => setAsks(e.target.value)}
              placeholder="What you ask of the Crown"
              aria-label="What you ask"
            />
            <button type="submit" className="wt-go" disabled={!subject.trim() || !asks.trim()}>
              Put it on the roll
            </button>
          </div>
          {court.open && (
            <label className="wt-fine wt-actline">
              <input type="checkbox" checked={queued} onChange={(e) => setQueued(e.target.checked)} />
              Ask to be heard while court sits
            </label>
          )}
        </form>
        {said && <p className="wt-fine">{said}</p>}
      </div>
    </>
  );
}

/** A stat brick in a panel's top row. */
function Stat({ n, label, tone }: { n: number | string; label: string; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <div className="wt-stat">
      <div className={`wt-stat-n wt-num${tone ? ` ${tone}` : ''}`}>{n}</div>
      <div className="wt-lbl">{label}</div>
    </div>
  );
}

/** Inside a pod: the owners in care, and the act — place an unplaced owner
 *  here (regent.placeOwner). */
function PodPanel({
  pod,
  unplaced,
  act,
}: {
  pod: PodReading;
  unplaced: PatronReading[];
  act: RegentActions;
}) {
  return (
    <>
      <div className="wt-stats">
        <Stat n={pod.owners.length} label="Owners" />
        <Stat n={pod.filled} label={`Doors of ${pod.capacity}`} />
        <Stat n={coin(pod.rent)} label="Rent /mo" tone="good" />
        <Stat
          n={pod.faith}
          label="Faith"
          tone={pod.faith <= 40 ? 'bad' : pod.faith < 90 ? 'warn' : 'good'}
        />
      </div>

      <div className="wt-card">
        <h3>The book of owners</h3>
        <Explain className="wt-fine">
          The Patrons in {pod.knightName}'s care, and the land they hold. The rent roll is the
          owners' money the knight collects; the Crown's tribute is a slice of it.
        </Explain>
        {pod.owners.length === 0 ? (
          <p className="wt-fine">No owner rests in this pod yet — place one below.</p>
        ) : (
          pod.owners.map((o) => (
            <div className="wt-row" key={o.name}>
              <span className="wt-rowt">
                <span
                  className="wt-coin wt-coin-dark wt-num"
                  style={vars({ '--f': String(o.faith), '--fc': faithColor(o) })}
                >
                  {o.faith}
                </span>{' '}
                <b>{o.name}</b>
                <span className="wt-rowm">
                  {' '}
                  · {o.doors.length} door{o.doors.length === 1 ? '' : 's'}
                  {o.crises > 0 && ` · ${o.crises} in crisis`}
                  {o.crises === 0 && o.festering > 0 && ` · ${o.festering} festering`}
                  {o.withdrawn && ' · withdrawn — estate recalled'}
                </span>
              </span>
            </div>
          ))
        )}
      </div>

      <div className="wt-card">
        <h3>Place an owner here</h3>
        <Explain className="wt-fine">
          The Regent's allocation act: an unplaced estate settles into this knight's care —
          most-at-risk first. A placement is a recorded act; an owner can be re-placed later.
        </Explain>
        {unplaced.length === 0 ? (
          <p className="wt-fine">Every owner rests in a knight's care. The allocation is clear.</p>
        ) : (
          unplaced.slice(0, 8).map((o) => (
            <div className="wt-row" key={o.name}>
              <span className="wt-rowt">
                <b>{o.name}</b>
                <span className="wt-rowm">
                  {' '}
                  · {o.doors.length} door{o.doors.length === 1 ? '' : 's'} · faith {o.faith}
                </span>
              </span>
              <button className="wt-go" onClick={() => act.placeOwner(o.name, pod.knightId)}>
                → place here
              </button>
            </div>
          ))
        )}
        {unplaced.length > 8 && (
          <p className="wt-fine">…and {unplaced.length - 8} more stand unplaced.</p>
        )}
      </div>
    </>
  );
}

/** Inside a CROWN OFFICE: its load, and the act — seat a Chancellor
 *  (court.grant) on the office. The "Administer the keep →" road that stood
 *  here is gone: it opened the FIEF page, which described the office as land
 *  and carried a control that destroyed it (see `goToTerritory`). An office is
 *  administered here, where its work already is. */
function GuildPanel({
  g,
  kingdom,
  court,
  census,
  now,
  catalog,
}: {
  g: GuildReading;
  kingdom: Kingdom;
  court: CourtActions;
  census: CensusActions;
  now: string;
  catalog: Catalog;
}) {
  const nav = useNav();
  const [pick, setPick] = useState('');
  const terr = g.keepId ? kingdom.territories.find((t) => t.id === g.keepId) : undefined;
  const role: 'lord' | 'mayor' = terr?.kind === 'hamlet' ? 'mayor' : 'lord';
  const candidates = grantable(kingdom);
  const worst = g.cases
    .slice()
    .sort((a, b) => (ageInDays(b, now) ?? 0) - (ageInDays(a, now) ?? 0))
    .slice(0, 8);
  return (
    <>
      <div className="wt-stats">
        <Stat n={g.cases.length} label="Open work" tone={g.cases.length > 0 ? 'warn' : 'good'} />
        <Stat n={`${g.oldestDays}d`} label="Oldest" tone={g.oldestDays >= 7 ? 'warn' : undefined} />
        <Stat n={g.stuck} label="Stuck > 7d" tone={g.stuck > 0 ? 'bad' : 'good'} />
      </div>

      <div className="wt-card">
        <h3>{g.manned ? 'The Chancellor' : 'Seat a Chancellor'}</h3>
        {g.manned && g.master ? (
          <>
            <Explain className="wt-fine">
              {g.master.pledge === 'sellsword' ? (
                <>
                  <InlineLink onClick={() => nav.goToPerson(g.master!.id)}>
                    <b>{g.master.name}</b>
                  </InlineLink>{' '}
                  keeps this craft as an appointed artisan — warm seat, foreign hands. The debt
                  clears for good when a subject is seated as its Chancellor.
                </>
              ) : (
                <>
                  <InlineLink onClick={() => nav.goToPerson(g.master!.id)}>
                    <b>{g.master.name}</b>
                  </InlineLink>{' '}
                  heads this craft as its Chancellor, by recorded grant. Healthy.
                </>
              )}
            </Explain>
            <div className="wt-sact">
              <button onClick={() => nav.goToPerson(g.master!.id)}>Open {g.master.name}</button>
            </div>
          </>
        ) : terr ? (
          <>
            <Explain className="wt-fine">
              No Chancellor heads {g.guild.name} — the work of this craft pools on the Regent.
              Seat a subject over the office and it is headed; the record is struck the same way
              it is made.
            </Explain>
            <form
              className="wt-actline"
              onSubmit={(e) => {
                e.preventDefault();
                if (pick) {
                  court.grant(terr.id, pick, role);
                  setPick('');
                }
              }}
            >
              <select
                className="wt-select"
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                aria-label={`Seat a Chancellor over ${g.guild.name}`}
              >
                <option value="">Seat a Chancellor over {g.guild.name}…</option>
                {candidates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.pledge === 'steward' ? ' (the Regent)' : ''}
                  </option>
                ))}
              </select>
              <button type="submit" className="wt-go" disabled={!pick}>
                Seat
              </button>
            </form>
          </>
        ) : (
          <>
            <Explain className="wt-fine">
              No office stands for {g.guild.name} yet, so its work pools on the Regent. Found the
              office and seat it in one act — the craft gets its seat and the Chancellor to head
              it. (A factory setting seats this itself when the real operation loads at the gate.)
            </Explain>
            <form
              className="wt-actline"
              onSubmit={(e) => {
                e.preventDefault();
                if (!pick) return;
                // Found the office under the craft's own name — which is how the
                // reading finds it (guilds.ts, keepOf) — then grant it at once.
                // As an OFFICE, not a fief: a craft of the household is seated
                // in the palace and is never land (WRIT-THE-BROKERAGE). Founding
                // it as a fief put a phantom holding on the realm map and made
                // the craft read as territory it does not hold.
                const keepId = census.found({ name: g.guild.name, kind: 'office' });
                if (keepId) court.grant(keepId, pick, 'lord');
                setPick('');
              }}
            >
              <select
                className="wt-select"
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                aria-label={`Seat a Chancellor over ${g.guild.name}`}
              >
                <option value="">Seat a Chancellor over {g.guild.name}…</option>
                {candidates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.pledge === 'steward' ? ' (the Regent)' : ''}
                  </option>
                ))}
              </select>
              <button type="submit" className="wt-go" disabled={!pick}>
                Found the office &amp; seat
              </button>
            </form>
          </>
        )}
      </div>

      <div className="wt-card">
        <h3>The work on this craft</h3>
        {worst.length === 0 ? (
          <p className="wt-fine">No open box rests on this guild's hands.</p>
        ) : (
          worst.map((c) => {
            const age = ageInDays(c, now);
            return (
              <div className="wt-row" key={c.caseId}>
                <span className="wt-rowt">
                  <CaseName caseId={c.caseId} catalog={catalog} card kind={c.catalogRow} />
                  {age != null && (
                    <span className={`wt-rowm${age >= 7 ? ' wt-old' : ''}`}>
                      {' '}
                      · {age === 0 ? 'today' : `${age}d`}
                    </span>
                  )}
                </span>
                <button className="wt-go" onClick={() => nav.goToLedger(c.caseId)}>
                  → ledger
                </button>
              </div>
            );
          })
        )}
        {g.cases.length > 8 && (
          <p className="wt-fine">…and {g.cases.length - 8} more on this craft's hands.</p>
        )}
      </div>
    </>
  );
}

/** The Regent's Seat as a panel: identify raw intake down the tree
 *  (regent.triggerTyped) and delegate the unowned queues (handQueue /
 *  handCase) — the same primitives the full seat drives. */
function SeatPanel({
  unseatedWork,
  untriaged,
  crises,
  queues,
  onRegent,
  targets,
  catalog,
  now,
  act,
}: {
  unseatedWork: number;
  untriaged: CaseReading[];
  crises: number;
  queues: SeatLoad[];
  onRegent: SeatLoad | null;
  targets: Person[];
  catalog: Catalog;
  now: string;
  act: RegentActions;
}) {
  const nav = useNav();
  return (
    <>
      <div className="wt-stats">
        <Stat n={unseatedWork} label="On no desk" tone={unseatedWork > 0 ? 'bad' : 'good'} />
        <Stat n={untriaged.length} label="Untriaged" tone={untriaged.length > 0 ? 'warn' : 'good'} />
        <Stat n={crises} label="In crisis" tone={crises > 0 ? 'bad' : 'good'} />
      </div>

      <div className="wt-card">
        <h3>Identify → put in motion</h3>
        <Explain className="wt-fine">
          Raw intake — "a thing happened at a door." Walk it down the tree; the leaf triggers its
          completion flow onto the right seat, and the ticket retires as a real cascade, not a
          tick.
        </Explain>
        {untriaged.length === 0 ? (
          <p className="wt-fine">No untriaged intake. Every ticket is in motion.</p>
        ) : (
          untriaged.slice(0, 6).map((c) => <IntakeIdentify key={c.caseId} c={c} catalog={catalog} now={now} act={act} />)
        )}
        {untriaged.length > 6 && (
          <p className="wt-fine">
            …and {untriaged.length - 6} more behind these. Identify one and the next takes its
            place.
          </p>
        )}
      </div>

      <div className="wt-card">
        <h3>Delegate to escape</h3>
        <Explain className="wt-fine">
          The unowned queues — work on no real seat. Hand a whole queue to a real seat in one act,
          or drill in and hand a single case.
        </Explain>
        {queues.length === 0 && !onRegent ? (
          <p className="wt-fine">Nothing undelegated. Every queue is a real seat.</p>
        ) : (
          <>
            {queues.map((l) => (
              <QueueHand
                key={l.holder}
                load={l}
                targets={targets}
                catalog={catalog}
                now={now}
                onHandAll={(to) => act.handQueue(l.holder, to)}
                onHandCase={(caseId, to) => act.handCase(caseId, to)}
              />
            ))}
            {onRegent && (
              <QueueHand
                load={onRegent}
                targets={targets}
                catalog={catalog}
                now={now}
                note="the catch-basin"
                onHandAll={(to) => act.handQueue(onRegent.holder, to)}
                onHandCase={(caseId, to) => act.handCase(caseId, to)}
              />
            )}
          </>
        )}
      </div>

      {/* "Open the full seat →" stood here and called nav.goToRegent(), which
          sets the panel this button is rendered inside — a re-render to
          byte-identical output. There is no fuller seat; this IS it. A button
          that promises a place that does not exist is worse than no button. */}
      <div className="wt-sact">
        <button onClick={() => nav.goToLedger()}>Walk the Ledger →</button>
      </div>
    </>
  );
}

/** One raw intake ticket with the tree beneath it — choosing the leaf fires
 *  regent.triggerTyped exactly as the full seat does. */
function IntakeIdentify({
  c,
  catalog,
  now,
  act,
}: {
  c: CaseReading;
  catalog: Catalog;
  now: string;
  act: RegentActions;
}) {
  const [open, setOpen] = useState(false);
  const age = ageInDays(c, now);
  const owner = ownerOfCase(c);
  // The intake ticket read through the one parser: head is the complaint,
  // place the door (caselabel.ts) — the raw id rides in the tooltip.
  const l = caseLabel(c.caseId, catalog);
  return (
    <div className="wt-intake">
      <button
        className="wt-disclose"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        title={l.raw}
      >
        {open ? '▾' : '▸'} <span className="cn-g cn-g-sm tone-plain" aria-hidden="true">✉️</span>{' '}
        <b>{l.head}</b>
        <span className="wt-rowm">
          {l.place ? ` — ${l.place}` : ''}
          {owner ? ` · ${owner}` : ''}
          {age != null && ` · ${age === 0 ? 'today' : `${age}d`}`}
        </span>
      </button>
      {open && (
        <IdentifyTree
          catalog={catalog}
          onPick={(leafKey) =>
            // The cascade's subject drops the intake marker (keeping the war
            // mark and the door) so a cascade never reads back as raw intake;
            // the raw ticket retires via `resolves`.
            act.triggerTyped(leafKey, c.caseId.replace(' · intake · ', ' · '), {
              owner,
              resolves: c.caseId,
            })
          }
        />
      )}
    </div>
  );
}

/** The tree — domain → system → leaf — mirroring the full seat's drill.
 *  Picking a leaf hands its catalog key to onPick. */
function IdentifyTree({ catalog, onPick }: { catalog: Catalog; onPick: (key: string) => void }) {
  const [domain, setDomain] = useState<string | null>(null);
  const [system, setSystem] = useState<string | null>(null);
  const tree = rowsByDomain(catalog);
  const dom = tree.find((g) => g.domain === domain);
  // The escalation "system" is the tide's output, never an identification
  // target; the raw triage row itself would be circular.
  const systems = (dom?.systems ?? []).filter((s) => s.system !== 'escalation');
  const directLeaves = (dom?.unassigned ?? []).filter((r) => r.key !== 'work-order');
  const sys = systems.find((s) => s.system === system);
  return (
    <div className="wt-tree">
      <div className="wt-tlevel">
        <span className="wt-tl">Domain</span>
        {tree.map((g) => (
          <button
            key={g.domain}
            type="button"
            className={`wt-tchip${domain === g.domain ? ' on' : ''}`}
            onClick={() => {
              setDomain(g.domain);
              setSystem(null);
            }}
          >
            {g.domain}
          </button>
        ))}
      </div>
      {dom && (systems.length > 0 || directLeaves.length > 0) && (
        <div className="wt-tlevel">
          <span className="wt-tl">System</span>
          {systems.map((s) => (
            <button
              key={s.system}
              type="button"
              className={`wt-tchip${system === s.system ? ' on' : ''}`}
              onClick={() => setSystem(s.system)}
            >
              {s.system}
            </button>
          ))}
          {directLeaves.map((r) => (
            <button key={r.key} type="button" className="wt-tchip leaf" onClick={() => onPick(r.key)}>
              {r.mode ? `${MODE_MARK[r.mode]} ` : ''}
              {r.title}
            </button>
          ))}
        </div>
      )}
      {sys && (
        <div className="wt-tlevel">
          <span className="wt-tl">Leaf</span>
          {sys.rows.map((r) => (
            <button key={r.key} type="button" className="wt-tchip leaf" onClick={() => onPick(r.key)}>
              {r.mode ? `${MODE_MARK[r.mode]} ` : ''}
              {r.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** One unowned queue with the hand acts beside it — the delegate move. */
function QueueHand({
  load,
  targets,
  catalog,
  now,
  note,
  onHandAll,
  onHandCase,
}: {
  load: SeatLoad;
  targets: Person[];
  catalog: Catalog;
  now: string;
  note?: string;
  onHandAll: (toHolder: string) => void;
  onHandCase: (caseId: string, toHolder: string) => void;
}) {
  const [target, setTarget] = useState('');
  const [open, setOpen] = useState(false);
  const cases = load.cases.slice().sort((a, b) => (a.lastAt ?? '').localeCompare(b.lastAt ?? ''));
  return (
    <div className="wt-queue">
      <div className="wt-queue-head">
        <button
          className="wt-disclose"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          title={load.holder}
        >
          {open ? '▾' : '▸'} <b>{seatLabel(load.name)}</b>
          <span className="wt-rowm">
            {' '}
            · {load.cases.length} box{load.cases.length === 1 ? '' : 'es'}
            {note ? ` · ${note}` : ''} · oldest {load.oldestDays}d
            {load.stuck > 0 && <span className="wt-old"> · {load.stuck} stuck</span>}
          </span>
        </button>
        <span className="wt-actline">
          <select
            className="wt-select"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            aria-label={`Hand ${load.name} to`}
          >
            <option value="">Hand to…</option>
            {targets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            className="wt-go"
            disabled={!target}
            title="Hand every case in this queue to the chosen seat"
            onClick={() => target && onHandAll(target)}
          >
            Hand all {load.cases.length}
          </button>
        </span>
      </div>
      {open && (
        <div className="wt-queue-drill">
          {cases.slice(0, 6).map((cse) => {
            const age = ageInDays(cse, now);
            return (
              <div className="wt-row" key={cse.caseId}>
                <span className="wt-rowt">
                  <CaseName caseId={cse.caseId} catalog={catalog} card kind={cse.catalogRow} />
                  {age != null && (
                    <span className={`wt-rowm${age >= 7 ? ' wt-old' : ''}`}> · {age === 0 ? 'today' : `${age}d`}</span>
                  )}
                </span>
                <button
                  className="wt-go"
                  disabled={!target}
                  title={target ? 'Hand this case to the chosen seat' : 'Choose a seat first'}
                  onClick={() => target && onHandCase(cse.caseId, target)}
                >
                  → hand
                </button>
              </div>
            );
          })}
          {cases.length > 6 && (
            <p className="wt-fine">…and {cases.length - 6} more — "Hand all" takes the whole queue.</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Recruiting: dub a subject from the census, or name a new blade outright —
 *  both through regent.commissionKnight. */
function RecruitPanel({
  kingdom,
  pods,
  gameOn,
  act,
}: {
  kingdom: Kingdom;
  pods: PodReading[];
  gameOn: boolean;
  act: RegentActions;
}) {
  const nav = useNav();
  const [name, setName] = useState('');
  const knighted = new Set(pods.map((p) => p.knightId));
  const candidates = kingdom.people.filter(
    (p) => (p.pledge === 'vassal' || p.pledge === 'squire') && !knighted.has(p.id),
  );
  const commissionTyped = () => {
    // The commission note carries the name; keep it clean of the marks the
    // fold reads around (— and .), so the pod wears it faithfully.
    const clean = name.replace(/[—·.]/g, ' ').replace(/\s+/g, ' ').trim();
    const kid = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!kid) return;
    act.commissionKnight(kid, clean);
    setName('');
  };
  if (!gameOn)
    return (
      <div className="wt-card">
        <h3>No muster stands</h3>
        <p className="wt-fine">
          Knights hold pods of the muster's owners — deploy a War Game first, and the commission
          has land to stand on.
        </p>
      </div>
    );
  return (
    <>
      <div className="wt-card">
        <h3>Dub a subject</h3>
        <Explain className="wt-fine">
          A vassal or squire of the census takes the accolade and a pod opens in their name —
          a recorded commission, struck when the game resets.
        </Explain>
        {candidates.length === 0 ? (
          <p className="wt-fine">Every eligible subject already holds a pod.</p>
        ) : (
          candidates.map((p) => (
            <div className="wt-row" key={p.id}>
              <span className="wt-rowt">
                <InlineLink onClick={() => nav.goToPerson(p.id)}>
                  <b>{p.name}</b>
                </InlineLink>
                <span className="wt-rowm"> · {p.pledge}{p.note ? ` — ${p.note}` : ''}</span>
              </span>
              <button className="wt-go" onClick={() => act.commissionKnight(p.id, p.name)}>
                ⚔ dub a knight
              </button>
            </div>
          ))
        )}
      </div>
      <div className="wt-card">
        <h3>Or name a new blade</h3>
        <Explain className="wt-fine">
          A knight recruited from beyond the census — the Master Plan's equity partner, holding up
          to 500 doors.
        </Explain>
        <form
          className="wt-actline"
          onSubmit={(e) => {
            e.preventDefault();
            commissionTyped();
          }}
        >
          <input
            className="wt-textin"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ser Goran of the Reach"
            aria-label="The new knight's name"
          />
          <button type="submit" className="wt-go" disabled={!name.trim()}>
            Commission
          </button>
        </form>
      </div>
      {pods.length > 0 && (
        <p className="wt-fine">
          {pods.length} pod{pods.length === 1 ? '' : 's'} stand{pods.length === 1 ? 's' : ''} —{' '}
          {pods.map((p) => p.knightName).join(', ')}.
        </p>
      )}
    </>
  );
}

/** Placing: every unplaced owner, a chosen pod, one act each —
 *  regent.placeOwner. */
function PlacePanel({
  unplaced,
  pods,
  act,
  onRecruit,
}: {
  unplaced: PatronReading[];
  pods: PodReading[];
  act: RegentActions;
  onRecruit: () => void;
}) {
  const [target, setTarget] = useState('');
  if (pods.length === 0)
    return (
      <div className="wt-card">
        <h3>No knight stands to take them</h3>
        <p className="wt-fine">
          {unplaced.length} owner{unplaced.length === 1 ? '' : 's'} wait in no one's care, and no
          pod is open. Recruit a knight first.
        </p>
        <div className="wt-sact">
          <button onClick={onRecruit}>Recruit a knight →</button>
        </div>
      </div>
    );
  return (
    <>
      <div className="wt-card">
        <h3>Into whose care</h3>
        <Explain className="wt-fine">
          Choose the pod, then place each estate — most-at-risk first. Each placement is one
          recorded act; an owner can be re-placed later.
        </Explain>
        <select
          className="wt-select wt-select-wide"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          aria-label="Place owners into which pod"
        >
          <option value="">The pod to place into…</option>
          {pods.map((p) => (
            <option key={p.knightId} value={p.knightId}>
              {p.knightName} — {p.filled} of {p.capacity} doors · faith {p.faith}
            </option>
          ))}
        </select>
      </div>
      <div className="wt-card">
        <h3>The owners adrift</h3>
        {unplaced.length === 0 ? (
          <p className="wt-fine">Every owner rests in a knight's care. The allocation is clear.</p>
        ) : (
          unplaced.slice(0, 12).map((o) => (
            <div className="wt-row" key={o.name}>
              <span className="wt-rowt">
                <span
                  className="wt-coin wt-coin-dark wt-num"
                  style={vars({ '--f': String(o.faith), '--fc': faithColor(o) })}
                >
                  {o.faith}
                </span>{' '}
                <b>{o.name}</b>
                <span className="wt-rowm">
                  {' '}
                  · {o.doors.length} door{o.doors.length === 1 ? '' : 's'}
                  {o.crises > 0 && ` · ${o.crises} in crisis`}
                </span>
              </span>
              <button
                className="wt-go"
                disabled={!target}
                title={target ? 'Place this owner in the chosen pod' : 'Choose a pod first'}
                onClick={() => target && act.placeOwner(o.name, target)}
              >
                → place
              </button>
            </div>
          ))
        )}
        {unplaced.length > 12 && (
          <p className="wt-fine">…and {unplaced.length - 12} more wait below the fold.</p>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// The reference panels — the old shell's surfaces, folded onto the board
// ═══════════════════════════════════════════════════════════════════════════

/** The Counting-house: the economy's two-book money-dimension folded onto the
 *  board (docs/WRIT-ECONOMY.md). The four readings — solvency (the three-way
 *  trust reconciliation, live), the corporate P&L, an owner statement, and the
 *  bridge self-check — plus the acts that feed them (record a money event, deal
 *  a working-fluid sample month, strike a mis-record). Records in, readings out;
 *  the postings fold, nothing is stored. */
const MONEY_KINDS: { kind: MoneyKind; label: string }[] = [
  { kind: 'rent_charged', label: 'Rent charged' },
  { kind: 'rent_received', label: 'Rent received' },
  { kind: 'deposit_received', label: 'Deposit received' },
  { kind: 'deposit_refunded', label: 'Deposit refunded' },
  { kind: 'vendor_bill', label: 'Vendor bill' },
  { kind: 'vendor_paid', label: 'Vendor paid' },
  { kind: 'owner_contribution', label: 'Owner contribution' },
  { kind: 'owner_draw', label: 'Owner draw' },
  { kind: 'reserve_funded', label: 'Reserve funded' },
  { kind: 'management_fee', label: 'Management fee (bridge)' },
  { kind: 'leasing_fee', label: 'Leasing fee (bridge)' },
  // The one MoneyKind absent from this list: a real kind with a real bridge
  // posting, named by the compliance reading's own fee set, and unreachable
  // from the only form that records money by hand. The reverse of a dead
  // button, and the same drift. (Audit, 2026-07-27.)
  { kind: 'renewal_fee', label: 'Renewal fee (bridge)' },
  { kind: 'markup', label: 'Maintenance markup (bridge)' },
  { kind: 'late_fee', label: 'Late fee' },
  { kind: 'pet_rent', label: 'Pet rent' },
  { kind: 'utility_reimbursement', label: 'Utility reimbursement (RUBS)' },
  { kind: 'moveout_reserve_withheld', label: 'Move-out reserve withheld' },
  { kind: 'nsf_fee', label: 'NSF fee (company)' },
  { kind: 'admin_fee', label: 'Admin fee (company)' },
  { kind: 'reletting_fee', label: 'Reletting fee (company)' },
  { kind: 'ancillary_fee', label: 'Ancillary (company)' },
  // ── The named streams a field reconciliation against a live trust-accounting system surfaced (slice 1) ──
  { kind: 'rbp_fee', label: 'Resident benefit / RBP (company)' },
  { kind: 'pet_damage_fee', label: 'Pet damage guarantee (company)' },
  { kind: 'risk_enforcement_fee', label: 'Risk / enforcement (company)' },
  { kind: 'project_coordination_fee', label: 'Project coordination (company)' },
  { kind: 'annual_admin_fee', label: 'Annual admin (company)' },
  { kind: 'referral_fee', label: 'Referral (company)' },
  { kind: 'warranty_fee', label: 'Warranty coordination (company)' },
  { kind: 'application_fee', label: 'Application fee (company)' },
  { kind: 'ac_seasonal_fee', label: 'Seasonal AC rental (company)' },
  { kind: 'vendor_discount', label: 'Vendor discount kept (company)' },
  { kind: 'owner_concession', label: 'Owner rent concession (trust)' },
  { kind: 'tenant_chargeback', label: 'Tenant move-out chargeback (trust)' },
  { kind: 'mtm_premium', label: 'Month-to-month premium — owner share' },
  { kind: 'mtm_fee', label: 'Month-to-month premium — firm fee (bridge)' },
  { kind: 'late_fee_share', label: 'Late fee — firm share of collected fee (bridge)' },
  { kind: 'fee_sweep', label: 'Fee sweep (bridge)' },
  { kind: 'commission_sweep', label: 'Commission sweep → By-Pass' },
  { kind: 'irs_withholding', label: 'IRS backup withholding' },
  { kind: 'corp_expense', label: 'Company expense' },
  { kind: 'corp_income_other', label: 'Company income (other)' },
];

/** The physical banks, in plain words, for the reconciliation card (slice-2b). */
const BANK_LABEL: Record<string, string> = {
  operating: 'Operating Checking',
  'by-pass': 'By-Pass Checking · commissions',
  'trust-rent': 'Trust — Rent Collections',
  'trust-deposit': 'Trust — Security Deposits',
  'trust-reserve': 'Trust — Owner Reserve',
};

/** A spend cap in plain words — a dollar figure, or "none" when no cap stands. */
function capText(cents: number | undefined): string {
  return cents == null ? 'none' : coinCents(cents);
}

/** Describe one fee rule in plain words for the setting preview — a flat dollar,
 *  or a rate against its basis, plus the firm split when the rule carries one. */
function describeFeeRule(
  rule: { basis?: string; rateBps?: number; flatCents?: number; splitBps?: number } | undefined,
): string {
  if (!rule) return 'unset';
  const amount =
    rule.flatCents != null
      ? coinCents(rule.flatCents)
      : rule.rateBps != null
        ? `${(rule.rateBps / 100).toFixed(rule.rateBps % 100 === 0 ? 0 : 2)}%${
            rule.basis && rule.basis !== 'flat' ? ` of ${rule.basis.replace(/_/g, ' ')}` : ''
          }`
        : '—';
  const split = rule.splitBps != null ? `, firm keeps ${(rule.splitBps / 100).toFixed(0)}%` : '';
  return `${amount}${split}`;
}

/** The before→after lines a pasted patch would produce — walking ONLY the fields
 *  the patch declares, each compared against the setting standing now (`current`)
 *  versus the setting once loaded (`next`). Empty ⇒ the patch changes nothing. */
function settingPreviewLines(current: EconomyBook, next: EconomyBook, patch: EconomySettingPatch): string[] {
  const lines: string[] = [];
  for (const r of patch.feeRules ?? []) {
    const where = r.estateId ? ` @${r.estateId}` : '';
    lines.push(
      `Fee ${r.kind}${where}: ${describeFeeRule(feeRuleFor(current, r.kind, r.estateId))} → ${describeFeeRule(
        feeRuleFor(next, r.kind, r.estateId),
      )}`,
    );
  }
  if (patch.spendApprovalCents != null) {
    lines.push(`House spend cap: ${capText(current.spendApprovalCents)} → ${capText(next.spendApprovalCents)}`);
  }
  for (const c of patch.estateSpendCaps ?? []) {
    lines.push(`Spend cap @${c.estateId}: ${capText(spendCapFor(current, c.estateId))} → ${capText(spendCapFor(next, c.estateId))}`);
  }
  for (const a of patch.accounts ?? []) {
    const cur = current.accounts.find((x) => x.role === a.role);
    const nxt = next.accounts.find((x) => x.role === a.role);
    if (cur && nxt && (cur.code !== nxt.code || cur.name !== nxt.name)) {
      lines.push(`GL ${a.role}: ${cur.code} ${cur.name} → ${nxt.code} ${nxt.name}`);
    }
  }
  for (const b of patch.budget ?? []) {
    const where = b.estateId ? ` @${b.estateId}` : '';
    const cur = (current.budget ?? []).find((x) => x.accountRole === b.accountRole && x.estateId === b.estateId);
    lines.push(`Budget ${b.accountRole}${where}: ${cur ? coinCents(cur.monthlyCents) : 'none'} → ${coinCents(b.monthlyCents)}/mo`);
  }
  return lines;
}

/** The gate's door on the board: load a firm's real economy setting (fee rates,
 *  spend caps, GL codes) as an attended overlay, preview what moves, or strike it
 *  back to founding. LandLord holds only the machine — the figures are the
 *  operator's to paste, never written into the code (docs/economySetting.ts). */
function EconomySettingCard({ economy }: { economy: EconomyActions }) {
  const [text, setText] = useState('');
  const current = summarizeSetting(economy.setting);
  const parsed = text.trim() ? parseEconomySetting(text) : null;
  const preview =
    parsed && parsed.ok
      ? settingPreviewLines(economy.book, applyEconomySetting(economy.baseBook, parsed.patch), parsed.patch)
      : null;

  const apply = () => {
    if (!parsed || !parsed.ok) return;
    const summary = summarizeSetting(parsed.patch) ?? 'no overrides';
    const ok = window.confirm(
      `Load this economy setting? It overrides ${summary} and takes effect across the whole reckoning at once. ` +
        (economy.setting ? 'The setting standing now is replaced.' : 'The founding chart is overlaid.'),
    );
    if (!ok) return;
    economy.loadSetting(parsed.patch);
    setText('');
  };

  const revert = () => {
    if (!window.confirm('Strike the loaded setting? The economy returns to its founding chart, exactly as founded.')) return;
    economy.clearSetting();
    setText('');
  };

  return (
    <div className="wt-card">
      <h3>
        The economy setting <span className="wt-rowm">the gate</span>
      </h3>
      <Explain>
        The machine is the kingdom's; the true figures are a firm's, loaded here attended — never written into
        the code. Paste a setting (fee rates, spend caps, GL codes) to overlay the founding chart, see what
        moves, then load it. It takes effect everywhere the economy is read. Revert returns to founding.
      </Explain>
      <p className="wt-rowm">
        {current ? (
          <>
            A setting stands — <b>{current}</b>.
          </>
        ) : (
          <>Founding reckoning — no setting loaded.</>
        )}
      </p>
      <textarea
        className="wt-textin"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Paste an economy setting, e.g.\n{ "feeRules": [{ "kind": "management", "rateBps": 500 }] }'}
        rows={5}
        aria-label="Economy setting to load"
      />
      {parsed && !parsed.ok && <p className="wt-rowm wt-flag">⚠ {parsed.error}</p>}
      {preview &&
        (preview.length ? (
          preview.map((line, i) => (
            <div className="wt-row" key={i}>
              <span className="wt-rowt">{line}</span>
            </div>
          ))
        ) : (
          <p className="wt-rowm">Well-formed — but it changes nothing from what stands.</p>
        ))}
      <div className="wt-actline">
        <button className="wt-tbtn primary" onClick={apply} disabled={!parsed || !parsed.ok}>
          Load the setting
        </button>
        {economy.setting && (
          <button className="wt-tbtn" onClick={revert}>
            Revert to founding
          </button>
        )}
      </div>
    </div>
  );
}

/** How many roster rows the card lists before folding the rest into a count —
 *  the real load is ~125 properties; the card must not become the panel. */
const ROSTER_SHOWN = 6;

/** The estate roster's door on the board: load the real property list — the
 *  stable `{id, label}` rows every per-estate cap, fee rule, and case keys on —
 *  as an attended paste, exactly like the economy setting beside it. Labels are
 *  display-only; the CAPS already bind wherever a case names an estate id. The
 *  roster shows each estate beside the NTE cap in force for it, so the Regent
 *  reads at a glance which doors carry their own authority. */
function EstateRosterCard({ estates, economy }: { estates: EstateActions; economy: EconomyActions }) {
  const [text, setText] = useState('');
  const roster = estates.roster;
  const book = economy.book;
  const parsed = text.trim() ? parseEstateBook(text) : null;

  // What a well-formed paste would change, vs the roster standing now.
  const preview = (() => {
    if (!parsed || !parsed.ok) return null;
    const cur = new Map(roster.map((e) => [e.id, e.label]));
    const next = new Map(parsed.roster.map((e) => [e.id, e.label]));
    const added = parsed.roster.filter((e) => !cur.has(e.id));
    const renamed = parsed.roster.filter((e) => cur.has(e.id) && cur.get(e.id) !== e.label);
    const dropped = roster.filter((e) => !next.has(e.id));
    const lines: string[] = [];
    if (added.length) lines.push(`${added.length} estate${added.length === 1 ? '' : 's'} enter the roster`);
    if (renamed.length) lines.push(`${renamed.length} relabeled`);
    if (dropped.length) lines.push(`${dropped.length} leave it (their records stand; readings fall back to the raw id)`);
    return { count: parsed.roster.length, lines };
  })();

  const apply = () => {
    if (!parsed || !parsed.ok) return;
    const ok = window.confirm(
      `Load this roster of ${parsed.roster.length} estate${parsed.roster.length === 1 ? '' : 's'}? ` +
        (roster.length
          ? `It replaces the ${roster.length} standing now, wholesale.`
          : 'The founding roster is empty; this is the first load.'),
    );
    if (!ok) return;
    estates.load(parsed.roster);
    setText('');
  };

  const revert = () => {
    if (!window.confirm('Strike the loaded roster? The book returns to its founding — empty. Cases and caps that name an estate id keep it; readings fall back to the raw id.')) return;
    estates.load([]);
    setText('');
  };

  return (
    <div className="wt-card">
      <h3>
        The estate roster <span className="wt-rowm">the land, named</span>
      </h3>
      <Explain>
        The stable estate ids are what per-estate spend caps, fee rules, and a case's real-property
        dimension key on — the caps bind with or without this book. The roster adds the human labels:
        paste the real property list ({'[{"id", "label"}, …]'}) attended, never into the code, exactly
        as the economy setting loads beside it.
      </Explain>
      <p className="wt-rowm">
        {roster.length ? (
          <>
            <b>{roster.length}</b> estate{roster.length === 1 ? '' : 's'} on the roster.
          </>
        ) : (
          <>Founding roster — empty. The muster's synthetic doors key on their own inline addresses.</>
        )}
      </p>
      {roster.slice(0, ROSTER_SHOWN).map((e) => {
        const cap = spendCapFor(book, e.id);
        const own = book.estateSpendCaps?.some((c) => c.estateId === e.id);
        return (
          <div className="wt-row" key={e.id}>
            <span className="wt-rowt">
              {e.label} <span className="wt-rowm">· {e.id}</span>
            </span>
            <span className="wt-rowm">{own ? `own NTE ${capText(cap)}` : `house NTE ${capText(cap)}`}</span>
          </div>
        );
      })}
      {roster.length > ROSTER_SHOWN && (
        <p className="wt-rowm">…and {roster.length - ROSTER_SHOWN} more.</p>
      )}
      <textarea
        className="wt-textin"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Paste the estate roster, e.g.\n[{ "id": "harrow-c", "label": "12 Harrow Court" }]'}
        rows={4}
        aria-label="Estate roster to load"
      />
      {parsed && !parsed.ok && <p className="wt-rowm wt-flag">⚠ {parsed.error}</p>}
      {preview && (
        <p className="wt-rowm">
          {preview.count} row{preview.count === 1 ? '' : 's'} —{' '}
          {preview.lines.length ? preview.lines.join('; ') : 'no change from what stands'}.
        </p>
      )}
      <div className="wt-actline">
        <button className="wt-tbtn primary" onClick={apply} disabled={!parsed || !parsed.ok}>
          Load the roster
        </button>
        {roster.length > 0 && (
          <button className="wt-tbtn" onClick={revert}>
            Revert to founding
          </button>
        )}
      </div>
    </div>
  );
}

function CountingHousePanel({
  economy,
  estates,
  seed,
  now,
  coffers,
}: {
  economy: EconomyActions;
  estates: EstateActions;
  seed: string | null;
  now: string;
  /** The ONE coffers reading the ribbon, the Throne, and the fail state share
   *  (docs/WRIT-ECONOMY.md, swing five) — the live run-rate of tribute against
   *  the Crown's upkeep, driven by which Patrons still stand. */
  coffers: { tributeMonthly: number; upkeepMonthly: number; trend: number; fallen: boolean; doors: number };
}) {
  const detail = useDetail();
  const book = economy.book;
  const money = economy.money;
  const postings = readPostings(money);
  const solvency = readSolvency(book, money);
  const corp = readCorporateCoffers(book, money);
  const pnl = readPnL(book, money);
  const budget = readBudgetVsActual(book, money);
  const bridge = bridgeCheck(book, money);
  const compliance = readCompliance(book, money, now);
  const bankRecs = readBankRecs(book, money);
  const owners = ownersInLog(money);
  const spendCapCents = book.spendApprovalCents;
  const vendorBills = money
    .filter((m) => m.kind === 'vendor_bill')
    .map((m) => ({ ...m, needsApproval: needsOwnerApproval(book, m.amountCents, m.estateId) }));

  const [ownerId, setOwnerId] = useState('');
  const [kind, setKind] = useState<MoneyKind>('rent_received');
  const [amount, setAmount] = useState('');
  const [estate, setEstate] = useState('');
  const [owner, setOwner] = useState('');

  const activeOwner = ownerId || owners[0] || '';
  const statement = activeOwner ? readOwnerStatement(book, money, activeOwner) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const dollars = Number.parseFloat(amount);
    if (!Number.isFinite(dollars) || dollars <= 0) return;
    economy.record({
      kind,
      amountCents: Math.round(dollars * 100),
      estateId: estate.trim() || undefined,
      ownerId: owner.trim() || undefined,
    });
    setAmount('');
  };

  // The accounts that carry a balance, grouped by book — the trial balance.
  const bookLines = (which: 'trust' | 'corporate') =>
    book.accounts
      .filter((a) => a.book === which)
      .map((a) => ({ a, bal: balanceOf(book, postings, a.role) }))
      .filter((x) => x.bal !== 0);

  return (
    <>
      <div className="wt-stats">
        <Stat
          n={`${coin(coffers.trend)}/mo`}
          label={coffers.fallen ? 'Coffers — falling' : 'Coffers /mo'}
          tone={coffers.fallen ? 'bad' : 'good'}
        />
        <Stat n={coinCents(solvency.trustCash)} label="Trust cash" />
        <Stat
          n={solvency.clean ? 'balanced' : coinCents(solvency.variance)}
          label="Trust reconciliation"
          tone={solvency.clean ? 'good' : 'warn'}
        />
        <Stat
          n={compliance.ok ? 'clean' : `${compliance.flags} flag${compliance.flags > 1 ? 's' : ''}`}
          label="Compliance"
          tone={compliance.ok ? 'good' : 'bad'}
        />
      </div>

      {(seed || coffers.upkeepMonthly > 0) && (
        <div className="wt-card">
          <h3>
            The coffers{' '}
            <span className={coffers.fallen ? 'wt-flag' : 'wt-ok'}>
              {coffers.fallen ? 'running red' : 'in the black'}
            </span>
          </h3>
          <Explain>
            The one coffers the whole realm reads — the ribbon gauge, the Throne, and the fail state.
            The Crown's run-rate: the management tribute its still-faithful Patrons pay, against its own
            monthly upkeep. Let neglect drive Patrons to withdraw and the tribute falls until the upkeep
            drowns it. (The company runway below is the point-in-time balance; this is the trend.)
          </Explain>
          <div className="wt-row">
            <span className="wt-rowt">
              Tribute — {coffers.doors} retained doors
            </span>
            <span className="wt-num">{coin(coffers.tributeMonthly)}/mo</span>
          </div>
          <div className="wt-row">
            <span className="wt-rowt">Upkeep — the Crown's own cost</span>
            <span className="wt-num">−{coin(coffers.upkeepMonthly)}/mo</span>
          </div>
          <div className="wt-row">
            <span className="wt-rowt">
              <b>Trend</b>
            </span>
            <span className="wt-num">
              <b className={coffers.fallen ? 'wt-flag' : 'wt-ok'}>{coin(coffers.trend)}/mo</b>
            </span>
          </div>
        </div>
      )}

      {money.length === 0 && (
        <div className="wt-card">
          <h3>No coin recorded yet</h3>
          <p className="wt-rowm">
            The money log is empty — the two books read zero. {seed
              ? 'Deal a working-fluid sample month to see the treasuries move, or record a single event below.'
              : 'Record a money event below (a sample month needs a standing War Game so Reset can strike it).'}
          </p>
          {seed && (
            <button className="wt-tbtn primary" onClick={() => economy.dealSample()}>
              Deal a sample month
            </button>
          )}
        </div>
      )}

      <div className="wt-card">
        <h3>The two treasuries</h3>
        <p className="wt-rowm">
          The bridge:{' '}
          <b>{coinCents(bridge.dueToMgmt)}</b> owed to the company still in trust ·{' '}
          {bridge.tied ? 'ties to' : '≠'} <b>{coinCents(bridge.dueFromTrust)}</b> due from trust
          {bridge.tied ? ' ✓' : ' ⚠'}
        </p>
        <div className="wt-twobooks">
          <div>
            <h4>Estates in trust</h4>
            {bookLines('trust').length === 0 ? (
              <p className="wt-rowm">—</p>
            ) : (
              bookLines('trust').map(({ a, bal }) => (
                <div className="wt-row" key={a.role}>
                  <span className="wt-rowt">
                    {a.name}
                    {detail && <span className="wt-rowm"> · {a.code}</span>}
                  </span>
                  <span className="wt-num">{coinCents(bal)}</span>
                </div>
              ))
            )}
          </div>
          <div>
            <h4>The Crown's coin</h4>
            {bookLines('corporate').length === 0 ? (
              <p className="wt-rowm">—</p>
            ) : (
              bookLines('corporate').map(({ a, bal }) => (
                <div className="wt-row" key={a.role}>
                  <span className="wt-rowt">
                    {a.name}
                    {detail && <span className="wt-rowm"> · {a.code}</span>}
                  </span>
                  <span className="wt-num">{coinCents(bal)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {money.length > 0 && (
        <div className="wt-card">
          <h3>
            Trust compliance{' '}
            <span className={compliance.ok ? 'wt-ok' : 'wt-flag'}>
              {compliance.ok ? 'all clear' : `${compliance.flags} flag${compliance.flags > 1 ? 's' : ''}`}
            </span>
          </h3>
          <Explain>
            The guardrails a trust account lives by, checked live from the postings, not once a month —
            the bank reconciles, no owner's money pays another's door, deposits stay whole, earned fees
            are swept in time.
          </Explain>
          {compliance.checks.map((c) => (
            <div className="wt-row" key={c.key}>
              <span className="wt-rowt">
                <span className={c.ok ? 'wt-ok' : 'wt-flag'} aria-hidden="true">
                  {c.ok ? '✓' : '⚠'}
                </span>{' '}
                {c.label}
                <span className="wt-rowm"> · {c.detail}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {money.length > 0 && (
        <div className="wt-card">
          <h3>
            Bank reconciliation{' '}
            <span className={bankRecs.ok ? 'wt-ok' : 'wt-flag'}>
              {bankRecs.ok ? 'clean' : `${bankRecs.lapses} lapse${bankRecs.lapses > 1 ? 's' : ''}`}
            </span>
          </h3>
          <Explain>
            Each physical bank reconciled on its own — the firm's commission kept in the segregated
            By-Pass account, never posting through operating; no trust bank overdrawn. The external
            bank statement loads at the gate.
          </Explain>
          {bankRecs.recs.map((r) => (
            <div className="wt-row" key={r.bank}>
              <span className="wt-rowt">
                <span className={r.ok ? 'wt-ok' : 'wt-flag'} aria-hidden="true">
                  {r.ok ? '✓' : '⚠'}
                </span>{' '}
                {BANK_LABEL[r.bank] ?? r.bank}
                {r.segregationLapse && <span className="wt-rowm"> · commission leaked to operating</span>}
                {r.overdrawn && !r.segregationLapse && <span className="wt-rowm"> · overdrawn</span>}
              </span>
              <span className="wt-num">{coinCents(r.bookBalanceCents)}</span>
            </div>
          ))}
        </div>
      )}

      {spendCapCents != null && (
        <div className="wt-card">
          <h3>
            Spend gate <span className="wt-rowm">· owner approval at {coinCents(spendCapCents)}+</span>
          </h3>
          <Explain>
            The recon's cap: a repair AT OR ABOVE this threshold needs owner approval before the vendor
            proceeds; below it, the clerk or vendor may complete it on-site. The vendor-dispatch flow's
            approval step reads this SAME gate — one threshold, everywhere it matters.
          </Explain>
          {vendorBills.length === 0 ? (
            <p className="wt-rowm">No vendor bills recorded yet.</p>
          ) : (
            vendorBills.map((v) => (
              <div className="wt-row" key={v.id}>
                <span className="wt-rowt">
                  <b>{coinCents(v.amountCents)}</b>
                  {(v.ownerId || v.estateId) && <span className="wt-rowm"> · {v.ownerId ?? v.estateId}</span>}
                </span>
                <span className={v.needsApproval ? 'wt-flag' : 'wt-ok'}>
                  {v.needsApproval ? '⚠ needs owner approval' : '✓ clerk may proceed'}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {pnl.lines.length > 0 && (
        <div className="wt-card">
          <h3>The Crown's ledger (P&amp;L)</h3>
          {pnl.lines.map((l) => (
            <div className="wt-row" key={l.role}>
              <span className="wt-rowt">
                {l.name}
                <span className="wt-rowm"> · {l.type}</span>
              </span>
              <span className="wt-num">{coinCents(l.amountCents)}</span>
            </div>
          ))}
          <div className="wt-row">
            <span className="wt-rowt">
              <b>Net</b>
            </span>
            <span className="wt-num">
              <b>{coinCents(pnl.net)}</b>
            </span>
          </div>
          <div className="wt-row">
            <span className="wt-rowt">
              Company runway <span className="wt-rowm">· operating cash + earned, less payables</span>
            </span>
            <span className="wt-num">{coinCents(corp.runway)}</span>
          </div>
        </div>
      )}

      {budget.lines.length > 0 && money.length > 0 && (
        <div className="wt-card">
          <h3>Budget vs actual <span className="wt-rowm">· the Crown's plan</span></h3>
          {budget.lines.map((l) => {
            // For income, actual above plan is good; for expense, below plan is good.
            const good = l.type === 'income' ? l.varianceCents >= 0 : l.varianceCents <= 0;
            const sign = l.varianceCents > 0 ? '+' : '';
            return (
              <div className="wt-row" key={l.accountRole}>
                <span className="wt-rowt">
                  {l.name}
                  <span className="wt-rowm">
                    {' '}
                    · {coinCents(l.actualCents)} of {coinCents(l.plannedCents)}
                  </span>
                </span>
                <span className="wt-num">
                  <span className={good ? 'wt-ok' : 'wt-flag'}>
                    {sign}
                    {coinCents(l.varianceCents)}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {statement && (
        <div className="wt-card">
          <h3>Owner statement</h3>
          {owners.length > 1 && (
            <select
              className="wt-select"
              value={activeOwner}
              onChange={(e) => setOwnerId(e.target.value)}
              aria-label="Owner"
            >
              {owners.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          )}
          <div className="wt-row">
            <span className="wt-rowt">{activeOwner} — held in trust</span>
            <span className="wt-num">{coinCents(statement.endingCents)}</span>
          </div>
          <p className="wt-rowm">
            income {coinCents(statement.incomeCents)} − expense {coinCents(statement.expenseCents)}{' '}
            (management fee {coinCents(statement.mgmtFeeCents)}) − draw {coinCents(statement.drawCents)}
          </p>
        </div>
      )}

      <div className="wt-card">
        <h3>Record a money event</h3>
        <form className="wt-actline" onSubmit={submit}>
          <select
            className="wt-select"
            value={kind}
            onChange={(e) => setKind(e.target.value as MoneyKind)}
            aria-label="What happened"
          >
            {MONEY_KINDS.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </select>
          <input
            className="wt-textin"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="$ amount"
            inputMode="decimal"
            aria-label="Amount in dollars"
          />
          <input
            className="wt-textin"
            value={estate}
            onChange={(e) => setEstate(e.target.value)}
            placeholder="Estate (optional)"
            aria-label="Estate"
          />
          <input
            className="wt-textin"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="Owner (optional)"
            aria-label="Owner"
          />
          <button type="submit" className="wt-tbtn" disabled={!amount.trim()}>
            Record
          </button>
        </form>
        {kind === 'vendor_bill' && spendCapCents != null && Number.parseFloat(amount) > 0 && (
          <p className="wt-rowm">
            {needsOwnerApproval(book, Math.round(Number.parseFloat(amount) * 100), estate.trim() || undefined) ? (
              <span className="wt-flag">⚠ needs owner approval</span>
            ) : (
              <span className="wt-ok">✓ under the cap — the clerk may proceed</span>
            )}
          </p>
        )}
        {seed && money.length > 0 && (
          <button className="wt-go" onClick={() => economy.dealSample()}>
            + another sample month
          </button>
        )}
      </div>

      {money.length > 0 && (
        <div className="wt-card">
          <h3>The money log <span className="wt-rowm">({money.length})</span></h3>
          {[...money]
            .slice(-14)
            .reverse()
            .map((m) => (
              <div className="wt-row" key={m.id}>
                <span className="wt-rowt">
                  <b>{coinCents(m.amountCents)}</b>{' '}
                  {MONEY_KINDS.find((k) => k.kind === m.kind)?.label ?? m.kind}
                  {(m.ownerId || m.estateId) && (
                    <span className="wt-rowm"> · {m.ownerId ?? m.estateId}</span>
                  )}
                </span>
                <button className="wt-go" onClick={() => economy.strike(m.id)}>
                  strike
                </button>
              </div>
            ))}
        </div>
      )}

      <EconomySettingCard economy={economy} />

      <EstateRosterCard estates={estates} economy={economy} />
    </>
  );
}

/** The Marches as a panel: the border book — log an arrival, read the scribe,
 *  ride it out to a territory or turn it away, and the settled record. The
 *  full Marches view's acts (marches.arrive / rideOut / turnAway / recall),
 *  folded onto the board. */
function MarchesPanel({
  kingdom,
  marches,
  census,
}: {
  kingdom: Kingdom;
  marches: MarchesActions;
  census: CensusActions;
}) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');

  const border = atTheBorder(marches.ledger);
  const settled = readMarches(marches.ledger)
    .filter((r) => r.state !== 'at-the-border')
    .reverse();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    marches.arrive(title, note);
    setTitle('');
    setNote('');
  };

  return (
    <>
      <div className="wt-stats">
        <Stat n={border.length} label="At the border" tone={border.length > 0 ? 'warn' : 'good'} />
        <Stat n={settled.length} label="Settled" />
      </div>

      <div className="wt-card">
        <h3>Log an arrival</h3>
        <form className="wt-actline" onSubmit={submit}>
          <input
            className="wt-textin"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What arrived at the border?"
            aria-label="Arrival title"
          />
          <input
            className="wt-textin"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            aria-label="Arrival note"
          />
          <button type="submit" className="wt-go" disabled={!title.trim()}>
            Log arrival
          </button>
        </form>
      </div>

      <div className="wt-card">
        <h3>At the border{border.length > 0 ? ` · ${border.length}` : ''}</h3>
        {border.length === 0 ? (
          <p className="wt-fine">The border is quiet.</p>
        ) : (
          border.map((r) => (
            <MarchesBorderRow
              key={r.arrival.id}
              title={r.arrival.title}
              note={r.arrival.note}
              arrivedOn={r.arrival.arrivedOn}
              kingdom={kingdom}
              census={census}
              onRideOut={(territoryId) => marches.rideOut(r.arrival.id, territoryId)}
              onTurnAway={() => marches.turnAway(r.arrival.id)}
            />
          ))
        )}
      </div>

      {settled.length > 0 && (
        <div className="wt-card">
          <h3>The record book</h3>
          {settled.map((r) => (
            <div className="wt-row" key={r.arrival.id}>
              {r.state === 'dispatched' && r.dispatch ? (
                <span className="wt-rowt">
                  <b>{r.arrival.title}</b>
                  <span className="wt-rowm">
                    {' '}
                    — ridden out to {territoryLabel(kingdom.territories, r.dispatch.territoryId)},{' '}
                    {r.dispatch.dispatchedOn}
                  </span>
                </span>
              ) : (
                <span className="wt-rowt">
                  <b>{r.arrival.title}</b>
                  <span className="wt-rowm"> — turned away at the border, {r.turnaway?.turnedAwayOn}</span>
                </span>
              )}
              <button className="wt-go" onClick={() => marches.recall(r.arrival.id)}>
                recall
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Likewise: nav.goToMarches() sets the panel this button lives in. */}
    </>
  );
}

/** One border arrival with the scribe's reading and the acts — mirrors the
 *  full Marches view's BorderItem, on the board's aesthetic. */
function MarchesBorderRow({
  title,
  note,
  arrivedOn,
  kingdom,
  census,
  onRideOut,
  onTurnAway,
}: {
  title: string;
  note?: string;
  arrivedOn: string;
  kingdom: Kingdom;
  census: CensusActions;
  onRideOut: (territoryId: string) => void;
  onTurnAway: () => void;
}) {
  const reading = readArrivalText(kingdom, title, note);
  const [target, setTarget] = useState(reading.suggestedTerritoryId ?? '');
  return (
    <div className="wt-intake">
      <div className="wt-rowt">
        <b>{title}</b>
        {note && <span className="wt-rowm"> — {note}</span>}
        <span className="wt-rowm"> · arrived {arrivedOn}</span>
        {reading.lines.length > 0 && (
          <div className="wt-fine" style={{ marginTop: 4 }}>
            The scribe reads: {reading.lines.join(' ')}
          </div>
        )}
      </div>
      {reading.newNames.length > 0 && (
        <div className="wt-actline">
          {reading.newNames.map((nm) => (
            <button
              key={nm}
              className="wt-go"
              onClick={() =>
                census.enroll({
                  name: nm,
                  pledge: 'sellsword',
                  note:
                    reading.known.length > 0
                      ? `Contact of ${reading.known[0].person.name}'s — arrived via the Marches.`
                      : 'Arrived via the Marches.',
                })
              }
            >
              Enroll {nm} (artisan)
            </button>
          ))}
        </div>
      )}
      <div className="wt-actline">
        <select
          className="wt-select"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          aria-label={`Destination for ${title}`}
        >
          <option value="">Choose a territory…</option>
          {kingdom.territories.map((t) => (
            <option key={t.id} value={t.id}>
              {territoryLabel(kingdom.territories, t.id)}
            </option>
          ))}
        </select>
        <button className="wt-go" disabled={!target} onClick={() => target && onRideOut(target)}>
          Ride out
        </button>
        <button className="wt-go" onClick={onTurnAway}>
          Turn away
        </button>
      </div>
    </div>
  );
}

/** The Throne as a panel: the King's fused reading — the seats of the realm
 *  (who holds each fief) and the work in motion (who holds each ball), the two
 *  halves of the delegation debt on one sheet. `readThrone` is already folded
 *  by the parent; the panel only renders it and routes to the act (law 6). */
function ThronePanel({
  throne,
  coffers,
  patrons,
  wavering,
  withdrawn,
  crises,
  seed,
  onSeat,
}: {
  throne: ThroneReading;
  coffers: { trend: number; fallen: boolean };
  patrons: number;
  wavering: number;
  withdrawn: number;
  crises: number;
  seed: string | null;
  onSeat: () => void;
}) {
  const nav = useNav();
  const cleared = throne.debt === 0;
  return (
    <>
      <div className="wt-stats">
        <Stat n={throne.debt} label="Delegation debt" tone={cleared ? 'good' : 'bad'} />
        <Stat
          n={`${throne.fiefsLorded}/${throne.fiefsTotal}`}
          label="Fiefs lorded"
          tone={throne.fiefsLorded === throne.fiefsTotal ? 'good' : 'warn'}
        />
        <Stat n={throne.unseatedWork} label="On no desk" tone={throne.unseatedWork > 0 ? 'bad' : 'good'} />
        <Stat n={throne.stuckWork} label="Stuck > 7d" tone={throne.stuckWork > 0 ? 'warn' : undefined} />
      </div>

      {seed && (
        <div className="wt-stats">
          <Stat n={coin(coffers.trend)} label="Coffers /mo" tone={coffers.fallen ? 'bad' : 'good'} />
          <Stat n={patrons} label="Patrons" />
          <Stat n={wavering} label="Faith wavering" tone={wavering > 0 ? 'warn' : 'good'} />
          <Stat n={withdrawn} label="Withdrawn" tone={withdrawn > 0 ? 'bad' : 'good'} />
        </div>
      )}

      <div className="wt-card">
        <h3>The seats of the realm{throne.unlorded.length > 0 ? ` · ${throne.unlorded.length} unlorded` : ''}</h3>
        <Explain className="wt-fine">
          Who holds each fief. An unlorded fief is delegation debt — the seat needs a lord, or at
          least a keeper. Enter to administer it.
        </Explain>
        {[...throne.unlorded, ...throne.regency, ...throne.lorded].map((r: FiefReading) => (
          <div className="wt-row" key={r.territory.id}>
            <span className="wt-rowt">
              <span className="wt-fdot" style={vars({ '--fc': FIEF_RING[r.state] })} />{' '}
              <InlineLink onClick={() => nav.goToTerritory(r.territory.id)}>
                <b>{r.territory.name}</b>
              </InlineLink>
              <span className="wt-rowm">
                {' '}
                · {FIEF_STATE_LABEL[r.state]} ·{' '}
                {r.holder ? (
                  <InlineLink onClick={() => nav.goToPerson(r.holder!.id)}>{r.holder.name}</InlineLink>
                ) : (
                  'the seat is empty'
                )}
              </span>
            </span>
            <button className="wt-go" onClick={() => nav.goToTerritory(r.territory.id)}>
              → administer
            </button>
          </div>
        ))}
      </div>

      <div className="wt-card">
        <h3>The work in motion{throne.unseated.length > 0 ? ` · ${throne.unseated.length} undelegated` : ''}</h3>
        <Explain className="wt-fine">
          Open work by who holds the ball. Work on no real seat is undelegated — the operator's
          unlorded fief. Enter the seat to hand it off.
        </Explain>
        {throne.openWork === 0 ? (
          <p className="wt-fine">No open work stands.{seed ? '' : ' Deploy a muster to fill the queues.'}</p>
        ) : (
          <>
            {throne.unseated.map((l) => (
              <ThroneSeatRow key={l.holder} l={l} tag="t-red" onGo={onSeat} note="no seat holds it" />
            ))}
            {throne.onRegent && (
              <ThroneSeatRow l={throne.onRegent} tag="t-amber" onGo={onSeat} note="the catch-basin" />
            )}
            {throne.seats.slice(0, 8).map((l) => (
              <ThroneSeatRow key={l.holder} l={l} tag="t-green" onGo={() => nav.goToPerson(l.holder)} />
            ))}
          </>
        )}
      </div>

      <div className="wt-card">
        <h3>The King's orders</h3>
        {/* These three named the exact fiefs, said "enter the seat and hand the
            ball", and carried no handler on any of them — the one card in the
            panel whose entire purpose is to be acted on was the one card with no
            doors, while `nav.goToTerritory`, `onSeat` and `nav.goToLedger` were
            all in scope forty lines above. An order you cannot obey where it is
            given is a wish. (Audit, 2026-07-27.) */}
        <ul className="wt-orders">
          <li>
            {throne.unlorded.length > 0 ? (
              <>
                Lord the {throne.unlorded.length} empty fief
                {throne.unlorded.length === 1 ? '' : 's'} —{' '}
                {throne.unlorded.map((r, i) => (
                  <span key={r.territory.id}>
                    {i > 0 && ', '}
                    <InlineLink onClick={() => nav.goToTerritory(r.territory.id)}>
                      {r.territory.name}
                    </InlineLink>
                  </span>
                ))}
                .
              </>
            ) : (
              'Every fief is held or kept. The org line is clear.'
            )}
          </li>
          <li>
            {throne.unseatedWork > 0 ? (
              <>
                Give the {throne.unseatedWork} unseated box
                {throne.unseatedWork === 1 ? '' : 'es'} a hand —{' '}
                <InlineLink onClick={onSeat}>enter the seat</InlineLink> and hand the ball.
              </>
            ) : (
              'Every box of work rests on a real desk. The work line is clear.'
            )}
          </li>
          {seed && crises > 0 && (
            <li>
              <InlineLink onClick={() => nav.goToLedger()}>
                Clear the {crises} case{crises === 1 ? '' : 's'} in crisis
              </InlineLink>{' '}
              before the Patrons lose faith.
            </li>
          )}
        </ul>
      </div>
    </>
  );
}

/** One seat's load in the Throne's work-in-motion list. */
function ThroneSeatRow({
  l,
  tag,
  note,
  onGo,
}: {
  l: SeatLoad;
  tag: string;
  note?: string;
  onGo: () => void;
}) {
  return (
    <div className="wt-row">
      <span className="wt-rowt" title={l.holder}>
        <InlineLink onClick={onGo}>
          <b>{seatLabel(l.name)}</b>
        </InlineLink>
        <span className="wt-rowm">
          {note ? ` · ${note}` : ''} · oldest {l.oldestDays}d{l.stuck > 0 ? ` · ${l.stuck} stuck` : ''}
        </span>
      </span>
      <span className="wt-actline">
        <span className={`wt-tag ${tag}`}>{l.cases.length}</span>
        <button className="wt-go" onClick={onGo}>
          →
        </button>
      </span>
    </div>
  );
}

/** The War Games as a panel: the proving ground's report — the muster's tally,
 *  the rising tide, the seats under load, the stream by task-type, and the
 *  relays. The time control (deploy / advance / reset) lives on the board's
 *  footer; this panel is the read-out, every reading a road to the Ledger. */
function MusterPanel({
  game,
  log,
  catalog,
  flows,
  kingdom,
  now,
  seed,
  onToHorn,
}: {
  game: NonNullable<WargameActions['state']> | null;
  log: EventLog;
  catalog: Catalog;
  flows: FlowsActions;
  kingdom: Kingdom;
  now: string;
  seed: string | null;
  onToHorn: () => void;
}) {
  const nav = useNav();
  const o = outcomes(log, now);
  const qs = queues(log);
  const byType = casesByCatalogRow(log);
  const live = readFlows(flows.flows, log, now);
  const relays = live.filter((r: FlowReading) => r.caseId.includes('move-out'));
  const relaysDone = relays.filter((r) => r.status === 'done').length;
  const worst = seed
    ? severities(log, now, seed)
        .filter((c) => c.severity.band !== 'fresh')
        .slice(0, 6)
    : [];
  const nameOf = (holder: string) =>
    kingdom.people.find((p) => p.id === holder)?.name ?? seatLabel(holder);

  if (!game)
    return (
      <div className="wt-card">
        <h3>No muster stands</h3>
        <p className="wt-fine">
          The board reads the bare census. Sound the war horn on the time control below — deploy
          the game or the grand muster, and the whole operation flows: queues fill, the Patrons
          take their doors, and the coffers run.
        </p>
        <div className="wt-sact">
          <button onClick={onToHorn}>To the war horn →</button>
        </div>
      </div>
    );

  const tallyEntries = Object.entries(game.tally);
  const tally = tallyEntries.map(([k, n]) => `${n} ${k}`).join(' · ');

  return (
    <>
      <div className="wt-stats">
        <Stat n={o.open} label="Open work" />
        <Stat n={o.awaiting} label="Awaiting" tone={o.awaiting > 0 ? 'warn' : 'good'} />
        <Stat n={o.stuck} label="Stuck > 7d" tone={o.stuck > 0 ? 'warn' : 'good'} />
        <Stat n={relays.length} label={`Relays · ${relaysDone} run out`} />
      </div>

      <div className="wt-card">
        <h3>“{game.seed}” stands deployed</h3>
        {/* The full deal-tally is a wall of numbers — detail's business. Clean
            keeps the clock and the breadth in a breath. */}
        <p className="wt-fine" title={tally}>
          Dealt {game.deployedAt.slice(0, 10)} · game clock reads <b>{game.now.slice(0, 10)}</b>
          {tallyEntries.length > 0 ? ` · ${tallyEntries.length} kinds of work mustered` : ''}. Advance
          and reset the clock on the time control below the board.
        </p>
        {tally && <Explain className="wt-fine">{tally}.</Explain>}
      </div>

      {worst.length > 0 && (
        <div className="wt-card">
          <h3>The rising tide</h3>
          <Explain className="wt-fine">
            Neglect compounds — a case idles into festering past 7 days, a crisis past 14. The
            most-harmed first; enter each in the Ledger and its harm stops.
          </Explain>
          {worst.map((c) => (
            <div className="wt-row" key={c.caseId}>
              <span className="wt-rowt">
                <CaseName caseId={c.caseId} catalog={catalog} card kind={c.catalogRow} />
                <span className="wt-rowm">
                  {' '}
                  · {c.severity.idleDays}d · {c.severity.band}
                </span>
              </span>
              <span className="wt-actline">
                <span className={`wt-tag ${c.severity.band === 'crisis' ? 't-red' : 't-amber'}`}>
                  {c.severity.weight}
                </span>
                <button className="wt-go" onClick={() => nav.goToLedger(c.caseId)}>
                  → ledger
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="wt-card">
        <h3>The seats under load · {qs.length}</h3>
        {qs.length === 0 ? (
          <p className="wt-fine">No open work rests on any seat.</p>
        ) : (
          qs.slice(0, 8).map((q) => (
            <div className="wt-row" key={q.holder}>
              <span className="wt-rowt">
                <b>{nameOf(q.holder)}</b>
              </span>
              <span className="wt-actline">
                <span className="wt-tag t-amber">{q.cases.length}</span>
                <button className="wt-go" onClick={() => nav.goToLedger()}>
                  → ledger
                </button>
              </span>
            </div>
          ))
        )}
      </div>

      <div className="wt-card">
        <h3>The stream by task-type</h3>
        {byType.length === 0 ? (
          <p className="wt-fine">No open work to type.</p>
        ) : (
          byType.slice(0, 10).map((b) => (
            <div className="wt-row" key={b.catalogRow ?? '(untyped)'}>
              <span className="wt-rowt">
                <b>{b.catalogRow ? titleFor(catalog, b.catalogRow) : 'Untyped'}</b>
              </span>
              <span className="wt-tag t-amber">{b.cases.length}</span>
            </div>
          ))
        )}
      </div>

      {relays.length > 0 && (
        <div className="wt-card">
          <h3>The relays · {relays.length}</h3>
          <Explain className="wt-fine">
            Move-out cascades triggered on doors, each walked to the stage its age allows. The
            Ledger's flow cards hold the advance and ratify each step in hand.
          </Explain>
          {relays.slice(0, 8).map((r) => (
            <div className="wt-row" key={r.caseId}>
              <span className="wt-rowt">
                <CaseName caseId={r.subject} catalog={catalog} card />
                <span className="wt-rowm">
                  {' '}
                  · {r.advanced}/{r.steps.length}
                  {r.status === 'done'
                    ? ' · run out'
                    : r.next
                      ? ` · next: ${nameOf(r.next.step.holder ?? '')}`
                      : ''}
                  {r.breached.length > 0 ? ` · ⚠ ${r.breached.length}` : ''}
                </span>
              </span>
              <button className="wt-go" onClick={() => nav.goToLedger(r.caseId)}>
                → ledger
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
