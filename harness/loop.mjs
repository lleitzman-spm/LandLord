// The agent loop — the body's heartbeat. Hand it a task; it hands the charter,
// the task, and the tool-belt to the brain, then turns the brain's tool-calls
// into real acts in the repo, feeding each result back, until the brain stops
// calling tools and speaks its final word (a commit message). The harness owns
// git and the branch; the loop only thinks and touches files.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { complete } from './moonshot.mjs';
import { executeTool, toolSchemas } from './tools.mjs';

function charter(repoRoot) {
  try {
    return readFileSync(resolve(repoRoot, 'AGENTS.md'), 'utf8');
  } catch {
    return '(AGENTS.md missing — read docs/KINGDOM.md and CLAUDE.md for the law and conventions.)';
  }
}

function systemPrompt(repoRoot) {
  return `You are an autonomous builder of LandLord, working through tools. Your charter follows;
it is law, and it points you at docs/KINGDOM.md (the constitution) and CLAUDE.md (the
conventions) — read them with read_file when a task touches the canon.

=== AGENTS.md (your charter) ===
${charter(repoRoot)}
=== end charter ===

How you work in this harness:
- Act only through the tools. Read before you write. Prefer edit_file for small changes; match
  the surrounding code's style and the kingdom's plain-English medieval voice.
- The harness owns git and the branch: do not commit, push, or deploy — those are refused. You
  may use read-only git (status, diff) and run \`npm run build\` to verify.
- Verify before you finish: \`npm run build\` must be green. If you changed a visible feature,
  say how you would drive it in a browser.
- Keep the change minimal and faithful to the task. Do not wander into new modules (the Regent
  names those).
- When the task is complete and verified, STOP calling tools and reply with your commit message
  only: a short subject line in the kingdom's voice, a blank line, then one to three sentences of
  body. That final message is your sole output — nothing else.`;
}

// Old tool results are dead weight once the brain has moved past them: a 40k
// file read re-sent every turn for thirty turns is what burned the budget in
// prior builds (HANDOFF: "trim old tool results from loop.mjs history"). Keep the
// most-recent results whole so the brain edits with fresh eyes; stub the older
// big ones — it re-reads on demand if it must. Small results (an "edited X", a
// short build line) are left alone.
const KEEP_FULL = 6; // most-recent tool results kept at full content
const STUB_OVER = 600; // only elide results larger than this
function trimHistory(messages) {
  const toolAt = [];
  for (let i = 0; i < messages.length; i++) if (messages[i].role === 'tool') toolAt.push(i);
  const cutoff = toolAt.length - KEEP_FULL;
  for (let k = 0; k < cutoff; k++) {
    const m = messages[toolAt[k]];
    if (!m._elided && typeof m.content === 'string' && m.content.length > STUB_OVER) {
      m.content = '[elided to save budget — re-read the file or re-run the command if you need it]';
      m._elided = true;
    }
  }
}

// Defaults sized for real work, not just a proving errand: room per turn to write
// a whole file without the reasoning eating the budget, and a total budget deep
// enough for a multi-file build. A caller can still cap either lower.
export async function runAgent({ task, repoRoot = process.cwd(), maxIters = 14, maxTokens = 16384, tokenBudget = 1400000 }) {
  const messages = [
    { role: 'system', content: systemPrompt(repoRoot) },
    { role: 'user', content: `Your task:\n\n${task}` },
  ];

  const totals = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, reasoning_tokens: 0 };
  const add = (u) => {
    if (!u) return;
    totals.prompt_tokens += u.prompt_tokens ?? 0;
    totals.completion_tokens += u.completion_tokens ?? 0;
    totals.total_tokens += u.total_tokens ?? 0;
    totals.reasoning_tokens += u.completion_tokens_details?.reasoning_tokens ?? 0;
  };

  for (let iter = 1; iter <= maxIters; iter++) {
    const { message, finishReason, usage } = await complete({ messages, tools: toolSchemas, maxTokens });
    add(usage);

    const calls = message.tool_calls ?? [];
    if (calls.length === 0) {
      // The brain has spoken its final word.
      if (message.content && message.content.trim()) {
        console.log(`  [K3] done after ${iter} step(s).`);
        return { finalText: message.content.trim(), iters: iter, totals, stopped: 'done' };
      }
      // Empty and no tool call — usually the budget was eaten by reasoning.
      if (finishReason === 'length') {
        console.log('  [K3] ran out of token budget mid-thought; stopping.');
        return { finalText: '', iters: iter, totals, stopped: 'length' };
      }
      return { finalText: '', iters: iter, totals, stopped: 'empty' };
    }

    // Record the brain's turn (with its tool calls) before answering them.
    messages.push({ role: 'assistant', content: message.content ?? '', tool_calls: calls });

    for (const call of calls) {
      let args = {};
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch {
        messages.push({ role: 'tool', tool_call_id: call.id, content: 'error: arguments were not valid JSON' });
        continue;
      }
      const preview =
        call.function.name === 'run'
          ? args.command
          : call.function.name === 'write_file'
            ? `${args.path} (${(args.content ?? '').length} chars)`
            : args.path ?? JSON.stringify(args);
      console.log(`  [K3] ${call.function.name}: ${String(preview).slice(0, 120)}`);
      const result = executeTool(call.function.name, args, { repoRoot });
      messages.push({ role: 'tool', tool_call_id: call.id, content: result });
    }

    // Shed stale big reads so the next turn's context stays lean (the budget
    // lesson from prior K3 runs) — the single biggest cost lever on a long build.
    trimHistory(messages);

    if (totals.total_tokens > tokenBudget) {
      console.log(`  [K3] token budget (${tokenBudget}) reached; stopping.`);
      return { finalText: '', iters: iter, totals, stopped: 'budget' };
    }
  }

  return { finalText: '', iters: maxIters, totals, stopped: 'max-iters' };
}
