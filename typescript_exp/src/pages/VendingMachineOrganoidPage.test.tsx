import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCurrentCharMetrics, updateCharMetricsForViewport } from '../components/ascii-art2/constants';
import { resolvePhotoItemPixelRect } from '../components/photorealistic/PhotorealisticLayer';
import VendingMachineOrganoidPage from './VendingMachineOrganoidPage';

const projectPageSpy = vi.fn();
vi.mock('../components/ProjectPage', () => ({
  default: (props: unknown) => { projectPageSpy(props); return null; }
}));
const pageProps = () => {
  render(<VendingMachineOrganoidPage />);
  return projectPageSpy.mock.calls.at(-1)![0];
};

describe('VendingMachineOrganoidPage', () => {
  afterEach(() => {
    projectPageSpy.mockReset();
    updateCharMetricsForViewport(1280);
  });

  it('uses the approved white-background machine with ASCII matching its cropped proportions', () => {
    const props = pageProps();
    expect(props.photo.src).toContain('vending-white-max.png');
    expect(props.photo.filter).toBeUndefined();
    expect(props.photo.contentInsets).toEqual({
      left: 118 / 2304, right: 118 / 2304,
      top: 472 / 3600, bottom: 549 / 3600
    });
    const rows = props.asciiArt.split('\n');
    expect(rows).toHaveLength(42);
    expect(rows.every((row: string) => row.length === 56)).toBe(true);
    expect(56 * 0.6 / 42).toBeCloseTo(2068 / 2579, 2);
    expect(props.align).toEqual({ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, stretchX: 1, stretchY: 1 });
    expect(props.photoModeTransformResolver).toBeUndefined();
    const cells = rows.join('');
    expect([...cells].filter(c => c === ' ').length / cells.length).toBeGreaterThan(0.35);
    expect([...cells].filter(c => '#%@'.includes(c)).length).toBeGreaterThan(30);
  });

  it('keeps the collection tray, change tray and shelf edges visible', () => {
    const rows = pageProps().asciiArt.split('\n');
    for (const y of [7, 13, 18, 23, 28]) {
      expect(rows[y].slice(8, 36)).toMatch(/[-_]{20}/);
    }
    for (const [left, top, right, bottom] of [[10, 34, 39, 39], [45, 25, 50, 28], [44, 32, 51, 40]]) {
      expect(rows[top].slice(left + 1, right)).toMatch(/^[-_]+$/);
      expect(rows[bottom].slice(left + 1, right)).toMatch(/^[-_]+$/);
      for (let y = top + 1; y < bottom; y++) {
        expect(rows[y][left]).toBe('|');
        expect(rows[y][right]).toBe('|');
      }
    }
    expect(pageProps().photoAlignmentKey).toBe('vending-white-max');
  });

  it('retains both original Mondriaan photos as supplemental images', () => {
    const props = pageProps();
    expect(props.photoImages).toHaveLength(2);
    expect(props.photoImages[0]).toMatchObject({
      src: expect.stringContaining('conflux_installation_Gaiadrr.jpg'),
      heightRatio: 2 / 3, position: 'below', objectFit: 'contain'
    });
    expect(props.photoImages[1]).toMatchObject({
      src: expect.stringContaining('conflux_visitor_Gaiadrr.jpg'),
      heightRatio: 1.5, position: 'below', objectFit: 'contain'
    });
  });

  it('keeps the video and enters photo mode at the video', () => {
    const props = pageProps();
    expect(props.photoVideos).toHaveLength(1);
    expect(props.photoVideos[0].embedSrc).toContain('1179367379');
    expect(props.photoVideos[0].widthScale).toBeLessThan(props.photoImages[0].widthScale);
    expect(props.photoInitialScrollTargetId).toBe('hero-video-0');
    expect(props.photoInitialScrollAlignment).toBe('start');
    expect(props.photoInitialScrollPaddingRows).toBe(5);
    expect(props.photoCenterOnEnter).toBe(true);
  });

  it.each([390, 900, 1280])('preserves the ASCII hero geometry and fits the supplemental gallery at %ipx', width => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
    updateCharMetricsForViewport(width);
    const props = pageProps();
    const { charWidth, charHeight } = getCurrentCharMetrics();
    const minX = Math.floor(width / charWidth / 2) - 28;
    const hero = { minX, maxX: minX + 55, minY: 96, maxY: 137, fixed: false };
    const rawBounds = {
      hero,
      'hero-video-0': { ...hero, minY: 60, maxY: 89 },
      'hero-video-image-0': { ...hero, minY: 152, maxY: 181 },
      'hero-video-image-1': { ...hero, minY: 190, maxY: 253 }
    };
    const original = structuredClone(rawBounds);
    const result = props.photoLayoutAugmenter({ rawBounds, paddedBounds: rawBounds });
    expect(result.rawBounds.hero).toEqual(hero);
    expect(rawBounds).toEqual(original);
    let previous = hero;
    for (const [name, ratio] of [['hero-video-image-0', 2 / 3], ['hero-video-image-1', 1.5]] as const) {
      const b = result.rawBounds[name];
      expect(b.minY).toBe(previous.maxY + 9);
      expect(Math.abs((b.minX + b.maxX + 1) * charWidth / 2 - width / 2)).toBeLessThanOrEqual(charWidth);
      expect((b.maxX - b.minX + 1) * charWidth).toBeLessThanOrEqual(width * 0.8);
      expect(Math.abs((b.maxY - b.minY + 1) * charHeight / ((b.maxX - b.minX + 1) * charWidth) - ratio)).toBeLessThan(0.05);
      previous = b;
    }
    const rect = resolvePhotoItemPixelRect({
      id: 'hero', anchorName: 'hero', lowSrc: '', highSrc: '', alt: '', ...props.align
    }, result);
    expect(rect).toEqual({ left: minX * charWidth, top: 96 * charHeight, width: 56 * charWidth, height: 42 * charHeight });
    expect(result.rawBounds['hero-video-0'].maxY).toBe(hero.minY - 7);
  });

  it('preserves the agreed text and credits', () => {
    const { text } = pageProps();
    expect(text).toContain('Created in collaboration with Xinyi Zhang, supported by Finalspark, co-produced by V2_ Lab for the Unstable Media as part of the Microdosing A.I. art and technology residencies.');
    expect(text).toContain('The pursuit of efficiency once replaced shopkeepers with vending machines.');
    expect(text).toContain('rhythms.\n\nInside this machine, human brain cells work for coins.');
    expect(text).toContain('Here, coins and keypresses stimulate living neural tissue, whose activity holds your credit and determines what is selected.');
    expect(text).toContain("Photos: Gaia D'Arrigo");
  });
});
