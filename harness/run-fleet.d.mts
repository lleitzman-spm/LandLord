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
  /** Steps now waiting on a human. NOT the number of records — see run-fleet.mjs. */
  proposals: number;
  /** Steps the clerks carried through unattended. */
  swept: number;
}>;
export function fleetRoster(ctx: unknown): unknown[];
export const ADVANCE_SEATS: string[];
