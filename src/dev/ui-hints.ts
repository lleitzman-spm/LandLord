/**
 * Dev entry for the clerk's hints (src/ui/parts/hints.ts): a fake table, a
 * dashed stand-in for the Word bar, and the part mounted with a fake ctx on a
 * Reeve fixture set back to the morning of the first Rent Day.
 *   node tools/shot.mjs src/dev/ui-hints.ts .tmp/hints-1.png --w 1100 --h 700 --wait 4500
 */
import { BASE_CSS } from '../ui/css/base';
import { SHELL_CSS } from '../ui/css/shell';
import { addStyle, h } from '../ui/kit';
import type { UICtx, AppAPI } from '../ui/api';
import type { Renderer } from '../render/api';
import type { WordAPI } from '../word/api';
import type { AudioAPI } from '../audio/api';
import type { Action, ActionResult } from '../sim/types';
import { makeFixtureState, fakeSim } from './fixture';
import { mount } from '../ui/parts/hints';

const FONT_CSS = [['IM Fell English', 'normal', 'fell'], ['IM Fell English', 'italic', 'fell-i'], ['IM Fell English SC', 'normal', 'fellsc'], ['UnifrakturMaguntia', 'normal', 'frak']]
  .map(([fam, style, file]) => `@font-face{font-family:'${fam}';font-style:${style};font-weight:400;src:url(../ui-tools-fonts/${file}.woff2) format('woff2')}`).join('');
const DEV_CSS = `
#ui.dev-hints{--ll-word-h:78px;background:
  radial-gradient(46% 40% at 52% 46%,rgba(120,150,84,.55),rgba(74,104,60,.5) 60%,transparent 62%),
  radial-gradient(90% 80% at 50% 45%,#6a4526 0%,#3a2414 55%,#0e0a08 100%)}
.dev-word{position:absolute;left:calc(50% - 280px);bottom:16px;width:560px;height:78px;border:1px dashed rgba(239,227,196,.35);border-radius:3px;color:rgba(239,227,196,.45);display:grid;place-items:center;font-family:var(--f-head);letter-spacing:.1em;pointer-events:none}
.dev-log{position:absolute;left:16px;top:16px;max-width:420px;font:11px/1.4 ui-monospace,monospace;color:rgba(239,227,196,.65);white-space:pre-line;pointer-events:none}
`;
addStyle('base', BASE_CSS);
addStyle('shell', SHELL_CSS);
addStyle('dev-fonts', FONT_CSS);
addStyle('dev-hints', DEV_CSS);

const app = document.getElementById('app')!;
const root = h('div', { id: 'ui', class: 'dev-hints' });
app.appendChild(root);
const log = h('div', { class: 'dev-log' });
root.append(h('div', { class: 'dev-word' }, 'the Word bar'), log);
const lines: string[] = [];
const say = (l: string): void => { lines.push(l); if (lines.length > 8) lines.shift(); log.textContent = lines.join('\n'); };

const st = makeFixtureState('reeve');
st.day = 0.6;
st.seen = {};
for (const id in st.buildings) { const b = st.buildings[id]!; if (b.units.length) { b.units[0]!.purse = 12; break; } }
const sim = fakeSim(st);
let hints = true;
const fakeApp: AppAPI = {
  newGame() {}, hasSave: () => false, saveInfo: () => null, continueGame: () => false, saveNow() {}, toTitle() {}, dynasty: () => [],
  settings: () => ({ quality: 'medium', master: 1, music: 1, sfx: 1, voice: 1, wit: 'quick', courtKey: '', hints }),
  setSettings(p) { if (typeof p.hints === 'boolean') { hints = p.hints; say('settings: hints ' + hints); } }, inGame: () => true,
};
const renderer = { focus(t: unknown) { say('focus: ' + JSON.stringify(t)); } } as unknown as Renderer;
const ctx: UICtx = {
  root, sim, state: () => sim.state, renderer, word: {} as WordAPI, audio: {} as AudioAPI, app: fakeApp,
  act(a: Action): ActionResult { const r = sim.dispatch(a); if (a.type === 'mark_seen') sim.state.seen[a.key] = true; say('act: ' + JSON.stringify(a)); return r; },
  open(s) { say('open: ' + s); }, close() {}, isOpen: () => false,
  toast(t) { say('toast: ' + t); }, select() {}, holdCrawl: () => () => {},
};
const part = mount(ctx);
root.appendChild(part.el);
let last = performance.now();
const loop = (): void => {
  const t = performance.now();
  part.update?.(sim.state, Math.min(0.1, (t - last) / 1000));
  last = t;
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);
