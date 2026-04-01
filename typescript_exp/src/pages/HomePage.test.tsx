import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from './HomePage';

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
});
