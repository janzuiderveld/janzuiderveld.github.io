import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'

// Clear debug logging
console.log("🚀 main.tsx is initializing the application");
console.log("📍 Initial URL:", window.location.href);
console.log("📍 Initial pathname:", window.location.pathname);

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

// Normal app initialization - removing the redirect code
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)
