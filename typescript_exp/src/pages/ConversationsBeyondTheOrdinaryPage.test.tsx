import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ConversationsBeyondTheOrdinaryPage from './ConversationsBeyondTheOrdinaryPage';

const projectPageSpy = vi.fn();

vi.mock('../components/ProjectPage', () => ({
  default: (props: unknown) => {
    projectPageSpy(props);
    return <div data-testid="project-page" />;
  }
}));

describe('ConversationsBeyondTheOrdinaryPage', () => {
  it('configures a local video above the hero image in photo mode', () => {
    render(<ConversationsBeyondTheOrdinaryPage />);

    expect(screen.getByTestId('project-page')).toBeInTheDocument();
    expect(projectPageSpy).toHaveBeenCalledTimes(1);

    const lastCall = projectPageSpy.mock.calls.at(-1)?.[0] as {
      title?: string;
      photoCenterOnEnter?: boolean;
      photoInitialScrollTargetId?: string;
      photoLayoutAugmenter?: unknown;
      photoVideos?: Array<{
        kind: string;
        videoSrc?: string;
        position?: string;
        widthReference?: string;
        autoplay?: boolean;
        controls?: boolean;
        playsInline?: boolean;
      }>;
    };

    expect(lastCall.title).toBe('Conversations Beyond the Ordinary');
    expect(lastCall.photoVideos).toEqual([
      expect.objectContaining({
        kind: 'file',
        position: 'above',
        widthReference: 'page',
        videoSrc: expect.stringContaining('iii_mini_docu_1080p_AdobeExpress_h264.mp4'),
        autoplay: true,
        controls: true,
        playsInline: true
      })
    ]);
    expect(lastCall.photoInitialScrollTargetId).toBe('conversations-photo-entry');
    expect(lastCall.photoCenterOnEnter).toBe(true);
    expect(lastCall.photoLayoutAugmenter).toEqual(expect.any(Function));
  });
});
