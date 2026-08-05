// A cheap proof that the brain answers from this machine, and that budgets
// leave it room to speak past its own reasoning. Run:  node harness/selftest.mjs
import { complete } from './moonshot.mjs';
import { config } from './config.mjs';

const { message, usage, finishReason } = await complete({
  messages: [{ role: 'user', content: 'Reply with exactly one word: pong.' }],
  maxTokens: 2048,
});

console.log('model :', config.model);
console.log('reply :', JSON.stringify(message.content));
console.log('finish:', finishReason);
console.log('usage :', JSON.stringify(usage));
