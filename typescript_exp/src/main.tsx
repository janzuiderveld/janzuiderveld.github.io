// Vite's lazy-chunk preload helper uses this ES2020 API even for older targets.
import 'core-js/actual/promise/all-settled';
import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'
import { installSiteUpdateCheck } from './utils/siteUpdates';

const SESSION_INIT_KEY = 'sessionInitialized';

const ensureSessionWhiteIn = () => {
  try {
    if (sessionStorage.getItem(SESSION_INIT_KEY) !== 'true') {
      sessionStorage.setItem(SESSION_INIT_KEY, 'true');
      sessionStorage.setItem('needsWhiteIn', 'true');
      sessionStorage.setItem('whiteInPosition', JSON.stringify({ x: 0, y: 0 }));
      sessionStorage.removeItem('lastWhiteInTimestamp');
    }
  } catch (error) {
    console.warn('Unable to initialize session white-in state', error);
  }
};

ensureSessionWhiteIn();
if (import.meta.env.PROD) installSiteUpdateCheck(__SITE_BUILD_ID__);

// Normal app initialization - removing the redirect code
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)
