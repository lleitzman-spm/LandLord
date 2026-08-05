const { chromium } = (await import('/home/user/landlord/node_modules/playwright-core/index.js')).default;
const B = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
  proxy: { server: process.env.HTTPS_PROXY ?? 'http://127.0.0.1:1', bypass: 'localhost,127.0.0.1' } });
for (const mode of ['3d','sprite']) {
  const page = await B.newPage({ viewport: { width: 1400, height: 860 } });
  const errs=[]; page.on('pageerror',e=>errs.push(String(e))); page.on('console',m=>m.type()==='error'&&errs.push(m.text()));
  await page.goto(`http://localhost:5300/?mode=${mode}`, { waitUntil: 'load' });
  try { await page.waitForFunction(() => document.body.dataset.ready, null, { timeout: 90000 }); }
  catch { console.log(mode, 'TIMEOUT waiting for ready'); }
  const state = await page.evaluate(() => ({ ready: document.body.dataset.ready, label: document.getElementById('label').textContent }));
  await page.screenshot({ path: `tools/artprobe/art-${mode}.png` });
  console.log(mode, JSON.stringify(state), 'errors:', errs.slice(0,3));
  await page.close();
}
await B.close();
