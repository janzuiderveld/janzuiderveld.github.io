import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

const VENDING_DEMO_EMBED_SRC = 'https://player.vimeo.com/video/1171787116?app_id=122963';

vi.mock('./pages/HomePage', () => ({
  default: () => <div>Home Page</div>
}));

vi.mock('./pages/AboutPage', () => ({
  default: () => <div>About Page</div>
}));

vi.mock('./pages/CameraPage', () => ({
  default: () => <div>Camera Page</div>
}));

vi.mock('./pages/CoffeeMachinePage', () => ({
  default: () => <div>Coffee Machine Page</div>
}));

vi.mock('./pages/MicrowavePage', () => ({
  default: () => <div>Microwave Page</div>
}));

vi.mock('./pages/CopyMachinePage', () => ({
  default: () => <div>Copy Machine Page</div>
}));

vi.mock('./pages/FishPage', () => ({
  default: () => <div>Fish Page</div>
}));

vi.mock('./pages/TouchingDistancePage', () => ({
  default: () => <div>Touching Distance Page</div>
}));

vi.mock('./pages/LasersPage', () => ({
  default: () => <div>Lasers Page</div>
}));

vi.mock('./pages/ShedrickPage', () => ({
  default: () => <div>Shedrick Page</div>
}));

vi.mock('./pages/ConversationsBeyondTheOrdinaryPage', () => ({
  default: () => <div>Conversations Beyond The Ordinary Page</div>
}));

vi.mock('./pages/AllPresentationsPage', () => ({
  default: () => <div>All Presentations Page</div>
}));

vi.mock('./pages/VendingMachineOrganoidPage', () => ({
  default: () => <div>Vending Machine Organoid Page</div>
}));

vi.mock('./pages/PersonalAudioGuidePage', () => ({
  default: () => <div>Personal Audio Guide Page</div>
}));

vi.mock('./pages/ConstructionPage', () => ({
  default: () => <div>Construction Page</div>
}));

vi.mock('./components/CompatibilityOverlay', () => ({
  default: () => null
}));

vi.mock('./utils/compatibility', () => ({
  COMPATIBILITY_MESSAGE: '',
  hasSeenCompatibilityMessage: () => true,
  supportsPrimaryExperienceBrowser: () => true,
  markCompatibilityMessageSeen: vi.fn()
}));

describe('App routes', () => {
  it('renders the vending demo page as an embedded video only view', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/vending-demo']}>
        <App />
      </MemoryRouter>
    );

    const iframe = screen.getByTitle('Vending demo video');

    expect(iframe.tagName).toBe('IFRAME');
    expect(iframe).toHaveAttribute('src', VENDING_DEMO_EMBED_SRC);
    expect(container.querySelectorAll('iframe')).toHaveLength(1);
    expect(container.querySelector('main, header, nav, a, p, pre, img, video')).toBeNull();
    expect(container.textContent?.trim()).toBe('');
  });
});
