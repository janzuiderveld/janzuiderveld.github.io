import { useEffect, useRef } from 'react';
import {
  FRAME_DURATION,
  BASE_CHUNK_SIZE,
  CHAR_HEIGHT,
  IS_SAFARI
} from '../constants';
import { LinkPosition, Size, TextPositionCacheResult } from '../types';
import { getGridDimensions } from '../utils';
import { clearCharacterCache, CharacterPrecomputation } from '../renderer';

type CharacterCalculator = (
  x: number,
  y: number,
  cols: number,
  rows: number,
  aspect: number,
  time: number,
  scrollY: number,
  precomputed: CharacterPrecomputation | null,
  frameSeed: number,
  frameNow: number
) => string;

type VisibleTextCell = {
  x: number;
  y: number;
  char: string;
};

const HTML_ESCAPE_PATTERN = /[&<>]/g;
const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;'
};

const escapeHtmlText = (value: string) => (
  value.replace(HTML_ESCAPE_PATTERN, char => HTML_ESCAPE_MAP[char])
);

const escapeHtmlCharacter = (value: string) => {
  if (value === '&') return '&amp;';
  if (value === '<') return '&lt;';
  if (value === '>') return '&gt;';
  return value;
};

const stringifyFrameCell = (value: unknown) => String(value);

const stringifyFrameCells = (row: unknown[], start: number = 0, end: number = row.length) => {
  let value = '';
  for (let index = start; index < end; index++) {
    value += stringifyFrameCell(row[index]);
  }
  return value;
};

type FrameDomTextSegment = {
  type: 'text';
  node: Text;
  row: number;
  start: number;
  end: number;
  suffix: string;
};

type FrameDomStyledSegment = {
  type: 'styled';
  node: Node;
  row: number;
  col: number;
};

type FrameDomFullTextSegment = {
  type: 'fullText';
  node: Text;
};

type FrameDomSegment = FrameDomTextSegment | FrameDomStyledSegment | FrameDomFullTextSegment;

export type FrameDomCache = {
  signature: string;
  rows: number;
  cols: number;
  hasStyles: boolean;
  segments: FrameDomSegment[];
};

export type FrameDomCacheRef = {
  current: FrameDomCache | null;
};

const frameDomElementCache = new WeakMap<HTMLPreElement, FrameDomCache>();
const frameWriterTokenByElement = new WeakMap<HTMLPreElement, number>();
let nextFrameWriterToken = 0;

const rowsToPlainText = (rowBuffers: string[][], rows: number) => {
  const lines = new Array(rows);
  for (let y = 0; y < rows; y++) {
    lines[y] = stringifyFrameCells(rowBuffers[y]);
  }
  return lines.join('\n');
};

const getVisibleTextCell = (
  textPositionCache: TextPositionCacheResult,
  x: number,
  y: number,
  scrolledY: number
) => {
  const { grid, gridCols, offsetY } = textPositionCache;
  const fixedY = y - offsetY;
  const fixedIndex = fixedY * gridCols + x;
  const fixedCell = x >= 0 &&
    x < gridCols &&
    fixedY >= 0 &&
    fixedIndex >= 0 &&
    fixedIndex < grid.length
      ? grid[fixedIndex]
      : null;

  if (fixedCell?.fixed) {
    return fixedCell;
  }

  const scrolledGridY = y + scrolledY - offsetY;
  const scrolledIndex = scrolledGridY * gridCols + x;
  const scrolledCell = x >= 0 &&
    x < gridCols &&
    scrolledGridY >= 0 &&
    scrolledIndex >= 0 &&
    scrolledIndex < grid.length
      ? grid[scrolledIndex]
      : null;

  return scrolledCell && !scrolledCell.fixed ? scrolledCell : null;
};

export const shouldCalculateExactFrameCell = (
  textPositionCache: TextPositionCacheResult,
  styleMap: Map<number, string>,
  cols: number,
  x: number,
  y: number,
  scrolledY: number,
  sourceRequiresExact: boolean = false
) => (
  sourceRequiresExact ||
  styleMap.has(y * cols + x) ||
  Boolean(getVisibleTextCell(textPositionCache, x, y, scrolledY))
);

