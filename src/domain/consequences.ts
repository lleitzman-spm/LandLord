// The consequence engine — neglect compounds, and the score is the kingdom's
// own health (docs/KINGDOM.md, "The task-language"; docs/WRIT-TASK-LANGUAGE.md,
// swing two 2b–2f). Ratified 2026-07-20 (Edwin): an unattended task FESTERS →
// CRISIS → the door's PATRON loses FAITH → the Patron WITHDRAWS their estate
// (their doors and their tribute) → the coffers bleed until upkeep drowns them
// → the kingdom falls.
//
// Reading-first, as the constitution commands: severity, faith, withdrawal,
// and the doors at risk are all FOLDED from age and inaction against the
// clock — never stored. The one place the clock writes is the bounded
// escalation spawn on `advance` (the rising tide, in the store), and even
// that is just appended events. Every reading here takes `now` injected, so
// under a War Game it folds against game time.
//
// The Patrons: the owners of the War Game's doors, themed — those who have
// entrusted their estates (their doors) to the Crown's keeping and pay
// tribute for it. A war-game case names its door's owner in its `opened`
// note ("Owner: <name>."); that line, folded with the case id's address, is
// the whole roster — no new record.

import type { CaseReading, EventLog } from './events';
import { readCases } from './events';

// ── The thresholds — working fluid, tuned for the proving ground ──────────
// All figures here are general mechanism, not any real firm's numbers (the leash). A
// factory setting tunes them when its real cadence loads at the gate.

/** Idle days before an open case starts to fester (the first band of harm). */
export const FESTER_DAYS = 7;
/** Idle days before an open case becomes a crisis (harm climbs steeply). */
export const CRISIS_DAYS = 14;
/** Faith at or below this floor and the Patron recalls their estate. */
export const WITHDRAW_FLOOR = 30;
/** New escalation cases the rising tide may spawn per `advance`. */
export const ESCALATION_CAP = 5;
/** The escalation spawns only once the tide has stood past crisis this long. */
export const ESCALATE_AFTER_DAYS = 3;

/** The harm one idle band is worth: festering weighs one, crisis four — a
 *  crisis erodes faith fourfold, the compounding in the number. Tuned so
 *  sustained neglect actually drives a Patron past the withdrawal floor (at
 *  three the worst only reached faith 40 and no one ever left); with teeth in
 *  the coffers (treasury WAR_HOUSEHOLD), losing Patrons can now run them red. */
const WEIGHT = { festering: 1, crisis: 4 } as const;
/** A crisis WORSENS the longer it is ignored — one more point of harm for each
 *  further week past the crisis threshold. A festering habitability issue left
 *  for two months is not the same as one left for two weeks; sustained neglect
 *  keeps eroding faith rather than plateauing, so a badly-run operation
 *  actually loses its Patrons and drowns the coffers. */
const CRISIS_WORSENS_PER_WEEK = 1;
/** The ceiling on one case's harm, so a single ancient case can't overflow. */
const MAX_HARM = 12;

// ── Severity — an open case's harm, climbing with idle age ─────────────────

export type SeverityBand = 'fresh' | 'festering' | 'crisis';

export interface Severity {
  band: SeverityBand;
  /** The faith this case erodes from its door's Patron: 0 / 1 / 3. */
  weight: number;
  /** Days since the case last moved — the idle age the bands measure. */
  idleDays: number;
}

const dayMs = 86_400_000;

/** Fold one case's severity from its idle age against `now`. A done case
 *  bears no harm — the festering stops the moment the work is settled. A
 *  case parked on a human's judgment still festers (neglect is neglect)
 *  until it is done. */
export function severityOf(c: CaseReading, now: string): Severity {
  const last = c.lastAt ?? c.openedAt;
  const ms = last ? Date.parse(now) - Date.parse(last) : 0;
  const idleDays = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / dayMs) : 0;
  if (c.status === 'done') return { band: 'fresh', weight: 0, idleDays };
  if (idleDays >= CRISIS_DAYS) {
    const weeksPast = Math.floor((idleDays - CRISIS_DAYS) / 7);
    const weight = Math.min(WEIGHT.crisis + weeksPast * CRISIS_WORSENS_PER_WEEK, MAX_HARM);
    return { band: 'crisis', weight, idleDays };
  }
  if (idleDays >= FESTER_DAYS) return { band: 'festering', weight: WEIGHT.festering, idleDays };
  return { band: 'fresh', weight: 0, idleDays };
}

/** Every open case with its severity folded in, worst first. The general
 *  reading; `severities(log, now, seed)` narrows it to one muster. */
export function severities(log: EventLog, now: string, seed?: string) {
  const mark = seed ? `wg/${seed} · ` : null;
  return readCases(log)
    .filter((c) => c.status !== 'done' && (!mark || c.caseId.includes(mark)))
    .map((c) => ({ ...c, severity: severityOf(c, now) }))
    .sort((a, b) => b.severity.weight - a.severity.weight || b.severity.idleDays - a.severity.idleDays);
}

// ── The Patrons — the owners of the game's doors, grouped from the log ─────

