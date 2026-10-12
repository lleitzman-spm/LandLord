/**
 * OWNER: render-buildings. The one door every building comes through.
 *
 * `createBuildingVisual(look, ctx)` picks a body (housing and the seat live in
 * ./housing and ./seat, everything else comes from ./civic, and anything
 * nobody has drawn gets a plain decent one) and wraps it in the systems every
 * building shares, working only through the body's `walls`, `roofs`,
 * `windows` and `anchors`:
 *
 *   construction  stakes and string, a scaffold, the body rising inside it   (./site, ./shell)
 *   wear          moss, bald thatch, a lean, boards, holes, a shore, weeds   (./wear)
 *   ruin          the roof in, the walls broken down, rubble, crows          (./wear, ./shell)
 *   life          candle-lit windows and flower boxes for occupied units     (./shared)
 *   TO LET        a shingle on a post by the door, swinging in the wind      (./dressing)
 *   snow          caps on the roofs, drifts at the walls                     (./shared, ./dressing)
 *   flags         purple, haunted, gargoyles, hearth_right
 *
 * `set(look)` rebuilds only what changed. `update(env)` allocates nothing: the
 * candlelight and the snow depth are shared materials driven once per frame.
 */
import * as THREE from 'three';
import type { BuildingLook, BuildingVisual, RenderCtx, Env } from '../api';
import type { BuildingType } from '../../data/ids';
import type { BuiltBody, BodyBuilder } from './types';
import { CIVIC_BUILDERS } from './civic';
import { hovel, cottage, burrow, longhouse, stonehall, townhouse, treehouse, wizardTower, genericBody, seedFor } from './housing';
import { seat } from './seat';
import { paintMat, flutter, makeRng } from './parts';
import { litMat, ghostMat, dimMat, tickShared, soupOf, snowShell, snowMesh, LIT_BANK } from './shared';
import { tierOf, repaint, buildWear, leanFor, buildRuin, wallBounds, crowGeometry, animateCrow, samePaint, type PaintSpec, type Tier, type Bounds } from './wear';
import { snapshot, makeShell, clipShell, trimShell, highPoint } from './shell';
import { buildStakes, buildScaffold } from './site';
import { makeShingle, swingShingle, makeHearthBanner, gargoyleGeometry, gargoylePerches, driftShell, type Shingle, type HearthBanner, type DriftHint } from './dressing';

/** Bodies this agent builds. Everything else is looked up in CIVIC_BUILDERS. */
export const HOUSING_BUILDERS: Partial<Record<BuildingType, BodyBuilder>> = {
  hovel, cottage, burrow, longhouse, stonehall, townhouse, treehouse, wizard_tower: wizardTower, seat,
};

const warned = new Set<string>();
function makeBody(look: BuildingLook, ctx: RenderCtx): BuiltBody {
  const builder = HOUSING_BUILDERS[look.type] ?? CIVIC_BUILDERS[look.type];
  if (builder) {
    try { return builder(look, ctx); }
    catch (err) {
      if (!warned.has(look.type)) { warned.add(look.type); console.warn('[buildings] body failed, using the plain one: ' + look.type, err); }
    }
  }
  return genericBody(look, ctx);
}

/** free every geometry under `root` that is not shared table-wide (materials are all shared) */
function disposeTree(root: THREE.Object3D): void {
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry && !m.geometry.userData.shared) m.geometry.dispose();
  });
}

const SNOW_THICK = 0.06;
/** the five faces of one column of a ruin's break: x from, x to, z from, z to, and the height it stands to */
const CELL: [THREE.Plane, THREE.Plane, THREE.Plane, THREE.Plane, THREE.Plane] = [
  new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0),
  new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Plane(new THREE.Vector3(0, 0, -1), 0),
  new THREE.Plane(new THREE.Vector3(0, -1, 0), 0),
];
// first snow of the winter: at most a few roofs are capped per frame, so sixty houses do not all pay at once
let snowFrame = -1, snowTurns = 0;
function takeSnowTurn(time: number): boolean {
  if (time !== snowFrame) { snowFrame = time; snowTurns = 3; }
  return snowTurns-- > 0;
}

interface Site { group: THREE.Group; yard: THREE.Group; shells: THREE.Mesh[]; scaffold: THREE.Mesh | null; top: number; rise: number }
interface Fallen { group: THREE.Group; crows: THREE.Mesh[]; perches: THREE.Vector3[]; heightAt: (x: number, z: number) => number }

