# LandLord

A small medieval kingdom, run on rent.

You are a Reeve with a charter, three hovels and a leak. Tenants arrive with trades, grievances and the occasional griffin. You set the rents, mend the roofs, hear petitions, swear oaths you may regret, and rise (Reeve, Knight, Baron) until you no longer do the work yourself but tell your Steward, Bailiff, Mason and Crier how you want it done, in your own words. They will do exactly what you said. That is the trouble with them.

The realm sits on a candle-lit table as a living miniature. Everything in it is drawn and synthesised in code: no image, audio or model files.

**It plays in full with no key and no network.** A model only gives the court a wider vocabulary when you speak freely to it. Without one, a built-in parser understands plain orders and the whole game works.

## Run it

```
npm install
npm run build        # bundles src/main.ts into dist/game.js and copies index.html
npx wrangler dev     # serves dist/ and the two small API routes locally
```

`dist/` is plain static files. Any static server will do if you do not want the Worker; the court then runs on its offline parser.

Other tools:

```
node tools/check.mjs [paths]            # typecheck
node tools/build.mjs --dev              # unminified build
npx tsx tools/validate-content.ts       # lint the written content
npx tsx test/<file>.test.ts             # sim and word-layer tests (node)
npx tsx src/app/worker.test.ts          # the Worker's request handling
```

## Deploy it

`wrangler.jsonc` ships disarmed: no route, no account, no hostname. To host your own court (Wrangler 4.36 or later, and a hostname in a zone on your Cloudflare account):

```
npx wrangler login
npm run deploy -- --domain <your-host>       # build, upload, attach the custom domain
npx wrangler secret put ANTHROPIC_API_KEY    # optional: Claude speaks for the court
npx wrangler secret put COURT_KEY            # optional: players must type this key under Settings
```

Pass the same `--domain` on every deploy, or put `"routes": [{ "pattern": "<your-host>", "custom_domain": true }]` in `wrangler.jsonc`. Without `ANTHROPIC_API_KEY` the Worker uses Workers AI through its `ai` binding; without either, the game says so quietly and carries on.

For local secrets, copy `.dev.vars.example` to `.dev.vars`. Keys live in Worker secrets only, never in this repository.

The Worker's one model route (`POST /api/word`) is same-origin only, size-capped, rate-limited per address, and never repeats an upstream error or the key.

## What is where

```
index.html        the page: fonts, favicon, the boot veil
src/
  main.ts         boots everything; the frame loop; the AppAPI
  app/            saves, settings, the Dynasty Hall, the error page, hot-update handover
  sim/            the rules. Pure and deterministic; runs in node. types.ts is the contract
  data/           written content and balance, typed, no logic
  render/         the diorama (three.js)
  ui/             the manuscript interface (plain DOM and CSS)
  word/           speech to orders: the model call, the offline parser, validation
  audio/          every sound, synthesised with WebAudio
  server/         the Cloudflare Worker: static assets, /api/court, /api/word
  dev/            fixtures and gallery pages for development; not shipped
tools/            build, typecheck, headless screenshots, bots
test/             node tests
docs/             BIBLE.md (design), ARCHITECTURE.md (structure), STYLE.md (voice and look)
```

## Saves

Reigns are kept in the browser's `localStorage`, one slot per mode, written every thirty game days, when the tab is hidden, and when you return to the title. Under the Iron Crown there is one reign and one save: when it ends the save is struck out, the reign goes into the Dynasty Hall, and your heir inherits a single heirloom.

## Licence

See `LICENSE`.
