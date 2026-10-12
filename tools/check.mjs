#!/usr/bin/env node
// Typecheck the whole project (serialized with a lock) and print only the
// diagnostics under the path prefixes you pass.  Usage:
//   node tools/check.mjs src/render/buildings src/render/api.ts
//   node tools/check.mjs            (everything)
import { execSync } from 'node:child_process';
const prefixes = process.argv.slice(2);
let out = '';
try {
  out = execSync('flock /tmp/landlord-tsc.lock npx tsc --noEmit --pretty false -p tsconfig.json', {
    cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20,
  });
} catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
const lines = out.split('\n').filter(l => /error TS/.test(l));
const mine = prefixes.length ? lines.filter(l => prefixes.some(p => l.startsWith(p))) : lines;
if (mine.length) { console.log(mine.join('\n')); console.log(`\n${mine.length} error(s) in your paths (${lines.length} project-wide).`); process.exit(1); }
console.log(`OK: no type errors in ${prefixes.length ? prefixes.join(', ') : 'project'} (${lines.length} elsewhere in project, not yours).`);
