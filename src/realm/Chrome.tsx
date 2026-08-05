/**
 * The chrome — HTML over the canvas. Plain-English medieval voice, ink on
 * vellum, the same tokens as the War Table. Never a big numeric scoreboard:
 * the land itself carries the readings; the chrome only advises and commands.
 *
 *   AdvisorRail  — one seat per CROWN OFFICE; headed shows its Chancellor,
 *                  headless an open seat. Click calls onSelectGuild.
 *   CoffersCartouche — a discreet corner cartouche for the coffers.
 *   WarHornCall  — the one invitation when the land lies unrevealed.
 *
 * The rail used to be titled "The Council" and to call its seats a bench of
 * GUILD MASTERS. Both were stale twice over. Since the refounding
 * (docs/WRIT-THE-BROKERAGE.md) these three ARE the Crown's own offices under
 * their Chancellors — a guild is an OUTSIDE trade now — and "Council" already
 * meant the heralds under the ⚑, so one word was doing two jobs on one screen.
 *
 * The COMMAND BAR that stood here is retired (Edwin, 2026-07-29: "the council
 * button is redundant to the council panel"). All four of its buttons — The
 * Muster, The Chronicle, The Coffers, The Council — were already doors in the
 * app's own header and rail, on screen at the same moment. Two controls for one
 * act is worse than one.
 */

import type { RealmHandlers, RealmScene } from './scene';

// ── The offices rail ───────────────────────────────────────────────────────

export function AdvisorRail({
  guilds,
  onSelectGuild,
}: {
  guilds: RealmScene['guilds'];
  onSelectGuild?: RealmHandlers['onSelectGuild'];
}) {
  return (
    <aside className="rl-rail" aria-label="The Crown's offices">
      <div className="rl-rail__title">The Offices</div>
      {guilds.map((g) => (
        <button
          key={g.id}
          type="button"
          className={`rl-seat ${g.manned ? 'rl-seat--manned' : 'rl-seat--vacant'}`}
          onClick={() => onSelectGuild?.(g.id)}
          title={g.manned ? `${g.masterName} is Chancellor of ${g.name}` : `${g.name} has no Chancellor`}
        >
          <span className="rl-seat__sigil" aria-hidden>
            {g.manned ? '⚜' : '○'}
          </span>
          <span className="rl-seat__text">
            <span className="rl-seat__guild">{g.name}</span>
            <span className="rl-seat__master">{g.manned ? g.masterName : 'No Chancellor — seat open'}</span>
          </span>
        </button>
      ))}
    </aside>
  );
}

// ── The coffers cartouche ──────────────────────────────────────────────────

/** The coffers, read as a DIRECTION rather than a score. The scene carries the
 *  month's trend and whether the Crown has fallen — not a balance — and the
 *  writ forbids a scoreboard: neglect is shown by the state of the land, and
 *  the only real consequence is running out of coin. So this says which way the
 *  month runs, and nothing more. */
export function CoffersCartouche({ coffers }: { coffers: RealmScene['coffers'] }) {
  const rising = coffers.trend >= 0;
  return (
    <div
      className={`rl-cartouche${
        coffers.dry ? ' rl-cartouche--fallen' : coffers.fallen ? ' rl-cartouche--red' : ''
      }`}
      title={
        coffers.dry
          ? 'The Crown’s own coin is gone — it cannot pay its people.'
          : `The month runs ${rising ? 'to the good' : 'to the bad'}.`
      }
    >
      <span className="rl-cartouche__coin" aria-hidden>
        ❧
      </span>
      <span className="rl-cartouche__value">
        {coffers.dry
          ? 'the coffers are dry'
          : rising
            ? 'the month runs to the good'
            : 'the month runs to the bad'}
      </span>
    </div>
  );
}

// ── The war-horn call (unrevealed) ─────────────────────────────────────────

export function WarHornCall({ onDeployMuster }: { onDeployMuster?: RealmHandlers['onDeployMuster'] }) {
  return (
    <div className="rl-call">
      <p className="rl-call__line">The land lies unrevealed.</p>
      <p className="rl-call__line rl-call__line--strong">Sound the war horn.</p>
      <button type="button" className="rl-call__horn" onClick={() => onDeployMuster?.()}>
        <span aria-hidden>📯</span> Sound the war horn
      </button>
    </div>
  );
}
