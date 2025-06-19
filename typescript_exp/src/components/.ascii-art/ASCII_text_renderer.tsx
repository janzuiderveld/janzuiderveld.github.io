/**
 * ASCII Art Text Renderer
 * Renders text as ASCII art with intelligent letter overlapping
 */

// Import font definitions from separate file
import { asciiChars, smallAsciiChars } from '../asciiFonts';

// ADDED/MODIFIED: FontName type to include all supported fonts
export type FontName = 'regular' | 'ascii' | 'smallAscii';

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
}

/**
 * Parse text with style markers and convert to styled segments
 * Supports:
 * - **bold**
 * - //italic// (changed from _italic_)
 * - [link text](url)
 * - &&red text&& (added support for red text)
 */
export function parseTextWithStyles(text: string): TextSegment[] {
  if (!text) return [];
  
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  
  // Regular expressions for style markers
  const boldRegex = /\*\*(.*?)\*\*/g;
  const italicRegex = /\/\/(.*?)\/\//g;  // Double slash for italic
  const linkRegex = /\[(.*?)\]\((.*?)\)/g;
  const redTextRegex = /&&(.*?)&&/g;  // Add regex for text between && markers
  
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
        text: text.substring(lastIndex, nextMatch.index)
      });
    }
    
    // Process based on marker type
    if (matchType === 'bold') {
      segments.push({
        text: nextMatch[1],
        isBold: true
      });
      lastIndex = nextMatch.index + nextMatch[0].length;
      nextBold = boldRegex.exec(text);
    } else if (matchType === 'italic') {
      segments.push({
        text: nextMatch[1],
        isItalic: true
      });
      lastIndex = nextMatch.index + nextMatch[0].length;
      nextItalic = italicRegex.exec(text);
    } else if (matchType === 'link') {
      segments.push({
        text: nextMatch[1],
        isLink: true,
        url: nextMatch[2]
      });
      lastIndex = nextMatch.index + nextMatch[0].length;
      nextLink = linkRegex.exec(text);
    } else if (matchType === 'red') {
      segments.push({
        text: nextMatch[1],
        color: '#FF0000'  // Explicitly set to standard red color
      });
      lastIndex = nextMatch.index + nextMatch[0].length;
      nextRed = redTextRegex.exec(text);
    }
  }
  
  // Add any remaining text
  if (lastIndex < text.length) {
    segments.push({
      text: text.substring(lastIndex)
    });
  }
  
  console.log("Parsed segments:", segments);
  
  return segments;
}

// Add a type for text styles including color
interface TextStyle {
  isBold?: boolean;
  isItalic?: boolean;
  isLink?: boolean;
  url?: string;
  color?: string; // Add color field
}

/**
 * Wraps text at a specified maximum width, breaking only at spaces
 * @param text The text to wrap
 * @param maxWidth Maximum width for each line
 * @returns Array of wrapped lines
 */
function wrapText(text: string, maxWidth: number = 80): string[] {
  // If no maxWidth provided or invalid, return text split by newlines
  if (!maxWidth || maxWidth <= 0) {
    return text.split('\n');
  }

  const lines: string[] = [];
  const paragraphs = text.split('\n');

  // Process each paragraph
  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxWidth) {
      lines.push(paragraph);
      continue;
    }

    let line = '';
    const words = paragraph.split(' ');

    // Process each word
    for (const word of words) {
      // If adding this word would exceed maxWidth
      if (line.length + word.length + 1 > maxWidth && line.length > 0) {
        lines.push(line); // Push current line
        line = word; // Start new line with current word
      } else {
        // Add word to current line with a space if not first word
        line = line.length === 0 ? word : `${line} ${word}`;
      }
    }

    // Add the last line if not empty
    if (line.length > 0) {
      lines.push(line);
    }
  }

  return lines;
}

/**
 * Renders text with styles and applies formatting
 * @param text The text to render with style markers (bold, italic, links)
 * @param fontName The font to use: 'regular', 'ascii', or 'smallAscii'
 * @param maxWidth Optional maximum width for text wrapping (regular font only)
 * @returns An array of styled text lines with metadata
 */
