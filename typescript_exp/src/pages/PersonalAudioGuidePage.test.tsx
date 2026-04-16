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

  it('passes the updated website copy to the shared project page', () => {
    render(
      <MemoryRouter initialEntries={['/guide']}>
        <PersonalAudioGuidePage />
      </MemoryRouter>
    );

    const lastCall = projectPageSpy.mock.calls.at(-1)?.[0] as {
      text?: string;
    };

    expect(lastCall.text).toContain('Personal Audio Guide begins as a familiar museum service.');
    expect(lastCall.text).toContain('What began as a benign act of personalization returns as replication.');
    expect(lastCall.text).toContain('The work stages AI not as a futuristic abstraction');
    expect(lastCall.text).not.toContain('At what point do we intervene in systems designed to replicate us');
    expect(lastCall.text).not.toContain('Bluetooth beacons lets the system register where the visitor lingers');
  });
});
