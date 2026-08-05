// A stand-in vault for session containers, where supabase.co is unreachable
// from the shell. It speaks exactly the slice of PostgREST the keyholders
// use — the chronicle read/upsert and the border book's fold-and-absorb —
// so the dev-server→vault path can be exercised end-to-end in a browser.
//
// Use: `node tools/mock-vault.mjs`, then point .env at it:
//   SUPABASE_URL=http://127.0.0.1:5998
//   SUPABASE_SECRET_KEY=sb_secret_mock
// GET /__state shows the whole state for assertions. The doc seeds from the
// repo ledger; one unabsorbed border row waits at the border so the fold
// has something to prove. Remove .env when done — never leave a mock key
// where a real one belongs.
import http from 'node:http';
import { readFileSync } from 'node:fs';

const ledger = new URL('../data/chronicle.json', import.meta.url);
const state = {
  doc: JSON.parse(readFileSync(ledger, 'utf8')),
  border: [
    {
      id: '7c9a52c6-1f7e-4b7a-9a44-3f2f8a3d9b01',
      title: "Two rooftop bids from Sterling's crew",
      note: 'dropped by the mock producer',
      arrived_on: '2026-07-18',
      logged_at: '2026-07-18T10:00:00Z',
      absorbed_at: null,
    },
  ],
  log: [],
};

const body = (req) =>
  new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => resolve(b));
  });

http
  .createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    state.log.push(`${req.method} ${req.url}`);
    const json = (obj, code = 200) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(obj));
    };
    if (u.pathname === '/__state') return json(state);
    if (u.pathname === '/rest/v1/chronicle' && req.method === 'GET')
      return json({ doc: state.doc });
    if (u.pathname === '/rest/v1/chronicle' && req.method === 'POST') {
      state.doc = JSON.parse(await body(req))[0].doc;
      return json([], 201);
    }
    if (u.pathname === '/rest/v1/border_arrivals' && req.method === 'GET')
      return json(
        state.border
          .filter((r) => r.absorbed_at === null)
          .map(({ id, title, note, arrived_on }) => ({ id, title, note, arrived_on })),
      );
    if (u.pathname === '/rest/v1/border_arrivals' && req.method === 'PATCH') {
      const m = /^in\.\((.*)\)$/.exec(u.searchParams.get('id') ?? '');
      const ids = new Set(m ? m[1].split(',') : []);
      const { absorbed_at } = JSON.parse(await body(req));
      for (const r of state.border)
        if (r.absorbed_at === null && ids.has(r.id)) r.absorbed_at = absorbed_at;
      res.writeHead(204).end();
      return;
    }
    json({ error: 'unexpected request' }, 404);
  })
  .listen(5998, '127.0.0.1', () => console.log('mock vault on 5998'));
