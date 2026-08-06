/* THE KEY MAP — the kingdom answers to the keyboard.
 *
 * Edwin, 2026-07-29: *"we have the whole keyboard it doesn't have to all be
 * point and click we can have bindings to open menus."* This is that, and it is
 * the thing that lets the chrome go: a rail of nine glyphs and a footer of five
 * buttons only had to stand there permanently because there was no other way to
 * reach what they reached. Give every surface a key and a palette, and the
 * board can have the screen.
 *
 * The scheme, and why:
 *  · **`g` then a letter GOES somewhere** — the Gmail/GitHub prefix. Nine
 *    surfaces need nine bindings, and nine bare letters would collide with
 *    every act we ever add. A prefix keeps the whole alphabet free.
 *  · **A bare letter ACTS** — the few things done often enough to earn one.
 *  · **The palette lists every binding beside its command**, so the keyboard is
 *    learned by using the mouse. A hidden shortcut is not a feature.
 *
 * The matching is pure and lives here so it can be tested without a browser;
 * the palette in CommandPalette.tsx is only its face.
 */

/** A thing the Regent can do, named once and reachable three ways: by click in
 *  the palette, by its own key, and by search. */
export type Command = {
  readonly id: string;
  /** What it is called, in the plainest words available (the legibility rule:
   *  the voice may name things, it may not label acts). */
  readonly label: string;
  /** The group it files under in the palette. */
  readonly group: 'Surfaces' | 'The clock' | 'Acts' | 'The muster';
  /** The keys that reach it, already written for a reader: 'g m', '.', '?'. */
  readonly keys?: string;
  /** One line on what it does, shown under the label. */
  readonly hint?: string;
  /** Whether it can be run at all right now. A command that cannot run is shown
   *  greyed with its reason, never silently missing — a palette that hides what
   *  it cannot do teaches the wrong map. */
  readonly disabled?: string | false;
  readonly run: () => void;
};

/** The `g`-prefix table: a surface per letter. Kept as data, not a switch, so
 *  the palette and the key handler can never disagree about what `g c` does. */
export const GO_KEYS: Readonly<Record<string, string>> = {
  m: 'map',
  t: 'throne',
  s: 'seat',
  c: 'court',
  l: 'ledger',
  w: 'muster',
  n: 'census',
  b: 'counting',
  r: 'marches',
};

/** The name of the "hold this and press another" key, on THIS machine.
 *
 *  The handler has always accepted either — `e.metaKey || e.ctrlKey` — so the
 *  behaviour was never Mac-only. The LABELS were: a board that says `⌘K` to
 *  someone on Windows is telling them to press a key their keyboard does not
 *  have, and the one door that reaches every other door is the worst possible
 *  place to do that.
 *
 *  Read once, at module load: a keyboard does not change platform mid-session,
 *  and every caller renders this into static text.
 *
 *  `userAgentData.platform` is the modern reading and `navigator.platform` is
 *  deprecated but still the only answer in several browsers, so try both before
 *  falling back to the user-agent string. Anything unrecognised gets `Ctrl` —
 *  the commoner keyboard, and the safer guess when we genuinely do not know. */
function readModifierName(): string {
  if (typeof navigator === 'undefined') return 'Ctrl';
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const stated = nav.userAgentData?.platform || nav.platform || nav.userAgent || '';
  return /mac|iphone|ipad|ipod/i.test(stated) ? '⌘' : 'Ctrl';
}

/** `⌘` on an Apple keyboard, `Ctrl` everywhere else. */
export const MOD_KEY: string = readModifierName();

/** The palette's shortcut as it should be written on THIS machine — `⌘K` or
 *  `Ctrl+K`. Apple keycaps are written closed-up by convention; everywhere else
 *  takes the `+`. */
export const MOD_K: string = MOD_KEY === '⌘' ? '⌘K' : `${MOD_KEY}+K`;

/** True when a keystroke belongs to whatever the player is typing into, and so
 *  is none of our business. Without this, typing a muster's seed named
 *  "the-grand-muster" would fire `g`, `r`, `n` and `b` as it went. */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable === true;
}

/** Does `query` appear in `text` as a subsequence, and how well?
 *
 *  Returns a score (higher is better) or -1 for no match. Subsequence rather
 *  than substring so "adv wk" finds "Advance a week"; a run of adjacent letters
 *  and a match at a word's start both score higher, which is what makes the
 *  first result usually the right one. */
export function fuzzyScore(text: string, query: string): number {
  if (!query) return 0;
  const t = text.toLowerCase();
  const q = query.toLowerCase().replace(/\s+/g, '');
  if (!q) return 0;

  let score = 0;
  let ti = 0;
  let run = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return -1;
    // A letter that starts a word is worth more than one buried in the middle.
    const atWordStart = found === 0 || /[\s·—-]/.test(t[found - 1] ?? '');
    run = found === ti ? run + 1 : 0;
    score += 1 + run * 2 + (atWordStart ? 4 : 0);
    ti = found + 1;
  }
  // Shorter labels win ties: "The Seat" should beat "The Seat's open work".
  return score - t.length * 0.01;
}

/** The palette's list for a given query — matching commands, best first, with
 *  their groups preserved for the ones that tie. */
export function matchCommands(all: readonly Command[], query: string): Command[] {
  if (!query.trim()) return [...all];
  return all
    .map((c) => ({ c, s: Math.max(fuzzyScore(c.label, query), fuzzyScore(c.group, query) - 2) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c);
}
