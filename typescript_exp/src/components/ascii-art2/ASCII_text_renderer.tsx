const segments = parseTextForStyles(line);
// console.log('Parsed segments:', segments);
const lineStyleData: LineStyleData[] = [];

export function renderTextWithStyles(text: string, options: RenderOptions): { lines: string[], styleData: StyleData[], linkPositions: LinkPosition[] } {
  // console.log("Original text:", text);
  const lines = text.split('\n');
  // console.log("Rendered lines count:", lines.length);
  const renderedLines: string[] = [];

  const finalStyleData: StyleData[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const segmentStyles = parseTextForStyles(line);
    // console.log(`Line ${i} has ${segmentStyles.length} style entries:`, segmentStyles.map(s => `start=${s.start}, end=${s.end}, bold=${s.isBold}`));

    // Store style information for this line
    const styleDataForLine: StyleData[] = [];
    let currentStyle: StyleData | undefined;

    for (const segment of segmentStyles) {
      if (segment.isBold) {
        const styleEntry = styleDataForLine.find(s => s.start === segment.start && s.end === segment.end);
        // console.log(`Adding bold style at line ${i}, from ${segment.start} to ${segment.end}`);
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

    // console.log(`Line ${i} style data:`, styleDataForLine);

    const lineStyleData: LineStyleData[] = [];
    for (const style of styleDataForLine) {
      const lineStyle: LineStyleData = {
        start: style.start,
        end: style.end,
        isBold: style.isBold
      };
      lineStyleData.push(lineStyle);
    }

    // console.log(`Line ${i} style data:`, lineStyleData);

    const renderedLine = renderLine(line, lineStyleData);
    renderedLines.push(renderedLine);

    // console.log(`Line ${i} rendered line:`, renderedLine);

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

  // console.log('Before adjustment - Style data:', finalStyleData);
  adjustStylesForWhitespace(renderedLines, finalStyleData);
  // console.log('After adjustment - Style data:', finalStyleData);

  return {
    lines: renderedLines,
    styleData: finalStyleData,
    linkPositions: []
  };
} 