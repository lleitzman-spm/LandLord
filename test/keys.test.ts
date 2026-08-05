import { describe, expect, it } from 'vitest';
import { GO_KEYS, fuzzyScore, isTyping, matchCommands, type Command } from '../src/keys';

const cmd = (id: string, label: string, group: Command['group'] = 'Surfaces'): Command => ({
  id,
  label,
  group,
  run: () => {},
});

const ALL: Command[] = [
  cmd('map', 'The Map'),
  cmd('seat', "The Regent's Seat"),
  cmd('ledger', 'The Ledger'),
  cmd('census', 'The Census'),
  cmd('counting', 'The Counting-house'),
  cmd('week', 'Advance a week', 'The clock'),
  cmd('day', 'Advance a day', 'The clock'),
];

describe('the key map', () => {
  it('gives every go-key a distinct surface', () => {
    const ids = Object.values(GO_KEYS);
    expect(new Set(ids).size).toBe(ids.length);
    // Every letter is a single character, or the two-stroke sequence breaks.
    for (const k of Object.keys(GO_KEYS)) expect(k).toHaveLength(1);
  });

  it('keeps its hands off a field the player is typing in', () => {
    for (const tag of ['input', 'textarea', 'select']) {
      expect(isTyping({ tagName: tag.toUpperCase() } as unknown as EventTarget)).toBe(true);
    }
    expect(isTyping({ tagName: 'BUTTON' } as unknown as EventTarget)).toBe(false);
    expect(isTyping({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget)).toBe(true);
    expect(isTyping(null)).toBe(false);
  });
});

describe('fuzzyScore', () => {
  it('matches a subsequence, not just a substring', () => {
    expect(fuzzyScore('Advance a week', 'advwk')).toBeGreaterThan(0);
    expect(fuzzyScore('Advance a week', 'zzz')).toBe(-1);
  });

  it('scores an exact prefix above a scattered match', () => {
    expect(fuzzyScore('The Census', 'census')).toBeGreaterThan(fuzzyScore('The Counting-house', 'census'));
  });

  it('treats an empty query as no opinion', () => {
    expect(fuzzyScore('anything', '')).toBe(0);
    expect(fuzzyScore('anything', '   ')).toBe(0);
  });
});

describe('matchCommands', () => {
  it('returns everything, in order, when nothing is typed', () => {
    expect(matchCommands(ALL, '').map((c) => c.id)).toEqual(ALL.map((c) => c.id));
  });

  it('puts the obvious answer first', () => {
    expect(matchCommands(ALL, 'ledger')[0]!.id).toBe('ledger');
    expect(matchCommands(ALL, 'census')[0]!.id).toBe('census');
    // "the seat" should find the Regent's Seat and not the Census.
    expect(matchCommands(ALL, 'seat')[0]!.id).toBe('seat');
  });

  it('finds by group as well as by name, so "clock" reaches the clock acts', () => {
    const ids = matchCommands(ALL, 'clock').map((c) => c.id);
    expect(ids).toContain('week');
    expect(ids).toContain('day');
  });

  it('drops what cannot match at all', () => {
    expect(matchCommands(ALL, 'qqqq')).toHaveLength(0);
  });

  it('never invents or loses commands', () => {
    for (const q of ['', 'a', 'the', 'e']) {
      const hits = matchCommands(ALL, q);
      expect(hits.length).toBeLessThanOrEqual(ALL.length);
      for (const h of hits) expect(ALL).toContain(h);
    }
  });
});
