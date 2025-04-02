// src/index.tsx
// This is an alternative entry point for development troubleshooting

import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';

// Import components directly
import HomePage from './pages/HomePage';
import CameraPage from './pages/CameraPage';

console.log("index.tsx is initializing with direct route components");
console.log("Current URL:", window.location.href);
console.log("Current pathname:", window.location.pathname);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Failed to find the root element");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/camera" element={<CameraPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
); 