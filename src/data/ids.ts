/**
 * Canonical id lists. FROZEN: every module switches on these. Do not rename
 * or remove an id; adding one needs the integrator's say-so (it means new
 * meshes, icons, sounds and data everywhere).
 */

export const BUILDING_TYPES = [
  // housing (leasable to households)
  'hovel', 'cottage', 'longhouse', 'townhouse', 'burrow', 'stonehall', 'treehouse', 'wizard_tower',
  // commercial (leasable to a trade)
  'smithy', 'mill', 'bakery', 'tavern', 'market_stall', 'apothecary',
  // amenities (raise desirability nearby)
  'well', 'chapel', 'garden', 'statue', 'notice_board', 'stocks', 'watchtower', 'shrine',
  // staff buildings (one per role; hiring needs it)
  'masons_yard', 'bailiffs_post', 'criers_stand', 'counting_house',
  // the ruler's seat (level 1 Reeve's hut, 2 manor, 3 keep)
  'seat',
] as const;
export type BuildingType = typeof BUILDING_TYPES[number];

export const SPECIES = ['human', 'halfling', 'dwarf', 'goblin', 'elf', 'ogre'] as const;
export type Species = typeof SPECIES[number];

export const TRADES = [
  'farmer', 'shepherd', 'laborer', 'miller', 'baker', 'blacksmith', 'carpenter', 'weaver', 'brewer',
  'innkeeper', 'merchant', 'bard', 'alchemist', 'wizard', 'hedge_witch', 'scribe', 'guard', 'hunter',
  'fishmonger', 'beekeeper', 'gravedigger', 'adventurer', 'cheesemonger', 'candlemaker', 'ratcatcher',
  'fortune_teller', 'tax_clerk', 'herbalist',
] as const;
export type TradeId = typeof TRADES[number];

/** Household quirks. Hidden until revealed by screening, time, or conversation. */
export const TRAITS = [
  'punctual', 'forgetful', 'deadbeat', 'ghost', 'haggler', 'litigious', 'complainer', 'stoic',
  'handy', 'messy', 'tidy', 'hoarder', 'nocturnal', 'musician', 'gossip', 'generous', 'proud',
  'pet_lover', 'secret_pet', 'pyromaniac', 'subletter', 'entrepreneur', 'gardener', 'brawler',
  'pious', 'cursed', 'lucky', 'loyal', 'flighty', 'saint', 'snitch', 'sleepwalker',
] as const;
export type TraitId = typeof TRAITS[number];

/** Public facts about a household that orders can key on ("never evict a widow in winter"). */
export const TENANT_TAGS = [
  'widow', 'elder', 'veteran', 'newlyweds', 'large_family', 'scholar', 'noble_born', 'stranger',
  'apprentice', 'pilgrim',
] as const;
export type TenantTag = typeof TENANT_TAGS[number];

export const TEMPERAMENTS = [
  // mason
  'perfectionist', 'bodger', 'dreamer', 'steady',
  // bailiff
  'iron', 'soft', 'grasping', 'lawful',
  // crier
  'honeytongue', 'honest', 'snob', 'bellower',
  // steward
  'pennypincher', 'openhanded', 'bythebook', 'schemer',
] as const;
export type TemperamentId = typeof TEMPERAMENTS[number];

export const PET_KINDS = ['cat', 'dog', 'goat', 'chicken', 'pig', 'owl', 'griffin', 'small_dragon', 'mimic', 'giant_snail', 'wolf'] as const;
export type PetKind = typeof PET_KINDS[number];

export const SQUATTER_KINDS = ['goblins', 'bandits', 'cultists', 'raccoons', 'bard_troupe', 'ghost'] as const;
export type SquatterKind = typeof SQUATTER_KINDS[number];

