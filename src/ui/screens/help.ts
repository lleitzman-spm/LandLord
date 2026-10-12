/**
 * OWNER: ui-screens-a. "How to rule": a short illuminated primer in the
 * game's voice, with example sayings that can be clicked into the Word box,
 * and the keys.
 */
import type { Screen, UICtx } from '../api';
import { h, addStyle, clear } from '../kit';
import { SCREENS_A_CSS, ensureDefs } from '../css/screens-a';
import { doodle, type DoodleKind } from '../marginalia';
import { iconSvg } from '../icons';
import { captureKeys, swallow, trapTab, backToTitleIfIdle, roman, art, typingIn } from './title';

interface Section { id: string; title: string; doodle: DoodleKind; body: string[]; sayings?: string[]; keys?: boolean }

const SECTIONS: Section[] = [
  {
    id: 'rent', title: 'Rent Day', doodle: 'mouse_coin',
    body: [
      'Rent falls due on the 1st of every month. Over the first three days each household that means to pay sets a purse on its doorstep. As Reeve you walk round and collect them yourself: click a purse, or Collect all.',
      'A purse left out too long is spent at the tavern, and becomes arrears. The household will describe this as an accident. In time a Bailiff walks the round for you, and later still a Steward with a Counting House has the tenants queue at your door.',
    ],
  },
  {
    id: 'build', title: 'Building and land', doodle: 'fox_scribe',
    body: [
      'Lay out what you can afford from the pattern book (B): homes to let, premises to lease to a trade, and wells, gardens and shrines that make a street worth living on. Roads speed everyone up.',
      'Buildings decay. A roof does not mend itself, however long you look at it. When your land is full, buy the next parcel, if the Crown will sell it to someone of your rank.',
    ],
  },
  {
    id: 'lease', title: 'Vacancies and applicants', doodle: 'goblin_scroll',
    body: [
      'Homes that are listed draw applicants to the gate. Someone must show them the place. Then decide: welcome them, haggle over the rent, ask their last landlord, or send them on their way.',
      'Fair rent and a good name bring better households. A home left empty for forty days tends to acquire goblins, who will have read the lease more closely than you.',
    ],
  },
  {
    id: 'repair', title: 'When things break', doodle: 'owl_ledger',
    body: [
      'When something breaks, a seal is pinned to the building, ringed by a timer that drains as patience does. Click it to send someone, or say what you want done.',
      'A repair ignored becomes a worse repair, and the household under it remembers. So, in time, does everyone at the well.',
    ],
  },
  {
    id: 'word', title: 'Ruling by word', doodle: 'hound_horn',
    body: [
      'Speak in the Word box (Enter or T), or hold the talk key and say it aloud. Name a delegate and tell them what you want. A plain order is done once. A standing order, said with never, always or whenever, holds until you revoke it, and is how a realm learns to run without you.',
      'They read back what they understood, in their own manner. Weighty matters wait for your aye. If it goes wrong, look first at your wording. Click a saying to write it into the Word box.',
    ],
    sayings: [
      'Hob, mend the roof at the Leaning Hovel.',
      'Agnes, never evict a widow in winter.',
      'Three days’ grace, then the fee.',
      'Pip, find a tenant for the empty cottage.',
      'Ansel, ask the last landlord of every applicant.',
      'Collect the rent.',
    ],
  },
  {
    id: 'audience', title: 'Audiences and oaths', doodle: 'griffin',
    body: [
      'Some matters come to your door in person. A petitioner walks to your seat and waits; click them to hear them out, then give your ruling in your own words. If you are stuck, your Steward whispers a few things you might say.',
      'Anything you promise is entered in the Ledger of Oaths. Keep it and your name rises. Break it and the well will discuss it for a year.',
    ],
  },
  {
    id: 'crown', title: 'The Crown and the charter', doodle: 'goose_bishop',
    body: [
      'Pay the Crown its tribute each quarter and keep its favour. Your charter lists what you must achieve to rise. Meet it all and the herald comes to raise you from Reeve to Knight to Baron, with more land, new peoples and a household to blame.',
      'In Steward’s Peace a ruinous year costs you a rank. In Iron Crown it costs you the reign, and your heir starts again with one heirloom and the family reputation.',
    ],
  },
  { id: 'keys', title: 'The keys', doodle: 'cat_lute', body: [], keys: true },
];

