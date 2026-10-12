/** OWNER: sim-world agent. The work queue: who walks where to do what, and for how long. */
import type { GameState, SimModule, Job, JobRole, Id } from './types';
import { notImplemented } from './core';
const W = 'sim-world';

export type JobSpec = Pick<Job, 'kind' | 'role'> & Partial<Omit<Job, 'id' | 'kind' | 'role' | 'state' | 'assignee' | 'progress' | 'createdDay'>>;

/** Queue work. Location defaults to the building's entrance. Cost is charged (economy.spend) when work starts.
 *  When it finishes the job system sets state 'done', emits {type:'job', phase:'done'} and calls core.notifyJobDone. */
export function enqueueJob(s: GameState, spec: JobSpec): Job { return notImplemented(W, 'enqueueJob'); }
export function cancelJob(s: GameState, jobId: Id): void { notImplemented(W, 'cancelJob'); }
export function jobsAt(s: GameState, buildingId: Id): Job[] { return notImplemented(W, 'jobsAt'); }
/** Is there anyone who can take jobs of this role (the staff member exists, or role is 'ruler'/'any')? */
export function hasWorker(s: GameState, role: JobRole): boolean { return notImplemented(W, 'hasWorker'); }

export const jobsModule: SimModule = { name: 'jobs' };
