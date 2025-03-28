// src/App.tsx
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import './App.css'

// Import page components from pages directory
import CameraPage from './pages/CameraPage';
import HomePage from './pages/HomePage'; // Make sure this points to the correct file
import ConstructionPage from './pages/ConstructionPage';

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
    } else {
      console.log(`🧭 App: Unknown route "${location.pathname}" - will redirect to home`);
    }
  }, [location]);

  return (
    <Routes>
      {/* Home page route */}
      <Route path="/" element={<HomePage />} />
      
      {/* Camera page route */}
      <Route path="/camera" element={<CameraPage />} />

      {/* Construction page route */}
      <Route path="/construction" element={<ConstructionPage />} />
      
      {/* Catch-all route for any undefined paths, redirects to the home page */}
      <Route path="*" element={<Navigate to="/construction" replace />} />
    </Routes>
  );
}

export default App;