#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SCHEMA = 'spm-landlord-audit-projection/v1';
export const PURPOSE = 'offline-comparison-only';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const REAL_REPO_ROOT = realpathSync(REPO_ROOT);
const REAL_TEMP_ROOT = realpathSync(tmpdir());
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
  if (!/^[0-9a-f]{64}$/.test(payload.producer?.inputArtifactSha256 || '')) {
    throw forbiddenError('producer input artifact digest is invalid');
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

  function exact(value, keys, path) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw forbiddenError(`object required at ${path}`);
    const unknown = Object.keys(value).filter((key) => !keys.includes(key));
    const missing = keys.filter((key) => !(key in value));
    if (unknown.length || missing.length) throw forbiddenError(`schema fields differ at ${path}: unknown=${unknown.join(',') || '-'} missing=${missing.join(',') || '-'}`);
  }

  exact(payload, ['schema', 'purpose', 'applied', 'producer', 'policy', 'processFamily', 'lanes', 'attestation'], '$');
  exact(payload.producer, ['repository', 'commit', 'inputArtifactSha256'], '$.producer');
  exact(payload.policy, ['execution', 'network', 'operationalData', 'guardContent', 'permittedContent'], '$.policy');
  exact(payload.lanes, ['G1', 'G2', 'G3'], '$.lanes');
  exact(payload.attestation, ['producerProvenanceValidated', 'digestMethod', 'canonicalJsonSha256'], '$.attestation');
  if (payload.processFamily !== 'maintenance-work-order' || payload.policy.guardContent !== 'withheld' || payload.policy.permittedContent !== 'hashed-topology-and-abstract-capabilities-only') {
    throw forbiddenError('projection contains an unrecognized process or content policy');
  }

  const modes = new Set(['human-required', 'machine-candidate', 'external-wait', 'unresolved']);
  const kinds = new Set(['trigger', 'read', 'decide', 'act', 'gate', 'verify', 'ledger']);
  const capabilities = new Set(['observe-state', 'hold-until-guard', 'advance-case']);
  const guardSlots = new Set(['entry', 'exit', 'precondition', 'authority', 'evidence']);

  for (const lane of ['G1', 'G2', 'G3']) {
    const laneValue = payload.lanes?.[lane];
    exact(laneValue, lane === 'G2' ? ['status', 'places', 'transitions'] : ['places', 'transitions'], `$.lanes.${lane}`);
    if (!Array.isArray(laneValue.places) || !Array.isArray(laneValue.transitions)) {
      throw Object.assign(new Error(`projection lane ${lane} is incomplete`), { exitCode: EXIT.invalid });
    }
    if (lane === 'G2' && laneValue.status !== 'comparison-not-observed') throw forbiddenError('G2 status is not accepted');
    for (const [index, place] of laneValue.places.entries()) {
      exact(place, ['id', 'taskFamily', 'abstractCapability', 'modeClaim', 'structuralKind', 'guardSlots'], `$.lanes.${lane}.places[${index}]`);
      if (!/^p-[0-9]{4}$/.test(place.id) || place.taskFamily !== 'maintenance-work-order' || !capabilities.has(place.abstractCapability) || !modes.has(place.modeClaim) || !kinds.has(place.structuralKind)) {
        throw forbiddenError(`place contains an unrecognized value at $.lanes.${lane}.places[${index}]`);
      }
      if (!Array.isArray(place.guardSlots) || place.guardSlots.some((slot) => !guardSlots.has(slot))) throw forbiddenError(`place guard slots are invalid at $.lanes.${lane}.places[${index}]`);
    }
    for (const [index, edge] of laneValue.transitions.entries()) {
      exact(edge, ['id', 'taskFamily', 'abstractCapability', 'modeClaim', 'structuralKind', 'consumes', 'produces', 'guardSlots'], `$.lanes.${lane}.transitions[${index}]`);
      if (!/^t-[0-9]{4}$/.test(edge.id) || edge.taskFamily !== 'maintenance-work-order' || !capabilities.has(edge.abstractCapability) || !modes.has(edge.modeClaim) || !kinds.has(edge.structuralKind)) {
        throw forbiddenError(`transition contains an unrecognized value at $.lanes.${lane}.transitions[${index}]`);
      }
      if (![edge.consumes, edge.produces, edge.guardSlots].every(Array.isArray)) throw forbiddenError(`transition arrays are invalid at $.lanes.${lane}.transitions[${index}]`);
      if ([...edge.consumes, ...edge.produces].some((id) => !/^p-[0-9]{4}$/.test(id)) || edge.guardSlots.some((slot) => !guardSlots.has(slot))) throw forbiddenError(`transition topology is invalid at $.lanes.${lane}.transitions[${index}]`);
      const placeIds = new Set(laneValue.places.map((place) => place.id));
      if ([...edge.consumes, ...edge.produces].some((id) => !placeIds.has(id))) throw forbiddenError(`transition references a place outside lane ${lane}`);
    }
    const placeIds = laneValue.places.map((place) => place.id);
    const transitionIds = laneValue.transitions.map((edge) => edge.id);
    if (new Set(placeIds).size !== placeIds.length || new Set(transitionIds).size !== transitionIds.length) {
      throw forbiddenError(`lane ${lane} contains duplicate topology identifiers`);
    }
  }
  return payload;
}

