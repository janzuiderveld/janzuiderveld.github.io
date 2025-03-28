import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'

// Clear debug logging
console.log("🚀 main.tsx is initializing the application");
console.log("📍 Initial URL:", window.location.href);
console.log("📍 Initial pathname:", window.location.pathname);

// Normal app initialization - removing the redirect code
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
