/** Incident registry: aggregates every incident file. Owned by the integrator. */
import type { IncidentDef } from '../schema';
import { SYSTEM_INCIDENTS } from './system';
import { EXAMPLE_INCIDENTS } from './examples';
import { MAINTENANCE_INCIDENTS } from './maintenance';
import { PAYMENT_INCIDENTS } from './payment';
import { PETS_PESTS_INCIDENTS } from './pets_pests';
import { NEIGHBORS_INCIDENTS } from './neighbors';
import { LEGAL_CROWN_INCIDENTS } from './legal_crown';
import { WEATHER_INCIDENTS } from './weather';
import { MAGIC_INCIDENTS } from './magic';
import { SQUATTERS_RIVAL_INCIDENTS } from './squatters_rival';
import { WINDFALL_FESTIVAL_INCIDENTS } from './windfall_festival';
import { STAFF_TROUBLES_INCIDENTS } from './staff_troubles';
import { LEASE_VARIANTS_INCIDENTS } from './lease_variants';
import { COMMERCE_INCIDENTS } from './commerce';

export const INCIDENTS: IncidentDef[] = [
  ...SYSTEM_INCIDENTS, ...EXAMPLE_INCIDENTS, ...MAINTENANCE_INCIDENTS, ...PAYMENT_INCIDENTS,
  ...PETS_PESTS_INCIDENTS, ...NEIGHBORS_INCIDENTS, ...LEGAL_CROWN_INCIDENTS, ...WEATHER_INCIDENTS,
  ...MAGIC_INCIDENTS, ...SQUATTERS_RIVAL_INCIDENTS, ...WINDFALL_FESTIVAL_INCIDENTS,
  ...STAFF_TROUBLES_INCIDENTS, ...LEASE_VARIANTS_INCIDENTS, ...COMMERCE_INCIDENTS,
];

export const INCIDENT_BY_ID: Record<string, IncidentDef> = {};
for (const d of INCIDENTS) {
  if (INCIDENT_BY_ID[d.id]) console.warn('[data] duplicate incident id: ' + d.id);
  INCIDENT_BY_ID[d.id] = d;
}
