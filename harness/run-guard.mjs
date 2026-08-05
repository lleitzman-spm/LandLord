/**
 * One model-using run, one poison flag. Clerks deliberately catch brain errors
 * and fall back, so the caller cannot rely on an exception to stop persistence.
 * This wrapper remembers a context refusal and withholds the run's result
 * entirely, even when the worker function returns plausible fallback events.
 *
 * State lives inside this invocation. A later run always starts clean.
 */
export async function runGuardedModelWork(makeComplete, work) {
  let blocked = null;
  const complete = makeComplete({
    onBlocked(error) {
      blocked ??= error;
    },
  });
  const result = await work(complete);
  return blocked
    ? { status: 'blocked', error: blocked }
    : { status: 'ok', result };
}
