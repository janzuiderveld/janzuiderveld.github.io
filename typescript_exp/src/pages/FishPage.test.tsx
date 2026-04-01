import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getGridDimensions } from '../components/ascii-art2/utils';
import { FISH_ALIGN_DEFAULT } from '../assets/fish/align';
import FishPage from './FishPage';

const projectPageSpy = vi.fn();

vi.mock('../components/ProjectPage', () => ({
  default: (props: unknown) => {
    projectPageSpy(props);
    return <div data-testid="project-page" />;
  }
}));

describe('FishPage', () => {
  it('configures the fish page with a supplemental Vimeo video above the photo-mode hero image', () => {
    render(<FishPage />);

    expect(screen.getByTestId('project-page')).toBeInTheDocument();
    expect(projectPageSpy).toHaveBeenCalledTimes(1);

    const lastCall = projectPageSpy.mock.calls.at(-1)?.[0] as {
      title?: string;
      photo?: {
        src?: string;
        alt?: string;
        contentInsets?: {
          top: number;
          right: number;
          bottom: number;
          left: number;
        };
      };
      align?: typeof FISH_ALIGN_DEFAULT;
      photoCenterOnEnter?: boolean;
      photoInitialScrollTargetId?: string;
      photoInitialScrollAlignment?: string;
      photoInitialScrollPaddingRows?: number;
      photoLayoutAugmenter?: (layout: {
        rawBounds: Record<string, { minX: number; maxX: number; minY: number; maxY: number; fixed: boolean }>;
        paddedBounds: Record<string, { minX: number; maxX: number; minY: number; maxY: number; fixed: boolean }>;
      }) => {
        rawBounds: Record<string, { minX: number; maxX: number; minY: number; maxY: number; fixed: boolean }>;
        paddedBounds: Record<string, { minX: number; maxX: number; minY: number; maxY: number; fixed: boolean }>;
      };
      photoVideos?: Array<{
        kind: string;
        embedSrc?: string;
        position?: string;
        widthReference?: string;
        widthScale?: number;
        gap?: number;
        maxHeight?: number;
      }>;
    };

    expect(lastCall.title).toBe('This is not a fish');
    expect(lastCall.photo).toEqual(expect.objectContaining({
      src: expect.any(String),
      alt: 'This is not a fish placeholder',
      contentInsets: {
        top: 0.133,
        right: 0,
        bottom: 0.005,
        left: 0
      }
    }));
    expect(lastCall.align).toEqual({
      offsetX: -18,
      offsetY: -4.5,
      scaleX: 1.12,
      scaleY: 1.12,
      stretchX: 1,
      stretchY: 0.8999999999999999
    });
    expect(lastCall.photoVideos).toEqual([
      expect.objectContaining({
        kind: 'embed',
        embedSrc: 'https://player.vimeo.com/video/1153081771?autoplay=1&muted=1&loop=1&autopause=0&playsinline=1&title=0&byline=0&portrait=0&controls=1',
        position: 'above',
        widthReference: 'page',
        widthScale: 0.56,
        gap: 4,
        maxHeight: 36
      })
    ]);
    expect(lastCall.photoInitialScrollTargetId).toBe('hero-video-0');
    expect(lastCall.photoInitialScrollAlignment).toBe('start');
    expect(lastCall.photoInitialScrollPaddingRows).toBe(3);
    expect(lastCall.photoCenterOnEnter).toBe(true);
    expect(lastCall.photoLayoutAugmenter).toEqual(expect.any(Function));

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1200
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: 720
    });

    const augmentedLayout = lastCall.photoLayoutAugmenter?.({
      rawBounds: {
        hero: { minX: 20, maxX: 60, minY: 100, maxY: 140, fixed: false },
        'hero-video-0': { minX: 10, maxX: 30, minY: 20, maxY: 30, fixed: false }
      },
      paddedBounds: {
        hero: { minX: 20, maxX: 60, minY: 100, maxY: 140, fixed: false },
        'hero-video-0': { minX: 10, maxX: 30, minY: 20, maxY: 30, fixed: false }
      }
    });

    const centeredVideoBounds = augmentedLayout?.rawBounds['hero-video-0'];
    expect(centeredVideoBounds).toBeDefined();

    const { cols } = getGridDimensions(window.innerWidth, window.innerHeight);
    const viewportCenter = cols / 2;
    const videoCenter = ((centeredVideoBounds!.minX + centeredVideoBounds!.maxX) + 1) / 2;
    expect(Math.abs(videoCenter - viewportCenter)).toBeLessThanOrEqual(1);

    const imageTop = 100 + Math.round(FISH_ALIGN_DEFAULT.offsetY);
    const bottomGap = imageTop - centeredVideoBounds!.maxY - 1;
    expect(bottomGap).toBe(4);
  });
});