export const renderRowsToHtml = (
  rowBuffers: string[][],
  rows: number,
  cols: number,
  styleMap: Map<number, string>
) => {
  const hasStyles = styleMap.size > 0;
  const lines = new Array(rows);

  if (!hasStyles) {
    for (let y = 0; y < rows; y++) {
      lines[y] = escapeHtmlText(stringifyFrameCells(rowBuffers[y]));
    }
  } else {
    for (let y = 0; y < rows; y++) {
      const row = rowBuffers[y];
      let line = '';
      for (let x = 0; x < cols; x++) {
        const mapKey = y * cols + x;
        const styled = styleMap.get(mapKey);
        const char = escapeHtmlCharacter(stringifyFrameCell(row[x]));
        line += styled ? styled.replace('$', char) : char;
      }
      lines[y] = line;
    }
  }

  return lines.join('\n');
};

const getFrameDomSignature = (
  rows: number,
  cols: number,
  styleMap: Map<number, string>
) => {
  if (styleMap.size === 0) {
    return `${rows}x${cols}|text`;
  }

  return `${rows}x${cols}|${Array.from(styleMap.entries())
    .sort(([left], [right]) => left - right)
    .map(([key, template]) => `${key}:${template}`)
    .join('|')}`;
};

const createStyledNode = (template: string, char: string): Node => {
  const wrapper = document.createElement('template');
  wrapper.innerHTML = template.replace('$', '');
  const node = wrapper.content.firstChild;

  if (!node) {
    return document.createTextNode(char);
  }

  node.textContent = char;
  return node;
};

const updateFrameDomSegments = (
  rowBuffers: string[][],
  rows: number,
  cache: FrameDomCache
) => {
  for (const segment of cache.segments) {
    if (segment.type === 'fullText') {
      segment.node.nodeValue = rowsToPlainText(rowBuffers, rows);
      continue;
    }

    if (segment.type === 'text') {
      segment.node.nodeValue = `${stringifyFrameCells(
        rowBuffers[segment.row],
        segment.start,
        segment.end
      )}${segment.suffix}`;
      continue;
    }

    segment.node.textContent = stringifyFrameCell(rowBuffers[segment.row][segment.col]);
  }
};

const isFrameDomCacheAttached = (
  element: HTMLPreElement,
  cache: FrameDomCache
) => (
  cache.segments.every(segment => segment.node.parentNode === element)
);

const attachFrameDomCache = (
  element: HTMLPreElement,
  cache: FrameDomCache
) => {
  const fragment = document.createDocumentFragment();
  for (const segment of cache.segments) {
    fragment.appendChild(segment.node);
  }
  element.replaceChildren(fragment);
};

const styledFallbackStillMatchesFrame = (
  rowBuffers: string[][],
  cache: FrameDomCache
) => (
  cache.segments.every(segment => (
    segment.type !== 'styled' ||
    stringifyFrameCell(rowBuffers[segment.row]?.[segment.col]) === segment.node.textContent
  ))
);

