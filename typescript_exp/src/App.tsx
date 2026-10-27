// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, type ComponentType } from 'react';
import { loadCurrentPage } from './utils/siteUpdates';
import './App.css'

const lazyPage = (load: () => Promise<{ default: ComponentType }>) => lazy(() =>
  loadCurrentPage(load, import.meta.env.PROD ? __SITE_BUILD_ID__ : 'development')
);

// Keep Home eager; load individual artwork pages on demand.
const BiodieseLLMPage = lazyPage(() => import('./pages/BiodieseLLMPage'));
const CameraPage = lazyPage(() => import('./pages/CameraPage'));
import HomePage from './pages/HomePage'; // Make sure this points to the correct file
const UpcomingPage = lazyPage(() => import('./pages/UpcomingPage'));
const ConstructionPage = lazyPage(() => import('./pages/ConstructionPage'));
const CoffeeMachinePage = lazyPage(() => import('./pages/CoffeeMachinePage'));
const MicrowavePage = lazyPage(() => import('./pages/MicrowavePage'));
const CopyMachinePage = lazyPage(() => import('./pages/CopyMachinePage'));
const FishPage = lazyPage(() => import('./pages/FishPage'));
const TouchingDistancePage = lazyPage(() => import('./pages/TouchingDistancePage'));
const LasersPage = lazyPage(() => import('./pages/LasersPage'));
const ShedrickPage = lazyPage(() => import('./pages/ShedrickPage'));
const ConversationsBeyondTheOrdinaryPage = lazyPage(() => import('./pages/ConversationsBeyondTheOrdinaryPage'));
const AboutPage = lazyPage(() => import('./pages/AboutPage'));
const AllPresentationsPage = lazyPage(() => import('./pages/AllPresentationsPage'));
const VendingMachineOrganoidPage = lazyPage(() => import('./pages/VendingMachineOrganoidPage'));
const PersonalAudioGuidePage = lazyPage(() => import('./pages/PersonalAudioGuidePage'));
const VendingDemoPage = lazyPage(() => import('./pages/VendingDemoPage'));

function App() {
  
  return (
    <>
      <Suspense fallback={null}>
      <Routes>
        {/* Home page route */}
        <Route path="/" element={<HomePage />} />
        <Route path="/up" element={<UpcomingPage />} />
        <Route path="/about" element={<AboutPage />} />
        
        {/* Camera page route */}
        <Route path="/camera" element={<CameraPage />} />

        <Route path="/biodiesellm" element={<BiodieseLLMPage />} />
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
        <Route path="/vending-demo" element={<VendingDemoPage />} />
        <Route path="/vending-machine-organoid" element={<Navigate to="/vending" replace />} />
        <Route path="/guide" element={<PersonalAudioGuidePage />} />
        <Route path="/audio-guide" element={<Navigate to="/guide" replace />} />
        <Route path="/personal-audio-guide" element={<Navigate to="/guide" replace />} />

        {/* Construction page route */}
        <Route path="/construction" element={<ConstructionPage />} />
        
        {/* Catch-all route for any undefined paths, redirects to the construction page */}
        <Route path="*" element={<Navigate to="/construction" replace />} />
      </Routes>
      </Suspense>
    </>
  );
}

export default App;// Test change from terminal Tue Apr  1 17:52:29 CEST 2025
