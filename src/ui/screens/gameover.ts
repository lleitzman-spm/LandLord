/**
 * OWNER: ui-screens-a. The end of a reign, and its gentler cousin, the
 * demotion in Steward's Peace.
 *
 * `open(arg)` accepts any of:
 *   - an EndState                      { reason, day, epitaph }
 *   - the sim event                    { type: 'game_over', reason } or { type: 'demotion', rank }
 *   - the string 'demotion', or         { demotion: true, rank? }
 *   - nothing: reads state.ended; if the reign has not ended it is taken as a demotion.
 * In Iron Crown the heirloom passed on is looked up in the Dynasty Hall
 * (the app writes the entry when the reign ends); it appears when found.
 */
import type { Screen, UICtx, DynastyEntry } from '../api';
import type { GameState, EndState, RankId } from '../../sim/types';
import { h, addStyle, clear } from '../kit';
import { fmtDate } from '../../sim/core';
import { SCREENS_A_CSS, ensureDefs, waxSeal } from '../css/screens-a';
import { crest, flourish } from '../marginalia';
import { iconSvg } from '../icons';
import { requestTitleView, captureKeys, swallow, trapTab, styledRuler, rankTitle, rankId, reignLength, sortedDynasty, art, type TitleView } from './title';

type Ending =
  | { kind: 'end'; reason: EndState['reason']; epitaph: string | null; day: number | null }
  | { kind: 'demotion'; rank: RankId | null };

const WHY: Record<EndState['reason'], string> = {
  bankrupt: 'The coffers failed, and the moneylender declined to wait any longer.',
  charter_revoked: 'The Crown’s favour ran out, and the charter went back to the Crown.',
  abdicated: 'You laid down the keys of your own accord.',
};
const EPITAPH: Record<EndState['reason'], string> = {
  bankrupt: 'Built more than could be paid for, which is how most realms end.',
  charter_revoked: 'Forgot the Crown, which did not forget back.',
  abdicated: 'Handed back the keys and did not ask for the surety.',
};

function readEnding(arg: unknown, s: GameState): Ending {
  if (arg === 'demotion') return { kind: 'demotion', rank: s.realm.rank };
  const a = arg && typeof arg === 'object' ? arg as Record<string, unknown> : {};
  if (a.type === 'demotion' || a.kind === 'demotion' || a.demotion === true) return { kind: 'demotion', rank: rankId(typeof a.rank === 'string' ? a.rank : null) ?? s.realm.rank };
  const reason = typeof a.reason === 'string' && a.reason in WHY ? a.reason as EndState['reason'] : null;
  if (reason) return { kind: 'end', reason, epitaph: typeof a.epitaph === 'string' && a.epitaph ? a.epitaph : s.ended?.epitaph ?? null, day: typeof a.day === 'number' ? a.day : s.ended?.day ?? null };
  if (s.ended) return { kind: 'end', reason: s.ended.reason, epitaph: s.ended.epitaph || null, day: s.ended.day };
  return { kind: 'demotion', rank: rankId(typeof a.rank === 'string' ? a.rank : null) ?? s.realm.rank };
}

