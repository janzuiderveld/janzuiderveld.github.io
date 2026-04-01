import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PersonalAudioGuidePage from './PersonalAudioGuidePage';

const projectPageSpy = vi.fn();

vi.mock('../components/ProjectPage', () => ({
  default: (props: unknown) => {
    projectPageSpy(props);
    return <div data-testid="project-page" />;
  }
}));

describe('PersonalAudioGuidePage', () => {
  afterEach(() => {
    projectPageSpy.mockReset();
  });

  it('keeps the guide video smaller and tighter than the gallery image below it', () => {
    render(
      <MemoryRouter initialEntries={['/guide']}>
        <PersonalAudioGuidePage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('project-page')).toBeInTheDocument();
    expect(projectPageSpy).toHaveBeenCalledTimes(1);

    const lastCall = projectPageSpy.mock.calls.at(-1)?.[0] as {
      photoCenterOnEnter?: boolean;
      photoInitialScrollTargetId?: string;
      photoInitialScrollAlignment?: string;
      photoInitialScrollPaddingRows?: number;
      photoVideos?: Array<{
        widthScale?: number;
        gap?: number;
        maxHeight?: number;
      }>;
      photoImages?: Array<{
        widthScale?: number;
      }>;
    };

    expect(lastCall.photoVideos).toHaveLength(1);
    expect(lastCall.photoImages).toHaveLength(1);
    expect(lastCall.photoVideos?.[0]?.widthScale).toBeLessThan(lastCall.photoImages?.[0]?.widthScale ?? 0);
    expect(lastCall.photoVideos?.[0]?.gap).toBeLessThanOrEqual(8);
    expect(lastCall.photoVideos?.[0]?.maxHeight).toBeLessThanOrEqual(64);
    expect(lastCall.photoInitialScrollTargetId).toBe('hero-video-0');
    expect(lastCall.photoInitialScrollAlignment).toBe('start');
    expect(lastCall.photoInitialScrollPaddingRows).toBe(5);
    expect(lastCall.photoCenterOnEnter).toBe(true);
  });
});
