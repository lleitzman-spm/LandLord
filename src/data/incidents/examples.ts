/**
 * Two hand-written custom incidents. THE QUALITY BAR for every content
 * writer: a real property-management situation, played straight, in costume.
 * Note what they do: specific nouns, a petitioner with a reasonable point, a
 * landlord who is slightly the butt of it, outcomes that are all defensible,
 * and results written dry and in the past tense.
 */
import type { IncidentDef } from '../schema';

export const EXAMPLE_INCIDENTS: IncidentDef[] = [
  {
    id: 'unauthorized_griffin', title: 'The Unauthorized Griffin', category: 'pet', decision: 'pet',
    target: 'tenant', minRank: 'reeve', weight: 0.8, cooldownMonths: 10,
    requires: { buildingCategory: ['housing'], monthsHousedAbove: 2 },
    icon: 'griffin', visual: 'griffin_roof', urgency: 2, timerDays: 14, audience: true, petitioner: 'tenant',
    herald: 'There is a griffin on the roof of {building}. {tenant} says it is "more of a large cat". It has eaten a weathervane.',
    opening: [
      'The lease says no livestock. A griffin is not livestock. A griffin eats livestock. If anything he is pest control.',
      'His name is Gerald and he was here before the lease. Not this lease. A lease. Somewhere.',
      'Before you start: he is house-trained. He simply prefers the roof, on account of being unable to fit through the door.',
    ],
    stance: 'Adores the griffin and argues like a lawyer about the wording of the lease. Will happily pay pet rent and a surety. The neighbours have lost two sheep and are less charmed. If the griffin must go, the tenant goes with it.',
    outcomes: [
      { id: 'pet_rent', option: 'pet_rent', label: 'Charge pet rent and a surety', say: 'He stays. He pays pet rent, and you post a surety against the thatch.',
        intent: 'The ruler allows the griffin in exchange for extra rent, a fee, or a deposit.',
        effects: [{ t: 'pet', add: 'griffin' }, { t: 'rent', pct: 25 }, { t: 'gold', amount: 15, memo: 'Griffin surety' }, { t: 'happiness', amount: 6 }, { t: 'happiness', amount: -4, scope: 'neighbors' }, { t: 'spawn', id: 'griffin_sheep_claim', delayDays: 40, chance: 0.5 }],
        reply: 'Pet rent for Gerald. Done. He will be so proud. He will not understand, but he will be proud.', result: 'Gerald the griffin now pays pet rent at {building}. The roof has been reinforced, by Gerald, by sitting on it.' },
      { id: 'allow', option: 'allow', label: 'Look the other way', say: 'I did not see a griffin. Keep it that way.',
        intent: 'The ruler lets it stay without charge, or pretends not to notice.',
        effects: [{ t: 'pet', add: 'griffin' }, { t: 'happiness', amount: 12 }, { t: 'happiness', amount: -8, scope: 'neighbors' }, { t: 'memory', text: 'You pretended not to see Gerald the griffin.', valence: 2 }, { t: 'spawn', id: 'griffin_sheep_claim', delayDays: 25, chance: 0.8 }],
        reply: 'What griffin? Exactly. You are a wise and observant ruler who observes nothing.', result: 'You did not see a griffin at {building}. The neighbours\' sheep continue to see it.' },
      { id: 'ban', option: 'ban', label: 'The griffin goes', say: 'It goes. This week. I do not care where.',
        intent: 'The ruler orders the griffin removed.',
        effects: [{ t: 'leave' }, { t: 'happiness', amount: 6, scope: 'neighbors' }, { t: 'renown', amount: -1 }],
        reply: 'Then we both go. Come, Gerald. We know when a parish has no vision.', result: '{tenant} left {building} on griffin-back rather than give Gerald up. The roof may recover.' },
    ],
    onExpire: [{ t: 'pet', add: 'griffin' }, { t: 'happiness', amount: -8, scope: 'neighbors' }, { t: 'condition', amount: -8 }, { t: 'spawn', id: 'griffin_sheep_claim', delayDays: 20, chance: 1 }],
    expireText: 'Nobody ruled on the griffin at {building}, so by custom it now lives there. Its name is Gerald.',
  },
  {
    id: 'purple_tower', title: 'The Tower Is Purple', category: 'lease', decision: 'move_out_deposit',
    target: 'tenant', minRank: 'baron', weight: 0.7, cooldownMonths: 14,
    requires: { buildingType: ['wizard_tower'], trade: ['wizard', 'alchemist'], monthsHousedAbove: 6 },
    icon: 'wand', visual: 'purple_paint', urgency: 1, timerDays: 14, audience: true, petitioner: 'tenant',
    herald: '{tenant} is moving out of {building} and wants the surety back. The tower is now purple. All of it. Including, somehow, the inside of the stones.',
    opening: [
      'It was purple when I arrived. Ask anyone. Ask anyone who has also been enchanted to remember it that way.',
      'Purple is a neutral colour in the higher planes. I have, if anything, added value.',
    ],
    stance: 'Insists the purple is "honest wear" for a wizard. Could turn it back in a moment but considers it beneath them unless asked nicely or paid. Vain; flattery works. Keeping the whole deposit from a wizard is legal and unwise.',
    outcomes: [
      { id: 'fair', option: 'fair', label: 'Keep the cost of repainting', say: 'I am keeping what it costs to paint a tower. The rest is yours.',
        intent: 'The ruler keeps a fair deduction for the damage.',
        effects: [{ t: 'deposit', keepPct: 50 }, { t: 'flag', key: 'purple', value: true, scope: 'building' }],
        reply: 'Half. For an improvement. Very well. You will find it does not take paint. Good day.', result: 'You kept half the surety. The tower at {building} remains purple and has rejected three coats of whitewash.' },
      { id: 'return_all', option: 'return_all', label: 'Ask nicely, return it all', say: 'It is a magnificent purple. Would you turn it back, as a courtesy? Then the surety is yours.',
        intent: 'The ruler flatters or asks politely for the wizard to undo it, and returns the deposit.',
        effects: [{ t: 'deposit', keepPct: 0 }, { t: 'visual', remove: 'purple_paint' }, { t: 'renown', amount: 1 }, { t: 'memory', text: 'You asked nicely about the purple tower.', valence: 1 }],
        reply: 'Magnificent. You said magnificent. For that I shall restore it, and throw in a draught-proofing.', result: 'The wizard restored {building} to stone grey with one bored gesture, and left on good terms.' },
      { id: 'keep_all', option: 'keep_all', label: 'Keep the lot', say: 'You dyed a tower. I am keeping every crown.',
        intent: 'The ruler keeps the whole deposit.',
        effects: [{ t: 'deposit', keepPct: 100 }, { t: 'flag', key: 'purple', value: true, scope: 'building' }, { t: 'renown', amount: -2 }, { t: 'spawn', id: 'wizards_parting_gift', delayDays: 6, chance: 0.9 }],
        reply: 'Every crown. I see. I shall leave you something to remember me by. You will know it when it starts.', result: 'You kept the wizard\'s whole surety. The wizard smiled, which was worse than shouting.' },
    ],
    onExpire: [{ t: 'deposit', keepPct: 0 }, { t: 'flag', key: 'purple', value: true, scope: 'building' }],
    expireText: 'The wizard grew bored of waiting, took the surety by means unknown, and left the tower purple.',
  },
];
