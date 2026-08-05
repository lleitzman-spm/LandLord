/**
 * The War Table proving frame — standalone preview (WRIT-THE-WAR-TABLE §11).
 * Serve with vite dev; the working app is untouched. `?dof=0` switches the
 * tilt-shift off so its frame cost can be measured against the same scene.
 */
import { createRoot } from 'react-dom/client';
import WarTableFrame from './src/table/WarTableFrame';
import { loadRelief } from './src/table/relief';
import { workingFluidParcels } from './src/table/parcels';

const params = new URLSearchParams(location.search);
const dof = params.get('dof') !== '0';
const week = Number(params.get('week') ?? 31);

const relief = await loadRelief('/fantasy-relief.bin');
createRoot(document.getElementById('root')!).render(
  <WarTableFrame relief={relief} source={workingFluidParcels()} week={week} dof={dof} />,
);
