import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProjectPage from './ProjectPage';
import { PhotorealisticLayout } from './photorealistic/PhotorealisticLayer';

const photoModeSceneSpy = vi.fn();

vi.mock('./photorealistic/PhotoModeScene', () => ({
  default: (props: unknown) => {
    photoModeSceneSpy(props);
    return <div data-testid="photo-mode-scene" />;
  }
}));

describe('ProjectPage photo entry targets', () => {
  afterEach(() => {
    photoModeSceneSpy.mockReset();
  });

  it('keeps photo entry bound to the hero target instead of the title text', async () => {
    render(
      <MemoryRouter initialEntries={['/coffee']}>
        <ProjectPage
          title="Coffee Machine"
          text="Body copy"
          asciiArt={'@@@\n@@@'}
          photo={{ src: '/photo.png', alt: 'Coffee Machine placeholder' }}
          align={{ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 }}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(photoModeSceneSpy).toHaveBeenCalled();
    });
    const lastCall = photoModeSceneSpy.mock.calls.at(-1)?.[0] as { asciiClickTargets?: string[] };
    expect(lastCall.asciiClickTargets).toEqual(['hero']);
  });

  it('forwards custom supplemental photo items and layout augmentation to the shared photo scene', async () => {
    const customLayoutAugmenter = vi.fn((layout: PhotorealisticLayout) => ({
      rawBounds: {
        ...layout.rawBounds,
        detail: {
          minX: 0,
          maxX: 5,
          minY: 10,
          maxY: 15,
          fixed: false
        }
      },
      paddedBounds: layout.paddedBounds
    }));

    render(
      <MemoryRouter initialEntries={['/camera']}>
        <ProjectPage
          title="Life on _"
          titleFontName="ascii"
          text="Body copy"
          asciiArt={'@@@\n@@@'}
          photo={{ src: '/photo.png', alt: 'Camera installation' }}
          align={{ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 }}
          extraPhotoItems={[{
            id: 'detail-image',
            anchorName: 'detail',
            lowSrc: '/detail-low.png',
            highSrc: '/detail-high.png',
            alt: 'Detail'
          }]}
          photoLayoutAugmenter={customLayoutAugmenter}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(photoModeSceneSpy).toHaveBeenCalled();
    });
    const lastCall = photoModeSceneSpy.mock.calls.at(-1)?.[0] as {
      photoItems?: Array<{ id: string }>;
      layoutAugmenter?: (layout: PhotorealisticLayout) => PhotorealisticLayout;
    };

    expect(lastCall.photoItems?.map(item => item.id)).toEqual([
      'Life on _-main',
      'detail-image'
    ]);
    expect(lastCall.layoutAugmenter).toEqual(expect.any(Function));

    const baseLayout: PhotorealisticLayout = {
      rawBounds: {
        hero: {
          minX: 10,
          maxX: 20,
          minY: 30,
          maxY: 40,
          fixed: false
        }
      },
      paddedBounds: {}
    };

    const augmentedLayout = lastCall.layoutAugmenter?.(baseLayout);

    expect(customLayoutAugmenter).toHaveBeenCalledWith(baseLayout);
    expect(augmentedLayout?.rawBounds.detail).toEqual({
      minX: 0,
      maxX: 5,
      minY: 10,
      maxY: 15,
      fixed: false
    });
  });

  it('forwards main photo crop insets to the shared photo scene', async () => {
    render(
      <MemoryRouter initialEntries={['/fish']}>
        <ProjectPage
          title="This is not a fish"
          text="Body copy"
          asciiArt={'@@@\n@@@'}
          photo={{
            src: '/photo.png',
            alt: 'Fish placeholder',
            contentInsets: {
              top: 0.125,
              right: 0,
              bottom: 0,
              left: 0
            }
          }}
          align={{ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 }}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(photoModeSceneSpy).toHaveBeenCalled();
    });
    const lastCall = photoModeSceneSpy.mock.calls.at(-1)?.[0] as {
      photoItems?: Array<{ id: string; contentInsets?: { top: number; right: number; bottom: number; left: number } }>;
    };

    expect(lastCall.photoItems?.[0]).toEqual(expect.objectContaining({
      id: 'This is not a fish-main',
      contentInsets: {
        top: 0.125,
        right: 0,
        bottom: 0,
        left: 0
      }
    }));
  });

  it('switches to static export mode for pdf routes', async () => {
    render(
      <MemoryRouter initialEntries={['/fish?pdf=1']}>
        <ProjectPage
          title="This is not a fish"
          text="Body copy"
          asciiArt={'@@@\n@@@'}
          photo={{ src: '/photo.png', alt: 'Fish placeholder' }}
          align={{ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 }}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(photoModeSceneSpy).toHaveBeenCalled();
    });

    const lastCall = photoModeSceneSpy.mock.calls.at(-1)?.[0] as {
      textContent?: Array<{ name?: string }>;
      disableLinks?: boolean;
      alwaysVisiblePhotoItemIds?: string[];
      exportMetadataKey?: string;
      exportPrimaryPhotoItemId?: string;
      exportBackgroundOnly?: boolean;
      asciiClickTargets?: string[];
    };

    expect(lastCall.textContent?.map(item => item.name)).toEqual([
      'title',
      'text'
    ]);
    expect(lastCall.disableLinks).toBe(true);
    expect(lastCall.alwaysVisiblePhotoItemIds).toEqual([]);
    expect(lastCall.exportMetadataKey).toBe('This is not a fish');
    expect(lastCall.exportPrimaryPhotoItemId).toBe('This is not a fish-main');
    expect(lastCall.exportBackgroundOnly).toBe(false);
    expect(lastCall.asciiClickTargets).toEqual([]);
  });

  it('hides inline photo links in pdf export mode', async () => {
    render(
      <MemoryRouter initialEntries={['/guide?pdf=1']}>
        <ProjectPage
          title="Personal Audio Guide"
          text="Body copy"
          asciiArt={'@@@\n@@@'}
          photo={{ src: '/photo.png', alt: 'Guide placeholder' }}
          align={{ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 }}
          titleCalloutText="Call us"
          inlinePhotoLinkLabel="Video & Photos"
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(photoModeSceneSpy).toHaveBeenCalled();
    });

    const lastCall = photoModeSceneSpy.mock.calls.at(-1)?.[0] as {
      textContent?: Array<{ name?: string }>;
    };

    expect(lastCall.textContent?.map(item => item.name)).toEqual([
      'title',
      'title-callout',
      'text'
    ]);
  });

  it('can switch the shared scene into ascii-background-only export mode', async () => {
    render(
      <MemoryRouter initialEntries={['/fish?pdf=1&pdfbg=1']}>
        <ProjectPage
          title="This is not a fish"
          text="Body copy"
          asciiArt={'@@@\n@@@'}
          photo={{ src: '/photo.png', alt: 'Fish placeholder' }}
          align={{ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 }}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(photoModeSceneSpy).toHaveBeenCalled();
    });

    const lastCall = photoModeSceneSpy.mock.calls.at(-1)?.[0] as {
      alwaysVisiblePhotoItemIds?: string[];
      exportPrimaryPhotoItemId?: string;
      exportBackgroundOnly?: boolean;
      asciiClickTargets?: string[];
    };

    expect(lastCall.alwaysVisiblePhotoItemIds).toEqual([]);
    expect(lastCall.exportPrimaryPhotoItemId).toBe('This is not a fish-main');
    expect(lastCall.exportBackgroundOnly).toBe(true);
    expect(lastCall.asciiClickTargets).toEqual([]);
  });
});
