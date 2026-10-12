/**
 * OWNER: ui-shell agent. The heralds: the feed as narrow parchment strips,
 * newest on top, fading after a while (hovering holds them), and the full
 * roll behind a seal. Under 700px the strips fold into a bell with a count.
 *
 * The horn and the chime belong to the audio module, which hears the same
 * herald events; nothing here makes a sound of its own.
 */
import type { GameState, SimEvent, Herald, HeraldKind, Id } from '../../sim/types';
import { fmtDate } from '../../sim/core';
import { INCIDENT_BY_ID } from '../../data';
import type { IconId } from '../../data/ids';
import type { UICtx } from '../api';
import type { Part } from './part';
import type { ShellCtx, ShellPart, Sel } from '../index';
import { h, clear, fromHTML, setText, setClass, panel } from '../kit';
import { iconSvg } from '../icons';
import { doodle } from '../marginalia';

const KIND_ICON: Record<HeraldKind, IconId> = {
  info: 'quill', good: 'star', bad: 'warning', urgent: 'horn', crown: 'crown', staff: 'people', rival: 'flag', oath: 'handshake',
};
/** seconds a strip stays before it fades, by kind */
const LIFE: Record<HeraldKind, number> = { urgent: 24, crown: 22, bad: 17, rival: 15, oath: 15, good: 12, staff: 12, info: 11 };
const MAX_STRIPS = 5;
const icon = (id: IconId): HTMLElement => fromHTML(iconSvg(id));

interface Strip { herald: Herald; item: HTMLElement; life: number; out: boolean }
type Target = { audience: Id } | { sel: Sel } | null;

