export function runFleet(opts: {
  doc: unknown;
  now: string;
  core: unknown;
  complete: unknown;
  brainFor: unknown;
  cap?: number;
}): Promise<{
  events: unknown[];
  perClerk: { seat: string; label: string; tier: number; model: string | null; records: string[] }[];
  proposals: number;
}>;
export function fleetRoster(ctx: unknown): unknown[];
export const ADVANCE_SEATS: string[];
