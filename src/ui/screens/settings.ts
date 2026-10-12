/**
 * OWNER: ui-screens-a. Settings: the table's quality, four volumes, the wit
 * of the court, hints, the court key, Save now and Return to title. Every
 * change is applied at once through app.setSettings.
 */
import type { Screen, UICtx, Settings } from '../api';
import { h, addStyle, clear } from '../kit';
import { SCREENS_A_CSS, ensureDefs } from '../css/screens-a';
import { captureKeys, swallow, trapTab, backToTitleIfIdle } from './title';

type Vol = 'master' | 'music' | 'sfx' | 'voice';

export function create(ctx: UICtx): Screen {
  addStyle('screens-a', SCREENS_A_CSS);
  ensureDefs();
  const el = h('div', { class: 'lla-root lla-modal', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lla-set-title' });
  let releaseKeys: (() => void) | null = null;
  let lastFocus: HTMLElement | null = null;
  let keyTimer = 0;
  let previewAt = 0;

  const sfx = (id: Parameters<UICtx['audio']['sfx']>[0], v = .6) => { try { ctx.audio.sfx(id, { volume: v }); } catch { /* silent */ } };
  const apply = (patch: Partial<Settings>) => { try { ctx.app.setSettings(patch); } catch { ctx.toast('That setting would not take.', 'bad'); } };

  function seg<T extends string>(label: string, value: T, options: [T, string][], onPick: (v: T) => void): HTMLElement {
    const btns = options.map(([v, text]) => {
      const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(v === value), tabindex: v === value ? 0 : -1 }, text);
      b.addEventListener('click', () => pick(v));
      return b;
    });
    const group = h('div', { class: 'lla-seg', role: 'radiogroup', 'aria-label': label }, btns);
    function pick(v: T): void {
      options.forEach(([ov], i) => { btns[i]!.setAttribute('aria-checked', String(ov === v)); btns[i]!.tabIndex = ov === v ? 0 : -1; });
      if (v !== value) { value = v; onPick(v); sfx('click', .5); }
    }
    group.addEventListener('keydown', e => {
      const i = options.findIndex(([ov]) => ov === value);
      const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const n = (i + d + options.length) % options.length; pick(options[n]![0]); btns[n]!.focus();
    });
    return group;
  }

  function render(): void {
    clear(el);
    let s: Settings;
    try { s = ctx.app.settings(); } catch { s = { quality: 'medium', master: .8, music: .5, sfx: .8, voice: .7, wit: 'quick', courtKey: '', hints: true }; }
    // volumes are 0..1 by contract; tolerate a 0..100 app without fuss
    const scale = [s.master, s.music, s.sfx, s.voice].some(v => v > 1) ? 100 : 1;
    const inGame = ctx.app.inGame();

    const slider = (key: Vol, label: string) => {
      const pct = Math.round(Math.max(0, Math.min(1, (s[key] ?? 0) / scale)) * 100);
      const out = h('span', { class: 'lla-row-v', 'aria-hidden': 'true' }, String(pct));
      const r = h('input', { class: 'lla-range', type: 'range', min: '0', max: '100', step: '1', 'aria-label': label + ' volume' });
      r.value = String(pct); r.style.setProperty('--v', pct + '%');
      r.addEventListener('input', () => {
        const v = Number(r.value); out.textContent = String(v); r.style.setProperty('--v', v + '%');
        apply({ [key]: (v / 100) * scale } as Partial<Settings>);
        // and straight to the mixer, so the change is heard at once whatever the app does with it
        try { ctx.audio.setVolumes({ [key]: v / 100 }); } catch { /* the app applies it */ }
      });
      r.addEventListener('change', () => preview(key));
      return h('div', { class: 'lla-row' }, h('label', { class: 'lla-row-k' }, label), r, out);
    };

    const key = h('input', { class: 'll-input', type: 'password', autocomplete: 'off', spellcheck: false, placeholder: 'None needed here, most likely', 'aria-label': 'Court key', maxLength: 200 });
    key.value = s.courtKey ?? '';
    const saveKey = () => { clearTimeout(keyTimer); apply({ courtKey: key.value.trim() }); };
    key.addEventListener('input', () => { clearTimeout(keyTimer); keyTimer = window.setTimeout(saveKey, 500); });
    key.addEventListener('change', saveKey);
    key.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveKey(); ctx.toast('The court key is kept.', 'good'); } });
    const eye = h('button', { type: 'button', class: 'll-btn ll-btn-quiet lla-eye', 'aria-pressed': 'false', title: 'Show the key' }, 'Show');
    eye.addEventListener('click', () => {
      const showing = key.type === 'text';
      key.type = showing ? 'password' : 'text'; eye.textContent = showing ? 'Show' : 'Hide';
      eye.setAttribute('aria-pressed', String(!showing)); eye.title = showing ? 'Show the key' : 'Hide the key';
    });

    let hints = !!s.hints;
    const hintSw = h('button', { type: 'button', class: 'lla-switch', role: 'switch', 'aria-checked': String(hints), 'aria-label': 'Hints' }, h('i', { 'aria-hidden': 'true' }), h('span', null, hints ? 'On' : 'Off'));
    hintSw.addEventListener('click', () => {
      hints = !hints; hintSw.setAttribute('aria-checked', String(hints)); (hintSw.lastElementChild as HTMLElement).textContent = hints ? 'On' : 'Off';
      apply({ hints }); sfx('click', .5);
    });

    const qualityNote = h('p', { class: 'lla-row-note' }, qualityLine(s.quality));
    const witNote = h('p', { class: 'lla-row-note' }, witLine(s.wit));

    const save = h('button', { type: 'button', class: 'll-btn ll-btn-plain', disabled: !inGame, title: inGame ? 'Write the reign to this browser now' : 'There is no reign to save' }, 'Save now');
    save.addEventListener('click', () => {
      try { ctx.app.saveNow(); ctx.toast('Saved. The clerk has blotted it.', 'good'); sfx('quill', .6); }
      catch { ctx.toast('The save did not take. This browser may be refusing to keep anything.', 'bad'); }
    });
    const back = h('button', { type: 'button', class: 'll-btn ll-btn-primary' }, inGame ? 'Return to title' : 'Back to the title');
    back.addEventListener('click', () => {
      if (ctx.app.inGame()) { ctx.close('settings'); try { ctx.app.toTitle(); } catch { /* shell copes */ } }
      else ctx.close('settings');
    });

    const panel = h('div', { class: 'll-panel lla-set' },
      h('div', { class: 'll-panel-head' },
        h('div', { class: 'lla-ptitle' }, h('h2', { class: 'll-title', id: 'lla-set-title' }, 'Settings'), h('p', { class: 'll-sub' }, 'The arrangements of the court')),
        h('button', { type: 'button', class: 'll-seal ll-close', title: 'Close', 'aria-label': 'Close', onclick: () => ctx.close('settings') }, '✕')),
      h('div', { class: 'll-panel-body' },
        h('section', { class: 'lla-sec' },
          h('h3', { class: 'lla-sec-h' }, 'The table'),
          h('div', { class: 'lla-row' }, h('span', { class: 'lla-row-k' }, 'Quality'),
            seg('Quality', s.quality, [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], v => { apply({ quality: v }); try { ctx.renderer.setQuality(v); } catch { /* the app applies it */ } qualityNote.textContent = qualityLine(v); }),
            h('span'), qualityNote)),
        h('section', { class: 'lla-sec' },
          h('h3', { class: 'lla-sec-h' }, 'Sound'),
          slider('master', 'All sound'), slider('music', 'Music'), slider('sfx', 'Effects'), slider('voice', 'Voices')),
        h('section', { class: 'lla-sec' },
          h('h3', { class: 'lla-sec-h' }, 'The court'),
          h('div', { class: 'lla-row' }, h('span', { class: 'lla-row-k' }, 'Wit of the court'),
            seg('Wit of the court', s.wit, [['quick', 'Quick'], ['default', 'Considered']], v => { apply({ wit: v }); witNote.textContent = witLine(v); }),
            h('span'), witNote),
          h('div', { class: 'lla-row' }, h('span', { class: 'lla-row-k' }, 'Hints'), hintSw, h('span'),
            h('p', { class: 'lla-row-note' }, 'The Steward’s reminders for the newly enfeoffed.')),
          h('div', { class: 'lla-row' }, h('label', { class: 'lla-row-k' }, 'Court key'), h('div', { class: 'lla-keyfield' }, key, eye), h('span'),
            h('p', { class: 'lla-row-note' }, 'Only if the keeper of this court has set one. Kept in this browser and shown to no one else.'))),
        h('div', { class: 'lla-set-foot' }, inGame ? save : h('span', { class: 'lla-note' }, 'Changes are kept as you make them.'), back)));
    el.append(panel);
  }

  function preview(key: Vol): void {
    const now = performance.now(); if (now - previewAt < 250) return; previewAt = now;
    try {
      if (key === 'voice') ctx.audio.voice(4242, 'Aye, my lord. At once.');
      else if (key === 'sfx') ctx.audio.sfx('coin');
      else if (key === 'master') ctx.audio.sfx('chime');
    } catch { /* silent */ }
  }

  function onKey(e: KeyboardEvent): void {
    if (el.hidden) return;
    if (e.key === 'Escape') { swallow(e); ctx.close('settings'); return; }
    trapTab(e, el);
  }

  return {
    el,
    /** holds the world while a reign is on; the title's living diorama keeps going */
    get pauses() { return ctx.app.inGame(); },
    open() {
      lastFocus = document.activeElement as HTMLElement | null;
      render();
      el.hidden = false; el.scrollTop = 0;
      releaseKeys?.(); releaseKeys = captureKeys(onKey);
      requestAnimationFrame(() => el.querySelector<HTMLElement>('.lla-seg [aria-checked="true"]')?.focus({ preventScroll: true }));
    },
    close() {
      if (el.hidden) return;
      clearTimeout(keyTimer);
      const key = el.querySelector<HTMLInputElement>('.lla-keyfield input');
      if (key) { try { const cur = ctx.app.settings().courtKey ?? ''; if (key.value.trim() !== cur) ctx.app.setSettings({ courtKey: key.value.trim() }); } catch { /* fine */ } }
      el.hidden = true;
      releaseKeys?.(); releaseKeys = null;
      if (lastFocus && document.contains(lastFocus) && ctx.app.inGame()) { try { lastFocus.focus({ preventScroll: true }); } catch { /* fine */ } }
      lastFocus = null;
      backToTitleIfIdle(ctx);
    },
  };
}

function qualityLine(q: Settings['quality']): string {
  return q === 'low' ? 'Fewer shadows and candles. Kind to an old machine.'
    : q === 'high' ? 'Every shadow and candle. Spares nothing, including the fan.'
    : 'Shadows and candles, within reason.';
}
function witLine(w: Settings['wit']): string {
  return w === 'quick' ? 'The court answers at once, and plainly.' : 'The court thinks before it speaks, and takes longer about it.';
}
