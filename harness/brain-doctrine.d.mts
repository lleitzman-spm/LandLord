export function brainFor(
  seat: string,
  taskType: string,
): { tier: number; model: string | null; fallback: string; escalate?: { tier: number; model: string } };
