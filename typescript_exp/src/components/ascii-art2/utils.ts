import { CHAR_WIDTH, CHAR_HEIGHT } from './constants';
import { GridDimensions } from './types';

export type GraphemeCell = {
  cell: string;
  start: number;
  end: number;
};

/**
 * Calculate grid dimensions based on pixel size
 * @param width - Width in pixels
 * @param height - Height in pixels
 * @returns Grid dimensions object with columns and rows
 */
export const getGridDimensions = (width: number, height: number): GridDimensions => {
  const cols = Math.floor(width / CHAR_WIDTH);
  const rows = Math.ceil(height / CHAR_HEIGHT);
  return { cols, rows };
};

type SegmenterLike = {
  segment: (input: string) => Iterable<{ segment: string; index: number }>;
};

let graphemeSegmenter: SegmenterLike | null = null;

const getGraphemeSegmenter = (): SegmenterLike | null => {
  if (graphemeSegmenter !== null) {
    return graphemeSegmenter;
  }

  if (typeof Intl === 'undefined') {
    graphemeSegmenter = null;
    return graphemeSegmenter;
  }

  const SegmenterCtor = (Intl as unknown as { Segmenter?: new (...args: any[]) => SegmenterLike }).Segmenter;
  if (!SegmenterCtor) {
    graphemeSegmenter = null;
    return graphemeSegmenter;
  }

  graphemeSegmenter = new SegmenterCtor(undefined, { granularity: 'grapheme' });
  return graphemeSegmenter;
};

export const segmentGraphemeCells = (input: string): GraphemeCell[] => {
  if (!input) {
    return [];
  }

  const segmenter = getGraphemeSegmenter();
  if (segmenter) {
    const segments = Array.from(segmenter.segment(input)) as Array<{ segment: string; index: number }>;
    return segments.map((segment, index) => ({
      cell: segment.segment,
      start: segment.index,
      end: index + 1 < segments.length ? segments[index + 1].index : input.length,
    }));
  }

  const cells: GraphemeCell[] = [];
  const markRegex = /\p{M}/u;
  let currentCell = '';
  let currentStart = 0;
  let cursor = 0;

  while (cursor < input.length) {
    const codePoint = input.codePointAt(cursor);
    if (codePoint === undefined) {
      break;
    }
    const char = String.fromCodePoint(codePoint);
    const charLength = codePoint > 0xffff ? 2 : 1;
    const isMark = markRegex.test(char);

    if (isMark && currentCell) {
      currentCell += char;
      cursor += charLength;
      continue;
    }

    if (currentCell) {
      cells.push({ cell: currentCell, start: currentStart, end: cursor });
    }

    currentCell = char;
    currentStart = cursor;
    cursor += charLength;
  }

  if (currentCell) {
    cells.push({ cell: currentCell, start: currentStart, end: input.length });
  }

  return cells;
};

export const countGraphemeCells = (input: string): number => segmentGraphemeCells(input).length;

export const truncateToCellCount = (input: string, maxCells: number): string => {
  if (maxCells <= 0 || !input) {
    return '';
  }

  const cells = segmentGraphemeCells(input);
  if (cells.length <= maxCells) {
    return input;
  }

  return input.slice(0, cells[maxCells].start);
};

/**
 * Create a lookup table for sine values from 0-359 degrees
 * @returns Array of sine values
 */
export const createSinTable = (): number[] => {
  const table = new Array(360);
  for (let i = 0; i < 360; i++) {
    table[i] = Math.sin((i * Math.PI) / 180);
  }
  return table;
};

/**
 * Create a lookup table for cosine values from 0-359 degrees
 * @returns Array of cosine values
 */
export const createCosTable = (): number[] => {
  const table = new Array(360);
  for (let i = 0; i < 360; i++) {
    table[i] = Math.cos((i * Math.PI) / 180);
  }
  return table;
};

/**
 * Create a fast sine function using a lookup table
 * @param sinTable - Precomputed sine table
 * @returns Fast sine function
 */
export const createFastSin = (sinTable: number[]) => {
  return (angle: number): number => {
    const index = Math.floor(((angle % (2 * Math.PI)) / (2 * Math.PI)) * 360) % 360;
    return sinTable[index >= 0 ? index : index + 360];
  };
};

/**
 * Create a fast cosine function using a lookup table
 * @param cosTable - Precomputed cosine table
 * @returns Fast cosine function
 */
export const createFastCos = (cosTable: number[]) => {
  return (angle: number): number => {
    const index = Math.floor(((angle % (2 * Math.PI)) / (2 * Math.PI)) * 360) % 360;
    return cosTable[index >= 0 ? index : index + 360];
  };
}; 
