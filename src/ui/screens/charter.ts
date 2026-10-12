/**
 * The charter: the Crown's terms for the current rank as an illuminated
 * document (duty, goals with their progress, what the next rank brings, the
 * rival next door), and, when every goal is met, the ceremony: the Crown's
 * herald reads the proclamation, the ruler kneels, and rises with a new title.
 *
 * open()              the ceremony when the charter is ready, else the document
 * open('document')    always the document
 */
import type { Screen, UICtx } from '../api';
import { RANK_ORDER, type GameState, type GoalMetric, type RankId, type SimEvent } from '../../sim/types';
import type { RankDef } from '../../data/schema';
import type { IconId } from '../../data/ids';
import { h, clear, addStyle, setText, button, meter, num } from '../kit';
import { crest, doodle, dropCap, flourish, MARGINALIA_CSS } from '../marginalia';
import { createPortrait, type Portrait } from '../portraits';
import { RANKS, BUILDINGS, SPECIES_DEFS, NPC_DEFS, ROLE_TITLES, BAL } from '../../data';
import { baseVars, fmtDate } from '../../sim/core';
import { fillText as fill } from '../../sim/effects';
import { SCREENS_B_CSS } from '../css/screens-b';
import { TYPING, art, icon, numberWord, reducedMotion, styledRuler, typeOut, waxSeal, hashStr, type Typer } from './audience';

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const capFirst = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

function listJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
}

const GOAL_UNIT: Record<GoalMetric, string> = {
  rentRoll: 'crowns a month', households: 'households', renown: '', favor: '', gold: 'crowns', happinessAvg: '',
  staff: 'delegates', oathsKept: 'oaths kept', buildings: 'built', monthsNoVacancy: 'months', conditionAvg: '',
};

/** What rising from `cur` to `next` brings, in the order a ruler cares about. */
function bringsOf(cur: RankDef, next: RankDef): { icon: IconId; k: string; v: string }[] {
  const out: { icon: IconId; k: string; v: string }[] = [];
  const builds = next.buildings.filter(b => b !== 'seat').map(b => (BUILDINGS[b]?.name ?? b.replace(/_/g, ' ')).toLowerCase());
  if (builds.length) out.push({ icon: 'house', k: 'To build', v: capFirst(listJoin(builds)) + '.' });
  const peoples = next.species.map(s => (SPECIES_DEFS[s]?.plural ?? s).toLowerCase());
  if (peoples.length) out.push({ icon: 'people', k: 'New peoples', v: `${capFirst(listJoin(peoples))} will come asking after rooms.` });
  const roles = next.staff.map(r => 'a ' + ROLE_TITLES[r]);
  if (roles.length) out.push({ icon: 'handshake', k: 'Delegates', v: `You may hire ${listJoin(roles)}.` });
  if (next.maxParcels > cur.maxParcels) out.push({ icon: 'map', k: 'Land', v: `Up to ${numberWord(next.maxParcels)} parcels. The charter allows ${numberWord(cur.maxParcels)} now.` });
  const seatName = BUILDINGS.seat?.levelNames?.[next.seatLevel - 1];
  if (next.seatLevel > cur.seatLevel && seatName) out.push({ icon: 'castle', k: 'Your seat', v: `Becomes the ${seatName.replace(/^the /i, '')}.` });
  if (next.tribute !== cur.tribute) out.push({ icon: 'crown', k: 'The tribute', v: next.tribute > cur.tribute ? `${num(next.tribute)} crowns a quarter, up from ${num(cur.tribute)}. The Crown calls this an honour.` : `${num(next.tribute)} crowns a quarter.` });
  out.push({ icon: 'scroll', k: 'The work', v: next.duty });
  return out;
}

/** The day the next quarterly tribute falls due (the 1st of a tribute month, after today). */
function nextTributeDay(day: number): number {
  const months: readonly number[] = BAL.tributeMonths?.length ? BAL.tributeMonths : [0, 3, 6, 9];
  let mi = Math.floor(Math.max(0, day) / 30) + 1;
  for (let i = 0; i < 12 && !months.includes(mi % 12); i++) mi++;
  return mi * 30;
}

