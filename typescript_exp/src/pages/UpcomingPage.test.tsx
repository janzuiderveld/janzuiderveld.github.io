import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCsv } from '../utils/csv';
import UpcomingPage from './UpcomingPage';

const asciiArtGeneratorSpy = vi.fn();

vi.mock('../components/ascii-art2/AsciiArtGenerator', () => ({
  default: (props: unknown) => {
    asciiArtGeneratorSpy(props);
    return <div data-testid="ascii-art-generator" />;
  }
}));

vi.mock('../utils/csv', () => ({
  loadCsv: vi.fn()
}));

describe('UpcomingPage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    asciiArtGeneratorSpy.mockReset();
    vi.mocked(loadCsv).mockResolvedValue([
      {
        title: 'Coffee Machine',
        subtitle: 'Dutch, More or Less',
        location: 'Het Nieuwe Instituut (Rotterdam, NL)',
        date_range: '01/06/2024 > 30/05/2026'
      }
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders only the upcoming ongoing blob', async () => {
    render(<UpcomingPage />);

    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(200);
      await Promise.resolve();
    });

    expect(screen.getByTestId('ascii-art-generator')).toBeInTheDocument();

    const lastCall = asciiArtGeneratorSpy.mock.calls.at(-1)?.[0] as {
      textContent?: Array<{
        name?: string;
        text?: string;
        x?: number;
        y?: number;
        centered?: boolean;
        alignment?: 'left' | 'center' | 'right';
        maxWidthPercent?: number;
      }>;
      onLayoutChange?: (layout: {
        namedBounds: Record<string, unknown>;
        namedRawBounds: Record<string, {
          minY: number;
          maxY: number;
          fixed: boolean;
        }>;
        size: {
          height: number | null;
          width: number | null;
        };
      }) => void;
    };

    expect(lastCall.textContent).toEqual([
      expect.objectContaining({
        name: 'upcoming',
        x: 0,
        y: 20,
        centered: true,
        alignment: 'center',
        maxWidthPercent: 80,
        text: expect.stringContaining('==Upcoming ⟋ ongoing==')
      })
    ]);

    const upcomingText = lastCall.textContent?.[0]?.text ?? '';
    expect(upcomingText).toContain('==Dutch, More or Less==');
    expect(upcomingText).toContain('//Het Nieuwe Instituut (Rotterdam, NL)//');
    expect(upcomingText).toContain('01/06/2024 > 30/05/2026');
    expect(upcomingText).not.toContain('ABOUT');
    expect(upcomingText).not.toContain('WARANA');
  });

  it('recenters the blob from measured layout bounds on tall viewports', async () => {
    render(<UpcomingPage />);

    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(200);
      await Promise.resolve();
    });

    const initialCall = asciiArtGeneratorSpy.mock.calls.at(-1)?.[0] as {
      onLayoutChange?: (layout: {
        namedBounds: Record<string, unknown>;
        namedRawBounds: Record<string, {
          minY: number;
          maxY: number;
          fixed: boolean;
        }>;
        size: {
          height: number | null;
          width: number | null;
        };
      }) => void;
    };

    act(() => {
      initialCall.onLayoutChange?.({
        namedBounds: {},
        namedRawBounds: {
          upcoming: {
            minY: 24,
            maxY: 56,
            fixed: false
          }
        },
        size: {
          height: 1600,
          width: 900
        }
      });
    });

    const adjustedCall = asciiArtGeneratorSpy.mock.calls.at(-1)?.[0] as {
      textContent?: Array<{
        name?: string;
        y?: number;
      }>;
      onLayoutChange?: (layout: {
        namedBounds: Record<string, unknown>;
        namedRawBounds: Record<string, {
          minY: number;
          maxY: number;
          fixed: boolean;
        }>;
        size: {
          height: number | null;
          width: number | null;
        };
      }) => void;
    };

    expect(adjustedCall.textContent?.[0]).toEqual(expect.objectContaining({
      name: 'upcoming',
      y: expect.closeTo(37.5, 1)
    }));

    act(() => {
      adjustedCall.onLayoutChange?.({
        namedBounds: {},
        namedRawBounds: {
          upcoming: {
            minY: 24,
            maxY: 56,
            fixed: false
          }
        },
        size: {
          height: 1600,
          width: 900
        }
      });
    });

    const repeatedLayoutCall = asciiArtGeneratorSpy.mock.calls.at(-1)?.[0] as {
      textContent?: Array<{
        name?: string;
        y?: number;
      }>;
    };

    expect(repeatedLayoutCall.textContent?.[0]).toEqual(expect.objectContaining({
      name: 'upcoming',
      y: expect.closeTo(37.5, 1)
    }));
  });
});
