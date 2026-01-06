/**
 * ASCII Art Text Renderer
 * Renders text as ASCII art with intelligent letter overlapping
 */

// Import font definitions from separate file
import {
  asciiChars,
  blockAsciiChars,
  blockAsciiDoubleChars,
  outlineAsciiChars,
  lineAsciiChars,
  twinRailWireframeChars,
  smallAsciiChars,
  microAsciiChars
} from '../asciiFonts';
import { countGraphemeCells } from './utils';

// ADDED/MODIFIED: FontName type to include all supported fonts
export type FontName =
  | 'regular'
  | 'ascii'
  | 'blockAscii'
  | 'blockAsciiDouble'
  | 'outlineAscii'
  | 'lineAscii'
  | 'twinRailWireframe'
  | 'smallAscii'
  | 'microAscii';

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

// Add interface for text wrapping options
interface TextWrapOptions {
  maxWidth?: number;
  respectLineBreaks?: boolean;
}

/**
 * Wraps text at specified max width, breaking only at spaces
 * @param text The text to wrap
 * @param maxWidth Maximum width for each line
 * @returns Array of wrapped text lines
 */
function wrapText(text: string, maxWidth: number = 80): string[] {
  // If no maxWidth provided or invalid, return text split by newlines
  if (!maxWidth || maxWidth <= 0) {
    return text.split('\n');
  }

  const shouldUseGraphemeWidths = Array.from(text).some(char => (char.codePointAt(0) ?? 0) > 127);
  const measureWidth = (value: string) => (shouldUseGraphemeWidths ? countGraphemeCells(value) : value.length);

  const lines: string[] = [];
  const paragraphs = text.split('\n');

  // Process each paragraph
  for (const paragraph of paragraphs) {
    if (measureWidth(paragraph) <= maxWidth) {
      lines.push(paragraph);
      continue;
    }

    let line = '';
    const words = paragraph.split(' ');

    // Process each word
    for (const word of words) {
      const lineWidth = line.length === 0 ? 0 : measureWidth(line);
      const wordWidth = measureWidth(word);
      const nextWidth = lineWidth + wordWidth + (lineWidth > 0 ? 1 : 0);
      // If adding this word would exceed maxWidth
      if (nextWidth > maxWidth && lineWidth > 0) {
        lines.push(line); // Push current line
        line = word; // Start new line with current word
      } else {
        // Add word to current line with a space if not first word
        line = lineWidth === 0 ? word : `${line} ${word}`;
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
 * Parse text with style markers and convert to styled segments
 * Supports:
 * - ==bold== (changed from **bold**)
 * - //italic// (changed from _italic_)
 * - [link text](url)
 * - &&red text&& (added support for red text)
 */
function parseTextWithStyles(text: string): TextSegment[] {
  if (!text) return [];

  const segments: TextSegment[] = [];
  let cursor = 0;

  // Regular expressions for style markers
  // Note: [\\s\\S] allows matches across line breaks, which is needed when a
  // marker pair is split across wrapped lines (e.g. "==bold\\ntext==").
  const boldRegex = /==([\s\S]*?)==/g;
  const italicRegex = /\/\/([\s\S]*?)\/\//g; // Double slash for italic
  const linkRegex = /\[([\s\S]*?)\]\(([\s\S]*?)\)/g;
  const redTextRegex = /&&([\s\S]*?)&&/g; // Text between && markers

  while (cursor < text.length) {
    let nextMatch: RegExpExecArray | null = null;
    let matchType: 'bold' | 'italic' | 'link' | 'red' | null = null;

    boldRegex.lastIndex = cursor;
    const boldMatch = boldRegex.exec(text);
    if (boldMatch) {
      nextMatch = boldMatch;
      matchType = 'bold';
    }

    italicRegex.lastIndex = cursor;
    const italicMatch = italicRegex.exec(text);
    if (italicMatch && (!nextMatch || italicMatch.index < nextMatch.index)) {
      nextMatch = italicMatch;
      matchType = 'italic';
    }

    linkRegex.lastIndex = cursor;
    const linkMatch = linkRegex.exec(text);
    if (linkMatch && (!nextMatch || linkMatch.index < nextMatch.index)) {
      nextMatch = linkMatch;
      matchType = 'link';
    }

    redTextRegex.lastIndex = cursor;
    const redMatch = redTextRegex.exec(text);
    if (redMatch && (!nextMatch || redMatch.index < nextMatch.index)) {
      nextMatch = redMatch;
      matchType = 'red';
    }

    if (!nextMatch || !matchType) {
      break;
    }

    if (nextMatch.index > cursor) {
      segments.push({ text: text.substring(cursor, nextMatch.index) });
    }

    if (matchType === 'bold') {
      segments.push({ text: nextMatch[1], isBold: true });
    } else if (matchType === 'italic') {
      segments.push({ text: nextMatch[1], isItalic: true });
    } else if (matchType === 'link') {
      segments.push({ text: nextMatch[1], isLink: true, url: nextMatch[2] });
    } else if (matchType === 'red') {
      segments.push({ text: nextMatch[1], color: '#FF0000' });
    }

    cursor = nextMatch.index + nextMatch[0].length;
  }

  if (cursor < text.length) {
    segments.push({ text: text.substring(cursor) });
  }

  return segments;
}

function splitSegmentsByNewlines(segments: TextSegment[]): TextSegment[][] {
  const lines: TextSegment[][] = [[]];

  for (const segment of segments) {
    const parts = segment.text.split('\n');
    for (let i = 0; i < parts.length; i++) {
      const partText = parts[i];
      if (partText.length > 0) {
        lines[lines.length - 1].push({ ...segment, text: partText });
      }
      if (i < parts.length - 1) {
        lines.push([]);
      }
    }
  }

  return lines;
}

// Add a type for text styles including color
interface TextStyle {
  isBold?: boolean;
  isItalic?: boolean;
  isLink?: boolean;
  url?: string;
  color?: string; // Add color field
}

interface StyledChar {
  char: string;
  style: TextStyle;
}

function buildStyledChars(segments: TextSegment[]): StyledChar[] {
  const chars: StyledChar[] = [];

  for (const segment of segments) {
    const style: TextStyle = {
      isBold: segment.isBold,
      isItalic: segment.isItalic,
      isLink: segment.isLink,
      url: segment.url,
      color: segment.isLink ? '#3498db' : segment.color
    };

    for (let i = 0; i < segment.text.length; i++) {
      chars.push({ char: segment.text[i], style });
    }
  }

  return chars;
}

function trimLeadingSpaces(chars: StyledChar[]): StyledChar[] {
  let start = 0;
  while (start < chars.length && chars[start].char === ' ') {
    start += 1;
  }
  return chars.slice(start);
}

function trimTrailingSpaces(chars: StyledChar[]): StyledChar[] {
  let end = chars.length;
  while (end > 0 && chars[end - 1].char === ' ') {
    end -= 1;
  }
  return chars.slice(0, end);
}

function findLastSpaceIndex(chars: StyledChar[]): number {
  for (let i = chars.length - 1; i >= 0; i--) {
    if (chars[i].char === ' ') {
      return i;
    }
  }
  return -1;
}

function measureStyledWidth(chars: StyledChar[], fontName: FontName): number {
  return chars.reduce((total, { char }) => total + getAsciiCharWidth(char, fontName), 0);
}

function wrapStyledChars(
  styledChars: StyledChar[],
  fontName: FontName,
  options: TextWrapOptions
): StyledChar[][] {
  const maxWidth = options.maxWidth;
  const respectLineBreaks = options.respectLineBreaks !== false;
  const lines: StyledChar[][] = [];
  let current: StyledChar[] = [];
  let currentWidth = 0;
  let lastBreakIndex = -1;

  const pushCurrent = () => {
    lines.push(trimTrailingSpaces(current));
    current = [];
    currentWidth = 0;
    lastBreakIndex = -1;
  };

  for (const styledChar of styledChars) {
    if (respectLineBreaks && styledChar.char === '\n') {
      pushCurrent();
      continue;
    }

    if (maxWidth && maxWidth > 0) {
      const charWidth = getAsciiCharWidth(styledChar.char, fontName);
      let needsPlacement = true;

      while (needsPlacement && current.length > 0 && currentWidth + charWidth > maxWidth) {
        if (styledChar.char === ' ') {
          pushCurrent();
          needsPlacement = false;
          break;
        }

        if (lastBreakIndex >= 0) {
          const line = current.slice(0, lastBreakIndex);
          lines.push(trimTrailingSpaces(line));
          current = trimLeadingSpaces(current.slice(lastBreakIndex + 1));
          currentWidth = measureStyledWidth(current, fontName);
          lastBreakIndex = findLastSpaceIndex(current);
          continue;
        }

        pushCurrent();
      }

      if (!needsPlacement) {
        continue;
      }

      current.push(styledChar);
      currentWidth += charWidth;
      if (styledChar.char === ' ') {
        lastBreakIndex = current.length - 1;
      }
    } else {
      current.push(styledChar);
    }
  }

  pushCurrent();
  return lines;
}

function buildAsciiRanges(
  lineText: string,
  styleMap: Record<number, TextStyle>,
  fontName: FontName
) {
  const linkRanges: Array<{start: number, end: number, url: string}> = [];
  const styleRanges: Array<{start: number, end: number, style: TextStyle}> = [];
  let currentLinkStart = -1;
  let currentStyleStart = -1;
  let currentStyle: TextStyle | null = null;
  let currentUrl = '';
  let styledLength = 0;

  for (let i = 0; i < lineText.length; i++) {
    const style = styleMap[i] || {};
    const charWidth = getAsciiCharWidth(lineText[i], fontName);

    if (style.color || style.isBold || style.isItalic || style.isLink) {
      if (currentStyleStart === -1 || JSON.stringify(currentStyle) !== JSON.stringify(style)) {
        if (currentStyleStart !== -1 && currentStyle) {
          styleRanges.push({
            start: currentStyleStart,
            end: styledLength,
            style: currentStyle
          });
        }
        currentStyleStart = styledLength;
        currentStyle = { ...style };
      }
    } else if (currentStyleStart !== -1 && currentStyle) {
      styleRanges.push({
        start: currentStyleStart,
        end: styledLength,
        style: currentStyle
      });
      currentStyleStart = -1;
      currentStyle = null;
    }

    if (style.isLink) {
      if (currentLinkStart === -1) {
        currentLinkStart = styledLength;
        currentUrl = style.url || '';
      }
    } else if (currentLinkStart !== -1) {
      linkRanges.push({
        start: currentLinkStart,
        end: styledLength,
        url: currentUrl
      });
      currentLinkStart = -1;
    }

    styledLength += charWidth;
  }

  if (currentStyleStart !== -1 && currentStyle) {
    styleRanges.push({
      start: currentStyleStart,
      end: styledLength,
      style: currentStyle
    });
  }

  if (currentLinkStart !== -1) {
    linkRanges.push({
      start: currentLinkStart,
      end: styledLength,
      url: currentUrl
    });
  }

  return { linkRanges, styleRanges };
}

function getAsciiFontHeight(fontName: FontName): number {
  const fontSet = selectAsciiFont(fontName);
  const sample = fontSet['A'] || fontSet['a'] || fontSet['0'] || fontSet[' '] || [''];
  return sample.length;
}

function renderStyledAsciiLines(
  lineText: string,
  styleMap: Record<number, TextStyle>,
  fontName: FontName
): Array<{
  html?: string,
  line?: string,
  links: Array<{start: number, end: number, url: string}>,
  styles: Array<{start: number, end: number, style: TextStyle}>
}> {
  let asciiLines = renderAsciiArt(lineText, fontName);
  if (lineText.length === 0) {
    asciiLines = Array.from({ length: getAsciiFontHeight(fontName) }, () => '');
  }

  const { linkRanges, styleRanges } = buildAsciiRanges(lineText, styleMap, fontName);
  const renderedLines: Array<{
    html?: string,
    line?: string,
    links: Array<{start: number, end: number, url: string}>,
    styles: Array<{start: number, end: number, style: TextStyle}>
  }> = [];

  for (const line of asciiLines) {
    let styledLine = '';
    let htmlLine = '';
    let lastCharEnd = 0;

    for (let i = 0; i < lineText.length; i++) {
      const style = styleMap[i] || {};
      const charWidth = getAsciiCharWidth(lineText[i], fontName);
      const charStart = lastCharEnd;
      const charEnd = charStart + charWidth;
      const charSection = line.substring(charStart, charEnd);

      let htmlCharSection = charSection
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      if (style.color && !style.isLink) {
        htmlCharSection = `<span style="color: ${style.color};">${htmlCharSection}</span>`;
      }

      if (style.isLink && style.url) {
        htmlCharSection = `<a href="${style.url}" style="color: #3498db; cursor: pointer; text-decoration: underline;" data-link-url="${style.url}" class="ascii-link" target="_blank" rel="noopener noreferrer">${htmlCharSection}</a>`;
      } else if (style.isLink) {
        htmlCharSection = `<span style="color: #3498db; cursor: pointer;">${htmlCharSection}</span>`;
      }

      styledLine += charSection;
      htmlLine += htmlCharSection;
      lastCharEnd = charEnd;
    }

    renderedLines.push({
      line: styledLine,
      html: htmlLine,
      links: linkRanges,
      styles: styleRanges
    });
  }

  return renderedLines;
}

/**
 * Renders text with styles and applies formatting
 * @param text The text to render with style markers (bold, italic, links)
 * @param fontName The font to use: 'regular', 'ascii', 'blockAscii', 'blockAsciiDouble', 'outlineAscii', 'lineAscii', 'twinRailWireframe', 'smallAscii', or 'microAscii'
 * @param options Additional options including text wrapping
 * @returns An array of styled text lines with metadata
 */
export function renderText(
  text: string, 
  fontName: FontName = 'regular',
  options: TextWrapOptions = { respectLineBreaks: true }
): Array<{
  html?: string,
  line?: string,
  links: Array<{start: number, end: number, url: string}>,
  styles: Array<{start: number, end: number, style: TextStyle}>
}> {
  if (!text || text.length === 0) {
    return [{html: '', links: [], styles: []}];
  }
  
  // For regular text, simply format it with style markers
  if (fontName === 'regular') {
    const result: Array<{
      html: string, 
      line?: string,
      links: Array<{start: number, end: number, url: string}>,
      styles: Array<{start: number, end: number, style: TextStyle}>
    }> = [];
    const maxWidth = options.maxWidth ?? 80;

    // 1) Wrap text first (preserves existing layout behavior).
    // 2) Parse styles across the full wrapped block so markers can span lines.
    const rawWrappedLines: string[] = [];
    for (const paragraph of text.split('\n')) {
      const wrappedLines = maxWidth && maxWidth > 0
        ? wrapText(paragraph, maxWidth)
        : [paragraph];
      rawWrappedLines.push(...wrappedLines);
    }

    const wrappedText = rawWrappedLines.join('\n');
    const parsedSegments = parseTextWithStyles(wrappedText);
    const segmentsByLine = splitSegmentsByNewlines(parsedSegments);

    for (const lineSegments of segmentsByLine) {
      let formattedLine = '';
      let htmlLine = '';
      const lineLinks: Array<{start: number, end: number, url: string}> = [];
      const lineStyles: Array<{start: number, end: number, style: TextStyle}> = [];
      let currentPos = 0;

      for (const segment of lineSegments) {
        const startPos = currentPos;
        const formattedSegment = segment.text;

        let segmentHtml = segment.text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');

        const cssStyles: string[] = [];
        if (segment.isBold) cssStyles.push('font-weight: bold');
        if (segment.isItalic) cssStyles.push('font-style: italic');
        if (segment.color) cssStyles.push(`color: ${segment.color}`);
        if (segment.isLink) cssStyles.push('color: #3498db; text-decoration: underline; cursor: pointer');

        if (cssStyles.length > 0 && !segment.isLink) {
          segmentHtml = `<span style="${cssStyles.join('; ')}">${segmentHtml}</span>`;
        }

        if (segment.isLink && segment.url) {
          segmentHtml = `<a href="${segment.url}" 
            style="${cssStyles.join('; ')}" 
            data-link-url="${segment.url}" 
            class="ascii-link" 
            target="_blank" 
            rel="noopener noreferrer">${segmentHtml}</a>`;
        } else if (segment.isLink) {
          segmentHtml = `<span style="color: #3498db; cursor: pointer;">${segmentHtml}</span>`;
        }

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

    return result;
  }
  
  // For ASCII art text, render the text as ASCII art
  // Parse text into segments first
  const segments = parseTextWithStyles(text);
  const styledChars = buildStyledChars(segments);
  const wrappedLines = wrapStyledChars(styledChars, fontName, options);

  const renderedLines: Array<{
    html?: string,
    line?: string,
    links: Array<{start: number, end: number, url: string}>,
    styles: Array<{start: number, end: number, style: TextStyle}>
  }> = [];

  for (const lineChars of wrappedLines) {
    const lineText = lineChars.map(({ char }) => char).join('');
    const styleMap: Record<number, TextStyle> = {};
    for (let i = 0; i < lineChars.length; i++) {
      styleMap[i] = lineChars[i].style;
    }

    renderedLines.push(...renderStyledAsciiLines(lineText, styleMap, fontName));
  }

  return renderedLines;
}

/**
 * Get the width of an ASCII character in the specified font
 */
function getAsciiCharWidth(char: string, fontName: FontName): number {
  const fontSet = selectAsciiFont(fontName);
  const charArt = fontSet[char] || fontSet[' '];
  return charArt[0]?.length || 0;
}


/**
 * Renders text with styles as a string
 * @param text The text to render
 * @param fontName The font to use: 'regular', 'ascii', 'blockAscii', 'blockAsciiDouble', 'outlineAscii', 'lineAscii', 'twinRailWireframe', 'smallAscii', or 'microAscii'
 * @param options Additional options including text wrapping
 * @returns A rendered string with style information
 */
export function renderTextString(
  text: string, 
  fontName: FontName = 'regular', 
  options: TextWrapOptions = { respectLineBreaks: true }
): string {
  const renderedLines = renderText(text, fontName, options);
  return renderedLines.map(l => l.line).join('\n');
}

/**
 * Renders text as ASCII art
 * @param text The text to render
 * @param fontName Which ASCII font to use (default: 'ascii')
 * @returns An array of strings representing the ASCII art
 */
function renderAsciiArt(text: string, fontName: FontName = 'ascii'): string[] {
  if (!text || text.length === 0) {
    return [''];
  }
  
  // Select the font to use
  const fontSet = selectAsciiFont(fontName);
  
  // For normal text that uses small font, just return the text itself
  // Only convert single words or titles to ASCII art
  if (text.includes(' ') && !text.startsWith('#') && fontName === 'smallAscii') {
    return text.split('\n');
  }
  
  // Get the first character's ASCII art
  const firstChar = text[0];
  const result = [...(fontSet[firstChar] || fontSet[' '])];
  
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
 * @param fontName Which ASCII font to use (default: 'ascii')
 * @returns A string representing the ASCII art
 */
function renderAsciiArtString(text: string, fontName: FontName = 'ascii'): string {
  return renderAsciiArt(text, fontName).join('\n');
}

/**
 * Renders text with styles and returns formatted result
 * @param text The text to render with style markers
 * @param fontName The font to use: 'regular', 'ascii', 'blockAscii', 'blockAsciiDouble', 'outlineAscii', 'lineAscii', 'twinRailWireframe', 'smallAscii', or 'microAscii'
 * @param options Additional options including text wrapping
 * @returns Formatted text and link data
 */
export function renderFormattedText(
  text: string, 
  fontName: FontName = 'regular',
  options: TextWrapOptions = { respectLineBreaks: true }
): {
  text: string;
  html: string; // Add HTML output
  links: Array<{line: number, start: number, end: number, url: string}>;
  styles: Array<{line: number, start: number, end: number, style: TextStyle}>;
} {
  const renderedLines = renderText(text, fontName, options);
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
    const adjustedLinkData: Array<{line: number, start: number, end: number, url: string}> = [];
    const adjustedStyleData: Array<{line: number, start: number, end: number, style: TextStyle}> = [];
    
    // Add spacing and adjust line numbers for links and styles
    renderedLines.forEach((line, i) => {
      // Add the current line
      spacedLines.push(line.line || '');
      spacedHtmlLines.push(line.html || '');
      
      // Adjust line numbers for links on this line
      linkData.forEach(link => {
        if (link.line === i) {
          adjustedLinkData.push({
            ...link,
            line: i * 2 // Each original line becomes 2 lines (original + spacing)
          });
        }
      });
      
      // Adjust line numbers for styles on this line
      styleData.forEach(style => {
        if (style.line === i) {
          adjustedStyleData.push({
            ...style,
            line: i * 2 // Each original line becomes 2 lines (original + spacing)
          });
        }
      });
      
      // Add an empty line after each line except the last one
      if (i < renderedLines.length - 1) {
        spacedLines.push('');
        spacedHtmlLines.push('');
      }
    });
    
    return {
      text: spacedLines.join('\n'),
      html: spacedHtmlLines.join('\n'),
      links: adjustedLinkData,  // Use adjusted link data
      styles: adjustedStyleData // Use adjusted style data
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

function selectAsciiFont(fontName: FontName) {
  switch (fontName) {
    case 'blockAscii':
      return blockAsciiChars;
    case 'blockAsciiDouble':
      return blockAsciiDoubleChars;
    case 'outlineAscii':
      return outlineAsciiChars;
    case 'lineAscii':
      return lineAsciiChars;
    case 'twinRailWireframe':
      return twinRailWireframeChars;
    case 'smallAscii':
      return smallAsciiChars;
    case 'microAscii':
      return microAsciiChars;
    default:
      return asciiChars;
  }
}
