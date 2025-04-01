import { useEffect, useRef } from 'react';
import { 
  FRAME_DURATION, 
  BASE_CHUNK_SIZE, 
  CHAR_HEIGHT, 
  IS_SAFARI
} from '../constants';
import { Size, TextPositionCacheResult } from '../types';
import { getGridDimensions } from '../utils';

export const useAnimation = (
  textRef: React.RefObject<HTMLPreElement>,
  size: Size,
  calculateCharacter: (x: number, y: number, cols: number, rows: number, aspect: number, time: number) => string,
  scrollOffsetRef: React.MutableRefObject<number>,
  textPositionCache: TextPositionCacheResult,
  isScrolling: React.MutableRefObject<boolean>,
  scrollVelocity: React.MutableRefObject<number>,
  linkPositionsRef: React.MutableRefObject<any[]>,
  setLinkClicked?: React.Dispatch<React.SetStateAction<string | null>>
) => {
  const lastFrameTimeRef = useRef<number>(0);
  const lastFrameRef = useRef<string[][]>([]);
  
  // Animation setup and render loop
  useEffect(() => {
    const element = textRef.current;
    if (!element || !size.width || !size.height) return;

    // Add hover styles for links - enhanced with pointer-events and override for all links
    const style = document.createElement('style');
    style.textContent = `
        .ascii-link:hover {
            background-color: rgba(52, 152, 219, 0.2) !important;
            color: #ffffff !important;
            text-decoration: underline !important;
        }
        
        /* Force links to be clickable */
        .ascii-link, a {
            pointer-events: auto !important;
            cursor: pointer !important;
        }
        
        /* Override any parent element that might block clicks */
        pre a {
            pointer-events: auto !important;
            z-index: 1000 !important;
            position: relative !important;
        }
    `;
    document.head.appendChild(style);

    // Allow link clicks by adding a delegated event handler
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const linkElement = target.closest('a');
      if (linkElement && linkElement.getAttribute('href')) {
        // For debugging - log when a link is clicked
        const url = linkElement.getAttribute('href') || '';
        console.log('Link clicked:', url);
        if (setLinkClicked) {
          setLinkClicked(url);
        }
        
        // Don't prevent default - allow the browser to handle the link normally
      }
    };
    
    element.addEventListener('click', handleLinkClick);

    let { cols, rows } = getGridDimensions(size.width, size.height);
    
    if (IS_SAFARI) {
      // Calculate a proportional buffer (e.g., 3.5% of height), ensure at least 1 extra row
      const CHAR_HEIGHT_VAL = 10; // From constants.ts (SCALE_FACTOR)
      const extraRows = Math.max(1, Math.ceil((size.height * 0.035) / CHAR_HEIGHT_VAL));
      rows += extraRows;
    }
    
    const aspectRatio = size.width / size.height;
    
    // Ensure lastFrameRef has enough rows allocated
    if (!lastFrameRef.current || lastFrameRef.current.length !== rows) {
      lastFrameRef.current = new Array(rows)
          .fill(null)
          .map(() => new Array(cols).fill(' '));
    }
    
    let animationFrameId: number;
    
    const numChunks = Math.ceil(rows / BASE_CHUNK_SIZE);
    
    // We'll build rowBuffers as an array of string arrays
    const rowBuffers: string[][] = new Array(rows)
        .fill(null)
        .map(() => new Array(cols).fill(' '));
    
    // Create a map to track styled characters
    const styleMap: Map<string, string> = new Map();
    
    const animate = (timestamp: number) => {
      if (timestamp - lastFrameTimeRef.current >= FRAME_DURATION) {
        // Set quality based on scrolling state - completely revamped logic
        let skipFactor = 1; // Default to high quality (1 = no skipping)
        let chunkSizeFactor = 1; // Default to high quality
        
        // ONLY use low quality during active scrolling with significant velocity
        if (isScrolling.current && Math.abs(scrollVelocity.current) > 5) {
          // Only reduce quality during actual active scrolling with meaningful velocity
          if (Math.abs(scrollVelocity.current) > 40) {
            skipFactor = 3;
            chunkSizeFactor = 3;
          } else if (Math.abs(scrollVelocity.current) > 20) {
            skipFactor = 2;
            chunkSizeFactor = 2;
          } else {
            skipFactor = 2;
            chunkSizeFactor = 1.5;
          }
        }
        
        lastFrameTimeRef.current = timestamp;
        const adjustedChunkSize = Math.ceil(BASE_CHUNK_SIZE * chunkSizeFactor);
        
        // Clear all row buffers and style map at the start of each frame
        styleMap.clear();
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            rowBuffers[y][x] = ' ';
          }
        }
        
        // Get scroll position
        const scrolledY = Math.floor(scrollOffsetRef.current / CHAR_HEIGHT);
        
        // First pass: collect all styled text positions
        for (const link of linkPositionsRef.current) {
          const isFixed = textPositionCache.bounds[link.textKey]?.fixed || false;
          const linkY = isFixed ? link.y : link.y - scrolledY;
          
          if (linkY >= 0 && linkY < rows) {
            for (let x = link.startX; x <= link.endX; x++) {
              if (x >= 0 && x < cols) {
                // Mark this position as a link with an actual anchor tag
                // Add direct onclick attribute to ensure it works
                styleMap.set(`${x},${linkY}`, `<a href="${link.url}" style="color:rgb(63, 52, 219); text-decoration: underline; cursor: pointer;" data-link-url="${link.url}" class="ascii-link" target="_blank" onclick="window.open('${link.url}', '_blank')">$</a>`);
              }
            }
          }
        }
        
        // Process bold text
        for (const textKey in textPositionCache.cache) {
          const positions = textPositionCache.cache[textKey];
          const isFixed = textPositionCache.bounds[textKey]?.fixed || false;
          
          for (const pos of positions) {
            const x = pos.startX;
            const y = isFixed ? pos.y : pos.y - scrolledY;
            
            // Check if this character is inside the viewport
            if (y >= 0 && y < rows && x >= 0 && x < cols) {
              // Check if this position is already styled as a link
              const key = `${x},${y}`;
              if (!styleMap.has(key) && pos.char && pos.char !== ' ') {
                // Test if this character should be bold based on the grid entry
                // Calculate index into the flat grid array using original position
                const originalY = pos.y; 
                const arrayIndex = (originalY - textPositionCache.offsetY) * textPositionCache.gridCols + x;

                // Check bounds and retrieve cell data
                const cell = (x >= 0 && x < textPositionCache.gridCols && originalY >= textPositionCache.offsetY && arrayIndex >= 0 && arrayIndex < textPositionCache.grid.length) 
                             ? textPositionCache.grid[arrayIndex] 
                             : null;

                if (cell) { // Check if a cell exists at this original position
                  if (cell.isBold && cell.isItalic) {
                    // Both bold and italic
                    styleMap.set(key, `<span style="font-weight:bold; font-style:italic; text-shadow: 0px 0px 1px #000;">$</span>`);
                  } else if (cell.isBold) {
                    // Bold only
                    styleMap.set(key, `<span style="font-weight:bold; text-shadow: 0px 0px 1px #000;">$</span>`);
                  } else if (cell.isItalic) {
                    // Italic only
                    styleMap.set(key, `<span style="font-style:italic;">$</span>`);
                  }
                }
              }
            }
          }
        }
        
        // Render in chunks with full screen refresh on each frame
        for (let chunk = 0; chunk < numChunks; chunk++) {
          const startRow = chunk * BASE_CHUNK_SIZE;
          const endRow = Math.min(startRow + adjustedChunkSize, rows);
          
          for (let y = startRow; y < endRow; y++) {
            for (let x = 0; x < cols; x += skipFactor) {
              // Call calculateCharacter with the correct signature
              const char = calculateCharacter(x, y, cols, rows, aspectRatio, timestamp);
              rowBuffers[y][x] = char;
              // Fill in skipped positions with the same character if needed
              for (let i = 1; i < skipFactor && x + i < cols; i++) {
                rowBuffers[y][x+i] = char;
              }
            }
          }
        }
        
        // Now store rowBuffers in lastFrameRef 
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            lastFrameRef.current[y][x] = rowBuffers[y][x];
          }
        }
        
        // Build final text - apply styling where needed
        const lines = rowBuffers.map((row, y) => {
          let lineHTML = '';
          for (let x = 0; x < row.length; x++) {
            const key = `${x},${y}`;
            const styledChar = styleMap.get(key);
            if (styledChar) {
              // Replace the placeholder $ with the actual character
              lineHTML += styledChar.replace('$', row[x]);
            } else {
              lineHTML += row[x];
            }
          }
          return lineHTML;
        });
        
        // Set the content with HTML markup that includes clickable links
        element.innerHTML = lines.join('\n');
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    animate(0);
    return () => {
      cancelAnimationFrame(animationFrameId);
      element.removeEventListener('click', handleLinkClick);
      // Clean up the added style
      document.head.removeChild(style);
    };
  }, [size, calculateCharacter, textRef, scrollOffsetRef, isScrolling, 
      scrollVelocity, linkPositionsRef, setLinkClicked, textPositionCache.bounds]);

  return {
    lastFrameTimeRef,
    lastFrameRef
  };
}; 