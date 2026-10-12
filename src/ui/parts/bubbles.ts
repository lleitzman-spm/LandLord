/**
 * OWNER: ui-shell agent. Speech bubbles over the table.
 *
 *   say events   what the sim puts in someone's mouth: typed out letter by
 *                letter with voice blips, anchored to whoever said it
 *   barks        every so often a household whose figure is in view says
 *                something that fits the moment (Rent Day, winter, a griffin
 *                next door, a leak nobody has mended, the ruler walking past)
 *
 * At most three bubbles at once; the rest queue. Bubbles never take clicks.
 */
import type { GameState, SimEvent, Id, Tenant, Building } from '../../sim/types';
import { dateOf, rulerTitle } from '../../sim/core';
import { fillText } from '../../sim/effects';
import { BARKS, INCIDENT_BY_ID } from '../../data';
import type { BarkKey } from '../../data/schema';
import type { AnchorRef } from '../../render/api';
import type { UICtx } from '../api';
import type { Part } from './part';
import type { ShellPart } from '../index';
import { h } from '../kit';

const MAX_LIVE = 3;
const TYPE_CPS = 38;               // letters a second
const EDGE = 118;                  // keep bubbles this far from the left and right edges
const EDGE_RAIL = 178;             // phones: and clear of the tool rail on the left
const TAIL = 11;                   // the box sits this far above its anchor
const MAX_LIFT = 96;               // a bubble may climb this far to get out of another's way

interface Line { text: string; ref: AnchorRef; fallback: AnchorRef | null; who: string; seed: number; key: string; voiced: boolean; born: number }
interface Bubble {
  line: Line; ref: AnchorRef; el: HTMLElement; typed: Text; rest: Text;
  n: number; t: number; hold: number; state: 'typing' | 'holding' | 'out';
  voice: { stop(): void } | null; shown: boolean; tf: string;
  /** the box, measured once when it opens */
  w: number; h: number;
  /** where it stands this frame, and how far it has been lifted clear of another bubble */
  x: number; y: number; lift: number;
}

function seedOf(id: string): number { let v = 7; for (let i = 0; i < id.length; i++) v = (v * 31 + id.charCodeAt(i)) | 0; return Math.abs(v); }
const usable = (s: string): boolean => /[a-z]/i.test(s);

