/**
 * The buildings on the board: one BuildingVisual per sim building, kept in
 * step with the state. New ones pop in with a bounce and a puff, removed ones
 * drop in dust, incident visuals come and go, chimneys smoke when someone is
 * home. Also the selection ring, hover ring and the placement ghost.
 */
import * as THREE from 'three';
import type { BuildingLook, BuildingVisual, Env, Fx, RenderCtx, VisualHandle } from '../api';
import type { Building, GameState, Id, SimEvent } from '../../sim/types';
import type { BuildingType, VisualId } from '../../data/ids';
import { BUILDINGS } from '../../data/buildings';
import { frontDir } from '../../sim/core';
import { createBuildingVisual } from '../buildings/index';
import { createVisual } from '../visuals/index';
import { PAL, mat, shadows } from '../palette';
import { HALF_W, HALF_D } from './layout';
import { easeOutBack, clamp01, hash01 } from './util';

interface Entry {
  id: Id;
  b: Building;
  holder: THREE.Group;
  visual: BuildingVisual;
  look: BuildingLook;
  key: string;
  handles: Map<VisualId, VisualHandle>;
  leaving: VisualHandle[];
  pop: number;                 // seconds into the pop animation, -1 when still
  popKind: 'in' | 'done';
  smoke: { stop(): void; move(at: THREE.Vector3): void } | null;
  box: THREE.Box3;
  wx: number; wz: number; rotY: number;
  broken: boolean;
}

const Y = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3(), _hit = new THREE.Vector3();
const warned = new Set<string>();
function warnOnce(key: string, err: unknown): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn('[render] ' + key, err);
}

/** a plain stand-in when a building's own model fails to build, so one bad mesh never empties the table */
function fallbackVisual(look: BuildingLook): BuildingVisual {
  const group = new THREE.Group();
  const h = 0.8 + (look.w + look.h) * 0.14;
  const body = new THREE.Mesh(new THREE.BoxGeometry(look.w * 0.78, h, look.h * 0.78), mat(PAL.plaster));
  body.position.y = h / 2;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(look.w, look.h) * 0.6, 0.7, 4), mat(PAL.thatch));
  roof.position.y = h + 0.35; roof.rotation.y = Math.PI / 4;
  group.add(body, roof);
  shadows(group);
  return {
    group, set() { /* static */ }, update() { /* static */ },
    anchors: { door: new THREE.Vector3(0, 0, look.h / 2 + 0.2), roof: new THREE.Vector3(0, h + 0.7, 0), chimney: null, top: h + 0.8, windows: [] },
    dispose() { body.geometry.dispose(); roof.geometry.dispose(); },
  };
}

/**
 * Every mesh on the stage must carry normals: a smooth-shaded material on a geometry
 * without them lights to NaN, which an HDR target keeps and the bloom then smears
 * into a white halo round a black hole. Face normals are what a flat-shaded piece means anyway.
 */
function ensureNormals(root: THREE.Object3D): void {
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    const g = m.geometry;
    const p = g.getAttribute('position'), n = g.getAttribute('normal');
    if (p && (!n || n.count !== p.count)) g.computeVertexNormals();
  });
}

export function lookOf(b: Building): BuildingLook {
  const def = BUILDINGS[b.type];
  const flags: string[] = [];
  for (const k in b.flags) if (b.flags[k]) flags.push(k);
  flags.sort();
  return {
    type: b.type, level: b.level, variant: b.variant, w: def ? def.w : b.w, h: def ? def.h : b.h,
    state: b.state, progress: b.state === 'building' ? clamp01(b.progress) : 1, condition: b.condition,
    occupied: b.units.map(u => u.tenantId != null),
    toLet: b.state === 'ready' && !b.squatters && b.units.some(u => u.tenantId == null && u.listed),
    squatters: b.squatters ? b.squatters.kind : null,
    flags,
  };
}
function keyOf(b: Building): string {
  let occ = '';
  for (const u of b.units) occ += u.tenantId != null ? '1' : u.listed ? 'l' : '0';
  let flags = '';
  for (const k in b.flags) if (b.flags[k]) flags += k + ',';
  return `${b.type}|${b.level}|${b.variant}|${b.state}|${b.state === 'building' ? Math.round(b.progress * 50) : 50}|${Math.round(b.condition)}|${occ}|${b.squatters ? b.squatters.kind : ''}|${flags}`;
}