export function create(ctx: UICtx): Screen {
  addStyle('screens-a', SCREENS_A_CSS);
  ensureDefs();
  const el = h('div', { class: 'lla-root lla-end-veil', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'The end of the reign' });
  let ending: Ending = { kind: 'demotion', rank: null };
  let releaseKeys: (() => void) | null = null;
  let heirSlot: HTMLElement | null = null;
  let heirWanted = false, heirClock = 0, heirTries = 0;
  let lastFocus: HTMLElement | null = null;
  let snapshot: { ruler: string; realm: string; mode: string } = { ruler: '', realm: '', mode: 'peace' };

  const sfx = (id: Parameters<UICtx['audio']['sfx']>[0], v = .7) => { try { ctx.audio.sfx(id, { volume: v }); } catch { /* silent */ } };

  function goTitle(view: TitleView | null): void {
    if (view) requestTitleView(view, snapshot.mode === 'iron' ? 'iron' : 'peace');
    if (ctx.isOpen('gameover')) ctx.close('gameover');
    try { ctx.app.toTitle(); } catch { /* the shell will cope */ }
    setTimeout(() => { if (!ctx.isOpen('title') && !ctx.app.inGame()) ctx.open('title'); }, 60);
  }

  function tally(value: string, label: string, bad = false): HTMLElement {
    return h('div', { class: 'lla-tally' }, h('b', { class: bad ? 'is-bad' : '' }, value), h('span', null, label));
  }

  function render(): void {
    clear(el);
    const s = ctx.state();
    const st = s.stats;
    const e = ending;
    const end = e.kind === 'end';
    const rank = e.kind === 'end' ? s.realm.rank : (e.rank ?? s.realm.rank);
    const day = e.kind === 'end' ? (e.day ?? s.day) : s.day;
    snapshot = { ruler: s.realm.ruler, realm: s.realm.name, mode: s.mode };
    el.classList.toggle('is-end', end);

    const tallies = h('div', { class: 'lla-tallies' },
      tally(st.tenantsHoused.toLocaleString('en-US'), 'households housed'),
      tally(st.rentCollected.toLocaleString('en-US'), 'crowns of rent'),
      tally(st.peakRentRoll.toLocaleString('en-US'), 'best rent roll'),
      tally(String(st.evictions), st.evictions === 1 ? 'eviction' : 'evictions', st.evictions > 0),
      tally(String(st.oathsKept), st.oathsKept === 1 ? 'oath kept' : 'oaths kept'),
      tally(String(st.oathsBroken), st.oathsBroken === 1 ? 'oath broken' : 'oaths broken', st.oathsBroken > 0));

    heirSlot = h('div', { hidden: true });
    heirWanted = end && s.mode === 'iron'; heirClock = 0; heirTries = 0;

    const crestEl = art(crest(s.realm.crest, 46), 'lla-end-crest', { 'aria-hidden': 'true' });
    const orn = art(flourish(320, 4), 'lla-orn', { 'aria-hidden': 'true' });
    let doc: HTMLElement;
    if (ending.kind === 'end') {
      const epitaph = ending.epitaph || EPITAPH[ending.reason];
      const begin = h('button', { type: 'button', class: 'll-btn ll-btn-primary lla-big', onclick: () => { sfx('page', .5); goTitle('new'); } }, 'Begin anew');
      doc = h('article', { class: 'lla-end lla-sheet' },
        h('div', { class: 'lla-rules', 'aria-hidden': 'true' }),
        h('div', { class: 'lla-end-seal', html: waxSeal({ seed: 23, emblem: 'crown', broken: true, title: 'The broken seal of the charter' }) }),
        h('p', { class: 'lla-end-kicker' }, 'Here ended the reign of'),
        h('h2', { class: 'lla-end-name' }, styledRuler(rank, s.realm.ruler)),
        h('p', { class: 'lla-end-realm' }, `${rankTitle(rank)} of ${s.realm.name}`),
        h('p', { class: 'lla-end-when' }, `${reignLength(day)}, until the ${fmtDate(day)}`),
        crestEl,
        h('p', { class: 'lla-end-why' }, WHY[ending.reason]),
        h('blockquote', { class: 'lla-epitaph' }, epitaph),
        orn,
        tallies,
        heirSlot,
        h('div', { class: 'lla-btnrow' },
          begin,
          h('button', { type: 'button', class: 'll-btn ll-btn-plain lla-big', onclick: () => { sfx('page', .5); goTitle('dynasty'); } }, 'Dynasty hall'),
          h('button', { type: 'button', class: 'll-btn ll-btn-quiet lla-big', onclick: () => goTitle(null) }, 'Title')));
    } else {
      doc = h('article', { class: 'lla-end lla-sheet' },
        h('div', { class: 'lla-rules', 'aria-hidden': 'true' }),
        h('div', { class: 'lla-end-seal', html: waxSeal({ seed: 41, emblem: 'crown', title: 'The seal of the Crown' }) }),
        h('p', { class: 'lla-end-kicker' }, 'By order of the Crown'),
        h('h2', { class: 'lla-end-name' }, 'Reduced to ' + rankTitle(rank)),
        h('p', { class: 'lla-end-realm' }, `${styledRuler(rank, s.realm.ruler)}, of ${s.realm.name}`),
        crestEl,
        h('p', { class: 'lla-end-body' },
          'The moneylender waited three months, which he describes as a kindness. The Crown has paid him, cleared your debts, and taken a rank for its trouble. The tenants have been told. Some of them were pleased.'),
        h('p', { class: 'lla-end-why' }, 'The reign goes on. The hovels, regrettably, are where you left them.'),
        orn,
        h('p', { class: 'lla-end-sub' }, `The reign so far \u00B7 ${reignLength(day)}`),
        tallies,
        h('div', { class: 'lla-btnrow' },
          h('button', { type: 'button', class: 'll-btn ll-btn-primary lla-big', onclick: () => ctx.close('gameover') }, 'Carry on'),
          h('button', { type: 'button', class: 'll-btn ll-btn-quiet lla-big', onclick: () => goTitle(null) }, 'Title')));
    }
    el.append(doc);
    findHeir();
  }

  /** Look for this reign's entry in the Dynasty Hall and show its heirloom. */
  function findHeir(): void {
    if (!heirWanted || !heirSlot) return;
    heirTries++;
    let list: DynastyEntry[] = [];
    try { list = sortedDynasty(ctx.app.dynasty() ?? []); } catch { list = []; }
    const mine = list.find(e => e.mode === 'iron' && e.ruler === snapshot.ruler && e.realm === snapshot.realm) ?? null;
    if (!mine) return;
    heirWanted = false;
    if (!mine.heirloom) return;
    const slot = h('div', { class: 'lla-heir' },
      h('span', { html: iconSvg('key', { title: 'Heirloom' }), style: 'display:contents' }),
      h('span', null, h('span', { class: 'lla-heir-k' }, 'Passed to the heir'), h('span', { class: 'lla-heir-v' }, mine.heirloom)));
    heirSlot.replaceWith(slot); heirSlot = slot;
  }

  function onKey(e: KeyboardEvent): void {
    if (el.hidden) return;
    if (e.key === 'Escape') {
      swallow(e);
      if (ending.kind === 'demotion') ctx.close('gameover'); else goTitle(null);
      return;
    }
    trapTab(e, el);
  }

  return {
    el,
    pauses: true,
    open(arg?: unknown) {
      lastFocus = document.activeElement as HTMLElement | null;
      ending = readEnding(arg, ctx.state());
      render();
      el.hidden = false; el.scrollTop = 0;
      releaseKeys?.(); releaseKeys = captureKeys(onKey);
      sfx(ending.kind === 'end' ? 'thud' : 'bell', .8);
      if (ending.kind === 'end') { try { ctx.audio.setMood('defeat'); } catch { /* silent */ } }
      requestAnimationFrame(() => el.querySelector<HTMLElement>('.ll-btn-primary')?.focus({ preventScroll: true }));
    },
    close() {
      el.hidden = true;
      releaseKeys?.(); releaseKeys = null;
      heirWanted = false;
      if (lastFocus && document.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch { /* fine */ } }
      lastFocus = null;
    },
    update(_s: GameState, dt: number) {
      if (!heirWanted || el.hidden) return;
      heirClock += dt;
      if (heirClock >= .4) { heirClock = 0; findHeir(); if (heirTries > 15) heirWanted = false; }
    },
  };
}
