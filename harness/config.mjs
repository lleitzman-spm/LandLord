// The harness's config — the agent's connection to its brain. Every secret
// and endpoint comes from the environment, never from git (the walls ruling).
// The brain is swappable by design: point MOONSHOT_MODEL at any model the key
// can see — `kimi-k3` (the flagship reasoner the Regent named), or the cheaper
// code-tuned hands `kimi-k2.7-code` / `kimi-k2.7-code-highspeed`. Direct
// Moonshot API, not OpenRouter (the Regent's ruling).

export const config = {
  apiKey: process.env.MOONSHOT_API_KEY,
  baseUrl: (process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.ai/v1').replace(/\/+$/, ''),
  model: process.env.MOONSHOT_MODEL || 'kimi-k3',
};

/** The book of acts is worthless without a brain to write it. Fail loud and
 *  early when the key is missing, and say exactly where it belongs. */
export function requireKey() {
  if (!config.apiKey) {
    throw new Error(
      'No MOONSHOT_API_KEY in the environment. The key is minted at ' +
        'platform.moonshot.ai and lives as an env secret — never in git, never in chat.',
    );
  }
}
