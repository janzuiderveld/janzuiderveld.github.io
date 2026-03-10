// src/App.tsx
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import './App.css'

// Import page components from pages directory
import CameraPage from './pages/CameraPage';
import HomePage from './pages/HomePage'; // Make sure this points to the correct file
import ConstructionPage from './pages/ConstructionPage';
import CoffeeMachinePage from './pages/CoffeeMachinePage';
import MicrowavePage from './pages/MicrowavePage';
import CopyMachinePage from './pages/CopyMachinePage';
import FishPage from './pages/FishPage';
import TouchingDistancePage from './pages/TouchingDistancePage';
import LasersPage from './pages/LasersPage';
import ShedrickPage from './pages/ShedrickPage';
import ConversationsBeyondTheOrdinaryPage from './pages/ConversationsBeyondTheOrdinaryPage';
import AboutPage from './pages/AboutPage';
import AllPresentationsPage from './pages/AllPresentationsPage';
import VendingMachineOrganoidPage from './pages/VendingMachineOrganoidPage';
import PersonalAudioGuidePage from './pages/PersonalAudioGuidePage';
import CompatibilityOverlay from './components/CompatibilityOverlay';
import {
  COMPATIBILITY_MESSAGE,
  hasSeenCompatibilityMessage,
  isDesktopChromium,
  markCompatibilityMessageSeen
} from './utils/compatibility';

// For debugging - log when App component renders
console.log("App component rendering...");

function App() {
  const location = useLocation();
  const [showCompatibilityOverlay, setShowCompatibilityOverlay] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    if (isDesktopChromium()) {
      return false;
    }
    return !hasSeenCompatibilityMessage();
  });
  const handleCompatibilityComplete = useCallback(() => {
    markCompatibilityMessageSeen();
    setShowCompatibilityOverlay(false);
  }, []);
  
  // Log route changes to help debug
  useEffect(() => {
    console.log(`🧭 App: Route changed to "${location.pathname}"`);
    console.log(`🧭 App: Full URL is "${window.location.href}"`);
    
    // Check which component should render based on path
    if (location.pathname === '/') {
      console.log(`🧭 App: Home route detected - should render HomePage component`);
    } else if (location.pathname === '/camera') {
      console.log(`🧭 App: Camera route detected - should render CameraPage component`);
    } else if (location.pathname === '/coffee') {
      console.log(`🧭 App: Coffee route detected - should render CoffeeMachinePage component`);
    } else if (location.pathname === '/microwave') {
      console.log(`🧭 App: Microwave route detected - should render MicrowavePage component`);
    } else if (location.pathname === '/copy') {
      console.log(`🧭 App: Copy route detected - should render CopyMachinePage component`);
    } else if (location.pathname === '/fish') {
      console.log(`🧭 App: Fish route detected - should render FishPage component`);
    } else if (location.pathname === '/touching') {
      console.log(`🧭 App: Touching Distance route detected - should render TouchingDistancePage component`);
    } else if (location.pathname === '/lasers') {
      console.log(`🧭 App: Lasers route detected - should render LasersPage component`);
    } else if (location.pathname === '/shedrick') {
      console.log(`🧭 App: Shedrick route detected - should render ShedrickPage component`);
    } else if (location.pathname === '/conversations-beyond-the-ordinary') {
      console.log(`🧭 App: Conversations route detected - should render ConversationsBeyondTheOrdinaryPage component`);
    } else if (location.pathname === '/about') {
      console.log(`🧭 App: About route detected - should render AboutPage component`);
    } else if (location.pathname === '/presentations') {
      console.log(`🧭 App: AllPresentations route detected - should render AllPresentationsPage component`);
    } else if (location.pathname === '/vending' || location.pathname === '/vending-machine-organoid') {
      console.log(`🧭 App: Vending Machine Organoid route detected - should render VendingMachineOrganoidPage component`);
    } else if (
      location.pathname === '/guide'
      || location.pathname === '/audio-guide'
      || location.pathname === '/personal-audio-guide'
    ) {
      console.log(`🧭 App: Personal Audio Guide route detected - should render PersonalAudioGuidePage component`);
    } else {
      console.log(`🧭 App: Unknown route "${location.pathname}" - will redirect to construction`);
    }
  }, [location]);

  return (
    <>
      <Routes>
        {/* Home page route */}
        <Route path="/" element={<HomePage compatibilityOverlayActive={showCompatibilityOverlay} />} />
        <Route path="/about" element={<AboutPage />} />
        
        {/* Camera page route */}
        <Route path="/camera" element={<CameraPage />} />

        <Route path="/coffee" element={<CoffeeMachinePage />} />
        <Route path="/microwave" element={<MicrowavePage />} />
        <Route path="/copy" element={<CopyMachinePage />} />
        <Route path="/fish" element={<FishPage />} />
        <Route path="/touching" element={<TouchingDistancePage />} />
        <Route path="/lasers" element={<LasersPage />} />

        {/* Shedrick page route */}
        <Route path="/shedrick" element={<ShedrickPage />} />

        {/* Conversations beyond the ordinary page route */}
        <Route path="/conversations-beyond-the-ordinary" element={<ConversationsBeyondTheOrdinaryPage />} />

        <Route path="/presentations" element={<AllPresentationsPage />} />
        <Route path="/vending" element={<VendingMachineOrganoidPage />} />
        <Route path="/vending-machine-organoid" element={<Navigate to="/vending" replace />} />
        <Route path="/guide" element={<PersonalAudioGuidePage />} />
        <Route path="/audio-guide" element={<Navigate to="/guide" replace />} />
        <Route path="/personal-audio-guide" element={<Navigate to="/guide" replace />} />

        {/* Construction page route */}
        <Route path="/construction" element={<ConstructionPage />} />
        
        {/* Catch-all route for any undefined paths, redirects to the construction page */}
        <Route path="*" element={<Navigate to="/construction" replace />} />
      </Routes>
      {showCompatibilityOverlay && (
        <CompatibilityOverlay
          message={COMPATIBILITY_MESSAGE}
          onComplete={handleCompatibilityComplete}
        />
      )}
    </>
  );
}

export default App;// Test change from terminal Tue Apr  1 17:52:29 CEST 2025
