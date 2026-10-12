/** Rank ladder. Each rank's `goals` are the charter to earn the NEXT rank. Tuned by the balance bots. */
import type { RankDef } from './schema';
import type { RankId } from '../sim/types';

export const RANKS: Record<RankId, RankDef> = {
  reeve: {
    id: 'reeve', title: 'Reeve', realm: 'Hamlet', address: 'Reeve',
    goals: [
      { id: 'reeve_households', text: 'House seven households', metric: 'households', target: 7 },
      { id: 'reeve_rentroll', text: 'Reach a rent roll of 80 crowns a month', metric: 'rentRoll', target: 80 },
      { id: 'reeve_renown', text: 'Hold a renown of 55 or better', metric: 'renown', target: 55 },
    ],
    buildings: ['seat', 'hovel', 'cottage', 'burrow', 'market_stall', 'well', 'garden', 'notice_board', 'shrine'],
    species: ['human', 'halfling'],
    staff: [],
    maxParcels: 2, tribute: 15, seatLevel: 1,
    proclamation: 'By grace of the Crown, {ruler} is named Reeve of {realm}: three hovels, some mud, and the right to collect what rent can be got.',
    duty: 'Knock on doors, patch roofs, and carry the rent home yourself.',
  },
  knight: {
    id: 'knight', title: 'Knight', realm: 'Village', address: 'Sir',
    goals: [
      { id: 'knight_households', text: 'House twenty-six households', metric: 'households', target: 26 },
      { id: 'knight_rentroll', text: 'Reach a rent roll of 600 crowns a month', metric: 'rentRoll', target: 600 },
      { id: 'knight_renown', text: 'Hold a renown of 57 or better', metric: 'renown', target: 57 },
      { id: 'knight_favor', text: 'Keep the favour of the Crown at 50 or better', metric: 'favor', target: 50 },
      { id: 'knight_staff', text: 'Keep a household of three delegates', metric: 'staff', target: 3 },
    ],
    buildings: ['longhouse', 'stonehall', 'bakery', 'smithy', 'mill', 'tavern', 'stocks', 'statue', 'watchtower', 'masons_yard', 'bailiffs_post', 'criers_stand'],
    species: ['dwarf', 'goblin'],
    staff: ['mason', 'bailiff', 'crier'],
    maxParcels: 5, tribute: 50, seatLevel: 2,
    proclamation: 'Kneel, Reeve. Rise, Sir {ruler}, Knight of {realm}. You may now keep a household, and blame them.',
    duty: 'Hire a household and rule it by your word. They will do what you said, which is not always what you meant.',
  },
  baron: {
    id: 'baron', title: 'Baron', realm: 'Town', address: 'my lord',
    goals: [
      { id: 'baron_households', text: 'House thirty-six households', metric: 'households', target: 36 },
      { id: 'baron_rentroll', text: 'Reach a rent roll of 1,000 crowns a month', metric: 'rentRoll', target: 1000 },
      { id: 'baron_renown', text: 'Hold a renown of 70 or better', metric: 'renown', target: 70 },
      { id: 'baron_favor', text: 'Keep the favour of the Crown at 60 or better', metric: 'favor', target: 60 },
      { id: 'baron_oaths', text: 'Keep ten oaths', metric: 'oathsKept', target: 10 },
    ],
    buildings: ['townhouse', 'treehouse', 'wizard_tower', 'apothecary', 'chapel', 'counting_house'],
    species: ['elf', 'ogre'],
    staff: ['steward'],
    maxParcels: 9, tribute: 240, seatLevel: 3,
    proclamation: 'Let it be known that Sir {ruler} is raised to Baron of {realm}, to hold court, set policy, and be petitioned at all hours.',
    duty: 'Hold court and set policy. Your delegates now use their own judgment, for better or worse.',
  },
  duke: {
    id: 'duke', title: 'Duke', realm: 'Duchy', address: 'Your Grace',
    goals: [
      { id: 'duke_households', text: 'House eighty households', metric: 'households', target: 80 },
      { id: 'duke_rentroll', text: 'Reach a rent roll of 3,000 crowns a month', metric: 'rentRoll', target: 3000 },
    ],
    buildings: [], species: [], staff: [],
    maxParcels: 12, tribute: 500, seatLevel: 3,
    proclamation: 'Baron {ruler} is raised to Duke. The mapmakers have been informed and are annoyed.',
    duty: 'Grant fiefs to vassals and discover they have ambitions of their own.',
  },
  king: {
    id: 'king', title: 'King', realm: 'Kingdom', address: 'Your Majesty',
    goals: [],
    buildings: [], species: [], staff: [],
    maxParcels: 12, tribute: 0, seatLevel: 3,
    proclamation: 'All hail {ruler}, by right of rent, King of {realm}.',
    duty: 'Write the law. Everyone will read it literally.',
  },
};
