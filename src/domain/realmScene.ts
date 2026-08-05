// The Realm Scene — the one reading the living map is drawn from
// (docs/WRIT-THE-REALM-MAP.md, "The firewall — the data contract").
//
// The 3D realm renders THIS and nothing else. It computes no kingdom state: no
// faith arithmetic, no crisis detection, no who-holds-what. Everything the map
// shows is folded here, from the records, against the effective clock — records
// in, readings out, exactly as the constitution commands. Nothing is stored.
//
// Positions are deliberately ABSENT from the scene. The view derives every
// position deterministically from the stable ids below (a hash → a point), so
// the same realm always draws the same and no coordinate is ever written down.
//
// The door slugs and addresses that ride the scene are the War Game's own
// working-fluid ones — the data gate is closed, no real address ever reaches
// the map.

import type { EventLog } from './events';
import { ageInDays, readCases } from './events';
import type { Kingdom } from './types';
import { doorOf, severityOf } from './consequences';
import { king, regent } from './states';
import { seatLabel } from './caselabel';
import { placements } from './pods';
import type { RealmReading } from './realm';
import type { RealmScene as ViewScene } from '../realm/scene';
import type { WarDoor } from './wargame';

// ── The contract (the SOLE input to the 3D realm) ──────────────────────────

// The map's view declares its OWN twin of these types in `src/realm/scene.ts`,
// deliberately — the firewall is that the view never imports the domain. But
// nothing checked the twins still matched, and they silently drifted: adding
// `coffers.dry` here compiled clean while the view kept reading a shape without
// it, and the error only surfaced three files later. The firewall is one-way,
// so the DOMAIN may look at the view's contract; these two assertions fail the
// build the moment either side gains, loses or renames a field.
export interface RealmScene {
  realmName: string; // "LandLord" — the hand-lettered map title
  kingName: string; // the Capital's banner
  regentName: string;
  revealed: boolean; // false ⇒ fog of war, bare parchment (no muster stands)
  fiefs: SceneFief[];
  guilds: SceneGuild[]; // for the advisor rail
  coffers: { trend: number; fallen: boolean; dry: boolean }; // the discreet HUD only
  /** The doors the map CANNOT draw, and why. A fief is a knight's book of
   *  doors, so a door whose owner rests in no knight's care has no town to
   *  stand in — it is simply absent from the drawing. On a fresh muster that
   *  is most of the realm (2 knights, 200 doors), and a map that quietly shows
   *  a third of the operation while looking complete is the worst kind of
   *  lying instrument. So the count rides the scene and the map SAYS it. */
  unheld: { doors: number; owners: number };
}

export interface SceneFief {
  id: string; // STABLE — drives the fief's position on the continent
  name: string; // the knight's name (hand-lettered on the map)
  seatLabel?: string;
  health: 'thriving' | 'strained' | 'failing'; // banner color + town condition
  faith: number; // 0..100 — finer prosperity tint
  doorsHeld: number;
  capacity: number; // the town's built-out potential
  buildings: SceneBuilding[];
}

export type BuildingKind = 'manor' | 'cottage' | 'chapel' | 'market' | 'well';
export type BuildingState = 'held' | 'vacant' | 'crisis';

export interface SceneBuilding {
  id: string; // STABLE door slug — drives position within the town
  kind: BuildingKind; // manor = the knight's keep
  state: BuildingState; // alive / shuttered / smoking
  label: string; // the door's address — the hover tooltip, plain voice
  /** The open matter resting on this door — the one road off the map that
   *  leads to the WORK rather than to the neighbourhood. Absent ⇒ nothing is
   *  open on it, and the map must not offer an act that would land nowhere
   *  (the dead-button fault the A/E/P check exists to catch). The oldest open
   *  case wins, which is the one that has been waiting longest for a word. */
  openCase?: string;
}

export interface SceneGuild {
  id: string;
  name: string;
  manned: boolean;
  masterName?: string; // undefined ⇒ a vacant advisor seat
}

/** The realm's name on the map — the trade name, hand-lettered. */
export const REALM_NAME = 'LandLord';

// ── The stable slug + hash (the view's position keys) ───────────────────────

/** A door address made an id: lowercased, every run of anything but a letter
 *  or a digit collapsed to a dash. Stable for the life of the address, which
 *  is what the view hashes into a position. */
