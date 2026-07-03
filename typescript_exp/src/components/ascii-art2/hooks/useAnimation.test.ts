import React, { useCallback, useEffect, useRef } from 'react';
import { act } from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LinkPosition, TextPositionCacheResult } from '../types';
import {
  renderRowsToHtml,
  renderRowsToPreElement,
  shouldCalculateExactFrameCell,
  useAnimation
} from './useAnimation';

const makeTextPositionCache = (): TextPositionCacheResult => ({
  cache: {},
  grid: [
    null,
    { char: 'A', fixed: false },
    null,
    null,
    null,
    { char: 'B', fixed: true },
    null,
    null
  ],
  bounds: {},
  links: [],
  gridCols: 4,
  offsetY: 0
});

describe('renderRowsToHtml', () => {
  it('escapes generated ascii characters before writing frame HTML', () => {
    const rows = [
      ['&', '<', '>', ' '],
      ['A', '&', 'B', ';']
    ];

    expect(renderRowsToHtml(rows, 2, 4, new Map())).toBe('&amp;&lt;&gt; \nA&amp;B;');
  });

  it('escapes styled character placeholders while preserving wrapper markup', () => {
    const rows = [
      ['&', '<', '>']
    ];
    const styles = new Map<number, string>([
      [0, '<a href="#/" data-link-url="#/">$</a>'],
      [1, '<span style="font-weight:bold">$</span>']
    ]);

    expect(renderRowsToHtml(rows, 1, 3, styles)).toBe(
      '<a href="#/" data-link-url="#/">&amp;</a><span style="font-weight:bold">&lt;</span>&gt;'
    );
  });

  it('preserves undefined generated cells as literal text in HTML output', () => {
    const rows = [
      ['A', undefined as unknown as string, 'C']
    ];

    expect(renderRowsToHtml(rows, 1, 3, new Map())).toBe('AundefinedC');
  });

  it('preserves undefined generated cells as literal text when updating cached DOM', () => {
    const pre = document.createElement('pre');
    const cache = { current: null };

    renderRowsToPreElement(pre, [['A', 'B', 'C']], 1, 3, new Map(), cache);
    renderRowsToPreElement(
      pre,
      [['A', undefined as unknown as string, 'C']],
      1,
      3,
      new Map(),
      cache
    );

    expect(pre.textContent).toBe('AundefinedC');
  });

  it('reuses the same DOM nodes between frames when the style map is unchanged', () => {
    const pre = document.createElement('pre');
    const cache = { current: null };
    const styles = new Map<number, string>([
      [1, '<a href="#/" data-link-url="#/" class="ascii-link">$</a>']
    ]);

    renderRowsToPreElement(pre, [['A', '&', 'C']], 1, 3, styles, cache);
    const firstChildNodes = [...pre.childNodes];
    const firstAnchor = pre.querySelector('a');
    expect(pre.textContent).toBe('A&C');
    expect(firstAnchor?.textContent).toBe('&');

    renderRowsToPreElement(pre, [['D', '<', 'F']], 1, 3, styles, cache);

    expect([...pre.childNodes]).toEqual(firstChildNodes);
    expect(pre.querySelector('a')).toBe(firstAnchor);
    expect(pre.textContent).toBe('D<F');
    expect(firstAnchor?.textContent).toBe('<');
  });

  it('rebuilds the frame DOM when styled positions change', () => {
    const pre = document.createElement('pre');
    const cache = { current: null };

    renderRowsToPreElement(pre, [['A', 'B']], 1, 2, new Map([
      [0, '<span style="font-weight:bold">$</span>']
    ]), cache);
    const firstChildNodes = [...pre.childNodes];

    renderRowsToPreElement(pre, [['A', 'B']], 1, 2, new Map([
      [1, '<span style="font-weight:bold">$</span>']
    ]), cache);

    expect([...pre.childNodes]).not.toEqual(firstChildNodes);
    expect(pre.textContent).toBe('AB');
  });

  it('keeps the styled DOM through a transient empty style map', () => {
    const pre = document.createElement('pre');
    const cache = { current: null };

    renderRowsToPreElement(pre, [['A', 'B', 'C']], 1, 3, new Map([
      [1, '<a href="#/about" data-link-url="#/about" class="ascii-link">$</a>']
    ]), cache);
    const firstChildNodes = [...pre.childNodes];
    const firstAnchor = pre.querySelector('a');

    renderRowsToPreElement(pre, [['D', 'B', 'F']], 1, 3, new Map(), cache);

    expect([...pre.childNodes]).toEqual(firstChildNodes);
    expect(pre.querySelector('a')).toBe(firstAnchor);
    expect(pre.textContent).toBe('DBF');
    expect(firstAnchor?.textContent).toBe('B');
  });

  it('keeps the styled DOM when a restarted writer has a fresh cache ref', () => {
    const pre = document.createElement('pre');
    const firstCache = { current: null };
    const restartedCache = { current: null };

    renderRowsToPreElement(pre, [['A', 'B', 'C']], 1, 3, new Map([
      [1, '<a href="#/about" data-link-url="#/about" class="ascii-link">$</a>']
    ]), firstCache);
    const firstChildNodes = [...pre.childNodes];
    const firstAnchor = pre.querySelector('a');

    renderRowsToPreElement(pre, [['D', 'B', 'F']], 1, 3, new Map(), restartedCache);

    expect([...pre.childNodes]).toEqual(firstChildNodes);
    expect(pre.querySelector('a')).toBe(firstAnchor);
    expect(pre.textContent).toBe('DBF');
    expect(firstAnchor?.textContent).toBe('B');
  });

  it('drops stale styled DOM when a transient empty style map no longer matches the same text', () => {
    const pre = document.createElement('pre');
    const cache = { current: null };

    renderRowsToPreElement(pre, [['A', 'B', 'C']], 1, 3, new Map([
      [1, '<a href="#/about" data-link-url="#/about" class="ascii-link">$</a>']
    ]), cache);

    renderRowsToPreElement(pre, [['D', 'E', 'F']], 1, 3, new Map(), cache);

    expect(pre.querySelector('a')).toBeNull();
    expect([...pre.childNodes]).toHaveLength(1);
    expect(pre.textContent).toBe('DEF');
  });

  it('does not keep stale styled nodes after a grid size change', () => {
    const pre = document.createElement('pre');
    const cache = { current: null };

    renderRowsToPreElement(pre, [['A', 'B']], 1, 2, new Map([
      [1, '<a href="#/about" data-link-url="#/about" class="ascii-link">$</a>']
    ]), cache);

    renderRowsToPreElement(pre, [['C', 'D', 'E']], 1, 3, new Map(), cache);

    expect(pre.querySelector('a')).toBeNull();
    expect([...pre.childNodes]).toHaveLength(1);
    expect(pre.textContent).toBe('CDE');
  });
});

