import { renderFormattedText } from '../../ASCII_text_renderer';
import { 
    TextGridCell, 
    TextContentItem 
} from '../../types';
import { segmentGraphemeCells } from '../../utils';

// --- Extracted Function: Populate Grid ---
export const populateTextGrid = (
  index: number,
  textContent: TextContentItem[],
  namedTextboxes: Record<string, number>,
  positionedItems: Set<number>,
  textBounds: {[key: string]: {minX: number, maxX: number, minY: number, maxY: number, fixed: boolean}},
  positionGridArray: (TextGridCell | null)[],
  cols: number,
  rows: number,
  gridCols: number,
  gridRows: number,
  offsetY: number
) => {
  if (positionedItems.has(index)) return;
  const textItem = textContent[index];
  if (textItem.anchorTo) {
    const anchorIndex = namedTextboxes[textItem.anchorTo];
    if (anchorIndex !== undefined && !positionedItems.has(anchorIndex)) {
       // Recursive call - needs access to all parameters
       populateTextGrid(anchorIndex, textContent, namedTextboxes, positionedItems, textBounds, positionGridArray, cols, rows, gridCols, gridRows, offsetY);
    }
  }

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
        case 'topCenter': anchorX = Math.floor((textBounds[anchorKey].minX + textBounds[anchorKey].maxX) / 2); anchorY = textBounds[anchorKey].minY; break;
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
  
  // Recalculate Centering
  if (textItem.centered) {
    const horizontalCenter = Math.floor(cols / 2);
    gridX = horizontalCenter + Math.floor((textItem.x / 100) * cols);
  }

  // Rerender Text / Get Lines & Styles
  const fontName = textItem.fontName || 'regular';
  let formattedResult: { text: string; html: string; links: Array<{line: number, start: number, end: number, url: string}>; styles: Array<{line: number, start: number, end: number, style: {isBold?: boolean, isItalic?: boolean, isLink?: boolean, url?: string, color?: string}}> } | null = null; // Define formattedResult here

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
    // Calculate formattedResult here for non-preRendered text
    formattedResult = renderFormattedText(
      textItem.text,
      fontName,
      { maxWidth, respectLineBreaks: true }
    );
    textLines = formattedResult.text.split('\n');
    maxLineLength = 0;
    for (const line of textLines) maxLineLength = Math.max(maxLineLength, segmentGraphemeCells(line).length);
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
    const lineText = finalLines[lineIndex];
    if (!lineText) continue;

    const lineCells = segmentGraphemeCells(lineText);
    const cellsToRender = !textItem.preRenderedAscii && lineCells.length > maxWidth
      ? lineCells.slice(0, maxWidth)
      : lineCells;

    const lineY = gridY + lineIndex;
    let textX = gridX;
    const actualLineLength = cellsToRender.length;

    // Recalculate textX based on alignment/centering as before
    if (textItem.centered) {
      textX = textBlockStartX;
      if (textItem.alignment === 'center') textX = textBlockStartX + Math.floor((maxLineLength - actualLineLength) / 2);
      else if (textItem.alignment === 'right') textX = textBlockStartX + (maxLineLength - actualLineLength);
    } else if (textItem.alignment) {
      if (textItem.alignment === 'center') textX = Math.floor(gridX + (maxWidth - actualLineLength) / 2);
      else if (textItem.alignment === 'right') textX = gridX + maxWidth - actualLineLength;
    }
    
    for (let cellIndex = 0; cellIndex < cellsToRender.length; cellIndex++) {
      const x = textX + cellIndex;
      const cell = cellsToRender[cellIndex];
      const char = cell.cell;
      if (char && char !== ' ') {
        // *** Populate the flat array ***
        const arrayIndex = (lineY - offsetY) * gridCols + x;
        // Check bounds before writing
        if (x >= 0 && x < gridCols && lineY >= offsetY && lineY < offsetY + gridRows) {
           if (arrayIndex >= 0 && arrayIndex < positionGridArray.length) { // Double check index
             // --- MODIFIED: Retrieve and store isBold/isItalic ---
             let isBold = false;
             let isItalic = false;
             // Check styles only if formattedResult exists (i.e., not preRenderedAscii)
             if (formattedResult) {
               for (const styleInfo of formattedResult.styles) {
                 if (styleInfo.line === lineIndex && cell.start < styleInfo.end && cell.end > styleInfo.start) {
                   isBold = !!styleInfo.style.isBold;
                   isItalic = !!styleInfo.style.isItalic;
                   break; // Found the style for this character
                 }
               }
             }
             // Store char, fixed, and the determined styles
             positionGridArray[arrayIndex] = { char, fixed: isFixed, isBold, isItalic };
             // --- END MODIFICATION ---
           }
        }
      }
    }
  }
  positionedItems.add(index);
}; 
