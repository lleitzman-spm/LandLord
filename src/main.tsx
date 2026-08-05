import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { raiseTheWatchtower } from './watch';

// Before anything renders, so a failure while the kingdom is still standing up
// is seen too.
raiseTheWatchtower();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
