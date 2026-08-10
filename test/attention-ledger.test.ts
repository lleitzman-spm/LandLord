import { describe, expect, it } from 'vitest';
import {
  boundedMachineCandidate,
  readAttentionLedger,
  validateAttentionLog,
  type AttentionEvent,
} from '../src/domain/attention';

const opened = (workId: string, minute = 0): AttentionEvent => ({
  id: `${workId}/opened`,
  at: `2026-08-09T00:${String(minute).padStart(2, '0')}:00.000Z`,
  workId,
  kind: 'opened',
});

const classified = (
  workId: string,
  requirement: 'human-required' | 'machine-candidate',
  reversibility: 'reversible' | 'irreversible' = 'reversible',
): AttentionEvent => ({
  id: `${workId}/classified`,
  at: '2026-08-09T00:01:00.000Z',
  workId,
  kind: 'classified',
  requirement,
  avoidability: requirement === 'human-required' ? 'avoidable' : 'unavoidable',
  reversibility,
  exceptionBurden: 'none',
  confidence: 0.94,
  evidence: [{ ref: `demo-evidence/${workId}`, kind: 'test' }],
});

describe('the Attention Ledger', () => {
  it('separates human-required work from machine candidates and exposes avoidable attention', () => {
    const ledger = readAttentionLedger([
      opened('demo/work/a'),
      classified('demo/work/a', 'human-required'),
      opened('demo/work/b'),
      classified('demo/work/b', 'machine-candidate'),
    ]);

    expect(ledger.totals).toMatchObject({
      open: 2,
      humanRequired: 1,
      machineCandidate: 1,
      avoidableHuman: 1,
      unclassified: 0,
    });
    expect(ledger.open.find((entry) => entry.workId === 'demo/work/a')?.priorityReasons)
      .toContain('avoidable-human-attention');
  });

  it('keeps irreversible and material exceptions ahead without inventing a score', () => {
    const material = classified('demo/work/material', 'human-required', 'irreversible');
    material.exceptionBurden = 'material';
    const ledger = readAttentionLedger([
      opened('demo/work/routine'),
      classified('demo/work/routine', 'human-required'),
      opened('demo/work/material'),
      material,
    ]);

    expect(ledger.open[0].workId).toBe('demo/work/material');
    expect(ledger.open[0].priorityReasons).toEqual(expect.arrayContaining([
      'irreversible',
      'material-exception',
    ]));
    expect(ledger.totals.irreversibleHuman).toBe(1);
    expect(ledger.totals.materialExceptions).toBe(1);
  });

  it('attributes escalations and makes unknown attribution visible', () => {
    const events: AttentionEvent[] = [
      opened('demo/work/escalated'),
      classified('demo/work/escalated', 'human-required'),
      {
        id: 'demo/work/escalated/escalation',
        at: '2026-08-09T00:02:00.000Z',
        workId: 'demo/work/escalated',
        kind: 'escalated',
        escalationAttribution: 'unknown',
      },
    ];
    const ledger = readAttentionLedger(events);
    expect(ledger.totals).toMatchObject({ escalated: 1, unattributedEscalations: 1 });
    expect(ledger.open[0].priorityReasons).toContain('escalation-unattributed');
  });

  it('folds a resolution and its reversal instead of storing status', () => {
    const events: AttentionEvent[] = [
      opened('demo/work/reversible'),
      classified('demo/work/reversible', 'machine-candidate'),
      {
        id: 'demo/work/reversible/resolved',
        at: '2026-08-09T00:02:00.000Z',
        workId: 'demo/work/reversible',
        kind: 'resolved',
      },
      {
        id: 'demo/work/reversible/reversed',
        at: '2026-08-09T00:03:00.000Z',
        workId: 'demo/work/reversible',
        kind: 'reversed',
        reverses: 'demo/work/reversible/resolved',
      },
    ];
    expect(readAttentionLedger(events).open).toHaveLength(1);
    expect(validateAttentionLog(events)).toEqual([]);
  });
});

describe('the narrow machine-act gate', () => {
  it('admits only an evidenced, confident, reversible, exception-free candidate', () => {
    const ledger = readAttentionLedger([
      opened('demo/work/human'),
      classified('demo/work/human', 'human-required'),
      opened('demo/work/machine'),
      classified('demo/work/machine', 'machine-candidate'),
    ]);
    expect(boundedMachineCandidate([
      opened('demo/work/human'),
      classified('demo/work/human', 'human-required'),
      opened('demo/work/machine'),
      classified('demo/work/machine', 'machine-candidate'),
    ])?.workId).toBe('demo/work/machine');
  });

  it('rejects an irreversible machine classification at validation and at the act gate', () => {
    const invalid = classified('demo/work/unsafe', 'machine-candidate', 'irreversible');
    const events = [opened('demo/work/unsafe'), invalid];
    expect(validateAttentionLog(events)).toContain(
      'irreversible work cannot be a machine candidate: demo/work/unsafe/classified',
    );
    expect(boundedMachineCandidate(events)).toBeNull();
  });

  it('rejects authority fields smuggled onto a later event', () => {
    const events = [
      opened('demo/work/smuggled'),
      classified('demo/work/smuggled', 'human-required'),
      {
        id: 'demo/work/smuggled/escalated',
        at: '2026-08-09T00:02:00.000Z',
        workId: 'demo/work/smuggled',
        kind: 'escalated',
        escalationAttribution: 'system',
        requirement: 'machine-candidate',
      } as AttentionEvent,
    ];
    expect(validateAttentionLog(events)).toContain(
      'field is not permitted on escalated: demo/work/smuggled/escalated.requirement',
    );
    expect(readAttentionLedger(events).open[0].requirement).toBe('human-required');
    expect(boundedMachineCandidate(events)).toBeNull();
  });

  it('rejects a duplicate reversal of an obsolete resolution', () => {
    const workId = 'demo/work/double-reversal';
    const events: AttentionEvent[] = [
      opened(workId),
      classified(workId, 'machine-candidate'),
      { id: `${workId}/resolved-1`, at: '2026-08-09T00:02:00.000Z', workId, kind: 'resolved' },
      { id: `${workId}/reversed-1`, at: '2026-08-09T00:03:00.000Z', workId, kind: 'reversed', reverses: `${workId}/resolved-1` },
      { id: `${workId}/resolved-2`, at: '2026-08-09T00:04:00.000Z', workId, kind: 'resolved' },
      { id: `${workId}/reversed-old`, at: '2026-08-09T00:05:00.000Z', workId, kind: 'reversed', reverses: `${workId}/resolved-1` },
    ];
    expect(validateAttentionLog(events)).toContain(
      `reversal target is not the active unreversed resolution: ${workId}/reversed-old`,
    );
    expect(readAttentionLedger(events).entries[0].status).toBe('resolved');
    expect(boundedMachineCandidate(events)).toBeNull();
  });

  it('fails validation when evidence or confidence is absent', () => {
    const incomplete = classified('demo/work/incomplete', 'machine-candidate');
    delete incomplete.evidence;
    delete incomplete.confidence;
    expect(validateAttentionLog([opened('demo/work/incomplete'), incomplete])).toEqual(
      expect.arrayContaining([
        'classification lacks confidence: demo/work/incomplete/classified',
        'classification lacks evidence: demo/work/incomplete/classified',
      ]),
    );
  });
});
