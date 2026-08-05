/**
 * Deploy a War Game into `data/chronicle.json` from the terminal.
 *
 *   npm run build:wargame && node tools/deploy-wargame.mjs [seed] [--grand]
 *
 * `--grand` deals the GRAND MUSTER instead — the full pm-setting library, and
 * the only world in which the whole clerk fleet has work. Five reasoning seats
 * grip commitments that exist ONLY in that library (col-desk's
 * collections-ladder, viol-desk's lease-violation, and the library halves of
 * bd-desk / res-desk / acct-desk), so on a plain War Game they are idle by
 * construction, not by fault. Smoke-testing the fleet means `--grand`.
 *
 * Note it SWAPS the chronicle's catalog and flows to the library, exactly as
 * the footer's "Deploy the muster" does — the store keeps a restore snapshot
 * so Reset can put founding back.
 *
 * The clerk fleet only works on simulated `wg/<seed>` data, and until now the
 * only way to deal a world was to click "Deploy a game" in the browser footer.
 * That made the fleet unrunnable headlessly — you could not smoke-test the
 * clerks in a fresh container without first driving a UI. This is the same deal
 * the store performs (`chronicleStore.deployWarGame`), lifted to the command
 * line: same generator, same economy, same household, same `dealt` guard so a
 * redeploy of a seed does not double-count.
 *
 * The chronicle is WORKING FLUID (CLAUDE.md) — this mutates it on purpose.
 * Restore with `git checkout -- data/chronicle.json` when the run is done.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

// From the bundle, not from src/: the domain's imports are extensionless and
// raw Node cannot resolve them. `npm run build:wargame` first.
const CORE = resolve(dirname(fileURLToPath(import.meta.url)), '../dist-wargame/wargame-core.mjs');
const { normalizeChronicle, economyOf, dealtGame, generateWarGame, generateGrandMuster,
        WAR_HOUSEHOLD, isHouseholdUpkeep } =
  await import(pathToFileURL(CORE).href).catch(() => {
    console.error('Could not import the war-game core. Build it first:\n  npm run build:wargame');
    process.exit(1);
  });

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const path = resolve(root, 'data/chronicle.json');
const grand = process.argv.includes('--grand');
const seed = (process.argv.slice(2).find((a) => !a.startsWith('--')) || (grand ? 'grand-smoke' : 'smoke')).trim();

const chronicle = normalizeChronicle(JSON.parse(readFileSync(path, 'utf8')));

const relay = chronicle.flows.find((f) => f.key === 'move-out-relay') ?? chronicle.flows[0];
if (!relay) {
  console.error('No flow templates in the chronicle — nothing to deal a relay from.');
  process.exit(1);
}
const dispatch = chronicle.flows.find((f) => f.key === 'vendor-dispatch');

let setting = null;
if (grand) {
  setting = JSON.parse(readFileSync(resolve(root, 'data/library/pm-setting.json'), 'utf8'));
}

const game = grand
  ? generateGrandMuster({
      seed,
      end: new Date().toISOString(),
      flows: setting.flows,
      catalog: setting.catalog,
      plan: setting.plan,
      economy: economyOf(chronicle),
      dealt: dealtGame(chronicle.events, seed),
    })
  : generateWarGame({
  seed,
  end: new Date().toISOString(),
  relay,
  dispatch,
  catalog: chronicle.catalog,
  economy: economyOf(chronicle),
  dealt: dealtGame(chronicle.events, seed),
});

const next = {
  ...chronicle,
  // The muster swaps the whole ontology; a plain game leaves it alone.
  ...(grand ? { catalog: setting.catalog, flows: setting.flows } : {}),
  events: [...chronicle.events, ...game.events],
  money: chronicle.money.some((m) => m.wg === game.seed)
    ? chronicle.money
    : [...chronicle.money, ...game.money],
  treasury: {
    upkeeps: [
      ...chronicle.treasury.upkeeps.filter((u) => !isHouseholdUpkeep(u)),
      ...WAR_HOUSEHOLD,
    ],
  },
  wargame: {
    seed: game.seed,
    now: game.now,
    deployedAt: new Date().toISOString(),
    tally: game.tally,
    doors: game.doors,
    // What stood BEFORE the swap, so Reset can restore founding rather than
    // the library (the store keeps the ORIGINAL across a redeploy).
    ...(grand
      ? {
          restoreCatalog: chronicle.wargame?.restoreCatalog ?? chronicle.catalog,
          restoreFlows: chronicle.wargame?.restoreFlows ?? chronicle.flows,
        }
      : {}),
  },
};

writeFileSync(path, JSON.stringify(next, null, 2) + '\n');
console.log(`deployed ${grand ? 'GRAND MUSTER' : 'war game'} wg/${game.seed} — game-now ${game.now}`);
if (grand) console.log(`catalog ${chronicle.catalog.length} → ${setting.catalog.length} rows, flows ${chronicle.flows.length} → ${setting.flows.length}`);
console.log(`events ${chronicle.events.length} → ${next.events.length}  (+${game.events.length})`);
console.log(`money rows ${next.money.length}, doors ${game.doors?.length ?? 0}`);
console.log('tally', JSON.stringify(game.tally));
console.log('\nrestore when done:  git checkout -- data/chronicle.json');
