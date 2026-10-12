/**
 * The Word bar: the throne's voice.
 *
 * A speech scroll at the foot of the table. You type or hold the microphone
 * seal (or the backquote key; or Space, held, when nothing has focus and the
 * box is empty), pick who you are addressing, and Enter sends it to the word
 * layer. The answer is read back just above the bar in the speaker's own
 * voice. Weighty things wait for "Aye".
 *
 * Hooks for the rest of the interface:
 *   speakTo(target, text?)   address the bar to someone and focus it (inspector, council)
 *   fillWord(text)           put words in the box without sending (help, whispers)
 *   window CustomEvent 'll:speak'  detail { target?: SpeakTarget; text?: string }
 * With the frame: Enter / T arrive as the frame's `ll:summon` ('word') on
 * ctx.root, which this part answers. Space is the frame's pause key; when the
 * microphone works we take the key over while nothing has focus: a tap still
 * pauses (through `ctx.shell.togglePause` when the frame offers it), a hold talks.
 * Extras beyond `Part`: `focus()`, `speakTo()`, `escape()`, `reset()`, `dispose()`.
 */
import type { UICtx } from '../api';
import type { Part } from './part';
import type { GameState, Id, StaffRole, Speed } from '../../sim/types';
import { STAFF_ROLES } from '../../sim/types';
import { fmtDate } from '../../sim/core';
import type { Exchange, SpeakTarget, Speaker } from '../../word/api';
import type { IconId } from '../../data/ids';
import { ROLE_TITLES } from '../../data/ids';
import { RANKS, CHARACTERS, NPC_DEFS } from '../../data';
import { h, clear, fromHTML, addStyle, setText, setClass } from '../kit';
import { iconSvg } from '../icons';
import { createPortrait, type Portrait, type PortraitSpec } from '../portraits';
import { TOOLS_CSS } from '../css/tools';

// ───────────────────────── the hook other parts call ─────────────────────────

interface Voice { address(target: SpeakTarget, text?: string): void; fill(text: string): void }
let active: Voice | null = null;
/** Address the Word bar to someone (and optionally put words in the box), then focus it. */
export function speakTo(target: SpeakTarget, text?: string): void { active?.address(target, text); }
/** Put words in the Word box without sending them. */
export function fillWord(text: string): void { active?.fill(text); }

// ───────────────────────── small things ─────────────────────────

const ROLE_ICON: Record<StaffRole, IconId> = { mason: 'hammer', bailiff: 'key', crier: 'bell', steward: 'quill' };
const ico = (id: IconId): HTMLElement => fromHTML(iconSvg(id));
const CANDLE = '<svg class="ll-wb-candlesvg" viewBox="0 0 20 30" aria-hidden="true">'
  + '<circle class="ll-wb-glow" cx="10" cy="7.4" r="6.6"/>'
  + '<path class="ll-wb-flame" d="M10 2.4Q13.7 7 10 11.3Q6.3 7 10 2.4Z"/>'
  + '<path class="ll-wb-wisp" d="M10 10.6q-2-2.2 0-4.2q1.8-2 .2-4"/>'
  + '<path class="ll-wb-wick" d="M10 11.2v2.3"/>'
  + '<path class="ll-wb-wax" d="M6.6 13.5h6.8v11.5h-6.8Z"/><path class="ll-wb-drip" d="M6.6 16q1.3 1 1.3 2.6"/>'
  + '<path class="ll-wb-dish" d="M3.5 25h13q-.5 3-6.5 3t-6.5-3Z"/></svg>';

const AYE = /^\s*(aye|yes|yea|so be it|do it|go on|make it so|agreed)\b[\s.!]*$/i;
const NAY = /^\s*(nay|no|stop|wait|hold|never mind|not that)\b[\s.!]*$/i;

function sameTarget(a: SpeakTarget, b: SpeakTarget): boolean {
  if ('to' in a) return 'to' in b && a.to === b.to;
  if ('tenantId' in a) return 'tenantId' in b && a.tenantId === b.tenantId;
  return 'buildingId' in b && a.buildingId === b.buildingId;
}
function isTyping(): boolean {
  const a = document.activeElement as HTMLElement | null;
  return !!a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable);
}
function focusIdle(): boolean {
  const a = document.activeElement as HTMLElement | null;
  return !a || a === document.body || a === document.documentElement || a.tagName === 'CANVAS';
}

interface Card {
  text: string;
  target: SpeakTarget;
  ex: Exchange | null;
  status: Exchange['status'] | 'waiting' | 'lost';
  typed: number;
  finished: boolean;
  face: Portrait | null;
  voice: { stop(): void } | null;
  /** performance.now() after which the card puts itself away; 0 = stays */
  until: number;
  answered: boolean;
}

