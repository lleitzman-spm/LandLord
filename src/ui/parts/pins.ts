/**
 * OWNER: ui-shell agent. Map pins: small wax tokens that float over the table
 * and say "something here wants you".
 *
 *   incident   a seal with the matter's icon and a ring draining to its deadline
 *   speech     over a petitioner waiting at the seat: opens the audience
 *   purse      rent on a doorstep: click to send someone for it
 *   applicant  someone waiting to be shown a vacancy
 *   work       a quiet ring over construction and jobs in hand
 *
 * Every frame each pin asks the renderer where its anchor is and moves by
 * transform alone (no layout is read in the loop). Pins that share an anchor
 * stand side by side; pins that drift over one another fold into a single
 * token with a count, which opens a list.
 */
import type { GameState, SimEvent, Id, Incident, Job, JobKind } from '../../sim/types';
import { fillText } from '../../sim/effects';
import { INCIDENT_BY_ID, BAL } from '../../data';
import type { IconId } from '../../data/ids';
import type { IncidentDef, OutcomeDef } from '../../data/schema';
import type { AnchorRef } from '../../render/api';
import type { UICtx } from '../api';
import type { Part } from './part';
import type { ShellPart } from '../index';
import { h, fromHTML, setClass, setAttr, setText, crowns, plural, cap, panel } from '../kit';
import { iconSvg, sealSvg } from '../icons';

type Kind = 'incident' | 'speech' | 'purse' | 'applicant' | 'work';
type Wax = 'rubric' | 'ochre' | 'lapis' | 'green' | 'gold' | 'parch' | 'work';
const WAX_HEX: Record<Wax, string> = { rubric: '#9e2b25', ochre: '#b5761f', lapis: '#2f4a7a', green: '#4f7a5a', gold: '#c9a227', parch: '#e9dab3', work: '#e9dab3' };
const URGENCY_WAX: Record<1 | 2 | 3, Wax> = { 1: 'lapis', 2: 'ochre', 3: 'rubric' };
const JOB_ICON: Partial<Record<JobKind, IconId>> = {
  repair: 'trowel', renovate: 'hammer', demolish: 'axe', clear_land: 'axe', show: 'key', screen: 'eye',
  serve_notice: 'scroll', evict: 'gavel', inspect: 'eye', visit: 'handshake',
};
const MIN_SCALE = 0.62, MAX_SCALE = 1.12;
const SPREAD = 36;                 // px between pins that share an anchor
const JOIN = 27, STAY = 35;        // px: fold together under JOIN, stay folded until STAY

interface Spec {
  key: string; kind: Kind; ref: AnchorRef; group: string; prio: number;
  icon: IconId; wax: Wax;
  /** use the embossed seal art when the scribes have drawn it */
  seal: boolean;
  /** 0..1 of the ring left (time) or done (work); null = no ring */
  ring: number | null;
  hot: boolean; pending: boolean;
  title: string; sub: string;
  run: ((pin: Pin, viaKey: boolean) => void) | null;
}
interface Pin {
  spec: Spec; el: HTMLElement; face: HTMLElement; ringV: SVGElement | null; badge: HTMLElement | null;
  faceSig: string; ringSig: string; tipSig: string;
  dx: number; x: number; y: number; s: number; alpha: number; vis: boolean;
  shown: boolean; tf: string; op: string;
  leader: Pin | null; members: Pin[]; memberSig: string;
}
interface Pop { pin: Pin; el: HTMLElement; w: number; h: number; floor: number; tf: string; incidentId: Id | null }

const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
function span(days: number): string {
  return days <= 0.6 ? 'half a day' : days < 1.25 ? 'a day' : days < 1.8 ? 'a day and a half' : `${Math.round(days)} days`;
}
function timeLeft(left: number | null): string {
  if (left === null) return '';
  return left <= 0 ? 'Time is up.' : left < 1 ? 'Less than a day left.' : `${plural(Math.ceil(left), 'day')} left.`;
}

