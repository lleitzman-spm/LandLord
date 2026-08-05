/**
 * The war-game dealer, bundled for raw Node — the tooling twin of
 * `operator-core.ts`.
 *
 * The domain modules import each other extensionlessly (`from './catalog'`),
 * which a real bundler resolves and raw Node does not. That is why the harness
 * gets `operator-core.mjs` instead of importing `src/domain` directly. Dealing
 * a War Game needs a different, larger slice of the domain than the operator's
 * readings do, and the operator bundle is imported by the deployed keyholder —
 * so this is a SEPARATE entry rather than more surface on that one.
 *
 * Everything here is already public domain API; this file only gathers it.
 * Built by `npm run build:wargame` to `dist-wargame/wargame-core.mjs`.
 */

export { normalizeChronicle, economyOf } from './domain/chronicle';
export { dealtGame, generateWarGame, generateGrandMuster } from './domain/wargame';
export { WAR_HOUSEHOLD, isHouseholdUpkeep } from './domain/treasury';
export { routeAgentEvents, takenAgentEventIds, SIGNALS } from './domain/agentIntake';