function ringGeometry(w: number, h: number, pad: number, thick: number): THREE.BufferGeometry {
  const rr = (hw: number, hh: number, r: number, path: THREE.Path | THREE.Shape) => {
    path.moveTo(-hw + r, -hh); path.lineTo(hw - r, -hh); path.quadraticCurveTo(hw, -hh, hw, -hh + r);
    path.lineTo(hw, hh - r); path.quadraticCurveTo(hw, hh, hw - r, hh); path.lineTo(-hw + r, hh);
    path.quadraticCurveTo(-hw, hh, -hw, hh - r); path.lineTo(-hw, -hh + r); path.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  };
  const shape = new THREE.Shape();
  rr(w / 2 + pad, h / 2 + pad, 0.32, shape);
  const hole = new THREE.Path();
  rr(w / 2 + pad - thick, h / 2 + pad - thick, 0.26, hole);
  shape.holes.push(hole);
  const g = new THREE.ShapeGeometry(shape, 5);
  g.rotateX(-Math.PI / 2);
  return g;
}

export interface Town {
  group: THREE.Group;
  reset(state: GameState): void;
  sync(state: GameState): void;
  handleEvents(events: SimEvent[], state: GameState): void;
  update(env: Env): void;
  has(id: Id): boolean;
  /** world-space points; null when the building is not on the table */
  doorOf(id: Id, out?: THREE.Vector3, unit?: number): THREE.Vector3 | null;
  topOf(id: Id, out?: THREE.Vector3): THREE.Vector3 | null;
  roofOf(id: Id, out?: THREE.Vector3): THREE.Vector3 | null;
  seat(): { x: number; z: number; yaw: number } | null;
  /** nearest building actually hit by the ray */
  pick(raycaster: THREE.Raycaster): { id: Id; distance: number } | null;
  setSelected(id: Id | null): void;
  setHover(id: Id | null, style?: 'hover' | 'demolish'): void;
  count(): number;
  dispose(): void;
}

