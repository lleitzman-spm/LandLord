// Persistence for the chronicle. The app speaks only to /api/chronicle;
// behind that door the dev server keeps the vault (Supabase, locked per
// the walls ruling — see vite.config.ts) when a key is present, and the
// repo file data/chronicle.json as backup ledger and keyless fallback,
// with git as courier of last resort. localStorage mirrors every write
// as a fallback and as the migration source for the pre-chronicle
// Marches ledger.

import { useEffect, useRef, useState } from 'react';
import type { Chronicle } from '../domain/chronicle';
import {
  FOUNDING_CHRONICLE,
  economyOf,
  isFoundingChronicle,
  normalizeChronicle,
} from '../domain/chronicle';
import { mergeOnConflict } from './chronicleMerge';
import { foldIntoFief, raiseToFief } from '../domain/census';
import type { EstateBook } from '../domain/estate';
import type { EconomySettingPatch } from '../domain/economySetting';
import { revOf } from '../server/vault';
import { reportLostWrite } from '../watch';
import type { Catalog, CatalogRow } from '../domain/catalog';
import { findRow } from '../domain/catalog';
import type { ActsBook, CensusBook } from '../domain/court';
import type { EventKind, KingdomEvent } from '../domain/events';
import { queues, readCase } from '../domain/events';
import { commissionCaseId, placementCaseId } from '../domain/pods';
import type { FlowBook, FlowParams, FlowTemplate } from '../domain/flows';
import { approveStep, completeStep, fullParams, instantiateFlow, overrideStep, paramsOf } from '../domain/flows';
import type { MarchesLedger } from '../domain/marches';
import type { TreasuryLedger } from '../domain/treasury';
import { WAR_HOUSEHOLD, isHouseholdUpkeep } from '../domain/treasury';
import { INTRO_CAMPAIGN, generateCampaign, vacateOffices } from '../domain/campaign';
import type { EconomyBook, MoneyEvent, MoneyLog } from '../domain/economy';
import { estimateSpendCents, fiduciaryViolationsAt, sampleLedger, settlementGate, vendorSettlementMoney } from '../domain/economy';
import type { PledgeType, TerritoryKind } from '../domain/types';
import { dealtGame, generateGrandMuster, generateWarGame } from '../domain/wargame';
import type { WarState } from '../domain/wargame';
import { escalationCandidates } from '../domain/consequences';
import type { CaseReading } from '../domain/events';

/** The owner a case's opened note names ("Owner: <name>."), or a fallback. */
function ownerOf(c: CaseReading): string {
  const note = c.events.find((e) => e.kind === 'opened')?.note;
  const at = note?.indexOf('Owner: ');
  if (note == null || at == null || at < 0) return 'the door’s Patron';
  const rest = note.slice(at + 'Owner: '.length);
  const end = rest.indexOf('.');
  return end > 0 ? rest.slice(0, end) : rest;
}

/** The vendor-dispatch settlement step — where owner money leaves to pay the
 *  artisan (mirrors `harness/clerks.mjs`'s SETTLE_STEP_KEYS). */
const SETTLE_STEP_KEYS = new Set(['pay-vendor', 'pay']);

/** What the settled WO cost, in cents — or UNDEFINED when nothing says.
 *
 *  A clerk's reconciled invoice or quote if one ran (their notes carry the
 *  figure); else the working-fluid estimate by urgency band, the manual path so
 *  a hand-worked WO still settles a real number without the data gate.
 *
 *  When there is no invoice, no quote AND no urgency band, there is no honest
 *  answer, and the previous one was a fabricated $350 that MOVED REAL MONEY
 *  through the ledger. Undefined falls into the same "no money event" path as a
 *  zero bill: nothing is posted, and nothing is invented. */
function settledBillCents(
  c: CaseReading,
  params: Record<string, string> | undefined,
): number | undefined {
  const dollars = (re: RegExp): number | null => {
    for (let i = c.events.length - 1; i >= 0; i--) {
      const m = c.events[i].note?.match(re);
      if (m) return Math.round(Number(m[1].replace(/,/g, '')) * 100);
    }
    return null;
  };
  const invoice = dollars(/\$([\d,]+)\s*invoice/i);
  if (invoice && invoice > 0) return invoice;
  const quoted = dollars(/quoted\s*\$([\d,]+)/i);
  if (quoted && quoted > 0) return quoted;
  // Undefined when the work order names no urgency band — the gate reads that as
  // `unclassified` and stops it, rather than weighing an invented number.
  return estimateSpendCents(params?.urgency);
}

const API = '/api/chronicle';
const MIRROR_KEY = 'landlord.chronicle.v1';
// The mirrors written before the 2026-07-18 rename; read, never written.
const LEGACY_MIRROR_KEY = 'landlord.chronicle.v1';
const LEGACY_MARCHES_KEY = 'landlord.marches.v1';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function readMirror(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Best local copy: mirror first, then the pre-rename mirror, else the
 *  pre-chronicle Marches ledger. */
function loadLocal(): Chronicle {
  const mirror = readMirror(MIRROR_KEY) ?? readMirror(LEGACY_MIRROR_KEY);
  if (mirror) return normalizeChronicle(mirror);
  const legacy = readMirror(LEGACY_MARCHES_KEY);
  if (legacy) return normalizeChronicle({ marches: legacy as MarchesLedger });
  return FOUNDING_CHRONICLE;
}

async function loadRemote(): Promise<{ chronicle: Chronicle; rev: number } | null> {
  try {
    const res = await fetch(API);
    if (!res.ok) return null;
    const raw = await res.json();
    return { chronicle: normalizeChronicle(raw), rev: revOf(raw) };
  } catch {
    return null;
  }
}

/** The result of a compare-and-set persist attempt. On `conflict` the caller
 *  3-way-merges the fresh `remote` against the base it last synced (so a strike
 *  is honored and no appended record is overwritten), then re-fires the save. */
type PersistResult =
  | { status: 'ok'; rev: number }
  | { status: 'conflict'; remote: Chronicle; rev: number }
  /** The vault said no, or never answered. `refused` carries the status it gave
   *  us; `unreachable` means the fetch itself never landed. Both used to
   *  collapse to a bare `{ status: 'error' }`, which threw away the only thing
   *  that would have told us WHY — so a lost write could not be diagnosed even
   *  after someone noticed it. */
  | { status: 'error'; kind: 'refused' | 'unreachable'; httpStatus?: number };

/** Persist the chronicle with optimistic concurrency: PUT the doc carrying
 *  rev = base + 1; the server commits only if the stored rev still equals base.
 *  On a 409 the server returns the fresh doc; the caller reconciles it. */
async function persist(chronicle: Chronicle, base: number): Promise<PersistResult> {
  const body = JSON.stringify({ ...chronicle, rev: base + 1 }, null, 2);
  try {
    const res = await fetch(API, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body,
    });
    if (res.status === 409) {
      const raw = await res.json();
      return { status: 'conflict', remote: normalizeChronicle(raw), rev: revOf(raw) };
    }
    if (res.ok) return { status: 'ok', rev: base + 1 };
    // A refusal is a LOST RECORD. Tell the watchtower before we tell the
    // screen, because the screen may be looked at by someone who cannot read a
    // console and will not file a report.
    reportLostWrite({ kind: 'refused', status: res.status, base, bytes: body.length });
    return { status: 'error', kind: 'refused', httpStatus: res.status };
  } catch (cause) {
    reportLostWrite({ kind: 'unreachable', base, bytes: body.length, cause });
    return { status: 'error', kind: 'unreachable' };
  }
}

