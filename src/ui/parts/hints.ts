/**
 * OWNER: hints agent. The first-reign guide: "your clerk", a small parchment
 * note that slides in at the lower right, above the Word bar, says one thing
 * and waits to be told "Noted".
 *
 * Each hint shows once per reign (recorded with mark_seen as `hint.<id>`),
 * only while hints are on and a reign is running, one at a time, never while
 * a screen is open, with a few quiet seconds between them. A hint about
 * something on the table asks the renderer to look at it, gently. No arrows.
 */
import type { GameState, SimEvent, Id, RankId } from '../../sim/types';
import type { UICtx, ScreenName } from '../api';
import type { Part } from './part';
import { h, addStyle, fromHTML, setClass, button } from '../kit';
import { createPortrait, type Portrait } from '../portraits';
import { doodle } from '../marginalia';
import { INCIDENT_BY_ID } from '../../data';

type Target = { buildingId?: Id; actorId?: Id };
type Mood = 'neutral' | 'pleased' | 'worried' | 'smug';
interface Hint {
  id: string;
  head: string;
  mood?: Mood;
  /** false = not yet; true = now; a target = now, and look there */
  when(st: GameState, ev: Flags): boolean | Target;
  text(st: GameState): string;
}
interface Flags { collected: boolean; had(id: string): boolean }

const SCREENS: readonly ScreenName[] = ['title', 'audience', 'ledger', 'council', 'charter', 'gameover', 'settings', 'help'];
const FIRST_MS = 2500;       // after a reign begins, before the clerk says anything
const GAP_MS = 6000;         // between one hint leaving and the next arriving
const LINGER_S = 60;         // an unanswered note folds itself away after this long on view
const NEXT_RANK: Partial<Record<RankId, string>> = { reeve: 'a Knight', knight: 'a Baron', baron: 'a Duke', duke: 'King' };

function title(st: GameState, start = false): string {
  const r = st.realm.rank;
  const t = r === 'reeve' ? 'Reeve' : r === 'knight' ? 'Sir' : 'my lord';
  return start ? t[0]!.toUpperCase() + t.slice(1) : t;
}
const anyBuilding = (st: GameState, fn: (b: GameState['buildings'][string]) => boolean): Id | null => {
  for (const id in st.buildings) if (fn(st.buildings[id]!)) return id;
  return null;
};
const isOpenIncident = (st: GameState, audience: boolean): GameState['incidents'][string] | null => {
  for (const id in st.incidents) {
    const inc = st.incidents[id]!;
    if (inc.state !== 'open') continue;
    const def = INCIDENT_BY_ID[inc.defId];
    if (!def || def.audience !== audience) continue;
    if (audience) { const a = inc.actorId ? st.actors[inc.actorId] : undefined; if (a && a.state === 'waiting') return inc; }
    else if (inc.buildingId && st.buildings[inc.buildingId]) return inc;
  }
  return null;
};

