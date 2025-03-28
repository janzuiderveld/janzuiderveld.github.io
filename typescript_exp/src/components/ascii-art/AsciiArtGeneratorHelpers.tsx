import { useCallback, useMemo, MutableRefObject } from 'react';
import { renderFormattedText, renderTextString } from './ASCII_text_renderer';
import {
  LinkPosition,
  TextPositionCache,
  CHAR_HEIGHT,
  BLOB_RADIUS,
  BLOB_PADDING,
  BLOB_CACHE_GRID_SIZE,
  GRID_CELL_SIZE,
  getGridDimensions,
  createSinTable,
  createCosTable,
} from './asciiArtUtils';

// Build ASCII art cache
export const useAsciiArtCache = (textContent: any[]) => {
  return useMemo(() => {
    const newCache: Record<string, string[]> = {};
    
    textContent.forEach(item => {
      if (item.text) {
        const fontName = item.fontName || 'regular';
        if (fontName !== 'regular') {
          // Calculate max width if maxWidthPercent is specified
          let maxWidth: number | undefined = undefined;
          if (item.maxWidthPercent && item.maxWidthPercent > 0 && item.maxWidthPercent <= 100) {
            // We don't have access to cols here, so use a reasonable default (100 chars)
            maxWidth = Math.floor(100 * item.maxWidthPercent / 100);
          }
          
          // Pass maxWidth to renderTextString
          const asciiArt = renderTextString(item.text, fontName, maxWidth).split('\n');
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
};

// Calculate content height
export const useContentHeight = (textContent: any[]) => {
  return useMemo(() => {
    if (!textContent.length) return 0;
    let maxY = 0;
    textContent.forEach(item => {
      if (item.fixed) return;
      const lines = item.preRenderedAscii 
          ? item.preRenderedAscii.split('\n').length 
          : (item.text ? item.text.split('\n').length : 0);
      maxY = Math.max(maxY, item.y + lines);
    });
    return maxY * CHAR_HEIGHT + 50; // Some padding
  }, [textContent]);
};

// Calculate max scroll
export const useMaxScroll = (size: { height: number | null }, contentHeight: number, maxScrollHeight: number | undefined) => {
  return useMemo(() => {
    if (!size.height) return 0;
    const effectiveMaxHeight = maxScrollHeight || contentHeight;
    return Math.max(0, effectiveMaxHeight - size.height);
  }, [size.height, contentHeight, maxScrollHeight]);
};

// Build the text position cache with link support
export const useTextPositionCache = (
  size: { width: number | null; height: number | null },
  textContent: any[],
  asciiArtCache: Record<string, string[]>,
  linkPositionsRef: MutableRefObject<LinkPosition[]>
) => {
  return useMemo(() => {
    if (!size.width || !size.height) return { cache: {}, grid: {}, bounds: {}, links: [] };
    
    const { cols, rows } = getGridDimensions(size.width, size.height);
    const cache: TextPositionCache = {};
    const positionGrid: { [key: string]: { char: string; fixed: boolean } } = {};
    const textBounds: {[key: string]: {minX: number, maxX: number, minY: number, maxY: number, fixed: boolean}} = {};
    const links: LinkPosition[] = [];
    
    const virtualAreaHeight = rows * 3;
    
    textContent.forEach(textItem => {
      const key = `${textItem.text}-${textItem.x}-${textItem.y}`;
      cache[key] = [];
      const isFixed = !!textItem.fixed;
      
      textBounds[key] = { 
        minX: Infinity, 
        maxX: -Infinity, 
        minY: Infinity, 
        maxY: -Infinity,
        fixed: isFixed
      };
      
      // Convert percentage positions to grid coordinates if usePercentPosition is true or not specified
      let gridX = textItem.x;
      let gridY = textItem.y;
      
      if (textItem.usePercentPosition !== false) {
        // Convert from percentage (0-100) to grid coordinates
        gridX = Math.floor((textItem.x / 100) * cols);
        gridY = Math.floor((textItem.y / 100) * rows);
      }
      
      // New approach - use renderFormattedText to handle all text types
      let textLines: string[];
      let linkData: Array<{line: number, start: number, end: number, url: string}> = [];
      
      if (textItem.preRenderedAscii) {
        // If there's pre-rendered ASCII art, use it
        textLines = textItem.preRenderedAscii.split('\n');
      } else {
        // Use the text renderer for all text types with updated text wrapping
        const fontName = textItem.fontName || 'regular';
        
        // Calculate maxWidth based on textItem.maxWidthPercent and cols
        let maxWidth = cols;
        if (textItem.maxWidthPercent && textItem.maxWidthPercent > 0 && textItem.maxWidthPercent <= 100) {
          maxWidth = Math.floor((cols * textItem.maxWidthPercent) / 100);
        }
        
        // We can now pass maxWidth directly to renderFormattedText
        const formattedResult = renderFormattedText(
          textItem.text, 
          fontName,
          fontName === 'regular' ? maxWidth : undefined
        );
        
        textLines = formattedResult.text.split('\n');
        linkData = formattedResult.links;
      }
      
      if (!textLines || !textLines.length) return;
      
      // Calculate cols based on size.width
      
      // Process each line of the text
      let processedTextLines = textLines;
      
      // Calculate the maximum line length for block alignment
      let maxLineLength = 0;
      for (const line of processedTextLines) {
        maxLineLength = Math.max(maxLineLength, line.length);
      }
      
      // Process links data and store link positions
      for (const linkInfo of linkData) {
        const lineY = gridY + linkInfo.line;
        
        // First calculate the block position
        let blockX = gridX;
        if (textItem.centered) {
          // Center the block horizontally on the page
          blockX = Math.floor(cols / 2) - Math.floor(maxLineLength / 2);
        }
        
        // Then calculate text alignment within the block
        let textX = blockX;
        if (textItem.alignment) {
          const lineLength = processedTextLines[linkInfo.line].length;
          if (textItem.alignment === 'center') {
            // Center align text within the block
            textX = blockX + Math.floor((maxLineLength - lineLength) / 2);
          } else if (textItem.alignment === 'right') {
            // Right align text within the block
            textX = blockX + (maxLineLength - lineLength);
          }
          // For left alignment, textX remains at the block's left edge
        }
        
        links.push({
          textKey: key,
          url: linkInfo.url,
          startX: textX + linkInfo.start,
          endX: textX + linkInfo.end - 1,
          y: lineY
        });
      }
      
      for (let lineIndex = 0; lineIndex < processedTextLines.length; lineIndex++) {
        let lineText = processedTextLines[lineIndex];
        if (!lineText) continue;
        
        // Calculate maxWidth based on textItem.maxWidthPercent and cols
        let maxWidth = cols;
        if (textItem.maxWidthPercent && textItem.maxWidthPercent > 0 && textItem.maxWidthPercent <= 100) {
          maxWidth = Math.floor((cols * textItem.maxWidthPercent) / 100);
        }
        
        // We don't need manual wrapping anymore since it's handled by renderFormattedText
        // Just ensure we don't exceed maxWidth by truncating if necessary
        if (lineText.length > maxWidth) {
          lineText = lineText.substring(0, maxWidth);
          processedTextLines[lineIndex] = lineText;
        }
        
        const lineY = gridY + lineIndex;
        
        // First calculate the block position
        let blockX = gridX;
        if (textItem.centered) {
          // Center the block horizontally on the page
          blockX = Math.floor(cols / 2) - Math.floor(maxLineLength / 2);
        }
        
        // Then calculate text alignment within the block
        let textX = blockX;
        if (textItem.alignment) {
          if (textItem.alignment === 'center') {
            // Center align text within the block
            textX = blockX + Math.floor((maxLineLength - lineText.length) / 2);
          } else if (textItem.alignment === 'right') {
            // Right align text within the block
            textX = blockX + (maxLineLength - lineText.length);
          }
          // For left alignment, textX remains at the block's left edge (blockX)
        } else if (textItem.centered) {
          // If centered but no alignment specified, center each line individually (legacy behavior)
          textX = Math.floor(cols / 2) - Math.floor(lineText.length / 2);
        }
        
        textBounds[key].minY = Math.min(textBounds[key].minY, lineY);
        textBounds[key].maxY = Math.max(textBounds[key].maxY, lineY);
        
        for (let charIndex = 0; charIndex < lineText.length; charIndex++) {
          const x = textX + charIndex;
          
          if (x < -cols || x > cols * 2) continue;
          
          const char = lineText[charIndex];
          if (char && char !== ' ') {
            cache[key].push({
              startX: x,
              endX: x,
              y: lineY,
              char: char,
              fixed: isFixed
            });
            
            textBounds[key].minX = Math.min(textBounds[key].minX, x);
            textBounds[key].maxX = Math.max(textBounds[key].maxX, x);
            
            if (isFixed || 
                (lineY >= -virtualAreaHeight && lineY <= virtualAreaHeight * 2)) {
              positionGrid[`${x},${lineY}`] = { char, fixed: isFixed };
            }
          }
        }
      }
      const padding = BLOB_PADDING;
      textBounds[key].minX = Math.max(-cols, textBounds[key].minX - padding);
      textBounds[key].maxX = Math.min(cols * 2, textBounds[key].maxX + padding);
      textBounds[key].minY = Math.max(-virtualAreaHeight, textBounds[key].minY - padding);
      textBounds[key].maxY = Math.min(virtualAreaHeight * 2, textBounds[key].maxY + padding);
    });
    
    // Update link positions ref
    linkPositionsRef.current = links;
    
    return { cache, grid: positionGrid, bounds: textBounds, links };
  }, [textContent, asciiArtCache, size, linkPositionsRef]);
};

// Build blob cache
export const useBuildBlobCache = (
  size: { width: number | null; height: number | null },
  textPositionCache: { 
    cache: TextPositionCache; 
    grid: Record<string, any>; 
    bounds: Record<string, any>; 
    links: LinkPosition[] 
  },
  scrollOffsetRef: MutableRefObject<number>
) => {
  return useCallback(() => {
    if (!size.width || !size.height) return;
    
    const scrolledY = Math.floor(scrollOffsetRef.current / CHAR_HEIGHT);
    const { cols, rows } = getGridDimensions(size.width, size.height);
    
    const padding = BLOB_RADIUS * 3;
    const cacheStartX = -padding;
    const cacheStartY = scrolledY - rows - padding; 
    const cacheWidth = cols + padding * 2;
    const cacheHeight = rows * 4 + padding * 2;
    
    const gridWidth = Math.ceil(cacheWidth / BLOB_CACHE_GRID_SIZE);
    const gridHeight = Math.ceil(cacheHeight / BLOB_CACHE_GRID_SIZE);
    
    const newGrid: {[key: string]: Uint8Array} = {};
      
    const spatialGrid: {[key: string]: Array<{textKey: string, x: number, y: number}>} = {};
    const cellSize = GRID_CELL_SIZE * BLOB_RADIUS;
    
    for (const textKey in textPositionCache.cache) {
      const positions = textPositionCache.cache[textKey];
      const bounds = textPositionCache.bounds[textKey];
      const isFixed = bounds.fixed;
      
      for (const pos of positions) {
        const effectiveY = isFixed ? pos.y : pos.y - scrolledY;
        
        if (effectiveY < cacheStartY - BLOB_RADIUS || 
            effectiveY > cacheStartY + cacheHeight + BLOB_RADIUS) {
          continue;
        }
        if (pos.startX < cacheStartX - BLOB_RADIUS || 
            pos.startX > cacheStartX + cacheWidth + BLOB_RADIUS) {
          continue;
        }
        
        const gridX = Math.floor(pos.startX / cellSize);
        const gridY = Math.floor(effectiveY / cellSize);
        const cellKey = `${gridX},${gridY}`;
        
        if (!spatialGrid[cellKey]) spatialGrid[cellKey] = [];
        spatialGrid[cellKey].push({
          textKey,
          x: pos.startX,
          y: effectiveY
        });
      }
    }
    
    for (let gy = 0; gy < gridHeight; gy++) {
      for (let gx = 0; gx < gridWidth; gx++) {
        const cellArray = new Uint8Array(BLOB_CACHE_GRID_SIZE * BLOB_CACHE_GRID_SIZE);
        newGrid[`${gx},${gy}`] = cellArray;
        
        const cellWorldX = cacheStartX + gx * BLOB_CACHE_GRID_SIZE;
        const cellWorldY = cacheStartY + gy * BLOB_CACHE_GRID_SIZE;
        
        const spatialCellsToCheck: string[] = [];
        const minSpatialX = Math.floor((cellWorldX - BLOB_RADIUS) / cellSize);
        const maxSpatialX = Math.floor((cellWorldX + BLOB_CACHE_GRID_SIZE + BLOB_RADIUS) / cellSize);
        const minSpatialY = Math.floor((cellWorldY - BLOB_RADIUS) / cellSize);
        const maxSpatialY = Math.floor((cellWorldY + BLOB_CACHE_GRID_SIZE + BLOB_RADIUS) / cellSize);
        
        for (let sy = minSpatialY; sy <= maxSpatialY; sy++) {
          for (let sx = minSpatialX; sx <= maxSpatialX; sx++) {
            const spatialKey = `${sx},${sy}`;
            if (spatialGrid[spatialKey]) {
              spatialCellsToCheck.push(spatialKey);
            }
          }
        }
        if (spatialCellsToCheck.length === 0) continue;
        
        for (let localY = 0; localY < BLOB_CACHE_GRID_SIZE; localY++) {
          for (let localX = 0; localX < BLOB_CACHE_GRID_SIZE; localX++) {
            const worldX = cellWorldX + localX;
            const worldY = cellWorldY + localY;
            const index = localY * BLOB_CACHE_GRID_SIZE + localX;
            
            let isInterior = false;
            let isBorder = false;
            
            for (const spatialKey of spatialCellsToCheck) {
              const positions = spatialGrid[spatialKey];
              
              for (const pos of positions) {
                const dx = worldX - pos.x;
                const dy = worldY - pos.y;
                const distanceSquared = dx * dx + dy * dy * 2;
                
                if (distanceSquared < (BLOB_RADIUS - 2) * (BLOB_RADIUS - 2)) {
                  isInterior = true;
                  break;
                }
                if (distanceSquared < BLOB_RADIUS * BLOB_RADIUS) {
                  isBorder = true;
                }
              }
              if (isInterior) break;
            }
            cellArray[index] = isInterior ? 1 : (isBorder ? 2 : 0);
          }
        }
      }
    }
    
    return {
      grid: newGrid,
      startX: cacheStartX,
      startY: cacheStartY,
      width: cacheWidth,
      height: cacheHeight,
      spatialGrid
    };
  }, [size, textPositionCache, scrollOffsetRef]);
};

// Precomputed sin/cos tables
export const useTrigTables = () => {
  const sinTable = useMemo(() => createSinTable(), []);
  const cosTable = useMemo(() => createCosTable(), []);
  return { sinTable, cosTable };
}; 