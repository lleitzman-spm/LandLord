import assert from 'node:assert/strict';

const [url] = process.argv.slice(2);
assert(url, 'usage: node tools/audit-shadow/deploy-verify.mjs <workers.dev-url>');

const target = new URL('/proof', url);
assert.equal(target.protocol, 'https:', 'proof must use HTTPS');
assert.equal(target.hostname.endsWith('.workers.dev'), true, 'proof must stay on workers.dev');
assert.equal(
  target.hostname.startsWith('landlord-audit-shadow-20260809-v1.'),
  true,
  'proof must use the fixed isolated Worker name',
);

const response = await fetch(target, {
  method: 'GET',
  redirect: 'error',
  headers: { accept: 'application/json' },
});
assert.equal(response.status, 200);
assert.equal(response.headers.get('cache-control'), 'no-store');
assert.match(response.headers.get('content-type') ?? '', /^application\/json\b/);
assert.deepEqual(await response.json(), {
  schema: 'audit-activation-proof/v1',
  provenance: 'SIMULATION',
  purpose: 'isolated-static-deployment-proof',
  applied: false,
  bindings: 0,
  externalState: 'none',
});

const write = await fetch(target, {
  method: 'POST',
  redirect: 'error',
  body: '{}',
});
assert.equal(write.status, 405);
assert.equal(await write.text(), '');

console.log(JSON.stringify({ ok: true, target: target.href, applied: false }));
