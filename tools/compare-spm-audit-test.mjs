#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { canonicalJson, compareProjection, validateProjection } from './compare-spm-audit.mjs';

const commit = 'a'.repeat(40);
const payload = {
  schema: 'spm-landlord-audit-projection/v1',
  purpose: 'offline-comparison-only',
  applied: false,
  producer: { repository: 'SPM-Optimization', commit, inputArtifactSha256: 'b'.repeat(64) },
  policy: { execution: 'forbidden', network: 'forbidden', operationalData: 'forbidden', guardContent: 'withheld' },
  processFamily: 'maintenance-work-order',
  lanes: {
    G1: { places: [{ id: 'p-a', structuralKind: 'read', modeClaim: 'unresolved' }], transitions: [] },
    G2: { status: 'comparison-not-observed', places: [], transitions: [] },
    G3: { places: [{ id: 'p-a', structuralKind: 'read', modeClaim: 'unresolved' }], transitions: [] },
  },
  attestation: { producerProvenanceValidated: true, digestMethod: 'sha256-canonical-json' },
};
payload.attestation.canonicalJsonSha256 = createHash('sha256').update(canonicalJson(payload)).digest('hex');

assert.equal(validateProjection(payload, commit), payload);
const report = compareProjection(payload, { key: 'vendor-dispatch', version: '1', steps: [{}] });
assert.equal(report.applied, false);
assert.equal(report.verdict, 'comparison-gaps-present');
assert.deepEqual(report.gaps, ['g2-not-observed']);

const leaked = structuredClone(payload);
leaked.notes = ['123 Main Street'];
delete leaked.attestation.canonicalJsonSha256;
leaked.attestation.canonicalJsonSha256 = createHash('sha256').update(canonicalJson(leaked)).digest('hex');
assert.throws(() => validateProjection(leaked, commit), /forbidden field/);
assert.throws(() => validateProjection(payload, 'c'.repeat(40)), /pinned snapshot mismatch/);

console.log('compare-spm-audit: ok');
