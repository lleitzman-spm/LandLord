#!/usr/bin/env node
// Bundle a TS entry into a throwaway page and screenshot it in headless
// Chromium with software WebGL.  Serialized with a lock (the box has 2 cores).
//   node tools/shot.mjs src/dev/gallery.ts out.png [--w 1280] [--h 800] [--wait 1500]
//        [--eval "window.__dev.setTime(0.5)"] [--shots 3 --every 700] [--css "body{...}"]
// The entry gets a full-window <div id="app"> and <canvas id="c">.  Console
// errors are printed.  With --shots N it writes out-1.png ... out-N.png.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const root = new URL('..', import.meta.url).pathname;
const args = process.argv.slice(2);
const entry = args[0], out = args[1];
if (!entry || !out) { console.error('usage: shot.mjs <entry.ts> <out.png> [opts]'); process.exit(2); }
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const W = +opt('w', 1280), H = +opt('h', 800), WAIT = +opt('wait', 1500);
const SHOTS = +opt('shots', 1), EVERY = +opt('every', 600), EVAL = opt('eval', ''), CSS = opt('css', '');
const HTML = opt('html', '');
const tmp = path.join(root, '.tmp', 'shot-' + process.pid);
mkdirSync(tmp, { recursive: true });
await build({ entryPoints: [path.resolve(root, entry)], bundle: true, format: 'iife', outfile: path.join(tmp, 'bundle.js'), sourcemap: 'inline', logLevel: 'error', define: { 'process.env.NODE_ENV': '"development"' } });
const page0 = HTML && existsSync(path.resolve(root, HTML))
  ? `<!doctype html><meta charset="utf8"><body>` + (await import('node:fs')).readFileSync(path.resolve(root, HTML), 'utf8').replace(/<script src="game\.js"><\/script>/, '') + `<script src="bundle.js"></script>`
  : `<!doctype html><meta charset="utf8"><style>html,body{margin:0;height:100%;background:#0d0a08;overflow:hidden}#app{position:fixed;inset:0}canvas#c{width:100%;height:100%;display:block}${CSS}</style><body><div id="app"><canvas id="c"></canvas></div><script src="bundle.js"></script>`;
writeFileSync(path.join(tmp, 'index.html'), page0);
// take the lock for the browser part only
const lock = '/tmp/landlord-shot.lock';
const runner = path.join(tmp, 'run.cjs');
writeFileSync(runner, `
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl','--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: ${W}, height: ${H} }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console.' + m.type() + '] ' + m.text().slice(0, 600)); });
  page.on('pageerror', e => console.log('[pageerror] ' + String(e && e.stack || e).slice(0, 900)));
  await page.goto('file://' + ${JSON.stringify(path.join(tmp, 'index.html'))});
  await page.waitForTimeout(${WAIT});
  ${EVAL ? `try { const r = await page.evaluate(${JSON.stringify(EVAL)}); if (r !== undefined) console.log('[eval] ' + JSON.stringify(r)); } catch (e) { console.log('[eval error] ' + e.message); } await page.waitForTimeout(400);` : ''}
  const out = ${JSON.stringify(path.resolve(root, out))};
  for (let i = 1; i <= ${SHOTS}; i++) {
    const f = ${SHOTS} > 1 ? out.replace(/\\.png$/, '-' + i + '.png') : out;
    await page.screenshot({ path: f });
    console.log('wrote ' + f);
    if (i < ${SHOTS}) await page.waitForTimeout(${EVERY});
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
`);
try { execSync(`flock ${lock} node ${runner}`, { stdio: 'inherit', timeout: 180000 }); }
finally { execSync(`rm -rf ${tmp}`); }
