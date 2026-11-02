# LandLord: development brief

Reorientation prepared 2 November 2026 from the user's decisions in this conversation and a fresh repository inspection. This is the video game. The operations application on `main` is unrelated and supplies no game requirements.

## Verified repository state

- The active checkout is now `game`, based on remote `origin/game` at `f63a1df18e5f9baffd1151ced6e01ef800dd3f6e`.
- This baseline contains the TypeScript/Three.js game, a deterministic simulation, DOM interface, offline command interpretation, written incidents, synthesized audio, build tools and tests. The README starts with three granted hovels. These are inspected capabilities, not a fresh runtime test result.
- Earlier conversation work included market acquisition changes, an estate mechanics study, professional/property concepts and Bellwether architectural studies. Those additions are absent from this checkout and the fetched game branch. No attached artifacts were returned by the task artifact listing. Do not claim them recovered, integrated or currently tested.
- The conversation preserves design decisions and prior reports, not a substitute for source files or assets. Recovery, reconstruction and new work must be distinguished.
- No build, test suite or Unity toolchain validation was run during this reorientation. Earlier checks are historical evidence only.

## Confirmed game direction

### The role and the abstraction

The player is a landlord, later a territorial ruler. Commercial tenants operate their own businesses. Do not expand into merchant play, production chains or player-operated business ventures. Property, tenancy, improvements, rights, delegation and political obligations produce the decisions.

Use a compact set of meaningful property/household effects. A business tenancy can affect income, wear, danger, amenities or useful local services without simulating its stock and production. Preserve consequential title, ownership, work and agreement history; do not individually model every ambient action or physical object. Existing effects and understandable causal explanations take priority over adding new meters.

### Acquiring and improving property

Start with a neighbourhood choice and a plausible source of capital sufficient for a small initial portfolio. Exact opening story and balance are not locked. Investigate before buying: personal investigation consumes time, professionals cost money and can save time. Major transactions can negotiate meaningful terms; routine deals should be quick. Development uses authored projects with trade-offs, not room-by-room design.

Inspections uncover persistent facts; they do not reroll the past. Searchable records let the player make connections personally, including prior work by known vendors. Distinguish actual facts, evidence and character knowledge. Random future events may create new persistent consequences.

### Tenants and professionals

Households have consequential milestones without a complete life simulation. Professionals vary in skill, specialty, availability, habits and honesty. Procedural combinations can enhance replayability while each run's people and work remain consistent. A costly expert may produce a lower total bill.

Delegation requires explicit scope, spending authority and priorities. Work not planned or delegated does not happen automatically. Staff initially earn wages and need somewhere to live; housing is not automatically part of compensation. Revenue shares can scale delegated compensation later; vassals may receive revenue shares or land grants.

Tenant-funded improvements are a promising but not fully specified lease bargain: a tenant may fund an agreed permanent improvement in exchange for a longer term or rent concession. This is not approval of business operation or a detailed construction-finance system.

### Institutions, factions and authority

Institutional relationships can open property opportunities as well as obligations. People within an institution can have competing priorities. The user welcomes alignment toward or away from guilds, church interests and other factions through consequential dealings. Exact faction count, denominations, membership rules and relationship representation remain open.

Office opportunities can be discovered and pursued, and can also be brought to the player's attention through invitations and local leads. Both introductions should reference the same world opportunity. Discovery is distinct from appointment.

Private ownership sits inside nested fiefs. Lords and kings can own individual properties while governing land other people own. Municipal services remain distinct from fief authority. Protection dues, utilities, fire/danger obligations and roads connect property operation to larger responsibilities.

Security consumes resources and protects the ability to earn and rule. Priorities and standing instructions guide limited coverage. All soldiers and guards are men, including authored and procedurally generated characters and visual assets.

Progression is tightly correlated with income, properties and capabilities, growing through neighbourhood, town, fief and kingdom. Endgame armies use logistics and command decisions affecting real places. Early estates face levies, requisition, taxes and invasion. Pressure can be unpredictable, with meaningful mitigation rather than automatic defeat from one event; regimes can lose permanently. Conquest, confiscation, local resistance, tax compliance and vassal compensation involve trade-offs.

Financial distress permits selling down and rebuilding; genuine failure remains possible.

### Characters, mystery and tone

