/** Incident visuals: what the player sees on or around a building while an incident lasts. */
import type { VisualHandle, VisualHost, RenderCtx } from '../api';
import type { VisualId } from '../../data/ids';
import { runVisual, type Build } from './kit';
import { griffinRoof } from './griffin';
import { goblinsWindows } from './goblins';
import { smallDragon } from './dragon';
import { ghost } from './ghost';
import { fire, blackSmoke } from './fire';
import { taxCart } from './cart';
import { rats, chickens, sheep, bees, bats, storkNest } from './critters';
import { purplePaint, sparkles, curseCloud, cauldron, toadstoolRing, mushrooms, vines, gargoyle } from './magic';
import { bunting, party, crownBanner, laundry, scarecrow } from './festive';
import { leak, holeRoof, crackedWall, boarded, flood, mud, snowedIn, frozen, quarantine, graffiti } from './trouble';

const BUILDERS: Record<VisualId, Build> = {
  griffin_roof: griffinRoof, goblins_windows: goblinsWindows, small_dragon: smallDragon, ghost, fire, black_smoke: blackSmoke, tax_cart: taxCart,
  rats, chickens, sheep, bees, bats, stork_nest: storkNest,
  leak, hole_roof: holeRoof, cracked_wall: crackedWall, boarded, flood, mud, snowed_in: snowedIn, frozen, quarantine, graffiti,
  purple_paint: purplePaint, sparkles, curse_cloud: curseCloud, cauldron, toadstool_ring: toadstoolRing, mushrooms, vines, gargoyle,
  bunting, party, crown_banner: crownBanner, laundry, scarecrow,
};

export function createVisual(id: VisualId, host: VisualHost, ctx: RenderCtx): VisualHandle {
  return runVisual(id, host, ctx, BUILDERS[id] || (() => ({ update() { /* nothing */ } })));
}