export function mount(ctx: UICtx): Part {
  const el = h('div', { class: 'll-bubs', 'aria-hidden': 'true' });
  let live: Bubble[] = [];
  let queue: Line[] = [];
  let lastState: GameState | null = null;
  let visible = true;
  let barkIn = 7 + Math.random() * 5;
  let vw = 0, vh = 0;
  const order: Bubble[] = [];
  const recent: string[] = [];

  function measure(): void { vw = ctx.root.clientWidth || window.innerWidth; vh = ctx.root.clientHeight || window.innerHeight; }
  window.addEventListener('resize', measure);

  // ───────── who is speaking, and from where ─────────
  function lineFor(st: GameState, text: string, from: { actorId?: Id; tenantId?: Id; buildingId?: Id; staffId?: Id }, voiced: boolean): Line | null {
    if (!usable(text)) return null;
    const born = performance.now();
    const staff = from.staffId ? st.staff[from.staffId] : undefined;
    if (staff?.actorId) return { text, ref: { actorId: staff.actorId }, fallback: null, who: staff.first, seed: staff.portraitSeed, key: 'a:' + staff.actorId, voiced, born };
    if (from.actorId && st.actors[from.actorId]) {
      const a = st.actors[from.actorId]!;
      let who = '', seed = seedOf(a.id);
      const ref = a.refId;
      if (a.kind === 'staff' && ref && st.staff[ref]) { who = st.staff[ref]!.first; seed = st.staff[ref]!.portraitSeed; }
      else if (a.kind === 'applicant' && ref && st.applicants[ref]) { who = st.applicants[ref]!.household.first; seed = st.applicants[ref]!.household.portraitSeed; }
      else if (ref && st.tenants[ref]) { who = st.tenants[ref]!.first; seed = st.tenants[ref]!.portraitSeed; }
      return { text, ref: { actorId: a.id }, fallback: null, who, seed, key: 'a:' + a.id, voiced, born };
    }
    const t = from.tenantId ? st.tenants[from.tenantId] : undefined;
    if (t) {
      const door: AnchorRef | null = t.buildingId && st.buildings[t.buildingId] ? { buildingId: t.buildingId, unit: t.unit, at: 'door' } : null;
      return { text, ref: { tenantId: t.id }, fallback: door, who: t.first, seed: t.portraitSeed, key: 't:' + t.id, voiced, born };
    }
    if (from.buildingId && st.buildings[from.buildingId]) {
      return { text, ref: { buildingId: from.buildingId, at: 'door' }, fallback: null, who: '', seed: seedOf(from.buildingId), key: 'b:' + from.buildingId, voiced, born };
    }
    return null;
  }

  // ───────── barks ─────────
  function near(b: Building, o: Building, tiles: number): boolean {
    return Math.abs(b.x + b.w / 2 - (o.x + o.w / 2)) <= tiles && Math.abs(b.y + b.h / 2 - (o.y + o.h / 2)) <= tiles;
  }
  function barkKey(st: GameState, t: Tenant, b: Building): BarkKey {
    const d = dateOf(st.day);
    const opts: [BarkKey, number][] = [];
    const unit = b.units[t.unit];
    if (unit && unit.purse > 0) opts.push(['purse_waiting', 5]);
    else if (d.dom <= 3 && t.lateStage === 'none') opts.push([t.happiness < 45 ? 'pay_rent_grudging' : 'pay_rent', 4]);
    if (t.lateStage !== 'none' && t.arrears > 0) opts.push(['late_excuse', 4]);
    if (st.weather === 'snow') opts.push(['snow', 3]);
    else if (st.weather === 'rain' || st.weather === 'storm' || st.weather === 'hail') opts.push(['rain', 3]);
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    for (const id in st.actors) {
      const a = st.actors[id]!;
      if (Math.abs(a.x - cx) > 3.5 || Math.abs(a.y - cy) > 3.5) continue;
      if (a.kind === 'ruler') opts.push(['see_ruler', 5]);
      else if (a.kind === 'staff' && a.refId && st.staff[a.refId]?.role === 'bailiff') opts.push(['see_bailiff', 3]);
    }
    let griffin = false, goblins = false, vacancy = false, well = false, tavern = false, fresh = false;
    for (const id in st.buildings) {
      const o = st.buildings[id]!;
      if (o === b) continue;
      if (!near(b, o, 7)) continue;
      if (o.visuals.includes('griffin_roof')) griffin = true;
      if (o.squatters?.kind === 'goblins' || o.visuals.includes('goblins_windows')) goblins = true;
      if (o.type === 'tavern' && o.state === 'ready') tavern = true;
      if (o.state === 'ready' && st.day - o.builtDay < 12 && o.builtDay > 0) fresh = true;
      if (!near(b, o, 5)) continue;
      if (o.type === 'well') well = true;
      if (o.state === 'ready' && o.units.some(u => !u.tenantId && u.listed)) vacancy = true;
    }
    if (b.visuals.includes('griffin_roof')) griffin = true;
    if (griffin) opts.push(['griffin', 4]);
    if (goblins) opts.push(['goblins', 3]);
    if (fresh) opts.push(['new_building', 2.5]);
    if (vacancy) opts.push(['vacancy_gossip', 1.5]);
    if (well) opts.push(['well_gossip', 1.5]);
    if (tavern) opts.push(['tavern', 1.5]);
    let leaking = b.condition < 40;
    for (const id in st.incidents) {
      const inc = st.incidents[id]!;
      if (inc.buildingId === b.id && inc.state === 'open' && INCIDENT_BY_ID[inc.defId]?.decision === 'repair') { leaking = true; break; }
    }
    if (leaking) opts.push(['repair_waiting', 4]);
    if (t.happiness < 38) opts.push(['idle_unhappy', 4]);
    else {
      if (d.season === 'winter') opts.push(['idle_winter', 2.5]);
      if (d.season === 'summer') opts.push(['idle_summer', 2.5]);
      opts.push(['idle_happy', t.happiness >= 55 ? 2.5 : 1]);
    }
    let total = 0;
    for (const o of opts) total += o[1];
    let roll = Math.random() * total;
    for (const o of opts) { roll -= o[1]; if (roll <= 0) return o[0]; }
    return 'idle_happy';
  }
  function barkText(st: GameState, key: BarkKey): string | null {
    const pool = (BARKS[key] ?? []).filter(s => usable(s) && !recent.includes(s));
    if (!pool.length) return null;
    const raw = pool[Math.floor(Math.random() * pool.length)]!;
    recent.push(raw); if (recent.length > 10) recent.shift();
    return fillText(raw, { title: rulerTitle(st), ruler: st.realm.ruler, realm: st.realm.name });
  }
  /** a household whose figure is in view says its piece */
  function bark(st: GameState, key?: BarkKey, tenantId?: Id): boolean {
    const ids = tenantId ? [tenantId] : Object.keys(st.tenants);
    for (let tries = 0; tries < Math.min(10, ids.length); tries++) {
      const t = st.tenants[tenantId ?? ids[Math.floor(Math.random() * ids.length)]!];
      if (!t || t.status !== 'housed' || !t.buildingId) continue;
      const b = st.buildings[t.buildingId];
      if (!b) continue;
      const a = ctx.renderer.anchor({ tenantId: t.id });
      if (!a.visible || a.x < EDGE || a.x > vw - EDGE || a.y < 150 || a.y > vh - 110) continue;
      if (live.some(x => x.line.key === 't:' + t.id) || queue.some(x => x.key === 't:' + t.id)) continue;
      const text = barkText(st, key ?? barkKey(st, t, b));
      if (!text) return false;
      queue.push({ text, ref: { tenantId: t.id }, fallback: null, who: t.first, seed: t.portraitSeed, key: 't:' + t.id, voiced: false, born: performance.now() });
      return true;
    }
    return false;
  }

  // ───────── the bubbles themselves ─────────
  function start(line: Line, ref: AnchorRef): void {
    const typed = document.createTextNode('');
    const rest = document.createTextNode(line.text);
    const box = h('div', { class: 'll-bub-box' }, line.who ? h('span', { class: 'll-bub-who' }, line.who) : null, typed, h('span', { class: 'll-bub-rest' }, rest));
    const node = h('div', { class: 'll-bub is-off' }, h('div', { class: 'll-bub-in' }, box));
    el.appendChild(node);
    let voice: Bubble['voice'] = null;
    if (line.voiced) { try { voice = ctx.audio.voice(line.seed, line.text); } catch { voice = null; } }
    else ctx.audio.sfx('pop', { volume: 0.22 });
    live.push({
      line, ref, el: node, typed, rest, n: 0, t: 0, hold: Math.min(6.5, 1.7 + line.text.length * 0.055), state: 'typing', voice, shown: false, tf: '',
      w: box.offsetWidth, h: box.offsetHeight, x: 0, y: 0, lift: 0,
    });
  }
  function end(b: Bubble): void {
    if (b.state === 'out') return;
    b.state = 'out'; b.t = 0;
    b.voice?.stop(); b.voice = null;
    b.el.classList.add('is-out');
  }
  function clearAll(): void {
    for (const b of live) { b.voice?.stop(); b.el.remove(); }
    live = []; queue = [];
  }
  function pump(): void {
    const now = performance.now();
    for (let i = 0; i < queue.length && live.length < MAX_LIVE;) {
      const line = queue[i]!;
      if (live.some(b => b.line.key === line.key)) { i++; continue; }       // one thing at a time from any one mouth
      let ref: AnchorRef | null = line.ref;
      if (!ctx.renderer.anchor(ref).visible) ref = line.fallback && ctx.renderer.anchor(line.fallback).visible ? line.fallback : null;
      if (!ref) {
        if (!line.voiced || now - line.born > 2500) queue.splice(i, 1); else i++;   // said off stage: give it a moment, then let it go
        continue;
      }
      queue.splice(i, 1);
      start(line, ref);
    }
    if (queue.length > 8) queue.splice(0, queue.length - 8);
  }
  function frame(dt: number): void {
    for (const b of live) {
      b.t += dt;
      if (b.state === 'typing') {
        const n = Math.min(b.line.text.length, Math.floor(b.t * TYPE_CPS));
        if (n !== b.n) { b.n = n; b.typed.data = b.line.text.slice(0, n); b.rest.data = b.line.text.slice(n); }
        if (n >= b.line.text.length) { b.state = 'holding'; b.t = 0; }
      } else if (b.state === 'holding') {
        if (b.t >= b.hold) end(b);
      }
      const a = ctx.renderer.anchor(b.ref);
      const show = a.visible;
      if (show !== b.shown) { b.shown = show; b.el.classList.toggle('is-off', !show); }
      if (show) {
        const lo = vw < 700 ? Math.min(EDGE_RAIL, vw / 2) : EDGE, hi = Math.max(lo, vw - EDGE);
        b.x = Math.max(lo, Math.min(hi, a.x)); b.y = a.y;
      }
    }
    // bubbles that would lie across one another: the upper one climbs (lowest on the table keeps its place)
    order.length = 0;
    for (const b of live) if (b.shown) order.push(b);
    order.sort((p, q) => q.y - p.y);
    for (let i = 0; i < order.length; i++) {
      const b = order[i]!;
      let want = 0;
      for (let k = 0; k < i; k++) {
        const o = order[k]!;
        if (Math.abs(b.x - o.x) >= (b.w + o.w) / 2 + 4) continue;
        const oTop = o.y - o.lift - TAIL - o.h, oBottom = o.y - o.lift - TAIL;
        const bottom = b.y - want - TAIL, top = bottom - b.h;
        if (bottom > oTop - 5 && top < oBottom + 5) want = Math.max(want, b.y - TAIL - (oTop - 5));
      }
      want = Math.min(MAX_LIFT, Math.max(0, want));
      b.lift += (want - b.lift) * Math.min(1, dt * 10);
      if (Math.abs(want - b.lift) < 0.4) b.lift = want;
      const tf = `translate3d(${b.x.toFixed(1)}px,${(b.y - b.lift).toFixed(1)}px,0)`;
      if (tf !== b.tf) { b.tf = tf; b.el.style.transform = tf; }
    }
    if (live.some(b => b.state === 'out' && b.t > 0.32)) {
      live = live.filter(b => { if (b.state === 'out' && b.t > 0.32) { b.el.remove(); return false; } return true; });
    }
  }

  const part: ShellPart & { dispose(): void } = {
    el,
    update(state, dt) {
      if (state !== lastState) { lastState = state; clearAll(); measure(); barkIn = 6 + Math.random() * 5; }
      if (!visible) return;
      if (!vw) measure();
      if (state.speed >= 1) {
        barkIn -= dt;
        if (barkIn <= 0) {
          barkIn = 9 + Math.random() * 8;
          if (live.length < 2 && !queue.length && !bark(state)) barkIn = 3;     // nobody in view: try again shortly
        }
      }
      pump();
      frame(dt);
    },
    handleEvents(events: SimEvent[], state) {
      if (!visible) return;
      let reacted = false;
      const react = (chance: number, key: BarkKey, tenantId?: Id): void => {
        if (reacted || Math.random() > chance) return;
        reacted = bark(state, key, tenantId);
      };
      for (const ev of events) {
        if (ev.type === 'say') { const line = lineFor(state, ev.text, ev, true); if (line) queue.push(line); }
        else if (ev.type === 'tenant_in') react(0.8, 'move_in', ev.tenantId);
        else if (ev.type === 'rent_paid') react(0.15, 'pay_rent', ev.tenantId);
        else if (ev.type === 'tenant_out' && ev.reason === 'evicted') react(0.7, 'neighbor_evicted');
        else if (ev.type === 'building_done') react(0.5, 'new_building');
        else if (ev.type === 'incident_resolved') {
          const inc = state.incidents[ev.incidentId];
          if (inc?.tenantId && INCIDENT_BY_ID[inc.defId]?.decision === 'repair' && ev.outcomeId !== 'defer') react(0.6, 'repair_thanks', inc.tenantId);
        }
      }
    },
    setVisible(on) {
      if (on === visible) return;
      visible = on;
      el.hidden = !on;
      if (!on) clearAll();
    },
    reset() { lastState = null; clearAll(); },
    dispose() { clearAll(); window.removeEventListener('resize', measure); },
  };
  return part;
}
