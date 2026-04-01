import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CopyMachinePage from './CopyMachinePage';

const projectPageSpy = vi.fn();

vi.mock('../components/ProjectPage', () => ({
  default: (props: unknown) => {
    projectPageSpy(props);
    return <div data-testid="project-page" />;
  }
}));

describe('CopyMachinePage', () => {
  it('configures the copy page with a local video above the photo-mode hero image', () => {
    render(<CopyMachinePage />);

    expect(screen.getByTestId('project-page')).toBeInTheDocument();
    expect(projectPageSpy).toHaveBeenCalledTimes(1);

    const lastCall = projectPageSpy.mock.calls.at(-1)?.[0] as {
      title?: string;
      text?: string;
      photoCenterOnEnter?: boolean;
      photoInitialScrollTargetId?: string;
      photoInitialScrollAlignment?: string;
      photoInitialScrollPaddingRows?: number;
      photoLayoutAugmenter?: unknown;
      photoVideos?: Array<{
        kind: string;
        videoSrc?: string;
        position?: string;
        widthReference?: string;
        widthScale?: number;
        heightRatio?: number;
        gap?: number;
        maxHeight?: number;
        objectFit?: string;
        autoplay?: boolean;
        muted?: boolean;
        loop?: boolean;
      }>;
    };

    expect(lastCall.title).toBe('Copy Machine');
    expect(lastCall.text).toContain('[[Technical Paper]](');
    expect(lastCall.text).toContain('Algorithm_Technical_Paper.pdf');
    expect(lastCall.photoVideos).toEqual([
      expect.objectContaining({
        kind: 'file',
        position: 'above',
        widthReference: 'page',
        widthScale: 0.48,
        heightRatio: 0.5625,
        gap: 6,
        maxHeight: 36,
        objectFit: 'cover',
        videoSrc: expect.stringContaining('copy_machine_sequence_720p.mp4'),
        autoplay: true,
        muted: true
      }),
      expect.objectContaining({
        kind: 'file',
        position: 'below',
        widthReference: 'page',
        widthScale: 0.24,
        heightRatio: 640 / 360,
        gap: 6,
        maxHeight: 52,
        objectFit: 'cover',
        videoSrc: expect.stringContaining('copy_machine_instagram_reel.mp4'),
        loop: true
      })
    ]);
    expect(lastCall.photoInitialScrollTargetId).toBe('hero-video-0');
    expect(lastCall.photoInitialScrollAlignment).toBe('start');
    expect(lastCall.photoInitialScrollPaddingRows).toBe(5);
    expect(lastCall.photoCenterOnEnter).toBe(true);
    expect(lastCall.photoLayoutAugmenter).toBeUndefined();
  });
});
