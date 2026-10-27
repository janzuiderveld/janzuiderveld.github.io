// @vitest-environment jsdom

import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PhotorealisticLayer from './PhotorealisticLayer';

describe('PhotorealisticLayer cropped image content', () => {
  it('reuses an already loaded image without a blurred, oversized duplicate on first entry', () => {
    const props = {
      items: [{ id: 'hero', anchorName: 'hero', lowSrc: '/same.png', highSrc: '/same.png', alt: 'Hero', stretchX: 1.2 }],
      layout: { rawBounds: { hero: { minX: 0, maxX: 20, minY: 0, maxY: 30, fixed: false } }, paddedBounds: {} },
      scrollOffset: 0, isInteractive: false
    };
    const { container, rerender } = render(<PhotorealisticLayer {...props} isVisible={false} showHighRes={false} />);
    const original = container.querySelector('img');
    expect(original?.style.filter).not.toContain('blur');
    expect(original?.style.transform).toBe('scale(1.2, 1)');
    const decode = vi.fn(() => Promise.resolve());
    Object.defineProperty(original, 'decode', { configurable: true, value: decode });
    fireEvent.load(original!);
    expect(decode).toHaveBeenCalledOnce();
    rerender(<PhotorealisticLayer {...props} isVisible showHighRes />);
    expect(container.querySelectorAll('img')).toHaveLength(1);
    expect(container.querySelector('img')).toBe(original);
  });

  it('zooms and repositions image content inside the same wrapper when content insets are provided', () => {
    const { container } = render(
      <PhotorealisticLayer
        items={[{
          id: 'fish-main',
          anchorName: 'hero',
          lowSrc: '/fish-low.png',
          highSrc: '/fish-high.png',
          alt: 'Fish',
          contentInsets: {
            top: 0.25,
            right: 0,
            bottom: 0.25,
            left: 0
          }
        }]}
        layout={{
          rawBounds: {
            hero: {
              minX: 10,
              maxX: 19,
              minY: 5,
              maxY: 14,
              fixed: false
            }
          },
          paddedBounds: {}
        }}
        scrollOffset={0}
        isVisible={true}
        showHighRes={false}
        isInteractive={false}
      />
    );

    const cropFrame = container.querySelector('[data-photo-crop-frame="true"]') as HTMLDivElement | null;
    expect(cropFrame).not.toBeNull();
    expect(cropFrame).toHaveStyle({
      width: '200%',
      height: '200%',
      left: '-50%',
      top: '-50%'
    });
  });
});