export function mount(ctx: UICtx): Part {
  const el = h('div', { class: 'll-pins' });
  const pins = new Map<string, Pin>();
  let list: Pin[] = [];
  let pop: Pop | null = null;
  let lastState: GameState | null = null;
  let visible = true, dirty = true, since = 1, lastFold = -1e9;
  let vw = 0, vh = 0;
  const waitUntil = new Map<string, number>();     // key → time until which a clicked pin shows as "sent for"

  function measure(): void { vw = ctx.root.clientWidth || window.innerWidth; vh = ctx.root.clientHeight || window.innerHeight; }
  window.addEventListener('resize', measure);

  // ───────── what should be on the table ─────────
  function gather(st: GameState): Spec[] {
    const out: Spec[] = [];
    const now = performance.now();
    const fetching = new Set<string>(), showing = new Set<Id>(), working: Job[] = [];
    for (const id in st.jobs) {
      const j = st.jobs[id]!;
      if (j.state === 'done' || j.state === 'cancelled') continue;
      if (j.kind === 'collect' && j.buildingId) fetching.add(j.buildingId + ':' + (j.unit ?? '*'));
      else if (j.kind === 'show' && j.applicantId) showing.add(j.applicantId);
      if (j.state === 'working') working.push(j);
    }
    let seatId: Id | null = null;
    const underWay = new Set<Id>();                // jobs already shown as an incident being seen to

    for (const id in st.incidents) {
      const inc = st.incidents[id]!;
      if (inc.state !== 'open' && inc.state !== 'in_progress') continue;
      const def = INCIDENT_BY_ID[inc.defId];
      if (!def) continue;
      const open = inc.state === 'open';
      const left = inc.expiresDay === null ? null : inc.expiresDay - st.day;
      const total = def.timerDays > 0 ? def.timerDays : inc.expiresDay === null ? 0 : inc.expiresDay - inc.startedDay;
      const frac = left !== null && total > 0 ? clamp(left / total, 0, 1) : null;
      const hot = open && (def.urgency === 3 || (frac !== null && frac < 0.2));
      const b = inc.buildingId ? st.buildings[inc.buildingId] : undefined;
      const actor = inc.actorId ? st.actors[inc.actorId] : undefined;
      const waiting = open && def.audience && !!actor && actor.state === 'waiting';
      const who = String(inc.vars.tenant ?? inc.vars.first ?? 'A petitioner');
      const hear = (): void => ctx.open('audience', inc.id);

      if (waiting && actor) {
        out.push({
          key: 's:' + inc.id, kind: 'speech', ref: { actorId: actor.id }, group: 'a:' + actor.id, prio: 28 + def.urgency * 10 + (hot ? 5 : 0),
          icon: 'speech', wax: 'parch', seal: false, ring: frac, hot, pending: false,
          title: def.title, sub: `${who} waits to be heard. ${timeLeft(left)}`.trim(), run: hear,
        });
      }
      // the matter itself, on the building it concerns (an applicant at the door is pin enough)
      let anchorId: Id | null = b ? b.id : null;
      if (!anchorId && !def.audience) {
        if (seatId === null) { seatId = ''; for (const bid in st.buildings) if (st.buildings[bid]!.type === 'seat') { seatId = bid; break; } }
        anchorId = seatId || null;
      }
      if (!anchorId || (def.decision === 'applicant' && waiting)) continue;
      const job = !open && inc.jobId ? st.jobs[inc.jobId] : undefined;
      if (job) underWay.add(job.id);
      const where = b ? b.name + '. ' : '';
      const key = 'i:' + inc.id;
      out.push({
        key, kind: 'incident', ref: { buildingId: anchorId, at: 'top' }, group: 't:' + anchorId, prio: 30 + def.urgency * 10 + (hot ? 5 : 0),
        icon: def.icon, wax: open ? URGENCY_WAX[def.urgency] : 'green', seal: true,
        ring: open ? frac : job ? clamp(job.progress, 0, 1) : null, hot,
        pending: !open || (waitUntil.get(key) ?? 0) > now,
        title: def.title, sub: open ? `${where}${timeLeft(left)}`.trim() : `${where}Being seen to.`,
        run: !open ? null : def.audience ? hear : (pin, viaKey) => openIncident(pin, inc.id, viaKey),
      });
    }

    for (const id in st.applicants) {
      const ap = st.applicants[id]!;
      if (ap.shown) continue;                       // once shown, the audience pin takes over
      const b = st.buildings[ap.buildingId];
      if (!b) continue;
      const actor = ap.actorId ? st.actors[ap.actorId] : undefined;
      const key = 'p:' + ap.id;
      const sent = showing.has(ap.id) || (waitUntil.get(key) ?? 0) > now;
      const wait = ap.leavesDay - ap.arrivedDay;
      const left = ap.leavesDay - st.day;
      out.push({
        key, kind: 'applicant', ref: actor ? { actorId: actor.id } : { buildingId: b.id, unit: ap.unit, at: 'door' }, group: actor ? 'a:' + actor.id : 'd:' + b.id, prio: 20,
        icon: 'key', wax: 'lapis', seal: false, ring: wait > 0 ? clamp(left / wait, 0, 1) : null, hot: !sent && left < 2, pending: sent,
        title: ap.household.name,
        sub: sent ? `Being shown ${b.name}.` : `Waits to be shown ${b.name}. Gives up in ${plural(Math.max(1, Math.ceil(left)), 'day')}.`,
        run: () => {
          const res = ctx.act({ type: 'order_job', kind: 'show', applicantId: ap.id, buildingId: b.id });
          if (!res.ok) return;
          waitUntil.set(key, performance.now() + 2500); dirty = true;
          const crier = Object.values(ctx.state().staff).find(m => m.role === 'crier');
          ctx.toast(crier ? `${crier.first} will show ${ap.household.first} round ${b.name}.` : `You will show ${ap.household.first} round ${b.name} yourself.`, 'info');
        },
      });
    }

    for (const bid in st.buildings) {
      const b = st.buildings[bid]!;
      if (b.state === 'building') {
        out.push({ key: 'w:b:' + bid, kind: 'work', ref: { buildingId: bid, at: 'top' }, group: 't:' + bid, prio: 0, icon: 'hammer', wax: 'work', seal: false, ring: clamp(b.progress, 0, 1), hot: false, pending: false, title: '', sub: '', run: null });
        continue;
      }
      for (let u = 0; u < b.units.length; u++) {
        const unit = b.units[u]!;
        if (unit.purse <= 0) continue;
        const key = `$:${bid}:${u}`;
        const sent = fetching.has(bid + ':' + u) || fetching.has(bid + ':*') || (waitUntil.get(key) ?? 0) > now;
        const left = BAL.purseDays - (st.day - unit.purseDay);
        const t = unit.tenantId ? st.tenants[unit.tenantId] : undefined;
        out.push({
          key, kind: 'purse', ref: { buildingId: bid, unit: u, at: 'door' }, group: 'd:' + bid, prio: 10,
          icon: 'purse', wax: 'gold', seal: false, ring: clamp(left / BAL.purseDays, 0, 1), hot: !sent && left < 2, pending: sent,
          title: t ? `${t.first}’s rent, on the step` : 'A purse on the step',
          sub: sent ? `${cap(crowns(unit.purse))} at ${b.name}. Someone is on the way.` : `${cap(crowns(unit.purse))} at ${b.name}. ${left < 1 ? 'It will be spent by tomorrow.' : `Spent at the tavern in ${plural(Math.ceil(left), 'day')}.`}`,
          run: () => {
            const res = ctx.act({ type: 'collect_purse', buildingId: bid, unit: u });
            if (res.ok) { waitUntil.set(key, performance.now() + 2500); dirty = true; }
          },
        });
      }
    }

    for (const j of working) {
      if (j.kind === 'build' || j.kind === 'collect' || underWay.has(j.id)) continue;
      const ic = JOB_ICON[j.kind];
      if (!ic) continue;
      const b = j.buildingId ? st.buildings[j.buildingId] : undefined;
      const tx = Math.floor(j.x), ty = Math.floor(j.y);
      out.push({
        key: 'w:j:' + j.id, kind: 'work', ref: b ? { buildingId: b.id, at: 'top' } : { tile: [tx, ty] }, group: b ? 't:' + b.id : `x:${tx},${ty}`, prio: 0,
        icon: ic, wax: 'work', seal: false, ring: clamp(j.progress, 0, 1), hot: false, pending: false, title: '', sub: '', run: null,
      });
    }
    return out;
  }

  // ───────── making and dressing a pin ─────────
  function ringSvg(size: number): string {
    const c = size / 2, r = c - 1.8;
    return `<svg class="ll-pin-ring" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle class="t" cx="${c}" cy="${c}" r="${r}"/><circle class="v" cx="${c}" cy="${c}" r="${r}" pathLength="100" stroke-dasharray="100 100"/></svg>`;
  }
  function faceOf(spec: Spec): { html: string; art: boolean } {
    const plain = iconSvg(spec.icon);
    if (spec.seal) {
      const art = sealSvg(spec.icon, WAX_HEX[spec.wax], 34);
      if (art && art !== plain) return { html: art, art: true };
    }
    return { html: plain, art: false };
  }
  function make(spec: Spec): Pin {
    const work = spec.kind === 'work';
    const face = h('span', { class: 'll-pin-face' });
    const ring = spec.ring !== null || !work ? fromHTML(ringSvg(work ? 28 : 40)) : null;
    const badge = work ? null : h('span', { class: 'll-pin-badge' });
    const inner = h('span', { class: 'll-pin-in' }, ring, face, badge);
    const stem = h('span', { class: 'll-pin-stem' });
    const pin: Pin = {
      spec, face, badge, el: null as unknown as HTMLElement, ringV: ring ? ring.querySelector<SVGElement>('.v') : null,
      faceSig: '', ringSig: '', tipSig: '', dx: 0, x: 0, y: 0, s: 1, alpha: 1, vis: false, shown: false, tf: '', op: '',
      leader: null, members: [], memberSig: '',
    };
    pin.el = work
      ? h('div', { class: 'll-pin is-off', 'aria-hidden': 'true' }, inner, stem)
      : h('button', { class: 'll-pin is-off', type: 'button', onclick: (e: MouseEvent) => press(pin, e) }, inner, stem);
    dress(pin, spec);
    el.appendChild(pin.el);
    return pin;
  }
  function dress(pin: Pin, spec: Spec): void {
    pin.spec = spec;
    const v = (spec.key.charCodeAt(spec.key.length - 1) + spec.key.length) % 3;
    const cls = `ll-pin ll-wax ll-pin--${spec.kind} c-${spec.wax} v${v}${spec.hot ? ' is-hot' : ''}${spec.pending ? ' is-pending' : ''}${pin.shown ? '' : ' is-off'}${pin.members.length ? ' has-more' : ''}`;
    if (pin.el.className !== cls) pin.el.className = cls;
    const faceSig = spec.icon + '|' + spec.wax + '|' + spec.seal;
    if (faceSig !== pin.faceSig) {
      pin.faceSig = faceSig;
      const f = faceOf(spec);
      pin.face.innerHTML = f.html;
      setClass(pin.face, 'is-art', f.art);
    }
    if (pin.ringV) {
      const sig = spec.ring === null ? 'none' : (Math.round(spec.ring * 200) / 2).toString();
      if (sig !== pin.ringSig) {
        pin.ringSig = sig;
        pin.ringV.setAttribute('stroke-dasharray', spec.ring === null ? '0 100' : `${sig} 100`);
        (pin.ringV.parentNode as SVGElement).style.visibility = spec.ring === null ? 'hidden' : '';
      }
    }
    tip(pin);
  }
  function tip(pin: Pin): void {
    if (pin.spec.kind === 'work') return;
    const many = pin.members.length;
    const head = many ? `${many + 1} matters here` : pin.spec.title;
    const body = many ? [pin, ...pin.members].map(p => p.spec.title).join('\n') : pin.spec.sub;
    const sig = head + '|' + body;
    if (sig === pin.tipSig) return;
    pin.tipSig = sig;
    setAttr(pin.el, 'data-tip-h', head);
    setAttr(pin.el, 'data-tip', body);
    setAttr(pin.el, 'aria-label', `${head}. ${body}`);
  }
  function retire(pin: Pin): void {
    if (pop && pop.pin === pin) closePop();
    pin.el.classList.add('is-gone');
    const gone = pin.el;
    window.setTimeout(() => gone.remove(), 180);
  }

  function reconcile(st: GameState): void {
    dirty = false; since = 0; lastFold = -1e9;
    const specs = gather(st);
    const seen = new Set<string>();
    const groups = new Map<string, Pin[]>();
    for (const spec of specs) {
      seen.add(spec.key);
      let pin = pins.get(spec.key);
      if (!pin) { pin = make(spec); pins.set(spec.key, pin); } else dress(pin, spec);
      const g = groups.get(spec.group);
      if (g) g.push(pin); else groups.set(spec.group, [pin]);
    }
    for (const [key, pin] of pins) if (!seen.has(key)) { pins.delete(key); retire(pin); }
    for (const g of groups.values()) {
      g.sort((a, b) => b.spec.prio - a.spec.prio || (a.spec.key < b.spec.key ? -1 : 1));
      g.forEach((p, i) => { p.dx = (i - (g.length - 1) / 2) * SPREAD; });
    }
    list = Array.from(pins.values());
    if (pop && pop.incidentId) { const inc = st.incidents[pop.incidentId]; if (!inc || inc.state !== 'open') closePop(); }
    if (waitUntil.size) { const now = performance.now(); for (const [k, t] of waitUntil) if (t < now) waitUntil.delete(k); }
  }

  // ───────── every frame ─────────
  function fold(): void {
    const live = list.filter(p => p.vis && p.spec.kind !== 'work');
    live.sort((a, b) => b.spec.prio - a.spec.prio || (a.spec.key < b.spec.key ? -1 : 1));
    const leaders: Pin[] = [];
    for (const p of live) p.members.length = 0;
    for (const p of live) {
      let into: Pin | null = null;
      for (const L of leaders) {
        const r = (p.leader === L ? STAY : JOIN) * Math.min(p.s, L.s);
        const dx = p.x - L.x, dy = p.y - L.y;
        if (dx * dx + dy * dy < r * r) { into = L; break; }
      }
      p.leader = into;
      if (into) into.members.push(p); else leaders.push(p);
    }
    for (const p of list) {
      if (!p.vis || p.spec.kind === 'work') { p.leader = null; if (p.members.length) p.members.length = 0; }
      const sig = p.members.map(m => m.spec.key).join(',');
      if (sig !== p.memberSig) {
        p.memberSig = sig;
        setClass(p.el, 'has-more', p.members.length > 0);
        if (p.badge) setText(p.badge, String(p.members.length + 1));
        tip(p);
        if (pop && pop.pin === p && !pop.incidentId) closePop();        // the list it showed has changed
      }
    }
  }
  function frame(): void {
    const r = ctx.renderer;
    for (const p of list) {
      const a = r.anchor(p.spec.ref);
      p.vis = a.visible;
      if (!a.visible) continue;
      p.s = clamp(a.scale, MIN_SCALE, MAX_SCALE);
      p.x = a.x + p.dx * p.s; p.y = a.y;
      p.alpha = a.scale >= MIN_SCALE ? 1 : Math.max(0.5, a.scale / MIN_SCALE);
    }
    const now = performance.now();
    if (now - lastFold > 150) { lastFold = now; fold(); }
    for (const p of list) {
      const show = p.vis && !p.leader;
      if (show !== p.shown) { p.shown = show; setClass(p.el, 'is-off', !show); }
      if (!show) continue;
      const tf = `translate3d(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px,0) scale(${p.s.toFixed(3)})`;
      if (tf !== p.tf) { p.tf = tf; p.el.style.transform = tf; }
      const op = p.alpha.toFixed(2);
      if (op !== p.op) { p.op = op; p.el.style.opacity = op === '1.00' ? '' : op; }
    }
    placePop();
  }

  // ───────── the small parchment on a pin ─────────
  function placePop(): void {
    if (!pop) return;
    const at = pop.pin.leader ?? pop.pin;
    if (!at.vis || !pins.has(pop.pin.spec.key)) { closePop(); return; }
    // above the pin if there is room, else below it, else beside it: never over the word bar
    const above = at.y - 62 * at.s - 8 - pop.h;
    const below = at.y + 14;
    let x = clamp(at.x - pop.w / 2, 8, Math.max(8, vw - pop.w - 8));
    let y = above;
    if (above < 8) {
      if (below + pop.h <= pop.floor) y = below;
      else {
        const right = at.x + 30 * at.s, left = at.x - 30 * at.s - pop.w;
        if (right + pop.w <= vw - 8) x = right; else if (left >= 8) x = left;
        y = clamp(at.y - 34 * at.s - pop.h / 2, 8, Math.max(8, pop.floor - pop.h));
      }
    }
    const tf = `translate3d(${Math.round(x)}px,${Math.round(Math.max(8, y))}px,0)`;
    if (tf !== pop.tf) { pop.tf = tf; pop.el.style.transform = tf; }
  }
  function onOutside(e: Event): void {
    if (!pop || !(e.target instanceof Node)) return;
    if (pop.el.contains(e.target) || pop.pin.el.contains(e.target) || (pop.pin.leader?.el.contains(e.target) ?? false)) return;
    closePop();
  }
  function closePop(): void {
    if (!pop) return;
    pop.el.remove(); pop = null;
    document.removeEventListener('pointerdown', onOutside, true);
  }
  function openPop(pin: Pin, body: HTMLElement, incidentId: Id | null, focus: boolean): void {
    closePop();
    const box = h('div', { class: 'll-pop', role: 'dialog', 'aria-label': pin.spec.title }, body);
    ctx.root.appendChild(box);
    measure();
    const wordH = parseFloat(getComputedStyle(ctx.root).getPropertyValue('--ll-word-h')) || 0;
    pop = { pin, el: box, w: box.offsetWidth, h: box.offsetHeight, floor: vh - wordH - 24, tf: '', incidentId };
    document.addEventListener('pointerdown', onOutside, true);
    placePop();
    if (focus) box.querySelector<HTMLElement>('.ll-pop-opt, .ll-pop-row')?.focus();
  }

  function terms(o: OutcomeDef, st: GameState): { text: string; short: boolean } {
    let cost = o.job?.cost ?? 0, gain = 0;
    for (const e of o.effects) if (e.t === 'gold') { if (e.amount < 0) cost -= e.amount; else gain += e.amount; }
    const money = cost > 0 && gain > 0 ? `${cap(crowns(cost))}, and ${crowns(gain)} back.` : cost > 0 ? `${cap(crowns(cost))}.` : gain > 0 ? `Brings ${crowns(gain)}.` : 'No cost.';
    let who = 'Done at once.';
    const j = o.job;
    if (j) {
      const staff = Object.values(st.staff);
      const m = j.role === 'ruler' || j.role === 'any' ? undefined : staff.find(x => x.role === j.role);
      who = m ? `${m.first} goes, about ${span(j.days)}.` : j.role === 'any' && staff.length ? `Whoever is free goes, about ${span(j.days)}.` : `You go yourself, about ${span(j.days)}.`;
    }
    return { text: `${money} ${who}`, short: cost > 0 && cost > st.gold };
  }
  function openIncident(pin: Pin, incidentId: Id, viaKey: boolean): void {
    if (pop && pop.incidentId === incidentId) { closePop(); return; }
    const st = ctx.state();
    const inc: Incident | undefined = st.incidents[incidentId];
    const def: IncidentDef | undefined = inc && INCIDENT_BY_ID[inc.defId];
    if (!inc || !def) return;
    const b = inc.buildingId ? st.buildings[inc.buildingId] : undefined;
    const left = inc.expiresDay === null ? null : inc.expiresDay - st.day;
    const outs = def.outcomes.slice().sort((x, y) => Number(!!y.default) - Number(!!x.default));
    const opts = outs.map((o, i) => {
      const t = terms(o, st);
      return h('button', {
        class: `ll-btn ll-pop-opt ${i === 0 ? 'll-btn-primary' : 'll-btn-plain'}`, type: 'button',
        onclick: () => {
          const res = ctx.act({ type: 'resolve_incident', incidentId, outcomeId: o.id });
          if (!res.ok) return;
          waitUntil.set(pin.spec.key, performance.now() + 2500); dirty = true;
          closePop();
        },
      }, h('b', null, o.label), h('span', { class: t.short ? 'is-short' : '' }, t.text));
    });
    const hot = left !== null && left < 2;
    openPop(pin, panel({ title: def.title, class: 'll-pop-in', onClose: closePop },
      h('p', { class: 'll-pop-where' + (hot ? ' is-hot' : '') }, `${b ? b.name + '. ' : ''}${timeLeft(left)}`.trim()),
      h('p', { class: 'll-pop-text' }, fillText(def.herald, inc.vars)),
      h('div', { class: 'll-pop-opts' }, opts)), incidentId, viaKey);
  }
  function openCluster(pin: Pin, viaKey: boolean): void {
    if (pop && pop.pin === pin && !pop.incidentId) { closePop(); return; }
    const all = [pin, ...pin.members];
    const rows = all.map(p => h('button', {
      class: 'll-pop-row', type: 'button', disabled: p.spec.pending || !p.spec.run,
      onclick: () => { closePop(); p.spec.run?.(p, false); },
    }, h('span', { class: `ll-pin-face ll-wax c-${p.spec.wax}`, html: iconSvg(p.spec.icon) }), h('span', null, h('b', null, p.spec.title), h('span', null, p.spec.sub))));
    const purses = all.filter(p => p.spec.kind === 'purse' && !p.spec.pending);
    const sweep = purses.length >= 2
      ? h('button', { class: 'll-btn ll-btn-plain ll-pop-all', type: 'button', onclick: () => { closePop(); for (const p of purses) p.spec.run?.(p, false); } }, `Collect these ${purses.length} purses`)
      : null;
    openPop(pin, panel({ title: `${all.length} matters here`, class: 'll-pop-in', onClose: closePop }, h('div', null, rows), sweep), null, viaKey);
  }
  function press(pin: Pin, e: MouseEvent): void {
    const viaKey = e.detail === 0;
    if (pin.members.length) { openCluster(pin, viaKey); return; }
    if (pin.spec.pending || !pin.spec.run) {
      const b = 'buildingId' in pin.spec.ref ? pin.spec.ref.buildingId : null;   // nothing to decide: at least show the place
      if (b) ctx.select({ buildingId: b });
      return;
    }
    pin.spec.run(pin, viaKey);
  }

  function reset(): void {
    closePop();
    for (const p of pins.values()) p.el.remove();
    pins.clear(); list = []; waitUntil.clear();
    dirty = true;
  }

  const part: ShellPart & { dispose(): void } = {
    el,
    update(state, dt) {
      if (state !== lastState) { lastState = state; reset(); measure(); }
      if (!visible) return;
      since += dt;
      if (dirty || since >= 0.2) reconcile(state);
      frame();
    },
    handleEvents(events: SimEvent[]) {
      for (const ev of events) {
        switch (ev.type) {
          case 'incident': case 'incident_resolved': case 'incident_expired': case 'purse': case 'purse_collected':
          case 'applicant': case 'applicant_gone': case 'job': case 'building_placed': case 'building_done':
          case 'building_removed': case 'actor_spawn': case 'actor_gone': case 'tenant_in': case 'tenant_out':
            dirty = true; break;
          default:
        }
      }
    },
    setVisible(on) {
      if (on === visible) return;
      visible = on;
      el.hidden = !on;
      if (!on) closePop(); else dirty = true;
    },
    escape() { if (!pop) return false; closePop(); return true; },
    reset() { lastState = null; reset(); },
    dispose() { closePop(); window.removeEventListener('resize', measure); },
  };
  return part;
}