class Wrapped implements BuildingVisual {
  readonly group = new THREE.Group();
  readonly anchors: BuildingVisual['anchors'] = { door: new THREE.Vector3(), roof: new THREE.Vector3(), chimney: null, top: 1, windows: [] };

  private readonly ctx: RenderCtx;
  /** holds the body and everything that tips over with it */
  private readonly lean = new THREE.Group();
  private body!: BuiltBody;
  private look!: BuildingLook;
  private seed = 0;
  private bounds!: Bounds;
  private life: THREE.Mesh[] = [];

  private paint: PaintSpec = { tier: 0, purple: false, haunted: false };
  private tier: Tier = 0;
  private wearMesh: THREE.Mesh | null = null;
  private kx = 0;
  private kz = 0;

  private site: Site | null = null;
  private leaving: { group: THREE.Group; t: number } | null = null;
  private readonly rise: THREE.Plane[] = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)];
  private ruin: Fallen | null = null;

  private shingle: Shingle | null = null;
  private hearth: HearthBanner | null = null;
  private gargoyles: THREE.Mesh[] = [];
  private snow: THREE.Mesh | null = null;
  private snowStale = true;

  private readonly chimneyV = new THREE.Vector3();
  private readonly winPool: THREE.Vector3[] = [];

  constructor(look: BuildingLook, ctx: RenderCtx) {
    this.ctx = ctx;
    this.group.name = 'building:' + look.type;
    this.lean.matrixAutoUpdate = false;
    this.group.add(this.lean);
    tickShared(ctx.env);
    this.apply(look);
  }

  set(look: BuildingLook): void { this.apply(look); }

  update(env: Env): void {
    tickShared(env);
    const state = this.look.state;
    if (state === 'ready') { const an = this.body.animate; if (an) an(env); }
    if (this.shingle) swingShingle(this.shingle, env.time, env.wind);
    if (this.hearth) flutter(this.hearth.cloth, env.time, env.wind, this.hearth.phase);
    const ruin = this.ruin;
    if (ruin) for (let i = 0; i < ruin.crows.length; i++) animateCrow(ruin.crows[i], ruin.perches[i], i + (this.seed & 7), env.time);
    if (this.leaving) this.strike(env.dt);
    const snowy = env.snow > 0.02 && state !== 'building';
    if (snowy && this.snowStale && takeSnowTurn(env.time)) this.makeSnow();
    if (this.snow) this.snow.visible = snowy;
  }

  dispose(): void {
    this.group.removeFromParent();
    disposeTree(this.group);
    this.group.clear();
    this.site = null; this.leaving = null; this.ruin = null; this.shingle = null; this.hearth = null; this.snow = null; this.wearMesh = null;
    this.gargoyles.length = 0; this.life.length = 0;
  }

  // ───────────── the one place a look is turned into a building ─────────────

  private apply(next: BuildingLook): void {
    const prev = this.look as BuildingLook | undefined;
    const fresh = !prev || prev.type !== next.type || prev.level !== next.level || prev.variant !== next.variant || prev.w !== next.w || prev.h !== next.h;
    if (fresh) this.newBody(next);
    const stateChanged = fresh || prev!.state !== next.state;

    const tier = tierOf(next);
    const spec: PaintSpec = { tier, purple: next.flags.includes('purple'), haunted: next.flags.includes('haunted') };
    const repainted = fresh || !samePaint(spec, this.paint);
    if (repainted) this.repaintAll(spec);
    if (fresh || stateChanged || tier !== this.tier) this.rewear(next, tier);
    this.tier = tier;

    if (next.state === 'building') {
      if (!this.site || repainted) this.openSite(next);
      this.setProgress(next.progress);
    } else if (this.site) this.closeSite(next.state === 'ready' && !fresh);

    if (next.state === 'ruined') { if (!this.ruin || repainted) this.fallDown(next); }
    else if (this.ruin) this.clearRuin();

    const ready = next.state === 'ready';
    this.body.group.visible = ready;
    if (this.wearMesh) this.wearMesh.visible = ready;
    this.lightWindows(next);
    this.dress(next);
    if (stateChanged) this.dropSnow();
    this.syncAnchors(next);
    this.look = { ...next, occupied: next.occupied.slice(), flags: next.flags.slice() };
    if (this.snowStale && this.ctx.env.snow > 0.02 && next.state !== 'building') this.makeSnow();
  }

  private newBody(look: BuildingLook): void {
    // everything hung on the old body goes with it
    if (this.site) this.closeSite(false);
    if (this.ruin) this.clearRuin();
    this.dropSnow();
    this.undress();
    if (this.wearMesh) { this.lean.remove(this.wearMesh); this.wearMesh.geometry.dispose(); this.wearMesh = null; }
    if (this.body) { this.lean.remove(this.body.group); disposeTree(this.body.group); }

    this.seed = seedFor(look, 7);
    const body = this.body = makeBody(look, this.ctx);
    this.lean.add(body.group);
    for (const m of body.walls) m.userData.orig = m.material;
    for (const m of body.roofs) m.userData.orig = m.material;
    for (const m of body.windows) m.userData.orig = m.material;
    this.life.length = 0;
    body.group.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && m.userData.lifeUnit !== undefined) this.life.push(m); });
    // put its moving parts in a sane pose before anything measures or copies it
    if (body.animate) body.animate(this.ctx.env);
    this.bounds = wallBounds(body, look);
    this.paint = { tier: 0, purple: false, haunted: false };
    this.tier = 0;
  }

  // ───────────── paint, wear and the lean ─────────────

  private repaintAll(spec: PaintSpec): void {
    for (const m of this.body.walls) m.material = repaint(m, m.userData.orig as THREE.Material, 'wall', spec, this.seed);
    for (const m of this.body.roofs) m.material = repaint(m, m.userData.orig as THREE.Material, 'roof', spec, this.seed);
    this.paint = spec;
  }

  private rewear(look: BuildingLook, tier: Tier): void {
    if (this.wearMesh) { this.lean.remove(this.wearMesh); this.wearMesh.geometry.dispose(); this.wearMesh = null; }
    let az = 0, ax = 0;
    if (look.state === 'ready' && tier > 0) {
      const w = buildWear(this.body, look, tier, this.seed);
      if (w.mesh) { this.wearMesh = w.mesh; this.lean.add(w.mesh); }
      [az, ax] = leanFor(tier, this.bounds.maxY, w.leanDir, this.seed);
    }
    // a shear, not a turn: the house leans but its feet stay on the ground
    this.kx = -Math.tan(az); this.kz = Math.tan(ax);
    const e = this.lean.matrix.identity().elements;
    e[4] = this.kx; e[6] = this.kz;
    this.lean.matrixWorldNeedsUpdate = true;
  }

  // ───────────── construction ─────────────

  private openSite(look: BuildingLook): void {
    if (this.site) this.closeSite(false);
    if (this.leaving) this.endStrike();
    const body = this.body, b = this.bounds, door = body.anchors.door;
    const group = new THREE.Group(); group.name = 'site';
    const shells = snapshot(body).map(sn => makeShell(sn, 1));
    let top = 0.3;
    for (const sh of shells) { group.add(sh); top = Math.max(top, (sh.userData.snap as { maxY: number }).maxY); }
    const yard = new THREE.Group();
    const stakes = buildStakes(look, b, door, this.seed);
    if (stakes) yard.add(stakes);
    const scaffold = buildScaffold(look, b, Math.min(top + 0.1, Math.max(0.45, b.maxY + 0.14)), door, this.seed);
    if (scaffold) yard.add(scaffold);
    group.add(yard);
    this.group.add(group);
    this.site = { group, yard, shells, scaffold, top, rise: -1 };
  }

  private setProgress(p: number): void {
    const s = this.site;
    if (!s) return;
    // stakes and string first, then the scaffold goes up, then the house inside it
    const u = Math.min(1, Math.max(0, (p - 0.05) / 0.13));
    if (s.scaffold) { s.scaffold.visible = u > 0; s.scaffold.scale.y = Math.max(0.001, u * (2 - u)); }
    const k = Math.min(1, Math.max(0, (p - 0.14) / 0.86)), rise = k * (s.top + 0.02);
    if (rise === s.rise) return;
    s.rise = rise;
    this.rise[0].constant = rise;
    for (const sh of s.shells) sh.visible = clipShell(sh, this.rise) > 0;
  }

  private closeSite(bounce: boolean): void {
    const s = this.site;
    if (!s) return;
    this.site = null;
    for (const sh of s.shells) { s.group.remove(sh); sh.geometry.dispose(); }
    if (this.leaving) this.endStrike();
    if (bounce && s.yard.children.length) this.leaving = { group: s.group, t: 0 };
    else { this.group.remove(s.group); disposeTree(s.group); }
  }

  /** the scaffold comes down: a little hop, then it folds away */
  private strike(dt: number): void {
    const L = this.leaving;
    if (!L) return;
    L.t += dt;
    const k = L.t / 0.62, g = L.group;
    if (k >= 1) { this.endStrike(); return; }
    if (k < 0.32) {
      const u = k / 0.32;
      g.position.y = Math.sin(u * Math.PI) * 0.08;
      g.scale.set(1 + Math.sin(u * Math.PI) * 0.03, 1, 1 + Math.sin(u * Math.PI) * 0.03);
    } else {
      const u = (k - 0.32) / 0.68, out = 1 + Math.sin(u * Math.PI) * 0.08;
      g.position.y = 0;
      g.scale.set(out, Math.max(0.001, 1 - u * u), out);
    }
  }
  private endStrike(): void {
    const L = this.leaving;
    if (!L) return;
    this.leaving = null;
    this.group.remove(L.group);
    disposeTree(L.group);
  }

  // ───────────── ruin ─────────────

  private fallDown(look: BuildingLook): void {
    this.clearRuin();
    const body = this.body, r = buildRuin(body, look, this.seed);
    const group = new THREE.Group(); group.name = 'ruin';
    const roofs = new Set<THREE.Object3D>(body.roofs);
    const shells: THREE.Mesh[] = [];
    // each column of the break is a box open at the bottom: five planes, cut and added in turn
    const [px0, px1, pz0, pz1, py] = CELL;
    for (const sn of snapshot(body, m => roofs.has(m))) {
      const sh = makeShell(sn, 4);
      let n = 0;
      for (const c of r.cells) {
        px0.constant = -c.x0; px1.constant = c.x1; pz0.constant = -c.z0; pz1.constant = c.z1; py.constant = c.h;
        n = clipShell(sh, CELL, true);
      }
      if (n > 0) { trimShell(sh); group.add(sh); shells.push(sh); } else sh.geometry.dispose();
    }
    if (r.mesh) group.add(r.mesh);
    // crows sit on what is actually left standing: the tallest stump, then the next one along
    const perches: THREE.Vector3[] = [];
    const first = highPoint(shells, null, 0);
    if (first) {
      perches.push(first);
      const second = highPoint(shells, first, 0.45);
      if (second && second.y > 0.1 && look.w * look.h >= 4) perches.push(second);
    } else if (r.perches[0]) perches.push(r.perches[0]);
    const crows: THREE.Mesh[] = [];
    for (let i = 0; i < perches.length; i++) {
      const crow = new THREE.Mesh(crowGeometry(), paintMat());
      crow.name = 'crow'; crow.castShadow = true; crow.receiveShadow = false;
      animateCrow(crow, perches[i], i + (this.seed & 7), this.ctx.env.time);
      group.add(crow); crows.push(crow);
    }
    this.group.add(group);
    this.ruin = { group, crows, perches, heightAt: r.heightAt };
  }
  private clearRuin(): void {
    const r = this.ruin;
    if (!r) return;
    this.ruin = null;
    this.group.remove(r.group);
    disposeTree(r.group);
  }

  // ───────────── life ─────────────

  private lightWindows(look: BuildingLook): void {
    const ready = look.state === 'ready', units = look.occupied.length;
    // a building with no households (the seat, a chapel, the counting house) keeps its own candles
    const home = (unit: number) => units === 0 || !!look.occupied[Math.min(unit, units - 1)];
    const haunted = look.flags.includes('haunted'), key = (this.seed >>> 5) % LIT_BANK;
    for (const m of this.body.windows) {
      const orig = m.userData.orig as THREE.MeshStandardMaterial;
      let want: THREE.Material = orig;
      // only plain panes are ours to light: glass with a glow of its own is its builder's business
      if (ready && orig.isMeshStandardMaterial && !orig.map && orig.emissive.getHex() === 0) {
        const unit = (m.userData.unit as number | undefined) ?? 0;
        if (home(unit)) want = litMat(key + unit * 2, orig.color.getHex());
        else if (look.squatters) want = dimMat();
        else if (haunted) want = ghostMat();
      }
      if (m.material !== want) m.material = want;
    }
    for (const m of this.life) m.visible = ready && home(m.userData.lifeUnit as number);
  }

  // ───────────── the shingle, the gargoyles, the goblin banner ─────────────

  private dress(look: BuildingLook): void {
    const ready = look.state === 'ready', door = this.body.anchors.door, env = this.ctx.env;
    const wantSign = ready && look.toLet;
    if (wantSign && !this.shingle) {
      this.shingle = makeShingle(look, door, makeRng(this.seed ^ 0x70e7));
      swingShingle(this.shingle, env.time, env.wind);
      this.group.add(this.shingle.group);
    } else if (!wantSign && this.shingle) { this.group.remove(this.shingle.group); this.shingle = null; }

    const wantHearth = look.state !== 'building' && look.flags.includes('hearth_right');
    if (wantHearth && !this.hearth) {
      this.hearth = makeHearthBanner(look, door, this.shingle ? this.shingle.group.position.x : null, makeRng(this.seed ^ 0x6ea7));
      flutter(this.hearth.cloth, env.time, env.wind, this.hearth.phase);
      this.group.add(this.hearth.group);
    } else if (!wantHearth && this.hearth) { this.group.remove(this.hearth.group); this.hearth.cloth.geometry.dispose(); this.hearth = null; }

    const wantGargoyles = ready && look.flags.includes('gargoyles');
    if (wantGargoyles && !this.gargoyles.length) {
      for (const { p, yaw } of gargoylePerches(this.body, this.bounds)) {
        const g = new THREE.Mesh(gargoyleGeometry(), paintMat());
        g.name = 'gargoyle'; g.position.copy(p); g.rotation.y = yaw; g.scale.setScalar(1.3);
        g.castShadow = true; g.receiveShadow = true;
        this.lean.add(g); this.gargoyles.push(g);
      }
    } else if (!wantGargoyles && this.gargoyles.length) {
      for (const g of this.gargoyles) this.lean.remove(g);
      this.gargoyles.length = 0;
    }
  }
  private undress(): void {
    if (this.shingle) { this.group.remove(this.shingle.group); this.shingle = null; }
    if (this.hearth) { this.group.remove(this.hearth.group); this.hearth.cloth.geometry.dispose(); this.hearth = null; }
    for (const g of this.gargoyles) this.lean.remove(g);
    this.gargoyles.length = 0;
  }

  // ───────────── snow ─────────────

  private makeSnow(): void {
    this.snowStale = false;
    const look = this.look, body = this.body;
    if (!look || look.state === 'building') return;
    const pos: number[] = [], push: number[] = [];
    if (look.state === 'ready') snowShell(soupOf(body.roofs.filter(m => m.visible), body.group, 0.3), SNOW_THICK, pos, push);
    driftShell(look, this.bounds, body.anchors.door, body.group.userData.drifts as DriftHint[] | undefined, makeRng(this.seed ^ 0x5a0f), pos, push);
    const m = snowMesh(pos, push);
    if (!m) return;
    m.visible = this.ctx.env.snow > 0.02;
    this.snow = m;
    this.lean.add(m);
  }
  private dropSnow(): void {
    this.snowStale = true;
    if (!this.snow) return;
    this.lean.remove(this.snow);
    this.snow.geometry.dispose();
    this.snow = null;
  }

  // ───────────── anchors ─────────────

  /** the body's anchors, carried through the lean (or cut down to what a ruin still has) */
  private syncAnchors(look: BuildingLook): void {
    const a = this.body.anchors, o = this.anchors, kx = this.kx, kz = this.kz, ruin = look.state === 'ruined' ? this.ruin : null;
    o.door.copy(a.door);
    o.windows.length = 0;
    let n = 0;
    for (const w of a.windows) {
      if (ruin && w.y > ruin.heightAt(w.x, w.z) - 0.05) continue;
      const v = (this.winPool[n] ??= new THREE.Vector3());
      n++;
      o.windows.push(v.set(w.x + kx * w.y, w.y, w.z + kz * w.y));
    }
    if (ruin) {
      const hi = ruin.perches[0], lo = ruin.perches[ruin.perches.length - 1];
      if (lo) o.roof.copy(lo); else o.roof.set(0, 0.3, 0);
      o.chimney = null;
      o.top = Math.max(0.7, (hi ? hi.y : 0.4) + 0.4);
      return;
    }
    o.roof.set(a.roof.x + kx * a.roof.y, a.roof.y, a.roof.z + kz * a.roof.y);
    o.chimney = a.chimney ? this.chimneyV.set(a.chimney.x + kx * a.chimney.y, a.chimney.y, a.chimney.z + kz * a.chimney.y) : null;
    o.top = a.top;
  }
}

export function createBuildingVisual(look: BuildingLook, ctx: RenderCtx): BuildingVisual {
  return new Wrapped(look, ctx);
}
