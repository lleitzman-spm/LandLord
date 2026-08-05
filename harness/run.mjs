// The CLI that sets a task before the agent and keeps the git discipline the
// charter promises. Two modes:
//
//   dry run (default) — run the agent, show what it changed and the commit
//     message it proposes, then restore the tree. Nothing is kept. Use this to
//     watch a new task or a new brain before trusting it.
//   --commit          — cut a fresh k3/<slug> branch, run the agent, commit its
//     work (authored in its voice, provenance marked), push the branch, and
//     return to where you started. Claude reviews the branch; the Regent judges
//     the outcome. Nothing here touches main or the live walls.
//
// Usage (inside a Claude Code container, through the proxy launcher):
//   ./harness/run.sh run.mjs "a task in plain words"            # dry run
//   ./harness/run.sh run.mjs "a task in plain words" --commit   # keep it, on a branch

import { spawnSync } from 'node:child_process';
import { runAgent } from './loop.mjs';

const repoRoot = process.cwd();
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const opts = Object.fromEntries(
  argv.filter((a) => a.startsWith('--') && a.includes('=')).map((a) => a.slice(2).split('=')),
);
const task = argv.find((a) => !a.startsWith('--'));

if (!task) {
  console.error('Give a task: ./harness/run.sh run.mjs "what to do" [--commit] [--branch=k3/x] [--max-iters=N]');
  process.exit(2);
}

const git = (args) => spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
const gitOut = (args) => git(args).stdout?.trim() ?? '';

// Never mix the agent's work with changes already in the tree.
if (gitOut(['status', '--porcelain'])) {
  console.error('The working tree is not clean. Commit or stash your own changes first.');
  process.exit(2);
}

const commit = flags.has('--commit');
const originalBranch = gitOut(['rev-parse', '--abbrev-ref', 'HEAD']);
const slug =
  (opts.branch ?? '')
    ? opts.branch.replace(/^k3\//, '')
    : task.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
const branch = `k3/${slug}-${Date.now().toString(36).slice(-4)}`;

function priceOf(t) {
  // kimi-k3: $3 / 1M input, $15 / 1M output (reasoning counts as output).
  return (t.prompt_tokens / 1e6) * 3 + (t.completion_tokens / 1e6) * 15;
}

async function main() {
  if (commit) {
    git(['checkout', '-B', branch]);
    console.log(`\n▶ on branch ${branch} — running the agent…\n`);
  } else {
    console.log(`\n▶ dry run on ${originalBranch} (nothing kept) — running the agent…\n`);
  }

  const maxIters = opts['max-iters'] ? Number(opts['max-iters']) : 14;
  const tokenBudget = opts.budget ? Number(opts.budget) : undefined;
  const { finalText, iters, totals, stopped } = await runAgent({
    task,
    repoRoot,
    maxIters,
    ...(tokenBudget ? { tokenBudget } : {}),
  });

  const changed = gitOut(['status', '--porcelain']);
  console.log('\n──────── result ────────');
  console.log(`stopped: ${stopped} after ${iters} step(s)`);
  console.log(
    `tokens : ${totals.total_tokens} (${totals.reasoning_tokens} reasoning) ≈ $${priceOf(totals).toFixed(3)}`,
  );

  if (!changed) {
    console.log('changes: none — the agent altered no files.');
    if (commit) git(['checkout', originalBranch]);
    return;
  }

  console.log('\nfiles:');
  console.log(gitOut(['--no-pager', 'diff', '--stat']));
  console.log("\nagent's commit message:\n" + (finalText || '(none — the agent did not sign off)'));

  if (!commit) {
    // Restore the tree; a dry run keeps nothing.
    git(['stash', 'push', '-u', '-m', 'k3-dryrun']);
    git(['stash', 'drop']);
    console.log('\n(dry run — tree restored. Re-run with --commit to keep this on a branch.)');
    return;
  }

  const message =
    (finalText || `k3: ${task}`) + '\n\nCo-Authored-By: Kimi K3 <noreply@example.com>\n';
  git(['add', '-A']);
  git(['commit', '-m', message]);
  const push = git(['push', '-u', 'origin', branch]);
  git(['checkout', originalBranch]);

  console.log(`\n✔ committed to ${branch}${push.status === 0 ? ' and pushed' : ' (push failed — see below)'}`);
  if (push.status !== 0) console.log(push.stderr?.trim());
  console.log(`\nReview it:  git --no-pager diff ${originalBranch}..${branch}`);
  console.log(`Back on:    ${originalBranch}`);
}

main().catch((err) => {
  console.error('harness error:', err.message);
  if (commit && originalBranch) git(['checkout', originalBranch]);
  process.exit(1);
});