- The Sam Zell-inspired distressed buyer is always friendly and offers merciless distress prices. His selected visual foundation is the older man with a giant key-cane. The fictional spelling/name and precise balance-sheet implementation are not settled. Research real references before asserting details; use fictional medieval counterparts and do not repeat unverified allegations as facts.
- Nessa's warm diplomacy includes clearly explaining when the owner's asking rent is the problem. Oswin is a skilled maintenance concept with meaningful availability constraints. A contractor hiding shortcuts is an approved procedural pattern, not an immutable fact about Bram.
- Introduce the clergy through ordinary property dealings. Ancient records, privileges and some unexplained phenomena accumulate gradually, with optional leads. Do not turn every clergy transaction into a supernatural event or explain every oddity as fraud.
- Dry, understated medieval comedy. Real-estate allusions remain offhand and sparse. No American politics. No em or en dashes in player-facing prose. The user explicitly permits church/clergy themes and feudal politics/war; earlier blanket exclusions are superseded.

## Presentation and tooling direction

Downloadable PC game first. The existing browser implementation is a reference and possible source of reusable rules, not a reason by itself to avoid a suitable engine. Unity evaluation was the working direction; an installed, licensed, validated Unity workflow has not been established here. Do not silently substitute a different engine or claim the engine decision/toolchain is complete.

The user welcomes engines, editors, authored models, textures, animation and sound tools. The earlier all-assets-in-code constraint was a misunderstanding of a preference to use subscription-covered inference rather than separately metered generation services. Miniature presentation is optional. A hybrid of rich illustrated places/characters and a simpler living 3D town is a promising direction, not a completed production pipeline.

Illustrations and simpler 3D assets must agree on building shape, footprint and structural features. Avoid clay-like materials. Vary character poses, faces and viewing directions; choose architectural camera angles deliberately rather than repeating right-facing views. Do not casually mirror a property whose access and neighbours matter.

## Approved next milestone

Stage approved by the user on 2 November 2026: Unity remains first choice subject to a bounded toolchain check; build the coherent opening property loop; give the player room to explore, with pressure building as commitments accumulate. See `EXECUTION-PLAN.md` for delivery and review criteria. The detailed content and numeric balance below remain proposals within that mandate.

One short, coherent playable property-management slice, using a neighbourhood and a small authored property set. The player investigates an opportunity, buys, lets or inherits a tenancy, commissions scoped work, collects rent, responds to an institutional/property trade-off and chooses a next investment. The result should make money, time, knowledge and delegation matter together.

Commercial activity remains tenant-operated. Include one institutional relationship with distinct interests, not a complete faction simulation. Territorial promotion and armies inform the architecture and later plan; they are not required implementations in the first milestone.

Before major implementation:

1. Preserve/recover the actual baseline and inventory missing earlier work. Report recovery versus reconstruction. Put deliverables under version control so a fresh workspace can resume from them.
2. Settle the engine path with a bounded toolchain and build check. Distinguish unavailable infrastructure from an architectural rejection of Unity.
3. Agree the playable milestone and its review criteria, then proceed independently on code, narrative and coherent assets.

Candidate review criteria: a fresh player can finish the property loop; choices change subsequent circumstances; meaningful records and instructions survive save/reload; commercial tenants require no merchant micromanagement; screenshots and a short walkthrough show coherent art/UI; relevant tests and the intended build pass. A PC build requires a validated PC toolchain, not a browser screenshot renamed as completion.

## Verification after reorientation

On 2 November 2026, locked reference dependencies installed, `npm run build` passed, the full TypeScript compiler passed, and content validation checked all 243 incidents. Seven existing test entrypoints passed 416 checks in total. Tests ran through `node --import tsx` because the `tsx` CLI's IPC socket was denied by the command sandbox. These results validate the preserved reference, not Unity or the proposed opening slice. See `HANDOFF-GAME.md` for current state.

## Working agreement for an autonomous stage

The user wants sustained progress across concurrent lanes, concrete review material and no repeated prompting for routine decisions. Use subagents where useful and choose their model/effort for the task. Show actual candidates, assets and encounters, not announcements that unseen work exists. Routine implementation and content choices can follow this brief; user attention is most useful for scope, engine commitment, core-loop changes and major creative forks.

Separate confirmed direction from proposals. Maintain a current handoff with what exists, what was actually checked and what remains. Save and version meaningful deliverables incrementally. Group questions at milestones rather than repeatedly stopping individual lanes. Do not treat silence as approval of a required decision.