export function doorSlug(address: string): string {
  return address
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** FNV-1a over an id — the same little hash the view uses to place things.
 *  Deterministic, never random: the realm draws the same on every reload. */
export function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// ── The doors' state, folded from the log ──────────────────────────────────
//
// A door the game has leased stands HELD; a door the game speaks of but never
// leased stands VACANT (the muster leaves a few doors empty and runs the
// vacancy loop on them); a door carrying an open case that has aged into the
// crisis band stands in CRISIS, which outranks both — that is the "something is
// wrong here" the map exists to show at a glance.

const LEASE_BOX = 'lease';

/** The box segment of a war case id (`wg/<seed> · <box> · <address> …`). */
function boxOf(caseId: string, mark: string): string | null {
  const at = caseId.indexOf(mark);
  if (at < 0) return null;
  const rest = caseId.slice(at + mark.length);
  const seg = rest.split(' · ')[0];
  return seg ? seg.trim() : null;
}

/** Every door the muster speaks of, with the state the map draws it in.
 *  Keyed by the door's address (what a pod's `doors` carries). */
export function readDoorStates(
  log: EventLog,
  now: string,
  seed: string,
): Map<string, { state: BuildingState; openCase?: string }> {
  const mark = `wg/${seed} · `;
  const leased = new Set<string>();
  const inCrisis = new Set<string>();
  const known = new Set<string>();
  // The oldest OPEN matter on each door — the map's one road to the work. Age
  // decides it: the case that has waited longest is the one wanting a word.
  const pressing = new Map<string, { caseId: string; age: number }>();

  for (const c of readCases(log)) {
    if (!c.caseId.includes(mark)) continue;
    const door = doorOf(c.caseId);
    if (!door) continue;
    known.add(door);
    // A lease in good standing is settled at the instant it is signed, so it
    // reads `done` — its presence, not its openness, is what says HELD.
    if (boxOf(c.caseId, mark) === LEASE_BOX) leased.add(door);
    if (c.status !== 'done') {
      if (severityOf(c, now).band === 'crisis') inCrisis.add(door);
      const age = ageInDays(c, now) ?? 0;
      const held = pressing.get(door);
      if (!held || age > held.age) pressing.set(door, { caseId: c.caseId, age });
    }
  }

  const states = new Map<string, { state: BuildingState; openCase?: string }>();
  for (const door of known) {
    const open = pressing.get(door);
    states.set(door, {
      state: inCrisis.has(door) ? 'crisis' : leased.has(door) ? 'held' : 'vacant',
      ...(open ? { openCase: open.caseId } : {}),
    });
  }
  return states;
}

// ── The buildings of a town ────────────────────────────────────────────────

/** The kind a door is drawn as. Pure dressing — a stable spread so a town
 *  reads as a real place and not fifty identical copies — and deterministic,
 *  so the same door is always the same building. The knight's MANOR is chosen
 *  separately (one per fief, the town's anchor). */
function kindOf(slug: string): BuildingKind {
  switch (hashId(slug) % 12) {
    case 0:
      return 'chapel';
    case 1:
      return 'market';
    case 2:
      return 'well';
    default:
      return 'cottage';
  }
}

/** A pod's doors as the town's buildings — sorted by their stable slug so the
 *  town is drawn in the same order every time, the lowest-hashed door standing
 *  as the knight's manor-keep. */
function buildingsOf(
  doors: string[],
  states: Map<string, { state: BuildingState; openCase?: string }>,
): SceneBuilding[] {
  const rows = [...new Set(doors)]
    .map((address) => ({ address, slug: doorSlug(address) }))
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  if (rows.length === 0) return [];

  // The manor is the lowest-hashed door — a stable pick that does not shift
  // when a door is added or a lease turns over.
  let manor = 0;
  for (let i = 1; i < rows.length; i++) {
    if (hashId(rows[i].slug) < hashId(rows[manor].slug)) manor = i;
  }

  return rows.map((row, i): SceneBuilding => {
    const read = states.get(row.address);
    return {
      id: row.slug,
      kind: i === manor ? 'manor' : kindOf(row.slug),
      state: read?.state ?? 'vacant',
      label: row.address,
      ...(read?.openCase ? { openCase: read.openCase } : {}),
    };
  });
}

// ── The reading ────────────────────────────────────────────────────────────

/** The doors the muster's roster names that the LOG never speaks of — the ones
 *  standing empty, which is precisely why nothing ever happened on them. They
 *  have no case, so no Patron reading carries them; without this they would be
 *  invisible on a map whose whole job is showing where the empties are. The
 *  roster is a record (the muster's own `doors`), so reading it breaks no law.
 *  Attributed to a knight through the placement of the door's owner. */
function vacantsByKnight(log: EventLog, seed: string, roster: WarDoor[]): Map<string, string[]> {
  const spoken = new Set<string>();
  const mark = `wg/${seed} · `;
  for (const c of readCases(log)) {
    if (!c.caseId.includes(mark)) continue;
    const door = doorOf(c.caseId);
    if (door) spoken.add(door);
  }
  const knightOfOwner = placements(log, seed);
  const byKnight = new Map<string, string[]>();
  for (const door of roster) {
    if (spoken.has(door.address)) continue;
    const knight = knightOfOwner.get(door.owner);
    if (!knight) continue; // an owner in no knight's care — no town to stand in
    const list = byKnight.get(knight);
    if (list) list.push(door.address);
    else byKnight.set(knight, [door.address]);
  }
  return byKnight;
}

/** Fold the whole scene the living map draws. `realm` is the Regent's reading
 *  already in hand (the pods, the guilds, the coffers) — this adds only what
 *  the map needs on top of it: the doors' states and the map's own dressing.
 *  `roster` is the standing muster's door book (`wargame.doors`), which alone
 *  names the doors nothing has ever happened on. Pure; `now` injected (game
 *  time under a War Game). */
export function readRealmScene(
  kingdom: Kingdom,
  log: EventLog,
  now: string,
  seed: string | null,
  realm: RealmReading,
  roster: WarDoor[] = [],
): RealmScene {
  const states = seed ? readDoorStates(log, now, seed) : new Map<string, { state: BuildingState; openCase?: string }>();
  const empties = seed ? vacantsByKnight(log, seed, roster) : new Map<string, string[]>();

  const fiefs: SceneFief[] = realm.pods.map((pod) => {
    const seat = seatLabel(pod.knightId);
    const buildings = buildingsOf(
      [...pod.doors, ...(empties.get(pod.knightId) ?? [])],
      states,
    );
    return {
      id: pod.knightId,
      name: pod.knightName,
      ...(seat && seat !== pod.knightId ? { seatLabel: seat } : {}),
      health: pod.health,
      faith: pod.faith,
      // The doors the knight actually keeps — every building but the shuttered
      // ones. (A door in crisis is still held; it is just in trouble.)
      doorsHeld: buildings.filter((b) => b.state !== 'vacant').length,
      capacity: pod.capacity,
      buildings,
    };
  });

  const guilds: SceneGuild[] = realm.guilds.map((g) => ({
    id: g.guild.id,
    name: g.guild.name,
    manned: g.manned,
    ...(g.master ? { masterName: g.master.name } : {}),
  }));

  return {
    realmName: REALM_NAME,
    kingName: king(kingdom)?.name ?? 'The Crown',
    regentName: regent(kingdom)?.name ?? 'The Regent',
    // No muster stands ⇒ the land lies unrevealed: bare parchment, the ink
    // compass, and the invitation to sound the war horn.
    revealed: seed !== null,
    fiefs,
    guilds,
    coffers: { trend: realm.coffers.trend, fallen: realm.coffers.fallen, dry: realm.coffers.dry },
    unheld: {
      doors: realm.unplaced.reduce((n, p) => n + p.doors.length, 0),
      owners: realm.unplaced.length,
    },
  };
}

// ── The twin check ─────────────────────────────────────────────────────────
// Assignable BOTH ways = structurally identical. A field added on one side
// only, or renamed, breaks this and nothing else has to notice.
type _SceneMatchesView = RealmScene extends ViewScene ? true : never;
type _ViewMatchesScene = ViewScene extends RealmScene ? true : never;
const _twinCheck: [_SceneMatchesView, _ViewMatchesScene] = [true, true];
void _twinCheck;
