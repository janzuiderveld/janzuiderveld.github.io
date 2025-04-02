/**
 * ASCII Art Text Renderer
 * Renders text as ASCII art with intelligent letter overlapping
 */

// Import font definitions from separate file
import { asciiChars, smallAsciiChars } from './asciiFonts';

// ADDED/MODIFIED: FontName type to include all supported fonts
export type FontName = 'regular' | 'ascii' | 'smallAscii';

/**
 * Interface for text style data
 */
interface StyleData {
  start: number;
  end: number;
  isBold: boolean;
}

/**
 * Interface for line style data
 */
interface LineStyleData {
  start: number;
  end: number;
  isBold: boolean;
}

/**
 * Interface for render options
 */
interface RenderOptions {
  maxWidth?: number;
  respectLineBreaks?: boolean;
  fontName?: FontName;
}

/**
 * Interface for link position
 */
interface LinkPosition {
  textKey: string;
  url: string;
  startX: number;
  endX: number;
  y: number;
}

/**
 * Interface for a styled text segment
 */
interface TextSegment {
  text: string;
  isBold?: boolean;
  isItalic?: boolean;
  isLink?: boolean;
  url?: string;
  color?: string;
  start: number;
  end: number;
}

/**
 * Parse text for style markers and return segments
 */
function parseTextForStyles(text: string): TextSegment[] {
  if (!text) return [];
  
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  
  // Regular expressions for style markers
  const boldRegex = /==(.*?)==/g;
  const italicRegex = /\/\/(.*?)\/\//g;
  const linkRegex = /\[(.*?)\]\((.*?)\)/g;
  const redTextRegex = /&&(.*?)&&/g;
  
  // Process the text in order by finding the next style marker
  let nextBold = boldRegex.exec(text);
  let nextItalic = italicRegex.exec(text);
  let nextLink = linkRegex.exec(text);
  let nextRed = redTextRegex.exec(text);
  
  while (nextBold || nextItalic || nextLink || nextRed) {
    // Find the earliest marker
    let nextMatch: RegExpExecArray | null = null;
    let matchType = '';
    
    const getIndex = (match: RegExpExecArray | null): number => match ? match.index : Infinity;
    
    if (nextBold && (!nextMatch || getIndex(nextBold) < getIndex(nextMatch))) {
      nextMatch = nextBold;
      matchType = 'bold';
    }
    
    if (nextItalic && (!nextMatch || getIndex(nextItalic) < getIndex(nextMatch))) {
      nextMatch = nextItalic;
      matchType = 'italic';
    }
    
    if (nextLink && (!nextMatch || getIndex(nextLink) < getIndex(nextMatch))) {
      nextMatch = nextLink;
      matchType = 'link';
    }
    
    if (nextRed && (!nextMatch || getIndex(nextRed) < getIndex(nextMatch))) {
      nextMatch = nextRed;
      matchType = 'red';
    }
    
    if (!nextMatch) break;
    
    // Add regular text before this marker
    if (nextMatch.index > lastIndex) {
      segments.push({
        text: text.substring(lastIndex, nextMatch.index),
        start: lastIndex,
        end: nextMatch.index
      });
    }
    
    // Process based on marker type
    if (matchType === 'bold') {
      segments.push({
        text: nextMatch[1],
        isBold: true,
        start: nextMatch.index,
        end: nextMatch.index + nextMatch[0].length
      });
      lastIndex = nextMatch.index + nextMatch[0].length;
      nextBold = boldRegex.exec(text);
    } else if (matchType === 'italic') {
      segments.push({
        text: nextMatch[1],
        isItalic: true,
        start: nextMatch.index,
        end: nextMatch.index + nextMatch[0].length
      });
      lastIndex = nextMatch.index + nextMatch[0].length;
      nextItalic = italicRegex.exec(text);
    } else if (matchType === 'link') {
      segments.push({
        text: nextMatch[1],
        isLink: true,
        url: nextMatch[2],
        start: nextMatch.index,
        end: nextMatch.index + nextMatch[0].length
      });
      lastIndex = nextMatch.index + nextMatch[0].length;
      nextLink = linkRegex.exec(text);
    } else if (matchType === 'red') {
      segments.push({
        text: nextMatch[1],
        color: '#FF0000',
        start: nextMatch.index,
        end: nextMatch.index + nextMatch[0].length
      });
      lastIndex = nextMatch.index + nextMatch[0].length;
      nextRed = redTextRegex.exec(text);
    }
  }
  
  // Add any remaining text
  if (lastIndex < text.length) {
    segments.push({
      text: text.substring(lastIndex),
      start: lastIndex,
      end: text.length
    });
  }
  
  return segments;
}

