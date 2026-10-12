/**
 * Hands on the table: pointer, wheel, touch and keys. Moves the camera,
 * tells clicks from drags, runs the tools (ghost placement, road painting,
 * clearing, demolition) and reports hover and pick.
 */
import * as THREE from 'three';
import type { PickResult, RendererEvents, Tool } from '../api';
import type { BuildingType } from '../../data/ids';
import type { GameState } from '../../sim/types';
import { MAP_W, MAP_H } from '../../sim/types';
import { BUILDINGS } from '../../data/buildings';
import { PAL } from '../palette';
import type { CameraRig } from './camera';
import { HALF_W, HALF_D } from './layout';

export interface InputHost {
  rig: CameraRig;
  /** full pick under a screen point (NDC) */
  pick(ndcX: number, ndcY: number): PickResult;
  emit<K extends keyof RendererEvents>(type: K, ...args: Parameters<RendererEvents[K]>): void;
  canPlace(btype: BuildingType, x: number, y: number, rot: number): boolean;
  state(): GameState | null;
  setMarks(tiles: [number, number][] | null, color?: number): void;
  setGrid(amount: number, wx?: number, wz?: number): void;
  /** hover feedback on the table */
  showHover(hit: PickResult, style: 'hover' | 'demolish'): void;
  ghostShow(btype: BuildingType, rot: number, tx: number, ty: number, ok: boolean): void;
  ghostHide(): void;
  ghostRefuse(): void;
}

export interface Input {
  setTool(tool: Tool): void;
  tool(): Tool;
  /** once per frame: resolve hover, keep the ghost honest */
  update(dt: number): void;
  /** forget everything in flight (mode change, reset) */
  cancel(): void;
  dispose(): void;
}

const sameHit = (a: PickResult, b: PickResult): boolean => {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'building': return a.buildingId === (b as typeof a).buildingId;
    case 'actor': return a.actorId === (b as typeof a).actorId;
    case 'townsperson': return a.tenantId === (b as typeof a).tenantId;
    case 'tile': return a.x === (b as typeof a).x && a.y === (b as typeof a).y;
    case 'prop': return a.prop === (b as typeof a).prop;
    default: return true;
  }
};
const typing = (t: EventTarget | null): boolean => {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable === true;
};

