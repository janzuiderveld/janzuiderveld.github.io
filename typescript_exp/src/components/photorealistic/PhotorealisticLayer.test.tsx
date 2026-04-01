// @vitest-environment jsdom

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PhotorealisticLayer from './PhotorealisticLayer';

describe('PhotorealisticLayer cropped image content', () => {
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