describe('shouldCalculateExactFrameCell', () => {
  it('recalculates visible text cells instead of copying a skipped neighbor', () => {
    expect(shouldCalculateExactFrameCell(
      makeTextPositionCache(),
      new Map(),
      4,
      1,
      0,
      0
    )).toBe(true);
  });

  it('recalculates styled cells even when the text grid is empty', () => {
    expect(shouldCalculateExactFrameCell(
      { ...makeTextPositionCache(), grid: new Array(8).fill(null) },
      new Map([[2, '<a href="#/">$</a>']]),
      4,
      2,
      0,
      0
    )).toBe(true);
  });

  it('allows background cells to reuse a skipped neighbor when neither cell is text', () => {
    expect(shouldCalculateExactFrameCell(
      makeTextPositionCache(),
      new Map(),
      4,
      3,
      0,
      0
    )).toBe(false);
  });

  it('recalculates background cells after an exact text source so text is not smeared outward', () => {
    expect(shouldCalculateExactFrameCell(
      makeTextPositionCache(),
      new Map(),
      4,
      2,
      0,
      0,
      true
    )).toBe(true);
  });

  it('accounts for fixed text cells without applying scroll offset', () => {
    expect(shouldCalculateExactFrameCell(
      makeTextPositionCache(),
      new Map(),
      4,
      1,
      1,
      4
    )).toBe(true);
  });
});

