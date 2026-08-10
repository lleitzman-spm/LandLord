#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { realpathSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const EXIT = Object.freeze({
  ok: 0,
  invalid: 2,
  identity: 3,
  boundary: 4,
  gate: 5,
  proof: 6,
  act: 7,
});

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const DEFAULT_INPUT = resolve(HERE, 'demo-attention.json');
const OPERATOR_BUNDLE = resolve(ROOT, 'dist-operator', 'operator-core.mjs');
const TEMP_ROOT = resolve(tmpdir());
const REAL_ROOT = realpathSync(ROOT);
const REAL_TEMP_ROOT = realpathSync(TEMP_ROOT);

class ShadowFailure extends Error {
  constructor(message, exitCode) {
    super(message);
    this.exitCode = exitCode;
  }
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function inside(parent, child) {
  const path = relative(resolve(parent), resolve(child));
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}

function argsOf(argv) {
  const result = { mode: 'shadow', input: DEFAULT_INPUT, out: null, proof: null, commit: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--shadow') result.mode = 'shadow';
    else if (arg === '--act') result.mode = 'act';
    else if (arg === '--input') result.input = resolve(argv[++index] ?? '');
    else if (arg === '--out') result.out = resolve(argv[++index] ?? '');
    else if (arg === '--proof') result.proof = resolve(argv[++index] ?? '');
    else if (arg === '--commit') result.commit = argv[++index] ?? '';
    else throw new ShadowFailure(`unknown argument: ${arg}`, EXIT.invalid);
  }
  return result;
}

async function safeOutputPath(path) {
  if (!inside(TEMP_ROOT, path) || inside(ROOT, path)) {
    throw new ShadowFailure('reports may be written only beneath the operating-system temp directory', EXIT.boundary);
  }
  await mkdir(dirname(path), { recursive: true });
  const parent = realpathSync(dirname(path));
  if (!inside(REAL_TEMP_ROOT, parent) || inside(REAL_ROOT, parent)) {
    throw new ShadowFailure('report parent resolves outside the operating-system temp directory', EXIT.boundary);
  }
  return resolve(parent, basename(path));
}

function assertCommit(pinned) {
  if (!/^[0-9a-f]{40}$/.test(pinned ?? '')) {
    throw new ShadowFailure('--commit must pin a full repository commit', EXIT.proof);
  }
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (head !== pinned) throw new ShadowFailure('pinned commit does not match HEAD', EXIT.proof);
  const dirty = execFileSync('git', ['status', '--porcelain'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim();
  if (dirty) throw new ShadowFailure('repository is not clean at the pinned commit', EXIT.proof);
  return head;
}

function prepareEngine(pinned) {
  const repositoryCommit = assertCommit(pinned);
  if (process.platform === 'win32') {
    const npmCli = resolve(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
    execFileSync(process.execPath, [npmCli, 'run', 'build:operator'], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
  } else {
    execFileSync('npm', ['run', 'build:operator'], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
  }
  const bytes = readFileSync(OPERATOR_BUNDLE);
  return { repositoryCommit, operatorBundleDigest: createHash('sha256').update(bytes).digest('hex') };
}

const forbiddenKeys = new Set([
  'name', 'address', 'email', 'phone', 'tenant', 'owner', 'vendor', 'person', 'actor',
  'credential', 'secret', 'token', 'note', 'quote', 'amount', 'cents', 'estateid', 'params',
]);

function assertNamesFree(value, trail = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNamesFree(item, `${trail}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (forbiddenKeys.has(key.toLowerCase())) {
      throw new ShadowFailure(`identity-bearing field is forbidden at ${trail}.${key}`, EXIT.identity);
    }
    assertNamesFree(nested, `${trail}.${key}`);
  }
}

function assertSyntheticInput(input) {
  if (input?.schema !== 'landlord-attention-shadow-input/v1') {
    throw new ShadowFailure('shadow input schema is not accepted', EXIT.invalid);
  }
  if (input.classification !== 'synthetic-demo-only' || !Array.isArray(input.events)) {
    throw new ShadowFailure('shadow input is not marked synthetic-demo-only', EXIT.invalid);
  }
  assertNamesFree(input);
  for (const event of input.events) {
    if (!/^demo\/work\/[a-z0-9-]+(?:\/[a-z0-9-]+)?$/.test(event.workId)) {
      throw new ShadowFailure('work identifiers must remain in the opaque demo namespace', EXIT.identity);
    }
    if (!event.id.startsWith(`${event.workId}/`)) {
      throw new ShadowFailure('event identifiers must remain inside their demo work namespace', EXIT.invalid);
    }
    for (const evidence of event.evidence ?? []) {
      if (!/^demo-evidence\/[a-z0-9-]+$/.test(evidence.ref)) {
        throw new ShadowFailure('evidence references must remain opaque demo references', EXIT.identity);
      }
    }
  }
}

async function loadInput(path) {
  const real = realpathSync(path);
  const realDefault = realpathSync(DEFAULT_INPUT);
  if (real !== realDefault && (!inside(REAL_TEMP_ROOT, real) || inside(REAL_ROOT, real))) {
    throw new ShadowFailure('custom shadow input must resolve beneath the operating-system temp directory', EXIT.boundary);
  }
  const input = JSON.parse(await readFile(real, 'utf8'));
  assertSyntheticInput(input);
  return input;
}

async function writeReport(report, path) {
  const safe = await safeOutputPath(path);
  await writeFile(safe, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  return safe;
}

async function defaultOutput(kind) {
  const directory = resolve(TEMP_ROOT, `landlord-audit-shadow-${process.pid}-${Date.now()}`);
  await mkdir(directory, { recursive: false });
  return resolve(directory, `${kind}.json`);
}

function proofDigest(proof) {
  const { proofDigest: _discarded, ...body } = proof;
  return digest(body);
}

function summarizeLedger(ledger) {
  return {
    totals: ledger.totals,
    open: ledger.open.map((entry) => ({
      workId: entry.workId,
      requirement: entry.requirement,
      avoidability: entry.avoidability,
      reversibility: entry.reversibility,
      exceptionBurden: entry.exceptionBurden,
      escalationAttribution: entry.escalationAttribution,
      confidence: entry.confidence,
      evidence: entry.evidence,
      priorityReasons: entry.priorityReasons,
    })),
  };
}

function evaluate(input, engine) {
  const failures = engine.validateAttentionLog(input.events);
  const ledger = engine.readAttentionLedger(input.events);
  const candidate = engine.boundedMachineCandidate(input.events);
  const gates = [
    { gate: 'synthetic-input', pass: true },
    { gate: 'names-free', pass: true },
    { gate: 'valid-records', pass: failures.length === 0, detail: failures },
    { gate: 'fully-classified', pass: ledger.totals.unclassified === 0 },
    { gate: 'evidence-complete', pass: ledger.totals.evidenceGaps === 0 },
    { gate: 'confidence-sufficient', pass: ledger.totals.lowConfidence === 0 },
    { gate: 'reversible-candidate', pass: candidate !== null },
  ];
  return { failures, ledger, candidate, gates };
}

async function runShadow(options, engine, build) {
  const input = await loadInput(options.input);
  const { ledger, candidate, gates } = evaluate(input, engine);
  if (gates.some((gate) => !gate.pass)) {
    throw new ShadowFailure(`shadow gates refused: ${JSON.stringify(gates)}`, EXIT.gate);
  }
  const proof = {
    schema: 'landlord-attention-shadow-proof/v1',
    classification: 'synthetic-demo-only',
    repositoryCommit: build.repositoryCommit,
    operatorBundleDigest: build.operatorBundleDigest,
    inputDigest: digest(input),
    createdAt: new Date().toISOString(),
    gates,
    ledger: summarizeLedger(ledger),
    boundedCandidate: candidate.workId,
    applied: false,
    externalEffects: false,
    proofDigest: '',
  };
  proof.proofDigest = proofDigest(proof);
  const path = options.out ?? await defaultOutput('shadow-proof');
  const safePath = await writeReport(proof, path);
  return { path: safePath, report: proof };
}

async function runAct(options, engine, build) {
  if (!options.proof) {
    throw new ShadowFailure('--act requires a proof beneath the operating-system temp directory', EXIT.proof);
  }
  const proofPath = realpathSync(options.proof);
  if (!inside(REAL_TEMP_ROOT, proofPath) || inside(REAL_ROOT, proofPath)) {
    throw new ShadowFailure('--act proof resolves outside the operating-system temp directory', EXIT.proof);
  }
  const input = await loadInput(options.input);
  const proof = JSON.parse(await readFile(proofPath, 'utf8'));
  if (
    proof.schema !== 'landlord-attention-shadow-proof/v1' ||
    proof.classification !== 'synthetic-demo-only' ||
    proof.applied !== false ||
    proof.externalEffects !== false ||
    proof.repositoryCommit !== build.repositoryCommit ||
    proof.operatorBundleDigest !== build.operatorBundleDigest ||
    proof.inputDigest !== digest(input) ||
    proof.proofDigest !== proofDigest(proof) ||
    !Array.isArray(proof.gates) ||
    proof.gates.some((gate) => gate.pass !== true)
  ) {
    throw new ShadowFailure('shadow proof is stale, mismatched, or tampered', EXIT.proof);
  }

  const evaluation = evaluate(input, engine);
  if (evaluation.gates.some((gate) => !gate.pass)) {
    throw new ShadowFailure('shadow gates no longer pass under the pinned engine', EXIT.proof);
  }
  const before = evaluation.ledger;
  const candidate = evaluation.candidate;
  if (!candidate || candidate.workId !== proof.boundedCandidate) {
    throw new ShadowFailure('the proved bounded candidate is no longer admissible', EXIT.act);
  }

  const at = new Date().toISOString();
  const actEvent = {
    id: `${candidate.workId}/bounded-demo-act`,
    at,
    workId: candidate.workId,
    kind: 'resolved',
  };
  const afterAct = engine.readAttentionLedger([...input.events, actEvent]);
  if (afterAct.open.some((entry) => entry.workId === candidate.workId)) {
    throw new ShadowFailure('bounded demo act did not produce the expected reading', EXIT.act);
  }
  const reversalEvent = {
    id: `${candidate.workId}/bounded-demo-reversal`,
    at: new Date(Date.parse(at) + 1).toISOString(),
    workId: candidate.workId,
    kind: 'reversed',
    reverses: actEvent.id,
  };
  const afterReversal = engine.readAttentionLedger([...input.events, actEvent, reversalEvent]);
  if (digest(summarizeLedger(afterReversal)) !== digest(summarizeLedger(before))) {
    throw new ShadowFailure('bounded demo act did not reverse to the prior reading', EXIT.act);
  }

  const receipt = {
    schema: 'landlord-attention-bounded-demo-act/v1',
    classification: 'synthetic-demo-only',
    repositoryCommit: build.repositoryCommit,
    operatorBundleDigest: build.operatorBundleDigest,
    proofDigest: proof.proofDigest,
    applied: false,
    simulated: true,
    simulationExecuted: true,
    appliedScope: 'in-memory-demo-copy-only',
    externalEffects: false,
    workId: candidate.workId,
    actEvent,
    reversalEvent,
    reversed: true,
    before: summarizeLedger(before),
    afterAct: summarizeLedger(afterAct),
    afterReversal: summarizeLedger(afterReversal),
  };
  const path = options.out ?? await defaultOutput('bounded-demo-act');
  const safePath = await writeReport(receipt, path);
  return { path: safePath, report: receipt };
}

async function main() {
  try {
    const options = argsOf(process.argv.slice(2));
    const build = prepareEngine(options.commit);
    const engine = await import(`${pathToFileURL(OPERATOR_BUNDLE).href}?sha256=${build.operatorBundleDigest}`);
    const result = options.mode === 'act'
      ? await runAct(options, engine, build)
      : await runShadow(options, engine, build);
    process.stdout.write(`${JSON.stringify({
      ok: true,
      mode: options.mode,
      report: result.path,
      applied: result.report.applied,
      externalEffects: false,
    })}\n`);
  } catch (error) {
    const failure = error instanceof ShadowFailure
      ? error
      : new ShadowFailure(error instanceof Error ? error.message : String(error), EXIT.invalid);
    process.stderr.write(`${JSON.stringify({ ok: false, error: failure.message, exitCode: failure.exitCode })}\n`);
    process.exitCode = failure.exitCode;
  }
}

await main();
