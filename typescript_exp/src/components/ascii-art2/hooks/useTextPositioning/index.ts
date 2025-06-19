import { useMemo } from 'react';
import { getGridDimensions } from '../../utils';
import { LinkPosition, TextPositionCacheResult, TextGridCell, TextPositionCache, TextBounds } from '../../types';
import { UseTextPositioningParams, NamedTextboxes } from './types';
import { renderText, preprocessLines } from './textRendering';
import { calculatePosition, calculateLinks, calculateTextBounds, getTextItemKey } from './positioning';

export const useTextPositioning = ({
  textContent,
  size,
  setLinkPositions,
  linkPositionsRef
}: UseTextPositioningParams): TextPositionCacheResult => {
  // Build the text position cache with link support
  const textPositionCache = useMemo(() => {
    // Return initial empty state if size is not available
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
    const textBounds: {[key: string]: TextBounds} = {};
    const links: LinkPosition[] = [];
    
    // Create a mapping of name to textItem index for anchoring
    const namedTextboxes: NamedTextboxes = {};
    textContent.forEach((item, index) => {
      if (item.name) {
        namedTextboxes[item.name] = index;
      }
    });
    
    // Track positioned items to handle dependencies
    const positionedItems = new Set<number>();
    
    // --- STAGE 1: Calculate Bounds and Links ---
    // Process text items to calculate bounds and links
    const processTextItemBounds = (index: number) => {
      if (positionedItems.has(index)) return;
      
      const textItem = textContent[index];
      
      // Handle anchor dependencies recursively
      if (textItem.anchorTo) {
        const anchorIndex = namedTextboxes[textItem.anchorTo];
        if (anchorIndex !== undefined && !positionedItems.has(anchorIndex)) {
          processTextItemBounds(anchorIndex);
        }
      }
      
      // Generate unique key for the text item
      const key = getTextItemKey(textItem.name, textItem.text, textItem.x, textItem.y);
      
      // Initialize cache and bounds for this text item
      cache[key] = [];
      const isFixed = !!textItem.fixed;
      
      textBounds[key] = { 
        minX: Infinity, 
        maxX: -Infinity, 
        minY: Infinity, 
        maxY: -Infinity,
        fixed: isFixed
      };
      
      // Calculate max width based on settings
      let maxWidth = cols;
      if (textItem.maxWidthPercent && textItem.maxWidthPercent > 0 && textItem.maxWidthPercent <= 100) {
        maxWidth = Math.floor((cols * textItem.maxWidthPercent) / 100);
      }
      
      // Get position based on anchors and settings
      const { gridX, gridY, textBlockStartX } = calculatePosition(
        textItem, 
        namedTextboxes, 
        cols, 
        rows, 
        textBounds
      );
      
      // Render the text content
      const fontName = textItem.fontName || 'regular';
      const { textLines, linkData, maxLineLength } = renderText(textItem, maxWidth);
      
      // Adjust textBlockStartX for centered content
      let adjustedTextBlockStartX = textBlockStartX;
      if (textItem.centered && !textItem.preRenderedAscii) {
        adjustedTextBlockStartX = Math.floor(cols / 2) - Math.floor(maxLineLength / 2) + Math.floor((textItem.x / 100) * cols);
      } else if (textItem.preRenderedAscii && textItem.centered) {
        adjustedTextBlockStartX = Math.floor(cols / 2) - Math.floor(maxLineLength / 2);
      }
      
      // Create positioning context for calculation functions
      const positioningContext = {
        gridX,
        gridY,
        textLines: textLines.map(line => ({ content: line, alignment: textItem.alignment })),
        maxLineLength,
        textBlockStartX: adjustedTextBlockStartX,
        fontName,
        fixed: isFixed,
        maxWidth
      };
      
      // Calculate links for this text item
      const textLinks = calculateLinks(key, positioningContext, linkData);
      links.push(...textLinks);
      
      // Preprocess lines (add spacing for regular text)
      const finalLines = preprocessLines(textLines, fontName);
      
      // Calculate bounds for this text item
      const bounds = calculateTextBounds(positioningContext, finalLines);
      textBounds[key] = bounds;
      
      // Store character data in cache for blob generation
      for (let lineIndex = 0; lineIndex < finalLines.length; lineIndex++) {
        const line = finalLines[lineIndex];
        if (!line) continue;
        
        const lineY = gridY + lineIndex;
        let textX = gridX;
        
        // Apply text alignment
        if (textItem.centered) {
          textX = adjustedTextBlockStartX;
          if (textItem.alignment === 'center') {
            textX = adjustedTextBlockStartX + Math.floor((maxLineLength - line.length) / 2);
          } else if (textItem.alignment === 'right') {
            textX = adjustedTextBlockStartX + (maxLineLength - line.length);
          }
        } else if (textItem.alignment) {
          if (textItem.alignment === 'center') {
            textX = Math.floor(gridX + (maxWidth - line.length) / 2);
          } else if (textItem.alignment === 'right') {
            textX = gridX + maxWidth - line.length;
          }
        }
        
        // Store characters in cache
        for (let charIndex = 0; charIndex < line.length; charIndex++) {
          const x = textX + charIndex;
          if (x < -cols || x > cols * 2) continue; // Skip out of bounds
          
          const char = line[charIndex];
          if (char && char !== ' ') {
            cache[key].push({
              startX: x,
              endX: x,
              y: lineY,
              char,
              fixed: isFixed
            });
          }
        }
      }
      
      // Mark this item as positioned
      positionedItems.add(index);
    };
    
    // --- STAGE 2: Process All Text Items ---
    // Calculate bounds for all items
    for (let i = 0; i < textContent.length; i++) {
      processTextItemBounds(i);
    }
    
    // --- STAGE 3: Build Final Grid ---
    // Create the grid for rendering
    const spatialGrid: TextGridCell[] = [];
    const gridCols = cols;
    const offsetY = 0;
    
    // Update link positions for external references
    linkPositionsRef.current = links;
    setLinkPositions(links);
    
    return {
      cache,
      grid: spatialGrid,
      bounds: textBounds,
      links,
      gridCols,
      offsetY
    };
  }, [size, textContent, setLinkPositions, linkPositionsRef]);
  
  return textPositionCache;
};

export * from './types';
export * from './textRendering';
export * from './positioning'; 