/**
 * Render a line with styles
 */
function renderLine(line: string, styles: LineStyleData[], fontName: FontName = 'regular'): string {
  let result = line;
  
  // Apply styles in reverse order to handle overlapping
  for (let i = styles.length - 1; i >= 0; i--) {
    const style = styles[i];
    if (style.isBold) {
      // For bold text, we'll use ASCII art characters
      const before = result.substring(0, style.start);
      const boldText = result.substring(style.start, style.end)
        .split('')
        .map(c => {
          const fontSet = fontName === 'smallAscii' ? smallAsciiChars : asciiChars;
          return fontSet[c]?.[0] || c;
        })
        .join('');
      const after = result.substring(style.end);
      result = before + boldText + after;
    }
  }
  
  return result;
}

/**
 * Adjust styles for whitespace
 */
function adjustStylesForWhitespace(lines: string[], styles: StyleData[]): void {
  let currentOffset = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLength = line.length;
    
    // Adjust styles for this line
    for (const style of styles) {
      if (style.start >= currentOffset && style.start < currentOffset + lineLength) {
        // Style starts in this line
        style.start = style.start - currentOffset;
        if (style.end > currentOffset + lineLength) {
          // Style continues to next line
          style.end = lineLength;
        } else {
          // Style ends in this line
          style.end = style.end - currentOffset;
        }
      }
    }
    
    currentOffset += lineLength;
  }
}

/**
 * Wrap text to a maximum width
 */
function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    if ((currentLine + ' ' + word).length <= maxWidth) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);

  return lines;
}

export function renderTextWithStyles(text: string, options: RenderOptions): { lines: string[], styleData: StyleData[], linkPositions: LinkPosition[] } {
  // Use options for text wrapping if provided
  const maxWidth = options.maxWidth;
  const respectLineBreaks = options.respectLineBreaks ?? true;
  const fontName = options.fontName ?? 'regular';

  // Split text into lines, respecting line breaks if specified
  const lines = respectLineBreaks ? text.split('\n') : [text];
  const renderedLines: string[] = [];
  const finalStyleData: StyleData[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Apply text wrapping if maxWidth is specified
    const wrappedLines = maxWidth ? wrapText(line, maxWidth) : [line];
    
    for (const wrappedLine of wrappedLines) {
      const segmentStyles = parseTextForStyles(wrappedLine);

      // Store style information for this line
      const styleDataForLine: StyleData[] = [];
      let currentStyle: StyleData | undefined;

      for (const segment of segmentStyles) {
        if (segment.isBold) {
          const styleEntry = styleDataForLine.find(s => s.start === segment.start && s.end === segment.end);
          if (styleEntry) {
            if (currentStyle) {
              styleDataForLine.push(currentStyle);
            }
            currentStyle = { start: segment.start, end: segment.end, isBold: true };
          } else {
            if (currentStyle) {
              styleDataForLine.push(currentStyle);
            }
            currentStyle = { start: segment.start, end: segment.end, isBold: false };
          }
        } else {
          if (currentStyle) {
            styleDataForLine.push(currentStyle);
          }
          currentStyle = undefined;
        }
      }

      if (currentStyle) {
        styleDataForLine.push(currentStyle);
      }

      const lineStyleData: LineStyleData[] = [];
      for (const style of styleDataForLine) {
        const lineStyle: LineStyleData = {
          start: style.start,
          end: style.end,
          isBold: style.isBold
        };
        lineStyleData.push(lineStyle);
      }

      const renderedLine = renderLine(wrappedLine, lineStyleData, fontName);
      renderedLines.push(renderedLine);

      // Store style information for this line
      for (const style of styleDataForLine) {
        const styleData: StyleData = {
          start: style.start,
          end: style.end,
          isBold: style.isBold
        };
        finalStyleData.push(styleData);
      }
    }
  }

  adjustStylesForWhitespace(renderedLines, finalStyleData);

  return {
    lines: renderedLines,
    styleData: finalStyleData,
    linkPositions: []
  };
} 