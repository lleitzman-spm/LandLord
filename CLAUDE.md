# Working in LandLord (the game)

A real-time medieval kingdom builder about rent. The name is `LandLord`: one word, two capitals.

Read `docs/BIBLE.md` (design), `docs/ARCHITECTURE.md` (structure, ownership, working rules) and `docs/STYLE.md` (voice and look) before changing anything.

For the active opening-slice stage, read `docs/DEVELOPMENT-BRIEF.md` and `docs/EXECUTION-PLAN.md` first. They record the user's later decisions and supersede conflicting inherited restrictions, including code-only assets, browser-first delivery and blanket exclusions of clergy or feudal warfare. The unrelated operations app on `main` is not game canon. Keep confirmed direction, proposed content and verified implementation state distinct.

- No real personal data, credentials, hostnames or project identifiers in this repository. It is public.
- Player-facing text: dry, deadpan, no em dashes. See STYLE.md.
- `node tools/check.mjs` typechecks. `npx tsx tools/validate-content.ts` lints content. `npm run build` bundles to `dist/`.
- The sim (`src/sim`) is pure and deterministic; nothing outside it mutates GameState except through `Sim.dispatch(action)`.
