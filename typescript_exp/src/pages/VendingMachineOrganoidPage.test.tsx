import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
});