export function createTown(ctx: RenderCtx, fx: Fx): Town {
  const group = new THREE.Group();
  group.name = 'town';
  const entries = new Map<Id, Entry>();
  const dying: { holder: THREE.Group; visual: BuildingVisual; t: number }[] = [];
  let sweep: { it: IterableIterator<Entry>; done: boolean } | null = null;
  let quiet = false;      // true while building the table from a state: no pops, no dust
  let lastState: GameState | null = null;

  // rings
  const ringMat = (hex: number, k: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), transparent: true, opacity: 0.9, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const selMat = ringMat(PAL.gold, 1.7), hovMat = ringMat(0xfff2cf, 1.0), demMat = ringMat(PAL.bad, 1.6);
  const selRing = new THREE.Mesh(new THREE.BufferGeometry(), selMat), hovRing = new THREE.Mesh(new THREE.BufferGeometry(), hovMat);
  selRing.visible = hovRing.visible = false; selRing.renderOrder = 6; hovRing.renderOrder = 6;
  group.add(selRing, hovRing);
  let selId: Id | null = null, hovId: Id | null = null, hovStyle: 'hover' | 'demolish' = 'hover';
  let selShape = '', hovShape = '';
  function placeRing(ring: THREE.Mesh, id: Id | null, thick: number, shapeKey: string): string {
    const e = id ? entries.get(id) : null;
    if (!e) { ring.visible = false; return ''; }
    const key = `${e.b.w}x${e.b.h}:${thick}`;
    if (key !== shapeKey) { ring.geometry.dispose(); ring.geometry = ringGeometry(e.b.w, e.b.h, 0.1, thick); }
    ring.position.set(e.wx, 0.04, e.wz);
    ring.visible = true;
    return key;
  }

  const toWorld = (e: Entry, local: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 => out.copy(local).applyAxisAngle(Y, e.rotY).add(_v.set(e.wx, 0, e.wz));

  function fitBox(e: Entry): void {
    const m = 0.1, top = Math.max(0.5, e.visual.anchors.top || 1);
    e.box.min.set(e.b.x - HALF_W + m, 0, e.b.y - HALF_D + m);
    e.box.max.set(e.b.x + e.b.w - HALF_W - m, top, e.b.y + e.b.h - HALF_D - m);
  }

  function build(look: BuildingLook): BuildingVisual {
    let v: BuildingVisual;
    try { v = createBuildingVisual(look, ctx); }
    catch (err) { warnOnce('building model failed: ' + look.type, err); v = fallbackVisual(look); }
    ensureNormals(v.group);
    return v;
  }

  function puffRound(e: Entry, n: number, color?: number): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + hash01(i * 7 + e.b.variant) * 0.8;
      _v.set(e.wx + Math.cos(a) * (e.b.w * 0.5 + 0.1), 0.12, e.wz + Math.sin(a) * (e.b.h * 0.5 + 0.1));
      try { fx.puff(_v, color, 5); } catch (err) { warnOnce('fx.puff failed', err); }
    }
  }

  function syncSmoke(e: Entry): void {
    const ch = e.visual.anchors.chimney;
    const want = !!ch && e.look.state === 'ready' && e.look.occupied.some(Boolean);
    if (want && ch) {
      toWorld(e, ch, _hit);
      try {
        if (!e.smoke) e.smoke = fx.smoke(_hit.clone());
        else e.smoke.move(_hit);
      } catch (err) { warnOnce('fx.smoke failed', err); }
    } else if (e.smoke) { try { e.smoke.stop(); } catch { /* already gone */ } e.smoke = null; }
  }

  function syncVisuals(e: Entry): void {
    const want = e.b.visuals;
    for (const [vid, h] of e.handles) {
      if (want.includes(vid)) continue;
      e.handles.delete(vid);
      e.leaving.push(h);
      let done = false;
      const finish = () => { if (done) return; done = true; const i = e.leaving.indexOf(h); if (i >= 0) e.leaving.splice(i, 1); e.holder.remove(h.group); try { h.dispose(); } catch { /* ignore */ } };
      try { h.leave(finish); } catch (err) { warnOnce('visual leave failed: ' + vid, err); finish(); }
    }
    for (const vid of want) {
      if (e.handles.has(vid)) continue;
      try {
        const h = createVisual(vid, { look: e.look, visual: e.visual, wx: e.wx, wz: e.wz, rotY: e.rotY }, ctx);
        e.handles.set(vid, h);
        e.holder.add(h.group);
        ensureNormals(h.group);
      } catch (err) { warnOnce('incident visual failed: ' + vid, err); }
    }
  }

  function add(b: Building): Entry {
    const look = lookOf(b);
    const visual = build(look);
    const holder = new THREE.Group();
    const wx = b.x + b.w / 2 - HALF_W, wz = b.y + b.h / 2 - HALF_D, rotY = -b.rot * Math.PI / 2;
    holder.position.set(wx, 0, wz); holder.rotation.y = rotY;
    holder.add(visual.group);
    group.add(holder);
    const e: Entry = { id: b.id, b, holder, visual, look, key: keyOf(b), handles: new Map(), leaving: [], pop: -1, popKind: 'in', smoke: null, box: new THREE.Box3(), wx, wz, rotY, broken: false };
    fitBox(e);
    entries.set(b.id, e);
    syncVisuals(e);
    syncSmoke(e);
    if (!quiet) { e.pop = 0; holder.scale.setScalar(0.001); puffRound(e, 5 + b.w + b.h); }
    return e;
  }

  function remove(e: Entry, dust: boolean): void {
    entries.delete(e.id);
    for (const h of e.handles.values()) { e.holder.remove(h.group); try { h.dispose(); } catch { /* ignore */ } }
    for (const h of e.leaving) { e.holder.remove(h.group); try { h.dispose(); } catch { /* ignore */ } }
    e.handles.clear(); e.leaving.length = 0;
    if (e.smoke) { try { e.smoke.stop(); } catch { /* ignore */ } e.smoke = null; }
    if (selId === e.id) selRing.visible = false;
    if (hovId === e.id) hovRing.visible = false;
    if (dust) { puffRound(e, 7 + e.b.w + e.b.h, PAL.dirt); _v.set(e.wx, 0.5, e.wz); try { fx.puff(_v, PAL.plasterGrey, 10); } catch { /* ignore */ } dying.push({ holder: e.holder, visual: e.visual, t: 0 }); }
    else { group.remove(e.holder); try { e.visual.dispose(); } catch { /* ignore */ } }
  }

  const api: Town = {
    group,
    reset(state) {
      for (const e of [...entries.values()]) remove(e, false);
      for (const d of dying) { group.remove(d.holder); try { d.visual.dispose(); } catch { /* ignore */ } }
      dying.length = 0;
      quiet = true;
      api.sync(state);
      quiet = false;
    },
    sync(state) {
      lastState = state;
      const bs = state.buildings;
      for (const id in bs) {
        const b = bs[id]!;
        let e = entries.get(id);
        if (e && (e.b.x !== b.x || e.b.y !== b.y || e.b.rot !== b.rot || e.b.type !== b.type)) { remove(e, false); e = undefined; }
        if (!e) { add(b); continue; }
        e.b = b;
        const key = keyOf(b);
        if (key !== e.key) {
          const levelled = e.look.level !== b.level;
          e.key = key;
          e.look = lookOf(b);
          if (!e.broken) { try { e.visual.set(e.look); } catch (err) { e.broken = true; warnOnce('building set failed: ' + b.type, err); } }
          ensureNormals(e.holder);
          fitBox(e);
          syncSmoke(e);
          if (levelled) {
            // a new seat: incident visuals re-seat themselves on the new roof, and the house takes a bow
            for (const h of e.handles.values()) { e.holder.remove(h.group); try { h.dispose(); } catch { /* ignore */ } }
            e.handles.clear();
            if (!quiet) { e.pop = 0; e.popKind = 'in'; puffRound(e, 8); }
          }
        }
        if (e.handles.size !== b.visuals.length || b.visuals.some(v => !e!.handles.has(v))) syncVisuals(e);
      }
      for (const e of [...entries.values()]) if (!bs[e.id]) remove(e, !quiet);
      if (selId) selShape = placeRing(selRing, selId, 0.085, selShape);
    },
    handleEvents(events) {
      for (const ev of events) {
        if (ev.type === 'building_done') {
          const e = entries.get(ev.buildingId);
          if (!e) continue;
          e.pop = 0; e.popKind = 'done';
          puffRound(e, 8 + e.b.w + e.b.h, PAL.plasterWarm);
          toWorld(e, _hit.set(0, e.visual.anchors.top, 0), _hit);
          try { fx.puff(_hit.clone(), PAL.thatch, 8); } catch { /* ignore */ }
        } else if (ev.type === 'building_removed') {
          const e = entries.get(ev.buildingId);
          if (e && lastState && !lastState.buildings[ev.buildingId]) remove(e, true);
        }
      }
    },
    update(env) {
      const dt = env.dt;
      // models may swap geometry as they wear or build; look one building over each frame
      if (entries.size) {
        if (!sweep || sweep.done) sweep = { it: entries.values(), done: false };
        const nx = sweep.it.next();
        if (nx.done) sweep.done = true; else ensureNormals(nx.value.holder);
      }
      for (const e of entries.values()) {
        if (!e.broken) { try { e.visual.update(env); } catch (err) { e.broken = true; warnOnce('building update failed: ' + e.b.type, err); } }
        for (const h of e.handles.values()) { try { h.update(env); } catch (err) { warnOnce('visual update failed', err); } }
        for (let i = 0; i < e.leaving.length; i++) { try { e.leaving[i]!.update(env); } catch { /* ignore */ } }
        if (e.pop >= 0) {
          e.pop += dt;
          if (e.popKind === 'in') {
            const k = Math.min(1, e.pop / 0.5);
            const s = easeOutBack(k, 2.4), wob = Math.sin(k * Math.PI) * (1 - k) * 0.5;
            e.holder.scale.set(s * (1 - wob * 0.3), s * (1 + wob), s * (1 - wob * 0.3));
            if (k >= 1) { e.pop = -1; e.holder.scale.set(1, 1, 1); }
          } else {
            const k = Math.min(1, e.pop / 0.42);
            const wob = Math.sin(k * Math.PI * 2) * (1 - k) * 0.12;
            e.holder.scale.set(1 - wob * 0.5, 1 + wob, 1 - wob * 0.5);
            if (k >= 1) { e.pop = -1; e.holder.scale.set(1, 1, 1); }
          }
        }
      }
      for (let i = dying.length - 1; i >= 0; i--) {
        const d = dying[i]!;
        d.t += dt;
        const k = Math.min(1, d.t / 0.5);
        d.holder.scale.set(1 + k * 0.12, Math.max(0.001, 1 - k * k), 1 + k * 0.12);
        d.holder.position.y = -k * 0.15;
        d.holder.rotation.z = Math.sin(k * 9) * 0.03 * (1 - k);
        if (k >= 1) { group.remove(d.holder); try { d.visual.dispose(); } catch { /* ignore */ } dying.splice(i, 1); }
      }
      const pulse = 0.75 + 0.25 * Math.sin(env.time * 4.2);
      selMat.opacity = pulse;
      if (selRing.visible) selRing.scale.setScalar(1 + (1 - pulse) * 0.03);
      (hovRing.material as THREE.MeshBasicMaterial).opacity = hovStyle === 'demolish' ? 0.6 + 0.4 * Math.abs(Math.sin(env.time * 6)) : 0.55;
    },
    has(id) { return entries.has(id); },
    doorOf(id, out = new THREE.Vector3(), unit) {
      const e = entries.get(id);
      if (!e) return null;
      const d = e.visual.anchors.door;
      _hit.copy(d);
      const n = e.b.units.length;
      if (unit != null && n > 1) _hit.x += (unit - (n - 1) / 2) * Math.min(0.7, (e.look.w - 0.5) / n);
      return toWorld(e, _hit, out);
    },
    topOf(id, out = new THREE.Vector3()) {
      const e = entries.get(id);
      return e ? out.set(e.wx, e.visual.anchors.top, e.wz) : null;
    },
    roofOf(id, out = new THREE.Vector3()) {
      const e = entries.get(id);
      return e ? toWorld(e, e.visual.anchors.roof, out) : null;
    },
    seat() {
      for (const e of entries.values()) if (e.b.type === 'seat') { const f = frontDir(e.b.rot); return { x: e.wx, z: e.wz, yaw: Math.atan2(f[0], f[1]) }; }
      return null;
    },
    pick(raycaster) {
      const cands: { e: Entry; d: number }[] = [];
      for (const e of entries.values()) if (raycaster.ray.intersectBox(e.box, _hit)) cands.push({ e, d: _hit.distanceTo(raycaster.ray.origin) });
      if (!cands.length) return null;
      cands.sort((a, b) => a.d - b.d);
      let best: { id: Id; distance: number } | null = null;
      for (let i = 0; i < cands.length && i < 5; i++) {
        const c = cands[i]!;
        if (best && c.d > best.distance) break;
        try {
          const hits = raycaster.intersectObject(c.e.visual.group, true);
          if (hits.length && (!best || hits[0]!.distance < best.distance)) best = { id: c.e.id, distance: hits[0]!.distance };
        } catch { /* a mesh that cannot be raycast is simply not pickable */ }
      }
      return best;
    },
    setSelected(id) {
      selId = id && entries.has(id) ? id : null;
      selShape = placeRing(selRing, selId, 0.085, selShape);
    },
    setHover(id, style = 'hover') {
      const nid = id && entries.has(id) ? id : null;
      if (nid === hovId && style === hovStyle) return;
      hovId = nid; hovStyle = style;
      hovRing.material = style === 'demolish' ? demMat : hovMat;
      hovShape = placeRing(hovRing, nid === selId && style === 'hover' ? null : nid, style === 'demolish' ? 0.11 : 0.05, hovShape);
    },
    count() { return entries.size; },
    dispose() {
      for (const e of [...entries.values()]) remove(e, false);
      for (const d of dying) { try { d.visual.dispose(); } catch { /* ignore */ } }
      selRing.geometry.dispose(); hovRing.geometry.dispose(); selMat.dispose(); hovMat.dispose(); demMat.dispose();
    },
  };
  return api;
}