export interface WordBarPart extends Part {
  /** Esc: put away the log or a finished answer, and say so */
  escape(): boolean;
  /** the sim was replaced */
  reset(): void;
  focus(): void;
  speakTo(target: SpeakTarget, text?: string): void;
  dispose(): void;
}

// ───────────────────────── the part ─────────────────────────

export function mount(ctx: UICtx): WordBarPart {
  addStyle('tools', TOOLS_CSS);

  let addressee: SpeakTarget = { to: 'court' };
  let sel: { buildingId?: Id; tenantId?: Id } | null = null;
  let visible = true;
  let awaiting = false;
  let seq = 0;
  let card: Card | null = null;
  let chipSig = '';
  let logOpen = false;
  let online = false;
  let ready = false;
  let releaseCrawl: (() => void) | null = null;
  let lastKeyAt = 0;
  let listening = false;
  let finalising = 0;
  let micDead = false;
  let micNoted = false;
  let offlineNoted = false;
  let autoTimer = 0;
  let noteTimer = 0;
  let spaceTimer = 0;
  let spaceTalk = false;
  let spaceDown = false;
  let keyTalk = false;
  let hoverCard = false;
  let candleAcc = 1;
  let sentAt = 0;
  const hist: string[] = [];
  let histIdx = -1;
  let draft = '';
  const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const mic = (): UICtx['word']['mic'] | null => { try { return ctx.word.mic ?? null; } catch { return null; } };
  const micOk = (): boolean => !micDead && !!mic()?.supported;
  const sfx = (id: 'quill' | 'stamp' | 'page'): void => { try { ctx.audio.sfx(id, { volume: 0.6 }); } catch { /* silence is fine */ } };

  // ── DOM
  const logList = h('div', { class: 'll-wb-loglist ll-scrollbox' });
  const logEl = h('section', { class: 'll-wb-log ll-parch', hidden: true, 'aria-label': 'What has been said' },
    h('header', { class: 'll-wb-loghead' }, h('h3', { class: 'll-title' }, 'What has been said'),
      h('button', { class: 'll-seal ll-close', type: 'button', 'aria-label': 'Close', onclick: () => toggleLog(false) }, '✕')),
    logList);
  const cardEl = h('section', { class: 'll-wb-ex ll-parch', hidden: true, 'aria-live': 'polite' });
  const noteEl = h('p', { class: 'll-wb-note', hidden: true, role: 'status' });
  const above = h('div', { class: 'll-wb-above' }, logEl, cardEl, noteEl);

  const chipsEl = h('div', { class: 'll-wb-chips', role: 'radiogroup', 'aria-label': 'Who you are addressing' });
  const candle = h('button', { class: 'll-wb-candle', type: 'button', html: CANDLE, 'aria-label': 'The court is listening', onclick: () => candleNote() });
  const input = h('input', {
    class: 'll-wb-input', type: 'text', autocomplete: 'off', autocapitalize: 'sentences', enterKeyHint: 'send', maxLength: 280,
    'aria-label': 'Speak to your court',
  });
  const micBtn = h('button', { class: 'll-seal ll-wb-mic', type: 'button', 'aria-label': 'Hold to speak', 'data-tip': 'Hold to speak. Or hold the ` key.' }, ico('mic'));
  const sendBtn = h('button', { class: 'll-seal ll-wb-send', type: 'button', 'aria-label': 'Say it', 'data-tip': 'Say it (Enter)', onclick: () => { cancelAuto(); send(); } }, ico('send'));
  const logBtn = h('button', { class: 'll-wb-logbtn', type: 'button', 'aria-label': 'What has been said', 'data-tip': 'What has been said', onclick: () => toggleLog() }, ico('scroll'));
  const bar = h('div', { class: 'll-wb-bar ll-parch' }, chipsEl, h('div', { class: 'll-wb-row' }, candle, input, micBtn, sendBtn, logBtn));
  const el = h('div', { class: 'll-part-wordbar' }, above, bar);

  // how much stands on the bar (answer, log, note), published for the phone layout of the build book
  const narrow = (): boolean => window.matchMedia?.('(max-width: 699px)').matches ?? false;
  let aboveH = -1;
  function publishAbove(): void {
    const shown = !cardEl.hidden || !logEl.hidden || !noteEl.hidden;
    const hpx = shown && visible ? Math.round(above.offsetHeight) : 0;
    if (hpx === aboveH) return;
    aboveH = hpx;
    try { ctx.root.style.setProperty('--ll-word-above', hpx + 'px'); } catch { /* no root to tell */ }
  }
  const aboveRo = typeof ResizeObserver === 'function' ? new ResizeObserver(() => publishAbove()) : null;
  aboveRo?.observe(above);
  /** on a phone the answer and the log want the room the pattern book is standing in */
  function clearTheFloor(): void {
    if (narrow()) window.dispatchEvent(new CustomEvent('ll:buildmenu', { detail: 'close' }));
  }

  // ── who is being addressed
  function nameOf(st: GameState, t: SpeakTarget): string {
    if ('to' in t) return t.to === 'court' ? 'the court' : (Object.values(st.staff).find(m => m.role === t.to)?.first ?? `the ${ROLE_TITLES[t.to]}`);
    if ('tenantId' in t) return st.tenants[t.tenantId]?.first ?? 'them';
    return st.buildings[t.buildingId]?.name ?? 'that place';
  }
  function placeholder(st: GameState): string {
    const t = addressee;
    if ('to' in t) return t.to === 'court' ? `Speak, ${RANKS[st.realm.rank].title}…` : `Speak to ${nameOf(st, t)}…`;
    if ('tenantId' in t) return `Speak to ${nameOf(st, t)}…`;
    return `Speak of ${nameOf(st, t)}…`;
  }
  function validate(st: GameState): void {
    const t = addressee;
    const gone = 'to' in t ? (t.to !== 'court' && !Object.values(st.staff).some(m => m.role === t.to))
      : 'tenantId' in t ? st.tenants[t.tenantId]?.status !== 'housed'
      : !st.buildings[t.buildingId];
    if (gone) addressee = { to: 'court' };
  }
  function setAddressee(t: SpeakTarget): void { addressee = t; chipSig = ''; renderChips(ctx.state()); }
  function renderChips(st: GameState): void {
    validate(st);
    const staff = STAFF_ROLES.map(r => Object.values(st.staff).find(m => m.role === r)).filter((m): m is NonNullable<typeof m> => !!m);
    const extra: SpeakTarget[] = [];
    if (sel?.tenantId && st.tenants[sel.tenantId]?.status === 'housed') extra.push({ tenantId: sel.tenantId });
    else if (sel?.buildingId && st.buildings[sel.buildingId]) extra.push({ buildingId: sel.buildingId });
    if (!('to' in addressee) && !extra.some(x => sameTarget(x, addressee))) extra.push(addressee);
    const sigNow = JSON.stringify([st.realm.rank, staff.map(m => m.id + m.first), extra.map(x => nameOf(st, x)), addressee]);
    if (sigNow === chipSig) return;
    chipSig = sigNow;
    clear(chipsEl);
    const chip = (t: SpeakTarget, icon: IconId, label: string, tip: string): HTMLElement => {
      const on = sameTarget(t, addressee);
      return h('button', {
        class: 'll-wb-chip' + (on ? ' is-on' : ''), type: 'button', role: 'radio', 'aria-checked': String(on), 'data-tip': tip,
        onclick: () => { setAddressee(t); input.focus(); },
      }, ico(icon), h('span', null, label));
    };
    chipsEl.append(chip({ to: 'court' }, 'throne', 'To the court', 'Say it to the room. Whoever it concerns will answer.'));
    for (const m of staff) chipsEl.append(chip({ to: m.role }, ROLE_ICON[m.role], m.first, `${m.name}, your ${ROLE_TITLES[m.role]}`));
    for (const x of extra) {
      if ('tenantId' in x) chipsEl.append(chip(x, 'people', nameOf(st, x), `${st.tenants[x.tenantId]?.name ?? 'This household'}, in person`));
      else if ('buildingId' in x) chipsEl.append(chip(x, 'house', nameOf(st, x), 'Speak of this building: “mend it”, “raise the rent here”.'));
    }
    input.placeholder = placeholder(st);
  }

  // ── notes: one quiet line above the bar
  function note(text: string, ms = 6500): void {
    setText(noteEl, text); noteEl.hidden = false;
    window.clearTimeout(noteTimer);
    noteTimer = window.setTimeout(() => { noteEl.hidden = true; publishAbove(); }, ms);
    publishAbove();
  }
  const OFFLINE_TIP = 'No one at court can hear free speech. Plain commands and whispers still work.';
  function candleNote(): void {
    if (!ready) note('The court is still settling into its seats.', 3500);
    else if (online) note('The court is listening. Speak as you would to people.', 4000);
    else note(OFFLINE_TIP);
  }
  function renderCandle(): void {
    let tr: string = 'none';
    try { tr = ctx.word.transport(); } catch { /* the word layer is not there yet */ }
    const lit = ready && tr !== 'none';
    if (lit === online && candle.dataset.set === '1') return;
    online = lit; candle.dataset.set = '1';
    setClass(candle, 'is-lit', lit);
    candle.setAttribute('aria-label', lit ? 'The court is listening' : 'The court cannot hear free speech');
    candle.setAttribute('data-tip', lit ? 'The court is listening. Speak as you would to people.' : OFFLINE_TIP);
  }

  // ── the crawl: the world slows while the ruler is speaking
  function syncCrawl(): void {
    const typing = document.activeElement === input && input.value.trim() !== '' && performance.now() - lastKeyAt < 12000;
    const want = visible && (listening || awaiting || typing);
    if (want && !releaseCrawl) { try { releaseCrawl = ctx.holdCrawl(); } catch { releaseCrawl = null; } }
    else if (!want && releaseCrawl) { const r = releaseCrawl; releaseCrawl = null; try { r(); } catch { /* already released */ } }
  }

  // ── the exchange card
  function stopCardLife(): void {
    if (!card) return;
    try { card.voice?.stop(); } catch { /* nothing playing */ }
    card.voice = null;
    try { card.face?.setTalking(false); } catch { /* portrait gone */ }
  }
  function dismissCard(): void {
    if (!card) return;
    stopCardLife();
    try { card.face?.dispose(); } catch { /* portrait gone */ }
    card = null; hoverCard = false;
    clear(cardEl); cardEl.hidden = true;
    publishAbove();
  }
  function saidLine(st: GameState, c: Card): HTMLElement {
    const to = 'to' in c.target && c.target.to === 'court' ? 'To the court' : 'buildingId' in c.target ? `Of ${nameOf(st, c.target)}` : `To ${nameOf(st, c.target)}`;
    return h('p', { class: 'll-wb-said' }, h('span', { class: 'll-wb-saidto' }, to + ': '), `“${c.text}”`);
  }
  function openCard(text: string, target: SpeakTarget): void {
    dismissCard();
    const st = ctx.state();
    card = { text, target, ex: null, status: 'waiting', typed: 0, finished: false, face: null, voice: null, until: 0, answered: false };
    const who = 'to' in target && target.to === 'court' ? 'The court confers' : 'buildingId' in target ? 'The court confers' : `${nameOf(st, target)} considers this`;
    clear(cardEl);
    cardEl.dataset.status = 'waiting';
    cardEl.append(saidLine(st, card),
      h('div', { class: 'll-wb-reply' }, h('span', { class: 'll-wb-face is-empty' }),
        h('div', { class: 'll-wb-words' }, h('div', { class: 'll-wb-who' }, who), h('div', { class: 'll-wb-dots', 'aria-label': 'Thinking' }, h('i'), h('i'), h('i')))));
    cardEl.hidden = false;
    clearTheFloor(); publishAbove();
  }
  function speakerSpec(st: GameState, sp: Speaker): PortraitSpec {
    const spec: PortraitSpec = { species: sp.species, seed: sp.portraitSeed, size: 52, frame: true };
    if (sp.role) spec.role = sp.role;
    if (sp.npc) { spec.npc = sp.npc; spec.look = NPC_DEFS[sp.npc]?.look; }
    // the same face they wear in the audience chamber and the ledger
    const hh = sp.tenantId ? st.tenants[sp.tenantId] : sp.applicantId ? st.applicants[sp.applicantId]?.household : undefined;
    if (hh) {
      spec.trade = hh.trade;
      const ch = hh.character ? CHARACTERS.find(c => c.id === hh.character) : undefined;
      if (ch) spec.look = ch.look;
    }
    return spec;
  }
  function speakerLine(sp: Speaker): string {
    return sp.kind === 'staff' && sp.role ? `your ${ROLE_TITLES[sp.role]}` : sp.kind === 'tenant' ? 'your tenant' : sp.kind === 'applicant' ? 'seeking a roof' : sp.kind === 'herald' ? 'clerk of the court' : '';
  }
  function fillCard(ex: Exchange): void {
    if (!card) return;
    const st = ctx.state();
    card.ex = ex; card.status = ex.status; card.typed = 0; card.finished = false;
    try { card.face = createPortrait(speakerSpec(st, ex.speaker)); card.face.setMood(ex.speaker.mood); card.face.setTalking(true); } catch { card.face = null; }
    try { card.voice = ctx.audio.voice(ex.speaker.portraitSeed, ex.reply); } catch { card.voice = null; }
    clear(cardEl);
    cardEl.dataset.status = ex.status;
    const role = speakerLine(ex.speaker);
    cardEl.append(
      h('button', { class: 'll-wb-x', type: 'button', 'aria-label': 'Put it away', onclick: () => { if (card?.status === 'needs_confirm' && !card.answered) nay(); else dismissCard(); } }, '✕'),
      saidLine(st, card),
      h('div', { class: 'll-wb-reply' },
        h('span', { class: 'll-wb-face' }, card.face?.el ?? null),
        h('div', { class: 'll-wb-words' },
          h('div', { class: 'll-wb-who' }, ex.speaker.name, role ? h('span', { class: 'll-wb-role' }, ', ' + role) : null),
          h('p', { class: 'll-wb-text' }))),
      h('div', { class: 'll-wb-acts' }));
    cardEl.hidden = false;
    if (calm) card.typed = ex.reply.length;
  }
  function lostCard(text: string): void {
    if (!card) return;
    card.status = 'lost'; card.finished = true; card.until = performance.now() + 9000;
    clear(cardEl);
    cardEl.dataset.status = 'error';
    cardEl.append(
      h('button', { class: 'll-wb-x', type: 'button', 'aria-label': 'Put it away', onclick: () => dismissCard() }, '✕'),
      saidLine(ctx.state(), card),
      h('p', { class: 'll-wb-verdict is-bad' }, 'The words were lost somewhere between the throne and the door. Say it again.'));
    restore(text);
  }
  function restore(text: string): void {
    if (input.value.trim() === '') { input.value = text; input.focus(); input.select(); lastKeyAt = performance.now(); }
  }
  function verdict(text: string, cls = ''): HTMLElement { return h('p', { class: 'll-wb-verdict ' + cls }, text); }
  function finishCard(): void {
    if (!card?.ex) return;
    const c = card, ex = c.ex!;
    c.finished = true;
    stopCardLife();
    const acts = cardEl.querySelector('.ll-wb-acts') as HTMLElement | null;
    if (!acts) return;
    clear(acts);
    const status = ex.status;
    c.status = status;
    cardEl.dataset.status = status;
    if (status === 'needs_confirm' && !c.answered) {
      c.until = 0;
      acts.append(
        h('button', { class: 'll-btn ll-btn-primary ll-wb-aye', type: 'button', onclick: () => aye() }, 'Aye'),
        h('button', { class: 'll-btn ll-wb-nay', type: 'button', onclick: () => nay() }, 'Nay, I meant…'),
        h('span', { class: 'll-wb-hint' }, 'It waits on your word.'));
      return;
    }
    if (status === 'done' || status === 'needs_confirm') {
      const lines: string[] = [];
      for (const o of ex.oaths) lines.push(`Entered in the Ledger of Oaths: “${o.text}”`);
      if (ex.orders.length) lines.push(ex.orders.length === 1 ? 'Entered among your standing orders.' : 'Entered among your standing orders, all of them.');
      if (!lines.length && (ex.applied.some(a => a.result.ok) || c.answered)) lines.push('So ordered.');
      for (const l of lines) acts.append(verdict(l, 'is-good'));
      c.until = performance.now() + (lines.length > 1 ? 13000 : 10000);
    } else if (status === 'refused') {
      acts.append(verdict('Refused.', 'is-bad'));
      c.until = performance.now() + 14000;
    } else if (status === 'unclear') {
      acts.append(verdict(ex.via === 'offline' && !online
        ? 'Not understood. Plain commands carry best just now: “Collect the rents.”'
        : 'Not understood. Say it another way, and say who it is for.'));
      c.until = performance.now() + 14000;
      restore(c.text);
    } else {
      acts.append(verdict('The court did not catch that. Say it again.', 'is-bad'));
      c.until = performance.now() + 12000;
      restore(c.text);
    }
  }
  function aye(): void {
    const c = card;
    if (!c?.ex || c.answered) return;
    c.answered = true;
    try { c.ex.confirm(); } catch (err) { console.error('[wordbar] confirm', err); }
    sfx('stamp');
    cardEl.classList.remove('is-stamped'); void cardEl.offsetWidth; cardEl.classList.add('is-stamped');
    finishCard();
  }
  function nay(): void {
    const c = card;
    if (!c?.ex || c.answered) return;
    c.answered = true;
    try { c.ex.cancel(); } catch (err) { console.error('[wordbar] cancel', err); }
    const text = c.text;
    dismissCard();
    input.value = text; input.focus();
    input.setSelectionRange(text.length, text.length);
    lastKeyAt = performance.now();
  }

  // ── sending
  function send(): void {
    const text = input.value.trim().replace(/\s+/g, ' ');
    if (!text || awaiting) return;
    // "aye" and "nay" answer the question on the table
    if (card?.status === 'needs_confirm' && card.finished && !card.answered) {
      if (AYE.test(text)) { input.value = ''; aye(); return; }
      if (NAY.test(text)) { input.value = ''; nay(); return; }
      try { card.ex?.cancel(); } catch { /* it was already dropped */ }
    }
    const target = addressee;
    if (hist[hist.length - 1] !== text) { hist.push(text); if (hist.length > 40) hist.shift(); }
    histIdx = -1; draft = '';
    input.value = '';
    toggleLog(false);
    openCard(text, target);
    awaiting = true; sentAt = performance.now();
    sfx('quill');
    if (ready && !online && !offlineNoted) { offlineNoted = true; note(OFFLINE_TIP, 8000); }
    const token = ++seq;
    let p: Promise<Exchange>;
    try { p = ctx.word.speak(text, target); } catch (err) { p = Promise.reject(err); }
    p.then(ex => { if (token !== seq) return; awaiting = false; if (card) fillCard(ex); syncCrawl(); },
      err => { if (token !== seq) return; console.error('[wordbar] speak', err); awaiting = false; lostCard(text); syncCrawl(); });
    syncCrawl();
  }
  function cancelAuto(): void { if (autoTimer) { window.clearTimeout(autoTimer); autoTimer = 0; sendBtn.classList.remove('is-arming'); } }
  function armAuto(): void {
    cancelAuto();
    if (calm) { send(); return; }
    sendBtn.classList.add('is-arming');
    autoTimer = window.setTimeout(() => { autoTimer = 0; sendBtn.classList.remove('is-arming'); send(); }, 1200);
  }

  // ── the microphone: hold to talk
  function micGone(text: string): void {
    micDead = true; micBtn.hidden = true;
    if (!micNoted) { micNoted = true; note(text, 9000); }
  }
  function endListenUi(): void {
    listening = false; spaceTalk = false; keyTalk = false;
    setClass(micBtn, 'is-on', false); setClass(bar, 'is-listening', false);
    syncCrawl();
  }
  function startListen(): void {
    const m = mic();
    if (listening || awaiting || !m || !micOk()) return;
    cancelAuto();
    listening = true;
    const mine = ++finalising;
    setClass(micBtn, 'is-on', true); setClass(bar, 'is-listening', true);
    input.value = '';
    syncCrawl();
    try {
      m.start({
        onPartial: text => { if (mine !== finalising) return; input.value = text; lastKeyAt = performance.now(); },
        onFinal: text => {
          if (mine !== finalising) return;
          finalising++;
          endListenUi();
          const said = text.trim();
          if (!said) { note('Nothing was heard. Hold the seal and speak up.', 4000); return; }
          input.value = said; lastKeyAt = performance.now();
          armAuto();
        },
        onError: code => {
          if (mine !== finalising) return;
          finalising++;
          endListenUi();
          if (code === 'denied') micGone('The court may not listen here. The dictation key on your keyboard works in the box.');
          else if (code === 'unsupported') micGone('This court has no ear for speech. The dictation key on your keyboard works in the box.');
          else if (code === 'no_speech') note('Nothing was heard. Hold the seal and speak up.', 4000);
          else note('The ear failed for a moment. Type it instead, or try again.', 5000);
        },
      });
    } catch (err) {
      console.error('[wordbar] mic', err);
      finalising++; endListenUi();
    }
  }
  function stopListen(): void {
    if (!listening) return;
    const mine = finalising;
    try { mic()?.stop(); } catch { /* it had already stopped */ }
    setClass(micBtn, 'is-on', false);
    // if the final words never arrive, settle with what we have
    window.setTimeout(() => {
      if (mine !== finalising) return;
      finalising++;
      endListenUi();
      if (input.value.trim()) armAuto();
    }, 1600);
  }
  micBtn.addEventListener('pointerdown', e => { e.preventDefault(); try { micBtn.setPointerCapture(e.pointerId); } catch { /* fine */ } startListen(); });
  micBtn.addEventListener('pointerup', () => stopListen());
  micBtn.addEventListener('pointercancel', () => stopListen());
  micBtn.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); startListen(); } });
  micBtn.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') stopListen(); });
  micBtn.addEventListener('contextmenu', e => e.preventDefault());

  // ── the box
  input.addEventListener('keydown', e => {
    e.stopPropagation();
    lastKeyAt = performance.now();
    if (e.key !== 'Enter') cancelAuto();
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); cancelAuto(); send(); }
    else if (e.key === 'ArrowUp') {
      if (!hist.length) { try { for (const x of ctx.word.log()) if (hist[hist.length - 1] !== x.text) hist.push(x.text); } catch { /* no log yet */ } }
      if (!hist.length) return;
      e.preventDefault();
      if (histIdx === -1) { draft = input.value; histIdx = hist.length - 1; } else histIdx = Math.max(0, histIdx - 1);
      input.value = hist[histIdx]!;
      input.setSelectionRange(input.value.length, input.value.length);
    } else if (e.key === 'ArrowDown' && histIdx !== -1) {
      e.preventDefault();
      histIdx++;
      if (histIdx >= hist.length) { histIdx = -1; input.value = draft; } else input.value = hist[histIdx]!;
    } else if (e.key === 'Escape') { input.blur(); }
    else if (e.code === 'Backquote' && input.value === '' && micOk()) { e.preventDefault(); if (!e.repeat) { keyTalk = true; startListen(); } }
    syncCrawl();
  });
  input.addEventListener('keyup', e => { e.stopPropagation(); if (e.code === 'Backquote' && keyTalk) stopListen(); });
  input.addEventListener('input', () => { lastKeyAt = performance.now(); cancelAuto(); syncCrawl(); });
  input.addEventListener('pointerdown', () => cancelAuto());
  input.addEventListener('focus', () => {
    setClass(bar, 'is-focus', true);
    if (!micNoted && !micOk()) { micNoted = true; if (!micDead) micBtn.hidden = true; note('To speak aloud, use the dictation key on your keyboard. It works in this box.', 7000); }
    syncCrawl();
  });
  input.addEventListener('blur', () => { setClass(bar, 'is-focus', false); syncCrawl(); });

  // ── keys from anywhere (never while another field has focus)
  const shellPause = (ctx as unknown as { shell?: { togglePause?: () => void } }).shell?.togglePause;
  let speedAtDown: Speed | null = null;
  const onKeyDown = (e: KeyboardEvent): void => {
    if (!visible || e.ctrlKey || e.metaKey || e.altKey || e.target === input) return;
    if (e.code === 'Backquote') {
      if (isTyping() || !micOk()) return;
      e.preventDefault();
      if (!e.repeat) { keyTalk = true; startListen(); }
      return;
    }
    if (e.code === 'Space' && focusIdle() && input.value === '' && micOk()) {
      // a tap of Space is the frame's pause. Held, it is the talk key.
      if (shellPause) e.preventDefault();            // we will pause for the frame on a tap
      if (e.repeat) { if (spaceTalk) { e.preventDefault(); e.stopImmediatePropagation(); } return; }
      speedAtDown = ctx.state().speed;
      window.clearTimeout(spaceTimer);
      spaceDown = true;
      spaceTimer = window.setTimeout(() => {
        spaceTimer = 0;
        // a frame we do not know may have paused on the way down: put the clock back before crawling
        if (!shellPause && speedAtDown !== null && ctx.state().speed !== speedAtDown) { try { ctx.sim.setSpeed(speedAtDown); } catch { /* leave it */ } }
        spaceTalk = true;
        startListen();
        if (!listening) spaceTalk = false;
      }, 260);
    }
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'Backquote' && keyTalk && e.target !== input) { stopListen(); return; }
    if (e.code !== 'Space' || !spaceDown) return;
    spaceDown = false;
    if (spaceTimer) {
      // it was a tap
      window.clearTimeout(spaceTimer); spaceTimer = 0;
      if (shellPause) { try { shellPause(); ctx.audio.sfx('click', { volume: 0.5 }); } catch { /* the frame will cope */ } }
      return;
    }
    if (spaceTalk) { e.preventDefault(); e.stopImmediatePropagation(); stopListen(); }
  };
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  const onBlurWin = (): void => { spaceDown = false; if (spaceTimer) { window.clearTimeout(spaceTimer); spaceTimer = 0; } if (listening) stopListen(); };
  window.addEventListener('blur', onBlurWin);
  // the frame's Enter / T: "ll:summon" with detail 'word'
  const onSummon = (e: Event): void => {
    if ((e as CustomEvent).detail !== 'word' || !visible) return;
    e.preventDefault();
    input.focus();
  };
  ctx.root.addEventListener('ll:summon', onSummon);

  // ── the log
  function statusTag(ex: Exchange): HTMLElement | null {
    const t = ex.status === 'needs_confirm' ? ['awaits your aye', 'gold'] : ex.status === 'refused' ? ['refused', 'bad'] : ex.status === 'unclear' ? ['not understood', 'plain'] : ex.status === 'error' ? ['not heard', 'plain'] : null;
    return t ? h('span', { class: `ll-tag ll-tag-${t[1]}` }, t[0]) : null;
  }
  function renderLog(): void {
    clear(logList);
    let log: Exchange[] = [];
    try { log = ctx.word.log(); } catch { /* no log yet */ }
    if (!log.length) { logList.append(h('p', { class: 'll-note' }, 'Nothing has been said yet. You might begin with: “Collect the rents.”')); return; }
    const st = ctx.state();
    for (const ex of log.slice(-14)) {
      const to = 'to' in ex.target && ex.target.to === 'court' ? 'the court' : nameOf(st, ex.target);
      logList.append(h('article', { class: 'll-wb-logrow is-' + ex.status },
        h('div', { class: 'll-wb-logmeta' }, fmtDate(ex.day), ', to ', to),
        h('button', { class: 'll-wb-logsaid', type: 'button', 'data-tip': 'Put it back in the box', onclick: () => { toggleLog(false); voiceApi.fill(ex.text); } }, `“${ex.text}”`),
        h('p', { class: 'll-wb-logreply' }, h('b', null, (ex.speaker.first || ex.speaker.name) + ': '), ex.reply, ' ', statusTag(ex))));
    }
    logList.scrollTop = logList.scrollHeight;
  }
  function toggleLog(on?: boolean): void {
    const next = on ?? !logOpen;
    if (next === logOpen) return;
    logOpen = next; logEl.hidden = !next;
    setClass(logBtn, 'is-on', next);
    if (next) { sfx('page'); renderLog(); logList.scrollTop = logList.scrollHeight; clearTheFloor(); }
    publishAbove();
  }

  // ── hooks
  const voiceApi: Voice = {
    address(target, text) {
      setAddressee(target);
      if (text !== undefined) input.value = text;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      lastKeyAt = performance.now();
    },
    fill(text) {
      cancelAuto();
      input.value = text; input.focus();
      input.setSelectionRange(text.length, text.length);
      lastKeyAt = performance.now(); syncCrawl();
    },
  };
  active = voiceApi;
  const onBus = (e: Event): void => {
    const d = ((e as CustomEvent).detail ?? {}) as { target?: SpeakTarget; text?: string };
    if (d.target) voiceApi.address(d.target, d.text); else if (typeof d.text === 'string') voiceApi.fill(d.text); else input.focus();
  };
  window.addEventListener('ll:speak', onBus);

  let unsub: (() => void) | null = null;
  try {
    unsub = ctx.word.onChange(() => {
      if (logOpen) renderLog();
      if (card?.ex && card.finished && card.ex.status !== card.status) finishCard();
    });
  } catch { /* the word layer is not there yet */ }
  try { void ctx.word.ready.then(() => { ready = true; renderCandle(); }, () => { ready = true; renderCandle(); }); } catch { ready = true; }

  cardEl.addEventListener('pointerenter', () => { hoverCard = true; });
  cardEl.addEventListener('pointerleave', () => { hoverCard = false; });
  cardEl.addEventListener('click', e => {
    // a click on the words hurries the read-back along
    if (card?.ex && !card.finished && !(e.target as HTMLElement).closest('button')) card.typed = card.ex.reply.length;
  });

  if (!micOk()) micBtn.hidden = true;
  renderChips(ctx.state());
  renderCandle();

  return {
    el,
    update(st: GameState, dt: number): void {
      if (!visible) return;
      renderChips(st);
      if (input.placeholder !== placeholder(st)) input.placeholder = placeholder(st);
      candleAcc += dt;
      if (candleAcc > 0.5) { candleAcc = 0; renderCandle(); if (!micDead && micBtn.hidden && micOk()) micBtn.hidden = false; }
      if (awaiting && performance.now() - sentAt > 30000) { seq++; awaiting = false; if (card) lostCard(card.text); }
      const c = card;
      if (c?.ex && !c.finished) {
        const full = c.ex.reply.length;
        c.typed = Math.min(full, c.typed + Math.max(dt, 0.016) * 46);
        const textEl = cardEl.querySelector('.ll-wb-text');
        if (textEl) setText(textEl, c.ex.reply.slice(0, Math.floor(c.typed)));
        if (c.typed >= full) finishCard();
      } else if (c && c.finished && c.until && !hoverCard && performance.now() > c.until) dismissCard();
      syncCrawl();
    },
    onSelect(next: { buildingId?: Id; tenantId?: Id; staffId?: Id; applicantId?: Id } | null): void {
      const was = sel;
      sel = next && (next.tenantId || next.buildingId) ? { tenantId: next.tenantId, buildingId: next.tenantId ? undefined : next.buildingId } : null;
      // if we were addressing what was selected and it no longer is, fall back to the room
      if (was && !('to' in addressee) && document.activeElement !== input && input.value === '') {
        const still = sel && ((sel.tenantId && 'tenantId' in addressee && addressee.tenantId === sel.tenantId) || (sel.buildingId && 'buildingId' in addressee && addressee.buildingId === sel.buildingId));
        if (!still) addressee = { to: 'court' };
      }
      chipSig = '';
      renderChips(ctx.state());
    },
    setVisible(on: boolean): void {
      visible = on; el.hidden = !on;
      if (!on) { cancelAuto(); if (listening) stopListen(); toggleLog(false); if (document.activeElement === input) input.blur(); }
      publishAbove();
      syncCrawl();
    },
    escape(): boolean {
      if (logOpen) { toggleLog(false); return true; }
      if (card && card.finished && !(card.status === 'needs_confirm' && !card.answered)) { dismissCard(); return true; }
      return false;
    },
    reset(): void {
      seq++; awaiting = false; cancelAuto();
      if (listening) stopListen();
      dismissCard(); toggleLog(false);
      hist.length = 0; histIdx = -1; draft = ''; input.value = '';
      addressee = { to: 'court' }; sel = null; chipSig = '';
      renderChips(ctx.state()); syncCrawl();
    },
    focus(): void { input.focus(); },
    speakTo(target: SpeakTarget, text?: string): void { voiceApi.address(target, text); },
    dispose(): void {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', onBlurWin);
      window.removeEventListener('ll:speak', onBus);
      ctx.root.removeEventListener('ll:summon', onSummon);
      window.clearTimeout(autoTimer); window.clearTimeout(noteTimer); window.clearTimeout(spaceTimer);
      try { unsub?.(); } catch { /* fine */ }
      aboveRo?.disconnect();
      dismissCard();
      try { ctx.root.style.removeProperty('--ll-word-above'); } catch { /* fine */ }
      if (releaseCrawl) { try { releaseCrawl(); } catch { /* fine */ } releaseCrawl = null; }
      if (active === voiceApi) active = null;
    },
  };
}
