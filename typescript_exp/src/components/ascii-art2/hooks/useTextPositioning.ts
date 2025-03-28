import { useMemo } from 'react';
import { renderFormattedText, renderTextString, FontName } from '../../ASCII_text_renderer';
import { getGridDimensions } from '../utils';
import { 
  TextPositionCacheResult, 
  Size, 
  LinkPosition, 
  TextPositionCache 
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
    anchorPoint?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center';
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
    if (!size.width || !size.height) return { cache: {}, grid: {}, bounds: {}, links: [] };
    
    const { cols, rows } = getGridDimensions(size.width, size.height);
    const cache: TextPositionCache = {};
    const positionGrid: { [key: string]: { char: string; fixed: boolean; isBold?: boolean; isItalic?: boolean } } = {};
    const textBounds: {[key: string]: {minX: number, maxX: number, minY: number, maxY: number, fixed: boolean}} = {};
    const links: LinkPosition[] = [];
    
    const virtualAreaHeight = rows * 3;

    // First pass: Create a mapping of name to textItem index for anchoring
    const namedTextboxes: Record<string, number> = {};
    textContent.forEach((item, index) => {
      if (item.name) {
        namedTextboxes[item.name] = index;
      }
    });
    
    // Create a map to track which text items have been positioned
    const positionedItems = new Set<number>();
    
    // Calculate positions for non-anchored items first
    const processTextItem = (index: number) => {
      if (positionedItems.has(index)) return;
      
      const textItem = textContent[index];
      
      // If this item is anchored, we need to process the anchor first
      if (textItem.anchorTo) {
        const anchorIndex = namedTextboxes[textItem.anchorTo];
        if (anchorIndex !== undefined && !positionedItems.has(anchorIndex)) {
          processTextItem(anchorIndex);
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
      
      // Convert percentage positions to grid coordinates if usePercentPosition is true or not specified
      let gridX = textItem.x;
      let gridY = textItem.y;
      
      // Handle anchoring to another textbox if specified
      if (textItem.anchorTo && namedTextboxes[textItem.anchorTo] !== undefined) {
        const anchorIndex = namedTextboxes[textItem.anchorTo];
        const anchorItem = textContent[anchorIndex];
        const anchorKey = anchorItem.name ? 
          `${anchorItem.name}-${anchorItem.text}` : 
          `${anchorItem.text}-${anchorItem.x}-${anchorItem.y}`;
        
        // Make sure the anchor has been processed
        if (textBounds[anchorKey]) {
          // Determine anchor point coordinates
          let anchorX = 0;
          let anchorY = 0;
          
          switch(textItem.anchorPoint || 'topLeft') {
            case 'topLeft':
              anchorX = textBounds[anchorKey].minX;
              anchorY = textBounds[anchorKey].minY;
              break;
            case 'topRight':
              anchorX = textBounds[anchorKey].maxX;
              anchorY = textBounds[anchorKey].minY;
              break;
            case 'bottomLeft':
              anchorX = textBounds[anchorKey].minX;
              anchorY = textBounds[anchorKey].maxY;
              break;
            case 'bottomRight':
              anchorX = textBounds[anchorKey].maxX;
              anchorY = textBounds[anchorKey].maxY;
              break;
            case 'center':
              anchorX = Math.floor((textBounds[anchorKey].minX + textBounds[anchorKey].maxX) / 2);
              anchorY = Math.floor((textBounds[anchorKey].minY + textBounds[anchorKey].maxY) / 2);
              break;
          }
          
          // Apply the offset
          gridX = anchorX + (textItem.anchorOffsetX || 0);
          gridY = anchorY + (textItem.anchorOffsetY || 0);
        }
      } else if (textItem.usePercentPosition !== false) {
        // Convert from percentage (0-100) to grid coordinates
        gridX = Math.floor((textItem.x / 100) * cols);
        gridY = Math.floor((textItem.y / 100) * rows);
      }
      
      // Use the text renderer for all text types
      const fontName = textItem.fontName || 'regular';
      let maxWidth = cols;
      if (textItem.maxWidthPercent && textItem.maxWidthPercent > 0 && textItem.maxWidthPercent <= 100) {
        maxWidth = Math.floor((cols * textItem.maxWidthPercent) / 100);
      }

      // Define text lines and metadata
      let textLines: string[];
      let linkData: Array<{line: number, start: number, end: number, url: string}> = [];
      let styleData: Array<{line: number, start: number, end: number, style: {isBold?: boolean, isItalic?: boolean, isLink?: boolean, url?: string, color?: string}}> = [];

      if (textItem.preRenderedAscii) {
        // If there's pre-rendered ASCII art, use it
        textLines = textItem.preRenderedAscii.split('\n');
      } else {
        // Use the new text wrapping options when rendering text
        const formattedResult = renderFormattedText(
          textItem.text, 
          fontName, 
          {
            maxWidth: fontName === 'regular' ? maxWidth : undefined,
            respectLineBreaks: true
          }
        );
        textLines = formattedResult.text.split('\n');
        linkData = formattedResult.links;
        styleData = formattedResult.styles; // Store style information
      }

      if (!textLines || !textLines.length) return;
      
      // Calculate the max line length based on the wrapped lines
      let maxLineLength = 0;
      for (const line of textLines) {
        maxLineLength = Math.max(maxLineLength, line.length);
      }
      
      // Ensure we don't exceed maxWidth for the max line length calculation
      maxLineLength = Math.min(maxLineLength, maxWidth);
      
      // Calculate the starting X position for the entire text block when centered
      let textBlockStartX = gridX;
      if (textItem.centered) {
        textBlockStartX = Math.floor(cols / 2) - Math.floor(maxLineLength / 2);
      }
      
      // Process links data and store link positions
      for (const linkInfo of linkData) {
        const lineY = gridY + linkInfo.line;
        let textX = gridX;
        
        // For links, we need to be careful with wrapping - use the actual line length
        const actualLineLength = textLines[linkInfo.line] ? 
          Math.min(textLines[linkInfo.line].length, maxWidth) : 0;
        
        if (textItem.centered) {
          // Use the block start position for centered text
          textX = textBlockStartX;
          
          // Apply additional alignment within the centered block if specified
          if (textItem.alignment) {
            if (textItem.alignment === 'center') {
              // For centered alignment, each line should be centered within the block
              // Calculate the center offset for this specific line
              const lineOffset = Math.floor((maxLineLength - actualLineLength) / 2);
              textX = textBlockStartX + lineOffset;
            } else if (textItem.alignment === 'right') {
              textX = textBlockStartX + (maxLineLength - actualLineLength);
            }
            // For 'left', no adjustment needed as it's the default
          }
        } else if (textItem.alignment) {
          if (textItem.alignment === 'center') {
            textX = Math.floor(gridX + (maxWidth - actualLineLength) / 2);
          } else if (textItem.alignment === 'right') {
            textX = gridX + maxWidth - actualLineLength;
          }
        }
        
        links.push({
          textKey: key,
          url: linkInfo.url,
          startX: textX + linkInfo.start,
          endX: textX + linkInfo.end - 1,
          y: lineY
        });
      }
      
      // Remove the manual word-wrapping since it's now handled by the text renderer
      const finalLines: string[] = [];
      
      // Process lines and add proper spacing
      for (let i = 0; i < textLines.length; i++) {
        const line = textLines[i];
        
        // Add the current line
        finalLines.push(line);
        
        // Add an empty line after each non-empty line for regular text
        // but avoid adding empty lines after an already empty line
        if (textItem.fontName === 'regular' && !textItem.preRenderedAscii && 
            (line.trim() !== '' || i === textLines.length - 1)) {
          finalLines.push('');  // Extra line spacing
        }
      }
      
      for (let lineIndex = 0; lineIndex < finalLines.length; lineIndex++) {
        let lineText = finalLines[lineIndex];
        if (!lineText) continue;
        
        // Make sure we always respect maxWidth
        if (lineText.length > maxWidth) {
          lineText = lineText.substring(0, maxWidth);
        }
        
        const lineY = gridY + lineIndex;
        
        let textX = gridX;
        
        // Use the actual line length for centering/alignment calculations, not the maxLineLength
        const actualLineLength = lineText.length;
        
        if (textItem.centered) {
          // Use the block start position for centered text
          textX = textBlockStartX;
          
          // Apply additional alignment within the centered block if specified
          if (textItem.alignment) {
            if (textItem.alignment === 'center') {
              // For centered alignment, each line should be centered within the block
              // Calculate the center offset for this specific line
              const lineOffset = Math.floor((maxLineLength - actualLineLength) / 2);
              textX = textBlockStartX + lineOffset;
            } else if (textItem.alignment === 'right') {
              textX = textBlockStartX + (maxLineLength - actualLineLength);
            }
            // For 'left', no adjustment needed as it's the default
          }
        } else if (textItem.alignment) {
          if (textItem.alignment === 'center') {
            textX = Math.floor(gridX + (maxWidth - actualLineLength) / 2);
          } else if (textItem.alignment === 'right') {
            textX = gridX + maxWidth - actualLineLength;
          }
        }
        
        textBounds[key].minY = Math.min(textBounds[key].minY, lineY);
        textBounds[key].maxY = Math.max(textBounds[key].maxY, lineY);
        
        for (let charIndex = 0; charIndex < lineText.length; charIndex++) {
          const x = textX + charIndex;
          
          if (x < -cols || x > cols * 2) continue;
          
          const char = lineText[charIndex];
          if (char && char !== ' ') {
            // Check if this character has any style (bold, italic, etc.)
            let isBold = false;
            let isItalic = false;
            
            // Find style data for this character
            for (const style of styleData) {
              if (style.line === lineIndex && 
                  charIndex >= style.start && 
                  charIndex < style.end) {
                isBold = !!style.style.isBold;
                isItalic = !!style.style.isItalic;
              }
            }
            
            textBounds[key].minX = Math.min(textBounds[key].minX, x);
            textBounds[key].maxX = Math.max(textBounds[key].maxX, x);
            
            // Place the character in the grid
            const gridKey = `${x},${lineY}`;
            positionGrid[gridKey] = { char, fixed: isFixed, isBold, isItalic };
            
            // Add to the text position cache
            cache[key].push({
              startX: x,
              endX: x,
              y: lineY,
              char,
              fixed: isFixed,
              isBold,
              isItalic
            });
          }
        }
      }
      const padding = BLOB_PADDING;
      textBounds[key].minX = Math.max(-cols, textBounds[key].minX - padding);
      textBounds[key].maxX = Math.min(cols * 2, textBounds[key].maxX + padding);
      textBounds[key].minY = Math.max(-virtualAreaHeight, textBounds[key].minY - padding);
      textBounds[key].maxY = Math.min(virtualAreaHeight * 2, textBounds[key].maxY + padding);
      
      // Mark this item as positioned
      positionedItems.add(index);
    };
    
    // Process all text items in order to handle anchoring
    textContent.forEach((_, index) => {
      processTextItem(index);
    });
    
    // Update link positions ref
    linkPositionsRef.current = links;
    setLinkPositions(links);
    
    // Log link positions for debugging
    if (links.length > 0) {
      console.log(`Found ${links.length} clickable links:`, links);
    }
    
    return { cache, grid: positionGrid, bounds: textBounds, links };
  }, [textContent, asciiArtCache, size, setLinkPositions, linkPositionsRef]);

  return textPositionCache;
}; 