export interface MarchesActions {
  ledger: MarchesLedger;
  arrive: (title: string, note?: string) => void;
  rideOut: (arrivalId: string, territoryId: string) => void;
  turnAway: (arrivalId: string) => void;
  recall: (arrivalId: string) => void;
}

export interface TreasuryActions {
  ledger: TreasuryLedger;
  strike: (upkeepId: string) => void;
}

export interface EconomyActions {
  /** The loaded chart of accounts and fee rules — the two-book taxonomy, WITH
   *  any economy setting folded in (`economyOf`). This is the economy the
   *  kingdom governs by; every reading below reads it. */
  book: EconomyBook;
  /** The chart BEFORE the setting overlay — the founding/loaded chart itself
   *  (`chronicle.economy`). The loader previews a pasted patch against this, so
   *  a fresh load replaces the current setting rather than stacking on it. */
  baseBook: EconomyBook;
  /** The setting overlay standing now, if any — for the loader's "a setting
   *  stands" summary. Absent ⇒ the founding, no setting loaded. */
  setting?: EconomySettingPatch;
  /** The money-dimension stream; the balanced postings fold from it. */
  money: MoneyLog;
  /** Record one money event — what cost or earned. Append-only (a mis-record is
   *  struck, never edited; a correction is a reversing event). `wg`-marked when a
   *  game stands, so Reset strikes it. */
  record: (e: Omit<MoneyEvent, 'id' | 'at' | 'wg'> & { at?: string }) => void;
  /** Strike a mis-recorded money event (law 6: undo beside the record). */
  strike: (moneyId: string) => void;
  /** Deal a working-fluid sample month so the readings show — only while a game
   *  stands (it is `wg`-marked demo data; Reset clears it). */
  dealSample: () => void;
  /** The gate's switch: load a real economy setting (a firm's true fee rates/caps/
   *  GL codes) as the chronicle's `economySetting` overlay — the attended entry
   *  a factory setting pours through, mirroring `catalog.load`/`flows.load`.
   *  Records-in: the patch itself lands on the chronicle; `economyOf` folds it
   *  over the founding chart everywhere at once. Replaces any prior setting
   *  wholesale (last writer wins — it is a single attended overlay, not a log).
   *  Never a place a real figure lives in code — the operator pastes it in. */
  loadSetting: (patch: EconomySettingPatch) => void;
  /** Strike the loaded setting — the chronicle reverts to its founding (or
   *  loaded) chart exactly as founded (law 6: undo beside the record). */
  clearSetting: () => void;
}

export interface CourtActions {
  acts: ActsBook;
  /** Places a vassal in charge: lord of a fief, mayor of a hamlet. Dated. */
  grant: (territoryId: string, personId: string, role: 'lord' | 'mayor') => void;
  /** Formally names a artisan keeper of a lordless territory. Dated. */
  appoint: (territoryId: string, personId: string) => void;
  /** Stations a artisan in a territory as workforce. Not authority. */
  post: (territoryId: string, personId: string) => void;
  /** Records a vassal serving inside a fief under its lord. */
  swear: (territoryId: string, personId: string) => void;
  /** Strikes any act — grant, appointment, posting, fealty — from the book. */
  revoke: (actId: string) => void;
}

export interface CensusActions {
  book: CensusBook;
  /** Enrolls a person in the census. */
  enroll: (person: {
    name: string;
    pledge: PledgeType;
    pledgedTo?: string;
    note?: string;
  }) => void;
  /** Founds a territory: a fief of the kingdom, or a hamlet inside one.
   *  Returns the new keep's id (empty for a refused, nameless founding) so a
   *  caller can act on it at once — granting it in the same breath, which is
   *  what seating a master on a guild that has no keep yet requires. */
  found: (territory: { name: string; kind: TerritoryKind; parentId?: string }) => string;
  /** Changes a person's pledge — a squire knighted, a artisan hired in.
   *  Their records stay; the readings recompute around the new pledge. */
  repledge: (personId: string, pledge: PledgeType, pledgedTo?: string) => void;
  /** The graduation path, upward: a hamlet becomes a sovereign fief. */
  promote: (territoryId: string) => void;
  /** The reverse: a fief folds back into a parent fief as a hamlet. */
  demote: (territoryId: string, parentId: string) => void;
  /** Strikes a person or territory from the census. Records that point at
   *  them stay in their books; the readings tolerate the gap. */
  strike: (id: string) => void;
}

export interface EventsActions {
  log: KingdomEvent[];
  /** Append an event — the only way the real work is recorded (events-only).
   *  Append in spirit; a mis-logged event is struck, not edited. */
  record: (e: {
    caseId: string;
    kind: EventKind;
    holder?: string;
    catalogRow?: string;
    actor?: string;
    note?: string;
  }) => void;
  /** Strike a mis-logged event from the book (law 6: undo beside the record). */
  strike: (eventId: string) => void;
}

export interface CatalogActions {
  rows: Catalog;
  /** Load a whole ontology at once — the gated entry a factory setting uses to
   *  pour in its rows (a firm's ~113 at the merge). Replaces the book wholesale. */
  load: (rows: Catalog) => void;
  /** Add or amend a single task-type. Keyed: a row whose key already sits in
   *  the book amends it (last writer wins), it never duplicates. */
  add: (row: CatalogRow) => void;
  /** Strike a task-type by key. Events that referenced it keep the key; the
   *  reading falls back to the raw key rather than reject the record. */
  strike: (key: string) => void;
}

export interface EstateActions {
  /** The estate roster — the loaded {id,label} book of real properties. */
  roster: EstateBook;
  /** Load the whole roster at once — the attended gate a real property list
   *  pours through (mirrors `catalog.load`/`flows.load`). Replaces it wholesale;
   *  an empty book reverts to founding. Real properties load here, never in code. */
  load: (roster: EstateBook) => void;
}

export interface FlowsActions {
  flows: FlowBook;
  /** Load flow templates wholesale — the gated entry a factory setting uses to
   *  pour in its real relays at the merge. Replaces the book. */
  load: (flows: FlowBook) => void;
  /** Trigger a flow on a subject ("Willow Creek unit 4"): opens a case and
   *  appends the cascade's steps as events — the only record of the instance
   *  there will ever be (events-only). Returns the case id, or null when the
   *  subject is empty or the template unknown. */
  trigger: (flowKey: string, subject: string) => string | null;
  /** The operator's hands: mark the step in hand done and hand the next
   *  template step — both appended to the log, the cascade walked one seat
   *  on. On the final step only the `done` appends, closing the case. The
   *  index is the step's place in the template (the reading's `next`);
   *  silently no-ops when the flow or the index is unknown. */
  markDone: (flowKey: string, caseId: string, index: number, note?: string) => void;
  /** Ratify the step that waits: `approved` appended, the cascade advances. */
  approve: (flowKey: string, caseId: string, index: number, note?: string) => void;
  /** Overrule the step that waits: `overridden` appended with the human's
   *  note; the cascade holds — the step's holder keeps the ball. */
  override: (flowKey: string, caseId: string, index: number, note?: string) => void;
}

