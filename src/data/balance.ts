/**
 * Shared tunables. First-pass values; the balance bots own the final numbers.
 * Module-specific tunables live in each sim module as an exported `TUNE` object.
 */
export const BAL = {
  startGold: 120,
  /** tiles per day — the ruler / staff / visitors */
  walkSpeed: { ruler: 12, staff: 12, visitor: 5 },
  roadSpeedBonus: 1.5,
  /** days a purse waits at the door before the household spends it (then it becomes arrears) */
  purseDays: 7,
  /** days an applicant waits to be shown the place */
  applicantWaitDays: 12,
  /** base applicants per vacancy per month at renown 50, fair rent */
  applicantRate: 1.1,
  leaseTermMonths: 12,
  /** Reeve's court: days from Notice to Quit to a ruling */
  courtDays: 45,
  /** quarterly tribute falls due on the 1st of months 0, 3, 6, 9 */
  tributeMonths: [0, 3, 6, 9],
  loan: { ratePctMonth: 6, maxByRank: { reeve: 150, knight: 500, baron: 1500, duke: 4000, king: 9999 } },
  /** Iron Crown ends when debt exceeds this multiple of the rank's loan cap */
  bankruptcyMult: 1.5,
  feastCost: { reeve: 30, knight: 90, baron: 240, duke: 600, king: 1500 },
  wageBySkill: [0, 5, 8, 11, 15, 20],
  /** random (non-system) incidents per month by household count: base + perHousehold * n, capped */
  incidentRate: { base: 0.9, perHousehold: 0.16, max: 5 },
  /** months of grace at the start with no random incidents beyond the scripted ones */
  quietMonths: 1,
  renownDrift: 0.8,            // pull toward 50 per month
  seatUpgradeCost: [0, 0, 300, 900],
} as const;