function nextRankOf(rank: RankId): RankId | null {
  const i = RANK_ORDER.indexOf(rank);
  return i >= 0 && i < RANK_ORDER.length - 1 ? RANK_ORDER[i + 1]! : null;
}

export function create(ctx: UICtx): Screen {
  if (MARGINALIA_CSS) addStyle('marginalia', MARGINALIA_CSS);
  addStyle('screens-b', SCREENS_B_CSS);

  const doc = h('div', { class: 'll-chr-doc ll-parch ll-illum' });
  const cer = h('div', { class: 'll-chr-cer', hidden: true });
  const el = h('div', { class: 'll-chr', hidden: true, role: 'dialog', 'aria-label': 'The charter' }, doc, cer);

  let isOpen = false;
  let mode: 'doc' | 'ceremony' | 'risen' = 'doc';
  let tick = 0, dirty = true;
  let docRank: RankId | null = null;
  let goalSig = '', rivalSig = '', nowSig = '';
  let portraits: Portrait[] = [];
  let typer: Typer | null = null;
  let voice: { stop(): void } | null = null;
  let herald: Portrait | null = null;
  let token = 0;

  // pieces of the document that update in place
  let goalsEl: HTMLElement | null = null, tallyEl: HTMLElement | null = null, readyEl: HTMLElement | null = null;
  let youNum: HTMLElement | null = null, himNum: HTMLElement | null = null, knot: HTMLElement | null = null, tugCap: HTMLElement | null = null;
  let nowEl: HTMLElement | null = null;

  const sfx = (id: Parameters<UICtx['audio']['sfx']>[0], volume?: number) => { try { ctx.audio.sfx(id, volume === undefined ? undefined : { volume }); } catch { /* silence is fine */ } };
  const narrow = () => el.clientWidth <= 760;
  const requestClose = () => ctx.close('charter');

  function dropPortraits(): void {
    for (const p of portraits) p.dispose();
    portraits = []; herald = null;
  }
  function stopReading(): void {
    typer?.stop(); typer = null;
    voice?.stop(); voice = null;
    herald?.setTalking(false);
  }

  // ───────────── the document ─────────────
  function buildDoc(state: GameState): void {
    dropPortraits();
    clear(doc);
    const rank = state.realm.rank;
    docRank = rank; goalSig = ''; rivalSig = ''; nowSig = '';
    const cur = RANKS[rank];
    const nextId = nextRankOf(rank);
    const next = nextId ? RANKS[nextId] : null;
    const title = cur.title;

    const duty = h('p', { class: 'll-chr-duty' }, h('b', null, 'Your duty'), cur.duty);
    const head = h('header', { class: 'll-chr-head' },
      art(crest(state.realm.crest, 64), 'll-chr-crest'),
      h('div', { class: 'll-chr-headings' },
        h('p', { class: 'll-chr-kicker' }, 'The Crown\'s Charter'),
        h('h1', { class: 'll-chr-title', 'aria-label': `${title} of ${state.realm.name}` },
          art(dropCap(title.charAt(0), 66)),
          h('span', { class: 'll-chr-title-rest' }, title.slice(1)),
          h('span', { class: 'll-chr-title-of' }, `of ${state.realm.name}`)),
        h('p', { class: 'll-chr-sub' }, `Granted to ${state.realm.ruler} on the ${fmtDate(state.charter.sinceDay)}, and held since at the Crown's pleasure.`)),
      duty,
    );

    // goals
    goalsEl = h('ul', { class: 'll-chr-goals' });
    tallyEl = h('p', { class: 'll-chr-tally' });
    readyEl = h('div', { class: 'll-chr-ready', hidden: true },
      h('p', null, 'Every term is met. The Crown\'s herald is at your door, and has been practising.'),
      button('Receive the herald', () => startCeremony(), { kind: 'primary' }));
    const goalsCol = h('section', { class: 'll-chr-col' },
      next
        ? h('h2', { class: 'll-chr-h' }, `To be raised to ${next.title}`, h('small', null, 'the Crown requires all of it at once'))
        : h('h2', { class: 'll-chr-h' }, 'No higher charter'),
      next ? goalsEl : h('p', { class: 'll-chr-tally' }, 'There is no one left to raise you. Tend what you have.'),
      next ? tallyEl : null,
      readyEl);

    // what comes next, and the neighbour
    const side = h('section', { class: 'll-chr-col' });
    if (next) {
      side.append(
        h('h2', { class: 'll-chr-h' }, `What ${next.title} brings`),
        h('ul', { class: 'll-chr-brings' }, bringsOf(cur, next).map(b =>
          h('li', { class: 'll-chr-bring' }, icon(b.icon), h('span', null, h('b', null, b.k), b.v)))));
    }
    const rv = state.rival;
    const mine = createPortrait({ species: 'human', seed: state.realm.crest, role: 'ruler', rank, size: 44, frame: true });
    const his = createPortrait({ species: 'human', seed: rv.portraitSeed, npc: 'rival_lord', look: NPC_DEFS.rival_lord?.look, size: 44, frame: true });
    portraits.push(mine, his);
    youNum = h('b'); himNum = h('b'); knot = h('span', { class: 'll-chr-knot' }); tugCap = h('p', { class: 'll-chr-tug-cap' });
    const rope = h('div', { class: 'll-chr-rope', 'aria-hidden': 'true', html:
      '<svg viewBox="0 0 200 44" preserveAspectRatio="none"><path d="M0 22 Q50 26 100 22 T200 22" fill="none" stroke="#6b4f2c" stroke-width="5" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
      '<path d="M0 22 Q50 26 100 22 T200 22" fill="none" stroke="#d9bf8a" stroke-width="2.4" stroke-dasharray="5 4" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
      '<path d="M100 6V38" stroke="rgba(42,29,20,.45)" stroke-width="1" stroke-dasharray="2 3" vector-effect="non-scaling-stroke"/></svg>' });
    rope.appendChild(knot);
    goalsCol.append(h('div', { class: 'll-chr-rival' },
      h('p', { class: 'll-chr-rival-name' }, h('span', { class: 'll-chr-rival-k' }, 'Next door'), h('b', null, rv.name), ` of ${rv.seat}, who is ${rv.temperament} and would like your tenants.`),
      h('div', { class: 'll-chr-tug' },
        h('div', { class: 'll-chr-tug-end is-you' }, mine.el, h('span', null, 'You ', youNum)),
        rope,
        h('div', { class: 'll-chr-tug-end is-him' }, his.el, h('span', null, 'Him ', himNum))),
      tugCap));

    nowEl = h('ul', { class: 'll-chr-brings' });
    side.append(h('h2', { class: 'll-chr-h' }, 'The present terms'), nowEl);

    side.append(h('footer', { class: 'll-chr-foot' },
      waxSeal('crown', 77 + state.realm.crest, { gold: false }),
      h('p', null, 'Given under the Crown\'s seal, which is also how it would be taken back.'),
      art(doodle('snail_knight', state.realm.crest % 7, 72))));

    doc.append(
      h('button', { class: 'll-seal ll-close ll-chr-close', type: 'button', title: 'Close', 'aria-label': 'Close', onclick: requestClose }, '✕'),
      h('div', { class: 'll-chr-body' }, head, art(flourish(260, state.realm.crest), 'll-chr-flourish'), h('div', { class: 'll-chr-cols' }, goalsCol, side)));
    refreshDoc(state);
  }

  function refreshDoc(state: GameState): void {
    if (docRank !== state.realm.rank) { buildDoc(state); return; }
    const cur = RANKS[state.realm.rank];
    const goals = state.charter.goals;
    const sig = goals.map(g => `${g.id}:${Math.round(g.value)}/${g.target}:${g.done ? 1 : 0}`).join() + (state.charter.ready ? '!' : '');
    if (sig !== goalSig && goalsEl && tallyEl && readyEl) {
      goalSig = sig;
      clear(goalsEl);
      let met = 0;
      for (const g of goals) {
        const gd = cur.goals.find(x => x.id === g.id);
        const unit = gd ? GOAL_UNIT[gd.metric] : '';
        if (g.done) met++;
        const pct = g.target > 0 ? clamp((g.value / g.target) * 100, 0, 100) : 100;
        goalsEl.appendChild(h('li', { class: 'll-chr-goal' + (g.done ? ' is-done' : '') },
          h('div', { class: 'll-chr-goal-text' }, gd?.text ?? capFirst(g.id.replace(/_/g, ' '))),
          meter(g.done ? 100 : pct, { kind: 'gold', title: `${num(g.value)} of ${num(g.target)}` }),
          h('div', { class: 'll-chr-goal-num' }, h('b', null, num(g.value)), ` of ${num(g.target)}${unit ? ' ' + unit : ''}`),
          g.done ? waxSeal('check', hashStr(g.id)) : h('span', { class: 'll-chr-goal-open', 'aria-hidden': 'true' })));
      }
      const all = goals.length > 0 && met === goals.length;
      setText(tallyEl, !goals.length ? '' : all ? 'All met, and sealed.' : `${capFirst(numberWord(met))} of ${numberWord(goals.length)} met. The Crown checks daily, and without warmth.`);
      readyEl.hidden = !(state.charter.ready && nextRankOf(state.realm.rank));
      tallyEl.hidden = !readyEl.hidden;      // the banner says it better
    }
    const due = nextTributeDay(state.day);
    const days = Math.max(1, Math.ceil(due - state.day));
    const favor = Math.round(clamp(state.favor, 0, 100));
    const nsig = `${cur.tribute}|${due}|${days}|${favor}|${state.mode}`;
    if (nsig !== nowSig && nowEl) {
      nowSig = nsig;
      clear(nowEl);
      const soon = days <= 30 ? (days === 1 ? ', which is tomorrow' : `, which is in ${numberWord(days)} days`) : '';
      nowEl.append(
        h('li', { class: 'll-chr-bring' }, icon('crown'), h('span', null, h('b', null, 'Tribute'),
          cur.tribute > 0 ? `${num(cur.tribute)} crowns a quarter. Next due on the ${fmtDate(due)}${soon}.` : 'None. There is no one above you left to pay.')),
        h('li', { class: 'll-chr-bring' }, icon('scales'), h('span', null, h('b', null, 'The Crown\'s favour'),
          meter(favor, { kind: favor >= 50 ? 'gold' : favor >= 25 ? 'warn' : 'bad', title: `${favor} of 100` }),
          h('span', { class: 'll-num' }, `${favor} of 100. `),
          state.mode === 'iron' ? 'It falls when the tribute goes unpaid. At nothing, the charter is revoked.' : 'It falls when the tribute goes unpaid. At nothing, the Crown takes a rank back.')));
    }
    const rv = state.rival;
    const rsig = `${Math.round(state.renown)}|${Math.round(rv.renown)}|${rv.poached}`;
    if (rsig !== rivalSig && youNum && himNum && knot && tugCap) {
      rivalSig = rsig;
      const mine = Math.round(state.renown), his = Math.round(rv.renown), lead = mine - his;
      setText(youNum, String(mine)); setText(himNum, String(his));
      knot.style.left = clamp(50 - lead * 1.4, 8, 92).toFixed(1) + '%';
      clear(tugCap);
      tugCap.append(lead > 0 ? `Your name outweighs his by ${numberWord(lead)}. He keeps his hands off your tenants, mostly.`
        : lead < 0 ? `His name outweighs yours by ${numberWord(-lead)}. He will be measuring your tenants for his cottages.`
        : 'Dead level. The rope is not moving. Neither, for now, are your tenants.');
      if (rv.poached > 0) tugCap.append(h('small', null, `Households lost to him so far: ${numberWord(rv.poached)}.`));
    }
  }

  function showDoc(): void {
    stopReading();
    token++;
    mode = 'doc';
    el.classList.remove('is-ceremony');
    cer.hidden = true; clear(cer);
    doc.hidden = false;
    buildDoc(ctx.state());
  }

  // ───────────── the ceremony ─────────────
  function startCeremony(): void {
    const state = ctx.state();
    const curId = state.realm.rank;
    const nextId = nextRankOf(curId);
    if (!nextId) { showDoc(); return; }
    const cur = RANKS[curId], next = RANKS[nextId];
    stopReading();
    dropPortraits();
    const tok = ++token;
    mode = 'ceremony';
    doc.hidden = true; clear(doc); docRank = null;
    clear(cer); cer.hidden = false;
    el.classList.add('is-ceremony');
    try { ctx.renderer.setMode('ceremony'); } catch { /* no table */ }
    try { ctx.audio.setMood('court'); } catch { /* silence is fine */ }
    sfx('fanfare');

    const npc = NPC_DEFS.crown_herald;
    const size = narrow() ? 88 : Math.round(clamp((el.clientHeight - 150) * 0.42, 160, 260) / 4) * 4;
    herald = createPortrait({ species: npc?.species ?? 'human', seed: 4021, npc: 'crown_herald', look: npc?.look, size, frame: true });
    herald.el.classList.add('ll-aud-face');
    portraits.push(herald);
    herald.setMood('smug');
    const seat = Object.values(state.buildings).find(b => b.type === 'seat');

    const procl = h('p', { class: 'll-chr-procl', title: 'Click to hear the rest at once' });
    const kneelBtn = button('Kneel', () => kneel(), { kind: 'primary', class: 'll-chr-kneel' });
    const actions = h('div', { class: 'll-chr-cer-actions is-wait' }, kneelBtn,
      button('Keep the herald waiting', () => { ctx.toast('The herald will wait. He is paid by the day.', 'info'); requestClose(); }, { kind: 'quiet' }));
    const reading = h('div', { class: 'll-chr-reading' }, h('p', { class: 'll-chr-scroll-kicker' }, 'A Proclamation'), procl, actions);
    const reveal = h('div', { class: 'll-chr-reveal', hidden: true });
    const scrollEl = h('div', { class: 'll-chr-scroll ll-parch' }, reading, reveal);
    const stage = h('div', { class: 'll-chr-cer-stage' },
      h('div', { class: 'll-chr-herald' },
        h('div', { class: 'll-aud-portrait' }, herald.el),
        h('div', { class: 'll-aud-plate ll-parch' },
          h('h3', { class: 'll-aud-name' }, npc?.name ?? 'The Crown\'s Herald'),
          h('p', { class: 'll-aud-desc' }, npc?.title && npc.title !== npc.name ? npc.title : 'Speaks for the Crown, at length.'))),
      scrollEl);
    const footNote = h('span', { class: 'll-lbx-note' }, `To kneel is to accept the title of ${next.title}, and the tribute that comes with it.`);
    cer.append(
      h('div', { class: 'll-lbx is-top' }, h('span', { class: 'll-lbx-kicker' }, 'The Crown\'s Herald Is Come'),
        h('span', { class: 'll-lbx-dim' }, `${seat ? 'At the ' + seat.name.replace(/^the /i, '') + ', ' : ''}${fmtDate(state.day)}`)),
      stage,
      h('div', { class: 'll-lbx is-bottom' }, footNote));

    const text = fill(next.proclamation, baseVars(state));
    const ready = () => {
      if (tok !== token) return;
      actions.classList.remove('is-wait');
      procl.removeAttribute('title'); procl.style.cursor = 'default';
      if (!narrow()) kneelBtn.focus();
    };
    const read = () => {
      if (tok !== token || !isOpen) return;
      herald?.setTalking(true);
      try { if (!TYPING.instant) voice = ctx.audio.voice(4021, text, { rate: 0.9 }); } catch { voice = null; }
      const t = typeOut(procl, text, { cps: 30, onEnd: () => { voice?.stop(); voice = null; herald?.setTalking(false); } });
      typer = t;
      procl.onclick = () => t.skip();
      void t.done.then(() => { if (typer === t) typer = null; window.setTimeout(ready, TYPING.instant ? 0 : 350); });
    };
    if (TYPING.instant || reducedMotion()) read(); else window.setTimeout(read, 1100);

    function kneel(): void {
      if (tok !== token || mode !== 'ceremony') return;
      const res = ctx.act({ type: 'accept_promotion' });
      if (!res.ok) { herald?.setMood('worried'); return; }
      mode = 'risen';
      stopReading();
      kneelBtn.disabled = true;
      stage.classList.add('is-kneel');
      sfx('cheer', 0.8);
      try { ctx.audio.setMood('triumph'); } catch { /* silence is fine */ }
      herald?.setMood('delighted');
      const ruler = ctx.state().realm.ruler, realm = ctx.state().realm.name;
      const unlocks = h('ul', { class: 'll-chr-unlocks' }, bringsOf(cur, next).map((b, i) =>
        h('li', { style: `animation-delay:${(0.95 + i * 0.12).toFixed(2)}s` }, icon(b.icon), h('b', null, b.k), h('span', null, b.v))));
      const riseBtn = button('Rise', () => requestClose(), { kind: 'primary' });
      const show = () => {
        if (tok !== token) return;
        reading.hidden = true;
        clear(reveal);
        reveal.append(
          h('div', { class: 'll-chr-rays', 'aria-hidden': 'true' }),
          h('p', { class: 'll-chr-rise' }, 'Rise,'),
          h('h1', { class: 'll-chr-newtitle' }, next.title),
          h('p', { class: 'll-chr-newsub' }, `${styledRuler(nextId!, ruler)} of ${realm}. ${capFirst(next.address)}, from here on.`),
          unlocks, riseBtn);
        reveal.hidden = false;
        stage.classList.add('is-risen');
        setText(footNote, 'It is done. The mapmakers have been told.');
        sfx('stamp', 0.7);
        if (!narrow()) window.setTimeout(() => { if (tok === token && riseBtn.isConnected) riseBtn.focus(); }, 1600);
      };
      if (TYPING.instant || reducedMotion()) show(); else window.setTimeout(show, 520);
    }
  }

  el.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); requestClose(); }
  });

  return {
    el,
    pauses: true,
    open(arg?: unknown): void {
      const view = arg && typeof arg === 'object' && 'view' in arg ? (arg as { view: unknown }).view : arg;
      if (isOpen && mode !== 'doc') return;      // the herald is mid-sentence; he does not start again
      isOpen = true;
      el.hidden = false;
      const state = ctx.state();
      if (state.charter.ready && view !== 'document' && nextRankOf(state.realm.rank)) startCeremony();
      else { showDoc(); sfx('page', 0.7); }
      dirty = true;
    },
    close(): void {
      if (!isOpen) { el.hidden = true; return; }
      isOpen = false;
      token++;
      stopReading();
      if (mode !== 'doc') { try { ctx.renderer.setMode('play'); } catch { /* no table */ } }
      mode = 'doc';
      dropPortraits();
      clear(doc); clear(cer); cer.hidden = true; docRank = null;
      el.classList.remove('is-ceremony');
      el.hidden = true;
    },
    update(state: GameState, dt: number): void {
      if (!isOpen || mode !== 'doc') return;
      tick += dt;
      if (!dirty && tick < 0.4) return;
      tick = 0; dirty = false;
      refreshDoc(state);
    },
    handleEvents(events: SimEvent[]): void {
      if (!isOpen) return;
      for (const e of events) if (e.type === 'charter_ready' || e.type === 'promotion' || e.type === 'demotion' || e.type === 'goal') { dirty = true; goalSig = ''; }
    },
  };
}
