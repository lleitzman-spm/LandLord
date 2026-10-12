/** OWNER: content-core agent. Replace the generated placeholders with real data. */
import type { TraitDef, TagDef } from './schema';
import { TRAITS, TENANT_TAGS, type TraitId, type TenantTag } from './ids';
const title = (id: string) => id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
export const TRAIT_DEFS = Object.fromEntries(TRAITS.map(id => [id, { id, name: title(id), blurb: '', good: false } satisfies TraitDef])) as Record<TraitId, TraitDef>;
export const TAG_DEFS = Object.fromEntries(TENANT_TAGS.map(id => [id, { id, name: title(id), blurb: '' } satisfies TagDef])) as Record<TenantTag, TagDef>;
