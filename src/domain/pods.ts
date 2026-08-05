// The pods — the fiefs of the reconciled realm (docs/WRIT-THE-LAND.md, Phase 2;
// docs/KINGDOM.md, "The realm remodeled"). A POD is a knight's book of business:
// a set of OWNERS (the Patrons) and their DOORS (the LAND). The realm grows by
// RECRUITING knights to hold new pods. This is the top-level holding the metaphor
// was missing — "LandLord" finally has land.
//
// Reading-first and events-only, as the constitution commands (the law K3's pass
// broke and this build keeps): owners and doors are FOLDED from the War Game log
// (readPatrons already reads an owner with its doors and its faith); the only new
// records are the Regent's deliberate acts — a COMMISSION (recruit a knight) and
// a PLACEMENT (put an owner in a knight's care) — appended as events and marked
// `wg/<seed>` so Reset strikes them. Nothing about a pod is stored; the registry
// is folded fresh every read. a firm's real ~500-door books load at the gate; the
// synthetic owners/doors/knights are working fluid.

import type { EventLog } from './events';
import type { PatronReading } from './consequences';
import { readPatrons } from './consequences';
import { RENT_PER_DOOR } from './treasury';

/** Working fluid: the doors one knight's pod can hold before it is full — the
 *  Master Plan's "~500 units per agent." A setting tunes it at the gate. */
export const POD_CAPACITY = 500;

// ── The event conventions the seat and the agents share ─────────────────────
// A commission opens a pod (a recruited knight, before any owner is placed); a
// placement moves an owner into a knight's care. Both are war-scoped: their ids
// bear the `wg/<seed>` mark so Reset strikes exactly a game's allocations.

export function commissionCaseId(seed: string, knightId: string): string {
  return `wg/${seed} · knighthood · ${knightId}`;
}
export function placementCaseId(seed: string, owner: string): string {
  return `wg/${seed} · placement · ${owner}`;
}

/** The owner a placement case names, or null — the segment after `placement · `. */
function ownerOfPlacement(caseId: string, mark: string): string | null {
  const at = caseId.indexOf(mark);
  return at < 0 ? null : caseId.slice(at + mark.length).trim() || null;
}

/** The latest knight each owner is placed with, folded from placement events
 *  (last write wins — an owner can be re-placed). */
export function placements(log: EventLog, seed: string): Map<string, string> {
  const mark = `wg/${seed} · placement · `;
  const byOwner = new Map<string, { at: string; knight: string }>();
  for (const e of log) {
    if (!e.caseId.includes(mark) || !e.holder) continue;
    const owner = ownerOfPlacement(e.caseId, mark);
    if (!owner) continue;
    const prev = byOwner.get(owner);
    if (!prev || e.at >= prev.at) byOwner.set(owner, { at: e.at, knight: e.holder });
  }
  return new Map([...byOwner].map(([owner, v]) => [owner, v.knight]));
}

/** The knights of a muster and their names — folded from commission events (a
 *  recruited knight, even with an empty pod) and from any placement that names a
 *  holder (a knight who already keeps owners). A knight's display name rides its
 *  commission note; else the id stands. */
export function knightsOf(log: EventLog, seed: string): Map<string, string> {
  const cMark = `wg/${seed} · knighthood · `;
  const names = new Map<string, string>();
  for (const e of log) {
    if (e.kind === 'opened' && e.caseId.includes(cMark) && e.holder) {
      names.set(e.holder, nameFromNote(e.note) ?? e.holder);
    }
  }
  for (const knight of placements(log, seed).values()) {
    if (!names.has(knight)) names.set(knight, knight);
  }
  return names;
}

/** A knight's name carried on the commission note ("Sir <name> is commissioned…"). */
function nameFromNote(note: string | undefined): string | null {
  const m = note?.match(/^([^—.]+?) is commissioned/);
  return m ? m[1].trim() : null;
}

export type PodHealth = 'thriving' | 'strained' | 'failing';

export interface PodReading {
  knightId: string;
  knightName: string;
  /** The owners in this knight's care (the Patrons placed with them). */
  owners: PatronReading[];
  /** The land: every door of the pod's owners. */
  doors: string[];
  /** Doors of still-faithful owners — tribute rides these. */
  retainedDoors: number;
  /** Aggregate faith across the pod's owners (100 for an empty pod). */
  faith: number;
  crises: number;
  filled: number; // doors held
  capacity: number;
  /** The pod's rent roll per month — the rent the knight collects on the
   *  retained doors (the owner's money). The Crown's fee is a slice of this. */
  rent: number;
  health: PodHealth;
}

function healthOf(faith: number, crises: number, withdrawn: number): PodHealth {
  if (withdrawn > 0 || faith <= 40) return 'failing';
  if (crises > 0 || faith < 90) return 'strained';
  return 'thriving';
}

/** The pods of a muster: each knight with the owners in their care, their land,
 *  faith, and the tribute the book earns. Folded from the placements (records)
 *  and the Patrons (readings). Pure, `now`-injected. */
export function readPods(log: EventLog, now: string, seed: string): PodReading[] {
  const patrons = readPatrons(log, now, seed);
  const byName = new Map(patrons.map((p) => [p.name, p]));
  const placed = placements(log, seed);
  const knights = knightsOf(log, seed);

  const podOf = new Map<string, PatronReading[]>();
  for (const knightId of knights.keys()) podOf.set(knightId, []);
  for (const [owner, knightId] of placed) {
    const patron = byName.get(owner);
    if (!patron) continue;
    if (!podOf.has(knightId)) {
      podOf.set(knightId, []);
      knights.set(knightId, knights.get(knightId) ?? knightId);
    }
    podOf.get(knightId)!.push(patron);
  }

  return [...podOf.entries()]
    .map(([knightId, owners]) => {
      const doors = owners.flatMap((o) => o.doors);
      const retained = owners.filter((o) => !o.withdrawn).flatMap((o) => o.doors).length;
      const withdrawn = owners.filter((o) => o.withdrawn).length;
      const crises = owners.reduce((n, o) => n + o.crises, 0);
      const faith = owners.length
        ? Math.round(owners.reduce((s, o) => s + o.faith, 0) / owners.length)
        : 100;
      return {
        knightId,
        knightName: knights.get(knightId) ?? knightId,
        owners,
        doors,
        retainedDoors: retained,
        faith,
        crises,
        filled: doors.length,
        capacity: POD_CAPACITY,
        rent: retained * RENT_PER_DOOR,
        health: healthOf(faith, crises, withdrawn),
      };
    })
    .sort((a, b) => a.faith - b.faith || b.filled - a.filled);
}

/** The owners entrusted to the realm but in NO knight's care — the Regent's
 *  new allocation debt (an owner not yet placed, as an unlorded fief was
 *  undelegated land). Most-at-risk first. */
export function unplacedOwners(log: EventLog, now: string, seed: string): PatronReading[] {
  const placed = placements(log, seed);
  return readPatrons(log, now, seed)
    .filter((p) => !placed.has(p.name))
    .sort((a, b) => a.faith - b.faith);
}

/** Empty pods — knights recruited but keeping no owner yet: the room to grow,
 *  and where unplaced owners want placing. */
export function emptyPods(pods: PodReading[]): PodReading[] {
  return pods.filter((p) => p.owners.length === 0);
}
