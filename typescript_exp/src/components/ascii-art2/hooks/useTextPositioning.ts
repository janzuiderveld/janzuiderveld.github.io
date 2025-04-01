import { useMemo } from 'react';
import { renderFormattedText, renderTextString, FontName } from '../../ASCII_text_renderer';
import { getGridDimensions } from '../utils';
import { 
  TextPositionCacheResult, 
  Size, 
  LinkPosition, 
  TextPositionCache, 
  TextGridCell // Import the cell type
} from '../types';
import { BLOB_PADDING } from '../constants';

export const useTextPositioning = (
  textContent: Array<{
    text: string;
    x: number;
    y: number;
    fontName?: FontName;
    preRenderedAscii?: string;
    fixed?: boolean;
    maxWidthPercent?: number;
    alignment?: 'left' | 'center' | 'right';
    usePercentPosition?: boolean;
    centered?: boolean;
    name?: string;
    anchorTo?: string;
    anchorOffsetX?: number;
    anchorOffsetY?: number;
    anchorPoint?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center' | 'bottomCenter';
  }>,
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
    const positionedItems = new Set<number>();

    // --- STAGE 1: Calculate Bounds and Links --- 
    // Define the processing function (calculates bounds, links, styling, but doesn't populate grid yet)
    const processTextItemBounds = (index: number) => {
      if (positionedItems.has(index)) return;
      
      const textItem = textContent[index];
      
      // Handle anchor dependencies
      if (textItem.anchorTo) {
        const anchorIndex = namedTextboxes[textItem.anchorTo];
        if (anchorIndex !== undefined && !positionedItems.has(anchorIndex)) {
          processTextItemBounds(anchorIndex); // Recursive call for dependency
        }
      }
      
      const key = textItem.name ? 
        `${textItem.name}-${textItem.text}` : 
        `${textItem.text}-${textItem.x}-${textItem.y}`;
      
      cache[key] = [];
      const isFixed = !!textItem.fixed;
      
      textBounds[key] = { 
        minX: Infinity, 
        maxX: -Infinity, 
        minY: Infinity, 
        maxY: -Infinity,
        fixed: isFixed
      };
      
      let gridX = textItem.x;
      let gridY = textItem.y;
      let textLines: string[];
      let linkData: Array<{line: number, start: number, end: number, url: string}> = [];
      let maxLineLength = 0;
      let textBlockStartX = gridX;
      let maxWidth = cols;
      if (textItem.maxWidthPercent && textItem.maxWidthPercent > 0 && textItem.maxWidthPercent <= 100) {
        maxWidth = Math.floor((cols * textItem.maxWidthPercent) / 100);
      }

      // --- Calculate Anchor Position --- (if applicable)
      if (textItem.anchorTo && namedTextboxes[textItem.anchorTo] !== undefined) {
        const anchorIndex = namedTextboxes[textItem.anchorTo];
        const anchorItem = textContent[anchorIndex];
        const anchorKey = anchorItem.name ? 
          `${anchorItem.name}-${anchorItem.text}` : 
          `${anchorItem.text}-${anchorItem.x}-${anchorItem.y}`;
        
        if (textBounds[anchorKey]) {
          let anchorX = 0;
          let anchorY = 0;
          switch(textItem.anchorPoint || 'topLeft') {
            case 'topLeft': anchorX = textBounds[anchorKey].minX; anchorY = textBounds[anchorKey].minY; break;
            case 'topRight': anchorX = textBounds[anchorKey].maxX; anchorY = textBounds[anchorKey].minY; break;
            case 'bottomLeft': anchorX = textBounds[anchorKey].minX; anchorY = textBounds[anchorKey].maxY; break;
            case 'bottomRight': anchorX = textBounds[anchorKey].maxX; anchorY = textBounds[anchorKey].maxY; break;
            case 'bottomCenter': anchorX = Math.floor((textBounds[anchorKey].minX + textBounds[anchorKey].maxX) / 2); anchorY = textBounds[anchorKey].maxY; break;
            case 'center': anchorX = Math.floor((textBounds[anchorKey].minX + textBounds[anchorKey].maxX) / 2); anchorY = Math.floor((textBounds[anchorKey].minY + textBounds[anchorKey].maxY) / 2); break;
          }
          gridX = anchorX + (textItem.anchorOffsetX || 0);
          gridY = anchorY + (textItem.anchorOffsetY || 0);
        }
      } else if (textItem.usePercentPosition !== false) {
        gridX = Math.floor((textItem.x / 100) * cols);
        gridY = Math.floor((textItem.y / 100) * rows);
      }
      
      // --- Handle Centering --- 
      if (textItem.centered) {
        const horizontalCenter = Math.floor(cols / 2);
        gridX = horizontalCenter + Math.floor((textItem.x / 100) * cols);
      }

      // --- Render Text / Get Lines --- 
      const fontName = textItem.fontName || 'regular';
      if (textItem.preRenderedAscii) {
        textLines = textItem.preRenderedAscii.split('\n');
        maxLineLength = 0;
        for (const line of textLines) maxLineLength = Math.max(maxLineLength, line.length);
        if (textItem.centered) {
          textBlockStartX = Math.floor(cols / 2) - Math.floor(maxLineLength / 2);
          gridX = textBlockStartX;
          maxWidth = Math.max(maxWidth, maxLineLength);
        }
      } else {
        const formattedResult = renderFormattedText(
          textItem.text, fontName, { maxWidth: fontName === 'regular' ? maxWidth : undefined, respectLineBreaks: true }
        );
        textLines = formattedResult.text.split('\n');
        linkData = formattedResult.links;
        maxLineLength = 0;
        for (const line of textLines) maxLineLength = Math.max(maxLineLength, line.length);
        maxLineLength = Math.min(maxLineLength, maxWidth);
        if (textItem.centered) {
          textBlockStartX = Math.floor(cols / 2) - Math.floor(maxLineLength / 2) + Math.floor((textItem.x / 100) * cols);
          gridX = textBlockStartX;
        }
      }
      if (!textLines || !textLines.length) return;

      // --- Calculate Links --- 
      for (const linkInfo of linkData) {
        const lineY = gridY + linkInfo.line;
        let textX = gridX;
        const actualLineLength = textLines[linkInfo.line] ? Math.min(textLines[linkInfo.line].length, maxWidth) : 0;
        if (textItem.centered) {
          textX = textBlockStartX;
          if (textItem.alignment === 'center') textX = textBlockStartX + Math.floor((maxLineLength - actualLineLength) / 2);
          else if (textItem.alignment === 'right') textX = textBlockStartX + (maxLineLength - actualLineLength);
        } else if (textItem.alignment) {
          if (textItem.alignment === 'center') textX = Math.floor(gridX + (maxWidth - actualLineLength) / 2);
          else if (textItem.alignment === 'right') textX = gridX + maxWidth - actualLineLength;
        }
        links.push({ textKey: key, url: linkInfo.url, startX: textX + linkInfo.start, endX: textX + linkInfo.end - 1, y: lineY });
      }

      // --- Calculate Bounds for this Item --- 
      const finalLines: string[] = [];
      for (let i = 0; i < textLines.length; i++) {
        const line = textLines[i];
        finalLines.push(line);
        if (textItem.fontName === 'regular' && !textItem.preRenderedAscii && (line.trim() !== '' || i === textLines.length - 1)) {
          finalLines.push('');
        }
      }
      
      for (let lineIndex = 0; lineIndex < finalLines.length; lineIndex++) {
        let lineText = finalLines[lineIndex];
        if (!lineText) continue;
        if (!textItem.preRenderedAscii && lineText.length > maxWidth) {
          lineText = lineText.substring(0, maxWidth);
        }
        const lineY = gridY + lineIndex;
        let textX = gridX;
        const actualLineLength = lineText.length;
        if (textItem.centered) {
          textX = textBlockStartX;
          if (textItem.alignment === 'center') textX = textBlockStartX + Math.floor((maxLineLength - actualLineLength) / 2);
          else if (textItem.alignment === 'right') textX = textBlockStartX + (maxLineLength - actualLineLength);
        } else if (textItem.alignment) {
          if (textItem.alignment === 'center') textX = Math.floor(gridX + (maxWidth - actualLineLength) / 2);
          else if (textItem.alignment === 'right') textX = gridX + maxWidth - actualLineLength;
        }
        
        textBounds[key].minY = Math.min(textBounds[key].minY, lineY);
        textBounds[key].maxY = Math.max(textBounds[key].maxY, lineY);
        
        for (let charIndex = 0; charIndex < lineText.length; charIndex++) {
          const x = textX + charIndex;
          if (x < -cols || x > cols * 2) continue; // Check horizontal bounds
          const char = lineText[charIndex];
          if (char && char !== ' ') {
            textBounds[key].minX = Math.min(textBounds[key].minX, x);
            textBounds[key].maxX = Math.max(textBounds[key].maxX, x);
            // Don't populate grid here yet
            // Add to simple cache for blob generation reference
            cache[key].push({ startX: x, endX: x, y: lineY, char, fixed: isFixed });
          }
        }
      }
      const padding = BLOB_PADDING;
      textBounds[key].minX = Math.max(-cols, textBounds[key].minX - padding);
      textBounds[key].maxX = Math.min(cols * 2, textBounds[key].maxX + padding);
      textBounds[key].minY = Math.max(-rows * 2, textBounds[key].minY - padding); // Adjust vertical padding if needed
      textBounds[key].maxY = Math.min(rows * 3, textBounds[key].maxY + padding); // Adjust vertical padding

      positionedItems.add(index);
    };

    // Run Stage 1
    textContent.forEach((_, index) => {
      processTextItemBounds(index);
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

    // --- STAGE 3: Initialize and Populate Grid --- 
    const positionGridArray: TextGridCell[] = new Array(gridCols * gridRows).fill(null);
    positionedItems.clear(); // Reset for Stage 3 processing

    // Define Stage 3 processing function (populates the flat array)
    const processTextItemGrid = (index: number) => {
      if (positionedItems.has(index)) return;
      const textItem = textContent[index];
      if (textItem.anchorTo) {
        const anchorIndex = namedTextboxes[textItem.anchorTo];
        if (anchorIndex !== undefined && !positionedItems.has(anchorIndex)) {
          processTextItemGrid(anchorIndex);
        }
      }

      // Using variable or removing for now
      const isFixed = !!textItem.fixed;
      let gridX = textItem.x;
      let gridY = textItem.y;
      let textLines: string[];
      let maxLineLength = 0;
      let textBlockStartX = gridX;
      let maxWidth = cols;
      if (textItem.maxWidthPercent && textItem.maxWidthPercent > 0 && textItem.maxWidthPercent <= 100) {
        maxWidth = Math.floor((cols * textItem.maxWidthPercent) / 100);
      }

      // Recalculate Anchor Position
      if (textItem.anchorTo && namedTextboxes[textItem.anchorTo] !== undefined) {
        const anchorIndex = namedTextboxes[textItem.anchorTo];
        const anchorItem = textContent[anchorIndex];
        const anchorKey = anchorItem.name ? 
          `${anchorItem.name}-${anchorItem.text}` : 
          `${anchorItem.text}-${anchorItem.x}-${anchorItem.y}`;
        if (textBounds[anchorKey]) {
          let anchorX = 0, anchorY = 0;
          // (Switch statement for anchor point as before)
          switch(textItem.anchorPoint || 'topLeft') {
            case 'topLeft': anchorX = textBounds[anchorKey].minX; anchorY = textBounds[anchorKey].minY; break;
            case 'topRight': anchorX = textBounds[anchorKey].maxX; anchorY = textBounds[anchorKey].minY; break;
            case 'bottomLeft': anchorX = textBounds[anchorKey].minX; anchorY = textBounds[anchorKey].maxY; break;
            case 'bottomRight': anchorX = textBounds[anchorKey].maxX; anchorY = textBounds[anchorKey].maxY; break;
            case 'bottomCenter': anchorX = Math.floor((textBounds[anchorKey].minX + textBounds[anchorKey].maxX) / 2); anchorY = textBounds[anchorKey].maxY; break;
            case 'center': anchorX = Math.floor((textBounds[anchorKey].minX + textBounds[anchorKey].maxX) / 2); anchorY = Math.floor((textBounds[anchorKey].minY + textBounds[anchorKey].maxY) / 2); break;
          }
          gridX = anchorX + (textItem.anchorOffsetX || 0);
          gridY = anchorY + (textItem.anchorOffsetY || 0);
        }
      } else if (textItem.usePercentPosition !== false) {
        gridX = Math.floor((textItem.x / 100) * cols);
        gridY = Math.floor((textItem.y / 100) * rows);
      }
      
      // Recalculate Centering
      if (textItem.centered) {
        const horizontalCenter = Math.floor(cols / 2);
        gridX = horizontalCenter + Math.floor((textItem.x / 100) * cols);
      }

      // Rerender Text / Get Lines & Styles
      const fontName = textItem.fontName || 'regular';
      if (textItem.preRenderedAscii) {
        textLines = textItem.preRenderedAscii.split('\n');
        maxLineLength = 0;
        for (const line of textLines) maxLineLength = Math.max(maxLineLength, line.length);
        if (textItem.centered) {
          textBlockStartX = Math.floor(cols / 2) - Math.floor(maxLineLength / 2);
          gridX = textBlockStartX;
          maxWidth = Math.max(maxWidth, maxLineLength);
        }
      } else {
        const formattedResult = renderFormattedText(
          textItem.text, fontName, { maxWidth: fontName === 'regular' ? maxWidth : undefined, respectLineBreaks: true }
        );
        textLines = formattedResult.text.split('\n');
        maxLineLength = 0;
        for (const line of textLines) maxLineLength = Math.max(maxLineLength, line.length);
        maxLineLength = Math.min(maxLineLength, maxWidth);
        if (textItem.centered) {
          textBlockStartX = Math.floor(cols / 2) - Math.floor(maxLineLength / 2) + Math.floor((textItem.x / 100) * cols);
          gridX = textBlockStartX;
        }
      }
      if (!textLines || !textLines.length) return;
      
      // Final line processing and grid population
      const finalLines: string[] = []; // Calculate finalLines as before
      for (let i = 0; i < textLines.length; i++) {
        const line = textLines[i];
        finalLines.push(line);
        if (textItem.fontName === 'regular' && !textItem.preRenderedAscii && (line.trim() !== '' || i === textLines.length - 1)) {
          finalLines.push('');
        }
      }

      for (let lineIndex = 0; lineIndex < finalLines.length; lineIndex++) {
        let lineText = finalLines[lineIndex];
        if (!lineText) continue;
        if (!textItem.preRenderedAscii && lineText.length > maxWidth) {
          lineText = lineText.substring(0, maxWidth);
        }
        const lineY = gridY + lineIndex;
        let textX = gridX;
        const actualLineLength = lineText.length;

        // Recalculate textX based on alignment/centering as before
        if (textItem.centered) {
          textX = textBlockStartX;
          if (textItem.alignment === 'center') textX = textBlockStartX + Math.floor((maxLineLength - actualLineLength) / 2);
          else if (textItem.alignment === 'right') textX = textBlockStartX + (maxLineLength - actualLineLength);
        } else if (textItem.alignment) {
          if (textItem.alignment === 'center') textX = Math.floor(gridX + (maxWidth - actualLineLength) / 2);
          else if (textItem.alignment === 'right') textX = gridX + maxWidth - actualLineLength;
        }
        
        for (let charIndex = 0; charIndex < lineText.length; charIndex++) {
          const x = textX + charIndex;
          const char = lineText[charIndex];
          if (char && char !== ' ') {
            // *** Populate the flat array ***
            const arrayIndex = (lineY - offsetY) * gridCols + x;
            // Check bounds before writing
            if (x >= 0 && x < gridCols && lineY >= offsetY && lineY < offsetY + gridRows) {
               if (arrayIndex >= 0 && arrayIndex < positionGridArray.length) { // Double check index
                 positionGridArray[arrayIndex] = { char, fixed: isFixed };
               }
            }
          }
        }
      }
      positionedItems.add(index);
    };

    // Run Stage 3
    textContent.forEach((_, index) => {
      processTextItemGrid(index);
    });

    // Update link positions ref (remains the same)
    linkPositionsRef.current = links;
    setLinkPositions(links);
    if (links.length > 0) {
      console.log(`Found ${links.length} clickable links:`, links);
    }
    
    // Return the final result
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