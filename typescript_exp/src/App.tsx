// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useCallback, useState } from 'react';
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
  supportsPrimaryExperienceBrowser,
  markCompatibilityMessageSeen
} from './utils/compatibility';

function App() {
  const [showCompatibilityOverlay, setShowCompatibilityOverlay] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    if (supportsPrimaryExperienceBrowser()) {
      return false;
    }
    return !hasSeenCompatibilityMessage();
  });
  const handleCompatibilityComplete = useCallback(() => {
    markCompatibilityMessageSeen();
    setShowCompatibilityOverlay(false);
  }, []);
  
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
