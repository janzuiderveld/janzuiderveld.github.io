import { useEffect, useRef } from 'react';
import {
  FRAME_DURATION,
  BASE_CHUNK_SIZE,
  CHAR_HEIGHT,
  IS_SAFARI
} from '../constants';
import { Size, TextPositionCacheResult } from '../types';
import { getGridDimensions } from '../utils';
import { clearCharacterCache, CharacterPrecomputation } from '../renderer';

type CharacterCalculator = (
  x: number,
  y: number,
  cols: number,
  rows: number,
  aspect: number,
  time: number,
  precomputed: CharacterPrecomputation | null,
  frameSeed: number,
  frameNow: number
) => string;

export const useAnimation = (
  textRef: React.RefObject<HTMLPreElement>,
  size: Size,
  calculateCharacter: CharacterCalculator,
  scrollOffsetRef: React.MutableRefObject<number>,
  textPositionCache: TextPositionCacheResult,
  isScrolling: React.MutableRefObject<boolean>,
  scrollVelocity: React.MutableRefObject<number>,
  linkPositionsRef: React.MutableRefObject<any[]>,
  setLinkClicked?: React.Dispatch<React.SetStateAction<string | null>>
) => {
  const lastFrameTimeRef = useRef<number>(0);
  const frameSkipRef = useRef(0);
  const precomputedRef = useRef<CharacterPrecomputation | null>(null);

  useEffect(() => {
    const element = textRef.current;
    if (!element || !size.width || !size.height) {
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

    let { cols, rows } = getGridDimensions(size.width, size.height);

    if (IS_SAFARI) {
      const charHeightPx = CHAR_HEIGHT;
      const extraRows = Math.max(1, Math.ceil((size.height * 0.035) / charHeightPx));
      rows += extraRows;
    }

    const aspectRatio = size.width / size.height;
    const numChunks = Math.ceil(rows / BASE_CHUNK_SIZE);

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

    let animationFrameId: number;

    const animate = (timestamp: number) => {
      if (timestamp - lastFrameTimeRef.current >= FRAME_DURATION) {
        if (isScrolling.current) {
          frameSkipRef.current = (frameSkipRef.current + 1) % 3;
          if (frameSkipRef.current === 2) {
            animationFrameId = requestAnimationFrame(animate);
            return;
          }
        } else {
          frameSkipRef.current = 0;
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
          } else {
            skipFactor = 2;
            chunkSizeFactor = 1.5;
          }
        }

        const adjustedChunkSize = Math.ceil(BASE_CHUNK_SIZE * chunkSizeFactor);

        styleMap.clear();
        for (let y = 0; y < rows; y++) {
          rowBuffers[y].fill(' ');
        }

        const scrolledY = Math.floor(scrollOffsetRef.current / CHAR_HEIGHT);
        const precomputed = ensurePrecomputed();
        const frameSeed = timestamp | 0;
        const frameNow = Date.now();

        for (const link of linkPositionsRef.current) {
          const isFixed = textPositionCache.bounds[link.textKey]?.fixed || false;
          const linkY = isFixed ? link.y : link.y - scrolledY;
          if (linkY < 0 || linkY >= rows) {
            continue;
          }

          for (let x = link.startX; x <= link.endX; x++) {
            if (x < 0 || x >= cols) {
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
          const isFixed = textPositionCache.bounds[textKey]?.fixed || false;

          for (const pos of positions) {
            const x = pos.startX;
            const y = isFixed ? pos.y : pos.y - scrolledY;

            if (y < 0 || y >= rows || x < 0 || x >= cols) {
              continue;
            }

            const mapKey = y * cols + x;
            if (styleMap.has(mapKey) || !pos.char || pos.char === ' ') {
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
          const startRow = chunk * BASE_CHUNK_SIZE;
          const endRow = Math.min(startRow + adjustedChunkSize, rows);

          for (let y = startRow; y < endRow; y++) {
            for (let x = 0; x < cols; x += skipFactor) {
              const char = calculateCharacter(
                x,
                y,
                cols,
                rows,
                aspectRatio,
                timestamp,
                precomputed,
                frameSeed,
                frameNow
              );
              rowBuffers[y][x] = char;

              for (let i = 1; i < skipFactor && x + i < cols; i++) {
                rowBuffers[y][x + i] = char;
              }
            }
          }
        }

        const hasStyles = styleMap.size > 0;
        const lines = new Array(rows);

        if (!hasStyles) {
          for (let y = 0; y < rows; y++) {
            lines[y] = rowBuffers[y].join('');
          }
        } else {
          for (let y = 0; y < rows; y++) {
            const row = rowBuffers[y];
            let line = '';
            for (let x = 0; x < cols; x++) {
              const mapKey = y * cols + x;
              const styled = styleMap.get(mapKey);
              const char = row[x];
              line += styled ? styled.replace('$', char) : char;
            }
            lines[y] = line;
          }
        }

        element.innerHTML = lines.join('\n');
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
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
    setLinkClicked,
    textPositionCache.bounds
  ]);

  return undefined;
};