export function renderText(
  text: string, 
  fontName: FontName = 'regular', 
  maxWidth?: number
): Array<{
  html?: string, // Add html property for regular text
  line?: string, 
  links: Array<{start: number, end: number, url: string}>,
  styles: Array<{start: number, end: number, style: TextStyle}>
}> {
  if (!text || text.length === 0) {
    return [{html: '', links: [], styles: []}];
  }
  
  // For regular text, simply format it with style markers
  if (fontName === 'regular') {
    // First split by explicit newlines for paragraph handling
    const paragraphs = text.split('\n');
    const result: Array<{
      html?: string,
      line?: string,
      links: Array<{start: number, end: number, url: string}>,
      styles: Array<{start: number, end: number, style: TextStyle}>
    }> = [];
    
    // Process each paragraph
    for (const paragraph of paragraphs) {
      // Apply text wrapping if maxWidth is provided, otherwise keep as is
      const wrappedLines = maxWidth && maxWidth > 0 
        ? wrapText(paragraph, maxWidth) 
        : [paragraph];
      
      // Process each line
      for (const lineText of wrappedLines) {
        const lineSegments = parseTextWithStyles(lineText);
        let formattedLine = '';
        let htmlLine = '';
        const lineLinks: Array<{start: number, end: number, url: string}> = [];
        const lineStyles: Array<{start: number, end: number, style: TextStyle}> = [];
        let currentPos = 0;
        
        // Apply formatting based on segment styles
        for (const segment of lineSegments) {
          const startPos = currentPos;
          const formattedSegment = segment.text;
          
          // Generate HTML with inline styles
          let segmentHtml = segment.text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
          
          // Apply styles using inline CSS
          const cssStyles: string[] = [];
          if (segment.isBold) cssStyles.push('font-weight: bold');
          if (segment.isItalic) cssStyles.push('font-style: italic');
          if (segment.color) cssStyles.push(`color: ${segment.color}`);
          if (segment.isLink) cssStyles.push('color: #3498db; text-decoration: underline; cursor: pointer');
          
          if (cssStyles.length > 0 && !segment.isLink) {
            segmentHtml = `<span style="${cssStyles.join('; ')}">${segmentHtml}</span>`;
          }
          
          // Make links clickable
          if (segment.isLink && segment.url) {
            segmentHtml = `<a href="${segment.url}" 
              style="${cssStyles.join('; ')}" 
              data-link-url="${segment.url}" 
              class="ascii-link" 
              target="_blank" 
              rel="noopener noreferrer" 
              onclick="event.stopPropagation(); window.open('${segment.url}', '_blank', 'noopener,noreferrer'); return false;">${segmentHtml}</a>`;
          } else if (segment.isLink) {
            segmentHtml = `<span style="color: #3498db; cursor: pointer;">${segmentHtml}</span>`;
          }
          
          // Track style positions for all styles including color
          if (segment.isBold || segment.isItalic || segment.isLink || segment.color) {
            lineStyles.push({
              start: startPos,
              end: startPos + formattedSegment.length,
              style: {
                isBold: segment.isBold,
                isItalic: segment.isItalic,
                isLink: segment.isLink,
                url: segment.url,
                color: segment.color || (segment.isLink ? '#3498db' : undefined)
              }
            });
          }
          
          // Track link positions if this is a link
          if (segment.isLink && segment.url) {
            lineLinks.push({
              start: startPos,
              end: startPos + formattedSegment.length,
              url: segment.url
            });
          }
          
          formattedLine += formattedSegment;
          htmlLine += segmentHtml;
          currentPos += formattedSegment.length;
        }
        
        result.push({
          html: htmlLine,
          line: formattedLine,
          links: lineLinks,
          styles: lineStyles
        });
      }
    }
    
    return result;
  }
  
  // For ASCII art text, render the text as ASCII art
  const useSmallFont = fontName === 'smallAscii';
  // Parse text into segments first
  const segments = parseTextWithStyles(text);
  
  // Create a map of character positions to their styles
  const styleMap: Record<number, TextStyle> = {};
  let position = 0;
  
  segments.forEach(segment => {
    for (let i = 0; i < segment.text.length; i++) {
      styleMap[position + i] = {
        isBold: segment.isBold,
        isItalic: segment.isItalic,
        isLink: segment.isLink,
        url: segment.url,
        // Use more prominent colors
        color: segment.isLink ? '#3498db' : undefined // Blue for links
      };
    }
    position += segment.text.length;
  });
  
  const plainText = segments.map(s => s.text).join('');
  const asciiLines = renderAsciiArt(plainText, useSmallFont);
  
  // Apply styles to ASCII art
  const styledAsciiLines: string[] = [];
  const linkRanges: Array<{start: number, end: number, url: string}> = [];
  const styleRanges: Array<{start: number, end: number, style: TextStyle}> = [];
  
  // For ASCII art we'll transform the ASCII characters based on style
  for (let line of asciiLines) {
    let styledLine = '';
    let lastCharEnd = 0;
    
    // For links and styles, track the ranges
    let currentLinkStart = -1;
    let currentStyleStart = -1;
    let currentStyle: TextStyle | null = null;
    let currentUrl = '';
    
    for (let i = 0; i < plainText.length; i++) {
      const style = styleMap[i];
      if (!style) continue;
      
      // Find the next character's position in the ASCII art
      const charWidth = getAsciiCharWidth(plainText[i], useSmallFont);
      const charStart = lastCharEnd;
      const charEnd = charStart + charWidth;
      
      // Extract this character's ASCII representation in this line
      let charSection = line.substring(charStart, charEnd);
      
      // Apply styles
      if (style.isBold) {
        // For bold, replace ASCII characters with thicker versions
        charSection = makeAsciiBold(charSection);
      }
      
      if (style.isItalic) {
        // For italic, shift characters slightly to the right to create slant effect
        charSection = makeAsciiItalic(charSection);
      }
      
      // Track style ranges (for color and other styles)
      if (style.color || style.isBold || style.isItalic || style.isLink) {
        if (currentStyleStart === -1 || JSON.stringify(currentStyle) !== JSON.stringify(style)) {
          // End previous style range if exists
          if (currentStyleStart !== -1) {
            styleRanges.push({
              start: currentStyleStart,
              end: styledLine.length,
              style: currentStyle!
            });
          }
          // Start new style range
          currentStyleStart = styledLine.length;
          currentStyle = {...style};
        }
      } else if (currentStyleStart !== -1) {
        // End of style
        styleRanges.push({
          start: currentStyleStart,
          end: styledLine.length,
          style: currentStyle!
        });
        currentStyleStart = -1;
        currentStyle = null;
      }
      
      // Track link ranges
      if (style.isLink) {
        if (currentLinkStart === -1) {
          currentLinkStart = styledLine.length;
          currentUrl = style.url || '';
        }
      } else if (currentLinkStart !== -1) {
        // End of link
        linkRanges.push({
          start: currentLinkStart,
          end: styledLine.length,
          url: currentUrl
        });
        currentLinkStart = -1;
      }
      
      styledLine += charSection;
      lastCharEnd = charEnd;
    }
    
    // Close any open style at the end of line
    if (currentStyleStart !== -1) {
      styleRanges.push({
        start: currentStyleStart,
        end: styledLine.length,
        style: currentStyle!
      });
    }
    
    // Close any open link at the end of line
    if (currentLinkStart !== -1) {
      linkRanges.push({
        start: currentLinkStart,
        end: styledLine.length,
        url: currentUrl
      });
    }
    
    styledAsciiLines.push(styledLine);
  }
  
  // Return the styled ASCII art with style and link metadata
  return styledAsciiLines.map(line => ({
    line,
    links: linkRanges,
    styles: styleRanges
  }));
}

