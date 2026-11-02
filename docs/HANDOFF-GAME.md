# Game handoff

Checkpoint: 2 November 2026. This is the video game; `main` is an unrelated operations application. Execution branch: `codex/opening-slice`, based on original `game` revision `f63a1df18e5f9baffd1151ced6e01ef800dd3f6e`.

## Mandate and current work

User approved Unity-first with a bounded toolchain check, an integrated opening property loop of about 20 to 30 minutes, and room to explore with pressure building through chosen commitments. Read `DEVELOPMENT-BRIEF.md` and `EXECUTION-PLAN.md` before inherited documents. No new Unity gameplay implementation is claimed.

The opening packet in `content/OPENING-PACKET.md` is authored content for review and implementation, not delivered gameplay or fixed balance. Its 360-crown purse and three offers at 150/90/45 allow all seven nonempty purchase combinations. Buying all and paying the listed repairs leaves 49 crowns before extra reports or other work. No inherited rent or jurisdiction was invented to finance purchases.

## Recovery inventory

Verified local and remote game source is the original browser reference. Earlier conversation reports describe acquisition code, an estate study and generated art, but those additions are absent from this fresh checkout and remote game tip. The task artifact listing returned no attached artifacts. No tracked PNG, GLB, Blender, FBX, GIF or MP4 asset files were found in this game baseline. Do not call missing work recovered. Original images may still be visible in conversation, but local source paths are not evidence that files exist here. Recovery or careful reconstruction remains a separate lane.

## Checks actually run

- `npm ci --cache /workspace/.npm-cache --no-audit --no-fund`: passed using the supported network approval flow. Initial sandboxed attempt could not connect to the configured proxy.
- `npm run build`: passed.
- `./node_modules/.bin/tsc --noEmit --pretty false -p tsconfig.json`: passed.
- `node --import tsx tools/validate-content.ts`: passed, 243 incidents checked.
- Existing test entrypoints via `node --import tsx`: sim-crown 53, sim-decide 31, sim-people 38, sim-world 41, word-audience 47, word-core 152, Worker 54. Total 416 passed.
- Opening packet arithmetic checked for all seven nonempty purchase combinations; minimum reserve after listed work is 49 crowns. Reports and other expenses are extra.
- No fresh browser interaction check, Unity import, Play Mode or standalone PC test ran. Do not transfer historical browser claims to this checkpoint.

## Unity blocker and concrete remedy

`UNITY-PREFLIGHT.md` records fresh checks. No usable Editor/Hub found; external license entitlement is unknown, not denied. Official Unity download, metadata, packages and license routes returned proxy CONNECT 403. A second Hub request after the draft save still returned 403; current enforced policy still had no Unity hosts.

Saved environment draft preserves existing custom domains and adds `packages.unity.com` and `license.unity3d.com`; earlier Unity official download/documentation hosts were already pending in that draft. The draft save succeeded and returned `requires_publish: true`. Saving did not apply it. Available platform tools can read/edit the draft but expose no apply/publish operation. User action: review/save pending network settings and publish the environment. Then re-read runtime status and retry official access before proceeding. No proxy bypass or unverified distribution is authorized as a workaround.

Reusable startup instructions were also corrected in the saved draft to remove missing helper paths and distinguish this reference from the new Unity milestone. Configuration publication and fresh-task restoration have not been verified.

## Resume sequence

1. Inspect Git state, preserve changes and read the brief/plan.
2. If policy has been applied, retry official Unity metadata and distributions, verify supported host and licensing workflow, then choose a concrete editor version and validate a minimal PC build. If still blocked, report that exact state; do not silently change engines.
3. Confirm the target PC OS before platform-specific delivery. This is still unknown; it does not block content and architecture work.
4. Recover approved assets where possible and reconstruct only essentials with clear provenance. Do not ask the user to make routine creative decisions already covered by the brief.
5. Build the integrated opening loop after the engine gate. Review at the verified engine/build path, integrated loop and art/playable pass.
