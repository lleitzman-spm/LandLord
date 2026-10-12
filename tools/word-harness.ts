/**
 * Print the exact prompt the Word would send for an utterance, against the
 * development fixture, so that prompts can be tried on real models.
 *
 *   npx tsx tools/word-harness.ts <rank> "<utterance>" [role|court|tenant:<name>|building:<name>]
 *
 *   rank        reeve | knight | baron
 *   third arg   who is addressed: mason | bailiff | crier | steward | court (default),
 *               or tenant:Marta / building:Leaning (matched against names in the fixture)
 *
 * Options (after the positional arguments):
 *   --lean            the short instructions and tighter digest sent when a smaller model answers
 *                     (the server reports engine "workers-ai")
 *   --offline         also show what the offline parser makes of the words
 *   --reply '<json>'  run a model's reply through the validator and show the Exchange it becomes
 *   --reply-file <f>  the same, reading the reply from a file ("-" reads stdin)
 *   --json            print the request as JSON ({ system, messages, maxTokens, tier }) and nothing else
 */
import { readFileSync } from 'node:fs';
import { makeFixtureState, fakeSim } from '../src/dev/fixture';
import { buildOrderPrompt } from '../src/word/prompts';
import { exchangeFromModel, exchangeOffline, type WordCtx } from '../src/word/interpret';
import { parseOffline } from '../src/word/offline';
import type { Exchange, SpeakTarget } from '../src/word/api';
import type { StaffRole } from '../src/sim/types';

const argv = process.argv.slice(2);
const flags = new Map<string, string>();
const pos: string[] = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]!;
  if (a === '--offline' || a === '--json' || a === '--lean') flags.set(a, '1');
  else if (a === '--reply' || a === '--reply-file') flags.set(a, argv[++i] ?? '');
  else pos.push(a);
}
const [rankArg, utterance, who = 'court'] = pos;
if (!rankArg || !utterance || !['reeve', 'knight', 'baron'].includes(rankArg)) {
  console.error('usage: npx tsx tools/word-harness.ts <reeve|knight|baron> "<utterance>" [mason|bailiff|crier|steward|court|tenant:<name>|building:<name>] [--lean] [--offline] [--reply \'<json>\'] [--reply-file <file|->] [--json]');
  process.exit(2);
}

const state = makeFixtureState(rankArg as 'reeve' | 'knight' | 'baron');
const like = (hay: string, needle: string) => hay.toLowerCase().includes(needle.toLowerCase());
let target: SpeakTarget;
if (who.startsWith('tenant:')) {
  const t = Object.values(state.tenants).find(x => like(x.name, who.slice(7)));
  if (!t) { console.error(`no household in the fixture matches "${who.slice(7)}": ${Object.values(state.tenants).map(x => x.name).join(', ')}`); process.exit(2); }
  target = { tenantId: t.id };
} else if (who.startsWith('building:')) {
  const b = Object.values(state.buildings).find(x => like(x.name, who.slice(9)));
  if (!b) { console.error(`no building in the fixture matches "${who.slice(9)}": ${Object.values(state.buildings).map(x => x.name).join(', ')}`); process.exit(2); }
  target = { buildingId: b.id };
} else if (['mason', 'bailiff', 'crier', 'steward'].includes(who)) target = { to: who as StaffRole };
else target = { to: 'court' };

const req = buildOrderPrompt(state, utterance, target, { lean: flags.has('--lean') });
if (flags.has('--json')) { console.log(JSON.stringify(req, null, 2)); process.exit(0); }

const rule = (label: string) => console.log(`\n━━━━━━━━━━ ${label} ━━━━━━━━━━`);
rule(`SYSTEM (${req.system.length} characters)`);
console.log(req.system);
rule(`USER (${req.messages[0]!.content.length} characters)`);
console.log(req.messages[0]!.content);
rule(`maxTokens ${req.maxTokens}, tier ${req.tier}`);

const show = (ex: Exchange) => {
  console.log(`status   ${ex.status} (via ${ex.via})`);
  console.log(`speaker  ${ex.speaker.name} [${ex.speaker.kind}${ex.speaker.role ? ', ' + ex.speaker.role : ''}, ${ex.speaker.mood}]`);
  console.log(`reply    ${ex.reply}  (${ex.reply.length} characters)`);
  for (const a of ex.applied) console.log(`applied  ${JSON.stringify(a.action)} -> ${JSON.stringify(a.result)}`);
  for (const a of ex.pending) console.log(`pending  ${JSON.stringify(a)}`);
};
const quiet = <T>(f: () => T): T => { const log = console.log; console.log = () => {}; try { return f(); } finally { console.log = log; } };
let n = 0;
const ctxFor = (): WordCtx => { const sim = fakeSim(makeFixtureState(rankArg as 'reeve' | 'knight' | 'baron')); return { deps: { getState: () => sim.state, dispatch: a => quiet(() => sim.dispatch(a)) }, notify: () => {}, nextId: () => `h${++n}` }; };

if (flags.has('--offline')) {
  rule('OFFLINE PARSER');
  const r = parseOffline(utterance, target, state);
  console.log(`${r.understood ? 'understood' : 'not understood'}${r.confirm ? ', waits for the aye' : ''}; speaker ${r.speaker}`);
  console.log(`reply    ${r.reply}`);
  for (const m of r.moves) console.log(`move     ${JSON.stringify(m.action)}`);
}
const replyArg = flags.get('--reply') ?? (flags.has('--reply-file') ? readFileSync(flags.get('--reply-file') === '-' ? 0 : flags.get('--reply-file')!, 'utf8') : undefined);
if (replyArg !== undefined) {
  rule('THE REPLY, VALIDATED');
  const ctx = ctxFor();
  const ex = exchangeFromModel(replyArg, utterance, target, ctx);
  if (ex) show(ex);
  else { console.log('The reply could not be read as JSON. The game would fall back to the offline parser:'); show(exchangeOffline(utterance, target, ctx, 'bad_response')); }
}
