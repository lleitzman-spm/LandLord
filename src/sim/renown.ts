/** OWNER: sim-people agent. Standing with tenants (renown) and with the Crown (favor). */
import type { GameState, SimModule } from './types';
import { BAL } from '../data/balance';
import { clamp, clamp100, emit } from './core';

export const TUNE = {
  /** renown is pulled toward this blend of 50 and the realm's average happiness */
  happinessShare: 0.5,
};

/** Raise or lower the realm's name among tenants. Clamped 0..100; emits the change actually applied. */
export function changeRenown(s: GameState, amount: number, reason?: string): void {
  if (!Number.isFinite(amount) || amount === 0) return;
  const before = Number.isFinite(s.renown) ? s.renown : 50;
  s.renown = clamp100(before + amount);
  const applied = s.renown - before;
  if (applied === 0) return;
  emit(s, { type: 'renown', amount: applied, ...(reason ? { reason } : {}) });
}

/** Raise or lower standing with the Crown. Clamped 0..100; emits the change actually applied. */
export function changeFavor(s: GameState, amount: number, reason?: string): void {
  if (!Number.isFinite(amount) || amount === 0) return;
  const before = Number.isFinite(s.favor) ? s.favor : 50;
  s.favor = clamp100(before + amount);
  const applied = s.favor - before;
  if (applied === 0) return;
  emit(s, { type: 'favor', amount: applied, ...(reason ? { reason } : {}) });
}

/** Where renown is drifting: half indifference, half how the households actually feel. */
export function renownTarget(s: GameState): number {
  let n = 0, sum = 0;
  for (const t of Object.values(s.tenants)) if (t.status === 'housed') { n++; sum += t.happiness; }
  const avg = n ? sum / n : 50;
  return clamp100(50 * (1 - TUNE.happinessShare) + avg * TUNE.happinessShare);
}

export const renownModule: SimModule = {
  name: 'renown',

  onMonth(s) {
    const before = Number.isFinite(s.renown) ? s.renown : 50;
    const diff = renownTarget(s) - before;
    if (Math.abs(diff) < 0.05) return;
    // BAL.renownDrift points a month for a middling gap; less when close, more when the gap is wide
    const step = Math.min(Math.abs(diff), BAL.renownDrift * clamp(Math.abs(diff) / 8, 0.25, 3));
    s.renown = clamp100(before + Math.sign(diff) * step);
    // the drift is slow and fractional: only announce it when the figure people see has moved
    const shown = Math.round(s.renown) - Math.round(before);
    if (shown !== 0) emit(s, { type: 'renown', amount: shown, reason: 'drift' });
  },
};
