/** OWNER: content-core agent. Replace the generated placeholders with real data. */
import type { TemperamentDef } from './schema';
import { TEMPERAMENTS, type TemperamentId } from './ids';
import type { StaffRole } from '../sim/types';
const ROLE: Record<TemperamentId, StaffRole> = {
  perfectionist: 'mason', bodger: 'mason', dreamer: 'mason', steady: 'mason',
  iron: 'bailiff', soft: 'bailiff', grasping: 'bailiff', lawful: 'bailiff',
  honeytongue: 'crier', honest: 'crier', snob: 'crier', bellower: 'crier',
  pennypincher: 'steward', openhanded: 'steward', bythebook: 'steward', schemer: 'steward',
};
const title = (id: string) => id.replace(/\b\w/g, c => c.toUpperCase());
export const TEMPERAMENT_DEFS = Object.fromEntries(TEMPERAMENTS.map(id => [id, {
  id, role: ROLE[id], name: title(id), epithet: '', blurb: '', bias: {}, speed: 1, cost: 1, quality: 1, voice: '', acks: ['As you say.'], grumbles: ['Hm.'], quirk: '',
} satisfies TemperamentDef])) as Record<TemperamentId, TemperamentDef>;
export const TEMPERAMENTS_BY_ROLE: Record<StaffRole, TemperamentId[]> = {
  mason: ['perfectionist', 'bodger', 'dreamer', 'steady'],
  bailiff: ['iron', 'soft', 'grasping', 'lawful'],
  crier: ['honeytongue', 'honest', 'snob', 'bellower'],
  steward: ['pennypincher', 'openhanded', 'bythebook', 'schemer'],
};
