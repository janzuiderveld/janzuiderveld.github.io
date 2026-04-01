import { describe, expect, it } from 'vitest';
import { resolvePhotoItemAtPoint } from './photoHitTest';
import { PhotoLayerItem, PhotorealisticLayout } from './PhotorealisticLayer';

describe('resolvePhotoItemAtPoint', () => {
  it('finds a scrolled raw-bound item within the hover radius', () => {
    const layout: PhotorealisticLayout = {
      rawBounds: {
        hero: {
          minX: 10,
          maxX: 19,
          minY: 20,
          maxY: 29,
          fixed: false
        }
      },
      paddedBounds: {}
    };
    const items: PhotoLayerItem[] = [{
      id: 'hero-image',
      anchorName: 'hero',
      lowSrc: '/low.png',
      highSrc: '/high.png',
      alt: 'Hero'
    }];

    const hit = resolvePhotoItemAtPoint({
      items,
      layout,
      clientX: 102,
      clientY: 101,
      radiusPx: 6,
      charWidth: 8,
      charHeight: 10,
      scrollOffsetPx: 100
    });

    expect(hit?.id).toBe('hero-image');
  });

  it('keeps fixed items anchored to the viewport instead of applying scroll offset', () => {
    const layout: PhotorealisticLayout = {
      rawBounds: {},
      paddedBounds: {
        'fixed-item': {
          minX: 4,
          maxX: 7,
          minY: 3,
          maxY: 5,
          fixed: true
        }
      }
    };
    const items: PhotoLayerItem[] = [{
      id: 'fixed-image',
      anchorName: 'fixed-item',
      lowSrc: '/low.png',
      highSrc: '/high.png',
      alt: 'Fixed',
      boundsSource: 'padded'
    }];

    const hit = resolvePhotoItemAtPoint({
      items,
      layout,
      clientX: 38,
      clientY: 34,
      radiusPx: 4,
      charWidth: 8,
      charHeight: 10,
      scrollOffsetPx: 240
    });

    expect(hit?.id).toBe('fixed-image');
  });
});