const buildFrameDomCache = (
  element: HTMLPreElement,
  rowBuffers: string[][],
  rows: number,
  cols: number,
  styleMap: Map<number, string>,
  signature: string
): FrameDomCache => {
  const fragment = document.createDocumentFragment();
  const segments: FrameDomSegment[] = [];

  if (styleMap.size === 0) {
    const node = document.createTextNode(rowsToPlainText(rowBuffers, rows));
    fragment.appendChild(node);
    segments.push({ type: 'fullText', node });
    element.replaceChildren(fragment);
    return { signature, rows, cols, hasStyles: false, segments };
  }

  const stylesByRow = new Map<number, Array<{ col: number; template: string }>>();
  Array.from(styleMap.entries())
    .sort(([left], [right]) => left - right)
    .forEach(([key, template]) => {
      const row = Math.floor(key / cols);
      const col = key % cols;
      if (row < 0 || row >= rows || col < 0 || col >= cols) {
        return;
      }

      const rowStyles = stylesByRow.get(row) ?? [];
      rowStyles.push({ col, template });
      stylesByRow.set(row, rowStyles);
    });

  const appendTextSegment = (row: number, start: number, end: number, suffix: string) => {
    if (start === end && !suffix) {
      return;
    }

    const node = document.createTextNode(`${stringifyFrameCells(rowBuffers[row], start, end)}${suffix}`);
    fragment.appendChild(node);
    segments.push({
      type: 'text',
      node,
      row,
      start,
      end,
      suffix
    });
  };

  for (let row = 0; row < rows; row++) {
    const rowStyles = stylesByRow.get(row) ?? [];
    let cursor = 0;

    for (const { col, template } of rowStyles) {
      appendTextSegment(row, cursor, col, '');

      const node = createStyledNode(template, stringifyFrameCell(rowBuffers[row][col]));
      fragment.appendChild(node);
      segments.push({
        type: 'styled',
        node,
        row,
        col
      });

      cursor = col + 1;
    }

    appendTextSegment(row, cursor, cols, row === rows - 1 ? '' : '\n');
  }

  element.replaceChildren(fragment);
  return { signature, rows, cols, hasStyles: true, segments };
};

export const renderRowsToPreElement = (
  element: HTMLPreElement,
  rowBuffers: string[][],
  rows: number,
  cols: number,
  styleMap: Map<number, string>,
  cacheRef: FrameDomCacheRef
) => {
  const signature = getFrameDomSignature(rows, cols, styleMap);
  const elementCache = frameDomElementCache.get(element) ?? null;
  const current = cacheRef.current ?? elementCache;
  const styledFallback = styleMap.size === 0 &&
    elementCache?.hasStyles &&
    elementCache.rows === rows &&
    elementCache.cols === cols
      ? elementCache
      : styleMap.size === 0 &&
        current?.hasStyles &&
        current.rows === rows &&
        current.cols === cols
          ? current
          : null;

  if (styledFallback && styledFallbackStillMatchesFrame(rowBuffers, styledFallback)) {
    updateFrameDomSegments(rowBuffers, rows, styledFallback);
    if (!isFrameDomCacheAttached(element, styledFallback)) {
      attachFrameDomCache(element, styledFallback);
    }
    cacheRef.current = styledFallback;
    frameDomElementCache.set(element, styledFallback);
    return;
  }

  if (!current || current.signature !== signature) {
    const nextCache = buildFrameDomCache(element, rowBuffers, rows, cols, styleMap, signature);
    cacheRef.current = nextCache;
    frameDomElementCache.set(element, nextCache);
    return;
  }

  updateFrameDomSegments(rowBuffers, rows, current);
  if (!isFrameDomCacheAttached(element, current)) {
    attachFrameDomCache(element, current);
  }
  cacheRef.current = current;
  frameDomElementCache.set(element, current);
};

