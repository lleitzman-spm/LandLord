// The realm is the War Table, and only the War Table. The board is the whole
// app: every surface — the Throne, the Regent's Seat, the Census, the Coin,
// the Marches, the Ledger, the War Games, a fief, a person, the Crown — opens
// as an overlay panel over the vellum. There is no old `.court` sidebar shell
// any more; it was fully absorbed (docs/HANDOFF, "shell-absorption"). App's
// whole job is now to assemble the kingdom from the records and hand the books
// to the board.

import './App.css';
import { assembleKingdom } from './domain/court';
import OnboardingOverlay from './Onboarding';
import { useChronicle } from './store/chronicleStore';
import WarTableView from './WarTableView';

export default function App() {
  const {
    persistence,
    marches,
    treasury,
    economy,
    court,
    census,
    events,
    catalog,
    estates,
    flows,
    regent,
    wargame,
  } = useChronicle();
  const kingdom = assembleKingdom(census.book, court.acts);
  // The clock the whole app reads against: game-now while a War Game stands,
  // the wall clock otherwise (docs/WRIT-WAR-GAME.md — the simulated `now`).
  const now = wargame.state?.now ?? new Date().toISOString();

  return (
    <>
      <OnboardingOverlay />
      <WarTableView
        kingdom={kingdom}
        events={events}
        catalog={catalog}
        regent={regent}
        wargame={wargame}
        treasury={treasury}
        economy={economy}
        court={court}
        census={census}
        marches={marches}
        estates={estates}
        flows={flows}
        now={now}
        seed={wargame.state?.seed ?? null}
      />
      {persistence.status === 'error' && (
        <div className="save-alert" role="alert" aria-live="assertive">
          <span className="save-alert-mark" aria-hidden="true">
            ⚠
          </span>
          <div className="save-alert-body">
            <div className="save-alert-title">
              {persistence.failure?.kind === 'unreachable'
                ? 'The vault could not be reached'
                : 'The vault refused the last change'}
            </div>
            <div className="save-alert-say">
              Your edit is held on this device but has NOT been saved to the vault — if you
              reload now it will be lost.{' '}
              {/* The two failures call for OPPOSITE acts, so the banner must not
                  wear one face for both. A vault that answered and said no will
                  keep saying no; a vault that never answered is usually a dropped
                  line, and pressing again is exactly right. */}
              {persistence.failure?.kind === 'unreachable'
                ? 'Nothing answered — this is usually the connection, so trying again often works.'
                : persistence.failure?.httpStatus
                  ? `The vault answered ${persistence.failure.httpStatus} and declined it. Trying again will likely meet the same answer until something changes.`
                  : 'Check the connection and try again.'}
            </div>
          </div>
          <button className="save-alert-retry" onClick={persistence.retry}>
            Try again
          </button>
        </div>
      )}
    </>
  );
}
