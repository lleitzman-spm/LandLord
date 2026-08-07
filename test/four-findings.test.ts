// The four standing findings closed 2026-08-07, each pinned by the failure it
// prevents rather than by the shape of the fix. Written as one file because
// they are one class: a check that was assumed, declared, or done in the wrong
// place — `docs/WRIT-THE-GATE.md`'s own subject.

import { describe, it, expect } from 'vitest';
import { FOUNDING_FLOWS } from '../src/domain/flows';
import { instantiateFlow, completeStep, readFlow } from '../src/domain/flows';
import { commitAppend, isPureAppend } from '../src/server/vault';
import type { KingdomEvent } from '../src/domain/events';

const AT = '2026-08-07T09:00:00.000Z';
const tpl = FOUNDING_FLOWS.find((f) => f.key === 'vendor-dispatch')!;
const ids = () => { let n = 0; return () => `t-${++n}`; };

describe('#6 — completeStep is no longer the loose door', () => {
  it('refuses to complete a step the log already records as done', () => {
    const id = ids();
    const inst = instantiateFlow(tpl, 'a door', { at: AT, id });
    const log: KingdomEvent[] = [...inst.events];
    const first = completeStep(tpl, inst.caseId, 0, { at: AT, id, log });
    expect(first.length, 'the first completion must land').toBeGreaterThan(0);
    log.push(...first);
    // The replay / double-click / second agent.
    const again = completeStep(tpl, inst.caseId, 0, { at: AT, id, log });
    expect(again, 'a step already done was completed a second time').toEqual([]);
  });

  it('still allows a legitimate completion of the step in hand', () => {
    const id = ids();
    const inst = instantiateFlow(tpl, 'a door', { at: AT, id });
    const log: KingdomEvent[] = [...inst.events];
    log.push(...completeStep(tpl, inst.caseId, 0, { at: AT, id, log }));
    const next = completeStep(tpl, inst.caseId, 1, { at: AT, id, log });
    expect(next.length, 'the guard refused work it should have allowed').toBeGreaterThan(0);
  });

  it('a double completion cannot advance the cascade twice', () => {
    const id = ids();
    const inst = instantiateFlow(tpl, 'a door', { at: AT, id });
    const log: KingdomEvent[] = [...inst.events];
    log.push(...completeStep(tpl, inst.caseId, 0, { at: AT, id, log }));
    const beforeNext = readFlow(tpl, log, inst.caseId, AT)!.next!.index;
    log.push(...completeStep(tpl, inst.caseId, 0, { at: AT, id, log }));
    expect(readFlow(tpl, log, inst.caseId, AT)!.next!.index).toBe(beforeNext);
  });
});

describe('#1 — the vault replays only what is genuinely pure append', () => {
  const ev = (kind: string): KingdomEvent =>
    ({ id: `e-${kind}`, at: AT, caseId: 'c', kind } as KingdomEvent);

  it('classifies observing batches as replayable and advancing ones as not', () => {
    expect(isPureAppend([ev('proposed'), ev('noted'), ev('awaiting')])).toBe(true);
    for (const kind of ['done', 'approved', 'overridden', 'failed']) {
      expect(isPureAppend([ev('proposed'), ev(kind)]), `${kind} must not be replayable`).toBe(false);
    }
  });

  it('an ADVANCING batch refuses to replay on conflict — it does not re-append blindly', async () => {
    let reads = 0;
    const result = await commitAppend({
      base: { events: [] },
      events: [ev('done')],
      read: async () => { reads += 1; return { events: [] }; },
      write: async () => 'conflict',
    });
    expect(result).toBe('conflict');
    expect(reads, 'an advancing batch was replayed onto a document that had moved').toBe(0);
  });

  it('an OBSERVING batch still replays, so a minute of reasoning is not thrown away', async () => {
    let writes = 0;
    const result = await commitAppend({
      base: { events: [] },
      events: [ev('proposed')],
      read: async () => ({ events: [] }),
      write: async () => (++writes < 3 ? 'conflict' : 'ok'),
    });
    expect(result).toBe('ok');
    expect(writes, 'the replay stopped working for the case it was built for').toBe(3);
  });
});
