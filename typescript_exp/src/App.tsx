// src/App.tsx
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import './App.css'

// Import page components from pages directory
import CameraPage from './pages/CameraPage';
import HomePage from './pages/HomePage'; // Make sure this points to the correct file
import ConstructionPage from './pages/ConstructionPage';
import AboutPage from './pages/AboutPage';
import AllPresentationsPage from './pages/AllPresentationsPage';

// For debugging - log when App component renders
console.log("App component rendering...");

function App() {
  const location = useLocation();
  
  // Log route changes to help debug
  useEffect(() => {
    console.log(`🧭 App: Route changed to "${location.pathname}"`);
    console.log(`🧭 App: Full URL is "${window.location.href}"`);
    
    // Check which component should render based on path
    if (location.pathname === '/') {
      console.log(`🧭 App: Home route detected - should render HomePage component`);
    } else if (location.pathname === '/camera') {
      console.log(`🧭 App: Camera route detected - should render CameraPage component`);
    } else if (location.pathname === '/about') {
      console.log(`🧭 App: About route detected - should render AboutPage component`);
    } else if (location.pathname === '/presentations') {
      console.log(`🧭 App: AllPresentations route detected - should render AllPresentationsPage component`);
    } else {
      console.log(`🧭 App: Unknown route "${location.pathname}" - will redirect to construction`);
    }
  }, [location]);

  return (
    <Routes>
      {/* Home page route */}
      <Route path="/" element={<HomePage />} />
      <Route path="/about" element={<AboutPage />} />
      
      {/* Camera page route */}
      <Route path="/camera" element={<CameraPage />} />

      <Route path="/presentations" element={<AllPresentationsPage />} />

      {/* Construction page route */}
      <Route path="/construction" element={<ConstructionPage />} />
      
      {/* Catch-all route for any undefined paths, redirects to the construction page */}
      <Route path="*" element={<Navigate to="/construction" replace />} />
    </Routes>
  );
}

export default App;// Test change from terminal Tue Apr  1 17:52:29 CEST 2025