describe('useAnimation lifecycle', () => {
  let container: HTMLDivElement;
  let root: ReactDOM.Root;
  let nextRafId: number;
  let rafCallbacks: Map<number, FrameRequestCallback>;

  const Harness = ({ marker }: { marker: string }) => {
    const preRef = useRef<HTMLPreElement>(null);
    const scrollOffsetRef = useRef(0);
    const isScrolling = useRef(false);
    const scrollVelocity = useRef(0);
    const linkPositionsRef = useRef<LinkPosition[]>([]);
    const textPositionCacheRef = useRef<TextPositionCacheResult>({
      cache: {},
      grid: [],
      bounds: {},
      links: [],
      gridCols: 0,
      offsetY: 0
    });
    const calculateCharacter = useCallback(() => marker, [marker]);

    useAnimation(
      preRef,
      { width: 78, height: 26 },
      calculateCharacter,
      scrollOffsetRef,
      textPositionCacheRef.current,
      isScrolling,
      scrollVelocity,
      linkPositionsRef
    );

    return React.createElement('pre', { ref: preRef });
  };

  const ScrollSnapshotHarness = ({ onScrollRead }: { onScrollRead: (scrollY: number) => void }) => {
    const preRef = useRef<HTMLPreElement>(null);
    const scrollOffsetRef = useRef(0);
    const isScrolling = useRef(false);
    const scrollVelocity = useRef(0);
    const linkPositionsRef = useRef<LinkPosition[]>([]);
    const textPositionCacheRef = useRef<TextPositionCacheResult>({
      cache: {},
      grid: [],
      bounds: {},
      links: [],
      gridCols: 0,
      offsetY: 0
    });
    const calculateCharacter = useCallback((
      _x: number,
      _y: number,
      _cols: number,
      _rows: number,
      _aspect: number,
      _time: number,
      scrollY: number
    ) => {
      onScrollRead(scrollY);
      scrollOffsetRef.current = 120;
      return 'S';
    }, [onScrollRead]);

    useAnimation(
      preRef,
      { width: 78, height: 26 },
      calculateCharacter,
      scrollOffsetRef,
      textPositionCacheRef.current,
      isScrolling,
      scrollVelocity,
      linkPositionsRef
    );

    return React.createElement('pre', { ref: preRef });
  };

  const LinkSnapshotHarness = () => {
    const preRef = useRef<HTMLPreElement>(null);
    const scrollOffsetRef = useRef(0);
    const isScrolling = useRef(false);
    const scrollVelocity = useRef(0);
    const linkPositionsRef = useRef<LinkPosition[]>([
      { textKey: 'about', url: '#/about', startX: 0, endX: 4, y: 0 }
    ]);
    const textPositionCacheRef = useRef<TextPositionCacheResult>({
      cache: {},
      grid: [
        { char: 'A', fixed: true },
        { char: 'B', fixed: true },
        { char: 'O', fixed: true },
        { char: 'U', fixed: true },
        { char: 'T', fixed: true },
        null,
        null,
        null,
        null,
        null
      ],
      bounds: {
        about: { minX: 0, maxX: 4, minY: 0, maxY: 0, fixed: true }
      },
      links: [
        { textKey: 'about', url: '#/about', startX: 0, endX: 4, y: 0 }
      ],
      gridCols: 10,
      offsetY: 0
    });
    const calculateCharacter = useCallback((x: number) => (
      ['A', 'B', 'O', 'U', 'T'][x] ?? 'x'
    ), []);

    useEffect(() => {
      linkPositionsRef.current = [
        { textKey: 'about', url: '#/about', startX: 5, endX: 9, y: 0 }
      ];
    }, []);

    useAnimation(
      preRef,
      { width: 78, height: 26 },
      calculateCharacter,
      scrollOffsetRef,
      textPositionCacheRef.current,
      isScrolling,
      scrollVelocity,
      linkPositionsRef
    );

    return React.createElement('pre', { ref: preRef });
  };

  const TextOverlayHarness = () => {
    const preRef = useRef<HTMLPreElement>(null);
    const scrollOffsetRef = useRef(0);
    const isScrolling = useRef(false);
    const scrollVelocity = useRef(0);
    const linkPositionsRef = useRef<LinkPosition[]>([
      { textKey: 'about', url: '#/about', startX: 0, endX: 4, y: 0 }
    ]);
    const textPositionCacheRef = useRef<TextPositionCacheResult>({
      cache: {
        about: [
          { startX: 0, endX: 0, y: 0, char: 'A', fixed: true },
          { startX: 1, endX: 1, y: 0, char: 'B', fixed: true },
          { startX: 2, endX: 2, y: 0, char: 'O', fixed: true },
          { startX: 3, endX: 3, y: 0, char: 'U', fixed: true },
          { startX: 4, endX: 4, y: 0, char: 'T', fixed: true }
        ]
      },
      grid: [
        { char: 'A', fixed: true },
        { char: 'B', fixed: true },
        { char: 'O', fixed: true },
        { char: 'U', fixed: true },
        { char: 'T', fixed: true }
      ],
      bounds: {
        about: { minX: 0, maxX: 4, minY: 0, maxY: 0, fixed: true }
      },
      links: [
        { textKey: 'about', url: '#/about', startX: 0, endX: 4, y: 0 }
      ],
      gridCols: 5,
      offsetY: 0
    });
    const calculateCharacter = useCallback(() => 'x', []);

    useAnimation(
      preRef,
      { width: 78, height: 26 },
      calculateCharacter,
      scrollOffsetRef,
      textPositionCacheRef.current,
      isScrolling,
      scrollVelocity,
      linkPositionsRef
    );

    return React.createElement('pre', { ref: preRef });
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = ReactDOM.createRoot(container);
    nextRafId = 0;
    rafCallbacks = new Map();

    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      nextRafId += 1;
      rafCallbacks.set(nextRafId, callback);
      return nextRafId;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => {
      rafCallbacks.delete(id);
    }));
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  it('ignores a stale animation callback after the effect restarts', async () => {
    await act(async () => {
      root.render(React.createElement(Harness, { marker: 'A' }));
    });

    const staleCallback = rafCallbacks.values().next().value;
    expect(staleCallback).toBeTypeOf('function');

    await act(async () => {
      root.render(React.createElement(Harness, { marker: 'B' }));
    });

    const currentCallback = Array.from(rafCallbacks.values()).at(-1);
    expect(currentCallback).toBeTypeOf('function');

    await act(async () => {
      currentCallback?.(1000);
    });
    expect(container.querySelector('pre')?.textContent?.startsWith('B')).toBe(true);

    await act(async () => {
      staleCallback?.(1040);
    });
    expect(container.querySelector('pre')?.textContent?.startsWith('B')).toBe(true);
  });

  it('uses one scroll offset snapshot for every character in a frame', async () => {
    const scrollReads: number[] = [];

    await act(async () => {
      root.render(React.createElement(ScrollSnapshotHarness, {
        onScrollRead: scrollY => scrollReads.push(scrollY)
      }));
    });

    const currentCallback = Array.from(rafCallbacks.values()).at(-1);
    expect(currentCallback).toBeTypeOf('function');

    await act(async () => {
      currentCallback?.(1000);
    });

    expect(scrollReads.length).toBeGreaterThan(1);
    expect(new Set(scrollReads)).toEqual(new Set([0]));
  });

  it('wraps links from the same text cache snapshot as the rendered text grid', async () => {
    await act(async () => {
      root.render(React.createElement(LinkSnapshotHarness));
    });

    const currentCallback = Array.from(rafCallbacks.values()).at(-1);
    expect(currentCallback).toBeTypeOf('function');

    await act(async () => {
      currentCallback?.(1000);
    });

    const anchorText = Array.from(container.querySelectorAll('pre a'))
      .map(anchor => anchor.textContent)
      .join('');

    expect(anchorText).toBe('ABOUT');
  });

  it('restores cached text characters when the frame calculator returns background glyphs for text cells', async () => {
    await act(async () => {
      root.render(React.createElement(TextOverlayHarness));
    });

    const currentCallback = Array.from(rafCallbacks.values()).at(-1);
    expect(currentCallback).toBeTypeOf('function');

    await act(async () => {
      currentCallback?.(1000);
    });

    const anchorText = Array.from(container.querySelectorAll('pre a'))
      .map(anchor => anchor.textContent)
      .join('');

    expect(anchorText).toBe('ABOUT');
  });
});
