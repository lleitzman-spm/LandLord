/**
 * Dev entry for the table itself (render-core). Builds the renderer on the
 * knight fixture and runs the loop. Hooks for tools/shot.mjs --eval:
 *
 *   __dev.setDay(d)            jump the calendar (float days since the reign began)
 *   __dev.setMode(m)           'title' | 'play' | 'audience' | 'ceremony'
 *   __dev.focus(target, opts)  as Renderer.focus
 *   __dev.view({tx,tz,dist,yaw,pitch})   place the camera directly (degrees)
 *   __dev.sheet([...presets], cols)      render several views into one contact sheet
 *   __dev.play(speed)          let the calendar run (0 stops it)
 *   __dev.state                the fixture state
 */
import { makeFixtureState } from './fixture';
import { createRenderer } from '../render/index';
import type { SceneMode, Tool, Quality } from '../render/api';
import type { GameState, WeatherKind, SimEvent } from '../sim/types';
import { BUILDINGS } from '../data/buildings';

type Preset = { day?: number; mode?: SceneMode; view?: Partial<{ tx: number; tz: number; dist: number; yaw: number; pitch: number }>; weather?: WeatherKind; gold?: number; overview?: boolean; tool?: Tool; hover?: [number, number]; quality?: Quality; warm?: number; label?: string;
  /** dev conveniences: point at things by what they are */
  hoverTile?: [number, number]; hoverFree?: [number, number]; hoverBuilding?: number; dragTiles?: [number, number][]; select?: number; highlightParcel?: number; events?: SimEvent[] };

const canvas = document.getElementById('c') as HTMLCanvasElement;
const q = new URLSearchParams(location.search);
const state: GameState = makeFixtureState((q.get('rank') as 'reeve' | 'knight' | 'baron') || 'knight');
const occupied = (btype: string, x: number, y: number, rot: number): boolean => {
  const def = BUILDINGS[btype as keyof typeof BUILDINGS];
  const w = rot % 2 ? def.h : def.w, h = rot % 2 ? def.w : def.h;
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    const t = state.map.tiles[yy * state.map.w + xx];
    if (!t || t.b || t.t === 'water' || t.t === 'bridge' || t.t === 'road') return true;
    const p = state.map.parcels[Math.floor(yy / 8) * 4 + Math.floor(xx / 8)];
    if (!p || !p.owned) return true;
  }
  return false;
};
const renderer = createRenderer({ canvas, canPlace: (b, x, y, r) => !occupied(b, x, y, r), quality: (q.get('q') as Quality) || 'high' });
renderer.reset(state);
for (const ev of ['pick', 'hover', 'place', 'paint', 'clear', 'demolish', 'cancel'] as const) renderer.on(ev, ((...a: unknown[]) => { if (ev !== 'hover') console.log('[' + ev + ']', JSON.stringify(a)); }) as never);

let speed = 0;
let last = performance.now();
let running = true;
function tick(dt: number): void {
  if (speed) state.day += (dt * speed) / 3;
  renderer.sync(state);
  renderer.frame(dt);
}
function loop(): void {
  if (!running) return;
  const now = performance.now();
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  tick(dt);
  if (navigator.webdriver) gpuSync();      // headless shots: never let frames pile up behind the screenshot
  requestAnimationFrame(loop);
}
window.addEventListener('resize', () => renderer.resize());