export interface RegentActions {
  /** Identify a task down the tree to a catalog leaf and PUT IT IN MOTION
   *  (WRIT-TASK-LANGUAGE, swing three — the Regent's signature act). Looks up
   *  the leaf's `completes` flow and its `params`: bound → instantiate that
   *  cascade on the subject, the leaf's letters threaded so the whole walk
   *  renders its trade and urgency (not a literal `{trade}`); unbound → a
   *  single typed `opened`, the primitive the seat and the agents share. When
   *  `resolves` names the raw intake case it was identified from, that case is
   *  retired with a `done` (the ticket becomes a real cascade, not a tick);
   *  `owner` names the door's Patron so the consequence engine folds the new
   *  work's harm onward. Returns the new case id, or null on an empty subject. */
  triggerTyped: (
    catalogKey: string,
    subject: string,
    opts?: { owner?: string; resolves?: string; holder?: string },
  ) => string | null;
  /** Delegate to escape: hand EVERY open case a holder carries to a real seat
   *  in one act — clear a whole unowned queue (`pm-desk` …) off the desk. One
   *  `handed` event per case; nothing stored, the queues re-fold. */
  handQueue: (fromHolder: string, toHolder: string) => void;
  /** Hand one case's ball to a real seat (a single `handed`). */
  handCase: (caseId: string, toHolder: string) => void;
  /** Recruit a knight to hold a pod (WRIT-THE-LAND, Phase 2): a `commissioned`
   *  event opens an empty pod for owners to be placed into. War-scoped (marked
   *  `wg/<seed>`) so Reset strikes it; no game standing → no act. */
  commissionKnight: (knightId: string, name?: string) => void;
  /** Place an owner (a Patron) into a knight's pod — the Regent's allocation
   *  act, the pod-world sibling of `handQueue`. A `placement` event; last write
   *  wins (an owner can be re-placed). War-scoped and Reset-safe. */
  placeOwner: (owner: string, knightId: string) => void;
}

export interface WargameActions {
  /** The war banner: null when no game is deployed — the readings then run
   *  on the wall clock. */
  state: WarState | null;
  /** Deploy a game: generate the synthetic operation from the seed and pour
   *  its events into the log, and raise the banner with the simulated clock
   *  set to the dealing instant. Redeploying the same seed appends only what
   *  is not already dealt. Returns the tally, or null when no relay template
   *  is loaded to muster. */
  deploy: (seed: string) => Record<string, number> | null;
  /** Deploy the INTRO CAMPAIGN — the small holding a new Regent learns on
   *  (docs/WRIT-THE-CAMPAIGN.md). Sixteen doors, a clean clock, solvent at rest,
   *  and one craft deliberately left headless so the first act has something to
   *  decide. The grand muster stays exactly as it is, one click away. */
  deployCampaign: () => Record<string, number> | null;
  /** Deploy the GRAND muster: load the reference library (the 297-leaf catalog
   *  and all ~24 flow grammars, mapped to real seats) and deal the whole
   *  operation from it — every domain flowing. Async: the library is fetched
   *  on demand. Returns the tally. */
  deployGrand: (seed: string) => Promise<Record<string, number> | null>;
  /** Advance the simulated clock (a day, a week) — the readings re-fold:
   *  aging climbs, breaches surface, what's due changes. */
  advance: (days: number) => void;
  /** Strike the game: remove exactly its events (the `wg/<seed>` mark) and
   *  lower the banner. The founding chronicle is one Reset away. */
  reset: () => void;
  /** Let the clerks work: run the fleet against the standing muster server-side
   *  (POST /api/fleet — the keyholder holds the brain), then merge the freshly-
   *  committed `agent:<seat>` proposals back onto the board, losing no local
   *  edit. `cap` bounds how many cases each clerk proposes this run. Returns the
   *  proposal count, or an error the UI can surface. The clerks only PROPOSE —
   *  the Regent still ratifies every one. */
  runClerks: (
    cap?: number,
  ) => Promise<{ ok: true; proposals: number; swept: number } | { ok: false; error: string }>;
}

/** Where the last write to the vault stands. `saving` while a PUT is in flight,
 *  `saved` once it commits, `error` when the vault refused it — the record is
 *  held in the localStorage mirror but is NOT in the vault, so it must be shown,
 *  never swallowed (a reload would otherwise overwrite it with the stale vault
 *  copy — silent data loss). `idle` before any write this session. */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface Persistence {
  /** The standing of the last vault write. */
  status: SaveStatus;
  /** Re-attempt the last failed write against the current record + rev. */
  retry: () => void;
  /** WHY the last write failed, when it did. Two failures wear one face on the
   *  banner otherwise, and they call for opposite acts from whoever is reading:
   *  a vault that ANSWERED and said no will keep saying no until something
   *  changes, so pressing Retry is futile; a vault that could not be REACHED is
   *  very often a dropped connection, where Retry is exactly the right move.
   *  Telling the Regent which one happened is the difference between a useful
   *  alarm and a loud one. Null whenever the last write did not fail. */
  failure: { kind: 'refused' | 'unreachable'; httpStatus?: number } | null;
}

export interface ChronicleStore {
  chronicle: Chronicle;
  /** How the last write to the vault fared — for the save-failure banner. */
  persistence: Persistence;
  marches: MarchesActions;
  treasury: TreasuryActions;
  economy: EconomyActions;
  court: CourtActions;
  census: CensusActions;
  events: EventsActions;
  catalog: CatalogActions;
  estates: EstateActions;
  flows: FlowsActions;
  regent: RegentActions;
  wargame: WargameActions;
}

/** The instant a NEW RECORD is stamped with: game-now while a muster stands,
 *  the wall clock otherwise.
 *
 *  This is not a nicety. Every reading in the app folds against game-now, and
 *  the clerk fleet stamps its proposals with game-now — but every human hand
 *  here used to stamp the WALL clock. So the moment the Regent advanced the war
 *  clock, game-now ran ahead of wall-now and the two disagreed about the order
 *  of history: a ratification written *after* a clerk's proposal sorted
 *  *before* it, `statusOf` took the last event (still the proposal), and the
 *  cascade did not move. Ratify, and nothing happens; ratify again, and another
 *  dead record. There was no way to advance that work from anywhere in the app.
 *
 *  The same split made every case the Regent had just worked read as neglected:
 *  aging is game-now minus the record's own instant, so a case touched a second
 *  ago reported however many days the clock had been advanced — crisis bands,
 *  eroded patron faith and spawned habitability alarms, all on work that was
 *  done. (Found by an adversarial sweep, 2026-07-28; `dealSample` had had this
 *  right on its own since the economy landed.)
 *
 *  A record and the readings folded from it must tell the same time. */
function stampFor(chronicle: Chronicle): string {
  return chronicle.wargame?.now ?? new Date().toISOString();
}

