import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProjectPage from './ProjectPage';

const photoModeSceneSpy = vi.fn();

vi.mock('./photorealistic/PhotoModeScene', () => ({
  default: (props: unknown) => {
    photoModeSceneSpy(props);
    return <div data-testid="photo-mode-scene" />;
  }
}));

describe('ProjectPage photo entry targets', () => {
  afterEach(() => {
    photoModeSceneSpy.mockReset();
  });

  it('keeps photo entry bound to the hero target instead of the title text', async () => {
    render(
      <MemoryRouter initialEntries={['/coffee']}>
        <ProjectPage
          title="Coffee Machine"
          text="Body copy"
          asciiArt={'@@@\n@@@'}
          photo={{ src: '/photo.png', alt: 'Coffee Machine placeholder' }}
          align={{ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 }}
        />
      </MemoryRouter>
    );

    await screen.findByTestId('photo-mode-scene');

    expect(photoModeSceneSpy).toHaveBeenCalled();
    const lastCall = photoModeSceneSpy.mock.calls.at(-1)?.[0] as { asciiClickTargets?: string[] };
    expect(lastCall.asciiClickTargets).toEqual(['hero']);
  });
});
