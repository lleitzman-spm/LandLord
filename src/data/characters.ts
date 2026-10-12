/** OWNER: content-people agent. Named households, court NPCs, staff candidates. */
import type { CharacterDef, NpcDef, StaffNameDef } from './schema';
import { NPCS, type NpcId } from './ids';
export const CHARACTERS: CharacterDef[] = [];
const title = (id: string) => id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
export const NPC_DEFS = Object.fromEntries(NPCS.map(id => [id, {
  id, name: title(id), title: title(id), species: 'human', bio: '', voice: '', look: {}, lines: { greet: 'Greetings.', pleased: 'Good.', displeased: 'Hm.' },
} satisfies NpcDef])) as Record<NpcId, NpcDef>;
export const STAFF_NAMES: StaffNameDef[] = [
  { role: 'mason', names: [{ name: 'Hob Trowelsby', first: 'Hob', species: 'human', pitch: 'I have built nine barns and seven are standing.' }] },
  { role: 'bailiff', names: [{ name: 'Agnes Ironknock', first: 'Agnes', species: 'human', pitch: 'They pay, or they hear from me.' }] },
  { role: 'crier', names: [{ name: 'Pip Bellweather', first: 'Pip', species: 'halfling', pitch: 'OYEZ. Sorry. Force of habit.' }] },
  { role: 'steward', names: [{ name: 'Ansel Quillfeather', first: 'Ansel', species: 'human', pitch: 'I have never lost a penny, nor found one.' }] },
];
export const RIVAL_NAMES: { name: string; seat: string; temperament: 'grasping' | 'charming' | 'ruthless' }[] = [
  { name: 'Baron Aldous Vane', seat: 'Greywater', temperament: 'grasping' },
];
export const REALM_NAMES: string[] = ['Mudlark Hollow', 'Lesser Dripping', 'Thistle-under-Wold', 'Nether Puddock', 'Crookbarrow'];
