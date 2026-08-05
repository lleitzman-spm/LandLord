import { createRoot } from 'react-dom/client';
import RealmView from './src/realm/RealmView';
import { SAMPLE_REALM, SAMPLE_REALM_UNREVEALED, fullMuster } from './src/realm/scene';
import './src/realm/realm.css';
const which = new URLSearchParams(location.search).get('scene');
const scene = which === 'empty' ? SAMPLE_REALM_UNREVEALED : which === 'full' ? fullMuster() : SAMPLE_REALM;
createRoot(document.getElementById('root')!).render(
  <RealmView scene={scene}
    onSelectFief={(id)=>console.log('FIEF',id)}
    onSelectBuilding={(f,d)=>console.log('DOOR',f,d)}
    onSelectGuild={(id)=>console.log('GUILD',id)}
    onOpenPanel={(n)=>console.log('PANEL',n)}
    onDeployMuster={()=>console.log('MUSTER')} />
);
