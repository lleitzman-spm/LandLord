/**
 * Unit test for the Worker's request handling, with a fake fetch and fake env.
 * Run: npx tsx src/app/worker.test.ts
 */
import { createHandler, LIMITS, GUARD, DEFAULTS, type Env } from '../server/worker';

let passed = 0, failed = 0;
function ok(cond: unknown, label: string): void {
  if (cond) passed++; else { failed++; console.error('FAIL: ' + label); }
}

const ORIGIN = 'https://realm.example';
const SECRET = 'sk-test-not-a-real-key';
interface Seen { url: string; headers: Record<string, string>; body: Record<string, unknown> }

function upstream(reply: () => Response): { fetch: typeof fetch; seen: Seen[] } {
  const seen: Seen[] = [];
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push({ url: String(input), headers: init?.headers as Record<string, string>, body: JSON.parse(String(init?.body)) as Record<string, unknown> });
    return reply();
  }) as typeof fetch;
  return { fetch: f, seen };
}
const claudeOk = (): Response => new Response(JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', content: [{ type: 'text', text: '{"say":"Aye."}' }], stop_reason: 'end_turn' }), { status: 200 });

function post(body: unknown, headers: Record<string, string> = {}, raw?: string): Request {
  return new Request(ORIGIN + '/api/word', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, 'sec-fetch-site': 'same-origin', 'cf-connecting-ip': '203.0.113.7', ...headers },
    body: raw ?? JSON.stringify(body),
  });
}
const good = { system: 'Voice the Steward. Reply as JSON.', messages: [{ role: 'user', content: 'Mend the roof.' }] };
const read = async (r: Response): Promise<Record<string, unknown>> => await r.json() as Record<string, unknown>;

