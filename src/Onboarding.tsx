// The first-run onboarding overlay — BETA BLOCKER S4. A beta guest lands on
// the War Table cold; this is the one screen that says what the kingdom is
// and translates its plain-English medieval vocabulary before they touch
// anything. Shows once (a localStorage flag), then never again. Self-
// contained: its own component, its own CSS (App.css, `.wt-onb-*` — a small
// palette duplicated rather than borrowed from `.wt`'s scoped variables, so
// it renders correctly wherever it is mounted).

import { useEffect, useRef, useState } from 'react';
import { MOD_K } from './keys';

const ONBOARDED_KEY = 'landlord.onboarded.v1';

function hasEnteredBefore(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1';
  } catch {
    // Storage blocked (private mode, quota) — fail open: show once this load,
    // don't wedge the guest out of the board.
    return false;
  }
}

function rememberEntered() {
  try {
    localStorage.setItem(ONBOARDED_KEY, '1');
  } catch {
    // Nothing to persist; the overlay will simply greet them again next time.
  }
}

const GLOSSARY: { term: string; say: string }[] = [
  {
    term: 'The Muster',
    say:
      'Sound the war horn and a simulated month of operations deals onto the board at once — ' +
      'owners, doors, and work orders — so the whole game runs live.',
  },
  {
    term: 'The Marches',
    say:
      'The border lands — an inbox of new arrivals. Work shows up here first and must be ridden ' +
      'out to a territory, or turned away, before it belongs to anyone.',
  },
  {
    term: 'Coffers · the Counting-house',
    say:
      'The books. Coffers is the health-bar reading — tribute (fees earned) against upkeep ' +
      '(costs). The Counting-house is the fuller panel: both treasuries side by side.',
  },
  {
    term: 'A Clerk',
    say:
      'An AI agent working a seat’s queue. It proposes the next step on a task, then stops and ' +
      'waits — a human always approves or overrides before it moves on.',
  },
  {
    term: 'A Seat',
    say: 'A role or desk that holds the ball on a piece of work — a person’s desk, or a queue.',
  },
  {
    term: 'The Regent’s Seat',
    say:
      'The triage console: raw intake gets identified and delegated here — the catch-basin for ' +
      'anything nobody has claimed yet.',
  },
  {
    term: 'The Ledger',
    say:
      'The work itself — every open work order, its steps, and the clerks’ proposals waiting ' +
      'on your approve or override.',
  },
];

export default function OnboardingOverlay() {
  const [open, setOpen] = useState(() => !hasEnteredBefore());
  const dialogRef = useRef<HTMLDivElement>(null);
  const enterRef = useRef<HTMLButtonElement>(null);

  const dismiss = () => {
    rememberEntered();
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    enterRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div className="wt-onb-root">
      <div className="wt-onb-scrim" onClick={dismiss} aria-hidden="true" />
      <div className="wt-onb-wrap">
        <div
          className="wt-onb-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Welcome to LandLord — the court's vocabulary"
          ref={dialogRef}
        >
          <header className="wt-onb-head">
            <div className="wt-onb-seal" aria-hidden="true">
              L
            </div>
            <div className="wt-onb-htext">
              <h2>Welcome to the War Table</h2>
              <p>
                LandLord runs a property-management operation as a kingdom you command from this
                board. Everything below is a real instrument — dressed in plain-English medieval
                words instead of office ones.
              </p>
            </div>
            <button className="wt-onb-x" onClick={dismiss} aria-label="Close and enter the court">
              ✕
            </button>
          </header>

          <div className="wt-onb-body">
            {/* HOW TO GET ANYWHERE, and this earns its place at the top: the
                board used to carry a rail of nine labelled glyphs down its left
                side, so navigation explained itself and this screen never had to
                mention it. The rail is gone and the map has the space instead —
                which means the ONE thing a first Regent now cannot discover by
                looking is how to reach a surface at all. */}
            <p className="wt-onb-lede">Getting around:</p>
            <dl className="wt-onb-gloss">
              <div className="wt-onb-row">
                <dt>☰ Go — or {MOD_K}</dt>
                <dd>
                  Every surface and every act in one searchable list, each shown beside its own
                  shortcut. Press <b>g</b> then a letter to jump straight there — <b>g&nbsp;l</b>{' '}
                  for the Ledger, <b>g&nbsp;c</b> to hold court. <b>?</b> opens the same list.
                </dd>
              </div>
              <div className="wt-onb-row">
                <dt>⚑ Council</dt>
                <dd>
                  What presses, and the act for each — one line apiece. <b>c</b> raises and lowers
                  it; <b>Why</b> shows the reasoning under every matter. Lower it and the board
                  takes the whole screen.
                </dd>
              </div>
              <div className="wt-onb-row">
                <dt>The clock</dt>
                <dd>
                  <b>.</b> advances a day, <b>▶</b> a week. The tide rises on whatever you leave
                  undelegated, so time is the pressure.
                </dd>
              </div>
            </dl>
            <p className="wt-onb-lede">And a quick translation before you ride in:</p>
            <dl className="wt-onb-gloss">
              {GLOSSARY.map((g) => (
                <div className="wt-onb-row" key={g.term}>
                  <dt>{g.term}</dt>
                  <dd>{g.say}</dd>
                </div>
              ))}
            </dl>
          </div>

          <footer className="wt-onb-foot">
            <button className="wt-onb-enter" onClick={dismiss} ref={enterRef}>
              Enter the court →
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}
