import { BLOB_PADDING } from '../../constants';
import { TextContentItem, NamedTextboxes, LinkData } from './types';
import { TextBounds, LinkPosition } from '../../types';

export interface TextLine {
  content: string;
  alignment?: 'left' | 'center' | 'right';
}

export interface PositioningContext {
  gridX: number;
  gridY: number;
  textLines: TextLine[];
  maxLineLength: number;
  textBlockStartX: number;
  fontName: string;
  fixed: boolean;
}

// Calculate the position for a text item
export const calculatePosition = (
  textItem: TextContentItem, 
  namedTextboxes: NamedTextboxes,
  cols: number,
  rows: number,
  textBounds: {[key: string]: TextBounds},
  
): { gridX: number; gridY: number; textBlockStartX: number } => {
  let gridX = textItem.x;
  let gridY = textItem.y;
  let textBlockStartX = gridX;
  
  // Handle anchor dependencies (position relative to another text box)
  if (textItem.anchorTo && namedTextboxes[textItem.anchorTo] !== undefined) {
    const anchorKey = getTextItemKey(textItem.anchorTo, textItem.text, textItem.x, textItem.y);
    
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
        case 'middleLeft': anchorX = textBounds[anchorKey].minX; anchorY = Math.floor((textBounds[anchorKey].minY + textBounds[anchorKey].maxY) / 2); break;
        case 'middleRight': anchorX = textBounds[anchorKey].maxX; anchorY = Math.floor((textBounds[anchorKey].minY + textBounds[anchorKey].maxY) / 2); break;
      }
      gridX = anchorX + (textItem.anchorOffsetX || 0);
      gridY = anchorY + (textItem.anchorOffsetY || 0);
      textBlockStartX = gridX;
    }
  } 
  // Handle percentage positioning
  else if (textItem.usePercentPosition !== false) {
    gridX = Math.floor((textItem.x / 100) * cols);
    gridY = Math.floor((textItem.y / 100) * rows);
    textBlockStartX = gridX;
  }
  
  // Handle centered positioning
  if (textItem.centered) {
    const horizontalCenter = Math.floor(cols / 2);
    gridX = horizontalCenter + Math.floor((textItem.x / 100) * cols);
    textBlockStartX = gridX;
  }
  
  return { gridX, gridY, textBlockStartX };
};

// Calculate the text alignment for a given line
export const calculateTextAlignment = (
  context: PositioningContext,
  lineIndex: number,
  actualLineLength: number
): number => {
  const { gridX, textBlockStartX, textLines, maxLineLength } = context;
  
  // Calculate horizontal alignment based on settings
  if (!textLines[lineIndex]) return gridX;
  
  // For centered text box
  if (context.textBlockStartX !== context.gridX) {
    if (textLines[lineIndex].alignment === 'center') {
      return textBlockStartX + Math.floor((maxLineLength - actualLineLength) / 2);
    } else if (textLines[lineIndex].alignment === 'right') {
      return textBlockStartX + (maxLineLength - actualLineLength);
    }
    return textBlockStartX;
  } 
  // For non-centered text box with alignment
  else if (textLines[lineIndex].alignment) {
    if (textLines[lineIndex].alignment === 'center') {
      return Math.floor(gridX + (maxLineLength - actualLineLength) / 2);
    } else if (textLines[lineIndex].alignment === 'right') {
      return gridX + maxLineLength - actualLineLength;
    }
  }
  
  // Default alignment (left)
  return gridX;
};

// Calculate links positions for a text item
export const calculateLinks = (
  textKey: string,
  context: PositioningContext,
  linkData: LinkData[]
): LinkPosition[] => {
  const links: LinkPosition[] = [];
  const { gridX, gridY, textBlockStartX, textLines, maxLineLength } = context;
  
  for (const linkInfo of linkData) {
    const lineY = gridY + linkInfo.line;
    let textX = gridX;
    
    // Get the actual line length, respecting maxWidth
    const actualLineLength = textLines[linkInfo.line] 
      ? Math.min(textLines[linkInfo.line].content.length, maxLineLength) 
      : 0;
    
    // Calculate position based on alignment
    if (textBlockStartX !== gridX) {
      // Centered text box
      textX = textBlockStartX;
      if (textLines[linkInfo.line]?.alignment === 'center') {
        textX = textBlockStartX + Math.floor((maxLineLength - actualLineLength) / 2);
      } else if (textLines[linkInfo.line]?.alignment === 'right') {
        textX = textBlockStartX + (maxLineLength - actualLineLength);
      }
    } else if (textLines[linkInfo.line]?.alignment) {
      // Text with alignment but not centered box
      if (textLines[linkInfo.line].alignment === 'center') {
        textX = Math.floor(gridX + (maxLineLength - actualLineLength) / 2);
      } else if (textLines[linkInfo.line].alignment === 'right') {
        textX = gridX + maxLineLength - actualLineLength;
      }
    }
    
    links.push({ 
      textKey, 
      url: linkInfo.url, 
      startX: textX + linkInfo.start, 
      endX: textX + linkInfo.end - 1, 
      y: lineY 
    });
  }
  
  return links;
};

// Calculate text bounds for a text item
export const calculateTextBounds = (
  context: PositioningContext,
  lines: string[]
): TextBounds => {
  const { gridY, fixed } = context;
  
  const bounds: TextBounds = { 
    minX: Infinity, 
    maxX: -Infinity, 
    minY: Infinity, 
    maxY: -Infinity,
    fixed
  };
  
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    if (!line) continue;
    
    const lineY = gridY + lineIndex;
    bounds.minY = Math.min(bounds.minY, lineY);
    bounds.maxY = Math.max(bounds.maxY, lineY);
    
    let textX = calculateTextAlignment(
      context, 
      lineIndex, 
      line.length
    );
    
    for (let charIndex = 0; charIndex < line.length; charIndex++) {
      const x = textX + charIndex;
      const char = line[charIndex];
      
      if (char && char !== ' ') {
        bounds.minX = Math.min(bounds.minX, x);
        bounds.maxX = Math.max(bounds.maxX, x);
      }
    }
  }
  
  // Add padding to the bounds
  const padding = BLOB_PADDING;
  bounds.minX = Math.max(-1000, bounds.minX - padding);
  bounds.maxX = Math.min(1000, bounds.maxX + padding);
  bounds.minY = Math.max(-2000, bounds.minY - padding);
  bounds.maxY = Math.min(3000, bounds.maxY + padding);
  
  return bounds;
};

// Helper to get a unique key for a text item
export const getTextItemKey = (
  name: string | undefined,
  text: string,
  x: number,
  y: number
): string => {
  return name 
    ? `${name}-${text}` 
    : `${text}-${x}-${y}`;
}; 