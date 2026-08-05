// The Realm Scene reading — the firewall the living map is drawn through
// (docs/WRIT-THE-REALM-MAP.md). The map renders this and computes nothing, so
// everything the map can possibly show has to be true HERE.
import { describe, it, expect } from 'vitest';
import { foundingDoc, grandMusterDoc } from './fixtures';
import { readRealm } from '../src/domain/realm';
import {
  readRealmScene,
  readDoorStates,
  doorSlug,
  hashId,
  REALM_NAME,
} from '../src/domain/realmScene';
import { FOUNDING_ECONOMY } from '../src/domain/economy';
import { EMPTY_TREASURY } from '../src/domain/treasury';
import type { RealmScene as DomainScene } from '../src/domain/realmScene';
import type { Chronicle } from '../src/domain/chronicle';
import { assembleKingdom } from '../src/domain/court';
import {
  SAMPLE_REALM,
  SAMPLE_REALM_UNREVEALED,
  fullMuster,
  type RealmScene as ViewScene,
} from '../src/realm/scene';

function sceneOf(doc: Chronicle, seed: string | null, now: string) {
  const kingdom = assembleKingdom(doc.census, doc.acts);
  const realm = readRealm(
    kingdom,
    doc.events,
    now,
    seed,
    doc.treasury ?? EMPTY_TREASURY,
    doc.economy ?? FOUNDING_ECONOMY,
    doc.money ?? [],
  );
  return readRealmScene(kingdom, doc.events, now, seed, realm, doc.wargame?.doors ?? []);
}

