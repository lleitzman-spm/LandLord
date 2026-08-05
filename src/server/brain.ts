// The brain's mouth for the deployed keyholder — the edge twin of
// harness/moonshot.mjs. Same Moonshot OpenAI-compatible call and the same
// temperature quirk (the kimi reasoners pin temperature to 1, so we omit it and
// retry pinned once if a model refuses over it), but the key rides the Worker's
// env binding (a secret: `MOONSHOT_API_KEY`), never process.env. `makeComplete`
// returns a guarded `complete` the shared runFleet calls as `ctx.complete`.

import { guardComplete, type IdentityLeakError } from '../domain/contextGuard';

interface BrainEnv {
  MOONSHOT_API_KEY?: string;
  MOONSHOT_BASE_URL?: string;
}

interface CompleteArgs {
  messages: unknown;
  tools?: unknown[];
  maxTokens?: number;
  temperature?: number;
  model?: string;
  signal?: AbortSignal;
}

interface CompleteResult {
  message: { role: string; content: string; tool_calls?: unknown };
  finishReason?: string;
  usage?: unknown;
}

/** Build a `complete` bound to the Worker's Moonshot secret. Throws at call time
 *  (not build time) if the key is absent, so a keyless deploy fails honestly on
 *  the fleet route rather than at startup. */
export function makeComplete(
  env: BrainEnv,
  onBlocked?: (error: IdentityLeakError) => void,
): (args: CompleteArgs) => Promise<CompleteResult> {
  const apiKey = env.MOONSHOT_API_KEY;
  const baseUrl = (env.MOONSHOT_BASE_URL || 'https://api.moonshot.ai/v1').replace(/\/+$/, '');
  const providerComplete = async ({
    messages,
    tools,
    maxTokens = 8192,
    temperature,
    model,
    signal,
  }: CompleteArgs): Promise<CompleteResult> => {
    if (!apiKey) throw new Error('no MOONSHOT_API_KEY in the worker env — the clerks have no brain here');
    const useModel = model || 'kimi-k2.7-code-highspeed';
    const isK3 = /(^|[^\w])k3([^\w]|$)/i.test(useModel);
    const body: Record<string, unknown> = {
      model: useModel,
      messages,
      // CLAUDE.md, "The megamind": high, never max — at max K3 wanders.
      reasoning_effort: 'high',
      max_tokens: maxTokens,
    };
    if (temperature != null) body.temperature = temperature;
    else if (isK3) body.temperature = 1;
    if (tools && tools.length) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }
    const post = (b: unknown) =>
      fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify(b),
        signal,
      });
    let res = await post(body);
    let text = await res.text();
    // The one known-recoverable refusal: this model pins temperature to 1.
    if (!res.ok && /temperature/i.test(text) && body.temperature !== 1) {
      res = await post({ ...body, temperature: 1 });
      text = await res.text();
    }
    if (!res.ok) throw new Error(`Moonshot refused (${res.status}): ${text.slice(0, 600)}`);
    const data = JSON.parse(text) as { choices?: { message?: CompleteResult['message']; finish_reason?: string }[]; usage?: unknown };
    const choice = data.choices?.[0] ?? {};
    return {
      message: choice.message ?? { role: 'assistant', content: '' },
      finishReason: choice.finish_reason,
      usage: data.usage,
    };
  };
  return guardComplete(providerComplete, { onBlocked });
}
