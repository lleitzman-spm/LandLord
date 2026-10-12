/** OWNER: sim-world agent. The work queue: who walks where to do what, and for how long.
 *  Bodies below are thin PLACEHOLDERS so other modules can run; replace them. Keep the signatures. */
import type { GameState, SimModule, Job, JobRole, Id } from './types';
import { newId, emit } from './core';

export type JobSpec = Pick<Job, 'kind' | 'role'> & Partial<Omit<Job, 'id' | 'kind' | 'role' | 'state' | 'assignee' | 'progress' | 'createdDay'>>;

/** Queue work. Location defaults to the building's entrance. Cost is charged (economy.spend) when work starts.
 *  When it finishes the job system sets state 'done', emits {type:'job', phase:'done'} and calls core.notifyJobDone once. */
export function enqueueJob(s: GameState, spec: JobSpec): Job {
  const j: Job = { id: newId(s, 'j'), state: 'queued', assignee: null, buildingId: null, unit: null, tenantId: null, applicantId: null, incidentId: null, outcomeId: null, x: 0, y: 0, workDays: 1, progress: 0, cost: 0, priority: 0, createdDay: s.day, byRuler: false, ...spec };
  s.jobs[j.id] = j; emit(s, { type: 'job', jobId: j.id, phase: 'queued' }); return j;
}
export function cancelJob(s: GameState, jobId: Id): void { const j = s.jobs[jobId]; if (j && j.state !== 'done') { j.state = 'cancelled'; emit(s, { type: 'job', jobId, phase: 'cancel' }); delete s.jobs[jobId]; } }
export function jobsAt(s: GameState, buildingId: Id): Job[] { return Object.values(s.jobs).filter(j => j.buildingId === buildingId); }
/** Is there anyone who can take jobs of this role? (At Reeve rank the ruler does everything, so: yes.) */
export function hasWorker(_s: GameState, _role: JobRole): boolean { return true; }

export const jobsModule: SimModule = { name: 'jobs' };
