#!/usr/bin/env node
// Drive the real game in headless Chromium for a scripted play session.
//   node tools/play.mjs <steps.mjs> [--w 1100] [--h 700]
// steps.mjs:  export default async function (page, t) { ... }
//   t.shot(name)        screenshot to .tmp/<name>.png
//   t.wait(ms)          real-time wait (frames keep running; software GL is slow: a few fps)
//   t.ev(fn, arg)       page.evaluate
//   t.newGame(opts)     start a reign through the app ({ ruler, realm, mode, seed })
//   t.days(n)           fast-forward the sim n game days (window.__ll.sim.advanceDays) and let a frame run
//   t.act(action)       sim.dispatch(action) → ActionResult
//   t.state(fn)         evaluate fn(state) in the page and return JSON
//   t.click(selector)   click a DOM element;  t.clickAt(x, y) a canvas point;  t.key(k);  t.type(selector, text)
//   t.errors            console errors and page errors seen so far (array of strings)
//   t.log(...)          print
// The whole session holds the shared browser lock (the box has 2 cores): do everything in ONE run,
// keep it under ~4 minutes, and expect to queue for a few minutes before it starts.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const root = new URL('..', import.meta.url).pathname;
const args = process.argv.slice(2);
if (!args[0]) { console.error('usage: play.mjs <steps.mjs> [--w 1100] [--h 700]'); process.exit(2); }
if (!process.env.PLAY_LOCKED) {
  try { execFileSync('flock', ['/tmp/landlord-shot.lock', process.execPath, new URL(import.meta.url).pathname, ...args], { stdio: 'inherit', env: { ...process.env, PLAY_LOCKED: '1' }, timeout: 20 * 60 * 1000 }); }
  catch (e) { process.exit(e.status ?? 1); }
  process.exit(0);
}
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const W = +opt('w', 1100), H = +opt('h', 700);
const tmp = path.join(root, '.tmp', 'play-' + process.pid);
mkdirSync(tmp, { recursive: true });
await build({ entryPoints: [path.join(root, 'src/main.ts')], bundle: true, format: 'iife', outfile: path.join(tmp, 'game.js'), sourcemap: 'inline', logLevel: 'error' });
writeFileSync(path.join(tmp, 'index.html'), readFileSync(path.join(root, 'index.html'), 'utf8'));
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const steps = (await import(pathToFileURL(path.resolve(args[0])).href)).default;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') { const s = m.text().slice(0, 500); if (!/fonts\.g|ERR_INTERNET|ERR_NAME|net::|Failed to load resource/.test(s)) { errors.push('[console] ' + s); console.log('[console.error] ' + s); } } });
page.on('pageerror', e => { const s = String(e && e.stack || e).slice(0, 900); errors.push('[pageerror] ' + s); console.log('[pageerror] ' + s); });
// the game's own origin has no server here: /api/court answers 404 unless a step installs page.route itself
await page.route('**/api/**', r => r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"no server","code":"not_found"}' }));
await page.goto('file://' + path.join(tmp, 'index.html'));
await page.waitForFunction(() => !!(window).__ll, null, { timeout: 60000 }).catch(() => console.log('[play] window.__ll never appeared'));
const t = {
  errors,
  log: (...a) => console.log('[play]', ...a),
  wait: ms => page.waitForTimeout(ms),
  shot: async name => { const f = path.join(root, '.tmp', name + '.png'); await page.screenshot({ path: f }); console.log('[play] wrote ' + f); },
  ev: (fn, arg) => page.evaluate(fn, arg),
  newGame: async (o = {}) => { await page.evaluate(o => (window).__ll.app.newGame({ ruler: 'Luke', realm: 'Mudlark Hollow', mode: 'peace', seed: 4242, ...o }), o); await page.waitForTimeout(1200); },
  days: async n => { await page.evaluate(n => { const ll = (window).__ll; const s = ll.sim ?? ll.app?.sim?.(); s.advanceDays(n); }, n); await page.waitForTimeout(700); },
  act: a => page.evaluate(a => { const ll = (window).__ll; const s = ll.sim ?? ll.app?.sim?.(); return s.dispatch(a); }, a),
  state: fn => page.evaluate(new Function('return (' + fn.toString() + ')((window.__ll.sim ?? window.__ll.app.sim()).state)')),
  click: sel => page.click(sel, { timeout: 8000 }),
  clickAt: (x, y) => page.mouse.click(x, y),
  key: k => page.keyboard.press(k),
  type: (sel, text) => page.fill(sel, text),
};
try { await steps(page, t); }
catch (e) { console.log('[play] steps threw: ' + (e && e.stack || e)); }
console.log(`[play] done. ${errors.length} error(s).`);
await browser.close();
rmSync(tmp, { recursive: true, force: true });