// ───────────── the placement ghost ─────────────

export interface Ghost {
  group: THREE.Group;
  /** show a translucent `btype` with its footprint's top-left at tile (tx, ty) */
  show(btype: BuildingType, rot: number, tx: number, ty: number, ok: boolean): void;
  hide(): void;
  /** a quick shake of the head: you cannot build there */
  refuse(): void;
  update(env: Env): void;
  dispose(): void;
}

export function createGhost(ctx: RenderCtx): Ghost {
  const group = new THREE.Group();
  group.name = 'ghost';
  group.visible = false;
  const GOOD = new THREE.Color(PAL.good), BAD = new THREE.Color(PAL.bad);
  let current: { btype: BuildingType; visual: BuildingVisual; mats: { m: THREE.Material & { color?: THREE.Color; emissive?: THREE.Color; emissiveIntensity?: number }; base: THREE.Color | null }[]; arrow: THREE.Mesh } | null = null;
  let okNow: boolean | null = null;
  let shake = 0;
  const arrowGeo = new THREE.BufferGeometry();
  arrowGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.22, 0, 0, 0.22, 0, 0, 0, 0, 0.3], 3));
  arrowGeo.computeVertexNormals();
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, fog: false });

  function clear(): void {
    if (!current) return;
    group.remove(current.visual.group, current.arrow);
    for (const x of current.mats) x.m.dispose();
    try { current.visual.dispose(); } catch { /* ignore */ }
    current = null;
  }
  function make(btype: BuildingType): void {
    clear();
    const def = BUILDINGS[btype];
    const look: BuildingLook = { type: btype, level: 1, variant: 0, w: def.w, h: def.h, state: 'ready', progress: 1, condition: 100, occupied: new Array<boolean>(def.units).fill(false), toLet: false, squatters: null, flags: [] };
    let visual: BuildingVisual;
    try { visual = createBuildingVisual(look, ctx); } catch (err) { warnOnce('ghost model failed: ' + btype, err); visual = fallbackVisual(look); }
    ensureNormals(visual.group);
    const mats: NonNullable<typeof current>['mats'] = [];
    const cloned = new Map<THREE.Material, THREE.Material>();
    const swap = (m: THREE.Material): THREE.Material => {
      let c = cloned.get(m);
      if (!c) {
        c = m.clone();
        c.transparent = true; c.opacity = Math.min(m.opacity, 1) * 0.72; c.depthWrite = true;
        const cc = c as THREE.Material & { color?: THREE.Color };
        mats.push({ m: cc, base: cc.color ? cc.color.clone() : null });
        cloned.set(m, c);
      }
      return c;
    };
    visual.group.traverse(o => {
      const me = o as THREE.Mesh;
      if (!me.isMesh || !me.material) return;
      me.castShadow = false; me.receiveShadow = false;
      me.material = Array.isArray(me.material) ? me.material.map(swap) : swap(me.material);
      me.renderOrder = 7;
    });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.position.copy(visual.anchors.door); arrow.position.y = 0.06; arrow.position.z += 0.12;
    arrow.renderOrder = 8;
    group.add(visual.group, arrow);
    current = { btype, visual, mats, arrow };
    okNow = null;
  }
  function paint(ok: boolean): void {
    if (!current || ok === okNow) return;
    okNow = ok;
    const t = ok ? GOOD : BAD;
    for (const x of current.mats) {
      if (x.base && x.m.color) x.m.color.copy(x.base).lerp(t, 0.6);
      if (x.m.emissive) { x.m.emissive.copy(t); x.m.emissiveIntensity = 0.45; }
    }
    arrowMat.color.copy(t).multiplyScalar(1.5);
  }

  return {
    group,
    show(btype, rot, tx, ty, ok) {
      if (!current || current.btype !== btype) make(btype);
      const def = BUILDINGS[btype];
      const w = rot % 2 ? def.h : def.w, h = rot % 2 ? def.w : def.h;
      group.position.set(tx + w / 2 - HALF_W, 0, ty + h / 2 - HALF_D);
      group.rotation.y = -rot * Math.PI / 2;
      group.visible = true;
      paint(ok);
    },
    hide() { group.visible = false; },
    refuse() { shake = 0.32; },
    update(env) {
      if (!group.visible) return;
      group.position.y = 0.05 + Math.sin(env.time * 3.1) * 0.025;
      if (shake > 0) { shake = Math.max(0, shake - env.dt); group.rotation.z = Math.sin(shake * 60) * 0.05 * (shake / 0.32); } else group.rotation.z = 0;
    },
    dispose() { clear(); arrowGeo.dispose(); arrowMat.dispose(); },
  };
}
