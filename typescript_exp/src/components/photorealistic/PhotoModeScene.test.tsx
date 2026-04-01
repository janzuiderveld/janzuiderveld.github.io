// @vitest-environment jsdom

import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentCharMetrics } from '../ascii-art2/constants';
import PhotoModeScene from './PhotoModeScene';

const asciiArtGeneratorSpy = vi.fn();
const photorealisticLayerSpy = vi.fn();

vi.mock('../ascii-art2/AsciiArtGenerator', async () => {
  const React = await import('react');

  return {
    default: (props: {
      onLayoutChange?: (layout: {
        namedBounds: Record<string, unknown>;
        namedRawBounds: Record<string, unknown>;
        size: { width: number; height: number };
      }) => void;
      scrollToOffset?: number | null;
    }) => {
      asciiArtGeneratorSpy(props);

      React.useEffect(() => {
        props.onLayoutChange?.({
          namedBounds: {
            hero: { minX: 0, maxX: 20, minY: 80, maxY: 100, fixed: false },
            target: { minX: 0, maxX: 20, minY: 100, maxY: 120, fixed: false }
          },
          namedRawBounds: {
            hero: { minX: 0, maxX: 20, minY: 80, maxY: 100, fixed: false },
            target: { minX: 0, maxX: 20, minY: 100, maxY: 120, fixed: false }
          },
          size: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        });
      }, [props.onLayoutChange]);

      return <div data-testid="ascii-generator" />;
    }
  };
});

vi.mock('./PhotorealisticLayer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./PhotorealisticLayer')>();

  return {
    ...actual,
    default: (props: unknown) => {
      photorealisticLayerSpy(props);
      return null;
    }
  };
});

vi.mock('./PhotoHoverWindow', () => ({
  default: () => null,
  getPhotoHoverRadiusPx: () => 0
}));

vi.mock('./InteractiveEmbedFrame', () => ({
  default: () => null
}));

vi.mock('../../utils/browserCapabilities', () => ({
  supportsHoverInteractions: () => false
}));

const setViewportSize = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    writable: true,
    value: height
  });
};

const getLatestScrollToOffset = () =>
  (asciiArtGeneratorSpy.mock.calls.at(-1)?.[0] as { scrollToOffset?: number | null } | undefined)?.scrollToOffset ?? null;

