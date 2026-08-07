// WHO ACTED — one stamp, used by both paths that write an agent's answer.
//
// `answerStep` sets no actor and its opts carry no field for one
// (`src/domain/flows.ts`), because the engine's convention is that a HUMAN act
// carries none. That convention is load-bearing and correct — right up until a
// clerk started writing `done` events too, at which point every swept
// completion read in the log as the operator's own work. That is standing HIGH
// finding #2 in `docs/HANDOFF.md`.
//
// It lives in its own module because BOTH hands need it and neither may import
// the other: `agents/rig.mjs` imports `clerks.mjs`, so `clerks.mjs` cannot
// import the rig back. One source, no drift — the same reason `run-fleet.mjs`
// exists.
//
// Only the `done` is stamped. `completeStep` returns `[done, next hand]`, and
// the hand is the cascade moving rather than an act by anyone; stamping it
// would assert the agent did the next step too.

/** Stamp an agent's own answers with its seat, in place, and return them.
 *  Never overwrites an actor already set — a caller that knows better wins,
 *  and it keeps the stamp idempotent when both the clerk and the rig apply it. */
export function stampAgentActor(events, seat) {
  for (const e of events ?? []) {
    if (e.kind === 'done' && e.actor == null) e.actor = `agent:${seat}`;
  }
  return events;
}
