import { useMemo } from 'react';
import { renderTextString } from '../ASCII_text_renderer';
import { getGridDimensions } from '../utils';
import { 
  TextPositionCacheResult, 
  Size, 
  LinkPosition, 
  TextPositionCache, 
  TextGridCell, 
  TextContentItem
} from '../types';
import { calculateTextBoundsAndLinks } from './useTextPositioning/calculateBounds';
import { populateTextGrid } from './useTextPositioning/populateGrid';

export const useTextPositioning = (
  textContent: Array<TextContentItem>,
  size: Size,
  setLinkPositions: React.Dispatch<React.SetStateAction<LinkPosition[]>>,
  linkPositionsRef: React.MutableRefObject<LinkPosition[]>
): TextPositionCacheResult => {
  // Build ASCII art cache
  const asciiArtCache = useMemo(() => {
    const newCache: Record<string, string[]> = {};
    
    textContent.forEach(item => {
      if (item.text) {
        const fontName = item.fontName || 'regular';
        if (fontName !== 'regular') {
          const asciiArt = renderTextString(item.text, fontName).split('\n');
          newCache[item.text] = asciiArt;
        }
      }
      if (item.preRenderedAscii) {
        const asciiArt = item.preRenderedAscii.split('\n');
        newCache[item.text] = asciiArt;
      }
    });
    
    return newCache;
  }, [textContent]);

  // Build the text position cache with link support
  const textPositionCache = useMemo(() => {
    // Return initial empty state matching the new type structure
    if (!size.width || !size.height) return { 
      cache: {}, 
      grid: [], 
      bounds: {}, 
      links: [], 
      gridCols: 0, 
      offsetY: 0 
    };
    
    const { cols, rows } = getGridDimensions(size.width, size.height);
    const cache: TextPositionCache = {};
    const textBounds: {[key: string]: {minX: number, maxX: number, minY: number, maxY: number, fixed: boolean}} = {};
    const links: LinkPosition[] = [];

    // First pass: Create a mapping of name to textItem index for anchoring
    const namedTextboxes: Record<string, number> = {};
    textContent.forEach((item, index) => {
      if (item.name) {
        namedTextboxes[item.name] = index;
      }
    });
    
    // Map to track positioned items for dependency resolution
    let positionedItems = new Set<number>();

    // --- STAGE 1: Calculate Bounds and Links (Call extracted function) --- 
    textContent.forEach((_, index) => {
      calculateTextBoundsAndLinks(index, textContent, namedTextboxes, positionedItems, cache, textBounds, links, cols, rows);
    });

    // --- STAGE 2: Determine Grid Dimensions --- 
    let globalMinY = Infinity;
    let globalMaxY = -Infinity;
    // Define grid width based on screen cols, allow horizontal overflow
    const gridCols = cols * 2; 

    for (const key in textBounds) {
      globalMinY = Math.min(globalMinY, textBounds[key].minY);
      globalMaxY = Math.max(globalMaxY, textBounds[key].maxY);
    }
    if (!isFinite(globalMinY) || !isFinite(globalMaxY)) {
      globalMinY = 0;
      globalMaxY = rows - 1;
    }
    globalMinY -= 10; // Padding
    globalMaxY += 10; // Padding

    const offsetY = globalMinY;
    const gridRows = globalMaxY - globalMinY + 1;

    // --- STAGE 3: Initialize and Populate Grid (Call extracted function) --- 
    // Use `(TextGridCell | null)[]` for the array type annotation
    const positionGridArray: (TextGridCell | null)[] = new Array(gridCols * gridRows).fill(null); 
    positionedItems = new Set<number>(); // Reset for Stage 3 processing

    textContent.forEach((_, index) => {
      populateTextGrid(index, textContent, namedTextboxes, positionedItems, textBounds, positionGridArray, cols, rows, gridCols, gridRows, offsetY);
    });

    // Update link positions ref (remains the same)
    linkPositionsRef.current = links;
    setLinkPositions(links);
    // console.log(`Found ${links.length} clickable links:`, links);

    // Return the final result from within useMemo
    return {
      cache,
      grid: positionGridArray,
      bounds: textBounds,
      links,
      gridCols,
      offsetY
    };
  }, [textContent, asciiArtCache, size, setLinkPositions, linkPositionsRef]);

  return textPositionCache;
}; 