function verifyProducer(payload, repoPath, artifactPath, expectedCommit) {
  const repo = realpathSync(resolve(repoPath));
  if (isAbsolute(artifactPath) || artifactPath.split(/[\\/]+/).includes('..')) throw boundaryError('producer artifact must be a repository-relative path');
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  if (head !== expectedCommit || head !== payload.producer.commit) throw Object.assign(new Error('producer checkout does not match the pinned commit'), { exitCode: EXIT.mismatch });
  const artifact = execFileSync('git', ['show', `${head}:${artifactPath.replaceAll('\\', '/')}`], { cwd: repo });
  if (sha256(artifact) !== payload.producer.inputArtifactSha256) throw Object.assign(new Error('producer artifact digest does not match the pinned git object'), { exitCode: EXIT.mismatch });
  return { commit: head, artifactDigest: sha256(artifact) };
}

function prepareOperatorBundle() {
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  if (dirty) throw boundaryError('LandLord repository must be clean for a pinned comparison');
  if (process.platform === 'win32') {
    const npmCli = resolve(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
    execFileSync(process.execPath, [npmCli, 'run', 'build:operator'], { cwd: REPO_ROOT, stdio: 'pipe' });
  } else {
    execFileSync('npm', ['run', 'build:operator'], { cwd: REPO_ROOT, stdio: 'pipe' });
  }
  const bundle = realpathSync(resolve(REPO_ROOT, 'dist-operator/operator-core.mjs'));
  if (!inside(REAL_REPO_ROOT, bundle)) throw boundaryError('operator bundle resolves outside LandLord');
  return {
    path: bundle,
    consumerCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim(),
    digest: sha256(readFileSync(bundle)),
  };
}

function histogram(items, key) {
  return Object.fromEntries([...items.reduce((counts, item) => counts.set(item[key] || 'unresolved', (counts.get(item[key] || 'unresolved') || 0) + 1), new Map())].sort());
}

function laneReading(lane) {
  const degrees = new Map(lane.places.map((place) => [place.id, { incoming: 0, outgoing: 0 }]));
  for (const edge of lane.transitions) {
    for (const id of edge.consumes ?? []) if (degrees.has(id)) degrees.get(id).outgoing += 1;
    for (const id of edge.produces ?? []) if (degrees.has(id)) degrees.get(id).incoming += 1;
  }
  const degreeShape = [...degrees.values()].map(({ incoming, outgoing }) => `${incoming}:${outgoing}`).sort();
  return {
    places: lane.places.length,
    transitions: lane.transitions.length,
    structuralKinds: histogram([...lane.places, ...lane.transitions], 'structuralKind'),
    modeClaims: histogram([...lane.places, ...lane.transitions], 'modeClaim'),
    branchTransitions: lane.transitions.filter((edge) => (edge.consumes?.length || 0) > 1 || (edge.produces?.length || 0) > 1).length,
    topologyDegreeSignature: sha256(canonicalJson(degreeShape)),
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
    topologyDegreeSignature: sha256(canonicalJson(flow.steps.map((_step, index) => `${index === 0 ? 0 : 1}:${index === flow.steps.length - 1 ? 0 : 1}`).sort())),
  };
  const gaps = [];
  if (candidate.version === 'unversioned') gaps.push('candidate-flow-version-missing');
  if (candidate.steps !== g3.places) gaps.push('place-count-differs');
  if (candidate.linearTransitions !== g3.transitions) gaps.push('transition-count-differs');
  if (candidate.topologyDegreeSignature !== g3.topologyDegreeSignature) gaps.push('topology-degree-signature-differs');
  if (payload.lanes.G2.status === 'comparison-not-observed') gaps.push('g2-not-observed');
  gaps.push('semantic-crosswalk-unproven');

  return {
    schema: 'landlord-spm-audit-comparison/v1',
    purpose: PURPOSE,
    applied: false,
    producerCommit: payload.producer.commit,
    projectionDigest: payload.attestation.canonicalJsonSha256,
    readings: { G1: g1, G2: g2, G3: g3, landlordCandidate: candidate },
    gaps,
    verdict: 'comparison-gaps-present',
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
  if (!args.projection || !args['expected-producer-commit'] || !args['producer-repo'] || !args['producer-artifact']) {
    throw Object.assign(new Error('--projection, --expected-producer-commit, --producer-repo, and --producer-artifact are required'), { exitCode: EXIT.invalid });
  }
  const projectionPath = resolve(args.projection);
  const realProjectionPath = realpathSync(projectionPath);
  if (!inside(REAL_TEMP_ROOT, realProjectionPath) || inside(REAL_REPO_ROOT, realProjectionPath)) {
    throw boundaryError('projection input must be an operating-system temp artifact outside the repository');
  }
  const payload = validateProjection(JSON.parse(readFileSync(realProjectionPath, 'utf8')), args['expected-producer-commit']);
  const producer = verifyProducer(payload, args['producer-repo'], args['producer-artifact'], args['expected-producer-commit']);

  if (args.bundle) throw boundaryError('custom operator bundles are not accepted');
  const bundle = prepareOperatorBundle();
  const operator = await import(`${pathToFileURL(bundle.path).href}?sha256=${bundle.digest}`);
  const flow = operator.FOUNDING_FLOWS?.find((candidate) => candidate.key === (args.flow || 'vendor-dispatch'));
  const report = compareProjection(payload, flow);
  report.verification = {
    producerArtifactVerified: true,
    producerCommit: producer.commit,
    producerArtifactDigest: producer.artifactDigest,
    consumerCommit: bundle.consumerCommit,
    operatorBundleDigest: bundle.digest,
  };

  let outputPath;
  if (args.out) {
    outputPath = resolve(args.out);
    if (!inside(tmpdir(), outputPath) || inside(REPO_ROOT, outputPath)) throw boundaryError('report output must remain under the operating-system temp directory');
    mkdirSync(dirname(outputPath), { recursive: true });
  } else {
    outputPath = resolve(mkdtempSync(resolve(tmpdir(), 'landlord-spm-comparison-')), 'report.json');
  }
  const realOutputParent = realpathSync(dirname(outputPath));
  if (!inside(REAL_TEMP_ROOT, realOutputParent) || inside(REAL_REPO_ROOT, realOutputParent)) throw boundaryError('report parent resolves outside the operating-system temp directory');
  outputPath = resolve(realOutputParent, basename(outputPath));
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
