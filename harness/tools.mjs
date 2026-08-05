// The tool-belt — the agent's hands. The brain (K3) calls these by name; each
// runs here, in the repo, and hands back a plain-text result the brain reads on
// its next breath. Two things are enforced in code, not merely asked of the
// brain in the charter, so a gate never rests on good behaviour alone:
//
//   - Reach. Every path is resolved inside the repo; nothing outside is touched.
//   - The gates (AGENTS.md). Writes to the walls (`wrangler.jsonc`) and to
//     secrets (`.env`) are refused; so are deploy, destructive git, recursive
//     delete, and direct vault destruction through `run`. The harness owns git.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

// Truncate any single tool result to keep the context lean — but wide enough to
// read a whole working file in one breath (the Ledger and the store already run
// past 15k chars). Too small a cap and the brain edits a file half-blind.
const CAP = 40000;

const clip = (s) =>
  s.length > CAP ? s.slice(0, CAP) + `\n…[truncated ${s.length - CAP} chars]` : s;

function inRepo(repoRoot, path) {
  const abs = resolve(repoRoot, path);
  const rel = relative(repoRoot, abs);
  if (rel.startsWith('..') || resolve(repoRoot, rel) !== abs) {
    throw new Error(`path escapes the repo: ${path}`);
  }
  return abs;
}

// Writes the brain must never make on its own initiative — kingdom law (AGENTS.md).
const PROTECTED_WRITES = [
  { re: /^wrangler\.jsonc$/, why: 'the walls are the Regent’s to arm (gate 1) — propose, do not edit.' },
  { re: /^\.env(\..*)?$/, why: 'secrets live outside git and are never written by an agent.' },
  { re: /(^|\/)\.git(\/|$)/, why: 'the git store is the harness’s to keep.' },
];

// Commands `run` refuses — the gates, made mechanical.
const BLOCKED_RUN = [
  { re: /\bwrangler\b/i, why: 'deploying or arming the walls is the Regent’s command (gate 1).' },
  { re: /npm\s+run\s+deploy/i, why: 'deploying is the Regent’s command (gate 1).' },
  { re: /\bgit\s+(commit|push|reset|rebase|merge|cherry-pick|branch\s+-D|clean)\b/i, why: 'the harness owns git — change files through the tools and it commits your work to your branch.' },
  { re: /\brm\s+-[a-zA-Z]*r/i, why: 'recursive delete is refused; change specific files through the tools.' },
  { re: /\bsudo\b/i, why: 'no elevated commands.' },
  { re: /(drop\s+table|truncate\s+table|delete\s+from)/i, why: 'destructive vault operations are refused (gate 2).' },
];

export const toolSchemas = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a UTF-8 file by its repo-relative path. Read before you write.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'repo-relative path' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: 'List the entries of a directory by its repo-relative path (use "." for the root).',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'repo-relative directory path' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Create or overwrite a file with the given content. Parent directories are made as needed.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'repo-relative path' },
          content: { type: 'string', description: 'the full new file content' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description:
        'Replace one exact occurrence of old_text with new_text in a file. old_text must appear exactly once. Prefer this for small changes.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'repo-relative path' },
          old_text: { type: 'string', description: 'exact text to replace (must be unique in the file)' },
          new_text: { type: 'string', description: 'replacement text' },
        },
        required: ['path', 'old_text', 'new_text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run',
      description:
        'Run a shell command in the repo root (e.g. `npm run build`, `git status`, `git diff`, `grep -rn foo src`). The harness owns git history and deploys — commit/push/deploy are refused.',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string', description: 'the shell command' } },
        required: ['command'],
      },
    },
  },
];

export function executeTool(name, args, { repoRoot }) {
  try {
    switch (name) {
      case 'read_file': {
        const abs = inRepo(repoRoot, args.path);
        if (!existsSync(abs)) return `no such file: ${args.path}`;
        return clip(readFileSync(abs, 'utf8'));
      }
      case 'list_dir': {
        const abs = inRepo(repoRoot, args.path ?? '.');
        if (!existsSync(abs)) return `no such directory: ${args.path}`;
        const entries = readdirSync(abs).map((n) => {
          const kind = statSync(resolve(abs, n)).isDirectory() ? 'dir ' : 'file';
          return `${kind}  ${n}`;
        });
        return clip(entries.join('\n') || '(empty)');
      }
      case 'write_file': {
        for (const p of PROTECTED_WRITES) if (p.re.test(args.path)) return `refused: ${p.why}`;
        const abs = inRepo(repoRoot, args.path);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, args.content);
        return `wrote ${args.path} (${args.content.length} chars)`;
      }
      case 'edit_file': {
        for (const p of PROTECTED_WRITES) if (p.re.test(args.path)) return `refused: ${p.why}`;
        const abs = inRepo(repoRoot, args.path);
        if (!existsSync(abs)) return `no such file: ${args.path}`;
        const before = readFileSync(abs, 'utf8');
        const count = before.split(args.old_text).length - 1;
        if (count === 0) return 'refused: old_text not found — read the file and match it exactly.';
        if (count > 1) return `refused: old_text appears ${count} times — include more context so it is unique.`;
        writeFileSync(abs, before.replace(args.old_text, args.new_text));
        return `edited ${args.path}`;
      }
      case 'run': {
        for (const b of BLOCKED_RUN) if (b.re.test(args.command)) return `refused: ${b.why}`;
        const r = spawnSync('bash', ['-c', args.command], {
          cwd: repoRoot,
          encoding: 'utf8',
          timeout: 120000,
          maxBuffer: 10 * 1024 * 1024,
        });
        const out = [
          r.stdout ?? '',
          r.stderr ? `\n[stderr]\n${r.stderr}` : '',
          `\n[exit ${r.status ?? 'null'}${r.error ? ' — ' + r.error.message : ''}]`,
        ].join('');
        return clip(out.trim());
      }
      default:
        return `unknown tool: ${name}`;
    }
  } catch (err) {
    return `error: ${err.message}`;
  }
}
