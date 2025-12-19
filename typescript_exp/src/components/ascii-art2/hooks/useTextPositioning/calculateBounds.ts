import { renderFormattedText } from '../../ASCII_text_renderer';
import {
    TextPositionCache, 
    LinkPosition, 
    TextContentItem // Make sure this type is defined and imported correctly in types.ts
} from '../../types';
import { segmentGraphemeCells } from '../../utils';
import { BLOB_PADDING } from '../../constants';

const MAX_LAYOUT_ROWS = 20000;

// --- Extracted Function: Calculate Bounds and Links ---
export const calculateTextBoundsAndLinks = (
  index: number,
  textContent: TextContentItem[],
  namedTextboxes: Record<string, number>,
  positionedItems: Set<number>,
  cache: TextPositionCache,
  textBounds: {[key: string]: {minX: number, maxX: number, minY: number, maxY: number, fixed: boolean}},
  links: LinkPosition[],
  cols: number,
  rows: number
) => {
  if (positionedItems.has(index)) return;
      
  const textItem = textContent[index];
  
  // Handle anchor dependencies
  if (textItem.anchorTo) {
    const anchorIndex = namedTextboxes[textItem.anchorTo];
    if (anchorIndex !== undefined && !positionedItems.has(anchorIndex)) {
      // Recursive call for dependency - needs access to all parameters
      calculateTextBoundsAndLinks(anchorIndex, textContent, namedTextboxes, positionedItems, cache, textBounds, links, cols, rows); 
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
        case 'middleLeft': anchorX = textBounds[anchorKey].minX; anchorY = Math.floor((textBounds[anchorKey].minY + textBounds[anchorKey].maxY) / 2); break;
        case 'middleRight': anchorX = textBounds[anchorKey].maxX; anchorY = Math.floor((textBounds[anchorKey].minY + textBounds[anchorKey].maxY) / 2); break;
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
    for (const line of textLines) maxLineLength = Math.max(maxLineLength, segmentGraphemeCells(line).length);
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
    for (const line of textLines) maxLineLength = Math.max(maxLineLength, segmentGraphemeCells(line).length);
    maxLineLength = Math.min(maxLineLength, maxWidth);
    if (textItem.centered) {
      textBlockStartX = Math.floor(cols / 2) - Math.floor(maxLineLength / 2) + Math.floor((textItem.x / 100) * cols);
      gridX = textBlockStartX;
    }
  }
  if (!textLines || !textLines.length) return;

  // --- Calculate Links --- 
  for (const linkInfo of linkData) {
    const line = textLines[linkInfo.line] ?? '';
    const lineCells = segmentGraphemeCells(line);
    const actualLineLength = Math.min(lineCells.length, maxWidth);
    if (actualLineLength === 0) {
      continue;
    }

    const toCellIndex = (codeUnitIndex: number) => {
      if (codeUnitIndex <= 0) {
        return 0;
      }
      if (codeUnitIndex >= line.length) {
        return lineCells.length;
      }
      for (let i = 0; i < lineCells.length; i++) {
        const cell = lineCells[i];
        if (codeUnitIndex >= cell.start && codeUnitIndex < cell.end) {
          return i;
        }
      }
      return lineCells.length;
    };

    const linkStartCell = toCellIndex(linkInfo.start);
    const linkEndCellExclusive = Math.min(
      toCellIndex(Math.max(linkInfo.end - 1, linkInfo.start)) + 1,
      actualLineLength
    );
    if (linkStartCell >= linkEndCellExclusive) {
      continue;
    }

    const lineY = gridY + linkInfo.line;
    let textX = gridX;
    if (textItem.centered) {
      textX = textBlockStartX;
      if (textItem.alignment === 'center') textX = textBlockStartX + Math.floor((maxLineLength - actualLineLength) / 2);
      else if (textItem.alignment === 'right') textX = textBlockStartX + (maxLineLength - actualLineLength);
    } else if (textItem.alignment) {
      if (textItem.alignment === 'center') textX = Math.floor(gridX + (maxWidth - actualLineLength) / 2);
      else if (textItem.alignment === 'right') textX = gridX + maxWidth - actualLineLength;
    }
    links.push({
      textKey: key,
      url: linkInfo.url,
      startX: textX + linkStartCell,
      endX: textX + linkEndCellExclusive - 1,
      y: lineY
    });
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
    const lineText = finalLines[lineIndex];
    if (!lineText) continue;

    const lineCells = segmentGraphemeCells(lineText);
    const cellsToRender = !textItem.preRenderedAscii && lineCells.length > maxWidth
      ? lineCells.slice(0, maxWidth)
      : lineCells;

    const lineY = gridY + lineIndex;
    let textX = gridX;
    const actualLineLength = cellsToRender.length;
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
    
    for (let cellIndex = 0; cellIndex < cellsToRender.length; cellIndex++) {
      const x = textX + cellIndex;
      if (x < -cols || x > cols * 2) continue; // Check horizontal bounds
      const char = cellsToRender[cellIndex].cell;
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
  // Avoid viewport-relative clamps so long pages can scroll fully; keep a generous sanity cap.
  textBounds[key].minY = Math.max(-MAX_LAYOUT_ROWS, textBounds[key].minY - padding);
  textBounds[key].maxY = Math.min(MAX_LAYOUT_ROWS, textBounds[key].maxY + padding);

  positionedItems.add(index);
}; 
