const { chromium } = (await import('/home/user/landlord/node_modules/playwright-core/index.js')).default;

const W = Number(process.argv[2] ?? 1440);
const H = Number(process.argv[3] ?? 900);
const OUT = process.argv[4] ?? 'layout.png';

const B = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  proxy: { server: process.env.HTTPS_PROXY ?? 'http://127.0.0.1:1', bypass: 'localhost,127.0.0.1' },
});
const page = await B.newPage({ viewport: { width: W, height: H } });
page.on('dialog', (d) => d.accept());
await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
const enter = page.locator('.wt-onb-enter');
if (await enter.count()) await enter.first().click();
await page.waitForTimeout(400);

// Begin the campaign so the board is populated the way Edwin saw it.
// Deal the campaign. The horn lives on the War Games surface now (the
// persistent footer that used to hold it is gone), so we go there by key.
await page.keyboard.press('g');
await page.keyboard.press('w');
await page.waitForTimeout(500);
const begin = page.locator('button:has-text("Begin the campaign")');
if (await begin.count()) { await begin.first().click(); await page.waitForTimeout(2500); }
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

const r = await page.evaluate(() => {
  const R = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
  };
  const vw = innerWidth, vh = innerHeight;
  const pct = (n) => Math.round((n / (vw * vh)) * 100);

  const regions = {};
  for (const [k, sel] of Object.entries({
    root: '.wt-root',
    ribbon: '.wt-ribbon',
    rail: 'nav[aria-label="The realm\'s surfaces"]',
    board: '.wt-board',
    aside: '.wt-advisor',
    footer: '.wt-foot, footer',
    map: '.fm-root',
  })) {
    const el = document.querySelector(sel);
    regions[k] = el ? { ...R(el), pctOfScreen: pct(el.getBoundingClientRect().width * el.getBoundingClientRect().height) } : null;
  }

  // Does the council aside overflow / is it scrolled?
  const aside = document.querySelector('.wt-advisor');
  const asideInfo = aside
    ? {
        clientH: aside.clientHeight,
        scrollH: aside.scrollHeight,
        overflowing: aside.scrollHeight > aside.clientHeight + 2,
        hiddenPx: Math.max(0, aside.scrollHeight - aside.clientHeight),
        cards: [...aside.querySelectorAll('.wt-scrap')].map((c) => ({
          head: c.querySelector('.wt-sh')?.innerText.replace(/\s+/g, ' ').trim().slice(0, 70),
          h: Math.round(c.getBoundingClientRect().height),
          words: (c.innerText.match(/\S+/g) || []).length,
          belowFold: c.getBoundingClientRect().top > aside.getBoundingClientRect().bottom - 20,
        })),
      }
    : null;

  // Every interactive control: where it is, how big, what it says.
  const controls = [...document.querySelectorAll('button, a[href], input, select, [role="button"]')]
    .filter((e) => {
      const b = e.getBoundingClientRect();
      return b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < vh;
    })
    .map((e) => {
      const b = e.getBoundingClientRect();
      // Which region does it sit in?
      const here = (sel) => document.querySelector(sel)?.contains(e);
      const zone = here('.wt-ribbon') ? 'ribbon'
        : here('nav[aria-label="The realm\'s surfaces"]') ? 'rail'
        : here('.wt-advisor') ? 'aside'
        : here('.fm-root') ? 'map'
        : here('footer') ? 'footer'
        : 'other';
      return {
        zone,
        label: (e.innerText || e.getAttribute('aria-label') || e.placeholder || e.value || '').replace(/\s+/g, ' ').trim().slice(0, 44),
        x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height),
        tiny: b.height < 30 || b.width < 30,
      };
    });

  // How much of the map's own area is actually drawn on vs. empty ground?
  const svg = document.querySelector('svg.fm-frame');
  const pieces = svg ? [...svg.querySelectorAll('.fm-piece, .fm-survey')].length : 0;

  return {
    viewport: { vw, vh },
    regions,
    aside: asideInfo,
    controlCount: controls.length,
    byZone: controls.reduce((a, c) => ((a[c.zone] = (a[c.zone] || 0) + 1), a), {}),
    controls,
    mapPieces: pieces,
    bodyScrolls: document.documentElement.scrollHeight > vh + 2,
  };
});
console.log(JSON.stringify(r, null, 2));
await page.screenshot({ path: OUT });
await B.close();
