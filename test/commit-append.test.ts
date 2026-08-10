// A long job's work must survive a concurrent writer. The clerk fleet reasons
// for a MINUTE before it has anything to write, while the Regent's own board
// is live on the same document — so the naive read-then-CAS threw the whole
// minute away the first time Edwin ran it on the live castle ("the clerks could
// not work: the vault moved under the fleet", 2026-07-27). This is the guard.
import { describe, it, expect } from 'vitest';
import { commitAppend, type AppendDoc } from '../src/server/vault';

/** A vault that accepts a write only when the base rev still matches — the CAS
 *  the real one performs — and that a test can move under the job at will. */
function fakeVault(start: AppendDoc) {
  let stored: AppendDoc = { ...start };
  let reads = 0;
  let writes = 0;
  return {
    get doc() {
      return stored;
    },
    get reads() {
      return reads;
    },
    get writes() {
      return writes;
    },
    /** A concurrent writer appends its own event and bumps the rev. */
    someoneElseWrites(id: string) {
      stored = {
        ...stored,
        events: [...(stored.events ?? []), { id }],
        rev: (stored.rev as number) + 1,
      };
    },
    read: async () => {
      reads++;
      return { ...stored };
    },
    write: async (next: AppendDoc, baseRev: number) => {
      writes++;
      if (baseRev !== (stored.rev as number)) return 'conflict' as const;
      stored = next;
      return 'ok' as const;
    },
  };
}

const ids = (d: AppendDoc) => (d.events ?? []).map((e) => (e as { id: string }).id);