function apply(p: Preset): void {
  if (p.quality) renderer.setQuality(p.quality);
  if (p.day != null) state.day = p.day;
  if (p.weather) { state.weather = p.weather; renderer.handleEvents([{ type: 'weather', kind: p.weather } as SimEvent], state); }
  if (p.gold != null) state.gold = p.gold;
  renderer.setMode(p.mode ?? 'play');
  renderer.setTool(p.tool ?? { kind: 'select' });
  renderer.sync(state);
  if (p.overview) renderer.focus({ overview: true }, { ms: 0 });
  if (p.view) renderer.debug.view(p.view);
  renderer.debug.settle();
  const ptr = (type: string, x: number, y: number, button = 0): void => {
    const r = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent(type, { clientX: r.left + x, clientY: r.top + y, pointerId: 1, pointerType: 'mouse', button, bubbles: true }));
  };
  ptr('pointercancel', 0, 0);       // let go of anything a previous preset was holding
  const ids = Object.keys(state.buildings);
  renderer.setSelection(p.select != null && ids[p.select] ? { buildingId: ids[p.select] } : null);
  if (p.highlightParcel != null) {
    const pc = state.map.parcels[p.highlightParcel]!;
    const tiles: [number, number][] = [];
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) tiles.push([pc.x + x, pc.y + y]);
    renderer.setHighlight(tiles);
  } else renderer.setHighlight(null);
  if (p.hover) ptr('pointermove', p.hover[0], p.hover[1]);
  if (p.hoverTile) { const a = renderer.anchor({ tile: p.hoverTile }); ptr('pointermove', a.x, a.y); }
  if (p.hoverFree) {
    // the free owned 2x2 nearest the asked tile
    let best: [number, number] | null = null, bd = 1e9;
    for (let y = 1; y < state.map.h - 2; y++) for (let x = 1; x < state.map.w - 2; x++) {
      if (occupied('cottage', x, y, 0)) continue;
      const d = Math.hypot(x - p.hoverFree[0], y - p.hoverFree[1]);
      if (d < bd) { bd = d; best = [x, y]; }
    }
    if (best) { const a = renderer.anchor({ tile: best }); ptr('pointermove', a.x, a.y); }
  }
  if (p.hoverBuilding != null && ids[p.hoverBuilding]) { const a = renderer.anchor({ buildingId: ids[p.hoverBuilding]!, at: 'door' }); ptr('pointermove', a.x, a.y - 8); }
  if (p.dragTiles && p.dragTiles.length) {
    const a0 = renderer.anchor({ tile: p.dragTiles[0]! });
    ptr('pointerdown', a0.x, a0.y);
    for (const t of p.dragTiles.slice(1)) { const a = renderer.anchor({ tile: t }); ptr('pointermove', a.x, a.y); }
  }
  if (p.events) renderer.handleEvents(p.events, state);
  // let scripted cameras and particles run a little before the still is taken
  const n = Math.round((p.warm ?? 0) / 0.05);
  for (let i = 0; i < n; i++) { renderer.sync(state); renderer.frame(0.05); }
  renderer.sync(state);
  renderer.frame(0.016);
  renderer.frame(0.016);
  gpuSync();
}
/** wait for the GPU to catch up (software GL queues whole frames), so a screenshot sees finished work */
function gpuSync(): void {
  const gl = canvas.getContext('webgl2');
  if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
}