export function mount(ctx: UICtx): Part {
  const shell = (ctx as Partial<ShellCtx>).shell;
  const mq = window.matchMedia('(max-width: 699px)');
  const narrow = (): boolean => (shell ? shell.narrow() : mq.matches);

  const stripsEl = h('div', { class: 'll-her-strips', role: 'log', 'aria-live': 'polite', 'aria-label': 'The herald' });
  const badge = h('span', { class: 'll-her-badge' });
  const moreBtn = h('button', {
    class: 'll-seal ll-her-more', type: 'button', 'aria-label': 'The herald’s roll', 'aria-expanded': 'false',
    dataset: { tipH: 'The herald’s roll', tip: 'Everything cried so far, newest first.' },
    onclick: () => (logEl ? closeLog() : openLog()),
  }, h('span', { class: 'i-scroll' }, icon('scroll')), h('span', { class: 'i-bell' }, icon('bell')), badge);
  const el = h('div', { class: 'll-her' }, stripsEl, moreBtn);

  let strips: Strip[] = [];          // newest first
  let unread = 0, held = false, visible = true;
  let logEl: HTMLElement | null = null, logList: HTMLElement | null = null, logStale = false;
  let lastState: GameState | null = null;

  // phones: the one strip on show lies under the HUD row. Tell the HUD how deep it is, so its ribbon tags hang below it.
  let depth = '';
  function publish(px: number): void {
    const v = px > 0 && narrow() ? Math.round(px) + 'px' : '0px';
    if (v === depth) return;
    depth = v;
    ctx.root.querySelector<HTMLElement>('.ll-slot-hud')?.style.setProperty('--ll-her-h', v);
  }
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(entries => {
    const en = entries[entries.length - 1];
    if (en) publish(en.borderBoxSize?.[0]?.blockSize ?? en.contentRect.height);
  }) : null;
  ro?.observe(stripsEl);

  stripsEl.addEventListener('pointerenter', () => { held = true; });
  stripsEl.addEventListener('pointerleave', () => { held = false; });
  stripsEl.addEventListener('focusin', () => { held = true; });
  stripsEl.addEventListener('focusout', () => { held = false; });

  // ── where a herald leads
  function targetOf(hd: Herald, st: GameState): Target {
    const inc = hd.incidentId ? st.incidents[hd.incidentId] : undefined;
    if (inc && inc.state === 'open' && INCIDENT_BY_ID[inc.defId]?.audience) return { audience: inc.id };
    if (hd.buildingId && st.buildings[hd.buildingId]) return { sel: { buildingId: hd.buildingId } };
    if (hd.tenantId && st.tenants[hd.tenantId]?.buildingId) return { sel: { tenantId: hd.tenantId } };
    if (hd.staffId && st.staff[hd.staffId]) return { sel: { staffId: hd.staffId } };
    if (inc?.buildingId && st.buildings[inc.buildingId]) return { sel: { buildingId: inc.buildingId } };
    return null;
  }
  function follow(hd: Herald): void {
    const t = targetOf(hd, ctx.state());
    if (!t) return;
    if ('audience' in t) { ctx.open('audience', t.audience); return; }
    if (shell) shell.reveal(t.sel);
    else {
      const st = ctx.state();
      const b = t.sel.buildingId ?? (t.sel.tenantId ? st.tenants[t.sel.tenantId]?.buildingId ?? undefined : undefined);
      if (b) ctx.renderer.focus({ buildingId: b });
      ctx.select(t.sel);
    }
  }
  function iconOf(hd: Herald, st: GameState): IconId {
    const inc = hd.incidentId ? st.incidents[hd.incidentId] : undefined;
    return (inc && INCIDENT_BY_ID[inc.defId]?.icon) || KIND_ICON[hd.kind] || 'quill';
  }

  // ── strips
  function leave(s: Strip): void {
    if (s.out) return;
    s.out = true;
    s.item.classList.add('is-out');
    window.setTimeout(() => { s.item.remove(); }, 330);
    strips = strips.filter(x => x !== s);
    age();
  }
  function age(): void { strips.forEach((s, i) => setClass(s.item, 'is-old', i >= 2)); }
  function add(hd: Herald): void {
    if (!logEl) unread++;
    logStale = true;
    if (narrow() && hd.kind !== 'urgent' && hd.kind !== 'crown' && hd.kind !== 'bad') return;   // phones: only what cannot wait interrupts
    const st = ctx.state();
    const tg = targetOf(hd, st);
    const text = h('span', { class: 'll-her-text' }, hd.text, tg && 'audience' in tg ? h('span', { class: 'll-her-cue' }, 'Hear them') : null);
    const cls = `ll-her-strip k-${hd.kind}`;
    const s: Strip = { herald: hd, item: null as unknown as HTMLElement, life: (narrow() ? 7 : LIFE[hd.kind] ?? 12) + hd.text.length * 0.04, out: false };
    const strip = tg
      ? h('button', { class: cls, type: 'button', onclick: () => { follow(hd); leave(s); } }, icon(iconOf(hd, st)), text)
      : h('div', { class: cls }, icon(iconOf(hd, st)), text);
    s.item = h('div', { class: 'll-her-item' }, h('div', { class: 'll-her-clip' }, strip));
    stripsEl.prepend(s.item);
    strips.unshift(s);
    while (strips.length > MAX_STRIPS) leave(strips[strips.length - 1]!);
    age();
  }
  function clearAll(): void {
    for (const s of strips) { s.out = true; s.item.remove(); }
    strips = []; unread = 0; held = false;
    clear(stripsEl);
    closeLog();
  }

  // ── the roll
  function renderLog(): void {
    if (!logList) return;
    logStale = false;
    clear(logList);
    const st = ctx.state();
    const all = st.heralds;
    if (!all.length) { logList.appendChild(h('p', { class: 'll-note ll-her-empty' }, 'Nothing has been cried yet. The herald distrusts the quiet.')); return; }
    let day = '';
    for (let i = all.length - 1, n = 0; i >= 0; i--, n++) {
      const hd = all[i]!;
      const d = fmtDate(hd.day);
      if (d !== day) { day = d; logList.appendChild(h('h3', { class: 'll-her-day' }, d)); }
      if (n % 7 === 3) {
        const art = doodle('any', (Math.floor(hd.day) * 31 + n) | 0, 46);
        if (art) logList.appendChild(h('span', { class: 'll-her-doodle', html: art, 'aria-hidden': 'true' }));
      }
      const cls = `ll-her-entry k-${hd.kind}`;
      const body = [icon(iconOf(hd, st)), h('span', null, hd.text)];
      logList.appendChild(targetOf(hd, st)
        ? h('button', { class: cls, type: 'button', onclick: () => { closeLog(); follow(hd); } }, body)
        : h('div', { class: cls }, body));
    }
  }
  function onOutside(e: Event): void { if (!(e.target instanceof Node && el.contains(e.target))) closeLog(); }
  function openLog(): void {
    if (logEl) return;
    logList = h('div');
    logEl = panel({ title: 'The herald’s roll', class: 'll-her-log', onClose: closeLog }, logList);
    logEl.setAttribute('role', 'dialog');
    logEl.setAttribute('aria-label', 'The herald’s roll');
    unread = 0;
    stripsEl.hidden = true;
    el.appendChild(logEl);
    el.parentElement?.classList.add('is-raised');       // the roll lies over the rail and the HUD's tags, not under them
    moreBtn.setAttribute('aria-expanded', 'true');
    renderLog();
    document.addEventListener('pointerdown', onOutside, true);
  }
  function closeLog(): void {
    if (!logEl) return;
    logEl.remove(); logEl = null; logList = null;
    el.parentElement?.classList.remove('is-raised');
    stripsEl.hidden = false;
    moreBtn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onOutside, true);
  }

  const part: ShellPart & { dispose(): void } = {
    el,
    update(state, dt) {
      if (state !== lastState) { lastState = state; clearAll(); }
      if (!held && !logEl) {
        for (const s of strips.slice()) { s.life -= dt; if (s.life <= 0) leave(s); }
      }
      if (logEl && logStale) renderLog();
      setText(badge, unread > 99 ? '99' : String(unread));
      setClass(badge, 'is-on', unread > 0);
    },
    handleEvents(events: SimEvent[], state) {
      if (state !== lastState) { lastState = state; clearAll(); }
      for (const ev of events) {
        if (ev.type === 'herald') add(ev.herald);
        else if (ev.type === 'incident_resolved' || ev.type === 'incident_expired') {
          for (const s of strips.slice()) if (s.herald.incidentId === ev.incidentId) leave(s);   // the matter is closed: its summons should not linger
          logStale = true;
        }
      }
    },
    setVisible(on) { if (on === visible) return; visible = on; if (!on) closeLog(); },
    escape() { if (!logEl) return false; closeLog(); return true; },
    reset() { lastState = null; clearAll(); },
    dispose() { ro?.disconnect(); closeLog(); },
  };
  return part;
}