const KEYS: [string[], string][] = [
  [['Space'], 'Pause, or carry on'],
  [['1', '2', '3'], 'Steady, brisk, headlong'],
  [['B'], 'The pattern book, to build'],
  [['R'], 'Turn a building while placing it'],
  [['Right-click'], 'Put down the tool in hand'],
  [['L'], 'The ledger'],
  [['C'], 'The council of your household'],
  [['H', '?'], 'This primer'],
  [['Enter', 'T'], 'Speak: the Word box'],
  [['Hold `'], 'Speak aloud, where the browser allows. A held Space does the same.'],
  [['Esc'], 'Put down the tool, then close what is open'],
];

/** Find the Word box (the in-game text box whose placeholder begins "Speak"). */
function findWordBox(): HTMLInputElement | HTMLTextAreaElement | null {
  const all = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[type="text"], input:not([type]), textarea'));
  return all.find(b => !b.closest('.lla-root') && !b.disabled && /^\s*speak/i.test(b.placeholder || b.getAttribute('aria-label') || '')) ?? null;
}
async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* try the old way */ }
  try {
    const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0;left:-999px';
    document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok;
  } catch { return false; }
}

export function create(ctx: UICtx): Screen {
  addStyle('screens-a', SCREENS_A_CSS);
  ensureDefs();
  const el = h('div', { class: 'lla-root lla-modal', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lla-help-title' });
  let releaseKeys: (() => void) | null = null;
  let lastFocus: HTMLElement | null = null;
  let article: HTMLElement | null = null;
  let tocBtns: HTMLButtonElement[] = [];
  let built = false;

  const sfx = (id: Parameters<UICtx['audio']['sfx']>[0], v = .6) => { try { ctx.audio.sfx(id, { volume: v }); } catch { /* silent */ } };

  function say(text: string): void {
    sfx('quill', .5);
    if (ctx.app.inGame()) {
      // close first, so the shell shows the Word bar again; then hand it the words
      // through its own bus ('ll:speak'), and fill the box directly if nobody answered
      ctx.close('help');
      try { window.dispatchEvent(new CustomEvent('ll:speak', { detail: { text } })); } catch { /* fine */ }
      const box = findWordBox();
      if (box) {
        if (box.value !== text) {
          const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(box), 'value')?.set;
          if (setter) setter.call(box, text); else box.value = text;
          box.dispatchEvent(new Event('input', { bubbles: true }));
        }
        // the bar may still be hidden for a frame or two while the veil lifts
        let tries = 0;
        const focusBox = () => {
          if (box.offsetParent !== null) { if (document.activeElement !== box) box.focus(); try { box.setSelectionRange(text.length, text.length); } catch { /* fine */ } }
          else if (tries++ < 30) requestAnimationFrame(focusBox);
        };
        requestAnimationFrame(focusBox);
        ctx.toast('Written into the Word box. Press Enter to say it.', 'info');
        return;
      }
    }
    void copyText(text).then(ok => ctx.toast(ok
      ? (ctx.app.inGame() ? 'Copied. Paste it into the Word box.' : 'Copied. Say it once you have a realm to say it to.')
      : 'The clerk could not copy it. It is short enough to type.', ok ? 'info' : 'bad'));
  }

  function build(): void {
    clear(el);
    tocBtns = [];
    const sections = SECTIONS.map((sec, i) => {
      const d = art(doodle(sec.doodle, i * 3 + 1, 96), 'lla-doodle', { 'aria-hidden': 'true' });
      const paras = sec.body.map((p, j) => h('p', { class: j === 0 ? 'll-dropcap' : '' }, p));
      const sayings = sec.sayings ? h('ul', { class: 'lla-sayings', 'aria-label': 'Example sayings' }, sec.sayings.map(s =>
        h('li', null, h('button', { type: 'button', class: 'lla-saying', title: 'Write this into the Word box', onclick: () => say(s) },
          h('span', { html: iconSvg('quill'), style: 'display:contents' }), h('span', null, '“' + s + '”'), h('em', null, 'Use this'))))) : null;
      const keys = sec.keys ? h('dl', { class: 'lla-keys' }, KEYS.flatMap(([ks, what]) => [
        h('dt', null, ks.map(k => h('kbd', null, k))), h('dd', null, what)])) : null;
      return h('section', { class: 'lla-hsec', id: 'lla-h-' + sec.id, 'aria-labelledby': 'lla-hh-' + sec.id },
        d, h('h3', { id: 'lla-hh-' + sec.id }, h('i', null, roman(i + 1).toLowerCase() + '.'), sec.title), paras, sayings, keys);
    });
    article = h('div', { class: 'lla-article', tabindex: -1 }, sections);
    const toc = h('nav', { class: 'lla-toc', 'aria-label': 'Contents' },
      SECTIONS.map((sec, i) => {
        const b = h('button', { type: 'button', onclick: () => jump(sec.id) }, h('i', null, roman(i + 1).toLowerCase() + '.'), h('span', null, sec.title));
        tocBtns.push(b); return b;
      }),
      art(doodle('snail_knight', 11, 120), 'lla-doodle lla-toc-doodle', { 'aria-hidden': 'true' }));
    article.addEventListener('scroll', markToc, { passive: true });
    const panel = h('div', { class: 'll-panel lla-help' },
      h('div', { class: 'll-panel-head' },
        h('div', { class: 'lla-ptitle' }, h('h2', { class: 'll-title', id: 'lla-help-title' }, 'How to Rule'), h('p', { class: 'll-sub' }, 'A primer for the newly enfeoffed')),
        h('button', { type: 'button', class: 'll-seal ll-close', title: 'Close', 'aria-label': 'Close', onclick: () => ctx.close('help') }, '✕')),
      h('div', { class: 'll-panel-body' }, toc, article));
    el.append(panel);
    built = true;
  }

  function jump(id: string): void {
    const target = article?.querySelector<HTMLElement>('#lla-h-' + id);
    if (!article || !target) return;
    article.scrollTo({ top: target.offsetTop - article.offsetTop - 4, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    sfx('page', .35);
  }
  function markToc(): void {
    if (!article) return;
    const top = article.scrollTop + 40;
    let on = 0;
    SECTIONS.forEach((sec, i) => { const t = article!.querySelector<HTMLElement>('#lla-h-' + sec.id); if (t && t.offsetTop - article!.offsetTop <= top) on = i; });
    if (article.scrollTop + article.clientHeight >= article.scrollHeight - 4) on = SECTIONS.length - 1;
    tocBtns.forEach((b, i) => b.classList.toggle('is-on', i === on));
  }

  function onKey(e: KeyboardEvent): void {
    if (el.hidden) return;
    if (e.key === 'Escape') { swallow(e); ctx.close('help'); return; }
    if ((e.key === 'h' || e.key === 'H') && !typingIn(e) && !e.ctrlKey && !e.metaKey && !e.altKey) { swallow(e); ctx.close('help'); return; }
    trapTab(e, el);
  }

  return {
    el,
    /** holds the world while a reign is on; the title's living diorama keeps going */
    get pauses() { return ctx.app.inGame(); },
    open() {
      lastFocus = document.activeElement as HTMLElement | null;
      if (!built) build();
      el.hidden = false;
      if (article) article.scrollTop = 0;
      markToc();
      releaseKeys?.(); releaseKeys = captureKeys(onKey);
      requestAnimationFrame(() => (el.querySelector<HTMLElement>('.lla-toc button') && getComputedStyle(el.querySelector('.lla-toc')!).display !== 'none'
        ? el.querySelector<HTMLElement>('.lla-toc button') : article)?.focus({ preventScroll: true }));
    },
    close() {
      if (el.hidden) return;
      el.hidden = true;
      releaseKeys?.(); releaseKeys = null;
      if (lastFocus && document.contains(lastFocus) && ctx.app.inGame()) { try { lastFocus.focus({ preventScroll: true }); } catch { /* fine */ } }
      lastFocus = null;
      backToTitleIfIdle(ctx);
    },
  };
}
