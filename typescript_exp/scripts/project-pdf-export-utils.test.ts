// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  buildProjectPdfHostedPageUrl,
  computeProjectPdfCanvasDimensions,
  computeProjectPdfCaptureCandidateScore,
  computeProjectPdfPhotoContentBottom,
  computeProjectPdfPhotoLayout,
  computeProjectPdfTitleLinkLayout,
  computeProjectPdfAlphaMaskBounds,
  expandProjectPdfAlphaMask,
  extractProjectPdfSubjectMask,
  resolveProjectPdfContentLayout,
  resolveProjectPdfPrimaryPhotoItem,
  shouldEraseProjectPdfBlobCell
} from './project-pdf-export-utils.mjs';

describe('project pdf export helpers', () => {
  it('resolves title/text rectangles and uses padded text bounds for the photo start', () => {
    const layout = resolveProjectPdfContentLayout({
      charMetrics: { charWidth: 10, charHeight: 20 },
      bounds: {
        raw: {
          title: { minX: 10, maxX: 29, minY: 2, maxY: 5, fixed: false },
          text: { minX: 20, maxX: 49, minY: 10, maxY: 19, fixed: false }
        },
        padded: {
          title: { minX: 8, maxX: 31, minY: 0, maxY: 7, fixed: false },
          text: { minX: 18, maxX: 51, minY: 8, maxY: 21, fixed: false }
        }
      }
    });

    expect(layout.titleRect).toEqual({
      left: 100,
      top: 40,
      width: 200,
      height: 80
    });
    expect(layout.paddedTitleRect).toEqual({
      left: 80,
      top: 0,
      width: 240,
      height: 160
    });
    expect(layout.textRect).toEqual({
      left: 200,
      top: 200,
      width: 300,
      height: 200
    });
    expect(layout.paddedTextRect).toEqual({
      left: 180,
      top: 160,
      width: 340,
      height: 280
    });
    expect(layout.contentBottom).toBe(440);
  });

  it('resolves the requested primary photo item', () => {
    const photoItem = resolveProjectPdfPrimaryPhotoItem({
      primaryPhotoItemId: 'fish-main',
      photoItems: [
        {
          id: 'detail',
          anchorName: 'detail',
          lowSrc: '/detail-low.png',
          highSrc: '/detail-high.png',
          alt: 'Detail'
        },
        {
          id: 'fish-main',
          anchorName: 'hero',
          lowSrc: '/fish-low.png',
          highSrc: '/fish-high.png',
          alt: 'Fish'
        }
      ]
    });

    expect(photoItem).toEqual(expect.objectContaining({
      id: 'fish-main',
      highSrc: '/fish-high.png'
    }));
  });

  it('fits the photo to the available width under the text block', () => {
    const photoFrame = computeProjectPdfPhotoLayout({
      pageWidth: 842,
      pageHeight: 1191,
      marginX: 48,
      marginBottom: 54,
      contentBottom: 420,
      gap: 30,
      photoAspectRatio: 1.5
    });

    expect(photoFrame).toEqual({
      x: 48,
      y: 545,
      width: 746,
      height: 497
    });
  });

  it('fits the photo to the available height when the image is narrow', () => {
    const photoFrame = computeProjectPdfPhotoLayout({
      pageWidth: 842,
      pageHeight: 1191,
      marginX: 48,
      marginBottom: 54,
      contentBottom: 420,
      gap: 30,
      photoAspectRatio: 0.8
    });

    expect(photoFrame).toEqual({
      x: 146,
      y: 450,
      width: 550,
      height: 687
    });
  });

  it('grows the photo and brings it closer to both edges when the reserved gap shrinks', () => {
    const spaciousFrame = computeProjectPdfPhotoLayout({
      pageWidth: 842,
      pageHeight: 1191,
      marginX: 48,
      marginBottom: 60,
      contentBottom: 692,
      gap: 44,
      photoAspectRatio: 0.8
    });

    const tighterFrame = computeProjectPdfPhotoLayout({
      pageWidth: 842,
      pageHeight: 1191,
      marginX: 48,
      marginBottom: 44,
      contentBottom: 692,
      gap: 28,
      photoAspectRatio: 0.8
    });

    expect(tighterFrame.height).toBeGreaterThan(spaciousFrame.height);
    expect(tighterFrame.width).toBeGreaterThan(spaciousFrame.width);
    expect(tighterFrame.y).toBeLessThan(spaciousFrame.y);
    expect(tighterFrame.y + tighterFrame.height).toBeGreaterThan(spaciousFrame.y + spaciousFrame.height);
  });

  it('supports the slightly tighter portrait framing used by the final pdf composition', () => {
    expect(computeProjectPdfPhotoLayout({
      pageWidth: 842,
      pageHeight: 1191,
      marginX: 48,
      marginBottom: 36,
      contentBottom: 692,
      gap: 20,
      photoAspectRatio: 0.8
    })).toEqual({
      x: 244,
      y: 712,
      width: 354,
      height: 443
    });
  });

  it('caps how much padded text-blob tail can push the photo downward', () => {
    expect(computeProjectPdfPhotoContentBottom({
      textRect: {
        left: 240,
        top: 400,
        width: 360,
        height: 220
      },
      paddedTextRect: {
        left: 200,
        top: 340,
        width: 440,
        height: 420
      },
      maxExtraPadding: 72
    })).toBe(692);
  });

  it('builds the hosted warana route without export-only query params', () => {
    expect(buildProjectPdfHostedPageUrl('#/fish?pdf=1&pdfbg=1')).toBe('https://warana.xyz/#/fish');
    expect(buildProjectPdfHostedPageUrl('coffee?photo=1')).toBe('https://warana.xyz/#/coffee?photo=1');
  });

  it('positions the title link below the title while keeping it inside the title blob', () => {
    expect(computeProjectPdfTitleLinkLayout({
      titleRect: {
        left: 120,
        top: 100,
        width: 500,
        height: 48
      },
      paddedTitleRect: {
        left: 80,
        top: 72,
        width: 580,
        height: 140
      }
    })).toEqual({
      centerX: 370,
      top: 160,
      width: 522,
      fontSize: 18,
      lineHeight: 22
    });
  });

  it('positions the title link below occupied callout rows inside the title blob', () => {
    expect(computeProjectPdfTitleLinkLayout({
      titleRect: {
        left: 120,
        top: 100,
        width: 500,
        height: 48
      },
      paddedTitleRect: {
        left: 80,
        top: 72,
        width: 580,
        height: 180
      },
      occupiedTitleRects: [
        {
          left: 220,
          top: 156,
          width: 200,
          height: 16
        },
        {
          left: 250,
          top: 180,
          width: 160,
          height: 16
        }
      ]
    })).toEqual({
      centerX: 370,
      top: 208,
      width: 522,
      fontSize: 18,
      lineHeight: 22
    });
  });

  it('builds a higher-resolution backing canvas while preserving the page css size', () => {
    expect(computeProjectPdfCanvasDimensions({
      pageWidth: 842,
      pageHeight: 1191,
      pixelRatio: 4
    })).toEqual({
      width: 3368,
      height: 4764,
      cssWidth: 842,
      cssHeight: 1191,
      pixelRatio: 4
    });
  });

  it('prefers the smallest capture viewport once the photo clears the comfort threshold', () => {
    const smallerViewportScore = computeProjectPdfCaptureCandidateScore({
      viewportWidth: 920,
      photoFrame: {
        x: 0,
        y: 0,
        width: 380,
        height: 470
      },
      minPhotoWidth: 360,
      minPhotoHeight: 420
    });

    const largerViewportScore = computeProjectPdfCaptureCandidateScore({
      viewportWidth: 1320,
      photoFrame: {
        x: 0,
        y: 0,
        width: 520,
        height: 640
      },
      minPhotoWidth: 360,
      minPhotoHeight: 420
    });

    expect(smallerViewportScore).toBeGreaterThan(largerViewportScore);
  });

  it('falls back to the largest photo area when no candidate meets the comfort threshold', () => {
    const smallerPhotoScore = computeProjectPdfCaptureCandidateScore({
      viewportWidth: 900,
      photoFrame: {
        x: 0,
        y: 0,
        width: 300,
        height: 360
      },
      minPhotoWidth: 360,
      minPhotoHeight: 420
    });

    const largerPhotoScore = computeProjectPdfCaptureCandidateScore({
      viewportWidth: 1100,
      photoFrame: {
        x: 0,
        y: 0,
        width: 340,
        height: 400
      },
      minPhotoWidth: 360,
      minPhotoHeight: 420
    });

    expect(largerPhotoScore).toBeGreaterThan(smallerPhotoScore);
  });

  it('removes edge-connected white background while preserving enclosed white subject pixels', () => {
    const rgba = new Uint8ClampedArray([
      255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
      255, 255, 255, 255,   0,   0,   0, 255,   0,   0,   0, 255,   0,   0,   0, 255, 255, 255, 255, 255,
      255, 255, 255, 255,   0,   0,   0, 255, 255, 255, 255, 255,   0,   0,   0, 255, 255, 255, 255, 255,
      255, 255, 255, 255,   0,   0,   0, 255,   0,   0,   0, 255,   0,   0,   0, 255, 255, 255, 255, 255,
      255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255
    ]);

    const subject = extractProjectPdfSubjectMask({
      rgba,
      width: 5,
      height: 5
    });

    expect(subject.bounds).toEqual({
      minX: 1,
      maxX: 3,
      minY: 1,
      maxY: 3
    });
    expect(subject.alphaMask[2 * 5 + 2]).toBe(255);
    expect(subject.alphaMask[0]).toBe(0);
  });

  it('treats transparent pixels as removable background when detecting the subject silhouette', () => {
    const rgba = new Uint8ClampedArray([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 10, 10, 10, 255, 0, 0, 0, 0,
      0, 0, 0, 0, 10, 10, 10, 255, 0, 0, 0, 0
    ]);

    const subject = extractProjectPdfSubjectMask({
      rgba,
      width: 3,
      height: 3
    });

    expect(subject.bounds).toEqual({
      minX: 1,
      maxX: 1,
      minY: 1,
      maxY: 2
    });
  });

  it('expands the subject mask so the blob can erase a padded silhouette behind the image', () => {
    const expandedMask = expandProjectPdfAlphaMask({
      alphaMask: new Uint8ClampedArray([
        0, 0, 0,
        0, 255, 0,
        0, 0, 0
      ]),
      width: 3,
      height: 3,
      radius: 1
    });

    expect(Array.from(expandedMask)).toEqual([
      255, 255, 255,
      255, 255, 255,
      255, 255, 255
    ]);
    expect(computeProjectPdfAlphaMaskBounds(expandedMask, 3, 3)).toEqual({
      minX: 0,
      maxX: 2,
      minY: 0,
      maxY: 2
    });
  });

  it('erases fully covered cells and leaves uncovered cells alone', () => {
    expect(shouldEraseProjectPdfBlobCell({
      coverage: 0.9,
      cellX: 5,
      cellY: 9
    })).toBe(true);

    expect(shouldEraseProjectPdfBlobCell({
      coverage: 0.04,
      cellX: 5,
      cellY: 9
    })).toBe(false);
  });

  it('uses a deterministic edge pattern for partially covered cells', () => {
    expect(shouldEraseProjectPdfBlobCell({
      coverage: 0.2,
      cellX: 1,
      cellY: 1
    })).toBe(true);

    expect(shouldEraseProjectPdfBlobCell({
      coverage: 0.2,
      cellX: 3,
      cellY: 4
    })).toBe(false);
  });
});
