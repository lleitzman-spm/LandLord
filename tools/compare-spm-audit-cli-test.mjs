#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJson } from './compare-spm-audit.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const consumer = fileURLToPath(new URL('./compare-spm-audit.mjs', import.meta.url));
const scratch = mkdtempSync(resolve(tmpdir(), 'landlord-producer-proof-'));
const producer = resolve(scratch, 'producer');
execFileSync('git', ['init', producer]);
execFileSync('git', ['config', 'user.email', 'fixture@example.invalid'], { cwd: producer });
execFileSync('git', ['config', 'user.name', 'Audit Fixture'], { cwd: producer });
const artifactBytes = Buffer.from('{"schema":"producer-fixture/v1"}\n');
writeFileSync(resolve(producer, 'artifact.json'), artifactBytes);
execFileSync('git', ['add', '--', 'artifact.json'], { cwd: producer });
execFileSync('git', ['commit', '-m', 'fixture'], { cwd: producer });
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: producer, encoding: 'utf8' }).trim();

const place = {
  id: 'p-0001',
  taskFamily: 'maintenance-work-order',
  abstractCapability: 'observe-state',
  modeClaim: 'unresolved',
  structuralKind: 'read',
  guardSlots: ['entry', 'exit'],
};
const payload = {
  schema: 'spm-landlord-audit-projection/v1',
  purpose: 'offline-comparison-only',
  applied: false,
  producer: {
    repository: 'SPM-Optimization',
    commit,
    inputArtifactSha256: createHash('sha256').update(artifactBytes).digest('hex'),
  },
  policy: {
    execution: 'forbidden',
    network: 'forbidden',
    operationalData: 'forbidden',
    guardContent: 'withheld',
    permittedContent: 'hashed-topology-and-abstract-capabilities-only',
  },
  processFamily: 'maintenance-work-order',
  lanes: {
    G1: { places: [place], transitions: [] },
    G2: { status: 'comparison-not-observed', places: [], transitions: [] },
    G3: { places: [place], transitions: [] },
  },
  attestation: { producerProvenanceValidated: true, digestMethod: 'sha256-canonical-json' },
};
payload.attestation.canonicalJsonSha256 = createHash('sha256').update(canonicalJson(payload)).digest('hex');
const projection = resolve(scratch, 'projection.json');
writeFileSync(projection, JSON.stringify(payload));

const baseArgs = [
  consumer,
  '--projection', projection,
  '--expected-producer-commit', commit,
  '--producer-repo', producer,
  '--producer-artifact', 'artifact.json',
];
const compared = spawnSync(process.execPath, baseArgs, { cwd: root, encoding: 'utf8' });
assert.equal(compared.status, 0, compared.stderr);
const result = JSON.parse(compared.stdout.trim().split(/\r?\n/).at(-1));
const report = JSON.parse(readFileSync(result.outputPath, 'utf8'));
assert.equal(report.verification.producerArtifactVerified, true);
assert.equal(report.verification.producerCommit, commit);
assert.match(report.verification.operatorBundleDigest, /^[0-9a-f]{64}$/);

const customBundle = spawnSync(process.execPath, [...baseArgs, '--bundle', projection], { cwd: root, encoding: 'utf8' });
assert.equal(customBundle.status, 4);

const mismatch = spawnSync(process.execPath, baseArgs.map((value) => value === commit ? 'f'.repeat(40) : value), { cwd: root, encoding: 'utf8' });
assert.equal(mismatch.status, 5);

console.log('compare-spm-audit-cli: ok');
