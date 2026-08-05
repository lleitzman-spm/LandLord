import { describe, expect, it, vi } from 'vitest';
import { guardComplete } from '../src/domain/contextGuard';
import { runGuardedModelWork } from '../harness/run-guard.mjs';

const factory = ({ onBlocked }: { onBlocked: (error: Error) => void }) =>
  guardComplete(
    async () => ({ message: { role: 'assistant', content: '{}' } }),
    { onBlocked },
  );

describe('one-run model poison', () => {
  it('withholds fallback events after a clerk swallows a context refusal', async () => {
    const append = vi.fn();
    const run = await runGuardedModelWork(factory, async (complete) => {
      try {
        await complete({
          messages: [{ role: 'user', content: 'review this case' }],
          context: { mobile_number: '555-0100' },
        });
      } catch {
        // Mirrors clerk Tier-0 fallback after a model failure.
      }
      return { events: [{ id: 'plausible-fallback-proposal' }] };
    });

    if (run.status === 'ok') append(run.result.events);
    expect(run.status).toBe('blocked');
    expect(append).not.toHaveBeenCalled();
  });

  it('starts the next invocation clean instead of carrying permanent poison', async () => {
    const first = await runGuardedModelWork(factory, async (complete) => {
      try {
        await complete({ messages: [{ role: 'user', content: 'tenant Alice Smith reports no heat' }] });
      } catch {
        /* swallowed fallback */
      }
      return { events: [{ id: 'discard-me' }] };
    });
    const second = await runGuardedModelWork(factory, async (complete) => {
      await complete({ messages: [{ role: 'user', content: 'symptom=no-heating' }] });
      return { events: [{ id: 'safe-proposal' }] };
    });

    expect(first.status).toBe('blocked');
    expect(second).toEqual({
      status: 'ok',
      result: { events: [{ id: 'safe-proposal' }] },
    });
  });
});