/** Things the renderer can stick on / around a building while an incident lasts. */
export const VISUALS = [
  'griffin_roof', 'goblins_windows', 'purple_paint', 'rats', 'fire', 'flood', 'black_smoke', 'leak',
  'hole_roof', 'vines', 'ghost', 'sparkles', 'bees', 'chickens', 'small_dragon', 'cracked_wall',
  'snowed_in', 'frozen', 'party', 'bats', 'mushrooms', 'boarded', 'quarantine', 'sheep', 'mud',
  'curse_cloud', 'crown_banner', 'tax_cart', 'stork_nest', 'laundry', 'gargoyle', 'toadstool_ring',
  'cauldron', 'scarecrow', 'graffiti', 'bunting',
] as const;
export type VisualId = typeof VISUALS[number];

/** UI + map-pin icons (drawn as manuscript-style SVG). */
export const ICONS = [
  'coin', 'purse', 'hammer', 'trowel', 'scroll', 'bell', 'warning', 'heart', 'crown', 'skull', 'key',
  'broom', 'flame', 'drop', 'rat', 'paw', 'gavel', 'horn', 'quill', 'scales', 'house', 'door',
  'sword', 'shield', 'star', 'hourglass', 'speech', 'eye', 'wheat', 'mug', 'potion', 'wand', 'snow',
  'sun', 'leaf', 'flower', 'cart', 'chain', 'handshake', 'ghost', 'music', 'sack', 'seal', 'book',
  'castle', 'flag', 'lock', 'candle', 'griffin', 'goblin', 'dragon', 'tree', 'road', 'axe', 'bed',
  'sign', 'feather', 'mask', 'pause', 'play', 'fast', 'faster', 'close', 'check', 'cross', 'plus',
  'minus', 'gear', 'mic', 'send', 'map', 'people', 'ledger', 'throne',
] as const;
export type IconId = typeof ICONS[number];

export const EMOTES = ['happy', 'angry', 'sad', 'love', 'alert', 'question', 'coin', 'zzz', 'music', 'sweat', 'idea', 'skull', 'cheer', 'shock'] as const;
export type EmoteId = typeof EMOTES[number];

export const SFX = [
  'coin', 'coins', 'hammer', 'saw', 'bell', 'horn', 'door', 'knock', 'page', 'quill', 'stamp', 'thud',
  'pop', 'whoosh', 'error', 'success', 'fanfare', 'growl', 'squawk', 'squeak', 'splash', 'fire',
  'thunder', 'gavel', 'cheer', 'boo', 'pluck', 'chime', 'click', 'build_done', 'herald', 'place',
  'crumble', 'magic', 'sigh', 'laugh',
] as const;
export type SfxId = typeof SFX[number];

/** Recurring named non-tenant characters who come to court. */
export const NPCS = [
  'crown_herald', 'royal_assessor', 'tax_collector', 'rival_lord', 'moneylender', 'bishop',
  'guild_inspector', 'travelling_wizard', 'goblin_chief', 'commons_warden', 'dragon_adjuster',
  'reeves_court_judge', 'wandering_knight', 'mysterious_stranger', 'your_mother',
] as const;
export type NpcId = typeof NPCS[number];

/** Figurine animation states (render/figurines implements all of them). */
export const ANIMS = [
  'idle', 'walk', 'run', 'hammer', 'sweep', 'carry', 'wave', 'shake_fist', 'cheer', 'bow', 'sleep',
  'talk', 'cower', 'knock', 'read', 'count', 'shrug', 'dance', 'pray', 'point',
] as const;
export type AnimId = typeof ANIMS[number];

export const MONTH_NAMES = [
  'Thawmonth', 'Seedtide', 'Bloomtide',          // spring
  'Highsun', 'Goldgrass', 'Dragonsheat',         // summer
  'Harvestmoon', 'Leaf-fall', 'Mistmonth',       // autumn
  'Firstfrost', 'Deepwinter', 'Candlenight',     // winter
] as const;

export const RANK_TITLES = { reeve: 'Reeve', knight: 'Knight', baron: 'Baron', duke: 'Duke', king: 'King' } as const;
export const REALM_NOUNS = { reeve: 'Hamlet', knight: 'Village', baron: 'Town', duke: 'Duchy', king: 'Kingdom' } as const;
export const ROLE_TITLES = { mason: 'Mason', bailiff: 'Bailiff', crier: 'Crier', steward: 'Steward' } as const;
