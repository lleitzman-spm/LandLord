/** OWNER: content-core agent. Replace the generated placeholders with real data. */
import type { SpeciesDef } from './schema';
import { SPECIES, type Species } from './ids';
const title = (id: string) => id.replace(/\b\w/g, c => c.toUpperCase());
const MIN = { human: 'reeve', halfling: 'reeve', dwarf: 'knight', goblin: 'knight', elf: 'baron', ogre: 'baron' } as const;
export const SPECIES_DEFS = Object.fromEntries(SPECIES.map(id => [id, {
  id, name: title(id), plural: title(id) + 's', adjective: id, minRank: MIN[id], weight: 1, householdRange: [1, 5], traitBias: {},
  cares: '', blurb: '', firstNames: ['Alder', 'Bram', 'Cecily', 'Dunstan', 'Edith', 'Marta', 'Osric', 'Wynn'], surnames: ['Thistlewick', 'Mudge', 'Underbough', 'Cask', 'Fenn', 'Harrow'],
} satisfies SpeciesDef])) as Record<Species, SpeciesDef>;