describe('commitAppend — a minute of reasoning survives a concurrent write', () => {
  it('commits straight through when nothing moved', async () => {
    const v = fakeVault({ rev: 4, events: [{ id: 'a' }] });
    const r = await commitAppend({
      base: v.doc,
      events: [{ id: 'clerk-1', kind: 'proposed' }],
      read: v.read,
      write: v.write,
    });
    expect(r).toBe('ok');
    expect(ids(v.doc)).toEqual(['a', 'clerk-1']);
    expect(v.doc.rev).toBe(5);
    expect(v.reads).toBe(0); // no need to re-read when the first write lands
  });

  it('REPLAYS onto the fresh doc when the board wrote mid-run — losing neither', async () => {
    const v = fakeVault({ rev: 4, events: [{ id: 'a' }] });
    const base = { ...v.doc }; // what the fleet read a minute ago
    v.someoneElseWrites('the-stewards-own-edit'); // ...and the board wrote since

    const r = await commitAppend({
      base,
      events: [{ id: 'clerk-1', kind: 'proposed' }, { id: 'clerk-2', kind: 'proposed' }],
      read: v.read,
      write: v.write,
    });

    expect(r).toBe('ok');
    // The other writer's record is NOT overwritten, and the clerks' work is NOT
    // thrown away: both stand, and the rev moves once past the writer that won.
    expect(ids(v.doc)).toEqual(['a', 'the-stewards-own-edit', 'clerk-1', 'clerk-2']);
    expect(v.doc.rev).toBe(6);
  });

  it('keeps replaying while the vault keeps moving, and never re-reasons', async () => {
    const v = fakeVault({ rev: 1, events: [] });
    const base = { ...v.doc }; // what the fleet read a minute ago
    v.someoneElseWrites('edit-0'); // the board wrote while it reasoned...
    let more = 1;
    const write: typeof v.write = async (next, baseRev) => {
      // ...and again, in the breath between this retry's read and its write —
      // once, then it goes quiet.
      if (more-- > 0) v.someoneElseWrites('edit-1');
      return v.write(next, baseRev);
    };
    const r = await commitAppend({ base, events: [{ id: 'clerk-1', kind: 'proposed' }], read: v.read, write });
    expect(r).toBe('ok');
    expect(ids(v.doc)).toEqual(['edit-0', 'edit-1', 'clerk-1']);
    // The clerks' batch is appended ONCE however many times it was replayed.
    expect(ids(v.doc).filter((i) => i === 'clerk-1')).toHaveLength(1);
  });

  it('gives up honestly if the vault never stops moving', async () => {
    const v = fakeVault({ rev: 1, events: [] });
    const base = { ...v.doc };
    let n = 0;
    // A writer that never yields: it lands between every read and its write.
    const write: typeof v.write = async (next, baseRev) => {
      v.someoneElseWrites(`edit-${n++}`);
      return v.write(next, baseRev);
    };
    const r = await commitAppend({ base, events: [{ id: 'clerk-1', kind: 'proposed' }], read: v.read, write });
    expect(r).toBe('conflict');
    expect(v.writes).toBe(4); // bounded — it does not spin forever
    expect(ids(v.doc)).not.toContain('clerk-1');
  });

  it('an unreadable vault is an error, not a silent loss', async () => {
    const v = fakeVault({ rev: 1, events: [] });
    const base = { ...v.doc };
    v.someoneElseWrites('x');
    const r = await commitAppend({
      base,
      events: [{ id: 'clerk-1', kind: 'proposed' }],
      read: async () => null,
      write: v.write,
    });
    expect(r).toBe('error');
  });

  // ── The batch that may NOT be replayed ────────────────────────────────────
  //
  // The replay above is safe only because a proposal parks on a human either
  // way. A COMPLETION does not: it was decided against the document as it stood
  // a minute ago — that the step was open, `auto`, and the one in hand — and
  // replaying it asserts all three again without rechecking any. These prove
  // the refusal, which costs a minute of reasoning and is worth it.

  it('REFUSES to replay a batch that completed a step, and never re-reads', async () => {
    const v = fakeVault({ rev: 4, events: [{ id: 'a' }] });
    const base = { ...v.doc };
    // The human ratifies that very step from the live board while they reason.
    v.someoneElseWrites('the-regents-own-ratification');

    const r = await commitAppend({
      base,
      events: [
        { id: 'sweep-1', kind: 'done' },
        { id: 'sweep-2', kind: 'done' },
      ],
      read: v.read,
      write: v.write,
    });

    expect(r).toBe('conflict');
    // The human's word stands untouched, and no completion was appended behind
    // it. It does not even LOOK at the fresh document: there is nothing it could
    // learn there that would make a stale decision good again.
    expect(ids(v.doc)).toEqual(['a', 'the-regents-own-ratification']);
    expect(v.reads).toBe(0);
  });

  it('refuses a MIXED batch whole — a half-advanced cascade is worse than none', async () => {
    // The sweep completes CONSECUTIVE steps, so keeping the proposals and
    // dropping the completions would leave the cascade in a state no clerk and
    // no human ever chose. All or nothing.
    const v = fakeVault({ rev: 2, events: [] });
    const base = { ...v.doc };
    v.someoneElseWrites('edit');
    const r = await commitAppend({
      base,
      events: [
        { id: 'p', kind: 'proposed' },
        { id: 'd', kind: 'done' },
      ],
      read: v.read,
      write: v.write,
    });
    expect(r).toBe('conflict');
    expect(ids(v.doc)).toEqual(['edit']);
  });

  it('an advancing batch still commits straight through when nothing moved', async () => {
    // The refusal must cost the common path nothing: attempt one always writes
    // onto the very document the job read, and there is no replay in it.
    const v = fakeVault({ rev: 4, events: [{ id: 'a' }] });
    const r = await commitAppend({
      base: v.doc,
      events: [{ id: 'sweep-1', kind: 'done' }],
      read: v.read,
      write: v.write,
    });
    expect(r).toBe('ok');
    expect(ids(v.doc)).toEqual(['a', 'sweep-1']);
  });

  it('an event of unknown shape is treated as advancing — the guard fails closed', async () => {
    const v = fakeVault({ rev: 2, events: [] });
    const base = { ...v.doc };
    v.someoneElseWrites('edit');
    // No `kind` at all. A batch this module cannot read is one it cannot vouch
    // for, and the safe answer to that is no.
    const r = await commitAppend({ base, events: [{ id: 'mystery' }], read: v.read, write: v.write });
    expect(r).toBe('conflict');
  });

  it('bootstraps a document that has no events book yet', async () => {
    const v = fakeVault({ rev: 0 });
    const r = await commitAppend({
      base: v.doc,
      events: [{ id: 'clerk-1', kind: 'proposed' }],
      read: v.read,
      write: v.write,
    });
    expect(r).toBe('ok');
    expect(ids(v.doc)).toEqual(['clerk-1']);
  });
});
