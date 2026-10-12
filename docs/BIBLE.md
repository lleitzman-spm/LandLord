# LandLord — the design bible

The name is **LandLord**: one word, two capitals, always.

## One paragraph

A real-time kingdom builder about rent. The Crown grants you a muddy hamlet with three hovels. You build houses, fill them with tenants, collect on Rent Day, fix what breaks, and settle the strange disputes that tenancy produces in a world with griffins. As you rise from **Reeve** to **Knight** to **Baron** (later Duke, King) you hire a household of delegates, and you rule them **by word**: you speak, they interpret through their temperament, read back what they understood, and act. It looks like a painted miniature town on a candle-lit war table. It is a comedy played perfectly straight: every situation is a real property-management situation in costume.

Not a card game. Not a real tool. No real data. 100% a game.

## Pillars

1. **Build your kingdom.** The joy is watching mud become a town you laid out yourself.
2. **Rule by word.** Kings rule from a throne by speaking. People are handled by talking to them; buildings are placed by hand.
3. **Nested loops.** Each rank adds a layer of people between you and the work. The lower loops never disappear; they keep running on the table and you can drop into any of them.
4. **Delight in the small things.** Goblin squatters. The unauthorized griffin. The wizard who left the tower purple. An elf who wants a 400-year lease.
5. **The world is fair.** A fixed rules engine owns every number. The model only interprets words into moves the engine allows, and gives characters their voices.

## The clock

- One month = 90 real seconds at 1x (3 s per day, 30 days). Speeds: pause, 1x, 2x, 4x. While you are speaking the world **crawls** (0.1x).
- **Rent Day is the 1st.** The month is also the table's "day": dawn light on Rent Day, golden afternoon mid-month, blue dusk, a short night at month end when figures sleep and windows glow, then dawn and the bell.
- Four seasons of three months. Winter: snow, frozen wells, burst pipes. Summer: dragon season, heat, festivals. Seasons re-dress the table.
- The year starts on the 1st of Thawmonth (spring). Months: Thawmonth, Seedtide, Bloomtide, Highsun, Goldgrass, Dragonsheat, Harvestmoon, Leaf-fall, Mistmonth, Firstfrost, Deepwinter, Candlenight.

## The nested loops

| Rank | Realm | You personally | Delegated | The new loop |
|---|---|---|---|---|
| Reeve | Hamlet | Walk to doors, collect purses, patch roofs, show vacancies | Nothing | Survive Rent Day |
| Knight | Village | Hire and instruct a Mason, Bailiff, Crier | Repairs, collections, showings | Managing people with flaws |
| Baron | Town | Hold court, set policy, hire a Steward | Day-to-day judgment calls | Policy and its loopholes |
| Duke (later) | Duchy | Grant fiefs to vassals | Whole settlements | Vassals with ambitions |
| King (later) | Kingdom | Decrees, other crowns, war | Everything | Law, diplomacy, what the treasure was for |

Tonight's scope is Reeve, Knight and Baron, complete and polished. Duke and King exist in the types and the rank table so nothing needs rebuilding later.

**The Rent Day loop changes with rank** and is the clearest example of nesting:
- Reeve: every paying household sets a purse on the doorstep. *You* (a figure on the table) walk door to door to collect them. Purses left too long get spent at the tavern and become arrears.
- Knight: the Bailiff walks the round for you. You watch, and deal with the ones who did not pay.
- Baron: with a Steward and a Counting House the tenants queue at your door to pay. You only hear about exceptions.

## What you do

**Build (by hand).** Buy parcels, place buildings on the grid, paint roads, clear trees. Housing (hovel, cottage, burrow, longhouse, stone hall, townhouse, treehouse, wizard tower), trade premises leased to a tradesperson (market stall, bakery, smithy, windmill, tavern, apothecary), amenities that raise desirability nearby (well, garden, shrine, notice board, chapel, statue of yourself, watchtower, stocks), staff buildings, and your seat (hut, manor, keep). Buildings decay; disrepair drives complaints.

**Lease.** A vacancy that is listed draws applicants (more with renown, a Crier, a notice board, fair rent). An applicant walks in from the gate and waits at the door to be shown the place. Then you decide: welcome them, haggle the rent, check references (reveals hidden quirks), or turn them away. You set the asking rent per building with a market hint. Higher rent means more coin, less happiness, longer vacancies.

**Maintain.** Things break: leaks, chimneys, rot, rats. Each shows as a pin on the building with a timer. Send someone, or say what you want done. Ignored repairs escalate.

**Collect and enforce.** Late rent walks a pipeline: grace, then a ruling (wait, late fee, payment plan, forgive, Notice to Quit), then the Reeve's Court (slow: 45 days), then a writ (evict, coin for keys, or mercy).

