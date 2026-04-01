import { describe, expect, it } from 'vitest';
import { calculateCharacter, clearCharacterCache } from './renderer';
import type { BlobGridCache, CursorState, TextPositionCacheResult } from './types';

const cursorRef = {
  current: {
    grid: { x: 0, y: 0 },
    normalized: { x: 0, y: 0 },
    isInWindow: false,
    isActive: false,
    clickRipples: [],
    whiteout: null,
    whiteIn: null,
    whiteOverlay: null
  } satisfies CursorState
};

const textPositionCache: TextPositionCacheResult = {
  cache: {},
  grid: [{
    char: 'A',
    fixed: true
  }],
  bounds: {},
  links: [],
  gridCols: 1,
  offsetY: 0
};

const emptyBlobCache: BlobGridCache = {
  fixed: {
    grid: [],
    startX: 0,
    startY: 0,
    width: 0,
    height: 0,
    cacheGridWidth: 0
  },
  scroll: {
    grid: [],
    startX: 0,
    startY: 0,
    width: 0,
    height: 0,
    cacheGridWidth: 0
  }
};

describe('calculateCharacter', () => {
  it('can suppress visible text characters while preserving the ascii background field', () => {
    const normalCharacter = calculateCharacter(
      0,
      0,
      1,
      1,
      1,
      0,
      textPositionCache,
      emptyBlobCache,
      cursorRef,
      0,
      Math.sin,
      Math.cos
    );
    clearCharacterCache();
    const suppressedCharacter = calculateCharacter(
      0,
      0,
      1,
      1,
      1,
      0,
      textPositionCache,
      emptyBlobCache,
      cursorRef,
      0,
      Math.sin,
      Math.cos,
      null,
      undefined,
      undefined,
      true
    );

    expect(normalCharacter).toBe('A');
    expect(suppressedCharacter).not.toBe('A');
  });
});