export function createInput(dom: HTMLCanvasElement, host: InputHost): Input {
  const rig = host.rig;
  let tool: Tool = { kind: 'select' };
  const NONE: PickResult = { kind: 'none' };
  let hover: PickResult = NONE;
  let hoverDirty = false, hasPointer = false;
  const mouse = { x: 0, y: 0, ndcX: 0, ndcY: 0 };
  const ptrs = new Map<number, { x: number; y: number }>();
  let drag: null | { id: number; button: number; sx: number; sy: number; lx: number; ly: number; moved: boolean; touch: boolean; grab: THREE.Vector3 | null; t0: number } = null;
  let gesture: null | { cx: number; cy: number; dist: number; ang: number } = null;
  let stroke: [number, number][] | null = null;
  let ghostTile: [number, number] | null = null, ghostOk = false, ghostCheck = 0;
  const keys = new Set<string>();
  const _g = new THREE.Vector3(), _g2 = new THREE.Vector3();
  const playing = (): boolean => rig.mode === 'play';

  function toNdc(ev: { clientX: number; clientY: number }): void {
    const r = dom.getBoundingClientRect();
    mouse.x = ev.clientX - r.left; mouse.y = ev.clientY - r.top;
    mouse.ndcX = (mouse.x / Math.max(1, r.width)) * 2 - 1;
    mouse.ndcY = -(mouse.y / Math.max(1, r.height)) * 2 + 1;
  }
  function tileUnder(): [number, number] | null {
    const p = rig.groundAt(mouse.ndcX, mouse.ndcY, _g);
    if (!p) return null;
    const x = Math.floor(p.x + HALF_W), y = Math.floor(p.z + HALF_D);
    return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H ? [x, y] : null;
  }
  function footprint(btype: BuildingType, rot: number, at: [number, number]): { x: number; y: number; w: number; h: number } {
    const def = BUILDINGS[btype];
    const w = rot % 2 ? def.h : def.w, h = rot % 2 ? def.w : def.h;
    return { x: at[0] - Math.floor((w - 1) / 2), y: at[1] - Math.floor((h - 1) / 2), w, h };
  }
  function setCursor(): void {
    let c = 'default';
    if (!playing()) c = 'default';
    else if (drag && drag.moved) c = drag.button === 2 ? 'ew-resize' : stroke ? 'crosshair' : 'grabbing';
    else if (tool.kind !== 'select') c = 'crosshair';
    else if (hover.kind === 'building' || hover.kind === 'actor' || hover.kind === 'townsperson' || hover.kind === 'prop') c = 'pointer';
    if (dom.style.cursor !== c) dom.style.cursor = c;
  }

  // ── tools: what the cursor shows ───────────────────────────────────────
  function refreshTool(force = false): void {
    if (!playing() || !hasPointer) { host.ghostHide(); if (!stroke) host.setMarks(null); host.setGrid(0); return; }
    const t = tileUnder();
    if (tool.kind === 'place') {
      if (!t) { host.ghostHide(); host.setMarks(null); ghostTile = null; return; }
      const f = footprint(tool.btype, tool.rot, t);
      if (force || !ghostTile || ghostTile[0] !== f.x || ghostTile[1] !== f.y) {
        ghostTile = [f.x, f.y];
        ghostOk = host.canPlace(tool.btype, f.x, f.y, tool.rot);
        const tiles: [number, number][] = [];
        for (let yy = 0; yy < f.h; yy++) for (let xx = 0; xx < f.w; xx++) tiles.push([f.x + xx, f.y + yy]);
        host.setMarks(tiles, ghostOk ? PAL.good : PAL.bad);
      }
      host.ghostShow(tool.btype, tool.rot, f.x, f.y, ghostOk);
      host.setGrid(1, t[0] + 0.5 - HALF_W, t[1] + 0.5 - HALF_D);
    } else if (tool.kind === 'road' || tool.kind === 'unroad') {
      if (!stroke) host.setMarks(t ? [t] : null, tool.kind === 'road' ? PAL.gold : PAL.bad);
      if (t) host.setGrid(1, t[0] + 0.5 - HALF_W, t[1] + 0.5 - HALF_D); else host.setGrid(0);
    } else if (tool.kind === 'clear') {
      const s = host.state();
      const tt = t && s ? s.map.tiles[t[1] * MAP_W + t[0]] : null;
      const worth = !!tt && (tt.t === 'forest' || tt.t === 'rock');
      host.setMarks(t ? [t] : null, worth ? PAL.warn : 0x9a958a);
      if (t) host.setGrid(0.7, t[0] + 0.5 - HALF_W, t[1] + 0.5 - HALF_D); else host.setGrid(0);
    } else if (tool.kind === 'demolish') {
      const hit = host.pick(mouse.ndcX, mouse.ndcY);
      host.showHover(hit.kind === 'building' ? hit : NONE, 'demolish');
      const s = host.state();
      const b = hit.kind === 'building' && s ? s.buildings[hit.buildingId] : null;
      if (b) { const tiles: [number, number][] = []; for (let yy = 0; yy < b.h; yy++) for (let xx = 0; xx < b.w; xx++) tiles.push([b.x + xx, b.y + yy]); host.setMarks(tiles, PAL.bad); }
      else host.setMarks(null);
      host.setGrid(0);
    }
  }
  function strokeTo(t: [number, number]): void {
    if (!stroke) return;
    const last = stroke[stroke.length - 1];
    const push = (x: number, y: number) => { if (!stroke!.some(q => q[0] === x && q[1] === y)) stroke!.push([x, y]); };
    if (!last) { push(t[0], t[1]); }
    else {
      // walk there one orthogonal step at a time so a lane never has diagonal gaps
      let [x, y] = last;
      let guard = 0;
      while ((x !== t[0] || y !== t[1]) && guard++ < 80) {
        if (Math.abs(t[0] - x) >= Math.abs(t[1] - y)) x += Math.sign(t[0] - x); else y += Math.sign(t[1] - y);
        push(x, y);
      }
    }
    host.setMarks(stroke, tool.kind === 'road' ? PAL.gold : PAL.bad);
  }

  // ── clicks ─────────────────────────────────────────────────────────────
  function click(button: number, shift: boolean): void {
    if (!playing()) return;
    if (button === 2) {
      if (tool.kind !== 'select') host.emit('cancel');
      else host.emit('pick', host.pick(mouse.ndcX, mouse.ndcY), { button: 2, shift });
      return;
    }
    if (button !== 0) return;
    if (tool.kind === 'select') { host.emit('pick', host.pick(mouse.ndcX, mouse.ndcY), { button: 0, shift }); return; }
    const t = tileUnder();
    if (tool.kind === 'place') {
      if (!t) return;
      const f = footprint(tool.btype, tool.rot, t);
      // a refused spot is reported too: the sim refuses it again, and that refusal carries the reason the player reads
      if (!host.canPlace(tool.btype, f.x, f.y, tool.rot)) host.ghostRefuse();
      host.emit('place', tool.btype, f.x, f.y, tool.rot);
      ghostTile = null;
    } else if (tool.kind === 'clear') {
      if (t) host.emit('clear', t[0], t[1]);
    } else if (tool.kind === 'demolish') {
      const hit = host.pick(mouse.ndcX, mouse.ndcY);
      if (hit.kind === 'building') host.emit('demolish', hit.buildingId);
    }
  }

  // ── pointer ────────────────────────────────────────────────────────────
  function onDown(ev: PointerEvent): void {
    if (!playing()) return;
    toNdc(ev);
    hasPointer = true;
    ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    try { dom.setPointerCapture(ev.pointerId); } catch { /* not capturable */ }
    if (ev.pointerType === 'touch' && ptrs.size === 2) {
      // second finger: this is a gesture, not a tap or a stroke
      const [a, b] = [...ptrs.values()] as [{ x: number; y: number }, { x: number; y: number }];
      gesture = { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x) };
      drag = null;
      if (stroke) { stroke = null; host.setMarks(null); }
      return;
    }
    if (drag) return;
    const g = rig.groundAt(mouse.ndcX, mouse.ndcY, _g);
    drag = { id: ev.pointerId, button: ev.button, sx: ev.clientX, sy: ev.clientY, lx: ev.clientX, ly: ev.clientY, moved: false, touch: ev.pointerType === 'touch', grab: g ? g.clone() : null, t0: performance.now() };
    if (ev.button === 0 && (tool.kind === 'road' || tool.kind === 'unroad')) {
      const t = tileUnder();
      if (t) { stroke = []; strokeTo(t); }
    }
    if (ev.pointerType === 'touch') refreshTool(true);
    setCursor();
  }
  function onMove(ev: PointerEvent): void {
    toNdc(ev);
    hasPointer = true;
    if (!playing()) return;
    if (ptrs.has(ev.pointerId)) ptrs.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (gesture && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, dist = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
      const r = dom.getBoundingClientRect();
      if (gesture.dist > 0 && dist > 0) rig.zoomAt(((cx - r.left) / r.width) * 2 - 1, -(((cy - r.top) / r.height) * 2 - 1), gesture.dist / dist);
      let da = ang - gesture.ang; if (da > Math.PI) da -= Math.PI * 2; if (da < -Math.PI) da += Math.PI * 2;
      rig.rotate(-(cx - gesture.cx) * 0.006 - da, (cy - gesture.cy) * 0.005);
      gesture.cx = cx; gesture.cy = cy; gesture.dist = dist; gesture.ang = ang;
      return;
    }
    if (drag && drag.id === ev.pointerId) {
      const dx = ev.clientX - drag.lx, dy = ev.clientY - drag.ly;
      drag.lx = ev.clientX; drag.ly = ev.clientY;
      if (!drag.moved && Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) > (drag.touch ? 10 : 5)) drag.moved = true;
      if (stroke) { const t = tileUnder(); if (t) strokeTo(t); }
      else if (drag.moved) {
        if (drag.button === 2) rig.rotate(-dx * 0.0052, dy * 0.0042);
        else if (drag.grab) {
          // keep the grabbed spot of ground under the finger
          const now = rig.groundAt(mouse.ndcX, mouse.ndcY, _g2);
          if (now && Math.abs(now.x) < 80 && Math.abs(now.z) < 80) rig.grab(drag.grab, now);
        }
      }
      setCursor();
      return;
    }
    hoverDirty = true;
  }
  function onUp(ev: PointerEvent): void {
    toNdc(ev);
    ptrs.delete(ev.pointerId);
    try { dom.releasePointerCapture(ev.pointerId); } catch { /* fine */ }
    if (gesture) { if (ptrs.size < 2) gesture = null; return; }
    if (!drag || drag.id !== ev.pointerId) return;
    const d = drag;
    drag = null;
    if (stroke) {
      const tiles = stroke;
      stroke = null;
      host.setMarks(null);
      if (tiles.length && (tool.kind === 'road' || tool.kind === 'unroad') && playing()) host.emit('paint', tool.kind, tiles);
    } else if (!d.moved && performance.now() - d.t0 < 900) click(d.button, ev.shiftKey);
    if (d.touch) { hasPointer = false; refreshTool(); }
    hoverDirty = true;
    setCursor();
  }
  function onCancel(ev: PointerEvent): void {
    ptrs.delete(ev.pointerId);
    if (drag && drag.id === ev.pointerId) drag = null;
    if (ptrs.size < 2) gesture = null;
    if (stroke) { stroke = null; host.setMarks(null); }
    setCursor();
  }
  function onLeave(): void {
    if (drag) return;
    hasPointer = false;
    if (hover.kind !== 'none') { hover = NONE; host.showHover(NONE, 'hover'); if (playing()) host.emit('hover', NONE); }
    refreshTool();
    setCursor();
  }
  function onWheel(ev: WheelEvent): void {
    if (!playing()) return;
    ev.preventDefault();
    toNdc(ev);
    const unit = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? 400 : 1;
    const dy = Math.max(-240, Math.min(240, ev.deltaY * unit));
    rig.zoomAt(mouse.ndcX, mouse.ndcY, Math.exp(dy * (ev.ctrlKey ? 0.011 : 0.00135)));
    hoverDirty = true;
  }
  const onContext = (ev: Event): void => { ev.preventDefault(); };

  // ── keys ───────────────────────────────────────────────────────────────
  function applyKeys(): void {
    const k = (c: string) => (keys.has(c) ? 1 : 0);
    rig.keyPan.set(k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft'), k('KeyW') + k('ArrowUp') - k('KeyS') - k('ArrowDown'));
    rig.keyTurn = k('KeyE') - k('KeyQ');
  }
  const MOVE = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  function onKeyDown(ev: KeyboardEvent): void {
    if (typing(ev.target) || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (!playing()) return;
    if (ev.code === 'Escape') { if (tool.kind !== 'select') host.emit('cancel'); return; }
    if (!MOVE.has(ev.code)) return;
    if (ev.code.startsWith('Arrow')) ev.preventDefault();
    keys.add(ev.code);
    applyKeys();
  }
  function onKeyUp(ev: KeyboardEvent): void {
    if (keys.delete(ev.code)) applyKeys();
  }
  function onBlur(): void { keys.clear(); applyKeys(); }

  dom.addEventListener('pointerdown', onDown);
  dom.addEventListener('pointermove', onMove);
  dom.addEventListener('pointerup', onUp);
  dom.addEventListener('pointercancel', onCancel);
  dom.addEventListener('pointerleave', onLeave);
  dom.addEventListener('wheel', onWheel, { passive: false });
  dom.addEventListener('contextmenu', onContext);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  dom.style.touchAction = 'none';

  return {
    setTool(t) {
      const changed = t.kind !== tool.kind || (t.kind === 'place' && tool.kind === 'place' && (t.btype !== tool.btype || t.rot !== tool.rot));
      tool = t;
      if (!changed) return;
      if (stroke) drag = null;        // a stroke cut short by a tool change must not turn into a pan or a click
      stroke = null; ghostTile = null;
      host.setMarks(null); host.ghostHide(); host.setGrid(0);
      host.showHover(NONE, 'hover');
      hover = NONE;
      hoverDirty = true;
      refreshTool(true);
      setCursor();
    },
    tool() { return tool; },
    update(dt) {
      if (!playing()) return;
      if (tool.kind === 'select') {
        if (hoverDirty && !drag) {
          hoverDirty = false;
          const hit = hasPointer ? host.pick(mouse.ndcX, mouse.ndcY) : NONE;
          if (!sameHit(hit, hover)) { hover = hit; host.showHover(hit, 'hover'); host.emit('hover', hit); setCursor(); }
        }
      } else {
        // the world moves under a still cursor (camera easing, things being built): keep the ghost honest
        ghostCheck += dt;
        const force = ghostCheck > 0.4;
        if (force) ghostCheck = 0;
        if (hoverDirty || force || rig.keyPan.lengthSq() > 0) { hoverDirty = false; if (!drag || !drag.moved || stroke) refreshTool(force); }
      }
    },
    cancel() {
      drag = null; gesture = null; ptrs.clear();
      if (stroke) { stroke = null; }
      host.setMarks(null); host.ghostHide(); host.setGrid(0);
      host.showHover(NONE, 'hover');
      hover = NONE;
      keys.clear(); applyKeys();
      setCursor();
    },
    dispose() {
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerup', onUp);
      dom.removeEventListener('pointercancel', onCancel);
      dom.removeEventListener('pointerleave', onLeave);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('contextmenu', onContext);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}
