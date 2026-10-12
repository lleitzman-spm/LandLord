/**
 * Tiny DOM kit shared by every UI module. Owned by the integrator.
 * Class names here are styled in css/base.ts — use them rather than inventing
 * parallel ones, so the manuscript stays one hand.
 */
type Child = Node | string | number | null | undefined | false | Child[];
type Props = Record<string, unknown> & { class?: string; style?: Partial<CSSStyleDeclaration> | string; dataset?: Record<string, string>; on?: Record<string, EventListener> };

/** h('div', { class: 'll-row', onclick }, child, child) */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'style') { if (typeof v === 'string') el.setAttribute('style', v); else Object.assign(el.style, v); }
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'on') for (const [evn, fn] of Object.entries(v as Record<string, EventListener>)) el.addEventListener(evn, fn);
      else if (k === 'html') el.innerHTML = String(v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else if (k in el && k !== 'list' && k !== 'form') (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}
export function append(el: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export function clear(el: Element): void { while (el.firstChild) el.removeChild(el.firstChild); }
/** Parse an SVG/HTML string into an element (for icons, portraits, marginalia). */
export function fromHTML(html: string): HTMLElement {
  const t = document.createElement('template'); t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}
const styled = new Set<string>();
/** Inject a stylesheet once (each UI module calls this with its own id). */
export function addStyle(id: string, css: string): void {
  if (styled.has(id)) return; styled.add(id);
  const s = document.createElement('style'); s.dataset.ll = id; s.textContent = css; document.head.appendChild(s);
}
/** Only touch the DOM when the value actually changed (call freely every frame). */
export function setText(el: Element, text: string): void { if (el.textContent !== text) el.textContent = text; }
export function setClass(el: Element, cls: string, on: boolean): void { if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on); }
export function setAttr(el: Element, name: string, value: string): void { if (el.getAttribute(name) !== value) el.setAttribute(name, value); }

/** "1,240" */
export function num(n: number): string { return Math.round(n).toLocaleString('en-US'); }
/** "+12" / "−5" (true minus sign) */
export function signed(n: number): string { const r = Math.round(n); return (r >= 0 ? '+' : '−') + Math.abs(r).toLocaleString('en-US'); }
export function crowns(n: number): string { const r = Math.round(n); return (r < 0 ? '−' : '') + Math.abs(r).toLocaleString('en-US') + (Math.abs(r) === 1 ? ' crown' : ' crowns'); }
export function plural(n: number, one: string, many?: string): string { return n === 1 ? `${n} ${one}` : `${n} ${many ?? one + 's'}`; }
export function cap(s: string): string { return s ? s[0]!.toUpperCase() + s.slice(1) : s; }
export function esc(s: string): string { return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)); }

// ───────── standard pieces (styled in css/base.ts) ─────────

/** A parchment panel with an optional rubric title and close seal. */
export function panel(opts: { title?: string; class?: string; onClose?: () => void; dropCap?: boolean }, ...children: Child[]): HTMLDivElement {
  return h('div', { class: 'll-panel ' + (opts.class ?? '') },
    opts.title ? h('div', { class: 'll-panel-head' }, h('h2', { class: 'll-title' }, opts.title), opts.onClose ? h('button', { class: 'll-seal ll-close', title: 'Close', 'aria-label': 'Close', onclick: opts.onClose }, '✕') : null) : null,
    h('div', { class: 'll-panel-body' }, children));
}
export function button(label: Child, onClick: (e: MouseEvent) => void, opts: { kind?: 'primary' | 'plain' | 'danger' | 'quiet'; title?: string; disabled?: boolean; class?: string } = {}): HTMLButtonElement {
  return h('button', { class: `ll-btn ll-btn-${opts.kind ?? 'plain'} ${opts.class ?? ''}`, title: opts.title, disabled: opts.disabled, onclick: onClick as EventListener, type: 'button' }, label);
}
/** label / value line, e.g. stat('Rent', '16 crowns') */
export function stat(label: string, value: Child, opts: { class?: string; title?: string } = {}): HTMLDivElement {
  return h('div', { class: 'll-stat ' + (opts.class ?? ''), title: opts.title }, h('span', { class: 'll-stat-k' }, label), h('span', { class: 'll-stat-v' }, value));
}
/** 0..100 bar */
export function meter(value: number, opts: { kind?: 'good' | 'warn' | 'bad' | 'gold' | 'ink'; title?: string } = {}): HTMLDivElement {
  const v = Math.max(0, Math.min(100, value));
  return h('div', { class: `ll-meter ll-meter-${opts.kind ?? (v >= 60 ? 'good' : v >= 35 ? 'warn' : 'bad')}`, title: opts.title, role: 'meter', 'aria-valuenow': String(Math.round(v)), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('i', { style: { width: v + '%' } }));
}
export function tag(text: string, kind: 'plain' | 'good' | 'bad' | 'gold' | 'lapis' = 'plain'): HTMLSpanElement {
  return h('span', { class: `ll-tag ll-tag-${kind}` }, text);
}