const HINTS: Hint[] = [
  {
    id: 'rent_day', head: 'Rent Day',
    when: st => {
      if (st.day >= 2) return false;
      const b = anyBuilding(st, x => x.units.some(u => u.purse > 0));
      return b ? { buildingId: b } : true;
    },
    text: st => anyBuilding(st, x => x.units.some(u => u.purse > 0))
      ? `This is ${st.realm.name}, ${title(st)}, and today is Rent Day. The purses are on the doorsteps. Click one and you will walk over and collect it yourself.`
      : `This is ${st.realm.name}, ${title(st)}. Rent Day is the first of every month: the purses go out on the doorsteps, and you click one to walk over and collect it.`,
  },
  {
    id: 'leak', head: 'Something has broken',
    when: st => { const inc = isOpenIncident(st, false); return inc && inc.buildingId ? { buildingId: inc.buildingId } : false; },
    text: st => st.realm.rank === 'reeve'
      ? `Things break, ${title(st)}. Thatch, mostly. Click the pin and someone will be sent, and at your rank the someone is you.`
      : `Things break, ${title(st)}. Thatch, mostly. Click the pin and someone will be sent: your Mason if you keep one, and you if you do not.`,
  },
  {
    id: 'applicant', head: 'To let',
    when: st => { const b = anyBuilding(st, x => x.state === 'ready' && x.units.some(u => !u.tenantId && u.listed)); return b ? { buildingId: b } : false; },
    text: () => 'An empty house is listed, so applicants will come up the road. When one waits at the door, click them to show them round, then hear what they have to say.',
  },
  {
    id: 'audience', head: 'Someone wants a word',
    when: st => { const inc = isOpenIncident(st, true); return inc && inc.actorId ? { actorId: inc.actorId } : false; },
    text: st => `There is someone at the seat who wants a word, ${title(st)}. Click them, then speak or type your ruling. Or take the suggestion I whisper. I try to keep them sensible.`,
  },
  {
    id: 'build', head: 'The build book',
    when: (st, ev) => ev.collected || st.stats.rentCollected > 0,
    text: () => 'The book on the left is for building. A cottage costs more than a hovel and earns more, which is the general shape of things. When the land runs out, it can be bought.',
  },
  {
    id: 'coffer', head: 'On the coffer', mood: 'worried',
    when: (st, ev) => st.day >= 3 && ev.had('build') && st.gold > 100 && !anyBuilding(st, b => b.state === 'building'),
    text: st => `There are ${Math.floor(st.gold)} crowns in the coffer and nothing going up, ${title(st)}. Money in a coffer houses nobody.`,
  },
  {
    id: 'word', head: 'You may simply say it',
    when: st => st.day >= 20 && st.stats.wordsSpoken === 0,
    text: st => `You need not click everything, ${title(st)}. Say what you want done in the box below, or hold the microphone and say it aloud. Someone will be listening. It is the job.`,
  },
  {
    id: 'charter', head: 'The charter',
    when: st => {
      const g = st.charter.goals;
      return g.length > 0 && !!NEXT_RANK[st.realm.rank] && g.filter(x => x.done).length * 2 >= g.length;
    },
    text: st => `Half the charter is met. The scroll on the table shows what the Crown still wants before it will make you ${NEXT_RANK[st.realm.rank] ?? 'anything further'}.`,
  },
  {
    id: 'knight', head: 'A household', mood: 'pleased',
    when: st => st.realm.rank === 'knight',
    text: () => "You may keep a household now, Sir. Build a Mason's Yard and a Bailiff's Post and hire from the council. Then tell them what you want, once, in your own words.",
  },
  {
    id: 'order', head: 'A standing order',
    when: st => st.orders.length > 0,
    text: st => `Said once, it holds until you revoke it, ${title(st)}. The ledger lists your orders, for when somebody argues the wording. Somebody will.`,
  },
  {
    id: 'debt', head: 'The moneylender', mood: 'worried',
    when: st => st.gold < 0,
    text: () => 'The coffer ran dry and the moneylender has covered it. He was very understanding. He charges for that. Mind the interest.',
  },
  {
    id: 'oath', head: 'Your word', mood: 'smug',
    when: st => st.oaths.length > 0,
    text: st => `Your word is in the ledger now, ${title(st)}. I wrote it down myself, in the good ink. Keep it.`,
  },
];

const CSS = `
.ll-hints{position:absolute;right:var(--ll-gr,16px);bottom:calc(var(--ll-gb,16px) + var(--ll-word-h,0px) + 12px);width:min(320px,calc(100% - 32px));pointer-events:none;z-index:6}
.ll-hints.is-hidden{visibility:hidden}
.ll-hint{position:relative;pointer-events:auto;display:flex;gap:12px;align-items:flex-start;padding:13px 14px 9px 12px;opacity:0;transform:translateX(34px) rotate(1.4deg);transform-origin:90% 100%;transition:transform .5s cubic-bezier(.2,.9,.25,1.12),opacity .32s}
.ll-hint.is-in{opacity:1;transform:translateX(0) rotate(-.7deg)}
.ll-hint.is-out{opacity:0;transform:translate(10px,14px) rotate(1.6deg);transition:transform .3s ease-in,opacity .26s}
.ll-hint::before{content:'';position:absolute;top:-6px;left:50%;width:14px;height:14px;margin-left:-7px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#c5473d,var(--rubric) 55%,#5e1512);box-shadow:0 1px 2px rgba(0,0,0,.5)}
.ll-hint-face{flex:none;width:58px;height:58px;display:grid;place-items:center;margin-top:2px}
.ll-hint-face>*{width:58px;height:58px}
.ll-hint-face svg{width:100%;height:100%}
.ll-hint-main{flex:1;min-width:0;display:flex;flex-direction:column}
.ll-hint-who{font-family:var(--f-head);font-size:var(--fs-xs);letter-spacing:.1em;color:var(--ink-3)}
.ll-hint-head{font-family:var(--f-head);font-weight:400;font-size:var(--fs-m);letter-spacing:.04em;color:var(--rubric);margin:0 0 3px}
.ll-hint-text{margin:0;font-size:var(--fs-s);line-height:1.4;color:var(--ink);text-wrap:pretty}
.ll-hint-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px}
.ll-hint-row .ll-btn-quiet{padding:4px 0;font-size:var(--fs-xs);font-style:italic;font-family:var(--f-body);letter-spacing:0}
.ll-hint-row .ll-btn-primary{padding:4px 14px}
@media (max-width:699px){.ll-hints{left:var(--ll-gl,16px);width:auto}}
`;