/** The door address a war case concerns, from the id's mark: the case id
 *  reads `wg/<seed> · <box> · <address> …` (a relay wraps it as
 *  `<template>: wg/…`, an escalation deepens it as `… · escalation · <box> ·
 *  <address> …`). The door is the segment that carries "street, unit".
 *  Null when the case names no door.
 *
 *  The address segment is normalized — a lease or relay case appends
 *  ` — <tenant>` to it, so we strip that suffix; otherwise the same physical
 *  door would count twice (once from its work, once from its lease/relay),
 *  inflating a Patron's door tally and the tribute that rides on it. */
export function doorOf(caseId: string): string | null {
  const seg = caseId.split(' · ').find((s) => s.includes(', '));
  return seg ? seg.split(' — ')[0].trim() : null;
}

/** The owner a case's `opened` note names ("Owner: <name>."), or null. */
function ownerOf(c: CaseReading): string | null {
  const note = c.events.find((e) => e.kind === 'opened')?.note;
  const at = note?.indexOf('Owner: ');
  if (note == null || at == null || at < 0) return null;
  const rest = note.slice(at + 'Owner: '.length);
  const end = rest.indexOf('.');
  return end > 0 ? rest.slice(0, end) : rest;
}

export interface PatronReading {
  /** The Patron's name (the owner as the game's rolls know him). */
  name: string;
  /** Every door of the estate the game has spoken for (leases, work, relays). */
  doors: string[];
  /** Faith in the Crown's keeping: starts at 100, eroded by the severities
   *  on the Patron's doors — each festering case 1, each crisis 3. */
  faith: number;
  festering: number;
  crises: number;
  /** The estate stands while faith holds the floor; past it, the Patron
   *  recalls their doors and their tribute (they drop out of the readings). */
  withdrawn: boolean;
}

/** The Patrons of a muster, folded from the log: the doors grouped by their
 *  owner, each estate's faith folded from the harm on its doors. Most
 *  wavering first. */
export function readPatrons(log: EventLog, now: string, seed: string): PatronReading[] {
  const mark = `wg/${seed} · `;
  const byName = new Map<string, { doors: Map<string, { harm: number; open: CaseReading[] }> }>();
  for (const c of readCases(log)) {
    if (!c.caseId.includes(mark)) continue;
    const door = doorOf(c.caseId);
    const owner = ownerOf(c);
    if (!door || !owner) continue;
    let patron = byName.get(owner);
    if (!patron) {
      patron = { doors: new Map() };
      byName.set(owner, patron);
    }
    let d = patron.doors.get(door);
    if (!d) {
      d = { harm: 0, open: [] };
      patron.doors.set(door, d);
    }
    if (c.status !== 'done') {
      d.harm += severityOf(c, now).weight;
      d.open.push(c);
    }
  }
  return [...byName.entries()]
    .map(([name, p]) => {
      const doors = [...p.doors.keys()];
      let harm = 0;
      let festering = 0;
      let crises = 0;
      for (const d of p.doors.values()) {
        harm += d.harm;
        for (const c of d.open) {
          const s = severityOf(c, now);
          if (s.band === 'crisis') crises++;
          else if (s.band === 'festering') festering++;
        }
      }
      const faith = Math.max(0, 100 - harm);
      return {
        name,
        doors,
        faith,
        festering,
        crises,
        withdrawn: faith <= WITHDRAW_FLOOR,
      };
    })
    .sort((a, b) => a.faith - b.faith);
}

/** The doors of the still-faithful Patrons — the estate the Crown still
 *  keeps; tribute rides on these (treasury.ts). */
export function retainedDoors(patrons: PatronReading[]): string[] {
  return patrons.filter((p) => !p.withdrawn).flatMap((p) => p.doors);
}

// ── The rising tide — what the clock is about to spawn ─────────────────────

/** The doors already carrying an escalation, so the tide never spawns twice
 *  on the same neglect. */
export function escalatedDoors(log: EventLog, seed: string): Set<string> {
  const mark = `wg/${seed} · escalation · `;
  const doors = new Set<string>();
  for (const e of log) {
    if (e.kind !== 'opened' || !e.caseId.includes(mark)) continue;
    const door = doorOf(e.caseId);
    if (door) doors.add(door);
  }
  return doors;
}

/** The crisis cases due to escalate: open, idle past the crisis threshold by
 *  at least `ESCALATE_AFTER_DAYS`, on a door the tide has not already struck,
 *  worst-first and capped at `ESCALATION_CAP`. This is a reading — the store
 *  turns it into events on `advance` (the one place the clock writes). */
export function escalationCandidates(
  log: EventLog,
  now: string,
  seed: string,
  cap = ESCALATION_CAP,
) {
  const struck = escalatedDoors(log, seed);
  return severities(log, now, seed)
    .filter(
      (c) =>
        c.severity.band === 'crisis' &&
        c.severity.idleDays >= CRISIS_DAYS + ESCALATE_AFTER_DAYS &&
        c.caseId.indexOf(' · escalation · ') < 0 &&
        !struck.has(doorOf(c.caseId) ?? ''),
    )
    .slice(0, cap);
}
