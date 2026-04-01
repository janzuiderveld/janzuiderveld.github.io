import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CAMERA_ALIGN_DEFAULT } from '../assets/camera/align';
import CameraPage from './CameraPage';

const projectPageSpy = vi.fn();

vi.mock('../components/ProjectPage', () => ({
  default: (props: unknown) => {
    projectPageSpy(props);
    return <div data-testid="project-page" />;
  }
}));

describe('CameraPage', () => {
  it('uses the shared ProjectPage structure with camera-specific photo gallery config', () => {
    render(<CameraPage />);

    expect(screen.getByTestId('project-page')).toBeInTheDocument();
    expect(projectPageSpy).toHaveBeenCalledTimes(1);

    const lastCall = projectPageSpy.mock.calls.at(-1)?.[0] as {
      title?: string;
      titleFontName?: string;
      align?: typeof CAMERA_ALIGN_DEFAULT;
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
      extraPhotoItems?: Array<{ id: string }>;
      photoLayoutAugmenter?: unknown;
      photoCenterOnEnter?: boolean;
      photoInitialScrollTargetId?: string;
      photoInitialScrollAlignment?: string;
      photoInitialScrollPaddingRows?: number;
    };

    expect(lastCall.title).toBe('Life on _');
    expect(lastCall.titleFontName).toBe('ascii');
    expect(lastCall.align).toEqual({
      offsetX: 0.5,
      offsetY: -3,
      scaleX: 1.1,
      scaleY: 1.1,
      stretchX: 0.98,
      stretchY: 0.9199999999999999
    });
    expect(lastCall.photo).toEqual(expect.objectContaining({
      src: expect.any(String),
      alt: 'Camera installation',
      contentInsets: {
        top: 0.151,
        right: 0,
        bottom: 0.063,
        left: 0
      }
    }));
    expect(lastCall.extraPhotoItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'camera-video' })
      ])
    );
    expect(lastCall.photoLayoutAugmenter).toEqual(expect.any(Function));
    expect(lastCall.photoCenterOnEnter).toBe(true);
    expect(lastCall.photoInitialScrollTargetId).toBe('photo-column-0');
    expect(lastCall.photoInitialScrollAlignment).toBe('start');
    expect(lastCall.photoInitialScrollPaddingRows).toBe(2);
  });

  it('keeps the first photo-mode video above the aligned camera image with separation', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1024
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 768
    });

    render(<CameraPage />);

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
          maxX: 60,
          minY: 45,
          maxY: 65,
          fixed: false
        }
      },
      paddedBounds: {}
    });

    const videoBounds = layout?.rawBounds['photo-column-0'];
    expect(videoBounds).toBeDefined();
    const imageTop = Math.floor(45 + CAMERA_ALIGN_DEFAULT.offsetY);
    const bottomGap = imageTop - (videoBounds?.maxY ?? 0) - 1;
    expect(bottomGap).toBe(2);
    expect((videoBounds?.maxY ?? 0) - (videoBounds?.minY ?? 0) + 1).toBeLessThanOrEqual(18);
  });
});