**Settle up.** At move-out the place is inspected and you rule on the surety (deposit): return it, keep the fair cost, or keep the lot and hear about it at the well.

**Speak.** See "Ruling by word".

## The numbers that matter

- **Coffers** (crowns). **Rent roll** (sum of lease rents per month).
- **Renown** 0..100: your name among tenants. Drives applicant quality and quantity. Fair dealing raises it; evictions, kept sureties and broken oaths lower it.
- **Crown Favor** 0..100: pay the quarterly tribute, pass the assessor. At zero the charter is revoked.
- **Happiness** per household, **condition** per building, **desirability** per building (auras, roads, condition, nuisances).
- **The rival lord** next door poaches households when his renown beats yours.

## People

**Households** are named characters: species, trade, income, household size, public tags (widow, veteran, newlyweds...), and hidden **traits** (deadbeat, handy, litigious, secret pet, pyromaniac...) revealed by screening, by time, or in conversation. They **remember** what you did to and for them, and bring it up years later.

**Species** arrive with rank: humans and halflings (Reeve), dwarves and goblins (Knight), elves and ogres (Baron). Each has a temper as tenants (see STYLE.md).

**Delegates**: Mason (repairs, building), Bailiff (collections, notices, evictions, squatters), Crier (fills vacancies), Steward (books, pricing, screening, the Counting House). Each has a **temperament** that colours how they interpret you: a Bodger mason patches everything; an Iron bailiff hears "deal with the late payers" as eviction; a Snob crier turns away goblins and gets you in trouble with the Fair Hearth Edict. Each has skill, wage, loyalty, and (from Baron) **authority** to use their own judgment.

## Ruling by word

- **Orders.** "Hob, fix the miller's roof before the rains." One-off jobs for a delegate.
- **Standing orders.** "Agnes, never evict a widow in winter." Said once, holds until revoked. *This is the automation system.* Each is stored as a rule the engine can evaluate (what it governs, conditions, choose/never an option).
- **Read-back.** Before acting, the delegate repeats what they understood, in their own voice and through their temperament. Weighty things (standing orders, evictions, big spending) wait for your "aye". A bad outcome is your wording, never a coin flip.
- **Audiences.** A petitioner walks to your seat: the tenant with the griffin, the goblin chief, the wizard about the surety. You talk it out and speak your ruling. No option buttons. Your Steward whispers a few things you *might* say (click to fill the box); those whispers are also how the game stays playable with no model.
- **Oaths.** Anything you promise in conversation goes in the Ledger of Oaths. Keep it: renown, loyalty, a fond memory. Break it: word spreads.
- **Policies.** Grace days, late fee, surety size, pets, screening: realm-wide knobs set by speech or in the ledger.

Input: hold the talk key (or the mic button) and speak; or type. Without a model the offline parser understands plain commands and the whispers still work.

## Incidents

Everything that "comes up" is an **incident**: a pin on a building with an icon and a timer (dispatch someone), or an **audience** (a petitioner comes to talk). Every incident has 2 to 4 outcomes, each with effects, and what happens if you ignore it. System decisions (late rent, applicants, sureties, squatters, pets, renewals, repairs) are incidents too, so that standing orders and temperaments can settle them across all variants.

Rate: roughly one random incident a month at the start, rising with households to about five. Roughly one in four is an audience.

## Pressure and failure

- **Tribute** to the Crown each quarter, by rank. **Wages** and **upkeep** monthly.
- **Vacancy has teeth**: empty buildings decay faster and draw squatters (goblins, after 40 days).
- **Steward's Peace** (forgiving): when the coffers run dry the moneylender extends credit at interest. Persistent default costs favor, and at the bottom you are demoted a rank. The reign never ends against your will.
- **Iron Crown** (permadeath): one save. Bankruptcy or a revoked charter ends the reign. The Dynasty Hall records every past reign and how it fell; your heir starts the next with one heirloom. Each run rolls a different map, starting tenants, staff candidates and rival.

## Progression

Each rank has a **charter** of goals (households, rent roll, renown, favor, staff, oaths kept). Meet them all and the Crown's herald arrives for a short ceremony: new title, new land for sale, new buildings, new species, new delegates, a bigger seat, a bigger tribute.

## Later (designed for, not built tonight)

Duke: vassals who run whole settlements and have their own ambitions. King: decrees that everyone reads literally ("no beasts larger than a dog" and someone arrives with a very small dragon), other kings, treaties spoken aloud and bound by the same ledger of oaths, and war: treasure hires mercenaries and siege engines, renown becomes loyalty (well-treated tenants muster; squeezed ones open the gates), and conquered land comes with its tenants and their leases. After King: sandbox.
