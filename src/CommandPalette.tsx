/* THE PALETTE — one door to every surface and every act.
 *
 * This is what replaces a rail of nine glyphs and a footer of five buttons. It
 * opens on ⌘K / Ctrl+K or `/`, filters as you type, and runs on Enter.
 *
 * It also TEACHES: every command shows its own key beside it, so the player who
 * reaches the Ledger by searching sees `g l` written next to it and reaches it
 * that way the next time. A shortcut nobody is shown is a shortcut nobody uses.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { matchCommands, type Command } from './keys';

export function CommandPalette({
  commands,
  onClose,
}: {
  commands: readonly Command[];
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const hits = useMemo(() => matchCommands(commands, q), [commands, q]);
  // The cursor must never point past the end of a list that just got shorter.
  const cursor = Math.min(i, Math.max(0, hits.length - 1));

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-on="1"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor, q]);

  const run = (c: Command | undefined) => {
    if (!c || c.disabled) return;
    // Close FIRST, then act: several of these open a panel, and a palette still
    // standing over the panel it just opened is the same covering fault the
    // Council aside committed over the footer.
    onClose();
    c.run();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setI(Math.min(cursor + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setI(Math.max(cursor - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(hits[cursor]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Group the hits, but only when nothing is typed — while searching, rank
  // order is the whole point and headings would fight it.
  const grouped = !q.trim();
  let lastGroup = '';

  return (
    <div className="wt-cmdscrim" onClick={onClose} role="presentation">
      <div
        className="wt-cmd"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="wt-cmdin"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setI(0);
          }}
          onKeyDown={onKey}
          placeholder="Where to, or what to do…"
          aria-label="Search surfaces and acts"
          autoComplete="off"
        />
        <div className="wt-cmdlist" ref={listRef} role="listbox" aria-label="Commands">
          {hits.length === 0 && <div className="wt-cmdnone">Nothing by that name.</div>}
          {hits.map((c, n) => {
            const head = grouped && c.group !== lastGroup ? ((lastGroup = c.group), c.group) : null;
            return (
              <div key={c.id}>
                {head && <div className="wt-cmdgrp">{head}</div>}
                <button
                  className={`wt-cmdrow${n === cursor ? ' on' : ''}${c.disabled ? ' off' : ''}`}
                  data-on={n === cursor ? '1' : '0'}
                  role="option"
                  aria-selected={n === cursor}
                  disabled={!!c.disabled}
                  onMouseEnter={() => setI(n)}
                  onClick={() => run(c)}
                >
                  <span className="wt-cmdlbl">
                    {c.label}
                    {(c.disabled || c.hint) && (
                      <span className="wt-cmdhint">{c.disabled || c.hint}</span>
                    )}
                  </span>
                  {c.keys && <kbd className="wt-cmdkey">{c.keys}</kbd>}
                </button>
              </div>
            );
          })}
        </div>
        {/* No separate "key map" surface. This list already names every command
            beside its own key, and a second screen repeating them is the
            triplication fault in a new coat — `?` opens THIS. */}
        <div className="wt-cmdfoot">
          <kbd>↑↓</kbd> choose · <kbd>↵</kbd> go · <kbd>esc</kbd> close
        </div>
      </div>
    </div>
  );
}
