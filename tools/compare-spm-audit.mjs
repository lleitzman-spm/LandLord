#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SCHEMA = 'spm-landlord-audit-projection/v1';
export const PURPOSE = 'offline-comparison-only';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const EXIT = Object.freeze({ invalid: 2, forbidden: 3, boundary: 4, mismatch: 5 });

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function inside(parent, candidate) {
  const rel = relative(resolve(parent), resolve(candidate));
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

function boundaryError(message) {
  return Object.assign(new Error(message), { exitCode: EXIT.boundary });
}

function forbiddenError(message) {
  return Object.assign(new Error(message), { exitCode: EXIT.forbidden });
}

export function validateProjection(payload, expectedProducerCommit) {
  if (!payload || payload.schema !== SCHEMA || payload.purpose !== PURPOSE || payload.applied !== false) {
    throw Object.assign(new Error('invalid SPM audit projection envelope'), { exitCode: EXIT.invalid });
  }
  if (payload.producer?.repository !== 'SPM-Optimization' || !/^[0-9a-f]{40}$/.test(payload.producer?.commit || '')) {
    throw Object.assign(new Error('invalid producer provenance'), { exitCode: EXIT.invalid });
  }
  if (expectedProducerCommit && payload.producer.commit !== expectedProducerCommit) {
    throw Object.assign(new Error(`pinned snapshot mismatch: expected ${expectedProducerCommit}, found ${payload.producer.commit}`), { exitCode: EXIT.mismatch });
  }
  if (payload.policy?.execution !== 'forbidden' || payload.policy?.network !== 'forbidden' || payload.policy?.operationalData !== 'forbidden') {
    throw forbiddenError('projection policy does not forbid execution, network, and operational data');
  }
  if (payload.attestation?.producerProvenanceValidated !== true || payload.attestation?.digestMethod !== 'sha256-canonical-json') {
    throw Object.assign(new Error('producer attestation missing'), { exitCode: EXIT.invalid });
  }

  const expectedDigest = payload.attestation.canonicalJsonSha256;
  if (!/^[0-9a-f]{64}$/.test(expectedDigest || '')) {
    throw Object.assign(new Error('projection digest missing'), { exitCode: EXIT.invalid });
  }
  const unsigned = structuredClone(payload);
  delete unsigned.attestation.canonicalJsonSha256;
  if (sha256(canonicalJson(unsigned)) !== expectedDigest) {
    throw Object.assign(new Error('projection digest mismatch'), { exitCode: EXIT.invalid });
  }

  const forbiddenKeys = /^(cases?|instances?|addresses?|people|persons?|names?|actors?|values?|quotes?|notes?|sourcepaths?|credentials?|tokens?)$/i;
  const rawIdentity = /\b\d{1,6}\s+[A-Za-z0-9.'-]+\s+(street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|court|ct)\b/i;
  function visit(value, path = '$') {
    if (Array.isArray(value)) return value.forEach((item, index) => visit(item, `${path}[${index}]`));
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        if (forbiddenKeys.test(key)) throw forbiddenError(`forbidden field at ${path}.${key}`);
        visit(child, `${path}.${key}`);
      }
    } else if (typeof value === 'string' && rawIdentity.test(value)) {
      throw forbiddenError(`suspected operational identity at ${path}`);
    }
  }
  visit(payload);

  for (const lane of ['G1', 'G2', 'G3']) {
    if (!payload.lanes?.[lane] || !Array.isArray(payload.lanes[lane].places) || !Array.isArray(payload.lanes[lane].transitions)) {
      throw Object.assign(new Error(`projection lane ${lane} is incomplete`), { exitCode: EXIT.invalid });
    }
  }
  return payload;
}

function histogram(items, key) {
  return Object.fromEntries([...items.reduce((counts, item) => counts.set(item[key] || 'unresolved', (counts.get(item[key] || 'unresolved') || 0) + 1), new Map())].sort());
}

