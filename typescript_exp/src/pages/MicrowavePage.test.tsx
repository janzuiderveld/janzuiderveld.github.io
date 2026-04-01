import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MICROWAVE_ALIGN_DEFAULT } from '../assets/microwave/align';
import MicrowavePage from './MicrowavePage';

const projectPageSpy = vi.fn();

vi.mock('../components/ProjectPage', () => ({
  default: (props: unknown) => {
    projectPageSpy(props);
    return <div data-testid="project-page" />;
  }
}));

describe('MicrowavePage', () => {
  it('configures the microwave page with a local video above the photo-mode hero image', () => {
    render(<MicrowavePage />);

    expect(screen.getByTestId('project-page')).toBeInTheDocument();
    expect(projectPageSpy).toHaveBeenCalledTimes(1);

    const lastCall = projectPageSpy.mock.calls.at(-1)?.[0] as {
      title?: string;
      photoCenterOnEnter?: boolean;
      photoInitialScrollTargetId?: string;
      photoLayoutAugmenter?: (layout: {
        rawBounds: Record<string, { minX: number; maxX: number; minY: number; maxY: number; fixed: boolean }>;
        paddedBounds: Record<string, { minX: number; maxX: number; minY: number; maxY: number; fixed: boolean }>;
      }) => {
        rawBounds: Record<string, { minX: number; maxX: number; minY: number; maxY: number; fixed: boolean }>;
        paddedBounds: Record<string, { minX: number; maxX: number; minY: number; maxY: number; fixed: boolean }>;
      };
      photoVideos?: Array<{
        kind: string;
        videoSrc?: string;
        position?: string;
        autoplay?: boolean;
      }>;
    };

    expect(lastCall.title).toBe('Microwave');
    expect(lastCall.photoVideos).toEqual([
      expect.objectContaining({
        kind: 'file',
        position: 'above',
        videoSrc: expect.stringContaining('microwave_sample.mp4'),
        autoplay: true
      })
    ]);
    expect(lastCall.photoInitialScrollTargetId).toBe('hero-video-0');
    expect(lastCall.photoCenterOnEnter).toBe(true);
    expect(lastCall.photoLayoutAugmenter).toEqual(expect.any(Function));
  });

  it('keeps the microwave video at a smaller balanced 4:5 frame above the hero', () => {
    render(<MicrowavePage />);

    const lastCall = projectPageSpy.mock.calls.at(-1)?.[0] as {
      photoLayoutAugmenter?: (layout: {
        rawBounds: Record<string, { minX: number; maxX: number; minY: number; maxY: number; fixed: boolean }>;
        paddedBounds: Record<string, { minX: number; maxX: number; minY: number; maxY: number; fixed: boolean }>;
      }) => {
        rawBounds: Record<string, { minX: number; maxX: number; minY: number; maxY: number; fixed: boolean }>;
        paddedBounds: Record<string, { minX: number; maxX: number; minY: number; maxY: number; fixed: boolean }>;
      };
    };

    const layout = lastCall.photoLayoutAugmenter?.({
      rawBounds: {
        hero: {
          minX: 30,
          maxX: 90,
          minY: 70,
          maxY: 90,
          fixed: false
        },
        'hero-video-0': {
          minX: 10,
          maxX: 129,
          minY: 2,
          maxY: 42,
          fixed: false
        }
      },
      paddedBounds: {}
    });

    const videoBounds = layout?.rawBounds['hero-video-0'];
    const widthChars = (videoBounds?.maxX ?? 0) - (videoBounds?.minX ?? 0) + 1;
    const heightChars = (videoBounds?.maxY ?? 0) - (videoBounds?.minY ?? 0) + 1;
    const alignedHeroTop = Math.floor(70 + MICROWAVE_ALIGN_DEFAULT.offsetY);

    expect(videoBounds).toBeDefined();
    expect(widthChars).toBe(48);
    expect(heightChars).toBe(36);
    expect(videoBounds?.minY).toBeGreaterThanOrEqual(6);
    expect(alignedHeroTop - ((videoBounds?.maxY ?? 0) + 1)).toBe(6);
  });
});
