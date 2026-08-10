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
  policy: { execution: 'forbidden', network: 'forbidden', operationalData: 'forbidden', guardContent: 'withheld', permittedContent: 'hashed-topology-and-abstract-capabilities-only' },
  processFamily: 'maintenance-work-order',
  lanes: {
    G1: { places: [{ id: 'p-0001', taskFamily: 'maintenance-work-order', abstractCapability: 'observe-state', structuralKind: 'read', modeClaim: 'unresolved', guardSlots: ['entry', 'exit'] }], transitions: [] },
    G2: { status: 'comparison-not-observed', places: [], transitions: [] },
    G3: { places: [{ id: 'p-0001', taskFamily: 'maintenance-work-order', abstractCapability: 'observe-state', structuralKind: 'read', modeClaim: 'unresolved', guardSlots: ['entry', 'exit'] }], transitions: [] },
  },
  attestation: { producerProvenanceValidated: true, digestMethod: 'sha256-canonical-json' },
};
payload.attestation.canonicalJsonSha256 = createHash('sha256').update(canonicalJson(payload)).digest('hex');

assert.equal(validateProjection(payload, commit), payload);
const report = compareProjection(payload, { key: 'vendor-dispatch', version: '1', steps: [{}] });
assert.equal(report.applied, false);
assert.equal(report.verdict, 'comparison-gaps-present');
assert.deepEqual(report.gaps, ['g2-not-observed', 'semantic-crosswalk-unproven']);

const leaked = structuredClone(payload);
leaked.notes = ['123 Main Street'];
delete leaked.attestation.canonicalJsonSha256;
leaked.attestation.canonicalJsonSha256 = createHash('sha256').update(canonicalJson(leaked)).digest('hex');
assert.throws(() => validateProjection(leaked, commit), /schema fields differ/);
const email = structuredClone(payload);
email.customerEmail = 'person@example.com';
delete email.attestation.canonicalJsonSha256;
email.attestation.canonicalJsonSha256 = createHash('sha256').update(canonicalJson(email)).digest('hex');
assert.throws(() => validateProjection(email, commit), /schema fields differ/);
const badDigest = structuredClone(payload);
badDigest.producer.inputArtifactSha256 = 'person@example.com';
delete badDigest.attestation.canonicalJsonSha256;
badDigest.attestation.canonicalJsonSha256 = createHash('sha256').update(canonicalJson(badDigest)).digest('hex');
assert.throws(() => validateProjection(badDigest, commit), /input artifact digest/);
const duplicate = structuredClone(payload);
duplicate.lanes.G3.places.push(structuredClone(duplicate.lanes.G3.places[0]));
delete duplicate.attestation.canonicalJsonSha256;
duplicate.attestation.canonicalJsonSha256 = createHash('sha256').update(canonicalJson(duplicate)).digest('hex');
assert.throws(() => validateProjection(duplicate, commit), /duplicate topology identifiers/);
assert.throws(() => validateProjection(payload, 'c'.repeat(40)), /pinned snapshot mismatch/);

console.log('compare-spm-audit: ok');