export function mount(ctx: UICtx): Part {
  addStyle('hints', CSS);
  const el = h('div', { class: 'll-hints', 'aria-live': 'polite' });

  let bound: GameState | null = null;     // the reign we are guiding; a new state object is a new reign
  const shown = new Set<string>();         // this reign, in case the record has not landed yet
  const ev: Flags = { collected: false, had: id => shown.has(id) || !!bound?.seen['hint.' + id] };
  let quietUntil = 0;
  let visible = true;
  let tick = 0;
  let cur: { note: HTMLElement; face: Portrait | null; timers: number[]; onView: number } | null = null;

  const now = (): number => performance.now();
  const anyScreen = (): boolean => SCREENS.some(n => { try { return ctx.isOpen(n); } catch { return false; } });
  const enabled = (): boolean => { try { return ctx.app.inGame() && ctx.app.settings().hints !== false; } catch { return false; } };

  function dismiss(instant = false): void {
    if (!cur) return;
    const c = cur; cur = null;
    c.timers.forEach(t => window.clearTimeout(t));
    quietUntil = Math.max(quietUntil, now() + GAP_MS);
    const gone = (): void => { c.face?.dispose(); c.note.remove(); };
    if (instant) { gone(); return; }
    setClass(c.note, 'is-in', false); setClass(c.note, 'is-out', true);
    window.setTimeout(gone, 340);
  }

  function face(st: GameState, mood: Mood): { node: Node; portrait: Portrait | null } {
    try {
      const p = createPortrait({ species: 'human', seed: (Math.abs(st.seed) % 9973) + 17, role: 'steward', size: 58, frame: true });
      p.setMood(mood);
      return { node: p.el, portrait: p };
    } catch {
      try { return { node: fromHTML(doodle('owl_ledger', 3, 58)), portrait: null }; } catch { return { node: h('span'), portrait: null }; }
    }
  }

  function show(hint: Hint, st: GameState, target: Target | null): void {
    shown.add(hint.id);
    ctx.act({ type: 'mark_seen', key: 'hint.' + hint.id });
    const f = face(st, hint.mood ?? 'neutral');
    const note = h('div', { class: 'll-hint ll-parch', role: 'note', dataset: { hint: hint.id } },
      h('div', { class: 'll-hint-face', 'aria-hidden': 'true' }, f.node),
      h('div', { class: 'll-hint-main' },
        h('div', { class: 'll-hint-who' }, 'Your clerk'),
        h('h3', { class: 'll-hint-head' }, hint.head),
        h('p', { class: 'll-hint-text' }, hint.text(st)),
        h('div', { class: 'll-hint-row' },
          button('Enough of that', () => { dismiss(); try { ctx.app.setSettings({ hints: false }); } catch { /* the shell will not be told; the note is gone regardless */ } }, { kind: 'quiet', title: 'Turn the clerk’s notes off. They can be turned on again in the settings.' }),
          button('Noted', () => { f.portrait?.setMood('pleased'); dismiss(); }, { kind: 'primary' }))));
    el.appendChild(note);
    const timers: number[] = [];
    cur = { note, face: f.portrait, timers, onView: 0 };
    void note.offsetWidth;                                  // let the slide start from off to the side
    setClass(note, 'is-in', true);
    if (f.portrait) {
      f.portrait.setTalking(true);
      timers.push(window.setTimeout(() => f.portrait?.setTalking(false), 1500));
    }
    if (target) { try { ctx.renderer.focus(target, { ms: 900 }); } catch { /* a look is a courtesy, not a requirement */ } }
  }

  function consider(st: GameState): void {
    if (cur || now() < quietUntil || anyScreen() || !visible) return;
    for (const hint of HINTS) {
      if (shown.has(hint.id) || st.seen['hint.' + hint.id]) continue;
      let r: boolean | Target = false;
      try { r = hint.when(st, ev); } catch { r = false; }
      if (!r) continue;
      show(hint, st, r === true ? null : r);
      return;
    }
  }

  return {
    el,
    update(state: GameState, dt: number) {
      if (state !== bound) {
        bound = state; shown.clear(); ev.collected = false;
        dismiss(true);
        quietUntil = now() + FIRST_MS;
      }
      if (!enabled()) { if (cur) dismiss(true); return; }
      if (cur) {
        if (visible && !anyScreen()) cur.onView += dt;
        if (cur.onView > LINGER_S) dismiss();
        return;
      }
      tick += dt;
      if (tick < 0.5) return;
      tick = 0;
      consider(state);
    },
    handleEvents(events: SimEvent[]) {
      for (const e of events) if (e.type === 'purse_collected') ev.collected = true;
    },
    setVisible(on: boolean) {
      visible = on;
      setClass(el, 'is-hidden', !on);
    },
  };
}