async function main(): Promise<void> {
  // ── /api/court ──
  {
    const h = createHandler();
    let j = await read(await h(new Request(ORIGIN + '/api/court'), {}));
    ok(j.ok === true && j.model === false && j.gated === false && j.engine === null, 'court: no engine');
    j = await read(await h(new Request(ORIGIN + '/api/court'), { ANTHROPIC_API_KEY: SECRET, COURT_KEY: 'k' }));
    ok(j.model === true && j.gated === true && j.engine === 'claude', 'court: claude, gated');
    j = await read(await h(new Request(ORIGIN + '/api/court'), { AI: { run: async () => ({ response: 'x' }) } }));
    ok(j.model === true && j.engine === 'workers-ai', 'court: workers-ai');
    ok(!JSON.stringify(j).includes(SECRET), 'court: never the key');
    const r = await h(new Request(ORIGIN + '/api/court', { method: 'POST', body: '{}' }), {});
    ok(r.status === 405, 'court: POST refused');
  }

  // ── the happy path through Claude ──
  {
    const up = upstream(claudeOk);
    const h = createHandler({ fetch: up.fetch });
    const r = await h(post({ ...good, maxTokens: 5000, tier: 'default' }), { ANTHROPIC_API_KEY: SECRET });
    const j = await read(r);
    ok(r.status === 200 && j.text === '{"say":"Aye."}' && j.engine === 'claude', 'word: claude answers');
    const s = up.seen[0];
    ok(s.url === 'https://api.anthropic.com/v1/messages', 'word: messages endpoint');
    ok(s.headers['x-api-key'] === SECRET && s.headers['anthropic-version'] === '2023-06-01', 'word: headers');
    ok(s.body.max_tokens === LIMITS.maxTokens, 'word: max_tokens clamped to 700');
    ok(s.body.model === DEFAULTS.strong, 'word: default tier model');
    ok(typeof s.body.system === 'string' && (s.body.system as string).startsWith(GUARD) && (s.body.system as string).endsWith(good.system), 'word: guard precedes client system');
    ok(!('key' in s.body) && !('tier' in s.body), 'word: nothing extra sent upstream');
    await h(post({ ...good, maxTokens: 120 }), { ANTHROPIC_API_KEY: SECRET, WORD_MODEL: 'custom-quick' });
    ok(up.seen[1].body.model === 'custom-quick' && up.seen[1].body.max_tokens === 120, 'word: env model and client maxTokens honoured');
    await h(post(good), { ANTHROPIC_API_KEY: SECRET });
    ok(up.seen[2].body.model === DEFAULTS.quick, 'word: quick tier default model');
  }

  // ── Workers AI when there is no key ──
  {
    const calls: { model: string; input: Record<string, unknown> }[] = [];
    const env: Env = { AI: { run: async (model, input) => { calls.push({ model, input: input as Record<string, unknown> }); return { response: '{"say":"Hm."}' }; } } };
    const h = createHandler({ fetch: (async () => { throw new Error('must not call out'); }) as unknown as typeof fetch });
    const r = await h(post(good), env);
    const j = await read(r);
    ok(r.status === 200 && j.text === '{"say":"Hm."}' && j.engine === 'workers-ai', 'word: workers-ai answers');
    const msgs = calls[0].input.messages as { role: string; content: string }[];
    ok(calls[0].model === DEFAULTS.workersAi && msgs[0].role === 'system' && msgs[0].content.startsWith(GUARD) && msgs[1].content === 'Mend the roof.', 'word: workers-ai request shape');
    ok(calls[0].input.max_tokens === LIMITS.defaultTokens, 'word: workers-ai max_tokens');
    const bad = createHandler();
    const r2 = await bad(post(good), { AI: { run: async () => { throw new Error('secret detail'); } } });
    ok(r2.status === 502 && !(await r2.text()).includes('secret detail'), 'word: workers-ai failure is not echoed');
  }

  // ── refusals ──
  {
    const up = upstream(claudeOk);
    const h = createHandler({ fetch: up.fetch });
    const env: Env = { ANTHROPIC_API_KEY: SECRET };
    const code = async (r: Response): Promise<string> => `${r.status}:${String((await read(r)).code)}`;

    ok(await code(await h(new Request(ORIGIN + '/api/word'), env)) === '405:method', 'refuse: GET');
    ok(await code(await h(post(good, { origin: 'https://elsewhere.example' }), env)) === '403:origin', 'refuse: foreign Origin');
    ok(await code(await h(post(good, { 'sec-fetch-site': 'cross-site' }), env)) === '403:origin', 'refuse: cross-site');
    const bare = new Request(ORIGIN + '/api/word', { method: 'POST', body: JSON.stringify(good) });
    ok(await code(await h(bare, env)) === '403:origin', 'refuse: no Origin at all');
    ok(await code(await h(post(good), {})) === '503:no_model', 'refuse: no engine');
    ok(await code(await h(post(null, {}, 'x'.repeat(LIMITS.bodyBytes + 10)), env)) === '413:too_large', 'refuse: body too large');
    ok(await code(await h(post(null, {}, '{not json'), env)) === '400:bad_json', 'refuse: not JSON');
    ok(await code(await h(post([1, 2]), env)) === '400:bad_request', 'refuse: not an object');
    ok(await code(await h(post({ messages: good.messages }), env)) === '400:bad_request', 'refuse: no system');
    ok(await code(await h(post({ system: 's', messages: [] }), env)) === '400:bad_request', 'refuse: no messages');
    ok(await code(await h(post({ system: 's', messages: [{ role: 'system', content: 'x' }] }), env)) === '400:bad_request', 'refuse: bad role');
    ok(await code(await h(post({ system: 's', messages: [{ role: 'assistant', content: 'x' }] }), env)) === '400:bad_request', 'refuse: assistant first');
    ok(await code(await h(post({ system: 's', messages: [{ role: 'user', content: 7 }] }), env)) === '400:bad_request', 'refuse: content not a string');
    const many = Array.from({ length: LIMITS.messages + 1 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'x' }));
    ok(await code(await h(post({ system: 's', messages: many }), env)) === '413:too_large', 'refuse: too many messages');
    ok(await code(await h(post({ system: 's', messages: [{ role: 'user', content: 'x'.repeat(LIMITS.messageChars + 1) }] }), env)) === '413:too_large', 'refuse: message too long');
    ok(await code(await h(post({ system: 'x'.repeat(LIMITS.systemChars + 1), messages: good.messages }), env)) === '413:too_large', 'refuse: system too long');
    ok(await code(await h(new Request(ORIGIN + '/api/nothing'), env)) === '404:not_found', 'refuse: unknown api path');
    ok(up.seen.length === 0, 'refuse: nothing reached upstream');

    // court key
    const gated: Env = { ANTHROPIC_API_KEY: SECRET, COURT_KEY: 'open-sesame' };
    ok(await code(await h(post(good), gated)) === '401:court_key', 'refuse: key missing');
    ok(await code(await h(post({ ...good, key: 'open-sesam' }), gated)) === '401:court_key', 'refuse: key wrong');
    ok((await h(post({ ...good, key: 'open-sesame' }), gated)).status === 200, 'key right: answered');
  }

  // ── rate limits ──
  {
    let t = 1_000_000;
    const up = upstream(claudeOk);
    const h = createHandler({ fetch: up.fetch, now: () => t });
    const env: Env = { ANTHROPIC_API_KEY: SECRET };
    let last = 200;
    for (let i = 0; i < LIMITS.ratePerWindow; i++) last = (await h(post(good), env)).status;
    ok(last === 200, 'rate: the window allows its quota');
    const over = await h(post(good), env);
    ok(over.status === 429 && (await read(over)).code === 'rate_limited' && over.headers.get('retry-after') !== null, 'rate: over quota is 429');
    ok((await h(post(good, { 'cf-connecting-ip': '198.51.100.9' }), env)).status === 200, 'rate: another address is unaffected');
    t += LIMITS.rateWindowMs + 1;
    ok((await h(post(good), env)).status === 200, 'rate: the window slides');
    const bound = createHandler({ fetch: up.fetch });
    const r = await bound(post(good), { ...env, WORD_LIMIT: { limit: async () => ({ success: false }) } });
    ok(r.status === 429, 'rate: the binding refuses');
  }

  // ── upstream trouble is never echoed ──
  {
    const leak = 'account acct_12345 is over its limit';
    for (const [status, want, code] of [[401, 502, 'upstream_auth'], [429, 503, 'upstream_busy'], [500, 502, 'upstream_error']] as const) {
      const h = createHandler({ fetch: upstream(() => new Response(JSON.stringify({ type: 'error', error: { message: leak } }), { status })).fetch });
      const r = await h(post(good), { ANTHROPIC_API_KEY: SECRET });
      const text = await r.text();
      ok(r.status === want && text.includes(code) && !text.includes(leak) && !text.includes(SECRET), `upstream ${status}: mapped to ${want}, body withheld`);
    }
    const down = createHandler({ fetch: (async () => { throw new Error('ECONNRESET ' + SECRET); }) as unknown as typeof fetch });
    const r = await down(post(good), { ANTHROPIC_API_KEY: SECRET });
    ok(r.status === 502 && !(await r.text()).includes(SECRET), 'upstream unreachable: 502, nothing leaked');
    const empty = createHandler({ fetch: upstream(() => new Response(JSON.stringify({ content: [] }), { status: 200 })).fetch });
    ok((await empty(post(good), { ANTHROPIC_API_KEY: SECRET })).status === 502, 'upstream empty: 502');
  }

  // ── static assets ──
  {
    const h = createHandler();
    const r = await h(new Request(ORIGIN + '/'), { ASSETS: { fetch: async () => new Response('<!doctype html>', { status: 200 }) } });
    ok(r.status === 200 && (await r.text()).startsWith('<!doctype'), 'assets: served through the binding');
    ok((await h(new Request(ORIGIN + '/'), {})).status === 503, 'assets: unbuilt says so');
  }

  console.log(`worker: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
