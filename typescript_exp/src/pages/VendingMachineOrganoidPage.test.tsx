import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCurrentCharMetrics, updateCharMetricsForViewport } from '../components/ascii-art2/constants';
import VendingMachineOrganoidPage from './VendingMachineOrganoidPage';

const projectPageSpy = vi.fn();

vi.mock('../components/ProjectPage', () => ({
  default: (props: unknown) => {
    projectPageSpy(props);
    return <div data-testid="project-page" />;
  }
}));

describe('VendingMachineOrganoidPage', () => {
  afterEach(() => {
    projectPageSpy.mockReset();
  });

  it('keeps the vending video smaller and tighter than the installation image below it', () => {
    render(<VendingMachineOrganoidPage />);

    expect(screen.getByTestId('project-page')).toBeInTheDocument();
    expect(projectPageSpy).toHaveBeenCalledTimes(1);

    const lastCall = projectPageSpy.mock.calls.at(-1)?.[0] as {
      photoCenterOnEnter?: boolean;
      photoInitialScrollTargetId?: string;
      photoInitialScrollAlignment?: string;
      photoInitialScrollPaddingRows?: number;
      photoVideos?: Array<{
        embedSrc?: string;
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
    expect(lastCall.photoVideos?.[0]?.embedSrc).toBe('https://player.vimeo.com/video/1179367379?badge=0&autopause=0&player_id=0&app_id=58479');
    expect(lastCall.photoVideos?.[0]?.widthScale).toBeLessThan(lastCall.photoImages?.[0]?.widthScale ?? 0);
    expect(lastCall.photoVideos?.[0]?.gap).toBeLessThanOrEqual(8);
    expect(lastCall.photoVideos?.[0]?.maxHeight).toBeLessThanOrEqual(64);
    expect(lastCall.photoInitialScrollTargetId).toBe('hero-video-0');
    expect(lastCall.photoInitialScrollAlignment).toBe('start');
    expect(lastCall.photoInitialScrollPaddingRows).toBe(5);
    expect(lastCall.photoCenterOnEnter).toBe(true);
  });

  it('uses the trimmed vending ASCII and the new machine photo without the blackout filter', () => {
    render(<VendingMachineOrganoidPage />);

    const lastCall = projectPageSpy.mock.calls.at(-1)?.[0] as {
      asciiArt?: string;
      photo?: {
        src?: string;
        alt?: string;
        filter?: string;
      };
    };

    expect(lastCall.asciiArt?.startsWith('\n')).toBe(false);
    expect(lastCall.asciiArt?.endsWith('\n')).toBe(false);
    expect(lastCall.photo?.src).toContain('vending_machine.png');
    expect(lastCall.photo?.alt?.toLowerCase()).toContain('vending machine');
    expect(lastCall.photo?.filter).toBeUndefined();
  });

  it('uses the tuned vending machine alignment coordinates', () => {
    render(<VendingMachineOrganoidPage />);

    const lastCall = projectPageSpy.mock.calls.at(-1)?.[0] as {
      align?: {
        offsetX?: number;
        offsetY?: number;
        scaleX?: number;
        scaleY?: number;
        stretchX?: number;
        stretchY?: number;
      };
    };

    expect(lastCall.align).toEqual({
      offsetX: -44.5,
      offsetY: -28,
      scaleX: 2.360000000000001,
      scaleY: 2.360000000000001,
      stretchX: 1,
      stretchY: 0.94
    });
  });

  it('centers the photo-mode media on narrow viewports without changing the saved hero alignment', () => {
    render(<VendingMachineOrganoidPage />);

    const lastCall = projectPageSpy.mock.calls.at(-1)?.[0] as {
      align?: {
        offsetX: number;
        offsetY: number;
        scaleX: number;
        scaleY: number;
        stretchX?: number;
        stretchY?: number;
      };
      photoLayoutAugmenter?: (layout: {
        rawBounds: Record<string, { minX: number; maxX: number; minY: number; maxY: number; fixed: boolean }>;
        paddedBounds: Record<string, { minX: number; maxX: number; minY: number; maxY: number; fixed: boolean }>;
      }) => {
        rawBounds: Record<string, { minX: number; maxX: number; minY: number; maxY: number; fixed: boolean }>;
        paddedBounds: Record<string, { minX: number; maxX: number; minY: number; maxY: number; fixed: boolean }>;
      };
      photoModeTransformResolver?: (context: {
        defaultTransform: {
          offsetX: number;
          offsetY: number;
          scaleX: number;
          scaleY: number;
          stretchX: number;
          stretchY: number;
        };
        layout: {
          rawBounds: Record<string, { minX: number; maxX: number; minY: number; maxY: number; fixed: boolean }>;
          paddedBounds: Record<string, { minX: number; maxX: number; minY: number; maxY: number; fixed: boolean }>;
        };
        item: {
          id: string;
          anchorName: string;
          lowSrc: string;
          highSrc: string;
          alt: string;
        };
        viewport: { width: number; height: number };
        metrics: { charWidth: number; charHeight: number };
        photoState: 'ascii' | 'entering' | 'photo' | 'exiting';
      }) => Partial<{
        offsetX: number;
        offsetY: number;
        scaleX: number;
        scaleY: number;
        stretchX: number;
        stretchY: number;
      }> | null | undefined;
    };

    expect(lastCall.align).toEqual({
      offsetX: -44.5,
      offsetY: -28,
      scaleX: 2.360000000000001,
      scaleY: 2.360000000000001,
      stretchX: 1,
      stretchY: 0.94
    });
    expect(lastCall.photoLayoutAugmenter).toEqual(expect.any(Function));
    expect(lastCall.photoModeTransformResolver).toEqual(expect.any(Function));

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 390
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: 844
    });
    updateCharMetricsForViewport(window.innerWidth);

    const baseLayout = {
      rawBounds: {
        hero: { minX: 22, maxX: 71, minY: 96, maxY: 145, fixed: false },
        'hero-video-0': { minX: 14, maxX: 65, minY: 10, maxY: 39, fixed: false },
        'hero-video-image-0': { minX: 11, maxX: 74, minY: 154, maxY: 202, fixed: false }
      },
      paddedBounds: {
        hero: { minX: 22, maxX: 71, minY: 96, maxY: 145, fixed: false },
        'hero-video-0': { minX: 14, maxX: 65, minY: 10, maxY: 39, fixed: false },
        'hero-video-image-0': { minX: 11, maxX: 74, minY: 154, maxY: 202, fixed: false }
      }
    };

    const augmentedLayout = lastCall.photoLayoutAugmenter?.(baseLayout);
    const { charWidth, charHeight } = getCurrentCharMetrics();
    const viewportCenterPx = window.innerWidth / 2;
    const centeredVideoBounds = augmentedLayout?.rawBounds['hero-video-0'];
    const centeredImageBounds = augmentedLayout?.rawBounds['hero-video-image-0'];

    expect(centeredVideoBounds).toBeDefined();
    expect(centeredImageBounds).toBeDefined();

    const resolveBoundsCenterPx = (bounds: { minX: number; maxX: number }) =>
      ((bounds.minX + bounds.maxX + 1) / 2) * charWidth;

    expect(Math.abs(resolveBoundsCenterPx(centeredVideoBounds!) - viewportCenterPx)).toBeLessThanOrEqual(charWidth);
    expect(Math.abs(resolveBoundsCenterPx(centeredImageBounds!) - viewportCenterPx)).toBeLessThanOrEqual(charWidth);

    const photoTransformOverride = lastCall.photoModeTransformResolver?.({
      defaultTransform: {
        offsetX: lastCall.align!.offsetX,
        offsetY: lastCall.align!.offsetY,
        scaleX: lastCall.align!.scaleX,
        scaleY: lastCall.align!.scaleY,
        stretchX: lastCall.align!.stretchX ?? 1,
        stretchY: lastCall.align!.stretchY ?? 1
      },
      layout: baseLayout,
      item: {
        id: 'Vending Machine Organoid-main',
        anchorName: 'hero',
        lowSrc: '/vending_machine.png',
        highSrc: '/vending_machine.png',
        alt: 'Vending Machine Organoid vending machine'
      },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      metrics: { charWidth, charHeight },
      photoState: 'photo'
    });

    expect(photoTransformOverride).toEqual(expect.objectContaining({
      offsetX: expect.any(Number)
    }));

    const heroBounds = baseLayout.rawBounds.hero;
    const heroWidthChars = heroBounds.maxX - heroBounds.minX + 1;
    const heroCenterPx = (
      heroBounds.minX
      + (photoTransformOverride?.offsetX ?? lastCall.align!.offsetX)
      + (heroWidthChars * lastCall.align!.scaleX) / 2
    ) * charWidth;

    expect(Math.abs(heroCenterPx - viewportCenterPx)).toBeLessThanOrEqual(charWidth);

    updateCharMetricsForViewport(1280);
  });
});
