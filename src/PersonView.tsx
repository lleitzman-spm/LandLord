import { useState } from 'react';
import { FIEF_STATE_LABEL, readFief, squiresOf, regentsDesk } from './domain/states';
import type { FiefReading } from './domain/states';
import type { Kingdom, Person, PledgeType } from './domain/types';
import type { UpkeepLine } from './domain/treasury';
import { coin, monthlyOf } from './domain/treasury';
import { Explain, InlineLink, PLEDGE_LABEL, PLEDGE_ORDER, PersonChip, StateDot } from './components';
import { useDetail } from './detail';
import { useNav } from './nav';

/** Everything the kingdom's records say about one person, each line a road
 *  to the place it names — and each recorded act revocable where it is
 *  shown (design law 6). */
export default function PersonView({
  person,
  paid,
  kingdom,
  onRevoke,
  onRepledge,
  onStrike,
}: {
  person: Person;
  paid: UpkeepLine[];
  kingdom: Kingdom;
  onRevoke: (actId: string) => void;
  onRepledge: (personId: string, pledge: PledgeType, pledgedTo?: string) => void;
  onStrike: (personId: string) => void;
}) {
  const nav = useNav();
  const detail = useDetail();
  const [newPledge, setNewPledge] = useState<PledgeType>(person.pledge);
  const [newKnight, setNewKnight] = useState(person.pledgedTo ?? '');
  // Every territory this person could hold — LAND and OFFICE alike. `readKingdom`
  // folds only fiefs (it is the map's list), so a Chancellor, whose seat is a
  // lord-role grant on an OFFICE, had no "Holds by grant" card, no Revoke beside
  // it, and at the founding read "The records name no holdings, postings, or
  // pledges." — while the War Table said in the same breath that they master the
  // craft. The same gauge-lies shape as the plurality bug, from the same cause:
  // a narrowed LIST used where the whole book was meant. (Audit, 2026-07-27.)
  const readings: FiefReading[] = kingdom.territories
    .filter((t) => t.kind !== 'hamlet')
    .map((t) => readFief(kingdom, t));

  const lordOf = readings.filter((r) => r.grant?.personId === person.id);
  const mayorOf = readings.flatMap((r) =>
    r.hamlets
      .filter((h) => h.mayor?.id === person.id)
      .map((h) => ({ fief: r.territory, hamlet: h.territory, grant: h.grant })),
  );
  const keeperOf = kingdom.appointments
    .filter((a) => a.personId === person.id)
    .map((a) => ({
      appointment: a,
      territory: kingdom.territories.find((t) => t.id === a.territoryId),
    }))
    .filter((x) => x.territory != null);
  const garrisonedIn = kingdom.postings
    .filter((p) => p.personId === person.id)
    .map((p) => ({
      record: p,
      territory: kingdom.territories.find((t) => t.id === p.territoryId),
    }))
    .filter((x) => x.territory != null);
  const vassalIn = kingdom.fealties
    .filter((f) => f.personId === person.id)
    .map((f) => ({
      record: f,
      territory: kingdom.territories.find((t) => t.id === f.territoryId),
    }))
    .filter((x) => x.territory != null);
  const squires = squiresOf(kingdom, person.id);
  const knight = person.pledgedTo
    ? kingdom.people.find((p) => p.id === person.pledgedTo)
    : undefined;
  const desk = person.pledge === 'steward' ? regentsDesk(kingdom) : null;

  const nothingOnRecord =
    lordOf.length === 0 &&
    mayorOf.length === 0 &&
    keeperOf.length === 0 &&
    garrisonedIn.length === 0 &&
    vassalIn.length === 0 &&
    squires.length === 0 &&
    paid.length === 0 &&
    !knight &&
    !desk;

  return (
    <section>
      <header className="banner banner-person">
        <h2>{person.name}</h2>
        <p className="state-line">{PLEDGE_LABEL[person.pledge]}</p>
        {person.note && <p className="explain">{person.note}</p>}
      </header>

      {lordOf.length > 0 && (
        <div className="card">
          <h3>Seated by grant</h3>
          <ul className="desk-list">
            {lordOf.map((r) => (
              <li key={r.territory.id}>
                <StateDot state={r.state} />
                <span className="ledger-body">
                  <InlineLink onClick={() => nav.goToTerritory(r.territory.id)}>
                    <strong>{r.territory.name}</strong>
                  </InlineLink>{' '}
                  {/* A CROWN OFFICE is not land and its holder is not a lord.
                      This card spans offices too, so Mabel's page read "The
                      Office of Works — Lord, lorded" when she holds no land at
                      all. The role and the standing both follow the kind. */}
                  {r.territory.kind === 'office'
                    ? ' — Chancellor'
                    : ` — Lord, ${FIEF_STATE_LABEL[r.state].toLowerCase()}`}
                  {r.grant && <span className="fine"> · granted {r.grant.grantedOn}</span>}
                </span>
                {r.grant && (
                  <button className="rowbtn" onClick={() => onRevoke(r.grant!.id)}>
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {mayorOf.length > 0 && (
        <div className="card">
          <h3>Mayor of</h3>
          <ul className="desk-list">
            {mayorOf.map(({ fief, hamlet, grant }) => (
              <li key={hamlet.id}>
                <StateDot state="mayored" />
                <span className="ledger-body">
                  <InlineLink onClick={() => nav.goToTerritory(hamlet.id)}>
                    <strong>
                      {fief.name} ↳ {hamlet.name}
                    </strong>
                  </InlineLink>
                  {detail && (
                    <span className="fine"> · line of trade, answers to the fief's lord</span>
                  )}
                </span>
                {grant && (
                  <button className="rowbtn" onClick={() => onRevoke(grant.id)}>
                    Revoke
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {keeperOf.length > 0 && (
        <div className="card">
          <h3>Keeper of</h3>
          <ul className="desk-list">
            {keeperOf.map(({ appointment, territory }) => (
              <li key={territory!.id}>
                <StateDot state="regency" />
                <span className="ledger-body">
                  <InlineLink onClick={() => nav.goToTerritory(territory!.id)}>
                    <strong>{territory!.name}</strong>
                  </InlineLink>{' '}
                  <span className="fine">
                    · appointed {appointment.appointedOn}
                    {detail && ' — keeps the castle for an absent lord'}
                  </span>
                </span>
                <button className="rowbtn" onClick={() => onRevoke(appointment.id)}>
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {vassalIn.length > 0 && (
        <div className="card">
          <h3>Sworn vassal in</h3>
          <ul className="desk-list">
            {vassalIn.map(({ record, territory }) => (
              <li key={record.id}>
                <span className="ledger-body">
                  <InlineLink onClick={() => nav.goToTerritory(territory!.id)}>
                    <strong>{territory!.name}</strong>
                  </InlineLink>
                </span>
                <button className="rowbtn" onClick={() => onRevoke(record.id)}>
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {garrisonedIn.length > 0 && (
        <div className="card">
          <h3>Garrisoned in</h3>
          <ul className="desk-list">
            {garrisonedIn.map(({ record, territory }) => (
              <li key={record.id}>
                <span className="ledger-body">
                  <InlineLink onClick={() => nav.goToTerritory(territory!.id)}>
                    <strong>{territory!.name}</strong>
                  </InlineLink>
                  {detail && <span className="fine"> · workforce, not authority</span>}
                </span>
                <button className="rowbtn" onClick={() => onRevoke(record.id)}>
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {knight && (
        <div className="card">
          <h3>Pledged to</h3>
          <div className="chip-row">
            <PersonChip person={knight} />
          </div>
        </div>
      )}

      {squires.length > 0 && (
        <div className="card">
          <h3>Squires in their charge</h3>
          <div className="chip-row">
            {squires.map((s) => (
              <PersonChip key={s.id} person={s} />
            ))}
          </div>
        </div>
      )}

      {paid.length > 0 && (
        <div className="card">
          <h3>Paid by the treasury</h3>
          <p className="coin-total">{coin(monthlyOf(paid))}/mo</p>
          <ul className="desk-list">
            {paid.map((line) => (
              <li key={line.upkeep.id}>
                <span
                  className={`ledger-mark ${line.toArtisan ? 'ledger-away' : 'ledger-out'}`}
                >
                  {coin(line.upkeep.monthly)}
                </span>
                <span className="ledger-body">
                  <strong>{line.upkeep.label}</strong>
                  {' · '}
                  {line.territory ? (
                    <InlineLink onClick={() => nav.goToTerritory(line.territory!.id)}>
                      {line.territory.name}
                    </InlineLink>
                  ) : (
                    <span className="fine">the Crown</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {desk && (
        <div className="card">
          <h3>
            On the Regent's desk{' '}
            {desk.debt.length > 0 && <span className="count count-red">{desk.debt.length}</span>}
          </h3>
          {desk.debt.length === 0 ? (
            <p className="fine">The desk is clear.</p>
          ) : (
            <ul className="desk-list">
              {desk.debt.map((r) => (
                <li key={r.territory.id}>
                  <StateDot state="stewardship" />
                  <span>
                    <InlineLink onClick={() => nav.goToTerritory(r.territory.id)}>
                      <strong>{r.territory.name}</strong>
                    </InlineLink>{' '}
                    <span className="fine">· held by default, needs delegating</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {nothingOnRecord && (
        <div className="card">
          <p className="fine">The records name no holdings, postings, or pledges.</p>
        </div>
      )}

      <div className="card">
        <h3>The pledge</h3>
        <Explain>
          A pledge can change — a squire is knighted, an artisan is hired inside the walls.
          Records survive the change; the readings recompute around the new pledge.
        </Explain>
        <form
          className="arrival-form act-form"
          onSubmit={(e) => {
            e.preventDefault();
            onRepledge(
              person.id,
              newPledge,
              newPledge === 'squire' ? newKnight || undefined : undefined,
            );
          }}
        >
          <select
            value={newPledge}
            onChange={(e) => setNewPledge(e.target.value as PledgeType)}
            aria-label="New pledge"
          >
            {PLEDGE_ORDER.map((p) => (
              <option key={p} value={p}>
                {PLEDGE_LABEL[p]}
              </option>
            ))}
          </select>
          {newPledge === 'squire' && (
            <select
              value={newKnight}
              onChange={(e) => setNewKnight(e.target.value)}
              aria-label="Pledged to"
            >
              <option value="">Pledged to…</option>
              {kingdom.people
                .filter((p) => p.id !== person.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          )}
          <button
            type="submit"
            disabled={
              newPledge === person.pledge || (newPledge === 'squire' && !newKnight)
            }
          >
            Re-pledge
          </button>
        </form>
      </div>

      <div className="card">
        <div className="act-row">
          <span className="fine">
            Striking removes {person.name} from the census.
            {detail && ' Records that name them stay in their books; the readings tolerate the gap.'}
          </span>
          <button className="rowbtn danger" onClick={() => onStrike(person.id)}>
            Strike from the census
          </button>
        </div>
      </div>
    </section>
  );
}
