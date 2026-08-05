// The Crown — the kingdom itself: the royal line (King and Regent), the
// Regent's retinue of squires, and the campaigns beyond the borders. Extracted
// whole from the old App shell when the War Table absorbed it; it now renders
// inside a War Table panel, reached from the board's crown line.

import { king, squiresOf, regent } from './domain/states';
import type { Kingdom } from './domain/types';
import { Explain, PersonChip } from './components';
import { useDetail } from './detail';

export default function CrownView({ kingdom }: { kingdom: Kingdom }) {
  const detail = useDetail();
  const theKing = king(kingdom);
  const theRegent = regent(kingdom);
  const retinue = theRegent ? squiresOf(kingdom, theRegent.id) : [];
  return (
    <section>
      <header className="banner banner-crown">
        <h2>The Crown</h2>
        <Explain className="explain">
          The kingdom itself. Sovereignty sits here; administration flows through the Regent.
        </Explain>
      </header>
      <div className="card">
        <h3>The royal line</h3>
        <div className="chip-row">
          {theKing && <PersonChip person={theKing} />}
          {theRegent && <PersonChip person={theRegent} />}
        </div>
      </div>
      {retinue.length > 0 && (
        <div className="card">
          <h3>Retinue</h3>
          <div className="chip-row">
            {retinue.map((p) => (
              <PersonChip key={p.id} person={p} role={`Squire, pledged to ${theRegent?.name}`} />
            ))}
          </div>
          <Explain>Squires pledge to a person, not a fief.</Explain>
        </div>
      )}
      {detail && (
        <div className="card">
          <h3>Beyond the borders</h3>
          <p className="fine">
            Conquest campaigns (acquisitions, PMC M&amp;A, lending, investor packets) run from the
            throne. Nine CRM pipelines stand as foreign kingdoms with envoys. Future modules.
          </p>
        </div>
      )}
    </section>
  );
}
