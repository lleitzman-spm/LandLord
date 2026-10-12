/** OWNER: sim-people agent. Households: rolling them, applicants, moving in and out, mood, memory. */
import type { GameState, SimModule, Tenant, Applicant, Id, MoveOutReason } from './types';
import type { Species, TradeId, TraitId } from '../data/ids';
import { notImplemented } from './core';
const W = 'sim-people';

/** Roll a household (random, or a named character from data when available and fitting). */
export function rollHousehold(s: GameState, opts?: { species?: Species; trade?: TradeId; character?: string; forBuilding?: Id }): Applicant['household'] { return notImplemented(W, 'rollHousehold'); }
/** Create an applicant for a vacant unit; spawns their actor at the gate walking to the door. Null if none fits. */
export function spawnApplicant(s: GameState, buildingId: Id, unit: number, opts?: { species?: Species; trade?: TradeId; character?: string }): Applicant | null { return notImplemented(W, 'spawnApplicant'); }
/** Sign the applicant into their unit at `rent` (default: the building's asking rent). Takes the deposit. */
export function moveIn(s: GameState, applicantId: Id, rent?: number): Tenant { return notImplemented(W, 'moveIn'); }
/** Household leaves: frees the unit, sets status, emits tenant_out. Deposit handling is rent.ts's business. */
export function moveOut(s: GameState, tenantId: Id, reason: MoveOutReason): void { notImplemented(W, 'moveOut'); }
export function changeHappiness(s: GameState, tenantId: Id, amount: number, reason?: string): void { notImplemented(W, 'changeHappiness'); }
/** Something this household will remember about the ruler (shown in their sheet, fed to the model). */
export function addMemory(s: GameState, tenantId: Id, text: string, valence: -2 | -1 | 1 | 2): void { notImplemented(W, 'addMemory'); }
export function revealTrait(s: GameState, tenantId: Id, trait: TraitId): void { notImplemented(W, 'revealTrait'); }
export function housed(s: GameState): Tenant[] { return notImplemented(W, 'housed'); }
export function tenantsOf(s: GameState, buildingId: Id): Tenant[] { return notImplemented(W, 'tenantsOf'); }
/** Housed households within `radius` tiles of the building (excluding its own). */
export function neighborsOf(s: GameState, buildingId: Id, radius: number): Tenant[] { return notImplemented(W, 'neighborsOf'); }
export function householdCount(s: GameState): number { return notImplemented(W, 'householdCount'); }
export function avgHappiness(s: GameState): number { return notImplemented(W, 'avgHappiness'); }

export const tenantsModule: SimModule = { name: 'tenants' };
