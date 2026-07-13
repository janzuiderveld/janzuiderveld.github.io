import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from './HomePage';
import type { AsciiLayoutInfo } from '../components/ascii-art2/types';

const asciiArtGeneratorSpy = vi.fn();

vi.mock('../components/ascii-art2/AsciiArtGenerator', () => ({
  default: (props: unknown) => {
    asciiArtGeneratorSpy(props);
    return <div data-testid="ascii-art-generator" />;
  }
}));

vi.mock('../utils/csv', () => ({
  loadCsv: vi.fn(async () => [])
}));

describe('HomePage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    asciiArtGeneratorSpy.mockReset();
    window.sessionStorage.setItem('homeIntroRippleSeen', 'true');
  });

  afterEach(() => {
    window.sessionStorage.clear();
    vi.useRealTimers();
  });

  it('lists Personal Audio Guide above Vending Machine Organoid at the top of the home project stack', async () => {
    render(<HomePage />);

    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
    });

    expect(screen.getByTestId('ascii-art-generator')).toBeInTheDocument();
    expect(asciiArtGeneratorSpy).toHaveBeenCalled();

    const lastCall = asciiArtGeneratorSpy.mock.calls.at(-1)?.[0] as {
      textContent?: Array<{
        name?: string;
        text?: string;
        anchorTo?: string;
      }>;
    };

    const workItems = (lastCall.textContent ?? []).filter(item => item.name?.startsWith('work-'));

    expect(workItems.slice(0, 3)).toEqual([
      expect.objectContaining({
        name: 'work-guide',
        text: '[[Personal Audio Guide]](#guide)',
        anchorTo: 'upcoming'
      }),
      expect.objectContaining({
        name: 'work-vending',
        text: '[[Vending Machine Organoid]](#vending)',
        anchorTo: 'work-guide'
      }),
      expect.objectContaining({
        name: 'work-camera',
        anchorTo: 'work-vending'
      })
    ]);
  });

  it('keeps the upcoming fallback content synchronized with the public event list', async () => {
    render(<HomePage />);

    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
    });

    const lastCall = asciiArtGeneratorSpy.mock.calls.at(-1)?.[0] as {
      textContent?: Array<{
        name?: string;
        text?: string;
      }>;
    };

    const upcomingText = (lastCall.textContent ?? []).find(item => item.name === 'upcoming')?.text;

    expect(upcomingText).not.toContain('The Founding Assembly for Machine Consciousness Research');
    expect(upcomingText).not.toContain('Lighthaven (Berkeley, CA, US)');
    expect(upcomingText).not.toContain('Dutch, More or Less');
    expect(upcomingText).toContain('==Semi-permanent installation==');
    expect(upcomingText).toContain('//California Institute for Machine Consciousness (San Francisco, US)//');
    expect(upcomingText).toContain('1/6/2026 > ?');
    expect(upcomingText).toContain('==Hello Worlds!==');
    expect(upcomingText).toContain('//Ars Electronica Center (Linz, AT)//');
    expect(upcomingText).toContain('9/9/2026 > ?');
  });

  it('applies the automatic home layout correction once per viewport/content generation', async () => {
    render(<HomePage />);

    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
    });

    const firstProps = asciiArtGeneratorSpy.mock.calls.at(-1)?.[0] as {
      onLayoutChange?: (layout: AsciiLayoutInfo) => void;
    };

    await act(async () => {
      firstProps.onLayoutChange?.({
        namedBounds: {},
        namedRawBounds: {
          upcoming: { minX: 0, maxX: 10, minY: 100, maxY: 110, fixed: false }
        },
        size: { width: 1706, height: 1650 }
      });
      await Promise.resolve();
    });

    const afterFirstCorrection = asciiArtGeneratorSpy.mock.calls.at(-1)?.[0] as {
      initialScrollOffset?: number;
      onLayoutChange?: (layout: AsciiLayoutInfo) => void;
      textContent?: Array<{ name?: string; y?: number }>;
    };
    const callCountAfterFirstCorrection = asciiArtGeneratorSpy.mock.calls.length;
    const titleAfterFirstCorrection = afterFirstCorrection.textContent?.find(item => item.name === 'title');

    expect(afterFirstCorrection.initialScrollOffset).toBe(0);
    expect(titleAfterFirstCorrection?.y).toBeGreaterThan(50);

    await act(async () => {
      afterFirstCorrection.onLayoutChange?.({
        namedBounds: {},
        namedRawBounds: {
          upcoming: { minX: 0, maxX: 10, minY: 320, maxY: 330, fixed: false }
        },
        size: { width: 1706, height: 1650 }
      });
      await Promise.resolve();
    });

    expect(asciiArtGeneratorSpy.mock.calls.length).toBe(callCountAfterFirstCorrection);
    expect((asciiArtGeneratorSpy.mock.calls.at(-1)?.[0] as { initialScrollOffset?: number }).initialScrollOffset).toBe(0);
  });
});