describe('PhotoModeScene resize centering', () => {
  let playSpy: ReturnType<typeof vi.spyOn>;
  let pauseSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    asciiArtGeneratorSpy.mockReset();
    photorealisticLayerSpy.mockReset();
    playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
    pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    setViewportSize(1280, 720);
    window.location.hash = '#/fish?photo=1';
  });

  afterEach(() => {
    playSpy.mockRestore();
    pauseSpy.mockRestore();
    vi.useRealTimers();
    window.location.hash = '#/';
  });

  it('recenters the active photo entry target after viewport resize', async () => {
    render(
      <PhotoModeScene
        textContent={[]}
        photoItems={[{
          id: 'fish-main',
          anchorName: 'hero',
          lowSrc: '/fish.png',
          highSrc: '/fish.png',
          alt: 'Fish'
        }]}
        asciiClickTargets={['hero']}
        autoEnterPhoto={true}
        centerOnLoad={true}
        initialScrollTargetId="target"
      />
    );

    await act(async () => {
      vi.runOnlyPendingTimers();
    });

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    const { charHeight } = getCurrentCharMetrics();
    const targetCenterRow = 110;
    const expectedInitialOffset = Math.max(0, targetCenterRow - (720 / charHeight) / 2) * charHeight;
    expect(getLatestScrollToOffset()).toBeCloseTo(expectedInitialOffset, 4);

    await act(async () => {
      setViewportSize(1000, 900);
      window.dispatchEvent(new Event('resize'));
      vi.runOnlyPendingTimers();
    });

    const expectedResizedOffset = Math.max(0, targetCenterRow - (900 / charHeight) / 2) * charHeight;
    expect(getLatestScrollToOffset()).toBeCloseTo(expectedResizedOffset, 4);
  });

  it('can align the active photo entry target to the top of the viewport with padding', async () => {
    render(
      <PhotoModeScene
        textContent={[]}
        photoItems={[{
          id: 'copy-video',
          anchorName: 'hero',
          mediaType: 'video',
          kind: 'file',
          videoSrc: '/copy.mp4',
          alt: 'Copy Machine video'
        }]}
        asciiClickTargets={['hero']}
        autoEnterPhoto={true}
        centerOnLoad={true}
        centerOnEnter={true}
        initialScrollTargetId="target"
        initialScrollAlignment="start"
        initialScrollPaddingRows={5}
      />
    );

    await act(async () => {
      vi.runOnlyPendingTimers();
    });

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    const { charHeight } = getCurrentCharMetrics();
    const expectedOffset = Math.max(0, 100 - 5) * charHeight;
    expect(getLatestScrollToOffset()).toBeCloseTo(expectedOffset, 4);

    await act(async () => {
      setViewportSize(1000, 900);
      window.dispatchEvent(new Event('resize'));
      vi.runOnlyPendingTimers();
    });

    expect(getLatestScrollToOffset()).toBeCloseTo(expectedOffset, 4);
  });

  it('starts file videos when photo mode becomes visible', async () => {
    render(
      <PhotoModeScene
        textContent={[]}
        photoItems={[{
          id: 'copy-video',
          anchorName: 'hero',
          mediaType: 'video',
          kind: 'file',
          videoSrc: '/copy.mp4',
          alt: 'Copy Machine video',
          muted: true,
          playsInline: true
        }]}
        asciiClickTargets={['hero']}
      />
    );

    playSpy.mockClear();
    pauseSpy.mockClear();

    await act(async () => {
      (window as typeof window & {
        __projectPhotoMode?: { enter: () => boolean };
      }).__projectPhotoMode?.enter();
      vi.runOnlyPendingTimers();
    });

    const video = document.querySelector('video') as HTMLVideoElement | null;
    expect(video).not.toBeNull();
    expect(playSpy).toHaveBeenCalled();
  });

  it('can keep a requested image visible behind the ascii layout for export rendering', async () => {
    render(
      <PhotoModeScene
        textContent={[]}
        photoItems={[{
          id: 'fish-main',
          anchorName: 'hero',
          lowSrc: '/fish.png',
          highSrc: '/fish.png',
          alt: 'Fish'
        }]}
        asciiClickTargets={['hero']}
        alwaysVisiblePhotoItemIds={['fish-main']}
        disableLinks={true}
      />
    );

    const lastPhotoLayerCall = photorealisticLayerSpy.mock.calls.at(-1)?.[0] as {
      items?: Array<{ id: string }>;
      isVisible?: boolean;
      opacity?: number;
      isInteractive?: boolean;
      showHighRes?: boolean;
      zIndex?: number;
    };
    const lastAsciiCall = asciiArtGeneratorSpy.mock.calls.at(-1)?.[0] as {
      disableLinks?: boolean;
      asciiClickTargets?: string[];
      suppressTextCharacters?: boolean;
    };

    expect(lastPhotoLayerCall.items?.map(item => item.id)).toEqual(['fish-main']);
    expect(lastPhotoLayerCall.isVisible).toBe(true);
    expect(lastPhotoLayerCall.opacity).toBe(1);
    expect(lastPhotoLayerCall.isInteractive).toBe(false);
    expect(lastPhotoLayerCall.showHighRes).toBe(true);
    expect(lastPhotoLayerCall.zIndex).toBe(0);
    expect(lastAsciiCall.disableLinks).toBe(true);
    expect(lastAsciiCall.suppressTextCharacters).toBe(false);
    expect(lastAsciiCall.asciiClickTargets).toEqual([]);
  });

  it('publishes the requested primary photo metadata for pdf export composition', async () => {
    render(
      <PhotoModeScene
        textContent={[]}
        photoItems={[{
          id: 'fish-main',
          anchorName: 'hero',
          lowSrc: '/fish-low.png',
          highSrc: '/fish-high.png',
          alt: 'Fish',
          contentInsets: {
            top: 0.125,
            right: 0,
            bottom: 0,
            left: 0
          }
        }]}
        asciiClickTargets={[]}
        disableLinks={true}
        exportMetadataKey="This is not a fish"
        exportPrimaryPhotoItemId="fish-main"
      />
    );

    await act(async () => {
      vi.runOnlyPendingTimers();
    });

    const exportData = (
      window as typeof window & {
        __projectPdfExport?: {
          primaryPhotoItem?: {
            id: string;
            highSrc: string;
            lowSrc: string;
            contentInsets?: { top: number; right: number; bottom: number; left: number };
          } | null;
          photoRects?: Record<string, { width: number; height: number }>;
        };
      }
    ).__projectPdfExport;

    expect(exportData?.primaryPhotoItem).toEqual(expect.objectContaining({
      id: 'fish-main',
      highSrc: '/fish-high.png',
      lowSrc: '/fish-low.png',
      contentInsets: {
        top: 0.125,
        right: 0,
        bottom: 0,
        left: 0
      }
    }));
    expect(exportData?.photoRects?.['fish-main']).toEqual(expect.objectContaining({
      width: expect.any(Number),
      height: expect.any(Number)
    }));
  });

  it('can suppress visible ascii text while keeping the blob field for background-only export', async () => {
    render(
      <PhotoModeScene
        textContent={[]}
        photoItems={[{
          id: 'fish-main',
          anchorName: 'hero',
          lowSrc: '/fish.png',
          highSrc: '/fish.png',
          alt: 'Fish'
        }]}
        asciiClickTargets={['hero']}
        alwaysVisiblePhotoItemIds={['fish-main']}
        disableLinks={true}
        exportBackgroundOnly={true}
      />
    );

    const lastAsciiCall = asciiArtGeneratorSpy.mock.calls.at(-1)?.[0] as {
      suppressTextCharacters?: boolean;
    };

    expect(photorealisticLayerSpy).not.toHaveBeenCalled();
    expect(lastAsciiCall.suppressTextCharacters).toBe(true);
  });
});