describe('WRIT-THE-REALM-MAP — readRealmScene, the map’s sole input', () => {
  it('no muster stands ⇒ the land lies UNREVEALED, and no town is drawn', () => {
    const doc = foundingDoc();
    const scene = sceneOf(doc, null, '2026-07-21T00:00:00.000Z');
    expect(scene.revealed).toBe(false);
    expect(scene.fiefs).toEqual([]);
    // The frame still stands: the map's title, the Crown's banner, the rail.
    expect(scene.realmName).toBe(REALM_NAME);
    expect(scene.kingName).toBeTruthy();
    expect(scene.regentName).toBeTruthy();
    expect(scene.guilds.length).toBeGreaterThan(0);
    expect(scene.guilds.some((g) => g.manned)).toBe(true);
    // The refounded census mans all three Crown offices, so a vacant advisor
    // seat has to be MADE rather than assumed: strike a Chancellor's grant and
    // the craft must read as unmanned, with no master named.
    const bare = foundingDoc();
    bare.acts.grants = bare.acts.grants.filter((g) => g.territoryId !== 'office-works');
    const short = sceneOf(bare, null, '2026-07-21T00:00:00.000Z');
    expect(short.guilds.some((g) => !g.manned && g.masterName === undefined)).toBe(true);
  });

  it('a standing muster reveals a realm of towns, every door a building', () => {
    const { doc } = grandMusterDoc();
    const now = doc.wargame!.now;
    const scene = sceneOf(doc, doc.wargame!.seed, now);

    expect(scene.revealed).toBe(true);
    expect(scene.fiefs.length).toBeGreaterThan(0);

    const realm = readRealm(
      assembleKingdom(doc.census, doc.acts),
      doc.events,
      now,
      doc.wargame!.seed,
      EMPTY_TREASURY,
      FOUNDING_ECONOMY,
      doc.money ?? [],
    );
    // Every pod becomes a fief; every door of a pod becomes a building.
    expect(scene.fiefs.map((f) => f.id)).toEqual(realm.pods.map((p) => p.knightId));
    for (const [i, fief] of scene.fiefs.entries()) {
      const pod = realm.pods[i];
      expect(fief.health).toBe(pod.health);
      expect(fief.faith).toBe(pod.faith);
      expect(fief.capacity).toBe(pod.capacity);
      // Every door the log speaks of stands in the town — plus the empties the
      // roster names, which no case ever touches.
      for (const door of new Set(pod.doors)) {
        expect(fief.buildings.some((b) => b.label === door)).toBe(true);
      }
      expect(fief.buildings.length).toBeGreaterThanOrEqual(new Set(pod.doors).size);
      expect(fief.doorsHeld).toBe(fief.buildings.filter((b) => b.state !== 'vacant').length);
    }
  });

  it('every town has exactly ONE manor, and every building a stable slug id', () => {
    const { doc } = grandMusterDoc();
    const scene = sceneOf(doc, doc.wargame!.seed, doc.wargame!.now);
    const seen = new Set<string>();
    for (const fief of scene.fiefs) {
      if (fief.buildings.length === 0) continue;
      expect(fief.buildings.filter((b) => b.kind === 'manor')).toHaveLength(1);
      for (const b of fief.buildings) {
        expect(b.id).toMatch(/^[a-z0-9-]+$/);
        expect(b.id).toBe(doorSlug(b.label));
        expect(seen.has(b.id)).toBe(false); // a door belongs to one town only
        seen.add(b.id);
      }
    }
    expect(seen.size).toBeGreaterThan(50); // a real muster, not a toy
  });

  it('the doors read held / vacant / crisis — all three states are drawn', () => {
    const { doc } = grandMusterDoc();
    const scene = sceneOf(doc, doc.wargame!.seed, doc.wargame!.now);
    const states = scene.fiefs.flatMap((f) => f.buildings.map((b) => b.state));
    expect(states.filter((s) => s === 'held').length).toBeGreaterThan(0);
    expect(states.filter((s) => s === 'vacant').length).toBeGreaterThan(0);
    expect(states.filter((s) => s === 'crisis').length).toBeGreaterThan(0);
    expect(new Set(states).size).toBe(3);
  });

  it('a crisis on a leased door OUTRANKS its lease — the map shows trouble', () => {
    const { doc } = grandMusterDoc();
    const seed = doc.wargame!.seed;
    const now = doc.wargame!.now;
    const before = readDoorStates(doc.events, now, seed);
    const held = [...before.entries()].find(([, s]) => s.state === 'held')![0];

    // Open a case on that door and let the clock rot it into the crisis band.
    doc.events.push({
      id: 'test-crisis-1',
      at: '2026-01-01T00:00:00.000Z',
      caseId: `wg/${seed} · repair · ${held}`,
      kind: 'opened',
      holder: 'alys',
      note: 'A leak no one has answered.',
    });
    const after = readDoorStates(doc.events, now, seed);
    expect(after.get(held)!.state).toBe('crisis');
    // ...and the door now carries the road to the very matter that rotted it,
    // so the map can lead to the WORK and not merely to the neighbourhood.
    expect(after.get(held)!.openCase).toBe(`wg/${seed} · repair · ${held}`);
  });

  it('the scene is PURE — the same records fold the same map, twice', () => {
    const { doc } = grandMusterDoc();
    const a = sceneOf(doc, doc.wargame!.seed, doc.wargame!.now);
    const b = sceneOf(doc, doc.wargame!.seed, doc.wargame!.now);
    expect(b).toEqual(a);
    // ...and it carries NO position: the view derives those from the ids.
    expect(JSON.stringify(a)).not.toMatch(/"(x|y|z|position)"/);
  });

  it('the id hash is stable and well spread — the view places from it', () => {
    expect(hashId('harrow-c')).toBe(hashId('harrow-c'));
    expect(hashId('harrow-c')).not.toBe(hashId('harrow-d'));
    expect(doorSlug('12 Harrow Row, Unit C')).toBe('12-harrow-row-unit-c');
    const spread = new Set(
      Array.from({ length: 200 }, (_, i) => hashId(`door-${i}`) % 64),
    );
    expect(spread.size).toBeGreaterThan(40); // no clumping into a few points
  });

  it('the reading and the VIEW’s contract are the same shape — the firewall holds', () => {
    // The view declares its own copy of the contract (it must never import the
    // domain), so the two can drift apart silently — a field renamed on one
    // side is a field the map quietly stops showing. This is the seam that
    // guards it: the reading's output must satisfy the view's type, and the
    // canned fixture must satisfy the reading's.
    const { doc } = grandMusterDoc();
    const folded: ViewScene = sceneOf(doc, doc.wargame!.seed, doc.wargame!.now);
    const canned: DomainScene = SAMPLE_REALM;
    expect(Object.keys(folded).sort()).toEqual(Object.keys(canned).sort());

    // The UNION of keys across every door on each side, not the first door's:
    // `openCase` is present only where a matter stands open, so comparing one
    // arbitrary door compares whether that door happened to be in trouble.
    const keysOf = (s: { fiefs: { buildings: object[] }[] }) =>
      [...new Set(s.fiefs.flatMap((f) => f.buildings).flatMap((b) => Object.keys(b)))].sort();
    expect(keysOf(folded)).toEqual(keysOf(canned));

    // The fixture has to exercise what the map draws, or it proves nothing.
    const states = canned.fiefs.flatMap((f) => f.buildings.map((b) => b.state));
    expect(new Set(states)).toEqual(new Set(['held', 'vacant', 'crisis']));
    expect(new Set(canned.fiefs.map((f) => f.health))).toEqual(
      new Set(['thriving', 'strained', 'failing']),
    );
    // A door with an open matter, and a door with none — the map draws a
    // different act for each, so a fixture carrying only one proves nothing.
    expect(canned.fiefs.flatMap((f) => f.buildings).some((b) => b.openCase)).toBe(true);
    expect(canned.fiefs.flatMap((f) => f.buildings).some((b) => !b.openCase)).toBe(true);
    expect(canned.guilds.some((g) => g.manned)).toBe(true);
    expect(canned.guilds.some((g) => !g.manned)).toBe(true);
    expect(SAMPLE_REALM_UNREVEALED.revealed).toBe(false);
    // And the full muster the 60fps target is measured against is really full.
    expect(fullMuster().fiefs.flatMap((f) => f.buildings).length).toBeGreaterThan(150);
    // Every door in it stands on its own plot — no id collides, or two houses
    // hash to one spot and the town looks broken.
    const ids = fullMuster().fiefs.flatMap((f) => f.buildings.map((b) => b.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('the HUD carries only the coffers’ trend, the red month and the fall — no scoreboard', () => {
    // `dry` joined `fallen` on 2026-07-27: they were ONE boolean carrying two
    // different facts, so a single red month told the Regent the kingdom had
    // fallen while the company still held its coin. Still no scoreboard — the
    // writ forbids one, and these are three flags, not a balance.
    const { doc } = grandMusterDoc();
    const scene = sceneOf(doc, doc.wargame!.seed, doc.wargame!.now);
    expect(Object.keys(scene.coffers).sort()).toEqual(['dry', 'fallen', 'trend']);
    expect(typeof scene.coffers.trend).toBe('number');
    expect(typeof scene.coffers.fallen).toBe('boolean');
    expect(typeof scene.coffers.dry).toBe('boolean');
    expect(scene).not.toHaveProperty('debt');
  });
});