/**
 * Get the width of an ASCII character in the specified font
 */
function getAsciiCharWidth(char: string, useSmallFont: boolean): number {
  const fontSet = useSmallFont ? smallAsciiChars : asciiChars;
  const charArt = fontSet[char] || fontSet[' '];
  return charArt[0]?.length || 0;
}

/**
 * Make ASCII characters look bold by replacing them with thicker versions
 */
function makeAsciiBold(text: string): string {
  return text
    .replace(/\//g, '#')
    .replace(/\\/g, '#')
    .replace(/\|/g, '#')
    .replace(/_/g, '=')
    .replace(/\-/g, '=')
    .replace(/\./g, '*')
    .replace(/`/g, '*');
}

/**
 * Make ASCII characters look italic by shifting them slightly
 */
function makeAsciiItalic(text: string): string {
  // Add a space at the beginning to create slight shift
  return ' ' + text.substring(0, text.length - 1);
}

/**
 * Renders text with styles as a string
 * @param text The text to render
 * @param fontName The font to use: 'regular', 'ascii', or 'smallAscii'
 * @param maxWidth Optional maximum width for text wrapping (regular font only)
 * @returns A rendered string with style information
 */
export function renderTextString(
  text: string, 
  fontName: FontName = 'regular',
  maxWidth?: number
): string {
  const renderedLines = renderText(text, fontName, maxWidth);
  return renderedLines.map(l => l.line).join('\n');
}

/**
 * Renders text as ASCII art
 * @param text The text to render
 * @param useSmallFont Whether to use the smaller 4-line font (default: false)
 * @returns An array of strings representing the ASCII art
 */
function renderAsciiArt(text: string, useSmallFont: boolean = false): string[] {
  if (!text || text.length === 0) {
    return [''];
  }
  
  // Select the font to use
  const fontSet = useSmallFont ? smallAsciiChars : asciiChars;
  
  // For normal text that uses small font, just return the text itself
  // Only convert single words or titles to ASCII art
  if (text.includes(' ') && !text.startsWith('#') && useSmallFont) {
    return text.split('\n');
  }
  
  // Get the first character's ASCII art
  const firstChar = text[0];
  let result = [...(fontSet[firstChar] || fontSet[' '])];
  
  // Process the rest of the characters
  for (let i = 1; i < text.length; i++) {
    const char = text[i];
    const charArt = fontSet[char] || fontSet[' '];
    
    // Ensure the character art has the same height as our result
    const paddedCharArt = [...charArt];
    while (paddedCharArt.length < result.length) {
      paddedCharArt.push(' '.repeat(paddedCharArt[0]?.length || 0));
    }
    
    // Ensure result has consistent height
    while (result.length < paddedCharArt.length) {
      result.push(' '.repeat(result[0]?.length || 0));
    }
    
    // Add the character without any overlap
    for (let row = 0; row < result.length; row++) {
      if (row < paddedCharArt.length) {
        result[row] += paddedCharArt[row];
      }
    }
  }
  
  return result;
}

/**
 * Renders text as ASCII art and returns it as a single string
 * @param text The text to render
 * @param useSmallFont Whether to use the smaller 4-line font (default: false)
 * @returns A string representing the ASCII art
 */
function renderAsciiArtString(text: string, useSmallFont: boolean = false): string {
  return renderAsciiArt(text, useSmallFont).join('\n');
}

/**
 * Renders text with styles and returns formatted result
 * @param text The text to render with style markers
 * @param fontName The font to use: 'regular', 'ascii', or 'smallAscii'
 * @param maxWidth Optional maximum width for text wrapping (regular font only)
 * @returns Formatted text and link data
 */
export function renderFormattedText(
  text: string, 
  fontName: FontName = 'regular',
  maxWidth?: number
): {
  text: string;
  html: string; // Add HTML output
  links: Array<{line: number, start: number, end: number, url: string}>;
  styles: Array<{line: number, start: number, end: number, style: TextStyle}>;
} {
  const renderedLines = renderText(text, fontName, maxWidth);
  const linkData: Array<{line: number, start: number, end: number, url: string}> = [];
  const styleData: Array<{line: number, start: number, end: number, style: TextStyle}> = [];
  
  // Process links and styles data
  renderedLines.forEach((line, lineIdx) => {
    line.links.forEach(link => {
      linkData.push({
        line: lineIdx,
        start: link.start,
        end: link.end,
        url: link.url
      });
    });
    
    line.styles.forEach(style => {
      styleData.push({
        line: lineIdx,
        start: style.start,
        end: style.end,
        style: {
          ...style.style,
          // Make sure color is explicitly included
          color: style.style.color
        }
      });
    });
  });
  
  // Add spacing between lines for regular text
  if (fontName === 'regular') {
    const spacedLines: string[] = [];
    const spacedHtmlLines: string[] = [];
    renderedLines.forEach((line, i) => {
      spacedLines.push(line.line || '');
      spacedHtmlLines.push(line.html || '');
      // Add an empty line after each line except the last one
      if (i < renderedLines.length - 1) {
        spacedLines.push('');
        spacedHtmlLines.push('');
      }
    });
    return {
      text: spacedLines.join('\n'),
      html: spacedHtmlLines.join('\n'),
      links: linkData,
      styles: styleData
    };
  }
  
  return {
    text: renderedLines.map(l => l.line || '').join('\n'),
    html: renderedLines.map(l => l.html || l.line || '').join('\n'),
    links: linkData,
    styles: styleData
  };
}

// Export the functions for use in other modules
export { renderAsciiArt, renderAsciiArtString };