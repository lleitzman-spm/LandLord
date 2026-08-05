// The fief's own page — administer one territory: who holds it (grant a
// lord, appoint a keeper), its vassals and garrison, its hamlets, graduation,
// upkeep, and what the Marches rode out to it. Extracted whole from the old
// App shell when the War Table absorbed it (docs/HANDOFF, shell-absorption);
// it now renders inside a wide War Table panel, unchanged in substance.

import { useState } from 'react';
import { appointable, grantable, swearable } from './domain/court';
import { FIEF_STATE_LABEL, HAMLET_STATE_LABEL } from './domain/states';
import type { FiefReading, HamletReading } from './domain/states';
import type { FiefState, Kingdom } from './domain/types';
import type { ArrivalReading } from './domain/marches';
import type { UpkeepLine } from './domain/treasury';
import { coin, monthlyOf } from './domain/treasury';
import type { CourtActions } from './store/chronicleStore';
import { ActForm, Explain, InlineLink, PersonChip, StateDot } from './components';
import { useDetail } from './detail';
import { useNav } from './nav';

const STATE_EXPLANATION: Record<FiefState, string> = {
  lorded: 'An internal vassal holds this fief by explicit grant. Healthy.',
  plurality:
    'Its lord holds several fiefs, each by explicit grant. Legitimate and historically normal. Watched, not flagged.',
  regency:
    'No vassal lord. An appointed keeper — an artisan — keeps the castle day-to-day. The work gets done, but by foreign hands.',
  stewardship:
    'No grant, no appointment, nothing recorded. By the ruling of 2026-07-17 this falls to the Regent — not as a holding, but as a thing that needs delegating.',
};

/** A card of service records — fealty sworn or artisans stationed —
 *  each revocable where it is shown, with the act to add more below. */
