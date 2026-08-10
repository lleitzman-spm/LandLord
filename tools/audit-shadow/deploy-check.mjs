import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const configPath = path.join(root, 'wrangler.audit-shadow.jsonc');
const sourcePath = path.join(root, 'src', 'audit-shadow-worker.ts');
const kvProofPath = path.join(root, 'tools', 'audit-shadow', 'deploy-kv-proof.ps1');

const config = JSON.parse(await readFile(configPath, 'utf8'));
const allowedKeys = [
  'compatibility_date',
  'main',
  'name',
  'preview_urls',
  'workers_dev',
];

assert.deepEqual(Object.keys(config).sort(), allowedKeys, 'config gained an unreviewed key');
assert.match(config.name, /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/);
assert.equal(config.name, 'landlord-audit-shadow-20260809-v1');
assert.equal(config.main, './src/audit-shadow-worker.ts');
assert.equal(config.workers_dev, true);
assert.equal(config.preview_urls, false);

const source = await readFile(sourcePath, 'utf8');
for (const forbidden of [
  'SUPABASE',
  'MOONSHOT',
  'POLICY_AUD',
  'TEAM_DOMAIN',
  'CANONICAL_CAPABILITY',
  'SOVEREIGN',
]) {
  assert.equal(source.includes(forbidden), false, `worker mentions forbidden seam: ${forbidden}`);
}

const moduleUrl = `${pathToFileURL(sourcePath).href}?check=${Date.now()}`;
const { AUDIT_SHADOW_PROOF, createAuditShadowWorker } = await import(moduleUrl);
const worker = createAuditShadowWorker();
const proof = await worker.fetch(new Request('https://probe.invalid/proof'));
assert.equal(proof.status, 200);
assert.deepEqual(await proof.json(), AUDIT_SHADOW_PROOF);
assert.equal(AUDIT_SHADOW_PROOF.provenance, 'SIMULATION');
assert.equal(AUDIT_SHADOW_PROOF.applied, false);
assert.equal(AUDIT_SHADOW_PROOF.bindings, 0);
assert.equal(AUDIT_SHADOW_PROOF.sourceCommit, 'local-unpinned');
assert.equal(AUDIT_SHADOW_PROOF.sourceTree, 'local-unpinned');
assert.equal(AUDIT_SHADOW_PROOF.deploymentExternalState, 'worker-script-only');
assert.equal(AUDIT_SHADOW_PROOF.operationalExternalEffects, 'none');

const refusal = await worker.fetch(
  new Request('https://probe.invalid/proof', { method: 'PUT', body: '{}' }),
);
assert.equal(refusal.status, 405);
assert.equal(await refusal.text(), '');

const kvProof = await readFile(kvProofPath, 'utf8');
assert.match(
  kvProof,
  /Invoke-Wrangler kv key delete \$key --namespace-id \$namespaceId --remote --config \$workerConfig \| Out-Null/,
  'the opaque proof key must be deleted explicitly',
);
assert.doesNotMatch(
  kvProof,
  /kv key delete[^\r\n]*--force/,
  'Wrangler 4.97.0 rejects --force for kv key delete',
);
assert.match(
  kvProof,
  /kv namespace delete --namespace-id \$namespaceId --skip-confirmation --config \$workerConfig/,
  'the isolated namespace must be deleted by returned id in finally',
);
const finallyOffset = kvProof.indexOf('finally {');
const namespaceDeleteOffset = kvProof.indexOf('kv namespace delete --namespace-id $namespaceId');
assert(finallyOffset >= 0 && namespaceDeleteOffset > finallyOffset, 'namespace deletion must remain inside finally');

console.log(JSON.stringify({
  ok: true,
  worker: config.name,
  reachability: 'workers.dev-only',
  previewUrls: false,
  bindings: 0,
  proof: AUDIT_SHADOW_PROOF,
}));
