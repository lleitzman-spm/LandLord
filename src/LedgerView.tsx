// The Ledger — the living instrument's surface (docs/KINGDOM.md, "The living
// instrument"). The event log shown plainly, and the readings folded from it:
// what waits on a human, the queues by who-holds-the-ball, and each case's
// aging — none of it stored, all of it computed fresh (events-only). A drill
// from a queue down to the events beneath is the first taste of the drill-path.

import { useEffect, useRef, useState } from 'react';
import type { CatalogActions, EventsActions, FlowsActions } from './store/chronicleStore';
import type { CaseReading, EventKind } from './domain/events';
import {
  ageInDays,
  awaitingHuman,
  casesByCatalogRow,
  clerkProposals,
  outcomes,
  queues,
} from './domain/events';
import type { Catalog, CatalogClass, CatalogMode } from './domain/catalog';
import {
  CLASS_LABEL,
  MODE_MARK,
  PRIORITY_LABEL,
  PRIORITY_MARK,
  SLA_LABEL,
  STATUS_LABEL,
  STATUS_MARK,
  WO_TYPE_LABEL,
  findRow,
  rowsByClass,
  rowsByStatus,
  rowsByWoType,
} from './domain/catalog';
import type { FlowReading, StepReading } from './domain/flows';
import { edgeLine, readFlows } from './domain/flows';
import { readEscape } from './domain/escape';
import { regent } from './domain/states';
import { caseBadge, caseLabel, seatLabel, spendSignal, titleFor } from './domain/caselabel';

/** A step event's note, stripped of its "Step n/N · kind — " machine prefix, so
 *  the Ledger shows just the clerk's (or human's) own words. */
function stepWords(note: string | undefined): string {
  return (note ?? '').replace(/^Step \d+\/\d+ · \w+(?: — )?/, '').trim();
}
import type { Kingdom } from './domain/types';
import { CaseName, Explain, InlineLink } from './components';
import { useDetail } from './detail';
import { useNav } from './nav';

const KINDS: EventKind[] = [
  'opened',
  'handed',
  'noted',
  'done',
  'proposed',
  'awaiting',
  'approved',
  'overridden',
];

const KIND_MARK: Record<EventKind, string> = {
  opened: '○',
  handed: '→',
  noted: '·',
  done: '✓',
  proposed: '✎',
  awaiting: '⏳',
  approved: '✔',
  overridden: '✕',
};

function holderKnown(kingdom: Kingdom, holder: string): boolean {
  return kingdom.people.some((p) => p.id === holder);
}

function holderName(kingdom: Kingdom, holder: string | null | undefined): string {
  if (!holder) return '(unassigned)';
  return kingdom.people.find((p) => p.id === holder)?.name ?? seatLabel(holder);
}

/** An agent actor reads as "<person>'s clerk" when a census person holds the
 *  seat, else "the clerk at <seat>" — the seat's plain name from SEAT_LABEL
 *  (the make-ready yard, the reckoning desk…), never a raw id on the clean
 *  board. A person reads as their name. */
function actorName(kingdom: Kingdom, actor: string | undefined): string | null {
  if (!actor) return null;
  if (actor.startsWith('agent:')) {
    const id = actor.slice(6);
    const person = kingdom.people.find((p) => p.id === id)?.name;
    return person ? `${person}'s clerk` : `the clerk at ${seatLabel(id)}`;
  }
  return kingdom.people.find((p) => p.id === actor)?.name ?? actor;
}

function lastNote(c: CaseReading): string | null {
  for (let i = c.events.length - 1; i >= 0; i--) {
    if (c.events[i].note) return c.events[i].note ?? null;
  }
  return null;
}

/** The catalog tag on an event or case: the key resolved to its title, with
 *  the mode mark when the loaded catalog knows the row. Falls back to the raw
 *  key, never to nothing — an old event's key survives a swapped catalog. */
function Tag({ catalog, row }: { catalog: Catalog; row: string | null | undefined }) {
  if (!row) return null;
  const known = findRow(catalog, row);
  return (
    <span className="tag" title={known?.class ? CLASS_LABEL[known.class] : 'Not in the loaded catalog'}>
      {known?.mode && <span className="tag-mode">{MODE_MARK[known.mode]} </span>}
      {titleFor(catalog, row)}
    </span>
  );
}

/** The WO Status / SLA chips for a case — the same read as the Priority pill
 *  (caseBadge, domain/caselabel.ts) folded a step further. A sibling to
 *  CaseName rather than inside it (CaseName lives in components.tsx, out of
 *  this lane's surface) but wears the identical pill dress, so a card reads
 *  as one family: glyph, chip, priority, then status, then the SLA clock. */
function WoChips({
  caseId,
  catalog,
  kind,
}: {
  caseId: string;
  catalog: Catalog;
  kind?: string | null;
}) {
  const b = caseBadge(caseLabel(caseId, catalog), catalog, kind);
  if (!b.status && !b.slaBand) return null;
  return (
    <>
      {b.status && (
        <span className={`cn-status status-${b.status}`} title={`${STATUS_LABEL[b.status]} — WO status`}>
          {STATUS_MARK[b.status]} {STATUS_LABEL[b.status]}
        </span>
      )}
      {b.slaBand && (
        <span className="cn-sla" title="SLA — target-response band">
          {SLA_LABEL[b.slaBand]}
        </span>
      )}
    </>
  );
}