export function useChronicle(): ChronicleStore {
  const [chronicle, setChronicle] = useState<Chronicle>(loadLocal);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  // WHY the last write failed, kept beside the status so the banner can name it.
  const [saveFailure, setSaveFailure] = useState<Persistence['failure']>(null);
  const ready = useRef(false);
  const touched = useRef(false);
  // The vault version this session last saw — the base for the next compare-
  // and-set write. Kept out of the domain Chronicle (a persistence concern);
  // it rides the doc as `rev` only on the wire.
  const rev = useRef(0);
  // The last vault state this session synced to (read or wrote) — the common
  // BASE a conflict merge reconciles against, so a strike on either side is
  // honored rather than resurrected by the union (see chronicleMerge.ts).
  const baseDoc = useRef<Chronicle>(chronicle);

  // Adopt the repo file once it answers — unless the user already made a
  // record this session, in which case local state wins and persists over it.
  useEffect(() => {
    let cancelled = false;
    void loadRemote().then((remote) => {
      if (cancelled || remote == null) {
        ready.current = true;
        return;
      }
      rev.current = remote.rev;
      // The vault's known state is the base for the next conflict, whether or
      // not local edits diverged from it above.
      baseDoc.current = remote.chronicle;
      setChronicle((prev) => {
        if (touched.current) return prev;
        // A remote founding-state file must not erase real local records.
        if (isFoundingChronicle(remote.chronicle) && !isFoundingChronicle(prev)) return prev;
        return remote.chronicle;
      });
      ready.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready.current && !touched.current) return;
    localStorage.setItem(MIRROR_KEY, JSON.stringify(chronicle));
    let cancelled = false;
    setSaveStatus('saving');
    void persist(chronicle, rev.current).then((r) => {
      if (cancelled) return;
      // A refused write is NOT swallowed: the record lives in the mirror above
      // but never reached the vault, so a reload would lose it. Raise it (the
      // banner offers Retry) instead of returning silently.
      if (r.status === 'error') {
        setSaveFailure({ kind: r.kind, httpStatus: r.httpStatus });
        setSaveStatus('error');
        return;
      }
      rev.current = r.rev;
      // On conflict, 3-way-merge our work onto the fresh vault against the base
      // we last synced — no append lost, and a strike stays struck. The vault is
      // now `remote`, so it becomes the base the re-fired write reconciles from.
      if (r.status === 'conflict') {
        const merged = mergeOnConflict(chronicle, r.remote, baseDoc.current);
        baseDoc.current = r.remote;
        setChronicle((prev) => (prev === chronicle ? merged : prev));
        return; // the re-fire settles the status once the merge commits
      }
      // Committed: the doc we wrote is now the vault's state (the next base).
      baseDoc.current = chronicle;
      setSaveFailure(null);
        setSaveStatus('saved');
    });
    return () => {
      cancelled = true;
    };
  }, [chronicle]);

  // Re-attempt the last failed write against the current record + rev. The
  // save effect only fires on a chronicle change, so a transient vault outage
  // needs a manual nudge to flush the mirror through once it clears.
  const retrySave = () => {
    if (saveStatus === 'saving') return;
    setSaveStatus('saving');
    void persist(chronicle, rev.current).then((r) => {
      if (r.status === 'error') {
        setSaveFailure({ kind: r.kind, httpStatus: r.httpStatus });
        setSaveStatus('error');
        return;
      }
      rev.current = r.rev;
      if (r.status === 'conflict') {
        const merged = mergeOnConflict(chronicle, r.remote, baseDoc.current);
        baseDoc.current = r.remote;
        setChronicle((prev) => (prev === chronicle ? merged : prev));
        return;
      }
      baseDoc.current = chronicle;
      setSaveFailure(null);
        setSaveStatus('saved');
    });
  };

  const mutate = (fn: (prev: Chronicle) => Chronicle) => {
    touched.current = true;
    setChronicle(fn);
  };

  const marches: MarchesActions = {
    ledger: chronicle.marches,
    arrive: (title, note) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      mutate((prev) => ({
        ...prev,
        marches: {
          ...prev.marches,
          arrivals: [
            ...prev.marches.arrivals,
            {
              id: crypto.randomUUID(),
              title: trimmed,
              note: note?.trim() || undefined,
              arrivedOn: today(),
            },
          ],
        },
      }));
    },
    rideOut: (arrivalId, territoryId) => {
      mutate((prev) => ({
        ...prev,
        marches: {
          ...prev.marches,
          dispatches: [
            ...prev.marches.dispatches,
            { id: crypto.randomUUID(), arrivalId, territoryId, dispatchedOn: today() },
          ],
        },
      }));
    },
    turnAway: (arrivalId) => {
      mutate((prev) => ({
        ...prev,
        marches: {
          ...prev.marches,
          turnaways: [
            ...prev.marches.turnaways,
            { id: crypto.randomUUID(), arrivalId, turnedAwayOn: today() },
          ],
        },
      }));
    },
    recall: (arrivalId) => {
      mutate((prev) => ({
        ...prev,
        marches: {
          ...prev.marches,
          dispatches: prev.marches.dispatches.filter((d) => d.arrivalId !== arrivalId),
          turnaways: prev.marches.turnaways.filter((t) => t.arrivalId !== arrivalId),
        },
      }));
    },
  };

  const treasury: TreasuryActions = {
    ledger: chronicle.treasury,
    strike: (upkeepId) => {
      mutate((prev) => ({
        ...prev,
        treasury: { upkeeps: prev.treasury.upkeeps.filter((u) => u.id !== upkeepId) },
      }));
    },
  };

  // The economy: the money-dimension stream (records in), the postings folded
  // out. Records are `wg`-marked while a game stands so Reset strikes them
  // (money has no caseId to bear the mark; the `wg` field carries it).
  const economy: EconomyActions = {
    book: economyOf(chronicle),
    baseBook: chronicle.economy,
    setting: chronicle.economySetting,
    money: chronicle.money,
    record: (e) => {
      if (!Number.isFinite(e.amountCents) || e.amountCents <= 0 || !e.kind) return;
      const seed = chronicle.wargame?.seed;
      const entry: MoneyEvent = {
        ...e,
        id: crypto.randomUUID(),
        at: e.at ?? stamp(),
        ...(seed ? { wg: seed } : {}),
      };
      mutate((prev) => ({ ...prev, money: [...prev.money, entry] }));
    },
    strike: (moneyId) => {
      mutate((prev) => ({ ...prev, money: prev.money.filter((m) => m.id !== moneyId) }));
    },
    dealSample: () => {
      const seed = chronicle.wargame?.seed;
      if (!seed) return; // demo data belongs to a standing game, so Reset clears it
      const at = stamp();
      const batch = sampleLedger(economyOf(chronicle), at).map((s) => ({
        ...s,
        id: crypto.randomUUID(),
        wg: seed,
      }));
      mutate((prev) => ({ ...prev, money: [...prev.money, ...batch] }));
    },
    // The gate's write side, the twin of the `economyOf` read seam: pour the
    // setting onto the chronicle (mirrors `catalog.load`/`flows.load`). It flows
    // through the same `mutate → persist → CAS` path as every write, so the
    // setting persists to the vault; on a merge it is a single non-log field, so
    // last-writer-wins is the right resolution for an attended single-operator
    // load (no append to lose). It is NOT `wg`-marked: a real economy setting is
    // the kingdom's own reckoning, not a game's demo data — Reset must not strike it.
    loadSetting: (patch) => mutate((prev) => ({ ...prev, economySetting: patch })),
    clearSetting: () => mutate((prev) => ({ ...prev, economySetting: undefined })),
  };

  const court: CourtActions = {
    acts: chronicle.acts,
    grant: (territoryId, personId, role) => {
      if (!territoryId || !personId) return;
      mutate((prev) => ({
        ...prev,
        acts: {
          ...prev.acts,
          grants: [
            ...prev.acts.grants,
            { id: crypto.randomUUID(), territoryId, personId, role, grantedOn: today() },
          ],
        },
      }));
    },
    appoint: (territoryId, personId) => {
      if (!territoryId || !personId) return;
      mutate((prev) => ({
        ...prev,
        acts: {
          ...prev.acts,
          appointments: [
            ...prev.acts.appointments,
            { id: crypto.randomUUID(), territoryId, personId, appointedOn: today() },
          ],
        },
      }));
    },
    post: (territoryId, personId) => {
      if (!territoryId || !personId) return;
      mutate((prev) => ({
        ...prev,
        acts: {
          ...prev.acts,
          postings: [
            ...prev.acts.postings,
            { id: crypto.randomUUID(), territoryId, personId },
          ],
        },
      }));
    },
    swear: (territoryId, personId) => {
      if (!territoryId || !personId) return;
      mutate((prev) => ({
        ...prev,
        acts: {
          ...prev.acts,
          fealties: [
            ...prev.acts.fealties,
            { id: crypto.randomUUID(), territoryId, personId },
          ],
        },
      }));
    },
    revoke: (actId) => {
      mutate((prev) => ({
        ...prev,
        acts: {
          grants: prev.acts.grants.filter((g) => g.id !== actId),
          appointments: prev.acts.appointments.filter((a) => a.id !== actId),
          postings: prev.acts.postings.filter((p) => p.id !== actId),
          fealties: prev.acts.fealties.filter((f) => f.id !== actId),
        },
      }));
    },
  };

  /** The clock every hand below stamps its records with — see `stampFor`. */
  const stamp = () => stampFor(chronicle);

  const censusActions: CensusActions = {
    book: chronicle.census,
    enroll: ({ name, pledge, pledgedTo, note }) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      mutate((prev) => ({
        ...prev,
        census: {
          ...prev.census,
          people: [
            ...prev.census.people,
            {
              id: crypto.randomUUID(),
              name: trimmed,
              pledge,
              pledgedTo: pledgedTo || undefined,
              note: note?.trim() || undefined,
            },
          ],
        },
      }));
    },
    found: ({ name, kind, parentId }) => {
      const trimmed = name.trim();
      if (!trimmed) return '';
      const id = crypto.randomUUID();
      mutate((prev) => ({
        ...prev,
        census: {
          ...prev.census,
          territories: [
            ...prev.census.territories,
            {
              id,
              name: trimmed,
              kind,
              parentId: kind === 'hamlet' ? parentId || undefined : undefined,
            },
          ],
        },
      }));
      return id;
    },
    repledge: (personId, pledge, pledgedTo) => {
      mutate((prev) => ({
        ...prev,
        census: {
          ...prev.census,
          people: prev.census.people.map((p) =>
            p.id === personId
              ? {
                  ...p,
                  pledge,
                  pledgedTo: pledge === 'squire' ? pledgedTo || undefined : undefined,
                }
              : p,
          ),
        },
      }));
    },
    promote: (territoryId) => {
      // The law lives in the domain (`raiseToFief`), which refuses a Crown
      // office: an office is not a hamlet awaiting graduation, and promoting
      // one would make the Crown's own craft into land.
      mutate((prev) => ({
        ...prev,
        census: { ...prev.census, territories: raiseToFief(prev.census.territories, territoryId) },
      }));
    },
    demote: (territoryId, parentId) => {
      // A CROWN OFFICE IS NEVER LAND, so it can never be folded into a fief —
      // the law is `foldIntoFief` in the domain, and it returns the book
      // unchanged when it refuses. Ungoverned, this control rewrote an office's
      // kind to `hamlet` with nothing able to undo it (see census.ts).
      mutate((prev) => ({
        ...prev,
        census: {
          ...prev.census,
          territories: foldIntoFief(prev.census.territories, territoryId, parentId),
        },
      }));
    },
    strike: (id) => {
      mutate((prev) => ({
        ...prev,
        census: {
          people: prev.census.people.filter((p) => p.id !== id),
          territories: prev.census.territories.filter((t) => t.id !== id),
        },
      }));
    },
  };

  const events: EventsActions = {
    log: chronicle.events,
    record: ({ caseId, kind, holder, catalogRow, actor, note }) => {
      const c = caseId.trim();
      if (!c) return;
      mutate((prev) => ({
        ...prev,
        events: [
          ...prev.events,
          {
            id: crypto.randomUUID(),
            at: stamp(),
            caseId: c,
            kind,
            holder: holder || undefined,
            catalogRow: catalogRow?.trim() || undefined,
            actor: actor || undefined,
            note: note?.trim() || undefined,
          },
        ],
      }));
    },
    strike: (eventId) =>
      mutate((prev) => ({ ...prev, events: prev.events.filter((e) => e.id !== eventId) })),
  };

  const estates: EstateActions = {
    roster: chronicle.estates,
    load: (roster) => mutate((prev) => ({ ...prev, estates: roster })),
  };

  const catalog: CatalogActions = {
    rows: chronicle.catalog,
    load: (rows) => mutate((prev) => ({ ...prev, catalog: rows })),
    add: (row) => {
      const key = row.key.trim();
      const title = row.title.trim();
      if (!key || !title) return;
      const clean: CatalogRow = {
        key,
        title,
        class: row.class,
        mode: row.mode,
        note: row.note?.trim() || undefined,
      };
      mutate((prev) => {
        const exists = prev.catalog.some((r) => r.key === key);
        return {
          ...prev,
          catalog: exists
            ? // AMEND, as this action's own contract says — do not replace. The
              // form carries five fields; a row carries thirteen, and the eight
              // it does not carry include `completes` and `params`, which are
              // the binding between a catalog leaf and the cascade it opens.
              // Retitling `maintenance.hvac.no-cooling` used to drop that
              // binding silently: the row survived, looked right, and the
              // Regent's identify act thereafter opened a bare typed box where
              // an eight-step cascade belonged — "put in motion" with nothing in
              // motion. The generator's leaf pool thinned by one too, just as
              // quietly. This is the only edit path in the app. (Sweep,
              // 2026-07-28.)
              prev.catalog.map((r) => (r.key === key ? { ...r, ...clean } : r))
            : [...prev.catalog, clean],
        };
      });
    },
    strike: (key) =>
      mutate((prev) => ({ ...prev, catalog: prev.catalog.filter((r) => r.key !== key) })),
  };

  // The operator's hands: every act on a step is one pure helper from
  // flows.ts, its events appended through the log — nothing stored, same
  // ids/clock discipline as trigger. Silently no-ops on an unknown flow.
  const handFlow = (
    flowKey: string,
    caseId: string,
    index: number,
    note: string | undefined,
    // Typed explicitly rather than `typeof completeStep`, because the three
    // builders no longer share one opts shape: the two RATIFYING writers need
    // the log to refuse with (docs/WRIT-THE-GATE.md, finding 5) and
    // `completeStep` does not. Widening here keeps `completeStep` assignable —
    // a builder may ignore what it is handed, it just may not demand more.
    build: (
      tpl: FlowTemplate,
      caseId: string,
      index: number,
      opts: { at: string; id: () => string; note?: string; log: KingdomEvent[] },
      params?: FlowParams,
    ) => KingdomEvent[],
  ) => {
    const tpl = chronicle.flows.find((f) => f.key === flowKey);
    if (!tpl) return;
    // Recover the instance's letters from its `opened` event so advancing the
    // cascade renders the next step's trade/urgency, never a literal {token}
    // (the params-advance seam, WRIT-TASK-LANGUAGE swing three).
    const params = paramsOf(chronicle.events, caseId);
    const appended = build(
      tpl,
      caseId,
      index,
      // `log` feeds the ratification guard in `approveStep`/`overrideStep` — a
      // step is ratifiable only while it actually waits on a human's word
      // (docs/WRIT-THE-GATE.md, finding 5). `completeStep` ignores it. The same
      // snapshot `paramsOf` reads just above, so both halves of this call see one
      // consistent view of the book.
      { at: stamp(), id: () => crypto.randomUUID(), note, log: chronicle.events },
      params,
    );
    // An empty batch is a REFUSAL as often as it is a no-op now: the guard
    // returns nothing when a step is not ratifiable, and nothing is written.
    if (!appended.length) return;
    // The vertical slice (WRIT-B): settling a vendor-dispatch WO posts its real
    // money — the vendor paid, the coordination markup earned — so the
    // Counting-house reflects THIS settled work. Fires once, at the settlement
    // step, guarded so re-advancing never double-posts. Events + money commit in
    // ONE mutate (one CAS write; mergeOnConflict unions both, losing neither).
    const settlement = settlementMoney(tpl, caseId, index, appended);
    mutate((prev) => ({
      ...prev,
      events: [...prev.events, ...appended],
      money: settlement.length ? [...prev.money, ...settlement] : prev.money,
    }));
  };

  /** The money one settled vendor-dispatch step posts (empty for every other
   *  step/flow, or if this WO already settled). Stamps ids/wg like the other
   *  money hands; the amounts + soundness live in `vendorSettlementMoney`. */
  const settlementMoney = (
    tpl: FlowBook[number],
    caseId: string,
    index: number,
    appended: KingdomEvent[],
  ): MoneyEvent[] => {
    const step = tpl.steps[index];
    if (!step || tpl.key !== 'vendor-dispatch' || !SETTLE_STEP_KEYS.has(step.key)) return [];
    if (chronicle.money.some((m) => m.sourceId === caseId && m.kind === 'vendor_paid')) return [];
    const events = [...chronicle.events, ...appended];
    const reading = readCase(events, caseId);
    const billCents = settledBillCents(reading, paramsOf(events, caseId));
    // Undefined means nothing said what this cost. No money moves on a number
    // nobody produced.
    if (billCents == null || billCents <= 0) return [];
    // THE SETTLEMENT GATE — the money law's runtime refusal, at the writer.
    // This is the point where coin actually moves, and until 2026-08-07 it moved
    // for whatever bill the case named: no ceiling was consulted anywhere on this
    // path (docs/WRIT-THE-GATE.md). A bill above the owner-approval cap now
    // settles only if a HUMAN ratified this case — and because no clerk may ever
    // emit `approved`/`overridden`, the presence of one IS the proof of a person.
    // A case walked to settlement entirely by machine carries none, so its bill
    // is capped at what the machine was authorized to spend unattended.
    const ratified = reading.events.some(
      (e) => e.kind === 'approved' || e.kind === 'overridden',
    );
    const gate = settlementGate(
      economyOf(chronicle),
      billCents,
      ratified,
      reading.estateId ?? undefined,
    );
    // Refusing means NO COIN — and the absence of a `vendor_paid` event is the
    // different record the writ demands. Held and cleared are told apart by a
    // reading of the money log, not by a human reading prose off two identical
    // events, which is the fault this replaces.
    if (gate.refused) return [];
    const seed = chronicle.wargame?.seed;
    const posted = vendorSettlementMoney(economyOf(chronicle), chronicle.money, {
      caseId,
      billCents,
      at: stamp(),
      ownerId: ownerOf(reading),
    }).map((m) => ({ ...m, id: crypto.randomUUID(), ...(seed ? { wg: seed } : {}) }));
    // THE FIDUCIARY INVARIANT, at the writer (docs/WRIT-THE-GATE.md, finding 1).
    // It lived in the test shelf and was reachable only from CI: the kingdom
    // proved its books balanced and never asked the question at the moment coin
    // moved. It asks here now.
    //
    // The test is "does this batch INTRODUCE a breach", not "is the book sound" —
    // a chronicle may already carry one (a hand-recorded event, a dealt muster),
    // and refusing every later write because of an older fault would strand the
    // whole ledger on someone else's mistake. A writer's duty is not to make it
    // worse.
    const economy = economyOf(chronicle);
    const before = fiduciaryViolationsAt(economy, chronicle.money).length;
    const after = fiduciaryViolationsAt(economy, [...chronicle.money, ...posted]).length;
    if (after > before) return [];
    return posted;
  };

  const flows: FlowsActions = {
    flows: chronicle.flows,
    load: (next) => mutate((prev) => ({ ...prev, flows: next })),
    trigger: (flowKey, subject) => {
      const tpl = chronicle.flows.find((f) => f.key === flowKey);
      const trimmed = subject.trim();
      if (!tpl || !trimmed) return null;
      // The letters, filled. `fullParams`' own doc says it exists so a
      // hand-triggered cascade never leaks a literal {token} — and this, the
      // actual hand-trigger behind the Ledger's "Trigger the flow", was the one
      // path that did not call it. Its sibling `triggerTyped` did. With no
      // params on the `opened` event there is also nothing for `paramsOf` to
      // recover on every later step, so the leak ran the whole length of the
      // cascade: "raise by {increase}", forever. The catalog leaf that completes
      // this grammar carries the letters when one does. (Sweep, 2026-07-28.)
      const leaf = chronicle.catalog.find((r) => r.completes === tpl.key && r.params);
      const instance = instantiateFlow(
        tpl,
        trimmed,
        { at: stamp(), id: () => crypto.randomUUID() },
        fullParams(tpl, leaf?.params),
      );
      mutate((prev) => ({ ...prev, events: [...prev.events, ...instance.events] }));
      return instance.caseId;
    },
    markDone: (flowKey, caseId, index, note) =>
      handFlow(flowKey, caseId, index, note, completeStep),
    approve: (flowKey, caseId, index, note) =>
      handFlow(flowKey, caseId, index, note, approveStep),
    override: (flowKey, caseId, index, note) =>
      handFlow(flowKey, caseId, index, note, overrideStep),
  };

  // The Regent's hands (swing three): the identify-and-delegate primitives the
  // seat acts through — and the same seam an operator agent will grip in swing
  // four. Events-only, same id/clock discipline as trigger and the hands above.
  const regent: RegentActions = {
    triggerTyped: (catalogKey, subject, opts) => {
      const subj = subject.trim();
      if (!subj) return null;
      const at = stamp();
      const id = () => crypto.randomUUID();
      const row = findRow(chronicle.catalog, catalogKey);
      const tpl = row?.completes
        ? chronicle.flows.find((f) => f.key === row.completes)
        : undefined;
      const appended: KingdomEvent[] = [];
      let caseId: string;
      if (tpl) {
        // Bound → the leaf's completion cascade. Fill EVERY token the grammar
        // uses (the leaf's letters first, then a readable default for the
        // rest) so no literal {token} leaks as the cascade advances — however
        // rich the loaded flow book.
        const instance = instantiateFlow(tpl, subj, { at, id }, fullParams(tpl, row?.params));
        caseId = instance.caseId;
        if (opts?.owner) {
          const opened = instance.events.find((e) => e.kind === 'opened');
          if (opened) opened.note = `${opened.note ?? ''} Owner: ${opts.owner}.`.trim();
        }
        appended.push(...instance.events);
      } else {
        // Unbound → a single typed `opened`, the atomic primitive. Guard the
        // rare case where the subject IS the raw ticket we also retire below.
        caseId = subj === opts?.resolves ? `${subj} · typed` : subj;
        appended.push({
          id: id(),
          at,
          caseId,
          kind: 'opened',
          holder: opts?.holder || undefined,
          catalogRow: catalogKey,
          note: `${row?.title ?? catalogKey} — put in motion.${opts?.owner ? ` Owner: ${opts.owner}.` : ''}`,
        });
      }
      // Retire the raw intake it was identified from: the ticket is now a real
      // cascade, not a tick. The `done` stops its harm — identifying pays off.
      if (opts?.resolves && opts.resolves !== caseId) {
        appended.push({
          id: id(),
          at,
          caseId: opts.resolves,
          kind: 'done',
          catalogRow: 'work-order',
          note: `Identified as ${row?.title ?? catalogKey} — put in motion${tpl ? ` as a ${tpl.title}` : ''}.`,
        });
      }
      mutate((prev) => ({ ...prev, events: [...prev.events, ...appended] }));
      return caseId;
    },
    handQueue: (fromHolder, toHolder) => {
      if (!fromHolder || !toHolder || fromHolder === toHolder) return;
      const held = queues(chronicle.events).find((q) => q.holder === fromHolder)?.cases ?? [];
      if (!held.length) return;
      const at = stamp();
      const handed: KingdomEvent[] = held.map((c) => ({
        id: crypto.randomUUID(),
        at,
        caseId: c.caseId,
        kind: 'handed',
        holder: toHolder,
        catalogRow: c.catalogRow ?? undefined,
        note: `Delegated off the ${fromHolder} queue to a real seat.`,
      }));
      mutate((prev) => ({ ...prev, events: [...prev.events, ...handed] }));
    },
    handCase: (caseId, toHolder) => {
      const c = caseId.trim();
      if (!c || !toHolder) return;
      const reading = readCase(chronicle.events, c);
      mutate((prev) => ({
        ...prev,
        events: [
          ...prev.events,
          {
            id: crypto.randomUUID(),
            at: stamp(),
            caseId: c,
            kind: 'handed',
            holder: toHolder,
            catalogRow: reading.catalogRow ?? undefined,
            note: 'Handed to a real seat.',
          },
        ],
      }));
    },
    // A commission and a placement are settled facts, not open work: opened + a
    // settling done at once (the lease pattern), so the operator's work-readings
    // never count them while readPods folds them.
    commissionKnight: (knightId, name) => {
      const seed = chronicle.wargame?.seed;
      const k = knightId.trim();
      if (!seed || !k) return;
      const who = (name ?? k).trim();
      const at = stamp();
      const cid = commissionCaseId(seed, k);
      mutate((prev) => ({
        ...prev,
        events: [
          ...prev.events,
          { id: crypto.randomUUID(), at, caseId: cid, kind: 'opened', holder: k, note: `${who} is commissioned a knight — a pod stands open for owners to place.` },
          { id: crypto.randomUUID(), at, caseId: cid, kind: 'done', holder: k, note: `${who} holds the pod.` },
        ],
      }));
    },
    placeOwner: (owner, knightId) => {
      const seed = chronicle.wargame?.seed;
      const o = owner.trim();
      const k = knightId.trim();
      if (!seed || !o || !k) return;
      const at = stamp();
      const pid = placementCaseId(seed, o);
      mutate((prev) => ({
        ...prev,
        events: [
          ...prev.events,
          { id: crypto.randomUUID(), at, caseId: pid, kind: 'opened', holder: k, note: `${o} placed in ${k}'s care.` },
          { id: crypto.randomUUID(), at, caseId: pid, kind: 'done', holder: k, note: `${o} settled in ${k}'s pod.` },
        ],
      }));
    },
  };

  // The War Game: deploy generates the world (events only) and raises the
  // banner with the simulated clock; advance moves game-now; reset strikes
  // exactly the game's events — the mark is the whole trick, and the founding
  // chronicle is always one Reset away.
  const wargame: WargameActions = {
    state: chronicle.wargame,
    deploy: (seed) => {
      const trimmed = seed.trim();
      if (!trimmed) return null;
      const relay = chronicle.flows.find((f) => f.key === 'move-out-relay') ?? chronicle.flows[0];
      if (!relay) return null;
      // The vendor-dispatch grammar: a share of the typed maintenance work is
      // dealt as walked instances of it (swing two). Absent, every work order
      // is dealt atomically — the game still stands.
      const dispatch = chronicle.flows.find((f) => f.key === 'vendor-dispatch');
      const game = generateWarGame({
        seed: trimmed,
        end: new Date().toISOString(),
        relay,
        dispatch,
        catalog: chronicle.catalog,
        economy: economyOf(chronicle),
        dealt: dealtGame(chronicle.events, trimmed),
      });
      mutate((prev) => ({
        ...prev,
        events: [...prev.events, ...game.events],
        // The month's coin, dealt from the same world (WRIT-ECONOMY, swing three);
        // `wg`-marked so Reset strikes it. A redeploy of a seed that already dealt
        // its money keeps the first deal (no double-count), as `dealt` does for work.
        money: prev.money.some((m) => m.wg === game.seed) ? prev.money : [...prev.money, ...game.money],
        // Load the household so the coffers have teeth — tribute against a real
        // upkeep. Reset strikes exactly these lines (isHouseholdUpkeep).
        treasury: {
          upkeeps: [...prev.treasury.upkeeps.filter((u) => !isHouseholdUpkeep(u)), ...WAR_HOUSEHOLD],
        },
        wargame: {
          seed: game.seed,
          now: game.now,
          deployedAt: new Date().toISOString(),
          tally: game.tally,
          // The door roster rides the muster so the living map can draw the
          // doors standing empty — they carry no case, so no fold finds them.
          doors: game.doors,
        },
      }));
      return game.tally;
    },
    deployCampaign: () => {
      const seed = INTRO_CAMPAIGN.key;
      // A muster may already stand — the grand one, most likely, since it is
      // what the board dealt before the campaign existed. Beginning the campaign
      // then means striking that muster FIRST, in the same breath: two musters
      // dealt over each other share a board and share nothing else, and the
      // player did not ask for a mixture. So this is reset-and-deal as ONE act,
      // and the button says so before it runs.
      //
      // The order matters. A grand muster swaps the catalog and flow book for
      // the reference library and keeps the founding pair in its banner; Reset
      // puts them back. So the campaign must be dealt against the RESTORED
      // books, not the library that is about to be struck — otherwise the
      // holding is dealt from a setting that will not exist a line later.
      const standing = chronicle.wargame?.seed ?? null;
      const oldMark = standing ? `wg/${standing} · ` : null;
      const catalog = chronicle.wargame?.restoreCatalog ?? chronicle.catalog;
      const flows = chronicle.wargame?.restoreFlows ?? chronicle.flows;
      const deal = generateCampaign({
        end: new Date().toISOString(),
        flows,
        catalog,
        kingdom: { ...chronicle.census, ...chronicle.acts },
        seed,
        scenario: INTRO_CAMPAIGN,
        economy: economyOf(chronicle),
        // The standing log, so redeploying does not deal the acts' boxes twice.
        log: chronicle.events,
        dealt: dealtGame(chronicle.events, seed),
      });
      mutate((prev) => {
        const kept = oldMark
          ? prev.events.filter((e) => !e.caseId.includes(oldMark))
          : prev.events;
        const keptMoney = oldMark ? prev.money.filter((m) => m.wg !== standing) : prev.money;
        return {
        ...prev,
        catalog,
        flows,
        events: [...kept, ...deal.events],
        money: keptMoney.some((m) => m.wg === deal.seed) ? keptMoney : [...keptMoney, ...deal.money],
        // The SMALL holding's hall — a sixteen-door company does not carry a
        // two-hundred-door payroll, and if it did the campaign would run red
        // whatever the player does, which teaches nothing (writ §IV). The ids
        // are the war household's, so the existing load and Reset's strike both
        // work on it unchanged.
        treasury: {
          upkeeps: [...prev.treasury.upkeeps.filter((u) => !isHouseholdUpkeep(u)), ...deal.household],
        },
        // A craft left with no head, so the first act has a real decision in it.
        // Removal IS revocation — no new record, a struck one.
        acts: vacateOffices(prev.acts, deal.vacate),
        wargame: {
          seed: deal.seed,
          now: deal.now,
          deployedAt: new Date().toISOString(),
          tally: deal.tally,
          doors: deal.doors,
        },
        };
      });
      return deal.tally;
    },
    deployGrand: async (seed) => {
      const trimmed = seed.trim();
      if (!trimmed) return null;
      // The reference library, fetched on demand (a big book — kept out of the
      // main bundle). Loading it swaps the chronicle's catalog and flows to the
      // full ontology, then the muster deals the whole operation from it.
      const mod = await import('../../data/library/pm-setting.json');
      const setting = (mod as { default?: unknown }).default ?? mod;
      const cat = (setting as { catalog: Catalog }).catalog;
      const flows = (setting as { flows: FlowBook }).flows;
      const plan = (setting as { plan?: unknown }).plan as
        | Parameters<typeof generateGrandMuster>[0]['plan']
        | undefined;
      const game = generateGrandMuster({
        seed: trimmed,
        end: new Date().toISOString(),
        flows,
        catalog: cat,
        plan,
        economy: economyOf(chronicle),
        dealt: dealtGame(chronicle.events, trimmed),
      });
      mutate((prev) => ({
        ...prev,
        catalog: cat,
        flows,
        events: [...prev.events, ...game.events],
        // The month's coin, dealt from the same world (WRIT-ECONOMY, swing three);
        // `wg`-marked so Reset strikes it. A redeploy that already dealt its money
        // keeps the first deal (no double-count), as `dealt` does for the work.
        money: prev.money.some((m) => m.wg === game.seed) ? prev.money : [...prev.money, ...game.money],
        treasury: {
          upkeeps: [...prev.treasury.upkeeps.filter((u) => !isHouseholdUpkeep(u)), ...WAR_HOUSEHOLD],
        },
        wargame: {
          seed: game.seed,
          now: game.now,
          deployedAt: new Date().toISOString(),
          tally: game.tally,
          // The door roster rides the muster so the living map can draw the
          // doors standing empty — they carry no case, so no fold finds them.
          doors: game.doors,
          // Snapshot what stood BEFORE this swap so Reset can restore it — the
          // swap is no longer permanent. Keep the ORIGINAL snapshot across a
          // redeploy (else the second deploy would snapshot the already-swapped
          // library and Reset would restore the library, not founding).
          restoreCatalog: prev.wargame?.restoreCatalog ?? prev.catalog,
          restoreFlows: prev.wargame?.restoreFlows ?? prev.flows,
        },
      }));
      return game.tally;
    },
    advance: (days) => {
      if (!Number.isFinite(days) || days <= 0) return;
      mutate((prev) => {
        if (!prev.wargame) return prev;
        const now = new Date(
          Date.parse(prev.wargame.now) + days * 86_400_000,
        ).toISOString();
        // The rising tide (swing two, 2d) — the one place the clock writes.
        // A case past the crisis threshold with no action spawns ONE
        // escalation case — a habitability alarm, typed and marked like any
        // war case so Reset still strikes it — capped per advance to keep the
        // volume sane. Everything else about consequences is a reading.
        const seed = prev.wargame.seed;
        const mark = `wg/${seed} · `;
        // Build the escalation from the bare `wg/<seed>` mark, never the source
        // case's `<template>: ` prefix — else a crisis on a relay case would
        // read back as a broken relay (readFlows matches the template key at
        // the head of the id). The escalation is its own plain typed case.
        const tide = escalationCandidates(prev.events, now, seed).map((c) => {
          const at2 = c.caseId.indexOf(mark);
          const tail = at2 >= 0 ? c.caseId.slice(at2 + mark.length) : c.caseId;
          return {
            id: crypto.randomUUID(),
            at: now,
            caseId: `wg/${seed} · escalation · ${tail}`,
            kind: 'opened' as const,
            holder: 'pm-desk',
            catalogRow: 'maintenance.escalation.habitability',
            note: `The tide rises — the neglected crisis at the door comes due as a habitability alarm. Owner: ${ownerOf(c)}.`,
          };
        });
        return {
          ...prev,
          events: tide.length ? [...prev.events, ...tide] : prev.events,
          wargame: { ...prev.wargame, now },
        };
      });
    },
    reset: () => {
      const seed = chronicle.wargame?.seed;
      if (!seed) return;
      const mark = `wg/${seed} · `;
      // The mark may sit at the head, or after a flow's `<template>: ` prefix
      // (a relay wraps its subject) — strike the case wherever it bears it.
      mutate((prev) => ({
        ...prev,
        events: prev.events.filter((e) => !e.caseId.includes(mark)),
        // Restore the catalog/flows a grand muster swapped for the library, so
        // Reset truly returns to founding (the swap is undone, not left behind).
        // A plain war game carries no snapshot, so its catalog/flows are left as
        // they stood (it never changed them). `?? prev.*` keeps that invariant.
        catalog: prev.wargame?.restoreCatalog ?? prev.catalog,
        flows: prev.wargame?.restoreFlows ?? prev.flows,
        // Strike the household the game loaded; any hand-recorded upkeep stands.
        treasury: { upkeeps: prev.treasury.upkeeps.filter((u) => !isHouseholdUpkeep(u)) },
        // Strike the money this game dealt (its `wg` mark); hand-recorded money stands.
        money: prev.money.filter((m) => m.wg !== seed),
        wargame: null,
      }));
    },
    runClerks: async (cap = 3) => {
      try {
        const res = await fetch('/api/fleet', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ cap }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          return { ok: false as const, error: body.error ?? `the clerks' desk answered ${res.status}` };
        }
        const data = (await res.json()) as { proposals?: number; swept?: number };
        // The fleet committed its proposals server-side; pull the fresh doc and
        // merge it in against our last-synced base, so both the new `agent:<seat>`
        // proposals and any un-persisted local edit survive (no silent loss).
        const remote = await loadRemote();
        if (remote) {
          rev.current = remote.rev;
          setChronicle((local) => mergeOnConflict(local, remote.chronicle, baseDoc.current));
          baseDoc.current = remote.chronicle;
        }
        return { ok: true as const, proposals: data.proposals ?? 0, swept: data.swept ?? 0 };
      } catch (err) {
        return { ok: false as const, error: (err as Error).message };
      }
    },
  };

  return {
    chronicle,
    persistence: { status: saveStatus, retry: retrySave, failure: saveFailure },
    marches,
    treasury,
    economy,
    court,
    census: censusActions,
    events,
    catalog,
    estates,
    flows,
    regent,
    wargame,
  };
}