function laneReading(lane) {
  return {
    places: lane.places.length,
    transitions: lane.transitions.length,
    structuralKinds: histogram([...lane.places, ...lane.transitions], 'structuralKind'),
    modeClaims: histogram([...lane.places, ...lane.transitions], 'modeClaim'),
    branchTransitions: lane.transitions.filter((edge) => (edge.consumes?.length || 0) > 1 || (edge.produces?.length || 0) > 1).length,
  };
}

export function compareProjection(payload, flow) {
  if (!flow || !Array.isArray(flow.steps)) {
    throw Object.assign(new Error('LandLord candidate flow is unavailable'), { exitCode: EXIT.invalid });
  }
  const g1 = laneReading(payload.lanes.G1);
  const g2 = laneReading(payload.lanes.G2);
  const g3 = laneReading(payload.lanes.G3);
  const candidate = {
    templateKey: flow.key,
    version: flow.version || 'unversioned',
    steps: flow.steps.length,
    linearTransitions: Math.max(0, flow.steps.length - 1),
    failureRoutes: flow.steps.filter((step) => step.onFail).length,
    humanJudgments: flow.steps.filter((step) => step.onFail?.detects === 'judgment').length,
  };
  const gaps = [];
  if (candidate.version === 'unversioned') gaps.push('candidate-flow-version-missing');
  if (candidate.steps !== g3.places) gaps.push('place-count-differs');
  if (candidate.linearTransitions !== g3.transitions) gaps.push('transition-count-differs');
  if (payload.lanes.G2.status === 'comparison-not-observed') gaps.push('g2-not-observed');

  return {
    schema: 'landlord-spm-audit-comparison/v1',
    purpose: PURPOSE,
    applied: false,
    producerCommit: payload.producer.commit,
    projectionDigest: payload.attestation.canonicalJsonSha256,
    readings: { G1: g1, G2: g2, G3: g3, landlordCandidate: candidate },
    gaps,
    verdict: gaps.length === 0 ? 'shape-aligned' : 'comparison-gaps-present',
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) throw Object.assign(new Error(`unexpected argument: ${arg}`), { exitCode: EXIT.invalid });
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw Object.assign(new Error(`missing value for ${arg}`), { exitCode: EXIT.invalid });
    args[arg.slice(2)] = value;
    index += 1;
  }
  return args;
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!args.projection || !args['expected-producer-commit']) {
    throw Object.assign(new Error('--projection and --expected-producer-commit are required'), { exitCode: EXIT.invalid });
  }
  const projectionPath = resolve(args.projection);
  if (!inside(tmpdir(), projectionPath) || inside(REPO_ROOT, projectionPath)) {
    throw boundaryError('projection input must be an operating-system temp artifact outside the repository');
  }
  const payload = validateProjection(JSON.parse(readFileSync(projectionPath, 'utf8')), args['expected-producer-commit']);

  const bundlePath = resolve(args.bundle || resolve(REPO_ROOT, 'dist-operator/operator-core.mjs'));
  if (!inside(REPO_ROOT, bundlePath)) throw boundaryError('operator bundle must be inside the LandLord repository');
  const operator = await import(`${pathToFileURL(bundlePath).href}?audit=${Date.now()}`);
  const flow = operator.FOUNDING_FLOWS?.find((candidate) => candidate.key === (args.flow || 'vendor-dispatch'));
  const report = compareProjection(payload, flow);

  let outputPath;
  if (args.out) {
    outputPath = resolve(args.out);
    if (!inside(tmpdir(), outputPath) || inside(REPO_ROOT, outputPath)) throw boundaryError('report output must remain under the operating-system temp directory');
    mkdirSync(dirname(outputPath), { recursive: true });
  } else {
    outputPath = resolve(mkdtempSync(resolve(tmpdir(), 'landlord-spm-comparison-')), 'report.json');
  }
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  process.stdout.write(`${JSON.stringify({ ok: true, applied: false, outputPath, verdict: report.verdict, gaps: report.gaps })}\n`);
  return outputPath;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = error.exitCode || EXIT.invalid;
  });
}