interface Props {
  events: EventsActions;
  catalog: CatalogActions;
  flows: FlowsActions;
  kingdom: Kingdom;
  /** The clock the readings fold against: game-now while a War Game stands,
   *  the wall clock otherwise — threaded in from App so the whole court
   *  tells one time. */
  now: string;
  /** A flow case a road asked the Ledger to open and scroll to (law 6: the
   *  reading was a road to the step in hand). */
  focusCase?: string;
}

/** A hand named on the Ledger — a door to that person when the census knows
 *  them, their plain name otherwise (a queue is a seat, not someone to open).
 *  Edwin, 2026-07-27: every displayed piece should be directly interactive. */
function Hand({ kingdom, holder }: { kingdom: Kingdom; holder: string | null | undefined }) {
  const nav = useNav();
  if (!holder) return null;
  const name = holderName(kingdom, holder);
  return holderKnown(kingdom, holder) ? (
    <InlineLink onClick={() => nav.goToPerson(holder)}>{name}</InlineLink>
  ) : (
    <>{name}</>
  );
}

export default function LedgerView({ events, catalog, flows, kingdom, now, focusCase }: Props) {
  const nav = useNav();
  const detail = useDetail();
  const log = events.log;
  const rows = catalog.rows;
  const qs = queues(log);
  const awaiting = awaitingHuman(log);
  const byType = casesByCatalogRow(log);
  const o = outcomes(log, now);
  const stew = regent(kingdom);
  const onRegent = stew ? (qs.find((q) => q.holder === stew.id)?.cases.length ?? 0) : 0;
  const feed = [...log].sort((a, b) => (a.at < b.at ? 1 : -1)); // newest first
  const parked = clerkProposals(log).filter((p) => p.awaiting);
  const live = readFlows(flows.flows, log, now);
  const escape = readEscape(flows.flows, catalog.rows, log);
  // Which case the cascade list opens on. It arrives from a road outside the
  // Ledger (nav.goToLedger(caseId)) but must also be settable from INSIDE it —
  // a proposal you can read and cannot open is information with no road to the
  // act on it. Edwin, 2026-07-27: *"in The Ledger I'm unable to click directly
  // on the proposals or anything within the list."* (See the A/E/P check in
  // CLAUDE.md.)
  //
  // The focus carries a TICK as well as an id. Setting the same id twice is a
  // React no-op, so once a row had been opened and then collapsed by hand, its
  // door was dead forever — press it again and nothing happened, because
  // `focused` never changed and the effect that opens and scrolls the cascade
  // never re-fired. (My own bug, introduced with these doors this session and
  // caught by an audit driving the browser, 2026-07-27. A door that works once
  // is still a dead button on the second press.)
  const [focus, setFocus] = useState<{ id?: string; tick: number }>({ id: focusCase, tick: 0 });
  useEffect(() => setFocus((f) => ({ id: focusCase, tick: f.tick + 1 })), [focusCase]);
  // A row is only a door where there is a cascade behind it to open. A door
  // that leads nowhere is the fault we are fixing, not a second copy of it.
  const cascades = new Set(live.map((r) => r.caseId));
  const openCase = (caseId: string) =>
    cascades.has(caseId) && setFocus((f) => ({ id: caseId, tick: f.tick + 1 }));

  return (
    <section>
      <header className="banner banner-ledger">
        <h2>The Ledger</h2>
        <p className="explain">
          The living instrument's spine: every act on the real work, recorded once. Work items,
          queues, and aging are all read from this log — none of it stored. Records in, readings
          out.
        </p>
      </header>

      <div className="kpis">
        <Kpi n={o.open} label="Open work" />
        <Kpi n={o.awaiting} label="Awaiting a human" tone={o.awaiting > 0 ? 'amber' : undefined} />
        <Kpi
          n={o.stuck}
          label={o.oldestDays ? `Stuck · oldest ${o.oldestDays}d` : 'Stuck > 7d'}
          tone={o.stuck > 0 ? 'amber' : undefined}
        />
        <Kpi n={onRegent} label="On the Regent" tone={onRegent > 0 ? 'red' : undefined} />
        <Kpi
          n={parked.length}
          label="Clerks' proposals"
          tone={parked.length > 0 ? 'amber' : undefined}
        />
        <Kpi n={o.doneRecently} label="Done · 7d" tone={o.doneRecently > 0 ? 'green' : undefined} />
      </div>

      <EscapeBand escape={escape} />

      {parked.length > 0 && (
        <div className="card clerk-card">
          <h3>
            The clerks' proposals <span className="count count-amber">{parked.length}</span>
          </h3>
          <Explain>
            What the fleet parked for your word. Each clerk reasoned as far as it could and
            stopped — it proposes, you ratify. Nothing here has been acted on.
          </Explain>
          <ul className="desk-list">
            {parked.map((p) => {
              const door = cascades.has(p.caseId);
              return (
                <li key={p.caseId} className="clerk-prop">
                  <span className="ledger-mark ledger-prop">📜</span>
                  <span className="ledger-body">
                    <span className="clerk-seat">{actorName(kingdom, `agent:${p.seat}`)}</span>{' '}
                    {door ? (
                      <button
                        type="button"
                        className="rowdoor"
                        onClick={() => openCase(p.caseId)}
                        title="Open the cascade and ratify the step in hand"
                      >
                        <CaseName
                          caseId={p.caseId}
                          catalog={rows}
                          card
                          kind={p.catalogRow ?? undefined}
                        />
                      </button>
                    ) : (
                      <CaseName
                        caseId={p.caseId}
                        catalog={rows}
                        card
                        kind={p.catalogRow ?? undefined}
                      />
                    )}
                    {p.note && <span className="clerk-note">{p.note}</span>}
                  </span>
                  {door && (
                    <button
                      type="button"
                      className="rowgo"
                      onClick={() => openCase(p.caseId)}
                      title="Open the cascade and ratify the step in hand"
                    >
                      ratify →
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <LogForm events={events} kingdom={kingdom} catalog={rows} />

      <FlowsCard
        flows={flows}
        live={live}
        kingdom={kingdom}
        catalog={rows}
        focusCase={focus.id}
        focusTick={focus.tick}
      />

      <CatalogCard catalog={catalog} />

      <div className="card await-card">
        <h3>
          Awaiting a human{' '}
          {awaiting.length > 0 && <span className="count count-amber">{awaiting.length}</span>}
        </h3>
        <Explain>
          Where a clerk did what it could and stopped for a judgment — proposed, and waiting.
        </Explain>
        {awaiting.length === 0 ? (
          <p className="fine">Nothing waits on a human.</p>
        ) : (
          <ul className="desk-list">
            {awaiting.map((c) => {
              const door = cascades.has(c.caseId);
              return (
                <li key={c.caseId}>
                  <span className="ledger-mark ledger-out">⏳</span>
                  <span className="ledger-body">
                    {door ? (
                      <button
                        type="button"
                        className="rowdoor"
                        onClick={() => openCase(c.caseId)}
                        title="Open the cascade and act on the step in hand"
                      >
                        <CaseName caseId={c.caseId} catalog={rows} card kind={c.catalogRow} />
                      </button>
                    ) : (
                      <CaseName caseId={c.caseId} catalog={rows} card kind={c.catalogRow} />
                    )}{' '}
                    <WoChips caseId={c.caseId} catalog={rows} kind={c.catalogRow} />{' '}
                    <span className="fine">
                      · <Hand kingdom={kingdom} holder={c.holder} />
                    </span>
                  </span>
                  {door ? (
                    <button
                      type="button"
                      className="rowgo"
                      onClick={() => openCase(c.caseId)}
                      title="Open the cascade and act on the step in hand"
                    >
                      open →
                    </button>
                  ) : (
                    // A case can await a human WITHOUT a cascade behind it —
                    // the muster deals standalone waits (a promise to pay, say).
                    // Those rows had no door and no act, so the matter could
                    // never be answered: it sat on the Court's docket forever
                    // and kept inflating the rail's count, and the docket's own
                    // "→" led to this row, which offered nothing. A wait that
                    // cannot be ended is not a wait, it is a leak.
                    // (Audit, 2026-07-27.)
                    <button
                      type="button"
                      className="rowgo"
                      onClick={() =>
                        events.record({
                          caseId: c.caseId,
                          kind: 'done',
                          holder: c.holder ?? undefined,
                          catalogRow: c.catalogRow ?? undefined,
                          note: 'settled by the Regent',
                        })
                      }
                      title="Give the judgment this waits on and close it"
                    >
                      settle →
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="card">
        <h3>Queues — who holds the ball</h3>
        <Explain>
          The Regent's desk, generalized: open work by who has it, oldest first. The fullest
          queues and the most-aged cases are the delegation debt of the real work.
        </Explain>
        {qs.length === 0 ? (
          <p className="fine">No open work.</p>
        ) : (
          qs.map((q) => (
            <div key={q.holder} className="queue">
              <h4>
                {holderKnown(kingdom, q.holder) ? (
                  <InlineLink onClick={() => nav.goToPerson(q.holder)}>
                    {holderName(kingdom, q.holder)}
                  </InlineLink>
                ) : (
                  holderName(kingdom, q.holder)
                )}{' '}
                <span className="count count-amber">{q.cases.length}</span>
              </h4>
              <ul className="desk-list">
                {q.cases
                  .slice()
                  .sort((a, b) => (a.lastAt ?? '').localeCompare(b.lastAt ?? '')) // oldest first
                  .map((c) => (
                    <CaseRow
                      key={c.caseId}
                      c={c}
                      kingdom={kingdom}
                      catalog={rows}
                      now={now}
                      onOpen={cascades.has(c.caseId) ? () => openCase(c.caseId) : undefined}
                    />
                  ))}
              </ul>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <h3>By task-type — the catalog in use</h3>
        <Explain>
          Open work grouped by the task-type it is an instance of. The event log references the
          loaded catalog; this reading folds it back the other way.
        </Explain>
        {byType.length === 0 ? (
          <p className="fine">No open work to type.</p>
        ) : (
          <ul className="desk-list">
            {byType.map((b) => (
              <li key={b.catalogRow ?? '(untyped)'}>
                <span className="ledger-body">
                  {b.catalogRow ? (
                    <Tag catalog={rows} row={b.catalogRow} />
                  ) : (
                    <span className="fine">Untyped — no catalog row</span>
                  )}
                  {detail && (
                    <span className="fine"> {b.cases.map((c) => c.caseId).join(', ')}</span>
                  )}
                </span>
                <span className="count count-amber">{b.cases.length}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3>
          The ledger <span className="count">{log.length}</span>
        </h3>
        {log.length === 0 ? (
          <p className="fine">No events yet. Record the first act of real work above.</p>
        ) : (
          <ul className="desk-list">
            {feed.map((e) => (
              <li key={e.id}>
                <span className="ledger-mark ledger-out">{KIND_MARK[e.kind] ?? '·'}</span>
                <span className="ledger-body">
                  <span className="kind">{e.kind}</span>
                  <CaseName caseId={e.caseId} catalog={rows} kind={e.catalogRow} />
                  {e.holder && (
                    <span className="fine">
                      {' '}
                      → <Hand kingdom={kingdom} holder={e.holder} />
                    </span>
                  )}
                  {detail && e.note && <span className="fine"> — {e.note}</span>}
                  {detail && actorName(kingdom, e.actor) && (
                    <span className="fine"> · by {actorName(kingdom, e.actor)}</span>
                  )}
                  <span className="fine"> · {e.at.slice(0, 10)}</span>
                </span>
                <button className="rowbtn" onClick={() => events.strike(e.id)}>
                  Strike
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}


/** THE ESCAPE RATE — what share of work reached a human.
 *
 *  It sits apart from the KPI tiles rather than among them, and that is deliberate:
 *  it is not one measure of six, it is the one the whole product is judged against,
 *  and it carries two things a tile cannot hold — the split between escapes the flow
 *  book INTENDED and escapes that mean the machine failed, and an honest note about
 *  how much evidence the number rests on.
 *
 *  It names the leaking steps rather than only the total, because a rate with no
 *  road is a count you cannot act on. Nothing here is a link: the reading knows which
 *  STEP leaks, not which case to open, and a control whose only feedback is
 *  invisible is the fault this band exists to avoid. */
function EscapeBand({ escape }: { escape: ReturnType<typeof readEscape> }) {
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const leaks = escape.byStep.filter((l) => l.unplanned > 0).slice(0, 4);
  return (
    <div className="card">
      <h3>Escape rate</h3>
      {escape.rate === null ? (
        <>
          <p className="num-lg">NOT MEASURED</p>
          <p className="fine">
            No step has been reached yet. This reads as <em>not measured</em> rather than 0%,
            because a rate over no work would look like perfect automation on a system that has
            done nothing.
          </p>
        </>
      ) : (
        <>
          <p className="num-lg">{pct(escape.rate)}</p>
          <p className="fine">
            {escape.escaped} of {escape.stepsReached} steps reached a person —{' '}
            <strong>{escape.designed} by design</strong> (a judgment the flow book means to keep
            human) and <strong>{escape.unplanned} unplanned</strong> (a step marked automatic that
            somebody had to touch anyway). The second number is the one to drive down; the first is
            the ceiling the flow book set before any case was worked.
          </p>
        </>
      )}
      {escape.unmeasured > 0 && (
        <p className="fine">
          {escape.unmeasured} reached step{escape.unmeasured === 1 ? '' : 's'} declare no mode in
          the catalog and are excluded from the figures above — a denominator padded with unknowns
          is how a rate flatters itself.
        </p>
      )}
      {escape.inheritedSteps > 0 && (
        <p className="fine">
          Resting on {escape.judgments} independent judgment{escape.judgments === 1 ? '' : 's'}:{' '}
          {escape.inheritedSteps} step{escape.inheritedSteps === 1 ? '' : 's'} inherit their
          classification from a catalog row they share with another, so the step count overstates
          the evidence.
        </p>
      )}
      {leaks.length > 0 && (
        <>
          <h4>Where it leaks</h4>
          <ul className="fine">
            {leaks.map((l) => (
              <li key={l.key}>
                <code>{l.key}</code> — {l.unplanned} of {l.reached} reached
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Kpi({ n, label, tone }: { n: number; label: string; tone?: 'amber' | 'red' | 'green' }) {
  return (
    <div className={`kpi${tone ? ` kpi-${tone}` : ''}`}>
      <span className="num">{n}</span>
      <span className="lbl">{label}</span>
    </div>
  );
}

function CaseRow({
  c,
  kingdom,
  catalog,
  now,
  onOpen,
}: {
  c: CaseReading;
  kingdom: Kingdom;
  catalog: Catalog;
  now: string;
  /** Given when a cascade stands behind this case: the road from reading the
   *  queue to ACTING on the case. Drilling into the events shows what happened;
   *  it is not the same thing as being able to do the next step. */
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const detail = useDetail();
  const age = ageInDays(c, now);
  return (
    <li>
      {onOpen && (
        <button
          type="button"
          className="rowgo rowgo-lead"
          onClick={onOpen}
          title="Open the cascade and act on the step in hand"
        >
          act →
        </button>
      )}
      <span className="ledger-body">
        <span
          className="case-row"
          onClick={() => setOpen(!open)}
          title="Drill down to the events beneath"
        >
          {open ? '▾ ' : '▸ '}
          <CaseName caseId={c.caseId} catalog={catalog} card kind={c.catalogRow} />
          <WoChips caseId={c.caseId} catalog={catalog} kind={c.catalogRow} />
        </span>{' '}
        {age !== null && (
          <span className={age >= 7 ? 'age age-old' : 'age'}>
            {age === 0 ? 'today' : `${age}d`}
          </span>
        )}
        {detail && lastNote(c) && <span className="fine"> — {lastNote(c)}</span>}
        {open && (
          <div className="case-drill">
            <ul className="desk-list">
              {c.events.map((e) => (
                <li key={e.id}>
                  <span className="ledger-body">
                    <span className="kind">{e.kind}</span>
                    {e.holder && (
                      <span className="fine">
                        → <Hand kingdom={kingdom} holder={e.holder} />{' '}
                      </span>
                    )}
                    {e.note && <span className="fine">— {e.note} </span>}
                    <span className="fine">· {e.at.slice(0, 10)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </span>
    </li>
  );
}

function LogForm({
  events,
  kingdom,
  catalog,
}: {
  events: EventsActions;
  kingdom: Kingdom;
  catalog: Catalog;
}) {
  const [caseId, setCaseId] = useState('');
  const [kind, setKind] = useState<EventKind>('opened');
  const [holder, setHolder] = useState('');
  const [catalogRow, setCatalogRow] = useState('');
  const [note, setNote] = useState('');
  const groups = rowsByClass(catalog);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseId.trim()) return;
    events.record({
      caseId,
      kind,
      holder: holder || undefined,
      catalogRow: catalogRow || undefined,
      note,
    });
    setNote(''); // keep case/kind/holder to record a run of events on one case
  };

  return (
    <div className="card">
      <h3>Record an event</h3>
      <form className="arrival-form act-form" onSubmit={submit}>
        <input
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          placeholder="Case (e.g. Willow Creek turn)"
          aria-label="Case"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as EventKind)}
          aria-label="Kind"
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <select value={holder} onChange={(e) => setHolder(e.target.value)} aria-label="Holder">
          <option value="">(unassigned)</option>
          {kingdom.people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={catalogRow}
          onChange={(e) => setCatalogRow(e.target.value)}
          aria-label="Catalog row"
        >
          <option value="">(no task-type)</option>
          {groups.map((g) => (
            <optgroup key={g.class ?? 'unclassed'} label={g.class ? CLASS_LABEL[g.class] : 'Other'}>
              {g.rows.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.mode ? `${MODE_MARK[r.mode]} ` : ''}
                  {r.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          aria-label="Note"
        />
        <button type="submit" disabled={!caseId.trim()}>
          Record
        </button>
      </form>
      <Explain>
        The task-type is drawn from the loaded catalog below — LandLord holds the mechanism, a
        factory setting loads the rows. A clerk's proposal is kind <em>proposed</em>; your
        ratification, <em>approved</em> or <em>overridden</em>.
      </Explain>
    </div>
  );
}

/** A mark for where a step of a cascade stands, folded from the event kinds
 *  the log already knows — the seam the clerks grip in swing two. */
const STEP_MARK: Record<string, string> = {
  handed: '→',
  noted: '·',
  proposed: '✎',
  awaiting: '⏳',
  approved: '✔',
  overridden: '✕',
  done: '✓',
};

function stepMark(s: StepReading): string {
  if (s.breached) return '⚠';
  return s.kind ? (STEP_MARK[s.kind] ?? '·') : '○';
}

function FlowInstanceCard({
  r,
  flows,
  kingdom,
  catalog,
  focused,
  focusTick,
}: {
  r: FlowReading;
  flows: FlowsActions;
  kingdom: Kingdom;
  catalog: Catalog;
  /** True when a road led here to this very case — open it and scroll it in. */
  focused?: boolean;
  /** Changes on every focus request, so a second press of the same door still
   *  re-opens the cascade the reader had collapsed by hand. */
  focusTick?: number;
}) {
  const [open, setOpen] = useState(Boolean(focused));
  const nav = useNav();
  const detail = useDetail();
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (focused) {
      setOpen(true);
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focused, focusTick]);
  // The state tail, tight by default: the count and whose hand is next. The
  // full phrasing rides in the tooltip and reveals in detail mode.
  const nextSeat =
    r.next && r.status !== 'done' ? holderName(kingdom, r.next.step.holder) : null;
  const nextHolder = r.next?.step.holder ?? null;
  const fullTail = [
    `${r.template.title} · ${r.advanced}/${r.steps.length} steps run`,
    nextSeat ? `next: ${titleFor(catalog, r.next!.step.catalogRow)} → ${nextSeat}` : null,
    r.status === 'done' ? 'done' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <li ref={ref} className={focused ? 'flow-focused' : undefined}>
      <span className="ledger-body">
        <span className="case-row" onClick={() => setOpen(!open)} title="Drill into the cascade">
          {open ? '▾ ' : '▸ '}
          <CaseName caseId={r.subject} catalog={catalog} card />
        </span>{' '}
        {detail ? (
          <span className="fine">— {fullTail}</span>
        ) : (
          <span className="fine flow-tail" title={fullTail}>
            {r.advanced}/{r.steps.length}
            {nextSeat && (
              <>
                {' '}
                · next:{' '}
                {nextHolder && holderKnown(kingdom, nextHolder) ? (
                  <InlineLink onClick={() => nav.goToPerson(nextHolder)}>{nextSeat}</InlineLink>
                ) : (
                  nextSeat
                )}
              </>
            )}
            {r.status === 'done' && ' · done'}
          </span>
        )}
        {r.breached.length > 0 && (
          <span className="age age-old" title={`${r.breached.length} timing edge(s) breached`}>
            {' '}
            · ⚠ {r.breached.length}
          </span>
        )}
        {open && (
          <div className="case-drill">
            {r.boards.map((b) => (
              <div key={b.board} className="flow-board">
                <h4>{b.board}</h4>
                <ul className="desk-list">
                  {b.steps.map((s) => {
                    // The operator's hands (law 6): the acts stand beside the
                    // step in hand, and only it — each click appends one
                    // event and the readings recompute around it.
                    const inHand = r.next?.step.key === s.step.key;
                    const stepIx = s.index - 1; // StepReading.index is 1-based
                    const canRatify = s.kind === 'awaiting' || s.kind === 'proposed';
                    const canActAfterOverride = s.kind === 'overridden';
                    return (
                      <li key={s.step.key}>
                        <span className={`ledger-mark ${s.breached ? 'ledger-away' : 'ledger-out'}`}>
                          {stepMark(s)}
                        </span>
                        <span className="ledger-body">
                          <span className="kind">step {s.index}</span>
                          <Tag catalog={catalog} row={s.step.catalogRow} />{' '}
                          <span className="fine">
                            → <Hand kingdom={kingdom} holder={s.step.holder} />
                          </span>{' '}
                          <span className="fine">· {edgeLine(s.step.edge)}</span>
                          {s.step.repeatEveryDays != null && (
                            <span className="fine">
                              {' '}
                              · repeats every {s.step.repeatEveryDays}d {s.step.condition ?? ''}
                            </span>
                          )}
                          {s.dueInDays != null && s.dueInDays > 0 && (
                            <span className="fine"> · due in {s.dueInDays}d</span>
                          )}
                          {s.breached && <span className="age age-old"> · breached</span>}
                          {(s.kind === 'proposed' || s.actor?.startsWith('agent:')) && (
                            <span className="flow-proposal">
                              {actorName(kingdom, s.actor) && (
                                <span className="flow-by">{actorName(kingdom, s.actor)}</span>
                              )}
                              {(() => {
                                const sig = spendSignal(s.note);
                                return sig ? (
                                  <span className={`gate-chip gate-${sig.tone}`}>{sig.label}</span>
                                ) : null;
                              })()}
                              {stepWords(s.note) && (
                                <span className="fine flow-note">{stepWords(s.note)}</span>
                              )}
                            </span>
                          )}
                        </span>
                        {inHand && r.status !== 'done' && (
                          <span className="flow-acts">
                            {(canRatify || canActAfterOverride) && (
                              <button
                                className="rowbtn"
                                onClick={() =>
                                  flows.approve(r.template.key, r.caseId, stepIx)
                                }
                              >
                                Approve
                              </button>
                            )}
                            {canRatify && (
                              <button
                                className="rowbtn danger"
                                onClick={() => {
                                  const why = window.prompt(
                                    'The override — what did you choose instead?',
                                  );
                                  if (why == null) return;
                                  flows.override(r.template.key, r.caseId, stepIx, why);
                                }}
                              >
                                Override
                              </button>
                            )}
                            <button
                              className="rowbtn"
                              onClick={() => flows.markDone(r.template.key, r.caseId, stepIx)}
                            >
                              Mark done
                            </button>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </span>
    </li>
  );
}

/** The flow card: trigger a cascade from the loaded templates, and watch the
 *  live instances fold back from the log — steps across their boards and
 *  holders with their timing, none of it stored. */
function FlowsCard({
  flows,
  live,
  kingdom,
  catalog,
  focusCase,
  focusTick,
}: {
  flows: FlowsActions;
  live: FlowReading[];
  kingdom: Kingdom;
  catalog: Catalog;
  focusCase?: string;
  /** Bumped on every focus request, so asking for the SAME case twice still
   *  re-opens and re-scrolls it instead of being a silent no-op. */
  focusTick?: number;
}) {
  const [flowKey, setFlowKey] = useState(flows.flows[0]?.key ?? '');
  const [subject, setSubject] = useState('');
  const tpl = flows.flows.find((f) => f.key === flowKey);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!flowKey || !subject.trim()) return;
    flows.trigger(flowKey, subject);
    setSubject('');
  };

  return (
    <div className="card">
      <h3>
        The flows <span className="count">{flows.flows.length}</span>
        {live.length > 0 && <span className="count count-amber">{live.length} live</span>}
      </h3>
      <Explain>
        Cascades expressed from loaded config — a trigger fans out into steps across holders and
        boards, with timing edges, waits, and loops. Triggering one opens a case and emits its
        steps as events; everything below folds back from that log. Nothing here is hardwired: a
        factory setting pours in its own relays at the gate.
      </Explain>
      {flows.flows.length === 0 ? (
        <p className="fine">No flow templates are loaded.</p>
      ) : (
        <form className="arrival-form act-form" onSubmit={submit}>
          <select
            value={flowKey}
            onChange={(e) => setFlowKey(e.target.value)}
            aria-label="Flow template"
          >
            {flows.flows.map((f) => (
              <option key={f.key} value={f.key}>
                {f.title} — {f.steps.length} steps
              </option>
            ))}
          </select>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject (e.g. Willow Creek unit 4)"
            aria-label="Subject"
          />
          <button type="submit" disabled={!subject.trim() || !tpl}>
            Trigger the flow
          </button>
        </form>
      )}
      {tpl && (
        <Explain>
          <em>{tpl.trigger}</em> → {tpl.steps.length} steps ·{' '}
          {[...new Set(tpl.steps.map((s) => s.holder))].length} hands ·{' '}
          {[...new Set(tpl.steps.map((s) => s.board))].length} boards (
          {[...new Set(tpl.steps.map((s) => s.board))].join(' → ')}).
        </Explain>
      )}
      {live.length > 0 && (
        <ul className="desk-list">
          {live.map((r) => (
            <FlowInstanceCard
              key={r.caseId}
              r={r}
              flows={flows}
              kingdom={kingdom}
              catalog={catalog}
              focused={focusCase != null && r.caseId === focusCase}
              focusTick={focusTick}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CatalogCard({ catalog }: { catalog: CatalogActions }) {
  const detail = useDetail();
  const [key, setKey] = useState('');
  const [title, setTitle] = useState('');
  const [cls, setCls] = useState<'' | CatalogClass>('');
  const [mode, setMode] = useState<'' | CatalogMode>('');
  // How the rows fold: by class (the founding split, Run/Acquire/Firm), by
  // work-order Type (the Lane-B taxonomy — internal / resident / unit-turn,
  // each in hottest-first Priority order), or by WO Status (the lifecycle arc,
  // new → closed). The Type and Status views show only the words that are
  // work orders; the rest carry no such facet and simply do not appear.
  const [groupBy, setGroupBy] = useState<'class' | 'type' | 'status'>('class');
  const groups = rowsByClass(catalog.rows);
  const woGroups = rowsByWoType(catalog.rows);
  const statusGroups = rowsByStatus(catalog.rows);
  const nonWoCount = catalog.rows.length - woGroups.reduce((n, g) => n + g.rows.length, 0);
  const noStatusCount = catalog.rows.length - statusGroups.reduce((n, g) => n + g.rows.length, 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || !title.trim()) return;
    catalog.add({
      key: key.trim(),
      title: title.trim(),
      class: cls || undefined,
      mode: mode || undefined,
    });
    setKey('');
    setTitle('');
    setCls('');
    setMode('');
  };

  return (
    <div className="card">
      <h3>
        The catalog <span className="count">{catalog.rows.length}</span>
        <span className="cat-groupby" role="group" aria-label="Group the catalog by">
          <button
            className={groupBy === 'class' ? 'on' : ''}
            onClick={() => setGroupBy('class')}
            aria-pressed={groupBy === 'class'}
          >
            By class
          </button>
          <button
            className={groupBy === 'type' ? 'on' : ''}
            onClick={() => setGroupBy('type')}
            aria-pressed={groupBy === 'type'}
          >
            By type
          </button>
          <button
            className={groupBy === 'status' ? 'on' : ''}
            onClick={() => setGroupBy('status')}
            aria-pressed={groupBy === 'status'}
          >
            By status
          </button>
        </span>
      </h3>
      <Explain>
        The task-type ontology every event references. A loadable book — a factory setting pours
        in its rows at the gate; here the working-fluid founding rows stand. <span className="tag-mode">⚙</span> runs by the
        machine, <span className="tag-mode">◆</span> by a human hand.{' '}
        {groupBy === 'type'
          ? 'By type folds the work orders by the platform’s own field — internal upkeep, a resident’s request, a unit turn — each in hottest-first Priority order.'
          : groupBy === 'status'
            ? 'By status folds the work orders by the lifecycle arc the system of record walks them through, new to closed.'
            : 'By class folds the founding split — Run, Acquire, Firm.'}
      </Explain>
      {catalog.rows.length === 0 ? (
        <p className="fine">The catalog is empty. No setting is loaded.</p>
      ) : groupBy === 'class' ? (
        groups.map((g) => (
          <div key={g.class ?? 'unclassed'} className="cat-group">
            <h4>{g.class ? CLASS_LABEL[g.class] : 'Other'}</h4>
            <ul className="desk-list">
              {g.rows.map((r) => (
                <li key={r.key}>
                  <span className="ledger-body">
                    {r.mode && <span className="tag-mode">{MODE_MARK[r.mode]} </span>}
                    <strong>{r.title}</strong>
                    {detail && <span className="fine"> · {r.key}</span>}
                    {detail && r.note && <span className="fine"> — {r.note}</span>}
                  </span>
                  <button className="rowbtn" onClick={() => catalog.strike(r.key)}>
                    Strike
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      ) : groupBy === 'type' ? (
        woGroups.length === 0 ? (
          <p className="fine">
            No work orders in the loaded catalog — no row carries a Type. The setting’s real
            work-order words load at the gate.
          </p>
        ) : (
          <>
            {woGroups.map((g) => (
              <div key={g.woType} className="cat-group">
                <h4>
                  {WO_TYPE_LABEL[g.woType]} <span className="count">{g.rows.length}</span>
                </h4>
                <ul className="desk-list">
                  {g.rows.map((r) => (
                    <li key={r.key}>
                      <span className="ledger-body">
                        {r.mode && <span className="tag-mode">{MODE_MARK[r.mode]} </span>}
                        <strong>{r.title}</strong>
                        {r.priority && (
                          <span
                            className={`cn-pri pri-${r.priority}`}
                            title={`${PRIORITY_LABEL[r.priority]} priority`}
                          >
                            {PRIORITY_MARK[r.priority]} {PRIORITY_LABEL[r.priority]}
                          </span>
                        )}
                        {r.status && (
                          <span
                            className={`cn-status status-${r.status}`}
                            title={`${STATUS_LABEL[r.status]} — WO status`}
                          >
                            {STATUS_MARK[r.status]} {STATUS_LABEL[r.status]}
                          </span>
                        )}
                        {r.slaBand && (
                          <span className="cn-sla" title="SLA — target-response band">
                            {SLA_LABEL[r.slaBand]}
                          </span>
                        )}
                        {detail && <span className="fine"> · {r.key}</span>}
                        {detail && r.note && <span className="fine"> — {r.note}</span>}
                      </span>
                      <button className="rowbtn" onClick={() => catalog.strike(r.key)}>
                        Strike
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {nonWoCount > 0 && (
              <p className="fine">
                {nonWoCount} {nonWoCount === 1 ? 'row is' : 'rows are'} not work orders — they
                carry no Type. Fold <em>by class</em> to see them.
              </p>
            )}
          </>
        )
      ) : statusGroups.length === 0 ? (
        <p className="fine">
          No work orders carry a Status in the loaded catalog. The setting’s real work-order
          words load at the gate.
        </p>
      ) : (
        <>
          {statusGroups.map((g) => (
            <div key={g.status} className="cat-group">
              <h4>
                {STATUS_MARK[g.status]} {STATUS_LABEL[g.status]}{' '}
                <span className="count">{g.rows.length}</span>
              </h4>
              <ul className="desk-list">
                {g.rows.map((r) => (
                  <li key={r.key}>
                    <span className="ledger-body">
                      {r.mode && <span className="tag-mode">{MODE_MARK[r.mode]} </span>}
                      <strong>{r.title}</strong>
                      {r.priority && (
                        <span
                          className={`cn-pri pri-${r.priority}`}
                          title={`${PRIORITY_LABEL[r.priority]} priority`}
                        >
                          {PRIORITY_MARK[r.priority]} {PRIORITY_LABEL[r.priority]}
                        </span>
                      )}
                      {r.slaBand && (
                        <span className="cn-sla" title="SLA — target-response band">
                          {SLA_LABEL[r.slaBand]}
                        </span>
                      )}
                      {detail && <span className="fine"> · {r.key}</span>}
                      {detail && r.note && <span className="fine"> — {r.note}</span>}
                    </span>
                    <button className="rowbtn" onClick={() => catalog.strike(r.key)}>
                      Strike
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {noStatusCount > 0 && (
            <p className="fine">
              {noStatusCount} {noStatusCount === 1 ? 'row carries' : 'rows carry'} no Status. Fold{' '}
              <em>by class</em> to see them.
            </p>
          )}
        </>
      )}
      <form className="arrival-form act-form" onSubmit={submit}>
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Key (e.g. rent-post)"
          aria-label="Catalog key"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          aria-label="Catalog title"
        />
        <select
          value={cls}
          onChange={(e) => setCls(e.target.value as '' | CatalogClass)}
          aria-label="Class"
        >
          <option value="">(no class)</option>
          <option value="run">Run</option>
          <option value="acq">Acquire</option>
          <option value="firm">Firm</option>
        </select>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as '' | CatalogMode)}
          aria-label="Mode"
        >
          <option value="">(no mode)</option>
          <option value="human">◆ Human</option>
          <option value="auto">⚙ Auto</option>
        </select>
        <button type="submit" disabled={!key.trim() || !title.trim()}>
          Add row
        </button>
      </form>
    </div>
  );
}