export const useAnimation = (
  textRef: React.RefObject<HTMLPreElement>,
  size: Size,
  calculateCharacter: CharacterCalculator,
  scrollOffsetRef: React.MutableRefObject<number>,
  textPositionCache: TextPositionCacheResult,
  isScrolling: React.MutableRefObject<boolean>,
  scrollVelocity: React.MutableRefObject<number>,
  linkPositionsRef: React.MutableRefObject<LinkPosition[]>,
  isPaused: boolean = false,
  setLinkClicked?: React.Dispatch<React.SetStateAction<string | null>>,
  shouldOverlayTextCharacters: () => boolean = () => true
) => {
  const lastFrameTimeRef = useRef<number>(0);
  const frameSkipRef = useRef(0);
  const precomputedRef = useRef<CharacterPrecomputation | null>(null);
  const safariLastTickRef = useRef(0);
  const safariFrameAccumulatorRef = useRef(0);
  const SAFARI_FRAME_INTERVAL = 1000 / 60;
  const lastActiveRowsRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const lastActiveColsRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const frameDomCacheRef = useRef<FrameDomCache | null>(null);

  useEffect(() => {
    const element = textRef.current;
    if (!element || !size.width || !size.height || isPaused) {
      return;
    }

    const style = document.createElement('style');
    style.textContent = `
        .ascii-link:hover {
            background-color: rgba(52, 152, 219, 0.2) !important;
            color: #ffffff !important;
            text-decoration: underline !important;
        }
        
        .ascii-link, a {
            pointer-events: auto !important;
            cursor: pointer !important;
        }
        
        pre a {
            pointer-events: auto !important;
            z-index: 1000 !important;
            position: relative !important;
        }
    `;
    document.head.appendChild(style);
    nextFrameWriterToken += 1;
    const writerToken = nextFrameWriterToken;
    frameWriterTokenByElement.set(element, writerToken);

    const isCurrentWriter = () => (
      animationActive && frameWriterTokenByElement.get(element) === writerToken
    );

    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const linkElement = target.closest('a');
      if (linkElement && linkElement.getAttribute('href')) {
        const url = linkElement.getAttribute('href') || '';
        if (setLinkClicked) {
          setLinkClicked(url);
        }
      }
    };

    element.addEventListener('click', handleLinkClick);

    const { cols, rows: baseRows } = getGridDimensions(size.width, size.height);
    let rows = baseRows;

    if (IS_SAFARI) {
      const charHeightPx = CHAR_HEIGHT;
      const extraRows = Math.max(1, Math.ceil((size.height * 0.035) / charHeightPx));
      rows += extraRows;
    }

    const aspectRatio = size.width / size.height;

    const rowBuffers: string[][] = new Array(rows)
      .fill(null)
      .map(() => new Array(cols).fill(' '));

    const styleMap: Map<number, string> = new Map();

    const ensurePrecomputed = (): CharacterPrecomputation => {
      const aspect = aspectRatio;
      const current = precomputedRef.current;
      if (current && current.cols === cols && current.rows === rows && current.aspect === aspect) {
        return current;
      }

      const safeCols = Math.max(cols, 1);
      const safeRows = Math.max(rows, 1);
      const sizeVal = Math.max(1, Math.min(safeCols, safeRows));
      const aspectWave = aspect * 0.2;

      const normX = new Float32Array(safeCols);
      const normY = new Float32Array(safeRows);
      const posX = new Float32Array(safeCols);
      const posY = new Float32Array(safeRows);
      const posXScaled = new Float32Array(safeCols);
      const posYScaled = new Float32Array(safeRows);
      const posXWave2 = new Float32Array(safeCols);
      const posXSquared = new Float32Array(safeCols);
      const posYSquared = new Float32Array(safeRows);

      const normXScale = 2 / safeCols;
      const normYScale = 2 / safeRows;
      const posXScale = (4 / sizeVal) * aspectWave;
      const posYScale = 5 / sizeVal;
      const posXOffset = cols / 6.25;
      const posYOffset = rows / 4;

      for (let x = 0; x < safeCols; x++) {
        const normalizedX = x * normXScale - 1;
        const basePosX = (x - posXOffset) * posXScale;
        normX[x] = normalizedX;
        posX[x] = basePosX;
        posXScaled[x] = basePosX * 1.5;
        posXWave2[x] = basePosX * 0.8;
        posXSquared[x] = basePosX * basePosX;
      }

      for (let y = 0; y < safeRows; y++) {
        const normalizedY = y * normYScale - 1;
        const basePosY = (y - posYOffset) * posYScale;
        normY[y] = normalizedY;
        posY[y] = basePosY;
        posYScaled[y] = basePosY * 1.5;
        posYSquared[y] = basePosY * basePosY;
      }

      const precomputed: CharacterPrecomputation = {
        cols,
        rows,
        aspect,
        normX,
        normY,
        posX,
        posY,
        sizeVal,
        aspectWave,
        posXScaled,
        posYScaled,
        posXWave2,
        posXSquared,
        posYSquared
      };

      precomputedRef.current = precomputed;
      return precomputed;
    };

    let animationFrameId = 0;
    let animationActive = true;
    const scheduleNextFrame = () => {
      if (!isCurrentWriter()) {
        return;
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    const animate = (timestamp: number) => {
      if (!isCurrentWriter()) {
        return;
      }

      if (IS_SAFARI) {
        if (safariLastTickRef.current === 0) {
          safariLastTickRef.current = timestamp;
        }

        const elapsedSinceSafariTick = timestamp - safariLastTickRef.current;
        safariLastTickRef.current = timestamp;
        safariFrameAccumulatorRef.current = Math.min(
          safariFrameAccumulatorRef.current + Math.max(0, elapsedSinceSafariTick),
          SAFARI_FRAME_INTERVAL * 2
        );

        if (safariFrameAccumulatorRef.current < SAFARI_FRAME_INTERVAL) {
          scheduleNextFrame();
          return;
        }

        safariFrameAccumulatorRef.current -= SAFARI_FRAME_INTERVAL;
      }

      const frameDue = IS_SAFARI || timestamp - lastFrameTimeRef.current >= FRAME_DURATION;

      if (frameDue) {
        if (isScrolling.current && !IS_SAFARI) {
          frameSkipRef.current = (frameSkipRef.current + 1) % 3;
          if (frameSkipRef.current === 2) {
            scheduleNextFrame();
            return;
          }
        } else {
          frameSkipRef.current = 0;
        }

        // Skip heavy work when the tab is hidden, but keep timestamps fresh
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          lastFrameTimeRef.current = timestamp;
          scheduleNextFrame();
          return;
        }

        lastFrameTimeRef.current = timestamp;
        clearCharacterCache();

        let skipFactor = 1;
        let chunkSizeFactor = 1;
        const velocity = Math.abs(scrollVelocity.current);
        if (isScrolling.current && velocity > 5) {
          if (velocity > 40) {
            skipFactor = 3;
            chunkSizeFactor = 3;
          } else if (velocity > 20) {
            skipFactor = 2;
            chunkSizeFactor = 2;
          } else if (IS_SAFARI) {
            skipFactor = 2;
            chunkSizeFactor = 1.5;
          }
        }

        const adjustedChunkSize = Math.ceil(BASE_CHUNK_SIZE * chunkSizeFactor);

        styleMap.clear();

        const scrollOffsetSnapshot = scrollOffsetRef.current;
        const scrolledY = Math.floor(scrollOffsetSnapshot / CHAR_HEIGHT);

        let activeRowStart = 0;
        let activeRowEnd = rows;
        const activeColStart = 0;
        const activeColEnd = cols;
        let boundsMinY = Number.POSITIVE_INFINITY;
        let boundsMaxY = Number.NEGATIVE_INFINITY;
        const offsetY = textPositionCache.offsetY;

        // Helper to slice sorted position arrays to only the visible Y-range
        const findVisibleSlice = (
          positions: Array<{ y: number }>,
          isFixed: boolean
        ): [number, number] => {
          if (!positions.length) {
            return [0, 0];
          }

          // Positions are pushed in y-order during text positioning; fall back if unsorted
          const maybeUnsorted = positions.length > 1 && positions[0].y > positions[positions.length - 1].y;
          if (maybeUnsorted) {
            return [0, positions.length];
          }

          const visibleStart = (isFixed ? 0 : scrolledY) + activeRowStart;
          const visibleEnd = (isFixed ? 0 : scrolledY) + activeRowEnd - 1;

          let low = 0;
          let high = positions.length;
          while (low < high) {
            const mid = (low + high) >> 1;
            if (positions[mid].y < visibleStart) {
              low = mid + 1;
            } else {
              high = mid;
            }
          }
          const startIndex = low;

          low = startIndex;
          high = positions.length;
          while (low < high) {
            const mid = (low + high) >> 1;
            if (positions[mid].y <= visibleEnd) {
              low = mid + 1;
            } else {
              high = mid;
            }
          }
          return [startIndex, low];
        };

        for (const key in textPositionCache.bounds) {
          const bounds = textPositionCache.bounds[key];
          if (!bounds) continue;

          const localMinY = bounds.minY - offsetY;
          const localMaxY = bounds.maxY - offsetY;

          if (bounds.fixed) {
            boundsMinY = Math.min(boundsMinY, localMinY);
            boundsMaxY = Math.max(boundsMaxY, localMaxY);
          } else {
            boundsMinY = Math.min(boundsMinY, localMinY - scrolledY);
            boundsMaxY = Math.max(boundsMaxY, localMaxY - scrolledY);
          }
        }

        const verticalPadding = IS_SAFARI ? 48 : 32;

        if (boundsMinY !== Number.POSITIVE_INFINITY && boundsMaxY !== Number.NEGATIVE_INFINITY) {
          activeRowStart = Math.max(0, Math.floor(boundsMinY) - verticalPadding);
          activeRowEnd = Math.min(rows, Math.ceil(boundsMaxY) + verticalPadding);
        }

        if (activeRowStart >= activeRowEnd) {
          activeRowStart = 0;
          activeRowEnd = rows;
        }

        // If content is shorter than the viewport, render the full height to avoid bottom gaps
        if (activeRowEnd - activeRowStart < rows) {
          activeRowStart = 0;
          activeRowEnd = rows;
        }

        const activeRowCount = Math.max(1, activeRowEnd - activeRowStart);
        const numChunks = Math.ceil(activeRowCount / BASE_CHUNK_SIZE);
        const activeRowsChanged = activeRowStart !== lastActiveRowsRef.current.start || activeRowEnd !== lastActiveRowsRef.current.end;
        const activeColsChanged = activeColStart !== lastActiveColsRef.current.start || activeColEnd !== lastActiveColsRef.current.end;
        const needsFullRowReset = activeRowsChanged || activeColsChanged;

        if (needsFullRowReset) {
          const prevRows = lastActiveRowsRef.current;
          // Clear rows that are leaving the active window
          for (let y = Math.max(0, prevRows.start); y < Math.min(rows, prevRows.end); y++) {
            if (y < activeRowStart || y >= activeRowEnd) {
              rowBuffers[y].fill(' ');
            }
          }
          // Clear the current active window (only the active columns unless the width changed)
          for (let y = activeRowStart; y < activeRowEnd; y++) {
            rowBuffers[y].fill(' ');
          }
          lastActiveRowsRef.current = { start: activeRowStart, end: activeRowEnd };
          lastActiveColsRef.current = { start: activeColStart, end: activeColEnd };
        } else {
          for (let y = activeRowStart; y < activeRowEnd; y++) {
            rowBuffers[y].fill(' ', activeColStart, activeColEnd);
          }
        }

        const precomputed = ensurePrecomputed();
        const frameSeed = timestamp | 0;
        const frameNow = Date.now();
        const visibleTextCells: VisibleTextCell[] = [];

        for (const link of textPositionCache.links) {
          const isFixed = textPositionCache.bounds[link.textKey]?.fixed || false;
          const linkY = isFixed ? link.y : link.y - scrolledY;
          if (linkY < 0 || linkY >= rows) {
            continue;
          }

          for (let x = link.startX; x <= link.endX; x++) {
            if (x < 0 || x >= cols || x < activeColStart || x >= activeColEnd) {
              continue;
            }
            const mapKey = linkY * cols + x;
            styleMap.set(
              mapKey,
              `<a href="${link.url}" style="color:rgb(63, 52, 219); text-decoration: underline; cursor: pointer;" data-link-url="${link.url}" class="ascii-link" target="_blank" onclick="window.open('${link.url}', '_blank')">$</a>`
            );
          }
        }

        for (const textKey in textPositionCache.cache) {
          const positions = textPositionCache.cache[textKey];
          if (!positions.length) {
            continue;
          }

          const isFixed = textPositionCache.bounds[textKey]?.fixed || false;
          const [startIndex, endIndex] = findVisibleSlice(positions, isFixed);
          if (startIndex === endIndex) {
            continue;
          }

          for (let i = startIndex; i < endIndex; i++) {
            const pos = positions[i];
            const x = pos.startX;
            const y = isFixed ? pos.y : pos.y - scrolledY;

            if (y < activeRowStart || y >= activeRowEnd || x < 0 || x >= cols || x < activeColStart || x >= activeColEnd) {
              continue;
            }

            const mapKey = y * cols + x;
            if (!pos.char || pos.char === ' ') {
              continue;
            }

            visibleTextCells.push({ x, y, char: pos.char });

            if (styleMap.has(mapKey)) {
              continue;
            }

            const originalY = pos.y;
            const arrayIndex = (originalY - textPositionCache.offsetY) * textPositionCache.gridCols + x;
            const cell =
              x >= 0 &&
              x < textPositionCache.gridCols &&
              originalY >= textPositionCache.offsetY &&
              arrayIndex >= 0 &&
              arrayIndex < textPositionCache.grid.length
                ? textPositionCache.grid[arrayIndex]
                : null;

            if (!cell) {
              continue;
            }

            if (cell.isBold && cell.isItalic) {
              styleMap.set(mapKey, '<span style="font-weight:bold; font-style:italic; text-shadow: 0px 0px 1px #000;">$</span>');
            } else if (cell.isBold) {
              styleMap.set(mapKey, '<span style="font-weight:bold; text-shadow: 0px 0px 1px #000;">$</span>');
            } else if (cell.isItalic) {
              styleMap.set(mapKey, '<span style="font-style:italic;">$</span>');
            }
          }
        }

        for (let chunk = 0; chunk < numChunks; chunk++) {
          const chunkRowStart = activeRowStart + chunk * BASE_CHUNK_SIZE;
          if (chunkRowStart >= activeRowEnd) {
            break;
          }
          const chunkRowEnd = Math.min(chunkRowStart + adjustedChunkSize, activeRowEnd);

          for (let y = chunkRowStart; y < chunkRowEnd; y++) {
            for (let x = activeColStart; x < activeColEnd; x += skipFactor) {
              const sourceRequiresExact = shouldCalculateExactFrameCell(
                textPositionCache,
                styleMap,
                cols,
                x,
                y,
                scrolledY
              );
              const char = calculateCharacter(
                x,
                y,
                cols,
                rows,
                aspectRatio,
                timestamp,
                scrollOffsetSnapshot,
                precomputed,
                frameSeed,
                frameNow
              );
              rowBuffers[y][x] = char;

              for (let i = 1; i < skipFactor && x + i < cols; i++) {
                const targetX = x + i;
                if (shouldCalculateExactFrameCell(
                  textPositionCache,
                  styleMap,
                  cols,
                  targetX,
                  y,
                  scrolledY,
                  sourceRequiresExact
                )) {
                  rowBuffers[y][targetX] = calculateCharacter(
                    targetX,
                    y,
                    cols,
                    rows,
                    aspectRatio,
                    timestamp,
                    scrollOffsetSnapshot,
                    precomputed,
                    frameSeed,
                    frameNow
                  );
                } else {
                  rowBuffers[y][targetX] = char;
                }
              }
            }
          }
        }

        if (shouldOverlayTextCharacters()) {
          for (const cell of visibleTextCells) {
            rowBuffers[cell.y][cell.x] = cell.char;
          }
        }

        renderRowsToPreElement(element, rowBuffers, rows, cols, styleMap, frameDomCacheRef);
      }

      scheduleNextFrame();
    };

    scheduleNextFrame();

    return () => {
      animationActive = false;
      cancelAnimationFrame(animationFrameId);
      if (frameWriterTokenByElement.get(element) === writerToken) {
        frameWriterTokenByElement.delete(element);
      }
      frameDomCacheRef.current = null;
      safariLastTickRef.current = 0;
      safariFrameAccumulatorRef.current = 0;
      element.removeEventListener('click', handleLinkClick);
      document.head.removeChild(style);
    };
  }, [
    textRef,
    size.width,
    size.height,
    calculateCharacter,
    scrollOffsetRef,
    isScrolling,
    scrollVelocity,
    linkPositionsRef,
    isPaused,
    setLinkClicked,
    shouldOverlayTextCharacters,
    textPositionCache.bounds,
    textPositionCache.links
  ]);

  return undefined;
};
