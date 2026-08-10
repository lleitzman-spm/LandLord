#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const runner = fileURLToPath(new URL('./run-audit-shadow.mjs', import.meta.url));
const fixture = fileURLToPath(new URL('./demo-attention.json', import.meta.url));
const root = fileURLToPath(new URL('../..', import.meta.url));
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();

function run(args) {
  return spawnSync(process.execPath, [runner, ...args], { cwd: root, encoding: 'utf8' });
}

const shadow = run(['--shadow', '--commit', commit]);
assert.equal(shadow.status, 0, shadow.stderr);
const shadowLine = JSON.parse(shadow.stdout.trim().split(/\r?\n/).at(-1));
assert.equal(shadowLine.applied, false);
assert.equal(shadowLine.externalEffects, false);
const proof = JSON.parse(readFileSync(shadowLine.report, 'utf8'));
assert.match(proof.operatorBundleDigest, /^[0-9a-f]{64}$/);
assert.ok(proof.gates.every((gate) => gate.pass === true));

const act = run(['--act', '--proof', shadowLine.report, '--commit', commit]);
assert.equal(act.status, 0, act.stderr);
const actLine = JSON.parse(act.stdout.trim().split(/\r?\n/).at(-1));
const receipt = JSON.parse(readFileSync(actLine.report, 'utf8'));
assert.equal(receipt.applied, false);
assert.equal(receipt.simulated, true);
assert.equal(receipt.reversed, true);
assert.equal(receipt.externalEffects, false);

const scratch = mkdtempSync(resolve(tmpdir(), 'landlord-shadow-hostile-'));
const identityInput = JSON.parse(readFileSync(fixture, 'utf8'));
identityInput.customerEmail = 'person@example.com';
const identityPath = resolve(scratch, 'identity.json');
writeFileSync(identityPath, JSON.stringify(identityInput));
const identity = run(['--shadow', '--input', identityPath, '--commit', commit]);
assert.equal(identity.status, 3);

const tamperedProof = { ...proof, boundedCandidate: 'demo/work/forged' };
const tamperedPath = resolve(scratch, 'forged-proof.json');
writeFileSync(tamperedPath, JSON.stringify(tamperedProof));
const forged = run(['--act', '--proof', tamperedPath, '--commit', commit]);
assert.equal(forged.status, 6);

console.log('run-audit-shadow: ok');
