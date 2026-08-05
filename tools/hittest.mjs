const { chromium } = (await import('/home/user/landlord/node_modules/playwright-core/index.js')).default;

const W = Number(process.argv[2] ?? 1366);
const H = Number(process.argv[3] ?? 768);

const B = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  proxy: { server: process.env.HTTPS_PROXY ?? 'http://127.0.0.1:1', bypass: 'localhost,127.0.0.1' },
});
const page = await B.newPage({ viewport: { width: W, height: H } });
page.on('dialog', (d) => d.accept());
const errs = [];
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
const enter = page.locator('.wt-onb-enter');
if (await enter.count()) await enter.first().click();
await page.waitForTimeout(300);
// Deal the campaign. The horn lives on the War Games surface now (the
// persistent footer that used to hold it is gone), so we go there by key.
await page.keyboard.press('g');
await page.keyboard.press('w');
await page.waitForTimeout(500);
const begin = page.locator('button:has-text("Begin the campaign")');
if (await begin.count()) { await begin.first().click(); await page.waitForTimeout(2500); }
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// Every control on screen: is its own centre point reachable?
const r = await page.evaluate(() => {
  const zoneOf = (e) => {
    const H = (s) => document.querySelector(s)?.contains(e);
    return H('.wt-ribbon') ? 'ribbon'
      : H('nav[aria-label="The realm\'s surfaces"]') ? 'rail'
      : H('.wt-advisor') ? 'aside'
      : H('.fm-root') ? 'map'
      : H('footer') ? 'footer' : 'other';
  };
  const out = [];
  for (const e of document.querySelectorAll('button, a[href], input, [role="button"]')) {
    const b = e.getBoundingClientRect();
    if (!b.width || !b.height) continue;
    const onScreen = b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth;
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    const top = document.elementFromPoint(cx, cy);
    const ok = top && (e === top || e.contains(top) || top.contains(e));
    out.push({
      zone: zoneOf(e),
      label: (e.innerText || e.getAttribute('aria-label') || e.value || '').replace(/\s+/g, ' ').trim().slice(0, 38),
      onScreen,
      reachable: !!ok,
      blockedBy: ok ? null : (top?.className || top?.tagName || '?'),
    });
  }
  const aside = document.querySelector('.wt-advisor');
  return {
    controls: out,
    aside: aside ? {
      box: Math.round(aside.getBoundingClientRect().height),
      content: aside.scrollHeight,
      scrollsInside: aside.scrollHeight > aside.clientHeight + 2,
      bottom: Math.round(aside.getBoundingClientRect().bottom),
    } : null,
    footerTop: Math.round(document.querySelector('footer')?.getBoundingClientRect().top ?? -1),
  };
});

const bad = r.controls.filter((c) => c.onScreen && !c.reachable);
console.log(JSON.stringify({
  viewport: `${W}x${H}`,
  total: r.controls.length,
  onScreen: r.controls.filter((c) => c.onScreen).length,
  blocked: bad,
  aside: r.aside,
  footerTop: r.footerTop,
  asideSpillsOverFooter: r.aside ? r.aside.bottom > r.footerTop : null,
  consoleErrors: errs,
}, null, 2));
await page.screenshot({ path: process.argv[4] ?? `hit-${W}.png` });
await B.close();