const dev = {
  state, renderer,
  setDay(d: number) { state.day = d; renderer.sync(state); renderer.debug.settle(); },
  setMode(m: SceneMode) { renderer.setMode(m); },
  focus(t: Parameters<typeof renderer.focus>[0], o?: Parameters<typeof renderer.focus>[1]) { renderer.focus(t, o); },
  view(v: Preset['view']) { renderer.debug.view(v ?? {}); },
  setWeather(w: WeatherKind) { state.weather = w; renderer.handleEvents([{ type: 'weather', kind: w } as SimEvent], state); },
  setGold(g: number) { state.gold = g; },
  setTool(t: Tool) { renderer.setTool(t); },
  setQuality(v: Quality) { renderer.setQuality(v); },
  play(s: number) { speed = s; state.speed = (s > 4 ? 4 : s) as GameState['speed']; },
  events(e: SimEvent[]) { renderer.handleEvents(e, state); },
  stats() { return renderer.stats(); },
  env() { return { ...renderer.debug.env(), pose: { ...renderer.debug.pose() } }; },
  pick(x: number, y: number) { return renderer.debug.pick(x, y); },
  anchor(ref: Parameters<typeof renderer.anchor>[0]) { return renderer.anchor(ref); },
  apply,
  /** exercise picking, anchors, events, modes and quality; returns what it saw */
  selftest() {
    running = false;
    const out: Record<string, unknown> = {};
    const errs: string[] = [];
    const tryIt = (label: string, fn: () => void) => { try { fn(); } catch (e) { errs.push(label + ': ' + String(e)); } };
    const r2 = (a: { x: number; y: number; visible: boolean; scale: number }) => [Math.round(a.x), Math.round(a.y), a.visible, Math.round(a.scale * 100) / 100];
    apply({ day: 42, overview: true });
    const ids = Object.keys(state.buildings);
    const b = state.buildings[ids[0]!]!;
    const top = renderer.anchor({ buildingId: b.id }), door = renderer.anchor({ buildingId: b.id, at: 'door' });
    out.building = { type: b.type, top: r2(top), door: r2(door), pickBody: renderer.debug.pick((top.x + door.x) / 2, (top.y * 0.45 + door.y * 0.55)) };
    const t = renderer.anchor({ tile: [2, 21] });
    out.tile = { at: r2(t), pick: renderer.debug.pick(t.x, t.y) };
    const props: Record<string, unknown> = {};
    for (const pr of ['coffer', 'ledger', 'charter', 'bell', 'candle', 'seal', 'map_scroll'] as const) { const a = renderer.anchor({ prop: pr }); props[pr] = [...r2(a), renderer.debug.pick(a.x, a.y + 5)]; }
    out.props = props;
    const actor = Object.values(state.actors)[0];
    if (actor) { const a = renderer.anchor({ actorId: actor.id }); out.actor = { kind: actor.kind, at: r2(a), pick: renderer.debug.pick(a.x, a.y + 6) }; }
    const tenant = Object.values(state.tenants).find(x => x.status === 'housed');
    if (tenant) { const a = renderer.anchor({ tenantId: tenant.id }); out.tenant = { at: r2(a), pick: renderer.debug.pick(a.x, a.y + 6) }; }
    out.offBoard = renderer.debug.pick(3, 3);
    tryIt('events', () => {
      renderer.handleEvents([
        { type: 'gold', amount: 12, cat: 'rent', buildingId: b.id }, { type: 'purse_collected', buildingId: ids[1]!, unit: 0, amount: 9, byActor: null },
        { type: 'rent_day' }, { type: 'promotion', rank: 'baron' }, { type: 'building_done', buildingId: b.id }, { type: 'weather', kind: 'storm' }, { type: 'parcel_bought', parcelId: 2 },
      ] as SimEvent[], state);
      renderer.frame(0.05); renderer.frame(0.05);
    });
    const poses: Record<string, unknown> = {};
    for (const m of ['audience', 'ceremony', 'title', 'play'] as const) tryIt('mode ' + m, () => {
      renderer.setMode(m); renderer.debug.settle(); renderer.frame(0.05);
      const ps = renderer.debug.pose();
      poses[m] = [Math.round(ps.tx * 10) / 10, Math.round(ps.tz * 10) / 10, Math.round(ps.dist * 10) / 10, Math.round((ps.pitch * 180) / Math.PI)];
    });
    out.poses = poses;
    tryIt('focus', () => { renderer.focus({ buildingId: b.id }, { ms: 0 }); renderer.frame(0.02); renderer.focus({ tile: [4, 4] }, { zoom: 2, ms: 200 }); renderer.frame(0.1); renderer.frame(0.1); renderer.frame(0.1); out.focus = { ...renderer.debug.pose() }; });
    tryIt('remove building', () => {
      const gone = state.buildings[ids[2]!]!;
      delete state.buildings[gone.id];
      for (const tl of state.map.tiles) if (tl.b === gone.id) tl.b = null;
      renderer.handleEvents([{ type: 'building_removed', buildingId: gone.id, btype: gone.type, x: gone.x, y: gone.y, w: gone.w, h: gone.h }] as SimEvent[], state);
      renderer.sync(state); renderer.frame(0.05);
      state.buildings[gone.id] = gone;
      for (let yy = gone.y; yy < gone.y + gone.h; yy++) for (let xx = gone.x; xx < gone.x + gone.w; xx++) state.map.tiles[yy * state.map.w + xx]!.b = gone.id;
      renderer.sync(state); renderer.frame(0.05);
    });
    tryIt('terrain edits', () => {
      state.map.tiles[20 * state.map.w + 10]!.t = 'road'; state.map.tiles[21 * state.map.w + 10]!.t = 'road'; state.map.parcels[2]!.owned = true;
      for (let i = 0; i < 5; i++) { renderer.sync(state); }
      renderer.frame(0.05);
    });
    for (const ql of ['low', 'medium', 'high'] as const) tryIt('quality ' + ql, () => { renderer.setQuality(ql); renderer.frame(0.05); out['stats_' + ql] = renderer.stats(); });
    gpuSync();
    out.env = { ...renderer.debug.env() };
    out.errors = errs;
    return out;
  },
  /** render each preset and tile the results into one 2D canvas laid over the page */
  sheet(presets: Preset[], cols = 2) {
    running = false;
    const rows = Math.ceil(presets.length / cols);
    const W = window.innerWidth, H = window.innerHeight;
    const cw = Math.floor(W / cols), ch = Math.floor(H / rows);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    renderer.resize();
    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    out.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:10';
    const g = out.getContext('2d')!;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const t0 = performance.now();
    const times: number[] = [];
    presets.forEach((p, i) => {
      const t1 = performance.now();
      apply(p);
      times.push(Math.round(performance.now() - t1));
      g.drawImage(canvas, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch);
      if (p.label) { g.font = '14px monospace'; g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect((i % cols) * cw + 6, Math.floor(i / cols) * ch + 6, g.measureText(p.label).width + 12, 22); g.fillStyle = '#ffe9b0'; g.fillText(p.label, (i % cols) * cw + 12, Math.floor(i / cols) * ch + 22); }
    });
    document.body.appendChild(out);
    canvas.style.visibility = 'hidden';
    return { ...renderer.stats(), ms: Math.round(performance.now() - t0), each: times };
  },
};
(window as unknown as { __dev: typeof dev }).__dev = dev;
// Headless shots: software GL takes seconds over the first frame, so let the page load and an
// --eval (usually a sheet, which stops the loop) get in before the loop starts.
if (navigator.webdriver) setTimeout(() => { last = performance.now(); loop(); }, 3500);
else requestAnimationFrame(loop);
