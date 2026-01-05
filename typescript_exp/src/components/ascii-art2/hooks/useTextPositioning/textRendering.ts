import { renderTextString, renderFormattedText } from '../../ASCII_text_renderer';
import { TextContentItem, LinkData } from './types';

export interface RenderTextResult {
  textLines: string[];
  linkData: LinkData[];
  maxLineLength: number;
}

export const renderText = (
  textItem: TextContentItem,
  maxWidth: number
): RenderTextResult => {
  let textLines: string[] = [];
  let linkData: LinkData[] = [];
  let maxLineLength = 0;

  // Handle pre-rendered ASCII content
  if (textItem.preRenderedAscii) {
    textLines = textItem.preRenderedAscii.split('\n');
    for (const line of textLines) {
      maxLineLength = Math.max(maxLineLength, line.length);
    }
    return { textLines, linkData: [], maxLineLength };
  }

  // Render text based on font
  const fontName = textItem.fontName || 'regular';
  if (fontName !== 'regular') {
    // Render special font
    textLines = renderTextString(
      textItem.text,
      fontName,
      { maxWidth, respectLineBreaks: true }
    ).split('\n');
    for (const line of textLines) {
      maxLineLength = Math.max(maxLineLength, line.length);
    }
  } else {
    // Render regular text with formatting and links
    const formattedResult = renderFormattedText(
      textItem.text, 
      fontName, 
      { 
        maxWidth: maxWidth, 
        respectLineBreaks: true 
      }
    );
    textLines = formattedResult.text.split('\n');
    linkData = formattedResult.links;
    
    for (const line of textLines) {
      maxLineLength = Math.max(maxLineLength, line.length);
    }
  }
  
  maxLineLength = Math.min(maxLineLength, maxWidth);
  
  return { 
    textLines, 
    linkData, 
    maxLineLength 
  };
};

export const preprocessLines = (
  textLines: string[],
  fontName?: string
): string[] => {
  // For regular text, add empty lines after non-empty lines
  // This creates visual spacing between paragraphs
  if (fontName === 'regular' || !fontName) {
    const finalLines: string[] = [];
    for (let i = 0; i < textLines.length; i++) {
      const line = textLines[i];
      finalLines.push(line);
      if (line.trim() !== '' || i === textLines.length - 1) {
        finalLines.push('');
      }
    }
    return finalLines;
  }
  
  // For special fonts, just return the lines as-is
  return textLines;
};

export const buildAsciiArtCache = (
  textContent: TextContentItem[]
): Record<string, string[]> => {
  const cache: Record<string, string[]> = {};
  
  textContent.forEach(item => {
    if (item.text) {
      const fontName = item.fontName || 'regular';
      if (fontName !== 'regular') {
        const asciiArt = renderTextString(item.text, fontName).split('\n');
        cache[item.text] = asciiArt;
      }
    }
    if (item.preRenderedAscii) {
      const asciiArt = item.preRenderedAscii.split('\n');
      cache[item.text] = asciiArt;
    }
  });
  
  return cache;
}; 