function ServiceCard({
  title,
  records,
  kingdom,
  hint,
  empty,
  form,
  onRevoke,
}: {
  title: string;
  records: { id: string; personId: string }[];
  kingdom: Kingdom;
  /** The teaching tail each record wears — detail mode only. */
  hint: string;
  empty: string;
  form: React.ReactNode;
  onRevoke: (actId: string) => void;
}) {
  const nav = useNav();
  const detail = useDetail();
  return (
    <div className="card">
      <h3>{title}</h3>
      {records.length === 0 ? (
        <p className="fine">{empty}</p>
      ) : (
        <ul className="desk-list">
          {records.map((r) => {
            const person = kingdom.people.find((p) => p.id === r.personId);
            return (
              <li key={r.id}>
                <span className="ledger-body">
                  {person ? (
                    <InlineLink onClick={() => nav.goToPerson(person.id)}>
                      <strong>{person.name}</strong>
                    </InlineLink>
                  ) : (
                    <strong>—</strong>
                  )}
                  {detail && <span className="fine"> · {hint}</span>}
                </span>
                <button className="rowbtn" onClick={() => onRevoke(r.id)}>
                  Revoke
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {form}
    </div>
  );
}

function HamletCard({
  reading,
  kingdom,
  court,
  onPromote,
}: {
  reading: HamletReading;
  kingdom: Kingdom;
  court: CourtActions;
  onPromote: (territoryId: string) => void;
}) {
  const detail = useDetail();
  return (
    <div className="card hamlet-card">
      <div className="card-head">
        <StateDot state={reading.state} />
        <h4>
          Hamlet: {reading.territory.name}
          <span className="state-label"> — {HAMLET_STATE_LABEL[reading.state]}</span>
        </h4>
        <button
          className="rowbtn"
          title="The graduation path: a hamlet becomes a fief when the kingdom grows enough to need it sovereign."
          onClick={() => onPromote(reading.territory.id)}
        >
          Promote to fief
        </button>
      </div>
      {reading.strayGrants.map((g) => (
        <div className="act-row" key={g.id}>
          <span className="fine">
            A lord's grant ({kingdom.people.find((p) => p.id === g.personId)?.name ?? '—'},{' '}
            {g.grantedOn}) remains from this land's days as a fief.
          </span>
          <button className="rowbtn" onClick={() => court.revoke(g.id)}>
            Revoke
          </button>
        </div>
      ))}
      <div className="chip-row">
        {reading.mayor && <PersonChip person={reading.mayor} role="Mayor (line of trade)" />}
      </div>
      {reading.grant ? (
        <div className="act-row">
          <span className="fine">
            Granted {reading.grant.grantedOn}
            {detail && " — line of trade, answers to the fief's lord."}
          </span>
          <button className="rowbtn" onClick={() => court.revoke(reading.grant!.id)}>
            Revoke
          </button>
        </div>
      ) : (
        <>
          <Explain>A garrison becomes a hamlet when it gets a mayor.</Explain>
          <ActForm
            label="Grant the hamlet a mayor…"
            people={grantable(kingdom)}
            verb="Grant"
            onAct={(personId) => court.grant(reading.territory.id, personId, 'mayor')}
          />
        </>
      )}
      <ul className="desk-list">
        {kingdom.postings
          .filter((p) => p.territoryId === reading.territory.id)
          .map((posting) => {
            const person = kingdom.people.find((p) => p.id === posting.personId);
            return (
              <li key={posting.id}>
                <span className="ledger-body">
                  {person ? <PersonChip person={person} role="Garrison" /> : <strong>—</strong>}
                </span>
                <button className="rowbtn" onClick={() => court.revoke(posting.id)}>
                  Revoke
                </button>
              </li>
            );
          })}
      </ul>
      <ActForm
        label="Station an artisan…"
        people={appointable(kingdom)}
        verb="Station"
        onAct={(personId) => court.post(reading.territory.id, personId)}
      />
    </div>
  );
}

export default function FiefDetail({
  reading,
  kingdom,
  court,
  onPromote,
  onDemote,
  fromMarches,
  onRecall,
  upkeep,
  onStrikeUpkeep,
}: {
  reading: FiefReading;
  kingdom: Kingdom;
  court: CourtActions;
  onPromote: (territoryId: string) => void;
  onDemote: (territoryId: string, parentId: string) => void;
  fromMarches: ArrivalReading[];
  onRecall: (arrivalId: string) => void;
  upkeep: UpkeepLine[];
  onStrikeUpkeep: (upkeepId: string) => void;
}) {
  const [demoteParent, setDemoteParent] = useState('');
  // A CROWN OFFICE is never land (WRIT-THE-BROKERAGE), so this page must never
  // offer it the acts that turn land into other land. Offices route to their
  // own panel now — this guard is the second line, because the control it hides
  // rewrote `kind: 'office'` to `kind: 'hamlet'` with nothing able to undo it.
  const isOffice = reading.territory.kind === 'office';
  const otherFiefs = kingdom.territories.filter(
    (t) => t.kind === 'fief' && t.id !== reading.territory.id,
  );
  const nav = useNav();
  const detail = useDetail();
  const upkeepOutward = monthlyOf(upkeep.filter((l) => l.toArtisan));
  const holderRole =
    reading.state === 'regency'
      ? 'Keeper'
      : reading.state === 'stewardship'
        ? 'Regent (by default, not by grant)'
        : 'Lord';
  const keeperOnBooks = reading.appointment
    ? (kingdom.people.find((p) => p.id === reading.appointment!.personId) ?? null)
    : null;
  return (
    <section>
      <header className={`banner banner-${reading.state}`}>
        <h2>{reading.territory.name}</h2>
        <p className="state-line">
          <StateDot state={reading.state} /> {FIEF_STATE_LABEL[reading.state]}
        </p>
        <Explain className="explain">{STATE_EXPLANATION[reading.state]}</Explain>
      </header>

      <div className="card">
        <h3>Held by</h3>
        <div className="chip-row">
          {reading.holder ? (
            <PersonChip person={reading.holder} role={holderRole} />
          ) : (
            <span className="fine">The seat is empty and no regent is recorded.</span>
          )}
        </div>
        {reading.grant && (
          <div className="act-row">
            <span className="fine">
              Granted {reading.grant.grantedOn}
              {detail && ' — a deliberate act, recorded.'}
            </span>
            <button className="rowbtn" onClick={() => court.revoke(reading.grant!.id)}>
              Revoke the grant
            </button>
          </div>
        )}
        {reading.appointment && (
          <div className="act-row">
            <span className="fine">
              {reading.state === 'regency'
                ? `Keeper appointed ${reading.appointment.appointedOn}${detail ? ' — the record that makes this a regency, not a fall to the Regent.' : ''}`
                : `${keeperOnBooks?.name ?? 'A keeper'} remains keeper on the books, appointed ${reading.appointment.appointedOn}.`}
            </span>
            <button className="rowbtn" onClick={() => court.revoke(reading.appointment!.id)}>
              Revoke the appointment
            </button>
          </div>
        )}
        {reading.strayGrants.map((g) => (
          <div className="act-row" key={g.id}>
            <span className="fine">
              A mayor's grant ({kingdom.people.find((p) => p.id === g.personId)?.name ?? '—'},{' '}
              {g.grantedOn}) remains from this land's days as a hamlet. A fief needs a lord;
              the line of trade does not rule.
            </span>
            <button className="rowbtn" onClick={() => court.revoke(g.id)}>
              Revoke
            </button>
          </div>
        ))}
        {reading.state === 'stewardship' && (
          <p className="fine debt-note">
            On the Regent's desk as delegation debt.
            {detail && ' The flag clears with a grant (a lord) or an appointment (a keeper) — nothing else.'}
          </p>
        )}
        {!reading.grant && (
          <ActForm
            label={isOffice ? 'Seat a Chancellor over the office…' : 'Grant the fief to…'}
            people={grantable(kingdom)}
            verb="Grant"
            onAct={(personId) => court.grant(reading.territory.id, personId, 'lord')}
          />
        )}
        {/* An artisan can work the land and even KEEP it; they can never hold
            it — and a Crown office is not land at all, it is the household's
            own craft. The Census offers an office exactly one act, a Chancellor
            grant to a vassal; this page offered a second, an outside keeper,
            and the two doors then obeyed two different laws. */}
        {!reading.grant && !reading.appointment && !isOffice && (
          <ActForm
            label="Or appoint a keeper…"
            people={appointable(kingdom)}
            verb="Appoint"
            onAct={(personId) => court.appoint(reading.territory.id, personId)}
          />
        )}
      </div>

      <ServiceCard
        title="Vassals"
        records={kingdom.fealties.filter((f) => f.territoryId === reading.territory.id)}
        kingdom={kingdom}
        hint="sworn to serve under this fief's lord"
        empty="No fealty is recorded here."
        form={
          <ActForm
            label="Record fealty…"
            people={swearable(kingdom)}
            verb="Swear"
            onAct={(personId) => court.swear(reading.territory.id, personId)}
          />
        }
        onRevoke={court.revoke}
      />

      <ServiceCard
        title="Garrison"
        records={kingdom.postings.filter((p) => p.territoryId === reading.territory.id)}
        kingdom={kingdom}
        hint="workforce, not authority"
        empty="No artisan is stationed here."
        form={
          <ActForm
            label="Station an artisan…"
            people={appointable(kingdom)}
            verb="Station"
            onAct={(personId) => court.post(reading.territory.id, personId)}
          />
        }
        onRevoke={court.revoke}
      />

      {reading.hamlets.map((h) => (
        <HamletCard
          key={h.territory.id}
          reading={h}
          kingdom={kingdom}
          court={court}
          onPromote={onPromote}
        />
      ))}

      {otherFiefs.length > 0 && !isOffice && (
        <div className="card">
          <h3>Graduation</h3>
          <Explain>
            A hamlet becomes a fief when the kingdom grows enough to need it sovereign; the
            reverse folds a fief back inside another as a hamlet. Records survive the move —
            stray ones stay visible until revoked.
          </Explain>
          <form
            className="arrival-form act-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (demoteParent) onDemote(reading.territory.id, demoteParent);
            }}
          >
            <select
              value={demoteParent}
              onChange={(e) => setDemoteParent(e.target.value)}
              aria-label="Fold into which fief"
            >
              <option value="">Fold into which fief…</option>
              {otherFiefs.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <button type="submit" disabled={!demoteParent}>
              Fold into
            </button>
          </form>
        </div>
      )}

      {upkeep.length > 0 && (
        <div className="card">
          <h3>Upkeep</h3>
          <p className="coin-total">
            {coin(monthlyOf(upkeep))}/mo
            {upkeepOutward > 0 && (
              <span className="fine"> · {coin(upkeepOutward)} to artisans</span>
            )}
          </p>
          <ul className="desk-list">
            {upkeep.map((line) => (
              <li key={line.upkeep.id}>
                <span
                  className={`ledger-mark ${line.toArtisan ? 'ledger-away' : 'ledger-out'}`}
                >
                  {coin(line.upkeep.monthly)}
                </span>
                <span className="ledger-body">
                  <strong>{line.upkeep.label}</strong>
                  {line.person && (
                    <>
                      {' '}
                      —{' '}
                      <InlineLink onClick={() => nav.goToPerson(line.person!.id)}>
                        {line.person.name}
                      </InlineLink>
                      {line.toArtisan && <span className="fine"> (artisan)</span>}
                    </>
                  )}
                </span>
                <button className="rowbtn" onClick={() => onStrikeUpkeep(line.upkeep.id)}>
                  Strike
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {fromMarches.length > 0 && (
        <div className="card">
          <h3>From the Marches</h3>
          <ul className="desk-list">
            {fromMarches.map((r) => (
              <li key={r.arrival.id}>
                <span className="ledger-mark ledger-out">→</span>
                <span className="ledger-body">
                  <InlineLink onClick={() => nav.goToMarches()}>
                    <strong>{r.arrival.title}</strong>
                  </InlineLink>
                  {r.arrival.note && <span className="fine"> — {r.arrival.note}</span>}
                  <span className="fine"> ridden out {r.dispatch?.dispatchedOn}</span>
                </span>
                <button className="rowbtn" onClick={() => onRecall(r.arrival.id)}>
                  Recall
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
