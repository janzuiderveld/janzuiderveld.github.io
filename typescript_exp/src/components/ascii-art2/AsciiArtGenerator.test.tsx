// @vitest-environment jsdom

import { StrictMode } from 'react';
import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AsciiArtGenerator from './AsciiArtGenerator';

type MockCursor = {
  grid: { x: number; y: number };
  normalized: { x: number; y: number };
  isInWindow: boolean;
  isActive: boolean;
  clickRipples: unknown[];
  whiteout: null;
  whiteIn: null | {
    active: boolean;
    position: { x: number; y: number };
    timestamp: number;
    progress: number;
    duration: number;
  };
  whiteOverlay: null;
};

const { startWhiteInSpy, startWhiteoutSpy } = vi.hoisted(() => ({
  startWhiteInSpy: vi.fn<(origin: 'session' | 'fallback') => void>(),
  startWhiteoutSpy: vi.fn()
}));

vi.mock('./hooks', async () => {
  const React = await import('react');

  return {
    useTextPositioning: () => {
      const [ready, setReady] = React.useState(false);

      React.useEffect(() => {
        const timeoutId = window.setTimeout(() => setReady(true), 650);
        return () => window.clearTimeout(timeoutId);
      }, []);

      return ready
        ? {
            cache: {
              content: [{ startX: 0, endX: 1, y: 0 }]
            },
            bounds: {},
            gridCols: 80
          }
        : {
            cache: {},
            bounds: {},
            gridCols: 80
          };
    },
    useBlobCache: () => ({
      blobGridCache: {
        current: {
          fixed: { grid: [['X']] },
          scroll: { grid: [] }
        }
      },
      needsRebuildRef: { current: false },
      rebuildCacheTimeoutRef: { current: null },
      buildBlobCache: vi.fn()
    }),
    useScrolling: () => ({
      scrollOffset: 0,
      setScrollOffset: vi.fn(),
      scrollOffsetRef: { current: 0 },
      isScrolling: { current: false },
      scrollVelocity: { current: 0 }
    }),
    useCursor: () => {
      const [cursor, setCursor] = React.useState<MockCursor>({
        grid: { x: 0, y: 0 },
        normalized: { x: 0, y: 0 },
        isInWindow: false,
        isActive: false,
        clickRipples: [],
        whiteout: null,
        whiteIn: null,
        whiteOverlay: null
      });
      const cursorRef = React.useRef(cursor);

      React.useEffect(() => {
        cursorRef.current = cursor;
      }, [cursor]);

      React.useEffect(() => {
        if (window.sessionStorage.getItem('needsWhiteIn') !== 'true') {
          return;
        }

        window.sessionStorage.removeItem('needsWhiteIn');
        window.sessionStorage.setItem('lastWhiteInTimestamp', String(Date.now()));

        const nextCursor = {
          ...cursorRef.current,
          normalized: { x: 0, y: 0 },
          isInWindow: true,
          whiteIn: {
            active: true,
            position: { x: 0, y: 0 },
            timestamp: Date.now(),
            progress: 1,
            duration: 1000
          }
        };

        cursorRef.current = nextCursor;
        setCursor(nextCursor);
        startWhiteInSpy('session');
      }, []);

      const startWhiteIn = (position: { x: number; y: number }) => {
        const nextCursor = {
          ...cursorRef.current,
          normalized: position,
          isInWindow: true,
          whiteIn: {
            active: true,
            position,
            timestamp: Date.now(),
            progress: 1,
            duration: 1000
          }
        };

        cursorRef.current = nextCursor;
        setCursor(nextCursor);
        startWhiteInSpy('fallback');
      };

      return {
        cursor,
        cursorRef,
        startWhiteout: startWhiteoutSpy,
        startWhiteIn
      };
    },
    useLinks: () => ({
      updateLinkOverlays: vi.fn(),
      handleClick: vi.fn()
    }),
    useContentHeight: () => ({ maxScroll: 0 }),
    useAnimation: () => {}
  };
});

describe('AsciiArtGenerator white-in coordination', () => {
  let container: HTMLDivElement;
  let root: ReactDOM.Root;

  beforeEach(() => {
    vi.useFakeTimers();
    startWhiteInSpy.mockReset();
    startWhiteoutSpy.mockReset();
    window.sessionStorage.clear();
    window.sessionStorage.setItem('needsWhiteIn', 'true');
    window.sessionStorage.removeItem('lastWhiteInTimestamp');

    container = document.createElement('div');
    document.body.appendChild(container);
    root = ReactDOM.createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  it('does not schedule a second load white-in after the session white-in already ran', async () => {
    await act(async () => {
      root.render(
        <StrictMode>
          <AsciiArtGenerator
            textContent={[
              {
                text: 'X',
                x: 0,
                y: 0,
                fixed: true
              }
            ]}
          />
        </StrictMode>
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(900);
    });

    expect(startWhiteInSpy).toHaveBeenCalledTimes(1);
    expect(startWhiteInSpy).toHaveBeenCalledWith('session');
  });

  it('triggers ascii click entry from a custom hit test without relying on named overlays', async () => {
    window.sessionStorage.clear();
    const onAsciiClickStart = vi.fn();

    await act(async () => {
      root.render(
        <StrictMode>
          <AsciiArtGenerator
            textContent={[
              {
                text: 'X',
                x: 0,
                y: 0,
                fixed: true
              }
            ]}
            asciiClickHitTest={() => true}
            onAsciiClickStart={onAsciiClickStart}
          />
        </StrictMode>
      );
    });

    const asciiRoot = container.querySelector('div');
    expect(asciiRoot).not.toBeNull();

    await act(async () => {
      asciiRoot!.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: 120,
        clientY: 80
      }));
    });

    expect(onAsciiClickStart).toHaveBeenCalledTimes(1);
    expect(startWhiteoutSpy).toHaveBeenCalledTimes(1);
  });
});
